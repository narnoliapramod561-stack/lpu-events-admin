import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { uploadAndOptimizeImage, getOptimizedImage } from '@lpu-events/shared';
import { 
  Sparkles, 
  Upload, 
  Image as ImageIcon, 
  RotateCcw, 
  X, 
  ExternalLink, 
  Plus 
} from 'lucide-react';

export const AdvertisementsPanel: React.FC = () => {
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'active' | 'scheduled' | 'ended'>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states with persistent localStorage storage so window switching / sliding never loses data
  const [showCreateModal, setShowCreateModal] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lpu_ad_create_modal_open') === 'true';
    } catch {
      return false;
    }
  });

  const [name, setName] = useState<string>(() => {
    try {
      return localStorage.getItem('lpu_ad_draft_name') || '';
    } catch {
      return '';
    }
  });

  const [redirectUrl, setRedirectUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('lpu_ad_draft_url') || '';
    } catch {
      return '';
    }
  });

  const [imageUrl, setImageUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('lpu_ad_draft_image') || '';
    } catch {
      return '';
    }
  });

  const [startAt, setStartAt] = useState<string>(() => {
    try {
      return localStorage.getItem('lpu_ad_draft_start') || '';
    } catch {
      return '';
    }
  });

  const [endAt, setEndAt] = useState<string>(() => {
    try {
      return localStorage.getItem('lpu_ad_draft_end') || '';
    } catch {
      return '';
    }
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Auto-sync form changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('lpu_ad_create_modal_open', String(showCreateModal));
      localStorage.setItem('lpu_ad_draft_name', name);
      localStorage.setItem('lpu_ad_draft_url', redirectUrl);
      localStorage.setItem('lpu_ad_draft_image', imageUrl);
      localStorage.setItem('lpu_ad_draft_start', startAt);
      localStorage.setItem('lpu_ad_draft_end', endAt);
    } catch (e) {
      console.warn('Storage sync failed', e);
    }
  }, [showCreateModal, name, redirectUrl, imageUrl, startAt, endAt]);

  const clearDraft = () => {
    setName('');
    setRedirectUrl('');
    setImageUrl('');
    setStartAt('');
    setEndAt('');
    try {
      localStorage.removeItem('lpu_ad_draft_name');
      localStorage.removeItem('lpu_ad_draft_url');
      localStorage.removeItem('lpu_ad_draft_image');
      localStorage.removeItem('lpu_ad_draft_start');
      localStorage.removeItem('lpu_ad_draft_end');
      localStorage.removeItem('lpu_ad_create_modal_open');
    } catch {}
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchAds = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('advertisements')
        .select('id, name, media_id, redirect_url, start_at, end_at, status, created_at, updated_at, media_assets(id, object_key)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAds(data || []);
    } catch (err: any) {
      console.error('Failed to load advertisements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, []);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    try {
      const result = await uploadAndOptimizeImage({
        supabase,
        file,
        context: 'advertisement'
      });
      setImageUrl(result.dataUrl || result.publicUrl);
    } catch (err: any) {
      console.error('Ad image upload error:', err);
      setFormError('Image upload failed: ' + (err.message || 'Upload failed.'));
      setImageUrl('');
      setSelectedFile(null);
    }
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !redirectUrl.trim() || !startAt || !endAt) {
      setFormError('Please complete all required fields.');
      return;
    }
    if (new Date(endAt) <= new Date(startAt)) {
      setFormError('End date must be after start date.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Not authenticated.');

      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      const adminId = adminRow?.id;
      if (!adminId) throw new Error('Admin profile not found.');

      let mediaAssetId: string | null = null;

      if (selectedFile) {
        const optResult = await uploadAndOptimizeImage({
          supabase,
          file: selectedFile,
          context: 'advertisement',
        });
        mediaAssetId = optResult.mediaId;
      } else {
        // 1. Create or resolve media asset for the ad banner
        const bannerKey = imageUrl.trim() || `ads/${name.trim().toLowerCase().replace(/\s+/g, '_')}.png`;
        const { data: mediaAsset, error: mediaErr } = await supabase
          .from('media_assets')
          .insert({
            bucket: 'media',
            object_key: bannerKey,
            media_type: 'ADVERTISEMENT',
            mime_type: 'image/webp',
            file_size_bytes: 2048,
            status: 'READY',
            created_by: adminId
          })
          .select('id')
          .single();

        if (mediaErr) throw mediaErr;
        mediaAssetId = mediaAsset.id;
      }

      // 2. Insert into advertisements table
      const { error } = await supabase.from('advertisements').insert({
        name: name.trim(),
        media_id: mediaAssetId,
        redirect_url: redirectUrl.trim(),
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        status: 'active',
        created_by: adminId,
        updated_by: adminId
      });

      if (error) throw error;

      showToast(`Advertisement "${name}" published successfully!`);
      clearDraft();
      setSelectedFile(null);
      setShowCreateModal(false);
      await fetchAds();
    } catch (err: any) {
      console.error('Failed to create ad:', err);
      setFormError(err.message || 'Failed to create advertisement.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (adId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const { error } = await supabase
        .from('advertisements')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', adId);
      if (error) throw error;
      showToast(`Advertisement status updated to ${nextStatus}.`);
      await fetchAds();
    } catch (err: any) {
      console.error('Failed to update ad status:', err);
      alert('Failed to update status: ' + err.message);
    }
  };

  const deleteAd = async (adId: string, adName: string) => {
    if (!confirm(`Are you sure you want to delete advertisement "${adName}"?`)) return;
    try {
      const { error } = await supabase.from('advertisements').delete().eq('id', adId);
      if (error) throw error;
      showToast('Advertisement deleted.');
      await fetchAds();
    } catch (err: any) {
      console.error('Failed to delete ad:', err);
      alert('Failed to delete ad: ' + err.message);
    }
  };

  const getAdBannerUrl = (ad: any) => {
    return getOptimizedImage(ad, 'advertisement');
  };

  const now = new Date();

  const filteredAds = ads.filter((ad) => {
    const start = new Date(ad.start_at);
    const end = new Date(ad.end_at);
    const isAdActive = ad.status === 'active' && start <= now && end >= now;
    const isAdScheduled = start > now;
    const isAdEnded = end < now;

    if (filter === 'active' && !isAdActive) return false;
    if (filter === 'scheduled' && !isAdScheduled) return false;
    if (filter === 'ended' && !isAdEnded) return false;

    return true;
  });

  return (
    <div className="space-y-6 select-text animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#261812] text-white px-4 py-2.5 rounded-xl shadow-xl border border-[#ff6b00]/40 flex items-center gap-2 text-sm font-semibold animate-bounce">
          <span className="material-symbols-outlined text-[18px] text-[#ff6b00]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
              Commercial Engine
            </span>
            <span className="text-xs text-[#5a4136] dark:text-[#ffb693]">Campaign Moderation</span>
          </div>
          <h2 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[32px] text-[#ff6b00]">campaign</span>
            <span>Platform Advertisements</span>
          </h2>
          <p className="text-sm text-[#5a4136] dark:text-[#ffb693] mt-1">
            Create, moderate, and track sponsored banners and promotional campaigns across the university platform.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(!showCreateModal)}
          className="bg-[#ff6b00] hover:bg-[#a04100] text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
        >
          {showCreateModal ? <X size={16} /> : <Plus size={16} />}
          <span>{showCreateModal ? 'Close Form' : 'Create Advertisement'}</span>
        </button>
      </div>

      {/* Create Ad Form Embedded Drawer */}
      {showCreateModal && (
        <div className="bg-white dark:bg-[#261812] rounded-2xl border-2 border-[#ff6b00]/30 dark:border-[#ff6b00]/40 p-6 shadow-xl animate-fadeIn">
          <div className="flex justify-between items-center pb-4 border-b border-[#e2bfb0] dark:border-[#5a4136] mb-5">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-[#ff6b00]" />
              <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                Create Sponsored Ad Banner
              </h3>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                Persistent Form (Saved on Switch)
              </span>
            </div>
            <button
              type="button"
              onClick={clearDraft}
              className="text-xs text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00] flex items-center gap-1 cursor-pointer font-semibold"
              title="Reset all fields"
            >
              <RotateCcw size={13} />
              <span>Reset Draft</span>
            </button>
          </div>

          {formError && (
            <div className="p-3 mb-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 text-red-600 text-xs font-semibold">
              {formError}
            </div>
          )}

          <form onSubmit={handleCreateAd} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Form Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-1">
                    Campaign Title *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Student Placement Orientation Drive"
                    required
                    className="w-full p-3 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ff6b00] text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-1">
                    Destination URL *
                  </label>
                  <input
                    type="url"
                    value={redirectUrl}
                    onChange={(e) => setRedirectUrl(e.target.value)}
                    placeholder="https://placements.lpu.in"
                    required
                    className="w-full p-3 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ff6b00] text-xs font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-1">
                      Start Date *
                    </label>
                    <input
                      type="datetime-local"
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                      required
                      className="w-full p-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ff6b00] text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-1">
                      End Date *
                    </label>
                    <input
                      type="datetime-local"
                      value={endAt}
                      onChange={(e) => setEndAt(e.target.value)}
                      required
                      className="w-full p-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ff6b00] text-xs"
                    />
                  </div>
                </div>

                {/* Banner Image upload only */}
                <div>
                  <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-2">
                    Ad Banner Image *
                  </label>

                  <div className="bg-[#fff8f6] dark:bg-[#1a120e] p-5 rounded-2xl border-2 border-dashed border-[#e2bfb0] dark:border-[#5a4136] text-center hover:border-[#ff6b00] transition-colors">
                    <input
                      type="file"
                      id="ad-file-upload"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label htmlFor="ad-file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-[#fee3d8] dark:bg-[#3d2d26] flex items-center justify-center text-[#ff6b00]">
                        <Upload size={22} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#261812] dark:text-[#ffede6] block">
                          {imageUrl ? 'Replace / Upload Another Image' : 'Click or Drag & Drop to Upload Banner'}
                        </span>
                        <span className="text-[11px] text-[#5a4136] dark:text-[#ffb693] mt-0.5 block">
                          Supports PNG, JPG, WebP (High Resolution, Max 5MB)
                        </span>
                      </div>
                    </label>

                    {imageUrl && (
                      <div className="mt-3 pt-3 border-t border-[#e2bfb0]/60 dark:border-[#5a4136]/60 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Banner image loaded
                        </span>
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                        >
                          Remove Image
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Live Ad Preview */}
              <div>
                <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-2">
                  Live Banner Preview
                </label>
                <div className="bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-4 flex flex-col items-center justify-center text-center min-h-[260px]">
                  {imageUrl ? (
                    <div className="w-full space-y-3">
                      <div className="w-full h-36 bg-white dark:bg-[#261812] rounded-xl overflow-hidden border border-[#e2bfb0] dark:border-[#5a4136] relative shadow-sm">
                        <img src={imageUrl} alt="Ad Banner Preview" className="w-full h-full object-cover" />
                        <span className="absolute top-2 left-2 text-[9px] font-black text-white bg-[#ff6b00] px-2 py-0.5 rounded-full uppercase">
                          Sponsored
                        </span>
                      </div>
                      <div className="text-left">
                        <h4 className="font-extrabold text-sm text-[#261812] dark:text-[#ffede6]">
                          {name || 'Campaign Promo Title'}
                        </h4>
                        <p className="text-xs text-[#ff6b00] font-semibold mt-0.5 line-clamp-1">
                          {redirectUrl || 'https://brand-destination.com'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[#5a4136] dark:text-[#ffb693] space-y-2">
                      <ImageIcon size={36} className="mx-auto opacity-40 text-[#ff6b00]" />
                      <p className="text-xs font-semibold">Select or upload a banner image to preview ad appearance.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e2bfb0] dark:border-[#5a4136]">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-bold text-[#5a4136] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !name.trim() || !redirectUrl.trim()}
                className="px-6 py-2.5 bg-[#ff6b00] hover:bg-[#a04100] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>Publish Campaign</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="bg-white dark:bg-[#261812] rounded-2xl border border-[#e2bfb0] dark:border-[#5a4136] p-4 flex flex-wrap gap-4 items-center justify-between shadow-sm">
        <div className="flex gap-2">
          {(['ALL', 'active', 'scheduled', 'ended'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filter === tab
                  ? 'bg-[#fee3d8] dark:bg-[#3d2d26] text-[#ff6b00] border border-[#ff6b00]/30 shadow-xs'
                  : 'bg-white dark:bg-[#1a120e] text-[#5a4136] dark:text-[#ffb693] border border-[#e2bfb0] dark:border-[#5a4136] hover:border-[#ff6b00]'
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        <span className="text-xs font-bold text-[#5a4136] dark:text-[#ffb693]">
          Total Campaigns: <strong className="text-[#ff6b00]">{filteredAds.length}</strong>
        </span>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-[#261812] rounded-2xl border border-[#e2bfb0] dark:border-[#5a4136] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-[#5a4136] dark:text-[#ffb693] flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-[#ff6b00] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold">Loading advertisements...</p>
          </div>
        ) : filteredAds.length === 0 ? (
          <div className="p-16 text-center text-[#5a4136] dark:text-[#ffb693] flex flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined text-[48px] text-[#ff6b00]">ads_click</span>
            <h3 className="text-lg font-bold text-[#261812] dark:text-[#ffede6]">No Advertisements Found</h3>
            <p className="text-xs">No promotional campaigns match your selected filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#fff1eb]/70 dark:bg-[#1a120e] border-b border-[#e2bfb0] dark:border-[#5a4136] text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">
                  <th className="py-3.5 px-6">Campaign & Banner</th>
                  <th className="py-3.5 px-6">Redirect URL</th>
                  <th className="py-3.5 px-6">Timeline Duration</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2bfb0]/60 dark:divide-[#5a4136]/60 text-xs">
                {filteredAds.map((ad) => {
                  const start = new Date(ad.start_at);
                  const end = new Date(ad.end_at);
                  const isActive = ad.status === 'active' && start <= now && end >= now;
                  const statusLabel = ad.status === 'inactive'
                    ? 'Inactive'
                    : end < now
                      ? 'Expired'
                      : start > now
                        ? 'Scheduled'
                        : 'Active';
                  const bannerUrl = getAdBannerUrl(ad);

                  return (
                    <tr key={ad.id} className="hover:bg-[#fff8f6] dark:hover:bg-[#3d2d26]/30 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-10 rounded-lg overflow-hidden border border-[#e2bfb0] flex-shrink-0">
                            <img src={bannerUrl} alt={ad.name} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <div className="font-bold text-sm text-[#261812] dark:text-[#ffede6]">{ad.name}</div>
                            <div className="text-[11px] text-[#5a4136] dark:text-[#ffb693]">ID: {ad.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <a
                          href={ad.redirect_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#ff6b00] hover:underline flex items-center gap-1 font-medium"
                        >
                          <span className="line-clamp-1 max-w-[200px]">{ad.redirect_url}</span>
                          <ExternalLink size={12} />
                        </a>
                      </td>

                      <td className="py-4 px-6">
                        <div className="font-semibold text-[#261812] dark:text-[#ffede6]">
                          {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} &rarr;{' '}
                          {end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="text-[11px] text-[#5a4136] dark:text-[#ffb693]">
                          {end >= now ? `${Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days left` : 'Expired'}
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        {isActive ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px] flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-bold text-[10px] uppercase">
                            {statusLabel}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => toggleStatus(ad.id, ad.status)}
                            className="p-1.5 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] text-[#5a4136] hover:text-[#ff6b00] hover:border-[#ff6b00] transition-colors cursor-pointer"
                            title={ad.status === 'active' ? 'Deactivate Campaign' : 'Activate Campaign'}
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {ad.status === 'active' ? 'pause' : 'play_arrow'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAd(ad.id, ad.name)}
                            className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                            title="Delete Advertisement"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
