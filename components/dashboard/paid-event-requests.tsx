'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface PendingEvent {
  event_id: string;
  title: string;
  slug: string;
  description: string;
  short_description: string | null;
  cover_image_url: string | null;
  venue: string;
  venue_address: string | null;
  starts_at: string;
  ends_at: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  is_free: boolean;
  registration_mode: string;
  max_tickets: number | null;
  terms_and_conditions: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  event_created_at: string;
  submitted_for_approval_at: string;
  organizer_name: string;
  organizer_email: string;
  category_name: string | null;
  subcategory_name: string | null;
}

type ViewState = 'list' | 'review';

export function PaidEventRequests() {
  const supabase = createClient();
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState>('list');
  const [selectedEvent, setSelectedEvent] = useState<PendingEvent | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [ticketTiers, setTicketTiers] = useState<any[]>([]);

  useEffect(() => {
    fetchPendingEvents();
  }, []);

  async function fetchPendingEvents() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/events/pending');
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Failed to fetch pending events');
      }
      setEvents(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchTicketTiers(eventId: string) {
    try {
      const { data, error } = await supabase
        .from('ticket_types')
        .select('*')
        .eq('event_id', eventId);
      if (!error) {
        setTicketTiers(data || []);
      }
    } catch {
      setTicketTiers([]);
    }
  }

  function handleView(event: PendingEvent) {
    setSelectedEvent(event);
    setViewState('review');
    fetchTicketTiers(event.event_id);
  }

  function handleBack() {
    setViewState('list');
    setSelectedEvent(null);
    setShowApproveDialog(false);
    setShowRejectDialog(false);
    setRejectionReason('');
    setActionError(null);
    setSuccessMessage(null);
  }

  async function handleApprove() {
    if (!selectedEvent) return;
    setProcessingId(selectedEvent.event_id);
    setActionError(null);
    try {
      const response = await fetch('/api/admin/events/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEvent.event_id,
          action: 'approve',
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Failed to approve event');
      }
      setSuccessMessage('Event approved and published successfully!');
      setShowApproveDialog(false);
      setTimeout(() => {
        handleBack();
        fetchPendingEvents();
      }, 1500);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject() {
    if (!selectedEvent || !rejectionReason.trim()) return;
    setProcessingId(selectedEvent.event_id);
    setActionError(null);
    try {
      const response = await fetch('/api/admin/events/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEvent.event_id,
          action: 'reject',
          rejectionReason: rejectionReason.trim(),
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Failed to reject event');
      }
      setSuccessMessage('Event rejected successfully.');
      setShowRejectDialog(false);
      setTimeout(() => {
        handleBack();
        fetchPendingEvents();
      }, 1500);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setProcessingId(null);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatDateTime(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Review view
  if (viewState === 'review' && selectedEvent) {
    const event = selectedEvent;
    return (
      <div className="space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <button
              onClick={handleBack}
              className="text-xs text-white/60 hover:text-[#ff914d] transition-colors flex items-center gap-1 mb-2"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to requests
            </button>
            <h1 className="text-2xl font-bold text-white font-display">{event.title}</h1>
            <p className="text-sm text-white/60 mt-1">Review event details before approving or rejecting.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setShowRejectDialog(true); setActionError(null); }}
              disabled={processingId === event.event_id}
              className="px-5 py-2.5 rounded-xl border border-rose-500/30 text-rose-400 text-sm font-semibold hover:bg-rose-500/10 transition-all disabled:opacity-50"
            >
              Reject Event
            </button>
            <button
              onClick={() => { setShowApproveDialog(true); setActionError(null); }}
              disabled={processingId === event.event_id}
              className="px-5 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/30 transition-all disabled:opacity-50"
            >
              Approve Event
            </button>
          </div>
        </header>

        {successMessage && (
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm">
            {successMessage}
          </div>
        )}

        {/* Event Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Poster */}
            {event.cover_image_url && (
              <div className="rounded-2xl overflow-hidden border border-white/10">
                <img
                  src={event.cover_image_url}
                  alt={event.title}
                  className="w-full h-64 object-cover"
                />
              </div>
            )}

            {/* Basic Details */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <h2 className="text-lg font-bold text-white font-display mb-4">Basic Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#ffb36b] font-bold">Category</label>
                  <p className="text-sm text-white/80 mt-1">{event.category_name || '—'}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#ffb36b] font-bold">Subcategory</label>
                  <p className="text-sm text-white/80 mt-1">{event.subcategory_name || '—'}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#ffb36b] font-bold">Venue</label>
                  <p className="text-sm text-white/80 mt-1">{event.venue}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#ffb36b] font-bold">Venue Address</label>
                  <p className="text-sm text-white/80 mt-1">{event.venue_address || '—'}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#ffb36b] font-bold">Start Date</label>
                  <p className="text-sm text-white/80 mt-1">{formatDateTime(event.starts_at)}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#ffb36b] font-bold">End Date</label>
                  <p className="text-sm text-white/80 mt-1">{formatDateTime(event.ends_at)}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <h2 className="text-lg font-bold text-white font-display mb-4">Description</h2>
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{event.description}</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Organizer Info */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <h2 className="text-lg font-bold text-white font-display mb-4">Organizer</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#ffb36b] font-bold">Name</label>
                  <p className="text-sm text-white/80 mt-1">{event.organizer_name}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#ffb36b] font-bold">Email</label>
                  <p className="text-sm text-white/80 mt-1">{event.organizer_email}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#ffb36b] font-bold">Submitted</label>
                  <p className="text-sm text-white/80 mt-1">{formatDateTime(event.submitted_for_approval_at)}</p>
                </div>
              </div>
            </div>

            {/* Registration & Pricing */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
              <h2 className="text-lg font-bold text-white font-display mb-4">Registration & Pricing</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#ffb36b] font-bold">Registration Mode</label>
                  <p className="text-sm text-white/80 mt-1 capitalize">{event.registration_mode}</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-[#ffb36b] font-bold">Max Tickets</label>
                  <p className="text-sm text-white/80 mt-1">{event.max_tickets || 'Unlimited'}</p>
                </div>
                {ticketTiers.length > 0 && (
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-[#ffb36b] font-bold">Ticket Tiers</label>
                    <div className="mt-1 space-y-2">
                      {ticketTiers.map((tier: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-white/5">
                          <div>
                            <p className="text-xs text-white font-medium">{tier.name}</p>
                            {tier.description && (
                              <p className="text-[10px] text-white/50">{tier.description}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-[#ff914d]">₹{tier.price}</p>
                            <p className="text-[10px] text-white/50">{tier.total_tickets} tickets</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {event.contact_email && (
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-[#ffb36b] font-bold">Contact Email</label>
                    <p className="text-sm text-white/80 mt-1">{event.contact_email}</p>
                  </div>
                )}
                {event.contact_phone && (
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-[#ffb36b] font-bold">Contact Phone</label>
                    <p className="text-sm text-white/80 mt-1">{event.contact_phone}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Schedule */}
            {(event.registration_opens_at || event.registration_closes_at) && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <h2 className="text-lg font-bold text-white font-display mb-4">Schedule</h2>
                <div className="space-y-3">
                  {event.registration_opens_at && (
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-[#ffb36b] font-bold">Registration Opens</label>
                      <p className="text-sm text-white/80 mt-1">{formatDateTime(event.registration_opens_at)}</p>
                    </div>
                  )}
                  {event.registration_closes_at && (
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-[#ffb36b] font-bold">Registration Closes</label>
                      <p className="text-sm text-white/80 mt-1">{formatDateTime(event.registration_closes_at)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <button
            onClick={() => { setShowRejectDialog(true); setActionError(null); }}
            disabled={processingId === event.event_id}
            className="px-5 py-2.5 rounded-xl border border-rose-500/30 text-rose-400 text-sm font-semibold hover:bg-rose-500/10 transition-all disabled:opacity-50"
          >
            Reject Event
          </button>
          <button
            onClick={() => { setShowApproveDialog(true); setActionError(null); }}
            disabled={processingId === event.event_id}
            className="px-5 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/30 transition-all disabled:opacity-50"
          >
            Approve Event
          </button>
        </div>

        {/* Approve Dialog */}
        {showApproveDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white font-display mb-2">Approve this paid event?</h3>
              <p className="text-sm text-white/60 mb-6">
                The event will be published and visible on the student website immediately.
              </p>
              {actionError && (
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-sm mb-4">
                  {actionError}
                </div>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => { setShowApproveDialog(false); setActionError(null); }}
                  className="px-4 py-2 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={processingId === event.event_id}
                  className="px-5 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                >
                  {processingId === event.event_id ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Dialog */}
        {showRejectDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white font-display mb-2">Reject Event</h3>
              <p className="text-sm text-white/60 mb-4">
                Provide a reason for rejection. This will be shared with the organizer.
              </p>
              <div className="space-y-2 mb-4">
                <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold">Reason *</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Venue details are incomplete."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all min-h-[100px] resize-y"
                />
              </div>
              {actionError && (
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-sm mb-4">
                  {actionError}
                </div>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => { setShowRejectDialog(false); setActionError(null); }}
                  className="px-4 py-2 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={processingId === event.event_id || !rejectionReason.trim()}
                  className="px-5 py-2 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 text-sm font-semibold hover:bg-rose-500/30 transition-all disabled:opacity-50"
                >
                  {processingId === event.event_id ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm uppercase tracking-[0.24em] text-[#ffb36b]">Super Admin</p>
        <h1 className="mt-2 text-2xl font-bold text-white font-display">Paid Event Requests</h1>
        <p className="text-sm text-white/60 mt-1">
          Review and approve/reject paid events submitted by organizers.
        </p>
      </header>

      {error && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#ff914d] border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-5xl text-white/20 mb-4">check_circle</span>
            <h3 className="text-lg font-bold text-white font-display mb-2">No Pending Requests</h3>
            <p className="text-sm text-white/60">
              All paid event requests have been reviewed.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.event_id}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl hover:bg-white/10 transition-all"
            >
              <div className="flex items-start gap-4">
                {/* Event Poster */}
                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-white/10">
                  {event.cover_image_url ? (
                    <img
                      src={event.cover_image_url}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-white/30">event</span>
                    </div>
                  )}
                </div>

                {/* Event Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-white truncate">{event.title}</h3>
                      <p className="text-xs text-white/60 mt-0.5">
                        by {event.organizer_name} • {event.category_name || 'Uncategorized'}
                      </p>
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-semibold">
                      Pending
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-white/50">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">location_on</span>
                      {event.venue}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                      {formatDate(event.starts_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      Submitted {formatDate(event.submitted_for_approval_at)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleView(event)}
                    className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-all"
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}