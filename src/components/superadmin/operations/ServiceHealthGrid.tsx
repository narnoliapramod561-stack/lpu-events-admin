// src/components/superadmin/operations/ServiceHealthGrid.tsx
// LPU Events — Phase 7: Service Health Grid with Authoritative Provider Semantics

import React, { useState } from 'react';
import {
  Server,
  Database,
  Cloud,
  Mail,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  HelpCircle,
  Layers
} from 'lucide-react';
import {
  OperationsServiceDefinition,
  OperationsHealthProbe,
  OperationsServiceStatus,
} from '../../../shared/operations/types';

interface ServiceHealthGridProps {
  services: OperationsServiceDefinition[];
  probes: OperationsHealthProbe[];
  loading: boolean;
}

export const ServiceHealthGrid: React.FC<ServiceHealthGridProps> = ({
  services,
  probes,
  loading,
}) => {
  const [selectedService, setSelectedService] = useState<OperationsServiceDefinition | null>(null);

  // Group latest probes by service_id
  const latestProbeByService = new Map<string, OperationsHealthProbe>();
  for (const probe of probes) {
    if (!latestProbeByService.has(probe.service_id)) {
      latestProbeByService.set(probe.service_id, probe);
    }
  }

  const getServiceIcon = (category: string) => {
    switch (category) {
      case 'database':
        return <Database size={18} />;
      case 'compute':
      case 'storage':
        return <Cloud size={18} />;
      case 'email':
        return <Mail size={18} />;
      case 'observability':
        return <Activity size={18} />;
      case 'ci_cd':
        return <Layers size={18} />;
      default:
        return <Server size={18} />;
    }
  };

  const getStatusBadge = (status: OperationsServiceStatus) => {
    switch (status) {
      case 'HEALTHY':
        return {
          label: 'HEALTHY',
          icon: <CheckCircle2 size={13} />,
          badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
        };
      case 'WARNING':
      case 'DEGRADED':
        return {
          label: status,
          icon: <AlertTriangle size={13} />,
          badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
        };
      case 'CRITICAL':
        return {
          label: 'CRITICAL',
          icon: <XCircle size={13} />,
          badgeClass: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
        };
      case 'NOT_CONFIGURED':
        return {
          label: 'NOT CONFIGURED',
          icon: <HelpCircle size={13} />,
          badgeClass: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
        };
      case 'NOT_MONITORED':
        return {
          label: 'NOT MONITORED',
          icon: <Clock size={13} />,
          badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        };
      case 'UNAVAILABLE':
        return {
          label: 'UNAVAILABLE',
          icon: <XCircle size={13} />,
          badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
        };
      default:
        return {
          label: 'UNKNOWN',
          icon: <HelpCircle size={13} />,
          badgeClass: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
        };
    }
  };

  const getCriticalityBadge = (crit: string) => {
    if (crit === 'tier_0_core') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30">
          TIER-0 CORE
        </span>
      );
    }
    if (crit === 'tier_1_critical') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/30">
          TIER-1 CRITICAL
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-gray-500 bg-gray-500/10 border border-gray-500/20">
        TIER-2 STANDARD
      </span>
    );
  };

  return (
    <div className="card-box mb-6 border border-[#e2bfb0] dark:border-white/10 rounded-xl bg-[#ffffff] dark:bg-[#202023] shadow-xs overflow-hidden">
      {/* Section Header */}
      <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <Server size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold font-['Outfit'] text-[#261812] dark:text-white">
              Operational Services & Infrastructure
            </h2>
            <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-0.5">
              Canonical service definitions, provider probe health, and latency verification
            </p>
          </div>
        </div>
        <span className="text-xs font-mono font-semibold text-gray-500">
          {services.length} registered
        </span>
      </div>

      {/* Grid */}
      {loading && services.length === 0 ? (
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] animate-pulse space-y-3">
              <div className="h-4 w-32 bg-gray-200 dark:bg-white/10 rounded" />
              <div className="h-3 w-48 bg-gray-200 dark:bg-white/10 rounded" />
              <div className="h-6 w-24 bg-gray-200 dark:bg-white/10 rounded" />
            </div>
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="p-12 text-center text-xs text-gray-500">
          No operational services registered in backend registry.
        </div>
      ) : (
        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((svc) => {
            const probe = latestProbeByService.get(svc.key);
            const statusBadge = getStatusBadge(svc.monitoringStatus);

            return (
              <div
                key={svc.key}
                onClick={() => setSelectedService(svc)}
                className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e] hover:border-orange-500/40 transition-all cursor-pointer flex flex-col justify-between shadow-xs"
              >
                <div>
                  {/* Top Row: Category Icon & Badges */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                        {getServiceIcon(svc.category)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold font-['Outfit'] text-[#261812] dark:text-white leading-tight">
                          {svc.displayName}
                        </h3>
                        <span className="text-[11px] font-mono text-gray-400">
                          {svc.provider}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1 shrink-0 ${statusBadge.badgeClass}`}
                      title={`Monitoring Status: ${svc.monitoringStatus}`}
                    >
                      {statusBadge.icon}
                      {statusBadge.label}
                    </span>
                  </div>

                  {/* Criticality & Description */}
                  <div className="flex items-center gap-2 mt-2 mb-2 flex-wrap">
                    {getCriticalityBadge(svc.criticality)}
                    <span className="text-[11px] font-mono text-gray-500 uppercase">
                      {svc.category}
                    </span>
                  </div>

                  <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] line-clamp-2 mt-1">
                    {svc.notes || 'No description notes available.'}
                  </p>
                </div>

                {/* Probe Metrics Footer */}
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-[11px] font-mono text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    {probe ? (
                      <span>Latency: <strong className="text-[#261812] dark:text-white">{probe.latency_ms}ms</strong></span>
                    ) : (
                      <span>Probe: <strong>N/A</strong></span>
                    )}
                  </div>

                  <div>
                    {probe?.checked_at ? (
                      <span>Checked {new Date(probe.checked_at).toLocaleTimeString()}</span>
                    ) : (
                      <span>Not probed</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Service Detail Modal */}
      {selectedService && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white dark:bg-[#1c1c1e] text-[#261812] dark:text-white rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl p-6">
            <div className="flex items-start justify-between pb-3 border-b border-gray-100 dark:border-white/10 mb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-orange-600 uppercase">
                  Service Specification
                </span>
                <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-white">
                  {selectedService.displayName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-white/5">
                <span className="text-gray-500">Service Key:</span>
                <span className="font-bold text-[#261812] dark:text-white">{selectedService.key}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-white/5">
                <span className="text-gray-500">Provider:</span>
                <span className="text-[#261812] dark:text-white">{selectedService.provider}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-white/5">
                <span className="text-gray-500">Criticality:</span>
                <span className="text-[#261812] dark:text-white">{selectedService.criticality}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50 dark:border-white/5">
                <span className="text-gray-500">Monitoring Status:</span>
                <span className="text-[#261812] dark:text-white">{selectedService.monitoringStatus}</span>
              </div>
              <div className="py-2">
                <span className="text-gray-500 block mb-1">Capabilities:</span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className={`p-2 rounded border ${selectedService.capabilities.health_probe ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-gray-100 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10'}`}>
                    Health Probe: {selectedService.capabilities.health_probe ? 'Enabled' : 'Disabled'}
                  </div>
                  <div className={`p-2 rounded border ${selectedService.capabilities.request_usage ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-gray-100 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10'}`}>
                    Request Usage: {selectedService.capabilities.request_usage ? 'Enabled' : 'Disabled'}
                  </div>
                  <div className={`p-2 rounded border ${selectedService.capabilities.quota_metrics ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-gray-100 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10'}`}>
                    Quota Metrics: {selectedService.capabilities.quota_metrics ? 'Enabled' : 'Disabled'}
                  </div>
                  <div className={`p-2 rounded border ${selectedService.capabilities.error_rates ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-gray-100 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10'}`}>
                    Error Rates: {selectedService.capabilities.error_rates ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-gray-100 dark:border-white/10 flex justify-end">
              <button
                onClick={() => setSelectedService(null)}
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
