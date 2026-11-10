// lpu-events-admin/src/components/superadmin/monitoring/components/LogViewerTable.tsx
// High-Performance Log Record Viewer Component (MON-004 / MON-008 Stage 12)

import React, { useState } from 'react';
import { Copy, Check, ChevronRight, ChevronDown, Terminal, Clock } from 'lucide-react';
import type { SupabaseLogRecord } from '../types.ts';

interface LogViewerTableProps {
  logs: SupabaseLogRecord[];
  highlightQuery?: string;
  className?: string;
}

export const LogViewerTable: React.FC<LogViewerTableProps> = ({
  logs,
  highlightQuery = '',
  className = '',
}) => {
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!logs || logs.length === 0) {
    return (
      <div className="py-16 text-center rounded-2xl bg-white dark:bg-[#252528] border border-zinc-200 dark:border-white/10 space-y-2">
        <Terminal className="w-8 h-8 text-zinc-400 mx-auto" />
        <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
          No Log Records Found
        </h4>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
          No logs match the chosen source, time window, or filter query within the 24-hour retention period.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-950 text-zinc-300 font-mono text-xs overflow-hidden shadow-xs ${className}`}>
      <div className="overflow-x-auto max-h-[640px] overflow-y-auto divide-y divide-white/5">
        {logs.map((log) => {
          const isExpanded = expandedRowIds.has(log.id);
          const rawMessage = log.event_message || JSON.stringify(log.log_attributes || log.metadata || {});
          
          let parsedJson: any = null;
          try {
            parsedJson = JSON.parse(rawMessage);
          } catch {
            parsedJson = null;
          }

          const hasHighlight =
            highlightQuery &&
            rawMessage.toLowerCase().includes(highlightQuery.toLowerCase());

          let sourceColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
          if (log.source === 'function_edge_logs') {
            sourceColor = 'bg-purple-500/20 text-purple-400 border-purple-500/30';
          } else if (log.source === 'edge_logs') {
            sourceColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
          } else if (log.source === 'postgres_logs') {
            sourceColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
          }

          return (
            <div
              key={log.id}
              className={`p-3 space-y-1.5 transition-colors ${
                hasHighlight
                  ? 'bg-orange-500/10 border-l-4 border-orange-500'
                  : 'hover:bg-white/[0.02]'
              }`}
            >
              {/* Row Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleExpand(log.id)}
                    className="p-0.5 rounded text-zinc-500 hover:text-white"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <span className="flex items-center gap-1 text-zinc-500 shrink-0">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </span>

                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold border uppercase ${sourceColor}`}>
                    {log.source}
                  </span>

                  {log.status_code && (
                    <span
                      className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                        log.status_code >= 500
                          ? 'bg-rose-500/20 text-rose-400'
                          : log.status_code >= 400
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      HTTP {log.status_code}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(log.id, rawMessage)}
                  className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-white"
                >
                  {copiedId === log.id ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedId === log.id ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Message Preview */}
              <div
                onClick={() => toggleExpand(log.id)}
                className="cursor-pointer break-all text-xs font-mono text-zinc-200 leading-relaxed truncate"
              >
                {rawMessage}
              </div>

              {/* Expanded JSON Inspector */}
              {isExpanded && (
                <div className="mt-2 p-3 rounded-xl bg-black/60 border border-white/10 text-xs overflow-x-auto space-y-2">
                  <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    Full Log Record Details (ClickHouse Entry)
                  </div>
                  {parsedJson ? (
                    <pre className="text-zinc-300 text-[11px] leading-snug">
                      {JSON.stringify(parsedJson, null, 2)}
                    </pre>
                  ) : (
                    <pre className="text-zinc-300 text-[11px] leading-snug whitespace-pre-wrap">
                      {rawMessage}
                    </pre>
                  )}
                  {log.log_attributes && (
                    <div className="pt-2 border-t border-white/5 space-y-1">
                      <div className="text-[10px] text-zinc-500 font-bold uppercase">
                        Log Attributes:
                      </div>
                      <pre className="text-[10px] text-zinc-400">
                        {JSON.stringify(log.log_attributes, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
