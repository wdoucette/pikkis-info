import { useCallback, useEffect, useState } from 'react';
import { supabase, type Collection } from '../lib/supabase';

/** Guide URL params that make up a saved view. */
export const FILTER_KEYS = ['q', 'cat', 'status', 'sort', 'dir', 'size'] as const;

export function filterStateFrom(params: URLSearchParams): Record<string, string> {
  const s: Record<string, string> = {};
  for (const k of FILTER_KEYS) { const v = params.get(k); if (v) s[k] = v; }
  return s;
}
export function collectionHref(c: Pick<Collection, 'filter_state'>): string {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) { const v = c.filter_state?.[k]; if (typeof v === 'string' && v) p.set(k, v); }
  const qs = p.toString();
  return qs ? `/?${qs}` : '/';
}
export function describeFilter(f: Record<string, string>): string {
  const parts: string[] = [];
  if (f.q) parts.push(`“${f.q}”`);
  if (f.cat) parts.push(f.cat);
  if (f.status) parts.push(f.status);
  if (f.sort) parts.push(`by ${f.sort}${f.dir === 'desc' ? ' ↓' : ''}`);
  return parts.join(' · ') || 'All items';
}

export function useCollections(userId: string | null) {
  const [items, setItems] = useState<Collection[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) { setItems([]); setLoaded(true); return; }
    const { data, error } = await supabase.from('collections').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) console.warn('Collections load failed', error.message);
    setItems((data as Collection[]) || []);
    setLoaded(true);
  }, [userId]);

  useEffect(() => { setLoaded(false); reload(); }, [reload]);

  const save = useCallback(async (name: string, filter_state: Record<string, string>, description?: string) => {
    if (!userId) throw new Error('Sign in to save collections');
    const { data, error } = await supabase.from('collections')
      .insert({ user_id: userId, name: name.trim().slice(0, 80), filter_state, description: description?.trim() || null })
      .select('*').single();
    if (error) throw error;
    setItems(prev => [data as Collection, ...prev]);
    return data as Collection;
  }, [userId]);

  const update = useCallback(async (id: string, patch: Partial<Pick<Collection, 'name' | 'description' | 'is_public'>>) => {
    const { data, error } = await supabase.from('collections').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    setItems(prev => prev.map(c => (c.id === id ? (data as Collection) : c)));
  }, []);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('collections').delete().eq('id', id);
    if (error) throw error;
    setItems(prev => prev.filter(c => c.id !== id));
  }, []);

  return { collections: items, loaded, reload, save, update, remove };
}
