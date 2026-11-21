// Page templates and components (PriceBox, Picker, Callout). Plain functions returning HTML.
import { escape, inline, parseMarkdown } from './markdown.mjs';
import { formatPrice, offersFor } from './offers.mjs';

const region = new Intl.DisplayNames(['en'], { type: 'region' });
export const marketLabel = (market) => region.of(market.id === 'GB' ? 'GB' : market.id);
const shortLabel = (market) => (market.id === 'GB' ? 'UK' : market.id);
export const postPath = (market, slug) => `/${market.locale}/guides/${slug}/`;

const STATUS_BADGE = {
  draft: 'Draft · not published',
  reference: 'Quality reference · not published',
  archived: 'Archived pilot draft · not published',
};

export function layout({ site, market, title, description, body, path, preview, robots }) {
  const switcher = site.markets.map((m) => {
    const target = path.replace(`/${market.locale}/`, `/${m.locale}/`);
    const exists = site.pages.has(target);
    return `<a href="${exists ? target : `/${m.locale}/`}" hreflang="${m.language}-${m.id}" data-market="${m.locale}"${m.id === market.id ? ' aria-current="true"' : ''}>${shortLabel(m)}</a>`;
  }).join('');
  return `<!doctype html>
<html lang="${market.language}-${market.id}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
${robots ? `<meta name="robots" content="${robots}">` : ''}
<meta name="color-scheme" content="light dark">
<link rel="stylesheet" href="/assets/site.css">
<link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${preview ? '<div class="preview-bar">Preview build · mock prices · not public</div>' : ''}
<header class="top">
  <div class="wrap top-inner">
    <a class="brand" href="/${market.locale}/">${escape(site.name)}</a>
    <nav class="nav" aria-label="Main">
      <a href="/${market.locale}/#guides">Guides</a>
      <a href="/${market.locale}/how-we-work/">How we work</a>
      <span class="market" role="group" aria-label="Market">${switcher}</span>
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="wrap">
    <p class="disclosure">${escape(site.disclosure(market))}</p>
    <p>${escape(site.name)} · Straight answers, including when to buy nothing. · <a href="/${market.locale}/how-we-work/">How we work</a></p>
  </div>
</footer>
<script src="/assets/site.js" defer></script>
</body>
</html>
`;
}

export function priceBox({ site, market, productIds, offers, now }) {
  if (!productIds.length) return '';
  const rows = productIds.map((productId) => {
    const card = site.cards.get(productId)?.card;
    const name = card?.name ?? productId;
    const sold = !card || card.variants.some((v) => v.markets.includes(market.id));
    const list = offersFor(offers, productId, market.id, { now });
    let action;
    if (!sold) action = `<span class="pb-none">No ${escape(shortLabel(market))} model in our records yet</span>`;
    else if (!list.length) action = `<span class="pb-none">No ${escape(shortLabel(market))} listing tracked yet</span>`;
    else {
      const offer = list[0];
      const price = offer.showPrice
        ? `<span class="pb-price">${escape(formatPrice(offer.price, offer.currency, `${market.language}-${market.id}`))}</span><span class="pb-age">checked ${Math.max(1, Math.round(offer.ageHours))}h ago</span>`
        : '<span class="pb-price pb-stale">Check current price</span>';
      action = `${price}<a class="pb-button" href="${escape(offer.url)}" rel="sponsored nofollow noopener" target="_blank">View at ${escape(offer.sellerName ?? offer.seller)}</a>${offer.mock ? '<span class="pb-mock">mock</span>' : ''}`;
    }
    return `<li class="pb-row" id="buy-${escape(productId)}"><span class="pb-name">${escape(name)}</span><span class="pb-action">${action}</span></li>`;
  }).join('');
  return `<aside class="pricebox" aria-label="Where to buy">
<h2 class="pb-title">Where to buy <span>${escape(marketLabel(market))}</span></h2>
<ul>${rows}</ul>
<p class="pb-note">Prices older than 48 hours are hidden. The recommendation above doesn’t change with the price, and keeping what you have is always an option.</p>
</aside>`;
}

export function picker(tool) {
  if (!tool) return '';
  const fallback = Object.values(tool.results).map((r) => `<li><strong>${escape(r.title)}</strong>: ${escape(r.text)}</li>`).join('');
  return `<div class="picker" data-tool="${escape(tool.id)}">
<h3 class="picker-title">${escape(tool.title)}</h3>
<script type="application/json" class="picker-data">${JSON.stringify(tool).replace(/</g, '\\u003c')}</script>
<noscript><ul>${fallback}</ul></noscript>
</div>`;
}

/** Render a post body: lead paragraph, components, and a collapsed sources section. */
export function postBody({ post, site, market, offers, now }) {
  const { blocks, headings } = parseMarkdown(post.body);
  let html = '';
  let inSources = false;
  let priceBoxShown = false;
  let lead = true;
  for (const block of blocks) {
    if (block.type === 'heading' && /^how this guide was put together/i.test(block.text)) {
      inSources = true;
      html += `<details class="sources"><summary>${inline(block.text)}</summary>`;
      continue;
    }
    if (block.type === 'component') {
      if (block.name === 'tool') html += picker(site.tools.get(block.arg));
      if (block.name === 'pricebox') {
        html += priceBox({ site, market, productIds: block.arg ? [block.arg] : post.productIds, offers, now });
        priceBoxShown = true;
      }
      continue;
    }
    if (lead && block.html.startsWith('<p>')) {
      html += block.html.replace('<p>', '<p class="lead">');
      lead = false;
      continue;
    }
    html += block.html;
  }
  if (inSources) html += '</details>';
  if (!priceBoxShown && post.productIds.length) {
    const box = priceBox({ site, market, productIds: post.productIds, offers, now });
    html = inSources ? html.replace('<details class="sources">', `${box}<details class="sources">`) : html + box;
  }
  return { html, headings: headings.filter((h) => h.level === 2 && !/^how this guide/i.test(h.text)) };
}

export function postPage({ site, market, post, offers, now, preview }) {
  const { html, headings } = postBody({ post, site, market, offers, now });
  const postMarket = site.markets.find((m) => m.id === post.market) ?? market;
  const elsewhere = postMarket.id !== market.id
    ? `<p class="callout">Written for readers in the ${escape(marketLabel(postMarket))}. Product names and advice may differ where you are; prices and links below are for the ${escape(marketLabel(market))}.</p>` : '';
  const badge = STATUS_BADGE[post.status] ? `<span class="badge">${STATUS_BADGE[post.status]}</span>` : '';
  const updated = post.updatedAt ? ` · Updated ${escape(post.updatedAt)}` : '';
  const toc = headings.length > 2 ? `<nav class="toc" aria-label="On this page"><strong>On this page</strong><ol>${headings.map((h) => `<li><a href="#${h.id}">${inline(h.text)}</a></li>`).join('')}</ol></nav>` : '';
  const humanData = post.humanData?.length ? '' : '<p class="honesty">We haven’t tested these products ourselves. This guide is built from manuals, published tests and owner reports; see how it was put together at the end.</p>';
  return `<article class="post wrap-narrow">
<p class="meta">${badge}${escape(post.type)}${updated} · Prices for the ${escape(shortLabel(market))}</p>
<h1>${escape(post.title)}</h1>
${elsewhere}
${toc}
<div class="prose">${html}</div>
${humanData}
${post.disclosure ? `<p class="disclosure-inline">${escape(site.disclosure(market))}</p>` : ''}
</article>`;
}

export function homePage({ site, market, posts }) {
  const local = posts.filter((p) => p.markets.includes(market.id));
  const cards = local.map((post) => `<li class="card">
<a href="${postPath(market, post.slug)}">
<span class="card-kicker">${escape(post.type)}${STATUS_BADGE[post.status] ? ' · preview' : ''}${post.market !== market.id ? ` · written for ${escape(shortLabel(site.markets.find((m) => m.id === post.market) ?? market))}` : ''}</span>
<span class="card-title">${escape(post.title)}</span>
<span class="card-text">${escape(post.description)}</span>
</a></li>`).join('');
  return `<section class="hero"><div class="wrap">
<p class="hero-kicker">Home espresso, ${escape(marketLabel(market))}</p>
<h1>Straight answers for home espresso. <span>Including when to buy nothing.</span></h1>
<p class="hero-text">We read the manuals, the owner forums and the reviews so you don’t have to, then give you one clear recommendation, a test you can run on what you already own, and the cases where we’d choose differently.</p>
</div></section>
<section class="wrap" id="guides" aria-labelledby="guides-title">
<h2 id="guides-title" class="section-title">Guides</h2>
${cards ? `<ul class="cards">${cards}</ul>` : '<p class="empty">No guides for this market yet.</p>'}
</section>
<section class="wrap principles" aria-label="How we work">
<div><h3>One opinion</h3><p>Every guide starts with what we’d do, then says when we’d choose differently.</p></div>
<div><h3>No fake testing</h3><p>We say what we read and what we didn’t test. Measurements only appear when a named person took them.</p></div>
<div><h3>Keep yours</h3><p>Each guide has a path for keeping the gear you already own, and a test to tell if you should.</p></div>
</section>`;
}

export function howWeWorkPage({ site, market }) {
  return `<article class="post wrap-narrow">
<h1>How we work</h1>
<div class="prose">
<p class="lead">${escape(site.name)} answers the questions home espresso owners actually ask, with one clear recommendation and an honest account of how we got there.</p>
<h2>Where topics come from</h2>
<p>We start from people: questions in owner forums and communities, gaps in the answers that rank today, and changes in the market. Not from a list of products to sell.</p>
<h2>What we check</h2>
<p>Every fact about a product traces back to a source we keep on file: manufacturer manuals and spec pages first, then published tests, then owner reports, each labelled for what it can prove. When sources disagree, we say so.</p>
<h2>What we don’t do</h2>
<p>We don’t claim to have tested products. When a guide includes a measurement or a photo of our own, it names who took it and when.</p>
<h2>Buying, or not</h2>
<p>Every guide includes a way to keep what you have. When we recommend buying, the recommendation doesn’t depend on which shop pays us.</p>
<p>${escape(site.disclosure(market))}</p>
</div>
</article>`;
}

export function rootPage({ site }) {
  const links = site.markets.map((m) => `<li><a href="/${m.locale}/" data-market="${m.locale}">${escape(marketLabel(m))}</a></li>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(site.name)}</title>
<link rel="stylesheet" href="/assets/site.css">
<script src="/assets/site.js"></script>
</head>
<body class="chooser">
<main class="wrap-narrow">
<h1>${escape(site.name)}</h1>
<p>Choose where you buy:</p>
<ul class="chooser-list">${links}</ul>
</main>
</body>
</html>
`;
}
