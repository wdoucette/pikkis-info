import { useState, useEffect, useMemo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams } from 'react-router-dom';
import { Edit2, ArrowLeft } from 'lucide-react';

const DATA_URL = 'https://raw.githubusercontent.com/wdoucette/pikkis-info-data/main/data/pikkis-info.min.json';
const FALLBACK_URL = 'https://cdn.jsdelivr.net/gh/wdoucette/pikkis-info-data@main/data/pikkis-info.min.json';

import type { Item, Meta, WardrobeData } from './types';
import DecomposeGuide, { StatusBadge, Hearts, itemPath } from './DecomposeGuide';
import { deriveInfo } from './guide/status';

const PikkiMonogram = () => (
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-white font-bold text-3xl shadow-inner border-2 border-amber-300">
      P
    </div>
    <div>
      <div className="text-2xl sm:text-3xl font-bold tracking-tighter text-amber-950 dark:text-amber-100 whitespace-nowrap">Pikki's Info</div>
      <div className="text-[10px] text-amber-600 -mt-1 font-mono">DECOMPOSE GUIDE</div>
    </div>
  </div>
);

const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
    <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin"></div>
    <div className="text-amber-600 font-medium">Loading Pikki's wardrobe data...</div>
    <div className="text-xs text-zinc-500 max-w-[240px] text-center">34,000+ items • This may take a moment on first visit</div>
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
    try { const s = sessionStorage.getItem('pikkis-guide-search'); return s ? `/?${s}` : '/'; } catch { return '/'; }
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
  const setEntry = (patch: Partial<{ owned: number; done: boolean }>) =>
    setWardrobe({ ...wardrobe, [item.id]: { ...(wardrobe[item.id] ?? { owned: 0, done: false }), ...patch } });
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
        <ArrowLeft className="w-4 h-4" /> Back to Guide
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
          <div className="flex gap-3">
            <button type="button" onClick={() => setEntry({ owned: info.owned > 0 ? 0 : 1 })} aria-pressed={info.owned > 0}
              className={`px-5 py-2 border rounded-2xl text-sm flex items-center gap-2 ${info.owned > 0 ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
              Owned: <span className="font-mono font-bold">{info.owned}</span>
            </button>
            <button type="button" onClick={() => setEntry({ done: !info.done })} aria-pressed={info.done}
              className={`px-6 py-2 rounded-2xl text-sm font-medium ${info.done ? 'bg-emerald-600 text-white' : 'border'}`}>
              {info.done ? '✓ Done' : 'Mark Done'}
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
  const [items, setItems] = useState<Item[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [wardrobe, setWardrobe] = useState<WardrobeData>(() => {
    const saved = localStorage.getItem('pikkis-wardrobe');
    return saved ? JSON.parse(saved) : {};
  });

  // Persist wardrobe
  useEffect(() => {
    localStorage.setItem('pikkis-wardrobe', JSON.stringify(wardrobe));
  }, [wardrobe]);

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
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        {/* Top Navigation */}
        <header className="sticky top-0 z-50 bg-white/90 dark:bg-zinc-900/90 border-b border-zinc-100 dark:border-zinc-800 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-5 flex items-center justify-between gap-3">
            <Link to="/">
              <PikkiMonogram />
            </Link>
            
            <div className="flex items-center gap-4 sm:gap-8 text-xs sm:text-sm">
              <Link to="/" className="hover:text-amber-600 font-medium hidden sm:inline">Decompose Guide</Link>
              <a href="https://github.com/wdoucette/pikkis-info" target="_blank" className="hover:text-amber-600">GitHub</a>
              <a href="#about" className="text-zinc-400 hover:text-zinc-600">About</a>
            </div>
            
            <div className="hidden md:flex items-center gap-2 text-xs font-mono text-zinc-400">
              FAN RECONSTRUCTION
            </div>
          </div>
        </header>

        <main>
          <Routes>
            <Route path="/" element={
              <DecomposeGuide 
                items={items} 
                meta={meta} 
                wardrobe={wardrobe} 
                setWardrobe={updateWardrobe}
                loading={loading} 
              />
            } />
            <Route path="/wardrobe/:cat/:n" element={
              <ItemPage items={items} wardrobe={wardrobe} setWardrobe={updateWardrobe} loading={loading} />
            } />
            <Route path="/item/:id" element={
              <ItemPage items={items} wardrobe={wardrobe} setWardrobe={updateWardrobe} loading={loading} />
            } />
          </Routes>
        </main>

        <footer className="bg-zinc-900 text-zinc-400 py-12 border-t border-zinc-800 mt-20">
          <div className="max-w-7xl mx-auto px-6 text-center text-xs leading-relaxed">
            <p>Fan-made decompose guide for <span className="text-amber-300">Love Nikki: Dress Up Queen</span>. Not affiliated with Elex, Paper Games, Nikki Calc, or the original Nikki's Info.</p>
            <p className="mt-3">Item data from <span className="text-amber-400">Nikki Calc (nikkicalc.com)</span>. Editorial comments and corrections from the Pikki's Info Overrides sheet.</p>
            <p className="mt-6 text-[10px] opacity-60">© Pikki's Info • Built with Grok Build • Data updates weekly via GitHub Actions</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
