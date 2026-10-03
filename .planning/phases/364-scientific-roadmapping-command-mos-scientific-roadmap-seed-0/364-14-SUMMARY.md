---
phase: 364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0
plan: 14
subsystem: scientific-roadmap entry resolver, door, MCP methodology handler
tags: [gap-closure, compose-355, stamped-finding, entry-resolver, verbatim-stamp, eureka-handoff, read-only, tdd, cirs]
requires: [364-04, 364-05, 364-06, 364-07, 364-08]
provides:
  - "A Phase 355 stamped eureka finding is a hypothesis in flight: resolveEntry proposes step 6 and lists it in in_flight with its two ends and its verbatim stamp lines"
  - "renderEntry(entry, {surface}) with cli, cowork and desktop stamp wording from the 355 formatter only"
  - "The door carries in_flight into step 6 and refuses it until it is a limiter row or dismissed with a reason"
  - "The MCP methodology handler passes the detected surface to renderEntry (Desktop prose stamp on Desktop)"
  - "SRM364-22 and SRM364-23 minted and closed with Measured lines"
affects: [364-09, 364-10, 364-11, 364-12, 364-13]
tech-stack:
  added: []
  patterns: ["lazy require of verification-stamp fromNodeProps then formatStampLines; a throw becomes stamp_unreadable", "355 writer used inside the test fixture, nodes before edges"]
key-files:
  created:
    - tests/helpers/fixture-stamped-364.cjs
    - tests/test-364-compose-355.cjs
  modified:
    - lib/core/research-planner/sr-entry.cjs
    - lib/core/research-planner/sr-door.cjs
    - lib/mcp/tool-router.cjs
    - commands/scientific-roadmap.md
    - skills/scientific-roadmap/SKILL.md
    - tests/run-all-364.sh
    - tests/test-364-mcp.cjs
    - .planning/REQUIREMENTS.md
    - .planning/phases/364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0/364-VALIDATION.md
decisions:
  - "A stamped finding is an opportunity row with string verification and backend and a non-empty engine_mode; in flight at candidate, qualified or explored. An explored opportunity without a stamp is in flight as explored_opportunity."
  - "In-flight rows copy named fields only, so the finding's score never reaches the entry or the card."
  - "The eureka handoff needed no code: the registry door already maps Scientific Roadmapping since 364-07; pinned by H1-H4."
metrics:
  tasks: 3 plus the orchestrator Desktop wording fix
  completed: 2026-10-03
---

# Phase 364 Plan 14: Compose with Phases 355 and 355.1 Summary

A finding that a /mos:eureka run or the ambient run filed and stamped now walks into /mos:scientific-roadmap at step 6, on the two ends it depends on, with its verification stamp shown exactly as 355 prints it, never upgraded and never with a score.

PLAN_BASE: 95ef41193 (HEAD at start).

## What was built

- sr-entry.cjs: `in_flight` rows (opportunity_id, source stamped_finding or explored_opportunity, lifecycle, name, depends_on, engine_mode, pws_stage, stamp, stamp_lines, stamp_readable). Stamps are read through `verification-stamp.cjs fromNodeProps` and shown through `verification-stamp-format.cjs formatStampLines`; a throw becomes `stamp_unreadable` with no verified glyph. `hypothesis_in_flight` now holds whenever in_flight is non-empty; `renderEntry(entry, opts)` takes `opts.surface`. No glyph literal, no writer token, no 369 writer-inventory phrase in the module.
- sr-door.cjs: `state.entry.in_flight` carried (stamp lines copied as they are, not through cap); `boundForStage(state, 'sr:6')` returns `{ first_rows, in_flight }` with in-flight ids after the reverse salients; `recordStage` sr:6 refuses with `bound_input_unaddressed:<id>` until each one is a limiter row (source_node_id) or dismissed with a reason; a dismissed non-salient id lands in `discarded` as kind `hypothesis_in_flight`.
- commands/scientific-roadmap.md and its mirror: two body passages (entry gate and bound inputs).
- tests/helpers/fixture-stamped-364.cjs: nine stamped room states filed through `fileStampedOpportunity` (runMode 'ambient', inside BEGIN/COMMIT) and the eureka-perspective shape.
- tests/test-364-compose-355.cjs: S1-S15, H1-H4, B1, Z1 (21 checks, all green); added as the `364 compose 355` leg of run-all-364.sh.

## Seam finding for SRM364-23 (CMP-3)

The 355 lineage names its next framework through one door, `lib/workflow/command-resolver.cjs` (`composeWorkflow`, `commandsForFramework` over `data/command-registry.json framework_index`), used by `eureka-offer.cjs _buildNextSegue` and `chain-recommender.cjs adaptChainToRunInput`. Since 364-07, `commandsForFramework('Scientific Roadmapping')` returns `['/mos:scientific-roadmap']`, so no code was needed. H1-H3 pin the mapping (including a negative: another chain names no scientific-roadmap command); H4 proves no eureka-lineage file carries the slug. No reach, sensor or MCP tool added, no 355 or 355.1 file touched.

## Commits (all verified ancestors of HEAD)

| Sha | Message |
| --- | --- |
| 99edd34b8 | docs(364-14): mint SRM364-22..23 (compose with Phases 355 and 355.1) |
| b662ea9f0 | test(364-14): RED legs for a 355 stamped finding entering at step 6 and the eureka handoff pins |
| 5df121329 | feat(364-14): a 355 stamped finding enters at step 6 with its stamp verbatim, carried into the door (CMP-1, CMP-2) |
| 3a1c9b660 | docs(364-14): /mos:scientific-roadmap tells Larry how a hypothesis in flight enters step 6 (CMP-1, CMP-2) |
| de66c4454 | test(364-14): RED leg for the Desktop stamp wording on the MCP methodology path |
| c9ef39e7f | fix(364-14): MCP methodology scientific-roadmap renders the entry in the real surface wording |
| 3235568f6 | docs(364-14): close SRM364-22..23 on measured proof |

(35a264825 in the range is the peer's Phase 369 commit, not this plan's.) The SUMMARY commit follows this file.

## Regression table (14 Phase 355 / 355.1 eureka and stamp legs, sandboxed HOME)

| Leg | Baseline | After |
| --- | --- | --- |
| test-355-stamp-truth | 0 | 0 |
| test-355-stamp-format | 0 | 0 |
| test-355-stamp-coverage | 0 | 0 |
| test-355-filing | 0 | 0 |
| test-355-no-decimal | 0 | 0 |
| test-355-tri-polar | 0 | 0 |
| test-355-sens13-fire-once | 0 | 0 |
| test-355-part8-egress | 0 | 0 |
| test-3551-ambient-run | 0 | 0 |
| test-3551-surfacing | 0 | 0 |
| test-3551-part8-egress | 0 | 0 |
| test-213-eureka-offer | 0 | 0 |
| test-366-eureka-filing | 0 | 0 |
| test-seed103-eureka-perspective | 0 | 0 |

`bash tests/run-all-364.sh`: PASSED=58 FAILED=0 SKIPPED=4 KNOWN=3 (`364 compose 355: PASSED`). The 4 skips are 364-09..10 legs not yet written plus the opt-in live smoke; the 3 knowns are the pre-existing ledger reds. Also green: test-364-sr-entry (37), sr-door (70), mcp (31), filing (49), command-contract (14), registry-gates (11), entry-points (16), test-205-surface-fence, test-369-writer-inventory; build-skill-mirrors, build-command-registry, check-render-coverage and check-cirs-declaration all exit 0.

## Deviations from Plan

### Orchestrator addition (recorded as instructed)

**1. [Orchestrator-directed] Desktop stamp wording on the MCP methodology path**
- **Issue:** `scientificRoadmapStatus` called `renderEntry(entry)` with no surface, so Desktop got the cli stamp form instead of the Desktop prose form (the follow-on the plan had meant to record).
- **Fix:** `scientificRoadmapStatus(roomDir, surface)` passes the detected surface (the 5th argument of `registerRouterTools`, as used elsewhere in the router) to `renderEntry(entry, { surface })`. Test-first: leg M11 added to `tests/test-364-mcp.cjs` (RED de66c4454, desktop shows the formatter's desktop lines and no verified glyph; cli and cowork show the cli lines; the finding's score never appears), then the fix.
- **Files:** lib/mcp/tool-router.cjs, tests/test-364-mcp.cjs. **Commits:** de66c4454 (RED), c9ef39e7f (fix). tool-router.cjs was clean and not peer-owned when edited.

### Plan-level notes

- RED run: S8, S11 and S15 initially passed vacuously; S8 and S15 were tightened before the RED commit (S8 requires an in-flight row, S15 requires sr-entry to read stamps through fromNodeProps and formatStampLines) so only S11 (a regression guard by design) passes at RED.
- tests/test-364-mcp.cjs and lib/mcp/tool-router.cjs are outside the plan's files_modified; both edits come from the orchestrator instruction above.

Otherwise: plan executed as written. No auth gates.

## Follow-ons

- A1 (unchanged, outside lib/core): `lib/mcp/brain-router.cjs KNOWN_METHODOLOGIES` still drops a `scientific-roadmap` slug on the MCP brain route; it bounds SRM364-23 on that one route.
- The plan's former follow-on (tool-router passing no surface) is closed by c9ef39e7f. On cli stdio the detected surface is `cli`, so the cli form shows there; Desktop shows the prose form.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path, file access or schema change; resolver and renderer stay read-only (room.db bytes, counts, lifecycle and review_status identical before and after, S15).

## Self-Check: PASSED

Created files exist (tests/helpers/fixture-stamped-364.cjs, tests/test-364-compose-355.cjs); all seven sha above are ancestors of HEAD; STATE.md and ROADMAP.md untouched; no Phase 355 or 355.1 file in any 364-14 commit (path audit over 95ef41193..HEAD minus the peer's 35a264825).
