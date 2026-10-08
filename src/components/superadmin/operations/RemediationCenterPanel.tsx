// src/components/superadmin/operations/RemediationCenterPanel.tsx
// LPU Events — Phase 9: Safe Operational Remediation & Runbooks
// Controlled operational remediation layer for predefined, safe, reversible actions.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Wrench,
  ShieldCheck,
  ShieldAlert,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  Check,
  X,
  Terminal,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  OperationsRunbook,
  OperationsRemediationAction,
  OperationsRemediationExecution,
  OperationsRemediationDryRunResult,
  OperationsIncident,
  RemediationEnvironment,
} from '../../../shared/operations/types';
import { OperationsClient } from '../../../shared/operations/client';

interface RemediationCenterPanelProps {
  client: OperationsClient;
  incidents?: OperationsIncident[];
  onRefresh?: () => void;
}

type RemediationTab = 'RUNBOOKS' | 'RECOMMENDATIONS' | 'APPROVALS' | 'HISTORY' | 'DRY_RUN';

export const RemediationCenterPanel: React.FC<RemediationCenterPanelProps> = ({
  client,
  incidents = [],
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<RemediationTab>('RUNBOOKS');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Data states
  const [runbooks, setRunbooks] = useState<OperationsRunbook[]>([]);
  const [actions, setActions] = useState<OperationsRemediationAction[]>([]);
  const [executions, setExecutions] = useState<OperationsRemediationExecution[]>([]);

  // Selected Incident for Recommendations
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(incidents[0]?.id || '');
  const [recommendedRunbooks, setRecommendedRunbooks] = useState<OperationsRunbook[]>([]);
  const [recommendingLoading, setRecommendingLoading] = useState<boolean>(false);

  // Dry-Run Simulator state
  const [dryRunActionKey, setDryRunActionKey] = useState<string>('notification.retry_delivery');
  const [dryRunIncidentId, setDryRunIncidentId] = useState<string>('');
  const [dryRunEnv, setDryRunEnv] = useState<RemediationEnvironment>('PRODUCTION');
  const [dryRunParamsJson, setDryRunParamsJson] = useState<string>('{}');
  const [dryRunResult, setDryRunResult] = useState<OperationsRemediationDryRunResult | null>(null);
  const [dryRunLoading, setDryRunLoading] = useState<boolean>(false);

  // Approval / Confirmation Modal
  const [confirmModalExec, setConfirmModalExec] = useState<OperationsRemediationExecution | null>(null);
  const [rejectModalExec, setRejectModalExec] = useState<OperationsRemediationExecution | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Runbook Detail Modal
  const [inspectRunbook, setInspectRunbook] = useState<OperationsRunbook | null>(null);

  // Fetch initial registry & history
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const [rbRes, actRes, histRes] = await Promise.all([
        client.getRemediationRunbooks(),
        client.getRemediationActions(),
        client.getRemediationHistory({ limit: 50 }),
      ]);
      setRunbooks(rbRes.runbooks || []);
      setActions(actRes.actions || []);
      setExecutions(histRes.executions || []);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to load remediation records');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync selected incident if incidents prop updates
  useEffect(() => {
    if (!selectedIncidentId && incidents.length > 0) {
      setSelectedIncidentId(incidents[0].id);
    }
  }, [incidents, selectedIncidentId]);

  // Fetch recommendations whenever selected incident changes
  useEffect(() => {
    if (!selectedIncidentId) return;
    let active = true;
    setRecommendingLoading(true);
    client
      .recommendRemediation(selectedIncidentId)
      .then((res) => {
        if (active) {
          setRecommendedRunbooks(res.recommended_runbooks || []);
        }
      })
      .catch(() => {
        if (active) setRecommendedRunbooks([]);
      })
      .finally(() => {
        if (active) setRecommendingLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedIncidentId, client]);

  // Computed summary metrics
  const pendingApprovals = useMemo(() => {
    return executions.filter((e) => e.status === 'PENDING_APPROVAL');
  }, [executions]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayExecs = executions.filter((e) => new Date(e.created_at) >= today);
    const completed = todayExecs.filter((e) => e.status === 'COMPLETED').length;
    const failed = todayExecs.filter((e) => e.status === 'FAILED').length;
    const rate = todayExecs.length > 0 ? Math.round((completed / todayExecs.length) * 100) : 100;

    return {
      totalRunbooks: runbooks.length,
      totalActions: actions.length,
      pendingCount: pendingApprovals.length,
      todayCount: todayExecs.length,
      completedToday: completed,
      failedToday: failed,
      successRate: rate,
    };
  }, [runbooks, actions, executions, pendingApprovals]);

  // Handle Dry Run Simulation
  const handleRunDryRun = async () => {
    setDryRunLoading(true);
    setErrorBanner(null);
    setDryRunResult(null);
    try {
      let parsedParams = {};
      try {
        parsedParams = JSON.parse(dryRunParamsJson);
      } catch {
        throw new Error('Invalid JSON entered in parameters.');
      }

      const res = await client.dryRunRemediation({
        action_key: dryRunActionKey,
        incident_id: dryRunIncidentId || undefined,
        parameters: parsedParams,
        environment: dryRunEnv,
      });
      setDryRunResult(res);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Dry run evaluation failed');
    } finally {
      setDryRunLoading(false);
    }
  };

  // Handle Propose / Safe Execute
  const handleProposeOrExecute = async (actionKey: string, incidentId?: string) => {
    setActionInProgress(actionKey);
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      const res = await client.executeRemediation({
        action_key: actionKey,
        incident_id: incidentId || undefined,
        environment: 'PRODUCTION',
      });

      if (res.remediation.status === 'PENDING_APPROVAL') {
        setSuccessBanner(
          `Remediation proposed: Approval requested from Super Admin (ID: ${res.remediation.id.slice(0, 8)}).`
        );
        setActiveTab('APPROVALS');
      } else if (res.remediation.status === 'COMPLETED') {
        setSuccessBanner(
          `Remediation successfully executed and post-verified! (ID: ${res.remediation.id.slice(0, 8)})`
        );
      } else {
        setErrorBanner(
          `Remediation resulted in status ${res.remediation.status}: ${res.remediation.safe_error_message || 'Check execution logs.'}`
        );
      }

      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Remediation execution failed');
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle Super Admin Approval Execution
  const handleConfirmApproval = async (executionId: string) => {
    setActionInProgress(executionId);
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      const res = await client.approveRemediation(executionId);
      if (res.remediation.status === 'COMPLETED') {
        setSuccessBanner(`Remediation approved, executed, and verified successfully!`);
      } else {
        setSuccessBanner(`Remediation approved! Current status: ${res.remediation.status}`);
      }
      setConfirmModalExec(null);
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Approval execution failed');
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle Super Admin Reject
  const handleConfirmReject = async (executionId: string) => {
    setActionInProgress(executionId);
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      await client.rejectRemediation(executionId, rejectReason || 'Rejected by Super Admin.');
      setSuccessBanner('Remediation request rejected.');
      setRejectModalExec(null);
      setRejectReason('');
      await loadData();
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle Rollback
  const handleRollback = async (executionId: string) => {
    if (!window.confirm('Are you sure you want to trigger authoritative automated rollback for this execution?')) {
      return;
    }
    setActionInProgress(executionId);
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      const res = await client.rollbackRemediation(executionId);
      setSuccessBanner(`Rollback executed successfully. Status: ${res.remediation.status}`);
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="bg-[#fff9f6] dark:bg-[#1a120e] rounded-xl border border-[#e5dcd6] dark:border-[#38261e] p-6 shadow-sm transition-all">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[#e5dcd6] dark:border-[#38261e] gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-orange-600/10 text-orange-600 dark:text-orange-400">
              <Wrench size={20} />
            </span>
            <h2 className="text-xl font-bold font-['Outfit'] text-[#261812] dark:text-white">
              Safe Operational Remediation & Runbooks
            </h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Phase 9 Active
            </span>
          </div>
          <p className="text-sm text-[#5a4136] dark:text-[#aeaeb2] mt-1">
            Predefined, allowlisted, bounded remediation runbooks with fail-closed preconditions and post-action verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e5dcd6] dark:border-[#38261e] bg-white dark:bg-[#261812] text-[#5a4136] dark:text-[#aeaeb2] hover:bg-[#f5ede8] dark:hover:bg-[#38261e] transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Operational Banners */}
      {errorBanner && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between text-red-600 dark:text-red-400 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner(null)} className="p-1 hover:bg-red-500/10 rounded">
            <X size={14} />
          </button>
        </div>
      )}
      {successBanner && (
        <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="p-1 hover:bg-emerald-500/10 rounded">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div className="bg-white dark:bg-[#261812] p-4 rounded-lg border border-[#e5dcd6] dark:border-[#38261e]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#5a4136] dark:text-[#aeaeb2]">Approved Runbooks</span>
            <Layers size={14} className="text-[#5a4136] dark:text-[#aeaeb2]" />
          </div>
          <div className="text-2xl font-bold font-['Outfit'] text-[#261812] dark:text-white mt-1">
            {stats.totalRunbooks}
          </div>
          <div className="text-xs text-[#8c6d58] dark:text-[#aeaeb2]/80 mt-1">
            {stats.totalActions} allowlisted actions
          </div>
        </div>

        <div className={`p-4 rounded-lg border ${
          stats.pendingCount > 0
            ? 'bg-amber-500/5 border-amber-500/30'
            : 'bg-white dark:bg-[#261812] border-[#e5dcd6] dark:border-[#38261e]'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#5a4136] dark:text-[#aeaeb2]">Pending Approvals</span>
            <ShieldAlert size={14} className={stats.pendingCount > 0 ? 'text-amber-500' : 'text-[#5a4136]'} />
          </div>
          <div className={`text-2xl font-bold font-['Outfit'] mt-1 ${
            stats.pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[#261812] dark:text-white'
          }`}>
            {stats.pendingCount}
          </div>
          <div className="text-xs text-[#8c6d58] dark:text-[#aeaeb2]/80 mt-1">
            Level 2 Super Admin Signoffs
          </div>
        </div>

        <div className="bg-white dark:bg-[#261812] p-4 rounded-lg border border-[#e5dcd6] dark:border-[#38261e]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#5a4136] dark:text-[#aeaeb2]">Executions Today</span>
            <Activity size={14} className="text-[#5a4136] dark:text-[#aeaeb2]" />
          </div>
          <div className="text-2xl font-bold font-['Outfit'] text-[#261812] dark:text-white mt-1">
            {stats.todayCount}
          </div>
          <div className="text-xs text-[#8c6d58] dark:text-[#aeaeb2]/80 mt-1">
            {stats.completedToday} succeeded / {stats.failedToday} failed
          </div>
        </div>

        <div className="bg-white dark:bg-[#261812] p-4 rounded-lg border border-[#e5dcd6] dark:border-[#38261e]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#5a4136] dark:text-[#aeaeb2]">Post-Verified Success</span>
            <ShieldCheck size={14} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-['Outfit'] text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.successRate}%
          </div>
          <div className="text-xs text-[#8c6d58] dark:text-[#aeaeb2]/80 mt-1">
            Authoritative state confirmed
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center border-b border-[#e5dcd6] dark:border-[#38261e] mt-6 gap-2">
        <button
          onClick={() => setActiveTab('RUNBOOKS')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'RUNBOOKS'
              ? 'border-orange-600 text-orange-600 dark:text-orange-400'
              : 'border-transparent text-[#5a4136] dark:text-[#aeaeb2] hover:text-[#261812]'
          }`}
        >
          Runbook Registry ({runbooks.length})
        </button>
        <button
          onClick={() => setActiveTab('RECOMMENDATIONS')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'RECOMMENDATIONS'
              ? 'border-orange-600 text-orange-600 dark:text-orange-400'
              : 'border-transparent text-[#5a4136] dark:text-[#aeaeb2] hover:text-[#261812]'
          }`}
        >
          <Sparkles size={12} />
          Incident Recommendations
        </button>
        <button
          onClick={() => setActiveTab('APPROVALS')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'APPROVALS'
              ? 'border-orange-600 text-orange-600 dark:text-orange-400'
              : 'border-transparent text-[#5a4136] dark:text-[#aeaeb2] hover:text-[#261812]'
          }`}
        >
          Pending Approvals
          {pendingApprovals.length > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-500 text-white text-[10px] rounded-full font-bold">
              {pendingApprovals.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'HISTORY'
              ? 'border-orange-600 text-orange-600 dark:text-orange-400'
              : 'border-transparent text-[#5a4136] dark:text-[#aeaeb2] hover:text-[#261812]'
          }`}
        >
          Execution History ({executions.length})
        </button>
        <button
          onClick={() => setActiveTab('DRY_RUN')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'DRY_RUN'
              ? 'border-orange-600 text-orange-600 dark:text-orange-400'
              : 'border-transparent text-[#5a4136] dark:text-[#aeaeb2] hover:text-[#261812]'
          }`}
        >
          <Terminal size={12} />
          Safe Dry-Run Simulator
        </button>
      </div>

      {/* TAB CONTENT 1: RUNBOOK REGISTRY */}
      {activeTab === 'RUNBOOKS' && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-[#5a4136] dark:text-[#aeaeb2]">
              All runbooks are predefined in code and verified with fail-closed safety constraints.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {runbooks.map((rb) => {
              const matchedAction = actions.find((a) => a.runbook_id === rb.id || a.runbook_key === rb.runbook_key);
              return (
                <div
                  key={rb.id}
                  className="bg-white dark:bg-[#261812] border border-[#e5dcd6] dark:border-[#38261e] rounded-xl p-5 flex flex-col justify-between hover:border-orange-500/30 transition-all shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-[#261812] dark:text-white font-['Outfit']">
                            {rb.name}
                          </h3>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#f5ede8] dark:bg-[#38261e] text-[#5a4136] dark:text-[#aeaeb2]">
                            v{rb.version}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-[#8c6d58] dark:text-[#aeaeb2]/80">
                          {rb.runbook_key}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            rb.risk_level === 'LOW'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : rb.risk_level === 'MEDIUM'
                              ? 'bg-blue-500/10 text-blue-600'
                              : rb.risk_level === 'HIGH'
                              ? 'bg-amber-500/10 text-amber-600'
                              : 'bg-red-500/10 text-red-600'
                          }`}
                        >
                          {rb.risk_level} RISK
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400">
                          {rb.execution_mode.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-2 leading-relaxed">
                      {rb.description}
                    </p>

                    <div className="mt-4 space-y-1.5">
                      <div className="text-[11px] font-semibold text-[#261812] dark:text-white">
                        Safety Preconditions:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {rb.preconditions.map((p, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 bg-[#f5ede8] dark:bg-[#38261e] rounded text-[#5a4136] dark:text-[#aeaeb2]"
                          >
                            ✓ {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-[#e5dcd6] dark:border-[#38261e] flex items-center justify-between">
                    <button
                      onClick={() => setInspectRunbook(rb)}
                      className="text-xs text-[#5a4136] dark:text-[#aeaeb2] hover:text-[#261812] dark:hover:text-white flex items-center gap-1"
                    >
                      <Eye size={12} />
                      Inspect Details
                    </button>

                    <div className="flex items-center gap-2">
                      {matchedAction && (
                        <button
                          onClick={() => {
                            setDryRunActionKey(matchedAction.action_key);
                            setActiveTab('DRY_RUN');
                          }}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg border border-[#e5dcd6] dark:border-[#38261e] bg-white dark:bg-[#261812] text-[#5a4136] dark:text-[#aeaeb2] hover:bg-[#f5ede8] dark:hover:bg-[#38261e] transition-colors"
                        >
                          Simulate (Dry Run)
                        </button>
                      )}

                      {matchedAction && rb.execution_mode !== 'OBSERVE_ONLY' && (
                        <button
                          onClick={() => handleProposeOrExecute(matchedAction.action_key)}
                          disabled={actionInProgress === matchedAction.action_key}
                          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition-colors disabled:opacity-50"
                        >
                          <Play size={11} />
                          {rb.approval_required ? 'Request Approval' : 'Execute'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: INCIDENT RECOMMENDATIONS */}
      {activeTab === 'RECOMMENDATIONS' && (
        <div className="mt-6">
          <div className="bg-white dark:bg-[#261812] border border-[#e5dcd6] dark:border-[#38261e] rounded-xl p-5 mb-6">
            <label className="block text-xs font-bold text-[#261812] dark:text-white mb-2 uppercase tracking-wider">
              Select Active Incident for Runbook Correlation:
            </label>
            <select
              value={selectedIncidentId}
              onChange={(e) => setSelectedIncidentId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-[#e5dcd6] dark:border-[#38261e] bg-[#fff9f6] dark:bg-[#1a120e] text-[#261812] dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {incidents.length === 0 ? (
                <option value="">No Active Incidents Available</option>
              ) : (
                incidents.map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    [{inc.severity}] {inc.incident_key}: {inc.title} ({inc.status})
                  </option>
                ))
              )}
            </select>
          </div>

          {recommendingLoading ? (
            <div className="text-center py-12 text-xs text-[#5a4136] dark:text-[#aeaeb2]">
              <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-orange-600" />
              Evaluating incident telemetry against remediation rule catalog...
            </div>
          ) : recommendedRunbooks.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-[#261812] border border-[#e5dcd6] dark:border-[#38261e] rounded-xl p-6">
              <ShieldAlert size={32} className="mx-auto mb-2 text-slate-400" />
              <div className="text-sm font-semibold text-[#261812] dark:text-white">
                No Automated Runbooks Recommended
              </div>
              <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-1 max-w-md mx-auto">
                This incident does not match any allowlisted automatic remediation triggers, or its preconditions are not met. Operator manual diagnosis is advised.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs font-semibold text-[#261812] dark:text-white flex items-center gap-1.5">
                <Sparkles size={14} className="text-orange-500" />
                <span>Recommended Runbooks for Incident ({recommendedRunbooks.length}):</span>
              </div>

              {recommendedRunbooks.map((rb) => {
                const matchedAction = actions.find((a) => a.runbook_id === rb.id || a.runbook_key === rb.runbook_key);
                return (
                  <div
                    key={rb.id}
                    className="bg-white dark:bg-[#261812] border border-orange-500/20 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400 font-mono">
                          {rb.runbook_key}
                        </span>
                        <h4 className="text-sm font-bold text-[#261812] dark:text-white font-['Outfit']">
                          {rb.name}
                        </h4>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                            rb.risk_level === 'LOW'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-amber-500/10 text-amber-600'
                          }`}
                        >
                          {rb.risk_level} RISK
                        </span>
                      </div>
                      <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-1">
                        {rb.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {matchedAction && (
                        <button
                          onClick={() => {
                            setDryRunActionKey(matchedAction.action_key);
                            setDryRunIncidentId(selectedIncidentId);
                            setActiveTab('DRY_RUN');
                          }}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e5dcd6] dark:border-[#38261e] bg-white dark:bg-[#261812] text-[#5a4136] dark:text-[#aeaeb2] hover:bg-[#f5ede8] dark:hover:bg-[#38261e] transition-colors"
                        >
                          Run Dry Check
                        </button>
                      )}

                      {matchedAction && rb.execution_mode !== 'OBSERVE_ONLY' && (
                        <button
                          onClick={() => handleProposeOrExecute(matchedAction.action_key, selectedIncidentId)}
                          disabled={actionInProgress === matchedAction.action_key}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition-colors disabled:opacity-50"
                        >
                          <Play size={12} />
                          {rb.approval_required ? 'Request Approval' : 'Execute Remediation'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: PENDING APPROVALS */}
      {activeTab === 'APPROVALS' && (
        <div className="mt-6">
          {pendingApprovals.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-[#261812] border border-[#e5dcd6] dark:border-[#38261e] rounded-xl p-6">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
              <div className="text-sm font-semibold text-[#261812] dark:text-white">
                No Pending Super Admin Approvals
              </div>
              <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-1">
                All proposed remediation actions have been processed or expired.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-[#5a4136] dark:text-[#aeaeb2]">
                These actions have significant operational impact and require explicit Super Admin signoff before execution.
              </div>

              {pendingApprovals.map((exec) => (
                <div
                  key={exec.id}
                  className="bg-white dark:bg-[#261812] border border-amber-500/30 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600">
                        PENDING APPROVAL
                      </span>
                      <h4 className="text-sm font-bold text-[#261812] dark:text-white font-['Outfit']">
                        {exec.action_key}
                      </h4>
                      <span className="text-xs font-mono text-[#8c6d58] dark:text-[#aeaeb2]/80">
                        (ID: {exec.id.slice(0, 8)})
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-2">
                      <span>Requested by: <strong>{exec.requested_by}</strong></span>
                      <span>Env: <strong>{exec.environment}</strong></span>
                      <span>Attempt: <strong>{exec.attempt_count} / {exec.max_attempts}</strong></span>
                      <span>Created: <strong>{new Date(exec.created_at).toLocaleTimeString()}</strong></span>
                    </div>

                    {exec.parameters && Object.keys(exec.parameters).length > 0 && (
                      <div className="mt-2 text-[11px] font-mono bg-[#f5ede8] dark:bg-[#38261e] p-2 rounded text-[#5a4136] dark:text-[#aeaeb2]">
                        Parameters: {JSON.stringify(exec.parameters)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRejectModalExec(exec)}
                      disabled={actionInProgress === exec.id}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/20 text-red-600 hover:bg-red-500/5 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => setConfirmModalExec(exec)}
                      disabled={actionInProgress === exec.id}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition-colors"
                    >
                      <Check size={12} />
                      Review & Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 4: EXECUTION HISTORY */}
      {activeTab === 'HISTORY' && (
        <div className="mt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#e5dcd6] dark:border-[#38261e] text-[#8c6d58] dark:text-[#aeaeb2]/80">
                  <th className="py-2.5 px-3">Execution ID</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Post-Verification</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Started At</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5dcd6] dark:divide-[#38261e]">
                {executions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#5a4136] dark:text-[#aeaeb2]">
                      No remediation executions recorded yet.
                    </td>
                  </tr>
                ) : (
                  executions.map((exec) => {
                    const isSuccess = exec.status === 'COMPLETED';
                    const isFailed = exec.status === 'FAILED';
                    const isRolledBack = exec.status === 'ROLLED_BACK';

                    return (
                      <tr key={exec.id} className="hover:bg-white/50 dark:hover:bg-[#261812]/50">
                        <td className="py-3 px-3 font-mono text-[11px] text-[#261812] dark:text-white">
                          {exec.id.slice(0, 8)}...
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-[#261812] dark:text-white">
                            {exec.action_key}
                          </div>
                          <div className="text-[10px] text-[#8c6d58] dark:text-[#aeaeb2]/80">
                            {exec.runbook_key}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#f5ede8] dark:bg-[#38261e] text-[#5a4136] dark:text-[#aeaeb2]">
                            {exec.execution_mode}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isSuccess
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : isFailed
                                ? 'bg-red-500/10 text-red-600'
                                : isRolledBack
                                ? 'bg-purple-500/10 text-purple-600'
                                : 'bg-amber-500/10 text-amber-600'
                            }`}
                          >
                            {exec.status}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {exec.postcondition_verification?.verified ? (
                            <span className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                              <CheckCircle2 size={12} /> Verified
                            </span>
                          ) : isFailed ? (
                            <span className="flex items-center gap-1 text-red-600 text-[11px]">
                              <XCircle size={12} /> Failed
                            </span>
                          ) : (
                            <span className="text-[#8c6d58] dark:text-[#aeaeb2]/80 text-[11px]">
                              N/A
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#5a4136] dark:text-[#aeaeb2] text-[11px]">
                          {exec.executed_by || exec.requested_by}
                        </td>
                        <td className="py-3 px-3 text-[#5a4136] dark:text-[#aeaeb2] text-[11px]">
                          {new Date(exec.created_at).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {exec.status === 'COMPLETED' && (
                            <button
                              onClick={() => handleRollback(exec.id)}
                              disabled={actionInProgress === exec.id}
                              className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 ml-auto"
                            >
                              <RotateCcw size={11} /> Rollback
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: SAFE DRY-RUN SIMULATOR */}
      {activeTab === 'DRY_RUN' && (
        <div className="mt-6">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
            <ShieldCheck size={20} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-amber-800 dark:text-amber-400">
                DRY RUN MODE — ZERO STATE MUTATION GUARANTEE
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-1">
                Dry checks run all server-side safety preconditions (environment checks, concurrency single-flight, rate limits, attempt quotas, and parameters) without executing any underlying action or modifying the database.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4 bg-white dark:bg-[#261812] p-5 rounded-xl border border-[#e5dcd6] dark:border-[#38261e]">
              <div>
                <label className="block text-xs font-bold text-[#261812] dark:text-white mb-1.5 uppercase">
                  Select Action to Simulate:
                </label>
                <select
                  value={dryRunActionKey}
                  onChange={(e) => setDryRunActionKey(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-[#e5dcd6] dark:border-[#38261e] bg-[#fff9f6] dark:bg-[#1a120e] text-[#261812] dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {actions.map((act) => (
                    <option key={act.id} value={act.action_key}>
                      {act.action_key} ({act.risk_level})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#261812] dark:text-white mb-1.5 uppercase">
                  Target Environment:
                </label>
                <select
                  value={dryRunEnv}
                  onChange={(e) => setDryRunEnv(e.target.value as RemediationEnvironment)}
                  className="w-full text-xs p-2.5 rounded-lg border border-[#e5dcd6] dark:border-[#38261e] bg-[#fff9f6] dark:bg-[#1a120e] text-[#261812] dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  <option value="PRODUCTION">PRODUCTION</option>
                  <option value="STAGING">STAGING</option>
                  <option value="DEVELOPMENT">DEVELOPMENT</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#261812] dark:text-white mb-1.5 uppercase">
                  Associated Incident ID (Optional):
                </label>
                <input
                  type="text"
                  value={dryRunIncidentId}
                  onChange={(e) => setDryRunIncidentId(e.target.value)}
                  placeholder="Leave empty or enter incident UUID"
                  className="w-full text-xs p-2.5 rounded-lg border border-[#e5dcd6] dark:border-[#38261e] bg-[#fff9f6] dark:bg-[#1a120e] text-[#261812] dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#261812] dark:text-white mb-1.5 uppercase">
                  Parameters (JSON):
                </label>
                <textarea
                  value={dryRunParamsJson}
                  onChange={(e) => setDryRunParamsJson(e.target.value)}
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-lg border border-[#e5dcd6] dark:border-[#38261e] bg-[#fff9f6] dark:bg-[#1a120e] text-[#261812] dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                />
              </div>

              <button
                onClick={handleRunDryRun}
                disabled={dryRunLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition-colors disabled:opacity-50"
              >
                <Terminal size={14} />
                {dryRunLoading ? 'Evaluating Safety Constraints...' : 'Run Dry Check'}
              </button>
            </div>

            <div className="md:col-span-2 bg-white dark:bg-[#261812] p-5 rounded-xl border border-[#e5dcd6] dark:border-[#38261e]">
              <div className="flex items-center justify-between pb-3 border-b border-[#e5dcd6] dark:border-[#38261e] mb-4">
                <span className="text-xs font-bold text-[#261812] dark:text-white uppercase tracking-wider">
                  Simulation Outcome & Predicted Impact
                </span>
                {dryRunResult && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      dryRunResult.preconditions_passed
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-red-500/10 text-red-600'
                    }`}
                  >
                    {dryRunResult.preconditions_passed ? 'PRECONDITIONS PASSED' : 'PRECONDITIONS FAILED'}
                  </span>
                )}
              </div>

              {!dryRunResult ? (
                <div className="text-center py-16 text-xs text-[#5a4136] dark:text-[#aeaeb2]">
                  Select an action and run simulation to inspect authoritative preconditions and impact projections.
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-bold text-[#261812] dark:text-white">Safety Preconditions:</span>
                    <ul className="mt-1 space-y-1">
                      {dryRunResult.reasons.map((r, i) => (
                        <li
                          key={i}
                          className={`text-xs flex items-center gap-1.5 ${
                            dryRunResult.preconditions_passed ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {dryRunResult.preconditions_passed ? <Check size={12} /> : <X size={12} />}
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#e5dcd6] dark:border-[#38261e]">
                    <div className="bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/20">
                      <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                        WHAT WILL HAPPEN:
                      </div>
                      <ul className="text-xs text-emerald-600 dark:text-emerald-300 space-y-1">
                        {dryRunResult.predicted_impact.what_will_happen.map((item, idx) => (
                          <li key={idx}>• {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-slate-500/5 p-3 rounded-lg border border-slate-500/20">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        WHAT WILL NOT HAPPEN:
                      </div>
                      <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                        {dryRunResult.predicted_impact.what_will_not_happen.map((item, idx) => (
                          <li key={idx}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#5a4136] dark:text-[#aeaeb2] pt-4 border-t border-[#e5dcd6] dark:border-[#38261e]">
                    <span>Estimated Duration: <strong>~{dryRunResult.predicted_impact.estimated_duration_ms}ms</strong></span>
                    <span>Rollback Supported: <strong>{dryRunResult.rollback_available ? 'YES' : 'NO'}</strong></span>
                    <span>Approval Required: <strong>{dryRunResult.requires_approval ? 'YES (Level 2)' : 'NO (Level 1)'}</strong></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION / APPROVAL MODAL */}
      {confirmModalExec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#261812] border border-[#e5dcd6] dark:border-[#38261e] rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-3">
              <AlertTriangle size={20} />
              <h3 className="text-base font-bold font-['Outfit'] text-[#261812] dark:text-white">
                Approve and Execute Remediation
              </h3>
            </div>
            <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mb-4">
              You are about to authoritatively approve and execute action <strong>{confirmModalExec.action_key}</strong> in environment <strong>{confirmModalExec.environment}</strong>.
            </p>

            <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 mb-4 space-y-1">
              <div>• Requested By: {confirmModalExec.requested_by}</div>
              <div>• Attempt Count: {confirmModalExec.attempt_count} / {confirmModalExec.max_attempts}</div>
              <div>• Post-Action Verification will execute immediately after execution.</div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmModalExec(null)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e5dcd6] dark:border-[#38261e] text-[#5a4136] dark:text-[#aeaeb2]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmApproval(confirmModalExec.id)}
                disabled={actionInProgress === confirmModalExec.id}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition-colors"
              >
                {actionInProgress === confirmModalExec.id ? 'Executing...' : 'Approve and Execute Remediation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalExec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#261812] border border-[#e5dcd6] dark:border-[#38261e] rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold font-['Outfit'] text-[#261812] dark:text-white mb-2">
              Reject Remediation Request
            </h3>
            <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mb-3">
              Provide an operational reason for rejecting execution of {rejectModalExec.action_key}:
            </p>
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Superseded by manual database maintenance."
              className="w-full text-xs p-2.5 rounded-lg border border-[#e5dcd6] dark:border-[#38261e] bg-[#fff9f6] dark:bg-[#1a120e] text-[#261812] dark:text-white mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRejectModalExec(null)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e5dcd6] dark:border-[#38261e] text-[#5a4136] dark:text-[#aeaeb2]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmReject(rejectModalExec.id)}
                disabled={actionInProgress === rejectModalExec.id}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RUNBOOK DETAIL INSPECTION MODAL */}
      {inspectRunbook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#261812] border border-[#e5dcd6] dark:border-[#38261e] rounded-xl max-w-xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#e5dcd6] dark:border-[#38261e] mb-4">
              <div>
                <h3 className="text-base font-bold font-['Outfit'] text-[#261812] dark:text-white">
                  {inspectRunbook.name}
                </h3>
                <span className="text-xs font-mono text-[#8c6d58] dark:text-[#aeaeb2]/80">
                  {inspectRunbook.runbook_key}
                </span>
              </div>
              <button onClick={() => setInspectRunbook(null)} className="p-1 hover:bg-slate-500/10 rounded">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="font-bold text-[#261812] dark:text-white">Description:</span>
                <p className="text-[#5a4136] dark:text-[#aeaeb2] mt-1">{inspectRunbook.description}</p>
              </div>

              <div>
                <span className="font-bold text-[#261812] dark:text-white">Preconditions:</span>
                <ul className="list-disc pl-4 mt-1 text-[#5a4136] dark:text-[#aeaeb2] space-y-0.5">
                  {inspectRunbook.preconditions.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="font-bold text-[#261812] dark:text-white">Post-Verification Conditions:</span>
                <ul className="list-disc pl-4 mt-1 text-[#5a4136] dark:text-[#aeaeb2] space-y-0.5">
                  {inspectRunbook.postconditions.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#e5dcd6] dark:border-[#38261e]">
                <div>
                  <span className="font-bold text-[#261812] dark:text-white">Rollback Supported:</span>
                  <div>{inspectRunbook.rollback_supported ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <span className="font-bold text-[#261812] dark:text-white">Approval Required:</span>
                  <div>{inspectRunbook.approval_required ? 'Yes (Level 2)' : 'No (Level 1 Safe Auto)'}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setInspectRunbook(null)}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-orange-600 hover:bg-orange-700 text-white"
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
