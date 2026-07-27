'use client';

import { useState, useMemo } from 'react';

interface EventPaymentSummary {
  id: string;
  title: string;
  dates: string;
  time: string;
  location: string;
  description: string;
  imageUrl: string;
  statusLabel: string;
  isLive: boolean;
  revenue: string;
  successfulCount: number;
  pendingCount: number;
  refundedAmount: string;
  totalTickets: number;
  soldTickets: number;
  pendingTickets: number;
}

interface Transaction {
  id: string;
  attendeeName: string;
  email: string;
  amount: string;
  status: 'Successful' | 'Pending' | 'Refunded';
  gatewayId: string;
  date: string;
}

const EVENT_PAYMENTS: EventPaymentSummary[] = [
  {
    id: 'evt-ai-symposium',
    title: 'AI Symposium 2026',
    dates: 'Oct 15-17, 2026',
    time: '09:00 AM IST',
    location: 'Main Auditorium',
    description:
      'The premier gathering of artificial intelligence researchers, industry leaders, and innovators exploring the next frontier of machine learning applications.',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCgi3ufAuY9Ha24_6zoNQ5VbmJBJuxGD6Ebd2XyYfbozICNgmMFPLtTtdDlN-4HeJFWoiiuS_Q6qmajiwzZFCtzMsOnUHRdpnyMVblJXsnr4xYrhzROWlekeoEGvwT1ZsbDi8aFnDxWW18me30vdTd2s5xi1dnbZY2AIh06N3KsvuXfTYWjJf-w-RqqYkPJKPBKimWrGjEf5Y9bZ-zo-aX1BBcOaNlOAkiS5AUBg64qpHiZmt9y_cf5',
    statusLabel: 'Live',
    isLive: true,
    revenue: '₹84,000',
    successfulCount: 168,
    pendingCount: 6,
    refundedAmount: '₹3,000',
    totalTickets: 420,
    soldTickets: 168,
    pendingTickets: 6,
  },
  {
    id: 'evt-tech-hackathon',
    title: 'Tech Fusion Hackathon',
    dates: 'Nov 05-06, 2026',
    time: '24 Hours',
    location: 'Block 32, Lab Complex',
    description:
      'A 24-hour coding marathon bringing together students and developers to build innovative solutions for real-world campus problems using modern web stacks.',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBpz_KDIe6IZ4iNjzRgtl-tJgxzLrlkSB4G7fot9k-aNbL0bmuLpAIQfb5migVET40-Qr9JTpbpnPdUooRMGO-yuIgJX2H1R1_sPNYLKp88KsOHd8d7DcfrvMyR7OlDHtyBdiDI_GiNLLyFQm7lUwq59GRQY0SG6xtDDYZouca4Dq-7o7m7f9bSwqPw6jScMAPgx7sITBx0CRtL8IlAjCglYApyfMObtw9DnMzt5reMAFZ9V4p8FBwi',
    statusLabel: 'Registration Open',
    isLive: false,
    revenue: '₹12,500',
    successfulCount: 25,
    pendingCount: 12,
    refundedAmount: '₹0',
    totalTickets: 450,
    soldTickets: 25,
    pendingTickets: 12,
  },
  {
    id: 'evt-design-summit',
    title: 'Design X Summit',
    dates: 'Dec 10, 2026',
    time: '10:00 AM IST',
    location: 'Virtual Event',
    description:
      'A conceptual deep dive into the intersection of user experience design, spatial computing, and digital product strategy for the upcoming year.',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA8nOSgJcRbDEVbqu2sPxo0r8l_pRFaePwQwRxsEVwFWa-ooav2uo5tzOYYi_JiKUmNFMoYRDG3huu9ayFgWCjzAKOyvDNcvfkZZ4xGp4pk4yWcchN6BvCww438yTy6_pzqy2Hs6t3-xcfqRnUOZJPVqsMSh0MM1SAXUpbVHm6CP1rY7INyPR8DL3tpEnOE_rQPiCVGSBcFsbdTRpnKnpdIo8wF9TCSZqtiX6GNoxc1P_MzgClaq7P5',
    statusLabel: 'Upcoming',
    isLive: false,
    revenue: '₹0',
    successfulCount: 0,
    pendingCount: 0,
    refundedAmount: '₹0',
    totalTickets: 300,
    soldTickets: 0,
    pendingTickets: 0,
  },
];

const TRANSACTIONS: Record<string, Transaction[]> = {
  'evt-ai-symposium': [
    {
      id: 'tx-01',
      attendeeName: 'Aria Chen',
      email: 'aria.chen@university.edu',
      amount: '₹499',
      status: 'Successful',
      gatewayId: 'pay_Pz91k8Lms0w2',
      date: '2026-10-12 14:30',
    },
    {
      id: 'tx-02',
      attendeeName: 'Marcus Vance',
      email: 'marcus.v@university.edu',
      amount: '₹1499',
      status: 'Pending',
      gatewayId: 'pay_Pz92k7Hms8x3',
      date: '2026-10-13 10:15',
    },
    {
      id: 'tx-03',
      attendeeName: 'Sarah Jenkins',
      email: 's.jenkins@university.edu',
      amount: '₹499',
      status: 'Successful',
      gatewayId: 'pay_Pz95a1Lms5w1',
      date: '2026-10-12 09:12',
    },
    {
      id: 'tx-04',
      attendeeName: 'Jane Doe',
      email: 'jane.doe@university.edu',
      amount: '₹1499',
      status: 'Successful',
      gatewayId: 'pay_Pz96b2Hms9y4',
      date: '2026-10-14 11:20',
    },
    {
      id: 'tx-05',
      attendeeName: 'David K.',
      email: 'd.k@university.edu',
      amount: '₹3,000',
      status: 'Refunded',
      gatewayId: 'pay_Pz90ref01',
      date: '2026-10-11 16:45',
    },
  ],
  'evt-tech-hackathon': [
    {
      id: 'tx-11',
      attendeeName: 'Rahul Verma',
      email: 'rahul.v@university.edu',
      amount: '₹499',
      status: 'Successful',
      gatewayId: 'pay_Pz93c4Lms7z2',
      date: '2026-11-20 14:10',
    },
    {
      id: 'tx-12',
      attendeeName: 'Neha Sen',
      email: 'neha.s@university.edu',
      amount: '₹499',
      status: 'Pending',
      gatewayId: 'pay_Pz94d5Lms8z3',
      date: '2026-11-21 08:30',
    },
  ],
  'evt-design-summit': [],
};

export function Payments({ initialEventId = null }: { initialEventId?: string | null }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEventId);
  const [txStatusFilter, setTxStatusFilter] = useState('All');
  const [organizerFilter, setOrganizerFilter] = useState('All');
  const [refundStatusFilter, setRefundStatusFilter] = useState('All');

  // Filter events based on search query and organizer filter
  const filteredEvents = useMemo(() => {
    return EVENT_PAYMENTS.filter(
      (evt) =>
        evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const selectedEvent = EVENT_PAYMENTS.find((e) => e.id === selectedEventId);

  // Filter transactions dynamically based on status and refund filters
  const filteredTransactions = useMemo(() => {
    const selectedTxs = selectedEventId ? TRANSACTIONS[selectedEventId] || [] : [];
    return selectedTxs.filter((tx) => {
      const matchesStatus =
        txStatusFilter === 'All' || tx.status.toLowerCase() === txStatusFilter.toLowerCase();
      const matchesRefund =
        refundStatusFilter === 'All' ||
        (refundStatusFilter === 'Refunded' && tx.status === 'Refunded');
      return matchesStatus && matchesRefund;
    });
  }, [selectedEventId, txStatusFilter, refundStatusFilter]);

  if (selectedEventId !== null && selectedEvent) {
    const remainingCapacity =
      selectedEvent.totalTickets - selectedEvent.soldTickets - selectedEvent.pendingTickets;

    return (
      <div className="flex-1 w-full mx-auto flex flex-col pb-32 animate-fadeIn">
        {/* Breadcrumb & Navigation */}
        <div className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-2 flex items-center gap-2 select-none">
            <span
              className="hover:text-white cursor-pointer transition-colors"
              onClick={() => setSelectedEventId(null)}
            >
              Payments
            </span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span className="text-[#ff914d]">{selectedEvent.title}</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight font-display">
            Event Transactions
          </h1>
        </div>

        {/* Compact Event Banner */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-6 mb-8 transition-colors duration-300">
          <div className="w-full md:w-48 h-32 rounded-lg overflow-hidden shrink-0 border border-white/10 relative">
            <img
              className="w-full h-full object-cover"
              src={selectedEvent.imageUrl}
              alt={selectedEvent.title}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 bg-[#ff914d]/25 text-[#ffba93] border border-[#ff914d]/30 rounded text-[10px] font-bold uppercase tracking-wider">
                {selectedEvent.statusLabel}
              </span>
              <h2 className="text-xl font-bold text-white font-display">{selectedEvent.title}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-white/60 text-sm mt-1">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#ff914d]">
                  location_on
                </span>
                <span>{selectedEvent.location}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#ff914d]">
                  calendar_month
                </span>
                <span>{selectedEvent.dates}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#ff914d]">
                  schedule
                </span>
                <span>{selectedEvent.time}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Overview Section (Double Grid layout: Financials & Ticket Stats) */}
        <div className="flex flex-col gap-6 mb-8">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3 font-display px-1">
              Financial Metrics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-1 transition-all duration-300">
                <span className="text-sm text-white/60 font-medium">Event Revenue</span>
                <span className="text-[32px] font-bold text-[#ff914d] font-display leading-tight">
                  {selectedEvent.revenue}
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-1 transition-all duration-300">
                <span className="text-sm text-white/60 font-medium">Successful Payments</span>
                <span className="text-[32px] font-bold text-white font-display leading-tight">
                  {selectedEvent.successfulCount}
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-1 transition-all duration-300">
                <span className="text-sm text-white/60 font-medium">Pending Transactions</span>
                <span className="text-[32px] font-bold text-white font-display leading-tight">
                  {selectedEvent.pendingCount}
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-1 transition-all duration-300">
                <span className="text-sm text-white/60 font-medium">Total Refunded</span>
                <span className="text-[32px] font-bold text-white font-display leading-tight">
                  {selectedEvent.refundedAmount}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3 font-display px-1">
              Ticket statistics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-1 transition-all duration-300">
                <span className="text-sm text-white/60 font-medium">Total Tickets Capacity</span>
                <span className="text-[32px] font-bold text-white font-display leading-tight">
                  {selectedEvent.totalTickets}
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-1 transition-all duration-300">
                <span className="text-sm text-white/60 font-medium">Sold Tickets</span>
                <span className="text-[32px] font-bold text-[#ff914d] font-display leading-tight">
                  {selectedEvent.soldTickets}
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-1 transition-all duration-300">
                <span className="text-sm text-white/60 font-medium">Pending Tickets</span>
                <span className="text-[32px] font-bold text-white font-display leading-tight">
                  {selectedEvent.pendingTickets}
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-1 transition-all duration-300">
                <span className="text-sm text-white/60 font-medium">Remaining Capacity</span>
                <span className="text-[32px] font-bold text-white font-display leading-tight">
                  {remainingCapacity}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Table Section */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6 px-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <h3 className="text-lg font-bold text-white font-display">All Transactions</h3>
            {/* Filter controls row */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 select-none">
              {['All', 'Successful', 'Pending', 'Refunded'].map((status) => (
                <button
                  key={status}
                  onClick={() => setTxStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    txStatusFilter === status
                      ? 'bg-[#ff914d] text-[#050507]'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => alert('Exporting transactional invoice ledger...')}
            className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl px-4 py-2 text-xs font-semibold transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export Ledger
          </button>
        </div>

        {/* Transaction Table */}
        <div className="bg-white/5 border border-white/10 rounded-[20px] overflow-hidden backdrop-blur-2xl">
          <div className="overflow-x-auto scrollbar-none">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-xs font-semibold uppercase tracking-wider bg-white/2">
                  <th className="py-4 px-6">Attendee</th>
                  <th className="py-4 px-6">Gateway ID (Razorpay)</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Amount</th>
                  <th className="py-4 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-white/80">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-white/40">
                      <span className="material-symbols-outlined text-4xl mb-2 block">
                        receipt_long
                      </span>
                      No transactions match this filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/2 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-semibold text-white">{tx.attendeeName}</div>
                        <div className="text-xs text-white/40 mt-0.5">{tx.email}</div>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-white/60">{tx.gatewayId}</td>
                      <td className="py-4 px-6 text-white/60">{tx.date}</td>
                      <td className="py-4 px-6 font-semibold text-white">{tx.amount}</td>
                      <td className="py-4 px-6 text-right flex items-center justify-end gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            tx.status === 'Successful'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : tx.status === 'Pending'
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                : 'bg-red-500/10 border-red-500/20 text-red-400'
                          }`}
                        >
                          {tx.status}
                        </span>
                        {tx.status !== 'Successful' && (
                          <button
                            onClick={() =>
                              alert(`Retrying Razorpay refund for Gateway ID: ${tx.gatewayId}`)
                            }
                            className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[10px] font-bold transition-all flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-xs">refresh</span> Retry
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full mx-auto flex flex-col gap-8 pb-16 animate-fadeIn">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-4 w-full">
        <div>
          <h2 className="font-display text-[32px] font-semibold text-[#ffba93] tracking-tight">
            Payments
          </h2>
          <p className="font-body-lg text-white/60 mt-2 max-w-2xl text-lg">
            Select an event to view payment transactions, revenue, and financial reports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={organizerFilter}
            onChange={(e) => setOrganizerFilter(e.target.value)}
            className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff914d]"
          >
            <option value="All" className="bg-[#050507]">
              All Organizers
            </option>
            <option value="School of CSE" className="bg-[#050507]">
              School of CSE
            </option>
            <option value="Robotics Club" className="bg-[#050507]">
              Robotics Club
            </option>
          </select>

          <select
            value={refundStatusFilter}
            onChange={(e) => setRefundStatusFilter(e.target.value)}
            className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff914d]"
          >
            <option value="All" className="bg-[#050507]">
              All Transactions
            </option>
            <option value="Refunded" className="bg-[#050507]">
              Refunded Only
            </option>
          </select>

          <div className="w-full md:w-64 relative group focus-within:ring-2 focus-within:ring-[#ff914d]/20 rounded-lg transition-all">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-[#ff914d] transition-colors">
              search
            </span>
            <input
              className="w-full bg-white/[0.03] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#ff914d] transition-colors"
              placeholder="Search by Event Name or ID..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Event Cards List */}
      <div className="flex flex-col gap-8">
        {filteredEvents.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-white/40">
            <span className="material-symbols-outlined text-4xl mb-2 block">receipt_long</span>
            No payment records match the query.
          </div>
        ) : (
          filteredEvents.map((evt) => (
            <div
              key={evt.id}
              className="bg-white/5 border border-white/10 rounded-[20px] overflow-hidden flex flex-col xl:flex-row transition-all duration-300 hover:border-white/20"
            >
              {/* Left: Poster */}
              <div className="xl:w-2/5 h-64 xl:h-auto relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-[#050507] to-transparent opacity-60 z-10"></div>
                <img
                  alt={evt.title}
                  className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                  src={evt.imageUrl}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute top-4 left-4 z-20 flex gap-2">
                  <span
                    className={`px-3 py-1 rounded-full bg-surface-dim/80 backdrop-blur-md border border-white/15 text-white text-xs font-semibold tracking-wider uppercase flex items-center gap-1.5`}
                  >
                    {evt.isLive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ff914d] animate-pulse"></span>
                    )}
                    {evt.statusLabel}
                  </span>
                </div>
              </div>

              {/* Right: Details & Metrics */}
              <div className="xl:w-3/5 p-8 flex flex-col justify-between">
                <div>
                  <h3 className="font-display text-2xl font-bold text-white mb-2">{evt.title}</h3>
                  <div className="flex flex-wrap items-center gap-4 text-white/60 text-sm font-medium">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[18px] text-[#ffba93]">
                        calendar_today
                      </span>{' '}
                      {evt.dates}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[18px] text-[#ffba93]">
                        schedule
                      </span>{' '}
                      {evt.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[18px] text-[#ffba93]">
                        location_on
                      </span>{' '}
                      {evt.location}
                    </span>
                  </div>
                  <p className="font-body-md text-white/60 line-clamp-2 mt-4 max-w-xl text-sm leading-relaxed">
                    {evt.description}
                  </p>
                </div>
                <div className="mt-8 border-t border-white/10 pt-6">
                  {/* Financial Metrics Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#ffba93] mb-1 font-bold">
                        Revenue
                      </p>
                      <p className="font-display text-xl font-bold text-white tracking-tight">
                        {evt.revenue}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1 font-bold">
                        Successful
                      </p>
                      <p className="font-display text-xl font-bold text-white tracking-tight flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-emerald-400">
                          check_circle
                        </span>
                        {evt.successfulCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1 font-bold">
                        Pending
                      </p>
                      <p className="font-display text-xl font-bold text-white tracking-tight flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-amber-400">
                          pending
                        </span>
                        {evt.pendingCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1 font-bold">
                        Refunded
                      </p>
                      <p className="font-display text-xl font-bold text-white tracking-tight flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-red-400">
                          undo
                        </span>
                        {evt.refundedAmount}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    {evt.revenue !== '₹0' ? (
                      <button
                        onClick={() => setSelectedEventId(evt.id)}
                        className="bg-[#ff914d] text-[#050507] hover:bg-[#e07530] font-bold transition-all px-6 py-3 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-2"
                      >
                        View Payments
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </button>
                    ) : (
                      <button
                        disabled
                        className="bg-white/5 border border-white/5 text-white/30 cursor-not-allowed transition-all px-6 py-3 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-2"
                      >
                        No Payments Configured
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
