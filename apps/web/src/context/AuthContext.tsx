import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import type { Profile } from '@complaintease/shared';
import { supabase } from '../lib/supabase.js';
import { api } from '../lib/api-client.js';
import { mockStore } from '../lib/mock-store.js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const data = await api.auth.me();
      setProfile(data.profile);
    } catch (err) {
      // If server unreachable but local user in storage
      const stored = localStorage.getItem('complaintease_demo_user');
      if (stored) {
        const u = mockStore.getUserByEmail(stored);
        if (u) {
          setProfile(u.profile);
          setUser(u.user as any);
        }
      } else {
        console.warn('Could not fetch user profile:', err);
      }
    }
  };

  useEffect(() => {
    // Check local storage for active user session first
    const storedDemo = localStorage.getItem('complaintease_demo_user');
    if (storedDemo) {
      const u = mockStore.getUserByEmail(storedDemo);
      if (u) {
        setUser(u.user as any);
        setProfile(u.profile);
        setLoading(false);
        return;
      }
    }

    // Try live Supabase session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile().finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        setLoading(false);
      });

    // Supabase auth change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile();
      } else {
        const stored = localStorage.getItem('complaintease_demo_user');
        if (!stored) {
          setProfile(null);
        }
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const normEmail = email.toLowerCase().trim();

    // 1. Check local persistent store (supports baseline accounts + all dynamically registered users)
    try {
      const authResult = mockStore.authenticate(normEmail, password);
      localStorage.setItem('complaintease_demo_user', normEmail);
      setUser(authResult.user as any);
      setProfile(authResult.profile);
      return;
    } catch (mockErr: any) {
      if (mockErr.message?.includes('Incorrect password')) {
        throw mockErr;
      }
      // If user not in local store, try Supabase auth
    }

    // 2. Real Supabase Auth login fallback
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    localStorage.removeItem('complaintease_demo_user');
    await fetchProfile();
  };

  const logout = async () => {
    localStorage.removeItem('complaintease_demo_user');
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        login,
        logout,
        refreshProfile: fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
