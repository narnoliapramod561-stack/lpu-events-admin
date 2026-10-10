import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Code2,
  Shield,
  Download,
  Copy,
  Check
} from 'lucide-react';
import { EmptyState } from '../shell/EmptyState';
import { LoadingSpinner } from '../shell/LoadingState';

interface AuditLogRecord {
  id: string;
  created_at: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string;
  justification?: string;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  reason?: string;
  admin_users?: {
    email?: string;
    display_name?: string;
  } | null;
}

type ActionCategory = 'ALL' | 'EVENTS' | 'ACCESS' | 'SETTINGS' | 'SYSTEM';

export const AuditLogsPanel: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ActionCategory>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('audit_logs')
        .select('id, created_at, actor_role, action, target_type, target_id, justification, before_data, after_data, metadata, admin_users!actor_admin_id(email, display_name)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (err) throw err;
      setLogs((data as AuditLogRecord[]) || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Failed to load audit logs: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchLogs(); 
  }, [limit]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Timestamp', 'Actor', 'Role', 'Action', 'Target Type', 'Target ID', 'Justification'];
    const rows = filteredLogs.map((log) => [
      `"${new Date(log.created_at).toISOString()}"`,
      `"${log.admin_users?.email || log.admin_users?.display_name || 'System'}"`,
      `"${log.actor_role}"`,
      `"${log.action}"`,
      `"${log.target_type}"`,
      `"${log.target_id || ''}"`,
      `"${(log.justification || log.reason || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lpu_audit_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter((log) => {
    // Category filter
    if (selectedCategory === 'EVENTS') {
      const act = log.action.toLowerCase();
      if (!act.includes('event') && log.target_type.toLowerCase() !== 'events') return false;
    } else if (selectedCategory === 'ACCESS') {
      const act = log.action.toLowerCase();
      if (!act.includes('access') && !act.includes('organizer') && !act.includes('approval')) return false;
    } else if (selectedCategory === 'SETTINGS') {
      const act = log.action.toLowerCase();
      if (!act.includes('setting') && !act.includes('config')) return false;
    } else if (selectedCategory === 'SYSTEM') {
      const act = log.action.toLowerCase();
      if (act.includes('event') || act.includes('access') || act.includes('setting')) return false;
    }

    // Search query filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.target_type.toLowerCase().includes(q) ||
      (log.target_id && log.target_id.toLowerCase().includes(q)) ||
      (log.admin_users?.email && log.admin_users.email.toLowerCase().includes(q)) ||
      (log.justification && log.justification.toLowerCase().includes(q)) ||
      (log.reason && log.reason.toLowerCase().includes(q))
    );
  });

  const getActionBadgeColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('DELETE') || act.includes('REJECT') || act.includes('REMOVE')) {
      return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
    }
    if (act.includes('CREATE') || act.includes('APPROVE') || act.includes('INSERT')) {
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
    }
    if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('MODIFY')) {
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
    }
    return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20';
  };

  const getRelativeTime = (dateStr: string) => {
    const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn select-text">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
              SECURITY AUDIT TRAIL
            </span>
            <span className="text-xs text-[#5a4136] dark:text-[#8e8e93]">
              Immutable Forensic Activity Ledger
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-white flex items-center gap-2.5">
            <Shield size={26} className="text-purple-600 dark:text-purple-400" />
            <span>Security & Operations Audit Trail</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#5a4136] dark:text-[#8e8e93] mt-1 max-w-2xl">
            Forensic chronological log tracking administrative state mutations, role elevations, and access decisions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#e2bfb0] dark:border-white/10 text-xs font-bold text-[#261812] dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Ledger</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Main Table Card */}
      <div className="card-box rounded-2xl border border-[#e2bfb0] dark:border-white/10 bg-[#ffffff] dark:bg-[#202023] shadow-sm overflow-hidden">
        {/* Card Header & Controls */}
        <div className="p-5 border-b border-gray-100 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Quick Category Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'ALL', label: 'All Operations' },
              { id: 'EVENTS', label: 'Events' },
              { id: 'ACCESS', label: 'Access Requests' },
              { id: 'SETTINGS', label: 'Settings' },
              { id: 'SYSTEM', label: 'System' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id as ActionCategory)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-gray-100 dark:bg-white/5 text-[#5a4136] dark:text-[#8e8e93] hover:bg-gray-200 dark:hover:bg-white/10'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search & Row Limit */}
          <div className="flex items-center gap-3">
            <div className="relative min-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by actor, action, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-xs text-[#261812] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div className="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/5">
              {[50, 100, 200].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setLimit(n)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    limit === n
                      ? 'bg-white dark:bg-[#2c2c2e] text-[#261812] dark:text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Audit Log Table */}
        {loading ? (
          <div className="py-16">
            <LoadingSpinner message="Querying security audit trail..." />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16">
            <EmptyState
              title="No Audit Records Found"
              description="No administrative activities matched your search criteria or category filter."
              icon={<FileSpreadsheet size={32} className="text-gray-400" />}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/5 text-[11px] uppercase font-bold text-[#5a4136]/70 dark:text-[#8e8e93] tracking-wider bg-gray-50/50 dark:bg-white/[0.01]">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Justification</th>
                  <th className="py-3 px-4 text-right">Payload Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-xs">
                {filteredLogs.map((log) => {
                  const hasDiff = log.before_data || log.after_data || log.metadata;
                  const isExpanded = expandedId === log.id;
                  const email = log.admin_users?.email || log.admin_users?.display_name || 'System Daemon';
                  const initial = email.charAt(0).toUpperCase();

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors">
                        {/* Timestamp */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-[#261812] dark:text-white">
                            {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="text-[11px] text-[#5a4136] dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                            <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>•</span>
                            <span className="font-medium text-purple-600 dark:text-purple-400">
                              {getRelativeTime(log.created_at)}
                            </span>
                          </div>
                        </td>

                        {/* Actor */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center text-xs shrink-0 border border-purple-500/20">
                              {initial}
                            </div>
                            <div>
                              <div className="font-semibold text-[#261812] dark:text-white">
                                {email}
                              </div>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                                {log.actor_role}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold border ${getActionBadgeColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>

                        {/* Target Entity */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-[#261812] dark:text-white uppercase tracking-wider text-[11px]">
                            {log.target_type}
                          </div>
                          {log.target_id && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(log.target_id, log.id)}
                              className="font-mono text-[11px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1 mt-0.5 group cursor-pointer"
                              title="Click to copy ID"
                            >
                              <span>{log.target_id.slice(0, 10)}...</span>
                              {copiedId === log.id ? (
                                <Check size={11} className="text-emerald-500" />
                              ) : (
                                <Copy size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </button>
                          )}
                        </td>

                        {/* Justification */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <span className="text-[#5a4136] dark:text-gray-300 line-clamp-2">
                            {log.justification || log.reason || '—'}
                          </span>
                        </td>

                        {/* Payload Diff Action */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {hasDiff ? (
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : log.id)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                isExpanded
                                  ? 'bg-purple-600 text-white shadow-xs'
                                  : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20'
                              }`}
                            >
                              <Code2 size={13} />
                              <span>{isExpanded ? 'Hide Diff' : 'View Diff'}</span>
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          ) : (
                            <span className="text-gray-400 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Visual State Diff */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-4 bg-gray-50/80 dark:bg-black/20 border-t border-b border-gray-100 dark:border-white/5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Before State */}
                              {log.before_data ? (
                                <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/[0.03] space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-red-500" />
                                      Before State Transition
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(JSON.stringify(log.before_data, null, 2), `before_${log.id}`)}
                                      className="text-[10px] text-red-600 hover:underline cursor-pointer flex items-center gap-1"
                                    >
                                      {copiedId === `before_${log.id}` ? 'Copied' : 'Copy JSON'}
                                    </button>
                                  </div>
                                  <pre className="text-[11px] font-mono text-red-900 dark:text-red-300 bg-red-500/[0.04] p-3 rounded-lg overflow-x-auto max-h-60 whitespace-pre-wrap">
                                    {JSON.stringify(log.before_data, null, 2)}
                                  </pre>
                                </div>
                              ) : null}

                              {/* After State */}
                              {log.after_data ? (
                                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.03] space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                      After State Transition
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(JSON.stringify(log.after_data, null, 2), `after_${log.id}`)}
                                      className="text-[10px] text-emerald-600 hover:underline cursor-pointer flex items-center gap-1"
                                    >
                                      {copiedId === `after_${log.id}` ? 'Copied' : 'Copy JSON'}
                                    </button>
                                  </div>
                                  <pre className="text-[11px] font-mono text-emerald-900 dark:text-emerald-300 bg-emerald-500/[0.04] p-3 rounded-lg overflow-x-auto max-h-60 whitespace-pre-wrap">
                                    {JSON.stringify(log.after_data, null, 2)}
                                  </pre>
                                </div>
                              ) : null}

                              {/* Metadata if no before/after */}
                              {log.metadata && !log.before_data && !log.after_data && (
                                <div className="col-span-2 p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202023] space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                      Action Payload & Execution Metadata
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(JSON.stringify(log.metadata, null, 2), `meta_${log.id}`)}
                                      className="text-[10px] text-purple-600 hover:underline cursor-pointer flex items-center gap-1"
                                    >
                                      {copiedId === `meta_${log.id}` ? 'Copied' : 'Copy JSON'}
                                    </button>
                                  </div>
                                  <pre className="text-[11px] font-mono text-[#261812] dark:text-white bg-gray-50 dark:bg-black/20 p-3 rounded-lg overflow-x-auto max-h-60 whitespace-pre-wrap">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
