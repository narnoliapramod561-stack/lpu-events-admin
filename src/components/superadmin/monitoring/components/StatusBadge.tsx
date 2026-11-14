// lpu-events-admin/src/components/superadmin/monitoring/components/StatusBadge.tsx
// Status Badge Component (MON-004 / MON-008 Stage 8)

import React from 'react';

export type StatusBadgeType =
  | 'OPERATIONAL'
  | 'DEGRADED'
  | 'OUTAGE'
  | 'DOWN'
  | 'STALE'
  | 'UNKNOWN'
  | 'SEEMS_DOWN'
  | 'PAUSED'
  | 'ACTIVE'
  | 'RESOLVED'
  | 'SUPPRESSED'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'UNAVAILABLE'
  | string;

interface StatusBadgeProps {
  status: StatusBadgeType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  showDot = true,
  className = '',
}) => {
  const norm = (status || '').toUpperCase();
  const displayLabel = label || norm.replace(/_/g, ' ');

  let colorClasses = 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
  let dotColor = 'bg-zinc-400';

  if (norm === 'OPERATIONAL' || norm === 'CONNECTED' || norm === 'ACTIVE' || norm === 'UP') {
    colorClasses = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25';
    dotColor = 'bg-emerald-500';
  } else if (norm === 'DEGRADED' || norm === 'SEEMS_DOWN') {
    colorClasses = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25';
    dotColor = 'bg-amber-500';
  } else if (norm === 'OUTAGE' || norm === 'DOWN' || norm === 'DISCONNECTED' || norm === 'OFFLINE') {
    colorClasses = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25';
    dotColor = 'bg-rose-500';
  } else if (norm === 'STALE' || norm === 'UNKNOWN' || norm === 'PAUSED' || norm === 'UNAVAILABLE') {
    colorClasses = 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/25';
    dotColor = 'bg-zinc-400';
  } else if (norm === 'RESOLVED') {
    colorClasses = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25';
    dotColor = 'bg-blue-500';
  } else if (norm === 'SUPPRESSED') {
    colorClasses = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25';
    dotColor = 'bg-purple-500';
  }

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[10px]'
      : size === 'lg'
      ? 'px-3 py-1.5 text-sm font-bold'
      : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border tracking-wide uppercase font-mono ${colorClasses} ${sizeClasses} ${className}`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor} ${
            norm === 'OPERATIONAL' || norm === 'UP' ? 'animate-pulse' : ''
          }`}
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
};
