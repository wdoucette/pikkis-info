import type { Item, WardrobeData } from '../types';

export const STATUSES = ['Extra clothes', 'Still needed', 'Cannot decompose', 'Not owned'] as const;
export type Status = (typeof STATUSES)[number];

/** What the UI shows for a status value. The value 'Still needed' stays for URLs, filters and saved views. */
export const STATUS_LABELS: Record<string, string> = { 'Still needed': 'Used to craft' };
export const statusLabel = (status: string) => STATUS_LABELS[status] || status;
/** Badge text, e.g. "Used to craft: 3 items" for a Still needed item. */
export function statusText(status: string, waiting?: number): string {
  if (status === 'Still needed' && waiting) return `Used to craft: ${waiting} item${waiting === 1 ? '' : 's'}`;
  return statusLabel(status);
}

export interface DerivedInfo {
  status: Status;
  /** Unowned products (recipes + evolutions) this item is still needed for. */
  waiting: number;
  owned: number;
  done: boolean;
}

/** Product ids an item feeds into: recipe products (u) plus evolution targets (ev.to). */
export function productIds(item: Item): number[] {
  const ids = new Set<number>();
  for (const u of item.u || []) ids.add(u.id);
  const to = item.ev?.to;
  if (Array.isArray(to)) for (const t of to) if (t && typeof t.id === 'number') ids.add(t.id);
  return Array.from(ids);
}

/**
 * Paige's Items-tab logic: Cannot decompose > Not owned > Still needed (waiting on an
 * unowned product) > Extra clothes. Recolours never flip an item to Still needed.
 */
export function deriveInfo(item: Item, wardrobe: WardrobeData): DerivedInfo {
  const w = wardrobe[item.id];
  const owned = w?.owned || 0;
  const done = !!w?.done;
  let waiting = 0;
  for (const id of productIds(item)) if (!(wardrobe[id]?.owned > 0)) waiting++;
  let status: Status;
  if (item.cannot_decompose) status = 'Cannot decompose';
  else if (owned <= 0) status = 'Not owned';
  else if (waiting > 0) status = 'Still needed';
  else status = 'Extra clothes';
  return { status, waiting, owned, done };
}
