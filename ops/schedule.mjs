#!/usr/bin/env node
// Install the scheduler as a macOS launchd agent that runs ops/tick.sh on an interval.
//
//   npm run schedule -- install [--interval-minutes 60]   (run this inside the scheduler's own clone)
//   npm run schedule -- status
//   npm run schedule -- run-now      start one tick through launchd, then check the log
//   npm run schedule -- logs         last 60 lines of .backoffice/tick.log
//   npm run schedule -- uninstall
//
// On Linux or in the cloud, run ops/tick.sh from cron instead (see docs/operations.md).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { homedir, platform, userInfo } from 'node:os';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const label = `local.research-engine.${basename(root).toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
const plistPath = join(homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
const domain = `gui/${userInfo().uid}`;
const log = join(root, '.backoffice', 'tick.log');

const launchctl = (...args) => spawnSync('launchctl', args, { encoding: 'utf8' });
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * Fixed minutes past each hour (e.g. 60 → :05, 30 → :05 and :35). Unlike StartInterval, launchd
 * runs a calendar job that was missed while the Mac slept once it wakes, so no hour is skipped silently.
 */
export function minutesFor(intervalMinutes) {
  const step = Math.min(60, intervalMinutes);
  const minutes = [];
  for (let m = 5; m < 60; m += step) minutes.push(m);
  return minutes;
}

export function plist({ intervalMinutes }) {
  const hours = intervalMinutes > 60 ? Array.from({ length: Math.floor(24 / Math.round(intervalMinutes / 60)) }, (_, i) => i * Math.round(intervalMinutes / 60)) : [null];
  const slots = hours.flatMap((hour) => minutesFor(intervalMinutes).map((minute) =>
    `    <dict>${hour === null ? '' : `<key>Hour</key><integer>${hour}</integer>`}<key>Minute</key><integer>${minute}</integer></dict>`)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>${escape(join(root, 'ops', 'tick.sh'))}</string></array>
  <key>WorkingDirectory</key><string>${escape(root)}</string>
  <key>StartCalendarInterval</key>
  <array>
${slots}
  </array>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>${escape(join(root, '.backoffice', 'launchd.out.log'))}</string>
  <key>StandardErrorPath</key><string>${escape(join(root, '.backoffice', 'launchd.err.log'))}</string>
  <key>ProcessType</key><string>Background</string>
</dict>
</plist>
`;
}

function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { 'interval-minutes': { type: 'string' } } });
  const command = positionals[0] ?? 'status';
  if (platform() !== 'darwin' && command !== 'logs') throw new Error('launchd is macOS only. On Linux use cron: see docs/operations.md');
  if (command === 'install') {
    const intervalMinutes = Number(values['interval-minutes'] ?? 60);
    if (![15, 20, 30, 60, 120, 180, 240].includes(intervalMinutes)) throw new Error('--interval-minutes must be 15, 20, 30, 60, 120, 180 or 240');
    const branch = spawnSync('git', ['symbolic-ref', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
    if (branch !== 'main') throw new Error(`This checkout is on ${branch || 'no branch'}; the scheduler commits only on main. Use a dedicated clone on main.`);
    mkdirSync(join(root, '.backoffice'), { recursive: true });
    mkdirSync(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true });
    launchctl('bootout', `${domain}/${label}`); // replace an older install
    writeFileSync(plistPath, plist({ intervalMinutes }));
    const result = launchctl('bootstrap', domain, plistPath);
    if (result.status !== 0) throw new Error(`launchctl bootstrap failed: ${result.stderr.trim()}`);
    const at = intervalMinutes > 60 ? `every ${intervalMinutes / 60} h at :05` : `at ${minutesFor(intervalMinutes).map((m) => `:${String(m).padStart(2, '0')}`).join(', ')} past each hour`;
    console.log(`Installed ${label}: one tick ${at} in ${root}\nMissed slots while the Mac sleeps run once on wake.\nLog: ${log}`);
  } else if (command === 'uninstall') {
    launchctl('bootout', `${domain}/${label}`);
    rmSync(plistPath, { force: true });
    console.log(`Removed ${label}`);
  } else if (command === 'run-now') {
    const result = launchctl('kickstart', `${domain}/${label}`);
    if (result.status !== 0) throw new Error(`Not installed? ${result.stderr.trim()}`);
    console.log(`Started. Follow with: tail -f "${log}"`);
  } else if (command === 'logs') {
    console.log(existsSync(log) ? readFileSync(log, 'utf8').split('\n').slice(-60).join('\n') : 'No log yet');
  } else if (command === 'status') {
    const result = launchctl('print', `${domain}/${label}`);
    if (result.status !== 0) return console.log(`${label} is not installed`);
    const pick = (key) => result.stdout.match(new RegExp(`\\n\\s*${key} = (.+)`))?.[1];
    const lastTick = existsSync(log) ? [...readFileSync(log, 'utf8').matchAll(/^=== (\S+) tick ===$/gm)].at(-1)?.[1] : null;
    console.log(`${label}\n  state: ${pick('state')} (between ticks it is "not running"; that is normal)\n  runs since loaded: ${pick('runs') ?? 0}\n  last exit: ${pick('last exit code') ?? 'n/a'}\n  last tick: ${lastTick ?? 'none yet'}\n  log: ${log}`);
  } else {
    throw new Error(`Unknown command ${command}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
