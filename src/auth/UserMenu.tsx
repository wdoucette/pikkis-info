import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, User as UserIcon, Globe } from 'lucide-react';
import { useAuth } from './AuthProvider';

/** Header account control. Fixed footprint in every state so the header never shifts. */
export default function UserMenu() {
  const { ready, user, profile, openAuth, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  const box = 'w-[80px] sm:w-[132px] h-10 shrink-0';
  if (!ready) return <div className={`${box} rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse`} aria-hidden />;
  if (!user) {
    return (
      <button type="button" onClick={() => openAuth('signin')}
        className={`${box} rounded-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold shadow-sm`}>
        Sign in
      </button>
    );
  }
  const name = profile?.display_name || profile?.username || user.email?.split('@')[0] || 'Me';
  return (
    <div ref={ref} className={`relative ${box}`}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        className="w-full h-full rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-amber-300 flex items-center gap-2 pl-1 pr-3">
        {profile?.avatar_url
          ? <img src={profile.avatar_url} alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover shrink-0" />
          : <span className="w-8 h-8 rounded-full shrink-0 grid place-items-center bg-gradient-to-br from-amber-300 to-violet-300 text-zinc-900 font-display text-base" aria-hidden>{name[0]?.toUpperCase()}</span>}
        <span className="text-sm font-semibold truncate min-w-0">{name}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-lg p-1.5 z-50">
          <div className="px-3 py-2 text-xs text-zinc-500 truncate">{user.email}</div>
          <Link role="menuitem" to="/account" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-amber-50 dark:hover:bg-zinc-800"><UserIcon className="w-4 h-4" /> Account &amp; collections</Link>
          {profile?.username && (
            <Link role="menuitem" to={`/u/${profile.username}`} onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-amber-50 dark:hover:bg-zinc-800"><Globe className="w-4 h-4" /> My public profile</Link>
          )}
          <button role="menuitem" type="button" onClick={() => { setOpen(false); signOut(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-amber-50 dark:hover:bg-zinc-800"><LogOut className="w-4 h-4" /> Sign out</button>
        </div>
      )}
    </div>
  );
}
