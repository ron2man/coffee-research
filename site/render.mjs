import { escape, layout, parseArticle } from './article.mjs';
import { loadCards, matchesReview, reviewInputs } from '../agent/review-inputs.mjs';

import { readFile } from 'node:fs/promises';

const manifest = new URL('./articles.json', import.meta.url);
const drafts = new URL('../content/archive/drafts/', import.meta.url);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function home(articles) {
  return layout({
    title: 'YourCoffeeSetup | Home espresso guides',
    description: 'Practical guides and comparisons for choosing and using home coffee equipment.',
    content: `
    <section class="hero"><div class="frame">
      <h1>Make better decisions about coffee gear.</h1>
      <p>Practical comparisons for buying, using, and getting more out of your home espresso setup.</p>
    </div></section>
    <section class="frame guide-list" id="guides" aria-labelledby="guides-title">
      <h2 id="guides-title">Equipment guides</h2>
      ${articles.map((article) => `
      <article class="guide">
        <p class="category">${escape(article.category)} · ${escape(article.type)}</p>
        <h3><a href="/guides/${article.slug}/">${escape(article.heading)}</a></h3>
        <p>${escape(article.description)}</p>
      </article>`).join('')}
    </section>`,
  });
}

export async function renderSite() {
  const entries = JSON.parse(await readFile(manifest, 'utf8'));
  if (!Array.isArray(entries) || !entries.length) throw new Error('Expected a nonempty article manifest');
  const cards = await loadCards();
  const slugs = new Set();
  const articles = await Promise.all(entries.map(async (entry) => {
    if (!slugPattern.test(entry.slug ?? '') || !slugPattern.test(entry.draft ?? '') || slugs.has(entry.slug)) {
      throw new Error(`Invalid or duplicate article slug: ${entry.slug}`);
    }
    slugs.add(entry.slug);
    let review;
    try {
      review = JSON.parse(await readFile(new URL(`${entry.draft}.review.json`, drafts), 'utf8'));
      if (review.verdict !== 'pass') return null;
      const inputs = reviewInputs(entry.draft, cards);
      if (!matchesReview(entry.draft, review, inputs)) return null;
      return { ...entry, ...parseArticle(inputs.draft), page: inputs.page };
    } catch (error) {
      console.error(`Skipping ${entry.draft}: ${error.message}`);
      return null;
    }
  }));
  const approved = articles.filter(Boolean);
  return new Map([
    ['/', home(approved)],
    ...approved.map(article => [`/guides/${article.slug}/`, article.page]),
  ]);
}
