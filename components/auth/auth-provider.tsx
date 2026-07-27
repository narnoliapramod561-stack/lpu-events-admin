'use client';

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import type { AuthUserProfile, UserRole } from '@/lib/types/auth';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: AuthUserProfile | null;
  role: UserRole | null;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
  children: ReactNode;
  initialSession: Session | null;
  initialProfile: AuthUserProfile | null;
};

async function loadProfile(userId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, email, role, full_name, avatar_url, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (!data || typeof data.id !== 'string' || typeof data.email !== 'string') {
    return null;
  }

  const displayName =
    typeof data.full_name === 'string' && data.full_name.trim().length > 0
      ? data.full_name.trim()
      : data.email.split('@')[0] || 'LPU Student';

  const role =
    data.role === 'super_admin' || data.role === 'organizer' || data.role === 'student'
      ? data.role
      : 'student';

  const avatarUrl = typeof data.avatar_url === 'string' ? data.avatar_url : null;
  const fullName = typeof data.full_name === 'string' ? data.full_name : null;
  const status = data.is_active === false ? 'inactive' : 'active';

  return {
    id: data.id,
    email: data.email,
    role,
    displayName,
    fullName,
    avatarUrl,
    status,
  } satisfies AuthUserProfile;
}

export function AuthProvider({ children, initialSession, initialProfile }: AuthProviderProps) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(initialSession);
  const [profile, setProfile] = useState<AuthUserProfile | null>(initialProfile);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      if (!nextSession?.user) {
        setProfile(null);
        startTransition(() => {
          router.refresh();
        });
        return;
      }

      void loadProfile(nextSession.user.id).then((nextProfile) => {
        setProfile(nextProfile);
        startTransition(() => {
          router.refresh();
        });
      });

      if (event === 'SIGNED_OUT') {
        startTransition(() => {
          router.refresh();
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      isAuthenticated: Boolean(session?.user),
    }),
    [profile, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return value;
}
