import { describe, expect, it } from "vitest";
import {
  abbreviateUnits,
  addRecipe,
  cleanGenres,
  durationLabel,
  emptyRecipeBook,
  ingredientNames,
  markRecipeCooked,
  mergeRecipeBooks,
  normalizeRecipeBook,
  recipesForQuery,
  toggleBookmark,
  updateRecipe,
  type RecipeInput,
} from "./recipes";

const sampleInput: RecipeInput = {
  title: "Test Soup",
  ingredients: [{ name: "water" }],
  activeMinutes: 10,
  mealTypes: ["dinner"],
  vessel: "one_pot",
  cleanup: "low",
};

function input(overrides: Partial<RecipeInput> = {}): RecipeInput {
  const base: RecipeInput = {
    title: " Tomato egg rice ",
    ingredients: [{ name: " eggs " }, { name: "tomatoes" }, { name: "" }],
    activeMinutes: 18.4,
    mealTypes: ["dinner"],
    vessel: "skillet",
    cleanup: "low",
    genres: ["Chinese", " rice ", "Chinese"],
    nutrition: { proteinGrams: 19.2, fiberGrams: 4.1 },
  };
  return { ...base, ...overrides };
}

describe("recipe book", () => {
  it("adds a cleaned recipe and ignores empty required fields", () => {
    const book = addRecipe(emptyRecipeBook(), input());
    expect(book.recipes).toHaveLength(1);
    expect(book.recipes[0]!.title).toBe("Tomato egg rice");
    expect(book.recipes[0]!.ingredients.map((ingredient) => ingredient.name)).toEqual([
      "eggs",
      "tomatoes",
    ]);
    expect(book.recipes[0]!.activeMinutes).toBe(18);
    expect(book.recipes[0]!.genres).toEqual(["Chinese", "rice"]);
    expect(book.recipes[0]!.nutrition).toEqual({ proteinGrams: 19, fiberGrams: 4 });

    expect(addRecipe(book, input({ title: " " })).recipes).toHaveLength(1);
    expect(addRecipe(book, input({ ingredients: [] })).recipes).toHaveLength(1);
  });

  it("updates a recipe while preserving its id and created timestamp", () => {
    let book = addRecipe(emptyRecipeBook(), input());
    const original = book.recipes[0]!;

    book = updateRecipe(book, original.id, input({ title: "Eggs over rice", activeMinutes: 12 }));
    expect(book.recipes[0]!.id).toBe(original.id);
    expect(book.recipes[0]!.createdAt).toBe(original.createdAt);
    expect(book.recipes[0]!.title).toBe("Eggs over rice");
    expect(book.recipes[0]!.activeMinutes).toBe(12);
  });

  it("toggles bookmarks and sorts bookmarked recipes first in search results", () => {
    let book = addRecipe(emptyRecipeBook(), input({ title: "First", bookmarked: false }));
    book = addRecipe(book, input({ title: "Second", bookmarked: false }));
    const secondId = book.recipes[1]!.id;

    book = toggleBookmark(book, secondId);
    expect(book.recipes[1]!.bookmarked).toBe(true);
    expect(recipesForQuery(book, "").map((recipe) => recipe.title)).toEqual(["Second", "First"]);
  });

  it("marks a recipe cooked", () => {
    let book = addRecipe(emptyRecipeBook(), input());
    const id = book.recipes[0]!.id;

    book = markRecipeCooked(book, id);
    expect(book.recipes[0]!.cookedCount).toBe(1);
  });

  it("searches title, genre, ingredient, and note", () => {
    let book = addRecipe(emptyRecipeBook(), input({ title: "Beans", genres: ["cozy"] }));
    book = addRecipe(
      book,
      input({
        title: "Noodles",
        ingredients: [{ name: "gochujang" }],
        genres: [],
        lastNote: "Needs more scallions",
      }),
    );

    expect(recipesForQuery(book, "cozy").map((recipe) => recipe.title)).toEqual(["Beans"]);
    expect(recipesForQuery(book, "gochujang").map((recipe) => recipe.title)).toEqual(["Noodles"]);
    expect(recipesForQuery(book, "scallions").map((recipe) => recipe.title)).toEqual(["Noodles"]);
  });

  it("returns distinct ingredient names sorted alphabetically", () => {
    let book = addRecipe(emptyRecipeBook(), input({ ingredients: [{ name: "Tomatoes" }] }));
    book = addRecipe(book, input({ ingredients: [{ name: "eggs" }, { name: "tomatoes" }] }));

    expect(ingredientNames(book)).toEqual(["eggs", "Tomatoes"]);
  });
});

describe("mergeRecipeBooks", () => {
  it("adds new recipes and skips titles already present (normalized)", () => {
    const base = addRecipe(emptyRecipeBook(), sampleInput);
    const incoming = normalizeRecipeBook({
      recipes: [
        { ...base.recipes[0], id: "dup", title: "  test soup " }, // same title, different case/space
        { ...base.recipes[0], id: "new", title: "Other Stew" },
      ],
    });
    const { book, added, skipped } = mergeRecipeBooks(base, incoming);
    expect(added).toBe(1);
    expect(skipped).toBe(1);
    expect(book.recipes.map((r) => r.title).sort()).toEqual(["Other Stew", "Test Soup"]);
  });

  it("is idempotent when merging the same book twice", () => {
    const base = addRecipe(emptyRecipeBook(), sampleInput);
    const once = mergeRecipeBooks(emptyRecipeBook(), base);
    const twice = mergeRecipeBooks(once.book, base);
    expect(twice.added).toBe(0);
    expect(twice.book.recipes).toHaveLength(1);
  });
});

describe("durationLabel", () => {
  it("leads with total, falls back to a single number when active == total or no total", () => {
    expect(durationLabel(30, 50)).toBe("50 min total · 30 min active");
    expect(durationLabel(50, 50)).toBe("50 min");
    expect(durationLabel(30)).toBe("30 min");
  });
});

describe("abbreviateUnits", () => {
  it("shortens spelled-out units, leaving counts and short words alone", () => {
    expect(abbreviateUnits("1 1/2 pounds")).toBe("1 1/2 lb");
    expect(abbreviateUnits("3 tablespoons")).toBe("3 tbsp");
    expect(abbreviateUnits("2 teaspoons")).toBe("2 tsp");
    expect(abbreviateUnits("8 ounces")).toBe("8 oz");
    expect(abbreviateUnits("12")).toBe("12");
    expect(abbreviateUnits("2 cups")).toBe("2 cups");
    expect(abbreviateUnits("4 cloves")).toBe("4 cloves");
  });
});

describe("extended recipe fields", () => {
  it("keeps and validates the new taxonomy/provenance fields", () => {
    const book = addRecipe(emptyRecipeBook(), {
      ...sampleInput,
      title: "Tagged Recipe",
      totalMinutes: 45.4,
      servings: 4,
      form: "soup",
      role: "main",
      mainIngredient: " chicken ",
      description: "  a book headnote  ",
      source: { book: "Milk Street", chapter: " Fast " },
      reviewed: false,
    });
    const r = book.recipes[0]!;
    expect(r.totalMinutes).toBe(45);
    expect(r.servings).toBe(4);
    expect(r.form).toBe("soup");
    expect(r.role).toBe("main");
    expect(r.mainIngredient).toBe("chicken");
    expect(r.description).toBe("a book headnote");
    expect(r.source).toEqual({ book: "Milk Street", chapter: "Fast" });
    expect(r.reviewed).toBe(false);
  });

  it("migrates a legacy single `course` onto the form/role axes", () => {
    const book = normalizeRecipeBook({
      recipes: [
        { id: "a", title: "Stew", ingredients: [{ name: "water" }], activeMinutes: 10, mealTypes: ["dinner"], vessel: "one_pot", cleanup: "low", course: "soup" },
        { id: "b", title: "Slaw", ingredients: [{ name: "cabbage" }], activeMinutes: 5, mealTypes: ["dinner"], vessel: "no_cook", cleanup: "low", course: "side" },
      ],
    });
    expect(book.recipes.find((r) => r.id === "a")!.form).toBe("soup");
    expect(book.recipes.find((r) => r.id === "a")!.role).toBeUndefined();
    expect(book.recipes.find((r) => r.id === "b")!.role).toBe("side");
    expect(book.recipes.find((r) => r.id === "b")!.form).toBeUndefined();
  });

  it("drops invalid/empty extended fields", () => {
    const book = addRecipe(emptyRecipeBook(), {
      ...sampleInput,
      title: "Bare",
      servings: 0,
      form: "nonsense" as never,
      role: "nonsense" as never,
      source: { book: "   " },
    });
    const r = book.recipes[0]!;
    expect(r.servings).toBeUndefined();
    expect(r.form).toBeUndefined();
    expect(r.role).toBeUndefined();
    expect(r.source).toBeUndefined();
    expect(r.reviewed).toBeUndefined();
  });
});

describe("recipe normalization", () => {
  it("dedupes genres by normalized name", () => {
    expect(cleanGenres(["Soup-y", " soupy ", "Korean", ""])).toEqual(["Soup-y", "Korean"]);
  });

  it("drops invalid persisted recipes and defaults missing optional fields", () => {
    const book = normalizeRecipeBook({
      recipes: [
        {
          id: "ok",
          title: "Ok",
          ingredients: [{ name: "rice" }],
          activeMinutes: Number.NaN,
          mealTypes: [],
          vessel: "nonsense",
          cleanup: "nope",
        },
        { id: "bad", title: "No ingredients", ingredients: [] },
        { title: "Missing id", ingredients: [{ name: "rice" }] },
      ],
    });

    expect(book.recipes).toHaveLength(1);
    expect(book.recipes[0]!.activeMinutes).toBe(30);
    expect(book.recipes[0]!.mealTypes).toEqual(["dinner"]);
    expect(book.recipes[0]!.vessel).toBe("skillet");
    expect(book.recipes[0]!.cleanup).toBe("medium");
  });
});
