// Small, strict Markdown renderer for posts. Everything is escaped; only known syntax becomes HTML.
// Supports: ## / ### headings, paragraphs, - and 1. lists, > quotes, | tables |, **bold**, *italic*,
// `code`, [links](https://…), and component markers on their own line: {{tool <id>}}, {{pricebox}}.
export function escape(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function inline(text) {
  let html = '';
  let cursor = 0;
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|`([^`]+)`/g;
  for (const m of text.matchAll(pattern)) {
    html += escape(text.slice(cursor, m.index));
    if (m[1]) html += `<a href="${escape(m[2])}" rel="noopener">${inline(m[1])}</a>`;
    else if (m[3]) html += `<strong>${escape(m[3])}</strong>`;
    else if (m[4]) html += `<em>${escape(m[4])}</em>`;
    else if (m[5]) html += `<code>${escape(m[5])}</code>`;
    cursor = m.index + m[0].length;
  }
  return html + escape(text.slice(cursor));
}

export const slugify = (text) => text.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Parse Markdown into blocks. Returns { blocks, headings }. Each block is
 * { type: 'html', html } or { type: 'component', name, arg } so the page can render components.
 */
export function parseMarkdown(markdown) {
  const blocks = [];
  const headings = [];
  const ids = new Set();
  for (const raw of markdown.trim().split(/\r?\n\s*\r?\n/)) {
    const block = raw.trim();
    if (!block) continue;
    const component = block.match(/^\{\{\s*(tool|pricebox)(?:\s+([a-z0-9-]+))?\s*\}\}$/);
    if (component) {
      blocks.push({ type: 'component', name: component[1], arg: component[2] ?? null });
      continue;
    }
    const heading = block.match(/^(#{2,3})\s+(.+)$/);
    if (heading && !block.includes('\n')) {
      let id = slugify(heading[2]);
      while (ids.has(id)) id += '-2';
      ids.add(id);
      const level = heading[1].length;
      headings.push({ level, id, text: heading[2] });
      blocks.push({ type: 'heading', level, id, text: heading[2], html: `<h${level} id="${id}">${inline(heading[2])}</h${level}>` });
      continue;
    }
    const lines = block.split(/\r?\n/);
    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      blocks.push({ type: 'html', html: `<ul>${lines.map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>` });
    } else if (lines.every((l) => /^\d+[.)]\s+/.test(l))) {
      blocks.push({ type: 'html', html: `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+[.)]\s+/, ''))}</li>`).join('')}</ol>` });
    } else if (lines.every((l) => /^>\s?/.test(l))) {
      blocks.push({ type: 'html', html: `<blockquote><p>${inline(lines.map((l) => l.replace(/^>\s?/, '')).join(' '))}</p></blockquote>` });
    } else if (lines.length >= 2 && lines.every((l) => /^\|.*\|$/.test(l.trim())) && /^\|[\s:|-]+\|$/.test(lines[1].trim())) {
      const rows = lines.map((l) => l.trim().slice(1, -1).split('|').map((c) => c.trim()));
      const [head, , ...body] = rows;
      blocks.push({ type: 'html', html: `<div class="table-scroll" tabindex="0"><table><thead><tr>${head.map((c) => `<th scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` });
    } else {
      blocks.push({ type: 'html', html: `<p>${inline(lines.join(' '))}</p>` });
    }
  }
  return { blocks, headings };
}

/** Parse `---` frontmatter (key: value; JSON values allowed). Returns { data, body }. */
export function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: text };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    try {
      value = JSON.parse(value);
    } catch {
      value = value.replace(/^["']|["']$/g, '');
    }
    data[kv[1]] = value;
  }
  return { data, body: text.slice(match[0].length) };
}
