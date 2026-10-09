// supabase/functions/superadmin-operations/responses.ts
// Standard Operational Response Envelope & Header Management

import { OperationsErrorCode } from "./errors.ts";
import { OperationsRequestContext } from "./request-context.ts";

const ALLOWED_ORIGINS = new Set([
  "https://admin.lpuevents.live",
  "https://lpueventsadmin.live",
  "https://www.lpueventsadmin.live",
  "https://lpuevents.live",
  "https://www.lpuevents.live",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
]);

export function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (origin.endsWith(".lpueventsadmin.live") || origin.endsWith(".lpuevents.live")) return true;
  if (origin.endsWith(".pages.dev") || origin.endsWith(".workers.dev")) return true;
  if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) return true;
  return false;
}

export function resolveCorsHeaders(originOrReq?: string | Request): Record<string, string> {
  let origin = "";
  let requestedHeaders = "";

  if (originOrReq) {
    if (typeof originOrReq === "string") {
      origin = originOrReq;
    } else if (originOrReq instanceof Request || (originOrReq as any).headers) {
      origin = (originOrReq as Request).headers.get("origin") || "";
      requestedHeaders = (originOrReq as Request).headers.get("access-control-request-headers") || "";
    }
  }

  let allowedOrigin = "https://lpueventsadmin.live";
  if (origin && isAllowedOrigin(origin)) {
    allowedOrigin = origin;
  }

  const baseHeaders = "authorization, x-client-info, apikey, content-type, x-correlation-id, sentry-trace, baggage, prefer, range, x-requested-with, accept";
  const allowHeaders = requestedHeaders
    ? `${baseHeaders}, ${requestedHeaders}`
    : baseHeaders;

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
    "Access-Control-Expose-Headers": "x-request-id, x-correlation-id, content-type",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Vary": "Origin, Access-Control-Request-Headers",
    "Content-Type": "application/json",
  };
}

export const corsHeaders = resolveCorsHeaders();

export interface OperationsMeta {
  generated_at: string;
  duration_ms: number;
  source: 'operations_gateway';
  environment: string;
}

export interface OperationsSuccessEnvelope<T> {
  success: true;
  request_id: string;
  correlation_id: string;
  data: T;
  meta: OperationsMeta;
}

export interface OperationsErrorEnvelope {
  success: false;
  request_id: string;
  correlation_id: string;
  error: {
    code: OperationsErrorCode;
    message: string;
  };
  meta: OperationsMeta;
}

/**
 * Resolves the operational execution environment dynamically from configuration.
 * Never blindly defaults to "production" to prevent staging/dev environments
 * from falsely reporting themselves as production.
 */
export function resolveEnvironment(): string {
  const explicitEnv = Deno.env.get("ENVIRONMENT") || Deno.env.get("DENO_ENV") || Deno.env.get("APP_ENV");
  if (explicitEnv && explicitEnv.trim()) {
    return explicitEnv.trim().toLowerCase();
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  if (supabaseUrl.includes("localhost") || supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes(":54321")) {
    return "development";
  }

  return "unspecified";
}

export function buildSuccessResponse<T>(
  data: T,
  ctx: OperationsRequestContext,
  status = 200
): Response {
  const durationMs = Math.round((performance.now() - ctx.startTimeMs) * 100) / 100;
  const envName = resolveEnvironment();

  const payload: OperationsSuccessEnvelope<T> = {
    success: true,
    request_id: ctx.requestId,
    correlation_id: ctx.correlationId,
    data,
    meta: {
      generated_at: new Date().toISOString(),
      duration_ms: durationMs,
      source: "operations_gateway",
      environment: envName,
    },
  };

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...resolveCorsHeaders(ctx.origin),
      "x-request-id": ctx.requestId,
      "x-correlation-id": ctx.correlationId,
    },
  });
}

export function buildErrorResponse(
  error: { code: OperationsErrorCode; message: string; status: number },
  ctx: OperationsRequestContext
): Response {
  const durationMs = Math.round((performance.now() - ctx.startTimeMs) * 100) / 100;
  const envName = resolveEnvironment();

  const payload: OperationsErrorEnvelope = {
    success: false,
    request_id: ctx.requestId,
    correlation_id: ctx.correlationId,
    error: {
      code: error.code,
      message: error.message,
    },
    meta: {
      generated_at: new Date().toISOString(),
      duration_ms: durationMs,
      source: "operations_gateway",
      environment: envName,
    },
  };

  return new Response(JSON.stringify(payload), {
    status: error.status,
    headers: {
      ...resolveCorsHeaders(ctx.origin),
      "x-request-id": ctx.requestId,
      "x-correlation-id": ctx.correlationId,
    },
  });
}
