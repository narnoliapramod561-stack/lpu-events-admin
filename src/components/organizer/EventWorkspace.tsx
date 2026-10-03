import React, { useState, useEffect } from 'react';
import { lpuClient } from '../../supabase';
import { EventForm } from './EventForm';
import { EventQrCard } from './EventQrCard';
import { 
  ArrowLeft, 
  Edit3, 
  XCircle, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2 
} from 'lucide-react';
import { LoadingSpinner } from '../shell/LoadingState';

interface EventWorkspaceProps {
  eventId: string;
  onBack: () => void;
}

type WorkspaceTab = 'overview' | 'edit' | 'media';

export const EventWorkspace: React.FC<EventWorkspaceProps> = ({ eventId, onBack }) => {
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchEvent = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await lpuClient.fetchEventDetails(eventId);
      if (err) throw err;
      setEvent(data);
    } catch (err) {
      setError('Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      setError('Please provide a cancellation reason.');
      return;
    }
    setCancelling(true);
    setError('');
    try {
      const { error: cancelErr } = await lpuClient.cancelEvent(eventId, cancelReason.trim());
      if (cancelErr) throw new Error(typeof cancelErr === 'object' ? JSON.stringify(cancelErr) : cancelErr);
      setSuccess('Event cancelled successfully.');
      setShowCancelDialog(false);
      fetchEvent();
    } catch (err: any) {
      setError('Cancellation failed: ' + (err.message || ''));
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading event workspace..." />;
  }

  if (!event) {
    return (
      <div className="card-box" style={{ padding: '40px', textAlign: 'center' }}>
        <h3 className="card-box-title" style={{ marginBottom: '10px' }}>Event Not Found</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>The requested event could not be retrieved from the database.</p>
        <button onClick={onBack} className="btn btn-secondary">
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>
    );
  }

  if (activeTab === 'edit') {
    return (
      <EventForm
        editEventId={eventId}
        onComplete={() => { setActiveTab('overview'); fetchEvent(); }}
        onCancel={() => setActiveTab('overview')}
      />
    );
  }

  const now = new Date();
  const isActive = new Date(event.end_at) >= now && event.status === 'PUBLISHED';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header */}
      <div className="page-header-row">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: '8px' }}>
            <ArrowLeft size={15} />
            <span>Back to Dashboard</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2 className="page-title">{event.name}</h2>
            {isActive ? (
              <span className="badge badge-success">
                <span className="badge-dot" />
                <span>LIVE ON PORTAL</span>
              </span>
            ) : (
              <span className="badge badge-secondary" style={{ backgroundColor: 'var(--bg-surface-raised)' }}>
                <span>COMPLETED</span>
              </span>
            )}
          </div>
        </div>

        {/* Quick action buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          {isActive && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('edit')}>
                <Edit3 size={15} />
                <span>Edit Event</span>
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => setShowCancelDialog(true)}>
                <XCircle size={15} />
                <span>Cancel Event</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Feedback Messages */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--danger-subtle)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--success-subtle)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Main Grid: Details + Sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Left Column: Event Profile & Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card: Primary Details */}
          <div className="card-box">
            <div className="card-box-header">
              <h3 className="card-box-title">Event Specifications</h3>
            </div>
            <div className="card-box-body">
              <div className="table-wrapper">
                <table className="modern-table">
                  <tbody>
                    <tr>
                      <td style={{ width: '160px', color: 'var(--text-dim)', fontWeight: 600 }}>Venue Location</td>
                      <td style={{ fontWeight: 600 }}>{event.venue_name}</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Start Schedule</td>
                      <td>{new Date(event.start_at).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>End Schedule</td>
                      <td>{new Date(event.end_at).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Registration Mode</td>
                      <td>
                        <span className="badge badge-info">{event.registration_mode}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Pricing</td>
                      <td>
                        <span className="badge badge-accent">
                          {event.pricing_type === 'FREE' ? 'FREE' : `₹${event.price_amount}`}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Format</td>
                      <td>{event.registration_format || 'Individual'}</td>
                    </tr>
                    <tr>
                      <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Capacity Limit</td>
                      <td>{event.capacity_limit ? `${event.capacity_limit} Participants` : 'Unlimited Open Admission'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Card: Description */}
          <div className="card-box">
            <div className="card-box-header">
              <h3 className="card-box-title">Event Description</h3>
            </div>
            <div className="card-box-body">
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                {event.description}
              </p>
            </div>
          </div>

          {/* Card: Content Sections */}
          {event.event_content_sections && event.event_content_sections.length > 0 && (
            <div className="card-box">
              <div className="card-box-header">
                <h3 className="card-box-title">Dynamic Content Sections</h3>
                <span className="badge badge-secondary">{event.event_content_sections.length} Sections</span>
              </div>
              <div className="card-box-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {event.event_content_sections.map((sec: any) => (
                  <div key={sec.id} style={{ padding: '16px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface-raised)', border: '1px solid var(--border-subtle)' }}>
                    <div className="font-heading" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                      {sec.title}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                      {typeof sec.content === 'string' ? sec.content : JSON.stringify(sec.content, null, 2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Telemetry & Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card: Canonical Event QR Code */}
          <EventQrCard eventId={event.id} eventName={event.name} />

          {/* Card: Live Telemetry */}
          <div className="card-box">
            <div className="card-box-header">
              <h3 className="card-box-title">Live Engagement</h3>
            </div>
            <div className="card-box-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Student Pageviews</span>
                <span className="font-heading" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-primary)' }}>
                  {(event.view_count || 0).toLocaleString()}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Total Capacity</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                  {event.capacity_limit || 'Open Access'}
                </span>
              </div>
            </div>
          </div>

          {/* Card: External Link */}
          {event.external_registration_url && (
            <div className="card-box">
              <div className="card-box-header">
                <h3 className="card-box-title">Registration Link</h3>
              </div>
              <div className="card-box-body">
                <a
                  href={event.external_registration_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ width: '100%', wordBreak: 'break-all', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <span>Open External Portal</span>
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      {showCancelDialog && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Cancel Event</h3>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.5, margin: 0 }}>
                This action will mark the event as CANCELLED and withdraw it from the live student portal feed.
              </p>
              <div className="form-group">
                <label htmlFor="cancelReason" className="form-label">
                  Reason for Cancellation *
                </label>
                <textarea
                  id="cancelReason"
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="e.g. Inclement weather, venue scheduling conflict..."
                  rows={3}
                  className="form-textarea"
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCancelDialog(false)}>
                Keep Event
              </button>
              <button className="btn btn-danger" onClick={handleCancel} disabled={cancelling}>
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
