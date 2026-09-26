import React from 'react';

interface HeaderProps {
  activeTab: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onCreateClick: () => void;
  userEmail?: string;
  displayName?: string;
  onLogout?: () => void;
}

export const AdminHeader: React.FC<HeaderProps> = ({
  activeTab,
  darkMode,
  onToggleDarkMode,
  onCreateClick,
  userEmail,
  displayName,
  onLogout
}) => {
  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard';
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

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCreateClick}
          className="bg-[#ff6b00] hover:bg-[#a04100] text-white px-5 py-2 rounded-full text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Create Event</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggleDarkMode} 
            className="w-10 h-10 rounded-full hover:bg-[#fee3d8] dark:hover:bg-white/10 flex items-center justify-center text-[#5a4136] dark:text-[#aeaeb2] transition-colors"
            title="Toggle theme"
          >
            <span className="material-symbols-outlined">{darkMode ? 'light_mode' : 'dark_mode'}</span>
          </button>
        </div>

        {/* User Identity Chip */}
        {userEmail && (
          <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#fee3d8]/80 dark:bg-white/[0.04] border border-[#e2bfb0] dark:border-white/10">
            <div className="w-8 h-8 rounded-full bg-[#ff6b00] text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {initialLetter}
            </div>
            <div className="flex flex-col text-left max-w-[170px]">
              <span className="text-xs font-bold text-[#261812] dark:text-white truncate leading-tight">
                {userEmail}
              </span>
              <span className="text-[10px] font-extrabold uppercase text-[#ff6b00] tracking-wider leading-none mt-0.5">
                SUPER ADMIN
              </span>
            </div>
          </div>
        )}

        {/* Logout button */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="px-3 py-1.5 rounded-full border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/40 hover:bg-red-100 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            title="Sign out of Admin Console"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            <span>Logout</span>
          </button>
        )}
      </div>
    </header>
  );
};
