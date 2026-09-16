import React, { useState, useEffect } from 'react';
import { supabase, lpuClient } from '../../supabase';
import { getEventImage } from '../../utils/images';

export const TrendingEventsPanel: React.FC = () => {
  const [trendingEvents, setTrendingEvents] = useState<any[]>([]);
  const [availableEvents, setAvailableEvents] = useState<any[]>([]);
  const [maxCapacity, setMaxCapacity] = useState<number>(10);
  const [capacityInput, setCapacityInput] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchTrendingData = async () => {
    setLoading(true);
    try {
      const [trendRes, eventsRes, settingRes] = await Promise.all([
        supabase
          .from('trending_events')
          .select('event_id, sort_order, events(id, name, start_at, end_at, status, banner_media_id, media_assets:banner_media_id(id, object_key, bucket), organizations(name), categories(name))')
          .order('sort_order', { ascending: true }),
        supabase
          .from('events')
          .select('id, name, start_at, end_at, status, banner_media_id, media_assets:banner_media_id(id, object_key, bucket), organizations(name), categories(name)')
          .eq('status', 'PUBLISHED')
          .order('start_at', { ascending: true }),
        supabase
          .from('global_settings')
          .select('value')
          .eq('key', 'max_trending_events')
          .maybeSingle()
      ]);

      if (trendRes.error) throw trendRes.error;
      const list = (trendRes.data || []).map((t: any, idx: number) => ({
        event_id: t.event_id,
        sort_order: t.sort_order || idx + 1,
        event: t.events
      }));
      setTrendingEvents(list);

      if (eventsRes.data) {
        setAvailableEvents(eventsRes.data);
      }

      if (settingRes.data && settingRes.data.value !== undefined) {
        const val = typeof settingRes.data.value === 'number' 
          ? settingRes.data.value 
          : parseInt(String(settingRes.data.value), 10);
        if (!isNaN(val) && val > 0) {
          setMaxCapacity(val);
          setCapacityInput(val);
        }
      }
    } catch (err: any) {
      console.error('Failed to load trending events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrendingData();
  }, []);

  const handleDragStart = (index: number) => {
    setDraggedIdx(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    const reordered = [...trendingEvents];
    const [movedItem] = reordered.splice(draggedIdx, 1);
    reordered.splice(index, 0, movedItem);
    const updated = reordered.map((item, i) => ({ ...item, sort_order: i + 1 }));
    setTrendingEvents(updated);
    setDraggedIdx(index);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= trendingEvents.length) return;
    const reordered = [...trendingEvents];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;
    const updated = reordered.map((item, i) => ({ ...item, sort_order: i + 1 }));
    setTrendingEvents(updated);
  };

  const addEventToTrending = async (evt: any) => {
    if (trendingEvents.length >= maxCapacity) {
      alert(`Maximum capacity limit of ${maxCapacity} trending events reached. You can increase the limit in 'Capacity Settings' or remove an existing trending event.`);
      return;
    }
    if (trendingEvents.some((t) => t.event_id === evt.id)) {
      alert('Event is already in the trending list.');
      return;
    }

    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('You must be logged in.');

      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      const adminId = adminRow?.id;
      if (!adminId) throw new Error('Admin user profile not found.');

      const { error } = await supabase.from('trending_events').insert({
        event_id: evt.id,
        sort_order: trendingEvents.length + 1,
        created_by: adminId
      });
      if (error) throw error;
      showToast(`Added "${evt.name}" to Trending!`);
      await fetchTrendingData();
    } catch (err: any) {
      console.error('Failed to add trending event:', err);
      alert('Error adding event: ' + (err.message || 'Unknown error'));
    }
  };

  const removeTrending = async (eventId: string) => {
    try {
      const { error } = await supabase.from('trending_events').delete().eq('event_id', eventId);
      if (error) throw error;
      showToast('Event removed from Trending.');
      await fetchTrendingData();
    } catch (err: any) {
      console.error('Failed to remove trending event:', err);
      alert('Error removing event: ' + err.message);
    }
  };

  const saveOrder = async () => {
    setSaving(true);
    try {
      const updates = trendingEvents.map((t, i) =>
        supabase.from('trending_events').update({ sort_order: i + 1 }).eq('event_id', t.event_id)
      );
      await Promise.all(updates);
      showToast('Trending events order saved successfully!');
      await fetchTrendingData();
    } catch (err: any) {
      console.error('Failed to save trending order:', err);
      alert('Failed to save order: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCapacity = async (newVal: number) => {
    if (isNaN(newVal) || newVal < 1 || newVal > 50) {
      alert('Please enter a valid capacity between 1 and 50.');
      return;
    }
    setSavingCapacity(true);
    try {
      const { data: result, error: rpcErr } = await lpuClient.manageGlobalSetting('upsert', {
        key: 'max_trending_events',
        value: newVal,
        description: 'Maximum number of trending events displayed on student website'
      });

      if (rpcErr) throw rpcErr;
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      if (parsed?.code) throw new Error(parsed.message);

      setMaxCapacity(newVal);
      setCapacityInput(newVal);
      showToast(`Trending events capacity updated to ${newVal}!`);
    } catch (err: any) {
      console.error('Failed to update trending capacity:', err);
      alert('Failed to update capacity: ' + (err.message || 'Error occurred'));
    } finally {
      setSavingCapacity(false);
    }
  };

  const filteredAvailable = availableEvents.filter((evt) => {
    if (trendingEvents.some((t) => t.event_id === evt.id)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        evt.name.toLowerCase().includes(q) ||
        (evt.venue_name && evt.venue_name.toLowerCase().includes(q)) ||
        (evt.organizations?.name && evt.organizations.name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const usagePercent = Math.min(100, Math.round((trendingEvents.length / maxCapacity) * 100));

  return (
    <div className="space-y-8 select-text animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#261812] text-white px-4 py-2.5 rounded-xl shadow-xl border border-[#ff6b00]/40 flex items-center gap-2 text-sm font-semibold animate-bounce">
          <span className="material-symbols-outlined text-[18px] text-[#ff6b00]">local_fire_department</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
              <span>Curated Highlights</span>
            </span>
            <span className="text-xs text-[#5a4136] dark:text-[#ffb693]">Campus Trending Hub Curation</span>
          </div>
          <h1 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[32px] text-[#ff6b00]">local_fire_department</span>
            <span>Trending Events Manager</span>
          </h1>
          <p className="text-sm text-[#5a4136] dark:text-[#ffb693] mt-1">
            Manually curate the events marked as Trending for students. When students click &ldquo;Trending&rdquo; on the student website, these selected events are showcased in priority rank order.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2 bg-[#ffeae1] dark:bg-[#3d2d26] text-[#ff6b00] dark:text-[#ffb693] font-bold text-sm px-5 py-2.5 rounded-full border border-[#e2bfb0] dark:border-[#5a4136] hover:border-[#ff6b00] transition-all cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
            <span>Find & Add Event</span>
          </button>
          <button
            onClick={saveOrder}
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-[#ff6b00] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white font-bold text-sm px-6 py-2.5 rounded-full shadow-md transition-all cursor-pointer"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-[18px]">save</span>
            )}
            <span>Save Order</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Reorderable Trending List */}
        <div className="lg:col-span-8 space-y-4">
          {loading ? (
            <div className="p-16 text-center text-[#5a4136] dark:text-[#ffb693] flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-[#ff6b00] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold">Loading trending events...</p>
            </div>
          ) : trendingEvents.length === 0 ? (
            <div className="bg-white dark:bg-[#261812] rounded-2xl border border-[#e2bfb0] dark:border-[#5a4136] p-12 text-center text-[#5a4136] dark:text-[#ffb693]">
              <span className="material-symbols-outlined text-[48px] text-[#ff6b00] mb-2">local_fire_department</span>
              <h3 className="text-lg font-bold text-[#261812] dark:text-[#ffede6]">No Trending Events Selected</h3>
              <p className="text-xs mt-1">Click &ldquo;Find & Add Event&rdquo; to pick published active events to showcase in the student Trending section.</p>
            </div>
          ) : (
            trendingEvents.map((item, idx) => {
              const evt = item.event;
              if (!evt) return null;
              const bannerUrl = getEventImage(evt, 'event-card');
              const start = new Date(evt.start_at);
              const isOverLimit = idx >= maxCapacity;

              return (
                <div
                  key={evt.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  className={`flex items-center bg-white dark:bg-[#261812] rounded-2xl border p-3 pr-5 shadow-sm hover:border-[#ff6b00] transition-all cursor-grab active:cursor-grabbing group ${
                    isOverLimit 
                      ? 'border-amber-300 dark:border-amber-700 bg-amber-50/20' 
                      : 'border-[#e2bfb0] dark:border-[#5a4136]'
                  }`}
                >
                  <div className="p-2 text-[#5a4136]/50 dark:text-[#ffb693]/50 group-hover:text-[#261812] dark:group-hover:text-[#ffede6]">
                    <span className="material-symbols-outlined text-[20px]">drag_indicator</span>
                  </div>

                  {/* Rank Bubble */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black mr-3 flex-shrink-0 ${
                      idx === 0
                        ? 'bg-gradient-to-tr from-[#ff6b00] to-[#f59e0b] text-white shadow-md ring-2 ring-[#ff6b00]/30'
                        : isOverLimit
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-[#fee3d8] dark:bg-[#3d2d26] text-[#261812] dark:text-[#ffede6]'
                    }`}
                  >
                    #{idx + 1}
                  </div>

                  {/* Thumbnail with Trending Tag */}
                  <div className="w-24 h-16 rounded-xl overflow-hidden flex-shrink-0 relative border border-[#e2bfb0]/60">
                    <img src={bannerUrl} alt={evt.name} className="w-full h-full object-cover" />
                    <span className="absolute top-1 left-1 text-[8px] font-black text-white bg-gradient-to-r from-orange-600 to-amber-500 px-1.5 py-0.5 rounded shadow-xs flex items-center gap-0.5">
                      🔥 #{idx + 1}
                    </span>
                    {isOverLimit && (
                      <span className="absolute bottom-1 right-1 text-[8px] font-bold text-amber-900 bg-amber-300/95 px-1 rounded">
                        EXCEEDS LIMIT
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="ml-4 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[#ff6b00] uppercase">
                        {evt.categories?.name || 'Category'}
                      </span>
                      <span className="text-[11px] text-[#5a4136] dark:text-[#ffb693]">
                        • {evt.organizations?.name}
                      </span>
                    </div>
                    <h3 className="text-base font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6] group-hover:text-[#ff6b00] transition-colors line-clamp-1">
                      {evt.name}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-[#5a4136] dark:text-[#ffb693] mt-0.5">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-[#ff6b00]">calendar_today</span>
                        <span>{start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-[#ff6b00]">location_on</span>
                        <span className="line-clamp-1 max-w-[150px]">{evt.venue_name}</span>
                      </span>
                    </div>
                  </div>

                  {/* Move Up/Down Controls */}
                  <div className="flex items-center gap-1 mr-2">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveItem(idx, 'up')}
                      className="p-1 rounded text-[#5a4136] hover:text-[#ff6b00] disabled:opacity-30 cursor-pointer"
                      title="Move Up"
                    >
                      <span className="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
                    </button>
                    <button
                      type="button"
                      disabled={idx === trendingEvents.length - 1}
                      onClick={() => moveItem(idx, 'down')}
                      className="p-1 rounded text-[#5a4136] hover:text-[#ff6b00] disabled:opacity-30 cursor-pointer"
                      title="Move Down"
                    >
                      <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                    </button>
                  </div>

                  {/* Delete Action */}
                  <button
                    onClick={() => removeTrending(evt.id)}
                    className="p-2 text-[#5a4136] dark:text-[#ffb693] hover:text-[#ba1a1a] rounded-full hover:bg-red-50 dark:hover:bg-red-950 transition-all cursor-pointer"
                    title="Remove from Trending"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Capacity Control & Display Rules */}
        <div className="lg:col-span-4 space-y-6">
          {/* Capacity Control Box */}
          <div className="bg-white dark:bg-[#261812] border-2 border-[#ff6b00]/30 dark:border-[#ff6b00]/40 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[#ff6b00] text-[22px]">tune</span>
              <h3 className="text-base font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                Trending Capacity
              </h3>
            </div>
            <p className="text-xs text-[#5a4136] dark:text-[#ffb693] mb-4">
              Configure how many curated trending events are featured in the Trending feed on the student platform.
            </p>

            {/* Stepper + Input */}
            <div className="flex items-center justify-between gap-3 bg-[#fff8f6] dark:bg-[#1a120e] p-3 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] mb-4">
              <span className="text-xs font-bold text-[#5a4136] dark:text-[#ffb693]">Capacity Limit:</span>
              
              <div className="flex items-center gap-1 bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setCapacityInput(Math.max(1, capacityInput - 1))}
                  className="w-7 h-7 flex items-center justify-center rounded text-[#5a4136] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] transition-colors cursor-pointer"
                  title="Decrease Limit"
                >
                  <span className="material-symbols-outlined text-[16px]">remove</span>
                </button>
                
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={capacityInput}
                  onChange={(e) => setCapacityInput(parseInt(e.target.value) || 1)}
                  className="w-12 text-center font-extrabold text-sm text-[#ff6b00] bg-transparent border-none outline-none p-0"
                />

                <button
                  type="button"
                  onClick={() => setCapacityInput(Math.min(50, capacityInput + 1))}
                  className="w-7 h-7 flex items-center justify-center rounded text-[#5a4136] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] transition-colors cursor-pointer"
                  title="Increase Limit"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[11px] font-semibold text-[#5a4136] dark:text-[#ffb693]">Presets:</span>
              {[5, 10, 15, 20].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCapacityInput(preset)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    capacityInput === preset
                      ? 'bg-[#ff6b00] text-white shadow-xs'
                      : 'bg-[#fee3d8] dark:bg-[#3d2d26] text-[#5a4136] dark:text-[#ffb693] hover:border-[#ff6b00]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={savingCapacity || capacityInput === maxCapacity}
              onClick={() => handleSaveCapacity(capacityInput)}
              className="w-full py-2.5 bg-[#ff6b00] hover:bg-[#a04100] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {savingCapacity ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[16px]">save</span>
              )}
              <span>{capacityInput === maxCapacity ? 'Limit Saved' : `Save Capacity (${capacityInput})`}</span>
            </button>
          </div>

          {/* Current Slot Usage */}
          <div className="bg-white/90 dark:bg-[#261812]/90 backdrop-blur-xl border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-[#ff6b00]">local_fire_department</span>
                <span>Active Trending Slots</span>
              </span>
              <span className="text-base font-extrabold text-[#ff6b00]">
                {trendingEvents.length} / {maxCapacity} slots
              </span>
            </div>

            <div className="w-full bg-[#fee3d8] dark:bg-[#3d2d26] h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  trendingEvents.length > maxCapacity ? 'bg-amber-500' : 'bg-gradient-to-r from-[#ff6b00] to-[#f59e0b]'
                }`}
                style={{ width: `${Math.min(100, usagePercent)}%` }}
              />
            </div>

            {trendingEvents.length > maxCapacity && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-1.5">
                <span className="material-symbols-outlined text-[16px] flex-shrink-0 text-amber-600">warning</span>
                <span>You have {trendingEvents.length} events in Trending. Only the top {maxCapacity} events will be displayed to students.</span>
              </div>
            )}

            <div className="pt-3 border-t border-[#e2bfb0] dark:border-[#5a4136]">
              <h4 className="text-xs font-bold text-[#261812] dark:text-[#ffede6] mb-2">Display Rules:</h4>
              <ul className="space-y-2 text-[11px] text-[#5a4136] dark:text-[#ffb693]">
                <li className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-600 text-[16px]">check_circle</span>
                  <span>Curated manually by Super Admin</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#ff6b00] text-[16px]">local_fire_department</span>
                  <span>Displayed instantly when students click &ldquo;Trending&rdquo;</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-600 text-[16px]">format_list_numbered</span>
                  <span>Rank order determines display precedence</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-over Drawer to Search & Add Event to Trending */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-[#261812] h-full shadow-2xl p-6 flex flex-col justify-between">
            <div className="flex-1 overflow-y-auto">
              <div className="flex justify-between items-center pb-4 border-b border-[#e2bfb0] dark:border-[#5a4136]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#ff6b00] text-[24px]">local_fire_department</span>
                  <h2 className="text-xl font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                    Add Event to Trending
                  </h2>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#3d2d26] cursor-pointer"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="mt-4">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#5a4136]">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search active events to mark as trending..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ff6b00] text-xs font-medium"
                  />
                </div>
              </div>

              <div className="space-y-3 mt-5">
                {filteredAvailable.length === 0 ? (
                  <p className="text-xs text-[#5a4136] dark:text-[#ffb693] text-center py-8">
                    No matching un-trending active events found.
                  </p>
                ) : (
                  filteredAvailable.map((evt) => (
                    <div
                      key={evt.id}
                      className="flex justify-between items-center p-3 border border-[#e2bfb0] dark:border-[#5a4136] rounded-xl hover:border-[#ff6b00] transition-colors bg-[#fff8f6] dark:bg-[#1a120e]"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={getEventImage(evt, 'thumbnail')}
                          alt={evt.name}
                          className="w-12 h-9 rounded-lg object-cover flex-shrink-0"
                        />
                        <div>
                          <h4 className="text-xs font-bold text-[#261812] dark:text-[#ffede6] line-clamp-1">
                            {evt.name}
                          </h4>
                          <p className="text-[11px] text-[#5a4136] dark:text-[#ffb693] line-clamp-1">
                            {evt.organizations?.name} • {new Date(evt.start_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addEventToTrending(evt)}
                        className="p-2 text-[#ff6b00] hover:bg-[#ff6b00]/10 rounded-full cursor-pointer flex items-center gap-1 text-xs font-bold"
                        title="Add to Trending"
                      >
                        <span className="material-symbols-outlined text-[20px]">add_circle</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="w-full py-3 mt-4 bg-gradient-to-r from-[#ff6b00] to-[#ea580c] text-white font-bold rounded-xl shadow-md hover:from-[#ea580c] hover:to-[#c2410c] transition-colors cursor-pointer text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
