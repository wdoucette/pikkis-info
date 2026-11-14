import { useState, useEffect, useMemo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink, useParams } from 'react-router-dom';
import { Edit2, ArrowLeft, Star, Shirt } from 'lucide-react';

const DATA_URL = 'https://raw.githubusercontent.com/wdoucette/pikkis-info-data/main/data/pikkis-info.min.json';
const FALLBACK_URL = 'https://cdn.jsdelivr.net/gh/wdoucette/pikkis-info-data@main/data/pikkis-info.min.json';

import type { Item, Meta, WardrobeData } from './types';
import DecomposeGuide, { StatusBadge, Hearts, itemPath } from './DecomposeGuide';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import AuthDialog from './auth/AuthDialog';
import UserMenu from './auth/UserMenu';
import AccountPage from './pages/AccountPage';
import ProfilePage from './pages/ProfilePage';
import MyWardrobePage from './pages/MyWardrobePage';
import ContactPage from './pages/ContactPage';
import AboutPage from './pages/AboutPage';
import { useWardrobe } from './wardrobe/useWardrobe';
import { useCollections } from './wardrobe/useCollections';
import { deriveInfo } from './guide/status';

const PikkiMonogram = () => (
  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
    <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-violet-400 flex items-center justify-center text-white font-display font-semibold text-2xl sm:text-[28px] shadow-[0_4px_12px_-2px_rgb(var(--glow)/0.45)] ring-2 ring-white/70 dark:ring-zinc-900/60" aria-hidden>
      <span className="drop-shadow-[0_1px_1px_rgb(0_0_0/0.25)]">P</span>
    </div>
    <div className="min-w-0">
      <div className="font-display font-semibold text-[19px] sm:text-[28px] leading-none tracking-tight text-zinc-900 dark:text-zinc-50 whitespace-nowrap">Pikki's Info</div>
      <div className="text-[9px] sm:text-[11px] leading-none mt-1 text-amber-700 dark:text-amber-300 font-semibold tracking-[0.06em] sm:tracking-[0.18em] whitespace-nowrap">DECOMPOSE GUIDE</div>
    </div>
  </div>
);

const LoadingSpinner = () => (
  <div className="max-w-4xl mx-auto p-4 sm:p-6" role="status" aria-label="Loading item">
    <div className="h-5 w-32 mb-6 rounded-full bg-zinc-200/70 dark:bg-zinc-800 animate-pulse" />
    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5 sm:p-8 h-[560px] animate-pulse" />
  </div>
);

function ItemPage({ items, wardrobe, setWardrobe, loading }: { items: Item[]; wardrobe: WardrobeData; setWardrobe: (w: WardrobeData) => void; loading: boolean }) {
  const { cat, n, id } = useParams<{ cat?: string; n?: string; id?: string }>();
  const item = useMemo(() => {
    if (id) return items.find(i => i.id === parseInt(id, 10));
    if (cat && n) {
      const c = decodeURIComponent(cat).toLowerCase();
      return items.find(i => i.cat.toLowerCase() === c && i.n === parseInt(n, 10));
    }
    return undefined;
  }, [items, id, cat, n]);
  const backTo = (() => {
    try {
      const s = sessionStorage.getItem('pikkis-guide-search') || '';
      if (s.startsWith('mine:')) return `/my-wardrobe${s.length > 5 ? `?${s.slice(5)}` : ''}`;
      return s ? `/?${s}` : '/';
    } catch { return '/'; }
  })();

  if (loading) return <LoadingSpinner />;
  if (!item) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h2 className="text-2xl font-semibold mb-4">Item not found</h2>
        <Link to={backTo} className="text-amber-600 hover:underline inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Decompose Guide
        </Link>
      </div>
    );
  }

  const info = deriveInfo(item, wardrobe);
  const byId = (pid: number) => items.find(i => i.id === pid);
  const wanted = !(info.owned > 0) && !!wardrobe[item.id]?.wanted;
  const setEntry = (patch: Partial<{ owned: number; done: boolean; wanted: boolean }>) => {
    const next = { ...(wardrobe[item.id] ?? { owned: 0, done: false }), ...patch };
    if (next.owned > 0) delete next.wanted;
    setWardrobe({ ...wardrobe, [item.id]: next });
  };
  const evTo: { id: number; num?: number }[] = Array.isArray(item.ev?.to) ? item.ev.to : [];
  const evFrom: { id: number; num?: number }[] = Array.isArray(item.ev?.from) ? item.ev.from : [];
  const usedIds = new Set((item.u || []).map(u => u.id));
  const heldBy = [
    item.d?.length ? 'Customizable' : null,
    item.ev ? 'Evolvable' : null,
    item.u?.length ? 'Design material' : null,
  ].filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <Link to={backTo} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> {backTo.startsWith('/my-wardrobe') ? 'Back to My Wardrobe' : 'Back to Guide'}
      </Link>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow p-5 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-mono rounded-full">{item.cat} #{item.n}</span>
              <Hearts r={item.r} />
              <StatusBadge status={info.status} waiting={info.waiting} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mt-3 text-balance">{item.name}</h1>
            {item.edited && item.edited.length > 0 && (
              <div className="inline-flex items-center gap-2 mt-2 px-4 py-1 bg-amber-100 text-amber-700 text-xs rounded-2xl">
                <Edit2 className="w-3 h-3" /> Edited by Pikki ({item.edited.join(', ')})
              </div>
            )}
            {item.hidden && <div className="mt-2 text-xs text-zinc-500">This item is hidden from the guide list.</div>}
          </div>
          <div className="grid grid-cols-3 sm:flex gap-2 sm:gap-3 w-full sm:w-auto">
            <button type="button" onClick={() => setEntry({ owned: info.owned > 0 ? 0 : 1 })} aria-pressed={info.owned > 0}
              className={`w-full sm:w-[118px] px-2 sm:px-4 py-2 whitespace-nowrap border rounded-2xl text-[13px] sm:text-sm inline-flex items-center justify-center gap-2 tabular-nums ${info.owned > 0 ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950' : 'border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
              Owned: <span className="font-mono font-bold">{info.owned}</span>
            </button>
            <button type="button" onClick={() => setEntry({ wanted: !wanted })} aria-pressed={wanted} disabled={info.owned > 0}
              title={info.owned > 0 ? 'Already owned' : 'Add to wishlist'}
              className={`w-full sm:w-[118px] px-2 sm:px-4 py-2 whitespace-nowrap border rounded-2xl text-[13px] sm:text-sm font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-40 ${wanted ? 'bg-violet-100 border-violet-300 text-violet-800 dark:bg-violet-950 dark:text-violet-200 dark:border-violet-700' : 'border-zinc-300 dark:border-zinc-600 enabled:hover:bg-zinc-50 dark:enabled:hover:bg-zinc-800'}`}>
              <Star className={`w-4 h-4 ${wanted ? 'fill-current' : ''}`} aria-hidden /> {wanted ? 'Wanted' : 'Want'}
            </button>
            <button type="button" onClick={() => setEntry({ done: !info.done })} aria-pressed={info.done}
              className={`w-full sm:w-[118px] px-2 sm:px-4 py-2 whitespace-nowrap rounded-2xl text-[13px] sm:text-sm font-medium border ${info.done ? 'bg-emerald-700 border-emerald-700 text-white' : 'border-zinc-300 dark:border-zinc-600'}`}>
              {info.done ? '✓ Done' : 'Mark done'}
            </button>
          </div>
        </div>

        {item.cannot_decompose && (
          <div className="mb-6 px-4 py-3 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 rounded-2xl text-sm font-medium">Cannot decompose</div>
        )}
        {item.fut === 1 && (
          <div className="mb-6 px-4 py-3 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-2xl text-sm">Some future recipes may be missing for this item.</div>
        )}

        {item.comment && (
          <div className="mb-10 bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-400 p-6 rounded-r-2xl">
            <div className="uppercase text-amber-500 text-xs tracking-widest mb-2">EDITORIAL NOTE</div>
            <p className="text-lg leading-relaxed text-amber-800 dark:text-amber-200">{item.comment}</p>
          </div>
        )}

        {item.o && (
          <div className="mb-8">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">OBTAINED FROM</div>
            <div className="text-zinc-600">{item.o}</div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Required', v: item.rd, f: 'rd', hint: 'Recipes + evolutions (direct)', main: true },
            { label: 'Incl. recolours', v: item.rdc ?? item.rd, f: 'rdc', hint: 'Each recolour uses one base copy' },
            { label: 'Full tree', v: item.rr, f: 'rr', hint: 'Recursive, whole crafting tree' },
            { label: 'Tree + recolours', v: item.rrc, f: 'rrc', hint: 'Recursive incl. recolours' },
          ].map(x => (
            <div key={x.f} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800" title={x.hint}>
              <div className="text-[11px] uppercase tracking-widest text-zinc-500">{x.label}{item.edited?.includes(x.f) && <span className="text-amber-600"> · edited</span>}</div>
              <div className={`tabular-nums ${x.main ? 'text-4xl text-amber-500 font-light' : 'text-2xl text-zinc-700 dark:text-zinc-200'}`}>{x.v ?? '—'}</div>
              <div className="text-[11px] text-zinc-400 mt-1">{x.hint}</div>
            </div>
          ))}
        </div>

        {(item.u && item.u.length > 0) || evTo.length > 0 ? (
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div className="text-lg font-semibold">Used to craft</div>
              <div className="text-xs bg-rose-100 text-rose-700 px-3 py-1 rounded-full">Critical for decompose decisions</div>
            </div>
            <div className="text-sm text-zinc-500 mb-4">
              Waiting on <b>{info.waiting}</b> unowned item{info.waiting === 1 ? '' : 's'}
              {heldBy.length > 0 && <> · Held back by: {heldBy.join(', ')}</>}
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {[...(item.u || []).map(c => ({ id: c.id, q: c.q, name: c.name, evo: false })),
                ...evTo.filter(e => !usedIds.has(e.id)).map(e => ({ id: e.id, q: e.num ?? 1, name: byId(e.id)?.name, evo: true }))].map((craft, idx) => {
                const target = byId(craft.id);
                const owned = (wardrobe[craft.id]?.owned || 0) > 0;
                return (
                  <Link key={idx} to={target ? itemPath(target) : `/item/${craft.id}`}
                    className="p-4 bg-zinc-50 hover:bg-amber-50 dark:bg-zinc-800 rounded-2xl flex justify-between items-center gap-3 border border-transparent hover:border-amber-200">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{craft.name || target?.name || `Item #${craft.id}`}</div>
                      <div className="text-xs text-zinc-500">{target ? `${target.cat} #${target.n}` : ''}{craft.evo ? ' · evolution' : ''}{owned ? ' · owned' : ''}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-zinc-500">Need</div>
                      <div className="font-mono text-xl font-semibold text-rose-500">×{craft.q}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
            {item.used_to_craft_note && <p className="mt-4 text-sm text-zinc-500 italic">{item.used_to_craft_note}</p>}
          </div>
        ) : (
          <div className="mb-10 text-sm text-zinc-500">Not used to craft anything in the current data.</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {(item.cf?.length || evFrom.length) ? (
            <div>
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-4">MADE FROM</div>
              <div className="space-y-2">
                {[...(item.cf || []).map(c => ({ id: c.id, q: c.q })), ...evFrom.map(e => ({ id: e.id, q: e.num ?? 1 }))].map((c, i) => {
                  const src = byId(c.id);
                  return (
                    <Link key={i} to={src ? itemPath(src) : `/item/${c.id}`} className="flex justify-between p-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-amber-50 rounded-2xl text-sm">
                      <span>{src?.name || `Item #${c.id}`}</span><span className="font-mono text-zinc-500">×{c.q}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          {item.d && item.d.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-4">CUSTOMISATIONS / DYES</div>
              <div className="space-y-2">
                {item.d.map((dye, i) => {
                  const t = dye.id ? byId(dye.id) : undefined;
                  const body = <>{dye.name || dye.n || 'Recolour'}{t && <span className="text-xs text-zinc-500 ml-2">{t.cat} #{t.n}</span>}</>;
                  return t
                    ? <Link key={i} to={itemPath(t)} className="block p-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-amber-50 rounded-2xl text-sm">{body}</Link>
                    : <div key={i} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl text-sm">{body}</div>;
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </Router>
  );
}

function AppShell() {
  const [items, setItems] = useState<Item[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const { ready, user, profile, openAuth } = useAuth();
  const { wardrobe, setWardrobe, sync, offerMerge, localCount, mergeLocal, dismissMerge } = useWardrobe(user, ready);
  const { collections, save: saveCollection, update: updateCollection, remove: removeCollection } = useCollections(user?.id ?? null, ready);

  const loadData = async (retryCount = 0) => {
    setLoading(true);

    try {
      // No custom headers: they trigger a CORS preflight that raw.githubusercontent.com rejects.
      let response: Response | null = null;
      try {
        response = await fetch(DATA_URL, { cache: 'no-store' });
      } catch (e) {
        console.warn('Primary URL failed, trying fallback...', e);
      }
      if ((!response || !response.ok) && retryCount === 0) {
        response = await fetch(FALLBACK_URL, { cache: 'no-store' });
      }
      if (!response) throw new Error('No response');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.items && Array.isArray(data.items)) {
        setItems(data.items);
        setMeta(data.meta || data);
        console.log(`Loaded ${data.items.length} items from Pikki's Info data`);
      } else {
        throw new Error('Invalid data format');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Data load error:', message);
      
      if (retryCount === 0) {
        // Try fallback once
        return loadData(1);
      }
      
      console.error('Both data sources failed:', message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateWardrobe = useCallback((newWardrobe: WardrobeData) => {
    setWardrobe(newWardrobe);
  }, [setWardrobe]);

  const myCount = useMemo(() => Object.values(wardrobe).filter(e => e.owned > 0 || e.wanted).length, [wardrobe]);
  const badge = myCount > 9999 ? '9k+' : myCount.toLocaleString();
  const s = profile?.settings;
  const defaults = useMemo(() => ({ sort: s?.sort, dir: s?.dir, size: s?.size }), [s?.sort, s?.dir, s?.size]);

  return (
      <div className="min-h-screen flex flex-col text-zinc-900 dark:text-zinc-100">
        {/* Top Navigation */}
        <header className="sticky top-0 z-50 bg-white/85 dark:bg-zinc-900/85 border-b border-zinc-200/70 dark:border-zinc-800 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-[64px] sm:h-[72px] flex items-center justify-between gap-2 sm:gap-3">
            <Link to="/" className="min-w-0 shrink" aria-label="Pikki's Info home">
              <PikkiMonogram />
            </Link>
            
            <nav className="flex items-center gap-2 sm:gap-5 text-sm shrink-0" aria-label="Main">
              <NavLink to="/" end className={({ isActive }) => `font-semibold hidden md:inline hover:text-amber-700 dark:hover:text-amber-300 ${isActive ? 'text-amber-700 dark:text-amber-300' : ''}`}>Decompose Guide</NavLink>
              <NavLink to="/my-wardrobe" aria-label={`My Wardrobe, ${myCount} items`}
                className={({ isActive }) => `inline-flex items-center gap-2 h-10 rounded-full border font-semibold px-2.5 md:px-3.5 ${isActive
                  ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-200'
                  : 'border-zinc-200 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/70 hover:border-amber-300'}`}>
                <Shirt className="w-4 h-4 shrink-0" aria-hidden />
                <span className="hidden md:inline whitespace-nowrap">My Wardrobe</span>
                <span className="min-w-[2.25rem] h-6 px-1.5 rounded-full bg-amber-600 text-white text-xs font-bold tabular-nums grid place-items-center" aria-hidden>{badge}</span>
              </NavLink>
              <NavLink to="/about" className={({ isActive }) => `hidden lg:inline hover:text-amber-700 dark:hover:text-amber-300 ${isActive ? 'text-amber-700 dark:text-amber-300 font-semibold' : ''}`}>About</NavLink>
              <UserMenu />
            </nav>
          </div>
        </header>

        {offerMerge && (
          <div role="status" className="fixed z-[60] bottom-3 inset-x-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-md bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 rounded-2xl shadow-lg">
            <div className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="mr-auto text-violet-900 dark:text-violet-100">You marked <b>{localCount.toLocaleString()}</b> item{localCount === 1 ? '' : 's'} in this browser before signing in. Add them to your account?</span>
              <button type="button" onClick={mergeLocal} className="h-9 px-4 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-semibold">Merge into account</button>
              <button type="button" onClick={dismissMerge} className="h-9 px-3 rounded-xl text-violet-900 dark:text-violet-100 hover:bg-violet-100 dark:hover:bg-violet-900">Not now</button>
            </div>
          </div>
        )}

        <main className="flex-1 min-h-[calc(100vh-64px)]">
          <Routes>
            <Route path="/" element={
              <DecomposeGuide 
                items={items} 
                meta={meta} 
                wardrobe={wardrobe} 
                setWardrobe={updateWardrobe}
                loading={loading} 
                defaults={defaults}
                signedIn={!!user}
                sync={sync}
                collections={collections}
                onSaveView={saveCollection}
                onOpenAuth={() => openAuth('signin')}
              />
            } />
            <Route path="/wardrobe/:cat/:n" element={
              <ItemPage items={items} wardrobe={wardrobe} setWardrobe={updateWardrobe} loading={loading} />
            } />
            <Route path="/item/:id" element={
              <ItemPage items={items} wardrobe={wardrobe} setWardrobe={updateWardrobe} loading={loading} />
            } />
            <Route path="/my-wardrobe" element={
              <MyWardrobePage items={items} meta={meta} wardrobe={wardrobe} setWardrobe={updateWardrobe} loading={loading}
                defaults={defaults} sync={sync} collections={collections} onSaveView={saveCollection} onDeleteView={removeCollection} />
            } />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/account" element={
              <AccountPage wardrobe={wardrobe} itemCount={items.length} collections={collections}
                onUpdateCollection={updateCollection} onDeleteCollection={removeCollection} />
            } />
            <Route path="/u/:username" element={<ProfilePage items={items} />} />
            <Route path="*" element={
              <div className="max-w-2xl mx-auto p-8 text-center">
                <h1 className="font-display text-3xl mb-3">Page not found</h1>
                <Link to="/" className="text-amber-700 dark:text-amber-300 hover:underline">Back to the Decompose Guide</Link>
              </div>
            } />
          </Routes>
        </main>

        <footer className="bg-zinc-900 text-zinc-300 py-10 border-t border-zinc-800 mt-20">
          <div className="max-w-7xl mx-auto px-6 text-center text-xs leading-relaxed">
            <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold mb-6">
              <Link to="/" className="hover:text-amber-200">Decompose Guide</Link>
              <Link to="/my-wardrobe" className="hover:text-amber-200">My Wardrobe</Link>
              <Link to="/about" className="hover:text-amber-200">About</Link>
              <Link to="/contact" className="hover:text-amber-200">Contact</Link>
              <a href="https://github.com/creamlace" target="_blank" rel="noreferrer" className="hover:text-amber-200">GitHub</a>
            </nav>
            <p>Unofficial, non-commercial fan site for <span className="text-amber-200">Love Nikki: Dress Up Queen</span>. Love Nikki and its characters, items and art belong to Elex / Papergames. Not affiliated or endorsed.</p>
            <p className="mt-2">Item data from <span className="text-amber-200">Nikki Calc</span> and the community · corrections reviewed by hand · refreshed weekly.</p>
            <p className="mt-5 text-zinc-400">© 2026 Pikki's Info · Vernon, BC, Canada · Code MIT · Original content CC BY-NC 4.0</p>
          </div>
        </footer>
        <AuthDialog />
      </div>
  );
}

export default App;
