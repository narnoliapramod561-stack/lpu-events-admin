import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { useAuth } from '../../auth';
import { 
  Building2, 
  Edit3, 
  Check, 
  X, 
  Calendar, 
  Eye, 
  Sparkles, 
  Copy, 
  CheckCircle2, 
  ShieldCheck,
  Mail,
  Fingerprint
} from 'lucide-react';
import { LoadingSpinner } from '../shell/LoadingState';

export const ClubProfilePanel: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [orgData, setOrgData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalEvents: 0,
    activeEvents: 0,
    totalViews: 0
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchOrgDetails = async () => {
    if (!profile?.org_id) return;
    setLoading(true);
    try {
      const [orgRes, eventsRes] = await Promise.all([
        supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.org_id)
          .single(),
        supabase
          .from('events')
          .select('id, status, end_at, view_count')
          .eq('organization_id', profile.org_id)
      ]);

      if (orgRes.error) throw orgRes.error;
      setOrgData(orgRes.data);
      setNameInput(orgRes.data.name || '');

      if (eventsRes.data) {
        const now = new Date();
        const totalEvts = eventsRes.data.length;
        const activeEvts = eventsRes.data.filter(
          (e) => new Date(e.end_at) >= now && e.status === 'PUBLISHED'
        ).length;
        const views = eventsRes.data.reduce((sum, e) => sum + (e.view_count || 0), 0);
        setStats({
          totalEvents: totalEvts,
          activeEvents: activeEvts,
          totalViews: views
        });
      }
    } catch (err: any) {
      console.error('Failed to load organization details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgDetails();
  }, [profile?.org_id]);

  const handleSaveName = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setErrorMsg('Organization name cannot be empty.');
      return;
    }
    if (trimmed.length < 2) {
      setErrorMsg('Organization name must be at least 2 characters.');
      return;
    }

    // If identical to current name, no-op
    if (trimmed === orgData?.name) {
      setIsEditingName(false);
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      // 1. Pre-check if another organization already uses this name (case-insensitive)
      const { data: existing } = await supabase
        .from('organizations')
        .select('id, name')
        .ilike('name', trimmed)
        .neq('id', profile?.org_id)
        .maybeSingle();

      if (existing) {
        setErrorMsg(`An organization with the name "${trimmed}" is already registered. Please choose a unique name.`);
        setSaving(false);
        return;
      }

      // 2. Perform update
      const { error } = await supabase
        .from('organizations')
        .update({
          name: trimmed,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile?.org_id);

      if (error) {
        if (error.code === '23505' || error.message.includes('unique constraint') || error.message.includes('organizations_normalized_name_idx')) {
          setErrorMsg(`An organization with the name "${trimmed}" already exists. Please choose a distinct name.`);
          return;
        }
        throw error;
      }

      setOrgData((prev: any) => ({ ...prev, name: trimmed }));
      setIsEditingName(false);
      showToast('Club name updated successfully!');

      // Refresh auth profile so the top banner and sidebar reflect the new name instantly
      if (refreshProfile) {
        await refreshProfile();
      }
    } catch (err: any) {
      console.error('Failed to update organization name:', err);
      if (err.message && (err.message.includes('organizations_normalized_name_idx') || err.message.includes('unique constraint'))) {
        setErrorMsg(`An organization with the name "${trimmed}" already exists. Please choose a unique name.`);
      } else {
        setErrorMsg(err.message || 'Failed to update organization name.');
      }
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`);
  };

  if (loading) {
    return <LoadingSpinner message="Loading organization profile..." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '880px' }} className="animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#261812] text-white px-4 py-2.5 rounded-xl shadow-xl border border-[#ff6b00]/40 flex items-center gap-2 text-sm font-semibold animate-bounce">
          <CheckCircle2 size={18} color="#ff6b00" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="page-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-accent">CLUB PROFILE</span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Organization Settings</span>
          </div>
          <h2 className="page-title">
            {orgData?.name || profile?.org_name || 'Organization'}
          </h2>
          <p className="page-description">
            Manage your student organization identity, view official credentials, and update club profile details.
          </p>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Total Published</span>
            <div className="stat-card-icon-box">
              <Calendar size={18} />
            </div>
          </div>
          <div className="stat-card-value">{stats.totalEvents}</div>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>All-time club events</span>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Live & Upcoming</span>
            <div className="stat-card-icon-box" style={{ color: 'var(--success)', backgroundColor: 'var(--success-subtle)' }}>
              <Sparkles size={18} />
            </div>
          </div>
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>{stats.activeEvents}</div>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Currently live on portal</span>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Total Impressions</span>
            <div className="stat-card-icon-box" style={{ color: 'var(--accent-primary)', backgroundColor: 'var(--accent-subtle)' }}>
              <Eye size={18} />
            </div>
          </div>
          <div className="stat-card-value">{stats.totalViews.toLocaleString()}</div>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Student engagement views</span>
        </div>
      </div>

      {/* Profile Details Card */}
      <div className="card-box">
        <div className="card-box-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={18} color="var(--accent-primary)" />
            <h3 className="card-box-title">Organization Information</h3>
          </div>
          {!isEditingName && (
            <button
              type="button"
              onClick={() => {
                setNameInput(orgData?.name || profile?.org_name || '');
                setIsEditingName(true);
                setErrorMsg(null);
              }}
              className="btn btn-ghost btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', fontWeight: 700 }}
            >
              <Edit3 size={14} />
              <span>Edit Club Name</span>
            </button>
          )}
        </div>

        <div className="card-box-body">
          {errorMsg && (
            <div style={{ padding: '10px 14px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>
              {errorMsg}
            </div>
          )}

          <div className="table-wrapper">
            <table className="modern-table">
              <tbody>
                {/* Organization Name Row */}
                <tr>
                  <td style={{ width: '220px', color: 'var(--text-dim)', fontWeight: 600, verticalAlign: 'middle' }}>
                    Organization / Club Name
                  </td>
                  <td>
                    {isEditingName ? (
                      <form onSubmit={handleSaveName} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          placeholder="Enter organization name..."
                          autoFocus
                          disabled={saving}
                          className="form-input"
                          style={{ maxWidth: '340px', padding: '8px 12px', fontSize: '14px', fontWeight: 600 }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="submit"
                            disabled={saving}
                            className="btn btn-primary btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            {saving ? (
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Check size={14} />
                            )}
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                              setIsEditingName(false);
                              setErrorMsg(null);
                            }}
                            className="btn btn-ghost btn-sm"
                          >
                            <X size={14} />
                            <span>Cancel</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main)' }}>
                          {orgData?.name || profile?.org_name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNameInput(orgData?.name || profile?.org_name || '');
                            setIsEditingName(true);
                          }}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '4px 8px', color: 'var(--accent-primary)' }}
                          title="Edit Name"
                        >
                          <Edit3 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>

                {/* Organization UUID */}
                <tr>
                  <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Fingerprint size={14} />
                      <span>Organization UUID</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <code className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-base)', padding: '4px 8px', borderRadius: '6px' }}>
                        {profile?.org_id}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(profile?.org_id || '', 'Organization UUID')}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '4px 8px' }}
                        title="Copy UUID"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Administrator Email */}
                <tr>
                  <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} />
                      <span>Administrator Email</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                    {user?.email}
                  </td>
                </tr>

                {/* Account Permissions */}
                <tr>
                  <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={14} />
                      <span>Account Permissions</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-accent" style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 800 }}>
                      AUTHORIZED ORGANIZER
                    </span>
                  </td>
                </tr>

                {/* Registered Timestamp */}
                {orgData?.created_at && (
                  <tr>
                    <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} />
                        <span>Registered On</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
                      {new Date(orgData.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
