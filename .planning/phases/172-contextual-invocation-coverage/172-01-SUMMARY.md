---
phase: 172-contextual-invocation-coverage
plan: 01
subsystem: testing
tags: [cirs, connector-spine, coverage-ledger, canon-part-11, gate-substrate]

# Dependency graph
requires:
  - phase: 143.3-connector-spine-and-intelligence-orchestrator
    provides: the connector: frontmatter contract + scripts/build-connector-registry.cjs generator + --check tripwire + data/connector-registry.json
  - phase: 157-brain-orchestration-graph-and-methodology-tiers
    provides: data/orchestration-unwired-allowlist.json (the wired-XOR-allowlisted ledger idiom mirrored here) + methodology_tier boundary-keeper
provides:
  - "The R1 two-state EXCLUDE mechanism: connector:{excluded:true,reason} is a first-class EXCLUDED surface, never dark (Canon Part 11 R1)"
  - "coverageReport() + classifySurface(): classify every command/skill/agent surface as wired/excluded/gap"
  - "serializeLedger() + data/connector-coverage-ledger.json: the generated wired-XOR-excluded coverage ledger (the R9 gate source of truth)"
  - "--check ledger STALE byte-check + warn-only gap report (D-172-e step 1; hard-FAIL deferred to Wave 7 / Plan 172-13)"
  - "tests/test-connector-coverage-ledger.cjs + tests/run-all-172.sh: the XOR-invariant + EXCLUDE-state test fence"
affects: [172-13 (RETRO-07 hard-FAIL flip), every later 172 wave that reads the coverage ledger, CIRS R9 gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "wired-XOR-excluded coverage ledger (mirrors the Phase 157 wired-XOR-allowlisted orchestration ledger idiom)"
    - "fail-closed build error on excluded:true without a reason (D-172-a no surface dark by accident)"
    - "warn-then-FAIL gate rollout (this plan lands WARN+report; Wave 7 / Plan 172-13 flips to hard-FAIL)"

key-files:
  created:
    - data/connector-coverage-ledger.json
    - tests/test-connector-coverage-ledger.cjs
    - tests/run-all-172.sh
  modified:
    - scripts/build-connector-registry.cjs
    - docs/CONNECTOR-CONTRACT.md

key-decisions:
  - "EXCLUDED is a first-class terminal state, NOT dark: an excluded surface is never counted as a gap (R1)"
  - "A missing reason on excluded:true is a BUILD ERROR on both the default run and --check (fail-closed, D-172-a)"
  - "Gaps WARN+report only this stage; --check stays exit 0 on dark surfaces (hard-FAIL is Wave 7 / Plan 172-13, INV-10 / D-172-e)"
  - "classifySurface() is the single shared classifier; coverageReport() walks listSourceFiles() so the XOR invariant holds by construction"

patterns-established:
  - "Coverage ledger: {generated_note, counts:{wired,excluded,gap}, surfaces:[{surface,source,state}]}, sorted, 2-space JSON + trailing newline, byte-checked for staleness"
  - "Test fence asserts count parity (surfaces.length === source-file count) AND the XOR sum (wired+excluded+gap === total)"

requirements-completed: [INV-01, INV-03, INV-10]

# Metrics
duration: 18min
completed: 2026-06-23
---

# Phase 172 Plan 01: CIRS R1/R2 Gate Substrate Summary

**Teaches the connector generator to recognize a first-class EXCLUDED surface and emits data/connector-coverage-ledger.json, the wired-XOR-excluded ledger that is the RETRO-07/R9 coverage gate's source of truth (warn-only this stage).**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-23
- **Completed:** 2026-06-23
- **Tasks:** 3 of 3
- **Files modified:** 2 modified, 3 created

## Accomplishments

- **Task 1 (commit 8471aa3b):** Added the EXCLUDE code path to `scripts/build-connector-registry.cjs`. `buildRegistry()` now skips a connector whose `excluded === true` (it never pushes a wired entry). Added `classifySurface(src)` (the pure per-surface classifier) and the exported `coverageReport()` which walks `listSourceFiles()` and classifies EVERY surface as `wired` / `excluded` / `gap`, returning `{surfaces:[{surface,source,state}], counts:{wired,excluded,gap}, errors}`. A `excluded:true` surface with no `reason` produces a build error. The frozen `REACH_IDS` / `POSTURE_IDS` imports and the `MAX_K` / `DIAL_REACH_K` doctrine were untouched (zero diff to `sensor-types.cjs`).
- **Task 2 (commit 0e6fe19c):** Added `serializeLedger(report)` and wired it into `main()`. The default run writes `data/connector-coverage-ledger.json` alongside the registry; the `--check` branch regenerates it in memory and reports a STALE error (exit 1) on byte drift, then emits a STDERR WARN naming the gap surfaces WITHOUT exiting non-zero (the warn+report stage of D-172-e step 1). Committed the clean generated ledger: **62 wired, 0 excluded, 62 gap** across **124 surfaces** (101 commands + 14 skills + 9 agents).
- **Task 3 (commit 6a0b52b0):** Wrote `tests/test-connector-coverage-ledger.cjs` (the four behaviors: count parity, excluded-with-reason classifies as excluded, excluded-without-reason rejected, XOR invariant) plus a STALE byte-check and a Part 8 planted-secret tripwire. Added `tests/run-all-172.sh` phase aggregator (5/5). Added the `excluded` + `reason` sub-keys to the `docs/CONNECTOR-CONTRACT.md` section-2 table plus the Canon Part 11 R1 two-states note.

## Verification

| Check | Result |
|-------|--------|
| `node scripts/build-connector-registry.cjs --check` exit | 0 (prints `connector-registry: OK`; gap WARN present on stderr) |
| `node tests/test-connector-coverage-ledger.cjs` exit | 0 (13 assertions PASS) |
| `bash tests/run-all-172.sh` | 5/5 PASSED |
| `coverageReport()` shape | `{surfaces[124], counts:{wired:62,excluded:0,gap:62}}` |
| XOR invariant | 62 + 0 + 62 === 124 (every surface in exactly one bucket) |
| Frozen-bank diff (`sensor-types.cjs`) | 0 lines changed (no 7th reach, no 4th posture, MAX_K/DIAL_REACH_K untouched) |

## Frozen-Invariant Compliance

- No 7th reach minted, no new edge type, no new node type, no new Brain wire opened.
- `MAX_K=3`, `DIAL_REACH_K=6`, the 0.70/0.15 RECOMMENDED gate, the F.1 keyboard contract: untouched (not in scope of this plan).
- Gate rollout (INV-10 / D-172-e): this plan lands RETRO-07 coverage as WARN+report only. `--check` still exits 0 on dark surfaces. The hard-FAIL flip is Wave-7 / Plan 172-13 -- deliberately NOT done here.
- Canon Part 8: the ledger carries ONLY generic machinery metadata `{surface, source, state}` and an author-written exclude `reason` (never user content). The Part 8 test tripwire asserts no `room/` path and no email pattern in any ledger value.

## Deviations from Plan

None - plan executed exactly as written. Note: the plan describes Task 1 and Task 2 as separate atomic commits; because both edit the single file `scripts/build-connector-registry.cjs` (the exclude code path and the ledger-emission wiring are intertwined in `main()`), the generator code landed in one commit (8471aa3b, Task 1 + Task 2 code) and the generated data artifact in a second commit (0e6fe19c, Task 2 ledger), preserving atomic-per-logical-unit history without an artificial mid-file split.

## Known Stubs

None. The 62 `gap` surfaces in the ledger are NOT stubs - they are the honest, measured dark-surface count this plan exists to make legible. Wiring them is the work of later 172 waves; the warn-only gate makes them visible without blocking.

## Self-Check: PASSED
