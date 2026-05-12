# AI SDLC Multi-Agent System MVP

Telegram-driven MVP for the AI SDLC architecture.

Implemented scope:

- Telegram bot with `/idea`, `/agents`, `/status`
- API backend with task creation and status reads
- BullMQ orchestration queue
- State-machine MVP pipeline: `IDEA -> BA_ANALYSIS -> PM_PLANNING -> DEV_IMPLEMENTATION -> DONE`
- BA, PM, and Backend Developer agents using JSON-only OpenAI outputs
- Zod and JSON schemas for agent contracts
- Worker-owned GitHub PR creation from generated diffs
- Local JSON task store for retryable MVP state

Excluded from MVP:

- Full QA automation
- Manual QA UI
- DevOps deployment
- Production vector database

## Setup

Copy `.env.example` to `.env.local` and fill values. The OpenAI key can remain local.

Start Redis:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

Install dependencies and build:

```bash
npm install
npm run build
```

Run services:

```bash
npm run dev:api
npm run dev:worker
npm run dev:bot
```

## Telegram Flow

```text
/idea Add an endpoint to export invoices as CSV
-> BA analysis
-> PM plan
-> Backend dev diff
-> Worker applies patch and opens GitHub PR
-> /status <taskId>
```

Agents never execute system actions. They produce validated JSON. Workers perform all side effects.
