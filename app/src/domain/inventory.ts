// Inventory — the food sitting on shelves. Kept separate from the kitchen layout
// (data-model.md keeps inventory_items apart from kitchen_zones): an item points at
// a shelf by id. Coarse four-state quantity (full/half/low/gone) is deliberate —
// one-second input (requirements §6.3). Expiry is an optional yyyy-mm-dd; freezer
// shelves omit it (the clock is paused).
//
// Pure + framework-free so it's unit-testable in isolation.

// "gone" isn't a state — an item that's used up is removed (X) instead.
import { normalizeName } from "./normalize";

export type QuantityState = "full" | "half" | "low";

export const QUANTITY_STATES: QuantityState[] = ["full", "half", "low"];

export function quantityLabel(q: QuantityState): string {
  return q === "half" ? "½" : q.charAt(0).toUpperCase() + q.slice(1);
}

// How an item's amount is expressed: coarse level (default) or a numeric count.
export type MeasureMode = "level" | "count";

// The unit a size is in. Deliberately tiny — discrete + weight, no volume/conversion.
export type UnitKind = "unit" | "oz" | "lb";

// A package/each size, independent of how much is left. e.g. { amount: 128, unit: "oz" }.
export interface ItemSize {
  amount: number;
  unit: UnitKind;
}

export interface InventoryItem {
  id: string;
  shelfId: string; // a Shelf id from the kitchen layout
  name: string;
  quantity: QuantityState;
  expiresAt?: string; // yyyy-mm-dd; absent = no expiry clock
  category?: string; // filled on save (auto or manual); absent = needs one
  color?: string; // optional swatch (hex)
  measure?: MeasureMode; // absent = "level" (the default)
  count?: number; // used when measure === "count"
  size?: ItemSize; // package/each size, independent of amount-left
  addedAt: string; // ISO timestamp
}

export type SortBy = "name" | "expiry";

// Sort a shelf's items for display (does not mutate). Expiry: soonest first,
// undated last; name tie-break either way.
export function sortItems(items: InventoryItem[], by: SortBy): InventoryItem[] {
  const copy = [...items];
  if (by === "name") {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    copy.sort((a, b) => {
      const ax = a.expiresAt ?? "9999-12-31";
      const bx = b.expiresAt ?? "9999-12-31";
      return ax === bx ? a.name.localeCompare(b.name) : ax < bx ? -1 : 1;
    });
  }
  return copy;
}

// Urgency buckets for the Expiry view. Dated items split by days-left; undated
// (level items with no date, freezer items) go to their own group.
export interface ExpiryBuckets {
  now: InventoryItem[]; // expired or due today (≤0)
  soon: InventoryItem[]; // 1–3 days
  week: InventoryItem[]; // 4–7 days
  later: InventoryItem[]; // 8+ days
  undated: InventoryItem[];
}

export function expiryBuckets(items: InventoryItem[], now: Date = new Date()): ExpiryBuckets {
  const b: ExpiryBuckets = { now: [], soon: [], week: [], later: [], undated: [] };
  for (const i of items) {
    if (!i.expiresAt) {
      b.undated.push(i);
      continue;
    }
    const d = daysUntil(i.expiresAt, now);
    if (d <= 0) b.now.push(i);
    else if (d <= 3) b.soon.push(i);
    else if (d <= 7) b.week.push(i);
    else b.later.push(i);
  }
  const byDate = (a: InventoryItem, c: InventoryItem) =>
    (a.expiresAt ?? "").localeCompare(c.expiresAt ?? "");
  b.now.sort(byDate);
  b.soon.sort(byDate);
  b.week.sort(byDate);
  b.later.sort(byDate);
  b.undated.sort((a, c) => a.name.localeCompare(c.name));
  return b;
}

// Reorder the whole inventory so each shelf's items are sorted (applied on save).
// Shelves keep their first-seen grouping; only within-shelf order changes.
export function sortInventory(inv: Inventory, by: SortBy): Inventory {
  const groups = new Map<string, InventoryItem[]>();
  for (const i of inv.items) {
    const arr = groups.get(i.shelfId);
    if (arr) arr.push(i);
    else groups.set(i.shelfId, [i]);
  }
  const out: InventoryItem[] = [];
  for (const arr of groups.values()) out.push(...sortItems(arr, by));
  return { items: out };
}

export interface Inventory {
  items: InventoryItem[];
}

export function emptyInventory(): Inventory {
  return { items: [] };
}

function uid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Whole days from `now` until the expiry date (negative = already expired).
export function daysUntil(expiresAt: string, now: Date = new Date()): number {
  const exp = Date.parse(`${expiresAt}T00:00:00`);
  if (Number.isNaN(exp)) return NaN;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((exp - today) / 86_400_000);
}

export function itemsForShelf(inv: Inventory, shelfId: string): InventoryItem[] {
  return inv.items.filter((i) => i.shelfId === shelfId);
}

// ---------- immutable updates ----------

export function addItem(
  inv: Inventory,
  shelfId: string,
  input: {
    name: string;
    quantity?: QuantityState;
    expiresAt?: string;
    color?: string;
    measure?: MeasureMode;
    count?: number;
    size?: ItemSize;
  },
): Inventory {
  const item: InventoryItem = {
    id: uid(),
    shelfId,
    name: input.name.trim(),
    quantity: input.quantity ?? "full",
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    ...(input.color ? { color: input.color } : {}),
    ...(input.measure === "count" ? { measure: "count" as const, count: input.count ?? 1 } : {}),
    ...(input.size ? { size: input.size } : {}),
    addedAt: new Date().toISOString(),
  };
  return { items: [...inv.items, item] };
}

function mapItem(inv: Inventory, itemId: string, fn: (i: InventoryItem) => InventoryItem): Inventory {
  return { items: inv.items.map((i) => (i.id === itemId ? fn(i) : i)) };
}

export function setQuantity(inv: Inventory, itemId: string, quantity: QuantityState): Inventory {
  return mapItem(inv, itemId, (i) => ({ ...i, quantity }));
}

export function renameItem(inv: Inventory, itemId: string, name: string): Inventory {
  return mapItem(inv, itemId, (i) => ({ ...i, name }));
}

// Pass a date to set it, or undefined to clear it.
export function setExpiry(inv: Inventory, itemId: string, expiresAt?: string): Inventory {
  return mapItem(inv, itemId, (i) => {
    const { expiresAt: _drop, ...rest } = i;
    return expiresAt ? { ...rest, expiresAt } : rest;
  });
}

// Pass a category to set it, or undefined/blank to clear it.
export function setCategory(inv: Inventory, itemId: string, category?: string): Inventory {
  return mapItem(inv, itemId, (i) => {
    const { category: _drop, ...rest } = i;
    return category && category.trim() ? { ...rest, category } : rest;
  });
}

// Pass a color to set it, or undefined to clear it.
export function setColor(inv: Inventory, itemId: string, color?: string): Inventory {
  return mapItem(inv, itemId, (i) => {
    const { color: _drop, ...rest } = i;
    return color ? { ...rest, color } : rest;
  });
}

// Switch how an item is measured. → count defaults the count to 1; → level drops
// the measure field (level is the default) but keeps the count for an easy switch back.
export function setMeasure(inv: Inventory, itemId: string, measure: MeasureMode): Inventory {
  return mapItem(inv, itemId, (i) => {
    if (measure === "count") return { ...i, measure: "count", count: i.count ?? 1 };
    const { measure: _drop, ...rest } = i;
    return rest;
  });
}

export function setCount(inv: Inventory, itemId: string, count: number): Inventory {
  return mapItem(inv, itemId, (i) => ({
    ...i,
    measure: "count",
    count: Math.min(999, Math.max(1, Math.round(count))),
  }));
}

// Set or clear the package/each size (independent of amount-left).
export function setSize(inv: Inventory, itemId: string, size?: ItemSize): Inventory {
  return mapItem(inv, itemId, (i) => {
    const { size: _drop, ...rest } = i;
    return size ? { ...rest, size } : rest;
  });
}

export function removeItem(inv: Inventory, itemId: string): Inventory {
  return { items: inv.items.filter((i) => i.id !== itemId) };
}

// Teach name → color from items that have one (overwrite), so the same item
// auto-colors when added later.
export function learnColors(
  inv: Inventory,
  learned: Record<string, string>,
): Record<string, string> {
  const next = { ...learned };
  for (const i of inv.items) {
    const key = normalizeName(i.name);
    if (i.color && key) next[key] = i.color;
  }
  return next;
}

export function colorForName(name: string, learned: Record<string, string>): string | undefined {
  return learned[normalizeName(name)];
}

// Teach name → unit for counted items (stores the unit, so re-adds auto-count in
// the right unit); level items clear their entry (absence = level).
export function learnMeasures(
  inv: Inventory,
  learned: Record<string, string>,
): Record<string, string> {
  const next = { ...learned };
  for (const i of inv.items) {
    const key = normalizeName(i.name);
    if (!key) continue;
    if (i.measure === "count") next[key] = "count";
    else delete next[key];
  }
  return next;
}

export function measureForName(name: string, learned: Record<string, string>): MeasureMode {
  return learned[normalizeName(name)] === "count" ? "count" : "level";
}

// Teach name → size (overwrite), so a re-added item gets its remembered size.
export function learnSizes(
  inv: Inventory,
  learned: Record<string, ItemSize>,
): Record<string, ItemSize> {
  const next = { ...learned };
  for (const i of inv.items) {
    const key = normalizeName(i.name);
    if (i.size && key) next[key] = i.size;
  }
  return next;
}

export function sizeForName(name: string, learned: Record<string, ItemSize>): ItemSize | undefined {
  return learned[normalizeName(name)];
}

// ---------- persistence migration ----------

/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizeInventory(raw: any): Inventory {
  if (!raw || !Array.isArray(raw.items)) return emptyInventory();
  const items: InventoryItem[] = raw.items
    // Drop legacy "gone" items — that state no longer exists (removed via X).
    .filter((i: any) => i && typeof i.shelfId === "string" && i.quantity !== "gone")
    .map((i: any): InventoryItem => ({
      id: String(i.id ?? uid()),
      shelfId: String(i.shelfId),
      name: String(i.name ?? ""),
      quantity: QUANTITY_STATES.includes(i.quantity) ? i.quantity : "full",
      ...(i.expiresAt ? { expiresAt: String(i.expiresAt) } : {}),
      ...(i.category ? { category: String(i.category) } : {}),
      ...(i.color ? { color: String(i.color) } : {}),
      ...(i.measure === "count"
        ? { measure: "count" as const, count: typeof i.count === "number" ? i.count : 1 }
        : {}),
      ...(i.size && typeof i.size.amount === "number"
        ? {
            size: {
              amount: i.size.amount,
              unit: i.size.unit === "oz" || i.size.unit === "lb" ? i.size.unit : ("unit" as const),
            } as ItemSize,
          }
        : {}),
      addedAt: String(i.addedAt ?? new Date().toISOString()),
    }));
  return { items };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
