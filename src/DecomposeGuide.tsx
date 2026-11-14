import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Heart, CheckCircle, AlertTriangle, Info, Download, Upload, X, ChevronUp, ChevronDown,
  ChevronsUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, HelpCircle, Trash2,
  Star, BookmarkPlus, FolderOpen, Layers, Cloud, CloudOff, HardDrive,
} from 'lucide-react';
import type { Collection } from './lib/supabase';
import type { SyncState } from './wardrobe/useWardrobe';
import { filterStateFrom, collectionHref } from './wardrobe/useCollections';
import { format } from 'date-fns';
import { findGroup, groupSlug, type CategoryGroup } from './guide/groups';
import { useGroups } from './wardrobe/CategoryGroupsContext';
import OwnedInput, { clampOwned } from './wardrobe/OwnedInput';
import CategoryGroupsDialog from './wardrobe/CategoryGroupsDialog';
import type { Item, Meta, WardrobeData } from './types';
import { deriveInfo, STATUSES, statusLabel, statusText, type DerivedInfo } from './guide/status';
import { buildIndex, parseQuery, structuredFilter, textSearch, type SearchIndex } from './guide/search';
import { toCSV, downloadText } from './guide/csv';
import { wardrobeFromCSV, describeImport } from './guide/wardrobeCsv';

/** Column definitions shown as header tooltips and in the search help panel. */
export const COLUMN_HELP: Record<string, string> = {
  Item: 'The clothing item\'s name. A small "edited" tag means Pikki corrected Nikki Calc\'s data, and "fut" means some future recipes may be missing.',
  Cat: 'The wardrobe category, like Hair, Dress, Coat or Shoes.',
  'No.': 'The item\'s number within that category in the game\'s wardrobe.',
  Hearts: 'The rarity, from 1 to 6 hearts.',
  Status: 'Worked out from what you own. It checks four things in order and shows the first that applies:\nCannot decompose: the game won\'t let you break it down.\nNot owned: you don\'t have it.\nUsed to craft: X items: you own it, but X items it crafts or evolves into aren\'t owned yet, so keep it.\nExtra clothes: you own it and everything it feeds into, so it\'s safe to decompose.',
  'Req.': 'How many copies you need for direct uses: recipes that use this item, plus evolving it into something else.',
  '+Dyes': 'The same count plus recolours, because each recolour uses up one copy of the base item.',
  Tree: 'How many copies the whole crafting chain needs, counting the items made from it and the items made from those, all the way down.',
  Used: 'How many different items this one is used to craft or evolve into. Hover over the number to list them.',
  Owned: 'How many you own (0 to 9999). Type a number or use − and +.',
  Want: 'Adds it to your wishlist. It only matters while you don\'t own the item.',
  Done: 'Your own checkmark for an item you\'ve finished with, such as already decomposed or all its crafting done.',
};

export const itemPath = (item: Item) => `/wardrobe/${encodeURIComponent(item.cat.toLowerCase())}/${item.n}`;

const PAGE_SIZES = [25, 50, 100, 250];
const BASE_SIZE = 50;
const FILTER_STATUSES = ['All', ...STATUSES, 'Left to do', 'Owned', 'Wanted'];

type SortKey = 'relevance' | 'name' | 'cat' | 'n' | 'r' | 'status' | 'rd' | 'rdc' | 'rr' | 'used' | 'waiting' | 'owned' | 'done';
const SORT_KEYS: SortKey[] = ['relevance', 'name', 'cat', 'n', 'r', 'status', 'rd', 'rdc', 'rr', 'used', 'waiting', 'owned', 'done'];
/** Columns that are most useful largest-first when first clicked. */
const DESC_FIRST = new Set<SortKey>(['r', 'rd', 'rdc', 'rr', 'used', 'waiting', 'owned', 'done']);
const STATUS_ORDER: Record<string, number> = { 'Still needed': 0, 'Extra clothes': 1, 'Not owned': 2, 'Cannot decompose': 3 };

export const StatusBadge = ({ status, waiting }: { status: string; waiting?: number }) => {
  const colors: Record<string, string> = {
    'Extra clothes': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    'Still needed': 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    'Cannot decompose': 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    'Not owned': 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  };
  const title = status === 'Still needed' && waiting ? `Keep it: ${waiting} item${waiting === 1 ? '' : 's'} it crafts or evolves into ${waiting === 1 ? 'is' : 'are'} not owned yet` : undefined;
  return (
    <span title={title} className={`inline-block whitespace-nowrap px-2.5 py-0.5 text-xs font-medium rounded-full ${colors[status] || 'bg-zinc-100 text-zinc-500'}`}>
      {statusText(status, waiting)}
    </span>
  );
};

export const Hearts = ({ r }: { r?: number }) => {
  if (!r) return <span className="text-zinc-300">—</span>;
  if (r > 6) {
    return (
      <span className="inline-flex items-center gap-1 text-rose-500 text-sm font-medium" title={`${r} hearts`} aria-label={`${r} hearts`}>
        <Heart className="w-4 h-4 fill-rose-500" />{r}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-px" title={`${r} hearts`} aria-label={`${r} hearts`}>
      {Array.from({ length: r }).map((_, i) => <Heart key={i} className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />)}
    </span>
  );
};

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const isEdited = (item: Item, field: string) => !!item.edited?.includes(field);

export interface GuideDefaults { sort?: string; dir?: 'asc' | 'desc'; size?: number }

export default function DecomposeGuide({ items, meta, wardrobe, setWardrobe, loading, defaults = {}, signedIn = false, sync = 'local', collections = [], onSaveView, mine = false }: {
  items: Item[];
  meta: Meta | null;
  wardrobe: WardrobeData;
  setWardrobe: (w: WardrobeData) => void;
  loading: boolean;
  defaults?: GuideDefaults;
  signedIn?: boolean;
  sync?: SyncState;
  collections?: Collection[];
  onSaveView?: (name: string, filterState: Record<string, string>) => Promise<unknown>;
  onOpenAuth?: () => void;
  /** "My Wardrobe" mode: only items with an Owned/Wanted/Done mark; no warning banner; exports only these. */
  mine?: boolean;
}) {
  const navigate = useNavigate();
  const DEFAULT_SIZE = defaults.size && PAGE_SIZES.includes(defaults.size) ? defaults.size : BASE_SIZE;
  const defaultSort: SortKey = defaults.sort && SORT_KEYS.includes(defaults.sort as SortKey) && defaults.sort !== 'relevance' ? defaults.sort as SortKey : 'cat';
  const [params, setParams] = useSearchParams();
  const urlQ = params.get('q') || '';
  const cat = params.get('cat') || 'All';
  const statusFilter = params.get('status') || 'All';
  const groupParam = params.get('group') || '';
  const { groups } = useGroups();
  const activeGroup = useMemo(() => (groupParam ? findGroup(groups, groupParam) : undefined), [groups, groupParam]);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const hasQuery = urlQ.trim() !== '';
  const rawSort = params.get('sort') as SortKey | null;
  const sort: SortKey = rawSort && SORT_KEYS.includes(rawSort) && (rawSort !== 'relevance' || hasQuery)
    ? rawSort : (hasQuery ? 'relevance' : defaultSort);
  const dir: 'asc' | 'desc' = params.get('dir') === 'desc' ? 'desc' : params.get('dir') === 'asc' ? 'asc'
    : (sort === 'relevance' ? 'desc' : !rawSort && !hasQuery && defaults.dir ? defaults.dir : 'asc');
  const sizeParam = parseInt(params.get('size') || '', 10);
  const size = PAGE_SIZES.includes(sizeParam) ? sizeParam : DEFAULT_SIZE;
  const pageParam = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);

  const [qInput, setQInput] = useState(urlQ);
  const debouncedQ = useDebounced(qInput, 200);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /** Update URL params. Any change other than page/size resets to page 1. */
  const update = useCallback((patch: Record<string, string | null>, keepPage = false) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k); else next.set(k, v);
      }
      if (!keepPage) next.delete('page');
      if (next.get('cat') === 'All') next.delete('cat');
      if (next.get('status') === 'All') next.delete('status');
      if (next.get('size') === String(DEFAULT_SIZE)) next.delete('size');
      if (next.get('page') === '1') next.delete('page');
      return next;
    }, { replace: true });
  }, [setParams, DEFAULT_SIZE]);

  // Push debounced search text into the URL.
  useEffect(() => {
    if (debouncedQ.trim() !== urlQ.trim()) {
      // Relevance becomes the default sort while searching; drop an explicit sort when the query is cleared.
      // Starting a new search switches to relevance order; clearing it drops a relevance sort.
      const starting = !urlQ.trim() && !!debouncedQ.trim();
      const clearing = !debouncedQ.trim() && rawSort === 'relevance';
      update({ q: debouncedQ.trim() || null, ...(starting || clearing ? { sort: null, dir: null } : {}) });
    }
  }, [debouncedQ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the box in sync if the URL changes elsewhere (e.g. back/forward, clear filters).
  const lastUrlQ = useRef(urlQ);
  useEffect(() => {
    if (urlQ !== lastUrlQ.current) {
      lastUrlQ.current = urlQ;
      if (urlQ.trim() !== qInput.trim()) setQInput(urlQ);
    }
  }, [urlQ]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remember guide filters so item pages can link back to them.
  useEffect(() => {
    try { sessionStorage.setItem('pikkis-guide-search', (mine ? 'mine:' : '') + params.toString()); } catch { /* ignore */ }
  }, [params, mine]);

  // "/" focuses search, Esc clears it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visibleItems = useMemo(() => (mine
    ? items.filter(i => { const e = wardrobe[i.id]; return !!e && (e.owned > 0 || !!e.done || !!e.wanted); })
    : items.filter(i => !i.hidden)), [items, mine, wardrobe]);
  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  const allCatNames = useMemo(() => Array.from(new Set(items.map(i => i.cat))).sort((a, b) => a.localeCompare(b)), [items]);
  // The group picker narrows everything below it to that group's categories.
  const scopedItems = useMemo(() => {
    if (!activeGroup) return visibleItems;
    const set = new Set(activeGroup.cats);
    return visibleItems.filter(i => set.has(i.cat));
  }, [visibleItems, activeGroup]);
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of scopedItems) counts.set(i.cat, (counts.get(i.cat) || 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [scopedItems]);
  const catNames = allCatNames;

  // Derived status per item (recomputed when the wardrobe changes).
  const infoMap = useMemo(() => {
    const m = new Map<number, DerivedInfo>();
    for (const it of visibleItems) m.set(it.id, deriveInfo(it, wardrobe));
    return m;
  }, [visibleItems, wardrobe]);
  const infoOf = useCallback((it: Item) => infoMap.get(it.id) || deriveInfo(it, wardrobe), [infoMap, wardrobe]);
  const isWanted = (id: number, inf: DerivedInfo) => !(inf.owned > 0) && !!wardrobe[id]?.wanted;

  // Search index is built once per dataset, lazily on first search.
  const indexRef = useRef<{ items: Item[]; index: SearchIndex } | null>(null);
  const getIndex = useCallback(() => {
    if (!indexRef.current || indexRef.current.items !== items) {
      const t0 = performance.now();
      indexRef.current = { items, index: buildIndex(items) };
      console.log(`Search index built for ${items.length} items in ${Math.round(performance.now() - t0)} ms`);
    }
    return indexRef.current.index;
  }, [items]);
  // Warm the index in idle time so the first keystroke is instant.
  useEffect(() => {
    if (!items.length) return;
    const ric: (cb: () => void) => number = (window as any).requestIdleCallback || ((cb: () => void) => window.setTimeout(cb, 300));
    const id = ric(() => getIndex());
    return () => {
      const cancel = (window as any).cancelIdleCallback || window.clearTimeout;
      cancel(id);
    };
  }, [items, getIndex]);

  const parsed = useMemo(() => parseQuery(urlQ), [urlQ]);
  const scores = useMemo(
    () => (parsed.text && items.length ? textSearch(getIndex(), byId, parsed.text) : null),
    [parsed.text, getIndex, byId],
  );

  const filtered = useMemo(() => {
    const sf = structuredFilter(parsed, infoOf, catNames, groups);
    return scopedItems.filter(it => {
      if (cat !== 'All' && it.cat !== cat) return false;
      if (statusFilter !== 'All') {
        const inf = infoOf(it);
        if (statusFilter === 'Left to do') { if (inf.done) return false; }
        else if (statusFilter === 'Owned') { if (!(inf.owned > 0)) return false; }
        else if (statusFilter === 'Wanted') { if (!isWanted(it.id, inf)) return false; }
        else if (inf.status !== statusFilter) return false;
      }
      if (scores && !scores.has(it.id)) return false;
      if (sf && !sf(it)) return false;
      return true;
    });
  }, [scopedItems, cat, statusFilter, scores, parsed, infoOf, catNames, groups, wardrobe]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() => {
    const val = (it: Item): number | string => {
      const inf = infoOf(it);
      switch (sort) {
        case 'relevance': return scores?.get(it.id) ?? 0;
        case 'name': return it.name.toLowerCase();
        case 'cat': return it.cat.toLowerCase();
        case 'n': return it.n;
        case 'r': return it.r ?? 0;
        case 'status': return STATUS_ORDER[inf.status] ?? 9;
        case 'rd': return it.rd ?? 0;
        case 'rdc': return it.rdc ?? it.rd ?? 0;
        case 'rr': return it.rr ?? 0;
        case 'used': return it.u?.length ?? 0;
        case 'waiting': return inf.waiting;
        case 'owned': return inf.owned;
        case 'done': return inf.done ? 1 : 0;
      }
    };
    const mul = dir === 'asc' ? 1 : -1;
    const keyed = filtered.map((it, idx) => ({ it, idx, v: val(it) }));
    keyed.sort((a, b) => {
      if (a.v < b.v) return -mul;
      if (a.v > b.v) return mul;
      // Stable, readable tie-break: category, wardrobe no., then original order.
      if (sort !== 'cat') { const c = a.it.cat.localeCompare(b.it.cat); if (c) return c; }
      if (a.it.n !== b.it.n) return a.it.n - b.it.n;
      return a.idx - b.idx;
    });
    return keyed.map(k => k.it);
  }, [filtered, sort, dir, scores, infoOf]);

  const total = sorted.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(pageParam, pages);
  const start = (page - 1) * size;
  const pageItems = sorted.slice(start, start + size);

  const setSort = (key: SortKey) => {
    if (key === sort) update({ sort: key, dir: dir === 'asc' ? 'desc' : 'asc' });
    else update({ sort: key, dir: DESC_FIRST.has(key) || key === 'relevance' ? 'desc' : 'asc' });
  };
  const goPage = (p: number) => {
    update({ page: String(Math.min(Math.max(1, p), pages)) }, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const anyFilter = hasQuery || !!groupParam || cat !== 'All' || statusFilter !== 'All' || params.has('sort');
  const clearFilters = () => {
    setQInput('');
    setParams(prev => {
      const next = new URLSearchParams();
      const s = prev.get('size');
      if (s) next.set('size', s);
      return next;
    }, { replace: true });
  };

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { All: 0, 'Left to do': 0, Owned: 0, Wanted: 0 };
    for (const it of scopedItems) {
      if (cat !== 'All' && it.cat !== cat) continue;
      const inf = infoOf(it);
      c.All++;
      c[inf.status] = (c[inf.status] || 0) + 1;
      if (!inf.done) c['Left to do']++;
      if (inf.owned > 0) c.Owned++;
      else if (wardrobe[it.id]?.wanted) c.Wanted++;
    }
    return c;
  }, [scopedItems, cat, infoOf, wardrobe]);

  // Whole-wardrobe progress (all categories).
  const progress = useMemo(() => {
    let owned = 0, wanted = 0, done = 0;
    for (const e of Object.values(wardrobe)) {
      if (e.owned > 0) owned++; else if (e.wanted) wanted++;
      if (e.done) done++;
    }
    return { owned, wanted, done };
  }, [wardrobe]);

  const setOwned = (itemId: number, n: number) => {
    const cur = wardrobe[itemId] ?? { owned: 0, done: false };
    const owned = clampOwned(n);
    const next = { owned, done: !!cur.done, ...(owned === 0 && cur.wanted ? { wanted: true } : {}) };
    setWardrobe({ ...wardrobe, [itemId]: next });
  };
  const toggleWanted = (itemId: number) => {
    const cur = wardrobe[itemId] ?? { owned: 0, done: false };
    setWardrobe({ ...wardrobe, [itemId]: { ...cur, wanted: !cur.wanted } });
  };
  const [saving, setSaving] = useState(false);
  const saveView = async () => {
    const suggested = [urlQ && `“${urlQ}”`, activeGroup?.name, cat !== 'All' && cat, statusFilter !== 'All' && statusLabel(statusFilter)].filter(Boolean).join(' · ') || 'My view';
    const name = window.prompt('Name this collection', suggested);
    if (!name?.trim() || !onSaveView) return;
    setSaving(true);
    try { await onSaveView(name, filterStateFrom(params)); setNotice(signedIn ? `Saved view “${name.trim()}”. Find it in Collections or on My Wardrobe.` : `Saved view “${name.trim()}” in this browser. Sign in to keep it in your account.`); }
    catch (e) { setNotice(`Could not save: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setSaving(false); }
  };
  const toggleDone = (itemId: number, currentDone: boolean) => {
    setWardrobe({ ...wardrobe, [itemId]: { ...(wardrobe[itemId] ?? { owned: 0, done: false }), done: !currentDone } });
  };

  const exportCSV = () => {
    const rows: (string | number)[][] = [['Item', 'Category', 'No.', 'Owned', 'Wanted', 'Done', 'Status', 'Waiting on', 'Required', 'Incl. recolours']];
    for (const item of mine ? visibleItems : items) {
      const inf = deriveInfo(item, wardrobe);
      const wanted = !(inf.owned > 0) && !!wardrobe[item.id]?.wanted;
      rows.push([item.name, item.cat, item.n, inf.owned, wanted ? 'Yes' : 'No', inf.done ? 'Yes' : 'No', statusLabel(inf.status), inf.waiting, item.rd, item.rdc ?? item.rd]);
    }
    downloadText(mine ? 'my-pikki-wardrobe.csv' : 'pikkis-wardrobe.csv', toCSV(rows));
  };

  const importCSV = async (file: File) => {
    const r = wardrobeFromCSV(await file.text(), items, wardrobe);
    if (r.error) { setNotice(`Import: ${r.error}`); return; }
    setWardrobe(r.next);
    setNotice(`Imported ${describeImport(r)}.`);
  };

  const clearWardrobe = () => {
    const where = signedIn ? 'saved to your account' : 'stored in this browser';
    if (window.confirm(`Clear all Owned, Wanted and Done marks ${where}? Export a CSV first if you want a backup.`)) {
      setWardrobe({});
      setNotice(signedIn ? 'Account wardrobe cleared.' : 'Local wardrobe cleared.');
    }
  };

  const SortHeader = ({ k, label, className = '', title = COLUMN_HELP[label] }: { k: SortKey; label: string; className?: string; title?: string }) => {
    const active = sort === k;
    const Icon = !active ? ChevronsUpDown : dir === 'asc' ? ChevronUp : ChevronDown;
    return (
      <th scope="col" className={`px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide ${active ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-500'} ${className}`}
        aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" onClick={() => setSort(k)} title={title ? `${title}\n\n(Click to sort)` : 'Click to sort'}
          className="inline-flex items-center gap-1 hover:text-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded">
          {label}<Icon className={`w-3.5 h-3.5 ${active ? '' : 'opacity-40'}`} aria-hidden />
        </button>
      </th>
    );
  };

  const Pager = ({ where }: { where: string }) => (
    <nav aria-label={`Pagination ${where}`} className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="text-zinc-500" data-testid={where === 'top' ? 'result-count' : undefined}>
        {loading ? 'Loading 34,000+ items…' : total === 0 ? 'No matching items' : <>Showing <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{(start + 1).toLocaleString()}–{Math.min(start + size, total).toLocaleString()}</span> of <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{total.toLocaleString()}</span> matching{total !== visibleItems.length && <> ({visibleItems.length.toLocaleString()} total)</>}</>}
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-zinc-500">
          <span className="hidden sm:inline">Per page</span>
          <select aria-label="Items per page" value={size} onChange={e => update({ size: e.target.value })}
            className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm">
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-1">
          {[
            { icon: ChevronsLeft, to: 1, label: 'First page', dis: page <= 1 },
            { icon: ChevronLeft, to: page - 1, label: 'Previous page', dis: page <= 1 },
          ].map(b => (
            <button key={b.label} type="button" aria-label={b.label} title={b.label} disabled={b.dis} onClick={() => goPage(b.to)}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-30 hover:border-amber-400 enabled:hover:text-amber-600">
              <b.icon className="w-4 h-4" />
            </button>
          ))}
          <span className="px-2 whitespace-nowrap text-zinc-600 dark:text-zinc-300">Page <span className="font-mono">{page.toLocaleString()}</span> of <span className="font-mono">{pages.toLocaleString()}</span></span>
          {[
            { icon: ChevronRight, to: page + 1, label: 'Next page', dis: page >= pages },
            { icon: ChevronsRight, to: pages, label: 'Last page', dis: page >= pages },
          ].map(b => (
            <button key={b.label} type="button" aria-label={b.label} title={b.label} disabled={b.dis} onClick={() => goPage(b.to)}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 disabled:opacity-30 hover:border-amber-400 enabled:hover:text-amber-600">
              <b.icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>
    </nav>
  );

  const DoneBtn = ({ item, inf }: { item: Item; inf: DerivedInfo }) => (
    <button type="button" onClick={() => toggleDone(item.id, inf.done)} aria-pressed={inf.done}
      aria-label={`${item.name}: ${inf.done ? 'done' : 'not done'}. Toggle done`} title="Toggle done"
      className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-lg border transition-colors ${inf.done
        ? 'bg-emerald-500 border-emerald-500 text-white'
        : 'border-zinc-300 dark:border-zinc-600 hover:border-emerald-400'}`}>
      <CheckCircle className={`w-4 h-4 ${inf.done ? '' : 'invisible'}`} aria-hidden />
    </button>
  );
  const WantedBtn = ({ item, inf }: { item: Item; inf: DerivedInfo }) => {
    const on = isWanted(item.id, inf);
    return (
      <button type="button" onClick={() => toggleWanted(item.id)} aria-pressed={on} disabled={inf.owned > 0}
        aria-label={`${item.name}: ${on ? 'on wishlist' : 'not wanted'}. Toggle wanted`} title={inf.owned > 0 ? 'Already owned' : 'Toggle wishlist'}
        className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center border transition-colors disabled:opacity-30 ${on
          ? 'bg-violet-100 border-violet-300 text-violet-700 dark:bg-violet-900 dark:border-violet-600 dark:text-violet-200'
          : 'border-zinc-300 dark:border-zinc-600 text-zinc-400 enabled:hover:border-violet-400 enabled:hover:text-violet-600'}`}>
        <Star className={`w-4 h-4 ${on ? 'fill-current' : ''}`} aria-hidden />
      </button>
    );
  };
  const Num = ({ item, field, value }: { item: Item; field: string; value: number | undefined }) => (
    <span className={isEdited(item, field) ? 'text-amber-600 font-semibold' : ''} title={isEdited(item, field) ? 'Edited by Pikki' : undefined}>
      {value ?? '—'}{isEdited(item, field) && <sup aria-label="edited">*</sup>}
    </span>
  );
  const NameCell = ({ item }: { item: Item }) => (
    <div className="min-w-0">
      <Link to={itemPath(item)} className="font-medium hover:text-amber-600 dark:hover:text-amber-400 hover:underline inline-flex items-center gap-1.5 flex-wrap">
        {item.name}
        {!!item.edited?.length && <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200 px-1.5 py-px rounded font-mono" title={`Edited: ${item.edited.join(', ')}`}>edited</span>}
        {item.comment && <Info className="w-3.5 h-3.5 text-amber-500" aria-label="Has comment" />}
        {item.fut === 1 && <span className="text-[10px] text-zinc-400 font-mono" title="Some future recipes may be missing">fut</span>}
      </Link>
      {item.comment && <div className="text-xs text-zinc-500 line-clamp-1 max-w-md" title={item.comment}>{item.comment}</div>}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4">
      {/* Warning Banner */}
      {!mine && <div className="mb-6 bg-amber-50 dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 rounded-3xl p-5 text-sm">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" aria-hidden />
          <div>
            <div className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Do not decompose items you still need</div>
            <p className="text-amber-700 dark:text-amber-400 leading-relaxed">
              Check the <span className="font-medium">"Used to craft"</span> and <span className="font-medium">"Required"</span> columns before selling or decomposing.
              Required counts recipes + evolutions; recolours are shown separately. Always verify with your in-game wardrobe.
            </p>
          </div>
        </div>
      </div>}

      {/* Toolbar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-3xl p-4 shadow-sm mb-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <label htmlFor="guide-search" className="sr-only">Search items</label>
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input
              id="guide-search"
              ref={searchRef}
              type="search"
              value={qInput}
              onChange={e => setQInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setQInput(''); } if (e.key === 'Enter') update({ q: qInput.trim() || null }); }}
              placeholder='Search name, category, No., comment, used-to-craft…  e.g. "sandals cat:shoes hearts:>=4"'
              className="w-full pl-11 pr-20 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900 text-sm"
              autoComplete="off" spellCheck={false}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {qInput && (
                <button type="button" aria-label="Clear search" onClick={() => { setQInput(''); update({ q: null }); searchRef.current?.focus(); }}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-700"><X className="w-4 h-4" /></button>
              )}
              <kbd className="hidden sm:inline-block text-[10px] font-mono text-zinc-400 border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-0.5" title="Press / to search">/</kbd>
            </div>
          </div>
          <label className="flex items-center">
            <span className="sr-only">Status filter</span>
            <select value={statusFilter} onChange={e => update({ status: e.target.value })}
              className="w-full lg:w-60 h-[46px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 text-sm focus:outline-none focus:border-amber-400">
              {FILTER_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}{loading ? '' : statusCounts[s] !== undefined ? ` (${statusCounts[s].toLocaleString()})` : ' (0)'}</option>)}
            </select>
          </label>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={exportCSV} title="Export Owned, Wanted and Done as CSV"
              className="p-btn bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 hover:border-amber-300 text-zinc-700 dark:text-zinc-300 text-sm">
              <Download className="w-4 h-4" aria-hidden /> Export
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} title="Import (merge) a CSV with Item, Category, No., Owned, Wanted, Done"
              className="p-btn bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 hover:border-amber-300 text-zinc-700 dark:text-zinc-300 text-sm">
              <Upload className="w-4 h-4" aria-hidden /> Import
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" aria-label="Import wardrobe CSV"
              onChange={e => { const f = e.target.files?.[0]; if (f) importCSV(f); e.target.value = ''; }} />
            <button type="button" onClick={clearWardrobe} title="Clear local wardrobe" aria-label="Clear local wardrobe"
              className="p-btn bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 hover:border-red-300 text-zinc-500 text-sm px-3">
              <Trash2 className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
          <button type="button" onClick={() => setShowHelp(s => !s)} aria-expanded={showHelp} className="inline-flex items-center gap-1 hover:text-amber-600">
            <HelpCircle className="w-3.5 h-3.5" aria-hidden /> Search tips &amp; column guide
          </button>
          {anyFilter && (
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 hover:underline">
              <X className="w-3.5 h-3.5" aria-hidden /> Clear filters
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 min-h-9 pt-1 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-300 mr-auto tabular-nums" aria-label="Wardrobe progress">
            <span title={sync === 'local' ? 'Saved in this browser only' : sync === 'error' ? 'Not saved yet, retrying' : 'Saved to your account'}
              className="inline-flex items-center gap-1 min-w-[96px] whitespace-nowrap">
              {sync === 'local' ? <HardDrive className="w-3.5 h-3.5" aria-hidden /> : sync === 'error' ? <CloudOff className="w-3.5 h-3.5 text-red-600" aria-hidden /> : <Cloud className="w-3.5 h-3.5 text-violet-600 dark:text-violet-300" aria-hidden />}
              {sync === 'local' ? 'This browser' : sync === 'loading' ? 'Loading…' : sync === 'saving' ? 'Saving…' : sync === 'error' ? 'Retrying…' : 'Synced'}
            </span>
            <span><b className="text-emerald-700 dark:text-emerald-300">{progress.owned.toLocaleString()}</b> owned</span>
            <span><b className="text-violet-700 dark:text-violet-300">{progress.wanted.toLocaleString()}</b> wanted</span>
            <span className="hidden sm:inline"><b>{progress.done.toLocaleString()}</b> done</span>
          </div>
          <label className="relative">
            <span className="sr-only">Category group</span>
            <Layers className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" aria-hidden />
            <select value={activeGroup ? groupSlug(activeGroup) : ''} title="Show only the categories in a group"
              onChange={e => { const v = e.target.value; if (v === '__manage') { setGroupsOpen(true); return; } update({ group: v || null, cat: null }); }}
              className={`h-9 w-[170px] pl-8 pr-2 rounded-xl border text-xs font-semibold bg-white dark:bg-zinc-900 ${activeGroup ? 'border-amber-400 text-amber-700 dark:text-amber-300' : 'border-zinc-200 dark:border-zinc-700'}`}>
              <option value="">All categories</option>
              <optgroup label="Built-in groups">
                {groups.filter(g => g.builtin).map(g => <option key={g.id} value={groupSlug(g)}>{g.name} ({g.cats.length})</option>)}
              </optgroup>
              {groups.some(g => !g.builtin) && (
                <optgroup label="My groups">
                  {groups.filter(g => !g.builtin).map(g => <option key={g.id} value={groupSlug(g)}>{g.name} ({g.cats.length})</option>)}
                </optgroup>
              )}
              <option value="__manage">Manage groups…</option>
            </select>
          </label>
          <button type="button" onClick={saveView} disabled={saving}
            className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-amber-400 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
            title={signedIn ? 'Save the current search and filters as a collection' : 'Save the current search and filters in this browser'}>
            <BookmarkPlus className="w-4 h-4" aria-hidden /> Save view
          </button>
          <label className="relative">
            <span className="sr-only">Open a collection</span>
            <FolderOpen className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" aria-hidden />
            <select value="" disabled={collections.length === 0}
              onChange={e => { const c = collections.find(x => x.id === e.target.value); if (c) navigate(collectionHref(c)); }}
              className="h-9 w-[150px] pl-8 pr-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold disabled:opacity-50">
              <option value="">{collections.length ? 'Saved views' : 'No saved views'}</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        {showHelp && (
          <div className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 grid sm:grid-cols-2 gap-x-6 gap-y-1">
            <div>Typos and partial words are OK: <code>sandal blak</code>, <code>frost</code></div>
            <div>Find what uses an ingredient: <code>gourd bell</code> matches items used to craft it</div>
            <div>Category: <code>cat:shoes</code>, <code>cat:"hair ornament"</code></div>
            <div>Group: <code>cat:accessories</code>, <code>group:clothing</code>, or your own groups (<button type="button" className="underline hover:text-amber-700" onClick={() => setGroupsOpen(true)}>manage</button>)</div>
            <div>Hearts: <code>hearts:5</code>, <code>r:&gt;=4</code>, <code>r:3-5</code></div>
            <div>Wardrobe No.: <code>#19</code>, <code>n:19</code>, <code>n:1-50</code></div>
            <div>Counts: <code>rd:&gt;10</code>, <code>rr:0</code>, <code>rdc:5-20</code>, <code>used:0</code>, <code>dyes:&gt;2</code></div>
            <div>Flags: <code>is:edited</code>, <code>has:comment</code>, <code>is:evolvable</code>, <code>is:customizable</code>, <code>is:future</code> (prefix <code>-</code> to negate)</div>
            <div>Wardrobe: <code>owned:yes</code>, <code>done:no</code>, <code>status:craft</code>, <code>is:waiting</code></div>
            <dl className="sm:col-span-2 mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
              <dt className="sm:col-span-2 font-semibold text-zinc-700 dark:text-zinc-200">What the columns mean</dt>
              {Object.entries(COLUMN_HELP).map(([k, v]) => (
                <div key={k} className={k === 'Status' ? 'sm:col-span-2' : ''}><dt className="inline font-semibold">{k}: </dt><dd className="inline whitespace-pre-line">{v}</dd></div>
              ))}
            </dl>
          </div>
        )}

        {/* Category tabs */}
        <div role="tablist" aria-label="Category" className="flex gap-1.5 h-10 items-center overflow-x-auto overflow-y-hidden pb-1 -mx-1 px-1 [scrollbar-width:thin] cat-scroller">
          {loading && Array.from({ length: 12 }).map((_, i) => <span key={i} className="shrink-0 h-[30px] w-24 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" aria-hidden />)}
          {!loading && [['All', scopedItems.length] as [string, number], ...categories].map(([c, count]) => (
            <button key={c} type="button" role="tab" aria-selected={cat === c} onClick={() => update({ cat: c })}
              className={`shrink-0 h-[30px] px-3 text-xs rounded-full font-semibold border transition-colors whitespace-nowrap ${cat === c
                ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-amber-300 text-zinc-600 dark:text-zinc-300'}`}>
              {c} <span className={cat === c ? 'opacity-90' : 'text-zinc-500 dark:text-zinc-400'}>{count.toLocaleString()}</span>
            </button>
          ))}
        </div>
      </div>

      <CategoryGroupsDialog open={groupsOpen} onClose={() => setGroupsOpen(false)} allCats={allCatNames} signedIn={signedIn}
        onUse={(g: CategoryGroup) => update({ group: groupSlug(g), cat: null })} />

      {notice && (
        <div role="status" className="mb-4 flex items-center justify-between gap-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl px-4 py-2 text-sm">
          {notice}
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="mb-3 px-1"><Pager where="top" /></div>
      {hasQuery && (
        <div className="mb-3 px-1 text-xs text-zinc-500">
          {sort === 'relevance' ? 'Sorted by relevance' : <>Sorted by {sort} · <button type="button" className="text-amber-700 dark:text-amber-400 hover:underline" onClick={() => update({ sort: null, dir: null })}>sort by relevance</button></>}
          {parsed.unknown.length > 0 && <> · unknown filter {parsed.unknown.join(', ')} searched as text</>}
        </div>
      )}

      {loading ? (
        <div aria-busy="true" aria-label="Loading items">
          <div className="hidden lg:block bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-700 overflow-clip shadow-sm">
            <div className="h-[45px] bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-700" />
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-[53px] px-5 flex items-center gap-6 border-b border-zinc-100 dark:border-zinc-800">
                <span className="h-3.5 w-48 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                <span className="h-3 w-20 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                <span className="h-3 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                <span className="h-3 flex-1 rounded-full bg-zinc-50 dark:bg-zinc-900" />
                <span className="h-7 w-24 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="lg:hidden space-y-2">
            <div className="h-[30px]" />
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[92px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl animate-pulse" />)}
          </div>
        </div>
      ) : mine && visibleItems.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-700 p-10 sm:p-12 text-center">
          <div className="font-display text-2xl mb-1">Your wardrobe is empty</div>
          <div className="text-sm text-zinc-500 mb-5">Mark items as Owned, Wanted (★) or Done in the guide and they'll show up here.</div>
          <Link to="/" className="inline-flex items-center h-11 px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-semibold">Browse the Decompose Guide</Link>
        </div>
      ) : total === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-700 p-12 text-center">
          <div className="text-lg font-medium mb-1">No items match</div>
          <div className="text-sm text-zinc-500 mb-4">Try fewer words, a different category, or check the search tips.</div>
          {anyFilter && <button type="button" onClick={clearFilters} className="p-btn inline-flex bg-amber-500 text-white hover:bg-amber-600 text-sm">Clear filters</button>}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-700 overflow-clip shadow-sm">
            <table className="w-full text-sm">
              <caption className="sr-only">Decompose guide items</caption>
              <thead className="sticky top-[72px] z-10 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-700">
                <tr>
                  <SortHeader k="name" label="Item" className="pl-5" />
                  <SortHeader k="cat" label="Cat" />
                  <SortHeader k="n" label="No." />
                  <SortHeader k="r" label="Hearts" />
                  <SortHeader k="status" label="Status" />
                  <SortHeader k="rd" label="Req." />
                  <SortHeader k="rdc" label="+Dyes" />
                  <SortHeader k="rr" label="Tree" />
                  <SortHeader k="used" label="Used" />
                  <SortHeader k="owned" label="Owned" />
                  <th scope="col" className="px-2 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 cursor-help" title={COLUMN_HELP.Want}>Want</th>
                  <SortHeader k="done" label="Done" className="pr-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {pageItems.map(item => {
                  const inf = infoOf(item);
                  return (
                    <tr key={item.id} className="item-row align-top">
                      <td className="pl-5 pr-3 py-3"><NameCell item={item} /></td>
                      <td className="px-3 py-3 text-xs text-zinc-500 whitespace-nowrap">{item.cat}</td>
                      <td className="px-3 py-3 font-mono text-zinc-500 tabular-nums">#{item.n}</td>
                      <td className="px-3 py-3"><Hearts r={item.r} /></td>
                      <td className="px-3 py-3"><StatusBadge status={inf.status} waiting={inf.waiting} /></td>
                      <td className="px-3 py-3 font-semibold tabular-nums"><Num item={item} field="rd" value={item.rd} /></td>
                      <td className="px-3 py-3 tabular-nums text-zinc-500"><Num item={item} field="rdc" value={item.rdc ?? item.rd} /></td>
                      <td className="px-3 py-3 tabular-nums text-zinc-500"><Num item={item} field="rr" value={item.rr} /></td>
                      <td className="px-3 py-3 tabular-nums text-zinc-500" title={(item.u || []).slice(0, 12).map(u => `${u.name || u.id} ×${u.q}`).join('\n') || undefined}>{item.u?.length || 0}</td>
                      <td className="px-3 py-2"><OwnedInput value={inf.owned} label={item.name} onCommit={n => setOwned(item.id, n)} /></td>
                      <td className="px-2 py-3"><WantedBtn item={item} inf={inf} /></td>
                      <td className="pl-3 pr-5 py-3"><DoneBtn item={item} inf={inf} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-2">
            <div className="flex items-center gap-2 text-xs text-zinc-500 px-1">
              <label htmlFor="mobile-sort">Sort</label>
              <select id="mobile-sort" value={sort} onChange={e => setSort(e.target.value as SortKey)}
                className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1">
                {SORT_KEYS.filter(k => k !== 'relevance' || hasQuery).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <button type="button" onClick={() => update({ sort, dir: dir === 'asc' ? 'desc' : 'asc' })} className="px-2 py-1 border rounded-lg border-zinc-200 dark:border-zinc-700" aria-label="Toggle sort direction">
                {dir === 'asc' ? '↑ asc' : '↓ desc'}
              </button>
            </div>
            {pageItems.map(item => {
              const inf = infoOf(item);
              return (
                <div key={item.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-3">
                  <div className="flex justify-between gap-2">
                    <NameCell item={item} />
                    <div className="flex items-start gap-1.5 shrink-0"><WantedBtn item={item} inf={inf} /><DoneBtn item={item} inf={inf} /></div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                    <span>Owned</span>
                    <OwnedInput size="md" value={inf.owned} label={item.name} onCommit={n => setOwned(item.id, n)} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span>{item.cat} <span className="font-mono">#{item.n}</span></span>
                    <Hearts r={item.r} />
                    <StatusBadge status={inf.status} waiting={inf.waiting} />
                    <span>Req <b className="text-zinc-800 dark:text-zinc-200"><Num item={item} field="rd" value={item.rd} /></b></span>
                    <span>+dyes <Num item={item} field="rdc" value={item.rdc ?? item.rd} /></span>
                    <span>tree <Num item={item} field="rr" value={item.rr} /></span>
                    <span>used {item.u?.length || 0}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 px-1"><Pager where="bottom" /></div>
        </>
      )}

      {meta && (
        <div className="mt-8 text-center text-xs text-zinc-400 font-mono">
          Data: Nikki Calc {meta.nikkicalc_version} • game data {safeDate(meta.nikkicalc_updated)} • bundle {safeDate(meta.generated)}
          <div className="mt-1">{meta.credit}</div>
        </div>
      )}
    </div>
  );
}

function safeDate(s?: string) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : format(d, 'yyyy-MM-dd');
}
