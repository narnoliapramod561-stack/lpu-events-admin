import React, { useState } from 'react';
import { SuperAdminSidebar, AdminNavTab } from './components/shell/SuperAdminSidebar';
import { AdminHeader } from './components/shell/AdminHeader';
import { DashboardOverview } from './components/superadmin/DashboardOverview';
import { AccessRequestsPanel } from './components/superadmin/AccessRequestsPanel';
import { ApprovedOrganizersPanel } from './components/superadmin/ApprovedOrganizersPanel';
import { AdControlPanel } from './components/superadmin/AdControlPanel';
import { ManageEventsPanel } from './components/superadmin/ManageEventsPanel';
import { CreateEventWizard } from './components/superadmin/CreateEventWizard';
import { AdvertisementsPanel } from './components/superadmin/AdvertisementsPanel';
import { FeaturedEventsPanel } from './components/superadmin/FeaturedEventsPanel';
import { AnalyticsPanel } from './components/superadmin/AnalyticsPanel';
import { CategoriesPanel } from './components/superadmin/CategoriesPanel';
import { AuditLogsPanel } from './components/superadmin/AuditLogsPanel';
import { SystemHealthPanel } from './components/superadmin/SystemHealthPanel';
import { SettingsPanel } from './components/superadmin/SettingsPanel';
import { HeroCarouselManagerPanel } from './components/superadmin/HeroCarouselManagerPanel';
import { HappeningTodayManagerPanel } from './components/superadmin/HappeningTodayManagerPanel';
import { TrendingEventsPanel } from './components/superadmin/TrendingEventsPanel';
import { useAuth } from './auth';

interface SuperAdminAppProps {
  onLogout?: () => void;
}

export const SuperAdminApp: React.FC<SuperAdminAppProps> = ({ onLogout }) => {
  const { user, profile } = useAuth();
  const userEmail = user?.email || profile?.email || '';
  const displayName = profile?.display_name || (userEmail ? userEmail.split('@')[0] : 'Super Admin');

  const [activeTab, setActiveTabState] = useState<AdminNavTab>(() => {
    try {
      const saved = sessionStorage.getItem('lpu_superadmin_active_tab');
      if (saved) return saved as AdminNavTab;
    } catch (e) {}
    return 'dashboard';
  });

  const setActiveTab = (tab: AdminNavTab) => {
    setActiveTabState(tab);
    try {
      sessionStorage.setItem('lpu_superadmin_active_tab', tab);
    } catch (e) {}
  };

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  const handleStartCreate = () => {
    setEditingEventId(null);
    setActiveTab('create-event');
  };

  const handleStartEdit = (id: string) => {
    setEditingEventId(id);
    setActiveTab('create-event');
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverview onNavigate={setActiveTab} />;
      case 'access-requests':
        return <AccessRequestsPanel onNavigateToApproved={() => setActiveTab('approved-organizers')} />;
      case 'approved-organizers':
        return <ApprovedOrganizersPanel />;
      case 'create-event':
        return (
          <CreateEventWizard
            editEventId={editingEventId || undefined}
            onCancel={() => {
              setEditingEventId(null);
              setActiveTab('all-events');
            }}
            onComplete={() => {
              setEditingEventId(null);
              setActiveTab('all-events');
            }}
          />
        );
      case 'all-events':
      case 'manage-events':
        return (
          <ManageEventsPanel
            key="active-events-panel"
            mode="active"
            onCreateClick={handleStartCreate}
            onEditClick={handleStartEdit}
          />
        );
      case 'past-events':
      case 'old-events':
        return (
          <ManageEventsPanel
            key="past-events-panel"
            mode="past"
            onCreateClick={handleStartCreate}
            onEditClick={handleStartEdit}
          />
        );
      case 'featured-events':
        return <FeaturedEventsPanel />;
      case 'trending-events':
        return <TrendingEventsPanel />;
      case 'hero-carousel':
        return <HeroCarouselManagerPanel />;
      case 'happening-today':
        return <HappeningTodayManagerPanel />;
      case 'advertisements':
        return <AdvertisementsPanel />;
      case 'categories':
        return <CategoriesPanel />;
      case 'ad-control':
        return <AdControlPanel />;
      case 'analytics':
        return <AnalyticsPanel />;
      case 'audit-logs':
        return <AuditLogsPanel />;
      case 'system-health':
        return <SystemHealthPanel />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return <DashboardOverview onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className={`min-h-screen flex bg-[#fff8f6] text-[#261812] font-['Inter'] ${darkMode ? 'dark bg-[#1a120e] text-[#ffede6]' : ''}`}>
      {/* Docked Sidebar */}
      <SuperAdminSidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userEmail={userEmail}
        displayName={displayName}
        onLogout={onLogout} 
      />

      {/* Main Content Area */}
      <div className="flex-1 ml-0 md:ml-[280px] w-full md:w-[calc(100%-280px)] flex flex-col min-h-screen">
        <AdminHeader 
          activeTab={activeTab}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          onCreateClick={() => setActiveTab('create-event')}
          userEmail={userEmail}
          displayName={displayName}
          onLogout={onLogout}
        />

        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
};

export default SuperAdminApp;
