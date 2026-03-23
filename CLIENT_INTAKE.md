# Client Intake — [CLIENT NAME]

> This file is read by Claude Code at the start of every build session.
> Fill out every section before starting. The more detail here,
> the less back-and-forth during the build.
>
> After filling this out, Claude Code will:
> - Create the client agent file
> - Resolve all TODO:CONFIGURE markers
> - Configure business hours in two places (system prompt + Vapi schedule)
> - Set memory feature flags based on client needs
> - Update the Build Notes section at the bottom

---

## Business Overview

**Business name:**
**Industry:**
**Location(s) and timezone:**
**Website:**

**What the business does (2-3 sentences):**


**Primary phone number the agent will answer:**
**Transfer/escalation number (where to send calls the agent can't handle):**

---

## The Agent's Job

**What calls should the agent handle? (list every scenario):**
1.
2.
3.

**What calls should ALWAYS go to a human immediately?:**
1.
2.

**What should the agent NEVER say or do?:**
1.
2.

**Tone and personality:**
(examples: friendly and warm / professional and direct / casual and conversational)

---

## Business Hours

> These will be set in BOTH the system prompt and Vapi's schedule config.

**Monday:**
**Tuesday:**
**Wednesday:**
**Thursday:**
**Friday:**
**Saturday:**
**Sunday:**
**Holidays / closures:**

**What should the agent say when called outside business hours?:**

---

## Knowledge Base

**Top FAQs with answers:**
(copy-paste from website, or write fresh — the more the better)

Q:
A:

Q:
A:

Q:
A:

**Pricing:**
(include what the agent is allowed to quote vs. what requires a human)

**Services or products list:**

**Key policies:**
(cancellation, refunds, booking requirements, deposits, etc.)

---

## Integrations

**Calendar system:**
(Google Calendar / Calendly / other / none)

**CRM:**
(HubSpot / Salesforce / other / none)

**Any other tools the agent needs to connect to:**

---

## Memory Configuration

**Does this client need knowledge base search (Pinecone)?**
(yes = agent can answer questions from documents / no = agent uses only system prompt)

**Does this client need persistent caller memory (Mem0)?**
(yes = agent remembers callers across calls / no = every call starts fresh)

---

## Voice

**Voice preference:**
(gender, accent, tone — or leave blank for default Cartesia voice)

**Custom voice clone?**
(yes / no — if yes, audio samples of 10+ minutes needed separately)

**TTS provider:**
(Cartesia = default, cost-effective / ElevenLabs = premium, more expressive)

---

## Deployment

**Who manages hosting?**
(builder-managed on Railway / client self-hosts)

**Expected call volume per month:**
(rough estimate — helps set MAX_CONCURRENT_CALLS)

**LLM preference:**
(Haiku = faster and cheaper / Sonnet = better reasoning for complex conversations)

---

## Additional Notes

Anything else Claude Code should know before starting the build:


---

## Build Notes
> Do not edit this section manually — Claude Code maintains it.

**Date started:**
**Agent file created:**
**Tools configured:**
**Integrations wired:**
**Business hours configured in:**
**Memory flags set:**
**TODO:CONFIGURE items resolved:**
**Outstanding items:**
**Last updated:**
