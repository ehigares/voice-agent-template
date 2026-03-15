import { getCaller } from '../memory/queries.js';
import { getMemories } from '../memory/mem0-client.js';
import type { ToolResult } from '../../types/index.js';

export async function lookupCaller(phoneNumber: string): Promise<ToolResult> {
  try {
    const caller = await getCaller(phoneNumber);

    let memories: { memory: string; id: string }[] = [];
    if (caller?.mem0_user_id) {
      try {
        memories = await getMemories(caller.mem0_user_id);
      } catch (err) {
        console.warn('Mem0 lookup failed (non-critical):', err);
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
        memories: memories.map((m) => m.memory),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, data: {}, error: `Caller lookup failed: ${message}` };
  }
}
