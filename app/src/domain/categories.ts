// Categories — the vocabulary inventory items are filed under (drives shelf life
// and home-shelf landing later). Two parts:
//   * SEED_CATEGORIES — the starting taxonomy (the user can add more at runtime).
//   * CATEGORY_RULES   — the "long common-sense list": normalized item name →
//     category, applied on save. This is the seed of dishes-data/categories.json;
//     bundled here until the data repo is connected.
//
// Pure + framework-free. Auto-categorization fills only BLANK categories — a
// manually-set one always wins — and unknown items stay blank (flagged in the UI).

import type { Inventory } from "./inventory";
import { normalizeName } from "./normalize";

// Re-exported for callers that imported it from here.
export { normalizeName };

export const SEED_CATEGORIES: string[] = [
  // produce
  "herbs",
  "vegetables",
  "fruit",
  "aromatics_roots",
  // protein & dairy
  "meat",
  "seafood",
  "deli",
  "eggs",
  "dairy",
  "cheese",
  "plant_protein",
  // shelf-stable
  "condiments",
  "oils_vinegars",
  "baking",
  "grains_pasta",
  "canned_jarred",
  "spices",
  "bread",
  "beverages",
  "snacks",
  // explicit catch-all (never auto-applied)
  "other",
];

export const CATEGORY_RULES: Record<string, string> = {
  // herbs
  basil: "herbs", cilantro: "herbs", parsley: "herbs", dill: "herbs", mint: "herbs",
  rosemary: "herbs", thyme: "herbs", oregano: "herbs", sage: "herbs", chives: "herbs", tarragon: "herbs",
  // vegetables
  carrot: "vegetables", carrots: "vegetables", pepper: "vegetables", "bell pepper": "vegetables",
  broccoli: "vegetables", cauliflower: "vegetables", cucumber: "vegetables", zucchini: "vegetables",
  tomato: "vegetables", tomatoes: "vegetables", lettuce: "vegetables", spinach: "vegetables",
  kale: "vegetables", chard: "vegetables", "swiss chard": "vegetables", cabbage: "vegetables",
  celery: "vegetables", mushroom: "vegetables", mushrooms: "vegetables", "green beans": "vegetables",
  "green bean": "vegetables", peas: "vegetables", corn: "vegetables", eggplant: "vegetables",
  asparagus: "vegetables", "brussels sprouts": "vegetables", squash: "vegetables", "bok choy": "vegetables",
  radish: "vegetables", beet: "vegetables",
  // fruit
  apple: "fruit", apples: "fruit", banana: "fruit", bananas: "fruit", orange: "fruit", oranges: "fruit",
  lemon: "fruit", lemons: "fruit", lime: "fruit", limes: "fruit", strawberry: "fruit", strawberries: "fruit",
  blueberry: "fruit", blueberries: "fruit", raspberry: "fruit", raspberries: "fruit", grape: "fruit",
  grapes: "fruit", melon: "fruit", watermelon: "fruit", peach: "fruit", pear: "fruit", mango: "fruit",
  pineapple: "fruit", avocado: "fruit", avocados: "fruit", cherry: "fruit", cherries: "fruit", kiwi: "fruit",
  plum: "fruit", berries: "fruit",
  // aromatics & roots
  onion: "aromatics_roots", onions: "aromatics_roots", garlic: "aromatics_roots", potato: "aromatics_roots",
  potatoes: "aromatics_roots", ginger: "aromatics_roots", shallot: "aromatics_roots", scallion: "aromatics_roots",
  scallions: "aromatics_roots", "green onion": "aromatics_roots", "sweet potato": "aromatics_roots",
  leek: "aromatics_roots", turnip: "aromatics_roots",
  // meat
  chicken: "meat", beef: "meat", pork: "meat", "ground beef": "meat", "ground turkey": "meat",
  turkey: "meat", steak: "meat", lamb: "meat", "ground chicken": "meat", "ground pork": "meat",
  // seafood
  salmon: "seafood", shrimp: "seafood", cod: "seafood", tilapia: "seafood", fish: "seafood",
  scallops: "seafood", crab: "seafood", lobster: "seafood", mussels: "seafood", clams: "seafood", trout: "seafood",
  // deli
  bacon: "deli", sausage: "deli", ham: "deli", salami: "deli", pepperoni: "deli", "hot dog": "deli",
  "hot dogs": "deli", prosciutto: "deli", "deli meat": "deli", "lunch meat": "deli",
  // eggs
  egg: "eggs", eggs: "eggs",
  // dairy
  milk: "dairy", yogurt: "dairy", butter: "dairy", cream: "dairy", "sour cream": "dairy",
  "heavy cream": "dairy", "half and half": "dairy", "cream cheese": "dairy", "cottage cheese": "dairy",
  buttermilk: "dairy",
  // cheese
  cheese: "cheese", cheddar: "cheese", mozzarella: "cheese", parmesan: "cheese", feta: "cheese",
  gouda: "cheese", brie: "cheese", "blue cheese": "cheese", swiss: "cheese", provolone: "cheese",
  // plant protein
  tofu: "plant_protein", tempeh: "plant_protein", edamame: "plant_protein", seitan: "plant_protein",
  // condiments
  mayo: "condiments", mayonnaise: "condiments", ketchup: "condiments", mustard: "condiments",
  "soy sauce": "condiments", "hot sauce": "condiments", sriracha: "condiments", ranch: "condiments",
  dressing: "condiments", "salad dressing": "condiments", "bbq sauce": "condiments", relish: "condiments",
  salsa: "condiments", pesto: "condiments", hoisin: "condiments", "fish sauce": "condiments",
  "oyster sauce": "condiments", gochujang: "condiments", doubanjiang: "condiments", miso: "condiments",
  tahini: "condiments", jam: "condiments", jelly: "condiments", honey: "condiments",
  "maple syrup": "condiments", "peanut butter": "condiments", nutella: "condiments",
  // oils & vinegars
  "olive oil": "oils_vinegars", "vegetable oil": "oils_vinegars", "canola oil": "oils_vinegars",
  "sesame oil": "oils_vinegars", vinegar: "oils_vinegars", "balsamic vinegar": "oils_vinegars",
  balsamic: "oils_vinegars", oil: "oils_vinegars",
  // baking
  flour: "baking", sugar: "baking", "brown sugar": "baking", "baking soda": "baking",
  "baking powder": "baking", vanilla: "baking", yeast: "baking", cocoa: "baking",
  "powdered sugar": "baking", "chocolate chips": "baking", cornstarch: "baking",
  // grains & pasta
  rice: "grains_pasta", pasta: "grains_pasta", spaghetti: "grains_pasta", noodles: "grains_pasta",
  noodle: "grains_pasta", oats: "grains_pasta", oatmeal: "grains_pasta", cereal: "grains_pasta",
  quinoa: "grains_pasta", couscous: "grains_pasta", barley: "grains_pasta",
  // canned & jarred
  "canned tomatoes": "canned_jarred", "tomato sauce": "canned_jarred", "tomato paste": "canned_jarred",
  beans: "canned_jarred", "black beans": "canned_jarred", chickpeas: "canned_jarred", broth: "canned_jarred",
  stock: "canned_jarred", "coconut milk": "canned_jarred", tuna: "canned_jarred", soup: "canned_jarred",
  olives: "canned_jarred", pickles: "canned_jarred", anchovies: "canned_jarred", anchovy: "canned_jarred",
  // spices
  salt: "spices", "black pepper": "spices", cumin: "spices", paprika: "spices", cinnamon: "spices",
  "garlic powder": "spices", "chili powder": "spices", "bay leaf": "spices", turmeric: "spices",
  "curry powder": "spices", "red pepper flakes": "spices", "onion powder": "spices",
  // bread
  bread: "bread", tortilla: "bread", tortillas: "bread", bagel: "bread", bagels: "bread",
  buns: "bread", bun: "bread", baguette: "bread", pita: "bread", naan: "bread", "english muffin": "bread",
  // beverages
  juice: "beverages", soda: "beverages", wine: "beverages", beer: "beverages", "sparkling water": "beverages",
  coffee: "beverages", tea: "beverages", kombucha: "beverages", lemonade: "beverages", seltzer: "beverages",
  // snacks
  chips: "snacks", crackers: "snacks", cookies: "snacks", cookie: "snacks", "granola bar": "snacks",
  "granola bars": "snacks", pretzels: "snacks", popcorn: "snacks", "trail mix": "snacks",
  "dried fruit": "snacks", chocolate: "snacks", candy: "snacks", almonds: "snacks", peanuts: "snacks",
};

// Best-effort lookup: exact normalized name, then singular, then the last word
// (e.g. "roma tomato" → "tomato"), then that word's singular. null = no match.
export function categorize(name: string, rules: Record<string, string> = CATEGORY_RULES): string | null {
  const n = normalizeName(name);
  if (!n) return null;
  if (rules[n]) return rules[n]!;

  const singular = n.endsWith("s") ? n.slice(0, -1) : null;
  if (singular && rules[singular]) return rules[singular]!;

  const words = n.split(" ");
  const last = words[words.length - 1];
  if (last && rules[last]) return rules[last]!;
  if (last && last.endsWith("s") && rules[last.slice(0, -1)]) return rules[last.slice(0, -1)]!;

  return null;
}

// Fill blank categories from the rules; preserve manual ones; leave unknowns blank.
export function autoCategorize(
  inv: Inventory,
  rules: Record<string, string> = CATEGORY_RULES,
): Inventory {
  return {
    items: inv.items.map((i) => {
      if (i.category && i.category.trim()) return i;
      const cat = categorize(i.name, rules);
      return cat ? { ...i, category: cat } : i;
    }),
  };
}

// Distinct, non-empty categories currently assigned to items (insertion order).
export function categoriesInUse(inv: Inventory): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of inv.items) {
    const c = i.category?.trim();
    if (c && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

// Union, preserving order and de-duping — used to fold newly-typed categories in.
export function mergeCategories(list: string[], add: string[]): string[] {
  const out = [...list];
  for (const c of add) if (c && !out.includes(c)) out.push(c);
  return out;
}

// Learned rules layered over the seed (learned wins).
export function mergedRules(learned: Record<string, string>): Record<string, string> {
  return { ...CATEGORY_RULES, ...learned };
}

// Teach the dictionary from categorized items: normalized name → category,
// overwriting any prior mapping. Lets a manually-set category stick for next time.
export function learnRules(
  inv: Inventory,
  learned: Record<string, string>,
): Record<string, string> {
  const next = { ...learned };
  for (const i of inv.items) {
    const cat = i.category?.trim();
    const key = normalizeName(i.name);
    if (cat && key) next[key] = cat;
  }
  return next;
}
