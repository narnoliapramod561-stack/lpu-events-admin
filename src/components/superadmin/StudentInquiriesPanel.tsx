import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabase';
import { 
  Mail, 
  Search, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  RotateCw, 
  Download, 
  MessageSquare, 
  Reply,
  ShieldAlert,
  FileText,
  Tag,
  Power,
  PauseCircle
} from 'lucide-react';
import { LoadingSpinner } from '../shell/LoadingState';
import { EmptyState } from '../shell/EmptyState';

export interface StudentInquiry {
  id: string;
  name: string;
  email: string | null;
  subject: string;
  message: string;
  device_id?: string;
  device_date?: string;
  status: 'OPEN' | 'RESOLVED' | 'SPAM';
  created_at: string;
  resolved_at?: string | null;
  admin_notes?: string | null;
}

export const StudentInquiriesPanel: React.FC = () => {
  const [inquiries, setInquiries] = useState<StudentInquiry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED' | 'SPAM'>('ALL');
  const [topicFilter, setTopicFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInquiry, setSelectedInquiry] = useState<StudentInquiry | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isReceptionEnabled, setIsReceptionEnabled] = useState(true);
  const [isTogglingReception, setIsTogglingReception] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getEdgeApiUrl = (endpoint: string): string => {
    const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return cleanPath;
      }
    }
    return `https://lpuevents.live${cleanPath}`;
  };

  const getAuthHeaders = async (): Promise<HeadersInit> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      return headers;
    } catch {
      return { 'Content-Type': 'application/json' };
    }
  };

  const fetchInquiries = async () => {
    setLoading(true);
    try {
      let records: StudentInquiry[] = [];

      // 1. Primary: Query Cloudflare D1 Edge Gateway (0% Supabase Compute Stress)
      try {
        const headers = await getAuthHeaders();
        const edgeRes = await fetch(getEdgeApiUrl('/api/admin/inquiries'), { headers });
        if (edgeRes.ok) {
          const json = await edgeRes.json().catch(() => ({}));
          if (Array.isArray(json.inquiries) && json.inquiries.length > 0) {
            records = json.inquiries as StudentInquiry[];
          }
        }
      } catch (edgeErr) {
        console.warn('Edge D1 fetch notice:', edgeErr);
      }

      // 2. Secondary fallback: Query Supabase primary table if D1 edge is cold or during transition
      if (records.length === 0) {
        const { data } = await supabase
          .from('student_inquiries')
          .select('*')
          .order('created_at', { ascending: false });

        if (data && data.length > 0) {
          records = data as StudentInquiry[];
        }
      }

      // 3. Tertiary fallback check from global_settings legacy queue
      if (records.length === 0) {
        try {
          const { data: legacyData } = await supabase
            .from('global_settings')
            .select('value')
            .eq('key', 'student_support_inquiries')
            .maybeSingle();

          if (legacyData?.value) {
            const parsed = Array.isArray(legacyData.value) 
              ? legacyData.value 
              : JSON.parse(String(legacyData.value));
            if (Array.isArray(parsed) && parsed.length > 0) {
              records = parsed as StudentInquiry[];
            }
          }
        } catch {}
      }

      setInquiries(records);
      if (records.length > 0 && !selectedInquiry) {
        setSelectedInquiry(records[0]);
        setAdminNoteInput(records[0].admin_notes || '');
      }

      // Check current message reception status from platform config
      try {
        const { data: deskData } = await supabase
          .from('global_settings')
          .select('value')
          .eq('key', 'contact_messages_config')
          .maybeSingle();
        if (deskData?.value && typeof deskData.value === 'object') {
          setIsReceptionEnabled((deskData.value as any).is_enabled !== false);
        }
      } catch {}
    } catch (err: any) {
      console.error('Failed to load inquiries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const handleToggleStatus = async (item: StudentInquiry, targetStatus?: 'OPEN' | 'RESOLVED' | 'SPAM') => {
    const newStatus: 'OPEN' | 'RESOLVED' | 'SPAM' = targetStatus 
    ? targetStatus 
    : item.status === 'RESOLVED' ? 'OPEN' : 'RESOLVED';

    const resolvedAt = newStatus === 'RESOLVED' ? new Date().toISOString() : null;

    try {
      // 1. Primary: Cloudflare D1 Edge update
      try {
        const headers = await getAuthHeaders();
        await fetch(getEdgeApiUrl(`/api/admin/inquiries/${item.id}`), {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: newStatus, resolved_at: resolvedAt })
        });
      } catch (edgeErr) {
        console.warn('Edge D1 status update notice:', edgeErr);
      }

      // 2. Secondary: Sync to Supabase row if present
      try {
        await supabase
          .from('student_inquiries')
          .update({
            status: newStatus,
            resolved_at: resolvedAt
          })
          .eq('id', item.id);
      } catch {}

      const updated = inquiries.map(q => {
        if (q.id === item.id) {
          return { ...q, status: newStatus, resolved_at: resolvedAt };
        }
        return q;
      });

      setInquiries(updated);
      if (selectedInquiry?.id === item.id) {
        setSelectedInquiry(prev => prev ? { ...prev, status: newStatus, resolved_at: resolvedAt } : null);
      }

      showToast(newStatus === 'RESOLVED' ? 'Marked inquiry as resolved' : newStatus === 'SPAM' ? 'Flagged inquiry as SPAM' : 'Re-opened inquiry');
    } catch (err: any) {
      alert('Error updating status: ' + (err.message || String(err)));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this message record?')) return;
    try {
      // 1. Primary: Delete from Cloudflare D1 Edge
      try {
        const headers = await getAuthHeaders();
        await fetch(getEdgeApiUrl(`/api/admin/inquiries/${id}`), {
          method: 'DELETE',
          headers
        });
      } catch (edgeErr) {
        console.warn('Edge D1 delete notice:', edgeErr);
      }

      // 2. Secondary: Delete from Supabase database
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('delete_student_inquiry', { p_id: id });
        if (rpcErr || (rpcRes && (rpcRes as any).ok === false)) {
          await supabase.from('student_inquiries').delete().eq('id', id);
        }
      } catch {}

      const updated = inquiries.filter(q => q.id !== id);
      setInquiries(updated);
      if (selectedInquiry?.id === id) {
        setSelectedInquiry(updated.length > 0 ? updated[0] : null);
      }
      showToast('Message permanently deleted');
    } catch (err: any) {
      alert('Error deleting inquiry: ' + (err.message || String(err)));
    }
  };

  const handleDeleteAll = async () => {
    if (inquiries.length === 0) return;
    const phrase = window.prompt(
      `⚠️ CRITICAL DESTRUCTIVE ACTION: You are about to permanently delete all ${inquiries.length} student inquiries.\n\nThis cannot be undone. To proceed, please type "PURGE ALL" below:`
    );
    if (phrase !== 'PURGE ALL') {
      showToast('Action cancelled: Verification phrase did not match.');
      return;
    }

    setIsDeletingAll(true);
    try {
      // 1. Primary: Delete all from Cloudflare D1 Edge Database
      try {
        const headers = await getAuthHeaders();
        await fetch(getEdgeApiUrl('/api/admin/inquiries'), {
          method: 'DELETE',
          headers
        });
      } catch (edgeErr) {
        console.warn('Edge D1 Delete All notice:', edgeErr);
      }

      // 2. Secondary: Delete all from Supabase table & legacy settings
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('delete_all_student_inquiries');
        if (rpcError || (rpcData && (rpcData as any).ok === false)) {
          await supabase.from('student_inquiries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        }
      } catch {}

      // 3. Clear legacy global_settings if any
      try {
        await supabase
          .from('global_settings')
          .update({ value: [] })
          .eq('key', 'student_support_inquiries');
      } catch {}

      setInquiries([]);
      setSelectedInquiry(null);
      setAdminNoteInput('');
      showToast('All messages permanently deleted from database');
    } catch (err: any) {
      alert('Failed to delete inquiries: ' + (err.message || String(err)));
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleSaveAdminNote = async () => {
    if (!selectedInquiry) return;
    setSavingNote(true);
    try {
      // 1. Primary: Cloudflare D1 Edge update
      try {
        const headers = await getAuthHeaders();
        await fetch(getEdgeApiUrl(`/api/admin/inquiries/${selectedInquiry.id}`), {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ admin_notes: adminNoteInput })
        });
      } catch (edgeErr) {
        console.warn('Edge D1 note update notice:', edgeErr);
      }

      // 2. Secondary: Sync to Supabase
      try {
        await supabase
          .from('student_inquiries')
          .update({ admin_notes: adminNoteInput })
          .eq('id', selectedInquiry.id);
      } catch {}

      const updated = inquiries.map(q => {
        if (q.id === selectedInquiry.id) {
          return { ...q, admin_notes: adminNoteInput };
        }
        return q;
      });

      setInquiries(updated);
      setSelectedInquiry(prev => prev ? { ...prev, admin_notes: adminNoteInput } : null);
      showToast('Internal note saved successfully');
    } catch (err: any) {
      alert('Error saving note: ' + (err.message || String(err)));
    } finally {
      setSavingNote(false);
    }
  };

  const handleToggleReception = async () => {
    const nextState = !isReceptionEnabled;
    const confirmMsg = nextState
      ? 'Resume Student Messages: Students will once again be able to submit inquiries through the contact portal. Proceed?'
      : '⚠️ PAUSE INCOMING MESSAGES: Are you sure you want to STOP accepting new message requests? Incoming submissions will be rejected at the edge gateway and student form inputs will be locked.';

    if (!window.confirm(confirmMsg)) return;

    setIsTogglingReception(true);
    try {
      const payload = {
        is_enabled: nextState,
        paused_notice: 'The campus message desk is currently paused by platform administrators. For urgent matters, please email contact@lpuevents.live directly.',
        updated_at: new Date().toISOString()
      };

      // 1. Update in global_settings
      const { data: { user } } = await supabase.auth.getUser();
      let adminId: string | undefined;
      if (user?.id) {
        const { data: au } = await supabase.from('admin_users').select('id').eq('auth_user_id', user.id).maybeSingle();
        adminId = au?.id;
      }
      if (!adminId) {
        const { data: fa } = await supabase.from('admin_users').select('id').eq('is_active', true).limit(1).maybeSingle();
        adminId = fa?.id;
      }

      await supabase
        .from('global_settings')
        .upsert({
          key: 'contact_messages_config',
          value: payload,
          description: 'Controls whether student inquiries/contact message submissions are accepted or paused platform-wide',
          updated_by: adminId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      // 2. Notify Cloudflare edge settings endpoint
      try {
        const headers = await getAuthHeaders();
        await fetch(getEdgeApiUrl('/api/admin/inquiries/settings'), {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
      } catch {}

      setIsReceptionEnabled(nextState);
      showToast(
        nextState 
          ? 'Message desk is now ACTIVE and receiving student inquiries' 
          : 'Message reception STOPPED. Student portal form is locked.'
      );
    } catch (err: any) {
      alert('Error updating reception status: ' + (err.message || String(err)));
    } finally {
      setIsTogglingReception(false);
    }
  };

  // Distinct topics list for dropdown
  const uniqueTopics = useMemo(() => {
    const set = new Set<string>();
    inquiries.forEach(i => {
      if (i.subject) set.add(i.subject.trim());
    });
    return Array.from(set).sort();
  }, [inquiries]);

  const filteredInquiries = useMemo(() => {
    return inquiries.filter(item => {
      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;

      // Topic filter
      if (topicFilter !== 'ALL' && item.subject.toLowerCase() !== topicFilter.toLowerCase()) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          item.name.toLowerCase().includes(q) ||
          (item.email && item.email.toLowerCase().includes(q)) ||
          item.subject.toLowerCase().includes(q) ||
          item.message.toLowerCase().includes(q) ||
          (item.admin_notes && item.admin_notes.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [inquiries, statusFilter, topicFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = inquiries.length;
    const open = inquiries.filter(i => i.status === 'OPEN').length;
    const resolved = inquiries.filter(i => i.status === 'RESOLVED').length;
    const spam = inquiries.filter(i => i.status === 'SPAM').length;
    return { total, open, resolved, spam };
  }, [inquiries]);

  const exportCSV = () => {
    const headers = ['ID', 'Date', 'Name', 'Email', 'Topic', 'Message', 'Status', 'Device_ID', 'Admin_Notes'];
    const rows = filteredInquiries.map(i => [
      i.id,
      new Date(i.created_at).toISOString(),
      `"${i.name.replace(/"/g, '""')}"`,
      `"${(i.email || '').replace(/"/g, '""')}"`,
      `"${i.subject.replace(/"/g, '""')}"`,
      `"${i.message.replace(/"/g, '""')}"`,
      i.status,
      `"${(i.device_id || '').replace(/"/g, '""')}"`,
      `"${(i.admin_notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lpu_message_center_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTopicColor = (topic: string) => {
    const t = topic.toLowerCase();
    if (t.includes('portal') || t.includes('access')) return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    if (t.includes('bug') || t.includes('issue') || t.includes('technical')) return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    if (t.includes('feedback') || t.includes('correction')) return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    if (t.includes('partnership') || t.includes('collaboration')) return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    return 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800';
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Header & Metrics Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#ff6b00]/10 flex items-center justify-center text-[#ff6b00]">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black font-['Outfit'] text-[#261812] dark:text-white flex items-center gap-2.5">
                Message Center
              </h2>
              <p className="text-xs sm:text-sm text-[#5a4136] dark:text-[#aeaeb2] mt-0.5">
                Review and resolve incoming messages, student inquiries, and feedback from the Contact portal.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportCSV}
            disabled={filteredInquiries.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-white dark:bg-white/[0.04] text-xs font-bold text-[#5a4136] dark:text-gray-300 hover:bg-[#fee3d8] dark:hover:bg-white/10 transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={fetchInquiries}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-white dark:bg-white/[0.04] text-xs font-bold text-[#5a4136] dark:text-gray-300 hover:bg-[#fee3d8] dark:hover:bg-white/10 transition-all shadow-xs cursor-pointer"
          >
            <RotateCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>

          {/* Kill-Switch / Pause Toggle Button */}
          <button
            onClick={handleToggleReception}
            disabled={isTogglingReception}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 ${
              isReceptionEnabled
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                : 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 animate-pulse'
            }`}
            title={isReceptionEnabled ? "Click to Stop/Pause Incoming Student Messages" : "Click to Resume Student Message Reception"}
          >
            {isReceptionEnabled ? <Power className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <PauseCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
            <span>{isReceptionEnabled ? 'Desk: Receiving' : 'Desk: PAUSED'}</span>
          </button>

          <button
            onClick={handleDeleteAll}
            disabled={inquiries.length === 0 || isDeletingAll}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all shadow-xs cursor-pointer disabled:opacity-40"
            title="Permanently Delete All Messages"
          >
            <Trash2 className="h-4 w-4" />
            <span>{isDeletingAll ? 'Deleting All...' : 'Delete All'}</span>
          </button>
        </div>
      </div>

      {/* Alert banner when message intake is paused */}
      {!isReceptionEnabled && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <PauseCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Student Message Intake Is Paused
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Student submissions are currently stopped at the edge gateway. Existing messages can still be viewed, managed, and exported below.
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleReception}
            disabled={isTogglingReception}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Power className="h-3.5 w-3.5" />
            <span>Resume Reception</span>
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#202023] p-4 rounded-2xl border border-[#e2bfb0] dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#5a4136] dark:text-gray-400 uppercase tracking-wider block">Total Inquiries</span>
            <span className="text-2xl font-black font-['Outfit'] text-[#261812] dark:text-white mt-1 block">{stats.total}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-[#5a4136] dark:text-gray-300">
            <Mail className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#202023] p-4 rounded-2xl border border-[#e2bfb0] dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Open / Pending</span>
            <span className="text-2xl font-black font-['Outfit'] text-amber-600 dark:text-amber-400 mt-1 block">{stats.open}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#202023] p-4 rounded-2xl border border-[#e2bfb0] dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Resolved</span>
            <span className="text-2xl font-black font-['Outfit'] text-emerald-600 dark:text-emerald-400 mt-1 block">{stats.resolved}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#202023] p-4 rounded-2xl border border-[#e2bfb0] dark:border-white/10 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-red-500 uppercase tracking-wider block">Spam / Flagged</span>
            <span className="text-2xl font-black font-['Outfit'] text-red-500 mt-1 block">{stats.spam}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-500">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white dark:bg-[#202023] p-4 rounded-2xl border border-[#e2bfb0] dark:border-white/10 shadow-xs">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(['ALL', 'OPEN', 'RESOLVED', 'SPAM'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === f
                  ? 'bg-[#ff6b00] text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-white/5 text-[#5a4136] dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
              }`}
            >
              {f === 'ALL' ? `All (${stats.total})` : f === 'OPEN' ? `Open (${stats.open})` : f === 'RESOLVED' ? `Resolved (${stats.resolved})` : `Spam (${stats.spam})`}
            </button>
          ))}
        </div>

        {/* Topic Filter & Search Bar */}
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-1 md:max-w-xl justify-end">
          {/* Topic Dropdown Filter */}
          <div className="w-44 shrink-0">
            <select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.04] text-xs text-[#261812] dark:text-white focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {uniqueTopics.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#5a4136]/50 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, topic, text..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.04] text-xs text-[#261812] dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner message="Loading messages..." />
        </div>
      ) : filteredInquiries.length === 0 ? (
        <EmptyState
          title="No Messages Found"
          description={searchQuery || topicFilter !== 'ALL' || statusFilter !== 'ALL' ? 'No messages match your selected filters.' : 'There are currently no inquiries in this queue.'}
          icon={<Mail size={32} />}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* List View (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            {filteredInquiries.map(item => {
              const isSelected = selectedInquiry?.id === item.id;
              const isOpen = item.status === 'OPEN';
              const isSpam = item.status === 'SPAM';
              const words = item.message.trim().split(/\s+/).filter(Boolean).length;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedInquiry(item);
                    setAdminNoteInput(item.admin_notes || '');
                  }}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#ff6b00] bg-orange-50/50 dark:bg-[#ff6b00]/10 shadow-xs ring-1 ring-[#ff6b00]/20'
                      : 'border-[#e2bfb0] dark:border-white/10 bg-white dark:bg-[#202023] hover:border-orange-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Badges: Status + Topic */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          isOpen 
                            ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-700' 
                            : isSpam
                            ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700'
                            : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
                        }`}>
                          {item.status}
                        </span>

                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border truncate max-w-[220px] ${getTopicColor(item.subject)}`}>
                          <Tag className="h-2.5 w-2.5 inline mr-1" />
                          {item.subject}
                        </span>

                        <span className="text-[10px] text-gray-400 font-mono">
                          {words} words
                        </span>
                      </div>

                      {/* Sender line */}
                      <h4 className="text-sm font-bold text-[#261812] dark:text-white truncate">
                        {item.name}
                        {item.email && (
                          <span className="font-normal text-xs text-[#5a4136]/80 dark:text-gray-400 ml-1.5">
                            ({item.email})
                          </span>
                        )}
                      </h4>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-[#5a4136]/60 dark:text-gray-400 flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" />
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Message Snippet */}
                  <p className="mt-2 text-xs text-[#5a4136] dark:text-gray-300 line-clamp-2 leading-relaxed">
                    {item.message}
                  </p>

                  {/* Bottom Action Row */}
                  <div className="mt-3.5 pt-3 border-t border-[#e2bfb0]/40 dark:border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {item.email ? (
                        <a
                          href={`mailto:${item.email}?subject=${encodeURIComponent('Re: ' + item.subject)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#ff6b00] hover:underline"
                        >
                          <Reply className="h-3.5 w-3.5" />
                          <span>Reply via Email</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">No email provided</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(item);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          isOpen 
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                            : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        {isOpen ? 'Mark Resolved' : 'Re-open'}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(item, item.status === 'SPAM' ? 'OPEN' : 'SPAM');
                        }}
                        className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          isSpam 
                            ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40' 
                            : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40'
                        }`}
                        title={isSpam ? 'Unmark Spam' : 'Mark as Spam'}
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                        title="Delete Message Permanently"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Details Pane (5 cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-[#202023] border border-[#e2bfb0] dark:border-white/10 rounded-2xl p-6 shadow-xs sticky top-24 space-y-5">
            {selectedInquiry ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-[#e2bfb0]/40 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#ff6b00]" />
                    <span className="text-xs font-black text-[#5a4136]/70 dark:text-gray-400 uppercase tracking-wider">
                      Message Details
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    selectedInquiry.status === 'OPEN' 
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' 
                      : selectedInquiry.status === 'SPAM'
                      ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}>
                    {selectedInquiry.status}
                  </span>
                </div>

                {/* Topic & Sender Info Card */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getTopicColor(selectedInquiry.subject)}`}>
                      {selectedInquiry.subject}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-[#e2bfb0]/40 dark:border-white/10 text-xs space-y-1.5">
                    <p className="font-bold text-[#261812] dark:text-white flex items-center justify-between">
                      <span>Sender: {selectedInquiry.name}</span>
                      <span className="text-[10px] font-mono text-gray-400">
                        {selectedInquiry.message.trim().split(/\s+/).filter(Boolean).length} words
                      </span>
                    </p>
                    <p className="text-[#5a4136] dark:text-gray-300">
                      Email:{' '}
                      {selectedInquiry.email ? (
                        <a href={`mailto:${selectedInquiry.email}`} className="text-[#ff6b00] font-bold underline">
                          {selectedInquiry.email}
                        </a>
                      ) : (
                        <span className="text-gray-400 italic">No email provided</span>
                      )}
                    </p>
                    <p className="text-[11px] text-[#5a4136]/60 dark:text-gray-400">
                      Received: {new Date(selectedInquiry.created_at).toLocaleString()}
                    </p>
                    {selectedInquiry.device_id && (
                      <p className="text-[10px] text-gray-400 font-mono truncate" title={selectedInquiry.device_id}>
                        Device Fingerprint: {selectedInquiry.device_id}
                      </p>
                    )}
                  </div>
                </div>

                {/* Full Message Body */}
                <div>
                  <label className="text-xs font-bold text-[#261812] dark:text-white block mb-1.5">
                    Full Message
                  </label>
                  <div className="p-4 rounded-xl bg-gray-50/80 dark:bg-black/30 border border-[#e2bfb0]/40 dark:border-white/10 text-xs text-[#261812] dark:text-white leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {selectedInquiry.message}
                  </div>
                </div>

                {/* Admin Notes */}
                <div>
                  <label className="text-xs font-bold text-[#261812] dark:text-white block mb-1.5">
                    Internal Admin Notes
                  </label>
                  <textarea
                    value={adminNoteInput}
                    onChange={(e) => setAdminNoteInput(e.target.value)}
                    rows={3}
                    placeholder="Add notes, resolution details, or action items..."
                    className="w-full p-2.5 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-white dark:bg-white/[0.02] text-xs text-[#261812] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#ff6b00]/20"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={handleSaveAdminNote}
                      disabled={savingNote}
                      className="px-3.5 py-1.5 rounded-xl bg-[#261812] dark:bg-white text-white dark:text-black text-xs font-bold shadow-xs hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                      {savingNote ? 'Saving...' : 'Save Notes'}
                    </button>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="pt-3 border-t border-[#e2bfb0]/40 dark:border-white/10 flex items-center justify-between gap-2">
                  {selectedInquiry.email ? (
                    <a
                      href={`mailto:${selectedInquiry.email}?subject=${encodeURIComponent('Re: ' + selectedInquiry.subject)}`}
                      className="px-4 py-2 rounded-xl bg-[#ff6b00] hover:bg-[#a04100] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                    >
                      <Reply className="h-4 w-4" />
                      <span>Reply via Email</span>
                    </a>
                  ) : (
                    <div className="text-[11px] text-gray-400 italic">No reply email provided</div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(selectedInquiry)}
                      className="px-3.5 py-2 rounded-xl border border-[#e2bfb0] dark:border-white/10 text-xs font-bold text-[#5a4136] dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      {selectedInquiry.status === 'OPEN' ? 'Mark Resolved' : 'Re-open'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-[#5a4136]/60 dark:text-gray-400 text-xs space-y-2">
                <Mail className="h-8 w-8 mx-auto text-[#ff6b00]/40" />
                <p className="font-semibold">Select a message from the list to view complete details, add admin notes, or send a reply.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
