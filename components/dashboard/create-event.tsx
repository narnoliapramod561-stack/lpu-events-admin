'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { trackAdminRegistration } from '@/components/observability/analytics-provider';
import { DatePicker } from '@/components/dashboard/date-picker';
import { TimePicker } from '@/components/dashboard/time-picker';

// Taxonomy data mapped directly from database seed records and frontend categories
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

interface CategoryOption {
  id: string;
  name: string;
}

interface SubcategoryOption {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
}

const STUDENT_FIELD_OPTIONS = [
  { id: 'regNo', label: 'Registration No.' },
  { id: 'branch', label: 'Branch' },
  { id: 'semester', label: 'Semester' },
  { id: 'phone', label: 'Mobile No.' },
  { id: 'class', label: 'Class' },
  { id: 'school', label: 'School' },
];

export function CreateEvent() {
  const [activeSection, setActiveSection] = useState<number>(2);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryOption[]>([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState<SubcategoryOption[]>([]);

  // Form fields states
  const [eventName, setEventName] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [showCatSearch, setShowCatSearch] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const [showSubSearch, setShowSubSearch] = useState(false);
  const [subSearch, setSubSearch] = useState('');
  const catSearchRef = useRef<HTMLInputElement>(null);
  const subSearchRef = useRef<HTMLInputElement>(null);
  const [catSearchHighlight, setCatSearchHighlight] = useState(-1);
  const [subSearchHighlight, setSubSearchHighlight] = useState(-1);
  const [fullDesc, setFullDesc] = useState('');

  // Refs for auto-resizing textareas
  const shortDescRef = useRef<HTMLTextAreaElement>(null);
  const fullDescRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textareas when content changes
  useEffect(() => {
    const textarea = shortDescRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [shortDesc]);

  useEffect(() => {
    const textarea = fullDescRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [fullDesc]);

  // Schedule & Location (Using HTML5 native inputs with empty initial states)
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');
  const [eventStartPeriod, setEventStartPeriod] = useState<'AM' | 'PM'>('AM');
  const [eventEndDate, setEventEndDate] = useState('');
  const [eventEndTime, setEventEndTime] = useState('');
  const [eventEndPeriod, setEventEndPeriod] = useState<'AM' | 'PM'>('AM');
  const [venueLocation, setVenueLocation] = useState('');
  const [venueType, setVenueType] = useState('');
  const [blockNo, setBlockNo] = useState('');
  const [roomNo, setRoomNo] = useState('');
  const [otherVenue, setOtherVenue] = useState('');
  const [showVenueDropdown, setShowVenueDropdown] = useState(false);
  const venueDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (venueType === 'Shanti Devi Mittal Auditorium' || venueType === 'Baldev Raj Mittal Auditorium') {
      setVenueLocation(venueType);
    } else if (venueType === 'Block & Room') {
      if (blockNo.trim() && roomNo.trim()) {
        setVenueLocation(`Block ${blockNo.trim()}, Room ${roomNo.trim()}`);
      } else {
        setVenueLocation('');
      }
    } else if (venueType === 'Other Venue') {
      setVenueLocation(otherVenue.trim());
    } else {
      setVenueLocation('');
    }
  }, [venueType, blockNo, roomNo, otherVenue]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (venueDropdownRef.current && !venueDropdownRef.current.contains(event.target as Node)) {
        setShowVenueDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Registration logic
  const [regRequired, setRegRequired] = useState('yes'); // 'yes' or 'no'
  const [studentFieldOptions, setStudentFieldOptions] = useState(STUDENT_FIELD_OPTIONS);
  const [requiredStudentFields, setRequiredStudentFields] = useState<string[]>([]); // Deselected by default
  const [isAddingCustomField, setIsAddingCustomField] = useState(false);
  const [customFieldText, setCustomFieldText] = useState('');
  const [regPlatform, setRegPlatform] = useState('lpu_events'); // 'lpu_events' or 'external'
  const [regType, setRegType] = useState('paid'); // 'free' or 'paid'
  const [externalLink, setExternalLink] = useState('');

  const toggleRequiredField = (fieldId: string) => {
    setRequiredStudentFields((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  const handleAddCustomField = () => {
    const trimmed = customFieldText.trim();
    if (!trimmed) return;
    const customId = `custom_${trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    if (!studentFieldOptions.some((f) => f.id === customId)) {
      setStudentFieldOptions((prev) => [...prev, { id: customId, label: trimmed }]);
    }
    if (!requiredStudentFields.includes(customId)) {
      setRequiredStudentFields((prev) => [...prev, customId]);
    }
    setCustomFieldText('');
    setIsAddingCustomField(false);
  };

  // Ticket config
  const [ticketPrice, setTicketPrice] = useState('');
  const [totalTickets, setTotalTickets] = useState<number | ''>('');
  const [salesStartDate, setSalesStartDate] = useState('');
  const [salesEndDate, setSalesEndDate] = useState('');
  const [maxTickets, setMaxTickets] = useState<number | ''>('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Tickets section appears for both free & paid bookings if handled on our platform
  const showTickets =
    regRequired === 'yes' &&
    regPlatform === 'lpu_events' &&
    (regType === 'paid' || regType === 'free');

  // Dynamic section completion validation (reacts immediately as organizers enter details)
  const isSection1Complete =
    eventName.trim() !== '' &&
    shortDesc.trim() !== '' &&
    category !== '' &&
    subcategory !== '' &&
    fullDesc.trim() !== '';
  const isSection2Complete =
    eventStartDate !== '' &&
    eventStartTime !== '' &&
    eventEndDate !== '' &&
    eventEndTime !== '' &&
    venueLocation.trim() !== '';
  const isSection3Complete =
    regRequired === 'no' ||
    (regRequired === 'yes' &&
      (regPlatform === 'lpu_events' || (regPlatform === 'external' && externalLink.trim() !== '')));
  const isSection4Complete =
    !showTickets ||
    (ticketPrice !== '' &&
      totalTickets !== '' &&
      salesStartDate !== '' &&
      salesEndDate !== '' &&
      maxTickets !== '');

  const toggleSection = (sectionId: number) => {
    setActiveSection(activeSection === sectionId ? 0 : sectionId);
  };

  const nextSection = (currentId: number) => {
    const nextId = currentId + 1;
    if (nextId === 4 && !showTickets) {
      setActiveSection(4);
      return;
    }
    if (nextId <= 4) {
      setActiveSection(nextId);
    }
  };

  const handleCategoryChange = (val: string) => {
    setCategory(val);
    setSubcategory(''); // Reset subcategory when category changes
    setSubSearch(''); // Reset search when category changes
    setShowCatSearch(false);
    setCatSearch('');
  };

  const handleCatSearchSelect = (catName: string, catId: string) => {
    setCategory(catName);
    setSubcategory('');
    setShowCatSearch(false);
    setCatSearch('');
    setCatSearchHighlight(-1);
    // Fetch subcategories for the selected category
    fetchSubcategories(catId);
  };

  const handleSubSearchSelect = (sub: SubcategoryOption) => {
    setSubcategory(sub.name);
    // Auto-select category from the selected subcategory
    if (sub.category_name !== category) {
      setCategory(sub.category_name);
    }
    setShowSubSearch(false);
    setSubSearch('');
    setSubSearchHighlight(-1);
  };

  const fetchSubcategories = async (categoryId?: string, search?: string) => {
    try {
      const params = new URLSearchParams();
      if (categoryId) params.set('category_id', categoryId);
      if (search) params.set('search', search);
      const response = await fetch(`/api/admin/subcategories?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const subs = (data.data || []).map((sub: SubcategoryOption) => ({
          id: sub.id,
          name: sub.name,
          category_id: sub.category_id,
          category_name: sub.category_name,
        }));
        setSubcategories(subs);
        setFilteredSubcategories(subs);
      }
    } catch {
      // Keep empty on error
    }
  };

  // Fetch categories and ALL subcategories on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/admin/categories');
        if (response.ok) {
          const data = await response.json();
          const cats = (data.data || []).map((cat: CategoryOption) => ({ id: cat.id, name: cat.name }));
          setCategories(cats);
        }
      } catch {
        // Keep empty categories on error
      }
    };
    fetchData();
    
    // Fetch ALL subcategories on mount for global search
    const fetchAllSubs = async () => {
      try {
        const response = await fetch('/api/admin/subcategories');
        if (response.ok) {
          const data = await response.json();
          const subs = (data.data || []).map((sub: SubcategoryOption) => ({
            id: sub.id,
            name: sub.name,
            category_id: sub.category_id,
            category_name: sub.category_name,
          }));
          setSubcategories(subs);
          setFilteredSubcategories(subs);
        }
      } catch {
        // Keep empty on error
      }
    };
    fetchAllSubs();
  }, []);

  // Filter subcategories by selected category (when NOT searching)
  useEffect(() => {
    if (!subSearch && category && categories.length > 0) {
      const catRecord = categories.find((c) => c.name === category);
      if (catRecord) {
        const filtered = subcategories.filter((s) => s.category_id === catRecord.id);
        setFilteredSubcategories(filtered);
      }
    } else if (!subSearch && !category) {
      // Show all subcategories when no category selected
      setFilteredSubcategories(subcategories);
    }
  }, [category, categories]);

  // Filter subcategories locally when search changes (NO API calls)
  useEffect(() => {
    if (subSearch) {
      const filtered = subcategories.filter((sub) =>
        sub.name.toLowerCase().includes(subSearch.toLowerCase())
      );
      setFilteredSubcategories(filtered);
    }
  }, [subSearch]);

  // Filter categories locally when search changes (NO API calls)
  useEffect(() => {
    if (catSearch) {
      // Just for highlighting, no state change needed
    }
  }, [catSearch]);

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const handleBannerUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be under 10MB.');
      return;
    }

    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `event-banners/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('event-media')
        .upload(fileName, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('event-media')
        .getPublicUrl(fileName);

      if (urlData?.publicUrl) {
        setBannerPreview(urlData.publicUrl);
      }
    } catch {
      alert('Failed to upload banner. Please try again.');
    }
  };

  const handleRegTypeChange = (type: string) => {
    setRegType(type);
    if (type === 'free') {
      setTicketPrice('0');
    } else {
      setTicketPrice('');
    }
  };

  async function handlePublish() {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    // Client-side field validation with clear messages
    const missing: string[] = [];
    if (!eventName.trim()) missing.push('Event Title');
    if (!category) missing.push('Category');
    if (!venueLocation.trim()) missing.push('Venue');
    if (!eventStartDate || !eventStartTime) missing.push('Start Date & Time');
    if (!eventEndDate || !eventEndTime) missing.push('End Date & Time');
    if (!(fullDesc || shortDesc).trim()) missing.push('Description');

    if (missing.length > 0) {
      setSubmitError(`Please fill in the following required fields: ${missing.join(', ')}`);
      setIsSubmitting(false);
      return;
    }

    const categoryRecord = categories.find((c) => c.name === category);
    if (!categoryRecord) {
      setSubmitError('Selected category is not valid. Please refresh and try again.');
      setIsSubmitting(false);
      return;
    }

    const convertTo24Hour = (time12h: string, period: 'AM' | 'PM') => {
      const [hoursStr, minutesStr] = time12h.split(':');
      let hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    const start24 = eventStartTime ? convertTo24Hour(eventStartTime, eventStartPeriod) : '';
    const end24 = eventEndTime ? convertTo24Hour(eventEndTime, eventEndPeriod) : '';
    const startsAt = eventStartDate && start24 ? new Date(`${eventStartDate}T${start24}`).toISOString() : null;
    const endsAt = eventEndDate && end24 ? new Date(`${eventEndDate}T${end24}`).toISOString() : null;

    if (!startsAt || !endsAt) {
      setSubmitError('Please provide start and end dates with times.');
      setIsSubmitting(false);
      return;
    }

    if (new Date(endsAt) <= new Date(startsAt)) {
      setSubmitError('End date must be later than start date.');
      setIsSubmitting(false);
      return;
    }

    const baseSlug = eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const slug = `${baseSlug}-${randomSuffix}`;

    interface EventPayload {
      title: string;
      slug: string;
      description: string;
      short_description?: string;
      venue: string;
      starts_at: string;
      ends_at: string;
      category_id: string;
      is_free: boolean;
      registration_mode: 'individual' | 'team';
      contact_email: string;
      contact_phone: string;
    }

    const payload: EventPayload = {
      title: eventName,
      slug,
      description: fullDesc || shortDesc,
      short_description: shortDesc || undefined,
      venue: venueLocation,
      starts_at: startsAt,
      ends_at: endsAt,
      category_id: categoryRecord.id,
      is_free: regType === 'free',
      registration_mode: regRequired === 'yes' ? 'individual' : 'individual',
      contact_email: '',
      contact_phone: '',
    };

    if (fullDesc.trim().length < 1) {
      setSubmitError('Full description must be at least 1 character.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/organizer/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        // Show detailed validation errors if available
        if (result.details && Array.isArray(result.details)) {
          const messages = result.details.map((d: { path?: string[]; message?: string }) =>
            d.path?.length ? `${d.path.join('.')}: ${d.message}` : d.message
          ).join('; ');
          setSubmitError(`Validation failed — ${messages}`);
        } else {
          setSubmitError(result.message || result.error || 'Failed to create event');
        }
        return;
      }

      trackAdminRegistration('event_created', {
        title: eventName,
        category,
        registration_type: regType,
      });
      setSubmitSuccess('Event created successfully! Redirecting...');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    } catch {
      setSubmitError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDiscard() {
    if (window.confirm('Are you sure you want to discard this event? All unsaved changes will be lost.')) {
      setEventName('');
      setShortDesc('');
      setCategory('');
      setSubcategory('');
      setShowCatSearch(false);
      setCatSearch('');
      setShowSubSearch(false);
      setSubSearch('');
      setCatSearchHighlight(-1);
      setSubSearchHighlight(-1);
      setFullDesc('');
      setEventStartDate('');
      setEventStartTime('');
      setEventEndDate('');
      setEventEndTime('');
      setVenueLocation('');
      setVenueType('');
      setBlockNo('');
      setRoomNo('');
      setOtherVenue('');
      setRegRequired('yes');
      setRegPlatform('lpu_events');
      setRegType('paid');
      setTicketPrice('');
      setTotalTickets('');
      setSalesStartDate('');
      setSalesEndDate('');
      setMaxTickets('');
      setSubmitError(null);
      setSubmitSuccess(null);
    }
  }

  return (
    <div className="flex-1 w-full max-w-[1000px] mx-auto pb-32 flex flex-col gap-12">
      {/* Header */}
      <header className="flex justify-between items-end border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2 font-display">
            Create Event
          </h1>
          <p className="text-sm text-white">
            Create and publish your event with a simple and premium experience.
          </p>
        </div>
      </header>

      {/* Form Sections Accordion */}
      <div className="flex flex-col gap-6">
        {/* Section 1: Event Information */}
        <div
          className={`rounded-3xl border border-white/10 bg-white/5 p-6 flex flex-col gap-6 transition-all duration-300 ${
            activeSection === 1
              ? 'opacity-100 ring-1 ring-[#ff914d]/20 border-[#ff914d]/30'
              : 'opacity-60 hover:opacity-80'
          }`}
        >
          <button
            className="w-full flex justify-between items-center text-left focus:outline-none"
            onClick={() => toggleSection(1)}
            type="button"
          >
            <div className="flex items-center gap-4">
              {isSection1Complete ? (
                <div className="w-8 h-8 rounded-full bg-[#4ade80]/10 flex items-center justify-center text-[#4ade80] border border-[#4ade80]/20 animate-scaleIn">
                  <span className="material-symbols-outlined text-[18px]">check</span>
                </div>
              ) : (
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border text-sm font-semibold transition-all duration-300 ${
                    activeSection === 1
                      ? 'bg-[#ff914d]/10 text-[#ff914d] border-[#ff914d]/20'
                      : 'bg-white/5 text-white/40 border-white/10'
                  }`}
                >
                  1
                </div>
              )}
              <h2
                className={`text-lg font-bold font-display ${activeSection === 1 ? 'text-white' : 'text-white/80'}`}
              >
                Event Information
              </h2>
            </div>
            <span
              className={`material-symbols-outlined text-white/60 transition-transform duration-300 ${activeSection === 1 ? 'rotate-180' : ''}`}
            >
              keyboard_arrow_down
            </span>
          </button>

          {activeSection === 1 && (
            <div className="pt-6 border-t border-white/5 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Col: Poster */}
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    Event Poster
                  </label>
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleBannerUpload(file);
                    }}
                  />
                  <div
                    onClick={() => bannerInputRef.current?.click()}
                    className="w-full h-64 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-[#ff914d]/50 hover:bg-white/5 transition-all cursor-pointer group"
                  >
                    {bannerPreview ? (
                      <img src={bannerPreview} alt="Banner preview" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-4xl text-white/40 group-hover:text-[#ff914d] transition-colors">
                          cloud_upload
                        </span>
                        <div className="text-center">
                          <p className="text-sm text-white">Drag &amp; drop image here</p>
                          <p className="text-xs text-white/40 mt-1">PNG, JPG up to 10MB</p>
                        </div>
                      </>
                    )}
                  </div>
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
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                      Short Description
                    </label>
                    <textarea
                      ref={shortDescRef}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] focus:ring-1 focus:ring-[#ff914d]/20 transition-all resize-none"
                      placeholder="Briefly describe your event..."
                      rows={2}
                      value={shortDesc}
                      onChange={(e) => setShortDesc(e.target.value)}
                    />
                  </div>
                  <div className="flex space-x-4 items-start">
                    {/* Category Dropdown */}
                    <div className="flex flex-col flex-1 gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                          Category
                        </label>
                        <button
                          type="button"
                          className="p-1 hover:scale-110 transition-transform"
                          onClick={() => {
                            setShowCatSearch(true);
                            setCatSearch('');
                            setCatSearchHighlight(-1);
                            setTimeout(() => catSearchRef.current?.focus(), 0);
                          }}
                          aria-label="Search categories"
                        >
                          <span className="material-symbols-outlined text-white/60 text-[18px]">search</span>
                        </button>
                      </div>
                      {showCatSearch ? (
                        <div className="relative">
                          <input
                            ref={catSearchRef}
                            type="text"
                            placeholder="Search category..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] focus:ring-1 focus:ring-[#ff914d]/20 transition-all"
                            value={catSearch}
                            onChange={(e) => {
                              setCatSearch(e.target.value);
                              setCatSearchHighlight(-1);
                            }}
                            onKeyDown={(e) => {
                              const filtered = categories.filter((cat) =>
                                cat.name.toLowerCase().includes(catSearch.toLowerCase())
                              );
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setCatSearchHighlight((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setCatSearchHighlight((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
                              } else if (e.key === 'Enter' && catSearchHighlight >= 0 && filtered[catSearchHighlight]) {
                                e.preventDefault();
                                const selected = filtered[catSearchHighlight];
                                handleCatSearchSelect(selected.name, selected.id);
                              } else if (e.key === 'Escape') {
                                setShowCatSearch(false);
                                setCatSearch('');
                                setCatSearchHighlight(-1);
                              }
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setShowCatSearch(false);
                                setCatSearch('');
                                setCatSearchHighlight(-1);
                              }, 200);
                            }}
                          />
                          <div className="absolute z-50 w-full mt-1 bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                            {categories
                              .filter((cat) => cat.name.toLowerCase().includes(catSearch.toLowerCase()))
                              .map((cat, idx) => (
                                <button
                                  key={cat.id}
                                  type="button"
                                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                    idx === catSearchHighlight
                                      ? 'bg-[#ff914d]/20 text-white'
                                      : 'text-white/80 hover:bg-white/5'
                                  }`}
                                  onMouseDown={() => handleCatSearchSelect(cat.name, cat.id)}
                                >
                                  {cat.name}
                                </button>
                              ))}
                            {categories.filter((cat) =>
                              cat.name.toLowerCase().includes(catSearch.toLowerCase())
                            ).length === 0 && (
                              <div className="px-4 py-3 text-sm text-white/40">No results found</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <select
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                          value={category}
                          onChange={(e) => handleCategoryChange(e.target.value)}
                        >
                          <option value="" disabled>
                            Select category...
                          </option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.name}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Subcategory Dropdown */}
                    <div className="flex flex-col flex-1 gap-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                          Subcategory
                        </label>
                        <button
                          type="button"
                          className="p-1 hover:scale-110 transition-transform"
                          onClick={() => {
                            setShowSubSearch(true);
                            setSubSearch('');
                            setSubSearchHighlight(-1);
                            setTimeout(() => subSearchRef.current?.focus(), 0);
                          }}
                          aria-label="Search subcategories"
                        >
                          <span className="material-symbols-outlined text-white/60 text-[18px]">search</span>
                        </button>
                      </div>
                      {showSubSearch ? (
                        <div className="relative">
                          <input
                            ref={subSearchRef}
                            type="text"
                            placeholder="Search subcategory..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] focus:ring-1 focus:ring-[#ff914d]/20 transition-all"
                            value={subSearch}
                            onChange={(e) => {
                              setSubSearch(e.target.value);
                              setSubSearchHighlight(-1);
                            }}
                            onKeyDown={(e) => {
                              const filtered = subcategories.filter((sub) =>
                                sub.name.toLowerCase().includes(subSearch.toLowerCase())
                              );
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setSubSearchHighlight((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setSubSearchHighlight((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
                              } else if (e.key === 'Enter' && subSearchHighlight >= 0 && filtered[subSearchHighlight]) {
                                e.preventDefault();
                                handleSubSearchSelect(filtered[subSearchHighlight]);
                              } else if (e.key === 'Escape') {
                                setShowSubSearch(false);
                                setSubSearch('');
                                setSubSearchHighlight(-1);
                              }
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setShowSubSearch(false);
                                setSubSearch('');
                                setSubSearchHighlight(-1);
                              }, 200);
                            }}
                          />
                          <div className="absolute z-50 w-full mt-1 bg-[#1a1a24] border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                            {subcategories
                              .filter((sub) => sub.name.toLowerCase().includes(subSearch.toLowerCase()))
                              .map((sub, idx) => (
                                <button
                                  key={sub.id}
                                  type="button"
                                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                    idx === subSearchHighlight
                                      ? 'bg-[#ff914d]/20 text-white'
                                      : 'text-white/80 hover:bg-white/5'
                                  }`}
                                  onMouseDown={() => handleSubSearchSelect(sub)}
                                >
                                  <div className="flex flex-col">
                                    <span>{sub.name}</span>
                                    <span className="text-xs text-white/40">{sub.category_name}</span>
                                  </div>
                                </button>
                              ))}
                            {subcategories.filter((sub) =>
                              sub.name.toLowerCase().includes(subSearch.toLowerCase())
                            ).length === 0 && (
                              <div className="px-4 py-3 text-sm text-white/40">No results found</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <select
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          value={subcategory}
                          onChange={(e) => {
                            const selectedSub = e.target.value;
                            setSubcategory(selectedSub);
                            // Auto-select category from the selected subcategory
                            const found = filteredSubcategories.find((s) => s.name === selectedSub);
                            if (found && found.category_name !== category) {
                              setCategory(found.category_name);
                            }
                          }}
                          disabled={!category}
                        >
                          <option value="" disabled>
                            {category ? 'Select subcategory...' : 'Choose category first'}
                          </option>
                          {filteredSubcategories.map((sub) => (
                            <option key={sub.id} value={sub.name}>
                              {sub.name}
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
                    ref={fullDescRef}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] focus:ring-1 focus:ring-[#ff914d]/20 transition-all resize-none"
                    placeholder="Provide detailed information about the schedule, speakers, requirements..."
                    rows={6}
                    value={fullDesc}
                    onChange={(e) => setFullDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-8 flex justify-end">
                <button
                  className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors border border-white/5 flex items-center gap-2"
                  onClick={() => nextSection(1)}
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
            activeSection === 2
              ? 'opacity-100 ring-1 ring-[#ff914d]/20 border-[#ff914d]/30'
              : 'opacity-60 hover:opacity-80'
          }`}
        >
          <button
            className="w-full flex justify-between items-center text-left focus:outline-none"
            onClick={() => toggleSection(2)}
            type="button"
          >
            <div className="flex items-center gap-4">
              {isSection2Complete ? (
                <div className="w-8 h-8 rounded-full bg-[#4ade80]/10 flex items-center justify-center text-[#4ade80] border border-[#4ade80]/20 animate-scaleIn">
                  <span className="material-symbols-outlined text-[18px]">check</span>
                </div>
              ) : (
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border text-sm font-semibold transition-all duration-300 ${
                    activeSection === 2
                      ? 'bg-[#ff914d]/10 text-[#ff914d] border-[#ff914d]/20'
                      : 'bg-white/5 text-white/40 border-white/10'
                  }`}
                >
                  2
                </div>
              )}
              <h2
                className={`text-lg font-bold font-display ${activeSection === 2 ? 'text-white' : 'text-white/80'}`}
              >
                Schedule &amp; Location
              </h2>
            </div>
            <span
              className={`material-symbols-outlined text-white/60 transition-transform duration-300 ${activeSection === 2 ? 'rotate-180' : ''}`}
            >
              keyboard_arrow_down
            </span>
          </button>

          {activeSection === 2 && (
            <div className="pt-6 border-t border-white/5 animate-fadeIn">
              <div className="flex flex-col gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <DatePicker
                    value={eventStartDate}
                    onChange={setEventStartDate}
                    label="Start Date"
                    minDate={new Date().toISOString().split('T')[0]}
                  />
                  <TimePicker
                    value={eventStartTime}
                    period={eventStartPeriod}
                    onChange={setEventStartTime}
                    onPeriodChange={setEventStartPeriod}
                    label="Start Time"
                  />
                  <DatePicker
                    value={eventEndDate}
                    onChange={setEventEndDate}
                    label="End Date"
                    minDate={eventStartDate || new Date().toISOString().split('T')[0]}
                  />
                  <TimePicker
                    value={eventEndTime}
                    period={eventEndPeriod}
                    onChange={setEventEndTime}
                    onPeriodChange={setEventEndPeriod}
                    label="End Time"
                  />
                </div>

                {/* Venue Location Dropdown */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                      Venue Location
                    </label>
                    <div className="relative" ref={venueDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setShowVenueDropdown(!showVenueDropdown)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-3 text-sm text-white text-left focus:outline-none focus:border-[#ff914d] transition-all flex items-center justify-between"
                      >
                        <span className={venueType ? 'text-white' : 'text-white/40'}>
                          {venueType || 'Select Venue...'}
                        </span>
                        <span className="absolute right-3 top-3.5 text-white/40 text-xs select-none">▼</span>
                      </button>

                      {showVenueDropdown && (
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
                                    setVenueType(option);
                                    setShowVenueDropdown(false);
                                    if (option !== 'Block & Room') {
                                      setBlockNo('');
                                      setRoomNo('');
                                    }
                                    if (option !== 'Other Venue') {
                                      setOtherVenue('');
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
                  {venueType === 'Block & Room' && (
                    <div className="flex flex-col sm:flex-row gap-4 animate-fadeIn">
                      <div className="flex flex-col flex-1 gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                          Block No. <span className="text-[#ff914d]">*</span>
                        </label>
                        <input
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                          placeholder="e.g. 34"
                          type="text"
                          value={blockNo}
                          onChange={(e) => setBlockNo(e.target.value)}
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
                          value={roomNo}
                          onChange={(e) => setRoomNo(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {venueType === 'Other Venue' && (
                    <div className="flex flex-col gap-2 animate-fadeIn">
                      <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                        Venue Name <span className="text-[#ff914d]">*</span>
                      </label>
                      <input
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                        placeholder="Enter custom venue name..."
                        type="text"
                        value={otherVenue}
                        onChange={(e) => setOtherVenue(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-between mt-8">
                <button
                  className="text-white/60 hover:text-white text-sm font-medium transition-colors"
                  onClick={() => toggleSection(1)}
                  type="button"
                >
                  Back
                </button>
                <button
                  className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors border border-white/5 flex items-center gap-2"
                  onClick={() => nextSection(2)}
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
            activeSection === 3
              ? 'opacity-100 ring-1 ring-[#ff914d]/20 border-[#ff914d]/30'
              : 'opacity-60 hover:opacity-80'
          }`}
        >
          <button
            className="w-full flex justify-between items-center text-left focus:outline-none"
            onClick={() => toggleSection(3)}
            type="button"
          >
            <div className="flex items-center gap-4">
              {isSection3Complete ? (
                <div className="w-8 h-8 rounded-full bg-[#4ade80]/10 flex items-center justify-center text-[#4ade80] border border-[#4ade80]/20 animate-scaleIn">
                  <span className="material-symbols-outlined text-[18px]">check</span>
                </div>
              ) : (
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border text-sm font-semibold transition-all duration-300 ${
                    activeSection === 3
                      ? 'bg-[#ff914d]/10 text-[#ff914d] border-[#ff914d]/20'
                      : 'bg-white/5 text-white/40 border-white/10'
                  }`}
                >
                  3
                </div>
              )}
              <h2
                className={`text-lg font-bold font-display ${activeSection === 3 ? 'text-white' : 'text-white/80'}`}
              >
                Registration
              </h2>
            </div>
            <span
              className={`material-symbols-outlined text-white/60 transition-transform duration-300 ${activeSection === 3 ? 'rotate-180' : ''}`}
            >
              keyboard_arrow_down
            </span>
          </button>

          {activeSection === 3 && (
            <div className="pt-6 border-t border-white/5 animate-fadeIn">
              <div className="flex flex-col gap-8">
                {/* 1. Is Registration Required? */}
                <div className="flex flex-col gap-4">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    Is Registration Required?
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      onClick={() => setRegRequired('yes')}
                      className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm transition-all ${
                        regRequired === 'yes'
                          ? 'border-[#ff914d]/50 bg-[#ff914d]/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={`material-symbols-outlined ${regRequired === 'yes' ? 'text-[#ff914d]' : 'text-white/40'}`}
                          >
                            {regRequired === 'yes'
                              ? 'radio_button_checked'
                              : 'radio_button_unchecked'}
                          </span>
                          <span className="text-sm font-medium text-white">Yes</span>
                        </div>
                      </div>
                    </div>
                    <div
                      onClick={() => {
                        setRegRequired('no');
                        setRegPlatform('lpu_events');
                        setRegType('free');
                      }}
                      className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm transition-all ${
                        regRequired === 'no'
                          ? 'border-[#ff914d]/50 bg-[#ff914d]/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={`material-symbols-outlined ${regRequired === 'no' ? 'text-[#ff914d]' : 'text-white/40'}`}
                          >
                            {regRequired === 'no'
                              ? 'radio_button_checked'
                              : 'radio_button_unchecked'}
                          </span>
                          <span className="text-sm font-medium text-white">No</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Only ask sub-questions if registration is required */}
                {regRequired === 'yes' && (
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
                        {studentFieldOptions.map((field) => {
                          const isSelected = requiredStudentFields.includes(field.id);
                          return (
                            <div
                              key={field.id}
                              onClick={() => toggleRequiredField(field.id)}
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
                        {!isAddingCustomField ? (
                          <div
                            onClick={() => setIsAddingCustomField(true)}
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
                              value={customFieldText}
                              onChange={(e) => setCustomFieldText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddCustomField();
                                }
                              }}
                              placeholder="e.g. GitHub Profile, T-Shirt Size, Food Preference"
                              className="w-full bg-transparent text-sm text-white focus:outline-none px-2"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={handleAddCustomField}
                              className="bg-[#ff914d] hover:bg-[#e07530] text-[#050507] text-xs font-bold px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingCustomField(false);
                                setCustomFieldText('');
                              }}
                              className="text-white/40 hover:text-white text-xs px-2 py-1.5"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 2. Registration Type */}
                    <div className="flex flex-col gap-4">
                      <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                        Registration Type
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div
                          onClick={() => handleRegTypeChange('free')}
                          className={`relative flex items-center justify-center cursor-pointer rounded-lg border p-4 shadow-sm transition-all ${
                            regType === 'free'
                              ? 'border-[#ff914d]/50 bg-[#ff914d]/10 text-[#ff914d]'
                              : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
                          }`}
                        >
                          <span className="text-sm font-semibold">Free</span>
                        </div>
                        <div
                          onClick={() => handleRegTypeChange('paid')}
                          className={`relative flex items-center justify-center cursor-pointer rounded-lg border p-4 shadow-sm transition-all ${
                            regType === 'paid'
                              ? 'border-[#ff914d]/50 bg-[#ff914d]/10 text-[#ff914d]'
                              : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
                          }`}
                        >
                          <span className="text-sm font-semibold">Paid</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Registration Platform */}
                    <div className="flex flex-col gap-4 p-5 rounded-xl border border-white/5 bg-white/5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                        Registration Platform
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div
                          onClick={() => setRegPlatform('lpu_events')}
                          className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm transition-all ${
                            regPlatform === 'lpu_events'
                              ? 'border-[#ff914d]/50 bg-[#ff914d]/10'
                              : 'border-white/10 bg-white/5 hover:border-white/20'
                          }`}
                        >
                          <div className="flex w-full items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span
                                className={`material-symbols-outlined ${regPlatform === 'lpu_events' ? 'text-[#ff914d]' : 'text-white/40'}`}
                              >
                                {regPlatform === 'lpu_events'
                                  ? 'radio_button_checked'
                                  : 'radio_button_unchecked'}
                              </span>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-white">LPU Events</span>
                                <span className="text-xs text-white/40 mt-0.5">
                                  Manage registrations here
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div
                          onClick={() => setRegPlatform('external')}
                          className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm transition-all ${
                            regPlatform === 'external'
                              ? 'border-[#ff914d]/50 bg-[#ff914d]/10'
                              : 'border-white/10 bg-white/5 hover:border-white/20'
                          }`}
                        >
                          <div className="flex w-full items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span
                                className={`material-symbols-outlined ${regPlatform === 'external' ? 'text-[#ff914d]' : 'text-white/40'}`}
                              >
                                {regPlatform === 'external'
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

                    {/* 4. External Link Input */}
                    {regPlatform === 'external' && (
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
                            value={externalLink}
                            onChange={(e) => setExternalLink(e.target.value)}
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
                  onClick={() => toggleSection(2)}
                  type="button"
                >
                  Back
                </button>
                {showTickets && (
                  <button
                    className="bg-white/10 hover:bg-white/20 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors border border-white/5 flex items-center gap-2"
                    onClick={() => nextSection(3)}
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
        <div
          className={`rounded-3xl border border-white/10 bg-white/5 p-6 flex flex-col gap-6 transition-all duration-300 ${
            activeSection === 4
              ? 'opacity-100 ring-1 ring-[#ff914d]/20 border-[#ff914d]/30'
              : 'opacity-60 hover:opacity-80'
          }`}
        >
          <button
            className="w-full flex justify-between items-center text-left focus:outline-none"
            onClick={() => toggleSection(4)}
            type="button"
          >
            <div className="flex items-center gap-4">
              {isSection4Complete || !showTickets ? (
                <div className="w-8 h-8 rounded-full bg-[#4ade80]/10 flex items-center justify-center text-[#4ade80] border border-[#4ade80]/20 animate-scaleIn">
                  <span className="material-symbols-outlined text-[18px]">check</span>
                </div>
              ) : (
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border text-sm font-semibold transition-all duration-300 ${
                    activeSection === 4
                      ? 'bg-[#ff914d]/10 text-[#ff914d] border-[#ff914d]/20'
                      : 'bg-white/5 text-white/40 border-white/10'
                  }`}
                >
                  4
                </div>
              )}
              <h2
                className={`text-lg font-bold font-display ${activeSection === 4 ? 'text-white' : 'text-white/80'}`}
              >
                {showTickets ? 'Attendance & Tickets' : 'Review & Publish'}
              </h2>
            </div>
            <span
              className={`material-symbols-outlined text-white/60 transition-transform duration-300 ${activeSection === 4 ? 'rotate-180' : ''}`}
            >
              keyboard_arrow_down
            </span>
          </button>

          {activeSection === 4 && (
            <div className="pt-6 border-t border-white/5 animate-fadeIn">
              <div className="flex flex-col gap-6">
                {showTickets ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            value={ticketPrice}
                            disabled={regType === 'free'}
                            onChange={(e) => setTicketPrice(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                          Total Tickets Available
                        </label>
                        <input
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                          type="number"
                          value={totalTickets}
                          onChange={(e) =>
                            setTotalTickets(
                              e.target.value === '' ? '' : parseInt(e.target.value) || 0
                            )
                          }
                          placeholder="e.g. 100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            value={salesStartDate}
                            onChange={(e) => setSalesStartDate(e.target.value)}
                          />
                        </div>
                      </div>

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
                            value={salesEndDate}
                            onChange={(e) => setSalesEndDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 md:w-1/2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                        Max Tickets per Order
                      </label>
                      <input
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                        type="number"
                        value={maxTickets}
                        onChange={(e) =>
                          setMaxTickets(e.target.value === '' ? '' : parseInt(e.target.value) || 0)
                        }
                        placeholder="e.g. 5"
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-white/60">
                    <p>Registration is not required for this event. Click <strong>Publish Event</strong> in the bottom bar to publish, or continue editing the sections above.</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between mt-8">
                <button
                  className="text-white/60 hover:text-white text-sm font-medium transition-colors"
                  onClick={() => toggleSection(3)}
                  type="button"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 md:left-64 right-0 backdrop-blur-md bg-[#0f0e0b]/90 border-t border-white/5 py-4 px-6 z-50">
        <div className="max-w-[1000px] mx-auto flex justify-between items-center">
          <button
            type="button"
            onClick={handleDiscard}
            className="text-white/60 hover:text-white text-sm font-medium transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span> Discard
          </button>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handlePublish}
              disabled={isSubmitting}
              className="px-8 py-2.5 rounded-lg text-sm font-medium bg-[#ff914d] hover:bg-[#e07530] text-[#050507] transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(255,145,77,0.3)] font-bold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Publishing...' : <>Publish Event <span className="material-symbols-outlined text-[18px]">rocket_launch</span></>}
            </button>
          </div>
        </div>
        {submitError && (
          <div className="max-w-[1000px] mx-auto mt-3">
            <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-2">{submitError}</p>
          </div>
        )}
        {submitSuccess && (
          <div className="max-w-[1000px] mx-auto mt-3">
            <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2">{submitSuccess}</p>
          </div>
        )}
      </div>
    </div>
  );
}
