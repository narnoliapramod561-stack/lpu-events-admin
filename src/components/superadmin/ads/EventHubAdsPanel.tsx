import React, { useState, useEffect, useCallback } from 'react';
import { supabase, lpuClient } from '../../../supabase';
import type { AdPlacementSlot } from '../../../shared/ads/adTypes';
import { AdPositionSlotBox } from './AdPositionSlotBox';

export const EventHubAdsPanel: React.FC = () => {
  const [slots, setSlots] = useState<AdPlacementSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ad_placement_slots')
        .select('*')
        .eq('placement', 'EVENT_GRID_FEED')
        .order('slot_order', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setSlots(data as AdPlacementSlot[]);
      } else {
        setSlots([
          {
            id: '',
            placement: 'EVENT_GRID_FEED',
            slot_key: 'slot_1',
            slot_order: 1,
            title: 'In-Feed Sponsored Card 1',
            sponsor_name: '',
            image_url: '',
            redirect_url: '',
            cta_text: 'Know More',
            badge_text: 'SPONSORED',
            display_duration_ms: 6000,
            after_index: 6,
            is_active: false,
          },
        ]);
      }
    } catch (err: any) {
      console.error('Failed to load Event Hub ad slots:', err);
      setGlobalError(err.message || 'Failed to load Event Hub ad slots.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleSaveSlot = async (updatedSlot: AdPlacementSlot) => {
    const payload = {
      placement: 'EVENT_GRID_FEED',
      slot_key: updatedSlot.slot_key,
      slot_order: updatedSlot.slot_order,
      title: updatedSlot.title,
      sponsor_name: updatedSlot.sponsor_name,
      image_url: updatedSlot.image_url,
      mobile_image_url: updatedSlot.mobile_image_url || updatedSlot.image_url,
      media_id: updatedSlot.media_id,
      redirect_url: updatedSlot.redirect_url,
      cta_text: updatedSlot.cta_text,
      badge_text: updatedSlot.badge_text,
      display_duration_ms: 6000,
      after_index: updatedSlot.after_index ?? 6,
      is_active: updatedSlot.is_active,
    };

    const { data, error } = await supabase.rpc('save_ad_placement_slot', {
      p_slot: payload,
    });

    if (error) throw error;
    if (data && (data as any).status === 'error') {
      throw new Error((data as any).message || 'Failed to save Event Hub ad slot.');
    }

    const saved = data?.data as AdPlacementSlot;
    setSlots((prev) =>
      prev.map((s) => (s.slot_key === saved.slot_key ? saved : s))
    );

    await lpuClient.dispatchEdgeInvalidation(['ads', 'homepage']).catch((err) => {
      console.warn('Edge invalidation notice:', err);
    });
  };

  const handleAddSlot = () => {
    const nextIndex = slots.length + 1;
    const newSlot: AdPlacementSlot = {
      id: '',
      placement: 'EVENT_GRID_FEED',
      slot_key: `slot_${Date.now()}`,
      slot_order: nextIndex,
      title: `In-Feed Sponsored Card ${nextIndex}`,
      sponsor_name: '',
      image_url: '',
      redirect_url: '',
      cta_text: 'Know More',
      badge_text: 'SPONSORED',
      display_duration_ms: 6000,
      after_index: (nextIndex * 6),
      is_active: false,
    };
    setSlots([...slots, newSlot]);
  };

  const handleDeleteSlot = async (slotToDelete: AdPlacementSlot) => {
    if (!confirm(`Are you sure you want to remove "${slotToDelete.title || 'this ad card'}"?`)) return;

    if (slotToDelete.id) {
      const { error } = await supabase
        .from('ad_placement_slots')
        .delete()
        .eq('id', slotToDelete.id);
      if (error) {
        alert('Failed to delete slot from database.');
        return;
      }
      await lpuClient.dispatchEdgeInvalidation(['ads', 'homepage']).catch(console.warn);
    }

    setSlots((prev) => prev.filter((s) => s.slot_key !== slotToDelete.slot_key));
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Surface Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#1c1c1e] p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ff6b00] text-2xl">grid_view</span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Event Hub Grid Sponsored Cards</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Manage native sponsored cards interleaved into the main event catalogue grid. Upload pictures to Cloudflare R2 and specify target card offsets.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddSlot}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">add_circle</span>
          <span>Add In-Feed Card Box</span>
        </button>
      </div>

      {globalError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-2xl text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span>
          <span>{globalError}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-[#1c1c1e] border border-slate-200 dark:border-zinc-800 rounded-2xl">
          <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 dark:text-zinc-400 font-semibold">Loading Event Hub boxes...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {slots.map((slot, index) => (
            <AdPositionSlotBox
              key={slot.slot_key || slot.id || index}
              slot={slot}
              boxTitle={slot.title || `In-Feed Card ${index + 1}`}
              badge={`GRID CARD ${index + 1}`}
              aspectRatioText="16:9 Event Card (1200x675 recommended)"
              aspectRatioClass="aspect-video"
              minRatio={1.2}
              maxRatio={2.0}
              showPositionSelector={true}
              positionLabel="Insert after Event Card #"
              onSave={handleSaveSlot}
              onDelete={slots.length > 1 ? () => handleDeleteSlot(slot) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
};
