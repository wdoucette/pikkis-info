import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase, type Collection, type Profile } from '../lib/supabase';
import { collectionHref, describeFilter } from '../wardrobe/useCollections';
import type { Item } from '../types';
import { itemPath } from '../DecomposeGuide';

interface Row { item_id: string; status: string; done: boolean; updated_at: string }
type State =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'ok'; profile: Profile; rows: Row[]; collections: Collection[] };

const card = 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-3xl p-5 sm:p-6 shadow-sm';

export default function ProfilePage({ items }: { items: Item[] }) {
  const { username = '' } = useParams<{ username: string }>();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let alive = true;
    setState({ kind: 'loading' });
    (async () => {
      const uname = username.toLowerCase();
      if (!/^[a-z0-9_]{3,24}$/.test(uname)) { setState({ kind: 'missing' }); return; }
      const { data: profile } = await supabase.from('profiles').select('*').eq('username', uname).maybeSingle();
      if (!alive) return;
      if (!profile) { setState({ kind: 'missing' }); return; }
      const [w, c] = await Promise.all([
        supabase.from('wardrobe_items').select('item_id,status,done,updated_at').eq('user_id', profile.id).order('updated_at', { ascending: false }).limit(5000),
        supabase.from('collections').select('*').eq('user_id', profile.id).eq('is_public', true).order('created_at', { ascending: false }),
      ]);
      if (!alive) return;
      setState({ kind: 'ok', profile: { ...profile, settings: profile.settings || {} } as Profile, rows: (w.data as Row[]) || [], collections: (c.data as Collection[]) || [] });
    })();
    return () => { alive = false; };
  }, [username]);

  const byId = useMemo(() => new Map(items.map(i => [String(i.id), i])), [items]);

  if (state.kind === 'loading') {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5" aria-busy="true">
        <div className={`${card} h-40 animate-pulse`} />
        <div className={`${card} h-64 animate-pulse`} />
      </div>
    );
  }
  if (state.kind === 'missing') {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className={`${card} text-center`}>
          <h1 className="font-display text-3xl mb-2">Profile not found</h1>
          <p className="text-zinc-600 dark:text-zinc-300 mb-4">There's no public profile called <b>@{username}</b>. It may be private.</p>
          <Link to="/" className="text-amber-700 dark:text-amber-300 hover:underline">Back to the guide</Link>
        </div>
      </div>
    );
  }

  const { profile, rows, collections } = state;
  const owned = rows.filter(r => r.status === 'owned');
  const wanted = rows.filter(r => r.status === 'wanted');
  const done = rows.filter(r => r.done).length;
  const name = profile.display_name || profile.username || 'Player';
  const pct = items.length ? (owned.length / items.length) * 100 : 0;
  const list = (rs: Row[]) => rs.slice(0, 30).map(r => byId.get(r.item_id)).filter((i): i is Item => !!i);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <section className={`${card} flex flex-col sm:flex-row gap-5 sm:items-center`}>
        {profile.avatar_url
          ? <img src={profile.avatar_url} alt="" width={88} height={88} className="w-22 h-22 rounded-3xl object-cover shrink-0" />
          : <div className="w-22 h-22 rounded-3xl shrink-0 grid place-items-center bg-gradient-to-br from-amber-200 to-violet-200 dark:from-amber-800 dark:to-violet-800 font-display text-4xl text-zinc-900 dark:text-zinc-50" aria-hidden>{name[0]?.toUpperCase()}</div>}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl sm:text-4xl text-zinc-900 dark:text-zinc-50 truncate">{name}</h1>
          <div className="text-sm text-zinc-500">@{profile.username} · joined {new Date(profile.created_at).toLocaleDateString()}</div>
          <div className="mt-3 h-3 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Catalog owned">
            <div className="h-full bg-gradient-to-r from-amber-400 to-violet-400" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <div className="mt-1 text-xs text-zinc-500">{items.length ? `${pct.toFixed(1)}% of ${items.length.toLocaleString()} items owned` : '\u00a0'}</div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3 text-center">
        {[['Owned', owned.length], ['Wanted', wanted.length], ['Done', done]].map(([l, v]) => (
          <div key={l} className={card.replace('p-5 sm:p-6', 'p-4')}>
            <div className="text-xs uppercase tracking-wide text-zinc-500">{l}</div>
            <div className="font-display text-3xl tabular-nums text-amber-700 dark:text-amber-300">{(v as number).toLocaleString()}</div>
          </div>
        ))}
      </section>

      {collections.length > 0 && (
        <section className={card}>
          <h2 className="font-display text-xl mb-3">Collections</h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {collections.map(c => (
              <li key={c.id}><Link to={collectionHref(c)} className="block p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 hover:bg-amber-50 dark:hover:bg-zinc-700">
                <div className="font-semibold truncate">{c.name}</div>
                <div className="text-xs text-zinc-500 truncate">{c.description || describeFilter(c.filter_state)}</div>
              </Link></li>
            ))}
          </ul>
        </section>
      )}

      {[['Recently owned', list(owned)], ['Wishlist', list(wanted)]].map(([title, its]) => (its as Item[]).length > 0 && (
        <section key={title as string} className={card}>
          <h2 className="font-display text-xl mb-3">{title as string}</h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {(its as Item[]).map(i => (
              <li key={i.id}><Link to={itemPath(i)} className="block p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 hover:bg-amber-50 dark:hover:bg-zinc-700">
                <div className="font-medium truncate">{i.name}</div>
                <div className="text-xs text-zinc-500">{i.cat} #{i.n}</div>
              </Link></li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
