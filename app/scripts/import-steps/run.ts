// Extract recipe procedure steps from the Milk Street EPUBs into a title→steps[]
// sidecar (src/data/recipeSteps.json), joined at display time.
//
//   npm run import:steps
//
// The importer never captured the procedure (only ingredients/times/headnote), and
// the corpus is now LLM-enriched, so re-importing would clobber that and reassign
// ids. This pass is decoupled — it reads the EPUBs and writes its own file, exactly
// like the image scraper, so it's safe alongside everything else.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mountEpub, parseHtml, spineDocs, type HTMLElement } from "../import-epub/epub";
import { normalizeName } from "../../src/domain/normalize";

const here = dirname(fileURLToPath(import.meta.url));
const devRoot = join(here, "../../../..");
const COOKBOOKS = join(devRoot, "dishes-data/cookbooks");
const MAP_OUT = join(here, "../../src/data/recipeSteps.json");

const BOOKS = [
  "Milk Street The World in a Skillet ( etc.) (z-library.sk, 1lib.sk, z-lib.sk).epub",
  "Milk Street — Tuesday Nights (Christopher Kimball) (z-library.sk, 1lib.sk, z-lib.sk).epub",
];

function clean(el: HTMLElement): string {
  return el.text.replace(/\s+/g, " ").trim();
}

function stepsFor(epubPath: string): Record<string, string[]> {
  const epub = mountEpub(epubPath);
  const out: Record<string, string[]> = {};
  for (const doc of spineDocs(epub)) {
    let html: string;
    try {
      html = epub.read(doc.entry);
    } catch {
      continue;
    }
    const root = parseHtml(html);
    const recipe = root.querySelector("div.recipe");
    if (!recipe) continue;
    const title = clean(root.querySelector("h1.chapter-title") ?? recipe).split("  ")[0];
    const procedure = recipe.querySelector("div.procedure") ?? recipe;
    const steps = procedure
      .querySelectorAll("p.step")
      .map(clean)
      .filter((s) => s.length > 0);
    if (title && steps.length) out[normalizeName(title)] = steps;
  }
  return out;
}

const map: Record<string, string[]> = {};
let total = 0;
for (const file of BOOKS) {
  const got = stepsFor(join(COOKBOOKS, file));
  const count = Object.keys(got).length;
  total += count;
  console.log(`${file.slice(0, 28)}…: ${count} recipes with steps`);
  Object.assign(map, got);
}

mkdirSync(dirname(MAP_OUT), { recursive: true });
writeFileSync(MAP_OUT, JSON.stringify(map));
const stepCounts = Object.values(map).map((s) => s.length);
const avg = stepCounts.length ? (stepCounts.reduce((a, b) => a + b, 0) / stepCounts.length).toFixed(1) : 0;
console.log(`\n${Object.keys(map).length} recipes mapped (avg ${avg} steps) → ${MAP_OUT}`);
