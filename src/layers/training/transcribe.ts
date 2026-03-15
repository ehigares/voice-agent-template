import { AssemblyAI } from 'assemblyai';
import { config } from '../../config.js';

let assemblyInstance: AssemblyAI | null = null;

function getAssemblyAI(): AssemblyAI {
  if (!assemblyInstance) {
    if (!config.ASSEMBLYAI_API_KEY) {
      throw new Error('ASSEMBLYAI_API_KEY is not configured');
    }
    assemblyInstance = new AssemblyAI({ apiKey: config.ASSEMBLYAI_API_KEY });
  }
  return assemblyInstance;
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  start_ms: number;
  end_ms: number;
}

export async function transcribeRecording(
  audioUrl: string
): Promise<TranscriptSegment[]> {
  const client = getAssemblyAI();

  const transcript = await client.transcripts.transcribe({
    audio_url: audioUrl,
    speaker_labels: true,
  });

  if (transcript.status === 'error') {
    throw new Error(`Transcription failed: ${transcript.error}`);
  }

  const utterances = transcript.utterances ?? [];
  return utterances.map((u) => ({
    speaker: u.speaker === 'A' ? 'agent' : 'caller',
    text: u.text,
    start_ms: u.start,
    end_ms: u.end,
  }));
}
