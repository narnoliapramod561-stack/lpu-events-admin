// lpu-events-admin/supabase/functions/superadmin-monitoring/providers/uptimerobot.ts
// UptimeRobot v2 API Client with Strict Metric Truthfulness (MON-005 / MON-008 Stage 7)

import type { NormalizedMonitorStatus, ProviderConnectivityStatus } from "../types.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

let monitorsCache: {
  data: NormalizedMonitorStatus[];
  timestamp: number;
} | null = null;

let inFlightFetch: Promise<NormalizedMonitorStatus[]> | null = null;

const CACHE_TTL_MS = 30 * 1000; // 30s in-memory cache to safeguard 10 req/min limit

function getApiKey(providedKey?: string): string {
  if (providedKey) return providedKey;
  if (typeof Deno !== "undefined") {
    return Deno.env.get("UPTIMEROBOT_API_KEY") || "";
  }
  return "";
}

function mapUptimeRobotStatus(status: number): NormalizedMonitorStatus["status"] {
  switch (status) {
    case 2:
      return "up";
    case 8:
      return "seems_down";
    case 9:
      return "down";
    case 0:
      return "paused";
    default:
      return "unknown";
  }
}

export function _clearMonitorsCacheForTesting() {
  monitorsCache = null;
  inFlightFetch = null;
}

export async function fetchUptimeRobotMonitors(
  apiKey?: string,
  forceRefresh: boolean = false
): Promise<NormalizedMonitorStatus[]> {
  const key = getApiKey(apiKey);
  if (!key) {
    throw new Error("UPTIMEROBOT_API_KEY is not configured.");
  }

  const now = Date.now();
  if (!forceRefresh && monitorsCache && now - monitorsCache.timestamp < CACHE_TTL_MS) {
    return monitorsCache.data;
  }

  if (inFlightFetch) {
    return inFlightFetch;
  }

  inFlightFetch = (async () => {
    try {
      const response = await fetch("https://api.uptimerobot.com/v2/getMonitors", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cache-Control": "no-cache",
        },
        body: new URLSearchParams({
          api_key: key,
          format: "json",
          custom_uptime_ratios: "30",
          response_times: "1",
          response_times_average: "30",
          logs: "1",
        }),
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      if (response.status === 429) {
        throw new Error("UptimeRobot API rate limit reached (10 req/min on Free plan).");
      }

      if (!response.ok) {
        throw new Error(`UptimeRobot HTTP error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data.stat !== "ok") {
        throw new Error(`UptimeRobot error: ${data.error?.message || "Unknown error"}`);
      }

      const retrievedAt = new Date().toISOString();

      // Filter out legacy decommissioned monitors (e.g. onrender.com)
      const relevantMonitors = (data.monitors || []).filter((m: any) => {
        const url = m.url || "";
        return !url.includes("onrender.com");
      });

      const parsedMonitors: NormalizedMonitorStatus[] = relevantMonitors.map((m: any): NormalizedMonitorStatus => {
        // 1. Parse custom uptime ratio safely without assuming 100%
        // UptimeRobot v2 returns custom_uptime_ratio (singular); tests/fallbacks check custom_uptime_ratios
        let ratio30d: number | null = null;
        const rawRatio = m.custom_uptime_ratio ?? m.custom_uptime_ratios;
        if (typeof rawRatio === "string" && rawRatio.trim().length > 0) {
          const parsed = parseFloat(rawRatio.split("-")[0]);
          if (!isNaN(parsed)) ratio30d = parsed;
        }

        // 2. Parse response time safely without assuming 0ms
        let avgResponseTime: number | null = null;
        if (m.average_response_time !== undefined && m.average_response_time !== null && m.average_response_time !== "") {
          const parsed = parseInt(String(m.average_response_time), 10);
          if (!isNaN(parsed) && parsed > 0) avgResponseTime = parsed;
        }

        // 3. Extract sample and check timestamps
        let sampleTimeIso: string | null = null;
        if (m.response_times?.[0]?.datetime) {
          sampleTimeIso = new Date(m.response_times[0].datetime * 1000).toISOString();
        }

        let lastCheckIso: string | null = null;
        const latestCheck = m.logs?.[0]?.datetime || m.response_times?.[0]?.datetime;
        if (typeof latestCheck === "number" && latestCheck > 0) {
          lastCheckIso = new Date(latestCheck * 1000).toISOString();
        }

        const normalizedUrl = (m.url || "").replace("admin.lpuevents.live", "www.lpueventsadmin.live");
        const status = mapUptimeRobotStatus(m.status);

        return {
          id: String(m.id),
          name: m.friendly_name || "Monitor",
          url: normalizedUrl,
          status,
          uptimeRatio30d: ratio30d,
          averageResponseTimeMs: avgResponseTime,
          dataRetrievedAt: retrievedAt,
          lastResponseTimeSampleAt: sampleTimeIso,
          lastCheckAt: lastCheckIso,
        };
      });

      monitorsCache = { data: parsedMonitors, timestamp: Date.now() };
      return parsedMonitors;
    } finally {
      inFlightFetch = null;
    }
  })();

  return inFlightFetch;
}

export async function pingUptimeRobot(apiKey?: string): Promise<ProviderConnectivityStatus> {
  const start = performance.now();
  const checkedAt = new Date().toISOString();
  try {
    const key = getApiKey(apiKey);
    if (!key) {
      return { connected: false, error: "UPTIMEROBOT_API_KEY not configured", checkedAt };
    }
    await fetchUptimeRobotMonitors(key);
    const latencyMs = Math.round(performance.now() - start);
    return { connected: true, latencyMs, checkedAt };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return { connected: false, latencyMs, error: err.message || "Failed to reach UptimeRobot", checkedAt };
  }
}
