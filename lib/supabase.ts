import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getPublicEnv, getServerEnv } from './env';

const publicEnv = getPublicEnv();
const serverEnv = getServerEnv();

export const supabaseAdmin: SupabaseClient = createClient(
  publicEnv.NEXT_PUBLIC_SUPABASE_URL,
  serverEnv.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export const supabaseBrowser: SupabaseClient = createClient(
  publicEnv.NEXT_PUBLIC_SUPABASE_URL,
  publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  }
);
