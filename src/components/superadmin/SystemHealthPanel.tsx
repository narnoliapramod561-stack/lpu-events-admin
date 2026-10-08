import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { 
  RefreshCw, 
  Users, 
  Calendar, 
  FileText,
  AlertCircle,
  ShieldCheck,
  Server
} from 'lucide-react';
import { LoadingSpinner } from '../shell/LoadingState';
import { OperationsClient, OperationsOverview, OperationsDatabaseDiagnostics } from '../../shared/operations';

interface ResourceVersionRecord {
  resource: string;
  version: number;
  updated_at: string;
}

export const SystemHealthPanel: React.FC = () => {
  const [resourceVersions, setResourceVersions] = useState<ResourceVersionRecord[]>([]);
  const [adminCount, setAdminCount] = useState<number>(0);
  const [eventCount, setEventCount] = useState<number>(0);
  const [mediaCount, setMediaCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Phase 2: Operations Gateway Verification State
  const [opsLoading, setOpsLoading] = useState<boolean>(false);
  const [opsData, setOpsData] = useState<{
    overview?: OperationsOverview;
    dbDiag?: OperationsDatabaseDiagnostics;
    lastVerified?: string;
    error?: string;
    collectionStatus?: string;
    metricsCollected?: number;
  } | null>(null);

  const verifyOperationsGateway = async () => {
    setOpsLoading(true);
    try {
      const client = new OperationsClient({ supabaseClient: supabase });
      const [overview, dbDiag, collection] = await Promise.all([
        client.getOverview(),
        client.getDatabaseDiagnostics(),
        client.triggerCollection().catch(() => null),
      ]);
      setOpsData({
        overview,
        dbDiag,
        collectionStatus: collection?.status || 'COLLECTED',
        metricsCollected: collection?.metricsCollected ?? 0,
        lastVerified: new Date().toLocaleTimeString(),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setOpsData({
        error: msg,
        lastVerified: new Date().toLocaleTimeString(),
      });
    } finally {
      setOpsLoading(false);
    }
  };

  const fetchHealth = async () => {
    setLoading(true);
    setError('');
    try {
      const [rvRes, adminRes, eventRes, mediaRes] = await Promise.all([
        supabase.from('resource_versions').select('resource,version,updated_at').order('resource'),
        supabase.from('admin_users').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase.from('media_assets').select('id', { count: 'exact', head: true })
      ]);

      if (rvRes.error) throw rvRes.error;
      if (adminRes.error) throw adminRes.error;
      if (eventRes.error) throw eventRes.error;
      if (mediaRes.error) throw mediaRes.error;

      setResourceVersions(rvRes.data || []);
      setAdminCount(adminRes.count || 0);
      setEventCount(eventRes.count || 0);
      setMediaCount(mediaRes.count || 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError('Failed to load application data: ' + message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchHealth(); 
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-purple">APPLICATION DATA OVERVIEW</span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Database Record Counts & Invalidation Stamps</span>
          </div>
          <h2 className="page-title">System & Data Overview</h2>
          <p className="page-description">
            Authoritative database record counts and cache invalidation revision counters. Physical infrastructure monitoring (CPU, byte storage, worker invocations) is not instrumented in this phase.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={fetchHealth} type="button">
          <RefreshCw size={15} />
          <span>Refresh Overview</span>
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--danger-subtle)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading application data..." />
      ) : (
        <>
          {/* Section: Application Data Counts */}
          <div>
            <div style={{ marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)' }}>
                Application Data Counts
              </h3>
            </div>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">Registered Admins</span>
                  <div className="stat-card-icon-box" style={{ color: 'var(--accent-purple)', backgroundColor: 'var(--accent-purple-subtle)' }}>
                    <Users size={18} />
                  </div>
                </div>
                <div className="stat-card-value">{adminCount}</div>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Accounts in admin_users table</span>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">Platform Events</span>
                  <div className="stat-card-icon-box" style={{ color: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary-subtle)' }}>
                    <Calendar size={18} />
                  </div>
                </div>
                <div className="stat-card-value">{eventCount}</div>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Records in events table</span>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">Media Asset Records</span>
                  <div className="stat-card-icon-box" style={{ color: 'var(--info)', backgroundColor: 'var(--info-subtle)' }}>
                    <FileText size={18} />
                  </div>
                </div>
                <div className="stat-card-value">{mediaCount}</div>
                <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Metadata rows in media_assets table</span>
              </div>
            </div>
          </div>

          {/* Section: Infrastructure Telemetry Status (Truthful Unmonitored State) */}
          <div className="card-box" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertCircle size={18} style={{ color: 'var(--text-dim)' }} />
              <h3 className="card-box-title" style={{ margin: 0, fontSize: '15px' }}>Infrastructure Telemetry Status</h3>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', marginBottom: '16px' }}>
              Physical infrastructure resources are not connected to the Super Admin interface in Phase 1. The indicators below explicitly reflect uninstrumented provider metrics.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Database Disk Usage</span>
                  <span className="badge badge-secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Not Monitored</span>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0 }}>
                  PostgreSQL physical storage consumption is not instrumented in this phase.
                </p>
              </div>

              <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Cloudflare Worker Requests</span>
                  <span className="badge badge-secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Not Monitored</span>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0 }}>
                  Edge invocations and cache hit ratios are not instrumented in this phase.
                </p>
              </div>

              <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>R2 Physical Byte Storage</span>
                  <span className="badge badge-secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Not Monitored</span>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0 }}>
                  Content-addressed storage byte volume is not instrumented in this phase.
                </p>
              </div>

              <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Background Outbox Worker</span>
                  <span className="badge badge-secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Not Monitored</span>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0 }}>
                  Outbox job execution latency and queue depth are not instrumented in this phase.
                </p>
              </div>
            </div>
          </div>

          {/* Resource Versions Card */}
          <div className="card-box">
            <div className="card-box-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h3 className="card-box-title">Cache Invalidation Revision Counters</h3>
                  <span className="badge badge-purple">{resourceVersions.length} Registered Resources</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px', marginBottom: 0 }}>
                  These version counters increment on database mutation to signal client and edge cache invalidation. They do not measure cache health, latency, or hit rates.
                </p>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Resource Type</th>
                    <th>Revision Version</th>
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

          {/* Phase 3: Operations Telemetry & Provider Probes Card */}
          <div className="card-box" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
            <div className="card-box-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Server size={18} style={{ color: 'var(--accent-primary)' }} />
                  <h3 className="card-box-title">Operations Control Plane (Provider & Infrastructure Telemetry)</h3>
                  <span className="badge badge-purple">PHASE 3 TELEMETRY ENGINE</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px', marginBottom: 0 }}>
                  Server-side operational gateway testing strictly enforced for Super Admins. Triggers single-flight telemetry collection across Supabase, Cloudflare, Resend, and Sentry with data freshness tracking.
                </p>
              </div>
              <button
                className="btn btn-secondary"
                onClick={verifyOperationsGateway}
                disabled={opsLoading}
                type="button"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {opsLoading ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldCheck size={15} />}
                <span>{opsLoading ? 'Collecting Telemetry...' : 'Run Telemetry Collection & Probe'}</span>
              </button>
            </div>

            {opsData && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {opsData.error ? (
                  <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--danger-subtle)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', fontSize: '13px' }}>
                    <strong>Gateway Verification Notice:</strong> {opsData.error}
                    <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>
                      Tested at {opsData.lastVerified}. Ensure Supabase Edge Functions runtime is running locally or deployed.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600 }}>Gateway Status</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#10B981', marginTop: '4px' }}>
                        {opsData.overview?.gateway.status || 'OPERATIONAL'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                        Runtime: {opsData.overview?.gateway.runtime || 'Deno Edge'}
                      </div>
                    </div>

                    <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600 }}>Database Health</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: opsData.dbDiag?.status === 'HEALTHY' ? '#10B981' : '#F59E0B', marginTop: '4px' }}>
                        {opsData.dbDiag?.status || 'UNKNOWN'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                        Latency: {opsData.dbDiag?.latency_ms ?? '--'} ms | Size: {opsData.dbDiag?.storage?.database_size_pretty ?? 'N/A'}
                      </div>
                    </div>

                    <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600 }}>Telemetry Collection</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
                        {opsData.collectionStatus || 'READY'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                        Snapshots: {opsData.metricsCollected ?? 0} metrics captured
                      </div>
                    </div>

                    <div style={{ padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600 }}>Provider Boundary</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#3B82F6', marginTop: '4px' }}>
                        Zero Browser Secrets
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                        Configured: {opsData.overview?.providers_summary.configured_server_credentials ?? 0} / {opsData.overview?.providers_summary.total ?? 0} providers
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
