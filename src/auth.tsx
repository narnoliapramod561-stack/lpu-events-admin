import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { trackAdminAction } from '@lpu-events/shared';

export interface AdminProfile {
  id: string;
  display_name: string;
  email: string;
  is_super_admin: boolean;
  org_id: string | null;
  org_name: string | null;
  org_role: string | null;
}

export interface AuthContextType {
  session: any;
  user: any;
  profile: AdminProfile | null;
  loading: boolean;
  signInWithOtp: (email: string) => Promise<{ error: any }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const initialAuthDoneRef = React.useRef(false);

  const fetchProfile = async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    try {
      const { data, error } = await supabase.rpc('get_current_admin_profile');
      if (error) {
        console.error('Error fetching admin profile:', error);
      } else if (data) {
        setProfile((prev) => {
          if (prev && JSON.stringify(prev) === JSON.stringify(data)) return prev;
          return data as AdminProfile;
        });
      }
    } catch (err) {
      console.error('Failed to get profile:', err);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      initialAuthDoneRef.current = true;
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user) {
        if (event === 'SIGNED_IN' && !initialAuthDoneRef.current) {
          setLoading(true);
          await fetchProfile(currentSession.user.id);
          initialAuthDoneRef.current = true;
          setLoading(false);
          trackAdminAction('auth_login_success', { success: true });
          await supabase.rpc('log_security_event', { p_action: 'LOGIN', p_status: 'SUCCESS' });
        } else {
          // Token refreshed / window focus / tab switch: update quietly in background without unmounting or reloading UI
          await fetchProfile(currentSession.user.id);
        }
      } else {
        setProfile(null);
        setLoading(false);
        if (event === 'SIGNED_OUT') {
          initialAuthDoneRef.current = false;
          trackAdminAction('auth_logout', { success: true });
          await supabase.rpc('log_security_event', { p_action: 'LOGOUT', p_status: 'SUCCESS' });
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithOtp = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true
        }
      });
      if (!error) {
        await supabase.rpc('log_security_event', { p_action: 'REQUEST_OTP', p_status: 'SUCCESS', p_metadata: { email } });
      } else {
        await supabase.rpc('log_security_event', { p_action: 'REQUEST_OTP', p_status: 'FAILED', p_metadata: { email, error: error.message } });
      }
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  };

  const verifyOtp = async (email: string, token: string) => {
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email'
      });
      if (error) {
        await supabase.rpc('log_security_event', { p_action: 'VERIFY_OTP', p_status: 'FAILED', p_metadata: { email, error: error.message } });
      }
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (session?.user) {
      await fetchProfile(session.user.id);
    }
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signInWithOtp,
      verifyOtp,
      signOut,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Route guards / Conditional renders

export function RequireAuth({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading Session...</div>;
  if (!user) return <>{fallback ?? <div>Access Denied — Authenticated session required.</div>}</>;
  return <>{children}</>;
}

export function RequireSuperAdmin({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return <div>Loading Permissions...</div>;
  if (!profile?.is_super_admin) {
    return <>{fallback ?? <div style={{ color: 'red', padding: '20px' }}>Access Denied — Super Admin privileges required.</div>}</>;
  }
  return <>{children}</>;
}

export function RequireOrganizer({ children, fallback }: { children: React.ReactNode, fallback?: React.ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return <div>Loading Permissions...</div>;
  if (!profile?.org_id) {
    return <>{fallback ?? <div style={{ color: 'red', padding: '20px' }}>Access Denied — Organizer authorization required.</div>}</>;
  }
  return <>{children}</>;
}
