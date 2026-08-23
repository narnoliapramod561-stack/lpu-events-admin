import React, { useState, useEffect, useCallback } from 'react';
import { lpuClient } from '../../supabase';
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
  Columns3
} from 'lucide-react';

export const AdControlPanel: React.FC = () => {
  const [config, setConfig] = useState<AdSystemConfig>(DEFAULT_AD_SYSTEM_CONFIG);
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
      const { data: dbSettings } = await lpuClient.fetchGlobalSettings();
      if (dbSettings) {
        const adSysSetting = dbSettings.find((s: any) => s.key === 'ad_system_config');
        if (adSysSetting) {
          try {
            const parsed = typeof adSysSetting.value === 'string'
              ? JSON.parse(adSysSetting.value)
              : adSysSetting.value;
            setConfig({
              ...DEFAULT_AD_SYSTEM_CONFIG,
              ...parsed,
              adsense: { ...DEFAULT_AD_SYSTEM_CONFIG.adsense, ...(parsed.adsense || {}) },
              placements: { ...DEFAULT_AD_SYSTEM_CONFIG.placements, ...(parsed.placements || {}) },
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
      await lpuClient.manageGlobalSetting('upsert', {
        key: 'ad_system_config',
        value: config,
        description: 'Configurable multi-provider advertisement system configuration',
      });

      // Maintain legacy keys in sync for backward compatibility if any legacy consumer reads them
      await lpuClient.manageGlobalSetting('upsert', {
        key: 'ad_placement_interval',
        value: config.placements.event_hub.frequency,
        description: 'Event Hub ad frequency interval',
      });

      showToast('success', 'Advertisement system configuration saved successfully!');
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

    sampleItems.forEach((item, idx) => {
      simulatedSequence.push({ type: 'item', label: item });
      if ((idx + 1) % freq === 0 && adsInjected < maxAds) {
        simulatedSequence.push({
          type: 'ad',
          label: activePlacementConfig.provider === 'adsense' ? 'Google AdSense Ad' : 'Direct Sponsor Ad',
          provider: activePlacementConfig.provider,
        });
        adsInjected++;
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
            <h1 className="text-2xl sm:text-3xl font-black font-['Outfit'] text-[#261812] dark:text-[#ffede6] tracking-tight">
              Advertisement Settings
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#5a4136] dark:text-[#ffb693] mt-1 font-medium">
            Configure advertisement providers (Google AdSense vs. Direct Sponsors), insertion frequencies, and limits across Student Website placements.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={loadSettings}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold transition-colors cursor-pointer"
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

      {/* Global Master Controls */}
      <div className="p-6 rounded-3xl bg-white/70 dark:bg-[#201510]/70 border border-[#e2bfb0]/70 dark:border-[#5a4136]/70 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-[#e2bfb0]/30 dark:border-[#5a4136]/30">
          <Globe className="w-5 h-5 text-[#fc721e]" />
          <h2 className="text-base sm:text-lg font-black font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
            Global Advertisement System Controls
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Master Switch */}
          <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-[#e2bfb0]/40 dark:border-[#5a4136]/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-[#261812] dark:text-[#ffede6]">
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
              <p className="text-[11px] text-[#5a4136] dark:text-[#ffb693] mt-1.5 leading-relaxed">
                Globally enable or pause all advertisement units across the entire Student Website with a single toggle.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, global_enabled: !prev.global_enabled }))}
              className={`mt-4 w-full py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                config.global_enabled
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
              }`}
            >
              {config.global_enabled ? '✓ All Ads Enabled' : '✕ All Ads Paused'}
            </button>
          </div>

          {/* Global Max Ads Limit */}
          <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-[#e2bfb0]/40 dark:border-[#5a4136]/40 flex flex-col justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[#261812] dark:text-[#ffede6]">
                Max Ads Per Page Ceiling
              </span>
              <p className="text-[11px] text-[#5a4136] dark:text-[#ffb693] mt-1.5 leading-relaxed">
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
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-mono font-bold text-center"
              />
              <span className="text-xs text-[#5a4136] dark:text-[#ffb693] font-bold shrink-0">ads / page</span>
            </div>
          </div>

          {/* AdSense Publisher ID */}
          <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-[#e2bfb0]/40 dark:border-[#5a4136]/40 flex flex-col justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[#261812] dark:text-[#ffede6]">
                Google AdSense Publisher ID
              </span>
              <p className="text-[11px] text-[#5a4136] dark:text-[#ffb693] mt-1.5 leading-relaxed">
                Official Google AdSense Client ID (e.g. <code className="text-orange-600 font-mono">ca-pub-XXXXXXXXXXXX</code>).
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
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-mono font-bold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Placement Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 1. Hero Carousel Placement Card */}
        <div className="p-6 rounded-3xl bg-white/70 dark:bg-[#201510]/70 border border-[#e2bfb0]/70 dark:border-[#5a4136]/70 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#e2bfb0]/30 dark:border-[#5a4136]/30">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-500/15 text-[#fc721e]">
                <ImageIcon className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-black font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                  Hero Carousel Ads
                </h3>
                <span className="text-[10px] text-[#5a4136] dark:text-[#ffb693]">Top billboard showcase</span>
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
              <label className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">
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
                        ? 'bg-orange-500/15 border-[#fc721e] text-[#fc721e] shadow-xs'
                        : 'border-[#e2bfb0]/40 dark:border-[#5a4136]/40 hover:bg-black/5 dark:hover:bg-white/5'
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
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693]">
                  Insert after every:
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={config.placements.hero_carousel.frequency}
                    onChange={(e) => updatePlacement('hero_carousel', { frequency: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-mono font-bold text-center"
                  />
                  <span className="text-xs text-[#5a4136] dark:text-[#ffb693] shrink-0 font-medium">slides</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693]">
                  Maximum ads:
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={config.placements.hero_carousel.max_ads}
                    onChange={(e) => updatePlacement('hero_carousel', { max_ads: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-mono font-bold text-center"
                  />
                  <span className="text-xs text-[#5a4136] dark:text-[#ffb693] shrink-0 font-medium">max</span>
                </div>
              </div>
            </div>

            {/* AdSense Slot ID */}
            {config.placements.hero_carousel.provider === 'adsense' && (
              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693]">
                  AdSense Slot ID (Optional)
                </label>
                <input
                  type="text"
                  value={config.placements.hero_carousel.ad_unit_id || ''}
                  placeholder="1000000001"
                  onChange={(e) => updatePlacement('hero_carousel', { ad_unit_id: e.target.value.trim() })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-mono"
                />
              </div>
            )}
          </div>
        </div>

        {/* 2. Happening Today Placement Card */}
        <div className="p-6 rounded-3xl bg-white/70 dark:bg-[#201510]/70 border border-[#e2bfb0]/70 dark:border-[#5a4136]/70 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#e2bfb0]/30 dark:border-[#5a4136]/30">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-500/15 text-[#fc721e]">
                <CalendarDays className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-black font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                  Happening Today Ads
                </h3>
                <span className="text-[10px] text-[#5a4136] dark:text-[#ffb693]">Live daily schedule slider</span>
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
              <label className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">
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
                        ? 'bg-orange-500/15 border-[#fc721e] text-[#fc721e] shadow-xs'
                        : 'border-[#e2bfb0]/40 dark:border-[#5a4136]/40 hover:bg-black/5 dark:hover:bg-white/5'
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
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693]">
                  Insert after every:
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={config.placements.happening_today.frequency}
                    onChange={(e) => updatePlacement('happening_today', { frequency: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-mono font-bold text-center"
                  />
                  <span className="text-xs text-[#5a4136] dark:text-[#ffb693] shrink-0 font-medium">events</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693]">
                  Maximum ads:
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={config.placements.happening_today.max_ads}
                    onChange={(e) => updatePlacement('happening_today', { max_ads: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-mono font-bold text-center"
                  />
                  <span className="text-xs text-[#5a4136] dark:text-[#ffb693] shrink-0 font-medium">max</span>
                </div>
              </div>
            </div>

            {/* AdSense Slot ID */}
            {config.placements.happening_today.provider === 'adsense' && (
              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693]">
                  AdSense Slot ID (Optional)
                </label>
                <input
                  type="text"
                  value={config.placements.happening_today.ad_unit_id || ''}
                  placeholder="1000000002"
                  onChange={(e) => updatePlacement('happening_today', { ad_unit_id: e.target.value.trim() })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-mono"
                />
              </div>
            )}
          </div>
        </div>

        {/* 3. Event Hub Grid Placement Card */}
        <div className="p-6 rounded-3xl bg-white/70 dark:bg-[#201510]/70 border border-[#e2bfb0]/70 dark:border-[#5a4136]/70 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#e2bfb0]/30 dark:border-[#5a4136]/30">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-500/15 text-[#fc721e]">
                <LayoutGrid className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-black font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                  Event Hub Grid Ads
                </h3>
                <span className="text-[10px] text-[#5a4136] dark:text-[#ffb693]">In-feed responsive grid items</span>
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
              <label className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">
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
                        ? 'bg-orange-500/15 border-[#fc721e] text-[#fc721e] shadow-xs'
                        : 'border-[#e2bfb0]/40 dark:border-[#5a4136]/40 hover:bg-black/5 dark:hover:bg-white/5'
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
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693]">
                  Insert after every:
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={config.placements.event_hub.frequency}
                    onChange={(e) => updatePlacement('event_hub', { frequency: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-mono font-bold text-center"
                  />
                  <span className="text-xs text-[#5a4136] dark:text-[#ffb693] shrink-0 font-medium">events</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693]">
                  Maximum ads:
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={config.placements.event_hub.max_ads}
                    onChange={(e) => updatePlacement('event_hub', { max_ads: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-mono font-bold text-center"
                  />
                  <span className="text-xs text-[#5a4136] dark:text-[#ffb693] shrink-0 font-medium">max</span>
                </div>
              </div>
            </div>

            {/* AdSense Slot ID */}
            {config.placements.event_hub.provider === 'adsense' && (
              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693]">
                  AdSense Slot ID (Optional)
                </label>
                <input
                  type="text"
                  value={config.placements.event_hub.ad_unit_id || ''}
                  placeholder="1000000003"
                  onChange={(e) => updatePlacement('event_hub', { ad_unit_id: e.target.value.trim() })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-mono"
                />
              </div>
            )}
          </div>
        </div>

        {/* 4. Event Details Placement Card */}
        <div className="p-6 rounded-3xl bg-white/70 dark:bg-[#201510]/70 border border-[#e2bfb0]/70 dark:border-[#5a4136]/70 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#e2bfb0]/30 dark:border-[#5a4136]/30">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-orange-500/15 text-[#fc721e]">
                <Columns3 className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-black font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                  Event Details Page Ads
                </h3>
                <span className="text-[10px] text-[#5a4136] dark:text-[#ffb693]">Spotlight banner positions</span>
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
              <label className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">
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
                        ? 'bg-orange-500/15 border-[#fc721e] text-[#fc721e] shadow-xs'
                        : 'border-[#e2bfb0]/40 dark:border-[#5a4136]/40 hover:bg-black/5 dark:hover:bg-white/5'
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
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693]">
                  Maximum ads:
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={config.placements.event_details.max_ads}
                    onChange={(e) => updatePlacement('event_details', { max_ads: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-mono font-bold text-center"
                  />
                  <span className="text-xs text-[#5a4136] dark:text-[#ffb693] shrink-0 font-medium">max</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693]">
                  AdSense Slot ID
                </label>
                <input
                  type="text"
                  value={config.placements.event_details.ad_unit_id || ''}
                  placeholder="1000000004"
                  onChange={(e) => updatePlacement('event_details', { ad_unit_id: e.target.value.trim() })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Live Sequence Simulator */}
      <div className="p-6 rounded-3xl bg-white/70 dark:bg-[#201510]/70 border border-[#e2bfb0]/70 dark:border-[#5a4136]/70 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e2bfb0]/30 dark:border-[#5a4136]/30">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#fc721e]" />
            <h3 className="text-base font-black font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
              Live Presentation Sequence Simulator
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
                    : 'bg-black/5 dark:bg-white/5 hover:bg-black/10'
                }`}
              >
                {p.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.02] border border-[#e2bfb0]/40 dark:border-[#5a4136]/40">
          <div className="text-[11px] text-[#5a4136] dark:text-[#ffb693] font-bold mb-3 flex items-center gap-1.5">
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
                      ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/40 shadow-indigo-500/10'
                      : 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/40 shadow-purple-500/10'
                    : 'bg-white dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] border-[#e2bfb0]/60 dark:border-[#5a4136]/60'
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
