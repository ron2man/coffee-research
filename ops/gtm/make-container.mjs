// Generates a GTM container export (format 2) with the GA4 custom-event setup for the site.
// Usage: node ops/gtm/make-container.mjs ops/gtm/container.json
import { writeFileSync } from 'node:fs';

const out = process.argv[2];
const MEASUREMENT_ID = 'G-0K16L41GKQ';
const ids = { accountId: '0', containerId: '0' };
const fingerprint = String(Date.UTC(2026, 10, 22));

// Event name -> GA4 event parameters (all read from dataLayer `params.*`), as pushed by site.js.
const events = {
  affiliate_click: ['product_id', 'seller', 'market', 'position', 'tool_state', 'page_id'],
  tool_complete: ['tool_id', 'result', 'page_id'],
  scroll_depth: ['percent', 'page_id'],
};

const dlvKeys = ['market', 'page_id', ...new Set(Object.values(events).flat().map((p) => `params.${p}`))];
let n = 0;
const variable = [
  {
    ...ids, variableId: String(++n), name: 'Const - GA4 Measurement ID', type: 'c', fingerprint,
    parameter: [{ type: 'TEMPLATE', key: 'value', value: MEASUREMENT_ID }],
  },
  ...dlvKeys.map((key) => ({
    ...ids, variableId: String(++n), name: `DLV - ${key}`, type: 'v', fingerprint,
    parameter: [
      { type: 'INTEGER', key: 'dataLayerVersion', value: '2' },
      { type: 'BOOLEAN', key: 'setDefaultValue', value: 'false' },
      { type: 'TEMPLATE', key: 'name', value: key },
    ],
  })),
];

const trigger = Object.keys(events).map((name, i) => ({
  ...ids, triggerId: String(i + 1), name: `CE - ${name}`, type: 'CUSTOM_EVENT', fingerprint,
  customEventFilter: [{
    type: 'EQUALS',
    parameter: [
      { type: 'TEMPLATE', key: 'arg0', value: '{{_event}}' },
      { type: 'TEMPLATE', key: 'arg1', value: name },
    ],
  }],
}));

const tag = Object.entries(events).map(([name, params], i) => ({
  ...ids, tagId: String(i + 1), name: `GA4 Event - ${name}`, type: 'gaawe', fingerprint,
  parameter: [
    { type: 'BOOLEAN', key: 'sendEcommerceData', value: 'false' },
    { type: 'TEMPLATE', key: 'eventName', value: name },
    { type: 'TEMPLATE', key: 'measurementIdOverride', value: '{{Const - GA4 Measurement ID}}' },
    {
      type: 'LIST', key: 'eventSettingsTable',
      list: params.map((p) => ({
        type: 'MAP',
        map: [
          { type: 'TEMPLATE', key: 'parameter', value: p },
          { type: 'TEMPLATE', key: 'parameterValue', value: `{{DLV - params.${p}}}` },
        ],
      })),
    },
  ],
  firingTriggerId: [String(i + 1)],
  tagFiringOption: 'ONCE_PER_EVENT',
  monitoringMetadata: { type: 'MAP' },
  consentSettings: { consentStatus: 'NOT_SET' },
}));

// No Google tag here on purpose. Create it by hand in the GTM UI (docs/deploy.md): only a UI-made
// Google tag is linked to the GA4 destination. An imported one compiled to a bare __googtag that
// never sent a hit (container v5-v8). Import this file with Merge, never Overwrite.

const container = {
  exportFormatVersion: 2,
  exportTime: '2026-11-22 14:00:00',
  containerVersion: {
    path: 'accounts/0/containers/0/versions/0',
    ...ids,
    containerVersionId: '0',
    container: {
      path: 'accounts/0/containers/0', ...ids, name: 'yourcoffeesetup.com', publicId: 'GTM-P6P44F42',
      usageContext: ['WEB'], fingerprint,
    },
    tag,
    trigger,
    variable,
    builtInVariable: [{ ...ids, type: 'EVENT', name: 'Event' }],
    fingerprint,
  },
};

writeFileSync(out, JSON.stringify(container, null, 2) + '\n');

// Self-check: every {{reference}} resolves to a variable in the file (or a GTM built-in).
const names = new Set([...variable.map((v) => v.name), '_event', 'Event']);
const refs = [...JSON.stringify(container).matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]);
const missing = refs.filter((r) => !names.has(r));
console.log(`${tag.length} tags, ${trigger.length} triggers, ${variable.length} variables; unresolved refs: ${missing.length ? missing.join(', ') : 'none'}`);
