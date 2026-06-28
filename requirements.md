# Personal cooking app — consolidated requirements

Version 3 — consolidates the original project brief, the garden page addendum, and all design-review revisions. This document supersedes both source briefs.

---

## 1. Purpose and philosophy (normative)

A personal-use cooking app for one household (two people). Not a product. No distribution, no scalability, no ToS-safe-integration, no generic-user constraints. Every decision optimizes for this specific household.

Primary pain points the app must solve:
1. Meal planning friction
2. Food waste (forgetting what's in the fridge; things expiring unused)
3. Decision fatigue at dinnertime

Secondary pain points the app nudges (mostly solved by habit): dishwasher load per meal (one-vessel default), cleanup burden.

Design priorities, in order:
- **Few decisions, simple defaults, batched effort.** The app makes decisions, it does not present option lists. The suggester shows 1–2 ideas, never 50.
- **Narrow choices, don't expand them.** No generic recipe discovery. The recipe corpus is only what the household deliberately imports.
- **Reduce friction around cooking, not perform the cooking.** No hands-free step-by-step voice guidance; it removes the small judgment calls that build instinct.
- **Honest uncertainty.** Inventory confidence, parse confidence, and data freshness are always visible. A confidently wrong inventory is worse than no inventory.
- **Quiet, attentive household member** aesthetic — not a product, not a dashboard. No streaks, no gamification, no engagement mechanics.
- **Optimize for two specific palates over time**, not generic correctness.
- **Repeating dishes is the path to mastery.** No variety push.

Anti-patterns to actively resist during implementation:
- The meal-slot model must not drift toward planning four meals a day. Dinner is the only slot that auto-fills. Empty slots are a normal state, never a nag.
- Nutrition targets must not become a tracking dashboard. They are per-meal filters, nothing more.
- The garden page must not grow plant-care features. See §8 scope fence.

## 2. Platforms and responsive strategy

- Target: web browser on desktop, mobile browser, and iPad mini browser. One responsive web app (no native apps).
- Mobile-first, single column at 390px — this is the only mocked breakpoint (see `mockups.html`).
- At ≥768px, promote to two columns: Today suggestions beside inventory summary; week slots beside shopping list; kitchen map beside shelf detail; recipe steps beside ingredients. No component changes, layout only.
- Served on the household LAN from the same machine that hosts SQLite. Installable as a PWA (manifest + service worker) so it gets a home-screen icon and receives HA deep links cleanly; offline support is nice-to-have, not required.

## 3. Architecture

- **Local-first.** SQLite is the single source of truth. One machine in the household. No cloud, no accounts.
- Suggested stack: small local web server (FastAPI/Flask/Node — implementer's choice) + responsive SPA or server-rendered pages. Keep it boring.
- Background jobs (cron or APScheduler-style):
  - Weekly: Walmart purchase-history scrape (Playwright, persistent session cookie; 2FA babysat manually).
  - Daily: garden camera snapshot → vision batch → `garden_observations`.
  - Daily: inventory shelf-life decay + confidence decay recompute.
  - On demand: receipt OCR; cookbook parse (batch); recipe URL fetch.
- Home Assistant is in the stack as the MQTT/REST bridge for Gardyn data (regardless of upstream path A/Kelby or B/garden-of-eden) and as the **only** notification delivery mechanism. The app publishes events; HA pushes; deep links return to app screens. The app runs no notification infrastructure of its own.
- Scraper failure degrades gracefully: every screen that depends on purchase data shows last-sync freshness ("Walmart synced 9 days ago — inventory may be stale") and the inventory model widens confidence accordingly. Never hide staleness.

## 4. Navigation

Four bottom tabs + a sheet layer (see flow diagram discussion; mocked in `mockups.html#shell`):

- **Today** — the home screen. Dinner suggester, day tabs, garden tile. Settings gear lives in this tab's header.
- **Plan** — rolling meal-slot timeline (week window) + run planner entry.
- **Kitchen** — three segments: Map (spatial fridge/freezer/pantry), Expiry (urgency-sorted list), Garden (the garden page, §8).
- **Recipes** — browser, recipe detail, import flow, "to make" bookmarks.

Sheets/modals open over any tab and return where the user was: done-cooking log, harvest confirmation, plant-a-yCube, run planner.

Deep links: HA harvest notification → Today with the relevant suggestion pre-selected (never the Garden page). HA pruning badge link → Kitchen › Garden.

## 5. Data sources and ingestion

1. **Walmart purchase history (~95% of grocery).** Personal Playwright/Puppeteer scraper, weekly cron, persistent session. Captures online/pickup/delivery orders AND in-store purchases on the linked card (Walmart backfills 12 months). Item-level: name, SKU, price, date, store. Writes to `purchases`.
2. **Receipt OCR fallback** for cash / non-linked-card trips: photo → vision model → structured JSON → `purchases`. Same vision integration as the garden pipeline.
3. **Garden data** (§8): the app reads a `garden_slots` + `garden_observations` pair populated by the ingestion script. The upstream path (stock Gardyn + HACS integration vs. garden-of-eden firmware + local vision) is an operations choice and must not leak into app logic. The app treats garden data as a black box table.
4. **Recipes:** URL paste → fetch + parse; cookbook PDF/EPUB upload → batch parse with mandatory confirmation flow; manual entry. All normalize to the unified recipe schema. **Build URL + manual first; cookbook batch parsing is its own sub-project** (highest effort, lowest reliability — the confirmation UI matters more than the parser).

## 6. Core concepts

### 6.1 Meal slots (replaces "weekly plan")
A `meal_slots` row = (date, meal_type, recipe, portions, status). Meal types and default windows (windows editable in settings):
- breakfast 5:00–11:00, lunch 11:00–15:00, dinner 15:00–23:00, late_night 23:00–5:00.
The current clock picks the active slot on Today; tabbing to a future day defaults to its dinner slot. Statuses: `empty`, `auto_fill` (planner buys flexible base ingredients, recipe chosen near the day), `planned`, `pinned` (user-fixed, e.g. Saturday paella ×6), `skipped`, `cooked`.

### 6.2 Grocery runs (flexible planning)
A run = user picks when they're shopping + a coverage horizon (e.g. "now through Sunday"). The app resolves: ingredients for all planned/pinned slots in the horizon + flexible base goods for auto_fill slots + staples whose purchase-cadence model says they're near rebuy − current inventory. Output: have/buy split → store router. Multiple overlapping runs are fine; they read the same timeline. Plan edits flow into the next run automatically.

### 6.3 Inventory with confidence
Derived from purchases − cook-log deductions − explicit user edits, decayed by per-category shelf lives. Every item carries:
- `quantity_state`: full / half / low / gone (coarse on purpose — one-second input; recipes needing amounts convert conservatively).
- `confidence`: certain / likely / maybe — decays with time since last confirmation; displayed honestly.
- `location`: a `kitchen_zones` reference (freezer **pauses** the expiry clock).
Correction loops: (a) cook log auto-deducts recipe quantities; (b) quick-audit prompts surface the 3–5 most uncertain items ("still have this?"); (c) kitchen map edits (§7.4). Shelf-life table is seeded static per category, tuned by corrections over time.

### 6.4 Leftovers
Created at cook-log time. Fridge leftovers: portion count + short eat-by clock; they become suggestion #0 on Today ("Tuesday's chili — best by tomorrow"). Freezer leftovers: no portion count required, no clock; they join the freezer-meals pool, surfaced primarily in tired mode ("thaw the chili"). Recipe schema carries `leftover_potential`.

### 6.5 Preference tiers (five)
1. **Allergy** — hard filter. This household: peanuts, tree nuts. Excluded from every suggestion surface; imports containing them (incl. "may contain") flagged.
2. **Never** — permanent dislike, strong negative weight (e.g. blue cheese).
3. **Not right now** — temporary dislike; negative obsession with the same decay machinery.
4. **Stable likes** — always-on positive (garlic, lemons, scallions).
5. **Obsessions ("currently into")** — transient, weighted (e.g. edamame ×1.8), stack, decay when removed; history log retained as a memory artifact. Auto-detect: item bought 4+× in 3 weeks → prompt "lean into X for a while?" with a "just stocking up" decline.

### 6.6 "Your time"
Cook log records `actual_active_min`. Once ≥1 log exists, every surface uses the household's median time, displayed as "Your time ~35 min"; the recipe's claimed time is demoted to a footnote. Per-source correction: if a source's recipes consistently run over (e.g. +60%), discount that source's claims everywhere, including uncooked recipes.

### 6.7 Energy levels (concrete definitions)
- tired: ≤20 min your-time active, one vessel, no new techniques; freezer meals rank first.
- normal: default weights.
- ambitious: new techniques welcome; never-made recipes get a boost.

### 6.8 Nutrition targets (fiber + protein)
Settings store weight and height (height captured for future use; V1 math uses weight only — say so in the UI). Personal daily values:
- protein: 0.8 g/kg body weight baseline, user-adjustable multiplier for activity (0.8–1.6 g/kg).
- fiber: 28 g default (FDA DV), user-editable.
Per-recipe protein/fiber grams per portion are **estimated once at import** by the batch LLM pass (±20%, always labeled "est."). Today-view quick-pref chips: "protein ≥ 25/50/75/100% DV" and same for fiber — selecting one filters/boosts recipes whose per-portion estimate clears that fraction of the personal DV. Recipe detail shows one quiet line ("~38 g protein / portion · 61% of your DV (est.)"). **No daily totals, no tracking dashboard, no streaks.**

## 7. Screens and features

Anchors reference `mockups.html`.

### 7.1 Today (`#shell`)
- Day tabs (today + next ~5 days, horizontally scrollable).
- Meal-type selector (icons B/L/D/late), defaulted from the clock per §6.1 windows.
- Portions stepper ("Cooking for 2", bump for guests — scales the chosen recipe and downstream list math).
- Quick prefs row 1 — genre/mood chips (Anything default; e.g. Noodles, Soup-y, Korean, Italian). One-shot bias: applies to this decision only, resets after.
- Quick prefs row 2 — energy (tired/normal/ambitious), one-vessel toggle, nutrition chips (§6.8).
- Leftovers banner = suggestion #0 when fridge leftovers exist.
- 1–2 suggestion cards, each with plain-language "why" chips (expiring item, garden-ready item, obsession ×weight, stable like, uses leftovers). A suggestion using a harvestable garden item must name it ("uses the basil that's ready in your garden").
- "Neither — ask me one question" escape hatch: asks exactly one clarifying question (LLM), then re-suggests. Never shows a longer list.
- Garden status tile ("3 ready · 2 ripening soon") → Kitchen › Garden.
- Footer: data freshness (Walmart sync age, garden sync age, items tracked).
- Settings gear in header.

### 7.2 Run planner (`#run-planner`, sheet)
Per §6.2: when-shopping chips (now / tomorrow / Saturday am), horizon chips (+2 days / through Sunday / +7), covered-slot list with per-slot have/need status, metric row (have / buy / staples-low counts), staples-riding-along line, "Build list & route it" → store router.

### 7.3 Plan tab (`#week`)
Vertical day rows (a window onto meal_slots). Each row: day label, per-day controls (regenerate ↻, skip ✕ with undo), slot pills — filled pills show the meal (+ portions badge when ≠ 2, e.g. "Paella · 6 portions"), empty B/L slots render as dashed add buttons, dinner auto_fill shows "auto-fills Sunday night". Pinned slots survive regeneration. Edits flow into the next run with no sync step.

### 7.4 Kitchen › Map (`#kitchen`)
Spatial map matching the household's actual storage. This household's layout (stored in `kitchen_zones`, editable in settings):
- Side-by-side unit. Freezer: 4 shelves. Fridge: 6 shelves, bottom-up = veg, meat, cheese/dairy, then 3 × general. Door: 5 shelves, top-down = butter, sauces ×3, drinks/wine.
- Pantry: 2 shelves — top baking (flour, sugar), bottom everything else (pasta, canned tomatoes).
- Produce basket (counter): potatoes, onions, garlic.
Per-shelf rows show item count + attention dots (amber ● expiring, hollow ○ uncertain). Tap shelf → detail with per-item four-state quantity chips (§6.3) — this is the primary "how much do I have left" input. New purchases auto-land on home shelves by category for a post-shop put-away confirm. The door sauce zone gets a periodic "door check" audit prompt (condiment graveyard). Primary use: 30-second glance audit.

### 7.5 Kitchen › Expiry (`#inventory`)
Urgency-sorted list: use-in-3-days, use-this-week, garden-ready section, stable (collapsed). Each item: location icon, days left, confidence. Quick-audit card (yes/gone) embedded. "Use it up" affordance: tap an expiring item → the one recipe that consumes the most of it.

### 7.6 Kitchen › Garden (`#garden`) — see §8.

### 7.7 Recipes › Browser (`#browser`)
Mood input ("What are you in the mood for?") → short LLM conversation against the household corpus only. Filter chips: meal type, your-time threshold, one vessel, mostly-on-hand, never-made, genre, nutrition. "To make" bookmark queue (bookmarks = soft suggester signal; a bookmark can be pinned to a slot with portions). Result rows show your-time, cooked count, last note snippet. Footer states the corpus boundary: "Browsing your N recipes — nothing from the internet unless you import it."

### 7.8 Recipes › Detail (`#recipe`)
Tags (vessel, cleanup score, your-time, cooked ×N, meal types, genre). Nutrition line (§6.8). Past-notes card (serif — personal-memory material). Ingredients checked against live inventory (have / on-this-week's-list / missing). Steps each carry an "ask why" affordance → LLM with full recipe context, answer cached forever per (recipe, step). Timers, where present, default 5 minutes short of the recipe's claim to encourage sense-checking. "Done cooking" → §7.9.

### 7.9 Done cooking (`#cooklog`, sheet)
- Actual time: one-tap chips anchored to history ("About right (20)", "~35", "~50", "Way off — enter"). Updates your-time (§6.6).
- Leftovers: None / Fridge / Freezer. Fridge → portion stepper + auto eat-by; Freezer → no count (§6.4).
- One-line note (free text; becomes past-notes material).
- Per-person reaction (two palates): self + partner each get loved / fine / meh — three taps max, optional.
- Save side effects are stated on the button's helper line: deduct ingredients, create leftover, update your-time.

### 7.10 Currently into (`#into`, reached from Today header or Recipes)
Active obsessions with weights and since-dates; fading entries; auto-detect prompt; always-on tier chips; past-obsessions history (serif, reverse-chron: "Jan 2026 — anchovies").

### 7.11 Import (`#import`)
Upload PDF/EPUB or paste URL. Parse summary (N found, M clean, K need review). Per-recipe confirmation rows with auto-tags (vessel, cleanup, time, genre, meal types, allergen flags, nutrition est.) and parse confidence; low-confidence rows get side-by-side review before save. Nothing saves without confirmation.

### 7.12 Settings (`#settings`)
Home address (router drive-time math). Stores: ranked defaults (1 Walmart Richmond Rd, 2 Trader Joe's, 3 Kroger) + specialty entries with tags (HMart · Asian; Costco · bulk; farmers market · Sat produce). Allergies (hard). Not-into lists (always / right now). Meal windows. Body metrics + nutrition DV settings (§6.8). Kitchen zone layout editor (§7.4). Data freshness / scraper status.

### 7.13 Store router (reached from run planner)
Input: number of stops willing (1/2/3). Output: one recommended route (drive-time estimated from address) with per-store item assignment and reasons, plus a one-stop fallback showing coverage and substitutions. Ambient modes: Costco mode only when bulk thresholds hit; farmers-market mode only Saturday mornings with in-season items. Obsession detour: when an active obsession maps to a store that does it notably better, proactively suggest the detour while the obsession is active. Per-store catalogs (`stores`) learn from successful purchases.

## 8. Garden feature (addendum, folded in)

Context: household owns a Gardyn, no Kelby membership, no stock app for ongoing management. The cooking app absorbs the **minimum** garden surfaces needed to be the household's primary kitchen interface — no more.

**Scope fence (hard):** no plant-care guides, no troubleshooting flows, no yCube ordering, no time-lapses, no growth charts, no sensor dashboards, no tank refill/cleaning reminders. Device care = Home Assistant automations notifying the phone directly.

Five interactions, all on one Garden page (Kitchen › Garden):
1. **What's growing — list view.** All slots (12–16): slot number, variety (yCube catalog ~120, every variety maps to a known ingredient), date planted, status (growing / nearing ready / ready / needs pruning / harvested / empty), small latest camera thumbnail. Sort/filter is nice-to-have only.
2. **Harvest-ready notifications.** Daily vision cadence; on flip to "ready", publish event → HA push. **Notification copy translates the garden event into a cooking decision** ("Basil is ready — want a caprese tonight? You have mozzarella from Tuesday."), never device-speak ("Slot 4 status changed: ready"). Deep link → Today with the suggestion pre-selected, not the Garden page.
3. **Pruning notifications.** Same pipeline, different prompt (overgrowth, encroaching neighbors, anything visually concerning). Lower priority: badge on the Garden page, not push — unless urgent.
4. **Plant a new yCube.** <15 seconds: tap a slot on a visual device diagram, pick variety (searchable catalog, recents on top), auto-stamped date. Optional voice command ("planted basil in slot 4"). This per-slot context is what makes the vision pipeline accurate.
5. **Harvest confirmation.** The garden→kitchen handoff, the most important moment in the feature. On confirm: slot → empty; harvested item enters inventory with a category freshness clock (fresh cilantro: 5 days) on its home shelf; immediately available to the suggester; vision pipeline pauses for that slot until replanted.

Home-screen integration (primary surface): harvestable items get strong suggester weight; ripening-soon (≤2 days) medium weight; suggestions name the garden item explicitly; garden tile shows counts. Most days the user never opens the Garden page.

Data flow: daily camera snapshots → vision model with per-slot planting context → structured output (growth stage, readiness, pruning flags) → SQLite (`garden_observations` → `garden_slots` current state) → suggester / Garden page / HA events. Same vision integration as receipt OCR — one integration, two purposes.

## 9. Suggester scoring (deterministic — no LLM)

Score each candidate recipe for the active slot; return the top 1–2 with explainable reasons. Sketch (weights are starting points, tune live):

```
score = 0
+ 3.0 × Σ expiring-item usage (scaled by days-left: ≤3d strong, ≤7d medium)
+ 2.5 × garden-ready item usage (named in reason); +1.2 if ripening ≤2d
+ obsession weights (e.g. ×1.8 → +1.8 per matching ingredient; fading entries pro-rated)
+ 1.0 × stable-like matches
+ 1.5 × leftover-consuming bonus (uses an existing leftover as a component)
+ 1.0 × bookmark ("to make") bonus
+ mood-chip genre match bonus (one-shot)
+ nutrition chip: hard filter at the selected %DV threshold
+ repeat affinity: cooked-before with positive reactions ranks above never-made,
  except in ambitious mode (never-made boost)
− never-tier penalty (large), not-right-now penalty (decaying)
− cleanup penalty when one-vessel mode on (hard filter) or score > threshold
− your-time over energy-level cap: hard filter in tired mode
allergy match: hard exclusion, always
inventory feasibility: ≥80% of ingredients on hand (by quantity_state) or in
  the current run's buy list; otherwise exclude from "tonight", allow in planning
Fridge leftovers needing eating render as suggestion #0 above scored results.
```

Reasons shown to the user are the top contributing terms, in plain language. Ties beyond the top 2 are discarded, not shown.

## 10. Notifications (via Home Assistant)

Event types the app publishes: harvest_ready (push, deep link → Today), pruning_flag (badge; push only if urgent), expiring_soon digest (optional, max 1/day, quiet hours respected), audit nudges (in-app only, never push). Copy rules: cooking-voice, decision-shaped, names the food not the device. The app never sends its own pushes.

## 11. LLM usage and cost policy

Governing rule: **the LLM only touches language-shaped problems, never the hot path.** Suggester, planner, router, inventory math = deterministic SQL/code, zero API calls per dinner decision.

- **Batch + cheap model (Haiku-class), via the Batch API (50% discount):** cookbook parsing; auto-tagging (vessel, cleanup, time, genre, meal types, allergen flags, protein/fiber estimates) — computed once at import, stored, never re-derived; receipt OCR.
- **Garden vision:** one batched call per day containing all slot images + per-slot context in a single request, cheap model; escalate only slots the cheap model marks ambiguous.
- **"Why" answers:** on-demand, cheapest capable model, cached forever keyed by (recipe_id, step, question-normalized) in `why_cache`. Each question costs money once, ever. Use prompt caching on recipe context for multi-why sessions.
- **Interactive (rare, short, mid-tier model):** browser mood conversation; the "neither — ask one question" path; notification copywriting (one short call per garden event, also cacheable by template).
- Expected steady-state cost: pennies per month after initial cookbook imports.
- All calls go through one thin client module with: model selection per task type, batch queueing, response caching, and a monthly spend log surfaced in settings.

## 12. Non-features (intentional, permanent unless revisited by the household)

- Hands-free voice step-by-step guidance
- Generic recipe discovery from random sources
- Variety push
- Auto-timers replacing looking/smelling (timers default 5 min short)
- Social / sharing / community / accounts / multi-user
- Calorie tracking, daily nutrition totals, streaks
- Garden scope-fence items (§8)

## 13. Deferred (interesting, not V1)

Skill-of-the-week technique threading; two-person async cooking handoff; aisle-sorted list for the local Walmart layout; price tracking / "what's cheap this week"; honest recipe scaler (1.5-eggs and wrong-pan-size problems).

## 14. Build order

1. One-vessel household default (real-life decision; defines "low cleanup").
2. Walmart scraper + SQLite + inventory estimation with confidence + freshness display.
3. Recipe import: URL + manual first; batch tagging pipeline; cookbook parsing as a follow-on sub-project.
4. Tonight's dinner suggester (deterministic) + done-cooking log + leftovers + your-time. ← first user-facing payoff
5. Meal slots + Plan tab + flexible run planner.
6. Currently-into + auto-detection + preference tiers + nutrition targets.
7. Kitchen map + quantity states + audit loops.
8. Store router (only if multi-store shopping is actually happening).
9. Garden feature (after device acquired and upstream path chosen; app-side work identical either way).
10. Recipe browser mood conversation; "why" feature polish.

## 15. Open questions for the household (fine to stub)

- Exact freezer shelf semantics (4 shelves: meals / meat / veg / odds-and-ends assumed in mocks — confirm).
- Protein multiplier default (0.8 vs 1.2 g/kg) per person; whether targets differ between the two of you (V1 assumes shared targets).
- Whether the expiring-soon push digest is wanted at all, and quiet hours.
- PWA offline scope (read-only inventory offline?).
- Voice input for plant-a-yCube: HA voice pipeline vs. browser speech API (stub behind a flag).
