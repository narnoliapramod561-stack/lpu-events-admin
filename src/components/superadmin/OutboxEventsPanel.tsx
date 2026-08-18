import React, { useState, useEffect, useCallback, useRef } from 'react';
import { lpuClient } from '../../supabase';
import {
  RotateCw,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Flame,
  Check,
  Code2,
  Zap,
  Trash2,
  ChevronDown,
  ChevronRight,
  Radio,
  Loader2,
  ArrowDownToLine,
  XCircle,
  Timer,
  Package,
  Inbox
} from 'lucide-react';

type OutboxEvent = {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: any;
  status: string;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
  locked_at: string | null;
  locked_by: string | null;
  available_at: string | null;
};

type StatusFilter = 'ALL' | 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
type TypeFilter = 'ALL' | 'CACHE_INVALIDATION' | 'EMAIL_NOTIFICATION';

const STATUS_CONFIG: Record<string, { color: string; bg: string; darkBg: string; icon: React.ReactNode; label: string }> = {
  PENDING:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', darkBg: 'rgba(245,158,11,0.18)', icon: <Clock size={14} />, label: 'Pending' },
  PROCESSING: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', darkBg: 'rgba(59,130,246,0.18)', icon: <Loader2 size={14} className="animate-spin" />, label: 'Processing' },
  PROCESSED:  { color: '#10b981', bg: 'rgba(16,185,129,0.12)', darkBg: 'rgba(16,185,129,0.18)', icon: <Check size={14} />, label: 'Processed' },
  FAILED:     { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  darkBg: 'rgba(239,68,68,0.18)',  icon: <XCircle size={14} />, label: 'Failed' },
};

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  CACHE_INVALIDATION: { label: 'Cache Invalidation', color: '#8b5cf6' },
  EMAIL_NOTIFICATION: { label: 'Email Notification', color: '#06b6d4' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export const OutboxEventsPanel: React.FC = () => {
  const [events, setEvents] = useState<OutboxEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchOutbox = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data, error } = await lpuClient.getOutboxEvents({
        status: statusFilter,
        eventType: typeFilter
      });
      if (error) throw error;
      setEvents(data || []);
      setLastRefreshed(new Date());
    } catch (err: any) {
      showToast('error', 'Failed to load outbox queue: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, typeFilter, showToast]);

  useEffect(() => {
    fetchOutbox();
  }, [fetchOutbox]);

  // Auto-refresh logic
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => fetchOutbox(true), 10000);
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [autoRefresh, fetchOutbox]);

  const handleRetry = async (eventId: string) => {
    setRetryingIds(prev => new Set(prev).add(eventId));
    try {
      const { data: res, error: rpcErr } = await lpuClient.retryOutboxEvent(eventId);
      if (rpcErr) throw rpcErr;
      if (res?.error) throw new Error(res.error.message || 'Retry failed');
      showToast('success', `Event ${eventId.slice(0, 8)}… reset to PENDING for re-processing.`);
      await fetchOutbox(true);
    } catch (err: any) {
      showToast('error', 'Retry failed: ' + (err.message || ''));
    } finally {
      setRetryingIds(prev => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  };

  const handleCleanup = async () => {
    setCleaningUp(true);
    try {
      const { error } = await lpuClient.cleanupProcessedOutboxEvents(7);
      if (error) throw error;
      showToast('success', 'Processed events older than 7 days have been purged.');
      await fetchOutbox(true);
    } catch (err: any) {
      showToast('error', 'Cleanup failed: ' + (err.message || ''));
    } finally {
      setCleaningUp(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Counts
  const allEvents = events; // already filtered by API
  const counts = {
    pending: allEvents.filter(e => e.status === 'PENDING').length,
    processing: allEvents.filter(e => e.status === 'PROCESSING').length,
    processed: allEvents.filter(e => e.status === 'PROCESSED').length,
    failed: allEvents.filter(e => e.status === 'FAILED').length,
  };
  const totalCount = allEvents.length;

  const statusTabs: { key: StatusFilter; label: string; count: number; color: string }[] = [
    { key: 'ALL', label: 'All', count: totalCount, color: '#ff6b00' },
    { key: 'PENDING', label: 'Pending', count: counts.pending, color: '#f59e0b' },
    { key: 'PROCESSING', label: 'In-Flight', count: counts.processing, color: '#3b82f6' },
    { key: 'PROCESSED', label: 'Delivered', count: counts.processed, color: '#10b981' },
    { key: 'FAILED', label: 'Failed', count: counts.failed, color: '#ef4444' },
  ];

  return (
    <div className="space-y-7 select-text animate-fadeIn">

      {/* ──────── HEADER ──────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
              Transactional Outbox
            </span>
            {autoRefresh && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 animate-pulse">
                <Radio size={9} />
                Live
              </span>
            )}
            <span className="text-xs text-[#5a4136] dark:text-[#ffb693]">
              Last polled {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <h2 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2.5">
            <Zap size={28} className="text-[#ff6b00]" />
            <span>Outbox Dispatcher Queue</span>
          </h2>
          <p className="text-sm text-[#5a4136] dark:text-[#ffb693] mt-1">
            Monitor asynchronous cache invalidation events, email notifications, and retry failed dispatches.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Auto-Refresh Toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              autoRefresh
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                : 'bg-white dark:bg-[#261812] border-[#e2bfb0] dark:border-[#5a4136] text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00] hover:border-[#ff6b00]'
            }`}
          >
            <Radio size={13} />
            <span>{autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={() => fetchOutbox(true)}
            disabled={refreshing}
            className="p-2 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00] hover:border-[#ff6b00] transition-colors cursor-pointer bg-white dark:bg-[#261812] shadow-xs"
            title="Refresh Queue"
          >
            <RotateCw size={16} className={refreshing ? 'animate-spin text-[#ff6b00]' : ''} />
          </button>

          {/* Cleanup */}
          <button
            type="button"
            onClick={handleCleanup}
            disabled={cleaningUp}
            className="px-3.5 py-2 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-bold text-[#5a4136] dark:text-[#ffb693] hover:text-red-500 hover:border-red-400 transition-colors cursor-pointer bg-white dark:bg-[#261812] shadow-xs flex items-center gap-1.5"
            title="Purge processed events older than 7 days"
          >
            <Trash2 size={14} className={cleaningUp ? 'animate-pulse' : ''} />
            <span>Purge Old</span>
          </button>
        </div>
      </div>

      {/* ──────── TOAST ──────── */}
      {toast && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-semibold border shadow-sm animate-fadeIn transition-all ${
          toast.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}

      {/* ──────── KPI BENTO CARDS ──────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending */}
        <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-amber-500/5 dark:bg-amber-500/10 -translate-y-8 translate-x-8 group-hover:scale-125 transition-transform duration-500" />
          <div className="flex justify-between items-start relative">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-500">
              <Clock size={20} />
            </div>
            {counts.pending > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Queued
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mt-4">Pending Queue</p>
          <h3 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6] mt-1">{counts.pending}</h3>
          <p className="text-[11px] text-[#5a4136]/60 dark:text-[#ffb693]/60 mt-1">Awaiting worker pickup</p>
        </div>

        {/* Processing */}
        <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-blue-500/5 dark:bg-blue-500/10 -translate-y-8 translate-x-8 group-hover:scale-125 transition-transform duration-500" />
          <div className="flex justify-between items-start relative">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-500">
              <Loader2 size={20} className={counts.processing > 0 ? 'animate-spin' : ''} />
            </div>
            {counts.processing > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Active
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mt-4">In-Flight</p>
          <h3 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6] mt-1">{counts.processing}</h3>
          <p className="text-[11px] text-[#5a4136]/60 dark:text-[#ffb693]/60 mt-1">Actively executing</p>
        </div>

        {/* Processed */}
        <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 -translate-y-8 translate-x-8 group-hover:scale-125 transition-transform duration-500" />
          <div className="flex justify-between items-start relative">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-500">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <p className="text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mt-4">Delivered</p>
          <h3 className="text-3xl font-extrabold font-['Outfit'] text-emerald-600 dark:text-emerald-400 mt-1">{counts.processed}</h3>
          <p className="text-[11px] text-[#5a4136]/60 dark:text-[#ffb693]/60 mt-1">Successfully dispatched</p>
        </div>

        {/* Failed */}
        <div className={`bg-white dark:bg-[#261812] border rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow ${
          counts.failed > 0 ? 'border-red-300 dark:border-red-800' : 'border-[#e2bfb0] dark:border-[#5a4136]'
        }`}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-red-500/5 dark:bg-red-500/10 -translate-y-8 translate-x-8 group-hover:scale-125 transition-transform duration-500" />
          <div className="flex justify-between items-start relative">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-500">
              <Flame size={20} />
            </div>
            {counts.failed > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                <AlertCircle size={10} />
                Action Needed
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mt-4">Dead Letter</p>
          <h3 className="text-3xl font-extrabold font-['Outfit'] text-red-600 dark:text-red-400 mt-1">{counts.failed}</h3>
          <p className="text-[11px] text-[#5a4136]/60 dark:text-[#ffb693]/60 mt-1">Actionable retry errors</p>
        </div>
      </div>

      {/* ──────── QUEUE TABLE ──────── */}
      <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl shadow-sm overflow-hidden">
        {/* Table Header Bar */}
        <div className="px-5 py-4 border-b border-[#e2bfb0] dark:border-[#5a4136] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2">
              <Package size={18} className="text-[#ff6b00]" />
              Queue Messages
            </h3>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-100 text-[#ff6b00] dark:bg-orange-950 dark:text-orange-300">
              {totalCount} items
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter Pills */}
            <div className="flex items-center bg-[#fef5f0] dark:bg-[#1f1510] border border-[#e2bfb0] dark:border-[#5a4136] rounded-xl p-1 text-xs font-bold">
              {statusTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    statusFilter === tab.key
                      ? 'bg-[#ff6b00] text-white shadow-xs'
                      : 'text-[#5a4136] dark:text-[#ffb693] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26]'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && statusFilter !== tab.key && (
                    <span className="text-[9px] font-black px-1 py-px rounded-full" style={{ backgroundColor: tab.color + '22', color: tab.color }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Type Filter */}
            <div className="flex items-center bg-[#fef5f0] dark:bg-[#1f1510] border border-[#e2bfb0] dark:border-[#5a4136] rounded-xl p-1 text-xs font-bold">
              {[
                { key: 'ALL' as TypeFilter, label: 'All Types' },
                { key: 'CACHE_INVALIDATION' as TypeFilter, label: 'Cache' },
                { key: 'EMAIL_NOTIFICATION' as TypeFilter, label: 'Email' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setTypeFilter(tab.key)}
                  className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    typeFilter === tab.key
                      ? 'bg-[#ff6b00] text-white shadow-xs'
                      : 'text-[#5a4136] dark:text-[#ffb693] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-9 h-9 border-3 border-[#ff6b00] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-[#5a4136] dark:text-[#ffb693]">Polling outbox messages…</p>
          </div>
        ) : events.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center mx-auto">
              <Inbox size={28} className="text-[#ff6b00] opacity-50" />
            </div>
            <h4 className="text-base font-bold text-[#261812] dark:text-[#ffede6]">Queue Empty</h4>
            <p className="text-sm text-[#5a4136] dark:text-[#ffb693] max-w-xs mx-auto">
              All transactional events have been processed. The outbox is clean.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#e2bfb0]/50 dark:divide-[#5a4136]/50">
            {events.map(ev => {
              const statusCfg = STATUS_CONFIG[ev.status] || STATUS_CONFIG.PENDING;
              const typeCfg = TYPE_LABELS[ev.event_type];
              const isExpanded = expandedIds.has(ev.id);
              const isRetrying = retryingIds.has(ev.id);

              return (
                <div key={ev.id} className="group">
                  {/* Row */}
                  <div className="px-5 py-4 flex items-center gap-4 hover:bg-[#fef5f0]/50 dark:hover:bg-[#1f1510]/50 transition-colors">
                    {/* Expand Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleExpanded(ev.id)}
                      className="w-7 h-7 rounded-lg bg-[#fef5f0] dark:bg-[#1f1510] border border-[#e2bfb0] dark:border-[#5a4136] flex items-center justify-center text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00] hover:border-[#ff6b00] transition-all cursor-pointer flex-shrink-0"
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    {/* Status Indicator */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: statusCfg.bg, color: statusCfg.color }}
                    >
                      {statusCfg.icon}
                    </div>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Event Type Badge */}
                        {typeCfg ? (
                          <span
                            className="text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider"
                            style={{ backgroundColor: typeCfg.color + '18', color: typeCfg.color }}
                          >
                            {typeCfg.label}
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {ev.event_type}
                          </span>
                        )}
                        {/* Status Badge */}
                        <span
                          className="text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1"
                          style={{ backgroundColor: statusCfg.bg, color: statusCfg.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusCfg.color }} />
                          {statusCfg.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs font-semibold text-[#261812] dark:text-[#ffede6] font-mono">
                          {ev.aggregate_type}
                        </span>
                        <span className="text-[10px] text-[#5a4136]/50 dark:text-[#ffb693]/50 font-mono">
                          {ev.aggregate_id?.slice(0, 12)}…
                        </span>
                      </div>

                      {/* Error preview */}
                      {ev.last_error && (
                        <p className="text-[11px] text-red-500 dark:text-red-400 mt-1 truncate max-w-md font-medium">
                          ⚠ {ev.last_error}
                        </p>
                      )}
                    </div>

                    {/* Metadata Column */}
                    <div className="hidden md:flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[11px] font-semibold text-[#5a4136] dark:text-[#ffb693]">
                        {timeAgo(ev.created_at)}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#5a4136]/60 dark:text-[#ffb693]/60">
                        <Timer size={10} />
                        <span>Attempt {ev.attempt_count}/5</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(ev.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] text-[10px] font-bold text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00] hover:border-[#ff6b00] transition-colors cursor-pointer bg-white dark:bg-[#261812] flex items-center gap-1"
                      >
                        <Code2 size={11} />
                        {isExpanded ? 'Hide' : 'Payload'}
                      </button>

                      {(ev.status === 'FAILED' || ev.status === 'PROCESSING') && (
                        <button
                          type="button"
                          onClick={() => handleRetry(ev.id)}
                          disabled={isRetrying}
                          className="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-[10px] font-bold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        >
                          {isRetrying ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                          Retry
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Payload */}
                  {isExpanded && (
                    <div className="px-5 pb-4 animate-fadeIn">
                      <div className="ml-11 bg-[#fef5f0] dark:bg-[#1f1510] border border-[#e2bfb0] dark:border-[#5a4136] rounded-xl p-4 overflow-hidden">
                        {/* Meta row */}
                        <div className="flex items-center gap-4 mb-3 pb-3 border-b border-[#e2bfb0]/50 dark:border-[#5a4136]/50 flex-wrap">
                          <div className="text-[10px]">
                            <span className="font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">ID </span>
                            <span className="font-mono text-[#261812] dark:text-[#ffede6]">{ev.id}</span>
                          </div>
                          <div className="text-[10px]">
                            <span className="font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">Created </span>
                            <span className="font-mono text-[#261812] dark:text-[#ffede6]">{new Date(ev.created_at).toLocaleString()}</span>
                          </div>
                          {ev.processed_at && (
                            <div className="text-[10px]">
                              <span className="font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">Processed </span>
                              <span className="font-mono text-[#261812] dark:text-[#ffede6]">{new Date(ev.processed_at).toLocaleString()}</span>
                            </div>
                          )}
                          {ev.locked_by && (
                            <div className="text-[10px]">
                              <span className="font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">Worker </span>
                              <span className="font-mono text-[#261812] dark:text-[#ffede6]">{ev.locked_by}</span>
                            </div>
                          )}
                        </div>

                        {/* JSON Payload */}
                        <div className="flex items-center gap-1.5 mb-2">
                          <ArrowDownToLine size={11} className="text-[#ff6b00]" />
                          <span className="text-[10px] font-black text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">
                            Event Payload
                          </span>
                        </div>
                        <pre className="text-[12px] font-mono text-[#261812] dark:text-[#ffede6] bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-lg p-3 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed">
                          {JSON.stringify(ev.payload, null, 2)}
                        </pre>

                        {/* Error Detail */}
                        {ev.last_error && (
                          <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex items-center gap-1.5 mb-1">
                              <AlertCircle size={11} className="text-red-500" />
                              <span className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider">Last Error</span>
                            </div>
                            <p className="text-xs font-mono text-red-700 dark:text-red-300 break-words">{ev.last_error}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
