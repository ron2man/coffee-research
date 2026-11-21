import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { readDrafts } from './drafts.mjs';
import { scanKnowledge } from '../agent/knowledge.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const exec = promisify(execFile);
const port = Number(process.env.BACKOFFICE_PORT ?? 4173);
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
]);

function read(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

async function readRuns() {
  let log;
  try {
    log = await read('../.backoffice/runs.jsonl');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return log.trim().split('\n').filter(Boolean).slice(-100).reverse().map((line) => JSON.parse(line));
}

async function githubRepositoryUrl() {
  try {
    const { stdout } = await exec('git', ['remote', 'get-url', 'origin'], { cwd: root });
    const match = stdout.trim().match(/^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+)$/);
    return match ? `https://github.com/${match[1].replace(/\.git$/, '')}` : null;
  } catch {
    return null;
  }
}

async function dashboardData() {
  const [knowledge, queueText, lessons, spec, runs, repositoryUrl] = await Promise.all([
    scanKnowledge(fileURLToPath(new URL('../knowledge', import.meta.url))),
    read('../agent/research-queue.json'),
    read('../docs/learnings.md'),
    read('../docs/planning-spec.md'),
    readRuns(),
    githubRepositoryUrl(),
  ]);

  const queue = JSON.parse(queueText);
  let plan = null;
  const issues = [...knowledge.errors];
  if (!issues.length) {
    try {
      const { stdout } = await exec(process.execPath, ['agent/research-plan.mjs'], { cwd: root });
      plan = JSON.parse(stdout);
    } catch (error) {
      issues.push(error.stderr?.trim() || error.message);
    }
  }
  const nextById = new Map(plan?.batch.map((item) => [item.id, item.status]));
  const milestones = spec.split('\n').filter((line) => /^\| \d+\./.test(line)).map((line) => {
    const [, name, deliverable, verification] = line.split('|').map((part) => part.trim());
    return { name, deliverable, verification };
  });
  return {
    plan,
    queue: queue.products.map((item) => ({
      ...item,
      originLabel: queue.origins[item.origin],
      status: plan ? (nextById.get(item.id) ?? 'current') : 'unavailable',
    })),
    cards: [...knowledge.cards.values()],
    issues,
    milestones,
    lessons,
    runs,
    drafts: await readDrafts(runs, repositoryUrl),
  };
}

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
    if (request.method !== 'GET') {
      response.writeHead(405, { Allow: 'GET' }).end();
    } else if (request.url === '/data') {
      const data = await dashboardData();
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(data));
    } else if (assets.has(request.url)) {
      const [file, type] = assets.get(request.url);
      const contents = await read(file);
      response.writeHead(200, { 'Content-Type': type }).end(contents);
    } else {
      response.writeHead(404).end();
    }
  } catch (error) {
    console.error(error.message);
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      .end('Could not read the project data. Check the server output.');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Coffee Backoffice: http://127.0.0.1:${server.address().port}`);
});
