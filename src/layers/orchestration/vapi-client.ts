import { VapiClient } from '@vapi-ai/server-sdk';
import { config } from '../../config.js';
import type { VapiAssistantConfig } from './vapi-types.js';

const vapi = new VapiClient({ token: config.VAPI_API_KEY });

export async function createAssistant(
  assistantConfig: VapiAssistantConfig
): Promise<{ id: string }> {
  const assistant = await vapi.assistants.create(assistantConfig as unknown as Record<string, unknown>);
  return { id: (assistant as unknown as { id: string }).id };
}

export async function updateAssistant(
  id: string,
  updates: Partial<VapiAssistantConfig>
): Promise<void> {
  await vapi.assistants.update(id, updates as unknown as Record<string, unknown>);
}

export async function deleteAssistant(id: string): Promise<void> {
  await vapi.assistants.delete(id);
}

export async function getAssistant(id: string): Promise<Record<string, unknown> | null> {
  try {
    const assistant = await vapi.assistants.get(id);
    return assistant as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function listAssistants(): Promise<Record<string, unknown>[]> {
  const assistants = await vapi.assistants.list();
  return assistants as unknown as Record<string, unknown>[];
}

export { vapi };
