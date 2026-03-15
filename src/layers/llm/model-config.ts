import type { VapiModelConfig } from '../orchestration/vapi-types.js';

export function claudeHaikuConfig(options?: {
  temperature?: number;
  maxTokens?: number;
}): VapiModelConfig {
  return {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? 1024,
  };
}

export function claudeSonnetConfig(options?: {
  temperature?: number;
  maxTokens?: number;
}): VapiModelConfig {
  return {
    provider: 'anthropic',
    model: 'claude-sonnet-4-5-20250514',
    temperature: options?.temperature ?? 0.7,
    maxTokens: options?.maxTokens ?? 2048,
  };
}
