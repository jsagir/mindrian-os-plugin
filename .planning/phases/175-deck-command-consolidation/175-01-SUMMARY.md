---
phase: 175-deck-command-consolidation
plan: 01
subsystem: commands
tags: [deck, mos-deck, feynman, heart, mesh, cirs, connector, born-wired, command-resolver, runchain, design-system]

# Dependency graph
requires:
  - phase: 122-workflow-layer
    provides: lib/workflow/command-resolver.cjs (the registry door /mos:deck resolves through)
  - phase: 166-gated-chain-executor
    provides: lib/core/chain-executor.cjs runChain (the one governed loop /mos:deck hands its chain to)
  - phase: 143.3-connector-spine-and-intelligence-orchestrator
    provides: the connector: frontmatter contract + build-connector-registry.cjs (born-wired gate)
  - phase: 157-brain-orchestration-graph-and-methodology-tiers
    provides: build-orchestration-projection.cjs + the mindrian-operation command counterpart projection
  - phase: 173-publish-jtbd-need-selector
    provides: commands/show.md (the connector + resolve-then-runChain idiom mirrored) + data/publish-needs.json make-land lane (repointed in 175-02)
provides:
  - "/mos:deck consolidated deck command (commands/deck.md), born WIRED under CIRS R1/R2"
  - "data/deck-styles.json: the 3-style + HEART-5-section + Feynman-6-stage source of truth"
  - "F.1 style sub-selector (Feynman / HEART / mesh + Other) routing to 3 distinct named paths"
  - "WARN-first deck-design ruleset doctrine (source links, brand auto-bind + logo->mindrian-os.com, AI-image provenance bottom-right)"
affects: [175-02-alias-and-make-land-repoint, 175-03-registry-wiring-and-regression, deck-design-ruleset-check]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Data-asserted command doctrine: the 3-route + HEART-5-section claims live in data/deck-styles.json, not prose, so tests assert against data"
    - "Born-wired consolidation command: a connector: block + cirs_relationship: block authored at birth so the surface is never dark"
    - "Style sub-selector via one AskUserQuestion (F.1) with the mandatory Other free-text option, mirroring commands/show.md"

key-files:
  created:
    - "data/deck-styles.json (the style + section-schema source of truth)"
    - "commands/deck.md (the /mos:deck consolidated command)"
  modified:
    - "data/command-registry.json (Phase 122 registry, regenerated to add the deck command)"
    - "data/connector-registry.json + data/connector-coverage-ledger.json (born-wired ledger: /mos:deck WIRED, gap=0)"
    - "data/brain-orchestration-projection.json + data/orchestration-command-ledger.json (CIRS R5 counterpart: /mos:deck RANKED, gap=0)"
    - "data/harness-manifest.json (downstream digest of the three regenerated registries)"

key-decisions:
  - "hierarchy_rank 54 instead of the plan-suggested 15 (15 is already used 3 times in the connector registry; 54-59 are the genuine unused band). Plan intent was a non-colliding rank; 54 honors it."
  - "Regenerated all four registry chains in the deck.md commit (Rule 3): the hard-FAIL pre-commit gates (command-registry, connector-registry, harness-manifest, orchestration-projection) block any commit while a new surface leaves them stale. The plan scoped registry-PROOF to 175-03, but the live gates do not permit committing a stale registry; /mos:deck registers WIRED + RANKED with gap=0 either way, so 175-03's wiring proof is unaffected."

patterns-established:
  - "Registry regeneration order: command-registry, connector-registry, orchestration-projection FIRST, then harness-manifest LAST (harness-manifest digests all three)"
  - "Targeted staging only (git add <explicit files>, never git add -A): the branch carries an interrupted release Commit-B (node_modules git-rm-cached + version bump) that must not be swept into a feature commit"

requirements-completed: [R1, R2, R3, R4, R5, R7, R8]

# Metrics
duration: 35min
completed: 2026-06-23
---

# Phase 175 Plan 01: Deck Command Consolidation Summary

**Authored /mos:deck (commands/deck.md), the born-wired consolidation of MOSDeckEngine + feynman-engine, with a data-asserted Feynman/HEART/mesh F.1 style sub-selector, a per-section accept/reshape/skip build flow, and a WARN-first deck-design ruleset (source links + brand auto-bind to logo->mindrian-os.com + AI-image provenance).**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-23T15:43:00Z (approx)
- **Completed:** 2026-06-23T16:18:00Z
- **Tasks:** 2
- **Files modified:** 8 (2 authored, 6 derived registries regenerated)

## Accomplishments
- `data/deck-styles.json`: the single source of truth declaring exactly 3 styles (feynman / heart / mesh), the 5 ordered HEART sections spelling H/E/A/R/T (every fill_source = local-room-content, Part 8), the 6 Feynman stages verbatim from MOSDeckEngine, and mesh composes [feynman, heart].
- `commands/deck.md`: the /mos:deck command, born WIRED via a connector: block (context_block reach reused per D-04, sub_mode deck-build, rank 54), self-declaring its CIRS relationship via a cirs_relationship: block with canon_parts containing 11.
- The F.1 style sub-selector (one AskUserQuestion, Feynman/HEART/mesh + the mandatory Other free-text option) routing to 3 distinct named paths; the deterministic Feynman 6-stage pipeline; the HEART 5-section Brain-sourced-methodology / local-filled path; the mesh compose-both path.
- The per-section accept/reshape/skip F.1 Decision Gate doctrine, and the WARN-first deck-design ruleset (source linking, brand + default design system with logo->https://mindrian-os.com, visual + AI-image provenance bottom-right 8-10pt).
- /mos:deck registers WIRED in the connector ledger (gap=0) and RANKED in the orchestration command ledger (gap=0); resolves through command-resolver then runChain (one governed path, Part 11 R4).

## Task Commits

Each task was committed atomically:

1. **Task 1: data/deck-styles.json (style + section-schema source of truth)** - `2db22068` (feat)
2. **Task 2: commands/deck.md (born-wired /mos:deck + F.1 selector + 3 paths + per-section flow + ruleset doctrine)** - `3bda31f1` (feat)

_Note: an unrelated pre-existing `release: v1.14.0-beta.5` commit (`8ae2a16c`) sits between the two task commits on the branch tip; it predates and is independent of this plan's work._

## Files Created/Modified
- `data/deck-styles.json` - 3 styles + 5 HEART sections + 6 Feynman stages, the data the command doctrine and the 175-03 tests both read.
- `commands/deck.md` - the /mos:deck consolidated command (connector: + cirs_relationship: + canon_parts 11; F.1 selector; Feynman/HEART/mesh paths; per-section gate; deck-design ruleset doctrine).
- `data/command-registry.json` - regenerated to include the deck command (Phase 122 registry).
- `data/connector-registry.json`, `data/connector-coverage-ledger.json` - regenerated; /mos:deck WIRED (mechanical class), gap=0.
- `data/brain-orchestration-projection.json`, `data/orchestration-command-ledger.json` - regenerated; /mos:deck counterpart RANKED, gap=0.
- `data/harness-manifest.json` - regenerated digest of the three registries above.

## Decisions Made
- **hierarchy_rank 54, not 15.** The plan said "use 15; verify it is unused" but rank 15 is already used three times in data/connector-registry.json. Ranks 54-59 are the genuine unused band. 54 honors the plan's actual intent (a non-colliding rank) and the generator accepts it with zero validation errors.
- **All four registry chains regenerated in the Task 2 commit (deviation Rule 3).** See Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] hierarchy_rank 15 collides; used 54 instead**
- **Found during:** Task 2 (authoring the connector: block)
- **Issue:** The plan instructed `hierarchy_rank 15` with "verify it is unused", but rank 15 appears three times in data/connector-registry.json. The plan's stated assumption was wrong; its intent was a non-colliding rank.
- **Fix:** Used rank 54 (the 54-59 band is unused). The connector registry generator accepts /mos:deck with zero validation errors and wires it as a distinct surface.
- **Files modified:** commands/deck.md
- **Verification:** node scripts/build-connector-registry.cjs regenerates clean (90 wired, 36 excluded, 0 gap); /mos:deck appears WIRED.
- **Committed in:** 3bda31f1 (Task 2 commit)

**2. [Rule 3 - Blocking] Regenerated all four registry chains to satisfy hard-FAIL pre-commit gates**
- **Found during:** Task 2 (committing commands/deck.md)
- **Issue:** The plan scoped the registry REGENERATION/PROOF to Plan 175-03 ("this plan creates the surface; 175-03 wires the registries"). But authoring a new invocable command surface leaves four registries stale, and their pre-commit gates were flipped to hard-FAIL in Phase 172-13. The gates (command-registry, connector-registry, harness-manifest, orchestration-projection) blocked the commit; --no-verify is forbidden by the sequential-execution contract.
- **Fix:** Regenerated data/command-registry.json, data/connector-registry.json + data/connector-coverage-ledger.json, data/brain-orchestration-projection.json + data/orchestration-command-ledger.json, and (last) data/harness-manifest.json. Each diff is deck-scoped only (the /mos:deck node + count bumps). /mos:deck registers WIRED (connector ledger, gap=0) and RANKED (orchestration ledger, gap=0).
- **Files modified:** data/command-registry.json, data/connector-registry.json, data/connector-coverage-ledger.json, data/brain-orchestration-projection.json, data/orchestration-command-ledger.json, data/harness-manifest.json
- **Verification:** All four `--check` gates exit 0; the commit succeeds with hooks enabled; the diffs contain no unrelated drift and no node_modules.
- **Committed in:** 3bda31f1 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking).
**Impact on plan:** Both deviations were necessary to commit the planned surface through the live hard-FAIL gates. /mos:deck is born WIRED + RANKED with gap=0 regardless, so Plan 175-03's registry-wiring proof is unaffected (it will re-run the gates green, which is now already true). No scope creep beyond the deterministic registry regeneration the gates require.

## Issues Encountered
- **Interrupted release Commit-B on the branch tip.** The branch carries an uncommitted release-process artifact (a staged `git rm -r --cached node_modules` + a plugin.json/CHANGELOG/package.json next-dev version bump) left by the `8ae2a16c release: v1.14.0-beta.5` flow. A pre-commit hook re-staged those into the index during early failed commit attempts. Resolved by `git reset HEAD` (soft, no working-tree change) and staging ONLY the explicit deck-scoped files; the release artifacts and node_modules were left untouched. No node_modules deletion entered either task commit.
- **harness-manifest regeneration order.** harness-manifest digests command-registry + connector-registry + brain-orchestration-projection, so it had to be regenerated LAST (after the other three). Regenerating it early produced a repeat STALE failure until the order was corrected.
- **run-all-172 first-run flake.** The first `run-all-172.sh` run reported one failure (test-diffusion-adoption-sensor.cjs); the test passes standalone and the suite passed 20/20 on immediate re-run. Not caused by this plan (the diffusion sensor test reads no count this plan changed). run-all-173.sh is green 7/7. REACH_IDS stays length 6 (frozen bank untouched).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- /mos:deck exists, is born WIRED + RANKED, and resolves through command-resolver + runChain. Ready for Plan 175-02 (alias MOSDeckEngine + feynman-engine to /mos:deck; repoint the /mos:show make-land lane in data/publish-needs.json from MOSDeckEngine to /mos:deck; author the deck-design ruleset --check in WARN mode) and Plan 175-03 (registry wiring proof + run-all regression).
- The four registry chains are already regenerated and green this plan, which de-risks 175-03's gate-proof step.

## Self-Check: PASSED

- FOUND: data/deck-styles.json
- FOUND: commands/deck.md
- FOUND: .planning/phases/175-deck-command-consolidation/175-01-SUMMARY.md
- FOUND commit: 2db22068 (Task 1)
- FOUND commit: 3bda31f1 (Task 2)

---
*Phase: 175-deck-command-consolidation*
*Completed: 2026-06-23*
