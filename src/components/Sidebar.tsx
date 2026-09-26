import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Building2,
  UserCheck,
  CalendarDays,
  Megaphone,
  Image as ImageIcon,
  FolderTree,
  Sliders,
  FileSpreadsheet,
  Activity
} from 'lucide-react';
import { LpuLogo } from './common/LpuLogo';

export type AdminTab =
  // Organizer Tabs
  | 'org-dashboard'
  | 'org-create-event'
  | 'org-active-events'
  | 'org-past-events'
  | 'org-workspace'
  | 'org-info'
  // Super Admin Tabs
  | 'access-requests'
  | 'platform-events'
  | 'ads-management'
  | 'carousel-management'
  | 'categories-management'
  | 'settings-management'
  | 'audit-logs'
  | 'system-health';

interface SidebarProps {
  role: 'super-admin' | 'organizer' | 'unapproved';
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ role, activeTab, setActiveTab, isOpenMobile, onCloseMobile }) => {
  if (role === 'unapproved') return null;

  const handleTabClick = (tab: AdminTab) => {
    setActiveTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const isSuperAdmin = role === 'super-admin';

  return (
    <aside className={`admin-sidebar ${isOpenMobile ? 'mobile-open' : ''}`}>
      {/* Brand Header */}
      <div className="admin-sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <LpuLogo size={60} />
          <div>
            <div className="font-heading" style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              LPU Events
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span className={`badge ${isSuperAdmin ? 'badge-purple' : 'badge-accent'}`} style={{ padding: '2px 8px', fontSize: '9px', fontWeight: 700 }}>
                {isSuperAdmin ? 'SUPER ADMIN' : 'ORGANIZER'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav groups */}
      <div className="admin-sidebar-nav">
        {role === 'organizer' && (
          <>
            <div className="admin-sidebar-group">
              <span className="admin-sidebar-group-label">Workspace</span>
              
              <button
                className={`admin-nav-item ${activeTab === 'org-dashboard' ? 'active' : ''}`}
                onClick={() => handleTabClick('org-dashboard')}
              >
                <LayoutDashboard size={17} />
                <span>Dashboard Overview</span>
              </button>

              <button
                className={`admin-nav-item ${activeTab === 'org-create-event' ? 'active' : ''}`}
                onClick={() => handleTabClick('org-create-event')}
              >
                <PlusCircle size={17} />
                <span>Create New Event</span>
              </button>

              <button
                className={`admin-nav-item ${activeTab === 'org-active-events' ? 'active' : ''}`}
                onClick={() => handleTabClick('org-active-events')}
              >
                <CalendarDays size={17} />
                <span>All Active Events</span>
              </button>

              <button
                className={`admin-nav-item ${activeTab === 'org-past-events' ? 'active' : ''}`}
                onClick={() => handleTabClick('org-past-events')}
              >
                <Activity size={17} />
                <span>Past Events</span>
              </button>
            </div>

            <div className="admin-sidebar-group">
              <span className="admin-sidebar-group-label">Organization</span>
              
              <button
                className={`admin-nav-item ${activeTab === 'org-info' ? 'active' : ''}`}
                onClick={() => handleTabClick('org-info')}
              >
                <Building2 size={17} />
                <span>Club Profile</span>
              </button>
            </div>
          </>
        )}

        {role === 'super-admin' && (
          <>
            <div className="admin-sidebar-group">
              <span className="admin-sidebar-group-label">Core Operations</span>
              
              <button
                className={`admin-nav-item ${activeTab === 'access-requests' ? 'active-purple' : ''}`}
                onClick={() => handleTabClick('access-requests')}
              >
                <UserCheck size={17} />
                <span>Access Approvals</span>
              </button>

              <button
                className={`admin-nav-item ${activeTab === 'platform-events' ? 'active-purple' : ''}`}
                onClick={() => handleTabClick('platform-events')}
              >
                <CalendarDays size={17} />
                <span>Platform Events</span>
              </button>
            </div>

            <div className="admin-sidebar-group">
              <span className="admin-sidebar-group-label">Growth & Content</span>

              <button
                className={`admin-nav-item ${activeTab === 'carousel-management' ? 'active-purple' : ''}`}
                onClick={() => handleTabClick('carousel-management')}
              >
                <ImageIcon size={17} />
                <span>Hero Carousel</span>
              </button>

              <button
                className={`admin-nav-item ${activeTab === 'ads-management' ? 'active-purple' : ''}`}
                onClick={() => handleTabClick('ads-management')}
              >
                <Megaphone size={17} />
                <span>Advertisements</span>
              </button>

              <button
                className={`admin-nav-item ${activeTab === 'categories-management' ? 'active-purple' : ''}`}
                onClick={() => handleTabClick('categories-management')}
              >
                <FolderTree size={17} />
                <span>Taxonomy Categories</span>
              </button>
            </div>

            <div className="admin-sidebar-group">
              <span className="admin-sidebar-group-label">Governance & System</span>

              <button
                className={`admin-nav-item ${activeTab === 'settings-management' ? 'active-purple' : ''}`}
                onClick={() => handleTabClick('settings-management')}
              >
                <Sliders size={17} />
                <span>Global Settings</span>
              </button>

              <button
                className={`admin-nav-item ${activeTab === 'audit-logs' ? 'active-purple' : ''}`}
                onClick={() => handleTabClick('audit-logs')}
              >
                <FileSpreadsheet size={17} />
                <span>Audit Logs Trail</span>
              </button>

              <button
                className={`admin-nav-item ${activeTab === 'system-health' ? 'active-purple' : ''}`}
                onClick={() => handleTabClick('system-health')}
              >
                <Activity size={17} />
                <span>System Telemetry</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Footer info */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="pulse-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)', display: 'inline-block' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>System Online</span>
        </div>
        <span className="font-mono" style={{ fontSize: '10px', color: 'var(--text-dim)' }}>v2.4</span>
      </div>
    </aside>
  );
};
