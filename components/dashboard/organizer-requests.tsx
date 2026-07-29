'use client';

import { useEffect, useState } from 'react';

interface SupportingDocument {
  url: string;
  name: string;
  [key: string]: unknown;
}

interface OrganizerRequest {
  id: string;
  user_id: string;
  organization_name: string;
  description: string;
  supporting_documents: SupportingDocument[];
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  profiles: {
    id: string;
    email: string;
    full_name: string | null;
    registration_number: string | null;
  };
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function OrganizerRequests() {
  const [requests, setRequests] = useState<OrganizerRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<OrganizerRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const response = await fetch(`/api/admin/organizers?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch organizer requests');
      }

      const data = await response.json();
      setRequests(data.data || []);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [pagination.page, statusFilter]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchRequests();
  };

  const handleApprove = async (applicationId: string, notes?: string) => {
    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/organizers/${applicationId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes || '' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to approve application');
      }

      // Refresh the list
      await fetchRequests();
      setSelectedRequest(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve application');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (applicationId: string, notes: string) => {
    if (!notes.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/organizers/${applicationId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reject application');
      }

      // Refresh the list
      await fetchRequests();
      setSelectedRequest(null);
      setShowRejectDialog(false);
      setRejectNotes('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject application');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
    };
    return statusMap[status] || status;
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1400px] mx-auto animate-fadeIn">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/10 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#ff914d]">
            <span>Super Admin</span>
            <span>•</span>
            <span>Platform Governance</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mt-1 font-display">
            Organizer Requests
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Review, approve, or manage pending organizer registration applications across
            LPU.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-3">
            <span className="text-xs text-white/40 font-semibold uppercase tracking-wider">
              Pending Approval
            </span>
            <span className="text-lg font-bold text-[#ff914d] font-display">
              {requests.filter((r) => r.status === 'pending').length}
            </span>
          </div>
        </div>
      </header>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-[20px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search by organization or contact name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
          />
        </div>

        <div className="flex gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ].map((status) => (
            <button
              key={status.value}
              onClick={() => setStatusFilter(status.value)}
              className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wider transition-all border ${statusFilter === status.value
                  ? 'bg-[#ff914d] text-[#050507] border-[#ff914d]'
                  : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-400">
          <p className="font-semibold">Error loading requests</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={fetchRequests}
            className="mt-3 px-4 py-2 bg-rose-500/20 rounded-lg text-sm font-bold hover:bg-rose-500/30 transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/5 backdrop-blur-md p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-white/10 border-t-[#ff914d]"></div>
          <p className="text-white/60 mt-4">Loading organizer requests...</p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <>
          <div className="border border-white/10 rounded-2xl overflow-hidden bg-white/5 backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-white/50 text-xs font-semibold uppercase tracking-wider bg-white/2">
                    <th className="py-4 px-6">Organization</th>
                    <th className="py-4 px-6">Contact Person</th>
                    <th className="py-4 px-6">Email</th>
                    <th className="py-4 px-6">Submitted Date</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm text-white/80">
                  {requests.map((req) => (
                    <tr
                      key={req.id}
                      className="hover:bg-white/5 transition-colors group"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#ff914d]/10 border border-[#ff914d]/20 text-[#ff914d] flex items-center justify-center font-bold text-sm">
                            {req.organization_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-white group-hover:text-[#ff914d] transition-colors">
                              {req.organization_name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-medium text-white">
                        {req.profiles.full_name || 'N/A'}
                      </td>
                      <td className="py-4 px-6 text-xs text-white/70">
                        {req.profiles.email}
                      </td>
                      <td className="py-4 px-6 text-xs text-white/60">
                        {formatDate(req.created_at)}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${req.status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : req.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${req.status === 'approved'
                                ? 'bg-emerald-400'
                                : req.status === 'pending'
                                  ? 'bg-amber-400'
                                  : 'bg-rose-400'
                              }`}
                          ></span>
                          {getStatusDisplay(req.status)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setSelectedRequest(req)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-[#ff914d] bg-[#ff914d]/10 border border-[#ff914d]/20 hover:bg-[#ff914d]/20 transition-all flex items-center gap-1 ml-auto"
                        >
                          Review Application{' '}
                          <span className="material-symbols-outlined text-[16px]">
                            visibility
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}

                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-white/40">
                        No organizer requests found matching your filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-between items-center">
              <p className="text-sm text-white/60">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} results
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                  disabled={pagination.page === 1}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Review Drawer / Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0f0e0b] border border-white/10 rounded-3xl max-w-2xl w-full p-8 flex flex-col gap-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedRequest(null)}
              className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>

            <div className="flex items-center gap-4 border-b border-white/10 pb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#ff914d]/10 border border-[#ff914d]/30 text-[#ff914d] flex items-center justify-center font-bold text-xl font-display">
                {selectedRequest.organization_name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <span className="text-xs font-bold text-[#ff914d] uppercase tracking-wider">
                  Application Review
                </span>
                <h2 className="text-2xl font-bold text-white font-display mt-0.5">
                  {selectedRequest.organization_name}
                </h2>
                <p className="text-xs text-white/50">
                  Status: {getStatusDisplay(selectedRequest.status)}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-6 text-sm">
              <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                <div>
                  <p className="text-xs text-white/40 font-semibold uppercase">
                    Contact Person
                  </p>
                  <p className="text-white font-semibold mt-1">
                    {selectedRequest.profiles.full_name || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/40 font-semibold uppercase">
                    Email Address
                  </p>
                  <p className="text-[#ff914d] font-semibold mt-1">
                    {selectedRequest.profiles.email}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/40 font-semibold uppercase">
                    Registration Number
                  </p>
                  <p className="text-white font-semibold mt-1">
                    {selectedRequest.profiles.registration_number || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/40 font-semibold uppercase">
                    Application Date
                  </p>
                  <p className="text-white font-semibold mt-1">
                    {formatDate(selectedRequest.created_at)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-2">
                  Organization Overview
                </p>
                <p className="text-white/80 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5 text-sm">
                  {selectedRequest.description}
                </p>
              </div>

              {selectedRequest.review_notes && (
                <div>
                  <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-2">
                    Review Notes
                  </p>
                  <p className="text-white/80 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5 text-sm">
                    {selectedRequest.review_notes}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            {selectedRequest.status === 'pending' && (
              <div className="flex flex-col sm:flex-row justify-end items-center gap-3 pt-6 border-t border-white/10 mt-2">
                <button
                  onClick={() => setShowRejectDialog(true)}
                  disabled={actionLoading}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all disabled:opacity-50"
                >
                  Reject Application
                </button>
                <button
                  onClick={() => handleApprove(selectedRequest.id)}
                  disabled={actionLoading}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-[#050507] bg-[#ff914d] hover:bg-[#e07530] transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(255,145,77,0.3)] disabled:opacity-50"
                >
                  {actionLoading ? (
                    'Processing...'
                  ) : (
                    <>
                      Approve Organizer{' '}
                      <span className="material-symbols-outlined text-sm">
                        check_circle
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && selectedRequest && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f0e0b] border border-white/10 rounded-2xl max-w-md w-full p-6 flex flex-col gap-4">
            <h3 className="text-xl font-bold text-white">Reject Application</h3>
            <p className="text-sm text-white/60">
              Please provide a reason for rejecting this application:
            </p>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all min-h-[100px]"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectNotes('');
                }}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedRequest.id, rejectNotes)}
                disabled={actionLoading || !rejectNotes.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}