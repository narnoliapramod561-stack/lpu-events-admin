'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SignOutButton } from '@/components/auth/sign-out-button';

interface Event {
  id: string;
  title: string;
  description: string;
  venue: string;
  starts_at: string;
  ends_at: string;
  status: string;
  organizer_id: string;
}

interface Inventory {
  total_tickets: number;
  available_tickets: number;
  reserved_tickets: number;
  sold_tickets: number;
  ticket_types: {
    name: string;
    price: number;
  } | null;
}

interface TicketRecord {
  id: string;
  ticket_number: string;
  status: string;
  profiles: {
    display_name: string | null;
    email: string | null;
  } | null;
  ticket_verifications: Array<{
    verified_at: string;
    status: string;
  }> | null;
}

export default function EventDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [event, setEvent] = useState<Event | null>(null);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setAuthError('You must be logged in to view this page.');
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      setUserRole(profile?.role || null);

      const { data: evt, error: evtErr } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .is('deleted_at', null)
        .single();

      if (evtErr || !evt) throw new Error('Event not found.');

      const isOwner = evt.organizer_id === user.id;
      const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';

      if (!isOwner && !isAdmin) {
        setAuthError('You do not have permission to view this event.');
        setLoading(false);
        return;
      }

      setEvent(evt);

      const { data: inv, error: invErr } = await supabase
        .from('event_inventory')
        .select(`
          total_tickets,
          available_tickets,
          reserved_tickets,
          sold_tickets,
          ticket_types!event_inventory_ticket_type_id_fk(name, price)
        `)
        .eq('event_id', eventId);

      if (invErr) throw invErr;
      setInventory(inv as any || []);

      const { data: tix, error: tixErr } = await supabase
        .from('tickets')
        .select(`
          id,
          ticket_number,
          status,
          profiles!tickets_user_id_fk(display_name, email),
          ticket_verifications!ticket_verifications_ticket_id_fk(verified_at, status)
        `)
        .eq('event_id', eventId);

      if (tixErr) throw tixErr;
      setTickets(tix as any || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load event data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      loadData();
    }
  }, [eventId, supabase]);

  // Handle CSV Export
  const exportCSV = () => {
    const headers = ['Ticket Number', 'Student Name', 'Email', 'Status', 'Verified At'];
    const rows = tickets.map(t => {
      const verifiedAt = t.ticket_verifications && t.ticket_verifications.length > 0
        ? new Date(t.ticket_verifications[0].verified_at).toLocaleString()
        : 'N/A';
      return [
        t.ticket_number,
        t.profiles?.display_name || 'N/A',
        t.profiles?.email || 'N/A',
        t.status,
        verifiedAt
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_event_${eventId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050507] text-[#e6e2dc] flex items-center justify-center p-6">
        <div className="text-center space-y-4 animate-pulse">
          <div className="w-10 h-10 rounded-full border-t-2 border-[#ff914d] mx-auto animate-spin" />
          <p className="text-sm text-white/40">Loading Dashboard Metrics...</p>
        </div>
      </main>
    );
  }

  if (authError || error || !event) {
    return (
      <main className="min-h-screen bg-[#050507] text-[#e6e2dc] flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <p className="text-rose-400 font-bold">{authError || error || 'An error occurred.'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-xs px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white transition hover:bg-white/10"
          >
            Go Back
          </button>
        </div>
      </main>
    );
  }

  // Calculate totals
  const totalCapacity = inventory.reduce((acc, curr) => acc + curr.total_tickets, 0);
  const totalSold = inventory.reduce((acc, curr) => acc + curr.sold_tickets, 0);
  const checkedInCount = tickets.filter(t => t.status === 'used').length;
  const progressPercent = totalSold > 0 ? Math.round((checkedInCount / totalSold) * 100) : 0;

  // Filter attendees list
  const filteredTickets = tickets.filter(t => {
    const term = searchTerm.toLowerCase();
    return (
      t.ticket_number.toLowerCase().includes(term) ||
      (t.profiles?.display_name || '').toLowerCase().includes(term) ||
      (t.profiles?.email || '').toLowerCase().includes(term)
    );
  });

  return (
    <main className="min-h-screen bg-[#050507] text-[#e6e2dc] p-6 relative overflow-hidden">
      {/* Background radial highlight */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[#ff914d]/2 blur-[140px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 z-10 relative">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full font-bold border ${
                event.status === 'published' ? 'bg-[#ff914d]/10 text-[#ff914d] border-[#ff914d]/20' : 'bg-white/10 text-white/40 border-white/5'
              }`}>
                {event.status}
              </span>
              <span className="text-xs text-white/40">Event ID: {event.id}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white font-display">
              {event.title}
            </h1>
            <p className="text-sm text-white/60">
              📍 {event.venue} · 📅 {new Date(event.starts_at).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-white font-semibold transition"
            >
              Back to Dashboard
            </button>
            <button
              onClick={exportCSV}
              className="px-4 py-2 rounded-xl bg-[#ff914d] hover:bg-[#e07530] text-xs text-[#050507] font-semibold transition"
            >
              Export CSV
            </button>
            <SignOutButton />
          </div>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl space-y-2">
            <span className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Capacity</span>
            <div className="text-3xl font-semibold text-white">{totalCapacity}</div>
            <span className="text-xs text-white/40">Total spots allocated</span>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl space-y-2">
            <span className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Tickets Sold</span>
            <div className="text-3xl font-semibold text-white">{totalSold}</div>
            <span className="text-xs text-white/40">{totalCapacity - totalSold} tickets remaining</span>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl space-y-2">
            <span className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Checked In</span>
            <div className="text-3xl font-semibold text-white">{checkedInCount}</div>
            <span className="text-xs text-white/40">{totalSold - checkedInCount} pending check-in</span>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl space-y-2">
            <span className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Attendance Rate</span>
            <div className="text-3xl font-semibold text-white">{progressPercent}%</div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-[#ff914d]" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>

        {/* Inventory distribution breakdown */}
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-4">
          <h3 className="text-lg font-bold text-white font-display">Inventory Distribution</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {inventory.map((inv, idx) => (
              <div key={idx} className="p-4 rounded-2xl border border-white/5 bg-white/2 space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <strong className="text-white">{inv.ticket_types?.name || 'Standard'}</strong>
                  <span className="text-[#ffb36b] font-bold">
                    {inv.ticket_types?.price === 0 ? 'Free' : `₹${inv.ticket_types?.price}`}
                  </span>
                </div>
                <div className="text-xs text-white/60 space-y-1">
                  <div className="flex justify-between"><span>Sold:</span><span>{inv.sold_tickets} / {inv.total_tickets}</span></div>
                  <div className="flex justify-between"><span>Reserved hold:</span><span>{inv.reserved_tickets}</span></div>
                  <div className="flex justify-between"><span>Available:</span><span>{inv.available_tickets}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Gate Scan & Attendees table */}
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h3 className="text-lg font-bold text-white font-display">Attendee Records</h3>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student name, email, or ticket number..."
              className="w-full sm:max-w-md bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
            />
          </div>

          <div className="overflow-x-auto border border-white/5 rounded-2xl">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-white/5 text-white/60 font-bold border-b border-white/5">
                  <th className="py-3 px-4">Ticket Number</th>
                  <th className="py-3 px-4">Attendee</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Verified At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80">
                {filteredTickets.length > 0 ? (
                  filteredTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-white/2 transition">
                      <td className="py-3 px-4 font-mono font-bold text-xs">{t.ticket_number}</td>
                      <td className="py-3 px-4 text-white font-medium">{t.profiles?.display_name || 'N/A'}</td>
                      <td className="py-3 px-4 text-white/60">{t.profiles?.email || 'N/A'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          t.status === 'used' ? 'bg-[#ff914d]/10 text-[#ff914d]' :
                          t.status === 'cancelled' ? 'bg-rose-500/10 text-rose-400' :
                          'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {t.status === 'used' ? 'checked-in' : t.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white/40">
                        {t.ticket_verifications && t.ticket_verifications.length > 0
                          ? new Date(t.ticket_verifications[0].verified_at).toLocaleTimeString()
                          : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-white/40">
                      No matching attendee records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}
