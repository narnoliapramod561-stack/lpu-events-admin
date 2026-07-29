import * as Sentry from 'https://esm.sh/@sentry/deno';

let initialized = false;

function readSampleRate(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
    return parsed;
  }
  return fallback;
}

export function initializeSentry() {
  if (initialized) return;

  const dsn = Deno.env.get('SENTRY_DSN');
  if (!dsn) return;

  Sentry.init({
    dsn,
    tracesSampleRate: readSampleRate(Deno.env.get('SENTRY_TRACES_SAMPLE_RATE') ?? undefined, 0.1),
    environment: Deno.env.get('SUPABASE_ENV') ?? 'production',
    release: Deno.env.get('SENTRY_RELEASE') ?? 'supabase-edge-functions@unknown',
  });

  initialized = true;
}

export function withSentry(
  functionName: string,
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  initializeSentry();

  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          app: 'supabase-edge-function',
          function: functionName,
          path: new URL(request.url).pathname,
        },
      });
      await Sentry.flush(2000);
      throw error;
    }
  };
}
