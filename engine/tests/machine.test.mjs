import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedTransitions, newItem, transition } from '../state/machine.mjs';

const by = 'test';

test('new-post moves along the happy path and records history', () => {
  let item = newItem({ id: 'x', niche: 'coffee', by });
  for (const to of ['idea_approved', 'researched', 'briefed', 'drafted', 'passed', 'published', 'measured']) {
    item = transition(item, to, { by });
  }
  assert.equal(item.status, 'measured');
  assert.equal(item.history.length, 8);
  assert.deepEqual(allowedTransitions(item), []);
});

test('illegal jumps are refused', () => {
  const item = newItem({ id: 'x', niche: 'coffee', by });
  assert.throws(() => transition(item, 'drafted', { by }), /Illegal transition/);
  assert.throws(() => transition(item, 'published', { by }), /Illegal transition/);
});

test('side states remember where to resume and only allow resume or reject', () => {
  let item = transition(newItem({ id: 'x', niche: 'coffee', by }), 'idea_approved', { by });
  item = transition({ ...item, attempts: 2 }, 'blocked', { by, reason: 'research failed twice' });
  assert.equal(item.resumeStatus, 'idea_approved');
  assert.equal(item.blockedReason, 'research failed twice');
  assert.equal(item.attempts, 2);
  assert.deepEqual(allowedTransitions(item), ['idea_approved', 'rejected']);
  assert.throws(() => transition(item, 'researched', { by }), /Illegal transition/);
  item = transition(item, 'idea_approved', { by: 'human' });
  assert.equal(item.attempts, 0);
  assert.equal(item.resumeStatus, undefined);
});

test('rejected ideas can be re-scored; measured is terminal', () => {
  const rejected = transition(newItem({ id: 'x', niche: 'coffee', by }), 'rejected', { by });
  assert.deepEqual(allowedTransitions(rejected), ['idea']);
});
