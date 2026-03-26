import { config } from '../../config.js';
import { logger } from '../../lib/logger.js';
import { withTimeout } from './tool-utils.js';
import type { ToolResult } from '../../types/index.js';

const FALLBACK_MSG = "I'm sorry, I wasn't able to transfer you right now. Please call back and ask to speak with a person directly.";

/**
 * Transfers the call to a human operator via the Vapi transfer API.
 * This is a default tool on every agent — callers must always have
 * an escape path to a human.
 */
export async function transferToHuman(
  callId: string,
  reason?: string
): Promise<ToolResult> {
  return withTimeout(5000, FALLBACK_MSG, async (signal) => {
    if (!config.VAPI_API_KEY) {
      return {
        success: false,
        data: { message: FALLBACK_MSG },
        error: 'VAPI_API_KEY not configured',
      };
    }

    logger.info('transfer-to-human', 'Initiating transfer', { callId, reason });

    // Vapi call control: send a "transfer" action
    const response = await fetch(`https://api.vapi.ai/call/${callId}/control`, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${config.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'transfer',
        destination: {
          type: 'number',
          // TODO:CONFIGURE — The phone number to transfer to.
          // Set this per-client in the client agent file or via env var.
          number: config.TRANSFER_PHONE_NUMBER,
          message: reason
            ? `Transferring caller. Reason: ${reason}`
            : 'Transferring caller to a team member.',
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error('transfer-to-human', 'Vapi transfer failed', {
        callId,
        status: response.status,
        body: text,
      });
      return {
        success: false,
        data: { message: FALLBACK_MSG },
        error: `Transfer failed: ${response.status}`,
      };
    }

    logger.info('transfer-to-human', 'Transfer initiated', { callId });
    return {
      success: true,
      data: {
        transferred: true,
        message: "I'm transferring you to a team member now. Please hold.",
      },
    };
  });
}
