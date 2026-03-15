import 'dotenv/config';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Minimal config validation (doesn't exit on failure — reports instead)
const configSchema = z.object({
  TELNYX_API_KEY: z.string().min(1).optional(),
  TELNYX_PHONE_NUMBER: z.string().min(1).optional(),
  VAPI_API_KEY: z.string().min(1).optional(),
  DEEPGRAM_API_KEY: z.string().min(1).optional(),
  CARTESIA_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_KEY: z.string().min(1).optional(),
  PINECONE_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  MEM0_API_KEY: z.string().min(1).optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  ASSEMBLYAI_API_KEY: z.string().min(1).optional(),
  N8N_BASE_URL: z.string().url().optional(),
  N8N_API_KEY: z.string().min(1).optional(),
});

interface StepResult {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  message: string;
}

const results: StepResult[] = [];

function log(icon: string, msg: string) {
  console.log(`  ${icon}  ${msg}`);
}

async function step(name: string, fn: () => Promise<void>, required = true) {
  try {
    await fn();
    results.push({ name, status: 'ok', message: 'Connected' });
    log('✅', name);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (required) {
      results.push({ name, status: 'fail', message });
      log('❌', `${name}: ${message}`);
    } else {
      results.push({ name, status: 'warn', message });
      log('⚠️', `${name}: ${message} (optional)`);
    }
  }
}

async function main() {
  console.log('\n🎙️  Voice Agent Template — Setup\n');

  // Step 1: Validate .env
  console.log('📋 Checking environment variables...');
  const envResult = configSchema.safeParse(process.env);
  const envVars = envResult.success ? envResult.data : {};

  const required = ['VAPI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'ANTHROPIC_API_KEY', 'DEEPGRAM_API_KEY', 'CARTESIA_API_KEY'];
  const optional = ['TELNYX_API_KEY', 'PINECONE_API_KEY', 'OPENAI_API_KEY', 'MEM0_API_KEY', 'AWS_ACCESS_KEY_ID', 'ASSEMBLYAI_API_KEY', 'N8N_API_KEY', 'ELEVENLABS_API_KEY'];

  for (const key of required) {
    const val = (envVars as Record<string, string | undefined>)[key];
    if (val) {
      log('✅', `${key} configured`);
    } else {
      log('❌', `${key} missing (required)`);
    }
  }
  for (const key of optional) {
    const val = process.env[key];
    if (val) {
      log('✅', `${key} configured`);
    } else {
      log('⚠️', `${key} not set (optional)`);
    }
  }

  // Step 2: Test Supabase connection
  console.log('\n🗄️  Testing connections...');
  await step('Supabase', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_KEY not set');
    const supabase = createClient(url, key);
    const { error } = await supabase.from('agent_configs').select('id').limit(1);
    if (error && !error.message.includes('does not exist')) {
      throw new Error(error.message);
    }
  });

  // Step 3: Test Vapi connection
  await step('Vapi', async () => {
    const key = process.env.VAPI_API_KEY;
    if (!key) throw new Error('VAPI_API_KEY not set');
    const response = await fetch('https://api.vapi.ai/assistant', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  });

  // Step 4: Test Telnyx connection
  await step('Telnyx', async () => {
    const key = process.env.TELNYX_API_KEY;
    if (!key) throw new Error('TELNYX_API_KEY not set');
    const response = await fetch('https://api.telnyx.com/v2/phone_numbers', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }, false);

  // Step 5: Test Pinecone
  await step('Pinecone', async () => {
    const key = process.env.PINECONE_API_KEY;
    if (!key) throw new Error('PINECONE_API_KEY not set');
    const response = await fetch('https://api.pinecone.io/indexes', {
      headers: { 'Api-Key': key },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  }, false);

  // Step 6: Run migrations
  console.log('\n🗃️  Running database migrations...');
  const migrationsDir = path.join(ROOT, 'supabase', 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (url && key) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(url, key);
      for (const file of files) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        try {
          const { error } = await supabase.rpc('exec_sql', { sql_string: sql });
          if (error) {
            // Try direct execution for environments that support it
            log('⚠️', `Migration ${file}: RPC not available — run manually`);
          } else {
            log('✅', `Migration ${file}`);
          }
        } catch {
          log('⚠️', `Migration ${file}: Run manually via Supabase SQL editor`);
        }
      }
    } else {
      log('⚠️', 'Skipping migrations — Supabase not configured');
    }
  }

  // Step 7: Deploy n8n workflows
  console.log('\n🔄 Deploying n8n workflows...');
  const workflowsDir = path.join(ROOT, 'src', 'layers', 'automation', 'workflows');
  if (fs.existsSync(workflowsDir) && process.env.N8N_BASE_URL && process.env.N8N_API_KEY) {
    const files = fs.readdirSync(workflowsDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      await step(`Deploy ${file}`, async () => {
        const workflow = JSON.parse(fs.readFileSync(path.join(workflowsDir, file), 'utf-8'));
        const response = await fetch(`${process.env.N8N_BASE_URL}/api/v1/workflows`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-N8N-API-KEY': process.env.N8N_API_KEY!,
          },
          body: JSON.stringify(workflow),
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text}`);
        }
      }, false);
    }
  } else {
    log('⚠️', 'Skipping n8n deployment — N8N_BASE_URL or N8N_API_KEY not set');
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Setup Summary\n');
  const ok = results.filter((r) => r.status === 'ok').length;
  const warn = results.filter((r) => r.status === 'warn').length;
  const fail = results.filter((r) => r.status === 'fail').length;
  console.log(`  ✅ ${ok} passed  ⚠️ ${warn} warnings  ❌ ${fail} failed\n`);

  if (fail > 0) {
    console.log('Fix the failed items above and re-run: npm run setup\n');
  } else {
    console.log('Setup complete! Run: npm run dev\n');
  }
}

main().catch(console.error);
