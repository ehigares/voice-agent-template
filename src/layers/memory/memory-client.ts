import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';

/**
 * MemoryClient interface — abstracts persistent caller memory.
 *
 * The current implementation uses Mem0 (see mem0-adapter.ts).
 * To swap providers (e.g. Zep, custom), create a new adapter
 * implementing these three methods and update the export below.
 *
 * Tool handlers and pipeline code should NEVER import Mem0
 * directly — always use `memoryClient` from this file.
 */
export interface MemoryClient {
  addMemory(userId: string, text: string): Promise<void>;
  getMemories(userId: string): Promise<{ memory: string; id: string }[]>;
  searchMemories(userId: string, query: string): Promise<{ memory: string; score: number }[]>;
}

/**
 * No-op implementation used when ENABLE_MEM0 is false.
 */
const nullMemoryClient: MemoryClient = {
  async addMemory() {},
  async getMemories() {
    return [];
  },
  async searchMemories() {
    return [];
  },
};

/**
 * Creates the active MemoryClient based on configuration.
 */
function createMemoryClient(): MemoryClient {
  if (!config.ENABLE_MEM0) {
    logger.info('memory', 'Mem0 disabled — using null memory client');
    return nullMemoryClient;
  }

  // Lazy-load the Mem0 adapter to avoid importing the SDK when disabled
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mem0Adapter } = require('./mem0-adapter.js') as { mem0Adapter: MemoryClient };
    return mem0Adapter;
  } catch {
    logger.warn('memory', 'Failed to load Mem0 adapter — falling back to null client');
    return nullMemoryClient;
  }
}

export const memoryClient: MemoryClient = createMemoryClient();
