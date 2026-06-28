import { describe, expect, it } from "vitest";
import { applyCook, type CookOutcome } from "./cook";
import { emptyCookLog } from "./cookLog";
import { addItem, emptyInventory } from "./inventory";
import { emptyLeftovers } from "./leftovers";
import { addRecipe, emptyRecipeBook } from "./recipes";

function stores() {
  const recipes = addRecipe(emptyRecipeBook(), {
    title: "Chili",
    ingredients: [{ name: "beans" }, { name: "tomatoes" }],
    activeMinutes: 30,
    mealTypes: ["dinner"],
    vessel: "one_pot",
    cleanup: "low",
  });
  let inventory = emptyInventory();
  inventory = addItem(inventory, "s1", { name: "beans", quantity: "full" });
  inventory = addItem(inventory, "s1", { name: "tomatoes", quantity: "low" });
  return { recipes, inventory, cookLog: emptyCookLog(), leftovers: emptyLeftovers() };
}

const baseOutcome: CookOutcome = {
  actualMinutes: 35,
  leftover: "none",
  portions: 2,
  note: "",
  reactions: {},
};

describe("applyCook", () => {
  it("bumps the cook count, logs time, and deducts ingredients", () => {
    const s = stores();
    const id = s.recipes.recipes[0]!.id;
    const next = applyCook(s, id, { ...baseOutcome, note: "needs more cumin" });

    expect(next.recipes.recipes[0]!.cookedCount).toBe(1);
    expect(next.recipes.recipes[0]!.lastNote).toBe("needs more cumin");
    expect(next.cookLog.entries).toHaveLength(1);
    const byName = Object.fromEntries(next.inventory.items.map((i) => [i.name, i.quantity]));
    expect(byName["beans"]).toBe("half"); // full -> half
    expect(byName["tomatoes"]).toBeUndefined(); // low -> used up
  });

  it("creates a fridge leftover when requested", () => {
    const s = stores();
    const id = s.recipes.recipes[0]!.id;
    const next = applyCook(s, id, { ...baseOutcome, leftover: "fridge", portions: 4 });
    expect(next.leftovers.items).toHaveLength(1);
    expect(next.leftovers.items[0]!.location).toBe("fridge");
    expect(next.leftovers.items[0]!.portions).toBe(4);
  });

  it("leaves stores untouched for an unknown recipe", () => {
    const s = stores();
    const next = applyCook(s, "missing", baseOutcome);
    expect(next).toBe(s);
  });
});
