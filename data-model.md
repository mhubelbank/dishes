# Data model — SQLite DDL sketch

Conventions: `id` = INTEGER PRIMARY KEY; timestamps TEXT ISO-8601; booleans INTEGER 0/1. This is a sketch — the implementer may tighten types and add indexes, but should preserve table boundaries and the meal-slot model. FKs are declared for documentation; enable `PRAGMA foreign_keys = ON`.

```sql
-- ---------- household configuration ----------

CREATE TABLE settings (
  key TEXT PRIMARY KEY,            -- 'home_address', 'weight_kg', 'height_cm',
  value TEXT NOT NULL              -- 'protein_g_per_kg' (default 0.8),
);                                 -- 'fiber_dv_g' (default 28),
                                   -- 'meal_window_breakfast' ('05:00-11:00'), etc.

CREATE TABLE stores (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,              -- 'Walmart — Richmond Rd'
  rank INTEGER,                    -- 1..N for ranked defaults; NULL for specialty
  specialty_tag TEXT,              -- 'asian', 'bulk', 'sat_produce'; NULL for defaults
  address TEXT,
  ambient_rule TEXT                -- JSON: e.g. {"day":"sat","window":"am"} or
);                                 -- {"bulk_thresholds":true}

CREATE TABLE store_catalog (       -- learned per-store reliability, from purchases
  store_id INTEGER REFERENCES stores(id),
  item_key TEXT,                   -- normalized item name
  times_bought INTEGER DEFAULT 0,
  last_bought TEXT,
  quality_note TEXT,               -- 'better & cheaper here' (drives obsession detours)
  PRIMARY KEY (store_id, item_key)
);

CREATE TABLE kitchen_zones (
  id INTEGER PRIMARY KEY,
  compartment TEXT NOT NULL,       -- 'freezer','fridge','fridge_door','pantry','counter'
  position INTEGER NOT NULL,       -- shelf index within compartment (1 = bottom for
                                   -- fridge per household convention; 1 = top for door)
  label TEXT NOT NULL,             -- 'veg', 'meat', 'cheese & dairy', 'butter',
  default_categories TEXT,         -- JSON list of item categories that auto-land here
  pauses_expiry INTEGER DEFAULT 0  -- 1 for freezer zones
);

-- ---------- purchases & inventory ----------

CREATE TABLE purchases (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,            -- 'walmart_scrape','receipt_ocr','manual'
  store_id INTEGER REFERENCES stores(id),
  item_name TEXT NOT NULL,
  item_key TEXT NOT NULL,          -- normalized
  sku TEXT,
  price_cents INTEGER,
  quantity REAL DEFAULT 1,
  purchased_at TEXT NOT NULL,
  ingested_at TEXT NOT NULL
);

CREATE TABLE shelf_life (          -- seeded static, tuned by corrections
  category TEXT PRIMARY KEY,       -- 'leafy_greens','dairy','condiment',...
  fridge_days INTEGER,
  pantry_days INTEGER,
  counter_days INTEGER             -- freezer pauses the clock (no column needed)
);

CREATE TABLE inventory_items (
  id INTEGER PRIMARY KEY,
  item_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  category TEXT REFERENCES shelf_life(category),
  zone_id INTEGER REFERENCES kitchen_zones(id),
  quantity_state TEXT NOT NULL DEFAULT 'full',  -- 'full','half','low','gone'
  source TEXT NOT NULL,            -- 'purchase','garden_harvest','leftover','manual'
  source_ref INTEGER,              -- purchases.id / garden_slots.id / cook_log.id
  acquired_at TEXT NOT NULL,
  expires_at TEXT,                 -- NULL when zone pauses expiry (freezer)
  confidence TEXT NOT NULL DEFAULT 'certain',   -- 'certain','likely','maybe'
  last_confirmed_at TEXT,          -- audit / map edits bump this
  is_leftover INTEGER DEFAULT 0,
  leftover_portions REAL,          -- NULL for freezer leftovers (count not tracked)
  is_staple INTEGER DEFAULT 0      -- participates in cadence-based rebuy
);

-- ---------- recipes ----------

CREATE TABLE recipes (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,            -- 'url','cookbook','manual'
  source_detail TEXT,              -- url or 'The Wok p.214'
  source_id TEXT,                  -- groups recipes by origin (per-source time bias)
  steps TEXT NOT NULL,             -- JSON array of step strings
  vessel TEXT,                     -- 'wok','skillet','instant_pot','sheet_pan',...
  vessel_count INTEGER DEFAULT 1,
  cleanup_score INTEGER,           -- 1 low .. 5 high (vessels, scrub, grease)
  claimed_active_min INTEGER,      -- what the source says
  claimed_total_min INTEGER,
  technique_tags TEXT,             -- JSON list
  meal_types TEXT NOT NULL DEFAULT '["dinner"]', -- JSON subset of the four types
  genre TEXT,                      -- 'korean','italian','noodles','soup',...
  base_servings INTEGER DEFAULT 2,
  leftover_potential INTEGER DEFAULT 0,
  protein_g_est REAL,              -- per portion, batch-LLM estimate (±20%)
  fiber_g_est REAL,
  allergen_flags TEXT,             -- JSON: ['peanut','tree_nut',...]; incl. may-contain
  parse_confidence TEXT,           -- 'high','review' (import flow)
  imported_at TEXT NOT NULL
);

CREATE TABLE recipe_ingredients (
  id INTEGER PRIMARY KEY,
  recipe_id INTEGER REFERENCES recipes(id),
  item_key TEXT NOT NULL,
  display_text TEXT NOT NULL,      -- '1 cup shelled edamame'
  quantity REAL,
  unit TEXT,
  optional INTEGER DEFAULT 0
);

CREATE TABLE bookmarks (           -- the 'to make' queue
  recipe_id INTEGER PRIMARY KEY REFERENCES recipes(id),
  saved_at TEXT NOT NULL,
  note TEXT                        -- 'needs doubanjiang'
);

-- ---------- planning ----------

CREATE TABLE meal_slots (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  meal_type TEXT NOT NULL,         -- 'breakfast','lunch','dinner','late_night'
  status TEXT NOT NULL DEFAULT 'empty',
                                   -- 'empty','auto_fill','planned','pinned',
                                   -- 'skipped','cooked'
  recipe_id INTEGER REFERENCES recipes(id),
  portions INTEGER DEFAULT 2,
  note TEXT,                       -- 'leftovers night','dinner out'
  UNIQUE (date, meal_type)
);

CREATE TABLE grocery_runs (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL,
  shopping_at TEXT NOT NULL,
  horizon_end TEXT NOT NULL,       -- coverage: shopping_at .. horizon_end
  status TEXT NOT NULL DEFAULT 'draft'  -- 'draft','routed','completed'
);

CREATE TABLE grocery_run_items (
  id INTEGER PRIMARY KEY,
  run_id INTEGER REFERENCES grocery_runs(id),
  item_key TEXT NOT NULL,
  display_name TEXT,
  reason TEXT,                     -- 'slot:2026-06-13:dinner','staple_cadence',
  disposition TEXT NOT NULL,       -- 'have','buy'
  store_id INTEGER REFERENCES stores(id),  -- router assignment
  bought INTEGER DEFAULT 0
);

-- ---------- cooking history ----------

CREATE TABLE cook_log (
  id INTEGER PRIMARY KEY,
  recipe_id INTEGER REFERENCES recipes(id),
  slot_id INTEGER REFERENCES meal_slots(id),
  cooked_at TEXT NOT NULL,
  portions_cooked INTEGER,
  actual_active_min INTEGER,       -- drives 'your time' (median per recipe)
  note TEXT,                       -- one-liner: 'cap soy at 2 tbsp'
  reaction_self TEXT,              -- 'loved','fine','meh' (nullable)
  reaction_partner TEXT,
  leftover_destination TEXT,       -- 'none','fridge','freezer'
  leftover_portions REAL           -- required iff destination = 'fridge'
);

-- ---------- preferences ----------

CREATE TABLE preferences (
  id INTEGER PRIMARY KEY,
  tier TEXT NOT NULL,              -- 'allergy','never','not_now','stable','obsession'
  item_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  weight REAL,                     -- obsessions: e.g. 1.8; not_now: negative
  started_at TEXT NOT NULL,
  ended_at TEXT,                   -- NULL = active; history kept (memory artifact)
  source TEXT DEFAULT 'manual'     -- 'manual','auto_detect'
);

-- ---------- garden ----------

CREATE TABLE ycube_catalog (       -- ~120 varieties, seeded once
  variety_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  ingredient_key TEXT NOT NULL,    -- maps cleanly to a kitchen ingredient
  category TEXT,                   -- for shelf_life on harvest ('herb','leafy',...)
  typical_days_to_harvest INTEGER
);

CREATE TABLE garden_slots (
  slot_number INTEGER PRIMARY KEY, -- 1..16 depending on device generation
  variety_key TEXT REFERENCES ycube_catalog(variety_key),  -- NULL = empty
  planted_at TEXT,
  status TEXT NOT NULL DEFAULT 'empty',
                                   -- 'empty','growing','nearing_ready','ready',
                                   -- 'needs_pruning','harvested'
  status_updated_at TEXT,
  latest_thumbnail_path TEXT,
  vision_paused INTEGER DEFAULT 0  -- 1 after harvest until replant
);

CREATE TABLE garden_observations ( -- daily vision pipeline output (append-only)
  id INTEGER PRIMARY KEY,
  slot_number INTEGER REFERENCES garden_slots(slot_number),
  observed_at TEXT NOT NULL,
  growth_stage TEXT,
  harvest_ready INTEGER,           -- 0/1
  pruning_flag INTEGER,            -- 0/1
  pruning_detail TEXT,             -- 'encroaching slot 5'
  image_path TEXT,
  model_used TEXT,
  escalated INTEGER DEFAULT 0      -- ambiguous → bigger model second pass
);

-- ---------- LLM bookkeeping ----------

CREATE TABLE why_cache (
  recipe_id INTEGER REFERENCES recipes(id),
  step_index INTEGER,
  question_norm TEXT,
  answer TEXT NOT NULL,
  model_used TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (recipe_id, step_index, question_norm)
);

CREATE TABLE llm_jobs (            -- batch queue + spend log
  id INTEGER PRIMARY KEY,
  task_type TEXT NOT NULL,         -- 'cookbook_parse','auto_tag','receipt_ocr',
                                   -- 'garden_vision','why','mood','notif_copy'
  status TEXT NOT NULL,            -- 'queued','batched','done','failed'
  model TEXT,
  batch_id TEXT,
  input_ref TEXT,
  cost_microdollars INTEGER,       -- monthly sum surfaced in settings
  created_at TEXT NOT NULL,
  completed_at TEXT
);

-- ---------- events to Home Assistant ----------

CREATE TABLE outbound_events (
  id INTEGER PRIMARY KEY,
  event_type TEXT NOT NULL,        -- 'harvest_ready','pruning_flag','expiring_digest'
  payload TEXT NOT NULL,           -- JSON: copy, deep_link, urgency
  created_at TEXT NOT NULL,
  delivered INTEGER DEFAULT 0      -- HA bridge marks delivery
);
```

## Derivations and invariants

- **Inventory** is materialized from `purchases` + `cook_log` deductions + harvest confirmations + user edits, decayed by `shelf_life`. Rebuild must be idempotent; user edits (quantity_state, confirmations) always win over the model.
- **Your time** per recipe = median(`cook_log.actual_active_min`). Per-source bias = median ratio actual/claimed grouped by `recipes.source_id`; apply as a display + scoring discount to uncooked recipes from that source.
- **Confidence decay**: `certain` → `likely` after category-dependent days without confirmation; `likely` → `maybe` likewise; widened globally when last Walmart sync > 7 days.
- **Freezer invariant**: items in a zone with `pauses_expiry=1` have `expires_at = NULL`; fridge leftovers must have `leftover_portions NOT NULL`; freezer leftovers must have it NULL.
- **Allergy invariant**: a recipe whose `allergen_flags` intersects allergy-tier preferences never appears in any suggestion, browser default view, or plan auto-fill; it renders with a warning badge if opened directly.
- **Harvest confirm transaction**: set slot status='empty', variety preserved in a history sense via `garden_observations`; insert `inventory_items` (source='garden_harvest', category from `ycube_catalog`, expires per `shelf_life`, zone = category home shelf); set `vision_paused=1`.
- **Slot regeneration** never touches `pinned` or `skipped` slots.
- **Nutrition DV math**: protein_dv_g = weight_kg × protein_g_per_kg setting; fiber_dv_g from settings. Chip "≥50% DV" filters recipes where `protein_g_est × (portions adjustment) ≥ 0.5 × protein_dv_g`.
