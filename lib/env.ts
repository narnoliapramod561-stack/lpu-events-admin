import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('LPU Events Admin'),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_CLARITY_PROJECT_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: z.string().optional(),
  NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: z.string().optional(),
  NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: z.string().optional(),
  NEXT_PUBLIC_APP_VERSION: z.string().optional(),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export function getPublicEnv() {
  const emptyToUndefined = (v: string | undefined) => (v && v.trim().length > 0 ? v : undefined);
  return publicEnvSchema.parse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: emptyToUndefined(process.env.NEXT_PUBLIC_SENTRY_DSN),
    NEXT_PUBLIC_POSTHOG_KEY: emptyToUndefined(process.env.NEXT_PUBLIC_POSTHOG_KEY),
    NEXT_PUBLIC_POSTHOG_HOST: emptyToUndefined(process.env.NEXT_PUBLIC_POSTHOG_HOST),
    NEXT_PUBLIC_GA_MEASUREMENT_ID: emptyToUndefined(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
    NEXT_PUBLIC_CLARITY_PROJECT_ID: emptyToUndefined(process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID),
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: emptyToUndefined(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE),
    NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: emptyToUndefined(process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE),
    NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: emptyToUndefined(process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE),
    NEXT_PUBLIC_APP_VERSION: emptyToUndefined(process.env.NEXT_PUBLIC_APP_VERSION),
  });
}

export function getServerEnv() {
  const emptyToUndefined = (v: string | undefined) => (v && v.trim().length > 0 ? v : undefined);
  return serverEnvSchema.parse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: emptyToUndefined(process.env.NEXT_PUBLIC_SENTRY_DSN),
    NEXT_PUBLIC_POSTHOG_KEY: emptyToUndefined(process.env.NEXT_PUBLIC_POSTHOG_KEY),
    NEXT_PUBLIC_POSTHOG_HOST: emptyToUndefined(process.env.NEXT_PUBLIC_POSTHOG_HOST),
    NEXT_PUBLIC_GA_MEASUREMENT_ID: emptyToUndefined(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
    NEXT_PUBLIC_CLARITY_PROJECT_ID: emptyToUndefined(process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID),
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: emptyToUndefined(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE),
    NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: emptyToUndefined(process.env.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE),
    NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: emptyToUndefined(process.env.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE),
    NEXT_PUBLIC_APP_VERSION: emptyToUndefined(process.env.NEXT_PUBLIC_APP_VERSION),
    SUPABASE_SERVICE_ROLE_KEY: emptyToUndefined(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
