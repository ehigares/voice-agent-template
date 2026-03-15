import { searchKnowledge as search } from '../memory/vector-search.js';
import type { ToolResult } from '../../types/index.js';

export async function searchKnowledge(query: string): Promise<ToolResult> {
  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, data: {}, error: `Knowledge search failed: ${message}` };
  }
}
