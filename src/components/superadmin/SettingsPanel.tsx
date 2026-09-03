import React, { useState, useEffect } from 'react';
import { supabase, lpuClient } from '../../supabase';
import { 
  Sliders, 
  Plus, 
  Edit3, 
  Save, 
  X, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { EmptyState } from '../shell/EmptyState';
import { LoadingSpinner } from '../shell/LoadingState';

export const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('global_settings')
        .select('key, value, description, updated_at')
        .order('key');
      if (err) throw err;
      setSettings(data || []);
    } catch (err: any) {
      setError('Failed to load settings: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleUpdate = async (key: string, currentDesc: string | null) => {
    setError('');
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(editValue);
      } catch {
        setError('Value must be valid JSON syntax (e.g. 10, "string", true, {"key": "val"}).');
        return;
      }
      setSubmitting(true);
      const { data: result, error: rpcErr } = await lpuClient.manageGlobalSetting('upsert', {
        key: key,
        value: parsed,
        description: currentDesc || undefined
      });
      if (rpcErr) throw rpcErr;
      const rpcResult = typeof result === 'string' ? JSON.parse(result) : result;
      if (rpcResult?.code) throw new Error(rpcResult.message);

      setSuccess(`Global setting "${key}" updated.`);
      setEditingKey(null);
      fetchSettings();
    } catch (err: any) {
      setError('Update failed: ' + (err.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim()) { setError('Key identifier is required.'); return; }
    setError('');
    setSubmitting(true);
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(newValue || '""');
      } catch {
        setError('Value must be valid JSON syntax.');
        return;
      }
      const { data: result, error: rpcErr } = await lpuClient.manageGlobalSetting('upsert', {
        key: newKey.trim(),
        value: parsed,
        description: newDesc.trim() || undefined
      });
      if (rpcErr) throw rpcErr;
      const rpcResult = typeof result === 'string' ? JSON.parse(result) : result;
      if (rpcResult?.code) throw new Error(rpcResult.message);

      setSuccess('Configuration parameter added.');
      setShowAdd(false);
      setNewKey('');
      setNewValue('');
      setNewDesc('');
      fetchSettings();
    } catch (err: any) {
      setError('Failed to add setting: ' + (err.message || ''));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-purple">SYSTEM CONFIGURATION</span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Dynamic Key-Value Store</span>
          </div>
          <h2 className="page-title">Global System Settings</h2>
          <p className="page-description">Tune client parameters, event batch limits, pagination increments, and ad placement frequencies.</p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} />
          <span>New Setting</span>
        </button>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--danger-subtle)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--success-subtle)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Main Table Card */}
      <div className="card-box">
        <div className="card-box-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 className="card-box-title">System Parameters</h3>
            <span className="badge badge-purple">{settings.length} Keys</span>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Fetching global configurations..." />
        ) : settings.length === 0 ? (
          <EmptyState
            title="No Settings Configured"
            description="Add global system variables to configure client and platform behavior."
            icon={<Sliders size={26} />}
            actionLabel="+ Add Configuration Key"
            onAction={() => setShowAdd(true)}
          />
        ) : (
          <div className="table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{ width: '220px' }}>Key Identifier</th>
                  <th>Configured Value (JSON)</th>
                  <th>Description & Purpose</th>
                  <th>Last Modified</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {settings.map(s => (
                  <tr key={s.key}>
                    <td>
                      <span className="font-mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                        {s.key}
                      </span>
                    </td>
                    <td>
                      {editingKey === s.key ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <textarea
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            rows={2}
                            className="form-textarea font-mono"
                            style={{ fontSize: '12px', minHeight: '60px' }}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <code className="font-mono" style={{ fontSize: '12.5px', color: 'var(--text-main)', backgroundColor: 'var(--bg-surface-raised)', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)', display: 'inline-block', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {JSON.stringify(s.value)}
                        </code>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        {s.description || '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                        {new Date(s.updated_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {editingKey === s.key ? (
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleUpdate(s.key, s.description)}
                            disabled={submitting}
                          >
                            <Save size={13} />
                            <span>Save</span>
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditingKey(null)}
                            disabled={submitting}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => { setEditingKey(s.key); setEditValue(JSON.stringify(s.value, null, 2)); }}
                        >
                          <Edit3 size={13} />
                          <span>Edit</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Setting Modal */}
      {showAdd && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">New Global Setting Parameter</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAdd(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label htmlFor="setKey" className="form-label">Key Name *</label>
                  <input
                    id="setKey"
                    type="text"
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    placeholder="e.g. initial_event_limit"
                    className="form-input font-mono"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="setValue" className="form-label">JSON Value *</label>
                  <textarea
                    id="setValue"
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    placeholder='e.g. 10 or "active" or {"key": "val"}'
                    rows={3}
                    className="form-textarea font-mono"
                    style={{ fontSize: '13px' }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="setDesc" className="form-label">Description (Optional)</label>
                  <input
                    id="setDesc"
                    type="text"
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Describe how the portal uses this parameter"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Add Setting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
