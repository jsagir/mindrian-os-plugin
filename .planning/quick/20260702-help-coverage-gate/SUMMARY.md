---
kind: quick
slug: 20260702-help-coverage-gate
title: Backfill /mos:help command coverage + wire the born-listed drift gate
date: 2026-07-02
canon_parts: [Part 3, Part 7, Part 8, Part 11]
commits: [e9c984bd, 9448f195]
---

# Summary

`/mos:help` promised EVERY user-facing command appears, but `data/help-groups.json`
had drifted: 13 non-deprecated user-facing commands were silently absent. The
coverage gate that should have caught this (`scripts/check-help-coverage.cjs`)
already existed and was already RED, but it had never been wired into
`scripts/install-pre-commit.sh` -- that missing wiring was the silent-drift hole.
Backfilled the 13, hardened the gate to born-listed deprecation exclusion, wired
it into pre-commit, and added a focused fixture-driven gate test.

# One-liner

Closed a 13-command /mos:help coverage drift and wired the pre-existing (but
un-wired) coverage gate into pre-commit with a born-listed deprecation contract.

# Reality vs the brief (important deviations)

1. The gate already existed. The brief said to create
   `scripts/check-help-coverage.cjs`. It shipped in Phase 121.5-07 with the exact
   born-listed logic (missing-help_jtbd + missing_from_groups + ghost). Per Canon
   Part 7 (Reuse Before Build) I strengthened the shipped gate rather than minting
   a parallel one. The genuine gap was that it was never wired into pre-commit.

2. FIVE deprecated commands, not two. The brief named heal + query as the only
   deprecated commands to exclude. Ground truth from frontmatter: heal,
   hmi-status, organize, query, visualize all carry `deprecated: true`, and all
   five were already listed in the top-level `deprecated_aliases` map. So the real
   split is 13 backfilled + 5 deprecated-excluded + 2 admin-excluded = 107 (not
   the brief's implied 16 + 2).

3. No parallel `_excluded` key. The brief asked for a top-level `_excluded`
   "or in-shape equivalent". `deprecated_aliases` IS that in-shape, machine-checkable
   equivalent (it already lists all five deprecated commands). Adding a second list
   would be a drift-prone duplicate the existing tests do not read. Instead the gate
   treats `deprecated_aliases` as the authoritative exclusion registry AND
   hard-fails if any `deprecated: true` command is missing from it (born-listed).

# Per-lane placement of the 13 backfilled commands

| Command | Group | Lane | Rationale (help_jtbd) |
|---------|-------|------|-----------------------|
| bono | intelligence-brain | explore | parallel research swarm / what-if debate |
| diffusion | intelligence-brain | explore | forecast dual-use tech diffusion |
| futures | intelligence-brain | explore | multi-ring consequence wheel |
| trending-to-absurd | intelligence-brain | explore | push trends to absurd for opportunities |
| skill | intelligence-brain | explore | materialize a SyntheticExpert graph node |
| stance | getting-started | start | flip Larry's conversational stance (session nav) |
| mva-report | reviewing | view | structured conversation-flow report of the session |
| deck | publish | view | build an on-brand source-cited deck |
| show | publish | view | show or share your work |
| agentshield | infrastructure | view | scan the plugin's own agent-config surfaces |
| correct-reference-now | infrastructure | view | correct the reference clock |
| ingest-methodology | infrastructure | view | maintainer pipeline to add a methodology to Brain |
| new-surface | infrastructure | view | scaffold a new /mos surface + connector wiring |

# Explicit exclusions (born-listed, machine-checkable)

- Deprecated (5), via `deprecated_aliases` registry, reason `deprecated`: heal,
  hmi-status, organize, query, visualize. Each carries `deprecated: true` in
  frontmatter; the gate now hard-fails if a deprecated command is not registered.
- Admin (2), via `visibility: admin` frontmatter: admin, dogfood-flush.

# Gate result

`node scripts/check-help-coverage.cjs` -> `valid: true`, exit 0. 0 missing / 0
ghosts / 0 unlisted-deprecated / 0 deprecated-in-groups / 0 orphan-excluded.
Coverage rose from 87 to 100 non-admin commands (87 + 13).

# Pre-commit wiring (confirmed)

`scripts/install-pre-commit.sh` now wires the gate in all three required spots:
idempotency grep, the splice-path guard block, and the fresh-install HOOK_BODY --
gated on staged `commands/*.md` or `data/help-groups.json`. Ran the installer:
the live `.git/hooks/pre-commit` now invokes the gate (verified reachable before
the terminal `exit 0`), and commit A exercised it live (`valid: true`).

# Verification (yes/no each)

| Check | Result |
|-------|--------|
| `node scripts/check-help-coverage.cjs` exit 0 | yes |
| `node scripts/help-renderer.cjs` exit 0 + includes bono/stance/deck | yes |
| test-help-cards-render | yes (100 non-admin covered) |
| test-help-selector-lanes | yes |
| test-help-renderer-bulletproof | yes |
| test-192-menu-sweep-live-selectors | yes |
| tests/test-help-coverage-gate.cjs (new) | yes (7/7) |
| lib/memory/help-coverage.test.cjs (Test 10 flipped green) | yes (4/4) |
| deprecated commands do NOT render | yes (all 5 excluded) |
| node -c on every touched .cjs | yes |
| no em-dashes on touched files | yes |

# Files changed

- `data/help-groups.json` (backfill 13 + exclusion-registry docs) -- commit e9c984bd
- `scripts/check-help-coverage.cjs` (born-listed hardening + optional fixture paths) -- 9448f195
- `scripts/install-pre-commit.sh` (wire the gate, 3 spots) -- 9448f195
- `tests/test-help-coverage-gate.cjs` (new, 7 tests) -- 9448f195
- `lib/memory/run-feynman-tests.cjs` (register new test) -- 9448f195

# Deviations / blockers

- Deviations documented above (gate pre-existed; 5 deprecated not 2; no parallel
  `_excluded`). All are ground-truth-driven corrections.
- Out of scope (not fixed): the pre-existing live `.git/hooks/pre-commit` was
  installed by a different mechanism and is missing SIX other MindrianOS gates
  (harness-manifest, connector, projection, render-coverage, corpus-stats,
  shape-declaration) entirely -- a pre-existing condition unrelated to this task.
  The tracked installer is correct; a clean re-clone wires all gates including
  help-coverage. Noted, not touched (SCOPE BOUNDARY).
- No blockers.

## Self-Check: PASSED
