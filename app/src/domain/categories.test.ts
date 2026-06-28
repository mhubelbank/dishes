import { describe, it, expect } from "vitest";
import {
  categorize,
  autoCategorize,
  mergeCategories,
  mergedRules,
  learnRules,
  SEED_CATEGORIES,
} from "./categories";
import { addItem, emptyInventory, setCategory } from "./inventory";

describe("categorize", () => {
  it("matches common items, case- and space-insensitively", () => {
    expect(categorize("Mayo")).toBe("condiments");
    expect(categorize("  Olive Oil ")).toBe("oils_vinegars");
    expect(categorize("eggs")).toBe("eggs");
  });

  it("falls back to the last word / singular", () => {
    expect(categorize("roma tomato")).toBe("vegetables");
    expect(categorize("Honeycrisp apples")).toBe("fruit");
  });

  it("returns null for unknown items", () => {
    expect(categorize("doohickey")).toBeNull();
  });
});

describe("autoCategorize", () => {
  it("fills blanks from the rules, preserves manual ones, leaves unknowns blank", () => {
    let inv = addItem(emptyInventory(), "s1", { name: "Mayo" });
    inv = addItem(inv, "s1", { name: "Mystery paste" });
    inv = addItem(inv, "s1", { name: "Spinach" });
    // A manually-set category must survive even though a rule exists for spinach.
    inv = setCategory(inv, inv.items[2]!.id, "leafy stuff");

    const out = autoCategorize(inv);
    expect(out.items[0]!.category).toBe("condiments");
    expect(out.items[1]!.category).toBeUndefined();
    expect(out.items[2]!.category).toBe("leafy stuff");
  });
});

describe("learned rules", () => {
  it("learns name → category from items, and overrides the seed next time", () => {
    let inv = addItem(emptyInventory(), "s1", { name: "Doubanjiang" });
    inv = setCategory(inv, inv.items[0]!.id, "pantry");
    // Also override a seed mapping (mayo is normally condiments).
    inv = addItem(inv, "s1", { name: "Mayo" });
    inv = setCategory(inv, inv.items[1]!.id, "spreads");

    const learned = learnRules(inv, {});
    expect(learned["doubanjiang"]).toBe("pantry");
    expect(learned["mayo"]).toBe("spreads");

    const rules = mergedRules(learned);
    expect(categorize("doubanjiang", rules)).toBe("pantry");
    expect(categorize("mayo", rules)).toBe("spreads"); // learned wins over seed
    expect(categorize("mayo")).toBe("condiments"); // seed unchanged
  });
});

describe("mergeCategories", () => {
  it("appends new categories, preserving order and de-duping", () => {
    expect(mergeCategories(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("ships a non-trivial seed taxonomy", () => {
    expect(SEED_CATEGORIES.length).toBeGreaterThan(10);
  });
});
