# Client Deployment Checklist

Read this alongside `CLIENT_INTAKE.md` before writing any code.
Every item below must be configured for a working deployment.
Run `grep -r "TODO:CONFIGURE" src/` to find code-level placeholders.

---

## Section 1 — Required for Any Call to Work

These 5 services + webhook URL are the minimum for a functional agent.
Without any one of them, calls will fail.

| What | Where to Set | What Breaks If Missing |
|------|-------------|----------------------|
| `VAPI_API_KEY` | `.env` | Agent cannot be created or deployed. No calls work. |
| `DEEPGRAM_API_KEY` | `.env` | Speech-to-text fails. Agent cannot understand callers. |
| `CARTESIA_API_KEY` | `.env` | Text-to-speech fails. Agent cannot speak to callers. |
| `ANTHROPIC_API_KEY` | `.env` | LLM has no API key. Agent has no intelligence. |
| `SUPABASE_URL` | `.env` | Database unreachable. Call records, callers, transcripts cannot be saved. |
| `SUPABASE_SERVICE_KEY` | `.env` | Database authentication fails. Same impact as missing URL. |
| `OPENAI_API_KEY` | `.env` | Embedding generation fails. Knowledge search and training pipeline broken. If changing to a different embedding model, create a new migration to alter the VECTOR column dimensions in transcripts and training_data tables. |
| `WEBHOOK_BASE_URL` | `.env` | n8n cannot call back into the webhook server. Post-call pipeline fails. |
| System prompt | `src/agents/[client]-agent.ts` | Agent has no personality or business rules. Grep `TODO:CONFIGURE`. |
| Voice ID | `src/agents/[client]-agent.ts` | Agent uses default voice. Grep `TODO:CONFIGURE`. |
| First message | `src/agents/[client]-agent.ts` | Agent uses generic greeting. Grep `TODO:CONFIGURE`. |

---

## Section 2 — Required for Full Feature Set

These are optional per-client. Set `ENABLE_PINECONE=false` or
`ENABLE_MEM0=false` to disable features that aren't needed.

| What | Where to Set | What Breaks If Missing | Can Disable? |
|------|-------------|----------------------|-------------|
| `TELNYX_API_KEY` | `.env` | Cannot provision a real phone number. | Yes — use Vapi test numbers |
| `TELNYX_PHONE_NUMBER` | `.env` | No inbound number configured. | Yes — set up later |
| `PINECONE_API_KEY` | `.env` | Knowledge base search fails during calls. | Yes — `ENABLE_PINECONE=false` |
| `PINECONE_INDEX` | `.env` | Wrong index queried. Search returns nothing. | No — must match your Pinecone setup |
| `MEM0_API_KEY` | `.env` | Persistent caller memory disabled. Agent won't remember repeat callers. | Yes — `ENABLE_MEM0=false` |
| `N8N_BASE_URL` | `.env` | Workflow automation unreachable. Post-call processing fails. | No |
| `N8N_API_KEY` | `.env` | Cannot deploy workflows via API. Health probe skips n8n. | No |
| `N8N_PUBLIC_URL` | `.env` | n8n webhook URLs point to localhost. External services can't trigger workflows. | Only for self-hosted n8n |
| `AWS_ACCESS_KEY_ID` | `.env` | Recording upload to S3 fails. Recordings lost when Vapi URLs expire. | No — recordings are permanent storage |
| `AWS_SECRET_ACCESS_KEY` | `.env` | Same as above. | No |
| `S3_BUCKET` | `.env` | Recordings uploaded to wrong bucket or default bucket. | No |
| `ASSEMBLYAI_API_KEY` | `.env` | Transcription fails. No transcript segments, no training data. | No |
| `TRANSFER_PHONE_NUMBER` | `.env` | Transfer-to-human tool sends caller to nowhere. | Only if agent has no transfer tool |
| `VAPI_WEBHOOK_SECRET` | `.env` | Webhook signature verification disabled. Security risk. | No — required in production |
| Speaker mapping | `src/layers/training/transcribe.ts` | Caller/agent labels may be swapped in transcripts. Grep `TODO:CONFIGURE`. | No |
| Business hours | `src/agents/[client]-agent.ts` | Agent doesn't enforce business hours. Grep `TODO:CONFIGURE`. | No |

---

## Section 3 — Required Before Going Live

Complete every item before a client's first real call.
This mirrors the production checklist in `DEPLOYMENT.md`.

- [ ] `NODE_ENV=production` set
- [ ] `VAPI_WEBHOOK_SECRET` set (not empty)
- [ ] `WEBHOOK_BASE_URL` set to production URL (not ngrok, not localhost)
- [ ] `TRANSFER_PHONE_NUMBER` set (if agent uses transfer-to-human)
- [ ] `N8N_BASE_URL` set to production n8n instance URL
- [ ] Volume encryption enabled (DigitalOcean or Railway)
- [ ] Log drain configured
- [ ] UptimeRobot monitor active on `/health`
- [ ] All API keys rotated from any shared/test values
- [ ] `npm run validate` passes against production services
- [ ] Test call completed successfully
- [ ] `workflow_errors` table empty after test call
- [ ] `grep -r "TODO:CONFIGURE" src/` returns zero results (note: `custom-tool-template.ts` uses `TEMPLATE:CONFIGURE` markers which are separate and intentional — they should not appear in this grep)
- [ ] `grep -r "localhost" src/ n8n/` returns zero results (no hardcoded URLs)
