---
quick_id: 260602-rgx
slug: help-selector-lanes-regression
kind: quick
created: 2026-06-02
completed: 2026-06-02
subsystem: help-selector
tags: [regression-test, mos-help, help-groups, lane-contract, canon-part-7, canon-part-8]
key-files:
  created:
    - tests/test-help-selector-lanes.cjs
  modified:
    - lib/memory/run-feynman-tests.cjs
decisions:
  - "Derive the non-admin command set by mirroring scripts/check-help-coverage.cjs (visibility != admin minus deprecated_aliases keys) rather than inventing a second visibility convention -- Canon Part 7 reuse."
  - "Assertion 4 spawns help-renderer.cjs in a child process (isTTY false -> probeCapability returns ascii deterministically); the /mos:<cmd> substring check is branch-independent, so it holds for both the ASCII and truecolor render branches."
  - "Test-only + 1 additive runner registration. Zero change to data/help-groups.json, commands/help.md, or scripts/help-renderer.cjs -- curation is frozen, all 84 non-admin commands preserved."
metrics:
  duration: ~10m
  tasks: 1
  files: 2
---

# Quick Task 260602-rgx: harden the /mos:help selector-menu feature Summary

Regression test that locks the /mos:help Shape F selector-menu lane contract: 84 non-admin commands covered by exactly one of {start, methodology, explore, view}, with admin commands and deprecated aliases provably excluded -- so a future edit cannot silently orphan a command, leak an admin command into help, or drift the lane enum.

## What shipped

**`tests/test-help-selector-lanes.cjs`** -- a CJS `node:assert` test (zero new deps, pass/failTest counters + `process.exit` mirroring `tests/test-doctor-class-a-topology-drift.cjs`) asserting the four PLAN invariants:

1. **Lane enum.** Every group in `data/help-groups.json` declares a `lane` in the closed set `{start, methodology, explore, view}`.
2. **Exact cover.** The 4 lanes cover every non-admin command EXACTLY once -- full coverage (no orphan) + no command in two groups (no dup) + no lane referencing a non-non-admin command (no extra) + lane-union size equals non-admin-set size + all 4 lanes used. The non-admin set is derived from `commands/*.md` frontmatter (`visibility != admin`) minus the `deprecated_aliases` keys, mirroring `scripts/check-help-coverage.cjs` (same anchored `---\n...\n---` frontmatter dialect, same deprecated-key filter).
3. **Exclusion.** No `visibility: admin` command (asserts both `admin` and `dogfood-flush` are admin) and no `deprecated_aliases` key (`heal`, `query`, `organize`, `hmi-status`) appears in any group.
4. **Renderer parity.** `scripts/help-renderer.cjs` text view exits 0 and prints a `/mos:<cmd>` line for every non-admin command -- and prints NO admin `/mos:<cmd>` line.

**`lib/memory/run-feynman-tests.cjs`** -- one additive `path.join(...)` registration line appended at the tail of `TEST_FILES` with a descriptive comment. Every prior entry byte-unchanged.

## Verification

| Check | Result |
|-------|--------|
| `node tests/test-help-selector-lanes.cjs` | exit 0 -- all 4 assertion blocks PASS (Assertion 2 reports 84 commands) |
| `node scripts/check-help-coverage.cjs` | `valid: true`, exit 0 (zero regression) |
| `node scripts/help-renderer.cjs` | exit 0 |

The derivation was cross-checked before writing the test: 84 non-admin commands, 84 unique grouped, 0 dups, 0 orphans, 0 extras -- the contract holds exactly today, so the test is GREEN on landing (a curation-locking fence, not a RED-to-GREEN feature build).

## Deviations from Plan

None -- plan executed exactly as written. (One intra-task correction, not a deviation: an early draft of Assertion 4 referenced a `MINDRIAN_FORCE_ASCII` env var that `lib/core/terminal-capability.cjs` does not honor; replaced with the non-TTY-default ASCII path + force-color/Desktop env scrub before the test was ever run. No plan obligation changed.)

## Constraints honored

- NO em-dashes (hyphens only). CJS only, zero new npm deps.
- Test-only + 1 additive runner registration. Curation frozen: `data/help-groups.json`, `commands/help.md`, and `scripts/help-renderer.cjs` untouched. All 84 non-admin commands preserved.
- Canon Part 7 (Reuse Before Build): non-admin derivation mirrors the existing coverage check.
- Canon Part 8 (Graph Boundary): filesystem only, zero network surface.
- Atomic commits WITH hooks; never `--no-verify`.

## Self-Check: PASSED

- `tests/test-help-selector-lanes.cjs` exists.
- `lib/memory/run-feynman-tests.cjs` carries the additive registration line.
- New test exit 0; `check-help-coverage` exit 0; `help-renderer` exit 0.
