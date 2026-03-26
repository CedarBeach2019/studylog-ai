// ─── SlideViewer — Preact+HTM component ──────────────────────────────────
import { h, Component } from 'preact';
import { html } from 'htm/preact';

export class SlideViewer extends Component {
  render() {
    const { slides = [], currentIndex = 0, onSlideChange } = this.props;
    const slide = slides[currentIndex] || { title: '', content: '', total_slides: 1 };
    const total = slides.length || slide.total_slides || 1;
    const progress = total > 1 ? ((currentIndex + 1) / total) * 100 : 100;

    return html`
      <div class="slide-container">
        <div class="slide-title">${slide.title}</div>
        <div class="slide-content" dangerouslySetInnerHTML=${{ __html: renderMarkdown(slide.content || '') }}></div>
        <div class="slide-progress">
          <div class="slide-progress-bar" style=${{ width: progress + '%' }}></div>
        </div>
        <div class="slide-nav">
          <button class="study-btn study-btn-secondary" disabled=${currentIndex === 0}
            onClick=${() => onSlideChange && onSlideChange(currentIndex - 1)}>← Previous</button>
          <span style="font-size:14px;color:var(--study-text-muted)">${currentIndex + 1} / ${total}</span>
          <button class="study-btn study-btn-secondary" disabled=${currentIndex >= total - 1}
            onClick=${() => onSlideChange && onSlideChange(currentIndex + 1)}>Next →</button>
        </div>
      </div>
    `;
  }
}

function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:0.9em">$1</code>')
    .replace(/\n/g, '<br>');
}
