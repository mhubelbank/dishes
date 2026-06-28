import { describe, expect, it } from "vitest";
import {
  emptyCookLog,
  logCook,
  normalizeCookLog,
  yourTimeByRecipe,
  yourTimeFor,
} from "./cookLog";

describe("cookLog", () => {
  it("logs a cook with cleaned minutes and reactions", () => {
    const log = logCook(emptyCookLog(), {
      recipeId: "r1",
      actualMinutes: 32.6,
      reactions: { self: "loved", partner: "meh" },
    });
    expect(log.entries).toHaveLength(1);
    expect(log.entries[0]!.actualMinutes).toBe(33);
    expect(log.entries[0]!.reactions).toEqual({ self: "loved", partner: "meh" });
  });

  it("drops empty reactions", () => {
    const log = logCook(emptyCookLog(), { recipeId: "r1", actualMinutes: 20, reactions: {} });
    expect(log.entries[0]!.reactions).toBeUndefined();
  });

  it("computes median your-time per recipe", () => {
    let log = emptyCookLog();
    log = logCook(log, { recipeId: "r1", actualMinutes: 20 });
    log = logCook(log, { recipeId: "r1", actualMinutes: 40 });
    log = logCook(log, { recipeId: "r1", actualMinutes: 30 });
    log = logCook(log, { recipeId: "r2", actualMinutes: 50 });
    expect(yourTimeFor(log, "r1")).toBe(30);
    expect(yourTimeFor(log, "r2")).toBe(50);
    expect(yourTimeFor(log, "missing")).toBeUndefined();
    const byRecipe = yourTimeByRecipe(log);
    expect(byRecipe.get("r1")).toBe(30);
    expect(byRecipe.get("r2")).toBe(50);
  });

  it("averages the two middle values for an even count", () => {
    let log = emptyCookLog();
    log = logCook(log, { recipeId: "r1", actualMinutes: 20 });
    log = logCook(log, { recipeId: "r1", actualMinutes: 30 });
    expect(yourTimeFor(log, "r1")).toBe(25);
  });

  it("normalizes persisted shapes and drops invalid entries", () => {
    const log = normalizeCookLog({
      entries: [
        { id: "a", recipeId: "r1", actualMinutes: 25, cookedAt: "2026-06-27T00:00:00.000Z" },
        { recipeId: "r2" }, // missing minutes -> dropped
        { actualMinutes: 10 }, // missing recipe -> dropped
      ],
    });
    expect(log.entries).toHaveLength(1);
    expect(log.entries[0]!.recipeId).toBe("r1");
  });
});
