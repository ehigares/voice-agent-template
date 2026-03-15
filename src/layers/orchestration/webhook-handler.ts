import express, { type Request, type Response } from 'express';
import { config } from '../../config.js';
import { TOOL_NAMES } from '../tools/tool-definitions.js';
import { lookupCaller } from '../tools/lookup-caller.js';
import { searchKnowledge } from '../tools/search-knowledge.js';
import { checkAvailability } from '../tools/check-availability.js';
import { bookAppointment } from '../tools/book-appointment.js';
import { triggerWebhook } from '../automation/n8n-client.js';
import type { VapiServerMessage, VapiServerMessageResponse } from './vapi-types.js';
import type { ToolResult } from '../../types/index.js';

export const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main Vapi webhook endpoint
app.post('/webhook/vapi', async (req: Request, res: Response) => {
  try {
    const body = req.body as VapiServerMessage;
    const eventType = body.message?.type;

    console.log(`[webhook] Received event: ${eventType}`);

    switch (eventType) {
      case 'function-call': {
        const response = await handleFunctionCall(body);
        res.json(response);
        return;
      }

      case 'end-of-call-report': {
        await handleEndOfCall(body);
        res.json({ ok: true });
        return;
      }

      case 'status-update': {
        console.log(`[webhook] Call status: ${body.message?.status}`);
        res.json({ ok: true });
        return;
      }

      case 'assistant-request': {
        // Return the assistant config for dynamic assistant selection
        // This is a placeholder — implement based on your routing logic
        res.json({ ok: true });
        return;
      }

      default: {
        console.log(`[webhook] Unhandled event type: ${eventType}`);
        res.json({ ok: true });
        return;
      }
    }
  } catch (err) {
    console.error('[webhook] Error processing event:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function handleFunctionCall(
  body: VapiServerMessage
): Promise<VapiServerMessageResponse> {
  const functionCall = body.message?.functionCall;
  if (!functionCall) {
    return { results: [{ result: 'No function call found in message.' }] };
  }

  const { name, parameters } = functionCall;
  console.log(`[webhook] Function call: ${name}`, parameters);

  let result: ToolResult;

  switch (name) {
    case TOOL_NAMES.LOOKUP_CALLER:
      result = await lookupCaller(parameters.phone_number as string);
      break;

    case TOOL_NAMES.SEARCH_KNOWLEDGE:
      result = await searchKnowledge(parameters.query as string);
      break;

    case TOOL_NAMES.CHECK_AVAILABILITY:
      result = await checkAvailability(
        parameters.date as string,
        parameters.service_type as string | undefined
      );
      break;

    case TOOL_NAMES.BOOK_APPOINTMENT:
      result = await bookAppointment({
        date: parameters.date as string,
        time: parameters.time as string,
        caller_name: parameters.caller_name as string,
        phone_number: parameters.phone_number as string,
        service_type: parameters.service_type as string | undefined,
      });
      break;

    default:
      result = { success: false, data: {}, error: `Unknown tool: ${name}` };
  }

  return {
    results: [{ result: JSON.stringify(result) }],
  };
}

async function handleEndOfCall(body: VapiServerMessage): Promise<void> {
  const call = body.message?.call;
  if (!call) return;

  console.log(`[webhook] Call ended: ${call.id}`);

  // Trigger n8n call-ended workflow for post-call processing
  try {
    await triggerWebhook('call-ended', {
      call_id: call.id,
      phone_number: call.customer?.number ?? '',
      started_at: call.startedAt,
      ended_at: call.endedAt,
      ended_reason: body.message?.endedReason,
      recording_url: body.message?.artifact?.recording?.url,
      transcript: body.message?.artifact?.transcript,
    });
    console.log(`[webhook] Triggered call-ended workflow for ${call.id}`);
  } catch (err) {
    console.error(`[webhook] Failed to trigger call-ended workflow:`, err);
  }
}

export function startServer(): void {
  const port = config.WEBHOOK_PORT;
  app.listen(port, () => {
    console.log(`\n🎙️  Voice Agent webhook server running on port ${port}`);
    console.log(`   Health: http://localhost:${port}/health`);
    console.log(`   Webhook: http://localhost:${port}/webhook/vapi\n`);
  });
}
