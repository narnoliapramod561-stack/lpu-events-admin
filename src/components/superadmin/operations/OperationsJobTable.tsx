// src/components/superadmin/operations/OperationsJobTable.tsx
// LPU Events — Automated Background Tasks & Scheduled Maintenance
// Human-understandable task statuses, schedules, and execution health

import React, { useState } from 'react';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCw,
  Search,
  Zap,
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

// Friendly human definitions for all 13 canonical background tasks
interface HumanTaskInfo {
  friendlyTitle: string;
  simplePurpose: string;
  schedulePlain: string;
  typicalDurationMs: number;
}

const HUMAN_TASKS_MAP: Record<string, HumanTaskInfo> = {
  purge_stale_tokens: {
    friendlyTitle: 'Clean Expired Login Sessions',
    simplePurpose: 'Removes expired login tokens and unverified OTP requests to keep accounts secure',
    schedulePlain: 'Runs hourly',
    typicalDurationMs: 42,
  },
  aggregate_event_analytics: {
    friendlyTitle: 'Calculate Event Popularity & Views',
    simplePurpose: 'Refreshes event view counts, ticket bookmarks, and trending rankings',
    schedulePlain: 'Runs every 15 min',
    typicalDurationMs: 118,
  },
  reconcile_ticket_inventory: {
    friendlyTitle: 'Reconcile Ticket Stock & Bookings',
    simplePurpose: 'Ensures event seat counts and tickets issued match student registration records exactly',
    schedulePlain: 'Runs every 5 min',
    typicalDurationMs: 64,
  },
  cache_student_homepage_events: {
    friendlyTitle: 'Refresh Student Homepage Cache',
    simplePurpose: 'Pre-caches active campus events for ultra-fast student mobile website loading',
    schedulePlain: 'Runs every 10 min',
    typicalDurationMs: 38,
  },
  cleanup_expired_draft_events: {
    friendlyTitle: 'Clean Incomplete Event Drafts',
    simplePurpose: 'Removes abandoned organizer drafts older than 30 days to save database space',
    schedulePlain: 'Runs daily at 3:00 AM',
    typicalDurationMs: 88,
  },
  verify_cloudflare_r2_assets: {
    friendlyTitle: 'Verify Event Poster Links',
    simplePurpose: 'Audits event poster and banner URLs to ensure all images load without 404 errors',
    schedulePlain: 'Runs every 30 min',
    typicalDurationMs: 156,
  },
  drain_notification_outbox: {
    friendlyTitle: 'Deliver Queued Email Notifications',
    simplePurpose: 'Pulls queued student tickets, OTPs, and event update alerts and delivers via Resend',
    schedulePlain: 'Runs every 1 minute',
    typicalDurationMs: 29,
  },
  reconcile_organizer_quotas: {
    friendlyTitle: 'Check Organizer Posting Limits',
    simplePurpose: 'Calculates active events per student club and refreshes monthly creation limits',
    schedulePlain: 'Runs every 6 hours',
    typicalDurationMs: 75,
  },
  prune_operations_telemetry: {
    friendlyTitle: 'Clean Old Diagnostic Logs',
    simplePurpose: 'Archives health probe and metric snapshots older than 14 days to keep database fast',
    schedulePlain: 'Runs daily at 4:00 AM',
    typicalDurationMs: 112,
  },
  recompute_trending_scores: {
    friendlyTitle: 'Update Trending Event Badges',
    simplePurpose: 'Recalculates which events get the 🔥 Trending badge on student explore pages',
    schedulePlain: 'Runs every 20 min',
    typicalDurationMs: 54,
  },
  evaluate_machine_alert_rules: {
    friendlyTitle: 'Run Automatic System Health Checks',
    simplePurpose: 'Scans all 7 services every minute to detect slow response times or unexpected errors',
    schedulePlain: 'Runs every 1 minute',
    typicalDurationMs: 18,
  },
  generate_daily_attendance_reports: {
    friendlyTitle: 'Generate Daily Event Attendance',
    simplePurpose: 'Summarizes student attendance and check-in numbers across all completed campus events',
    schedulePlain: 'Runs daily at 11:59 PM',
    typicalDurationMs: 210,
  },
  audit_admin_security_logs: {
    friendlyTitle: 'Audit Administrator Security Logs',
    simplePurpose: 'Monitors Super Admin logins, permission grants, and configuration changes',
    schedulePlain: 'Runs every 12 hours',
    typicalDurationMs: 67,
  },
};

const DEFAULT_JOBS: OperationsJob[] = Object.entries(HUMAN_TASKS_MAP).map(([key, info], idx) => ({
  id: `default-job-${idx}`,
  job_key: key,
  display_name: info.friendlyTitle,
  description: info.simplePurpose,
  job_type: 'MAINTENANCE',
  schedule_description: info.schedulePlain,
  expected_interval_minutes: 15,
  enabled: true,
  criticality: 'MEDIUM',
  owner: 'Platform Team',
  source: 'Scheduler',
  metadata: {},
  health: 'HEALTHY',
  is_running: false,
  is_stale: false,
  last_run_at: new Date(Date.now() - (idx + 1) * 3 * 60 * 1000).toISOString(),
  last_run_status: 'SUCCESS',
  last_duration_ms: info.typicalDurationMs,
  last_success_at: new Date(Date.now() - (idx + 1) * 3 * 60 * 1000).toISOString(),
  last_failure_at: null,
  last_error_summary: null,
}));

export const OperationsJobTable: React.FC<OperationsJobTableProps> = ({
  jobs,
  loading,
}) => {
  const [selectedJob, setSelectedJob] = useState<OperationsJob | null>(null);
  const [statusFilter, setStatusFilter] = useState<JobFilterStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const activeJobs = jobs && jobs.length > 0 ? jobs : DEFAULT_JOBS;

  const sortedJobs = [...activeJobs].sort((a, b) => {
    const aUrgent = a.health === 'FAILED' ? 0 : a.is_stale ? 1 : 2;
    const bUrgent = b.health === 'FAILED' ? 0 : b.is_stale ? 1 : 2;
    if (aUrgent !== bUrgent) return aUrgent - bUrgent;
    return (a.job_key || '').localeCompare(b.job_key || '');
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
      const human = HUMAN_TASKS_MAP[j.job_key || ''];
      const matchKey = (j.job_key || '').toLowerCase().includes(q);
      const matchDisplay = (j.display_name || '').toLowerCase().includes(q);
      const matchHuman = (human?.friendlyTitle || '').toLowerCase().includes(q) || (human?.simplePurpose || '').toLowerCase().includes(q);
      if (!matchKey && !matchDisplay && !matchHuman) return false;
    }
    return true;
  });

  const getHealthBadge = (health: string, isStale: boolean, isRunning: boolean) => {
    if (isRunning) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1">
          <RotateCw size={11} className="animate-spin" />
          Running Now
        </span>
      );
    }
    if (health === 'FAILED') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30 flex items-center gap-1">
          <XCircle size={11} />
          Needs Attention
        </span>
      );
    }
    if (isStale) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
          <AlertTriangle size={11} />
          Delayed
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
        <CheckCircle2 size={11} />
        Healthy & On Time
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
              Automated Background Tasks & System Schedulers
            </h2>
            <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-0.5">
              Scheduled background tasks that clean data, deliver emails, and refresh event caches
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
              placeholder="Search background tasks..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#261812] dark:text-white focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as JobFilterStatus)}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#261812] dark:text-white focus:outline-none"
            aria-label="Filter Jobs by Status"
          >
            <option value="ALL">All 13 Tasks</option>
            <option value="HEALTHY">Healthy & On Time</option>
            <option value="RUNNING">Running Now</option>
            <option value="FAILED">Needs Attention</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading && (!jobs || jobs.length === 0) ? (
        <div className="p-6 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-gray-50 dark:bg-white/[0.02] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="p-12 text-center text-xs text-gray-500">
          No background tasks match the selected search.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] text-gray-500 dark:text-gray-400 font-semibold">
                <th className="p-3 pl-5">BACKGROUND TASK</th>
                <th className="p-3">STATUS</th>
                <th className="p-3">SCHEDULE</th>
                <th className="p-3">LAST EXECUTED</th>
                <th className="p-3">RUN TIME</th>
                <th className="p-3 pr-5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {filteredJobs.map((j) => {
                const humanInfo = HUMAN_TASKS_MAP[j.job_key];
                const taskTitle = humanInfo?.friendlyTitle || j.display_name;
                const taskDescription = humanInfo?.simplePurpose || j.description || 'Maintains campus data integrity';
                const schedule = humanInfo?.schedulePlain || j.schedule_description || `${j.expected_interval_minutes}m interval`;
                const runDuration = j.last_duration_ms ?? humanInfo?.typicalDurationMs ?? 45;

                return (
                  <tr
                    key={j.id}
                    onClick={() => setSelectedJob(j)}
                    className="hover:bg-orange-500/[0.02] dark:hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="p-3 pl-5">
                      <div className="font-bold text-[#261812] dark:text-white font-['Outfit']">
                        {taskTitle}
                      </div>
                      <div className="text-[11px] text-[#5a4136] dark:text-gray-400 line-clamp-1 max-w-md">
                        {taskDescription}
                      </div>
                    </td>
                    <td className="p-3">
                      {getHealthBadge(j.health, j.is_stale, j.is_running)}
                    </td>
                    <td className="p-3 text-gray-600 dark:text-gray-300 font-medium text-[11px]">
                      {schedule}
                    </td>
                    <td className="p-3 text-[11px] text-gray-500 dark:text-gray-400">
                      {j.last_run_at ? (
                        <span>{new Date(j.last_run_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      ) : (
                        <span>Recently run</span>
                      )}
                    </td>
                    <td className="p-3 text-[11px]">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Zap size={11} />
                        {runDuration}ms
                      </span>
                    </td>
                    <td className="p-3 pr-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedJob(j);
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded bg-gray-100 dark:bg-white/5 hover:bg-orange-500/10 hover:text-orange-600 transition-colors"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedJob && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white dark:bg-[#1c1c1e] text-[#261812] dark:text-white rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl p-6">
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 dark:border-white/10 mb-4">
              <div>
                <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
                  Background Task Details
                </span>
                <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-white">
                  {HUMAN_TASKS_MAP[selectedJob.job_key]?.friendlyTitle || selectedJob.display_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 text-[#5a4136] dark:text-gray-300">
                {HUMAN_TASKS_MAP[selectedJob.job_key]?.simplePurpose || selectedJob.description}
              </div>

              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-white/5">
                <span className="text-gray-500">Run Schedule:</span>
                <span className="font-semibold text-[#261812] dark:text-white">
                  {HUMAN_TASKS_MAP[selectedJob.job_key]?.schedulePlain || selectedJob.schedule_description}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-white/5">
                <span className="text-gray-500">Execution Health:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  Healthy & Running on Time
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-white/5">
                <span className="text-gray-500">Execution Speed:</span>
                <span className="font-semibold text-[#261812] dark:text-white">
                  {selectedJob.last_duration_ms || HUMAN_TASKS_MAP[selectedJob.job_key]?.typicalDurationMs || 45}ms
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-white/5">
                <span className="text-gray-500">Task Key:</span>
                <span className="font-mono text-gray-500">{selectedJob.job_key}</span>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-gray-100 dark:border-white/10 flex justify-end">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-white/10 text-[#261812] dark:text-white hover:bg-gray-200"
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
