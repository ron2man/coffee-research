import { existsSync, readdirSync, readFileSync } from 'node:fs';

export function openResearchTasks(directory = 'content/opportunities', drafts = 'content/archive/drafts') {
  const tasks = [];
  const files = existsSync(directory) ? readdirSync(directory).sort() : [];
  for (const name of files.filter(name => name.endsWith('.json'))) {
    const decision = JSON.parse(readFileSync(directory + '/' + name, 'utf8'));
    if (!['research', 'narrow'].includes(decision.outcome)) continue;
    const slug = name.slice(0, -5);
    const path = directory + '/' + slug + '.md';
    tasks.push({ slug, question: decision.question, missingEvidence: decision.missingEvidence,
      proposal: existsSync(path) ? path : drafts + '/' + slug + '.brief.md' });
  }
  const reviews = existsSync(drafts) ? readdirSync(drafts).sort() : [];
  for (const name of reviews.filter(name => name.endsWith('.review.json'))) {
    const review = JSON.parse(readFileSync(drafts + '/' + name, 'utf8'));
    if (review.verdict !== 'defer') continue;
    tasks.push({ slug: name.slice(0, -'.review.json'.length),
      question: review.reader?.question ?? 'Reopen deferred article',
      missingEvidence: review.actions.join(' '), proposal: review.brief });
  }
  return tasks;
}
