import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { renderSite } from './render.mjs';

const port = Number(process.env.COFFEE_SITE_PORT ?? 4180);
const stylesheet = new URL('./style.css', import.meta.url);

const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex');
  response.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const path = request.url.split('?')[0];
  try {
    const css = path === '/style.css';
    const body = css ? await readFile(stylesheet, 'utf8') : (await renderSite()).get(path);
    if (body === undefined) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Page not found');
      return;
    }
    const type = css ? 'text/css' : 'text/html';
    response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    console.error(error.message);
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      .end('Could not render the preview. Check the server output.');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Coffee Fieldnotes: http://127.0.0.1:${server.address().port}/`));
