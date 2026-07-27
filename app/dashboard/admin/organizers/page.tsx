'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SignOutButton } from '@/components/auth/sign-out-button';

interface Application {
  id: string;
  user_id: string;
  organization_name: string;
  description: string;
  status: string;
  created_at: string;
  profiles: {
    display_name: string | null;
    email: string | null;
    registration_number: string | null;
  } | null;
}

export default function AdminOrganizersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminProfile, setAdminProfile] = useState<any | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  
  // Reject reason dialog state
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = async () => {
    try {
      // 1. Check User identity & role
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

      // 2. Fetch pending applications
      const { data: apps, error: appsErr } = await supabase
        .from('organizer_applications')
        .select(`
          id,
          user_id,
          organization_name,
          description,
          status,
          created_at,
          profiles!organizer_applications_user_id_fkey(display_name, email, registration_number)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (appsErr) throw appsErr;
      setApplications(apps as any || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load organizer applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [supabase]);

  // Handle Approve
  const handleApprove = async (appId: string) => {
    setSubmittingId(appId);
    setError(null);

    try {
      const { data, error: rpcErr } = await supabase.rpc('approve_organizer', {
        p_application_id: appId,
        p_admin_id: adminProfile.id,
        p_notes: 'Approved via Super Admin Portal'
      });

      if (rpcErr) throw rpcErr;
      
      // Remove from list
      setApplications(applications.filter(a => a.id !== appId));
    } catch (err: any) {
      setError(err.message || 'Failed to approve application.');
    } finally {
      setSubmittingId(null);
    }
  };

  // Handle Reject Submit
  const handleRejectSubmit = async () => {
    if (!rejectId) return;
    setSubmittingId(rejectId);
    setError(null);

    try {
      const { data, error: rpcErr } = await supabase.rpc('reject_organizer', {
        p_application_id: rejectId,
        p_admin_id: adminProfile.id,
        p_notes: rejectReason || 'Rejected via Super Admin Portal'
      });

      if (rpcErr) throw rpcErr;
      
      // Remove from list and reset reject states
      setApplications(applications.filter(a => a.id !== rejectId));
      setRejectId(null);
      setRejectReason('');
    } catch (err: any) {
      setError(err.message || 'Failed to reject application.');
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050507] text-[#e6e2dc] flex items-center justify-center p-6">
        <div className="text-center space-y-4 animate-pulse">
          <div className="w-10 h-10 rounded-full border-t-2 border-[#ff914d] mx-auto animate-spin" />
          <p className="text-sm text-white/40">Loading applications...</p>
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

      <div className="max-w-5xl mx-auto space-y-8 z-10 relative">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-white font-display">
              Organizer Applications
            </h1>
            <p className="text-sm text-white/60">
              Review, approve, or reject pending student coordinator privileges.
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

        <div className="space-y-6">
          {applications.length > 0 ? (
            applications.map((app) => (
              <div key={app.id} className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-white font-display">
                      {app.organization_name}
                    </h3>
                    <div className="text-xs text-white/50 space-y-0.5">
                      <p>Applicant: <strong className="text-white/80">{app.profiles?.display_name || 'N/A'}</strong></p>
                      <p>Email: <strong className="text-white/80">{app.profiles?.email || 'N/A'}</strong></p>
                      <p>Reg/Roll Number: <strong className="text-white/80">{app.profiles?.registration_number || 'N/A'}</strong></p>
                    </div>
                  </div>

                  <span className="text-xs text-white/40">
                    Received: {new Date(app.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="p-5 rounded-2xl border border-white/5 bg-white/2 space-y-2">
                  <span className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Application justification</span>
                  <p className="text-sm leading-relaxed text-white/80">{app.description}</p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setRejectId(app.id);
                      setRejectReason('');
                    }}
                    disabled={submittingId !== null}
                    className="px-5 py-2.5 rounded-xl border border-rose-500/20 hover:border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/10 text-xs font-semibold text-rose-400 transition"
                  >
                    Reject Application
                  </button>
                  <button
                    onClick={() => handleApprove(app.id)}
                    disabled={submittingId !== null}
                    className="px-5 py-2.5 rounded-xl bg-[#ff914d] hover:bg-[#e07530] text-xs font-semibold text-[#050507] transition"
                  >
                    {submittingId === app.id ? 'Approving...' : 'Approve & Promote'}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[32px] border border-white/10 bg-white/5 p-12 text-center text-white/40">
              No pending organizer applications to review.
            </div>
          )}
        </div>
      </div>

      {/* Reject Reason Dialog Modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-[480px] rounded-[32px] border border-white/10 bg-[#0c0c0f] p-8 space-y-6 shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white font-display">Reject Application</h3>
              <p className="text-sm text-white/60">
                Please provide rejection comments. This will be logged in the application audit files.
              </p>
            </div>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              required
              placeholder="e.g. Profile justification is incomplete, or invalid registration number."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all resize-none"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRejectId(null)}
                className="px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={submittingId !== null}
                className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-xs font-semibold text-white transition"
              >
                {submittingId === rejectId ? 'Rejecting...' : 'Reject Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
