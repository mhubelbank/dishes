// Recipe photos scraped from the cookbook EPUBs (npm run import:images). The map is
// keyed by normalized title and bundled via glob so a fresh checkout without the
// generated file just renders no images. Decoupled from the recipe corpus on
// purpose — the scraper and the LLM enrichment write different files.
import { normalizeName } from "../domain/normalize";

const bundled = import.meta.glob("../data/recipeImages.json", { eager: true });

function imageMap(): Record<string, string> {
  const mod = Object.values(bundled)[0] as { default?: Record<string, string> } | undefined;
  return mod?.default ?? {};
}

const MAP = imageMap();

export function recipeImageUrl(title: string): string | undefined {
  return MAP[normalizeName(title)];
}
