// Orchestrates the "done cooking" side effects (§7.9) as a single pure transform
// over the four stores it touches: recipes, inventory, the cook log, and
// leftovers. Both Today and the Recipes browser route their cook through here so
// the loop behaves identically wherever "Cooked it" lives. Meal-slot marking is
// the caller's job (only Today is slot-bound).
import { logCook, type CookLog, type CookReactions } from "./cookLog";
import { deductForRecipe } from "./ingredientMatch";
import { addLeftover, type Leftovers, type LeftoverLocation } from "./leftovers";
import { type Inventory } from "./inventory";
import { markRecipeCooked, type RecipeBook } from "./recipes";

// What the done-cooking sheet collects.
export interface CookOutcome {
  actualMinutes: number;
  leftover: LeftoverLocation | "none";
  portions: number; // meaningful when leftover === "fridge"
  note: string;
  reactions: CookReactions;
}

export interface CookStores {
  recipes: RecipeBook;
  inventory: Inventory;
  cookLog: CookLog;
  leftovers: Leftovers;
}

// Returns the next version of each store. Unknown recipe id → stores unchanged.
export function applyCook(stores: CookStores, recipeId: string, outcome: CookOutcome): CookStores {
  const recipe = stores.recipes.recipes.find((r) => r.id === recipeId);
  if (!recipe) return stores;

  return {
    recipes: markRecipeCooked(stores.recipes, recipeId, outcome.note),
    inventory: deductForRecipe(stores.inventory, recipe.ingredients),
    cookLog: logCook(stores.cookLog, {
      recipeId,
      actualMinutes: outcome.actualMinutes,
      reactions: outcome.reactions,
    }),
    leftovers:
      outcome.leftover === "none"
        ? stores.leftovers
        : addLeftover(stores.leftovers, {
            recipeId,
            title: recipe.title,
            location: outcome.leftover,
            portions: outcome.portions,
          }),
  };
}
