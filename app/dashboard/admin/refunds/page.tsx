'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SignOutButton } from '@/components/auth/sign-out-button';

interface RefundRecord {
  id: string;
  payment_id: string;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
  razorpay_refund_id: string | null;
}

interface CapturedPayment {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  razorpay_payment_id: string | null;
  profiles: {
    display_name: string | null;
    email: string | null;
  }[] | null;
  registrations: {
    id: string;
    events: {
      id: string;
      title: string;
    }[] | null;
  }[] | null;
  refunds: RefundRecord[] | null;
}

interface AdminProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export default function AdminRefundsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  
  const [payments, setPayments] = useState<CapturedPayment[]>([]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Refund dialog state
  const [activePayment, setActivePayment] = useState<CapturedPayment | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState<number>(0);

  const loadData = useCallback(async () => {
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

      if (profileErr || !profile || (profile.role !== 'super_admin' && profile.role !== 'admin')) {
        setError('Unauthorized access. This area is restricted to super administrators and admins.');
        setLoading(false);
        return;
      }
      setAdminProfile(profile);

      // 2. Fetch captured payments with registrations, events, and existing refunds
      const { data: list, error: listErr } = await supabase
        .from('payments')
        .select(`
          id,
          amount,
          status,
          created_at,
          razorpay_payment_id,
          profiles!payments_user_id_fkey(display_name, email),
          registrations!payments_registration_id_fkey(
            id,
            events(id, title)
          ),
          refunds(id, payment_id, amount, reason, status, created_at, razorpay_refund_id)
        `)
        .eq('status', 'captured')
        .order('created_at', { ascending: false });

      if (listErr) throw listErr;
      setPayments((list || []) as CapturedPayment[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Failed to load transaction registers.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    (async () => {
      await loadData();
    })();
  }, [loadData]);

  // Open Refund dialog
  const openRefundDialog = (payment: CapturedPayment) => {
    setActivePayment(payment);
    setRefundAmount(payment.amount);
    setRefundReason('');
  };

  // Submit Refund Execution
  const handleInitiateRefund = async () => {
    if (!activePayment || !adminProfile) {
      if (!adminProfile) setError('Admin profile not loaded.');
      return;
    }
    setSubmittingId(activePayment.id);
    setError(null);

    try {
      // Call initiate_refund database RPC
      const { error: rpcErr } = await supabase.rpc('initiate_refund', {
        p_payment_id: activePayment.id,
        p_admin_id: adminProfile.id,
        p_amount: refundAmount,
        p_reason: refundReason || 'Standard Refund'
      });

      if (rpcErr) throw rpcErr;

      // Close modal and reload dashboard data
      setActivePayment(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Failed to initiate database refund transaction.');
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050507] text-[#e6e2dc] flex items-center justify-center p-6">
        <div className="text-center space-y-4 animate-pulse">
          <div className="w-10 h-10 rounded-full border-t-2 border-[#ff914d] mx-auto animate-spin" />
          <p className="text-sm text-white/40">Loading Refund Registers...</p>
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
              Refund Executive
            </h1>
            <p className="text-sm text-white/60">
              Review captured client payments, track active refunds, and execute financial compensations.
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

        {/* Transaction History Register */}
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-6">
          <h3 className="text-lg font-bold text-white font-display">Captured Payments</h3>

          <div className="overflow-x-auto border border-white/5 rounded-2xl">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-white/5 text-white/60 font-bold border-b border-white/5">
                  <th className="py-3 px-4">Razorpay Payment ID</th>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Refund Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80">
                {payments.length > 0 ? (
                  payments.map((p) => {
                    const hasRefund = p.refunds && p.refunds.length > 0;
                    const refund = hasRefund ? p.refunds![0] : null;

                    return (
                      <tr key={p.id} className="hover:bg-white/2 transition">
                        <td className="py-3 px-4 font-mono text-xs text-white font-medium">
                          {p.razorpay_payment_id || '—'}
                        </td>
                        <td className="py-3 px-4 text-white max-w-[200px] truncate">
                          {p.registrations?.[0]?.events?.[0]?.title || 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-xs">
                            <p className="font-semibold text-white">{p.profiles?.[0]?.display_name || 'N/A'}</p>
                            <p className="text-white/40">{p.profiles?.[0]?.email || 'N/A'}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">₹{p.amount}</td>
                        <td className="py-3 px-4 text-white/40">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          {refund ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                              refund.status === 'processed' ? 'bg-[#ff914d]/10 text-[#ff914d]' :
                              refund.status === 'failed' ? 'bg-rose-500/10 text-rose-400' :
                              'bg-amber-500/10 text-amber-400 animate-pulse'
                            }`}>
                              {refund.status}
                            </span>
                          ) : (
                            <span className="text-xs text-white/30">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!hasRefund ? (
                            <button
                              onClick={() => openRefundDialog(p)}
                              className="px-3.5 py-1.5 rounded-lg bg-[#ff914d] hover:bg-[#e07530] text-xs font-semibold text-[#050507] transition"
                            >
                              Refund
                            </button>
                          ) : (
                            <button
                              disabled
                              className="px-3.5 py-1.5 rounded-lg border border-white/5 bg-white/2 text-xs font-semibold text-white/20 cursor-not-allowed"
                            >
                              Initiated
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-white/40">
                      No captured payments found in database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Refund Request dialog modal */}
      {activePayment && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-[480px] rounded-[32px] border border-white/10 bg-[#0c0c0f] p-8 space-y-6 shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white font-display">Initiate Refund</h3>
              <p className="text-xs text-white/60">
                You are executing a Razorpay refund for payment: <strong>{activePayment.razorpay_payment_id}</strong> (Amount: ₹{activePayment.amount})
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Refund Amount (INR)</label>
                <input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value))}
                  max={activePayment.amount}
                  min={1}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Justification / Reason</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  required
                  placeholder="e.g. Student cancelled registration, or event was postponed."
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setActivePayment(null)}
                className="px-4 py-2.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={handleInitiateRefund}
                disabled={submittingId !== null || refundAmount <= 0 || refundAmount > activePayment.amount || !refundReason}
                className="px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-xs font-semibold text-white transition disabled:opacity-50"
              >
                {submittingId === activePayment.id ? 'Processing...' : 'Execute Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
