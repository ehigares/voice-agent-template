import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  // Layer 1 — Telephony
  TELNYX_API_KEY: z.string().min(1, 'TELNYX_API_KEY is required'),
  TELNYX_PHONE_NUMBER: z.string().min(1, 'TELNYX_PHONE_NUMBER is required'),

  // Layer 2 — Orchestration
  VAPI_API_KEY: z.string().min(1, 'VAPI_API_KEY is required'),
  VAPI_WEBHOOK_SECRET: z.string().optional().default(''),

  // Layer 3 — Speech
  DEEPGRAM_API_KEY: z.string().min(1, 'DEEPGRAM_API_KEY is required'),
  CARTESIA_API_KEY: z.string().min(1, 'CARTESIA_API_KEY is required'),
  ELEVENLABS_API_KEY: z.string().optional().default(''),

  // Layer 4 — LLM
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),

  // Layer 5 — Automation
  N8N_BASE_URL: z.string().url().default('http://localhost:5678'),
  N8N_API_KEY: z.string().optional().default(''),

  // Layer 6 — Memory
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_KEY: z.string().min(1, 'SUPABASE_SERVICE_KEY is required'),
  PINECONE_API_KEY: z.string().optional().default(''),
  PINECONE_INDEX: z.string().default('voice-agent'),
  OPENAI_API_KEY: z.string().optional().default(''),
  MEM0_API_KEY: z.string().optional().default(''),

  // Layer 7 — Training
  AWS_ACCESS_KEY_ID: z.string().optional().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().optional().default(''),
  AWS_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('voice-agent-recordings'),
  ASSEMBLYAI_API_KEY: z.string().optional().default(''),

  // Server
  WEBHOOK_PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`\n❌ Invalid environment configuration:\n${errors}\n`);
    console.error('Copy .env.example to .env and fill in your API keys.\n');
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
