// ─── QuizCard — Preact+HTM component ─────────────────────────────────────
import { h, Component } from 'preact';
import { html } from 'htm/preact';

export class QuizCard extends Component {
  state = { selected: null, answered: false, shortAnswer: '', timeLeft: null };

  componentDidMount() {
    const { time_limit_ms } = this.props.question || {};
    if (time_limit_ms) {
      this.setState({ timeLeft: Math.ceil(time_limit_ms / 1000) });
      this._timer = setInterval(() => {
        this.setState(prev => {
          if (prev.timeLeft <= 1) {
            clearInterval(this._timer);
            return { timeLeft: 0, answered: true };
          }
          return { timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
  }

  componentWillUnmount() {
    clearInterval(this._timer);
  }

  handleOptionClick = (label) => {
    if (this.state.answered) return;
    this.setState({ selected: label, answered: true });
    const { question } = this.props;
    const correct = (question.correct_answer || []).includes(label);
    if (this.props.onAnswer) {
      this.props.onAnswer({ label, correct, questionId: question.id });
    }
  };

  handleSubmitShort = () => {
    if (!this.state.shortAnswer.trim() || this.state.answered) return;
    const { question } = this.props;
    const correct = (question.correct_answer || []).map(a => a.toLowerCase()).includes(this.state.shortAnswer.trim().toLowerCase());
    this.setState({ answered: true, selected: correct ? this.state.shortAnswer : null });
    if (this.props.onAnswer) {
      this.props.onAnswer({ label: this.state.shortAnswer, correct, questionId: question.id });
    }
  };

  render() {
    const { question, score = 0, streak = 0 } = this.props;
    const { selected, answered, shortAnswer, timeLeft } = this.state;
    if (!question) return html`<div class="quiz-card"><p>No question</p></div>`;

    const correctAnswers = question.correct_answer || [];
    const isCorrect = answered && selected && correctAnswers.includes(selected);

    return html`
      <div class="quiz-card">
        <div class="quiz-score-bar">
          <span>Score: <strong>${score}</strong></span>
          ${streak > 0 ? html`<span class="streak">🔥 ${streak} streak</span>` : ''}
        </div>

        <div class="quiz-question">${question.question}</div>

        ${timeLeft !== null ? html`
          <div class="quiz-timer ${timeLeft <= 5 ? 'warning' : ''}">
            ⏱ ${timeLeft}s remaining
          </div>
        ` : ''}

        ${question.type === 'short_answer' ? html`
          <input class="quiz-short-answer" type="text" placeholder="Type your answer..."
            value=${shortAnswer} disabled=${answered}
            onInput=${e => this.setState({ shortAnswer: e.target.value })}
            onKeyDown=${e => e.key === 'Enter' && this.handleSubmitShort()} />
          <div style="margin-top:12px">
            <button class="study-btn study-btn-primary" disabled=${answered || !shortAnswer.trim()}
              onClick=${this.handleSubmitShort}>Submit</button>
          </div>
        ` : (question.options || []).map(opt => html`
          <button key=${opt.label} class="quiz-option ${answered ? (correctAnswers.includes(opt.label) ? 'correct' : (selected === opt.label && !correctAnswers.includes(opt.label) ? 'incorrect' : '')) : ''}"
            disabled=${answered} onClick=${() => this.handleOptionClick(opt.label)}>
            <strong>${opt.label}.</strong> ${opt.text}
          </button>
        `)}

        ${answered ? html`
          <div class="quiz-feedback ${isCorrect ? 'correct' : 'incorrect'}">
            ${isCorrect ? html`✅ <strong>Correct!</strong>` : html`❌ <strong>Incorrect.</strong>`}
            ${question.analysis ? html`<p style="margin-top:8px">${question.analysis}</p>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }
}
