'use client';

import { useState, useMemo } from 'react';

interface Attendee {
  id: string;
  name: string;
  email: string;
  rollNumber: string;
  department: string;
  event: string;
  ticketNumber: string;
  tier: 'VIP Pass' | 'General Ticket' | 'Early Bird';
  status: 'Checked In' | 'Registered' | 'Cancelled';
  regState: 'Confirmed' | 'Pending Payment';
  registeredAt: string;
  checkedInAt?: string;
  scanLocation?: string;
  paymentId: string;
  price: string;
  avatarUrl: string;
}

const INITIAL_ATTENDEES: Attendee[] = [
  {
    id: '1',
    name: 'Aria Chen',
    email: 'aria.chen@university.edu',
    rollNumber: '12018492',
    department: 'Computer Science',
    event: 'AI Symposium 2026',
    ticketNumber: 'EVT-26-9A4F',
    tier: 'General Ticket',
    status: 'Checked In',
    regState: 'Confirmed',
    registeredAt: '2026-10-12T14:30:00Z',
    checkedInAt: '2026-10-15T08:45:00Z',
    scanLocation: 'Innovation Studio East Entrance',
    paymentId: 'pay_Pz91k8Lms0w2',
    price: '₹499',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuArCcZdhQneNYKeXDJ67-hiIXdxFoj0Y4SdWacM6qxJjw2jGe8a9xTg5ay6B9YvXdtfDUtRVIG1AIb9IUPixfO-bCRfLhppKAaDkAFUZHxZcrT34hlo0_6UZbdN2mKHxd9zYrPeFiTZHcFz708eA340LvC5RWheIaPuMUgImjkGC5mq66kv8PS3VgmiTti7AwyqxKSMaDMWk14X_Oazbapevmdnl-A-bcmwmy3yP5CBSSYGMvh8T4iD',
  },
  {
    id: '2',
    name: 'Marcus Vance',
    email: 'marcus.v@university.edu',
    rollNumber: '12015563',
    department: 'Design Engineering',
    event: 'AI Symposium 2026',
    ticketNumber: 'EVT-26-7B8X',
    tier: 'VIP Pass',
    status: 'Registered',
    regState: 'Pending Payment',
    registeredAt: '2026-10-13T10:15:00Z',
    paymentId: 'pay_Pz92k7Hms8x3',
    price: '₹1499',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuD_mYa1LHClrghP_C-2wRxYds2fjY4UFl3gEjhcR3jcA2RbFEuAcIeV9_IeEEecpj2zb8EcPA2951DE3tjVSmNlzIj6_zDGSjAKTQU19eg0AsSRDvQPsB4fBVTCPJkvCBTKZFuK-uWPolofaNZvjDH1hAqx-5qMZtuCnkeLyyDZ1Piy81B6nH_nva1sHkjmajRbGYAu0k1vITqroi7gB35WrNWTNIm5mxWgCNwbHJypgZkC0gUEG5os',
  },
  {
    id: '3',
    name: 'Sarah Jenkins',
    email: 's.jenkins@university.edu',
    rollNumber: '11902845',
    department: 'Data Science',
    event: 'AI Symposium 2026',
    ticketNumber: 'EVT-26-4C2Y',
    tier: 'General Ticket',
    status: 'Checked In',
    regState: 'Confirmed',
    registeredAt: '2026-10-12T09:12:00Z',
    checkedInAt: '2026-10-15T09:12:00Z',
    scanLocation: 'Innovation Studio West Entrance',
    paymentId: 'pay_Pz95a1Lms5w1',
    price: '₹499',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBu76NIig4M0hbXmMwurU4IgZVvHRnZChufpt3cuVdmvpd9dbuwJbCRUeJXD3BVzSvpJtJe4_xAnIPOGfxrzLJRqBNBPqlWs8cXy0ZCtiKsiP-Ey_9Yhw_rRxbE0GgxTrQywi6iB-R-Wim8_Ulj4Oz4MGsKuQfzbVph0mcoYQSZWWXzveH44nBTTblcmIvQKUK5n3bIywxR_uT3MJY20nJ5mfx4MYIFDnJAuPBCpcErQAOonZFXVUNV',
  },
  {
    id: '4',
    name: 'Jane Doe',
    email: 'jane.doe@university.edu',
    rollNumber: '12019943',
    department: 'Computer Science',
    event: 'AI Symposium 2026',
    ticketNumber: 'EVT-26-1E9Z',
    tier: 'VIP Pass',
    status: 'Registered',
    regState: 'Confirmed',
    registeredAt: '2026-10-14T11:20:00Z',
    paymentId: 'pay_Pz96b2Hms9y4',
    price: '₹1499',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDKBTT39NA1dbssDGVw2nlazElSjrk7MXErcQjqGFBNx4oVWQYn_xcfKFYT8pAaweb3rVdoMEr1rT_n8PF4xg54LhFmY_afQXH4dw720dU8TIh547AcPt1gXEw3aOZwV7EMo5S6cw_mwvOdi7nLbNajdPpH5ElL6mGCNogKPLjkXg5JtquDPaAwIYRSZqvBnMd0Ah4frAjQFzpqp79iMKAWi771WaxcQfRGmlT86qfOzG6SPwVTtQq4',
  },
  {
    id: '5',
    name: 'Rahul Verma',
    email: 'rahul.v@university.edu',
    rollNumber: '11802951',
    department: 'Mechanical Engineering',
    event: 'Tech Fusion Hackathon',
    ticketNumber: 'EVT-26-9095',
    tier: 'General Ticket',
    status: 'Registered',
    regState: 'Confirmed',
    registeredAt: '2026-11-20T14:10:00Z',
    paymentId: 'pay_Pz93c4Lms7z2',
    price: '₹499',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDYAuCIF7opTtF3mDhVhq5utFwRMslM3Lmn88rsIfTriRwicuR9o3-TX5Who3jDPuoMWBR0jbb7NGIny4merTZ5dtPSqdX4TbiOkgxZcDWlg8yxpblzMU9Ncn8DGTIwq-iRQRWDeg8-jPGW9wLePqmF-MjFO4OeP_Lod3b8Te9DmcrZ_17pTDl43DAsc0jTtIiM85mQ2ZBxB_pwOqqJ9YsFl8b0zmSL5yOy6yyMCKe81-9x_-AcJdkH',
  },
];

export function Attendees({ initialEventId = null }: { initialEventId?: string | null }) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEventId);
  const [attendees, setAttendees] = useState<Attendee[]>(INITIAL_ATTENDEES);

  // Table view search & filter state variables (Checked In selected by default)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('Checked In'); // Default to showing only checked in (scanned)
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [manualTicketNum, setManualTicketNum] = useState('');

  // 1. Calculations for Event List metrics
  const eventMetrics = useMemo(() => {
    const calcMetrics = (eventName: string) => {
      const eventAtts = attendees.filter((a) => a.event === eventName);
      const total = eventName === 'AI Symposium 2026' ? 420 : 450;
      const checkedIn =
        eventName === 'AI Symposium 2026'
          ? 187 +
            eventAtts.filter((a) => a.status === 'Checked In' && a.id !== '1' && a.id !== '3')
              .length
          : 0;
      const remaining = total - checkedIn;
      return { total, checkedIn, remaining };
    };

    return {
      aiSymposium: calcMetrics('AI Symposium 2026'),
      techFusion: calcMetrics('Tech Fusion Hackathon'),
    };
  }, [attendees]);

  // 2. Filtered list for detailed table
  const filteredAttendees = useMemo(() => {
    return attendees.filter((att) => {
      const matchesEvent = selectedEventId === null || att.event === selectedEventId;
      const matchesSearch =
        att.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        att.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        att.department.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        selectedStatus === 'All' ||
        (selectedStatus === 'Checked In' && att.status === 'Checked In') ||
        (selectedStatus === 'Registered' && att.status === 'Registered');

      return matchesEvent && matchesSearch && matchesStatus;
    });
  }, [attendees, selectedEventId, searchQuery, selectedStatus]);

  // 3. Dynamic KPI Metrics calculator for selected event view
  const kpiMetrics = useMemo(() => {
    const total = selectedEventId === 'AI Symposium 2026' ? 420 : 450;

    // Calculate live checkins from state changes
    const stateCheckins = attendees.filter(
      (a) => a.event === selectedEventId && a.status === 'Checked In'
    ).length;
    const initialCheckins = selectedEventId === 'AI Symposium 2026' ? 185 : 0;
    const checkedIn =
      initialCheckins + stateCheckins - (selectedEventId === 'AI Symposium 2026' ? 2 : 0); // avoid double-counting Sarah/Aria

    const pending = total - checkedIn;

    // Revenue mock calculation
    const revenueValue = selectedEventId === 'AI Symposium 2026' ? 84000 : 450 * 499;
    const revenueFormatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(revenueValue);

    return { total, checkedIn, pending, revenue: revenueFormatted };
  }, [attendees, selectedEventId]);

  // 4. Interactive callbacks
  const handleToggleCheckin = (id: string, forceStatus?: 'Checked In' | 'Registered') => {
    setAttendees((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const nextStatus =
            forceStatus || (a.status === 'Checked In' ? 'Registered' : 'Checked In');
          const isCheckedIn = nextStatus === 'Checked In';
          const updatedAttendee = {
            ...a,
            status: nextStatus,
            checkedInAt: isCheckedIn ? new Date().toISOString() : undefined,
            scanLocation: isCheckedIn ? 'Innovation Studio East Entrance' : undefined,
          } as Attendee;

          if (selectedAttendee?.id === id) {
            setSelectedAttendee(updatedAttendee);
          }
          return updatedAttendee;
        }
        return a;
      })
    );
  };

  const handleManualCheckIn = () => {
    if (!manualTicketNum.trim()) return;
    const cleanNum = manualTicketNum.trim().toUpperCase();
    const att = attendees.find((a) => a.ticketNumber.toUpperCase() === cleanNum);
    if (att) {
      if (att.status === 'Checked In') {
        alert(`${att.name} is already checked in.`);
      } else if (att.status === 'Cancelled') {
        alert(`Cannot check in: Ticket is cancelled.`);
      } else {
        handleToggleCheckin(att.id, 'Checked In');
        alert(`Attendee ${att.name} checked in successfully!`);
        setManualTicketNum('');
      }
    } else {
      alert(`Invalid Ticket Number. Try one of: EVT-26-7B8X, EVT-26-1E9Z`);
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

  // View state 1: Event List View (Matches provided list mockup exactly)
  if (selectedEventId === null) {
    return (
      <div className="flex-1 w-full mx-auto flex flex-col gap-8 pb-16 animate-fadeIn">
        {/* Header Section */}
        <div className="mb-4">
          <h2 className="font-display text-[32px] font-semibold text-[#ffba93] tracking-tight">
            Attendees
          </h2>
          <p className="font-body-lg text-white/60 mt-2 max-w-2xl text-lg">
            Select an event to manage attendees and check-ins.
          </p>
        </div>

        {/* Event Cards Grid */}
        <div className="flex flex-col gap-8">
          {/* Card 1 */}
          <div className="bg-white/5 border border-white/10 rounded-[20px] overflow-hidden flex flex-col xl:flex-row transition-all duration-300 hover:border-white/20">
            {/* Left: Poster */}
            <div className="xl:w-2/5 h-64 xl:h-auto relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-t from-[#050507] to-transparent opacity-60 z-10"></div>
              <img
                alt="AI Symposium 2026 Poster"
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCntO4M6IV3qiL5IVb6J9u0mHtCCTzimngaFO-sNxzcK1_3E6PXdA4PIsA3UtR5aGLqy0GhWxxswBwiJ6ytNvGJQLS5EgrVaHdV9J4jyGM_2CFMQBA8_6pnRig17ybK8nDZxOUsZZdkqWcVWdfsg4UtDTUOwybGrkBXVArc4Thmd8kRBEYeLyFDzGyn_dGva85nOiDRtf3CTm6A1wKNwqL1w_Lw9Phs-NiPHR4nALBg7iarF3jKHl-b"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="absolute top-4 left-4 z-20 flex gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wider uppercase backdrop-blur-md flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live
                </span>
              </div>
            </div>

            {/* Right: Details & Metrics */}
            <div className="xl:w-3/5 p-8 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-display text-2xl font-bold text-white mb-2">
                      AI Symposium 2026
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-white/60 text-sm font-medium">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[18px] text-[#ffba93]">
                          calendar_today
                        </span>{' '}
                        Oct 15, 2026
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[18px] text-[#ffba93]">
                          schedule
                        </span>{' '}
                        09:00 AM
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[18px] text-[#ffba93]">
                          location_on
                        </span>{' '}
                        Innovation Studio
                      </span>
                    </div>
                  </div>
                </div>
                <p className="font-body-md text-white/60 line-clamp-2 mt-4 max-w-xl text-sm leading-relaxed">
                  An exclusive gathering of industry leaders discussing the future of artificial
                  intelligence, featuring keynote speeches, interactive workshops, and networking
                  sessions.
                </p>
              </div>
              <div className="mt-8 border-t border-white/10 pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1 font-semibold">
                      Total Bookings
                    </p>
                    <p className="font-display text-3xl font-bold text-[#ffba93] tracking-tight">
                      {eventMetrics.aiSymposium.total}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1 font-semibold">
                      Checked In
                    </p>
                    <p className="font-display text-3xl font-bold text-white tracking-tight">
                      {eventMetrics.aiSymposium.checkedIn}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1 font-semibold">
                      Remaining
                    </p>
                    <p className="font-display text-3xl font-bold text-white tracking-tight">
                      {eventMetrics.aiSymposium.remaining}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setSelectedEventId('AI Symposium 2026')}
                    className="bg-[#ff914d] text-[#050507] hover:bg-[#e07530] font-bold transition-all px-6 py-3 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-2"
                  >
                    Manage Attendees
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white/5 border border-white/10 rounded-[20px] overflow-hidden flex flex-col xl:flex-row transition-all duration-300 opacity-80 hover:opacity-100 hover:border-white/20">
            {/* Left: Poster */}
            <div className="xl:w-2/5 h-64 xl:h-auto relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-t from-[#050507] to-transparent opacity-60 z-10"></div>
              <img
                alt="Tech Fusion Hackathon Poster"
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out grayscale-[30%]"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCHt2O8XGYdVkoJDfzr-VraWzFIO2s9aTCbS1U3DmUaIARW-CpqKi67_7dixzHC1PgLvmCPbUr5NEqN48qwj2bs74JknwuPYNfDwQRLASUnuLhNQ-_BsdN9sQfGrYBq5lwutv8l8voSh7k5II5oASZ616uvp1nq23fQClWvDcPLo0j1NNFrHWrh1VNdrCw2I1V5u1Ka4gZA_dTCm-vfszOkXBWfzjKSrO9A5eXJDxy-J_KdMSu95dFc"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="absolute top-4 left-4 z-20 flex gap-2">
                <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold tracking-wider uppercase backdrop-blur-md flex items-center gap-1.5">
                  Upcoming
                </span>
              </div>
            </div>

            {/* Right: Details & Metrics */}
            <div className="xl:w-3/5 p-8 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-display text-2xl font-bold text-white mb-2">
                      Tech Fusion Hackathon
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-white/60 text-sm font-medium">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[18px] text-[#ffba93]">
                          calendar_today
                        </span>{' '}
                        Nov 22, 2026
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[18px] text-[#ffba93]">
                          schedule
                        </span>{' '}
                        08:00 AM
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[18px] text-[#ffba93]">
                          location_on
                        </span>{' '}
                        Block 14
                      </span>
                    </div>
                  </div>
                </div>
                <p className="font-body-md text-white/60 line-clamp-2 mt-4 max-w-xl text-sm leading-relaxed">
                  A 48-hour intensive coding marathon challenging developers to build innovative
                  solutions bridging web3 and generative AI technologies.
                </p>
              </div>
              <div className="mt-8 border-t border-white/10 pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1 font-semibold">
                      Total Bookings
                    </p>
                    <p className="font-display text-3xl font-bold text-[#ffba93] tracking-tight">
                      {eventMetrics.techFusion.total}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1 font-semibold">
                      Checked In
                    </p>
                    <p className="font-display text-3xl font-bold text-white/40 tracking-tight">
                      {eventMetrics.techFusion.checkedIn}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-white/40 mb-1 font-semibold">
                      Remaining
                    </p>
                    <p className="font-display text-3xl font-bold text-white tracking-tight">
                      {eventMetrics.techFusion.remaining}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setSelectedEventId('Tech Fusion Hackathon')}
                    className="bg-transparent border border-white/10 text-white hover:border-white/30 transition-all px-6 py-3 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-2"
                  >
                    Manage Attendees
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // View state 2: Event Attendees Detail View (Matches provided detail mockup exactly)
  return (
    <div className="flex-1 w-full mx-auto flex flex-col pb-32 animate-fadeIn">
      {/* Breadcrumb & Premium Header Layout */}
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
            <span className="text-[#ff914d]">{selectedEventId}</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight font-display">
            Event Attendees
          </h1>
        </div>
      </div>

      {/* Event Banner Card (Compact) */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-6 mb-8 transition-colors duration-300">
        <div className="w-full md:w-48 h-32 rounded-lg overflow-hidden shrink-0 border border-white/10 relative">
          <img
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDg-Vf-wV_EmECj-W9u9olxa1SbJjW8Op9KCKU7i4lVn40zI2DO1pFLk07ZbSZRrkcvWTKQXOT78Y2JMi6z4POwvqWmOkZZsPax7dMagAIt8VCCOV5oY1GJUdqIf00E9CboLBhS_an-fnqyzqc8G0v_QCc0BHZoxgeFfjjg75JW_zJyx9mdRZw-hpI-qFCqQb4YJHTb8Ek7d4RO2ge7POy5pmOSg9C0Pg6p1jHxiWpaSdGw27ag1wAh"
            alt={selectedEventId}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 bg-[#ff914d]/25 text-[#ffba93] border border-[#ff914d]/30 rounded text-[10px] font-bold uppercase tracking-wider">
              {selectedEventId === 'AI Symposium 2026' ? 'Live Now' : 'Upcoming'}
            </span>
            <h2 className="text-xl font-bold text-white font-display">{selectedEventId}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-white/60 text-sm mt-1">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-[#ff914d]">
                location_on
              </span>
              <span>
                {selectedEventId === 'AI Symposium 2026' ? 'Innovation Studio' : 'Block 14'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-[#ff914d]">
                calendar_month
              </span>
              <span>
                {selectedEventId === 'AI Symposium 2026' ? '15 October 2026' : '22 November 2026'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-[#ff914d]">schedule</span>
              <span>{selectedEventId === 'AI Symposium 2026' ? '09:00 AM' : '08:00 AM'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-1 transition-all duration-300">
          <span className="text-sm text-white/60 font-medium">Registered</span>
          <span className="text-[32px] font-bold text-white font-display leading-tight">
            {kpiMetrics.total}
          </span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-1 transition-all duration-300">
          <span className="text-sm text-white/60 font-medium">Checked In</span>
          <span className="text-[32px] font-bold text-[#ff914d] font-display leading-tight">
            {kpiMetrics.checkedIn}
          </span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-1 transition-all duration-300">
          <span className="text-sm text-white/60 font-medium">Pending Entry</span>
          <span className="text-[32px] font-bold text-white font-display leading-tight">
            {kpiMetrics.pending}
          </span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-1 transition-all duration-300">
          <span className="text-sm text-white/60 font-medium">Revenue</span>
          <span className="text-[32px] font-bold text-white font-display leading-tight">
            {kpiMetrics.revenue}
          </span>
        </div>
      </div>

      {/* Full-width Quick Check-In Panel */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8 flex flex-col md:flex-row items-stretch justify-between gap-8">
        {/* Left Side: Scan QR Code */}
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
            onClick={() => alert('Starting QR scanner overlay...')}
            className="w-full bg-[#ff914d] hover:bg-[#e07530] text-[#050507] rounded-xl py-4 font-bold flex items-center justify-center gap-3 transition-colors text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(255,145,77,0.15)] active:scale-95 duration-200"
          >
            <span className="material-symbols-outlined text-[22px]">qr_code_scanner</span>
            Scan QR Code
          </button>
        </div>

        {/* Divider for desktop */}
        <div className="hidden md:block w-px bg-white/10 self-stretch" />

        {/* Right Side: Manual Ticket Verification */}
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

          {/* Status Filter beside attendee list title */}
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
          {/* Export Excel button */}
          <button
            onClick={() => alert('Exporting attendee list as Excel spreadsheet...')}
            className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl px-4 py-2 text-xs font-semibold transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">table_view</span>
            Export Excel
          </button>

          {/* Download PDF button */}
          <button
            onClick={() => alert('Downloading attendee list as PDF document...')}
            className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl px-4 py-2 text-xs font-semibold transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Download PDF
          </button>

          {/* Search bar */}
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

      {/* Premium table displaying ONLY Name, Email, and Department (Ticket cannot be seen by Admin) */}
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
              {filteredAttendees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-white/40">
                    <span className="material-symbols-outlined text-4xl mb-2 block">group_off</span>
                    No attendees match this filter criteria.
                  </td>
                </tr>
              ) : (
                filteredAttendees.map((att) => (
                  <tr
                    key={att.id}
                    className="hover:bg-white/2 transition-colors cursor-pointer"
                    onClick={() => setSelectedAttendee(att)}
                  >
                    {/* Column 1: Name (Profile image removed) */}
                    <td className="py-4 px-6">
                      <span className="font-semibold text-white">{att.name}</span>
                    </td>

                    {/* Column 2: Email */}
                    <td className="py-4 px-6">
                      <span className="text-white/60">{att.email}</span>
                    </td>

                    {/* Column 3: Department */}
                    <td className="py-4 px-6">
                      <span className="text-white/60">{att.department}</span>
                    </td>

                    {/* Column 4: Status (Checked In / Not Checked In) */}
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          att.status === 'Checked In'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-white/5 text-white/50 border border-white/10'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${att.status === 'Checked In' ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`}
                        ></span>
                        {att.status === 'Checked In' ? 'Checked In' : 'Not Checked In'}
                      </span>
                    </td>

                    {/* Column 4: Quick Action Controls */}
                    <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedAttendee(att)}
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

      {/* Pagination component */}
      <div className="flex justify-center items-center gap-2 mt-8 select-none">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          className="bg-transparent border border-white/10 hover:border-white/20 text-white w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-40 transition-colors"
          disabled={currentPage === 1}
        >
          <span className="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>
        <button
          onClick={() => setCurrentPage(1)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm transition-all ${
            currentPage === 1
              ? 'bg-[#ff914d] text-[#050507]'
              : 'bg-transparent border border-white/10 hover:border-white/20 text-white'
          }`}
        >
          1
        </button>
        <button
          onClick={() => setCurrentPage(2)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm transition-all ${
            currentPage === 2
              ? 'bg-[#ff914d] text-[#050507]'
              : 'bg-transparent border border-white/10 hover:border-white/20 text-white'
          }`}
        >
          2
        </button>
        <button
          onClick={() => setCurrentPage(3)}
          className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm transition-all ${
            currentPage === 3
              ? 'bg-[#ff914d] text-[#050507]'
              : 'bg-transparent border border-white/10 hover:border-white/20 text-white'
          }`}
        >
          3
        </button>
        <button
          onClick={() => setCurrentPage((prev) => Math.min(3, prev + 1))}
          className="bg-transparent border border-white/10 hover:border-white/20 text-white w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-40 transition-colors"
          disabled={currentPage === 3}
        >
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
      </div>

      {/* Slide-over Bento Attendee Detail Drawer Panel (Strictly hides user ticket information/QR/codes from Admin) */}
      {selectedAttendee && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#050507]/80 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setSelectedAttendee(null)}
        >
          <div
            className="w-full max-w-md h-full bg-[#0a0a0c] border-l border-white/10 shadow-2xl flex flex-col justify-between animate-slideIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#050507]/50 backdrop-blur-md">
              <h2 className="text-xl font-bold text-white font-display">Attendee Details</h2>
              <button
                onClick={() => setSelectedAttendee(null)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Drawer Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 scrollbar-none">
              {/* Profile Block */}
              <div className="flex flex-col items-center text-center gap-3">
                <div>
                  <h3 className="text-2xl font-bold text-white font-display">
                    {selectedAttendee.name}
                  </h3>
                  <p className="text-white/60 text-sm">{selectedAttendee.email}</p>
                </div>
                <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white/60 font-semibold">
                  {selectedAttendee.department} Student
                </div>
              </div>

              {/* Status Card (Bento Style showing only registration state. Ticket code/ID cannot be seen) */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col gap-4">
                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                  <div className="text-xs font-semibold uppercase tracking-wider text-white/40 font-display">
                    Status
                  </div>
                  <span
                    className={`px-2.5 py-0.5 bg-[#ff914d]/10 border border-[#ff914d]/25 text-[#ffba93] rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${selectedAttendee.status === 'Checked In' ? 'bg-[#ff914d] animate-pulse' : 'bg-white/40'}`}
                    ></span>
                    {selectedAttendee.status === 'Checked In' ? 'Checked In' : 'Not Checked In'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-white/40 mb-1">Attendee Name</div>
                    <div className="font-semibold text-white">{selectedAttendee.name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/40 mb-1">Email Address</div>
                    <div className="font-semibold text-white">{selectedAttendee.email}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/40 mb-1">Department</div>
                    <div className="font-semibold text-white">{selectedAttendee.department}</div>
                  </div>
                  {selectedAttendee.status === 'Checked In' && selectedAttendee.checkedInAt && (
                    <div>
                      <div className="text-xs text-white/40 mb-1">Check-in Time</div>
                      <div className="font-semibold text-[#ff914d]">
                        {formatDate(selectedAttendee.checkedInAt)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions (Check-in triggers only. Ticket view/download removed for privacy) */}
            <div className="p-6 border-t border-white/10 bg-[#050507]/50 backdrop-blur-md flex flex-col gap-3">
              {selectedAttendee.status !== 'Checked In' ? (
                <button
                  onClick={() => handleToggleCheckin(selectedAttendee.id, 'Checked In')}
                  className="w-full bg-[#ff914d] hover:bg-[#e07530] text-[#050507] rounded-lg py-3 font-semibold flex items-center justify-center gap-2 transition-colors text-sm"
                >
                  <span className="material-symbols-outlined text-[20px]">how_to_reg</span>
                  Mark as Checked In
                </button>
              ) : (
                <button
                  onClick={() => handleToggleCheckin(selectedAttendee.id, 'Registered')}
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
    </div>
  );
}
