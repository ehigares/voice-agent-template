import { logger } from '../../lib/logger.js';
import type { ToolResult } from '../../types/index.js';

/**
 * Wraps an async tool handler with a timeout, AbortController, and fallback message.
 * If the handler takes longer than `ms` or throws, aborts in-flight fetch
 * requests and returns a graceful fallback response.
 *
 * Usage:
 *   return withTimeout(5000, "Sorry, I couldn't do that.", async (signal) => {
 *     const resp = await fetch(url, { signal });
 *     const data = await resp.json();
 *     return { success: true, data };
 *   });
 */
export async function withTimeout(
  ms: number,
  fallbackMessage: string,
  fn: (signal: AbortSignal) => Promise<ToolResult>
): Promise<ToolResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const result = await Promise.race([
      fn(controller.signal),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tool handler timed out')), ms)
      ),
    ]);
    return result;
  } catch (err) {
    controller.abort();
    const message = err instanceof Error ? err.message : String(err);
    logger.error('tool-utils', `Tool handler failed: ${message}`);
    return {
      success: false,
      data: { message: fallbackMessage },
      error: message,
    };
  } finally {
    clearTimeout(timer);
  }
}
