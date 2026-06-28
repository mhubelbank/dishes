// Learned measure modes (normalized item name → "count"), taught from items on
// save so a counted item auto-toggles to count when added later. Only "count" is
// stored — absence means the default "level". localStorage for now.
import { storage, StorageKeys } from "./storage";

export function loadMeasureRules(): Record<string, string> {
  try {
    const raw = storage.get(StorageKeys.measureRules);
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

export function saveMeasureRules(rules: Record<string, string>): void {
  storage.set(StorageKeys.measureRules, JSON.stringify(rules));
}
