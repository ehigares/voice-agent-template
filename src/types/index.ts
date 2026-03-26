// ============================================================
// Voice Agent Template — Shared TypeScript Types
// Mirrors the 5 database tables + common enums
// ============================================================

export type CallDirection = 'inbound' | 'outbound';

export type CallStatus = 'completed' | 'failed' | 'missed' | 'in-progress' | 'voicemail';

export type CallOutcome = 'booked' | 'resolved' | 'escalated' | 'dropped' | 'voicemail' | 'other';

export type VoiceProvider = 'cartesia' | 'elevenlabs';

export type ClaudeModel = 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-5-20250514';

export type Speaker = 'agent' | 'caller';

// ---- Database Row Types ----

export interface AgentConfig {
  id: string;
  name: string;
  industry: string;
  description: string;
  vapi_agent_id: string | null;
  vapi_config: Record<string, unknown>;
  system_prompt: string;
  model: string;
  voice_provider: VoiceProvider;
  voice_id: string;
  tools: Record<string, unknown>[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Caller {
  id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  mem0_user_id: string | null;
  tags: string[];
  notes: string | null;
  metadata: Record<string, unknown>;
  first_call_at: string | null;
  last_call_at: string | null;
  total_calls: number;
  created_at: string;
}

export interface Call {
  id: string;
  vapi_call_id: string;
  agent_id: string | null;
  caller_id: string | null;
  phone_number: string;
  direction: CallDirection;
  status: CallStatus;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  s3_key: string | null;
  recording_archived: boolean;
  recording_archived_at: string | null;
  cost_cents: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Transcript {
  id: string;
  call_id: string;
  speaker: Speaker;
  content: string;
  start_ms: number;
  end_ms: number;
  embedding: number[] | null;
  embedding_model: string | null;
  created_at: string;
}

export interface TrainingData {
  id: string;
  call_id: string;
  transcript: string;
  tags: string[];
  sentiment_score: number | null;
  quality_score: number | null;
  outcome: CallOutcome | null;
  notes: string | null;
  embedding: number[] | null;
  embedding_model: string | null;
  created_at: string;
}

// ---- Tool Types ----

export interface ToolResult {
  success: boolean;
  data: Record<string, unknown>;
  error?: string;
}

// ---- Webhook Types ----

export interface VapiWebhookPayload {
  message: {
    type: string;
    call?: Record<string, unknown>;
    functionCall?: {
      name: string;
      parameters: Record<string, unknown>;
    };
    transcript?: string;
    [key: string]: unknown;
  };
}
