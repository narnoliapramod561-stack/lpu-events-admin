// src/components/superadmin/operations/KeyMetricsPanel.tsx
// LPU Events — Phase 7: Key Operational Metrics, Trends & Threshold Projections

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Gauge,
} from 'lucide-react';
import {
  OperationsMetricSnapshot,
  OperationsThresholdProjectionResult,
  OperationsMetricHistoryResult,
  OperationsTrendDirection,
  OperationsThresholdStatus,
  OperationsDataQuality,
} from '../../../shared/operations/types';

interface KeyMetricsPanelProps {
  metrics: OperationsMetricSnapshot[];
  projections: Record<string, OperationsThresholdProjectionResult>;
  histories: Record<string, OperationsMetricHistoryResult>;
  loading: boolean;
}

export const KeyMetricsPanel: React.FC<KeyMetricsPanelProps> = ({
  metrics,
  projections,
  histories,
  loading,
}) => {

  // Format large values nicely
  const formatValue = (val: number | null, unit: string) => {
    if (val === null || val === undefined) return 'N/A';
    if (unit.toLowerCase().includes('byte') || unit.toLowerCase() === 'bytes') {
      const mb = val / (1024 * 1024);
      if (mb > 1024) return `${(mb / 1024).toFixed(2)} GB`;
      return `${mb.toFixed(2)} MB`;
    }
    if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return Number.isInteger(val) ? val.toString() : val.toFixed(2);
  };

  // Trend badge rendering using strictly backend results
  const renderTrendBadge = (trend?: OperationsTrendDirection) => {
    switch (trend) {
      case 'RISING':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <TrendingUp size={11} />
            RISING
          </span>
        );
      case 'FALLING':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1">
            <TrendingDown size={11} />
            FALLING
          </span>
        );
      case 'STABLE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <Minus size={11} />
            STABLE
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-gray-500 bg-gray-500/10 border border-gray-500/20">
            INSUFFICIENT DATA
          </span>
        );
    }
  };

  // Threshold status badge strictly using backend results
  const renderThresholdBadge = (status?: OperationsThresholdStatus) => {
    switch (status) {
      case 'APPROACHING':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30 flex items-center gap-1">
            <AlertCircle size={11} />
            APPROACHING THRESHOLD
          </span>
        );
      case 'ALREADY_EXCEEDED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/40">
            ALREADY EXCEEDED
          </span>
        );
      case 'NOT_APPROACHING':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            NOT APPROACHING
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-gray-500 bg-gray-500/10 border border-gray-500/20">
            NO PROJECTION
          </span>
        );
    }
  };

  const renderDataQualityBadge = (quality?: OperationsDataQuality) => {
    switch (quality) {
      case 'HIGH':
        return <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">HIGH QUALITY</span>;
      case 'MEDIUM':
        return <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold">MEDIUM QUALITY</span>;
      case 'LOW':
        return <span className="text-[10px] font-mono text-orange-600 dark:text-orange-400 font-semibold">LOW QUALITY</span>;
      default:
        return <span className="text-[10px] font-mono text-gray-400">INSUFFICIENT</span>;
    }
  };

  // Simple, elegant SVG sparkline consuming points directly from backend
  const renderSparkline = (points?: { value: number }[]) => {
    if (!points || points.length < 2) {
      return (
        <div className="h-10 w-full flex items-center justify-center text-[10px] font-mono text-gray-400 bg-gray-50 dark:bg-white/[0.02] rounded">
          Insufficient time-series data
        </div>
      );
    }

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const width = 200;
    const height = 40;

    const pathPoints = values
      .map((val, idx) => {
        const x = (idx / (values.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 8) - 4;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10 overflow-visible">
        <polyline
          fill="none"
          stroke="#ff6b00"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pathPoints}
        />
      </svg>
    );
  };

  return (
    <div className="card-box mb-6 border border-[#e2bfb0] dark:border-white/10 rounded-xl bg-[#ffffff] dark:bg-[#202023] shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <Gauge size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold font-['Outfit'] text-[#261812] dark:text-white">
              Operational Telemetry & Threshold Projections
            </h2>
            <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-0.5">
              Authoritative trend detection, linear threshold crossing projections & data quality
            </p>
          </div>
        </div>
        <span className="text-xs font-mono font-semibold text-gray-500">
          {metrics.length} metrics captured
        </span>
      </div>

      {/* Grid */}
      {loading && metrics.length === 0 ? (
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] animate-pulse space-y-3">
              <div className="h-4 w-32 bg-gray-200 dark:bg-white/10 rounded" />
              <div className="h-8 w-24 bg-gray-200 dark:bg-white/10 rounded" />
              <div className="h-10 w-full bg-gray-200 dark:bg-white/10 rounded" />
            </div>
          ))}
        </div>
      ) : metrics.length === 0 ? (
        <div className="p-12 text-center text-xs text-gray-500">
          No operational metric snapshots recorded yet. Run telemetry collection to populate.
        </div>
      ) : (
        <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((m) => {
            const cacheKey = `${m.service_id}:${m.metric_key}`;
            const proj = projections[cacheKey];
            const hist = histories[cacheKey];

            return (
              <div
                key={m.id || cacheKey}
                className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1c1e] shadow-xs flex flex-col justify-between"
              >
                <div>
                  {/* Metric Key & Service */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-sm font-bold font-['Outfit'] text-[#261812] dark:text-white">
                        {m.metric_key}
                      </h3>
                      <span className="text-[11px] font-mono text-gray-400">
                        {m.service_id}
                      </span>
                    </div>
                    {renderTrendBadge(hist?.trend?.direction)}
                  </div>

                  {/* Value & Unit */}
                  <div className="my-2">
                    <div className="text-2xl font-black font-['Outfit'] text-[#261812] dark:text-white flex items-baseline gap-1.5">
                      <span>{formatValue(m.metric_value, m.unit)}</span>
                      <span className="text-xs font-mono font-normal text-gray-400">
                        {m.unit}
                      </span>
                    </div>

                    {m.metric_limit && (
                      <div className="text-[11px] font-mono text-gray-400">
                        Configured limit: {formatValue(m.metric_limit, m.unit)} {m.unit}
                      </div>
                    )}
                  </div>

                  {/* SVG Historical Sparkline */}
                  <div className="my-3">
                    {renderSparkline(hist?.points)}
                  </div>

                  {/* Threshold Projection Display */}
                  <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-gray-500">Threshold Status:</span>
                      {renderThresholdBadge(proj?.status)}
                    </div>

                    {/* Only display estimated time when backend actually returned one! */}
                    {proj?.estimatedTimeToThresholdMs && (
                      <div className="text-[11px] font-mono text-amber-600 dark:text-amber-400 flex items-center justify-between font-semibold pt-1 border-t border-gray-100 dark:border-white/5">
                        <span>Est. Threshold Crossing:</span>
                        <span>
                          ~{Math.max(1, Math.round(proj.estimatedTimeToThresholdMs / (1000 * 60 * 60 * 24)))} days
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer with Data Quality & Freshness */}
                <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-[10px] font-mono text-gray-400">
                  <div className="flex items-center gap-1">
                    <span>Quality:</span>
                    {renderDataQualityBadge(hist?.dataQuality || proj?.dataQuality)}
                  </div>
                  <div>
                    {m.is_stale ? (
                      <span className="text-amber-500 font-bold">STALE ({m.age_seconds}s)</span>
                    ) : (
                      <span>Captured {m.age_seconds}s ago</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
