/**
 * Category groups: named sets of wardrobe categories, usable as cat:accessories / group:accessories
 * in search and from the group picker. Built-ins live here; users can add their own (useCategoryGroups).
 * Category names must match the `cat` values in pikkis-info-data exactly.
 */
export interface CategoryGroup {
  id: string;
  name: string;
  cats: string[];
  builtin?: boolean;
  description?: string;
}

export const BUILTIN_GROUPS: CategoryGroup[] = [
  {
    id: 'accessories', name: 'Accessories', builtin: true,
    description: 'Every accessory slot',
    cats: [
      'Background', 'Foreground', 'Tail', 'Wings', 'Ground', 'Head ornament', 'Tattoo', 'Brooch',
      'Face accessory', 'Skin', 'Waist', 'Both handheld', 'Left handheld', 'Right handheld', 'Gloves',
      'Left hand ornament', 'Right hand ornament', 'Necklace', 'Scarf', 'Earring', 'Ear', 'Hairpin',
      'Veil', 'Hair ornament',
    ],
  },
  {
    id: 'clothing', name: 'Clothing', builtin: true,
    description: 'Main clothing slots',
    cats: ['Hair', 'Dress', 'Coat', 'Top', 'Bottom', 'Hosiery', 'Shoes', 'Makeup'],
  },
];

export const normGroup = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** URL/search key for a group: "accessories", "my-cosy-set". */
export const groupSlug = (g: Pick<CategoryGroup, 'name'>) => normGroup(g.name).replace(/ /g, '-');

/** Built-ins first, then custom groups whose names don't clash with a built-in. */
export function allGroups(custom: CategoryGroup[]): CategoryGroup[] {
  const taken = new Set(BUILTIN_GROUPS.map(g => normGroup(g.name)));
  return [...BUILTIN_GROUPS, ...custom.filter(g => !taken.has(normGroup(g.name)))];
}

export function findGroup(groups: CategoryGroup[], key: string): CategoryGroup | undefined {
  const k = normGroup(key.replace(/-/g, ' '));
  return k ? groups.find(g => normGroup(g.name) === k || g.id === key) : undefined;
}
