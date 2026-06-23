---
phase: 172-contextual-invocation-coverage
plan: 02
subsystem: testing
tags: [cirs, canon-part-11, r12, forward-declaration, gate-hook, self-enforcing]

# Dependency graph
requires:
  - phase: 172-01-cirs-r1-r2-gate-substrate
    provides: the connector coverage ledger + the parseConnectorFrontmatter / --check exit-code + recovery-line idiom mirrored here
  - phase: 143.3-connector-spine-and-intelligence-orchestrator
    provides: scripts/build-connector-registry.cjs (the --check idiom + parseConnectorFrontmatter nested-descent parser this validator mirrors)
provides:
  - "The R12 cirs_relationship declaration contract: docs/CIRS-RELATIONSHIP-CONTRACT.md (five-field schema + canon_parts-11 auto-derivation rule + surface/spine trigger + slug-keyed record)"
  - "The slug-keyed CIRS column rubric in docs/CANON-PHASE-MAP.md pointing at the contract as schema source"
  - "scripts/check-cirs-declaration.cjs: checkCirsDeclaration(fm) -> {ok, errors[]} + CLI --check <planpath...>; fails a surface-touching/spine-consuming phase without a conformant declaration"
  - "tests/test-cirs-declaration.cjs: the four CIRS behaviors + spine trigger + real-plan fixtures + Part 8 no-network tripwire (registered in tests/run-all-172.sh)"
affects: [every FUTURE phase touching an invocable surface or consuming the spine, CIRS R12 gate, R9 born-wired gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "R12 gate hook: pure checkCirsDeclaration(fm) core + thin CLI --check wrapper (mirrors build-connector-registry --check exit-code + recovery-line idiom)"
    - "canon_parts-11 auto-derivation: declaring any cirs_relationship field implies 11 in canon_parts; the gate derives one from the other so they cannot disagree"
    - "dual trigger: surface-touching (commands/|skills/|agents/) OR spine-consuming (non-empty spine_consumed) requires a conformant declaration; untriggered phases exempt"
    - "self-validating gate: the plan that ships the validator is the validator's first conformant fixture (dog-fooding)"

key-files:
  created:
    - docs/CIRS-RELATIONSHIP-CONTRACT.md
    - scripts/check-cirs-declaration.cjs
    - tests/test-cirs-declaration.cjs
  modified:
    - docs/CANON-PHASE-MAP.md
    - tests/run-all-172.sh

key-decisions:
  - "checkCirsDeclaration(fm) is the pure core; the CLI --check parses LOCAL plan files only (zero Brain, zero network -- Canon Part 8)"
  - "A conformant cirs_relationship block = all five structured fields present (surfaces_added/modified/removed, spine_consumed, gate_impact) AND non-empty explanation prose"
  - "canon_parts-11 auto-derivation is enforced on BOTH triggered phases (mandatory) and untriggered-but-declaring phases (cannot disagree)"
  - "WARN-first not done here: this plan ships the hook hard-failing on triggered non-conformance; the orphaned WARN-only failure mode is precisely what R12 cures. The hook is not yet wired into pre-commit/release (that is INV-14/R9 wiring, a later 172 wave) so it does not retroactively break unrelated existing phases."
  - "parsePlanFrontmatter mirrors the parseConnectorFrontmatter nested-descent idiom (Part 7 reuse), not a new YAML dependency"

patterns-established:
  - "R12 declaration block: cirs_relationship: {surfaces_added[], surfaces_modified[], surfaces_removed[], spine_consumed[], gate_impact, explanation}"
  - "Test fence: four canonical behaviors as in-memory frontmatter fixtures + the two real shipping plans as positive fixtures + a comment-stripped source scan asserting no fetch/http/brain"

requirements-completed: [INV-22, INV-13]

# Metrics
duration: 22min
completed: 2026-06-23
---

# Phase 172 Plan 02: CIRS R12 Forward-Declaration Contract + Gate Hook Summary

**Ships the self-propagating heart of CIRS: the `cirs_relationship:` declaration contract, the slug-keyed CIRS column in CANON-PHASE-MAP, and a LOCAL-only gate hook that fails any phase touching an invocable surface (or consuming the spine) without a conformant declaration -- with this plan's own frontmatter as the validator's first conformant test case.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-23
- **Completed:** 2026-06-23
- **Tasks:** 3 of 3
- **Files:** 3 created, 2 modified

## Accomplishments

- **Task 1 (commit c9d828b0):** Authored `docs/CIRS-RELATIONSHIP-CONTRACT.md` -- the R12 declaration schema. Specifies the five-field `cirs_relationship:` block (`surfaces_added` / `surfaces_modified` / `surfaces_removed` / `spine_consumed` / `gate_impact`) plus the required prose `explanation`; the canon_parts-11 auto-derivation rule (declaring any field auto-implies `11` in `canon_parts`; the gate derives one from the other so they cannot disagree, R12); the dual trigger (a phase modifying files under `commands/`/`skills/`/`agents/` OR consuming the spine MUST declare); and the slug-keyed CANON-PHASE-MAP record (absorbing the map's number-collision warning). Anchored to Canon Part 11 R12 + Appendix D entry 25. No fenced code beyond the one frontmatter example block. Zero em-dashes.
- **Task 2 (commit f5f3dabb):** Extended the EXISTING `### Part 11 - The Invocation Constitution (CIRS)` section of `docs/CANON-PHASE-MAP.md` (did NOT duplicate it). Added the rubric paragraph formalizing the CIRS column as the slug-keyed forward-declaration ledger (every future row keyed on phase SLUG, carrying its cirs_relationship summary) and pointing at `docs/CIRS-RELATIONSHIP-CONTRACT.md` as the schema source. Confirmed the Phase 172 (`IMPLEMENTS CIRS R1-R14`), Phase 170, and Phase 171 rows are intact. Touched ONLY this section (exclusive ownership).
- **Task 3 (RED commit fc6fd751, GREEN commit a2cc3dba):** TDD-built `scripts/check-cirs-declaration.cjs` exporting `checkCirsDeclaration(planFrontmatter) -> {ok, errors[]}` and a CLI `--check <planpath...>` mode that exits non-zero on any error with a recovery line pointing at the contract. Logic: a phase whose `files_modified` touches `commands/`/`skills/`/`agents/` OR whose `cirs_relationship.spine_consumed` is non-empty REQUIRES a conformant block (all five fields + non-empty explanation) AND `11` in `canon_parts`. Reads LOCAL plan files only; zero Brain, zero network. `parsePlanFrontmatter` mirrors the shipped `parseConnectorFrontmatter` nested-descent idiom (Part 7 reuse). Wrote `tests/test-cirs-declaration.cjs` covering the four mandated behaviors plus a spine-trigger case, the two real shipping plans (172-01 + 172-02) as positive fixtures, and a comment-stripped source scan asserting no `fetch`/`http`/`brain`. Registered the test in `tests/run-all-172.sh`.

## Verification

| Check | Result |
|-------|--------|
| `node tests/test-cirs-declaration.cjs` exit | 0 (all behaviors PASS, incl. 172-01/172-02 conformant fixtures) |
| `node scripts/check-cirs-declaration.cjs --check 172-02-PLAN.md` exit | 0 (self-conformant) |
| `node scripts/check-cirs-declaration.cjs --check 172-01-PLAN.md` exit | 0 (Wave-1 plan conformant) |
| Surface-touching plan with NO block | exit 1 with recovery line (verified against a `commands/dark.md` fixture) |
| Part 8 source scan (`fetch`/`http`/`brain`, non-comment) | 0 matches |
| `grep cirs_relationship/auto-implies/slug docs/CIRS-RELATIONSHIP-CONTRACT.md` | all present (Task 1 automated verify) |
| `grep Part-11 + CIRS-RELATIONSHIP-CONTRACT.md docs/CANON-PHASE-MAP.md` | both present; 172/170/171 rows intact (Task 2 automated verify) |
| `bash tests/run-all-172.sh` | 6/6 PASSED |

## TDD Gate Compliance

Task 3 (`tdd="true"`) followed RED -> GREEN:
- **RED (fc6fd751):** `test(172-02): add failing test ...` -- test committed while `scripts/check-cirs-declaration.cjs` did not exist; confirmed MODULE_NOT_FOUND exit 1.
- **GREEN (a2cc3dba):** `feat(172-02): implement CIRS R12 gate hook validator` -- validator landed; test exits 0.
- REFACTOR: none needed (no behavior-preserving cleanup pass produced changes).

## Frozen-Invariant Compliance

- No 7th reach minted, no new edge type, no new node type, no new Brain wire opened.
- `MAX_K=3`, `DIAL_REACH_K=6`, the 0.70/0.15 RECOMMENDED gate, the F.1 keyboard contract: untouched (not in scope).
- The carried frozen-bank drift fences (`test-reach-ids-drift.cjs` exactly-6 reach_ids, `test-posture-ids-drift.cjs` exactly-3 postures) ran green inside `run-all-172.sh`, proving 172-02 is additive.
- Canon Part 8: the validator reads LOCAL plan markdown only; zero Brain, zero network (asserted by the comment-stripped source scan). The cirs_relationship block carries generic machinery metadata only (surface slugs, spine asset names), never user content.
- R12 forward-declaration landed hard-failing on triggered non-conformance (the cure for the orphaned WARN-only failure mode), but NOT yet wired into pre-commit/release/doctor/ingest -- so it does not retroactively break unrelated existing phases. That wiring is INV-14/R9, a later 172 wave.

## Deviations from Plan

None - plan executed exactly as written. Two conformant extensions beyond the literal four behaviors, neither a deviation: (1) Test 5 adds a spine-trigger non-conformance case (explanation missing) to fence the spine-consuming trigger the contract defines; (2) the new test was registered in `tests/run-all-172.sh` so the phase aggregator carries it (the established 172 fence pattern). Both strengthen the fence without changing any task's scope.

## Known Stubs

None. The validator is fully wired and self-validating against both real shipping plans.

## Threat Flags

None. This plan adds no new network endpoint, auth path, file-access pattern, or trust-boundary schema change beyond the LOCAL plan-file read already in the plan's threat model (T-172-03 Tampering / T-172-04 Repudiation, both mitigated by this validator as designed).

## Self-Check: PASSED

- `docs/CIRS-RELATIONSHIP-CONTRACT.md` -- FOUND
- `scripts/check-cirs-declaration.cjs` -- FOUND
- `tests/test-cirs-declaration.cjs` -- FOUND
- `docs/CANON-PHASE-MAP.md` CIRS column rubric -- FOUND (grep)
- Commits c9d828b0, f5f3dabb, fc6fd751, a2cc3dba -- all present in git log
