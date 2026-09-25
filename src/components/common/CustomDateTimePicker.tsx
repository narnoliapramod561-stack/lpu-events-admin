import React, { useState, useRef, useEffect } from 'react';

const toLocalDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helpers for DD/MM/YYYY <-> YYYY-MM-DD conversion
const isoToDisplayDate = (iso: string): string => {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return iso;
};

const displayToIsoDate = (disp: string): string | null => {
  if (!disp) return null;
  const cleaned = disp.trim().replace(/[-.]/g, '/');
  const parts = cleaned.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) year = `20${year}`;
    if (year.length === 4) {
      const dNum = parseInt(day, 10);
      const mNum = parseInt(month, 10);
      const yNum = parseInt(year, 10);
      if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31 && yNum >= 2000) {
        return `${year}-${month}-${day}`;
      }
    }
  }
  return null;
};

// ==========================================
// 1. CUSTOM CALENDAR DATE PICKER (DD/MM/YYYY)
// ==========================================
interface CustomDatePickerProps {
  value: string; // 'YYYY-MM-DD'
  onChange: (dateStr: string) => void;
  minDate?: string; // 'YYYY-MM-DD'
  label: string;
  subtext?: string;
  icon?: string;
  required?: boolean;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  minDate,
  label,
  subtext,
  icon = 'event',
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState(isoToDisplayDate(value));
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse initial view month/year from value or current date
  const initialDate = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth()); // 0-11

  // Sync internal text when external value changes
  useEffect(() => {
    setInputText(isoToDisplayDate(value));
    if (value) {
      const d = new Date(value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Navigate months
  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Generate days in month
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const todayStr = toLocalDateString(new Date());

  const isDateDisabled = (year: number, month: number, day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (minDate && dateStr < minDate) return true;
    return false;
  };

  const isSelected = (year: number, month: number, day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return value === dateStr;
  };

  const isToday = (year: number, month: number, day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return todayStr === dateStr;
  };

  // Handle click on a calendar date cell
  const handleSelectDay = (day: number) => {
    if (isDateDisabled(viewYear, viewMonth, day)) return;
    const formattedIso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(formattedIso);
    setInputText(isoToDisplayDate(formattedIso));
    setIsOpen(false);
  };

  // Handle direct manual typing in DD/MM/YYYY format
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    
    // Auto-add slashes as user types numbers
    const cleanDigits = raw.replace(/\D/g, '');
    if (cleanDigits.length <= 8) {
      if (cleanDigits.length > 4) {
        raw = `${cleanDigits.slice(0, 2)}/${cleanDigits.slice(2, 4)}/${cleanDigits.slice(4)}`;
      } else if (cleanDigits.length > 2) {
        raw = `${cleanDigits.slice(0, 2)}/${cleanDigits.slice(2)}`;
      } else {
        raw = cleanDigits;
      }
    }
    
    setInputText(raw);

    // If fully typed DD/MM/YYYY (10 chars), try parsing to ISO
    if (raw.length === 10) {
      const parsedIso = displayToIsoDate(raw);
      if (parsedIso) {
        if (!minDate || parsedIso >= minDate) {
          onChange(parsedIso);
          const d = new Date(parsedIso + 'T00:00:00');
          if (!isNaN(d.getTime())) {
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
          }
        }
      }
    }
  };

  const handleInputBlur = () => {
    if (!inputText) {
      onChange('');
      return;
    }
    const parsedIso = displayToIsoDate(inputText);
    if (parsedIso) {
      if (minDate && parsedIso < minDate) {
        // Revert to minDate or previous valid value
        onChange(minDate);
        setInputText(isoToDisplayDate(minDate));
      } else {
        onChange(parsedIso);
        setInputText(isoToDisplayDate(parsedIso));
      }
    } else {
      // If invalid text, restore previous valid value
      setInputText(isoToDisplayDate(value));
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-bold text-[#261812] dark:text-[#ffede6] uppercase tracking-wider mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[17px] text-[#ff6b00]">{icon}</span>
          <span>{label}</span>
        </span>
        {required && <span className="text-[10px] text-[#ff6b00] font-bold">Required</span>}
      </label>

      {/* Input container with direct typing & calendar trigger button */}
      <div
        className={`w-full px-3.5 py-2 rounded-xl border flex items-center justify-between transition-all ${
          isOpen
            ? 'border-[#ff6b00] ring-2 ring-[#ff6b00]/20 bg-white dark:bg-[#1a120e]'
            : 'border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] hover:border-[#ff6b00]'
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="DD/MM/YYYY"
          value={inputText}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => setIsOpen(true)}
          maxLength={10}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            boxShadow: 'none',
            padding: '2px 0'
          }}
          className="w-full text-[#261812] dark:text-[#ffede6] text-sm font-medium placeholder-[#5a4136]/40 dark:placeholder-[#ffb693]/40 tracking-wide"
        />
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen && inputRef.current) {
              inputRef.current.focus();
            }
          }}
          className="p-1 text-[#ff6b00] hover:scale-110 active:scale-95 transition-transform cursor-pointer flex items-center justify-center ml-2"
          title="Open Calendar"
        >
          <span className="material-symbols-outlined text-[20px]">calendar_today</span>
        </button>
      </div>

      {subtext && (
        <p className="text-[11px] text-[#5a4136] dark:text-[#ffb693] mt-1.5">
          {subtext}
        </p>
      )}

      {/* Small Compact Calendar Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 z-50 w-64 p-3 rounded-2xl bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] shadow-2xl animate-fadeIn space-y-2.5 select-none">
          {/* Month & Year Header */}
          <div className="flex items-center justify-between pb-1.5 border-b border-[#e2bfb0]/40 dark:border-[#5a4136]/40">
            <button
              type="button"
              onClick={prevMonth}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[#5a4136] dark:text-[#ffb693] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] hover:text-[#ff6b00] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <div className="text-center">
              <span className="font-bold text-xs text-[#261812] dark:text-[#ffede6] font-['Outfit']">
                {monthNames[viewMonth]} {viewYear}
              </span>
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="w-7 h-7 rounded-md flex items-center justify-center text-[#5a4136] dark:text-[#ffb693] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] hover:text-[#ff6b00] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {daysOfWeek.map((d, i) => (
              <span
                key={d}
                className={`text-[10px] font-bold ${
                  i === 0 || i === 6 ? 'text-[#ff6b00]' : 'text-[#5a4136] dark:text-[#ffb693]'
                }`}
              >
                {d}
              </span>
            ))}
          </div>

          {/* Compact Calendar Day Grid */}
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {/* Previous month filler days */}
            {Array.from({ length: firstDayIndex }).map((_, idx) => {
              const prevDayNum = daysInPrevMonth - firstDayIndex + idx + 1;
              return (
                <div
                  key={`prev-${idx}`}
                  className="h-7 flex items-center justify-center text-[10px] text-stone-300 dark:text-stone-700 cursor-not-allowed"
                >
                  {prevDayNum}
                </div>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const disabled = isDateDisabled(viewYear, viewMonth, dayNum);
              const selected = isSelected(viewYear, viewMonth, dayNum);
              const today = isToday(viewYear, viewMonth, dayNum);

              let dayClasses = 'h-7 w-7 mx-auto rounded-md text-[11px] font-semibold flex items-center justify-center transition-all cursor-pointer relative ';

              if (disabled) {
                dayClasses += 'text-stone-300 dark:text-stone-600 cursor-not-allowed opacity-35 ';
              } else if (selected) {
                dayClasses += 'bg-[#ff6b00] text-white font-bold shadow-sm scale-105 ';
              } else {
                dayClasses += 'text-[#261812] dark:text-[#ffede6] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] hover:text-[#ff6b00] ';
              }

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleSelectDay(dayNum)}
                  className={dayClasses}
                >
                  {dayNum}
                  {today && !selected && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#ff6b00]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Shortcuts */}
          <div className="pt-1.5 border-t border-[#e2bfb0]/40 dark:border-[#5a4136]/40 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const nowIso = toLocalDateString(now);
                  if (!minDate || nowIso >= minDate) {
                    onChange(nowIso);
                    setInputText(isoToDisplayDate(nowIso));
                    setIsOpen(false);
                  }
                }}
                className="px-2 py-0.5 font-bold text-[#ff6b00] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] rounded transition-colors cursor-pointer"
              >
                Today
              </button>
              {!required && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setInputText('');
                    setIsOpen(false);
                  }}
                  className="px-2 py-0.5 font-bold text-[#8c6d62] dark:text-[#ffb693] hover:text-red-500 rounded transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2 py-0.5 font-bold text-[#5a4136] dark:text-[#ffb693] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] rounded transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


// ==========================================
// 2. CUSTOM TIME PICKER
// ==========================================
interface CustomTimePickerProps {
  value: string; // 'HH:mm' 24-hr format
  onChange: (timeStr: string) => void;
  label: string;
  subtext?: string;
  icon?: string;
  required?: boolean;
}

export const CustomTimePicker: React.FC<CustomTimePickerProps> = ({
  value,
  onChange,
  label,
  subtext,
  icon = 'alarm',
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial 12-hour values from 24-hr string (HH:mm)
  const parseTime = (timeStr: string) => {
    if (!timeStr) return { hour: '09', minute: '00', period: 'AM' };
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    if (isNaN(h)) h = 9;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return {
      hour: String(hour12).padStart(2, '0'),
      minute: m,
      period
    };
  };

  const current = parseTime(value);
  const [selectedHour, setSelectedHour] = useState(current.hour);
  const [selectedMinute, setSelectedMinute] = useState(current.minute);
  const [selectedPeriod, setSelectedPeriod] = useState(current.period);

  // Keep in sync when value changes externally
  useEffect(() => {
    if (value) {
      const parsed = parseTime(value);
      setSelectedHour(parsed.hour);
      setSelectedMinute(parsed.minute);
      setSelectedPeriod(parsed.period);
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const updateTime = (h: string, m: string, p: string) => {
    let hourNum = parseInt(h, 10);
    if (p === 'PM' && hourNum < 12) hourNum += 12;
    if (p === 'AM' && hourNum === 12) hourNum = 0;
    const formatted = `${String(hourNum).padStart(2, '0')}:${m}`;
    onChange(formatted);
  };

  const handleHourClick = (h: string) => {
    setSelectedHour(h);
    updateTime(h, selectedMinute, selectedPeriod);
  };

  const handleMinuteClick = (m: string) => {
    setSelectedMinute(m);
    updateTime(selectedHour, m, selectedPeriod);
  };

  const handlePeriodClick = (p: string) => {
    setSelectedPeriod(p);
    updateTime(selectedHour, selectedMinute, p);
  };

  const hoursList = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  const minutesList = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

  // Display 12-hour formatted text on button
  const displayFormatted = () => {
    if (!value) return null;
    const { hour, minute, period } = parseTime(value);
    return `${hour}:${minute} ${period}`;
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-bold text-[#261812] dark:text-[#ffede6] uppercase tracking-wider mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[17px] text-[#ff6b00]">{icon}</span>
          <span>{label}</span>
        </span>
        {required && <span className="text-[10px] text-[#ff6b00] font-bold">Required</span>}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
          isOpen
            ? 'border-[#ff6b00] ring-2 ring-[#ff6b00]/20 bg-white dark:bg-[#1a120e]'
            : 'border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] hover:border-[#ff6b00]'
        }`}
      >
        <span className={`text-sm font-medium ${value ? 'text-[#261812] dark:text-[#ffede6]' : 'text-[#5a4136]/60 dark:text-[#ffb693]/60'}`}>
          {displayFormatted() || 'Select time...'}
        </span>
        <span className="material-symbols-outlined text-[20px] text-[#ff6b00] transition-colors">
          schedule
        </span>
      </button>

      {subtext && (
        <p className="text-[11px] text-[#5a4136] dark:text-[#ffb693] mt-1.5">
          {subtext}
        </p>
      )}

      {/* Floating Time Picker Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 z-50 w-64 p-3.5 rounded-2xl bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] shadow-2xl animate-fadeIn space-y-3.5 select-none">
          {/* Time Picker Columns */}
          <div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              {/* Hours Column */}
              <div>
                <span className="block text-[10px] font-bold text-[#5a4136] dark:text-[#ffb693] uppercase mb-1">
                  Hour
                </span>
                <div className="h-32 overflow-y-auto space-y-0.5 pr-0.5 border border-[#e2bfb0]/40 dark:border-[#5a4136]/40 rounded-xl p-1 bg-[#fff8f6]/50 dark:bg-[#1a120e]/50">
                  {hoursList.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleHourClick(h)}
                      className={`w-full py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                        selectedHour === h
                          ? 'bg-[#ff6b00] text-white'
                          : 'text-[#261812] dark:text-[#ffede6] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26]'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minutes Column */}
              <div>
                <span className="block text-[10px] font-bold text-[#5a4136] dark:text-[#ffb693] uppercase mb-1">
                  Minute
                </span>
                <div className="h-32 overflow-y-auto space-y-0.5 pr-0.5 border border-[#e2bfb0]/40 dark:border-[#5a4136]/40 rounded-xl p-1 bg-[#fff8f6]/50 dark:bg-[#1a120e]/50">
                  {minutesList.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMinuteClick(m)}
                      className={`w-full py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                        selectedMinute === m
                          ? 'bg-[#ff6b00] text-white'
                          : 'text-[#261812] dark:text-[#ffede6] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* AM / PM Column */}
              <div>
                <span className="block text-[10px] font-bold text-[#5a4136] dark:text-[#ffb693] uppercase mb-1">
                  Period
                </span>
                <div className="space-y-1.5 pt-0.5">
                  {['AM', 'PM'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePeriodClick(p)}
                      className={`w-full py-2.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        selectedPeriod === p
                          ? 'bg-[#ff6b00] text-white border-[#ff6b00] shadow-sm'
                          : 'border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] hover:border-[#ff6b00]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-2 border-t border-[#e2bfb0]/40 dark:border-[#5a4136]/40 flex items-center justify-between text-xs">
            {!required ? (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className="px-2 py-1 text-[11px] font-bold text-[#8c6d62] dark:text-[#ffb693] hover:text-red-500 transition-colors cursor-pointer"
              >
                Clear Time
              </button>
            ) : (
              <span className="text-[11px] font-bold text-[#ff6b00]">
                {selectedHour}:{selectedMinute} {selectedPeriod}
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 text-[11px] font-bold bg-[#fee3d8] dark:bg-[#3d2d26] text-[#ff6b00] hover:bg-[#ff6b00] hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
