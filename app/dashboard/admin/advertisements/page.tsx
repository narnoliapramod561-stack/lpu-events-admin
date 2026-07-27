'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SignOutButton } from '@/components/auth/sign-out-button';

interface Advertisement {
  id: string;
  title: string;
  image_url: string;
  target_url: string | null;
  placement: string;
  display_order: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminAdvertisementsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminProfile, setAdminProfile] = useState<any | null>(null);
  
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [placement, setPlacement] = useState('sidebar');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  
  const [adFile, setAdFile] = useState<File | null>(null);
  const [adPreview, setAdPreview] = useState<string | null>(null);

  const loadData = async () => {
    try {
      // 1. Authenticate & Verify Role
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/sign-in');
        return;
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileErr || !profile || profile.role !== 'super_admin') {
        setError('Unauthorized access. This area is restricted to super administrators.');
        setLoading(false);
        return;
      }
      setAdminProfile(profile);

      // 2. Fetch current advertisements
      const { data: list, error: listErr } = await supabase
        .from('advertisements')
        .select('*')
        .order('display_order', { ascending: true });

      if (listErr) throw listErr;
      setAds(list || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load advertisement listings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supabase]);

  // Handle Image File selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (5MB Limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('Advertisement banner size must be less than 5MB.');
      return;
    }

    setError(null);
    setAdFile(file);
    setAdPreview(URL.createObjectURL(file));
  };

  // Submit Ad form
  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return setError('Title is required.');
    if (!adFile) return setError('Please select a banner image file.');
    
    setSubmitting(true);
    setError(null);

    try {
      // 1. Upload file to advertisements bucket
      const fileExt = adFile.name.split('.').pop();
      const storagePath = `banners/ad-${Date.now()}.${fileExt}`;
      
      const { error: uploadErr } = await supabase.storage
        .from('advertisements')
        .upload(storagePath, adFile);

      if (uploadErr) throw new Error(`Banner upload failed: ${uploadErr.message}`);

      // Get public URL of the banner
      const { data: { publicUrl } } = supabase.storage
        .from('advertisements')
        .getPublicUrl(storagePath);

      // 2. Insert record into database
      const adPayload = {
        title,
        image_url: publicUrl,
        target_url: targetUrl || null,
        placement,
        display_order: displayOrder,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        is_active: true
      };

      const { data: createdAd, error: insertErr } = await supabase
        .from('advertisements')
        .insert(adPayload)
        .select()
        .single();

      if (insertErr || !createdAd) throw insertErr;

      // Update local state and reset form
      setAds([...ads, createdAd].sort((a, b) => a.display_order - b.display_order));
      setTitle('');
      setTargetUrl('');
      setPlacement('sidebar');
      setDisplayOrder(0);
      setStartsAt('');
      setEndsAt('');
      setAdFile(null);
      setAdPreview(null);
    } catch (err: any) {
      setError(err.message || 'Failed to create advertisement banner.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete/Disable Ad
  const handleDeleteAd = async (id: string) => {
    try {
      const { error: deleteErr } = await supabase
        .from('advertisements')
        .delete()
        .eq('id', id);

      if (deleteErr) throw deleteErr;
      setAds(ads.filter(a => a.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete advertisement.');
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050507] text-[#e6e2dc] flex items-center justify-center p-6">
        <div className="text-center space-y-4 animate-pulse">
          <div className="w-10 h-10 rounded-full border-t-2 border-[#ff914d] mx-auto animate-spin" />
          <p className="text-sm text-white/40">Loading Advertisement Portal...</p>
        </div>
      </main>
    );
  }

  if (error && !adminProfile) {
    return (
      <main className="min-h-screen bg-[#050507] text-[#e6e2dc] flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-[400px]">
          <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold text-2xl mx-auto">
            ⚠️
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white font-display">Access Denied</h1>
          <p className="text-sm text-white/60">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full inline-flex h-11 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold transition hover:bg-white/10"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050507] text-[#e6e2dc] p-6 relative overflow-hidden">
      {/* Background radial highlight */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[#ff914d]/2 blur-[140px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 z-10 relative">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-white font-display">
              Advertisement Manager
            </h1>
            <p className="text-sm text-white/60">
              Create, configure, and monitor placement ad banners on the LPU Events network.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-white font-semibold transition"
            >
              Back to Dashboard
            </button>
            <SignOutButton />
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8">
          {/* Advertisements List */}
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-6">
            <h3 className="text-lg font-bold text-white font-display">Active Campaigns</h3>

            <div className="space-y-4 max-h-[580px] overflow-y-auto pr-1">
              {ads.length > 0 ? (
                ads.map((ad) => (
                  <div key={ad.id} className="p-4 rounded-2xl border border-white/5 bg-white/2 flex gap-4 items-start relative hover:bg-white/4 transition">
                    <button
                      onClick={() => handleDeleteAd(ad.id)}
                      className="absolute top-4 right-4 text-xs text-rose-400 hover:text-rose-300 transition"
                    >
                      Delete
                    </button>

                    <div className="w-24 h-16 rounded-xl overflow-hidden relative border border-white/10 bg-[#050507] shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ad.image_url} alt={ad.title} className="object-cover w-full h-full" />
                    </div>

                    <div className="space-y-1 text-xs text-white/60">
                      <strong className="text-white text-sm block">{ad.title}</strong>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <span className="bg-white/10 text-white/80 px-2 py-0.5 rounded">
                          {ad.placement}
                        </span>
                        <span className="bg-[#ff914d]/10 text-[#ff914d] px-2 py-0.5 rounded">
                          Order: {ad.display_order}
                        </span>
                      </div>
                      {ad.target_url && (
                        <a href={ad.target_url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline block pt-1">
                          🔗 {ad.target_url}
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-white/40">
                  No advertisements currently active.
                </div>
              )}
            </div>
          </div>

          {/* Create Advertisement Form */}
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
            <form onSubmit={handleCreateAd} className="space-y-5">
              <h3 className="text-lg font-bold text-white font-display">New Banner Campaign</h3>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Ad Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Google Summer of Code Info Session"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Placement</label>
                  <select
                    value={placement}
                    onChange={(e) => setPlacement(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                  >
                    <option value="sidebar" className="bg-[#050507]">Sidebar Banner</option>
                    <option value="hero_banner" className="bg-[#050507]">Homepage Hero</option>
                    <option value="featured_event" className="bg-[#050507]">Featured Carousel</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Display Order</label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value))}
                    min={0}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Redirect URL</label>
                <input
                  type="url"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://example.com/signup"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Starts At</label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-[#ff914d] transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Ends At</label>
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-[#ff914d] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Banner Image File</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-xs text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#ff914d]/10 file:text-[#ff914d] hover:file:bg-[#ff914d]/20 file:cursor-pointer"
                />
                <p className="text-[10px] text-white/30">PNG, JPG, or WEBP. Max. file size 5MB.</p>
              </div>

              {adPreview && (
                <div className="relative rounded-2xl overflow-hidden border border-white/10 max-h-36 flex justify-center bg-[#050507]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={adPreview} alt="Ad Preview" className="object-contain h-full" />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex h-12 items-center justify-center rounded-xl bg-[#ff914d] hover:bg-[#e07530] text-sm font-semibold text-[#050507] transition disabled:opacity-50 shadow-[0_0_15px_rgba(255,145,77,0.3)]"
              >
                {submitting ? 'Creating Ad Banner...' : 'Launch Campaign'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
