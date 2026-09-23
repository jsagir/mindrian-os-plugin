---
phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi
plan: 05
subsystem: mcp
tags: [naming-honesty, mcp, cirs, tool-descriptions, orchestration, whitespace]

requires:
  - phase: 355-01
    provides: "tests/helpers/hygiene-355.cjs (scrubVendorKey, installNetGuard, makeChecker), tests/run-all-355.sh skeleton"
provides:
  - "tests/test-355-naming-honesty.cjs: the D-25 fixture gate for scout-hsi and whitespace_scan (18 assertions), driven against the real registered handler/description via a local capture-server idiom"
  - "scout-hsi (lib/mcp/tool-router.cjs orchestration tool): description sentence and NOT EXECUTED banner both say 'reference only, no compute; run `/mos:scout hsi` in Claude Code' (D-23)"
  - "whitespace_scan (lib/mcp/tools/sensors.cjs): description leads with 'Returns open questions and unsupported claims. This is NOT the `/mos:whitespace` HSI engine; run it in Claude Code.' (D-24)"
affects: [355-27]

tech-stack:
  added: []
  patterns:
    - "Naming-honesty fixture gate: register the real MCP tool module against a local capture-server (extends fixture-room-354.cjs's captureToolServer idiom to also retain the description string) and assert on both the invoked handler's ground-truth output AND the registered description string, never on source text alone"
    - "Module-private Set membership (no _test export) pinned via a source-text regex extraction, the same Group-C rationale test-276-room-content-honesty.cjs already established for an unobservable-over-the-wire literal"

key-files:
  created:
    - tests/test-355-naming-honesty.cjs
  modified:
    - lib/mcp/tool-router.cjs
    - lib/mcp/tools/sensors.cjs

key-decisions:
  - "scout-hsi's honest sentence was ADDED to the orchestration tool description rather than replacing the existing scout-family sentence: the existing sentence already covers the whole scout-* family accurately (\"only return the scout reference plus current room context\"), so the fix is one net-new scout-hsi-specific clause, not a rewrite of prose that was already true for the other five scout commands"
  - "The NOT EXECUTED banner gained a scout-hsi-specific second line (command === 'scout-hsi' branch) rather than rewording the shared banner used by every UNIMPLEMENTED_MUTATING_ORCHESTRATION member: scout-hsi is uniquely compute-shaped among that set (a scout intelligence command, not merely a declared-but-unimplemented room mutation like rooms-new), so only it needed the extra sentence"
  - "whitespace_scan's dropped clause was \"the two shipped Phase 109-05 insight primitives closest to 'whitespace' (a gap not yet filled)\" -- kept the accurate primitive-naming half (findOpenQuestions/findUnsupportedClaims) and cut only the 'closest to whitespace' framing, since that was the part reading as a claim of BEING the whitespace/HSI engine rather than merely being adjacent to the word"
  - "data/mcp-tool-connectors.json and data/connector-registry.json were left untouched: the whitespace_scan row's hitl_why ('Pure read: navigation.cjs findOpenQuestions + findUnsupportedClaims through the chokepoint, no fork.') was already accurate and made no engine claim, so D-24's conditional regenerate step did not fire"
  - "Read-only Theo mirror check (~/Theo/src grep for scout-hsi/whitespace_scan) came back empty: neither description is mirrored on the Theo side, so no 355-27 outbound-note item was recorded"

patterns-established:
  - "Naming-honesty test structure: ground-truth handler invocation (banner text) + registered description string (never parsed from raw source) + a source-text pin only for module-private literals with no test export + the check-tool-honesty.cjs --report sweep as the coarse secondary signal, D-25's fixture test as the real gate"

requirements-completed: [HIPS-03]

duration: 40min
completed: 2026-09-23
---

# Phase 355 Plan 05: Naming Honesty (scout-hsi, whitespace_scan) Summary

**scout-hsi's description and NOT EXECUTED banner, and MCP whitespace_scan's description, now say what each surface actually does (reference-only vs. open-questions/unsupported-claims), with both names unchanged and a new 18-assertion fixture test as the real gate.**

## Performance

- **Duration:** 40 min
- **Started:** 2026-09-23T21:50:00Z (approx)
- **Completed:** 2026-09-23T22:30:00Z (approx)
- **Tasks:** 2 completed (Task 1 is `tdd="true"`: RED then GREEN)
- **Files modified:** 1 created, 2 modified

## Accomplishments
- `tests/test-355-naming-honesty.cjs` ships (18 assertions): registers the real `orchestration` tool from `lib/mcp/tool-router.cjs` and the real `whitespace_scan` tool from `lib/mcp/tools/sensors.cjs` against a local capture-server (a description-preserving extension of `tests/helpers/fixture-room-354.cjs`'s `captureToolServer` idiom), invokes the genuine `scout-hsi` handler against a hermetic tmp room, and asserts: the NOT EXECUTED banner plus the honest wording plus the real CLI pointer; zero `.hsi-results.json` written; `'scout-hsi'` still a member of the module-private `UNIMPLEMENTED_MUTATING_ORCHESTRATION` Set (source-text pin, no `_test` export exists); the orchestration description's scout-hsi sentence carries the honest wording; `whitespace_scan` still registered under its exact name; its description leads with the honest sentence and disclaims the HSI engine; neither description makes a compute/run/scan-shaped HSI-or-whitespace-engine claim outside its own disclaiming sentence; `check-tool-honesty.cjs --report` carries no non-`[OK]` finding line naming either surface; zero network reach across the whole run
- `lib/mcp/tool-router.cjs`: the orchestration tool's description gained one net-new sentence naming scout-hsi specifically ("scout-hsi: reference only, no compute; run `/mos:scout hsi` in Claude Code."), cited to Phase 355 D-23 in an adjacent code comment; the shared NOT EXECUTED banner gained a scout-hsi-only second line carrying the identical wording. `UNIMPLEMENTED_MUTATING_ORCHESTRATION` membership, the command id, and every other description byte are unchanged; scout-hsi is not wired to `hsiEngine.runTier1`
- `lib/mcp/tools/sensors.cjs`: `whitespace_scan`'s description now leads with "Returns open questions and unsupported claims. This is NOT the `/mos:whitespace` HSI engine; run it in Claude Code." and drops the "closest to 'whitespace' (a gap not yet filled)" clause; the tool name and handler are byte-unchanged
- All four CIRS gates exit 0 after the edit: `build-connector-registry --check`, `build-orchestration-projection --check`, `check-shape-declaration --check` (advisory WARN only, the same pre-existing 53-conflict baseline this plan's edits did not touch), `check-render-coverage --check`
- `bash tests/run-all-355.sh`: `PASS=23 FAIL=3 SKIP=11` (up from 355-04's `PASS=20 FAIL=3 SKIP=11`; the 3 FAILs are the same pre-existing documented failures in `deferred-items.md`, none touching a file this plan created or modified)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED fixture gate for the two misleading surfaces (D-25, D-26)** - `33c3b7b13` (test)
2. **Task 2: Make the two descriptions true, keep both names, keep CIRS gates green (D-23, D-24, D-26)** - `f2314ec97` (fix)

**Plan metadata:** committed separately below (docs: complete plan)

_Note: Task 1 is a TDD task (RED, then Task 2 GREENs it)._

## Files Created/Modified
- `tests/test-355-naming-honesty.cjs` - the D-25 fixture gate: 18 assertions covering banner ground truth, description wording, no-rename pins, and the check-tool-honesty secondary sweep
- `lib/mcp/tool-router.cjs` - orchestration tool description + NOT EXECUTED banner both carry scout-hsi's honest "reference only, no compute" wording (D-23)
- `lib/mcp/tools/sensors.cjs` - whitespace_scan description leads with the honest sentence and disclaims the HSI engine (D-24)

## Decisions Made
See key-decisions in frontmatter for the four implementation calls (additive sentence vs. rewrite for the orchestration description, scout-hsi-only banner branch, which whitespace_scan clause to cut, and why the connector data files stayed untouched).

## Deviations from Plan

### Auto-fixed Issues

None - both tasks' action steps were followed as written. No Rule 1/2/3 auto-fixes were needed.

### Scope-boundary items (documented, not auto-fixed)

**1. [Documented, no functional impact] A transient `build-connector-registry --check` FAIL in one `tests/run-all-355.sh` sweep, not reproducible standalone**
- **Found during:** Post-Task-2 verification, one of several `bash tests/run-all-355.sh` runs
- **Issue:** A single run showed `PASS=22 FAIL=4`, with `structural: build-connector-registry --check: FAILED` as the extra FAIL beyond the 3 documented pre-existing ones. Re-running `node scripts/build-connector-registry.cjs --check` standalone immediately after returned `OK` (exit 0), and a clean re-run of the full `tests/run-all-355.sh` sweep returned to `PASS=23 FAIL=3` with no `build-connector-registry` failure.
- **Why not fixed:** `git status --short` at that moment showed `data/connector-registry.json` staged (`M `, not ` M`) by a concurrent peer session (Phase 361's `/mos:dominant-designs` work landing `commands/dominant-designs.md`, `data/brain-orchestration-projection.json`, `data/dispatch-framework-map.json` in the same window) -- a mid-write race in the shared tree, not a defect this plan's own files caused. Neither `lib/mcp/tool-router.cjs` nor `lib/mcp/tools/sensors.cjs` touches `data/connector-registry.json`, and this plan's own `data/mcp-tool-connectors.json`/`data/connector-registry.json` conditional-regenerate step never fired (hitl_why was already accurate).
- **Files modified:** none (transient, self-resolved)
- **Verification:** two subsequent clean standalone runs of `node scripts/build-connector-registry.cjs --check` and two subsequent clean full `tests/run-all-355.sh` sweeps both returned exit 0 / `PASS=23 FAIL=3`
- **Committed in:** n/a (nothing to commit; documented here per the shared_tree_rules briefing)

---

**Total deviations:** 0 auto-fixed; 1 documented transient shared-tree observation (no functional impact, self-resolved, confirmed not caused by this plan's files).
**Impact on plan:** None on this plan's own deliverables - `node tests/test-355-naming-honesty.cjs` (18/18 PASS), `build-connector-registry --check`, `build-orchestration-projection --check`, `check-shape-declaration --check`, and `check-render-coverage --check` all pass cleanly and consistently when run standalone or as part of a clean `tests/run-all-355.sh` sweep.

## Issues Encountered

None beyond the transient shared-tree race documented above and the 3 pre-existing `tests/run-all-355.sh` no-regression-leg failures already logged in `deferred-items.md` by 355-01 (Phase 356's own em-dash guard on its own file, an `@huggingface/transformers` version gap in `272-cache-probe.test.cjs`, `PB8-03` in `part8-egress-guard.cjs`) - none of the three touches a file this plan created or modified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `scout-hsi` and `whitespace_scan` now say what they do on every surface (Desktop, Cowork, CLI) that reads the MCP tool description or the orchestration banner; the honesty fix is complete and gated by `tests/test-355-naming-honesty.cjs`, not merely by `check-tool-honesty.cjs`'s advisory write-claim scan
- No outbound Theo note needed for 355-27: the read-only `~/Theo/src` grep for `scout-hsi`/`whitespace_scan` came back empty, so neither description is mirrored on the Theo side
- No blocker carried forward from this plan; the pre-existing `tests/run-all-355.sh` failures logged in `deferred-items.md` remain exactly as 355-04 left them, untouched by this plan's files. The one transient `build-connector-registry --check` FAIL observed during verification was a shared-tree race with a concurrent Phase 361 session, not a regression from this plan (confirmed self-resolved on every subsequent clean run)

---
*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Completed: 2026-09-23*

## Self-Check: PASSED

All 3 created/modified files verified present on disk
(`tests/test-355-naming-honesty.cjs`, `lib/mcp/tool-router.cjs`,
`lib/mcp/tools/sensors.cjs`); both commits (`33c3b7b13`, `f2314ec97`)
verified present in `git log`.
