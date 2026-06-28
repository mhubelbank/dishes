// Cook log (§7.9 "Done cooking") — one entry per time a recipe was actually
// cooked. It records the real active minutes (the source of "your time", §6.6)
// and an optional per-palate reaction for the two cooks. Pure + framework-free.
//
// Reactions are captured now as memory; the suggester doesn't weight them yet
// (that arrives with preference tiers). "Your time" is the median of a recipe's
// own logged times — once it exists, surfaces show it and demote the recipe's
// claimed time to a footnote.

export type Reaction = "loved" | "fine" | "meh";
export const REACTIONS: Reaction[] = ["loved", "fine", "meh"];

export interface CookReactions {
  self?: Reaction;
  partner?: Reaction;
}

export interface CookLogEntry {
  id: string;
  recipeId: string;
  cookedAt: string; // ISO timestamp
  actualMinutes: number;
  reactions?: CookReactions;
}

export interface CookLog {
  entries: CookLogEntry[];
}

export function emptyCookLog(): CookLog {
  return { entries: [] };
}

function uid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `cook-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanMinutes(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(600, Math.max(1, Math.round(n)));
}

function cleanReactions(input?: CookReactions): CookReactions | undefined {
  const self = input?.self && REACTIONS.includes(input.self) ? input.self : undefined;
  const partner = input?.partner && REACTIONS.includes(input.partner) ? input.partner : undefined;
  if (!self && !partner) return undefined;
  return { ...(self ? { self } : {}), ...(partner ? { partner } : {}) };
}

export interface LogCookInput {
  recipeId: string;
  actualMinutes: number;
  reactions?: CookReactions;
}

export function logCook(log: CookLog, input: LogCookInput): CookLog {
  const reactions = cleanReactions(input.reactions);
  const entry: CookLogEntry = {
    id: uid(),
    recipeId: input.recipeId,
    cookedAt: new Date().toISOString(),
    actualMinutes: cleanMinutes(input.actualMinutes),
    ...(reactions ? { reactions } : {}),
  };
  return { entries: [...log.entries, entry] };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2) : sorted[mid]!;
}

// Median logged minutes for one recipe, or undefined if it's never been cooked.
export function yourTimeFor(log: CookLog, recipeId: string): number | undefined {
  const times = log.entries.filter((e) => e.recipeId === recipeId).map((e) => e.actualMinutes);
  return times.length ? median(times) : undefined;
}

// recipeId → median your-time, for surfaces that show many recipes at once.
export function yourTimeByRecipe(log: CookLog): Map<string, number> {
  const grouped = new Map<string, number[]>();
  for (const e of log.entries) {
    const arr = grouped.get(e.recipeId);
    if (arr) arr.push(e.actualMinutes);
    else grouped.set(e.recipeId, [e.actualMinutes]);
  }
  const out = new Map<string, number>();
  for (const [recipeId, times] of grouped) out.set(recipeId, median(times));
  return out;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function normalizeCookLog(raw: any): CookLog {
  if (!raw || !Array.isArray(raw.entries)) return emptyCookLog();
  const entries: CookLogEntry[] = [];
  for (const e of raw.entries) {
    if (!e || typeof e.recipeId !== "string" || typeof e.actualMinutes !== "number") continue;
    const reactions = cleanReactions(e.reactions);
    entries.push({
      id: String(e.id ?? uid()),
      recipeId: e.recipeId,
      cookedAt: String(e.cookedAt ?? new Date().toISOString()),
      actualMinutes: cleanMinutes(e.actualMinutes),
      ...(reactions ? { reactions } : {}),
    });
  }
  return { entries };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
