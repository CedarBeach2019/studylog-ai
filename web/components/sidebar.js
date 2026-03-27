import { html, useState, useEffect } from '../preact-shim.js';
import { sidebarOpen, sessionUpdated, loadSessionSignal, addToast } from '../app.js';

export function Sidebar() {
  const [sessionList, setSessionList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recap, setRecap] = useState(null);
  const [recapId, setRecapId] = useState(null);
  const [activeId, setActiveId] = useState(null);

  const getToken = () => sessionStorage.getItem('lo-token');

  const fetchSessions = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch('/v1/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setSessionList(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, [sessionUpdated.value]);

  const handleNewSession = () => {
    setActiveId(null);
    loadSessionSignal.value = null;
    addToast('New conversation started');
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this session?')) return;
    try {
      const res = await fetch(`/v1/sessions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        setSessionList(prev => prev.filter(s => s.id !== id));
        if (activeId === id) { setActiveId(null); loadSessionSignal.value = null; }
        addToast('Session deleted');
      }
    } catch {}
  };

  const handleRecap = async (id, e) => {
    e.stopPropagation();
    if (recapId === id) { setRecap(null); setRecapId(null); return; }
    setRecapId(id);
    setRecap('Generating recap...');
    try {
      const res = await fetch(`/v1/sessions/${id}/recap`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setRecap(data.recap || data.summary || 'No recap available.');
    } catch {
      setRecap('Failed to load recap.');
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const diffMins = Math.floor((Date.now() - new Date(ts)) / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d`;
    return new Date(ts).toLocaleDateString();
  };

  const truncate = (str, len = 45) => str && str.length > len ? str.slice(0, len) + '…' : str || '';

  return html`
    <div class="sidebar ${sidebarOpen.value ? '' : 'collapsed'}">
      <div class="sidebar-header">
        <h2>📋 History</h2>
        <button class="icon-btn" onclick=${() => sidebarOpen.value = false} title="Close sidebar">✕</button>
      </div>
      <div class="session-list">
        ${loading ? html`
          <div class="session-loading"><span class="spinner"></span> Loading...</div>
        ` : sessionList.length === 0 ? html`
          <div class="session-empty">
            <div class="session-empty-icon">📖</div>
            <div>No campaigns yet</div>
            <div class="session-empty-hint">Start chatting to begin your adventure</div>
          </div>
        ` : sessionList.map(s => html`
          <div class="session-item ${activeId === s.id ? 'active' : ''}"
               onclick=${() => { setActiveId(s.id); loadSessionSignal.value = s.id; if (window.innerWidth < 768) sidebarOpen.value = false; }}>
            <div class="session-title">${truncate(s.summary || s.last_message || s.first_message)}</div>
            <div class="session-meta">
              <span class="session-msg-count">${s.message_count || 0} msgs</span>
              <span class="session-time">${formatTime(s.lastMessageAt)}</span>
            </div>
            ${recapId === s.id && recap ? html`<div class="session-recap">${recap}</div>` : null}
            <div class="session-actions">
              <button class="action-btn" onclick=${(e) => handleRecap(s.id, e)} title="Recap">📝</button>
              <button class="action-btn delete" onclick=${(e) => handleDelete(s.id, e)} title="Delete">🗑</button>
            </div>
          </div>
        `)
        }
      </div>
      <div class="sidebar-footer">
        <button class="primary sidebar-new-btn" onclick=${handleNewSession}>+ New Chat</button>
      </div>
    </div>
  `;
}
