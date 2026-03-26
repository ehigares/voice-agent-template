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
 * Uses dynamic ESM import to lazy-load the Mem0 adapter.
 */
async function createMemoryClient(): Promise<MemoryClient> {
  if (!config.ENABLE_MEM0) {
    logger.info('memory', 'Mem0 disabled — using null memory client');
    return nullMemoryClient;
  }

  // Lazy-load the Mem0 adapter to avoid importing the SDK when disabled
  try {
    const { mem0Adapter } = await import('./mem0-adapter.js');
    return mem0Adapter;
  } catch {
    logger.warn('memory', 'Failed to load Mem0 adapter — falling back to null client');
    return nullMemoryClient;
  }
}

/** Initialized via initMemoryClient() at startup. */
let _memoryClient: MemoryClient = nullMemoryClient;

/**
 * Call once at application startup (e.g. in server.ts or index.ts)
 * before any tool handlers run.
 */
export async function initMemoryClient(): Promise<void> {
  _memoryClient = await createMemoryClient();
}

/**
 * The active memory client. Returns the null client until
 * initMemoryClient() has been awaited.
 */
export function getMemoryClient(): MemoryClient {
  return _memoryClient;
}

/**
 * @deprecated Use getMemoryClient() instead. Kept for backward compatibility
 * during migration — will be the null client until initMemoryClient() runs.
 */
export const memoryClient: MemoryClient = new Proxy(nullMemoryClient, {
  get(_target, prop, receiver) {
    return Reflect.get(_memoryClient, prop, receiver);
  },
});
