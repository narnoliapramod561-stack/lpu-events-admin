import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { getEventImage, uploadAndOptimizeImage } from '../../utils/images';
import { 
  History, 
  Plus, 
  Trash2, 
  Upload, 
  AlertCircle, 
  X, 
  Sparkles, 
  Building2,
  CheckCircle2,
  Eye,
  EyeOff
} from 'lucide-react';
import { EmptyState } from '../shell/EmptyState';

interface EventMemoryItem {
  id: string;
  event_id: string | null;
  title: string;
  description: string;
  cover_media_id: string;
  status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
  created_at: string;
  events?: {
    id: string;
    name: string;
    description: string;
    venue_name: string;
    start_at: string;
    end_at: string;
    banner_media_id: string | null;
    organizations?: { name: string } | null;
    categories?: { name: string } | null;
  } | null;
  media_assets?: {
    id: string;
    object_key: string;
  } | null;
}

export const PastEventCarouselPanel: React.FC = () => {
  const [memories, setMemories] = useState<EventMemoryItem[]>([]);
  const [pastEvents, setPastEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Drawer / Add states with localStorage persistence
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lpu_past_carousel_drawer_open') === 'true';
    } catch {
      return false;
    }
  });

  const [memoryTitle, setMemoryTitle] = useState<string>(() => {
    try {
      return localStorage.getItem('lpu_past_carousel_title') || '';
    } catch {
      return '';
    }
  });

  const [memoryCaption, setMemoryCaption] = useState<string>(() => {
    try {
      return localStorage.getItem('lpu_past_carousel_caption') || '';
    } catch {
      return '';
    }
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [memoryImageUrl, setMemoryImageUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('lpu_past_carousel_banner') || '';
    } catch {
      return '';
    }
  });

  const [selectedPastEventId, setSelectedPastEventId] = useState<string>(() => {
    try {
      return localStorage.getItem('lpu_past_carousel_selected_id') || '';
    } catch {
      return '';
    }
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync drawer draft to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('lpu_past_carousel_drawer_open', String(isDrawerOpen));
      localStorage.setItem('lpu_past_carousel_title', memoryTitle);
      localStorage.setItem('lpu_past_carousel_caption', memoryCaption);
      localStorage.setItem('lpu_past_carousel_banner', memoryImageUrl);
      localStorage.setItem('lpu_past_carousel_selected_id', selectedPastEventId);
    } catch (e) {
      console.warn('Storage sync error', e);
    }
  }, [isDrawerOpen, memoryTitle, memoryCaption, memoryImageUrl, selectedPastEventId]);

  const clearDraft = () => {
    setSelectedFile(null);
    setMemoryTitle('');
    setMemoryCaption('');
    setMemoryImageUrl('');
    setSelectedPastEventId('');
    try {
      localStorage.removeItem('lpu_past_carousel_title');
      localStorage.removeItem('lpu_past_carousel_caption');
      localStorage.removeItem('lpu_past_carousel_banner');
      localStorage.removeItem('lpu_past_carousel_selected_id');
      localStorage.removeItem('lpu_past_carousel_drawer_open');
    } catch {}
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const nowIso = new Date().toISOString();

      const [memoriesRes, eventsRes] = await Promise.all([
        supabase
          .from('event_memories')
          .select('*, events(*, organizations(name), categories(name)), media_assets:cover_media_id(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('events')
          .select('*, organizations(name), categories(name)')
          .in('status', ['PUBLISHED', 'COMPLETED'])
          .or(`status.eq.COMPLETED,end_at.lt.${nowIso}`)
          .order('end_at', { ascending: false })
      ]);

      if (memoriesRes.error) throw memoriesRes.error;
      const validMemories = (memoriesRes.data || []).filter(
        (m) =>
          !m.events ||
          (m.events.status !== 'CANCELLED' &&
            m.events.status !== 'DELETED' &&
            !m.events.deleted_at)
      );
      setMemories(validMemories);

      if (eventsRes.error) throw eventsRes.error;
      const validPastEvents = (eventsRes.data || []).filter(
        (e) =>
          e.status !== 'CANCELLED' &&
          e.status !== 'DELETED' &&
          !e.deleted_at &&
          (e.status === 'COMPLETED' || new Date(e.end_at) < new Date(nowIso))
      );
      setPastEvents(validPastEvents);
    } catch (err: any) {
      console.error('Failed to load past carousel data:', err);
      setError('Failed to load data: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSelectedFile(file);

    try {
      const result = await uploadAndOptimizeImage({
        supabase,
        file,
        context: 'memory'
      });
      setMemoryImageUrl(result.dataUrl || result.publicUrl);
    } catch (err: any) {
      console.error('Image upload error:', err);
      setError('Image upload failed: ' + (err.message || 'Upload failed.'));
      setMemoryImageUrl('');
      setSelectedFile(null);
    }
  };

  const handleSelectLinkedEvent = (eventId: string) => {
    setSelectedPastEventId(eventId);
    const evt = pastEvents.find(e => e.id === eventId);
    if (evt) {
      if (!memoryTitle.trim()) setMemoryTitle(evt.name);
      if (!memoryCaption.trim() && evt.description) setMemoryCaption(evt.description);
      if (!memoryImageUrl.trim()) setMemoryImageUrl(getEventImage(evt, 'memory'));
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoryTitle.trim()) {
      alert('Please provide a title for the past event memory.');
      return;
    }

    if (!memoryImageUrl.trim() && !selectedFile) {
      alert('Please upload an image or provide an image URL for this past event memory.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const user = (await supabase.auth.getUser()).data.user;
      let adminId = '05680f86-a752-4792-9051-d091414d8e9f';
      if (user) {
        const { data: adminRow } = await supabase
          .from('admin_users')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        if (adminRow?.id) adminId = adminRow.id;
      }

      let mediaAssetId: string | null = null;

      // If a file was selected from user disk, process & optimize with memory context
      if (selectedFile) {
        const optResult = await uploadAndOptimizeImage({
          supabase,
          file: selectedFile,
          context: 'memory',
          adminUserId: adminId
        });
        mediaAssetId = optResult.mediaId;
      } else {
        // Direct URL or pre-existing key: create media asset ticket
        const finalObjectKey = memoryImageUrl.trim();
        const { data: mediaAsset, error: mediaErr } = await supabase
          .from('media_assets')
          .insert({
            bucket: 'media',
            object_key: finalObjectKey,
            media_type: 'MEMORY_IMAGE',
            mime_type: 'image/webp',
            file_size_bytes: 2048,
            status: 'READY',
            created_by: adminId,
          })
          .select('id')
          .single();

        if (mediaErr || !mediaAsset) {
          throw new Error('Failed to save image: ' + (mediaErr?.message || 'Unknown media error'));
        }
        mediaAssetId = mediaAsset.id;
      }

      // 2. Insert into event_memories
      const finalTitle = memoryTitle.trim();
      const finalDesc = memoryCaption.trim() || 'Past event highlight memory.';

      const { error: insertErr } = await supabase.from('event_memories').insert({
        event_id: selectedPastEventId || null,
        title: finalTitle,
        description: finalDesc,
        cover_media_id: mediaAssetId,
        status: 'PUBLISHED',
        created_by: adminId,
        updated_by: adminId,
      });

      if (insertErr) throw insertErr;

      showToast(`Added "${finalTitle}" to Past Event Memories!`);
      clearDraft();
      setIsDrawerOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error('Failed to add past event memory:', err);
      setError('Failed to add memory: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const toggleMemoryStatus = async (id: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
      const { error: err } = await supabase
        .from('event_memories')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (err) throw err;
      showToast(`Memory ${nextStatus === 'PUBLISHED' ? 'published' : 'moved to draft'}.`);
      await fetchData();
    } catch (err: any) {
      console.error('Toggle status failed:', err);
      alert('Toggle failed: ' + err.message);
    }
  };

  const deleteMemory = async (id: string, title: string) => {
    if (!confirm(`Remove "${title}" from Past Event Memories?`)) return;
    try {
      const { error: err } = await supabase.from('event_memories').delete().eq('id', id);
      if (err) throw err;
      showToast('Event memory removed.');
      await fetchData();
    } catch (err: any) {
      console.error('Delete failed:', err);
      alert('Delete failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 select-text animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#261812] text-white px-4 py-2.5 rounded-xl shadow-xl border border-[#ff6b00]/40 flex items-center gap-2 text-sm font-semibold animate-bounce">
          <CheckCircle2 size={18} className="text-[#ff6b00]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
              Past Event Memories
            </span>
            <span className="text-xs text-[#5a4136] dark:text-[#ffb693]">
              {memories.length} Memory Item{memories.length !== 1 ? 's' : ''}
            </span>
          </div>
          <h2 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2.5">
            <History size={28} className="text-[#ff6b00]" />
            <span>Past Event Memories</span>
          </h2>
          <p className="text-sm text-[#5a4136] dark:text-[#ffb693] mt-1">
            Add past event memories with a photo and title. Items added here automatically display in the Past Events Carousel and are available in the Hero Carousel manager.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className="bg-[#ff6b00] hover:bg-[#a04100] text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
        >
          {isDrawerOpen ? <X size={16} /> : <Plus size={16} />}
          <span>{isDrawerOpen ? 'Close Form' : '+ Add Memory'}</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 text-red-600 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Add Memory Form */}
      {isDrawerOpen && (
        <div className="bg-white dark:bg-[#261812] rounded-2xl border-2 border-[#ff6b00]/30 dark:border-[#ff6b00]/40 p-6 shadow-xl animate-fadeIn">
          <div className="flex justify-between items-center pb-4 border-b border-[#e2bfb0] dark:border-[#5a4136] mb-5">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-[#ff6b00]" />
              <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                Add Past Event Memory
              </h3>
              <span className="text-[10px] font-bold text-cyan-700 bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-300 px-2 py-0.5 rounded-full">
                Title & Photo
              </span>
            </div>
            <button
              type="button"
              onClick={clearDraft}
              className="text-xs text-[#5a4136] dark:text-[#ffb693] hover:text-[#ff6b00] flex items-center gap-1 cursor-pointer font-semibold"
            >
              Reset Draft
            </button>
          </div>

          <form onSubmit={handleAddMemory} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Form Fields */}
              <div className="space-y-4">
                {/* 1. Memory Title */}
                <div>
                  <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-1.5">
                    1. Event Memory Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={memoryTitle}
                    onChange={(e) => setMemoryTitle(e.target.value)}
                    placeholder="e.g. One World Cultural Fest Highlights 2025"
                    className="w-full p-3 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ff6b00] text-sm font-bold placeholder:font-normal"
                  />
                </div>

                {/* 2. Image Upload / URL */}
                <div>
                  <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-2">
                    2. Memory Photo / Image *
                  </label>

                  {/* Upload Box */}
                  <div className="bg-[#fff8f6] dark:bg-[#1a120e] p-4 rounded-xl border-2 border-dashed border-[#e2bfb0] dark:border-[#5a4136] text-center hover:border-[#ff6b00] transition-colors mb-2.5">
                    <input
                      type="file"
                      id="past-memory-photo-upload"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="past-memory-photo-upload"
                      className="cursor-pointer flex flex-col items-center gap-1.5"
                    >
                      <Upload size={22} className="text-[#ff6b00]" />
                      <span className="text-xs font-bold text-[#261812] dark:text-[#ffede6]">
                        {memoryImageUrl ? 'Change Uploaded Photo' : 'Upload Memory Photo (PNG, JPG, WebP)'}
                      </span>
                      <span className="text-[10px] text-[#5a4136] dark:text-[#ffb693]">
                        Max 5MB file size
                      </span>
                    </label>
                  </div>

                  {/* Or Direct Image URL */}
                  <div>
                    <input
                      type="text"
                      value={memoryImageUrl}
                      onChange={(e) => setMemoryImageUrl(e.target.value)}
                      placeholder="Or paste image URL (https://...)"
                      className="w-full p-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ff6b00] text-xs"
                    />
                  </div>

                  {memoryImageUrl && (
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        ✓ Image selected
                      </span>
                      <button
                        type="button"
                        onClick={() => setMemoryImageUrl('')}
                        className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                      >
                        Remove Photo
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Optional Description / Caption */}
                <div>
                  <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-1.5">
                    3. Recap Note / Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={memoryCaption}
                    onChange={(e) => setMemoryCaption(e.target.value)}
                    placeholder="Short description or memorable highlights from this event..."
                    className="w-full p-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ff6b00] text-xs"
                  />
                </div>

                {/* 4. Optional Link to Past Event */}
                <div>
                  <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-1.5">
                    4. Link to Past Event Record (Optional)
                  </label>
                  <select
                    value={selectedPastEventId}
                    onChange={(e) => handleSelectLinkedEvent(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ff6b00] text-xs font-medium"
                  >
                    <option value="">-- Standalone Memory (No linked event) --</option>
                    {pastEvents.map((evt) => (
                      <option key={evt.id} value={evt.id}>
                        {evt.name} ({evt.organizations?.name || 'Event'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right Column: Live Card Preview */}
              <div>
                <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-2">
                  Live Carousel Card Preview
                </label>

                <div className="bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-4 flex flex-col items-center justify-center min-h-[300px]">
                  {memoryImageUrl || memoryTitle ? (
                    <div className="w-full space-y-3">
                      {/* Hero Carousel Past Event Slide Preview */}
                      <div className="w-full h-56 rounded-2xl overflow-hidden relative shadow-lg border border-[#e2bfb0] dark:border-[#5a4136] group">
                        <img
                          src={memoryImageUrl || 'https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=800&auto=format&fit=crop'}
                          alt={memoryTitle || 'Preview'}
                          className="w-full h-full object-cover"
                        />
                        {/* Cinematic gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent flex flex-col justify-end p-5 text-white">
                          <h4 className="font-black text-xl line-clamp-2 drop-shadow-md">
                            {memoryTitle || 'Event Memory Title'}
                          </h4>
                          {memoryCaption && (
                            <p className="text-xs text-gray-200 line-clamp-1 mt-1 opacity-90">
                              {memoryCaption}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="p-3 bg-white dark:bg-[#261812] rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] text-xs">
                        <div className="font-bold text-[#261812] dark:text-[#ffede6] mb-1">
                          Slide Display Format:
                        </div>
                        <p className="text-[11px] text-[#5a4136] dark:text-[#ffb693]">
                          ✓ Renders as a full-bleed photo banner with the event name at the bottom in the Student Portal Hero Carousel.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[#5a4136] dark:text-[#ffb693] text-center space-y-2">
                      <History size={36} className="mx-auto opacity-40 text-[#ff6b00]" />
                      <p className="text-xs font-semibold">Enter a title and upload a photo to preview the memory slide.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e2bfb0] dark:border-[#5a4136]">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-bold text-[#5a4136] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !memoryTitle.trim() || !memoryImageUrl.trim()}
                className="px-6 py-2.5 bg-[#ff6b00] hover:bg-[#a04100] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>Save Past Event Memory</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Table: Curated Past Event Memories */}
      <div className="bg-white dark:bg-[#261812] rounded-2xl border border-[#e2bfb0] dark:border-[#5a4136] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#e2bfb0] dark:border-[#5a4136] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
              Past Event Memories List
            </h3>
            <span className="px-2.5 py-0.5 bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 font-extrabold text-[11px] rounded-full">
              {memories.length} Memories Active
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-[#5a4136] dark:text-[#ffb693] flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-[#ff6b00] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold">Loading past event memories...</p>
          </div>
        ) : memories.length === 0 ? (
          <div className="p-16 text-center">
            <EmptyState
              title="No Past Event Memories Yet"
              description="Click '+ Add Memory' to create photo memories and highlights for the Past Events Carousel."
              icon={<History size={26} />}
              actionLabel="+ Add Memory"
              onAction={() => setIsDrawerOpen(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#fff1eb]/70 dark:bg-[#1a120e] border-b border-[#e2bfb0] dark:border-[#5a4136] text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">
                  <th className="py-3.5 px-6">#</th>
                  <th className="py-3.5 px-6">Photo Banner</th>
                  <th className="py-3.5 px-6">Memory Title & Caption</th>
                  <th className="py-3.5 px-6">Linked Event</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2bfb0]/60 dark:divide-[#5a4136]/60 text-xs">
                {memories.map((mem, idx) => {
                  const evt = mem.events;
                  const bannerUrl = getEventImage(mem, 'memory');

                  return (
                    <tr key={mem.id} className="hover:bg-[#fff8f6] dark:hover:bg-[#3d2d26]/30 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-[#ff6b00]">
                        #{idx + 1}
                      </td>

                      <td className="py-4 px-6">
                        <div className="w-24 h-14 rounded-lg overflow-hidden border border-[#e2bfb0] flex-shrink-0 relative">
                          <img 
                            src={bannerUrl} 
                            alt={mem.title} 
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop';
                            }}
                            className="w-full h-full object-cover" 
                          />
                          <span className="absolute bottom-1 left-1 text-[8px] font-black text-white bg-cyan-700/80 px-1 py-0.2 rounded">
                            MEMORY
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <div className="font-bold text-sm text-[#261812] dark:text-[#ffede6]">
                          {mem.title}
                        </div>
                        <p className="text-[11px] text-[#5a4136] dark:text-[#ffb693] line-clamp-1 mt-0.5">
                          {mem.description}
                        </p>
                      </td>

                      <td className="py-4 px-6">
                        <div className="font-semibold text-xs text-[#261812] dark:text-[#ffede6]">
                          {evt?.name || 'Standalone Memory'}
                        </div>
                        <div className="text-[10px] text-[#5a4136] dark:text-[#ffb693] flex items-center gap-2 mt-0.5">
                          {evt?.organizations?.name && (
                            <span className="flex items-center gap-1">
                              <Building2 size={11} className="text-[#ff6b00]" />
                              {evt.organizations.name}
                            </span>
                          )}
                          {evt?.end_at && (
                            <span>Ended {new Date(evt.end_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        {mem.status === 'PUBLISHED' ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px] flex items-center gap-1 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Published
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-bold text-[10px] uppercase">
                            Draft
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleMemoryStatus(mem.id, mem.status)}
                            className="p-1.5 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] text-[#5a4136] hover:text-[#ff6b00] hover:border-[#ff6b00] transition-colors cursor-pointer"
                            title={mem.status === 'PUBLISHED' ? 'Unpublish Memory' : 'Publish Memory'}
                          >
                            {mem.status === 'PUBLISHED' ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMemory(mem.id, mem.title)}
                            className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                            title="Remove Memory"
                          >
                            <Trash2 size={14} />
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
