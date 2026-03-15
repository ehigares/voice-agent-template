import type { TranscriptSegment } from './transcribe.js';

export interface ScoreResult {
  qualityScore: number;
  notes: string;
}

export function scoreCall(
  segments: TranscriptSegment[],
  metadata: {
    durationSeconds?: number;
    outcome?: string;
    sentimentScore?: number;
  }
): ScoreResult {
  let score = 0.5; // Start at neutral
  const notes: string[] = [];

  // Factor 1: Call had actual conversation (not just a greeting)
  const totalWords = segments.reduce((acc, s) => acc + s.text.split(/\s+/).length, 0);
  if (totalWords > 50) {
    score += 0.1;
    notes.push('Substantive conversation');
  } else if (totalWords < 10) {
    score -= 0.15;
    notes.push('Very short interaction');
  }

  // Factor 2: Both parties spoke
  const speakers = new Set(segments.map((s) => s.speaker));
  if (speakers.size >= 2) {
    score += 0.1;
    notes.push('Two-way conversation');
  } else {
    score -= 0.1;
    notes.push('One-sided conversation');
  }

  // Factor 3: Call duration (sweet spot: 1-10 minutes)
  if (metadata.durationSeconds) {
    if (metadata.durationSeconds >= 60 && metadata.durationSeconds <= 600) {
      score += 0.1;
      notes.push('Good call duration');
    } else if (metadata.durationSeconds < 30) {
      score -= 0.1;
      notes.push('Call ended very quickly');
    }
  }

  // Factor 4: Positive outcome
  if (metadata.outcome === 'booked' || metadata.outcome === 'resolved') {
    score += 0.15;
    notes.push(`Positive outcome: ${metadata.outcome}`);
  } else if (metadata.outcome === 'dropped') {
    score -= 0.15;
    notes.push('Call was dropped');
  }

  // Factor 5: Caller sentiment
  if (metadata.sentimentScore !== undefined) {
    if (metadata.sentimentScore > 0.3) {
      score += 0.1;
      notes.push('Positive caller sentiment');
    } else if (metadata.sentimentScore < -0.3) {
      score -= 0.1;
      notes.push('Negative caller sentiment');
    }
  }

  // Clamp to 0-1
  score = Math.max(0, Math.min(1, score));

  return {
    qualityScore: Math.round(score * 100) / 100,
    notes: notes.join('; '),
  };
}
