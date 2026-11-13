import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Trash2, ExternalLink, Globe, Lock } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { supabase, friendlyError, USERNAME_RE, type Theme, type Collection } from '../lib/supabase';
import { applyTheme, getStoredTheme } from '../lib/theme';
import { collectionHref, describeFilter } from '../wardrobe/useCollections';
import type { WardrobeData } from '../types';

const SORTS = ['cat', 'name', 'n', 'r', 'status', 'rd', 'rdc', 'rr', 'used', 'waiting', 'owned', 'done'];
const SIZES = [25, 50, 100, 250];

const card = 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-3xl p-5 sm:p-6 shadow-sm';
const input = 'w-full h-11 px-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900 text-sm';
const label = 'block text-sm text-zinc-600 dark:text-zinc-300 mb-1';

export default function AccountPage({ wardrobe, itemCount, collections, onUpdateCollection, onDeleteCollection }: {
  wardrobe: WardrobeData;
  itemCount: number;
  collections: Collection[];
  onUpdateCollection: (id: string, patch: Partial<Pick<Collection, 'is_public' | 'name'>>) => Promise<void>;
  onDeleteCollection: (id: string) => Promise<void>;
}) {
  const { ready, user, profile, updateProfile, openAuth } = useAuth();
  const [params] = useSearchParams();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [theme, setTheme] = useState<Theme>(getStoredTheme());
  const [sort, setSort] = useState('cat');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [size, setSize] = useState(50);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username || '');
    setDisplayName(profile.display_name || '');
    setAvatar(profile.avatar_url || '');
    setIsPublic(profile.is_public);
    setTheme(profile.settings.theme || getStoredTheme());
    setSort(profile.settings.sort || 'cat');
    setDir(profile.settings.dir || 'asc');
    setSize(profile.settings.size || 50);
  }, [profile]);

  const entries = Object.values(wardrobe);
  const owned = entries.filter(e => e.owned > 0).length;
  const wanted = entries.filter(e => !(e.owned > 0) && e.wanted).length;
  const done = entries.filter(e => e.done).length;

  if (!ready) return <div className="max-w-3xl mx-auto p-4 sm:p-6"><div className={`${card} h-64 animate-pulse`} /></div>;
  if (!user) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className={`${card} text-center`}>
          <h1 className="font-display text-3xl mb-2">Your account</h1>
          <p className="text-zinc-600 dark:text-zinc-300 mb-5">Sign in to save your wardrobe to the cloud, keep collections and share a profile.</p>
          <button type="button" onClick={() => openAuth('signin')} className="h-11 px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-semibold">Sign in or create an account</button>
        </div>
      </div>
    );
  }

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    if (u && !USERNAME_RE.test(u)) { setMsg({ ok: false, text: 'Username: 3–24 characters, lowercase letters, numbers and _ only.' }); return; }
    if (isPublic && !u) { setMsg({ ok: false, text: 'Pick a username before making your profile public.' }); return; }
    if (avatar && !/^https:\/\//.test(avatar)) { setMsg({ ok: false, text: 'Avatar must be an https:// image link.' }); return; }
    setBusy(true); setMsg(null);
    try {
      await updateProfile({
        username: u || null, display_name: displayName.trim() || null, avatar_url: avatar.trim() || null, is_public: isPublic,
        settings: { ...(profile?.settings || {}), theme, sort, dir, size },
      });
      applyTheme(theme);
      setMsg({ ok: true, text: 'Saved.' });
    } catch (err) {
      setMsg({ ok: false, text: friendlyError(err) });
    } finally { setBusy(false); }
  };

  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) { setPwMsg({ ok: false, text: 'At least 8 characters.' }); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwMsg(error ? { ok: false, text: friendlyError(error) } : { ok: true, text: 'Password updated.' });
    if (!error) setPw('');
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <h1 className="font-display text-3xl sm:text-4xl text-zinc-900 dark:text-zinc-50">Your account</h1>

      <section className={card} aria-labelledby="stats-h">
        <h2 id="stats-h" className="font-display text-xl mb-3">Wardrobe progress</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[['Owned', owned, itemCount ? `${((owned / itemCount) * 100).toFixed(1)}% of catalog` : ''], ['Wanted', wanted, 'on wishlist'], ['Done', done, 'checked off']].map(([l, v, h]) => (
            <div key={l as string} className="rounded-2xl bg-zinc-50 dark:bg-zinc-800 p-3">
              <div className="text-xs uppercase tracking-wide text-zinc-500">{l}</div>
              <div className="font-display text-3xl tabular-nums text-amber-700 dark:text-amber-300">{(v as number).toLocaleString()}</div>
              <div className="text-[11px] text-zinc-500 min-h-4">{h}</div>
            </div>
          ))}
        </div>
      </section>

      <form onSubmit={save} className={`${card} space-y-4`} aria-labelledby="profile-h">
        <h2 id="profile-h" className="font-display text-xl">Profile</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block"><span className={label}>Username</span>
            <input className={input} value={username} onChange={e => setUsername(e.target.value.toLowerCase())} maxLength={24} pattern="[a-z0-9_]{3,24}" placeholder="pikki_fan" />
            <span className="text-[11px] text-zinc-500">Your profile link: /u/{username || 'username'}</span>
          </label>
          <label className="block"><span className={label}>Display name</span>
            <input className={input} value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={40} />
          </label>
          <label className="block sm:col-span-2"><span className={label}>Avatar image link (optional)</span>
            <input className={input} value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="https://…" inputMode="url" />
          </label>
        </div>
        <label className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 cursor-pointer">
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="mt-1 w-4 h-4 accent-amber-600" />
          <span className="text-sm"><b>Public profile</b><br /><span className="text-zinc-600 dark:text-zinc-300">Anyone with your link can see your wardrobe stats and the collections you mark public. Your email is never shown.</span></span>
        </label>

        <h2 className="font-display text-xl pt-2">Preferences</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <label className="block"><span className={label}>Theme</span>
            <select className={input} value={theme} onChange={e => { const t = e.target.value as Theme; setTheme(t); applyTheme(t); }}>
              <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
            </select>
          </label>
          <label className="block"><span className={label}>Default sort</span>
            <select className={input} value={sort} onChange={e => setSort(e.target.value)}>{SORTS.map(s => <option key={s} value={s}>{s}</option>)}</select>
          </label>
          <label className="block"><span className={label}>Direction</span>
            <select className={input} value={dir} onChange={e => setDir(e.target.value as 'asc' | 'desc')}><option value="asc">Ascending</option><option value="desc">Descending</option></select>
          </label>
          <label className="block"><span className={label}>Rows per page</span>
            <select className={input} value={size} onChange={e => setSize(parseInt(e.target.value, 10))}>{SIZES.map(s => <option key={s} value={s}>{s}</option>)}</select>
          </label>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" disabled={busy} className="h-11 px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-semibold disabled:opacity-60">{busy ? 'Saving…' : 'Save changes'}</button>
          {profile?.username && profile.is_public && <Link to={`/u/${profile.username}`} className="text-sm text-amber-700 dark:text-amber-300 hover:underline inline-flex items-center gap-1">View public profile <ExternalLink className="w-3.5 h-3.5" /></Link>}
          <span className={`text-sm min-h-5 ${msg?.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`} aria-live="polite">{msg?.text}</span>
        </div>
      </form>

      <section className={card} aria-labelledby="col-h">
        <h2 id="col-h" className="font-display text-xl mb-1">Collections</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">Saved guide views. Use <b>Save view</b> on the guide to add one.</p>
        {collections.length === 0 ? <p className="text-sm text-zinc-500">No collections yet.</p> : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {collections.map(c => (
              <li key={c.id} className="py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Link to={collectionHref(c)} className="font-semibold hover:text-amber-700 dark:hover:text-amber-300 truncate block">{c.name}</Link>
                  <div className="text-xs text-zinc-500 truncate">{describeFilter(c.filter_state)}</div>
                </div>
                <button type="button" onClick={() => onUpdateCollection(c.id, { is_public: !c.is_public })}
                  title={c.is_public ? 'Public (shown on your profile when it is public)' : 'Private'}
                  className={`w-24 h-9 shrink-0 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1 border ${c.is_public ? 'border-violet-300 bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-700' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`}>
                  {c.is_public ? <><Globe className="w-3.5 h-3.5" /> Public</> : <><Lock className="w-3.5 h-3.5" /> Private</>}
                </button>
                <button type="button" aria-label={`Delete ${c.name}`} onClick={() => { if (confirm(`Delete collection “${c.name}”?`)) onDeleteCollection(c.id); }}
                  className="w-9 h-9 shrink-0 grid place-items-center rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-red-300 text-zinc-500"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={changePw} className={`${card} space-y-3 ${params.get('reset') ? 'ring-2 ring-amber-400' : ''}`} aria-labelledby="pw-h">
        <h2 id="pw-h" className="font-display text-xl">{params.get('reset') ? 'Choose a new password' : 'Password'}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Signed in as {user.email}. Set or change your password (useful if you signed in with an email link).</p>
        <div className="flex gap-3 flex-col sm:flex-row">
          <input className={input} type="password" autoComplete="new-password" minLength={8} value={pw} onChange={e => setPw(e.target.value)} placeholder="New password (8+ characters)" aria-label="New password" />
          <button type="submit" className="h-11 px-5 rounded-2xl border border-zinc-300 dark:border-zinc-600 hover:border-amber-400 font-semibold text-sm shrink-0">Update password</button>
        </div>
        <span className={`text-sm min-h-5 block ${pwMsg?.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`} aria-live="polite">{pwMsg?.text}</span>
      </form>
    </div>
  );
}
