// Procedure steps scraped from the cookbook EPUBs (npm run import:steps), keyed by
// normalized title and bundled via glob. Decoupled from the recipe corpus, same as
// recipeImages — a checkout without the generated file just shows no instructions.
import { normalizeName } from "../domain/normalize";

const bundled = import.meta.glob("../data/recipeSteps.json", { eager: true });

function stepsMap(): Record<string, string[]> {
  const mod = Object.values(bundled)[0] as { default?: Record<string, string[]> } | undefined;
  return mod?.default ?? {};
}

const MAP = stepsMap();

export function recipeSteps(title: string): string[] | undefined {
  return MAP[normalizeName(title)];
}
