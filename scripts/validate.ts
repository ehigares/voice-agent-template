/**
 * validate.ts — Lightweight connection check for all services.
 *
 * Faster than setup.ts — skips migrations and n8n deployment.
 * Run after every deployment to confirm all services are reachable:
 *   npm run validate
 *
 * Exit code 0 = all required services ok
 * Exit code 1 = one or more required services unreachable
 */

import 'dotenv/config';

interface CheckResult {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  latencyMs: number;
  message: string;
}

const results: CheckResult[] = [];

const TIMEOUT = 5000;

async function check(
  name: string,
  fn: () => Promise<void>,
  required = true
): Promise<void> {
  const start = Date.now();
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), TIMEOUT)
      ),
    ]);
    const latencyMs = Date.now() - start;
    results.push({ name, status: 'ok', latencyMs, message: 'Connected' });
    console.log(`  ✅  ${name} (${latencyMs}ms)`);
  } catch (err) {
    const latencyMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    if (required) {
      results.push({ name, status: 'fail', latencyMs, message });
      console.log(`  ❌  ${name}: ${message}`);
    } else {
      results.push({ name, status: 'warn', latencyMs, message });
      console.log(`  ⚠️  ${name}: ${message} (optional)`);
    }
  }
}

async function main() {
  console.log('\n🔍 Voice Agent Template — Validate Connections\n');

  // Supabase (required)
  await check('Supabase', async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_KEY not set');
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(url, key);
    const { error } = await supabase.from('agent_configs').select('id').limit(1);
    if (error && !error.message.includes('does not exist')) {
      throw new Error(error.message);
    }
  });

  // Vapi (required)
  await check('Vapi', async () => {
    const key = process.env.VAPI_API_KEY;
    if (!key) throw new Error('VAPI_API_KEY not set');
    const response = await fetch('https://api.vapi.ai/assistant', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  });

  // Telnyx (optional)
  await check('Telnyx', async () => {
    const key = process.env.TELNYX_API_KEY;
    if (!key) throw new Error('TELNYX_API_KEY not set');
    const response = await fetch('https://api.telnyx.com/v2/phone_numbers', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }, false);

  // Pinecone (optional — depends on ENABLE_PINECONE)
  const pineconeEnabled = process.env.ENABLE_PINECONE !== 'false';
  if (pineconeEnabled) {
    await check('Pinecone', async () => {
      const key = process.env.PINECONE_API_KEY;
      if (!key) throw new Error('PINECONE_API_KEY not set');
      const response = await fetch('https://api.pinecone.io/indexes', {
        headers: { 'Api-Key': key },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }, false);
  } else {
    console.log('  ⏭️  Pinecone (disabled via ENABLE_PINECONE=false)');
  }

  // Mem0 (optional — depends on ENABLE_MEM0)
  const mem0Enabled = process.env.ENABLE_MEM0 !== 'false';
  if (mem0Enabled) {
    await check('Mem0', async () => {
      const key = process.env.MEM0_API_KEY;
      if (!key) throw new Error('MEM0_API_KEY not set');
      const response = await fetch('https://api.mem0.ai/v1/memories/', {
        method: 'GET',
        headers: { Authorization: `Token ${key}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }, false);
  } else {
    console.log('  ⏭️  Mem0 (disabled via ENABLE_MEM0=false)');
  }

  // n8n (optional)
  await check('n8n', async () => {
    const baseUrl = process.env.N8N_BASE_URL;
    const apiKey = process.env.N8N_API_KEY;
    if (!baseUrl || !apiKey) throw new Error('N8N_BASE_URL or N8N_API_KEY not set');
    const response = await fetch(`${baseUrl}/api/v1/workflows`, {
      headers: { 'X-N8N-API-KEY': apiKey },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }, false);

  // Summary
  console.log('\n' + '='.repeat(50));
  const ok = results.filter((r) => r.status === 'ok').length;
  const warn = results.filter((r) => r.status === 'warn').length;
  const fail = results.filter((r) => r.status === 'fail').length;
  console.log(`\n  ✅ ${ok} passed  ⚠️ ${warn} warnings  ❌ ${fail} failed\n`);

  if (fail > 0) {
    console.log('Required services are unreachable. Fix the issues above.\n');
    process.exit(1);
  } else {
    console.log('All required services are reachable.\n');
  }
}

main().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});
