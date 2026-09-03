import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './auth';
import { supabase } from './supabase';
import { AdminTab } from './components/Sidebar';
import { OrganizerDashboard } from './components/organizer/OrganizerDashboard';
import { EventForm } from './components/organizer/EventForm';
import { EventWorkspace } from './components/organizer/EventWorkspace';
import { ClubProfilePanel } from './components/organizer/ClubProfilePanel';
import { AccessRequestsPanel } from './components/superadmin/AccessRequestsPanel';
import { PlatformEventsPanel } from './components/superadmin/PlatformEventsPanel';
import { CategoriesPanel } from './components/superadmin/CategoriesPanel';
import { SettingsPanel } from './components/superadmin/SettingsPanel';
import { AuditLogsPanel } from './components/superadmin/AuditLogsPanel';
import { AdvertisementsPanel } from './components/superadmin/AdvertisementsPanel';
import { CarouselPanel } from './components/superadmin/CarouselPanel';
import { SystemHealthPanel } from './components/superadmin/SystemHealthPanel';
import { LoginView } from './components/auth/LoginView';
import { ErrorBoundary } from './components/shell/ErrorBoundary';
import { ToastProvider } from './components/shell/NotificationContext';
import { AdminShell } from './components/shell/AdminShell';
import { RefreshCw, Send } from 'lucide-react';
import { LoadingSpinner } from './components/shell/LoadingState';
import { LpuLogo } from './components/common/LpuLogo';

import { SuperAdminApp } from './SuperAdminApp';

function AdminDashboard() {
  const { user, profile, signOut, refreshProfile } = useAuth();

  // Determine role
  const role: 'super-admin' | 'organizer' | 'unapproved' = profile?.is_super_admin
    ? 'super-admin'
    : profile?.org_id
      ? 'organizer'
      : 'unapproved';

  // If super-admin, render the complete new SuperAdmin portal
  if (role === 'super-admin') {
    return <SuperAdminApp onLogout={signOut} />;
  }

  // Navigation state with session persistence
  const [activeTab, setActiveTabState] = useState<AdminTab>(() => {
    try {
      const saved = sessionStorage.getItem('lpu_organizer_active_tab');
      if (saved && (saved === 'org-dashboard' || saved === 'org-create-event' || saved === 'org-workspace' || saved === 'org-info')) {
        return saved as AdminTab;
      }
    } catch (e) {}
    return 'org-dashboard';
  });

  const setActiveTab = (tab: AdminTab) => {
    setActiveTabState(tab);
    try {
      sessionStorage.setItem('lpu_organizer_active_tab', tab);
    } catch (e) {}
  };

  // Organizer workspace state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // --- Unapproved user view (access request form) ---
  if (role === 'unapproved') {
    return <UnapprovedView user={user} signOut={signOut} refreshProfile={refreshProfile} />;
  }

  const getRoleDisplay = () => {
    if (profile?.is_super_admin) return 'Super Admin';
    if (profile?.org_id) return `Organizer (${profile.org_name})`;
    return 'Pending Approval';
  };

  const getBadgeClass = () => {
    if (profile?.is_super_admin) return 'badge badge-purple';
    if (profile?.org_id) return 'badge badge-accent';
    return 'badge badge-warning';
  };

  const renderContent = () => {
    // Organizer tabs
    if (role === 'organizer') {
      if (selectedEventId) {
        return (
          <EventWorkspace
            eventId={selectedEventId}
            onBack={() => { setSelectedEventId(null); setActiveTab('org-dashboard'); }}
          />
        );
      }

      switch (activeTab) {
        case 'org-dashboard':
          return (
            <OrganizerDashboard
              mode="all"
              onSelectEvent={(id) => { setSelectedEventId(id); setActiveTab('org-workspace'); }}
              onCreateEventTrigger={() => setActiveTab('org-create-event')}
            />
          );
        case 'org-active-events':
          return (
            <OrganizerDashboard
              mode="active"
              onSelectEvent={(id) => { setSelectedEventId(id); setActiveTab('org-workspace'); }}
              onCreateEventTrigger={() => setActiveTab('org-create-event')}
            />
          );
        case 'org-past-events':
          return (
            <OrganizerDashboard
              mode="past"
              onSelectEvent={(id) => { setSelectedEventId(id); setActiveTab('org-workspace'); }}
              onCreateEventTrigger={() => setActiveTab('org-create-event')}
            />
          );
        case 'org-create-event':
          return (
            <EventForm
              onComplete={() => setActiveTab('org-dashboard')}
              onCancel={() => setActiveTab('org-dashboard')}
            />
          );
        case 'org-workspace':
          return (
            <OrganizerDashboard
              onSelectEvent={(id) => { setSelectedEventId(id); setActiveTab('org-workspace'); }}
              onCreateEventTrigger={() => setActiveTab('org-create-event')}
            />
          );
        case 'org-info':
          return <ClubProfilePanel />;
        default:
          return <OrganizerDashboard onSelectEvent={setSelectedEventId} onCreateEventTrigger={() => setActiveTab('org-create-event')} />;
      }
    }

    // Super Admin tabs
    if (role === 'super-admin') {
      switch (activeTab) {
        case 'access-requests': return <AccessRequestsPanel />;
        case 'platform-events': return <PlatformEventsPanel />;
        case 'ads-management': return <AdvertisementsPanel />;
        case 'carousel-management': return <CarouselPanel />;
        case 'categories-management': return <CategoriesPanel />;
        case 'settings-management': return <SettingsPanel />;
        case 'audit-logs': return <AuditLogsPanel />;
        case 'system-health': return <SystemHealthPanel />;
        default: return <AccessRequestsPanel />;
      }
    }

    return null;
  };

  return (
    <AdminShell
      role={role}
      activeTab={activeTab}
      setActiveTab={(tab) => { setSelectedEventId(null); setActiveTab(tab); }}
      userEmail={user.email}
      roleDisplay={getRoleDisplay()}
      badgeClass={getBadgeClass()}
      onLogout={signOut}
    >
      {renderContent()}
    </AdminShell>
  );
}

// --- Unapproved user view: access request form ---
function UnapprovedView({ user, signOut, refreshProfile }: { user: any; signOut: () => void; refreshProfile: () => Promise<void> }) {
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [orgName, setOrgName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchOrganizerRequestStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('organizer_access_requests')
        .select('id, organization_name, remarks, status, review_reason, created_at, updated_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMyRequests(data || []);
    } catch (err: any) {
      console.error('Error fetching request status:', err);
    }
  };

  useEffect(() => {
    fetchOrganizerRequestStatus();
  }, []);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');
    setIsSubmitting(true);

    if (!orgName.trim()) {
      setActionError('Organization name is required');
      setIsSubmitting(false);
      return;
    }

    try {
      const { data: admin, error: adminErr } = await supabase
        .from('admin_users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (adminErr || !admin) {
        throw new Error('Admin profile not found');
      }

      const { error } = await supabase
        .from('organizer_access_requests')
        .insert({
          admin_user_id: admin.id,
          organization_name: orgName.trim(),
          remarks: remarks.trim() || null,
          status: 'PENDING'
        });

      if (error) throw error;

      setActionSuccess('Access request submitted successfully. A Super Administrator will review your inquiry.');
      setOrgName('');
      setRemarks('');
      await fetchOrganizerRequestStatus();
    } catch (err: any) {
      console.error(err);
      setActionError('Failed to submit access request. You may already have an active request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      <header className="admin-header">
        <div className="admin-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LpuLogo size={32} />
            <h1 className="font-heading" style={{ fontSize: '18px', fontWeight: 800 }}>LPU Events Console</h1>
          </div>
        </div>
        <div className="admin-header-right">
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{user.email}</span>
          <span className="badge badge-warning">PENDING APPROVAL</span>
          <button className="btn btn-secondary btn-sm" onClick={signOut}>Logout</button>
        </div>
      </header>

      <main className="admin-content" style={{ maxWidth: '800px', marginTop: '20px' }}>
        {actionError && (
          <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--danger-subtle)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', marginBottom: '20px' }}>
            {actionError}
          </div>
        )}
        {actionSuccess && (
          <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--success-subtle)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', marginBottom: '20px' }}>
            {actionSuccess}
          </div>
        )}

        <div className="card-box" style={{ marginBottom: '24px' }}>
          <div className="card-box-header">
            <h3 className="card-box-title">Request Organizer Access</h3>
          </div>
          <div className="card-box-body">
            <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', lineHeight: 1.6, marginBottom: '20px' }}>
              Your account is authenticated but requires organizational authorization before you can publish events to the student portal. Submit your club details below.
            </p>

            <form onSubmit={handleCreateRequest} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label htmlFor="orgName" className="form-label">Club / Student Organization Name *</label>
                <input
                  id="orgName"
                  type="text"
                  placeholder="e.g. Club Coding, Google Developer Student Club"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  disabled={isSubmitting}
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="remarks" className="form-label">Applicant Justification / Role</label>
                <input
                  id="remarks"
                  type="text"
                  placeholder="e.g. Club President / Faculty Coordinator"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={isSubmitting}
                  className="form-input"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ alignSelf: 'flex-start' }}>
                <Send size={15} />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Authorization Request'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Previous Requests Table */}
        <div className="card-box">
          <div className="card-box-header">
            <h3 className="card-box-title">Submitted Access Requests</h3>
            <button className="btn btn-secondary btn-sm" onClick={async () => { await refreshProfile(); fetchOrganizerRequestStatus(); }}>
              <RefreshCw size={13} />
              <span>Check Status</span>
            </button>
          </div>
          {myRequests.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13.5px' }}>
              No access requests submitted yet.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Remarks</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Review Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.map((req) => (
                    <tr key={req.id}>
                      <td style={{ fontWeight: 600 }}>{req.organization_name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{req.remarks || '—'}</td>
                      <td>
                        <span className={`badge ${req.status === 'APPROVED' ? 'badge-success' : req.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                          {req.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px' }}>{new Date(req.created_at).toLocaleDateString()}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{req.review_reason || 'Under Super Admin review'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function MainApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-base)' }}>
        <LoadingSpinner message="Initializing LPU Events Console..." />
      </div>
    );
  }

  return user ? <AdminDashboard /> : <LoginView />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <MainApp />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
