import { describe, expect, it } from "vitest";
import {
  addLeftover,
  eatByLabel,
  emptyLeftovers,
  freshFridgeLeftovers,
  normalizeLeftovers,
  removeLeftover,
} from "./leftovers";

describe("leftovers", () => {
  const now = new Date(2026, 5, 27); // 2026-06-27

  it("creates a fridge leftover with portions and a 3-day eat-by", () => {
    const out = addLeftover(emptyLeftovers(), {
      recipeId: "r1",
      title: "Tuesday's chili",
      location: "fridge",
      portions: 3,
      now,
    });
    const item = out.items[0]!;
    expect(item.location).toBe("fridge");
    expect(item.portions).toBe(3);
    expect(item.eatBy).toBe("2026-06-30");
  });

  it("creates a freezer leftover with no count and no clock", () => {
    const out = addLeftover(emptyLeftovers(), {
      recipeId: "r1",
      title: "Chili",
      location: "freezer",
      portions: 4,
      now,
    });
    const item = out.items[0]!;
    expect(item.location).toBe("freezer");
    expect(item.portions).toBeUndefined();
    expect(item.eatBy).toBeUndefined();
  });

  it("lists only fridge leftovers, soonest eat-by first", () => {
    let lo = emptyLeftovers();
    lo = addLeftover(lo, { recipeId: "r1", title: "Old", location: "fridge", now: new Date(2026, 5, 25) });
    lo = addLeftover(lo, { recipeId: "r2", title: "Frozen", location: "freezer", now });
    lo = addLeftover(lo, { recipeId: "r3", title: "New", location: "fridge", now });
    const fresh = freshFridgeLeftovers(lo);
    expect(fresh.map((l) => l.title)).toEqual(["Old", "New"]);
  });

  it("renders a plain-language eat-by label", () => {
    const out = addLeftover(emptyLeftovers(), { recipeId: "r1", title: "X", location: "fridge", now });
    expect(eatByLabel(out.items[0]!, now)).toBe("best within 3 days");
    expect(eatByLabel(out.items[0]!, new Date(2026, 5, 29))).toBe("best by tomorrow");
    expect(eatByLabel(out.items[0]!, new Date(2026, 5, 30))).toBe("best today");
  });

  it("removes a leftover by id", () => {
    const out = addLeftover(emptyLeftovers(), { recipeId: "r1", title: "X", location: "fridge", now });
    const id = out.items[0]!.id;
    expect(removeLeftover(out, id).items).toHaveLength(0);
  });

  it("normalizes persisted shapes", () => {
    const lo = normalizeLeftovers({
      items: [
        { recipeId: "r1", title: "Keep", location: "fridge", portions: 2, eatBy: "2026-07-01" },
        { title: "no recipe" }, // dropped
      ],
    });
    expect(lo.items).toHaveLength(1);
    expect(lo.items[0]!.title).toBe("Keep");
  });
});
