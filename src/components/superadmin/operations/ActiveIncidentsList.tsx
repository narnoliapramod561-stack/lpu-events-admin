// src/components/superadmin/operations/ActiveIncidentsList.tsx
// LPU Events — Phase 7: Prioritized Active Incidents List & Investigation Surface

import React, { useState } from 'react';
import {
  Flame,
  Shield,
  Search,
  ChevronRight,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import {
  OperationsIncident,
  OperationsSeverity,
} from '../../../shared/operations/types';
import { OperationsClient } from '../../../shared/operations/client';
import { IncidentFilterSeverity, IncidentFilterStatus } from './types';
import { IncidentDetailModal } from './IncidentDetailModal';

interface ActiveIncidentsListProps {
  incidents: OperationsIncident[];
  loading: boolean;
  isFailed?: boolean;
  client: OperationsClient;
  onRefreshIncidents: () => void;
}

export const ActiveIncidentsList: React.FC<ActiveIncidentsListProps> = ({
  incidents,
  loading,
  isFailed,
  client,
  onRefreshIncidents,
}) => {
  const [selectedIncident, setSelectedIncident] = useState<OperationsIncident | null>(null);
  const [severityFilter, setSeverityFilter] = useState<IncidentFilterSeverity>('ALL');
  const [statusFilter, setStatusFilter] = useState<IncidentFilterStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  // Sorting strictly by operational urgency: CRITICAL > HIGH > WARNING > INFO, then opened_at descending
  const severityRank: Record<OperationsSeverity, number> = {
    CRITICAL: 0,
    HIGH: 1,
    WARNING: 2,
    INFO: 3,
  };

  const sortedIncidents = [...incidents].sort((a, b) => {
    const rankDiff = (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime();
  });

  const filteredIncidents = sortedIncidents.filter((inc) => {
    if (severityFilter !== 'ALL' && inc.severity !== severityFilter) return false;
    if (statusFilter !== 'ALL' && inc.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = inc.title.toLowerCase().includes(q);
      const matchService = inc.service_id.toLowerCase().includes(q);
      const matchKey = inc.incident_key.toLowerCase().includes(q);
      if (!matchTitle && !matchService && !matchKey) return false;
    }
    return true;
  });

  const handleInlineAcknowledge = async (e: React.MouseEvent, inc: OperationsIncident) => {
    e.stopPropagation();
    if (acknowledgingId) return;
    setAcknowledgingId(inc.id);
    try {
      await client.acknowledgeIncident(inc.id);
      onRefreshIncidents();
    } catch (err: unknown) {
      console.error('Failed to acknowledge incident:', err);
    } finally {
      setAcknowledgingId(null);
    }
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

  const getDurationString = (openedAt: string, resolvedAt?: string | null) => {
    const start = new Date(openedAt).getTime();
    const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
    const diffSec = Math.max(0, Math.floor((end - start) / 1000));
    if (diffSec < 60) return `${diffSec}s`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="card-box mb-6 border border-[#e2bfb0] dark:border-white/10 rounded-xl bg-[#ffffff] dark:bg-[#202023] shadow-xs overflow-hidden">
      {/* Section Header */}
      <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
            <Flame size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold font-['Outfit'] text-[#261812] dark:text-white flex items-center gap-2">
              Active Incidents & Response
              {filteredIncidents.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                  {filteredIncidents.length}
                </span>
              )}
            </h2>
            <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-0.5">
              Prioritized by operational urgency • Correlated from machine alert rules
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter incidents..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#261812] dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as IncidentFilterSeverity)}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#261812] dark:text-white focus:outline-none"
            aria-label="Filter by Severity"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as IncidentFilterStatus)}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-[#261812] dark:text-white focus:outline-none"
            aria-label="Filter by Status"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open Only</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      {/* Incident List Body */}
      {loading && incidents.length === 0 ? (
        <div className="p-8 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 animate-pulse flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-48 bg-gray-200 dark:bg-white/10 rounded" />
                <div className="h-3 w-32 bg-gray-200 dark:bg-white/10 rounded" />
              </div>
              <div className="h-8 w-24 bg-gray-200 dark:bg-white/10 rounded" />
            </div>
          ))}
        </div>
      ) : isFailed ? (
        <div className="p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center mb-3 border border-red-500/20">
            <Flame size={26} />
          </div>
          <h3 className="text-base font-bold font-['Outfit'] text-[#261812] dark:text-white">
            Incident Telemetry Unavailable
          </h3>
          <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] max-w-sm mt-1">
            Unable to retrieve active incidents from the Operations Gateway.
          </p>
        </div>
      ) : filteredIncidents.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 border border-emerald-500/20">
            <ShieldCheck size={26} />
          </div>
          <h3 className="text-base font-bold font-['Outfit'] text-[#261812] dark:text-white">
            No Active Operational Incidents
          </h3>
          <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] max-w-sm mt-1">
            All registered services are currently operating within nominal thresholds. No machine alerts have triggered open incidents.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-white/5 overflow-x-auto">
          {filteredIncidents.map((inc) => {
            const isCrit = inc.severity === 'CRITICAL';
            const isHigh = inc.severity === 'HIGH';
            const isAck = inc.status === 'ACKNOWLEDGED';
            const isRes = inc.status === 'RESOLVED';
            const isBeingAcked = acknowledgingId === inc.id;

            return (
              <div
                key={inc.id}
                onClick={() => setSelectedIncident(inc)}
                className={`p-4 sm:p-5 flex items-center justify-between gap-4 transition-colors cursor-pointer hover:bg-orange-500/[0.03] dark:hover:bg-white/[0.02] ${
                  isCrit ? 'bg-red-500/[0.02]' : isHigh ? 'bg-amber-500/[0.01]' : ''
                }`}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedIncident(inc);
                  }
                }}
              >
                {/* Left: Severity & Title */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <span
                    className={`mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border shrink-0 ${getSeverityBadgeClass(
                      inc.severity
                    )}`}
                  >
                    {inc.severity}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#261812] dark:text-white truncate font-['Outfit']">
                        {inc.title}
                      </span>
                      <span
                        className={`px-2 py-0.2 rounded text-[10px] font-mono uppercase font-semibold border ${
                          isRes
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : isAck
                            ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                            : 'bg-red-500/10 text-red-600 border-red-500/20'
                        }`}
                      >
                        {inc.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-xs text-[#5a4136] dark:text-[#aeaeb2] font-mono flex-wrap">
                      <span>Service: <strong className="text-[#261812] dark:text-white">{inc.service_id}</strong></span>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <span>Duration: <strong>{getDurationString(inc.opened_at, inc.resolved_at)}</strong></span>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <span>Opened: {new Date(inc.opened_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Quick Action & Details Chevron */}
                <div className="flex items-center gap-2 shrink-0">
                  {!isAck && !isRes && (
                    <button
                      onClick={(e) => handleInlineAcknowledge(e, inc)}
                      disabled={isBeingAcked}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      title="Acknowledge incident directly"
                    >
                      {isBeingAcked ? <RefreshCw size={12} className="animate-spin" /> : <Shield size={12} />}
                      <span className="hidden sm:inline">Acknowledge</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedIncident(inc)}
                    className="p-2 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-500/10 transition-colors"
                    aria-label={`Investigate incident ${inc.title}`}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Incident Detail Modal / Drawer */}
      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          client={client}
          onClose={() => setSelectedIncident(null)}
          onIncidentUpdated={() => {
            onRefreshIncidents();
          }}
        />
      )}
    </div>
  );
};
