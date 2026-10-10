import React, { useState, ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar, AdminTab } from '../Sidebar';

export interface AdminShellProps {
  role: 'super-admin' | 'organizer' | 'unapproved';
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  userEmail: string;
  displayName?: string;
  roleDisplay: string;
  badgeClass: string;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  onLogout: () => void;
  children: ReactNode;
}

export const AdminShell: React.FC<AdminShellProps> = ({
  role,
  activeTab,
  setActiveTab,
  userEmail,
  displayName,
  roleDisplay,
  badgeClass,
  darkMode,
  onToggleDarkMode,
  onLogout,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getSectionTitle = (tab: AdminTab): string => {
    switch (tab) {
      case 'org-dashboard': return 'Organizer Dashboard';
      case 'org-create-event': return 'Create Event Wizard';
      case 'org-workspace': return 'Event Operations Cockpit';
      case 'org-info': return 'Club Profile & Settings';
      case 'access-requests': return 'Organizer Access Approvals';
      case 'platform-events': return 'Platform Events Directory';
      case 'ads-management': return 'Advertisement Campaigns';
      case 'carousel-management': return 'Homepage Hero Carousel';
      case 'categories-management': return 'Taxonomy & Categories';
      case 'settings-management': return 'Global System Configurations';
      case 'audit-logs': return 'Security & Audit Trail';
      case 'system-health': return 'System & Data Overview';
      case 'operations': return 'Operations Control Center';
      default: return 'LPU Events Console';
    }
  };

  return (
    <div className="admin-shell">
      {/* Sidebar Navigation */}
      <Sidebar
        role={role}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userEmail={userEmail}
        displayName={displayName}
        roleDisplay={roleDisplay}
        onLogout={onLogout}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(6px)',
            zIndex: 35
          }}
        />
      )}

      {/* Main Column */}
      <div className="admin-main">
        <Header
          title={getSectionTitle(activeTab)}
          userEmail={userEmail}
          displayName={displayName}
          roleDisplay={roleDisplay}
          badgeClass={badgeClass}
          darkMode={darkMode}
          onToggleDarkMode={onToggleDarkMode}
          onLogout={onLogout}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
};

