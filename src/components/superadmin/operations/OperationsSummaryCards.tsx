// src/components/superadmin/operations/OperationsSummaryCards.tsx
// LPU Events — Phase 7: Top-Level Authoritative Operational Summary Cards

import React from 'react';
import {
  Activity,
  AlertTriangle,
  Flame,
  CheckCircle2,
  HelpCircle,
  Server,
  Layers,
  Database
} from 'lucide-react';
import { OperationsOverview } from '../../../shared/operations/types';

interface OperationsSummaryCardsProps {
  overview: OperationsOverview | null;
  loading: boolean;
  isFailed?: boolean;
  onNavigateToIncidents?: () => void;
  onNavigateToJobs?: () => void;
  onNavigateToServices?: () => void;
}

export const OperationsSummaryCards: React.FC<OperationsSummaryCardsProps> = ({
  overview,
  loading,
  isFailed,
  onNavigateToIncidents,
  onNavigateToJobs,
  onNavigateToServices,
}) => {
  if (loading && !overview) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card-box p-4 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-[#ffffff] dark:bg-[#202023] animate-pulse">
            <div className="h-4 w-24 bg-gray-200 dark:bg-white/10 rounded mb-3" />
            <div className="h-8 w-16 bg-gray-300 dark:bg-white/15 rounded mb-2" />
            <div className="h-3 w-32 bg-gray-200 dark:bg-white/10 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const isUnavailable = !overview || !!isFailed;

  // Derive authoritative states strictly from backend payload
  const statusStr = (overview?.overall_status || 'UNKNOWN').toUpperCase();
  const isCritical = statusStr === 'CRITICAL';
  const isDegraded = statusStr === 'DEGRADED';
  const isHealthy = statusStr === 'HEALTHY' || statusStr === 'OPERATIONAL';

  const incidentsSummary = (overview as any)?.incidents_summary || {
    open: 0,
    acknowledged: 0,
    critical: 0,
    high: 0,
  };

  const alertsSummary = (overview as any)?.alerts_summary || {
    open_critical: 0,
    open_high: 0,
    open_warning: 0,
    total_open: 0,
  };

  const jobsSummary = (overview as any)?.jobs_summary || {
    total_jobs: 0,
    healthy_jobs: 0,
    running_jobs: 0,
    stale_jobs: 0,
    failed_jobs: 0,
  };

  const servicesSummary = overview?.services_summary || {
    total_registered: 0,
    monitored_in_phase_2: 0,
    unmonitored: 0,
  };

  const dbHealth = overview?.database_health || 'UNKNOWN';

  // Overall status styling
  const getOverallBadge = () => {
    if (isUnavailable) {
      return {
        label: 'UNAVAILABLE',
        icon: <AlertTriangle size={18} className="text-red-500" />,
        bg: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400',
        ring: 'border-red-500/30',
        description: 'Unable to retrieve operational telemetry from gateway',
      };
    }
    if (isCritical) {
      return {
        label: 'CRITICAL',
        icon: <Flame size={18} className="text-red-600 dark:text-red-400" />,
        bg: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400',
        ring: 'border-red-500/40',
        description: 'Active critical incident requires immediate intervention',
      };
    }
    if (isDegraded) {
      return {
        label: 'DEGRADED',
        icon: <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />,
        bg: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400',
        ring: 'border-amber-500/40',
        description: 'Services or jobs degraded with active warning alerts',
      };
    }
    if (isHealthy) {
      return {
        label: 'OPERATIONAL',
        icon: <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />,
        bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
        ring: 'border-emerald-500/40',
        description: 'All registered services & telemetry probes healthy',
      };
    }
    return {
      label: statusStr || 'UNKNOWN',
      icon: <HelpCircle size={18} className="text-gray-500" />,
      bg: 'bg-gray-500/10 border-gray-500/30 text-gray-700 dark:text-gray-400',
      ring: 'border-gray-500/40',
      description: 'System state evaluating',
    };
  };

  const overallBadge = getOverallBadge();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Authoritative System Health Card */}
      <div className={`card-box p-4 rounded-xl border ${overallBadge.ring} bg-[#ffffff] dark:bg-[#202023] shadow-xs flex flex-col justify-between`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-[#5a4136] dark:text-[#aeaeb2] uppercase tracking-wider flex items-center gap-1.5">
            <Activity size={14} className="text-[#a04100] dark:text-orange-400" />
            System Status
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border flex items-center gap-1 ${overallBadge.bg}`}>
            {overallBadge.icon}
            {overallBadge.label}
          </span>
        </div>
        <div className="my-1">
          <div className="text-2xl font-black font-['Outfit'] text-[#261812] dark:text-white">
            {overallBadge.label}
          </div>
          <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-1 leading-snug">
            {overallBadge.description}
          </p>
        </div>
        <div className="mt-3 pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-[11px] text-[#5a4136] dark:text-[#8e8e93]">
          <span className="flex items-center gap-1">
            <Database size={12} />
            Postgres: <strong className="font-mono text-[#261812] dark:text-white">{isUnavailable ? 'UNAVAILABLE' : dbHealth}</strong>
          </span>
          <span className="font-mono text-[10px]">Gateway v1</span>
        </div>
      </div>

      {/* 2. Active Incidents & Alerts Card */}
      <div
        onClick={onNavigateToIncidents}
        className={`card-box p-4 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-[#ffffff] dark:bg-[#202023] shadow-xs flex flex-col justify-between transition-all ${
          onNavigateToIncidents ? 'cursor-pointer hover:border-orange-500/50 hover:shadow-md' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-[#5a4136] dark:text-[#aeaeb2] uppercase tracking-wider flex items-center gap-1.5">
            <Flame size={14} className="text-red-500" />
            Active Incidents
          </span>
          {isUnavailable ? (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-gray-500/15 text-gray-600 dark:text-gray-400 border border-gray-500/30">
              UNAVAILABLE
            </span>
          ) : incidentsSummary.critical > 0 ? (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
              {incidentsSummary.critical} CRITICAL
            </span>
          ) : incidentsSummary.high > 0 ? (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              {incidentsSummary.high} HIGH
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              NONE
            </span>
          )}
        </div>
        <div className="my-1">
          <div className="text-3xl font-black font-['Outfit'] text-[#261812] dark:text-white flex items-baseline gap-2">
            {isUnavailable ? (
              <span className="text-lg text-red-600 dark:text-red-400">UNAVAILABLE</span>
            ) : (
              <>
                <span>{incidentsSummary.open}</span>
                <span className="text-xs font-normal text-[#5a4136] dark:text-[#8e8e93]">
                  open ({incidentsSummary.acknowledged} acked)
                </span>
              </>
            )}
          </div>
          <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-1">
            {isUnavailable
              ? 'Unable to retrieve incident telemetry'
              : `${alertsSummary.total_open} machine alerts active (${alertsSummary.open_critical} crit, ${alertsSummary.open_high} high)`}
          </p>
        </div>
        <div className="mt-3 pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-[11px] text-[#5a4136] dark:text-[#8e8e93]">
          <span>Correlated Incident Engine</span>
          <span className="text-[#a04100] dark:text-orange-400 font-semibold hover:underline">View Incidents →</span>
        </div>
      </div>

      {/* 3. Service Health & Coverage Card */}
      <div
        onClick={onNavigateToServices}
        className={`card-box p-4 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-[#ffffff] dark:bg-[#202023] shadow-xs flex flex-col justify-between transition-all ${
          onNavigateToServices ? 'cursor-pointer hover:border-orange-500/50 hover:shadow-md' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-[#5a4136] dark:text-[#aeaeb2] uppercase tracking-wider flex items-center gap-1.5">
            <Server size={14} className="text-[#a04100] dark:text-orange-400" />
            Registered Services
          </span>
          {isUnavailable ? (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-gray-500/15 text-gray-600 dark:text-gray-400 border border-gray-500/30">
              UNAVAILABLE
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
              {servicesSummary.total_registered} TOTAL
            </span>
          )}
        </div>
        <div className="my-1">
          <div className="text-3xl font-black font-['Outfit'] text-[#261812] dark:text-white flex items-baseline gap-2">
            {isUnavailable ? (
              <span className="text-lg text-red-600 dark:text-red-400">UNAVAILABLE</span>
            ) : (
              <>
                <span>{(servicesSummary as any).healthy_services ?? servicesSummary.total_registered}</span>
                <span className="text-xs font-normal text-[#5a4136] dark:text-[#8e8e93]">healthy</span>
              </>
            )}
          </div>
          <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-1">
            {isUnavailable
              ? 'Unable to retrieve service catalog'
              : `${(servicesSummary as any).unconfigured || 0} not configured • ${servicesSummary.unmonitored || 0} unmonitored`}
          </p>
        </div>
        <div className="mt-3 pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-[11px] text-[#5a4136] dark:text-[#8e8e93]">
          <span>Coverage: Tier-0 Core Services</span>
          <span className="text-[#a04100] dark:text-orange-400 font-semibold hover:underline">View Grid →</span>
        </div>
      </div>

      {/* 4. Operations Jobs Health Card */}
      <div
        onClick={onNavigateToJobs}
        className={`card-box p-4 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-[#ffffff] dark:bg-[#202023] shadow-xs flex flex-col justify-between transition-all ${
          onNavigateToJobs ? 'cursor-pointer hover:border-orange-500/50 hover:shadow-md' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-[#5a4136] dark:text-[#aeaeb2] uppercase tracking-wider flex items-center gap-1.5">
            <Layers size={14} className="text-[#a04100] dark:text-orange-400" />
            Maintenance Jobs
          </span>
          {isUnavailable ? (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-gray-500/15 text-gray-600 dark:text-gray-400 border border-gray-500/30">
              UNAVAILABLE
            </span>
          ) : jobsSummary.failed_jobs > 0 ? (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
              {jobsSummary.failed_jobs} FAILED
            </span>
          ) : jobsSummary.stale_jobs > 0 ? (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              {jobsSummary.stale_jobs} STALE
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              ALL HEALTHY
            </span>
          )}
        </div>
        <div className="my-1">
          <div className="text-3xl font-black font-['Outfit'] text-[#261812] dark:text-white flex items-baseline gap-2">
            {isUnavailable ? (
              <span className="text-lg text-red-600 dark:text-red-400">UNAVAILABLE</span>
            ) : (
              <>
                <span>{jobsSummary.healthy_jobs}</span>
                <span className="text-xs font-normal text-[#5a4136] dark:text-[#8e8e93]">
                  / {jobsSummary.total_jobs} healthy
                </span>
              </>
            )}
          </div>
          <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-1">
            {isUnavailable
              ? 'Unable to retrieve job telemetry'
              : `${jobsSummary.running_jobs} currently running • ${jobsSummary.stale_jobs} stale runs`}
          </p>
        </div>
        <div className="mt-3 pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-[11px] text-[#5a4136] dark:text-[#8e8e93]">
          <span>Cron & Background Telemetry</span>
          <span className="text-[#a04100] dark:text-orange-400 font-semibold hover:underline">View Jobs →</span>
        </div>
      </div>
    </div>
  );
};
