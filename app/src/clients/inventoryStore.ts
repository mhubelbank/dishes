// Persistence for inventory (food on shelves). localStorage for now; moves to
// the dishes-data repo (derived from purchases/cook-log/edits) once connected.
import { storage, StorageKeys } from "./storage";
import { emptyInventory, normalizeInventory, type Inventory } from "../domain/inventory";

export function loadInventory(): Inventory {
  try {
    const raw = storage.get(StorageKeys.inventory);
    if (raw) return normalizeInventory(JSON.parse(raw));
  } catch {
    // fall through to empty
  }
  return emptyInventory();
}

export function saveInventory(inv: Inventory): void {
  storage.set(StorageKeys.inventory, JSON.stringify(inv));
}
