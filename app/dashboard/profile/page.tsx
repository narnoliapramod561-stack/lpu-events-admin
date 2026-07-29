'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SignOutButton } from '@/components/auth/sign-out-button';

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const token = document.cookie
          .split('; ')
          .find((row) => row.startsWith('sb-access-token='))
          ?.split('=')[1];

        if (!token) {
          router.push('/auth/sign-in');
          return;
        }

        const response = await fetch('/api/organizer/profile', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/auth/sign-in');
            return;
          }
          throw new Error('Failed to load profile');
        }

        const { data } = await response.json();

        if (data) {
          setFullName(data.full_name || '');
          setPhone(data.phone || '');
          setRole(data.role);
          if (data.avatar_url) {
            setAvatarPreview(data.avatar_url);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load profile.');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Avatar image must be less than 2MB.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid image (JPEG, PNG, or WEBP).');
      return;
    }

    setError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const token = document.cookie
        .split('; ')
        .find((row) => row.startsWith('sb-access-token='))
        ?.split('=')[1];

      if (!token) {
        throw new Error('Not authenticated.');
      }

      // Build updates object (exclude avatar_url as it's handled separately)
      const updates: Record<string, unknown> = {};

      if (fullName.trim()) {
        updates.full_name = fullName.trim();
      } else {
        updates.full_name = null;
      }

      if (phone.trim()) {
        updates.phone = phone.trim();
      } else {
        updates.phone = null;
      }

      // Handle avatar upload if file is provided
      if (avatarFile) {
        // Note: In a real implementation, you might want to:
        // 1. First upload to storage via a separate API endpoint
        // 2. Then update profile with the avatar_url
        // For now, we'll just show a message that avatar upload needs to be implemented
        // The avatar upload will be handled by a future enhancement
        setError('Avatar upload feature will be implemented in a future update. Please update your name and phone first.');
        setSaving(false);
        return;
      }

      // Update profile via API
      const response = await fetch('/api/organizer/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error?.message || 'Failed to update profile');
      }

      setMessage('Profile updated successfully.');
      setAvatarFile(null);

      // Reload profile to show updated values
      const profileResponse = await fetch('/api/organizer/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (profileResponse.ok) {
        const { data } = await profileResponse.json();
        if (data) {
          setFullName(data.full_name || '');
          setPhone(data.phone || '');
          if (data.avatar_url) {
            setAvatarPreview(data.avatar_url);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050507] text-[#e6e2dc] flex items-center justify-center p-6">
        <div className="text-center space-y-4 animate-pulse">
          <div className="w-10 h-10 rounded-full border-t-2 border-[#ff914d] mx-auto animate-spin" />
          <p className="text-sm text-white/40">Loading profile...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050507] text-[#e6e2dc] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#ff914d]/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[480px] z-10 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-[#ff914d] flex items-center justify-center text-[#050507] font-bold text-2xl mx-auto select-none">
            LPU
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-display mt-4">
            Profile Settings
          </h1>
          <p className="text-sm text-white/60">Manage your organizer profile</p>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm">
            {message}
          </div>
        )}

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center text-2xl font-bold text-[#ff914d]">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                (fullName || '?').charAt(0).toUpperCase()
              )}
            </div>
            <label className="cursor-pointer text-xs text-[#ffb36b] hover:text-[#ffd0a5] font-semibold transition">
              Change Avatar
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-[#ffb36b] font-bold block">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-[#ff914d] transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-white/40 font-bold block">Role</label>
            <p className="text-sm text-white/60 capitalize">{role}</p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="flex-1 h-12 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-sm font-semibold text-white transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-12 rounded-xl bg-[#ff914d] hover:bg-[#e07530] text-sm font-semibold text-[#050507] transition disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,145,77,0.3)]"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
