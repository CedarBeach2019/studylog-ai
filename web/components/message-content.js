import { html } from '../preact-shim.js';

export function MessageContent({ content }) {
  if (!content) return html``;
  const parts = content.split(/(```[\s\S]*?```)/g);
  return html`<div>${parts.map(part => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const lines = part.slice(3, -3);
      const idx = lines.indexOf('\n');
      const code = idx > 0 ? lines.slice(idx + 1) : lines;
      return html`<pre><code>${code}</code></pre>`;
    }
    return html`<span dangerouslySetInnerHTML=${{ __html: renderInlineMarkdown(part) }}></span>`;
  })}</div>`;
}

export function renderInlineMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^### (.+)$/gm, '<h4 style="font-size:.85rem;font-weight:600;margin:.5rem 0 .25rem;color:var(--ac)">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:.9rem;font-weight:600;margin:.5rem 0 .25rem;color:var(--ac)">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="font-size:1rem;font-weight:700;margin:.5rem 0 .25rem">$1</h2>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n/g, '<br>');
}
