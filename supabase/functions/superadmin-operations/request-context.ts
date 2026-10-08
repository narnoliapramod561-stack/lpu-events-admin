// supabase/functions/superadmin-operations/request-context.ts
// Request Context, Correlation ID Foundation & Structured Server-Side Logging

export interface OperationsRequestContext {
  requestId: string;
  correlationId: string;
  startedAt: string;
  startTimeMs: number;
  adminUserId?: string;
  operation?: string;
  origin?: string;
}

export function createRequestContext(req: Request): OperationsRequestContext {
  const requestId = `ops_req_${crypto.randomUUID()}`;
  
  // Validate incoming correlation id (alphanumeric, hyphen, underscore, max 64 chars)
  const incomingCorrelation = req.headers.get("x-correlation-id") || req.headers.get("X-Correlation-Id");
  let correlationId = requestId;
  if (incomingCorrelation && /^[A-Za-z0-9_-]{1,64}$/.test(incomingCorrelation)) {
    correlationId = incomingCorrelation;
  }

  const origin = req.headers.get("origin") || undefined;

  return {
    requestId,
    correlationId,
    startedAt: new Date().toISOString(),
    startTimeMs: performance.now(),
    origin,
  };
}

export interface StructuredOperationsLog {
  timestamp: string;
  requestId: string;
  correlationId: string;
  operation: string;
  adminUserId: string;
  durationMs: number;
  success: boolean;
  errorCode?: string;
  statusCode: number;
}

/**
 * Server-side operational telemetry log entry.
 * Follows strict redaction: Never logs tokens, JWTs, credentials, or PII.
 */
export function logOperationsEvent(log: StructuredOperationsLog): void {
  const serialized = JSON.stringify({
    channel: "operations_control_plane",
    ...log,
  });
  if (log.success) {
    console.log(serialized);
  } else {
    console.error(serialized);
  }
}
