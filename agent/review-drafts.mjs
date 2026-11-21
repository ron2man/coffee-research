import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { judgeEditorial } from './judge-editorial.mjs';
import { scanKnowledge } from './knowledge.mjs';

const directory = 'content/drafts';
const requested = process.argv.slice(2);

try {
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
    if (existsSync(reviewPath)) {
      console.log(`Skipped ${slug}: already reviewed`);
      continue;
    }
    try {
      const article = readFileSync(draft, 'utf8');
      const notes = readFileSync(brief, 'utf8');
      const references = [...notes.matchAll(/`([a-z0-9-]+)\/([a-z0-9-]+)`/g)];
      const productIds = new Set(references.map(([, product]) => product));
      const evidence = [...productIds].map((id) => cards.get(id)).filter(Boolean);
      const review = judgeEditorial(article, notes, evidence, skill);
      writeFileSync(reviewPath, JSON.stringify({ draft, brief, ...review }, null, 2) + '\n', { flag: 'wx' });
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
