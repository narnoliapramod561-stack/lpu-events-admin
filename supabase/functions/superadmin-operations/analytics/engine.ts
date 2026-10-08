// engine.ts — Server-Side Deterministic Historical Analytics & Forecasting Engine (Phase 6)
// Provides bounded time-window aggregations, linear trend analysis, threshold projections,
// and historical statistics for metrics, incidents, alerts, and maintenance jobs.

import { CONTROLLED_METRIC_CATALOG, getMetricDefinition, isValidMetricKey } from "./catalog.ts";

export type AnalyticsWindow = "1h" | "6h" | "24h" | "7d" | "30d" | "90d";
export type TrendDirection = "RISING" | "FALLING" | "STABLE" | "INSUFFICIENT_DATA";
export type ThresholdStatus = "APPROACHING" | "NOT_APPROACHING" | "ALREADY_EXCEEDED" | "INSUFFICIENT_DATA";
export type DataQuality = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";

export interface MetricHistoryPoint {
  timestamp: string;
  value: number;
  limit: number | null;
  status: string;
  unit: string;
}

export interface MetricAggregations {
  min: number;
  max: number;
  avg: number;
  count: number;
  first: number;
  latest: number;
  p95: number;
  change: number;
  changePercent: number;
  ratePerMinute: number;
}

export interface MetricTrendResult {
  direction: TrendDirection;
  slope: number; // units per second
  changePercent: number;
  sampleCount: number;
  baseline: number;
  currentValue: number;
  dataQuality: DataQuality;
  reason?: string;
}

export interface ThresholdProjectionResult {
  metricKey: string;
  serviceId: string;
  currentValue: number;
  threshold: number;
  status: ThresholdStatus;
  estimatedTimeToThresholdMs: number | null;
  projectedExceedAt: string | null;
  slopePerSecond: number;
  dataQuality: DataQuality;
  reason: string;
}

export function parseWindowHours(windowStr: string = "24h"): number {
  switch (windowStr) {
    case "1h": return 1;
    case "6h": return 6;
    case "24h": return 24;
    case "7d": return 168;
    case "30d": return 720;
    case "90d": return 2160;
    default: return 24;
  }
}

// ----------------------------------------------------------------------------
// Mathematical Helpers (Deterministic, Server-Side, Explainable)
// ----------------------------------------------------------------------------

export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Least-squares linear regression over timestamps (in seconds).
 * Computes slope β: change in metric value per second.
 */
export function calculateLinearTrend(
  points: { timestamp: number; value: number }[]
): { slope: number; baseline: number; currentValue: number; change: number; changePercent: number } {
  if (points.length < 2) {
    return { slope: 0, baseline: points[0]?.value ?? 0, currentValue: points[0]?.value ?? 0, change: 0, changePercent: 0 };
  }

  const t0 = points[0].timestamp;
  const n = points.length;
  let sumT = 0;
  let sumY = 0;
  let sumTT = 0;
  let sumTY = 0;

  for (const pt of points) {
    const t = (pt.timestamp - t0) / 1000; // seconds from t0
    const y = pt.value;
    sumT += t;
    sumY += y;
    sumTT += t * t;
    sumTY += t * y;
  }

  const meanT = sumT / n;
  const meanY = sumY / n;
  const denominator = sumTT - sumT * meanT;

  const slope = Math.abs(denominator) > 1e-9 ? (sumTY - sumT * meanY) / denominator : 0;
  const baseline = points[0].value;
  const currentValue = points[points.length - 1].value;
  const totalSeconds = (points[points.length - 1].timestamp - t0) / 1000;
  const change = slope * totalSeconds;

  const baseForPercent = Math.abs(baseline) > 1e-6 ? Math.abs(baseline) : (Math.abs(meanY) > 1e-6 ? Math.abs(meanY) : 1);
  const changePercent = (change / baseForPercent) * 100;

  return { slope, baseline, currentValue, change, changePercent };
}

export function evaluateDataQuality(
  sampleCount: number,
  expectedSamples: number,
  hasRecentSample: boolean
): DataQuality {
  if (sampleCount < 3 || !hasRecentSample) return "INSUFFICIENT";
  const coverage = sampleCount / Math.max(expectedSamples, 1);
  if (coverage >= 0.75 && sampleCount >= 10) return "HIGH";
  if (coverage >= 0.4 || sampleCount >= 5) return "MEDIUM";
  return "LOW";
}

// ----------------------------------------------------------------------------
// 1. Metric Historical Time-Series & Aggregations
// ----------------------------------------------------------------------------

export async function getMetricHistoryWithAnalytics(
  supabaseAdmin: any,
  serviceId: string,
  metricKey: string,
  windowStr: AnalyticsWindow = "24h"
): Promise<{
  metricKey: string;
  serviceId: string;
  window: string;
  unit: string;
  points: MetricHistoryPoint[];
  aggregations: MetricAggregations | null;
  trend: MetricTrendResult;
  dataQuality: DataQuality;
}> {
  const windowHours = parseWindowHours(windowStr);
  const now = new Date();
  const startTime = new Date(now.getTime() - windowHours * 3600 * 1000);

  // Bounded query using indexed columns (service_id, metric_key, captured_at)
  const { data: rawRows, error } = await supabaseAdmin
    .from("ops_metric_snapshots")
    .select("captured_at, metric_value, metric_limit, status, unit")
    .eq("service_id", serviceId)
    .eq("metric_key", metricKey)
    .gte("captured_at", startTime.toISOString())
    .not("metric_value", "is", null)
    .order("captured_at", { ascending: true })
    .limit(1000); // Strict safety bound

  if (error) {
    throw new Error(`Failed to query metric history: ${error.message}`);
  }

  const def = getMetricDefinition(metricKey);
  const unit = rawRows?.[0]?.unit || def?.unit || "count";

  const points: MetricHistoryPoint[] = (rawRows || []).map((r: any) => ({
    timestamp: r.captured_at,
    value: Number(r.metric_value),
    limit: r.metric_limit !== null ? Number(r.metric_limit) : null,
    status: r.status,
    unit: r.unit,
  }));

  const sampleCount = points.length;
  const expectedSamples = Math.max(Math.floor(windowHours * 12), 3); // assumes ~5m cadence
  const latestTimestamp = points.length > 0 ? new Date(points[points.length - 1].timestamp).getTime() : 0;
  const hasRecent = latestTimestamp > 0 && (now.getTime() - latestTimestamp) <= (windowHours > 6 ? 3600 * 4000 : 3600 * 2000);
  const dataQuality = evaluateDataQuality(sampleCount, expectedSamples, hasRecent);

  if (sampleCount < 3) {
    return {
      metricKey,
      serviceId,
      window: windowStr,
      unit,
      points,
      aggregations: null,
      trend: {
        direction: "INSUFFICIENT_DATA",
        slope: 0,
        changePercent: 0,
        sampleCount,
        baseline: points[0]?.value ?? 0,
        currentValue: points[points.length - 1]?.value ?? 0,
        dataQuality,
        reason: "At least 3 observations across distinct timestamps are required for trend evaluation.",
      },
      dataQuality,
    };
  }

  // Calculate Aggregations
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const avg = Number((sum / values.length).toFixed(4));
  const first = values[0];
  const latest = values[values.length - 1];
  const p95 = Number(calculatePercentile(values, 95).toFixed(4));

  const regressionPoints = points.map((p) => ({
    timestamp: new Date(p.timestamp).getTime(),
    value: p.value,
  }));
  const { slope, baseline, currentValue, change, changePercent } = calculateLinearTrend(regressionPoints);

  const isCumulativeCounter = def?.metricType === "CUMULATIVE_COUNTER" || metricKey.endsWith("_total");

  // Cumulative Counter Reset & Non-Negative Delta Rate Derivation
  let counterResetDetected = false;
  let counterTotalDelta = 0;
  for (let i = 1; i < regressionPoints.length; i++) {
    const diff = regressionPoints[i].value - regressionPoints[i - 1].value;
    if (diff < 0) {
      counterResetDetected = true;
    } else {
      counterTotalDelta += diff;
    }
  }

  const durationMinutes = (regressionPoints[regressionPoints.length - 1].timestamp - regressionPoints[0].timestamp) / 60000;
  let ratePerMinute = 0;
  if (durationMinutes > 0) {
    if (isCumulativeCounter) {
      ratePerMinute = Number((counterTotalDelta / durationMinutes).toFixed(4));
    } else {
      ratePerMinute = Number((change / durationMinutes).toFixed(4));
    }
  }

  // Adjust data quality if counter reset was detected
  let effectiveDataQuality = dataQuality;
  let trendReason: string | undefined;
  if (isCumulativeCounter && counterResetDetected) {
    effectiveDataQuality = dataQuality === "HIGH" ? "LOW" : "INSUFFICIENT";
    trendReason = "Counter reset or rollover detected in time-series; rate derived from non-negative segments.";
  }

  // Trend Direction Classification
  let direction: TrendDirection = "STABLE";
  if (Math.abs(changePercent) > 1.0) {
    direction = slope > 0 ? "RISING" : "FALLING";
  }

  const aggregations: MetricAggregations = {
    min,
    max,
    avg,
    count: sampleCount,
    first,
    latest,
    p95,
    change: Number(change.toFixed(4)),
    changePercent: Number(changePercent.toFixed(2)),
    ratePerMinute,
  };

  const trend: MetricTrendResult = {
    direction,
    slope: Number(slope.toFixed(6)),
    changePercent: Number(changePercent.toFixed(2)),
    sampleCount,
    baseline,
    currentValue,
    dataQuality: effectiveDataQuality,
    reason: trendReason,
  };

  return {
    metricKey,
    serviceId,
    window: windowStr,
    unit,
    points,
    aggregations,
    trend,
    dataQuality: effectiveDataQuality,
  };
}

// ----------------------------------------------------------------------------
// 2. Deterministic Threshold Projection
// ----------------------------------------------------------------------------

export async function projectThresholdTrajectory(
  supabaseAdmin: any,
  serviceId: string,
  metricKey: string,
  targetThreshold?: number,
  windowStr: AnalyticsWindow = "24h"
): Promise<ThresholdProjectionResult> {
  const history = await getMetricHistoryWithAnalytics(supabaseAdmin, serviceId, metricKey, windowStr);
  const def = getMetricDefinition(metricKey);
  const threshold = targetThreshold ?? def?.defaultThreshold;

  if (threshold === undefined || threshold === null) {
    return {
      metricKey,
      serviceId,
      currentValue: history.trend.currentValue,
      threshold: 0,
      status: "NOT_APPROACHING",
      estimatedTimeToThresholdMs: null,
      projectedExceedAt: null,
      slopePerSecond: history.trend.slope,
      dataQuality: history.dataQuality,
      reason: "No threshold configured for this metric.",
    };
  }

  const current = history.trend.currentValue;

  // Already exceeded
  if (current >= threshold) {
    return {
      metricKey,
      serviceId,
      currentValue: current,
      threshold,
      status: "ALREADY_EXCEEDED",
      estimatedTimeToThresholdMs: 0,
      projectedExceedAt: new Date().toISOString(),
      slopePerSecond: history.trend.slope,
      dataQuality: history.dataQuality,
      reason: `Current metric value (${current}) has already reached or exceeded target threshold (${threshold}).`,
    };
  }

  // Insufficient data
  if (history.trend.direction === "INSUFFICIENT_DATA" || history.dataQuality === "INSUFFICIENT") {
    return {
      metricKey,
      serviceId,
      currentValue: current,
      threshold,
      status: "INSUFFICIENT_DATA",
      estimatedTimeToThresholdMs: null,
      projectedExceedAt: null,
      slopePerSecond: 0,
      dataQuality: "INSUFFICIENT",
      reason: "Insufficient historical observations to project trajectory.",
    };
  }

  // Flat or Falling
  if (history.trend.slope <= 0 || history.trend.direction === "FALLING" || history.trend.direction === "STABLE") {
    return {
      metricKey,
      serviceId,
      currentValue: current,
      threshold,
      status: "NOT_APPROACHING",
      estimatedTimeToThresholdMs: null,
      projectedExceedAt: null,
      slopePerSecond: history.trend.slope,
      dataQuality: history.dataQuality,
      reason: `Metric trajectory is ${history.trend.direction.toLowerCase()} and not moving toward threshold.`,
    };
  }

  // Rising toward threshold
  const deltaNeeded = threshold - current;
  const secondsRemaining = deltaNeeded / history.trend.slope;
  const maxOneYearSeconds = 365 * 86400;

  if (secondsRemaining > maxOneYearSeconds) {
    return {
      metricKey,
      serviceId,
      currentValue: current,
      threshold,
      status: "NOT_APPROACHING",
      estimatedTimeToThresholdMs: null,
      projectedExceedAt: null,
      slopePerSecond: history.trend.slope,
      dataQuality: history.dataQuality,
      reason: "Projected threshold exceedance horizon exceeds 1 year.",
    };
  }

  const estimatedTimeToThresholdMs = Math.round(secondsRemaining * 1000);
  const projectedExceedAt = new Date(Date.now() + estimatedTimeToThresholdMs).toISOString();

  return {
    metricKey,
    serviceId,
    currentValue: current,
    threshold,
    status: "APPROACHING",
    estimatedTimeToThresholdMs,
    projectedExceedAt,
    slopePerSecond: history.trend.slope,
    dataQuality: history.dataQuality,
    reason: `Metric is rising at ${history.trend.slope.toFixed(6)} units/sec and projected to reach threshold on ${projectedExceedAt}.`,
  };
}

// ----------------------------------------------------------------------------
// 3. Incident Historical Analytics & MTTR
// ----------------------------------------------------------------------------

export async function getIncidentAnalytics(
  supabaseAdmin: any,
  windowStr: AnalyticsWindow = "30d"
): Promise<{
  window: string;
  totalIncidents: number;
  openIncidents: number;
  resolvedIncidents: number;
  bySeverity: Record<string, number>;
  byService: Record<string, number>;
  automaticRecoveryCount: number;
  manualResolutionCount: number;
  acknowledgedCount: number;
  averageDurationMs: number | null;
  medianDurationMs: number | null;
  longestDurationMs: number | null;
  mttrMs: number | null; // Mean Time to Resolution for completed incidents
  openIncidentAverageAgeMs: number | null;
  incidentFrequencyPerDay: number;
}> {
  const windowHours = parseWindowHours(windowStr);
  const startTime = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("ops_incidents")
    .select("id, severity, status, service_id, opened_at, acknowledged_at, resolved_at, resolution_type")
    .gte("opened_at", startTime)
    .order("opened_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to query incident analytics: ${error.message}`);
  }

  const incidents = rows || [];
  const bySeverity: Record<string, number> = { CRITICAL: 0, HIGH: 0, WARNING: 0, INFO: 0 };
  const byService: Record<string, number> = {};

  let openCount = 0;
  let resolvedCount = 0;
  let autoRecoveryCount = 0;
  let manualResolutionCount = 0;
  let acknowledgedCount = 0;

  const resolvedDurations: number[] = [];
  const openAges: number[] = [];
  const nowMs = Date.now();

  for (const inc of incidents) {
    // Severity tally
    if (bySeverity[inc.severity] !== undefined) {
      bySeverity[inc.severity]++;
    } else {
      bySeverity[inc.severity] = 1;
    }

    // Service tally
    byService[inc.service_id] = (byService[inc.service_id] || 0) + 1;

    // Acknowledgement tally
    if (inc.acknowledged_at) acknowledgedCount++;

    if (inc.status === "RESOLVED") {
      resolvedCount++;
      if (inc.resolution_type === "AUTO_RECOVERY") autoRecoveryCount++;
      if (inc.resolution_type === "MANUAL") manualResolutionCount++;

      if (inc.resolved_at && inc.opened_at) {
        const duration = new Date(inc.resolved_at).getTime() - new Date(inc.opened_at).getTime();
        if (duration >= 0) resolvedDurations.push(duration);
      }
    } else {
      openCount++;
      if (inc.opened_at) {
        const age = nowMs - new Date(inc.opened_at).getTime();
        if (age >= 0) openAges.push(age);
      }
    }
  }

  // Calculate MTTR & Durations for completed incidents
  let averageDurationMs: number | null = null;
  let medianDurationMs: number | null = null;
  let longestDurationMs: number | null = null;
  let mttrMs: number | null = null;

  if (resolvedDurations.length > 0) {
    const sum = resolvedDurations.reduce((a, b) => a + b, 0);
    averageDurationMs = Math.round(sum / resolvedDurations.length);
    mttrMs = averageDurationMs; // MTTR strictly defined as mean resolution duration of completed incidents
    medianDurationMs = Math.round(calculatePercentile(resolvedDurations, 50));
    longestDurationMs = Math.max(...resolvedDurations);
  }

  let openIncidentAverageAgeMs: number | null = null;
  if (openAges.length > 0) {
    const sum = openAges.reduce((a, b) => a + b, 0);
    openIncidentAverageAgeMs = Math.round(sum / openAges.length);
  }

  const days = Math.max(windowHours / 24, 1);
  const incidentFrequencyPerDay = Number((incidents.length / days).toFixed(2));

  return {
    window: windowStr,
    totalIncidents: incidents.length,
    openIncidents: openCount,
    resolvedIncidents: resolvedCount,
    bySeverity,
    byService,
    automaticRecoveryCount: autoRecoveryCount,
    manualResolutionCount: manualResolutionCount,
    acknowledgedCount,
    averageDurationMs,
    medianDurationMs,
    longestDurationMs,
    mttrMs,
    openIncidentAverageAgeMs,
    incidentFrequencyPerDay,
  };
}

// ----------------------------------------------------------------------------
// 4. Alert Historical Analytics
// ----------------------------------------------------------------------------

export async function getAlertAnalytics(
  supabaseAdmin: any,
  windowStr: AnalyticsWindow = "30d"
): Promise<{
  window: string;
  totalAlerts: number;
  openAlerts: number;
  resolvedAlerts: number;
  bySeverity: Record<string, number>;
  byService: Record<string, number>;
  topRecurringRules: { ruleId: string; title: string; count: number }[];
  alertFrequencyPerDay: number;
}> {
  const windowHours = parseWindowHours(windowStr);
  const startTime = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("ops_alerts")
    .select("id, rule_id, service_id, severity, status, title, occurrence_count, first_detected_at")
    .gte("first_detected_at", startTime)
    .order("first_detected_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to query alert analytics: ${error.message}`);
  }

  const alerts = rows || [];
  const bySeverity: Record<string, number> = { CRITICAL: 0, HIGH: 0, WARNING: 0, INFO: 0 };
  const byService: Record<string, number> = {};
  const ruleCounts: Record<string, { title: string; count: number }> = {};

  let openCount = 0;
  let resolvedCount = 0;

  for (const a of alerts) {
    if (bySeverity[a.severity] !== undefined) bySeverity[a.severity]++;
    else bySeverity[a.severity] = 1;

    byService[a.service_id] = (byService[a.service_id] || 0) + 1;

    if (a.status === "RESOLVED") resolvedCount++;
    else openCount++;

    const occurrences = Math.max(a.occurrence_count || 1, 1);
    if (!ruleCounts[a.rule_id]) {
      ruleCounts[a.rule_id] = { title: a.title, count: occurrences };
    } else {
      ruleCounts[a.rule_id].count += occurrences;
    }
  }

  const topRecurringRules = Object.entries(ruleCounts)
    .map(([ruleId, info]) => ({ ruleId, title: info.title, count: info.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const days = Math.max(windowHours / 24, 1);
  const alertFrequencyPerDay = Number((alerts.length / days).toFixed(2));

  return {
    window: windowStr,
    totalAlerts: alerts.length,
    openAlerts: openCount,
    resolvedAlerts: resolvedCount,
    bySeverity,
    byService,
    topRecurringRules,
    alertFrequencyPerDay,
  };
}

// ----------------------------------------------------------------------------
// 5. Job Historical Analytics
// ----------------------------------------------------------------------------

export async function getJobAnalytics(
  supabaseAdmin: any,
  jobKey?: string,
  windowStr: AnalyticsWindow = "30d"
): Promise<{
  window: string;
  totalExecutions: number;
  successfulExecutions: number;
  partialExecutions: number;
  failedExecutions: number;
  staleExecutionsCount: number;
  averageDurationMs: number | null;
  maxDurationMs: number | null;
  successRate: number;
  failureRate: number;
  byJob: Record<string, { total: number; success: number; failed: number; avgDurationMs: number }>;
}> {
  const windowHours = parseWindowHours(windowStr);
  const startTime = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();

  let query = supabaseAdmin
    .from("ops_job_runs")
    .select("id, job_id, status, duration_ms, started_at, metadata, ops_jobs!inner(job_key)")
    .gte("started_at", startTime)
    .order("started_at", { ascending: false });

  if (jobKey) {
    query = query.eq("ops_jobs.job_key", jobKey);
  }

  const { data: rows, error } = await query;
  if (error) {
    throw new Error(`Failed to query job analytics: ${error.message}`);
  }

  const runs = rows || [];
  let successful = 0;
  let partial = 0;
  let failed = 0;
  let staleCount = 0;
  const durations: number[] = [];
  const byJob: Record<string, { total: number; success: number; failed: number; durations: number[] }> = {};

  for (const r of runs) {
    const k = r.ops_jobs?.job_key || "unknown";
    if (!byJob[k]) {
      byJob[k] = { total: 0, success: 0, failed: 0, durations: [] };
    }
    byJob[k].total++;

    if (r.status === "COMPLETED") {
      successful++;
      byJob[k].success++;
    } else if (r.status === "PARTIAL") {
      partial++;
    } else if (r.status === "FAILED") {
      failed++;
      byJob[k].failed++;
    }

    if (r.metadata?.stale_detected) {
      staleCount++;
    }

    if (r.duration_ms !== null && r.duration_ms !== undefined) {
      const d = Number(r.duration_ms);
      durations.push(d);
      byJob[k].durations.push(d);
    }
  }

  const total = runs.length;
  const averageDurationMs = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;
  const maxDurationMs = durations.length > 0 ? Math.max(...durations) : null;
  const successRate = total > 0 ? Number(((successful / total) * 100).toFixed(2)) : 0;
  const failureRate = total > 0 ? Number(((failed / total) * 100).toFixed(2)) : 0;

  const byJobSummary: Record<string, { total: number; success: number; failed: number; avgDurationMs: number }> = {};
  for (const [k, v] of Object.entries(byJob)) {
    const avgD = v.durations.length > 0
      ? Math.round(v.durations.reduce((a, b) => a + b, 0) / v.durations.length)
      : 0;
    byJobSummary[k] = {
      total: v.total,
      success: v.success,
      failed: v.failed,
      avgDurationMs: avgD,
    };
  }

  return {
    window: windowStr,
    totalExecutions: total,
    successfulExecutions: successful,
    partialExecutions: partial,
    failedExecutions: failed,
    staleExecutionsCount: staleCount,
    averageDurationMs,
    maxDurationMs,
    successRate,
    failureRate,
    byJob: byJobSummary,
  };
}

// ----------------------------------------------------------------------------
// 6. Cross-Service Overview & Service-Level Summary
// ----------------------------------------------------------------------------

export async function getCrossServiceAnalyticsOverview(
  supabaseAdmin: any,
  windowStr: AnalyticsWindow = "24h"
): Promise<{
  window: string;
  incidentsLast24h: number;
  incidentsLast7d: number;
  criticalIncidentsLast30d: number;
  topRecurringAlertRule: { ruleId: string; title: string; count: number } | null;
  mostUnstableService: { serviceId: string; incidentCount: number; alertCount: number } | null;
  longestAverageRecoveryTimeMs: number | null;
  services: Record<string, {
    serviceId: string;
    incidentsCount: number;
    alertsCount: number;
    healthProbeSuccessRate: number | null;
  }>;
}> {
  const [incidents24h, incidents7d, incidents30d, alertStats] = await Promise.all([
    getIncidentAnalytics(supabaseAdmin, "24h"),
    getIncidentAnalytics(supabaseAdmin, "7d"),
    getIncidentAnalytics(supabaseAdmin, "30d"),
    getAlertAnalytics(supabaseAdmin, "30d"),
  ]);

  // Aggregate per service
  const serviceStats: Record<string, { incidentsCount: number; alertsCount: number }> = {};
  const allServices = new Set([
    ...Object.keys(incidents30d.byService),
    ...Object.keys(alertStats.byService),
    "supabase_database", "cloudflare_worker", "cloudflare_r2", "resend_email", "sentry_error_tracking", "internal_maintenance"
  ]);

  for (const s of allServices) {
    serviceStats[s] = {
      incidentsCount: incidents30d.byService[s] || 0,
      alertsCount: alertStats.byService[s] || 0,
    };
  }

  // Find most unstable service
  let mostUnstableService: { serviceId: string; incidentCount: number; alertCount: number } | null = null;
  let maxInstability = -1;
  for (const [s, stats] of Object.entries(serviceStats)) {
    const instabilityScore = stats.incidentsCount * 5 + stats.alertsCount;
    if (instabilityScore > maxInstability && instabilityScore > 0) {
      maxInstability = instabilityScore;
      mostUnstableService = { serviceId: s, incidentCount: stats.incidentsCount, alertCount: stats.alertsCount };
    }
  }

  const topRecurringAlertRule = alertStats.topRecurringRules[0] || null;

  return {
    window: windowStr,
    incidentsLast24h: incidents24h.totalIncidents,
    incidentsLast7d: incidents7d.totalIncidents,
    criticalIncidentsLast30d: incidents30d.bySeverity["CRITICAL"] || 0,
    topRecurringAlertRule,
    mostUnstableService,
    longestAverageRecoveryTimeMs: incidents30d.longestDurationMs,
    services: Object.fromEntries(
      Object.entries(serviceStats).map(([s, stats]) => [
        s,
        {
          serviceId: s,
          incidentsCount: stats.incidentsCount,
          alertsCount: stats.alertsCount,
          healthProbeSuccessRate: null, // Populated dynamically if probed
        },
      ])
    ),
  };
}
