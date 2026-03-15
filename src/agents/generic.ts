import { BaseAgentBuilder } from './base-agent.js';
import { TOOL_NAMES } from '../layers/tools/tool-definitions.js';
import type { AgentOptions } from './types.js';

const DEFAULT_SYSTEM_PROMPT = `You are a professional, friendly phone agent. Your role is to help callers with their needs efficiently and courteously.

Guidelines:
- Be concise and natural — speak like a real person, not a robot
- Listen carefully and confirm key details before taking action
- If you don't know something, say so honestly and offer alternatives
- Use the available tools to look up information and take actions
- Always confirm appointments and important details before ending the call

Available capabilities:
- Look up caller history and preferences
- Search the knowledge base for business information
- Check appointment availability
- Book appointments`;

export class GenericAgent extends BaseAgentBuilder {
  constructor(overrides?: Partial<AgentOptions>) {
    super({
      name: overrides?.name ?? 'Generic Agent',
      industry: overrides?.industry ?? 'general',
      description:
        overrides?.description ?? 'A configurable phone agent template',
      systemPrompt: overrides?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      firstMessage: overrides?.firstMessage,
      model: overrides?.model ?? 'claude-haiku-4-5-20251001',
      voiceProvider: overrides?.voiceProvider ?? 'cartesia',
      voiceId: overrides?.voiceId,
      tools: overrides?.tools ?? [
        TOOL_NAMES.LOOKUP_CALLER,
        TOOL_NAMES.SEARCH_KNOWLEDGE,
        TOOL_NAMES.CHECK_AVAILABILITY,
        TOOL_NAMES.BOOK_APPOINTMENT,
      ],
      webhookUrl: overrides?.webhookUrl ?? 'https://your-server.com/webhook/vapi',
      maxDurationSeconds: overrides?.maxDurationSeconds,
      silenceTimeoutSeconds: overrides?.silenceTimeoutSeconds,
      recordingEnabled: overrides?.recordingEnabled,
      metadata: overrides?.metadata,
    });
  }
}
