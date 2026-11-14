// lpu-events-admin/src/components/superadmin/monitoring/sections/BackendLogsPanel.tsx
// Section D: Backend ClickHouse Logs Explorer (MON-004 / MON-006 / MON-008 Stage 12)

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCode2,
  Search,
  RefreshCw,
  Clock,
  Code2,
  AlertCircle,
} from 'lucide-react';
import { MonitoringApiClient } from '../utils/MonitoringApiClient.ts';
import { LogViewerTable } from '../components/LogViewerTable.tsx';
import type { SupabaseLogRecord } from '../types.ts';

interface BackendLogsPanelProps {
  initialCorrelationId?: string;
}

type LogSourceOption =
  | 'function_logs'
  | 'function_edge_logs'
  | 'edge_logs'
  | 'postgres_logs'
  | 'auth_logs';

export const BackendLogsPanel: React.FC<BackendLogsPanelProps> = ({
  initialCorrelationId = '',
}) => {
  const [source, setSource] = useState<LogSourceOption>(
    initialCorrelationId ? 'function_logs' : 'edge_logs'
  );
  const [windowHours, setWindowHours] = useState<number>(1);
  const [filterText, setFilterText] = useState<string>(initialCorrelationId);
  const [debouncedFilterText, setDebouncedFilterText] = useState<string>(initialCorrelationId);
  const [limit, setLimit] = useState<number>(100);
  const [showSql, setShowSql] = useState<boolean>(false);

  const [logs, setLogs] = useState<SupabaseLogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [queryDurationMs, setQueryDurationMs] = useState<number | null>(null);

  // Debounce search input to avoid query flood on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilterText(filterText);
    }, 400);
    return () => clearTimeout(timer);
  }, [filterText]);

  // Automatically sync if initialCorrelationId changes from drawer cross-navigation
  useEffect(() => {
    if (initialCorrelationId) {
      setSource('function_logs');
      setFilterText(initialCorrelationId);
      setDebouncedFilterText(initialCorrelationId);
    }
  }, [initialCorrelationId]);

  const constructQueryDates = useCallback(() => {
    const end = new Date();
    // Enforce 24 hour retention constraint
    const clampedHours = Math.min(windowHours, 24);
    const start = new Date(end.getTime() - clampedHours * 60 * 60 * 1000);
    return {
      isoStart: start.toISOString(),
      isoEnd: end.toISOString(),
    };
  }, [windowHours]);

  const generatePreviewSql = useCallback((): string => {
    const { isoStart, isoEnd } = constructQueryDates();
    const safeSearch = filterText.replace(/[';\\]/g, '').slice(0, 100).trim();
    const correlationFilter = safeSearch
      ? `AND event_message LIKE '%${safeSearch}%'`
      : '';

    return `SELECT timestamp, event_message\nFROM logs\nWHERE source = '${source}'\n  ${correlationFilter}\nORDER BY timestamp DESC\nLIMIT ${limit}\n\n-- ClickHouse Time Range Parameters (passed via API):\n-- iso_timestamp_start: ${isoStart}\n-- iso_timestamp_end:   ${isoEnd}`;
  }, [constructQueryDates, filterText, source, limit]);

  const executeQuery = useCallback(async (overrideFilter?: string) => {
    setLoading(true);
    setError(null);
    const startTimer = performance.now();

    const { isoStart, isoEnd } = constructQueryDates();
    const activeFilter = overrideFilter !== undefined ? overrideFilter : debouncedFilterText;

    try {
      const records = await MonitoringApiClient.queryLogs({
        source,
        iso_timestamp_start: isoStart,
        iso_timestamp_end: isoEnd,
        correlation_id: activeFilter.trim() || undefined,
        limit,
      });

      setLogs(records);
      setQueryDurationMs(Math.round(performance.now() - startTimer));
    } catch (err: any) {
      console.error('Failed to query ClickHouse logs:', err);
      setError(err?.message || 'Failed to execute logs query on Supabase ClickHouse engine.');
    } finally {
      setLoading(false);
    }
  }, [source, constructQueryDates, debouncedFilterText, limit]);

  // Execute query on mount or when debounced filter, source, or limit changes
  useEffect(() => {
    executeQuery();
  }, [executeQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
        <div>
          <h2 className="text-xl font-black font-['Outfit'] tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <FileCode2 className="w-6 h-6 text-blue-500" />
            <span>Backend ClickHouse Logs Explorer</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Direct on-demand ClickHouse queries across Supabase Edge Function runtimes and API Gateway logs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => executeQuery(filterText)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-xs transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Executing Query...' : 'Run Query'}</span>
        </button>
      </div>

      {/* Free Tier 24h Retention Notice */}
      <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-800 dark:text-blue-300 flex items-center gap-3">
        <Clock className="w-4 h-4 text-blue-500 shrink-0" />
        <span className="leading-relaxed">
          <strong>24-Hour Free Tier Invariant:</strong> Hosted Supabase log retention is strictly bounded to the last 24 hours. Query time windows are capped at $\le 24$ hours. Older records expire automatically from the ClickHouse cluster.
        </span>
      </div>

      {/* Query Controls Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Source Dropdown */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Log Source
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as LogSourceOption)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
            >
              <option value="function_logs">Edge Function Runtime Logs (event_message)</option>
              <option value="function_edge_logs">Function Invocation Logs (log_attributes)</option>
              <option value="edge_logs">API Gateway HTTP Logs (edge_logs)</option>
              <option value="postgres_logs">Postgres Database Logs (postgres_logs)</option>
              <option value="auth_logs">Supabase Auth Logs (auth_logs)</option>
            </select>
          </div>

          {/* Time Window */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Time Window (Max 24h)
            </label>
            <select
              value={windowHours}
              onChange={(e) => setWindowHours(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
            >
              <option value={1}>Last 1 Hour</option>
              <option value={3}>Last 3 Hours</option>
              <option value={6}>Last 6 Hours</option>
              <option value={12}>Last 12 Hours</option>
              <option value={24}>Last 24 Hours (Full Limit)</option>
            </select>
          </div>

          {/* Limit */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Row Limit
            </label>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:border-blue-500"
            >
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={250}>250 rows</option>
            </select>
          </div>

          {/* Correlation ID / Search Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Search Filter / Correlation ID
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter by correlation ID or text..."
                className="w-full pl-9 pr-3 py-2 text-xs font-mono rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* SQL Preview Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-white/5 text-xs">
          <button
            type="button"
            onClick={() => setShowSql(!showSql)}
            className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-mono text-[11px]"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{showSql ? 'Hide Generated SQL' : 'View ClickHouse SQL Query'}</span>
          </button>

          {queryDurationMs !== null && (
            <span className="text-[11px] font-mono text-zinc-400">
              Query returned {logs.length} rows in {queryDurationMs}ms
            </span>
          )}
        </div>

        {/* SQL Viewer Box */}
        {showSql && (
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 font-mono text-[11px] space-y-1 overflow-x-auto">
            <div className="text-[10px] uppercase font-bold text-zinc-500">
              ClickHouse Query String:
            </div>
            <pre className="text-blue-300">{generatePreviewSql()}</pre>
          </div>
        )}
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Log Records Results */}
      <LogViewerTable logs={logs} highlightQuery={filterText} />
    </div>
  );
};
