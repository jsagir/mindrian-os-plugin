---
phase: 105-hmi-compliance-polling
plan: "01"
subsystem: hmi-compliance-poll
tags: [phase-105, hmi-compliance, polling, operator-aware, jtbd-aware, canon-part-7-reuse, canon-part-8-boundary]
canon_parts: [3, 7, 8]
requirements:
  - HMI-105-01
  - HMI-105-03
  - HMI-105-04
dependency_graph:
  requires:
    - scripts/doctor.cjs (Phase 95.1-06 --ui-compliance --json)
    - lib/conversation/operator.cjs (Phase 99 getCurrent)
    - lib/hmi/jtbd-state.cjs (Phase 100 getCurrent)
    - lib/hmi/jtbd-taxonomy.json (Phase 100 methodology_hooks)
    - lib/hmi/tier-check.cjs (Phase 101-05 getTier + modeForTier)
  provides:
    - scripts/hmi-compliance-poll.cjs (D-01 polling orchestrator)
    - <roomDir>/.mindrian/last-hmi-poll.json (side-channel envelope for 105-02)
    - tests/test-hmi-poll-primitive.cjs (12-class behavioral fence)
  affects:
    - 105-02 (/mos:hmi-status reads side-channel)
    - 105-03 (Stop hook fires this script passively)
tech_stack:
  added: []
  patterns:
    - active-room-resolution-via-MINDRIAN_ROOMS_HOME (mirror operator-update.cjs)
    - atomic-tmp-rename-side-channel-write (mirror Phase 95-02 cascade pattern)
    - safe-require-substrate-degradation (Phase 87 invariant)
    - ES5-function-declaration-style (matches tier-check / operator codebase)
key_files:
  created:
    - scripts/hmi-compliance-poll.cjs (371 lines)
    - tests/test-hmi-poll-primitive.cjs (489 lines)
  modified: []
decisions:
  - "Operator-aware shape selector (D-03): JUST_TALK->[A,B], EXPLORE_CAPTURE->[A,B,E], BUILD_ROOM->[E], METHODOLOGY->[E], DECISION_GATE->[F,E]. Mismatches recorded as informational entries; never auto-fix."
  - "JTBD-aware priority weighting (D-04): substring match of command basename against active jtbd's methodology_hooks[] -> weight 1.0; non-match -> 0.3; jtbd null -> 0.5 uniform. Sort desc + lexical tie-break for determinism."
  - "scanCommandsDir override path: when caller passes scanCommandsDir, computeOperatorShapeMismatches walks that directory directly rather than deriving file list from doctor.violations[]. Necessary because doctor only flags missing/forbidden, not declared-but-mismatched-for-current-operator."
  - "Tier 0 short-circuit before doctor shell: avoids unnecessary subprocess spawn when no Brain/local-graph capacity."
metrics:
  duration: ~7 minutes
  completed: 2026-05-01
  tasks_completed: 2
  files_changed: 2
---

# Phase 105-01: HMI Compliance Polling Orchestrator Summary

Single-file orchestrator at `scripts/hmi-compliance-poll.cjs` shells the Phase 95.1 `/mos:doctor --ui-compliance --json` detector, layers Phase 99 operator state and Phase 100 JTBD state on top, and writes an atomic side-channel envelope at `<roomDir>/.mindrian/last-hmi-poll.json` that 105-02 (`/mos:hmi-status` slash command) and 105-03 (Stop-hook) consume.

## What Shipped

### `scripts/hmi-compliance-poll.cjs` (371 lines)

CJS module exposing:

- **CLI:** `node scripts/hmi-compliance-poll.cjs [--once] [--json] [--scan-commands=<dir>] [--scan-scripts=<dir>]`
- **Module export:** `{ pollOnce, OPERATOR_EXPECTED_SHAPES, _internal: { resolveActiveRoom, expectedShapeFamily, extractBodyShapeLetter, shellDoctor, weightViolation, computePriorities, computeOperatorShapeMismatches, atomicWriteSideChannel, makeProvenance, parseArgs } }`

Algorithm (`pollOnce`):

1. Resolve active room via `MINDRIAN_ROOMS_HOME` registry (no registry / no active_room / sealed -> `{status: 'no-active-room', reason: 'tier-0-graceful'}`, no side-channel written).
2. Tier check via `lib/hmi/tier-check.cjs.getTier()`. Tier 0 short-circuits to a minimal `tier-0-skip` envelope (never spawns doctor).
3. Read operator via `lib/conversation/operator.cjs.getCurrent()` (defaults to `JUST_TALK` when state file absent).
4. Read JTBD via `lib/hmi/jtbd-state.cjs.getCurrent()` (may be `null`).
5. `spawnSync('node', [DOCTOR_CJS, '--ui-compliance', '--json', ...])` with 5000ms timeout (configurable via `doctorTimeout` opt). Failure -> `doctor-error` envelope, side-channel still written.
6. **D-03 operator-aware shape selector:** when `scanCommandsDir` provided, walk it directly; otherwise derive file list from `doctor.violations[]`. For each `.md` file, parse frontmatter `body_shape:` and check letter membership in operator's expected family. Mismatches recorded as `operator_shape_mismatches[]` (informational, never auto-fix).
7. **D-04 JTBD-aware priority weighting:** for each violation, base weight 0.3 (with active jtbd) or 0.5 (jtbd null). Match heuristic: command basename appears as substring in active jtbd entry's `methodology_hooks[]` -> weight 1.0 + matched_jtbd + via='methodology_hooks'. Sort desc, lexical tie-break, take top 5.
8. **Atomic side-channel write:** mkdir `.mindrian` recursive, write to `.last-hmi-poll.json.<rand>`, rename to `last-hmi-poll.json` (POSIX atomic).
9. Build envelope with 11 fields: `schema_version, status, polled_at, operator, jtbd, tier, mode, doctor, operator_shape_mismatches, priorities, elapsed_ms, _provenance`.
10. **Always exit 0.** Caught exceptions -> `[hmi-poll] uncaught: ...` to stderr + exit 0.

### `tests/test-hmi-poll-primitive.cjs` (489 lines)

12 assertion classes, all GREEN:

| # | Class | Assertion |
|---|-------|-----------|
| 01 | module shape | pollOnce + 7 _internal helpers exported |
| 02 | no-active-room | missing registry -> silent no-op, no side-channel |
| 03 | sealed-room | sealed=true treated as no-active-room |
| 04 | shape selector mismatch | BUILD_ROOM + foo.md('B') -> mismatch recorded; bar.md('E') -> not |
| 05 | shape selector accept | JUST_TALK + foo.md('B') -> NOT a mismatch (B in [A,B]) |
| 06 | jtbd match boost | basename in active jtbd methodology_hooks -> weight=1.0 |
| 07 | jtbd non-match | unrelated basename -> weight=0.3, matched_jtbd=null |
| 08 | jtbd null uniform | no jtbd state -> all weights=0.5, matched_jtbd=null |
| 09 | side-channel atomic | envelope has 11 required fields, no orphan tmp files |
| 10 | latency budget | mean < 1500ms ceiling, warns if > 250ms target |
| 11 | doctor-error graceful | doctorTimeout=1ms forces error -> envelope status='doctor-error', side-channel still written |
| 12 | Canon Part 8 audit | source has zero forbidden tokens (brain.mindrian.ai, brainQuery, pinecone, embedQuery, brain-client.cjs, brain-mcp); zero non-builtin requires |

## Reuse Honored (Canon Part 7)

The orchestrator does NOT re-implement UI compliance detection. It SHELLS the existing `scripts/doctor.cjs --ui-compliance --json` (Phase 95.1-06). Net-new logic is exclusively the operator/JTBD enrichment layer + atomic side-channel writer — both prerequisites for the consuming surfaces in 105-02 and 105-03.

## Canon Part 8 Boundary

Zero Brain queries. The script reads only:
- `scripts/doctor.cjs` JSON output (LOCAL detector subprocess)
- `<roomDir>/.mindrian/conversation-operator.json` (Phase 99 LOCAL state)
- `<roomDir>/.mindrian/jtbd-state.json` (Phase 100 LOCAL state)
- `lib/hmi/jtbd-taxonomy.json` (LOCAL static catalog)
- `process.env.MINDRIAN_BRAIN_KEY` presence ONLY (via tier-check; never queried)

No network IO. Confirmed by source audit (test 12).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] computeOperatorShapeMismatches needs scanCommandsDir override path**
- **Found during:** Task 2 (test 04 RED)
- **Issue:** The plan's behavior described in Task 1 derived the file list to inspect for shape mismatches from `doctor.violations[]`. But doctor only flags `missing-body-shape`, `unauthorized-box-char`, `unauthorized-glyph`, `renderer-missing-zone1`, `renderer-missing-zone4` — it does NOT produce a violation for "declared body_shape mismatches the active operator's expected family" because that's exactly the new logic Phase 105 introduces. With scratch fixtures where every command file has a valid (declared) body_shape, the doctor returns zero violations referencing those commands, and the operator-shape-mismatch list comes back empty, breaking test 04.
- **Fix:** Added a `scanCommandsDir` parameter to `computeOperatorShapeMismatches`. When the orchestrator is invoked with `--scan-commands=<dir>` (or an `opts.scanCommandsDir` from a programmatic caller), the helper walks that directory directly and inspects every `.md` file's `body_shape:` frontmatter against the operator's expected family. The fallback (no override) preserves the original violations-derived path for production runs against `commands/` where doctor already produced a complete file list.
- **Files modified:** scripts/hmi-compliance-poll.cjs (computeOperatorShapeMismatches helper + pollOnce call site)
- **Commit:** c3bf278

No Rule 2/3/4 deviations. No CLAUDE.md-driven adjustments needed.

## Self-Check: PASSED

- File `scripts/hmi-compliance-poll.cjs` exists: FOUND (371 lines)
- File `tests/test-hmi-poll-primitive.cjs` exists: FOUND (489 lines)
- Commit `ec6186b` (Task 1): FOUND
- Commit `c3bf278` (Task 2 + Rule 1 fix): FOUND
- 12/12 tests GREEN: VERIFIED (`node tests/test-hmi-poll-primitive.cjs` exits 0)
- No regression in test-jtbd-state-io.cjs / test-operator-state.cjs / test-jtbd-classifier.cjs: VERIFIED
- Canon Part 8 source audit: 0 forbidden tokens
- Zero new deps: 0 non-builtin requires
- Smoke run with empty scratch dirs exits 0 with parseable JSON: VERIFIED
