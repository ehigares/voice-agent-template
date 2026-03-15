import type { VapiTranscriberConfig } from '../orchestration/vapi-types.js';

export function deepgramConfig(options?: {
  model?: string;
  language?: string;
  keywords?: string[];
}): VapiTranscriberConfig {
  return {
    provider: 'deepgram',
    model: options?.model ?? 'nova-3',
    language: options?.language ?? 'en',
    keywords: options?.keywords,
  };
}
