// Shared item-name normalization so category rules, learned color rules, and
// lookups all key on the same canonical form (lowercase, punctuation-stripped,
// single-spaced).
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ");
}
