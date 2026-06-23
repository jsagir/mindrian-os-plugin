---
phase: 172-contextual-invocation-coverage
plan: 04
subsystem: connector-spine
tags: [cirs, connector-spine, reverse-salient, rs-family, canon-part-11, engine-1, INV-02]

# Dependency graph
requires:
  - phase: 172-01
    provides: the wired-XOR-excluded coverage ledger (data/connector-coverage-ledger.json) + classifySurface/coverageReport that this plan's four new connectors register against
  - phase: 143.3-connector-spine-and-intelligence-orchestrator
    provides: the connector: frontmatter contract + scripts/build-connector-registry.cjs generator + the --check tripwire + the validateConnectors tuple check
provides:
  - "The reverse-salient rs-* family (rs-fetch/rs-explain/rs-experts/rs-thesis) is WIRED into the context_block reach via pull_back posture (CIRS R1 WIRED state, Canon Part 11)"
  - "The Engine-1 pillar (Reverse Salient Analysis) is no longer dark: the entire rs-* family is contextually triggerable on SENS-02"
  - "The coverage gap shrinks by exactly 4 (66 wired / 0 excluded / 58 gap, was 62/0/62)"
affects: [172-05 (next gap-shrinking wave), 172-06 (exhaustive residual classification), 172-13 (RETRO-07 hard-FAIL flip reads this ledger)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "connector: block per command file -- the R1 WIRED state declared as additive frontmatter, generator-read never hand-edited"
    - "distinct sub_mode per surface under one reach family (reverse-salient-fetch/-explain/-experts/-thesis) to satisfy the validateConnectors (sensor,reach,sub_mode) no-collision check"
    - "regenerated-artifact lockstep: connector-registry + coverage-ledger + harness-manifest move together (the harness manifest digests the registry)"

key-files:
  created: []
  modified:
    - commands/rs-fetch.md
    - commands/rs-explain.md
    - commands/rs-experts.md
    - commands/rs-thesis.md
    - data/connector-registry.json
    - data/connector-coverage-ledger.json
    - data/harness-manifest.json

key-decisions:
  - "surface: F.1 per the plan action (the find-bottlenecks template carries F.0, but the plan explicitly specifies F.1 for the rs-* family)"
  - "distinct sub_modes (reverse-salient-fetch/-explain/-experts/-thesis) chosen over rank-only variation: all four share SENS-02 + context_block, so the sub_mode must differ to pass the tuple check; ranks 2-5 assigned additionally"
  - "all four declare filing: fileEvidenceWithReadback (the rs-* surfaces produce room/**/rs-*/* artifacts), so the WFL-01 framework resolver check fires and Reverse Salient Analysis resolves -- no unresolvable-framework error"

requirements-completed: [INV-02]

# Metrics
duration: ~12min
completed: 2026-06-23
---

# Phase 172 Plan 04: Wire the Reverse-Salient rs-* Family Summary

**Wires the entire reverse-salient rs-* family (rs-fetch/rs-explain/rs-experts/rs-thesis) -- the Canon Engine-1 pillar that was entirely dark -- into the context_block reach via pull_back, flipping 4 surfaces from gap to WIRED and shrinking the coverage ledger gap count from 62 to 58.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-23
- **Completed:** 2026-06-23
- **Tasks:** 2 of 2
- **Files modified:** 4 command files + 3 generated data artifacts

## Accomplishments

- **Task 1 (commit 6e9b813e):** Added a `# --- Phase 143.3 connector frontmatter ---` delimited `connector:` block to all four rs-* command files. Each declares `connects_to_spine: true`, `sensor_triggers: [SENS-02]` (the shipped lagging-component / reverse-salient sensor that already fires `context_block`), `reach_id: context_block` (frozen 6 -- no 7th reach minted), `framework: "Reverse Salient Analysis"` (EXACT match to each file's existing `frameworks:` value, the WFL-01 resolver key), `posture: pull_back` (per D-172-c), `filing: fileEvidenceWithReadback`, `plan_gated: false`, `web_scope: null`, `surface: F.1`. To avoid the `validateConnectors` check-4 `(sensor_triggers, reach_id, sub_mode)` tuple collision (all four share SENS-02 + context_block), each carries a distinct `sub_mode` under the reverse-salient family -- `reverse-salient-fetch` / `-explain` / `-experts` / `-thesis` -- plus distinct `hierarchy_rank` 2/3/4/5.
- **Task 2 (commit 887590ba):** Ran `node scripts/build-connector-registry.cjs` to regenerate `data/connector-registry.json` (66 connectors, was 62) AND `data/connector-coverage-ledger.json` (66 wired / 0 excluded / 58 gap, was 62/0/62 -- exactly -4 on the gap count, the rs-* family). `--check` exits 0 (the gap + methodology-nudge WARNINGs are warn-only per the Plan 172-01 gate-rollout, hard-FAIL deferred to Plan 172-13). The pre-commit STALE tripwire on the downstream `data/harness-manifest.json` (which digests the connector-registry: source_count 62 -> 66) fired, so the manifest was regenerated via `node scripts/build-harness-manifest.cjs` and committed in lockstep (Deviation Rule 3).

## Verification

| Check | Result |
|-------|--------|
| Task 1: all four rs-* carry `reach_id: context_block` + `connects_to_spine: true` | OK |
| `node scripts/build-connector-registry.cjs --check` exit | 0 (`connector-registry: OK`; gap + nudge WARN on stderr, warn-only stage) |
| rs-* wired in coverage ledger | 4 of 4 (`rs-* wired: 4`) |
| registry contains /mos:rs-fetch / -explain / -experts / -thesis | all 4 present |
| Coverage counts | wired 66 (+4), excluded 0, gap 58 (-4) |
| WFL-01 framework resolution for "Reverse Salient Analysis" | resolves (no unresolvable-framework error) |
| No (sensor,reach,sub_mode) tuple collision | passes (distinct sub_modes) |

## Frozen-Invariant Compliance (Canon Part 11 R1/R2/R3)

- No 7th reach minted: all four use the frozen `context_block`. No 4th posture: all use the frozen `pull_back`. `context_block` and `pull_back` are EXISTING frozen members.
- MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the F.1 keyboard contract: untouched (not in scope of this plan).
- No new edge type, no new node type, no new Brain wire opened. The connector blocks carry only generic machinery enums + the published framework name + render labels (Canon Part 8: structurally incapable of carrying user content).
- Triggers key on the LOCAL problem-state (SENS-02 fires on the conversational reverse-salient framing; `context_block` is a LOCAL analysis reach, never brain_consult or deep_research).
- Generated JSON regenerated by the generator, never hand-edited (CONN-02 discipline).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated the downstream harness manifest in lockstep**
- **Found during:** Task 2 (the Task 2 commit was blocked by a pre-commit hook)
- **Issue:** The pre-commit `harness-manifest` STALE tripwire failed the Task 2 commit because `data/harness-manifest.json` digests `data/connector-registry.json` (wiring role); regenerating the registry changed the digest (source_count 62 -> 66) without the manifest being regenerated.
- **Fix:** Ran `node scripts/build-harness-manifest.cjs` (the sanctioned regeneration command the tripwire itself names) and staged the regenerated manifest into the same Task 2 commit, keeping the generated-artifact set atomic.
- **Files modified:** data/harness-manifest.json
- **Commit:** 887590ba

Otherwise the plan executed exactly as written.

## Known Stubs

None. The four rs-* surfaces are now fully wired; the remaining 58 gap surfaces are the honest measured dark-surface count that later 172 waves (Plans 05/06) exist to shrink, surfaced WARN-only by the ledger.

## Threat Flags

None. The connector blocks introduce no new network endpoint, auth path, file access pattern, or schema change at a trust boundary -- they are frozen-vocabulary enums + a published-methodology name + a render label (matching the plan's accepted T-172-07 disposition). The T-172-08 duplicate-tuple threat was mitigated as planned (distinct sub_modes).

## Self-Check: PASSED
