import { readFile, readdir } from 'node:fs/promises';

import { loadCards, matchesReview, reviewInputs } from '../agent/review-inputs.mjs';

const directory = new URL('../content/drafts/', import.meta.url);

async function optionalFile(filename) {
  try {
    return await readFile(new URL(filename, directory), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function readDrafts(runs, repositoryUrl, cards) {
  cards ??= await loadCards();
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const draftFiles = entries.filter((entry) => entry.isFile() && /^[a-z0-9-]+\.md$/.test(entry.name));
  const files = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  const drafts = await Promise.all(draftFiles.map(async ({ name }) => {
    const id = name.slice(0, -3);
    const path = `content/drafts/${name}`;
    const briefName = `${id}.brief.md`;
    const reviewName = `${id}.review.json`;
    const [article, brief, reviewText] = await Promise.all([
      optionalFile(name),
      files.has(briefName) ? optionalFile(briefName) : null,
      files.has(reviewName) ? optionalFile(reviewName) : null,
    ]);
    let review = null;
    let stale = false;
    let reviewError = null;
    if (reviewText) {
      try {
        review = JSON.parse(reviewText);
        if (review?.draft !== path || !['pass', 'revise', 'defer'].includes(review.verdict)) {
          throw new Error('Review does not match this draft or has an invalid verdict.');
        }
        try {
          stale = !matchesReview(id, review, reviewInputs(id, cards));
        } catch (error) {
          stale = true;
          reviewError = error.message;
        }
      } catch {
        reviewError = 'The saved review is unreadable or does not match this draft.';
        review = null;
      }
    }
    const run = runs.find((entry) => entry.status === 'completed' &&
      Array.isArray(entry.details?.changedFiles) && entry.details.changedFiles.includes(path));
    const commit = run?.details.commit;
    const commitUrl = repositoryUrl && /^[a-f0-9]{40}$/.test(commit ?? '') ?
      `${repositoryUrl}/commit/${commit}` : null;
    const query = brief?.match(/^[-*] Primary query\s*[:—]\s*(.+)$/im)?.[1] ??
      brief?.match(/Primary query\s+[“"]([^”"]+)[”"]/i)?.[1] ?? null;
    return {
      id, article, brief, review, reviewError, stale, commitUrl,
      title: article?.match(/^# (.+)$/m)?.[1] ?? id,
      audience: brief?.match(/^[-*] Audience\s*[:—]\s*(.+)$/im)?.[1] ?? null,
      query,
      completedAt: run?.timestamp ?? null,
    };
  }));
  return drafts.filter((draft) => draft.article !== null).sort((a, b) =>
    (b.completedAt ?? '').localeCompare(a.completedAt ?? '') || a.title.localeCompare(b.title));
}
