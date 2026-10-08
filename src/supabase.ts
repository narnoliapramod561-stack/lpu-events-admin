import { LpuEventsClient } from '@lpu-events/shared';

const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (isProduction) {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
    throw new Error(
      'FATAL CONFIGURATION ERROR: Production Supabase configuration (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) is missing or configured with localhost. Refusing to start in insecure/misconfigured state.'
    );
  }
} else {
  // Development fallbacks only
  const DEFAULT_DEV_URL = 'http://localhost:54321';
  const DEFAULT_DEV_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
  supabaseUrl = supabaseUrl || DEFAULT_DEV_URL;
  supabaseAnonKey = supabaseAnonKey || DEFAULT_DEV_KEY;
}

export const lpuClient = new LpuEventsClient(supabaseUrl, supabaseAnonKey);
export const supabase = lpuClient.supabase;
