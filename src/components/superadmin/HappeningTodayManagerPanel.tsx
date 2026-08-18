import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../supabase';
import { getEventImage } from '../../utils/images';
import {
  CalendarDays,
  Clock,
  MapPin,
  Sparkles,
  Megaphone,
  Play,
  Pause,
  Save,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Eye
} from 'lucide-react';
import { HappeningTodayConfig } from '@lpu-events/shared';

const DEFAULT_CONFIG: HappeningTodayConfig = {
  slide_duration_ms: 4500,
  auto_advance: true,
  ad_injection: {
    enabled: true,
    advertisement_id: null,
    insert_after_slide: 2,
    custom_badge: 'SPONSORED',
    custom_cta_text: 'Explore More'
  }
};

interface ActiveAd {
  id: string;
  name: string;
  redirect_url: string | null;
  media_id: string | null;
  status: string;
}

interface TodayEvent {
  id: string;
  name: string;
  description: string;
  start_at: string;
  end_at: string;
  venue_name: string;
  banner_media_id: string | null;
  organizations?: { name: string } | null;
}

interface PreviewSlide {
  type: 'event' | 'ad';
  id: string;
  title: string;
  description?: string;
  badge: string;
  image: string;
  date?: string;
  time?: string;
  venue?: string;
  organizer?: string;
  ctaText: string;
  ctaUrl?: string | null;
}

export const HappeningTodayManagerPanel: React.FC = () => {
  const [config, setConfig] = useState<HappeningTodayConfig>(DEFAULT_CONFIG);
  const [ads, setAds] = useState<ActiveAd[]>([]);
  const [todayEvents, setTodayEvents] = useState<TodayEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Live preview interactive state
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(true);
  const previewTimerRef = useRef<any>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Fetch initial configuration, active ads, and today's events
  const loadData = useCallback(async () => {
    try {
      // 1a. Load global_settings for happening_today_config
      const { data: settingData, error: settingErr } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'happening_today_config')
        .maybeSingle();

      if (!settingErr && settingData?.value) {
        setConfig({
          ...DEFAULT_CONFIG,
          ...settingData.value,
          ad_injection: {
            ...DEFAULT_CONFIG.ad_injection,
            ...(settingData.value.ad_injection || {})
          }
        });
      }

      // 1b. Load active advertisements
      const { data: adsData, error: adsErr } = await supabase
        .from('advertisements')
        .select('id, name, redirect_url, media_id, status')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });

      if (!adsErr && adsData) {
        setAds(adsData);
        // Default select first ad if none selected
        if (!settingData?.value?.ad_injection?.advertisement_id && adsData.length > 0) {
          setConfig(prev => ({
            ...prev,
            ad_injection: {
              ...prev.ad_injection,
              advertisement_id: prev.ad_injection.advertisement_id || adsData[0].id
            }
          }));
        }
      }

      // 1c. Load today's events
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

      const { data: eventsData, error: eventsErr } = await supabase
        .from('events')
        .select('id, name, description, start_at, end_at, venue_name, banner_media_id, organizations(name)')
        .eq('status', 'PUBLISHED')
        .is('deleted_at', null)
        .gte('start_at', todayStart)
        .lte('start_at', todayEnd)
        .order('start_at', { ascending: true });

      if (!eventsErr && eventsData) {
        setTodayEvents(eventsData as any);
      }
    } catch (err: any) {
      console.error('Error loading Happening Today config:', err);
      showToast('error', 'Failed to load configuration.');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Build combined preview slides
  const previewSlides: PreviewSlide[] = React.useMemo(() => {
    // Map today's events
    const mappedEvents: PreviewSlide[] = todayEvents.map((evt) => ({
      type: 'event',
      id: evt.id,
      title: evt.name,
      description: evt.description,
      badge: 'LIVE TODAY',
      image: getEventImage(evt, 'hero'),
      date: new Date(evt.start_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      time: `${new Date(evt.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(evt.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      venue: evt.venue_name,
      organizer: evt.organizations?.name || 'LPU Club',
      ctaText: 'View Details',
      ctaUrl: null
    }));

    if (!config.ad_injection.enabled || !config.ad_injection.advertisement_id) {
      return mappedEvents;
    }

    // Find injected ad
    const selectedAd = ads.find(a => a.id === config.ad_injection.advertisement_id);
    if (!selectedAd) return mappedEvents;

    const adSlide: PreviewSlide = {
      type: 'ad',
      id: selectedAd.id,
      title: selectedAd.name,
      description: 'Official University Partner & Sponsor Announcement',
      badge: config.ad_injection.custom_badge || 'SPONSORED',
      image: getEventImage(selectedAd, 'hero'),
      ctaText: config.ad_injection.custom_cta_text || 'Explore More',
      ctaUrl: selectedAd.redirect_url
    };

    // Splice ad into slides at insert_after_slide position
    const insertPos = Math.min(Math.max(0, config.ad_injection.insert_after_slide), mappedEvents.length);
    const combined = [...mappedEvents];
    combined.splice(insertPos, 0, adSlide);
    return combined;
  }, [todayEvents, config.ad_injection, ads]);

  // 3. Live preview auto-cycle
  useEffect(() => {
    if (!previewPlaying || previewSlides.length <= 1) return;

    previewTimerRef.current = setInterval(() => {
      setPreviewIndex(prev => (prev + 1) % previewSlides.length);
    }, config.slide_duration_ms);

    return () => {
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    };
  }, [previewPlaying, previewSlides.length, config.slide_duration_ms]);

  // Keep index within bounds
  useEffect(() => {
    if (previewIndex >= previewSlides.length && previewSlides.length > 0) {
      setPreviewIndex(0);
    }
  }, [previewSlides.length, previewIndex]);

  // 4. Save handler
  const handleSave = async () => {
    setSaving(true);
    try {
      // Get current admin user ID
      const { data: { user } } = await supabase.auth.getUser();
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', user?.email || '')
        .maybeSingle();

      const adminId = adminUser?.id || '00000000-0000-0000-0000-000000000001';

      const payload = {
        key: 'happening_today_config',
        value: config,
        description: 'Happening Today carousel timing and ad injection settings',
        updated_by: adminId,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('global_settings')
        .upsert(payload, { onConflict: 'key' });

      if (error) throw error;

      showToast('success', 'Happening Today settings saved successfully!');
    } catch (err: any) {
      console.error('Error saving Happening Today settings:', err);
      showToast('error', err.message || 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  const currentPreviewSlide = previewSlides[previewIndex] || previewSlides[0];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl border text-sm font-bold animate-in fade-in slide-in-from-bottom-4 duration-300 ${
          toast.type === 'success'
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
            : 'bg-red-950/90 text-red-200 border-red-500/40'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#201510] border border-[#e2bfb0] dark:border-[#3d2d26] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF5E00] to-[#FF8C00] flex items-center justify-center text-white shadow-[0_8px_20px_rgba(255,94,0,0.35)] shrink-0">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black font-['Outfit'] text-[#261812] dark:text-[#ffede6] tracking-tight">
              Happening Today Manager
            </h1>
            <p className="text-sm font-semibold text-[#5a4136] dark:text-[#ffb693]">
              Control slide duration, auto-play pacing, and inject sponsored advertisements into the student live section.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setConfig(DEFAULT_CONFIG)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-bold text-[#5a4136] dark:text-[#ffede6] hover:bg-[#ffeae1] dark:hover:bg-[#3d2d26] transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
            Reset Defaults
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2.5 px-7 py-3 rounded-2xl bg-gradient-to-r from-[#FF5E00] to-[#FF8C00] text-white font-bold text-sm shadow-[0_4px_18px_rgba(255,94,0,0.35)] hover:shadow-[0_6px_25px_rgba(255,94,0,0.5)] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Configuration Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Slide Timing & Auto-Play */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#201510] border border-[#e2bfb0] dark:border-[#3d2d26] shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-[#FF5E00] flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#261812] dark:text-[#ffede6] font-['Outfit']">
                    Slide Display Duration
                  </h3>
                  <p className="text-xs text-[#5a4136] dark:text-[#ffb693]">
                    Pacing between automatic slide transitions
                  </p>
                </div>
              </div>

              {/* Auto-advance toggle */}
              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, auto_advance: !prev.auto_advance }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  config.auto_advance ? 'bg-[#FF5E00]' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    config.auto_advance ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Range Slider */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">
                  Slide Interval
                </span>
                <span className="px-3 py-1 bg-orange-500/15 text-[#FF5E00] rounded-xl text-sm font-black font-['Outfit']">
                  {(config.slide_duration_ms / 1000).toFixed(1)} seconds ({config.slide_duration_ms}ms)
                </span>
              </div>

              <input
                type="range"
                min="2000"
                max="15000"
                step="500"
                value={config.slide_duration_ms}
                onChange={(e) => setConfig(prev => ({ ...prev, slide_duration_ms: Number(e.target.value) }))}
                className="w-full h-2.5 bg-gray-200 dark:bg-[#3d2d26] rounded-lg appearance-none cursor-pointer accent-[#FF5E00]"
              />

              {/* Quick Presets */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {[
                  { label: '3.0s (Fast)', ms: 3000 },
                  { label: '4.5s (Default)', ms: 4500 },
                  { label: '6.0s (Relaxed)', ms: 6000 },
                  { label: '8.0s (Long)', ms: 8000 }
                ].map((preset) => (
                  <button
                    key={preset.ms}
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, slide_duration_ms: preset.ms }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      config.slide_duration_ms === preset.ms
                        ? 'bg-[#FF5E00] text-white shadow-sm'
                        : 'bg-[#ffeae1] dark:bg-[#3d2d26] text-[#5a4136] dark:text-[#ffb693] hover:bg-[#fee3d8]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Advertisement Injection Controls */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#201510] border border-[#e2bfb0] dark:border-[#3d2d26] shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#261812] dark:text-[#ffede6] font-['Outfit']">
                    Advertisement Injection
                  </h3>
                  <p className="text-xs text-[#5a4136] dark:text-[#ffb693]">
                    Insert a sponsored slide in the Happening Today carousel
                  </p>
                </div>
              </div>

              {/* Ad Toggle */}
              <button
                type="button"
                onClick={() => setConfig(prev => ({
                  ...prev,
                  ad_injection: { ...prev.ad_injection, enabled: !prev.ad_injection.enabled }
                }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  config.ad_injection.enabled ? 'bg-[#FF5E00]' : 'bg-gray-300 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    config.ad_injection.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {config.ad_injection.enabled && (
              <div className="space-y-4 pt-2 border-t border-[#e2bfb0]/40 dark:border-[#3d2d26]/40">
                {/* 1. Select Active Advertisement */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">
                    Select Advertisement *
                  </label>
                  {ads.length === 0 ? (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>No active advertisements found in database. Create one in the Advertisements panel first.</span>
                    </div>
                  ) : (
                    <select
                      value={config.ad_injection.advertisement_id || ''}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        ad_injection: { ...prev.ad_injection, advertisement_id: e.target.value }
                      }))}
                      className="w-full px-4 py-3 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF5E00]"
                    >
                      {ads.map((ad) => (
                        <option key={ad.id} value={ad.id}>
                          {ad.name} {ad.redirect_url ? `(${ad.redirect_url})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 2. Position: Insert After Slide */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">
                    Insert After Slide # (Position) *
                  </label>
                  <select
                    value={config.ad_injection.insert_after_slide}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      ad_injection: { ...prev.ad_injection, insert_after_slide: Number(e.target.value) }
                    }))}
                    className="w-full px-4 py-3 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF5E00]"
                  >
                    <option value={0}>At the Very Beginning (Slide #1)</option>
                    <option value={1}>After Slide 1 (Position #2)</option>
                    <option value={2}>After Slide 2 (Position #3) — Recommended</option>
                    <option value={3}>After Slide 3 (Position #4)</option>
                    <option value={4}>After Slide 4 (Position #5)</option>
                    <option value={999}>At the Very End (Last Slide)</option>
                  </select>
                  <p className="text-[11px] text-[#5a4136] dark:text-[#ffb693]/80">
                    Determines where the advertisement appears among today's {todayEvents.length} live events.
                  </p>
                </div>

                {/* 3. Custom Badge Text */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">
                    Custom Badge Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SPONSORED, PARTNER, PROMO"
                    value={config.ad_injection.custom_badge || ''}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      ad_injection: { ...prev.ad_injection, custom_badge: e.target.value }
                    }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5E00]"
                  />
                </div>

                {/* 4. Custom CTA Button Text */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">
                    Custom CTA Button Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Explore More, Visit Website"
                    value={config.ad_injection.custom_cta_text || ''}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      ad_injection: { ...prev.ad_injection, custom_cta_text: e.target.value }
                    }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5E00]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Live Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#201510] border border-[#e2bfb0] dark:border-[#3d2d26] shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-[#FF5E00] flex items-center justify-center">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#261812] dark:text-[#ffede6] font-['Outfit']">
                    Student Live Preview
                  </h3>
                  <p className="text-xs text-[#5a4136] dark:text-[#ffb693]">
                    Real-time simulation of the student homepage carousel
                  </p>
                </div>
              </div>

              {/* Play / Pause Simulator */}
              <button
                onClick={() => setPreviewPlaying(!previewPlaying)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#ffeae1] dark:bg-[#3d2d26] text-xs font-bold text-[#5a4136] dark:text-[#ffede6] hover:bg-[#fee3d8] transition-colors cursor-pointer"
              >
                {previewPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{previewPlaying ? 'Pause Auto-Play' : 'Resume Auto-Play'}</span>
              </button>
            </div>

            {/* Mockup Card Frame */}
            {previewSlides.length === 0 ? (
              <div className="h-72 rounded-2xl border-2 border-dashed border-[#e2bfb0] dark:border-[#5a4136] flex flex-col items-center justify-center p-6 text-center text-[#5a4136] dark:text-[#ffb693]">
                <CalendarDays className="w-10 h-10 mb-2 opacity-50" />
                <p className="font-bold">No events scheduled for today</p>
                <p className="text-xs">Events scheduled for today will appear here along with injected ads.</p>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-xl bg-black/90 min-h-[380px] flex flex-col md:flex-row">
                {/* Left Side: Cover Image */}
                <div className="w-full md:w-1/2 relative h-48 md:h-auto overflow-hidden">
                  <img
                    src={currentPreviewSlide?.image}
                    alt={currentPreviewSlide?.title}
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                  {/* Beacon Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md border shadow-md flex items-center gap-1.5 ${
                      currentPreviewSlide?.type === 'ad'
                        ? 'bg-amber-500/90 text-black border-amber-300'
                        : 'bg-red-600/90 text-white border-white/20'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      {currentPreviewSlide?.badge}
                    </span>
                  </div>
                </div>

                {/* Right Side: Details */}
                <div className="w-full md:w-1/2 p-5 sm:p-6 flex flex-col justify-between bg-[#0e111d] text-white">
                  <div>
                    <h4 className="text-xl font-black font-['Outfit'] mb-3 line-clamp-2 leading-snug">
                      {currentPreviewSlide?.title}
                    </h4>

                    {currentPreviewSlide?.type === 'event' ? (
                      <div className="space-y-2 mb-3 text-xs text-gray-300">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-3.5 h-3.5 text-[#FF5E00]" />
                          <span>{currentPreviewSlide.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>{currentPreviewSlide.time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-[#FF5E00]" />
                          <span className="truncate">{currentPreviewSlide.venue}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 mb-3 space-y-1">
                        <p className="font-bold flex items-center gap-1.5">
                          <Megaphone className="w-3.5 h-3.5" />
                          Injected Advertisement
                        </p>
                        <p className="text-[11px] text-amber-200/80 truncate">
                          Target URL: {currentPreviewSlide?.ctaUrl || 'None'}
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed mb-4">
                      {currentPreviewSlide?.description}
                    </p>
                  </div>

                  {/* Bottom Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="px-4 py-2 rounded-xl bg-[#FF5E00] text-white font-black text-xs">
                      {currentPreviewSlide?.ctaText}
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-gray-400">
                        {String(previewIndex + 1).padStart(2, '0')} / {String(previewSlides.length).padStart(2, '0')}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setPreviewIndex(prev => (prev - 1 + previewSlides.length) % previewSlides.length)}
                          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer text-xs"
                        >
                          ‹
                        </button>
                        <button
                          onClick={() => setPreviewIndex(prev => (prev + 1) % previewSlides.length)}
                          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer text-xs"
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sequence Flow Queue */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">
                Current Slide Order ({previewSlides.length} Total Slides)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {previewSlides.map((slide, idx) => (
                  <div
                    key={idx}
                    onClick={() => setPreviewIndex(idx)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 ${
                      previewIndex === idx
                        ? 'bg-orange-500/15 border-[#FF5E00] text-[#FF5E00] font-bold shadow-sm'
                        : 'bg-[#fff8f6] dark:bg-[#1a120e] border-[#e2bfb0]/60 dark:border-[#3d2d26] text-[#5a4136] dark:text-[#ffede6]'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-lg bg-black/10 dark:bg-white/10 flex items-center justify-center text-xs font-black">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{slide.title}</p>
                      <span className={`text-[10px] font-black uppercase ${
                        slide.type === 'ad' ? 'text-amber-600 dark:text-amber-400' : 'text-orange-600 dark:text-orange-400'
                      }`}>
                        {slide.type === 'ad' ? '★ Injected Ad' : 'Live Event'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
