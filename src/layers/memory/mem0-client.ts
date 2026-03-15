import MemoryClient from 'mem0ai';
import { config } from '../../config.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mem0Instance: any = null;

function getMem0() {
  if (!mem0Instance) {
    if (!config.MEM0_API_KEY) {
      throw new Error('MEM0_API_KEY is not configured');
    }
    mem0Instance = new (MemoryClient as unknown as new (opts: { apiKey: string }) => typeof mem0Instance)({ apiKey: config.MEM0_API_KEY });
  }
  return mem0Instance;
}

export async function addMemory(userId: string, text: string): Promise<void> {
  const client = getMem0();
  await client.add([{ role: 'user', content: text }], { user_id: userId });
}

export async function getMemories(userId: string): Promise<{ memory: string; id: string }[]> {
  const client = getMem0();
  const result = await client.getAll({ user_id: userId });
  return (result as { memory: string; id: string }[]) ?? [];
}

export async function searchMemories(
  userId: string,
  query: string
): Promise<{ memory: string; score: number }[]> {
  const client = getMem0();
  const result = await client.search(query, { user_id: userId });
  return (result as { memory: string; score: number }[]) ?? [];
}
