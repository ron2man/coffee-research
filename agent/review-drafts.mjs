import { existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { judgeEditorial } from './judge-editorial.mjs';
import { loadCards, matchesReview, reviewInputs } from './review-inputs.mjs';

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
  const cards = await loadCards();

  for (const slug of slugs) {
    const draft = `${directory}/${slug}.md`;
    const brief = `${directory}/${slug}.brief.md`;
    const reviewPath = `${directory}/${slug}.review.json`;
    const alreadyReviewed = existsSync(reviewPath);
    try {
      const previousText = alreadyReviewed ? readFileSync(reviewPath, 'utf8') : null;
      const previous = previousText === null ? null : JSON.parse(previousText);
      if (previous && (previous.draft !== draft || previous.brief !== brief)) {
        throw new Error('Saved review does not match the draft and brief');
      }
      const inputs = reviewInputs(slug, cards);
      if (!values.rejudge && matchesReview(slug, previous, inputs)) {
        console.log('Skipped current review: ' + slug);
        continue;
      }
      const review = judgeEditorial(inputs);
      if (reviewInputs(slug, await loadCards()).fingerprint !== inputs.fingerprint) {
        throw new Error('Review inputs changed during judging');
      }
      const saved = { draft, brief, ...review };
      if (previous) {
        const { draft: oldDraft, brief: oldBrief, history = [], ...prior } = previous;
        saved.history = [...history, prior];
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
