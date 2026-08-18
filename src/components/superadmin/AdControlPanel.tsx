import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase';
import { lpuClient } from '../../supabase';
import {
  LayoutDashboard,
  Megaphone,
  ToggleLeft,
  ToggleRight,
  Save,
  RefreshCw,
  Eye,
  Layers,
  GalleryHorizontalEnd,
  PanelTop,
  AlignJustify,
  SquareSplitHorizontal,
  Columns2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings2,
  Info
} from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface AdSlotConfig {
  key: string;
  enabled: boolean;
  adId: string | null;
}

interface AdPlacementSettings {
  // Event Hub grid interval
  eventHubAdInterval: number;
  // Slot toggles & assigned ads
  slots: {
    hero_below: AdSlotConfig;
    between_hub_past: AdSlotConfig;
    event_details_top: AdSlotConfig;
    event_details_bottom: AdSlotConfig;
    happening_today_below: AdSlotConfig;
  };
}

const DEFAULT_SETTINGS: AdPlacementSettings = {
  eventHubAdInterval: 6,
  slots: {
    hero_below: { key: 'hero_below', enabled: true, adId: null },
    between_hub_past: { key: 'between_hub_past', enabled: true, adId: null },
    event_details_top: { key: 'event_details_top', enabled: false, adId: null },
    event_details_bottom: { key: 'event_details_bottom', enabled: false, adId: null },
    happening_today_below: { key: 'happening_today_below', enabled: false, adId: null },
  },
};

const SLOT_META: Record<string, { label: string; desc: string; icon: React.ReactNode; section: string }> = {
  hero_below: {
    label: 'Below Hero Carousel',
    desc: 'Full-width cinematic ad banner right below the main hero carousel on homepage.',
    icon: <PanelTop className="w-5 h-5" />,
    section: 'Homepage',
  },
  between_hub_past: {
    label: 'Between Event Hub & Past Events',
    desc: 'Ad banner displayed as a separator between the Events Hub grid and Past Events section.',
    icon: <SquareSplitHorizontal className="w-5 h-5" />,
    section: 'Homepage',
  },
  happening_today_below: {
    label: 'Below Happening Today Slider',
    desc: 'Ad slot shown right after the Happening Today horizontal scroll section.',
    icon: <GalleryHorizontalEnd className="w-5 h-5" />,
    section: 'Homepage',
  },
  event_details_top: {
    label: 'Event Details — Top',
    desc: 'Sponsor spotlight shown at the top of any Event Details page, just below the title.',
    icon: <Columns2 className="w-5 h-5" />,
    section: 'Event Details',
  },
  event_details_bottom: {
    label: 'Event Details — Bottom',
    desc: 'Ad slot at the bottom of Event Details page, below related events.',
    icon: <AlignJustify className="w-5 h-5" />,
    section: 'Event Details',
  },
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export const AdControlPanel: React.FC = () => {
  const [settings, setSettings] = useState<AdPlacementSettings>(DEFAULT_SETTINGS);
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [previewInterval, setPreviewInterval] = useState(6);
  const [activeSection, setActiveSection] = useState<'homepage' | 'event-details'>('homepage');

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load settings & ads from DB ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // Load global_settings
      const { data: dbSettings } = await lpuClient.fetchGlobalSettings();
      if (dbSettings) {
        const intervalSetting = dbSettings.find((s: any) => s.key === 'ad_placement_interval');
        const slotsSetting = dbSettings.find((s: any) => s.key === 'ad_placement_slots');

        const newSettings: AdPlacementSettings = { ...DEFAULT_SETTINGS };
        if (intervalSetting) newSettings.eventHubAdInterval = Number(intervalSetting.value) || 6;
        if (slotsSetting) {
          try {
            const parsed = typeof slotsSetting.value === 'string'
              ? JSON.parse(slotsSetting.value)
              : slotsSetting.value;
            newSettings.slots = { ...DEFAULT_SETTINGS.slots, ...parsed };
          } catch {}
        }
        setSettings(newSettings);
        setPreviewInterval(newSettings.eventHubAdInterval);
      }

      // Load all ads from DB
      const { data: adData } = await supabase
        .from('advertisements')
        .select('id, name, status, media_assets(object_key, bucket)')
        .order('created_at', { ascending: false });
      setAds(adData || []);
    } catch (err) {
      console.error('Ad Control load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Save to global_settings ──
  const handleSave = async () => {
    setSaving(true);
    try {
      // Save interval
      await lpuClient.manageGlobalSetting('upsert', {
        key: 'ad_placement_interval',
        value: settings.eventHubAdInterval,
        description: 'Number of event cards between inline ads in Event Hub grid',
      });

      // Save slot config as JSON
      await lpuClient.manageGlobalSetting('upsert', {
        key: 'ad_placement_slots',
        value: settings.slots,
        description: 'Ad slot enable/disable and assigned ad IDs for all student-web placements',
      });

      showToast('success', 'Ad placement settings saved & live!');
      setPreviewInterval(settings.eventHubAdInterval);
    } catch (err: any) {
      showToast('error', 'Save failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  // ── Slot controls ──
  const toggleSlot = (key: keyof AdPlacementSettings['slots']) => {
    setSettings(prev => ({
      ...prev,
      slots: {
        ...prev.slots,
        [key]: { ...prev.slots[key], enabled: !prev.slots[key].enabled },
      },
    }));
  };

  const assignAd = (key: keyof AdPlacementSettings['slots'], adId: string | null) => {
    setSettings(prev => ({
      ...prev,
      slots: {
        ...prev.slots,
        [key]: { ...prev.slots[key], adId },
      },
    }));
  };

  const activeAds = ads.filter(a => a.status === 'active');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-[#5a4136] dark:text-[#ffb693]">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff6b00]" />
          <span className="text-sm font-semibold">Loading ad settings…</span>
        </div>
      </div>
    );
  }

  const homepageSlots = ['hero_below', 'happening_today_below', 'between_hub_past'];
  const detailsSlots = ['event_details_top', 'event_details_bottom'];

  return (
    <div className="space-y-8 pb-12">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl border text-sm font-semibold transition-all ${
          toast.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200'
            : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-[#ff6b00]" />
            Ad Control Center
          </h1>
          <p className="text-sm text-[#5a4136] dark:text-[#ffb693] mt-1.5">
            Control every ad slot on the student website — toggle placements, assign ads, and tune the Event Hub frequency.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadAll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] text-[#5a4136] dark:text-[#ffb693] text-sm font-semibold hover:border-[#ff6b00] hover:text-[#ff6b00] transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ff6b00] text-white text-sm font-bold hover:bg-[#e05e00] disabled:opacity-60 transition-colors shadow-md shadow-orange-200 dark:shadow-orange-900/40"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save All Settings'}
          </button>
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Ad Slots', value: Object.keys(settings.slots).length, icon: <Layers className="w-5 h-5" /> },
          { label: 'Active Slots', value: Object.values(settings.slots).filter(s => s.enabled).length, icon: <ToggleRight className="w-5 h-5 text-green-500" /> },
          { label: 'Ads Assigned', value: Object.values(settings.slots).filter(s => s.adId).length, icon: <Megaphone className="w-5 h-5" /> },
          { label: 'Event Hub Interval', value: `Every ${settings.eventHubAdInterval} cards`, icon: <LayoutDashboard className="w-5 h-5" /> },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-[#261812] rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-[#fff1eb] dark:bg-[#3d2d26] flex items-center justify-center text-[#ff6b00]">
              {stat.icon}
            </div>
            <div>
              <div className="text-xl font-black text-[#261812] dark:text-[#ffede6]">{stat.value}</div>
              <div className="text-xs text-[#5a4136] dark:text-[#ffb693]">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* ── Left: Controls ── */}
        <div className="xl:col-span-8 space-y-6">

          {/* ── Event Hub Interval ── */}
          <section className="bg-white dark:bg-[#261812] rounded-2xl border border-[#e2bfb0] dark:border-[#5a4136] p-6 shadow-sm">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-[#ff6b00]" />
                  Event Hub — Inline Ad Frequency
                </h3>
                <p className="text-xs text-[#5a4136] dark:text-[#ffb693] mt-1">
                  How many event cards appear before an inline sponsored ad card is injected in the Event Hub grid.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex items-center gap-3 bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] rounded-xl p-2">
                <button
                  onClick={() => setSettings(prev => ({ ...prev, eventHubAdInterval: Math.max(1, prev.eventHubAdInterval - 1) }))}
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-[#5a4136] dark:text-[#ffb693] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] font-bold text-xl transition-colors"
                >−</button>
                <div className="flex flex-col items-center min-w-[60px]">
                  <span className="text-3xl font-black text-[#ff6b00]">{settings.eventHubAdInterval}</span>
                  <span className="text-[10px] text-[#5a4136] dark:text-[#ffb693] uppercase font-bold tracking-wider">cards</span>
                </div>
                <button
                  onClick={() => setSettings(prev => ({ ...prev, eventHubAdInterval: Math.min(20, prev.eventHubAdInterval + 1) }))}
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-[#5a4136] dark:text-[#ffb693] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] font-bold text-xl transition-colors"
                >+</button>
              </div>
              <div className="flex-1">
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={settings.eventHubAdInterval}
                  onChange={e => setSettings(prev => ({ ...prev, eventHubAdInterval: Number(e.target.value) }))}
                  className="w-full accent-[#ff6b00] cursor-pointer"
                />
                <div className="flex justify-between text-xs text-[#5a4136] dark:text-[#ffb693] mt-1">
                  <span>Every 1 (dense)</span>
                  <span>Every 20 (sparse)</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-2 p-3 bg-[#fff1eb] dark:bg-[#1a120e] rounded-lg border border-[#e2bfb0]/50 dark:border-[#5a4136]/50">
              <Info className="w-4 h-4 text-[#ff6b00] shrink-0 mt-0.5" />
              <p className="text-xs text-[#5a4136] dark:text-[#ffb693]">
                An inline ad card will appear after every <strong className="text-[#ff6b00]">{settings.eventHubAdInterval}</strong> event cards in the Event Hub. Active ads are rotated randomly. Setting this to <strong>1</strong> shows an ad after every single card.
              </p>
            </div>
          </section>

          {/* ── Section Toggle ── */}
          <div className="flex gap-2">
            {(['homepage', 'event-details'] as const).map(sec => (
              <button
                key={sec}
                onClick={() => setActiveSection(sec)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeSection === sec
                    ? 'bg-[#ff6b00] text-white shadow-md'
                    : 'bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] text-[#5a4136] dark:text-[#ffb693] hover:border-[#ff6b00]'
                }`}
              >
                {sec === 'homepage' ? '🏠 Homepage Slots' : '📄 Event Details Slots'}
              </button>
            ))}
          </div>

          {/* ── Ad Slot Cards ── */}
          <div className="space-y-4">
            {(activeSection === 'homepage' ? homepageSlots : detailsSlots).map((slotKey) => {
              const slot = settings.slots[slotKey as keyof AdPlacementSettings['slots']];
              const meta = SLOT_META[slotKey];
              const assignedAd = ads.find(a => a.id === slot.adId);
              return (
                <div
                  key={slotKey}
                  className={`bg-white dark:bg-[#261812] rounded-2xl border-2 transition-all duration-200 shadow-sm ${
                    slot.enabled
                      ? 'border-[#ff6b00]/40 dark:border-[#ff6b00]/30'
                      : 'border-[#e2bfb0] dark:border-[#5a4136] opacity-75'
                  }`}
                >
                  {/* Slot Header */}
                  <div className="flex items-start justify-between p-5 pb-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        slot.enabled ? 'bg-[#ff6b00]/10 text-[#ff6b00]' : 'bg-[#f0ece8] dark:bg-[#3d2d26] text-[#5a4136] dark:text-[#ffb693]'
                      }`}>
                        {meta.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[#261812] dark:text-[#ffede6]">{meta.label}</h4>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            slot.enabled
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-gray-100 dark:bg-[#3d2d26] text-gray-500 dark:text-[#ffb693]'
                          }`}>
                            {slot.enabled ? 'LIVE' : 'OFF'}
                          </span>
                        </div>
                        <p className="text-xs text-[#5a4136] dark:text-[#ffb693] mt-0.5 leading-relaxed">{meta.desc}</p>
                        <span className="text-[10px] text-[#ff6b00] font-bold mt-1 inline-block">{meta.section}</span>
                      </div>
                    </div>
                    {/* Toggle */}
                    <button
                      onClick={() => toggleSlot(slotKey as keyof AdPlacementSettings['slots'])}
                      className="shrink-0 ml-4"
                      title={slot.enabled ? 'Click to disable' : 'Click to enable'}
                    >
                      {slot.enabled
                        ? <ToggleRight className="w-9 h-9 text-[#ff6b00]" />
                        : <ToggleLeft className="w-9 h-9 text-[#c9b8b3] dark:text-[#5a4136]" />
                      }
                    </button>
                  </div>

                  {/* Ad Assignment (only if enabled) */}
                  {slot.enabled && (
                    <div className="px-5 pb-5 border-t border-[#f0ece8] dark:border-[#3d2d26] pt-4">
                      <label className="block text-xs font-bold text-[#261812] dark:text-[#ffede6] mb-2">
                        Assign Ad to this slot
                      </label>
                      <select
                        value={slot.adId || ''}
                        onChange={e => assignAd(slotKey as keyof AdPlacementSettings['slots'], e.target.value || null)}
                        className="w-full bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] rounded-xl px-4 py-2.5 text-sm font-semibold text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ff6b00] transition-colors"
                      >
                        <option value="">🔄 Auto-rotate all active ads</option>
                        {activeAds.map(ad => (
                          <option key={ad.id} value={ad.id}>📢 {ad.name}</option>
                        ))}
                        {activeAds.length === 0 && (
                          <option disabled>No active ads available</option>
                        )}
                      </select>
                      {assignedAd && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-[#5a4136] dark:text-[#ffb693]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          Showing: <strong className="text-[#ff6b00]">{assignedAd.name}</strong>
                        </div>
                      )}
                      {!slot.adId && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-[#5a4136] dark:text-[#ffb693]">
                          <RefreshCw className="w-3.5 h-3.5 text-[#ff6b00]" />
                          Rotating through all <strong className="text-[#ff6b00]">{activeAds.length}</strong> active ads
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active Ads Quick List */}
          <section className="bg-white dark:bg-[#261812] rounded-2xl border border-[#e2bfb0] dark:border-[#5a4136] p-6 shadow-sm">
            <h3 className="text-sm font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6] mb-4 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#ff6b00]" />
              Active Ads in Rotation ({activeAds.length})
            </h3>
            {activeAds.length === 0 ? (
              <div className="text-center py-8 text-sm text-[#5a4136] dark:text-[#ffb693]">
                No active ads. Create ads in the <strong>Advertisements</strong> section.
              </div>
            ) : (
              <div className="space-y-2">
                {activeAds.map(ad => (
                  <div key={ad.id} className="flex items-center justify-between p-3 bg-[#fff8f6] dark:bg-[#1a120e] rounded-xl border border-[#e2bfb0]/50 dark:border-[#5a4136]/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#ff6b00]/10 flex items-center justify-center text-[#ff6b00]">
                        <Megaphone className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-[#261812] dark:text-[#ffede6]">{ad.name}</span>
                    </div>
                    <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Right: Live Preview ── */}
        <div className="xl:col-span-4 sticky top-[88px] space-y-5">
          {/* Save reminder */}
          <div className="flex items-center gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl text-xs text-amber-700 dark:text-amber-300 font-semibold">
            <Info className="w-4 h-4 shrink-0" />
            Changes are pending. Click "Save All Settings" to apply live.
          </div>

          {/* Feed Simulation */}
          <div className="bg-white dark:bg-[#261812] rounded-2xl border border-[#e2bfb0] dark:border-[#5a4136] p-5 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-[#261812] dark:text-[#ffede6] uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-[#ff6b00]" /> Event Hub Preview
              </h3>
              <span className="bg-[#ff6b00] text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Live Sim</span>
            </div>

            <div className="space-y-2 bg-[#fff8f6] dark:bg-[#1a120e] p-3 rounded-xl border border-[#e2bfb0]/40 dark:border-[#5a4136]/40 max-h-[440px] overflow-y-auto">
              {Array.from({ length: previewInterval * 2 + 2 }).map((_, i) => {
                const isAd = (i + 1) % (previewInterval + 1) === 0;
                return isAd ? (
                  <div key={i} className="bg-[#ff6b00]/10 dark:bg-[#ff6b00]/15 border border-[#ff6b00]/35 rounded-lg p-3 text-center">
                    <div className="text-[9px] text-[#ff6b00] font-black tracking-widest uppercase mb-1">📢 Sponsored Ad</div>
                    <div className="h-2 bg-[#ff6b00]/20 rounded w-3/4 mx-auto" />
                  </div>
                ) : (
                  <div key={i} className="bg-white dark:bg-[#261812] rounded-lg border border-[#e2bfb0]/50 dark:border-[#5a4136]/50 p-2.5 flex gap-3 items-center">
                    <div className="w-10 h-10 bg-[#fee3d8] dark:bg-[#3d2d26] rounded-lg flex-shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-2.5 bg-[#e2bfb0]/80 dark:bg-[#5a4136]/80 rounded w-3/4" />
                      <div className="h-2 bg-[#e2bfb0]/40 dark:bg-[#5a4136]/40 rounded w-1/2" />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-center text-[#5a4136] dark:text-[#ffb693] mt-3">
              Ad after every <strong className="text-[#ff6b00]">{previewInterval}</strong> event cards
            </p>
          </div>

          {/* Homepage layout diagram */}
          <div className="bg-white dark:bg-[#261812] rounded-2xl border border-[#e2bfb0] dark:border-[#5a4136] p-5 shadow-sm">
            <h3 className="text-xs font-black text-[#261812] dark:text-[#ffede6] uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#ff6b00]" /> Homepage Ad Map
            </h3>
            <div className="space-y-1.5">
              {[
                { label: '🎠 Hero Carousel', isAd: false },
                { label: '📢 Below Hero Ad', slotKey: 'hero_below' },
                { label: '⚡ Happening Today', isAd: false },
                { label: '📢 Below Today Ad', slotKey: 'happening_today_below' },
                { label: '🎛️ Category Filters', isAd: false },
                { label: '🗂️ Event Hub Grid\n(+ inline ads every N cards)', isAd: false, isGrid: true },
                { label: '📢 Between Sections Ad', slotKey: 'between_hub_past' },
                { label: '📋 Past Events', isAd: false },
              ].map((row, i) => {
                const isSlot = 'slotKey' in row;
                const enabled = isSlot ? settings.slots[row.slotKey as keyof AdPlacementSettings['slots']]?.enabled : false;
                return (
                  <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${
                    isSlot
                      ? enabled
                        ? 'bg-[#ff6b00]/10 border border-[#ff6b00]/30 text-[#ff6b00]'
                        : 'bg-[#f5f0ee] dark:bg-[#1a120e] border border-[#e2bfb0]/40 dark:border-[#5a4136]/40 text-[#b09080] dark:text-[#5a4136] line-through'
                      : 'bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0]/30 dark:border-[#5a4136]/30 text-[#5a4136] dark:text-[#ffb693]'
                  }`}>
                    <span className="whitespace-pre-line leading-tight">{row.label}</span>
                    {isSlot && (
                      <span className={`ml-auto text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${enabled ? 'bg-[#ff6b00] text-white' : 'bg-gray-200 dark:bg-[#3d2d26] text-gray-500'}`}>
                        {enabled ? 'ON' : 'OFF'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
