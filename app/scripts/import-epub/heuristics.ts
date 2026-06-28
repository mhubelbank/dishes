// Deterministic heuristics for the cookbook importer. These cover the
// "language-shaped" fields no markup separates (ingredient name vs. quantity,
// cuisine, allergens, time) at pilot quality. The batch LLM pass (requirements
// §11) is the eventual upgrade for ingredient parsing + richer tags; this keeps
// the pilot dependency-free and good enough to cook from.
import type { CleanupScore, MealType, RecipeForm, RecipeRole, RecipeIngredient, Vessel } from "../../src/domain/recipes";

// ---------- fractions ----------

const FRACTIONS: Record<string, string> = {
  "¼": "1/4", "½": "1/2", "¾": "3/4", "⅓": "1/3", "⅔": "2/3",
  "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5", "⅙": "1/6",
  "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
};

export function normalizeFractions(text: string): string {
  return text.replace(/[¼½¾⅓⅔⅕⅖⅗⅘⅙⅛⅜⅝⅞]/g, (m) => ` ${FRACTIONS[m] ?? m}`).replace(/\s+/g, " ").trim();
}

// ---------- time ----------

// "START TO FINISH 50 minutes" / "40 to 45 minutes" / "1¼ hours" → active minutes.
// Ranges take the upper bound (the honest "this might run long" read, §6.6).
export function parseMinutes(yieldText: string): number | undefined {
  const t = normalizeFractions(yieldText).toLowerCase();
  let minutes = 0;
  const hours = t.match(/(\d+(?:\s+\d+\/\d+)?|\d+\/\d+)\s*hour/);
  if (hours) minutes += Math.round(fractionToNumber(hours[1]!) * 60);
  // pick the largest minute figure present (upper bound of any range)
  const mins = [...t.matchAll(/(\d+)\s*minute/g)].map((m) => Number(m[1]));
  if (mins.length) minutes += Math.max(...mins);
  else if (!hours) {
    // bare ranges like "40 to 45" with the word minutes dropped earlier
    const bare = [...t.matchAll(/\b(\d{1,3})\b/g)].map((m) => Number(m[1])).filter((n) => n >= 5 && n <= 240);
    if (bare.length) minutes += Math.max(...bare);
  }
  return minutes > 0 ? minutes : undefined;
}

function fractionToNumber(s: string): number {
  const parts = s.trim().split(/\s+/);
  let total = 0;
  for (const p of parts) {
    if (p.includes("/")) {
      const [n, d] = p.split("/").map(Number);
      if (n && d) total += n / d;
    } else total += Number(p) || 0;
  }
  return total;
}

// ---------- servings (parsed but not yet stored on the model) ----------

export function parseServings(yieldText: string): number | undefined {
  const m = normalizeFractions(yieldText).match(/(\d+)/);
  return m ? Number(m[1]) : undefined;
}

// ---------- ingredients ----------

const UNITS = new Set([
  "teaspoon", "teaspoons", "tsp", "tablespoon", "tablespoons", "tbsp", "cup", "cups",
  "pound", "pounds", "lb", "lbs", "ounce", "ounces", "oz", "gram", "grams", "g", "kg",
  "quart", "quarts", "pint", "pints", "gallon", "liter", "liters", "ml",
  "clove", "cloves", "can", "cans", "package", "packages", "pinch", "pinches",
  "bunch", "bunches", "sprig", "sprigs", "slice", "slices", "stalk", "stalks",
  "head", "heads", "piece", "pieces", "inch", "inches", "stick", "sticks", "ear", "ears",
]);

const NUMWORD = /^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|half)$/;
// Only true size words — kept minimal so we never strip identity words like
// "boneless" or "ground" out of an ingredient's name.
const SIZE_DESC = new Set(["small", "medium", "large", "extra-large"]);

// A comma clause that starts with one of these is preparation (a note), not part
// of the food's identity — lets us split "garlic cloves, peeled" while keeping
// the adjective comma in "boneless, skinless chicken thighs".
const PREP_LEAD = new Set([
  "sliced", "peeled", "chopped", "minced", "diced", "trimmed", "cut", "drained",
  "rinsed", "halved", "quartered", "grated", "crushed", "seeded", "stemmed",
  "cored", "julienned", "shredded", "melted", "softened", "beaten", "packed",
  "divided", "finely", "roughly", "thinly", "coarsely", "freshly", "torn",
  "cubed", "crumbled", "zested", "toasted", "patted", "smashed", "pitted",
]);

function splitPrep(body: string): { name: string; note?: string } {
  const segments = body.split(/,\s*/);
  for (let i = 1; i < segments.length; i++) {
    const first = segments[i]!.trim().toLowerCase().split(" ")[0]!;
    if (PREP_LEAD.has(first)) {
      const name = segments.slice(0, i).join(", ").trim();
      const note = segments.slice(i).join(", ").trim();
      return note ? { name, note } : { name };
    }
  }
  return { name: body.trim() };
}

// "1½ pounds boneless, skinless chicken thighs" → { name: "boneless, skinless
// chicken thighs" }. Strips the leading quantity/unit/size (the app is
// inventory-coarse, §6.3 — recipe amounts aren't modelled) and keeps the rest as
// the food name so inventory matching has the full phrase. Commas are kept (a
// comma usually joins adjectives, not prep), but trailing "or X"/"plus X"
// alternatives and parentheticals are dropped. The batch LLM pass is the eventual
// upgrade for a proper qty/unit/name/prep split.
export function parseIngredient(raw: string): RecipeIngredient | null {
  let line = normalizeFractions(raw).replace(/\s+/g, " ").trim();
  if (!line) return null;
  // cut trailing alternatives/prep clauses that bloat the food name
  line = line.split(/\s+(?:or|plus)\s+/i)[0]!.trim();

  const tokens = line.split(" ");
  const qtyTokens: string[] = [];
  // leading quantity: numbers, fractions, ranges, number-words, "to"
  while (tokens.length > 1) {
    const t = tokens[0]!.toLowerCase().replace(/[(),]/g, "");
    if (/^[\d/.-]+$/.test(t) || NUMWORD.test(t) || t === "to") {
      qtyTokens.push(tokens.shift()!);
      continue;
    }
    break;
  }
  // capture one unit token as part of the quantity ("1 1/2 pounds")
  if (tokens.length > 1 && UNITS.has(tokens[0]!.toLowerCase().replace(/[(),.]/g, ""))) {
    qtyTokens.push(tokens.shift()!);
  }
  // drop a leading parenthetical like "(about 1 inch thick)"
  while (tokens.length > 1 && tokens[0]!.startsWith("(")) {
    const closed = tokens.findIndex((t) => t.includes(")"));
    if (closed < 0) break;
    tokens.splice(0, closed + 1);
  }
  // drop a leading size descriptor ("medium garlic cloves" → "garlic cloves")
  while (tokens.length > 1 && SIZE_DESC.has(tokens[0]!.toLowerCase())) tokens.shift();

  const quantity = qtyTokens.join(" ").replace(/[(),]/g, "").trim();

  // strip parentheticals, normalize spacing, and clean a stray leading comma left
  // behind by a removed "(…)," group
  let body = tokens.join(" ").replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  body = body.replace(/^[,\s]+/, "").replace(/[.;:,]+$/, "").trim();
  if (!body) body = line;

  const { name, note } = splitPrep(body);
  const cleanName = name.replace(/[.;:,]+$/, "").trim();
  if (!cleanName) return null;
  return {
    name: cleanName,
    ...(quantity ? { quantity } : {}),
    ...(note ? { note } : {}),
  };
}

// ---------- allergens (hard filter, §6.5) ----------

const TREE_NUTS = /\b(almond|walnut|pecan|cashew|pistachio|hazelnut|filbert|macadamia|brazil nut|pine nut|chestnut|praline|marzipan|nutella|frangipane)\w*/i;
const PEANUT = /\bpeanut/i;

export function scanAllergens(texts: string[]): { peanuts: boolean; treeNuts: boolean } {
  const blob = texts.join(" \n ");
  return { peanuts: PEANUT.test(blob), treeNuts: TREE_NUTS.test(blob) };
}

// ---------- cuisine (→ genres) ----------

const CUISINE: Array<[RegExp, string]> = [
  [/\b(mexican|veracruz|taco|tinga|mole|pozole|enchilada|carnitas|salsa|chipotle|adobo|al pastor)\b/i, "Mexican"],
  [/\b(italian|pasta|risotto|parmesan|pesto|marinara|carbonara|piccata|caprese|gnocchi|polenta)\b/i, "Italian"],
  [/\b(thai|tom yum|pad\b|larb|curry paste|lemongrass|coconut curry)\b/i, "Thai"],
  [/\b(korean|gochujang|kimchi|bulgogi|bibimbap|tteok)\b/i, "Korean"],
  [/\b(vietnamese|pho|banh|nuoc cham|lemongrass)\b/i, "Vietnamese"],
  [/\b(japanese|miso|teriyaki|udon|soba|dashi|tonkatsu|katsu|yakitori)\b/i, "Japanese"],
  [/\b(chinese|sichuan|szechuan|hoisin|mapo|lo mein|wonton|dan dan|kung pao|stir-?fry)\b/i, "Chinese"],
  [/\b(indian|masala|tikka|curry|paneer|dal|tandoori|biryani|korma|vindaloo)\b/i, "Indian"],
  [/\b(turkish|moroccan|harissa|tagine|shakshuka|za'?atar|tahini|levantine|lebanese)\b/i, "Middle Eastern"],
  [/\b(greek|feta|tzatziki|spanakopita|gyro)\b/i, "Greek"],
  [/\b(spanish|paella|chorizo|romesco|gazpacho|tapas)\b/i, "Spanish"],
  [/\b(french|provençal|provencal|dijon|ratatouille|bourguignon|beurre)\b/i, "French"],
];

export function detectCuisine(title: string, headnote: string): string[] {
  const hay = `${title} ${headnote}`;
  for (const [re, name] of CUISINE) if (re.test(hay)) return [name];
  return [];
}

// ---------- vessel + cleanup (from the section name) ----------

export function vesselForSection(section: string, title: string): Vessel {
  const s = `${section} ${title}`.toLowerCase();
  if (/stir-?fry|stir-?fries/.test(s)) return "skillet";
  if (/one[- ]pot|done in one|one-?pan/.test(s)) return "one_pot";
  if (/roast|bake|sheet/.test(s)) return "sheet_pan";
  if (/pizza|sandwich|slice/.test(s)) return "multiple";
  if (/salad/.test(s)) return "no_cook";
  return "skillet";
}

export function cleanupForVessel(v: Vessel): CleanupScore {
  return v === "multiple" ? "medium" : "low";
}

// ---------- meal types ----------

export function mealTypesForSection(section: string): MealType[] {
  if (/sweet|dessert/i.test(section)) return ["dinner"];
  if (/side/i.test(section)) return ["dinner", "lunch"];
  return ["dinner", "lunch"];
}

// ---------- course (lean taxonomy dimension) ----------

// FORM = what the dish is (its structure), inferred from the title. Tight,
// boundary-anchored keywords only — the batch LLM pass refines. Returns undefined
// when no clear structure (e.g. a plain seared protein).
export function formFor(title: string): RecipeForm | undefined {
  const t = title.toLowerCase();
  // soup = brothy/liquid; stew = thick, simmered-in-sauce (curry, tagine, braise…)
  if (/\b(soup|chowder|bisque|ramen|pho|broth)\b/.test(t)) return "soup";
  if (/\b(stew|stewed|tagine|braise|braised|curry|masala|tikka|korma|vindaloo|rogan|daube|gumbo)\b/.test(t)) return "stew";
  if (/\bsalad\b/.test(t)) return "salad";
  if (/\bpizza\b/.test(t)) return "pizza";
  if (/\b(pasta|spaghetti|linguine|linguini|penne|rigatoni|orzo|noodle|noodles|mac and cheese|lasagna|gnocchi)\b/.test(t)) return "pasta";
  if (/\bstir-?fr/.test(t)) return "stir-fry";
  if (/\b(sandwich|burger|wrap|taco|tacos|quesadilla|torta|sub|melt|panini)\b/.test(t)) return "sandwich";
  if (/\b(bread|focaccia|flatbread|naan|biscuit|biscuits)\b/.test(t)) return "bread";
  if (/\b(roast|roasted|sheet-?pan)\b/.test(t)) return "roast";
  if (/\b(casserole|gratin|baked|bake)\b/.test(t)) return "bake";
  if (/\b(risotto|pilaf|fried rice|grain bowl|quinoa|farro|bulgur|polenta)\b/.test(t)) return "grain-bowl";
  // sauce/beverage as a STANDALONE dish are rare and easy to over-match
  // ("Pork in Tomato Sauce" is a main) — leave them to the LLM pass / manual entry.
  return undefined;
}

// ROLE = the part of the meal it plays. Section is authoritative in these books,
// then the headnote. (A "Supper Salads" recipe is a main-course salad → role main.)
export function roleFor(section: string, description = ""): RecipeRole {
  const s = section.toLowerCase();
  if (/sweet|dessert/.test(s)) return "dessert";
  if (/\bsides?\b|addition/.test(s)) return "side";
  if (/\bside dish\b/.test(description.toLowerCase())) return "side";
  if (/appetizer|starter|snack/.test(s)) return "appetizer";
  return "main";
}

// ---------- main ingredient ----------

const MAIN_INGREDIENT: Array<[RegExp, string]> = [
  [/\b(chicken|poussin)\b/i, "chicken"],
  [/\b(beef|steak|brisket|short rib|ground beef)\b/i, "beef"],
  [/\b(pork|sausage|bacon|pancetta|chorizo|ham|prosciutto)\b/i, "pork"],
  [/\b(lamb)\b/i, "lamb"],
  [/\b(shrimp|prawn|scallop|squid|calamari|clam|mussel|crab|lobster)\b/i, "seafood"],
  [/\b(salmon|cod|tuna|halibut|trout|tilapia|snapper|fish|anchov)\b/i, "fish"],
  [/\b(tofu|tempeh)\b/i, "tofu"],
  [/\b(egg|eggs|frittata|omelet)\b/i, "eggs"],
  [/\b(bean|beans|chickpea|lentil|dal)\b/i, "beans"],
  [/\b(pasta|noodle|spaghetti|penne|rigatoni|linguin|udon|soba|gnocchi|orzo)\b/i, "pasta"],
  [/\b(rice|farro|quinoa|barley|polenta|grain|couscous|bulgur)\b/i, "grain"],
];

export function mainIngredientFor(title: string, ingredients: RecipeIngredient[]): string | undefined {
  for (const [re, name] of MAIN_INGREDIENT) if (re.test(title)) return name;
  const blob = ingredients.map((i) => i.name).join(" ");
  for (const [re, name] of MAIN_INGREDIENT) if (re.test(blob)) return name;
  return undefined;
}
