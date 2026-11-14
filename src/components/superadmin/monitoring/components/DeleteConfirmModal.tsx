// lpu-events-admin/src/components/superadmin/monitoring/components/DeleteConfirmModal.tsx
// Confirmation Modal for Exception Deletion & Archival (MON-004 / MON-008 Stage 9)

import React from 'react';
import { Trash2, X } from 'lucide-react';
import type { NormalizedPostHogIssue } from '../types.ts';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  issue: NormalizedPostHogIssue | null;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  issue,
  onClose,
  onConfirm,
  loading = false,
}) => {
  if (!isOpen || !issue) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 shadow-2xl p-6 space-y-5">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Delete Exception Issue
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Permanently archive and delete from tracking
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Issue */}
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/5 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Target Exception:
          </div>
          <p className="font-mono text-xs text-zinc-900 dark:text-zinc-200 break-all font-semibold">
            {issue.name}
          </p>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500">
            <span>Component: <code className="font-mono">{issue.component}</code></span>
            <span>•</span>
            <span>Occurrences: {issue.occurrences}</span>
          </div>
        </div>

        {/* Warning Box */}
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 space-y-2">
          <p className="font-bold flex items-center gap-1.5">
            <span>Permanent Removal Warning:</span>
          </p>
          <p className="leading-relaxed">
            Deleting this issue will remove it from all active monitoring inboxes, triage views, and dashboards.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-xs transition-all disabled:opacity-50"
          >
            {loading ? 'Deleting...' : 'Yes, Delete Exception'}
          </button>
        </div>
      </div>
    </div>
  );
};

