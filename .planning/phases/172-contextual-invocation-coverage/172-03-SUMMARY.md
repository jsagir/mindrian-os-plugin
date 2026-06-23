---
phase: 172-contextual-invocation-coverage
plan: 03
subsystem: orchestration-projection
tags: [cirs, canon-part-11, r5, r8, counterpart-node, command-grained-coverage, promotion-path]

# Dependency graph
requires:
  - phase: 157-brain-orchestration-graph-and-methodology-tiers
    provides: scripts/build-orchestration-projection.cjs (generator + --check 3-mode tripwire) + data/brain-orchestration-projection.json + methodology_tier boundary-keeper + the wired-XOR-allowlisted ledger idiom mirrored here at the command grain
  - phase: 172-01-cirs-r1-r2-gate-substrate
    provides: the wired-XOR-excluded coverage-ledger idiom + the warn-then-FAIL gate-rollout pattern (D-172-e) this plan mirrors at the projection/command grain
  - phase: 171-methodology-ingest
    provides: lib/core/methodology-ingest.cjs ingestPlan (the 6-step promotion pipeline the R8 path rides) + commands/ingest-methodology.md
provides:
  - "The command-grained coverage gate: validateProjection() returns command_gaps[]; a bare command (no reach_id, not excluded) surfaces as a gap instead of silently shipping (the INVERSION of the old UN-RANKED early-continue, INV-04)"
  - "classifyCommandNode() + commandCoverageReport(): the ranked|excluded|gap XOR partition over every command node"
  - "data/orchestration-command-ledger.json: the GENERATED command-grained wired-XOR-excluded ledger (the R5 gate source of truth for command counterparts), STALE-byte-checked in --check"
  - "EXCLUDED_COMMANDS: the authoritative utility-command exclusion table (18 commands, each with a documented reason; Canon Part 11 R1 first-class terminal state)"
  - "docs/ORCHESTRATION-PROJECTION-CONTRACT.md section 4e: the mindrian-operation counterpart node (INV-05) + the dark -> counterpart -> pws frontier promotion path (R8/INV-06)"
  - "tests/test-orchestration-counterpart-coverage.cjs: the four behaviors + the doc fence + the Part 8 boundary heuristic (registered in tests/run-all-172.sh)"
affects: [172-13 (the hard-FAIL flip on command_gaps), every later 172 wave that wires a dark command or reads the command ledger, CIRS R5 counterpart gate, R8 promotion path]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "command-grained wired-XOR-excluded ledger (mirrors the Phase 157 framework-grained wired-XOR-allowlisted orchestration ledger idiom at the command grain)"
    - "inverted early-continue: a bare command is collected into command_gaps rather than silently skipped (D-172 inversion of build-orchestration-projection.cjs UN-RANKED early-continue)"
    - "GENERATED exclusion authority: EXCLUDED_COMMANDS lives in the generator source (BOG-03 derived-never-hand-authored); the ledger file is regenerated, never hand-edited"
    - "warn-then-FAIL gate rollout (this plan lands command_gaps WARN-only; the hard-FAIL flip is Plan 172-13)"

key-files:
  created:
    - data/orchestration-command-ledger.json
    - tests/test-orchestration-counterpart-coverage.cjs
  modified:
    - scripts/build-orchestration-projection.cjs
    - docs/ORCHESTRATION-PROJECTION-CONTRACT.md
    - tests/run-all-172.sh

key-decisions:
  - "EXCLUDED_COMMANDS is the GENERATED-ledger's authoritative source: because the command ledger is regenerated (never hand-authored, BOG-03), the EXCLUDED dispositions live in the generator source as a slug->reason table, not in the data file"
  - "command_gaps is WARN-only this stage (D-172-e): runCheck prints the gaps to stderr but does NOT exit non-zero; STALE/UN-WIRED/UN-RANKED stay hard failures; the hard-FAIL flip is Plan 172-13"
  - "the warranted-dark thinking commands (rs-* family, causal, act, ...) stay gaps (to be wired in Wave 2/3), NOT excluded; only the utility commands (doctor/dashboard/setup/help/...) are excluded-with-reason"
  - "promotion is metadata reclassification within the sanctioned projection (mindrian-operation -> pws via ingestPlan), minting NO new node type and opening NO new Brain wire (Canon Part 11 constraint)"
  - "the frozen ALLOWED_EDGE_TYPES + the TIER_PWS/TIER_OP methodology_tier rule are untouched; the existing 37/37 orchestration-projection.test asserts both still hold"

patterns-established:
  - "Command ledger: {generated_note, counts:{ranked,excluded,gap,total}, commands:[{command,source,state}]}, sorted by command, 2-space JSON + trailing newline, byte-checked for staleness"
  - "Test fence asserts full coverage (every command node classifies) + synthesized-gap-flagged + synthesized-excluded-not-flagged + XOR invariant + the R8 doc fence + a Part 8 value heuristic"

requirements-completed: [INV-04, INV-05, INV-06]

# Metrics
duration: 24min
completed: 2026-06-23
---

# Phase 172 Plan 03: R5/R8 Counterpart Substrate Summary

**Inverts the projection's UN-RANKED early-continue so a bare command surfaces as a command_gap instead of silently shipping, emits data/orchestration-command-ledger.json (the command-grained wired-XOR-excluded ledger), classifies 18 warranted-dark utility commands as excluded-with-reason mindrian-operation terminal states, and documents the dark -> counterpart -> pws frontier promotion path (R8) -- the CIRS R5/R8 substrate on the shipped Phase 157 projection.**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-06-23
- **Completed:** 2026-06-23
- **Tasks:** 3 of 3
- **Files:** 2 created, 3 modified

## Accomplishments

- **Task 1 (commit 220543b0):** Added the command-grained coverage pass to `scripts/build-orchestration-projection.cjs`. `validateProjection()` now returns a fourth array, `command_gaps`: `classifyCommandNode(node)` classifies every command-kind node as `ranked` (carries `reach_id` + `hierarchy_rank` + `posture`), `excluded` (listed in the new `EXCLUDED_COMMANDS` table with a reason), or `gap` (a bare command, no `reach_id`, not excluded). The old UN-RANKED leg early-continued on any node lacking `reach_id`, so dark commands shipped silently; the new pass INVERTS that -- a bare command is collected into `command_gaps` unless excluded. Added the `EXCLUDED_COMMANDS` slug->reason table (18 utility commands: doctor / dashboard / admin / models / setup / help / export / publish / rooms / snapshot / ingest-methodology / update / status / hmi-status / splash / dogfood-flush / scheduled-tasks / mos), each with a documented reason (T-172-06: an excluded command can never be silently both-excluded-and-reasonless). Added `commandCoverageReport()` (the ranked/excluded/gap counts + the per-command rows) and `serializeCommandLedger()`. The frozen `ALLOWED_EDGE_TYPES` set and the `TIER_PWS`/`TIER_OP` methodology_tier rule were left untouched; skills stay EXEMPT (they are not command-kind).
- **Task 2 (commit 356bfff8):** Generated `data/orchestration-command-ledger.json` by RUNNING the generator (not hand-authored): `{ generated_note, counts:{ranked:55, excluded:18, gap:28, total:101}, commands:[{command, source, state}] }`, sorted by command. The XOR invariant holds by construction (55 + 18 + 28 === 101 === the command-node count). `main()` writes it on the default run in lockstep with the projection; `validateProjection()` STALE-byte-checks it in `--check`, so a hand-edit of the ledger out of sync with the projection fires STALE. The core utility commands (doctor, dashboard, setup, help) appear as `state: excluded`.
- **Task 3 (RED commit 2ee6c118, GREEN commit 56dc7c19):** TDD-built `tests/test-orchestration-counterpart-coverage.cjs` (the four mandated behaviors + a doc fence + a Part 8 value heuristic): Test 1 full-coverage classification; Test 2 a synthesized bare command is flagged as a `command_gap`; Test 3 a synthesized excluded command is NOT a gap; Test 4 the command-ledger XOR invariant + byte-identity to the regenerated ledger; Test 5 the R8 promotion-path documentation; Test 6 no `room/` path / email pattern in any ledger value. Wrote the `ORCHESTRATION-PROJECTION-CONTRACT.md` section 4e documenting (1) the `mindrian-operation` COUNTERPART node for non-framework commands (it chains via OPERATES/CHAINS/PREREQUISITE without a `pws` framework, INV-05); (2) the command-grained wired-XOR-excluded ledger (INV-04); (3) the PROMOTION PATH dark -> `mindrian-operation` counterpart -> `pws` frontier framework via the Phase 171 `ingestPlan` pipeline, navigator-gated (Part 3 + Part 9 role 5), minting NO new node type (Part 11 constraint). Registered the test in `tests/run-all-172.sh`.

## TDD Gate Compliance

Task 3 (`tdd="true"`) followed RED -> GREEN:
- **RED (2ee6c118):** `test(172-03): add failing counterpart-coverage test ...` -- the four code/ledger behaviors passed immediately (Tasks 1+2 shipped them), but Test 5 (the R8 doc fence) FAILED because the doc section was not yet written, and Test 6 caught a real `room/` substring in two exclude reasons. Confirmed exit 1 (12 passed, 5 failed).
- **GREEN (56dc7c19):** `feat(172-03): document R8 promotion path + counterpart node` -- wrote ORCHESTRATION-PROJECTION-CONTRACT.md section 4e and reworded the dashboard/admin exclude reasons to avoid the literal `room/` substring; test exits 0 (17/17).
- REFACTOR: none needed.

## Verification

| Check | Result |
|-------|--------|
| Task 1: `validateProjection()` returns `command_gaps[]` | exit 0; 28 gaps |
| Task 2: `build-orchestration-projection.cjs` then `--check` | wrote ledger (55 ranked / 18 excluded / 28 gap); `--check` -> `orchestration-projection: OK` (exit 0) |
| Task 3: `node tests/test-orchestration-counterpart-coverage.cjs` | 17/17 PASS (exit 0) |
| V1: `--check` exit 0 on clean repo | exit 0 (command_gaps WARN-only on stderr) |
| V3: no change to ALLOWED_EDGE_TYPES / methodology_tier rule | confirmed (no edge-type/tier lines in `git diff`) |
| Existing `lib/memory/orchestration-projection.test.cjs` | 37/37 PASS (closed-edge-set + tier-on-every-node + referential-integrity + no-em-dash all green) |
| `tests/test-orchestration-projection-part8-boundary.cjs` | exit 0 (field-allowlist + tier + planted-secret + zero-live-Brain) |
| `bash tests/run-all-172.sh` | 7/7 PASSED (incl. frozen exactly-6-reaches + exactly-3-postures drift fences) |
| XOR invariant | 55 + 18 + 28 === 101 (every command in exactly one bucket) |

## Frozen-Invariant Compliance

- No 7th reach minted, no new edge type, no new node type, no new Brain wire opened. The projection's closed node-kind set (command|skill|agent|framework|reach|sub_mode) and its closed `ALLOWED_EDGE_TYPES` (OPERATES / CHAINS / FEEDS_INTO / PREREQUISITE / CROSS_DOMAIN_ANALOGUE) are unchanged.
- `MAX_K=3`, `DIAL_REACH_K=6`, the 0.70/0.15 RECOMMENDED gate, the F.1 keyboard contract: untouched (not in scope). The carried `test-reach-ids-drift.cjs` (exactly-6) and `test-posture-ids-drift.cjs` (exactly-3) ran green inside `run-all-172.sh`, proving this plan is additive.
- Canon Part 8: the projection stays a Brain-DERIVED LOCAL cache (no live Brain read/write; no `brain-client` require, no `fetch`/`http`). The command ledger carries ONLY generic machinery metadata `{command, source, state}`; the EXCLUDED_COMMANDS reasons are generic prose (the Part 8 boundary scan + the new test's value heuristic both assert no `room/` path and no email pattern). The R5 counterpart is a PROJECTION node (control plane), NOT a room.db Part-9 node.
- Gap reporting lands WARN-only here (D-172-e): `runCheck` prints `command_gaps` to stderr but does NOT exit non-zero; the hard-FAIL flip is Plan 172-13. STALE / UN-WIRED / UN-RANKED stay hard failures.

## Deviations from Plan

None of substance - plan executed as written. Three minor in-scope adjustments, none a scope change:

1. **[Rule 1 - Bug] dashboard/admin exclude reasons reworded.** The Part 8 value heuristic in Task 3's test (Test 6) correctly flagged a literal `room/` substring in two exclude reasons ("over room/." and "room/registry maintenance"). These were generic machinery prose, not user-content paths, but the strict heuristic is the right fence, so the reasons were reworded ("over the room folder", "room and registry maintenance") and the ledger regenerated. Caught during RED; fixed in GREEN (commit 56dc7c19).
2. **[Rule 2 - Test fence] Test 6 (Part 8 value heuristic) added beyond the four mandated behaviors,** mirroring the Phase 90 forbidden-substring sweep and the plan's T-172-05 mitigation (the test asserts no value matches a room/ path or email heuristic). Strengthens the fence without changing any task's scope.
3. **Test registered in `tests/run-all-172.sh`** (the established 172 fence pattern, mirroring 172-01/02), so the phase aggregator carries the new test (7/7).

## Known Stubs

None. The 28 `gap` commands in the ledger are NOT stubs - they are the honest, measured warranted-dark thinking-command count this plan exists to make legible (the `rs-*` family, `/mos:causal`, `/mos:act`, ...). Wiring them with `mindrian-operation` counterparts is the work of later 172 waves (Wave 2/3); the WARN-only gate makes them visible without blocking CI. The 18 `excluded` commands are a first-class conformant terminal state (R1), each with a documented reason - not stubs.

## Threat Flags

None. This plan adds no new network endpoint, auth path, file-access pattern, or trust-boundary schema change beyond what the plan's threat model already covers (T-172-05 mindrian-operation counterpart info-disclosure, mitigated by the field-allowlist + the new test's value heuristic; T-172-06 ledger-exclusion tampering, mitigated by the required-reason XOR; T-172-SC no package installs). The projection's existing Part 8 boundary scan (`test-orchestration-projection-part8-boundary.cjs`) ran green over the regenerated artifact.

## Self-Check: PASSED

- `data/orchestration-command-ledger.json` -- FOUND
- `tests/test-orchestration-counterpart-coverage.cjs` -- FOUND
- `scripts/build-orchestration-projection.cjs` (command_gaps + serializeCommandLedger + EXCLUDED_COMMANDS) -- FOUND
- `docs/ORCHESTRATION-PROJECTION-CONTRACT.md` section 4e (promotion path) -- FOUND (grep)
- Commits 220543b0, 356bfff8, 2ee6c118, 56dc7c19 -- all present in git log
