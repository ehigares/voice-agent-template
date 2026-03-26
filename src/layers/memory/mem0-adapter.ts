import MemorySDK from 'mem0ai';
import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';
import type { MemoryClient } from './memory-client.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mem0Instance: any = null;

function getMem0() {
  if (!mem0Instance) {
    if (!config.MEM0_API_KEY) {
      throw new Error('MEM0_API_KEY is not configured');
    }
    mem0Instance = new (MemorySDK as unknown as new (opts: { apiKey: string }) => typeof mem0Instance)({
      apiKey: config.MEM0_API_KEY,
    });
  }
  return mem0Instance;
}

export const mem0Adapter: MemoryClient = {
  async addMemory(userId: string, text: string): Promise<void> {
    const client = getMem0();
    await client.add([{ role: 'user', content: text }], { user_id: userId });
    logger.debug('mem0', `Added memory for user ${userId}`);
  },

  async getMemories(userId: string): Promise<{ memory: string; id: string }[]> {
    const client = getMem0();
    const result = await client.getAll({ user_id: userId });
    return (result as { memory: string; id: string }[]) ?? [];
  },

  async searchMemories(userId: string, query: string): Promise<{ memory: string; score: number }[]> {
    const client = getMem0();
    const result = await client.search(query, { user_id: userId });
    return (result as { memory: string; score: number }[]) ?? [];
  },
};
