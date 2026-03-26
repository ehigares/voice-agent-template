// ============================================================
// custom-tool-template.ts — STARTER TEMPLATE FOR CLIENT TOOLS
// ============================================================
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

// TODO:CONFIGURE — Friendly fallback message the caller hears if this tool
// fails or times out. Keep it natural and non-alarming.
const FALLBACK_MSG =
  "I'm sorry, I wasn't able to complete that right now. Let me connect you with someone who can help.";

// TODO:CONFIGURE — Define the shape of your tool's input parameters.
// These must match the JSON schema in tool-definitions.ts.
interface CustomToolInput {
  // Example fields — replace with your actual parameters:
  // query: string;
  // caller_id: string;
  // date?: string;
}

/**
 * TODO:CONFIGURE — Rename this function to match your tool's purpose.
 *
 * This is the tool handler called by webhook-handler.ts when Vapi
 * invokes the tool during a call. It runs inside withTimeout(5000)
 * so it will be cut off at 5 seconds if the work takes too long.
 *
 * @param _input - Parameters from Vapi, typed to CustomToolInput
 * @returns ToolResult with success/failure and data for the LLM
 */
export async function customTool(_input: CustomToolInput): Promise<ToolResult> {
  return withTimeout(5000, FALLBACK_MSG, async () => {
    // TODO:CONFIGURE — Replace with your actual tool logic.
    //
    // Common patterns:
    //
    // 1. Query Supabase:
    //    const { createClient } = await import('@supabase/supabase-js');
    //    const { config } = await import('../../config.js');
    //    const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
    //    const { data, error } = await supabase.from('table').select('*').eq('id', input.id);
    //
    // 2. Call an external API:
    //    const response = await fetch('https://api.example.com/endpoint', {
    //      method: 'POST',
    //      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    //      body: JSON.stringify({ ... }),
    //    });
    //    if (!response.ok) throw new Error(`API error: ${response.status}`);
    //    const data = await response.json();
    //
    // 3. Trigger an n8n workflow:
    //    const { triggerWebhook } = await import('../automation/n8n-client.js');
    //    const result = await triggerWebhook('my-workflow', { key: 'value' });

    logger.info('custom-tool', 'Custom tool executed', { /* input */ });

    return {
      success: true,
      data: {
        message: 'TODO:CONFIGURE — replace with actual tool response data',
      },
    };
  });
}
