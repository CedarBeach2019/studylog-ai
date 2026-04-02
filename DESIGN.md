# StudyLog.ai — The Living Classroom

> **Author:** Superinstance — [github.com/superinstance](https://github.com/superinstance)

---

## Table of Contents

1. [Vision](#vision)
2. [Paradigm Shifts](#paradigm-shifts)
3. [Existing Code (Reusable)](#existing-code-reusable)
4. [New Architecture](#new-architecture)
5. [BYOK Multi-Provider Mixing](#byok-multi-provider-mixing)
6. [API Routes](#api-routes)
7. [Data Structures](#data-structures)
8. [Roadmap — Three Phases](#roadmap--three-phases)
9. [Why Traditional LMS Can't Compete](#why-traditional-lms-cant-compete)
10. [Brand & Design Tokens](#brand--design-tokens)

---

## Vision

The classroom **IS** the repo. The repo **IS** the classroom.

A student clones `studylog-ai`, creates a profile, connects any LLM provider, and starts learning. The repo-agent participates in conversations, changes the UI per lesson, forks repos for projects, and ships standalone apps. The knowledge graph accumulates across sessions. Cross-cocapn linking connects learning to projects on other platforms.

StudyLog isn't an app you deploy — it's an environment you inhabit.

---

## Paradigm Shifts

| # | Shift | Description |
|---|-------|-------------|
| 1 | **The Repo Is the Classroom** | Not "a repo that deploys a classroom" — the repo itself is the pedagogical medium |
| 2 | **Knowledge Graph as Git History** | `git log` shows how understanding evolved over time |
| 3 | **Conversation as Curriculum** | Prompt → code → adjust loops *are* pedagogical content |
| 4 | **Fork-and-Ship Pedagogy** | Homework is a real contribution, not a throwaway assignment |
| 5 | **NL Envelope Routing** | Agents communicate via natural language, not hardcoded protocols (inspired by OVON / Open Voice Interoperability) |
| 6 | **Immediate Feedback Loops** | Every action gets contextual response — a principle dating back to PLATO (1960) |

---

## Existing Code (Reusable)

The original studylog-ai contains excellent pure-TypeScript modules with **zero dependencies**. These are extracted and preserved:

| Module | Key Exports |
|--------|-------------|
| `src/study/tracker.ts` | `StudySession`, `Pomodoro`, `SpacedRepetition` (SM-2), `FlashCardEngine`, `KnowledgeGraph`, `StudyGoals` |
| `src/study/tutor.ts` | `SocraticMethod`, `ExplanationGenerator`, `QuizGenerator`, `WeaknessDetector` |
| `src/orchestrator/session-state.ts` | `StudyPhase` enum, SM-2 algorithm, `StudentProgress` |
| `src/orchestrator/director.ts` | Multi-agent routing (teacher / classmate / quizMaster / tutor / progressTracker) |
| `src/orchestrator/agents.ts` | Agent definitions with system prompts and phase permissions |

All modules are pure TypeScript. No framework lock-in. No runtime dependencies.

---

## New Architecture

### Simple Worker Pattern

The entire application is a **single Cloudflare Worker** with inline HTML. No Hono, no D1, no assets binding.

```
src/
├── worker.ts              # Entry point — inline HTML + request router
├── lib/
│   └── byok.ts            # 7+ LLM providers, custom base-url, mix-and-match per role
├── study/                 # Extracted from old code, enhanced
│   ├── tracker.ts
│   ├── tutor.ts
│   ├── knowledge-graph.ts
│   ├── flashcards.ts
│   └── spaced-repetition.ts
├── orchestrator/
│   ├── director.ts        # Multi-agent routing
│   ├── agents.ts          # Agent definitions
│   └── session-state.ts   # StudyPhase, StudentProgress
├── api/                   # Route handlers
│   ├── chat.ts
│   ├── profiles.ts
│   ├── lessons.ts
│   ├── quiz.ts
│   ├── flashcards.ts
│   ├── syllabus.ts
│   ├── repo-agent.ts
│   └── cocapn.ts
└── html/
    └── index.ts           # Inline HTML generator (landing + study UI)
```

### Key Design Decisions

- **No framework** — vanilla TypeScript, standard `fetch`, `Request`/`Response`
- **KV-only persistence** — Cloudflare KV for profiles, sessions, knowledge graphs
- **Inline HTML** — no build step, no assets binding, deploys in one file
- **BYOK-first** — every LLM call goes through the BYOK module; no provider lock-in

---

## BYOK Multi-Provider Mixing

Bring Your Own Keys. Each agent role can use a **different model and provider**:

| Role | Example Provider | Example Model | Rationale |
|------|-----------------|---------------|-----------|
| Teacher | OpenAI | gpt-4o | Expensive but nuanced explanations |
| Codegen | Anthropic | claude-sonnet | Strong code generation |
| Quiz | Local (Ollama) | llama3 | Fast, cheap, good for simple QA |
| Classmate | Anthropic | claude-haiku | Fast peer simulation |

### Supported Providers

1. OpenAI
2. Anthropic
3. Google (Gemini)
4. Mistral
5. Groq
6. Together AI
7. Local (Ollama / any OpenAI-compatible endpoint)

Each provider supports custom `baseURL`, enabling self-hosted models, proxies, and regional endpoints.

---

## API Routes

### Health & Setup

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check |
| `GET` | `/setup` | BYOK configuration wizard (inline HTML) |

### Chat & Conversation

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat` | Main conversation endpoint (multi-agent routing) |
| `POST` | `/api/chat/stream` | SSE streaming conversation |

### Profiles

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/profiles` | List all profiles |
| `POST` | `/api/profiles` | Create a student profile |
| `GET` | `/api/profiles/:id` | Get profile + knowledge graph |
| `PATCH` | `/api/profiles/:id` | Update profile |

### Lessons

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/syllabus/generate` | AI generates a learning path from topic + level |
| `POST` | `/api/lessons/:id/start` | Begin a lesson |
| `POST` | `/api/lessons/:id/turn` | Send a message within a lesson |
| `GET` | `/api/lessons/:id` | Get lesson state and history |

### Assessment

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/quiz/generate` | Generate quiz from topic or knowledge graph gaps |
| `POST` | `/api/quiz/submit` | Submit answers, update mastery scores |
| `POST` | `/api/flashcards` | Create a flashcard |
| `POST` | `/api/flashcards/review` | Submit SM-2 review result |
| `GET` | `/api/flashcards/due` | Get cards due for review |
| `GET` | `/api/knowledge-graph` | Full knowledge graph for student |

### Integration

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/repo-agent/invoke` | Tell the repo-agent to perform an action |
| `GET` | `/api/cocapn/links/:topic` | Cross-platform connections for a topic |
| `POST` | `/api/settings/providers` | Configure LLM providers |

---

## Data Structures

### Student Profile

```json
{
  "id": "casey",
  "role": "student",
  "apiKeys": {
    "openai": {
      "key": "sk-...",
      "baseURL": "https://api.openai.com/v1",
      "defaultModel": "gpt-4o"
    },
    "anthropic": {
      "key": "sk-ant-...",
      "baseURL": null,
      "defaultModel": "claude-sonnet"
    },
    "local": {
      "key": null,
      "baseURL": "http://localhost:11434/v1",
      "defaultModel": "llama3"
    }
  },
  "modelRouting": {
    "teacher": "openai/gpt-4o",
    "codegen": "anthropic/claude-sonnet",
    "quiz": "local/llama3"
  },
  "interests": ["web dev", "game design"],
  "learningStyle": "project-first",
  "knowledgeGraph": { },
  "createdAt": 1700000000000
}
```

### Knowledge Graph Node

```json
{
  "id": "react-hooks-usestate",
  "topic": "useState hook",
  "domain": "react",
  "mastery": 0.85,
  "confidence": [0.9, 0.8, 0.85],
  "lastAssessed": "2026-03-28",
  "connections": {
    "prerequisites": ["react-components", "javascript-variables"],
    "enables": ["react-useeffect", "react-context"],
    "cocapnLinks": [
      {
        "platform": "makerlog",
        "repo": "todo-app",
        "file": "src/App.tsx"
      },
      {
        "platform": "studylog",
        "lessonId": "react-hooks-intro"
      }
    ]
  },
  "evidence": [
    {
      "type": "quiz",
      "score": 0.9,
      "date": "2026-03-28"
    },
    {
      "type": "project",
      "repo": "todo-app",
      "assessment": "strong"
    }
  ]
}
```

### SM-2 Spaced Repetition Card

```json
{
  "id": "fc-001",
  "nodeId": "react-hooks-usestate",
  "front": "What hook manages local component state in React?",
  "back": "useState — returns [state, setter], re-renders on change",
  "interval": 6,
  "repetition": 3,
  "efactor": 2.5,
  "nextReview": "2026-04-04T09:00:00Z",
  "lastReview": "2026-03-29T09:00:00Z"
}
```

### Lesson State

```json
{
  "id": "react-hooks-intro",
  "profileId": "casey",
  "topic": "React Hooks",
  "phase": "active",
  "syllabusId": "react-fundamentals",
  "agentHistory": [
    { "role": "teacher", "message": "Let's explore why hooks exist...", "ts": 1700000000000 },
    { "role": "student", "message": "Because classes are confusing?", "ts": 1700000001000 }
  ],
  "knowledgeSnapshot": { },
  "startedAt": 1700000000000,
  "completedAt": null
}
```

---

## Roadmap — Three Phases

### Phase 1: MVP — Now

The goal is a working, deployable study environment in days, not months.

- [x] Simple Cloudflare Worker (inline HTML, no Hono, no D1)
- [x] BYOK module with 7+ LLM providers
- [x] Single student profile, KV-persisted
- [x] Chat-based lessons with multi-agent routing
- [x] SM-2 spaced repetition and flashcard engine
- [x] Knowledge graph tracking per student
- [x] Quiz generation and scoring
- [x] Syllabus generation from topic + level
- [x] Inline landing page with study theme
- [x] `CLAUDE.md` + agents for Claude Code integration

### Phase 2: Growth — 3–9 Months

- Multi-student profiles with observer roles
- **Repo-agent**: fork repos, drop themes, add components to the classroom
- **Theme engine**: lessons dynamically change the UI
- **Cross-cocapn linking**: read from topic registry, connect to other Cocapn platforms
- Teacher rehearsal mode (practice explaining before live sessions)
- Project-based lessons with forked repos as homework
- Knowledge graph visualization (force-directed graph in browser)

### Phase 3: Mature — 1–3 Years

- **Fork-and-ship**: student project becomes a standalone Cocapn app
- Full ecosystem: 10+ Cocapn platforms with federated knowledge graphs
- Repo-agents from other platforms join the classroom as guest agents
- AI-generated curriculum spanning multiple platforms
- Community curriculum sharing (open-source syllabi)
- Teacher marketplace (human + AI teachers, rated by outcomes)

---

## Why Traditional LMS Can't Compete

| Traditional LMS | StudyLog.ai |
|-----------------|-------------|
| Static course content | Content generates and adapts per student |
| One-size-fits-all quizzes | Quizzes drawn from knowledge graph gaps |
| Grades disappear after semester | Knowledge graph persists forever in git |
| Teacher manually creates content | AI + repo-agent co-create content |
| Can't modify the platform | The platform IS the content — fully mutable |
| No connection to real projects | Fork real repos, ship real apps |
| Vendor lock-in | Clone the repo, own everything |

---

## Brand & Design Tokens

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#1E3A5F` | Navy — headers, navigation, primary actions |
| Accent | `#F59E0B` | Gold — highlights, CTAs, progress indicators |
| Success | `#10B981` | Green — correct answers, completed lessons |
| Error | `#EF4444` | Red — incorrect answers, validation errors |
| Surface | `#F8FAFC` | Light background |
| Text | `#1E293B` | Primary text |

### Typography

- **Headings:** System sans-serif stack
- **Body:** System sans-serif, 16px base
- **Code:** Monospace for all code blocks and inline code

### Principles

- **Study-first UI** — minimal chrome, maximal focus on content
- **Progress visible** — always show where you are and what's next
- **Adaptive density** — compact for advanced users, spacious for beginners
- **Dark mode** — default for long study sessions

---

## Security Considerations

- API keys are stored in KV, encrypted at rest by Cloudflare
- Keys never leave the worker — LLM calls are server-side
- No user auth in Phase 1 (single-user, self-hosted)
- Phase 2 introduces multi-profile with bearer tokens
- CORS restricted to same-origin by default

---

## Deployment

```bash
# Install dependencies
npm install

# Dev server
npx wrangler dev

# Deploy to Cloudflare
npx wrangler deploy
```

Single command deploy. No build step. No asset pipeline. The worker is the product.

---

*StudyLog.ai — where learning lives in code.*
