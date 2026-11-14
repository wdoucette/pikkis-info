import { useRef, useState, type KeyboardEvent } from 'react';
import { Minus, Plus } from 'lucide-react';

export const MAX_OWNED = 9999;
/** Whole number 0–9999 (anything else → nearest valid). */
export const clampOwned = (n: unknown) => {
  const x = Math.floor(Number(n));
  return Number.isFinite(x) ? Math.max(0, Math.min(MAX_OWNED, x)) : 0;
};

/**
 * Owned count editor: − [number] +. Type any 0–9999 (digits only); saves on blur or Enter,
 * Escape reverts, empty becomes 0. Keep this a top-level component so typing survives re-renders.
 */
export default function OwnedInput({ value, onCommit, label, size = 'sm' }: {
  value: number;
  onCommit: (n: number) => void;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancel = useRef(false);
  const owned = value > 0;
  const commit = (n: number) => { const c = clampOwned(n); if (c !== value) onCommit(c); };

  const onBlur = () => {
    if (!cancel.current && draft !== null) commit(draft === '' ? 0 : parseInt(draft, 10));
    cancel.current = false;
    setDraft(null);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel.current = true; e.currentTarget.blur(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const base = draft !== null && draft !== '' ? parseInt(draft, 10) : value;
      setDraft(String(clampOwned(base + (e.key === 'ArrowUp' ? 1 : -1))));
    }
  };

  const dims = size === 'lg'
    ? { btn: 'w-10 h-10', input: 'w-16 h-10 text-base', icon: 'w-4 h-4' }
    : size === 'md'
      ? { btn: 'w-9 h-9', input: 'w-12 h-9 text-sm', icon: 'w-4 h-4' }
      : { btn: 'w-7 h-8', input: 'w-11 h-8 text-xs', icon: 'w-3.5 h-3.5' };
  const tone = owned
    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-200'
    : 'bg-zinc-50 border-zinc-300 dark:bg-zinc-800 dark:border-zinc-600';
  const btn = `${dims.btn} shrink-0 grid place-items-center hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 touch-manipulation`;

  return (
    <div role="group" aria-label={`${label}: owned count`} className={`inline-flex items-stretch shrink-0 rounded-lg border overflow-hidden ${tone}`}>
      <button type="button" className={btn} aria-label={`${label}: one fewer`} disabled={value <= 0} onClick={() => commit(value - 1)}>
        <Minus className={dims.icon} aria-hidden />
      </button>
      <input
        type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off"
        aria-label={`${label}: owned (0 to ${MAX_OWNED})`} title="Type how many you own (0–9999)"
        value={draft ?? String(value)}
        onFocus={e => { setDraft(String(value)); e.currentTarget.select(); }}
        onChange={e => setDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onBlur={onBlur} onKeyDown={onKey}
        className={`${dims.input} text-center font-mono tabular-nums font-semibold bg-transparent border-x border-inherit focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-inset focus:ring-amber-400`}
      />
      <button type="button" className={btn} aria-label={`${label}: one more`} disabled={value >= MAX_OWNED} onClick={() => commit(value + 1)}>
        <Plus className={dims.icon} aria-hidden />
      </button>
    </div>
  );
}
