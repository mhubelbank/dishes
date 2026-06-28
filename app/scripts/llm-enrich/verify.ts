// Deterministic guardrails. The model PROPOSES; this code DISPOSES: every field is
// checked against the source or a sane range, and anything that fails falls back to
// the parser's value. The safety-critical allergen flags are floored (only ever
// escalated, never lowered). Each override is recorded for the audit file.
import type { Recipe, RecipeIngredient } from "../../src/domain/recipes";
import { CUISINES, FORMS, MAIN_INGREDIENTS, ROLES, type RecipeForm, type RecipeRole } from "./vocab";
import type { LlmRecipe } from "./schema";

const STOPWORDS = new Set([
  "of", "or", "and", "the", "a", "an", "to", "for", "with", "in", "into",
  "plus", "other", "about", "such", "as", "your", "preferably",
]);

// Form floors by title — only unambiguous STRUCTURAL terms. Dish-names like "curry",
// "masala", and "tikka" are deliberately excluded: they ride on stir-fries and noodles
// ("Singapore Curry Noodles", "Thai Stir-Fried Pork … Red Curry"), and the model now
// classifies those better than a keyword can. "broth" is dropped for the same reason
// (acqua pazza is simmered-in-sauce, not a soup). "chili" stays out too.
const SOUP_TITLE = /\b(soup|chowder|bisque|ramen|pho)\b/i;
const STEW_TITLE = /\b(stew|stewed|tagine|braise|braised|daube|gumbo)\b/i;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function clampInt(n: unknown, lo: number, hi: number): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

export interface VerifiedFields {
  ingredients: RecipeIngredient[];
  activeMinutes: number;
  totalMinutes?: number;
  servings?: number;
  form?: RecipeForm;
  role?: RecipeRole;
  genres: string[];
  mainIngredient?: string;
  containsPeanuts: boolean;
  containsTreeNuts: boolean;
  nutrition?: { proteinGrams?: number; fiberGrams?: number };
  rejections: string[]; // things the verifier did NOT trust (overrides)
}

export function verify(recipe: Recipe, llm: LlmRecipe): VerifiedFields {
  const rejections: string[] = [];

  // --- ingredient grounding: the parser frequently CLIPS names ("grapeseed" from
  // "grapeseed oil"), so we can't require the model's name to be a subset of the
  // clipped source. Instead we allow expansion: a model ingredient is grounded if it
  // shares ≥1 significant word with the parser's ingredient text and introduces ≤2
  // new words — enough to complete a clipped name or split a line, but not to invent
  // a wholly different food. One ungrounded item → keep the parser's whole list.
  // Anchor against the title too, so an ingredient named in the title ("Beef and
  // Celery", "Chocolate-Tahini Pudding", "… Sherry Vinegar Sauce") counts as grounded
  // even when the parser clipped it out of the ingredient lines.
  const sourceWords = new Set([
    ...words(recipe.title),
    ...recipe.ingredients.flatMap((i) => words(`${i.name} ${i.note ?? ""} ${i.quantity ?? ""}`)),
  ]);
  const sourceList = [...sourceWords];
  // A model word is anchored if it matches a source word exactly OR by substring
  // (so "lemongrass" anchors to "lemon grass", "chiles" to a "chile" source).
  const anchored = (x: string): boolean =>
    sourceWords.has(x) || sourceList.some((s) => s.length >= 4 && (x.includes(s) || s.includes(x)));
  function grounded(name: string): boolean {
    const w = words(name);
    if (w.length === 0) return true;
    const shared = w.filter(anchored).length;
    return shared >= 1 && w.length - shared <= 2;
  }
  let ingredients = recipe.ingredients;
  const ungrounded = (llm.ingredients ?? []).find((i) => i.name.trim() && !grounded(i.name));
  if (ungrounded) {
    rejections.push(`kept parser ingredients — model introduced "${ungrounded.name}" not anchored in the source`);
  } else if (llm.ingredients?.length) {
    ingredients = llm.ingredients.map((i) => {
      const name = i.name.trim();
      const quantity = i.quantity?.trim();
      const note = i.note?.trim();
      return { name, ...(quantity ? { quantity } : {}), ...(note ? { note } : {}) };
    });
  }

  // --- times: trust the book's start-to-finish total; the model only estimates the
  // hands-on active portion (clamped to ≤ total).
  const totalMinutes = recipe.totalMinutes;
  const cap = totalMinutes ?? 360;
  let activeMinutes = clampInt(llm.activeMinutes, 1, cap) ?? recipe.activeMinutes;
  if (activeMinutes > cap) activeMinutes = cap;

  // --- form + role (two independent axes; schema should guarantee the enums, but
  // re-check before trusting).
  let form = FORMS.includes(llm.form as RecipeForm) ? (llm.form as RecipeForm) : recipe.form;
  const role = ROLES.includes(llm.role as RecipeRole) ? (llm.role as RecipeRole) : recipe.role;
  // Form floors (the dish may still be any role). Brothy → soup; thick simmered →
  // stew. A title is one or the other, so check soup first.
  if (SOUP_TITLE.test(recipe.title) && form !== "soup") {
    if (form) rejections.push(`forced form "${form}" → "soup" (brothy title)`);
    form = "soup";
  } else if (STEW_TITLE.test(recipe.title) && form !== "stew") {
    if (form) rejections.push(`forced form "${form}" → "stew" (stew/tagine/braise title)`);
    form = "stew";
  }
  const genres = (CUISINES as readonly string[]).includes(llm.cuisine) ? [llm.cuisine] : recipe.genres;
  const mainIngredient = (MAIN_INGREDIENTS as readonly string[]).includes(llm.mainIngredient)
    ? llm.mainIngredient
    : recipe.mainIngredient;

  const servings = clampInt(llm.servings, 1, 99) ?? recipe.servings;

  // --- allergen floor: only ever escalate
  const containsPeanuts = Boolean(recipe.containsPeanuts) || Boolean(llm.containsPeanuts);
  const containsTreeNuts = Boolean(recipe.containsTreeNuts) || Boolean(llm.containsTreeNuts);
  if (recipe.containsPeanuts && !llm.containsPeanuts) rejections.push("kept peanut flag (model tried to clear it)");
  if (recipe.containsTreeNuts && !llm.containsTreeNuts) rejections.push("kept tree-nut flag (model tried to clear it)");

  // --- nutrition ranges
  const proteinGrams = clampInt(llm.nutrition?.proteinGrams, 0, 120);
  const fiberGrams = clampInt(llm.nutrition?.fiberGrams, 0, 60);
  const nutrition = proteinGrams !== undefined || fiberGrams !== undefined ? { proteinGrams, fiberGrams } : undefined;

  return {
    ingredients,
    activeMinutes,
    totalMinutes,
    servings,
    form,
    role,
    genres,
    mainIngredient,
    containsPeanuts,
    containsTreeNuts,
    nutrition,
    rejections,
  };
}
