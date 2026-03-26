# Voice Agent Template

Private agency template for building AI-powered voice agents for business clients. Each client gets their own private repo cloned from this template.

## Architecture

```
+---------------------------------------------------------------------+
| Layer 1 -- Telephony (Telnyx)                          ~$0.01/min   |
| SIP trunking - phone number provisioning - REST API                 |
+----------------------------+----------------------------------------+
                             |
                             v
+---------------------------------------------------------------------+
| Layer 2 -- Orchestration (Vapi)                        ~$0.05/min   |
| Full JSON config - webhooks - function calling - HMAC verification  |
+------+---------------------+------------------------+---------------+
       v                     v                        v
+--------------+  +-----------------+  +------------------------------+
| Layer 3a STT |  | Layer 3b TTS    |  | Layer 4 -- LLM              |
| Deepgram     |  | Cartesia Sonic  |  | Claude Haiku (speed)        |
| Nova-3       |  | (ElevenLabs     |  | Claude Sonnet (reasoning)   |
|              |  |  swappable)     |  |                             |
+--------------+  +-----------------+  +------------------------------+
                             |
                             v
+---------------------------------------------------------------------+
| Layer 5 -- Automation (n8n, self-hosted)                            |
| Vapi webhooks -> n8n workflows -> CRM, calendar, email, Slack       |
+----------------------------+----------------------------------------+
                             |
                             v
+---------------------------------------------------------------------+
| Layer 6 -- Memory (Supabase + Pinecone + Mem0)                      |
| Structured data - semantic search - persistent caller memory        |
+----------------------------+----------------------------------------+
                             |
                             v
+---------------------------------------------------------------------+
| Layer 7 -- Training Loop (S3 + AssemblyAI)                          |
| Auto-record -> transcribe -> tag -> score -> feed back as training  |
+---------------------------------------------------------------------+
```

## New Client Setup

```bash
# 1. Clone template into a new client repo (never fork)
git clone <template-url> acme-voice-agent
cd acme-voice-agent
git remote set-url origin <new-private-repo-url>
git push -u origin main

# 2. Fill out the intake document
#    CLIENT_INTAKE.md -- this drives the entire build

# 3. Configure environment
cp .env.example .env
# Fill in all API keys

# 4. Start local infrastructure
docker compose up -d

# 5. Install and setup
npm install
npm run setup

# 6. Build the client agent
#    Read reference-agent.ts -> create [client]-agent.ts
#    Resolve all TODO:CONFIGURE markers

# 7. Deploy
npm run seed -- --deploy
npm run dev
```

## Agent Development

`src/agents/reference-agent.ts` is the read-only pattern document. To build a client agent:

1. Read `CLIENT_INTAKE.md` fully
2. Copy `reference-agent.ts` to `[client-name]-agent.ts`
3. Replace every `TODO:CONFIGURE` with values from the intake doc
4. Run `grep -r "TODO:CONFIGURE" src/` to verify none remain

Never modify `reference-agent.ts` directly.

## Tool System

Agents can invoke tools during live calls:

| Tool | Trigger | Action |
|------|---------|--------|
| `lookup-caller` | Call starts | Check caller history + Mem0 memory |
| `search-knowledge` | Agent needs info | Query Pinecone knowledge base |
| `check-availability` | Scheduling request | Check calendar via n8n |
| `book-appointment` | Booking confirmed | Book appointment via n8n |
| `transfer-to-human` | Escalation needed | Warm transfer to a human |

Custom tools: copy `src/layers/tools/custom-tool-template.ts`, rename,
and swap in the client's API details. See the file for a fully worked
example.

## Knowledge Base

Ingest client documents into Pinecone for real-time search during calls:

```bash
npm run seed-knowledge -- ./docs/client-name
```

## n8n Workflows

Five workflows are included and deployed via the n8n API:

1. **Call Ended** -- Post-call processing (save, transcribe, tag, score)
2. **Appointment Booking** -- Check availability or book appointments
3. **CRM Update** -- Create/update CRM contacts after calls
4. **Training Pipeline Monitor** -- Daily check for stale training data
5. **Recording Archive Monitor** -- 30-minute check for unarchived recordings

## Training Pipeline

Every call automatically feeds the training loop:

```
Call ends -> Save metadata -> Upload recording -> Transcribe (AssemblyAI)
  -> Auto-tag (sentiment, topics, outcomes) -> Score quality -> Save training data
```

## Commands

| Command | Description |
|---------|-------------|
| `docker compose up` | Start local Postgres, n8n, MinIO |
| `npm run setup` | Validate env, test connections, run migrations, deploy n8n workflows |
| `npm run validate` | Quick connection check -- confirms all services are reachable |
| `npm run dev` | Start webhook server (development) |
| `npm run build` | Compile TypeScript |
| `npm start` | Start webhook server (production, from compiled dist/) |
| `npm run create-agent` | Create and deploy an agent to Vapi |
| `npm run seed` | Seed agent config to database |
| `npm run seed -- --deploy` | Seed + deploy agent to Vapi |
| `npm run seed-knowledge -- <dir>` | Ingest docs into Pinecone |
| `npm run create-outbound-call` | Initiate an outbound call (stub) |

## Project Structure

```
src/
|-- config.ts                    # Zod-validated environment config
|-- index.ts                     # Webhook server entry point
|-- lib/
|   +-- logger.ts                # Structured JSON logger (never use console.log)
|-- types/
|   +-- index.ts                 # Shared TypeScript types
|-- layers/
|   |-- telephony/               # Telnyx phone provisioning
|   |-- orchestration/           # Vapi client, types, webhook handler
|   |-- speech/                  # STT (Deepgram) + TTS (Cartesia/ElevenLabs)
|   |-- llm/                     # Claude model config
|   |-- automation/              # n8n client + workflow JSONs
|   |-- memory/                  # Supabase, Pinecone, Mem0 clients
|   |-- tools/                   # Mid-call function handlers + custom tool template
|   +-- training/                # S3, transcription, tagging, scoring
+-- agents/
    |-- base-agent.ts            # Core agent config builder
    |-- reference-agent.ts       # READ ONLY -- pattern for client agents
    +-- types.ts                 # Agent type definitions
```

## Deployment

Two deployment paths are supported:

- **Railway** -- One-command deploy (`railway up`), ~$5/month per client.
  Best for early clients and quick iteration.
- **DigitalOcean Droplet** -- Full Ubuntu server with nginx, SSL, PM2.
  Best for production scale and cost optimization at volume.

See `DEPLOYMENT.md` for step-by-step instructions for both paths,
plus n8n Cloud as an alternative to self-hosted n8n.

## Monitoring

### /health Endpoint

The `/health` endpoint performs a deep probe of all connected services
(Supabase, Pinecone, Mem0, n8n) and returns per-service status. Target
this with UptimeRobot for external monitoring.

### workflow_errors Table

The `workflow_errors` table in Supabase logs silent failures detected by
monitoring workflows. A healthy system has **zero rows**.

```sql
SELECT * FROM workflow_errors ORDER BY created_at DESC LIMIT 50;
```

Check this table weekly. See `DEPLOYMENT.md` for full monitoring
operations documentation.

## Cost Estimates

| Configuration | Est. Cost/min |
|--------------|---------------|
| Haiku + Cartesia | ~$0.10 |
| Sonnet + Cartesia | ~$0.28 |
| Sonnet + ElevenLabs | ~$0.32 |

## Compliance Notice

Each client deployment handles caller PII (phone numbers, names, call recordings). Ensure:
- API keys are never shared between client deployments
- Each client repo is a separate private repository
- Recording storage complies with applicable consent laws
- Data retention policies are configured per client requirements
