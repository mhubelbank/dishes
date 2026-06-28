# CLAUDE.md

This repo's agent guidance lives in **[`AGENTS.md`](AGENTS.md)** — read it for the
project overview, layout, conventions, build/test commands, and the patterns to
preserve. Everything there applies to Claude Code. (AGENTS.md is also what OpenAI
Codex / ChatGPT and other agent tools read, so it's kept canonical to avoid drift.)

Critical reminders, inline so they're never missed:

- **All code is under `app/`.** Run npm commands from there — `cd app` first; the
  shell cwd can reset between calls.
- **Definition of done:** `npm run typecheck && npm test && npm run build` must all
  pass before a change is considered working.
- **`domain/` is pure + unit-tested** (no React, no I/O, no imports from `clients/`);
  **`clients/` does persistence**; **`components/`** and **`pages/`** are the UI.
- **Spec precedence:** `requirements.md` > `data-model.md` > `mockups.html`;
  `architecture.md` describes the Cloudflare / git-as-DB deployment. Philosophy in
  requirements §1 is normative.
- Don't commit or push unless asked.
