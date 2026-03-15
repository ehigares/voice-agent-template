# Voice Agent Template — Build Specification

## 1. Purpose

A production-ready, open-source template for building AI-powered phone agents. Designed to be forked from GitHub and customized for any industry — dental offices, real estate, customer support, or any business that handles phone calls.

The template wires together seven layers into a single, cohesive system that can be configured and deployed entirely through code and API calls.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 1 — Telephony (Telnyx)                          ~$0.01/min   │
│ SIP trunking · phone number provisioning · REST API                │
└────────────────────────────┬────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 2 — Orchestration (Vapi)                        ~$0.05/min   │
│ Full JSON config · webhooks on every event · 4,200+ config points  │
│ Claude Code creates/modifies/redeploys agents via API              │
└──────┬─────────────────────┬────────────────────────┬───────────────┘
       ▼                     ▼                        ▼
┌──────────────┐  ┌─────────────────┐  ┌──────────────────────────────┐
│ Layer 3a STT │  │ Layer 3b TTS    │  │ Layer 4 — LLM                │
│ Deepgram     │  │ Cartesia Sonic  │  │ Claude Haiku (speed)         │
│ Nova-3       │  │ (swap:          │  │ Claude Sonnet (reasoning)    │
│ 6.84% WER    │  │  ElevenLabs)    │  │ ~$0.02–0.20/min             │
└──────────────┘  └─────────────────┘  └──────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 5 — Automation Glue (n8n, self-hosted)                       │
│ Vapi webhooks → n8n workflows                                      │
│ Connects: CRM, calendar, email, Slack · 422+ integrations          │
│ Claude Code writes + deploys workflows via n8n API                 │
└────────────────────────────┬────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 6 — Memory + Storage (3-tier)                                │
│ Supabase: call logs, transcripts, structured data (Postgres+pgvec) │
│ Pinecone: real-time semantic search · knowledge base during calls  │
│ Mem0: persistent caller memory across calls                        │
└────────────────────────────┬────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 7 — Recording + Training Loop                                │
│ AWS S3: raw .mp3 recordings                                        │
│ AssemblyAI: transcription + speaker diarization                    │
│ n8n pipeline: auto-tag → score → feed to Supabase as training data │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Decisions

### Why Vapi over Retell
Vapi is the developer's choice — BYOK (bring your own keys), high-speed WebSocket routing, and "God Mode" control over function calling and tool execution via JSON config. Claude Code can create, modify, and redeploy entire agents by sending JSON to the Vapi API. No dashboard needed.

### Why Telnyx over Twilio
Cheaper at scale. Its REST API is equally clean for Claude Code to automate. Telnyx offers telecom-grade reliability, global reach, and deep control over voice infrastructure via SIP trunking.

### Why Deepgram Nova-3 for STT
Leads for real-time use with 6.84% word error rate and under 300ms latency, with excellent noise robustness — best for production voice agents.

### Why Cartesia Sonic as default TTS (ElevenLabs swappable)
Cartesia Sonic at 90ms offers the best value, while ElevenLabs Flash at 75ms leads on latency. Use Cartesia as the workhorse to keep costs down, swap in ElevenLabs for premium client-facing deployments where voice quality is a selling point.

### Why n8n as the glue layer
Vapi's webhook system fires events for everything — call start, call end, function calls, transcript updates — which makes it straightforward to wire up to external systems. Claude Code writes n8n workflows as JSON and deploys them via the n8n API, meaning the automation layer is fully code-controlled.

### Why 3-tier memory (Supabase + Pinecone + Mem0)
Three tiers serve distinct purposes:
- **Supabase (PostgreSQL + pgvector)**: Structured call logs, transcripts, agent configs. The system of record.
- **Pinecone**: Real-time semantic search during live calls. n8n + Pinecone + Supabase create dynamic, searchable knowledge bases that the voice agent queries in real time.
- **Mem0**: Persistent "what this caller told me before" memory across calls. Enables personalized experiences.

### Why the training loop (Layer 7)
This is what separates the template from a basic bot. Every call gets recorded to S3, auto-transcribed with speaker labels, scored by an n8n workflow, and fed back into Supabase as labeled training data — all triggered automatically.

---

## 4. Database Schema

### `agent_configs`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Agent display name |
| industry | TEXT | Industry category |
| description | TEXT | What this agent does |
| vapi_agent_id | TEXT | ID in Vapi's system |
| vapi_config | JSONB | Full Vapi JSON configuration |
| system_prompt | TEXT | The agent's system prompt |
| model | TEXT | Claude model ID (haiku/sonnet) |
| voice_provider | TEXT | cartesia or elevenlabs |
| voice_id | TEXT | Voice ID from provider |
| tools | JSONB | Function-calling tool definitions |
| is_active | BOOLEAN | Whether agent is deployed |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

### `callers`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| phone_number | TEXT | Unique phone number |
| name | TEXT | Caller name (learned over time) |
| email | TEXT | Caller email |
| mem0_user_id | TEXT | Mem0 user ID for persistent memory |
| tags | TEXT[] | Tags (VIP, new, etc.) |
| notes | TEXT | Free-form notes |
| metadata | JSONB | Flexible extra data |
| first_call_at | TIMESTAMPTZ | First interaction |
| last_call_at | TIMESTAMPTZ | Most recent interaction |
| total_calls | INT | Lifetime call count |
| created_at | TIMESTAMPTZ | Record creation |

### `calls`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| vapi_call_id | TEXT | Unique Vapi call identifier |
| agent_id | UUID | FK to agent_configs |
| caller_id | UUID | FK to callers |
| phone_number | TEXT | Caller's phone number |
| direction | TEXT | inbound or outbound |
| status | TEXT | completed, failed, missed, etc. |
| started_at | TIMESTAMPTZ | Call start time |
| ended_at | TIMESTAMPTZ | Call end time |
| duration_seconds | INT | Call length |
| recording_url | TEXT | Vapi recording URL |
| s3_key | TEXT | S3 object key for archived recording |
| cost_cents | INT | Estimated cost of the call |
| metadata | JSONB | Extra call data from Vapi |
| created_at | TIMESTAMPTZ | Record creation |

### `transcripts`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| call_id | UUID | FK to calls |
| speaker | TEXT | "agent" or "caller" |
| content | TEXT | What was said |
| start_ms | INT | Timestamp offset in recording |
| end_ms | INT | End timestamp offset |
| embedding | VECTOR(1536) | pgvector embedding for semantic search |
| created_at | TIMESTAMPTZ | Record creation |

### `training_data`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| call_id | UUID | FK to calls |
| transcript | TEXT | Full call transcript |
| tags | TEXT[] | Auto-generated tags (topics, intents) |
| sentiment_score | FLOAT | Overall sentiment (-1 to 1) |
| quality_score | FLOAT | Call quality rating (0 to 1) |
| outcome | TEXT | Call outcome (booked, resolved, escalated, etc.) |
| notes | TEXT | Auto-generated analysis notes |
| embedding | VECTOR(1536) | Embedding for semantic search over training data |
| created_at | TIMESTAMPTZ | Record creation |

---

## 5. Live Tool Use (Mid-Call Function Calling)

The agent can invoke tools during a live conversation via Vapi's function-calling support:

| Tool | Trigger | What It Does |
|------|---------|--------------|
| `lookup-caller` | Call starts | Checks `callers` table + Mem0 for caller history. Agent greets returning callers by name. |
| `search-knowledge` | Agent needs info | Queries Pinecone for business-specific knowledge (FAQs, policies, product details). |
| `check-availability` | Caller asks about scheduling | Triggers n8n workflow to check calendar availability in real-time. |
| `book-appointment` | Caller confirms booking | Triggers n8n workflow to book the appointment and confirm details. |

**Tool execution flow:**
```
Caller speaks → Vapi transcribes → LLM decides to call a tool
  → Vapi sends function_call webhook to our server
  → webhook-handler.ts routes to the correct tool handler
  → Tool handler queries Pinecone/Mem0/Supabase or triggers n8n workflow
  → Handler returns result to Vapi
  → LLM incorporates result and speaks the answer
```

---

## 6. Training Pipeline

**Trigger**: Every call ending fires a Vapi webhook.

**Flow:**
```
1. Vapi fires "call-ended" webhook
2. n8n "call-ended" workflow activates:
   a. Save call metadata → Supabase `calls` table
   b. Create/update caller → Supabase `callers` table
   c. Upload .mp3 recording → AWS S3
   d. Send recording to AssemblyAI → transcription + speaker diarization
   e. Save transcript segments → Supabase `transcripts` table (with pgvector embeddings)
   f. Auto-tag: sentiment analysis, topic extraction, outcome classification
   g. Score: call quality rating based on configurable criteria
   h. Save analysis → Supabase `training_data` table
3. Training data accumulates for future prompt optimization
```

---

## 7. n8n Workflows

### call-ended (core)
- **Trigger**: Vapi webhook (call.ended event)
- **Actions**: Save call → update caller → upload to S3 → transcribe → tag → score → save training data
- **This is the backbone workflow that powers the training loop**

### appointment-booking (example)
- **Trigger**: Webhook from tool handler (check-availability / book-appointment)
- **Actions**: Check Google Calendar API → find open slots or book appointment → return result

### crm-update (example)
- **Trigger**: Vapi webhook (call.ended event)
- **Actions**: Extract contact info from transcript → create/update record in CRM (generic HTTP nodes)

---

## 8. Docker Compose Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| postgres | pgvector/pgvector:pg15 | 5432 | Database with vector extension |
| n8n | n8nio/n8n | 5678 | Workflow automation |
| minio | minio/minio | 9000/9001 | S3-compatible local storage |

---

## 9. Example Agents

### Generic Agent
Fully configurable base template. All fields parameterized — system prompt, model, voice, tools. Users start here and customize.

### Dental Receptionist
- Books/cancels/reschedules appointments
- Answers insurance questions
- Sends appointment reminders
- Knows office hours and provider schedules

### Real Estate Lead Qualifier
- Qualifies inbound leads (budget, timeline, preferences)
- Schedules property showings
- Sends property info follow-ups
- Routes hot leads to agents

### Customer Support
- Handles FAQs via knowledge base search
- Creates support tickets
- Escalates complex issues to humans
- Tracks resolution status

---

## 10. File Manifest

```
voice-agent-template/
├── CLAUDE.md                           # Claude Code project instructions
├── build_spec.md                       # This file — full build specification
├── dev_journal.md                      # Development progress journal
├── docker-compose.yml                  # Local infrastructure
├── .env.example                        # All API keys documented
├── package.json                        # Dependencies and scripts
├── tsconfig.json                       # TypeScript configuration
├── .gitignore                          # Git ignore rules
├── README.md                           # User-facing documentation
│
├── scripts/
│   ├── setup.ts                        # One-command setup: validate, migrate, deploy
│   ├── seed.ts                         # Seed example agents into Supabase
│   └── seed-knowledge.ts              # Ingest business docs into Pinecone
│
├── src/
│   ├── index.ts                        # CLI entry point
│   ├── config.ts                       # Zod-validated environment config
│   │
│   ├── layers/
│   │   ├── telephony/
│   │   │   └── telnyx.ts               # Phone number provisioning + SIP
│   │   │
│   │   ├── orchestration/
│   │   │   ├── vapi-client.ts          # Vapi API wrapper
│   │   │   ├── vapi-types.ts           # Vapi TypeScript types
│   │   │   └── webhook-handler.ts      # Express webhook server
│   │   │
│   │   ├── speech/
│   │   │   ├── stt.ts                  # Deepgram Nova-3 config
│   │   │   └── tts.ts                  # Cartesia/ElevenLabs config
│   │   │
│   │   ├── llm/
│   │   │   └── model-config.ts         # Claude model selection
│   │   │
│   │   ├── automation/
│   │   │   ├── n8n-client.ts           # n8n API wrapper
│   │   │   └── workflows/
│   │   │       ├── call-ended.json     # Post-call processing
│   │   │       ├── appointment-booking.json
│   │   │       └── crm-update.json
│   │   │
│   │   ├── memory/
│   │   │   ├── supabase-client.ts      # Supabase client
│   │   │   ├── queries.ts              # Common DB queries
│   │   │   ├── pinecone-client.ts      # Pinecone semantic search
│   │   │   ├── mem0-client.ts          # Mem0 caller memory
│   │   │   └── vector-search.ts        # Unified search interface
│   │   │
│   │   ├── tools/
│   │   │   ├── tool-definitions.ts     # Vapi function-calling schemas
│   │   │   ├── lookup-caller.ts        # Caller history lookup
│   │   │   ├── search-knowledge.ts     # Knowledge base search
│   │   │   ├── check-availability.ts   # Calendar check
│   │   │   └── book-appointment.ts     # Appointment booking
│   │   │
│   │   └── training/
│   │       ├── s3-upload.ts            # S3 recording upload
│   │       ├── transcribe.ts           # AssemblyAI transcription
│   │       ├── auto-tag.ts             # Sentiment/topic tagging
│   │       ├── score.ts                # Call quality scoring
│   │       └── pipeline.ts             # End-to-end pipeline orchestrator
│   │
│   ├── agents/
│   │   ├── base-agent.ts              # Base agent config builder
│   │   ├── generic.ts                 # Generic configurable agent
│   │   ├── types.ts                   # Agent TypeScript interfaces
│   │   └── examples/
│   │       ├── dental-receptionist.ts
│   │       ├── real-estate-qualifier.ts
│   │       └── customer-support.ts
│   │
│   └── types/
│       └── index.ts                   # Shared types
│
├── supabase/
│   └── migrations/
│       ├── 001_enable_extensions.sql
│       ├── 002_create_agent_configs.sql
│       ├── 003_create_callers.sql
│       ├── 004_create_calls.sql
│       ├── 005_create_transcripts.sql
│       └── 006_create_training_data.sql
│
└── n8n/
    └── workflows/                     # Backup copies of workflow JSONs
```

---

## 11. Dependencies

### Runtime
- `@vapi-ai/server-sdk` — Vapi server SDK
- `telnyx` — Telnyx Node.js SDK
- `@supabase/supabase-js` — Supabase client
- `@pinecone-database/pinecone` — Pinecone client
- `mem0ai` — Mem0 client
- `@aws-sdk/client-s3` — AWS S3 client
- `assemblyai` — AssemblyAI SDK
- `express` — Webhook server
- `zod` — Schema validation
- `dotenv` — Environment variable loading

### Dev
- `typescript` — TypeScript compiler
- `tsx` — TypeScript execution (scripts + dev)
- `@types/express` — Express type definitions
- `@types/node` — Node.js type definitions

---

## 12. Environment Variables

```bash
# Layer 1 — Telephony
TELNYX_API_KEY=
TELNYX_PHONE_NUMBER=

# Layer 2 — Orchestration
VAPI_API_KEY=
VAPI_WEBHOOK_SECRET=

# Layer 3 — Speech
DEEPGRAM_API_KEY=
CARTESIA_API_KEY=
ELEVENLABS_API_KEY=          # Optional — only if swapping TTS

# Layer 4 — LLM
ANTHROPIC_API_KEY=

# Layer 5 — Automation
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=

# Layer 6 — Memory
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
PINECONE_API_KEY=
PINECONE_INDEX=voice-agent
MEM0_API_KEY=

# Layer 7 — Training
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
S3_BUCKET=voice-agent-recordings
ASSEMBLYAI_API_KEY=

# Server
WEBHOOK_PORT=3000
NODE_ENV=development
```

---

## 13. Setup Flow

```
1. Clone repo, copy .env.example → .env, fill in API keys
2. docker compose up -d               → starts postgres, n8n, minio
3. npm install                         → install dependencies
4. npm run setup                       → validates env, tests API connections,
                                         runs DB migrations, inits Pinecone index,
                                         deploys n8n workflows, seeds example agents
5. npm run dev                         → starts webhook server
6. npm run create-agent -- --example dental  → deploys dental agent to Vapi
```

---

## 14. Cost Estimates (per minute of call time)

| Layer | Service | Est. Cost/min |
|-------|---------|---------------|
| 1 | Telnyx | ~$0.01 |
| 2 | Vapi | ~$0.05 |
| 3a | Deepgram | ~$0.01 |
| 3b | Cartesia | ~$0.01 |
| 4 | Claude Haiku | ~$0.02 |
| 4 | Claude Sonnet | ~$0.20 |
| **Total (Haiku)** | | **~$0.10/min** |
| **Total (Sonnet)** | | **~$0.28/min** |

Storage costs (S3, Supabase, Pinecone) are negligible at low-to-medium volume.
