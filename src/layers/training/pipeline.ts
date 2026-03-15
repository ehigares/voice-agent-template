import { insertCall, upsertCaller, insertTranscript, insertTrainingData } from '../memory/queries.js';
import { addMemory } from '../memory/mem0-client.js';
import { generateEmbedding } from '../memory/vector-search.js';
import { uploadRecording } from './s3-upload.js';
import { transcribeRecording, type TranscriptSegment } from './transcribe.js';
import { autoTag } from './auto-tag.js';
import { scoreCall } from './score.js';
import type { CallDirection } from '../../types/index.js';

interface CallEndedData {
  call_id: string;
  phone_number: string;
  started_at: string;
  ended_at?: string;
  ended_reason?: string;
  recording_url?: string;
  transcript?: string;
  agent_id?: string;
  direction?: CallDirection;
}

export async function processCallEnd(data: CallEndedData): Promise<void> {
  console.log(`[pipeline] Processing call ${data.call_id}`);

  // Step 1: Save call record
  let callRecord;
  try {
    const durationMs =
      data.ended_at && data.started_at
        ? new Date(data.ended_at).getTime() - new Date(data.started_at).getTime()
        : 0;

    callRecord = await insertCall({
      vapi_call_id: data.call_id,
      phone_number: data.phone_number,
      direction: data.direction ?? 'inbound',
      status: 'completed',
      started_at: data.started_at,
      ended_at: data.ended_at ?? null,
      duration_seconds: Math.round(durationMs / 1000),
      recording_url: data.recording_url ?? null,
      s3_key: null,
      cost_cents: null,
      agent_id: data.agent_id ?? null,
      caller_id: null,
      metadata: { ended_reason: data.ended_reason },
    });
    console.log(`[pipeline] Saved call record: ${callRecord.id}`);
  } catch (err) {
    console.error('[pipeline] Failed to save call record:', err);
    return;
  }

  // Step 2: Upsert caller
  try {
    const caller = await upsertCaller(data.phone_number, {
      last_call_at: data.started_at,
    });
    console.log(`[pipeline] Upserted caller: ${caller.id}`);
  } catch (err) {
    console.error('[pipeline] Failed to upsert caller:', err);
  }

  // Step 3: Upload recording to S3
  if (data.recording_url) {
    try {
      const s3Key = await uploadRecording(data.call_id, data.recording_url);
      console.log(`[pipeline] Uploaded to S3: ${s3Key}`);
    } catch (err) {
      console.error('[pipeline] Failed to upload recording:', err);
    }
  }

  // Step 4: Transcribe
  let segments: TranscriptSegment[] = [];
  if (data.recording_url) {
    try {
      segments = await transcribeRecording(data.recording_url);
      console.log(`[pipeline] Transcribed ${segments.length} segments`);
    } catch (err) {
      console.error('[pipeline] Failed to transcribe:', err);
    }
  }

  // Step 5: Save transcript segments with embeddings
  for (const segment of segments) {
    try {
      let embedding: number[] | null = null;
      try {
        embedding = await generateEmbedding(segment.text);
      } catch {
        // Embeddings are optional — continue without them
      }
      await insertTranscript({
        call_id: callRecord.id,
        speaker: segment.speaker as 'agent' | 'caller',
        content: segment.text,
        start_ms: segment.start_ms,
        end_ms: segment.end_ms,
        embedding,
      });
    } catch (err) {
      console.error('[pipeline] Failed to save transcript segment:', err);
    }
  }

  // Step 6: Auto-tag
  const fullTranscript =
    data.transcript ?? segments.map((s) => `${s.speaker}: ${s.text}`).join('\n');
  const tagResult = autoTag(fullTranscript);
  console.log(`[pipeline] Tags: ${tagResult.tags.join(', ')} | Sentiment: ${tagResult.sentimentScore}`);

  // Step 7: Score
  const durationSeconds = callRecord.duration_seconds ?? 0;
  const scoreResult = scoreCall(segments, {
    durationSeconds,
    outcome: tagResult.outcome,
    sentimentScore: tagResult.sentimentScore,
  });
  console.log(`[pipeline] Quality score: ${scoreResult.qualityScore}`);

  // Step 8: Save training data
  try {
    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbedding(fullTranscript);
    } catch {
      // Embeddings are optional
    }

    await insertTrainingData({
      call_id: callRecord.id,
      transcript: fullTranscript,
      tags: tagResult.tags,
      sentiment_score: tagResult.sentimentScore,
      quality_score: scoreResult.qualityScore,
      outcome: tagResult.outcome,
      notes: scoreResult.notes,
      embedding,
    });
    console.log(`[pipeline] Saved training data`);
  } catch (err) {
    console.error('[pipeline] Failed to save training data:', err);
  }

  // Step 9: Add to Mem0 caller memory (non-critical)
  try {
    const callerSummary = segments
      .filter((s) => s.speaker === 'caller')
      .map((s) => s.text)
      .join(' ');
    if (callerSummary.length > 20) {
      await addMemory(data.phone_number, callerSummary);
      console.log(`[pipeline] Added caller memory for ${data.phone_number}`);
    }
  } catch (err) {
    console.warn('[pipeline] Failed to add Mem0 memory (non-critical):', err);
  }

  console.log(`[pipeline] Completed processing call ${data.call_id}`);
}
