// lpu-events-admin/supabase/functions/_shared/telemetry.ts
// LPU Events — Supabase Edge Function Telemetry Foundation (Phase 1 / Stage 5)
// Complies with official PostHog $exception_list specification and ClickHouse structured logging.
// Backend Service Identity: distinct_id: 'backend-supabase-edge'
// Non-blocking asynchronous dispatch via EdgeRuntime.waitUntil(promise).

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

export interface EdgeStackFrame {
  platform: string;
  lang: string;
  function: string;
  filename: string;
  lineno?: number;
  colno?: number;
  in_app: boolean;
}

export interface EdgeTelemetryContext {
  function_name: string;
  correlation_id?: string;
  operation?: string;
  http_method?: string;
  status_code?: number;
  admin_user_id?: string;
  [key: string]: unknown;
}

export interface PostHogExceptionPayload {
  api_key: string;
  event: '$exception';
  distinct_id: 'backend-supabase-edge';
  timestamp: string;
  properties: {
    app: 'backend';
    environment: string;
    backend_surface: 'supabase_edge_function';
    function_name: string;
    correlation_id: string;
    operation?: string;
    http_method?: string;
    status_code?: number;
    admin_user_id?: string;
    $lib: string;
    $lib_version: string;
    $exception_fingerprint: string;
    $exception_level: 'error';
    $exception_list: Array<{
      type: string;
      value: string;
      mechanism: {
        handled: boolean;
        synthetic: boolean;
      };
      stacktrace: {
        type: 'raw';
        frames: EdgeStackFrame[];
      };
    }>;
    [key: string]: unknown;
  };
}

/**
 * Cross-runtime environment variable accessor.
 * Supports Deno (Supabase Edge runtime) and Node.js (test suites).
 */
export function getEnv(key: string): string | undefined {
  if (typeof Deno !== 'undefined' && typeof Deno?.env?.get === 'function') {
    return Deno.env.get(key);
  }
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[key];
  }
  return undefined;
}

/**
 * Parses raw stack trace strings into structured PostHog stack frames.
 * Handles Deno, V8, and Web stack trace formats.
 */
export function parseErrorStackToFrames(stack?: string): EdgeStackFrame[] {
  if (!stack) return [];
  const lines = stack.split('\n');
  const frames: EdgeStackFrame[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('at ')) continue;

    // Pattern 1: at functionName (filepath:line:col) or at async functionName (filepath:line:col)
    // Pattern 2: at filepath:line:col
    const match = trimmed.match(/^at (?:(.+?)\s+\((.+):(\d+):(\d+)\)|(.+):(\d+):(\d+))$/);
    if (match) {
      const fn = (match[1] || 'anonymous').replace(/^async\s+/, '');
      const file = match[2] || match[5] || 'unknown';
      const lineNum = parseInt(match[3] || match[6] || '0', 10);
      const colNum = parseInt(match[4] || match[7] || '0', 10);

      // Clean file path (strip file://, https://domain/, leading slashes, etc.)
      const cleanFile = file
        .replace(/^(?:file:\/\/\/?|https?:\/\/[^/]+\/)/i, '')
        .replace(/^\/+/, '');
      const isVendor =
        file.includes('node_modules') ||
        file.includes('deno.land') ||
        file.includes('esm.sh') ||
        file.includes('ext:');

      frames.push({
        platform: 'custom',
        lang: 'typescript',
        function: fn,
        filename: cleanFile,
        lineno: lineNum,
        colno: colNum,
        in_app: !isVendor,
      });
    }
  }

  return frames;
}

/**
 * Constructs the official PostHog $exception payload adhering to the $exception_list specification.
 * Ensures backend service identity and conditional admin caller ID tagging.
 */
export function buildEdgeExceptionPayload(
  apiKey: string,
  error: unknown,
  context: EdgeTelemetryContext
): PostHogExceptionPayload {
  const errObj = error instanceof Error ? error : new Error(String(error || 'Edge Function Unknown Error'));
  const stackFrames = parseErrorStackToFrames(errObj.stack);
  const errType = errObj.name || 'Error';
  const errVal = errObj.message || 'Unknown Edge Function Error';
  const correlationId = context.correlation_id || `req_edge_${crypto.randomUUID()}`;

  const properties: PostHogExceptionPayload['properties'] = {
    app: 'backend',
    environment: getEnv('DENO_ENV') || getEnv('ENVIRONMENT') || 'production',
    backend_surface: 'supabase_edge_function',
    function_name: context.function_name,
    correlation_id: correlationId,
    http_method: context.http_method || 'POST',
    status_code: context.status_code || 500,
    $lib: 'lpu-backend-telemetry',
    $lib_version: '1.0.0',
    $exception_fingerprint: `${errType}:${context.function_name || 'edge'}:${errVal.slice(0, 100)}`,
    $exception_level: 'error',
    $exception_list: [
      {
        type: errType,
        value: errVal,
        mechanism: {
          handled: true,
          synthetic: false,
        },
        stacktrace: {
          type: 'raw',
          frames:
            stackFrames.length > 0
              ? stackFrames
              : [
                  {
                    platform: 'custom',
                    lang: 'typescript',
                    function: context.function_name || 'edge-function',
                    filename: `supabase/functions/${context.function_name}/index.ts`,
                    in_app: true,
                  },
                ],
        },
      },
    ],
  };

  if (context.operation) {
    properties.operation = context.operation;
  }

  // Strict User Identification Rule:
  // Only attach admin_user_id if caller was verified & authenticated.
  // Never log unconditional or unauthenticated user IDs.
  if (
    context.admin_user_id &&
    typeof context.admin_user_id === 'string' &&
    context.admin_user_id !== 'unauthenticated' &&
    context.admin_user_id.trim() !== ''
  ) {
    properties.admin_user_id = context.admin_user_id.trim();
  }

  return {
    api_key: apiKey,
    event: '$exception',
    distinct_id: 'backend-supabase-edge',
    timestamp: new Date().toISOString(),
    properties,
  };
}

/**
 * Dispatches an exception to PostHog and writes a structured ClickHouse-compatible JSON line.
 * Uses EdgeRuntime.waitUntil(promise) to ensure non-blocking background flight.
 */
export function captureEdgeException(
  error: unknown,
  context: EdgeTelemetryContext
): void {
  const errObj = error instanceof Error ? error : new Error(String(error || 'Edge Function Unknown Error'));
  const correlationId = context.correlation_id || `req_edge_${crypto.randomUUID()}`;
  const errType = errObj.name || 'Error';
  const errVal = errObj.message || 'Unknown error';

  // 1. Structured ClickHouse Log Invariant
  // Supabase native logs capture standard console.error output into ClickHouse function_logs.
  // Emitting a structured JSON line guarantees correlation ID and error properties can be queried in Logs Explorer.
  const structuredLog: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level: 'error',
    type: 'edge_function_exception',
    function_name: context.function_name,
    correlation_id: correlationId,
    operation: context.operation || 'unknown',
    error_name: errType,
    error_message: errVal,
    status_code: context.status_code || 500,
  };

  if (
    context.admin_user_id &&
    typeof context.admin_user_id === 'string' &&
    context.admin_user_id !== 'unauthenticated' &&
    context.admin_user_id.trim() !== ''
  ) {
    structuredLog.admin_user_id = context.admin_user_id.trim();
  }

  console.error(JSON.stringify(structuredLog));

  // 2. PostHog Exception Ingestion
  const apiKey = getEnv('POSTHOG_API_KEY');
  const host = (getEnv('POSTHOG_HOST') || 'https://us.i.posthog.com').replace(/\/+$/, '');

  if (!apiKey) {
    // If no key configured, silent graceful fallback
    return;
  }

  const payload = buildEdgeExceptionPayload(apiKey, error, {
    ...context,
    correlation_id: correlationId,
  });

  const dispatchPromise = fetch(`${host}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(3000), // Hard 3s timeout
  }).catch(() => {
    // Telemetry failure is completely silent; never impacts response
  });

  // Utilize supported Supabase EdgeRuntime background execution
  const edgeRuntime = (globalThis as any).EdgeRuntime;
  if (edgeRuntime && typeof edgeRuntime.waitUntil === 'function') {
    edgeRuntime.waitUntil(dispatchPromise);
  } else {
    // Fallback for local testing / non-EdgeRuntime environments
    dispatchPromise.catch(() => {});
  }
}
