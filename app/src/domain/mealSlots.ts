import type { MealType } from "./recipes";

export interface MealWindow {
  meal: MealType;
  label: string;
  shortLabel: string;
  start: string; // HH:MM, local time
  end: string; // HH:MM, local time
}

export const DEFAULT_MEAL_WINDOWS: MealWindow[] = [
  { meal: "breakfast", label: "Breakfast", shortLabel: "Breakfast", start: "05:00", end: "11:00" },
  { meal: "lunch", label: "Lunch", shortLabel: "Lunch", start: "11:00", end: "16:00" },
  { meal: "dinner", label: "Dinner", shortLabel: "Dinner", start: "16:00", end: "23:00" },
  { meal: "late_night", label: "Late night snack", shortLabel: "Snack", start: "23:00", end: "05:00" },
];

function minutesFromClock(clock: string): number {
  const [hh, mm] = clock.split(":");
  const hours = Number(hh);
  const minutes = Number(mm);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return 0;
  return Math.max(0, Math.min(1439, hours * 60 + minutes));
}

function timeInWindow(time: number, start: number, end: number): boolean {
  if (start === end) return true;
  if (start < end) return time >= start && time < end;
  return time >= start || time < end;
}

export function mealTypeForTime(
  date: Date,
  windows: MealWindow[] = DEFAULT_MEAL_WINDOWS,
): MealType {
  const time = date.getHours() * 60 + date.getMinutes();
  for (const window of windows) {
    if (timeInWindow(time, minutesFromClock(window.start), minutesFromClock(window.end))) {
      return window.meal;
    }
  }
  return "dinner";
}

function hourLabel(clock: string): string {
  const minutes = minutesFromClock(clock);
  const hour24 = Math.floor(minutes / 60);
  const hour12 = hour24 % 12 || 12;
  return `${hour12}${hour24 < 12 ? "am" : "pm"}`;
}

export function mealWindowLabel(window: MealWindow): string {
  return `${hourLabel(window.start)}-${hourLabel(window.end)}`;
}
