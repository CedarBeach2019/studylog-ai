import { evapPipeline, getEvapReport, getLockStats } from './lib/evaporation-pipeline.js';
import { landingHtml, chapterHtml, type BrainProgress } from './lib/brain-lesson.js';
import { selectModel } from './lib/model-router.js';
import { trackConfidence, getConfidence } from './lib/confidence-tracker.js';
import { softActualize, confidenceScore } from './lib/soft-actualize.js';
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
import { evapPipeline } from './lib/evaporation-pipeline.js';

import { createProfile, getProfile, updateProfile, listProfiles, deleteProfile, getModelForRole, type StudentProfile } from './lib/multi-profile.js';
import { RepoAgent, type RepoAgentAction } from './lib/repo-agent.js';
import { CrossCocapn } from './lib/cross-cocapn.js';
import { deadbandCheck, deadbandStore, getEfficiencyStats } from './lib/deadband.js';
import { logResponse } from './lib/response-logger.js';

// ── Instances ──────────────────────────────────────────────────────────────

const repoAgent = new RepoAgent();
const cocapn = new CrossCocapn();
const sessions = new Map<string, { session: StudySession;  socratic: SocraticMethod; phase: StudyPhase; turnHistory: Array<{ agentId: string }>; lastSpeaker: string | null }>();

// ── Landing Page ───────────────────────────────────────────────────────────

function landingPage(): Response {
  return new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>StudyLog.ai — Watch AI Teach Without Giving Answers</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0}.hero{background:linear-gradient(135deg,#1E3A5F,#0f172a);padding:5rem 2rem 3rem;text-align:center}.hero h1{font-size:3rem;background:linear-gradient(135deg,#F59E0B,#fbbf24);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:.5rem}.hero .tagline{color:#94a3b8;font-size:1.15rem;max-width:550px;margin:0 auto 1.5rem}.fork-btns{display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap}.fork-btns a{padding:.5rem 1.2rem;background:rgba(245,158,11,.1);border:1px solid #F59E0B33;border-radius:8px;color:#F59E0B;text-decoration:none;font-size:.85rem}.fork-btns a:hover{background:rgba(245,158,11,.2)}.demo-section{max-width:800px;margin:0 auto 3rem;padding:0 1rem}.demo-label{color:#F59E0B;font-size:.8rem;text-transform:uppercase;letter-spacing:2px;margin-bottom:1rem;display:flex;align-items:center;gap:.5rem}.demo-label::before,.demo-label::after{content:'';flex:1;height:1px;background:#1e293b}.chat{background:#1e293b;border:1px solid #334155;border-radius:12px;overflow:hidden;font-size:.9rem}.msg{padding:.8rem 1.2rem;border-bottom:1px solid #0f172a;display:flex;gap:.8rem}.msg:last-child{border-bottom:none}.msg.user{background:#162032}.msg.tutor{background:#1e293b}.avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;flex-shrink:0}.msg.user .avatar{background:#F59E0B;color:#0f172a;font-weight:700}.msg.tutor .avatar{background:#1E3A5F;color:#F59E0B}.msg-body{flex:1}.msg-name{font-size:.72rem;color:#475569;margin-bottom:.15rem;display:flex;align-items:center;gap:.5rem}.msg-text{color:#cbd5e1;line-height:1.5}.msg-text code{background:#0f172a;padding:.1rem .35rem;border-radius:3px;font-size:.82rem;color:#F59E0B;font-family:monospace}.confidence{display:inline-block;padding:.1rem .4rem;border-radius:10px;font-size:.65rem;font-weight:600;margin-left:.3rem}.confidence.high{background:#22c55e22;color:#22c55e}.confidence.med{background:#F59E0B22;color:#F59E0B}.confidence.low{background:#ef444422;color:#ef4444}.byok{max-width:600px;margin:0 auto 2rem;padding:0 1rem}.byok h3{color:#F59E0B;margin-bottom:.8rem;font-size:1rem}.byok-row{display:flex;gap:.5rem}.byok-row input{flex:1;padding:.6rem 1rem;background:#1e293b;border:1px solid #334155;border-radius:8px;color:#e2e8f0}.byok-row button{padding:.6rem 1.5rem;background:#F59E0B;color:#0f172a;border:none;border-radius:8px;font-weight:600;cursor:pointer}.fork-bar{max-width:800px;margin:0 auto 3rem;padding:0 1rem;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:1.5rem}.fork-bar h3{color:#F59E0B;margin-bottom:.8rem;font-size:1rem}.deploy-box{background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:1rem;position:relative}.deploy-box code{font-family:monospace;font-size:.78rem;color:#F59E0B;display:block;white-space:pre-wrap}.copy-btn{position:absolute;top:.5rem;right:.5rem;background:#334155;border:none;border-radius:4px;color:#94a3b8;padding:.2rem .5rem;font-size:.7rem;cursor:pointer}.footer{text-align:center;padding:2rem;color:#475569;font-size:.8rem;border-top:1px solid #1e293b}</style></head><body><div class="hero">
      <img src="https://cocapn-logos.casey-digennaro.workers.dev/img/cocapn-logo-v1.png" alt="Cocapn" style="width:64px;height:auto;margin-bottom:.5rem;border-radius:8px;display:block;margin-left:auto;margin-right:auto">
      <h1>StudyLog.ai</h1><p class="tagline">Watch AI teach without giving answers — Socratic method, live.</p><div class="fork-btns"><a href="https://github.com/superinstance/studylog-ai" target="_blank">⭐ Star</a><a href="https://github.com/superinstance/studylog-ai/fork" target="_blank">🍴 Fork</a></div></div><div class="demo-section"><div class="demo-label">Live Demo — Socratic Session: Recursion</div><div class="chat"><div class="msg user"><div class="avatar">S</div><div class="msg-body"><div class="msg-name">Student <span class="confidence low">42%</span></div><div class="msg-text">Can you explain recursion to me? I keep getting confused.</div></div></div><div class="msg tutor"><div class="avatar">T</div><div class="msg-body"><div class="msg-name">Tutor</div><div class="msg-text">Sure! Before I explain, let me ask: what happens when you look up a word in the dictionary and the definition contains another word you don't know?</div></div></div><div class="msg user"><div class="avatar">S</div><div class="msg-body"><div class="msg-name">Student <span class="confidence med">55%</span></div><div class="msg-text">You have to look up that word too. And sometimes that word's definition has another unknown word…</div></div></div><div class="msg tutor"><div class="avatar">T</div><div class="msg-body"><div class="msg-name">Tutor</div><div class="msg-text">Exactly! Now — what stops that process? When does it end?</div></div></div><div class="msg user"><div class="avatar">S</div><div class="msg-body"><div class="msg-name">Student <span class="confidence med">62%</span></div><div class="msg-text">When you find a definition where you know all the words?</div></div></div><div class="msg tutor"><div class="avatar">T</div><div class="msg-body"><div class="msg-name">Tutor</div><div class="msg-text">Yes! That's called the <strong>base case</strong>. So if I asked you to write a function <code>factorial(n)</code>, what do you think the base case should be?</div></div></div><div class="msg user"><div class="avatar">S</div><div class="msg-body"><div class="msg-name">Student <span class="confidence high">78%</span></div><div class="msg-text"><code>factorial(0) = 1</code> and <code>factorial(1) = 1</code>?</div></div></div><div class="msg tutor"><div class="avatar">T</div><div class="msg-body"><div class="msg-name">Tutor</div><div class="msg-text">Perfect. And for the recursive case — how would you express <code>factorial(4)</code> in terms of a smaller problem?</div></div></div><div class="msg user"><div class="avatar">S</div><div class="msg-body"><div class="msg-name">Student <span class="confidence high">91%</span></div><div class="msg-text"><code>4 * factorial(3)</code>! So it's <code>n * factorial(n-1)</code> and it keeps going down until it hits the base case!</div></div></div><div class="msg tutor"><div class="avatar">T</div><div class="msg-body"><div class="msg-name">Tutor</div><div class="msg-text">🎉 You just derived recursion from first principles. You didn't memorize a pattern — you <em>understood</em> it. Ready to try a harder problem?</div></div></div></div></div><div class="byok"><h3>🔑 Bring Your Own Key — Start Learning</h3><div class="byok-row"><input id="key" placeholder="sk-... your API key" type="password"><button onclick="window.location.href='/setup?key='+document.getElementById('key').value">Start Learning →</button></div></div><div class="fork-bar"><h3>⚡ Fork & Deploy</h3><div class="deploy-box"><button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent);this.textContent='Copied!'">Copy</button><code>git clone https://github.com/superinstance/studylog-ai.git
cd studylog-ai
npm install
npx wrangler deploy</code></div></div><div class="footer">StudyLog.ai — Part of the LogOS ecosystem. BYOK, open source.</div></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.openai.com https://api.anthropic.com https://api.siliconflow.cn https://api.deepseek.com https://api.groq.com https://api.mistral.ai https://openrouter.ai https://api.z.ai https://*;" } });
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
<div style="font-size:.75rem;color:#64748b;margin-bottom:.8rem;text-align:center"><a href="https://platform.deepseek.com/api_keys" target="_blank" style="color:#60a5fa">DeepSeek</a> · <a href="https://api.siliconflow.cn" target="_blank" style="color:#60a5fa">SiliconFlow</a> · <a href="https://platform.openai.com/api-keys" target="_blank" style="color:#60a5fa">OpenAI</a> · <a href="https://console.anthropic.com" target="_blank" style="color:#60a5fa">Anthropic</a> · <a href="https://cloud.deepinfra.com" target="_blank" style="color:#60a5fa">DeepInfra</a></div>
<label>API Key</label><input id="apiKey" type="password" placeholder="sk-...">
<label>Model (optional)</label><input id="model" placeholder="gpt-4o-mini">
<button onclick="save()">Save & Start Learning</button>
<a href="/">← Back</a></div>
<script>
async function save(){const p=document.getElementById('provider').value,k=document.getElementById('apiKey').value,m=document.getElementById('model').value;
const r=await fetch('/api/byok',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:p,apiKey:k,model:m})});
if(r.ok)window.location.href='/';else alert('Error: '+(await r.text()));}
</script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.openai.com https://api.anthropic.com https://api.siliconflow.cn https://api.deepseek.com https://api.groq.com https://api.mistral.ai https://openrouter.ai https://api.z.ai https://*;" } });
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

    if (path === '/api/evaporation') {
      return json({ hot: [], warm: [], coverage: 0, repo: 'studylog-ai', timestamp: Date.now() });
    }
    if (path === '/api/kg') {
      return json({ nodes: [], edges: [], domain: 'studylog-ai', timestamp: Date.now() });
    }
    if (path === '/api/memory') {
      return json({ patterns: [], repo: 'studylog-ai', timestamp: Date.now() });
    }
    if (path === '/api/confidence') {
      const scores = await getConfidence(env);
      return json(scores);
    }
    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Profile-Id' } });
    }

    // ── Static routes ──────────────────────────────────────────────────
    if (path === '/' || path === '/index.html') return landingPage();
    if (path === '/api/efficiency' && request.method === 'GET') {
      try {
        return new Response(JSON.stringify({
        totalCached: 0, totalHits: 0, cacheHitRate: 0, tokensSaved: 0,
        repo: 'studylog-ai', timestamp: Date.now()
        }), { headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
      } catch (e) {
        return new Response(JSON.stringify({ totalCached: 0, totalHits: 0, cacheHitRate: 0, tokensSaved: 0, repo: 'studylog-ai', timestamp: Date.now(), error: 'efficiency tracking not initialized' }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
    }

  if (path === '/setup') return setupPage();
    if (path === '/health') return json({ status: 'ok', service: 'studylog-ai', version: '1.1.0', agentCount: 5, modules: ['tutor','quiz-master','classmate','director','socratic','sm2','profiles','repo-agent','seed'], seedVersion: '2024.04', timestamp: Date.now() });


    // ── Seed Route ───────────────────────────────────────────────────────
    if (path === '/api/seed') return json({
      domain: 'studylog-ai', description: 'Living classroom — AI tutors, spaced repetition, knowledge graphs', seedVersion: '2024.04',
      principles: ['spaced repetition','active recall','interleaving','elaboration','dual coding','metacognition','feynman technique'],
      socraticSteps: ['clarify assumptions','explore implications','test understanding','connect to prior knowledge','apply to new context'],
      systemPrompt: 'You are StudyLog, an AI tutor using the Socratic method.'
    });
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

    // ── Crystallized Knowledge Lookup (pre-chat cache check) ──
    if (url.pathname === '/api/crystal/lookup' && method === 'POST') {
      const body = await request.json();
      const query = body.query || '';
      try {
        const r = await fetch('https://fleet-orchestrator.casey-digennaro.workers.dev/api/crystal/query', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, domain: 'studylog-ai' }),
        });
        const result = await r.json();
        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch(e) {
        return new Response(JSON.stringify({ cachedHits: [], needModelCall: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }
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
      const userMessage = messages.map((m: any) => m.content || '').join(' ');
      const evapResult = await evapPipeline(env, userMessage, async () => {
        const llmResponse = await callLLM(byokConfig, messages);
        if (!llmResponse.ok) throw new Error('LLM call failed');
        const llmData = await llmResponse.json() as { choices?: Array<{ message?: { content: string } }> };
        return llmData.choices?.[0]?.message?.content || 'No response generated.';
      }, 'studylog-ai');
      const reply = evapResult.response;

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
      const conf = body.answers.length > 0 ? confidenceScore('quiz-submit', true, true) : 0.3;
      return json({ correct, total: body.answers.length, score: Math.round((correct / body.answers.length) * 100), confidence: conf });
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

    // ── Build Your Own Brain ────────────────────────────────────────
    if (path === '/brain' && method === 'GET') {
      return new Response(landingHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self';" } });
    }
    const brainChMatch = path.match(/^\/brain\/chapter\/(\d+)$/);
    if (brainChMatch && method === 'GET') {
      const html = chapterHtml(parseInt(brainChMatch[1]));
      if (!html) return notFound('Chapter not found');
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self';" } });
    }
    if (path === '/brain/progress' && method === 'POST') {
      const body = await request.json() as { sessionId: string; chapter: number; completed: boolean; taskOutput?: string };
      const key = `brain-progress-${body.sessionId}`;
      const existing = await env.STUDYLOG_KV?.get(key);
      const progress: BrainProgress = existing ? JSON.parse(existing) : {};
      progress[body.chapter] = { completed: body.completed, taskOutput: body.taskOutput, timestamp: new Date().toISOString() };
      await env.STUDYLOG_KV?.put(key, JSON.stringify(progress));
      return json({ ok: true, progress });
    }
    if (path === '/brain/progress' && method === 'GET') {
      const sessionId = url.searchParams.get('sessionId');
      if (!sessionId) return json({});
      const raw = await env.STUDYLOG_KV?.get(`brain-progress-${sessionId}`);
      return json(raw ? JSON.parse(raw) : {});
    }

    // ── 404 ────────────────────────────────────────────────────────────
    return notFound('Unknown route');
  },
};