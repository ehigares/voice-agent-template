import type { VapiAssistantConfig } from '../layers/orchestration/vapi-types.js';
import type { AgentOptions, AgentBuilder } from './types.js';
import { deepgramConfig } from '../layers/speech/stt.js';
import { cartesiaConfig, elevenLabsConfig } from '../layers/speech/tts.js';
import { claudeHaikuConfig, claudeSonnetConfig } from '../layers/llm/model-config.js';
import { getToolDefinitions } from '../layers/tools/tool-definitions.js';

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

    // Add system prompt to model config
    model.systemPrompt = options.systemPrompt;

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
