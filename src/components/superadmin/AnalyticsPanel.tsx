import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { 
  Calendar, 
  Building2, 
  Tag, 
  RotateCw, 
  Download, 
  Activity,
  AlertCircle,
  Megaphone
} from 'lucide-react';

interface CategoryBreakdownItem {
  id: string;
  name: string;
  count: number;
  percentage: number;
}

interface ClubLeaderboardItem {
  id: string;
  name: string;
  totalEvents: number;
  activeCount: number;
}

interface PlatformSummaryStats {
  totalEvents: number;
  activeEvents: number;
  pastEvents: number;
  totalClubs: number;
  pendingAccessRequests: number;
}

export const AnalyticsPanel: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Platform Metrics State (authoritative application data only)
  const [summaryStats, setSummaryStats] = useState<PlatformSummaryStats>({
    totalEvents: 0,
    activeEvents: 0,
    pastEvents: 0,
    totalClubs: 0,
    pendingAccessRequests: 0
  });

  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [topClubs, setTopClubs] = useState<ClubLeaderboardItem[]>([]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // 1. Fetch Events Summary (Real application data)
      const { data: allEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, name, status, start_at, end_at, category_id, organization_id');

      if (eventsError) throw eventsError;

      const totalEvents = allEvents?.length || 0;
      const now = new Date();
      const activeEvents = allEvents?.filter(e => e.status === 'PUBLISHED' && new Date(e.end_at) > now).length || 0;
      const pastEvents = allEvents?.filter(e => e.status === 'COMPLETED' || new Date(e.end_at) <= now).length || 0;

      // 2. Fetch Organizations & Access Requests (Real application data)
      const [orgsRes, reqsRes] = await Promise.all([
        supabase.from('organizations').select('id, name, is_active').eq('is_active', true),
        supabase.from('organizer_access_requests').select('id, status').eq('status', 'PENDING')
      ]);

      const totalClubs = orgsRes.data?.length || 0;
      const pendingAccessRequests = reqsRes.data?.length || 0;

      setSummaryStats({
        totalEvents,
        activeEvents,
        pastEvents,
        totalClubs,
        pendingAccessRequests
      });

      // 3. Fetch Categories Breakdown (Real application data)
      const { data: categories } = await supabase.from('categories').select('id, name');
      if (categories && allEvents) {
        const categoryCounts: CategoryBreakdownItem[] = categories.map(cat => {
          const count = allEvents.filter(e => e.category_id === cat.id).length;
          return {
            id: cat.id,
            name: cat.name,
            count,
            percentage: totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0
          };
        }).sort((a, b) => b.count - a.count);

        setCategoryBreakdown(categoryCounts.filter(c => c.count > 0));
      }

      // 4. Fetch Top Clubs Leaderboard (Real application data)
      if (orgsRes.data && allEvents) {
        const clubLeaderboard: ClubLeaderboardItem[] = orgsRes.data.map(org => {
          const clubEvents = allEvents.filter(e => e.organization_id === org.id);
          const activeCount = clubEvents.filter(e => e.status === 'PUBLISHED' && new Date(e.end_at) > now).length;
          return {
            id: org.id,
            name: org.name,
            totalEvents: clubEvents.length,
            activeCount
          };
        }).sort((a, b) => b.totalEvents - a.totalEvents);

        setTopClubs(clubLeaderboard);
      }

      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch platform metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const handleExportCsv = () => {
    if (categoryBreakdown.length === 0 && topClubs.length === 0) {
      alert('No platform data available to export.');
      return;
    }
    const headers = ['Type', 'Name', 'Total Events', 'Active Events', 'Share (%)'];
    const catRows = categoryBreakdown.map(c => [
      'Category',
      `"${c.name.replace(/"/g, '""')}"`,
      c.count,
      '-',
      `${c.percentage}%`
    ]);
    const clubRows = topClubs.map(c => [
      'Club',
      `"${c.name.replace(/"/g, '""')}"`,
      c.totalEvents,
      c.activeCount,
      '-'
    ]);
    const csvContent = [headers.join(','), ...catRows.map(r => r.join(',')), ...clubRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lpu_platform_summary_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 select-text animate-fadeIn">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-orange-100 text-[#ff6b00] dark:bg-orange-950 dark:text-orange-300">
              PLATFORM METRICS
            </span>
            <span className="text-xs text-[#5a4136] dark:text-[#ffb693]">
              Last updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <h2 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2.5">
            <Activity size={28} className="text-[#ff6b00]" />
            <span>Platform Analytics & Overview</span>
          </h2>
          <p className="text-sm text-[#5a4136] dark:text-[#ffb693] mt-1">
            Aggregated application data on campus event catalog volume, active student clubs, and category distributions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh button */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00] hover:border-[#ff6b00] transition-colors cursor-pointer bg-white dark:bg-[#261812] shadow-xs"
            title="Refresh Data"
          >
            <RotateCw size={16} className={refreshing ? 'animate-spin text-[#ff6b00]' : ''} />
          </button>

          {/* Export button */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-bold text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00] hover:border-[#ff6b00] transition-colors cursor-pointer bg-white dark:bg-[#261812] shadow-xs flex items-center gap-1.5"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {loading && !refreshing ? (
        <div className="py-24 text-center text-[#5a4136] dark:text-[#ffb693] flex flex-col items-center justify-center gap-3">
          <div className="w-9 h-9 border-3 border-[#ff6b00] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold">Aggregating platform catalog metrics...</p>
        </div>
      ) : (
        <>
          {/* KPI Bento Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Total Events */}
            <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-5 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/60 flex items-center justify-center text-[#ff6b00]">
                  <Calendar size={20} />
                </div>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {summaryStats.activeEvents} Active
                </span>
              </div>
              <p className="text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mt-4">
                Total Platform Events
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                  {summaryStats.totalEvents}
                </h3>
                <span className="text-xs text-[#5a4136] dark:text-[#ffb693] font-semibold">
                  ({summaryStats.pastEvents} Completed)
                </span>
              </div>
            </div>

            {/* Card 2: Approved Organizations */}
            <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-5 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
                  <Building2 size={20} />
                </div>
                {summaryStats.pendingAccessRequests > 0 && (
                  <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {summaryStats.pendingAccessRequests} Pending
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mt-4">
                Active Student Clubs
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                  {summaryStats.totalClubs}
                </h3>
                <span className="text-xs text-[#5a4136] dark:text-[#ffb693] font-semibold">
                  Verified Orgs
                </span>
              </div>
            </div>

            {/* Card 3: Categories Count */}
            <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-5 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-300">
                  <Tag size={20} />
                </div>
                <span className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693]">
                  Catalog Taxonomies
                </span>
              </div>
              <p className="text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mt-4">
                Active Categories
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                  {categoryBreakdown.length}
                </h3>
                <span className="text-xs text-[#5a4136] dark:text-[#ffb693] font-semibold">
                  Domains
                </span>
              </div>
            </div>

            {/* Card 4: Advertisement Analytics (Explicitly Not Monitored) */}
            <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-5 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                  <Megaphone size={20} />
                </div>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 uppercase">
                  Not Monitored
                </span>
              </div>
              <p className="text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mt-4">
                Ad Impressions & Clicks
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-xl font-bold font-['Outfit'] text-zinc-500 dark:text-zinc-400">
                  Not Monitored
                </h3>
              </div>
              <span className="text-[11px] text-[#5a4136] dark:text-[#ffb693] font-medium block mt-1">
                Ad telemetry is not instrumented in this phase.
              </span>
            </div>
          </div>

          {/* Advertisement Telemetry Status Notice (Truthful State) */}
          <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/60 flex items-center justify-center text-[#ff6b00]">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                  Advertisement Engagement Telemetry
                </h3>
                <p className="text-xs text-[#5a4136] dark:text-[#ffb693]">
                  Instrumentation Status
                </p>
              </div>
            </div>
            <div className="p-5 rounded-xl bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0]/60 dark:border-[#5a4136]/60 text-center">
              <p className="text-sm font-bold text-[#261812] dark:text-[#ffede6]">
                Ad Impression, Click, and CTR Telemetry Not Currently Monitored
              </p>
              <p className="text-xs text-[#5a4136] dark:text-[#ffb693] mt-1 max-w-xl mx-auto">
                Promotional campaign impression tracking and click conversions are not currently instrumented. In accordance with platform telemetry truthfulness rules, placeholder counts and zero-valued analytics charts are not displayed.
              </p>
            </div>
          </div>

          {/* Two Column Section: Category Distribution & Top Clubs (Real DB Data) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-6 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="text-base font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2">
                    <Tag size={18} className="text-[#ff6b00]" />
                    <span>Event Distribution by Category</span>
                  </h3>
                  <p className="text-xs text-[#5a4136] dark:text-[#ffb693]">
                    Share of events published per academic and cultural domain
                  </p>
                </div>
                <span className="text-xs font-bold text-[#ff6b00] bg-[#fee3d8] dark:bg-[#3d2d26] px-2.5 py-1 rounded-full">
                  {categoryBreakdown.length} Categories
                </span>
              </div>

              <div className="space-y-4 flex-1">
                {categoryBreakdown.length === 0 ? (
                  <p className="text-xs text-[#5a4136] dark:text-[#ffb693] text-center py-8">
                    No categorical event records available.
                  </p>
                ) : (
                  categoryBreakdown.map(cat => (
                    <div key={cat.id} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-[#261812] dark:text-[#ffede6]">{cat.name}</span>
                        <span className="text-[#5a4136] dark:text-[#ffb693]">
                          {cat.count} Events ({cat.percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-[#fff8f6] dark:bg-[#1a120e] rounded-full overflow-hidden border border-[#e2bfb0]/60 dark:border-[#5a4136]/60">
                        <div
                          className="h-full bg-gradient-to-r from-[#ff6b00] to-[#ff9248] rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(5, cat.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Top Active Clubs & Organizers */}
            <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-6 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="text-base font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2">
                    <Building2 size={18} className="text-[#ff6b00]" />
                    <span>Club Organizing Leaderboard</span>
                  </h3>
                  <p className="text-xs text-[#5a4136] dark:text-[#ffb693]">
                    Top student clubs by event volume and live campus activity
                  </p>
                </div>
              </div>

              <div className="divide-y divide-[#e2bfb0]/60 dark:divide-[#5a4136]/60 flex-1">
                {topClubs.length === 0 ? (
                  <p className="text-xs text-[#5a4136] dark:text-[#ffb693] text-center py-8">
                    No active clubs registered.
                  </p>
                ) : (
                  topClubs.slice(0, 5).map((club, idx) => (
                    <div key={club.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-[#fee3d8] dark:bg-[#3d2d26] font-bold font-mono text-[11px] text-[#ff6b00] flex items-center justify-center flex-shrink-0">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-[#261812] dark:text-[#ffede6] truncate">
                            {club.name}
                          </h4>
                          <p className="text-[10px] text-[#5a4136] dark:text-[#ffb693]">
                            {club.activeCount} active event{club.activeCount !== 1 ? 's' : ''} now
                          </p>
                        </div>
                      </div>

                      <span className="text-xs font-extrabold text-[#261812] dark:text-[#ffede6] px-2.5 py-1 rounded-lg bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] flex-shrink-0">
                        {club.totalEvents} Total Events
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
