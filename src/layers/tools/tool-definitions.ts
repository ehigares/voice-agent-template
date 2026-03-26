import type { VapiToolConfig } from '../orchestration/vapi-types.js';

export const TOOL_NAMES = {
  LOOKUP_CALLER: 'lookup-caller',
  SEARCH_KNOWLEDGE: 'search-knowledge',
  CHECK_AVAILABILITY: 'check-availability',
  BOOK_APPOINTMENT: 'book-appointment',
  TRANSFER_TO_HUMAN: 'transfer-to-human',
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

export function getToolDefinitions(webhookUrl: string): VapiToolConfig[] {
  return [
    {
      type: 'function',
      function: {
        name: TOOL_NAMES.LOOKUP_CALLER,
        description:
          'Look up caller information and history. Use this at the start of every call to check if the caller is known.',
        parameters: {
          type: 'object',
          properties: {
            phone_number: {
              type: 'string',
              description: 'The caller phone number in E.164 format',
            },
          },
          required: ['phone_number'],
        },
      },
      server: { url: webhookUrl },
    },
    {
      type: 'function',
      function: {
        name: TOOL_NAMES.SEARCH_KNOWLEDGE,
        description:
          'Search the knowledge base for business-specific information like FAQs, policies, pricing, services, and procedures.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query describing what information is needed',
            },
          },
          required: ['query'],
        },
      },
      server: { url: webhookUrl },
    },
    {
      type: 'function',
      function: {
        name: TOOL_NAMES.CHECK_AVAILABILITY,
        description:
          'Check available appointment slots for a given date and service type.',
        parameters: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'The date to check availability for (YYYY-MM-DD)',
            },
            service_type: {
              type: 'string',
              description: 'The type of service or appointment being requested',
            },
          },
          required: ['date'],
        },
      },
      server: { url: webhookUrl },
    },
    {
      type: 'function',
      function: {
        name: TOOL_NAMES.BOOK_APPOINTMENT,
        description:
          'Book an appointment after the caller has confirmed the date, time, and service.',
        parameters: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'Appointment date (YYYY-MM-DD)',
            },
            time: {
              type: 'string',
              description: 'Appointment time (HH:MM in 24h format)',
            },
            caller_name: {
              type: 'string',
              description: 'Name of the person booking',
            },
            phone_number: {
              type: 'string',
              description: 'Contact phone number',
            },
            service_type: {
              type: 'string',
              description: 'Type of service or appointment',
            },
          },
          required: ['date', 'time', 'caller_name', 'phone_number'],
        },
      },
      server: { url: webhookUrl },
    },
    {
      type: 'function',
      function: {
        name: TOOL_NAMES.TRANSFER_TO_HUMAN,
        description:
          'Transfer the call to a human team member. Use when the caller requests a human, is upset, or has a request beyond your capabilities.',
        parameters: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              description: 'Brief reason for the transfer (e.g. "caller requested human", "complex billing issue")',
            },
          },
          required: [],
        },
      },
      server: { url: webhookUrl },
    },
  ];
}
