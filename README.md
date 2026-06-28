# Personal cooking app — handoff package

This package is the consolidated spec and mockups for a personal-use, local-first cooking app for one two-person household. It is intended to be handed to a coding agent (e.g. Claude Code) as the source of truth for implementation.

## Contents

| File | What it is |
|---|---|
| `requirements.md` | The full consolidated requirements: philosophy, architecture, every feature spec, the garden feature, nutrition targets, LLM cost policy, non-features, and build order. **Read this first.** |
| `data-model.md` | SQLite schema (DDL sketch) for every table, with notes on derivations and invariants. |
| `mockups.html` | All 15 screen mockups in one self-contained HTML file (no dependencies — open in any browser). Each screen has an anchor id, a caption explaining intent, and annotations for behavior that isn't visible in a static mock. |

## How to use this with a coding agent

1. Read `requirements.md` end to end before writing code. The philosophy section is normative — features that fight it are wrong even if they match a screen pixel-for-pixel.
2. `mockups.html` is directional, not pixel-perfect. Layout, information hierarchy, and copy tone matter; exact spacing does not. Mobile (390px) is the only mocked breakpoint; web/iPad get a two-column promotion at ≥768px as described in requirements §2.
3. `data-model.md` is a sketch. Column names and types are intended; the agent may normalize further (e.g. split recipe ingredients into a child table — already done) but should not denormalize the meal-slot model.
4. Follow the build order in requirements §14. Do not build the garden feature, store router, or nutrition estimates before the inventory foundation works.

## Source-of-truth precedence

If documents conflict: `requirements.md` > `data-model.md` > `mockups.html`. The original project brief and garden addendum are superseded by this package (their content is folded in, with revisions from design review).

## Key decisions already made (do not relitigate)

- Local-first. SQLite is the single source of truth. No cloud, no accounts, no multi-user infrastructure.
- The plan is a rolling timeline of meal slots, not a weekly plan. Grocery runs are queries over that timeline with a user-chosen horizon.
- The suggester is deterministic scoring — no LLM call on the dinner-decision hot path.
- LLM work is batched and cached per the cost policy in requirements §11.
- Dinner is the only slot that auto-fills. Empty breakfast/lunch slots are a normal state, never a nag.
- Notifications are delivered by Home Assistant, not by the app.
- Allergies (peanuts, tree nuts) are a hard filter at every suggestion surface and flagged at import.
