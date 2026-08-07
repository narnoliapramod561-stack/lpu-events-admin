'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Event {
  id: string;
  title: string;
  cover_image_url: string | null;
  venue: string;
  starts_at: string;
  ends_at: string;
  status: string;
  organizer_id: string;
}

interface Ticket {
  id: string;
  ticket_number: string;
  qr_token: string;
  status: 'valid' | 'used' | 'cancelled' | 'expired';
  used_at: string | null;
  manual_override: boolean;
  override_reason: string | null;
  profiles: {
    id: string;
    full_name: string | null;
    email: string;
    registration_number: string | null;
    department: string | null;
    avatar_url: string | null;
  } | null;
  registrations: {
    id: string;
    ticket_types: {
      name: string;
      price: number;
    } | null;
  } | null;
  ticket_verifications: Array<{
    id: string;
    verified_at: string;
    status: string;
    method: 'qr_scan' | 'manual_lookup';
    notes: string | null;
    verified_by: string;
    profiles: {
      full_name: string | null;
      email: string;
    } | null;
  }> | null;
}

export function Attendees({ initialEventId = null }: { initialEventId?: string | null }) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEventId);
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Table view search & filter state variables
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('Checked In'); // Default to showing only checked in (scanned)
  const [selectedAttendee, setSelectedAttendee] = useState<Ticket | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [manualTicketNum, setManualTicketNum] = useState('');

  // QR Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ status: string; message: string; ticket_id?: string; used_at?: string } | null>(null);

  // Manual Override state (for super admins)
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideTicketNum, setOverrideTicketNum] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  // Metrics for all events
  const [allEventMetrics, setAllEventMetrics] = useState<Record<string, { total: number; checkedIn: number; remaining: number }>>({});

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          setLoadingEvents(false);
          return;
        }
        setCurrentUser(user);

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        const role = profile?.role || 'student';
        setCurrentUserRole(role);

        let query = supabase.from('events').select('*').is('deleted_at', null);
        if (role === 'organizer') {
          query = query.eq('organizer_id', user.id);
        }
        const { data: eventsData } = await query;
        setEvents(eventsData || []);

        // Fetch ticket counts for all events
        const { data: ticketsCountData } = await supabase
          .from('tickets')
          .select('event_id, status');

        const counts: Record<string, { total: number; checkedIn: number; remaining: number }> = {};
        (ticketsCountData || []).forEach((t: any) => {
          if (!counts[t.event_id]) {
            counts[t.event_id] = { total: 0, checkedIn: 0, remaining: 0 };
          }
          counts[t.event_id].total += 1;
          if (t.status === 'used') {
            counts[t.event_id].checkedIn += 1;
          } else {
            counts[t.event_id].remaining += 1;
          }
        });
        setAllEventMetrics(counts);
      } catch (err) {
        console.error('Init error:', err);
      } finally {
        setLoadingEvents(false);
      }
    }
    init();
  }, []);

  const refreshTickets = useCallback(async () => {
    if (!selectedEventId) return;
    const supabase = createClient();
    try {
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select(`
          id,
          ticket_number,
          qr_token,
          status,
          used_at,
          manual_override,
          override_reason,
          profiles!tickets_user_id_fk (
            id,
            full_name,
            email,
            registration_number,
            department,
            avatar_url
          ),
          registrations!tickets_registration_id_fk (
            id,
            ticket_types!registrations_ticket_type_id_fk (
              name,
              price
            )
          ),
          ticket_verifications!ticket_verifications_ticket_id_fk (
            id,
            verified_at,
            status,
            method,
            notes,
            verified_by,
            profiles!ticket_verifications_verified_by_fk (
              full_name,
              email
            )
          )
        `)
        .eq('event_id', selectedEventId);

      if (ticketsData) {
        const normalized = (ticketsData || []).map((t: any) => {
          if (t.ticket_verifications) {
            t.ticket_verifications.sort((a: any, b: any) =>
              new Date(b.verified_at).getTime() - new Date(a.verified_at).getTime()
            );
          }
          return t;
        }) as Ticket[];
        setTickets(normalized);

        // Update selectedAttendee if it was open
        if (selectedAttendee) {
          const updated = normalized.find((t) => t.id === selectedAttendee.id);
          if (updated) {
            setSelectedAttendee(updated);
          }
        }

        // Update allEventMetrics for this event
        const total = normalized.length;
        const checkedIn = normalized.filter((t) => t.status === 'used').length;
        const remaining = total - checkedIn;
        setAllEventMetrics((prev) => ({
          ...prev,
          [selectedEventId]: { total, checkedIn, remaining }
        }));
      }
    } catch (err) {
      console.error('Refresh error:', err);
    }
  }, [selectedEventId, selectedAttendee]);

  useEffect(() => {
    if (!selectedEventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTickets([]);
      return;
    }
    setLoadingTickets(true);
    refreshTickets().finally(() => setLoadingTickets(false));
  }, [selectedEventId, refreshTickets]);

  const startScanner = async () => {
    setIsScanning(true);
    setScanResult(null);

    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const html5QrCode = new Html5Qrcode('qr-reader');
        (window as any).html5QrCode = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            }
          },
          async (decodedText) => {
            try {
              if (html5QrCode.isScanning) {
                await html5QrCode.stop();
              }
            } catch (err) {
              console.error('Failed to stop scanner on scan:', err);
            }
            (window as any).html5QrCode = null;

            try {
              const supabase = createClient();
              const { data, error } = await supabase.rpc('verify_ticket', {
                p_token_or_number: decodedText,
                p_method: 'qr_scan',
                p_verifier_id: currentUser.id
              });

              if (error) {
                setScanResult({
                  status: 'error',
                  message: error.message
                });
                return;
              }

              const result = data as any;
              setScanResult(result);
              await refreshTickets();
            } catch (err) {
              console.error(err);
              setScanResult({
                status: 'error',
                message: 'An error occurred during QR verification.'
              });
            }
          },
          () => {}
        );
      } catch (err) {
        console.error('Failed to start scanner:', err);
        alert('Could not access camera. Please ensure permissions are granted.');
        setIsScanning(false);
      }
    }, 100);
  };

  const stopScanner = async () => {
    const html5QrCode = (window as any).html5QrCode;
    if (html5QrCode) {
      try {
        if (html5QrCode.isScanning) {
          await html5QrCode.stop();
        }
      } catch (err) {
        console.error('Failed to stop scanner:', err);
      }
      (window as any).html5QrCode = null;
    }
    setIsScanning(false);
    setScanResult(null);
  };

  const handleManualCheckIn = async () => {
    if (!manualTicketNum.trim()) return;
    const cleanNum = manualTicketNum.trim().toUpperCase();
    const supabase = createClient();

    try {
      const { data, error } = await supabase.rpc('verify_ticket', {
        p_token_or_number: cleanNum,
        p_method: 'manual_lookup',
        p_verifier_id: currentUser.id
      });

      if (error) {
        alert(`Verification failed: ${error.message}`);
        return;
      }

      const result = data as any;
      if (result.status === 'success') {
        alert(`Attendee checked in successfully!`);
        setManualTicketNum('');
        await refreshTickets();
      } else if (result.status === 'already_used') {
        alert(`Ticket has already been used.`);
      } else if (result.status === 'expired' || result.status === 'invalid') {
        if (currentUserRole === 'super_admin') {
          if (confirm(`Ticket is ${result.status} (${result.message || ''}). Do you want to perform a manual check-in override?`)) {
            setOverrideTicketNum(cleanNum);
            setOverrideReason('');
            setShowOverrideModal(true);
          }
        } else {
          alert(`Cannot check in: Ticket is ${result.status}.`);
        }
      } else {
        alert(`Verification result: ${result.status} - ${result.message || ''}`);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred during verification.');
    }
  };

  const handleOverrideCheckIn = async () => {
    if (!overrideReason.trim()) {
      alert('An override reason is required.');
      return;
    }
    const supabase = createClient();

    try {
      const { data, error } = await supabase.rpc('verify_ticket_manual', {
        p_ticket_number: overrideTicketNum,
        p_verifier_id: currentUser.id,
        p_override_reason: overrideReason.trim()
      });

      if (error) {
        alert(`Override failed: ${error.message}`);
        return;
      }

      const result = data as any;
      if (result.status === 'success') {
        alert(`Manual override check-in successful!`);
        setShowOverrideModal(false);
        setOverrideReason('');
        setManualTicketNum('');
        await refreshTickets();
      } else {
        alert(`Override result: ${result.status} - ${result.message || ''}`);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred during manual override.');
    }
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d
      .toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      .replace(',', '');
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchesSearch =
        (t.profiles?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.profiles?.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.profiles?.department || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        selectedStatus === 'All' ||
        (selectedStatus === 'Checked In' && t.status === 'used') ||
        (selectedStatus === 'Registered' && t.status === 'valid');

      return matchesSearch && matchesStatus;
    });
  }, [tickets, searchQuery, selectedStatus]);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage) || 1;
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTickets.slice(start, start + itemsPerPage);
  }, [filteredTickets, currentPage, itemsPerPage]);

  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  const selectedEventMetrics = useMemo(() => {
    if (!selectedEventId) return { total: 0, checkedIn: 0, remaining: 0 };
    return allEventMetrics[selectedEventId] || { total: 0, checkedIn: 0, remaining: 0 };
  }, [allEventMetrics, selectedEventId]);

  const exportCSV = () => {
    if (!selectedEvent) return;
    const headers = ['Ticket Number', 'Student Name', 'Email', 'Status', 'Verified At'];
    const rows = tickets.map((t) => {
      const verifiedAt = t.ticket_verifications && t.ticket_verifications.length > 0
        ? new Date(t.ticket_verifications[0].verified_at).toLocaleString()
        : 'N/A';
      return [
        t.ticket_number,
        t.profiles?.full_name || 'N/A',
        t.profiles?.email || 'N/A',
        t.status === 'used' ? 'Checked In' : t.status,
        verifiedAt
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_${selectedEvent.title.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loadingEvents) {
    return (
      <div className="flex-1 w-full mx-auto flex flex-col items-center justify-center py-32">
        <div className="w-10 h-10 rounded-full border-t-2 border-[#ff914d] animate-spin mb-4" />
        <p className="text-sm text-white/40">Loading events...</p>
      </div>
    );
  }

  if (selectedEventId === null) {
    return (
      <div className="flex-1 w-full mx-auto flex flex-col gap-8 pb-16 animate-fadeIn">
        <div className="mb-4">
          <h2 className="font-display text-[32px] font-semibold text-[#ffba93] tracking-tight">
            Attendees
          </h2>
          <p className="font-body-lg text-white/60 mt-2 max-w-2xl text-lg">
            Select an event to manage attendees and check-ins.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          {events.length === 0 ? (
            <div className="text-center py-12 text-white/40">
              <span className="material-symbols-outlined text-4xl mb-2 block">calendar_today</span>
              No events found.
            </div>
          ) : (
            events.map((evt) => {
              const metrics = allEventMetrics[evt.id] || { total: 0, checkedIn: 0, remaining: 0 };
              return (
                <div key={evt.id} className="bg-white/5 border border-white/10 rounded-[20px] overflow-hidden flex flex-col xl:flex-row transition-all duration-300 hover:border-white/20">
                  <div className="xl:w-2/5 h-64 xl:h-auto relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050507] to-transparent opacity-60 z-10"></div>
                    {evt.cover_image_url ? (
                      <img
                        alt={`${evt.title} Poster`}
                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                        src={evt.cover_image_url}
                      />
                    ) : (
                      <div className="w-full h-full bg-white/5 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-white/20">image</span>
                      </div>
                    )}
                    <div className="absolute top-4 left-4 z-20 flex gap-2">
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wider uppercase backdrop-blur-md flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        {evt.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 p-8 flex flex-col justify-between gap-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-display text-2xl font-bold text-white mb-2">
                          {evt.title}
                        </h3>
                        <div className="flex flex-wrap gap-y-2 gap-x-4 text-xs text-white/60">
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-[#ff914d]">
                              location_on
                            </span>
                            {evt.venue}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-[#ff914d]">
                              calendar_today
                            </span>
                            {formatDate(evt.starts_at)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                            Total Sold
                          </span>
                          <div className="text-xl font-bold text-white">{metrics.total}</div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                            Checked In
                          </span>
                          <div className="text-xl font-bold text-[#ff914d]">{metrics.checkedIn}</div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                            Remaining
                          </span>
                          <div className="text-xl font-bold text-white/60">{metrics.remaining}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => setSelectedEventId(evt.id)}
                        className="bg-[#ff914d] text-[#050507] hover:bg-[#e07530] font-bold transition-all px-6 py-3 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-2"
                      >
                        Manage Attendees
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full mx-auto flex flex-col pb-32 animate-fadeIn">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2 flex items-center gap-2 select-none">
            <span
              className="hover:text-white cursor-pointer transition-colors"
              onClick={() => setSelectedEventId(null)}
            >
              Attendees
            </span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span className="text-[#ff914d]">{selectedEvent?.title}</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight font-display">
            Event Attendees
          </h1>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-6 mb-8 transition-colors duration-300">
        <div className="w-full md:w-48 h-32 rounded-lg overflow-hidden shrink-0 border border-white/10 relative">
          {selectedEvent?.cover_image_url ? (
            <img
              className="w-full h-full object-cover"
              src={selectedEvent.cover_image_url}
              alt={selectedEvent.title}
            />
          ) : (
            <div className="w-full h-full bg-white/5 flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-white/20">image</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        </div>
        <div className="flex-1 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 w-full">
          <div>
            <h2 className="text-xl font-bold text-white font-display mb-2">
              {selectedEvent?.title}
            </h2>
            <div className="flex flex-wrap gap-y-1 gap-x-4 text-xs text-white/60">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-[#ff914d]">location_on</span>
                {selectedEvent?.venue}
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-[#ff914d]">calendar_today</span>
                {selectedEvent && formatDate(selectedEvent.starts_at)}
              </span>
            </div>
          </div>

          <div className="flex gap-8 border-l border-white/10 pl-6">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold block mb-1">
                Total Sold
              </span>
              <span className="text-2xl font-bold text-white">{selectedEventMetrics.total}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold block mb-1">
                Checked In
              </span>
              <span className="text-2xl font-bold text-[#ff914d]">{selectedEventMetrics.checkedIn}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold block mb-1">
                Attendance Rate
              </span>
              <span className="text-2xl font-bold text-white">
                {selectedEventMetrics.total > 0 ? Math.round((selectedEventMetrics.checkedIn / selectedEventMetrics.total) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8 flex flex-col md:flex-row items-stretch justify-between gap-8">
        <div className="flex-1 flex flex-col justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[#ffba93] font-display mb-1">
              Scan Entry Pass
            </h4>
            <p className="text-xs text-white/40">
              Scan attendee QR pass using your device camera for instant entry.
            </p>
          </div>
          <button
            onClick={startScanner}
            className="w-full bg-[#ff914d] hover:bg-[#e07530] text-[#050507] rounded-xl py-4 font-bold flex items-center justify-center gap-3 transition-colors text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(255,145,77,0.15)] active:scale-95 duration-200"
          >
            <span className="material-symbols-outlined text-[22px]">qr_code_scanner</span>
            Scan QR Code
          </button>
        </div>

        <div className="hidden md:block w-px bg-white/10 self-stretch" />

        <div className="flex-1 flex flex-col justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[#ffba93] font-display mb-1">
              Manual Verification
            </h4>
            <p className="text-xs text-white/40">
              Enter the unique booking ID printed on the student pass to check in.
            </p>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
              local_activity
            </span>
            <input
              type="text"
              placeholder="Enter Ticket No. (e.g. EVT-26-7B8X)"
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3.5 pl-12 pr-24 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#ff914d] focus:ring-1 focus:ring-[#ff914d]/20 transition-all font-mono"
              value={manualTicketNum}
              onChange={(e) => setManualTicketNum(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleManualCheckIn();
              }}
            />
            <button
              onClick={handleManualCheckIn}
              className="absolute right-2 top-1.5 bg-white/15 hover:bg-white/20 border border-white/5 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-all"
            >
              Verify
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 mb-6 px-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold text-white font-display">Attendee List</h3>

          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 select-none w-full sm:w-auto">
            <button
              onClick={() => setSelectedStatus('Checked In')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedStatus === 'Checked In'
                  ? 'bg-[#ff914d] text-[#050507]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Checked In
            </button>
            <button
              onClick={() => setSelectedStatus('Registered')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedStatus === 'Registered'
                  ? 'bg-[#ff914d] text-[#050507]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Not Checked In
            </button>
            <button
              onClick={() => setSelectedStatus('All')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedStatus === 'All'
                  ? 'bg-[#ff914d] text-[#050507]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              All
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={exportCSV}
            className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl px-4 py-2 text-xs font-semibold transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">table_view</span>
            Export CSV
          </button>

          <button
            onClick={() => alert('Downloading attendee list as PDF document...')}
            className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl px-4 py-2 text-xs font-semibold transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Download PDF
          </button>

          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by name, email, department..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#ff914d] transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-[20px] overflow-hidden backdrop-blur-2xl">
        <div className="overflow-x-auto scrollbar-none">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-white/50 text-xs font-semibold uppercase tracking-wider bg-white/2">
                <th className="py-4 px-6">Name</th>
                <th className="py-4 px-6">Email</th>
                <th className="py-4 px-6">Department</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-white/80">
              {loadingTickets ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-white/40">
                    <div className="w-8 h-8 rounded-full border-t-2 border-[#ff914d] mx-auto animate-spin mb-2" />
                    Loading attendees...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-white/40">
                    <span className="material-symbols-outlined text-4xl mb-2 block">group_off</span>
                    No attendees match this filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedTickets.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-white/2 transition-colors cursor-pointer"
                    onClick={() => setSelectedAttendee(t)}
                  >
                    <td className="py-4 px-6">
                      <span className="font-semibold text-white">{t.profiles?.full_name || 'N/A'}</span>
                    </td>

                    <td className="py-4 px-6">
                      <span className="text-white/60">{t.profiles?.email || 'N/A'}</span>
                    </td>

                    <td className="py-4 px-6">
                      <span className="text-white/60">{t.profiles?.department || 'N/A'}</span>
                    </td>

                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          t.status === 'used'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : t.status === 'cancelled'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : t.status === 'expired'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-white/5 text-white/50 border border-white/10'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${t.status === 'used' ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`}
                        ></span>
                        {t.status === 'used' ? 'Checked In' : t.status === 'valid' ? 'Not Checked In' : t.status}
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedAttendee(t)}
                        className="bg-transparent border border-white/10 hover:border-white/20 text-white rounded-lg px-4 py-1.5 text-xs font-semibold transition-all whitespace-nowrap"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8 select-none">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            className="bg-transparent border border-white/10 hover:border-white/20 text-white w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-40 transition-colors"
            disabled={currentPage === 1}
          >
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm transition-all ${
                currentPage === page
                  ? 'bg-[#ff914d] text-[#050507]'
                  : 'bg-transparent border border-white/10 hover:border-white/20 text-white'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            className="bg-transparent border border-white/10 hover:border-white/20 text-white w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-40 transition-colors"
            disabled={currentPage === totalPages}
          >
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
        </div>
      )}

      {selectedAttendee && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#050507]/80 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setSelectedAttendee(null)}
        >
          <div
            className="w-full max-w-md h-full bg-[#0a0a0c] border-l border-white/10 shadow-2xl flex flex-col justify-between animate-slideIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#050507]/50 backdrop-blur-md">
              <h2 className="text-xl font-bold text-white font-display">Attendee Details</h2>
              <button
                onClick={() => setSelectedAttendee(null)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 scrollbar-none">
              <div className="flex flex-col items-center text-center gap-3">
                {selectedAttendee.profiles?.avatar_url ? (
                  <img
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#ff914d]/20"
                    src={selectedAttendee.profiles.avatar_url}
                    alt={selectedAttendee.profiles.full_name || 'Avatar'}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white/40 text-4xl">person</span>
                  </div>
                )}
                <div>
                  <h3 className="text-2xl font-bold text-white font-display">
                    {selectedAttendee.profiles?.full_name || 'N/A'}
                  </h3>
                  <p className="text-xs text-white/40 mt-0.5">
                    {selectedAttendee.registrations?.ticket_types?.name || 'Standard Ticket'}
                  </p>
                </div>
              </div>

              <div className="bg-white/2 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center pb-3 border-b border-white/5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-white/40 font-display">
                    Status
                  </div>
                  <span
                    className={`px-2.5 py-0.5 bg-[#ff914d]/10 border border-[#ff914d]/25 text-[#ffba93] rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${selectedAttendee.status === 'used' ? 'bg-[#ff914d] animate-pulse' : 'bg-white/40'}`}
                    ></span>
                    {selectedAttendee.status === 'used' ? 'Checked In' : selectedAttendee.status === 'valid' ? 'Not Checked In' : selectedAttendee.status}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-white/40 mb-1">Attendee Name</div>
                    <div className="font-semibold text-white">{selectedAttendee.profiles?.full_name || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/40 mb-1">Email Address</div>
                    <div className="font-semibold text-white">{selectedAttendee.profiles?.email || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/40 mb-1">Registration Number</div>
                    <div className="font-semibold text-white">{selectedAttendee.profiles?.registration_number || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/40 mb-1">Department</div>
                    <div className="font-semibold text-white">{selectedAttendee.profiles?.department || 'N/A'}</div>
                  </div>
                  {selectedAttendee.status === 'used' && selectedAttendee.used_at && (
                    <div>
                      <div className="text-xs text-white/40 mb-1">Check-in Time</div>
                      <div className="font-semibold text-[#ff914d]">
                        {formatDate(selectedAttendee.used_at)}
                      </div>
                    </div>
                  )}
                  {selectedAttendee.manual_override && (
                    <div>
                      <div className="text-xs text-white/40 mb-1">Manual Override Reason</div>
                      <div className="font-semibold text-amber-400 italic">
                        {selectedAttendee.override_reason || 'N/A'}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-white/5 space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-white/60">
                    Verification History
                  </h5>
                  {selectedAttendee.ticket_verifications && selectedAttendee.ticket_verifications.length > 0 ? (
                    <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                      {selectedAttendee.ticket_verifications.map((v) => (
                        <div key={v.id} className="p-3 rounded-xl bg-white/2 border border-white/5 text-xs space-y-1">
                          <div className="flex justify-between items-center">
                            <span className={`font-bold uppercase tracking-wider ${
                              v.status === 'success' ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {v.status}
                            </span>
                            <span className="text-white/40">{formatDate(v.verified_at)}</span>
                          </div>
                          <div className="text-white/60">
                            Method: <span className="font-semibold text-white">{v.method === 'qr_scan' ? 'QR Scan' : 'Manual Lookup'}</span>
                          </div>
                          <div className="text-white/60">
                            Verifier: <span className="font-semibold text-white">{v.profiles?.full_name || v.profiles?.email || v.verified_by}</span>
                          </div>
                          {v.notes && (
                            <div className="text-white/40 italic mt-1">
                              Note: {v.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-white/40 italic">
                      No verification attempts recorded.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/10 bg-[#050507]/50 backdrop-blur-md flex flex-col gap-3">
              {selectedAttendee.status === 'valid' ? (
                <button
                  onClick={() => handleManualCheckIn()}
                  className="w-full bg-[#ff914d] hover:bg-[#e07530] text-[#050507] rounded-lg py-3 font-semibold flex items-center justify-center gap-2 transition-colors text-sm"
                >
                  <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
                  Mark as Checked In
                </button>
              ) : (
                <button
                  onClick={() => alert('Undo check-in is not supported by the database schema.')}
                  className="w-full border border-white/10 hover:border-white/20 text-white rounded-lg py-3 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">undo</span>
                  Undo Check-in
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isScanning && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-[#0d0d11] border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl relative">
            <button
              onClick={stopScanner}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-white font-display">Scan Entry Pass</h3>
              <p className="text-xs text-white/40">
                Position the attendee&apos;s QR code within the scanner frame.
              </p>
            </div>

            {!scanResult ? (
              <div className="relative aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-2xl border border-white/10 bg-black flex items-center justify-center">
                <div id="qr-reader" className="w-full h-full" />
                <div className="absolute inset-0 border-2 border-[#ff914d]/30 pointer-events-none rounded-2xl">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#ff914d]" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#ff914d]" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#ff914d]" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#ff914d]" />
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-white/2 border border-white/5 text-center space-y-4">
                {scanResult.status === 'success' ? (
                  <>
                    <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                      <span className="material-symbols-outlined text-3xl">check_circle</span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-lg font-bold text-white">Verification Successful</h4>
                      <p className="text-xs text-white/40">Attendee checked in successfully.</p>
                    </div>
                  </>
                ) : scanResult.status === 'already_used' ? (
                  <>
                    <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto text-amber-400">
                      <span className="material-symbols-outlined text-3xl">warning</span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-lg font-bold text-white">Already Checked In</h4>
                      <p className="text-xs text-white/40">
                        This ticket was already verified at {scanResult.used_at ? formatDate(scanResult.used_at) : 'N/A'}.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-400">
                      <span className="material-symbols-outlined text-3xl">cancel</span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-lg font-bold text-white">Verification Failed</h4>
                      <p className="text-xs text-rose-400 font-semibold">{scanResult.message || 'Invalid Ticket'}</p>
                    </div>
                  </>
                )}

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={startScanner}
                    className="flex-1 bg-[#ff914d] hover:bg-[#e07530] text-[#050507] font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-colors"
                  >
                    Scan Next
                  </button>
                  <button
                    onClick={stopScanner}
                    className="flex-1 bg-white/10 hover:bg-white/15 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-[#0d0d11] border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowOverrideModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-white font-display">Manual Check-In Override</h3>
              <p className="text-xs text-white/40">
                Super Admin authorization required. Please provide a reason for overriding the ticket status.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider font-semibold block mb-2">
                  Ticket Number
                </label>
                <input
                  type="text"
                  disabled
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white/60 font-mono"
                  value={overrideTicketNum}
                />
              </div>

              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider font-semibold block mb-2">
                  Override Reason
                </label>
                <textarea
                  placeholder="Enter the reason for manual check-in override (e.g., Student lost physical pass, system error)..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#ff914d] transition-all h-24 resize-none"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={handleOverrideCheckIn}
                  className="flex-1 bg-[#ff914d] hover:bg-[#e07530] text-[#050507] font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-colors"
                >
                  Confirm Override
                </button>
                <button
                  onClick={() => setShowOverrideModal(false)}
                  className="flex-1 bg-white/10 hover:bg-white/15 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
