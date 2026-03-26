# Dev Journal — Voice Agent Template

> This journal is maintained by Claude Code.
> READ THIS at the start of every session before touching any code.
> ADD AN ENTRY for every significant decision, change, or fix.
> The build phases below are the authoritative task list — check them
> before deciding what to work on next.

---

## Project Context

Private agency template for building AI voice agents for business clients.
One private repo per client, cloned (not forked) from this template.
The template itself is never deployed directly.

Builder: ehigares
Runtime: Claude Code (multiple instances)
Stack: Telnyx → Vapi → Deepgram Nova-3 + Cartesia → Claude →
       n8n → Supabase + Pinecone + Mem0 → S3 + AssemblyAI

---

## Architecture Decisions Log

### Why Vapi over Retell
Vapi is API-first with full JSON control over every agent parameter.
Claude Code can create, modify, and redeploy agents entirely via API.
Retell has better out-of-box feel but limits programmatic control.
Decision: Vapi. Locked. Do not revisit.

### Why Telnyx over Twilio
Cheaper at scale, equally capable REST API, better for multi-client
agency deployments where per-minute costs compound.
Decision: Telnyx. Locked. Do not revisit.

### Why Cartesia as default TTS, ElevenLabs swappable
Cartesia Sonic: 90ms latency, best cost/quality for high volume.
ElevenLabs: 75ms, more expressive, higher cost.
Decision: Cartesia default, ElevenLabs available via env var swap.

### Why all 3 memory tiers on by default with feature flags
Every client benefits from full memory. Feature flags (ENABLE_PINECONE,
ENABLE_MEM0) allow turning tiers off per-client when not needed.
Supabase always on — it is the non-negotiable system of record.
Decision: All 3 on by default, flags for per-client opt-out.

### Why MemoryClient abstraction over direct Mem0 calls
Mem0 is a proprietary SaaS. If it fails or changes pricing, all
deployments break simultaneously. The MemoryClient interface isolates
this risk — swap the adapter without touching tool handler code.
Decision: Always use MemoryClient interface. mem0-adapter.ts is
the current implementation. Never call Mem0 SDK directly.

### Why Railway for hosting
Simplest multi-client management. Deploy from GitHub repo, env vars
in UI, always-on service, ~$5/month per deployment.
Decision: Railway as default. Documented in DEPLOYMENT.md.

### Why clone not fork for client repos
Forking creates a public GitHub link between template and client repo.
Cloning and pushing to a new private remote severs that link completely.
Protects the toolchain, keeps client repos professionally independent.
Decision: Clone workflow. Documented in CLAUDE.md and README.

### Why reference-agent.ts replaces multiple example agents
This is an agency tool. Multiple example agents are maintenance burden —
every stack change requires updating all examples. One heavily-commented
read-only reference gives Claude Code the pattern without the overhead.
Decision: One reference-agent.ts (read-only). No example agents.

### Why n8n uses a separate database (n8n_db)
n8n stores workflow credentials (including API keys) in its database.
Sharing the app database places API keys alongside caller PII.
Separate DB isolates concerns, simplifies backups, prevents risk.
Decision: n8n_db separate from voice_agent in docker-compose.

### Why withTimeout + backchannel on all tool handlers
Vapi waits up to ~20s for tool responses. Silence kills UX.
5s timeout prevents indefinite hangs. Backchannel acknowledgment
("Let me check that for you...") eliminates perceived silence before
the timeout even kicks in. Both are required on every tool.
Decision: Three-rule pattern mandatory. See CLAUDE.md.

### Why transfer-to-human is a default tool on every agent
Every business has callers who need a human. Without an escape path
the agent loops or confabulates. Must be wired by default.
Decision: transfer-to-human in base-agent.ts default tool list.

### Why OpenAI for embeddings
Anthropic does not offer a standalone embeddings API.
pgvector VECTOR(1536) matches OpenAI text-embedding-ada-002.
EMBEDDING_MODEL and EMBEDDING_DIMENSIONS are env-var configurable.
embedding_model column stored per record to track drift.
Decision: OpenAI required for embeddings. Marked in .env.example.

### Why MAX_CONCURRENT_CALLS cap
Single Railway Node instance handles ~20-50 concurrent webhook threads
safely. Without a cap, a call burst causes 5xx errors and dropped data.
Graceful busy response + Vapi retry policy handles overflow cleanly.
Decision: MAX_CONCURRENT_CALLS=20 default, configurable per deployment.

### Why retry-with-backoff on n8n workflows
Transient S3, AssemblyAI, and Pinecone failures will happen.
Without retry, the call-ended workflow fails silently and training data
is permanently lost. 3 attempts with exponential backoff handles the
vast majority of transient failures.
Decision: All external API nodes in n8n use retry-with-backoff.

### Why embedding_model column on transcript and training_data tables
Embedding models change and dimensions can drift. Storing the model
name per record makes it possible to identify stale embeddings,
run targeted re-embedding jobs, and audit quality over time.
Decision: embedding_model TEXT column on both tables. Migration 008.

### Why structured JSON logging, never console.log
Railway's log drain works on structured JSON. console.log produces
unqueryable plaintext. Structured logs with callId context make
debugging production issues tractable.
Decision: logger.ts everywhere. console.log banned. See CLAUDE.md.

### Why business hours enforced in two places
LLM-only enforcement is unreliable — the model can be persuaded or
confabulated out of hours. Vapi schedule config enforces at the
infrastructure level regardless of LLM behavior.
Decision: system prompt AND Vapi schedule config, both required.

---

## Build Phases — Authoritative Task List

### Phase 1 — Structural cleanup
STATUS: COMPLETE

- [x] Delete src/agents/examples/ directory and all three example agents
      (dental-receptionist.ts, real-estate-qualifier.ts, customer-support.ts)
- [x] Rename src/agents/generic.ts → src/agents/reference-agent.ts
- [x] Rewrite reference-agent.ts as heavily commented read-only pattern
      document with TODO:CONFIGURE on every configurable field
- [x] Search entire codebase for all imports and references to deleted files
      and old generic.ts path — update or remove every one
- [x] Update build_spec.md file manifest
- [x] Update CLAUDE.md references
- [x] Update README.md
- [x] Update dev_journal.md (this file)

### Phase 2 — Core fixes
STATUS: COMPLETE

- [x] Implement Vapi webhook HMAC-SHA256 signature verification in
      webhook-handler.ts using VAPI_WEBHOOK_SECRET
- [x] Add MAX_CONCURRENT_CALLS concurrency cap to webhook-handler.ts
      with graceful 429 + Retry-After response on overflow
- [x] Fix n8n WEBHOOK_URL in docker-compose: replace hardcoded
      localhost:5678 with ${N8N_PUBLIC_URL:-http://localhost:5678}
- [x] Separate n8n database from application database in docker-compose
      (n8n uses n8n_db, application uses voice_agent)
- [x] Add STORAGE_ENDPOINT env var to S3 client config for MinIO/AWS swap
- [x] Create src/layers/tools/tool-utils.ts with withTimeout wrapper
- [x] Update all existing tool handlers to use withTimeout + backchannel
- [x] Create src/layers/tools/transfer-to-human.ts with Vapi transfer API
- [x] Add transfer-to-human to base-agent.ts default tool list
- [x] Create src/layers/memory/memory-client.ts interface
- [x] Create src/layers/memory/mem0-adapter.ts implementing the interface
- [x] Update all tools to use MemoryClient, never Mem0 SDK directly
- [x] Add ENABLE_PINECONE and ENABLE_MEM0 feature flags to config.ts
- [x] Gate Pinecone and Mem0 calls behind their respective flags
- [x] Add embedding_model column to transcripts table
- [x] Add embedding_model column to training_data table
- [x] Create migration 007_add_recording_archived.sql
- [x] Create migration 008_add_embedding_model_columns.sql
- [x] Add vapi_call_id deduplication check to call-ended workflow
- [x] Add retry-with-backoff to all n8n workflow external API nodes
- [x] Add workflow_errors table for n8n failure logging
- [x] Create src/lib/logger.ts structured JSON logger
- [x] Replace all console.log with logger throughout codebase
- [x] Add OPENAI_API_KEY as REQUIRED in .env.example with comment
- [x] Add EMBEDDING_MODEL and EMBEDDING_DIMENSIONS to .env.example
- [x] Populate embedding_model field when writing embeddings

### Phase 3 — Template completeness
STATUS: PENDING

- [ ] Rewrite reference-agent.ts as complete pattern document:
      - every config option present and commented
      - TODO:CONFIGURE on every business-specific field
      - business hours wired to both system prompt and Vapi schedule
      - all 5 default tools included
      - memory flags referenced
- [ ] Create src/layers/tools/custom-tool-template.ts with full
      three-rule pattern (backchannel + withTimeout + fallback)
      and detailed comments on how to add client-specific tools
- [ ] Add TODO:CONFIGURE markers to every business-specific
      placeholder across all files
- [ ] Add business hours enforcement to base-agent.ts:
      both system prompt section and Vapi schedule config section
- [ ] Create scripts/validate.ts — connection check for all services,
      run after setup to confirm everything is reachable
- [ ] Create scripts/create-outbound-call.ts stub with --phone and
      --assistant-id flags and Vapi outbound call API wiring
- [ ] Add GET /health endpoint to Express server returning:
      { status, timestamp, version, services: { supabase, pinecone, mem0 } }
- [ ] Update CLIENT_INTAKE.md with memory configuration section
      (already done — verify it's in the repo)

### Phase 4 — Documentation and deployment
STATUS: PENDING

- [ ] Create DEPLOYMENT.md covering:
      - Local dev setup with ngrok
      - Telnyx phone number → Vapi routing
      - Setting VAPI server URL to webhook endpoint
      - Railway deployment (railway up, env vars)
      - n8n Cloud as alternative to self-hosted Docker
      - Production checklist:
        * Enable Railway volume encryption
        * Configure log drain
        * Rotate all API keys from template defaults
        * Set N8N_PUBLIC_URL to production domain
        * Verify HMAC verification is active (not bypassed)
        * Set NODE_ENV=production
        * Review MAX_CONCURRENT_CALLS for expected volume
- [ ] Create railway.toml with correct service config
- [ ] Rewrite README.md:
      - Agency model framing (not public open-source)
      - Clone not fork instructions
      - Quick start pointing to CLIENT_INTAKE.md first
      - Add compliance notice section
- [ ] Final consistency review of all .md files

---

## Change Log

### [Week 1 — Initial build]
- 7-layer architecture implemented in TypeScript
- All layers stubbed and wired
- Supabase migrations 001-006 created
- Docker compose with postgres, n8n, minio
- README, CLAUDE.md, build_spec.md written
- Example agents created (dental, real estate, support) — TO BE REPLACED

### [Planning session — peer review incorporated]
- Peer review by o3 completed
- 17 findings reviewed and triaged
- Architecture decisions updated based on accepted findings
- Phase 2 expanded with: concurrency cap, backchannel pattern,
  retry-with-backoff, feature flags, embedding model tracking
- Phase 3 expanded with: custom tool template, memory abstraction,
  business hours enforcement, validate script
- Phase 4 expanded with: production checklist in DEPLOYMENT.md
- All four .md documents rewritten to final spec
- Ready to hand to Claude Code — start with Phase 1

### [Phase 2 — Core fixes]
- Created src/lib/logger.ts — structured JSON logger (timestamp, level, service, callId)
- Replaced all console.log in src/ with logger calls
- Implemented HMAC-SHA256 webhook signature verification in webhook-handler.ts
  (crypto.timingSafeEqual, raw body capture, 401 on failure, skippable in dev)
- Added MAX_CONCURRENT_CALLS concurrency cap with 429 + Retry-After
- Separated n8n database (n8n_db) from app database (voice_agent) in docker-compose
  via docker/init-db.sql init script
- Fixed WEBHOOK_URL to use ${N8N_PUBLIC_URL:-http://localhost:5678}
- Added STORAGE_ENDPOINT to S3 client for MinIO/AWS swap (forcePathStyle when set)
- Created tool-utils.ts with withTimeout wrapper (Promise.race + timeout)
- Updated all 4 tool handlers with withTimeout + fallback messages
- Created transfer-to-human.ts using Vapi call control API
- Added TRANSFER_TO_HUMAN to tool-definitions.ts and reference-agent.ts
- Created memory-client.ts interface + mem0-adapter.ts implementation
- Deleted old mem0-client.ts — all code now uses memoryClient abstraction
- Added ENABLE_PINECONE and ENABLE_MEM0 feature flags to config.ts
  (Zod string → boolean transform, default true)
- Gated Pinecone in search-knowledge.ts and Mem0 in lookup-caller.ts + pipeline.ts
- Added embedding_model to Transcript and TrainingData types
- Pipeline now populates embedding_model from config.EMBEDDING_MODEL
- Created migrations: 007 (recording_archived), 008 (embedding_model), 009 (workflow_errors)
- Updated call-ended workflow with vapi_call_id deduplication check
- Added retry-with-backoff (3 tries, exponential) to all n8n workflow HTTP nodes
- Updated .env.example with all new vars: feature flags, embeddings, storage, concurrency
- vector-search.ts now uses configurable EMBEDDING_MODEL and EMBEDDING_DIMENSIONS

### [2026-03-26 — Phase 1+2 committed and pushed]
- All Phase 1 (structural cleanup) and Phase 2 (core fixes) work committed
  in a single commit: `phase-1+2: structural cleanup, core fixes, security hardening`
- 31 files changed, 816 insertions, 139 deletions
- Added Session End Protocol section to CLAUDE.md
- Pushed to GitHub main branch — confirmed successful

### [Phase 1 — Structural cleanup]
- Deleted SETUP_GUIDE.md (wrong audience, contradicts agency model)
- Updated E2E_TEST_PLAN.md to reference reference-agent.ts + CLIENT_INTAKE.md
  instead of example agents and fork workflow
- Deleted src/agents/examples/ (dental-receptionist.ts, real-estate-qualifier.ts,
  customer-support.ts) — replaced by single reference-agent.ts
- Renamed generic.ts → reference-agent.ts, rewritten as heavily commented
  read-only pattern document with TODO:CONFIGURE on every configurable field
- Updated scripts/seed.ts — imports ReferenceAgent, seeds single agent
- build_spec.md already correct (updated in planning session)
- CLAUDE.md already correct (updated in planning session)
- README.md rewritten: agency model framing, clone-not-fork, reference-agent.ts
  pattern, compliance notice, no example agents
- dev_journal.md Phase 1 marked COMPLETE

---

## Known Issues / Watch List

- n8n WEBHOOK_URL now uses N8N_PUBLIC_URL env var (Phase 2 done)
- Webhook HMAC verification implemented (Phase 2 done)
- Example agents deleted — replaced by reference-agent.ts (Phase 1 done)
- recording_archived column added — migration 007 (Phase 2 done)
- embedding_model column added — migration 008 (Phase 2 done)
- All console.log replaced with structured logger (Phase 2 done)
- Concurrency cap implemented — MAX_CONCURRENT_CALLS (Phase 2 done)
- Docker volumes need recreating after n8n DB separation — run
  `docker compose down -v && docker compose up -d` once to reset