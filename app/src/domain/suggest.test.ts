import { describe, it, expect } from "vitest";
import { suggestItems } from "./suggest";

const vocab = ["chili", "chili pepper", "sweet chili sauce", "chicken", "cilantro", "olive oil"];

describe("suggestItems", () => {
  it("ranks prefix, then word-prefix, then substring; shorter first", () => {
    expect(suggestItems("chili", vocab)).toEqual(["chili", "chili pepper", "sweet chili sauce"]);
  });

  it("prefers prefix matches, shorter first", () => {
    expect(suggestItems("chi", vocab).slice(0, 2)).toEqual(["chili", "chicken"]);
  });

  it("returns nothing for an empty query", () => {
    expect(suggestItems("", vocab)).toEqual([]);
  });
});
