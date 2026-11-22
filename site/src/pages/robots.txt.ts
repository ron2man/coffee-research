// Production: crawl everything, point at the sitemap. Preview builds: crawl nothing.
import { site } from '../data/load.mjs';

export async function GET() {
  const { data, SITE_URL } = await site();
  const body = data.production
    ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap-index.xml\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
