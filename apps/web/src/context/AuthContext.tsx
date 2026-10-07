import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import type { Profile } from '@complaintease/shared';
import { supabase } from '../lib/supabase.js';
import { api } from '../lib/api-client.js';
import { DEMO_PROFILES } from '../lib/mock-store.js';

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
      // If server unreachable but demo user in local storage
      const stored = localStorage.getItem('complaintease_demo_user');
      if (stored && DEMO_PROFILES[stored]) {
        setProfile(DEMO_PROFILES[stored].profile);
      } else {
        console.warn('Could not fetch user profile:', err);
      }
    }
  };

  useEffect(() => {
    // Check local storage for active demo user session first
    const storedDemo = localStorage.getItem('complaintease_demo_user');
    if (storedDemo && DEMO_PROFILES[storedDemo]) {
      const demo = DEMO_PROFILES[storedDemo];
      setUser(demo.user);
      setProfile(demo.profile);
      setLoading(false);
      return;
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
    const normEmail = email.toLowerCase();
    const demo = DEMO_PROFILES[normEmail];

    // 1. Instant login for demo profiles (Alex Employee, Sarah IT Head, Marcus Admin)
    if (demo) {
      localStorage.setItem('complaintease_demo_user', normEmail);
      setUser(demo.user);
      setProfile(demo.profile);
      return;
    }

    // 2. Real Supabase Auth login for custom registered accounts
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
