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
import { processCallEnd } from '../training/pipeline.js';
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

// ---- Deep Health Check ----

const HEALTH_PROBE_TIMEOUT = 3000;

interface ServiceHealth {
  status: 'ok' | 'degraded' | 'down';
  latencyMs: number;
}

async function probeService(
  name: string,
  fn: () => Promise<void>
): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('probe timeout')), HEALTH_PROBE_TIMEOUT)
      ),
    ]);
    const latencyMs = Date.now() - start;
    return { status: latencyMs > 2000 ? 'degraded' : 'ok', latencyMs };
  } catch {
    return { status: 'down', latencyMs: Date.now() - start };
  }
}

async function probeSupabase(): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
  const { error } = await supabase.from('agent_configs').select('id').limit(1);
  if (error && !error.message.includes('does not exist')) {
    throw new Error(error.message);
  }
}

async function probePinecone(): Promise<void> {
  const response = await fetch('https://api.pinecone.io/indexes', {
    headers: { 'Api-Key': config.PINECONE_API_KEY },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

async function probeMem0(): Promise<void> {
  const response = await fetch('https://api.mem0.ai/v1/memories/', {
    method: 'GET',
    headers: { Authorization: `Token ${config.MEM0_API_KEY}` },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

async function probeN8n(): Promise<void> {
  const response = await fetch(`${config.N8N_BASE_URL}/api/v1/workflows`, {
    headers: config.N8N_API_KEY ? { 'X-N8N-API-KEY': config.N8N_API_KEY } : {},
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

// ---- Health Check Cache ----
// Cache results for 10 seconds to avoid hammering downstream services.
// 10s (not 30s) because Railway checks health rapidly during deploys —
// a stale "down" result could cause Railway to reject a good deployment.
const HEALTH_CACHE_TTL_MS = 10_000;
let healthCache: { result: Record<string, unknown>; timestamp: number } | null = null;

app.get('/health', async (_req: Request, res: Response) => {
  // Return cached result if fresh enough
  if (healthCache && Date.now() - healthCache.timestamp < HEALTH_CACHE_TTL_MS) {
    res.json(healthCache.result);
    return;
  }

  const services: Record<string, ServiceHealth | { status: 'disabled' }> = {};

  // Supabase is always required
  const probes: Promise<void>[] = [];

  probes.push(
    probeService('supabase', probeSupabase).then((r) => { services.supabase = r; })
  );

  if (config.ENABLE_PINECONE) {
    probes.push(
      probeService('pinecone', probePinecone).then((r) => { services.pinecone = r; })
    );
  } else {
    services.pinecone = { status: 'disabled' };
  }

  if (config.ENABLE_MEM0) {
    probes.push(
      probeService('mem0', probeMem0).then((r) => { services.mem0 = r; })
    );
  } else {
    services.mem0 = { status: 'disabled' };
  }

  // Only probe n8n if an API key is configured — without a key the probe
  // will always fail, producing false "down" alerts
  if (config.N8N_API_KEY) {
    probes.push(
      probeService('n8n', probeN8n).then((r) => { services.n8n = r; })
    );
  } else {
    services.n8n = { status: 'disabled' };
  }

  await Promise.all(probes);

  // Compute overall status from enabled services only
  const enabledServices = Object.values(services).filter(
    (s): s is ServiceHealth => s.status !== 'disabled'
  );
  const hasDown = enabledServices.some((s) => s.status === 'down');
  const hasDegraded = enabledServices.some((s) => s.status === 'degraded');

  let status: 'ok' | 'degraded' | 'down';
  if (hasDown) {
    status = 'down';
  } else if (hasDegraded) {
    status = 'degraded';
  } else {
    status = 'ok';
  }

  const result = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.0.0',
    activeCalls,
    maxConcurrentCalls: config.MAX_CONCURRENT_CALLS,
    services,
  };

  healthCache = { result, timestamp: Date.now() };
  res.json(result);
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

// ---- Backchannel Acknowledgment ----

const BACKCHANNEL_MESSAGES: Record<string, string> = {
  [TOOL_NAMES.LOOKUP_CALLER]: 'One moment while I pull up your information...',
  [TOOL_NAMES.SEARCH_KNOWLEDGE]: 'Let me check that for you...',
  [TOOL_NAMES.CHECK_AVAILABILITY]: 'Let me check the calendar...',
  [TOOL_NAMES.BOOK_APPOINTMENT]: 'Let me get that booked for you...',
  [TOOL_NAMES.TRANSFER_TO_HUMAN]: "I'll get someone on the line for you right away...",
};

async function sendBackchannel(callId: string, message: string): Promise<void> {
  if (!callId || !config.VAPI_API_KEY) return;

  try {
    await fetch(`https://api.vapi.ai/call/${callId}/control`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'say', message }),
    });
  } catch (err) {
    logger.warn('webhook', 'Backchannel failed (non-fatal)', {
      callId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

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

  // Send backchannel acknowledgment before async tool work
  const backchannelMsg = BACKCHANNEL_MESSAGES[name];
  if (backchannelMsg && callId) {
    await sendBackchannel(callId, backchannelMsg);
  }

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

// Called by n8n call-ended workflow — URL must match WEBHOOK_BASE_URL in .env
app.post('/pipeline/process', async (req: Request, res: Response) => {
  try {
    await processCallEnd(req.body);
    logger.info('pipeline-route', 'Pipeline processing complete', {
      callId: req.body?.call_id,
    });
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('pipeline-route', 'Pipeline processing failed', {
      callId: req.body?.call_id,
      error: message,
    });
    res.status(500).json({ error: message });
  }
});

export function startServer(): void {
  const port = config.WEBHOOK_PORT;
  app.listen(port, () => {
    logger.info('server', `Voice Agent webhook server running on port ${port}`);
    logger.info('server', `Health: http://localhost:${port}/health`);
    logger.info('server', `Webhook: http://localhost:${port}/webhook/vapi`);
  });
}
