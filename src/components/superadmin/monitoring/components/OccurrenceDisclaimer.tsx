// lpu-events-admin/src/components/superadmin/monitoring/components/OccurrenceDisclaimer.tsx
// Honest Metric Disclosure & Disclaimers Component (MON-004 / MON-008 Stage 8)

import React from 'react';
import { Info } from 'lucide-react';

interface OccurrenceDisclaimerProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export const OccurrenceDisclaimer: React.FC<OccurrenceDisclaimerProps> = ({
  className = '',
  variant = 'compact',
}) => {
  if (variant === 'compact') {
    return (
      <div
        className={`flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-normal ${className}`}
      >
        <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <span>
          Occurrences represent PostHog-ingested exception events after 30s local client deduplication.
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg p-3 bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-xs text-zinc-600 dark:text-zinc-400 space-y-1 ${className}`}
    >
      <div className="flex items-center gap-1.5 font-semibold text-zinc-800 dark:text-zinc-200">
        <Info className="w-4 h-4 text-orange-500 shrink-0" />
        <span>Telemetry Metric Truthfulness</span>
      </div>
      <p className="leading-relaxed">
        • <strong>Occurrences:</strong> Total exceptions ingested by PostHog. Identical exceptions occurring within 30 seconds on the same client isolate are deduplicated locally before dispatch.
      </p>
      <p className="leading-relaxed">
        • <strong>Affected Users:</strong> Calculated anonymously via distinct sessions. Backend service exceptions are designated as <code>N/A (Backend Service Event)</code> to prevent misleading user metrics.
      </p>
    </div>
  );
};
