import { useCallback, useEffect, useState } from 'react';
import { supabase, type Collection } from '../lib/supabase';
import { statusLabel } from '../guide/status';

/** Guide URL params that make up a saved view. */
export const FILTER_KEYS = ['q', 'group', 'cat', 'status', 'sort', 'dir', 'size'] as const;

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
  if (f.group) parts.push(`group: ${f.group.replace(/-/g, ' ')}`);
  if (f.cat) parts.push(f.cat);
  if (f.status) parts.push(statusLabel(f.status));
  if (f.sort) parts.push(`by ${f.sort}${f.dir === 'desc' ? ' ↓' : ''}`);
  return parts.join(' · ') || 'All items';
}

const LOCAL_VIEWS = 'pikkis-local-views';
function readLocal(): Collection[] {
  try { const v = JSON.parse(localStorage.getItem(LOCAL_VIEWS) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function writeLocal(v: Collection[]) {
  try { if (v.length) localStorage.setItem(LOCAL_VIEWS, JSON.stringify(v)); else localStorage.removeItem(LOCAL_VIEWS); } catch { /* ignore */ }
}

/**
 * Saved views. Signed in: Supabase `collections`. Signed out: kept in this browser and
 * uploaded to the account automatically on the next sign-in.
 */
export function useCollections(userId: string | null, authReady = true) {
  const [items, setItems] = useState<Collection[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!authReady) return;
    if (!userId) { setItems(readLocal()); setLoaded(true); return; }
    const local = readLocal();
    if (local.length) {
      const { error } = await supabase.from('collections').insert(local.map(c => ({
        user_id: userId, name: c.name, description: c.description, filter_state: c.filter_state || {},
      })));
      if (!error) writeLocal([]); else console.warn('Could not upload browser views', error.message);
    }
    const { data, error } = await supabase.from('collections').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) console.warn('Collections load failed', error.message);
    setItems((data as Collection[]) || []);
    setLoaded(true);
  }, [userId, authReady]);

  useEffect(() => { setLoaded(false); reload(); }, [reload]);

  const save = useCallback(async (name: string, filter_state: Record<string, string>, description?: string) => {
    if (!userId) {
      const c: Collection = {
        id: `local-${Date.now().toString(36)}`, user_id: 'local', name: name.trim().slice(0, 80),
        description: description?.trim() || null, filter_state, is_public: false, created_at: new Date().toISOString(),
      };
      const next = [c, ...readLocal()];
      writeLocal(next); setItems(next);
      return c;
    }
    const { data, error } = await supabase.from('collections')
      .insert({ user_id: userId, name: name.trim().slice(0, 80), filter_state, description: description?.trim() || null })
      .select('*').single();
    if (error) throw error;
    setItems(prev => [data as Collection, ...prev]);
    return data as Collection;
  }, [userId]);

  const update = useCallback(async (id: string, patch: Partial<Pick<Collection, 'name' | 'description' | 'is_public'>>) => {
    if (id.startsWith('local-')) {
      const next = readLocal().map(c => (c.id === id ? { ...c, ...patch, is_public: false } : c));
      writeLocal(next); setItems(next); return;
    }
    const { data, error } = await supabase.from('collections').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    setItems(prev => prev.map(c => (c.id === id ? (data as Collection) : c)));
  }, []);

  const remove = useCallback(async (id: string) => {
    if (id.startsWith('local-')) {
      const next = readLocal().filter(c => c.id !== id);
      writeLocal(next); setItems(next); return;
    }
    const { error } = await supabase.from('collections').delete().eq('id', id);
    if (error) throw error;
    setItems(prev => prev.filter(c => c.id !== id));
  }, []);

  return { collections: items, loaded, reload, save, update, remove };
}
