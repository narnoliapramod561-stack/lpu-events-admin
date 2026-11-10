// lpu-events-admin/src/components/superadmin/monitoring/sections/ErrorInbox.tsx
// Section B: PostHog Error Inbox & Exception Triage (MON-004 / MON-008 Stage 9)

import React, { useState, useEffect, useCallback } from 'react';
import {
  Inbox,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertOctagon,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { MonitoringApiClient } from '../utils/MonitoringApiClient.ts';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { OccurrenceDisclaimer } from '../components/OccurrenceDisclaimer.tsx';
import { IssueDetailDrawer } from './IssueDetailDrawer.tsx';
import { SuppressionConfirmModal } from '../components/SuppressionConfirmModal.tsx';
import { CopyReportButton } from '../components/CopyReportButton.tsx';
import type { NormalizedPostHogIssue } from '../types.ts';

interface ErrorInboxProps {
  onSearchLogs?: (correlationId: string) => void;
}

export const ErrorInbox: React.FC<ErrorInboxProps> = ({ onSearchLogs }) => {
  const [issues, setIssues] = useState<NormalizedPostHogIssue[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'active' | 'resolved' | 'suppressed' | 'all'>('active');
  const [surfaceFilter, setSurfaceFilter] = useState<'all' | 'student' | 'admin' | 'backend'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Drawer & Modal state
  const [selectedIssue, setSelectedIssue] = useState<NormalizedPostHogIssue | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [issueToSuppress, setIssueToSuppress] = useState<NormalizedPostHogIssue | null>(null);
  const [suppressing, setSuppressing] = useState<boolean>(false);

  const loadIssues = useCallback(async (isRefresh: boolean = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const statusParam = statusFilter === 'all' ? undefined : statusFilter;
      const { issues: fetched, total } = await MonitoringApiClient.getIssues({
        status: statusParam,
        limit: 100,
      });
      setIssues(fetched);
      setTotalCount(total);
    } catch (err: any) {
      console.error('Failed to load PostHog issues:', err);
      setError(err?.message || 'Failed to retrieve exception list from PostHog.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadIssues(false);
  }, [loadIssues]);

  const handleRowClick = (issue: NormalizedPostHogIssue) => {
    setSelectedIssue(issue);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedIssue(null);
  };

  const handleStatusUpdated = (updated: NormalizedPostHogIssue) => {
    setIssues((prev) =>
      prev.map((i) => (i.id === updated.id ? { ...i, status: updated.status } : i))
    );
    if (selectedIssue && selectedIssue.id === updated.id) {
      setSelectedIssue(updated);
    }
  };

  const handleQuickResolve = async (e: React.MouseEvent, issue: NormalizedPostHogIssue) => {
    e.stopPropagation();
    try {
      await MonitoringApiClient.updateIssue(issue.id, 'resolved');
      handleStatusUpdated({ ...issue, status: 'resolved' });
    } catch (err: any) {
      alert(`Could not resolve issue: ${err.message || 'Unknown error'}`);
    }
  };

  const handleRequestSuppress = (issue: NormalizedPostHogIssue) => {
    setIssueToSuppress(issue);
  };

  const handleConfirmSuppress = async () => {
    if (!issueToSuppress) return;
    setSuppressing(true);
    try {
      await MonitoringApiClient.updateIssue(issueToSuppress.id, 'suppressed');
      handleStatusUpdated({ ...issueToSuppress, status: 'suppressed' });
      setIssueToSuppress(null);
    } catch (err: any) {
      alert(`Could not suppress issue: ${err.message || 'Unknown error'}`);
    } finally {
      setSuppressing(false);
    }
  };

  // Filtered issues client-side
  const filteredIssues = issues.filter((issue) => {
    if (surfaceFilter !== 'all' && issue.app !== surfaceFilter) {
      return false;
    }
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchName = issue.name.toLowerCase().includes(q);
      const matchComp = issue.component.toLowerCase().includes(q);
      const matchRelease = issue.release.toLowerCase().includes(q);
      if (!matchName && !matchComp && !matchRelease) return false;
    }
    return true;
  });

  const handleToggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredIssues.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIssues.map((i) => i.id)));
    }
  };

  const selectedIssuesList = filteredIssues.filter((i) => selectedIds.has(i.id));

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
        <div>
          <h2 className="text-xl font-black font-['Outfit'] tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <Inbox className="w-6 h-6 text-orange-500" />
            <span>PostHog Error Inbox & Exception Triage</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-300">
              {totalCount}
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Grouped technical exceptions from Student, Admin, and Edge Worker runtimes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <CopyReportButton
              issues={selectedIssuesList}
              variant="primary"
              label={`Copy Selected (${selectedIds.size})`}
            />
          )}

          <CopyReportButton
            issues={filteredIssues.filter((i) => i.status === 'active')}
            label="Copy All Active"
          />

          <button
            type="button"
            onClick={() => loadIssues(true)}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-orange-500 hover:bg-orange-600 active:scale-95 text-white shadow-xs transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200/80 dark:border-white/5 text-xs font-bold">
            {(['active', 'resolved', 'suppressed', 'all'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                  statusFilter === tab
                    ? 'bg-white dark:bg-white/10 text-orange-600 dark:text-orange-400 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Surface Filter */}
          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={surfaceFilter}
              onChange={(e) => setSurfaceFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-800 dark:text-zinc-200 font-semibold focus:outline-none"
            >
              <option value="all">All Surfaces</option>
              <option value="student">Student Website</option>
              <option value="admin">Admin Portal</option>
              <option value="backend">Backend & Edge</option>
            </select>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search exceptions by title, component, or Git release SHA..."
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-3">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Issues Table */}
      <div className="rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 shadow-xs overflow-hidden">
        {loading && !refreshing ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-7 h-7 text-orange-500 animate-spin mx-auto" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Loading issues from PostHog Error Tracking...
            </p>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
              Zero Matching Exceptions Found
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              No issues match the selected filters or search criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-white/[0.02] text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="py-3 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={filteredIssues.length > 0 && selectedIds.size === filteredIssues.length}
                      onChange={handleToggleSelectAll}
                      className="rounded border-zinc-300 dark:border-white/20 text-orange-500 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Error Title</th>
                  <th className="py-3 px-4">Surface</th>
                  <th className="py-3 px-4">Component</th>
                  <th className="py-3 px-4 text-center">Occurrences</th>
                  <th className="py-3 px-4 text-center">Users</th>
                  <th className="py-3 px-4">Last Seen</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/70 dark:divide-white/5">
                {filteredIssues.map((issue) => (
                  <tr
                    key={issue.id}
                    onClick={() => handleRowClick(issue)}
                    className="hover:bg-zinc-50 dark:hover:bg-white/[0.03] cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(issue.id)}
                        onChange={(e) => handleToggleSelect(e as any, issue.id)}
                        className="rounded border-zinc-300 dark:border-white/20 text-orange-500 focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono border ${
                        issue.severity === 'P0' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                        issue.severity === 'P1' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                        'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                      }`}>
                        {issue.severity}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-zinc-900 dark:text-zinc-200 max-w-[280px] truncate" title={issue.name}>
                      {issue.name}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase font-mono ${
                        issue.app === 'backend' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                        issue.app === 'admin' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' :
                        'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                      }`}>
                        {issue.app}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {issue.component}
                    </td>

                    <td className="py-3.5 px-4 text-center font-bold font-mono text-zinc-800 dark:text-zinc-200">
                      {issue.occurrences}
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {issue.users === 'N/A' ? (
                        <span className="text-[10px] text-zinc-400 italic">N/A (Backend)</span>
                      ) : (
                        issue.users
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-zinc-500 dark:text-zinc-400 text-[11px]">
                      {new Date(issue.lastSeen).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge status={issue.status} size="sm" />
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {issue.status !== 'resolved' && (
                          <button
                            type="button"
                            onClick={(e) => handleQuickResolve(e, issue)}
                            className="p-1 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                            title="Mark Resolved"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {issue.status !== 'suppressed' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRequestSuppress(issue);
                            }}
                            className="p-1 rounded-md text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                            title="Suppress Exception"
                          >
                            <AlertOctagon className="w-4 h-4" />
                          </button>
                        )}
                        <CopyReportButton issue={issue} variant="inline" label="" />
                        <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.01]">
          <OccurrenceDisclaimer variant="full" />
        </div>
      </div>

      {/* Slide-Over Issue Detail Drawer */}
      <IssueDetailDrawer
        issue={selectedIssue}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onStatusUpdated={handleStatusUpdated}
        onRequestSuppress={handleRequestSuppress}
        onSearchLogs={onSearchLogs}
      />

      {/* Mandatory PostHog Ingestion Drop Confirmation Modal */}
      <SuppressionConfirmModal
        isOpen={Boolean(issueToSuppress)}
        issue={issueToSuppress}
        onClose={() => setIssueToSuppress(null)}
        onConfirm={handleConfirmSuppress}
        loading={suppressing}
      />
    </div>
  );
};
