'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  type: 'date' | 'time' | 'datetime';
  minDate?: string;
  maxDate?: string;
}

function formatDisplayValue(value: string, pickerType: 'date' | 'time' | 'datetime'): string {
  if (!value) return '';
  if (pickerType === 'date') {
    const d = new Date(value + 'T00:00:00');
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (pickerType === 'time') {
    // Format time for display (used in datetime picker)
    const parts = value.split(':');
    const hour = parseInt(parts[0], 10);
    const minute = parts[1] ? parts[1].slice(0, 2) : '00';
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${minute} ${ampm}`;
  }
  if (pickerType === 'datetime') {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = formatDisplayValue(value.split('T')[1] || '', 'time');
    return `${dateStr} at ${timeStr}`;
  }
  return value;
}

function getMonthDays(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function toISODateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toISOTimeString(hour12: number, minute: number, ampm: string): string {
  let h24 = hour12;
  if (ampm === 'PM' && hour12 !== 12) h24 += 12;
  if (ampm === 'AM' && hour12 === 12) h24 = 0;
  return `${pad(h24)}:${pad(minute)}`;
}

export function DateTimePicker({ value, onChange, label, type, minDate, maxDate }: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<{ hour: number; minute: number; ampm: 'AM' | 'PM' }>({ hour: 12, minute: 0, ampm: 'AM' });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      setInputText(formatDisplayValue(value, type));
      if (type === 'date' || type === 'datetime') {
        const d = new Date(value + (type === 'date' ? 'T00:00:00' : 'T00:00'));
        if (!isNaN(d.getTime())) {
          setSelectedDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
          setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
        }
      }
      if (type === 'time' || type === 'datetime') {
        const parts = value.split(':');
        const hour = parseInt(parts[0], 10);
        const minute = parseInt(parts[1], 10) || 0;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        setSelectedTime({ hour: h12, minute, ampm });
      }
    } else {
      setInputText('');
    }
  }, [value, type]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const openPicker = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    onChange(val);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(true);
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleDateSelect = (day: number) => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    setSelectedDate(d);
    const iso = toISODateString(d);
    if (type === 'date') {
      onChange(iso);
      setInputText(formatDisplayValue(iso, 'date'));
      setIsOpen(false);
    } else if (type === 'datetime') {
      const timeStr = toISOTimeString(selectedTime.hour, selectedTime.minute, selectedTime.ampm);
      const finalVal = `${iso}T${timeStr}`;
      onChange(finalVal);
      setInputText(formatDisplayValue(finalVal, 'datetime'));
      setIsOpen(false);
    }
  };

  const handleTimeChange = (field: 'hour' | 'minute' | 'ampm', val: number | string) => {
    const newTime = { ...selectedTime, [field]: val };
    setSelectedTime(newTime as typeof selectedTime);
    if (type === 'time') {
      const timeStr = toISOTimeString(newTime.hour as number, newTime.minute as number, newTime.ampm as string);
      onChange(timeStr);
      setInputText(formatDisplayValue(timeStr, 'time'));
    } else if (type === 'datetime' && selectedDate) {
      const iso = toISODateString(selectedDate);
      const timeStr = toISOTimeString(newTime.hour as number, newTime.minute as number, newTime.ampm as string);
      onChange(`${iso}T${timeStr}`);
      setInputText(formatDisplayValue(`${iso}T${timeStr}`, 'datetime'));
    }
  };

  const confirmDateTime = () => {
    if (selectedDate) {
      const iso = toISODateString(selectedDate);
      const timeStr = toISOTimeString(selectedTime.hour, selectedTime.minute, selectedTime.ampm);
      onChange(`${iso}T${timeStr}`);
      setInputText(formatDisplayValue(`${iso}T${timeStr}`, 'datetime'));
    }
    setIsOpen(false);
  };

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const today = new Date();
  const isTodayCell = (day: number) => {
    return viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth() && day === today.getDate();
  };

  const isSelectedCell = (day: number) => {
    if (!selectedDate) return false;
    return selectedDate.getFullYear() === viewDate.getFullYear() && selectedDate.getMonth() === viewDate.getMonth() && selectedDate.getDate() === day;
  };

  const isDateDisabled = (day: number): boolean => {
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

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const renderCalendar = () => {
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
          <button type="button" onClick={prevMonth} className="p-1 hover:bg-white/10 rounded-lg transition-colors" aria-label="Previous month">
            <span className="material-symbols-outlined text-white/60 text-lg">chevron_left</span>
          </button>
          <span className="text-sm font-semibold text-white">{monthNames[month]} {year}</span>
          <button type="button" onClick={nextMonth} className="p-1 hover:bg-white/10 rounded-lg transition-colors" aria-label="Next month">
            <span className="material-symbols-outlined text-white/60 text-lg">chevron_right</span>
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {dayNames.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider text-white/40 py-1">{d}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={i} className="aspect-square" />;
            const disabled = isDateDisabled(day);
            const todayCell = isTodayCell(day);
            const selectedCell = isSelectedCell(day);
            return (
              <button
                key={i}
                type="button"
                onClick={() => !disabled && handleDateSelect(day)}
                disabled={disabled}
                className={`aspect-square flex items-center justify-center text-sm font-medium rounded-lg transition-all duration-200 ${
                  disabled
                    ? 'text-white/20 cursor-not-allowed'
                    : todayCell
                    ? 'bg-white/10 text-white hover:bg-white/15'
                    : 'text-white/80 hover:bg-white/5'
                } ${selectedCell ? 'bg-[#ff914d] text-[#050507] font-bold hover:bg-[#ff914d]/90' : ''}`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTimeSelector = () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Hour</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => handleTimeChange('hour', Math.max(1, selectedTime.hour - 1))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60 transition-colors">
              <span className="material-symbols-outlined text-sm">expand_less</span>
            </button>
            <span className="w-10 text-center text-sm font-semibold text-white">{pad(selectedTime.hour)}</span>
            <button type="button" onClick={() => handleTimeChange('hour', Math.min(12, selectedTime.hour + 1))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60 transition-colors">
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
          </div>
        </div>
        <span className="text-white/40 text-lg font-light mt-5">:</span>
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Min</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => handleTimeChange('minute', Math.max(0, selectedTime.minute - 1))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60 transition-colors">
              <span className="material-symbols-outlined text-sm">expand_less</span>
            </button>
            <span className="w-10 text-center text-sm font-semibold text-white">{pad(selectedTime.minute)}</span>
            <button type="button" onClick={() => handleTimeChange('minute', Math.min(59, selectedTime.minute + 1))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60 transition-colors">
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Period</span>
          <div className="flex flex-col gap-1">
            <button type="button" onClick={() => handleTimeChange('ampm', 'AM')} className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${selectedTime.ampm === 'AM' ? 'bg-[#ff914d] text-[#050507]' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>AM</button>
            <button type="button" onClick={() => handleTimeChange('ampm', 'PM')} className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${selectedTime.ampm === 'PM' ? 'bg-[#ff914d] text-[#050507]' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>PM</button>
          </div>
        </div>
      </div>
      {type === 'datetime' && (
        <button
          type="button"
          onClick={confirmDateTime}
          className="mt-2 w-full bg-[#ff914d] hover:bg-[#e07530] text-[#050507] text-sm font-bold py-2.5 rounded-lg transition-colors"
        >
          Confirm Date &amp; Time
        </button>
      )}
    </div>
  );

  const renderPicker = () => {
    if (type === 'time') {
      return renderTimeSelector();
    }
    if (type === 'date') {
      return renderCalendar();
    }
    return (
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <div className="flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-white/10 text-white text-center">Calendar</div>
          <div className="flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-[#ff914d]/10 text-[#ff914d] text-center">Time</div>
        </div>
        {renderCalendar()}
        <div className="border-t border-white/10 pt-4">
          {renderTimeSelector()}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2" ref={containerRef}>
      <label className="text-xs font-semibold uppercase tracking-wider text-white/60">{label}</label>
      <div className="relative">
        <span className="material-symbols-outlined absolute right-3 top-3.5 text-white/40 text-[18px] pointer-events-none">
          {type === 'date' ? 'calendar_month' : type === 'time' ? 'schedule' : 'event'}
        </span>
        <input
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] focus:ring-1 focus:ring-[#ff914d]/20 transition-all cursor-pointer"
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onClick={openPicker}
          onKeyDown={handleInputKeyDown}
          placeholder={type === 'date' ? 'Select date...' : type === 'time' ? 'Select time...' : 'Select date & time...'}
        />
      </div>
      {isOpen && (
        <div className="relative z-50 mt-2 w-full min-w-[280px] bg-[#0a0a0f]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl shadow-black/50 animate-fadeIn">
          {renderPicker()}
        </div>
      )}
    </div>
  );
}

function CustomTimeInput({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [ampm, setAmPm] = useState<'AM' | 'PM'>('AM');

  // Sync external value to internal state
  useEffect(() => {
    if (!value) {
      setHour('');
      setMinute('');
      setAmPm('AM');
      return;
    }
    const parts = value.split(':');
    const h = parts[0] || '';
    const m = parts[1] ? parts[1].slice(0, 2) : '';
    const ampmPart = parts[1] && parts[1].length > 2 ? parts[1].slice(2).toUpperCase() as 'AM' | 'PM' : 'AM';
    setHour(h);
    setMinute(m);
    setAmPm(ampmPart);
  }, [value]);

  // Emit combined value when any part changes
  useEffect(() => {
    if (hour && minute) {
      onChange(`${hour.padStart(2, '0')}:${minute.padStart(2, '0')}${ampm}`);
    } else {
      onChange('');
    }
  }, [hour, minute, ampm]);

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    setHour(val);
    if (val.length === 2) {
      // move focus to minute input
      const minuteInput = document.getElementById('time-minute-input');
      minuteInput?.focus();
    }
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    setMinute(val);
  };

  const toggleAmPm = () => {
    setAmPm(prev => (prev === 'AM' ? 'PM' : 'AM'));
  };

  return (
    <div className="flex items-center gap-2">
      <input
        id="time-hour-input"
        type="text"
        value={hour}
        onChange={handleHourChange}
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
        placeholder="MM"
        className="w-12 bg-white/5 border border-white/10 rounded text-center text-sm text-white focus:outline-none focus:border-[#ff914d]"
        maxLength={2}
      />
      <select
        value={ampm}
        onChange={e => setAmPm(e.target.value as 'AM' | 'PM')}
        className="bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-[#ff914d]"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}