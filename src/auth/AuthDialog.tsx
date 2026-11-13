import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X, Mail, KeyRound, UserPlus } from 'lucide-react';
import { supabase, friendlyError, USERNAME_RE } from '../lib/supabase';
import { useAuth, type AuthMode } from './AuthProvider';

const redirect = (path = '/account') => `${window.location.origin}${path}`;

export default function AuthDialog() {
  const { authOpen, authMode, closeAuth } = useAuth();
  const [mode, setMode] = useState<AuthMode>(authMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authOpen) { setMode(authMode); setError(null); setInfo(null); setTimeout(() => firstRef.current?.focus(), 30); }
  }, [authOpen, authMode]);
  useEffect(() => {
    if (!authOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAuth(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authOpen, closeAuth]);

  if (!authOpen) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const u = username.trim().toLowerCase();
        if (u && !USERNAME_RE.test(u)) throw new Error('Username: 3–24 characters, lowercase letters, numbers and _ only.');
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: redirect(), data: u ? { username: u } : {} },
        });
        if (error) throw error;
        if (!data.session) setInfo('Account created. Check your email for a confirmation link, then sign in.');
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect(), shouldCreateUser: true } });
        if (error) throw error;
        setInfo('Check your email for a sign-in link.');
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email) { setError('Enter your email above first.'); return; }
    setBusy(true); setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect('/account?reset=1') });
    setBusy(false);
    if (error) setError(friendlyError(error)); else setInfo('If that account exists, a password reset link is on its way.');
  };

  const tabs: { k: AuthMode; label: string; icon: typeof Mail }[] = [
    { k: 'signin', label: 'Sign in', icon: KeyRound },
    { k: 'signup', label: 'Create account', icon: UserPlus },
    { k: 'magic', label: 'Email link', icon: Mail },
  ];
  const input = 'w-full h-11 px-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900 text-sm';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" onClick={closeAuth} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby="auth-title"
        className="relative w-full sm:max-w-md bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 id="auth-title" className="font-display text-2xl text-zinc-900 dark:text-zinc-50">Your Pikki wardrobe</h2>
          <button type="button" onClick={closeAuth} aria-label="Close" className="w-9 h-9 grid place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="w-5 h-5" /></button>
        </div>
        <div role="tablist" className="grid grid-cols-3 gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl mb-4">
          {tabs.map(t => (
            <button key={t.k} type="button" role="tab" aria-selected={mode === t.k} onClick={() => { setMode(t.k); setError(null); setInfo(null); }}
              className={`h-9 rounded-xl text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 ${mode === t.k ? 'bg-white dark:bg-zinc-900 text-amber-700 dark:text-amber-300 shadow-sm' : 'text-zinc-600 dark:text-zinc-300'}`}>
              <t.icon className="w-4 h-4 shrink-0" aria-hidden /><span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">
            <span className="block mb-1 text-zinc-600 dark:text-zinc-300">Email</span>
            <input ref={firstRef} className={input} type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          {mode !== 'magic' && (
            <label className="block text-sm">
              <span className="block mb-1 text-zinc-600 dark:text-zinc-300">Password</span>
              <input className={input} type="password" required minLength={mode === 'signup' ? 8 : undefined}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} />
            </label>
          )}
          {mode === 'signup' && (
            <label className="block text-sm">
              <span className="block mb-1 text-zinc-600 dark:text-zinc-300">Username <span className="text-zinc-500">(optional, you can set it later)</span></span>
              <input className={input} value={username} onChange={e => setUsername(e.target.value.toLowerCase())} maxLength={24}
                pattern="[a-z0-9_]{3,24}" placeholder="e.g. pikki_fan" autoComplete="username" />
            </label>
          )}
          {mode === 'magic' && <p className="text-xs text-zinc-500">We'll email you a one-time link. No password needed.</p>}
          <div className="min-h-5 text-sm" aria-live="polite">
            {error && <p className="text-red-700 dark:text-red-300">{error}</p>}
            {info && <p className="text-emerald-700 dark:text-emerald-300">{info}</p>}
          </div>
          <button type="submit" disabled={busy}
            className="w-full h-11 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-semibold disabled:opacity-60">
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Email me a link'}
          </button>
          {mode === 'signin' && (
            <button type="button" onClick={forgot} className="w-full text-xs text-zinc-500 hover:text-amber-700 dark:hover:text-amber-300">Forgot password?</button>
          )}
        </form>
        <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">Your wardrobe is saved to your account so it follows you between devices. Profiles are private unless you make them public.</p>
      </div>
    </div>
  );
}
