export interface Meta {
  nikkicalc_version: string;
  nikkicalc_updated: string;
  generated: string;
  item_count: number;
  credit: string;
  [key: string]: any;
}

export interface CraftItem {
  id: number;
  n?: number | string;
  name?: string;
  q: number;
}

export interface Item {
  id: number;
  n: number;
  name: string;
  cat: string;
  r?: number;
  rd: number;
  rr?: number;
  rdc?: number;
  rrc?: number;
  fut?: number;
  u?: CraftItem[];
  cf?: { id: number; q: number }[];
  ev?: any;
  d?: { n: string; id?: number; name?: string }[];
  o?: string;
  comment?: string;
  used_to_craft_note?: string;
  cannot_decompose?: boolean;
  hidden?: boolean;
  edited?: string[];
  [key: string]: any;
}

export interface WardrobeEntry {
  owned: number;
  done: boolean;
  /** On the wishlist (only meaningful while not owned). */
  wanted?: boolean;
}

export interface WardrobeData {
  [key: string]: WardrobeEntry;
}
