import React, { useState, useEffect } from 'react';
import { supabase, lpuClient } from '../../supabase';

export const AccessRequestsPanel: React.FC<{ onNavigateToApproved?: () => void }> = ({ onNavigateToApproved }) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');

  // Manual Add Modal State (Email Only)
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [manualAddLoading, setManualAddLoading] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: reqsErr } = await supabase
        .from('organizer_access_requests')
        .select('id, admin_user_id, organization_name, remarks, status, review_reason, created_at, updated_at, admin_users!admin_user_id(email, display_name)')
        .order('created_at', { ascending: false });

      if (reqsErr) throw reqsErr;
      setRequests(data || []);
    } catch (err: any) {
      console.error('Failed to load access requests:', err);
      setError('Failed to load access requests: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Direct 1-click Approval without notes
  const handleDirectApprove = async (reqId: string, orgName: string) => {
    setActionLoadingId(reqId);
    setError('');
    setSuccess('');
    try {
      const { data, error: reviewErr } = await lpuClient.reviewAccessRequest(
        reqId,
        'APPROVED',
        'Approved by Super Administrator'
      );
      if (reviewErr) {
        throw new Error(typeof reviewErr === 'object' ? reviewErr.message || JSON.stringify(reviewErr) : reviewErr);
      }
      if (data && data.error) {
        throw new Error(data.error);
      }
      setSuccess(`Successfully approved organizer access for "${orgName}".`);
      await fetchRequests();
    } catch (err: any) {
      console.error('Approval failed:', err);
      setError('Approval failed: ' + (err.message || 'Unknown error occurred.'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Direct 1-click Rejection without notes
  const handleDirectReject = async (reqId: string, orgName: string) => {
    setActionLoadingId(reqId);
    setError('');
    setSuccess('');
    try {
      const { data, error: reviewErr } = await lpuClient.reviewAccessRequest(
        reqId,
        'REJECTED',
        'Declined by Super Administrator'
      );
      if (reviewErr) {
        throw new Error(typeof reviewErr === 'object' ? reviewErr.message || JSON.stringify(reviewErr) : reviewErr);
      }
      if (data && data.error) {
        throw new Error(data.error);
      }
      setSuccess(`Declined request for "${orgName}".`);
      await fetchRequests();
    } catch (err: any) {
      console.error('Rejection failed:', err);
      setError('Rejection failed: ' + (err.message || 'Unknown error occurred.'));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Manual Pre-approval / Add by Email (Email Only)
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim()) {
      setError('Please enter an organizer email address.');
      return;
    }

    setManualAddLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data, error: addErr } = await supabase.rpc('add_organizer_manually', {
        p_email: addEmail.trim()
      });

      if (addErr) throw addErr;
      if (data && data.error) throw new Error(data.error);

      setSuccess(`Organizer "${addEmail.trim()}" added successfully. When they log in for the first time, they will have instant organizer access.`);
      setShowAddModal(false);
      setAddEmail('');
      await fetchRequests();
    } catch (err: any) {
      console.error('Manual add error:', err);
      setError('Failed to add organizer: ' + (err.message || 'Unknown error'));
    } finally {
      setManualAddLoading(false);
    }
  };

  const filteredRequests = filter === 'ALL' ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#ff6b00]/10 text-[#ff6b00] text-xs font-bold px-2.5 py-0.5 rounded-full border border-[#ff6b00]/20 uppercase">
              Security Governance
            </span>
            <span className="text-xs text-[#5a4136] dark:text-[#ffb693]">Organizer Access Gate</span>
          </div>
          <h2 className="text-3xl font-extrabold font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
            Organizer Access Requests
          </h2>
          <p className="text-sm text-[#5a4136] dark:text-[#ffb693] mt-1">
            Review incoming organizer credential requests, or add organizer emails manually for instant first-time login access.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onNavigateToApproved && (
            <button
              onClick={onNavigateToApproved}
              className="flex items-center gap-1.5 bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] text-[#261812] dark:text-[#ffede6] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26] px-4 py-2.5 rounded-lg text-xs font-bold shadow-sm transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">badge</span>
              Approved Registry
            </button>
          )}

          <button
            onClick={fetchRequests}
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

      {/* Feedback Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center justify-between gap-3 text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">error</span>
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="hover:opacity-70">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-3 text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="hover:opacity-70">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] rounded-xl shadow-sm overflow-hidden">
        {/* Filter Toolbar */}
        <div className="p-4 border-b border-[#e2bfb0] dark:border-[#5a4136] bg-[#fff8f6] dark:bg-[#1a120e] flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base font-['Outfit'] text-[#261812] dark:text-[#ffede6]">
              Access Inquiries
            </h3>
            <span className="bg-[#ff6b00] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
              {filteredRequests.length}
            </span>
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-[#261812] border border-[#e2bfb0] dark:border-[#5a4136] p-1 rounded-lg">
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                  filter === f
                    ? 'bg-[#ff6b00] text-white shadow-sm'
                    : 'text-[#5a4136] dark:text-[#ffb693] hover:bg-[#fee3d8] dark:hover:bg-[#3d2d26]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Requests Table */}
        {loading ? (
          <div className="p-12 text-center text-[#5a4136] dark:text-[#ffb693] flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-[#ff6b00] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold">Loading access requests...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-[#5a4136] dark:text-[#ffb693] flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[48px] text-[#8e7164]">person_check</span>
            <h4 className="text-base font-bold text-[#261812] dark:text-[#ffede6]">No {filter.toLowerCase()} requests</h4>
            <p className="text-xs">There are currently no access requests matching this filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#fff1eb] dark:bg-[#1a120e] text-xs font-bold text-[#5a4136] dark:text-[#ffb693] uppercase tracking-wider border-b border-[#e2bfb0] dark:border-[#5a4136]">
                  <th className="p-4">Requester Identity</th>
                  <th className="p-4">Club / Organization</th>
                  <th className="p-4">Applicant Note</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Date Submitted</th>
                  <th className="p-4 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2bfb0] dark:divide-[#5a4136] text-sm">
                {filteredRequests.map((req) => {
                  const isRowLoading = actionLoadingId === req.id;
                  return (
                    <tr key={req.id} className="hover:bg-[#fff8f6] dark:hover:bg-[#3d2d26]/40 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-[#261812] dark:text-[#ffede6]">
                          {req.admin_users?.display_name || 'Organizer Applicant'}
                        </div>
                        <div className="text-xs text-[#5a4136] dark:text-[#ffb693] font-mono">
                          {req.admin_users?.email}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2 font-bold text-[#a04100] dark:text-[#ffb693]">
                          <span className="material-symbols-outlined text-[18px]">corporate_fare</span>
                          <span>{req.organization_name}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <p className="text-xs text-[#5a4136] dark:text-[#ffb693] max-w-xs line-clamp-2">
                          {req.remarks || 'No remarks provided'}
                        </p>
                      </td>

                      <td className="p-4">
                        {req.status === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            Pending Review
                          </span>
                        ) : req.status === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            Rejected
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-xs text-[#5a4136] dark:text-[#ffb693]">
                        {new Date(req.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>

                      <td className="p-4 text-right">
                        {req.status === 'PENDING' ? (
                          <div className="inline-flex items-center gap-2 justify-end">
                            <button
                              disabled={isRowLoading}
                              onClick={() => handleDirectApprove(req.id, req.organization_name)}
                              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-sm transition-all inline-flex items-center gap-1"
                              title="Directly approve this organizer request"
                            >
                              {isRowLoading ? (
                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                              )}
                              <span>Approve</span>
                            </button>

                            <button
                              disabled={isRowLoading}
                              onClick={() => handleDirectReject(req.id, req.organization_name)}
                              className="border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 disabled:opacity-50 text-xs font-bold px-3 py-1.5 rounded-lg transition-all inline-flex items-center gap-1"
                              title="Decline this request"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[#5a4136] dark:text-[#ffb693] italic">
                            {req.review_reason ? req.review_reason : 'Finalized'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
                  disabled={manualAddLoading}
                  className="px-4 py-2 rounded-lg border border-[#e2bfb0] dark:border-[#5a4136] font-bold text-[#5a4136] dark:text-[#ffb693]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualAddLoading}
                  className="px-5 py-2 rounded-lg bg-[#ff6b00] hover:bg-[#a04100] text-white font-bold shadow flex items-center gap-1.5"
                >
                  {manualAddLoading ? (
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
    </div>
  );
};
