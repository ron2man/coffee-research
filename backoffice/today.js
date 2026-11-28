const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ago = (iso) => {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

function commands(list) {
  return `<div class="cmds">${list.map((c) => `<div class="cmd"><code>${esc(c)}</code><button type="button" data-copy="${esc(c)}">Copy</button></div>`).join('')}</div>`;
}

function render(d) {
  const s = d.scheduler;
  const next = s.next?.error ? `<span class="bad">${esc(s.next.error)}</span>` : s.next?.agent ? `${esc(s.next.agent)} ${s.next.itemIds?.length ? `on ${esc(s.next.itemIds.join(', '))}` : ''}` : 'nothing due';
  $('scheduler').innerHTML = `<h2>Scheduler</h2><div class="sched">
    <div><span class="muted">Now</span><strong>${s.running ? `Running (${esc(s.running.label)}, ${ago(s.running.startedAt)})` : 'Idle'}</strong></div>
    <div><span class="muted">Last tick</span><strong>${ago(s.lastLog?.startedAt ?? s.lastRun?.timestamp)}</strong></div>
    <div><span class="muted">Last agent run</span><strong>${esc(s.lastRun?.agent ?? '–')} ${s.lastRun ? `<small class="${s.lastRun.status === 'failed' ? 'bad' : 'ok'}">${esc(s.lastRun.status)}</small>` : ''}</strong></div>
    <div><span class="muted">Next tick will run</span><strong>${next}</strong></div>
    <div><span class="muted">Runs on</span><strong>${esc(s.owner?.name ?? 'not claimed yet')}</strong></div>
  </div>
  <div class="actions"><button type="button" id="run-tick" ${s.running ? 'disabled' : ''}>${s.running ? 'Tick running…' : 'Run next tick now'}</button>
  <span class="muted">${s.running ? 'Started ' + ago(s.running.startedAt) + '. The page refreshes every 10 seconds.' : 'Runs the next job right away instead of waiting for the hourly slot.'}</span></div>${s.lastLog ? `<details><summary>Last tick log</summary><pre>${esc(s.lastLog.tail)}</pre></details>` : '<p class="muted">No tick log in this checkout. Point the dashboard at the scheduler clone with BACKOFFICE_ROOT.</p>'}`;

  $('inbox-list').innerHTML = d.inbox.length ? d.inbox.map((i) => `<div class="item">
    <div class="kind">${esc(i.kind)}</div><div class="title">${esc(i.title)}</div>
    <div class="reason">${esc(i.reason)}${i.at ? ` · ${ago(i.at)}` : ''}</div>
    ${i.stuckId ? `<div class="actions"><input data-reason-for="${esc(i.stuckId)}" placeholder="What did you fix or decide?"><button type="button" data-item-act="resume" data-item="${esc(i.stuckId)}">Resume</button><button type="button" class="danger" data-item-act="reject" data-item="${esc(i.stuckId)}">Reject</button></div>` : ''}
    ${i.link ? `<div><a href="${esc(i.link)}" target="_blank" rel="noopener">Open the pull request</a></div>` : ''}
    ${i.itemId ? `<div class="actions"><button type="button" data-inbox-article="${esc(i.itemId)}">Open</button></div>` : i.proposalId ? '<div class="actions"><a href="#proposals">Review below</a></div>' : ''}
    <details><summary class="muted">Terminal commands</summary>${commands(i.commands)}</details></div>`).join('') : '<p class="empty">Nothing is waiting for you.</p>';

  $('board').innerHTML = d.pipeline.filter((c) => c.items.length || !['published', 'measured', 'blocked', 'needs_human'].includes(c.status)).map((c) => `<div class="col"><h4>${esc(c.status)} (${c.items.length})</h4>${c.items.map((i) => `<div class="card" title="${esc(i.lastReason)}">${esc(i.id)}<small>${i.ageHours} h · attempts ${i.attempts}${i.revisions ? ` · rev ${i.revisions}` : ''}</small></div>`).join('')}</div>`).join('');

  $('feedback-list').innerHTML = `<table><thead><tr><th>Agent</th><th>Prompt</th><th>Open feedback</th><th>Latest critic review</th></tr></thead><tbody>${d.feedback.map((f) => `<tr><td>${esc(f.agent)}</td><td>${f.hasPrompt ? 'yes' : '<span class="bad">missing</span>'}</td><td>${f.open} / ${f.total}</td><td>${f.lastCritic ? `${esc(f.lastCritic.summary)} <span class="muted">(${ago(f.lastCritic.at)})</span>` : '<span class="muted">none yet</span>'}</td></tr>`).join('')}</tbody></table>
  <h3>Prompt proposals</h3>${d.proposals.length ? `<table><tbody>${d.proposals.map((p) => `<tr><td>${esc(p.id)}</td><td>${esc(p.status)}</td><td>${esc(p.summary)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">None yet. The tuner proposes once an agent has enough open feedback.</p>'}`;

  const f = d.focus ?? {};
  $('focus-panel').innerHTML = f.error ? `<p class="bad">${esc(f.error)}</p>` : `<p class="muted">Reviewed every week, or sooner when the idea queue is empty. Last review: ${ago(f.lastReviewAt)}. Pin or exclude products for good in niche.json (focus.pinned, focus.exclude).</p>
    <table><thead><tr><th>Active</th><th>Since</th><th>Why</th></tr></thead><tbody>${(f.active ?? []).map((a) => `<tr><td>${esc(a.productId)}</td><td>${ago(a.since)}</td><td>${esc(a.reason)}</td></tr>`).join('')}</tbody></table>
    ${f.changes?.length ? `<h3>Recent changes</h3>${f.changes.map((h) => `<div class="note"><strong>${esc(h.trigger)}</strong> · ${ago(h.at)}${h.undone ? ' · undone' : ''}<br>${[...h.added.map((id) => `+ ${esc(id)}`), ...h.removed.map((r) => `− ${esc(r.productId)}${r.reason ? ` (${esc(r.reason)})` : ''}`)].join('<br>')}</div>`).join('')}` : ''}
    ${f.canUndo ? '<div class="actions"><button type="button" class="danger" id="focus-undo">Undo the last change</button><span class="muted">Brings back what it retired; what it added is excluded until you allow it again.</span></div>' : ''}
    ${f.covered?.length ? `<h3>Covered</h3><p class="muted">${f.covered.map((c) => `${esc(c.productId)} (${esc(c.reason)})`).join(' · ')}</p>` : ''}
    ${f.excluded?.length ? `<h3>Excluded</h3>${f.excluded.map((e) => `<div class="actions">${esc(e.productId)} <span class="muted">${esc(e.reason)}</span><button type="button" data-focus-allow="${esc(e.productId)}">Allow again</button></div>`).join('')}` : ''}`;

  $('seeds-list').innerHTML = d.seeds.length ? `<table><thead><tr><th>Seed</th><th>Status</th><th>Looked at</th><th>Cards / why not</th></tr></thead><tbody>${d.seeds.map((x) => `<tr><td>${esc(x.text)}</td><td>${esc(x.status)}</td><td>${x.considered}×</td><td>${esc(x.itemIds.join(', '))}${x.lastWhy ? `<div class="muted">${esc(x.lastWhy)}</div>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No seeds yet.</p>';
  const total = d.costs.reduce((sum, c) => sum + c.costUsd, 0);
  $('costs').innerHTML = `<p class="muted">Cost is the CLI's estimate at API prices, not your subscription bill. Total: $${total.toFixed(2)}.</p><table><thead><tr><th>Agent</th><th>Runs</th><th>Failures</th><th>Avg min</th><th>Est. cost</th><th>Last</th></tr></thead><tbody>${d.costs.map((c) => `<tr><td>${esc(c.agent)}</td><td>${c.runs}</td><td class="${c.failures ? 'bad' : ''}">${c.failures}</td><td>${c.avgMinutes ?? '–'}</td><td>$${c.costUsd.toFixed(2)}</td><td>${ago(c.last)}</td></tr>`).join('')}</tbody></table>`;
  $('agent-runs').innerHTML = d.runLogs.length ? d.runLogs.map((r) => `<details class="note ${r.status === 'failed' ? 'open' : ''}"><summary><strong>${esc(r.agent)}</strong> ${esc(r.itemIds.join(', '))} · ${ago(r.at)} · ${r.minutes ?? '?'} min · ${r.status === 'failed' ? `<span class="bad">${esc(r.error)}</span>` : 'returned'}${r.summary ? ` · ${r.summary.searches} searches, ${r.summary.fetches} pages (${r.summary.failedFetches} failed), ${r.summary.reads} files` : ''}</summary>
    ${r.calls.length ? `<table><tbody>${r.calls.map((c) => `<tr><td>${esc(c.tool)}</td><td>${esc(c.target)}</td><td class="${c.ok === false ? 'bad' : c.ok ? 'ok' : 'muted'}">${c.ok === false ? `failed${c.note ? `: ${esc(c.note)}` : ''}` : c.ok ? 'ok' : 'no answer'}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No trace for this run.</p>'}</details>`).join('') : '<p class="muted">No traced runs yet. Runs after this update keep a trace.</p>';
  $('recent').innerHTML = `<table><thead><tr><th>When</th><th>Agent</th><th>Item</th><th>Result</th><th>Min</th></tr></thead><tbody>${d.recentRuns.map((r) => `<tr><td>${ago(r.timestamp)}</td><td>${esc(r.agent ?? 'human')}</td><td>${esc(r.itemId ?? '')}</td><td class="${r.status === 'failed' ? 'bad' : ''}">${esc(r.status === 'failed' ? r.error : `${r.outcome ?? ''}${r.to ? ` → ${r.to}` : ''}`)}</td><td>${r.minutes ?? ''}</td></tr>`).join('')}</tbody></table>`;
  renderArticles(d);
  $('status').textContent = `Reading ${d.root} · updated ${new Date(d.generatedAt).toLocaleTimeString()} · refreshes every minute`;
}

async function load() {
  try {
    const response = await fetch('/today-data');
    if (!response.ok) throw new Error(await response.text());
    render(await response.json());
  } catch (error) {
    $('status').textContent = `Could not load: ${error.message}`;
  }
}

document.addEventListener('click', (event) => {
  const text = event.target.dataset?.copy;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => { event.target.textContent = 'Copied'; setTimeout(() => { event.target.textContent = 'Copy'; }, 1200); });
});
$('reload').addEventListener('click', load);
// Refresh every minute, or every 10 seconds while a tick is running.
let running = false;
const loadAndTrack = async () => {
  await load();
  running = Boolean(document.getElementById('run-tick')?.disabled);
};
loadAndTrack();
setInterval(() => { if (running) loadAndTrack(); }, 10_000);
setInterval(() => { if (!running) loadAndTrack(); }, 60_000);

// ---------- Actions: comments, send back to the writer, proposals, seeds ----------
let token = null;
async function session() {
  if (!token) token = (await (await fetch('/session')).json()).token;
  return token;
}
function toast(text, error = false) {
  const el = $('toast');
  el.textContent = text;
  el.className = error ? 'err' : '';
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 6000);
}
async function post(name, payload, button) {
  if (button) button.disabled = true;
  try {
    const response = await fetch(`/action/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Backoffice-Token': await session() },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? response.statusText);
    toast(`${result.message}${result.committed ? ' Saved and pushed.' : ''}`);
    await load();
    return result;
  } catch (error) {
    toast(error.message, true);
    return null;
  } finally {
    if (button) button.disabled = false;
  }
}

function renderArticles(d) {
  $('article-list').innerHTML = d.articles.length ? d.articles.map((a) => `<div class="article-row">
    <div><span class="pill ${esc(a.status)}">${esc(a.status.replace('_', ' '))}</span><span class="t">${esc(a.title)}</span>
    <div class="muted">${a.verdict ? `${['briefed', 'drafted'].includes(a.status) ? 'Before this revision the judge said' : 'Judge'}: ${esc(a.verdict)}${a.wouldForward ? ', would forward' : ''} · ` : ''}${a.revisions ? `revision ${a.revisions} · ` : ''}updated ${ago(a.updatedAt)}</div></div>
    <button type="button" data-article="${esc(a.id)}">Open</button></div>`).join('') : '<p class="muted">No drafts yet.</p>';

  const colour = (diff) => esc(diff).split('\n').map((l) => (/^\+(?!\+\+)/.test(l) ? `<span class="add">${l}</span>` : /^-(?!--)/.test(l) ? `<span class="del">${l}</span>` : l)).join('\n');
  $('proposal-list').innerHTML = d.openProposals.length ? d.openProposals.map((p) => `<div class="item">
    <div class="kind">${esc(p.agent)} · ${ago(p.at)}</div><div class="title">${esc(p.summary)}</div>
    <details><summary>Show the change</summary><div class="diff">${colour(p.diff)}</div></details>
    <div class="actions"><button type="button" data-apply="${esc(p.id)}">Apply</button>
    <input data-reason-for="${esc(p.id)}" placeholder="Why not? (needed to reject)"><button type="button" class="danger" data-reject-proposal="${esc(p.id)}">Reject</button></div></div>`).join('')
    : '<p class="muted">Nothing to review. The tuner proposes once an agent has enough feedback.</p>';
}

async function openArticle(id) {
  const response = await fetch(`/article?id=${encodeURIComponent(id)}`);
  const a = await response.json();
  if (!response.ok) return toast(a.error ?? 'Not found', true);
  $('article-title').textContent = a.draft?.title ?? a.id;
  const r = a.review;
  const scores = r ? Object.entries(r.scores).map(([k, v]) => `<div class="score" title="${esc(v.reason)}"><span>${esc(k.replace(/([A-Z])/g, ' $1').toLowerCase())}</span><strong>${v.score}/5</strong></div>`).join('') : '';
  $('article-body').innerHTML = `<div class="article-grid">
    <div class="prose">${a.draft ? a.draft.html : '<p class="muted">The writer hasn’t produced this draft yet.</p>'}</div>
    <div class="side">
      <p><span class="pill ${esc(a.status)}">${esc(a.status.replace('_', ' '))}</span>${a.previewUrl ? `<a href="${esc(a.previewUrl)}" target="_blank" rel="noopener">Open in the site preview</a> <span class="muted">(npm run site:preview)</span>` : ''}</p>
      ${a.draft ? `<h3>Title</h3><p class="muted">${a.draft.titleLength} characters (max 70)${a.draft.seoTitle ? `<br>Search title: ${esc(a.draft.seoTitle)} (${a.draft.seoTitle.length})` : ''}</p>${a.draft.titleProblems.map((p) => `<div class="note open">${esc(p)}</div>`).join('')}` : ''}
      <h3>Your comment</h3>
      <textarea id="article-note" placeholder="What should change? Be specific: the writer gets this word for word."></textarea>
      <div class="actions">
        <button type="button" data-act="comment">Add comment</button>
        ${a.allowed.revise ? '<button type="button" data-act="revise">Send back to the writer</button>' : ''}
        ${a.allowed.hold ? '<button type="button" class="danger" data-act="hold">Hold publishing</button>' : ''}
        ${a.allowed.publish ? `<button type="button" data-act="publish" ${a.publishBlockers.length ? 'disabled title="See what blocks publishing below"' : ''}>Approve for publishing</button>` : ''}
        ${a.allowed.resume ? '<button type="button" data-act="resume">Resume</button>' : ''}
        ${a.allowed.reject ? '<button type="button" class="danger" data-act="reject">Reject article</button>' : ''}
      </div>
      ${a.publishRequest ? `<div class="note open"><strong>Publishing</strong>: pull request on branch ${esc(a.publishRequest.branch)}. ${a.publishRequest.prUrl ? `<a href="${esc(a.publishRequest.prUrl)}" target="_blank" rel="noopener">Open it on GitHub</a> and merge to publish.` : 'Open it on GitHub and merge to publish.'}</div>` : ''}
      ${a.publishBlockers.length ? `<div class="note open"><strong>Before this can be published</strong><br>${a.publishBlockers.map(esc).join('<br>')}</div>` : ''}
      <p class="muted">${a.allowed.revise ? '“Send back” rewrites this article now. “Add comment” is kept for the next pass and teaches the writer’s prompt.' : a.status === 'briefed' ? 'The writer is working on this. Comments reach it on this pass.' : ''}</p>
      ${r ? `<h3>Post judge: ${r.wouldForward ? 'would forward' : 'would not forward'}</h3>${scores}
        ${r.blockingActions?.length ? `<h3>Blocking fixes</h3><ul>${r.blockingActions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${r.optionalImprovements?.length ? `<h3>Optional improvements</h3><ul>${r.optionalImprovements.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        <h3>Against the top results</h3><ul>${r.competitorComparison.map((c) => `<li>${esc(c.weGiveThatTheyDont)} <span class="muted">(${esc(new URL(c.url).hostname)})</span></li>`).join('')}</ul>` : ''}
      <h3>Notes and checks</h3>${a.notes.length ? a.notes.map((n) => `<div class="note ${n.open ? 'open' : ''}"><strong>${esc(n.source)} → ${esc(n.agent)}</strong> · ${ago(n.at)}${n.open ? '' : ' · done'}<br>${n.findings.map(esc).join('<br>')}</div>`).join('') : '<p class="muted">None.</p>'}
      ${a.draft ? `<h3>Products</h3><p class="muted">Discussed: ${esc(a.draft.productIds.join(', ') || 'none')}<br>Offered: ${esc(a.draft.offerIds.join(', ') || 'none')}<br>${a.draft.claims} sourced claims</p>` : ''}
      <h3>History</h3>${a.history.map((h) => `<div class="note"><strong>${esc(h.from ?? 'new')} → ${esc(h.to)}</strong> by ${esc(h.by)} · ${ago(h.at)}${h.reason ? `<br>${esc(h.reason)}` : ''}</div>`).join('')}
    </div></div>`;
  $('article-body').dataset.id = a.id;
  if (!$('article-dialog').open) $('article-dialog').showModal();
}

document.addEventListener('click', async (event) => {
  const t = event.target;
  if (t.dataset.article) return openArticle(t.dataset.article);
  if (t.id === 'run-tick') {
    const started = await post('tick', {}, t);
    if (started) { running = true; setTimeout(loadAndTrack, 2000); }
    return;
  }
  if (t.hasAttribute?.('data-close')) return $('article-dialog').close();
  if (t.dataset.act) {
    const id = $('article-body').dataset.id;
    const text = $('article-note').value;
    if (t.dataset.act === 'publish' && !confirm('Open a pull request that publishes this article? It goes live only when you merge it.')) return;
    if (t.dataset.act === 'reject' && !confirm('Reject this article? It leaves the pipeline (it can be reopened later).')) return;
    const done = await post(t.dataset.act, { itemId: id, text }, t);
    if (done) openArticle(id);
    return;
  }
  if (t.dataset.apply) return post('apply-proposal', { proposalId: t.dataset.apply }, t);
  if (t.dataset.rejectProposal) {
    const id = t.dataset.rejectProposal;
    return post('reject-proposal', { proposalId: id, text: document.querySelector(`[data-reason-for="${CSS.escape(id)}"]`).value }, t);
  }
  if (t.id === 'focus-undo') {
    if (!confirm('Undo the last focus change?')) return;
    return post('focus-undo', {}, t);
  }
  if (t.dataset.focusAllow) return post('focus-allow', { productId: t.dataset.focusAllow }, t);
  if (t.dataset.inboxArticle) return openArticle(t.dataset.inboxArticle);
  if (t.dataset.itemAct) {
    const id = t.dataset.item;
    return post(t.dataset.itemAct, { itemId: id, text: document.querySelector(`[data-reason-for="${CSS.escape(id)}"]`).value }, t);
  }
});

$('seed-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = event.target.elements.text;
  if (await post('seed', { text: input.value }, event.submitter)) input.value = '';
});
