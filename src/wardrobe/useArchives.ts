import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { WardrobeData } from '../types';
import { isEmptyEntry } from './useWardrobe';

export interface ArchiveMeta { id: string; name: string; item_count: number; created_at: string }
interface LocalArchive extends ArchiveMeta { data: WardrobeData }

const LOCAL_KEY = 'pikkis-wardrobe-archives';
const MAX_LOCAL = 10;

function readLocal(): LocalArchive[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as LocalArchive[]; } catch { return []; }
}
function writeLocal(a: LocalArchive[]) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(a)); }
  catch { throw new Error('This browser is out of storage space. Delete an archive or sign in to save it to your account.'); }
}

/** Drop empty entries so snapshots stay small. */
export function compact(w: WardrobeData): WardrobeData {
  const out: WardrobeData = {};
  for (const [id, e] of Object.entries(w)) {
    if (isEmptyEntry(e)) continue;
    out[id] = { owned: e.owned || 0, done: !!e.done, ...(e.wanted && !(e.owned > 0) ? { wanted: true } : {}) };
  }
  return out;
}

/** Wardrobe snapshots: Supabase (owner-only RLS) when signed in, this browser otherwise. */
export function useArchives(user: User | null) {
  const uid = user?.id ?? null;
  const [archives, setArchives] = useState<ArchiveMeta[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!uid) { setArchives(readLocal().map(({ data: _d, ...m }) => m)); return; }
    setLoading(true);
    const { data, error } = await supabase.from('wardrobe_archives').select('id,name,item_count,created_at')
      .eq('user_id', uid).order('created_at', { ascending: false });
    setLoading(false);
    if (error) { console.warn('Archives load failed', error.message); return; }
    setArchives(data as ArchiveMeta[]);
  }, [uid]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (name: string, wardrobe: WardrobeData) => {
    const data = compact(wardrobe);
    const item_count = Object.keys(data).length;
    const clean = name.trim().slice(0, 80) || 'Wardrobe backup';
    if (!uid) {
      const all = readLocal();
      if (all.length >= MAX_LOCAL) throw new Error(`This browser keeps up to ${MAX_LOCAL} archives. Delete an old one first, or sign in.`);
      writeLocal([{ id: crypto.randomUUID(), name: clean, item_count, created_at: new Date().toISOString(), data }, ...all]);
    } else {
      const { error } = await supabase.from('wardrobe_archives').insert({ user_id: uid, name: clean, item_count, data });
      if (error) throw error;
    }
    await refresh();
  }, [uid, refresh]);

  const load = useCallback(async (id: string): Promise<WardrobeData> => {
    if (!uid) {
      const a = readLocal().find(x => x.id === id);
      if (!a) throw new Error('Archive not found.');
      return a.data;
    }
    const { data, error } = await supabase.from('wardrobe_archives').select('data').eq('id', id).single();
    if (error) throw error;
    return (data?.data || {}) as WardrobeData;
  }, [uid]);

  const remove = useCallback(async (id: string) => {
    if (!uid) writeLocal(readLocal().filter(x => x.id !== id));
    else {
      const { error } = await supabase.from('wardrobe_archives').delete().eq('id', id);
      if (error) throw error;
    }
    await refresh();
  }, [uid, refresh]);

  return { archives, loading, create, load, remove, refresh };
}
