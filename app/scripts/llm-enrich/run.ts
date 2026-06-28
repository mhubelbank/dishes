// Batch LLM enrichment.
//
//   ANTHROPIC_API_KEY=sk-ant-... npm run llm:enrich:dry            (20 recipes, no writes)
//   ANTHROPIC_API_KEY=sk-ant-... npm run llm:enrich:dry -- --limit 40
//   ANTHROPIC_API_KEY=sk-ant-... npm run llm:enrich:full           (whole corpus, Batch API, writes back)
//
// DRY mode: synchronous calls on a sample; writes only the audit + a sample file.
// FULL mode: Message Batches API (50% off), writes enriched recipes back to the
// corpus as reviewed:false (held out of the suggester until human review, §7.11).
// Both share one request/verify/audit path.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { normalizeRecipeBook, type Recipe } from "../../src/domain/recipes";
import { SYSTEM_PROMPT, buildUserContent } from "./prompt";
import { RECIPE_SCHEMA, type LlmRecipe } from "./schema";
import { verify } from "./verify";

const MODEL = "claude-haiku-4-5";
const IN_RATE = 1.0; // $/1M tokens, Haiku 4.5 list price
const OUT_RATE = 5.0;

const here = dirname(fileURLToPath(import.meta.url));
const devRoot = join(here, "../../../.."); // …/Dev
const BUNDLED = join(here, "../../src/data/cookbookRecipes.json"); // app corpus
const CANONICAL = join(devRoot, "dishes-data/data/recipes/milk-street.json");
const OUT_DIR = join(devRoot, "dishes-data/llm-audit");

const FULL = process.argv.includes("--full");
const limitArg = process.argv.indexOf("--limit");
const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : 20;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Run: ANTHROPIC_API_KEY=sk-ant-... npm run llm:enrich:dry");
  process.exit(1);
}

const book = normalizeRecipeBook(JSON.parse(readFileSync(BUNDLED, "utf8")));
const recipes = FULL ? book.recipes : book.recipes.slice(0, limit);
if (recipes.length === 0) {
  console.error(`No recipes in ${BUNDLED}. Run npm run import:epub first.`);
  process.exit(1);
}

const client = new Anthropic();

// One request body, shared by the synchronous and batch paths. The static system
// prompt sits behind a cache breakpoint so the batch reuses it across requests.
function params(recipe: Recipe) {
  return {
    model: MODEL,
    max_tokens: 4000,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: RECIPE_SCHEMA } },
    messages: [{ role: "user", content: buildUserContent(recipe) }],
  } as never;
}

interface Row {
  recipe: Recipe;
  enriched: Recipe;
  changes: string[];
  rejections: string[];
  confidence: string;
}

const usage = { in: 0, out: 0, cacheRead: 0, cacheCreate: 0 };
let failures = 0;

function tally(u: Anthropic.Usage): void {
  usage.in += u.input_tokens;
  usage.out += u.output_tokens;
  usage.cacheRead += u.cache_read_input_tokens ?? 0;
  usage.cacheCreate += u.cache_creation_input_tokens ?? 0;
}

// Verify the model output against the source and merge into an enriched recipe.
function processOne(recipe: Recipe, message: Anthropic.Message): Row | null {
  if (message.stop_reason === "refusal") {
    failures += 1;
    return null;
  }
  const textBlock = message.content.find((b) => b.type === "text") as { text: string } | undefined;
  if (!textBlock) {
    failures += 1;
    return null;
  }
  const llm = JSON.parse(textBlock.text) as LlmRecipe;
  const v = verify(recipe, llm);
  const enriched: Recipe = {
    ...recipe,
    ingredients: v.ingredients,
    activeMinutes: v.activeMinutes,
    ...(v.totalMinutes !== undefined ? { totalMinutes: v.totalMinutes } : {}),
    ...(v.servings !== undefined ? { servings: v.servings } : {}),
    ...(v.form ? { form: v.form } : {}),
    ...(v.role ? { role: v.role } : {}),
    genres: v.genres,
    ...(v.mainIngredient ? { mainIngredient: v.mainIngredient } : {}),
    ...(v.containsPeanuts ? { containsPeanuts: true } : {}),
    ...(v.containsTreeNuts ? { containsTreeNuts: true } : {}),
    ...(v.nutrition ? { nutrition: v.nutrition } : {}),
    // Not gated behind reviewed:false — the audit file is the review, and there's
    // no in-app approve flow yet. Allergen-flagged recipes stay excluded by the
    // suggester's hard filter regardless.
  };
  return { recipe, enriched, changes: llm.changes ?? [], rejections: v.rejections, confidence: llm.confidence };
}

async function runSynchronous(): Promise<Row[]> {
  const rows: Row[] = [];
  for (const [index, recipe] of recipes.entries()) {
    process.stdout.write(`  [${index + 1}/${recipes.length}] ${recipe.title.slice(0, 50)}… `);
    try {
      const message = (await client.messages.create(params(recipe))) as Anthropic.Message;
      tally(message.usage);
      const row = processOne(recipe, message);
      if (row) {
        rows.push(row);
        console.log(`${row.changes.length} changes${row.rejections.length ? `, ${row.rejections.length} override(s)` : ""}`);
      } else {
        console.log("skipped");
      }
    } catch (err) {
      failures += 1;
      console.log(`error: ${(err as Error).message}`);
    }
  }
  return rows;
}

// The batch id is persisted the moment it's created, so an interrupted run resumes
// the SAME server-side batch instead of paying for a new one. Result collection +
// write are idempotent (full-corpus overwrite keyed by id), so re-running after a
// crash mid-write is safe too. Cleared only on successful completion.
const STATE_FILE = join(OUT_DIR, ".batch-state.json");
function loadBatchId(): string | null {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")).batchId ?? null;
  } catch {
    return null;
  }
}
function saveBatchId(batchId: string): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify({ batchId, createdAt: new Date().toISOString(), count: recipes.length }));
}

async function submitBatch(): Promise<string> {
  console.log(`Submitting a batch of ${recipes.length} requests…`);
  const batch = await client.messages.batches.create({
    requests: recipes.map((r) => ({ custom_id: r.id, params: params(r) })),
  } as never);
  saveBatchId(batch.id);
  console.log(`Batch ${batch.id} created — id saved. Safe to Ctrl-C; re-run to resume the same batch.`);
  return batch.id;
}

async function runBatch(): Promise<Row[]> {
  const byId = new Map(recipes.map((r) => [r.id, r] as const));

  // Resume a saved batch if one is still alive; otherwise submit a fresh one.
  let batchId = loadBatchId();
  if (batchId) {
    const existing = await client.messages.batches.retrieve(batchId).catch(() => null);
    if (existing && existing.processing_status !== "canceling") {
      console.log(`Resuming saved batch ${batchId} (${existing.processing_status})…`);
    } else {
      console.log(`Saved batch ${batchId} is gone/canceled — starting fresh.`);
      batchId = await submitBatch();
    }
  } else {
    batchId = await submitBatch();
  }

  // Poll until ended.
  let status = await client.messages.batches.retrieve(batchId);
  while (status.processing_status !== "ended") {
    await new Promise((r) => setTimeout(r, 30_000));
    status = await client.messages.batches.retrieve(batchId);
    const c = status.request_counts;
    process.stdout.write(`\r  ${status.processing_status} — ${c.succeeded} ok / ${c.errored} err / ${c.processing} processing   `);
  }
  console.log("\nBatch ended. Collecting results…");

  const rows: Row[] = [];
  for await (const result of await client.messages.batches.results(batchId)) {
    const recipe = byId.get(result.custom_id);
    if (!recipe) continue;
    if (result.result.type !== "succeeded") {
      failures += 1;
      continue;
    }
    tally(result.result.message.usage);
    const row = processOne(recipe, result.result.message);
    if (row) rows.push(row);
  }
  rmSync(STATE_FILE, { force: true }); // only after a clean collection
  return rows;
}

const rows = FULL ? await runBatch() : await runSynchronous();

// ---- cost (batch halves everything) ----
const discount = FULL ? 0.5 : 1;
const inCost = (usage.in * IN_RATE + usage.cacheCreate * IN_RATE * 1.25 + usage.cacheRead * IN_RATE * 0.1) / 1e6;
const cost = (inCost + (usage.out * OUT_RATE) / 1e6) * discount;
const perRecipe = rows.length ? cost / rows.length : 0;
const projectedBatch = perRecipe * 2150 * (FULL ? 1 : 0.5);

// ---- audit ----
function fieldLine(label: string, before: unknown, after: unknown): string | null {
  const b = JSON.stringify(before);
  const a = JSON.stringify(after);
  return b === a ? null : `  - ${label}: ${b} → ${a}`;
}

const md: string[] = [];
md.push(`# LLM enrichment — ${FULL ? "FULL run" : "dry-run"} audit`);
md.push("");
md.push(`Model: \`${MODEL}\` · ${rows.length} recipes${failures ? ` · ${failures} failed` : ""} · ${new Date().toISOString()}`);
md.push("");
md.push(`Tokens: ${usage.in.toLocaleString()} in (+${usage.cacheRead.toLocaleString()} cached read, ${usage.cacheCreate.toLocaleString()} cache write) · ${usage.out.toLocaleString()} out`);
md.push(`Cost (${FULL ? "Batch API 50% off" : "full price, synchronous"}): **$${cost.toFixed(4)}** (~$${perRecipe.toFixed(5)}/recipe)`);
if (!FULL) md.push(`Projected full corpus (~2150, Batch API 50% off): **~$${projectedBatch.toFixed(2)}**`);
md.push("");
const totalChanges = rows.reduce((n, r) => n + r.changes.length, 0);
const withOverrides = rows.filter((r) => r.rejections.length).length;
md.push(`${totalChanges} model changes total · ${withOverrides} recipe(s) had verifier overrides`);
md.push("");
md.push("---");
for (const row of rows) {
  md.push("");
  md.push(`## ${row.recipe.title}  _(confidence: ${row.confidence})_`);
  if (row.changes.length) {
    md.push("");
    md.push("**Model changes:**");
    for (const c of row.changes) md.push(`- ${c}`);
  } else {
    md.push("");
    md.push("_No changes proposed._");
  }
  if (row.rejections.length) {
    md.push("");
    md.push("**Verifier overrides (model NOT trusted):**");
    for (const r of row.rejections) md.push(`- ⚠️ ${r}`);
  }
  const diffs = [
    fieldLine("form", row.recipe.form, row.enriched.form),
    fieldLine("role", row.recipe.role, row.enriched.role),
    fieldLine("cuisine", row.recipe.genres, row.enriched.genres),
    fieldLine("mainIngredient", row.recipe.mainIngredient, row.enriched.mainIngredient),
    fieldLine("active/total min", [row.recipe.activeMinutes, row.recipe.totalMinutes], [row.enriched.activeMinutes, row.enriched.totalMinutes]),
    fieldLine("ingredient count", row.recipe.ingredients.length, row.enriched.ingredients.length),
    fieldLine("peanuts", Boolean(row.recipe.containsPeanuts), Boolean(row.enriched.containsPeanuts)),
    fieldLine("treeNuts", Boolean(row.recipe.containsTreeNuts), Boolean(row.enriched.containsTreeNuts)),
  ].filter(Boolean);
  if (diffs.length) {
    md.push("");
    md.push("**Field diff:**");
    md.push(...(diffs as string[]));
  }
}

mkdirSync(OUT_DIR, { recursive: true });
const auditName = FULL ? "full-run-changes.md" : "dry-run-changes.md";
writeFileSync(join(OUT_DIR, auditName), md.join("\n"));

console.log(`\n${rows.length} enriched · ${totalChanges} changes · ${withOverrides} with overrides · ${failures} failed`);
console.log(`Cost: $${cost.toFixed(4)}${FULL ? "" : ` · projected full corpus (batched): ~$${projectedBatch.toFixed(2)}`}`);

if (FULL) {
  // Write enriched recipes back, preserving any recipes the batch didn't cover.
  const enrichedById = new Map(rows.map((r) => [r.enriched.id, r.enriched] as const));
  const merged = { recipes: book.recipes.map((r) => enrichedById.get(r.id) ?? r) };
  writeFileSync(CANONICAL, JSON.stringify(merged, null, 2));
  writeFileSync(BUNDLED, JSON.stringify(merged));
  console.log(`\nEnriched corpus written → ${CANONICAL}`);
  console.log(`Bundled into the app  → ${BUNDLED}`);
  console.log(`Audit                 → ${join(OUT_DIR, auditName)}`);
  console.log(`\nReview the audit; Settings → Reset → Clear local data, then reload to pick up the enriched corpus.`);
} else {
  writeFileSync(join(OUT_DIR, "dry-run-enriched.json"), JSON.stringify({ recipes: rows.map((r) => r.enriched) }, null, 2));
  console.log(`\nAudit  → ${join(OUT_DIR, auditName)}`);
  console.log(`Sample → ${join(OUT_DIR, "dry-run-enriched.json")}`);
}
