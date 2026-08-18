import React from 'react';

interface HeaderProps {
  activeTab: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onCreateClick: () => void;
}

export const AdminHeader: React.FC<HeaderProps> = ({ activeTab, darkMode, onToggleDarkMode, onCreateClick }) => {
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

  return (
    <header className="sticky top-0 z-40 flex justify-between items-center w-full px-6 md:px-8 h-20 bg-[#fff8f6]/90 dark:bg-[#1a120e]/90 backdrop-blur-md border-b border-[#e2bfb0] dark:border-[#5a4136] shadow-sm">
      {/* Breadcrumb Context */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-[#5a4136] dark:text-[#ffb693] hidden md:inline">Admin</span>
        <span className="text-sm text-[#8e7164] hidden md:inline material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">{getTitle()}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={onCreateClick}
          className="bg-[#ff6b00] hover:bg-[#a04100] text-white px-5 py-2 rounded-full text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Create Event</span>
        </button>

        <div className="flex items-center gap-1">
          <button className="w-10 h-10 rounded-full hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] flex items-center justify-center text-[#5a4136] dark:text-[#ffb693] transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button 
            onClick={onToggleDarkMode} 
            className="w-10 h-10 rounded-full hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] flex items-center justify-center text-[#5a4136] dark:text-[#ffb693] transition-colors"
          >
            <span className="material-symbols-outlined">{darkMode ? 'light_mode' : 'dark_mode'}</span>
          </button>
        </div>

        {/* Profile Avatar */}
        <div className="w-10 h-10 rounded-full bg-[#fee3d8] border border-[#e2bfb0] overflow-hidden cursor-pointer shadow-sm">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
            alt="Super Admin"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </header>
  );
};
