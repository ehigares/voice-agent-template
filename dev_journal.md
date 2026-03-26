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

### Why Telnyx is optional not required in config
The webhook server, agent logic, and training pipeline all function
without Telnyx. Telnyx is only needed when provisioning a real phone
number. Marking it required blocked the server from starting during
E2E testing with only the 5 core services configured.
Decision: TELNYX_API_KEY and TELNYX_PHONE_NUMBER are optional.
Fixed in Phase 2 bug fixes.

### Why require() was replaced with dynamic import() in memory-client.ts
package.json has "type": "module" making this a pure ESM project.
require() does not exist in ESM modules and throws ReferenceError
at runtime. Dynamic import() is the correct ESM equivalent.
Decision: All imports use ESM. require() is banned. Fixed in Phase 2
bug fixes.

### Why TRANSFER_PHONE_NUMBER must go through config.ts
Direct process.env reads bypass Zod validation. An empty transfer
number silently sends a malformed request to Vapi, causing transfer
failures with no clear error. Config validation catches this at startup.
Decision: All env vars go through config.ts. Fixed in Phase 2 bug fixes.

### Why /health does deep service probing
A shallow health check (just "server is running") gives false confidence.
The most damaging silent failures are when the server is up but a
downstream service (Pinecone, Mem0, Supabase) is broken. A deep health
check surfaces degraded states before callers experience them.
Decision: /health probes all connected services and reports per-service
status. Added in Phase 2.5.

### Why an external uptime monitor is required
Railway's internal health monitoring only tells you if the container
crashed. It does not catch cases where the server is running but
returning errors, or where Railway itself has an outage. An external
monitor (UptimeRobot) pings /health from outside Railway's network
every 60 seconds and alerts via email/SMS on failure.
Decision: UptimeRobot setup documented in DEPLOYMENT.md as required
production step, not optional.

---

## Full Build Sequence — Authoritative Roadmap

```
Phase 1 — Structural cleanup                    ✅ COMPLETE
Phase 2 — Core fixes and security               ✅ COMPLETE
Phase 2 bug fixes — 4 bugs found in code review ✅ COMPLETE
Phase 2.5 — Silent failure detection            ✅ COMPLETE
Phase 3 — Template completeness                 ✅ COMPLETE
Phase 4 — Docs and deployment                   ← CURRENT
↓
npm run build — zero TypeScript errors
↓
⭐ PEER REVIEW CHECKPOINT
   Full codebase upload to Gemini 2.5 Pro
   Adversarial review: find flaws, not summaries
   Fix any critical findings before proceeding
↓
Clone template → acme-[fake business]-voice-agent
Fill CLIENT_INTAKE.md for fake company
Sign up for 5 core services with real API keys
E2E test — full call flow validated end-to-end
↓
⭐ DROPLET SETUP
   DigitalOcean droplet provisioned and configured
   Production deployment tested (not Railway free tier)
   UptimeRobot external monitor confirmed working
   DEPLOYMENT.md updated with droplet instructions
   Railway vs Droplet decision documented
↓
✅ Ready for first real paying client
```

---

## Phase 2 Bug Fixes — COMPLETE
STATUS: COMPLETE — pushed in commit 89abe36

- [x] Fix 1: Make TELNYX_API_KEY and TELNYX_PHONE_NUMBER optional in
      config.ts — server must start without Telnyx for E2E testing
- [x] Fix 2: Replace require() with dynamic import() in memory-client.ts
      — ESM project, require() throws ReferenceError at runtime
- [x] Fix 3: Add TRANSFER_PHONE_NUMBER to config.ts schema and use
      config.TRANSFER_PHONE_NUMBER in transfer-to-human.ts
- [x] Fix 4: Implement backchannel acknowledgment in webhook-handler.ts
      before each tool handler fires — eliminates caller silence
- [x] Run npm run build — confirm zero TypeScript errors
- [x] Follow Session End Protocol — commit, push, confirm

---

## Phase 2.5 — Silent Failure Detection — COMPLETE
STATUS: COMPLETE

Background: A systematic audit identified 6 categories of silent failure
in the current system — places where something goes wrong but no alert
fires, no dashboard turns red, and the problem is only discovered later
by manually checking logs or data. This phase closes those gaps.

### Task 1 — Upgrade /health to deep health check
Current /health returns activeCalls and version only. Upgrade to probe
all connected services on each request and return per-service status.

Target response shape:
```json
{
  "status": "ok | degraded | down",
  "timestamp": "ISO string",
  "version": "1.0.0",
  "activeCalls": 0,
  "maxConcurrentCalls": 20,
  "services": {
    "supabase": { "status": "ok | degraded | down", "latencyMs": 45 },
    "pinecone": { "status": "ok | degraded | down", "latencyMs": 120 },
    "mem0": { "status": "ok | degraded | down", "latencyMs": 80 },
    "n8n": { "status": "ok | degraded | down", "latencyMs": 30 }
  }
}
```

Rules:
- Overall status = "ok" only if all enabled services are ok
- Overall status = "degraded" if any service is slow (>2s) but reachable
- Overall status = "down" if any required service is unreachable
- Pinecone/Mem0 probes only run if ENABLE_PINECONE/ENABLE_MEM0 = true
- Probe timeout: 3 seconds per service (don't let /health hang)
- Never throw — catch all probe errors and report as "down"

### Task 2 — Startup validation for TRANSFER_PHONE_NUMBER
In scripts/setup.ts — after the connection checks, add:
- Query the deployed agent config from Supabase
- If the agent has TRANSFER_TO_HUMAN in its tools list AND
  config.TRANSFER_PHONE_NUMBER is empty string, print a loud warning:
  "⚠️  WARNING: TRANSFER_TO_HUMAN tool is enabled but
   TRANSFER_PHONE_NUMBER is not set. Callers who ask for a human
   will hear a failure message. Set TRANSFER_PHONE_NUMBER in .env"
- Do not block startup — warn only

### Task 3 — Stale training pipeline detection (n8n scheduled workflow)
Create a new n8n workflow: training-pipeline-monitor.json

Trigger: Schedule — runs every day at 6:00 AM
Logic:
1. Query Supabase calls table: count calls from the last 24 hours
   where status = 'completed'
2. Query Supabase training_data table: count records from last 24 hours
3. If completed calls > 0 AND training records = 0:
   → Insert row into workflow_errors:
     { workflow: 'training-pipeline-monitor',
       error: 'Training pipeline stale — calls completed but no
               training data written in last 24 hours',
       metadata: { calls_count, training_count } }
4. If completed calls > 0 AND training records < (calls * 0.5):
   → Insert row into workflow_errors with warning level

Add this workflow to the workflows directory and deploy via n8n API.

### Task 4 — Unarchived recordings detection (n8n scheduled workflow)
Create a new n8n workflow: recording-archive-monitor.json

Trigger: Schedule — runs every 30 minutes
Logic:
1. Query Supabase calls table:
   SELECT * FROM calls
   WHERE recording_archived = FALSE
   AND ended_at < NOW() - INTERVAL '15 minutes'
   AND recording_url IS NOT NULL
2. If any rows returned:
   → For each unarchived call, insert into workflow_errors:
     { workflow: 'recording-archive-monitor',
       error: 'Recording not archived',
       call_id: [id],
       metadata: { recording_url, ended_at } }
3. These entries serve as the retry queue — a future recovery script
   can query workflow_errors for this type and re-trigger archival

### Task 5 — workflow_errors monitoring note
The workflow_errors table exists (Migration 009) but nothing reads it.
Add a comment to DEPLOYMENT.md and README under "Monitoring" section:
"Check the workflow_errors table in Supabase weekly. A healthy system
has zero rows. Any rows indicate silent failures requiring investigation.
Query: SELECT * FROM workflow_errors ORDER BY created_at DESC LIMIT 50"

This is an operational procedure, not a code change. Document it clearly.

### Task 6 — External uptime monitor setup
Not a code change. Add to DEPLOYMENT.md as a required production step:
1. Register at uptimerobot.com (free tier)
2. Create HTTP monitor pointing to: https://[your-domain]/health
3. Check interval: 60 seconds
4. Alert contacts: email + SMS
5. Alert condition: status != 200 OR response body status != "ok"
6. Document the monitor URL in the client repo for reference

### Completion checklist for Phase 2.5
- [x] /health upgraded to deep service probe with per-service status
- [x] Startup warning for empty TRANSFER_PHONE_NUMBER
- [x] training-pipeline-monitor.json created and added to workflows dir
- [x] recording-archive-monitor.json created and added to workflows dir
- [x] Both monitoring workflows deployed via n8n API in setup.ts
- [x] workflow_errors monitoring note added to DEPLOYMENT.md
- [x] External uptime monitor instructions added to DEPLOYMENT.md
- [x] npm run build — zero errors
- [x] Follow Session End Protocol — commit, push, confirm

---

## Phase 3 — Template Completeness — COMPLETE
STATUS: COMPLETE

- [x] Verify reference-agent.ts has TODO:CONFIGURE on every
      configurable field — read carefully, don't assume
- [x] Add custom-tool-template.ts to src/layers/tools/ with full
      three-rule pattern (backchannel + withTimeout + fallback)
      and detailed comments showing how to add client-specific tools
- [x] Add business hours enforcement to base-agent.ts:
      both system prompt section AND Vapi schedule config section
      with TODO:CONFIGURE markers on both
- [x] Create scripts/validate.ts — lightweight connection check,
      faster than setup.ts, run this after every deployment to
      confirm all services are reachable
- [x] Create scripts/create-outbound-call.ts stub with --phone and
      --assistant-id flags and Vapi outbound call API wiring
      (stub only — outbound is a future feature)
- [x] Add npm run validate to package.json scripts
- [x] Add npm run create-outbound-call to package.json scripts
- [x] Verify all TODO:CONFIGURE markers are consistent throughout
      Run: grep -r "TODO:CONFIGURE" src/ and review every result
- [x] Follow Session End Protocol — commit, push, confirm

---

## Phase 4 — Documentation and Deployment
STATUS: PENDING — start after Phase 3 is confirmed pushed (NEXT)

- [ ] Create DEPLOYMENT.md covering:
      LOCAL DEVELOPMENT:
        - Docker compose up and what each service does
        - ngrok setup for webhook testing
        - How to point Vapi server URL to ngrok endpoint
        - How to route Telnyx number to Vapi

      RAILWAY DEPLOYMENT:
        - railway login and railway link
        - Environment variable configuration in Railway UI
        - railway up — one command deploy
        - Checking logs in Railway dashboard
        - Setting NODE_ENV=production

      DIGITALOCEAN DROPLET (for production/scale):
        - Droplet size recommendation for expected call volume
        - Ubuntu setup — Node.js, Docker, nginx
        - SSL certificate via certbot
        - PM2 for process management
        - Deploying from GitHub repo
        - Environment variable management on droplet
        - Comparison: Railway (easy, $5/client) vs Droplet
          (more work, cheaper at scale, more control)

      N8N CLOUD ALTERNATIVE:
        - When to use n8n cloud vs self-hosted Docker
        - n8n cloud pricing and setup
        - Updating N8N_BASE_URL to cloud instance

      PRODUCTION CHECKLIST:
        - [ ] NODE_ENV=production set
        - [ ] VAPI_WEBHOOK_SECRET set (not empty)
        - [ ] TRANSFER_PHONE_NUMBER set
        - [ ] N8N_PUBLIC_URL set to production domain
        - [ ] Volume encryption enabled (DigitalOcean or Railway)
        - [ ] Log drain configured
        - [ ] UptimeRobot monitor active on /health
        - [ ] All API keys rotated from any shared/test values
        - [ ] npm run validate passes against production services
        - [ ] Test call completed successfully
        - [ ] workflow_errors table empty after test call

      MONITORING OPERATIONS:
        - Check workflow_errors table weekly
        - Query: SELECT * FROM workflow_errors
                 ORDER BY created_at DESC LIMIT 50
        - Healthy system has zero rows
        - UptimeRobot alerts on /health failures

- [ ] Create railway.toml with correct service config
- [ ] Rewrite README.md to include:
      - Monitoring section pointing to workflow_errors
      - Updated commands including validate and create-outbound-call
      - Droplet as production hosting option
- [ ] Final consistency pass — all .md files match actual codebase
- [ ] Follow Session End Protocol — commit, push, confirm

---

## Change Log

### [Week 1 — Initial build]
- 7-layer architecture implemented in TypeScript
- All layers stubbed and wired
- Supabase migrations 001-006 created
- Docker compose with postgres, n8n, minio
- README, CLAUDE.md, build_spec.md written
- Example agents created (dental, real estate, support)

### [Planning session — architecture review]
- Full architecture review with peer review by o3
- 17 findings triaged, 13 accepted
- Tech decisions documented in this journal
- Four .md documents written to final spec
- Phase roadmap established

### [Phase 1 — Structural cleanup — COMPLETE]
- Deleted src/agents/examples/ (3 example agents)
- Renamed generic.ts → reference-agent.ts
- Rewrote reference-agent.ts as read-only pattern document
- Fixed all imports across codebase
- Rewrote README.md for agency model
- Updated CLAUDE.md and build_spec.md
- Session End Protocol added to CLAUDE.md

### [Phase 2 — Core fixes and security — COMPLETE]
- HMAC-SHA256 webhook signature verification implemented
- MAX_CONCURRENT_CALLS concurrency cap implemented
- n8n database separated from app database in docker-compose
- N8N_PUBLIC_URL env var replaces hardcoded localhost
- STORAGE_ENDPOINT env var added for MinIO/S3 swap
- tool-utils.ts created with withTimeout wrapper
- All 4 tool handlers updated with withTimeout + fallback messages
- transfer-to-human.ts created using Vapi call control API
- memory-client.ts interface + mem0-adapter.ts created
- ENABLE_PINECONE and ENABLE_MEM0 feature flags added
- logger.ts created — all console.log replaced
- embedding_model column added to types
- Migrations 007 (recording_archived), 008 (embedding_model),
  009 (workflow_errors) created
- vapi_call_id deduplication added to call-ended workflow
- retry-with-backoff added to all n8n workflow HTTP nodes
- Commits: 4ce5e5b (phase 1+2), 28297e2 (journal update)

### [Phase 2 bug fixes — COMPLETE]
- Code review identified 4 bugs:
  1. Telnyx marked required — blocks server startup without keys
  2. require() in ESM project — throws ReferenceError at runtime
  3. TRANSFER_PHONE_NUMBER bypasses config validation
  4. No backchannel acknowledgment — callers hear silence during tools
- All 4 fixes applied in commit 89abe36

### [Phase 2.5 — Silent failure detection — COMPLETE]
- /health upgraded to deep service probe: probes Supabase, Pinecone,
  Mem0, n8n with 3s timeout per service. Disabled services reported as
  "disabled" without probing. Overall status: ok/degraded/down.
- TRANSFER_PHONE_NUMBER startup warning added to setup.ts — queries
  agent_configs for TRANSFER_TO_HUMAN tool, warns if number is empty.
  Non-blocking, continues startup after warning.
- training-pipeline-monitor.json: daily 6AM workflow checks if completed
  calls have matching training data. Logs to workflow_errors if stale
  (zero training data) or degraded (<50% coverage).
- recording-archive-monitor.json: every 30 minutes, finds calls ended
  >15 minutes ago with recording_url but recording_archived=false.
  Logs each to workflow_errors as a retry queue.
- Both monitoring workflows auto-deploy via existing setup.ts loop
  (reads all .json from src/layers/automation/workflows/).
- DEPLOYMENT.md created with Monitoring section (workflow_errors table
  check instructions) and Production Checklist section (UptimeRobot
  setup as required step, not optional).
- npm run build: zero errors. grep console.log src/: zero results.

### [Phase 3 — Template completeness — COMPLETE]
- reference-agent.ts audited: all configurable fields have TODO:CONFIGURE
  markers. Added businessHours config with TODO:CONFIGURE.
- custom-tool-template.ts created in src/layers/tools/ with full
  three-rule pattern (withTimeout, fallback message, backchannel note),
  typed input interface, and commented example patterns for Supabase
  queries, external API calls, and n8n workflow triggers.
- Business hours enforcement added to base-agent.ts in both places:
  1. System prompt injection via buildBusinessHoursPrompt() — appends
     hours, timezone, and after-hours behavior rules to the LLM prompt
  2. Vapi schedule config via getScheduleConfig() — returns the schedule
     object for infrastructure-level call rejection outside hours
- BusinessHours and DaySchedule types added to src/agents/types.ts.
- scripts/validate.ts created: lightweight connection check with 5s
  timeout per service. Checks Supabase, Vapi, Telnyx, Pinecone, Mem0,
  n8n. Respects ENABLE_PINECONE/ENABLE_MEM0 flags. Exits 1 on failure.
- scripts/create-outbound-call.ts stub created: parses --phone and
  --assistant-id flags, calls Vapi outbound call API. Ready for future
  outbound calling feature.
- npm scripts added: `npm run validate`, `npm run create-outbound-call`
- TODO:CONFIGURE audit: grep confirmed consistent markers across
  reference-agent.ts, custom-tool-template.ts, transfer-to-human.ts.
- npm run build: zero errors. grep console.log src/: zero results.

### [Pre-Phase 4 — custom-tool-template.ts rewrite]
- Rewrote custom-tool-template.ts from stub (empty function body with
  commented-out patterns) to a fully working checkLoyaltyPoints example.
- Added typed LoyaltyPointsInput interface with real fields (phone_number,
  program_id) and LoyaltyApiResponse interface for the external API shape.
- Function body demonstrates: real fetch() call with proper headers, error
  handling that throws to trigger withTimeout fallback, typed JSON parsing,
  structured logging before and after the API call, and a ToolResult with
  realistic data fields (points_balance, tier, message).
- Every non-obvious line has a comment explaining WHY, not just WHAT.
- Goal: a future Claude Code session can copy, rename, swap API details,
  and have a working tool in under 30 minutes without guessing.
- npm run build: zero errors.

---

## Known Issues / Watch List

- Vapi recording URLs expire — always archive to S3 before serving links.
  Check recording_archived = TRUE before using recording_url.
- Webhook deduplication — check vapi_call_id exists before processing
  call.ended to prevent duplicate training data entries.
- Tool call silence — withTimeout(5000) on all handlers is mandatory.
  Never let a failed tool result in the caller hearing nothing.
- n8n public URL — N8N_PUBLIC_URL in docker-compose must be set to a
  publicly accessible URL before Vapi can deliver webhooks to n8n.
  Use ngrok for local dev. Set N8N_PUBLIC_URL in .env.
- workflow_errors table exists but nothing alerts on new rows — Phase 2.5
  adds monitoring workflows to detect silent failures.
- TRANSFER_PHONE_NUMBER defaults to empty string — if not set, transfer
  tool fails silently. Phase 2 bug fix adds config validation warning.