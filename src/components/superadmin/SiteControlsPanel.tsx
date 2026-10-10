import React, { useState, useEffect } from 'react';
import { supabase, lpuClient } from '../../supabase';
import { 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Megaphone, 
  RotateCw, 
  Eye, 
  Info, 
  Power
} from 'lucide-react';
import { LoadingSpinner } from '../shell/LoadingState';
import { useAuth } from '../../auth';

interface MaintenanceConfig {
  is_enabled: boolean;
  message: string;
  estimated_resumption?: string;
}

interface BannerConfig {
  is_active: boolean;
  message: string;
  urgency: 'info' | 'warning' | 'critical';
  cta_label?: string;
  cta_url?: string;
}

export const SiteControlsPanel: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Maintenance State
  const [maintenance, setMaintenance] = useState<MaintenanceConfig>({
    is_enabled: false,
    message: 'The campus event stream is currently compiling live snapshots in edge memory. Automatic background synchronization in progress.',
    estimated_resumption: 'Shortly'
  });

  // Banner State
  const [banner, setBanner] = useState<BannerConfig>({
    is_active: true,
    message: '🎉 Welcome to LPU Events 2026! Discover 60+ live, upcoming & past hackathons, cultural fests, workshops, esports, and sports tournaments across the campus.',
    urgency: 'info',
    cta_label: '',
    cta_url: ''
  });

  const fetchControls = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const { data, error } = await supabase
        .from('global_settings')
        .select('key, value, description')
        .in('key', ['platform_maintenance_mode', 'site_notice_banner']);

      if (error) throw error;

      if (data) {
        // Parse maintenance
        const maintRow = data.find(r => r.key === 'platform_maintenance_mode');
        if (maintRow) {
          if (typeof maintRow.value === 'boolean') {
            setMaintenance(prev => ({ ...prev, is_enabled: maintRow.value as boolean }));
          } else if (typeof maintRow.value === 'object' && maintRow.value !== null) {
            const val = maintRow.value as any;
            setMaintenance({
              is_enabled: Boolean(val.is_enabled ?? val.enabled ?? false),
              message: String(val.message || 'The campus event stream is currently compiling live snapshots in edge memory.'),
              estimated_resumption: val.estimated_resumption || ''
            });
          }
        }

        // Parse banner
        const bannerRow = data.find(r => r.key === 'site_notice_banner');
        if (bannerRow) {
          if (typeof bannerRow.value === 'string') {
            setBanner(prev => ({
              ...prev,
              is_active: bannerRow.value.trim().length > 0,
              message: bannerRow.value
            }));
          } else if (typeof bannerRow.value === 'object' && bannerRow.value !== null) {
            const val = bannerRow.value as any;
            setBanner({
              is_active: Boolean(val.is_active ?? true),
              message: String(val.message || ''),
              urgency: (val.urgency === 'warning' || val.urgency === 'critical') ? val.urgency : 'info',
              cta_label: val.cta_label || '',
              cta_url: val.cta_url || ''
            });
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load site controls:', err);
      setStatusMessage({ text: 'Failed to load current settings: ' + (err.message || String(err)), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchControls();
  }, []);

  const getAdminId = async (): Promise<string> => {
    if (profile?.id && typeof profile.id === 'string' && profile.id.length > 10) return profile.id;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const { data: au } = await supabase
          .from('admin_users')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        if (au?.id) return au.id;
      }
    } catch {}
    return '0f159cb9-b672-499d-a9b6-d61d370342a5';
  };

  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMaintenance(true);
    setStatusMessage(null);
    try {
      const payload = {
        is_enabled: maintenance.is_enabled,
        message: maintenance.message.trim(),
        estimated_resumption: maintenance.estimated_resumption?.trim() || null,
        updated_at: new Date().toISOString()
      };

      const adminId = await getAdminId();

      // 1. Try canonical RPC first (creates audit log and handles security definer)
      let rpcSuccess = false;
      try {
        const res = await lpuClient.manageGlobalSetting('upsert', {
          key: 'platform_maintenance_mode',
          value: payload,
          description: 'Global platform maintenance flag and student portal lock'
        });
        if (!res.error && (!res.data || !res.data.code || res.data.code < 400)) {
          rpcSuccess = true;
        }
      } catch {
        rpcSuccess = false;
      }

      // 2. Direct table upsert with active admin session and guaranteed valid updated_by ID
      if (!rpcSuccess) {
        const { error: directErr } = await supabase
          .from('global_settings')
          .upsert({
            key: 'platform_maintenance_mode',
            value: payload,
            description: 'Global platform maintenance flag and student portal lock',
            updated_by: adminId,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });

        if (directErr) {
          throw new Error(directErr.message);
        }
      }

      await lpuClient.purgeAllEdgeCaches();
      setStatusMessage({ 
        text: maintenance.is_enabled 
          ? '🚨 Student Portal Maintenance Mode is now ACTIVE. Students will see the maintenance screen.'
          : '✅ Maintenance Mode disabled. Student Portal is LIVE and operational.',
        type: 'success'
      });
    } catch (err: any) {
      console.error('Failed to update maintenance mode:', err);
      setStatusMessage({ text: 'Error updating maintenance mode: ' + (err.message || String(err)), type: 'error' });
    } finally {
      setSavingMaintenance(false);
    }
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBanner(true);
    setStatusMessage(null);
    try {
      const payload = {
        is_active: banner.is_active,
        message: banner.message.trim(),
        urgency: banner.urgency,
        cta_label: banner.cta_label?.trim() || null,
        cta_url: banner.cta_url?.trim() || null,
        updated_at: new Date().toISOString()
      };

      const adminId = await getAdminId();

      // 1. Try canonical RPC first
      let rpcSuccess = false;
      try {
        const res = await lpuClient.manageGlobalSetting('upsert', {
          key: 'site_notice_banner',
          value: payload,
          description: 'Site header announcement banner and emergency campus broadcast'
        });
        if (!res.error && (!res.data || !res.data.code || res.data.code < 400)) {
          rpcSuccess = true;
        }
      } catch {
        rpcSuccess = false;
      }

      // 2. Direct table upsert with active admin session and guaranteed valid updated_by ID
      if (!rpcSuccess) {
        const { error: directErr } = await supabase
          .from('global_settings')
          .upsert({
            key: 'site_notice_banner',
            value: payload,
            description: 'Site header announcement banner and emergency campus broadcast',
            updated_by: adminId,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });

        if (directErr) {
          throw new Error(directErr.message);
        }
      }

      await lpuClient.purgeAllEdgeCaches();
      setStatusMessage({ 
        text: banner.is_active 
          ? '📢 Campus announcement banner published and broadcast to student website!'
          : '✅ Campus announcement banner removed from student website.',
        type: 'success'
      });
    } catch (err: any) {
      console.error('Failed to update announcement banner:', err);
      setStatusMessage({ text: 'Error updating announcement banner: ' + (err.message || String(err)), type: 'error' });
    } finally {
      setSavingBanner(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <LoadingSpinner message="Loading platform controls..." />
      </div>
    );
  }

  const studentSiteUrl = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : 'https://lpuevents.live';

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black font-['Outfit'] text-[#261812] dark:text-white flex items-center gap-2.5">
            <Megaphone className="h-6 w-6 text-[#ff6b00]" />
            Campus Broadcast & Site Controls
          </h2>
          <p className="text-sm text-[#5a4136] dark:text-[#aeaeb2] mt-0.5">
            Manage live announcement banners and emergency maintenance modes across both websites.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={studentSiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-white dark:bg-white/[0.04] text-xs font-bold text-[#a04100] dark:text-orange-400 hover:bg-[#fee3d8] transition-all shadow-xs"
          >
            <Eye className="h-4 w-4" />
            <span>Verify Live Student Site</span>
          </a>

          <button
            type="button"
            onClick={fetchControls}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-white dark:bg-white/[0.04] text-xs font-bold text-[#5a4136] dark:text-gray-300 hover:bg-gray-100 transition-all shadow-xs cursor-pointer"
          >
            <RotateCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 border shadow-sm ${
          statusMessage.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <ShieldAlert className="h-5 w-5 shrink-0" />
          )}
          <span className="text-xs font-bold">{statusMessage.text}</span>
        </div>
      )}

      {/* Grid: 2 Pillars (Maintenance & Announcement Banner) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Pillar 1: Maintenance Mode Controller */}
        <div className="bg-white dark:bg-[#242426] border border-[#e2bfb0] dark:border-white/10 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#e2bfb0]/40 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${
                  maintenance.is_enabled 
                    ? 'bg-red-500/15 text-red-600 dark:text-red-400' 
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                }`}>
                  <Power className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#261812] dark:text-white">
                    Student Portal Maintenance
                  </h3>
                  <p className="text-xs text-[#5a4136]/70 dark:text-gray-400">
                    Emergency lock or scheduled downtime
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                maintenance.is_enabled
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
              }`}>
                {maintenance.is_enabled ? 'Maintenance ON' : 'Normal Live'}
              </span>
            </div>

            <form onSubmit={handleSaveMaintenance} id="maintenance-form" className="mt-5 space-y-4">
              {/* Toggle Switch */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-[#e2bfb0]/50 dark:border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#261812] dark:text-white block">
                    Maintenance Lock Status
                  </span>
                  <span className="text-[11px] text-[#5a4136]/70 dark:text-gray-400">
                    When active, students see a graceful maintenance page instead of the event catalog.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMaintenance(prev => ({ ...prev, is_enabled: !prev.is_enabled }))}
                  className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    maintenance.is_enabled ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      maintenance.is_enabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-bold text-[#261812] dark:text-white mb-1.5">
                  Student Maintenance Explanation
                </label>
                <textarea
                  value={maintenance.message}
                  onChange={(e) => setMaintenance(prev => ({ ...prev, message: e.target.value }))}
                  rows={3}
                  className="w-full p-3 rounded-2xl border border-[#e2bfb0] dark:border-white/10 bg-white dark:bg-black/20 text-xs text-[#261812] dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  placeholder="Explain why the portal is temporarily unavailable..."
                  required
                />
              </div>

              {/* Estimated Resumption */}
              <div>
                <label className="block text-xs font-bold text-[#261812] dark:text-white mb-1.5">
                  Estimated Resumption Time (Optional)
                </label>
                <input
                  type="text"
                  value={maintenance.estimated_resumption || ''}
                  onChange={(e) => setMaintenance(prev => ({ ...prev, estimated_resumption: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-white dark:bg-black/20 text-xs text-[#261812] dark:text-white focus:outline-none"
                  placeholder="e.g. 6:30 PM IST or In 15 minutes"
                />
              </div>
            </form>
          </div>

          <div className="pt-4 border-t border-[#e2bfb0]/30 dark:border-white/10 flex items-center justify-end">
            <button
              type="submit"
              form="maintenance-form"
              disabled={savingMaintenance}
              className={`px-5 py-2.5 rounded-full text-xs font-bold text-white shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                maintenance.is_enabled 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-[#ff6b00] hover:bg-[#a04100]'
              }`}
            >
              {savingMaintenance ? (
                <RotateCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>{savingMaintenance ? 'Deploying...' : 'Deploy Maintenance Status'}</span>
            </button>
          </div>
        </div>

        {/* Pillar 2: Campus Announcement & Alert Banner */}
        <div className="bg-white dark:bg-[#242426] border border-[#e2bfb0] dark:border-white/10 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#e2bfb0]/40 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-orange-500/15 text-[#ff6b00]">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#261812] dark:text-white">
                    Campus Announcement Banner
                  </h3>
                  <p className="text-xs text-[#5a4136]/70 dark:text-gray-400">
                    Live broadcast at the top of the Student Portal
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                banner.is_active
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'
              }`}>
                {banner.is_active ? 'Banner Live' : 'Hidden'}
              </span>
            </div>

            <form onSubmit={handleSaveBanner} id="banner-form" className="mt-5 space-y-4">
              {/* Toggle Switch */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/[0.02] border border-[#e2bfb0]/50 dark:border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#261812] dark:text-white block">
                    Show Announcement on Student Website
                  </span>
                  <span className="text-[11px] text-[#5a4136]/70 dark:text-gray-400">
                    Pins an official alert strip right above the student navigation bar.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setBanner(prev => ({ ...prev, is_active: !prev.is_active }))}
                  className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    banner.is_active ? 'bg-[#ff6b00]' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      banner.is_active ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Urgency Level */}
              <div>
                <label className="block text-xs font-bold text-[#261812] dark:text-white mb-1.5">
                  Alert Severity Theme
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['info', 'warning', 'critical'] as const).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setBanner(prev => ({ ...prev, urgency: lvl }))}
                      className={`py-2 px-3 rounded-xl text-xs font-black uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        banner.urgency === lvl
                          ? lvl === 'critical'
                            ? 'bg-red-600 text-white shadow-sm'
                            : lvl === 'warning'
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-blue-600 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-white/5 text-[#5a4136] dark:text-gray-400'
                      }`}
                    >
                      {lvl === 'critical' && <ShieldAlert className="h-3.5 w-3.5" />}
                      {lvl === 'warning' && <AlertTriangle className="h-3.5 w-3.5" />}
                      {lvl === 'info' && <Info className="h-3.5 w-3.5" />}
                      <span>{lvl}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-bold text-[#261812] dark:text-white mb-1.5">
                  Announcement Text
                </label>
                <textarea
                  value={banner.message}
                  onChange={(e) => setBanner(prev => ({ ...prev, message: e.target.value }))}
                  rows={2}
                  className="w-full p-3 rounded-2xl border border-[#e2bfb0] dark:border-white/10 bg-white dark:bg-black/20 text-xs text-[#261812] dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  placeholder="e.g. 🌧️ Heavy rain alert: Outdoor sports events shifted to Indoor Stadium - Block 38"
                  required
                />
              </div>

              {/* Optional Call to Action */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#261812] dark:text-white mb-1">
                    CTA Button Label (Optional)
                  </label>
                  <input
                    type="text"
                    value={banner.cta_label || ''}
                    onChange={(e) => setBanner(prev => ({ ...prev, cta_label: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-white dark:bg-black/20 text-xs text-[#261812] dark:text-white focus:outline-none"
                    placeholder="e.g. View Schedule"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#261812] dark:text-white mb-1">
                    CTA Destination URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={banner.cta_url || ''}
                    onChange={(e) => setBanner(prev => ({ ...prev, cta_url: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-white dark:bg-black/20 text-xs text-[#261812] dark:text-white focus:outline-none font-mono"
                    placeholder="https://... or /events"
                  />
                </div>
              </div>
            </form>
          </div>

          <div className="space-y-4 pt-4 border-t border-[#e2bfb0]/30 dark:border-white/10">
            {/* Live Student Preview */}
            <div>
              <span className="text-[11px] font-bold text-[#5a4136]/70 dark:text-gray-400 block mb-1.5 uppercase tracking-wider">
                Student Portal Live Preview:
              </span>
              <div className={`p-3 rounded-2xl flex items-center justify-between text-xs font-medium border ${
                banner.urgency === 'critical'
                  ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                  : banner.urgency === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-300'
              }`}>
                <div className="flex items-center gap-2 overflow-hidden">
                  <Megaphone className="h-4 w-4 shrink-0" />
                  <span className="truncate">{banner.message || 'Announcement message preview'}</span>
                </div>
                {banner.cta_label && (
                  <span className="shrink-0 ml-3 px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/10 text-[10px] font-bold">
                    {banner.cta_label} →
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                form="banner-form"
                disabled={savingBanner}
                className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-[#ff6b00] hover:bg-[#a04100] shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {savingBanner ? (
                  <RotateCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Megaphone className="h-4 w-4" />
                )}
                <span>{savingBanner ? 'Publishing...' : 'Publish Announcement'}</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
