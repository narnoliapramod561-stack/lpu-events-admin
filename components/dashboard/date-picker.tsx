'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface DatePickerProps {
  value: string; // ISO date string: YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
  minDate?: string; // ISO string
  maxDate?: string; // ISO string
}

export function DatePicker({ value, onChange, label, minDate, maxDate }: DatePickerProps) {
  // raw input shown to the user (DD / MM / YYYY)
  const [raw, setRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize viewDate on client side only
  useEffect(() => {
    if (!viewDate) {
      setViewDate(new Date());
    }
  }, [viewDate]);

  // Sync external ISO value to raw string
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        setRaw(`${day} / ${month} / ${year}`);
        setSelectedDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
        setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    } else {
      setRaw('');
      setSelectedDate(null);
    }
  }, [value]);

  // Close popup on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const openPicker = useCallback(() => setIsOpen(true), []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRaw(e.target.value);
  };

  const parseRaw = (rawStr: string) => {
    const parts = rawStr.split('/').map(p => p.trim());
    if (parts.length !== 3) return null;
    const [dayStr, monthStr, yearStr] = parts;
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10) - 1; // zero‑based
    const year = parseInt(yearStr, 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    const d = new Date(year, month, day);
    if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null;
    return d;
  };

  const handleBlur = () => {
    const d = parseRaw(raw);
    if (!d) {
      setError('Invalid date format');
      return;
    }
    // min/max checks
    if (minDate && d < new Date(minDate + 'T00:00:00')) {
      setError('Date is before allowed range');
      return;
    }
    if (maxDate && d > new Date(maxDate + 'T23:59:59')) {
      setError('Date is after allowed range');
      return;
    }
    setError(null);
    const iso = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    onChange(iso);
    setSelectedDate(d);
    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  // Calendar helpers (copied from original DateTimePicker)
  const getMonthDays = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => {
    if (!viewDate) return;
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };
  
  const nextMonth = () => {
    if (!viewDate) return;
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const isSelectedCell = (day: number) => {
    if (!selectedDate || !viewDate) return false;
    return (
      selectedDate.getFullYear() === viewDate.getFullYear() &&
      selectedDate.getMonth() === viewDate.getMonth() &&
      selectedDate.getDate() === day
    );
  };

  const isDateDisabled = (day: number) => {
    if (!viewDate) return false;
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (minDate) {
      const min = new Date(minDate + 'T00:00:00');
      if (d < min) return true;
    }
    if (maxDate) {
      const max = new Date(maxDate + 'T23:59:59');
      if (d > max) return true;
    }
    return false;
  };

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const renderCalendar = () => {
    if (!viewDate) {
      return (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-center py-8">
            <span className="text-white/60">Loading calendar...</span>
          </div>
        </div>
      );
    }
    
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getMonthDays(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(i);
    while (cells.length < totalCells) cells.push(null);

    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button type="button" onClick={prevMonth} className="p-1 hover:bg-white/10 rounded-lg">
            <span className="material-symbols-outlined text-white/60 text-lg">chevron_left</span>
          </button>
          <span className="text-sm font-semibold text-white">{monthNames[month]} {year}</span>
          <button type="button" onClick={nextMonth} className="p-1 hover:bg-white/10 rounded-lg">
            <span className="material-symbols-outlined text-white/60 text-lg">chevron_right</span>
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {dayNames.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider text-white/40 py-1">{d}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={i} className="h-8" />;
            const disabled = isDateDisabled(day);
            const selected = isSelectedCell(day);
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (!viewDate) return;
                  const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                  setSelectedDate(d);
                  const iso = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
                  onChange(iso);
                  setRaw(`${day.toString().padStart(2, '0')} / ${(viewDate.getMonth() + 1).toString().padStart(2, '0')} / ${viewDate.getFullYear()}`);
                  setIsOpen(false);
                }}
                className={`w-8 h-8 flex items-center justify-center rounded ${selected ? 'bg-[#ff914d]/10 text-[#ff914d]' : 'text-white/60'} ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10'}`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2" ref={containerRef}>
      {label && <label className="text-xs font-semibold uppercase tracking-wider text-white/60">{label}</label>}
      <div className="relative">
        <span className="material-symbols-outlined absolute right-3 top-3.5 text-white/40 text-[18px] cursor-pointer" onClick={openPicker}>calendar_month</span>
        <input
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
          placeholder="DD / MM / YYYY"
          value={raw}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onClick={openPicker}
        />
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        {isOpen && (
          <div className="absolute z-50 mt-2 w-full min-w-[280px] bg-[#0a0a0f]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl shadow-black/50 animate-fadeIn">
            {renderCalendar()}
          </div>
        )}
      </div>
    </div>
  );
}
