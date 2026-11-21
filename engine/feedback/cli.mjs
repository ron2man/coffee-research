#!/usr/bin/env node
// Human side of the feedback loop.
//
//   npm run feedback -- add <agent> "what was wrong or good" [--item <id>]
//   npm run feedback -- list [<agent>] [--all]
//   npm run prompt -- list [--all]
//   npm run prompt -- show <proposal-id>          summary + diff against the current files
//   npm run prompt -- apply <proposal-id>         writes the files, closes the feedback it addresses
//   npm run prompt -- reject <proposal-id> --reason "..."   [--close-feedback]
//   add --commit to commit and push the change to main (same rules as a tick)
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { userInfo } from 'node:os';
import { loadAgents, isPipelineAgent } from '../agents/registry.mjs';
import { repoRoot } from '../state/niche.mjs';
import { writeTextAtomic } from '../state/store.mjs';
import { withLock } from '../scheduler/lock.mjs';
import { commitInternal, syncMain } from '../scheduler/git.mjs';
import { addFeedback, listFeedback, listProposals, markAddressed, writeProposal } from './store.mjs';

const pipelineNames = () => loadAgents().filter(isPipelineAgent).map((agent) => agent.name);

export function addHumanNote(root, agent, note, { itemId, by = 'human' } = {}) {
  if (!pipelineNames().includes(agent)) throw new Error(`Unknown pipeline agent ${agent} (known: ${pipelineNames().join(', ')})`);
  if (!note?.trim()) throw new Error('Write the note as the last argument');
  return addFeedback(root, {
    agent, source: 'human', itemIds: itemId ? [itemId] : [],
    findings: [{ severity: 'major', problem: note.trim(), evidence: `human note by ${by}`, suggestion: note.trim() }],
  });
}

function findProposal(root, id) {
  const proposal = listProposals(root).find((p) => p.id === id);
  if (!proposal) throw new Error(`No proposal ${id}`);
  return proposal;
}

export function diffProposal(root, proposal) {
  return proposal.changes.map((change) => {
    const current = join(root, change.path);
    const result = spawnSync('diff', ['-u', existsSync(current) ? current : '/dev/null', '-'], { input: change.newText, encoding: 'utf8' });
    return `# ${change.path}: ${change.why}\n${result.stdout || '(no changes)'}`;
  }).join('\n');
}

/** Apply a proposal. Returns the paths written. */
export function applyProposal(root, id, { by = 'human' } = {}) {
  const proposal = findProposal(root, id);
  if (proposal.status !== 'open') throw new Error(`${id} is ${proposal.status}`);
  const written = [];
  for (const change of proposal.changes) {
    if (!/^(engine\/agents\/[a-z0-9-]+\/prompt\.md|niches\/[a-z0-9-]+\/agents\/[a-z0-9-]+\.md)$/.test(change.path)) {
      throw new Error(`Refusing to write ${change.path}: proposals may only change prompts and niche guidance`);
    }
    writeTextAtomic(join(root, change.path), change.newText.endsWith('\n') ? change.newText : `${change.newText}\n`);
    written.push(change.path);
  }
  const { path, ...rest } = proposal;
  written.push(writeProposal(root, { ...rest, status: 'applied', appliedAt: new Date().toISOString(), appliedBy: by }));
  const feedback = listFeedback(root, proposal.agent);
  const addressed = feedback.filter((entry) => proposal.addresses.includes(entry.id));
  const skipped = feedback.filter((entry) => proposal.notAddressed.some((n) => n.id === entry.id));
  written.push(...markAddressed(root, addressed, id), ...markAddressed(root, skipped, `${id}:not-addressed`));
  return written;
}

export function rejectProposal(root, id, { reason, closeFeedback = false, by = 'human' } = {}) {
  if (!reason?.trim()) throw new Error('--reason is required');
  const proposal = findProposal(root, id);
  if (proposal.status !== 'open') throw new Error(`${id} is ${proposal.status}`);
  const { path, ...rest } = proposal;
  const written = [writeProposal(root, { ...rest, status: 'rejected', rejectionReason: reason, rejectedBy: by, rejectedAt: new Date().toISOString() })];
  if (closeFeedback) {
    const open = listFeedback(root, proposal.agent).filter((entry) => !entry.addressedBy && [...proposal.addresses, ...proposal.notAddressed.map((n) => n.id)].includes(entry.id));
    written.push(...markAddressed(root, open, `${id}:rejected`));
  }
  return written;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const tool = process.env.FEEDBACK_TOOL ?? 'feedback';
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        item: { type: 'string' }, reason: { type: 'string' }, all: { type: 'boolean' },
        commit: { type: 'boolean' }, 'close-feedback': { type: 'boolean' }, root: { type: 'string' },
      },
    });
    const root = values.root ? resolve(values.root) : repoRoot;
    const by = process.env.USER ?? userInfo().username;
    const [command, target, ...rest] = positionals;
    const mutate = async (label, fn) => withLock(root, async () => {
      if (values.commit) syncMain(root);
      const written = fn();
      if (values.commit) commitInternal(root, written, label);
      console.log(`Wrote:\n  ${written.join('\n  ')}`);
    }, { label });

    if (tool === 'feedback' && command === 'add') {
      await mutate(`feedback(${target}): human note`, () => [addHumanNote(root, target, rest.join(' '), { itemId: values.item, by })]);
    } else if (tool === 'feedback' && command === 'list') {
      for (const agent of target ? [target] : pipelineNames()) {
        for (const entry of listFeedback(root, agent).filter((e) => values.all || !e.addressedBy)) {
          console.log(`${agent}\t${entry.id}\t${entry.addressedBy ? `closed by ${entry.addressedBy}` : 'open'}`);
          for (const finding of entry.findings) console.log(`    [${finding.severity}] ${finding.problem}`);
        }
      }
    } else if (tool === 'prompt' && command === 'list') {
      for (const p of listProposals(root).filter((p) => values.all || p.status === 'open')) console.log(`${p.id}\t${p.status}\t${p.summary}`);
    } else if (tool === 'prompt' && command === 'show') {
      const proposal = findProposal(root, target);
      console.log(`${proposal.id} (${proposal.status})\n${proposal.summary}\n\nAddresses: ${proposal.addresses.join(', ') || 'none'}`);
      for (const n of proposal.notAddressed) console.log(`Not addressed: ${n.id}: ${n.why}`);
      console.log(`\n${diffProposal(root, proposal)}`);
    } else if (tool === 'prompt' && command === 'apply') {
      await mutate(`prompt(${target}): apply`, () => applyProposal(root, target, { by }));
      console.log('Run `npm test` to check the prompt still passes the engine checks.');
    } else if (tool === 'prompt' && command === 'reject') {
      await mutate(`prompt(${target}): reject`, () => rejectProposal(root, target, { reason: values.reason, closeFeedback: values['close-feedback'], by }));
    } else {
      throw new Error(`Usage: see the header of engine/feedback/cli.mjs (${tool} ${command ?? ''})`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
