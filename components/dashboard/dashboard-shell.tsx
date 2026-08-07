'use client';

import { useState, useEffect } from 'react';
import type { Profile } from '@/lib/types/profile';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { CreateEvent } from '@/components/dashboard/create-event';
import { Attendees } from '@/components/dashboard/attendees';
import { Payments } from '@/components/dashboard/payments';
import { Analytics } from '@/components/dashboard/analytics';
import { EventsWorkspace } from '@/components/dashboard/events-workspace';
import { OrganizerRequests } from '@/components/dashboard/organizer-requests';
import { CategoriesManagement } from '@/components/dashboard/categories-management';
import { SponsorsManagement } from '@/components/dashboard/sponsors-management';
import { AdvertisementsManagement } from '@/components/dashboard/advertisements-management';
import { AccessManagement } from '@/components/dashboard/access-management';
import { AuditLog } from '@/components/dashboard/audit-log';
import { PaidEventRequests } from '@/components/dashboard/paid-event-requests';
import { useDashboardStats } from '@/hooks/use-dashboard-stats';

type Tab =
  | 'dashboard'
  | 'events'
  | 'create-event'
  | 'payments'
  | 'attendees'
  | 'analytics'
  | 'organizer-requests'
  | 'categories'
  | 'sponsors'
  | 'advertisements'
  | 'access'
  | 'audit-log'
  | 'paid-event-requests'
  | 'profile';

interface NavItem {
  id: Tab;
  label: string;
  icon: string;
  badge?: string | number;
}

const BASE_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'events', label: 'Events', icon: 'calendar_today' },
  { id: 'create-event', label: 'Create Event', icon: 'add_box' },
  { id: 'payments', label: 'Payments', icon: 'payments' },
  { id: 'attendees', label: 'Attendees', icon: 'group' },
  { id: 'analytics', label: 'Analytics', icon: 'analytics' },
  { id: 'profile', label: 'Profile', icon: 'person' },
];

export function DashboardShell({ profile }: { profile: Profile }) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [selectedEventIdForTab, setSelectedEventIdForTab] = useState<string | null>(null);

  const isSuperAdmin = profile?.role === 'super_admin';
  const { stats, loading: statsLoading, error: statsError } = useDashboardStats();

  const [greeting, setGreeting] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return 'Good Morning';
      if (hour < 18) return 'Good Afternoon';
      return 'Good Evening';
    };

    const getCurrentDate = () => {
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      };
      return new Date().toLocaleDateString('en-US', options);
    };

    setGreeting(getGreeting());
    setCurrentDate(getCurrentDate());
  }, []);

  const SUPER_ADMIN_NAV_ITEMS: NavItem[] = [
    {
      id: 'organizer-requests',
      label: 'Organizer Requests',
      icon: 'how_to_reg',
      badge: stats?.users.pendingApplications ? `● ${stats.users.pendingApplications}` : undefined,
    },
    {
      id: 'paid-event-requests',
      label: 'Paid Event Requests',
      icon: 'star',
    },
    { id: 'access', label: 'Access', icon: 'admin_panel_settings' },
    { id: 'categories', label: 'Categories', icon: 'category' },
    { id: 'sponsors', label: 'Sponsors', icon: 'handshake' },
    { id: 'advertisements', label: 'Advertisements', icon: 'campaign' },
    { id: 'audit-log', label: 'Audit Log', icon: 'history' },
  ];

  const navItems = isSuperAdmin ? [...BASE_NAV_ITEMS, ...SUPER_ADMIN_NAV_ITEMS] : BASE_NAV_ITEMS;

  const handleNavigateToTab = (tabId: string, eventId?: string) => {
    if (eventId) {
      setSelectedEventIdForTab(eventId);
    } else {
      setSelectedEventIdForTab(null);
    }
    setActiveTab(tabId as Tab);
  };



  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 w-full">
            {/* Hero Welcome Banner */}
            <section className="xl:col-span-12">
              <div className="relative overflow-hidden flex flex-col justify-center min-h-[280px] rounded-2xl border border-white/5 bg-white/6 p-10 shadow-2xl backdrop-blur-md">
                <div className="relative z-10 flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-bold tracking-[0.2em] text-[#ff914d] uppercase opacity-90">
                      {currentDate || 'Loading date...'}
                    </p>
                    <div className="h-px w-12 bg-[#ff914d]/30 mt-2"></div>
                  </div>
                  <div className="relative">
                    <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight font-display">
                      {greeting || 'Welcome'},{' '}
                      <span className="text-[#ff914d] relative inline-block">
                         {isSuperAdmin ? profile.displayName || 'Super Admin' : profile.displayName || 'Organizer'}
                        <span className="absolute -bottom-1 left-0 w-full h-1 bg-[#ff914d]/20 rounded-full"></span>
                      </span>{' '}
                      👋
                    </h1>
                    <div className="absolute -left-10 top-0 w-40 h-40 bg-[#ff914d]/10 blur-[80px] rounded-full pointer-events-none"></div>
                  </div>
                  <p className="text-base text-white/80 max-w-2xl leading-relaxed">
                    {statsLoading ? (
                      <span className="text-white/60">Loading platform stats...</span>
                    ) : statsError ? (
                      <span className="text-rose-400">{statsError}</span>
                    ) : isSuperAdmin ? (
                      <>
                        There are <span className="text-white font-medium">{stats?.events.published || 0} published events</span>,{' '}
                        <span className="text-[#ff914d] font-semibold">
                          {stats?.users.pendingApplications || 0} organizer requests waiting
                        </span>
                        ,{' '}
                        <span className="text-emerald-400 font-semibold">
                          ₹{(stats?.bookings.totalRevenue || 0).toLocaleString('en-IN')} total revenue
                        </span>{' '}
                        and {stats?.events.upcoming || 0} upcoming events.
                      </>
                    ) : (
                      <>
                        You have <span className="text-white font-medium">{stats?.events.published || 0} events published</span>{' '}
                        and {stats?.bookings.totalRegistrations || 0} total registrations.
                        Let&apos;s make it a great day.
                      </>
                    )}
                  </p>
                </div>
                <div className="absolute -right-20 -top-20 w-[500px] h-[500px] opacity-30 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#ff914d]/20 via-[#ff914d]/5 to-transparent blur-3xl"></div>
              </div>
            </section>

            {/* Row 1 KPI Cards */}
            <section className="xl:col-span-12">
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-6">
                <div className="rounded-xl p-6 border border-white/10 bg-white/5 flex flex-col gap-3 transition-all duration-300 hover:bg-white/10">
                  <span className="text-xs uppercase tracking-widest font-bold text-white/60">
                    Total Events
                  </span>
                  <span className="text-4xl font-bold text-white font-display">
                    {statsLoading ? '...' : stats?.events.total || 0}
                  </span>
                  <p className="text-[11px] text-white/40">All events</p>
                </div>
                <div className="rounded-xl p-6 border border-white/10 bg-white/5 flex flex-col gap-3 transition-all duration-300 relative hover:bg-white/10">
                  <div className="absolute top-6 right-6 w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
                  <span className="text-xs uppercase tracking-widest font-bold text-white/60">
                    Published
                  </span>
                  <span className="text-4xl font-bold text-white font-display">
                    {statsLoading ? '...' : stats?.events.published || 0}
                  </span>
                  <p className="text-[11px] text-emerald-400 font-medium">Live now</p>
                </div>
                <div className="rounded-xl p-6 border border-white/10 bg-white/5 flex flex-col gap-3 transition-all duration-300 hover:bg-white/10">
                  <span className="text-xs uppercase tracking-widest font-bold text-white/60">
                    Upcoming
                  </span>
                  <span className="text-4xl font-bold text-white font-display">
                    {statsLoading ? '...' : stats?.events.upcoming || 0}
                  </span>
                  <p className="text-[11px] text-white/40">Future events</p>
                </div>
                <div className="rounded-xl p-6 border border-[#ff914d]/30 bg-[#ff914d]/5 flex flex-col gap-3 transition-all duration-300 relative hover:bg-[#ff914d]/10">
                  <div className="absolute top-6 right-6 w-2.5 h-2.5 rounded-full bg-[#ff914d] animate-pulse shadow-[0_0_10px_rgba(255,145,77,0.5)]"></div>
                  <span className="text-xs uppercase tracking-widest font-bold text-[#ff914d]">
                    Registrations
                  </span>
                  <span className="text-4xl font-bold text-white font-display">
                    {statsLoading ? '...' : stats?.bookings.totalRegistrations || 0}
                  </span>
                  <p className="text-[11px] text-[#ff914d] font-medium">Total bookings</p>
                </div>
                <div className="rounded-xl p-6 border border-white/10 bg-white/5 flex flex-col gap-3 transition-all duration-300 hover:bg-white/10">
                  <span className="text-xs uppercase tracking-widest font-bold text-white/60">
                    Categories
                  </span>
                  <span className="text-4xl font-bold text-white font-display">
                    {statsLoading ? '...' : stats?.categories.active || 0}
                  </span>
                  <p className="text-[11px] text-white/40">Active categories</p>
                </div>
              </div>
            </section>

            {/* Row 2 KPI Cards for Super Admin */}
            {isSuperAdmin && (
              <section className="xl:col-span-12">
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-6">
                  <div className="rounded-xl p-6 border border-white/10 bg-white/5 flex flex-col gap-3 transition-all duration-300 hover:bg-white/10">
                    <span className="text-xs uppercase tracking-widest font-bold text-white/60">
                      Students
                    </span>
                    <span className="text-4xl font-bold text-white font-display">
                      {statsLoading ? '...' : stats?.users.totalStudents || 0}
                    </span>
                    <p className="text-[11px] text-white/40">Registered students</p>
                  </div>
                  <div className="rounded-xl p-6 border border-white/10 bg-white/5 flex flex-col gap-3 transition-all duration-300 hover:bg-white/10">
                    <span className="text-xs uppercase tracking-widest font-bold text-white/60">
                      Organizers
                    </span>
                    <span className="text-4xl font-bold text-white font-display">
                      {statsLoading ? '...' : stats?.users.totalOrganizers || 0}
                    </span>
                    <p className="text-[11px] text-white/40">Active organizers</p>
                  </div>
                  <div className="rounded-xl p-6 border border-amber-500/30 bg-amber-500/5 flex flex-col gap-3 transition-all duration-300 relative hover:bg-amber-500/10">
                    <div className="absolute top-6 right-6 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></div>
                    <span className="text-xs uppercase tracking-widest font-bold text-amber-400">
                      Pending Requests
                    </span>
                    <span className="text-4xl font-bold text-white font-display">
                      {statsLoading ? '...' : stats?.users.pendingApplications || 0}
                    </span>
                    <p className="text-[11px] text-amber-400 font-medium">Awaiting review</p>
                  </div>
                  <div className="rounded-xl p-6 border border-white/10 bg-white/5 flex flex-col gap-3 transition-all duration-300 hover:bg-white/10">
                    <span className="text-xs uppercase tracking-widest font-bold text-white/60">
                      Total Bookings
                    </span>
                    <span className="text-4xl font-bold text-white font-display">
                      {statsLoading ? '...' : stats?.bookings.totalRegistrations || 0}
                    </span>
                    <p className="text-[11px] text-emerald-400 font-medium">All registrations</p>
                  </div>
                  <div className="rounded-xl p-6 border border-[#ff914d]/30 bg-[#ff914d]/5 flex flex-col gap-3 transition-all duration-300 hover:bg-[#ff914d]/10">
                    <span className="text-xs uppercase tracking-widest font-bold text-[#ff914d]">
                      Total Revenue
                    </span>
                    <span className="text-4xl font-bold text-white font-display">
                      {statsLoading ? '...' : `₹${(stats?.bookings.totalRevenue || 0).toLocaleString('en-IN')}`}
                    </span>
                    <p className="text-[11px] text-emerald-400 font-medium">All time</p>
                  </div>
                </div>
              </section>
            )}

            {/* Needs Attention & Quick Actions for Super Admin */}
            {isSuperAdmin && (
              <section className="xl:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Needs Attention Card */}
                <div className="rounded-2xl p-6 border border-rose-500/20 bg-rose-500/5 backdrop-blur-md flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-rose-400">warning</span>
                    <h3 className="text-lg font-bold text-white font-display">Needs Attention</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setActiveTab('organizer-requests')}
                      className="p-3 bg-white/5 border border-white/10 rounded-xl text-left hover:bg-white/10 transition-all group"
                    >
                      <span className="text-xs text-white/40 block">{statsLoading ? '...' : (stats?.users.pendingApplications || 0)} Organizer Requests</span>
                      <span className="text-sm font-bold text-rose-400 group-hover:underline">
                        Review Applications →
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveTab('payments')}
                      className="p-3 bg-white/5 border border-white/10 rounded-xl text-left hover:bg-white/10 transition-all group"
                    >
                      <span className="text-xs text-white/40 block">Refunds Waiting</span>
                      <span className="text-sm font-bold text-amber-400 group-hover:underline">
                        Process Refunds →
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveTab('advertisements')}
                      className="p-3 bg-white/5 border border-white/10 rounded-xl text-left hover:bg-white/10 transition-all group"
                    >
                      <span className="text-xs text-white/40 block">Ads Expiring</span>
                      <span className="text-sm font-bold text-blue-400 group-hover:underline">
                        Extend Campaign →
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveTab('events')}
                      className="p-3 bg-white/5 border border-white/10 rounded-xl text-left hover:bg-white/10 transition-all group"
                    >
                      <span className="text-xs text-white/40 block">Cancellations</span>
                      <span className="text-sm font-bold text-white group-hover:underline">
                        Manage Events →
                      </span>
                    </button>
                  </div>
                </div>

                {/* Quick Actions Card */}
                <div className="rounded-2xl p-6 border border-white/10 bg-white/5 backdrop-blur-md flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-[#ff914d]">bolt</span>
                      <h3 className="text-lg font-bold text-white font-display">Quick Actions</h3>
                    </div>
                    <p className="text-xs text-white/60">
                      Platform management shortcuts for Super Admin.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setActiveTab('organizer-requests')}
                      className="py-3 px-4 bg-[#ff914d]/10 border border-[#ff914d]/30 text-[#ff914d] rounded-xl text-xs font-bold hover:bg-[#ff914d]/20 transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">how_to_reg</span>
                      Approve Organizer
                    </button>
                    <button
                      onClick={() => setActiveTab('categories')}
                      className="py-3 px-4 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">category</span>
                      Add Category
                    </button>
                    <button
                      onClick={() => setActiveTab('sponsors')}
                      className="py-3 px-4 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">handshake</span>
                      Add Sponsor
                    </button>
                    <button
                      onClick={() => setActiveTab('advertisements')}
                      className="py-3 px-4 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">campaign</span>
                      Add Advertisement
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Left Main Content Block */}
            <div className="xl:col-span-12 flex flex-col gap-8">
              {/* Active Events Header & Grid */}
              <section>
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Active Events</h2>
                    <p className="text-sm text-white/60 mt-1">
                      {isSuperAdmin
                        ? `Managing ${statsLoading ? '...' : (stats?.events.total || 0)} events platform-wide.`
                        : `You have ${statsLoading ? '...' : (stats?.events.published || 0)} published events.`}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('events')}
                    className="text-[#ff914d] hover:text-[#ffb36b] font-medium text-sm flex items-center gap-1 transition-colors"
                  >
                    View all events{' '}
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Event Card 1 */}
                  <div className="rounded-xl overflow-hidden border border-white/5 bg-white/6 group transition-all duration-300 hover:-translate-y-1">
                    <div className="h-40 relative overflow-hidden">
                      <img
                        alt="Tech Symposium 2023"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="absolute top-3 left-3 bg-[#050507]/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-xs font-bold text-white tracking-wide">LIVE NOW</span>
                      </div>
                      <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#050507] to-transparent">
                        <h3 className="text-xl font-bold text-white truncate">
                          Global Tech Symposium
                        </h3>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex justify-between items-center mb-4 text-xs text-white/60">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-base">
                            calendar_month
                          </span>{' '}
                          Oct 24 - 26
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-base">location_on</span>{' '}
                          Main Auditorium
                        </div>
                      </div>
                      <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-white/60">Registrations</span>
                          <span className="font-medium text-white">450 / 500</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#ff914d] rounded-full"
                            style={{ width: '90%' }}
                          ></div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center border-t border-white/5 pt-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">
                            Revenue
                          </p>
                          <p className="font-semibold text-lg text-[#ff914d]">$12,500</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setActiveTab('events')}
                            className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => setActiveTab('events')}
                            className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                            title="Manage"
                          >
                            <span className="material-symbols-outlined text-[18px]">settings</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Event Card 2 */}
                  <div className="rounded-xl overflow-hidden border border-white/5 bg-white/6 group transition-all duration-300 hover:-translate-y-1">
                    <div className="h-40 relative overflow-hidden">
                      <img
                        alt="Alumni Gala Dinner"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        src="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=800"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="absolute top-3 left-3 bg-[#050507]/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        <span className="text-xs font-bold text-white tracking-wide">UPCOMING</span>
                      </div>
                      <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#050507] to-transparent">
                        <h3 className="text-xl font-bold text-white truncate">
                          Annual Alumni Gala
                        </h3>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex justify-between items-center mb-4 text-xs text-white/60">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-base">
                            calendar_month
                          </span>{' '}
                          Nov 12, 2023
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-base">location_on</span>{' '}
                          Grand Hotel
                        </div>
                      </div>
                      <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-white/60">Registrations</span>
                          <span className="font-medium text-white">120 / 300</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full"
                            style={{ width: '40%' }}
                          ></div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center border-t border-white/5 pt-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">
                            Revenue
                          </p>
                          <p className="font-semibold text-lg text-[#ff914d]">$18,000</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setActiveTab('events')}
                            className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => setActiveTab('events')}
                            className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                            title="Manage"
                          >
                            <span className="material-symbols-outlined text-[18px]">settings</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Analytics Summary Widgets */}
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="rounded-xl p-6 border border-white/5 bg-white/5">
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-xs text-white/60 font-medium">Total Revenue</p>
                    <span className="flex items-center text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                      +14.5%
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">$42,850.00</h3>
                  <div className="h-8 w-full flex items-end gap-1 opacity-50">
                    <div className="w-1/6 bg-[#ff914d]/20 h-1/3 rounded-t-sm"></div>
                    <div className="w-1/6 bg-[#ff914d]/30 h-1/2 rounded-t-sm"></div>
                    <div className="w-1/6 bg-[#ff914d]/40 h-2/5 rounded-t-sm"></div>
                    <div className="w-1/6 bg-[#ff914d]/60 h-3/4 rounded-t-sm"></div>
                    <div className="w-1/6 bg-[#ff914d]/80 h-2/3 rounded-t-sm"></div>
                    <div className="w-1/6 bg-[#ff914d] h-full rounded-t-sm"></div>
                  </div>
                </div>
                <div className="rounded-xl p-6 border border-white/5 bg-white/5">
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-xs text-white/60 font-medium">Tickets Sold</p>
                    <span className="flex items-center text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                      +8.2%
                    </span>
                  </div>
                  <div className="flex items-end gap-2 mb-4">
                    <h3 className="text-2xl font-bold text-white">1,204</h3>
                    <span className="text-xs text-white/40 mb-1">/ 1,500</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: '80%' }}></div>
                  </div>
                </div>
                <div className="rounded-xl p-6 border border-white/5 bg-white/5">
                  <div className="flex justify-between items-start mb-4">
                    <p className="text-xs text-white/60 font-medium">Avg. Attendance</p>
                    <span className="flex items-center text-[10px] text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-full">
                      -2.1%
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">84%</h3>
                  <p className="text-[11px] text-white/40">Across 12 completed events</p>
                </div>
              </section>

              {/* Today's Schedule Timeline */}
              <section className="mb-8">
                <div className="rounded-xl p-6 border border-white/5 bg-white/5">
                  <h2 className="text-lg font-bold text-white mb-6 border-b border-white/5 pb-4">
                    Today&apos;s Schedule
                  </h2>
                  <div className="relative pl-6 border-l border-white/10 space-y-10">
                    <div className="relative">
                      <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-emerald-400 border-4 border-[#050507]"></div>
                      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                        <div>
                          <h4 className="font-medium text-white text-base">
                            Keynote Address: Future Tech
                          </h4>
                          <p className="text-xs text-white/60 mt-1">
                            Global Tech Symposium • Main Hall
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-0.5 bg-emerald-400/10 text-emerald-400 text-[10px] rounded border border-emerald-400/20">
                              Ongoing
                            </span>
                          </div>
                        </div>
                        <button className="text-xs text-[#ff914d] hover:text-[#ffb36b] border border-[#ff914d]/30 px-3 py-1.5 rounded bg-[#ff914d]/5 hover:bg-[#ff914d]/10 transition-colors shrink-0">
                          View Stream
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-[#ff914d] border-4 border-[#050507]"></div>
                      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                        <div>
                          <h4 className="font-medium text-white text-base">
                            Registration Closes: AI Workshop
                          </h4>
                          <p className="text-xs text-white/60 mt-1">Workshop Series Alpha</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="px-2 py-0.5 bg-[#ff914d]/10 text-[#ff914d] text-[10px] rounded border border-[#ff914d]/20">
                              Action Required
                            </span>
                          </div>
                        </div>
                        <button className="text-xs text-white/60 hover:text-white border border-white/10 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 transition-colors shrink-0">
                          Review List
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-white/10 border-4 border-[#050507]"></div>
                      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                        <div>
                          <h4 className="font-medium text-white/60 text-base">
                            Networking Mixer Setup
                          </h4>
                          <p className="text-xs text-white/40 mt-1">
                            Global Tech Symposium • Rooftop Terrace
                          </p>
                        </div>
                        <button
                          className="text-xs text-white/40 border border-white/5 px-3 py-1.5 rounded bg-white/5 transition-colors shrink-0 opacity-50 cursor-not-allowed"
                          disabled
                        >
                          Pending
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        );
      case 'events':
        return <EventsWorkspace onNavigateToTab={handleNavigateToTab} />;
      case 'create-event':
        return <CreateEvent />;
      case 'attendees':
        return <Attendees initialEventId={selectedEventIdForTab} />;
      case 'payments':
        return <Payments initialEventId={selectedEventIdForTab} />;
      case 'analytics':
        return <Analytics />;
      case 'profile': {
        return (
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-6">
            <h2 className="text-2xl font-bold text-white font-display">Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Name</label>
                <p className="text-sm text-white/80">{profile?.displayName || '—'}</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Email</label>
                <p className="text-sm text-white/80">{profile?.email || '—'}</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Role</label>
                <p className="text-sm text-white/80 capitalize">{profile?.role || '—'}</p>
              </div>
            </div>
            <p className="text-xs text-white/40">Visit <a className="text-[#ffb36b] underline" href="/dashboard/profile">/dashboard/profile</a> for full profile management.</p>
          </div>
        );
      }
      case 'organizer-requests':
        return <OrganizerRequests />;
      case 'access':
        return <AccessManagement />;
      case 'categories':
        return <CategoriesManagement />;
      case 'sponsors':
        return <SponsorsManagement />;
      case 'advertisements':
        return <AdvertisementsManagement />;
      case 'audit-log':
        return <AuditLog />;
      case 'paid-event-requests':
        return <PaidEventRequests />;
      default:
        // Render simple loader or default tab wrapper
        const item = navItems.find((nav) => nav.id === activeTab);
        return (
          <div className="space-y-6">
            <header>
              <p className="text-sm uppercase tracking-[0.24em] text-[#ffb36b]">Management</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-white capitalize">
                {item?.label}
              </h1>
            </header>
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
              <p className="text-sm text-white/52">
                {item?.label} view is active. Send your code to integrate this panel.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-[#050507] text-[#f4efe9]">
      {/* SideNavBar */}
      <aside className="h-screen w-64 fixed left-0 top-0 border-r border-white/10 backdrop-blur-xl bg-white/5 flex flex-col py-8 z-50 justify-between">
        <div className="space-y-8 overflow-y-auto">
          {/* Logo / Header */}
          <div className="px-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#ff914d] flex items-center justify-center text-[#050507] font-bold text-xl select-none">
              LPU
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-[#ff914d] tracking-tight leading-none">
                LPU Events
              </h1>
              <p className="text-[10px] text-white/50 tracking-wider mt-1 uppercase">
                {isSuperAdmin ? 'Super Admin Portal' : 'Organizer Portal'}
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-4 space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedEventIdForTab(null);
                    setActiveTab(item.id);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left text-sm font-medium transition-all ${isActive
                    ? 'bg-white/10 text-[#ff914d] font-bold border-r-2 border-[#ff914d] scale-95'
                    : 'text-white/60 hover:bg-white/10 transition-colors'
                    }`}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[11px] font-bold text-[#ff914d] bg-[#ff914d]/10 border border-[#ff914d]/20 px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer / Create button & Sign-out */}
        <div className="px-4 space-y-4 pt-4 border-t border-white/5">
          <button
            onClick={() => {
              setSelectedEventIdForTab(null);
              setActiveTab('create-event');
            }}
            className="w-full py-3 bg-[#ff914d] text-[#050507] rounded-lg font-bold hover:bg-[#e07530] transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,145,77,0.3)] text-sm"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Create New Event
          </button>

          <div className="pt-2 flex items-center justify-between gap-2 px-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {isSuperAdmin ? (profile.displayName || 'Super Admin') : (profile.displayName || 'Organizer')}
              </p>
              <p className="text-[10px] text-white/40 truncate">{profile.email}</p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="ml-64 flex-1 flex flex-col relative min-h-screen">
        {/* TopNavBar */}
        <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#050507]/80 border-b border-white/10 flex justify-between items-center h-20 px-10">
          <div className="flex items-center gap-4 w-1/3">
            <h2 className="text-xl font-bold text-white capitalize">
              {navItems.find((n) => n.id === activeTab)?.label || activeTab}
            </h2>
          </div>
          <div className="flex items-center gap-6 justify-end w-2/3">
            <div className="relative w-72 hidden lg:block group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-[#ff914d] transition-colors text-[20px]">
                search
              </span>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-full py-1.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-[#ff914d] focus:ring-1 focus:ring-[#ff914d]/20 transition-all"
                placeholder={
                  isSuperAdmin
                    ? 'Search events, organizers, payments...'
                    : 'Search events, attendees...'
                }
                type="text"
              />
            </div>
            <div className="flex items-center gap-4">
              <button
                className="text-white/60 hover:text-[#ff914d] transition-colors relative flex items-center"
                title="Notifications"
              >
                <span className="material-symbols-outlined">notifications</span>
                <span className="absolute top-0 right-0 w-2 h-2 bg-[#ff914d] rounded-full animate-pulse"></span>
              </button>
              <button
                className="text-white/60 hover:text-[#ff914d] transition-colors flex items-center"
                title="Help & Support"
              >
                <span className="material-symbols-outlined">help</span>
              </button>
              <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 overflow-hidden cursor-pointer flex items-center justify-center text-xs font-semibold text-[#ff914d] uppercase select-none">
                {((profile?.displayName || profile?.email) ?? '').slice(0, 2)}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-8 sm:p-10 lg:p-12 overflow-y-auto">{renderContent()}</main>
      </div>
    </div>
  );
}
