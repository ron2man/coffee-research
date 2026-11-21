export function escape(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function inline(value) {
  let cursor = 0;
  let html = '';
  for (const match of value.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g)) {
    html += escape(value.slice(cursor, match.index));
    if (match[1]) html += `<a href="${escape(match[2])}">${escape(match[1])}</a>`;
    if (match[3]) html += `<strong>${escape(match[3])}</strong>`;
    if (match[4]) html += `<code>${escape(match[4])}</code>`;
    cursor = match.index + match[0].length;
  }
  return html + escape(value.slice(cursor));
}

function headingId(heading) {
  return heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function parseArticle(markdown) {
  const [heading, ...blocks] = markdown.trim().split(/\r?\n\s*\r?\n/);
  if (!/^# [^\n]+$/.test(heading) || !blocks.length) {
    throw new Error('Expected an article title and body');
  }
  const sections = [];
  const ids = new Set();
  const body = blocks.map((block) => {
    const section = block.match(/^(#{2,3}) ([^\n]+)$/);
    if (section) {
      const level = section[1].length;
      const text = section[2];
      const id = headingId(text);
      if (!id || ids.has(id)) throw new Error(`Invalid or duplicate heading: ${text}`);
      ids.add(id);
      if (level === 2) sections.push({ id, text });
      return `<h${level} id="${id}">${inline(text)}</h${level}>`;
    }
    const lines = block.split(/\r?\n/);
    if (lines.every((line) => /^[-*] /.test(line))) {
      return `<ul>${lines.map((line) => `<li>${inline(line.slice(2))}</li>`).join('')}</ul>`;
    }
    if (lines.length >= 2 && lines.every((line) => /^\|.*\|$/.test(line))) {
      const rows = lines.map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim()));
      const [headers, separator, ...values] = rows;
      if (separator.every((cell) => /^:?-+:?$/.test(cell)) &&
          rows.every((row) => row.length === headers.length)) {
        return `<div class="table-scroll" role="region" aria-label="Article table" tabindex="0"><table><thead><tr>${headers.map((cell) => `<th scope="col">${inline(cell)}</th>`).join('')}</tr></thead><tbody>${values.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
    }
    return `<p>${inline(block)}</p>`;
  });
  const lead = body.shift();
  if (!lead.startsWith('<p>')) throw new Error('Expected an opening paragraph with the reader takeaway');
  const description = blocks[0].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/(\*\*|`)/g, '').trim();
  return { heading: heading.slice(2), description, lead, sections, body: body.join('\n') };
}

export function layout({ title, description, content }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta name="description" content="${escape(description)}">
  <title>${escape(title)}</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="masthead">
    <div class="frame masthead-inner">
      <a href="/" class="wordmark">Coffee <span>Fieldnotes</span></a>
      <nav aria-label="Main navigation"><a href="/#guides">Guides</a></nav>
    </div>
  </header>
  <main id="main">${content}</main>
  <footer class="footer"><div class="frame">Coffee Fieldnotes</div></footer>
</body>
</html>`;
}

export function renderCandidate(markdown) {
  const article = parseArticle(markdown);
  return layout({
    title: `${article.heading} | Coffee Fieldnotes`,
    description: article.description,
    content: `
    <header class="article-hero"><div class="frame">
      <nav aria-label="Breadcrumb"><a href="/#guides">Guides</a></nav>
      <h1>${escape(article.heading)}</h1>
      ${article.lead}
    </div></header>
    <div class="frame article-grid">
      ${article.sections.length ? `<nav class="contents" aria-label="On this page"><strong>On this page</strong><ul>${article.sections.map(({ id, text }) => `<li><a href="#${id}">${escape(text)}</a></li>`).join('')}</ul></nav>` : ''}
      <article class="prose">
        ${article.body}
      </article>
    </div>`,
  });
}
