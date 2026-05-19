---
phase: 121-trajectory-telemetry
plan: 02
subsystem: telemetry
tags: [capture-points, wire-ins, selector_pick, tension_engagement, auto_explore_decision, breakthrough_dismissed, canon-part-7, canon-part-8, canon-part-9, non-blocking, sha256-room-slug]

# Dependency graph
requires:
  - phase: 121-00
    provides: lib/core/telemetry/writer.cjs (the unified emit chokepoint, 15 EVENT_TYPES + Canon Part 8 emit-time validator) + ALLOWED_FIELDS for selector_pick / tension_engagement / auto_explore_decision / breakthrough_dismissed (per-event scalar whitelists; structural Part 8 enforcement).
  - phase: 121-01
    provides: atomic-cutover migration shipped; the unified events-YYYY-WNN.jsonl stream is the live target; no half-migrated state risk.
  - phase: 88.2-uiux-selector-block
    provides: lib/hmi/selector-dispatcher.cjs (D-04 wire-in target; F.* sub-shape dispatch + appendAskUserQuestionTrailer + emitPresentationTelemetry call site already wired).
  - phase: 116-unresolved-tension-hook
    provides: lib/memory/pending-tension-store.cjs (D-05 wire-in target; markResolved + VALID_RESPONSES + readTensions LWW substrate already shipped).
  - phase: 117-auto-explore-domains-on-first-material
    provides: lib/agents/auto-explore-agent.cjs::handleUserResponse (D-06 wire-in target; F.1 user-pick router for EXPLORE/SKIP/LATER/FREE_TEXT).
  - phase: 120-breakthrough-scan-category-g
    provides: lib/core/breakthrough/scanner.cjs::surfaceBreakthrough (D-07 wire-in target; D-20 third structural enforcement point with provenance check + ethics_tier + voice_audit_pass already populated upstream).
provides:
  - "lib/hmi/selector-dispatcher.cjs: emitSelectorPickUnified() helper -- selector_pick event emit at every F-shape pick resolution"
  - "lib/memory/pending-tension-store.cjs: emitTensionEngagementUnified() helper -- tension_engagement event emit ONLY on user-initiated transitions (RESOLVE/LATER/SKIP)"
  - "lib/agents/auto-explore-agent.cjs: handleUserResponse() emits auto_explore_decision for EXPLORE/LATER/SKIP (FREE_TEXT + system-driven skips excluded)"
  - "lib/core/breakthrough/scanner.cjs: surfaceBreakthrough() emits breakthrough_dismissed AFTER successful surfacing (provenance-blocked + throttled excluded structurally)"
  - "tests/test-121-02-selector-pick-capture.cjs: 4 integration tests, 4/4 green"
  - "tests/test-121-02-tension-engagement-capture.cjs: 4 integration tests, 4/4 green"
  - "tests/test-121-02-auto-explore-capture.cjs: 4 integration tests, 4/4 green"
  - "tests/test-121-02-breakthrough-dismissed-capture.cjs: 4 integration tests, 4/4 green"
  - "tests/test-121-02-scaffold.sh: 9-gate scaffold harness (markers + non-blocking + writer require + integration tests + zero em-dashes + sha256 room slug)"
  - "tests/run-all-121.sh: aggregator extended with test-121-02-scaffold.sh + 4 capture-point CJS tests"
  - "lib/memory/run-feynman-tests.cjs: registered 4 new test files in TEST_FILES array"
affects: [121-04, SEED-002 agent-lightning lab loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capture-point wire-in pattern: each shipped surface gets a 5-20 LOC addition that lazy-requires lib/core/telemetry/writer.cjs and emits a typed event through the Canon Part 9 single chokepoint. Wrapped in try/catch -- telemetry NEVER crashes the shipping behavior."
    - "Vocabulary translation pattern: each capture point translates its native vocabulary into the unified telemetry enum at the emit boundary. selector-dispatcher contract.mode/recommended -> selector_pick.mode/recommended_rendered. tension-store last_response RESOLVE/LATER/SKIP -> tension_engagement.user_response resolve/defer/ignore (DROPPED excluded). auto-explore-agent userResponse EXPLORE/LATER/SKIP -> auto_explore_decision.user_response kept/redid/ignored (FREE_TEXT excluded). breakthrough.kind -> breakthrough_dismissed.detector_type (kind fallback when detector_type absent)."
    - "Structural exclusion pattern: system-driven state transitions are excluded by NOT routing through the emit code path -- not by inline if-guard. tension-store decay (evaluateAndDecay -> markDropped) cannot emit because the emit is wired into markResolved, not markDropped. auto-explore system suppress paths (emitSkipped from Tier_0/just_talk/dispatcher_load_failed) cannot emit because emitSkipped is a separate function from handleUserResponse. breakthrough provenance-blocked surfaces cannot emit because the D-20 refusal early-returns before the emit. Each exclusion is structural (defense in depth), not procedural."
    - "Caller-provided verb_chosen pattern: surfaceBreakthrough does not await F.7 user pick (that lands in selector_pick D-04 downstream). The breakthrough_dismissed event records the SURFACING context + the verb proposed by the caller via opts.verb_chosen (empty string default). The dismissal-vs-accept user outcome is separately captured by selector_pick when F.7 resolves -- the two events are joinable post-hoc by detector_type + timestamp + room_slug_sha256."
    - "Lazy-require defense pattern: every wire-in does require('../core/telemetry/writer.cjs') inside the emit helper (not at module load). A stripped-down install missing writer.cjs results in a soft skip, never a module-load crash. Mirrors the auto-explore-agent _getTelemetry() lazy-require precedent."

key-files:
  created:
    - "tests/test-121-02-selector-pick-capture.cjs (218 lines, 4 tests, 4/4 green)"
    - "tests/test-121-02-tension-engagement-capture.cjs (211 lines, 4 tests, 4/4 green)"
    - "tests/test-121-02-auto-explore-capture.cjs (242 lines, 4 tests, 4/4 green)"
    - "tests/test-121-02-breakthrough-dismissed-capture.cjs (263 lines, 4 tests, 4/4 green)"
    - "tests/test-121-02-scaffold.sh (159 lines, 9 gates, 9/9 green)"
  modified:
    - "lib/hmi/selector-dispatcher.cjs: +60 LOC -- emitSelectorPickUnified helper + crypto _sha256 helper + 1 call site after appendAskUserQuestionTrailer + emitPresentationTelemetry"
    - "lib/memory/pending-tension-store.cjs: +80 LOC -- USER_RESPONSE_MAP + TENSION_TYPE_MAP enums + emitTensionEngagementUnified helper + 1 call site after markResolved appendTension success"
    - "lib/agents/auto-explore-agent.cjs: +50 LOC -- D06_FINDING_TYPE_MAP + D06_USER_RESPONSE_MAP enums + 1 emit block inside handleUserResponse after emitUserResponse telemetry call"
    - "lib/core/breakthrough/scanner.cjs: +50 LOC -- crypto _sha256Hex helper + 1 emit block inside surfaceBreakthrough after the breakthrough_surfaced memory_event"
    - "lib/memory/run-feynman-tests.cjs: registered 4 new test files in TEST_FILES array"
    - "tests/run-all-121.sh: extended SHELL_SUITES + CJS_SUITES for 121-02"

key-decisions:
  - "D-04 honored: selector_pick emits at every successful F-shape pick that has emitTelemetry===true (same gate as the existing emitPresentationTelemetry call). The render-v2 Zone 4 enrichment caller, which does NOT set emitTelemetry, continues to produce zero FS side-effects per the Canon Part 8 fs_scope invariant."
  - "D-05 honored: tension_engagement emits ONLY from markResolved when last_response is one of RESOLVE/LATER/SKIP. DROPPED falls through silently. The 3-strikes decay path (evaluateAndDecay -> appendTension with state:'dropped') never touches markResolved so it cannot emit -- structural exclusion."
  - "D-06 honored: auto_explore_decision emits ONLY from handleUserResponse for EXPLORE/LATER/SKIP. FREE_TEXT and system-driven emitSkipped (suppress paths from auto-explore-fingerprint/fire) never route through handleUserResponse and cannot emit. The wire-in file is lib/agents/auto-explore-agent.cjs (not scripts/auto-explore-fire.cjs etc) because per the plan instruction (D-06 'user-response capture surface'), only handleUserResponse handles the user's F.1 verb decisions; fingerprint/fire/drain are upstream pipeline steps. The plan-checker WARNING #4 advisory about multiple candidates is addressed: exactly one wire-in file ships (Gate 3 of the scaffold verifies count == 1)."
  - "D-07 honored: breakthrough_dismissed emits AFTER the breakthrough_surfaced memory_event lands inside surfaceBreakthrough. Provenance-blocked surfaces (D-20 third enforcement) early-return before the emit; throttled-by-canary candidates are filtered upstream in scanForBreakthroughs::applyThrottleFilter and never reach surfaceBreakthrough. Both exclusions are structural. Voice audit failure STILL emits because the dismissal signal is valuable regardless of audit pass/fail (Test 3 invariant)."
  - "Non-blocking semantics (Canon Part 8 + Plan 121-00 D-11): every emit is wrapped in try/catch. A validator-throw (Cypher injection, brain URL, raw email, etc.) is swallowed silently; the shipping behavior (dispatcher pick resolution, tension transition, auto-explore user response handling, breakthrough surfacing) ALWAYS returns ok:true to its caller. Verified by Test 3 in each capture-point integration test (the selector test uses a Cypher fragment as verb_chosen which triggers the writer's CYPHER_RE detector; the dispatcher returns shape:'F.1' regardless)."
  - "Room slug hashing (Canon Part 8 -- never raw slugs in telemetry): every wire-in computes sha256(basename(roomDir) or sha256(roomDir)) before assigning room_slug_sha256. Gate 9 of the scaffold harness verifies this invariant. The validator's SHA256_LEN check at the writer chokepoint rejects any value that is not 64-hex (defense in depth at the boundary)."
  - "Lazy-require pattern: every wire-in does require('../core/telemetry/writer.cjs') (or equivalent relative path) inside the emit helper, not at module load. A stripped-down install missing writer.cjs returns soft-skip with no emit; never a module-load crash. Mirrors the precedent in auto-explore-agent._getTelemetry() (Phase 117-05 Wave 3)."

patterns-established:
  - "Wire-in atomic-task pattern: each capture point ships as one TDD task (RED test + GREEN implementation + per-task commit). 4 tasks per plan = 8 commits total + 1 scaffold commit. Each task changes ONE source file and adds ONE test file. The scaffold harness runs at end-of-plan to verify all 4 wire-ins land + integration tests pass + zero em-dashes + sha256 invariant."
  - "Multi-event coexistence in unified stream: 4 net-new event types (selector_pick, tension_engagement, auto_explore_decision, breakthrough_dismissed) join the 11 existing types (6 mva.* + hooked_axis_score + empathy_observation + room_receipt_written + command_invocation + nav_bypass) in the same events-YYYY-WNN.jsonl file. Consumers (SEED-002) dispatch on the event field. No per-type sharding needed."
  - "Vocabulary-translation-at-emit pattern: each capture point owns its native vocabulary; the unified telemetry layer defines a closed enum per event type; translation happens once at the emit boundary via a frozen MAP constant. Reduces consumer-side normalization to zero."

requirements-completed: [TELEMETRY-121-04, TELEMETRY-121-05, TELEMETRY-121-06, TELEMETRY-121-07]

# Metrics
duration: 17min
completed: 2026-05-19
---

# Phase 121 Plan 02: Capture-Point Wire-Ins Summary

**4 high-signal capture points wired into shipped v1.13.0 surfaces (D-04..D-07). Each is a 5-20 LOC addition to an existing emit path that lazy-requires the Plan 121-00 chokepoint and emits a typed event into the unified events-YYYY-WNN.jsonl stream.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-05-19T08:59:57Z
- **Completed:** 2026-05-19T09:17 (approx.)
- **Tasks:** 4 / 4 complete (TDD: RED + GREEN per task)
- **Files created:** 5 (4 integration test files + 1 scaffold harness)
- **Files modified:** 6 (4 wire-in sources + run-feynman-tests + run-all-121)
- **Test cases:** 16/16 capture-point + 9/9 scaffold gates = 25/25 green
- **Regression fences:** 12/12 selector-dispatcher + 30/30 tension-hook + 25/25 auto-explore + 13/13 breakthrough = 80/80 still green

## Accomplishments

- **4 capture-point wire-ins shipped atomically.** Each wire-in delegates to `lib/core/telemetry/writer.cjs::emit()` (Plan 121-00 chokepoint) with the appropriate ALLOWED_FIELDS payload shape. No `fs.appendFileSync` outside `lib/core/telemetry/` -- the Canon Part 9 single-chokepoint invariant holds.
- **Vocabulary translation at every boundary.** Phase-native vocabularies (RESOLVE/LATER/SKIP for tension; EXPLORE/LATER/SKIP for auto-explore; contract.mode A/B for selector; breakthrough.kind for detector_type) translate into the unified ALLOWED_FIELDS enums (resolve/defer/ignore; kept/redid/ignored; A/B/Tier 0; convergence/cross_domain_analogy/etc.) at the emit boundary via frozen Object.freeze() maps.
- **Structural exclusion of system-driven state transitions.** The 3 system-driven paths that must NOT count as engagement are excluded NOT by inline if-guard but by structural placement of the emit call:
  - tension_engagement decay (3-strikes evaluateAndDecay -> markDropped) cannot emit because the wire-in is in `markResolved`, not `markDropped`.
  - auto_explore_decision system skips (emitSkipped from Tier 0 / just_talk / dispatcher_load_failed) cannot emit because the wire-in is in `handleUserResponse`, not `emitSkipped`.
  - breakthrough_dismissed provenance-blocked surfaces (D-20 third enforcement) cannot emit because the D-20 refusal early-returns before the wire-in code; throttled-by-canary candidates are filtered upstream in `scanForBreakthroughs::applyThrottleFilter` and never reach `surfaceBreakthrough`.
- **Non-blocking semantics proven by adversarial fixture.** Test 3 in each integration suite plants a Canon Part 8 forbidden pattern (Cypher in `verb_chosen`, etc.) and verifies the dispatcher/store/agent/scanner ALL still return `ok:true` -- the writer's validator throws, the wire-in's try/catch swallows, the shipping behavior is preserved.
- **9-gate scaffold harness shipped.** `tests/test-121-02-scaffold.sh` verifies all 4 emit markers + non-blocking try-wrap + writer-module requirement + integration tests green + zero em-dashes + sha256 room slug hashing -- the constitutional invariants of the plan in one bash run.

## Task Commits

Each task was committed atomically with TDD discipline (RED then GREEN per task):

1. **Task 1 RED -- D-04 selector_pick failing tests** -- `35138a82` (test). 4 fixture tests fail at "events-YYYY-WNN.jsonl must be created" because the wire-in does not yet exist. 218 lines.
2. **Task 1 GREEN -- D-04 selector_pick wire-in** -- `d071fa28` (feat). emitSelectorPickUnified helper + crypto _sha256 helper + 1 call site in pickShape after appendAskUserQuestionTrailer + emitPresentationTelemetry. 4/4 tests pass. lib/hmi/selector-dispatcher.cjs +60 LOC; lib/memory/run-feynman-tests.cjs registers 4 new test files.
3. **Task 2 RED -- D-05 tension_engagement failing tests** -- `61f5e47c` (test). 4 fixture tests fail similarly. 211 lines.
4. **Task 2 GREEN -- D-05 tension_engagement wire-in** -- `94bb5b8b` (feat). USER_RESPONSE_MAP + TENSION_TYPE_MAP enums + emitTensionEngagementUnified helper + 1 call site in markResolved. 4/4 tests pass. lib/memory/pending-tension-store.cjs +80 LOC.
5. **Task 3 RED -- D-06 auto_explore_decision failing tests** -- `7414e690` (test). 4 fixture tests fail; locate-file note explains why lib/agents/auto-explore-agent.cjs is the sole D-06 target among multiple candidates. 242 lines.
6. **Task 3 GREEN -- D-06 auto_explore_decision wire-in** -- `ee6b004c` (feat). D06_FINDING_TYPE_MAP + D06_USER_RESPONSE_MAP enums + 1 emit block in handleUserResponse after emitUserResponse telemetry. 4/4 tests pass. lib/agents/auto-explore-agent.cjs +50 LOC.
7. **Task 4 RED -- D-07 breakthrough_dismissed failing tests** -- `44b59c52` (test). 4 fixture tests fail; fixtures seed Breakthrough + DERIVED_FROM edges via direct INSERT (edges table has no created_at column; uses lazygraph minimal schema). 263 lines.
8. **Task 4 GREEN -- D-07 breakthrough_dismissed wire-in + 9-gate scaffold** -- `faeb4536` (feat). crypto _sha256Hex helper + 1 emit block in surfaceBreakthrough after breakthrough_surfaced memory_event. 4/4 tests pass. lib/core/breakthrough/scanner.cjs +50 LOC. tests/test-121-02-scaffold.sh ships with 9 gates; tests/run-all-121.sh extended.

**Plan metadata commit:** lands after this SUMMARY + STATE.md + ROADMAP.md update per the execute-plan workflow.

## Capture-Point Wire-In Map

| # | Decision | Wire-in file | Capture function | Trigger | Native vocabulary | Unified vocabulary | Exclusions |
|---|----------|--------------|------------------|---------|-------------------|--------------------|----|
| D-04 | selector_pick | `lib/hmi/selector-dispatcher.cjs` | `emitSelectorPickUnified()` | After every F-shape pick resolution where `payload.emitTelemetry===true` | `contract.mode` ('A'/'B'), `contract.recommended` (present/null) | `mode` (A/B/Tier 0), `recommended_rendered` (Boolean) | Non-F shapes; render-v2 Zone 4 enrichment caller (no emitTelemetry flag) |
| D-05 | tension_engagement | `lib/memory/pending-tension-store.cjs` | `emitTensionEngagementUnified()` | After `markResolved` JSONL append succeeds with `last_response` ∈ {RESOLVE, LATER, SKIP} | RESOLVE / LATER / SKIP / DROPPED; contradiction / convergence / stale_decision / open_question | resolve / defer / ignore (DROPPED excluded); contradicts / converges / invalidates | DROPPED (3-strikes decay); markDropped path |
| D-06 | auto_explore_decision | `lib/agents/auto-explore-agent.cjs` | inline in `handleUserResponse` | After `appendMaterial` + `emitUserResponse` telemetry for `userResponse` ∈ {EXPLORE, LATER, SKIP} | EXPLORE / LATER / SKIP / FREE_TEXT; source_pipeline domain / reverse-salients / cross-domain | kept / redid / ignored (FREE_TEXT excluded); whitespace / reverse_salient / cross_domain | FREE_TEXT (system fallback); auto_explore_skipped (system suppress paths from emitSkipped) |
| D-07 | breakthrough_dismissed | `lib/core/breakthrough/scanner.cjs` | inline in `surfaceBreakthrough` | After `breakthrough_surfaced` memory_event lands and BEFORE node properties.surfaced flip | breakthrough.detector_type / kind; ethics_tier HARD_FLOOR/SOFT_BAND/NEUTRAL/GREEN; voice_audit_pass | passthrough (with kind fallback if detector_type missing); passthrough | Provenance-blocked (D-20 refusal early-return); throttled-by-canary (applyThrottleFilter upstream) |

## Sample Payloads

Each event lands in `~/.mindrian/telemetry/v1.13/events-YYYY-WNN.jsonl` (Plan 121-00 ISO-week rotation), one JSON line per emit:

**selector_pick (D-04):**
```json
{"event":"selector_pick","schema_version":1,"timestamp":"2026-05-19T09:10:42.123Z","session_id":"abc-123","sub_shape":"F.1","mode":"A","ranker_confidence":0.73,"recommended_rendered":true,"options_count":4,"room_slug_sha256":"<64-hex>","verb_chosen":"Run Methodology"}
```

**tension_engagement (D-05):**
```json
{"event":"tension_engagement","schema_version":1,"timestamp":"2026-05-19T09:11:08.456Z","session_id":"abc-123","tension_type":"contradicts","user_response":"resolve","ttr_seconds":42,"room_slug_sha256":"<64-hex>","context_hash":"<16-hex>"}
```

**auto_explore_decision (D-06):**
```json
{"event":"auto_explore_decision","schema_version":1,"timestamp":"2026-05-19T09:12:14.789Z","session_id":"abc-123","finding_type":"whitespace","user_response":"kept","domain_match_score":0.85,"room_slug_sha256":"<64-hex>"}
```

**breakthrough_dismissed (D-07):**
```json
{"event":"breakthrough_dismissed","schema_version":1,"timestamp":"2026-05-19T09:13:55.012Z","session_id":"abc-123","detector_type":"convergence","verb_chosen":"Confirm","ethics_tier":"SOFT_BAND","voice_audit_pass":true,"room_slug_sha256":"<64-hex>"}
```

## D-06 File Path Discovery (plan-checker WARNING #4 disposition)

The plan instructed: "Locate Phase 117 auto-explore hook via `grep -rn 'auto_explore_user_response|auto-explore' lib/ scripts/ hooks/`". Multiple candidates exist:

- `scripts/auto-explore-fire.cjs` -- detached child that runs HSI + RS + Cross-Domain; emits `auto_explore_fired` upstream telemetry; does NOT receive user F.1 picks.
- `scripts/auto-explore-fingerprint.cjs` -- PostToolUse hook that fingerprints first-material and spawns fire; does NOT receive user F.1 picks.
- `scripts/auto-explore-drain.cjs` -- SessionStart drain that surfaces completed findings; does NOT receive user F.1 picks.
- `scripts/preflight-auto-explore.cjs` -- SessionStart preflight that re-surfaces unanswered findings; does NOT receive user F.1 picks.
- **`lib/agents/auto-explore-agent.cjs::handleUserResponse`** -- the SOLE function that receives user F.1 picks (EXPLORE/SKIP/LATER/FREE_TEXT) and routes them.

**Disposition:** `handleUserResponse` is the only candidate that satisfies D-06's "user-response capture surface" criterion. Gate 3 of the scaffold harness verifies the wire-in count is exactly 1 -- the invariant the plan-checker WARNING called for.

## Exclusion Conditions (Structural, Not Procedural)

Each capture point excludes specific code paths NOT by inline if-guard but by where the emit code SITS in the module's call graph:

- **D-05 decay exclusion:** the 3-strikes decay path (`evaluateAndDecay` -> `appendTension` with `state:'dropped'`) bypasses `markResolved` entirely. The wire-in is inside `markResolved`. Therefore the decay path structurally cannot emit. (Test 4 verifies: after 3 surfacings + `evaluateAndDecay`, zero `tension_engagement` rows land.)
- **D-06 system-skip exclusion:** the suppress paths in fingerprint/fire (Tier 0, just_talk, dispatcher_load_failed, all_pipelines_empty, brain_baseline_unavailable) fire from `emitSkipped`, a separate function from `handleUserResponse`. The wire-in is inside `handleUserResponse`. (Test 4 verifies: calling `emitSkipped` lands zero `auto_explore_decision` rows.)
- **D-06 FREE_TEXT exclusion:** `D06_USER_RESPONSE_MAP` is a frozen object with 3 keys (EXPLORE/LATER/SKIP). FREE_TEXT is not a key. The emit gate `if (D06_USER_RESPONSE_MAP[userResponse])` returns falsy for FREE_TEXT. (Test 4 verifies: FREE_TEXT passed to `handleUserResponse` does not emit.)
- **D-07 provenance exclusion:** the D-20 third structural enforcement (`SELECT COUNT(*) FROM edges WHERE source=? AND type='DERIVED_FROM'`) early-returns from `surfaceBreakthrough` with `{ ok:false, reason:'provenance_required' }` BEFORE the wire-in code is reached. (Test 4 verifies: a Breakthrough node with no DERIVED_FROM edges does not emit.)
- **D-07 throttle exclusion:** the canary throttle filter (`applyThrottleFilter` in `scanForBreakthroughs`) runs UPSTREAM of `surfaceBreakthrough`. Throttled candidates never reach the surfacing chokepoint. (No new test needed -- `scanForBreakthroughs` -> `surfaceBreakthrough` chain is the only call path on the production code, and the chain skips throttled candidates.)

## Test Pass Counts

| Test file | Cases | Result |
|-----------|-------|--------|
| `tests/test-121-02-selector-pick-capture.cjs` | 4 | 4/4 passed |
| `tests/test-121-02-tension-engagement-capture.cjs` | 4 | 4/4 passed |
| `tests/test-121-02-auto-explore-capture.cjs` | 4 | 4/4 passed |
| `tests/test-121-02-breakthrough-dismissed-capture.cjs` | 4 | 4/4 passed |
| **Total integration** | **16** | **16/16 passed** |
| `tests/test-121-02-scaffold.sh` | 9 gates | 9/9 green |
| `bash tests/run-all-121.sh` | 16 suites (00 + 01 + 02 + parallel 03) | 16/16 green |

**Regression fences preserved:**
- `tests/test-selector-dispatcher-120-01.cjs`: 12/12 (Phase 120-01 F.7 dispatcher contract).
- `tests/test-tension-hook-persistence.cjs`: 15/15 + `test-tension-hook-decay.cjs`: 15/15 = 30/30 (Phase 116 tension store).
- `tests/test-auto-explore-f1-integration.cjs`: 15/15 + `test-auto-explore-fire.cjs`: 10/10 = 25/25 (Phase 117 auto-explore).
- `tests/test-breakthrough-d20-end-to-end.cjs`: 4/4 + `lib/core/breakthrough/scanner.test.cjs`: 9/9 = 13/13 (Phase 120 breakthrough).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 -- Blocking] edges table has no `created_at` column**
- **Found during:** Task 4 RED test execution (Test 1).
- **Issue:** The test fixture `seedBreakthroughWithProvenance` initially inserted into the `edges` table with a `created_at` column: `INSERT INTO edges (source, target, type, properties, created_at) VALUES (?, ?, 'DERIVED_FROM', '{}', ?)`. The lazygraph minimal schema (`lib/core/lazygraph-ops.cjs:initSchema`) defines edges with only 4 columns: `(source, target, type, properties)`. Phase 109's nodes-provenance migration adds `created_at` only to `nodes`, not `edges`. Resulted in `ERR_SQLITE_ERROR: SQL logic error` on every fixture INSERT.
- **Fix:** Removed `created_at` from both INSERT statements in the test fixture (test 1 + test 2 loop). 2-line edit.
- **Files modified:** `tests/test-121-02-breakthrough-dismissed-capture.cjs` (edges INSERT statements).
- **Verification:** All 4 tests pass after the fix.
- **Committed in:** `44b59c52` (the RED commit landed AFTER this fix; only the events-file assertion was the actual RED, not the SQL).

**2. [Rule 3 -- Blocking] Scaffold harness Gate 5 was too tight on try-block proximity**
- **Found during:** Task 4 GREEN verification (first run of `tests/test-121-02-scaffold.sh`).
- **Issue:** Gate 5 initially looked back 12 lines from each `writer.emit(` for `try {`. The dispatcher's `emitSelectorPickUnified` helper is wrapped in a 30+ line outer try/catch; the `try {` keyword sits well above the 12-line preamble. Gate 5 false-failed.
- **Fix:** Expanded preamble to 60 lines; added a second predicate that the file contains a `catch (_e)` anywhere (the canonical non-blocking idiom).
- **Files modified:** `tests/test-121-02-scaffold.sh` (Gate 5 function body, ~10 lines).
- **Verification:** `bash tests/test-121-02-scaffold.sh` exits 0 with all 9 gates green.

**3. [Rule 3 -- Blocking] Scaffold harness grep patterns had unmatched parens under `set -e`**
- **Found during:** Task 4 GREEN verification (first run of scaffold).
- **Issue:** Multiple gates used `grep -c "writer\\.emit\\(['\"]selector_pick"` ERE patterns where the `\(` inside the bracket char class confused the bash double-escape rules under `set -euo pipefail`. grep emitted "Unmatched ( or \(" and Gate 5 short-circuited.
- **Fix:** Rewrote all marker greps to use `grep -cF` (fixed strings) with the literal opening-paren and opening-quote: `grep -cF "writer.emit('selector_pick"`. Added `2>/dev/null || true` and `${var:-0}` defaulting to survive zero-hit grep exit codes under pipefail.
- **Files modified:** `tests/test-121-02-scaffold.sh` (all 9 gate functions, ~20 lines total).
- **Verification:** `bash tests/test-121-02-scaffold.sh` exits 0 with all 9 gates green.

---

**Total deviations:** 3 auto-fixed (all Rule 3 -- blocking issues caught during the same task they fixed). All 3 were test/scaffold infrastructure issues that did not require any change to the wire-in source modules. Zero scope creep on the production capture points.

## Plan-Checker Advisories Addressed

The plan-checker noted one advisory (informational):

- **WARNING #4: D-06 auto-explore file resolved via grep -rn locator.** Multiple candidates exist; the plan instructed to discover the correct file at execution time. **Disposition:** Resolved to `lib/agents/auto-explore-agent.cjs::handleUserResponse` (the sole function that handles user F.1 picks). Gate 3 of the scaffold harness enforces the invariant that exactly ONE file under `lib/ scripts/ hooks/` contains `writer.emit('auto_explore_decision'`. Documented in this SUMMARY's "D-06 File Path Discovery" section.

## Known Stubs

None. Every wire-in is fully functional; every test asserts a real event-file row; the scaffold harness asserts the constitutional invariants; the run-all-121 aggregator includes the new suites. No hardcoded empty arrays, no placeholder strings, no TODO markers in source. The 4 net-new event types all carry full ALLOWED_FIELDS whitelists from Plan 121-00.

## Next Phase Readiness

- **Plan 121-04 (Hooked re-score + remaining capture points) is unblocked.** The trajectory corpus accumulates 4 high-signal event types per the SEED-002 paper (verb-pick under tri-context IS the navigation graph in motion). The Hooked-axis re-score script (`scripts/hooked-rescore-117.cjs`) already reads the unified `events-YYYY-WNN.jsonl` stream (repointed in Plan 121-01); its `RELEVANT_EVENTS` set already includes `selector_pick / auto_explore_decision / breakthrough_dismissed / mva_option_selected` for axis computation.
- **SEED-002 corpus accumulation begins immediately.** Every F-shape pick, every tension engagement, every auto-explore decision, every breakthrough surfacing now appends one row. The lab-loop activation gate (>= 100 events) will start counting from the next user interaction.
- **No regression risk for shipped surfaces.** All 80/80 regression fences (selector-dispatcher 12 + tension-hook 30 + auto-explore 25 + breakthrough 13) preserved.

## Self-Check: PASSED

Verified files on disk:
- FOUND: `lib/hmi/selector-dispatcher.cjs` (modified)
- FOUND: `lib/memory/pending-tension-store.cjs` (modified)
- FOUND: `lib/agents/auto-explore-agent.cjs` (modified)
- FOUND: `lib/core/breakthrough/scanner.cjs` (modified)
- FOUND: `tests/test-121-02-selector-pick-capture.cjs` (218 lines, 4/4 green)
- FOUND: `tests/test-121-02-tension-engagement-capture.cjs` (211 lines, 4/4 green)
- FOUND: `tests/test-121-02-auto-explore-capture.cjs` (242 lines, 4/4 green)
- FOUND: `tests/test-121-02-breakthrough-dismissed-capture.cjs` (263 lines, 4/4 green)
- FOUND: `tests/test-121-02-scaffold.sh` (159 lines, 9/9 gates green)
- FOUND: `tests/run-all-121.sh` (extended with 121-02 entries)
- FOUND: `lib/memory/run-feynman-tests.cjs` (registered 4 new test files)

Verified commits exist:
- FOUND: `35138a82` test(121-02): D-04 RED
- FOUND: `d071fa28` feat(121-02): D-04 GREEN
- FOUND: `61f5e47c` test(121-02): D-05 RED
- FOUND: `94bb5b8b` feat(121-02): D-05 GREEN
- FOUND: `7414e690` test(121-02): D-06 RED
- FOUND: `ee6b004c` feat(121-02): D-06 GREEN
- FOUND: `44b59c52` test(121-02): D-07 RED
- FOUND: `faeb4536` feat(121-02): D-07 GREEN + 9-gate scaffold

---

*Phase: 121-trajectory-telemetry*
*Plan: 02 (Capture-Point Wire-Ins, Wave 2)*
*Completed: 2026-05-19*
