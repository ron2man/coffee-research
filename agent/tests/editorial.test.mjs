import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, symlinkSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, delimiter } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { claimEvidence, loadCards, matchesReview, reviewInputs } from '../review-inputs.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const slug = 'bambino-plus-cleaning-vs-descaling';

test('only supported, cited evidence can carry approval forward', async () => {
  const cards = await loadCards();
  const inputs = reviewInputs(slug, cards);
  const review = { draft: 'content/archive/drafts/' + slug + '.md', brief: 'content/archive/drafts/' + slug + '.brief.md',
    fingerprint: inputs.fingerprint };
  assert.ok(matchesReview(slug, review, inputs));
  const card = cards.get('bambino-plus');
  const claim = card.claims.find(item => item.id === 'us-cleaning-alert');
  claim.statement += ' Changed';
  assert.equal(matchesReview(slug, review, reviewInputs(slug, cards)), false);
  claim.status = 'unknown';
  assert.throws(() => reviewInputs(slug, cards), /unsupported/);
  assert.throws(() => claimEvidence('No dependencies', cards), /references/);
});

test('manual runner commits research, commissions a narrower draft and invalidates stale pages', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'editorial-integration-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const cwd = join(directory, 'work');
  mkdirSync(cwd);
  for (const name of ['agent', 'engine', 'niches', 'knowledge', 'site']) cpSync(join(root, name), join(cwd, name), {recursive:true});
  symlinkSync(join(root, 'node_modules'), join(cwd, 'node_modules'));
  mkdirSync(join(cwd, 'content/archive/drafts'), {recursive:true});
  writeFileSync(join(cwd, '.gitignore'), '.backoffice/\nnode_modules\n');
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  const fixture = join(bin, 'codex');
  writeFileSync(fixture, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const prompt = args.at(-1);
const mode = process.env.TEST_OUTCOME;
const slug = 'test-' + mode;
const brief = 'Claim: ' + String.fromCharCode(96) + 'bambino-plus/us-cleaning-alert' + String.fromCharCode(96);
if (args.includes('--output-schema')) {
  const schema = JSON.parse(fs.readFileSync(args[args.indexOf('--output-schema') + 1]));
  let result;
  if (schema.properties.outcome) result = {outcome: mode, question:'Original question', commissionedQuestion:'Which cycle?', answer:'Clean', evidence:brief, missingEvidence:'Comparable prices'};
  else if (schema.properties.solved) result = {question:'Which cycle?', quote:'Use the cleaning cycle.', action:'Clean', unresolved:'', solved:true};
  else result = {verdict:'pass', scores:Object.fromEntries(['topicSelection','evidence','readerValue','onPageSeo'].map(k=>[k,{score:4,reason:'Supported'}])), actions:[],optionalImprovements:[]};
  fs.writeFileSync(args[args.indexOf('-o')+1], JSON.stringify(result));
} else if (prompt.includes('Write the commissioned article')) {
  fs.writeFileSync('content/archive/drafts/' + slug + '.md', '# Which cycle?\\n\\nUse the cleaning cycle.\\n');
  fs.writeFileSync('content/archive/drafts/' + slug + '.brief.md', brief);
} else fs.writeFileSync('content/opportunities/' + slug + '.md', brief);
`, {mode:0o755});
  const env = { ...process.env, PATH: bin + delimiter + process.env.PATH, TEST_OUTCOME:'research' };
  const run = (command, args) => execFileSync(command, args, {cwd, env, encoding:'utf8', stdio:['ignore','pipe','pipe']});
  const git = (...args) => run('git', args);
  git('init','-q','-b','main');
  git('config','user.email','pilot@example.test');
  git('config','user.name','Test');
  git('init','--bare','-q',join(directory,'remote.git'));
  git('remote','add','origin',join(directory,'remote.git'));
  writeFileSync(join(cwd,'site/articles.json'), JSON.stringify([{draft:'test-narrow',slug:'test-narrow',category:'Machine',type:'Guide'}]));
  git('add','.');
  git('commit','-qm','Fixture');
  const node = (...args) => run(process.execPath, args);
  node('agent/run-editorial.mjs');
  assert.equal(git('ls-files','content/archive/drafts'), '');
  env.TEST_OUTCOME = 'narrow';
  node('agent/run-editorial.mjs');
  const plan = JSON.parse(node('agent/research-plan.mjs'));
  assert.equal(plan.articleResearch.length, 2);
  assert.ok(plan.products.some(product => product.id === 'ecm-classika-iii'));
  const copy = join(directory, 'aged-cards');
  cpSync(join(cwd,'knowledge'), copy, {recursive:true});
  const offQueue = join(copy,'machines/ecm-classika-iii.md');
  writeFileSync(offQueue, readFileSync(offQueue,'utf8').replace(/("verifiedAt":\s*")[^"]+/g, '$12000-01-01'));
  const aged = JSON.parse(node('agent/research-plan.mjs','--knowledge',copy));
  assert.ok(aged.batch.some(product => product.id === 'ecm-classika-iii' && product.status === 'refresh'));
  const routes = () => node('--input-type=module','-e',"import { renderSite } from './site/render.mjs';console.log([...(await renderSite()).keys()].join(' '))").trim();
  assert.match(routes(), /guides\/test-narrow/);
  const articlePath = join(cwd,'content/archive/drafts/test-narrow.md');
  writeFileSync(articlePath,readFileSync(articlePath,'utf8') + '\nEdited copy.\n');
  assert.equal(routes(), '/');
  node('agent/review-drafts.mjs','test-narrow');
  assert.match(routes(), /guides\/test-narrow/);
  assert.match(node('agent/review-drafts.mjs','test-narrow'), /Skipped current/);
});
