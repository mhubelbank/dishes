import type { MealType } from "./recipes";

export type MealSlotStatus = "planned" | "pinned" | "skipped" | "cooked";

export interface MealSlot {
  date: string; // yyyy-mm-dd, local date
  mealType: MealType;
  recipeId?: string;
  status: MealSlotStatus;
}

export interface MealPlan {
  slots: MealSlot[];
}

export function emptyMealPlan(): MealPlan {
  return { slots: [] };
}

export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function upcomingDateKeys(start: Date = new Date(), count = 7): string[] {
  return Array.from({ length: count }, (_, index) => localDateKey(addDays(start, index)));
}

export function slotKey(date: string, mealType: MealType): string {
  return `${date}:${mealType}`;
}

export function slotFor(plan: MealPlan, date: string, mealType: MealType): MealSlot | undefined {
  return plan.slots.find((slot) => slot.date === date && slot.mealType === mealType);
}

export function planRecipe(
  plan: MealPlan,
  date: string,
  mealType: MealType,
  recipeId: string,
  status: MealSlotStatus = "planned",
): MealPlan {
  const next: MealSlot = { date, mealType, recipeId, status };
  const key = slotKey(date, mealType);
  const slots = plan.slots.filter((slot) => slotKey(slot.date, slot.mealType) !== key);
  return { slots: [...slots, next].sort(compareSlots) };
}

export function clearSlot(plan: MealPlan, date: string, mealType: MealType): MealPlan {
  const key = slotKey(date, mealType);
  return { slots: plan.slots.filter((slot) => slotKey(slot.date, slot.mealType) !== key) };
}

export function markSlotCooked(plan: MealPlan, date: string, mealType: MealType): MealPlan {
  const key = slotKey(date, mealType);
  return {
    slots: plan.slots.map((slot) =>
      slotKey(slot.date, slot.mealType) === key ? { ...slot, status: "cooked" } : slot,
    ),
  };
}

function compareSlots(a: MealSlot, b: MealSlot): number {
  return a.date.localeCompare(b.date) || a.mealType.localeCompare(b.mealType);
}

function isMealType(value: unknown): value is MealType {
  return value === "breakfast" || value === "lunch" || value === "dinner" || value === "late_night";
}

function isStatus(value: unknown): value is MealSlotStatus {
  return value === "planned" || value === "pinned" || value === "skipped" || value === "cooked";
}

export function normalizeMealPlan(value: unknown): MealPlan {
  if (!value || typeof value !== "object" || !Array.isArray((value as MealPlan).slots)) {
    return emptyMealPlan();
  }
  const slots: MealSlot[] = [];
  const seen = new Set<string>();
  for (const raw of (value as MealPlan).slots) {
    if (!raw || typeof raw !== "object") continue;
    const slot = raw as Partial<MealSlot>;
    if (typeof slot.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(slot.date)) continue;
    if (!isMealType(slot.mealType)) continue;
    if (slot.recipeId !== undefined && typeof slot.recipeId !== "string") continue;
    const key = slotKey(slot.date, slot.mealType);
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({
      date: slot.date,
      mealType: slot.mealType,
      ...(slot.recipeId ? { recipeId: slot.recipeId } : {}),
      status: isStatus(slot.status) ? slot.status : "planned",
    });
  }
  return { slots: slots.sort(compareSlots) };
}
