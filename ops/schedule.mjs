#!/usr/bin/env node
// Run ops/tick.sh on a schedule in this checkout (the scheduler's own clone, on main).
// macOS: a launchd agent. Linux: a systemd user timer (Persistent, so a slot missed while the
// machine was off runs when it's back; with lingering, it runs without anyone logged in).
//
//   npm run schedule -- doctor                       check this machine has everything a tick needs
//   npm run schedule -- claim                        make this checkout the scheduler (commits, pushes)
//   npm run schedule -- install [--interval-minutes 60]
//   npm run schedule -- status
//   npm run schedule -- run-now                      start one tick through the scheduler, then check the log
//   npm run schedule -- logs                         last 60 lines of .backoffice/tick.log
//   npm run schedule -- uninstall
//
// Elsewhere (no launchd or systemd), run ops/tick.sh from cron (see docs/operations.md).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { homedir, platform, userInfo } from 'node:os';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const name = `research-engine-${basename(root).toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
const label = `local.${name.replace('research-engine-', 'research-engine.')}`;
const plistPath = join(homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
const unitDir = join(homedir(), '.config', 'systemd', 'user');
const domain = () => `gui/${userInfo().uid}`;
const log = join(root, '.backoffice', 'tick.log');
const INTERVALS = [15, 20, 30, 60, 120, 180, 240];

const run = (cmd, args, options = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...options });
const has = (cmd) => run('/bin/sh', ['-c', `command -v ${cmd}`]).status === 0;
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

/** systemd OnCalendar for the same slots: minutes past each hour, or every N hours at :05. */
export function onCalendar(intervalMinutes) {
  if (intervalMinutes > 60) return `*-*-* 00/${Math.round(intervalMinutes / 60)}:05:00`;
  return `*-*-* *:${minutesFor(intervalMinutes).map((m) => String(m).padStart(2, '0')).join(',')}:00`;
}

/** The systemd user service and timer. oneshot: systemd never starts a second tick while one runs. */
export function systemdUnits({ intervalMinutes, dir = root }) {
  const service = `[Unit]
Description=Research engine tick (${dir})
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=${dir}
ExecStart=/bin/bash ${join(dir, 'ops', 'tick.sh')}
TimeoutStartSec=3h
Nice=10
`;
  const timer = `[Unit]
Description=Research engine tick schedule (${dir})

[Timer]
OnCalendar=${onCalendar(intervalMinutes)}
Persistent=true
Unit=${name}.service

[Install]
WantedBy=timers.target
`;
  return { service, timer };
}

const lastTick = () => (existsSync(log) ? [...readFileSync(log, 'utf8').matchAll(/^=== (\S+) tick ===$/gm)].at(-1)?.[1] : null);

const launchd = {
  install(intervalMinutes) {
    mkdirSync(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true });
    run('launchctl', ['bootout', `${domain()}/${label}`]); // replace an older install
    writeFileSync(plistPath, plist({ intervalMinutes }));
    const result = run('launchctl', ['bootstrap', domain(), plistPath]);
    if (result.status !== 0) throw new Error(`launchctl bootstrap failed: ${result.stderr.trim()}`);
    return `${label}. Missed slots while the Mac sleeps run once on wake.`;
  },
  uninstall() {
    run('launchctl', ['bootout', `${domain()}/${label}`]);
    rmSync(plistPath, { force: true });
    return label;
  },
  runNow() {
    const result = run('launchctl', ['kickstart', `${domain()}/${label}`]);
    if (result.status !== 0) throw new Error(`Not installed? ${result.stderr.trim()}`);
  },
  status() {
    const result = run('launchctl', ['print', `${domain()}/${label}`]);
    if (result.status !== 0) return `${label} is not installed`;
    const pick = (key) => result.stdout.match(new RegExp(`\\n\\s*${key} = (.+)`))?.[1];
    return `${label}\n  state: ${pick('state')} (between ticks it is "not running"; that is normal)\n  runs since loaded: ${pick('runs') ?? 0}\n  last exit: ${pick('last exit code') ?? 'n/a'}`;
  },
};

const systemd = {
  install(intervalMinutes) {
    mkdirSync(unitDir, { recursive: true });
    const { service, timer } = systemdUnits({ intervalMinutes });
    writeFileSync(join(unitDir, `${name}.service`), service);
    writeFileSync(join(unitDir, `${name}.timer`), timer);
    run('systemctl', ['--user', 'daemon-reload']);
    const result = run('systemctl', ['--user', 'enable', '--now', `${name}.timer`]);
    if (result.status !== 0) throw new Error(`systemctl --user enable failed: ${result.stderr.trim()}`);
    const linger = run('loginctl', ['show-user', userInfo().username, '--property=Linger']).stdout.trim();
    const note = linger === 'Linger=yes' ? 'Lingering is on: it runs without anyone logged in.'
      : `Lingering is off, so it stops when you log out. Turn it on once: sudo loginctl enable-linger ${userInfo().username}`;
    return `${name}.timer. A slot missed while the machine was off runs when it's back. ${note}`;
  },
  uninstall() {
    run('systemctl', ['--user', 'disable', '--now', `${name}.timer`]);
    rmSync(join(unitDir, `${name}.service`), { force: true });
    rmSync(join(unitDir, `${name}.timer`), { force: true });
    run('systemctl', ['--user', 'daemon-reload']);
    return `${name}.timer`;
  },
  runNow() {
    const result = run('systemctl', ['--user', 'start', '--no-block', `${name}.service`]);
    if (result.status !== 0) throw new Error(`Not installed? ${result.stderr.trim()}`);
  },
  status() {
    const timer = run('systemctl', ['--user', 'list-timers', '--all', `${name}.timer`, '--no-pager']).stdout.trim();
    if (!timer.includes(name)) return `${name}.timer is not installed`;
    const show = run('systemctl', ['--user', 'show', `${name}.service`, '--property=ActiveState,Result,ExecMainStatus']).stdout.trim().replace(/\n/g, ', ');
    return `${timer}\n  service: ${show}`;
  },
};

function backend() {
  if (platform() === 'darwin') return launchd;
  if (platform() === 'linux' && has('systemctl') && run('systemctl', ['--user', 'show-environment']).status === 0) return systemd;
  throw new Error(`No launchd or systemd user session here. Run ops/tick.sh from cron instead, e.g.:\n5 * * * * /bin/bash ${join(root, 'ops', 'tick.sh')}`);
}

/** Checks for a scheduler machine. Each: { name, ok, detail, fix }. */
export function doctor({ exec = run, env = process.env, home = homedir() } = {}) {
  const out = (cmd, args, options) => exec(cmd, args, { cwd: root, ...options });
  const checks = [];
  const add = (name, ok, detail, fix = '') => checks.push({ name, ok, detail, fix });
  const major = Number(process.versions.node.split('.')[0]);
  add('Node 22 or newer', major >= 22, process.versions.node, 'Install Node 22 LTS or newer (nodejs.org or nvm).');
  const branch = out('git', ['symbolic-ref', '--short', 'HEAD']).stdout?.trim();
  add('Checkout on main', branch === 'main', branch || 'no branch', 'Use a dedicated clone on main for the scheduler.');
  const dirty = out('git', ['status', '--porcelain', '--untracked-files=no']).stdout?.trim();
  add('No local edits', !dirty, dirty ? `${dirty.split('\n').length} changed files` : 'clean', 'The scheduler clone is never edited by hand: git checkout -- . (after saving anything you need)');
  add('Dependencies installed', existsSync(join(root, 'node_modules', 'ajv')), existsSync(join(root, 'node_modules')) ? 'node_modules present' : 'missing', 'npm install');
  const push = out('git', ['push', '--dry-run', '--quiet', 'origin', 'main'], { env: { ...env, GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' } });
  add('Git can push to main without a prompt', push.status === 0, push.status === 0 ? 'ok' : push.stderr.trim().split('\n').at(-1), 'Add an SSH key with push access to the repository (ssh-keygen, then add it on GitHub) and load it without a passphrase prompt.');
  const catalog = JSON.parse(readFileSync(join(root, 'niches', 'coffee', 'niche.json'), 'utf8')).catalog?.repo;
  if (catalog) {
    const ls = out('git', ['ls-remote', '--exit-code', catalog, 'HEAD'], { env: { ...env, GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' }, timeout: 30_000 });
    add('Catalog repository readable', ls.status === 0, ls.status === 0 ? 'ok' : (ls.stderr ?? '').trim().split('\n').at(-1), `The same SSH key needs read access to ${catalog}.`);
  }
  const claude = out('claude', ['auth', 'status'], { timeout: 30_000 });
  let method = null;
  try { method = JSON.parse(claude.stdout).authMethod; } catch { method = claude.status === 0 ? 'unknown' : null; }
  add('Claude CLI signed in with the subscription', ['claude.ai', 'oauth_token'].includes(method), method ? `authMethod ${method}` : 'not installed or not signed in', 'Install Claude Code, then: claude auth login (with the subscription account, not an API key).');
  const gh = out('gh', ['auth', 'status']);
  add('GitHub CLI signed in (opens publishing pull requests)', gh.status === 0, gh.status === 0 ? 'ok' : 'not signed in', 'Install gh, then: gh auth login');
  const bwsFile = join(home, '.config', 'yourcoffeesetup', 'bws');
  const envFile = join(home, '.config', 'yourcoffeesetup', 'env');
  if (existsSync(bwsFile)) {
    const vars = Object.fromEntries(readFileSync(bwsFile, 'utf8').split('\n').map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
    const list = has('bws') ? out('bws', ['secret', 'list', vars.BWS_PROJECT_ID ?? ''], { env: { ...env, BWS_ACCESS_TOKEN: vars.BWS_ACCESS_TOKEN ?? '' }, timeout: 30_000 }) : null;
    const keys = list?.status === 0 ? [...list.stdout.matchAll(/"key":\s*"([^"]+)"/g)].map((m) => m[1]) : [];
    add('Secrets from Bitwarden', keys.length > 0, list ? (list.status === 0 ? keys.join(', ') || 'project is empty' : (list.stderr ?? '').trim().split('\n').find((l) => /error|404|401/i.test(l)) ?? 'bws failed') : 'bws not installed',
      has('bws') ? 'Give this machine account read access to the project, and check the token and project id in ~/.config/yourcoffeesetup/bws.' : 'curl -fsSL https://bws.bitwarden.com/install | sh');
  } else {
    add('Secrets', existsSync(envFile), existsSync(envFile) ? 'env file only' : 'none', 'Set up ~/.config/yourcoffeesetup/bws (Bitwarden) or ~/.config/yourcoffeesetup/env: see docs/operations.md.');
  }
  return checks;
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { 'interval-minutes': { type: 'string' } } });
  const command = positionals[0] ?? 'status';
  if (command === 'logs') return console.log(existsSync(log) ? readFileSync(log, 'utf8').split('\n').slice(-60).join('\n') : 'No log yet');
  if (command === 'doctor') {
    const checks = doctor();
    for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FIX '} ${c.name}: ${c.detail}${c.ok ? '' : `\n      → ${c.fix}`}`);
    const failed = checks.filter((c) => !c.ok).length;
    console.log(failed ? `\n${failed} to fix before this machine can run ticks.` : '\nReady. Next: npm run schedule -- claim, then install.');
    process.exitCode = failed ? 1 : 0;
    return;
  }
  if (command === 'claim') {
    const { claimScheduler } = await import('./claim.mjs');
    return console.log(await claimScheduler(root));
  }
  const b = backend();
  if (command === 'install') {
    const intervalMinutes = Number(values['interval-minutes'] ?? 60);
    if (!INTERVALS.includes(intervalMinutes)) throw new Error(`--interval-minutes must be one of ${INTERVALS.join(', ')}`);
    const branch = run('git', ['symbolic-ref', '--short', 'HEAD'], { cwd: root }).stdout.trim();
    if (branch !== 'main') throw new Error(`This checkout is on ${branch || 'no branch'}; the scheduler commits only on main. Use a dedicated clone on main.`);
    mkdirSync(join(root, '.backoffice'), { recursive: true });
    const what = b.install(intervalMinutes);
    const at = intervalMinutes > 60 ? `every ${intervalMinutes / 60} h at :05` : `at ${minutesFor(intervalMinutes).map((m) => `:${String(m).padStart(2, '0')}`).join(', ')} past each hour`;
    console.log(`Installed ${what}\nOne tick ${at} in ${root}\nLog: ${log}`);
  } else if (command === 'uninstall') {
    console.log(`Removed ${b.uninstall()}`);
  } else if (command === 'run-now') {
    b.runNow();
    console.log(`Started. Follow with: tail -f "${log}"`);
  } else if (command === 'status') {
    console.log(`${b.status()}\n  last tick: ${lastTick() ?? 'none yet'}\n  log: ${log}`);
  } else {
    throw new Error(`Unknown command ${command}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
