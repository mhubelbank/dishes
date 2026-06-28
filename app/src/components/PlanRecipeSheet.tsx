import { useState } from "react";
import { loadMealPlan, saveMealPlan } from "../clients/mealSlotsStore";
import { DEFAULT_MEAL_WINDOWS } from "../domain/mealSlots";
import { planRecipe, upcomingDateKeys, type MealPlan } from "../domain/mealPlan";
import type { MealType, Recipe } from "../domain/recipes";

function dayLabel(dateKey: string, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function PlanRecipeSheet({
  recipe,
  defaultMealType,
  onSaved,
  onClose,
}: {
  recipe: Recipe;
  defaultMealType?: MealType;
  onSaved?: (plan: MealPlan) => void;
  onClose: () => void;
}) {
  const [plan, setPlan] = useState<MealPlan>(() => loadMealPlan());
  const [selectedDate, setSelectedDate] = useState(() => upcomingDateKeys(new Date(), 1)[0] ?? "");
  const [selectedMeal, setSelectedMeal] = useState<MealType>(
    defaultMealType && recipe.mealTypes.includes(defaultMealType)
      ? defaultMealType
      : recipe.mealTypes[0] ?? "dinner",
  );
  const dates = upcomingDateKeys(new Date(), 7);

  function save(): void {
    if (!selectedDate) return;
    const next = planRecipe(plan, selectedDate, selectedMeal, recipe.id, "planned");
    setPlan(next);
    saveMealPlan(next);
    onSaved?.(next);
    onClose();
  }

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-modal="true"
        className="plan-sheet"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="plan-sheet__head">
          <div>
            <h2>Plan it</h2>
            <p className="muted xs">{recipe.title}</p>
          </div>
          <button className="button button--ghost button--small" onClick={onClose} type="button">
            Cancel
          </button>
        </header>

        <div className="plan-days" aria-label="Day">
          {dates.map((date, index) => (
            <button
              className={`plan-day${selectedDate === date ? " plan-day--on" : ""}`}
              key={date}
              onClick={() => setSelectedDate(date)}
              type="button"
            >
              {dayLabel(date, index)}
            </button>
          ))}
        </div>

        <div className="chips" aria-label="Meal">
          {DEFAULT_MEAL_WINDOWS.map((window) => (
            <button
              className={`chip${selectedMeal === window.meal ? " chip--on" : ""}`}
              key={window.meal}
              onClick={() => setSelectedMeal(window.meal)}
              type="button"
            >
              {window.shortLabel}
            </button>
          ))}
        </div>

        <footer className="plan-sheet__actions">
          <button className="button button--success" onClick={save} type="button">
            Save slot
          </button>
        </footer>
      </section>
    </div>
  );
}
