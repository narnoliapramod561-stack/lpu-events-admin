import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { LpuLogo } from '../common/LpuLogo';

export type AdminNavTab =
  | 'dashboard'
  | 'access-requests'
  | 'approved-organizers'
  | 'create-event'
  | 'all-events'
  | 'manage-events'
  | 'past-events'
  | 'old-events'
  | 'featured-events'
  | 'advertisements'
  | 'memories'
  | 'carousel'
  | 'hero-carousel'
  | 'happening-today'
  | 'categories'
  | 'ad-control'
  | 'analytics'
  | 'audit-logs'
  | 'outbox'
  | 'system-health'
  | 'settings';

interface SidebarProps {
  activeTab: AdminNavTab;
  setActiveTab: (tab: AdminNavTab) => void;
  onLogout?: () => void;
}

export const SuperAdminSidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const { count, error } = await supabase
          .from('organizer_access_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'PENDING');
        if (!error && count !== null) {
          setPendingCount(count);
        }
      } catch (e) {
        console.error('Error fetching pending access requests count:', e);
      }
    };
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 15000);
    return () => clearInterval(interval);
  }, []);

  const navSections = [
    {
      group: 'Main',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { 
          id: 'access-requests', 
          label: 'Access Requests', 
          icon: 'how_to_reg',
          badge: pendingCount > 0 ? `${pendingCount}` : undefined
        },
        { 
          id: 'approved-organizers', 
          label: 'Approved Organizers', 
          icon: 'badge'
        }
      ]
    },
    {
      group: 'Events',
      items: [
        { id: 'create-event', label: 'Create Event', icon: 'add_circle' },
        { id: 'all-events', label: 'All Active Events', icon: 'calendar_month' },
        { id: 'past-events', label: 'Past Events', icon: 'history' }
      ]
    },
    {
      group: 'Content',
      items: [
        { id: 'hero-carousel', label: 'Hero Carousel', icon: 'view_carousel' },
        { id: 'happening-today', label: 'Happening Today', icon: 'event_available' },
        { id: 'featured-events', label: 'Featured Events', icon: 'star' },
        { id: 'advertisements', label: 'Advertisements', icon: 'ads_click' },
        { id: 'memories', label: 'Past Events Carousel', icon: 'history_toggle_off' },
        { id: 'categories', label: 'Categories & Tags', icon: 'category' }
      ]
    },
    {
      group: 'Control',
      items: [
        { id: 'ad-control', label: 'Ad Control', icon: 'settings_applications' }
      ]
    },
    {
      group: 'Insights & System',
      items: [
        { id: 'analytics', label: 'Analytics', icon: 'monitoring' },
        { id: 'audit-logs', label: 'Audit Logs', icon: 'receipt_long' },
        { id: 'outbox', label: 'Outbox Queue', icon: 'send_and_archive' },
        { id: 'system-health', label: 'System Health', icon: 'health_and_safety' },
        { id: 'settings', label: 'Settings', icon: 'settings' }
      ]
    }
  ];

  return (
    <aside className="hidden md:flex flex-col h-full py-4 fixed left-0 top-0 w-[280px] bg-[#ffeae1] dark:bg-[#261812] border-r border-[#e2bfb0] dark:border-[#5a4136] shadow-sm z-50 overflow-y-auto">
      {/* Brand Logo Header */}
      <div className="px-5 pb-5 pt-2 flex items-center gap-3 border-b border-[#e2bfb0]/40">
        <LpuLogo className="w-11 h-11 shrink-0 drop-shadow-sm" />
        <div>
          <h1 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6] tracking-tight">LPU Events</h1>
          <p className="text-xs font-semibold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">Super Admin Portal</p>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 py-4 space-y-4">
        {navSections.map((sec, idx) => (
          <div key={idx}>
            <span className="px-3 text-[11px] font-bold text-[#5a4136]/70 dark:text-[#ffb693]/70 uppercase tracking-wider">
              {sec.group}
            </span>
            <div className="mt-1 space-y-1">
              {sec.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as AdminNavTab)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-[#fee3d8] dark:bg-[#3d2d26] text-[#a04100] dark:text-[#ffb693] border-l-4 border-[#fc721e] shadow-sm font-bold scale-[0.99]'
                        : 'text-[#5a4136] dark:text-[#ffede6]/80 hover:text-[#a04100] dark:hover:text-[#ffb693] hover:bg-[#f8ddd2]/60 dark:hover:bg-[#3d2d26]/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="material-symbols-outlined text-[20px]"
                        style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className="bg-[#ff6b00] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout Footer */}
      <div className="px-3 pt-3 border-t border-[#e2bfb0]/40 mt-auto">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-[#ba1a1a] hover:bg-[#ffdad6]/40 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};
