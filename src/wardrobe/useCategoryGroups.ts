import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { allGroups, BUILTIN_GROUPS, normGroup, type CategoryGroup } from '../guide/groups';

const LOCAL_KEY = 'pikkis-category-groups';
function readLocal(): CategoryGroup[] {
  try { const v = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function writeLocal(v: CategoryGroup[]) {
  try { if (v.length) localStorage.setItem(LOCAL_KEY, JSON.stringify(v)); else localStorage.removeItem(LOCAL_KEY); } catch { /* ignore */ }
}
interface Row { id: string; name: string; cats: string[] }

function validate(name: string, cats: string[], others: CategoryGroup[]) {
  const n = name.trim();
  if (!n) throw new Error('Give the group a name.');
  if (n.length > 40) throw new Error('Group names can be up to 40 characters.');
  if (!cats.length) throw new Error('Pick at least one category.');
  if (BUILTIN_GROUPS.some(g => normGroup(g.name) === normGroup(n))) throw new Error(`“${n}” is a built-in group. Pick another name.`);
  if (others.some(g => normGroup(g.name) === normGroup(n))) throw new Error(`You already have a group called “${n}”.`);
  return n;
}

/**
 * Custom category groups. Signed in: Supabase `category_groups` (owner-only). Signed out: this
 * browser, uploaded to the account on the next sign-in.
 */
export function useCategoryGroups(userId: string | null, authReady = true) {
  const [custom, setCustom] = useState<CategoryGroup[]>([]);

  const reload = useCallback(async () => {
    if (!authReady) return;
    if (!userId) { setCustom(readLocal()); return; }
    const local = readLocal();
    if (local.length) {
      // One by one so a name clash (23505) doesn't block the rest.
      let ok = true;
      for (const g of local) {
        const { error } = await supabase.from('category_groups').insert({ user_id: userId, name: g.name, cats: g.cats });
        if (error && error.code !== '23505') { ok = false; console.warn('Could not upload browser group', error.message); }
      }
      if (ok) writeLocal([]);
    }
    const { data, error } = await supabase.from('category_groups').select('id,name,cats').eq('user_id', userId).order('name');
    if (error) { console.warn('Category groups load failed', error.message); return; }
    setCustom((data as Row[]).map(r => ({ id: r.id, name: r.name, cats: r.cats })));
  }, [userId, authReady]);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (g: { id?: string; name: string; cats: string[] }) => {
    const name = validate(g.name, g.cats, custom.filter(x => x.id !== g.id));
    const cats = Array.from(new Set(g.cats)).sort();
    if (!userId) {
      const list = readLocal();
      const next = g.id ? list.map(x => (x.id === g.id ? { ...x, name, cats } : x))
        : [...list, { id: `local-${Date.now().toString(36)}`, name, cats }];
      writeLocal(next); setCustom(next); return;
    }
    const q = g.id
      ? supabase.from('category_groups').update({ name, cats }).eq('id', g.id)
      : supabase.from('category_groups').insert({ user_id: userId, name, cats });
    const { error } = await q;
    if (error) throw error.code === '23505' ? new Error(`You already have a group called “${name}”.`) : error;
    await reload();
  }, [userId, custom, reload]);

  const remove = useCallback(async (id: string) => {
    if (!userId || id.startsWith('local-')) {
      const next = readLocal().filter(x => x.id !== id);
      writeLocal(next); setCustom(next); return;
    }
    const { error } = await supabase.from('category_groups').delete().eq('id', id);
    if (error) throw error;
    setCustom(prev => prev.filter(x => x.id !== id));
  }, [userId]);

  const groups = useMemo(() => allGroups(custom), [custom]);
  return { groups, custom, save, remove };
}
