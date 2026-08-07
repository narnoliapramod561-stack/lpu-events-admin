import { getPublicEnv } from './lib/env';

const publicEnv = getPublicEnv();

// Set mock environment variables for tests
process.env.NEXT_PUBLIC_APP_URL = publicEnv.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL = publicEnv.NEXT_PUBLIC_SUPABASE_URL || 'https://aknxfyzmzhkkuthpetcu.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';

// Minimal test setup: polyfill fetch and URL.createObjectURL
if (typeof global.fetch === 'undefined') {
  global.fetch = () => Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
}

if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:mock';
}

// noop for crypto.randomUUID in older node/jsdom combos
if (typeof global.crypto === 'undefined') {
  // Provide a minimal crypto shim for tests
  global.crypto = /** @type {any} */ ({ randomUUID: () => 'mock-uuid' });
}

// Ensure supabase client doesn't make real network calls during tests
if (typeof jest !== 'undefined') {
  jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    })),
  }));
}
