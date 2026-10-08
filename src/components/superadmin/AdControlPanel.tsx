import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { lpuClient, supabase } from '../../supabase';
import { getEventImage } from '../../utils/images';
import {
  AdSystemConfig,
  DEFAULT_AD_SYSTEM_CONFIG,
  AdProviderMode,
  AdPlacementConfig
} from '@lpu-events/shared';
import {
  Megaphone,
  Save,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
  LayoutGrid,
  CalendarDays,
  Image as ImageIcon,
  Columns3,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ListOrdered,
  CheckSquare,
  Square
} from 'lucide-react';

interface PlacementAdSelectorProps {
  placementKey: keyof AdSystemConfig['placements'];
  placementName: string;
  selectedAdIds?: string[];
  allAds: any[];
  onChange: (newIds?: string[]) => void;
}

const PlacementAdSelector: React.FC<PlacementAdSelectorProps> = ({
  placementName,
  selectedAdIds,
  allAds,
  onChange,
}) => {
  const isAutoMode = selectedAdIds === undefined;

  const handleToggle = (adId: string) => {
    const current = selectedAdIds !== undefined ? selectedAdIds : allAds.filter(a => a.status === 'active').map(a => a.id);
    if (current.includes(adId)) {
      onChange(current.filter(id => id !== adId));
    } else {
      onChange([...current, adId]);
    }
  };

  const handleMoveUp = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedAdIds || idx <= 0) return;
    const next = [...selectedAdIds];
    const temp = next[idx - 1];
    next[idx - 1] = next[idx];
    next[idx] = temp;
    onChange(next);
  };

  const handleMoveDown = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedAdIds || idx >= selectedAdIds.length - 1) return;
    const next = [...selectedAdIds];
    const temp = next[idx + 1];
    next[idx + 1] = next[idx];
    next[idx] = temp;
    onChange(next);
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange(allAds.map(a => a.id));
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange([]);
  };

  const handleResetToAuto = (e: React.MouseEvent) => {
    e.preventDefault();
    onChange(undefined);
  };

  const handleCustomize = (e: React.MouseEvent) => {
    e.preventDefault();
    const active = allAds.filter(a => a.status === 'active').map(a => a.id);
    onChange(active.length > 0 ? active : allAds.map(a => a.id));
  };

  // Build sorted view of ads:
  // If selectedAdIds is defined, show selected ads in their exact specified order first,
  // followed by unselected ads.
  const displayItems = useMemo(() => {
    if (isAutoMode) {
      return allAds.map(ad => ({
        ad,
        isSelected: ad.status === 'active',
        orderIndex: -1,
      }));
    }

    const selectedList: { ad: any; isSelected: boolean; orderIndex: number }[] = [];
    selectedAdIds.forEach((id, idx) => {
      const found = allAds.find(a => a.id === id);
      if (found) {
        selectedList.push({ ad: found, isSelected: true, orderIndex: idx });
      }
    });

    const unselectedList: { ad: any; isSelected: boolean; orderIndex: number }[] = [];
    allAds.forEach(ad => {
      if (!selectedAdIds.includes(ad.id)) {
        unselectedList.push({ ad, isSelected: false, orderIndex: -1 });
      }
    });

    return [...selectedList, ...unselectedList];
  }, [allAds, selectedAdIds, isAutoMode]);

  return (
    <div className="pt-3 border-t border-[#e2bfb0]/30 dark:border-white/10 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-black text-[#5a4136] dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
          <ListOrdered className="w-3.5 h-3.5 text-[#fc721e]" />
          <span>{placementName} Ads Selection & Order</span>
        </label>

        {isAutoMode ? (
          <button
            type="button"
            onClick={handleCustomize}
            className="text-[10px] font-black text-[#fc721e] hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>Customize Order</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-[#fc721e] hover:underline cursor-pointer"
            >
              All
            </button>
            <span className="text-gray-400">•</span>
            <button
              type="button"
              onClick={handleClear}
              className="text-rose-500 hover:underline cursor-pointer"
            >
              None
            </button>
            <span className="text-gray-400">•</span>
            <button
              type="button"
              onClick={handleResetToAuto}
              className="text-[#5a4136] dark:text-zinc-400 hover:underline cursor-pointer"
            >
              Auto
            </button>
          </div>
        )}
      </div>

      {allAds.length === 0 ? (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
          No advertisements created yet. Add ads in the Advertisements section first.
        </div>
      ) : isAutoMode ? (
        <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-[#e2bfb0]/40 dark:border-white/10 flex items-center justify-between gap-3 text-xs">
          <div>
            <p className="font-black text-[11px] text-[#261812] dark:text-white">
              Auto-Rotating All Active Ads ({allAds.filter(a => a.status === 'active').length})
            </p>
            <p className="text-[10px] text-[#5a4136] dark:text-zinc-400">
              Default order by creation date. Click Customize to choose and order specific ads.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCustomize}
            className="px-2.5 py-1 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-[#fc721e] text-[11px] font-black border border-orange-500/30 shrink-0 cursor-pointer"
          >
            Customize
          </button>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
          {displayItems.map(({ ad, isSelected, orderIndex }) => {
            const imgUrl = getEventImage(ad, 'advertisement', 120);
            return (
              <div
                key={ad.id}
                onClick={() => handleToggle(ad.id)}
                className={`p-2 rounded-xl border flex items-center justify-between gap-2.5 text-xs transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-orange-500/10 border-[#fc721e]/60 shadow-xs'
                    : 'bg-black/[0.01] dark:bg-white/[0.02] border-[#e2bfb0]/30 dark:border-white/10 opacity-60 hover:opacity-100'
                }`}
              >
                {/* Left: Checkbox + Order badge + Thumbnail + Name */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="shrink-0 text-[#fc721e]">
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 fill-orange-500/20" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                  </div>

                  {isSelected ? (
                    <span className="shrink-0 w-5 h-5 rounded-full bg-[#fc721e] text-white font-black text-[10px] flex items-center justify-center font-mono shadow-xs">
                      {orderIndex + 1}
                    </span>
                  ) : (
                    <span className="shrink-0 w-5 h-5 rounded-full bg-gray-200 dark:bg-zinc-800 text-gray-400 font-bold text-[10px] flex items-center justify-center">
                      -
                    </span>
                  )}

                  <div className="w-7 h-7 rounded-lg bg-slate-800 shrink-0 overflow-hidden border border-black/10 flex items-center justify-center">
                    {imgUrl ? (
                      <img src={imgUrl} alt={ad.name} className="w-full h-full object-cover" />
                    ) : (
                      <Megaphone className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-black text-[11px] text-[#261812] dark:text-white truncate">
                      {ad.name}
                    </p>
                    <span className={`text-[9px] font-bold uppercase ${
                      ad.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'
                    }`}>
                      {ad.status}
                    </span>
                  </div>
                </div>

                {/* Right: Order Movement Controls */}
                {isSelected && (
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={orderIndex <= 0}
                      onClick={(e) => handleMoveUp(orderIndex, e)}
                      title="Move earlier in sequence"
                      className="p-1 rounded-md bg-black/5 dark:bg-white/5 hover:bg-orange-500/20 hover:text-[#fc721e] disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={orderIndex >= (selectedAdIds?.length || 0) - 1}
                      onClick={(e) => handleMoveDown(orderIndex, e)}
                      title="Move later in sequence"
                      className="p-1 rounded-md bg-black/5 dark:bg-white/5 hover:bg-orange-500/20 hover:text-[#fc721e] disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const AdControlPanel: React.FC = () => {
  const [config, setConfig] = useState<AdSystemConfig>(DEFAULT_AD_SYSTEM_CONFIG);
  const [allAds, setAllAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [previewPlacement, setPreviewPlacement] = useState<'hero_carousel' | 'happening_today' | 'event_hub' | 'event_details'>('hero_carousel');

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load settings from Supabase ──
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      // Load all advertisements for placement selectors
      try {
        const { data: adsData } = await supabase
          .from('advertisements')
          .select('id, name, media_id, redirect_url, status, media_assets:media_id(id, object_key)')
          .order('created_at', { ascending: false });
        if (adsData) setAllAds(adsData);
      } catch (adErr) {
        console.warn('Failed to load advertisements:', adErr);
      }

      const { data: dbSettings } = await lpuClient.fetchGlobalSettings();
      if (dbSettings) {
        const adSysSetting = dbSettings.find((s: any) => s.key === 'ad_system_config');
        if (adSysSetting) {
          try {
            const parsed = typeof adSysSetting.value === 'string'
              ? JSON.parse(adSysSetting.value)
              : adSysSetting.value;

            const sanitizePublisherId = (pub?: string) => (!pub || pub === 'ca-pub-0000000000000000') ? 'ca-pub-5513043165999517' : pub;
            const sanitizeSlotId = (slot?: string) => (!slot || slot.startsWith('100000000')) ? '8059587837' : slot;

            setConfig({
              ...DEFAULT_AD_SYSTEM_CONFIG,
              ...parsed,
              adsense: {
                ...DEFAULT_AD_SYSTEM_CONFIG.adsense,
                ...(parsed.adsense || {}),
                publisher_id: sanitizePublisherId(parsed.adsense?.publisher_id),
              },
              placements: {
                ...DEFAULT_AD_SYSTEM_CONFIG.placements,
                ...(parsed.placements || {}),
                hero_carousel: {
                  ...DEFAULT_AD_SYSTEM_CONFIG.placements.hero_carousel,
                  ...(parsed.placements?.hero_carousel || {}),
                  ad_unit_id: sanitizeSlotId(parsed.placements?.hero_carousel?.ad_unit_id),
                  selected_ad_ids: parsed.placements?.hero_carousel?.selected_ad_ids,
                },
                happening_today: {
                  ...DEFAULT_AD_SYSTEM_CONFIG.placements.happening_today,
                  ...(parsed.placements?.happening_today || {}),
                  ad_unit_id: sanitizeSlotId(parsed.placements?.happening_today?.ad_unit_id),
                  selected_ad_ids: parsed.placements?.happening_today?.selected_ad_ids,
                },
                event_hub: {
                  ...DEFAULT_AD_SYSTEM_CONFIG.placements.event_hub,
                  ...(parsed.placements?.event_hub || {}),
                  ad_unit_id: sanitizeSlotId(parsed.placements?.event_hub?.ad_unit_id),
                  selected_ad_ids: parsed.placements?.event_hub?.selected_ad_ids,
                },
                event_details: {
                  ...DEFAULT_AD_SYSTEM_CONFIG.placements.event_details,
                  ...(parsed.placements?.event_details || {}),
                  ad_unit_id: sanitizeSlotId(parsed.placements?.event_details?.ad_unit_id),
                  selected_ad_ids: parsed.placements?.event_details?.selected_ad_ids,
                },
              },
            });
          } catch (e) {
            console.error('Failed to parse ad_system_config:', e);
          }
        }
      }
    } catch (err) {
      console.error('Ad Control load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ── Save configuration ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const sanitizedPublisherId = (!config.adsense.publisher_id || config.adsense.publisher_id === 'ca-pub-0000000000000000')
        ? 'ca-pub-5513043165999517'
        : config.adsense.publisher_id;

      const savePayload: AdSystemConfig = {
        ...config,
        adsense: {
          ...config.adsense,
          publisher_id: sanitizedPublisherId,
        }
      };

      const saveRes = await lpuClient.manageGlobalSetting('upsert', {
        key: 'ad_system_config',
        value: savePayload,
        description: 'Configurable multi-provider advertisement system configuration',
      });

      if (saveRes?.error) {
        throw new Error(saveRes.error.message || saveRes.error.details || 'Failed to save configuration to database.');
      }

      // Maintain legacy keys in sync for backward compatibility if any legacy consumer reads them
      await lpuClient.manageGlobalSetting('upsert', {
        key: 'ad_placement_interval',
        value: config.placements.event_hub.frequency,
        description: 'Event Hub ad frequency interval',
      });

      showToast('success', 'Advertisement system configuration saved & synced live!');
    } catch (err: any) {
      showToast('error', 'Save failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  // Helper to update specific placement
  const updatePlacement = (
    key: keyof AdSystemConfig['placements'],
    updates: Partial<AdPlacementConfig>
  ) => {
    setConfig(prev => ({
      ...prev,
      placements: {
        ...prev.placements,
        [key]: {
          ...prev.placements[key],
          ...updates,
        },
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-[#5a4136] dark:text-[#ffb693]">
          <Loader2 className="w-8 h-8 animate-spin text-[#fc721e]" />
          <p className="text-sm font-medium">Loading Advertisement Controls...</p>
        </div>
      </div>
    );
  }

  // Simulation preview generator
  const activePlacementConfig = config.placements[previewPlacement];
  const sampleItems = Array.from({ length: 6 }, (_, i) => `Event ${i + 1}`);
  const simulatedSequence: { type: 'item' | 'ad'; label: string; provider?: string }[] = [];
  let adsInjected = 0;

  if (config.global_enabled && activePlacementConfig.enabled && activePlacementConfig.provider !== 'disabled') {
    const freq = Math.max(1, activePlacementConfig.frequency);
    const maxAds = Math.min(activePlacementConfig.max_ads, config.max_ads_per_page);

    let effectiveAdLabels: string[] = [];
    if (activePlacementConfig.provider === 'direct') {
      if (activePlacementConfig.selected_ad_ids && activePlacementConfig.selected_ad_ids.length > 0) {
        effectiveAdLabels = activePlacementConfig.selected_ad_ids
          .map(id => allAds.find(a => a.id === id)?.name)
          .filter(Boolean) as string[];
      } else if (activePlacementConfig.selected_ad_ids && activePlacementConfig.selected_ad_ids.length === 0) {
        effectiveAdLabels = [];
      } else {
        effectiveAdLabels = allAds.filter(a => a.status === 'active').map(a => a.name);
      }
    }

    sampleItems.forEach((item, idx) => {
      simulatedSequence.push({ type: 'item', label: item });
      if ((idx + 1) % freq === 0 && adsInjected < maxAds) {
        if (activePlacementConfig.provider === 'adsense') {
          simulatedSequence.push({
            type: 'ad',
            label: 'Google AdSense Ad',
            provider: 'adsense',
          });
          adsInjected++;
        } else if (activePlacementConfig.provider === 'direct') {
          if (effectiveAdLabels.length > 0) {
            const adName = effectiveAdLabels[adsInjected % effectiveAdLabels.length];
            simulatedSequence.push({
              type: 'ad',
              label: `Ad: "${adName}"`,
              provider: 'direct',
            });
            adsInjected++;
          }
        }
      }
    });
  } else {
    sampleItems.forEach((item) => simulatedSequence.push({ type: 'item', label: item }));
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in font-['Inter']">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-bold transition-all animate-in slide-in-from-bottom-3 ${
          toast.type === 'success'
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/30'
            : 'bg-rose-950/90 text-rose-200 border-rose-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-rose-400" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#e2bfb0]/40 dark:border-[#5a4136]/40">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-orange-500/15 text-[#fc721e] border border-orange-500/20">
              <Megaphone className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black font-['Outfit'] text-[#261812] dark:text-white tracking-tight">
              Advertisement Settings
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#5a4136] dark:text-zinc-400 mt-1 font-medium">
            Configure advertisement providers (Google AdSense vs. Direct Sponsors), insertion frequencies, and limits across Student Website placements.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={loadSettings}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 text-xs font-bold text-[#5a4136] dark:text-zinc-200 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#fc721e] to-[#ff8c42] hover:brightness-105 text-white text-xs sm:text-sm font-black shadow-lg shadow-orange-500/20 transition-all active:scale-97 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {/* Quick Mode Presets Bar */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#202023] border border-[#e2bfb0] dark:border-white/10 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black font-['Outfit'] text-[#261812] dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#fc721e]" />
              <span>One-Click Advertisement Mode Switcher</span>
            </h3>
            <p className="text-[11px] text-[#5a4136] dark:text-zinc-400">
              Instantly toggle between Google AdSense, Direct Self Ads, or completely pause all advertising across the student site.
            </p>
          </div>
          <span className={`self-start sm:self-auto px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
            !config.global_enabled
              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
              : config.placements.event_hub.provider === 'adsense' && config.placements.hero_carousel.provider === 'adsense'
              ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30'
              : config.placements.event_hub.provider === 'direct' && config.placements.hero_carousel.provider === 'direct'
              ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30'
              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
          }`}>
            {!config.global_enabled
              ? '● System Paused (Zero Ads)'
              : config.placements.event_hub.provider === 'adsense' && config.placements.hero_carousel.provider === 'adsense'
              ? '● Active: Google AdSense'
              : config.placements.event_hub.provider === 'direct' && config.placements.hero_carousel.provider === 'direct'
              ? '● Active: Direct Self Ads'
              : '● Active: Hybrid Mode'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              setConfig(prev => ({
                ...prev,
                global_enabled: true,
                placements: {
                  hero_carousel: { ...prev.placements.hero_carousel, enabled: true, provider: 'adsense' },
                  happening_today: { ...prev.placements.happening_today, enabled: true, provider: 'adsense' },
                  event_hub: { ...prev.placements.event_hub, enabled: true, provider: 'adsense' },
                  event_details: { ...prev.placements.event_details, enabled: false, provider: 'adsense' },
                }
              }));
              showToast('success', 'Switched all placements to Google AdSense. Click "Save Configuration" to apply live.');
            }}
            className={`p-3 rounded-2xl border transition-all active:scale-97 cursor-pointer flex flex-col justify-between gap-1 shadow-xs ${
              config.global_enabled && config.placements.event_hub.provider === 'adsense' && config.placements.hero_carousel.provider === 'adsense'
                ? 'border-sky-500 bg-sky-500/20 text-sky-900 dark:text-sky-200 ring-2 ring-sky-500/40'
                : 'border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/15 text-sky-700 dark:text-sky-300'
            }`}
          >
            <span className="font-black text-[11px] uppercase tracking-wider">All Google AdSense</span>
            <span className="text-[10px] opacity-80">Programmatic Google revenue ads everywhere</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setConfig(prev => ({
                ...prev,
                global_enabled: true,
                placements: {
                  hero_carousel: { ...prev.placements.hero_carousel, enabled: true, provider: 'direct' },
                  happening_today: { ...prev.placements.happening_today, enabled: true, provider: 'direct' },
                  event_hub: { ...prev.placements.event_hub, enabled: true, provider: 'direct' },
                  event_details: { ...prev.placements.event_details, enabled: false, provider: 'direct' },
                }
              }));
              showToast('success', 'Switched all placements to Direct / Self Ads. Click "Save Configuration" to apply live.');
            }}
            className={`p-3 rounded-2xl border transition-all active:scale-97 cursor-pointer flex flex-col justify-between gap-1 shadow-xs ${
              config.global_enabled && config.placements.event_hub.provider === 'direct' && config.placements.hero_carousel.provider === 'direct'
                ? 'border-orange-500 bg-orange-500/20 text-orange-900 dark:text-orange-200 ring-2 ring-orange-500/40'
                : 'border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/15 text-orange-700 dark:text-orange-300'
            }`}
          >
            <span className="font-black text-[11px] uppercase tracking-wider">All Direct / Self Ads</span>
            <span className="text-[10px] opacity-80">University internal sponsors & campaigns</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setConfig(prev => ({
                ...prev,
                global_enabled: true,
                placements: {
                  hero_carousel: { ...prev.placements.hero_carousel, enabled: true, provider: 'direct' },
                  happening_today: { ...prev.placements.happening_today, enabled: true, provider: 'direct' },
                  event_hub: { ...prev.placements.event_hub, enabled: true, provider: 'adsense' },
                  event_details: { ...prev.placements.event_details, enabled: false, provider: 'disabled' },
                }
              }));
              showToast('success', 'Switched to Hybrid Mode. Click "Save Configuration" to apply live.');
            }}
            className={`p-3 rounded-2xl border transition-all active:scale-97 cursor-pointer flex flex-col justify-between gap-1 shadow-xs ${
              config.global_enabled && !(config.placements.event_hub.provider === 'adsense' && config.placements.hero_carousel.provider === 'adsense') && !(config.placements.event_hub.provider === 'direct' && config.placements.hero_carousel.provider === 'direct')
                ? 'border-amber-500 bg-amber-500/20 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/40'
                : 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 text-amber-700 dark:text-amber-300'
            }`}
          >
            <span className="font-black text-[11px] uppercase tracking-wider">Hybrid Mode</span>
            <span className="text-[10px] opacity-80">Direct hero banners + AdSense in feed</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setConfig(prev => ({ ...prev, global_enabled: false }));
              showToast('success', 'All advertisements paused. Click "Save Configuration" to apply live.');
            }}
            className={`p-3 rounded-2xl border transition-all active:scale-97 cursor-pointer flex flex-col justify-between gap-1 shadow-xs ${
              !config.global_enabled
                ? 'border-rose-500 bg-rose-500/20 text-rose-900 dark:text-rose-200 ring-2 ring-rose-500/40'
                : 'border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15 text-rose-700 dark:text-rose-300'
            }`}
          >
            <span className="font-black text-[11px] uppercase tracking-wider">Pause All Ads</span>
            <span className="text-[10px] opacity-80">Zero advertisements on entire website</span>
          </button>
        </div>
      </div>

      {/* Global Master Controls */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#202023] border border-[#e2bfb0] dark:border-white/10 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-[#e2bfb0]/30 dark:border-white/10">
          <Globe className="w-5 h-5 text-[#fc721e]" />
          <h2 className="text-base sm:text-lg font-black font-['Outfit'] text-[#261812] dark:text-white">
            Global Advertisement System Controls
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Master Switch */}
          <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-[#e2bfb0]/40 dark:border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-[#261812] dark:text-white">
                  Master System Switch
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  config.global_enabled
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                }`}>
                  {config.global_enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <p className="text-[11px] text-[#5a4136] dark:text-zinc-400 mt-1.5 leading-relaxed">
                Globally enable or pause all advertisement units across the entire Student Website with a single toggle.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, global_enabled: !prev.global_enabled }))}
              className={`mt-4 w-full py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                config.global_enabled
                  ? 'bg-[#fc721e] hover:bg-[#ff8533] text-white shadow-md shadow-orange-500/20'
                  : 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20'
              }`}
            >
              {config.global_enabled ? '✓ All Ads Enabled' : '✕ All Ads Paused'}
            </button>
          </div>

          {/* Global Max Ads Limit */}
          <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-[#e2bfb0]/40 dark:border-white/10 flex flex-col justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[#261812] dark:text-white">
                Max Ads Per Page Ceiling
              </span>
              <p className="text-[11px] text-[#5a4136] dark:text-zinc-400 mt-1.5 leading-relaxed">
                Maximum number of advertisements rendered in any single page view, preventing ad clutter on infinite scroll.
              </p>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="30"
                value={config.max_ads_per_page}
                onChange={(e) => setConfig(prev => ({ ...prev, max_ads_per_page: Math.max(1, Number(e.target.value) || 1) }))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#18181b] border border-[#e2bfb0] dark:border-white/10 text-xs font-mono font-bold text-center text-[#261812] dark:text-white"
              />
              <span className="text-xs text-[#5a4136] dark:text-zinc-300 font-bold shrink-0">ads / page</span>
            </div>
          </div>

          {/* AdSense Publisher ID */}
          <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-[#e2bfb0]/40 dark:border-white/10 flex flex-col justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[#261812] dark:text-white">
                Google AdSense Publisher ID
              </span>
              <p className="text-[11px] text-[#5a4136] dark:text-zinc-400 mt-1.5 leading-relaxed">
                Official Google AdSense Client ID (e.g. <code className="text-orange-500 font-mono">ca-pub-XXXXXXXXXXXX</code>).
              </p>
            </div>

            <div className="mt-4">
              <input
                type="text"
                value={config.adsense.publisher_id}
                placeholder="ca-pub-0000000000000000"
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  adsense: { ...prev.adsense, publisher_id: e.target.value.trim() }
                }))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#18181b] border border-[#e2bfb0] dark:border-white/10 text-xs font-mono font-bold text-[#261812] dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Placement Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 1. Hero Carousel Placement Card */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#202023] border border-[#e2bfb0] dark:border-white/10 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#e2bfb0]/30 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-500/15 text-[#fc721e]">
                <ImageIcon className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-black font-['Outfit'] text-[#261812] dark:text-white">
                  Hero Carousel Ads
                </h3>
                <span className="text-[10px] text-[#5a4136] dark:text-zinc-400">Top billboard showcase</span>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.placements.hero_carousel.enabled}
                onChange={(e) => updatePlacement('hero_carousel', { enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#fc721e]"></div>
            </label>
          </div>

          <div className="space-y-4">
            {/* Provider Selection */}
            <div>
              <label className="text-[11px] font-bold text-[#5a4136] dark:text-zinc-300 uppercase tracking-wider">
                Active Provider
              </label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {(['direct', 'adsense', 'disabled'] as AdProviderMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updatePlacement('hero_carousel', { provider: mode })}
                    className={`py-2 px-3 rounded-xl text-xs font-black capitalize transition-all cursor-pointer border ${
                      config.placements.hero_carousel.provider === mode
                        ? 'bg-orange-500/15 border-[#fc721e] text-[#fc721e] dark:text-orange-400 shadow-xs'
                        : 'border-[#e2bfb0]/40 dark:border-white/10 bg-black/[0.01] dark:bg-white/5 text-gray-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                  >
                    {mode === 'direct' ? 'My Ads' : mode === 'adsense' ? 'AdSense' : 'Disabled'}
                  </button>
                ))}
              </div>
            </div>

            {/* Frequency & Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-zinc-300">
                  Insert after every:
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={config.placements.hero_carousel.frequency}
                    onChange={(e) => updatePlacement('hero_carousel', { frequency: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#18181b] border border-[#e2bfb0] dark:border-white/10 text-xs font-mono font-bold text-center text-gray-900 dark:text-white"
                  />
                  <span className="text-xs text-[#5a4136] dark:text-zinc-400 shrink-0 font-medium">slides</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-zinc-300">
                  Maximum ads:
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={config.placements.hero_carousel.max_ads}
                    onChange={(e) => updatePlacement('hero_carousel', { max_ads: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#18181b] border border-[#e2bfb0] dark:border-white/10 text-xs font-mono font-bold text-center text-gray-900 dark:text-white"
                  />
                  <span className="text-xs text-[#5a4136] dark:text-zinc-400 shrink-0 font-medium">max</span>
                </div>
              </div>
            </div>

            {/* AdSense Slot ID */}
            {config.placements.hero_carousel.provider === 'adsense' && (
              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-zinc-300">
                  AdSense Slot ID (Optional)
                </label>
                <input
                  type="text"
                  value={config.placements.hero_carousel.ad_unit_id || ''}
                  placeholder="1000000001"
                  onChange={(e) => updatePlacement('hero_carousel', { ad_unit_id: e.target.value.trim() })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-white dark:bg-[#18181b] border border-[#e2bfb0] dark:border-white/10 text-xs font-mono text-gray-900 dark:text-white"
                />
              </div>
            )}

            {/* Direct Ads Selector & Ordering */}
            {config.placements.hero_carousel.provider === 'direct' && (
              <PlacementAdSelector
                placementKey="hero_carousel"
                placementName="Hero Carousel"
                selectedAdIds={config.placements.hero_carousel.selected_ad_ids}
                allAds={allAds}
                onChange={(ids) => updatePlacement('hero_carousel', { selected_ad_ids: ids })}
              />
            )}
          </div>
        </div>

        {/* 2. Happening Today Placement Card */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#202023] border border-[#e2bfb0] dark:border-white/10 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#e2bfb0]/30 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-500/15 text-[#fc721e]">
                <CalendarDays className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-black font-['Outfit'] text-[#261812] dark:text-white">
                  Happening Today Ads
                </h3>
                <span className="text-[10px] text-[#5a4136] dark:text-zinc-400">Live daily schedule slider</span>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.placements.happening_today.enabled}
                onChange={(e) => updatePlacement('happening_today', { enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#fc721e]"></div>
            </label>
          </div>

          <div className="space-y-4">
            {/* Provider Selection */}
            <div>
              <label className="text-[11px] font-bold text-[#5a4136] dark:text-zinc-300 uppercase tracking-wider">
                Active Provider
              </label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {(['direct', 'adsense', 'disabled'] as AdProviderMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updatePlacement('happening_today', { provider: mode })}
                    className={`py-2 px-3 rounded-xl text-xs font-black capitalize transition-all cursor-pointer border ${
                      config.placements.happening_today.provider === mode
                        ? 'bg-orange-500/15 border-[#fc721e] text-[#fc721e] dark:text-orange-400 shadow-xs'
                        : 'border-[#e2bfb0]/40 dark:border-white/10 bg-black/[0.01] dark:bg-white/5 text-gray-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                  >
                    {mode === 'direct' ? 'My Ads' : mode === 'adsense' ? 'AdSense' : 'Disabled'}
                  </button>
                ))}
              </div>
            </div>

            {/* Frequency & Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-zinc-300">
                  Insert after every:
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={config.placements.happening_today.frequency}
                    onChange={(e) => updatePlacement('happening_today', { frequency: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#18181b] border border-[#e2bfb0] dark:border-white/10 text-xs font-mono font-bold text-center text-gray-900 dark:text-white"
                  />
                  <span className="text-xs text-[#5a4136] dark:text-zinc-400 shrink-0 font-medium">events</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-zinc-300">
                  Maximum ads:
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={config.placements.happening_today.max_ads}
                    onChange={(e) => updatePlacement('happening_today', { max_ads: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#18181b] border border-[#e2bfb0] dark:border-white/10 text-xs font-mono font-bold text-center text-gray-900 dark:text-white"
                  />
                  <span className="text-xs text-[#5a4136] dark:text-zinc-400 shrink-0 font-medium">max</span>
                </div>
              </div>
            </div>

            {/* AdSense Slot ID */}
            {config.placements.happening_today.provider === 'adsense' && (
              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-zinc-300">
                  AdSense Slot ID (Optional)
                </label>
                <input
                  type="text"
                  value={config.placements.happening_today.ad_unit_id || ''}
                  placeholder="1000000002"
                  onChange={(e) => updatePlacement('happening_today', { ad_unit_id: e.target.value.trim() })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-white dark:bg-[#18181b] border border-[#e2bfb0] dark:border-white/10 text-xs font-mono text-gray-900 dark:text-white"
                />
              </div>
            )}

            {/* Direct Ads Selector & Ordering */}
            {config.placements.happening_today.provider === 'direct' && (
              <PlacementAdSelector
                placementKey="happening_today"
                placementName="Happening Today"
                selectedAdIds={config.placements.happening_today.selected_ad_ids}
                allAds={allAds}
                onChange={(ids) => updatePlacement('happening_today', { selected_ad_ids: ids })}
              />
            )}
          </div>
        </div>

        {/* 3. Event Hub Grid Placement Card */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#202023] border border-[#e2bfb0] dark:border-white/10 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#e2bfb0]/30 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-500/15 text-[#fc721e]">
                <LayoutGrid className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-black font-['Outfit'] text-[#261812] dark:text-white">
                  Event Hub Grid Ads
                </h3>
                <span className="text-[10px] text-[#5a4136] dark:text-zinc-400">In-feed responsive grid items</span>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.placements.event_hub.enabled}
                onChange={(e) => updatePlacement('event_hub', { enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#fc721e]"></div>
            </label>
          </div>

          <div className="space-y-4">
            {/* Provider Selection */}
            <div>
              <label className="text-[11px] font-bold text-[#5a4136] dark:text-zinc-300 uppercase tracking-wider">
                Active Provider
              </label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {(['direct', 'adsense', 'disabled'] as AdProviderMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updatePlacement('event_hub', { provider: mode })}
                    className={`py-2 px-3 rounded-xl text-xs font-black capitalize transition-all cursor-pointer border ${
                      config.placements.event_hub.provider === mode
                        ? 'bg-orange-500/15 border-[#fc721e] text-[#fc721e] dark:text-orange-400 shadow-xs'
                        : 'border-[#e2bfb0]/40 dark:border-white/10 bg-black/[0.01] dark:bg-white/5 text-gray-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                  >
                    {mode === 'direct' ? 'My Ads' : mode === 'adsense' ? 'AdSense' : 'Disabled'}
                  </button>
                ))}
              </div>
            </div>

            {/* Frequency & Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-zinc-300">
                  Insert after every:
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={config.placements.event_hub.frequency}
                    onChange={(e) => updatePlacement('event_hub', { frequency: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#18181b] border border-[#e2bfb0] dark:border-white/10 text-xs font-mono font-bold text-center text-gray-900 dark:text-white"
                  />
                  <span className="text-xs text-[#5a4136] dark:text-zinc-400 shrink-0 font-medium">events</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-zinc-300">
                  Maximum ads:
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={config.placements.event_hub.max_ads}
                    onChange={(e) => updatePlacement('event_hub', { max_ads: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#18181b] border border-[#e2bfb0] dark:border-white/10 text-xs font-mono font-bold text-center text-gray-900 dark:text-white"
                  />
                  <span className="text-xs text-[#5a4136] dark:text-zinc-400 shrink-0 font-medium">max</span>
                </div>
              </div>
            </div>

            {/* AdSense Slot ID */}
            {config.placements.event_hub.provider === 'adsense' && (
              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-zinc-300">
                  AdSense Slot ID (Optional)
                </label>
                <input
                  type="text"
                  value={config.placements.event_hub.ad_unit_id || ''}
                  placeholder="1000000003"
                  onChange={(e) => updatePlacement('event_hub', { ad_unit_id: e.target.value.trim() })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-white dark:bg-[#18181b] border border-[#e2bfb0] dark:border-white/10 text-xs font-mono text-gray-900 dark:text-white"
                />
              </div>
            )}

            {/* Direct Ads Selector & Ordering */}
            {config.placements.event_hub.provider === 'direct' && (
              <PlacementAdSelector
                placementKey="event_hub"
                placementName="Event Hub Grid"
                selectedAdIds={config.placements.event_hub.selected_ad_ids}
                allAds={allAds}
                onChange={(ids) => updatePlacement('event_hub', { selected_ad_ids: ids })}
              />
            )}
          </div>
        </div>

        {/* 4. Event Details Placement Card */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#202023] border border-[#e2bfb0] dark:border-white/10 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#e2bfb0]/30 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-500/15 text-[#fc721e]">
                <Columns3 className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-black font-['Outfit'] text-[#261812] dark:text-white">
                  Event Details Page Ads
                </h3>
                <span className="text-[10px] text-[#5a4136] dark:text-zinc-400">Spotlight banner positions</span>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.placements.event_details.enabled}
                onChange={(e) => updatePlacement('event_details', { enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#fc721e]"></div>
            </label>
          </div>

          <div className="space-y-4">
            {/* Provider Selection */}
            <div>
              <label className="text-[11px] font-bold text-[#5a4136] dark:text-zinc-300 uppercase tracking-wider">
                Active Provider
              </label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {(['direct', 'adsense', 'disabled'] as AdProviderMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updatePlacement('event_details', { provider: mode })}
                    className={`py-2 px-3 rounded-xl text-xs font-black capitalize transition-all cursor-pointer border ${
                      config.placements.event_details.provider === mode
                        ? 'bg-orange-500/15 border-[#fc721e] text-[#fc721e] dark:text-orange-400 shadow-xs'
                        : 'border-[#e2bfb0]/40 dark:border-white/10 bg-black/[0.01] dark:bg-white/5 text-gray-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                  >
                    {mode === 'direct' ? 'My Ads' : mode === 'adsense' ? 'AdSense' : 'Disabled'}
                  </button>
                ))}
              </div>
            </div>

            {/* Frequency & Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-zinc-300">
                  Maximum ads:
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={config.placements.event_details.max_ads}
                    onChange={(e) => updatePlacement('event_details', { max_ads: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#18181b] border border-[#e2bfb0] dark:border-white/10 text-xs font-mono font-bold text-center text-gray-900 dark:text-white"
                  />
                  <span className="text-xs text-[#5a4136] dark:text-zinc-400 shrink-0 font-medium">max</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-zinc-300">
                  AdSense Slot ID
                </label>
                <input
                  type="text"
                  value={config.placements.event_details.ad_unit_id || ''}
                  placeholder="1000000004"
                  onChange={(e) => updatePlacement('event_details', { ad_unit_id: e.target.value.trim() })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-white dark:bg-[#18181b] border border-[#e2bfb0] dark:border-white/10 text-xs font-mono text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Direct Ads Selector & Ordering */}
            {config.placements.event_details.provider === 'direct' && (
              <PlacementAdSelector
                placementKey="event_details"
                placementName="Event Details Page"
                selectedAdIds={config.placements.event_details.selected_ad_ids}
                allAds={allAds}
                onChange={(ids) => updatePlacement('event_details', { selected_ad_ids: ids })}
              />
            )}
          </div>
        </div>

      </div>

      {/* Ad Placement Sequence Preview */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#202023] border border-[#e2bfb0] dark:border-white/10 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e2bfb0]/30 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#fc721e]" />
            <h3 className="text-base font-black font-['Outfit'] text-[#261812] dark:text-white">
              Ad Placement Sequence Preview
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {(['hero_carousel', 'happening_today', 'event_hub'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreviewPlacement(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                  previewPlacement === p
                    ? 'bg-[#fc721e] text-white shadow-sm'
                    : 'bg-black/5 dark:bg-white/5 text-gray-700 dark:text-zinc-300 hover:bg-black/10 dark:hover:bg-white/10'
                }`}
              >
                {p.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-[#e2bfb0]/40 dark:border-white/10">
          <div className="text-[11px] text-[#5a4136] dark:text-zinc-300 font-bold mb-3 flex items-center gap-1.5">
            <span>Resulting stream for {previewPlacement.replace('_', ' ')}:</span>
            <span className="text-xs font-mono text-[#fc721e]">
              (Frequency: every {activePlacementConfig.frequency}, Max: {activePlacementConfig.max_ads}, Provider: {activePlacementConfig.provider})
            </span>
          </div>

          <div className="flex flex-wrap gap-2.5 items-center">
            {simulatedSequence.map((item, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-gray-400 text-xs">→</span>}
                <span className={`px-3.5 py-2 rounded-xl text-xs font-black tracking-wide border shadow-xs ${
                  item.type === 'ad'
                    ? item.provider === 'adsense'
                      ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 shadow-sky-500/10'
                      : 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30 shadow-orange-500/10'
                    : 'bg-white dark:bg-[#18181b] text-[#261812] dark:text-white border-[#e2bfb0]/60 dark:border-white/10'
                }`}>
                  {item.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
