// Profile for the two Milk Street books (The World in a Skillet, Tuesday Nights).
// They share one EPUB house style: one recipe per spine document inside a
// <div class="recipe">, with <section class="Part-rw"> dividers carrying the
// time/effort section name. See the analysis in the scratchpad for the survey.
import { mountEpub, parseHtml, spineDocs, type HTMLElement } from "./epub";
import {
  cleanupForVessel,
  formFor,
  roleFor,
  detectCuisine,
  mainIngredientFor,
  mealTypesForSection,
  parseIngredient,
  parseMinutes,
  parseServings,
  scanAllergens,
  vesselForSection,
} from "./heuristics";
import type { RecipeInput } from "../../src/domain/recipes";

export interface ParsedRecipe extends RecipeInput {
  section: string; // for the importer's reporting; the model stores it as source.chapter
  timeParsed: boolean; // false when activeMinutes is the fallback, not from the book
}

function text(el: HTMLElement | null | undefined): string {
  return (el?.text ?? "").replace(/\s+/g, " ").trim();
}

function parseRecipeDoc(html: string, book: string, section: string): ParsedRecipe | null {
  const root = parseHtml(html);
  const recipe = root.querySelector("div.recipe");
  if (!recipe) return null;

  const title = text(root.querySelector("h1.chapter-title"));
  if (!title) return null;

  // Yield lines carry their label inline as text ("START TO FINISH: 40 minutes" /
  // "SERVINGS 4") — classify by the text, let the heuristics pull the numbers.
  let startToFinish = "";
  let servingsText = "";
  for (const p of recipe.querySelectorAll("p.yield")) {
    const full = text(p);
    const upper = full.toUpperCase();
    if (upper.includes("START") || upper.includes("FINISH")) startToFinish = full;
    else if (upper.includes("SERVING") || upper.includes("MAKES")) servingsText = full;
  }

  const ingredients = recipe
    .querySelectorAll("div.ingredients p.ingredient")
    .map((p) => parseIngredient(text(p)))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));
  if (ingredients.length === 0) return null;

  // The first headnote block is the intro (→ description); later blocks are the
  // "Don't…" tips. Allergen scan uses every block.
  const headnoteBlocks = recipe.querySelectorAll("div.headnote").map((d) => text(d));
  const description = headnoteBlocks[0] ?? "";

  const allergens = scanAllergens([title, ...headnoteBlocks, ...ingredients.map((i) => `${i.name} ${i.note ?? ""}`)]);
  const vessel = vesselForSection(section, title);
  const parsedMinutes = parseMinutes(startToFinish);
  const servings = parseServings(servingsText);

  return {
    title,
    ingredients,
    // Milk Street gives "Start to Finish" (total). Use it for both until the LLM
    // pass estimates true active time.
    activeMinutes: parsedMinutes ?? 30,
    ...(parsedMinutes !== undefined ? { totalMinutes: parsedMinutes } : {}),
    ...(servings !== undefined ? { servings } : {}),
    mealTypes: mealTypesForSection(section),
    vessel,
    cleanup: cleanupForVessel(vessel),
    genres: detectCuisine(title, description),
    ...(formFor(title) ? { form: formFor(title) } : {}),
    role: roleFor(section, description),
    ...(mainIngredientFor(title, ingredients) ? { mainIngredient: mainIngredientFor(title, ingredients) } : {}),
    ...(allergens.peanuts ? { containsPeanuts: true } : {}),
    ...(allergens.treeNuts ? { containsTreeNuts: true } : {}),
    ...(description ? { description } : {}),
    source: { book, ...(section ? { chapter: section } : {}) },
    section,
    timeParsed: parsedMinutes !== undefined,
  };
}

// Walk the spine in reading order; <section class="Part-rw"> updates the current
// section, <div class="recipe"> documents become recipes tagged with it.
export function parseMilkStreet(epubPath: string, book: string): ParsedRecipe[] {
  const epub = mountEpub(epubPath);
  const recipes: ParsedRecipe[] = [];
  let section = "";

  for (const doc of spineDocs(epub)) {
    let html: string;
    try {
      html = epub.read(doc.entry);
    } catch {
      continue; // spine ref with no on-disk file (rare)
    }
    // <br/> joins adjacent text with no space ("Onions<br/>and" → "Onionsand").
    html = html.replace(/<br\s*\/?>/gi, " ");
    const root = parseHtml(html);
    if (root.querySelector("div.recipe")) {
      const recipe = parseRecipeDoc(html, book, section);
      if (recipe) recipes.push(recipe);
      continue;
    }
    // Section dividers: Skillet uses h1.part-title, Tuesday Nights uses
    // h1.chapter-number (the section name sits in a <span class="white">).
    const head = root.querySelector("h1.part-title") ?? root.querySelector("h1.chapter-number");
    if (head) section = text(head);
  }
  return recipes;
}
