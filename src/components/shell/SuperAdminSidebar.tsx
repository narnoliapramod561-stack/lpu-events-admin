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
  | 'trending-events'
  | 'hero-carousel'
  | 'happening-today'
  | 'categories'
  | 'student-inquiries'
  | 'messages'
  | 'analytics'
  | 'audit-logs'
  | 'system-health'
  | 'settings';

interface SidebarProps {
  activeTab: AdminNavTab;
  setActiveTab: (tab: AdminNavTab) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const SuperAdminSidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpenMobile,
  onCloseMobile,
}) => {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [openInquiriesCount, setOpenInquiriesCount] = useState<number>(0);

  useEffect(() => {
    const fetchCounts = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const [accessRes, inqRes] = await Promise.all([
          supabase
            .from('organizer_access_requests')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'PENDING'),
          supabase
            .from('student_inquiries')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'OPEN')
        ]);

        if (!accessRes.error && accessRes.count !== null) {
          setPendingCount(accessRes.count);
        }
        if (!inqRes.error && inqRes.count !== null) {
          setOpenInquiriesCount(inqRes.count);
        }
      } catch (e) {
        console.error('Error fetching sidebar notification counts:', e);
      }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchCounts();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const navSections = [
    {
      group: 'Main',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
        { 
          id: 'student-inquiries', 
          label: 'Message Center', 
          icon: 'mark_email_unread',
          badge: openInquiriesCount > 0 ? `${openInquiriesCount}` : undefined
        },
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
        { id: 'trending-events', label: 'Trending Events', icon: 'local_fire_department' },
        { id: 'featured-events', label: 'Featured Events', icon: 'star' },
        { id: 'categories', label: 'Categories & Tags', icon: 'category' }
      ]
    }
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-fadeIn"
          style={{ animationDuration: '200ms' }}
        />
      )}

      <aside
        className={`
          flex flex-col py-4 w-[280px] shrink-0 bg-[#ffeae1] dark:bg-[#1c1c1e] border-r border-[#e2bfb0] dark:border-white/10 shadow-sm overflow-y-auto
          ${isOpenMobile 
            ? 'fixed inset-y-0 left-0 z-50 h-full shadow-2xl' 
            : 'hidden md:flex h-screen sticky top-0 z-30'
          }
        `}
      >
        {/* Brand Logo Header */}
        <div className="px-4 pb-5 pt-3 flex items-center justify-between border-b border-[#e2bfb0]/40 dark:border-white/10">
          <div className="flex items-center gap-3.5 min-w-0">
            <LpuLogo className="w-16 h-16 sm:w-[72px] sm:h-[72px] shrink-0" size={72} />
            <div className="min-w-0">
              <h1 className="text-xl font-black font-['Outfit'] text-[#261812] dark:text-white tracking-tight leading-tight">LPU Events</h1>
              <p className="text-[11px] font-bold text-[#a04100] dark:text-orange-400 uppercase tracking-wider mt-0.5 whitespace-nowrap">Super Admin Portal</p>
            </div>
          </div>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-[#5a4136] dark:text-[#aeaeb2] hover:bg-[#fee3d8] dark:hover:bg-white/10"
              title="Close Sidebar"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 px-3 py-4 space-y-4">
          {navSections.map((sec, idx) => (
            <div key={idx}>
              <span className="px-3 text-[11px] font-bold text-[#5a4136]/70 dark:text-[#8e8e93] uppercase tracking-wider">
                {sec.group}
              </span>
              <div className="mt-1 space-y-1">
                {sec.items.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as AdminNavTab);
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 outline-none focus:outline-none ${
                        isActive
                          ? 'bg-[#fee3d8] dark:bg-orange-500/15 text-[#a04100] dark:text-orange-400 border-l-4 border-[#ff6b00] shadow-sm font-bold scale-[0.99]'
                          : 'text-[#5a4136] dark:text-[#aeaeb2] hover:text-[#a04100] dark:hover:text-white hover:bg-[#f8ddd2]/60 dark:hover:bg-white/5'
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
      </aside>
    </>
  );
};
