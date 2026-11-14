import type { Item, WardrobeData } from '../types';
import { parseCSV } from './csv';

export interface CsvImportResult {
  next: WardrobeData;
  matched: number;
  unmatched: number;
  ambiguous: number;
  error?: string;
}

const YES = /^(y|yes|true|1|x|✓|✔)$/i;

/**
 * Read a wardrobe CSV (Item, Category, No., Owned, Wanted/Want, Done) onto `base`.
 * Pass `{}` as base to replace the wardrobe, or the current wardrobe to merge into it.
 */
export function wardrobeFromCSV(text: string, items: Item[], base: WardrobeData): CsvImportResult {
  const rows = parseCSV(text);
  const empty = { next: base, matched: 0, unmatched: 0, ambiguous: 0 };
  if (rows.length < 2) return { ...empty, error: 'The file has no data rows.' };
  const header = rows[0].map(h => h.trim().toLowerCase());
  const col = (...names: string[]) => header.findIndex(h => names.includes(h));
  const iItem = col('item', 'name'), iCat = col('category', 'cat'), iNo = col('no.', 'no', 'n', 'number');
  const iOwned = col('owned', 'own'), iDone = col('done'), iWanted = col('wanted', 'want', 'wishlist');
  if (iItem < 0 && (iCat < 0 || iNo < 0)) return { ...empty, error: 'Need an Item column, or Category + No. columns.' };
  const byCatNo = new Map<string, Item>();
  const byName = new Map<string, Item[]>();
  for (const it of items) {
    byCatNo.set(`${it.cat.toLowerCase()}|${it.n}`, it);
    const k = it.name.toLowerCase();
    byName.set(k, [...(byName.get(k) || []), it]);
  }
  const next: WardrobeData = { ...base };
  let matched = 0, unmatched = 0, ambiguous = 0;
  for (const r of rows.slice(1)) {
    let it: Item | undefined;
    const c = iCat >= 0 ? r[iCat]?.trim().toLowerCase() : '';
    const n = iNo >= 0 ? parseInt(r[iNo] || '', 10) : NaN;
    if (c && !Number.isNaN(n)) it = byCatNo.get(`${c}|${n}`);
    if (!it && iItem >= 0) {
      const cands = byName.get((r[iItem] || '').trim().toLowerCase()) || [];
      if (cands.length === 1) it = cands[0];
      else if (cands.length > 1) { ambiguous++; continue; }
    }
    if (!it) { unmatched++; continue; }
    const ov = iOwned >= 0 ? (r[iOwned] || '').trim() : '';
    const owned = /^\d+$/.test(ov) ? Math.min(9999, parseInt(ov, 10)) : /^(y|yes|true|x|✓|✔)$/i.test(ov) ? 1 : 0;
    const done = iDone >= 0 ? YES.test((r[iDone] || '').trim()) : !!next[it.id]?.done;
    const wantedIn = iWanted >= 0 ? YES.test((r[iWanted] || '').trim()) : !!next[it.id]?.wanted;
    if (!owned && !done && !wantedIn) { delete next[it.id]; matched++; continue; }
    next[it.id] = { owned, done, ...(owned === 0 && wantedIn ? { wanted: true } : {}) };
    matched++;
  }
  return { next, matched, unmatched, ambiguous };
}

export function describeImport(r: CsvImportResult): string {
  return `${r.matched} rows${r.unmatched ? `, ${r.unmatched} not found` : ''}${r.ambiguous ? `, ${r.ambiguous} skipped (ambiguous name — add Category and No.)` : ''}`;
}
