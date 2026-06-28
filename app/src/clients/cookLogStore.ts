// Persistence for the cook log. localStorage for now; moves to
// data/cook-log.json once the GitHub data repo is connected.
import { storage, StorageKeys } from "./storage";
import { emptyCookLog, normalizeCookLog, type CookLog } from "../domain/cookLog";

export function loadCookLog(): CookLog {
  try {
    const raw = storage.get(StorageKeys.cookLog);
    if (raw) return normalizeCookLog(JSON.parse(raw));
  } catch {
    // fall through to empty
  }
  return emptyCookLog();
}

export function saveCookLog(log: CookLog): void {
  storage.set(StorageKeys.cookLog, JSON.stringify(log));
}
