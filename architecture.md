# Architecture — Cloudflare deployment

How this app's spec maps onto Cloudflare. The data model, suggester, and cost
policy are unchanged; this only describes *where the bytes live and run*.

This follows the **`emily-sesis` / "carryover"** precedent (`../emily-sesis`): a
browser-only React SPA on Cloudflare static assets, gated by Cloudflare Access,
persisting to a **private GitHub data repo via the GitHub API** (`git-as-DB`),
with bring-your-own API keys in `localStorage`. No Worker backend, no database
server. It answers the original question — *is GitHub repo writes sufficient as a
DB?* — with a working **yes, at this scale**.

## Why git-as-DB is enough here (revised from the earlier D1 plan)

The general case against git-as-DB (write latency, API rate limits, no query
engine) assumes a large or concurrent dataset. This household's data is tiny —
~112 recipes, ~31 inventory items, a weekly Walmart batch, a handful of meal
slots. The whole corpus loads into memory; the deterministic suggester
(`requirements.md` §9) is a JS scoring loop over a few hundred objects, not a
query-planner's job. Human-paced saves are fine as one commit each, and two
users with path-disjoint writes plus last-write-wins (the precedent's
`GitHubClient` already does sha-retry) don't contend in practice.

D1 stays the documented upgrade path — carryover names it as theirs too — to
adopt if the corpus or write rate ever outgrows this.

## Topology

```
                          ┌──────────────────────────────┐
   Browser / PWA  ◄──────►│  Cloudflare static SPA        │
   phone · iPad ·         │  (Vite + React, no backend)   │
   desktop                │  deterministic suggester (JS) │
        ▲                 │  inventory derive + decay (JS)│
        │ Cloudflare      └───────┬───────────────┬───────┘
        │ Access (SSO)           │               │
        │              GitHub API│      Anthropic API (BYO key)
        │              (BYO PAT) │      auto-tag · OCR · "why" · mood
        │                        ▼
        │            private  dishes-data  repo  ◄── weekly ── Walmart scraper
        │            (JSON files = the database)             (Playwright, off-Cloudflare)
        │
   Home Assistant .............. future extension (notifications) — not built now
```

## Two repos (mirrors carryover's split)

```
dishes  (public, this repo)              dishes-data  (private)
└── app/   Vite + React + TS             └── data/   read/written at runtime
    ├── domain/   suggester, inventory        ├── recipes/<id>.json
    │             derivation, decay (pure)     ├── purchases/<yyyy-mm>.json   ← scraper writes
    ├── clients/  GitHubClient (DataClient),   ├── cook-log/<yyyy-mm>.json
    │             Anthropic, localStorage      ├── meal-slots.json
    └── pages/    Today, Plan, Kitchen, …      ├── preferences.json, bookmarks.json
                                               ├── inventory-edits.json   ← user overrides
                                               ├── stores.json, kitchen-zones.json, settings.json
                                               ├── seeds/ shelf-life.json, ycube-catalog.json
                                               ├── garden/ slots.json, observations/  (future)
                                               └── why-cache.json, llm-spend.json
```

Reuse the precedent's `DataClient` interface verbatim: `GitHubClient` in prod,
`LocalFsClient` (localStorage) for a demo/sandbox mode — the whole load/save
layer works against either unchanged.

## Derived inventory (no backend needed)

`inventory_items` is *materialized*, not stored (`data-model.md`). The data repo
holds the **source facts** — `purchases/`, `cook-log/`, garden harvests, and
`inventory-edits.json` (user quantity/confidence overrides, which always win).
The browser derives current inventory on load and applies shelf-life +
confidence decay as a **pure function of elapsed time** since `last_confirmed_at`.
No nightly cron, no recompute job — decay is computed lazily whenever the app
opens, and widens when the last Walmart sync is stale.

## Walmart ingestion (P0)

Walmart is ~95% of grocery (`requirements.md` §5) and is first-class. It can't run
in a browser *or* on a static SPA — it needs Playwright, a persistent session,
and occasional babysat 2FA. So the scraper is a separate long-lived process, and
in this model it writes the **same way the app does**: it commits
`data/purchases/<yyyy-mm>.json` to the `dishes-data` repo via the GitHub API.

- **Idempotency.** Each purchase line carries a stable `externalRef` (order-line
  id or hash). The scraper merges into the month file by `externalRef`, so the
  12-month backfill re-seen every week is a no-op for known lines.
- **One write path.** No ingestion endpoint to build — the scraper uses a
  repo-scoped PAT, same `GitHubClient` contract as everything else.
- **Where it runs.** Prefer an always-on home box or small VPS so a 2FA challenge
  can be cleared in the moment. A scheduled GitHub Action works most weeks (persist
  the encrypted session as a secret) but is non-interactive — a 2FA prompt there
  fails the run until you refresh the session locally.
- **Degradation.** The app reads the newest `purchases/` file's date as last-sync
  freshness and widens inventory confidence when stale (`requirements.md` §3) —
  honest, never hidden.

## LLM (language-shaped only, browser-side, BYO key)

Same as carryover: the Anthropic key lives in `localStorage`, calls go straight
from the browser through one thin client module (`requirements.md` §11). Batch API
for import-time auto-tagging / receipt OCR / garden vision; on-demand cheap model
for "why" answers, cached forever in `why-cache.json`. Monthly spend tallied to
`llm-spend.json` and surfaced in Settings. Never on the dinner-decision hot path.

## Privacy & auth

- **Private data repo** — household data is invisible without a repo-scoped token.
- **Cloudflare Access** — the app URL is gated to allowlisted emails at the edge.
- **BYO keys in `localStorage`** — no server exists to exfiltrate them from; use a
  spend-capped Anthropic key.

## Deltas from the carryover precedent

1. **Second writer.** App *and* the weekly scraper both write the data repo. They
   touch disjoint paths (`purchases/` vs. everything else); `GitHubClient`'s
   sha-retry handles the rare overlap.
2. **Binary blobs, later.** Garden thumbnails and receipt photos don't belong in
   git. They're a future/garden concern — add an **R2** bucket just for images
   then, keeping structured data in the repo. Not needed for V1.
3. **Derived state + decay** — more computation than carryover's document model,
   but all pure functions over small data, client-side (above).

## Setup

```bash
# scaffold the SPA under app/, mirroring ../emily-sesis/app
cd app
npm install
npm run dev            # http://localhost:5173
npm run build          # tsc --noEmit && vite build
npm run deploy         # wrangler deploy (static assets)
# then: create the private dishes-data repo; add a Cloudflare Access policy for
# the household emails on the app hostname (+ preview URLs).
```
