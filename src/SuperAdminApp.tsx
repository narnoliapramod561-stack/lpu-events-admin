import React, { useState, useEffect } from 'react';
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

  // Keep-alive state: tracks visited tabs so components stay mounted in memory
  // This eliminates full-page reloading, wipes out spinning indicators on return,
  // and preserves filters, scroll positions, and inputs for a true desktop-class feel.
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    try {
      const saved = (sessionStorage.getItem('lpu_superadmin_active_tab') as AdminNavTab) || 'dashboard';
      const canonical = 
        saved === 'manage-events' ? 'all-events' : 
        saved === 'old-events' ? 'past-events' : 
        saved;
      initial.add(canonical);
    } catch {
      initial.add('dashboard');
    }
    return initial;
  });

  useEffect(() => {
    setVisitedTabs((prev) => {
      const canonicalTab = 
        activeTab === 'manage-events' ? 'all-events' :
        activeTab === 'old-events' ? 'past-events' : 
        activeTab;

      if (prev.has(canonicalTab)) return prev;
      const next = new Set(prev);
      next.add(canonicalTab);
      return next;
    });
  }, [activeTab]);

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('lpu_admin_theme');
      if (saved) return saved === 'dark';
      return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (darkMode) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
        localStorage.setItem('lpu_admin_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
        localStorage.setItem('lpu_admin_theme', 'light');
      }
    } catch {}
  }, [darkMode]);

  const handleStartCreate = () => {
    setEditingEventId(null);
    setActiveTab('create-event');
  };

  const handleStartEdit = (id: string) => {
    setEditingEventId(id);
    setActiveTab('create-event');
  };

  const isCurrentActiveEvents = activeTab === 'all-events' || activeTab === 'manage-events';
  const isCurrentPastEvents = activeTab === 'past-events' || activeTab === 'old-events';

  return (
    <div className={`min-h-screen flex font-['Inter'] transition-colors duration-300 ${darkMode ? 'dark bg-[#1c1c1e] text-white' : 'bg-[#fff8f6] text-[#261812]'}`}>
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
          onCreateClick={handleStartCreate}
          userEmail={userEmail}
          displayName={displayName}
          onLogout={onLogout}
        />

        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          {/* Create / Edit Event Wizard (Standalone modal flow) */}
          {activeTab === 'create-event' && (
            <CreateEventWizard
              editEventId={editingEventId || undefined}
              onCancel={() => {
                setEditingEventId(null);
                setActiveTab('all-events');
              }}
              onComplete={() => {
                setEditingEventId(null);
                setActiveTab('all-events');
                window.dispatchEvent(new CustomEvent('lpu:events-updated'));
              }}
            />
          )}

          {/* Visited Tabs Kept Alive in Memory — Zero Re-fetching, Instant Tab Switching */}
          {visitedTabs.has('dashboard') && (
            <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
              <DashboardOverview onNavigate={setActiveTab} />
            </div>
          )}

          {visitedTabs.has('access-requests') && (
            <div style={{ display: activeTab === 'access-requests' ? 'block' : 'none' }}>
              <AccessRequestsPanel onNavigateToApproved={() => setActiveTab('approved-organizers')} />
            </div>
          )}

          {visitedTabs.has('approved-organizers') && (
            <div style={{ display: activeTab === 'approved-organizers' ? 'block' : 'none' }}>
              <ApprovedOrganizersPanel />
            </div>
          )}

          {visitedTabs.has('all-events') && (
            <div style={{ display: isCurrentActiveEvents ? 'block' : 'none' }}>
              <ManageEventsPanel
                key="active-events-panel"
                mode="active"
                onCreateClick={handleStartCreate}
                onEditClick={handleStartEdit}
              />
            </div>
          )}

          {visitedTabs.has('past-events') && (
            <div style={{ display: isCurrentPastEvents ? 'block' : 'none' }}>
              <ManageEventsPanel
                key="past-events-panel"
                mode="past"
                onCreateClick={handleStartCreate}
                onEditClick={handleStartEdit}
              />
            </div>
          )}

          {visitedTabs.has('featured-events') && (
            <div style={{ display: activeTab === 'featured-events' ? 'block' : 'none' }}>
              <FeaturedEventsPanel />
            </div>
          )}

          {visitedTabs.has('trending-events') && (
            <div style={{ display: activeTab === 'trending-events' ? 'block' : 'none' }}>
              <TrendingEventsPanel />
            </div>
          )}

          {visitedTabs.has('hero-carousel') && (
            <div style={{ display: activeTab === 'hero-carousel' ? 'block' : 'none' }}>
              <HeroCarouselManagerPanel />
            </div>
          )}

          {visitedTabs.has('happening-today') && (
            <div style={{ display: activeTab === 'happening-today' ? 'block' : 'none' }}>
              <HappeningTodayManagerPanel />
            </div>
          )}

          {visitedTabs.has('advertisements') && (
            <div style={{ display: activeTab === 'advertisements' ? 'block' : 'none' }}>
              <AdvertisementsPanel />
            </div>
          )}

          {visitedTabs.has('categories') && (
            <div style={{ display: activeTab === 'categories' ? 'block' : 'none' }}>
              <CategoriesPanel />
            </div>
          )}

          {visitedTabs.has('ad-control') && (
            <div style={{ display: activeTab === 'ad-control' ? 'block' : 'none' }}>
              <AdControlPanel />
            </div>
          )}

          {visitedTabs.has('analytics') && (
            <div style={{ display: activeTab === 'analytics' ? 'block' : 'none' }}>
              <AnalyticsPanel />
            </div>
          )}

          {visitedTabs.has('audit-logs') && (
            <div style={{ display: activeTab === 'audit-logs' ? 'block' : 'none' }}>
              <AuditLogsPanel />
            </div>
          )}

          {visitedTabs.has('system-health') && (
            <div style={{ display: activeTab === 'system-health' ? 'block' : 'none' }}>
              <SystemHealthPanel />
            </div>
          )}

          {visitedTabs.has('settings') && (
            <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
              <SettingsPanel />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default SuperAdminApp;
