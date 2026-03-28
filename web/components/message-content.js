import { html } from '../preact-shim.js';

export function MessageContent({ content }) {
  if (!content) return html``;

  // Split on code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);

  return html`<div class="msg-content">${parts.map(part => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const inner = part.slice(3, -3).trim();
      const firstNewline = inner.indexOf('\n');
      const lang = firstNewline > 0 ? inner.slice(0, firstNewline).trim() : '';
      const code = firstNewline > 0 ? inner.slice(firstNewline + 1) : inner;
      return html`<div class="code-block"><div class="code-header">${lang || 'code'}</div><pre><code>${code}</code></pre></div>`;
    }
    // Process inline markdown
    const processed = renderMarkdown(part);
    return html`<span dangerouslySetInnerHTML=${{ __html: processed }}></span>`;
  })}</div>`;
}

function renderMarkdown(text) {
  let html_text = escapeHtml(text);

  // Headers
  html_text = html_text.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html_text = html_text.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html_text = html_text.replace(/^# (.+)$/gm, '<h2>$1</h2>');

  // Blockquotes
  html_text = html_text.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Unordered list items
  html_text = html_text.replace(/^[-*] (.+)$/gm, ':::li:::$1:::/eli:::');

  // Wrap consecutive list items in <ul>
  html_text = html_text.replace(/(:::li:::(?:[\s\S]*?:::\/eli:::)\s*)+/g, (match) => {
    const items = match.replace(/:::li:::/g, '<li>').replace(/:::\/eli:::/g, '</li>');
    return '<ul>' + items + '</ul>';
  });

  // Ordered list items
  html_text = html_text.replace(/^\d+\. (.+)$/gm, '<ol><li>$1</li></ol>');
  html_text = html_text.replace(/<\/ol>\s*<ol>/g, '');

  // Bold, italic, inline code, links (after escaping)
  html_text = html_text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html_text = html_text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html_text = html_text.replace(/`([^`]+)`/g, '<code>$1</code>');
  html_text = html_text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Line breaks
  html_text = html_text.replace(/\n/g, '<br>');

  return html_text;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
