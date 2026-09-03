import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { 
  TrendingUp, 
  Eye, 
  MousePointerClick, 
  Calendar, 
  Building2, 
  Tag, 
  RotateCw, 
  Download, 
  Activity,
  Layers
} from 'lucide-react';

export const AnalyticsPanel: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | '90D' | 'ALL'>('30D');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Metrics State
  const [summaryStats, setSummaryStats] = useState({
    totalEvents: 0,
    activeEvents: 0,
    pastEvents: 0,
    totalClubs: 0,
    totalImpressions: 0,
    totalClicks: 0,
    averageCtr: 0,
    pendingAccessRequests: 0
  });

  const [dailyTraffic, setDailyTraffic] = useState<any[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
  const [topClubs, setTopClubs] = useState<any[]>([]);
  const [topAds, setTopAds] = useState<any[]>([]);
  const [hoveredDataPoint, setHoveredDataPoint] = useState<any | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // 1. Fetch Events Summary
      const { data: allEvents } = await supabase
        .from('events')
        .select('id, name, status, start_at, end_at, category_id, organization_id');

      const totalEvents = allEvents?.length || 0;
      const activeEvents = allEvents?.filter(e => e.status === 'PUBLISHED' && new Date(e.end_at) > new Date()).length || 0;
      const pastEvents = allEvents?.filter(e => e.status === 'COMPLETED' || new Date(e.end_at) <= new Date()).length || 0;

      // 2. Fetch Organizations & Access Requests
      const [orgsRes, reqsRes] = await Promise.all([
        supabase.from('organizations').select('id, name, is_active').eq('is_active', true),
        supabase.from('organizer_access_requests').select('id, status').eq('status', 'PENDING')
      ]);

      const totalClubs = orgsRes.data?.length || 0;
      const pendingAccessRequests = reqsRes.data?.length || 0;

      // 3. Advertisement Metrics (PostgreSQL ad metrics deprecated in favor of PostHog/GA4)
      const adMetrics: any[] = [];

      let filteredMetrics = adMetrics || [];
      const now = new Date();
      if (timeRange === '7D') {
        const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredMetrics = filteredMetrics.filter(m => new Date(m.metric_date) >= cutoff);
      } else if (timeRange === '30D') {
        const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredMetrics = filteredMetrics.filter(m => new Date(m.metric_date) >= cutoff);
      } else if (timeRange === '90D') {
        const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        filteredMetrics = filteredMetrics.filter(m => new Date(m.metric_date) >= cutoff);
      }

      // Group daily traffic
      const dateMap = new Map<string, { date: string; impressions: number; clicks: number }>();
      filteredMetrics.forEach(m => {
        const existing = dateMap.get(m.metric_date) || { date: m.metric_date, impressions: 0, clicks: 0 };
        existing.impressions += Number(m.impressions || 0);
        existing.clicks += Number(m.clicks || 0);
        dateMap.set(m.metric_date, existing);
      });

      const trafficArr = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      setDailyTraffic(trafficArr);

      const totalImpressions = trafficArr.reduce((sum, item) => sum + item.impressions, 0);
      const totalClicks = trafficArr.reduce((sum, item) => sum + item.clicks, 0);
      const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      setSummaryStats({
        totalEvents,
        activeEvents,
        pastEvents,
        totalClubs,
        totalImpressions,
        totalClicks,
        averageCtr,
        pendingAccessRequests
      });

      // 4. Fetch Categories Breakdown
      const { data: categories } = await supabase.from('categories').select('id, name');
      if (categories && allEvents) {
        const categoryCounts = categories.map(cat => {
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

      // 5. Fetch Top Clubs Leaderboard
      if (orgsRes.data && allEvents) {
        const clubLeaderboard = orgsRes.data.map(org => {
          const clubEvents = allEvents.filter(e => e.organization_id === org.id);
          const activeCount = clubEvents.filter(e => e.status === 'PUBLISHED' && new Date(e.end_at) > new Date()).length;
          return {
            id: org.id,
            name: org.name,
            totalEvents: clubEvents.length,
            activeCount
          };
        }).sort((a, b) => b.totalEvents - a.totalEvents);

        setTopClubs(clubLeaderboard);
      }

      // 6. Fetch Top Performing Ads
      const { data: adsData } = await supabase
        .from('advertisements')
        .select('id, name, status, redirect_url');

      if (adsData) {
        const formattedAds = adsData.map(ad => {
          const metrics: any[] = [];
          const adImpr = metrics.reduce((s: number, m: any) => s + Number(m.impressions || 0), 0);
          const adClicks = metrics.reduce((s: number, m: any) => s + Number(m.clicks || 0), 0);
          const adCtr = adImpr > 0 ? (adClicks / adImpr) * 100 : 0;
          return {
            id: ad.id,
            name: ad.name,
            status: ad.status,
            impressions: adImpr,
            clicks: adClicks,
            ctr: adCtr
          };
        }).sort((a, b) => b.clicks - a.clicks);

        setTopAds(formattedAds);
      }

      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const handleExportCsv = () => {
    if (dailyTraffic.length === 0) {
      alert('No telemetry data to export.');
      return;
    }
    const headers = ['Date', 'Impressions', 'Clicks', 'CTR (%)'];
    const rows = dailyTraffic.map(t => [
      t.date,
      t.impressions,
      t.clicks,
      t.impressions > 0 ? ((t.clicks / t.impressions) * 100).toFixed(2) : '0'
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lpu_platform_analytics_${timeRange.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxDailyImpressions = Math.max(...dailyTraffic.map(d => d.impressions), 100);

  return (
    <div className="space-y-8 select-text animate-fadeIn">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-orange-100 text-[#ff6b00] dark:bg-orange-950 dark:text-orange-300">
              Live Telemetry
            </span>
            <span className="text-xs text-[#5a4136] dark:text-[#ffb693]">
              Last updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <h2 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2.5">
            <Activity size={28} className="text-[#ff6b00]" />
            <span>Platform Analytics & Telemetry</span>
          </h2>
          <p className="text-sm text-[#5a4136] dark:text-[#ffb693] mt-1">
            Real-time insights on campus events discovery, student reach, ad conversions, and club participation.
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

          {/* Time Range Selector */}
          <div className="flex items-center bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-xl p-1 shadow-xs text-xs font-bold">
            {(['7D', '30D', '90D', 'ALL'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setTimeRange(tab)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  timeRange === tab
                    ? 'bg-[#ff6b00] text-white shadow-xs'
                    : 'text-[#5a4136] dark:text-[#ffb693] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && !refreshing ? (
        <div className="py-24 text-center text-[#5a4136] dark:text-[#ffb693] flex flex-col items-center justify-center gap-3">
          <div className="w-9 h-9 border-3 border-[#ff6b00] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold">Aggregating platform telemetry and metrics...</p>
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

        {/* Card 2: Ad Impressions */}
        <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-300">
              <Eye size={20} />
            </div>
            <span className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693]">
              {timeRange} Span
            </span>
          </div>
          <p className="text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mt-4">
            Total Ad Impressions
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
              {summaryStats.totalImpressions.toLocaleString()}
            </h3>
          </div>
        </div>

        {/* Card 3: Ad Clicks & CTR */}
        <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-300">
              <MousePointerClick size={20} />
            </div>
            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              {summaryStats.averageCtr.toFixed(2)}% CTR
            </span>
          </div>
          <p className="text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mt-4">
            Ad Click Engagements
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
              {summaryStats.totalClicks.toLocaleString()}
            </h3>
            <span className="text-xs text-[#5a4136] dark:text-[#ffb693] font-semibold">
              Clicks
            </span>
          </div>
        </div>

        {/* Card 4: Approved Organizations */}
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
      </div>

      {/* Daily Ad Traffic & Clicks Visual Chart */}
      <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2">
              <TrendingUp size={20} className="text-[#ff6b00]" />
              <span>Daily Advertisement Telemetry Trend</span>
            </h3>
            <p className="text-xs text-[#5a4136] dark:text-[#ffb693]">
              Daily student impression reach vs promotional clicks across the portal
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-[#fee3d8] dark:bg-[#4d3830] border border-[#ff6b00]/30" />
              <span className="text-[#5a4136] dark:text-[#ffb693]">Impressions</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-[#ff6b00]" />
              <span className="text-[#261812] dark:text-[#ffede6]">Clicks</span>
            </div>
          </div>
        </div>

        {dailyTraffic.length === 0 ? (
          <div className="py-16 text-center text-[#5a4136] dark:text-[#ffb693]">
            <Activity size={32} className="mx-auto text-[#ff6b00] opacity-40 mb-2" />
            <p className="text-xs font-semibold">No daily traffic records recorded for this time interval.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* SVG / Bar Visualizer */}
            <div className="h-56 w-full flex items-end gap-2 pt-6 pb-2 border-b border-[#e2bfb0] dark:border-[#5a4136] relative">
              {dailyTraffic.map((item) => {
                const heightPercent = Math.min(100, Math.max(12, (item.impressions / maxDailyImpressions) * 100));
                const clicksHeightPercent = Math.min(100, Math.max(8, (item.clicks / (item.impressions || 1)) * 100 * 8));

                return (
                  <div
                    key={item.date}
                    className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                    onMouseEnter={() => setHoveredDataPoint(item)}
                    onMouseLeave={() => setHoveredDataPoint(null)}
                  >
                    {/* Hover Tooltip */}
                    {hoveredDataPoint?.date === item.date && (
                      <div className="absolute -top-14 z-20 bg-[#261812] text-white p-2 rounded-xl shadow-xl border border-[#ff6b00]/50 text-[10px] whitespace-nowrap pointer-events-none animate-fadeIn">
                        <div className="font-bold text-[#ff6b00]">{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                        <div>👁️ {item.impressions.toLocaleString()} views</div>
                        <div>🖱️ {item.clicks} clicks ({item.impressions > 0 ? ((item.clicks / item.impressions) * 100).toFixed(1) : 0}% CTR)</div>
                      </div>
                    )}

                    {/* Bar Stack */}
                    <div 
                      className="w-full max-w-[36px] bg-[#fee3d8] dark:bg-[#3d2d26] rounded-t-lg transition-all group-hover:bg-[#fbd6c6] dark:group-hover:bg-[#4d3830] flex flex-col justify-end overflow-hidden relative"
                      style={{ height: `${heightPercent}%` }}
                    >
                      <div 
                        className="w-full bg-[#ff6b00] rounded-t-md transition-all group-hover:brightness-110"
                        style={{ height: `${clicksHeightPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-axis date labels */}
            <div className="flex justify-between text-[10px] font-bold text-[#5a4136] dark:text-[#ffb693] px-1">
              {dailyTraffic.filter((_, i) => i % Math.ceil(dailyTraffic.length / 7) === 0 || i === dailyTraffic.length - 1).map(d => (
                <span key={d.date}>
                  {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Two Column Section: Category Distribution & Top Clubs */}
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

      {/* Top Performing Advertisements Table */}
      <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6] mb-1 flex items-center gap-2">
          <Layers size={18} className="text-[#ff6b00]" />
          <span>Advertisement Campaign Performance Breakdown</span>
        </h3>
        <p className="text-xs text-[#5a4136] dark:text-[#ffb693] mb-4">
          Detailed metrics per active and scheduled campaign
        </p>

        {topAds.length === 0 ? (
          <p className="text-xs text-[#5a4136] dark:text-[#ffb693] text-center py-8">
            No advertisement metrics recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#e2bfb0] dark:border-[#5a4136] text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693] uppercase">
                  <th className="py-2.5 px-4">Campaign Name</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Impressions</th>
                  <th className="py-2.5 px-4 text-right">Clicks</th>
                  <th className="py-2.5 px-4 text-right">Conversion (CTR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2bfb0]/50 dark:divide-[#5a4136]/50">
                {topAds.map(ad => (
                  <tr key={ad.id} className="hover:bg-[#fff8f6] dark:hover:bg-[#3d2d26]/30">
                    <td className="py-3 px-4 font-bold text-[#261812] dark:text-[#ffede6]">
                      {ad.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        ad.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}>
                        {ad.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-[#261812] dark:text-[#ffede6]">
                      {ad.impressions.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-[#ff6b00]">
                      {ad.clicks.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                      {ad.ctr.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )}
</div>
);
};
