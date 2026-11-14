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
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { MonitoringApiClient } from '../utils/MonitoringApiClient.ts';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { OccurrenceDisclaimer } from '../components/OccurrenceDisclaimer.tsx';
import { IssueDetailDrawer } from './IssueDetailDrawer.tsx';
import { SuppressionConfirmModal } from '../components/SuppressionConfirmModal.tsx';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal.tsx';
import { CopyReportButton } from '../components/CopyReportButton.tsx';
import type { NormalizedPostHogIssue } from '../types.ts';

const PAGE_SIZE = 50;

interface ErrorInboxProps {
  onSearchLogs?: (correlationId: string) => void;
}

export const ErrorInbox: React.FC<ErrorInboxProps> = ({ onSearchLogs }) => {
  const [issues, setIssues] = useState<NormalizedPostHogIssue[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<'active' | 'resolved' | 'suppressed' | 'all'>('active');
  const [surfaceFilter, setSurfaceFilter] = useState<'all' | 'student' | 'admin' | 'backend' | 'app'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResolving, setBulkResolving] = useState<boolean>(false);
  const [bulkDeleting, setBulkDeleting] = useState<boolean>(false);

  // Drawer & Modal state
  const [selectedIssue, setSelectedIssue] = useState<NormalizedPostHogIssue | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [issueToSuppress, setIssueToSuppress] = useState<NormalizedPostHogIssue | null>(null);
  const [suppressing, setSuppressing] = useState<boolean>(false);
  const [issueToDelete, setIssueToDelete] = useState<NormalizedPostHogIssue | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const loadIssues = useCallback(async (isRefresh: boolean = false, targetPage: number = page) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const offset = (targetPage - 1) * PAGE_SIZE;
      const statusParam = statusFilter === 'all' ? 'all' : statusFilter;
      const { issues: fetched, total } = await MonitoringApiClient.getIssues({
        status: statusParam,
        limit: PAGE_SIZE,
        offset,
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
  }, [statusFilter, page]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [statusFilter]);

  useEffect(() => {
    loadIssues(false, page);
  }, [loadIssues, page]);

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
    if (statusFilter !== 'all' && updated.status !== statusFilter) {
      setTotalCount((prev) => Math.max(0, prev - 1));
    }
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

  const handleQuickReopen = async (e: React.MouseEvent, issue: NormalizedPostHogIssue) => {
    e.stopPropagation();
    try {
      await MonitoringApiClient.updateIssue(issue.id, 'active');
      handleStatusUpdated({ ...issue, status: 'active' });
    } catch (err: any) {
      alert(`Could not reopen issue: ${err.message || 'Unknown error'}`);
    }
  };

  const handleBulkResolve = async () => {
    if (selectedIds.size === 0) return;
    setBulkResolving(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => MonitoringApiClient.updateIssue(id, 'resolved')));
      setIssues((prev) =>
        prev.map((i) => (selectedIds.has(i.id) ? { ...i, status: 'resolved' } : i))
      );
      if (statusFilter !== 'all') {
        setTotalCount((prev) => Math.max(0, prev - ids.length));
      }
      setSelectedIds(new Set());
    } catch (err: any) {
      alert(`Bulk resolve error: ${err.message || 'Unknown error'}`);
    } finally {
      setBulkResolving(false);
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

  const handleRequestDelete = (issue: NormalizedPostHogIssue) => {
    setIssueToDelete(issue);
  };

  const handleConfirmDelete = async () => {
    if (!issueToDelete) return;
    setDeleting(true);
    try {
      await MonitoringApiClient.deleteIssue(issueToDelete.id);
      setIssues((prev) => prev.filter((i) => i.id !== issueToDelete.id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      if (selectedIssue && selectedIssue.id === issueToDelete.id) {
        setIsDrawerOpen(false);
        setSelectedIssue(null);
      }
      setIssueToDelete(null);
    } catch (err: any) {
      alert(`Could not delete issue: ${err.message || 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected exceptions?`)) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => MonitoringApiClient.deleteIssue(id)));
      setIssues((prev) => prev.filter((i) => !selectedIds.has(i.id)));
      setTotalCount((prev) => Math.max(0, prev - ids.length));
      setSelectedIds(new Set());
    } catch (err: any) {
      alert(`Bulk delete error: ${err.message || 'Unknown error'}`);
    } finally {
      setBulkDeleting(false);
    }
  };

  // Filtered issues client-side
  const filteredIssues = issues.filter((issue) => {
    if (statusFilter !== 'all' && issue.status !== statusFilter) {
      return false;
    }
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
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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
            Grouped technical exceptions from Student, Admin, Mobile App, and Edge Worker runtimes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <button
                type="button"
                onClick={handleBulkResolve}
                disabled={bulkResolving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{bulkResolving ? 'Resolving...' : `Resolve Selected (${selectedIds.size})`}</span>
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 active:scale-95 text-xs font-bold transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{bulkDeleting ? 'Deleting...' : `Delete Selected (${selectedIds.size})`}</span>
              </button>
              <CopyReportButton
                issues={selectedIssuesList}
                variant="primary"
                label={`Copy Selected (${selectedIds.size})`}
              />
            </>
          )}

          <CopyReportButton
            issues={filteredIssues.filter((i) => i.status === 'active')}
            label="Copy All Active"
          />

          <button
            type="button"
            onClick={() => loadIssues(true, page)}
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
              <option value="app">Mobile App</option>
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
                        issue.app === 'app' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                        'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                      }`}>
                        {issue.app === 'app' ? 'mobile' : issue.app}
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
                      <div>{new Date(issue.lastSeen).toLocaleDateString()}</div>
                      <div className="text-[10px] font-mono text-zinc-400">
                        {new Date(issue.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
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
                        {issue.status !== 'active' && (
                          <button
                            type="button"
                            onClick={(e) => handleQuickReopen(e, issue)}
                            className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10"
                            title="Reopen Issue"
                          >
                            <RotateCcw className="w-4 h-4" />
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
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRequestDelete(issue);
                          }}
                          className="p-1 rounded-md text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10"
                          title="Delete Exception"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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

        {/* Pagination & Disclaimers Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-4">
          <OccurrenceDisclaimer variant="full" />

          {totalPages > 1 && (
            <div className="flex items-center gap-3 text-xs shrink-0 font-medium">
              <span className="text-zinc-500">
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 disabled:opacity-40 font-bold hover:bg-zinc-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-800 disabled:opacity-40 font-bold hover:bg-zinc-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Slide-Over Issue Detail Drawer */}
      <IssueDetailDrawer
        issue={selectedIssue}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onStatusUpdated={handleStatusUpdated}
        onRequestSuppress={handleRequestSuppress}
        onRequestDelete={handleRequestDelete}
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

      {/* Exception Deletion Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(issueToDelete)}
        issue={issueToDelete}
        onClose={() => setIssueToDelete(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </div>
  );
};
