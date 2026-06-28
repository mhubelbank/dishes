import { describe, it, expect } from "vitest";
import {
  createUnit,
  addUnit,
  addColumn,
  removeColumn,
  MAX_COLUMNS,
  addShelf,
  removeShelf,
  renameShelf,
  shelfLocations,
  normalizeLayout,
  emptyLayout,
} from "./kitchen";

describe("createUnit", () => {
  it("orders fridge_freezer compartments by arrangement", () => {
    expect(
      createUnit("fridge_freezer", { arrangement: "fridge_top" }).compartments.map((c) => c.kind),
    ).toEqual(["fridge", "freezer"]);
    expect(
      createUnit("fridge_freezer", { arrangement: "freezer_top" }).compartments.map((c) => c.kind),
    ).toEqual(["freezer", "fridge"]);
  });

  it("pauses the expiry clock on freezer compartments only", () => {
    const u = createUnit("fridge_freezer", { arrangement: "side_by_side" });
    expect(u.compartments.find((c) => c.kind === "freezer")!.pausesExpiry).toBe(true);
    expect(u.compartments.find((c) => c.kind === "fridge")!.pausesExpiry).toBe(false);
    expect(createUnit("chest_freezer").compartments[0]!.pausesExpiry).toBe(true);
    expect(createUnit("pantry").compartments[0]!.pausesExpiry).toBe(false);
  });

  it("starts each compartment with one column and one shelf", () => {
    const comp = createUnit("pantry").compartments[0]!;
    expect(comp.columns).toHaveLength(1);
    expect(comp.columns[0]!.shelves).toHaveLength(1);
  });
});

describe("columns", () => {
  it("adds and removes columns, never below one", () => {
    let layout = addUnit(emptyLayout(), createUnit("pantry"));
    const unit = layout.units[0]!;
    const comp = unit.compartments[0]!;

    layout = addColumn(layout, unit.id, comp.id);
    expect(layout.units[0]!.compartments[0]!.columns).toHaveLength(2);

    const second = layout.units[0]!.compartments[0]!.columns[1]!;
    layout = removeColumn(layout, unit.id, comp.id, second.id);
    expect(layout.units[0]!.compartments[0]!.columns).toHaveLength(1);

    // Removing the last remaining column is a no-op.
    const last = layout.units[0]!.compartments[0]!.columns[0]!;
    layout = removeColumn(layout, unit.id, comp.id, last.id);
    expect(layout.units[0]!.compartments[0]!.columns).toHaveLength(1);
  });

  it("caps a compartment at MAX_COLUMNS", () => {
    let layout = addUnit(emptyLayout(), createUnit("pantry"));
    const unit = layout.units[0]!;
    const comp = unit.compartments[0]!;
    for (let i = 0; i < 10; i++) layout = addColumn(layout, unit.id, comp.id);
    expect(layout.units[0]!.compartments[0]!.columns).toHaveLength(MAX_COLUMNS);
  });
});

describe("shelf editing", () => {
  it("adds, renames, and removes shelves within a column", () => {
    let layout = addUnit(emptyLayout(), createUnit("pantry"));
    const unit = layout.units[0]!;
    const comp = unit.compartments[0]!;
    const col = comp.columns[0]!;

    layout = addShelf(layout, unit.id, comp.id, col.id);
    expect(layout.units[0]!.compartments[0]!.columns[0]!.shelves).toHaveLength(2);

    const added = layout.units[0]!.compartments[0]!.columns[0]!.shelves[1]!;
    layout = renameShelf(layout, unit.id, comp.id, col.id, added.id, "Canned goods");
    expect(layout.units[0]!.compartments[0]!.columns[0]!.shelves[1]!.label).toBe("Canned goods");

    layout = removeShelf(layout, unit.id, comp.id, col.id, added.id);
    expect(layout.units[0]!.compartments[0]!.columns[0]!.shelves).toHaveLength(1);
  });
});

describe("shelfLocations", () => {
  it("maps each shelf id to its unit/compartment/shelf labels", () => {
    const layout = addUnit(emptyLayout(), createUnit("pantry", { name: "Cupboard" }));
    const comp = layout.units[0]!.compartments[0]!;
    const shelf = comp.columns[0]!.shelves[0]!;
    const locs = shelfLocations(layout);
    expect(locs[shelf.id]).toEqual({ unit: "Cupboard", compartment: "Pantry", shelf: "Shelf 1" });
  });
});

describe("normalizeLayout", () => {
  it("upgrades the legacy compartment.shelves shape into one column", () => {
    const legacy = {
      units: [
        {
          id: "u1",
          type: "pantry",
          name: "Pantry",
          compartments: [{ id: "c1", kind: "pantry", label: "Pantry", shelves: [{ id: "s1", label: "Top" }] }],
        },
      ],
    };
    const layout = normalizeLayout(legacy);
    const comp = layout.units[0]!.compartments[0]!;
    expect(comp.columns).toHaveLength(1);
    expect(comp.columns[0]!.shelves[0]!.label).toBe("Top");
  });

  it("returns an empty layout for junk input", () => {
    expect(normalizeLayout(null).units).toEqual([]);
    expect(normalizeLayout({}).units).toEqual([]);
  });
});
