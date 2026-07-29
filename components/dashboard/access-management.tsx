'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Organizer {
  id: string;
  displayName: string | null;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  canCreateEvents: boolean;
  canManagePayments: boolean;
  canViewAnalytics: boolean;
  canManageAttendees: boolean;
}

export function AccessManagement() {
  const [organizers, setOrganizers] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrganizer, setSelectedOrganizer] = useState<Organizer | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // Permission states for the modal
  const [canCreateEvents, setCanCreateEvents] = useState(false);
  const [canManagePayments, setCanManagePayments] = useState(false);
  const [canViewAnalytics, setCanViewAnalytics] = useState(false);
  const [canManageAttendees, setCanManageAttendees] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadOrganizers();
  }, []);

  const loadOrganizers = async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      // Fetch all organizers
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'organizer')
        .order('created_at', { ascending: false });

      if (error) {
        // Error loading organizers handled
        return;
      }

      const mappedOrganizers: Organizer[] = (data || []).map((profile) => ({
        id: profile.id,
        displayName: profile.display_name,
        email: profile.email,
        role: profile.role,
        status: profile.organizer_status || 'pending',
        createdAt: profile.created_at,
        // Default permissions - in a real app, these would come from a permissions table
        canCreateEvents: true,
        canManagePayments: true,
        canViewAnalytics: true,
        canManageAttendees: true,
      }));

      setOrganizers(mappedOrganizers);
    } catch (error) {
      console.error('Error in loadOrganizers:', error);
    } finally {
      setLoading(false);
    }
  };

  const openPermissionModal = (organizer: Organizer) => {
    setSelectedOrganizer(organizer);
    setCanCreateEvents(organizer.canCreateEvents);
    setCanManagePayments(organizer.canManagePayments);
    setCanViewAnalytics(organizer.canViewAnalytics);
    setCanManageAttendees(organizer.canManageAttendees);
    setShowPermissionModal(true);
  };

  const closePermissionModal = () => {
    setShowPermissionModal(false);
    setSelectedOrganizer(null);
  };

  const savePermissions = async () => {
    if (!selectedOrganizer) return;

    try {
      setSaving(true);

      // In a real implementation, you would save these permissions to a database table
      // For now, we'll just update the local state
      setOrganizers((prev) =>
        prev.map((org) =>
          org.id === selectedOrganizer.id
            ? {
                ...org,
                canCreateEvents,
                canManagePayments,
                canViewAnalytics,
                canManageAttendees,
              }
            : org
        )
      );

      // Show success message
      alert('Permissions updated successfully!');
      closePermissionModal();
    } catch (error) {
      console.error('Error saving permissions:', error);
      alert('Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  const filteredOrganizers = organizers.filter(
    (org) =>
      org.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const approvedOrganizers = filteredOrganizers.filter((org) => org.status === 'approved');

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <p className="text-sm uppercase tracking-[0.24em] text-[#ffb36b]">Super Admin</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-white">
          Access Management
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Manage organizer permissions and access controls
        </p>
      </header>

      {/* Search Bar */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
              search
            </span>
            <input
              type="text"
              placeholder="Search organizers by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#ff914d] focus:ring-2 focus:ring-[#ff914d]/20 transition-all"
            />
          </div>
          <button
            onClick={loadOrganizers}
            className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl p-6 border border-white/10 bg-white/5">
          <p className="text-xs uppercase tracking-widest font-bold text-white/60">
            Total Organizers
          </p>
          <p className="text-3xl font-bold text-white mt-2">{organizers.length}</p>
        </div>
        <div className="rounded-xl p-6 border border-emerald-500/30 bg-emerald-500/5">
          <p className="text-xs uppercase tracking-widest font-bold text-emerald-400">Approved</p>
          <p className="text-3xl font-bold text-white mt-2">{approvedOrganizers.length}</p>
        </div>
        <div className="rounded-xl p-6 border border-amber-500/30 bg-amber-500/5">
          <p className="text-xs uppercase tracking-widest font-bold text-amber-400">Pending</p>
          <p className="text-3xl font-bold text-white mt-2">
            {organizers.filter((org) => org.status === 'pending').length}
          </p>
        </div>
        <div className="rounded-xl p-6 border border-rose-500/30 bg-rose-500/5">
          <p className="text-xs uppercase tracking-widest font-bold text-rose-400">Rejected</p>
          <p className="text-3xl font-bold text-white mt-2">
            {organizers.filter((org) => org.status === 'rejected').length}
          </p>
        </div>
      </div>

      {/* Organizers Table */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Approved Organizers</h2>
          <p className="text-sm text-white/60 mt-1">
            Manage access permissions for approved organizers
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-white/20 border-t-[#ff914d]"></div>
            <p className="text-white/60 mt-4">Loading organizers...</p>
          </div>
        ) : approvedOrganizers.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-6xl text-white/20">person_off</span>
            <p className="text-white/60 mt-4">No approved organizers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-white/60">
                    Organizer
                  </th>
                  <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-white/60">
                    Email
                  </th>
                  <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-white/60">
                    Status
                  </th>
                  <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-white/60">
                    Permissions
                  </th>
                  <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-white/60">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {approvedOrganizers.map((organizer) => (
                  <tr
                    key={organizer.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#ff914d]/10 border border-[#ff914d]/30 flex items-center justify-center text-[#ff914d] font-bold">
                          {(organizer.displayName || organizer.email).slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {organizer.displayName || 'Unnamed'}
                          </p>
                          <p className="text-xs text-white/40">
                            {new Date(organizer.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-white/80">{organizer.email}</p>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        Approved
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        {organizer.canCreateEvents && (
                          <span
                            className="px-2 py-1 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400"
                            title="Can Create Events"
                          >
                            Events
                          </span>
                        )}
                        {organizer.canManagePayments && (
                          <span
                            className="px-2 py-1 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400"
                            title="Can Manage Payments"
                          >
                            Payments
                          </span>
                        )}
                        {organizer.canViewAnalytics && (
                          <span
                            className="px-2 py-1 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400"
                            title="Can View Analytics"
                          >
                            Analytics
                          </span>
                        )}
                        {organizer.canManageAttendees && (
                          <span
                            className="px-2 py-1 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400"
                            title="Can Manage Attendees"
                          >
                            Attendees
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => openPermissionModal(organizer)}
                        className="px-4 py-2 bg-[#ff914d]/10 border border-[#ff914d]/30 text-[#ff914d] rounded-lg text-xs font-medium hover:bg-[#ff914d]/20 transition-all flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">
                          admin_panel_settings
                        </span>
                        Manage Access
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Permission Modal */}
      {showPermissionModal && selectedOrganizer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#050507] border border-white/10 rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Manage Permissions</h2>
                <p className="text-sm text-white/60 mt-1">
                  {selectedOrganizer.displayName || selectedOrganizer.email}
                </p>
              </div>
              <button
                onClick={closePermissionModal}
                className="text-white/60 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Permission Toggle: Create Events */}
              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <span className="material-symbols-outlined">event</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Create Events</h3>
                    <p className="text-xs text-white/60 mt-1">
                      Allow organizer to create and manage their own events
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canCreateEvents}
                    onChange={(e) => setCanCreateEvents(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#ff914d]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ff914d]"></div>
                </label>
              </div>

              {/* Permission Toggle: Manage Payments */}
              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <span className="material-symbols-outlined">payments</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Manage Payments</h3>
                    <p className="text-xs text-white/60 mt-1">
                      View and manage payment transactions and refunds
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canManagePayments}
                    onChange={(e) => setCanManagePayments(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#ff914d]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ff914d]"></div>
                </label>
              </div>

              {/* Permission Toggle: View Analytics */}
              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <span className="material-symbols-outlined">analytics</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">View Analytics</h3>
                    <p className="text-xs text-white/60 mt-1">
                      Access event analytics and performance metrics
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canViewAnalytics}
                    onChange={(e) => setCanViewAnalytics(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#ff914d]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ff914d]"></div>
                </label>
              </div>

              {/* Permission Toggle: Manage Attendees */}
              <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <span className="material-symbols-outlined">group</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Manage Attendees</h3>
                    <p className="text-xs text-white/60 mt-1">
                      View and manage event attendees and registrations
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canManageAttendees}
                    onChange={(e) => setCanManageAttendees(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#ff914d]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ff914d]"></div>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={closePermissionModal}
                disabled={saving}
                className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-xl text-sm font-medium hover:bg-white/10 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={savePermissions}
                disabled={saving}
                className="px-6 py-3 bg-[#ff914d] text-[#050507] rounded-xl text-sm font-bold hover:bg-[#e07530] transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#050507]/20 border-t-[#050507] rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">save</span>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
