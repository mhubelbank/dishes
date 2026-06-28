// Persistence for the kitchen layout. For now it lives in localStorage so the map
// works immediately without a connected data repo. Once the DataClient connection
// (Settings) is wired, this moves to `data/kitchen-zones.json` in the dishes-data
// repo — the load/save shape here is deliberately swappable.
import { storage, StorageKeys } from "./storage";
import { emptyLayout, normalizeLayout, type KitchenLayout } from "../domain/kitchen";

export function loadLayout(): KitchenLayout {
  try {
    const raw = storage.get(StorageKeys.kitchenLayout);
    // normalizeLayout fills missing ids, restores the freezer invariant, and
    // upgrades the legacy compartment.shelves shape into a column.
    if (raw) return normalizeLayout(JSON.parse(raw));
  } catch {
    // fall through to empty
  }
  return emptyLayout();
}

export function saveLayout(layout: KitchenLayout): void {
  storage.set(StorageKeys.kitchenLayout, JSON.stringify(layout));
}
