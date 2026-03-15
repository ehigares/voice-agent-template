import { config } from '../../config.js';

const headers = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(config.N8N_API_KEY ? { 'X-N8N-API-KEY': config.N8N_API_KEY } : {}),
});

export async function triggerWebhook(
  webhookPath: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const url = `${config.N8N_BASE_URL}/webhook/${webhookPath}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`n8n webhook failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

export async function listWorkflows(): Promise<Record<string, unknown>[]> {
  const url = `${config.N8N_BASE_URL}/api/v1/workflows`;
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) {
    throw new Error(`Failed to list n8n workflows: ${response.status}`);
  }
  const body = (await response.json()) as { data: Record<string, unknown>[] };
  return body.data ?? [];
}

export async function deployWorkflow(
  workflow: Record<string, unknown>
): Promise<{ id: string }> {
  const url = `${config.N8N_BASE_URL}/api/v1/workflows`;
  const response = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(workflow),
  });
  if (!response.ok) {
    throw new Error(`Failed to deploy n8n workflow: ${response.status}`);
  }
  return (await response.json()) as { id: string };
}

export async function activateWorkflow(id: string): Promise<void> {
  const url = `${config.N8N_BASE_URL}/api/v1/workflows/${id}/activate`;
  const response = await fetch(url, {
    method: 'POST',
    headers: headers(),
  });
  if (!response.ok) {
    throw new Error(`Failed to activate n8n workflow: ${response.status}`);
  }
}
