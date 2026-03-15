import type { CallOutcome } from '../../types/index.js';

export interface TagResult {
  tags: string[];
  sentimentScore: number;
  outcome: CallOutcome;
}

// Keyword-based topic detection
const TOPIC_KEYWORDS: Record<string, string[]> = {
  scheduling: ['appointment', 'schedule', 'book', 'reschedule', 'cancel', 'available', 'opening'],
  billing: ['bill', 'charge', 'payment', 'invoice', 'cost', 'price', 'insurance', 'copay'],
  support: ['problem', 'issue', 'broken', 'not working', 'error', 'help', 'fix', 'trouble'],
  information: ['hours', 'location', 'address', 'directions', 'website', 'email'],
  complaint: ['complaint', 'unhappy', 'dissatisfied', 'frustrated', 'unacceptable', 'terrible'],
  emergency: ['emergency', 'urgent', 'asap', 'immediately', 'right away'],
};

// Simple sentiment word lists
const POSITIVE_WORDS = [
  'thank', 'thanks', 'great', 'excellent', 'wonderful', 'perfect', 'awesome',
  'appreciate', 'helpful', 'good', 'happy', 'pleased', 'fantastic', 'love',
];
const NEGATIVE_WORDS = [
  'frustrated', 'angry', 'upset', 'terrible', 'horrible', 'awful', 'worst',
  'disappointed', 'unacceptable', 'ridiculous', 'complaint', 'problem', 'hate',
];

// Outcome detection keywords
const OUTCOME_KEYWORDS: Record<CallOutcome, string[]> = {
  booked: ['booked', 'confirmed', 'scheduled', 'appointment set', 'see you'],
  resolved: ['resolved', 'fixed', 'solved', 'taken care of', 'all set'],
  escalated: ['transfer', 'manager', 'supervisor', 'specialist', 'call back', 'escalat'],
  dropped: ['hello?', 'are you there', 'can you hear'],
  voicemail: ['voicemail', 'leave a message', 'after the beep'],
  other: [],
};

export function autoTag(transcript: string): TagResult {
  const lower = transcript.toLowerCase();

  // Extract topics
  const tags: string[] = [];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      tags.push(topic);
    }
  }

  // Calculate sentiment score (-1 to 1)
  const words = lower.split(/\s+/);
  let positiveCount = 0;
  let negativeCount = 0;
  for (const word of words) {
    if (POSITIVE_WORDS.some((pw) => word.includes(pw))) positiveCount++;
    if (NEGATIVE_WORDS.some((nw) => word.includes(nw))) negativeCount++;
  }
  const total = positiveCount + negativeCount;
  const sentimentScore = total === 0 ? 0 : (positiveCount - negativeCount) / total;

  // Detect outcome
  let outcome: CallOutcome = 'other';
  for (const [key, keywords] of Object.entries(OUTCOME_KEYWORDS)) {
    if (key === 'other') continue;
    if (keywords.some((kw) => lower.includes(kw))) {
      outcome = key as CallOutcome;
      break;
    }
  }

  return { tags, sentimentScore, outcome };
}
