import OpenAI from 'openai';
import { config } from '../../config.js';
import { queryVectors } from './pinecone-client.js';

let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    if (!config.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured — needed for embeddings');
    }
    openaiInstance = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }
  return openaiInstance;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: config.EMBEDDING_MODEL,
    input: text,
    dimensions: config.EMBEDDING_DIMENSIONS,
  });
  return response.data[0].embedding;
}

export async function searchKnowledge(
  query: string,
  topK: number = 5
): Promise<{ id: string; score: number; content: string; metadata: Record<string, unknown> }[]> {
  const embedding = await generateEmbedding(query);
  const results = await queryVectors(embedding, topK);
  return results.map((r) => ({
    id: r.id,
    score: r.score,
    content: (r.metadata?.content as string) ?? '',
    metadata: r.metadata ?? {},
  }));
}
