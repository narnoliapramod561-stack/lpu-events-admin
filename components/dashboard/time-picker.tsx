'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface TimePickerProps {
  value: string; // "HH:MM" (24‑hour format, e.g., "09:30")
  period: 'AM' | 'PM';
  onChange: (value: string) => void; // receives "HH:MM"
  onPeriodChange: (period: 'AM' | 'PM') => void;
  label?: string;
}

export function TimePicker({ value, period, onChange, onPeriodChange, label }: TimePickerProps) {
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const lastEmittedValueRef = useRef(value);

  // Sync external value to internal state
  useEffect(() => {
    if (value !== lastEmittedValueRef.current) {
      lastEmittedValueRef.current = value;
      if (value) {
        const parts = value.split(':');
        setHour(parts[0] ?? '');
        setMinute(parts[1] ?? '');
      } else {
        setHour('');
        setMinute('');
      }
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

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    setHour(val);
    if (val.length === 2) {
      const minuteInput = document.getElementById('time-minute-input');
      minuteInput?.focus();
    }
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    setMinute(val);
  };

  // Emit combined value when both parts are present
  useEffect(() => {
    if (hour && minute) {
      const formatted = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
      if (formatted !== value) {
        lastEmittedValueRef.current = formatted;
        onChange(formatted);
      }
    } else {
      if (value !== '') {
        lastEmittedValueRef.current = '';
        onChange('');
      }
    }
  }, [hour, minute, value, onChange]);

  const handleBlur = () => {
    if (!hour && !minute) {
      setError(null);
      return;
    }
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    if (isNaN(h) || h < 1 || h > 12) {
      setError('Hour must be 01‑12');
      return;
    }
    if (isNaN(m) || m < 0 || m > 59) {
      setError('Minute must be 00‑59');
      return;
    }
    setError(null);
  };

  // Time selector UI (clock) – copied from original DateTimePicker's renderTimeSelector
  const handleTimeChange = (field: 'hour' | 'minute' | 'ampm', val: number | string) => {
    if (field === 'hour') setHour((val as number).toString());
    else if (field === 'minute') setMinute((val as number).toString());
    else if (field === 'ampm') onPeriodChange(val as 'AM' | 'PM');
  };

  const renderTimeSelector = () => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center gap-0.5 flex-1">
          <span className="text-[9px] uppercase tracking-wider text-white/40 font-semibold">Hour</span>
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => handleTimeChange('hour', Math.max(1, parseInt(hour || '1') - 1))} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/60 transition-colors">
              <span className="material-symbols-outlined text-xs">expand_less</span>
            </button>
            <span className="w-7 text-center text-xs font-semibold text-white">{hour || '--'}</span>
            <button type="button" onClick={() => handleTimeChange('hour', Math.min(12, parseInt(hour || '12') + 1))} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/60 transition-colors">
              <span className="material-symbols-outlined text-xs">expand_more</span>
            </button>
          </div>
        </div>
        <span className="text-white/40 text-sm font-light mt-4">:</span>
        <div className="flex flex-col items-center gap-0.5 flex-1">
          <span className="text-[9px] uppercase tracking-wider text-white/40 font-semibold">Min</span>
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => handleTimeChange('minute', Math.max(0, parseInt(minute || '0') - 1))} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/60 transition-colors">
              <span className="material-symbols-outlined text-xs">expand_less</span>
            </button>
            <span className="w-7 text-center text-xs font-semibold text-white">{minute || '--'}</span>
            <button type="button" onClick={() => handleTimeChange('minute', Math.min(59, parseInt(minute || '0') + 1))} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-white/60 transition-colors">
              <span className="material-symbols-outlined text-xs">expand_more</span>
            </button>
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-1.5">
        <button type="button" onClick={() => handleTimeChange('ampm', 'AM')} className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${period === 'AM' ? 'bg-[#ff914d] text-[#050507]' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>AM</button>
        <button type="button" onClick={() => handleTimeChange('ampm', 'PM')} className={`px-2 py-0.5 text-[10px] font-bold rounded transition-all ${period === 'PM' ? 'bg-[#ff914d] text-[#050507]' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>PM</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2" ref={containerRef}>
      {label && <label className="text-xs font-semibold uppercase tracking-wider text-white/60">{label}</label>}
      <div className="relative flex items-center gap-2">
        <input
          id="time-hour-input"
          type="text"
          value={hour}
          onChange={handleHourChange}
          onBlur={handleBlur}
          placeholder="HH"
          className="w-12 bg-white/5 border border-white/10 rounded text-center text-sm text-white focus:outline-none focus:border-[#ff914d]"
          maxLength={2}
        />
        <span className="text-white/60">:</span>
        <input
          id="time-minute-input"
          type="text"
          value={minute}
          onChange={handleMinuteChange}
          onBlur={handleBlur}
          placeholder="MM"
          className="w-12 bg-white/5 border border-white/10 rounded text-center text-sm text-white focus:outline-none focus:border-[#ff914d]"
          maxLength={2}
        />
        <select
          value={period}
          onChange={e => onPeriodChange(e.target.value as 'AM' | 'PM')}
          className="bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-[#ff914d]"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
        <span className="material-symbols-outlined absolute right-3 cursor-pointer" onClick={openPicker}>schedule</span>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-auto min-w-[200px] max-w-[260px] bg-[#0a0a0f]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 animate-fadeIn">
          {renderTimeSelector()}
        </div>
      )}
    </div>
  );
}
