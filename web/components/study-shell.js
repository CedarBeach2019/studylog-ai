// ─── StudyShell — Main session shell with ActionRenderer, sidebar, input ─
import { h, Component } from 'preact';
import { html } from 'htm/preact';
import { SlideViewer } from './slide-viewer.js';
import { QuizCard } from './quiz-card.js';
import { Flashcard } from './flashcard.js';
import { Whiteboard } from './whiteboard.js';

function ActionRenderer({ action, quizAnswer, flashcardRate }) {
  if (!action) return null;
  const { type, payload } = action;

  switch (type) {
    case 'narration':
      return html`<div class="action-item"><div class="action-narration" dangerouslySetInnerHTML=${{ __html: simpleMd(payload.text || '') }}></div></div>`;

    case 'speech':
      return html`<div class="action-item">
        <div class="action-speech">
          <div class="speaker">${payload.character || 'Tutor'}</div>
          <div dangerouslySetInnerHTML=${{ __html: simpleMd(payload.text || '') }}></div>
        </div>
      </div>`;

    case 'slide':
      return html`<div class="action-item">
        <${SlideViewer} slides=${[{ title: payload.title, content: payload.content, total_slides: payload.total_slides }]}
          currentIndex=${payload.slide_number - 1} />
      </div>`;

    case 'quiz':
      return html`<div class="action-item">
        <${QuizCard} question=${payload} score=${0} streak=${0} onAnswer=${quizAnswer} />
      </div>`;

    case 'flashcard':
      return html`<div class="action-item">
        <${Flashcard} card=${{ id: payload.card_id, front: payload.front, back: payload.back, easeFactor: 2.5, interval: 0, repetitions: 0, nextReview: Date.now() }}
          index=${0} total=${1} due=${0} newCount=${0} onRate=${flashcardRate} />
      </div>`;

    case 'whiteboard':
      return html`<div class="action-item"><${Whiteboard} /></div>`;

    case 'progress':
      return html`<div class="action-item">
        <div class="action-progress">
          <span>${payload.label || 'Progress'}</span>
          <div class="action-progress-bar">
            <div class="action-progress-fill" style=${{ width: (payload.value * 100) + '%' }}></div>
          </div>
        </div>
      </div>`;

    case 'question':
      return html`<div class="action-item">
        <div class="action-narration" style="border-left:4px solid var(--study-purple)">
          <strong>❓ ${payload.prompt}</strong>
          ${payload.valid_answers ? html`
            <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
              ${payload.valid_answers.map(a => html`<button class="study-btn study-btn-secondary">${a}</button>`)}
            </div>
          ` : ''}
        </div>
      </div>`;

    default:
      return html`<div class="action-item"><div class="action-narration"><em>[${type}]</em></div></div>`;
  }
}

export class StudyShell extends Component {
  state = { message: '', notes: '' };

  handleSend = () => {
    if (!this.state.message.trim()) return;
    if (this.props.onSend) this.props.onSend(this.state.message);
    this.setState({ message: '' });
  };

  render() {
    const { session, actions = [], onSend, quizAnswer, flashcardRate } = this.props;
    const { message, notes } = this.state;

    return html`
      <div class="study-shell">
        <div class="study-sidebar">
          <h3>📚 Outline</h3>
          ${(session.objectives || []).map((obj, i) => html`
            <div key=${i} class="outline-item">
              <span style="font-size:12px;color:var(--study-text-muted)">Step ${i + 1}</span>
              <div>${obj.topic}</div>
            </div>
          `)}
          <h3>📝 Notes</h3>
          <div class="study-notes">
            <textarea placeholder="Take notes here..."
              value=${notes} onInput=${e => this.setState({ notes: e.target.value })}></textarea>
          </div>
        </div>

        <div class="study-main">
          <div class="study-content">
            ${session.phase ? html`
              <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center">
                <span class="study-btn study-btn-primary" style="font-size:12px;padding:4px 12px;cursor:default">${session.phase}</span>
                ${session.topic ? html`<span style="font-size:14px;color:var(--study-text-muted)">Studying: <strong>${session.topic}</strong></span>` : ''}
                <span style="margin-left:auto;font-size:12px;color:var(--study-text-muted)">Turn ${session.turnNumber || 0}</span>
              </div>
            ` : ''}

            ${actions.map((action, i) => html`
              <${ActionRenderer} key=${i} action=${action} quizAnswer=${quizAnswer} flashcardRate=${flashcardRate} />
            `)}
          </div>

          <div class="study-input-bar">
            <textarea placeholder="Ask a question, type your answer, or request a hint..."
              value=${message}
              onInput=${e => this.setState({ message: e.target.value })}
              onKeyDown=${e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSend(); } }}></textarea>
            <button class="study-btn study-btn-primary" onClick=${this.handleSend}>Send</button>
          </div>
        </div>
      </div>
    `;
  }
}

function simpleMd(text) {
  if (!text) return '';
  return text
    .replace(/## (.+)/g, '<h2 style="font-size:20px;font-weight:700;margin-bottom:8px">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:0.9em">$1</code>')
    .replace(/^- (.+)/gm, '<li>$1</li>')
    .replace(/\n/g, '<br>');
}
