import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase';
import { useAuth } from '../../auth';
import { 
  PlusCircle, 
  MapPin, 
  Eye, 
  Layers, 
  Search, 
  ArrowUpRight, 
  Sparkles,
  CalendarCheck,
  TrendingUp,
  Calendar,
  Clock,
  Link,
  Edit,
  CheckCircle2,
  X
} from 'lucide-react';
import { EmptyState } from '../shell/EmptyState';
import { LoadingSpinner } from '../shell/LoadingState';
import { getEventImage } from '../../utils/images';
import { getStudentEventUrl } from '@lpu-events/shared';

interface OrganizerDashboardProps {
  onSelectEvent: (eventId: string) => void;
  onCreateEventTrigger: () => void;
  mode?: 'all' | 'active' | 'past';
  initialStatusFilter?: 'ALL' | 'ACTIVE' | 'COMPLETED' | 'DRAFT';
}

export const OrganizerDashboard: React.FC<OrganizerDashboardProps> = ({
  onSelectEvent,
  onCreateEventTrigger,
  mode = 'all',
  initialStatusFilter = 'ALL'
}) => {
  const { profile } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previewEvent, setPreviewEvent] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'DRAFT'>(
    mode === 'active' ? 'ACTIVE' : mode === 'past' ? 'COMPLETED' : initialStatusFilter
  );

  useEffect(() => {
    if (mode === 'active') setStatusFilter('ACTIVE');
    else if (mode === 'past') setStatusFilter('COMPLETED');
    else setStatusFilter(initialStatusFilter);
  }, [mode, initialStatusFilter]);

  const fetchEvents = async () => {
    if (!profile?.org_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, description, start_at, end_at, venue_name, registration_mode, pricing_type, price_amount, external_registration_url, registration_format, banner_media_id, media_assets:banner_media_id(id, object_key, bucket), status, view_count, category_id, subcategory_id, created_at, updated_at, categories(name), event_content_sections(id, section_type, title, content, sort_order)')
        .eq('organization_id', profile.org_id)
        .order('start_at', { ascending: mode === 'past' ? false : true });
      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Failed to load organizer events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [profile, mode]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyEventLink = (id: string, name?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const url = getStudentEventUrl(id, name);
    navigator.clipboard.writeText(url);
    showToast('Student link copied to clipboard!');
  };

  const now = new Date();
  const activeEvents = events.filter(
    (e) =>
      e.status === 'PUBLISHED' &&
      !e.deleted_at &&
      new Date(e.end_at) >= now
  );
  const completedEvents = events.filter(
    (e) =>
      e.status !== 'CANCELLED' &&
      e.status !== 'DELETED' &&
      !e.deleted_at &&
      (e.status === 'COMPLETED' || (e.status === 'PUBLISHED' && new Date(e.end_at) < now))
  );
  const totalViews = events.reduce((sum, e) => sum + (e.view_count || 0), 0);

  const filteredEvents = useMemo(() => {
    const curTime = new Date().getTime();
    return events.filter(evt => {
      const endTimestamp = new Date(evt.end_at).getTime();
      const isEvtCancelled = evt.status === 'CANCELLED' || evt.status === 'DELETED' || Boolean(evt.deleted_at);
      const isEvtActive = !isEvtCancelled && endTimestamp >= curTime && evt.status === 'PUBLISHED';
      const isEvtPast = !isEvtCancelled && (evt.status === 'COMPLETED' || (evt.status === 'PUBLISHED' && endTimestamp < curTime));

      // Strict mode checks
      if (mode === 'active' && !isEvtActive) return false;
      if (mode === 'past' && !isEvtPast) return false;

      // Tab filter check for general dashboard mode
      if (mode === 'all') {
        if (statusFilter === 'ACTIVE' && !isEvtActive) return false;
        if (statusFilter === 'COMPLETED' && !isEvtPast) return false;
        if (statusFilter === 'DRAFT' && evt.status !== 'DRAFT') return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          evt.name.toLowerCase().includes(q) ||
          (evt.venue_name && evt.venue_name.toLowerCase().includes(q)) ||
          (evt.categories?.name && evt.categories.name.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [events, mode, statusFilter, searchQuery]);

  const getHeaderTitle = () => {
    if (mode === 'active') return 'All Active Events';
    if (mode === 'past') return 'Past Events Archive';
    return `${profile?.org_name || 'Organization'} Dashboard`;
  };

  const getHeaderDescription = () => {
    if (mode === 'active') return 'Visual banner showcase of live and upcoming events published by your club.';
    if (mode === 'past') return 'Archive of completed events, historical attendance, and impressions.';
    return 'Monitor real-time event analytics, metrics, and manage registrations.';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#261812] text-white px-4 py-2.5 rounded-xl shadow-xl border border-[#ff6b00]/40 flex items-center gap-2 text-sm font-semibold animate-bounce">
          <CheckCircle2 size={18} color="#ff6b00" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className={`badge ${mode === 'past' ? 'badge-purple' : 'badge-accent'}`}>
              {mode === 'past' ? 'ARCHIVE' : mode === 'active' ? 'LIVE & UPCOMING' : 'CLUB WORKSPACE'}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>ID: {profile?.org_id?.slice(0, 8)}...</span>
          </div>
          <h2 className="page-title">
            {getHeaderTitle()}
          </h2>
          <p className="page-description">
            {getHeaderDescription()}
          </p>
        </div>

        <button className="btn btn-primary" onClick={onCreateEventTrigger}>
          <PlusCircle size={16} />
          <span>Create New Event</span>
        </button>
      </div>

      {/* 4 Stat KPI Cards - ONLY on Dashboard Overview (mode === 'all') */}
      {mode === 'all' && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">Total Events</span>
              <div className="stat-card-icon-box">
                <Layers size={18} />
              </div>
            </div>
            <div className="stat-card-value">{events.length}</div>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>All-time registered events</span>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">Live & Upcoming</span>
              <div className="stat-card-icon-box" style={{ color: 'var(--success)', backgroundColor: 'var(--success-subtle)' }}>
                <Sparkles size={18} />
              </div>
            </div>
            <div className="stat-card-value" style={{ color: 'var(--success)' }}>{activeEvents.length}</div>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Currently active on portal</span>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">Completed Archives</span>
              <div className="stat-card-icon-box" style={{ color: 'var(--info)', backgroundColor: 'var(--info-subtle)' }}>
                <CalendarCheck size={18} />
              </div>
            </div>
            <div className="stat-card-value">{completedEvents.length}</div>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Events finished</span>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-title">Total Impressions</span>
              <div className="stat-card-icon-box" style={{ color: 'var(--accent-primary)', backgroundColor: 'var(--accent-subtle)' }}>
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="stat-card-value">{totalViews.toLocaleString()}</div>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Public student views</span>
          </div>
        </div>
      )}

      {/* Main Section for Active & Past Events (Visual Banner Cards Showcase) */}
      {mode !== 'all' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Toolbar with Search and count */}
          <div className="card-box" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div className="search-input-wrapper" style={{ minWidth: '280px', flex: 1 }}>
              <Search size={15} className="search-input-icon" />
              <input
                type="text"
                placeholder={`Search ${mode === 'past' ? 'past' : 'active'} events by title, venue...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input search-input"
                style={{ padding: '8px 12px 8px 36px', fontSize: '13px' }}
              />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dim)' }}>
              Showing <strong style={{ color: 'var(--accent-primary)' }}>{filteredEvents.length}</strong> {mode === 'past' ? 'past' : 'active'} events
            </div>
          </div>

          {/* Loading / Empty / Visual Banner Cards Grid */}
          {loading ? (
            <LoadingSpinner message={`Fetching ${mode === 'past' ? 'past' : 'active'} event banners...`} />
          ) : filteredEvents.length === 0 ? (
            <EmptyState
              title={mode === 'past' ? 'No Past Events Found' : 'No Active Events Found'}
              description={searchQuery ? 'No events match your current filter query.' : mode === 'past' ? 'Your club has no archived past events.' : 'You have no live active events published yet.'}
              actionLabel={mode === 'active' && !searchQuery ? '+ Create New Event' : undefined}
              onAction={mode === 'active' && !searchQuery ? onCreateEventTrigger : undefined}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {filteredEvents.map((evt) => {
                const start = new Date(evt.start_at);
                const end = new Date(evt.end_at);
                const isLive = start <= now && end >= now && evt.status === 'PUBLISHED';
                const isUpcoming = start > now && evt.status === 'PUBLISHED';
                const isEnded = end < now || evt.status === 'COMPLETED';
                const bannerUrl = getEventImage(evt, 'event-card');

                return (
                  <div
                    key={evt.id}
                    className="card-box"
                    style={{
                      padding: 0,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    {/* Event Banner Image with Overlays */}
                    <div style={{ position: 'relative', height: '180px', width: '100%', overflow: 'hidden', backgroundColor: 'var(--bg-base)' }}>
                      <img
                        src={bannerUrl}
                        alt={evt.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0.4) 100%)'
                        }}
                      />
                      
                      {/* Floating Badges */}
                      <div style={{ position: 'absolute', top: '10px', left: '12px', right: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="badge badge-accent" style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 800 }}>
                          {evt.categories?.name || 'CAMPUS EVENT'}
                        </span>
                        {isLive && (
                          <span className="badge badge-success" style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 800 }}>
                            LIVE NOW
                          </span>
                        )}
                        {isUpcoming && (
                          <span className="badge badge-info" style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 800 }}>
                            UPCOMING
                          </span>
                        )}
                        {isEnded && (
                          <span className="badge" style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 800, backgroundColor: 'rgba(50,50,50,0.8)', color: '#fff' }}>
                            COMPLETED
                          </span>
                        )}
                      </div>

                      {/* Bottom Banner Meta */}
                      <div style={{ position: 'absolute', bottom: '10px', left: '12px', right: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', fontSize: '12px', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '6px' }}>
                          <Calendar size={12} color="#ff6b00" />
                          <span>{start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <span style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '6px', color: evt.pricing_type === 'FREE' ? '#4ade80' : '#fb923c', fontWeight: 700 }}>
                          {evt.pricing_type === 'FREE' ? 'FREE ENTRY' : `₹${evt.price_amount || 0}`}
                        </span>
                      </div>
                    </div>

                    {/* Card Content Body */}
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <h4
                          onClick={() => setPreviewEvent(evt)}
                          style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: 0, cursor: 'pointer', lineHeight: 1.3 }}
                        >
                          {evt.name}
                        </h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {evt.description || 'No description provided.'}
                        </p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--text-dim)', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={13} color="var(--accent-primary)" />
                          <span>
                            {start.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit', hour12: true })} &rarr; {end.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={13} color="var(--accent-primary)" />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {evt.venue_name || 'Campus Venue'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', fontSize: '11.5px', fontWeight: 600 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Eye size={12} />
                            <span>{evt.view_count || 0} student views</span>
                          </span>
                          <span className="badge" style={{ fontSize: '10px' }}>
                            {evt.registration_format || 'INDIVIDUAL'}
                          </span>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setPreviewEvent(evt)}
                          style={{ fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Eye size={14} />
                          <span>Details</span>
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => copyEventLink(evt.id, evt.name, e)}
                            title="Copy Student Link"
                            style={{ padding: '6px 8px' }}
                          >
                            <Link size={14} />
                          </button>

                          <button
                            type="button"
                            className="btn btn-accent btn-sm"
                            onClick={() => onSelectEvent(evt.id)}
                            style={{ fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Edit size={13} />
                            <span>Manage</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Legacy Table Card for Dashboard Overview (mode === 'all') */
        <div className="card-box">
          <div className="card-box-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 className="card-box-title">Recent Event Inventory</h3>
              <span className="badge badge-accent">{filteredEvents.length} Events</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', backgroundColor: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', padding: '3px', border: '1px solid var(--border-subtle)' }}>
                {(['ALL', 'ACTIVE', 'COMPLETED', 'DRAFT'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className="btn btn-ghost btn-sm"
                    style={{
                      backgroundColor: statusFilter === tab ? 'var(--bg-surface-raised)' : 'transparent',
                      color: statusFilter === tab ? 'var(--text-main)' : 'var(--text-dim)',
                      fontWeight: statusFilter === tab ? 700 : 500,
                      padding: '4px 10px',
                      fontSize: '11px'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="search-input-wrapper" style={{ minWidth: '200px' }}>
                <Search size={14} className="search-input-icon" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input search-input"
                  style={{ padding: '6px 12px 6px 34px', fontSize: '13px' }}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner message="Fetching organization events..." />
          ) : filteredEvents.length === 0 ? (
            <EmptyState
              title="No Events Found"
              description={searchQuery ? "No events match your current filter query." : "Your organization has not published any events yet."}
              actionLabel={!searchQuery ? "+ Create Your First Event" : undefined}
              onAction={!searchQuery ? onCreateEventTrigger : undefined}
            />
          ) : (
            <div className="table-wrapper">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Event & Banner</th>
                    <th>Schedule</th>
                    <th>Pricing</th>
                    <th>Status</th>
                    <th>Views</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((evt) => {
                    const isCancelled = evt.status === 'CANCELLED' || evt.status === 'DELETED' || Boolean(evt.deleted_at);
                    const isLive = !isCancelled && new Date(evt.end_at) >= now && evt.status === 'PUBLISHED';
                    const isPast = !isCancelled && (new Date(evt.end_at) < now || evt.status === 'COMPLETED');
                    const bannerUrl = getEventImage(evt, 'thumbnail');

                    return (
                      <tr key={evt.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img
                              src={bannerUrl}
                              alt={evt.name}
                              style={{ width: '48px', height: '36px', borderRadius: '6px', objectFit: 'cover' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{evt.name}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-dim)', fontSize: '12px' }}>
                                <MapPin size={12} />
                                <span>{evt.venue_name || 'Campus Venue'}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12.5px' }}>
                            <span style={{ color: 'var(--text-main)' }}>{new Date(evt.start_at).toLocaleDateString()}</span>
                            <span style={{ color: 'var(--text-dim)', fontSize: '11.5px' }}>
                              {new Date(evt.start_at).toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-info">
                            {evt.pricing_type === 'FREE' ? 'FREE' : `₹${evt.price_amount || 0}`}
                          </span>
                        </td>
                        <td>
                          {isCancelled ? (
                            <span className="badge badge-danger">CANCELLED</span>
                          ) : isLive ? (
                            <span className="badge badge-success">LIVE</span>
                          ) : isPast ? (
                            <span className="badge">COMPLETED</span>
                          ) : (
                            <span className="badge badge-warning">{evt.status}</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-dim)', fontSize: '13px' }}>
                            <Eye size={13} />
                            <span>{evt.view_count || 0}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => onSelectEvent(evt.id)}
                            style={{ color: 'var(--accent-primary)', fontWeight: 600 }}
                          >
                            <span>Manage</span>
                            <ArrowUpRight size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl max-w-xl w-full max-h-[85vh] overflow-y-auto shadow-2xl overflow-hidden">
            <div style={{ position: 'relative', height: '180px', width: '100%' }}>
              <img
                src={getEventImage(previewEvent, 'admin-preview')}
                alt={previewEvent.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }} />
              <button
                onClick={() => setPreviewEvent(null)}
                style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', padding: '6px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
              <div style={{ position: 'absolute', bottom: '12px', left: '16px', right: '16px', color: '#fff' }}>
                <span className="badge badge-accent" style={{ fontSize: '10px' }}>{previewEvent.categories?.name || 'Category'}</span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 800 }}>{previewEvent.name}</h3>
              </div>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
              <div>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Description:</strong>
                <p style={{ margin: 0, color: 'var(--text-dim)', lineHeight: 1.5 }}>{previewEvent.description || 'No description provided.'}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '10px', background: 'var(--bg-base)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Schedule</span>
                  <div style={{ fontWeight: 600 }}>{new Date(previewEvent.start_at).toLocaleString()}</div>
                </div>
                <div style={{ padding: '10px', background: 'var(--bg-base)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Venue</span>
                  <div style={{ fontWeight: 600 }}>{previewEvent.venue_name}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => copyEventLink(previewEvent.id, previewEvent.name)}>
                  <Link size={14} />
                  <span>Copy Link</span>
                </button>
                <button className="btn btn-accent btn-sm" onClick={() => { const id = previewEvent.id; setPreviewEvent(null); onSelectEvent(id); }}>
                  <Edit size={14} />
                  <span>Manage in Cockpit</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
