import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, lpuClient } from '../../supabase';
import { getEventImage, resolveDefaultEventImage } from '../../utils/images';
import { ProgressiveImage } from '../ProgressiveImage';
import {
  CalendarDays,
  Clock,
  MapPin,
  Sparkles,
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
  auto_advance: true
};

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
  type: 'event';
  id: string;
  title: string;
  description?: string;
  badge: string;
  image: string;
  fallbackImage?: string;
  date?: string;
  time?: string;
  venue?: string;
  organizer?: string;
  ctaText: string;
  ctaUrl?: string | null;
}

export const HappeningTodayManagerPanel: React.FC = () => {
  const [config, setConfig] = useState<HappeningTodayConfig>(DEFAULT_CONFIG);
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

  // 1. Fetch initial configuration and today's events
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
          ...settingData.value
        });
      }

      // 1b. Load today's events
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

      const { data: eventsData, error: eventsErr } = await supabase
        .from('events')
        .select('id, name, description, start_at, end_at, venue_name, banner_media_id, media_assets:banner_media_id(id, object_key, bucket), organizations(name)')
        .eq('status', 'PUBLISHED')
        .lte('start_at', todayEnd)
        .gte('end_at', todayStart)
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

  // 2. Build preview slides
  const previewSlides: PreviewSlide[] = React.useMemo(() => {
    return todayEvents.map((evt) => ({
      type: 'event',
      id: evt.id,
      title: evt.name,
      description: evt.description,
      badge: 'LIVE TODAY',
      image: getEventImage(evt, 'hero'),
      fallbackImage: resolveDefaultEventImage(evt),
      date: new Date(evt.start_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
      time: `${new Date(evt.start_at).toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit', hour12: true })} – ${new Date(evt.end_at).toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit', hour12: true })}`,
      venue: evt.venue_name,
      organizer: evt.organizations?.name || 'LPU Club',
      ctaText: 'View Details',
      ctaUrl: null
    }));
  }, [todayEvents]);

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authenticated administrative session required.');

      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      const adminId = adminUser?.id;
      if (!adminId) throw new Error('Super Administrator profile could not be verified. Please refresh your session.');

      const { data: result, error: rpcErr } = await lpuClient.manageGlobalSetting('upsert', {
        key: 'happening_today_config',
        value: {
          slide_duration_ms: config.slide_duration_ms,
          auto_advance: config.auto_advance
        },
        description: 'Happening Today carousel timing settings'
      });

      if (rpcErr) throw rpcErr;
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      if (parsed?.code) throw new Error(parsed.message);

      lpuClient.invalidateClientCache('settings');
      lpuClient.invalidateClientCache('homepage');
      lpuClient.dispatchEdgeInvalidation(['settings', 'homepage']).catch(() => {});

      showToast('success', 'Happening Today settings saved and Edge Cache invalidated!');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#202023] border border-[#e2bfb0] dark:border-white/10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF5E00] to-[#FF8C00] flex items-center justify-center text-white shadow-[0_8px_20px_rgba(255,94,0,0.35)] shrink-0">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black font-['Outfit'] text-[#261812] dark:text-white tracking-tight">
              Happening Today Manager
            </h1>
            <p className="text-sm font-semibold text-[#5a4136] dark:text-zinc-400">
              Control slide duration and auto-play pacing for the student Happening Today section.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setConfig(DEFAULT_CONFIG)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-white/10 text-xs font-bold text-[#5a4136] dark:text-zinc-200 hover:bg-[#ffeae1] dark:hover:bg-white/10 transition-colors cursor-pointer"
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
          <div className="p-6 rounded-3xl bg-white dark:bg-[#202023] border border-[#e2bfb0] dark:border-white/10 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-[#FF5E00] flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#261812] dark:text-white font-['Outfit']">
                    Slide Display Duration
                  </h3>
                  <p className="text-xs text-[#5a4136] dark:text-zinc-400">
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
                <span className="text-xs font-bold text-[#5a4136] dark:text-zinc-400 uppercase tracking-wider">
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
                className="w-full h-2.5 bg-gray-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#FF5E00]"
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
                        : 'bg-black/5 dark:bg-white/5 text-[#5a4136] dark:text-zinc-300 hover:bg-black/10 dark:hover:bg-white/10 border border-transparent dark:border-white/10'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Live Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#202023] border border-[#e2bfb0] dark:border-white/10 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-[#FF5E00] flex items-center justify-center">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#261812] dark:text-white font-['Outfit']">
                    Student Preview
                  </h3>
                  <p className="text-xs text-[#5a4136] dark:text-zinc-400">
                    Interactive preview of the student homepage carousel
                  </p>
                </div>
              </div>

              {/* Play / Pause Carousel Preview */}
              <button
                onClick={() => setPreviewPlaying(!previewPlaying)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 text-xs font-bold text-[#5a4136] dark:text-white hover:bg-black/10 dark:hover:bg-white/15 transition-colors cursor-pointer"
              >
                {previewPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{previewPlaying ? 'Pause Auto-Play' : 'Resume Auto-Play'}</span>
              </button>
            </div>

            {/* Mockup Card Frame */}
            {previewSlides.length === 0 ? (
              <div className="h-72 rounded-2xl border-2 border-dashed border-[#e2bfb0] dark:border-white/15 flex flex-col items-center justify-center p-6 text-center text-[#5a4136] dark:text-zinc-400">
                <CalendarDays className="w-10 h-10 mb-2 opacity-50" />
                <p className="font-bold">No events scheduled for today</p>
                <p className="text-xs">Events scheduled for today will appear here on the student website.</p>
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-xl bg-black/90 min-h-[380px] flex flex-col md:flex-row">
                {/* Left Side: Cover Image */}
                <div className="w-full md:w-1/2 relative h-48 md:h-auto overflow-hidden">
                  <ProgressiveImage
                    src={currentPreviewSlide?.image}
                    fallbackSrc={currentPreviewSlide?.fallbackImage || '/defaults/hero_default.webp'}
                    alt={currentPreviewSlide?.title}
                    containerClassName="w-full h-full"
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                </div>

                {/* Right Side: Details */}
                <div className="w-full md:w-1/2 p-5 sm:p-6 flex flex-col justify-between bg-[#121214] text-white">
                  <div>
                    <h4 className="text-xl font-black font-['Outfit'] mb-3 line-clamp-2 leading-snug">
                      {currentPreviewSlide?.title}
                    </h4>

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
          </div>
        </div>
      </div>
    </div>
  );
};
