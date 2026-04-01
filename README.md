# studylog-ai

> AI-powered study companion with spaced repetition, flashcards, knowledge mapping, and Pomodoro focus. Privacy-first, open source, Cloudflare-native.

## What Is This

studylog-ai is the learning-focused themed fork of [log-origin](https://github.com/CedarBeach2019/log-origin) — a privacy-first AI gateway platform. It adds a full study toolkit on top of the core AI routing engine.

**Core features:**
- **Pomodoro Timer** — Focus sessions with configurable work/break intervals
- **Flashcards** — SM-2 spaced repetition engine with Anki-style scheduling
- **Knowledge Map** — Visual concept graph tracking mastery across topics
- **Progress Dashboard** — Points, streaks, accuracy, and goal tracking
- **AI Tutor** — Socratic method, adaptive quizzes, weakness detection
- **Session Management** — Multi-phase study sessions (setup, lecture, practice, quiz, review, summary)

## Architecture

```
src/study/
  tracker.ts    — StudySession, SpacedRepetition, FlashCardEngine, KnowledgeGraph, StudyGoals
  tutor.ts      — SocraticMethod, ExplanationGenerator, QuizGenerator, WeaknessDetector

src/orchestrator/
  session-state.ts  — SM-2 algorithm, study phases, session state
  director.ts       — Agent routing (teacher, tutor, quiz master, classmate)
  agents.ts         — Agent definitions

worker/
  index.ts          — Hono app entry point
  routes/study.ts   — /api/study/*, /api/flashcards, /api/progress, /api/quiz

web/
  index.html        — Study UI dashboard (navy #1E3A5F + gold #F59E0B theme)
  study.css         — Study component styles
  components/       — Preact components (StudyShell, Flashcard, QuizCard, etc.)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/study/start` | Start a new study session |
| POST | `/api/study/turn` | Send a message in active session |
| GET | `/api/study/session/:id` | Get session state |
| POST | `/api/study/quiz` | Submit quiz answer |
| POST | `/api/study/flashcards` | Add flashcards to session |
| POST | `/api/study/flashcard/review` | Rate a flashcard (SM-2) |
| GET | `/api/flashcards` | Get due flashcards |
| POST | `/api/flashcards/create` | Create a new flashcard |
| GET | `/api/progress` | Get aggregated progress |
| GET | `/api/quiz` | Generate a quiz |
| POST | `/api/quiz/submit` | Submit quiz answers |
| GET | `/api/study/knowledge-map` | Get knowledge graph nodes |
| POST | `/api/study/knowledge-map/node` | Add a knowledge node |
| GET | `/api/study/goals` | Get active/completed goals |
| POST | `/api/study/goals` | Create a study goal |
| GET | `/api/study/stream` | SSE stream for live sessions |

## Status

🚧 **Active Development** — Study vessel is in progress. Core tracking, tutoring engines, and UI are functional.

## Design Documents

| Document | What It Covers |
|----------|---------------|
| [Platform Vision](docs/PLATFORM-VISION.md) | The big picture: LOG.ai concept, domains as hubs, omni-bot, flywheel |
| [Master Plan](docs/MASTER-PLAN.md) | 7-phase roadmap, architecture overview, privacy model |
| [Database Schema](docs/database/SCHEMA-DESIGN.md) | Every table, column, index, migration strategy, D1 constraints |
| [Intelligence Design](docs/routing/INTELLIGENCE-DESIGN.md) | Routing, classification, adaptive learning, draft rounds, agent routing |
| [Security Model](docs/security/SECURITY-MODEL.md) | 17-threat matrix, auth, authorization, API security, Worker security |
| [Privacy Architecture](docs/privacy/PRIVACY-ARCHITECTURE.md) | Encryption flows, PII detection, zero-knowledge analysis, compliance |
| [API Design](docs/api/API-DESIGN.md) | Every endpoint, request/response schemas, streaming, error handling |
| [Protocol Spec](docs/api/PROTOCOL-SPEC.md) | MCP integration, agent communication, local tunnels, federation |
| [UX Design](docs/ux/UX-DESIGN.md) | Personas, wireframes, theming, accessibility, information architecture |
| [Component Spec](docs/ux/COMPONENT-SPEC.md) | Preact components, state management, streaming, performance |
| [Initial Design](docs/architecture/initial-design.md) | Original design from the research phase |

## Key Design Decisions

- **Cloudflare Workers** — edge deployment, $0 on free tier, scale to zero
- **D1 (SQLite)** — our current Python prototype uses SQLite, D1 ports directly
- **Preact** — 4KB, no build step, ships as static Worker assets
- **Hono** — typed HTTP framework for Workers
- **Client-side encryption** — AES-256-GCM, PBKDF2 key derivation, zero-knowledge at rest
- **Regex-first routing** — 5ms classification on Workers, ML optimizes rules over time
- **OpenAI-compatible API** — drop-in replacement for existing SDKs

## Themed Forks

log-origin is the engine. Themed forks add personality:

- **DMlog.ai** — TTRPG world-builder's AI (first themed variant)
- **studylog.ai** — AI tutor that remembers what you've learned
- **makerlog.ai** — AI pair programmer that learns your style
- **businesslog.ai** — AI assistant for operations and analytics

Each fork customizes: system prompts, UI theme, routing rules, and feature set.

## Research

See `.research/` for the raw research that informed the design:

- `cloudflare-arch.md` — Cloudflare services, limits, pricing
- `privacy-vault.md` — Encryption research, threat model
- `agent-tunnels.md` — Cloudflare Tunnel, MCP, A2A protocols
- `forkable-repo.md` — Fork patterns, update mechanism, personality packs
- `log-platform.md` — LOG.ai brand concept, omni-bot design
- `multi-tenant.md` — Workers for Platforms, scaling tiers
- `agent-network.md` — Agent identity, discovery, communication

## License

MIT
