// Cookbook importer — Milk Street pilot.
// Parses the two Milk Street EPUBs into the app's Recipe model and writes a
// reviewable corpus to the private dishes-data repo (recipe text never lands in
// this app repo). Load it into the app via Settings → Import recipes.
//
//   npm run import:epub
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMilkStreet, type ParsedRecipe } from "./milkstreet";
import { addRecipe, emptyRecipeBook, type RecipeBook } from "../../src/domain/recipes";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "../.."); // …/dishes/app
const devRoot = join(here, "../../../.."); // …/Dev
const COOKBOOKS = join(devRoot, "dishes-data/cookbooks");
const OUT = join(devRoot, "dishes-data/data/recipes/milk-street.json");
// Bundled into the app so recipes live-load on first run (gitignored — see
// recipesStore). The canonical copy stays in dishes-data.
const BUNDLED_OUT = join(appRoot, "src/data/cookbookRecipes.json");

const BOOKS: Array<{ file: string; label: string }> = [
  { file: "Milk Street The World in a Skillet ( etc.) (z-library.sk, 1lib.sk, z-lib.sk).epub", label: "Milk Street: The World in a Skillet" },
  { file: "Milk Street — Tuesday Nights (Christopher Kimball) (z-library.sk, 1lib.sk, z-lib.sk).epub", label: "Milk Street: Tuesday Nights" },
];

function dedupeKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const all: ParsedRecipe[] = [];
for (const { file, label } of BOOKS) {
  const path = join(COOKBOOKS, file);
  process.stdout.write(`Parsing ${label}… `);
  const recipes = parseMilkStreet(path, label);
  console.log(`${recipes.length} recipes`);
  const sections = new Map<string, number>();
  for (const r of recipes) sections.set(r.section, (sections.get(r.section) ?? 0) + 1);
  for (const [s, n] of sections) console.log(`    ${s || "(no section)"}: ${n}`);
  all.push(...recipes);
}

// Build a clean RecipeBook (ids, timestamps, normalization) and drop cross-book
// title duplicates.
let book: RecipeBook = emptyRecipeBook();
const seen = new Set<string>();
let dupes = 0;
let flagged = 0;
let noTime = 0;
for (const r of all) {
  const key = dedupeKey(r.title);
  if (seen.has(key)) { dupes++; continue; }
  seen.add(key);
  if (r.containsPeanuts || r.containsTreeNuts) flagged++;
  if (!r.timeParsed) noTime++;
  book = addRecipe(book, r);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(book, null, 2));
mkdirSync(dirname(BUNDLED_OUT), { recursive: true });
writeFileSync(BUNDLED_OUT, JSON.stringify(book));

console.log(`\n${book.recipes.length} recipes written → ${OUT}`);
console.log(`${book.recipes.length} recipes bundled → ${BUNDLED_OUT}`);
console.log(`  ${dupes} cross-book duplicate titles skipped`);
console.log(`  ${flagged} flagged for nut allergens (auto-excluded from suggestions until reviewed)`);
console.log(`  ${noTime} had no parseable time (fell back to 30 min)`);
console.log("\nSample:");
for (const r of book.recipes.slice(0, 3)) {
  console.log(`  • ${r.title} — ${r.activeMinutes}min, ${r.vessel}, ${r.genres.join("/") || "—"}, ${r.ingredients.length} ingredients`);
  console.log(`      ${r.ingredients.slice(0, 4).map((i) => i.name).join(", ")}…`);
}
