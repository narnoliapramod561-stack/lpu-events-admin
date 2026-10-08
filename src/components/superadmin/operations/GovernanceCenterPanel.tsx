// src/components/superadmin/operations/GovernanceCenterPanel.tsx
// LPU Events — Phase 11: Reliability, Capacity & Production Readiness Governance UI

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
  Gauge,
} from 'lucide-react';
import { OperationsClient } from '../../../shared/operations/client';
import {
  OperationsSloDefinition,
  OperationsSloEvaluation,
  OperationsCapacityResource,
  OperationsReadinessEvaluation,
} from '../../../shared/operations/types';

interface GovernanceCenterPanelProps {
  client: OperationsClient;
  onRefresh?: () => void;
}

export const GovernanceCenterPanel: React.FC<GovernanceCenterPanelProps> = ({
  client,
}) => {
  const [activeTab, setActiveTab] = useState<'readiness' | 'slos' | 'capacity'>('readiness');
  const [loading, setLoading] = useState<boolean>(true);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Governance Data
  const [readiness, setReadiness] = useState<OperationsReadinessEvaluation | null>(null);
  const [slos, setSlos] = useState<OperationsSloDefinition[]>([]);
  const [sloEvaluations, setSloEvaluations] = useState<OperationsSloEvaluation[]>([]);
  const [capacityResources, setCapacityResources] = useState<OperationsCapacityResource[]>([]);

  const fetchGovernanceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [readinessRes, sloRes, capacityRes] = await Promise.all([
        client.evaluateReadiness().catch(() => null),
        client.getSloOverview().catch(() => ({ slos: [], evaluations: [] })),
        client.getCapacityOverview().catch(() => ({ resources: [] })),
      ]);

      if (readinessRes) setReadiness(readinessRes);
      if (sloRes) {
        setSlos(sloRes.slos || []);
        setSloEvaluations(sloRes.evaluations || []);
      }
      if (capacityRes) {
        setCapacityResources(capacityRes.resources || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load governance telemetry');
    } finally {
      setLoading(false);
    }
  };

  const handleReevaluateReadiness = async () => {
    setEvaluating(true);
    try {
      const res = await client.evaluateReadiness();
      setReadiness(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Readiness evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  useEffect(() => {
    fetchGovernanceData();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY':
      case 'MEETING':
      case 'SAFE':
      case 'HEALTHY':
      case 'PASS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case 'READY_WITH_WARNINGS':
      case 'AT_RISK':
      case 'WARNING':
      case 'WATCH':
      case 'WARN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50">
            <AlertTriangle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      case 'NOT_READY':
      case 'BREACHED':
      case 'CRITICAL':
      case 'EXHAUSTED':
      case 'FAIL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/50">
            <XCircle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
            <HelpCircle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden mb-8 transition-all">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Reliability, Capacity & Production Readiness Governance
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Authoritative SLI/SLO evaluation, error budget consumption, resource headroom, and release gates
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Navigation Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('readiness')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'readiness'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Release Readiness
            </button>
            <button
              onClick={() => setActiveTab('slos')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'slos'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              SLOs & Error Budgets
            </button>
            <button
              onClick={() => setActiveTab('capacity')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'capacity'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Capacity & Headroom
            </button>
          </div>

          <button
            onClick={fetchGovernanceData}
            disabled={loading}
            className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Refresh Governance Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/50 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="underline font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* Content Body */}
      <div className="p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
            <p className="text-sm font-medium">Evaluating authoritative governance contracts...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: PRODUCTION READINESS */}
            {activeTab === 'readiness' && (
              <div className="space-y-6">
                {/* Readiness Hero Banner */}
                <div className="p-5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-xs border border-slate-200/60 dark:border-slate-700/60">
                      <Gauge className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                          Production Readiness Gate
                        </span>
                        {readiness && getStatusBadge(readiness.overall_status)}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {readiness?.overall_status === 'READY'
                          ? 'Platform is Certified for Production Release'
                          : readiness?.overall_status === 'READY_WITH_WARNINGS'
                          ? 'Platform Ready with Operational Warnings'
                          : readiness?.overall_status === 'NOT_READY'
                          ? 'Release Blocked by Active Governance Failures'
                          : 'Readiness State Unknown (Fail-Closed)'}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Environment: <span className="font-semibold text-slate-700 dark:text-slate-300">{readiness?.environment || 'UNKNOWN'}</span> • Evaluated: {readiness ? new Date(readiness.evaluated_at).toLocaleTimeString() : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleReevaluateReadiness}
                      disabled={evaluating}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-xs disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
                      {evaluating ? 'Evaluating...' : 'Re-Evaluate Readiness'}
                    </button>
                  </div>
                </div>

                {/* Readiness Checks Table */}
                <div className="border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Authoritative Readiness Check Matrix
                    </span>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>Passed: <strong className="text-emerald-600 font-semibold">{readiness?.passed_count || 0}</strong></span>
                      <span>Warnings: <strong className="text-amber-600 font-semibold">{readiness?.warning_count || 0}</strong></span>
                      <span>Blockers: <strong className="text-rose-600 font-semibold">{readiness?.blocking_count || 0}</strong></span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {readiness?.checks.map((check) => (
                      <div key={check.check_key} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">{getStatusBadge(check.status)}</div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{check.name}</h4>
                              {check.blocking && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/50">
                                  BLOCKING
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Observed: <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">{check.observed_value}</span> • Target: <span className="font-mono text-slate-600 dark:text-slate-400">{check.expected_condition}</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-right text-[11px] text-slate-400">
                          Source: <span className="font-mono text-slate-500">{check.source}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: SLOS & ERROR BUDGETS */}
            {activeTab === 'slos' && (
              <div className="space-y-4">
                <div className="border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Service Level Objectives & Error Budget Consumption
                    </span>
                    <span className="text-xs text-slate-500">
                      Configured Objectives: <strong>{slos.length}</strong>
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {slos.map((slo) => {
                      const evaluation = sloEvaluations.find((e) => e.slo_key === slo.slo_key);
                      const eb = evaluation?.error_budget;

                      return (
                        <div key={slo.slo_key} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{slo.name}</h4>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {slo.service_id} • v{slo.version}
                                </span>
                                {evaluation && getStatusBadge(evaluation.status)}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Target: <strong className="font-mono text-slate-700 dark:text-slate-300">{slo.target}{slo.direction === 'GREATER_EQUAL' ? '%' : ''}</strong> ({slo.window} window) • Observed: <strong className="font-mono text-slate-900 dark:text-slate-100">{evaluation?.actual_value !== null ? evaluation?.actual_value : 'N/A'}</strong>
                              </p>
                            </div>

                            {/* Error Budget Bar & Status */}
                            {eb && (
                              <div className="w-full md:w-64">
                                <div className="flex items-center justify-between text-[11px] mb-1 font-medium">
                                  <span className="text-slate-500">Budget Consumed:</span>
                                  <span className="font-mono text-slate-900 dark:text-slate-100">{eb.consumption_percent}% ({eb.status})</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      eb.status === 'SAFE'
                                        ? 'bg-emerald-500'
                                        : eb.status === 'WARNING'
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${Math.min(100, eb.consumption_percent)}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CAPACITY & HEADROOM */}
            {activeTab === 'capacity' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {capacityResources.map((res) => {
                  const util = res.utilization_percent ?? 0;

                  return (
                    <div
                      key={res.resource_key}
                      className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {res.category}
                          </span>
                          {getStatusBadge(res.state)}
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
                          {res.name}
                        </h4>

                        <div className="text-xs text-slate-500 space-y-1 mb-3">
                          <div className="flex justify-between">
                            <span>Current Usage:</span>
                            <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                              {res.current_usage !== null ? res.current_usage.toLocaleString() : 'N/A'} {res.unit}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Hard Limit:</span>
                            <span className="font-mono text-slate-600 dark:text-slate-400">
                              {res.hard_limit !== null ? res.hard_limit.toLocaleString() : 'Uncapped'} {res.unit}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Available Headroom:</span>
                            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                              {res.headroom !== null ? res.headroom.toLocaleString() : 'N/A'} {res.unit}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Utilization Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-400 font-medium">Utilization:</span>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{util}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              res.state === 'HEALTHY'
                                ? 'bg-emerald-500'
                                : res.state === 'WATCH'
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, util)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GovernanceCenterPanel;
