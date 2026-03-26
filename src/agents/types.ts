import type { VapiAssistantConfig } from '../layers/orchestration/vapi-types.js';
import type { VoiceProvider, ClaudeModel } from '../types/index.js';
import type { ToolName } from '../layers/tools/tool-definitions.js';

/**
 * Business hours for a single day of the week.
 * Used for both system prompt injection and Vapi schedule config.
 */
export interface DaySchedule {
  /** Day of the week: 'monday' | 'tuesday' | ... | 'sunday' */
  day: string;
  /** Opening time in HH:MM 24h format, e.g. '09:00' */
  open: string;
  /** Closing time in HH:MM 24h format, e.g. '17:00' */
  close: string;
}

/**
 * Business hours configuration.
 * Must be set for every client — the agent enforces hours in two places:
 *   1. System prompt (so the LLM refuses after-hours requests)
 *   2. Vapi schedule config (so calls are rejected at infrastructure level)
 */
export interface BusinessHours {
  /** Timezone in IANA format, e.g. 'America/New_York' */
  timezone: string;
  /** Schedule for each open day. Omit closed days entirely. */
  schedule: DaySchedule[];
}

export interface AgentOptions {
  name: string;
  industry: string;
  description: string;
  systemPrompt: string;
  firstMessage?: string;
  model?: ClaudeModel;
  voiceProvider?: VoiceProvider;
  voiceId?: string;
  tools?: ToolName[];
  webhookUrl: string;
  maxDurationSeconds?: number;
  silenceTimeoutSeconds?: number;
  recordingEnabled?: boolean;
  businessHours?: BusinessHours;
  metadata?: Record<string, unknown>;
}

export interface AgentBuilder {
  build(): VapiAssistantConfig;
}
