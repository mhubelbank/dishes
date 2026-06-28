# domain/

Pure, framework-free logic — unit-tested, no React, no I/O. This is where the
spec's deterministic machinery lives, kept testable in isolation from the UI and
the data client:

- **Inventory derivation** — materialize current inventory from source facts
  (`purchases`, `cook-log`, harvests, user overrides), apply shelf-life +
  confidence decay as a pure function of elapsed time (data-model.md derivations).
- **Suggester scoring** — score the corpus for the active slot and return the top
  1–2 with explainable reasons (requirements §9). No LLM, no I/O.
- **Grocery-run resolution** — resolve covered slots + cadence staples − inventory
  into a have/buy split (requirements §6.2).
- **Types** — the shared shapes for recipes, slots, inventory, preferences, etc.

The data layer (a `DataClient` from `clients/`) loads JSON in and saves JSON out;
`domain/` never touches the network. That keeps the whole core trivially testable
with `vitest`.
