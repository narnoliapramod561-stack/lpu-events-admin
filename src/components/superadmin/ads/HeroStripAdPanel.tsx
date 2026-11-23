import React, { useState, useEffect, useCallback } from 'react';
import { supabase, lpuClient } from '../../../supabase';
import type { AdPlacementSlot } from '../../../shared/ads/adTypes';
import { AdPositionSlotBox } from './AdPositionSlotBox';

export const HeroStripAdPanel: React.FC = () => {
  const [slot, setSlot] = useState<AdPlacementSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState<'DESKTOP' | 'MOBILE'>('DESKTOP');

  const fetchSlot = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ad_placement_slots')
        .select('*')
        .eq('placement', 'HOMEPAGE_HERO_STRIP')
        .eq('slot_key', 'primary')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSlot(data as AdPlacementSlot);
      } else {
        // Fallback default structure
        setSlot({
          id: '',
          placement: 'HOMEPAGE_HERO_STRIP',
          slot_key: 'primary',
          slot_order: 0,
          title: 'Homepage Ribbon Banner',
          sponsor_name: '',
          image_url: '',
          redirect_url: '',
          cta_text: 'Know More',
          badge_text: 'SPONSORED',
          display_duration_ms: 6000,
          is_active: false,
        });
      }
    } catch (err) {
      console.error('Failed to load hero strip slot:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlot();
  }, [fetchSlot]);

  const handleSaveSlot = async (updatedSlot: AdPlacementSlot) => {
    const payload = {
      placement: 'HOMEPAGE_HERO_STRIP',
      slot_key: 'primary',
      slot_order: 0,
      title: updatedSlot.title,
      sponsor_name: updatedSlot.sponsor_name,
      image_url: updatedSlot.image_url,
      mobile_image_url: updatedSlot.mobile_image_url || updatedSlot.image_url,
      media_id: updatedSlot.media_id,
      redirect_url: updatedSlot.redirect_url,
      cta_text: updatedSlot.cta_text,
      badge_text: updatedSlot.badge_text,
      display_duration_ms: 6000,
      is_active: updatedSlot.is_active,
    };

    const { data, error } = await supabase.rpc('save_ad_placement_slot', {
      p_slot: payload,
    });

    if (error) throw error;
    if (data && (data as any).status === 'error') {
      throw new Error((data as any).message || 'Failed to save hero strip slot.');
    }

    setSlot(data?.data as AdPlacementSlot);

    // Dispatch Edge Cache Invalidation for ads & homepage
    await lpuClient.dispatchEdgeInvalidation(['ads', 'homepage']).catch((err) => {
      console.warn('Edge invalidation notice:', err);
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Surface Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#1c1c1e] p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ff6b00] text-2xl">panorama_horizontal</span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Homepage Ribbon Ad Controller</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Directly upload and manage the 21:9 panoramic divider banner placed between the Hero Carousel and Happening Today sections.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-[#1c1c1e] border border-slate-200 dark:border-zinc-800 rounded-2xl">
          <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 dark:text-zinc-400 font-semibold">Loading placement box...</p>
        </div>
      ) : slot ? (
        <>
          {/* Main Direct-Upload Box */}
          <AdPositionSlotBox
            slot={slot}
            boxTitle="Primary Panoramic Ribbon Banner"
            badge="BOX 1 · HOMEPAGE STRIP"
            aspectRatioText="21:9 Panoramic (1920x350 recommended)"
            aspectRatioClass="aspect-[21/9]"
            minRatio={2.0}
            maxRatio={8.0}
            onSave={handleSaveSlot}
          />

          {/* Live Preview Section */}
          <div className="bg-white dark:bg-[#1c1c1e] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-500">visibility</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Live Student Website Simulation</h3>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPreviewMode('DESKTOP')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    previewMode === 'DESKTOP'
                      ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                  }`}
                >
                  Desktop (Wide)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('MOBILE')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    previewMode === 'MOBILE'
                      ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                  }`}
                >
                  Mobile (Compact)
                </button>
              </div>
            </div>

            {slot.image_url ? (
              <div className={`mx-auto transition-all ${previewMode === 'MOBILE' ? 'max-w-md' : 'w-full'}`}>
                <div className="relative group overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-700 shadow-md">
                  <div className={`${previewMode === 'MOBILE' ? 'aspect-[16/7]' : 'aspect-[21/9]'} w-full overflow-hidden bg-slate-900`}>
                    <img
                      src={slot.image_url}
                      alt={slot.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold tracking-wider text-white uppercase border border-white/20">
                    {slot.badge_text || 'SPONSORED'}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-between p-4 text-white">
                    <div>
                      <div className="text-xs font-bold text-zinc-300">{slot.sponsor_name}</div>
                      <div className="text-sm font-extrabold">{slot.title}</div>
                    </div>
                    <a
                      href={slot.redirect_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-md text-xs font-bold text-white border border-white/30 transition-all"
                    >
                      <span>{slot.cta_text || 'Know More'}</span>
                      <span className="material-symbols-outlined text-xs">arrow_forward</span>
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 dark:text-zinc-500 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
                Upload an ad image above to see the live simulation preview.
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};
