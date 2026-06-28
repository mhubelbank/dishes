// The available category vocabulary (seed + user-added). localStorage for now;
// moves to dishes-data/categories.json once the data repo is connected.
import { storage, StorageKeys } from "./storage";
import { SEED_CATEGORIES } from "../domain/categories";

export function loadCategories(): string[] {
  try {
    const raw = storage.get(StorageKeys.categories);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        return parsed as string[];
      }
    }
  } catch {
    // fall through to seed
  }
  return [...SEED_CATEGORIES];
}

export function saveCategories(cats: string[]): void {
  storage.set(StorageKeys.categories, JSON.stringify(cats));
}
