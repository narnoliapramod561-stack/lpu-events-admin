// supabase/functions/superadmin-operations/responses.ts
// Standard Operational Response Envelope & Header Management

import { OperationsErrorCode } from "./errors.ts";
import { OperationsRequestContext } from "./request-context.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Content-Type": "application/json",
};

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
      ...corsHeaders,
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
      ...corsHeaders,
      "x-request-id": ctx.requestId,
      "x-correlation-id": ctx.correlationId,
    },
  });
}
