#!/usr/bin/env node
// Local preview server for site/dist. Rebuilds the preview on every page load. Loopback only.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { buildSite, repoRoot } from './build.mjs';

const port = Number(process.env.SITE_PORT ?? 4321);
const dist = join(repoRoot, 'site', 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

createServer((request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (path.endsWith('/')) {
      buildSite(); // pick up new drafts, cards and tools without restarting
      path += 'index.html';
    }
    const file = join(dist, path);
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
      response.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    response.end(readFileSync(file));
  } catch (error) {
    console.error(error);
    response.writeHead(500, { 'Content-Type': 'text/plain' }).end(`Build failed: ${error.message}`);
  }
}).listen(port, '127.0.0.1', () => {
  buildSite();
  console.log(`Preview: http://127.0.0.1:${port}/`);
});
