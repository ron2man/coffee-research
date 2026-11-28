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

import { mkdtempSync, rmSync, readFileSync as read, mkdirSync as mkdir } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { doctor, onCalendar, systemdUnits } from './schedule.mjs';
import { claimScheduler } from './claim.mjs';
import { machineIdentity, schedulerCheck } from '../engine/scheduler/host.mjs';
import { readSchedule } from '../engine/scheduler/tick.mjs';

test('systemd timer: the same slots, persistent, one tick at a time', () => {
  assert.equal(onCalendar(60), '*-*-* *:05:00');
  assert.equal(onCalendar(20), '*-*-* *:05,25,45:00');
  assert.equal(onCalendar(120), '*-*-* 00/2:05:00');
  const { service, timer } = systemdUnits({ intervalMinutes: 30, dir: '/home/bot/coffee' });
  assert.match(service, /Type=oneshot/);
  assert.match(service, /ExecStart=\/bin\/bash \/home\/bot\/coffee\/ops\/tick\.sh/);
  assert.match(timer, /OnCalendar=\*-\*-\* \*:05,35:00/);
  assert.match(timer, /Persistent=true/);
});

test('only the scheduler checkout ticks; claiming moves it and a copied id cannot claim twice', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'claim-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdir(join(root, 'data', 'scheduler'), { recursive: true });
  const mac = machineIdentity(root, { name: 'mac' });
  assert.deepEqual(schedulerCheck(readSchedule(root), mac), { allowed: true, claim: true }, 'nobody yet: the first tick claims');
  await claimScheduler(root, { commit: false });
  const owner = readSchedule(root).scheduler;
  assert.notEqual(owner.id, mac.id, 'a claim always makes a fresh id');
  assert.equal(schedulerCheck(readSchedule(root), machineIdentity(root)).allowed, true);
  const other = schedulerCheck(readSchedule(root), { id: mac.id, name: 'mac' });
  assert.equal(other.allowed, false);
  assert.match(other.reason, /not the scheduler/);
  assert.match(other.reason, /npm run schedule -- claim/);
});

test('doctor names what is missing and how to fix it', () => {
  const exec = (cmd, args) => {
    if (cmd === 'git' && args[0] === 'symbolic-ref') return { status: 0, stdout: 'main\n' };
    if (cmd === 'git' && args[0] === 'status') return { status: 0, stdout: '' };
    if (cmd === 'git' && args[0] === 'config') return { status: 1, stdout: '' };
    if (cmd === 'git' && args[0] === 'push') return { status: 128, stdout: '', stderr: 'git@github.com: Permission denied (publickey).' };
    if (cmd === 'git' && args[0] === 'ls-remote') return { status: 0, stdout: 'abc HEAD' };
    if (cmd === 'claude') return { status: 0, stdout: JSON.stringify({ authMethod: 'claude.ai' }) };
    if (cmd === 'gh') return { status: 1, stdout: '' };
    return { status: 1, stdout: '', stderr: '' };
  };
  const checks = doctor({ exec, home: mkdtempSync(join(tmpdir(), 'home-')) });
  const by = Object.fromEntries(checks.map((c) => [c.name, c]));
  assert.equal(by['Checkout on main'].ok, true);
  assert.equal(by['Claude CLI signed in with the subscription'].ok, true);
  assert.equal(by['Git knows who commits'].ok, false);
  assert.match(by['Git knows who commits'].fix, /git config user\.name/);
  assert.equal(by['Git can push to main without a prompt'].ok, false);
  assert.match(by['Git can push to main without a prompt'].detail, /publickey/);
  assert.equal(by['GitHub CLI signed in (opens publishing pull requests)'].ok, false);
  assert.match(by.Secrets.fix, /bws|env/);
});
