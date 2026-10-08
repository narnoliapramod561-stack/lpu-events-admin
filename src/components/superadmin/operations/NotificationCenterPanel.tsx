// src/components/superadmin/operations/NotificationCenterPanel.tsx
// LPU Events — Phase 8: Operational Notifications & Escalation Center
// Super Admin surface for managing notification policies, recipients, outbox delivery, and escalation.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bell,
  Mail,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Eye,
  UserPlus,
  Users,
  ShieldAlert,
  X,
  FileText,
  Sliders,
} from 'lucide-react';
import {
  OperationsNotificationPolicy,
  OperationsNotificationRecipient,
  OperationsNotificationGroup,
  OperationsNotificationOutboxItem,
  OperationsNotificationDeliveryAttempt,
  OperationsNotificationsOverview,
  OperationsNotificationPreviewResult,
  NotificationEventType,
} from '../../../shared/operations/types';
import { OperationsClient } from '../../../shared/operations/client';

interface NotificationCenterPanelProps {
  client: OperationsClient;
  overview?: {
    pending: number;
    failed: number;
    provider_configured: boolean;
  };
}

type ActiveTab = 'OUTBOX' | 'POLICIES' | 'RECIPIENTS' | 'PREVIEW';

export const NotificationCenterPanel: React.FC<NotificationCenterPanelProps> = ({
  client,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('OUTBOX');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Data states
  const [overviewData, setOverviewData] = useState<OperationsNotificationsOverview | null>(null);
  const [outboxItems, setOutboxItems] = useState<OperationsNotificationOutboxItem[]>([]);
  const [policies, setPolicies] = useState<OperationsNotificationPolicy[]>([]);
  const [recipients, setRecipients] = useState<OperationsNotificationRecipient[]>([]);
  const [groups, setGroups] = useState<OperationsNotificationGroup[]>([]);
  const [attempts, setAttempts] = useState<OperationsNotificationDeliveryAttempt[]>([]);

  // Filtering states for outbox
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Modals & Inspection states
  const [inspectingItem, setInspectingItem] = useState<OperationsNotificationOutboxItem | null>(null);
  const [showAddRecipientModal, setShowAddRecipientModal] = useState<boolean>(false);
  const [newRecipient, setNewRecipient] = useState({
    display_name: '',
    email: '',
    role_name: 'OPERATIONS_ADMIN',
    group_ids: [] as string[],
  });

  // Preview state
  const [previewType, setPreviewType] = useState<NotificationEventType>('INCIDENT_CREATED');
  const [previewSeverity, setPreviewSeverity] = useState<string>('CRITICAL');
  const [previewResult, setPreviewResult] = useState<OperationsNotificationPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  // Load all overview and tab data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, outboxRes, polRes, recRes, grpRes] = await Promise.all([
        client.getNotificationsOverview().catch(() => null),
        client.getNotificationOutbox({ limit: 50 }).catch(() => ({ outbox: [], count: 0 })),
        client.getNotificationPolicies().catch(() => ({ policies: [], count: 0 })),
        client.getNotificationRecipients().catch(() => ({ recipients: [], count: 0 })),
        client.getNotificationGroups().catch(() => ({ groups: [], count: 0 })),
      ]);

      if (ov) setOverviewData(ov);
      setOutboxItems(outboxRes.outbox || []);
      setPolicies(polRes.policies || []);
      setRecipients(recRes.recipients || []);
      setGroups(grpRes.groups || []);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle immediate outbox queue processing
  const handleProcessQueue = async () => {
    setActionInProgress('PROCESS_QUEUE');
    try {
      await client.triggerNotificationDelivery(25);
      await fetchData();
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle manual retry
  const handleRetry = async (notificationId: string) => {
    setActionInProgress(`RETRY_${notificationId}`);
    try {
      await client.retryNotification(notificationId);
      await fetchData();
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle manual cancel
  const handleCancel = async (notificationId: string) => {
    setActionInProgress(`CANCEL_${notificationId}`);
    try {
      await client.cancelNotification(notificationId);
      await fetchData();
    } finally {
      setActionInProgress(null);
    }
  };

  // Inspect attempts for an outbox record
  const handleInspect = async (item: OperationsNotificationOutboxItem) => {
    setInspectingItem(item);
    try {
      const res = await client.getNotificationAttempts({ notification_id: item.id });
      setAttempts(res.attempts || []);
    } catch {
      setAttempts([]);
    }
  };

  // Toggle policy enabled
  const handleTogglePolicy = async (policy: OperationsNotificationPolicy) => {
    setActionInProgress(`POLICY_${policy.id}`);
    try {
      await client.updateNotificationPolicy(policy.id, { enabled: !policy.enabled });
      await fetchData();
    } finally {
      setActionInProgress(null);
    }
  };

  // Toggle recipient enabled
  const handleToggleRecipient = async (rec: OperationsNotificationRecipient) => {
    setActionInProgress(`REC_${rec.id}`);
    try {
      await client.updateNotificationRecipient(rec.id, { enabled: !rec.enabled });
      await fetchData();
    } finally {
      setActionInProgress(null);
    }
  };

  // Add new recipient submit
  const handleCreateRecipientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipient.display_name.trim() || !newRecipient.email.trim()) return;

    setActionInProgress('CREATE_RECIPIENT');
    try {
      await client.createNotificationRecipient({
        display_name: newRecipient.display_name.trim(),
        email: newRecipient.email.trim().toLowerCase(),
        role_name: newRecipient.role_name,
        group_ids: newRecipient.group_ids,
      });
      setShowAddRecipientModal(false);
      setNewRecipient({ display_name: '', email: '', role_name: 'OPERATIONS_ADMIN', group_ids: [] });
      await fetchData();
    } finally {
      setActionInProgress(null);
    }
  };

  // Render template preview
  const handleRenderPreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await client.previewNotificationTemplate({
        event_type: previewType,
        severity: previewSeverity,
      });
      setPreviewResult(res);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Filter outbox items
  const filteredOutbox = useMemo(() => {
    return outboxItems.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchSubj = item.subject.toLowerCase().includes(q);
        const matchEmail = item.recipient_email.toLowerCase().includes(q);
        const matchInc = item.incident_id?.toLowerCase().includes(q);
        if (!matchSubj && !matchEmail && !matchInc) return false;
      }
      return true;
    });
  }, [outboxItems, statusFilter, searchFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'REQUEST_ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={12} />
            Accepted
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock size={12} />
            Pending
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <RefreshCw size={12} className="animate-spin" />
            Processing
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertTriangle size={12} />
            Failed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20">
            <XCircle size={12} />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-[#1a1412] rounded-2xl border border-black/5 dark:border-white/10 p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-black/5 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
              <Bell size={18} />
            </div>
            <h2 className="text-lg font-bold font-['Outfit'] text-[#261812] dark:text-white">
              Operations Notifications & Escalation
            </h2>
          </div>
          <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2] mt-1">
            Server-side alert dispatching, multi-level incident escalation, deduplicated outbox queue, and Resend delivery telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleProcessQueue}
            disabled={actionInProgress === 'PROCESS_QUEUE'}
            className="px-3.5 py-2 rounded-xl bg-[#261812] dark:bg-white text-white dark:text-[#261812] text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:opacity-50"
            title="Dispatch pending outbox notifications immediately"
          >
            <Send size={13} className={actionInProgress === 'PROCESS_QUEUE' ? 'animate-spin' : ''} />
            {actionInProgress === 'PROCESS_QUEUE' ? 'Dispatching...' : 'Dispatch Outbox Now'}
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-[#5a4136] dark:text-[#aeaeb2] transition-colors"
            title="Refresh notifications state"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Pending Queue */}
        <div className="p-4 rounded-xl border border-black/5 dark:border-white/10 bg-[#faf8f5] dark:bg-[#201815]">
          <div className="flex items-center justify-between text-xs text-[#5a4136] dark:text-[#aeaeb2]">
            <span>Queue Pending</span>
            <Clock size={14} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-['Outfit'] text-[#261812] dark:text-white mt-1">
            {overviewData?.summary.pending ?? 0}
          </div>
          <span className="text-[11px] text-[#5a4136] dark:text-[#8e8e93]">Awaiting dispatch worker</span>
        </div>

        {/* Deliveries Accepted */}
        <div className="p-4 rounded-xl border border-black/5 dark:border-white/10 bg-[#faf8f5] dark:bg-[#201815]">
          <div className="flex items-center justify-between text-xs text-[#5a4136] dark:text-[#aeaeb2]">
            <span>Accepted Deliveries</span>
            <CheckCircle2 size={14} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-['Outfit'] text-[#261812] dark:text-white mt-1">
            {overviewData?.summary.request_accepted ?? 0}
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Accepted by provider</span>
        </div>

        {/* Failed Outbox */}
        <div className="p-4 rounded-xl border border-black/5 dark:border-white/10 bg-[#faf8f5] dark:bg-[#201815]">
          <div className="flex items-center justify-between text-xs text-[#5a4136] dark:text-[#aeaeb2]">
            <span>Delivery Failures</span>
            <AlertTriangle size={14} className="text-rose-500" />
          </div>
          <div className="text-2xl font-bold font-['Outfit'] text-[#261812] dark:text-white mt-1">
            {overviewData?.summary.failed ?? 0}
          </div>
          <span className="text-[11px] text-rose-600 dark:text-rose-400">Transient or permanent</span>
        </div>

        {/* Provider Readiness */}
        <div className="p-4 rounded-xl border border-black/5 dark:border-white/10 bg-[#faf8f5] dark:bg-[#201815]">
          <div className="flex items-center justify-between text-xs text-[#5a4136] dark:text-[#aeaeb2]">
            <span>Provider Status</span>
            <Mail size={14} className="text-blue-500" />
          </div>
          <div className="text-sm font-bold font-['Outfit'] text-[#261812] dark:text-white mt-2 flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                overviewData?.provider.is_configured ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {overviewData?.provider.is_configured ? 'CONFIGURED' : 'NOT_CONFIGURED'}
          </div>
          <span className="text-[11px] text-[#5a4136] dark:text-[#8e8e93]">
            {overviewData?.provider.adapter || 'ResendAdapter'}
          </span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 border-b border-black/5 dark:border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('OUTBOX')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'OUTBOX'
              ? 'bg-[#261812] text-white dark:bg-white dark:text-[#261812]'
              : 'text-[#5a4136] dark:text-[#aeaeb2] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <FileText size={13} />
          Outbox & Deliveries ({outboxItems.length})
        </button>

        <button
          onClick={() => setActiveTab('POLICIES')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'POLICIES'
              ? 'bg-[#261812] text-white dark:bg-white dark:text-[#261812]'
              : 'text-[#5a4136] dark:text-[#aeaeb2] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Sliders size={13} />
          Policies & Escalation ({policies.length})
        </button>

        <button
          onClick={() => setActiveTab('RECIPIENTS')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'RECIPIENTS'
              ? 'bg-[#261812] text-white dark:bg-white dark:text-[#261812]'
              : 'text-[#5a4136] dark:text-[#aeaeb2] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Users size={13} />
          Recipients & Groups ({recipients.length})
        </button>

        <button
          onClick={() => setActiveTab('PREVIEW')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'PREVIEW'
              ? 'bg-[#261812] text-white dark:bg-white dark:text-[#261812]'
              : 'text-[#5a4136] dark:text-[#aeaeb2] hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Eye size={13} />
          Safe Template Preview
        </button>
      </div>

      {/* TAB 1: Outbox & Deliveries */}
      {activeTab === 'OUTBOX' && (
        <div className="space-y-4">
          {/* Controls: Filter & Search */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#5a4136] dark:text-[#aeaeb2]">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-[#faf8f5] dark:bg-[#201815] border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1 text-[#261812] dark:text-white"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="REQUEST_ACCEPTED">REQUEST_ACCEPTED</option>
                <option value="FAILED">FAILED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <input
              type="text"
              placeholder="Search by subject, email, or incident..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="text-xs bg-[#faf8f5] dark:bg-[#201815] border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-[#261812] dark:text-white placeholder-[#8e8e93] w-full sm:w-64"
            />
          </div>

          {/* Outbox Table */}
          <div className="overflow-x-auto rounded-xl border border-black/5 dark:border-white/10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#faf8f5] dark:bg-[#201815] border-b border-black/5 dark:border-white/10 text-[11px] font-semibold text-[#5a4136] dark:text-[#aeaeb2] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Subject / Incident</th>
                  <th className="py-2.5 px-3">Recipient</th>
                  <th className="py-2.5 px-3">Attempts</th>
                  <th className="py-2.5 px-3">Created / Scheduled</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10 text-xs">
                {loading ? (
                  // Skeleton Rows
                  [1, 2, 3].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-3 px-3"><div className="h-5 w-20 bg-black/5 dark:bg-white/5 rounded-full" /></td>
                      <td className="py-3 px-3"><div className="h-4 w-48 bg-black/5 dark:bg-white/5 rounded" /></td>
                      <td className="py-3 px-3"><div className="h-4 w-32 bg-black/5 dark:bg-white/5 rounded" /></td>
                      <td className="py-3 px-3"><div className="h-4 w-12 bg-black/5 dark:bg-white/5 rounded" /></td>
                      <td className="py-3 px-3"><div className="h-4 w-28 bg-black/5 dark:bg-white/5 rounded" /></td>
                      <td className="py-3 px-3 text-right"><div className="h-6 w-16 bg-black/5 dark:bg-white/5 rounded ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredOutbox.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#5a4136] dark:text-[#8e8e93]">
                      No notification outbox records found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOutbox.map((item) => (
                    <tr key={item.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3">{getStatusBadge(item.status)}</td>
                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-medium text-[#261812] dark:text-white truncate">
                          {item.subject}
                        </div>
                        {item.escalation_level > 0 && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            Escalation Level {item.escalation_level}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-[#261812] dark:text-white">{item.recipient_name || 'Admin'}</div>
                        <div className="text-[11px] text-[#5a4136] dark:text-[#8e8e93]">{item.recipient_email}</div>
                      </td>
                      <td className="py-3 px-3 text-[#5a4136] dark:text-[#aeaeb2]">
                        {item.attempt_count} / {item.max_attempts}
                      </td>
                      <td className="py-3 px-3 text-[11px] text-[#5a4136] dark:text-[#8e8e93]">
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.status === 'FAILED' && (
                            <button
                              onClick={() => handleRetry(item.id)}
                              disabled={actionInProgress === `RETRY_${item.id}`}
                              className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-medium transition-colors disabled:opacity-50"
                            >
                              {actionInProgress === `RETRY_${item.id}` ? 'Retrying...' : 'Retry'}
                            </button>
                          )}
                          {item.status === 'PENDING' && (
                            <button
                              onClick={() => handleCancel(item.id)}
                              disabled={actionInProgress === `CANCEL_${item.id}`}
                              className="px-2 py-1 rounded bg-zinc-500/10 hover:bg-zinc-500/20 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            onClick={() => handleInspect(item)}
                            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 text-[#5a4136] dark:text-[#aeaeb2] transition-colors"
                            title="Inspect delivery history"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Policies & Escalation */}
      {activeTab === 'POLICIES' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-black/5 dark:border-white/10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#faf8f5] dark:bg-[#201815] border-b border-black/5 dark:border-white/10 text-[11px] font-semibold text-[#5a4136] dark:text-[#aeaeb2] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Policy Name</th>
                  <th className="py-2.5 px-3">Event Trigger</th>
                  <th className="py-2.5 px-3">Min Severity</th>
                  <th className="py-2.5 px-3">Target Group</th>
                  <th className="py-2.5 px-3">Cooldown</th>
                  <th className="py-2.5 px-3">Escalation</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10 text-xs">
                {policies.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#5a4136] dark:text-[#8e8e93]">
                      No operational notification policies found.
                    </td>
                  </tr>
                ) : (
                  policies.map((p) => (
                    <tr key={p.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#261812] dark:text-white">{p.name}</div>
                        <div className="text-[11px] text-[#5a4136] dark:text-[#8e8e93]">{p.policy_key}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {p.event_type}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.min_severity === 'CRITICAL'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : p.min_severity === 'HIGH'
                              ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {p.min_severity}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#5a4136] dark:text-[#aeaeb2]">
                        {p.group?.name || 'Primary Operations'}
                      </td>
                      <td className="py-3 px-3 text-[#5a4136] dark:text-[#8e8e93]">
                        {p.cooldown_minutes} min
                      </td>
                      <td className="py-3 px-3">
                        {p.escalation_delay_minutes ? (
                          <div className="text-[11px] text-[#261812] dark:text-white">
                            After {p.escalation_delay_minutes}m &rarr; {p.escalation_group?.name || 'Escalation Group'}
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#8e8e93]">None</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleTogglePolicy(p)}
                          disabled={actionInProgress === `POLICY_${p.id}`}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                            p.enabled
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-500/20'
                          }`}
                        >
                          {p.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Recipients & Groups */}
      {activeTab === 'RECIPIENTS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#5a4136] dark:text-[#aeaeb2]">
              Configured operational notification recipients and group assignments.
            </p>
            <button
              onClick={() => setShowAddRecipientModal(true)}
              className="px-3 py-1.5 rounded-xl bg-[#261812] dark:bg-white text-white dark:text-[#261812] text-xs font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              <UserPlus size={13} />
              Add Recipient
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-black/5 dark:border-white/10">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#faf8f5] dark:bg-[#201815] border-b border-black/5 dark:border-white/10 text-[11px] font-semibold text-[#5a4136] dark:text-[#aeaeb2] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Recipient</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Group Memberships</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10 text-xs">
                {recipients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#5a4136] dark:text-[#8e8e93]">
                      No operational recipients configured.
                    </td>
                  </tr>
                ) : (
                  recipients.map((r) => (
                    <tr key={r.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#261812] dark:text-white">{r.display_name}</div>
                        <div className="text-[11px] text-[#5a4136] dark:text-[#8e8e93]">{r.email}</div>
                      </td>
                      <td className="py-3 px-3 text-[#5a4136] dark:text-[#aeaeb2]">{r.role_name}</td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {r.group_memberships && r.group_memberships.length > 0 ? (
                            r.group_memberships.map((gm) => (
                              <span
                                key={gm.group_id}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20"
                              >
                                {gm.ops_notification_groups?.name || 'Group'}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-[#8e8e93]">No groups</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleToggleRecipient(r)}
                          disabled={actionInProgress === `REC_${r.id}`}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                            r.enabled
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-500/20'
                          }`}
                        >
                          {r.enabled ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Safe Template Preview */}
      {activeTab === 'PREVIEW' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2">
            <ShieldAlert size={16} />
            <span>
              Safe Preview Mode is completely non-sending and offline. No email provider API requests or delivery worker runs will be triggered.
            </span>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#5a4136] dark:text-[#aeaeb2]">Event Type:</span>
              <select
                value={previewType}
                onChange={(e) => setPreviewType(e.target.value as NotificationEventType)}
                className="bg-[#faf8f5] dark:bg-[#201815] border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1 text-[#261812] dark:text-white"
              >
                <option value="INCIDENT_CREATED">INCIDENT_CREATED</option>
                <option value="INCIDENT_ESCALATED">INCIDENT_ESCALATED</option>
                <option value="INCIDENT_RESOLVED">INCIDENT_RESOLVED (Auto)</option>
                <option value="INCIDENT_MANUALLY_RESOLVED">INCIDENT_MANUALLY_RESOLVED (Manual)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#5a4136] dark:text-[#aeaeb2]">Severity:</span>
              <select
                value={previewSeverity}
                onChange={(e) => setPreviewSeverity(e.target.value)}
                className="bg-[#faf8f5] dark:bg-[#201815] border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1 text-[#261812] dark:text-white"
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="WARNING">WARNING</option>
              </select>
            </div>

            <button
              onClick={handleRenderPreview}
              disabled={previewLoading}
              className="px-3 py-1.5 rounded-lg bg-[#261812] dark:bg-white text-white dark:text-[#261812] text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <Eye size={12} />
              {previewLoading ? 'Rendering...' : 'Render Preview'}
            </button>
          </div>

          {previewResult && (
            <div className="p-4 rounded-xl border border-black/10 dark:border-white/10 bg-[#faf8f5] dark:bg-[#201815] space-y-3">
              <div>
                <span className="text-[11px] font-semibold text-[#5a4136] dark:text-[#8e8e93] uppercase">Subject:</span>
                <div className="text-sm font-bold text-[#261812] dark:text-white mt-0.5">
                  {previewResult.subject}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-[#5a4136] dark:text-[#8e8e93] uppercase">Rendered HTML Output:</span>
                <div
                  className="mt-2 p-4 bg-white dark:bg-[#1a1412] rounded-lg border border-black/5 dark:border-white/10 text-xs overflow-x-auto text-[#261812] dark:text-[#e5e5e7]"
                  dangerouslySetInnerHTML={{ __html: previewResult.content_html }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delivery Attempts Inspector Modal */}
      {inspectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white dark:bg-[#1a1412] rounded-2xl border border-black/10 dark:border-white/10 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10">
              <h3 className="text-base font-bold font-['Outfit'] text-[#261812] dark:text-white">
                Delivery Attempt Audit
              </h3>
              <button
                onClick={() => setInspectingItem(null)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#5a4136] dark:text-[#aeaeb2]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs space-y-1.5 text-[#5a4136] dark:text-[#aeaeb2]">
              <div><strong className="text-[#261812] dark:text-white">Subject:</strong> {inspectingItem.subject}</div>
              <div><strong className="text-[#261812] dark:text-white">Recipient:</strong> {inspectingItem.recipient_email}</div>
              <div><strong className="text-[#261812] dark:text-white">Current Status:</strong> {inspectingItem.status}</div>
              {inspectingItem.safe_error_message && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono text-[11px]">
                  {inspectingItem.safe_error_code}: {inspectingItem.safe_error_message}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold text-[#261812] dark:text-white uppercase tracking-wider">
                Attempt History ({attempts.length})
              </h4>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {attempts.length === 0 ? (
                  <div className="text-xs text-[#8e8e93] py-2">No recorded attempt audit entries yet.</div>
                ) : (
                  attempts.map((att) => (
                    <div
                      key={att.id}
                      className="p-3 rounded-lg border border-black/5 dark:border-white/10 bg-[#faf8f5] dark:bg-[#201815] text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-[#261812] dark:text-white">
                          Attempt #{att.attempt_number} &bull; {att.status}
                        </div>
                        <div className="text-[11px] text-[#5a4136] dark:text-[#8e8e93]">
                          Started: {new Date(att.started_at).toLocaleString()}
                        </div>
                        {att.safe_error_message && (
                          <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                            {att.safe_error_message}
                          </div>
                        )}
                      </div>
                      {att.provider_message_id && (
                        <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">
                          {att.provider_message_id}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Recipient Modal */}
      {showAddRecipientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <form
            onSubmit={handleCreateRecipientSubmit}
            className="w-full max-w-md bg-white dark:bg-[#1a1412] rounded-2xl border border-black/10 dark:border-white/10 p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
              <h3 className="text-base font-bold font-['Outfit'] text-[#261812] dark:text-white">
                Add Operational Recipient
              </h3>
              <button
                type="button"
                onClick={() => setShowAddRecipientModal(false)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#5a4136] dark:text-[#aeaeb2]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#5a4136] dark:text-[#aeaeb2] mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lead SRE On-Call"
                  value={newRecipient.display_name}
                  onChange={(e) => setNewRecipient({ ...newRecipient, display_name: e.target.value })}
                  className="w-full bg-[#faf8f5] dark:bg-[#201815] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-[#261812] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[#5a4136] dark:text-[#aeaeb2] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. ops@example.com"
                  value={newRecipient.email}
                  onChange={(e) => setNewRecipient({ ...newRecipient, email: e.target.value })}
                  className="w-full bg-[#faf8f5] dark:bg-[#201815] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-[#261812] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[#5a4136] dark:text-[#aeaeb2] mb-1">Role</label>
                <select
                  value={newRecipient.role_name}
                  onChange={(e) => setNewRecipient({ ...newRecipient, role_name: e.target.value })}
                  className="w-full bg-[#faf8f5] dark:bg-[#201815] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-[#261812] dark:text-white"
                >
                  <option value="OPERATIONS_ADMIN">OPERATIONS_ADMIN</option>
                  <option value="ON_CALL_ENGINEER">ON_CALL_ENGINEER</option>
                  <option value="INCIDENT_COMMANDER">INCIDENT_COMMANDER</option>
                </select>
              </div>

              <div>
                <label className="block text-[#5a4136] dark:text-[#aeaeb2] mb-1">Assign to Groups</label>
                <div className="space-y-1.5 pt-1">
                  {groups.map((g) => {
                    const isChecked = newRecipient.group_ids.includes(g.id);
                    return (
                      <label key={g.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewRecipient({ ...newRecipient, group_ids: [...newRecipient.group_ids, g.id] });
                            } else {
                              setNewRecipient({
                                ...newRecipient,
                                group_ids: newRecipient.group_ids.filter((id) => id !== g.id),
                              });
                            }
                          }}
                          className="rounded text-orange-600"
                        />
                        <span className="text-[#261812] dark:text-white">{g.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/5 dark:border-white/10">
              <button
                type="button"
                onClick={() => setShowAddRecipientModal(false)}
                className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-xs text-[#5a4136] dark:text-[#aeaeb2] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionInProgress === 'CREATE_RECIPIENT'}
                className="px-4 py-1.5 rounded-lg bg-[#261812] dark:bg-white text-white dark:text-[#261812] text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {actionInProgress === 'CREATE_RECIPIENT' ? 'Adding...' : 'Save Recipient'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
