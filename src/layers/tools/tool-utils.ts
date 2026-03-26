import { logger } from '../../lib/logger.js';
import type { ToolResult } from '../../types/index.js';

/**
 * Wraps an async tool handler with a timeout and fallback message.
 * If the handler takes longer than `ms` or throws, returns a graceful
 * fallback response instead of hanging or crashing.
 *
 * Usage:
 *   return withTimeout(5000, "Sorry, I couldn't do that.", async () => {
 *     const data = await doWork();
 *     return { success: true, data };
 *   });
 */
export async function withTimeout(
  ms: number,
  fallbackMessage: string,
  fn: () => Promise<ToolResult>
): Promise<ToolResult> {
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tool handler timed out')), ms)
      ),
    ]);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('tool-utils', `Tool handler failed: ${message}`);
    return {
      success: false,
      data: { message: fallbackMessage },
      error: message,
    };
  }
}
