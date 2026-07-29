'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SignOutButton } from '@/components/auth/sign-out-button';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

interface TicketTier {
  name: string;
  description: string;
  price: number;
  totalTickets: number;
}

export default function NewEventPage() {
  const router = useRouter();
  const supabase = createClient();

  // Categories loading
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState<Subcategory[]>([]);
  
  // Wizard state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [venue, setVenue] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const [registrationMode, setRegistrationMode] = useState<'individual' | 'team'>('individual');
  const [teamMinSize, setTeamMinSize] = useState<number>(2);
  const [teamMaxSize, setTeamMaxSize] = useState<number>(4);
  const [teamPricing, setTeamPricing] = useState<'fixed' | 'per_member'>('fixed');
  const [maxTickets, setMaxTickets] = useState<number>(100);
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [registrationOpensAt, setRegistrationOpensAt] = useState('');
  const [registrationClosesAt, setRegistrationClosesAt] = useState('');

  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([
    { name: 'General Admission', description: 'Standard entry ticket', price: 0, totalTickets: 100 }
  ]);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  useEffect(() => {
    async function loadTaxonomy() {
      const { data: cats } = await supabase.from('categories').select('*').order('name');
      const { data: subcats } = await supabase.from('subcategories').select('*').order('name');
      if (cats) setCategories(cats);
      if (subcats) setSubcategories(subcats);
    }
    loadTaxonomy();
  }, [supabase]);

  useEffect(() => {
    if (categoryId) {
      setFilteredSubcategories(subcategories.filter(s => s.category_id === categoryId));
      setSubcategoryId('');
    } else {
      setFilteredSubcategories([]);
    }
  }, [categoryId, subcategories]);

  // Handle Cover image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('Image file size must be less than 10MB.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid image (JPEG, PNG, or WEBP).');
      return;
    }

    setError(null);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const addTicketTier = () => {
    setTicketTiers([...ticketTiers, { name: '', description: '', price: 0, totalTickets: 50 }]);
  };

  const removeTicketTier = (index: number) => {
    if (ticketTiers.length === 1) return;
    setTicketTiers(ticketTiers.filter((_, i) => i !== index));
  };

  const updateTicketTier = (index: number, field: keyof TicketTier, value: string | number) => {
    const updated = [...ticketTiers];
    updated[index] = { ...updated[index], [field]: value };
    setTicketTiers(updated);
  };

  function sanitizeSlug(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .replace(/-+/g, '-');
  }

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (!title || title.length < 3) return setError('Title must be at least 3 characters.');
      if (!description || description.length < 10) return setError('Description must be at least 10 characters.');
      if (!categoryId) return setError('Please select a category.');
      if (!venue) return setError('Venue name is required.');
    } else if (step === 2) {
      if (!startsAt || !endsAt) return setError('Please specify both start and end date-times.');
      if (new Date(endsAt) <= new Date(startsAt)) return setError('End date-time must be after the start date-time.');
      if (new Date(startsAt) <= new Date()) return setError('Start date-time must be in the future.');
    } else if (step === 3) {
      for (const tier of ticketTiers) {
        if (!tier.name) return setError('Ticket tier name is required.');
        if (tier.price < 0) return setError('Ticket price cannot be negative.');
        if (tier.totalTickets <= 0) return setError('Ticket capacity must be positive.');
      }
    } else if (step === 4) {
      if (!coverFile) return setError('Please select a cover image poster for the event.');
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setError(null);
    setStep(step - 1);
  };

  const persistEvent = async (publish: boolean) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User session not found. Please log in.');

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (!profile || (profile.role !== 'organizer' && profile.role !== 'super_admin' && profile.role !== 'admin')) {
        throw new Error('Only authorized organizers or administrators can create events.');
      }

      const eventSlug = sanitizeSlug(title) + '-' + Date.now().toString(36);
      
      const eventPayload: Record<string, unknown> = {
        organizer_id: user.id,
        category_id: categoryId,
        subcategory_id: subcategoryId || null,
        title: title.trim(),
        slug: eventSlug,
        description: description.trim(),
        short_description: shortDescription.trim() || null,
        venue: venue.trim(),
        venue_address: venueAddress.trim() || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        is_free: ticketTiers.every(t => t.price === 0),
        registration_mode: registrationMode,
        max_tickets: maxTickets,
        terms_and_conditions: termsAndConditions.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        status: publish ? 'pending_approval' : 'draft',
      };

      if (registrationMode === 'team') {
        eventPayload.team_min_size = teamMinSize;
        eventPayload.team_max_size = teamMaxSize;
        eventPayload.team_pricing = teamPricing;
      }

      if (registrationOpensAt) {
        eventPayload.registration_opens_at = new Date(registrationOpensAt).toISOString();
      }
      if (registrationClosesAt) {
        eventPayload.registration_closes_at = new Date(registrationClosesAt).toISOString();
      }

      const { data: createdEvent, error: eventError } = await supabase
        .from('events')
        .insert(eventPayload)
        .select()
        .single();

      if (eventError || !createdEvent) {
        throw new Error(`Failed to create event: ${eventError?.message}`);
      }

      const eventId = createdEvent.id;

      if (coverFile) {
        const fileExt = coverFile.name.split('.').pop();
        const storagePath = `events/${eventId}/cover-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('event-media')
          .upload(storagePath, coverFile);

        if (uploadError) {
          await supabase.from('events').delete().eq('id', eventId);
          throw new Error(`Failed to upload cover image: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('event-media')
          .getPublicUrl(storagePath);

        await supabase
          .from('events')
          .update({ cover_image_url: publicUrl })
          .eq('id', eventId);
      }

      for (const tier of ticketTiers) {
        if (!tier.name.trim()) continue;
        const { data: createdTier, error: tierError } = await supabase
          .from('ticket_types')
          .insert({
            event_id: eventId,
            name: tier.name.trim(),
            description: tier.description.trim() || null,
            price: tier.price,
            total_tickets: tier.totalTickets
          })
          .select()
          .single();

        if (tierError || !createdTier) {
          throw new Error(`Failed to create ticket tier ${tier.name}: ${tierError?.message}`);
        }

        const { error: invError } = await supabase
          .from('event_inventory')
          .insert({
            event_id: eventId,
            ticket_type_id: createdTier.id,
            total_tickets: tier.totalTickets,
            available_tickets: tier.totalTickets,
            reserved_tickets: 0,
            sold_tickets: 0
          });

        if (invError) {
          throw new Error(`Failed to register inventory for tier ${tier.name}: ${invError.message}`);
        }
      }

      if (publish) {
        const { data: publishResult, error: publishError } = await supabase
          .rpc('publish_event', {
            p_event_id: eventId,
            p_organizer_user_id: user.id
          });

        if (publishError) {
          throw new Error(`Failed to publish event: ${publishError.message}`);
        }
      }

      router.push(`/dashboard/organizer/events/${eventId}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050507] text-[#e6e2dc] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#ff914d]/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[640px] z-10 space-y-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ff914d]/20 border border-[#ff914d]/30 flex items-center justify-center text-[#ff914d] font-bold text-lg select-none font-display">
              LPU
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white font-display">
              Create New Event
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-xs text-white/60 hover:text-white transition"
            >
              Cancel
            </button>
            <SignOutButton />
          </div>
        </div>

        <div className="flex items-center justify-between px-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= i ? 'bg-[#ff914d] text-[#050507]' : 'bg-white/10 text-white/40 border border-white/5'
              }`}>
                {i}
              </span>
              {i < 6 && <div className={`h-0.5 w-10 sm:w-16 transition-all hidden sm:block ${step > i ? 'bg-[#ff914d]' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-sm">
            {error}
          </div>
        )}

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-6">
          
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-white font-display">General Details</h2>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Event Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Annual Tech Hackathon 2026"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id} className="bg-[#050507]">{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Subcategory</label>
                  <select
                    value={subcategoryId}
                    onChange={(e) => setSubcategoryId(e.target.value)}
                    disabled={!categoryId}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all disabled:opacity-50"
                  >
                    <option value="">Select Subcategory</option>
                    {filteredSubcategories.map(s => <option key={s.id} value={s.id} className="bg-[#050507]">{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Short Description</label>
                <input
                  type="text"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Brief summary of what the event is about..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Full Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Provide all event details, schedules, rules, guidelines..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Venue Name</label>
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g. Baldev Raj Auditorium"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Venue Address</label>
                  <input
                    type="text"
                    value={venueAddress}
                    onChange={(e) => setVenueAddress(e.target.value)}
                    placeholder="e.g. Block 34, LPU Campus"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-white font-display">Date & Time Settings</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Event Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Event End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-white font-display">Ticket Configurations</h2>
                <button
                  type="button"
                  onClick={addTicketTier}
                  className="text-xs bg-[#ff914d]/10 hover:bg-[#ff914d]/20 text-[#ff914d] border border-[#ff914d]/20 rounded-lg px-3 py-1.5 transition"
                >
                  + Add Tier
                </button>
              </div>

              <div className="space-y-6 max-h-[360px] overflow-y-auto pr-1">
                {ticketTiers.map((tier, idx) => (
                  <div key={idx} className="p-5 rounded-2xl border border-white/10 bg-white/2 space-y-4 relative">
                    {ticketTiers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTicketTier(idx)}
                        className="absolute top-4 right-4 text-rose-400 hover:text-rose-300 text-xs transition"
                      >
                        Remove
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Tier Name</label>
                        <input
                          type="text"
                          value={tier.name}
                          onChange={(e) => updateTicketTier(idx, 'name', e.target.value)}
                          placeholder="e.g. Standard Entry"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Short Description</label>
                        <input
                          type="text"
                          value={tier.description}
                          onChange={(e) => updateTicketTier(idx, 'description', e.target.value)}
                          placeholder="What's included..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Price (INR)</label>
                        <input
                          type="number"
                          value={tier.price}
                          onChange={(e) => updateTicketTier(idx, 'price', Number(e.target.value))}
                          placeholder="0 for Free Event"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Total Quantity</label>
                        <input
                          type="number"
                          value={tier.totalTickets}
                          onChange={(e) => updateTicketTier(idx, 'totalTickets', Number(e.target.value))}
                          placeholder="Capacity"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-white font-display">Event Cover Image</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-3xl cursor-pointer hover:bg-white/2 border-white/10 hover:border-[#ff914d]/50 transition-all bg-white/2">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <p className="mb-2 text-sm text-white/60">
                        <span className="font-semibold text-[#ff914d]">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-white/40">WEBP, PNG, or JPG (max. 10MB)</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                </div>
                {coverPreview && (
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 max-h-48 flex justify-center bg-[#050507]">
                    <img src={coverPreview} alt="Cover Preview" className="object-contain h-full" />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-white font-display">Registration & Settings</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Registration Mode</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setRegistrationMode('individual')}
                      className={`py-3 rounded-xl border text-sm font-semibold transition-all ${registrationMode === 'individual' ? 'bg-[#ff914d]/10 border-[#ff914d]/30 text-[#ff914d]' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}
                    >
                      Individual
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegistrationMode('team')}
                      className={`py-3 rounded-xl border text-sm font-semibold transition-all ${registrationMode === 'team' ? 'bg-[#ff914d]/10 border-[#ff914d]/30 text-[#ff914d]' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}
                    >
                      Team
                    </button>
                  </div>
                </div>

                {registrationMode === 'team' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Team Min Size</label>
                      <input
                        type="number"
                        min={2}
                        value={teamMinSize}
                        onChange={(e) => setTeamMinSize(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Team Max Size</label>
                      <input
                        type="number"
                        min={teamMinSize}
                        value={teamMaxSize}
                        onChange={(e) => setTeamMaxSize(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Max Tickets Per Order</label>
                  <input
                    type="number"
                    min={1}
                    value={maxTickets}
                    onChange={(e) => setMaxTickets(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Registration Window (optional)</label>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="datetime-local"
                      value={registrationOpensAt}
                      onChange={(e) => setRegistrationOpensAt(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                    />
                    <input
                      type="datetime-local"
                      value={registrationClosesAt}
                      onChange={(e) => setRegistrationClosesAt(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Contact Email</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="contact@example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Contact Phone</label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Terms & Conditions</label>
                  <textarea
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    rows={3}
                    placeholder="Event rules, refund policy, code of conduct..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-white font-display">Review & Submit</h2>

              <div className="space-y-4 text-sm text-white/80">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Event Name</span>
                    <span className="text-white text-base font-semibold">{title}</span>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Venue</span>
                    <span className="text-white text-base font-semibold">{venue}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Starts At</span>
                    <span>{new Date(startsAt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Ends At</span>
                    <span>{new Date(endsAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Registration</span>
                    <span className="capitalize">{registrationMode} {registrationMode === 'team' ? `(Min: ${teamMinSize}, Max: ${teamMaxSize})` : ''}</span>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Max Tickets</span>
                    <span>{maxTickets}</span>
                  </div>
                </div>

                <div className="h-px bg-white/10" />

                <div>
                  <span className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block mb-2">Ticket Tiers</span>
                  <div className="space-y-1">
                    {ticketTiers.map((t, i) => (
                      <div key={i} className="flex justify-between text-xs py-1 px-2 bg-white/2 rounded-md">
                        <span>{t.name} (x{t.totalTickets})</span>
                        <span className="text-white font-bold">{t.price === 0 ? 'Free' : `₹${t.price}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between gap-4 pt-4 border-t border-white/5">
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={loading}
                className="w-24 inline-flex h-12 items-center justify-center rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-sm font-semibold text-white transition"
              >
                Back
              </button>
            ) : (
              <div />
            )}
            
            {step < 6 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex-grow inline-flex h-12 items-center justify-center rounded-xl bg-[#ff914d] hover:bg-[#e07530] text-sm font-semibold text-[#050507] transition shadow-[0_0_15px_rgba(255,145,77,0.3)]"
              >
                Next Step
              </button>
            ) : (
              <div className="flex-grow flex gap-3">
                <button
                  type="button"
                  onClick={() => void persistEvent(false)}
                  disabled={loading}
                  className="flex-1 inline-flex h-12 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
                >
                  {loading ? 'Saving...' : 'Save as Draft'}
                </button>
                <button
                  type="button"
                  onClick={() => void persistEvent(true)}
                  disabled={loading}
                  className="flex-1 inline-flex h-12 items-center justify-center rounded-xl bg-[#ff914d] hover:bg-[#e07530] text-sm font-semibold text-[#050507] transition disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,145,77,0.3)]"
                >
                  {loading ? 'Publishing...' : 'Save & Publish'}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
