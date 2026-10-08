// src/components/superadmin/operations/OperationsControlCenter.tsx
// LPU Events — Phase 7: Super Admin Operations Control Center
// Production-grade operational control surface consuming certified Phases 1–6 backend.

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../../auth';
import { supabase } from '../../../supabase';
import { OperationsClient } from '../../../shared/operations/client';
import {
  OperationsOverview,
  OperationsServiceDefinition,
  OperationsHealthProbe,
  OperationsMetricSnapshot,
  OperationsJob,
  OperationsJobRun,
  OperationsIncident,
  OperationsAnalyticsWindow,
  OperationsThresholdProjectionResult,
  OperationsMetricHistoryResult,
  OperationsCrossServiceAnalytics,
  OperationsIncidentAnalytics,
  OperationsAlertAnalytics,
  OperationsJobAnalytics,
} from '../../../shared/operations/types';

import { OperationsRefreshIndicator } from './OperationsRefreshIndicator';
import { OperationsSummaryCards } from './OperationsSummaryCards';
import { ActiveIncidentsList } from './ActiveIncidentsList';
import { ServiceHealthGrid } from './ServiceHealthGrid';
import { KeyMetricsPanel } from './KeyMetricsPanel';
import { OperationsJobTable } from './OperationsJobTable';
import { HistoricalAnalyticsPanel } from './HistoricalAnalyticsPanel';
import { NotificationCenterPanel } from './NotificationCenterPanel';
import { RemediationCenterPanel } from './RemediationCenterPanel';
import { GovernanceCenterPanel } from './GovernanceCenterPanel';
import { ShieldAlert, RefreshCw, AlertTriangle } from 'lucide-react';

export const OperationsControlCenter: React.FC = () => {
  const { profile } = useAuth();

  // Fail-Closed Super Admin Guard
  if (!profile?.is_super_admin) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center mb-4 border border-red-500/20">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-bold font-['Outfit'] text-[#261812] dark:text-white">
          Access Denied: Super Admin Boundary
        </h2>
        <p className="text-sm text-[#5a4136] dark:text-[#aeaeb2] max-w-md mt-2">
          The Operations Control Center is strictly restricted to verified Super Admin roles. Your current authorization does not permit operational control access.
        </p>
      </div>
    );
  }

  // Stable client instance
  const client = useMemo(() => new OperationsClient({ supabaseClient: supabase }), []);

  // Server state
  const [overview, setOverview] = useState<OperationsOverview | null>(null);
  const [services, setServices] = useState<OperationsServiceDefinition[]>([]);
  const [probes, setProbes] = useState<OperationsHealthProbe[]>([]);
  const [metrics, setMetrics] = useState<OperationsMetricSnapshot[]>([]);
  const [jobs, setJobs] = useState<OperationsJob[]>([]);
  const [jobRuns, setJobRuns] = useState<OperationsJobRun[]>([]);
  const [incidents, setIncidents] = useState<OperationsIncident[]>([]);
  const [projections, setProjections] = useState<Record<string, OperationsThresholdProjectionResult>>({});
  const [histories, setHistories] = useState<Record<string, OperationsMetricHistoryResult>>({});

  // Historical Analytics state
  const [selectedWindow, setSelectedWindow] = useState<OperationsAnalyticsWindow>('24h');
  const [crossServiceAnalytics, setCrossServiceAnalytics] = useState<OperationsCrossServiceAnalytics | null>(null);
  const [incidentAnalytics, setIncidentAnalytics] = useState<OperationsIncidentAnalytics | null>(null);
  const [alertAnalytics, setAlertAnalytics] = useState<OperationsAlertAnalytics | null>(null);
  const [jobAnalytics, setJobAnalytics] = useState<OperationsJobAnalytics | null>(null);

  // Synchronization & Freshness
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [environment, setEnvironment] = useState<string>('UNKNOWN');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Stale detection
  const isStale = useMemo(() => {
    if (!overview?.latest_collection_run?.started_at) return false;
    const diffMs = Date.now() - new Date(overview.latest_collection_run.started_at).getTime();
    return diffMs > 5 * 60 * 1000; // > 5 minutes
  }, [overview]);

  // Ref to cancel/guard race conditions
  const syncCounterRef = useRef(0);

  // Primary Fetch: Staged parallel loading
  const synchronizeOperations = async (showProgress = true) => {
    const currentSyncId = ++syncCounterRef.current;
    if (showProgress) setIsSyncing(true);
    setErrorBanner(null);

    try {
      // Stage 1: Critical Operational Overview & Incidents
      const [overviewRes, incidentsRes, servicesRes] = await Promise.all([
        client.invokeOperation<OperationsOverview>('overview'),
        client.getIncidents({ limit: 50 }).catch(() => ({ incidents: [], count: 0, summary: {} as any })),
        client.getServices().catch(() => []),
      ]);

      if (currentSyncId !== syncCounterRef.current) return; // Prevent race condition overwrite

      setOverview(overviewRes.data);
      setEnvironment(overviewRes.meta?.environment || 'UNKNOWN');
      setIncidents(incidentsRes.incidents || []);
      setServices(servicesRes || []);
      setLastFetchedAt(new Date());

      // If this was initial load, drop the initial skeleton
      if (initialLoading) setInitialLoading(false);

      // Stage 2: Infrastructure Telemetry, Probes, Jobs & Metrics
      const [probesRes, metricsRes, jobsRes, runsRes] = await Promise.all([
        client.getHealthProbes().catch(() => []),
        client.getMetrics().catch(() => []),
        client.getJobs().catch(() => []),
        client.getJobRuns().catch(() => []),
      ]);

      if (currentSyncId !== syncCounterRef.current) return;

      setProbes(probesRes || []);
      setMetrics(metricsRes || []);
      setJobs(jobsRes || []);
      setJobRuns(runsRes || []);

      // Stage 3: Projections & Metric History for Key Available Metrics
      if (metricsRes && metricsRes.length > 0) {
        const topMetrics = metricsRes.slice(0, 6);
        const projectionEntries = await Promise.all(
          topMetrics.map(async (m) => {
            const cacheKey = `${m.service_id}:${m.metric_key}`;
            try {
              const [proj, hist] = await Promise.all([
                client.getThresholdProjection(m.service_id, m.metric_key, undefined, selectedWindow).catch(() => null),
                client.getMetricHistory(m.service_id, m.metric_key, selectedWindow).catch(() => null),
              ]);
              return { cacheKey, proj, hist };
            } catch {
              return { cacheKey, proj: null, hist: null };
            }
          })
        );

        if (currentSyncId === syncCounterRef.current) {
          const newProjs: Record<string, OperationsThresholdProjectionResult> = {};
          const newHists: Record<string, OperationsMetricHistoryResult> = {};
          for (const item of projectionEntries) {
            if (item.proj) newProjs[item.cacheKey] = item.proj;
            if (item.hist) newHists[item.cacheKey] = item.hist;
          }
          setProjections((prev) => ({ ...prev, ...newProjs }));
          setHistories((prev) => ({ ...prev, ...newHists }));
        }
      }

      // Stage 4: Historical Analytics Rollups
      fetchHistoricalAnalytics(selectedWindow, currentSyncId);

    } catch (err: unknown) {
      if (currentSyncId === syncCounterRef.current) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[OperationsControlCenter] Sync failure:', err);
        setErrorBanner(`Failed to synchronize operational state: ${msg}`);
      }
    } finally {
      if (currentSyncId === syncCounterRef.current) {
        setIsSyncing(false);
        setInitialLoading(false);
      }
    }
  };

  // Fetch historical analytics for bounded window
  const fetchHistoricalAnalytics = async (window: OperationsAnalyticsWindow, syncId?: number) => {
    try {
      const [crossRes, incRes, alRes, jobRes] = await Promise.all([
        client.getAnalyticsOverview(window).catch(() => null),
        client.getIncidentAnalytics(window).catch(() => null),
        client.getAlertAnalytics(window).catch(() => null),
        client.getJobAnalytics(undefined, window).catch(() => null),
      ]);

      if (syncId && syncId !== syncCounterRef.current) return;

      setCrossServiceAnalytics(crossRes);
      setIncidentAnalytics(incRes);
      setAlertAnalytics(alRes);
      setJobAnalytics(jobRes);
    } catch (err: unknown) {
      console.error('[OperationsControlCenter] Historical analytics fetch failed:', err);
    }
  };

  // Initial load
  useEffect(() => {
    synchronizeOperations(true);
  }, []);

  // Bounded window change
  const handleWindowChange = (w: OperationsAnalyticsWindow) => {
    setSelectedWindow(w);
    fetchHistoricalAnalytics(w);
  };

  // Controlled 30-second background auto-refresh
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const interval = setInterval(() => {
      synchronizeOperations(false); // background sync without blocking
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, selectedWindow]);

  // Operational triggers
  const handleTriggerCollection = async () => {
    await client.triggerCollection();
    await synchronizeOperations(true);
  };

  const handleEvaluateAlerts = async () => {
    await client.evaluateAlerts();
    await synchronizeOperations(true);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      {/* Synchronization Bar, Freshness & Operational Actions */}
      <OperationsRefreshIndicator
        isSyncing={isSyncing}
        lastFetchedAt={lastFetchedAt}
        lastCollectionAt={overview?.latest_collection_run?.started_at || null}
        isStale={isStale}
        environment={environment}
        autoRefreshEnabled={autoRefreshEnabled}
        onToggleAutoRefresh={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
        onManualRefresh={() => synchronizeOperations(true)}
        onTriggerCollection={handleTriggerCollection}
        onEvaluateAlerts={handleEvaluateAlerts}
      />

      {/* Global Error Banner if sync failed */}
      {errorBanner && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={() => synchronizeOperations(true)}
            className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors flex items-center gap-1"
          >
            <RefreshCw size={12} />
            Retry Sync
          </button>
        </div>
      )}

      {/* SECTION 1: Top-Level Authoritative System Health Summary */}
      <OperationsSummaryCards
        overview={overview}
        loading={initialLoading}
      />

      {/* SECTION 2: Active Incidents & Investigation Surface (Top Urgency) */}
      <ActiveIncidentsList
        incidents={incidents}
        loading={initialLoading}
        client={client}
        onRefreshIncidents={() => synchronizeOperations(false)}
      />

      {/* SECTION 3: Service Health & Infrastructure Probes */}
      <ServiceHealthGrid
        services={services}
        probes={probes}
        loading={initialLoading}
      />

      {/* SECTION 4: Operational Metrics, Trends & Threshold Projections */}
      <KeyMetricsPanel
        metrics={metrics}
        projections={projections}
        histories={histories}
        loading={initialLoading}
      />

      {/* SECTION 5: Scheduled Maintenance Jobs Telemetry */}
      <OperationsJobTable
        jobs={jobs}
        runs={jobRuns}
        loading={initialLoading}
      />

      {/* SECTION 6: Historical Operations & Rollup Analytics */}
      <HistoricalAnalyticsPanel
        selectedWindow={selectedWindow}
        onChangeWindow={handleWindowChange}
        incidentAnalytics={incidentAnalytics}
        alertAnalytics={alertAnalytics}
        jobAnalytics={jobAnalytics}
        crossServiceAnalytics={crossServiceAnalytics}
        loading={isSyncing && !crossServiceAnalytics}
      />

      {/* SECTION 7: Operational Notifications & Escalation Control */}
      <NotificationCenterPanel
        client={client}
        overview={overview?.notifications_summary}
      />

      {/* SECTION 8: Safe Operational Remediation & Runbooks */}
      <RemediationCenterPanel
        client={client}
        incidents={incidents}
        onRefresh={() => synchronizeOperations(false)}
      />

      {/* SECTION 9: Reliability, Capacity & Production Readiness Governance */}
      <GovernanceCenterPanel
        client={client}
        onRefresh={() => synchronizeOperations(false)}
      />
    </div>
  );
};

export default OperationsControlCenter;

