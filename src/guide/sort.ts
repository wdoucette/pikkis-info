/** Sort keys, labelled exactly like the desktop table headers and in the same order (Want isn't sortable). */
export const COLUMN_SORTS = ['name', 'cat', 'n', 'r', 'status', 'rd', 'rdc', 'rr', 'used', 'owned', 'done'] as const;
export const SORT_LABELS: Record<string, string> = {
  relevance: 'Best match',
  name: 'Item', cat: 'Cat', n: 'No.', r: 'Hearts', status: 'Status',
  rd: 'Req.', rdc: '+Dyes', rr: 'Tree', used: 'Used', owned: 'Owned', done: 'Done',
  waiting: 'Unowned items it crafts',
};
export const sortLabel = (k: string) => SORT_LABELS[k] || k;
