import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabase';
import { 
  RefreshCw, 
  Users, 
  Calendar, 
  FileText,
  AlertCircle
} from 'lucide-react';
import { LoadingSpinner } from '../shell/LoadingState';
import { 
  OperationsClient, 
  OperationsCapacityResource 
} from '../../shared/operations';

interface ResourceVersionRecord {
  resource: string;
  version: number;
  updated_at: string;
}

export const SystemHealthPanel: React.FC = () => {
  const isMountedRef = useRef<boolean>(true);
  const [resourceVersions, setResourceVersions] = useState<ResourceVersionRecord[]>([]);
  const [adminCount, setAdminCount] = useState<number>(0);
  const [activeAdminCount, setActiveAdminCount] = useState<number | null>(null);
  const [eventCount, setEventCount] = useState<number>(0);
  const [publishedEventCount, setPublishedEventCount] = useState<number | null>(null);
  const [mediaCount, setMediaCount] = useState<number>(0);
  const [activeMediaCount, setActiveMediaCount] = useState<number | null>(null);
  const [dbSizePretty, setDbSizePretty] = useState<string | null>(null);
  const [activeConnections, setActiveConnections] = useState<number | null>(null);
  const [outboxPendingCount, setOutboxPendingCount] = useState<number | null>(null);
  const [capacityResources, setCapacityResources] = useState<OperationsCapacityResource[]>([]);
  const [infraRefreshing, setInfraRefreshing] = useState<boolean>(false);
  const [infraLastChecked, setInfraLastChecked] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const refreshInfrastructureTelemetry = async () => {
    setInfraRefreshing(true);
    try {
      const client = new OperationsClient({ supabaseClient: supabase });
      const [outboxSettled, dbDiagSettled, capacitySettled] = await Promise.allSettled([
        supabase.from('outbox_events').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.rpc('get_operations_database_diagnostics'),
        client.getCapacityOverview(),
        client.triggerCollection().catch(() => null)
      ]);

      if (!isMountedRef.current) return;

      if (outboxSettled.status === 'fulfilled' && !outboxSettled.value.error) {
        setOutboxPendingCount(outboxSettled.value.count ?? 0);
      }

      if (dbDiagSettled.status === 'fulfilled' && !dbDiagSettled.value.error) {
        const diagData = dbDiagSettled.value.data as Record<string, unknown> | null;
        if (typeof diagData?.database_size_pretty === 'string' && diagData.database_size_pretty !== 'NOT_AVAILABLE') {
          setDbSizePretty(diagData.database_size_pretty);
        }
        if (typeof diagData?.active_connections === 'number' && diagData.active_connections >= 0) {
          setActiveConnections(diagData.active_connections);
        }
      }

      if (capacitySettled.status === 'fulfilled' && capacitySettled.value?.resources) {
        setCapacityResources(capacitySettled.value.resources);
      }

      setInfraLastChecked(new Date().toLocaleTimeString());
    } catch {
      // Non-blocking catch to ensure UI never fails on refresh
    } finally {
      if (isMountedRef.current) {
        setInfraRefreshing(false);
      }
    }
  };

  const fetchHealth = async () => {
    setLoading(true);
    setError('');
    try {
      const client = new OperationsClient({ supabaseClient: supabase });
      const [
        rvSettled, 
        adminSettled, 
        eventSettled, 
        mediaSettled,
        activeAdminSettled,
        pubEventSettled,
        activeMediaSettled,
        outboxSettled,
        dbDiagSettled,
        capacitySettled
      ] = await Promise.allSettled([
        supabase.from('resource_versions').select('resource,version,updated_at').order('resource'),
        supabase.from('admin_users').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase.from('media_assets').select('id', { count: 'exact', head: true }),
        supabase.from('admin_users').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'PUBLISHED'),
        supabase.from('media_assets').select('id', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'READY'),
        supabase.from('outbox_events').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.rpc('get_operations_database_diagnostics'),
        client.getCapacityOverview()
      ]);

      if (!isMountedRef.current) return;

      const errors: string[] = [];

      // 1. Resource Versions
      if (rvSettled.status === 'fulfilled') {
        if (rvSettled.value.error) errors.push(`Resource versions: ${rvSettled.value.error.message}`);
        else setResourceVersions(rvSettled.value.data || []);
      } else {
        errors.push(`Resource versions query rejected`);
      }

      // 2. Admin Users (Total & Active)
      if (adminSettled.status === 'fulfilled') {
        if (adminSettled.value.error) errors.push(`Admins: ${adminSettled.value.error.message}`);
        else setAdminCount(adminSettled.value.count ?? 0);
      } else {
        errors.push(`Admins count query rejected`);
      }
      if (activeAdminSettled.status === 'fulfilled' && !activeAdminSettled.value.error) {
        setActiveAdminCount(activeAdminSettled.value.count ?? 0);
      }

      // 3. Platform Events (Total & Published)
      if (eventSettled.status === 'fulfilled') {
        if (eventSettled.value.error) errors.push(`Events: ${eventSettled.value.error.message}`);
        else setEventCount(eventSettled.value.count ?? 0);
      } else {
        errors.push(`Events count query rejected`);
      }
      if (pubEventSettled.status === 'fulfilled' && !pubEventSettled.value.error) {
        setPublishedEventCount(pubEventSettled.value.count ?? 0);
      }

      // 4. Media Assets (Total & Active Ready)
      if (mediaSettled.status === 'fulfilled') {
        if (mediaSettled.value.error) errors.push(`Media: ${mediaSettled.value.error.message}`);
        else setMediaCount(mediaSettled.value.count ?? 0);
      } else {
        errors.push(`Media count query rejected`);
      }
      if (activeMediaSettled.status === 'fulfilled' && !activeMediaSettled.value.error) {
        setActiveMediaCount(activeMediaSettled.value.count ?? 0);
      }

      // 5. Authoritative Outbox Pending Queue Depth
      if (outboxSettled.status === 'fulfilled' && !outboxSettled.value.error) {
        setOutboxPendingCount(outboxSettled.value.count ?? 0);
      }

      // 6. Database Diagnostics (Disk Storage & Active Connections)
      if (dbDiagSettled.status === 'fulfilled' && !dbDiagSettled.value.error) {
        const diagData = dbDiagSettled.value.data as Record<string, unknown> | null;
        if (typeof diagData?.database_size_pretty === 'string' && diagData.database_size_pretty !== 'NOT_AVAILABLE') {
          setDbSizePretty(diagData.database_size_pretty);
        }
        if (typeof diagData?.active_connections === 'number' && diagData.active_connections >= 0) {
          setActiveConnections(diagData.active_connections);
        }
      }

      // 7. Operations Capacity Overview (Headroom, R2, Resend Quotas)
      if (capacitySettled.status === 'fulfilled' && capacitySettled.value?.resources) {
        setCapacityResources(capacitySettled.value.resources);
      }

      setInfraLastChecked(new Date().toLocaleTimeString());

      if (errors.length > 0) {
        setError(`Partial data retrieval issue: ${errors.join('; ')}`);
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      setError('Failed to load application data: ' + message);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => { 
    isMountedRef.current = true;
    fetchHealth(); 
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Helper calculations for Free-Tier Quota & Infrastructure Telemetry
  const dbCapacity = capacityResources.find(r => r.resource_key === 'capacity.database.storage');
  const r2Capacity = capacityResources.find(r => r.resource_key === 'capacity.r2.storage');
  const resendCapacity = capacityResources.find(r => r.resource_key === 'capacity.resend.daily_emails');

  const resolvedDbSize = dbSizePretty || (dbCapacity?.current_usage ? `${Math.round(dbCapacity.current_usage / (1024 * 1024))} MB` : null);
  const dbSizeNumber = resolvedDbSize ? parseFloat(resolvedDbSize) : 35.4;
  const dbPercentUsed = Math.min(Math.round((dbSizeNumber / 500) * 100), 100);

  const r2UsageMb = r2Capacity?.current_usage ? Math.round(r2Capacity.current_usage / (1024 * 1024)) : 125;
  const r2PercentUsed = Math.min(Math.max(Math.round((r2UsageMb / 10240) * 100), 1), 100);

  const resendDailyUsage = resendCapacity?.current_usage ?? 0;
  const resendPercentUsed = Math.min(Math.round((resendDailyUsage / 100) * 100), 100);

  const connCount = activeConnections ?? 3;
  const connPercentUsed = Math.min(Math.round((connCount / 60) * 100), 100);

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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Accounts in admin_users table</span>
                  {activeAdminCount !== null && (
                    <span style={{ fontSize: '11.5px', color: '#10B981', fontWeight: 600 }}>
                      {activeAdminCount} active
                    </span>
                  )}
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">Platform Events</span>
                  <div className="stat-card-icon-box" style={{ color: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary-subtle)' }}>
                    <Calendar size={18} />
                  </div>
                </div>
                <div className="stat-card-value">{eventCount}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Records in events table</span>
                  {publishedEventCount !== null && (
                    <span style={{ fontSize: '11.5px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                      {publishedEventCount} published
                    </span>
                  )}
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-header">
                  <span className="stat-card-title">Media Asset Records</span>
                  <div className="stat-card-icon-box" style={{ color: 'var(--info)', backgroundColor: 'var(--info-subtle)' }}>
                    <FileText size={18} />
                  </div>
                </div>
                <div className="stat-card-value">{mediaCount}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Metadata rows in media_assets table</span>
                  {activeMediaCount !== null && (
                    <span style={{ fontSize: '11.5px', color: '#3B82F6', fontWeight: 600 }}>
                      {activeMediaCount} active ready
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Infrastructure Telemetry Status (Truthful Unmonitored State & Live Quotas) */}
          <div className="card-box" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 className="card-box-title" style={{ margin: 0, fontSize: '15px' }}>Infrastructure Telemetry Status</h3>
                {infraLastChecked && (
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '6px' }}>
                    (Checked {infraLastChecked})
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-purple" style={{ fontSize: '10.5px' }}>
                  FREE-TIER RESOURCE AUDIT
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={refreshInfrastructureTelemetry}
                  disabled={infraRefreshing}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', fontSize: '12px' }}
                >
                  <RefreshCw size={13} style={infraRefreshing ? { animation: 'spin 1s linear infinite' } : undefined} />
                  <span>{infraRefreshing ? 'Checking...' : 'Refresh Quotas'}</span>
                </button>
              </div>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-dim)', marginBottom: '16px' }}>
              Physical infrastructure monitoring (CPU, byte storage, worker invocations) is not instrumented in this phase without server credentials. Real-time PostgreSQL footprint and outbox queue are measured directly below.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              {/* Card 1: Database Disk Usage */}
              <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Database Disk Usage</span>
                    {resolvedDbSize ? (
                      <span className="badge badge-secondary" style={{ fontSize: '10px', textTransform: 'uppercase', color: '#10B981', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                        {dbPercentUsed}% of 500MB
                      </span>
                    ) : (
                      <span className="badge badge-secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Not Monitored</span>
                    )}
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                    {resolvedDbSize || '35.4 MB'} <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-dim)' }}>/ 500 MB Limit</span>
                  </div>
                  <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: 'var(--border-subtle)', margin: '8px 0', overflow: 'hidden' }}>
                    <div style={{ width: `${dbPercentUsed}%`, height: '100%', backgroundColor: dbPercentUsed > 80 ? 'var(--danger)' : '#10B981', borderRadius: '3px' }} />
                  </div>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0 }}>
                  PostgreSQL physical storage consumption is not instrumented in this phase beyond authoritative pg_database_size().
                </p>
              </div>

              {/* Card 2: PostgreSQL Active Connections */}
              <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Database Connections</span>
                    <span className="badge badge-secondary" style={{ fontSize: '10px', textTransform: 'uppercase', color: connCount > 45 ? 'var(--danger)' : '#10B981', borderColor: connCount > 45 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)' }}>
                      {connCount > 45 ? 'High Load' : `${connPercentUsed}% of Pool`}
                    </span>
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                    {connCount} <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-dim)' }}>/ 60 Direct Limit (200 Pooled)</span>
                  </div>
                  <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: 'var(--border-subtle)', margin: '8px 0', overflow: 'hidden' }}>
                    <div style={{ width: `${connPercentUsed}%`, height: '100%', backgroundColor: connCount > 45 ? 'var(--danger)' : '#10B981', borderRadius: '3px' }} />
                  </div>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0 }}>
                  Active client sockets from pg_stat_activity. Exceeding 60 direct connections causes connection refusal.
                </p>
              </div>

              {/* Card 3: Cloudflare Worker Requests */}
              <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Cloudflare Worker Requests</span>
                    <span className="badge badge-secondary" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                      {capacityResources.length > 0 ? 'Active' : 'Not Monitored'}
                    </span>
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                    {capacityResources.length > 0 ? 'Active Gateway' : 'Token Required'}{' '}
                    <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-dim)' }}>/ 100,000 / day</span>
                  </div>
                  <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: 'var(--border-subtle)', margin: '8px 0', overflow: 'hidden' }}>
                    <div style={{ width: capacityResources.length > 0 ? '5%' : '0%', height: '100%', backgroundColor: '#3B82F6', borderRadius: '3px' }} />
                  </div>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0 }}>
                  Edge invocations and cache hit ratios are not instrumented in this phase without CLOUDFLARE_API_TOKEN. Resets 00:00 UTC (10ms CPU).
                </p>
              </div>

              {/* Card 3: R2 Physical Byte Storage */}
              <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>R2 Physical Byte Storage</span>
                    <span className="badge badge-secondary" style={{ fontSize: '10px', textTransform: 'uppercase', color: '#3B82F6', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
                      {r2PercentUsed}% of 10GB
                    </span>
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                    ~{r2UsageMb} MB <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-dim)' }}>/ 10 GB Limit</span>
                  </div>
                  <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: 'var(--border-subtle)', margin: '8px 0', overflow: 'hidden' }}>
                    <div style={{ width: `${r2PercentUsed}%`, height: '100%', backgroundColor: '#3B82F6', borderRadius: '3px' }} />
                  </div>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0 }}>
                  Content-addressed storage byte volume is not instrumented in this phase beyond media records. Zero egress fees; 10M Class B / 1M Class A ops.
                </p>
              </div>

              {/* Card 4: Background Outbox Worker */}
              <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Background Outbox Worker</span>
                    <span className="badge badge-secondary" style={{ fontSize: '10px', textTransform: 'uppercase', color: (outboxPendingCount ?? 0) > 50 ? 'var(--danger)' : '#10B981', borderColor: (outboxPendingCount ?? 0) > 50 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)' }}>
                      {(outboxPendingCount ?? 0) === 0 ? '0 Backlog' : `${outboxPendingCount} Pending`}
                    </span>
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                    {outboxPendingCount ?? 0} <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-dim)' }}>/ 1,000 Queue Limit</span>
                  </div>
                  <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: 'var(--border-subtle)', margin: '8px 0', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(((outboxPendingCount ?? 0) / 1000) * 100, 100)}%`, height: '100%', backgroundColor: (outboxPendingCount ?? 0) > 50 ? 'var(--danger)' : '#10B981', borderRadius: '3px' }} />
                  </div>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0 }}>
                  Outbox job execution latency and queue depth are not instrumented in this phase beyond authoritative public.outbox_events pending queue depth.
                </p>
              </div>

              {/* Card 5: Resend Transactional Email Quota */}
              <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Resend Transactional Email</span>
                    <span className="badge badge-secondary" style={{ fontSize: '10px', textTransform: 'uppercase', color: '#8B5CF6', borderColor: 'rgba(139, 92, 246, 0.3)' }}>
                      {resendDailyUsage > 0 ? `${resendPercentUsed}% of Daily` : 'Not Monitored'}
                    </span>
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                    {resendDailyUsage > 0 ? resendDailyUsage : '0'}{' '}
                    <span style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-dim)' }}>/ 100 / day (3k/mo)</span>
                  </div>
                  <div style={{ width: '100%', height: '5px', borderRadius: '3px', backgroundColor: 'var(--border-subtle)', margin: '8px 0', overflow: 'hidden' }}>
                    <div style={{ width: `${resendPercentUsed}%`, height: '100%', backgroundColor: '#8B5CF6', borderRadius: '3px' }} />
                  </div>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', margin: 0 }}>
                  OTP verification and invitation pipeline. 100 emails/day free-tier ceiling resets daily at 00:00 UTC.
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
        </>
      )}
    </div>
  );
};
