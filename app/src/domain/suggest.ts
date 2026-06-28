// Item-name autocomplete. Ranks: (0) whole-string prefix, (1) any word starts
// with the query, (2) substring anywhere — shorter names first within a rank.
// e.g. "chili" → ["chili", "chili pepper", "sweet chili sauce"].
export function suggestItems(query: string, vocab: string[], limit = 8): string[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const seen = new Set<string>();
  const scored: { item: string; rank: number }[] = [];

  for (const item of vocab) {
    const name = item.toLowerCase();
    if (seen.has(name)) continue;
    let rank = -1;
    if (name.startsWith(q)) rank = 0;
    else if (name.split(/\s+/).some((w) => w.startsWith(q))) rank = 1;
    else if (name.includes(q)) rank = 2;
    if (rank >= 0) {
      seen.add(name);
      scored.push({ item, rank });
    }
  }

  scored.sort(
    (a, b) => a.rank - b.rank || a.item.length - b.item.length || a.item.localeCompare(b.item),
  );
  return scored.slice(0, limit).map((s) => s.item);
}
