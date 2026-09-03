import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../supabase';
import { getEventImage } from '../../utils/images';
import {
  Layers,
  Plus,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  Star,
  Megaphone,
  Image as ImageIcon,
  Clock,
  Eye,
  EyeOff,
  Save,
  RotateCw,
  ChevronDown,
  ChevronRight,
  Play,
  Pause,
  AlertCircle,
  CheckCircle2,
  X,
  Settings2,
  Sparkles,
  Monitor,
  Type,
  Link2,
  Tag,
  Timer,
  Info
} from 'lucide-react';

/* ================================================================
   Types
   ================================================================ */
type SlideType = 'EVENT' | 'ADVERTISEMENT' | 'MEDIA';

interface CarouselSlide {
  id: string;
  item_type: SlideType;
  event_id: string | null;
  advertisement_id: string | null;
  media_id: string | null;
  sort_order: number;
  is_active: boolean;
  start_at: string | null;
  end_at: string | null;
  display_duration_ms: number;
  custom_title: string | null;
  custom_subtitle: string | null;
  custom_cta_text: string | null;
  custom_cta_url: string | null;
  badge_text: string | null;
  created_at: string;
  // Joined data
  events?: { id: string; name: string; description?: string; start_at: string; venue_name: string; banner_media_id?: string | null; banner_url?: string | null } | null;
  advertisements?: { id: string; name: string; redirect_url: string | null; media_id: string | null } | null;
}

interface FeaturedEvent {
  id: string;
  name: string;
  description?: string;
  start_at: string;
  venue_name: string;
  banner_media_id?: string | null;
  banner_url?: string | null;
  status: string;
}

interface ActiveAd {
  id: string;
  name: string;
  redirect_url: string | null;
  media_id: string | null;
  status: string;
}

const SLIDE_TYPE_CONFIG: Record<SlideType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  EVENT:         { label: 'Featured Event',  icon: <Star size={14} />,     color: '#ff6b00', bg: 'rgba(255,107,0,0.12)' },
  ADVERTISEMENT: { label: 'Advertisement',   icon: <Megaphone size={14} />, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  MEDIA:         { label: 'Custom Media',    icon: <ImageIcon size={14} />, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
};

/* ================================================================
   Component
   ================================================================ */
export const HeroCarouselManagerPanel: React.FC = () => {
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Available content for the "Add Slide" drawer
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [addSlideType, setAddSlideType] = useState<SlideType>('EVENT');
  const [eventSourceFilter, setEventSourceFilter] = useState<'featured' | 'all'>('featured');
  const [featuredEvents, setFeaturedEvents] = useState<FeaturedEvent[]>([]);
  const [allPublishedEvents, setAllPublishedEvents] = useState<FeaturedEvent[]>([]);
  const [activeAds, setActiveAds] = useState<ActiveAd[]>([]);

  // Expanded slide settings
  const [expandedSlideId, setExpandedSlideId] = useState<string | null>(null);

  // Live preview
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const previewTimer = useRef<any>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  /* ────────── FETCH ────────── */
  const fetchSlides = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('carousel_items')
        .select(`
          *,
          events ( id, name, description, start_at, venue_name, banner_media_id, media_assets:banner_media_id(id, object_key, bucket) ),
          advertisements ( id, name, redirect_url, media_id, media_assets:media_id(id, object_key, bucket) )
        `)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setSlides(data || []);
    } catch (err: any) {
      showToast('error', 'Failed to load carousel slides: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchAvailableContent = useCallback(async () => {
    // 1. Fetch curated featured events from featured_events table
    try {
      const { data: featData, error: featErr } = await supabase
        .from('featured_events')
        .select('event_id, sort_order, events (*, organizations(name), categories(name), media_assets:banner_media_id(id, object_key, bucket))')
        .order('sort_order', { ascending: true });
      if (featErr) console.error('Error loading curated featured events:', featErr);
      const curatedList: FeaturedEvent[] = (featData || [])
        .map((f: any) => f.events)
        .filter(Boolean);
      setFeaturedEvents(curatedList);
    } catch (err) {
      console.error('Failed to load featured events:', err);
    }

    // 2. Fetch all published events for EVENT slides fallback
    try {
      const { data: evts, error: evtsErr } = await supabase
        .from('events')
        .select('id, name, description, start_at, venue_name, banner_media_id, status, media_assets:banner_media_id(id, object_key, bucket)')
        .in('status', ['PUBLISHED', 'COMPLETED'])
        .order('start_at', { ascending: false })
        .limit(50);
      if (evtsErr) console.error('Error loading all events for carousel:', evtsErr);
      setAllPublishedEvents(evts || []);
    } catch (err) {
      console.error('Failed to load all published events:', err);
    }

    // 3. Fetch active ads for ADVERTISEMENT slides
    try {
      const { data: ads } = await supabase
        .from('advertisements')
        .select('id, name, redirect_url, media_id, status, media_assets:media_id(id, object_key, bucket)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);
      setActiveAds(ads || []);
    } catch (err) {
      console.error('Failed to load ads:', err);
    }
  }, []);

  useEffect(() => {
    fetchSlides();
    fetchAvailableContent();
  }, [fetchSlides, fetchAvailableContent]);

  /* ────────── REORDER ────────── */
  const moveSlide = (index: number, direction: 'up' | 'down') => {
    const newSlides = [...slides];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSlides.length) return;
    [newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]];
    newSlides.forEach((s, i) => { s.sort_order = i; });
    setSlides(newSlides);
  };

  /* ────────── TOGGLE ACTIVE ────────── */
  const toggleActive = (id: string) => {
    setSlides(prev => prev.map(s => s.id === id ? { ...s, is_active: !s.is_active } : s));
  };

  /* ────────── UPDATE SLIDE FIELD ────────── */
  const updateSlideField = (id: string, field: string, value: any) => {
    setSlides(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  /* ────────── DELETE ────────── */
  const deleteSlide = async (id: string) => {
    try {
      const { error } = await supabase.from('carousel_items').delete().eq('id', id);
      if (error) throw error;
      setSlides(prev => prev.filter(s => s.id !== id));
      showToast('success', 'Slide removed from carousel.');
    } catch (err: any) {
      showToast('error', 'Failed to delete slide: ' + (err.message || ''));
    }
  };

  /* ────────── ADD SLIDE ────────── */
  const addSlide = async (type: SlideType, contentId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let adminId = '05680f86-a752-4792-9051-d091414d8e9f';
      if (user) {
        const { data: adminRow } = await supabase
          .from('admin_users')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        if (adminRow?.id) adminId = adminRow.id;
      }

      const newOrder = slides.length;
      let insertPayload: any = {
        item_type: type,
        sort_order: newOrder,
        is_active: true,
        display_duration_ms: 5000,
        created_by: adminId,
        updated_by: adminId,
      };

      if (type === 'EVENT') {
        insertPayload.event_id = contentId;
      } else if (type === 'ADVERTISEMENT') {
        insertPayload.advertisement_id = contentId;
      }

      const { data, error } = await supabase
        .from('carousel_items')
        .insert(insertPayload)
        .select(`
          *,
          events ( id, name, description, start_at, venue_name, banner_media_id ),
          advertisements ( id, name, redirect_url, media_id )
        `)
        .single();

      if (error) throw error;
      setSlides(prev => [...prev, data]);
      setShowAddDrawer(false);
      showToast('success', `${SLIDE_TYPE_CONFIG[type].label} slide added to carousel!`);
    } catch (err: any) {
      console.error('Failed to add slide:', err);
      showToast('error', 'Failed to add slide: ' + (err.message || ''));
    }
  };

  /* ────────── SAVE ALL ────────── */
  const saveAllChanges = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let adminId = '05680f86-a752-4792-9051-d091414d8e9f';
      if (user) {
        const { data: adminRow } = await supabase
          .from('admin_users')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        if (adminRow?.id) adminId = adminRow.id;
      }

      for (const slide of slides) {
        const { error } = await supabase
          .from('carousel_items')
          .update({
            sort_order: slide.sort_order,
            is_active: slide.is_active,
            display_duration_ms: slide.display_duration_ms,
            custom_title: slide.custom_title || null,
            custom_subtitle: slide.custom_subtitle || null,
            custom_cta_text: slide.custom_cta_text || null,
            custom_cta_url: slide.custom_cta_url || null,
            badge_text: slide.badge_text || null,
            updated_by: adminId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', slide.id);
        if (error) throw error;
      }
      showToast('success', 'All carousel changes saved successfully!');
    } catch (err: any) {
      showToast('error', 'Failed to save changes: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  /* ────────── PREVIEW ────────── */
  const activeSlides = slides.filter(s => s.is_active);

  useEffect(() => {
    if (!previewMode || activeSlides.length === 0) return;
    const currentSlide = activeSlides[previewIndex % activeSlides.length];
    const duration = currentSlide?.display_duration_ms || 5000;
    
    previewTimer.current = setTimeout(() => {
      setPreviewIndex(prev => (prev + 1) % activeSlides.length);
    }, duration);
    
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current); };
  }, [previewMode, previewIndex, activeSlides]);

  /* ────────── HELPERS ────────── */
  const getSlideTitle = (slide: CarouselSlide): string => {
    if (slide.custom_title) return slide.custom_title;
    if (slide.item_type === 'EVENT' && slide.events) return slide.events.name;
    if (slide.item_type === 'ADVERTISEMENT' && slide.advertisements) return slide.advertisements.name;
    return slide.custom_title || 'Untitled Slide';
  };

  const getSlideImage = (slide: CarouselSlide): string | null => {
    return getEventImage(slide, 'hero');
  };

  const totalDuration = activeSlides.reduce((sum, s) => sum + s.display_duration_ms, 0);

  return (
    <div className="space-y-7 select-text animate-fadeIn">

      {/* ──────── HEADER ──────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-gradient-to-r from-orange-100 to-purple-100 text-[#ff6b00] dark:from-orange-950 dark:to-purple-950 dark:text-orange-300">
              Hero Carousel
            </span>
            <span className="text-xs text-[#5a4136] dark:text-[#ffb693]">
              {activeSlides.length} active slide{activeSlides.length !== 1 ? 's' : ''} · {(totalDuration / 1000).toFixed(0)}s total cycle
            </span>
          </div>
          <h2 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2.5">
            <Layers size={28} className="text-[#ff6b00]" />
            <span>Hero Carousel Builder</span>
          </h2>
          <p className="text-sm text-[#5a4136] dark:text-[#ffb693] mt-1">
            Build the student homepage hero — mix featured events, ads, and memories in any order with custom timings.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Preview Toggle */}
          <button
            type="button"
            onClick={() => { setPreviewMode(!previewMode); setPreviewIndex(0); }}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              previewMode
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                : 'bg-white dark:bg-[#261812] border-[#e2bfb0] dark:border-[#5a4136] text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00] hover:border-[#ff6b00]'
            }`}
          >
            <Monitor size={14} />
            {previewMode ? 'Exit Preview' : 'Live Preview'}
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => fetchSlides()}
            className="p-2 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00] hover:border-[#ff6b00] transition-colors cursor-pointer bg-white dark:bg-[#261812] shadow-xs"
          >
            <RotateCw size={16} />
          </button>

          {/* Add Slide */}
          <button
            type="button"
            onClick={() => {
              fetchAvailableContent();
              setShowAddDrawer(true);
            }}
            className="px-4 py-2 rounded-xl bg-[#ff6b00] hover:bg-[#e05d00] text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={15} />
            Add Slide
          </button>

          {/* Save */}
          <button
            type="button"
            onClick={saveAllChanges}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <RotateCw size={14} className="animate-spin" /> : <Save size={14} />}
            Save All
          </button>
        </div>
      </div>

      {/* ──────── TOAST ──────── */}
      {toast && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-semibold border shadow-sm animate-fadeIn ${
          toast.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}

      {/* ──────── LIVE PREVIEW ──────── */}
      {previewMode && activeSlides.length > 0 && (
        <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl overflow-hidden shadow-lg">
          <div className="px-5 py-3 border-b border-[#e2bfb0] dark:border-[#5a4136] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play size={14} className="text-emerald-500" />
              <span className="text-xs font-bold text-[#261812] dark:text-[#ffede6]">Live Preview — Simulating Student Homepage</span>
            </div>
            <span className="text-[10px] font-semibold text-[#5a4136] dark:text-[#ffb693]">
              Slide {previewIndex + 1} of {activeSlides.length} · {(activeSlides[previewIndex]?.display_duration_ms / 1000).toFixed(1)}s
            </span>
          </div>

          <div className="relative h-64 sm:h-80 lg:h-96 overflow-hidden bg-black/5 dark:bg-black/20">
            {(() => {
              const slide = activeSlides[previewIndex];
              if (!slide) return null;
              const img = getSlideImage(slide) || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1200&auto=format&fit=crop';
              const title = getSlideTitle(slide);
              const typeCfg = SLIDE_TYPE_CONFIG[slide.item_type];

              return (
                <div className="absolute inset-0 flex">
                  {/* Image */}
                  <div className="absolute inset-0">
                    <img 
                      src={img} 
                      alt={title} 
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=1200&auto=format&fit=crop';
                      }}
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
                  </div>
                  {/* Overlay content */}
                  <div className="relative z-10 flex flex-col justify-center p-8 md:p-12 max-w-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider" style={{ backgroundColor: typeCfg.color + '33', color: '#fff' }}>
                        {slide.badge_text || typeCfg.label}
                      </span>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-extrabold font-['Outfit'] text-white mb-2 leading-tight">{title}</h3>
                    {slide.custom_subtitle && (
                      <p className="text-sm text-white/80 mb-4">{slide.custom_subtitle}</p>
                    )}
                    <button className="self-start px-5 py-2.5 rounded-xl bg-[#ff6b00] text-white text-sm font-bold shadow-lg">
                      {slide.custom_cta_text || 'View Details'}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Progress Dots */}
          <div className="px-5 py-3 flex items-center justify-center gap-2 border-t border-[#e2bfb0] dark:border-[#5a4136]">
            {activeSlides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setPreviewIndex(i)}
                className="relative h-2 rounded-full overflow-hidden cursor-pointer transition-all"
                style={{
                  width: i === previewIndex ? 48 : 12,
                  backgroundColor: i === previewIndex ? '#ff6b00' : '#e2bfb0',
                }}
              >
                {i === previewIndex && (
                  <div
                    className="absolute inset-0 bg-[#ff6b00] rounded-full"
                    style={{
                      animation: `progressFill ${s.display_duration_ms}ms linear forwards`,
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ──────── SUMMARY CARDS ──────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { label: 'Total Slides', value: slides.length, icon: <Layers size={20} />, color: '#ff6b00', bgColor: 'orange' },
          { label: 'Active', value: activeSlides.length, icon: <Eye size={20} />, color: '#10b981', bgColor: 'emerald' },
          { label: 'Paused', value: slides.length - activeSlides.length, icon: <Pause size={20} />, color: '#f59e0b', bgColor: 'amber' },
          { label: 'Cycle Time', value: `${(totalDuration / 1000).toFixed(0)}s`, icon: <Timer size={20} />, color: '#8b5cf6', bgColor: 'purple' },
        ] as const).map((card, idx) => (
          <div key={idx} className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full bg-${card.bgColor}-500/5 dark:bg-${card.bgColor}-500/10 -translate-y-8 translate-x-8 group-hover:scale-125 transition-transform duration-500`} />
            <div className="flex justify-between items-start relative">
              <div className={`w-10 h-10 rounded-xl bg-${card.bgColor}-100 dark:bg-${card.bgColor}-950/60 flex items-center justify-center`} style={{ color: card.color }}>
                {card.icon}
              </div>
            </div>
            <p className="text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mt-4">{card.label}</p>
            <h3 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6] mt-1">{card.value}</h3>
          </div>
        ))}
      </div>

      {/* ──────── SLIDE LIST ──────── */}
      <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e2bfb0] dark:border-[#5a4136] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2">
              <Settings2 size={18} className="text-[#ff6b00]" />
              Slide Sequence & Configuration
            </h3>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-100 text-[#ff6b00] dark:bg-orange-950 dark:text-orange-300">
              {slides.length} slides
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-[#5a4136] dark:text-[#ffb693]">
            <Info size={11} />
            <span>Drag slides to reorder · Click to expand settings</span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-9 h-9 border-3 border-[#ff6b00] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-[#5a4136] dark:text-[#ffb693]">Loading carousel configuration…</p>
          </div>
        ) : slides.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center">
              <Sparkles size={32} className="text-[#ff6b00] opacity-50" />
            </div>
            <h4 className="text-lg font-bold text-[#261812] dark:text-[#ffede6]">No Slides Yet</h4>
            <p className="text-sm text-[#5a4136] dark:text-[#ffb693] max-w-sm mx-auto">
              Start building your hero carousel by adding featured events, advertisements, or past event memories.
            </p>
            <button
              type="button"
              onClick={() => setShowAddDrawer(true)}
              className="px-5 py-2.5 rounded-xl bg-[#ff6b00] hover:bg-[#e05d00] text-white text-sm font-bold shadow-sm transition-all cursor-pointer flex items-center gap-2"
            >
              <Plus size={16} />
              Add Your First Slide
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#e2bfb0]/50 dark:divide-[#5a4136]/50">
            {slides.map((slide, index) => {
              const typeCfg = SLIDE_TYPE_CONFIG[slide.item_type];
              const isExpanded = expandedSlideId === slide.id;
              const slideTitle = getSlideTitle(slide);
              const slideImg = getSlideImage(slide);

              return (
                <div key={slide.id} className={`group transition-colors ${!slide.is_active ? 'opacity-50' : ''}`}>
                  {/* Slide Row */}
                  <div className="px-5 py-4 flex items-center gap-4 hover:bg-[#fef5f0]/50 dark:hover:bg-[#1f1510]/50 transition-colors">
                    {/* Drag Handle + Order */}
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <GripVertical size={16} className="text-[#5a4136]/40 dark:text-[#ffb693]/40" />
                      <span className="text-[10px] font-extrabold text-[#5a4136] dark:text-[#ffb693] bg-[#fef5f0] dark:bg-[#1f1510] rounded-md px-1.5 py-0.5">
                        #{index + 1}
                      </span>
                    </div>

                    {/* Thumbnail */}
                    <div className="w-16 h-10 rounded-lg overflow-hidden bg-[#fef5f0] dark:bg-[#1f1510] border border-[#e2bfb0] dark:border-[#5a4136] flex-shrink-0">
                      {slideImg ? (
                        <img 
                          src={slideImg} 
                          alt={slideTitle} 
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop';
                          }}
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon size={14} className="text-[#5a4136]/30" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1"
                          style={{ backgroundColor: typeCfg.bg, color: typeCfg.color }}
                        >
                          {typeCfg.icon}
                          {typeCfg.label}
                        </span>
                        {slide.badge_text && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {slide.badge_text}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-[#261812] dark:text-[#ffede6] mt-1 truncate">{slideTitle}</p>
                    </div>

                    {/* Duration */}
                    <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0 bg-[#fef5f0] dark:bg-[#1f1510] px-3 py-1.5 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136]">
                      <Clock size={12} className="text-[#ff6b00]" />
                      <span className="text-xs font-bold text-[#261812] dark:text-[#ffede6]">{(slide.display_duration_ms / 1000).toFixed(1)}s</span>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button type="button" onClick={() => moveSlide(index, 'up')} disabled={index === 0}
                        className="w-7 h-7 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] flex items-center justify-center text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00] hover:border-[#ff6b00] transition-all cursor-pointer disabled:opacity-30 bg-white dark:bg-[#261812]">
                        <ArrowUp size={13} />
                      </button>
                      <button type="button" onClick={() => moveSlide(index, 'down')} disabled={index === slides.length - 1}
                        className="w-7 h-7 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] flex items-center justify-center text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00] hover:border-[#ff6b00] transition-all cursor-pointer disabled:opacity-30 bg-white dark:bg-[#261812]">
                        <ArrowDown size={13} />
                      </button>
                      <button type="button" onClick={() => toggleActive(slide.id)}
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                          slide.is_active
                            ? 'border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                            : 'border-[#e2bfb0] dark:border-[#5a4136] text-[#5a4136] dark:text-[#ffb693] bg-white dark:bg-[#261812]'
                        }`}>
                        {slide.is_active ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button type="button" onClick={() => setExpandedSlideId(isExpanded ? null : slide.id)}
                        className="w-7 h-7 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] flex items-center justify-center text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00] hover:border-[#ff6b00] transition-all cursor-pointer bg-white dark:bg-[#261812]">
                        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </button>
                      <button type="button" onClick={() => { if (confirm('Remove this slide from the carousel?')) deleteSlide(slide.id); }}
                        className="w-7 h-7 rounded-lg border border-red-200 dark:border-red-800 flex items-center justify-center text-red-400 hover:text-red-600 hover:border-red-400 transition-all cursor-pointer bg-white dark:bg-[#261812]">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* ──────── EXPANDED SETTINGS ──────── */}
                  {isExpanded && (
                    <div className="px-5 pb-5 animate-fadeIn">
                      <div className="ml-10 bg-[#fef5f0] dark:bg-[#1f1510] border border-[#e2bfb0] dark:border-[#5a4136] rounded-xl p-5 space-y-5">
                        {/* Row 1: Duration Slider */}
                        <div>
                          <label className="flex items-center gap-1.5 text-[11px] font-black text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-2">
                            <Timer size={12} className="text-[#ff6b00]" />
                            Display Duration
                          </label>
                          <div className="flex items-center gap-4">
                            <input
                              type="range"
                              min={1000}
                              max={15000}
                              step={500}
                              value={slide.display_duration_ms}
                              onChange={(e) => updateSlideField(slide.id, 'display_duration_ms', parseInt(e.target.value))}
                              className="flex-1 h-2 rounded-full appearance-none bg-[#e2bfb0] dark:bg-[#5a4136] cursor-pointer accent-[#ff6b00]"
                            />
                            <span className="text-sm font-extrabold text-[#261812] dark:text-[#ffede6] bg-white dark:bg-[#261812] px-3 py-1.5 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] min-w-[60px] text-center">
                              {(slide.display_duration_ms / 1000).toFixed(1)}s
                            </span>
                          </div>
                          <p className="text-[10px] text-[#5a4136]/60 dark:text-[#ffb693]/60 mt-1">How long this slide stays visible before auto-advancing (1s – 15s)</p>
                        </div>

                        {/* Row 2: Custom Title & Subtitle */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="flex items-center gap-1.5 text-[11px] font-black text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-2">
                              <Type size={12} className="text-[#ff6b00]" />
                              Custom Title Override
                            </label>
                            <input
                              type="text"
                              value={slide.custom_title || ''}
                              onChange={(e) => updateSlideField(slide.id, 'custom_title', e.target.value)}
                              placeholder={getSlideTitle({ ...slide, custom_title: null })}
                              className="w-full px-3 py-2 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#261812] text-sm text-[#261812] dark:text-[#ffede6] placeholder:text-[#5a4136]/40 focus:ring-2 focus:ring-[#ff6b00]/30 focus:border-[#ff6b00] outline-none transition-all"
                            />
                          </div>
                          <div>
                            <label className="flex items-center gap-1.5 text-[11px] font-black text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-2">
                              <Type size={12} className="text-[#ff6b00]" />
                              Custom Subtitle
                            </label>
                            <input
                              type="text"
                              value={slide.custom_subtitle || ''}
                              onChange={(e) => updateSlideField(slide.id, 'custom_subtitle', e.target.value)}
                              placeholder="Optional subtitle text for the overlay"
                              className="w-full px-3 py-2 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#261812] text-sm text-[#261812] dark:text-[#ffede6] placeholder:text-[#5a4136]/40 focus:ring-2 focus:ring-[#ff6b00]/30 focus:border-[#ff6b00] outline-none transition-all"
                            />
                          </div>
                        </div>

                        {/* Row 3: CTA & Badge */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="flex items-center gap-1.5 text-[11px] font-black text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-2">
                              <Sparkles size={12} className="text-[#ff6b00]" />
                              CTA Button Text
                            </label>
                            <input
                              type="text"
                              value={slide.custom_cta_text || ''}
                              onChange={(e) => updateSlideField(slide.id, 'custom_cta_text', e.target.value)}
                              placeholder="View Details"
                              className="w-full px-3 py-2 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#261812] text-sm text-[#261812] dark:text-[#ffede6] placeholder:text-[#5a4136]/40 focus:ring-2 focus:ring-[#ff6b00]/30 focus:border-[#ff6b00] outline-none transition-all"
                            />
                          </div>
                          <div>
                            <label className="flex items-center gap-1.5 text-[11px] font-black text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-2">
                              <Link2 size={12} className="text-[#ff6b00]" />
                              CTA Link URL
                            </label>
                            <input
                              type="text"
                              value={slide.custom_cta_url || ''}
                              onChange={(e) => updateSlideField(slide.id, 'custom_cta_url', e.target.value)}
                              placeholder="https://..."
                              className="w-full px-3 py-2 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#261812] text-sm text-[#261812] dark:text-[#ffede6] placeholder:text-[#5a4136]/40 focus:ring-2 focus:ring-[#ff6b00]/30 focus:border-[#ff6b00] outline-none transition-all"
                            />
                          </div>
                          <div>
                            <label className="flex items-center gap-1.5 text-[11px] font-black text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-2">
                              <Tag size={12} className="text-[#ff6b00]" />
                              Badge Label
                            </label>
                            <input
                              type="text"
                              value={slide.badge_text || ''}
                              onChange={(e) => updateSlideField(slide.id, 'badge_text', e.target.value)}
                              placeholder={typeCfg.label}
                              className="w-full px-3 py-2 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#261812] text-sm text-[#261812] dark:text-[#ffede6] placeholder:text-[#5a4136]/40 focus:ring-2 focus:ring-[#ff6b00]/30 focus:border-[#ff6b00] outline-none transition-all"
                            />
                          </div>
                        </div>

                        {/* Quick Duration Presets */}
                        <div>
                          <span className="text-[10px] font-bold text-[#5a4136]/60 dark:text-[#ffb693]/60 uppercase tracking-wider">Quick Duration:</span>
                          <div className="flex gap-2 mt-1.5">
                            {[3000, 5000, 7000, 10000].map(ms => (
                              <button
                                key={ms}
                                type="button"
                                onClick={() => updateSlideField(slide.id, 'display_duration_ms', ms)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                  slide.display_duration_ms === ms
                                    ? 'bg-[#ff6b00] text-white shadow-xs'
                                    : 'bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] text-[#5a4136] dark:text-[#ffb693] hover:border-[#ff6b00]'
                                }`}
                              >
                                {ms / 1000}s
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ──────── ADD SLIDE DRAWER ──────── */}
      {showAddDrawer && (
        <div className="fixed inset-0 z-[100] flex justify-end" onClick={(e) => { if (e.target === e.currentTarget) setShowAddDrawer(false); }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-[#fff8f6] dark:bg-[#1a120e] h-full overflow-y-auto shadow-2xl animate-fadeIn border-l border-[#e2bfb0] dark:border-[#5a4136]">
            {/* Drawer Header */}
            <div className="sticky top-0 z-10 bg-[#fff8f6]/95 dark:bg-[#1a120e]/95 backdrop-blur-md px-6 py-5 border-b border-[#e2bfb0] dark:border-[#5a4136] flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2">
                  <Plus size={20} className="text-[#ff6b00]" />
                  Add Slide
                </h3>
                <p className="text-xs text-[#5a4136] dark:text-[#ffb693] mt-0.5">Choose content to add to the hero carousel</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDrawer(false)}
                className="w-8 h-8 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] flex items-center justify-center text-[#5a4136] dark:text-[#ffb693] hover:text-red-500 hover:border-red-400 transition-all cursor-pointer bg-white dark:bg-[#261812]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Type Tabs */}
            <div className="px-6 py-4">
              <div className="flex items-center bg-[#fef5f0] dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-xl p-1 text-xs font-bold">
                {(['EVENT', 'ADVERTISEMENT'] as SlideType[]).map(type => {
                  const cfg = SLIDE_TYPE_CONFIG[type];
                  return (
                    <button
                      key={type}
                      onClick={() => setAddSlideType(type)}
                      className={`flex-1 px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        addSlideType === type
                          ? 'bg-[#ff6b00] text-white shadow-xs'
                          : 'text-[#5a4136] dark:text-[#ffb693] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26]'
                      }`}
                    >
                      {cfg.icon}
                      <span className="hidden sm:inline">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content List */}
            <div className="px-6 pb-6 space-y-3">
              {addSlideType === 'EVENT' && (
                <>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs font-semibold text-[#5a4136] dark:text-[#ffb693]">
                      {eventSourceFilter === 'featured' ? 'Curated Featured Events:' : 'All Published Events:'}
                    </p>
                    <div className="flex items-center gap-1 bg-[#fef5f0] dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-lg p-0.5 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setEventSourceFilter('featured')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          eventSourceFilter === 'featured'
                            ? 'bg-[#ff6b00] text-white shadow-xs'
                            : 'text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00]'
                        }`}
                      >
                        Curated ({featuredEvents.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setEventSourceFilter('all')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          eventSourceFilter === 'all'
                            ? 'bg-[#ff6b00] text-white shadow-xs'
                            : 'text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00]'
                        }`}
                      >
                        All ({allPublishedEvents.length})
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const currentList = eventSourceFilter === 'featured' ? featuredEvents : allPublishedEvents;
                    if (currentList.length === 0) {
                      return (
                        <div className="text-center py-8 bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-xl p-6">
                          <p className="text-sm font-bold text-[#261812] dark:text-[#ffede6]">
                            {eventSourceFilter === 'featured' ? 'No Curated Featured Events Found' : 'No Published Events Found'}
                          </p>
                          <p className="text-xs text-[#5a4136]/70 dark:text-[#ffb693]/70 mt-1">
                            {eventSourceFilter === 'featured'
                              ? 'Curate featured events in the "Featured Events" sidebar panel first, or click "All" above.'
                              : 'Publish events in "All Active Events" to make them available.'}
                          </p>
                        </div>
                      );
                    }
                    return currentList.map(evt => (
                      <button
                        key={evt.id}
                        type="button"
                        onClick={() => addSlide('EVENT', evt.id)}
                        className="w-full text-left p-4 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#261812] hover:border-[#ff6b00] hover:shadow-md transition-all cursor-pointer group flex items-center gap-4"
                      >
                        <div className="w-14 h-10 rounded-lg overflow-hidden bg-[#fef5f0] dark:bg-[#1f1510] flex-shrink-0">
                          {getEventImage(evt) ? (
                            <img src={getEventImage(evt)} alt={evt.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Star size={14} className="text-[#ff6b00]/30" /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#261812] dark:text-[#ffede6] truncate group-hover:text-[#ff6b00] transition-colors">{evt.name}</p>
                          <p className="text-[11px] text-[#5a4136] dark:text-[#ffb693]">
                            {new Date(evt.start_at).toLocaleDateString()} · {evt.venue_name}
                          </p>
                        </div>
                        <Plus size={16} className="text-[#5a4136]/40 group-hover:text-[#ff6b00] transition-colors flex-shrink-0" />
                      </button>
                    ));
                  })()}
                </>
              )}

              {addSlideType === 'ADVERTISEMENT' && (
                <>
                  <p className="text-xs font-semibold text-[#5a4136] dark:text-[#ffb693] mb-3">Select an active advertisement:</p>
                  {activeAds.length === 0 ? (
                    <p className="text-sm text-[#5a4136]/60 dark:text-[#ffb693]/60 text-center py-8">No active advertisements available.</p>
                  ) : activeAds.map(ad => (
                    <button
                      key={ad.id}
                      type="button"
                      onClick={() => addSlide('ADVERTISEMENT', ad.id)}
                      className="w-full text-left p-4 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#261812] hover:border-[#8b5cf6] hover:shadow-md transition-all cursor-pointer group flex items-center gap-4"
                    >
                      <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center flex-shrink-0">
                        <Megaphone size={16} className="text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#261812] dark:text-[#ffede6] truncate group-hover:text-purple-600 transition-colors">{ad.name}</p>
                        <p className="text-[11px] text-[#5a4136] dark:text-[#ffb693]">
                          {ad.redirect_url ? 'Has redirect URL' : 'No redirect'}
                        </p>
                      </div>
                      <Plus size={16} className="text-[#5a4136]/40 group-hover:text-purple-600 transition-colors flex-shrink-0" />
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CSS for progress animation */}
      <style>{`
        @keyframes progressFill {
          from { width: 0; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
};
