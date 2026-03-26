import { triggerWebhook } from '../automation/n8n-client.js';
import { withTimeout } from './tool-utils.js';
import type { ToolResult } from '../../types/index.js';

const FALLBACK_MSG = "I'm having trouble booking right now. Let me take your details and have someone confirm your appointment shortly.";

interface BookingParams {
  date: string;
  time: string;
  caller_name: string;
  phone_number: string;
  service_type?: string;
}

export async function bookAppointment(params: BookingParams): Promise<ToolResult> {
  return withTimeout(5000, FALLBACK_MSG, async (_signal) => {
    const result = await triggerWebhook('appointment-booking', {
      action: 'book',
      ...params,
    });

    return {
      success: true,
      data: {
        booked: true,
        date: params.date,
        time: params.time,
        callerName: params.caller_name,
        confirmationId: result.confirmation_id ?? null,
        message: result.message ?? `Appointment booked for ${params.date} at ${params.time}.`,
      },
    };
  });
}
