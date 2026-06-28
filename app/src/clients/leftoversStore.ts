// Persistence for leftovers. localStorage for now; moves to data/leftovers.json
// once the GitHub data repo is connected.
import { storage, StorageKeys } from "./storage";
import { emptyLeftovers, normalizeLeftovers, type Leftovers } from "../domain/leftovers";

export function loadLeftovers(): Leftovers {
  try {
    const raw = storage.get(StorageKeys.leftovers);
    if (raw) return normalizeLeftovers(JSON.parse(raw));
  } catch {
    // fall through to empty
  }
  return emptyLeftovers();
}

export function saveLeftovers(leftovers: Leftovers): void {
  storage.set(StorageKeys.leftovers, JSON.stringify(leftovers));
}
