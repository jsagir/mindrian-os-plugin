---
phase: 216-eureka-user-command
plan: 05
subsystem: eureka
tags: [eureka, gap-closure, field-contract, regression-guard, room-native]

# Dependency graph
requires:
  - phase: 216-01
    provides: "buildRoomNativeSubstrate: the room-native adapter whose section derivation this plan fixes"
  - phase: 216-02
    provides: "scripts/eureka-command.cjs dispatcher + --pairs room runner mode (the real path re-run for closing acceptance)"
  - phase: 216-04
    provides: "the navigator-logged gap (verdict verbatim: 'Log as gap-closure') this plan closes"
provides:
  - "sectionFor(row, props) in room-native-substrate.cjs: props.section, else source_path first path segment (non-system paths only), else the honest 'unknown'; the row.type fallback is REMOVED"
  - "tests/test-216-field-contract.cjs: the permanent room-native field-contract regression guard (the 215-05 precedent applied to the 216 substrate)"
  - "tests/run-all-216.sh leg 10 ('216-05 field contract'); aggregate now PASS=10 FAIL=0 SKIP=0"
  - "deriveSharedProblems ADDITIVE export on scripts/eureka-portfolio-report.cjs (the 215-04 additive-export precedent)"
affects: [eureka, 216 phase-close]
status: complete
requirements: [216-R1, 216-R6]

key-files:
  created:
    - tests/test-216-field-contract.cjs
  modified:
    - lib/core/eureka/room-native-substrate.cjs
    - tests/test-216-room-substrate.cjs
    - tests/run-all-216.sh
    - scripts/eureka-portfolio-report.cjs

key-decisions:
  - "section derivation chain: props.section, else source_path first path segment when the path contains no ':' (system-authored rows fall through), else the literal 'unknown' - the same honest default the scorer's techFor/loadGraph already use"
  - "The derivation NEVER reads row.type (the ICM node-type column); the HARD RULE is stated in the sectionFor comment block citing '216-05 field contract'"
  - "Root-level artifact edge case (no '/' and no ':' derives the bare filename as section) acknowledged in the comment, no extra code path - not present in a normal room layout"
  - "deriveSharedProblems exported additively so the guard drives the REAL fallback, not a test re-implementation"

metrics:
  duration: "~8 minutes"
  completed: "2026-07-11"
  tasks: 3
  commits: 3
---

# Phase 216 Plan 05: Room-Native Section Field Gap Closure Summary

**One-liner:** buildRoomNativeSubstrate now derives `section` from real domain signal (props.section, else the source_path section-folder slug, else the honest 'unknown') instead of the ICM type column, so real-room Opportunity Statements name real domains - with a permanent field-contract guard wired into run-all-216.

## The before/after proof (rank-1 statement, ador-ip-test, legal-ip x opportunity-bank pair)

**Before (216-04 gap, novel_application clause verbatim):**

> Section x Section approach to a Section x Section cross-domain bridge

(The full rank-1 text read "...creates a Section x Section approach to a Section x Section cross-domain bridge that addresses the a Section x Section cross-domain bridge gap neither side closes alone, for tech-transfer / portfolio operators triaging a Section x Section cross-domain bridge assets..." - 25 of 25 statements carried the leak; 100 exact-substring occurrences in portfolio-report.json.)

**After (regenerated 2026-07-11, novel_application clause verbatim):**

> legal-ip x opportunity-bank approach to a legal-ip x opportunity-bank cross-domain bridge

(Full rank-1 text: "Combining legal-ip (unmet need: no strategic home for unclassified problem for legal-ip) and opportunity-bank (unmet need: no strategic home for unclassified problem for opportunity-bank) creates a legal-ip x opportunity-bank approach to a legal-ip x opportunity-bank cross-domain bridge that addresses the a legal-ip x opportunity-bank cross-domain bridge gap neither side closes alone, for tech-transfer / portfolio operators triaging a legal-ip x opportunity-bank cross-domain bridge assets. Key risks: both sides without a strategic home. Next steps: map to a named district/tier-1 problem owner. Estimated potential: tier-2 (develop). Score: rank 1 (composite 0.55)")

Zero occurrences of the exact substring 'Section x Section' remain in either portfolio-report.json or portfolio-report.md; 25 statements regenerated; real slugs named adjacent to the ' x ' bridge token.

## What was done

**Task 1 (TDD: commits `52420187` test RED, `6f5ebf66` fix GREEN).** Added `sectionFor(row, props)` next to `trimmedString` in lib/core/eureka/room-native-substrate.cjs and replaced the section block (formerly lines 139-145) with a call to it. The chain: (1) `trimmedString(props.section)`; (2) else the source_path substring before the first '/' (the whole string when no '/'), only when source_path is a non-empty string containing NO ':' (keeps 'system:section-anchor'/'system:default'/'fixture://' rows out); (3) else the literal 'unknown'. The HARD RULE comment states the derivation never reads row.type and cites the 216-04 navigator verdict and '216-05 field contract'. The SELECT at line 101 is unchanged (type still feeds the injected canonicalId). tests/test-216-room-substrate.cjs: behavior 9 re-pinned (`t.section === 'unknown'`, never row.type) and new behavior 12 added (first-segment 'legal-ip/notes.md' -> 'legal-ip'; vintage Section anchor bare-slug 'business-model' -> 'business-model', explicitly !== 'Section'). RED run confirmed 4 failures against the old fallback before the fix; GREEN run: 36 assertions passed (up from 33).

**Task 2 (commit `492ce4da` test).** Created tests/test-216-field-contract.cjs (196 lines, mirroring tests/test-215-field-contract.cjs): hermetic ador-vintage fixture (two type='Section' anchors with props {name,label} and bare-slug source_path, four Artifacts with props.section + slug/filename source_path, BELONGS_TO edges so anchors dominate degree, one memory_event at 'system:default'). Four assertion stages: (1) source-contract documentation (the anchor's type column IS the literal 'Section'); (2) adapter per-entry checks (anchor -> 'business-model', Artifact -> its props.section, memory_event -> 'unknown'); (3) the ICM type-leak sweep (no entry's section equals its own type value nor any of 'Section'/'Artifact'/'memory_event'); (4) the REAL deriveSharedProblems fallback ('a business-model x competitive-analysis cross-domain bridge') + the REAL buildOpportunityStatement emitter (st.text contains zero 'Section x Section', names the real slugs). deriveSharedProblems added additively to the runner's module.exports. run-all-216.sh gains leg 10 appended after leg 9, nothing reordered.

**Task 3 (no files).** Full regression sweep + real-room closing acceptance, in the plan's action order: three suites, then `node scripts/eureka-command.cjs /home/jsagi/MindrianRooms/ador-ip-test run --top 25` (the real path, no offline preload), then `report` (re-render from disk clean), then the node -e acceptance assertion.

## Verification (all green)

| Check | Result |
|---|---|
| `node tests/test-216-room-substrate.cjs` | 36 assertions passed, exit 0 |
| `node tests/test-216-field-contract.cjs` | 11 assertions passed, exit 0 |
| `bash tests/run-all-216.sh` | Phase 216: PASS=10 FAIL=0 SKIP=0, exit 0 |
| `bash tests/run-all-215.sh` | Phase 215: PASS=8 FAIL=0 SKIP=0, exit 0 (runner export additive, unregressed) |
| `bash tests/run-all-211.sh` | Phase 211: PASS=10 FAIL=0 SKIP=0, exit 0 |
| Real-room scan (`run --top 25`) | 2080 pairs scored, 25 ranked, 25 statements, 59 tail techs, mode room/live, exit 0 |
| `report` re-render | exit 0 |
| node -e closing acceptance | "acceptance clean: zero Section x Section, real slugs named", exit 0 |
| `grep "section = row.type\|section: row.type"` on the adapter | no matches |
| em-dash grep over all five touched files | no matches |

## Deviations from Plan

None - plan executed exactly as written. All plan-cited line numbers, fixture shapes, and assertion strings matched the real code. The root-level-artifact edge case flagged by the plan-checker is acknowledged as a one-line comment inside sectionFor (no extra code path, per instruction).

## Gap resolution

The navigator's "Log as gap-closure" verdict from 216-04 (recorded verbatim in 216-04-SUMMARY.md) is RESOLVED by this plan: the single logged gap blocking the 216-04 checkpoint is closed at its root (the section field's assumed meaning and actual source now agree, the 215-05 pattern applied to the room-native path), and the regression can never silently return (leg 10 runs on every future `bash tests/run-all-216.sh`). Phase 216 close-out proceeds through the normal gate.

## Self-Check: PASSED

- tests/test-216-field-contract.cjs exists on disk
- Commits 52420187, 6f5ebf66, 492ce4da all present in git log
- All verification commands re-confirmed exit 0 at execution time
