// lpu-events-admin/src/components/superadmin/monitoring/sections/SeoHealthPanel.tsx
// Section E: Google Search Console SEO Health Panel (MON-004 / MON-008 Stage 13)

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  MousePointerClick,
  Eye,
  Percent,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { MonitoringApiClient } from '../utils/MonitoringApiClient.ts';
import type { GscOverviewData } from '../types.ts';

export const SeoHealthPanel: React.FC = () => {
  const [data, setData] = useState<GscOverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<number>(28);

  const loadData = useCallback(async (selectedDays: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await MonitoringApiClient.getGscOverview(selectedDays);
      setData(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve Search Console data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(days);
  }, [days, loadData]);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                SEO & Google Search Console
              </h2>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                Section E
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Organic search discovery, performance trends, and indexing telemetry for lpuevents.live
            </p>
          </div>
        </div>

        {/* Controls: Days filter + Refresh + Direct Console Deep Link */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-zinc-100 dark:bg-white/5 rounded-xl p-1 border border-zinc-200/80 dark:border-white/10">
            {[7, 28, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  days === d
                    ? 'bg-white dark:bg-white/10 text-purple-600 dark:text-purple-400 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void loadData(days)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all disabled:opacity-50"
            title="Refresh search performance metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <a
            href={data?.deepLink || 'https://search.google.com/search-console'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-all"
          >
            <span>Open Full Google Search Console Dashboard</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Mandatory Platform Delay Invariant Notice (MON-004 §7.2) */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 text-purple-900 dark:text-purple-200">
        <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-purple-950 dark:text-purple-100">
            Google Search Console Latency Invariant (48–72h Inherent Delay)
          </p>
          <p className="text-purple-800 dark:text-purple-300">
            {data?.delayNotice || 'Note: Search Console performance data reflects search activity from 2–3 days ago (Google platform delay).'}
          </p>
          {data?.dateRange && (
            <p className="font-mono text-[11px] text-purple-700 dark:text-purple-300/80 flex items-center gap-1 mt-1">
              <Calendar className="w-3 h-3" />
              Active Window: {data.dateRange.startDate} to {data.dateRange.endDate} ({days} days)
            </p>
          )}
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Error loading Search Console telemetry: {error}</span>
        </div>
      )}

      {/* Metric KPI Cards (4 Primary Search Signals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Clicks */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 space-y-2">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold">Total Clicks</span>
            <MousePointerClick className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white font-mono">
            {loading ? '...' : (data?.clicks ?? 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Visitors redirected from Google Search results
          </p>
        </div>

        {/* Total Impressions */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 space-y-2">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold">Total Impressions</span>
            <Eye className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white font-mono">
            {loading ? '...' : (data?.impressions ?? 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Search result impressions across student keywords
          </p>
        </div>

        {/* Average CTR */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 space-y-2">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold">Average CTR</span>
            <Percent className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white font-mono">
            {loading ? '...' : `${data?.ctr ?? 0}%`}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Click-through rate (Clicks / Impressions)
          </p>
        </div>

        {/* Average Position */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 space-y-2">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold">Average Position</span>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-white font-mono">
            {loading ? '...' : (data?.position ? data.position.toFixed(1) : 'N/A')}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Top average rank in Google Search results
          </p>
        </div>
      </div>

      {/* Quota Architecture & Sitemap Indexing Documentation Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
              Google Search Console API Scoped Quota Governance
            </h3>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
            MON-004 §7.1 Compliance
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-white/10 text-zinc-500 dark:text-zinc-400">
                <th className="py-2 px-3 font-semibold">Resource / Scope</th>
                <th className="py-2 px-3 font-semibold">Quota Scope</th>
                <th className="py-2 px-3 font-semibold">Documented Google Limit</th>
                <th className="py-2 px-3 font-semibold">LPU Events Consumption</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/5 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
              <tr>
                <td className="py-2.5 px-3 font-sans font-medium text-zinc-900 dark:text-white">
                  Search Analytics
                </td>
                <td className="py-2.5 px-3">Per Site &amp; User</td>
                <td className="py-2.5 px-3">1,200 QPM / site; 30,000,000 QPD / project</td>
                <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                  &lt; 50 QPD (On manual tab activation only)
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-sans font-medium text-zinc-900 dark:text-white">
                  URL Inspection
                </td>
                <td className="py-2.5 px-3">Per Site &amp; User</td>
                <td className="py-2.5 px-3">2,000 QPD / site; 600 QPM / site; 10M QPD / project</td>
                <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                  On-demand deep link fallback
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-sans font-medium text-zinc-900 dark:text-white">
                  Sitemaps &amp; Other
                </td>
                <td className="py-2.5 px-3">Per User &amp; Project</td>
                <td className="py-2.5 px-3">20 QPS / user; 100,000,000 QPD / project</td>
                <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                  Static sitemap.xml edge-routed via Cloudflare
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Edge Sitemaps Routing Notice */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200/60 dark:border-white/5 text-xs">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Edge Sitemap Feed: <code className="font-mono text-zinc-900 dark:text-white font-semibold">https://lpuevents.live/sitemap.xml</code>
            </span>
          </div>
          <a
            href="https://lpuevents.live/sitemap.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-semibold text-[11px]"
          >
            <span>View Live Sitemap</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};

