# Voice Agent Template — Claude Code Instructions

## Project Overview

This is a GitHub-ready template for building AI phone agents. It uses a 7-layer architecture orchestrated entirely via APIs. The template is designed to be forked and customized for any industry or business.

## Tech Stack

| Layer | Service | Purpose |
|-------|---------|---------|
| 1 — Telephony | Telnyx | SIP trunking, phone number provisioning |
| 2 — Orchestration | Vapi | Agent config, webhooks, call routing |
| 3a — STT | Deepgram Nova-3 | Speech-to-text (6.84% WER) |
| 3b — TTS | Cartesia Sonic | Text-to-speech (90ms latency), ElevenLabs swappable |
| 4 — LLM | Claude (Haiku/Sonnet) | Conversation intelligence via Vapi |
| 5 — Automation | n8n (self-hosted) | Webhook-driven workflows, CRM/calendar/email glue |
| 6 — Memory | Supabase + Pinecone + Mem0 | Structured data, semantic search, persistent caller memory |
| 7 — Training | AWS S3 + AssemblyAI | Recording storage, transcription, auto-tagging, scoring |

## Language & Runtime

- **TypeScript** throughout — all source files in `src/`
- **Node.js** runtime
- **Zod** for config/env validation
- **Express** for the webhook server
- No frontend/UI — this is API/CLI only

## Project Structure

- `src/layers/` — One subdirectory per architectural layer (telephony, orchestration, speech, llm, automation, memory, tools, training)
- `src/agents/` — Agent config builders. `base-agent.ts` is the foundation; examples extend it
- `src/types/` — Shared TypeScript interfaces
- `scripts/` — Setup, seed, and utility scripts (run via `npm run <script>`)
- `supabase/migrations/` — SQL migration files, numbered sequentially (001_, 002_, etc.)
- `n8n/workflows/` — Exported n8n workflow JSON files

## Key Conventions

### Code Style
- Use ES modules (`import`/`export`), not CommonJS
- Prefer `async`/`await` over raw promises
- All API clients export a singleton instance initialized from config
- Type everything — no `any` unless wrapping an untyped third-party response

### Config & Secrets
- All secrets go in `.env` (never committed)
- `.env.example` documents every variable with comments
- `src/config.ts` loads and validates all env vars with Zod at startup
- Config is imported as `import { config } from '../config'`

### Database
- PostgreSQL with pgvector extension
- Migrations in `supabase/migrations/` — always add new migrations with the next sequential number
- Use parameterized queries, never string interpolation for SQL
- Tables: `agent_configs`, `callers`, `calls`, `transcripts`, `training_data`

### n8n Workflows
- Workflow JSON files live in `src/layers/automation/workflows/` (active) and `n8n/workflows/` (backup)
- Workflows are deployed programmatically via the n8n API, not manually imported
- Each workflow should have a clear trigger (webhook, schedule, or manual)

### Vapi Integration
- Agent configs are built programmatically via `base-agent.ts`, not hand-written JSON
- Vapi types are defined in `vapi-types.ts` — extend these when adding new config options
- Webhook events are routed through `webhook-handler.ts` which dispatches to appropriate handlers
- Mid-call function calls flow: Vapi → webhook → tool handler → response back to Vapi

### Error Handling
- Wrap external API calls in try/catch with meaningful error messages
- Log errors with context (which service, what operation, relevant IDs)
- The setup script should gracefully handle missing optional services (warn, don't crash)

## Commands

```bash
docker compose up          # Start local infrastructure (postgres, n8n, minio)
npm run setup              # Validate env, test connections, run migrations, deploy workflows
npm run build              # Compile TypeScript
npm run dev                # Run webhook server in development mode
npm run create-agent       # Create/deploy an agent to Vapi
npm run seed               # Seed example agent configs
npm run seed-knowledge     # Ingest docs into Pinecone knowledge base
```

## Do NOT

- Add a frontend/dashboard — this is intentionally API/CLI only
- Use Twilio instead of Telnyx
- Use Retell instead of Vapi
- Hardcode API keys or secrets in source files
- Write raw SQL with string interpolation
- Skip Zod validation for new config values
- Create n8n workflows manually — always use the API deployment pattern
- Add dependencies without a clear justification
