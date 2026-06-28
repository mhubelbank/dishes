// Learned color rules (normalized item name → hex), taught from items on save so
// the same item auto-colors when added later. localStorage for now.
import { storage, StorageKeys } from "./storage";

export function loadColorRules(): Record<string, string> {
  try {
    const raw = storage.get(StorageKeys.colorRules);
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

export function saveColorRules(rules: Record<string, string>): void {
  storage.set(StorageKeys.colorRules, JSON.stringify(rules));
}
