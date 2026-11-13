import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile, type ProfileSettings } from '../lib/supabase';
import { applyTheme } from '../lib/theme';

interface AuthState {
  /** True until the stored session has been read (avoids flashing "Sign in"). */
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, 'username' | 'display_name' | 'avatar_url' | 'is_public'>> & { settings?: ProfileSettings }) => Promise<void>;
  signOut: () => Promise<void>;
  authOpen: boolean;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
  authMode: AuthMode;
}
export type AuthMode = 'signin' | 'signup';

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const user = session?.user ?? null;

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setReady(true);
      if (s) setAuthOpen(false);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  const loadProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (error) { console.warn('Profile load failed', error.message); return; }
    if (data) {
      const p = { ...data, settings: data.settings || {} } as Profile;
      setProfile(p);
      if (p.settings.theme) applyTheme(p.settings.theme);
    }
  }, []);

  useEffect(() => {
    if (user?.id) loadProfile(user.id); else setProfile(null);
  }, [user?.id, loadProfile]);

  const refreshProfile = useCallback(async () => { if (user?.id) await loadProfile(user.id); }, [user?.id, loadProfile]);

  const updateProfile = useCallback<AuthState['updateProfile']>(async patch => {
    if (!user) throw new Error('Not signed in');
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', user.id).select('*').single();
    if (error) throw error;
    const p = { ...data, settings: data.settings || {} } as Profile;
    setProfile(p);
    if (patch.settings?.theme) applyTheme(patch.settings.theme);
  }, [user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo<AuthState>(() => ({
    ready, session, user, profile, refreshProfile, updateProfile, signOut,
    authOpen, authMode,
    openAuth: (mode: AuthMode = 'signin') => { setAuthMode(mode); setAuthOpen(true); },
    closeAuth: () => setAuthOpen(false),
  }), [ready, session, user, profile, refreshProfile, updateProfile, signOut, authOpen, authMode]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
