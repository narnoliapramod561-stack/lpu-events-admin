// supabase/functions/superadmin-operations/security.ts
// Redaction & Secret Boundary Guardrails

const SENSITIVE_PATTERNS = [
  /bearer\s+[A-Za-z0-9\-._~+/]+=*/i,
  /ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/, // JWTs
  /postgres:\/\/[^:]+:[^@]+@/i, // DB connection strings
  /secret/i,
  /password/i,
  /api[_-]?key/i,
  /token/i,
];

/**
 * Sanitizes any object before transmission or logging.
 * Replaces values of sensitive keys with "[REDACTED]".
 */
export function sanitizeForOutput<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (typeof input !== "object") return input;

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeForOutput(item)) as unknown as T;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const isSensitiveKey = SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitiveKey) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeForOutput(value);
    } else if (typeof value === "string") {
      // Check if string contains a JWT or password pattern
      if (value.startsWith("ey") && value.split(".").length >= 2) {
        sanitized[key] = "[REDACTED_TOKEN]";
      } else {
        sanitized[key] = value;
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

export const sanitizeOperationsResponse = sanitizeForOutput;
