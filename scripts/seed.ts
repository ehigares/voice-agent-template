import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GenericAgent } from '../src/agents/generic.js';
import { DentalReceptionist } from '../src/agents/examples/dental-receptionist.js';
import { RealEstateQualifier } from '../src/agents/examples/real-estate-qualifier.js';
import { CustomerSupport } from '../src/agents/examples/customer-support.js';

const WEBHOOK_URL = process.env.WEBHOOK_URL ?? 'https://your-server.com/webhook/vapi';

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const agents = [
    { builder: new GenericAgent({ webhookUrl: WEBHOOK_URL }), name: 'Generic Agent' },
    { builder: new DentalReceptionist(WEBHOOK_URL), name: 'Dental Receptionist' },
    { builder: new RealEstateQualifier(WEBHOOK_URL), name: 'Real Estate Lead Qualifier' },
    { builder: new CustomerSupport(WEBHOOK_URL), name: 'Customer Support' },
  ];

  console.log('\n🎙️  Seeding agent configs...\n');

  for (const { builder, name } of agents) {
    const config = builder.build();

    const record = {
      name: config.name,
      industry: (config.metadata?.industry as string) ?? 'general',
      description: (config.metadata?.description as string) ?? '',
      vapi_config: config,
      system_prompt: config.model.systemPrompt ?? '',
      model: config.model.model,
      voice_provider: config.voice.provider === '11labs' ? 'elevenlabs' : config.voice.provider,
      voice_id: config.voice.voiceId,
      tools: config.tools ?? [],
      is_active: false,
    };

    const { error } = await supabase
      .from('agent_configs')
      .upsert(record, { onConflict: 'name' });

    if (error) {
      console.error(`  ❌ ${name}: ${error.message}`);
    } else {
      console.log(`  ✅ ${name}`);
    }
  }

  // Optional: Deploy to Vapi if --deploy flag is passed
  if (process.argv.includes('--deploy')) {
    const vapiKey = process.env.VAPI_API_KEY;
    if (!vapiKey) {
      console.error('\n❌ VAPI_API_KEY required for --deploy');
      process.exit(1);
    }

    console.log('\n🚀 Deploying to Vapi...\n');

    for (const { builder, name } of agents) {
      const config = builder.build();
      try {
        const response = await fetch('https://api.vapi.ai/assistant', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${vapiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(config),
        });

        if (!response.ok) {
          const text = await response.text();
          console.error(`  ❌ ${name}: ${response.status} — ${text}`);
        } else {
          const data = (await response.json()) as { id: string };
          console.log(`  ✅ ${name} → Vapi ID: ${data.id}`);

          // Update Supabase with Vapi ID
          await supabase
            .from('agent_configs')
            .update({ vapi_agent_id: data.id, is_active: true })
            .eq('name', config.name);
        }
      } catch (err) {
        console.error(`  ❌ ${name}: ${err}`);
      }
    }
  }

  console.log('\nDone! Run with --deploy to push agents to Vapi.\n');
}

main().catch(console.error);
