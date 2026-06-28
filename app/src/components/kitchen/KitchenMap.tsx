import { useState } from "react";
import { loadLayout, saveLayout } from "../../clients/kitchenStore";
import { loadInventory, saveInventory } from "../../clients/inventoryStore";
import { loadCategories, saveCategories } from "../../clients/categoriesStore";
import { loadCategoryRules, saveCategoryRules } from "../../clients/categoryRulesStore";
import type { KitchenLayout } from "../../domain/kitchen";
import {
  type Inventory,
  type QuantityState,
  type SortBy,
  sortInventory,
  addItem,
  setQuantity,
  renameItem,
  setExpiry,
  type ItemSize,
  setCategory,
  setColor,
  setMeasure,
  setCount,
  setSize,
  removeItem,
  learnColors,
  colorForName,
  learnMeasures,
  measureForName,
  learnSizes,
  sizeForName,
} from "../../domain/inventory";
import { loadSizeRules, saveSizeRules } from "../../clients/sizeRulesStore";
import { loadColorRules, saveColorRules } from "../../clients/colorRulesStore";
import { loadMeasureRules, saveMeasureRules } from "../../clients/measureRulesStore";
import {
  autoCategorize,
  categoriesInUse,
  mergeCategories,
  mergedRules,
  learnRules,
} from "../../domain/categories";
import { LayoutEditor } from "./LayoutEditor";
import { StockView } from "./StockView";

type Mode = "stock" | "layout";

// Two modes over one map: Stock (put food on shelves — edited as a draft, saved
// all at once with auto-categorization) and Edit layout (the structural editor,
// which persists immediately).
export function KitchenMap() {
  const [layout, setLayout] = useState<KitchenLayout>(loadLayout);
  const [baseline, setBaseline] = useState<Inventory>(loadInventory);
  // Working copy lives in memory only — nothing persists until Save.
  const [draft, setDraft] = useState<Inventory>(() => baseline);
  const [categories, setCategories] = useState<string[]>(loadCategories);
  const [learned, setLearned] = useState<Record<string, string>>(loadCategoryRules);
  const [learnedColors, setLearnedColors] = useState<Record<string, string>>(loadColorRules);
  const [learnedMeasures, setLearnedMeasures] = useState<Record<string, string>>(loadMeasureRules);
  const [learnedSizes, setLearnedSizes] = useState<Record<string, ItemSize>>(loadSizeRules);
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortDirty, setSortDirty] = useState(false); // a sort was chosen but not yet applied
  const [mode, setMode] = useState<Mode>("stock");

  // Choosing a sort doesn't reorder live — it's applied on Save.
  function changeSort(by: SortBy) {
    setSortBy(by);
    setSortDirty(true);
  }

  // Names the dictionaries have learned (any of category/color/measure), and a way
  // to forget one — wired into the autocomplete dropdown. Saves immediately.
  const learnedNames = new Set([
    ...Object.keys(learned),
    ...Object.keys(learnedColors),
    ...Object.keys(learnedMeasures),
    ...Object.keys(learnedSizes),
  ]);

  function forgetLearned(name: string) {
    const omit = <T,>(m: Record<string, T>) => {
      const next = { ...m };
      delete next[name];
      return next;
    };
    const nc = omit(learned);
    const ncol = omit(learnedColors);
    const nm = omit(learnedMeasures);
    const nsz = omit(learnedSizes);
    setLearned(nc);
    setLearnedColors(ncol);
    setLearnedMeasures(nm);
    setLearnedSizes(nsz);
    saveCategoryRules(nc);
    saveColorRules(ncol);
    saveMeasureRules(nm);
    saveSizeRules(nsz);
  }

  // Learned rules layered over the seed dictionary (learned wins).
  const rules = mergedRules(learned);

  function commitLayout(next: KitchenLayout) {
    setLayout(next);
    saveLayout(next);
  }

  // Draft edits live in memory only — nothing is written until Save.
  function editDraft(next: Inventory) {
    setDraft(next);
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline) || sortDirty;

  function handleSave() {
    // Categorize, then apply the chosen sort — order only changes on save.
    const sorted = sortInventory(autoCategorize(draft, rules), sortBy);
    const nextCats = mergeCategories(categories, categoriesInUse(sorted));
    // Teach the dictionaries from every item (overwrites prior mappings).
    const nextLearned = learnRules(sorted, learned);
    const nextColors = learnColors(sorted, learnedColors);
    const nextMeasures = learnMeasures(sorted, learnedMeasures);
    const nextSizes = learnSizes(sorted, learnedSizes);
    saveInventory(sorted);
    saveCategories(nextCats);
    saveCategoryRules(nextLearned);
    saveColorRules(nextColors);
    saveMeasureRules(nextMeasures);
    saveSizeRules(nextSizes);
    setBaseline(sorted);
    setDraft(sorted);
    setCategories(nextCats);
    setLearned(nextLearned);
    setLearnedColors(nextColors);
    setLearnedMeasures(nextMeasures);
    setLearnedSizes(nextSizes);
    setSortDirty(false);
  }

  function handleDiscard() {
    setDraft(baseline);
    setSortDirty(false);
  }

  // Nothing to stock until there's storage — drop straight into the layout editor.
  if (layout.units.length === 0) {
    return <LayoutEditor layout={layout} onChange={commitLayout} />;
  }

  return (
    <div>
      <div className="chips" style={{ marginBottom: 12 }}>
        <button
          className={`chip ${mode === "stock" ? "chip--on" : ""}`}
          onClick={() => setMode("stock")}
        >
          Stock
        </button>
        <button
          className={`chip ${mode === "layout" ? "chip--on" : ""}`}
          onClick={() => setMode("layout")}
        >
          Edit layout
        </button>
      </div>

      {mode === "layout" ? (
        <LayoutEditor layout={layout} onChange={commitLayout} />
      ) : (
        <>
          {dirty && (
            <div className="k-savebar">
              <span className="sm">Unsaved changes</span>
              <span style={{ display: "flex", gap: 8 }}>
                <button className="button button--small" onClick={handleDiscard}>
                  Discard
                </button>
                <button className="button button--primary button--small" onClick={handleSave}>
                  Save &amp; categorize
                </button>
              </span>
            </div>
          )}
          <StockView
            layout={layout}
            inventory={draft}
            categories={categories}
            rules={rules}
            sortBy={sortBy}
            onSortChange={changeSort}
            learnedNames={learnedNames}
            onForget={forgetLearned}
            onAdd={(shelfId, input) => {
              // Auto-apply what we've learned about this item's name.
              const color = colorForName(input.name, learnedColors);
              const measure = measureForName(input.name, learnedMeasures);
              const size = sizeForName(input.name, learnedSizes);
              editDraft(
                addItem(draft, shelfId, {
                  ...input,
                  ...(color ? { color } : {}),
                  ...(measure === "count" ? { measure } : {}),
                  ...(size ? { size } : {}),
                }),
              );
            }}
            onSetQuantity={(id, q: QuantityState) => editDraft(setQuantity(draft, id, q))}
            onRename={(id, name) => editDraft(renameItem(draft, id, name))}
            onSetExpiry={(id, e) => editDraft(setExpiry(draft, id, e))}
            onSetCategory={(id, c) => editDraft(setCategory(draft, id, c))}
            onSetColor={(id, c) => editDraft(setColor(draft, id, c))}
            onSetMeasure={(id, m) => editDraft(setMeasure(draft, id, m))}
            onSetCount={(id, n) => editDraft(setCount(draft, id, n))}
            onSetSize={(id, s) => editDraft(setSize(draft, id, s))}
            onRemove={(id) => editDraft(removeItem(draft, id))}
          />
        </>
      )}
    </div>
  );
}
