'use client';

// TODO: This component is currently using mock data (INITIAL_ADS).
// It needs to be connected to a real backend API to fetch, create, update, and delete advertisements.
// The state management should be updated to use React Query or a similar library to handle server state.

import { useState } from 'react';

interface AdvertisementItem {
  id: string;
  title: string;
  bannerUrl: string;
  redirectUrl: string;
  position: 'Hero Banner' | 'Sidebar Deck' | 'Footer Spotlight';
  startDate: string;
  endDate: string;
  clickCount: number;
  status: 'Active' | 'Expired' | 'Paused';
}

const INITIAL_ADS: AdvertisementItem[] = [
  {
    id: 'ad-1',
    title: 'Elevate Your Skills with LPU Workshops',
    bannerUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=800',
    redirectUrl: 'https://lpuevents.in/workshops',
    position: 'Hero Banner',
    startDate: '2023-10-01',
    endDate: '2023-11-01',
    clickCount: 1420,
    status: 'Active',
  },
  {
    id: 'ad-2',
    title: 'Global Innovation Hackathon 2023',
    bannerUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=800',
    redirectUrl: 'https://lpuevents.in/hackathon',
    position: 'Sidebar Deck',
    startDate: '2023-10-10',
    endDate: '2023-10-25',
    clickCount: 890,
    status: 'Active',
  },
  {
    id: 'ad-3',
    title: 'Campus Food Court Festival Weekend',
    bannerUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800',
    redirectUrl: 'https://lpu.in/foodfest',
    position: 'Footer Spotlight',
    startDate: '2023-09-15',
    endDate: '2023-10-15',
    clickCount: 2150,
    status: 'Expired',
  },
];

export function AdvertisementsManagement() {
  const [ads, setAds] = useState<AdvertisementItem[]>(INITIAL_ADS);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<AdvertisementItem | null>(null);

  // New Ad Form State
  const [title, setTitle] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [position, setPosition] = useState<'Hero Banner' | 'Sidebar Deck' | 'Footer Spotlight'>(
    'Hero Banner'
  );
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredAds = ads.filter(
    (ad) =>
      ad.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ad.redirectUrl.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleStatus = (id: string) => {
    setAds((prev) =>
      prev.map((ad) => {
        if (ad.id === id) {
          const newStatus = ad.status === 'Active' ? 'Paused' : 'Active';
          return { ...ad, status: newStatus };
        }
        return ad;
      })
    );
  };

  const handleDeleteAd = (id: string) => {
    if (confirm('Are you sure you want to delete this advertisement campaign?')) {
      setAds((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleAddAd = () => {
    if (!title.trim()) return;
    const newAd: AdvertisementItem = {
      id: `ad-${Date.now()}`,
      title: title.trim(),
      bannerUrl:
        bannerUrl.trim() ||
        'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=800',
      redirectUrl: redirectUrl.trim() || 'https://example.com',
      position: position,
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      clickCount: 0,
      status: 'Active',
    };
    setAds((prev) => [...prev, newAd]);
    setTitle('');
    setBannerUrl('');
    setRedirectUrl('');
    setIsAddModalOpen(false);
  };

  const handleSaveEdit = () => {
    if (!editingAd || !editingAd.title.trim()) return;
    setAds((prev) => prev.map((a) => (a.id === editingAd.id ? editingAd : a)));
    setEditingAd(null);
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1400px] mx-auto animate-fadeIn">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/10 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#ff914d]">
            <span>Super Admin</span>
            <span>•</span>
            <span>Promotions Engine</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-1 font-display">
            Advertisements
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Manage platform promotional banners, placement slots, schedule dates, and click metrics.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#ff914d] hover:bg-[#e07530] text-[#050507] px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(255,145,77,0.3)]"
        >
          <span className="material-symbols-outlined text-lg">add</span> Create Ad Campaign
        </button>
      </header>

      {/* Filter Bar */}
      <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md flex justify-between items-center">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-[20px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search advertisement by title or target link..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
          />
        </div>
        <p className="text-xs text-white/40 font-semibold">
          {ads.filter((a) => a.status === 'Active').length} Active Campaigns
        </p>
      </div>

      {/* Ads Deck */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredAds.map((ad) => (
          <div
            key={ad.id}
            className={`rounded-2xl border overflow-hidden bg-white/5 backdrop-blur-md flex flex-col justify-between transition-all ${
              ad.status === 'Active' ? 'border-white/10' : 'border-white/5 opacity-50'
            }`}
          >
            <div className="h-44 relative overflow-hidden group">
              <img
                src={ad.bannerUrl}
                alt={ad.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0e0b] via-transparent to-black/40 p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                    {ad.position}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      ad.status === 'Active'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : ad.status === 'Paused'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {ad.status}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white font-display leading-snug drop-shadow">
                    {ad.title}
                  </h3>
                </div>
              </div>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <div className="flex justify-between items-center text-xs text-white/60 bg-white/5 p-3 rounded-xl border border-white/5">
                <div>
                  <span className="text-white/40 block text-[10px] uppercase font-bold">
                    Schedule
                  </span>
                  <span className="font-medium text-white">
                    {ad.startDate} to {ad.endDate}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-white/40 block text-[10px] uppercase font-bold">
                    Click Telemetry
                  </span>
                  <span className="font-bold text-[#ff914d] text-base">
                    {ad.clickCount.toLocaleString()} clicks
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-white/40 uppercase font-bold block mb-1">
                  Target Redirect Link
                </span>
                <a
                  href={ad.redirectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#ff914d] hover:underline flex items-center gap-1 truncate"
                >
                  {ad.redirectUrl}{' '}
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </a>
              </div>

              <div className="flex justify-between items-center border-t border-white/5 pt-4">
                <button
                  onClick={() => handleToggleStatus(ad.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all"
                >
                  {ad.status === 'Active' ? 'Pause' : 'Activate'}
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingAd(ad)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#ff914d] bg-[#ff914d]/10 border border-[#ff914d]/20 hover:bg-[#ff914d]/20 transition-all"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteAd(ad.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0f0e0b] border border-white/10 rounded-3xl max-w-lg w-full p-8 flex flex-col gap-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white font-display">Create Ad Campaign</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Campaign Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Annual Hackathon Promotion"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Banner Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Target Redirect URL
                </label>
                <input
                  type="url"
                  placeholder="https://lpuevents.in/target"
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Placement Position
                </label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value as AdvertisementItem['position'])}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                >
                  <option value="Hero Banner">Hero Banner</option>
                  <option value="Sidebar Deck">Sidebar Deck</option>
                  <option value="Footer Spotlight">Footer Spotlight</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d] [color-scheme:dark]"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d] [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAd}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-[#050507] bg-[#ff914d] hover:bg-[#e07530]"
              >
                Publish Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingAd && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0f0e0b] border border-white/10 rounded-3xl max-w-lg w-full p-8 flex flex-col gap-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white font-display">Edit Ad Campaign</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Campaign Title
                </label>
                <input
                  type="text"
                  value={editingAd.title}
                  onChange={(e) => setEditingAd({ ...editingAd, title: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Banner Image URL
                </label>
                <input
                  type="url"
                  value={editingAd.bannerUrl}
                  onChange={(e) => setEditingAd({ ...editingAd, bannerUrl: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Redirect URL
                </label>
                <input
                  type="url"
                  value={editingAd.redirectUrl}
                  onChange={(e) => setEditingAd({ ...editingAd, redirectUrl: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Placement
                </label>
                <select
                  value={editingAd.position}
                  onChange={(e) =>
                    setEditingAd({
                      ...editingAd,
                      position: e.target.value as AdvertisementItem['position'],
                    })
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                >
                  <option value="Hero Banner">Hero Banner</option>
                  <option value="Sidebar Deck">Sidebar Deck</option>
                  <option value="Footer Spotlight">Footer Spotlight</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setEditingAd(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-[#050507] bg-[#ff914d] hover:bg-[#e07530]"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
