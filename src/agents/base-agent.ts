import type { VapiAssistantConfig } from '../layers/orchestration/vapi-types.js';
import type { AgentOptions, AgentBuilder, BusinessHours } from './types.js';
import { deepgramConfig } from '../layers/speech/stt.js';
import { cartesiaConfig, elevenLabsConfig } from '../layers/speech/tts.js';
import { claudeHaikuConfig, claudeSonnetConfig } from '../layers/llm/model-config.js';
import { getToolDefinitions } from '../layers/tools/tool-definitions.js';

// ---- Business Hours — System Prompt Section ----
// Appended to the LLM system prompt so it knows when the business is open.
// This is enforcement layer 1 of 2 (see getScheduleConfig for layer 2).

function buildBusinessHoursPrompt(bh: BusinessHours): string {
  const lines = bh.schedule.map(
    (d) => `  ${d.day}: ${d.open} – ${d.close}`
  );
  return [
    '',
    'Business Hours (STRICT — enforce these):',
    `Timezone: ${bh.timezone}`,
    ...lines,
    '',
    'If the current time is outside these hours:',
    '- Inform the caller that the business is currently closed',
    '- Tell them the next opening time',
    '- Offer to take a message or suggest they call back',
    '- Do NOT book appointments or transfer to a human outside hours',
  ].join('\n');
}

// ---- Business Hours — Vapi Schedule Config ----
// Returns the schedule object for Vapi's infrastructure-level enforcement.
// This is enforcement layer 2 of 2 — calls are rejected before reaching
// the LLM if outside these hours.
//
// Pass this to Vapi when configuring the phone number or squad.

export function getScheduleConfig(bh: BusinessHours): Record<string, unknown> {
  return {
    timezone: bh.timezone,
    schedule: bh.schedule.map((d) => ({
      day: d.day,
      startTime: d.open,
      endTime: d.close,
    })),
  };
}

export class BaseAgentBuilder implements AgentBuilder {
  protected options: AgentOptions;

  constructor(options: AgentOptions) {
    this.options = options;
  }

  build(): VapiAssistantConfig {
    const { options } = this;

    // Compose voice config based on provider
    const voice =
      options.voiceProvider === 'elevenlabs'
        ? elevenLabsConfig(options.voiceId)
        : cartesiaConfig(options.voiceId);

    // Compose model config based on selection
    const model =
      options.model === 'claude-sonnet-4-5-20250514'
        ? claudeSonnetConfig()
        : claudeHaikuConfig();

    // Build system prompt — append business hours if configured
    let systemPrompt = options.systemPrompt;
    if (options.businessHours) {
      systemPrompt += buildBusinessHoursPrompt(options.businessHours);
    }
    model.systemPrompt = systemPrompt;

    // Filter tool definitions to only include requested tools
    const allTools = getToolDefinitions(options.webhookUrl);
    const tools = options.tools
      ? allTools.filter((t) => options.tools!.includes(t.function.name as typeof options.tools extends (infer T)[] ? T : never))
      : allTools;

    return {
      name: options.name,
      transcriber: deepgramConfig(),
      voice,
      model,
      tools,
      firstMessage: options.firstMessage ?? `Hello! Thank you for calling. How can I help you today?`,
      firstMessageMode: 'assistant-speaks-first',
      recordingEnabled: options.recordingEnabled ?? true,
      maxDurationSeconds: options.maxDurationSeconds ?? 1800,
      silenceTimeoutSeconds: options.silenceTimeoutSeconds ?? 30,
      serverUrl: options.webhookUrl,
      metadata: {
        industry: options.industry,
        description: options.description,
        ...options.metadata,
      },
    };
  }
}
