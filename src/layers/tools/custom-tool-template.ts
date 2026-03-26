// ============================================================
// custom-tool-template.ts — STARTER TEMPLATE FOR CLIENT TOOLS
// ============================================================
//
// This file uses TEMPLATE:CONFIGURE markers instead of the standard
// TODO-CONFIGURE markers used elsewhere in the codebase.
// TEMPLATE:CONFIGURE = instructional placeholders in this template file.
//   They guide you when copying this file to create a new tool.
//   They are intentionally excluded from the pre-deploy grep check.
// The standard markers in reference-agent.ts, transfer-to-human.ts, etc.
//   are the ones that must be resolved before deployment.
//
// Copy this file when a client needs a tool not in the default set.
// Rename it to match the tool's purpose (e.g. check-insurance.ts).
//
// Every custom tool MUST follow the Three Rules:
//   1. withTimeout — 5s max, never let a tool hang
//   2. Fallback message — caller always hears something on failure
//   3. Backchannel acknowledgment — handled in webhook-handler.ts
//      (add the tool name to BACKCHANNEL_MESSAGES there)
//
// After creating your tool:
//   1. Add the tool name to TOOL_NAMES in tool-definitions.ts
//   2. Add a VapiToolConfig entry in getToolDefinitions()
//   3. Add a case in webhook-handler.ts handleFunctionCall()
//   4. Add a backchannel message in BACKCHANNEL_MESSAGES
//
// ============================================================

import { logger } from '../../lib/logger.js';
import { withTimeout } from './tool-utils.js';
import type { ToolResult } from '../../types/index.js';

// TEMPLATE:CONFIGURE — Friendly fallback message the caller hears if this tool
// fails or times out. Keep it natural and non-alarming.
const FALLBACK_MSG =
  "I'm sorry, I wasn't able to complete that right now. Let me connect you with someone who can help.";

// TEMPLATE:CONFIGURE — Define the shape of your tool's input parameters.
// These must match the JSON schema you register in tool-definitions.ts.
// Use exact field names — Vapi passes them as-is from the LLM's function call.
interface LoyaltyPointsInput {
  phone_number: string;   // Caller's phone number, used to look up their account
  program_id: string;     // Which loyalty program to query (clients may run multiple)
}

// TEMPLATE:CONFIGURE — Shape of the external API's response body.
// Typing this separately lets TypeScript catch mismatches between what the
// API returns and what you hand back to the LLM.
interface LoyaltyApiResponse {
  points_balance: number;
  tier: string;
  member_since: string;
}

/**
 * TEMPLATE:CONFIGURE — Rename this function to match your tool's purpose.
 *
 * Example: checkLoyaltyPoints — looks up a caller's rewards balance
 * from an external loyalty API and returns it so the LLM can read the
 * result back to the caller naturally.
 *
 * This is the tool handler called by webhook-handler.ts when Vapi
 * invokes the tool during a call. It runs inside withTimeout(5000)
 * so it will be cut off at 5 seconds if the work takes too long.
 *
 * @param input - Parameters from Vapi, typed to LoyaltyPointsInput
 * @returns ToolResult with points_balance, tier, and a message for the LLM
 */
export async function checkLoyaltyPoints(input: LoyaltyPointsInput): Promise<ToolResult> {
  return withTimeout(5000, FALLBACK_MSG, async (signal) => {
    // TEMPLATE:CONFIGURE — Replace this URL with the client's actual API endpoint.
    // The URL, auth header, and body shape will vary per client.
    const apiUrl = 'https://api.example.com/v1/loyalty/lookup';

    // TEMPLATE:CONFIGURE — Replace with the client's real API key, loaded from config.ts.
    // Example: const { config } = await import('../../config.js');
    //          then use config.LOYALTY_API_KEY below.
    const apiKey = 'TEMPLATE:CONFIGURE';

    // Log before the network call so we can see the attempt even if it times out
    logger.info('check-loyalty-points', 'Looking up loyalty points', {
      phone: input.phone_number,
      programId: input.program_id,
    });

    // Make the external API call — fetch is globally available in Node 18+
    // Pass the AbortSignal so the request is cancelled if withTimeout fires
    const response = await fetch(apiUrl, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        // Bearer token auth is the most common pattern; swap for API-key header if needed
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        phone_number: input.phone_number,
        program_id: input.program_id,
      }),
    });

    // Non-2xx means the API rejected the request — throw so withTimeout catches it
    // and returns the fallback message to the caller instead of raw error data
    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('check-loyalty-points', 'Loyalty API returned error', {
        status: response.status,
        body: errorBody,
        phone: input.phone_number,
      });
      // Throwing here triggers the withTimeout catch block, which returns FALLBACK_MSG
      throw new Error(`Loyalty API error: ${response.status}`);
    }

    // Parse the JSON body — typed so we get compile-time checks on field access
    const result = await response.json() as LoyaltyApiResponse;

    logger.info('check-loyalty-points', 'Loyalty lookup succeeded', {
      phone: input.phone_number,
      tier: result.tier,
      points: result.points_balance,
    });

    // Return data the LLM can use to form a natural spoken response.
    // The "message" field is a pre-formatted suggestion — the LLM may rephrase it,
    // but having it here ensures the tool always provides a usable answer.
    return {
      success: true,
      data: {
        points_balance: result.points_balance,
        tier: result.tier,
        message: `You have ${result.points_balance} points and you're a ${result.tier} member.`,
      },
    };
  });
}
