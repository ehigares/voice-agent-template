# Voice Agent Template — Build Specification

## 1. Purpose

A private agency template for building AI-powered voice agents for business
clients. Each client gets their own private repo cloned from this template.
The template is maintained separately and never deployed directly.

This is not a public open-source project.

---

## 2. Agency Workflow

```
1. New client signed → fill out CLIENT_INTAKE.md
2. Clone template: git clone voice-agent-template [client]-voice-agent
3. cd [client]-voice-agent
4. git remote set-url origin [new private repo URL]
5. git push -u origin main
6. Start Claude Code → reads CLIENT_INTAKE.md + reference-agent.ts
7. Claude Code builds [client]-agent.ts, resolves all TODO:CONFIGURE,
   sets memory feature flags, configures business hours in two places
8. Deploy to Railway (builder-managed) or hand off full repo (self-host)
9. Test, iterate, go live
```

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ Layer 1 — Telephony (Telnyx)                       ~$0.01/min   │
│ SIP trunking · phone number provisioning · REST API             │
└───────────────────────────┬──────────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ Layer 2 — Orchestration (Vapi)                     ~$0.05/min   │
│ JSON config · webhooks · function calling · HMAC verification   │
│ Schedule config for business hours enforcement                  │
│ MAX_CONCURRENT_CALLS cap with graceful busy response            │
└──────┬────────────────────┬───────────────────────┬──────────────┘
       ▼                    ▼                       ▼
┌─────────────┐  ┌──────────────────┐  ┌───────────────────────────┐
│ Layer 3a    │  │ Layer 3b         │  │ Layer 4 — LLM             │
│ STT         │  │ TTS              │  │ Claude Haiku (speed)      │
│ Deepgram    │  │ Cartesia Sonic   │  │ Claude Sonnet (reasoning) │
│ Nova-3      │  │ ElevenLabs swap  │  │                           │
└─────────────┘  └──────────────────┘  └───────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ Layer 5 — Automation (n8n, self-hosted)                         │
│ Vapi webhooks → n8n workflows → CRM, calendar, email, Slack     │
│ All external calls use retry-with-backoff (3 attempts, exp.)    │
│ Deployed programmatically via n8n API                           │
└───────────────────────────┬──────────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ Layer 6 — Memory (Supabase always on; Pinecone + Mem0 flagged)  │
│ Supabase: call logs, transcripts, structured data (Postgres)    │
│ Pinecone: knowledge base search [ENABLE_PINECONE=true/false]    │
│ Mem0: persistent caller memory [ENABLE_MEM0=true/false]         │
│ MemoryClient interface abstracts Mem0 — swappable               │
└───────────────────────────┬──────────────────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ Layer 7 — Training Loop (S3 + AssemblyAI)                       │
│ Record → transcribe → tag → score → save as training data       │
│ recording_archived flag ensures no data loss on workflow retry  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Technology Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Orchestration | Vapi over Retell | API-first, full JSON control, Claude Code operable |
| Telephony | Telnyx over Twilio | Cheaper at scale, equally clean API |
| STT | Deepgram Nova-3 | Best real-time WER (6.84%) and <300ms latency |
| TTS default | Cartesia Sonic | 90ms latency, best cost/quality ratio |
| TTS premium | ElevenLabs (swappable) | 75ms, more expressive — swap via env var |
| Automation | n8n self-hosted | Data control, no per-execution fees, API deployable |
| Hosting | Railway | Simplest multi-client management, deploy from repo |
| Memory default | All 3 tiers on | Every client benefits; feature flags allow per-client opt-out |
| Repo model | Clone not fork | Severs public GitHub link, keeps client repos independent |

---

## 5. Database Schema

### agent_configs
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Agent display name |
| industry | TEXT | Industry category |
| description | TEXT | What this agent does |
| vapi_agent_id | TEXT | ID in Vapi's system |
| vapi_config | JSONB | Full Vapi configuration |
| system_prompt | TEXT | Agent system prompt |
| model | TEXT | Claude model ID |
| voice_provider | TEXT | cartesia or elevenlabs |
| voice_id | TEXT | Voice ID from provider |
| tools | JSONB | Tool definitions |
| is_active | BOOLEAN | Whether agent is deployed |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### callers
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| phone_number | TEXT | Unique phone number |
| name | TEXT | Caller name |
| email | TEXT | Caller email |
| mem0_user_id | TEXT | Mem0 persistent memory ID |
| tags | TEXT[] | Labels (VIP, new, etc.) |
| notes | TEXT | Free-form notes |
| metadata | JSONB | Flexible extra data |
| first_call_at | TIMESTAMPTZ | |
| last_call_at | TIMESTAMPTZ | |
| total_calls | INT | Lifetime call count |
| created_at | TIMESTAMPTZ | |

### calls
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| vapi_call_id | TEXT | Unique — used for deduplication |
| agent_id | UUID | FK to agent_configs |
| caller_id | UUID | FK to callers |
| phone_number | TEXT | Caller phone number |
| direction | TEXT | inbound or outbound |
| status | TEXT | completed, failed, missed |
| started_at | TIMESTAMPTZ | |
| ended_at | TIMESTAMPTZ | |
| duration_seconds | INT | |
| recording_url | TEXT | Vapi temporary URL (expires) |
| s3_key | TEXT | S3 archive key |
| recording_archived | BOOLEAN | TRUE once S3 upload confirmed |
| recording_archived_at | TIMESTAMPTZ | |
| cost_cents | INT | Estimated call cost |
| metadata | JSONB | Extra Vapi call data |
| created_at | TIMESTAMPTZ | |

### transcripts
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| call_id | UUID | FK to calls |
| speaker | TEXT | agent or caller |
| content | TEXT | What was said |
| start_ms | INT | Timestamp offset |
| end_ms | INT | End offset |
| embedding | VECTOR(1536) | pgvector embedding |
| embedding_model | TEXT | Model that generated the embedding |
| created_at | TIMESTAMPTZ | |

### training_data
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| call_id | UUID | FK to calls |
| transcript | TEXT | Full call transcript |
| tags | TEXT[] | Auto-generated topics/intents |
| sentiment_score | FLOAT | -1 to 1 |
| quality_score | FLOAT | 0 to 1 |
| outcome | TEXT | booked, resolved, escalated, etc. |
| notes | TEXT | Auto-generated analysis |
| embedding | VECTOR(1536) | Semantic search embedding |
| embedding_model | TEXT | Model that generated the embedding |
| created_at | TIMESTAMPTZ | |

---

## 6. Default Tool Set

Every agent includes these tools out of the box:

| Tool | Trigger | Action |
|------|---------|--------|
| `lookup-caller` | Call starts | Check caller history + Mem0 |
| `search-knowledge` | Agent needs info | Query Pinecone knowledge base |
| `check-availability` | Scheduling request | Trigger n8n calendar workflow |
| `book-appointment` | Booking confirmed | Trigger n8n booking workflow |
| `transfer-to-human` | Escalation needed | Vapi warm transfer to human |

All tool handlers follow the three-rule pattern:
1. Send backchannel acknowledgment immediately
2. Run async work inside `withTimeout(5000, fallbackMsg, fn)`
3. Return fallback message if timeout or error — never silence

For client-specific tools, use `custom-tool-template.ts` as the starting
point — it implements all three rules by default.

---

## 7. Tool Execution Flow

```
Caller speaks
  → Vapi transcribes (Deepgram)
  → Claude decides to call a tool
  → Vapi sends function_call webhook
  → webhook-handler.ts verifies HMAC signature → 401 if invalid
  → Concurrency check → busy response if MAX_CONCURRENT_CALLS reached
  → Routes to tool handler
  → Handler sends backchannel acknowledgment immediately
  → withTimeout(5000) runs async work
    → success: return result → Claude speaks answer
    → timeout/fail: return fallback message → Claude speaks fallback
```

---

## 8. Training Pipeline

Trigger: Every call ending fires a Vapi webhook.

```
1. call.ended webhook received and HMAC verified
2. Deduplication: check if vapi_call_id already in calls table
   → if exists: return 200, skip processing
   → if new: continue
3. n8n call-ended workflow (all steps use retry-with-backoff):
   a. Save call metadata → calls table
   b. Create/update caller → callers table
   c. Upload .mp3 → S3 → set recording_archived = TRUE, archived_at = now()
   d. Transcribe → AssemblyAI (speaker diarization)
   e. Save transcript segments → transcripts table
      (embedding + embedding_model columns populated)
   f. Auto-tag: sentiment, topics, outcome
   g. Score call quality
   h. Save → training_data table
      (embedding + embedding_model columns populated)
```

---

## 9. n8n Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| call-ended | Vapi webhook | Full training pipeline |
| appointment-booking | Tool handler webhook | Calendar check and booking |
| crm-update | Vapi webhook | Contact creation/update |

All workflows use retry-with-backoff on external API nodes:
- 3 retry attempts
- Exponential backoff starting at 1 second
- Error path logs to Supabase `workflow_errors` table

---

## 10. Memory Feature Flags

| Flag | Default | Effect when false |
|------|---------|-------------------|
| `ENABLE_PINECONE` | true | knowledge search tool returns empty, no ingestion |
| `ENABLE_MEM0` | true | caller memory skipped, MemoryClient returns null |

Supabase is always on — structured call data is always stored regardless
of these flags.

Set both to false for the simplest possible client deployment (FAQ bot,
basic receptionist). Enable as the client's needs grow.

---

## 11. Concurrency

`MAX_CONCURRENT_CALLS` (default: 20) limits simultaneous active webhook
processing threads. When reached:
- New webhook requests receive HTTP 429 with a `Retry-After` header
- Vapi retries automatically per its webhook retry policy
- Callers are not affected — the call continues, tool responses are delayed

Tune this value based on Railway instance size and expected call volume.

---

## 12. Observability

Minimum viable observability for this template:

- **Structured logging**: all logs via `logger.ts`, output as JSON to stdout
- **Call failure tracking**: failed calls written to `calls` table with
  `status = 'failed'` and error context in `metadata`
- **Workflow error log**: n8n workflow failures written to
  `workflow_errors` table in Supabase (call_id, workflow, error, timestamp)
- **Health endpoint**: `GET /health` returns service status and version
- **Railway log drain**: configured in DEPLOYMENT.md — logs → external sink

---

## 13. Hosting

| Component | Default | Self-host alternative |
|-----------|---------|----------------------|
| Webhook server | Railway | Any Node.js host |
| n8n | Docker (self-hosted) | n8n Cloud |
| Database | Supabase | Self-hosted Postgres |
| Storage | AWS S3 | MinIO (local dev) |

---

## 14. Docker Compose Services (local dev)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| postgres | pgvector/pgvector:pg15 | 5432 | App database (voice_agent) |
| n8n | n8nio/n8n | 5678 | Workflows (n8n_db — separate) |
| minio | minio/minio | 9000/9001 | Local S3 substitute |

n8n uses database `n8n_db` — separate from the application database
`voice_agent`. This isolates n8n's internal credential storage (which
contains API keys) from caller PII.

---

## 15. Environment Variables

```bash
# Layer 1 — Telephony
TELNYX_API_KEY=
TELNYX_PHONE_NUMBER=

# Layer 2 — Orchestration
VAPI_API_KEY=
VAPI_WEBHOOK_SECRET=          # REQUIRED — used for HMAC verification

# Layer 3 — Speech
DEEPGRAM_API_KEY=
CARTESIA_API_KEY=
ELEVENLABS_API_KEY=           # Optional — only if swapping TTS provider

# Layer 4 — LLM
ANTHROPIC_API_KEY=

# Layer 5 — Automation
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=
N8N_PUBLIC_URL=               # REQUIRED in production — public URL for
                              # n8n webhooks. Use ngrok for local testing.

# Layer 6 — Memory
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ENABLE_PINECONE=true          # Set false to disable knowledge base
PINECONE_API_KEY=
PINECONE_INDEX=voice-agent
ENABLE_MEM0=true              # Set false to disable persistent caller memory
MEM0_API_KEY=

# Embeddings
OPENAI_API_KEY=               # REQUIRED — used for pgvector embeddings
EMBEDDING_MODEL=text-embedding-ada-002
EMBEDDING_DIMENSIONS=1536     # Must match EMBEDDING_MODEL output dimensions

# Layer 7 — Training
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
S3_BUCKET=voice-agent-recordings
STORAGE_ENDPOINT=             # Leave blank for AWS S3.
                              # Set to http://localhost:9000 for local MinIO.
ASSEMBLYAI_API_KEY=

# Server
WEBHOOK_PORT=3000
MAX_CONCURRENT_CALLS=20       # Tune per Railway instance size
NODE_ENV=development
```

---

## 16. Setup Flow

```bash
1. Clone template → rename → push to new private client repo
2. Fill in CLIENT_INTAKE.md
3. cp .env.example .env → fill in all API keys
4. docker compose up -d
5. npm install
6. npm run setup        # validates env, runs migrations, deploys workflows
7. npm run validate     # confirms all services are reachable
8. npm run dev
9. ngrok http 3000      # copy public URL
10. Set N8N_PUBLIC_URL and WEBHOOK_URL in .env → restart
11. npm run create-agent
```

---

## 17. File Manifest

```
voice-agent-template/
├── CLAUDE.md
├── build_spec.md
├── dev_journal.md
├── CLIENT_INTAKE.md               ← filled out per client before build
├── DEPLOYMENT.md
├── railway.toml
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md
│
├── scripts/
│   ├── setup.ts                   # env validation, migrations, n8n deploy
│   ├── validate.ts                # connection check for all services
│   ├── seed.ts
│   ├── seed-knowledge.ts
│   └── create-outbound-call.ts    # stub for future outbound use
│
├── src/
│   ├── index.ts
│   ├── config.ts                  # Zod-validated env
│   ├── types/
│   │   └── index.ts
│   ├── lib/
│   │   └── logger.ts              # structured JSON logger — use everywhere
│   │
│   └── layers/
│       ├── telephony/
│       │   └── telnyx.ts
│       ├── orchestration/
│       │   ├── vapi-client.ts
│       │   ├── vapi-types.ts
│       │   └── webhook-handler.ts # HMAC verification + concurrency cap
│       ├── speech/
│       │   ├── stt.ts
│       │   └── tts.ts
│       ├── llm/
│       │   └── model-config.ts
│       ├── automation/
│       │   ├── n8n-client.ts
│       │   └── workflows/
│       │       ├── call-ended.json
│       │       ├── appointment-booking.json
│       │       └── crm-update.json
│       ├── memory/
│       │   ├── memory-client.ts   # MemoryClient interface — use this
│       │   ├── mem0-adapter.ts    # Mem0 implementation of MemoryClient
│       │   ├── supabase-client.ts
│       │   ├── queries.ts
│       │   ├── pinecone-client.ts
│       │   └── vector-search.ts
│       ├── tools/
│       │   ├── tool-definitions.ts
│       │   ├── tool-utils.ts          # withTimeout wrapper
│       │   ├── custom-tool-template.ts # copy this for new client tools
│       │   ├── lookup-caller.ts
│       │   ├── search-knowledge.ts
│       │   ├── check-availability.ts
│       │   ├── book-appointment.ts
│       │   └── transfer-to-human.ts
│       └── training/
│           ├── s3-upload.ts
│           ├── transcribe.ts
│           ├── auto-tag.ts
│           ├── score.ts
│           └── pipeline.ts
│
├── src/agents/
│   ├── base-agent.ts
│   ├── reference-agent.ts         # READ ONLY — pattern for Claude Code
│   └── types.ts
│
├── supabase/migrations/
│   ├── 001_enable_extensions.sql
│   ├── 002_create_agent_configs.sql
│   ├── 003_create_callers.sql
│   ├── 004_create_calls.sql
│   ├── 005_create_transcripts.sql
│   ├── 006_create_training_data.sql
│   ├── 007_add_recording_archived.sql
│   └── 008_add_embedding_model_columns.sql
│
└── n8n/workflows/                 # backup copies
```

---

## 18. Cost Estimates

| Config | Est. cost/min |
|--------|--------------|
| Haiku + Cartesia | ~$0.10 |
| Sonnet + Cartesia | ~$0.28 |
| Sonnet + ElevenLabs | ~$0.32 |

Storage (S3, Supabase) negligible at low-to-medium volume.
Pinecone cost scales with vector count — negligible below ~1M vectors.