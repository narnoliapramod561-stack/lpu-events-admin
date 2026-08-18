import React, { useState, useEffect } from 'react';
import { supabase, lpuClient } from '../../supabase';
import { 
  Image as ImageIcon, 
  Power 
} from 'lucide-react';
import { EmptyState } from '../shell/EmptyState';
import { LoadingSpinner } from '../shell/LoadingState';

export const MemoriesPanel: React.FC = () => {
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchMemories = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('event_memories')
        .select('*, events(name)')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setMemories(data || []);
    } catch (err: any) {
      setError('Failed to load memories: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMemories(); }, []);

  const toggleStatus = async (id: string) => {
    try {
      const { data: result, error: rpcErr } = await lpuClient.manageMemory('toggle_status', { id });
      if (rpcErr) throw rpcErr;
      const rpcResult = typeof result === 'string' ? JSON.parse(result) : result;
      if (rpcResult?.code) throw new Error(rpcResult.message);
      setSuccess('Memory status updated.');
      fetchMemories();
    } catch (err: any) {
      setError('Update failed: ' + (err.message || ''));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-purple">ARCHIVE ASSETS</span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Media Gallery</span>
          </div>
          <h2 className="page-title">Event Media & Memories</h2>
          <p className="page-description">Manage post-event photograph collections and media recap galleries.</p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--danger-subtle)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--success-subtle)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)' }}>
          {success}
        </div>
      )}

      {/* Main Table Card */}
      <div className="card-box">
        <div className="card-box-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 className="card-box-title">Media Memories</h3>
            <span className="badge badge-purple">{memories.length} Items</span>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Fetching media memories..." />
        ) : memories.length === 0 ? (
          <EmptyState
            title="No Memories Configured"
            description="No photo recap albums or event memory collections exist in the repository."
            icon={<ImageIcon size={26} />}
          />
        ) : (
          <div className="table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Memory Title</th>
                  <th>Linked Event</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {memories.map(mem => (
                  <tr key={mem.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{mem.title}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {mem.events?.name || '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-dim)', maxWidth: '240px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {mem.description || '—'}
                      </span>
                    </td>
                    <td>
                      {mem.status === 'PUBLISHED' ? (
                        <span className="badge badge-success">
                          <span className="badge-dot" />
                          <span>PUBLISHED</span>
                        </span>
                      ) : (
                        <span className="badge badge-warning">
                          <span>DRAFT</span>
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                        {new Date(mem.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => toggleStatus(mem.id)}
                      >
                        <Power size={13} />
                        <span>{mem.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
