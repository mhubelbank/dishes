// Learned sizes (normalized item name → { amount, unit }), taught from items on
// save so a re-added item gets its remembered package size. localStorage for now.
import { storage, StorageKeys } from "./storage";
import type { ItemSize, UnitKind } from "../domain/inventory";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function loadSizeRules(): Record<string, ItemSize> {
  try {
    const raw = storage.get(StorageKeys.sizeRules);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const out: Record<string, ItemSize> = {};
        for (const [k, v] of Object.entries(parsed as Record<string, any>)) {
          const amount = v?.amount;
          const unit = v?.unit;
          if (typeof amount === "number" && (unit === "unit" || unit === "oz" || unit === "lb")) {
            out[k] = { amount, unit: unit as UnitKind };
          }
        }
        return out;
      }
    }
  } catch {
    // fall through to empty
  }
  return {};
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function saveSizeRules(rules: Record<string, ItemSize>): void {
  storage.set(StorageKeys.sizeRules, JSON.stringify(rules));
}
