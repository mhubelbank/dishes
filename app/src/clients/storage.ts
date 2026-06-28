// Thin wrapper over localStorage. All keys are namespaced under "dishes:" to
// avoid colliding with other apps if the same origin is ever shared.

const NS = "dishes:";

export const storage = {
  get(key: string): string | null {
    return localStorage.getItem(NS + key);
  },
  set(key: string, value: string): void {
    localStorage.setItem(NS + key, value);
  },
  remove(key: string): void {
    localStorage.removeItem(NS + key);
  },
  clear(): void {
    // Only clear our namespace, not the whole origin.
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NS)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  },
};

export const StorageKeys = {
  // BYO keys, held in this browser only — no server to exfiltrate them from.
  anthropicApiKey: "anthropic_api_key",
  githubToken: "github_token",
  // "owner/name" of the private dishes-data repo (the git-as-DB datastore).
  githubRepo: "github_repo",
  theme: "theme",
  page: "page",
  errorLog: "error_log",
  // The kitchen storage layout (units → compartments → columns → shelves). Local
  // for now; moves to data/kitchen-zones.json once the data repo is connected.
  kitchenLayout: "kitchen_layout",
  // Food on shelves (inventory items keyed to shelf ids). Saved on "Save" only.
  inventory: "inventory",
  // Household recipe corpus. Local for now; moves to data/recipes/*.json once
  // the GitHub data repo is connected.
  recipes: "recipes",
  // Rolling meal-slot timeline. Local for now; moves to data/meal-slots.json
  // once the GitHub data repo is connected.
  mealSlots: "meal_slots",
  // Cook log — one entry per cook (actual minutes → "your time", reactions).
  cookLog: "cook_log",
  // Fridge/freezer leftovers created at cook-log time.
  leftovers: "leftovers",
  // Available category vocabulary (seed + user-added).
  categories: "categories",
  // Learned name → category rules, taught from the household's items on save.
  categoryRules: "category_rules",
  // Learned name → color rules, taught from items on save (auto-color on add).
  colorRules: "color_rules",
  // Learned name → measure mode ("count"), taught from items on save.
  measureRules: "measure_rules",
  // Learned name → package size ({ amount, unit }), taught from items on save.
  sizeRules: "size_rules",
  // Demo/sandbox mode: a localStorage-backed "filesystem" implementing DataClient,
  // so the data layer runs entirely in-browser without a real data repo.
  demoFs: "demo_fs",
} as const;
