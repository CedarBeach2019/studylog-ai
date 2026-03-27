import { html, useState } from '../preact-shim.js';
import { MessageContent } from './message-content.js';
import { authState, addToast } from '../app.js';

function sendFeedback(interactionId, sentiment) {
  if (!interactionId) return;
  const token = sessionStorage.getItem('lo-token') || authState.value.token;
  fetch(`/v1/chat/interactions/${interactionId}/feedback`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ feedback: sentiment }),
  }).then(() => {
    addToast(sentiment === 'up' ? '👍 Thanks!' : '👎 Noted.');
  }).catch(() => {});
}

export function Message({ message }) {
  const { role, content, model, ts, interactionId } = message;
  const [feedbackSent, setFeedbackSent] = useState(null);
  const time = ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  if (role === 'system') {
    if (content === 'GUEST_LIMIT') {
      return html`
        <div class="message system guest-limit-prompt">
          <div class="guest-limit-icon">🔐</div>
          <div class="guest-limit-text">Free messages used up!</div>
          <div class="guest-limit-hint">Create a free account to keep chatting. Your messages are saved.</div>
          <button class="primary" style="margin-top:.5rem;padding:.4rem 1rem" onclick=${() => { authState.value = { isLoggedIn: false, token: null }; }}>Create Free Account</button>
        </div>
      `;
    }
    return html`<div class="message system">${content}</div>`;
  }

  const handleFeedback = (sentiment) => {
    if (feedbackSent) return;
    setFeedbackSent(sentiment);
    sendFeedback(interactionId, sentiment);
  };

  return html`
    <div class="message ${role}">
      <div class="message-bubble">
        <${MessageContent} content=${content} />
      </div>
      <div class="message-meta">
        ${time}
        ${model ? html`<span class="route-badge">${model.split('/').pop()}</span>` : null}
        ${role === 'assistant' ? html`
          <span class="feedback-btns">
            <button onclick=${() => handleFeedback('up')} class=${feedbackSent === 'up' ? 'active' : ''} title="Good">👍</button>
            <button onclick=${() => handleFeedback('down')} class=${feedbackSent === 'down' ? 'active' : ''} title="Bad">👎</button>
          </span>
        ` : null}
      </div>
    </div>
  `;
}
