// Leftovers (§6.4) — created at cook-log time. Fridge leftovers carry a portion
// count + a short eat-by clock and become suggestion #0 on Today. Freezer
// leftovers carry neither (they join the freezer-meals pool, surfaced in tired
// mode later). Pure + framework-free.
import { daysUntil } from "./inventory";

export type LeftoverLocation = "fridge" | "freezer";

// Fridge leftovers default to a 3-day eat-by — a short, honest clock, not a
// precise shelf-life model.
export const FRIDGE_EAT_BY_DAYS = 3;

export interface Leftover {
  id: string;
  recipeId: string;
  title: string; // snapshot so it still reads even if the recipe is later removed
  location: LeftoverLocation;
  portions?: number; // fridge only
  eatBy?: string; // yyyy-mm-dd, fridge only
  createdAt: string; // ISO timestamp
}

export interface Leftovers {
  items: Leftover[];
}

export function emptyLeftovers(): Leftovers {
  return { items: [] };
}

function uid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `lo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isoDatePlusDays(days: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface AddLeftoverInput {
  recipeId: string;
  title: string;
  location: LeftoverLocation;
  portions?: number; // fridge only; ignored for freezer
  now?: Date;
}

export function addLeftover(leftovers: Leftovers, input: AddLeftoverInput): Leftovers {
  const now = input.now ?? new Date();
  const item: Leftover =
    input.location === "fridge"
      ? {
          id: uid(),
          recipeId: input.recipeId,
          title: input.title,
          location: "fridge",
          portions: Math.max(1, Math.round(input.portions ?? 2)),
          eatBy: isoDatePlusDays(FRIDGE_EAT_BY_DAYS, now),
          createdAt: now.toISOString(),
        }
      : {
          id: uid(),
          recipeId: input.recipeId,
          title: input.title,
          location: "freezer",
          createdAt: now.toISOString(),
        };
  return { items: [...leftovers.items, item] };
}

export function removeLeftover(leftovers: Leftovers, id: string): Leftovers {
  return { items: leftovers.items.filter((item) => item.id !== id) };
}

// Fridge leftovers needing eating, soonest eat-by first — these render as
// suggestion #0 on Today (§7.1). Freezer leftovers are excluded (no clock).
export function freshFridgeLeftovers(leftovers: Leftovers): Leftover[] {
  return leftovers.items
    .filter((item) => item.location === "fridge")
    .sort((a, b) => (a.eatBy ?? "").localeCompare(b.eatBy ?? ""));
}

// Plain-language eat-by, e.g. "best by today" / "best by tomorrow" / "best in 3 days".
export function eatByLabel(leftover: Leftover, now: Date = new Date()): string {
  if (!leftover.eatBy) return "";
  const d = daysUntil(leftover.eatBy, now);
  if (!Number.isFinite(d)) return "";
  if (d <= 0) return "best today";
  if (d === 1) return "best by tomorrow";
  return `best within ${d} days`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizeLeftovers(raw: any): Leftovers {
  if (!raw || !Array.isArray(raw.items)) return emptyLeftovers();
  const items: Leftover[] = [];
  for (const i of raw.items) {
    if (!i || typeof i.recipeId !== "string" || typeof i.title !== "string") continue;
    const location: LeftoverLocation = i.location === "freezer" ? "freezer" : "fridge";
    items.push({
      id: String(i.id ?? uid()),
      recipeId: i.recipeId,
      title: i.title,
      location,
      ...(location === "fridge" && typeof i.portions === "number"
        ? { portions: Math.max(1, Math.round(i.portions)) }
        : {}),
      ...(location === "fridge" && typeof i.eatBy === "string" ? { eatBy: i.eatBy } : {}),
      createdAt: String(i.createdAt ?? new Date().toISOString()),
    });
  }
  return { items };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
