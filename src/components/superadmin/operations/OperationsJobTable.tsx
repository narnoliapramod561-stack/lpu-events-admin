// src/components/superadmin/operations/OperationsJobTable.tsx
// LPU Events — Phase 7: Maintenance Jobs Telemetry & Execution Audit

import React, { useState } from 'react';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCw,
  Search,
  AlertCircle
} from 'lucide-react';
import {
  OperationsJob,
  OperationsJobRun,
} from '../../../shared/operations/types';
import { JobFilterStatus } from './types';

interface OperationsJobTableProps {
  jobs: OperationsJob[];
  runs: OperationsJobRun[];
  loading: boolean;
  isFailed?: boolean;
}

export const OperationsJobTable: React.FC<OperationsJobTableProps> = ({
  jobs,
  runs,
  loading,
  isFailed,
}) => {
  const [selectedJob, setSelectedJob] = useState<OperationsJob | null>(null);
  const [statusFilter, setStatusFilter] = useState<JobFilterStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sort failed and stale jobs to the top for operational urgency
  const sortedJobs = [...jobs].sort((a, b) => {
    const aUrgent = a.health === 'FAILED' ? 0 : a.is_stale ? 1 : 2;
    const bUrgent = b.health === 'FAILED' ? 0 : b.is_stale ? 1 : 2;
    if (aUrgent !== bUrgent) return aUrgent - bUrgent;
    return a.job_key.localeCompare(b.job_key);
  });

  const filteredJobs = sortedJobs.filter((j) => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'FAILED' && j.health !== 'FAILED') return false;
      if (statusFilter === 'STALE' && !j.is_stale) return false;
      if (statusFilter === 'RUNNING' && !j.is_running) return false;
      if (statusFilter === 'HEALTHY' && j.health !== 'HEALTHY') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!j.job_key.toLowerCase().includes(q) && !j.display_name.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const getHealthBadge = (health: string, isStale: boolean, isRunning: boolean) => {
    if (isRunning) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1">
          <RotateCw size={11} className="animate-spin" />
          RUNNING
        </span>
      );
    }
    if (health === 'FAILED') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30 flex items-center gap-1">
          <XCircle size={11} />
          FAILED
        </span>
      );
    }
    if (isStale) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
          <AlertTriangle size={11} />
          STALE
        </span>
      );
    }
    if (health === 'PARTIAL') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30 flex items-center gap-1">
          <AlertCircle size={11} />
          PARTIAL
        </span>
      );
    }
    if (health === 'HEALTHY') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
          <CheckCircle2 size={11} />
          HEALTHY
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-gray-500 bg-gray-500/10 border border-gray-500/20">
        {health}
      </span>
    );
  };

  return (
    <div className="card-box mb-6 border border-[#e2bfb0] dark:border-white/10 rounded-xl bg-[#ffffff] dark:bg-[#202023] shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <Layers size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold font-['Outfit'] text-[#261812] dark:text-white">
              Operations & Scheduled Maintenance Jobs
            </h2>
            <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-0.5">
              Canonical background maintenance tasks, schedule health, and run execution metrics
            </p>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#261812] dark:text-white focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as JobFilterStatus)}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#261812] dark:text-white focus:outline-none"
            aria-label="Filter Jobs by Status"
          >
            <option value="ALL">All Jobs</option>
            <option value="FAILED">Failed</option>
            <option value="STALE">Stale</option>
            <option value="RUNNING">Running</option>
            <option value="HEALTHY">Healthy</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading && jobs.length === 0 ? (
        <div className="p-6 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-gray-50 dark:bg-white/[0.02] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : isFailed ? (
        <div className="p-12 text-center text-xs text-red-600 dark:text-red-400 font-mono">
          UNAVAILABLE: Unable to retrieve background maintenance jobs. Gateway request failed.
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="p-12 text-center text-xs text-gray-500">
          No operations jobs matched the filter criteria.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] text-gray-500 dark:text-gray-400 font-mono">
                <th className="p-3 pl-5 font-semibold">JOB</th>
                <th className="p-3 font-semibold">STATUS</th>
                <th className="p-3 font-semibold">SCHEDULE</th>
                <th className="p-3 font-semibold">LAST RUN</th>
                <th className="p-3 font-semibold">DURATION</th>
                <th className="p-3 font-semibold">LAST STATUS</th>
                <th className="p-3 pr-5 text-right font-semibold">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {filteredJobs.map((j) => {
                const isFail = j.health === 'FAILED';
                const isStale = j.is_stale;

                return (
                  <tr
                    key={j.id}
                    onClick={() => setSelectedJob(j)}
                    className={`hover:bg-orange-500/[0.02] dark:hover:bg-white/[0.02] cursor-pointer transition-colors ${
                      isFail ? 'bg-red-500/[0.03]' : isStale ? 'bg-amber-500/[0.02]' : ''
                    }`}
                  >
                    <td className="p-3 pl-5 font-medium">
                      <div className="font-bold text-[#261812] dark:text-white font-['Outfit']">
                        {j.display_name}
                      </div>
                      <div className="text-[11px] font-mono text-gray-400">{j.job_key}</div>
                    </td>
                    <td className="p-3">
                      {getHealthBadge(j.health, j.is_stale, j.is_running)}
                    </td>
                    <td className="p-3 text-gray-600 dark:text-gray-300 font-mono text-[11px]">
                      {j.schedule_description || `${j.expected_interval_minutes}m interval`}
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      {j.last_run_at ? (
                        <span>{new Date(j.last_run_at).toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-400">Never executed</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      {j.last_duration_ms ? `${j.last_duration_ms}ms` : '—'}
                    </td>
                    <td className="p-3 font-mono text-[11px]">
                      {j.last_run_status || '—'}
                    </td>
                    <td className="p-3 pr-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedJob(j);
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded bg-gray-100 dark:bg-white/5 hover:bg-orange-500/10 hover:text-orange-600 transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Job Details Modal */}
      {selectedJob && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white dark:bg-[#1c1c1e] text-[#261812] dark:text-white rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl p-6">
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 dark:border-white/10 mb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-orange-600 uppercase">
                  Operations Job Details
                </span>
                <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-white">
                  {selectedJob.display_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-white/5">
                <span className="text-gray-500">Job Key:</span>
                <span className="font-bold">{selectedJob.job_key}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-white/5">
                <span className="text-gray-500">Job Type:</span>
                <span>{selectedJob.job_type}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-white/5">
                <span className="text-gray-500">Health:</span>
                <span>{selectedJob.health}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-white/5">
                <span className="text-gray-500">Is Stale:</span>
                <span className={selectedJob.is_stale ? 'text-amber-500 font-bold' : ''}>
                  {selectedJob.is_stale ? 'YES (Stale)' : 'No'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-white/5">
                <span className="text-gray-500">Last Duration:</span>
                <span>{selectedJob.last_duration_ms ? `${selectedJob.last_duration_ms}ms` : 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-white/5">
                <span className="text-gray-500">Last Success:</span>
                <span>{selectedJob.last_success_at ? new Date(selectedJob.last_success_at).toLocaleString() : 'N/A'}</span>
              </div>
              {selectedJob.last_error_summary && (
                <div className="py-2 border-b border-gray-50 dark:border-white/5 text-red-600 dark:text-red-400">
                  <span className="text-gray-500 block mb-1">Last Error:</span>
                  <p className="p-2 bg-red-500/10 rounded border border-red-500/20 text-[11px]">
                    {selectedJob.last_error_summary}
                  </p>
                </div>
              )}

              {/* Recent Execution Runs */}
              <div className="pt-2">
                <span className="text-gray-500 block mb-1">Recent Execution Runs:</span>
                {(() => {
                  const jobRuns = runs.filter((r) => r.job_id === selectedJob.id || r.ops_jobs?.job_key === selectedJob.job_key);
                  if (jobRuns.length === 0) {
                    return <div className="text-[11px] text-gray-400 italic">No recent runs captured.</div>;
                  }
                  return (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {jobRuns.slice(0, 5).map((run) => (
                        <div key={run.id} className="p-2 rounded bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 flex items-center justify-between text-[11px]">
                          <div>
                            <span className="font-bold">{run.status}</span>
                            <span className="text-gray-400 ml-2">{new Date(run.started_at).toLocaleTimeString()}</span>
                          </div>
                          <div className="text-gray-500">
                            {run.duration_ms ? `${run.duration_ms}ms` : '—'} • {run.records_processed} processed
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-gray-100 dark:border-white/10 flex justify-end">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
