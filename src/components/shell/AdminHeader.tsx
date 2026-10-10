import React from 'react';

interface HeaderProps {
  activeTab: string;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  onCreateClick?: () => void;
  userEmail?: string;
  displayName?: string;
  onLogout?: () => void;
}

export const AdminHeader: React.FC<HeaderProps> = ({
  activeTab,
  darkMode,
  onToggleDarkMode,
  userEmail,
  displayName,
}) => {
  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard';
      case 'operations': return 'Operations Control Center';
      case 'access-requests': return 'Organizer Access Requests';
      case 'approved-organizers': return 'Approved Organizers Registry';
      case 'all-events':
      case 'manage-events': return 'All Active Events';
      case 'past-events':
      case 'old-events': return 'Past Events Archive';
      case 'create-event': return 'Create Event';
      case 'featured-events': return 'Featured Events';
      case 'hero-carousel': return 'Hero Carousel Builder';
      case 'advertisements': return 'Advertisements';
      case 'memories':
      case 'carousel': return 'Past Events Carousel & Memories';
      case 'categories': return 'Categories & Platform Taxonomy';
      case 'ad-control': return 'Ad Control Center';
      case 'site-controls': return 'Campus Broadcast & Maintenance';
      case 'student-inquiries': return 'Student Inquiries & Support Desk';
      case 'analytics': return 'Analytics Overview';
      case 'audit-logs': return 'Platform Audit Logs';
      case 'outbox': return 'Outbox Notifications Queue';
      case 'system-health': return 'System Health & Services';
      case 'settings': return 'System Settings & Config';
      default: return 'Super Admin';
    }
  };

  const initialLetter = (displayName || userEmail || 'S').charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 flex justify-between items-center w-full px-6 md:px-8 h-20 bg-[#fff8f6]/90 dark:bg-[#1c1c1e]/90 backdrop-blur-md border-b border-[#e2bfb0] dark:border-white/10 shadow-sm">
      {/* Breadcrumb Context */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-[#5a4136] dark:text-[#aeaeb2] hidden md:inline">Admin</span>
        <span className="text-sm text-[#8e7164] dark:text-[#8e8e93] hidden md:inline material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-white">{getTitle()}</span>
      </div>

      {/* Top Right: Mode Switcher + Account Name and Super Admin */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {onToggleDarkMode && (
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="w-9 h-9 rounded-full flex items-center justify-center border border-[#e2bfb0] dark:border-white/10 bg-white/70 dark:bg-white/[0.04] text-[#5a4136] dark:text-[#aeaeb2] hover:text-[#261812] dark:hover:text-white hover:bg-[#fee3d8] dark:hover:bg-white/10 transition-colors cursor-pointer shadow-xs active:scale-95"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <span className="material-symbols-outlined text-[18px]">
              {darkMode ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
        )}

        {(userEmail || displayName) && (
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#fee3d8]/80 dark:bg-white/[0.04] border border-[#e2bfb0] dark:border-white/10 shadow-xs">
            <div className="w-8 h-8 rounded-full bg-[#ff6b00] text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
              {initialLetter}
            </div>
            <div className="flex flex-col text-left max-w-[200px] sm:max-w-[260px]">
              <span className="text-xs font-bold text-[#261812] dark:text-white truncate leading-tight" title={userEmail}>
                {userEmail || displayName}
              </span>
              <span className="text-[10px] font-extrabold uppercase text-[#ff6b00] tracking-wider leading-none mt-0.5">
                SUPER ADMIN
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

