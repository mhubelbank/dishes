// Does an inventory item satisfy a recipe ingredient? This is the one canonical
// "name A and name B refer to the same food" question — the suggester uses it to
// count on-hand ingredients, and the cook log uses it to deduct what was used.
// Kept here (pure, framework-free) so both key off identical matching rules.
import {
  removeItem,
  setQuantity,
  type Inventory,
  type InventoryItem,
  type QuantityState,
} from "./inventory";
import { normalizeName } from "./normalize";
import type { RecipeIngredient } from "./recipes";

// Singular/plural + last-word variants so "tomatoes" matches "tomato" and
// "cherry tomatoes" matches "tomatoes".
function variants(name: string): string[] {
  const n = normalizeName(name);
  if (!n) return [];
  const out = [n];
  if (n.endsWith("s")) out.push(n.slice(0, -1));
  const words = n.split(" ");
  const last = words[words.length - 1];
  if (last && last !== n) {
    out.push(last);
    if (last.endsWith("s")) out.push(last.slice(0, -1));
  }
  return [...new Set(out.filter(Boolean))];
}

export function namesMatch(a: string, b: string): boolean {
  const av = variants(a);
  const bv = variants(b);
  return av.some((left) =>
    bv.some(
      (right) =>
        left === right ||
        (left.length >= 4 && right.includes(left)) ||
        (right.length >= 4 && left.includes(right)),
    ),
  );
}

export function matchingInventory(ingredient: string, items: InventoryItem[]): InventoryItem[] {
  return items.filter((item) => namesMatch(ingredient, item.name));
}

// One coarse step down: full → half → low → gone (removed). Inventory is
// deliberately four-state (§6.3), so we don't subtract precise amounts.
const STEP_DOWN: Record<QuantityState, QuantityState | null> = {
  full: "half",
  half: "low",
  low: null,
};

const QUANTITY_RANK: Record<QuantityState, number> = { low: 0, half: 1, full: 2 };

// Deduct what a cooked recipe used (§6.3a / §7.9 side effect). Conservative and
// coarse: for each ingredient on hand, step down a single matching item by one
// level, finishing the most-open one first (low before half before full). A "low"
// item is used up and removed. Items the recipe doesn't name are untouched.
export function deductForRecipe(inv: Inventory, ingredients: RecipeIngredient[]): Inventory {
  let next = inv;
  for (const ingredient of ingredients) {
    const matches = matchingInventory(ingredient.name, next.items).sort(
      (a, b) => QUANTITY_RANK[a.quantity] - QUANTITY_RANK[b.quantity],
    );
    const target = matches[0];
    if (!target) continue;
    const stepped = STEP_DOWN[target.quantity];
    next = stepped ? setQuantity(next, target.id, stepped) : removeItem(next, target.id);
  }
  return next;
}
