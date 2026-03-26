import { config } from '../../config.js';
import { searchKnowledge as search } from '../memory/vector-search.js';
import { withTimeout } from './tool-utils.js';
import type { ToolResult } from '../../types/index.js';

const FALLBACK_MSG = "I wasn't able to search our information right now. Let me try to help you another way.";

export async function searchKnowledge(query: string): Promise<ToolResult> {
  if (!config.ENABLE_PINECONE) {
    return {
      success: true,
      data: {
        found: false,
        message: 'Knowledge base search is not enabled.',
      },
    };
  }

  return withTimeout(5000, FALLBACK_MSG, async (_signal) => {
    const results = await search(query, 5);

    if (results.length === 0) {
      return {
        success: true,
        data: {
          found: false,
          message: 'No relevant information found in the knowledge base.',
        },
      };
    }

    return {
      success: true,
      data: {
        found: true,
        results: results.map((r) => ({
          content: r.content,
          score: r.score,
          source: r.metadata?.source ?? 'unknown',
        })),
      },
    };
  });
}
