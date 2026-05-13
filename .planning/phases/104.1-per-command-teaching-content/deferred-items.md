# Phase 104.1 - Deferred Items

Items discovered out-of-scope during plan execution. NOT fixed here; logged for future phases.

## Item 1: Em-dash in lib/hmi/jtbd-taxonomy.json `plan-execution.one_line`

Discovered: Plan 01 Task 1 verification.

The taxonomy entry `plan-execution.one_line` contains a U+2014 em-dash ("Plan the next 90 days — milestones, owners, dates."). This propagates into `jtbd_summary` via derivation in `data/command-registry.json` for `/mos:act` (the sole `/mos:` command currently mapping to `plan-execution`).

**Why deferred:** Per `.planning/phases/104.1-per-command-teaching-content/104.1-CONTEXT.md` "Out of scope" section, taxonomy changes are explicitly excluded from Phase 104.1. The `per-command-teaching.test.cjs` no-em-dash rule asserts only on `c.teaching` (vacuous at null) -- it does not cover derived `jtbd_summary` content. The project no-em-dash rule lives in `feedback_no_emdashes.md` and applies project-wide.

**Where to fix:** A future taxonomy-quality phase (or a one-line edit in `lib/hmi/jtbd-taxonomy.json` accompanied by a regen of `data/command-registry.json`).

**Suggested replacement:** "Plan the next 90 days -- milestones, owners, dates." (double-hyphen per project convention).
