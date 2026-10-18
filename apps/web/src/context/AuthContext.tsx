import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import type { Profile } from '@complaintease/shared';
import { supabase } from '../lib/supabase.js';
import { api } from '../lib/api-client.js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Profile | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const inFlightPromiseRef = useRef<Promise<Profile | null> | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const fetchProfile = async (): Promise<Profile | null> => {
    // Return existing in-flight promise to prevent duplicate concurrent network calls
    if (inFlightPromiseRef.current) {
      return inFlightPromiseRef.current;
    }

    const currentTargetId = activeUserIdRef.current;
    const promise = (async () => {
      try {
        const data = await api.auth.me();
        // Guard against stale user resolution (e.g. logged out while request was in flight)
        if (isMountedRef.current && activeUserIdRef.current === currentTargetId) {
          setProfile(data.profile);
        }
        return data.profile;
      } catch (err) {
        console.warn('Could not fetch user profile:', err);
        if (isMountedRef.current && activeUserIdRef.current === currentTargetId) {
          setProfile(null);
        }
        return null;
      } finally {
        inFlightPromiseRef.current = null;
      }
    })();

    inFlightPromiseRef.current = promise;
    return promise;
  };

  useEffect(() => {
    isMountedRef.current = true;

    // Supabase auth change listener handles both INITIAL_SESSION and subsequent events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMountedRef.current) return;

      const nextUserId = currentSession?.user?.id ?? null;
      activeUserIdRef.current = nextUserId;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        // De-duplicated fetch
        await fetchProfile();
      } else {
        setProfile(null);
      }

      if (isMountedRef.current) {
        setLoading(false);
      }
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<Profile | null> => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      throw new Error(error.message || 'Invalid email or password. Please try again.');
    }
    return await fetchProfile();
  };

  const logout = async () => {
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
