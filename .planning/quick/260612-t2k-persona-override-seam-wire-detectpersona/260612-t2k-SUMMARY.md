---
quick_id: 260612-t2k
title: Persona override (identity-only) — navigator-set persona survives auto-detection and maintenance commands
status: complete
date: 2026-06-12
canon_parts: [Part 8, Part 9, Part 10]
commits:
  - dcf9450c feat(t2k-1) persona-override.cjs store (get/set/clear/status, taxonomy-validated, atomic, local-only)
  - a7137bf1 feat(t2k-2) readUserMd override seam returns synthetic persona while override active
  - d59401a6 test(t2k-3) persona-override seam test + activation-surface doc
merge: 3c84ad74
---

# Summary — Persona Override, identity-only (260612-t2k)

## What shipped
QA Report #1 (Context Collapse) root cause: real USER.md re-injected every turn with no suppression
and no role-play flag; `detectPersonaUpdate` had an unused `user_override` case (gate built, key
never cut). Navigator-LOCKED slice: identity-only override via the `readUserMd` chokepoint.

- **lib/core/persona-override.cjs** (new): the store. `~/.mindrian/persona-override.json` (global,
  room-agnostic; `MINDRIAN_PERSONA_OVERRIDE_PATH` for tests). Exports get/set/clear/isActive + CLI
  (`set <role>` / `set-blend` / `clear` / `status`). Taxonomy-validated against persona-taxonomy.cjs,
  atomic tmp+rename write, default-absent, graceful null on any failure. Node builtins only.
- **lib/core/user-md-ops.cjs** (`readUserMd`:218): additive seam at the top — while an override is
  active, return the synthetic persona to EVERY one of the ~9 callers (intent-classifier per-turn
  read, navigation engine, shape-f renderers, lens engine, room-birth, confirm-node,
  research-preflight, persona-taxonomy), ignoring the real USER.md. `override_active` marker added
  to the emptyUser shell. The store lives OUTSIDE the context window, so the persona SURVIVES
  /mos:doctor — the exact failure that collapsed it. No-override path is byte-identical.
- **commands/persona.md**: body note documenting set/status/clear; frontmatter byte-unchanged.

## Verification (actual output)
- `tests/test-persona-override.cjs` → 5/5 passed (no-override real read; founder override ignores
  file; user_override updates regardless of confidence; clear → byte-identical real read +
  override_active false; malformed/absent store → null, no throw).
- `lib/memory/user-md-persona.test.cjs` regression → 22/22 passed (proves no-override byte-identical;
  Test 21 reconfirms zero Brain surface in user-md-ops).
- `node --check` both files OK. Part 8 grep `fetch|https?:|brain|tavily|onrender` on
  persona-override.cjs → 0 matches. Em-dash sweep across all changed files → clean.
- CLI `status` on a clean machine → `none` (real users unaffected by default).

## One deviation (resolved)
Initial module docstring quoted the literal Part 8 grep pattern, causing a self-match; reworded the
comment before committing Task 1 so the file is genuinely zero-match.

## Out of scope (deferred, feature-sized)
- FULL synthetic-persona test-mode that SUPPRESSES room state, memory, and nudges (the report's
  medium-term rec): gate getRoomContext / readQuadruple / nudges on `override_active`.
- /mos:test-persona temp-room scaffolding (the report's short-term rec).
- A per-turn "PERSONA OVERRIDE ACTIVE" banner — the `override_active` marker is exposed for a future
  surface to render; this task only guarantees the marker exists.
