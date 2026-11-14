import { useRef, useState } from 'react';
import { Archive, RotateCcw, Trash2, FileUp } from 'lucide-react';
import { format } from 'date-fns';
import type { User } from '@supabase/supabase-js';
import type { Item, WardrobeData } from '../types';
import { friendlyError } from '../lib/supabase';
import { useArchives, compact } from './useArchives';
import { wardrobeFromCSV, describeImport } from '../guide/wardrobeCsv';

const card = 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-3xl shadow-sm';
const btn = 'shrink-0 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:border-amber-300 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50';

/** Archive (snapshot) the wardrobe, restore or delete snapshots, or replace the wardrobe from a CSV backup. */
export default function ArchivesPanel({ user, items, wardrobe, setWardrobe }: {
  user: User | null;
  items: Item[];
  wardrobe: WardrobeData;
  setWardrobe: (w: WardrobeData) => void;
}) {
  const { archives, create, load, remove } = useArchives(user);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const current = Object.keys(compact(wardrobe)).length;
  const where = user ? 'your account' : 'this browser';

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true); setMsg(null);
    try { const t = await fn(); if (t) setMsg({ ok: true, text: t }); }
    catch (e) { setMsg({ ok: false, text: friendlyError(e) }); }
    finally { setBusy(false); }
  };

  /** Snapshot the current wardrobe before it is replaced (skipped when it is empty). */
  const autoBackup = async (reason: string) => {
    if (current > 0) await create(`Auto-backup before ${reason} (${format(new Date(), 'MMM d, h:mm a')})`, wardrobe);
  };

  const archiveNow = () => {
    if (current === 0) { setMsg({ ok: false, text: 'Your wardrobe is empty, so there is nothing to archive.' }); return; }
    const name = window.prompt('Name this archive:', `Wardrobe ${format(new Date(), 'MMM d, yyyy')}`);
    if (name === null) return;
    run(async () => { await create(name, wardrobe); return `Archived ${current.toLocaleString()} items to ${where}.`; });
  };

  const restore = (id: string, name: string, n: number) => {
    if (!window.confirm(`Replace your current wardrobe (${current.toLocaleString()} items) with “${name}” (${n.toLocaleString()} items)?${current ? ' Your current wardrobe will be archived first.' : ''}`)) return;
    run(async () => {
      const data = await load(id);
      await autoBackup('restore');
      setWardrobe(data);
      return `Restored “${name}”.`;
    });
  };

  const del = (id: string, name: string) => {
    if (!window.confirm(`Delete archive “${name}”? This can't be undone.`)) return;
    run(async () => { await remove(id); return 'Archive deleted.'; });
  };

  const replaceFromCSV = (file: File) => run(async () => {
    const r = wardrobeFromCSV(await file.text(), items, {});
    if (r.error) throw new Error(`CSV: ${r.error}`);
    const n = Object.keys(r.next).length;
    if (!window.confirm(`Clear your current wardrobe (${current.toLocaleString()} items) and load ${n.toLocaleString()} items from “${file.name}”?${current ? ' Your current wardrobe will be archived first.' : ''}\n\nRead: ${describeImport(r)}.`)) return;
    await autoBackup('CSV upload');
    setWardrobe(r.next);
    return `Loaded ${n.toLocaleString()} items from the CSV (${describeImport(r)}).`;
  });

  return (
    <div className={`${card} p-3 sm:p-4 space-y-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-zinc-500 inline-flex items-center gap-1 mr-auto"><Archive className="w-3.5 h-3.5" aria-hidden /> Archives <span className="normal-case tracking-normal">(saved in {where})</span></span>
        <button type="button" className={btn} disabled={busy || !items.length} onClick={archiveNow} title="Save a snapshot of your current wardrobe">
          <Archive className="w-4 h-4" aria-hidden /> Archive current wardrobe
        </button>
        <button type="button" className={btn} disabled={busy || !items.length} onClick={() => fileRef.current?.click()} title="Clear your wardrobe and load a CSV backup (Item, Category, No., Owned, Wanted, Done)">
          <FileUp className="w-4 h-4" aria-hidden /> Replace from CSV backup
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" aria-label="Replace wardrobe from CSV backup"
          onChange={e => { const f = e.target.files?.[0]; if (f) replaceFromCSV(f); e.target.value = ''; }} />
      </div>
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>{msg.text}</p>}
      {archives.length === 0 ? (
        <p className="text-xs text-zinc-500">No archives yet. Archive your wardrobe before big changes so you can roll back.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-56 overflow-y-auto [scrollbar-width:thin]">
          {archives.map(a => (
            <li key={a.id} className="py-2 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{a.name}</div>
                <div className="text-xs text-zinc-500 tabular-nums">{format(new Date(a.created_at), 'MMM d, yyyy h:mm a')} · {a.item_count.toLocaleString()} items</div>
              </div>
              <button type="button" className={btn} disabled={busy} onClick={() => restore(a.id, a.name, a.item_count)} aria-label={`Restore ${a.name}`}>
                <RotateCcw className="w-4 h-4" aria-hidden /> <span className="hidden sm:inline">Restore</span>
              </button>
              <button type="button" className={`${btn} hover:text-red-700 dark:hover:text-red-300`} disabled={busy} onClick={() => del(a.id, a.name)} aria-label={`Delete ${a.name}`}>
                <Trash2 className="w-4 h-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
