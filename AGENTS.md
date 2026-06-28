# AGENTS.md

Guidance for AI coding agents working in this repo. This is the canonical guide.
Claude Code reads `CLAUDE.md` (which points here); OpenAI Codex / ChatGPT and most
other agent tools read **this** file. Keep them in sync — put real content here.

## What this is

A personal-use cooking app for one two-person household — **not a product** (no
distribution, no generic-user constraints). A browser-only React SPA hosted on
Cloudflare, with data persisted to a private GitHub repo (git-as-DB). See
`architecture.md` for the hosting model and `requirements.md` for the full spec.

## Source of truth & precedence

The spec lives at the repo root. If documents conflict:
`requirements.md` > `data-model.md` > `mockups.html`. `architecture.md` records the
Cloudflare / git-as-DB deployment (which supersedes the spec's original "single LAN
machine" idea). The **philosophy in requirements §1 is normative** — features that
fight it are wrong even if they match a mockup pixel-for-pixel.

## Layout

```
/ (repo root)     spec + design docs: requirements.md, data-model.md, mockups.html,
                  architecture.md, README.md
app/              the Vite + React + TypeScript SPA — ALL code lives here
  src/domain/     pure, framework-free logic — unit-tested, no React, no I/O
  src/clients/    I/O + persistence (localStorage today; GitHub DataClient later)
  src/components/ React components (components/kitchen/ holds the Kitchen UI)
  src/pages/      top-level tab pages: Today, Plan, Kitchen, Recipes, Settings
  src/styles/     tokens.css (design tokens), reset.css, components.css
  scripts/        Node/TS tooling run with tsx (NOT in the app build — tsconfig
                  includes only src/). import-epub/ parses cookbook EPUBs.
```

**Cookbook importer** (`app/scripts/import-epub/`, `npm run import:epub`): parses the
Milk Street EPUBs in `../dishes-data/cookbooks/` into the Recipe model and writes
`../dishes-data/data/recipes/milk-street.json` (recipe text stays out of this repo).
Deterministic per-book selector profiles + heuristic ingredient/allergen/cuisine
inference — the batch-LLM pass and the other 5 books are not built yet. Load a corpus
into the app via **Settings → Import recipes** (file picker → `mergeRecipeBooks`).

The scaffold and the `DataClient`/`GitHubClient` were ported from a sibling project
(`../emily-sesis`); follow its conventions when extending that layer.

## Working in this repo

- **Run everything from `app/`** — the npm package is there, not the repo root. The
  shell cwd can reset between commands, so `cd app` first every time.
- Commands: `npm run dev` (localhost:5173) · `npm run typecheck` · `npm test`
  (vitest) · `npm run build` (`tsc --noEmit && vite build`).
- **Definition of done: `npm run typecheck && npm test && npm run build` all pass.**
  Run them before claiming a change works.

## Conventions

- **TypeScript strict** (`noUnusedLocals`, `noUnusedParameters`,
  `noUncheckedIndexedAccess`, …). No unused imports/locals; guard index access.
- **`domain/` is pure and tested.** Business logic goes here as pure functions with
  immutable updates (return new objects), each with a `*.test.ts`. `domain/` must
  **not** import from `clients/` or `components/`. Shared name normalization lives in
  `domain/normalize.ts` so rules/lookups key on the same canonical form.
- **`clients/` does I/O** — thin persistence wrappers (localStorage now; the GitHub
  `DataClient` later). UI never talks to storage directly except through these.
- **Styling** uses semantic CSS tokens from `styles/tokens.css` (light/dark aware).
  Add classes to `components.css`; avoid ad-hoc hex. Serif (`--font-serif`) is
  reserved for personal-memory material (cook notes, past obsessions) per the mocks.
- **Keep pages compact.** Prefer screens that fit without scrolling on the target
  viewport. Keep copy concise, make primary controls immediately visible, and put
  secondary or advanced material in collapsible sections where that preserves the
  main flow.
- IDs: `crypto.randomUUID()` (a fallback helper exists). `Date.now()` / `Math.random()`
  are fine in app/test code.

## Patterns to preserve

- **In-memory draft, persist on Save.** The Kitchen → Stock view edits an in-memory
  draft; *nothing* is written to storage until the user hits Save (then it also
  auto-categorizes, sorts, and teaches the dictionaries). Don't reintroduce
  continuous autosave.
- **Learned dictionaries.** On Save, the app teaches itself per item *name* →
  category, color, measure mode, and size — each in its own `clients/*RulesStore.ts`,
  layered over the seed rules. New items auto-apply what's learned; entries are
  forgettable via the **×** in the autocomplete dropdown. Mirror this for any new
  learned attribute (store + `learnX`/`xForName` in domain + wire in `KitchenMap`).
- **Coarse by design (§6.3).** Inventory amount-left is full/½/low (level) or a
  count — deliberately coarse, one-second input. **Size** (number + unit) is a
  separate, independent descriptor. Resist a precise units/conversion engine — the
  "honest recipe scaler" is explicitly deferred (§13).
- **Allergy is a hard filter** (peanuts, tree nuts), never a soft preference.
  Manual recipes are household-trusted by default; batch/uploaded/imported recipes
  must be reviewed before save, and flagged imported recipes are excluded from every
  suggestion surface.

## Not yet built — don't assume these exist

Real persistence to the `dishes-data` GitHub repo (still localStorage; `clients/
github.ts` is ported but unwired), the Settings connection flow, the dinner
suggester beyond Today V1, generated planning / grocery runs, the LLM/Anthropic
integration, the garden feature, and notifications. Built so far: the Kitchen tab
(Map layout editor + Stock + Expiry)
and Recipes V1 (localStorage household corpus, seed recipes, searchable browser,
detail sheet, manual recipe add/edit/remove, to-make bookmarks, nutrition metadata;
allergen flags remain in the recipe model for future import/suggester hard filtering
but are not part of manual entry; add/edit is full-width, not side-by-side with
another recipe preview) and Today V1 (compact deterministic meal suggestions
from local recipes + inventory, time-based meal chips, energy chips, one-vessel
filter, reason chips, planned-slot primary card, tappable recipe detail sheet,
and the full done-cooking loop — see below).
Today defaults to meal windows: breakfast 5–11am, lunch 11am–4pm, dinner 4–11pm,
late night snack 11pm–5am.
- Done-cooking loop V1 (§7.9 / §6.4 / §6.6): the "Cooked it" button (planned card
  + recipe detail) opens `components/CookLogSheet.tsx` — actual-time chips anchored
  to the claim, leftovers None/Fridge/Freezer (fridge → portions stepper + 3-day
  eat-by), one-line note, two-palate reactions. On Save it bumps the cooked count +
  note, logs the cook (`domain/cookLog.ts` → median "your time"), creates a leftover
  (`domain/leftovers.ts`), **deducts inventory** (`domain/ingredientMatch.ts`
  `deductForRecipe` — coarse one-level step-down, finish-the-open-one-first), and
  marks a matching planned slot cooked. Fridge leftovers render as **suggestion #0**
  (a Today banner with "Ate it"); your-time replaces the claimed minutes on Today
  cards + the detail sheet once a recipe has been cooked. Reactions are stored as
  memory but not yet weighted by the suggester (that arrives with preference tiers).
  Stores: `clients/cookLogStore.ts`, `clients/leftoversStore.ts`. Ingredient
  name-matching now lives in `domain/ingredientMatch.ts` (shared by the suggester
  and the deduction).
- Plan V1 is localStorage-backed durable scaffolding for `meal-slots.json`: pure
  `domain/mealPlan.ts`, `clients/mealSlotsStore.ts`, next-7-day meal-slot view,
  direct slot assignment/clearing, `Plan it` from recipe detail sheets, and Today
  reflecting the selected meal's planned slot. It is manual assignment only;
  generated planning, grocery runs, and routing are not built.

## House rules

- Keep changes minimal and match the surrounding style; prefer editing existing files
  over adding new ones.
- Don't commit or push unless asked.
