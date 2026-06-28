import { describe, it, expect } from "vitest";
import {
  emptyInventory,
  addItem,
  setQuantity,
  renameItem,
  setExpiry,
  removeItem,
  itemsForShelf,
  daysUntil,
  sortItems,
  sortInventory,
  expiryBuckets,
  setMeasure,
  setCount,
  setSize,
  learnMeasures,
  learnSizes,
  normalizeInventory,
} from "./inventory";

describe("inventory items", () => {
  it("adds an item to a shelf with trimmed name and defaults", () => {
    const inv = addItem(emptyInventory(), "shelf-1", { name: "  Swiss chard " });
    expect(inv.items).toHaveLength(1);
    const it = inv.items[0]!;
    expect(it.name).toBe("Swiss chard");
    expect(it.quantity).toBe("full");
    expect(it.shelfId).toBe("shelf-1");
    expect(it.expiresAt).toBeUndefined();
  });

  it("sets quantity, renames, sets/clears expiry, and removes", () => {
    let inv = addItem(emptyInventory(), "s1", { name: "Onion", expiresAt: "2026-06-25" });
    const id = inv.items[0]!.id;

    inv = setQuantity(inv, id, "low");
    expect(inv.items[0]!.quantity).toBe("low");

    inv = renameItem(inv, id, "Half onion");
    expect(inv.items[0]!.name).toBe("Half onion");

    inv = setExpiry(inv, id, undefined);
    expect(inv.items[0]!.expiresAt).toBeUndefined();

    inv = removeItem(inv, id);
    expect(inv.items).toHaveLength(0);
  });

  it("itemsForShelf filters by shelf, preserving order", () => {
    let inv = addItem(emptyInventory(), "a", { name: "x" });
    inv = addItem(inv, "b", { name: "y" });
    inv = addItem(inv, "a", { name: "z" });
    expect(itemsForShelf(inv, "a").map((i) => i.name)).toEqual(["x", "z"]);
  });
});

describe("daysUntil", () => {
  it("computes whole days from a fixed today", () => {
    const now = new Date(2026, 5, 19); // Jun 19, 2026
    expect(daysUntil("2026-06-22", now)).toBe(3);
    expect(daysUntil("2026-06-19", now)).toBe(0);
    expect(daysUntil("2026-06-17", now)).toBe(-2);
  });
});

describe("sortItems", () => {
  it("sorts by name alphabetically", () => {
    let inv = addItem(emptyInventory(), "s", { name: "Onion" });
    inv = addItem(inv, "s", { name: "apple" });
    inv = addItem(inv, "s", { name: "Carrot" });
    expect(sortItems(inv.items, "name").map((i) => i.name)).toEqual(["apple", "Carrot", "Onion"]);
  });

  it("sorts by expiry soonest-first, undated last", () => {
    let inv = addItem(emptyInventory(), "s", { name: "no date" });
    inv = addItem(inv, "s", { name: "later", expiresAt: "2026-07-01" });
    inv = addItem(inv, "s", { name: "sooner", expiresAt: "2026-06-25" });
    expect(sortItems(inv.items, "expiry").map((i) => i.name)).toEqual(["sooner", "later", "no date"]);
  });

  it("sortInventory orders within each shelf, keeping shelves grouped", () => {
    let inv = addItem(emptyInventory(), "a", { name: "Onion" });
    inv = addItem(inv, "b", { name: "Zucchini" });
    inv = addItem(inv, "a", { name: "Apple" });
    inv = addItem(inv, "b", { name: "Carrot" });
    expect(sortInventory(inv, "name").items.map((i) => `${i.shelfId}:${i.name}`)).toEqual([
      "a:Apple",
      "a:Onion",
      "b:Carrot",
      "b:Zucchini",
    ]);
  });
});

describe("expiryBuckets", () => {
  it("splits items by days-left and groups undated separately", () => {
    const now = new Date(2026, 5, 24); // Jun 24, 2026
    let inv = addItem(emptyInventory(), "s", { name: "expired", expiresAt: "2026-06-22" });
    inv = addItem(inv, "s", { name: "today", expiresAt: "2026-06-24" });
    inv = addItem(inv, "s", { name: "soon", expiresAt: "2026-06-26" });
    inv = addItem(inv, "s", { name: "thisweek", expiresAt: "2026-06-30" });
    inv = addItem(inv, "s", { name: "later", expiresAt: "2026-07-15" });
    inv = addItem(inv, "s", { name: "nodate" });

    const b = expiryBuckets(inv.items, now);
    expect(b.now.map((i) => i.name)).toEqual(["expired", "today"]);
    expect(b.soon.map((i) => i.name)).toEqual(["soon"]);
    expect(b.week.map((i) => i.name)).toEqual(["thisweek"]);
    expect(b.later.map((i) => i.name)).toEqual(["later"]);
    expect(b.undated.map((i) => i.name)).toEqual(["nodate"]);
  });
});

describe("measure mode", () => {
  it("toggles to count (default 1), sets a count, and back to level", () => {
    let inv = addItem(emptyInventory(), "s", { name: "Peppers" });
    const id = inv.items[0]!.id;

    inv = setMeasure(inv, id, "count");
    expect(inv.items[0]!.measure).toBe("count");
    expect(inv.items[0]!.count).toBe(1);

    inv = setCount(inv, id, 3);
    expect(inv.items[0]!.count).toBe(3);

    inv = setMeasure(inv, id, "level");
    expect(inv.items[0]!.measure).toBeUndefined();
  });

  it("learnMeasures records count items and clears level ones", () => {
    let counted = addItem(emptyInventory(), "s", { name: "Peppers" });
    counted = setMeasure(counted, counted.items[0]!.id, "count");
    expect(learnMeasures(counted, {})["peppers"]).toBe("count");

    const level = addItem(emptyInventory(), "s", { name: "Onion" });
    expect(learnMeasures(level, { onion: "count" })["onion"]).toBeUndefined();
  });
});

describe("size", () => {
  it("setSize sets and clears; coexists with level; learnSizes records it by name", () => {
    let inv = addItem(emptyInventory(), "s", { name: "Milk" });
    const id = inv.items[0]!.id;

    inv = setSize(inv, id, { amount: 128, unit: "oz" });
    expect(inv.items[0]!.size).toEqual({ amount: 128, unit: "oz" });
    expect(inv.items[0]!.quantity).toBe("full"); // amount-left untouched
    expect(learnSizes(inv, {})["milk"]).toEqual({ amount: 128, unit: "oz" });

    inv = setSize(inv, id, undefined);
    expect(inv.items[0]!.size).toBeUndefined();
  });
});

describe("normalizeInventory", () => {
  it("drops items without a shelfId and defaults a bad quantity", () => {
    const inv = normalizeInventory({
      items: [{ shelfId: "s1", name: "ok", quantity: "nonsense" }, { name: "nope" }],
    });
    expect(inv.items).toHaveLength(1);
    expect(inv.items[0]!.quantity).toBe("full");
  });

  it("returns empty for junk input", () => {
    expect(normalizeInventory(null).items).toEqual([]);
    expect(normalizeInventory({}).items).toEqual([]);
  });
});
