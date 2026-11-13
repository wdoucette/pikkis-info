import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { WardrobeData, WardrobeEntry } from '../types';

const LOCAL_KEY = 'pikkis-wardrobe';
const cacheKey = (uid: string) => `pikkis-wardrobe-cloud:${uid}`;
const mergeKey = (uid: string) => `pikkis-merge-dismissed:${uid}`;

export type SyncState = 'local' | 'loading' | 'saved' | 'saving' | 'error';

interface Row { item_id: string; status: 'owned' | 'wanted' | 'none'; count: number; done: boolean }

function readJSON<T>(key: string, fallback: T): T {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) as T : fallback; } catch { return fallback; }
}
function writeJSON(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* quota / private mode */ }
}

export const isEmptyEntry = (e?: WardrobeEntry) => !e || (!(e.owned > 0) && !e.done && !e.wanted);
const sameEntry = (a?: WardrobeEntry, b?: WardrobeEntry) =>
  (a?.owned || 0) === (b?.owned || 0) && !!a?.done === !!b?.done && !!a?.wanted === !!b?.wanted;

function toRow(uid: string, id: string, e: WardrobeEntry) {
  const owned = Math.max(0, Math.min(9999, Math.floor(e.owned || 0)));
  return { user_id: uid, item_id: id, status: owned > 0 ? 'owned' : e.wanted ? 'wanted' : 'none', count: owned, done: !!e.done };
}
function fromRows(rows: Row[]): WardrobeData {
  const w: WardrobeData = {};
  for (const r of rows) {
    w[r.item_id] = { owned: r.status === 'owned' ? Math.max(1, r.count) : 0, done: r.done, ...(r.status === 'wanted' ? { wanted: true } : {}) };
  }
  return w;
}
const countEntries = (w: WardrobeData) => Object.values(w).filter(e => !isEmptyEntry(e)).length;

/**
 * Wardrobe state: localStorage when signed out; Supabase (cached locally for instant paint) when signed in.
 * Writes are diffed and batched, so CSV imports of thousands of rows are a handful of requests.
 */
export function useWardrobe(user: User | null, authReady: boolean) {
  const uid = user?.id ?? null;
  const [localW, setLocalW] = useState<WardrobeData>(() => readJSON(LOCAL_KEY, {}));
  const [cloudW, setCloudW] = useState<WardrobeData>({});
  const [sync, setSync] = useState<SyncState>('local');
  const [mergeDismissed, setMergeDismissed] = useState(false);
  const cloudRef = useRef(cloudW);
  cloudRef.current = cloudW;
  const pending = useRef(new Set<string>());
  const timer = useRef<number | null>(null);

  useEffect(() => { writeJSON(LOCAL_KEY, localW); }, [localW]);

  // Load the signed-in user's wardrobe.
  useEffect(() => {
    if (!uid) { setCloudW({}); setSync('local'); return; }
    let alive = true;
    setCloudW(readJSON(cacheKey(uid), {}));
    setMergeDismissed(readJSON(mergeKey(uid), false));
    setSync('loading');
    (async () => {
      const all: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('wardrobe_items').select('item_id,status,count,done')
          .eq('user_id', uid).order('item_id').range(from, from + 999);
        if (error) { if (alive) setSync('error'); console.warn('Wardrobe load failed', error.message); return; }
        all.push(...(data as Row[]));
        if (!data || data.length < 1000) break;
      }
      if (!alive) return;
      const w = fromRows(all);
      // Keep any edits made while loading.
      for (const id of pending.current) { const e = cloudRef.current[id]; if (e) w[id] = e; else delete w[id]; }
      setCloudW(w);
      setSync(pending.current.size ? 'saving' : 'saved');
    })();
    return () => { alive = false; };
  }, [uid]);

  useEffect(() => { if (uid && sync !== 'loading') writeJSON(cacheKey(uid), cloudW); }, [uid, cloudW, sync]);

  const flush = useCallback(async () => {
    timer.current = null;
    if (!uid || !pending.current.size) return;
    const ids = Array.from(pending.current);
    pending.current.clear();
    const w = cloudRef.current;
    const ups = ids.filter(id => !isEmptyEntry(w[id])).map(id => toRow(uid, id, w[id]));
    const dels = ids.filter(id => isEmptyEntry(w[id]));
    setSync('saving');
    try {
      for (let i = 0; i < ups.length; i += 500) {
        const { error } = await supabase.from('wardrobe_items').upsert(ups.slice(i, i + 500), { onConflict: 'user_id,item_id' });
        if (error) throw error;
      }
      for (let i = 0; i < dels.length; i += 200) {
        const { error } = await supabase.from('wardrobe_items').delete().eq('user_id', uid).in('item_id', dels.slice(i, i + 200));
        if (error) throw error;
      }
      setSync(pending.current.size ? 'saving' : 'saved');
    } catch (e) {
      console.warn('Wardrobe save failed', e);
      for (const id of ids) pending.current.add(id);
      setSync('error');
      timer.current = window.setTimeout(flush, 5000);
    }
  }, [uid]);

  // Save on tab close if something is still queued.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden' && pending.current.size) flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [flush]);

  const setWardrobe = useCallback((next: WardrobeData) => {
    if (!uid) { setLocalW(next); return; }
    const prev = cloudRef.current;
    for (const id of new Set([...Object.keys(prev), ...Object.keys(next)])) {
      if (!sameEntry(prev[id], next[id])) pending.current.add(id);
    }
    cloudRef.current = next;
    setCloudW(next);
    if (pending.current.size) {
      setSync('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 600);
    }
  }, [uid, flush]);

  const localCount = useMemo(() => countEntries(localW), [localW]);

  /** Fold the browser-only wardrobe into the account (max owned, OR done/wanted), then clear it. */
  const mergeLocal = useCallback(() => {
    if (!uid) return;
    const next: WardrobeData = { ...cloudRef.current };
    for (const [id, e] of Object.entries(localW)) {
      if (isEmptyEntry(e)) continue;
      const c = next[id];
      const owned = Math.max(c?.owned || 0, e.owned || 0);
      next[id] = { owned, done: !!(c?.done || e.done), ...(owned === 0 && (c?.wanted || e.wanted) ? { wanted: true } : {}) };
    }
    setWardrobe(next);
    setLocalW({});
  }, [uid, localW, setWardrobe]);

  const dismissMerge = useCallback(() => {
    if (uid) writeJSON(mergeKey(uid), true);
    setMergeDismissed(true);
  }, [uid]);

  return {
    wardrobe: uid ? cloudW : localW,
    setWardrobe,
    sync: uid ? sync : (authReady ? 'local' : 'loading') as SyncState,
    offerMerge: !!uid && sync !== 'loading' && localCount > 0 && !mergeDismissed,
    localCount,
    mergeLocal,
    dismissMerge,
  };
}
