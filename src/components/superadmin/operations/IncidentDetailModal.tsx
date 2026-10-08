// src/components/superadmin/operations/IncidentDetailModal.tsx
// LPU Events — Phase 7: Incident Detail Drawer / Modal with Timeline & Certified Actions

import React, { useState, useEffect } from 'react';
import {
  X,
  Flame,
  CheckCircle2,
  Clock,
  Shield,
  RefreshCw,
  FileText
} from 'lucide-react';
import {
  OperationsIncident,
  OperationsIncidentDetail,
  OperationsIncidentEvent,
  OperationsSeverity,
} from '../../../shared/operations/types';
import { OperationsClient } from '../../../shared/operations/client';

interface IncidentDetailModalProps {
  incident: OperationsIncident;
  client: OperationsClient;
  onClose: () => void;
  onIncidentUpdated: () => void;
}

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  incident,
  client,
  onClose,
  onIncidentUpdated,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [detail, setDetail] = useState<OperationsIncidentDetail | null>(null);
  const [error, setError] = useState<string>('');

  // Mutation states
  const [isAcknowledging, setIsAcknowledging] = useState<boolean>(false);
  const [ackSuccess, setAckSuccess] = useState<string>('');

  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [showResolveDialog, setShowResolveDialog] = useState<boolean>(false);
  const [resolutionReason, setResolutionReason] = useState<string>('');
  const [resolveError, setResolveError] = useState<string>('');
  const [resolveSuccess, setResolveSuccess] = useState<string>('');

  // Load complete incident details, contributing alerts & chronological timeline
  const fetchDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await client.getIncident(incident.id);
      setDetail(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [incident.id]);

  // Acknowledge Action Flow
  const handleAcknowledge = async () => {
    setIsAcknowledging(true);
    setAckSuccess('');
    setError('');
    try {
      await client.acknowledgeIncident(incident.id);
      setAckSuccess('Incident acknowledged successfully.');
      onIncidentUpdated();
      await fetchDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Acknowledge failed: ${msg}`);
    } finally {
      setIsAcknowledging(false);
    }
  };

  // Manual Resolve Action Flow
  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionReason.trim() || resolutionReason.trim().length < 3) {
      setResolveError('Resolution reason is mandatory and must be at least 3 characters.');
      return;
    }

    setIsResolving(true);
    setResolveError('');
    try {
      await client.resolveIncident(incident.id, resolutionReason.trim());
      setResolveSuccess('Incident manually resolved.');
      setShowResolveDialog(false);
      setResolutionReason('');
      onIncidentUpdated();
      await fetchDetail();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setResolveError(`Resolution failed: ${msg}`);
    } finally {
      setIsResolving(false);
    }
  };

  // Duration calculation
  const getDurationString = () => {
    const start = new Date(incident.opened_at).getTime();
    const end = incident.resolved_at ? new Date(incident.resolved_at).getTime() : Date.now();
    const diffSec = Math.max(0, Math.floor((end - start) / 1000));
    if (diffSec < 60) return `${diffSec} seconds`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes`;
    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const getSeverityBadgeClass = (sev: OperationsSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30';
      case 'HIGH':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'WARNING':
        return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30';
    }
  };

  const currentInc = detail?.incident || incident;
  const isResolved = currentInc.status === 'RESOLVED';
  const isAcknowledged = currentInc.status === 'ACKNOWLEDGED';

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incident-modal-title"
    >
      <div className="w-full max-w-3xl min-h-screen bg-[#ffffff] dark:bg-[#1c1c1e] text-[#261812] dark:text-white border-l border-[#e2bfb0] dark:border-white/10 shadow-2xl flex flex-col p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-200 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${getSeverityBadgeClass(currentInc.severity)}`}>
                {currentInc.severity}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold uppercase border ${
                isResolved
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : isAcknowledged
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                  : 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
              }`}>
                {currentInc.status}
              </span>
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                Service: <strong className="text-[#261812] dark:text-white">{currentInc.service_id}</strong>
              </span>
            </div>
            <h2 id="incident-modal-title" className="text-xl font-bold font-['Outfit'] text-[#261812] dark:text-white">
              {currentInc.title}
            </h2>
            <div className="text-xs text-[#5a4136] dark:text-[#8e8e93] font-mono mt-1">
              ID: {currentInc.id} • Group: {currentInc.group_key}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            aria-label="Close incident detail"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Banners & Success Messages */}
        {ackSuccess && (
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium">
            {ackSuccess}
          </div>
        )}
        {resolveSuccess && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-medium">
            {resolveSuccess}
          </div>
        )}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 rounded-lg text-xs font-medium">
            {error}
          </div>
        )}

        {/* Operational Actions Bar */}
        {!isResolved && (
          <div className="mt-4 p-3 rounded-lg bg-[#ffeae1] dark:bg-white/5 border border-[#e2bfb0] dark:border-white/10 flex items-center justify-between flex-wrap gap-3">
            <span className="text-xs font-semibold text-[#5a4136] dark:text-[#aeaeb2]">
              Super Admin Incident Actions:
            </span>
            <div className="flex items-center gap-2">
              {!isAcknowledged && (
                <button
                  onClick={handleAcknowledge}
                  disabled={isAcknowledging}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isAcknowledging ? <RefreshCw size={13} className="animate-spin" /> : <Shield size={13} />}
                  Acknowledge Incident
                </button>
              )}

              <button
                onClick={() => setShowResolveDialog(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 size={13} />
                Resolve Incident
              </button>
            </div>
          </div>
        )}

        {/* Resolution Dialog / Reason Prompt */}
        {showResolveDialog && (
          <div className="mt-4 p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20">
            <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-2 flex items-center gap-1.5">
              <CheckCircle2 size={16} />
              Manual Incident Resolution
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
              Server-side audit requires a descriptive resolution reason (minimum 3 characters). This will record resolution provenance as <strong>MANUAL</strong> with your Super Admin attribution.
            </p>
            <form onSubmit={handleResolveSubmit} className="space-y-3">
              <textarea
                value={resolutionReason}
                onChange={(e) => setResolutionReason(e.target.value)}
                placeholder="Describe resolution actions taken, verified telemetry, or root cause mitigation..."
                className="w-full text-xs p-2.5 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202023] text-[#261812] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                rows={3}
                required
              />
              {resolveError && (
                <div className="text-xs text-red-600 dark:text-red-400 font-medium">
                  {resolveError}
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowResolveDialog(false); setResolveError(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResolving}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isResolving && <RefreshCw size={13} className="animate-spin" />}
                  Confirm Resolution
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Content Body */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <RefreshCw size={24} className="animate-spin text-orange-500" />
            <span className="text-xs text-gray-500">Loading incident detail & timeline...</span>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Metadata Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
                <div className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-semibold">Opened At</div>
                <div className="text-xs font-mono font-medium mt-1">
                  {new Date(currentInc.opened_at).toLocaleTimeString()}
                </div>
                <div className="text-[10px] text-gray-400">
                  {new Date(currentInc.opened_at).toLocaleDateString()}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
                <div className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-semibold">Duration</div>
                <div className="text-xs font-mono font-medium mt-1">
                  {getDurationString()}
                </div>
                <div className="text-[10px] text-gray-400">
                  {isResolved ? 'Resolved' : 'Ongoing'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
                <div className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-semibold">Resolution Type</div>
                <div className="text-xs font-mono font-bold mt-1 text-[#261812] dark:text-white">
                  {currentInc.resolution_type || 'ACTIVE / NONE'}
                </div>
                <div className="text-[10px] text-gray-400">
                  {currentInc.resolution_type === 'AUTO_RECOVERY' ? 'Automatic Machine Recovery' : currentInc.resolution_type === 'MANUAL' ? 'Manual Super Admin Action' : 'In Progress'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
                <div className="text-[11px] text-gray-500 dark:text-gray-400 uppercase font-semibold">Alert Count</div>
                <div className="text-xs font-mono font-bold mt-1">
                  {(detail?.active_alerts?.length || 0) + (detail?.resolved_alerts?.length || 0)} Total
                </div>
                <div className="text-[10px] text-gray-400">
                  {detail?.active_alerts?.length || 0} active • {detail?.resolved_alerts?.length || 0} resolved
                </div>
              </div>
            </div>

            {/* Resolution Provenance Details (if resolved) */}
            {isResolved && (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mb-2">
                  <CheckCircle2 size={16} />
                  Resolution Provenance ({currentInc.resolution_type || 'MANUAL'})
                </div>
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Resolved At:</span>{' '}
                    <strong className="font-mono">{currentInc.resolved_at ? new Date(currentInc.resolved_at).toLocaleString() : 'N/A'}</strong>
                  </div>
                  {currentInc.resolved_by && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Resolved By:</span>{' '}
                      <strong className="font-mono">{currentInc.resolved_by}</strong>
                    </div>
                  )}
                  {currentInc.resolution_reason && (
                    <div className="mt-2 pt-2 border-t border-emerald-500/20">
                      <span className="text-gray-500 dark:text-gray-400 block mb-0.5 font-medium">Resolution Reason:</span>
                      <p className="font-mono bg-white/60 dark:bg-black/30 p-2 rounded border border-emerald-500/20 text-[#261812] dark:text-white">
                        {currentInc.resolution_reason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contributing Active Alerts */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#5a4136] dark:text-[#aeaeb2] mb-3 flex items-center gap-1.5">
                <Flame size={14} className="text-red-500" />
                Contributing Machine Alerts ({detail?.active_alerts?.length || 0} Active)
              </h3>
              {(!detail?.active_alerts || detail.active_alerts.length === 0) ? (
                <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 text-xs text-gray-500 italic">
                  No active alerts for this incident.
                </div>
              ) : (
                <div className="space-y-2">
                  {detail.active_alerts.map((al) => (
                    <div
                      key={al.id}
                      className="p-3 rounded-lg border border-red-500/20 dark:border-red-500/30 bg-red-500/5 dark:bg-red-950/20 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-bold text-red-700 dark:text-red-300 font-['Outfit']">
                          {al.title}
                        </span>
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-red-500/20 text-red-700 dark:text-red-400">
                          {al.severity} • {al.occurrence_count} occurrences
                        </span>
                      </div>
                      <p className="text-xs text-[#5a4136] dark:text-gray-300">
                        {al.message}
                      </p>
                      {/* Safe Evidence */}
                      <div className="mt-1 pt-1.5 border-t border-red-500/15 flex items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                        {al.last_value !== null && al.last_value !== undefined && (
                          <span>Observed: <strong>{al.last_value}</strong></span>
                        )}
                        {al.threshold_value !== null && al.threshold_value !== undefined && (
                          <span>Threshold: <strong>{al.threshold_value}</strong></span>
                        )}
                        <span>First detected: {new Date(al.first_detected_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resolved Alerts contributing previously */}
            {detail?.resolved_alerts && detail.resolved_alerts.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#5a4136] dark:text-[#aeaeb2] mb-3 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  Resolved Alerts ({detail.resolved_alerts.length})
                </h3>
                <div className="space-y-2 opacity-80">
                  {detail.resolved_alerts.map((al) => (
                    <div
                      key={al.id}
                      className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-gray-700 dark:text-gray-300">{al.title}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Resolved at: {al.resolved_at ? new Date(al.resolved_at).toLocaleTimeString() : 'N/A'}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        RESOLVED
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Safe Operational Evidence */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#5a4136] dark:text-[#aeaeb2] mb-3 flex items-center gap-1.5">
                <FileText size={14} className="text-[#a04100] dark:text-orange-400" />
                Operational Evidence & Correlation
              </h3>
              <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-500">Correlation ID:</span>
                  <span className="text-[#261812] dark:text-white">{currentInc.correlation_id || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Primary Alert ID:</span>
                  <span className="text-[#261812] dark:text-white">{currentInc.primary_alert_id || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Activity:</span>
                  <span className="text-[#261812] dark:text-white">{new Date(currentInc.last_activity_at).toLocaleString()}</span>
                </div>
                {currentInc.metadata && Object.keys(currentInc.metadata).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-white/10">
                    <span className="text-gray-500 block mb-1">Metadata:</span>
                    <pre className="text-[11px] p-2 rounded bg-black/5 dark:bg-black/30 overflow-x-auto text-gray-700 dark:text-gray-300">
                      {JSON.stringify(currentInc.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Chronological Event Timeline */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#5a4136] dark:text-[#aeaeb2] mb-3 flex items-center gap-1.5">
                <Clock size={14} className="text-[#a04100] dark:text-orange-400" />
                Event Timeline ({detail?.timeline?.length || 0} Events)
              </h3>
              {(!detail?.timeline || detail.timeline.length === 0) ? (
                <div className="p-3 rounded-lg border border-gray-200 dark:border-white/10 text-xs text-gray-500 italic">
                  No timeline events recorded.
                </div>
              ) : (
                <div className="relative border-l-2 border-orange-500/30 ml-3 pl-4 space-y-4">
                  {detail.timeline.map((ev: OperationsIncidentEvent) => (
                    <div key={ev.id} className="relative group">
                      {/* Timeline dot */}
                      <span className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-orange-500 ring-4 ring-[#ffffff] dark:ring-[#1c1c1e]" />
                      <div className="flex items-center justify-between text-xs font-mono mb-0.5">
                        <span className="font-bold text-[#261812] dark:text-white">
                          {ev.event_type}
                        </span>
                        <span className="text-gray-400 text-[11px]">
                          {new Date(ev.occurred_at).toLocaleTimeString()} ({new Date(ev.occurred_at).toLocaleDateString()})
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-200 dark:bg-white/10">
                          {ev.actor_type}
                        </span>
                        <span className="text-[11px] font-mono text-gray-500">
                          Actor: {ev.actor_id}
                        </span>
                      </div>
                      {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                        <div className="mt-1 text-[11px] font-mono text-gray-500">
                          {JSON.stringify(ev.metadata)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
