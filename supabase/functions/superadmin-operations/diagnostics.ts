// supabase/functions/superadmin-operations/diagnostics.ts
// Privileged Database & Edge Diagnostics Foundation

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import { withTimeout } from "./timeout.ts";
import { OperationsError } from "./errors.ts";

export interface DatabaseDiagnosticsResult {
  status: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  connected: boolean;
  timestamp: string;
  latency_ms: number;
  is_in_recovery?: boolean;
  database_size_pretty?: string;
  active_connections?: number | string;
  record_counts?: {
    total_events: number;
    published_events: number;
    active_admins: number;
    media_assets: number;
    cache_revision_stamps: number;
  };
  error?: string;
}

export interface EdgeDiagnosticsResult {
  status: 'HEALTHY';
  timestamp: string;
  runtime: string;
  deno_version: string;
}

export async function runDatabaseDiagnostics(
  supabase: SupabaseClient
): Promise<DatabaseDiagnosticsResult> {
  const startTime = performance.now();

  return await withTimeout(
    async () => {
      const { data, error } = await supabase.rpc('get_operations_database_diagnostics');

      if (error) {
        throw new OperationsError(
          "DIAGNOSTIC_FAILED",
          `Database diagnostic probe failed: ${error.message}`,
          500
        );
      }

      if (!data) {
        throw new OperationsError(
          "DIAGNOSTIC_FAILED",
          "Database diagnostic probe returned empty payload.",
          500
        );
      }

      return data as DatabaseDiagnosticsResult;
    },
    5000,
    "database_diagnostic_probe"
  );
}

export function runEdgeDiagnostics(): EdgeDiagnosticsResult {
  return {
    status: "HEALTHY",
    timestamp: new Date().toISOString(),
    runtime: "deno_edge_isolate",
    deno_version: Deno.version.deno,
  };
}
