import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateCard } from '../state/knowledge.mjs';

const card = readFileSync(join(import.meta.dirname, '..', '..', 'knowledge', 'machines', 'barista-express.md'), 'utf8');
const check = (markdown) => validateCard(markdown, 'machines', 'barista-express.md');

test('variant names read "<Brand> <Model>", never "<Brand> the <Model>"', () => {
  assert.doesNotThrow(() => check(card));
  assert.throws(
    () => check(card.replace('"name":"Sage Barista Express"', '"name":"Sage the Barista Express"')),
    /puts "the" after the brand/,
  );
  // Without a brand field the first word is treated as the brand.
  assert.throws(
    () => check(card.replace('"name":"Sage Barista Express","brand":"Sage"', '"name":"Sage the Barista Express"')),
    /puts "the" after the brand/,
  );
  // "the" later in a name is fine.
  assert.doesNotThrow(() => check(card.replace('"name":"Sage Barista Express"', '"name":"Sage Barista Express the Second"')));
});
