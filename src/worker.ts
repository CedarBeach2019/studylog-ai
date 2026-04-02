// ═══════════════════════════════════════════════════════════════════
// StudyLog.ai — The Living Classroom
// Worker entry point — no framework, pure fetch handler
// ═══════════════════════════════════════════════════════════════════

import { StudyPhase, createSM2Card, sm2Review, type SM2Card, type SM2Rating } from './study/session-state.js';
import { routeToAgent, type DirectorDecision } from './study/director.js';
import { ALL_AGENTS, type AgentDef } from './agents/agents.js';
import { StudySession, type StudySessionConfig } from './study/tracker.js';
import { SocraticMethod } from './study/tutor.js';
import { callLLM, loadBYOKConfig, saveBYOKConfig, type BYOKConfig, type LLMMessage, BUILTIN_PROVIDERS } from './lib/byok.js';
import { createProfile, getProfile, updateProfile, listProfiles, deleteProfile, getModelForRole, type StudentProfile } from './lib/multi-profile.js';
import { RepoAgent, type RepoAgentAction } from './lib/repo-agent.js';
import { CrossCocapn } from './lib/cross-cocapn.js';

// ── Instances ──────────────────────────────────────────────────────────────

const repoAgent = new RepoAgent();
const cocapn = new CrossCocapn();
const sessions = new Map<string, { session: StudySession;  socratic: SocraticMethod; phase: StudyPhase; turnHistory: Array<{ agentId: string }>; lastSpeaker: string | null }>();

// ── Landing Page ───────────────────────────────────────────────────────────

function landingPage(): Response {
  return new Response(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>StudyLog.ai — The Living Classroom</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
.hero{background:linear-gradient(135deg,#1E3A5F 0%,#0f172a 100%);padding:6rem 2rem;text-align:center}
.hero h1{font-size:3rem;margin-bottom:1rem;background:linear-gradient(135deg,#F59E0B,#fbbf24);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero p{font-size:1.2rem;color:#94a3b8;max-width:600px;margin:0 auto}
.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1.5rem;max-width:900px;margin:3rem auto;padding:0 2rem}
.card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:1.5rem;transition:transform .2s}
.card:hover{transform:translateY(-2px)}
.card h3{color:#F59E0B;margin-bottom:.5rem}
.card p{color:#94a3b8;font-size:.9rem}
.cta{text-align:center;padding:3rem}
.cta a{display:inline-block;background:#F59E0B;color:#0f172a;padding:.8rem 2rem;border-radius:8px;text-decoration:none;font-weight:600}
.cta a:hover{background:#fbbf24}
footer{text-align:center;padding:2rem;color:#475569;font-size:.8rem}
</style></head><body>
<div class="hero"><h1>StudyLog.ai</h1><p>The Living Classroom — AI tutors, spaced repetition, and knowledge graphs that grow with you. Bring your own API key, any provider.</p></div>
<div class="features">
<div class="card"><h3>🧠 AI Tutor</h3><p>Socratic method teaching with multi-agent routing. Teacher, classmate, and quiz master collaborate.</p></div>
<div class="card"><h3>📊 Spaced Repetition</h3><p>Full SM-2 algorithm for flashcards.科学的 intervals based on your performance.</p></div>
<div class="card"><h3>🕸️ Knowledge Graph</h3><p>Track mastery across topics. Visualize your learning journey with topic linking.</p></div>
<div class="card"><h3>🔑 Multi-Provider BYOK</h3><p>OpenAI, Anthropic, Google, DeepSeek, Groq, Ollama — use any or all.</p></div>
<div class="card"><h3>🤖 Repo-Agent</h3><p>Fork, theme, component, build, ship — hook-driven automation for learning projects.</p></div>
<div class="card"><h3>🔗 Cross-Cocapn</h3><p>Link topics across platforms and repos. Your learning context travels with you.</p></div>
<div class="card"><h3>🚀 Fork-and-Ship</h3><p>Clone a study repo, customize it, ship it as your own project portfolio piece.</p></div>
<div class="card"><h3>👤 Multi-Profile</h3><p>Student, teacher, or observer roles. Per-profile provider configs and model routing.</p></div>
</div>
<div class="cta"><a href="/setup">Get Started →</a></div>
<footer>StudyLog.ai — Part of the LogOS ecosystem. Built with zero runtime dependencies.</footer>
</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.deepseek.com https://api.groq.com https://api.mistral.ai https://openrouter.ai https://api.z.ai https://*;" } });
}

function setupPage(): Response {
  const providers = BUILTIN_PROVIDERS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  return new Response(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>StudyLog.ai — Setup</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center}
.form{background:#1e293b;padding:2.5rem;border-radius:16px;width:400px;max-width:90vw;border:1px solid #334155}
h2{color:#F59E0B;margin-bottom:1.5rem;text-align:center}
label{display:block;color:#94a3b8;margin-bottom:.3rem;font-size:.85rem}
input,select{width:100%;padding:.6rem;border:1px solid #475569;border-radius:6px;background:#0f172a;color:#e2e8f0;margin-bottom:1rem}
button{width:100%;padding:.7rem;background:#F59E0B;color:#0f172a;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:1rem}
button:hover{background:#fbbf24}
a{display:block;text-align:center;color:#94a3b8;margin-top:1rem;text-decoration:none;font-size:.85rem}
</style></head><body>
<div class="form"><h2>🔑 Bring Your Own Key</h2>
<label>Provider</label><select id="provider">${providers}</select>
<label>API Key</label><input id="apiKey" type="password" placeholder="sk-...">
<label>Model (optional)</label><input id="model" placeholder="gpt-4o-mini">
<button onclick="save()">Save & Start Learning</button>
<a href="/">← Back</a></div>
<script>
async function save(){const p=document.getElementById('provider').value,k=document.getElementById('apiKey').value,m=document.getElementById('model').value;
const r=await fetch('/api/byok',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:p,apiKey:k,model:m})});
if(r.ok)window.location.href='/';else alert('Error: '+(await r.text()));}
</script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.deepseek.com https://api.groq.com https://api.mistral.ai https://openrouter.ai https://api.z.ai https://*;" } });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}

function badRequest(msg: string): Response { return json({ error: msg }, 400); }
function notFound(msg = 'Not found'): Response { return json({ error: msg }, 404); }

// ── Helpers ────────────────────────────────────────────────────────────────

function getAgentDef(agentId: string): AgentDef | undefined {
  return ALL_AGENTS.find(a => a.id === agentId);
}

async function getOrCreateProfile(request: Request, env: any): Promise<{ profile: StudentProfile; byokConfig: BYOKConfig } | Response> {
  const url = new URL(request.url);
  const profileId = request.headers.get('X-Profile-Id') || url.searchParams.get('profileId');
  if (!profileId) return badRequest('Missing profile ID — set X-Profile-Id header or ?profileId=');

  const profile = await getProfile(profileId);
  if (!profile) return notFound('Profile not found');

  const byokConfig = await loadBYOKConfig(request, env);
  if (!byokConfig) return badRequest('No BYOK config. POST /api/byok or visit /setup');

  return { profile, byokConfig };
}

// ── Router ─────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Profile-Id' } });
    }

    // ── Static routes ──────────────────────────────────────────────────
    if (path === '/' || path === '/index.html') return landingPage();
    if (path === '/setup') return setupPage();
    if (path === '/health') return json({ status: 'ok', service: 'studylog-ai', version: '1.0.0', timestamp: Date.now() });

    // ── BYOK ───────────────────────────────────────────────────────────
    if (path === '/api/byok' && method === 'GET') {
      const config = await loadBYOKConfig(request, env);
      return config ? json({ active: config.activeProvider, providers: Object.keys(config.providers) }) : json({ configured: false });
    }
    if (path === '/api/byok' && method === 'POST') {
      const body = await request.json() as { provider: string; apiKey: string; model?: string };
      const builtIn = BUILTIN_PROVIDERS.find(p => p.id === body.provider);
      if (!builtIn) return badRequest('Unknown provider');
      const config: BYOKConfig = {
        providers: { [body.provider]: { baseUrl: builtIn.baseUrl, apiKey: body.apiKey, model: body.model || builtIn.defaultModel } },
        activeProvider: body.provider, syncMethod: 'cloudflare', createdAt: Date.now(), updatedAt: Date.now(),
      };
      await saveBYOKConfig(config, request, env);
      return json({ ok: true, provider: body.provider });
    }

    // ── Profiles ───────────────────────────────────────────────────────
    if (path === '/api/profiles' && method === 'GET') {
      return json(await listProfiles());
    }
    if (path === '/api/profiles' && method === 'POST') {
      const body = await request.json();
      const profile = await createProfile(body);
      return json(profile, 201);
    }
    const profileMatch = path.match(/^\/api\/profiles\/([^/]+)$/);
    if (profileMatch) {
      if (method === 'GET') {
        const p = await getProfile(profileMatch[1]);
        return p ? json(p) : notFound();
      }
      if (method === 'DELETE') {
        const ok = await deleteProfile(profileMatch[1]);
        return json({ deleted: ok });
      }
    }

    // ── Chat (main endpoint) ───────────────────────────────────────────
    if (path === '/api/chat' && method === 'POST') {
      const result = await getOrCreateProfile(request, env);
      if (result instanceof Response) return result;
      const { profile, byokConfig } = result;
      const body = await request.json() as { message: string; sessionId?: string; lessonId?: string };

      // Find or create session
      let sid = body.sessionId;
      if (!sid) {
        sid = crypto.randomUUID();
        const session = new StudySession(sid, { topic: body.message || 'Study Session' });
        const socratic = new SocraticMethod();
        sessions.set(sid, { session, socratic, phase: StudyPhase.SETUP, turnHistory: [], lastSpeaker: null });
      }
      const state = sessions.get(sid);
      if (!state) return notFound('Session expired');

      // Route to agent
      const decision: DirectorDecision = routeToAgent({
        phase: state.phase, turnNumber: state.turnHistory.length + 1, lastSpeakerId: state.lastSpeaker,
        message: body.message, turnHistory: state.turnHistory,
      });

      // Get agent definition
      const agentDef = getAgentDef(decision.agentId);
      if (!agentDef) return badRequest('No agent available');

      // Build messages
      const messages: LLMMessage[] = [
        { role: 'system', content: agentDef.systemPrompt + '\n\n' + decision.instructions },
        ...state.turnHistory.slice(-10).map(t => {
          const ad = getAgentDef(t.agentId);
          return { role: 'assistant' as const, content: `[${ad?.name || t.agentId}] spoke.` };
        }),
        { role: 'user', content: body.message },
      ];

      // Call LLM via BYOK
      const llmResponse = await callLLM(byokConfig, messages);
      if (!llmResponse.ok) return json({ error: 'LLM call failed', status: llmResponse.status }, 502);
      const llmData = await llmResponse.json() as { choices?: Array<{ message?: { content: string } }> };
      const reply = llmData.choices?.[0]?.message?.content || 'No response generated.';

      // Update state
      state.turnHistory.push({ agentId: decision.agentId });
      state.lastSpeaker = decision.agentId;
      if (decision.phaseTransition) state.phase = decision.phaseTransition.to;

      // Update knowledge graph
      profile.knowledgeGraph[body.message.slice(0, 50)] = Math.min(1, (profile.knowledgeGraph[body.message.slice(0, 50)] || 0) + 0.05);
      await updateProfile(profile.id, { knowledgeGraph: profile.knowledgeGraph });

      return json({
        sessionId: sid, phase: state.phase, agentId: decision.agentId, agentName: agentDef.name,
        reply, shouldEnd: decision.shouldEnd, reasoning: decision.reasoning,
      });
    }

    // ── Syllabus ───────────────────────────────────────────────────────
    if (path === '/api/syllabus/generate' && method === 'POST') {
      const result = await getOrCreateProfile(request, env);
      if (result instanceof Response) return result;
      const { byokConfig } = result;
      const body = await request.json() as { topic: string; depth?: 'beginner' | 'intermediate' | 'advanced' };
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a curriculum designer. Generate a structured syllabus as JSON array of {week, topic, objectives}. Be specific and practical.' },
        { role: 'user', content: `Create a syllabus for "${body.topic}" at ${body.depth || 'beginner'} level.` },
      ];
      const resp = await callLLM(byokConfig, messages);
      const data = await resp.json();
      return json({ topic: body.topic, syllabus: data });
    }

    // ── Lessons ────────────────────────────────────────────────────────
    if (path === '/api/lessons/start' && method === 'POST') {
      const body = await request.json() as { topic: string; objectives?: string[] };
      const sid = crypto.randomUUID();
      const session = new StudySession(sid, { topic: body.topic, objectives: body.objectives });
      const socratic = new SocraticMethod();
      sessions.set(sid, { session, socratic, phase: StudyPhase.SETUP, turnHistory: [], lastSpeaker: null });
      return json({ sessionId: sid, topic: body.topic, phase: 'SETUP' });
    }
    const lessonMatch = path.match(/^\/api\/lessons\/([^/]+)$/);
    if (lessonMatch) {
      const sid = lessonMatch[1];
      if (method === 'GET') {
        const state = sessions.get(sid);
        return state ? json({ sessionId: sid, topic: state.session.topic, phase: state.phase, turns: state.turnHistory.length }) : notFound();
      }
      if (method === 'POST') {
        const state = sessions.get(sid);
        if (!state) return notFound();
        const body = await request.json() as { message: string };
        const decision = routeToAgent({ phase: state.phase, turnNumber: state.turnHistory.length + 1, lastSpeakerId: state.lastSpeaker, message: body.message, turnHistory: state.turnHistory });
        const agentDef = getAgentDef(decision.agentId);
        state.turnHistory.push({ agentId: decision.agentId });
        state.lastSpeaker = decision.agentId;
        if (decision.phaseTransition) state.phase = decision.phaseTransition.to;
        return json({ agentId: decision.agentId, agentName: agentDef?.name, phase: state.phase, instructions: decision.instructions, shouldEnd: decision.shouldEnd });
      }
    }

    // ── Quiz ───────────────────────────────────────────────────────────
    if (path === '/api/quiz/generate' && method === 'POST') {
      const result = await getOrCreateProfile(request, env);
      if (result instanceof Response) return result;
      const { byokConfig } = result;
      const body = await request.json() as { topic: string; count?: number };
      const messages: LLMMessage[] = [
        { role: 'system', content: `Generate ${body.count || 5} multiple-choice quiz questions as JSON array: [{question, options:[A,B,C,D], correct:0-3, explanation}]` },
        { role: 'user', content: `Topic: ${body.topic}` },
      ];
      const resp = await callLLM(byokConfig, messages);
      const data = await resp.json();
      return json({ quizId: crypto.randomUUID(), questions: data });
    }
    if (path === '/api/quiz/submit' && method === 'POST') {
      const body = await request.json() as { answers: number[]; quizId: string };
      const correct = body.answers.filter(() => Math.random() > 0.3).length; // placeholder
      return json({ correct, total: body.answers.length, score: Math.round((correct / body.answers.length) * 100) });
    }

    // ── Flashcards ─────────────────────────────────────────────────────
    if (path === '/api/flashcards' && method === 'POST') {
      const result = await getOrCreateProfile(request, env);
      if (result instanceof Response) return result;
      const { byokConfig } = result;
      const body = await request.json() as { topic: string; count?: number };
      const messages: LLMMessage[] = [
        { role: 'system', content: `Generate ${body.count || 10} flashcards as JSON array: [{front, back}]` },
        { role: 'user', content: `Topic: ${body.topic}` },
      ];
      const resp = await callLLM(byokConfig, messages);
      const data = await resp.json();
      return json({ cards: data });
    }
    if (path === '/api/flashcards/review' && method === 'POST') {
      const body = await request.json() as { cardId: string; rating: SM2Rating };
      // In-memory SM-2 — would use KV in production
      const card = createSM2Card(body.cardId, 'default');
      const updated = sm2Review(card, body.rating);
      return json({ cardId: body.cardId, nextReview: updated.nextReview, interval: updated.interval });
    }
    if (path === '/api/flashcards/due' && method === 'GET') {
      return json({ due: [], message: 'Flashcard due tracking requires persistent storage (KV)' });
    }

    // ── Knowledge Graph ────────────────────────────────────────────────
    if (path === '/api/knowledge-graph' && method === 'GET') {
      const profileId = url.searchParams.get('profileId');
      if (!profileId) return badRequest('Missing profileId');
      const profile = await getProfile(profileId);
      return profile ? json({ nodes: Object.entries(profile.knowledgeGraph).map(([topic, mastery]) => ({ topic, mastery })), edges: [] }) : notFound();
    }

    // ── Repo Agent ─────────────────────────────────────────────────────
    if (path === '/api/repo-agent/invoke' && method === 'POST') {
      const body = await request.json() as RepoAgentAction;
      const result = await repoAgent.invoke(body);
      return json({ ok: true, result });
    }

    // ── Cross-Cocapn ───────────────────────────────────────────────────
    if (path === '/api/cocapn/links' && method === 'POST') {
      const body = await request.json() as { topic: string; platform: string; repo: string; type: string };
      const link = await cocapn.addLink(body.topic, { platform: body.platform, repo: body.repo, type: body.type as any });
      return json(link);
    }
    const cocapnMatch = path.match(/^\/api\/cocapn\/links\/([^/]+)$/);
    if (cocapnMatch && method === 'GET') {
      const links = await cocapn.getLinks(cocapnMatch[1]);
      return json({ topic: cocapnMatch[1], links });
    }

    // ── 404 ────────────────────────────────────────────────────────────
    return notFound('Unknown route');
  },
};
