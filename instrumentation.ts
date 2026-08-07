import { getServerEnv } from './lib/env';

const serverEnv = getServerEnv();

if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined');
}

export async function register() {
  await import('./sentry.server.config');
}


