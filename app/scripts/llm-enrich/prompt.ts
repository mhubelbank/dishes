// The system prompt is static so it caches across every request in the batch
// (one cache_control breakpoint at the front). Per-recipe data goes in the user
// turn after it. The model RESHAPES and CLASSIFIES data we already extracted — it
// must not invent ingredients, steps, or facts.
import type { Recipe } from "../../src/domain/recipes";
import { CUISINES, FORMS, MAIN_INGREDIENTS, ROLES } from "./vocab";

export const SYSTEM_PROMPT = `You clean and tag recipes that were imported from cookbooks by a rough automatic parser. Your job is to RESHAPE and CLASSIFY data that is already present — never invent ingredients, steps, quantities, or facts that are not supported by the input.

For each recipe you are given its title, source, an optional headnote, the parser's current guesses, and the parser's ingredient lines (which often have clipped names or misplaced prep). Return improved structured fields.

Rules:
- ingredients: one object per ingredient. "name" = the food only, no quantity (e.g. "grapeseed oil", "boneless skinless chicken thighs"). Fix names the parser clipped (e.g. "grapeseed" was cut from "grapeseed or other neutral oil" → "grapeseed oil"; "firm" → "firm tofu"). "quantity" = a short display amount with abbreviated units (lb, oz, tbsp, tsp, cup, clove) or "" if none. "note" = preparation only ("finely chopped", "drained") or "". Keep the same food the parser line refers to — you may complete a clipped name, but do not swap it for a different food. If you split one source line into two ingredients, or merge two into one, say so in "changes".
- totalMinutes = the start-to-finish time. Use the parser's totalMin value as-is; do NOT lower or raise it. Estimate ONLY activeMinutes = the hands-on portion (active ≤ total).
- servings = number of portions.
- form and role are TWO INDEPENDENT axes. form = what the dish IS (its structure); role = the part of the meal it plays. They are not mutually exclusive: chicken noodle soup is form "soup" + role "main"; a side salad is form "salad" + role "side"; a plain roast chicken is form "roast" + role "main".
- form = exactly one of: ${FORMS.join(", ")}, or "" if the dish has no clear structure. Key distinctions: "soup" = brothy/liquid-forward (you eat the liquid: chowder, bisque, ramen, pho). "stew" = thick, protein/vegetables simmered in a sauce — this is the home for curries, tagines, braises, and "X in Y sauce" mains (e.g. "Pork in Veracruz Sauce", "Shrimp in Tomato Sauce" are form "stew"). "sauce" = ONLY a standalone sauce/dip/salsa/chutney recipe, never a main that is served in a sauce. Desserts have NO form (leave form ""); "cake"/"pie" are not forms — a cake is just role "dessert".
- role = exactly one of: ${ROLES.join(", ")}, or "" if unclear. Use "dessert" for sweets, "side" for accompaniments, "main" for the centerpiece. (Breakfast/lunch/dinner is a separate axis — do not put it here.)
- cuisine = exactly one of: ${CUISINES.join(", ")}, or "" if not clearly any.
- mainIngredient = exactly one of: ${MAIN_INGREDIENTS.join(", ")}, or "" if none dominates.
- containsPeanuts / containsTreeNuts = true if ANY ingredient is or contains peanuts / tree nuts (almond, walnut, pecan, cashew, pistachio, hazelnut, macadamia, brazil nut, pine nut, chestnut, praline, marzipan, nut butter, nut flour). This is an allergy hard-filter: when unsure, set true. Never set false just because the parser missed it.
- nutrition = estimated protein and fiber grams PER PORTION (±20% is fine; whole numbers). Base it on the ingredients and servings.
- confidence = "high" if the input was clean and unambiguous, "medium" if you made judgment calls, "low" if the input was sparse or contradictory.
- changes = a list of every correction or addition you made RELATIVE TO THE PARSER'S INPUT, each a short human-readable string. Examples: 'ingredient: "grapeseed" → "grapeseed oil"', 'course: main → side (headnote: "a side dish")', 'split active 20 / total 45 from a single 45-min figure', 'added tree-nut flag: walnuts in the topping', 'cuisine: "" → Mexican'. Only list things you actually changed; if a field matches the parser's input, do not list it.

Return only the structured object.`;

function fmtIngredient(i: { name: string; quantity?: string; note?: string }): string {
  const qty = i.quantity ? `${i.quantity} ` : "";
  const note = i.note ? `, ${i.note}` : "";
  return `- ${qty}${i.name}${note}`;
}

// Compact per-recipe input. Reconstructs the parser's ingredient lines so the
// model (and the verifier) work against the same text.
export function buildUserContent(recipe: Recipe): string {
  const lines: string[] = [];
  lines.push(`TITLE: ${recipe.title}`);
  if (recipe.source) {
    lines.push(`SOURCE: ${recipe.source.book}${recipe.source.chapter ? ` — ${recipe.source.chapter}` : ""}`);
  }
  lines.push(
    `PARSER GUESSES: form=${recipe.form ?? "?"}, role=${recipe.role ?? "?"}, cuisine=${recipe.genres.join("/") || "?"}, ` +
      `mainIngredient=${recipe.mainIngredient ?? "?"}, servings=${recipe.servings ?? "?"}, ` +
      `activeMin=${recipe.activeMinutes}, totalMin=${recipe.totalMinutes ?? "?"}, ` +
      `peanuts=${Boolean(recipe.containsPeanuts)}, treeNuts=${Boolean(recipe.containsTreeNuts)}`,
  );
  if (recipe.description) lines.push(`HEADNOTE: ${recipe.description}`);
  lines.push("INGREDIENT LINES:");
  for (const ing of recipe.ingredients) lines.push(fmtIngredient(ing));
  return lines.join("\n");
}
