# Voice Agent Template — Claude Code Instructions

## What This Project Is

This is a private agency template used to build AI-powered voice agents for
business clients. It is NOT a public open-source project.

The workflow is:
1. Clone this repo into a new private repo named [client-name]-voice-agent
2. Read CLIENT_INTAKE.md — this is always your first instruction
3. Build the client's agent based on the intake document
4. Grep for every TODO:CONFIGURE and resolve each one
5. Deploy and test

Every client gets their own private repo cloned from this template.
Never fork — always clone and push to a new private remote.

---

## Tech Stack

| Layer | Service | Purpose |
|-------|---------|---------|
| 1 — Telephony | Telnyx | SIP trunking, phone number provisioning |
| 2 — Orchestration | Vapi | Agent config, webhooks, call routing |
| 3a — STT | Deepgram Nova-3 | Speech-to-text |
| 3b — TTS | Cartesia Sonic | Text-to-speech (ElevenLabs swappable) |
| 4 — LLM | Claude Haiku / Sonnet | Conversation intelligence |
| 5 — Automation | n8n (self-hosted) | Post-call workflows, integrations |
| 6 — Memory | Supabase + Pinecone + Mem0 | Structured data, search, caller memory |
| 7 — Training | AWS S3 + AssemblyAI | Recordings, transcription, training data |

---

## Starting a New Client Build

1. Read `CLIENT_INTAKE.md` fully before writing any code
2. Read `src/agents/reference-agent.ts` to understand the agent pattern
3. Create `src/agents/[client-name]-agent.ts` modeled on the reference agent
4. Run `grep -r "TODO:CONFIGURE" src/` and resolve every result using the
   intake document
5. Verify `ENABLE_PINECONE` and `ENABLE_MEM0` flags match client needs
6. Update `dev_journal.md` with what was built and any decisions made

Never modify `reference-agent.ts` — it is a read-only pattern document.

---

## Project Structure

- `src/layers/` — One directory per architectural layer. Never mix concerns
  between layers.
- `src/agents/` — Agent configs. `reference-agent.ts` is the pattern.
  Client agents live here named `[client-name]-agent.ts`.
- `src/types/` — Shared TypeScript interfaces
- `scripts/` — Setup, seed, and utility scripts
- `supabase/migrations/` — SQL migrations, numbered sequentially (001_, 002_)
- `n8n/workflows/` — n8n workflow JSON files

---

## Language and Runtime

- TypeScript throughout — all source in `src/`
- Node.js runtime
- Zod for all config and env validation
- Express for the webhook server
- Structured JSON logging via `src/lib/logger.ts` — never use console.log
- No frontend — API and CLI only

---

## Key Conventions

### Config and Secrets
- All secrets in `.env` — never committed
- `.env.example` documents every variable with comments
- `src/config.ts` validates all env vars with Zod at startup
- Clients who self-host get their own accounts and keys — never share keys
  between client deployments

### TODO:CONFIGURE Markers
Every business-specific placeholder is marked `TODO:CONFIGURE`.
When starting a client build, grep for every instance and resolve it
using CLIENT_INTAKE.md before deploying.

```bash
grep -r "TODO:CONFIGURE" src/
```

### Memory Feature Flags
Pinecone and Mem0 are enabled per-client via env vars:
- `ENABLE_PINECONE=true` — enables knowledge base search
- `ENABLE_MEM0=true` — enables persistent caller memory

Both default to `true`. Set to `false` for simple clients that don't need
semantic search or cross-call memory. Supabase is always on — it is the
system of record and cannot be disabled.

### Concurrency
`MAX_CONCURRENT_CALLS` controls how many simultaneous calls the webhook
server will process. When the limit is reached, new calls receive a
graceful busy response rather than a timeout or crash.
Default: 20. Adjust per Railway instance size.

### Tool Handlers — Three Rules
1. Every tool handler must use `withTimeout` from `tool-utils.ts` (5s max)
2. Every tool must have a fallback message for failures and timeouts
3. Every tool must send a backchannel acknowledgment immediately before
   doing async work so the caller never hears silence

Backchannel pattern (required on every tool):
```typescript
// Send immediately — before any async operation
await vapiClient.sendBackchannel(callId, "Let me check that for you...");
// Now do the actual work
const result = await withTimeout(5000, FALLBACK_MSG, () => doWork());
```

### Webhook Security
All incoming Vapi webhooks must be verified against `VAPI_WEBHOOK_SECRET`
using HMAC-SHA256 before any processing occurs. This is implemented in
`webhook-handler.ts` and must never be removed or bypassed.
Return 401 immediately on signature failure — do not log the payload.

### Database
- PostgreSQL with pgvector extension
- Migrations in `supabase/migrations/` — always add new migrations with
  the next sequential number
- Parameterized queries only — never string interpolation in SQL
- Tables: `agent_configs`, `callers`, `calls`, `transcripts`, `training_data`
- Every embedding column has a companion `embedding_model TEXT` column
  recording which model generated it (e.g. `text-embedding-ada-002`)

### n8n Workflows
- Deployed programmatically via the n8n API — never manually imported
- Workflow JSON files live in `src/layers/automation/workflows/`
- `n8n/workflows/` contains backup copies only
- All external API calls in workflows use retry-with-backoff:
  3 attempts, exponential backoff starting at 1s

### Vapi Integration
- Agent configs built programmatically via `base-agent.ts`
- Webhook events routed through `webhook-handler.ts`
- All incoming webhooks verified via HMAC before processing
- Mid-call tool calls: Vapi → webhook → tool handler → response to Vapi
- Business hours enforced via Vapi schedule config AND in system prompt

### Memory Abstraction
Never call Mem0 directly from tool handlers. Always use the
`MemoryClient` interface from `src/layers/memory/memory-client.ts`.
This allows swapping Mem0 for an alternative (e.g. Zep) without
touching tool handler code.

### Custom Tools
When a client needs a tool not in the default set, use
`src/layers/tools/custom-tool-template.ts` as the starting pattern.
Follow the same interface: `withTimeout`, fallback message, backchannel
acknowledgment, typed input/output.

### Error Handling
- Wrap all external API calls in try/catch with meaningful error messages
- Log errors with context using `logger.error()`: service, operation, IDs
- Tool handlers must never let an error reach the caller as silence —
  always return the fallback message

### Logging
Use `src/lib/logger.ts` for all logging. Never use `console.log`.
Logger outputs structured JSON with: timestamp, level, service, callId
(when available), and message. This feeds Railway's log drain.

---

## Commands

```bash
docker compose up            # Start local infrastructure
npm run setup                # Validate env, test all API connections,
                             # run migrations, deploy n8n workflows
npm run validate             # Quick connection check — runs after setup
                             # to confirm all services are reachable
npm run build                # Compile TypeScript
npm run dev                  # Start webhook server (development)
npm run create-agent         # Create and deploy an agent to Vapi
npm run seed                 # Seed agent config from CLIENT_INTAKE.md
npm run seed-knowledge       # Ingest client docs into Pinecone
npm run create-outbound-call # Initiate an outbound call (stub)
```

---

## Deployment

The webhook server deploys to Railway by default.
See `DEPLOYMENT.md` for full setup instructions including:
- ngrok for local webhook testing
- Telnyx → Vapi number routing
- n8n Cloud as alternative to self-hosted
- Production checklist (encryption, log drain, key rotation)

`railway.toml` is included — deployment is one command: `railway up`

---

## Business Hours Enforcement

Business hours from CLIENT_INTAKE.md must be applied in TWO places:
1. The agent's system prompt (so the LLM knows to refuse after-hours)
2. Vapi's schedule config (so calls are rejected at the infrastructure
   level outside hours, not just by the LLM)

Both must be configured. Never rely on just one.

---

## DO NOT

- Modify `reference-agent.ts` — read it, never write to it
- Fork this repo for client work — always clone and push to a new private repo
- Use Twilio instead of Telnyx
- Use Retell instead of Vapi
- Hardcode API keys or secrets anywhere in source files
- Write raw SQL with string interpolation
- Skip Zod validation for new config values
- Create n8n workflows manually — always use the API deployment pattern
- Share API keys between client deployments
- Add a frontend or dashboard — this is API and CLI only
- Add dependencies without clear justification in dev_journal.md
- Skip the `withTimeout` wrapper on any tool handler
- Skip the backchannel acknowledgment on any tool handler
- Call Mem0 directly — always use the MemoryClient interface
- Deploy without confirming webhook signature verification is active
- Use `console.log` — always use `logger` from `src/lib/logger.ts`