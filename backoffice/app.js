const get = (id) => document.getElementById(id);
const statusNames = {
  new: 'Queued', refresh: 'Refresh due', current: 'Current', unavailable: 'Unknown',
};
let queue = [];
let drafts = [];
const verdictLabels = {
  pass: 'Passed review', revise: 'Needs revision', defer: 'Deferred', unjudged: 'Not yet judged',
};
const scoreLabels = {
  topicSelection: 'Topic selection', evidence: 'Evidence',
  readerValue: 'Reader value', onPageSeo: 'On-page SEO',
};

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

function formatText(node, text) {
  let cursor = 0;
  for (const match of text.matchAll(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*/g)) {
    node.append(text.slice(cursor, match.index));
    if (match[3]) {
      node.append(element('strong', match[3]));
    } else {
      const link = element('a', match[1]);
      link.href = match[2];
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      node.append(link);
    }
    cursor = match.index + match[0].length;
  }
  node.append(text.slice(cursor));
  return node;
}

function preview(label, markdown) {
  const details = element('details', undefined, 'draft-preview');
  details.append(element('summary', label));
  const body = element('div', undefined, 'preview-body');
  for (const block of markdown.trim().split(/\n\s*\n/)) {
    if (/^#{1,6} /.test(block)) {
      body.append(formatText(element('h4'), block.replace(/^#{1,6} /, '')));
    } else if (block.startsWith('|')) {
      const [headers, separator, ...rows] = block.split('\n')
        .map((line) => line.trim().slice(1, -1).split('|').map((cell) => cell.trim()));
      if (separator?.every((cell) => /^:?-+:?$/.test(cell))) {
        const wrap = element('div', undefined, 'table-wrap');
        const grid = table(headers, rows);
        for (const cell of grid.querySelectorAll('td')) {
          const text = cell.textContent;
          cell.replaceChildren();
          formatText(cell, text);
        }
        wrap.append(grid);
        body.append(wrap);
      } else {
        body.append(element('pre', block));
      }
    } else if (block.startsWith('- ')) {
      const list = element('ul');
      for (const line of block.split('\n')) {
        list.append(formatText(element('li'), line.replace(/^- /, '')));
      }
      body.append(list);
    } else {
      body.append(formatText(element('p'), block));
    }
  }
  details.append(body);
  return details;
}

function appendFeedback(container, label, entries) {
  if (!Array.isArray(entries) || !entries.length) return;
  const list = element('ol');
  for (const entry of entries) list.append(formatText(element('li'), String(entry)));
  container.append(element('h4', label), list);
}

function renderDraft(draft) {
  const card = element('article', undefined, 'draft-card');
  card.id = `draft-${draft.id}`;
  const verdict = draft.review?.verdict ?? 'unjudged';
  const label = draft.reviewError ? 'Review unavailable' : verdictLabels[verdict];
  const header = element('div', undefined, 'draft-header');
  header.append(element('h3', draft.title), element('span', label, `verdict verdict-${verdict}`));
  card.append(header);
  if (draft.query) card.append(element('p', `Target query · ${draft.query}`, 'muted'));
  if (draft.audience) card.append(element('p', draft.audience, 'muted'));
  if (draft.reviewError) card.append(element('p', draft.reviewError));
  const actions = Array.isArray(draft.review?.actions) ? draft.review.actions.filter((action) => typeof action === 'string') : [];
  if (actions.length) card.append(formatText(element('p'), `**Top action** · ${actions[0]}`));
  card.append(preview('Read article', draft.article));
  if (draft.brief) card.append(preview('Read editorial brief', draft.brief));
  if (draft.review) {
    const review = element('details', undefined, 'draft-preview');
    review.append(element('summary', 'Read judge review'));
    for (const [key, label] of Object.entries(scoreLabels)) {
      const score = draft.review.scores?.[key];
      if (score) {
        review.append(element('h4', `${label} · ${score.score}/5`),
          formatText(element('p'), String(score.reason ?? '')));
      }
    }
    appendFeedback(review, Array.isArray(draft.review.optionalImprovements) ? 'Blocking actions' : 'Revision actions', actions);
    appendFeedback(review, 'Optional improvements', draft.review.optionalImprovements);
    card.append(review);
    if (Array.isArray(draft.review.history) && draft.review.history.length) {
      const history = element('details', undefined, 'draft-preview');
      history.append(element('summary', 'Earlier reviews'));
      for (const prior of draft.review.history) {
        history.append(element('h4', verdictLabels[prior.verdict] ?? prior.verdict));
        for (const [key, label] of Object.entries(scoreLabels)) {
          const score = prior.scores?.[key];
          if (score) history.append(formatText(element('p'), `**${label} · ${score.score}/5** · ${score.reason}`));
        }
        appendFeedback(history, Array.isArray(prior.optionalImprovements) ? 'Blocking actions' : 'Revision actions', prior.actions);
        appendFeedback(history, 'Optional improvements', prior.optionalImprovements);
      }
      card.append(history);
    }
  }
  if (draft.commitUrl) {
    const link = element('a', 'View GitHub commit', 'draft-commit');
    link.href = draft.commitUrl;
    card.append(link);
  }
  return card;
}

function updateDrafts() {
  const filter = get('draft-filter').value;
  const visible = drafts.filter((draft) => filter === 'all' ||
    (draft.review?.verdict ?? 'unjudged') === filter);
  show('draft-list', visible.map(renderDraft), 'No drafts match this review status.');
}

function render(data) {
  queue = data.queue;
  drafts = data.drafts ?? [];
  updateDrafts();
  const summary = data.plan?.summary;
  const metrics = [
    ['Editorial drafts', drafts.length],
    ['Drafts needing revision', drafts.filter((draft) => draft.review?.verdict === 'revise').length],
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
    const verdicts = Array.isArray(run.details?.verdicts) ? run.details.verdicts : [];
    const reviewStatus = verdicts.map(({ verdict }) => verdictLabels[verdict]).filter(Boolean).join(', ');
    const status = reviewStatus ? `${run.status} · ${reviewStatus}` : run.status;
    details.append(element('summary', `${timestamp} · ${run.workflow} · ${status}`));
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

get('draft-filter').addEventListener('change', updateDrafts);
get('filter').addEventListener('input', updateQueue);
get('reload').addEventListener('click', refresh);
refresh();
