import { describe, expect, it } from "vitest";
import { addItem, emptyInventory, type Inventory } from "./inventory";
import { deductForRecipe, matchingInventory, namesMatch } from "./ingredientMatch";

function inv(): Inventory {
  let i = emptyInventory();
  i = addItem(i, "s1", { name: "tomatoes", quantity: "full" });
  i = addItem(i, "s1", { name: "kale", quantity: "half" });
  i = addItem(i, "s1", { name: "lemon", quantity: "low" });
  return i;
}

describe("ingredientMatch", () => {
  it("matches singular/plural and last-word variants", () => {
    expect(namesMatch("tomato", "tomatoes")).toBe(true);
    expect(namesMatch("cherry tomatoes", "tomatoes")).toBe(true);
    expect(namesMatch("garlic", "kale")).toBe(false);
  });

  it("finds matching inventory items for an ingredient", () => {
    const matches = matchingInventory("tomato", inv().items);
    expect(matches.map((m) => m.name)).toEqual(["tomatoes"]);
  });

  it("steps a matching item down one level when cooked", () => {
    const out = deductForRecipe(inv(), [{ name: "tomatoes" }, { name: "kale" }]);
    const byName = Object.fromEntries(out.items.map((i) => [i.name, i.quantity]));
    expect(byName["tomatoes"]).toBe("half"); // full -> half
    expect(byName["kale"]).toBe("low"); // half -> low
  });

  it("removes a low item that gets used up", () => {
    const out = deductForRecipe(inv(), [{ name: "lemon" }]);
    expect(out.items.find((i) => i.name === "lemon")).toBeUndefined();
  });

  it("leaves un-named items untouched and ignores absent ingredients", () => {
    const before = inv();
    const out = deductForRecipe(before, [{ name: "anchovies" }]);
    expect(out.items).toEqual(before.items);
  });

  it("finishes the most-open matching item first", () => {
    let i = emptyInventory();
    i = addItem(i, "s1", { name: "rice", quantity: "full" });
    i = addItem(i, "s1", { name: "rice", quantity: "low" });
    const out = deductForRecipe(i, [{ name: "rice" }]);
    // the "low" one is used up (removed); the "full" one is untouched
    expect(out.items.map((x) => x.quantity).sort()).toEqual(["full"]);
  });
});
