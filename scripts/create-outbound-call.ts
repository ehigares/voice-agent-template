/**
 * create-outbound-call.ts — Initiate an outbound call via Vapi.
 *
 * STUB — outbound calling is a future feature. This script wires up
 * the Vapi outbound call API so it's ready when needed.
 *
 * Usage:
 *   npm run create-outbound-call -- --phone "+15551234567" --assistant-id "asst_xxx"
 *
 * Flags:
 *   --phone         Phone number to call (E.164 format, required)
 *   --assistant-id  Vapi assistant ID to use for the call (required)
 */

import 'dotenv/config';

function parseArgs(args: string[]): { phone: string; assistantId: string } {
  let phone = '';
  let assistantId = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--phone' && args[i + 1]) {
      phone = args[++i];
    } else if (args[i] === '--assistant-id' && args[i + 1]) {
      assistantId = args[++i];
    }
  }

  if (!phone) {
    console.error('❌ --phone is required (E.164 format, e.g. +15551234567)');
    process.exit(1);
  }
  if (!assistantId) {
    console.error('❌ --assistant-id is required (Vapi assistant ID)');
    process.exit(1);
  }

  return { phone, assistantId };
}

async function main() {
  const { phone, assistantId } = parseArgs(process.argv.slice(2));
  const apiKey = process.env.VAPI_API_KEY;

  if (!apiKey) {
    console.error('❌ VAPI_API_KEY not set in .env');
    process.exit(1);
  }

  console.log(`\n📞 Creating outbound call...`);
  console.log(`   To: ${phone}`);
  console.log(`   Assistant: ${assistantId}\n`);

  try {
    const response = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistantId,
        customer: { number: phone },
        // phoneNumberId is required for outbound — set via Vapi dashboard
        // or pass as an additional flag when this feature is fully built out
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`❌ Vapi API error: HTTP ${response.status}`);
      console.error(`   ${body}`);
      process.exit(1);
    }

    const call = (await response.json()) as { id: string; status: string };
    console.log(`✅ Call created: ${call.id}`);
    console.log(`   Status: ${call.status}\n`);
  } catch (err) {
    console.error('❌ Failed to create call:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
