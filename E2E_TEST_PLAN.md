# End-to-End API Testing Plan

## Context
The Voice Agent Template is fully built, pushed to GitHub, Docker is running (Postgres, n8n, MinIO), and n8n MCP is connected. Now we need to validate it works by signing up for the minimum required services and making a real test call.

## Approach: Minimum Viable Test
Sign up for 5 core services, configure `.env`, run setup, deploy an agent, and make a test call. Optional services (Pinecone, Mem0, S3, AssemblyAI) come later.

---

## Step 1 — Sign Up for Services
Sign up in this order and collect API keys:

1. **Vapi** (vapi.ai) → Get `VAPI_API_KEY`
2. **Supabase** (supabase.com) → Create project → Get `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`
3. **Anthropic** (console.anthropic.com) → Get `ANTHROPIC_API_KEY`
4. **Deepgram** (deepgram.com) → Get `DEEPGRAM_API_KEY`
5. **Cartesia** (cartesia.ai) → Get `CARTESIA_API_KEY`

## Step 2 — Configure .env
Copy `.env.example` to `.env` and fill in the 5 keys above. Leave optional services blank.

## Step 3 — Fill Out CLIENT_INTAKE.md
Fill in `CLIENT_INTAKE.md` with test business details (a simple fictional business is fine for testing). This is what drives agent creation — `reference-agent.ts` is the pattern, `CLIENT_INTAKE.md` is the input.

## Step 4 — Run Database Migrations
Run the SQL migration files against the Supabase SQL editor (or have Claude combine them into one script).

Files: `supabase/migrations/001-008`

## Step 5 — Run Setup Script
```bash
npm run setup
```
This validates env vars, tests connections, and reports status.

## Step 6 — Start Webhook Server
```bash
npm run dev
```
Verify: `curl http://localhost:3000/health`

## Step 7 — Expose Webhook via ngrok
```bash
ngrok http 3000
```
Copy the `https://xxxx.ngrok.io` URL — this becomes the webhook URL for the agent.

## Step 8 — Create a Test Agent
Create a client agent based on `reference-agent.ts` using the `CLIENT_INTAKE.md` details, then deploy:

```bash
npm run seed -- --deploy
```

Or create a minimal test agent via the Vapi API directly.

## Step 9 — Make a Test Call
Use the Vapi dashboard's "Test Call" feature to call the agent via browser (no phone number needed).

## Step 10 — Verify End-to-End
- [ ] Agent picks up and speaks the first message
- [ ] Agent understands speech (Deepgram STT working)
- [ ] Agent responds intelligently (Claude LLM working)
- [ ] Agent speaks the response (Cartesia TTS working)
- [ ] Webhook server receives events (check terminal logs)
- [ ] Call end event is received

---

## Prompt to Give Claude in a New Context Window

Copy and paste this when you're ready to test:

```
I'm working on the Voice Agent Template project in c:\Users\ehiga\Voice Agent Template

The template is fully built and pushed to GitHub (https://github.com/ehigares/voice-agent-template). Docker is running (Postgres, n8n, MinIO). n8n MCP is connected.

I'm ready to do end-to-end API testing. I've signed up for the 5 core services:
- Vapi
- Supabase
- Anthropic (Claude)
- Deepgram
- Cartesia

I have my API keys ready. Please help me:
1. Configure my .env file
2. Fill out CLIENT_INTAKE.md with test business details
3. Run the database migrations on Supabase
4. Run npm run setup and troubleshoot any issues
5. Set up ngrok for the webhook
6. Create a test agent based on reference-agent.ts and CLIENT_INTAKE.md
7. Deploy to Vapi and make a test call
8. Verify everything works

Read E2E_TEST_PLAN.md and dev_journal.md first.
```
