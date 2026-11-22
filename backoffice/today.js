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
  </div>${s.lastLog ? `<details><summary>Last tick log</summary><pre>${esc(s.lastLog.tail)}</pre></details>` : '<p class="muted">No tick log in this checkout. Point the dashboard at the scheduler clone with BACKOFFICE_ROOT.</p>'}`;

  $('inbox-list').innerHTML = d.inbox.length ? d.inbox.map((i) => `<div class="item">
    <div class="kind">${esc(i.kind)}</div><div class="title">${esc(i.title)}</div>
    <div class="reason">${esc(i.reason)}${i.at ? ` · ${ago(i.at)}` : ''}</div>
    ${i.link ? `<div><a href="${esc(i.link)}" target="_blank" rel="noopener">Open in the preview site</a> <span class="muted">(run npm run site:preview first)</span></div>` : ''}
    ${commands(i.commands)}</div>`).join('') : '<p class="empty">Nothing is waiting for you.</p>';

  $('board').innerHTML = d.pipeline.filter((c) => c.items.length || !['published', 'measured', 'blocked', 'needs_human'].includes(c.status)).map((c) => `<div class="col"><h4>${esc(c.status)} (${c.items.length})</h4>${c.items.map((i) => `<div class="card" title="${esc(i.lastReason)}">${esc(i.id)}<small>${i.ageHours} h · attempts ${i.attempts}${i.revisions ? ` · rev ${i.revisions}` : ''}</small></div>`).join('')}</div>`).join('');

  $('feedback-list').innerHTML = `<table><thead><tr><th>Agent</th><th>Prompt</th><th>Open feedback</th><th>Latest critic review</th></tr></thead><tbody>${d.feedback.map((f) => `<tr><td>${esc(f.agent)}</td><td>${f.hasPrompt ? 'yes' : '<span class="bad">missing</span>'}</td><td>${f.open} / ${f.total}</td><td>${f.lastCritic ? `${esc(f.lastCritic.summary)} <span class="muted">(${ago(f.lastCritic.at)})</span>` : '<span class="muted">none yet</span>'}</td></tr>`).join('')}</tbody></table>
  <h3>Prompt proposals</h3>${d.proposals.length ? `<table><tbody>${d.proposals.map((p) => `<tr><td>${esc(p.id)}</td><td>${esc(p.status)}</td><td>${esc(p.summary)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">None yet. The tuner proposes once an agent has enough open feedback.</p>'}`;

  const total = d.costs.reduce((sum, c) => sum + c.costUsd, 0);
  $('costs').innerHTML = `<p class="muted">Cost is the CLI's estimate at API prices, not your subscription bill. Total: $${total.toFixed(2)}.</p><table><thead><tr><th>Agent</th><th>Runs</th><th>Failures</th><th>Avg min</th><th>Est. cost</th><th>Last</th></tr></thead><tbody>${d.costs.map((c) => `<tr><td>${esc(c.agent)}</td><td>${c.runs}</td><td class="${c.failures ? 'bad' : ''}">${c.failures}</td><td>${c.avgMinutes ?? '–'}</td><td>$${c.costUsd.toFixed(2)}</td><td>${ago(c.last)}</td></tr>`).join('')}</tbody></table>`;
  $('recent').innerHTML = `<table><thead><tr><th>When</th><th>Agent</th><th>Item</th><th>Result</th><th>Min</th></tr></thead><tbody>${d.recentRuns.map((r) => `<tr><td>${ago(r.timestamp)}</td><td>${esc(r.agent ?? 'human')}</td><td>${esc(r.itemId ?? '')}</td><td class="${r.status === 'failed' ? 'bad' : ''}">${esc(r.status === 'failed' ? r.error : `${r.outcome ?? ''}${r.to ? ` → ${r.to}` : ''}`)}</td><td>${r.minutes ?? ''}</td></tr>`).join('')}</tbody></table>`;
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
load();
setInterval(load, 60_000);
