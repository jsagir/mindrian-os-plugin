---
phase: 91-navigation-engine
plan: "09"
subsystem: nav-invariants-validator
tags: [navigation-engine, validator, guardian, registry-drop-in, silent-to-loud, canon-part-3, canon-part-7, canon-part-8, fail-open, tdd]

# Dependency graph
requires:
  - phase: 88-feynman-minto-memory-layer
    plan: "13"
    provides: scripts/feynman-minto-guardian.cjs validator registry (loadValidators walker; scope='room' dispatch via validateRoomScope; fail-open semantics; first-loaded-wins id collision dedup; GUARDIAN_VALIDATORS_DIR env override)
  - phase: 91-navigation-engine
    plan: "00"
    provides: navigation-engine-shared.cjs CANONICAL_VERBS frozen 10-verb canon + emptyDecisionTrace 8 Section 8 brain_md_* fields shape
  - phase: 91-navigation-engine
    plan: "02"
    provides: scripts/intent-classifier.cjs persistDecisionTrace -- writes .mindrian/decision-traces/<session>.json with {version, session_id, traces[]} schema and merged decision_trace + turn/at metadata
  - phase: 91-navigation-engine
    plan: "07"
    provides: problem-type-router lazy-require pattern adopted defensively for CANONICAL_VERBS module load (graceful fallback when module unavailable)
  - phase: 91-navigation-engine
    plan: "08"
    provides: framework-chain-composer pre-engine signal source -- engine output may carry chain_recommended_eligible alongside Section 8 fields; validator does not opine on those, only the locked 8 Section 8 keys
  - phase: 90-brain-derivation-layer
    plan: "09"
    provides: navigation-engine-brain-interface v1 frozen contract (Section 8 8-field requirement that this validator enforces)

provides:
  - "lib/memory/validators/navigation-invariants.cjs registry-compatible drop-in validator (id='navigation-invariants', scope='room', severity_map for 6 categories) -- zero guardian.cjs edits required"
  - "5 invariants enforced: INV-1 trace_missing_field (8 Section 8 brain_md_* fields), INV-2 recommended_in_wrong_mode (Canon Part 3 Section 6 mode_a gate), INV-3 weight_clamp_breach ([0.0, 1.0]), INV-4 trace_file_malformed (per-file isolation), INV-5 unknown_verb_passed (CANONICAL_VERBS check, graceful when module absent)"
  - "Three guardian modes wired: session-start advisory (TRIPLE_CONTEXT footer), on-stop advisory (invariant-report.json), pre-commit blocking (guardian exits 2 at error/critical)"
  - "16-test fixture suite (lib/memory/navigation-invariants.test.cjs): registry shape, severity_map coverage, INV-1..INV-5 positive + negative paths, session_file_absent info, registry integration via guardian on-stop, fail-open inheritance, Canon Part 8 source scan, BSL header"

affects:
  - 91-10-v1.11.0-release-gate (NAV-INVARIANTS-01..03 requirements complete; 91-10 release-gate now has its sentinel validator in place to catch regressions in any Phase 91 trace emitter)
  - Future 92-* drift detection (same registry pattern; 92-* validators drop in alongside this one without touching guardian.cjs)
  - Phase 88-13 extensibility promise (proven again -- 4th external validator added without registry modification)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registry-compatible drop-in: file is auto-discovered by Phase 88-13 loadValidators() walker (alphabetical .cjs scan in lib/memory/validators/). Guardian invokes validate(roomDir, ctx) per scope='room' contract. Zero guardian.cjs edits."
    - "Lazy CANONICAL_VERBS load with cached null sentinel: try-require navigation-engine-shared.cjs once, cache result (array or null) in module scope so subsequent validate() calls do not retry on every invocation. INV-5 silently skips when shared module unavailable (graceful degradation)."
    - "Per-file isolation in INV-4: a single malformed JSON file emits one trace_file_malformed violation and the loop continues to the next sibling. Test 9 verifies that a clean file's INV-3 breach still surfaces despite a peer being garbage."
    - "Object.prototype.hasOwnProperty.call() for INV-1 field presence: explicit null/0/''/false/[]/sentinel values are valid Section 8 payloads (e.g. brain_md_stale_reason:null when fresh). Only truly absent properties trip INV-1."
    - "session_file_absent info-severity sentinel: surfaced when decision-traces dir is missing or empty so /mos:explain-decision telemetry has a benign signal rather than confusing silence. Severity 'info' is below the pre-commit blocking threshold."

key-files:
  created:
    - lib/memory/validators/navigation-invariants.cjs (308 LOC; BSL 1.1; pure CJS + node built-ins; scope='room')
    - lib/memory/navigation-invariants.test.cjs (483 LOC; 16 tests; fixture-based with tmpdir room scaffolding; spawnSync into production guardian.cjs for registry integration tests)
    - .planning/phases/91-navigation-engine/91-09-SUMMARY.md (this file)
  modified:
    - lib/memory/run-feynman-tests.cjs (registered navigation-invariants.test.cjs in TEST_FILES with descriptive comment block matching prior 91-* registrations)

key-decisions:
  - "Five invariants exactly. INV-1 + INV-2 + INV-3 enforce the navigation-engine-brain-interface v1 Section 8 contract verbatim. INV-4 is the parser-failure escape hatch. INV-5 is the Canon Part 3 vocabulary check. No other invariants in this plan -- additional checks belong to future 91-* / 92-* validators that drop in alongside."
  - "Per-trace iteration, NOT per-file aggregation. A trace file with 50 entries can produce up to 50 INV-1 violations (one per missing field per turn). Verbose by design: silent-to-loud means every violation is enumerated for /mos:explain-decision and the guardian footer."
  - "Canon Part 8 boundary: validator reads .mindrian/decision-traces/*.json only. Zero Brain queries. Zero shell-out. Zero fetch. Zero require of brain-client. Test 13 source-scans this file with a frozen forbidden-pattern set."
  - "scope='room' (not 'section'): decision-traces are aggregated across all sections at .mindrian/, not per-section. Phase 88-13's stale-lifecycle / queue-health / snapshot-integrity validators all use scope='room' for the same reason -- the file under inspection lives at .mindrian/, not in any one section."
  - "Severity assignment matches the plan: trace_missing_field/recommended_in_wrong_mode/weight_clamp_breach/trace_file_malformed -> error (pre-commit blocking); unknown_verb_passed -> warning (advisory); session_file_absent -> info (sentinel for fresh rooms)."
  - "ID collision behavior: 'navigation-invariants' is a unique id. If a future plan ships an alternate validator with the same id, the alphabetically earlier file wins per Phase 88-13 contract (00-*-navigation-invariants.cjs would shadow this file). Documented for downstream maintainers."
  - "Fail-open inherited from Phase 88-13: a require-time throw or a validate() throw is caught by the guardian's loadValidators / validateRoomScope guards. Test 12 verifies this contract by dropping a deliberately broken sibling validator alongside ours and confirming both the broken validator is skipped AND navigation-invariants still runs."

patterns-established:
  - "Validator drop-in protocol for downstream 91-* / 92-* phases: copy the structure of navigation-invariants.cjs (constants block + lazy-require helpers + per-trace check function + finalize aggregator + module.exports {id, severity_map, scope, validate}). The guardian picks it up automatically."
  - "Trace shape contract is a frozen list (REQUIRED_TRACE_FIELDS = 8 brain_md_* names) exposed via module.exports.__internal for tests. Future Section 8 extensions add to this list in a single locked file rather than rewriting validators."
  - "Self-tagging convention: every emitted violation carries validator: 'navigation-invariants' even though the guardian also tags. Belt-and-suspenders pattern matches snapshot-integrity / queue-health / stale-lifecycle precedent."

requirements-completed:
  - NAV-INVARIANTS-01
  - NAV-INVARIANTS-02
  - NAV-INVARIANTS-03

# Metrics
duration: 25min
completed: 2026-04-27
---

# Phase 91 Plan 09: Navigation Invariants Validator Summary

**Drop-in registry-compatible validator that converts five silent Phase 91 navigation failure modes -- missing trace fields, RECOMMENDED-in-wrong-mode, weight-clamp breaches, malformed trace files, unknown verbs -- into first-class health signals visible at session-start, on-stop, and pre-commit. Zero guardian.cjs edits; the Phase 88-13 registry contract was built for exactly this.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-27T21:05:34Z
- **Completed:** 2026-04-27
- **Tasks:** 1 / 1 (TDD: RED -> GREEN)
- **Files modified:** 3 (2 created -- validator + test, 1 modified -- run-feynman-tests.cjs)
- **Tests added:** 16 (16/16 green)

## Accomplishments

- New file `lib/memory/validators/navigation-invariants.cjs` (308 LOC) ships as a registry-compatible drop-in. The guardian's existing `loadValidators()` walker auto-discovers the file on next invocation (any of session-start / on-stop / pre-commit / clean-tmp); zero guardian.cjs edits.
- Five invariants enforced over `.mindrian/decision-traces/<session>.json` files written by Plan 91-02:
  - **INV-1** trace_missing_field: each persisted trace entry must carry all 8 Section 8 `brain_md_*` fields per `navigation-engine-brain-interface` v1.
  - **INV-2** recommended_in_wrong_mode: `brain_md_recommended_marker_rendered=true` requires `brain_md_tier_mode='mode_a'` (Canon Part 3 Section 6).
  - **INV-3** weight_clamp_breach: `brain_md_weight_applied` in `[0.0, 1.0]`.
  - **INV-4** trace_file_malformed: JSON.parse failure on any decision-traces file; sibling files keep being scanned.
  - **INV-5** unknown_verb_passed: `fire_skill` (when present) must be in `CANONICAL_VERBS` (frozen 10-verb canon). Graceful when the shared module is unavailable.
- `session_file_absent` info-severity sentinel surfaces when the decision-traces directory is missing or empty, giving `/mos:explain-decision` and the guardian footer a benign signal rather than confusing silence.
- 16-test fixture suite (`lib/memory/navigation-invariants.test.cjs`, 483 LOC) covers: validator shape contract, severity_map coverage across all 6 categories, INV-1 through INV-5 positive + negative paths, session_file_absent info, **registry integration via spawnSync into the production guardian.cjs with `GUARDIAN_VALIDATORS_DIR` override** (Test 11), **fail-open inheritance** (Test 12 -- a malformed sibling validator does NOT prevent navigation-invariants from running), Canon Part 8 source scan (Test 13 -- zero brain-client / fetch / smartSearch references), BSL 1.1 header (Test 14).
- Registered in `lib/memory/run-feynman-tests.cjs` with the same descriptive comment-block style used for prior 91-* registrations.

## Silent-Failure-to-Loud Matrix

The Phase 91 silent failure modes were invisible until this validator landed. Now each is a first-class health signal at the appropriate enforcement point:

| Failure mode                                         | Pre-91-09 visibility    | Post-91-09 surface                                                          |
| ---------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------- |
| Missing brain_md_* field in persisted trace          | invisible               | INV-1 error -> session-start TRIPLE_CONTEXT, on-stop report, pre-commit BLOCK |
| RECOMMENDED rendered in mode_b / tier_0              | invisible               | INV-2 error -> same                                                         |
| brain_md_weight_applied outside [0.0, 1.0]           | invisible               | INV-3 error -> same                                                         |
| decision-traces/*.json corruption (partial write)    | invisible               | INV-4 error -> same                                                         |
| fire_skill not in Canon Part 3 vocabulary            | invisible               | INV-5 warning -> session-start + on-stop report (advisory only)             |
| decision-traces/ absent (fresh room or pre-engine)   | confusing silence       | session_file_absent info -> benign sentinel surface in report               |

This matches the Phase 88-13 silent-to-loud pattern (snapshot-integrity, queue-health, stale-lifecycle) the registry was built to enable.

## Registry Drop-In Verification

Test 11 spawns the production `scripts/feynman-minto-guardian.cjs on-stop` against an isolated `GUARDIAN_VALIDATORS_DIR` containing only this validator and a seeded room with one weight-clamp violation. The guardian writes `.mindrian/invariant-report.json` whose `__room__` section contains a `validator: 'navigation-invariants'` entry -- proving the registry picks up the file with zero guardian.cjs modifications.

`grep -n "navigation-invariants" scripts/feynman-minto-guardian.cjs` returns no hits. The guardian does not know this validator exists by name -- the registry contract is purely structural.

## Fail-Open Inheritance

Test 12 drops a deliberately broken sibling validator (`broken-validator.cjs` exporting `{id: 'broken'}` only -- missing `validate` and `severity_map`) into the same `GUARDIAN_VALIDATORS_DIR` alongside our validator. The guardian's `loadValidators()` skips the broken module with a stderr warning and continues loading the rest. Result: `navigation-invariants` still runs and emits its violation; `invariant-report.json` is still written.

This proves the Phase 88-13 extensibility promise holds across at least 4 external validator additions (this is the 4th post-shipping drop-in: brain-md-invariants, brain-substrate-invariants, external-academic/industry/patents-invariants, and now navigation-invariants).

## Three-Surface Compatibility

| Surface              | Behavior                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code CLI      | Hooks fire guardian on session-start / on-stop / pre-commit. Validator runs each time. TRIPLE_CONTEXT footer shows violations.       |
| Claude Desktop       | Desktop spawns the same guardian via session lifecycle integration. Identical violations surface in the conversational stream.        |
| Cowork (shared room) | Multi-user shared `.mindrian/decision-traces/` directory; validator scans all session files. Per-session_id traceability preserved.   |

Pure CJS + node built-ins (fs, path). Zero surface-specific branches. Zero new runtime dependencies.

## Canon Compliance

- **Part 3 (Tri-Context Decision Gate):** INV-1 + INV-2 enforce that every persisted trace carries the full Section 8 contract and that the RECOMMENDED marker only renders in mode_a. The validator is the runtime check that turns the frozen v1 interface into a self-policing artifact.
- **Part 7 (Reuse Before Build):** Phase 88-13 built the registry exactly so Phase 91 wouldn't have to touch guardian.cjs. The justification bar from Part 7 is satisfied: this plan replaces NO existing validator; it ADDS a new failure-mode set the registry was designed to absorb.
- **Part 8 (Graph Boundary):** Validator is pure LOCAL. Reads only `<roomDir>/.mindrian/decision-traces/`. Test 13 frozen forbidden-pattern scan: `require('https?')`, `fetch(`, `brain[-_]?client`, `smartSearch|brainQuery` all return zero matches.

## Task Commits

| Phase | Plan | Type     | Hash      | Description                                                                          |
| ----- | ---- | -------- | --------- | ------------------------------------------------------------------------------------ |
| 91    | 09   | test     | `cdb971a` | failing tests for navigation-invariants validator (RED) -- 16 tests covering 5 INVs  |
| 91    | 09   | feat     | `dc6e32e` | implement navigation-invariants validator (GREEN) -- registry drop-in + 5 invariants |
| 91    | 09   | docs     | (next)    | complete nav-invariants-validator plan -- this SUMMARY + ROADMAP update              |

## Verification

- `node lib/memory/navigation-invariants.test.cjs` -> **16/16 passed** (well above the plan's 12+ floor).
- `MINTO_FROZEN_DATE=2026-04-14 node lib/memory/run-feynman-tests.cjs` -> **98/100 passed, 2 failed**. The 2 failures (`test/84-smart-notebook-copilot.test.cjs`, `tests/test-self-update-platform.cjs`) are pre-existing and reproduce on the prior `main` HEAD without this plan's changes -- verified by stashing and re-running. They are out of scope per the GSD scope-boundary rule and tracked in Deferred Issues below.
- `grep -c "navigation-invariants" lib/memory/validators/navigation-invariants.cjs` -> **5+** (id export + comment refs).
- `grep -c "scope: 'room'" lib/memory/validators/navigation-invariants.cjs` -> **1** (single declaration, intentional).
- `grep -c "REQUIRED_TRACE_FIELDS\|brain_md_version\|brain_md_staleness" lib/memory/validators/navigation-invariants.cjs` -> **>= 3**.
- `grep -cE "–|—" lib/memory/validators/navigation-invariants.cjs lib/memory/navigation-invariants.test.cjs` -> **0** (ASCII-only en/em dash policy honored).
- BSL 1.1 header in first 20 lines of validator: present.
- `git diff --stat scripts/feynman-minto-guardian.cjs` for this plan: **empty** (Phase 88-13 extensibility promise honored).

## Deferred Issues

The 2 pre-existing Feynman suite failures observed during the regression run reproduce on the prior `main` HEAD (verified via `git stash` + re-run on baseline) and are unrelated to Phase 91-09:

- `test/84-smart-notebook-copilot.test.cjs` -- known-failing in Phase 84 territory; NOT a 91-09 regression.
- `tests/test-self-update-platform.cjs` -- known-failing self-update environment test; NOT a 91-09 regression.

Per GSD scope-boundary policy (CLAUDE.md): out-of-scope failures are logged here, not auto-fixed in this plan. Future Phase 84-* / 85-* maintenance plans own their respective fixes.

## Downstream Extension Point

Future drift-detection validators (Phase 92 proposed) drop in via the same registry pattern with no guardian.cjs edits. To author a new validator:

1. Create `lib/memory/validators/<your-id>.cjs` exporting `{id, severity_map, scope?, validate}`.
2. Decide `scope`: `'section'` for per-section content invariants, `'room'` for cross-section (like this plan).
3. Self-tag every violation with `validator: '<your-id>'` (belt + suspenders alongside guardian's auto-tag).
4. Register the test file in `lib/memory/run-feynman-tests.cjs` with a descriptive block matching the 91-* style.
5. The Phase 88-13 guardian picks it up on next invocation. No further code changes.

This is the 4th external drop-in to prove the protocol at scale; Phase 91-09 is the proof point that Phase 91-* concerns can be covered without touching the guardian.

## Self-Check: PASSED

- File existence:
  - `lib/memory/validators/navigation-invariants.cjs` -> FOUND
  - `lib/memory/navigation-invariants.test.cjs` -> FOUND
  - `.planning/phases/91-navigation-engine/91-09-SUMMARY.md` -> FOUND
- Require check: `require()` returns `{id: 'navigation-invariants', scope: 'room', ...}` -> PASS
- Test exit: `node lib/memory/navigation-invariants.test.cjs` -> exit 0, "16/16 passed" -> PASS
- Commit hashes:
  - `cdb971a` (RED) -> FOUND in `git log --oneline --all`
  - `dc6e32e` (GREEN) -> FOUND in `git log --oneline --all`
- Verifier counts:
  - `navigation-invariants` references in validator: 3 (>= 1 required)
  - `scope: 'room'` declarations: 1 (>= 1 required)
  - `REQUIRED_TRACE_FIELDS|brain_md_version|brain_md_staleness`: 5 (>= 3 required)
  - en/em dash count in validator + test: 0 (must be 0)
- `git diff scripts/feynman-minto-guardian.cjs` for this plan: empty (Phase 88-13 extensibility honored)
