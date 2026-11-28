// Astro bundles everything under src/, which would break the engine modules (they locate schemas
// and data relative to their own files). So the data layer and the HTML templates are imported
// at build time straight from site/lib, unbundled, through this helper.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

function findRepoRoot(start = process.cwd()) {
  for (let dir = start; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'site', 'lib', 'site-data.mjs')) && existsSync(join(dir, 'engine'))) return dir;
    if (dirname(dir) === dir) throw new Error(`Cannot find the repo root from ${start}; build from the repo (npm run site:build).`);
  }
}

const root = findRepoRoot();
const load = (file) => import(/* @vite-ignore */ pathToFileURL(join(root, 'site', 'lib', file)).href);

/** The share-image renderer (site/lib/og.mjs), loaded only by the pages that draw images. */
export const shareImages = () => load('og.mjs');

/** { data, t }: the build's site data (loaded once) and the template functions. */
export async function site() {
  const [{ siteData, SITE_URL }, t] = await Promise.all([load('site-data.mjs'), load('templates.mjs')]);
  return { data: siteData(), t, SITE_URL };
}
