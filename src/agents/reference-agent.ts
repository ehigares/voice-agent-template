// ============================================================
// reference-agent.ts — READ-ONLY PATTERN DOCUMENT
// ============================================================
//
// DO NOT MODIFY THIS FILE.
//
// This is the reference pattern for building client agents.
// When starting a new client build:
//
//   1. Read CLIENT_INTAKE.md fully
//   2. Copy this file to [client-name]-agent.ts
//   3. Replace every TODO:CONFIGURE with values from the intake doc
//   4. Delete these header comments from your copy
//
// Every configurable field is marked with TODO:CONFIGURE.
// Run `grep -r "TODO:CONFIGURE" src/` to find them all.
//
// ============================================================

import { BaseAgentBuilder } from './base-agent.js';
import { TOOL_NAMES } from '../layers/tools/tool-definitions.js';
import type { AgentOptions } from './types.js';

// ------------------------------------------------------------
// System Prompt
// ------------------------------------------------------------
// This is the most important part of the agent. It defines
// personality, business rules, procedures, and boundaries.
//
// Structure:
//   1. WHO the agent is — role, personality, business name
//   2. BUSINESS DETAILS — hours, location, services, pricing
//   3. PROCEDURES — step-by-step for common scenarios
//   4. BOUNDARIES — what the agent must NOT do or promise
//   5. ESCALATION — when to transfer to a human
//
// Business hours MUST appear here AND in the Vapi schedule
// config (see base-agent.ts). Never rely on just one.
// ------------------------------------------------------------

const SYSTEM_PROMPT = `You are a professional, friendly phone agent for [TODO:CONFIGURE business name]. Your role is to help callers efficiently and courteously.

Business Information:
- Business name: [TODO:CONFIGURE]
- Hours: [TODO:CONFIGURE e.g. Monday–Friday 9:00 AM – 5:00 PM]
- Location: [TODO:CONFIGURE]
- Phone: [TODO:CONFIGURE]
- Website: [TODO:CONFIGURE]

Services Offered:
- [TODO:CONFIGURE list each service]

Procedures:
- When a caller asks about scheduling:
  1. Ask what service they need
  2. Check available times using the check-availability tool
  3. Confirm the date, time, and service with the caller
  4. Book the appointment using the book-appointment tool
  5. Repeat the confirmation details

- When a caller asks a question you can answer from the knowledge base:
  1. Search the knowledge base using the search-knowledge tool
  2. Relay the answer clearly and concisely

- When a caller needs something beyond your capabilities:
  1. Acknowledge their request
  2. Transfer to a human using the transfer-to-human tool

Boundaries:
- Never make promises about pricing without checking the knowledge base
- Never diagnose, prescribe, or give professional advice outside your role
- Never share other callers' information
- [TODO:CONFIGURE add business-specific boundaries]

Escalation Rules:
- Transfer to a human if the caller is upset and not calming down
- Transfer to a human if the request requires a decision you cannot make
- Transfer to a human if asked to speak with a person
- [TODO:CONFIGURE add business-specific escalation triggers]

Guidelines:
- Be concise and natural — speak like a real person, not a robot
- Listen carefully and confirm key details before taking action
- If you don't know something, say so honestly and offer alternatives
- Always confirm appointments and important details before ending the call`;

// ------------------------------------------------------------
// Agent Class
// ------------------------------------------------------------
// Extends BaseAgentBuilder which handles:
//   - Vapi config assembly (transcriber, voice, model, tools)
//   - firstMessage and recording settings
//   - serverUrl (webhook endpoint)
//
// The constructor accepts Partial<AgentOptions> so every field
// can be overridden. For client builds, replace the defaults
// below — do not rely on overrides.
// ------------------------------------------------------------

export class ReferenceAgent extends BaseAgentBuilder {
  constructor(overrides?: Partial<AgentOptions>) {
    super({
      // TODO:CONFIGURE — Agent display name (shown in Vapi dashboard and DB)
      name: overrides?.name ?? '[TODO:CONFIGURE] Agent',

      // TODO:CONFIGURE — Industry tag (used for filtering and analytics)
      industry: overrides?.industry ?? 'TODO:CONFIGURE',

      // TODO:CONFIGURE — One-line description of what this agent does
      description:
        overrides?.description ?? '[TODO:CONFIGURE] Handles calls for [business name]',

      // System prompt — the core of the agent's behavior
      systemPrompt: overrides?.systemPrompt ?? SYSTEM_PROMPT,

      // TODO:CONFIGURE — First words the agent speaks when it picks up
      firstMessage:
        overrides?.firstMessage ??
        'Thank you for calling [TODO:CONFIGURE business name]! How can I help you today?',

      // TODO:CONFIGURE — Model selection:
      //   'claude-haiku-4-5-20251001'    — faster, cheaper (~$0.10/min total)
      //   'claude-sonnet-4-5-20250514'   — smarter, more expensive (~$0.28/min total)
      // Use Haiku for simple reception. Use Sonnet for complex reasoning.
      model: overrides?.model ?? 'claude-haiku-4-5-20251001',

      // TODO:CONFIGURE — Voice provider:
      //   'cartesia'    — default, 90ms latency, best cost/quality
      //   'elevenlabs'  — premium, 75ms, more expressive, higher cost
      voiceProvider: overrides?.voiceProvider ?? 'cartesia',

      // TODO:CONFIGURE — Voice ID from the provider's voice library
      // Browse voices at cartesia.ai or elevenlabs.io and paste the ID here.
      // Leave undefined to use the provider's default voice.
      voiceId: overrides?.voiceId,

      // TODO:CONFIGURE — Tools this agent can use during calls.
      // The default set covers most business use cases.
      // Remove tools the client doesn't need. Add custom tools as needed.
      //
      // Available default tools:
      //   TOOL_NAMES.LOOKUP_CALLER       — check caller history + Mem0 memory
      //   TOOL_NAMES.SEARCH_KNOWLEDGE    — query Pinecone knowledge base
      //   TOOL_NAMES.CHECK_AVAILABILITY  — check calendar via n8n
      //   TOOL_NAMES.BOOK_APPOINTMENT    — book appointment via n8n
      //   TOOL_NAMES.TRANSFER_TO_HUMAN   — warm transfer to a human (Phase 2)
      //
      // For custom tools, see src/layers/tools/custom-tool-template.ts
      tools: overrides?.tools ?? [
        TOOL_NAMES.LOOKUP_CALLER,
        TOOL_NAMES.SEARCH_KNOWLEDGE,
        TOOL_NAMES.CHECK_AVAILABILITY,
        TOOL_NAMES.BOOK_APPOINTMENT,
        TOOL_NAMES.TRANSFER_TO_HUMAN,
      ],

      // TODO:CONFIGURE — Webhook URL where Vapi sends events and tool calls.
      // For local dev: use ngrok URL (e.g. https://xxxx.ngrok.io/webhook/vapi)
      // For production: use Railway URL (e.g. https://my-app.up.railway.app/webhook/vapi)
      webhookUrl:
        overrides?.webhookUrl ?? 'https://your-server.com/webhook/vapi',

      // Max call duration in seconds (default: 30 minutes)
      maxDurationSeconds: overrides?.maxDurationSeconds,

      // Seconds of silence before the agent prompts the caller (default: 30)
      silenceTimeoutSeconds: overrides?.silenceTimeoutSeconds,

      // Whether to record calls (default: true — needed for training pipeline)
      recordingEnabled: overrides?.recordingEnabled,

      // TODO:CONFIGURE — Business hours for this client.
      // REQUIRED for every client. Must be set in TWO places:
      //   1. Here (appended to system prompt automatically by base-agent.ts)
      //   2. Vapi schedule config (call getScheduleConfig() from base-agent.ts
      //      and pass it when setting up the phone number)
      //
      // Omit days the business is closed. Times are 24h format.
      // See CLAUDE.md "Business Hours Enforcement" for the full rule.
      businessHours: overrides?.businessHours ?? {
        timezone: 'TODO:CONFIGURE', // e.g. 'America/New_York'
        schedule: [
          // TODO:CONFIGURE — add one entry per open day
          { day: 'monday', open: '09:00', close: '17:00' },
          { day: 'tuesday', open: '09:00', close: '17:00' },
          { day: 'wednesday', open: '09:00', close: '17:00' },
          { day: 'thursday', open: '09:00', close: '17:00' },
          { day: 'friday', open: '09:00', close: '17:00' },
        ],
      },

      // TODO:CONFIGURE — Custom auto-tag keywords for the training pipeline.
      // Override the default topic and outcome keyword lists to match this
      // client's industry vocabulary. Pass these via agent config metadata,
      // then pipeline.ts will forward them to autoTag().
      //
      // Example for a veterinary clinic:
      //   metadata: {
      //     topicKeywords: {
      //       vaccination: ['vaccine', 'shot', 'booster', 'rabies'],
      //       grooming: ['groom', 'bath', 'nail trim', 'haircut'],
      //       emergency: ['emergency', 'urgent', 'bleeding', 'poison'],
      //     },
      //   },

      // Additional metadata stored with the agent config
      metadata: overrides?.metadata,
    });
  }
}
