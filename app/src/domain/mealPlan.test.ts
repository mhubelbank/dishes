import { describe, expect, it } from "vitest";
import {
  clearSlot,
  emptyMealPlan,
  localDateKey,
  markSlotCooked,
  normalizeMealPlan,
  planRecipe,
  slotFor,
  upcomingDateKeys,
} from "./mealPlan";

describe("mealPlan", () => {
  it("formats local date keys and upcoming windows", () => {
    const start = new Date(2026, 5, 27);
    expect(localDateKey(start)).toBe("2026-06-27");
    expect(upcomingDateKeys(start, 3)).toEqual(["2026-06-27", "2026-06-28", "2026-06-29"]);
  });

  it("plans, replaces, and clears one slot", () => {
    let plan = planRecipe(emptyMealPlan(), "2026-06-27", "dinner", "r1");
    expect(slotFor(plan, "2026-06-27", "dinner")?.recipeId).toBe("r1");

    plan = planRecipe(plan, "2026-06-27", "dinner", "r2", "pinned");
    expect(plan.slots).toHaveLength(1);
    expect(slotFor(plan, "2026-06-27", "dinner")).toEqual({
      date: "2026-06-27",
      mealType: "dinner",
      recipeId: "r2",
      status: "pinned",
    });

    plan = clearSlot(plan, "2026-06-27", "dinner");
    expect(slotFor(plan, "2026-06-27", "dinner")).toBeUndefined();
  });

  it("marks a slot cooked without removing it", () => {
    let plan = planRecipe(emptyMealPlan(), "2026-06-27", "dinner", "r1");
    plan = markSlotCooked(plan, "2026-06-27", "dinner");
    expect(slotFor(plan, "2026-06-27", "dinner")?.status).toBe("cooked");
    expect(slotFor(plan, "2026-06-27", "dinner")?.recipeId).toBe("r1");
  });

  it("normalizes persisted data", () => {
    const plan = normalizeMealPlan({
      slots: [
        { date: "2026-06-28", mealType: "lunch", recipeId: "r1", status: "nonsense" },
        { date: "bad", mealType: "dinner", recipeId: "r2", status: "planned" },
        { date: "2026-06-28", mealType: "snack", recipeId: "r3", status: "planned" },
        { date: "2026-06-28", mealType: "lunch", recipeId: "dupe", status: "planned" },
      ],
    });

    expect(plan.slots).toEqual([
      { date: "2026-06-28", mealType: "lunch", recipeId: "r1", status: "planned" },
    ]);
  });
});
