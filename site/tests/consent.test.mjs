import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { siteDir } from '../lib/site-data.mjs';

// vm values come from another realm, so compare them as plain JSON.
const plain = (value) => JSON.parse(JSON.stringify(value));
const source = readFileSync(join(siteDir, 'public', 'assets', 'consent.js'), 'utf8');

/** Runs consent.js against a tiny fake page. Returns the elements, storage and gtag calls. */
function run({ timeZone = 'Europe/London', stored = null, storageThrows = false } = {}) {
  const el = (hidden = false) => {
    const handlers = {};
    return { hidden, focused: false, addEventListener: (type, fn) => { handlers[type] = fn; }, click: () => handlers.click?.(), focus() { this.focused = true; } };
  };
  const elements = { consent: el(true), 'consent-accept': el(), 'consent-reject': el(), 'consent-settings': el(true) };
  const store = new Map(stored ? [['analytics-consent', stored]] : []);
  const calls = [];
  const localStorage = {
    getItem: (k) => { if (storageThrows) throw new Error('blocked'); return store.get(k) ?? null; },
    setItem: (k, v) => { if (storageThrows) throw new Error('blocked'); store.set(k, v); },
  };
  const context = {
    document: { readyState: 'complete', getElementById: (id) => elements[id] ?? null, addEventListener: () => {} },
    localStorage,
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone }) }) },
    window: { gtag: (...args) => calls.push(args) },
  };
  vm.runInNewContext(source, context);
  return { elements, store, calls };
}

test('the banner asks readers in Europe, and readers whose time zone is unknown', () => {
  for (const timeZone of ['Europe/London', 'Europe/Berlin', 'Atlantic/Canary', 'Atlantic/Reykjavik', '']) {
    assert.equal(run({ timeZone }).elements.consent.hidden, false, timeZone || 'unknown zone');
  }
  for (const timeZone of ['America/New_York', 'Asia/Jerusalem', 'Australia/Sydney']) {
    assert.equal(run({ timeZone }).elements.consent.hidden, true, timeZone);
  }
});

test('a saved choice is not asked again', () => {
  assert.equal(run({ stored: 'granted' }).elements.consent.hidden, true);
  assert.equal(run({ stored: 'denied' }).elements.consent.hidden, true);
  assert.equal(run({ stored: 'something-else' }).elements.consent.hidden, false, 'an unknown value asks again');
});

test('Accept and Reject save the choice, update consent and close the banner', () => {
  for (const [button, value] of [['consent-accept', 'granted'], ['consent-reject', 'denied']]) {
    const { elements, store, calls } = run();
    elements[button].click();
    assert.equal(store.get('analytics-consent'), value);
    assert.deepEqual(plain(calls), [['consent', 'update', { analytics_storage: value }]]);
    assert.equal(elements.consent.hidden, true);
  }
});

test('Cookie settings shows for everyone and reopens the banner', () => {
  const { elements } = run({ timeZone: 'America/New_York', stored: 'granted' });
  assert.equal(elements['consent-settings'].hidden, false);
  assert.equal(elements.consent.hidden, true);
  elements['consent-settings'].click();
  assert.equal(elements.consent.hidden, false);
  assert.equal(elements['consent-accept'].focused, true);
});

test('blocked storage still lets the reader choose for this page', () => {
  const { elements, calls } = run({ storageThrows: true });
  assert.equal(elements.consent.hidden, false);
  elements['consent-reject'].click();
  assert.deepEqual(plain(calls), [['consent', 'update', { analytics_storage: 'denied' }]]);
  assert.equal(elements.consent.hidden, true);
});
