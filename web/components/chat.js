import { html, useState, useRef, useEffect } from '../preact-shim.js';
import { Message } from './message.js';
import { MessageContent } from './message-content.js';
import { DraftPanel } from './draft-panel.js';
import { DiceRoller, rollResults } from './dice-roller.js';
import { CharacterStats } from './character-stats.js';
import { authState, theme, sidebarOpen, currentSessionId, sessionUpdated, loadSessionSignal, settingsOpen, analyticsOpen, addToast, getToken } from '../app.js';

export function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [draftMode, setDraftMode] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [showDice, setShowDice] = useState(false);
  const listRef = useRef(null);
  const textareaRef = useRef(null);


  // Watch for session load requests from sidebar
  useEffect(() => {
    const id = loadSessionSignal.value;
    if (id && id !== activeSessionId) {
      setActiveSessionId(id);
      currentSessionId.value = id;
      loadSession(id);
    }
  }, [loadSessionSignal.value]);

  const loadSession = async (sessionId) => {
    setLoadingSession(true);
    setMessages([]);
    try {
      const res = await fetch(`/v1/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages.map(m => ({
          role: m.role,
          content: m.content,
          interactionId: m.id,
          ts: m.createdAt,
        })));
      }
    } catch (err) {
      addToast(`Failed to load session: ${err.message}`, 'error');
    } finally {
      setLoadingSession(false);
    }
  };

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, streamingContent]);

  const handleInput = (e) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  };

  const ensureSession = async () => {
    if (activeSessionId) return activeSessionId;
    const token = getToken();
    if (!token) return null;
    try {
      const res = await fetch('/v1/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ summary: '' }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const sid = data.id;
      setActiveSessionId(sid);
      currentSessionId.value = sid;
      return sid;
    } catch {
      return null;
    }
  };

  const streamResponse = async (endpoint, body) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let errMsg = `HTTP ${res.status}`;
      try { const errJson = JSON.parse(errText); errMsg = errJson.error?.message || errMsg; } catch {}
      throw new Error(errMsg);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '', model = '', interactionId = '', routeAction = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) full += delta.content;
          if (parsed.model) model = parsed.model;
          if (parsed.id) interactionId = parsed.id.replace('chatcmpl-', '');
          if (parsed._meta?.classification?.action) routeAction = parsed._meta.classification.action;
          setStreamingContent(full);
        } catch {}
      }
    }
    return { content: full, model, interactionId, routeAction };
  };

  const sendMessage = async (text) => {
    if (!text.trim() || isStreaming) return;
    const userMsg = { role: 'user', content: text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsStreaming(true);
    setStreamingContent('');
    try {
      const sid = await ensureSession();
      const chatMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const body = { messages: chatMessages, stream: true };
      if (sid) body.session_id = sid;
      // Inject character context from quickstart (send once, then clear)
      try {
        const charStr = sessionStorage.getItem('lo-character');
        if (charStr) { body.character = JSON.parse(charStr); sessionStorage.removeItem('lo-character'); }
      } catch {}
      const result = await streamResponse('/v1/chat/completions', body);
      sessionUpdated.value++;
      setMessages(prev => [...prev, {
        role: 'assistant', content: result.content, model: result.model,
        interactionId: result.interactionId, routeAction: result.routeAction, ts: Date.now(),
      }]);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('Guest limit') || msg.includes('guest_limit')) {
        // Guest limit reached — prompt to sign up
        setMessages(prev => [...prev, {
          role: 'system', content: 'GUEST_LIMIT', ts: Date.now(),
        }]);
        authState.value = { isLoggedIn: false, token: null };
      } else {
        addToast(msg, 'error');
        setMessages(prev => [...prev, { role: 'system', content: `Error: ${msg}`, ts: Date.now() }]);
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    currentSessionId.value = null;
    setMessages([]);
    setDrafts([]);
    setDraftMode(false);
    setInput('');
  };

  const handleLogout = () => {
    localStorage.removeItem('lo-token');
    localStorage.removeItem('lo-userid');
    sessionStorage.removeItem('lo-token');
    sessionStorage.removeItem('lo-guest');
    sessionStorage.removeItem('lo-character');
    sessionStorage.removeItem('lo-session');
    authState.value = { isLoggedIn: false, token: null, userId: null };
    addToast('Signed out');
  };

  const sendDraft = async (text) => {
    if (!text.trim()) return;
    setDraftMode(true);
    setDrafts([]);
    const userMsg = { role: 'user', content: text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    const token = getToken();
    try {
      const sid = await ensureSession();
      const chatMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/v1/drafts/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: chatMessages, session_id: sid, max_tokens: 500 }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        let errMsg = `HTTP ${res.status}`;
        try { errMsg = JSON.parse(errText).error?.message || errMsg; } catch {}
        throw new Error(errMsg);
      }
      const data = await res.json();
      setDrafts(data.drafts || []);
    } catch (err) {
      addToast(err.message, 'error');
      setDraftMode(false);
    }
  };

  const pickDraft = (idx) => {
    const draft = drafts[idx];
    if (!draft) return;
    setMessages(prev => [...prev, {
      role: 'assistant', content: draft.content, model: draft.model,
      interactionId: draft.id, routeAction: draft.profile, ts: Date.now(),
    }]);
    // Record winner for routing optimization
    const token = getToken();
    fetch(`/v1/drafts/winner/${draft.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ profile: draft.profile }),
    }).catch(() => {});
    setDraftMode(false);
    setDrafts([]);
  };

  return html`
    <div class="chat-area">
      <div class="chat-header">
        <button onclick=${() => sidebarOpen.value = !sidebarOpen.value}>☰</button>
        <div class="chat-title">${activeSessionId ? '📚 Study Session' : '📚 StudyLog.ai'}</div>
        <div class="actions">
          <button onclick=${() => setShowDice(!showDice)} title="Dice roller" class="icon-btn">🎲</button>
          <button onclick=${() => setDraftMode(!draftMode)} title="Compare responses" class="icon-btn">${draftMode ? '✕' : '🎯'}</button>
          <button onclick=${() => analyticsOpen.value = true} title="Analytics" class="icon-btn">📊</button>
          <button onclick=${handleNewChat} title="New session" class="icon-btn">+ New</button>
          <button onclick=${() => theme.value = theme.value === 'dark' ? 'light' : 'dark'} class="icon-btn">${theme.value === 'dark' ? '☀️' : '🌙'}</button>
          <button onclick=${() => settingsOpen.value = true} class="icon-btn">⚙</button>
          <button onclick=${handleLogout} title="Sign out" class="icon-btn">🚪</button>
        </div>
      </div>
      <${CharacterStats} />
      ${draftMode && drafts.length > 0 ? html`
        <${DraftPanel} drafts=${drafts} onPick=${pickDraft} onClose=${() => setDraftMode(false)} />
      ` : html`
        <div class="message-list" ref=${listRef}>
          ${loadingSession ? html`<div class="empty-state"><span class="spinner" style="font-size:1.5rem;width:24px;height:24px"></span><div class="empty-hint" style="margin-top:.75rem">Loading campaign...</div></div>` :
            messages.length === 0 ? html`
              <div class="empty-state">
                <div class="empty-icon">📚</div>
                <div class="empty-title">What would you like to learn?</div>
                <div class="empty-hint">Ask questions, explore topics, or get help with your studies.</div>
                <div class="empty-prompts">
                  <button class="prompt-chip" onclick=${() => setInput('Explain a concept in simple terms')}>📝 Explain a concept</button>
                  <button class="prompt-chip" onclick=${() => setInput('Give me some practice problems to solve')}>🧪 Practice problems</button>
                  <button class="prompt-chip" onclick=${() => setInput('Create a study guide for this topic')}>📖 Study guide</button>
                  <button class="prompt-chip" onclick=${() => setInput('What are some effective study tips?')}>💡 Study tips</button>
                </div>
              </div>
            ` :
            messages.map((m, i) => html`<${Message} key=${i} message=${m} />`)
          }
          ${isStreaming && !streamingContent ? html`
            <div class="message assistant">
              <div class="message-bubble">
                <div class="typing-indicator">
                  <div class="typing-dots"><span></span><span></span><span></span></div>
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          ` : null}
          ${isStreaming && streamingContent ? html`
            <div class="message assistant">
              <div class="message-bubble">
                <${MessageContent} content=${streamingContent} />
                <span class="streaming-cursor"></span>
              </div>
            </div>
          ` : null}
        </div>
      `}
      <div class="input-area">
        ${showDice && html`<div class="dice-roller-popup"><${DiceRoller} /></div>`}
        <div class="input-row">
          <textarea ref=${textareaRef} placeholder="Type a message… (Enter to send)"
            value=${input} onInput=${handleInput} onKeyDown=${handleKeyDown}
            disabled=${isStreaming} rows="1" />
          <button class="primary" onclick=${() => draftMode ? sendDraft(input) : sendMessage(input)}
            disabled=${isStreaming || !input.trim()}>
            ${isStreaming ? html`<span class="spinner"></span>` : '➤'}
          </button>
        </div>
      </div>
    </div>
  `;
}
