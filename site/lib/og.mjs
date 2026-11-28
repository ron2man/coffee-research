// Share images (og:image) per guide and market: the guide's title on the site's card, 1200×630 PNG.
// Rendered at build time by src/pages/og/[locale]/[slug].png.ts: satori lays out the text with the
// site font (static 400 and 800 instances in site/og/fonts, made from the variable woff2), and
// resvg turns its SVG into a PNG. The default image for other pages is site/og/default.html.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
const fonts = [
  { name: 'Schibsted Grotesk', data: readFileSync(here('../og/fonts/schibsted-grotesk-400.ttf')), weight: 400, style: 'normal' },
  { name: 'Schibsted Grotesk', data: readFileSync(here('../og/fonts/schibsted-grotesk-800.ttf')), weight: 800, style: 'normal' },
];
const icon = `data:image/svg+xml;base64,${readFileSync(here('../public/assets/icon.svg')).toString('base64')}`;

export const SHARE_SIZE = { width: 1200, height: 630 };

// Long titles get a smaller size so they fit in at most four lines.
const titleSize = (title) => (title.length <= 45 ? 76 : title.length <= 70 ? 64 : 54);

const el = (type, style, children) => ({ type, props: { style, children } });

/** PNG buffer for a guide's share image. kicker: e.g. "Guide"; brand: [first, middle, last] wordmark parts. */
export async function shareImagePng({ title, kicker = 'Guide', brand = ['Your', 'Coffee', 'Setup'] }) {
  const tree = el('div', { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#ffffff', color: '#111111', fontFamily: 'Schibsted Grotesk' }, [
    el('div', { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexGrow: 1, padding: '64px 80px 56px' }, [
      el('div', { display: 'flex', alignItems: 'center', fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em' }, [
        { type: 'img', props: { src: icon, width: 60, height: 60, style: { marginRight: 18 } } },
        el('span', { color: '#c4251d' }, brand[0]),
        el('span', {}, brand[1]),
        el('span', { fontWeight: 400 }, brand[2]),
      ]),
      el('div', { display: 'flex', flexDirection: 'column' }, [
        el('div', { fontSize: 28, fontWeight: 800, color: '#c4251d', marginBottom: 14 }, kicker),
        el('div', { fontSize: titleSize(title), fontWeight: 800, lineHeight: 1.04, letterSpacing: '-0.035em', maxWidth: 1040 }, title),
      ]),
    ]),
    el('div', { height: 28, background: '#d92b22' }, ''),
  ]);
  const svg = await satori(tree, { ...SHARE_SIZE, fonts });
  return new Resvg(svg, { fitTo: { mode: 'width', value: SHARE_SIZE.width } }).render().asPng();
}

export const sharePath = (market, slug) => `/og/${market.locale}/${slug}.png`;

// A guide drawing (public/assets/illustrations/<id>.svg, 240×180) centred on its paper tile.
export const ILLUSTRATION_PNG_SIZE = { width: 1200, height: 900 };
export function illustrationPng(id) {
  const drawing = readFileSync(here(`../public/assets/illustrations/${id}.svg`), 'utf8')
    .replace(/^<svg[^>]*>/, '<svg x="120" y="90" width="960" height="720" viewBox="0 0 240 180" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">');
  const { width, height } = ILLUSTRATION_PNG_SIZE;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#f5f2ec"/>${drawing}</svg>`;
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}
