// supabase/functions/superadmin-operations/providers/sentry.ts
// Sentry Organization Error Telemetry Adapter (DECOMMISSIONED)

import { ProviderCollectionResult } from "./types.ts";

export async function collectSentryTelemetry(): Promise<ProviderCollectionResult> {
  return {
    provider: "sentry",
    metrics: [],
    probes: [],
    errors: [],
    isConfigured: false,
  };
}
