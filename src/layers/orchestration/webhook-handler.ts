import crypto from 'node:crypto';
import express, { type Request, type Response } from 'express';
import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';
import { TOOL_NAMES } from '../tools/tool-definitions.js';
import { lookupCaller } from '../tools/lookup-caller.js';
import { searchKnowledge } from '../tools/search-knowledge.js';
import { checkAvailability } from '../tools/check-availability.js';
import { bookAppointment } from '../tools/book-appointment.js';
import { transferToHuman } from '../tools/transfer-to-human.js';
import { triggerWebhook } from '../automation/n8n-client.js';
import type { VapiServerMessage, VapiServerMessageResponse } from './vapi-types.js';
import type { ToolResult } from '../../types/index.js';

export const app = express();

// Parse raw body for HMAC verification, then JSON
app.use(
  express.json({
    verify: (req: Request, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);

// ---- HMAC-SHA256 Webhook Signature Verification ----

function verifyHmac(req: Request): boolean {
  const secret = config.VAPI_WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured — skip verification in development only
    if (config.NODE_ENV === 'production') {
      logger.error('webhook', 'VAPI_WEBHOOK_SECRET is not set in production — rejecting all webhooks');
      return false;
    }
    return true;
  }

  const signature = req.headers['x-vapi-signature'] as string | undefined;
  if (!signature) return false;

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
}

// ---- Concurrency Cap ----

let activeCalls = 0;

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.0.0',
    activeCalls,
    maxConcurrentCalls: config.MAX_CONCURRENT_CALLS,
  });
});

// Main Vapi webhook endpoint
app.post('/webhook/vapi', async (req: Request, res: Response) => {
  // HMAC verification
  if (!verifyHmac(req)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  // Concurrency cap
  if (activeCalls >= config.MAX_CONCURRENT_CALLS) {
    logger.warn('webhook', 'Concurrency limit reached', {
      activeCalls,
      max: config.MAX_CONCURRENT_CALLS,
    });
    res.set('Retry-After', '5');
    res.status(429).json({ error: 'Too many concurrent calls' });
    return;
  }

  activeCalls++;
  try {
    const body = req.body as VapiServerMessage;
    const eventType = body.message?.type;

    logger.info('webhook', `Received event: ${eventType}`);

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
        logger.info('webhook', `Call status: ${body.message?.status}`);
        res.json({ ok: true });
        return;
      }

      case 'assistant-request': {
        res.json({ ok: true });
        return;
      }

      default: {
        logger.info('webhook', `Unhandled event type: ${eventType}`);
        res.json({ ok: true });
        return;
      }
    }
  } catch (err) {
    logger.error('webhook', 'Error processing event', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    activeCalls--;
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
  const callId = body.message?.call?.id;
  logger.info('webhook', `Function call: ${name}`, { callId, parameters });

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

    case TOOL_NAMES.TRANSFER_TO_HUMAN:
      result = await transferToHuman(
        callId ?? '',
        parameters.reason as string | undefined
      );
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

  logger.info('webhook', `Call ended: ${call.id}`, { callId: call.id });

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
    logger.info('webhook', `Triggered call-ended workflow`, { callId: call.id });
  } catch (err) {
    logger.error('webhook', 'Failed to trigger call-ended workflow', {
      callId: call.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function startServer(): void {
  const port = config.WEBHOOK_PORT;
  app.listen(port, () => {
    logger.info('server', `Voice Agent webhook server running on port ${port}`);
    logger.info('server', `Health: http://localhost:${port}/health`);
    logger.info('server', `Webhook: http://localhost:${port}/webhook/vapi`);
  });
}
