import { useState, useEffect, useMemo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { Search, Heart, Edit2, CheckCircle, AlertTriangle, Info, ArrowLeft, Download, Upload } from 'lucide-react';
import Fuse from 'fuse.js';
import { format } from 'date-fns';

const DATA_URL = 'https://raw.githubusercontent.com/wdoucette/pikkis-info-data/main/data/pikkis-info.min.json';
const FALLBACK_URL = 'https://cdn.jsdelivr.net/gh/wdoucette/pikkis-info-data@main/data/pikkis-info.min.json';

interface Meta {
  nikkicalc_version: string;
  nikkicalc_updated: string;
  generated: string;
  item_count: number;
  credit: string;
  [key: string]: any;
}

interface CraftItem {
  id: number;
  n?: number;
  name?: string;
  q: number;
}

interface Item {
  id: number;
  n: number;
  name: string;
  cat: string;
  r?: number;
  rd: number;
  rr?: number;
  rdc?: number;
  rrc?: number;
  fut?: number;
  u?: CraftItem[];
  cf?: { id: number; q: number }[];
  ev?: any;
  d?: { n: string; id?: number; name?: string }[];
  o?: string;
  comment?: string;
  used_to_craft_note?: string;
  cannot_decompose?: boolean;
  hidden?: boolean;
  edited?: string[];
  [key: string]: any;
}

interface WardrobeData {
  [key: string]: {
    owned: number;
    done: boolean;
  };
}

const PikkiMonogram = () => (
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-white font-bold text-3xl shadow-inner border-2 border-amber-300">
      P
    </div>
    <div>
      <div className="text-3xl font-bold tracking-tighter text-amber-950 dark:text-amber-100">Pikki's Info</div>
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



const StatusBadge = ({ status }: { status: string }) => {
  const colors = {
    'Extra clothes': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    'Still needed': 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    'Cannot decompose': 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    'Not owned': 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  };
  return (
    <span className={`inline-block px-3 py-0.5 text-xs font-medium rounded-full ${colors[status as keyof typeof colors] || 'bg-zinc-100 text-zinc-500'}`}>
      {status}
    </span>
  );
};

function DecomposeGuide({ items, meta, wardrobe, setWardrobe, loading }: { 
  items: Item[], 
  meta: Meta | null, 
  wardrobe: WardrobeData, 
  setWardrobe: (w: WardrobeData) => void,
  loading: boolean 
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('cat') || 'All');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || 'All');
  const [sortBy] = useState<'cat' | 'n' | 'name' | 'rd'>('cat');
  const [sortDir] = useState<'asc' | 'desc'>('asc');

  const categories = useMemo(() => {
    const cats = new Set(items.map(i => i.cat));
    return ['All', ...Array.from(cats).sort()];
  }, [items]);

  const statuses = ['All', 'Extra clothes', 'Still needed', 'Cannot decompose', 'Not owned', 'Left to do'];

  // Debounced search
  const debouncedSearchTerm = useMemo(() => searchTerm, [searchTerm]);

  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // Filter by category
    if (selectedCategory !== 'All') {
      result = result.filter(item => item.cat === selectedCategory);
    }

    // Filter by status
    if (selectedStatus !== 'All') {
      result = result.filter(item => {
        const status = computeItemStatus(item, wardrobe);
        if (selectedStatus === 'Left to do') return !wardrobe[item.id]?.done;
        return status === selectedStatus;
      });
    }

    // Enhanced semantic search across multiple fields
    if (debouncedSearchTerm) {
      const fuse = new Fuse(result, {
        keys: [
          { name: 'name', weight: 0.5 },
          { name: 'cat', weight: 0.2 },
          { name: 'n', weight: 0.15 },
          { name: 'comment', weight: 0.1 },
          { name: 'o', weight: 0.05 },           // Obtained from
          { name: 'used_to_craft_note', weight: 0.05 }
        ],
        threshold: 0.35,           // More forgiving for semantic/fuzzy matches
        isCaseSensitive: false,
        minMatchCharLength: 2,
        shouldSort: true,
        includeScore: true,
      });
      const searchResults = fuse.search(debouncedSearchTerm);
      result = searchResults.map(r => r.item);
    }

    // Exclude hidden
    result = result.filter(item => !item.hidden);

    // Sort
    result.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'cat') {
        valA = a.cat;
        valB = b.cat;
      } else if (sortBy === 'n') {
        valA = a.n;
        valB = b.n;
      } else if (sortBy === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else {
        valA = a.rd || 0;
        valB = b.rd || 0;
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [items, selectedCategory, selectedStatus, debouncedSearchTerm, sortBy, sortDir, wardrobe]);

  const updateUrlParams = useCallback(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('q', searchTerm);
    if (selectedCategory !== 'All') params.set('cat', selectedCategory);
    if (selectedStatus !== 'All') params.set('status', selectedStatus);
    setSearchParams(params, { replace: true });
  }, [searchTerm, selectedCategory, selectedStatus, setSearchParams]);

  useEffect(() => {
    updateUrlParams();
  }, [updateUrlParams]);

  const toggleOwned = (itemId: number, currentOwned: number) => {
    const newOwned = currentOwned > 0 ? 0 : 1;
    setWardrobe({
      ...wardrobe,
      [itemId]: { 
        ...(wardrobe[itemId] || {}), 
        owned: newOwned 
      }
    });
  };

  const toggleDone = (itemId: number, currentDone: boolean) => {
    setWardrobe({
      ...wardrobe,
      [itemId]: { 
        ...(wardrobe[itemId] || { owned: 0 }), 
        done: !currentDone 
      }
    });
  };

  const computeItemStatus = (item: Item, wardrobeData: WardrobeData): string => {
    if (item.cannot_decompose) return 'Cannot decompose';
    const ownedInfo = wardrobeData[item.id];
    const ownedCount = ownedInfo?.owned || 0;
    if (ownedCount === 0) return 'Not owned';

    // Simple status for MVP (full logic in later iteration)
    const hasUses = (item.u && item.u.length > 0) || (item.ev && item.ev.to);
    if (hasUses) return 'Still needed';
    return 'Extra clothes';
  };

  const exportCSV = () => {
    const headers = ['Item', 'Category', 'No.', 'Owned', 'Done'];
    const rows = items.map(item => {
      const w = wardrobe[item.id] || { owned: 0, done: false };
      return [
        item.name,
        item.cat,
        item.n,
        w.owned,
        w.done ? 'Yes' : 'No'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pikkis-wardrobe.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* Warning Banner */}
      <div className="mb-8 bg-amber-50 dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 rounded-3xl p-6 text-sm">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Do not decompose items you still need</div>
            <p className="text-amber-700 dark:text-amber-400 leading-relaxed">
              Check the <span className="font-medium">"Used to craft"</span> and <span className="font-medium">"Required"</span> columns before selling or decomposing.
              This guide uses the latest Nikki Calc data. Always verify with in-game wardrobe.
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-3xl p-4 shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search anything (name, category, number, comment...)"
            className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:border-amber-400 text-sm"
            autoFocus
          />
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl">
          {categories.slice(0, 8).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2 text-sm rounded-[14px] font-medium transition-all ${selectedCategory === cat 
                ? 'bg-white dark:bg-zinc-700 shadow-sm text-amber-600 dark:text-amber-400' 
                : 'hover:bg-white/60 dark:hover:bg-zinc-700/60'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400"
        >
          {statuses.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="p-btn bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 hover:border-amber-300 text-zinc-700 dark:text-zinc-300"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button className="p-btn bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 hover:border-amber-300 text-zinc-700 dark:text-zinc-300">
            <Upload className="w-4 h-4" /> Import
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className="flex justify-between items-center mb-4 px-1">
        <div className="text-sm text-zinc-500">
          Showing <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{filteredAndSortedItems.length}</span> of {items.length} items
          {meta && <span className="ml-3 text-xs">• Data v{meta.nikkicalc_version}</span>}
          {searchTerm && <span className="ml-2 text-amber-600 font-medium">(search: "{searchTerm}")</span>}
        </div>
        <div className="text-xs text-zinc-400 font-mono">sort: {sortBy}</div>
      </div>

      {/* Items Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-700 overflow-hidden shadow-sm">
        <table className="w-full min-w-full">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950">
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500">ITEM</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500">CAT</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500">NO.</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500">RARITY</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500">STATUS</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500">REQUIRED</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500">OWNED</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-zinc-500">DONE</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredAndSortedItems.slice(0, 100).map(item => {  // Limit for initial performance
              const status = computeItemStatus(item, wardrobe);
              const ownedInfo = wardrobe[item.id] || { owned: 0, done: false };
              const hasComment = !!item.comment;
              const isEdited = item.edited && item.edited.length > 0;

              return (
                <tr key={item.id} className="item-row group">
                  <td className="px-6 py-4">
                    <Link 
                      to={`/wardrobe/${item.cat.toLowerCase()}/${item.n}`}
                      className="font-medium hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-2 group-hover:underline"
                    >
                      {item.name}
                      {isEdited && <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-px rounded font-mono">edited</span>}
                      {hasComment && <Info className="w-3.5 h-3.5 text-amber-400" />}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-500 font-mono">{item.cat}</td>
                  <td className="px-6 py-4 font-mono text-sm text-zinc-400">#{item.n}</td>
                  <td className="px-6 py-4">
                    {item.r && (
                      <div className="flex items-center gap-px">
                        {Array.from({ length: Math.min(item.r, 5) }).map((_, i) => (
                          <Heart key={i} className="w-4 h-4 fill-rose-500 text-rose-500" />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={status} />
                  </td>
                  <td className="px-6 py-4 font-medium tabular-nums">{item.rd}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleOwned(item.id, ownedInfo.owned)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono border transition-all ${
                          ownedInfo.owned > 0 
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900 dark:border-emerald-700' 
                            : 'bg-zinc-100 border-zinc-300 hover:bg-zinc-200 dark:bg-zinc-800'
                        }`}
                      >
                        {ownedInfo.owned || '0'}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleDone(item.id, ownedInfo.done)}
                      className={`w-6 h-6 flex items-center justify-center rounded-md border transition-all ${
                        ownedInfo.done 
                          ? 'bg-emerald-500 border-emerald-500 text-white' 
                          : 'border-zinc-300 dark:border-zinc-600 hover:border-emerald-400'
                      }`}
                    >
                      {ownedInfo.done && <CheckCircle className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-6 py-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link to={`/wardrobe/${item.cat.toLowerCase()}/${item.n}`} className="text-amber-500 hover:text-amber-600">
                      →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredAndSortedItems.length === 0 && (
          <div className="p-12 text-center text-zinc-400">
            No items match your filters.
          </div>
        )}
        {filteredAndSortedItems.length > 100 && (
          <div className="p-4 text-center text-xs text-zinc-400 border-t">
            Showing first 100 results. Use search or filters to narrow down.
          </div>
        )}
      </div>

      {/* Data footer */}
      {meta && (
        <div className="mt-8 text-center text-xs text-zinc-400 font-mono">
          Data: Nikki Calc v{meta.nikkicalc_version} • game data {format(new Date(meta.nikkicalc_updated), 'yyyy-MM-dd')} • bundle {format(new Date(meta.generated), 'yyyy-MM-dd')}
          <div className="mt-1">{meta.credit}</div>
        </div>
      )}
    </div>
  );
}

function ItemPage({ items, wardrobe }: { items: Item[], wardrobe: WardrobeData }) {
  const { cat, n } = useParams<{ cat?: string; n?: string }>();
  const navigate = useNavigate();
  const item = items.find(i => 
    (cat && n && i.cat.toLowerCase() === cat.toLowerCase() && i.n === parseInt(n)) || 
    false // TODO: support /item/id later
  );

  if (!item) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h2 className="text-2xl font-semibold mb-4">Item not found</h2>
        <Link to="/" className="text-amber-600 hover:underline inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Decompose Guide
        </Link>
      </div>
    );
  }

  const ownedInfo = wardrobe[item.id] || { owned: 0, done: false };
  // const status = 'Extra clothes'; // Placeholder - full impl in next pass

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button 
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 mb-8"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Guide
      </button>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow p-8">
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-mono rounded-full">{item.cat} #{item.n}</span>
              {item.r && <div className="flex">{Array(item.r).fill(0).map((_, i) => <Heart key={i} className="w-5 h-5 text-rose-500" />)}</div>}
            </div>
            <h1 className="text-4xl font-bold mt-3 text-balance">{item.name}</h1>
            {item.edited && item.edited.length > 0 && (
              <div className="inline-flex items-center gap-2 mt-2 px-4 py-1 bg-amber-100 text-amber-700 text-xs rounded-2xl">
                <Edit2 className="w-3 h-3" /> Edited by Pikki ({item.edited.join(', ')})
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => {/* toggle owned */}} className="px-5 py-2 border rounded-2xl text-sm flex items-center gap-2 hover:bg-zinc-50">
              Owned: <span className="font-mono font-bold">{ownedInfo.owned}</span>
            </button>
            <button onClick={() => {/* toggle done */}} className={`px-6 py-2 rounded-2xl text-sm font-medium ${ownedInfo.done ? 'bg-emerald-600 text-white' : 'border'}`}>
              {ownedInfo.done ? '✓ Done' : 'Mark Done'}
            </button>
          </div>
        </div>

        {item.comment && (
          <div className="mb-10 bg-amber-50 border-l-4 border-amber-400 p-6 rounded-r-2xl">
            <div className="uppercase text-amber-500 text-xs tracking-widest mb-2">EDITORIAL NOTE</div>
            <p className="text-lg leading-relaxed text-amber-800">{item.comment}</p>
          </div>
        )}

        {item.o && (
          <div className="mb-8">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">OBTAINED FROM</div>
            <div className="text-zinc-600">{item.o}</div>
          </div>
        )}

        {/* Used to Craft - the most important section */}
        {item.u && item.u.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <div className="text-lg font-semibold">Used to craft</div>
              <div className="text-xs bg-rose-100 text-rose-700 px-3 py-1 rounded-full">Critical for decompose decisions</div>
            </div>
            <div className="space-y-3">
              {item.u.map((craft, idx) => (
                <Link 
                  key={idx}
                  to={`/item/${craft.id}`} 
                  className="block p-5 bg-zinc-50 hover:bg-amber-50 dark:bg-zinc-800 rounded-2xl group flex justify-between items-center border border-transparent hover:border-amber-200"
                >
                  <div className="font-medium">{craft.name || `Item #${craft.id}`}</div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-500">Need</div>
                    <div className="font-mono text-xl font-semibold text-rose-500">×{craft.q}</div>
                  </div>
                </Link>
              ))}
            </div>
            {item.used_to_craft_note && <p className="mt-4 text-sm text-zinc-500 italic">{item.used_to_craft_note}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">REQUIRED IN WARDROBE</div>
            <div className="text-6xl font-light tabular-nums text-amber-500">{item.rd}</div>
            {item.rdc && item.rdc > item.rd && (
              <div className="text-sm text-amber-600 mt-1">incl. recolours: {item.rdc}</div>
            )}
            <div className="mt-6 text-xs leading-relaxed text-zinc-500 max-w-xs">
              Main required count (recipes + evolutions). Recolours are shown separately as they consume an additional base copy.
            </div>
          </div>

          {item.d && item.d.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-4">CUSTOMISATIONS / DYES</div>
              <div className="space-y-2">
                {item.d.map((dye, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-2xl text-sm">
                    {dye.name || 'Recolour'}
                  </div>
                ))}
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
          <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
            <Link to="/">
              <PikkiMonogram />
            </Link>
            
            <div className="flex items-center gap-8 text-sm">
              <Link to="/" className="hover:text-amber-600 font-medium">Decompose Guide</Link>
              <a href="https://github.com/wdoucette/pikkis-info" target="_blank" className="hover:text-amber-600">GitHub</a>
              <a href="#about" className="text-zinc-400 hover:text-zinc-600">About</a>
            </div>
            
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
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
              <ItemPage items={items} wardrobe={wardrobe} />
            } />
            <Route path="/item/:id" element={
              <div className="p-12 text-center">Item ID routing coming soon</div>
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
