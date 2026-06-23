---
phase: 172-contextual-invocation-coverage
plan: 16
subsystem: connector-spine
tags: [cirs, connector-spine, canon-part-11, INV-01, INV-02, INV-03, presentation-surfaces, navigator-gated]

# Dependency graph
requires:
  - phase: 172-06
    provides: the exclude-block pattern (connector:{excluded:true,reason}) that over-excluded these 7 presentation/intelligence surfaces as render/utility -- this plan replaces those blocks with WIRE blocks
  - phase: 172-12
    provides: the gap===0 baseline (after /mos:act + /mos:ingest-methodology wired) that this plan must not regress
  - phase: 172-04
    provides: the rs-* WIRE connector-block pattern (context_block reach, sensor_triggers, distinct sub_mode) this plan mirrors
  - phase: 143.3-connector-spine-and-intelligence-orchestrator
    provides: the connector: frontmatter contract + scripts/build-connector-registry.cjs generator + the --check tripwire
provides:
  - "7 presentation/intelligence surfaces (dashboard, wiki, present, status, room, explain-decision, speakers) flipped EXCLUDE -> WIRED (context_block reach, framework:null additive-degrade, sensor_triggers:[], distinct sub_mode, hold posture, memory_event_only filing)"
  - "visualize + query corrected from over-stated render/utility exclusions to honest DEPRECATED-redirect reasons (kept excluded:true)"
  - "regenerated coverage ledger: 88 wired / 36 excluded / 0 gap -- the 7 flip excluded -> wired with ZERO gap regression"
affects: [172-13 (RETRO-07 hard-FAIL flip reads this ledger and asserts gap===0)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "framework:null WIRE shape (additive-degrade, CONNECTOR-CONTRACT section 4) for presentation/explain surfaces with no resolvable Brain :Framework -- mirrors the Plan-06 graph.md/memory.md null-framework pattern; filing:memory_event_only is the legal null-framework filing"
    - "sensor_triggers:[] WIRE surface (a reach declared but not sensor-fired, valid per CONNECTOR-CONTRACT section 2); distinct sub_mode per surface keeps the (sensor,reach,sub_mode) tuple unique"
    - "EXCLUDED-with-reason corrected in place (deprecated-redirect reason replaces over-stated render rationale) without flipping the excluded:true terminal state"
    - "regenerated-artifact lockstep: connector-registry + coverage-ledger + harness-manifest move together (the harness manifest digests the registry source_count)"

key-files:
  created:
    - .planning/phases/172-contextual-invocation-coverage/172-16-SUMMARY.md
  modified:
    - commands/dashboard.md
    - commands/wiki.md
    - commands/present.md
    - commands/status.md
    - commands/room.md
    - commands/explain-decision.md
    - commands/speakers.md
    - commands/visualize.md
    - commands/query.md
    - data/connector-registry.json
    - data/connector-coverage-ledger.json
    - data/harness-manifest.json

key-decisions:
  - "Applied the navigator-approved 2026-06-23 EXACT 7-surface WIRE set VERBATIM (dashboard/wiki/present/status/room/explain-decision/speakers); no surface added or dropped; onboard + export kept EXCLUDED per navigator"
  - "All 7 WIRE surfaces declared framework:null (additive-degrade) + filing:memory_event_only -- they are presentation/explain surfaces, not Brain frameworks, so no unresolvable-framework build error fires; mirrors Plan-06 graph.md/memory.md shape"
  - "All 7 declared sensor_triggers:[] (reachable/offerable, not auto-fired) with distinct sub_modes (room-dashboard/room-wiki/room-present/room-status/room-view/decision-explain/meeting-speakers) so the tuple-collision check stays clean"
  - "visualize + query kept excluded:true; only the reason corrected to an honest DEPRECATED-redirect (visualize -> /mos:dashboard --mermaid; query -> /mos:graph), not 'render utility'"
  - "No 7th reach / no new edge / no new node / no new Brain wire minted; reach_id is the frozen-6 context_block; hierarchy_ranks 11-17 assigned (collisions irrelevant -- uniqueness is on the sensor+reach+sub_mode tuple)"

requirements-completed: [INV-01, INV-02, INV-03]

# Metrics
duration: ~10min
completed: 2026-06-23
---

# Phase 172 Plan 16: Navigator-Directed Presentation-Surface Reclassification Summary

**Corrects the Plan-06 over-exclusion: 7 room-presentation / Larry-explains / meeting-intelligence surfaces (dashboard, wiki, present, status, room, explain-decision, speakers) move EXCLUDE -> WIRE (context_block reach, framework:null additive-degrade, sensor_triggers:[]) per the navigator-approved 2026-06-23 set, while visualize + query stay EXCLUDED with corrected DEPRECATED-redirect reasons -- regenerating the ledger to 88 wired / 36 excluded / 0 gap with ZERO gap regression.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-23
- **Completed:** 2026-06-23
- **Tasks:** 2 of 2
- **Files modified:** 9 command frontmatter files + 3 regenerated data artifacts

## Accomplishments

- **Task 1 (commit 6417f686):** Replaced the `connector:{excluded:true,reason}` block in 7 surfaces with a WIRED connector block and corrected the 2 deprecated reasons.
  - **7 WIRE** blocks (all `connects_to_spine: true`, `sensor_triggers: []`, `reach_id: context_block`, `framework: null`, `posture: hold`, `filing: memory_event_only`, `plan_gated: false`, `web_scope: null`, `surface: F.1`):
    - `/mos:dashboard` (sub_mode room-dashboard, rank 11), `/mos:wiki` (room-wiki, 12), `/mos:present` (room-present, 13), `/mos:status` (room-status, 14), `/mos:room` (room-view, 15), `/mos:explain-decision` (decision-explain, 16), `/mos:speakers` (meeting-speakers, 17)
  - **2 deprecated-reason corrections** (kept `excluded: true`): `/mos:visualize` reason -> "Deprecated - redirects to /mos:dashboard --mermaid; scheduled removal v1.14.0"; `/mos:query` reason -> "Deprecated - superseded by /mos:graph ... scheduled removal v1.14.0".
- **Task 2 (commit 5cb9555d):** Ran `node scripts/build-connector-registry.cjs` to regenerate `data/connector-registry.json` (88 connectors, was 81) and `data/connector-coverage-ledger.json` (88 wired / 36 excluded / 0 gap). `--check` exits 0. The downstream `data/harness-manifest.json` was regenerated in lockstep (it digests the connector-registry source_count) and committed in the same commit (the sanctioned Plans 172-04/05/06 lockstep).

## Task Commits

1. **Task 1: Reclassify 7 surfaces EXCLUDE -> WIRE; correct 2 deprecated reasons** - `6417f686` (feat)
2. **Task 2: Regenerate registry + ledger; verify gap stays 0** - `5cb9555d` (feat)

**Plan metadata:** (final docs commit, see below)

## Files Created/Modified

- `commands/dashboard.md` ... `commands/speakers.md` (7) - excluded block replaced with WIRED connector block (context_block, framework:null)
- `commands/visualize.md`, `commands/query.md` - exclude reason corrected to DEPRECATED-redirect (excluded:true preserved)
- `data/connector-registry.json` - regenerated (88 connectors)
- `data/connector-coverage-ledger.json` - regenerated (88 wired / 36 excluded / 0 gap)
- `data/harness-manifest.json` - regenerated in lockstep (digests registry source_count)

## The new wired/excluded/gap split

| Metric | Before (Plan 06/12 baseline) | After (this plan) | Delta |
|--------|------------------------------|-------------------|-------|
| wired | 81 | 88 | +7 |
| excluded | 43 | 36 | -7 |
| gap | 0 | 0 | 0 (no regression) |

The 7 surfaces moved out of the `excluded` bucket into `wired`; `visualize` + `query` remain in `excluded`. `counts.gap` stayed exactly 0.

## Decisions Made

- Applied the navigator-approved EXACT 7-surface WIRE set verbatim (2026-06-23 "ok"); no surface added or dropped. onboard + export kept EXCLUDED (navigator kept them out).
- All 7 WIRE surfaces use `framework: null` (additive-degrade) + `filing: memory_event_only` -- they are presentation/explain surfaces, not Brain frameworks, so no unresolvable-framework build error fires. Mirrors the Plan-06 graph.md/memory.md null-framework WIRE shape.
- All 7 use `sensor_triggers: []` (reachable/offerable, not auto-fired) with distinct sub_modes so the `(sensor_triggers, reach_id, sub_mode)` tuple stays unique.
- visualize + query kept `excluded: true`; only the reason corrected to an honest DEPRECATED-redirect.

## Frozen-Invariant Compliance (Canon Part 11 R1/R3 + Part 8)

- No 7th reach minted: all 7 WIRE blocks use the frozen `context_block`. No 4th posture: only frozen `hold` used. reach_id is a frozen-6 value.
- No new edge type, no new node type, no new Brain wire opened. The connector / exclude blocks carry only generic machinery enums + author rationale strings (Canon Part 8: structurally incapable of carrying user content; framework:null carries no Brain handle at all).
- MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the F.1 keyboard contract: untouched (not in scope).
- Generated JSON regenerated by the generator, never hand-edited (CONN-02 discipline).
- The coverage gate is WARN-only this stage (the hard flip is Plan 13's re-run); counts.gap stayed 0 (no regression).
- No em-dashes.

## Verification

| Check | Result |
|-------|--------|
| Task 1 automated: 7 surfaces carry `connects_to_spine: true`; visualize+query carry "deprecat" | OK |
| Task 2: `node scripts/build-connector-registry.cjs --check` exit | 0 |
| Task 2: all 7 surfaces state:wired in ledger | PASS |
| Task 2: visualize + query state:excluded in ledger | PASS (both true) |
| Task 2: ledger counts | wired 88 / excluded 36 / gap 0 |
| Task 2: counts.gap regression | 0 (no regression) |
| harness-manifest STALE tripwire | regenerated in lockstep; `harness-manifest: OK` at commit |

## Deviations from Plan

None - plan executed exactly as written. The harness-manifest lockstep regeneration was the sanctioned, plan-anticipated lockstep (the plan's own Task 2 note names `node scripts/build-harness-manifest.cjs` as the expected action if the STALE tripwire fires), not an unplanned deviation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The corrected classification is registry-reflected; gap stays 0 -- the corrected baseline for the Plan-13 RETRO-07 hard-FAIL coverage-gate flip.
- No blockers.

## Known Stubs

None. All 9 surfaces carry an explicit WIRE or EXCLUDE-with-reason decision in their own frontmatter.

## Threat Flags

None. The connector / exclude blocks introduce no new network endpoint, auth path, file access pattern, or schema change at a trust boundary. T-172-50 (over-eager WIRE) mitigated by the navigator gate (exact 7-surface set approved 2026-06-23 before execution). T-172-51 (connector metadata) accept disposition honored (frozen machinery enums + framework:null; no user content).

## Self-Check: PASSED

- FOUND: 172-16-SUMMARY.md
- FOUND commit 6417f686 (Task 1)
- FOUND commit 5cb9555d (Task 2)
- Ledger counts confirmed on disk: wired 88 / excluded 36 / gap 0

---
*Phase: 172-contextual-invocation-coverage*
*Completed: 2026-06-23*
