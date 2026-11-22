import test from 'node:test';
import assert from 'node:assert/strict';
import { minutesFor, plist } from './schedule.mjs';

test('launchd job uses fixed calendar slots so missed hours run on wake', () => {
  assert.deepEqual(minutesFor(60), [5]);
  assert.deepEqual(minutesFor(30), [5, 35]);
  const xml = plist({ intervalMinutes: 120 });
  assert.match(xml, /StartCalendarInterval/);
  assert.doesNotMatch(xml, /StartInterval</);
  assert.equal((xml.match(/<key>Hour<\/key>/g) ?? []).length, 12);
});
