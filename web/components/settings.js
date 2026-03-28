import { html, useState, useEffect } from '../preact-shim.js';
import { settingsOpen, theme, addToast, getToken } from '../app.js';

// Save preferences to backend
async function savePrefs(obj) {
  try {
    const token = getToken();
    if (!token) return;
    await fetch('/v1/preferences', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(obj),
    });
  } catch { /* silent */ }
}

// Load preferences from backend
async function loadPrefs(setPrivacy, setStream) {
  try {
    const token = getToken();
    if (!token) return;
    const res = await fetch('/v1/preferences', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.pii === 'boolean') setPrivacy(data.pii);
    if (typeof data.streaming === 'boolean') setStream(data.streaming);
    if (data.theme === 'dark' || data.theme === 'light') theme.value = data.theme;
  } catch { /* silent */ }
}

export function Settings() {
  const [tab, setTab] = useState('providers');
  const [providers, setProviders] = useState([
    { id: 'deepseek', name: 'DeepSeek', model: 'deepseek-chat', status: 'active' },
  ]);
  const [privacyMode, setPrivacyMode] = useState(true);
  const [streaming, setStreaming] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Load from backend on first open
  useEffect(() => {
    if (!loaded) {
      setLoaded(true);
      loadPrefs(setPrivacyMode, setStreaming);
    }
  }, [settingsOpen.value]);

  const tabs = [
    { id: 'providers', label: '🤖 Models', icon: '🤖' },
    { id: 'preferences', label: '⚙️ Preferences', icon: '⚙️' },
    { id: 'about', label: 'ℹ️ About', icon: 'ℹ️' },
  ];

  return html`
    <div class="settings-backdrop ${settingsOpen.value ? 'open' : ''}" onclick=${() => settingsOpen.value = false}></div>
    <div class="settings-overlay ${settingsOpen.value ? 'open' : ''}">
      <div class="settings-header">
        <h2>⚙️ Settings</h2>
        <button class="icon-btn" onclick=${() => settingsOpen.value = false}>✕</button>
      </div>
      <div class="settings-tabs">
        ${tabs.map(t => html`
          <button class=${tab === t.id ? 'active' : ''} onclick=${() => setTab(t.id)}>
            ${t.label}
          </button>
        `)}
      </div>
      <div class="settings-body">
        ${tab === 'providers' && html`
          <div class="settings-section">
            <h3>Active AI Models</h3>
            <p class="settings-desc">Your AI tutor uses these models to help with learning. Models are automatically selected based on your query type.</p>
            ${providers.map(p => html`
              <div class="provider-item">
                <div>
                  <div class="name">${p.name}</div>
                  <div class="model">${p.model}</div>
                </div>
                <div class="provider-status">
                  <span class="status-dot ${p.status}"></span>
                </div>
              </div>
            `)}
            <div class="settings-note">
              💡 The routing engine picks the best model for each task — explanations, practice problems, study planning, and concept review.
            </div>
          </div>
        `}
        ${tab === 'preferences' && html`
          <div class="settings-section">
            <h3>Learning Preferences</h3>
            <div class="toggle-row">
              <div>
                <div>Stream responses</div>
                <div class="toggle-desc">See explanations appear word by word</div>
              </div>
              <button class="toggle ${streaming ? 'on' : ''}" onclick=${() => { const v = !streaming; setStreaming(v); savePrefs({ streaming: v }); }}></button>
            </div>
            <div class="toggle-row">
              <div>
                <div>PII protection</div>
                <div class="toggle-desc">Encrypt personal info in your messages</div>
              </div>
              <button class="toggle ${privacyMode ? 'on' : ''}" onclick=${() => { const v = !privacyMode; setPrivacyMode(v); savePrefs({ pii: v }); }}></button>
            </div>
          </div>
          <div class="settings-section">
            <h3>Theme</h3>
            <div class="toggle-row">
              <div>
                <div>Dark mode</div>
                <div class="toggle-desc">${theme.value === 'dark' ? 'Currently active' : 'Currently off'}</div>
              </div>
              <button class="toggle ${theme.value === 'dark' ? 'on' : ''}"
                onclick=${() => { const v = theme.value === 'dark' ? 'light' : 'dark'; theme.value = v; savePrefs({ theme: v }); }}></button>
            </div>
          </div>
          <div class="settings-section">
            <h3>Keyboard Shortcuts</h3>
            <div class="shortcut-list">
              <div class="shortcut"><kbd>Enter</kbd> Send message</div>
              <div class="shortcut"><kbd>Shift+Enter</kbd> New line</div>
              <div class="shortcut"><kbd>Ctrl+B</kbd> Toggle sidebar</div>
              <div class="shortcut"><kbd>Esc</kbd> Close panels</div>
            </div>
          </div>
        `}
        ${tab === 'about' && html`
          <div class="settings-section">
            <h3>StudyLog.ai</h3>
            <p class="settings-desc">
              Your AI study companion remembers everything. Every concept, every practice problem, every breakthrough moment — stored securely and used to make each study session better.
            </p>
            <div class="about-links">
              <a href="https://github.com/CedarBeach2019/studylog-ai" target="_blank" rel="noopener">📖 Source Code</a>
              <a href="https://github.com/CedarBeach2019/log-origin" target="_blank" rel="noopener">🔧 Core Engine (log-origin)</a>
            </div>
          </div>
          <div class="settings-section">
            <h3>Technology</h3>
            <div class="tech-list">
              <span class="tech-badge">Cloudflare Workers</span>
              <span class="tech-badge">D1 Database</span>
              <span class="tech-badge">DeepSeek AI</span>
              <span class="tech-badge">Preact + HTM</span>
              <span class="tech-badge">TypeScript</span>
              <span class="tech-badge">PBKDF2 Encryption</span>
            </div>
          </div>
          <div class="settings-section">
            <p class="settings-desc" style="font-size:.7rem;color:var(--t3)">
              v0.1.0 · Free forever · Open source · Your data, your rules.
            </p>
          </div>
        `}
      </div>
    </div>
  `;
}
