import { supabase } from './supabase-client.js';
import type { AgentConfig, Caller, Call, Transcript, TrainingData } from '../../types/index.js';

// ---- Agent Configs ----

export async function getAgentConfig(name: string): Promise<AgentConfig | null> {
  const { data, error } = await supabase
    .from('agent_configs')
    .select('*')
    .eq('name', name)
    .single();
  if (error) return null;
  return data as AgentConfig;
}

export async function upsertAgentConfig(
  agent: Omit<AgentConfig, 'id' | 'created_at' | 'updated_at'>
): Promise<AgentConfig> {
  const { data, error } = await supabase
    .from('agent_configs')
    .upsert(agent, { onConflict: 'name' })
    .select()
    .single();
  if (error) throw new Error(`Failed to upsert agent config: ${error.message}`);
  return data as AgentConfig;
}

export async function listActiveAgents(): Promise<AgentConfig[]> {
  const { data, error } = await supabase
    .from('agent_configs')
    .select('*')
    .eq('is_active', true);
  if (error) throw new Error(`Failed to list agents: ${error.message}`);
  return (data ?? []) as AgentConfig[];
}

// ---- Callers ----

export async function getCaller(phoneNumber: string): Promise<Caller | null> {
  const { data, error } = await supabase
    .from('callers')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single();
  if (error) return null;
  return data as Caller;
}

export async function upsertCaller(
  phoneNumber: string,
  updates: Partial<Omit<Caller, 'id' | 'created_at'>>
): Promise<Caller> {
  const { data, error } = await supabase
    .from('callers')
    .upsert(
      { phone_number: phoneNumber, ...updates },
      { onConflict: 'phone_number' }
    )
    .select()
    .single();
  if (error) throw new Error(`Failed to upsert caller: ${error.message}`);
  return data as Caller;
}

// ---- Calls ----

export async function insertCall(
  call: Omit<Call, 'id' | 'created_at'>
): Promise<Call> {
  const { data, error } = await supabase
    .from('calls')
    .insert(call)
    .select()
    .single();
  if (error) throw new Error(`Failed to insert call: ${error.message}`);
  return data as Call;
}

export async function updateCall(
  id: string,
  updates: Partial<Omit<Call, 'id' | 'created_at'>>
): Promise<Call> {
  const { data, error } = await supabase
    .from('calls')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update call: ${error.message}`);
  return data as Call;
}

export async function getCallsByAgent(agentId: string): Promise<Call[]> {
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to get calls: ${error.message}`);
  return (data ?? []) as Call[];
}

// ---- Transcripts ----

export async function insertTranscript(
  transcript: Omit<Transcript, 'id' | 'created_at'>
): Promise<Transcript> {
  const { data, error } = await supabase
    .from('transcripts')
    .insert(transcript)
    .select()
    .single();
  if (error) throw new Error(`Failed to insert transcript: ${error.message}`);
  return data as Transcript;
}

export async function getTranscriptsByCall(callId: string): Promise<Transcript[]> {
  const { data, error } = await supabase
    .from('transcripts')
    .select('*')
    .eq('call_id', callId)
    .order('start_ms', { ascending: true });
  if (error) throw new Error(`Failed to get transcripts: ${error.message}`);
  return (data ?? []) as Transcript[];
}

// ---- Training Data ----

export async function insertTrainingData(
  training: Omit<TrainingData, 'id' | 'created_at'>
): Promise<TrainingData> {
  const { data, error } = await supabase
    .from('training_data')
    .insert(training)
    .select()
    .single();
  if (error) throw new Error(`Failed to insert training data: ${error.message}`);
  return data as TrainingData;
}
