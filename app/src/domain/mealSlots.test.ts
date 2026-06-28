import { describe, expect, it } from "vitest";
import { DEFAULT_MEAL_WINDOWS, mealTypeForTime, mealWindowLabel } from "./mealSlots";

function at(hour: number, minute = 0): Date {
  return new Date(2026, 5, 25, hour, minute);
}

describe("mealTypeForTime", () => {
  it("uses the default day windows", () => {
    expect(mealTypeForTime(at(5))).toBe("breakfast");
    expect(mealTypeForTime(at(10, 59))).toBe("breakfast");
    expect(mealTypeForTime(at(11))).toBe("lunch");
    expect(mealTypeForTime(at(15, 59))).toBe("lunch");
    expect(mealTypeForTime(at(16))).toBe("dinner");
    expect(mealTypeForTime(at(22, 59))).toBe("dinner");
  });

  it("handles the late-night window across midnight", () => {
    expect(mealTypeForTime(at(23))).toBe("late_night");
    expect(mealTypeForTime(at(1))).toBe("late_night");
    expect(mealTypeForTime(at(4, 59))).toBe("late_night");
  });
});

describe("mealWindowLabel", () => {
  it("formats compact hour ranges", () => {
    expect(mealWindowLabel(DEFAULT_MEAL_WINDOWS[0]!)).toBe("5am-11am");
    expect(mealWindowLabel(DEFAULT_MEAL_WINDOWS[2]!)).toBe("4pm-11pm");
  });
});
