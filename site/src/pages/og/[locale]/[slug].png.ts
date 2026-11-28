// One share image per guide and market (titles differ by market: product names are filled in).
import { site, shareImages } from '../../../data/load.mjs';

export async function getStaticPaths() {
  const { data } = await site();
  return data.markets.flatMap((market) => data.posts.filter((p) => p.markets.includes(market.id))
    .map((post) => ({ params: { locale: market.locale, slug: post.slug }, props: { market, post } })));
}

export async function GET({ props }) {
  const { market, post } = props;
  const [{ data, t }, og] = await Promise.all([site(), shareImages()]);
  const local = t.localize(post, data.site, market);
  const png = await og.shareImagePng({ title: local.title, kicker: post.type ? post.type.replace(/^./, (c) => c.toUpperCase()) : 'Guide' });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
}
