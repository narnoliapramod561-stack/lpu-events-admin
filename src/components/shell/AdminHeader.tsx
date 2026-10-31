import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { MaintenanceControlModal } from '../superadmin/MaintenanceControlModal';
import { PlatformMaintenanceConfig, parsePlatformMaintenanceConfig } from '../../shared/types';

interface HeaderProps {
  activeTab: string;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  onCreateClick?: () => void;
  userEmail?: string;
  displayName?: string;
  onLogout?: () => void;
  onToggleMobileMenu?: () => void;
}

export const AdminHeader: React.FC<HeaderProps> = ({
  activeTab,
  darkMode,
  onToggleDarkMode,
  userEmail,
  displayName,
  onLogout,
  onToggleMobileMenu,
}) => {
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [maintenanceConfig, setMaintenanceConfig] = useState<PlatformMaintenanceConfig | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Fetch current maintenance status and subscribe to changes
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const { data } = await supabase
          .from('global_settings')
          .select('value')
          .eq('key', 'platform_maintenance_mode')
          .maybeSingle();

        if (isMounted && data) {
          setMaintenanceConfig(parsePlatformMaintenanceConfig(data.value));
        }
      } catch (e) {
        console.error('Failed to fetch maintenance status in header:', e);
      }
    };

    fetchStatus();

    const handleCustomUpdate = (e: Event) => {
      const custom = e as CustomEvent<PlatformMaintenanceConfig>;
      if (custom.detail) {
        setMaintenanceConfig(custom.detail);
      } else {
        fetchStatus();
      }
    };

    window.addEventListener('lpu:maintenance-updated', handleCustomUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('lpu:maintenance-updated', handleCustomUpdate);
    };
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

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
      case 'memories':
      case 'carousel': return 'Past Events Carousel & Memories';
      case 'categories': return 'Categories & Platform Taxonomy';
      case 'student-inquiries':
      case 'messages': return 'Message Center & Inquiries';
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
    <header className="sticky top-0 z-40 flex justify-between items-center w-full px-4 sm:px-6 md:px-8 h-20 bg-[#fff8f6]/90 dark:bg-[#1c1c1e]/90 backdrop-blur-md border-b border-[#e2bfb0] dark:border-white/10 shadow-sm">
      {/* Breadcrumb Context & Mobile Hamburger */}
      <div className="flex items-center gap-2">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 -ml-1 rounded-lg text-[#5a4136] dark:text-[#aeaeb2] hover:bg-[#fee3d8] dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Open Navigation Menu"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
        )}
        <span className="text-sm text-[#5a4136] dark:text-[#aeaeb2] hidden md:inline">Admin</span>
        <span className="text-sm text-[#8e7164] dark:text-[#8e8e93] hidden md:inline material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-white">{getTitle()}</span>
      </div>

      {/* Top Right: Mode Switcher + Account Chip with Logout Dropdown */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Platform Maintenance Mode Super Admin Trigger */}
        <button
          type="button"
          onClick={() => setMaintenanceModalOpen(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer border ${
            maintenanceConfig?.enabled
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 animate-pulse'
              : 'hidden sm:flex bg-white/70 dark:bg-white/[0.04] border-[#e2bfb0] dark:border-white/10 text-[#5a4136] dark:text-[#aeaeb2] hover:text-[#261812] dark:hover:text-white hover:border-[#ff6b00]'
          }`}
          title={
            maintenanceConfig?.enabled
              ? 'Platform Maintenance Mode is currently ACTIVE on Student Website. Click to edit announcement or disable.'
              : 'Platform Maintenance Mode: Live. Click to configure custom maintenance notice or schedule downtime.'
          }
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              maintenanceConfig?.enabled ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />
          <span className="whitespace-nowrap">
            {maintenanceConfig?.enabled ? 'Maintenance Active' : 'System: Live'}
          </span>
        </button>

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
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#fee3d8]/80 dark:bg-white/[0.04] border border-[#e2bfb0] dark:border-white/10 shadow-xs hover:bg-[#fee3d8] dark:hover:bg-white/10 transition-colors cursor-pointer text-left focus:outline-none"
              title="Account Options"
            >
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
              <span className={`material-symbols-outlined text-[18px] text-[#5a4136] dark:text-[#aeaeb2] transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-[#202023] border border-[#e2bfb0] dark:border-white/10 shadow-xl py-2 z-50">
                <div className="px-4 py-2.5 border-b border-[#e2bfb0]/40 dark:border-white/10">
                  <p className="text-xs font-bold text-[#261812] dark:text-white truncate">{displayName || 'Super Admin'}</p>
                  <p className="text-[11px] text-[#5a4136] dark:text-[#aeaeb2] truncate mt-0.5" title={userEmail}>{userEmail}</p>
                  <span className="inline-block mt-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/40 text-[#ff6b00] dark:text-orange-400 uppercase tracking-wider">
                    Super Admin
                  </span>
                </div>
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-[#ba1a1a] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors text-left cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Super Admin Maintenance Control Modal */}
      <MaintenanceControlModal
        isOpen={maintenanceModalOpen}
        onClose={() => setMaintenanceModalOpen(false)}
        onUpdated={(cfg) => {
          setMaintenanceConfig(cfg);
          window.dispatchEvent(new CustomEvent('lpu:maintenance-updated', { detail: cfg }));
        }}
      />
    </header>
  );
};

