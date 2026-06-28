import { useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import { CookLogSheet } from "../components/CookLogSheet";
import { PlanRecipeSheet } from "../components/PlanRecipeSheet";
import { RecipeDetail } from "../components/RecipeDetail";
import { loadRecipes, saveRecipes } from "../clients/recipesStore";
import { loadInventory, saveInventory } from "../clients/inventoryStore";
import { loadCookLog, saveCookLog } from "../clients/cookLogStore";
import { loadLeftovers, saveLeftovers } from "../clients/leftoversStore";
import { applyCook, type CookOutcome } from "../domain/cook";
import { yourTimeByRecipe } from "../domain/cookLog";
import {
  abbreviateUnits,
  addRecipe,
  CLEANUP_SCORES,
  durationLabel,
  FORMS,
  ingredientNames,
  MEAL_TYPES,
  recipesForQuery,
  removeRecipe,
  ROLES,
  toggleBookmark,
  updateRecipe,
  VESSELS,
  type CleanupScore,
  type MealType,
  type Recipe,
  type RecipeBook,
  type RecipeForm,
  type RecipeInput,
  type RecipeRole,
  type Vessel,
} from "../domain/recipes";

// Browser filter chips — one row per taxonomy axis. Only values present in the
// corpus are shown. Plural display labels, canonical order.
const FORM_FILTERS: Array<{ value: RecipeForm; label: string }> = [
  { value: "soup", label: "Soups" },
  { value: "stew", label: "Stews" },
  { value: "salad", label: "Salads" },
  { value: "pasta", label: "Pasta" },
  { value: "pizza", label: "Pizza" },
  { value: "sandwich", label: "Sandwiches" },
  { value: "stir-fry", label: "Stir-fries" },
  { value: "roast", label: "Roasts" },
  { value: "bake", label: "Bakes" },
  { value: "grain-bowl", label: "Grain bowls" },
  { value: "bread", label: "Breads" },
  { value: "sauce", label: "Sauces" },
  { value: "beverage", label: "Beverages" },
];
const ROLE_FILTERS: Array<{ value: RecipeRole; label: string }> = [
  { value: "main", label: "Mains" },
  { value: "side", label: "Sides" },
  { value: "appetizer", label: "Starters" },
  { value: "snack", label: "Snacks" },
  { value: "dessert", label: "Desserts" },
  { value: "drink", label: "Drinks" },
];

const ONE_VESSEL_VESSELS: Vessel[] = ["one_pot", "sheet_pan", "skillet", "no_cook"];

type FormMode = "closed" | "new" | "edit";

interface IngredientRow {
  quantity: string;
  name: string;
  note: string;
}

interface RecipeFormState {
  title: string;
  ingredients: IngredientRow[];
  activeMinutes: string;
  servings: string;
  mealTypes: MealType[];
  vessel: Vessel;
  cleanup: CleanupScore;
  form: RecipeForm | "";
  role: RecipeRole | "";
  proteinGrams: string;
  fiberGrams: string;
  lastNote: string;
}

const BLANK_INGREDIENT: IngredientRow = { quantity: "", name: "", note: "" };

const EMPTY_FORM: RecipeFormState = {
  title: "",
  ingredients: [{ ...BLANK_INGREDIENT }],
  activeMinutes: "30",
  servings: "",
  mealTypes: ["dinner"],
  vessel: "skillet",
  cleanup: "medium",
  form: "",
  role: "",
  proteinGrams: "",
  fiberGrams: "",
  lastNote: "",
};

function titleCase(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formFromRecipe(recipe?: Recipe): RecipeFormState {
  if (!recipe) return EMPTY_FORM;
  const ingredients = recipe.ingredients.map((ingredient) => ({
    quantity: ingredient.quantity ? abbreviateUnits(ingredient.quantity) : "",
    name: ingredient.name,
    note: ingredient.note ?? "",
  }));
  return {
    title: recipe.title,
    ingredients: ingredients.length ? ingredients : [{ ...BLANK_INGREDIENT }],
    activeMinutes: String(recipe.activeMinutes),
    servings: recipe.servings === undefined ? "" : String(recipe.servings),
    mealTypes: recipe.mealTypes,
    vessel: recipe.vessel,
    cleanup: recipe.cleanup,
    form: recipe.form ?? "",
    role: recipe.role ?? "",
    proteinGrams: recipe.nutrition?.proteinGrams === undefined ? "" : String(recipe.nutrition.proteinGrams),
    fiberGrams: recipe.nutrition?.fiberGrams === undefined ? "" : String(recipe.nutrition.fiberGrams),
    lastNote: recipe.lastNote ?? "",
  };
}

function optionalNumber(value: string): number | undefined {
  const n = Number(value);
  return value.trim() && Number.isFinite(n) ? n : undefined;
}

function inputFromForm(form: RecipeFormState, existing?: Recipe): RecipeInput {
  return {
    title: form.title,
    ingredients: form.ingredients.map((row) => ({
      name: row.name,
      quantity: row.quantity,
      note: row.note,
    })),
    activeMinutes: Number(form.activeMinutes),
    mealTypes: form.mealTypes,
    vessel: form.vessel,
    cleanup: form.cleanup,
    genres: existing?.genres ?? [],
    nutrition: {
      proteinGrams: optionalNumber(form.proteinGrams),
      fiberGrams: optionalNumber(form.fiberGrams),
    },
    containsPeanuts: existing?.containsPeanuts,
    containsTreeNuts: existing?.containsTreeNuts,
    bookmarked: existing?.bookmarked,
    lastNote: form.lastNote,
    form: form.form || undefined,
    role: form.role || undefined,
    servings: optionalNumber(form.servings),
    // Carry over fields the form doesn't edit (mostly import-derived) so editing a
    // recipe never silently strips them.
    totalMinutes: existing?.totalMinutes,
    mainIngredient: existing?.mainIngredient,
    description: existing?.description,
    source: existing?.source,
    reviewed: existing?.reviewed,
  };
}

function saveBook(next: RecipeBook, setBook: (book: RecipeBook) => void): void {
  setBook(next);
  saveRecipes(next);
}

// The household corpus browser (requirements §7.7–§7.8). Discovery happens at
// import time, never while hungry — nothing from the internet unless imported.
export function Recipes() {
  const [book, setBook] = useState<RecipeBook>(() => loadRecipes());
  const [inventory, setInventory] = useState(() => loadInventory());
  const [cookLog, setCookLog] = useState(() => loadCookLog());
  const [leftovers, setLeftovers] = useState(() => loadLeftovers());
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [planningId, setPlanningId] = useState<string | null>(null);
  const [cookingId, setCookingId] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<FormMode>("closed");
  const [editFromPreview, setEditFromPreview] = useState(false);
  const [form, setForm] = useState<RecipeFormState>(EMPTY_FORM);
  const [formFilter, setFormFilter] = useState<RecipeForm | null>(null);
  const [roleFilter, setRoleFilter] = useState<RecipeRole | null>(null);
  const [onlyOneVessel, setOnlyOneVessel] = useState(false);
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);

  const yourTimes = useMemo(() => yourTimeByRecipe(cookLog), [cookLog]);
  // Which filter chips to show — only values present in the corpus, canonical order.
  const formChips = useMemo(() => {
    const present = new Set(book.recipes.map((r) => r.form).filter(Boolean));
    return FORM_FILTERS.filter((c) => present.has(c.value));
  }, [book]);
  const roleChips = useMemo(() => {
    const present = new Set(book.recipes.map((r) => r.role).filter(Boolean));
    return ROLE_FILTERS.filter((c) => present.has(c.value));
  }, [book]);
  const searched = useMemo(() => recipesForQuery(book, query), [book, query]);
  const recipes = useMemo(
    () =>
      searched.filter((r) => {
        if (formFilter && r.form !== formFilter) return false;
        if (roleFilter && r.role !== roleFilter) return false;
        if (onlyBookmarked && !r.bookmarked) return false;
        if (onlyOneVessel && !(ONE_VESSEL_VESSELS.includes(r.vessel) && r.cleanup !== "high")) return false;
        return true;
      }),
    [searched, formFilter, roleFilter, onlyBookmarked, onlyOneVessel],
  );
  const selected = selectedId ? book.recipes.find((recipe) => recipe.id === selectedId) : undefined;
  const editing = editingId ? book.recipes.find((recipe) => recipe.id === editingId) : undefined;
  const planning = planningId ? book.recipes.find((recipe) => recipe.id === planningId) : undefined;
  const cooking = cookingId ? book.recipes.find((recipe) => recipe.id === cookingId) : undefined;
  const ingredientCount = useMemo(() => ingredientNames(book).length, [book]);
  const bookmarkedCount = book.recipes.filter((recipe) => recipe.bookmarked).length;

  function startNew(): void {
    setEditingId(null);
    setSelectedId(null);
    setEditFromPreview(false);
    setFormMode("new");
    setForm(EMPTY_FORM);
  }

  function startEdit(recipe: Recipe): void {
    setEditFromPreview(selectedId === recipe.id);
    setEditingId(recipe.id);
    setSelectedId(null);
    setFormMode("edit");
    setForm(formFromRecipe(recipe));
  }

  function closeForm(): void {
    setEditingId(null);
    setEditFromPreview(false);
    setFormMode("closed");
    setForm(EMPTY_FORM);
  }

  function setMealType(meal: MealType): void {
    setForm((current) => {
      const hasMeal = current.mealTypes.includes(meal);
      const mealTypes = hasMeal
        ? current.mealTypes.filter((existing) => existing !== meal)
        : [...current.mealTypes, meal];
      return { ...current, mealTypes: mealTypes.length ? mealTypes : ["dinner"] };
    });
  }

  function saveForm(): void {
    const input = inputFromForm(form, editing);
    const next = editingId ? updateRecipe(book, editingId, input) : addRecipe(book, input);
    saveBook(next, setBook);
    closeForm();
  }

  function removeEditing(): void {
    if (!editing) return;
    if (!window.confirm(`Remove "${editing.title}" from the household corpus?`)) return;
    const next = removeRecipe(book, editing.id);
    saveBook(next, setBook);
    closeForm();
  }

  function toggleRecipe(recipeId: string): void {
    const next = toggleBookmark(book, recipeId);
    saveBook(next, setBook);
    if (editingId === recipeId) {
      const updated = next.recipes.find((recipe) => recipe.id === recipeId);
      if (updated) setForm(formFromRecipe(updated));
    }
  }

  // Full done-cooking loop (§7.9), shared with Today via applyCook.
  function saveCook(recipeId: string, outcome: CookOutcome): void {
    const next = applyCook({ recipes: book, inventory, cookLog, leftovers }, recipeId, outcome);
    saveBook(next.recipes, setBook);
    setInventory(next.inventory);
    saveInventory(next.inventory);
    setCookLog(next.cookLog);
    saveCookLog(next.cookLog);
    setLeftovers(next.leftovers);
    saveLeftovers(next.leftovers);
    setCookingId(null);
  }

  function setIngredient(index: number, patch: Partial<IngredientRow>): void {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  }
  function addIngredient(): void {
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { ...BLANK_INGREDIENT }] }));
  }
  function removeIngredient(index: number): void {
    setForm((f) => ({
      ...f,
      ingredients:
        f.ingredients.length > 1 ? f.ingredients.filter((_, i) => i !== index) : [{ ...BLANK_INGREDIENT }],
    }));
  }

  const canSave =
    form.title.trim().length > 0 && form.ingredients.some((row) => row.name.trim().length > 0);
  const formOpen = formMode !== "closed";

  return (
    <div className="shell recipes-shell">
      <header className="page-header">
        <div>
          <h1 className="page-title">Recipes</h1>
          <p className="muted sm">
            {book.recipes.length} recipes · {bookmarkedCount} to make · {ingredientCount} ingredients
          </p>
        </div>
        <button className="button button--primary" onClick={startNew} type="button">
          <Icon name="plus" size={16} />
          New
        </button>
      </header>

      <div className="recipes-layout">
        <section>
          <label className="label" htmlFor="recipe-search">
            Search household corpus
          </label>
          <div className="recipe-search">
            <Icon name="search" size={16} />
            <input
              id="recipe-search"
              className="input recipe-search__input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Title or ingredient"
            />
          </div>

          {roleChips.length > 0 ? (
            <div className="chips recipe-filters" aria-label="Filter by role">
              <button
                className={`chip${roleFilter === null ? " chip--on" : ""}`}
                onClick={() => setRoleFilter(null)}
                type="button"
              >
                All
              </button>
              {roleChips.map(({ value, label }) => (
                <button
                  className={`chip${roleFilter === value ? " chip--on" : ""}`}
                  key={value}
                  onClick={() => setRoleFilter(roleFilter === value ? null : value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
              <span className="recipe-filters__sep" aria-hidden="true" />
              <button
                className={`chip${onlyOneVessel ? " chip--herb" : ""}`}
                onClick={() => setOnlyOneVessel((v) => !v)}
                type="button"
              >
                One vessel
              </button>
              <button
                className={`chip${onlyBookmarked ? " chip--herb" : ""}`}
                onClick={() => setOnlyBookmarked((v) => !v)}
                type="button"
              >
                To make
              </button>
            </div>
          ) : null}

          {formChips.length > 0 ? (
            <div className="chips recipe-filters" aria-label="Filter by form">
              <button
                className={`chip${formFilter === null ? " chip--on" : ""}`}
                onClick={() => setFormFilter(null)}
                type="button"
              >
                Any form
              </button>
              {formChips.map(({ value, label }) => (
                <button
                  className={`chip${formFilter === value ? " chip--on" : ""}`}
                  key={value}
                  onClick={() => setFormFilter(formFilter === value ? null : value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="recipe-list">
            {recipes.map((recipe) => (
              <article
                className={`recipe-row${selectedId === recipe.id ? " recipe-row--on" : ""}`}
                key={recipe.id}
              >
                <button className="recipe-row__main" onClick={() => setSelectedId(recipe.id)} type="button">
                  <span className="recipe-row__title">{recipe.title}</span>
                  <span className="recipe-row__meta">
                    {durationLabel(recipe.activeMinutes, recipe.totalMinutes)} ·{" "}
                    {titleCase(recipe.vessel.replace("_", " "))} · {titleCase(recipe.cleanup)} cleanup
                  </span>
                  {recipe.source ? (
                    <span className="recipe-row__source">{recipe.source.book}</span>
                  ) : null}
                  {recipe.containsPeanuts || recipe.containsTreeNuts ? (
                    <span className="chips recipe-row__chips">
                      <span className="chip chip--amber">Allergen</span>
                    </span>
                  ) : null}
                </button>
                <button
                  className={`recipe-bookmark${recipe.bookmarked ? " recipe-bookmark--on" : ""}`}
                  onClick={() => toggleRecipe(recipe.id)}
                  title={recipe.bookmarked ? "Remove from to make" : "Add to to make"}
                  type="button"
                >
                  <Icon name="check" size={15} />
                </button>
              </article>
            ))}
            {recipes.length === 0 ? (
              <div className="card recipe-empty">
                <p className="muted sm">
                  No recipes match
                  {formFilter || roleFilter || onlyOneVessel || onlyBookmarked ? " those filters" : query ? " this search" : ""}.
                </p>
              </div>
            ) : null}
          </div>
        </section>

      </div>

      <p className="foot">Browsing your {book.recipes.length} recipes — nothing from the internet unless you import it.</p>

      {formOpen ? (
        <div
          className={`sheet-backdrop recipe-edit-backdrop${
            editFromPreview ? " recipe-edit-backdrop--from-preview" : ""
          }`}
          role="presentation"
        >
          <div
            className={`recipe-folder-shell${
              editFromPreview ? " recipe-folder-shell--from-preview" : ""
            }`}
            data-tab={editing ? "Edit" : "New"}
          >
            <section className="card recipe-form recipe-form--sheet">
              <div className="recipe-form__head">
                <div>
                  <h2 className="card__title">{editing ? "Edit recipe" : "Manual recipe"}</h2>
                  <p className="muted xs">Saved recipes become the corpus Today will score.</p>
                </div>
              </div>

              <div className="form-grid">
              <label>
                <span className="label">Title</span>
                <input
                  className="input"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="e.g. Caprese pasta"
                />
              </label>

              <label>
                <span className="label">Active minutes</span>
                <input
                  className="input"
                  inputMode="numeric"
                  min={1}
                  type="number"
                  value={form.activeMinutes}
                  onChange={(event) => setForm({ ...form, activeMinutes: event.target.value })}
                />
              </label>
            </div>

            <div className="ingredient-editor">
              <span className="label">Ingredients</span>
              <div className="ingredient-rows">
                {form.ingredients.map((row, index) => (
                  <div className="ingredient-row" key={index}>
                    <input
                      className="input ingredient-row__qty"
                      value={row.quantity}
                      onChange={(event) => setIngredient(index, { quantity: event.target.value })}
                      placeholder="1 lb"
                      aria-label={`Ingredient ${index + 1} quantity`}
                    />
                    <input
                      className="input ingredient-row__name"
                      value={row.name}
                      onChange={(event) => setIngredient(index, { name: event.target.value })}
                      placeholder="ingredient"
                      aria-label={`Ingredient ${index + 1} name`}
                    />
                    <input
                      className="input ingredient-row__note"
                      value={row.note}
                      onChange={(event) => setIngredient(index, { note: event.target.value })}
                      placeholder="prep (optional)"
                      aria-label={`Ingredient ${index + 1} note`}
                    />
                    <button
                      className="button button--ghost button--small ingredient-row__remove"
                      onClick={() => removeIngredient(index)}
                      type="button"
                      title="Remove ingredient"
                      aria-label={`Remove ingredient ${index + 1}`}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button className="button button--small ingredient-add" onClick={addIngredient} type="button">
                <Icon name="plus" size={14} />
                Add ingredient
              </button>
            </div>

            <div className="form-grid">
              <label>
                <span className="label">Vessel</span>
                <select
                  className="select"
                  value={form.vessel}
                  onChange={(event) => setForm({ ...form, vessel: event.target.value as Vessel })}
                >
                  {VESSELS.map((vessel) => (
                    <option key={vessel} value={vessel}>
                      {titleCase(vessel)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="label">Cleanup</span>
                <select
                  className="select"
                  value={form.cleanup}
                  onChange={(event) => setForm({ ...form, cleanup: event.target.value as CleanupScore })}
                >
                  {CLEANUP_SCORES.map((cleanup) => (
                    <option key={cleanup} value={cleanup}>
                      {titleCase(cleanup)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-grid">
              <label>
                <span className="label">Form</span>
                <select
                  className="select"
                  value={form.form}
                  onChange={(event) => setForm({ ...form, form: event.target.value as RecipeForm | "" })}
                >
                  <option value="">— None —</option>
                  {FORMS.map((value) => (
                    <option key={value} value={value}>
                      {titleCase(value)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="label">Role</span>
                <select
                  className="select"
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value as RecipeRole | "" })}
                >
                  <option value="">— None —</option>
                  {ROLES.map((value) => (
                    <option key={value} value={value}>
                      {titleCase(value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-grid">
              <label>
                <span className="label">Servings</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={99}
                  value={form.servings}
                  onChange={(event) => setForm({ ...form, servings: event.target.value })}
                  placeholder="e.g. 4"
                />
              </label>
            </div>

            <div>
              <span className="label">Meal types</span>
              <div className="chips">
                {MEAL_TYPES.map((meal) => (
                  <button
                    className={`chip${form.mealTypes.includes(meal) ? " chip--on" : ""}`}
                    key={meal}
                    onClick={() => setMealType(meal)}
                    type="button"
                  >
                    {titleCase(meal)}
                  </button>
                ))}
              </div>
            </div>

            <details className="recipe-details">
              <summary>Nutrition &amp; notes</summary>
              <div className="recipe-details__body">
                <div className="form-grid">
                  <label>
                    <span className="label">Protein / portion (est.)</span>
                    <input
                      className="input"
                      inputMode="numeric"
                      min={0}
                      type="number"
                      value={form.proteinGrams}
                      onChange={(event) => setForm({ ...form, proteinGrams: event.target.value })}
                      placeholder="38"
                    />
                  </label>
                  <label>
                    <span className="label">Fiber / portion (est.)</span>
                    <input
                      className="input"
                      inputMode="numeric"
                      min={0}
                      type="number"
                      value={form.fiberGrams}
                      onChange={(event) => setForm({ ...form, fiberGrams: event.target.value })}
                      placeholder="9"
                    />
                  </label>
                </div>

                <label>
                  <span className="label">Past note</span>
                  <textarea
                    className="textarea recipe-note serif"
                    value={form.lastNote}
                    onChange={(event) => setForm({ ...form, lastNote: event.target.value })}
                    placeholder="Cook notes live here once this has history."
                  />
                </label>
              </div>
            </details>

            <div className="recipe-actions">
              <div>
                {editing ? (
                  <button className="button button--danger" onClick={removeEditing} type="button">
                    <Icon name="x" size={15} />
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="recipe-actions__right">
                <button className="button" onClick={closeForm} type="button">
                  Cancel
                </button>
                <button className="button button--success" disabled={!canSave} onClick={saveForm} type="button">
                  <Icon name="check" size={16} />
                  Save recipe
                </button>
              </div>
            </div>
          </section>
          </div>
        </div>
      ) : null}

      {selected ? (
        <RecipeDetail
          recipe={selected}
          yourTime={yourTimes.get(selected.id)}
          onClose={() => setSelectedId(null)}
          onCooked={() => {
            setCookingId(selected.id);
            setSelectedId(null);
          }}
          onEdit={() => startEdit(selected)}
          onPlan={() => {
            setPlanningId(selected.id);
            setSelectedId(null);
          }}
        />
      ) : null}
      {cooking ? (
        <CookLogSheet
          recipe={cooking}
          baseMinutes={yourTimes.get(cooking.id) ?? cooking.activeMinutes}
          onSave={(outcome) => saveCook(cooking.id, outcome)}
          onClose={() => setCookingId(null)}
        />
      ) : null}
      {planning ? (
        <PlanRecipeSheet recipe={planning} onClose={() => setPlanningId(null)} />
      ) : null}
    </div>
  );
}
