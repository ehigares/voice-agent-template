// ============================================================
// Vapi TypeScript Types
// Structures for building assistant configs and handling webhooks
// ============================================================

export interface VapiTranscriberConfig {
  provider: 'deepgram';
  model: string;
  language: string;
  keywords?: string[];
}

export interface VapiVoiceConfig {
  provider: 'cartesia' | '11labs';
  voiceId: string;
  speed?: number;
  stability?: number;
  similarityBoost?: number;
}

export interface VapiModelConfig {
  provider: 'anthropic';
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface VapiToolParameter {
  type: string;
  description: string;
  enum?: string[];
}

export interface VapiToolConfig {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, VapiToolParameter>;
      required?: string[];
    };
  };
  server?: {
    url: string;
    secret?: string;
  };
}

export interface VapiAssistantConfig {
  name: string;
  transcriber: VapiTranscriberConfig;
  voice: VapiVoiceConfig;
  model: VapiModelConfig;
  firstMessage?: string;
  firstMessageMode?: 'assistant-speaks-first' | 'assistant-waits-for-user';
  hipaaEnabled?: boolean;
  recordingEnabled?: boolean;
  endCallMessage?: string;
  maxDurationSeconds?: number;
  silenceTimeoutSeconds?: number;
  serverUrl?: string;
  serverUrlSecret?: string;
  tools?: VapiToolConfig[];
  metadata?: Record<string, unknown>;
}

// ---- Webhook Event Types ----

export type VapiWebhookEventType =
  | 'assistant-request'
  | 'function-call'
  | 'status-update'
  | 'end-of-call-report'
  | 'hang'
  | 'speech-update'
  | 'transcript';

export interface VapiServerMessage {
  message: {
    type: VapiWebhookEventType;
    call?: VapiCallInfo;
    functionCall?: VapiFunctionCall;
    transcript?: string;
    status?: string;
    endedReason?: string;
    artifact?: VapiArtifact;
    [key: string]: unknown;
  };
}

export interface VapiCallInfo {
  id: string;
  orgId: string;
  type: 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall';
  phoneNumber?: { number: string };
  customer?: { number: string };
  status: string;
  startedAt: string;
  endedAt?: string;
  [key: string]: unknown;
}

export interface VapiFunctionCall {
  name: string;
  parameters: Record<string, unknown>;
}

export interface VapiArtifact {
  recording?: { url: string };
  transcript?: string;
  messages?: { role: string; content: string }[];
  [key: string]: unknown;
}

export interface VapiServerMessageResponse {
  results?: Array<{
    toolCallId?: string;
    result: string;
  }>;
  assistant?: VapiAssistantConfig;
}
