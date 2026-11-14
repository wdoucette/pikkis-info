import { createContext, useContext, type ReactNode } from 'react';
import { useCategoryGroups } from './useCategoryGroups';
import { BUILTIN_GROUPS } from '../guide/groups';

type Ctx = ReturnType<typeof useCategoryGroups>;
const C = createContext<Ctx>({ groups: BUILTIN_GROUPS, custom: [], save: async () => {}, remove: async () => {} });

export function CategoryGroupsProvider({ userId, ready, children }: { userId: string | null; ready: boolean; children: ReactNode }) {
  const v = useCategoryGroups(userId, ready);
  return <C.Provider value={v}>{children}</C.Provider>;
}
export const useGroups = () => useContext(C);
