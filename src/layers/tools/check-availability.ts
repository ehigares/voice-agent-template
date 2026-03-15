import { triggerWebhook } from '../automation/n8n-client.js';
import type { ToolResult } from '../../types/index.js';

export async function checkAvailability(
  date: string,
  serviceType?: string
): Promise<ToolResult> {
  try {
    const result = await triggerWebhook('appointment-booking', {
      action: 'check',
      date,
      service_type: serviceType ?? 'general',
    });

    return {
      success: true,
      data: {
        date,
        availableSlots: result.slots ?? [],
        message: result.message ?? 'Availability checked.',
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      data: {},
      error: `Availability check failed: ${message}`,
    };
  }
}
