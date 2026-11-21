const get = (id) => document.getElementById(id);
const statusNames = {
  new: 'Queued', refresh: 'Refresh due', current: 'Current', unavailable: 'Unknown',
};
let queue = [];

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function show(id, items, empty) {
  get(id).replaceChildren(...(items.length ? items : [element('p', empty, 'muted')]));
}

function table(headers, rows) {
  const result = element('table');
  const header = result.createTHead().insertRow();
  for (const label of headers) {
    const cell = element('th', label);
    cell.scope = 'col';
    header.append(cell);
  }
  const body = result.createTBody();
  for (const values of rows) {
    const row = body.insertRow();
    for (const value of values) row.insertCell().textContent = value;
  }
  return result;
}

function updateQueue() {
  const query = get('filter').value.trim().toLowerCase();
  const rows = queue.map((item) => [
    item.name, item.category, statusNames[item.status], item.originLabel,
  ]).filter((row) => row.slice(0, 3).some((value) => value.toLowerCase().includes(query)));
  show('queue-list', rows.length ? [table(['Product', 'Category', 'Status', 'Discovery'], rows)] : [],
    'No matching products.');
}

function renderCard(card) {
  const details = element('details');
  details.append(element('summary', card.name));
  details.append(element('p', `Updated ${card.updatedAt} · ${card.claims.length} claims`, 'muted'));
  const sources = new Map(card.sources.map((source) => [source.id, source]));
  const claims = element('ul');
  for (const claim of card.claims) {
    const row = element('li', claim.statement);
    const scope = claim.variantId ? ` · ${claim.variantId}` : '';
    row.append(element('div', `${claim.status} · Verified ${claim.verifiedAt}${scope}`, 'muted'));
    if (claim.note) row.append(element('div', claim.note));
    for (const evidence of claim.evidence) {
      const source = sources.get(evidence.sourceId);
      const line = element('div');
      const link = element('a', source.id);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      line.append(link, ` · ${evidence.locator}`);
      row.append(line);
    }
    claims.append(row);
  }
  details.append(claims);
  return details;
}

function render(data) {
  queue = data.queue;
  const summary = data.plan?.summary;
  const metrics = [
    ['Product cards', data.cards.length],
    ['Queued for research', summary?.new ?? '—'],
    ['Due for refresh', summary?.refresh ?? '—'],
    ['Products with open claims', summary?.productsWithOpenClaims ?? '—'],
  ].map(([label, value]) => {
    const box = element('div', undefined, 'metric');
    box.append(element('strong', value), element('span', label));
    return box;
  });
  show('metrics', metrics);
  show('attention', [
    ...data.issues.map((issue) => element('p', issue)),
    ...(data.plan?.openClaims ?? []).map((item) =>
      element('p', `${item.id} · ${item.claimIds.join(', ')}`)),
  ], 'No validation errors or open claims reported.');

  const batch = data.plan?.batch.slice(0, 5) ?? [];
  const list = element('ol');
  for (const item of batch) {
    list.append(element('li', `${item.name} · ${statusNames[item.status]}`));
  }
  show('next', batch.length ? [list] : [],
    data.plan ? 'No work is due.' : 'Resolve the issues above to generate a batch.');
  updateQueue();
  show('cards', data.cards.map(renderCard), 'No valid product cards yet.');
  show('milestones', data.milestones.map((phase) => {
    const details = element('details');
    details.append(element('summary', phase.name), element('p', phase.deliverable),
      element('p', phase.verification, 'muted'));
    return details;
  }), 'No milestones found in the implementation plan.');
  show('history', data.runs.map((run) => {
    const details = element('details');
    const timestamp = new Date(run.timestamp).toLocaleString();
    details.append(element('summary', `${timestamp} · ${run.workflow} · ${run.status}`));
    details.append(element('p', `${run.durationMs} ms`, 'muted'));
    details.append(element('pre', typeof run.details === 'string' ? run.details :
      JSON.stringify(run.details, null, 2)));
    return details;
  }), 'No recorded workflow runs yet.');
  const lessons = data.lessons.split(/^### /m).slice(1).map((entry) => {
    const [heading, ...body] = entry.trim().split('\n');
    const details = element('details');
    details.append(element('summary', heading), element('p', body.join('\n').trim()));
    return details;
  });
  show('learning', lessons, 'No observations recorded yet.');
}

async function refresh() {
  get('reload').disabled = true;
  get('status').textContent = 'Loading project data…';
  try {
    const response = await fetch('/data');
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    render(data);
    get('status').textContent = `Local workspace · Loaded ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    get('status').textContent = `Refresh failed. ${error.message}`;
  } finally {
    get('reload').disabled = false;
  }
}

get('filter').addEventListener('input', updateQueue);
get('reload').addEventListener('click', refresh);
refresh();
