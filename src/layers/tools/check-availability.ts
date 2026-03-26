import { triggerWebhook } from '../automation/n8n-client.js';
import { withTimeout } from './tool-utils.js';
import type { ToolResult } from '../../types/index.js';

const FALLBACK_MSG = "I'm having trouble checking availability right now. Can I take your information and have someone call you back?";

export async function checkAvailability(
  date: string,
  serviceType?: string
): Promise<ToolResult> {
  return withTimeout(5000, FALLBACK_MSG, async () => {
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
  });
}
