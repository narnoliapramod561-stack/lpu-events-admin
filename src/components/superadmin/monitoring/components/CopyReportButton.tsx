// lpu-events-admin/src/components/superadmin/monitoring/components/CopyReportButton.tsx
// Accessible Clipboard & Modal Fallback Export Component (MON-003 / MON-004 / MON-008 Stage 10)

import React, { useState } from 'react';
import { Copy, Check, FileText, X } from 'lucide-react';
import { DiagnosticReportGenerator } from '../utils/DiagnosticReportGenerator.ts';
import type { NormalizedPostHogIssue } from '../types.ts';

interface CopyReportButtonProps {
  issue?: NormalizedPostHogIssue;
  issues?: NormalizedPostHogIssue[];
  detail?: any;
  label?: string;
  variant?: 'primary' | 'secondary' | 'inline';
  className?: string;
}

export const CopyReportButton: React.FC<CopyReportButtonProps> = ({
  issue,
  issues,
  detail,
  label,
  variant = 'secondary',
  className = '',
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [fallbackModalOpen, setFallbackModalOpen] = useState<boolean>(false);
  const [reportMarkdown, setReportMarkdown] = useState<string>('');

  const generateMarkdown = (): string => {
    if (issues && issues.length > 0) {
      return DiagnosticReportGenerator.generateBundleReport(issues).markdown;
    }
    if (issue) {
      return DiagnosticReportGenerator.generateSingleReport(issue, detail);
    }
    return '';
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const markdown = generateMarkdown();
    if (!markdown) return;

    setReportMarkdown(markdown);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } else {
        // Fallback if clipboard API is not available
        setFallbackModalOpen(true);
      }
    } catch {
      // Permission denied or security block
      setFallbackModalOpen(true);
    }
  };

  const baseClasses =
    variant === 'primary'
      ? 'bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold shadow-xs'
      : variant === 'inline'
      ? 'text-zinc-500 hover:text-orange-500 hover:bg-orange-500/10 p-1.5'
      : 'border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-700 dark:text-zinc-300 font-bold';

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        title="Copy AI Diagnostic Report (MON-003 schema)"
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${baseClasses} ${className}`}
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Copied to Clipboard!</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            <span>{label || 'Copy AI Report'}</span>
          </>
        )}
      </button>

      {/* Accessible Fallback Modal if navigator.clipboard is blocked */}
      {fallbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-500" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Manual Copy: AI Diagnostic Report
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFallbackModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Direct clipboard write was blocked by browser security permissions. Select and press{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-white/10 font-mono font-bold">
                Cmd+C
              </kbd>{' '}
              or{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-white/10 font-mono font-bold">
                Ctrl+C
              </kbd>{' '}
              to copy:
            </p>

            <textarea
              readOnly
              autoFocus
              onFocus={(e) => e.target.select()}
              value={reportMarkdown}
              rows={14}
              className="w-full p-3 font-mono text-[11px] rounded-xl bg-zinc-900 text-zinc-200 border border-zinc-700 focus:outline-none focus:border-orange-500"
            />

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setFallbackModalOpen(false)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-orange-500 text-white hover:bg-orange-600"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
