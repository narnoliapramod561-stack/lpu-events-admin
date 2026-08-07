import { getPublicEnv } from './lib/env';
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

const publicEnv = getPublicEnv();

if (!publicEnv.NEXT_PUBLIC_APP_URL) {
  throw new Error('NEXT_PUBLIC_APP_URL is not defined');
}
if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
}
if (!publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined');
}

export default defineCloudflareConfig();
