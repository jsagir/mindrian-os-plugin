---
phase: 165-unknown-unknowns-blindspot-engine
plan: 05
subsystem: api
tags: [connector-spine, sensors, SENS-06, SENS-08, file-meeting, map-unknowns, connector-registry, harness-manifest]

# Dependency graph
requires:
  - phase: 165-01
    provides: "the harness-as-code Wave-0 foundation (IFACE + fixture + RED stubs + the run-all-165.sh phase gate)"
  - phase: 143.3
    provides: "the connector: frontmatter schema + scripts/build-connector-registry.cjs generator + the --check tripwire (docs/CONNECTOR-CONTRACT.md)"
  - phase: 148
    provides: "the frozen 6-reach bank (context_block | contradiction | cross_room | brain_consult | deep_research | hats)"
provides:
  - "commands/file-meeting.md connector block riding the EXISTING contradiction reach (orphan closed, D-165-07)"
  - "commands/map-unknowns.md sensor_triggers upgraded [] -> [SENS-06, SENS-08] (D-165-05/06)"
  - "regenerated data/connector-registry.json (61 connectors) carrying both wirings"
  - "regenerated data/harness-manifest.json (digest + source_count realigned to the new registry)"
affects: [165-06, 165-07, navigation-engine, intelligence-orchestrator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Connector frontmatter rides an EXISTING frozen reach (no 7th reach minted); the filing event dispatches the trigger sensors"
    - "Registry + manifest are GENERATED artifacts: edit frontmatter, regen via build-connector-registry.cjs + build-harness-manifest.cjs, never hand-edit the JSON"

key-files:
  created: []
  modified:
    - commands/file-meeting.md
    - commands/map-unknowns.md
    - data/connector-registry.json
    - data/harness-manifest.json

key-decisions:
  - "file-meeting rides the contradiction reach (the same lane as /mos:reanalyze) at hierarchy_rank 37 (one tighter than reanalyze's 38) -- no 7th reach"
  - "map-unknowns keeps reach_id context_block / sub_mode unknowns-matrix / framework / posture / rank / filing; ONLY sensor_triggers changed"
  - "Regenerated data/harness-manifest.json alongside the registry (Rule 3 -- the pre-commit drift gate requires the manifest digest + source_count to track the regenerated registry)"

patterns-established:
  - "Closing a command orphan = add a connector block on an existing reach, then regen the registry + manifest together so both --check tripwires stay clean"

requirements-completed: [D-165-05, D-165-06, D-165-07]

# Metrics
duration: 4min
completed: 2026-06-19
---

# Phase 165 Plan 05: The Connectors (file-meeting orphan + map-unknowns trigger upgrade) Summary

**Closed the /mos:file-meeting connector orphan by riding the EXISTING contradiction reach (sensor_triggers [SENS-06, SENS-08], sub_mode file-meeting, hierarchy_rank 37, posture pull_back, surface F.1) and upgraded /mos:map-unknowns sensor_triggers [] -> [SENS-06, SENS-08] so the blind-spot engine auto-fires at the next F.1 gate -- no 7th reach, registry + harness-manifest regenerated and both --check tripwires clean.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-19T16:48:19Z
- **Completed:** 2026-06-19T16:52:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- D-165-07: `commands/file-meeting.md` (the confirmed orphan -- no connector block existed) now carries a Phase 165 connector block riding the EXISTING `contradiction` reach. The meeting-filing event becomes the dispatcher for the two blind-spot trigger sensors (SENS-06 contradiction branch = RESOLVE; SENS-08 memory-cortex stale-governing = RE-SCAN). NO 7th reach minted; the frozen bank stays 6.
- D-165-05/06: `commands/map-unknowns.md` `sensor_triggers` upgraded from `[]` to `[SENS-06, SENS-08]` (the engine's front door), every other connector field byte-unchanged (`reach_id: context_block`, `sub_mode: unknowns-matrix`, `framework: "Knowns and Unknowns Matrix Framework"`, `posture: hold`, `hierarchy_rank: 40`, `filing: fileEvidenceWithReadback`).
- `data/connector-registry.json` regenerated via `scripts/build-connector-registry.cjs` (61 connectors); the registry carries file-meeting (contradiction reach, sub_mode file-meeting, both triggers) + the upgraded unknowns-matrix triggers. `--check` clean (`connector-registry: OK`).
- `data/harness-manifest.json` regenerated via `scripts/build-harness-manifest.cjs` (digest + source_count realigned 60 -> 61); `--check` clean (`harness-manifest: OK`).

## Task Commits

The drift gate (pre-commit) requires the regenerated registry + manifest to be consistent with the changed connector frontmatter in the SAME committed tree, so Task 1 (frontmatter) and Task 2 (regen) were committed as one atomic, gate-passing commit rather than two separate commits that would have left the tree in a registry-drift state mid-phase:

1. **Task 1 + Task 2: connector frontmatter + registry/manifest regen** - `81f45399` (feat)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP) - see final docs commit

## Files Created/Modified
- `commands/file-meeting.md` - added the Phase 165 connector block (contradiction reach, sub_mode file-meeting, sensor_triggers [SENS-06, SENS-08], posture pull_back, hierarchy_rank 37, filing fileEvidenceWithReadback, surface F.1, framework/web_scope null) -- closes the orphan
- `commands/map-unknowns.md` - sensor_triggers [] -> [SENS-06, SENS-08]; all other connector fields unchanged
- `data/connector-registry.json` - regenerated (not hand-edited); now carries file-meeting + the upgraded unknowns-matrix triggers (61 connectors)
- `data/harness-manifest.json` - regenerated; connector-registry source digest + source_count realigned

## Decisions Made
- file-meeting rides the contradiction reach at `hierarchy_rank: 37` (one tighter than `/mos:reanalyze`'s 38, so a fresh meeting-filing out-ranks a manual reanalyze on a shared beat; tunable). Followed 165-RESEARCH section 7.2 EXACTLY.
- map-unknowns connector changed in ONE field only (`sensor_triggers`); no incidental edits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated data/harness-manifest.json alongside the registry**
- **Found during:** Task 2 (registry regen)
- **Issue:** The harness-manifest drift gate (`tests/test-harness-manifest-check.cjs`, also wired into pre-commit) tracks a digest + source_count of `data/connector-registry.json`. Regenerating the registry (60 -> 61 connectors) made the committed `harness-manifest.json` stale, which would have blocked the commit.
- **Fix:** Ran `node scripts/build-harness-manifest.cjs` (the established regen path) to realign the manifest digest + source_count to the new registry. Never hand-edited.
- **Files modified:** data/harness-manifest.json
- **Verification:** `node scripts/build-harness-manifest.cjs --check` -> `harness-manifest: OK`; `tests/test-harness-manifest-check.cjs` 7 passed / 0 failed; pre-commit gate passed clean on commit `81f45399`.
- **Committed in:** 81f45399 (part of the task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The manifest regen is the documented Rule-3 fix the execution context anticipated ("the connector/manifest pre-commit drift gate fires WILL fire ... regenerate data/connector-registry.json + data/harness-manifest.json"). No scope creep.

## Issues Encountered
- None beyond the anticipated manifest drift gate (handled as a Rule-3 auto-fix above).

## RED -> GREEN Status

This is the connectors plan (frontmatter + generated artifacts), not an engine-module plan, so it does not own one of the 10 engine RED stubs. Its GREEN proof is the connector contract surface:

- `scripts/build-connector-registry.cjs --check` -> `connector-registry: OK` (the pre-existing "8 methodology commands ship frameworks: but no connector:" line is an opt-in NUDGE warning, exit 0, NOT a failure).
- `scripts/build-harness-manifest.cjs --check` -> `harness-manifest: OK`.
- `tests/test-connector-registry.cjs` PASS; `tests/test-connector-tripwire.cjs` PASS.
- Frozen 6-reach assertion: the regenerated registry carries EXACTLY {brain_consult, context_block, contradiction, cross_room, deep_research, hats} -- zero non-frozen reach_ids (no 7th).
- Registry sensor_triggers proof: file-meeting -> ["SENS-06","SENS-08"]; unknowns-matrix -> ["SENS-06","SENS-08"].

**Carried 165 stub state (intended, unchanged by this plan):** `tests/run-all-165.sh` 9 PASS / 4 FAIL. The W2/W3 engine stubs (corpus-adapter, dsp, dsp-goodness, proxy-oracle, bandit, resume) + the iface/fixture/em-dash floors are GREEN. The Wave-4/5/6 stubs (frozen-edges, part8-boundary, rank-in, verdict) remain RED-untouched -- they depend on the orchestrator + verdict modules that this connectors plan does not build (they land in plans 04/06).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The trigger spine is wired: a filed meeting (or a /mos:map-unknowns invocation) now dispatches SENS-06 + SENS-08, so the blind-spot engine can auto-fire at the next F.1 gate once the orchestrator (plan 04) + verdict (plan 06) land.
- No new dependencies, no edge-vocabulary change, no canon amendment (D-165-08 remap-only honored: this plan touches connector frontmatter + generated registry/manifest only).
- No em-dashes introduced; em-dash sweep in run-all-165.sh PASSED.

## Self-Check: PASSED

- FOUND: commands/file-meeting.md connector block (reach_id contradiction, sub_mode file-meeting, sensor_triggers [SENS-06, SENS-08])
- FOUND: commands/map-unknowns.md sensor_triggers [SENS-06, SENS-08]
- FOUND: data/connector-registry.json + data/harness-manifest.json regenerated, both --check clean
- FOUND: commit 81f45399
- Em-dash sweep of this SUMMARY: 0 (CLAUDE.md HARD RULE honored)

---
*Phase: 165-unknown-unknowns-blindspot-engine*
*Completed: 2026-06-19*
