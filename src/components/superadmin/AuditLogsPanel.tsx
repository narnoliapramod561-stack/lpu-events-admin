import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Code2 
} from 'lucide-react';
import { EmptyState } from '../shell/EmptyState';
import { LoadingSpinner } from '../shell/LoadingState';

export const AuditLogsPanel: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('audit_logs')
        .select('*, admin_users!actor_admin_id(email, display_name)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (err) throw err;
      setLogs(data || []);
    } catch (err: any) {
      setError('Failed to load audit logs: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [limit]);

  const filteredLogs = logs.filter(log => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.target_type.toLowerCase().includes(q) ||
      (log.admin_users?.email && log.admin_users.email.toLowerCase().includes(q)) ||
      (log.reason && log.reason.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-purple">SECURITY AUDIT</span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Immutable Activity Ledger</span>
          </div>
          <h2 className="page-title">Security & Operations Audit Trail</h2>
          <p className="page-description">Complete forensic activity log tracking before and after states for administrative actions.</p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={fetchLogs}>
            <RefreshCw size={15} />
            <span>Refresh Ledger</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--danger-subtle)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* Main Table Card */}
      <div className="card-box">
        <div className="card-box-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 className="card-box-title">Audit Ledger</h3>
            <span className="badge badge-purple">{filteredLogs.length} Records</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Limit Selector */}
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', padding: '3px', border: '1px solid var(--border-subtle)' }}>
              {[50, 100, 200].map(n => (
                <button
                  key={n}
                  onClick={() => setLimit(n)}
                  className="btn btn-ghost btn-sm"
                  style={{
                    backgroundColor: limit === n ? 'var(--bg-surface-raised)' : 'transparent',
                    color: limit === n ? 'var(--text-main)' : 'var(--text-dim)',
                    fontWeight: limit === n ? 700 : 500,
                    padding: '4px 10px',
                    fontSize: '11px'
                  }}
                >
                  {n} Rows
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="search-input-wrapper" style={{ minWidth: '220px' }}>
              <Search size={14} className="search-input-icon" />
              <input
                type="text"
                placeholder="Filter by action, actor, target..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-input search-input"
                style={{ padding: '6px 12px 6px 34px', fontSize: '13px' }}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Querying audit trail..." />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            title="No Audit Records"
            description="No administrative activities found for the selected query."
            icon={<FileSpreadsheet size={26} />}
          />
        ) : (
          <div className="table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor & Role</th>
                  <th>Action Trigger</th>
                  <th>Target Resource</th>
                  <th>Justification / Reason</th>
                  <th style={{ textAlign: 'right' }}>Payload Diff</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => {
                  const hasDiff = log.before_data || log.after_data || log.metadata;

                  return (
                    <React.Fragment key={log.id}>
                      <tr>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', fontSize: '12px' }}>
                            <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                              {new Date(log.created_at).toLocaleDateString()}
                            </span>
                            <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                              {new Date(log.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>
                              {log.admin_users?.display_name || log.admin_users?.email || 'System Daemon'}
                            </span>
                            <span className="badge badge-purple" style={{ fontSize: '9px', padding: '1px 6px', width: 'fit-content' }}>
                              {log.actor_role}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-accent" style={{ fontWeight: 700 }}>
                            {log.action}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span className="font-mono" style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>
                              {log.target_type}
                            </span>
                            <span className="font-mono" style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                              {log.target_id?.slice(0, 8)}...
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', maxWidth: '240px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {log.reason || '—'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {hasDiff && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            >
                              <Code2 size={13} />
                              <span>{expandedId === log.id ? 'Hide Diff' : 'View Diff'}</span>
                              {expandedId === log.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expandable JSON Diff Box */}
                      {expandedId === log.id && (
                        <tr>
                          <td colSpan={6} style={{ backgroundColor: 'var(--bg-base)', padding: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: log.before_data && log.after_data ? '1fr 1fr' : '1fr', gap: '16px' }}>
                              {log.before_data && (
                                <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--danger)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                    Before State State
                                  </div>
                                  <pre className="font-mono" style={{ fontSize: '11.5px', color: '#fca5a5', margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                                    {JSON.stringify(log.before_data, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.after_data && (
                                <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                    After State Transition
                                  </div>
                                  <pre className="font-mono" style={{ fontSize: '11.5px', color: '#86efac', margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                                    {JSON.stringify(log.after_data, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.metadata && !log.before_data && !log.after_data && (
                                <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                                    Action Metadata
                                  </div>
                                  <pre className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-main)', margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
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
