// src/components/superadmin/operations/OperationsRefreshIndicator.tsx
// LPU Events — Phase 7: Freshness Indicator, Synchronization Bar & Operational Actions

import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface OperationsRefreshIndicatorProps {
  isSyncing: boolean;
  lastFetchedAt: Date | null;
  lastCollectionAt: string | null;
  isStale: boolean;
  environment: string;
  autoRefreshEnabled: boolean;
  onToggleAutoRefresh: () => void;
  onManualRefresh: () => Promise<void>;
  onTriggerCollection: () => Promise<void>;
  onEvaluateAlerts: () => Promise<void>;
}

export const OperationsRefreshIndicator: React.FC<OperationsRefreshIndicatorProps> = ({
  isSyncing,
  lastFetchedAt,
  lastCollectionAt,
  isStale,
  environment,
  autoRefreshEnabled,
  onToggleAutoRefresh,
  onManualRefresh,
  onTriggerCollection,
  onEvaluateAlerts,
}) => {
  const [timeAgo, setTimeAgo] = useState<string>('just now');
  const [collectionAge, setCollectionAge] = useState<string>('unknown');
  const [isCollecting, setIsCollecting] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Compute truthful elapsed time every 2 seconds
  useEffect(() => {
    const updateFreshness = () => {
      if (!lastFetchedAt) {
        setTimeAgo('never');
      } else {
        const diffSec = Math.max(0, Math.floor((Date.now() - lastFetchedAt.getTime()) / 1000));
        if (diffSec < 5) setTimeAgo('just now');
        else if (diffSec < 60) setTimeAgo(`${diffSec} seconds ago`);
        else if (diffSec < 3600) setTimeAgo(`${Math.floor(diffSec / 60)}m ${diffSec % 60}s ago`);
        else setTimeAgo(`${Math.floor(diffSec / 3600)}h ago`);
      }

      if (!lastCollectionAt) {
        setCollectionAge('no telemetry captured');
      } else {
        const diffSec = Math.max(0, Math.floor((Date.now() - new Date(lastCollectionAt).getTime()) / 1000));
        if (diffSec < 60) setCollectionAge(`${diffSec}s ago`);
        else if (diffSec < 3600) setCollectionAge(`${Math.floor(diffSec / 60)}m ago`);
        else setCollectionAge(`${Math.floor(diffSec / 3600)}h ago`);
      }
    };

    updateFreshness();
    const interval = setInterval(updateFreshness, 2000);
    return () => clearInterval(interval);
  }, [lastFetchedAt, lastCollectionAt]);

  const handleCollect = async () => {
    setIsCollecting(true);
    setActionMessage(null);
    try {
      await onTriggerCollection();
      setActionMessage({ text: 'Telemetry collection completed', type: 'success' });
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({ text: `Collection failed: ${msg}`, type: 'error' });
    } finally {
      setIsCollecting(false);
    }
  };

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    setActionMessage(null);
    try {
      await onEvaluateAlerts();
      setActionMessage({ text: 'Alert evaluation completed', type: 'success' });
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setActionMessage({ text: `Alert evaluation failed: ${msg}`, type: 'error' });
    } finally {
      setIsEvaluating(false);
    }
  };

  const getEnvBadgeClass = () => {
    const env = (environment || 'production').toLowerCase();
    if (env.includes('production')) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
    if (env.includes('staging')) return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
    if (env.includes('development') || env.includes('local')) return 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30';
    return 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/30';
  };

  return (
    <div className="relative w-full mb-6">
      {/* Synchronization Progress Line */}
      <div className="h-1 w-full bg-transparent overflow-hidden rounded-full mb-2">
        {isSyncing && (
          <div
            className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500 animate-[pulse_1.5s_ease-in-out_infinite]"
            style={{ width: '100%' }}
          />
        )}
      </div>

      {/* Control Banner Card */}
      <div className="card-box flex flex-wrap items-center justify-between gap-4 p-4 border border-[#e2bfb0] dark:border-white/10 rounded-xl bg-[#ffffff] dark:bg-[#202023] shadow-xs">
        {/* Left: Freshness & Environment */}
        <div className="flex items-center flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 text-xs font-semibold uppercase rounded-md border flex items-center gap-1.5 ${getEnvBadgeClass()}`}
              title="Cloud environment hosting the live services"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {environment || 'UNKNOWN'}
            </span>
          </div>

          <div className="h-4 w-px bg-gray-300 dark:bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-2 text-xs text-[#5a4136] dark:text-[#aeaeb2]">
            <span className="font-medium text-gray-500">System Status:</span>
            <span className="font-semibold text-[#261812] dark:text-white">Updated {timeAgo}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#5a4136] dark:text-[#aeaeb2]">
            <span className="text-gray-400 dark:text-gray-600">•</span>
            <span className="font-medium text-gray-500">Full Health Check:</span>
            <span className="font-semibold text-[#261812] dark:text-white">
              {collectionAge === 'no telemetry captured' ? 'Ready to check' : collectionAge}
            </span>
          </div>

          {isStale && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30">
              <AlertTriangle size={13} />
              Telemetry Stale
            </span>
          )}

          {actionMessage && (
            <span
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                actionMessage.type === 'success'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-red-500/15 text-red-600 dark:text-red-400'
              }`}
            >
              {actionMessage.type === 'success' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              {actionMessage.text}
            </span>
          )}
        </div>

        {/* Right: Operational Controls */}
        <div className="flex items-center gap-2">
          {/* Auto-refresh toggle */}
          <button
            onClick={onToggleAutoRefresh}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              autoRefreshEnabled
                ? 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400'
                : 'bg-gray-100 dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-400'
            }`}
            title="Automatically updates dashboard health every 30 seconds"
          >
            <span className={`w-2 h-2 rounded-full ${autoRefreshEnabled ? 'bg-orange-500 animate-pulse' : 'bg-gray-400'}`} />
            Auto-refresh (30s)
          </button>

          {/* Trigger Telemetry Collection */}
          <button
            onClick={handleCollect}
            disabled={isCollecting || isSyncing}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#fee3d8] dark:bg-white/5 hover:bg-[#fed6c6] dark:hover:bg-white/10 text-[#a04100] dark:text-orange-300 border border-[#e2bfb0] dark:border-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Tests all live connections to Database, Auth, Storage, and Email services"
          >
            {isCollecting ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <Play size={13} />
            )}
            Check All Services
          </button>

          {/* Evaluate Alerts */}
          <button
            onClick={handleEvaluate}
            disabled={isEvaluating || isSyncing}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#fee3d8] dark:bg-white/5 hover:bg-[#fed6c6] dark:hover:bg-white/10 text-[#a04100] dark:text-orange-300 border border-[#e2bfb0] dark:border-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Scans error logs and latency to check if any automated alerts should trigger"
          >
            {isEvaluating ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <ShieldAlert size={13} />
            )}
            Scan For Issues
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => onManualRefresh()}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#ff6b00] hover:bg-[#a04100] text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Reload latest live status from the server"
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
            Refresh Status
          </button>
        </div>
      </div>
    </div>
  );
};
