import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase, lpuClient } from '../../../supabase';
import type { AdPlacementSlot } from '../../../shared/ads/adTypes';
import { uploadAndOptimizeImage } from '../../../shared/images/uploader';
import { getEventImage } from '../../../utils/images';

interface HeroEventItem {
  id: string;
  carouselItemId?: string;
  name: string;
  description?: string;
  start_at: string;
  venue_name: string;
  banner_url: string;
  category?: string;
  organizer?: string;
}

interface InterleavedSlide {
  kind: 'EVENT' | 'AD';
  key: string;
  eventIndex?: number;
  event?: HeroEventItem;
  adSlot?: AdPlacementSlot;
  isSlottedAd?: boolean;
}

export const HeroCarouselAdsPanel: React.FC = () => {
  const [slots, setSlots] = useState<AdPlacementSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const [frequency, setFrequency] = useState<number>(0);
  const [saveToast, setSaveToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Hero Events State for Interactive Carousel Placement
  const [heroEvents, setHeroEvents] = useState<HeroEventItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [activeInterleaveView, setActiveInterleaveView] = useState<'slider' | 'track'>('slider');

  // Slotting Modal State (Inserting ad between events)
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [targetSlotEventIndex, setTargetSlotEventIndex] = useState<number | null>(null);
  const [slotModalTab, setSlotModalTab] = useState<'select' | 'upload'>('select');

  // New Ad Slot Form State (for modal)
  const [slotAdName, setSlotAdName] = useState('');
  const [slotAdLink, setSlotAdLink] = useState('');
  const [slotAdImageFile, setSlotAdImageFile] = useState<File | null>(null);
  const [slotAdImagePreview, setSlotAdImagePreview] = useState<string | null>(null);
  const [slotAdUploading, setSlotAdUploading] = useState(false);
  const [slotAdUploadStep, setSlotAdUploadStep] = useState<string | null>(null);
  const [slotAdError, setSlotAdError] = useState<string | null>(null);
  const [slotAdAspectNotice, setSlotAdAspectNotice] = useState<string | null>(null);
  const slotFileInputRef = useRef<HTMLInputElement | null>(null);

  // Modal State for Adding New Ad (General Inventory)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [aspectNotice, setAspectNotice] = useState<string | null>(null);
  const modalFileInputRef = useRef<HTMLInputElement | null>(null);

  const showSaveToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setSaveToast({ message, type });
    setTimeout(() => setSaveToast(null), 3500);
  }, []);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ad_placement_slots')
        .select('*')
        .eq('placement', 'HERO_CAROUSEL')
        .order('slot_order', { ascending: true });

      if (error) throw error;
      setSlots((data as AdPlacementSlot[]) || []);

      // Load configured carousel frequency
      const { data: configData } = await supabase
        .from('ad_placement_configs')
        .select('frequency')
        .eq('placement', 'HERO_CAROUSEL')
        .maybeSingle();

      if (configData && typeof configData.frequency === 'number') {
        setFrequency(configData.frequency);
      }
    } catch (err: any) {
      console.error('Failed to load hero carousel ad slots:', err);
      setGlobalError(err.message || 'Failed to load carousel ad slots.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Hero Carousel Events for Interleaving
  const fetchHeroEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      // 1. Check curated carousel_items first
      const { data: carouselData } = await supabase
        .from('carousel_items')
        .select(`
          id,
          sort_order,
          is_active,
          custom_title,
          custom_subtitle,
          badge_text,
          events (
            id,
            name,
            description,
            start_at,
            venue_name,
            banner_media_id,
            status,
            categories (name),
            organizations (name),
            media_assets:banner_media_id (id, object_key, bucket)
          )
        `)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      const resolved: HeroEventItem[] = [];
      if (carouselData && carouselData.length > 0) {
        for (const item of carouselData) {
          const evt: any = Array.isArray(item.events) ? item.events[0] : item.events;
          if (evt) {
            resolved.push({
              id: evt.id,
              carouselItemId: item.id,
              name: item.custom_title?.trim() || evt.name || 'Campus Event',
              description: item.custom_subtitle?.trim() || evt.description || '',
              start_at: evt.start_at || '',
              venue_name: evt.venue_name || 'LPU Campus',
              banner_url: getEventImage(evt, 'hero') || '/defaults/hero_default.webp',
              category: evt.categories?.name || 'Featured',
              organizer: evt.organizations?.name || 'LPU Administration',
            });
          }
        }
      }

      if (resolved.length > 0) {
        setHeroEvents(resolved);
        return;
      }

      // 2. Fallback to featured_events table
      const { data: featData } = await supabase
        .from('featured_events')
        .select(`
          event_id,
          sort_order,
          events (
            id,
            name,
            description,
            start_at,
            venue_name,
            banner_media_id,
            status,
            categories (name),
            organizations (name),
            media_assets:banner_media_id (id, object_key, bucket)
          )
        `)
        .order('sort_order', { ascending: true });

      if (featData && featData.length > 0) {
        for (const item of featData) {
          const evt: any = Array.isArray(item.events) ? item.events[0] : item.events;
          if (evt) {
            resolved.push({
              id: evt.id,
              name: evt.name || 'Campus Event',
              description: evt.description || '',
              start_at: evt.start_at || '',
              venue_name: evt.venue_name || 'LPU Campus',
              banner_url: getEventImage(evt, 'hero') || '/defaults/hero_default.webp',
              category: evt.categories?.name || 'Featured',
              organizer: evt.organizations?.name || 'LPU Club',
            });
          }
        }
      }

      if (resolved.length > 0) {
        setHeroEvents(resolved);
        return;
      }

      // 3. Fallback to top published events
      const { data: evts } = await supabase
        .from('events')
        .select(`
          id,
          name,
          description,
          start_at,
          venue_name,
          banner_media_id,
          categories (name),
          organizations (name),
          media_assets:banner_media_id (id, object_key, bucket)
        `)
        .eq('status', 'PUBLISHED')
        .order('start_at', { ascending: false })
        .limit(6);

      if (evts && evts.length > 0) {
        for (const evt of evts) {
          resolved.push({
            id: evt.id,
            name: evt.name || 'Campus Event',
            description: evt.description || '',
            start_at: evt.start_at || '',
            venue_name: (evt as any).venue_name || 'LPU Campus',
            banner_url: getEventImage(evt, 'hero') || '/defaults/hero_default.webp',
            category: (evt as any).categories?.name || 'Campus Event',
            organizer: (evt as any).organizations?.name || 'LPU Community',
          });
        }
      }

      setHeroEvents(resolved);
    } catch (err) {
      console.error('Failed to load hero carousel events:', err);
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();
    fetchHeroEvents();
  }, [fetchSlots, fetchHeroEvents]);

  // Compute full interleaved sequence of events and slotted ads
  const interleavedSlides = useMemo<InterleavedSlide[]>(() => {
    if (heroEvents.length === 0) return [];

    const activeSlots = slots.filter((s) => s.is_active && s.image_url);
    const slotsMapByIndex = new Map<number, AdPlacementSlot>();
    const slotsMapByEventId = new Map<string, AdPlacementSlot>();

    for (const slot of activeSlots) {
      if (typeof slot.after_index === 'number') {
        slotsMapByIndex.set(slot.after_index, slot);
      }
      if (slot.target_event_id) {
        slotsMapByEventId.set(slot.target_event_id, slot);
      }
    }

    const slidesSeq: InterleavedSlide[] = [];

    for (let i = 0; i < heroEvents.length; i++) {
      const evt = heroEvents[i];
      slidesSeq.push({
        kind: 'EVENT',
        key: `event-${evt.id}-${i}`,
        eventIndex: i,
        event: evt,
      });

      // Check if an ad is slotted after this event
      const slottedAd = slotsMapByEventId.get(evt.id) || slotsMapByIndex.get(i);
      if (slottedAd) {
        slidesSeq.push({
          kind: 'AD',
          key: `ad-${slottedAd.id || slottedAd.slot_key}-${i}`,
          eventIndex: i,
          adSlot: slottedAd,
          isSlottedAd: true,
        });
      }
    }

    return slidesSeq;
  }, [heroEvents, slots]);

  // Clamp preview slide index within bounds
  useEffect(() => {
    if (previewSlideIndex >= interleavedSlides.length && interleavedSlides.length > 0) {
      setPreviewSlideIndex(0);
    }
  }, [interleavedSlides.length, previewSlideIndex]);

  // Auto-play preview timer
  useEffect(() => {
    if (!isAutoPlay || interleavedSlides.length <= 1) return;
    const interval = setInterval(() => {
      setPreviewSlideIndex((prev) => (prev + 1) % interleavedSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlay, interleavedSlides.length]);

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === slots.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(slots.map((s) => s.id || s.slot_key)));
    }
  };

  // Explicit Save & Sync button handler: saves order/statuses and invalidates edge CDN
  const handleSaveAndSyncToEdge = async () => {
    setIsSavingChanges(true);
    try {
      // 1. Commit any order and active statuses
      for (const s of slots) {
        if (s.id) {
          await supabase
            .from('ad_placement_slots')
            .update({
              is_active: s.is_active,
              slot_order: s.slot_order,
              after_index: s.after_index,
              target_event_id: s.target_event_id,
            })
            .eq('id', s.id);
        }
      }

      // 2. Commit configured frequency to ad_placement_configs
      await supabase
        .from('ad_placement_configs')
        .upsert({
          placement: 'HERO_CAROUSEL',
          frequency: frequency,
          is_enabled: slots.some((s) => s.is_active),
        }, { onConflict: 'placement' });

      // 3. Dispatch Cloudflare Edge Invalidation immediately
      await lpuClient.dispatchEdgeInvalidation(['ads', 'homepage', 'carousel']);
      lpuClient.invalidateClientCache('ads');
      lpuClient.invalidateClientCache('homepage');
      lpuClient.invalidateClientCache('carousel');

      showSaveToast('Saved! Carousel ad order synced to Cloudflare Edge. Live on student website now.');
    } catch (err: any) {
      console.error('Failed to save and sync:', err);
      showSaveToast(err.message || 'Failed to sync changes to edge.', 'error');
    } finally {
      setIsSavingChanges(false);
    }
  };

  // Toggle single ad status (turn ON / OFF)
  const handleToggleStatus = async (slot: AdPlacementSlot, newStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('ad_placement_slots')
        .update({ is_active: newStatus })
        .eq('id', slot.id);

      if (error) throw error;

      setSlots((prev) =>
        prev.map((s) => (s.id === slot.id ? { ...s, is_active: newStatus } : s))
      );

      await lpuClient.dispatchEdgeInvalidation(['ads', 'homepage', 'carousel']).catch(console.warn);
      lpuClient.invalidateClientCache('ads');
      lpuClient.invalidateClientCache('carousel');
    } catch (err: any) {
      alert(`Failed to update status: ${err.message || err}`);
    }
  };

  // Delete single ad
  const handleDeleteSingle = async (slot: AdPlacementSlot) => {
    if (!confirm(`Are you sure you want to delete ad "${slot.title || 'Untitled'}"?`)) return;

    try {
      const { error } = await supabase
        .from('ad_placement_slots')
        .delete()
        .eq('id', slot.id);

      if (error) throw error;

      setSlots((prev) => prev.filter((s) => s.id !== slot.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(slot.id || slot.slot_key);
        return next;
      });

      await lpuClient.dispatchEdgeInvalidation(['ads', 'homepage', 'carousel']).catch(console.warn);
      lpuClient.invalidateClientCache('ads');
      lpuClient.invalidateClientCache('carousel');
      showSaveToast('Ad removed from carousel.');
    } catch (err: any) {
      alert(`Failed to delete ad: ${err.message || err}`);
    }
  };

  // Bulk actions: Turn Selected ON / OFF
  const handleBulkToggle = async (active: boolean) => {
    if (selectedIds.size === 0) return;
    setIsBulkActionLoading(true);
    try {
      const idsToUpdate = slots
        .filter((s) => selectedIds.has(s.id || s.slot_key))
        .map((s) => s.id);

      const { error } = await supabase
        .from('ad_placement_slots')
        .update({ is_active: active })
        .in('id', idsToUpdate);

      if (error) throw error;

      setSlots((prev) =>
        prev.map((s) => (selectedIds.has(s.id || s.slot_key) ? { ...s, is_active: active } : s))
      );

      await lpuClient.dispatchEdgeInvalidation(['ads', 'homepage', 'carousel']).catch(console.warn);
      lpuClient.invalidateClientCache('ads');
      lpuClient.invalidateClientCache('carousel');
    } catch (err: any) {
      alert(`Failed bulk update: ${err.message || err}`);
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  // Bulk delete selected
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.size} selected ad(s)?`)) return;

    setIsBulkActionLoading(true);
    try {
      const idsToDelete = slots
        .filter((s) => selectedIds.has(s.id || s.slot_key))
        .map((s) => s.id);

      const { error } = await supabase
        .from('ad_placement_slots')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      setSlots((prev) => prev.filter((s) => !selectedIds.has(s.id || s.slot_key)));
      setSelectedIds(new Set());

      await lpuClient.dispatchEdgeInvalidation(['ads', 'homepage', 'carousel']).catch(console.warn);
      lpuClient.invalidateClientCache('ads');
      lpuClient.invalidateClientCache('carousel');
    } catch (err: any) {
      alert(`Failed bulk delete: ${err.message || err}`);
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  // Handle general modal image select
  const handleModalImageSelect = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setFormError('Image size must be under 15MB.');
      return;
    }

    setFormError(null);
    setNewImageFile(file);

    const preview = URL.createObjectURL(file);
    setNewImagePreview(preview);

    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      if (ratio < 1.4 || ratio > 2.1) {
        setAspectNotice(`Notice: Selected image is ${img.naturalWidth}x${img.naturalHeight} (${ratio.toFixed(2)}:1). For best results on desktop & mobile, 16:9 (1920x1080) is recommended.`);
      } else {
        setAspectNotice(null);
      }
    };
    img.src = preview;
  };

  // Add new ad submission (general inventory)
  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setFormError('Ad name is required.');
      return;
    }
    if (!newImageFile && !newImageUrl) {
      setFormError('Please upload an ad picture.');
      return;
    }

    setIsUploading(true);
    setFormError(null);

    try {
      let finalImageUrl = newImageUrl;
      let mediaId: string | undefined = undefined;

      if (newImageFile) {
        setUploadProgress('Uploading picture to Cloudflare R2...');
        const result = await uploadAndOptimizeImage({
          supabase,
          file: newImageFile,
          context: 'advertisement',
          onProgress: (step) => {
            if (step === 'validating') setUploadProgress('Validating image...');
            else if (step === 'compressing') setUploadProgress('Optimizing WebP...');
            else if (step === 'uploading') setUploadProgress('Uploading to Cloudflare R2...');
          },
        });

        if (!result?.publicUrl) {
          throw new Error('Failed to upload ad image to Cloudflare R2.');
        }

        finalImageUrl = result.publicUrl;
        mediaId = result.mediaId;
      }

      setUploadProgress('Saving ad slot...');
      const nextOrder = slots.length + 1;
      const slotPayload = {
        placement: 'HERO_CAROUSEL',
        slot_key: `carousel_${Date.now()}`,
        slot_order: nextOrder,
        title: newName.trim(),
        sponsor_name: newName.trim(),
        image_url: finalImageUrl,
        mobile_image_url: finalImageUrl,
        media_id: mediaId,
        redirect_url: newLink.trim() || '#',
        cta_text: 'Know More',
        badge_text: 'SPONSORED',
        display_duration_ms: 6000,
        is_active: true,
      };

      const { data, error } = await supabase.rpc('save_ad_placement_slot', {
        p_slot: slotPayload,
      });

      if (error) throw error;
      if (data && (data as any).status === 'error') {
        throw new Error((data as any).message || 'Failed to save ad.');
      }

      const saved = data?.data as AdPlacementSlot;
      setSlots((prev) => [...prev, saved]);

      await lpuClient.dispatchEdgeInvalidation(['ads', 'homepage', 'carousel']).catch(console.warn);
      lpuClient.invalidateClientCache('ads');
      lpuClient.invalidateClientCache('carousel');

      setIsAddModalOpen(false);
      setNewName('');
      setNewLink('');
      setNewImageUrl('');
      setNewImageFile(null);
      setNewImagePreview(null);
      setAspectNotice(null);
      showSaveToast('New ad created successfully!');
    } catch (err: any) {
      console.error('Failed to create hero carousel ad:', err);
      setFormError(err.message || 'Failed to create ad.');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // Open "Insert Ad Between Events" Modal
  const openInsertAdModal = (eventIndex: number) => {
    setTargetSlotEventIndex(eventIndex);
    setSlotModalTab('select');
    setSlotAdError(null);
    setSlotAdAspectNotice(null);
    setSlotAdName('');
    setSlotAdLink('');
    setSlotAdImageFile(null);
    setSlotAdImagePreview(null);
    setIsSlotModalOpen(true);
  };

  // Slot existing ad after specific event
  const handleSlotExistingAd = async (slotId: string, eventIndex: number) => {
    try {
      const targetEvent = heroEvents[eventIndex];
      const { error } = await supabase
        .from('ad_placement_slots')
        .update({
          after_index: eventIndex,
          target_event_id: targetEvent ? targetEvent.id : null,
          is_active: true,
        })
        .eq('id', slotId);

      if (error) throw error;

      setSlots((prev) =>
        prev.map((s) =>
          s.id === slotId
            ? { ...s, after_index: eventIndex, target_event_id: targetEvent ? targetEvent.id : null, is_active: true }
            : s
        )
      );

      await lpuClient.dispatchEdgeInvalidation(['ads', 'homepage', 'carousel']).catch(console.warn);
      lpuClient.invalidateClientCache('ads');
      lpuClient.invalidateClientCache('carousel');

      setIsSlotModalOpen(false);
      showSaveToast(`Ad successfully slotted between events!`);
    } catch (err: any) {
      console.error('Failed to slot ad:', err);
      alert(`Failed to slot ad: ${err.message || err}`);
    }
  };

  // Remove ad from being slotted between events (clears after_index)
  const handleUnslotAd = async (slotId: string) => {
    try {
      const { error } = await supabase
        .from('ad_placement_slots')
        .update({
          after_index: null,
          target_event_id: null,
        })
        .eq('id', slotId);

      if (error) throw error;

      setSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, after_index: null, target_event_id: null } : s))
      );

      await lpuClient.dispatchEdgeInvalidation(['ads', 'homepage', 'carousel']).catch(console.warn);
      lpuClient.invalidateClientCache('ads');
      lpuClient.invalidateClientCache('carousel');
      showSaveToast('Ad unslotted from carousel event sequence.');
    } catch (err: any) {
      console.error('Failed to unslot ad:', err);
      alert(`Failed to unslot ad: ${err.message || err}`);
    }
  };

  // Move / slide ad position to follow a different event
  const handleUpdateSlotPosition = async (slotId: string, newAfterIndex: number) => {
    try {
      const targetEvent = heroEvents[newAfterIndex];
      const { error } = await supabase
        .from('ad_placement_slots')
        .update({
          after_index: newAfterIndex,
          target_event_id: targetEvent ? targetEvent.id : null,
          is_active: true,
        })
        .eq('id', slotId);

      if (error) throw error;

      setSlots((prev) =>
        prev.map((s) =>
          s.id === slotId
            ? { ...s, after_index: newAfterIndex, target_event_id: targetEvent ? targetEvent.id : null, is_active: true }
            : s
        )
      );

      await lpuClient.dispatchEdgeInvalidation(['ads', 'homepage', 'carousel']).catch(console.warn);
      lpuClient.invalidateClientCache('ads');
      lpuClient.invalidateClientCache('carousel');
      showSaveToast(`Ad moved after Event #${newAfterIndex + 1}!`);
    } catch (err: any) {
      console.error('Failed to update ad position:', err);
      alert(`Failed to update ad position: ${err.message || err}`);
    }
  };

  // Create new ad and immediately slot it between events
  const handleCreateAndSlotAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetSlotEventIndex === null) return;
    if (!slotAdName.trim()) {
      setSlotAdError('Ad campaign name is required.');
      return;
    }
    if (!slotAdImageFile) {
      setSlotAdError('Please upload an ad picture.');
      return;
    }

    setSlotAdUploading(true);
    setSlotAdError(null);

    try {
      setSlotAdUploadStep('Uploading creative to Cloudflare R2...');
      const uploadRes = await uploadAndOptimizeImage({
        supabase,
        file: slotAdImageFile,
        context: 'advertisement',
        onProgress: (step) => {
          if (step === 'validating') setSlotAdUploadStep('Validating creative...');
          else if (step === 'compressing') setSlotAdUploadStep('Optimizing WebP variants...');
          else if (step === 'uploading') setSlotAdUploadStep('Writing to Cloudflare R2...');
        },
      });

      if (!uploadRes?.publicUrl) {
        throw new Error('Failed to upload ad image to Cloudflare R2.');
      }

      setSlotAdUploadStep('Slotting ad between events...');
      const targetEvent = heroEvents[targetSlotEventIndex];
      const slotPayload = {
        placement: 'HERO_CAROUSEL',
        slot_key: `carousel_slotted_${Date.now()}`,
        slot_order: slots.length + 1,
        title: slotAdName.trim(),
        sponsor_name: slotAdName.trim(),
        image_url: uploadRes.publicUrl,
        mobile_image_url: uploadRes.publicUrl,
        media_id: uploadRes.mediaId,
        redirect_url: slotAdLink.trim() || '#',
        cta_text: 'Know More',
        badge_text: 'SPONSORED',
        display_duration_ms: 6000,
        after_index: targetSlotEventIndex,
        target_event_id: targetEvent ? targetEvent.id : null,
        is_active: true,
      };

      const { data, error } = await supabase.rpc('save_ad_placement_slot', {
        p_slot: slotPayload,
      });

      if (error) throw error;
      if (data && (data as any).status === 'error') {
        throw new Error((data as any).message || 'Failed to save ad slot.');
      }

      const saved = data?.data as AdPlacementSlot;
      setSlots((prev) => [...prev, saved]);

      await lpuClient.dispatchEdgeInvalidation(['ads', 'homepage', 'carousel']).catch(console.warn);
      lpuClient.invalidateClientCache('ads');
      lpuClient.invalidateClientCache('carousel');

      setIsSlotModalOpen(false);
      showSaveToast(`Ad created and slotted between events live on student carousel!`);
    } catch (err: any) {
      console.error('Failed to create and slot ad:', err);
      setSlotAdError(err.message || 'Failed to create and slot ad.');
    } finally {
      setSlotAdUploading(false);
      setSlotAdUploadStep(null);
    }
  };

  const currentPreviewSlide = interleavedSlides[previewSlideIndex];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#1c1c1e] p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ff6b00] text-2xl">view_carousel</span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Hero Carousel Ads</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Manage hero carousel ads inventory, configure frequency, and visually slide through events below to insert ads directly between hero slides.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Ad Frequency Selector */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/80 text-xs">
            <span className="material-symbols-outlined text-sm text-[#ff6b00]">repeat</span>
            <label htmlFor="ad-freq-select" className="font-bold text-slate-700 dark:text-zinc-200 whitespace-nowrap">
              Fallback Frequency:
            </label>
            <select
              id="ad-freq-select"
              value={frequency}
              onChange={(e) => setFrequency(Number(e.target.value))}
              className="bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-600 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#ff6b00] cursor-pointer"
            >
              <option value={0}>Disabled (Only Slotted Ads)</option>
              <option value={1}>Every 1 event (1:1)</option>
              <option value={2}>Every 2 events (2:1)</option>
              <option value={3}>Every 3 events (3:1)</option>
              <option value={4}>Every 4 events (4:1)</option>
              <option value={5}>Every 5 events (5:1)</option>
            </select>
          </div>

          {/* Explicit Save & Sync Button */}
          <button
            type="button"
            onClick={handleSaveAndSyncToEdge}
            disabled={isSavingChanges}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs shadow-md transition-all cursor-pointer select-none ${
              isSavingChanges
                ? 'bg-emerald-700 text-white opacity-80'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-lg'
            }`}
            title="Saves configuration and purges Cloudflare CDN cache so changes reflect on student site immediately"
          >
            {isSavingChanges ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving & Syncing...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">cloud_sync</span>
                <span>Save & Sync</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setAspectNotice(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ff6b00] hover:bg-[#e05d00] text-white text-xs font-extrabold shadow-md hover:shadow-lg transition-all cursor-pointer select-none"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            <span>Add New Ad</span>
          </button>
        </div>
      </div>

      {/* Floating Save Toast */}
      {saveToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-2.5 animate-fadeIn ${
            saveToast.type === 'success'
              ? 'bg-[#1c1c1e] text-white border-emerald-500/50'
              : 'bg-rose-900 text-white border-rose-500'
          }`}
        >
          <span className={`material-symbols-outlined text-lg ${saveToast.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {saveToast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{saveToast.message}</span>
        </div>
      )}

      {globalError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-2xl text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span>
          <span>{globalError}</span>
        </div>
      )}

      {/* Section 1: Ads Inventory Grid */}
      <div className="space-y-4">
        {/* Bulk Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#1c1c1e] p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedIds.size === slots.length && slots.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded text-[#ff6b00] focus:ring-[#ff6b00] border-slate-300 dark:border-zinc-700"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select All'}
              </span>
            </label>
            <span className="text-xs text-slate-400 dark:text-zinc-500">|</span>
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
              Total {slots.length} ad{slots.length === 1 ? '' : 's'} ({slots.filter((s) => s.is_active).length} Active)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 animate-fadeIn">
                <button
                  type="button"
                  onClick={() => handleBulkToggle(true)}
                  disabled={isBulkActionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold hover:bg-emerald-100 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">visibility</span>
                  <span>Turn ON</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleBulkToggle(false)}
                  disabled={isBulkActionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs font-bold hover:bg-amber-100 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">visibility_off</span>
                  <span>Turn OFF</span>
                </button>

                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={isBulkActionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span>Delete Selected</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setAspectNotice(null);
                setIsAddModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#ff6b00] hover:bg-[#e05d00] text-white text-xs font-bold shadow-xs transition-all cursor-pointer select-none"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>Add Ad</span>
            </button>
          </div>
        </div>

        {/* Ads Cards Grid */}
        {loading ? (
          <div className="p-12 text-center bg-white dark:bg-[#1c1c1e] border border-slate-200 dark:border-zinc-800 rounded-2xl">
            <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-semibold">Loading carousel ads...</p>
          </div>
        ) : slots.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-[#1c1c1e] border border-slate-200 dark:border-zinc-800 rounded-2xl">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-zinc-600 mb-2">view_carousel</span>
            <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300">No Hero Carousel Ads Added Yet</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">
              Click &quot;Add New Ad&quot; above to create your first hero carousel advertisement, or use the interactive slider below to insert ads between events.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {slots.map((slot) => {
              const isSelected = selectedIds.has(slot.id || slot.slot_key);
              const isSlotted = typeof slot.after_index === 'number';

              return (
                <div
                  key={slot.id || slot.slot_key}
                  className={`bg-white dark:bg-[#1c1c1e] rounded-2xl border transition-all overflow-hidden flex flex-col shadow-xs ${
                    isSelected
                      ? 'border-primary-500 ring-2 ring-primary-500/20'
                      : isSlotted
                      ? 'border-emerald-500/50 dark:border-emerald-500/30 ring-1 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-zinc-700'
                  }`}
                >
                  {/* Image Preview & Badges */}
                  <div className="relative aspect-video bg-slate-900 group overflow-hidden">
                    {slot.image_url ? (
                      <img
                        src={slot.image_url}
                        alt={slot.title || 'Ad'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 text-xs">
                        <span className="material-symbols-outlined text-3xl mb-1">image_not_supported</span>
                        <span>No picture</span>
                      </div>
                    )}

                    {/* Top-Left Selection Checkbox */}
                    <div className="absolute top-3 left-3 z-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(slot.id || slot.slot_key)}
                        className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 border-white/40 shadow cursor-pointer"
                      />
                    </div>

                    {/* Top-Right Badges */}
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                      {isSlotted && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow backdrop-blur-md">
                          <span className="material-symbols-outlined text-[11px]">pin_drop</span>
                          Slotted
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow backdrop-blur-md ${
                          slot.is_active
                            ? 'bg-emerald-500/90 text-white'
                            : 'bg-zinc-800/90 text-zinc-300 border border-white/10'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${slot.is_active ? 'bg-white animate-pulse' : 'bg-zinc-400'}`} />
                        {slot.is_active ? 'Active' : 'Turned Off'}
                      </span>
                    </div>

                    {/* Aspect Ratio Tag */}
                    <div className="absolute bottom-2 left-2 z-10">
                      <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold border border-white/10">
                        16:9 • 1920x1080
                      </span>
                    </div>
                  </div>

                  {/* Content details */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1" title={slot.title}>
                          {slot.title || 'Untitled Ad'}
                        </h3>
                      </div>

                      {/* Slotted Placement Info Pill */}
                      {isSlotted && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          <span className="material-symbols-outlined text-xs">swipe_right</span>
                          <span>Slides in after Event #{Number(slot.after_index) + 1}</span>
                        </div>
                      )}

                      {slot.redirect_url && (
                        <a
                          href={slot.redirect_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline mt-1 font-medium truncate max-w-full"
                          title={slot.redirect_url}
                        >
                          <span className="material-symbols-outlined text-xs">link</span>
                          <span className="truncate">{slot.redirect_url}</span>
                        </a>
                      )}
                    </div>

                    {/* Actions: Toggle ON/OFF and Delete */}
                    <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Switch / Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(slot, !slot.is_active)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none border ${
                            slot.is_active
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-200'
                          }`}
                          title={slot.is_active ? 'Click to Turn Off' : 'Click to Turn On'}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {slot.is_active ? 'toggle_on' : 'toggle_off'}
                          </span>
                          <span>{slot.is_active ? 'On' : 'Off'}</span>
                        </button>

                        {/* Unslot button if currently slotted */}
                        {isSlotted && (
                          <button
                            type="button"
                            onClick={() => handleUnslotAd(slot.id)}
                            className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 transition-colors cursor-pointer"
                            title="Unslot from between events"
                          >
                            Unslot
                          </button>
                        )}
                      </div>

                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteSingle(slot)}
                        className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete this ad"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────
          Section 2: Interactive Hero Carousel Placement & Sliding Sequencer
          "below now give option so that we can add ad there by sliding between hero curosel events"
          ──────────────────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-3xl border border-slate-200 dark:border-white/10 p-6 shadow-sm space-y-6">
        {/* Header & Sub-Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-orange-500/10 text-[#ff6b00]">
                <span className="material-symbols-outlined text-xl">view_carousel</span>
              </span>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Live Hero Carousel Interleaver & Event Slider
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-2xl">
              Slide through the live hero events featured on the student homepage. You can insert, configure, or remove advertisements directly between any two event slides.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {/* Auto-Slide Preview Toggle */}
            <button
              type="button"
              onClick={() => setIsAutoPlay((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isAutoPlay
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-50'
              }`}
              title={isAutoPlay ? 'Pause Auto-Slide' : 'Enable Auto-Slide (5s interval)'}
            >
              <span className="material-symbols-outlined text-sm">
                {isAutoPlay ? 'pause_circle' : 'play_circle'}
              </span>
              <span>{isAutoPlay ? 'Auto-Sliding' : 'Auto-Slide'}</span>
            </button>

            {/* View Mode Toggle: Interactive Slider vs Sequence Track */}
            <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveInterleaveView('slider')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeInterleaveView === 'slider'
                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-sm">swipe</span>
                <span>Interactive Slider</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveInterleaveView('track')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeInterleaveView === 'track'
                    ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-sm">view_timeline</span>
                <span>Sequence Track</span>
              </button>
            </div>

            {/* Refresh Events */}
            <button
              type="button"
              onClick={fetchHeroEvents}
              disabled={loadingEvents}
              className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
              title="Refresh Hero Carousel events"
            >
              <span className={`material-symbols-outlined text-base ${loadingEvents ? 'animate-spin' : ''}`}>
                sync
              </span>
            </button>
          </div>
        </div>

        {loadingEvents ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-semibold">Loading Hero Carousel events...</p>
          </div>
        ) : heroEvents.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
            <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">event_busy</span>
            <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">No active Hero Carousel events found</p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1">
              Events featured in Hero Carousel or published on the platform will appear here to interleave ads with.
            </p>
          </div>
        ) : (
          <>
            {/* VIEW MODE 1: Interactive Carousel Slider (The Real Sliding Experience!) */}
            {activeInterleaveView === 'slider' && (
              <div className="space-y-4">
                {/* Live Carousel Stage */}
                <div className="relative aspect-video max-h-[460px] w-full rounded-2xl overflow-hidden bg-slate-950 shadow-2xl border border-slate-800 group select-none">
                  {currentPreviewSlide ? (
                    currentPreviewSlide.kind === 'EVENT' ? (
                      /* Event Slide Preview */
                      <div className="relative w-full h-full flex flex-col justify-end p-6 sm:p-10 animate-fadeIn">
                        {/* Event Banner Background */}
                        <img
                          src={currentPreviewSlide.event?.banner_url}
                          alt={currentPreviewSlide.event?.name}
                          className="absolute inset-0 w-full h-full object-cover opacity-80"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                        {/* Top Badge Overlay */}
                        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full bg-primary-600/90 backdrop-blur-md text-white text-xs font-black uppercase tracking-wider shadow">
                            {currentPreviewSlide.event?.category || 'Event Slide'}
                          </span>
                          <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-zinc-300 text-xs font-semibold border border-white/10">
                            Slide {previewSlideIndex + 1} of {interleavedSlides.length}
                          </span>
                        </div>

                        {/* Event Metadata */}
                        <div className="relative z-10 space-y-2 max-w-2xl">
                          <h3 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-md line-clamp-2">
                            {currentPreviewSlide.event?.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-zinc-300">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm text-primary-400">calendar_today</span>
                              {currentPreviewSlide.event?.start_at
                                ? new Date(currentPreviewSlide.event.start_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })
                                : 'Upcoming'}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm text-primary-400">location_on</span>
                              {currentPreviewSlide.event?.venue_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm text-primary-400">group</span>
                              {currentPreviewSlide.event?.organizer}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Ad Slide Preview */
                      <div className="relative w-full h-full flex flex-col justify-end p-6 sm:p-10 animate-fadeIn">
                        {/* Ad Banner Image */}
                        <img
                          src={currentPreviewSlide.adSlot?.image_url}
                          alt={currentPreviewSlide.adSlot?.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                        {/* Top SPONSORED Badge */}
                        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full bg-amber-500 text-black text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
                            {currentPreviewSlide.adSlot?.badge_text || 'SPONSORED'}
                          </span>
                          <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-amber-300 text-xs font-bold border border-amber-500/30">
                            Ad Slotted After Event #{Number(currentPreviewSlide.eventIndex) + 1}
                          </span>
                        </div>

                        {/* Ad Content */}
                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                              {currentPreviewSlide.adSlot?.sponsor_name || 'Official Partner'}
                            </span>
                            <h3 className="text-xl sm:text-2xl font-extrabold text-white drop-shadow">
                              {currentPreviewSlide.adSlot?.title}
                            </h3>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            <span className="px-4 py-2 rounded-xl bg-white text-slate-900 text-xs font-extrabold shadow flex items-center gap-1">
                              <span>{currentPreviewSlide.adSlot?.cta_text || 'Know More'}</span>
                              <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  ) : null}

                  {/* Previous Slide Arrow */}
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewSlideIndex((prev) => (prev - 1 + interleavedSlides.length) % interleavedSlides.length)
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white flex items-center justify-center transition-transform hover:scale-110 cursor-pointer shadow-lg border border-white/10"
                    title="Previous Slide"
                  >
                    <span className="material-symbols-outlined text-xl">chevron_left</span>
                  </button>

                  {/* Next Slide Arrow */}
                  <button
                    type="button"
                    onClick={() => setPreviewSlideIndex((prev) => (prev + 1) % interleavedSlides.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white flex items-center justify-center transition-transform hover:scale-110 cursor-pointer shadow-lg border border-white/10"
                    title="Next Slide"
                  >
                    <span className="material-symbols-outlined text-xl">chevron_right</span>
                  </button>

                  {/* Bottom Center Slide Dots */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
                    {interleavedSlides.map((slide, idx) => (
                      <button
                        key={slide.key}
                        type="button"
                        onClick={() => setPreviewSlideIndex(idx)}
                        className={`transition-all rounded-full cursor-pointer ${
                          idx === previewSlideIndex
                            ? slide.kind === 'AD'
                              ? 'w-6 h-2 bg-amber-400'
                              : 'w-6 h-2 bg-primary-500'
                            : slide.kind === 'AD'
                            ? 'w-2 h-2 bg-amber-400/50 hover:bg-amber-400'
                            : 'w-2 h-2 bg-white/40 hover:bg-white'
                        }`}
                        title={`Go to Slide ${idx + 1} (${slide.kind})`}
                      />
                    ))}
                  </div>
                </div>

                {/* Interactive Placement Bar directly for the currently previewed slide */}
                {currentPreviewSlide && (
                  <div className="bg-slate-50 dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {currentPreviewSlide.kind === 'EVENT' ? (
                      (() => {
                        const evtIndex = currentPreviewSlide.eventIndex ?? 0;
                        const nextEvt = heroEvents[evtIndex + 1];
                        const slottedAdAfter = slots.find(
                          (s) => s.is_active && (s.after_index === evtIndex || (currentPreviewSlide.event && s.target_event_id === currentPreviewSlide.event.id))
                        );

                        return (
                          <>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-600 text-[10px] font-black">
                                  {evtIndex + 1}
                                </span>
                                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                                  Event: {currentPreviewSlide.event?.name}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                                {slottedAdAfter ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                    <span className="material-symbols-outlined text-xs">check_circle</span>
                                    Ad slotted after this event: &quot;{slottedAdAfter.title}&quot;
                                  </span>
                                ) : (
                                  <span>
                                    No ad following this event yet. You can slide an ad between this event and{' '}
                                    <span className="font-semibold">{nextEvt ? `"${nextEvt.name}"` : 'the next cycle'}</span>.
                                  </span>
                                )}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {slottedAdAfter ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openInsertAdModal(evtIndex)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 transition-all cursor-pointer shadow-xs"
                                  >
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                    <span>Change Ad</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUnslotAd(slottedAdAfter.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-sm">remove_circle</span>
                                    <span>Remove from Flow</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openInsertAdModal(evtIndex)}
                                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#e05d00] hover:from-[#e05d00] hover:to-[#c45100] text-white text-xs font-extrabold shadow-md hover:shadow-lg transition-all cursor-pointer select-none"
                                >
                                  <span className="material-symbols-outlined text-base">add_circle</span>
                                  <span>+ Slide Ad In After Event #{evtIndex + 1}</span>
                                </button>
                              )}
                            </div>
                          </>
                        );
                      })()
                    ) : (
                      /* Currently viewing the slotted ad slide */
                      (() => {
                        const adSlot = currentPreviewSlide.adSlot;
                        const evtIndex = currentPreviewSlide.eventIndex ?? 0;
                        const prevEvt = heroEvents[evtIndex];
                        const nextEvt = heroEvents[evtIndex + 1];

                        return (
                          <>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase">
                                  Slotted Ad
                                </span>
                                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                                  {adSlot?.title}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                                Slides in between{' '}
                                <span className="font-semibold text-slate-700 dark:text-zinc-200">
                                  &quot;{prevEvt?.name}&quot;
                                </span>{' '}
                                and{' '}
                                <span className="font-semibold text-slate-700 dark:text-zinc-200">
                                  {nextEvt ? `"${nextEvt.name}"` : 'First Event'}
                                </span>
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {/* Position Slider / Stepper Selector */}
                              {adSlot && (
                                <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 px-2 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs">
                                  <label htmlFor={`pos-sel-${adSlot.id}`} className="text-[11px] font-bold text-slate-500">
                                    Move after:
                                  </label>
                                  <select
                                    id={`pos-sel-${adSlot.id}`}
                                    value={evtIndex}
                                    onChange={(e) => handleUpdateSlotPosition(adSlot.id, Number(e.target.value))}
                                    className="bg-transparent font-bold text-slate-800 dark:text-white cursor-pointer focus:outline-hidden"
                                  >
                                    {heroEvents.map((evt, idx) => (
                                      <option key={evt.id} value={idx}>
                                        Event #{idx + 1} ({evt.name.slice(0, 16)}...)
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {adSlot && (
                                <button
                                  type="button"
                                  onClick={() => handleUnslotAd(adSlot.id)}
                                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
                                  title="Unslot this ad"
                                >
                                  <span className="material-symbols-outlined text-sm">remove_circle</span>
                                  <span>Unslot</span>
                                </button>
                              )}
                            </div>
                          </>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
            )}

            {/* VIEW MODE 2: Sequence Track View (Birds-Eye Layout of All Events & Ad Slots) */}
            {activeInterleaveView === 'track' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Below is the ordered sequence of your hero carousel events. Click any{' '}
                  <span className="font-bold text-[#ff6b00]">+ Insert Ad</span> slot to place an ad between those events.
                </p>

                <div className="flex flex-col gap-3">
                  {heroEvents.map((event, index) => {
                    const slottedAd = slots.find(
                      (s) => s.is_active && (s.after_index === index || s.target_event_id === event.id)
                    );
                    const isLastEvent = index === heroEvents.length - 1;

                    return (
                      <React.Fragment key={event.id}>
                        {/* Event Card Row */}
                        <div className="flex items-center gap-4 bg-slate-50 dark:bg-zinc-900/80 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 transition-all">
                          {/* Event Thumbnail */}
                          <div className="relative w-28 sm:w-36 aspect-video rounded-xl overflow-hidden bg-slate-900 shrink-0">
                            <img
                              src={event.banner_url}
                              alt={event.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[9px] font-black text-white">
                              #{index + 1}
                            </div>
                          </div>

                          {/* Event Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 text-[10px] font-bold">
                                {event.category || 'Featured'}
                              </span>
                              <span className="text-xs text-slate-400 dark:text-zinc-500 truncate">
                                {event.venue_name}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">
                              {event.name}
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                              {event.description || 'LPU campus event'}
                            </p>
                          </div>
                        </div>

                        {/* Slotted Ad OR "+ Insert Ad Here" Insertion Zone */}
                        <div className="pl-6 sm:pl-12 pr-2 py-1 relative">
                          <div className="absolute left-6 sm:left-12 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-zinc-800 -translate-x-1/2" />

                          {slottedAd ? (
                            /* Slotted Ad Card */
                            <div className="relative z-10 flex items-center justify-between gap-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/40 p-3 rounded-2xl border-2 border-amber-500/50 shadow-xs">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative w-20 sm:w-28 aspect-video rounded-lg overflow-hidden bg-black shrink-0">
                                  <img
                                    src={slottedAd.image_url}
                                    alt={slottedAd.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded-md bg-amber-500 text-black text-[9px] font-black uppercase">
                                      {slottedAd.badge_text || 'SPONSORED AD'}
                                    </span>
                                    <span className="text-[11px] text-amber-700 dark:text-amber-300 font-bold">
                                      Slides between Event #{index + 1} and #{index + 2 <= heroEvents.length ? index + 2 : 1}
                                    </span>
                                  </div>
                                  <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                                    {slottedAd.title}
                                  </h5>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => openInsertAdModal(index)}
                                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 transition-colors cursor-pointer"
                                  title="Change ad in this slot"
                                >
                                  Change
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUnslotAd(slottedAd.id)}
                                  className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                  title="Remove ad from this slot"
                                >
                                  <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* "+ Insert Ad Here" Slot Button */
                            <button
                              type="button"
                              onClick={() => openInsertAdModal(index)}
                              className="relative z-10 w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-[#ff6b00] hover:bg-orange-50/50 dark:hover:bg-orange-950/20 text-slate-600 dark:text-zinc-400 hover:text-[#ff6b00] flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer group"
                            >
                              <span className="material-symbols-outlined text-base group-hover:scale-125 transition-transform text-[#ff6b00]">
                                add_circle
                              </span>
                              <span>
                                + Insert Ad between Event #{index + 1} & #{isLastEvent ? 1 : index + 2}
                              </span>
                            </button>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────
          Modal 1: Insert Ad Between Events (Slotting Modal)
          ──────────────────────────────────────────────────────────────────────── */}
      {isSlotModalOpen && targetSlotEventIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#1c1c1e] rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#ff6b00]">view_carousel</span>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Insert Ad Between Carousel Events
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Positioning ad to slide in immediately after{' '}
                  <span className="font-bold text-slate-800 dark:text-white">
                    Event #{targetSlotEventIndex + 1}: &quot;{heroEvents[targetSlotEventIndex]?.name}&quot;
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!slotAdUploading) setIsSlotModalOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Tabs: Choose Existing vs Upload New */}
            <div className="flex border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
              <button
                type="button"
                onClick={() => setSlotModalTab('select')}
                className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all cursor-pointer ${
                  slotModalTab === 'select'
                    ? 'border-[#ff6b00] text-[#ff6b00] bg-white dark:bg-[#1c1c1e]'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Choose from Existing Ads ({slots.length})
              </button>
              <button
                type="button"
                onClick={() => setSlotModalTab('upload')}
                className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all cursor-pointer ${
                  slotModalTab === 'upload'
                    ? 'border-[#ff6b00] text-[#ff6b00] bg-white dark:bg-[#1c1c1e]'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Upload & Create New Ad
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {slotModalTab === 'select' ? (
                /* Tab 1: Choose Existing Ad */
                slots.length === 0 ? (
                  <div className="py-8 text-center">
                    <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">ad_units</span>
                    <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                      No advertisements created yet
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Switch to the &quot;Upload & Create New Ad&quot; tab to upload your first advertisement.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Click &quot;Slot This Ad&quot; to place it between Event #{targetSlotEventIndex + 1} and #{targetSlotEventIndex + 2}:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
                      {slots.map((slot) => {
                        const isCurrentlySlottedHere = slot.after_index === targetSlotEventIndex;

                        return (
                          <div
                            key={slot.id}
                            className={`p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 ${
                              isCurrentlySlottedHere
                                ? 'border-[#ff6b00] bg-orange-500/5 ring-1 ring-[#ff6b00]'
                                : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/60'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900">
                                <img
                                  src={slot.image_url}
                                  alt={slot.title}
                                  className="w-full h-full object-cover"
                                />
                                {isCurrentlySlottedHere && (
                                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-[#ff6b00] text-white text-[10px] font-black uppercase shadow">
                                    Current
                                  </span>
                                )}
                              </div>
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1" title={slot.title}>
                                {slot.title || 'Untitled Ad'}
                              </h4>
                              {slot.redirect_url && (
                                <p className="text-[10px] text-slate-400 truncate">
                                  {slot.redirect_url}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSlotExistingAd(slot.id, targetSlotEventIndex)}
                              className={`w-full py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer select-none ${
                                isCurrentlySlottedHere
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[#ff6b00] hover:bg-[#e05d00] text-white shadow-xs'
                              }`}
                            >
                              {isCurrentlySlottedHere ? '✓ Already Slotted Here' : 'Slot This Ad Here'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              ) : (
                /* Tab 2: Upload & Create New Ad */
                <form onSubmit={handleCreateAndSlotAd} className="space-y-4">
                  {slotAdError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">error</span>
                      <span>{slotAdError}</span>
                    </div>
                  )}

                  {/* Ad Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                      Ad Campaign Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Campus Fest 2026 Title Sponsorship"
                      value={slotAdName}
                      onChange={(e) => setSlotAdName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-[#ff6b00] focus:outline-hidden"
                    />
                  </div>

                  {/* Picture Upload with 16:9 Guidance */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                        Ad Picture <span className="text-rose-500">*</span>
                      </label>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/50 text-[#ff6b00] border border-orange-200 dark:border-orange-800 text-[10px] font-extrabold tracking-wide">
                        <span className="material-symbols-outlined text-[11px]">aspect_ratio</span>
                        Best size: 1920 x 1080 (16:9)
                      </span>
                    </div>

                    <input
                      type="file"
                      ref={slotFileInputRef}
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (!f.type.startsWith('image/')) {
                          setSlotAdError('Please select a valid image file.');
                          return;
                        }
                        setSlotAdError(null);
                        setSlotAdImageFile(f);
                        const prev = URL.createObjectURL(f);
                        setSlotAdImagePreview(prev);

                        const img = new Image();
                        img.onload = () => {
                          const ratio = img.naturalWidth / img.naturalHeight;
                          if (ratio < 1.4 || ratio > 2.1) {
                            setSlotAdAspectNotice(`Selected image is ${img.naturalWidth}x${img.naturalHeight} (${ratio.toFixed(2)}:1). 16:9 (1920x1080) is recommended.`);
                          } else {
                            setSlotAdAspectNotice(null);
                          }
                        };
                        img.src = prev;
                      }}
                    />

                    <div
                      onClick={() => slotFileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                        slotAdImagePreview
                          ? 'border-[#ff6b00]/50 bg-orange-500/5'
                          : 'border-slate-300 dark:border-zinc-700 hover:border-[#ff6b00] hover:bg-slate-50 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      {slotAdImagePreview ? (
                        <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black/40">
                          <img src={slotAdImagePreview} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="px-3 py-1.5 rounded-lg bg-white/90 text-slate-900 text-xs font-bold shadow">
                              Change Picture
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-5 flex flex-col items-center justify-center gap-1.5">
                          <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-950/60 text-[#ff6b00] flex items-center justify-center">
                            <span className="material-symbols-outlined text-xl">cloud_upload</span>
                          </div>
                          <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                            Click to select ad picture
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Uploads to Cloudflare R2 • 1920x1080 WebP recommended
                          </p>
                        </div>
                      )}
                    </div>

                    {slotAdAspectNotice && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 font-medium">
                        {slotAdAspectNotice}
                      </p>
                    )}
                  </div>

                  {/* Destination Link */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                      Destination Link
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                        link
                      </span>
                      <input
                        type="url"
                        placeholder="https://sponsor.com/fest-offer"
                        value={slotAdLink}
                        onChange={(e) => setSlotAdLink(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-[#ff6b00] focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={slotAdUploading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#e05d00] hover:from-[#e05d00] hover:to-[#c45100] text-white text-xs font-extrabold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {slotAdUploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>{slotAdUploadStep || 'Uploading to Cloudflare R2...'}</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">add_circle</span>
                          <span>Upload, Create & Slot Ad Here</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────
          Modal 2: General Add New Ad Modal
          ──────────────────────────────────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-[#1c1c1e] rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-500">add_photo_alternate</span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Add New Hero Carousel Ad</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isUploading) setIsAddModalOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateAd} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Ad Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Ad Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer Tech Fest 2026 Sponsorship"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-primary-500 focus:outline-hidden"
                />
              </div>

              {/* 2. Image Upload with Best Size Guidance */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Ad Picture <span className="text-rose-500">*</span>
                  </label>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 text-[10px] font-extrabold tracking-wide">
                    <span className="material-symbols-outlined text-[11px]">aspect_ratio</span>
                    Best size: 1920 x 1080 (16:9 ratio)
                  </span>
                </div>

                <input
                  type="file"
                  ref={modalFileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleModalImageSelect(f);
                  }}
                />

                <div
                  onClick={() => modalFileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                    newImagePreview
                      ? 'border-primary-500/50 bg-primary-500/5'
                      : 'border-slate-300 dark:border-zinc-700 hover:border-primary-500 hover:bg-slate-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  {newImagePreview ? (
                    <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black/40">
                      <img src={newImagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <span className="px-3 py-1.5 rounded-lg bg-white/90 text-slate-900 text-xs font-bold shadow">
                          Change Picture
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-primary-50 dark:bg-primary-950/60 text-primary-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                        Click to select ad picture
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        PNG, JPG, or WebP up to 15MB • Uploads to Cloudflare R2
                      </p>
                    </div>
                  )}
                </div>

                {aspectNotice && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 font-medium">
                    {aspectNotice}
                  </p>
                )}
              </div>

              {/* 3. Link */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Destination Link
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    link
                  </span>
                  <input
                    type="url"
                    placeholder="https://sponsorwebsite.com/event"
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-primary-500 focus:outline-hidden"
                  />
                </div>
                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                  Students will be redirected to this URL upon clicking the carousel ad banner.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{uploadProgress || 'Saving...'}</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">check</span>
                      <span>Save Ad</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
