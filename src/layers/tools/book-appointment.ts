import { triggerWebhook } from '../automation/n8n-client.js';
import type { ToolResult } from '../../types/index.js';

interface BookingParams {
  date: string;
  time: string;
  caller_name: string;
  phone_number: string;
  service_type?: string;
}

export async function bookAppointment(params: BookingParams): Promise<ToolResult> {
  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      success: false,
      data: {},
      error: `Booking failed: ${message}`,
    };
  }
}
