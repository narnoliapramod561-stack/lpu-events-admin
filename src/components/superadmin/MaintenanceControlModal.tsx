import React, { useState, useEffect } from 'react';
import { supabase, lpuClient } from '../../supabase';
import { 
  PlatformMaintenanceConfig, 
  DEFAULT_PLATFORM_MAINTENANCE_CONFIG, 
  parsePlatformMaintenanceConfig 
} from '../../shared/types';
import { 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  X, 
  RefreshCw, 
  Smartphone, 
  Monitor, 
  Sparkles, 
  Info,
  Lock,
  Mail
} from 'lucide-react';
import { LpuLogo } from '../common/LpuLogo';

interface MaintenanceControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (config: PlatformMaintenanceConfig) => void;
}

interface PresetOption {
  label: string;
  icon: string;
  reason: 'SCHEDULED_UPGRADE' | 'EMERGENCY_PATCH' | 'DATABASE_MIGRATION' | 'CUSTOM';
  message: string;
  durationMinutes: number;
}

const PRESETS: PresetOption[] = [
  {
    label: 'Scheduled Platform Upgrade',
    icon: 'construction',
    reason: 'SCHEDULED_UPGRADE',
    message: 'We are currently making scheduled platform updates to improve your campus event experience.',
    durationMinutes: 60,
  },
  {
    label: 'Emergency Security Patch',
    icon: 'security',
    reason: 'EMERGENCY_PATCH',
    message: 'Platform access is temporarily paused while our infrastructure team applies critical security enhancements.',
    durationMinutes: 30,
  },
  {
    label: 'Database Maintenance',
    icon: 'database',
    reason: 'DATABASE_MIGRATION',
    message: 'Database optimization is currently underway to prepare for upcoming campus festival traffic.',
    durationMinutes: 90,
  },
  {
    label: 'Festival Rush / High Traffic',
    icon: 'local_fire_department',
    reason: 'CUSTOM',
    message: 'We are expanding capacity to handle high-volume event registrations. Doors will reopen shortly.',
    durationMinutes: 45,
  }
];

export const MaintenanceControlModal: React.FC<MaintenanceControlModalProps> = ({
  isOpen,
  onClose,
  onUpdated
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedResumptionIso, setEstimatedResumptionIso] = useState<string>('');
  const [customDatetimeInput, setCustomDatetimeInput] = useState<string>('');
  const [contactEmail, setContactEmail] = useState('support@lpuevents.live');
  const [allowAdminBypass, setAllowAdminBypass] = useState(true);
  const [selectedReason, setSelectedReason] = useState<PlatformMaintenanceConfig['reason']>('SCHEDULED_UPGRADE');

  // Preview Mode: 'desktop' | 'mobile'
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'config' | 'preview'>('config');

  // Fetch current config
  const fetchCurrentConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('global_settings')
        .select('key, value, updated_at')
        .eq('key', 'platform_maintenance_mode')
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const parsed = parsePlatformMaintenanceConfig(data?.value);
      setEnabled(parsed.enabled);
      setMessage(parsed.message || DEFAULT_PLATFORM_MAINTENANCE_CONFIG.message);
      setDescription(parsed.description || DEFAULT_PLATFORM_MAINTENANCE_CONFIG.description || '');
      setSelectedReason(parsed.reason || 'SCHEDULED_UPGRADE');
      setContactEmail(parsed.contact_email || 'support@lpuevents.live');
      setAllowAdminBypass(parsed.allow_admin_bypass !== false);

      if (parsed.estimated_resumption) {
        setEstimatedResumptionIso(parsed.estimated_resumption);
        try {
          const date = new Date(parsed.estimated_resumption);
          if (!isNaN(date.getTime())) {
            // Format to YYYY-MM-DDTHH:MM for datetime-local input
            const pad = (n: number) => String(n).padStart(2, '0');
            const localIso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
            setCustomDatetimeInput(localIso);
          }
        } catch {
          // Non-blocking parse error
        }
      } else {
        setEstimatedResumptionIso('');
        setCustomDatetimeInput('');
      }
    } catch (err: any) {
      console.error('Failed to fetch maintenance mode config:', err);
      setError(err?.message || 'Failed to load maintenance configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCurrentConfig();
    }
  }, [isOpen]);

  const applyPreset = (preset: PresetOption) => {
    setMessage(preset.message);
    setSelectedReason(preset.reason);

    const targetDate = new Date(Date.now() + preset.durationMinutes * 60 * 1000);
    const iso = targetDate.toISOString();
    setEstimatedResumptionIso(iso);

    const pad = (n: number) => String(n).padStart(2, '0');
    const localIso = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}T${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}`;
    setCustomDatetimeInput(localIso);
  };

  const applyQuickDuration = (minutes: number) => {
    const targetDate = new Date(Date.now() + minutes * 60 * 1000);
    const iso = targetDate.toISOString();
    setEstimatedResumptionIso(iso);

    const pad = (n: number) => String(n).padStart(2, '0');
    const localIso = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}T${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}`;
    setCustomDatetimeInput(localIso);
  };

  const clearResumption = () => {
    setEstimatedResumptionIso('');
    setCustomDatetimeInput('');
  };

  const handleCustomDatetimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomDatetimeInput(val);
    if (!val) {
      setEstimatedResumptionIso('');
    } else {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) {
        setEstimatedResumptionIso(parsed.toISOString());
      }
    }
  };

  const formatResumptionDisplay = (iso: string | null) => {
    if (!iso) return null;
    try {
      const date = new Date(iso);
      if (isNaN(date.getTime())) return iso;
      return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const updatedConfig: PlatformMaintenanceConfig = {
        enabled,
        message: message.trim() || DEFAULT_PLATFORM_MAINTENANCE_CONFIG.message,
        description: description.trim() || undefined,
        estimated_resumption: estimatedResumptionIso || null,
        reason: selectedReason || 'CUSTOM',
        contact_email: contactEmail.trim() || 'support@lpuevents.live',
        allow_admin_bypass: allowAdminBypass,
        activated_at: enabled ? new Date().toISOString() : undefined,
        activated_by: user?.email || undefined
      };

      const { data: result, error: rpcErr } = await lpuClient.manageGlobalSetting('upsert', {
        key: 'platform_maintenance_mode',
        value: updatedConfig,
        description: 'Global platform maintenance flag and custom announcement'
      });

      if (rpcErr) throw rpcErr;
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      if (parsed?.code) throw new Error(parsed.message);

      // Force edge cache and realtime invalidation
      await lpuClient.purgeAllEdgeCaches().catch(() => {});

      setSuccess(
        enabled
          ? 'Platform Maintenance Mode is now ACTIVE. Student portals will immediately display the maintenance screen.'
          : 'Maintenance Mode DEACTIVATED. Public student portal has been restored to normal operation.'
      );

      if (onUpdated) {
        onUpdated(updatedConfig);
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Failed to update maintenance settings:', err);
      setError(err?.message || 'Failed to update maintenance mode.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-[#1c1c1e] text-[#261812] dark:text-white rounded-2xl sm:rounded-3xl border border-[#e2bfb0] dark:border-white/10 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#e2bfb0]/60 dark:border-white/10 bg-[#fff8f6] dark:bg-[#202023]/80">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-sm ${
              enabled 
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' 
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            }`}>
              {enabled ? (
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black font-['Outfit'] tracking-tight">
                  Platform Maintenance Control
                </h2>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                  enabled 
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' 
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                }`}>
                  {enabled ? 'Active on Student Web' : 'System Live'}
                </span>
              </div>
              <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-0.5">
                Control campus-wide maintenance screen, custom broadcast messages, and estimated resumption.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Config vs Live Preview */}
            <div className="flex items-center bg-[#fee3d8] dark:bg-white/10 p-0.5 rounded-xl border border-[#e2bfb0] dark:border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('config')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'config'
                    ? 'bg-white dark:bg-[#2c2c2e] text-[#ff6b00] dark:text-white shadow-xs'
                    : 'text-[#5a4136] dark:text-[#aeaeb2] hover:text-[#261812] dark:hover:text-white'
                }`}
              >
                Configuration
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-[#2c2c2e] text-[#ff6b00] dark:text-white shadow-xs'
                    : 'text-[#5a4136] dark:text-[#aeaeb2] hover:text-[#261812] dark:hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Live Preview</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="p-1.5 rounded-xl text-[#5a4136] dark:text-[#aeaeb2] hover:bg-[#fee3d8] dark:hover:bg-white/10 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 text-xs flex items-center gap-2 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-[#5a4136] dark:text-[#aeaeb2] gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-[#ff6b00]" />
              <p className="text-sm font-semibold">Loading current platform configuration…</p>
            </div>
          ) : activeTab === 'config' ? (
            <>
              {/* Master Switch Panel */}
              <div className={`p-5 rounded-2xl border transition-all ${
                enabled
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-[#fff8f6] dark:bg-white/[0.03] border-[#e2bfb0] dark:border-white/10'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold font-['Outfit'] flex items-center gap-2">
                      <span>Enable Platform Maintenance Mode</span>
                      {enabled && (
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500 text-white">
                          LIVE ON CAMPUS
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-1 max-w-xl">
                      When enabled, all student visitors to <strong>lpuevents.live</strong> are shielded with the branded maintenance screen. Super admin dashboard operations remain fully operational.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEnabled(!enabled)}
                    className={`relative inline-flex h-8 w-15 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      enabled ? 'bg-[#ff6b00]' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        enabled ? 'translate-x-7' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {enabled && (
                  <div className="mt-4 pt-4 border-t border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>Warning:</strong> Activating this mode will temporarily prevent student discovery and event browsing until switched off.
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-xs font-bold text-[#5a4136] dark:text-[#aeaeb2] uppercase tracking-wider mb-2">
                  Quick Message Presets
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="text-left p-3 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-white dark:bg-white/[0.02] hover:border-[#ff6b00] hover:bg-[#fee3d8]/40 dark:hover:bg-white/5 transition-all group flex items-start gap-2.5"
                    >
                      <span className="material-symbols-outlined text-[20px] text-[#ff6b00] shrink-0 mt-0.5">
                        {preset.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#261812] dark:text-white group-hover:text-[#ff6b00] transition-colors truncate">
                            {preset.label}
                          </span>
                          <span className="text-[10px] text-[#5a4136] dark:text-[#8e8e93] font-medium shrink-0 ml-1">
                            +{preset.durationMinutes}m
                          </span>
                        </div>
                        <p className="text-[11px] text-[#5a4136] dark:text-[#aeaeb2] truncate mt-0.5">
                          {preset.message}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Message Field */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-[#5a4136] dark:text-[#aeaeb2] uppercase tracking-wider">
                      Primary Public Announcement Message <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-[#5a4136] dark:text-[#8e8e93]">
                      {message.length}/280
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={280}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="E.g., We are currently upgrading campus servers for YouthVibe 2026. The portal will reopen shortly."
                    className="w-full px-4 py-3 rounded-xl bg-[#fff8f6] dark:bg-white/[0.04] border border-[#e2bfb0] dark:border-white/10 text-sm focus:outline-none focus:border-[#ff6b00] focus:ring-1 focus:ring-[#ff6b00] transition-colors resize-none leading-relaxed"
                  />
                  <p className="text-[11px] text-[#5a4136] dark:text-[#8e8e93] mt-1">
                    This message will be rendered prominently on the student maintenance screen.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5a4136] dark:text-[#aeaeb2] uppercase tracking-wider mb-1.5">
                    Security / Reassurance Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="E.g., All registered event tickets, team rosters, and student submissions remain fully secure."
                    className="w-full px-4 py-2.5 rounded-xl bg-[#fff8f6] dark:bg-white/[0.04] border border-[#e2bfb0] dark:border-white/10 text-xs sm:text-sm focus:outline-none focus:border-[#ff6b00] transition-colors"
                  />
                </div>
              </div>

              {/* Estimated Resumption Time Section */}
              <div className="p-4 rounded-2xl bg-[#fff8f6] dark:bg-white/[0.02] border border-[#e2bfb0] dark:border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#ff6b00]" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Expected Resumption Time
                    </span>
                  </div>

                  {estimatedResumptionIso && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                      <span>Live Clock:</span>
                      <strong>{formatResumptionDisplay(estimatedResumptionIso)}</strong>
                    </span>
                  )}
                </div>

                {/* Quick duration buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[#5a4136] dark:text-[#aeaeb2]">Quick Add:</span>
                  {[
                    { label: '+30m', mins: 30 },
                    { label: '+1h', mins: 60 },
                    { label: '+2h', mins: 120 },
                    { label: '+4h', mins: 240 },
                  ].map((btn, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyQuickDuration(btn.mins)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-white/5 border border-[#e2bfb0] dark:border-white/10 hover:border-[#ff6b00] hover:text-[#ff6b00] transition-colors cursor-pointer"
                    >
                      {btn.label}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={clearResumption}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors ml-auto cursor-pointer"
                  >
                    Clear Time
                  </button>
                </div>

                {/* Datetime picker */}
                <div className="pt-2">
                  <input
                    type="datetime-local"
                    value={customDatetimeInput}
                    onChange={handleCustomDatetimeChange}
                    className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-white dark:bg-[#202023] border border-[#e2bfb0] dark:border-white/10 text-xs sm:text-sm focus:outline-none focus:border-[#ff6b00] text-[#261812] dark:text-white"
                  />
                  <span className="ml-2 text-[11px] text-[#5a4136] dark:text-[#8e8e93]">
                    Specify exact target completion time (optional)
                  </span>
                </div>
              </div>

              {/* Administrative Safeguards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-[#5a4136] dark:text-[#aeaeb2] uppercase tracking-wider mb-1.5">
                    Emergency Contact Email
                  </label>
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#fff8f6] dark:bg-white/[0.04] border border-[#e2bfb0] dark:border-white/10">
                    <Mail className="w-4 h-4 text-[#5a4136] dark:text-[#8e8e93]" />
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="support@lpuevents.live"
                      className="w-full bg-transparent text-xs sm:text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#fff8f6] dark:bg-white/[0.04] border border-[#e2bfb0] dark:border-white/10">
                  <div>
                    <span className="text-xs font-bold block">Allow Admin Bypass</span>
                    <span className="text-[11px] text-[#5a4136] dark:text-[#8e8e93]">
                      Super admin portal remains unaffected
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowAdminBypass}
                    onChange={(e) => setAllowAdminBypass(e.target.checked)}
                    className="w-4 h-4 rounded text-[#ff6b00] accent-[#ff6b00] focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>
            </>
          ) : (
            /* Live Interactive Preview */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#e2bfb0]/40 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5a4136] dark:text-[#aeaeb2]">
                    Simulated Student View:
                  </span>
                  <span className="text-xs text-slate-500">
                    {previewViewport === 'desktop' ? 'Desktop Browser' : 'Mobile Viewport'}
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-[#fee3d8] dark:bg-white/10 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('desktop')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      previewViewport === 'desktop'
                        ? 'bg-white dark:bg-[#2c2c2e] text-[#ff6b00] shadow-xs'
                        : 'text-[#5a4136] dark:text-[#aeaeb2]'
                    }`}
                    title="Desktop Preview"
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('mobile')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      previewViewport === 'mobile'
                        ? 'bg-white dark:bg-[#2c2c2e] text-[#ff6b00] shadow-xs'
                        : 'text-[#5a4136] dark:text-[#aeaeb2]'
                    }`}
                    title="Mobile Preview"
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mock Screen Frame */}
              <div className="flex justify-center p-2 sm:p-4 bg-gray-900 rounded-2xl overflow-hidden shadow-inner">
                <div
                  className={`transition-all duration-300 overflow-hidden bg-[#090a0f] text-slate-100 rounded-xl border border-white/10 shadow-2xl flex flex-col justify-between ${
                    previewViewport === 'desktop' ? 'w-full min-h-[460px]' : 'w-[340px] min-h-[520px]'
                  }`}
                >
                  {/* Mock Navbar */}
                  <div className="px-4 py-3 border-b border-white/[0.06] bg-[#0c0d12]/70 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LpuLogo className="w-7 h-7 shrink-0 drop-shadow-sm" size={28} />
                      <div className="leading-tight">
                        <span className="text-sm font-black text-white font-['Outfit']">LPU</span>
                        <span className="text-sm font-black text-[#ff6b00] font-['Outfit'] ml-1">Events</span>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span>Maintenance</span>
                    </div>
                  </div>

                  {/* Mock Hero Content */}
                  <div className="p-6 text-center my-auto space-y-4">
                    <h3 className="text-2xl sm:text-3xl font-black text-white font-['Outfit'] tracking-tight">
                      We’ll be back shortly.
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                      {message.trim() || DEFAULT_PLATFORM_MAINTENANCE_CONFIG.message}
                    </p>

                    {estimatedResumptionIso && (
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-slate-300 font-medium">
                        <Clock className="w-3.5 h-3.5 text-[#ff6b00]" />
                        <span>Expected: <strong className="text-white">{formatResumptionDisplay(estimatedResumptionIso)}</strong></span>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                      {description.trim() || DEFAULT_PLATFORM_MAINTENANCE_CONFIG.description}
                    </p>

                    <div>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold bg-white text-black shadow-md cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Check status</span>
                      </button>
                    </div>
                  </div>

                  {/* Mock Footer */}
                  <div className="px-4 py-2.5 border-t border-white/[0.05] text-[10px] text-slate-500 flex items-center justify-between">
                    <span>Lovely Professional University</span>
                    <span>{contactEmail}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Action Buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#e2bfb0]/60 dark:border-white/10 bg-[#fff8f6] dark:bg-[#202023]/80">
          <div className="flex items-center gap-2 text-xs text-[#5a4136] dark:text-[#aeaeb2]">
            <Lock className="w-3.5 h-3.5" />
            <span>Super Admin Authorized Action</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-full text-xs font-bold text-[#5a4136] dark:text-[#aeaeb2] hover:bg-[#fee3d8] dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold text-white shadow-md transition-all cursor-pointer disabled:opacity-50 active:scale-98 ${
                enabled
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                  : 'bg-[#ff6b00] hover:bg-[#a04100] shadow-orange-600/20'
              }`}
            >
              {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {saving 
                  ? 'Broadcasting to Edge…' 
                  : enabled 
                    ? 'Save & Activate Maintenance' 
                    : 'Save & Keep System Live'
                }
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
