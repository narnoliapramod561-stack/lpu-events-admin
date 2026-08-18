import React, { useState, useEffect, useMemo } from 'react';
import { supabase, lpuClient } from '../../supabase';
import { getEventImage } from '../../utils/images';

interface ManageEventsPanelProps {
  mode?: 'active' | 'past' | 'all';
  onCreateClick: () => void;
  onEditClick?: (eventId: string) => void;
}

export const ManageEventsPanel: React.FC<ManageEventsPanelProps> = ({
  mode = 'active',
  onCreateClick,
  onEditClick
}) => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [pricingFilter, setPricingFilter] = useState<'ALL' | 'FREE' | 'PAID'>('ALL');
  const [categories, setCategories] = useState<any[]>([]);
  // Default to rich visual 'grid' view with banner images
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [previewEvent, setPreviewEvent] = useState<any | null>(null);
  const [cancellingEvent, setCancellingEvent] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isPastMode = mode === 'past';

  const fetchEventsAndTaxonomy = async () => {
    setLoading(true);
    try {
      const [eventsRes, catsRes] = await Promise.all([
        supabase
          .from('events')
          .select('*, organizations(id, name), categories(id, name), event_content_sections(*)')
          .order('start_at', { ascending: isPastMode ? false : true }),
        supabase.from('categories').select('id, name, key').eq('is_active', true)
      ]);

      if (eventsRes.error) throw eventsRes.error;
      setEvents(eventsRes.data || []);
      if (catsRes.data) setCategories(catsRes.data);
    } catch (err: any) {
      console.error('Failed to load events in ManageEventsPanel:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEventsAndTaxonomy();
  }, [mode]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEventsAndTaxonomy();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCancelEvent = async () => {
    if (!cancellingEvent) return;
    setCancelLoading(true);
    try {
      const { error } = await lpuClient.cancelEvent(cancellingEvent.id, cancelReason.trim() || 'Cancelled by Admin');
      if (error) throw error;
      showToast(`Event "${cancellingEvent.name}" has been cancelled.`);
      setCancellingEvent(null);
      setCancelReason('');
      await fetchEventsAndTaxonomy();
    } catch (err: any) {
      console.error('Failed to cancel event:', err);
      alert('Failed to cancel event: ' + (err.message || 'Unknown error'));
    } finally {
      setCancelLoading(false);
    }
  };

  const copyEventLink = (id: string) => {
    const url = `${window.location.origin.replace('5174', '5173')}/events/${id}`;
    navigator.clipboard.writeText(url);
    showToast('Student link copied to clipboard!');
  };

  // Strictly filter active vs past
  const filteredEvents = useMemo(() => {
    const curTime = new Date().getTime();

    return events.filter((evt) => {
      const endTimestamp = new Date(evt.end_at).getTime();
      const isCancelledOrDeleted = evt.status === 'CANCELLED' || evt.status === 'DELETED' || Boolean(evt.deleted_at);
      const isEventActive = !isCancelledOrDeleted && endTimestamp >= curTime && evt.status === 'PUBLISHED';
      const isEventPast = !isCancelledOrDeleted && (evt.status === 'COMPLETED' || (evt.status === 'PUBLISHED' && endTimestamp < curTime));

      // Strict active mode
      if (mode === 'active' && !isEventActive) return false;
      // Strict past mode
      if (mode === 'past' && !isEventPast) return false;

      // Category filter
      if (categoryFilter !== 'ALL' && evt.category_id !== categoryFilter) return false;

      // Pricing filter
      if (pricingFilter !== 'ALL' && evt.pricing_type !== pricingFilter) return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          evt.name.toLowerCase().includes(q) ||
          (evt.venue_name && evt.venue_name.toLowerCase().includes(q)) ||
          (evt.organizations?.name && evt.organizations.name.toLowerCase().includes(q)) ||
          (evt.categories?.name && evt.categories.name.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [events, mode, categoryFilter, pricingFilter, search]);

  const now = new Date();
  const liveNowCount = events.filter(
    (e) => e.status === 'PUBLISHED' && !e.deleted_at && new Date(e.start_at) <= now && new Date(e.end_at) >= now
  ).length;
  const activeCount = events.filter((e) => e.status === 'PUBLISHED' && !e.deleted_at && new Date(e.end_at) >= now).length;
  const pastCount = events.filter(
    (e) =>
      e.status !== 'CANCELLED' &&
      e.status !== 'DELETED' &&
      !e.deleted_at &&
      (e.status === 'COMPLETED' || (e.status === 'PUBLISHED' && new Date(e.end_at) < now))
  ).length;
  const paidCount = filteredEvents.filter((e) => e.pricing_type === 'PAID').length;
  const totalViews = filteredEvents.reduce((acc, e) => acc + (e.view_count || 0), 0);

  return (
    <div className="space-y-6 select-text animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#261812] text-white px-4 py-2.5 rounded-xl shadow-xl border border-[#ff6b00]/40 flex items-center gap-2 text-sm font-semibold animate-bounce">
          <span className="material-symbols-outlined text-[18px] text-[#ff6b00]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                isPastMode
                  ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                  : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300'
              }`}
            >
              {isPastMode ? 'Archived Records' : 'Visual Event Showcase'}
            </span>
            <span className="text-xs text-[#5a4136] dark:text-[#ffb693]">
              {isPastMode ? 'Past History' : 'Live & Upcoming Campus Events'}
            </span>
          </div>

          <h2 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-3">
            <span className="material-symbols-outlined text-[32px] text-[#ff6b00]">
              {isPastMode ? 'history' : 'photo_library'}
            </span>
            <span>{isPastMode ? 'Past Events Archive' : 'All Active Events'}</span>
          </h2>
          <p className="text-sm text-[#5a4136] dark:text-[#ffb693] mt-1">
            {isPastMode
              ? 'Complete archive of completed institutional events, historical impressions, and records.'
              : 'Visual banner showcase of all live and upcoming events currently published on the platform.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#261812] text-[#5a4136] dark:text-[#ffb693] hover:border-[#ff6b00] transition-colors flex items-center justify-center cursor-pointer shadow-xs"
            title="Refresh events list"
          >
            <span className={`material-symbols-outlined text-[20px] ${refreshing ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>

          {/* Grid vs Table View Switcher */}
          <div className="flex items-center p-1 bg-[#fee3d8]/60 dark:bg-[#3d2d26] rounded-xl border border-[#e2bfb0]/60 dark:border-[#5a4136]">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-[#261812] text-[#ff6b00] shadow-sm font-extrabold'
                  : 'text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00]'
              }`}
              title="Banner Grid View"
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
              <span>Banner Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-[#261812] text-[#ff6b00] shadow-sm font-extrabold'
                  : 'text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00]'
              }`}
              title="Table View"
            >
              <span className="material-symbols-outlined text-[18px]">table_rows</span>
              <span>Table</span>
            </button>
          </div>

          <button
            onClick={onCreateClick}
            className="bg-[#ff6b00] hover:bg-[#a04100] text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-[#ff6b00]/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            <span>Create Event</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#fee3d8] dark:bg-[#3d2d26] text-[#ff6b00] flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[22px]">
              {isPastMode ? 'history' : 'event_available'}
            </span>
          </div>
          <div>
            <div className="text-2xl font-black font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
              {isPastMode ? pastCount : activeCount}
            </div>
            <div className="text-[11px] font-semibold text-[#5a4136] dark:text-[#ffb693]">
              {isPastMode ? 'Completed Archives' : 'Active Events with Banners'}
            </div>
          </div>
        </div>

        {!isPastMode ? (
          <div className="p-4 rounded-2xl bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[22px]">sensors</span>
            </div>
            <div>
              <div className="text-2xl font-black font-['Outfit'] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span>{liveNowCount}</span>
                {liveNowCount > 0 && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />}
              </div>
              <div className="text-[11px] font-semibold text-[#5a4136] dark:text-[#ffb693]">Happening Today</div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[22px]">auto_stories</span>
            </div>
            <div>
              <div className="text-2xl font-black font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                {events.filter((e) => (e.event_memories?.length || 0) > 0).length || 0}
              </div>
              <div className="text-[11px] font-semibold text-[#5a4136] dark:text-[#ffb693]">With Event Memories</div>
            </div>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-300 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[22px]">payments</span>
          </div>
          <div>
            <div className="text-2xl font-black font-['Outfit'] text-[#261812] dark:text-[#ffede6]">{paidCount}</div>
            <div className="text-[11px] font-semibold text-[#5a4136] dark:text-[#ffb693]">Paid Ticket Events</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[22px]">visibility</span>
          </div>
          <div>
            <div className="text-2xl font-black font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
              {totalViews.toLocaleString()}
            </div>
            <div className="text-[11px] font-semibold text-[#5a4136] dark:text-[#ffb693]">Student Impressions</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#5a4136] dark:text-[#ffb693]">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search active events by name, club, venue..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] text-xs font-medium outline-none focus:border-[#ff6b00] focus:ring-1 focus:ring-[#ff6b00] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#5a4136] hover:text-[#261812] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-[#261812] dark:text-[#ffede6] text-xs font-bold rounded-xl px-3.5 py-2.5 outline-none focus:border-[#ff6b00] cursor-pointer"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={pricingFilter}
            onChange={(e) => setPricingFilter(e.target.value as any)}
            className="bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-[#261812] dark:text-[#ffede6] text-xs font-bold rounded-xl px-3.5 py-2.5 outline-none focus:border-[#ff6b00] cursor-pointer"
          >
            <option value="ALL">All Pricing</option>
            <option value="FREE">Free Entry</option>
            <option value="PAID">Paid Tickets</option>
          </select>

          <span className="text-xs font-bold text-[#5a4136] dark:text-[#ffb693] whitespace-nowrap pl-2">
            Showing <strong className="text-[#ff6b00]">{filteredEvents.length}</strong> events
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-16 text-center text-[#5a4136] dark:text-[#ffb693] flex flex-col items-center justify-center gap-3">
          <div className="w-9 h-9 border-3 border-[#ff6b00] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold">Loading active event cards & banners...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-16 text-center text-[#5a4136] dark:text-[#ffb693] flex flex-col items-center justify-center gap-3 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#fee3d8] dark:bg-[#3d2d26] text-[#ff6b00] flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px]">
              {isPastMode ? 'history_toggle_off' : 'event_busy'}
            </span>
          </div>
          <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
            {isPastMode ? 'No Past Events Found' : 'No Active Events Found'}
          </h3>
          <p className="text-xs max-w-sm">
            {search || categoryFilter !== 'ALL' || pricingFilter !== 'ALL'
              ? 'No events match your current search filters. Try resetting your query.'
              : isPastMode
              ? 'All published events are currently active and live.'
              : 'There are currently no active events. Click Create Event to publish one!'}
          </p>
          {!isPastMode && (
            <button
              onClick={onCreateClick}
              className="mt-2 bg-[#ff6b00] hover:bg-[#a04100] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              + Create First Event
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* Rich Visual Banner Card Grid (Default) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((evt) => {
            const start = new Date(evt.start_at);
            const end = new Date(evt.end_at);
            const isCancelled = evt.status === 'CANCELLED' || evt.status === 'DELETED' || Boolean(evt.deleted_at);
            const isLive = !isCancelled && start <= now && end >= now && evt.status === 'PUBLISHED';
            const isUpcoming = !isCancelled && start > now && evt.status === 'PUBLISHED';
            const isEnded = !isCancelled && (end < now || evt.status === 'COMPLETED');
            const bannerUrl = getEventImage(evt, 'event-card');

            return (
              <div
                key={evt.id}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#261812] shadow-sm hover:shadow-xl hover:border-[#ff6b00]/60 transition-all duration-300 transform hover:-translate-y-1"
              >
                {/* Event Hero Banner Image with Overlays */}
                <div className="relative h-48 w-full overflow-hidden bg-[#fee3d8] dark:bg-[#3d2d26]">
                  <img
                    src={bannerUrl}
                    alt={evt.name}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  {/* Subtle Gradient Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/40" />

                  {/* Top Floating Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                    <span className="px-3 py-1 bg-white/95 dark:bg-[#261812]/95 backdrop-blur-md text-[#ff6b00] rounded-xl font-bold text-[10px] uppercase tracking-wider shadow-sm border border-[#ff6b00]/20">
                      {evt.categories?.name || 'Event'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isCancelled && (
                        <span className="px-2.5 py-1 rounded-xl bg-red-600/90 text-white text-[10px] font-bold backdrop-blur-md">
                          CANCELLED
                        </span>
                      )}
                      {isLive && (
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-500 text-white text-[10px] font-black tracking-wide flex items-center gap-1.5 shadow-md">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          LIVE NOW
                        </span>
                      )}
                      {isUpcoming && (
                        <span className="px-2.5 py-1 rounded-xl bg-blue-600/90 text-white text-[10px] font-black tracking-wide backdrop-blur-md shadow-md">
                          UPCOMING
                        </span>
                      )}
                      {isEnded && (
                        <span className="px-2.5 py-1 rounded-xl bg-zinc-800/90 text-white text-[10px] font-bold backdrop-blur-md">
                          COMPLETED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Floating Info Over Banner */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-semibold">
                    <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-lg">
                      <span className="material-symbols-outlined text-[15px] text-[#ff6b00]">calendar_today</span>
                      <span>
                        {start.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>

                    <div className="bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-lg font-bold">
                      {evt.pricing_type === 'FREE' ? (
                        <span className="text-emerald-400">FREE ENTRY</span>
                      ) : (
                        <span className="text-[#ffb693]">
                          {evt.price_amount && evt.price_amount > 0 ? `₹ ${evt.price_amount}` : 'PAID'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#ff6b00] uppercase tracking-wider">
                      <span className="material-symbols-outlined text-[14px]">groups</span>
                      <span className="line-clamp-1">{evt.organizations?.name || 'LPU Organization'}</span>
                    </div>

                    <h3
                      onClick={() => setPreviewEvent(evt)}
                      className="font-extrabold font-['Outfit'] text-lg text-[#261812] dark:text-[#ffede6] line-clamp-2 group-hover:text-[#ff6b00] cursor-pointer transition-colors leading-snug"
                    >
                      {evt.name}
                    </h3>

                    <p className="text-xs text-[#5a4136] dark:text-[#ffb693] line-clamp-2 leading-relaxed">
                      {evt.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Venue & Time Meta */}
                  <div className="pt-3 border-t border-[#e2bfb0]/50 dark:border-[#5a4136]/50 space-y-2 text-xs text-[#5a4136] dark:text-[#ffb693]">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-[#ff6b00] flex-shrink-0">
                        schedule
                      </span>
                      <span className="font-semibold text-[#261812] dark:text-[#ffede6]">
                        {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &rarr;{' '}
                        {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-[#ff6b00] flex-shrink-0">
                        location_on
                      </span>
                      <span className="line-clamp-1 font-medium">{evt.venue_name}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-bold pt-1">
                      <span className="flex items-center gap-1 text-[#5a4136] dark:text-[#ffb693]">
                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                        <span>{evt.view_count || 0} student views</span>
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#fee3d8] dark:bg-[#3d2d26] text-[#5a4136] dark:text-[#ffb693]">
                        {evt.registration_format || 'INDIVIDUAL'}
                      </span>
                    </div>
                  </div>

                  {/* Card Action Buttons Bar */}
                  <div className="pt-3 border-t border-[#e2bfb0]/60 dark:border-[#5a4136]/60 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewEvent(evt)}
                      className="px-3 py-2 rounded-xl bg-[#fee3d8] dark:bg-[#3d2d26] text-[#261812] dark:text-[#ffede6] hover:bg-[#ff6b00] hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="View Event Details"
                    >
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                      <span>Details</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      {onEditClick && (
                        <button
                          type="button"
                          onClick={() => onEditClick(evt.id)}
                          className="p-2 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] text-[#5a4136] dark:text-[#ffb693] hover:border-[#ff6b00] hover:text-[#ff6b00] transition-colors cursor-pointer"
                          title="Edit Event"
                        >
                          <span className="material-symbols-outlined text-[17px]">edit</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => copyEventLink(evt.id)}
                        className="p-2 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] text-[#5a4136] dark:text-[#ffb693] hover:border-[#ff6b00] hover:text-[#ff6b00] transition-colors cursor-pointer"
                        title="Copy Student Link"
                      >
                        <span className="material-symbols-outlined text-[17px]">link</span>
                      </button>

                      {!isEnded && (
                        <button
                          type="button"
                          onClick={() => setCancellingEvent(evt)}
                          className="p-2 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                          title="Cancel Event"
                        >
                          <span className="material-symbols-outlined text-[17px]">cancel</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Alternative Table View */
        <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#fff1eb]/70 dark:bg-[#1a120e] text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider border-b border-[#e2bfb0] dark:border-[#5a4136]">
                  <th className="p-3.5 pl-5">Event & Banner</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Schedule Timeline</th>
                  <th className="p-3.5">Venue</th>
                  <th className="p-3.5">Pricing</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Views</th>
                  <th className="p-3.5 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2bfb0]/60 dark:divide-[#5a4136]/60 text-xs">
                {filteredEvents.map((evt) => {
                  const start = new Date(evt.start_at);
                  const end = new Date(evt.end_at);
                  const isCancelled = evt.status === 'CANCELLED' || evt.status === 'DELETED' || Boolean(evt.deleted_at);
                  const isLive = !isCancelled && start <= now && end >= now && evt.status === 'PUBLISHED';
                  const isUpcoming = !isCancelled && start > now && evt.status === 'PUBLISHED';
                  const isEnded = !isCancelled && (end < now || evt.status === 'COMPLETED');
                  const bannerUrl = getEventImage(evt, 'thumbnail');

                  return (
                    <tr
                      key={evt.id}
                      className="hover:bg-[#fff8f6] dark:hover:bg-[#3d2d26]/30 transition-colors group"
                    >
                      <td className="p-3.5 pl-5">
                        <div className="flex items-center gap-3">
                          <img
                            src={bannerUrl}
                            alt={evt.name}
                            className="w-14 h-11 rounded-xl object-cover flex-shrink-0 border border-[#e2bfb0]/60 shadow-xs"
                          />
                          <div>
                            <button
                              type="button"
                              onClick={() => setPreviewEvent(evt)}
                              className="font-bold text-sm text-[#261812] dark:text-[#ffede6] hover:text-[#ff6b00] text-left line-clamp-1 cursor-pointer transition-colors"
                            >
                              {evt.name}
                            </button>
                            <div className="text-[11px] text-[#5a4136] dark:text-[#ffb693] line-clamp-1">
                              {evt.organizations?.name || 'Institutional Organizer'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-full bg-[#fee3d8] dark:bg-[#3d2d26] text-[11px] font-bold text-[#ff6b00] whitespace-nowrap">
                          {evt.categories?.name || 'General'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="font-semibold text-[#261812] dark:text-[#ffede6]">
                          {start.toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        <div className="text-[11px] text-[#5a4136] dark:text-[#ffb693]">
                          {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &rarr;{' '}
                          {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 text-[#261812] dark:text-[#ffede6] font-medium">
                          <span className="material-symbols-outlined text-[15px] text-[#ff6b00]">location_on</span>
                          <span className="line-clamp-1 max-w-[140px]">{evt.venue_name}</span>
                        </div>
                      </td>

                      <td className="p-3.5">
                        {evt.pricing_type === 'FREE' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                            FREE ENTRY
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                            {evt.price_amount && evt.price_amount > 0 ? `₹ ${evt.price_amount}` : 'PAID TICKET'}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {isCancelled ? (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 text-[10px] font-bold">
                            CANCELLED
                          </span>
                        ) : isLive ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black tracking-wide flex items-center gap-1 w-fit shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                            LIVE NOW
                          </span>
                        ) : isUpcoming ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                            UPCOMING
                          </span>
                        ) : isEnded ? (
                          <span className="px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold">
                            COMPLETED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                            {evt.status}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1 font-semibold text-[#5a4136] dark:text-[#ffb693]">
                          <span className="material-symbols-outlined text-[15px]">visibility</span>
                          <span>{evt.view_count || 0}</span>
                        </div>
                      </td>

                      <td className="p-3.5 pr-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewEvent(evt)}
                            className="p-1.5 rounded-lg text-[#5a4136] hover:text-[#ff6b00] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] transition-colors cursor-pointer"
                            title="Preview Event Details"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>

                          {onEditClick && (
                            <button
                              type="button"
                              onClick={() => onEditClick(evt.id)}
                              className="p-1.5 rounded-lg text-[#5a4136] hover:text-[#ff6b00] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] transition-colors cursor-pointer"
                              title="Edit Event"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => copyEventLink(evt.id)}
                            className="p-1.5 rounded-lg text-[#5a4136] hover:text-[#ff6b00] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] transition-colors cursor-pointer"
                            title="Copy Student Link"
                          >
                            <span className="material-symbols-outlined text-[18px]">link</span>
                          </button>

                          {!isEnded && (
                            <button
                              type="button"
                              onClick={() => setCancellingEvent(evt)}
                              className="p-1.5 rounded-lg text-[#ba1a1a] hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                              title="Cancel / Deactivate Event"
                            >
                              <span className="material-symbols-outlined text-[18px]">cancel</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview Event Details Modal */}
      {previewEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl overflow-hidden">
            {/* Modal Banner Header Image */}
            <div className="relative h-56 w-full overflow-hidden bg-[#fee3d8]">
              <img
                src={getEventImage(previewEvent, 'admin-preview')}
                alt={previewEvent.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <button
                onClick={() => setPreviewEvent(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>

              <div className="absolute bottom-4 left-5 right-5">
                <span className="px-2.5 py-0.5 rounded-full bg-[#fee3d8] text-[10px] font-bold text-[#ff6b00]">
                  {previewEvent.categories?.name || 'Category'}
                </span>
                <h3 className="text-2xl font-black font-['Outfit'] text-white mt-1">
                  {previewEvent.name}
                </h3>
                <p className="text-xs text-zinc-200 mt-0.5">
                  Organized by: <strong className="text-[#ffb693]">{previewEvent.organizations?.name || 'LPU'}</strong>
                </p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0]/50 dark:border-[#5a4136]/50">
                  <span className="text-[#5a4136] dark:text-[#ffb693] block font-medium">Date & Timeline:</span>
                  <p className="font-bold text-[#261812] dark:text-[#ffede6] mt-1">
                    {new Date(previewEvent.start_at).toLocaleString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}{' '}
                    &rarr;{' '}
                    {new Date(previewEvent.end_at).toLocaleString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0]/50 dark:border-[#5a4136]/50">
                  <span className="text-[#5a4136] dark:text-[#ffb693] block font-medium">Venue & Location:</span>
                  <p className="font-bold text-[#261812] dark:text-[#ffede6] mt-1">{previewEvent.venue_name}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0]/50 dark:border-[#5a4136]/50">
                  <span className="text-[#5a4136] dark:text-[#ffb693] block font-medium">Pricing Model:</span>
                  <p className="font-bold text-[#261812] dark:text-[#ffede6] mt-1">
                    {previewEvent.pricing_type === 'FREE' ? 'Free Entry' : `Paid (₹ ${previewEvent.price_amount || 0})`}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0]/50 dark:border-[#5a4136]/50">
                  <span className="text-[#5a4136] dark:text-[#ffb693] block font-medium">Registration Mode:</span>
                  <p className="font-bold text-[#261812] dark:text-[#ffede6] mt-1">
                    {previewEvent.registration_mode === 'EXTERNAL' ? 'External Redirect URL' : 'Walk-in / Open'}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div>
                <h5 className="text-xs font-bold text-[#261812] dark:text-[#ffede6] uppercase tracking-wider mb-2">
                  Event Description
                </h5>
                <div className="p-4 rounded-xl bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0]/50 dark:border-[#5a4136]/50 text-xs text-[#261812] dark:text-[#ffede6] whitespace-pre-wrap leading-relaxed">
                  {previewEvent.description || 'No description provided.'}
                </div>
              </div>

              {/* Content Sections */}
              {previewEvent.event_content_sections && previewEvent.event_content_sections.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-[#261812] dark:text-[#ffede6] uppercase tracking-wider mb-2">
                    Content Sections ({previewEvent.event_content_sections.length})
                  </h5>
                  <div className="space-y-2">
                    {previewEvent.event_content_sections.map((sec: any) => (
                      <div
                        key={sec.id || sec.title}
                        className="p-3 rounded-xl bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0]/50 dark:border-[#5a4136]/50 text-xs"
                      >
                        <div className="flex items-center justify-between font-bold text-[#261812] dark:text-[#ffede6]">
                          <span>{sec.title}</span>
                          <span className="text-[10px] text-[#ff6b00] uppercase font-black">{sec.section_type}</span>
                        </div>
                        <p className="text-[#5a4136] dark:text-[#ffb693] mt-1 text-[11px]">
                          {typeof sec.content === 'string' ? sec.content : JSON.stringify(sec.content)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Actions Footer */}
              <div className="pt-4 border-t border-[#e2bfb0]/60 dark:border-[#5a4136]/60 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => copyEventLink(previewEvent.id)}
                  className="px-4 py-2 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-bold text-[#5a4136] dark:text-[#ffb693] hover:border-[#ff6b00] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">link</span>
                  <span>Copy Student URL</span>
                </button>

                <div className="flex items-center gap-2">
                  {onEditClick && (
                    <button
                      type="button"
                      onClick={() => {
                        const id = previewEvent.id;
                        setPreviewEvent(null);
                        onEditClick(id);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#ff6b00] text-white text-xs font-bold shadow-sm hover:bg-[#a04100] transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      <span>Edit Event</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewEvent(null)}
                    className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Event Confirmation Dialog */}
      {cancellingEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#261812] border border-[#ba1a1a]/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-[#ba1a1a]">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/70 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[24px]">warning</span>
              </div>
              <div>
                <h4 className="font-bold font-['Outfit'] text-lg text-[#261812] dark:text-[#ffede6]">
                  Cancel Event?
                </h4>
                <p className="text-xs text-[#5a4136] dark:text-[#ffb693]">This will remove the event from live listing.</p>
              </div>
            </div>

            <p className="text-xs text-[#261812] dark:text-[#ffede6]">
              Are you sure you want to cancel <strong>"{cancellingEvent.name}"</strong>?
            </p>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5a4136] dark:text-[#ffb693] mb-1">
                Reason for cancellation:
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Rescheduled or cancelled by organizing committee..."
                className="w-full p-3 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#1a120e] text-xs text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ba1a1a]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancellingEvent(null);
                  setCancelReason('');
                }}
                disabled={cancelLoading}
                className="px-4 py-2 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-bold text-[#5a4136] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Keep Event
              </button>
              <button
                type="button"
                onClick={handleCancelEvent}
                disabled={cancelLoading}
                className="px-4 py-2 rounded-xl bg-[#ba1a1a] text-white text-xs font-bold hover:bg-red-700 transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                {cancelLoading && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>Confirm Cancellation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
