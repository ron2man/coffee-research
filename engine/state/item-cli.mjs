#!/usr/bin/env node
// Human actions on work items. Status still changes only through machine.mjs.
//
//   npm run item -- list [--status <s>]
//   npm run item -- show <id>
//   npm run item -- resume <id> --reason "..."   blocked/needs_human → where it stopped
//   npm run item -- reject <id> --reason "..."   any active item → rejected
//   npm run item -- park   <id> --reason "..."   active item → needs_human
//   npm run item -- reopen <id> --reason "..."   rejected → idea (drops later artifacts)
//   add --commit to commit and push the item file to main (same rules as a tick)
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { userInfo } from 'node:os';
import { allowedTransitions, initialStatus, SIDE_STATES, transition } from './machine.mjs';
import { repoRoot } from './niche.mjs';
import { appendRun, loadItems, readJson, saveItem } from './store.mjs';
import { withLock } from '../scheduler/lock.mjs';
import { commitInternal, syncMain } from '../scheduler/git.mjs';

function target(command, item) {
  switch (command) {
    case 'resume':
      if (!SIDE_STATES.includes(item.status)) throw new Error(`${item.id} is ${item.status}; only blocked or needs_human items can be resumed`);
      return item.resumeStatus;
    case 'reject':
      return 'rejected';
    case 'park':
      return 'needs_human';
    case 'reopen':
      if (item.status !== 'rejected') throw new Error(`${item.id} is ${item.status}; only rejected items can be reopened`);
      return initialStatus(item.type);
    default:
      throw new Error(`Unknown command ${command}`);
  }
}

/** Apply a human action. Returns the saved item. */
export function act(root, command, id, { reason, by = 'human' } = {}) {
  if (!reason?.trim()) throw new Error('--reason is required');
  const { items, errors } = loadItems(root);
  if (errors.length) throw new Error(`Item store is invalid:\n${errors.join('\n')}`);
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`No item ${id}`);
  const to = target(command, item);
  if (!allowedTransitions(item).includes(to)) throw new Error(`${id}: ${item.status} → ${to} is not allowed`);
  const from = item.status;
  const next = saveItem(root, transition(item, to, { by: `human:${by}`, reason }));
  appendRun(root, { workflow: `human:${command}`, agent: null, itemId: id, status: 'completed', outcome: command, from, to, by });
  return next;
}

function show(root, id) {
  const item = readJson(join(root, 'data', 'items', `${id}.json`));
  return { ...item, next: allowedTransitions(item) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: { reason: { type: 'string' }, status: { type: 'string' }, commit: { type: 'boolean' }, root: { type: 'string' } },
    });
    const root = values.root ? resolve(values.root) : repoRoot;
    const [command, id] = positionals;
    if (command === 'list') {
      const { items, errors } = loadItems(root);
      for (const error of errors) console.error(error);
      for (const item of items.filter((i) => !values.status || i.status === values.status)) {
        console.log([item.id, item.status, item.blockedReason ?? ''].join('\t'));
      }
    } else if (command === 'show') {
      console.log(JSON.stringify(show(root, id), null, 2));
    } else {
      // Same lock as the scheduler, so a human action never races a tick.
      const item = await withLock(root, async () => {
        if (values.commit) syncMain(root);
        const saved = act(root, command, id, { reason: values.reason, by: process.env.USER ?? userInfo().username });
        if (values.commit) commitInternal(root, [`data/items/${id}.json`], `item(${command}): ${id} → ${saved.status}`);
        return saved;
      }, { label: `item ${command}` });
      console.log(`${item.id}: ${item.history.at(-2)?.to ?? ''} → ${item.status}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
