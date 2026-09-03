import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';

export const ApprovedOrganizersPanel: React.FC = () => {
  const [organizers, setOrganizers] = useState<any[]>([]);
  const [preApproved, setPreApproved] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'ACTIVE' | 'PRE_APPROVED' | 'ALL'>('ALL');

  // Revoke state
  const [revokingTarget, setRevokingTarget] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Manual Add Modal State (Email Only)
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmail, setAddEmail] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');

    let orgsList: any[] = [];
    let preAppsList: any[] = [];

    try {
      // 1. Try querying organization_members joined with admin_users and organizations
      const { data: members, error: mErr } = await supabase
        .from('organization_members')
        .select(`
          id,
          role,
          is_active,
          created_at,
          admin_user_id,
          organization_id,
          admin_users (display_name, email),
          organizations (name)
        `)
        .eq('role', 'ORGANIZER');

      if (!mErr && Array.isArray(members)) {
        orgsList = members.map((m: any) => ({
          member_id: m.id,
          admin_user_id: m.admin_user_id,
          display_name: m.admin_users?.display_name || (m.admin_users?.email ? m.admin_users.email.split('@')[0] : 'Organizer'),
          email: m.admin_users?.email || '',
          organization_id: m.organization_id,
          organization_name: m.organizations?.name || 'Organization',
          role: m.role,
          is_active: m.is_active,
          granted_at: m.created_at,
          type: 'ACTIVE_MEMBER'
        }));
      } else {
        // Fallback to RPC
        const { data: rpcData } = await supabase.rpc('get_approved_organizers');
        if (Array.isArray(rpcData)) {
          orgsList = rpcData;
        }
      }
    } catch (err) {
      console.error('Error loading active members:', err);
    }

    try {
      // 2. Query pre-approved organizers
      const { data: preApps, error: pErr } = await supabase
        .from('pre_approved_organizers')
        .select('id, email, organization_name, remarks, is_claimed, claimed_at, created_at')
        .order('created_at', { ascending: false });

      if (!pErr && Array.isArray(preApps)) {
        preAppsList = preApps;
      } else {
        const { data: rpcPre } = await supabase.rpc('get_pre_approved_organizers');
        if (Array.isArray(rpcPre)) {
          preAppsList = rpcPre;
        }
      }
    } catch (err) {
      console.error('Error loading pre-approved:', err);
    }

    setOrganizers(orgsList);
    setPreApproved(preAppsList);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Manual Add (Email Only)
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = addEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid organizer email address.');
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data, error: addErr } = await supabase.rpc('add_organizer_manually', {
        p_email: cleanEmail
      });

      if (addErr) throw addErr;
      if (data && data.error) throw new Error(data.error);

      setSuccess(`Organizer "${cleanEmail}" added successfully. When they log in with this email, they will have instant organizer access.`);
      setShowAddModal(false);
      setAddEmail('');
      await fetchData();
    } catch (err: any) {
      console.error('Error adding organizer:', err);
      setError('Failed to add organizer: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Revoke Access
  const handleRevoke = async () => {
    if (!revokingTarget) return;
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const params: any = {};
      if (revokingTarget.member_id) {
        params.p_member_id = revokingTarget.member_id;
      }
      if (revokingTarget.admin_user_id && revokingTarget.organization_id) {
        params.p_admin_user_id = revokingTarget.admin_user_id;
        params.p_organization_id = revokingTarget.organization_id;
      }
      if (revokingTarget.is_pre_approved_id) {
        params.p_pre_approved_id = revokingTarget.is_pre_approved_id;
      }

      const { data, error: revErr } = await supabase.rpc('revoke_organizer_access', params);
      if (revErr) throw revErr;
      if (data && data.error) throw new Error(data.error);

      setSuccess(`Access revoked for ${revokingTarget.email}.`);
      setRevokingTarget(null);
      await fetchData();
    } catch (err: any) {
      console.error('Error revoking access:', err);
      setError('Failed to revoke access: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Combine active members + pre-approved
  const allList = [
    ...organizers.map((o) => ({
      ...o,
      isPreApproved: false,
      statusLabel: 'Active Organizer'
    })),
    ...preApproved
      .filter((p) => !organizers.some((o) => o.email.toLowerCase() === p.email.toLowerCase() && o.organization_id === p.organization_id))
      .map((p) => ({
        member_id: null,
        is_pre_approved_id: p.id,
        display_name: 'Pending First Login',
        email: p.email,
        organization_id: p.organization_id,
        organization_name: p.organization_name,
        role: 'ORGANIZER',
        is_active: true,
        granted_at: p.created_at,
        isPreApproved: true,
        statusLabel: 'Pre-Approved (Awaiting Login)'
      }))
  ];

  const filteredList = allList.filter((item) => {
    const term = search.toLowerCase().trim();
    const matchesSearch =
      !term ||
      item.email?.toLowerCase().includes(term) ||
      item.display_name?.toLowerCase().includes(term) ||
      item.organization_name?.toLowerCase().includes(term);

    if (!matchesSearch) return false;
    if (tab === 'ACTIVE') return !item.isPreApproved;
    if (tab === 'PRE_APPROVED') return item.isPreApproved;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#ff6b00]/10 text-[#ff6b00] text-xs font-bold px-2.5 py-0.5 rounded-full border border-[#ff6b00]/20 uppercase">
              Access Governance
            </span>
            <span className="text-xs text-[#5a4136] dark:text-[#ffb693]">Organizer Registry</span>
          </div>
          <h2 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
            Approved Organizers
          </h2>
          <p className="text-sm text-[#5a4136] dark:text-[#ffb693] mt-1">
            View active organizer permissions, pre-approve emails for direct access, or revoke privileges.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] text-[#261812] dark:text-[#ffede6] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] px-4 py-2.5 rounded-lg text-xs font-bold shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Refresh
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-[#ff6b00] hover:bg-[#a04100] text-white px-5 py-2.5 rounded-lg text-xs font-bold shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Add Organizer Manually
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center justify-between text-xs font-semibold shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="hover:opacity-70">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center justify-between text-xs font-semibold shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="hover:opacity-70">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5a4136] dark:text-[#ffb693] text-[18px]">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email, name or club..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#261812] text-[#261812] dark:text-[#ffede6] text-xs outline-none focus:border-[#ff6b00]"
            />
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] p-1 rounded-lg">
            {(['ALL', 'ACTIVE', 'PRE_APPROVED'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                  tab === t
                    ? 'bg-[#ff6b00] text-white shadow-sm'
                    : 'text-[#5a4136] dark:text-[#ffb693] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26]'
                }`}
              >
                {t === 'ALL' ? `All (${allList.length})` : t === 'ACTIVE' ? `Active (${organizers.length})` : `Pre-Approved (${preApproved.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-12 text-center text-[#5a4136] dark:text-[#ffb693] flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-[#ff6b00] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold">Loading approved organizers...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center text-[#5a4136] dark:text-[#ffb693] flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[48px] text-[#8e7164]">group_off</span>
            <h4 className="text-base font-bold text-[#261812] dark:text-[#ffede6]">No organizers found</h4>
            <p className="text-xs">No active or pre-approved organizers matching your filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#fff1eb] dark:bg-[#1a120e] text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider border-b border-[#e2bfb0] dark:border-[#5a4136]">
                  <th className="p-4">Organizer Identity</th>
                  <th className="p-4">Assigned Organization</th>
                  <th className="p-4">Access Status</th>
                  <th className="p-4">Granted Date</th>
                  <th className="p-4 text-right">Access Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2bfb0] dark:divide-[#5a4136] text-sm">
                {filteredList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#fff8f6] dark:hover:bg-[#3d2d26]/40 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-[#261812] dark:text-[#ffede6]">
                        {item.display_name}
                      </div>
                      <div className="text-xs text-[#5a4136] dark:text-[#ffb693] font-mono">
                        {item.email}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-2 font-bold text-[#a04100] dark:text-[#ffb693]">
                        <span className="material-symbols-outlined text-[18px]">corporate_fare</span>
                        <span>{item.organization_name}</span>
                      </div>
                    </td>

                    <td className="p-4">
                      {item.isPreApproved ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          Pre-Approved (Auto-Activate on Login)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Active Organizer
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-xs text-[#5a4136] dark:text-[#ffb693]">
                      {new Date(item.granted_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => setRevokingTarget(item)}
                        className="border border-red-300 dark:border-red-800 hover:bg-red-600 hover:text-white text-red-600 dark:text-red-400 text-xs font-bold px-3 py-1.5 rounded-lg transition-all inline-flex items-center gap-1"
                        title="Revoke and remove organizer permissions"
                      >
                        <span className="material-symbols-outlined text-[16px]">person_remove</span>
                        <span>Remove Access</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Add Organizer Modal (Email Only) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-[#e2bfb0] dark:border-[#5a4136]">
              <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#ff6b00]">person_add</span>
                Add Organizer Manually
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-[#5a4136] dark:text-[#ffb693] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] rounded-full"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleManualAdd} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#261812] dark:text-[#ffede6] uppercase tracking-wider mb-1.5">
                  Organizer Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. faculty.lead@lpu.co.in or student@gmail.com"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] bg-white dark:bg-[#1a120e] text-[#261812] dark:text-[#ffede6] text-xs outline-none focus:border-[#ff6b00]"
                />
              </div>

              {/* Informative Note */}
              <div className="p-3 rounded-xl bg-[#fff8f6] dark:bg-[#1a120e] border border-[#e2bfb0] dark:border-[#5a4136] space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[#ff6b00]">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  <span>Instant First-Time Login Access</span>
                </div>
                <p className="text-[#5a4136] dark:text-[#ffb693] leading-relaxed">
                  When this user logs in with this email, the platform will automatically activate their organizer role and skip the pending access request review screen.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] font-bold text-[#5a4136] dark:text-[#ffb693]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-lg bg-[#ff6b00] hover:bg-[#a04100] text-white font-bold shadow flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">check</span>
                      <span>Pre-Approve & Add</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Dialog */}
      {revokingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <span className="material-symbols-outlined text-[32px]">warning</span>
              <h3 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
                Remove Organizer Access?
              </h3>
            </div>

            <p className="text-xs text-[#5a4136] dark:text-[#ffb693] leading-relaxed">
              Are you sure you want to revoke organizer access for{' '}
              <strong className="text-[#261812] dark:text-[#ffede6]">{revokingTarget.email}</strong>?
              They will lose access to create and manage events.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRevokingTarget(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] text-xs font-bold text-[#5a4136] dark:text-[#ffb693]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={actionLoading}
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow flex items-center gap-1.5"
              >
                {actionLoading ? (
                  <span>Revoking...</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">person_remove</span>
                    <span>Confirm Revocation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
