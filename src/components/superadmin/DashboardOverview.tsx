import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { MaintenanceControlModal } from './MaintenanceControlModal';
import { PlatformMaintenanceConfig, parsePlatformMaintenanceConfig } from '../../shared/types';

export const DashboardOverview: React.FC<{ onNavigate: (tab: any) => void }> = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    totalEvents: 0,
    publishedEvents: 0,
    trendingEvents: 0,
    featuredEvents: 0,
    pendingAccessRequests: 0
  });
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [maintConfig, setMaintConfig] = useState<PlatformMaintenanceConfig | null>(null);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);

  useEffect(() => {
    const fetchDashboardMetrics = async () => {
      try {
        const [
          { count: totalCount },
          { count: pubCount },
          { count: trendCount },
          { count: featCount },
          { count: pendingReqCount },
          { data: recentReqs },
          { data: maintSetting }
        ] = await Promise.all([
          supabase.from('events').select('id', { count: 'exact', head: true }),
          supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'PUBLISHED'),
          supabase.from('trending_events').select('event_id', { count: 'exact', head: true }),
          supabase.from('featured_events').select('event_id', { count: 'exact', head: true }),
          supabase.from('organizer_access_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
          supabase
            .from('organizer_access_requests')
            .select('id, organization_name, created_at, status, admin_users!admin_user_id(email, display_name)')
            .eq('status', 'PENDING')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('global_settings')
            .select('value')
            .eq('key', 'platform_maintenance_mode')
            .maybeSingle()
        ]);

        setStats({
          totalEvents: totalCount || 0,
          publishedEvents: pubCount || 0,
          trendingEvents: trendCount || 0,
          featuredEvents: featCount || 0,
          pendingAccessRequests: pendingReqCount || 0
        });

        if (recentReqs) {
          setPendingRequests(recentReqs);
        }

        if (maintSetting) {
          setMaintConfig(parsePlatformMaintenanceConfig(maintSetting.value));
        }
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      }
    };

    fetchDashboardMetrics();

    const handleMaintUpdate = (e: Event) => {
      const custom = e as CustomEvent<PlatformMaintenanceConfig>;
      if (custom.detail) {
        setMaintConfig(custom.detail);
      } else {
        fetchDashboardMetrics();
      }
    };
    window.addEventListener('lpu:maintenance-updated', handleMaintUpdate);
    return () => {
      window.removeEventListener('lpu:maintenance-updated', handleMaintUpdate);
    };
  }, []);

  const metrics = [
    { 
      title: 'Total Events', 
      count: `${stats.totalEvents}`, 
      change: 'Database Inventory', 
      icon: 'event_note', 
      positive: true,
      onClick: () => onNavigate('manage-events')
    },
    { 
      title: 'Published Events', 
      count: `${stats.publishedEvents}`, 
      change: 'Live on Student Web', 
      icon: 'public',
      onClick: () => onNavigate('manage-events')
    },
    { 
      title: 'Access Requests', 
      count: `${stats.pendingAccessRequests}`, 
      change: 'Requires Super Admin Action', 
      icon: 'verified_user', 
      highlight: stats.pendingAccessRequests > 0,
      onClick: () => onNavigate('access-requests')
    },
    { 
      title: 'Featured Events', 
      count: `${stats.featuredEvents}`, 
      change: 'Spotlight on Homepage', 
      icon: 'star',
      onClick: () => onNavigate('featured-events')
    }
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">Welcome back, Admin.</h2>
          <p className="text-base text-[#5a4136] dark:text-[#ffb693] mt-1">Here is what is happening across the LPU Events ecosystem today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMaintenanceModalOpen(true)}
            className={`px-4 py-2 rounded-full text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ${
              maintConfig?.enabled
                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-white dark:bg-[#261812] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] text-[#261812] dark:text-[#ffede6] border border-[#e2bfb0] dark:border-[#5a4136]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${maintConfig?.enabled ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <span>{maintConfig?.enabled ? 'Maintenance Active' : 'Maintenance Screen'}</span>
          </button>

          <button
            onClick={() => onNavigate('access-requests')}
            className="bg-[#ff6b00] hover:bg-[#a04100] text-white px-5 py-2 rounded-full text-sm font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
            <span>Review Access Requests ({stats.pendingAccessRequests})</span>
          </button>
        </div>
      </div>

      {/* High-Visibility Maintenance Warning Banner (When active) */}
      {maintConfig?.enabled && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-500 text-[28px] animate-pulse">shield_with_heart</span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Platform Maintenance Mode is Currently ACTIVE
                </p>
                <span className="text-[10px] font-extrabold uppercase bg-amber-500 text-white px-2 py-0.5 rounded-full">
                  Live on student web
                </span>
              </div>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5 line-clamp-1">
                Custom announcement: &ldquo;{maintConfig.message}&rdquo;
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMaintenanceModalOpen(true)}
            className="px-4 py-1.5 rounded-full text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            Manage Announcement
          </button>
        </div>
      )}

      {/* Metrics Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m, idx) => (
          <div
            key={idx}
            onClick={m.onClick}
            className="bg-white dark:bg-[#261812] rounded-2xl p-6 border border-[#e2bfb0] dark:border-[#5a4136] shadow-xs flex flex-col justify-between min-h-[148px] hover:border-[#ff6b00] hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <p className="text-sm font-semibold text-[#5a4136] dark:text-[#ffb693] group-hover:text-[#ff6b00] transition-colors">{m.title}</p>
              <div className="w-9 h-9 rounded-xl bg-[#ff6b00]/10 flex items-center justify-center text-[#ff6b00] shrink-0">
                <span className="material-symbols-outlined text-[20px]">{m.icon}</span>
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6] mt-3">{m.count}</h3>
              <p className="text-xs font-semibold text-[#0062a1] dark:text-[#059eff] mt-1 flex items-center gap-1">
                {m.change}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Complex Content Split */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Attention Needed Column */}
        <div className="xl:col-span-2 bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-6 shadow-xs flex flex-col h-[480px]">
          <div className="flex justify-between items-center pb-4 border-b border-[#e2bfb0] dark:border-[#5a4136] mb-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#ff6b00]">warning</span>
              <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                Pending Organizer Access Inquiries
              </h3>
            </div>
            <button onClick={() => onNavigate('access-requests')} className="text-xs font-bold text-[#ff6b00] hover:underline cursor-pointer">
              Review All Requests ({stats.pendingAccessRequests})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {pendingRequests.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#5a4136] dark:text-[#ffb693] gap-2 py-8">
                <span className="material-symbols-outlined text-[48px] text-emerald-500">task_alt</span>
                <p className="text-base font-bold text-[#261812] dark:text-[#ffede6]">All Clear! No Pending Requests</p>
                <p className="text-xs text-[#5a4136] dark:text-[#ffb693]">All organizer access applications have been reviewed.</p>
              </div>
            ) : (
              pendingRequests.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => onNavigate('access-requests')}
                  className="bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] p-4 rounded-xl flex items-center justify-between hover:border-[#ff6b00] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-[#fee3d8] dark:bg-[#3d2d26] flex items-center justify-center text-[#ff6b00] font-bold">
                      <span className="material-symbols-outlined">how_to_reg</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-amber-100 text-amber-800">
                          Pending Approval
                        </span>
                        <h4 className="text-sm font-bold text-[#261812] dark:text-[#ffede6] group-hover:text-[#ff6b00] transition-colors">
                          {item.organization_name}
                        </h4>
                      </div>
                      <p className="text-xs text-[#5a4136] dark:text-[#ffb693] mt-1">
                        Applicant: {item.admin_users?.email} • {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button className="px-3 py-1 bg-[#ff6b00] text-white text-xs font-bold rounded-md shadow-sm group-hover:bg-[#a04100] transition-colors">
                    Review
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Content Status Glassmorphism Card */}
        <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-6 shadow-xs flex flex-col justify-between h-[480px]">
          <div>
            <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6] pb-4 border-b border-[#e2bfb0] dark:border-[#5a4136]">Content Status</h3>
            
            <div className="space-y-4 mt-4">
              {/* Featured Events Metric */}
              <div className="bg-[#fff8f6] dark:bg-[#1a120e] rounded-xl p-4 border border-[#e2bfb0] dark:border-[#5a4136]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-[#5a4136] dark:text-[#ffb693] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">star</span> Featured Events
                  </span>
                  <span className="text-[11px] font-bold bg-white dark:bg-[#261812] px-2 py-0.5 rounded border border-[#e2bfb0] dark:border-[#5a4136]">Max 5</span>
                </div>
                <div className="text-2xl font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                  {stats.featuredEvents} <span className="text-sm font-normal text-[#5a4136] dark:text-[#ffb693]">/ 5 Active</span>
                </div>
                <div className="w-full bg-[#fee3d8] dark:bg-[#3d2d26] h-1.5 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="bg-[#ff6b00] h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, (stats.featuredEvents / 5) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Trending Events Metric */}
              <div 
                onClick={() => onNavigate('trending-events')}
                className="bg-[#fff8f6] dark:bg-[#1a120e] rounded-xl p-4 border border-[#e2bfb0] dark:border-[#5a4136] hover:border-[#ff6b00] transition-colors cursor-pointer group"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-[#5a4136] dark:text-[#ffb693] flex items-center gap-1.5 group-hover:text-[#ff6b00] transition-colors">
                    <span className="material-symbols-outlined text-[16px] text-[#ff6b00]">local_fire_department</span> Trending Events
                  </span>
                  <span className="text-[10px] font-bold bg-[#fee3d8] dark:bg-[#3d2d26] text-[#ff6b00] px-2 py-0.5 rounded">
                    Curated
                  </span>
                </div>
                <div className="text-2xl font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                  {stats.trendingEvents} <span className="text-sm font-normal text-[#5a4136] dark:text-[#ffb693]">Marked</span>
                </div>
              </div>

              {/* Featured Spotlight Metric */}
              <div className="bg-[#fff8f6] dark:bg-[#1a120e] rounded-xl p-4 border border-[#e2bfb0] dark:border-[#5a4136]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-[#5a4136] dark:text-[#ffb693] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">star</span> Featured Spotlight
                  </span>
                </div>
                <div className="text-2xl font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">{stats.featuredEvents} <span className="text-sm font-normal text-[#5a4136] dark:text-[#ffb693]">Pinned</span></div>
                <div className="flex gap-2 mt-3">
                  <span className="bg-white dark:bg-[#261812] text-[11px] px-2 py-1 rounded border border-[#e2bfb0] dark:border-[#5a4136] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Spotlight
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('access-requests')}
            className="w-full flex items-center justify-center gap-2 text-sm font-bold text-[#ff6b00] bg-[#ff6b00]/10 hover:bg-[#ff6b00]/20 py-3 rounded-xl border border-[#ff6b00]/30 transition-colors mt-4 cursor-pointer"
          >
            <span>Manage Access Approvals</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Maintenance Control Modal */}
      <MaintenanceControlModal
        isOpen={maintenanceModalOpen}
        onClose={() => setMaintenanceModalOpen(false)}
        onUpdated={(cfg) => {
          setMaintConfig(cfg);
          window.dispatchEvent(new CustomEvent('lpu:maintenance-updated', { detail: cfg }));
        }}
      />
    </div>
  );
};
