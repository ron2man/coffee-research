import { existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { judgeEditorial } from './judge-editorial.mjs';
import { scanKnowledge } from './knowledge.mjs';

const directory = 'content/drafts';
try {
  const { values, positionals: requested } = parseArgs({
    options: { rejudge: { type: 'boolean' } },
    allowPositionals: true,
  });
  if (requested.some((slug) => !/^[a-z0-9-]+$/.test(slug))) {
    throw new Error('Provide draft slugs without .md or directory components');
  }
  const slugs = requested.length ? [...new Set(requested)] : readdirSync(directory)
    .filter((name) => /^[a-z0-9-]+\.md$/.test(name))
    .map((name) => name.slice(0, -3));
  const { cards, errors } = await scanKnowledge('knowledge');
  if (errors.length) throw new Error(errors.join('\n'));
  const skill = readFileSync('agent/skills/coffee-seo/SKILL.md', 'utf8');

  for (const slug of slugs) {
    const draft = `${directory}/${slug}.md`;
    const brief = `${directory}/${slug}.brief.md`;
    const reviewPath = `${directory}/${slug}.review.json`;
    const alreadyReviewed = existsSync(reviewPath);
    if (alreadyReviewed && !values.rejudge) {
      console.log(`Skipped ${slug}: already reviewed`);
      continue;
    }
    try {
      const previousText = alreadyReviewed ? readFileSync(reviewPath, 'utf8') : null;
      const previous = previousText === null ? null : JSON.parse(previousText);
      if (previous && (previous.draft !== draft || previous.brief !== brief)) {
        throw new Error('Saved review does not match the draft and brief');
      }
      const article = readFileSync(draft, 'utf8');
      const notes = readFileSync(brief, 'utf8');
      const references = [...notes.matchAll(/`([a-z0-9-]+)\/([a-z0-9-]+)`/g)];
      const productIds = new Set(references.map(([, product]) => product));
      const evidence = [...productIds].map((id) => cards.get(id)).filter(Boolean);
      const review = judgeEditorial(article, notes, evidence, skill);
      if (readFileSync(draft, 'utf8') !== article || readFileSync(brief, 'utf8') !== notes) {
        throw new Error('Draft or brief changed during judging');
      }
      const saved = { draft, brief, ...review };
      if (previous) {
        const { verdict, scores, actions, optionalImprovements, history = [] } = previous;
        saved.history = [...history, { verdict, scores, actions, optionalImprovements }];
        if (readFileSync(reviewPath, 'utf8') !== previousText) {
          throw new Error('Saved review changed during judging');
        }
        const temporary = `${reviewPath}.${process.pid}.tmp`;
        writeFileSync(temporary, JSON.stringify(saved, null, 2) + '\n', { flag: 'wx' });
        try {
          renameSync(temporary, reviewPath);
        } finally {
          rmSync(temporary, { force: true });
        }
      } else {
        writeFileSync(reviewPath, JSON.stringify(saved, null, 2) + '\n', { flag: 'wx' });
      }
      console.log(`${slug}: ${review.verdict} (${reviewPath})`);
    } catch (error) {
      console.error(`${slug}: ${error.message}`);
      process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
