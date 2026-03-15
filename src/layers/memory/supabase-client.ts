import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config.js';

export const supabase: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_KEY
);
