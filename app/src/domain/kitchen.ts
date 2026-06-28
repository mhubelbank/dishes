// Kitchen storage layout — the user-defined map the Kitchen › Map screen renders
// from (requirements §7.4, §7.12). Richer than data-model.md's flat kitchen_zones
// sketch: a hierarchy of Unit (appliance) → Compartment → Column → Shelf. Most
// compartments have a single column (a plain vertical shelf stack); a pantry can
// hold several side-by-side columns, each with its own variable shelves. Freezer
// compartments pause the expiry clock (data-model invariant).
//
// Pure + framework-free so it's unit-testable in isolation; the React layer and
// the persistence client never leak in here.

export type UnitType = "fridge" | "fridge_freezer" | "chest_freezer" | "pantry";

// fridge_freezer only: how the two compartments sit relative to each other.
export type Arrangement = "fridge_top" | "freezer_top" | "side_by_side";

export type CompartmentKind = "fridge" | "freezer" | "fridge_door" | "pantry";

export interface Shelf {
  id: string;
  label: string;
}

export interface Column {
  id: string;
  shelves: Shelf[];
}

export interface Compartment {
  id: string;
  kind: CompartmentKind;
  label: string;
  pausesExpiry: boolean; // true for freezer kinds — no expiry clock on its items
  // Always ≥1. One column renders as a plain shelf stack; multiple render
  // side-by-side (used for wide pantries).
  columns: Column[];
}

export interface StorageUnit {
  id: string;
  type: UnitType;
  name: string;
  arrangement?: Arrangement; // fridge_freezer only
  // Order is meaningful: top→bottom when stacked, left→right when side-by-side.
  compartments: Compartment[];
}

export interface KitchenLayout {
  units: StorageUnit[];
}

export function emptyLayout(): KitchenLayout {
  return { units: [] };
}

// Flatten the layout to a shelf-id → location lookup (for the Expiry view, etc.).
export interface ShelfLocation {
  unit: string;
  compartment: string;
  shelf: string;
}

export function shelfLocations(layout: KitchenLayout): Record<string, ShelfLocation> {
  const out: Record<string, ShelfLocation> = {};
  for (const u of layout.units) {
    for (const c of u.compartments) {
      for (const col of c.columns) {
        for (const s of col.shelves) {
          out[s.id] = { unit: u.name, compartment: c.label, shelf: s.label };
        }
      }
    }
  }
  return out;
}

// Browser and Node 18+ both expose a global crypto.randomUUID; the fallback keeps
// non-secure contexts and odd test runners working (ids only need to be unique).
function uid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- display labels ----------

export function unitTypeLabel(t: UnitType): string {
  switch (t) {
    case "fridge":
      return "Fridge";
    case "fridge_freezer":
      return "Fridge / freezer";
    case "chest_freezer":
      return "Chest freezer";
    case "pantry":
      return "Pantry";
  }
}

export function arrangementLabel(a: Arrangement): string {
  switch (a) {
    case "fridge_top":
      return "Fridge on top";
    case "freezer_top":
      return "Freezer on top";
    case "side_by_side":
      return "Side-by-side";
  }
}

// ---------- construction ----------

function shelf(label: string): Shelf {
  return { id: uid(), label };
}

function column(shelves: Shelf[]): Column {
  return { id: uid(), shelves };
}

function compartment(kind: CompartmentKind, label: string, firstShelf = "Shelf 1"): Compartment {
  return {
    id: uid(),
    kind,
    label,
    pausesExpiry: kind === "freezer",
    columns: [column([shelf(firstShelf)])],
  };
}

// Build a new unit with sensible starter compartments (each with one column and
// one shelf the user can rename, plus add/remove more). fridge_freezer compartment
// ORDER follows the arrangement so the renderer can lay them out top→bottom /
// left→right.
export function createUnit(
  type: UnitType,
  opts: { name?: string; arrangement?: Arrangement } = {},
): StorageUnit {
  const id = uid();
  const name = opts.name?.trim() || unitTypeLabel(type);

  switch (type) {
    case "fridge":
      return { id, type, name, compartments: [compartment("fridge", "Fridge")] };
    case "chest_freezer":
      return { id, type, name, compartments: [compartment("freezer", "Chest freezer", "Basket 1")] };
    case "pantry":
      return { id, type, name, compartments: [compartment("pantry", "Pantry")] };
    case "fridge_freezer": {
      const arrangement = opts.arrangement ?? "fridge_top";
      const fridge = compartment("fridge", "Fridge");
      const freezer = compartment("freezer", "Freezer");
      const compartments = arrangement === "freezer_top" ? [freezer, fridge] : [fridge, freezer];
      return { id, type, name, arrangement, compartments };
    }
  }
}

// ---------- immutable updates ----------

function mapUnit(
  layout: KitchenLayout,
  unitId: string,
  fn: (u: StorageUnit) => StorageUnit,
): KitchenLayout {
  return { units: layout.units.map((u) => (u.id === unitId ? fn(u) : u)) };
}

function mapCompartment(
  unit: StorageUnit,
  compId: string,
  fn: (c: Compartment) => Compartment,
): StorageUnit {
  return { ...unit, compartments: unit.compartments.map((c) => (c.id === compId ? fn(c) : c)) };
}

function mapColumn(comp: Compartment, columnId: string, fn: (col: Column) => Column): Compartment {
  return { ...comp, columns: comp.columns.map((col) => (col.id === columnId ? fn(col) : col)) };
}

export function addUnit(layout: KitchenLayout, unit: StorageUnit): KitchenLayout {
  return { units: [...layout.units, unit] };
}

export function removeUnit(layout: KitchenLayout, unitId: string): KitchenLayout {
  return { units: layout.units.filter((u) => u.id !== unitId) };
}

export function renameUnit(layout: KitchenLayout, unitId: string, name: string): KitchenLayout {
  return mapUnit(layout, unitId, (u) => ({ ...u, name }));
}

// A compartment holds between 1 and MAX_COLUMNS columns.
export const MAX_COLUMNS = 5;

export function addColumn(layout: KitchenLayout, unitId: string, compId: string): KitchenLayout {
  return mapUnit(layout, unitId, (u) =>
    mapCompartment(u, compId, (c) =>
      c.columns.length >= MAX_COLUMNS
        ? c
        : { ...c, columns: [...c.columns, column([shelf("Shelf 1")])] },
    ),
  );
}

// Removing the last column is a no-op — a compartment always keeps ≥1 column.
export function removeColumn(
  layout: KitchenLayout,
  unitId: string,
  compId: string,
  columnId: string,
): KitchenLayout {
  return mapUnit(layout, unitId, (u) =>
    mapCompartment(u, compId, (c) =>
      c.columns.length <= 1 ? c : { ...c, columns: c.columns.filter((col) => col.id !== columnId) },
    ),
  );
}

export function addShelf(
  layout: KitchenLayout,
  unitId: string,
  compId: string,
  columnId: string,
): KitchenLayout {
  return mapUnit(layout, unitId, (u) =>
    mapCompartment(u, compId, (c) =>
      mapColumn(c, columnId, (col) => ({
        ...col,
        shelves: [...col.shelves, shelf(`Shelf ${col.shelves.length + 1}`)],
      })),
    ),
  );
}

export function renameShelf(
  layout: KitchenLayout,
  unitId: string,
  compId: string,
  columnId: string,
  shelfId: string,
  label: string,
): KitchenLayout {
  return mapUnit(layout, unitId, (u) =>
    mapCompartment(u, compId, (c) =>
      mapColumn(c, columnId, (col) => ({
        ...col,
        shelves: col.shelves.map((s) => (s.id === shelfId ? { ...s, label } : s)),
      })),
    ),
  );
}

export function removeShelf(
  layout: KitchenLayout,
  unitId: string,
  compId: string,
  columnId: string,
  shelfId: string,
): KitchenLayout {
  return mapUnit(layout, unitId, (u) =>
    mapCompartment(u, compId, (c) =>
      mapColumn(c, columnId, (col) => ({
        ...col,
        shelves: col.shelves.filter((s) => s.id !== shelfId),
      })),
    ),
  );
}

// ---------- persistence migration ----------

// Tolerant loader: fills missing ids, recomputes the freezer invariant, and
// upgrades the legacy shape (compartment.shelves) into a single column. Keeps a
// previously-saved layout working across the Column refactor.
/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizeLayout(raw: any): KitchenLayout {
  if (!raw || !Array.isArray(raw.units)) return emptyLayout();

  const normShelves = (s: any): Shelf[] =>
    Array.isArray(s)
      ? s.map((sh: any): Shelf => ({ id: String(sh?.id ?? uid()), label: String(sh?.label ?? "Shelf") }))
      : [];

  const units: StorageUnit[] = raw.units.map((u: any): StorageUnit => ({
    id: String(u?.id ?? uid()),
    type: u?.type,
    name: String(u?.name ?? unitTypeLabel(u?.type)),
    ...(u?.arrangement ? { arrangement: u.arrangement as Arrangement } : {}),
    compartments: Array.isArray(u?.compartments)
      ? u.compartments.map((c: any): Compartment => ({
          id: String(c?.id ?? uid()),
          kind: c?.kind,
          label: String(c?.label ?? ""),
          pausesExpiry: c?.kind === "freezer",
          columns:
            Array.isArray(c?.columns) && c.columns.length
              ? c.columns.map((col: any): Column => ({
                  id: String(col?.id ?? uid()),
                  shelves: normShelves(col?.shelves),
                }))
              : [{ id: uid(), shelves: normShelves(c?.shelves) }],
        }))
      : [],
  }));

  return { units };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
