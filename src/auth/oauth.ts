import { useEffect, useState } from 'react';
import { SUPABASE_URL, SUPABASE_KEY } from '../lib/supabase';

/** Social sign-ins we show a button for, in display order (only those enabled in Supabase appear). */
export const OAUTH_PROVIDERS = ['google', 'github', 'facebook', 'discord', 'twitter', 'apple'] as const;
export type OAuthProvider = typeof OAUTH_PROVIDERS[number];
export const OAUTH_LABELS: Record<OAuthProvider, string> = {
  google: 'Google', github: 'GitHub', facebook: 'Facebook', discord: 'Discord', twitter: 'X (Twitter)', apple: 'Apple',
};

let cached: OAuthProvider[] | null = null;

/** Reads Supabase's public /auth/v1/settings so buttons appear as soon as a provider is switched on. */
export function useOAuthProviders(active: boolean): OAuthProvider[] {
  const [list, setList] = useState<OAuthProvider[]>(cached || []);
  useEffect(() => {
    if (!active || cached) return;
    let alive = true;
    fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } })
      .then(r => (r.ok ? r.json() : null))
      .then(s => {
        const ext = (s?.external || {}) as Record<string, boolean>;
        cached = OAUTH_PROVIDERS.filter(p => ext[p]);
        if (alive) setList(cached);
      })
      .catch(() => { /* no buttons */ });
    return () => { alive = false; };
  }, [active]);
  return list;
}
