import { logger } from '../../lib/logger.js';
import { getCaller } from '../memory/queries.js';
import { memoryClient } from '../memory/memory-client.js';
import { config } from '../../config.js';
import { withTimeout } from './tool-utils.js';
import type { ToolResult } from '../../types/index.js';

const FALLBACK_MSG = "I wasn't able to look up your information right now, but I'm happy to help you.";

export async function lookupCaller(phoneNumber: string): Promise<ToolResult> {
  return withTimeout(5000, FALLBACK_MSG, async (_signal) => {
    const caller = await getCaller(phoneNumber);

    let memories: string[] = [];
    if (caller?.mem0_user_id && config.ENABLE_MEM0) {
      try {
        const mems = await memoryClient.getMemories(caller.mem0_user_id);
        memories = mems.map((m) => m.memory);
      } catch (err) {
        logger.warn('lookup-caller', 'Mem0 lookup failed (non-critical)', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!caller) {
      return {
        success: true,
        data: {
          known: false,
          message: 'New caller — no previous history found.',
        },
      };
    }

    return {
      success: true,
      data: {
        known: true,
        name: caller.name,
        email: caller.email,
        totalCalls: caller.total_calls,
        lastCallAt: caller.last_call_at,
        tags: caller.tags,
        notes: caller.notes,
        memories,
      },
    };
  });
}
