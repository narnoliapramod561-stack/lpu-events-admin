import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { uploadAndOptimizeImage, getOptimizedImage } from '@lpu-events/shared';
import { 
  Handshake, 
  Plus, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  Power,
  Trash2,
  Image as ImageIcon,
  Upload,
  Sparkles,
  X,
  RotateCcw
} from 'lucide-react';
import { EmptyState } from '../shell/EmptyState';

export const SponsorsPanel: React.FC = () => {
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form states with persistent localStorage storage so window switching / sliding never loses data
  const [showAdd, setShowAdd] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lpu_sponsor_form_open') === 'true';
    } catch {
      return false;
    }
  });

  const [name, setName] = useState<string>(() => {
    try {
      return localStorage.getItem('lpu_sponsor_draft_name') || '';
    } catch {
      return '';
    }
  });

  const [websiteUrl, setWebsiteUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('lpu_sponsor_draft_url') || '';
    } catch {
      return '';
    }
  });

  const [imageUrl, setImageUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('lpu_sponsor_draft_image') || '';
    } catch {
      return '';
    }
  });

  // Auto-sync form changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('lpu_sponsor_form_open', String(showAdd));
      localStorage.setItem('lpu_sponsor_draft_name', name);
      localStorage.setItem('lpu_sponsor_draft_url', websiteUrl);
      localStorage.setItem('lpu_sponsor_draft_image', imageUrl);
    } catch (e) {
      console.warn('Storage sync failed', e);
    }
  }, [showAdd, name, websiteUrl, imageUrl]);

  const clearDraft = () => {
    setName('');
    setWebsiteUrl('');
    setImageUrl('');
    try {
      localStorage.removeItem('lpu_sponsor_draft_name');
      localStorage.removeItem('lpu_sponsor_draft_url');
      localStorage.removeItem('lpu_sponsor_draft_image');
      localStorage.removeItem('lpu_sponsor_form_open');
    } catch {}
  };

  const fetchSponsors = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('sponsors')
        .select('*, media_assets(id, object_key, bucket)')
        .order('sort_order', { ascending: true });
      if (err) throw err;
      setSponsors(data || []);
    } catch (err: any) {
      console.error('Failed to load sponsors:', err);
      setError('Failed to load sponsors: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSponsors();
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
        context: 'sponsor-logo'
      });
      setImageUrl(result.publicUrl || result.dataUrl);
    } catch (err: any) {
      console.error('Logo upload error:', err);
      setError('Image upload failed: ' + (err.message || 'Upload failed.'));
      setImageUrl('');
      setSelectedFile(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Sponsor / Partner name is required.');
      return;
    }
    if (websiteUrl.trim() && !/^https?:\/\//i.test(websiteUrl.trim())) {
      setError('Website URL must start with https:// or http://');
      return;
    }

    setError('');
    setSuccess('');
    setSubmitting(true);

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
          context: 'sponsor-logo',
          adminUserId: adminId
        });
        mediaAssetId = optResult.mediaId;
      } else {
        // 1. Create or resolve media asset record for the logo/banner
        const logoKey = imageUrl.trim() || `sponsors/${name.trim().toLowerCase().replace(/\s+/g, '_')}.webp`;
        const { data: mediaAsset, error: mediaErr } = await supabase
          .from('media_assets')
          .insert({
            bucket: 'media',
            object_key: logoKey,
            media_type: 'SPONSOR_LOGO',
            mime_type: 'image/webp',
            file_size_bytes: 1024,
            status: 'READY',
            created_by: adminId
          })
          .select('id')
          .single();

        if (mediaErr) throw mediaErr;
        mediaAssetId = mediaAsset.id;
      }

      // 2. Insert into sponsors table
      const { error: sponsorErr } = await supabase
        .from('sponsors')
        .insert({
          name: name.trim(),
          logo_media_id: mediaAssetId,
          website_url: websiteUrl.trim() || null,
          status: 'PUBLISHED',
          sort_order: sponsors.length + 1,
          created_by: adminId,
          updated_by: adminId
        });

      if (sponsorErr) throw sponsorErr;

      setSuccess(`Partner "${name.trim()}" added successfully!`);
      clearDraft();
      setSelectedFile(null);
      setShowAdd(false);
      await fetchSponsors();
    } catch (err: any) {
      console.error('Failed to add sponsor:', err);
      setError('Failed to add partner: ' + (err.message || 'Unknown error.'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      const { error: err } = await supabase
        .from('sponsors')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (err) throw err;
      setSuccess('Sponsor status updated.');
      await fetchSponsors();
    } catch (err: any) {
      console.error('Update failed:', err);
      setError('Update failed: ' + (err.message || ''));
    }
  };

  const deleteSponsor = async (id: string, sponsorName: string) => {
    if (!confirm(`Are you sure you want to remove partner "${sponsorName}"?`)) return;
    try {
      const { error: err } = await supabase.from('sponsors').delete().eq('id', id);
      if (err) throw err;
      setSuccess(`Partner "${sponsorName}" removed.`);
      await fetchSponsors();
    } catch (err: any) {
      console.error('Delete failed:', err);
      setError('Delete failed: ' + (err.message || ''));
    }
  };

  const getSponsorLogoUrl = (sp: any) => {
    return getOptimizedImage(sp, 'sponsor-logo');
  };

  return (
    <div className="space-y-6 select-text animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
              Institutional Relations
            </span>
            <span className="text-xs text-[#5a4136] dark:text-[#ffb693]">Corporate Partnerships & Advertisers</span>
          </div>
          <h2 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2.5">
            <Handshake size={28} className="text-[#ff6b00]" />
            <span>Partners & Sponsors Network</span>
          </h2>
          <p className="text-sm text-[#5a4136] dark:text-[#ffb693] mt-1">
            Manage corporate partners, industry sponsors, and brand advertising logos shown on the university student portal.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="bg-[#ff6b00] hover:bg-[#a04100] text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
        >
          {showAdd ? <X size={16} /> : <Plus size={16} />}
          <span>{showAdd ? 'Close Form' : 'Add New Partner'}</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={16} className="flex-shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Add Partner Form Drawer / Embedded Panel */}
      {showAdd && (
        <div className="bg-white dark:bg-[#261812] rounded-2xl border-2 border-[#ff6b00]/30 dark:border-[#ff6b00]/40 p-6 shadow-xl animate-fadeIn">
          <div className="flex justify-between items-center pb-4 border-b border-[#e2bfb0] dark:border-[#5a4136] mb-5">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-[#ff6b00]" />
              <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                Add Sponsor & Ad Media
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

          <form onSubmit={handleAdd} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Text inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-1.5">
                    Partner / Sponsor Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Red Bull Energy, Google Cloud, Intel"
                    required
                    className="w-full p-3 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ff6b00] text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-1.5">
                    Destination URL (Website / Ad Promo)
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#5a4136]">
                      link
                    </span>
                    <input
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://brand.com/campus"
                      className="w-full pl-10 pr-3 py-3 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] outline-none focus:border-[#ff6b00] text-xs font-medium"
                    />
                  </div>
                </div>

                {/* Image Upload Only */}
                <div>
                  <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-2">
                    Partner Logo / Ad Image *
                  </label>

                  <div className="bg-[#fff8f6] dark:bg-[#1a120e] p-5 rounded-2xl border-2 border-dashed border-[#e2bfb0] dark:border-[#5a4136] text-center hover:border-[#ff6b00] transition-colors">
                    <input
                      type="file"
                      id="sponsor-file-upload"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="sponsor-file-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#fee3d8] dark:bg-[#3d2d26] flex items-center justify-center text-[#ff6b00]">
                        <Upload size={22} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-[#261812] dark:text-[#ffede6] block">
                          {imageUrl ? 'Replace / Upload Another Logo' : 'Click or Drag & Drop to Upload Logo'}
                        </span>
                        <span className="text-[11px] text-[#5a4136] dark:text-[#ffb693] mt-0.5 block">
                          Supports PNG, SVG, JPG, WebP (Max 5MB)
                        </span>
                      </div>
                    </label>

                    {imageUrl && (
                      <div className="mt-3 pt-3 border-t border-[#e2bfb0]/60 dark:border-[#5a4136]/60 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          Logo image loaded
                        </span>
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                        >
                          Remove Logo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Live Ad Preview Card */}
              <div>
                <label className="block text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider mb-2">
                  Live Public Preview
                </label>
                <div className="bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-[220px]">
                  {imageUrl ? (
                    <div className="w-full space-y-4">
                      <div className="w-full h-24 bg-white dark:bg-[#261812] rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] p-3 flex items-center justify-center shadow-xs">
                        <img
                          src={imageUrl}
                          alt="Sponsor Logo Preview"
                          className="max-h-full max-w-[80%] object-contain"
                          onError={(e: any) => {
                            e.target.src = 'https://upload.wikimedia.org/wikipedia/commons/5/51/Google_Cloud_logo.svg';
                          }}
                        />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-base text-[#261812] dark:text-[#ffede6]">
                          {name || 'Partner Brand Name'}
                        </h4>
                        <p className="text-xs text-[#ff6b00] font-semibold mt-0.5 line-clamp-1">
                          {websiteUrl || 'https://brand-website.com'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[#5a4136] dark:text-[#ffb693] space-y-2">
                      <ImageIcon size={36} className="mx-auto opacity-40 text-[#ff6b00]" />
                      <p className="text-xs font-semibold">Select or upload a logo image to preview ad appearance.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e2bfb0] dark:border-[#5a4136]">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-5 py-2.5 rounded-xl border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-bold text-[#5a4136] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="px-6 py-2.5 bg-[#ff6b00] hover:bg-[#a04100] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                {submitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>Publish Sponsor Partner</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white dark:bg-[#261812] rounded-2xl border border-[#e2bfb0] dark:border-[#5a4136] shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#e2bfb0] dark:border-[#5a4136] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
              Configured Partners & Advertisers
            </h3>
            <span className="px-2.5 py-0.5 bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-extrabold text-[11px] rounded-full">
              {sponsors.length} Active Partners
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-[#5a4136] dark:text-[#ffb693] flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-[#ff6b00] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold">Loading partners and sponsor logos...</p>
          </div>
        ) : sponsors.length === 0 ? (
          <div className="p-16 text-center">
            <EmptyState
              title="No Sponsors Configured"
              description="Add your first corporate or community partner to showcase on the student portal footer."
              icon={<Handshake size={26} />}
              actionLabel="+ Add Partner"
              onAction={() => setShowAdd(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#fff1eb]/70 dark:bg-[#1a120e] border-b border-[#e2bfb0] dark:border-[#5a4136] text-[11px] font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider">
                  <th className="py-3.5 px-6">Rank</th>
                  <th className="py-3.5 px-6">Brand Logo & Partner</th>
                  <th className="py-3.5 px-6">Destination Link</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2bfb0]/60 dark:divide-[#5a4136]/60 text-xs">
                {sponsors.map((sp, idx) => {
                  const logoUrl = getSponsorLogoUrl(sp);

                  return (
                    <tr key={sp.id} className="hover:bg-[#fff8f6] dark:hover:bg-[#3d2d26]/30 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-[#5a4136] dark:text-[#ffb693]">
                        #{idx + 1}
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-10 rounded-lg bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] p-1 flex items-center justify-center flex-shrink-0">
                            <img
                              src={logoUrl}
                              alt={sp.name}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <div>
                            <span className="font-bold text-sm text-[#261812] dark:text-[#ffede6] block">
                              {sp.name}
                            </span>
                            <span className="text-[10px] text-[#5a4136] dark:text-[#ffb693]">
                              ID: {sp.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        {sp.website_url ? (
                          <a
                            href={sp.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#ff6b00] hover:underline flex items-center gap-1 font-medium"
                          >
                            <span className="line-clamp-1 max-w-[220px]">{sp.website_url}</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-[#5a4136] dark:text-[#ffb693] italic">No URL set</span>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        <span
                          className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase inline-flex items-center gap-1 ${
                            sp.status === 'PUBLISHED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              sp.status === 'PUBLISHED' ? 'bg-emerald-500' : 'bg-zinc-400'
                            }`}
                          />
                          {sp.status}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => toggleStatus(sp.id, sp.status)}
                            className="p-1.5 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] text-[#5a4136] hover:text-[#ff6b00] hover:border-[#ff6b00] transition-colors cursor-pointer"
                            title={sp.status === 'PUBLISHED' ? 'Set as Draft' : 'Publish Partner'}
                          >
                            <Power size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSponsor(sp.id, sp.name)}
                            className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                            title="Remove Partner"
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
