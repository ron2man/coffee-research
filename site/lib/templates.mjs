// Page bodies and components (PriceBox, Picker, pick card) as plain functions returning HTML.
// The Astro pages in src/ wrap these; the page shell (head, nav, footer) is src/layouts/Base.astro.
import { escape, inline, parseMarkdown } from './markdown.mjs';
import { formatPrice, offersFor } from './offers.mjs';
import { productName as engineProductName, resolveTokens as engineResolveTokens } from '../../engine/state/tokens.mjs';

const region = new Intl.DisplayNames(['en'], { type: 'region' });
export const marketLabel = (market) => region.of(market.id === 'GB' ? 'GB' : market.id);
export const shortLabel = (market) => (market.id === 'GB' ? 'UK' : market.id);
export const postPath = (market, slug) => `/${market.locale}/guides/${slug}/`;

// Posts are written once for every market. Products are named with tokens that resolve per market
// from the knowledge card's variants: {{product:id}} → that market's name, {{model:id}} → its SKU,
// {{brand:id}} → its brand. {{guide:slug|text}} links to another guide (plain text if it isn't built).
export function productName(site, market, productId) {
  return engineProductName(site.cards, market, productId);
}
export function resolveTokens(text, { site, market, links = true }) {
  return engineResolveTokens(text, {
    cards: site.cards,
    market,
    guideLink: (slug, label) => {
      const path = postPath(market, slug);
      return links && site.pages?.has(path) ? `[${label}](${path})` : label;
    },
  });
}
/** Title-tag text: the SEO title (or the title), with the site name only when it still fits 60 characters. */
export function pageTitle(post, siteName, max = 60) {
  const base = post.seoTitle || post.title;
  const full = `${base} | ${siteName}`;
  return full.length <= max ? full : base;
}

/** The post as readers in this market see it: names, models and guide links resolved. */
export function localize(post, site, market) {
  return {
    ...post,
    title: resolveTokens(post.title, { site, market, links: false }),
    seoTitle: post.seoTitle ? resolveTokens(post.seoTitle, { site, market, links: false }) : null,
    description: resolveTokens(post.description, { site, market, links: false }),
    body: resolveTokens(post.body, { site, market }),
  };
}

// Wordmark: a CamelCase name like "YourCoffeeSetup" becomes accent / bold / light parts.
const nameParts = (name) => name.match(/[A-Z][a-z]*|[^A-Z\s]+/g) ?? [name];
export function brandMark(name) {
  const parts = nameParts(name);
  if (parts.length < 3 || /\s/.test(name)) return escape(name);
  return `<span class="b1">${escape(parts[0])}</span>${escape(parts.slice(1, -1).join(''))}<span class="b3">${escape(parts.at(-1))}</span>`;
}
// Preview-only mock photos, credited. Production builds pass site.mock = null.
function mockPhoto(img, cls) {
  if (!img) return '';
  return `<figure class="${cls}"><img src="/assets/mock/${escape(img.file)}" alt="${escape(img.alt)}"><figcaption>Photo: ${escape(img.credit)}. Mock image for the preview.</figcaption></figure>`;
}
const pick = (list, key) => (list?.length ? list[[...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % list.length] : null);
const postPhoto = (site, slug) => (site.mock ? site.mock.posts.get(slug) ?? pick(site.mock.wide, slug) : null);
// Short nav labels: "Home espresso machines" → "Machines".
export const navLabel = (category) => category.nav ?? category.label.replace(/^home espresso /i, '').replace(/^./, (c) => c.toUpperCase());
const categoryLabel = (site, id) => site.allCategories?.find((c) => c.id === id)?.label ?? null;
function dateLabel(post, market) {
  if (!post.updatedAt) return post.status === 'published' ? '' : 'Draft';
  const d = new Date(`${post.updatedAt}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? escape(post.updatedAt) : new Intl.DateTimeFormat(`${market.language}-${market.id}`, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}
const byDate = (a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');

/** Compact guide rows: tag, title, one-line summary, date. */
export function guideRows({ site, market, posts }) {
  if (!posts.length) return '<p class="empty">No guides here yet.</p>';
  return `<ol class="guide-rows">${posts.map((source) => localize(source, site, market)).map((post) => `<li><a href="${postPath(market, post.slug)}">
<span class="gr-tag">${escape(navLabel({ label: categoryLabel(site, post.category) ?? post.type }))}${STATUS_BADGE[post.status] ? ' · preview' : ''}</span>
<span class="gr-main"><span class="gr-title">${escape(post.title)}</span><span class="gr-summary">${escape(post.description)}</span></span>
<span class="gr-date">${dateLabel(post, market)}</span>
</a></li>`).join('')}</ol>`;
}

export function guideListPage({ site, market, posts, category }) {
  const list = posts.filter((p) => p.markets.includes(market.id) && (!category || p.category === category.id)).sort(byDate);
  return `<section class="wrap list-page">
<h1 class="list-title">${escape(category ? navLabel(category) : 'All guides')}</h1>
<p class="meta">${list.length} ${list.length === 1 ? 'guide' : 'guides'}, newest first</p>
${guideRows({ site, market, posts: list })}
</section>`;
}

export const spokenName = (name) => (/\s/.test(name) ? name : nameParts(name).join(' '));

const STATUS_BADGE = {
  draft: 'Draft · not published',
  reference: 'Quality reference · not published',
  archived: 'Archived pilot draft · not published',
};

// One source for product offers, used by both the PriceBox and the sidebar pick card, so the two
// can never show different products or prices.
function productOffers({ site, market, productId, offers, now }) {
  const card = site.cards.get(productId)?.card;
  return {
    name: productName(site, market, productId),
    sold: !card || card.variants.some((v) => v.markets.includes(market.id)),
    list: offersFor(offers, productId, market.id, { now }).slice(0, 3),
  };
}
// Read by site.js for the affiliate_click event (rebuild-spec 9).
const trackAttrs = (productId, offer, market, position) => `data-product="${escape(productId)}" data-seller="${escape(offer.seller)}" data-market="${escape(market.id)}" data-position="${position}"`;
const priceText = (offer, market) => formatPrice(offer.price, offer.currency, `${market.language}-${market.id}`);
const checkedText = (offer) => `checked ${Math.max(1, Math.round(offer.ageHours))}h ago`;
const noOffersText = (market, sold) => (sold ? `No ${shortLabel(market)} listing tracked yet` : `No ${shortLabel(market)} model in our records yet`);

export function priceBox({ site, market, productIds, offers, now }) {
  if (!productIds.length) return '';
  const rows = productIds.map((productId) => {
    const { name, sold, list } = productOffers({ site, market, productId, offers, now });
    let action;
    if (!sold || !list.length) action = `<span class="pb-none">${escape(noOffersText(market, sold))}</span>`;
    else {
      action = list.map((offer) => {
        const price = offer.showPrice
          ? `<span class="pb-price">${escape(priceText(offer, market))}</span><span class="pb-age">${checkedText(offer)}</span>`
          : '<span class="pb-price pb-stale">Check current price</span>';
        return `<span class="pb-offer"><a class="pb-button" href="${escape(offer.url)}" rel="sponsored nofollow noopener" target="_blank" ${trackAttrs(productId, offer, market, 'pricebox')}>${escape(offer.sellerName ?? offer.seller)}</a>${price}${offer.mock ? '<span class="pb-mock">mock</span>' : ''}</span>`;
      }).join('');
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
        html += priceBox({ site, market, productIds: block.arg ? [block.arg] : post.offerIds ?? [], offers, now });
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
  // Offers are what the guide recommends buying, never the product the reader already owns.
  if (!priceBoxShown && post.offerIds?.length) {
    const box = priceBox({ site, market, productIds: post.offerIds, offers, now });
    html = inSources ? html.replace('<details class="sources">', `${box}<details class="sources">`) : html + box;
  }
  return { html, headings: headings.filter((h) => h.level === 2 && !/^how this guide/i.test(h.text)) };
}

/** Sidebar card for the guide's pick (first product id). Same data and price as the PriceBox row. */
export function pickCard({ site, market, productId, offers, now, keep }) {
  if (!productId) return '';
  const { name, sold, list } = productOffers({ site, market, productId, offers, now });
  const offer = sold ? list[0] : null;
  const price = !offer ? `<p class="pick-none">${escape(noOffersText(market, sold))}</p>`
    : offer.showPrice ? `<p class="pick-price-line"><span class="pick-price">${escape(priceText(offer, market))}</span> <span class="pick-age">${checkedText(offer)}</span></p>`
    : '<p class="pick-price-line"><span class="pick-price pick-stale">Check current price</span></p>';
  const button = offer ? `<a class="pick-button" href="${escape(offer.url)}" rel="sponsored nofollow noopener" target="_blank" ${trackAttrs(productId, offer, market, 'pick')}>View at ${escape(offer.sellerName ?? offer.seller)}</a>${offer.mock ? ' <span class="pb-mock">mock</span>' : ''}` : '';
  const more = list.length > 1 ? `Compare ${list.length} sellers` : 'Where to buy';
  return `<section class="pick" aria-label="Our pick">
<p class="pick-label">Our pick</p>
<p class="pick-name">${escape(name)}</p>
${price}
${offer ? '<p class="pick-note">Affiliate link: we may earn a commission. It never changes the pick.</p>' : ''}
${button}
<a class="pick-compare" href="#buy-${escape(productId)}">${more}</a>
${keep ? `<p class="pick-keep">Keep yours? <a href="#${keep.id}">${inline(keep.text)}</a></p>` : ''}
</section>`;
}

export function postPage({ site, market, post: source, offers, now, preview }) {
  const post = localize(source, site, market);
  const { html, headings } = postBody({ post, site, market, offers, now });
  const elsewhere = ''; // one post for every market: no "written for another market" notice
  const badge = STATUS_BADGE[post.status] ? `<span class="badge">${STATUS_BADGE[post.status]}</span>` : '';
  const updated = post.updatedAt ? `Updated ${escape(post.updatedAt)} · ` : '';
  const pickId = post.pick ?? post.offerIds?.[0] ?? null;
  const toc = headings.length ? `<nav class="toc" aria-label="On this page"><strong>On this page</strong><ol>${headings.map((h) => `<li><a href="#${h.id}">${inline(h.text)}</a></li>`).join('')}</ol></nav>` : '';
  const honesty = post.humanData?.length ? '' : 'We haven’t tested these products ourselves. This guide is built from manuals, published tests and owner reports; how it was put together is at the end.';
  const disclosureText = post.disclosure && post.offerIds?.length ? site.disclosure(market) : null;
  const notes = [disclosureText ? escape(disclosureText) : '', honesty].filter(Boolean);
  const topNotes = notes.length ? `<div class="post-notes">${notes.map((n) => `<p>${n}</p>`).join('')}</div>` : '';
  // The guide's keep-what-you-have section, linked from the pick card.
  const keep = headings.find((h) => /already (own|have)|keep (yours|what you have)|try this first/i.test(h.text));
  const pick = pickCard({ site, market, productId: pickId, offers, now, keep });
  // Notes go right after the opening answer: still before the first affiliate link in the text column
  // (the PriceBox), and the sidebar card carries its own disclosure above its button.
  let placed = false;
  const withNotes = html.replace(/<p class="lead">[\s\S]*?<\/p>/, (lead) => { placed = true; return lead + topNotes; });
  const notesFirst = placed ? '' : topNotes;
  return `<article class="post">
<header class="wrap post-head">
<div class="post-head-main">
<p class="kicker">${badge}${escape(post.type)}</p>
<h1>${escape(post.title)}</h1>
</div>
<div class="post-head-side">
<p class="post-summary">${escape(post.description)}</p>
<p class="meta">${updated}Prices for the ${escape(shortLabel(market))}</p>
${pickId ? `<a class="jump-pick" href="#buy-${escape(pickId)}">Jump to the pick</a>` : ''}
</div>
</header>
${mockPhoto(postPhoto(site, post.slug), 'wrap post-photo')}
<div class="wrap post-layout">
<div class="post-main">
${notesFirst}
${elsewhere}
<div class="prose">${withNotes}</div>
</div>
${pick || toc ? `<aside class="post-rail" aria-label="Guide tools"><div class="rail-sticky">${pick}${toc}</div></aside>` : ''}
</div>
</article>`;
}

export function homePage({ site, market, posts }) {
  // Superseded drafts stay reachable by URL in previews but are left off the home lists.
  const local = posts.filter((p) => p.markets.includes(market.id) && !p.supersededBy);
  const kicker = (post) => `${escape(post.type)}${STATUS_BADGE[post.status] ? ' · preview' : ''}`;
  const [lead, ...rest] = local;
  const feature = lead ? `<div class="feature">
<div class="feature-main">
<p class="kicker">${kicker(lead)}</p>
<h2 class="feature-title"><a href="${postPath(market, lead.slug)}">${escape(lead.title)}</a></h2>
</div>
<div class="feature-side">
<p class="feature-answer">${escape(lead.description)}</p>
<a class="feature-link" href="${postPath(market, lead.slug)}">Read the answer</a>
</div>
</div>
${mockPhoto(site.mock?.home ?? postPhoto(site, lead.slug), 'feature-photo')}` : '<p class="empty">No guides for this market yet.</p>';
  const latest = rest.sort(byDate).slice(0, 8);
  const tiles = site.categories.map((c) => `<a class="tile" href="/${market.locale}/${c.id}/"><span class="tile-title">${escape(navLabel(c))}</span><span class="tile-count">${c.count} guides</span></a>`).join('');
  return `<section class="wrap" id="guides" aria-labelledby="guides-title">
<h1 class="intro" id="guides-title">Straight answers for home espresso in the ${escape(shortLabel(market))}. Including when to buy nothing.</h1>
${feature}
${latest.length ? `<div class="section-head"><h2 class="section-title">Latest guides</h2><a href="/${market.locale}/guides/">All guides</a></div>
${guideRows({ site, market, posts: latest })}` : ''}
</section>
${tiles ? `<section class="wrap categories" aria-labelledby="cat-title">
<div class="section-head"><h2 class="section-title" id="cat-title">Browse by category</h2></div>
<div class="tiles">${tiles}</div>
</section>` : ''}
<section class="wrap band" aria-label="Keep what you have">
<div class="band-inner">
<h2>Keep yours first.</h2>
<div class="band-text">
<p>Every guide has a test you can run on the gear you already own. If it passes, you keep your money.</p>
<a class="band-link" href="/${market.locale}/how-we-work/">How we work</a>
</div>
</div>
</section>
<div class="band-gap"></div>`;
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
<h2 id="disclosure">Disclosure</h2>
<p>${escape(site.disclosure(market) ?? 'We don’t use affiliate links yet. When we do, this section will name the programmes and how they pay us, and every page with a link will say so before it.')}</p>
</div>
</article>`;
}
