import { useMemo, useState } from "react";
import type { NavPage } from "../components/NavBar";
import { Icon, type IconName } from "../components/Icon";
import { CookLogSheet } from "../components/CookLogSheet";
import { PlanRecipeSheet } from "../components/PlanRecipeSheet";
import { RecipeDetail } from "../components/RecipeDetail";
import { loadInventory, saveInventory } from "../clients/inventoryStore";
import { loadCookLog, saveCookLog } from "../clients/cookLogStore";
import { loadLeftovers, saveLeftovers } from "../clients/leftoversStore";
import { loadMealPlan, saveMealPlan } from "../clients/mealSlotsStore";
import { loadRecipes, saveRecipes } from "../clients/recipesStore";
import { applyCook, type CookOutcome } from "../domain/cook";
import { yourTimeByRecipe } from "../domain/cookLog";
import { suggestMeal, type EnergyLevel } from "../domain/dinnerSuggest";
import { eatByLabel, freshFridgeLeftovers, removeLeftover, type Leftovers } from "../domain/leftovers";
import {
  clearSlot,
  localDateKey,
  markSlotCooked,
  slotFor,
  type MealPlan,
} from "../domain/mealPlan";
import {
  DEFAULT_MEAL_WINDOWS,
  mealTypeForTime,
  mealWindowLabel,
  type MealWindow,
} from "../domain/mealSlots";
import type { MealType, RecipeBook } from "../domain/recipes";

const ENERGY: EnergyLevel[] = ["tired", "normal", "ambitious"];
const MEAL_ICONS: Record<MealType, IconName> = {
  breakfast: "haze",
  lunch: "sun",
  dinner: "moon-stars",
  late_night: "comet",
};

function titleCase(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mealWindowFor(meal: MealType): MealWindow {
  return DEFAULT_MEAL_WINDOWS.find((window) => window.meal === meal) ?? DEFAULT_MEAL_WINDOWS[2]!;
}

// Home screen (requirements §7.1 · mockups #shell). The dinner suggester is
// deterministic — 1–2 picks with plain-language "why" chips, no LLM on this path.
export function Today({ onNavigate }: { onNavigate: (p: NavPage) => void }) {
  const [recipes, setRecipes] = useState<RecipeBook>(() => loadRecipes());
  const [plan, setPlan] = useState<MealPlan>(() => loadMealPlan());
  const [inventory, setInventory] = useState(() => loadInventory());
  const [cookLog, setCookLog] = useState(() => loadCookLog());
  const [leftovers, setLeftovers] = useState<Leftovers>(() => loadLeftovers());
  const [mealType, setMealType] = useState<MealType>(() => mealTypeForTime(new Date()));
  const [energy, setEnergy] = useState<EnergyLevel>("normal");
  const [oneVessel, setOneVessel] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [planningRecipeId, setPlanningRecipeId] = useState<string | null>(null);
  const [cookingRecipeId, setCookingRecipeId] = useState<string | null>(null);

  const yourTimes = useMemo(() => yourTimeByRecipe(cookLog), [cookLog]);
  const fridgeLeftovers = useMemo(() => freshFridgeLeftovers(leftovers), [leftovers]);

  const activeWindow = mealWindowFor(mealType);
  const todayKey = localDateKey(new Date());
  const plannedSlot = slotFor(plan, todayKey, mealType);
  const plannedRecipe = plannedSlot?.recipeId
    ? recipes.recipes.find((recipe) => recipe.id === plannedSlot.recipeId)
    : undefined;
  const selectedRecipe = selectedRecipeId
    ? recipes.recipes.find((recipe) => recipe.id === selectedRecipeId)
    : undefined;
  const planningRecipe = planningRecipeId
    ? recipes.recipes.find((recipe) => recipe.id === planningRecipeId)
    : undefined;
  const cookingRecipe = cookingRecipeId
    ? recipes.recipes.find((recipe) => recipe.id === cookingRecipeId)
    : undefined;
  const suggestions = useMemo(
    () => suggestMeal(recipes, inventory, { mealType, energy, oneVessel, limit: 2 }),
    [energy, inventory, mealType, oneVessel, recipes],
  );

  // Cards lead with total (the plan-around number); your-time wins once it exists.
  function timeLabel(recipe: { id: string; activeMinutes: number; totalMinutes?: number }): string {
    const yours = yourTimes.get(recipe.id);
    return yours !== undefined ? `your time ~${yours} min` : `${recipe.totalMinutes ?? recipe.activeMinutes} min`;
  }

  // Apply every "done cooking" side effect at once (§7.9) via the shared
  // orchestrator, persist each affected store, and mark a matching planned slot
  // cooked (Today is the only slot-bound surface).
  function saveCook(recipeId: string, outcome: CookOutcome): void {
    const next = applyCook({ recipes, inventory, cookLog, leftovers }, recipeId, outcome);
    setRecipes(next.recipes);
    saveRecipes(next.recipes);
    setInventory(next.inventory);
    saveInventory(next.inventory);
    setCookLog(next.cookLog);
    saveCookLog(next.cookLog);
    setLeftovers(next.leftovers);
    saveLeftovers(next.leftovers);

    if (plannedSlot?.recipeId === recipeId && plannedSlot.status !== "cooked") {
      const nextPlan = markSlotCooked(plan, todayKey, mealType);
      setPlan(nextPlan);
      saveMealPlan(nextPlan);
    }

    setCookingRecipeId(null);
  }

  function ateLeftover(id: string): void {
    const next = removeLeftover(leftovers, id);
    setLeftovers(next);
    saveLeftovers(next);
  }

  function clearPlannedSlot(): void {
    const next = clearSlot(plan, todayKey, mealType);
    setPlan(next);
    saveMealPlan(next);
  }

  const suggestionCards = suggestions.map((suggestion) => (
    <button
      className="today-pick"
      key={suggestion.recipe.id}
      onClick={() => setSelectedRecipeId(suggestion.recipe.id)}
      type="button"
    >
      <div className="today-pick__main">
        <h2>{suggestion.recipe.title}</h2>
        <p className="muted xs">
          {timeLabel(suggestion.recipe)} · {suggestion.recipe.cleanup} cleanup
        </p>
      </div>
      <div className="chips today-pick__reasons">
        {suggestion.reasons.map((reason) => (
          <span className="chip chip--teal" key={reason}>
            {reason}
          </span>
        ))}
      </div>
    </button>
  ));

  return (
    <div className="shell today-shell">
      <header className="page-header today-header">
        <div>
          <h1 className="page-title">Today</h1>
          <p className="muted sm">
            {activeWindow.label} · {mealWindowLabel(activeWindow)}
          </p>
        </div>
        <button
          className="button button--ghost"
          title="Settings"
          onClick={() => onNavigate("settings")}
          type="button"
        >
          <Icon name="settings" size={18} />
        </button>
      </header>

      <section className="today-meals" aria-label="Meal">
        {DEFAULT_MEAL_WINDOWS.map((window) => (
          <button
            className={`today-meal${mealType === window.meal ? " today-meal--on" : ""}`}
            key={window.meal}
            onClick={() => setMealType(window.meal)}
            type="button"
          >
            <Icon name={MEAL_ICONS[window.meal]} size={17} />
            <span>{window.shortLabel}</span>
          </button>
        ))}
      </section>

      <section className="today-controls">
        <div className="chips" aria-label="Energy level">
          {ENERGY.map((level) => (
            <button
              className={`chip${energy === level ? " chip--on" : ""}`}
              key={level}
              onClick={() => setEnergy(level)}
              type="button"
            >
              {titleCase(level)}
            </button>
          ))}
        </div>
        <button
          className={`chip${oneVessel ? " chip--herb" : ""}`}
          onClick={() => setOneVessel((v) => !v)}
          type="button"
        >
          One vessel
        </button>
      </section>

      {plannedRecipe ? (
        <section className={`today-planned${plannedSlot?.status === "cooked" ? " today-planned--cooked" : ""}`}>
          <div className="today-planned__label">
            <span>{plannedSlot?.status === "cooked" ? "Cooked" : "Planned"}</span>
            <button className="button button--ghost button--small" onClick={clearPlannedSlot} type="button">
              Clear
            </button>
          </div>
          <button
            className="today-pick today-pick--planned"
            onClick={() => setSelectedRecipeId(plannedRecipe.id)}
            type="button"
          >
            <div className="today-pick__main">
              <h2>{plannedRecipe.title}</h2>
              <p className="muted xs">
                {timeLabel(plannedRecipe)} · {plannedRecipe.cleanup} cleanup
              </p>
            </div>
            <div className="chips today-pick__reasons">
              <span className="chip chip--herb">{activeWindow.shortLabel}</span>
            </div>
          </button>
          {plannedSlot?.status !== "cooked" ? (
            <button className="button button--success today-cooked" onClick={() => setCookingRecipeId(plannedRecipe.id)} type="button">
              <Icon name="check" size={16} />
              Cooked it
            </button>
          ) : null}
        </section>
      ) : null}

      {fridgeLeftovers.length > 0 ? (
        <section className="today-leftovers" aria-label="Leftovers">
          {fridgeLeftovers.map((leftover) => (
            <div className="banner banner--warning today-leftover" key={leftover.id}>
              <Icon name="fridge" size={16} />
              <button
                className="today-leftover__main"
                onClick={() => setSelectedRecipeId(leftover.recipeId)}
                type="button"
              >
                <strong>{leftover.title}</strong>
                <span className="muted xs">
                  {leftover.portions} left · {eatByLabel(leftover)}
                </span>
              </button>
              <button className="button button--ghost button--small" onClick={() => ateLeftover(leftover.id)} type="button">
                Ate it
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <section className="today-suggestions">
        {plannedRecipe ? (
          <details className="today-other">
            <summary>Other ideas</summary>
            <div className="today-other__body">
              {suggestions.length > 0 ? suggestionCards : <p className="muted sm">No other ideas fit those filters.</p>}
            </div>
          </details>
        ) : suggestions.length > 0 ? (
          suggestionCards
        ) : (
          <div className="card today-empty">
            <p className="muted sm">No {activeWindow.label.toLowerCase()} fits those filters yet.</p>
            <button className="button button--small" onClick={() => onNavigate("recipes")} type="button">
              <Icon name="book" size={15} />
              Recipes
            </button>
          </div>
        )}
      </section>

      <div className="today-links">
        <button className="banner banner--herb today-garden" onClick={() => onNavigate("kitchen")} type="button">
          <Icon name="leaf" size={16} />
          <span>Garden counts live here soon</span>
        </button>
        <details className="today-details">
          <summary>Data</summary>
          <p className="muted xs">
            {recipes.recipes.length} recipes · {inventory.items.length} inventory items. Walmart,
            garden sync, and GitHub persistence are not connected yet.
          </p>
        </details>
      </div>

      {selectedRecipe ? (
        <RecipeDetail
          recipe={selectedRecipe}
          yourTime={yourTimes.get(selectedRecipe.id)}
          onClose={() => setSelectedRecipeId(null)}
          onCooked={() => {
            setCookingRecipeId(selectedRecipe.id);
            setSelectedRecipeId(null);
          }}
          onPlan={() => {
            setPlanningRecipeId(selectedRecipe.id);
            setSelectedRecipeId(null);
          }}
        />
      ) : null}
      {cookingRecipe ? (
        <CookLogSheet
          recipe={cookingRecipe}
          baseMinutes={yourTimes.get(cookingRecipe.id) ?? cookingRecipe.activeMinutes}
          onSave={(result) => saveCook(cookingRecipe.id, result)}
          onClose={() => setCookingRecipeId(null)}
        />
      ) : null}
      {planningRecipe ? (
        <PlanRecipeSheet
          recipe={planningRecipe}
          defaultMealType={mealType}
          onSaved={setPlan}
          onClose={() => setPlanningRecipeId(null)}
        />
      ) : null}
    </div>
  );
}
