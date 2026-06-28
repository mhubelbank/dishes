// Learned category rules (normalized item name → category), taught from the
// household's own items on save and layered over the seed dictionary. localStorage
// for now; moves to dishes-data alongside categories.json once connected.
import { storage, StorageKeys } from "./storage";

export function loadCategoryRules(): Record<string, string> {
  try {
    const raw = storage.get(StorageKeys.categoryRules);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) if (typeof v === "string") out[k] = v;
        return out;
      }
    }
  } catch {
    // fall through to empty
  }
  return {};
}

export function saveCategoryRules(rules: Record<string, string>): void {
  storage.set(StorageKeys.categoryRules, JSON.stringify(rules));
}
