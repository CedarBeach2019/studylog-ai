// ─── Flashcard — Preact+HTM component with 3D flip ──────────────────────
import { h, Component } from 'preact';
import { html } from 'htm/preact';

export class Flashcard extends Component {
  state = { flipped: false, showRatings: false };

  handleFlip = () => {
    const flipping = !this.state.flipped;
    this.setState({ flipped: flipping, showRatings: flipping });
  };

  handleRate = (rating) => {
    this.setState({ flipped: false, showRatings: false });
    if (this.props.onRate) {
      this.props.onRate({ cardId: this.props.card.id, rating });
    }
  };

  render() {
    const { card, index = 0, total = 1, due = 0, newCount = 0 } = this.props;
    if (!card) return null;
    const { flipped, showRatings } = this.state;

    const status = card.repetitions === 0 ? 'new' : (card.nextReview <= Date.now() ? 'due' : 'review');

    return html`
      <div>
        <div class="flashcard-counter">
          <span class="flashcard-indicator ${status}"></span>
          Card ${index + 1} of ${total}
          <span style="margin-left:12px">· Due: ${due} · New: ${newCount}</span>
        </div>

        <div class="flashcard-wrapper" onClick=${this.handleFlip}>
          <div class="flashcard ${flipped ? 'flipped' : ''}">
            <div class="flashcard-face flashcard-front">
              ${card.front}
              ${!flipped ? html`<div style="font-size:12px;margin-top:16px;opacity:0.7">Click to flip</div>` : ''}
            </div>
            <div class="flashcard-face flashcard-back">
              ${card.back}
              ${flipped ? html`<div style="font-size:12px;margin-top:16px;color:var(--study-text-muted)">
                Interval: ${card.interval}d · EF: ${card.easeFactor.toFixed(2)} · Reps: ${card.repetitions}
              </div>` : ''}
            </div>
          </div>
        </div>

        <div class="flashcard-rating ${showRatings ? 'visible' : ''}">
          <button class="rating-btn again" onClick=${(e) => { e.stopPropagation(); this.handleRate(1); }}>Again</button>
          <button class="rating-btn hard" onClick=${(e) => { e.stopPropagation(); this.handleRate(2); }}>Hard</button>
          <button class="rating-btn good" onClick=${(e) => { e.stopPropagation(); this.handleRate(3); }}>Good</button>
          <button class="rating-btn easy" onClick=${(e) => { e.stopPropagation(); this.handleRate(5); }}>Easy</button>
        </div>
      </div>
    `;
  }
}
