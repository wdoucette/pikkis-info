import { useEffect, useState } from 'react';
import { X, Plus, Pencil, Trash2, Copy, Lock } from 'lucide-react';
import { friendlyError } from '../lib/supabase';
import { groupSlug, type CategoryGroup } from '../guide/groups';
import { useGroups } from './CategoryGroupsContext';

const btn = 'h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-amber-400 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50';

/** Create, rename, edit and delete category groups. Built-ins are read-only (but can be copied). */
export default function CategoryGroupsDialog({ open, onClose, allCats, signedIn, onUse }: {
  open: boolean;
  onClose: () => void;
  allCats: string[];
  signedIn: boolean;
  onUse: (g: CategoryGroup) => void;
}) {
  const { groups, save, remove } = useGroups();
  const [edit, setEdit] = useState<{ id?: string; name: string; cats: Set<string> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (!open) { setEdit(null); setErr(null); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;

  const doSave = async () => {
    if (!edit) return;
    setBusy(true); setErr(null);
    try { await save({ id: edit.id, name: edit.name, cats: Array.from(edit.cats) }); setEdit(null); }
    catch (e) { setErr(friendlyError(e)); }
    finally { setBusy(false); }
  };
  const doDelete = async (g: CategoryGroup) => {
    if (!window.confirm(`Delete the group “${g.name}”? Saved views that use it will show all categories instead.`)) return;
    setBusy(true); setErr(null);
    try { await remove(g.id); } catch (e) { setErr(friendlyError(e)); } finally { setBusy(false); }
  };
  const toggle = (c: string) => setEdit(e => {
    if (!e) return e;
    const cats = new Set(e.cats);
    if (cats.has(c)) cats.delete(c); else cats.add(c);
    return { ...e, cats };
  });
  const known = new Set(allCats);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-labelledby="groups-title"
        className="relative w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 id="groups-title" className="font-display text-2xl text-zinc-900 dark:text-zinc-50">Category groups</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 grid place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Pick a group to see only its categories, or type <code>cat:accessories</code> (or <code>group:accessories</code>) in search.
          Your groups are saved {signedIn ? 'to your account' : 'in this browser (sign in to keep them in your account)'}.
        </p>

        {edit ? (
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="block mb-1 text-zinc-600 dark:text-zinc-300">Group name</span>
              <input autoFocus value={edit.name} maxLength={40} onChange={e => setEdit({ ...edit, name: e.target.value })}
                className="w-full h-10 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-amber-400 text-sm" placeholder="e.g. Hand stuff" />
            </label>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-500 mr-auto">{edit.cats.size} of {allCats.length} categories</span>
              <button type="button" className={btn} onClick={() => setEdit({ ...edit, cats: new Set(allCats) })}>Select all</button>
              <button type="button" className={btn} onClick={() => setEdit({ ...edit, cats: new Set() })}>Clear</button>
            </div>
            <fieldset className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              <legend className="sr-only">Categories in this group</legend>
              {allCats.map(c => (
                <label key={c} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-sm cursor-pointer ${edit.cats.has(c) ? 'border-amber-400 bg-amber-50 dark:bg-amber-950' : 'border-zinc-200 dark:border-zinc-700'}`}>
                  <input type="checkbox" checked={edit.cats.has(c)} onChange={() => toggle(c)} className="accent-amber-600" />
                  <span className="truncate">{c}</span>
                </label>
              ))}
            </fieldset>
            {err && <p className="text-sm text-red-700 dark:text-red-300">{err}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className={btn} onClick={() => { setEdit(null); setErr(null); }}>Cancel</button>
              <button type="button" disabled={busy} onClick={doSave} className="h-8 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-60">
                {busy ? 'Saving…' : 'Save group'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {groups.map(g => (
                <li key={g.id} className="py-2.5 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold flex items-center gap-1.5">
                      {g.name}
                      {g.builtin && <span className="inline-flex items-center gap-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded px-1.5 py-px"><Lock className="w-2.5 h-2.5" aria-hidden />Built-in</span>}
                      <code className="text-[11px] font-normal text-zinc-500">cat:{groupSlug(g)}</code>
                    </div>
                    <div className="text-xs text-zinc-500 line-clamp-2" title={g.cats.join(', ')}>
                      {g.cats.length} categories: {g.cats.map(c => known.has(c) || !allCats.length ? c : `${c} (not in data)`).join(', ')}
                    </div>
                  </div>
                  <button type="button" className={btn} onClick={() => { onUse(g); onClose(); }}>Use</button>
                  {g.builtin ? (
                    <button type="button" className={btn} aria-label={`Copy ${g.name}`} title="Copy into a new group you can edit"
                      onClick={() => setEdit({ name: `My ${g.name.toLowerCase()}`, cats: new Set(g.cats) })}><Copy className="w-3.5 h-3.5" /></button>
                  ) : (
                    <>
                      <button type="button" className={btn} aria-label={`Edit ${g.name}`} onClick={() => setEdit({ id: g.id, name: g.name, cats: new Set(g.cats) })}><Pencil className="w-3.5 h-3.5" /></button>
                      <button type="button" className={`${btn} hover:text-red-700`} aria-label={`Delete ${g.name}`} disabled={busy} onClick={() => doDelete(g)}><Trash2 className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            {err && <p className="text-sm text-red-700 dark:text-red-300 mt-2">{err}</p>}
            <button type="button" onClick={() => setEdit({ name: '', cats: new Set() })}
              className="mt-3 h-10 w-full rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-amber-400 text-sm font-semibold inline-flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" aria-hidden /> New group
            </button>
          </>
        )}
      </div>
    </div>
  );
}
