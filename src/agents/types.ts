import type { VapiAssistantConfig } from '../layers/orchestration/vapi-types.js';
import type { VoiceProvider, ClaudeModel } from '../types/index.js';
import type { ToolName } from '../layers/tools/tool-definitions.js';

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
  metadata?: Record<string, unknown>;
}

export interface AgentBuilder {
  build(): VapiAssistantConfig;
}
