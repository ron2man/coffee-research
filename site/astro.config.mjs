// Astro config for yourcoffeesetup.com. Build from the repo root: `npm run site:build`.
// Mode (preview or production) comes from lib/site-data.mjs: SITE_MODE, else the
// Cloudflare Pages branch (main = production, anything else = preview), else preview.
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE_URL, repoRoot, siteMode } from './lib/site-data.mjs';

const production = siteMode() === 'production';

/** Mock photos are for previews only: never ship them in a production build. */
const dropMockAssets = {
  name: 'drop-mock-assets',
  hooks: {
    'astro:build:done': ({ dir }) => {
      if (production) rmSync(new URL('assets/mock/', dir), { recursive: true, force: true });
    },
  },
};

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  build: { format: 'directory' },
  outDir: './dist',
  integrations: [
    sitemap({
      // The root page is a market chooser; the market homes and guides are what readers land on.
      filter: (page) => page !== `${SITE_URL}/`,
      i18n: { defaultLocale: 'en-us', locales: { 'en-us': 'en-US', 'en-gb': 'en-GB' } },
    }),
    dropMockAssets,
  ],
  vite: {
    // Pages read the niche, knowledge cards, content and offers from the rest of the repo.
    server: { fs: { allow: [fileURLToPath(new URL('.', `file://${repoRoot}/`))] } },
  },
});
