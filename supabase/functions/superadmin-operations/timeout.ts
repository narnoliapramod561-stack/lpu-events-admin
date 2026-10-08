// supabase/functions/superadmin-operations/timeout.ts
// Bounded Timeout Execution Utility for Operations Probes & Future Providers

import { OperationsError } from "./errors.ts";

/**
 * Wraps any promise in an AbortController with a strict timeout limit.
 * Prevents operational probes or future provider requests from hanging indefinitely.
 */
export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await operation(controller.signal);
  } catch (err: unknown) {
    if (controller.signal.aborted) {
      throw new OperationsError("TIMEOUT", `Operation "${operationName}" timed out after ${timeoutMs}ms.`, 504);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
