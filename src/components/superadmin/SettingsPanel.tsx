import React, { useState, useEffect } from 'react';
import { supabase, lpuClient } from '../../supabase';
import { 
  Sliders, 
  Plus, 
  Edit3, 
  Save, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Shield,
  Ticket,
  Cloud,
  Settings as SettingsIcon,
  Search,
  RefreshCw,
  Trash2,
  Copy,
  Check
} from 'lucide-react';
import { EmptyState } from '../shell/EmptyState';
import { LoadingSpinner } from '../shell/LoadingState';

interface GlobalSettingRecord {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

type SettingCategory = 'ALL' | 'SAFETY' | 'EVENTS' | 'MEDIA' | 'ADVANCED';

export const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<GlobalSettingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SettingCategory>('ALL');
  
  // Modal State for Edit
  const [editingSetting, setEditingSetting] = useState<GlobalSettingRecord | null>(null);
  const [editValueString, setEditValueString] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal State for Add
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newType, setNewType] = useState<'boolean' | 'number' | 'string' | 'json'>('boolean');
  const [newValue, setNewValue] = useState('false');
  const [newDesc, setNewDesc] = useState('');

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('global_settings')
        .select('key, value, description, updated_at')
        .order('key');
      if (err) throw err;
      setSettings((data as GlobalSettingRecord[]) || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Failed to load settings: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchSettings(); 
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const categorizeSetting = (key: string): 'SAFETY' | 'EVENTS' | 'MEDIA' | 'ADVANCED' => {
    const k = key.toLowerCase();
    if (k.includes('maintenance') || k.includes('allow') || k.includes('require') || k.includes('lock') || k.includes('security') || k.includes('approval')) {
      return 'SAFETY';
    }
    if (k.includes('event') || k.includes('ticket') || k.includes('limit') || k.includes('quota') || k.includes('archive') || k.includes('batch')) {
      return 'EVENTS';
    }
    if (k.includes('media') || k.includes('image') || k.includes('upload') || k.includes('cdn') || k.includes('ad') || k.includes('banner')) {
      return 'MEDIA';
    }
    return 'ADVANCED';
  };

  // Instant Toggle for Booleans
  const handleToggleBoolean = async (setting: GlobalSettingRecord) => {
    const currentValue = Boolean(setting.value);
    const nextValue = !currentValue;
    setSubmitting(true);
    setError('');
    try {
      const { data: result, error: rpcErr } = await lpuClient.manageGlobalSetting('upsert', {
        key: setting.key,
        value: nextValue,
        description: setting.description || undefined
      });
      if (rpcErr) throw rpcErr;
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      if (parsed?.code) throw new Error(parsed.message);

      setSuccess(`Setting "${setting.key}" toggled to ${nextValue ? 'ENABLED' : 'DISABLED'}.`);
      setTimeout(() => setSuccess(''), 4000);
      fetchSettings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Failed to update setting: ' + msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (s: GlobalSettingRecord) => {
    setEditingSetting(s);
    setEditValueString(typeof s.value === 'object' ? JSON.stringify(s.value, null, 2) : String(s.value));
    setEditDesc(s.description || '');
    setError('');
  };

  // Submit Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSetting) return;

    setError('');
    let parsedValue: unknown;
    try {
      if (editValueString === 'true') parsedValue = true;
      else if (editValueString === 'false') parsedValue = false;
      else if (!isNaN(Number(editValueString)) && editValueString.trim() !== '') parsedValue = Number(editValueString);
      else {
        try {
          parsedValue = JSON.parse(editValueString);
        } catch {
          parsedValue = editValueString;
        }
      }
    } catch {
      setError('Invalid setting value format.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: result, error: rpcErr } = await lpuClient.manageGlobalSetting('upsert', {
        key: editingSetting.key,
        value: parsedValue,
        description: editDesc.trim() || undefined
      });
      if (rpcErr) throw rpcErr;
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      if (parsed?.code) throw new Error(parsed.message);

      setSuccess(`Global parameter "${editingSetting.key}" successfully updated.`);
      setEditingSetting(null);
      setTimeout(() => setSuccess(''), 4000);
      fetchSettings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Failed to update parameter: ' + msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Add
  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim()) {
      setError('Key identifier is required.');
      return;
    }

    let parsedVal: unknown;
    try {
      if (newType === 'boolean') {
        parsedVal = newValue === 'true';
      } else if (newType === 'number') {
        parsedVal = Number(newValue) || 0;
      } else if (newType === 'json') {
        parsedVal = JSON.parse(newValue || '{}');
      } else {
        parsedVal = newValue;
      }
    } catch {
      setError('Invalid JSON syntax for configuration value.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const { data: result, error: rpcErr } = await lpuClient.manageGlobalSetting('upsert', {
        key: newKey.trim(),
        value: parsedVal,
        description: newDesc.trim() || undefined
      });
      if (rpcErr) throw rpcErr;
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      if (parsed?.code) throw new Error(parsed.message);

      setSuccess(`Configuration parameter "${newKey.trim()}" created.`);
      setShowAddModal(false);
      setNewKey('');
      setNewValue('false');
      setNewDesc('');
      setTimeout(() => setSuccess(''), 4000);
      fetchSettings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Failed to create parameter: ' + msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete
  const handleDelete = async (key: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete configuration "${key}"?`)) return;
    setSubmitting(true);
    setError('');
    try {
      const { data: result, error: rpcErr } = await lpuClient.manageGlobalSetting('delete', { key });
      if (rpcErr) throw rpcErr;
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      if (parsed?.code) throw new Error(parsed.message);

      setSuccess(`Parameter "${key}" deleted.`);
      setTimeout(() => setSuccess(''), 4000);
      fetchSettings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Failed to delete parameter: ' + msg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSettings = settings.filter((s) => {
    const cat = categorizeSetting(s.key);
    if (selectedCategory !== 'ALL' && cat !== selectedCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.key.toLowerCase().includes(q) || (s.description && s.description.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 pb-12 animate-fadeIn select-text">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20">
              SYSTEM CONFIGURATION
            </span>
            <span className="text-xs text-[#5a4136] dark:text-[#8e8e93]">
              Dynamic Enterprise Parameters
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-white flex items-center gap-2.5">
            <Sliders size={26} className="text-[#ff6b00]" />
            <span>Platform Settings & Safety Controls</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#5a4136] dark:text-[#8e8e93] mt-1 max-w-2xl">
            Configure campus safety switches, student registration limits, event batching parameters, and platform rules in real time.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchSettings}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#e2bfb0] dark:border-white/10 text-xs font-bold text-[#261812] dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ff6b00] hover:bg-[#e05e00] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <Plus size={15} />
            <span>New Parameter</span>
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Main Container Card */}
      <div className="card-box rounded-2xl border border-[#e2bfb0] dark:border-white/10 bg-[#ffffff] dark:bg-[#202023] shadow-sm overflow-hidden">
        {/* Category Filter Pills & Search */}
        <div className="p-5 border-b border-gray-100 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'ALL', label: 'All Settings', icon: <Sliders size={13} /> },
              { id: 'SAFETY', label: 'Safety & Gates', icon: <Shield size={13} /> },
              { id: 'EVENTS', label: 'Events & Tickets', icon: <Ticket size={13} /> },
              { id: 'MEDIA', label: 'Media & CDN', icon: <Cloud size={13} /> },
              { id: 'ADVANCED', label: 'Advanced', icon: <SettingsIcon size={13} /> },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id as SettingCategory)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-[#ff6b00] text-white shadow-xs'
                    : 'bg-gray-100 dark:bg-white/5 text-[#5a4136] dark:text-[#8e8e93] hover:bg-gray-200 dark:hover:bg-white/10'
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search parameter keys or purpose..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-xs text-[#261812] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
        </div>

        {/* Settings Grid / Table */}
        {loading ? (
          <div className="py-16">
            <LoadingSpinner message="Loading global configurations..." />
          </div>
        ) : filteredSettings.length === 0 ? (
          <div className="py-16">
            <EmptyState
              title="No Parameters Match Filter"
              description="No global settings match your search term or chosen category."
              icon={<Sliders size={32} className="text-gray-400" />}
              actionLabel="+ Add Configuration Key"
              onAction={() => setShowAddModal(true)}
            />
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {filteredSettings.map((s) => {
              const isBool = typeof s.value === 'boolean';
              const isNumber = typeof s.value === 'number';
              const isObj = typeof s.value === 'object' && s.value !== null;
              const cat = categorizeSetting(s.key);

              return (
                <div
                  key={s.key}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/50 dark:hover:bg-white/[0.01] transition-colors"
                >
                  {/* Left: Key & Description */}
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-sm font-bold text-[#261812] dark:text-white">
                        {s.key}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(s.key, s.key)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                        title="Copy Key"
                      >
                        {copiedKey === s.key ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      </button>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 uppercase">
                        {cat}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300">
                        {typeof s.value}
                      </span>
                    </div>

                    <p className="text-xs text-[#5a4136] dark:text-[#8e8e93]">
                      {s.description || 'Global runtime configuration parameter.'}
                    </p>

                    <div className="text-[11px] text-gray-400">
                      Modified: {new Date(s.updated_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>

                  {/* Right: Value & Interactive Controls */}
                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    {/* Boolean Quick Toggle Switch */}
                    {isBool ? (
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                            s.value
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {s.value ? 'ENABLED' : 'DISABLED'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleBoolean(s)}
                          disabled={submitting}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                            s.value ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
                          }`}
                          title={`Click to ${s.value ? 'disable' : 'enable'}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              s.value ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    ) : isNumber ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold px-3 py-1 rounded-lg bg-gray-100 dark:bg-white/5 text-[#261812] dark:text-white border border-gray-200 dark:border-white/10">
                          {String(s.value)}
                        </span>
                      </div>
                    ) : (
                      <code className="font-mono text-xs max-w-xs truncate px-2.5 py-1 rounded bg-gray-100 dark:bg-white/5 text-[#261812] dark:text-white border border-gray-200 dark:border-white/10 block">
                        {isObj ? JSON.stringify(s.value) : String(s.value)}
                      </code>
                    )}

                    {/* Edit & Delete Action Buttons */}
                    <button
                      type="button"
                      onClick={() => openEditModal(s)}
                      className="p-1.5 rounded-lg border border-[#e2bfb0] dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 text-[#5a4136] dark:text-[#8e8e93] hover:text-[#ff6b00] transition-colors cursor-pointer"
                      title="Edit Setting"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.key)}
                      disabled={submitting}
                      className="p-1.5 rounded-lg border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
                      title="Delete Setting"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Setting Modal */}
      {editingSetting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-[#202023] rounded-2xl border border-[#e2bfb0] dark:border-white/10 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
              <div>
                <h3 className="text-base font-bold font-['Outfit'] text-[#261812] dark:text-white">
                  Edit Configuration Parameter
                </h3>
                <p className="text-xs font-mono text-orange-600 dark:text-orange-400 mt-0.5">
                  {editingSetting.key}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSetting(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#261812] dark:text-white mb-1">
                  Value
                </label>
                <textarea
                  value={editValueString}
                  onChange={(e) => setEditValueString(e.target.value)}
                  rows={4}
                  className="w-full p-3 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-xs font-mono text-[#261812] dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  required
                />
                <span className="text-[11px] text-[#5a4136] dark:text-gray-400 block mt-1">
                  Enter boolean (true/false), number, text, or structured JSON.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#261812] dark:text-white mb-1">
                  Description & Purpose
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-xs text-[#261812] dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  placeholder="Explain what this parameter controls..."
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSetting(null)}
                  className="px-4 py-2 rounded-xl border border-[#e2bfb0] dark:border-white/10 text-xs font-bold text-[#5a4136] dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ff6b00] hover:bg-[#e05e00] text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Save size={14} />
                  <span>{submitting ? 'Saving...' : 'Save Parameter'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Setting Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-[#202023] rounded-2xl border border-[#e2bfb0] dark:border-white/10 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
              <h3 className="text-base font-bold font-['Outfit'] text-[#261812] dark:text-white">
                Add Global Configuration Parameter
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddNew} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#261812] dark:text-white mb-1">
                  Parameter Key (Unique Identifier)
                </label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-xs font-mono text-[#261812] dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  placeholder="e.g. maintenance_mode, max_tickets_per_student"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#261812] dark:text-white mb-1">
                  Data Type
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['boolean', 'number', 'string', 'json'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setNewType(t);
                        if (t === 'boolean') setNewValue('false');
                        else if (t === 'number') setNewValue('10');
                        else if (t === 'json') setNewValue('{}');
                        else setNewValue('');
                      }}
                      className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                        newType === t
                          ? 'bg-[#ff6b00] text-white'
                          : 'bg-gray-100 dark:bg-white/5 text-[#5a4136] dark:text-gray-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#261812] dark:text-white mb-1">
                  Initial Value
                </label>
                {newType === 'boolean' ? (
                  <select
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-xs text-[#261812] dark:text-white focus:outline-none"
                  >
                    <option value="false">false (Disabled)</option>
                    <option value="true">true (Enabled)</option>
                  </select>
                ) : (
                  <textarea
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    rows={newType === 'json' ? 3 : 2}
                    className="w-full p-2.5 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-xs font-mono text-[#261812] dark:text-white focus:outline-none"
                    placeholder={newType === 'number' ? '10' : newType === 'json' ? '{"key": "val"}' : 'Value string'}
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#261812] dark:text-white mb-1">
                  Description & Purpose
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-xs text-[#261812] dark:text-white focus:outline-none"
                  placeholder="Explain what this configuration controls..."
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#e2bfb0] dark:border-white/10 text-xs font-bold text-[#5a4136] dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ff6b00] hover:bg-[#e05e00] text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Plus size={14} />
                  <span>{submitting ? 'Creating...' : 'Create Parameter'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
