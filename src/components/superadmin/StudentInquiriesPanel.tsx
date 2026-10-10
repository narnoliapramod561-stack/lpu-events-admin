import React, { useState, useEffect, useMemo } from 'react';
import { supabase, lpuClient } from '../../supabase';
import { 
  Mail, 
  Search, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  RotateCw, 
  Download, 
  MessageSquare, 
  Reply
} from 'lucide-react';
import { LoadingSpinner } from '../shell/LoadingState';
import { EmptyState } from '../shell/EmptyState';

export interface StudentInquiry {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'RESOLVED' | 'SPAM';
  created_at: string;
  resolved_at?: string;
  admin_notes?: string;
}

export const StudentInquiriesPanel: React.FC = () => {
  const [inquiries, setInquiries] = useState<StudentInquiry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInquiry, setSelectedInquiry] = useState<StudentInquiry | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchInquiries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'student_support_inquiries')
        .maybeSingle();

      if (error) throw error;

      if (data && data.value) {
        let parsed: StudentInquiry[] = [];
        if (Array.isArray(data.value)) {
          parsed = data.value as StudentInquiry[];
        } else if (typeof data.value === 'string') {
          try {
            parsed = JSON.parse(data.value);
          } catch {}
        }
        // Sort newest first
        setInquiries(parsed.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      } else {
        setInquiries([]);
      }
    } catch (err: any) {
      console.error('Failed to load inquiries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const saveInquiriesList = async (newList: StudentInquiry[], successMsg: string) => {
    try {
      const res = await lpuClient.manageGlobalSetting('upsert', {
        key: 'student_support_inquiries',
        value: newList,
        description: 'Student Contact Us Support Desk Queue'
      });
      if (res.error) throw new Error(res.error.message || 'RPC Failed');
      setInquiries(newList);
      setToastMessage(successMsg);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      alert('Error updating inquiries: ' + (err.message || String(err)));
    }
  };

  const handleToggleStatus = async (item: StudentInquiry) => {
    const newStatus = item.status === 'RESOLVED' ? 'OPEN' : 'RESOLVED';
    const updated = inquiries.map(q => {
      if (q.id === item.id) {
        return {
          ...q,
          status: newStatus as 'OPEN' | 'RESOLVED',
          resolved_at: newStatus === 'RESOLVED' ? new Date().toISOString() : undefined
        };
      }
      return q;
    });

    await saveInquiriesList(
      updated, 
      newStatus === 'RESOLVED' ? 'Marked inquiry as resolved' : 'Re-opened inquiry'
    );
    if (selectedInquiry?.id === item.id) {
      setSelectedInquiry(prev => prev ? { ...prev, status: newStatus, resolved_at: newStatus === 'RESOLVED' ? new Date().toISOString() : undefined } : null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this inquiry record?')) return;
    const updated = inquiries.filter(q => q.id !== id);
    await saveInquiriesList(updated, 'Inquiry removed permanently');
    if (selectedInquiry?.id === id) {
      setSelectedInquiry(null);
    }
  };

  const handleSaveAdminNote = async () => {
    if (!selectedInquiry) return;
    setSavingNote(true);
    const updated = inquiries.map(q => {
      if (q.id === selectedInquiry.id) {
        return { ...q, admin_notes: adminNoteInput };
      }
      return q;
    });

    await saveInquiriesList(updated, 'Internal admin notes saved');
    setSelectedInquiry(prev => prev ? { ...prev, admin_notes: adminNoteInput } : null);
    setSavingNote(false);
  };

  const filteredInquiries = useMemo(() => {
    return inquiries.filter(item => {
      if (statusFilter === 'OPEN' && item.status !== 'OPEN') return false;
      if (statusFilter === 'RESOLVED' && item.status !== 'RESOLVED') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          item.name.toLowerCase().includes(q) ||
          item.email.toLowerCase().includes(q) ||
          item.subject.toLowerCase().includes(q) ||
          item.message.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [inquiries, statusFilter, searchQuery]);

  const openCount = useMemo(() => inquiries.filter(i => i.status === 'OPEN').length, [inquiries]);

  const exportCSV = () => {
    const headers = ['ID', 'Date', 'Name', 'Email', 'Subject', 'Message', 'Status', 'Notes'];
    const rows = filteredInquiries.map(i => [
      i.id,
      new Date(i.created_at).toISOString(),
      `"${i.name.replace(/"/g, '""')}"`,
      `"${i.email.replace(/"/g, '""')}"`,
      `"${i.subject.replace(/"/g, '""')}"`,
      `"${i.message.replace(/"/g, '""')}"`,
      i.status,
      `"${(i.admin_notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lpu_student_inquiries_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black font-['Outfit'] text-[#261812] dark:text-white flex items-center gap-2.5">
              <MessageSquare className="h-6 w-6 text-[#ff6b00]" />
              Student Inquiries & Support Desk
            </h2>
            {openCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm">
                {openCount} Open
              </span>
            )}
          </div>
          <p className="text-sm text-[#5a4136] dark:text-[#aeaeb2] mt-0.5">
            Manage questions, bug reports, and feedback submitted by campus students from the Contact Us page.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            disabled={filteredInquiries.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-white dark:bg-white/[0.04] text-xs font-bold text-[#5a4136] dark:text-gray-300 hover:bg-[#fee3d8] transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={fetchInquiries}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-white dark:bg-white/[0.04] text-xs font-bold text-[#5a4136] dark:text-gray-300 hover:bg-gray-100 transition-all shadow-xs cursor-pointer"
          >
            <RotateCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-[#242426] p-4 rounded-2xl border border-[#e2bfb0] dark:border-white/10 shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(['ALL', 'OPEN', 'RESOLVED'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === f
                  ? 'bg-[#ff6b00] text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-white/5 text-[#5a4136] dark:text-gray-400 hover:bg-gray-200'
              }`}
            >
              {f === 'ALL' ? `All (${inquiries.length})` : f === 'OPEN' ? `Open (${openCount})` : `Resolved (${inquiries.length - openCount})`}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#5a4136]/50 dark:text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student, email, subject..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-xs text-[#261812] dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner message="Loading student inquiries..." />
        </div>
      ) : filteredInquiries.length === 0 ? (
        <EmptyState
          title="No Student Inquiries Found"
          description={searchQuery ? 'No inquiries matching your search query.' : 'There are currently no inquiries in this queue.'}
          icon={<Mail size={32} />}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List View (2 cols on large) */}
          <div className="lg:col-span-2 space-y-3">
            {filteredInquiries.map(item => {
              const isSelected = selectedInquiry?.id === item.id;
              const isOpen = item.status === 'OPEN';
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedInquiry(item);
                    setAdminNoteInput(item.admin_notes || '');
                  }}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#ff6b00] bg-orange-50/40 dark:bg-orange-500/10 shadow-sm'
                      : 'border-[#e2bfb0] dark:border-white/10 bg-white dark:bg-[#242426] hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          isOpen 
                            ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-700' 
                            : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
                        }`}>
                          {item.status}
                        </span>
                        <h4 className="text-sm font-bold text-[#261812] dark:text-white">
                          {item.subject}
                        </h4>
                      </div>
                      <p className="text-xs text-[#5a4136]/80 dark:text-gray-300 font-medium">
                        From: <span className="font-bold text-[#261812] dark:text-white">{item.name}</span> ({item.email})
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-[#5a4136]/60 dark:text-gray-400 flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" />
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2.5 text-xs text-[#5a4136] dark:text-gray-300 line-clamp-2 leading-relaxed">
                    {item.message}
                  </p>

                  <div className="mt-3.5 pt-3 border-t border-[#e2bfb0]/30 dark:border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <a
                        href={`mailto:${item.email}?subject=${encodeURIComponent('Re: ' + item.subject)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#ff6b00] hover:underline"
                      >
                        <Reply className="h-3.5 w-3.5" />
                        <span>Reply Email</span>
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(item);
                        }}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
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
                          handleDelete(item.id);
                        }}
                        className="p-1 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        title="Delete Inquiry"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Details / Sidebar Drawer */}
          <div className="bg-white dark:bg-[#242426] border border-[#e2bfb0] dark:border-white/10 rounded-3xl p-6 shadow-sm h-fit space-y-5">
            {selectedInquiry ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-[#e2bfb0]/40 dark:border-white/10">
                  <span className="text-xs font-black text-[#5a4136]/70 dark:text-gray-400 uppercase tracking-wider">
                    Inquiry Details
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    selectedInquiry.status === 'OPEN' 
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' 
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}>
                    {selectedInquiry.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-[#261812] dark:text-white">
                    {selectedInquiry.subject}
                  </h3>
                  <div className="mt-2 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-[#e2bfb0]/40 dark:border-white/10 text-xs space-y-1">
                    <p className="font-semibold text-[#261812] dark:text-white">
                      Sender: {selectedInquiry.name}
                    </p>
                    <p className="text-[#5a4136] dark:text-gray-300">
                      Email: <a href={`mailto:${selectedInquiry.email}`} className="text-[#ff6b00] underline">{selectedInquiry.email}</a>
                    </p>
                    <p className="text-[11px] text-[#5a4136]/60 dark:text-gray-400">
                      Received: {new Date(selectedInquiry.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#261812] dark:text-white block mb-1.5">
                    Message Body
                  </label>
                  <div className="p-3.5 rounded-2xl bg-gray-50/80 dark:bg-black/30 border border-[#e2bfb0]/40 dark:border-white/10 text-xs text-[#261812] dark:text-white leading-relaxed whitespace-pre-wrap">
                    {selectedInquiry.message}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#261812] dark:text-white block mb-1.5">
                    Internal Admin Notes
                  </label>
                  <textarea
                    value={adminNoteInput}
                    onChange={(e) => setAdminNoteInput(e.target.value)}
                    rows={3}
                    placeholder="Add follow-up notes, ticket reference, or resolutions..."
                    className="w-full p-2.5 rounded-xl border border-[#e2bfb0] dark:border-white/10 bg-white dark:bg-white/[0.02] text-xs text-[#261812] dark:text-white focus:outline-none"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={handleSaveAdminNote}
                      disabled={savingNote}
                      className="px-3.5 py-1.5 rounded-lg bg-[#261812] dark:bg-white text-white dark:text-black text-xs font-bold shadow-xs hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                      {savingNote ? 'Saving...' : 'Save Notes'}
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#e2bfb0]/40 dark:border-white/10 flex items-center justify-between">
                  <a
                    href={`mailto:${selectedInquiry.email}?subject=${encodeURIComponent('Re: ' + selectedInquiry.subject)}`}
                    className="px-4 py-2 rounded-xl bg-[#ff6b00] hover:bg-[#a04100] text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
                  >
                    <Reply className="h-4 w-4" />
                    <span>Send Email Reply</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => handleToggleStatus(selectedInquiry)}
                    className="px-3.5 py-2 rounded-xl border border-[#e2bfb0] dark:border-white/10 text-xs font-bold text-[#5a4136] dark:text-white hover:bg-gray-100 transition-colors"
                  >
                    {selectedInquiry.status === 'OPEN' ? 'Mark Resolved' : 'Re-open'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-[#5a4136]/60 dark:text-gray-400 text-xs space-y-2">
                <Mail className="h-8 w-8 mx-auto text-[#ff6b00]/40" />
                <p className="font-semibold">Select an inquiry from the list to view complete details, add admin notes, or reply.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
