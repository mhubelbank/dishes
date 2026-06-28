// Scrape recipe photos from the Milk Street EPUBs.
//
//   npm run import:images            (extract photos + write the title→image map)
//   npm run import:images -- --preview   (just print the mapping, extract nothing)
//
// Each recipe sits on a 2-page spread with a full-page photo on the facing page.
// Photos are named Art_P<page>.jpg, so a recipe on page P pairs with its spread
// partner (P ^ 1): page 3 → Art_P2, page 4 → Art_P5, page 6 → Art_P7, … We read
// each recipe's page anchor, grab the partner photo, extract the JPEGs to
// app/public/recipe-images/ (served at /recipe-images/…), and write a normalized
// title → url map. This never touches cookbookRecipes.json, so it runs safely in
// parallel with the LLM enrichment.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { mountEpub, parseHtml, spineDocs, type HTMLElement } from "../import-epub/epub";
import { normalizeName } from "../../src/domain/normalize";

const PREVIEW = process.argv.includes("--preview");

const here = dirname(fileURLToPath(import.meta.url));
const devRoot = join(here, "../../../.."); // …/Dev
const COOKBOOKS = join(devRoot, "dishes-data/cookbooks");
const IMAGE_DIR = join(here, "../../public/recipe-images");
const MAP_OUT = join(here, "../../src/data/recipeImages.json");

const BOOKS: Array<{ file: string; tag: string }> = [
  { file: "Milk Street The World in a Skillet ( etc.) (z-library.sk, 1lib.sk, z-lib.sk).epub", tag: "skillet" },
  { file: "Milk Street — Tuesday Nights (Christopher Kimball) (z-library.sk, 1lib.sk, z-lib.sk).epub", tag: "tuesday" },
];

function text(el: HTMLElement | null | undefined): string {
  return (el?.text ?? "").replace(/\s+/g, " ").trim();
}

interface Pair {
  title: string;
  imageEntry: string; // zip entry path of the photo
}

// Photos are named Art_P<page>.jpg (Art_P2.jpg is on page 2). Index them by
// basename so a recipe can look up its spread-partner page directly.
function photoEntriesByBase(epubPath: string): Map<string, string> {
  const listing = execFileSync("unzip", ["-Z1", epubPath], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const byBase = new Map<string, string>();
  for (const entry of listing.split("\n")) {
    const base = entry.split("/").pop() ?? "";
    if (/^Art_P\d+\.(jpe?g|png)$/i.test(base)) byBase.set(base.toLowerCase(), entry.trim());
  }
  return byBase;
}

function pairsFor(epubPath: string): Pair[] {
  const epub = mountEpub(epubPath);
  const photos = photoEntriesByBase(epubPath);
  const pairs: Pair[] = [];
  for (const doc of spineDocs(epub)) {
    let html: string;
    try {
      html = epub.read(doc.entry);
    } catch {
      continue;
    }
    const root = parseHtml(html.replace(/<br\s*\/?>/gi, " "));
    if (!root.querySelector("div.recipe")) continue;
    const title = text(root.querySelector("h1.chapter-title"));
    // The recipe's page is its first page anchor; its photo is the spread partner.
    const page = Number(html.match(/id="page-(\d+)"/)?.[1]);
    if (!title || !page) continue;
    const partner = page ^ 1;
    const entry =
      photos.get(`art_p${partner}.jpg`) ?? photos.get(`art_p${partner}.jpeg`) ?? photos.get(`art_p${partner}.png`);
    if (entry) pairs.push({ title, imageEntry: entry });
  }
  return pairs;
}

const map: Record<string, string> = {};
let extracted = 0;
let recipesWithoutPhoto = 0;

if (!PREVIEW) mkdirSync(IMAGE_DIR, { recursive: true });

for (const { file, tag } of BOOKS) {
  const epubPath = join(COOKBOOKS, file);
  const pairs = pairsFor(epubPath);
  console.log(`${tag}: ${pairs.length} recipe→photo pairs`);
  for (const { title, imageEntry } of pairs) {
    const base = imageEntry.split("/").pop() ?? "img.jpg";
    const fileName = `${tag}-${base}`;
    const url = `/recipe-images/${fileName}`;
    map[normalizeName(title)] = url;
    if (!PREVIEW) {
      const raw = execFileSync("unzip", ["-p", epubPath, imageEntry], { maxBuffer: 64 * 1024 * 1024 });
      // Resize down from full-page print resolution — plenty for the detail view,
      // and it takes the corpus from ~400MB to ~35MB.
      const resized = await sharp(raw).resize({ width: 1000, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
      writeFileSync(join(IMAGE_DIR, fileName), resized);
      extracted += 1;
    }
  }
}

if (PREVIEW) {
  const sample = Object.entries(map).slice(0, 8);
  for (const [t, u] of sample) console.log(`  ${t.slice(0, 44).padEnd(46)} → ${u}`);
  console.log(`\n${Object.keys(map).length} recipes mapped to a photo (preview — nothing written).`);
} else {
  mkdirSync(dirname(MAP_OUT), { recursive: true });
  writeFileSync(MAP_OUT, JSON.stringify(map));
  console.log(`\n${extracted} photos → ${IMAGE_DIR}`);
  console.log(`${Object.keys(map).length}-entry title→image map → ${MAP_OUT}`);
  if (recipesWithoutPhoto) console.log(`${recipesWithoutPhoto} recipes had no photo`);
}
