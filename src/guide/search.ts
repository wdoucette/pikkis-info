import MiniSearch from 'minisearch';
import type { Item } from '../types';
import type { DerivedInfo } from './status';

/**
 * Client-side "smart" search for the decompose guide.
 * - One MiniSearch index built once per dataset (fuzzy, prefix, multi-field, ranked).
 * - Field filters parsed out of the query: cat:shoes, hearts:5 / r:>=4, #19 / n:19,
 *   rd:>10, used:0, is:edited, has:comment, owned:yes, done:no, status:needed ...
 * No network/AI calls.
 */

const tokenize = (text: string): string[] =>
  text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);

export type SearchIndex = MiniSearch<{ id: number }>;

export function buildIndex(items: Item[]): SearchIndex {
  const ms = new MiniSearch<{ id: number }>({
    idField: 'id',
    fields: ['name', 'cat', 'num', 'comment', 'o', 'uses', 'dyes'],
    storeFields: [],
    tokenize,
    extractField: (doc: any, field: string) => {
      const it = doc as Item;
      switch (field) {
        case 'id': return it.id as any;
        case 'name': return it.name;
        case 'cat': return it.cat;
        case 'num': return String(it.n);
        case 'comment': return [it.comment, it.used_to_craft_note].filter(Boolean).join(' ');
        case 'o': return it.o || '';
        case 'uses': return (it.u || []).map(u => u.name || (typeof u.n === 'string' ? u.n : '')).join(' ');
        case 'dyes': return (it.d || []).map(d => d.name || d.n).join(' ');
        default: return '';
      }
    },
  });
  ms.addAll(items.filter(i => !i.hidden) as any);
  return ms;
}

export type NumOp = { op: '=' | '>' | '<' | '>=' | '<=' | 'range'; a: number; b?: number };

export interface ParsedQuery {
  text: string;
  cats: string[];
  nums: { field: NumField; test: NumOp }[];
  flags: { flag: string; neg: boolean }[];
  owned?: boolean;
  done?: boolean;
  status?: string;
  /** Unrecognised key:value tokens (fed back into text search). */
  unknown: string[];
}

type NumField = 'r' | 'n' | 'rd' | 'rr' | 'rdc' | 'rrc' | 'used' | 'dyes';

const NUM_KEYS: Record<string, NumField> = {
  r: 'r', hearts: 'r', heart: 'r', rarity: 'r',
  n: 'n', no: 'n', num: 'n', number: 'n',
  rd: 'rd', req: 'rd', required: 'rd',
  rr: 'rr', tree: 'rr',
  rdc: 'rdc', recolours: 'rdc', recolors: 'rdc',
  rrc: 'rrc',
  used: 'used', uses: 'used',
  dyes: 'dyes', recolourcount: 'dyes',
};

function splitQuery(q: string): string[] {
  const out: string[] = [];
  const re = /(\S+?:"[^"]*"?|"[^"]*"?|\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(q))) out.push(m[1]);
  return out;
}

function parseNum(op: string, raw: string): NumOp | null {
  const v = raw.trim();
  let m = v.match(/^(\d+)\s*(?:-|\.\.)\s*(\d+)$/);
  if (m && (op === ':' || op === '=')) return { op: 'range', a: +m[1], b: +m[2] };
  m = v.match(/^(>=|<=|>|<|=)?(\d+)\+?$/);
  if (!m) return null;
  const inner = (m[1] || '') as string;
  const plus = v.endsWith('+');
  const finalOp = (op === ':' || op === '=') ? (inner || (plus ? '>=' : '=')) : op;
  return { op: finalOp as NumOp['op'], a: +m[2] };
}

const yes = (v: string) => /^(y|yes|true|1|on)$/i.test(v);
const no = (v: string) => /^(n|no|false|0|off)$/i.test(v);

export function parseQuery(q: string): ParsedQuery {
  const pq: ParsedQuery = { text: '', cats: [], nums: [], flags: [], unknown: [] };
  const free: string[] = [];
  for (const tok of splitQuery(q)) {
    const hash = tok.match(/^#(\d+(?:-\d+)?)$/);
    if (hash) { const t = parseNum(':', hash[1]); if (t) { pq.nums.push({ field: 'n', test: t }); continue; } }
    const m = tok.match(/^(-?)([a-z_]+)(:|>=|<=|>|<|=)(.*)$/i);
    if (!m) { free.push(tok.replace(/"/g, '')); continue; }
    const neg = m[1] === '-';
    const key = m[2].toLowerCase();
    const op = m[3];
    const val = m[4].replace(/^"|"$/g, '').replace(/_/g, ' ').trim();
    if (!val) { free.push(tok); continue; }
    if (key === 'cat' || key === 'category' || key === 'c') { pq.cats.push(val.toLowerCase()); continue; }
    if (NUM_KEYS[key]) {
      const t = parseNum(op, val);
      if (t) { pq.nums.push({ field: NUM_KEYS[key], test: t }); continue; }
    }
    if (key === 'is' || key === 'has') { pq.flags.push({ flag: val.toLowerCase(), neg }); continue; }
    if (key === 'owned' || key === 'own') { if (yes(val)) pq.owned = true; else if (no(val)) pq.owned = false; continue; }
    if (key === 'done') { if (yes(val)) pq.done = true; else if (no(val)) pq.done = false; continue; }
    if (key === 'status' || key === 'st') { pq.status = val.toLowerCase(); continue; }
    pq.unknown.push(tok);
    free.push(val);
  }
  // A bare number on its own is most likely a wardrobe number.
  pq.text = free.join(' ').trim();
  return pq;
}

function testNum(v: number | undefined, t: NumOp): boolean {
  const x = v ?? 0;
  switch (t.op) {
    case '=': return x === t.a;
    case '>': return x > t.a;
    case '<': return x < t.a;
    case '>=': return x >= t.a;
    case '<=': return x <= t.a;
    case 'range': return x >= Math.min(t.a, t.b!) && x <= Math.max(t.a, t.b!);
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function flagTrue(item: Item, flag: string, info: DerivedInfo): boolean | null {
  switch (flag) {
    case 'edited': case 'edit': case 'override': return !!item.edited?.length;
    case 'comment': case 'comments': case 'note': return !!item.comment;
    case 'fut': case 'future': return item.fut === 1;
    case 'custom': case 'customizable': case 'customisable': case 'dyes': case 'dye': case 'recolour': case 'recolor':
      return !!item.d?.length;
    case 'evo': case 'evolvable': case 'evolve': case 'evolution': return !!item.ev;
    case 'recipe': case 'craftable': case 'crafted': return !!item.cf?.length;
    case 'material': case 'ingredient': case 'used': return !!item.u?.length;
    case 'cannot': case 'cannotdecompose': case 'locked': return !!item.cannot_decompose;
    case 'owned': return info.owned > 0;
    case 'done': return info.done;
    case 'waiting': return info.waiting > 0;
    default: return null;
  }
}

export function matchStatus(want: string, status: string): boolean {
  const w = norm(want).replace(/\s/g, '');
  const s = norm(status).replace(/\s/g, '');
  if (s.startsWith(w)) return true;
  if (w === 'extra' || w === 'spare') return status === 'Extra clothes';
  if (w === 'needed' || w === 'keep' || w === 'still') return status === 'Still needed';
  if (w === 'cannot' || w === 'locked') return status === 'Cannot decompose';
  if (w === 'unowned' || w === 'notowned' || w === 'missing') return status === 'Not owned';
  return false;
}

/** Returns a predicate for the structured filters (null if there are none). */
export function structuredFilter(
  pq: ParsedQuery,
  infoOf: (it: Item) => DerivedInfo,
  allCats: string[],
): ((it: Item) => boolean) | null {
  const checks: ((it: Item) => boolean)[] = [];
  if (pq.cats.length) {
    const wanted = new Set<string>();
    for (const c of pq.cats) {
      const nc = norm(c);
      const exact = allCats.filter(a => norm(a) === nc);
      const pref = exact.length ? exact : allCats.filter(a => norm(a).startsWith(nc));
      const sub = pref.length ? pref : allCats.filter(a => norm(a).includes(nc));
      // allow "shoe" -> Shoes, "hairs" -> Hair
      const loose = sub.length ? sub : allCats.filter(a => nc.startsWith(norm(a)) || norm(a).startsWith(nc.replace(/s$/, '')));
      loose.forEach(a => wanted.add(a));
    }
    checks.push(it => wanted.has(it.cat));
  }
  for (const { field, test } of pq.nums) {
    checks.push(it => {
      const v = field === 'used' ? (it.u?.length || 0) : field === 'dyes' ? (it.d?.length || 0) : (it[field] as number | undefined);
      return testNum(v, test);
    });
  }
  for (const { flag, neg } of pq.flags) {
    checks.push(it => {
      const r = flagTrue(it, flag, infoOf(it));
      if (r === null) return true;
      return neg ? !r : r;
    });
  }
  if (pq.owned !== undefined) checks.push(it => (infoOf(it).owned > 0) === pq.owned);
  if (pq.done !== undefined) checks.push(it => infoOf(it).done === pq.done);
  if (pq.status) checks.push(it => matchStatus(pq.status!, infoOf(it).status));
  if (!checks.length) return null;
  return it => checks.every(c => c(it));
}

/** Full-text ranked search. Returns id -> relevance score (higher is better). */
export function textSearch(index: SearchIndex, items: Map<number, Item>, text: string): Map<number, number> {
  const scores = new Map<number, number>();
  const q = text.trim();
  if (!q) return scores;
  const base = {
    prefix: (term: string) => term.length >= 2,
    boost: { name: 5, cat: 1.5, num: 3, dyes: 1.2, comment: 1, o: 1, uses: 0.5 },
    weights: { fuzzy: 0.25, prefix: 0.5 },
  };
  // Tier 1: every word, small typos. Tier 2: every word, bigger typos (e.g. transpositions).
  // Tier 3: most words, keeping only strong matches.
  const strict = { ...base, fuzzy: (t: string) => (t.length >= 8 ? 2 : t.length >= 4 ? 1 : false), maxFuzzy: 2 };
  const loose = { ...base, fuzzy: (t: string) => (t.length >= 5 ? 2 : t.length >= 3 ? 1 : false), maxFuzzy: 2 };
  let res = index.search(q, { ...strict, combineWith: 'AND' });
  if (res.length < 10) {
    // Few hits: also accept bigger typos ("sandles" -> Sandals), ranked below the closer matches.
    const seen = new Set(res.map(r => r.id));
    const top = res[0]?.score ?? 0;
    const extra = index.search(q, { ...loose, combineWith: 'AND' })
      .filter(r => !seen.has(r.id))
      .map(r => ({ ...r, score: r.score * 0.5 }));
    const floor = Math.max(top, extra[0]?.score ?? 0) * 0.35;
    res = [...res, ...extra.filter(r => r.score >= floor)];
  }
  if (!res.length) {
    res = index.search(q, { ...loose, combineWith: 'OR' });
    const top = res[0]?.score ?? 0;
    res = res.filter(r => r.score >= top * 0.35);
  }
  const ql = norm(q);
  for (const r of res) {
    let s = r.score;
    const it = items.get(r.id as number);
    if (it) {
      const nm = norm(it.name);
      if (nm === ql) s *= 4;
      else if (nm.startsWith(ql)) s *= 2.5;
      else if (nm.includes(ql)) s *= 1.6;
      if (/^\d+$/.test(ql) && String(it.n) === ql) s *= 3;
    }
    scores.set(r.id as number, s);
  }
  return scores;
}
