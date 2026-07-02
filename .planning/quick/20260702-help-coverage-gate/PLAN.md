---
kind: quick
slug: 20260702-help-coverage-gate
title: Backfill /mos:help command coverage + wire the born-listed drift gate
date: 2026-07-02
canon_parts: [Part 3, Part 7, Part 8, Part 11]
---

# Objective

`/mos:help` claims EVERY user-facing command appears, but `data/help-groups.json`
(hand-maintained, last curated 121.5-07) had drifted: 13 non-deprecated
user-facing commands were silently absent, and the coverage gate that should
catch this (`scripts/check-help-coverage.cjs`) was never wired into pre-commit,
so the drift was invisible. Backfill the gap and close the wiring hole so it can
never silently drift again.

# What the recon found (reality vs the brief)

The brief assumed the gate did not exist and that only heal + query were
deprecated. Ground truth from disk:

- `scripts/check-help-coverage.cjs` ALREADY EXISTS (Phase 121.5-07 Task 2) and
  already implements the exact born-listed logic: missing-help_jtbd,
  missing_from_groups (non-admin, minus `deprecated_aliases` keys), and
  orphan/ghost (a grouped command with no file). It was RED (13 missing) but
  invisible because it was NEVER wired into `scripts/install-pre-commit.sh`.
  That missing wiring IS the silent-drift hole.
- FIVE commands are deprecated (frontmatter `deprecated: true`), not two:
  heal, hmi-status, organize, query, visualize. ALL FIVE are already listed in
  the top-level `deprecated_aliases` map -> the in-shape, machine-checkable
  exclusion registry the brief asked for (its "(or in-shape equivalent)" out).
- Two shipped help tests were already RED with "13 !== 0"
  (test-help-cards-render, test-help-selector-lanes) plus
  lib/memory/help-coverage.test.cjs Test 10 - all three flip green on backfill.
- `scripts/help-renderer.cjs` already defensively skips `deprecated: true`
  commands, so a deprecated command can never render even if mis-listed.

So the work is: BACKFILL (13), HARDEN the existing gate to born-listed
deprecation exclusion, WIRE it into pre-commit, and add the requested focused
gate test. Part 7 (Reuse Before Build): strengthen the shipped gate, do NOT
mint a parallel one.

# Tasks

1. BACKFILL `data/help-groups.json` - add the 13 non-deprecated missing commands
   to the correct group/lane by their help_jtbd/serves_jtbd:
   - intelligence-brain (explore): bono, diffusion, futures, trending-to-absurd, skill
   - getting-started (start): stance
   - reviewing (view): mva-report
   - publish (view): deck, show
   - infrastructure (view): agentshield, correct-reference-now, ingest-methodology, new-surface
   Enrich the notes so `deprecated_aliases` is documented as THE machine-checkable
   exclusion registry (heal, hmi-status, organize, query, visualize; reason:
   deprecated). No parallel `_excluded` key (avoids a second drift-prone source;
   the brief permits the in-shape equivalent).

2. HARDEN `scripts/check-help-coverage.cjs` to born-listed deprecation: every
   `deprecated: true` command MUST appear in the exclusion registry
   (deprecated_aliases keys) or FAIL (unlisted_deprecated); a deprecated command
   that leaked into a group FAILs (deprecated_in_groups); a ghost in the
   exclusion registry FAILs (orphan_excluded). Additive fields; existing
   consumers untouched.

3. WIRE the gate into `scripts/install-pre-commit.sh` (idempotency grep + guard
   block in both the splice path and the fresh HOOK_BODY), gated on staged
   commands/*.md or data/help-groups.json. Mirror how check-shape-declaration
   (190-04) was added.

4. TEST `tests/test-help-coverage-gate.cjs`: gate green on the fixed manifest;
   RED fixture (a temp user-facing command absent from groups) proves the catch;
   ghost fixture + unlisted-deprecated fixture prove the born-listed contract;
   assert the pre-commit installer wires the gate.

# Verification

- `node scripts/check-help-coverage.cjs` exits 0 (0 missing / 0 ghosts).
- `node scripts/help-renderer.cjs` exits 0 and now includes bono, stance, deck.
- Green: test-help-cards-render, test-help-selector-lanes,
  test-help-renderer-bulletproof, test-192-menu-sweep-live-selectors,
  help-coverage.test.cjs, test-help-coverage-gate.cjs.
- `node -c` clean on every touched .cjs. No em-dashes. No --no-verify.

# Rules

HARD: no em-dashes (hyphens only). Never --no-verify. Do NOT touch ROADMAP.md.
