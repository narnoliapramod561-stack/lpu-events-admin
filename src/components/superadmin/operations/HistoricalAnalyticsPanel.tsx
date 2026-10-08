// src/components/superadmin/operations/HistoricalAnalyticsPanel.tsx
// LPU Events — Phase 7: Historical Operations Analytics, MTTR & Trend Review

import React, { useState } from 'react';
import {
  History,
  Flame,
  ShieldAlert,
  Layers,
  Server
} from 'lucide-react';
import {
  OperationsAnalyticsWindow,
  OperationsIncidentAnalytics,
  OperationsAlertAnalytics,
  OperationsJobAnalytics,
  OperationsCrossServiceAnalytics,
} from '../../../shared/operations/types';
import { HistoricalTab } from './types';

interface HistoricalAnalyticsPanelProps {
  selectedWindow: OperationsAnalyticsWindow;
  onChangeWindow: (window: OperationsAnalyticsWindow) => void;
  incidentAnalytics: OperationsIncidentAnalytics | null;
  alertAnalytics: OperationsAlertAnalytics | null;
  jobAnalytics: OperationsJobAnalytics | null;
  crossServiceAnalytics: OperationsCrossServiceAnalytics | null;
  loading: boolean;
}

export const HistoricalAnalyticsPanel: React.FC<HistoricalAnalyticsPanelProps> = ({
  selectedWindow,
  onChangeWindow,
  incidentAnalytics,
  alertAnalytics,
  jobAnalytics,
  crossServiceAnalytics,
  loading,
}) => {
  const [activeTab, setActiveTab] = useState<HistoricalTab>('incidents');

  const windows: OperationsAnalyticsWindow[] = ['1h', '6h', '24h', '7d', '30d', '90d'];

  // Format milliseconds into human readable hours/minutes
  const formatDuration = (ms: number | null) => {
    if (ms === null || ms === undefined) return 'N/A';
    const totalSec = Math.floor(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    if (totalSec < 3600) return `${Math.floor(totalSec / 60)}m`;
    const hours = (ms / (1000 * 60 * 60)).toFixed(1);
    return `${hours}h`;
  };

  return (
    <div className="card-box mb-6 border border-[#e2bfb0] dark:border-white/10 rounded-xl bg-[#ffffff] dark:bg-[#202023] shadow-xs overflow-hidden">
      {/* Header & Window Controls */}
      <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <History size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold font-['Outfit'] text-[#261812] dark:text-white">
              Historical Operations & Rollup Analytics
            </h2>
            <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-0.5">
              Bounded time-window operational retrospectives, MTTR metrics & reliability rates
            </p>
          </div>
        </div>

        {/* Bounded Window Selector */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-lg border border-gray-200 dark:border-white/10">
          {windows.map((w) => (
            <button
              key={w}
              onClick={() => onChangeWindow(w)}
              className={`px-2.5 py-1 text-xs font-mono font-bold rounded-md transition-colors ${
                selectedWindow === w
                  ? 'bg-white dark:bg-[#202023] text-orange-600 dark:text-orange-400 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-4 sm:px-5 border-b border-gray-100 dark:border-white/5 gap-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('incidents')}
          className={`py-3 text-xs font-bold font-mono uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            activeTab === 'incidents'
              ? 'border-orange-500 text-orange-600 dark:text-orange-400'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Flame size={14} />
          Incidents & MTTR
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`py-3 text-xs font-bold font-mono uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            activeTab === 'alerts'
              ? 'border-orange-500 text-orange-600 dark:text-orange-400'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <ShieldAlert size={14} />
          Alert Rules & Frequency
        </button>

        <button
          onClick={() => setActiveTab('jobs')}
          className={`py-3 text-xs font-bold font-mono uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            activeTab === 'jobs'
              ? 'border-orange-500 text-orange-600 dark:text-orange-400'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Layers size={14} />
          Maintenance Reliability
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className={`py-3 text-xs font-bold font-mono uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            activeTab === 'services'
              ? 'border-orange-500 text-orange-600 dark:text-orange-400'
              : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Server size={14} />
          Cross-Service Stability
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="py-12 flex items-center justify-center text-xs text-gray-500">
            Loading historical rollups for {selectedWindow}...
          </div>
        ) : (
          <>
            {/* 1. Incidents Tab */}
            {activeTab === 'incidents' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
                    <div className="text-[11px] text-gray-400 font-mono">TOTAL INCIDENTS</div>
                    <div className="text-xl font-bold font-['Outfit'] mt-1">
                      {incidentAnalytics?.totalIncidents ?? 0}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
                    <div className="text-[11px] text-gray-400 font-mono">RESOLVED</div>
                    <div className="text-xl font-bold font-['Outfit'] mt-1 text-emerald-600 dark:text-emerald-400">
                      {incidentAnalytics?.resolvedIncidents ?? 0}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
                    <div className="text-[11px] text-gray-400 font-mono">BACKEND MTTR</div>
                    <div className="text-xl font-bold font-['Outfit'] mt-1 text-orange-600 dark:text-orange-400">
                      {formatDuration(incidentAnalytics?.mttrMs ?? null)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
                    <div className="text-[11px] text-gray-400 font-mono">AUTO RECOVERY</div>
                    <div className="text-xl font-bold font-['Outfit'] mt-1">
                      {incidentAnalytics?.automaticRecoveryCount ?? 0} (vs {incidentAnalytics?.manualResolutionCount ?? 0} manual)
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e]">
                  <h3 className="text-xs font-bold font-mono uppercase text-gray-500 mb-3">
                    Severity Distribution in Selected Window ({selectedWindow})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">
                      Critical: <strong>{incidentAnalytics?.bySeverity?.CRITICAL ?? 0}</strong>
                    </div>
                    <div className="p-2.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      High: <strong>{incidentAnalytics?.bySeverity?.HIGH ?? 0}</strong>
                    </div>
                    <div className="p-2.5 rounded bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20">
                      Warning: <strong>{incidentAnalytics?.bySeverity?.WARNING ?? 0}</strong>
                    </div>
                    <div className="p-2.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                      Info: <strong>{incidentAnalytics?.bySeverity?.INFO ?? 0}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Alerts Tab */}
            {activeTab === 'alerts' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
                    <div className="text-[11px] text-gray-400 font-mono">TOTAL ALERTS DETECTED</div>
                    <div className="text-xl font-bold font-['Outfit'] mt-1">
                      {alertAnalytics?.totalAlerts ?? 0}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
                    <div className="text-[11px] text-gray-400 font-mono">ALERT FREQUENCY</div>
                    <div className="text-xl font-bold font-['Outfit'] mt-1 text-orange-600">
                      {alertAnalytics?.alertFrequencyPerDay ? alertAnalytics.alertFrequencyPerDay.toFixed(1) : '0'}/day
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
                    <div className="text-[11px] text-gray-400 font-mono">OPEN ALERTS</div>
                    <div className="text-xl font-bold font-['Outfit'] mt-1">
                      {alertAnalytics?.openAlerts ?? 0}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e]">
                  <h3 className="text-xs font-bold font-mono uppercase text-gray-500 mb-3">
                    Top Recurring Alert Rules
                  </h3>
                  {(!alertAnalytics?.topRecurringRules || alertAnalytics.topRecurringRules.length === 0) ? (
                    <div className="text-xs text-gray-400 italic">No recurring alert rules triggered in this window.</div>
                  ) : (
                    <div className="space-y-2">
                      {alertAnalytics.topRecurringRules.map((rule, idx) => (
                        <div key={idx} className="p-2.5 rounded bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-[#261812] dark:text-white font-['Outfit']">{rule.title}</span>
                            <span className="text-[11px] font-mono text-gray-400 ml-2">ID: {rule.ruleId}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded font-mono font-bold bg-orange-500/10 text-orange-600">
                            {rule.count} triggers
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. Jobs Tab */}
            {activeTab === 'jobs' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
                    <div className="text-[11px] text-gray-400 font-mono">TOTAL EXECUTIONS</div>
                    <div className="text-xl font-bold font-['Outfit'] mt-1">
                      {jobAnalytics?.totalExecutions ?? 0}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
                    <div className="text-[11px] text-gray-400 font-mono">SUCCESS RATE</div>
                    <div className="text-xl font-bold font-['Outfit'] mt-1 text-emerald-600 dark:text-emerald-400">
                      {jobAnalytics?.successRate !== undefined ? `${jobAnalytics.successRate.toFixed(1)}%` : 'N/A'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
                    <div className="text-[11px] text-gray-400 font-mono">FAILED RUNS</div>
                    <div className="text-xl font-bold font-['Outfit'] mt-1 text-red-600 dark:text-red-400">
                      {jobAnalytics?.failedExecutions ?? 0}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
                    <div className="text-[11px] text-gray-400 font-mono">AVG DURATION</div>
                    <div className="text-xl font-bold font-['Outfit'] mt-1">
                      {jobAnalytics?.averageDurationMs ? `${jobAnalytics.averageDurationMs}ms` : 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e]">
                  <h3 className="text-xs font-bold font-mono uppercase text-gray-500 mb-3">
                    Execution Breakdown by Job
                  </h3>
                  {(!jobAnalytics?.byJob || Object.keys(jobAnalytics.byJob).length === 0) ? (
                    <div className="text-xs text-gray-400 italic">No job execution runs recorded in this window.</div>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(jobAnalytics.byJob).map(([jobKey, stats]) => (
                        <div key={jobKey} className="p-2.5 rounded bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 flex items-center justify-between text-xs font-mono">
                          <span className="font-bold">{jobKey}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-600 font-bold">{stats.success} succ</span>
                            {stats.failed > 0 && <span className="text-red-600 font-bold">{stats.failed} fail</span>}
                            <span className="text-gray-400">{stats.avgDurationMs}ms avg</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. Cross-Service Tab */}
            {activeTab === 'services' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
                    <div className="text-[11px] text-gray-400 font-mono">MOST UNSTABLE SERVICE</div>
                    <div className="text-lg font-bold font-['Outfit'] mt-1 text-amber-600 dark:text-amber-400">
                      {crossServiceAnalytics?.mostUnstableService?.serviceId || 'None (All Stable)'}
                    </div>
                    {crossServiceAnalytics?.mostUnstableService && (
                      <div className="text-xs text-gray-500 font-mono mt-0.5">
                        {crossServiceAnalytics.mostUnstableService.incidentCount} incidents • {crossServiceAnalytics.mostUnstableService.alertCount} alerts
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02]">
                    <div className="text-[11px] text-gray-400 font-mono">TOP RECURRING RULE (OVERALL)</div>
                    <div className="text-lg font-bold font-['Outfit'] mt-1">
                      {crossServiceAnalytics?.topRecurringAlertRule?.title || 'None'}
                    </div>
                    {crossServiceAnalytics?.topRecurringAlertRule && (
                      <div className="text-xs text-gray-500 font-mono mt-0.5">
                        Triggered {crossServiceAnalytics.topRecurringAlertRule.count} times
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e]">
                  <h3 className="text-xs font-bold font-mono uppercase text-gray-500 mb-3">
                    Service Incident & Alert Corroboration
                  </h3>
                  {(!crossServiceAnalytics?.services || Object.keys(crossServiceAnalytics.services).length === 0) ? (
                    <div className="text-xs text-gray-400 italic">No cross-service telemetry recorded for this window.</div>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(crossServiceAnalytics.services).map(([sId, stats]) => (
                        <div key={sId} className="p-2.5 rounded bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 flex items-center justify-between text-xs font-mono">
                          <span className="font-bold">{sId}</span>
                          <div className="flex items-center gap-4">
                            <span>{stats.incidentsCount} Incidents</span>
                            <span>{stats.alertsCount} Alerts</span>
                            {stats.healthProbeSuccessRate !== null && (
                              <span className="text-emerald-600 font-semibold">
                                {stats.healthProbeSuccessRate.toFixed(1)}% probe pass
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
