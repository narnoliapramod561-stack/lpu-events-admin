// supabase/functions/superadmin-operations/providers/cloudflare.ts
// Cloudflare Workers & R2 Operational Telemetry Adapter (Phase 3)

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import {
  NormalizedMetricSnapshot,
  HealthProbeResult,
  ProviderCollectionResult,
} from "./types.ts";
import { withTimeout } from "../timeout.ts";

export async function collectCloudflareTelemetry(
  supabaseAdmin: SupabaseClient
): Promise<ProviderCollectionResult> {
  const metrics: NormalizedMetricSnapshot[] = [];
  const probes: HealthProbeResult[] = [];
  const errors: string[] = [];
  const now = new Date().toISOString();

  const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const isConfigured = Boolean(apiToken && accountId);

  // 1. Database Media Asset Reconciliation (Authoritative DB metadata, distinct from R2 physical usage)
  try {
    const [totalRes, readyRes, pendingDeleteRes] = await Promise.all([
      supabaseAdmin.from("media_assets").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("media_assets").select("id", { count: "exact", head: true }).eq("status", "READY"),
      supabaseAdmin.from("media_assets").select("id", { count: "exact", head: true }).eq("status", "PENDING_DELETE"),
    ]);

    const totalMedia = totalRes.count ?? 0;
    const readyCount = readyRes.count ?? 0;
    const pendingDeleteCount = pendingDeleteRes.count ?? 0;

    metrics.push({
      serviceId: "cloudflare_r2",
      metricKey: "r2.db_media_assets_count",
      metricValue: totalMedia,
      unit: "count",
      status: "HEALTHY",
      source: "supabase_sql",
      capturedAt: now,
      metadata: {
        total_database_rows: totalMedia,
        ready_count: readyCount,
        pending_delete_count: pendingDeleteCount,
        note: "Authoritative database media metadata rows (not physical R2 byte volume).",
      },
    });
  } catch (err: unknown) {
    errors.push(`Media reconciliation error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Cloudflare GraphQL & Worker Telemetry Evaluation
  if (!isConfigured) {
    probes.push({
      serviceId: "cloudflare_worker",
      probeKey: "cloudflare_worker_reachability",
      success: false,
      status: "NOT_CONFIGURED",
      latencyMs: 0,
      errorMessage: "CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID not configured on server.",
      checkedAt: now,
    });
    probes.push({
      serviceId: "cloudflare_r2",
      probeKey: "r2_gateway_reachability",
      success: false,
      status: "NOT_CONFIGURED",
      latencyMs: 0,
      errorMessage: "CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID not configured on server.",
      checkedAt: now,
    });
    return {
      provider: "cloudflare",
      metrics,
      probes,
      errors,
      isConfigured: false,
    };
  }

  // 3. Cloudflare Token Verification Health Probe
  const tokenVerifyStartTime = performance.now();
  let tokenValid = false;
  try {
    const verifyResp = await withTimeout(
      async (signal) =>
        await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            Accept: "application/json",
          },
          signal,
        }),
      5000,
      "cloudflare_token_verify"
    );

    const tokenLatency = Math.round((performance.now() - tokenVerifyStartTime) * 100) / 100;
    if (verifyResp.ok) {
      tokenValid = true;
      probes.push({
        serviceId: "cloudflare_worker",
        probeKey: "cloudflare_worker_reachability",
        success: true,
        status: "HEALTHY",
        latencyMs: tokenLatency,
        statusCode: 200,
        checkedAt: now,
      });
    } else {
      probes.push({
        serviceId: "cloudflare_worker",
        probeKey: "cloudflare_worker_reachability",
        success: false,
        status: verifyResp.status === 401 || verifyResp.status === 403 ? "AUTHENTICATION_FAILED" : "DEGRADED",
        latencyMs: tokenLatency,
        statusCode: verifyResp.status,
        errorMessage: `Cloudflare token validation failed: HTTP ${verifyResp.status}`,
        checkedAt: now,
      });
      errors.push(`Cloudflare token verification failed: HTTP ${verifyResp.status}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    probes.push({
      serviceId: "cloudflare_worker",
      probeKey: "cloudflare_worker_reachability",
      success: false,
      status: "UNAVAILABLE",
      latencyMs: Math.round((performance.now() - tokenVerifyStartTime) * 100) / 100,
      errorMessage: msg,
      checkedAt: now,
    });
    errors.push(`Cloudflare reachability probe failed: ${msg}`);
  }

  // 4. Query Cloudflare GraphQL Analytics if token is valid
  if (tokenValid && accountId) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const query = `
      query GetWorkerAnalytics($accountTag: String!, $since: String!) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            workersInvocationsAdaptive(filter: { datetime_geq: $since }, limit: 100) {
              sum {
                requests
                errors
                subrequests
              }
              quantiles {
                cpuTimeP50
                cpuTimeP99
              }
            }
          }
        }
      }
    `;

    try {
      const gqlResp = await withTimeout(
        async (signal) =>
          await fetch("https://api.cloudflare.com/client/v4/graphql", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query,
              variables: { accountTag: accountId, since: oneDayAgo },
            }),
            signal,
          }),
        8000,
        "cloudflare_workers_graphql"
      );

      if (gqlResp.ok) {
        const gqlData = await gqlResp.json();
        const accounts = gqlData?.data?.viewer?.accounts;
        const invocations = accounts?.[0]?.workersInvocationsAdaptive?.[0];

        if (invocations) {
          const reqs = invocations.sum?.requests ?? 0;
          const errs = invocations.sum?.errors ?? 0;
          const subreqs = invocations.sum?.subrequests ?? 0;
          const p50 = invocations.quantiles?.cpuTimeP50 ?? 0;
          const p99 = invocations.quantiles?.cpuTimeP99 ?? 0;
          const errorRate = reqs > 0 ? Math.round((errs / reqs) * 10000) / 100 : 0;

          metrics.push({
            serviceId: "cloudflare_worker",
            metricKey: "worker.requests",
            metricValue: reqs,
            unit: "count",
            status: "HEALTHY",
            source: "cloudflare_graphql",
            capturedAt: now,
            observedFrom: oneDayAgo,
            observedTo: now,
          });

          metrics.push({
            serviceId: "cloudflare_worker",
            metricKey: "worker.errors",
            metricValue: errs,
            unit: "count",
            status: errs > 0 ? "WARNING" : "HEALTHY",
            source: "cloudflare_graphql",
            capturedAt: now,
            observedFrom: oneDayAgo,
            observedTo: now,
          });

          metrics.push({
            serviceId: "cloudflare_worker",
            metricKey: "worker.error_rate",
            metricValue: errorRate,
            unit: "percent",
            status: errorRate > 5 ? "WARNING" : "HEALTHY",
            source: "cloudflare_graphql",
            capturedAt: now,
            observedFrom: oneDayAgo,
            observedTo: now,
          });

          metrics.push({
            serviceId: "cloudflare_worker",
            metricKey: "worker.subrequests",
            metricValue: subreqs,
            unit: "count",
            status: "HEALTHY",
            source: "cloudflare_graphql",
            capturedAt: now,
          });

          metrics.push({
            serviceId: "cloudflare_worker",
            metricKey: "worker.cpu_p50",
            metricValue: p50,
            unit: "milliseconds",
            status: "HEALTHY",
            source: "cloudflare_graphql",
            capturedAt: now,
          });

          metrics.push({
            serviceId: "cloudflare_worker",
            metricKey: "worker.cpu_p99",
            metricValue: p99,
            unit: "milliseconds",
            status: "HEALTHY",
            source: "cloudflare_graphql",
            capturedAt: now,
          });
        }
      } else {
        errors.push(`Cloudflare GraphQL HTTP ${gqlResp.status}`);
      }
    } catch (err: unknown) {
      errors.push(`Cloudflare GraphQL query failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 5. Query Cloudflare R2 GraphQL Analytics (Authoritative Physical Storage & Operations)
    const r2Bucket = Deno.env.get("R2_BUCKET_NAME") || "lpu-events-images";
    const r2Query = `
      query GetR2Analytics($accountTag: String!, $bucketName: String!, $since: String!) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            r2StorageAdaptive(filter: { bucketName: $bucketName, datetime_geq: $since }, limit: 10) {
              max {
                payloadSize
                objectCount
                metadataSize
              }
              dimensions {
                datetime
                bucketName
              }
            }
            r2OperationsAdaptive(filter: { bucketName: $bucketName, datetime_geq: $since }, limit: 100) {
              sum {
                requests
                responseObjectSize
              }
              dimensions {
                actionType
              }
            }
          }
        }
      }
    `;

    try {
      const r2GqlResp = await withTimeout(
        async (signal) =>
          await fetch("https://api.cloudflare.com/client/v4/graphql", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query: r2Query,
              variables: { accountTag: accountId, bucketName: r2Bucket, since: oneDayAgo },
            }),
            signal,
          }),
        8000,
        "cloudflare_r2_graphql"
      );

      if (r2GqlResp.ok) {
        const r2GqlData = await r2GqlResp.json();
        const r2Accounts = r2GqlData?.data?.viewer?.accounts;
        const r2Storage = r2Accounts?.[0]?.r2StorageAdaptive?.[0];
        const r2Ops = r2Accounts?.[0]?.r2OperationsAdaptive || [];

        // Authoritative R2 Physical Storage Bytes (r2.storage_bytes)
        if (r2Storage?.max?.payloadSize != null) {
          const payloadBytes = Number(r2Storage.max.payloadSize);
          metrics.push({
            serviceId: "cloudflare_r2",
            metricKey: "r2.storage_bytes",
            metricValue: payloadBytes,
            unit: "bytes",
            status: "HEALTHY",
            source: "cloudflare_graphql",
            capturedAt: now,
            observedFrom: oneDayAgo,
            observedTo: now,
            metadata: {
              bucket: r2Bucket,
              physical_object_count: r2Storage.max.objectCount ?? null,
              metadata_size_bytes: r2Storage.max.metadataSize ?? null,
              note: "Authoritative Cloudflare R2 physical storage bytes from r2StorageAdaptive.",
            },
          });
        }

        // Authoritative R2 Operations Count (r2.operations)
        if (r2Ops.length > 0) {
          const totalOps = r2Ops.reduce(
            (acc: number, curr: { sum?: { requests?: number } }) => acc + (curr.sum?.requests ?? 0),
            0
          );
          metrics.push({
            serviceId: "cloudflare_r2",
            metricKey: "r2.operations",
            metricValue: totalOps,
            unit: "count",
            status: "HEALTHY",
            source: "cloudflare_graphql",
            capturedAt: now,
            observedFrom: oneDayAgo,
            observedTo: now,
            metadata: { bucket: r2Bucket },
          });

          // Authoritative R2 Downloaded Bandwidth (r2.bytes_downloaded)
          const totalDown = r2Ops.reduce(
            (acc: number, curr: { sum?: { responseObjectSize?: number } }) =>
              acc + (curr.sum?.responseObjectSize ?? 0),
            0
          );
          metrics.push({
            serviceId: "cloudflare_r2",
            metricKey: "r2.bytes_downloaded",
            metricValue: totalDown,
            unit: "bytes",
            status: "HEALTHY",
            source: "cloudflare_graphql",
            capturedAt: now,
            observedFrom: oneDayAgo,
            observedTo: now,
            metadata: { bucket: r2Bucket },
          });
        }
      } else {
        errors.push(`Cloudflare R2 GraphQL HTTP ${r2GqlResp.status}`);
      }
    } catch (err: unknown) {
      errors.push(`Cloudflare R2 GraphQL query failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 6. R2 Gateway Reachability Probe
    const r2PublicDomain = Deno.env.get("R2_PUBLIC_DOMAIN") || "images.lpuevents.live";
    const r2StartTime = performance.now();
    try {
      const r2Head = await withTimeout(
        async (signal) =>
          await fetch(`https://${r2PublicDomain}/favicon.ico`, {
            method: "HEAD",
            signal,
          }),
        4000,
        "r2_gateway_probe"
      );

      const r2Latency = Math.round((performance.now() - r2StartTime) * 100) / 100;
      probes.push({
        serviceId: "cloudflare_r2",
        probeKey: "r2_gateway_reachability",
        success: r2Head.status < 500,
        status: r2Head.status < 500 ? "HEALTHY" : "DEGRADED",
        latencyMs: r2Latency,
        statusCode: r2Head.status,
        checkedAt: now,
      });
    } catch (err: unknown) {
      probes.push({
        serviceId: "cloudflare_r2",
        probeKey: "r2_gateway_reachability",
        success: false,
        status: "UNAVAILABLE",
        latencyMs: Math.round((performance.now() - r2StartTime) * 100) / 100,
        errorMessage: err instanceof Error ? err.message : String(err),
        checkedAt: now,
      });
    }
  }

  return {
    provider: "cloudflare",
    metrics,
    probes,
    errors,
    isConfigured,
  };
}
