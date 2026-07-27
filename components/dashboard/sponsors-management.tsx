'use client';

import { useState } from 'react';

interface SponsorItem {
  id: string;
  name: string;
  logoUrl: string;
  websiteUrl: string;
  tier: 'Platinum' | 'Gold' | 'Silver' | 'Media Partner';
  status: 'Active' | 'Inactive';
  eventsSponsored: number;
}

const INITIAL_SPONSORS: SponsorItem[] = [
  {
    id: 'sp-1',
    name: 'Red Bull',
    logoUrl: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=300',
    websiteUrl: 'https://redbull.com',
    tier: 'Platinum',
    status: 'Active',
    eventsSponsored: 14,
  },
  {
    id: 'sp-2',
    name: 'Monster Energy',
    logoUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?q=80&w=300',
    websiteUrl: 'https://monsterenergy.com',
    tier: 'Gold',
    status: 'Active',
    eventsSponsored: 8,
  },
  {
    id: 'sp-3',
    name: 'Google Cloud Platform',
    logoUrl: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?q=80&w=300',
    websiteUrl: 'https://cloud.google.com',
    tier: 'Platinum',
    status: 'Active',
    eventsSponsored: 22,
  },
  {
    id: 'sp-4',
    name: 'GitHub',
    logoUrl: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?q=80&w=300',
    websiteUrl: 'https://github.com',
    tier: 'Gold',
    status: 'Active',
    eventsSponsored: 19,
  },
  {
    id: 'sp-5',
    name: 'Spotify India',
    logoUrl: 'https://images.unsplash.com/photo-1614680376593-902f749f7edc?q=80&w=300',
    websiteUrl: 'https://spotify.com',
    tier: 'Media Partner',
    status: 'Inactive',
    eventsSponsored: 5,
  },
];

export function SponsorsManagement() {
  const [sponsors, setSponsors] = useState<SponsorItem[]>(INITIAL_SPONSORS);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<SponsorItem | null>(null);

  // New Sponsor Form State
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [tier, setTier] = useState<'Platinum' | 'Gold' | 'Silver' | 'Media Partner'>('Gold');

  const filteredSponsors = sponsors.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.websiteUrl.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleStatus = (id: string) => {
    setSponsors((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: s.status === 'Active' ? 'Inactive' : 'Active' } : s
      )
    );
  };

  const handleDeleteSponsor = (id: string) => {
    if (confirm('Are you sure you want to delete this sponsor?')) {
      setSponsors((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const handleAddSponsor = () => {
    if (!name.trim()) return;
    const newSponsor: SponsorItem = {
      id: `sp-${Date.now()}`,
      name: name.trim(),
      logoUrl:
        logoUrl.trim() || 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?q=80&w=300',
      websiteUrl: websiteUrl.trim() || 'https://example.com',
      tier: tier,
      status: 'Active',
      eventsSponsored: 0,
    };
    setSponsors((prev) => [...prev, newSponsor]);
    setName('');
    setLogoUrl('');
    setWebsiteUrl('');
    setIsAddModalOpen(false);
  };

  const handleSaveEdit = () => {
    if (!editingSponsor || !editingSponsor.name.trim()) return;
    setSponsors((prev) => prev.map((s) => (s.id === editingSponsor.id ? editingSponsor : s)));
    setEditingSponsor(null);
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1400px] mx-auto animate-fadeIn">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/10 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#ff914d]">
            <span>Super Admin</span>
            <span>•</span>
            <span>Partnerships & Sponsorships</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-1 font-display">
            Sponsors
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Manage official corporate sponsors, logos, websites, and active status.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[#ff914d] hover:bg-[#e07530] text-[#050507] px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(255,145,77,0.3)]"
        >
          <span className="material-symbols-outlined text-lg">add</span> Add New Sponsor
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
            placeholder="Search sponsor by name or website..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
          />
        </div>
        <p className="text-xs text-white/40 font-semibold">
          {sponsors.filter((s) => s.status === 'Active').length} Active Sponsors
        </p>
      </div>

      {/* Sponsors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSponsors.map((sponsor) => (
          <div
            key={sponsor.id}
            className={`rounded-2xl border p-6 bg-white/5 backdrop-blur-md flex flex-col justify-between gap-6 transition-all ${
              sponsor.status === 'Active' ? 'border-white/10' : 'border-white/5 opacity-50'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-black/40 border border-white/10 overflow-hidden flex items-center justify-center p-2 shrink-0">
                <img
                  src={sponsor.logoUrl}
                  alt={sponsor.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-bold text-lg text-white font-display truncate">
                    {sponsor.name}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                      sponsor.status === 'Active'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-white/5 text-white/40 border-white/10'
                    }`}
                  >
                    {sponsor.status}
                  </span>
                </div>
                <a
                  href={sponsor.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#ff914d] hover:underline flex items-center gap-1 mt-1 truncate"
                >
                  {sponsor.websiteUrl}{' '}
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </a>
                <span className="inline-block text-[10px] uppercase font-bold tracking-wider text-white/50 bg-white/5 px-2 py-0.5 rounded mt-2 border border-white/5">
                  {sponsor.tier} Tier
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center border-t border-white/5 pt-4">
              <span className="text-xs text-white/40">
                {sponsor.eventsSponsored} events sponsored
              </span>

              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleStatus(sponsor.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all"
                >
                  {sponsor.status === 'Active' ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => setEditingSponsor(sponsor)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#ff914d] bg-[#ff914d]/10 border border-[#ff914d]/20 hover:bg-[#ff914d]/20 transition-all"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteSponsor(sponsor.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0f0e0b] border border-white/10 rounded-3xl max-w-lg w-full p-8 flex flex-col gap-6 shadow-2xl relative">
            <h2 className="text-2xl font-bold text-white font-display">Add New Sponsor</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Sponsor Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Red Bull"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Logo Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Website URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Sponsorship Tier
                </label>
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value as SponsorItem['tier'])}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                >
                  <option value="Platinum">Platinum</option>
                  <option value="Gold">Gold</option>
                  <option value="Silver">Silver</option>
                  <option value="Media Partner">Media Partner</option>
                </select>
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
                onClick={handleAddSponsor}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-[#050507] bg-[#ff914d] hover:bg-[#e07530]"
              >
                Save Sponsor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingSponsor && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0f0e0b] border border-white/10 rounded-3xl max-w-lg w-full p-8 flex flex-col gap-6 shadow-2xl relative">
            <h2 className="text-2xl font-bold text-white font-display">Edit Sponsor</h2>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Sponsor Name
                </label>
                <input
                  type="text"
                  value={editingSponsor.name}
                  onChange={(e) => setEditingSponsor({ ...editingSponsor, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Logo Image URL
                </label>
                <input
                  type="url"
                  value={editingSponsor.logoUrl}
                  onChange={(e) =>
                    setEditingSponsor({ ...editingSponsor, logoUrl: e.target.value })
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Website URL
                </label>
                <input
                  type="url"
                  value={editingSponsor.websiteUrl}
                  onChange={(e) =>
                    setEditingSponsor({ ...editingSponsor, websiteUrl: e.target.value })
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Tier
                </label>
                <select
                  value={editingSponsor.tier}
                  onChange={(e) =>
                    setEditingSponsor({
                      ...editingSponsor,
                      tier: e.target.value as SponsorItem['tier'],
                    })
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d]"
                >
                  <option value="Platinum">Platinum</option>
                  <option value="Gold">Gold</option>
                  <option value="Silver">Silver</option>
                  <option value="Media Partner">Media Partner</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setEditingSponsor(null)}
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
