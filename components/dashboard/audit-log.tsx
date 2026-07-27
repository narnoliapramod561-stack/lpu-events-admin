'use client';

import { useState, useEffect } from 'react';

interface AuditLogEntry {
    id: string;
    actor_id: string;
    actor_email: string;
    actor_role: string;
    action: string;
    resource_type: string;
    resource_id: string | null;
    metadata: Record<string, any> | null;
    before_state: Record<string, any> | null;
    after_state: Record<string, any> | null;
    created_at: string;
}

export function AuditLog() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [resourceFilter, setResourceFilter] = useState('');
    const [expandedLog, setExpandedLog] = useState<string | null>(null);

    useEffect(() => {
        fetchLogs();
    }, [page, searchQuery, actionFilter, resourceFilter]);

    const fetchLogs = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            if (searchQuery) params.append('search', searchQuery);
            if (actionFilter) params.append('action', actionFilter);
            if (resourceFilter) params.append('resource_type', resourceFilter);

            const response = await fetch(`/api/admin/audit-log?${params}`);
            if (response.ok) {
                const data = await response.json();
                setLogs(data.data || []);
                setTotalPages(data.pagination?.totalPages || 1);
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to fetch audit logs');
            }
        } catch (err) {
            setError('Network error loading audit logs');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }).format(date);
    };

    const getActionBadgeColor = (action: string) => {
        if (action.includes('create') || action.includes('insert'))
            return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        if (action.includes('update') || action.includes('edit'))
            return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        if (action.includes('delete') || action.includes('remove'))
            return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
        if (action.includes('approve') || action.includes('accept'))
            return 'bg-green-500/10 text-green-400 border-green-500/20';
        if (action.includes('reject') || action.includes('deny'))
            return 'bg-red-500/10 text-red-400 border-red-500/20';
        return 'bg-white/10 text-white/60 border-white/10';
    };

    const toggleExpanded = (id: string) => {
        setExpandedLog(expandedLog === id ? null : id);
    };

    return (
        <div className="flex flex-col gap-8 w-full max-w-[1400px] mx-auto animate-fadeIn">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/10 pb-6 gap-4">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#ff914d]">
                        <span>Super Admin</span>
                        <span>•</span>
                        <span>System Monitoring</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mt-1 font-display">
                        Audit Log
                    </h1>
                    <p className="text-sm text-white/60 mt-1">
                        Complete activity trail of all system actions and changes.
                    </p>
                </div>
            </header>

            {/* Error Message */}
            {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400 text-sm">
                    {error}
                </div>
            )}

            {/* Filters */}
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-[20px]">
                            search
                        </span>
                        <input
                            type="text"
                            placeholder="Search by actor email or resource..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                        />
                    </div>

                    <select
                        value={actionFilter}
                        onChange={(e) => {
                            setActionFilter(e.target.value);
                            setPage(1);
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                    >
                        <option value="">All Actions</option>
                        <option value="create">Create</option>
                        <option value="update">Update</option>
                        <option value="delete">Delete</option>
                        <option value="approve">Approve</option>
                        <option value="reject">Reject</option>
                    </select>

                    <select
                        value={resourceFilter}
                        onChange={(e) => {
                            setResourceFilter(e.target.value);
                            setPage(1);
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                    >
                        <option value="">All Resources</option>
                        <option value="event">Events</option>
                        <option value="organizer_application">Organizer Applications</option>
                        <option value="category">Categories</option>
                        <option value="profile">Profiles</option>
                        <option value="registration">Registrations</option>
                        <option value="payment">Payments</option>
                    </select>
                </div>
            </div>

            {/* Logs Table */}
            {loading ? (
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-white/60">Loading audit logs...</div>
                </div>
            ) : logs.length === 0 ? (
                <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
                    <span className="material-symbols-outlined text-white/40 text-5xl mb-4">
                        content_paste_search
                    </span>
                    <p className="text-white/60">No audit logs found</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {logs.map((log) => (
                        <div
                            key={log.id}
                            className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden"
                        >
                            <div className="p-4 flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span
                                            className={`text-xs font-bold px-2 py-1 rounded border ${getActionBadgeColor(log.action)}`}
                                        >
                                            {log.action.toUpperCase()}
                                        </span>
                                        <span className="text-xs text-white/40">
                                            {log.resource_type}
                                        </span>
                                        {log.resource_id && (
                                            <code className="text-xs text-white/40 font-mono">
                                                #{log.resource_id.substring(0, 8)}
                                            </code>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-white/80">
                                        <span className="font-medium">{log.actor_email}</span>
                                        <span className="text-white/40">•</span>
                                        <span className="text-white/60 text-xs">
                                            {log.actor_role}
                                        </span>
                                    </div>

                                    <div className="text-xs text-white/40 mt-1">
                                        {formatDate(log.created_at)}
                                    </div>
                                </div>

                                <button
                                    onClick={() => toggleExpanded(log.id)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all"
                                >
                                    {expandedLog === log.id ? 'Hide Details' : 'View Details'}
                                </button>
                            </div>

                            {expandedLog === log.id && (
                                <div className="border-t border-white/10 p-4 bg-black/20 space-y-4">
                                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                                                Metadata
                                            </h4>
                                            <pre className="text-xs text-white/80 bg-black/40 p-3 rounded-lg overflow-x-auto border border-white/5">
                                                {JSON.stringify(log.metadata, null, 2)}
                                            </pre>
                                        </div>
                                    )}

                                    {log.before_state && Object.keys(log.before_state).length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">
                                                Before State
                                            </h4>
                                            <pre className="text-xs text-white/80 bg-rose-500/5 p-3 rounded-lg overflow-x-auto border border-rose-500/20">
                                                {JSON.stringify(log.before_state, null, 2)}
                                            </pre>
                                        </div>
                                    )}

                                    {log.after_state && Object.keys(log.after_state).length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
                                                After State
                                            </h4>
                                            <pre className="text-xs text-white/80 bg-emerald-500/5 p-3 rounded-lg overflow-x-auto border border-emerald-500/20">
                                                {JSON.stringify(log.after_state, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Previous
                    </button>

                    <div className="flex items-center gap-2">
                        <span className="text-sm text-white/60">
                            Page {page} of {totalPages}
                        </span>
                    </div>

                    <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
