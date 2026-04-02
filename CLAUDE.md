# StudyLog.ai — The Living Classroom

Multi-agent AI tutoring platform on Cloudflare Workers.

## Architecture
- **src/worker.ts** — Main worker, all routes
- **src/study/** — Core study modules (SM-2, Socratic, director, tracker, session-state)
- **src/agents/** — Agent definitions (teacher, classmate, quiz master, tutor, progress tracker)
- **src/lib/** — BYOK multi-provider, multi-profile, repo-agent, cross-cocapn

## Key Features
- BYOK: Bring your own API key (OpenAI, Anthropic, Google, DeepSeek, Groq, Ollama)
- Multi-agent routing via director.ts (rule-based phase/content routing)
- SM-2 spaced repetition for flashcards
- Socratic method teaching
- Per-profile provider configs and model routing
- Repo-agent hooks (fork, theme, component, build, ship)
- Cross-cocapn topic linking across platforms

## Deploy
```bash
npm install
npx wrangler deploy
```

## Author
Superinstance
