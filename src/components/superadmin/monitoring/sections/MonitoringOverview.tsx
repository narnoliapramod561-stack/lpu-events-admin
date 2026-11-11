// lpu-events-admin/src/components/superadmin/monitoring/sections/MonitoringOverview.tsx
// Section A: Monitoring Overview Dashboard (MON-004 / MON-008 Stage 8)

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Activity,
  ShieldAlert,
  Server,
  Radio,
  Clock,
} from 'lucide-react';
import { MonitoringApiClient } from '../utils/MonitoringApiClient.ts';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { OccurrenceDisclaimer } from '../components/OccurrenceDisclaimer.tsx';
import type {
  MonitoringOverviewPayload,
  NormalizedMonitorStatus,
} from '../types.ts';

const STALENESS_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

interface MonitoringOverviewProps {
  onNavigateToSection?: (sectionId: string) => void;
}

export const MonitoringOverview: React.FC<MonitoringOverviewProps> = ({ onNavigateToSection }) => {
  const [data, setData] = useState<MonitoringOverviewPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number>(Date.now());
  const [now, setNow] = useState<number>(Date.now());

  // Clock tick to compute relative staleness
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const loadOverview = useCallback(async (isManualRefresh: boolean = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const result = await MonitoringApiClient.getOverview();
      setData(result);
      setLastFetchedAt(Date.now());
    } catch (err: any) {
      console.error('Failed to load monitoring overview:', err);
      setError(err?.message || 'Failed to retrieve platform monitoring overview.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOverview(false);
  }, [loadOverview]);

  // Staleness computation
  const ageMs = now - lastFetchedAt;
  const isStale = ageMs > STALENESS_THRESHOLD_MS;
  const ageMinutes = Math.floor(ageMs / 60000);

  const effectivePlatformStatus = isStale
    ? 'STALE'
    : (data?.platformStatus || 'UNKNOWN');

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Aggregating telemetry, health probes, and provider diagnostics...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header / Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
        <div>
          <h2 className="text-xl font-black font-['Outfit'] tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-orange-500" />
            <span>Platform Monitoring Overview</span>
          </h2>
          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Freshness: {ageMinutes === 0 ? 'Just now' : `${ageMinutes}m ago`} (
              {new Date(lastFetchedAt).toLocaleTimeString()})
            </span>
            {isStale && (
              <span className="font-bold text-amber-600 dark:text-amber-400">
                [Stale Data Warning]
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadOverview(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-orange-500 hover:bg-orange-600 active:scale-95 text-white shadow-xs transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
        </button>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Monitoring Retrieval Notice</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Strict Staleness Invariant Warning */}
      {isStale && (
        <div className="p-4 rounded-xl bg-zinc-500/10 border border-zinc-500/20 text-zinc-700 dark:text-zinc-300 text-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
            <span>
              <strong>Stale Data Invariant:</strong> Data was fetched {ageMinutes} minutes ago. Green "Operational" status is suppressed until refreshed.
            </span>
          </div>
          <button
            type="button"
            onClick={() => loadOverview(true)}
            className="px-3 py-1 text-xs font-bold rounded-md bg-zinc-800 text-white hover:bg-zinc-700 shrink-0"
          >
            Refresh Now
          </button>
        </div>
      )}

      {/* Primary 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Platform Status */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            <span>Platform Status</span>
            <Activity className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-3">
            <StatusBadge status={effectivePlatformStatus} size="lg" />
          </div>
          <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            {effectivePlatformStatus === 'OPERATIONAL'
              ? 'All probed production surfaces healthy.'
              : isStale
              ? 'Telemetry refresh required for live verdict.'
              : 'Service degradation or open issues detected.'}
          </p>
        </div>

        {/* 2. Active Issues */}
        <div
          onClick={() => onNavigateToSection?.('inbox')}
          className="p-5 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 shadow-xs flex flex-col justify-between hover:border-orange-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            <span>Active Issues</span>
            <ShieldAlert className="w-4 h-4 text-zinc-400 group-hover:text-orange-500 transition-colors" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black font-['Outfit'] text-zinc-900 dark:text-white">
              {data?.activeIssuesCount ?? 0}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">tracked</span>
          </div>
          <p className="mt-3 text-[11px] text-orange-600 dark:text-orange-400 font-semibold group-hover:underline">
            View Error Inbox →
          </p>
        </div>

        {/* 3. Critical Issues (P0) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            <span>Critical Issues</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-3xl font-black font-['Outfit'] ${
                (data?.criticalIssuesCount ?? 0) > 0 ? 'text-rose-500' : 'text-zinc-900 dark:text-white'
              }`}
            >
              {data?.criticalIssuesCount ?? 0}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">P0 Severity</span>
          </div>
          <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            {(data?.criticalIssuesCount ?? 0) === 0
              ? 'Zero active P0 blocking errors.'
              : 'Requires immediate triage.'}
          </p>
        </div>

        {/* 4. Exceptions (24h) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            <span>Exceptions (24h)</span>
            <Server className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black font-['Outfit'] text-zinc-900 dark:text-white">
              {data?.exceptions24hCount ?? 0}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">occurrences</span>
          </div>
          <OccurrenceDisclaimer className="mt-3" variant="compact" />
        </div>
      </div>

      {/* Split Grid: Service Availability vs Provider Connectivity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Service Availability (UptimeRobot) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black font-['Outfit'] uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-500" />
              <span>Service Availability (UptimeRobot)</span>
            </h3>
            {onNavigateToSection && (
              <button
                type="button"
                onClick={() => onNavigateToSection('services')}
                className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline"
              >
                All Monitors →
              </button>
            )}
          </div>

          <div className="space-y-3">
            {(data?.monitors || []).length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
                No active monitors returned from UptimeRobot.
              </div>
            ) : (
              (data?.monitors || []).map((m: NormalizedMonitorStatus) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/5 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {m.name}
                      </span>
                      <StatusBadge status={m.status} size="sm" />
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {m.url.replace('admin.lpuevents.live', 'www.lpueventsadmin.live')}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200">
                      {m.uptimeRatio30d !== null ? `${m.uptimeRatio30d}% (30d)` : 'Unavailable'}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {m.averageResponseTimeMs !== null ? `${m.averageResponseTimeMs}ms` : 'Latency: Unavailable'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">
            * Metric Truthfulness: Missing ratios or latency render as 'Unavailable', never defaulted to 100% or 0ms.
          </p>
        </div>

        {/* Right: Provider API Connectivity */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black font-['Outfit'] uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-500" />
              <span>Provider API Connectivity</span>
            </h3>
          </div>

          <div className="space-y-3">
            {[
              {
                id: 'posthogIngestion',
                name: 'PostHog Ingestion API',
                desc: 'Client exception capture & event delivery',
                status: data?.providerConnectivity.posthogIngestion,
              },
              {
                id: 'posthogApi',
                name: 'PostHog Issues API',
                desc: 'Error Tracking REST queries & triage',
                status: data?.providerConnectivity.posthogApi,
              },
              {
                id: 'uptimeRobot',
                name: 'UptimeRobot v2 API',
                desc: 'Public availability & response time telemetry',
                status: data?.providerConnectivity.uptimeRobot,
              },
              {
                id: 'supabaseLogs',
                name: 'Supabase ClickHouse Logs API',
                desc: 'Edge function runtime & gateway logs',
                status: data?.providerConnectivity.supabaseLogs,
              },
              {
                id: 'googleSearchConsole',
                name: 'Google Search Console API',
                desc: 'Search analytics & sitemap indexing health',
                status: data?.providerConnectivity.googleSearchConsole,
              },
            ].map((provider) => {
              const isConnected = provider.status?.connected ?? false;
              return (
                <div
                  key={provider.id}
                  className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200/60 dark:border-white/5 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white">
                        {provider.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {provider.desc}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {provider.status?.latencyMs !== undefined && (
                      <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                        {provider.status.latencyMs}ms
                      </span>
                    )}
                    <StatusBadge
                      status={isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                      label={isConnected ? 'Connected' : 'Unavailable'}
                      size="sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Card: Recent Operational Incidents */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 shadow-xs space-y-4">
        <h3 className="text-sm font-black font-['Outfit'] uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-orange-500" />
          <span>Recent Operational Incidents (ops_incidents)</span>
        </h3>

        {(data?.recentIncidents || []).length === 0 ? (
          <div className="py-4 px-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>No active P0/P1 incidents detected. Operations Control Plane is stable.</span>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200/60 dark:divide-white/5">
            {data?.recentIncidents.map((inc) => (
              <div key={inc.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <span className="font-bold text-zinc-900 dark:text-white">{inc.title}</span>
                  <div className="flex items-center gap-2 mt-0.5 text-zinc-500">
                    <span>Severity: {inc.severity}</span>
                    <span>•</span>
                    <span>{new Date(inc.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <StatusBadge status={inc.status} size="sm" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
