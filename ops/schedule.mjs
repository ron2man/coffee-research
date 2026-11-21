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

export function plist({ intervalMinutes }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>${escape(join(root, 'ops', 'tick.sh'))}</string></array>
  <key>WorkingDirectory</key><string>${escape(root)}</string>
  <key>StartInterval</key><integer>${intervalMinutes * 60}</integer>
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
    if (!Number.isFinite(intervalMinutes) || intervalMinutes < 15) throw new Error('--interval-minutes must be at least 15');
    const branch = spawnSync('git', ['symbolic-ref', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
    if (branch !== 'main') throw new Error(`This checkout is on ${branch || 'no branch'}; the scheduler commits only on main. Use a dedicated clone on main.`);
    mkdirSync(join(root, '.backoffice'), { recursive: true });
    mkdirSync(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true });
    launchctl('bootout', `${domain}/${label}`); // replace an older install
    writeFileSync(plistPath, plist({ intervalMinutes }));
    const result = launchctl('bootstrap', domain, plistPath);
    if (result.status !== 0) throw new Error(`launchctl bootstrap failed: ${result.stderr.trim()}`);
    console.log(`Installed ${label}: one tick every ${intervalMinutes} min in ${root}\nLog: ${log}`);
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
    console.log(`${label}\n  state: ${pick('state')}\n  runs: ${pick('runs') ?? 0}\n  last exit: ${pick('last exit code') ?? 'n/a'}\n  log: ${log}`);
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
