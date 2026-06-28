import { describe, expect, it } from "vitest";
import { addItem, emptyInventory, type Inventory } from "./inventory";
import { suggestDinner, suggestMeal } from "./dinnerSuggest";
import type { Recipe, RecipeBook } from "./recipes";

function recipe(overrides: Partial<Recipe>): Recipe {
  return {
    id: overrides.id ?? overrides.title ?? "r",
    title: overrides.title ?? "Recipe",
    ingredients: overrides.ingredients ?? [{ name: "rice" }],
    activeMinutes: overrides.activeMinutes ?? 30,
    mealTypes: overrides.mealTypes ?? ["dinner"],
    vessel: overrides.vessel ?? "skillet",
    cleanup: overrides.cleanup ?? "low",
    genres: [],
    cookedCount: 0,
    createdAt: "2026-06-24T00:00:00.000Z",
    updatedAt: "2026-06-24T00:00:00.000Z",
    ...overrides,
  };
}

function book(recipes: Recipe[]): RecipeBook {
  return { recipes };
}

function invWith(items: Array<{ name: string; expiresAt?: string }>): Inventory {
  let inv = emptyInventory();
  for (const item of items) inv = addItem(inv, "shelf", item);
  return inv;
}

describe("suggestDinner", () => {
  it("suggests for the selected meal type", () => {
    const suggestions = suggestMeal(
      book([
        recipe({ title: "Lunch rice", mealTypes: ["lunch"], bookmarked: true }),
        recipe({ title: "Dinner rice", mealTypes: ["dinner"], bookmarked: true }),
      ]),
      emptyInventory(),
      { mealType: "lunch", energy: "normal", oneVessel: false },
    );

    expect(suggestions.map((s) => s.recipe.title)).toEqual(["Lunch rice"]);
  });

  it("returns the top two dinner recipes with reasons", () => {
    const suggestions = suggestDinner(
      book([
        recipe({ title: "Rice", ingredients: [{ name: "rice" }] }),
        recipe({ title: "Beans", ingredients: [{ name: "beans" }], bookmarked: true }),
        recipe({ title: "Breakfast", mealTypes: ["breakfast"], bookmarked: true }),
      ]),
      invWith([{ name: "rice" }, { name: "beans" }]),
      { energy: "normal", oneVessel: false, now: new Date(2026, 5, 24) },
    );

    expect(suggestions.map((s) => s.recipe.title)).toEqual(["Beans", "Rice"]);
    expect(suggestions[0]!.reasons).toContain("to make");
    expect(suggestions[1]!.reasons).toContain("1/1 on hand");
  });

  it("boosts recipes that use expiring food", () => {
    const suggestions = suggestDinner(
      book([
        recipe({ title: "Tomato eggs", ingredients: [{ name: "tomatoes" }, { name: "eggs" }] }),
        recipe({ title: "Rice", ingredients: [{ name: "rice" }], bookmarked: true }),
      ]),
      invWith([{ name: "roma tomatoes", expiresAt: "2026-06-25" }, { name: "eggs" }]),
      { energy: "normal", oneVessel: false, now: new Date(2026, 5, 24) },
    );

    expect(suggestions[0]!.recipe.title).toBe("Tomato eggs");
    expect(suggestions[0]!.reasons).toContain("uses expiring food");
  });

  it("filters tired mode to fast one-vessel meals", () => {
    const suggestions = suggestDinner(
      book([
        recipe({ title: "Fast skillet", activeMinutes: 18, vessel: "skillet", cleanup: "low" }),
        recipe({ title: "Long skillet", activeMinutes: 45, vessel: "skillet", cleanup: "low" }),
        recipe({ title: "Fast mess", activeMinutes: 15, vessel: "multiple", cleanup: "high" }),
      ]),
      emptyInventory(),
      { energy: "tired", oneVessel: false },
    );

    expect(suggestions.map((s) => s.recipe.title)).toEqual(["Fast skillet"]);
  });

  it("honors one-vessel filtering and allergen exclusions", () => {
    const suggestions = suggestDinner(
      book([
        recipe({ title: "Skillet", vessel: "skillet", cleanup: "low" }),
        recipe({ title: "Project", vessel: "multiple", cleanup: "medium", bookmarked: true }),
        recipe({ title: "Imported unsafe", containsPeanuts: true, bookmarked: true }),
      ]),
      emptyInventory(),
      { energy: "normal", oneVessel: true },
    );

    expect(suggestions.map((s) => s.recipe.title)).toEqual(["Skillet"]);
  });
});
