// Backoffice dashboard: loopback only. Reads the live state from the scheduler's clone (found next
// to this checkout, or BACKOFFICE_ROOT) and runs actions through the engine (actions.mjs).
//   npm run dashboard            http://127.0.0.1:4173
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { articleDetail, findStateRoot, todayData } from './today.mjs';
import { ActionError, runAction, startTick } from './actions.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.BACKOFFICE_PORT ?? 4173);
const stateRoot = process.env.BACKOFFICE_ROOT ? resolve(process.env.BACKOFFICE_ROOT.replace(/^~(?=\/)/, homedir())) : findStateRoot(root);
// Actions need this token (fetched same-origin from /session), so other sites can't post to the dashboard.
const sessionToken = randomBytes(24).toString('hex');
const commitActions = process.env.BACKOFFICE_NO_COMMIT !== '1';

const assets = new Map([
  ['/', ['today.html', 'text/html; charset=utf-8']],
  ['/today.js', ['today.js', 'text/javascript; charset=utf-8']],
  ['/today.css', ['today.css', 'text/css; charset=utf-8']],
]);

function readBody(request, limit = 64 * 1024) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new ActionError('Request too large', 413)); request.destroy(); } else chunks.push(chunk);
    });
    request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

const json = (response, status, body) => response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));

const server = createServer(async (request, response) => {
  const host = request.headers.host;
  if (host !== `127.0.0.1:${server.address().port}` && host !== `localhost:${server.address().port}`) {
    response.writeHead(403).end();
    return;
  }
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  try {
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'POST' && url.pathname.startsWith('/action/')) {
      const origin = request.headers.origin;
      if ((origin && origin !== `http://${host}`) || request.headers['x-backoffice-token'] !== sessionToken || !String(request.headers['content-type']).startsWith('application/json')) {
        json(response, 403, { error: 'Reload the dashboard and try again.' });
        return;
      }
      try {
        const payload = JSON.parse((await readBody(request)) || '{}');
        const name = url.pathname.slice('/action/'.length);
        json(response, 200, name === 'tick' ? startTick(stateRoot) : await runAction(stateRoot, name, payload, { commit: commitActions }));
      } catch (error) {
        json(response, error instanceof ActionError ? error.status : 500, { error: error.message });
      }
    } else if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET, POST' }).end();
    } else if (url.pathname === '/session') {
      json(response, 200, { token: sessionToken, root: stateRoot, commits: commitActions });
    } else if (url.pathname === '/article') {
      const detail = articleDetail(stateRoot, url.searchParams.get('id') ?? '');
      json(response, detail ? 200 : 404, detail ?? { error: 'No such article' });
    } else if (url.pathname === '/today-data') {
      json(response, 200, await todayData(stateRoot));
    } else if (assets.has(url.pathname)) {
      const [file, type] = assets.get(url.pathname);
      response.writeHead(200, { 'Content-Type': type }).end(await readFile(new URL(file, import.meta.url), 'utf8'));
    } else {
      response.writeHead(404).end();
    }
  } catch (error) {
    console.error(error.message);
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Could not read the project data. Check the server output.');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Backoffice: http://127.0.0.1:${server.address().port}  (state from ${stateRoot})`);
});
