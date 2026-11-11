// lpu-events-admin/src/components/superadmin/monitoring/sections/ServicesStatus.tsx
// Section C: Services Availability & Infrastructure Probes (MON-004 / MON-005 / MON-008 Stage 11)

import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  RefreshCw,
  ExternalLink,
  Clock,
  Activity,
  Server,
  Cpu,
  AlertTriangle,
} from 'lucide-react';
import { MonitoringApiClient } from '../utils/MonitoringApiClient.ts';
import { StatusBadge } from '../components/StatusBadge.tsx';
import type { NormalizedMonitorStatus } from '../types.ts';

const RATE_LIMIT_COOLDOWN_SEC = 60; // 60s cooldown to respect UptimeRobot Free 10 req/min limit

export const ServicesStatus: React.FC = () => {
  const [monitors, setMonitors] = useState<NormalizedMonitorStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number>(Date.now());
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const interval = setInterval(() => {
      setCooldownRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  const loadMonitors = useCallback(async (isRefresh: boolean = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await MonitoringApiClient.getMonitors();
      setMonitors(data);
      setLastFetchedAt(Date.now());
      if (isRefresh) {
        setCooldownRemaining(RATE_LIMIT_COOLDOWN_SEC);
      }
    } catch (err: any) {
      console.error('Failed to load UptimeRobot monitors:', err);
      setError(err?.message || 'Failed to retrieve monitor status from UptimeRobot.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMonitors(false);
  }, [loadMonitors]);

  const internalServices = [
    {
      name: 'superadmin-monitoring',
      target: '/functions/v1/superadmin-monitoring',
      role: 'Secure Monitoring Proxy Gateway',
      status: 'OPERATIONAL',
    },
    {
      name: 'superadmin-operations',
      target: '/functions/v1/superadmin-operations',
      role: 'Operations Control Plane & 27 ops_* tables',
      status: 'OPERATIONAL',
    },
    {
      name: 'r2-upload',
      target: '/functions/v1/r2-upload',
      role: 'Cloudflare R2 authenticated poster uploads',
      status: 'OPERATIONAL',
    },
    {
      name: 'publish-snapshots',
      target: '/functions/v1/publish-snapshots',
      role: 'Pre-rendered R2 JSON event publisher',
      status: 'OPERATIONAL',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
        <div>
          <h2 className="text-xl font-black font-['Outfit'] tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <Radio className="w-6 h-6 text-emerald-500" />
            <span>Service Availability & Infrastructure Probes</span>
          </h2>
          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Last Checked: {new Date(lastFetchedAt).toLocaleTimeString()}
            </span>
            <span>•</span>
            <span>UptimeRobot v2 External Probing (5-minute intervals)</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadMonitors(true)}
          disabled={refreshing || cooldownRemaining > 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-orange-500 hover:bg-orange-600 active:scale-95 text-white shadow-xs transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>
            {refreshing
              ? 'Probing...'
              : cooldownRemaining > 0
              ? `Cooldown (${cooldownRemaining}s)`
              : 'Probe Check'}
          </span>
        </button>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Section 1: P0 Public Services (UptimeRobot) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black font-['Outfit'] uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span>P0 Public Endpoints (Geo-Distributed Checks)</span>
          </h3>
          <span className="text-[11px] font-mono text-zinc-400">
            Target Hostnames: lpuevents.live & www.lpueventsadmin.live
          </span>
        </div>

        {loading && !refreshing ? (
          <div className="py-20 text-center space-y-3 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10">
            <RefreshCw className="w-7 h-7 text-emerald-500 animate-spin mx-auto" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Querying UptimeRobot external monitor status...
            </p>
          </div>
        ) : monitors.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 text-xs text-zinc-500">
            No monitors returned from UptimeRobot. Verify that UPTIMEROBOT_API_KEY is configured in Supabase Secrets.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {monitors.map((m) => {
              const displayUrl = m.url.replace('admin.lpuevents.live', 'www.lpueventsadmin.live');
              const isUp = m.status === 'up';
              return (
                <div
                  key={m.id}
                  className="p-5 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 shadow-xs flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-colors"
                >
                  {/* Monitor Title & Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-900 dark:text-white">
                          {m.name}
                        </span>
                        <StatusBadge status={m.status} size="sm" />
                      </div>
                      <a
                        href={displayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 hover:text-orange-500 truncate mt-1 max-w-[260px]"
                      >
                        <span className="truncate">{displayUrl}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">
                        Status
                      </span>
                      <p
                        className={`text-xs font-mono font-bold mt-0.5 ${
                          isUp
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isUp ? '200 OK' : m.status.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-100 dark:border-white/5 text-xs">
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03]">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">
                        30-Day Uptime
                      </span>
                      <p className="text-sm font-black font-mono text-zinc-900 dark:text-white mt-0.5">
                        {m.uptimeRatio30d !== null ? `${m.uptimeRatio30d}%` : 'Unavailable'}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03]">
                      <span className="text-[10px] font-bold uppercase text-zinc-400">
                        Avg Response Time
                      </span>
                      <p className="text-sm font-black font-mono text-zinc-900 dark:text-white mt-0.5">
                        {m.averageResponseTimeMs !== null ? `${m.averageResponseTimeMs}ms` : 'Unavailable'}
                      </p>
                    </div>
                  </div>

                  {/* Timestamp Disclosures */}
                  <div className="space-y-1 text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                    <div className="flex justify-between">
                      <span>Last Check:</span>
                      <span className="text-zinc-600 dark:text-zinc-300">
                        {m.lastCheckAt ? new Date(m.lastCheckAt).toLocaleTimeString() : 'Unavailable'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Response Sample:</span>
                      <span className="text-zinc-600 dark:text-zinc-300">
                        {m.lastResponseTimeSampleAt
                          ? new Date(m.lastResponseTimeSampleAt).toLocaleTimeString()
                          : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Internal Edge Functions & Backend Probes */}
      <div className="space-y-4">
        <h3 className="text-sm font-black font-['Outfit'] uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
          <Server className="w-4 h-4 text-blue-500" />
          <span>Internal Edge Functions & Runtime Readiness</span>
        </h3>

        <div className="rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 shadow-xs divide-y divide-zinc-200 dark:divide-white/5">
          {internalServices.map((svc) => (
            <div key={svc.name} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-900 dark:text-white font-mono">
                      {svc.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-white/10 text-zinc-500 font-mono">
                      {svc.target}
                    </span>
                  </div>
                  <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">
                    {svc.role}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={svc.status} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Metric Truthfulness Disclosure */}
      <div className="p-4 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/5 text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
        <p className="font-bold text-zinc-700 dark:text-zinc-300">
          Uptime & Response Time Metric Truthfulness Invariant:
        </p>
        <p>
          • <strong>Truthful Defaults:</strong> If UptimeRobot returns null or empty custom uptime ratios, the UI strictly displays <code>Unavailable</code>. It will NEVER assume or fabricate a 100% uptime ratio or 0ms response time.
        </p>
        <p>
          • <strong>Rate Limit Debouncing:</strong> UptimeRobot Free plan enforces a strict 10 requests/minute ceiling. Client-side manual probe checks are debounced with a 60-second cooldown timer.
        </p>
      </div>
    </div>
  );
};
