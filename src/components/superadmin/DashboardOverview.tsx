import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';

export const DashboardOverview: React.FC<{ onNavigate: (tab: any) => void }> = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    totalEvents: 0,
    publishedEvents: 0,
    pendingAccessRequests: 0,
    activeAds: 0
  });
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardMetrics = async () => {
      try {
        const [
          { count: totalCount },
          { count: pubCount },
          { count: pendingReqCount },
          { count: adCount },
          { data: recentReqs }
        ] = await Promise.all([
          supabase.from('events').select('*', { count: 'exact', head: true }),
          supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'PUBLISHED'),
          supabase.from('organizer_access_requests').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
          supabase.from('advertisements').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase
            .from('organizer_access_requests')
            .select('*, admin_users!admin_user_id(email, display_name)')
            .eq('status', 'PENDING')
            .order('created_at', { ascending: false })
            .limit(5)
        ]);

        setStats({
          totalEvents: totalCount || 0,
          publishedEvents: pubCount || 0,
          pendingAccessRequests: pendingReqCount || 0,
          activeAds: adCount || 0
        });

        if (recentReqs) {
          setPendingRequests(recentReqs);
        }
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      }
    };

    fetchDashboardMetrics();
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
      title: 'Active Campaigns', 
      count: `${stats.activeAds}`, 
      change: 'Currently Serving Ads', 
      icon: 'ads_click',
      onClick: () => onNavigate('advertisements')
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
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('access-requests')}
            className="bg-[#ff6b00] hover:bg-[#a04100] text-white px-5 py-2 rounded-full text-sm font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
            <span>Review Access Requests ({stats.pendingAccessRequests})</span>
          </button>
          <button
            onClick={() => onNavigate('ad-control')}
            className="border border-[#e2bfb0] bg-white dark:bg-[#261812] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] text-[#261812] dark:text-[#ffede6] px-5 py-2 rounded-full text-sm font-semibold shadow-sm transition-all"
          >
            Manage Ads Control
          </button>
        </div>
      </div>

      {/* Metrics Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m, idx) => (
          <div
            key={idx}
            onClick={m.onClick}
            className={`bg-white dark:bg-[#261812] rounded-xl p-6 border ${
              m.highlight ? 'border-[#ff6b00] relative ring-2 ring-[#ff6b00]/20' : 'border-[#e2bfb0] dark:border-[#5a4136]'
            } shadow-sm flex flex-col justify-between min-h-[140px] hover:border-[#ff6b00] transition-all cursor-pointer group`}
          >
            {m.highlight && <div className="absolute top-0 right-0 w-2 h-full bg-[#ff6b00]" />}
            <div className="flex justify-between items-start">
              <p className="text-sm font-medium text-[#5a4136] dark:text-[#ffb693] group-hover:text-[#ff6b00] transition-colors">{m.title}</p>
              <span className="material-symbols-outlined text-[#ff6b00] bg-[#ff6b00]/10 p-2 rounded-lg text-[20px]">
                {m.icon}
              </span>
            </div>
            <div>
              <h3 className="text-3xl font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6] mt-3">{m.count}</h3>
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
        <div className="xl:col-span-2 bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-xl p-6 shadow-sm flex flex-col h-[480px]">
          <div className="flex justify-between items-center pb-3 border-b border-[#e2bfb0] dark:border-[#5a4136] mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#ff6b00]">warning</span>
              <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                Pending Organizer Access Inquiries
              </h3>
            </div>
            <button onClick={() => onNavigate('access-requests')} className="text-xs font-bold text-[#ff6b00] hover:underline">
              Review All Requests ({stats.pendingAccessRequests})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {pendingRequests.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#5a4136] dark:text-[#ffb693] gap-2">
                <span className="material-symbols-outlined text-[42px] text-emerald-500">task_alt</span>
                <p className="text-sm font-bold text-[#261812] dark:text-[#ffede6]">All Clear! No Pending Requests</p>
                <p className="text-xs">All organizer access applications have been reviewed.</p>
              </div>
            ) : (
              pendingRequests.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => onNavigate('access-requests')}
                  className="bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] p-4 rounded-lg flex items-center justify-between hover:border-[#ff6b00] transition-colors cursor-pointer group"
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
        <div className="bg-white/80 dark:bg-[#261812]/80 backdrop-blur-xl border border-[#e2bfb0] dark:border-[#5a4136] rounded-xl p-6 shadow-sm flex flex-col justify-between h-[480px]">
          <div>
            <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6] pb-3 border-b border-[#e2bfb0] dark:border-[#5a4136]">Content Status</h3>
            
            <div className="space-y-4 mt-4">
              {/* Featured Events Metric */}
              <div className="bg-[#fff8f6] dark:bg-[#1a120e] rounded-xl p-4 border border-[#e2bfb0] dark:border-[#5a4136]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-[#5a4136] dark:text-[#ffb693] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">star</span> Featured Events
                  </span>
                  <span className="text-[11px] font-bold bg-white dark:bg-[#261812] px-2 py-0.5 rounded border border-[#e2bfb0] dark:border-[#5a4136]">Max 5</span>
                </div>
                <div className="text-2xl font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">3 <span className="text-sm font-normal text-[#5a4136] dark:text-[#ffb693]">/ 5 Active</span></div>
                <div className="w-full bg-[#fee3d8] dark:bg-[#3d2d26] h-1.5 rounded-full mt-3 overflow-hidden">
                  <div className="bg-[#ff6b00] h-full rounded-full w-[60%]" />
                </div>
              </div>

              {/* Active Ads Metric */}
              <div className="bg-[#fff8f6] dark:bg-[#1a120e] rounded-xl p-4 border border-[#e2bfb0] dark:border-[#5a4136]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-[#5a4136] dark:text-[#ffb693] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">ads_click</span> Active Ads
                  </span>
                </div>
                <div className="text-2xl font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">{stats.activeAds} <span className="text-sm font-normal text-[#5a4136] dark:text-[#ffb693]">Running</span></div>
                <div className="flex gap-2 mt-3">
                  <span className="bg-white dark:bg-[#261812] text-[11px] px-2 py-1 rounded border border-[#e2bfb0] dark:border-[#5a4136] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('access-requests')}
            className="w-full flex items-center justify-center gap-2 text-sm font-bold text-[#ff6b00] bg-[#ff6b00]/10 hover:bg-[#ff6b00]/20 py-3 rounded-lg border border-[#ff6b00]/30 transition-colors"
          >
            Manage Access Approvals <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
