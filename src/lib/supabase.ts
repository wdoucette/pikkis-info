import { createClient } from '@supabase/supabase-js';

// Public by design: the publishable key only grants what Row Level Security allows.
// Never put a service_role / secret key in this app.
const FALLBACK_URL = 'https://fosgctjofhkshfseaxgp.supabase.co';
const FALLBACK_KEY = 'sb_publishable_39bL2Q28IYQKr41fi9XNIg_hqo1BWxT';

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
});

export type Theme = 'system' | 'light' | 'dark';

export interface ProfileSettings {
  theme?: Theme;
  sort?: string;
  dir?: 'asc' | 'desc';
  size?: number;
}

export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  settings: ProfileSettings;
  is_public: boolean;
  created_at: string;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  filter_state: Record<string, string>;
  is_public: boolean;
  created_at: string;
}

export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

export function friendlyError(e: unknown): string {
  const msg = (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e)) || 'Something went wrong';
  const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : '';
  if (code === '23505' || /duplicate key/i.test(msg)) return 'That username is already taken.';
  if (code === 'over_email_send_rate_limit' || /rate limit/i.test(msg)) return 'Too many emails sent recently. Please try again in an hour, or sign in with your password.';
  if (code === 'email_address_not_authorized' || /not authorized/i.test(msg)) return 'Email sign-in links are not enabled for this address yet. Please use a password.';
  if (/Invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (/Email not confirmed/i.test(msg)) return 'Please confirm your email first (check your inbox).';
  return msg;
}
