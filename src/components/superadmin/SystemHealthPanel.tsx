import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { 
  RefreshCw, 
  Users, 
  Calendar, 
  HardDrive 
} from 'lucide-react';
import { LoadingSpinner } from '../shell/LoadingState';

export const SystemHealthPanel: React.FC = () => {
  const [resourceVersions, setResourceVersions] = useState<any[]>([]);
  const [adminCount, setAdminCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const [mediaCount, setMediaCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const [rvRes, adminRes, eventRes, mediaRes] = await Promise.all([
        supabase.from('resource_versions').select('resource,version,updated_at').order('resource'),
        supabase.from('admin_users').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase.from('media_assets').select('id', { count: 'exact', head: true })
      ]);

      setResourceVersions(rvRes.data || []);
      setAdminCount(adminRes.count || 0);
      setEventCount(eventRes.count || 0);
      setMediaCount(mediaRes.count || 0);
    } catch (err: any) {
      setError('Failed to load system health: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHealth(); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-purple">INFRASTRUCTURE TELEMETRY</span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>PostgreSQL & Background Workers</span>
          </div>
          <h2 className="page-title">System Diagnostic Health</h2>
          <p className="page-description">Real-time status of PostgreSQL storage, cache version stamps, and background worker queues.</p>
        </div>

        <button className="btn btn-secondary" onClick={fetchHealth}>
          <RefreshCw size={15} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--danger-subtle)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Polling telemetry health..." />
      ) : (
        <>
          {/* 4 Stat KPI Cards */}
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-title">Registered Admins</span>
                <div className="stat-card-icon-box" style={{ color: 'var(--accent-purple)', backgroundColor: 'var(--accent-purple-subtle)' }}>
                  <Users size={18} />
                </div>
              </div>
              <div className="stat-card-value">{adminCount}</div>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Super & Organizer accounts</span>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-title">Published Events</span>
                <div className="stat-card-icon-box" style={{ color: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary-subtle)' }}>
                  <Calendar size={18} />
                </div>
              </div>
              <div className="stat-card-value">{eventCount}</div>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Active & concluded events</span>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-title">Storage Assets</span>
                <div className="stat-card-icon-box" style={{ color: 'var(--info)', backgroundColor: 'var(--info-subtle)' }}>
                  <HardDrive size={18} />
                </div>
              </div>
              <div className="stat-card-value">{mediaCount}</div>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Banners & images</span>
            </div>
          </div>

          {/* Resource Versions Card */}
          <div className="card-box">
            <div className="card-box-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3 className="card-box-title">Cache Resource Version Stamps</h3>
                <span className="badge badge-purple">{resourceVersions.length} Stamped Caches</span>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Resource Type</th>
                    <th>Version Stamp</th>
                    <th>Last Invalidation Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {resourceVersions.map(rv => (
                    <tr key={rv.resource}>
                      <td>
                        <span className="font-mono" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                          {rv.resource}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-secondary" style={{ fontWeight: 800 }}>
                          v{rv.version}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}>
                          {new Date(rv.updated_at).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
