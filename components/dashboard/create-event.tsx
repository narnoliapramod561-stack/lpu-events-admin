'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

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
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // Form fields states
  const [eventName, setEventName] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [fullDesc, setFullDesc] = useState('');

  // Schedule & Location (Using HTML5 native inputs with empty initial states)
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [venueLocation, setVenueLocation] = useState('');

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
    eventEndDate !== '' &&
    startTime !== '' &&
    endTime !== '' &&
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
  };

  useEffect(() => {
    const fetchCategories = async () => {
      setCategoriesLoading(true);
      try {
        const response = await fetch('/api/admin/categories');
        if (response.ok) {
          const data = await response.json();
          const cats = (data.data || []).map((cat: any) => ({ id: cat.id, name: cat.name }));
          setCategories(cats);
        }
      } catch {
        // Keep empty categories on error
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

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

    if (!category) {
      setSubmitError('Please select a category.');
      setIsSubmitting(false);
      return;
    }

    const categoryRecord = categories.find((c) => c.name === category);
    if (!categoryRecord) {
      setSubmitError('Selected category is not valid. Please refresh and try again.');
      setIsSubmitting(false);
      return;
    }

    const startsAt = eventStartDate && startTime ? new Date(`${eventStartDate}T${startTime}`).toISOString() : null;
    const endsAt = eventEndDate && endTime ? new Date(`${eventEndDate}T${endTime}`).toISOString() : null;

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

    const slug = eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const payload: any = {
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

    if (fullDesc.trim().length < 10) {
      setSubmitError('Full description must be at least 10 characters.');
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
        setSubmitError(result.error || result.message || 'Failed to create event');
        return;
      }

      setSubmitSuccess('Event created successfully! Redirecting...');
      setTimeout(() => {
        window.location.href = '/dashboard/events';
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
      setFullDesc('');
      setEventStartDate('');
      setEventEndDate('');
      setStartTime('');
      setEndTime('');
      setVenueLocation('');
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
          <p className="text-sm text-white/60">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] focus:ring-1 focus:ring-[#ff914d]/20 transition-all resize-none"
                      placeholder="Briefly describe your event..."
                      rows={2}
                      value={shortDesc}
                      onChange={(e) => setShortDesc(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Category Dropdown */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                        Category
                      </label>
                      <select
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                        value={category}
                        onChange={(e) => handleCategoryChange(e.target.value)}
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
                    </div>

                    {/* Subcategory Dropdown */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                        Subcategory
                      </label>
                      <select
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        value={subcategory}
                        onChange={(e) => setSubcategory(e.target.value)}
                        disabled={!category}
                      >
                        <option value="" disabled>
                          {category ? 'Select subcategory...' : 'Choose category first'}
                        </option>
                        {category &&
                          CATEGORY_MAP[category]?.map((sub) => (
                            <option key={sub} value={sub}>
                              {sub}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Full Width: Full Description */}
                <div className="col-span-1 md:col-span-2 flex flex-col gap-2 mt-4">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    Full Description
                  </label>
                  <textarea
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Start Date (Right-aligned icon) */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                      Start Date
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute right-3 top-3.5 text-white/40 text-[18px] pointer-events-none">
                        calendar_month
                      </span>
                      <input
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all [color-scheme:dark]"
                        type="date"
                        value={eventStartDate}
                        onChange={(e) => setEventStartDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* End Date (Right-aligned icon) */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                      End Date
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute right-3 top-3.5 text-white/40 text-[18px] pointer-events-none">
                        calendar_month
                      </span>
                      <input
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all [color-scheme:dark]"
                        type="date"
                        value={eventEndDate}
                        onChange={(e) => setEventEndDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Start Time (Right-aligned icon) */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                      Start Time
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute right-3 top-3.5 text-white/40 text-[18px] pointer-events-none">
                        schedule
                      </span>
                      <input
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all [color-scheme:dark]"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* End Time (Right-aligned icon) */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                      End Time
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute right-3 top-3.5 text-white/40 text-[18px] pointer-events-none">
                        schedule
                      </span>
                      <input
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all [color-scheme:dark]"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Venue Location (Right-aligned icon) */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    Venue Location
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute right-3 top-3.5 text-white/40 text-[18px]">
                      location_on
                    </span>
                    <input
                      className="w-full bg-white/5 border border-white/10 rounded-lg pl-4 pr-10 py-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                      placeholder="Search for a venue..."
                      type="text"
                      value={venueLocation}
                      onChange={(e) => setVenueLocation(e.target.value)}
                    />
                  </div>
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
