// Persistence for the rolling meal-slot timeline. localStorage for now; moves to
// data/meal-slots.json once the GitHub data repo is connected.
import { storage, StorageKeys } from "./storage";
import { emptyMealPlan, normalizeMealPlan, type MealPlan } from "../domain/mealPlan";

export function loadMealPlan(): MealPlan {
  try {
    const raw = storage.get(StorageKeys.mealSlots);
    if (raw) return normalizeMealPlan(JSON.parse(raw));
  } catch {
    // fall through to empty
  }
  return emptyMealPlan();
}

export function saveMealPlan(plan: MealPlan): void {
  storage.set(StorageKeys.mealSlots, JSON.stringify(plan));
}
