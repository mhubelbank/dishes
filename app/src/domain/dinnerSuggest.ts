import { daysUntil, type Inventory } from "./inventory";
import { matchingInventory } from "./ingredientMatch";
import type { MealType, Recipe, RecipeBook, Vessel } from "./recipes";

export type EnergyLevel = "tired" | "normal" | "ambitious";

export interface SuggestOptions {
  mealType?: MealType;
  energy: EnergyLevel;
  oneVessel: boolean;
  now?: Date;
  limit?: number;
}

export interface DinnerSuggestion {
  recipe: Recipe;
  score: number;
  reasons: string[];
  onHandCount: number;
  ingredientCount: number;
}

const ONE_VESSEL: Vessel[] = ["one_pot", "sheet_pan", "skillet", "no_cook"];

function isOneVessel(recipe: Recipe): boolean {
  return ONE_VESSEL.includes(recipe.vessel) && recipe.cleanup !== "high";
}

function reasonPush(reasons: string[], reason: string): void {
  if (!reasons.includes(reason) && reasons.length < 3) reasons.push(reason);
}

function scoreRecipe(
  recipe: Recipe,
  inventory: Inventory,
  options: Required<SuggestOptions>,
): DinnerSuggestion | null {
  if (!recipe.mealTypes.includes(options.mealType)) return null;
  if (recipe.reviewed === false) return null; // imported, not yet reviewed (§7.11)
  if (recipe.containsPeanuts || recipe.containsTreeNuts) return null;
  if (options.oneVessel && !isOneVessel(recipe)) return null;
  if (options.energy === "tired" && (recipe.activeMinutes > 20 || !isOneVessel(recipe))) return null;

  let score = 0;
  const reasons: string[] = [];
  const ingredientCount = Math.max(1, recipe.ingredients.length);
  let onHandCount = 0;
  let expiringCount = 0;

  for (const ingredient of recipe.ingredients) {
    const matches = matchingInventory(ingredient.name, inventory.items);
    if (matches.length === 0) continue;
    onHandCount += 1;
    score += 1.2;

    const soonest = matches
      .map((item) => (item.expiresAt ? daysUntil(item.expiresAt, options.now) : null))
      .filter((d): d is number => d !== null && Number.isFinite(d))
      .sort((a, b) => a - b)[0];
    if (soonest !== undefined && soonest <= 7) {
      expiringCount += 1;
      score += soonest <= 3 ? 3.5 : 2;
    }
  }

  const onHandRatio = onHandCount / ingredientCount;
  if (onHandCount > 0) reasonPush(reasons, `${onHandCount}/${ingredientCount} on hand`);
  if (expiringCount > 0) reasonPush(reasons, "uses expiring food");

  if (recipe.bookmarked) {
    score += 2.5;
    reasonPush(reasons, "to make");
  }
  if (isOneVessel(recipe)) {
    score += options.oneVessel ? 1.5 : 0.6;
    reasonPush(reasons, "low cleanup");
  }
  if (recipe.activeMinutes <= 20) {
    score += options.energy === "tired" ? 2 : 0.8;
    reasonPush(reasons, `${recipe.activeMinutes} min`);
  } else if (options.energy === "normal" && recipe.activeMinutes <= 35) {
    score += 0.4;
  } else if (options.energy === "ambitious" && recipe.activeMinutes > 35) {
    score += 1;
    reasonPush(reasons, "ambitious");
  }
  if (recipe.cookedCount > 0) score += Math.min(1.5, recipe.cookedCount * 0.3);

  if (!recipe.bookmarked && onHandRatio === 0) score -= 1.5;
  if (recipe.cleanup === "high" && options.energy !== "ambitious") score -= 1;

  if (reasons.length === 0) reasonPush(reasons, "solid fit");

  return { recipe, score, reasons, onHandCount, ingredientCount };
}

export function suggestDinner(
  book: RecipeBook,
  inventory: Inventory,
  options: SuggestOptions,
): DinnerSuggestion[] {
  return suggestMeal(book, inventory, { ...options, mealType: "dinner" });
}

export function suggestMeal(
  book: RecipeBook,
  inventory: Inventory,
  options: SuggestOptions,
): DinnerSuggestion[] {
  const fullOptions: Required<SuggestOptions> = {
    mealType: options.mealType ?? "dinner",
    energy: options.energy,
    oneVessel: options.oneVessel,
    now: options.now ?? new Date(),
    limit: options.limit ?? 2,
  };
  return book.recipes
    .map((recipe) => scoreRecipe(recipe, inventory, fullOptions))
    .filter((suggestion): suggestion is DinnerSuggestion => Boolean(suggestion))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.onHandCount - a.onHandCount ||
        a.recipe.activeMinutes - b.recipe.activeMinutes ||
        a.recipe.title.localeCompare(b.recipe.title),
    )
    .slice(0, fullOptions.limit);
}
