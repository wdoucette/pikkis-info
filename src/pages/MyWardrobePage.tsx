import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { HardDrive, Cloud, Trash2, Bookmark } from 'lucide-react';
import DecomposeGuide, { type GuideDefaults } from '../DecomposeGuide';
import { useAuth } from '../auth/AuthProvider';
import type { Collection } from '../lib/supabase';
import type { SyncState } from '../wardrobe/useWardrobe';
import { collectionHref, describeFilter } from '../wardrobe/useCollections';
import ArchivesPanel from '../wardrobe/ArchivesPanel';
import type { Item, Meta, WardrobeData } from '../types';

const TABS = [
  { k: '', label: 'All mine' },
  { k: 'Owned', label: 'Owned' },
  { k: 'Wanted', label: 'Wanted' },
] as const;

const card = 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-3xl shadow-sm';

export default function MyWardrobePage(props: {
  items: Item[];
  meta: Meta | null;
  wardrobe: WardrobeData;
  setWardrobe: (w: WardrobeData) => void;
  loading: boolean;
  defaults: GuideDefaults;
  sync: SyncState;
  collections: Collection[];
  onSaveView: (name: string, f: Record<string, string>) => Promise<unknown>;
  onDeleteView: (id: string) => Promise<void>;
}) {
  const { items, wardrobe, setWardrobe, loading, collections, onDeleteView } = props;
  const { ready, user, profile, openAuth } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('status') || '';

  const stats = useMemo(() => {
    const byCat = new Map<string, { total: number; owned: number; wanted: number; done: number }>();
    let owned = 0, wanted = 0, done = 0;
    for (const it of items) {
      const c = byCat.get(it.cat) || { total: 0, owned: 0, wanted: 0, done: 0 };
      c.total++;
      const e = wardrobe[it.id];
      if (e) {
        if (e.owned > 0) { c.owned++; owned++; } else if (e.wanted) { c.wanted++; wanted++; }
        if (e.done) { c.done++; done++; }
      }
      byCat.set(it.cat, c);
    }
    const cats = Array.from(byCat.entries()).sort((a, b) => (b[1].owned + b[1].wanted) - (a[1].owned + a[1].wanted) || a[0].localeCompare(b[0]));
    return { owned, wanted, done, cats };
  }, [items, wardrobe]);

  const total = items.length;
  const pct = (n: number) => (total ? `${((n / total) * 100).toFixed(n && n / total < 0.001 ? 2 : 1)}%` : '—');
  const setTab = (k: string) => setParams(prev => {
    const next = new URLSearchParams(prev);
    if (k) next.set('status', k); else next.delete('status');
    next.delete('page');
    return next;
  }, { replace: true });

  return (
    <div className="pt-4">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl text-zinc-900 dark:text-zinc-50">My Wardrobe</h1>
            <p className="text-sm text-zinc-500">Everything you've marked Owned, Wanted or Done.</p>
          </div>
        </div>

        {/* Storage banner: same slot and height in every auth state, so nothing shifts. */}
        <div className={`${card} h-[92px] sm:h-[64px] overflow-hidden px-4 py-3 flex flex-nowrap items-center gap-3 sm:gap-4`} role="status">
          {!ready ? (
            <span className="h-4 w-64 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" aria-hidden />
          ) : user ? (
            <>
              <Cloud className="w-5 h-5 text-violet-600 dark:text-violet-300 shrink-0" aria-hidden />
              <span className="text-sm flex-1 min-w-0">Saved to your account{profile?.username ? <> as <b>@{profile.username}</b></> : ''}. It follows you on every device.</span>
              {profile?.username && profile.is_public && <Link to={`/u/${profile.username}`} className="shrink-0 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:underline">Public profile</Link>}
            </>
          ) : (
            <>
              <HardDrive className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0" aria-hidden />
              <span className="text-sm flex-1 min-w-0">Saved in this browser only. Sign in to keep it in the cloud.</span>
              <button type="button" onClick={() => openAuth('signin')} className="shrink-0 h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold">Sign in</button>
            </>
          )}
        </div>

        {/* Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: 'Owned', v: stats.owned, c: 'text-emerald-700 dark:text-emerald-300' },
              { l: 'Wanted', v: stats.wanted, c: 'text-violet-700 dark:text-violet-300' },
              { l: 'Done', v: stats.done, c: 'text-amber-700 dark:text-amber-300' },
            ].map(x => (
              <div key={x.l} className={`${card} p-3 sm:p-4 text-center flex flex-col justify-center h-[112px] lg:h-[140px]`}>
                <div className="text-xs uppercase tracking-wide text-zinc-500">{x.l}</div>
                <div className={`font-display text-3xl tabular-nums ${x.c}`}>{loading ? <span className="inline-block h-8 w-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse align-middle" /> : x.v.toLocaleString()}</div>
                <div className="text-[11px] text-zinc-500 tabular-nums whitespace-nowrap h-4">{loading ? '\u00a0' : <>{pct(x.v)}<span className="hidden sm:inline"> of {total.toLocaleString()}</span></>}</div>
              </div>
            ))}
          </div>
          <div className={`${card} p-3 sm:p-4`}>
            <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">By category</div>
            <div className="h-[200px] lg:h-[84px] overflow-y-auto pr-1 [scrollbar-width:thin]">
              {loading ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-4 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />)}</div>
              ) : (
                <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                  {stats.cats.map(([cat, c]) => (
                    <li key={cat} className="text-xs">
                      <div className="flex justify-between gap-2 tabular-nums">
                        <Link to={`/my-wardrobe?cat=${encodeURIComponent(cat)}`} className="truncate hover:text-amber-700 dark:hover:text-amber-300">{cat}</Link>
                        <span className="text-zinc-500 shrink-0">{c.owned}/{c.total}{c.wanted ? ` · ★${c.wanted}` : ''}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex">
                        <div className="h-full bg-emerald-500" style={{ width: `${(c.owned / c.total) * 100}%` }} />
                        <div className="h-full bg-violet-400" style={{ width: `${(c.wanted / c.total) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Saved views: fixed-height scroller */}
        <div className={`${card} px-3 sm:px-4 py-2 flex items-center gap-3 h-[60px]`}>
          <span className="text-xs uppercase tracking-wide text-zinc-500 shrink-0 inline-flex items-center gap-1"><Bookmark className="w-3.5 h-3.5" aria-hidden /> Saved views</span>
          <div className="flex gap-2 overflow-x-auto overflow-y-hidden h-full items-center [scrollbar-width:thin] cat-scroller min-w-0 flex-1">
            {collections.length === 0 ? (
              <span className="text-xs text-zinc-500 whitespace-nowrap">None yet. Use “Save view” below to keep a search{user ? '' : ' (saved in this browser)'}.</span>
            ) : collections.map(c => (
              <span key={c.id} className="shrink-0 inline-flex items-center h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                <Link to={collectionHref(c)} title={describeFilter(c.filter_state)} className="pl-3 pr-2 text-xs font-semibold max-w-[180px] truncate hover:text-amber-700 dark:hover:text-amber-300">{c.name}</Link>
                <button type="button" aria-label={`Delete view ${c.name}`} onClick={() => { if (confirm(`Delete saved view “${c.name}”?`)) onDeleteView(c.id); }}
                  className="w-8 h-full grid place-items-center text-zinc-500 hover:text-red-700 dark:hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>
              </span>
            ))}
          </div>
        </div>

        <ArchivesPanel user={user} items={items} wardrobe={wardrobe} setWardrobe={setWardrobe} />

        {/* Tabs */}
        <div role="tablist" aria-label="Wardrobe section" className="inline-grid grid-cols-3 gap-1 p-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl w-full sm:w-auto">
          {TABS.map(t => {
            const n = t.k === 'Owned' ? stats.owned : t.k === 'Wanted' ? stats.wanted : null;
            const on = tab === t.k || (!t.k && !['Owned', 'Wanted'].includes(tab));
            return (
              <button key={t.k || 'all'} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.k)}
                className={`h-10 sm:w-36 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1.5 ${on ? 'bg-amber-600 text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                {t.label}{n !== null && <span className={`tabular-nums text-xs min-w-[2.5ch] ${on ? 'opacity-90' : 'text-zinc-500'}`}>{loading ? '' : n.toLocaleString()}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <DecomposeGuide {...props} mine signedIn={!!user} />
    </div>
  );
}
