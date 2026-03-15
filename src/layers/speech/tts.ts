import type { VapiVoiceConfig } from '../orchestration/vapi-types.js';

// Default voice IDs — users replace these with their preferred voices
const DEFAULT_CARTESIA_VOICE = '79a125e8-cd45-4c13-8a67-188112f4dd22'; // Cartesia "Barbershop Man"
const DEFAULT_ELEVENLABS_VOICE = '21m00Tcm4TlvDq8ikWAM'; // ElevenLabs "Rachel"

export function cartesiaConfig(voiceId?: string): VapiVoiceConfig {
  return {
    provider: 'cartesia',
    voiceId: voiceId ?? DEFAULT_CARTESIA_VOICE,
  };
}

export function elevenLabsConfig(voiceId?: string): VapiVoiceConfig {
  return {
    provider: '11labs',
    voiceId: voiceId ?? DEFAULT_ELEVENLABS_VOICE,
  };
}
