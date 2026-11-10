// lpu-events-admin/src/components/superadmin/monitoring/sections/IssueDetailDrawer.tsx
// Slide-Over Drawer for Issue Details, Stack Traces & Triage (MON-004 / MON-008 Stage 9)

import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  CheckCircle2,
  AlertOctagon,
  RotateCcw,
  Search,
  Copy,
  Check,
  Clock,
  Layers,
  Terminal,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { CopyReportButton } from '../components/CopyReportButton.tsx';
import { MonitoringApiClient } from '../utils/MonitoringApiClient.ts';
import type { NormalizedPostHogIssue } from '../types.ts';

interface IssueDetailDrawerProps {
  issue: NormalizedPostHogIssue | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated: (updatedIssue: NormalizedPostHogIssue) => void;
  onRequestSuppress: (issue: NormalizedPostHogIssue) => void;
  onSearchLogs?: (correlationId: string) => void;
}

export const IssueDetailDrawer: React.FC<IssueDetailDrawerProps> = ({
  issue,
  isOpen,
  onClose,
  onStatusUpdated,
  onRequestSuppress,
  onSearchLogs,
}) => {
  const [detailData, setDetailData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  useEffect(() => {
    if (!issue || !isOpen) {
      setDetailData(null);
      return;
    }

    let isMounted = true;
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const data = await MonitoringApiClient.getIssueDetail(issue.id);
        if (isMounted) setDetailData(data);
      } catch (err) {
        console.warn('Could not fetch expanded issue detail from PostHog:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [issue, isOpen]);

  if (!isOpen || !issue) return null;

  const handleUpdateStatus = async (newStatus: 'resolved' | 'active') => {
    setActionLoading(true);
    try {
      await MonitoringApiClient.updateIssue(issue.id, newStatus);
      onStatusUpdated({ ...issue, status: newStatus });
    } catch (err: any) {
      alert(`Failed to update status: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  const correlationId =
    detailData?.properties?.correlation_id ||
    detailData?.correlation_id ||
    detailData?.first_seen_correlation_id ||
    '';

  const stacktrace =
    detailData?.properties?.$exception_list?.[0]?.stacktrace?.frames ||
    detailData?.stack_trace ||
    [];

  const breadcrumbs =
    detailData?.properties?.$breadcrumbs ||
    detailData?.breadcrumbs ||
    [];

  const handleCopyId = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-xs animate-fadeIn">
      {/* Click outside to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Surface */}
      <div className="w-full max-w-[640px] h-full bg-white dark:bg-[#1f1f22] border-l border-zinc-200 dark:border-white/10 shadow-2xl flex flex-col z-50 overflow-hidden">
        {/* Drawer Header */}
        <div className="p-6 border-b border-zinc-200 dark:border-white/10 flex items-start justify-between gap-4 bg-zinc-50/50 dark:bg-white/[0.02]">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={issue.status} size="sm" />
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono border ${
                issue.severity === 'P0' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                issue.severity === 'P1' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
              }`}>
                {issue.severity}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-300">
                {issue.app}
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                release: {issue.release}
              </span>
            </div>

            <h2 className="text-base font-bold font-mono text-zinc-900 dark:text-white break-all leading-tight">
              {issue.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Triage Action Bar */}
        <div className="px-6 py-3 border-b border-zinc-200 dark:border-white/10 bg-zinc-100/60 dark:bg-white/[0.01] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            {issue.status !== 'resolved' ? (
              <button
                type="button"
                onClick={() => handleUpdateStatus('resolved')}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark Resolved</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleUpdateStatus('active')}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-800 text-white font-bold transition-all disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reopen Issue</span>
              </button>
            )}

            {issue.status !== 'suppressed' && (
              <button
                type="button"
                onClick={() => onRequestSuppress(issue)}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-bold transition-all disabled:opacity-50"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Suppress (Drop)</span>
              </button>
            )}

            <CopyReportButton issue={issue} detail={detailData} variant="primary" label="Copy AI Report" />
          </div>

          <a
            href={issue.deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 font-bold hover:underline"
          >
            <span>Open in PostHog Web</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/5">
              <span className="text-[10px] font-bold uppercase text-zinc-400">Occurrences</span>
              <p className="text-lg font-black font-['Outfit'] text-zinc-900 dark:text-white mt-1">
                {issue.occurrences}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/5">
              <span className="text-[10px] font-bold uppercase text-zinc-400">Affected Users</span>
              <p className="text-sm font-bold font-mono text-zinc-900 dark:text-white mt-1">
                {issue.users === 'N/A' ? 'N/A (Backend)' : issue.users}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/5">
              <span className="text-[10px] font-bold uppercase text-zinc-400">First Seen</span>
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-zinc-400" />
                <span>{new Date(issue.firstSeen).toLocaleDateString()}</span>
              </p>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/5">
              <span className="text-[10px] font-bold uppercase text-zinc-400">Last Seen</span>
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-zinc-400" />
                <span>{new Date(issue.lastSeen).toLocaleDateString()}</span>
              </p>
            </div>
          </div>

          {/* Component & Correlation ID */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/5">
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">Source Component:</span>
              <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                {issue.component}
              </span>
            </div>

            {correlationId && (
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                    Request Correlation ID:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyId(correlationId)}
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 hover:text-orange-500"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-orange-600 dark:text-orange-400 font-bold break-all">
                  {correlationId}
                </div>

                {onSearchLogs && (
                  <button
                    type="button"
                    onClick={() => onSearchLogs(correlationId)}
                    className="w-full mt-2 py-2 px-3 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Search Backend Logs with Correlation ID</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Symbolicated Stack Trace */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-orange-500" />
                <span>Symbolicated Stack Trace</span>
              </h4>
              <span className="text-[11px] text-zinc-400 font-mono">
                {Array.isArray(stacktrace) ? `${stacktrace.length} frames` : 'Raw Stack'}
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                Loading symbolicated frames from PostHog...
              </div>
            ) : Array.isArray(stacktrace) && stacktrace.length > 0 ? (
              <div className="rounded-xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-900 text-zinc-300 font-mono text-[11px] divide-y divide-white/5">
                {stacktrace.map((frame: any, idx: number) => {
                  const isApp = frame.in_app !== false;
                  return (
                    <div
                      key={idx}
                      className={`p-3 space-y-1 ${
                        isApp ? 'bg-orange-950/20 text-orange-200' : 'text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">
                          {frame.function || frame.method || 'anonymous'}
                        </span>
                        {isApp && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-orange-500/30 text-orange-300 uppercase font-bold">
                            in-app
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {frame.filename || frame.file}:{frame.lineno || frame.line}:{frame.colno || frame.col}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/5 text-xs text-zinc-500">
                No stacktrace frames available for this exception event.
              </div>
            )}
          </div>

          {/* Breadcrumb Trail */}
          {Array.isArray(breadcrumbs) && breadcrumbs.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-500" />
                <span>Breadcrumbs (Last user actions & network calls)</span>
              </h4>

              <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.02] divide-y divide-zinc-200 dark:divide-white/5 text-xs">
                {breadcrumbs.slice(-10).map((b: any, idx: number) => (
                  <div key={idx} className="p-2.5 flex items-start gap-2">
                    <span className="font-mono text-[10px] text-zinc-400 shrink-0">
                      [{b.category || 'action'}]
                    </span>
                    <span className="text-zinc-800 dark:text-zinc-200 leading-normal">
                      {b.message || JSON.stringify(b.data || {})}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
