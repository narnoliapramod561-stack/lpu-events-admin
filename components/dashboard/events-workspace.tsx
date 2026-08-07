'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { trackAdminEventView, trackAdminSearch } from '@/components/observability/analytics-provider';
import { DatePicker } from '@/components/dashboard/date-picker';
import { TimePicker } from '@/components/dashboard/time-picker';

const CATEGORY_MAP: Record<string, string[]> = {
  Academics: ['Seminar', 'Guest Lecture', 'Workshop', 'Internship', 'Capstone', 'Others'],
  Cultural: ['Music', 'Dance', 'Theatre', 'Social Media', 'Others'],
  Innovation: ['Hackathon', 'Technical Events', 'Project Expo', 'Workshop', 'Seminar', 'Others'],
  Entrepreneurship: [
    'B-Plan Competition',
    'Pitch Fest',
    'Conclave',
    'Bootcamp',
    'Panel Discussion',
    'Expo',
    'Seminar',
    'Others',
  ],
  Schools: [
    'School of AI and Emerging Technologies',
    'School of Bio Engineering and Biosciences',
    'School of Chemical Engineering and Physical Sciences',
    'School of Computer Applications',
    'School of Computer Science and Engineering',
    'School of Computing and Artificial Intelligence',
    'School of Electronics and Electrical Engineering',
    'School of Mechanical Engineering',
    'Lovely School of Architecture and Design',
    'School of Design (Fashion Design & Technology)',
    'School of Design (Interior & Product Design)',
    'School of Design (Multimedia)',
    'School of Liberal and Creative Arts (Films, Theatre and Music)',
    'School of Liberal and Creative Arts (Fine Arts)',
    'School of Liberal and Creative Arts (Journalism and Mass Communication)',
    'School of Liberal and Creative Arts (Social Sciences and Languages)',
    'Mittal School of Business',
    'School of Agriculture',
    'School of Hotel Management and Tourism',
    'School of Law',
    'School of Allied Medical Sciences',
    'School of Education',
    'School of Education (Physical Education)',
    'School of Pharmaceutical Sciences',
    'School of Polytechnic',
  ],
  'Community Services': ['Donation Drives', 'Environment', 'Healthcare', 'Others'],
  'Day Celebrations': ['National Days', 'Cultural Days', 'Fest Days', 'Awareness Days', 'Others'],
  'Co-curricular': [
    'Skill Development',
    'Certifications',
    'Training Programs',
    'Competitions',
    'Others',
  ],
  'Student Clubs & Org': [
    'Technical Clubs',
    'Cultural Clubs',
    'Startup Clubs',
    'Literary Clubs',
    'Others',
  ],
  NCC: ['Camps', 'Training', 'Parades', 'Others'],
  NSS: ['Social Work', 'Campaigns', 'Awareness Drives', 'Others'],
  Fashion: ['Shows', 'Exhibitions', 'Others'],
  Others: ['Miscellaneous Events'],
};

const STUDENT_FIELD_OPTIONS = [
  { id: 'regNo', label: 'Registration No.' },
  { id: 'branch', label: 'Branch' },
  { id: 'semester', label: 'Semester' },
  { id: 'phone', label: 'Mobile No.' },
  { id: 'class', label: 'Class' },
  { id: 'school', label: 'School' },
];

const STUDENT_APP_URL = 'https://www.lpuevents.live';

interface TicketTier {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sold: number;
}

interface EventDetail {
  id: string;
  title: string;
  category: string;
  priceType: 'Paid' | 'Free';
  statusLabel: string;
  location: string;
  dates: string;
  time: string;
  imageUrl: string;
  isLive: boolean;
  registrations: number;
  checkedIn: number;
  revenue: string;
  targetCapacity: number;
  recentActivity: Array<{ action: string; time: string; icon: string }>;
  upcomingTasks: Array<{ text: string; alertType: 'error' | 'primary'; actionText: string }>;
  description?: string;
  ticketTiers?: TicketTier[];
  isFeatured?: boolean;
  isHidden?: boolean;
  rejection_reason?: string | null;
  organizerName?: string;
  organizerEmail?: string;
  organizerClub?: string;
}

interface EventsWorkspaceProps {
  onNavigateToTab?: (tab: string, eventId?: string) => void;
}

interface ApiEvent {
  id: string;
  title: string;
  category_id: string;
  is_free: boolean;
  status: 'published' | 'draft' | 'pending_approval' | 'cancelled';
  approval_status?: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  venue: string;
  starts_at: string;
  ends_at: string;
  cover_image_url: string;
  max_tickets: number;
  description: string;
  is_featured: boolean;
  is_hidden: boolean;
  organizer_id?: string;
  organizer_name?: string | null;
  organizer_email?: string | null;
  organizer_club?: string | null;
}

export function EventsWorkspace({ onNavigateToTab }: EventsWorkspaceProps) {
  const [events, setEvents] = useState<EventDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<
    'Overview' | 'Registration' | 'Attendees' | 'Payments' | 'Settings'
  >('Overview');
  const [searchQuery, setSearchQuery] = useState('');

  // Super Admin Filters State
  const [organizerFilter, setOrganizerFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [featuredEvents, setFeaturedEvents] = useState<Record<string, boolean>>({});
  const [hiddenEvents, setHiddenEvents] = useState<Record<string, boolean>>({});

  // Settings Edit states (matching CreateEvent form)
  const [editActiveSection, setEditActiveSection] = useState<number>(1);
  const [editTitle, setEditTitle] = useState('');
  const [editShortDesc, setEditShortDesc] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSubcategory, setEditSubcategory] = useState('');
  const [editFullDesc, setEditFullDesc] = useState('');
  const [showEditCatSearch, setShowEditCatSearch] = useState(false);
  const [editCatSearch, setEditCatSearch] = useState('');
  const [showEditSubSearch, setShowEditSubSearch] = useState(false);
  const [editSubSearch, setEditSubSearch] = useState('');
  const [editCatSearchHighlight, setEditCatSearchHighlight] = useState(-1);
  const [editSubSearchHighlight, setEditSubSearchHighlight] = useState(-1);
  const editCatSearchRef = useRef<HTMLInputElement>(null);
  const editSubSearchRef = useRef<HTMLInputElement>(null);

  // Refs for auto-resizing textareas
  const editShortDescRef = useRef<HTMLTextAreaElement>(null);
  const editFullDescRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textareas when content changes
  useEffect(() => {
    const textarea = editShortDescRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [editShortDesc]);

  useEffect(() => {
    const textarea = editFullDescRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [editFullDesc]);

  const [editStartDate, setEditStartDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editStartPeriod, setEditStartPeriod] = useState<'AM' | 'PM'>('AM');
  const [editEndDate, setEditEndDate] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editEndPeriod, setEditEndPeriod] = useState<'AM' | 'PM'>('AM');
  const [editLocation, setEditLocation] = useState('');
  const [editVenueType, setEditVenueType] = useState('');
  const [editBlockNo, setEditBlockNo] = useState('');
  const [editRoomNo, setEditRoomNo] = useState('');
  const [editOtherVenue, setEditOtherVenue] = useState('');
  const [showEditVenueDropdown, setShowEditVenueDropdown] = useState(false);
  const editVenueDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editVenueType === 'Shanti Devi Mittal Auditorium' || editVenueType === 'Baldev Raj Mittal Auditorium') {
      setEditLocation(editVenueType);
    } else if (editVenueType === 'Block & Room') {
      if (editBlockNo.trim() && editRoomNo.trim()) {
        setEditLocation(`Block ${editBlockNo.trim()}, Room ${editRoomNo.trim()}`);
      } else {
        setEditLocation('');
      }
    } else if (editVenueType === 'Other Venue') {
      setEditLocation(editOtherVenue.trim());
    } else {
      setEditLocation('');
    }
  }, [editVenueType, editBlockNo, editRoomNo, editOtherVenue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (editVenueDropdownRef.current && !editVenueDropdownRef.current.contains(event.target as Node)) {
        setShowEditVenueDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [editRegRequired, setEditRegRequired] = useState('yes');
  const [editStudentFieldOptions, setEditStudentFieldOptions] = useState(STUDENT_FIELD_OPTIONS);
  const [editRequiredStudentFields, setEditRequiredStudentFields] = useState<string[]>([]); // Deselected by default
  const [isEditAddingCustomField, setIsEditAddingCustomField] = useState(false);
  const [editCustomFieldText, setEditCustomFieldText] = useState('');
  const [editRegPlatform, setEditRegPlatform] = useState('lpu_events');
  const [editRegType, setEditRegType] = useState('paid');
  const [editExternalLink, setEditExternalLink] = useState('');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const response = await fetch('/api/organizer/events');
      if (response.ok) {
        const resJson = await response.json();
        const eventsArray = Array.isArray(resJson) ? resJson : (resJson.data && Array.isArray(resJson.data) ? resJson.data : []);
        const mapped: EventDetail[] = eventsArray.map((evt: ApiEvent) => ({
          id: evt.id,
          title: evt.title,
          category: evt.category_id || 'Uncategorized',
          priceType: evt.is_free ? 'Free' : 'Paid',
          statusLabel: evt.status === 'published' ? 'Registration Open' 
            : evt.status === 'pending_approval' ? 'Pending Super Admin Approval'
            : evt.status === 'draft' && evt.approval_status === 'rejected' ? 'Rejected'
            : evt.status === 'draft' ? 'Draft' 
            : evt.status,
          location: evt.venue || '',
          dates: `${new Date(evt.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(evt.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          time: `${new Date(evt.starts_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${new Date(evt.ends_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
          imageUrl: evt.cover_image_url || '',
          isLive: evt.status === 'published' && new Date(evt.starts_at) <= new Date() && new Date(evt.ends_at) >= new Date(),
          registrations: 0,
          checkedIn: 0,
          revenue: '₹0',
          targetCapacity: evt.max_tickets || 0,
          description: evt.description || '',
          recentActivity: [],
          upcomingTasks: [],
          isFeatured: !!evt.is_featured,
          isHidden: !!evt.is_hidden,
          rejection_reason: evt.rejection_reason ?? null,
          organizerName: evt.organizer_name ?? undefined,
          organizerEmail: evt.organizer_email ?? undefined,
          organizerClub: evt.organizer_club ?? undefined,
        }));
        setEvents(mapped);
        setFeaturedEvents((prev) => {
          const next = { ...prev };
          eventsArray.forEach((evt: ApiEvent) => {
            if (evt.is_featured) next[evt.id] = true;
          });
          return next;
        });
        setHiddenEvents((prev) => {
          const next = { ...prev };
          eventsArray.forEach((evt: ApiEvent) => {
            if (evt.is_hidden) next[evt.id] = true;
          });
          return next;
        });
      } else {
        setFetchError('Failed to load events');
      }
    } catch {
      setFetchError('Network error loading events');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchEvents();
    })();
  }, [fetchEvents]);

  useEffect(() => {
    if (!searchQuery.trim()) return;
    const timeoutId = window.setTimeout(() => {
      trackAdminSearch(searchQuery.trim(), 'events_workspace');
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const toggleEditRequiredField = (fieldId: string) => {
    setEditRequiredStudentFields((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  const handleEditAddCustomField = () => {
    const trimmed = editCustomFieldText.trim();
    if (!trimmed) return;
    const customId = `custom_${trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    if (!editStudentFieldOptions.some((f) => f.id === customId)) {
      setEditStudentFieldOptions((prev) => [...prev, { id: customId, label: trimmed }]);
    }
    if (!editRequiredStudentFields.includes(customId)) {
      setEditRequiredStudentFields((prev) => [...prev, customId]);
    }
    setEditCustomFieldText('');
    setIsEditAddingCustomField(false);
  };

  const [editTicketPrice, setEditTicketPrice] = useState('');
  const [editTotalTickets, setEditTotalTickets] = useState<number | ''>('');
  const [editSalesStartDate, setEditSalesStartDate] = useState('');
  const [editSalesEndDate, setEditSalesEndDate] = useState('');
  const [editMaxTickets, setEditMaxTickets] = useState<number | ''>('');

  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId);
  }, [events, selectedEventId]);

  useEffect(() => {
    if (selectedEventId) {
      trackAdminEventView(selectedEventId, selectedEvent?.title);
    }
  }, [selectedEventId, selectedEvent]);

  // Derive the list of distinct organizers from the loaded events so the
  // filter only shows organizers that actually own a listed event.
  const organizerOptions = useMemo(() => {
    const names = new Set<string>();
    events.forEach((evt) => {
      if (evt.organizerName) names.add(evt.organizerName);
    });
    return Array.from(names).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      const matchesSearch =
        evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        evt.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (evt.organizerName ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || evt.category === categoryFilter;
      const matchesOrganizer = organizerFilter === 'All' || evt.organizerName === organizerFilter;
      return matchesSearch && matchesCategory && matchesOrganizer;
    });
  }, [events, searchQuery, categoryFilter, organizerFilter]);

  // Sync settings inputs when selectedEventId changes
  useEffect(() => {
    (async () => {
      if (selectedEvent) {
        setEditTitle(selectedEvent.title);
        
        const loc = selectedEvent.location || '';
        if (loc === 'Shanti Devi Mittal Auditorium' || loc === 'Baldev Raj Mittal Auditorium') {
          setEditVenueType(loc);
          setEditBlockNo('');
          setEditRoomNo('');
          setEditOtherVenue('');
        } else {
          const match = loc.match(/^Block\s+(.*?),\s*Room\s+(.*?)$/i);
          if (match) {
            setEditVenueType('Block & Room');
            setEditBlockNo(match[1]);
            setEditRoomNo(match[2]);
            setEditOtherVenue('');
          } else if (loc) {
            setEditVenueType('Other Venue');
            setEditOtherVenue(loc);
            setEditBlockNo('');
            setEditRoomNo('');
          } else {
            setEditVenueType('');
            setEditBlockNo('');
            setEditRoomNo('');
            setEditOtherVenue('');
          }
        }

        setEditCategory(selectedEvent.category);
        setEditShortDesc(selectedEvent.description || '');
        setEditFullDesc(selectedEvent.description || '');

        const startDate = selectedEvent.dates.split(' - ')[0];
        const endDate = selectedEvent.dates.split(' - ')[1];
        const timeParts = selectedEvent.time.split(' - ');
        const startTime = timeParts[0] ? timeParts[0].replace(/[^\d:]/g, '') : '';
        const endTime = timeParts[1] ? timeParts[1].replace(/[^\d:]/g, '') : '';

        const startDateObj = new Date(startDate + ' ' + startTime);
        const endDateObj = new Date(endDate + ' ' + endTime);

        if (!isNaN(startDateObj.getTime())) {
          const iso = startDateObj.toISOString();
          setEditStartDate(iso.split('T')[0]);
          setEditStartTime(iso.split('T')[1].slice(0,5)); // HH:MM
        } else {
          setEditStartDate('');
          setEditStartTime('');
        }
        if (!isNaN(endDateObj.getTime())) {
          const iso = endDateObj.toISOString();
          setEditEndDate(iso.split('T')[0]);
          setEditEndTime(iso.split('T')[1].slice(0,5));
        } else {
          setEditEndDate('');
          setEditEndTime('');
        }
        setEditSubcategory('');
        setEditRegRequired('yes');
        setEditRegPlatform('lpu_events');
        setEditRegType(selectedEvent.priceType === 'Free' ? 'free' : 'paid');
        setEditTicketPrice(selectedEvent.priceType === 'Free' ? '0' : '');
        setEditTotalTickets(selectedEvent.targetCapacity || '');
        setEditSalesStartDate('');
        setEditSalesEndDate('');
        setEditMaxTickets('');
      }
    })();
  }, [selectedEvent]);

  const handleSaveSettings = async () => {
    if (!selectedEventId || !selectedEvent) return;

    const convertTo24Hour = (time12h: string, period: 'AM' | 'PM') => {
      const [hoursStr, minutesStr] = time12h.split(':');
      let hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    const updates: Partial<ApiEvent> = {};
    if (editTitle !== selectedEvent.title) updates.title = editTitle;
    if (editLocation !== selectedEvent.location) updates.venue = editLocation;
    if (editCategory !== selectedEvent.category) updates.category_id = editCategory;
    if (editFullDesc !== selectedEvent.description) updates.description = editFullDesc || editShortDesc;
    if (editStartDate && editStartTime) {
      const start24 = convertTo24Hour(editStartTime, editStartPeriod);
      updates.starts_at = new Date(`${editStartDate}T${start24}`).toISOString();
    }
    if (editEndDate && editEndTime) {
      const end24 = convertTo24Hour(editEndTime, editEndPeriod);
      updates.ends_at = new Date(`${editEndDate}T${end24}`).toISOString();
    }
    if (editRegType === 'free') updates.is_free = true;
    if (editRegType === 'paid') updates.is_free = false;

    if (Object.keys(updates).length === 0) {
      alert('No changes to save.');
      return;
    }

    try {
      const response = await fetch(`/api/organizer/events/${selectedEventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updated = await response.json();
        setEvents((prev) =>
          prev.map((evt) => (evt.id === selectedEventId ? { ...evt, ...updated } : evt))
        );
        alert('Event settings updated successfully!');
      } else {
        const result = await response.json().catch(() => ({}));
        alert(result.error || 'Failed to update event');
      }
    } catch {
      alert('Network error. Please try again.');
    }
  };

  const handleEditCategoryChange = (val: string) => {
    setEditCategory(val);
    setEditSubcategory('');
    setShowEditCatSearch(false);
    setEditCatSearch('');
    setEditCatSearchHighlight(-1);
  };

  const handleEditCatSearchSelect = (catName: string) => {
    setEditCategory(catName);
    setEditSubcategory('');
    setShowEditCatSearch(false);
    setEditCatSearch('');
    setEditCatSearchHighlight(-1);
  };

  const handleEditSubSearchSelect = (subName: string) => {
    setEditSubcategory(subName);
    // Auto-select category from the selected subcategory
    for (const [cat, subs] of Object.entries(CATEGORY_MAP)) {
      if (subs.includes(subName)) {
        setEditCategory(cat);
        break;
      }
    }
    setShowEditSubSearch(false);
    setEditSubSearch('');
    setEditSubSearchHighlight(-1);
  };

  const handleEditRegTypeChange = (type: string) => {
    setEditRegType(type);
    if (type === 'free') {
      setEditTicketPrice('0');
    } else {
      setEditTicketPrice('');
    }
  };

  // View state 1: Events list page
  if (selectedEventId === null || !selectedEvent) {
    return (
      <div className="flex-grow w-full max-w-[1400px] mx-auto flex flex-col gap-8 pb-16 animate-fadeIn">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-4 w-full">
          <div>
            <h2 className="font-display text-[32px] font-semibold text-[#ffba93] tracking-tight">
              Events
            </h2>
            <p className="font-body-lg text-white/60 mt-2 max-w-2xl text-lg">
              Manage and monitor all your existing events across different venues.
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
              {organizerOptions.map((name) => (
                <option key={name} value={name} className="bg-[#050507]">
                  {name}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#ff914d]"
            >
              <option value="All" className="bg-[#050507]">
                All Categories
              </option>
              {/* Spacer comment intentionally removed in cleanup*/}
              {/* end */}
              {/* spacing-original */}
              {/* trimmed */}
              {Object.keys(CATEGORY_MAP).map((cat) => (
                <option key={cat} value={cat} className="bg-[#050507]">
                  {cat}
                </option>
              ))}
            </select>

            <div className="w-full md:w-64 relative group focus-within:ring-2 focus-within:ring-[#ff914d]/20 rounded-lg transition-all">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-[#ff914d] transition-colors">
                search
              </span>
              <input
                className="w-full bg-white/[0.03] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#ff914d] transition-colors"
                placeholder="Search events..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Event Cards List */}
        <div className="flex flex-col gap-8">
          {loading && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-white/40">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-white/10 border-t-[#ff914d] mb-3"></div>
              <p>Loading events...</p>
            </div>
          )}
          {fetchError && !loading && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-8 text-center text-rose-400">
              <p className="font-semibold mb-2">{fetchError}</p>
              <button onClick={fetchEvents} className="px-4 py-2 bg-rose-500/20 rounded-lg text-sm font-bold hover:bg-rose-500/30 transition-all">
                Retry
              </button>
            </div>
          )}
          {!loading && !fetchError && filteredEvents.length === 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-white/40">
              <span className="material-symbols-outlined text-4xl mb-2 block">calendar_today</span>
              No events found.
            </div>
          )}
          {!loading && !fetchError && filteredEvents.map((evt) => {
              const capacityPercent = evt.targetCapacity > 0 ? Math.round((evt.registrations / evt.targetCapacity) * 100) : 0;
              const isFeatured = !!featuredEvents[evt.id];
              const isHidden = !!hiddenEvents[evt.id];

              return (
                <div
                  key={evt.id}
                  className={`bg-white/5 border rounded-[20px] overflow-hidden flex flex-col xl:flex-row transition-all duration-300 ${
                    isHidden
                      ? 'border-rose-500/20 opacity-60'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Left: Poster */}
                  <div className="xl:w-2/5 h-64 xl:h-auto relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050507] to-transparent opacity-60 z-10"></div>
                    {evt.imageUrl && (
                      <img
                        alt={evt.title}
                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                        src={evt.imageUrl}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2">
                      <span
                        className={`px-3 py-1 rounded-full bg-surface-dim/80 backdrop-blur-md border border-white/15 text-white text-xs font-semibold tracking-wider uppercase flex items-center gap-1.5`}
                      >
                        {evt.isLive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ff914d] animate-pulse"></span>
                        )}
                        {evt.statusLabel}
                      </span>
                      {isFeatured && (
                        <span className="px-3 py-1 rounded-full bg-[#ff914d] text-[#050507] text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                          ★ FEATURED
                        </span>
                      )}
                      {isHidden && (
                        <span className="px-3 py-1 rounded-full bg-rose-500/80 text-white text-xs font-bold uppercase tracking-wider">
                          HIDDEN
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Details & Metrics */}
                  <div className="xl:w-3/5 p-8 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-display text-2xl font-bold text-white">{evt.title}</h3>

                        {/* Super Admin Quick Actions Menu */}
                        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/organizer/events/${evt.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ is_featured: !isFeatured }),
                                });
                                if (response.ok) {
                                  setFeaturedEvents((prev) => ({ ...prev, [evt.id]: !prev[evt.id] }));
                                } else {
                                  const result = await response.json().catch(() => ({}));
                                  alert(result.error || 'Failed to update featured status');
                                }
                              } catch {
                                alert('Network error. Please try again.');
                              }
                            }}
                            className={`p-1.5 rounded text-xs font-bold transition-all ${
                              isFeatured
                                ? 'text-[#ff914d] bg-[#ff914d]/10'
                                : 'text-white/40 hover:text-white'
                            }`}
                            title={isFeatured ? 'Unfeature Event' : 'Feature Event'}
                          >
                            <span className="material-symbols-outlined text-base">star</span>
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/organizer/events/${evt.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ is_hidden: !isHidden }),
                                });
                                if (response.ok) {
                                  setHiddenEvents((prev) => ({ ...prev, [evt.id]: !prev[evt.id] }));
                                } else {
                                  const result = await response.json().catch(() => ({}));
                                  alert(result.error || 'Failed to update hidden status');
                                }
                              } catch {
                                alert('Network error. Please try again.');
                              }
                            }}
                            className={`p-1.5 rounded text-xs font-bold transition-all ${
                              isHidden
                                ? 'text-rose-400 bg-rose-500/10'
                                : 'text-white/40 hover:text-white'
                            }`}
                            title={isHidden ? 'Unhide Event' : 'Hide Event'}
                          >
                            <span className="material-symbols-outlined text-base">
                              visibility_off
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              alert(`Viewing organizer details for event: ${evt.title}`)
                            }
                            className="p-1.5 rounded text-xs text-white/40 hover:text-white transition-all"
                            title="View Organizer"
                          >
                            <span className="material-symbols-outlined text-base">
                              corporate_fare
                            </span>
                          </button>
                          <button
                            onClick={async () => {
                              if (
                                confirm(
                                  'Are you sure you want to delete this event? This action cannot be undone.'
                                )
                              ) {
                                try {
                                  const response = await fetch(`/api/organizer/events/${evt.id}`, {
                                    method: 'DELETE',
                                  });
                                  if (response.ok || response.status === 204) {
                                    setEvents((prev) => prev.filter((e) => e.id !== evt.id));
                                  } else {
                                    const result = await response.json().catch(() => ({}));
                                    alert(result.error || 'Failed to delete event');
                                  }
                                } catch {
                                  alert('Network error. Please try again.');
                                }
                              }
                            }}
                            className="p-1.5 rounded text-xs text-rose-400 hover:bg-rose-500/10 transition-all"
                            title="Delete Event"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>

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
                      <div className="flex items-center gap-2 mt-4">
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/40">
                          {evt.category}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/40">
                          {evt.priceType}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#ff914d]/10 border border-[#ff914d]/20 text-[10px] font-bold uppercase tracking-wider text-[#ff914d]">
                          Organizer Event
                        </span>
                      </div>
                    </div>
                    <div className="mt-8 border-t border-white/10 pt-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                        <div className="flex gap-8">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1 font-bold">
                              Registrations
                            </p>
                            <p className="font-display text-xl font-bold text-[#ff914d] tracking-tight">
                              {evt.registrations}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1 font-bold">
                              Revenue
                            </p>
                            <p className="font-display text-xl font-bold text-white tracking-tight">
                              {evt.revenue}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1 font-bold">
                              Capacity Filled
                            </p>
                            <p className="font-display text-xl font-bold text-white tracking-tight">
                              {capacityPercent}%
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedEventId(evt.id)}
                          className="bg-[#ff914d] text-[#050507] hover:bg-[#e07530] font-bold transition-all px-6 py-3 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-2"
                        >
                          Manage Event
                          <span className="material-symbols-outlined text-[18px]">
                            arrow_forward
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>
    );
  }

  // View state 2: Event Workspace View
  const percentFilled = Math.round(
    (selectedEvent.registrations / selectedEvent.targetCapacity) * 100
  );
  const strokeDashoffset = 251.2 - (251.2 * percentFilled) / 100;

  return (
    <div className="flex-1 w-full mx-auto flex flex-col gap-8 pb-32 animate-fadeIn">
      {/* 1. Header with Breadcrumbs */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-white/40 text-xs font-semibold uppercase tracking-wider">
          <span
            className="hover:text-white cursor-pointer transition-colors"
            onClick={() => setSelectedEventId(null)}
          >
            Events
          </span>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <span className="text-[#ff914d]">{selectedEvent.title}</span>
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight font-display">
          Event Workspace
        </h2>
        <p className="text-base text-white/60 max-w-2xl">
          Manage every aspect of this event from one place.
        </p>
      </section>

      {/* 2. Event Hero Banner */}
      <section className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row gap-6 relative overflow-hidden group transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-r from-[#ff914d]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
        <div className="w-full md:w-64 h-48 md:h-40 shrink-0 rounded-lg overflow-hidden border border-white/10 relative bg-white/5 flex items-center justify-center">
          {selectedEvent.imageUrl ? (
            <img
              className="w-full h-full object-cover"
              src={selectedEvent.imageUrl}
              alt={selectedEvent.title}
            />
          ) : (
            <span className="material-symbols-outlined text-5xl text-white/20">event</span>
          )}
          {selectedEvent.isLive && (
            <div className="absolute top-3 left-3 bg-[#ff914d] text-[#050507] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> LIVE
            </div>
          )}
        </div>
        <div className="flex flex-col justify-center flex-1 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/40">
                {selectedEvent.category}
              </span>
              <span className="px-2.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/40">
                {selectedEvent.priceType}
              </span>
              <span className="px-2.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-[#ff914d] border-[#ff914d]/30">
                {selectedEvent.statusLabel}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-white font-display">{selectedEvent.title}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-white/60 text-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#ff914d]">
                location_on
              </span>
              <span>{selectedEvent.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[#ff914d]">
                calendar_month
              </span>
              <span>{selectedEvent.dates}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Overview (KPIs) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between h-32 hover:border-white/20 transition-all">
          <div className="flex justify-between items-start text-white/40 font-semibold uppercase tracking-wider text-xs">
            <span>Registrations</span>
            <span className="material-symbols-outlined text-[20px] text-[#ff914d]">how_to_reg</span>
          </div>
          <div className="text-3xl font-bold text-white font-display leading-none">
            {selectedEvent.registrations}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between h-32 hover:border-white/20 transition-all">
          <div className="flex justify-between items-start text-white/40 font-semibold uppercase tracking-wider text-xs">
            <span>Checked In</span>
            <span className="material-symbols-outlined text-[20px] text-[#ff914d]">
              check_circle
            </span>
          </div>
          <div className="text-3xl font-bold text-white font-display leading-none">
            {selectedEvent.checkedIn}{' '}
            <span className="text-sm font-semibold text-white/40 font-body-sm">
              / {selectedEvent.registrations}
            </span>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between h-32 hover:border-white/20 transition-all">
          <div className="flex justify-between items-start text-white/40 font-semibold uppercase tracking-wider text-xs">
            <span>Revenue</span>
            <span className="material-symbols-outlined text-[20px] text-[#ff914d]">payments</span>
          </div>
          <div className="text-3xl font-bold text-[#ff914d] font-display leading-none">
            {selectedEvent.revenue}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between h-32 hover:border-white/20 transition-all">
          <div className="flex justify-between items-start text-white/40 font-semibold uppercase tracking-wider text-xs">
            <span>Status</span>
            <span className="material-symbols-outlined text-[20px] text-[#ff914d]">sensors</span>
          </div>
          <div className="text-3xl font-bold text-white font-display leading-none">Active</div>
        </div>
      </section>

      {/* 4. Workspace Navigation Tabs */}
      <nav className="border-b border-white/10 flex gap-6 overflow-x-auto select-none">
        {['Overview', 'Registration', 'Attendees', 'Payments', 'Settings'].map((tab) => {
          const isActive = workspaceTab === tab;
          return (
            <button
              key={tab}
              onClick={() => {
                if (tab === 'Attendees' && onNavigateToTab) {
                  onNavigateToTab('attendees', selectedEvent.id);
                } else if (tab === 'Payments' && onNavigateToTab) {
                  onNavigateToTab('payments', selectedEvent.id);
                } else {
                  setWorkspaceTab(
                    tab as 'Overview' | 'Registration' | 'Attendees' | 'Payments' | 'Settings'
                  );
                }
              }}
              className={`pb-3 text-sm font-semibold uppercase tracking-wider border-b-2 transition-all ${
                isActive
                  ? 'border-[#ff914d] text-[#ff914d]'
                  : 'border-transparent text-white/40 hover:text-white hover:border-white/10'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </nav>

      {/* Tab Content rendering */}
      {workspaceTab === 'Overview' && (
        <>
          {/* 5. Quick Actions Grid */}
          <section className="space-y-4">
            <h3 className="text-xl font-bold text-white font-display">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Card 1: Edit Event */}
              <button
                onClick={() => setWorkspaceTab('Settings')}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 flex gap-4 text-left transition-all hover:bg-white/10 hover:border-white/20 group"
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-[#ff914d]/15 group-hover:text-[#ff914d] transition-colors text-white/60">
                  <span className="material-symbols-outlined text-[20px]">edit</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white mb-1">Edit Event</h4>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Update event information, poster and schedule details.
                  </p>
                </div>
              </button>

              {/* Card 1b: Approval Status — pending approval */}
              {selectedEvent.statusLabel === 'Pending Super Admin Approval' && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400">
                    <span className="material-symbols-outlined">hourglass_top</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-amber-400 mb-1">🟡 Pending Super Admin Approval</h4>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Waiting for Super Admin review. You will be notified once it is reviewed.
                    </p>
                  </div>
                </div>
              )}

              {/* Card 1c: Rejected event */}
              {selectedEvent.statusLabel === 'Rejected' && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0 text-rose-400">
                    <span className="material-symbols-outlined">cancel</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-rose-400 mb-1">🔴 Rejected</h4>
                    <p className="text-xs text-white/50 leading-relaxed mb-3">
                      Reason: {selectedEvent.rejection_reason || 'No reason provided.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          if (onNavigateToTab) {
                            onNavigateToTab('create-event', selectedEvent.id);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-all"
                      >
                        Edit Event
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/organizer/events/${selectedEvent.id}/publish`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                            });
                            if (response.ok) {
                              const result = await response.json().catch(() => ({}));
                              if (result.requires_approval) {
                                setEvents((prev) =>
                                  prev.map((evt) =>
                                    evt.id === selectedEvent.id
                                      ? { ...evt, statusLabel: 'Pending Super Admin Approval' }
                                      : evt
                                  )
                                );
                                alert('Your paid event has been resubmitted for Super Admin approval.');
                              } else {
                                setEvents((prev) =>
                                  prev.map((evt) =>
                                    evt.id === selectedEvent.id
                                      ? { ...evt, statusLabel: 'Registration Open' }
                                      : evt
                                  )
                                );
                                alert('Event published successfully! It is now visible to students.');
                              }
                            } else {
                              const result = await response.json().catch(() => ({}));
                              alert(result.message || result.error || 'Failed to resubmit event');
                            }
                          } catch {
                            alert('Network error. Please try again.');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#ff914d]/20 border border-[#ff914d]/30 text-[#ff914d] text-xs font-semibold hover:bg-[#ff914d]/30 transition-all"
                      >
                        Resubmit
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Card 2: Manage Attendees */}
              <button
                onClick={() => onNavigateToTab && onNavigateToTab('attendees', selectedEvent.id)}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 flex gap-4 text-left transition-all hover:bg-white/10 hover:border-white/20 group"
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-[#ff914d]/15 group-hover:text-[#ff914d] transition-colors text-white/60">
                  <span className="material-symbols-outlined text-[20px]">group</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white mb-1">Manage Attendees</h4>
                  <p className="text-xs text-white/50 leading-relaxed">
                    View all registered attendees, manage scan tickets, and check-ins.
                  </p>
                </div>
              </button>

              {/* Card 3: View Payments */}
              <button
                onClick={() => onNavigateToTab && onNavigateToTab('payments', selectedEvent.id)}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 flex gap-4 text-left transition-all hover:bg-white/10 hover:border-white/20 group"
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-[#ff914d]/15 group-hover:text-[#ff914d] transition-colors text-white/60">
                  <span className="material-symbols-outlined text-[20px]">payments</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white mb-1">View Payments</h4>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Review transactions status ledger, refunds, and revenue breakdown.
                  </p>
                </div>
              </button>

              {/* Card 4: View Public Event */}
              <a
                href={`${STUDENT_APP_URL}/?event=${selectedEvent.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/5 border border-white/10 rounded-2xl p-5 flex gap-4 text-left transition-all hover:bg-white/10 hover:border-white/20 group"
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-[#ff914d]/15 group-hover:text-[#ff914d] transition-colors text-white/60">
                  <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white mb-1">View Public Event</h4>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Open the public event discovery web page in a new browser window.
                  </p>
                </div>
              </a>

              {/* Card 5: Share Event */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${STUDENT_APP_URL}/?event=${selectedEvent.id}`);
                  alert('Copied public event link to clipboard!');
                }}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 flex gap-4 text-left transition-all hover:bg-white/10 hover:border-white/20 group"
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-[#ff914d]/15 group-hover:text-[#ff914d] transition-colors text-white/60">
                  <span className="material-symbols-outlined text-[20px]">share</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white mb-1">Share Event</h4>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Copy the shareable ticket booking URL link to your clipboard.
                  </p>
                </div>
              </button>

              {/* Card 6: Cancel Event */}
              <button
                onClick={async () => {
                  const confirmCancel = window.confirm(
                    'Are you sure you want to cancel this event? This will stop registrations and notify all booked users.'
                  );
                  if (confirmCancel) {
                    try {
                      const response = await fetch(`/api/organizer/events/${selectedEvent.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'cancelled' }),
                      });
                      if (response.ok) {
                        setEvents((prev) =>
                          prev.map((evt) =>
                            evt.id === selectedEvent.id
                              ? { ...evt, statusLabel: 'Cancelled', isLive: false }
                              : evt
                          )
                        );
                        alert('Event cancelled successfully.');
                      } else {
                        const result = await response.json().catch(() => ({}));
                        alert(result.error || 'Failed to cancel event');
                      }
                    } catch {
                      alert('Network error. Please try again.');
                    }
                  }
                }}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 flex gap-4 text-left transition-all hover:bg-white/10 hover:border-white/20 group"
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-red-500/15 group-hover:text-red-400 transition-colors text-white/60">
                  <span className="material-symbols-outlined text-[20px]">cancel</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white mb-1">Cancel Event</h4>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Cancel the event scheduling and begin the automated refund flow.
                  </p>
                </div>
              </button>
            </div>
          </section>

          {/* 6. Split Layout (Recent Activity & Registration Health) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Column (Activity & Tasks) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Recent Activity */}
              <section className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
                <h3 className="text-lg font-bold text-white font-display">Recent Activity</h3>
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[1.15rem] before:-translate-x-px before:h-full before:w-0.5 before:bg-white/10">
                  {selectedEvent.recentActivity.length === 0 ? (
                    <div className="text-sm text-white/40 pl-6 py-4">
                      No recent activity logs available.
                    </div>
                  ) : (
                    selectedEvent.recentActivity.map((act, index) => (
                      <div key={index} className="relative flex items-start gap-4">
                        <div className="w-9 h-9 rounded-full bg-[#050507] border border-white/10 flex items-center justify-center shrink-0 relative z-10 text-[#ff914d]">
                          <span className="material-symbols-outlined text-[16px]">{act.icon}</span>
                        </div>
                        <div className="flex-grow pt-1">
                          <p className="text-sm text-white font-semibold">{act.action}</p>
                          <p className="text-xs text-white/40 mt-0.5">{act.time}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Upcoming Tasks */}
              <section className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
                <h3 className="text-lg font-bold text-white font-display">Upcoming Tasks</h3>
                <div className="space-y-3">
                  {selectedEvent.upcomingTasks.map((task, index) => (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white/[0.02] rounded-xl border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            task.alertType === 'error'
                              ? 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                              : 'bg-[#ff914d] shadow-[0_0_8px_rgba(255,145,77,0.4)]'
                          }`}
                        />
                        <span className="text-sm font-semibold text-white">{task.text}</span>
                      </div>
                      <button
                        onClick={() => alert(`Triggering task: ${task.text}`)}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-all w-full sm:w-auto"
                      >
                        {task.actionText}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right Column (Registration Health Circular Chart) */}
            <div className="lg:col-span-1">
              <section className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-6">
                <h3 className="text-lg font-bold text-white font-display">Registration Health</h3>

                {/* Circular Progress Bar */}
                <div className="relative w-40 h-40 mx-auto my-2">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      fill="none"
                      r="40"
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth="8"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      fill="none"
                      r="40"
                      stroke="#ff914d"
                      strokeDasharray="251.2"
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      strokeWidth="8"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
                    <span className="text-3xl font-bold text-white font-display leading-none">
                      {percentFilled}%
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 mt-1">
                      {selectedEvent.registrations} / {selectedEvent.targetCapacity}
                    </span>
                  </div>
                </div>

                {/* Health detail parameters list */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-white/5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
                      Registration Status
                    </span>
                    <span className="px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase">
                      Active
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-3 border-b border-white/5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
                      Performance Trend
                    </span>
                    <span className="flex items-center text-emerald-400 text-xs font-semibold">
                      <span className="material-symbols-outlined text-[16px] mr-1">
                        trending_up
                      </span>{' '}
                      +18%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
                      Estimated Sell Out
                    </span>
                    <span className="text-xs font-semibold text-white">3 Days Remaining</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </>
      )}

      {workspaceTab === 'Registration' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fadeIn">
          {/* Left Columns (Details & Tiers) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Registration Controls */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-6">
              <h3 className="text-lg font-bold text-white font-display">Registration Controls</h3>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/[0.02] p-4 rounded-xl border border-white/5">
                <div>
                  <div className="text-xs text-white/40 font-semibold uppercase tracking-wider">
                    Status
                  </div>
                  <div className="text-base font-bold text-white mt-1">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        selectedEvent.statusLabel === 'Registration Open'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : selectedEvent.statusLabel === 'Registration Paused'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          selectedEvent.statusLabel === 'Registration Open'
                            ? 'bg-emerald-400 animate-pulse'
                            : selectedEvent.statusLabel === 'Registration Paused'
                              ? 'bg-amber-400'
                              : 'bg-rose-400'
                        }`}
                      ></span>
                      {selectedEvent.statusLabel}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEvents((prev) =>
                        prev.map((evt) =>
                          evt.id === selectedEvent.id
                            ? { ...evt, statusLabel: 'Registration Open' }
                            : evt
                        )
                      );
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
                      selectedEvent.statusLabel === 'Registration Open'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    Open
                  </button>

                  <button
                    onClick={() => {
                      setEvents((prev) =>
                        prev.map((evt) =>
                          evt.id === selectedEvent.id
                            ? { ...evt, statusLabel: 'Registration Paused' }
                            : evt
                        )
                      );
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
                      selectedEvent.statusLabel === 'Registration Paused'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    Pause
                  </button>

                  <button
                    onClick={() => {
                      setEvents((prev) =>
                        prev.map((evt) =>
                          evt.id === selectedEvent.id
                            ? { ...evt, statusLabel: 'Registration Closed' }
                            : evt
                        )
                      );
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
                      selectedEvent.statusLabel === 'Registration Closed'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
                <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
                  <div className="text-xs text-white/40 font-semibold uppercase tracking-wider">
                    Target Capacity
                  </div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {selectedEvent.targetCapacity} seats
                  </div>
                </div>
                <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5">
                  <div className="text-xs text-white/40 font-semibold uppercase tracking-wider">
                    Total Registered
                  </div>
                  <div className="text-2xl font-bold text-[#ff914d] mt-1">
                    {selectedEvent.registrations} seats
                  </div>
                </div>
              </div>
            </div>

            {/* Ticket Tiers */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white font-display">
                  Ticket Tiers &amp; Quantities
                </h3>
              </div>

              <div className="border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50 text-xs font-semibold uppercase tracking-wider bg-white/2">
                      <th className="py-3 px-4">Tier Name</th>
                      <th className="py-3 px-4">Price</th>
                      <th className="py-3 px-4">Sold / Capacity</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm text-white/80">
                    {selectedEvent.ticketTiers?.map((tier) => (
                      <tr key={tier.id}>
                        <td className="py-3 px-4 font-semibold text-white">{tier.name}</td>
                        <td className="py-3 px-4">
                          {tier.price === 0 ? 'Free' : `₹${tier.price}`}
                        </td>
                        <td className="py-3 px-4">
                          {tier.sold} / {tier.quantity} sold
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              const newQty = prompt(
                                `Enter new capacity for ${tier.name}:`,
                                String(tier.quantity)
                              );
                              if (newQty !== null) {
                                const parsed = parseInt(newQty);
                                if (!isNaN(parsed) && parsed >= tier.sold) {
                                  setEvents((prev) =>
                                    prev.map((evt) => {
                                      if (evt.id === selectedEvent.id) {
                                        const updatedTiers =
                                          evt.ticketTiers?.map((t) =>
                                            t.id === tier.id ? { ...t, quantity: parsed } : t
                                          ) || [];
                                        const totalCap = updatedTiers.reduce(
                                          (acc, t) => acc + t.quantity,
                                          0
                                        );
                                        return {
                                          ...evt,
                                          ticketTiers: updatedTiers,
                                          targetCapacity: totalCap,
                                        };
                                      }
                                      return evt;
                                    })
                                  );
                                } else {
                                  alert(
                                    `Invalid quantity. Must be a number and at least equal to sold tickets (${tier.sold}).`
                                  );
                                }
                              }
                            }}
                            className="text-xs text-[#ff914d] hover:text-[#ffb36b] transition-colors font-semibold"
                          >
                            Edit Qty
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column (Checkout Holds Telemetry) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
              <h3 className="text-lg font-bold text-white font-display">Hold Telemetry</h3>
              <p className="text-xs text-white/40">Real-time locks & reservations metrics.</p>

              <div className="space-y-4 mt-2">
                <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-white/40 font-semibold uppercase tracking-wider">
                      5-Min Holds
                    </div>
                    <div className="text-lg font-bold text-white mt-1">4 active holds</div>
                  </div>
                  <span className="material-symbols-outlined text-[#ff914d]">hourglass_empty</span>
                </div>

                <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-white/40 font-semibold uppercase tracking-wider">
                      15-Min Payment Locks
                    </div>
                    <div className="text-lg font-bold text-white mt-1">2 locks</div>
                  </div>
                  <span className="material-symbols-outlined text-[#ff914d]">lock</span>
                </div>

                <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-white/40 font-semibold uppercase tracking-wider">
                      Conversion Rate
                    </div>
                    <div className="text-lg font-bold text-white mt-1">84.5%</div>
                  </div>
                  <span className="material-symbols-outlined text-emerald-400">trending_up</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {workspaceTab === 'Settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fadeIn">
          {/* General Settings Accordion Form */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Section 1: Event Information */}
            <div
              className={`rounded-3xl border border-white/10 bg-white/5 p-6 flex flex-col gap-6 transition-all duration-300 ${
                editActiveSection === 1
                  ? 'opacity-100 ring-1 ring-[#ff914d]/20 border-[#ff914d]/30'
                  : 'opacity-60 hover:opacity-80'
              }`}
            >
              <button
                className="w-full flex justify-between items-center text-left focus:outline-none"
                onClick={() => setEditActiveSection(editActiveSection === 1 ? 0 : 1)}
                type="button"
              >
                <div className="flex items-center gap-4">
                  {editTitle.trim() !== '' &&
                  editShortDesc.trim() !== '' &&
                  editCategory !== '' &&
                  editSubcategory !== '' &&
                  editFullDesc.trim() !== '' ? (
                    <div className="w-8 h-8 rounded-full bg-[#4ade80]/10 flex items-center justify-center text-[#4ade80] border border-[#4ade80]/20 animate-scaleIn">
                      <span className="material-symbols-outlined text-[18px]">check</span>
                    </div>
                  ) : (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border text-sm font-semibold transition-all duration-300 ${
                        editActiveSection === 1
                          ? 'bg-[#ff914d]/10 text-[#ff914d] border-[#ff914d]/20'
                          : 'bg-white/5 text-white/40 border-white/10'
                      }`}
                    >
                      1
                    </div>
                  )}
                  <h2
                    className={`text-lg font-bold font-display ${editActiveSection === 1 ? 'text-white' : 'text-white/80'}`}
                  >
                    Event Information
                  </h2>
                </div>
                <span
                  className={`material-symbols-outlined text-white/60 transition-transform duration-300 ${editActiveSection === 1 ? 'rotate-180' : ''}`}
                >
                  keyboard_arrow_down
                </span>
              </button>

              {editActiveSection === 1 && (
                <div className="pt-6 border-t border-white/5 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Col: Poster */}
                    <div className="flex flex-col gap-3">
                      <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                        Event Poster
                      </label>
                      {selectedEvent.imageUrl ? (
                        <div className="relative w-full h-64 border border-white/10 rounded-xl overflow-hidden group">
                          <img
                            src={selectedEvent.imageUrl}
                            alt="Poster"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                            <span className="material-symbols-outlined text-3xl text-white">
                              cloud_upload
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-64 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-[#ff914d]/50 hover:bg-white/5 transition-all cursor-pointer group">
                          <span className="material-symbols-outlined text-4xl text-white/40 group-hover:text-[#ff914d] transition-colors">
                            cloud_upload
                          </span>
                          <div className="text-center">
                            <p className="text-sm text-white">Drag &amp; drop image here</p>
                            <p className="text-xs text-white/40 mt-1">PNG, JPG up to 10MB</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Col: Details */}
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                          Event Name
                        </label>
                        <input
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] focus:ring-1 focus:ring-[#ff914d]/20 transition-all"
                          placeholder="e.g. Annual Tech Symposium 2024"
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                          Short Description
                        </label>
                        <textarea
                          ref={editShortDescRef}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] focus:ring-1 focus:ring-[#ff914d]/20 transition-all resize-none"
                          placeholder="Briefly describe your event..."
                          rows={2}
                          value={editShortDesc}
                          onChange={(e) => setEditShortDesc(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Category Dropdown */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                              Category
                            </label>
                            <button
                              type="button"
                              className="p-1 hover:scale-110 transition-transform"
                              onClick={() => {
                                setShowEditCatSearch(true);
                                setEditCatSearch('');
                                setEditCatSearchHighlight(-1);
                                setTimeout(() => editCatSearchRef.current?.focus(), 0);
                              }}
                              aria-label="Search categories"
                            >
                              <span className="material-symbols-outlined text-white/60 text-[18px]">search</span>
                            </button>
                          </div>
                          {showEditCatSearch ? (
                            <div className="relative">
                              <input
                                ref={editCatSearchRef}
                                type="text"
                                placeholder="Search category..."
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] focus:ring-1 focus:ring-[#ff914d]/20 transition-all"
                                value={editCatSearch}
                                onChange={(e) => {
                                  setEditCatSearch(e.target.value);
                                  setEditCatSearchHighlight(-1);
                                }}
                                onKeyDown={(e) => {
                                  const filtered = Object.keys(CATEGORY_MAP).filter((cat) =>
                                    cat.toLowerCase().includes(editCatSearch.toLowerCase())
                                  );
                                  if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setEditCatSearchHighlight((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
                                  } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setEditCatSearchHighlight((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
                                  } else if (e.key === 'Enter' && editCatSearchHighlight >= 0 && filtered[editCatSearchHighlight]) {
                                    e.preventDefault();
                                    handleEditCatSearchSelect(filtered[editCatSearchHighlight]);
                                  } else if (e.key === 'Escape') {
                                    setShowEditCatSearch(false);
                                    setEditCatSearch('');
                                    setEditCatSearchHighlight(-1);
                                  }
                                }}
                                onBlur={() => {
                                  setTimeout(() => {
                                    setShowEditCatSearch(false);
                                    setEditCatSearch('');
                                    setEditCatSearchHighlight(-1);
                                  }, 200);
                                }}
                              />
                              <div className="absolute z-50 w-full mt-1 bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                {Object.keys(CATEGORY_MAP)
                                  .filter((cat) => cat.toLowerCase().includes(editCatSearch.toLowerCase()))
                                  .map((cat, idx) => (
                                    <button
                                      key={cat}
                                      type="button"
                                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                        idx === editCatSearchHighlight
                                          ? 'bg-[#ff914d]/20 text-white'
                                          : 'text-white/80 hover:bg-white/5'
                                      }`}
                                      onMouseDown={() => handleEditCatSearchSelect(cat)}
                                    >
                                      {cat}
                                    </button>
                                  ))}
                                {Object.keys(CATEGORY_MAP).filter((cat) =>
                                  cat.toLowerCase().includes(editCatSearch.toLowerCase())
                                ).length === 0 && (
                                  <div className="px-4 py-3 text-sm text-white/40">No results found</div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <select
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                              value={editCategory}
                              onChange={(e) => handleEditCategoryChange(e.target.value)}
                            >
                              <option value="" disabled>
                                Select category...
                              </option>
                              {Object.keys(CATEGORY_MAP).map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Subcategory Dropdown */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                              Subcategory
                            </label>
                            <button
                              type="button"
                              className="p-1 hover:scale-110 transition-transform"
                              onClick={() => {
                                setShowEditSubSearch(true);
                                setEditSubSearch('');
                                setEditSubSearchHighlight(-1);
                                setTimeout(() => editSubSearchRef.current?.focus(), 0);
                              }}
                              aria-label="Search subcategories"
                            >
                              <span className="material-symbols-outlined text-white/60 text-[18px]">search</span>
                            </button>
                          </div>
                          {showEditSubSearch ? (
                            <div className="relative">
                              <input
                                ref={editSubSearchRef}
                                type="text"
                                placeholder="Search subcategory..."
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] focus:ring-1 focus:ring-[#ff914d]/20 transition-all"
                                value={editSubSearch}
                                onChange={(e) => {
                                  setEditSubSearch(e.target.value);
                                  setEditSubSearchHighlight(-1);
                                }}
                                onKeyDown={(e) => {
                                  const allSubs = Object.entries(CATEGORY_MAP).flatMap(([cat, subs]) =>
                                    subs.map((sub) => ({ sub, cat }))
                                  );
                                  const filtered = allSubs.filter(({ sub }) =>
                                    sub.toLowerCase().includes(editSubSearch.toLowerCase())
                                  );
                                  if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setEditSubSearchHighlight((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
                                  } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setEditSubSearchHighlight((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
                                  } else if (e.key === 'Enter' && editSubSearchHighlight >= 0 && filtered[editSubSearchHighlight]) {
                                    e.preventDefault();
                                    handleEditSubSearchSelect(filtered[editSubSearchHighlight].sub);
                                  } else if (e.key === 'Escape') {
                                    setShowEditSubSearch(false);
                                    setEditSubSearch('');
                                    setEditSubSearchHighlight(-1);
                                  }
                                }}
                                onBlur={() => {
                                  setTimeout(() => {
                                    setShowEditSubSearch(false);
                                    setEditSubSearch('');
                                    setEditSubSearchHighlight(-1);
                                  }, 200);
                                }}
                              />
                              <div className="absolute z-50 w-full mt-1 bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                {Object.entries(CATEGORY_MAP)
                                  .flatMap(([cat, subs]) => subs.map((sub) => ({ sub, cat })))
                                  .filter(({ sub }) => sub.toLowerCase().includes(editSubSearch.toLowerCase()))
                                  .map(({ sub, cat }, idx) => (
                                    <button
                                      key={`${cat}-${sub}`}
                                      type="button"
                                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                        idx === editSubSearchHighlight
                                          ? 'bg-[#ff914d]/20 text-white'
                                          : 'text-white/80 hover:bg-white/5'
                                      }`}
                                      onMouseDown={() => handleEditSubSearchSelect(sub)}
                                    >
                                      <div className="flex flex-col">
                                        <span>{sub}</span>
                                        <span className="text-xs text-white/40">{cat}</span>
                                      </div>
                                    </button>
                                  ))}
                                {Object.entries(CATEGORY_MAP)
                                  .flatMap(([cat, subs]) => subs.map((sub) => ({ sub, cat })))
                                  .filter(({ sub }) => sub.toLowerCase().includes(editSubSearch.toLowerCase()))
                                  .length === 0 && (
                                  <div className="px-4 py-3 text-sm text-white/40">No results found</div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <select
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              value={editSubcategory}
                              onChange={(e) => setEditSubcategory(e.target.value)}
                              disabled={!editCategory}
                            >
                              <option value="" disabled>
                                {editCategory ? 'Select subcategory...' : 'Choose category first'}
                              </option>
                              {editCategory &&
                                CATEGORY_MAP[editCategory]?.map((sub) => (
                                  <option key={sub} value={sub}>
                                    {sub}
                                  </option>
                                ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Full Width: Full Description */}
                    <div className="col-span-1 md:col-span-2 flex flex-col gap-2 mt-4">
                      <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                        Full Description
                      </label>
                      <textarea
                        ref={editFullDescRef}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] focus:ring-1 focus:ring-[#ff914d]/20 transition-all resize-none"
                        placeholder="Provide detailed information about the schedule, speakers, requirements..."
                        rows={6}
                        value={editFullDesc}
                        onChange={(e) => setEditFullDesc(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end">
                    <button
                      className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors border border-white/5 flex items-center gap-2"
                      onClick={() => setEditActiveSection(2)}
                      type="button"
                    >
                      Next Step{' '}
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Schedule & Location */}
            <div
              className={`rounded-3xl border border-white/10 bg-white/5 p-6 flex flex-col gap-6 transition-all duration-300 ${
                editActiveSection === 2
                  ? 'opacity-100 ring-1 ring-[#ff914d]/20 border-[#ff914d]/30'
                  : 'opacity-60 hover:opacity-80'
              }`}
            >
              <button
                className="w-full flex justify-between items-center text-left focus:outline-none"
                onClick={() => setEditActiveSection(editActiveSection === 2 ? 0 : 2)}
                type="button"
              >
                <div className="flex items-center gap-4">
                  {editStartDate !== '' &&
                  editStartTime !== '' &&
                  editEndDate !== '' &&
                  editEndTime !== '' &&
                  editLocation.trim() !== '' ? (
                    <div className="w-8 h-8 rounded-full bg-[#4ade80]/10 flex items-center justify-center text-[#4ade80] border border-[#4ade80]/20 animate-scaleIn">
                      <span className="material-symbols-outlined text-[18px]">check</span>
                    </div>
                  ) : (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border text-sm font-semibold transition-all duration-300 ${
                        editActiveSection === 2
                          ? 'bg-[#ff914d]/10 text-[#ff914d] border-[#ff914d]/20'
                          : 'bg-white/5 text-white/40 border-white/10'
                      }`}
                    >
                      2
                    </div>
                  )}
                  <h2
                    className={`text-lg font-bold font-display ${editActiveSection === 2 ? 'text-white' : 'text-white/80'}`}
                  >
                    Schedule &amp; Location
                  </h2>
                </div>
                <span
                  className={`material-symbols-outlined text-white/60 transition-transform duration-300 ${editActiveSection === 2 ? 'rotate-180' : ''}`}
                >
                  keyboard_arrow_down
                </span>
              </button>

              {editActiveSection === 2 && (
                <div className="pt-6 border-t border-white/5 animate-fadeIn">
                  <div className="flex flex-col gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <DatePicker
                        value={editStartDate}
                        onChange={setEditStartDate}
                        label="Start Date"
                        minDate={new Date().toISOString().split('T')[0]}
                      />
                      <TimePicker
                        value={editStartTime}
                        period={editStartPeriod}
                        onChange={setEditStartTime}
                        onPeriodChange={setEditStartPeriod}
                        label="Start Time"
                      />
                      <DatePicker
                        value={editEndDate}
                        onChange={setEditEndDate}
                        label="End Date"
                        minDate={editStartDate || new Date().toISOString().split('T')[0]}
                      />
                      <TimePicker
                        value={editEndTime}
                        period={editEndPeriod}
                        onChange={setEditEndTime}
                        onPeriodChange={setEditEndPeriod}
                        label="End Time"
                      />
                    </div>

                    {/* Venue Location Dropdown */}
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                          Venue Location
                        </label>
                        <div className="relative" ref={editVenueDropdownRef}>
                          <button
                            type="button"
                            onClick={() => setShowEditVenueDropdown(!showEditVenueDropdown)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-3 text-sm text-white text-left focus:outline-none focus:border-[#ff914d] transition-all flex items-center justify-between"
                          >
                            <span className={editVenueType ? 'text-white' : 'text-white/40'}>
                              {editVenueType || 'Select Venue...'}
                            </span>
                            <span className="absolute right-3 top-3.5 text-white/40 text-xs select-none">▼</span>
                          </button>

                          {showEditVenueDropdown && (
                            <div className="absolute z-50 mt-1 w-full bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                              <ul>
                                {[
                                  'Shanti Devi Mittal Auditorium',
                                  'Baldev Raj Mittal Auditorium',
                                  'Block & Room',
                                  'Other Venue',
                                ].map((option) => (
                                  <li key={option}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditVenueType(option);
                                        setShowEditVenueDropdown(false);
                                        if (option !== 'Block & Room') {
                                          setEditBlockNo('');
                                          setEditRoomNo('');
                                        }
                                        if (option !== 'Other Venue') {
                                          setEditOtherVenue('');
                                        }
                                      }}
                                      className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors"
                                    >
                                      {option}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Conditional Fields */}
                      {editVenueType === 'Block & Room' && (
                        <div className="flex flex-col sm:flex-row gap-4 animate-fadeIn">
                          <div className="flex flex-col flex-1 gap-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                              Block No. <span className="text-[#ff914d]">*</span>
                            </label>
                            <input
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                              placeholder="e.g. 34"
                              type="text"
                              value={editBlockNo}
                              onChange={(e) => setEditBlockNo(e.target.value)}
                            />
                          </div>
                          <div className="flex flex-col flex-1 gap-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                              Room No. <span className="text-[#ff914d]">*</span>
                            </label>
                            <input
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                              placeholder="e.g. 102"
                              type="text"
                              value={editRoomNo}
                              onChange={(e) => setEditRoomNo(e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      {editVenueType === 'Other Venue' && (
                        <div className="flex flex-col gap-2 animate-fadeIn">
                          <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                            Venue Name <span className="text-[#ff914d]">*</span>
                          </label>
                          <input
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                            placeholder="Enter custom venue name..."
                            type="text"
                            value={editOtherVenue}
                            onChange={(e) => setEditOtherVenue(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between mt-8">
                    <button
                      className="text-white/60 hover:text-white text-sm font-medium transition-colors"
                      onClick={() => setEditActiveSection(1)}
                      type="button"
                    >
                      Back
                    </button>
                    <button
                      className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors border border-white/5 flex items-center gap-2"
                      onClick={() => setEditActiveSection(3)}
                      type="button"
                    >
                      Next Step{' '}
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Registration */}
            <div
              className={`rounded-3xl border border-white/10 bg-white/5 p-6 flex flex-col gap-6 transition-all duration-300 ${
                editActiveSection === 3
                  ? 'opacity-100 ring-1 ring-[#ff914d]/20 border-[#ff914d]/30'
                  : 'opacity-60 hover:opacity-80'
              }`}
            >
              <button
                className="w-full flex justify-between items-center text-left focus:outline-none"
                onClick={() => setEditActiveSection(editActiveSection === 3 ? 0 : 3)}
                type="button"
              >
                <div className="flex items-center gap-4">
                  {editRegRequired === 'no' ||
                  (editRegRequired === 'yes' &&
                    (editRegPlatform === 'lpu_events' ||
                      (editRegPlatform === 'external' && editExternalLink.trim() !== ''))) ? (
                    <div className="w-8 h-8 rounded-full bg-[#4ade80]/10 flex items-center justify-center text-[#4ade80] border border-[#4ade80]/20 animate-scaleIn">
                      <span className="material-symbols-outlined text-[18px]">check</span>
                    </div>
                  ) : (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border text-sm font-semibold transition-all duration-300 ${
                        editActiveSection === 3
                          ? 'bg-[#ff914d]/10 text-[#ff914d] border-[#ff914d]/20'
                          : 'bg-white/5 text-white/40 border-white/10'
                      }`}
                    >
                      3
                    </div>
                  )}
                  <h2
                    className={`text-lg font-bold font-display ${editActiveSection === 3 ? 'text-white' : 'text-white/80'}`}
                  >
                    Registration
                  </h2>
                </div>
                <span
                  className={`material-symbols-outlined text-white/60 transition-transform duration-300 ${editActiveSection === 3 ? 'rotate-180' : ''}`}
                >
                  keyboard_arrow_down
                </span>
              </button>

              {editActiveSection === 3 && (
                <div className="pt-6 border-t border-white/5 animate-fadeIn">
                  <div className="flex flex-col gap-8">
                    {/* Is Registration Required */}
                    <div className="flex flex-col gap-4">
                      <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                        Is Registration Required?
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div
                          onClick={() => setEditRegRequired('yes')}
                          className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm transition-all ${
                            editRegRequired === 'yes'
                              ? 'border-[#ff914d]/50 bg-[#ff914d]/10'
                              : 'border-white/10 bg-white/5 hover:border-white/20'
                          }`}
                        >
                          <div className="flex w-full items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span
                                className={`material-symbols-outlined ${editRegRequired === 'yes' ? 'text-[#ff914d]' : 'text-white/40'}`}
                              >
                                {editRegRequired === 'yes'
                                  ? 'radio_button_checked'
                                  : 'radio_button_unchecked'}
                              </span>
                              <span className="text-sm font-medium text-white">Yes</span>
                            </div>
                          </div>
                        </div>
                        <div
                          onClick={() => {
                            setEditRegRequired('no');
                            setEditRegPlatform('lpu_events');
                            setEditRegType('free');
                          }}
                          className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm transition-all ${
                            editRegRequired === 'no'
                              ? 'border-[#ff914d]/50 bg-[#ff914d]/10'
                              : 'border-white/10 bg-white/5 hover:border-white/20'
                          }`}
                        >
                          <div className="flex w-full items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span
                                className={`material-symbols-outlined ${editRegRequired === 'no' ? 'text-[#ff914d]' : 'text-white/40'}`}
                              >
                                {editRegRequired === 'no'
                                  ? 'radio_button_checked'
                                  : 'radio_button_unchecked'}
                              </span>
                              <span className="text-sm font-medium text-white">No</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {editRegRequired === 'yes' && (
                      <>
                        {/* Required Student Details Selection Box */}
                        <div className="flex flex-col gap-4 p-5 rounded-xl border border-white/5 bg-white/5 animate-fadeIn">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                              Required Student Details
                            </label>
                            <span className="text-xs text-white/40">
                              Select required details or add custom fields (deselected by default)
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {editStudentFieldOptions.map((field) => {
                              const isSelected = editRequiredStudentFields.includes(field.id);
                              return (
                                <div
                                  key={field.id}
                                  onClick={() => toggleEditRequiredField(field.id)}
                                  className={`relative flex items-center justify-between cursor-pointer rounded-lg border p-3.5 shadow-sm transition-all ${
                                    isSelected
                                      ? 'border-[#ff914d]/50 bg-[#ff914d]/10 text-white'
                                      : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span
                                      className={`material-symbols-outlined text-[18px] ${isSelected ? 'text-[#ff914d]' : 'text-white/40'}`}
                                    >
                                      {isSelected ? 'check_box' : 'check_box_outline_blank'}
                                    </span>
                                    <span className="text-sm font-medium">{field.label}</span>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Pencil Icon Button / Manual Input */}
                            {!isEditAddingCustomField ? (
                              <div
                                onClick={() => setIsEditAddingCustomField(true)}
                                className="relative flex items-center justify-center gap-2 cursor-pointer rounded-lg border border-dashed border-[#ff914d]/40 bg-[#ff914d]/5 p-3.5 shadow-sm transition-all hover:bg-[#ff914d]/10 hover:border-[#ff914d] text-[#ff914d]"
                              >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                                <span className="text-sm font-semibold">Add Custom Field</span>
                              </div>
                            ) : (
                              <div className="col-span-2 md:col-span-3 flex gap-2 items-center bg-white/5 p-2.5 rounded-lg border border-[#ff914d]/50 animate-fadeIn">
                                <span className="material-symbols-outlined text-[#ff914d] text-[18px] pl-2">
                                  edit_note
                                </span>
                                <input
                                  type="text"
                                  value={editCustomFieldText}
                                  onChange={(e) => setEditCustomFieldText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleEditAddCustomField();
                                    }
                                  }}
                                  placeholder="e.g. GitHub Profile, T-Shirt Size, Food Preference"
                                  className="w-full bg-transparent text-sm text-white focus:outline-none px-2"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={handleEditAddCustomField}
                                  className="bg-[#ff914d] hover:bg-[#e07530] text-[#050507] text-xs font-bold px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
                                >
                                  Add
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsEditAddingCustomField(false);
                                    setEditCustomFieldText('');
                                  }}
                                  className="text-white/40 hover:text-white text-xs px-2 py-1.5"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Registration Type */}
                        <div className="flex flex-col gap-4">
                          <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                            Registration Type
                          </label>
                          <div className="grid grid-cols-2 gap-4">
                            <div
                              onClick={() => handleEditRegTypeChange('free')}
                              className={`relative flex items-center justify-center cursor-pointer rounded-lg border p-4 shadow-sm transition-all ${
                                editRegType === 'free'
                                  ? 'border-[#ff914d]/50 bg-[#ff914d]/10 text-[#ff914d]'
                                  : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
                              }`}
                            >
                              <span className="text-sm font-semibold">Free</span>
                            </div>
                            <div
                              onClick={() => handleEditRegTypeChange('paid')}
                              className={`relative flex items-center justify-center cursor-pointer rounded-lg border p-4 shadow-sm transition-all ${
                                editRegType === 'paid'
                                  ? 'border-[#ff914d]/50 bg-[#ff914d]/10 text-[#ff914d]'
                                  : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
                              }`}
                            >
                              <span className="text-sm font-semibold">Paid</span>
                            </div>
                          </div>
                        </div>

                        {/* Registration Platform */}
                        <div className="flex flex-col gap-4 p-5 rounded-xl border border-white/5 bg-white/5">
                          <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                            Registration Platform
                          </label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div
                              onClick={() => setEditRegPlatform('lpu_events')}
                              className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm transition-all ${
                                editRegPlatform === 'lpu_events'
                                  ? 'border-[#ff914d]/50 bg-[#ff914d]/10'
                                  : 'border-white/10 bg-white/5 hover:border-white/20'
                              }`}
                            >
                              <div className="flex w-full items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`material-symbols-outlined ${editRegPlatform === 'lpu_events' ? 'text-[#ff914d]' : 'text-white/40'}`}
                                  >
                                    {editRegPlatform === 'lpu_events'
                                      ? 'radio_button_checked'
                                      : 'radio_button_unchecked'}
                                  </span>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium text-white">
                                      LPU Events
                                    </span>
                                    <span className="text-xs text-white/40 mt-0.5">
                                      Manage registrations here
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div
                              onClick={() => setEditRegPlatform('external')}
                              className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm transition-all ${
                                editRegPlatform === 'external'
                                  ? 'border-[#ff914d]/50 bg-[#ff914d]/10'
                                  : 'border-white/10 bg-white/5 hover:border-white/20'
                              }`}
                            >
                              <div className="flex w-full items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`material-symbols-outlined ${editRegPlatform === 'external' ? 'text-[#ff914d]' : 'text-white/40'}`}
                                  >
                                    {editRegPlatform === 'external'
                                      ? 'radio_button_checked'
                                      : 'radio_button_unchecked'}
                                  </span>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium text-white">
                                      External Link
                                    </span>
                                    <span className="text-xs text-white/40 mt-0.5">
                                      Link to another site
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* External Link */}
                        {editRegPlatform === 'external' && (
                          <div className="flex flex-col gap-2 p-5 rounded-xl border border-white/5 bg-white/5 animate-fadeIn">
                            <label className="text-xs font-semibold uppercase tracking-wider text-[#ff914d]">
                              External Booking Link
                            </label>
                            <div className="relative">
                              <span className="material-symbols-outlined absolute right-3 top-3.5 text-white/40 text-[18px]">
                                link
                              </span>
                              <input
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                                placeholder="https://example.com/tickets"
                                type="url"
                                value={editExternalLink}
                                onChange={(e) => setEditExternalLink(e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex justify-between mt-8">
                    <button
                      className="text-white/60 hover:text-white text-sm font-medium transition-colors"
                      onClick={() => setEditActiveSection(2)}
                      type="button"
                    >
                      Back
                    </button>
                    {editRegRequired === 'yes' && editRegPlatform === 'lpu_events' && (
                      <button
                        className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors border border-white/5 flex items-center gap-2"
                        onClick={() => setEditActiveSection(4)}
                        type="button"
                      >
                        Next Step{' '}
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 4: Attendance & Tickets */}
            {editRegRequired === 'yes' && editRegPlatform === 'lpu_events' && (
              <div
                className={`rounded-3xl border border-white/10 bg-white/5 p-6 flex flex-col gap-6 transition-all duration-300 ${
                  editActiveSection === 4
                    ? 'opacity-100 ring-1 ring-[#ff914d]/20 border-[#ff914d]/30'
                    : 'opacity-60 hover:opacity-80'
                }`}
              >
                <button
                  className="w-full flex justify-between items-center text-left focus:outline-none"
                  onClick={() => setEditActiveSection(editActiveSection === 4 ? 0 : 4)}
                  type="button"
                >
                  <div className="flex items-center gap-4">
                    {editTicketPrice !== '' &&
                    editTotalTickets !== '' &&
                    editSalesStartDate !== '' &&
                    editSalesEndDate !== '' &&
                    editMaxTickets !== '' ? (
                      <div className="w-8 h-8 rounded-full bg-[#4ade80]/10 flex items-center justify-center text-[#4ade80] border border-[#4ade80]/20 animate-scaleIn">
                        <span className="material-symbols-outlined text-[18px]">check</span>
                      </div>
                    ) : (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center border text-sm font-semibold transition-all duration-300 ${
                          editActiveSection === 4
                            ? 'bg-[#ff914d]/10 text-[#ff914d] border-[#ff914d]/20'
                            : 'bg-white/5 text-white/40 border-white/10'
                        }`}
                      >
                        4
                      </div>
                    )}
                    <h2
                      className={`text-lg font-bold font-display ${editActiveSection === 4 ? 'text-white' : 'text-white/80'}`}
                    >
                      Attendance &amp; Tickets
                    </h2>
                  </div>
                  <span
                    className={`material-symbols-outlined text-white/60 transition-transform duration-300 ${editActiveSection === 4 ? 'rotate-180' : ''}`}
                  >
                    keyboard_arrow_down
                  </span>
                </button>

                {editActiveSection === 4 && (
                  <div className="pt-6 border-t border-white/5 animate-fadeIn">
                    <div className="flex flex-col gap-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Ticket Price */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                            Ticket Price
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-3 text-sm text-white/40 select-none">
                              ₹
                            </span>
                            <input
                              className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              type="text"
                              value={editTicketPrice}
                              disabled={editRegType === 'free'}
                              onChange={(e) => setEditTicketPrice(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Total Tickets */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                            Total Tickets Available
                          </label>
                          <input
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                            type="number"
                            value={editTotalTickets}
                            onChange={(e) =>
                              setEditTotalTickets(
                                e.target.value === '' ? '' : parseInt(e.target.value) || 0
                              )
                            }
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Sales Start Date */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                            Sales Start Date
                          </label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute right-3 top-3.5 text-white/40 text-[18px] pointer-events-none">
                              event_available
                            </span>
                            <input
                              className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all [color-scheme:dark]"
                              type="date"
                              value={editSalesStartDate}
                              onChange={(e) => setEditSalesStartDate(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Sales End Date */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                            Sales End Date
                          </label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute right-3 top-3.5 text-white/40 text-[18px] pointer-events-none">
                              event_busy
                            </span>
                            <input
                              className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all [color-scheme:dark]"
                              type="date"
                              value={editSalesEndDate}
                              onChange={(e) => setEditSalesEndDate(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Max tickets per order */}
                      <div className="flex flex-col gap-2 md:w-1/2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                          Max Tickets per Order
                        </label>
                        <input
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                          type="number"
                          value={editMaxTickets}
                          onChange={(e) =>
                            setEditMaxTickets(
                              e.target.value === '' ? '' : parseInt(e.target.value) || 0
                            )
                          }
                        />
                      </div>
                    </div>

                    <div className="flex justify-between mt-8">
                      <button
                        className="text-white/60 hover:text-white text-sm font-medium transition-colors"
                        onClick={() => setEditActiveSection(3)}
                        type="button"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Save Buttons Row */}
            <div className="flex justify-end gap-4 border-t border-white/5 pt-6 mt-4">
              <button
                onClick={() => handleSaveSettings()}
                className="bg-[#ff914d] hover:bg-[#e07530] text-[#050507] px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="lg:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-white font-display">Danger Zone</h3>
            <p className="text-xs text-white/40">Irreversible actions relating to this event.</p>

            <div className="space-y-4 mt-2">
              <button
                onClick={() => {
                  const confirmCancel = window.confirm(
                    'Are you sure you want to cancel this event? This will stop registrations and notify all booked users.'
                  );
                  if (confirmCancel) {
                    setEvents((prev) =>
                      prev.map((evt) =>
                        evt.id === selectedEvent.id
                          ? { ...evt, statusLabel: 'Cancelled', isLive: false }
                          : evt
                      )
                    );
                    alert('Event cancelled.');
                  }
                }}
                className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl py-3 text-xs font-bold uppercase tracking-wider transition-all"
              >
                Cancel Event
              </button>

              <button
                onClick={() => {
                  const confirmDelete = window.confirm(
                    'Are you sure you want to delete this event permanently? This cannot be undone.'
                  );
                  if (confirmDelete) {
                    setEvents((prev) => prev.filter((evt) => evt.id !== selectedEvent.id));
                    setSelectedEventId(null);
                    alert('Event deleted.');
                  }
                }}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white rounded-xl py-3 text-xs font-bold uppercase tracking-wider transition-all"
              >
                Delete Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
