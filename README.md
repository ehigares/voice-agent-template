# Voice Agent Template

A production-ready, open-source template for building AI-powered phone agents. Fork it, configure it, and deploy a voice agent for any industry — dental offices, real estate, customer support, or any business that handles phone calls.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 1 — Telephony (Telnyx)                          ~$0.01/min   │
│ SIP trunking · phone number provisioning · REST API                │
└────────────────────────────┬────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 2 — Orchestration (Vapi)                        ~$0.05/min   │
│ Full JSON config · webhooks · function calling · agent deployment   │
└──────┬─────────────────────┬────────────────────────┬───────────────┘
       ▼                     ▼                        ▼
┌──────────────┐  ┌─────────────────┐  ┌──────────────────────────────┐
│ Layer 3a STT │  │ Layer 3b TTS    │  │ Layer 4 — LLM                │
│ Deepgram     │  │ Cartesia Sonic  │  │ Claude Haiku (speed)         │
│ Nova-3       │  │ (ElevenLabs     │  │ Claude Sonnet (reasoning)    │
│              │  │  swappable)     │  │                              │
└──────────────┘  └─────────────────┘  └──────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 5 — Automation (n8n, self-hosted)                             │
│ Vapi webhooks → n8n workflows → CRM, calendar, email, Slack        │
└────────────────────────────┬────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 6 — Memory (Supabase + Pinecone + Mem0)                      │
│ Structured data · semantic search · persistent caller memory        │
└────────────────────────────┬────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Layer 7 — Training Loop (S3 + AssemblyAI)                          │
│ Auto-record → transcribe → tag → score → feed back as training data│
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Clone and configure
git clone <your-fork-url>
cd voice-agent-template
cp .env.example .env
# Fill in your API keys in .env

# 2. Start local infrastructure
docker compose up -d

# 3. Install dependencies
npm install

# 4. Run setup (validates env, tests connections, runs migrations)
npm run setup

# 5. Start the webhook server
npm run dev

# 6. Seed example agents
npm run seed
# Deploy to Vapi: npm run seed -- --deploy
```

## Configuration

All configuration is managed through environment variables. See [.env.example](.env.example) for the full list.

### Required Services
| Service | Variable | Purpose |
|---------|----------|---------|
| Vapi | `VAPI_API_KEY` | Agent orchestration |
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Database + storage |
| Anthropic | `ANTHROPIC_API_KEY` | Claude LLM |
| Deepgram | `DEEPGRAM_API_KEY` | Speech-to-text |
| Cartesia | `CARTESIA_API_KEY` | Text-to-speech |

### Optional Services
| Service | Variable | Purpose |
|---------|----------|---------|
| Telnyx | `TELNYX_API_KEY` | Phone number provisioning |
| Pinecone | `PINECONE_API_KEY` | Knowledge base search |
| OpenAI | `OPENAI_API_KEY` | Embeddings (for Pinecone) |
| Mem0 | `MEM0_API_KEY` | Persistent caller memory |
| AWS S3 | `AWS_ACCESS_KEY_ID` | Recording storage |
| AssemblyAI | `ASSEMBLYAI_API_KEY` | Transcription |
| ElevenLabs | `ELEVENLABS_API_KEY` | Premium TTS (swap for Cartesia) |
| n8n | `N8N_API_KEY` | Workflow automation |

## Agent Examples

The template includes 4 agent configurations:

### Generic Agent
Fully configurable base template. All fields parameterized — start here and customize.

### Dental Receptionist
Books/cancels/reschedules appointments, answers insurance questions, knows office hours and provider schedules.

### Real Estate Lead Qualifier
Qualifies inbound leads (budget, timeline, preferences), schedules property showings, sends follow-ups.

### Customer Support
Handles FAQs via knowledge base search, creates support tickets, escalates complex issues.

## Creating Custom Agents

Extend the `GenericAgent` class:

```typescript
import { GenericAgent } from '../generic.js';
import { TOOL_NAMES } from '../../layers/tools/tool-definitions.js';

export class MyAgent extends GenericAgent {
  constructor(webhookUrl?: string) {
    super({
      name: 'My Custom Agent',
      industry: 'my-industry',
      description: 'What this agent does',
      systemPrompt: `Your system prompt here...`,
      firstMessage: 'Hello! How can I help?',
      model: 'claude-haiku-4-5-20251001',
      voiceProvider: 'cartesia',
      tools: [TOOL_NAMES.LOOKUP_CALLER, TOOL_NAMES.SEARCH_KNOWLEDGE],
      webhookUrl: webhookUrl ?? 'https://your-server.com/webhook/vapi',
    });
  }
}
```

## Tool System

The agent can invoke tools during live calls:

| Tool | Trigger | Action |
|------|---------|--------|
| `lookup-caller` | Call starts | Checks caller history + Mem0 memory |
| `search-knowledge` | Agent needs info | Queries Pinecone knowledge base |
| `check-availability` | Scheduling request | Checks calendar via n8n |
| `book-appointment` | Booking confirmed | Books appointment via n8n |

## Knowledge Base

Ingest business documents into Pinecone for real-time search during calls:

```bash
# Place .txt or .md files in a directory, then:
npm run seed-knowledge -- ./docs/my-business
```

## n8n Workflows

Three workflows are included and auto-deployed:

1. **Call Ended** — Post-call processing (save, transcribe, tag, score)
2. **Appointment Booking** — Check availability or book appointments
3. **CRM Update** — Create/update CRM contacts after calls

Customize the HTTP endpoints in the workflow JSON files to match your calendar and CRM APIs.

## Training Pipeline

Every call automatically feeds the training loop:

```
Call ends → Save metadata → Upload recording → Transcribe (AssemblyAI)
  → Auto-tag (sentiment, topics, outcomes) → Score quality → Save training data
```

Training data accumulates in the `training_data` table for future prompt optimization.

## Cost Estimates

| Configuration | Est. Cost/min |
|--------------|---------------|
| Haiku (speed) | ~$0.10 |
| Sonnet (reasoning) | ~$0.28 |

Storage costs (S3, Supabase, Pinecone) are negligible at low-to-medium volume.

## Project Structure

```
src/
├── config.ts                    # Zod-validated environment config
├── index.ts                     # Webhook server entry point
├── types/index.ts               # Shared TypeScript types
├── layers/
│   ├── telephony/               # Telnyx phone provisioning
│   ├── orchestration/           # Vapi client, types, webhook handler
│   ├── speech/                  # STT (Deepgram) + TTS (Cartesia/ElevenLabs)
│   ├── llm/                     # Claude model config
│   ├── automation/              # n8n client + workflow JSONs
│   ├── memory/                  # Supabase, Pinecone, Mem0 clients
│   ├── tools/                   # Mid-call function handlers
│   └── training/                # S3, transcription, tagging, scoring
└── agents/
    ├── base-agent.ts            # Core agent config builder
    ├── generic.ts               # Generic configurable agent
    └── examples/                # Dental, real estate, support
```

## Commands

| Command | Description |
|---------|-------------|
| `docker compose up` | Start local Postgres, n8n, MinIO |
| `npm run setup` | Validate env, test connections, run migrations |
| `npm run dev` | Start webhook server (development) |
| `npm run build` | Compile TypeScript |
| `npm run seed` | Seed example agent configs |
| `npm run seed -- --deploy` | Seed + deploy agents to Vapi |
| `npm run seed-knowledge -- <dir>` | Ingest docs into Pinecone |

## License

MIT
