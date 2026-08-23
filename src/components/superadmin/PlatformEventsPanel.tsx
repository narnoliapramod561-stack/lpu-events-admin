import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase';
import { 
  CalendarDays, 
  Search, 
  Building2, 
  MapPin, 
  Eye 
} from 'lucide-react';
import { EmptyState } from '../shell/EmptyState';
import { LoadingSpinner } from '../shell/LoadingState';

export const PlatformEventsPanel: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, organizations(name)')
        .order('start_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Failed to load platform events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const now = new Date();

  const filteredEvents = useMemo(() => {
    return events.filter(evt => {
      const isCancelledOrDeleted = evt.status === 'CANCELLED' || evt.status === 'DELETED' || Boolean(evt.deleted_at);

      if (statusFilter === 'PUBLISHED' && (evt.status !== 'PUBLISHED' || isCancelledOrDeleted)) return false;
      if (statusFilter === 'CANCELLED' && evt.status !== 'CANCELLED') return false;
      if (statusFilter === 'COMPLETED') {
        if (isCancelledOrDeleted) return false;
        if (!(new Date(evt.end_at) < now || evt.status === 'COMPLETED')) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          evt.name.toLowerCase().includes(q) ||
          (evt.organizations?.name && evt.organizations.name.toLowerCase().includes(q)) ||
          (evt.venue_name && evt.venue_name.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [events, statusFilter, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-purple">GLOBAL REPOSITORY</span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Central Event Moderation</span>
          </div>
          <h2 className="page-title">Platform Events Directory</h2>
          <p className="page-description">Complete institutional inventory of student events, hackathons, workshops, and sports meets.</p>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card-box">
        <div className="card-box-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 className="card-box-title">Event Inventory</h3>
            <span className="badge badge-purple">{filteredEvents.length} Events</span>
          </div>

          {/* Filter Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Status Pills */}
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', padding: '3px', border: '1px solid var(--border-subtle)' }}>
              {(['ALL', 'PUBLISHED', 'COMPLETED', 'CANCELLED'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className="btn btn-ghost btn-sm"
                  style={{
                    backgroundColor: statusFilter === f ? 'var(--bg-surface-raised)' : 'transparent',
                    color: statusFilter === f ? 'var(--text-main)' : 'var(--text-dim)',
                    fontWeight: statusFilter === f ? 700 : 500,
                    padding: '4px 10px',
                    fontSize: '11.5px'
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="search-input-wrapper" style={{ minWidth: '220px' }}>
              <Search size={14} className="search-input-icon" />
              <input
                type="text"
                placeholder="Search by title, club, venue..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-input search-input"
                style={{ padding: '6px 12px 6px 34px', fontSize: '13px' }}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Fetching institutional event directory..." />
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            title="No Events Found"
            description="No events match your current filter query."
            icon={<CalendarDays size={26} />}
          />
        ) : (
          <div className="table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Event Name & Venue</th>
                  <th>Organizing Entity</th>
                  <th>Schedule Timeline</th>
                  <th>Pricing</th>
                  <th>Status</th>
                  <th>View Count</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map(evt => {
                  const isLive = new Date(evt.end_at) >= now && evt.status === 'PUBLISHED';
                  const isCompleted = new Date(evt.end_at) < now || evt.status === 'COMPLETED';

                  return (
                    <tr key={evt.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{evt.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-dim)', fontSize: '12px' }}>
                            <MapPin size={12} />
                            <span>{evt.venue_name}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                          <Building2 size={14} color="var(--accent-purple)" />
                          <span>{evt.organizations?.name || 'Institutional Club'}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12.5px' }}>
                          <span>{new Date(evt.start_at).toLocaleDateString()}</span>
                          <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                            {new Date(evt.start_at).toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-accent">
                          {evt.pricing_type === 'FREE' ? 'FREE' : `₹${evt.price_amount}`}
                        </span>
                      </td>
                      <td>
                        {isLive ? (
                          <span className="badge badge-success">
                            <span className="badge-dot" />
                            <span>LIVE</span>
                          </span>
                        ) : isCompleted ? (
                          <span className="badge badge-secondary" style={{ backgroundColor: 'var(--bg-surface-raised)', color: 'var(--text-muted)' }}>
                            <span>COMPLETED</span>
                          </span>
                        ) : evt.status === 'CANCELLED' ? (
                          <span className="badge badge-danger">
                            <span className="badge-dot" />
                            <span>CANCELLED</span>
                          </span>
                        ) : (
                          <span className="badge badge-warning">
                            <span>{evt.status}</span>
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px' }}>
                          <Eye size={14} />
                          <span>{(evt.view_count || 0).toLocaleString()}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
