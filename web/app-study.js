// ─── app-study.js — Study entry: SSE connection, state management, shortcuts
import { h, render, Component } from 'preact';
import { html } from 'htm/preact';
import { StudyShell } from './components/study-shell.js';

// Import CSS
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = '/study.css';
document.head.appendChild(link);

class StudyApp extends Component {
  state = {
    session: { phase: 'SETUP', topic: '', objectives: [], turnNumber: 0 },
    actions: [],
    sessionId: null,
    connected: false,
    loading: true,
  };

  source = null;

  componentDidMount() {
    // Keyboard shortcuts
    this._keyHandler = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.key === 'n') this.focusInput();
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this._keyHandler);
    if (this.source) this.source.close();
  }

  focusInput = () => {
    const ta = document.querySelector('.study-input-bar textarea');
    if (ta) ta.focus();
  };

  close = () => {
    if (this.source) this.source.close();
    this.setState({ connected: false });
  };

  startSession = async (topic) => {
    this.setState({ loading: true });
    try {
      const res = await fetch('/api/study/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      this.setState({
        sessionId: data.sessionId,
        session: { ...this.state.session, phase: data.phase, topic: data.topic, objectives: data.objectives || [] },
        actions: [{ type: 'narration', payload: { text: `Session started! Let's study **${topic}**. Here are your learning objectives:` } }],
        loading: false,
      });
      this.connectSSE(data.sessionId);
    } catch (err) {
      this.setState({ loading: false, actions: [{ type: 'narration', payload: { text: `Error: ${err.message}` } }] });
    }
  };

  connectSSE = (sessionId) => {
    if (this.source) this.source.close();
    this.source = new EventSource(`/api/study/stream?sessionId=${sessionId}`);

    this.source.addEventListener('session_meta', (e) => {
      this.setState({ connected: true });
    });

    this.source.addEventListener('action', (e) => {
      try {
        const action = JSON.parse(e.data);
        this.setState(prev => ({ actions: [...prev.actions, action] }));
      } catch {}
    });

    this.source.addEventListener('session_end', () => {
      this.setState({ connected: false });
      this.source.close();
    });

    this.source.onerror = () => {
      this.setState({ connected: false });
    };
  };

  handleSend = async (message) => {
    const { sessionId } = this.state;
    if (!sessionId) return;

    this.setState(prev => ({
      actions: [...prev.actions, { type: 'speech', payload: { character: 'You', text: message } }],
    }));

    try {
      const res = await fetch('/api/study/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message }),
      });
      const data = await res.json();

      this.setState(prev => ({
        session: { ...prev.session, phase: data.phase, turnNumber: data.turnNumber },
        actions: [...prev.actions, {
          type: 'narration',
          payload: { text: `**[${data.agentId}]** ${data.instructions}` },
        }],
      }));
    } catch (err) {
      this.setState(prev => ({
        actions: [...prev.actions, { type: 'narration', payload: { text: `Error: ${err.message}` } }],
      }));
    }
  };

  quizAnswer = async (answer) => {
    const { sessionId } = this.state;
    if (!sessionId) return;

    try {
      await fetch('/api/study/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionId: answer.questionId,
          answer: answer.label,
          correct: answer.correct,
          points: 10,
          topicTag: 'general',
        }),
      });
    } catch {}
  };

  flashcardRate = async ({ cardId, rating }) => {
    const { sessionId } = this.state;
    if (!sessionId) return;

    try {
      await fetch('/api/study/flashcard/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, cardId, rating }),
      });
    } catch {}
  };

  render() {
    const { session, actions, sessionId, loading } = this.state;

    if (!sessionId) {
      return html`
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:var(--study-bg)">
          <div style="text-align:center;max-width:500px;padding:32px">
            <h1 style="font-size:32px;color:var(--study-blue-dark);margin-bottom:8px">StudyLog.ai</h1>
            <p style="color:var(--study-text-muted);margin-bottom:32px">Interactive learning with AI tutors</p>
            <div style="display:flex;gap:8px">
              <input id="topic-input" type="text" placeholder="What do you want to study?"
                style="flex:1;padding:12px 16px;border:2px solid var(--study-border);border-radius:8px;font-size:16px;outline:none"
                onKeyDown=${e => e.key === 'Enter' && this.startSession(e.target.value)} />
              <button class="study-btn study-btn-primary" style="padding:12px 24px"
                onClick=${() => {
                  const input = document.getElementById('topic-input');
                  if (input?.value) this.startSession(input.value);
                }}>Start</button>
            </div>
          </div>
        </div>
      `;
    }

    return html`
      <${StudyShell}
        session=${session}
        actions=${actions}
        onSend=${this.handleSend}
        quizAnswer=${this.quizAnswer}
        flashcardRate=${this.flashcardRate}
      />
      <div style="position:fixed;bottom:8px;right:8px;font-size:11px;color:var(--study-text-muted)">
        ${this.state.connected ? '🟢 Connected' : '⚪ Disconnected'}
        · <kbd style="background:var(--study-border);padding:1px 4px;border-radius:3px">N</kbd> focus · <kbd style="background:var(--study-border);padding:1px 4px;border-radius:3px">Esc</kbd> close
      </div>
    `;
  }
}

render(html`<${StudyApp} />`, document.getElementById('app'));
