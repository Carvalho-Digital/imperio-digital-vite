import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => setSession(s))
      .catch((e) => console.error('[Auth] getSession falhou:', e))
      .finally(() => setIsLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  };

  const signUp = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? error.message : null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
