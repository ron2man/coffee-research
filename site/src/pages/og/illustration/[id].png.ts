// Each guide drawing as a 1200×900 PNG on its paper tile, for the Article structured data
// (search engines don't take SVG images). The share card stays the title card in og/[locale]/.
import { site, shareImages } from '../../../data/load.mjs';

export async function getStaticPaths() {
  const { data } = await site();
  const ids = [...new Set(data.posts.map((p) => p.illustration?.id).filter(Boolean))];
  return ids.map((id) => ({ params: { id } }));
}

export async function GET({ params }) {
  const og = await shareImages();
  return new Response(og.illustrationPng(params.id), { headers: { 'Content-Type': 'image/png' } });
}
