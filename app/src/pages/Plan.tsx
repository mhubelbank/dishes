import { useMemo, useState } from "react";
import { loadMealPlan, saveMealPlan } from "../clients/mealSlotsStore";
import { loadRecipes } from "../clients/recipesStore";
import { Icon } from "../components/Icon";
import { DEFAULT_MEAL_WINDOWS } from "../domain/mealSlots";
import { clearSlot, planRecipe, slotFor, upcomingDateKeys, type MealPlan } from "../domain/mealPlan";
import type { MealType, Recipe, RecipeBook } from "../domain/recipes";

interface EditingSlot {
  date: string;
  mealType: MealType;
}

function dayLabel(dateKey: string, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function recipeTitle(book: RecipeBook, recipeId?: string): string | null {
  if (!recipeId) return null;
  return book.recipes.find((recipe) => recipe.id === recipeId)?.title ?? null;
}

// Rolling meal-slot timeline (requirements §6.1, §7.3 · mockups #week). Dinner
// auto-fills later; empty breakfast/lunch/snack slots are a normal state.
export function Plan() {
  const [plan, setPlan] = useState<MealPlan>(() => loadMealPlan());
  const [recipes] = useState<RecipeBook>(() => loadRecipes());
  const [editingSlot, setEditingSlot] = useState<EditingSlot | null>(null);
  const dates = useMemo(() => upcomingDateKeys(new Date(), 7), []);

  function clear(date: string, mealType: MealType): void {
    const next = clearSlot(plan, date, mealType);
    setPlan(next);
    saveMealPlan(next);
  }

  function assign(date: string, mealType: MealType, recipeId: string): void {
    const next = planRecipe(plan, date, mealType, recipeId, "planned");
    setPlan(next);
    saveMealPlan(next);
    setEditingSlot(null);
  }

  return (
    <div className="shell plan-shell">
      <header className="page-header">
        <div>
          <h1 className="page-title">Plan</h1>
          <p className="muted sm">{plan.slots.length} planned slots · next 7 days</p>
        </div>
      </header>

      <div className="plan-week">
        {dates.map((date, index) => (
          <section className="plan-day-row" key={date}>
            <div className="plan-day-row__head">
              <h2>{dayLabel(date, index)}</h2>
              <span className="muted xs">{date.slice(5).replace("-", "/")}</span>
            </div>
            <div className="plan-slots">
              {DEFAULT_MEAL_WINDOWS.map((window) => {
                const slot = slotFor(plan, date, window.meal);
                const title = recipeTitle(recipes, slot?.recipeId);
                return (
                  <div className={`plan-slot${title ? " plan-slot--filled" : ""}`} key={window.meal}>
                    <button
                      className="plan-slot__main"
                      onClick={() => setEditingSlot({ date, mealType: window.meal })}
                      type="button"
                    >
                      <span className="plan-slot__meal">{window.shortLabel}</span>
                      <span className="plan-slot__title">{title ?? "Empty"}</span>
                    </button>
                    {title ? (
                      <button
                        className="plan-slot__clear"
                        onClick={() => clear(date, window.meal)}
                        title="Clear slot"
                        type="button"
                      >
                        <Icon name="x" size={13} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {editingSlot ? (
        <PlanSlotSheet
          date={editingSlot.date}
          mealType={editingSlot.mealType}
          recipes={recipes.recipes}
          currentRecipeId={slotFor(plan, editingSlot.date, editingSlot.mealType)?.recipeId}
          onAssign={(recipeId) => assign(editingSlot.date, editingSlot.mealType, recipeId)}
          onClear={() => {
            clear(editingSlot.date, editingSlot.mealType);
            setEditingSlot(null);
          }}
          onClose={() => setEditingSlot(null)}
        />
      ) : null}
    </div>
  );
}

function PlanSlotSheet({
  date,
  mealType,
  recipes,
  currentRecipeId,
  onAssign,
  onClear,
  onClose,
}: {
  date: string;
  mealType: MealType;
  recipes: Recipe[];
  currentRecipeId?: string;
  onAssign: (recipeId: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const meal = DEFAULT_MEAL_WINDOWS.find((window) => window.meal === mealType);
  const candidates = recipes
    .filter((recipe) => recipe.mealTypes.includes(mealType))
    .filter((recipe) => recipe.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(Boolean(b.bookmarked)) - Number(Boolean(a.bookmarked)) || a.title.localeCompare(b.title));

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
            <h2>{meal?.label ?? "Meal"}</h2>
            <p className="muted xs">{date}</p>
          </div>
          <button className="button button--ghost button--small" onClick={onClose} type="button">
            Cancel
          </button>
        </header>

        <div className="recipe-search">
          <Icon name="search" size={16} />
          <input
            className="input recipe-search__input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a recipe"
          />
        </div>

        <div className="plan-picker-list">
          {candidates.map((recipe) => (
            <button
              className={`plan-picker-row${recipe.id === currentRecipeId ? " plan-picker-row--on" : ""}`}
              key={recipe.id}
              onClick={() => onAssign(recipe.id)}
              type="button"
            >
              <span>{recipe.title}</span>
              <small>{recipe.activeMinutes} min · {recipe.cleanup} cleanup</small>
            </button>
          ))}
          {candidates.length === 0 ? <p className="muted sm">No recipes match this meal.</p> : null}
        </div>

        <footer className="plan-sheet__actions plan-sheet__actions--split">
          {currentRecipeId ? (
            <button className="button button--danger" onClick={onClear} type="button">
              Clear
            </button>
          ) : <span />}
          <button className="button" onClick={onClose} type="button">
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}
