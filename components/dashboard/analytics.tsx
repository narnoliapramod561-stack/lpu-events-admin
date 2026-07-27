'use client';

import { useState } from 'react';

type Range = '30D' | '90D' | '1Y' | 'All';

interface MetricStats {
  totalEvents: string;
  totalEventsChange: string;
  totalRegistrations: string;
  totalRegistrationsChange: string;
  totalRevenue: string;
  totalRevenueChange: string;
  avgAttendance: string;
  avgAttendanceChange: string;
  registrationPoints: number[];
  revenuePoints: number[];
}

const STATS_BY_RANGE: Record<Range, MetricStats> = {
  '30D': {
    totalEvents: '4',
    totalEventsChange: '+1',
    totalRegistrations: '945',
    totalRegistrationsChange: '+8%',
    totalRevenue: '₹96,500',
    totalRevenueChange: '+14%',
    avgAttendance: '93%',
    avgAttendanceChange: '+1%',
    registrationPoints: [45, 80, 55, 90, 75, 120, 95, 140, 110, 160],
    revenuePoints: [10000, 25000, 18000, 32000, 24000, 48000, 36000, 54000, 45000, 68000],
  },
  '90D': {
    totalEvents: '12',
    totalEventsChange: '+3',
    totalRegistrations: '2,840',
    totalRegistrationsChange: '+10%',
    totalRevenue: '₹3.1L',
    totalRevenueChange: '+18%',
    avgAttendance: '92%',
    avgAttendanceChange: '-0.5%',
    registrationPoints: [120, 240, 180, 320, 260, 410, 350, 490, 420, 580],
    revenuePoints: [45000, 98000, 72000, 134000, 112000, 186000, 154000, 218000, 188000, 264000],
  },
  '1Y': {
    totalEvents: '18',
    totalEventsChange: '+2',
    totalRegistrations: '4,283',
    totalRegistrationsChange: '+12%',
    totalRevenue: '₹4.8L',
    totalRevenueChange: '+24%',
    avgAttendance: '91%',
    avgAttendanceChange: '-2%',
    registrationPoints: [280, 540, 410, 760, 620, 980, 810, 1140, 950, 1320],
    revenuePoints: [85000, 192000, 148000, 276000, 214000, 394000, 318000, 482000, 398000, 574000],
  },
  All: {
    totalEvents: '26',
    totalEventsChange: '+5',
    totalRegistrations: '6,140',
    totalRegistrationsChange: '+15%',
    totalRevenue: '₹7.2L',
    totalRevenueChange: '+32%',
    avgAttendance: '90%',
    avgAttendanceChange: '-1.5%',
    registrationPoints: [410, 780, 620, 1120, 940, 1480, 1260, 1780, 1520, 2140],
    revenuePoints: [120000, 290000, 210000, 420000, 330000, 580000, 470000, 710000, 590000, 860000],
  },
};

export function Analytics() {
  const [selectedRange, setSelectedRange] = useState<Range>('30D');
  const [viewTab, setViewTab] = useState<'Platform' | 'Organizers' | 'Categories'>('Platform');

  const stats = STATS_BY_RANGE[selectedRange];

  // Helper to generate SVG path from array of numbers
  const generateSvgPath = (points: number[], width: number, height: number) => {
    if (points.length === 0) return '';
    const maxVal = Math.max(...points);
    const minVal = Math.min(...points);
    const range = maxVal - minVal || 1;

    const xStep = width / (points.length - 1);

    return points
      .map((p, index) => {
        const x = index * xStep;
        // Flip y since SVG coordinates start from top left
        const y = height - ((p - minVal) / range) * (height - 30) - 15;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const svgPathReg = generateSvgPath(stats.registrationPoints, 500, 250);
  const svgPathRev = generateSvgPath(stats.revenuePoints, 500, 250);

  // Helper to generate closed SVG path for gradient fill
  const generateFillPath = (points: number[], width: number, height: number) => {
    const linePath = generateSvgPath(points, width, height);
    if (!linePath) return '';
    return `${linePath} L ${width} ${height} L 0 ${height} Z`;
  };

  const svgFillReg = generateFillPath(stats.registrationPoints, 500, 250);
  const svgFillRev = generateFillPath(stats.revenuePoints, 500, 250);

  return (
    <div className="flex-grow w-full max-w-[1400px] mx-auto flex flex-col gap-8 pb-16 animate-fadeIn">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-[32px] font-semibold text-[#ffba93] tracking-tight">
            Analytics
          </h2>
          <p className="font-body-lg text-white/60 mt-2 max-w-2xl text-lg">
            Track platform-wide analytics, organizer performance, and category trends.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Dimension View Tabs */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 select-none">
            {(['Platform', 'Organizers', 'Categories'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setViewTab(tab)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  viewTab === tab
                    ? 'bg-white/10 text-[#ff914d] font-bold'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Time Range Tabs */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 select-none">
            {(['30D', '90D', '1Y', 'All'] as Range[]).map((range) => (
              <button
                key={range}
                onClick={() => setSelectedRange(range)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  selectedRange === range
                    ? 'bg-[#ff914d] text-[#050507]'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1 */}
        <div className="bg-white/5 border border-white/10 rounded-[20px] p-6 flex flex-col gap-4 transition-all duration-300 hover:border-white/20">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-white/40 font-display">
              Total Events
            </span>
            <div className="p-2 bg-white/5 rounded-lg text-[#ff914d]">
              <span className="material-symbols-outlined text-[20px]">event</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white font-display">{stats.totalEvents}</span>
            <span className="text-emerald-400 text-sm font-semibold flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[16px]">trending_up</span>
              {stats.totalEventsChange}
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white/5 border border-white/10 rounded-[20px] p-6 flex flex-col gap-4 transition-all duration-300 hover:border-white/20">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-white/40 font-display">
              Total Registrations
            </span>
            <div className="p-2 bg-white/5 rounded-lg text-[#ff914d]">
              <span className="material-symbols-outlined text-[20px]">group</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white font-display">
              {stats.totalRegistrations}
            </span>
            <span className="text-emerald-400 text-sm font-semibold flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[16px]">trending_up</span>
              {stats.totalRegistrationsChange}
            </span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white/5 border border-white/10 rounded-[20px] p-6 flex flex-col gap-4 transition-all duration-300 hover:border-white/20">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-white/40 font-display">
              Total Revenue
            </span>
            <div className="p-2 bg-white/5 rounded-lg text-[#ff914d]">
              <span className="material-symbols-outlined text-[20px]">currency_rupee</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white font-display">{stats.totalRevenue}</span>
            <span className="text-emerald-400 text-sm font-semibold flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[16px]">trending_up</span>
              {stats.totalRevenueChange}
            </span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white/5 border border-white/10 rounded-[20px] p-6 flex flex-col gap-4 transition-all duration-300 hover:border-white/20">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold uppercase tracking-wider text-white/40 font-display">
              Avg Attendance
            </span>
            <div className="p-2 bg-white/5 rounded-lg text-[#ff914d]">
              <span className="material-symbols-outlined text-[20px]">fact_check</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white font-display">
              {stats.avgAttendance}
            </span>
            <span
              className={`text-sm font-semibold flex items-center gap-0.5 ${
                stats.avgAttendanceChange.startsWith('+') ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {stats.avgAttendanceChange.startsWith('+') ? 'trending_up' : 'trending_down'}
              </span>
              {stats.avgAttendanceChange}
            </span>
          </div>
        </div>
      </div>

      {/* Performance Trends Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registration Chart */}
        <div className="bg-white/5 border border-white/10 rounded-[20px] p-6 flex flex-col gap-4 min-h-[400px]">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white font-display">Registration Trend</h3>
            <button
              onClick={() => alert('Trend customization settings...')}
              className="text-white/40 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
          <div className="flex-1 bg-white/[0.02] rounded-xl border border-white/5 p-4 flex flex-col justify-between relative overflow-hidden">
            {/* SVG Interactive Line Chart */}
            <div className="w-full h-56 relative">
              <svg className="w-full h-full" viewBox="0 0 500 250" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff914d" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#ff914d" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Grid Lines */}
                <line
                  x1="0"
                  y1="62"
                  x2="500"
                  y2="62"
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="1"
                />
                <line
                  x1="0"
                  y1="125"
                  x2="500"
                  y2="125"
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="1"
                />
                <line
                  x1="0"
                  y1="187"
                  x2="500"
                  y2="187"
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="1"
                />

                {/* Gradient Fill under line */}
                <path d={svgFillReg} fill="url(#regGrad)" />
                {/* Stroke Line */}
                <path
                  d={svgPathReg}
                  fill="none"
                  stroke="#ff914d"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="flex justify-between text-[10px] text-white/40 font-semibold uppercase tracking-wider px-1">
              <span>Start</span>
              <span>Midpoint</span>
              <span>End</span>
            </div>
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-white/5 border border-white/10 rounded-[20px] p-6 flex flex-col gap-4 min-h-[400px]">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white font-display">Revenue Trend</h3>
            <button
              onClick={() => alert('Revenue configurations...')}
              className="text-white/40 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
          <div className="flex-1 bg-white/[0.02] rounded-xl border border-white/5 p-4 flex flex-col justify-between relative overflow-hidden">
            {/* SVG Interactive Line Chart */}
            <div className="w-full h-56 relative">
              <svg className="w-full h-full" viewBox="0 0 500 250" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Grid Lines */}
                <line
                  x1="0"
                  y1="62"
                  x2="500"
                  y2="62"
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="1"
                />
                <line
                  x1="0"
                  y1="125"
                  x2="500"
                  y2="125"
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="1"
                />
                <line
                  x1="0"
                  y1="187"
                  x2="500"
                  y2="187"
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth="1"
                />

                {/* Gradient Fill under line */}
                <path d={svgFillRev} fill="url(#revGrad)" />
                {/* Stroke Line */}
                <path
                  d={svgPathRev}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="flex justify-between text-[10px] text-white/40 font-semibold uppercase tracking-wider px-1">
              <span>Start</span>
              <span>Midpoint</span>
              <span>End</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
