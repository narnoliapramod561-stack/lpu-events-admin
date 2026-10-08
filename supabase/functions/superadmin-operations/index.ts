// supabase/functions/superadmin-operations/index.ts
// LPU Events — Super Admin Operations Control Plane Gateway (Phase 2 Foundation)
// Single controlled server-side entrypoint for operational diagnostics & registry queries.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import { createRequestContext, logOperationsEvent } from "./request-context.ts";
import { verifySuperAdmin } from "./auth.ts";
import { executeOperation } from "./operations.ts";
import { corsHeaders, buildSuccessResponse, buildErrorResponse } from "./responses.ts";
import { normalizeError, OperationsError } from "./errors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req: Request) => {
  // 1. CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. Request context & correlation ID generation
  const ctx = createRequestContext(req);

  try {
    // 3. Verify server environment configuration
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new OperationsError(
        "INTERNAL_ERROR",
        "Operations gateway is misconfigured: missing server credentials.",
        500
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 4. Authenticate session & enforce Super Admin platform authorization
    const superAdmin = await verifySuperAdmin(req, supabaseAdmin);
    ctx.adminUserId = superAdmin.adminUserId;

    // 5. Determine operation action
    let action = "overview";
    const params: Record<string, unknown> = {};

    if (req.method === "GET") {
      const url = new URL(req.url);
      const queryAction = url.searchParams.get("action");
      if (queryAction) {
        action = queryAction.trim().toLowerCase();
      } else {
        // Also check pathname suffix (e.g. /superadmin-operations/database)
        const pathParts = url.pathname.split("/").filter(Boolean);
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart !== "superadmin-operations") {
          action = lastPart.toLowerCase();
        }
      }
      url.searchParams.forEach((val, key) => {
        params[key] = val;
      });
    } else if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body && typeof body.action === "string") {
          action = body.action.trim().toLowerCase();
        }
        if (body && typeof body === "object") {
          Object.assign(params, body);
        }
      } catch {
        throw new OperationsError(
          "INVALID_REQUEST",
          "Malformed JSON payload in request body.",
          400
        );
      }
    } else {
      throw new OperationsError(
        "INVALID_REQUEST",
        `HTTP method "${req.method}" is not supported. Use GET or POST.`,
        405
      );
    }

    params.adminUserId = ctx.adminUserId;
    params.correlationId = ctx.correlationId;
    ctx.operation = action;

    // 6. Execute requested capability
    const data = await executeOperation(action, supabaseAdmin, ctx.requestId, params);

    // 7. Structured operational telemetry logging
    logOperationsEvent({
      timestamp: new Date().toISOString(),
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      operation: action,
      adminUserId: ctx.adminUserId,
      durationMs: Math.round((performance.now() - ctx.startTimeMs) * 100) / 100,
      success: true,
      statusCode: 200,
    });

    // 8. Return standardized, sanitized envelope
    return buildSuccessResponse(data, ctx);
  } catch (err: unknown) {
    const normalized = normalizeError(err);

    logOperationsEvent({
      timestamp: new Date().toISOString(),
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      operation: ctx.operation || "unknown",
      adminUserId: ctx.adminUserId || "unauthenticated",
      durationMs: Math.round((performance.now() - ctx.startTimeMs) * 100) / 100,
      success: false,
      errorCode: normalized.code,
      statusCode: normalized.status,
    });

    return buildErrorResponse(normalized, ctx);
  }
});
