import { normalizeName } from "./normalize";

export type MealType = "breakfast" | "lunch" | "dinner" | "late_night";
export type Vessel = "one_pot" | "sheet_pan" | "skillet" | "oven" | "no_cook" | "multiple";
export type CleanupScore = "low" | "medium" | "high";
// Two orthogonal taxonomy axes (a dish can be a soup AND a main):
//   form = what the dish IS (its structure)
//   role = the part of the meal it plays
// Both derived at import, refined by the LLM pass, editable, and filtered on
// independently in the browser. (vessel covers cooking method, genres cover cuisine,
// mealTypes cover time of day.)
export type RecipeForm =
  | "soup" | "stew" | "salad" | "sandwich" | "pizza" | "pasta" | "stir-fry"
  | "roast" | "bake" | "grain-bowl" | "bread" | "sauce" | "beverage";
export type RecipeRole = "main" | "side" | "appetizer" | "snack" | "dessert" | "drink";

export interface RecipeIngredient {
  name: string;
  quantity?: string; // e.g. "1 1/2 pounds" — display only; inventory matching keys on name
  note?: string;
}

export interface NutritionEstimate {
  proteinGrams?: number;
  fiberGrams?: number;
}

// Provenance for imported recipes (manual recipes have none).
export interface RecipeSource {
  book: string;
  chapter?: string;
}

export interface Recipe {
  id: string;
  title: string;
  ingredients: RecipeIngredient[];
  activeMinutes: number;
  totalMinutes?: number; // claimed start-to-finish; a footnote once your-time exists (§6.6)
  servings?: number;
  mealTypes: MealType[];
  vessel: Vessel;
  cleanup: CleanupScore;
  genres: string[];
  form?: RecipeForm;
  role?: RecipeRole;
  mainIngredient?: string;
  nutrition?: NutritionEstimate;
  containsPeanuts?: boolean;
  containsTreeNuts?: boolean;
  bookmarked?: boolean;
  cookedCount: number;
  description?: string; // the book's headnote (distinct from lastNote's personal past-notes)
  lastNote?: string;
  source?: RecipeSource;
  reviewed?: boolean; // imported recipes await review; reviewed === false hides from the suggester
  createdAt: string;
  updatedAt: string;
}

export interface RecipeInput {
  title: string;
  ingredients: RecipeIngredient[];
  activeMinutes: number;
  totalMinutes?: number;
  servings?: number;
  mealTypes: MealType[];
  vessel: Vessel;
  cleanup: CleanupScore;
  genres?: string[];
  form?: RecipeForm;
  role?: RecipeRole;
  mainIngredient?: string;
  nutrition?: NutritionEstimate;
  containsPeanuts?: boolean;
  containsTreeNuts?: boolean;
  bookmarked?: boolean;
  cookedCount?: number;
  description?: string;
  lastNote?: string;
  source?: RecipeSource;
  reviewed?: boolean;
}

export interface RecipeBook {
  recipes: Recipe[];
}

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "late_night"];
export const VESSELS: Vessel[] = ["one_pot", "sheet_pan", "skillet", "oven", "no_cook", "multiple"];
export const CLEANUP_SCORES: CleanupScore[] = ["low", "medium", "high"];
export const FORMS: RecipeForm[] = [
  "soup", "stew", "salad", "sandwich", "pizza", "pasta", "stir-fry",
  "roast", "bake", "grain-bowl", "bread", "sauce", "beverage",
];
export const ROLES: RecipeRole[] = ["main", "side", "appetizer", "snack", "dessert", "drink"];

// Abbreviate spelled-out units for compact display (e.g. "1 1/2 pounds" → "1 1/2
// lb"). Display-only — stored quantity strings keep their original wording. Words
// that are already short (cup, clove, can…) are left alone.
const UNIT_ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\bpounds?\b/gi, "lb"],
  [/\blbs\b/gi, "lb"],
  [/\bounces?\b/gi, "oz"],
  [/\btablespoons?\b/gi, "tbsp"],
  [/\bteaspoons?\b/gi, "tsp"],
  [/\bkilograms?\b/gi, "kg"],
  [/\bgrams?\b/gi, "g"],
  [/\bquarts?\b/gi, "qt"],
  [/\bpints?\b/gi, "pt"],
  [/\bgallons?\b/gi, "gal"],
  [/\bmilliliters?\b/gi, "ml"],
  [/\bliters?\b/gi, "L"],
  [/\binch(?:es)?\b/gi, "in"],
];

export function abbreviateUnits(text: string): string {
  let out = text;
  for (const [re, abbr] of UNIT_ABBREVIATIONS) out = out.replace(re, abbr);
  return out;
}

// Total is the number the household plans around, so it leads:
// "50 min total · 30 min active" when a distinct active exists, else just "50 min".
export function durationLabel(activeMinutes: number, totalMinutes?: number): string {
  if (totalMinutes !== undefined && totalMinutes !== activeMinutes) {
    return `${totalMinutes} min total · ${activeMinutes} min active`;
  }
  return `${totalMinutes ?? activeMinutes} min`;
}

export function emptyRecipeBook(): RecipeBook {
  return { recipes: [] };
}

function uid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `recipe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cleanIngredient(input: RecipeIngredient): RecipeIngredient | null {
  const name = input.name.trim();
  if (!name) return null;
  const note = input.note?.trim();
  const quantity = input.quantity?.trim();
  return {
    name,
    ...(quantity ? { quantity } : {}),
    ...(note ? { note } : {}),
  };
}

export function cleanGenres(input: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const genre = raw.trim();
    const key = normalizeName(genre);
    if (!genre || seen.has(key)) continue;
    seen.add(key);
    out.push(genre);
  }
  return out;
}

function cleanMealTypes(input: MealType[] | undefined): MealType[] {
  const raw = Array.isArray(input) ? input : [];
  const kept = MEAL_TYPES.filter((meal) => raw.includes(meal));
  return kept.length ? kept : ["dinner"];
}

function cleanMinutes(n: number): number {
  if (!Number.isFinite(n)) return 30;
  return Math.min(360, Math.max(1, Math.round(n)));
}

// Optional positive minutes (totalMinutes) — undefined stays undefined, unlike
// the required activeMinutes which defaults.
function cleanOptionalMinutes(n: number | undefined): number | undefined {
  if (n === undefined || !Number.isFinite(n)) return undefined;
  return Math.min(360, Math.max(1, Math.round(n)));
}

function cleanServings(n: number | undefined): number | undefined {
  if (n === undefined || !Number.isFinite(n)) return undefined;
  const v = Math.round(n);
  return v >= 1 ? Math.min(99, v) : undefined;
}

function cleanSource(input?: RecipeSource): RecipeSource | undefined {
  const book = input?.book?.trim();
  if (!book) return undefined;
  const chapter = input?.chapter?.trim();
  return chapter ? { book, chapter } : { book };
}

function cleanNutrition(input?: NutritionEstimate): NutritionEstimate | undefined {
  const proteinGrams =
    input?.proteinGrams === undefined ? undefined : Math.max(0, Math.round(input.proteinGrams));
  const fiberGrams =
    input?.fiberGrams === undefined ? undefined : Math.max(0, Math.round(input.fiberGrams));
  return proteinGrams === undefined && fiberGrams === undefined
    ? undefined
    : { ...(proteinGrams !== undefined ? { proteinGrams } : {}), ...(fiberGrams !== undefined ? { fiberGrams } : {}) };
}

export function normalizeRecipeInput(input: RecipeInput): Omit<Recipe, "id" | "createdAt" | "updatedAt"> {
  const ingredients = input.ingredients.map(cleanIngredient).filter((i): i is RecipeIngredient => Boolean(i));
  const nutrition = cleanNutrition(input.nutrition);
  const totalMinutes = cleanOptionalMinutes(input.totalMinutes);
  const servings = cleanServings(input.servings);
  const source = cleanSource(input.source);
  // "curry" folded into "stew" — alias any legacy value before validating.
  const rawForm = (input.form as string) === "curry" ? "stew" : input.form;
  const form = rawForm && FORMS.includes(rawForm) ? rawForm : undefined;
  const role = input.role && ROLES.includes(input.role) ? input.role : undefined;
  const mainIngredient = input.mainIngredient?.trim();
  const description = input.description?.trim();
  return {
    title: input.title.trim(),
    ingredients,
    activeMinutes: cleanMinutes(input.activeMinutes),
    ...(totalMinutes !== undefined ? { totalMinutes } : {}),
    ...(servings !== undefined ? { servings } : {}),
    mealTypes: cleanMealTypes(input.mealTypes),
    vessel: VESSELS.includes(input.vessel) ? input.vessel : "skillet",
    cleanup: CLEANUP_SCORES.includes(input.cleanup) ? input.cleanup : "medium",
    genres: cleanGenres(input.genres),
    ...(form ? { form } : {}),
    ...(role ? { role } : {}),
    ...(mainIngredient ? { mainIngredient } : {}),
    ...(nutrition ? { nutrition } : {}),
    ...(input.containsPeanuts ? { containsPeanuts: true } : {}),
    ...(input.containsTreeNuts ? { containsTreeNuts: true } : {}),
    ...(input.bookmarked ? { bookmarked: true } : {}),
    cookedCount: Math.max(0, Math.round(input.cookedCount ?? 0)),
    ...(description ? { description } : {}),
    ...(input.lastNote?.trim() ? { lastNote: input.lastNote.trim() } : {}),
    ...(source ? { source } : {}),
    ...(input.reviewed !== undefined ? { reviewed: input.reviewed } : {}),
  };
}

export function addRecipe(book: RecipeBook, input: RecipeInput): RecipeBook {
  const clean = normalizeRecipeInput(input);
  if (!clean.title || clean.ingredients.length === 0) return book;
  const stamp = nowIso();
  return {
    recipes: [...book.recipes, { ...clean, id: uid(), createdAt: stamp, updatedAt: stamp }],
  };
}

export function updateRecipe(book: RecipeBook, recipeId: string, input: RecipeInput): RecipeBook {
  const clean = normalizeRecipeInput(input);
  if (!clean.title || clean.ingredients.length === 0) return book;
  const stamp = nowIso();
  return {
    recipes: book.recipes.map((recipe) =>
      recipe.id === recipeId
        ? { ...clean, id: recipe.id, createdAt: recipe.createdAt, updatedAt: stamp }
        : recipe,
    ),
  };
}

export function removeRecipe(book: RecipeBook, recipeId: string): RecipeBook {
  return { recipes: book.recipes.filter((recipe) => recipe.id !== recipeId) };
}

export function toggleBookmark(book: RecipeBook, recipeId: string): RecipeBook {
  return {
    recipes: book.recipes.map((recipe) =>
      recipe.id === recipeId
        ? { ...recipe, bookmarked: !recipe.bookmarked, updatedAt: nowIso() }
        : recipe,
    ),
  };
}

// Record a cook: bump the count and, when a note is given, save it as the recipe's
// latest past-note (serif personal-memory material on the detail sheet).
export function markRecipeCooked(book: RecipeBook, recipeId: string, note?: string): RecipeBook {
  const trimmed = note?.trim();
  return {
    recipes: book.recipes.map((recipe) =>
      recipe.id === recipeId
        ? {
            ...recipe,
            cookedCount: recipe.cookedCount + 1,
            ...(trimmed ? { lastNote: trimmed } : {}),
            updatedAt: nowIso(),
          }
        : recipe,
    ),
  };
}

// Merge an imported book into the corpus, skipping titles already present
// (normalized) so re-importing the same file is idempotent. Returns the merged
// book plus how many were added vs. skipped — used by the Settings importer.
export function mergeRecipeBooks(
  base: RecipeBook,
  incoming: RecipeBook,
): { book: RecipeBook; added: number; skipped: number } {
  const seen = new Set(base.recipes.map((r) => normalizeName(r.title)));
  const additions: Recipe[] = [];
  let skipped = 0;
  for (const recipe of incoming.recipes) {
    const key = normalizeName(recipe.title);
    if (!key || seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    additions.push(recipe);
  }
  return { book: { recipes: [...base.recipes, ...additions] }, added: additions.length, skipped };
}

export function recipesForQuery(book: RecipeBook, query: string): Recipe[] {
  const q = normalizeName(query);
  const recipes = [...book.recipes].sort(
    (a, b) =>
      Number(Boolean(b.bookmarked)) - Number(Boolean(a.bookmarked)) ||
      b.updatedAt.localeCompare(a.updatedAt) ||
      a.title.localeCompare(b.title),
  );
  if (!q) return recipes;
  return recipes.filter((recipe) => {
    const haystack = [
      recipe.title,
      ...recipe.genres,
      recipe.form ?? "",
      recipe.role ?? "",
      recipe.mainIngredient ?? "",
      ...recipe.ingredients.map((ingredient) => ingredient.name),
      recipe.lastNote ?? "",
    ]
      .map(normalizeName)
      .join(" ");
    return haystack.includes(q);
  });
}

export function ingredientNames(book: RecipeBook): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const recipe of book.recipes) {
    for (const ingredient of recipe.ingredients) {
      const key = normalizeName(ingredient.name);
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(ingredient.name);
      }
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function isRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<Recipe>;
  return typeof r.id === "string" && typeof r.title === "string" && Array.isArray(r.ingredients);
}

// Migrate the old single `course` field (pre form/role split) onto the right axis.
function legacyFormRole(raw: unknown): { form?: RecipeForm; role?: RecipeRole } {
  const c = (raw as { course?: string }).course;
  if (!c) return {};
  if ((ROLES as string[]).includes(c)) return { role: c as RecipeRole };
  if ((FORMS as string[]).includes(c)) return { form: c as RecipeForm };
  return {}; // e.g. legacy "breakfast" — now lives on mealTypes, dropped here
}

export function normalizeRecipeBook(value: unknown): RecipeBook {
  if (!value || typeof value !== "object" || !Array.isArray((value as RecipeBook).recipes)) {
    return emptyRecipeBook();
  }
  const recipes: Recipe[] = [];
  for (const raw of (value as RecipeBook).recipes) {
    if (!isRecipe(raw)) continue;
    const clean = normalizeRecipeInput({
      title: raw.title,
      ingredients: raw.ingredients,
      activeMinutes: raw.activeMinutes,
      totalMinutes: raw.totalMinutes,
      servings: raw.servings,
      mealTypes: raw.mealTypes,
      vessel: raw.vessel,
      cleanup: raw.cleanup,
      genres: raw.genres,
      form: raw.form ?? legacyFormRole(raw).form,
      role: raw.role ?? legacyFormRole(raw).role,
      mainIngredient: raw.mainIngredient,
      nutrition: raw.nutrition,
      containsPeanuts: raw.containsPeanuts,
      containsTreeNuts: raw.containsTreeNuts,
      bookmarked: raw.bookmarked,
      cookedCount: raw.cookedCount,
      description: raw.description,
      lastNote: raw.lastNote,
      source: raw.source,
      reviewed: raw.reviewed,
    });
    if (!clean.title || clean.ingredients.length === 0) continue;
    recipes.push({
      ...clean,
      id: raw.id,
      createdAt: raw.createdAt || raw.updatedAt || nowIso(),
      updatedAt: raw.updatedAt || raw.createdAt || nowIso(),
    });
  }
  return { recipes };
}
