import { Pinecone, type RecordMetadata } from '@pinecone-database/pinecone';
import { config } from '../../config.js';

let pineconeInstance: Pinecone | null = null;

function getPinecone(): Pinecone {
  if (!pineconeInstance) {
    if (!config.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is not configured');
    }
    pineconeInstance = new Pinecone({ apiKey: config.PINECONE_API_KEY });
  }
  return pineconeInstance;
}

export function getPineconeIndex() {
  return getPinecone().index(config.PINECONE_INDEX);
}

export async function upsertVectors(
  vectors: { id: string; values: number[]; metadata?: RecordMetadata }[]
): Promise<void> {
  const index = getPineconeIndex();
  await index.upsert(vectors);
}

export async function queryVectors(
  embedding: number[],
  topK: number = 5,
  filter?: Record<string, unknown>
): Promise<{ id: string; score: number; metadata?: Record<string, unknown> }[]> {
  const index = getPineconeIndex();
  const result = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
    filter: filter as RecordMetadata,
  });
  return (result.matches ?? []).map((m) => ({
    id: m.id,
    score: m.score ?? 0,
    metadata: m.metadata as Record<string, unknown> | undefined,
  }));
}
