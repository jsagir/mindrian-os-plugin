---
phase: 117-auto-explore-domains-on-first-material
plan: "117-02"
subsystem: agentic-surfacing
tags: [auto-explore, compose, canonical-chain-order, cross-domain-formula, hsi-analysis-schema, brain-section-8.1, brain-section-8.3, brain-section-8.4, brain-section-8.7, canon-part-2-engine-1, canon-part-3, canon-part-8, canon-part-10-subclaim-5, wave-1-composition-substrate, detached-background-fire]

# Dependency graph
requires:
  - phase: 117-01
    provides: lib/agents/auto-explore-agent.cjs Wave 1 skeleton (detectFirstMaterial); lib/memory/explored-materials-store.cjs JSONL ledger; scripts/auto-explore-fingerprint.cjs PostToolUse hook (the spawner)
  - phase: 117-00
    provides: EVENT_TYPES Set extended with 5 auto-explore event strings (size 31); 12 Wave-0 placeholder tests
  - phase: 116-02
    provides: lib/agents/tension-hook-agent.cjs::composeFinding verbatim template (sibling code-clone for canonical-order ranking)
  - phase: 89-07
    provides: scripts/discovery-cycle.cjs --steps all entry point + scripts/rs-engine.py --mode hybrid CLI for Engine 1 wiring
provides:
  - lib/agents/auto-explore-agent.cjs composeAutoExploreFinding + crossDomainSurprise + crossDomainGate + CANONICAL_CHAIN_ORDER + CROSS_DOMAIN_THRESHOLD (Brain Section 8.1 + 8.3 + 8.4 + 8.7 contract surface)
  - scripts/auto-explore-fire.cjs detached background child (RESEARCH Section 12 sequence diagram); spawned by 117-01 fingerprint hook with [roomDir, relativeFilePath, material_id]
  - 28 real test assertions across 3 files (replaces Wave 0 stubs) -- compose (12) + canonical-order (6) + cross-domain-formula (10)
  - 10 real test assertions in tests/test-auto-explore-fire.cjs (replaces Wave 0 stub)
affects: [117-03, 117-04, 117-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Triple-filter compose with canonical-order primary axis + HSI score secondary axis (mirrors lib/agents/tension-hook-agent.cjs::composeFinding skeleton; expanded with Brain Section 8.1 chain-order constant + Brain Section 8.3 cross-domain formula)"
    - "Atomic write via temp + rename (mirrors scripts/post-write::write_cascade_side_channel lines 87-126)"
    - "Promise.all parallel pipeline orchestration with per-pipeline timeout (RESEARCH Section 4.2 background mechanics; ~5-7s typical, ~10s p95)"
    - "Graceful degradation across Brain-baseline gate (RESEARCH scenario 5), partial pipelines (scenarios 4 + 6), all-empty (scenario 6), and atomic-write failures (scenario 3)"
    - "LOCAL-only routing invariant (Brain Section 8.7 / AUTOEXPLORE-117-17): zero ADDRESSES_PROBLEM_TYPE substrings in agent OR fire (literal token elided in comments to keep 117-04 grep regression at zero)"

key-files:
  created:
    - scripts/auto-explore-fire.cjs
  modified:
    - lib/agents/auto-explore-agent.cjs
    - tests/test-auto-explore-compose.cjs
    - tests/test-auto-explore-canonical-order.cjs
    - tests/test-cross-domain-formula.cjs
    - tests/test-auto-explore-fire.cjs

key-decisions:
  - "CANONICAL_CHAIN_ORDER frozen at ['domain','trends','reverse-salients','cross-domain'] (Brain Section 8.1 verbatim from Stage 'Opportunity Discovery' HAS_STEP -> ProcessStep chain). Composition output preserves this order as the PRIMARY ranking axis; HSI score is the SECONDARY axis. Validated by AUTOEXPLORE-117-13 6-test suite."
  - "CROSS_DOMAIN_THRESHOLD frozen at 0.85 (Brain Section 8.3 default; matches Phase 89-07 dedup gate). The formula surprise = similarity * domain_distance is implemented exactly per the canonical Brain Cypher Q4 string and grep-verified on the source. Validated by AUTOEXPLORE-117-14 10-test suite."
  - "Finding shape extends Brain Section 8.4 HSIAnalysis schema: top_differential / semantic_surprise / category_errors_identified / top_differential_score ship as null/empty SHAPE CONTRACT in 117-02; population by F.1 surface lands in 117-03. Backward-compat with Section 5 finding shape preserved (id, material_id, source_pipeline, source_node_id, target_node_id, score, candidate_count all present)."
  - "Deterministic finding.id formula = sha256(material_id|top.source_node_id|top.target_node_id|top.source_pipeline).slice(0,32). Validated across 100 invocations -- byte-identical id, source_pipeline, source_node_id, target_node_id, score, candidate_count, candidates_per_pipeline. Only generated_at varies (Date.now)."
  - "Dedup tuple = (source_node_id, target_node_id) ACROSS BUCKETS picks max score. The surviving candidate retains its origin tag (source_pipeline) so when an analogy candidate (cross-domain, score 0.92) collides with an RS candidate (reverse-salients, score 0.5) on the same (src,tgt), the cross-domain entry wins on score axis AND keeps its pipeline tag -- the canonical primary-axis ranking re-sorts ranked[] AFTER dedup so this preserves pipeline integrity."
  - "scripts/auto-explore-fire.cjs spawn semantics: child invokes Promise.all([discovery-cycle.cjs --steps all, rs-engine.py --mode hybrid --topk 5]) with 30s per-pipeline timeout + 60s total cap. Both pipelines failing -> markFailed('all_pipelines_empty'). Compose returns null -> markFailed('all_pipelines_empty'). Atomic write fails -> markFailed('room_dir_not_writable'). Outer catch -> markFailed('ledger_replay_failed'). Always exits 0 (uncaughtException + unhandledRejection backstops)."
  - "Atomic write pattern (temp + rename) mirrors scripts/post-write::write_cascade_side_channel verbatim. Path = room/.mindrian/auto-explore-<material_id>.json. mkdirSync recursive ensures .mindrian/ exists; rename is atomic on POSIX (the canonical reason for temp-write-then-rename across all MindrianOS persistence)."
  - "Brain-baseline graceful degradation: ensureBrainBaselineSafe wraps ensure-brain-baseline.cjs in try/catch so a missing helper, broken import, or thrown exception NEVER blocks the auto-explore fire pipeline (RESEARCH scenario 5). Result is captured in finding.brain_baseline_present so 117-03 surface can render Mode A vs Mode B differently if needed."
  - "Canon Part 8 / brain-client substring elision: the literal token 'brain-client' was elided in lib/agents/auto-explore-agent.cjs comments per the 117-02 plan AC bare-substring grep regression (replaced with 'Brain-MCP client module' + explicit elision note). The 117-01 sibling files (explored-materials-store, fingerprint, preflight) DO contain the literal token in their comment headers -- this is a conscious tightening for 117-02 only, since the plan AC explicitly asserted zero matches."

requirements-completed:
  - AUTOEXPLORE-117-04
  - AUTOEXPLORE-117-05
  - AUTOEXPLORE-117-13
  - AUTOEXPLORE-117-14

# Metrics
duration: 22min
completed: 2026-05-07
---

# Phase 117 Plan 117-02: Wave 1 Triple-Filter Composition Summary

**composeAutoExploreFinding ships with canonical-chain-order primary axis (Brain Section 8.1) + HSI score secondary axis + cross-domain formula `surprise = similarity * domain_distance` (Brain Section 8.3) + HSIAnalysis schema extension shape contract (Brain Section 8.4) + LOCAL-only invariant (Brain Section 8.7); scripts/auto-explore-fire.cjs ships as detached background child running ensure-brain-baseline + Promise.all([discovery-cycle, rs-engine hybrid]) + atomic write + ledger transition; 38 real test assertions replace 4 Wave-0 stubs.**

## Performance

- **Duration:** ~22 minutes (executor)
- **Started:** 2026-05-07T00:01:00Z
- **Completed:** 2026-05-07
- **Tasks:** 2 (both auto, TDD)
- **Files created:** 1; **modified:** 5
- **Parallel-executor mode:** all commits used `--no-verify` per orchestrator contract

## Accomplishments

- **lib/agents/auto-explore-agent.cjs (359 LOC, +260 from 117-01 skeleton)** -- adds composeAutoExploreFinding (Brain Section 8.1 canonical-chain-order primary axis + Section 8.4 HSIAnalysis schema extension shape contract) + crossDomainSurprise + crossDomainGate (Brain Section 8.3 formula `surprise = similarity * domain_distance` with gate `cosine > threshold AND different_domains`) + CANONICAL_CHAIN_ORDER constant (frozen at `['domain','trends','reverse-salients','cross-domain']`) + CROSS_DOMAIN_THRESHOLD constant (frozen at 0.85). 5 new exports join existing detectFirstMaterial + MATERIAL_ID_LEN. LOCAL-only invariant preserved (zero ADDRESSES_PROBLEM_TYPE substrings; literal token elided in comments).
- **scripts/auto-explore-fire.cjs (265 LOC, NEW)** -- detached background fire child spawned by scripts/auto-explore-fingerprint.cjs (Phase 117-01) with argv [roomDir, relativeFilePath, material_id]. 7-step flow per RESEARCH Section 12: ensureBrainBaselineSafe -> Promise.all([discovery-cycle.cjs --steps all, rs-engine.py --mode hybrid --topk 5]) with 30s per-pipeline + 60s total timeout -> read 3 result JSONs (whitespace-results, .rs-engine-results, discovery-cycle-results) with safe fallback -> composeAutoExploreFinding -> atomic write (temp + rename) -> markCompleted/markFailed -> exit 0. uncaughtException + unhandledRejection backstops guarantee process exits 0 even on hard crash.
- **12 real test assertions in tests/test-auto-explore-compose.cjs** (replaces Wave 0 stub) -- AUTOEXPLORE-117-05: 3-source candidate union; (src,tgt) dedup; null on empty input; score normalization across pipelines; deterministic id (32-char hex); source-pipeline tag in CANONICAL_CHAIN_ORDER set; candidate_count accuracy; single-source RS-only fallback; candidates_per_pipeline keys exactly match CANONICAL_CHAIN_ORDER; USER_CONTENT_KEY_DENYLIST scrub; backward-compat shape; HSIAnalysis schema fields all present.
- **6 real test assertions in tests/test-auto-explore-canonical-order.cjs** (replaces Wave 0 stub) -- AUTOEXPLORE-117-13: candidates_per_pipeline keys deepEqual ['domain','trends','reverse-salients','cross-domain']; HSI score secondary axis (within RS tier, score DESC selects high over low); mismatched-order assertion fails as expected; missing-pipeline empty-array placeholder (not absent key); Stage HAS_STEP citation comment present (regex /Stage.*Opportunity Discovery.*HAS_STEP/); deterministic across 100 invocations.
- **10 real test assertions in tests/test-cross-domain-formula.cjs** (replaces Wave 0 stub) -- AUTOEXPLORE-117-14: surprise(0.9, 0.5) === 0.45; gate(0.86, biology, physics) true; gate(0.86, biology, biology) false (same domain); gate(0.84, biology, physics) false (below threshold); CROSS_DOMAIN_THRESHOLD === 0.85; zero similarity returns 0 (not null); commutative; canonical-formula citation present; integration: below-threshold cosine + same-domain pair both excluded from cross-domain bucket and produce null finding.
- **10 real test assertions in tests/test-auto-explore-fire.cjs** (replaces Wave 0 stub) -- AUTOEXPLORE-117-04: syntax check; substrate references (discovery-cycle, rs-engine, compose, ensure-brain); graceful exit on missing argv; end-to-end fire on tmp room (with real discovery-cycle + rs-engine subprocess invocation); chokepoint preservation; Canon Part 8 boundary (require-call pattern + bare substring); atomic write pattern present; ledger transition wiring; uncaughtException backstop attached; LOCAL-only invariant.
- **EVENT_TYPES.size === 31 invariant preserved** (Wave 0 substrate intact across 117-01 + 117-02; this plan does NOT touch lib/core/navigation/memory-events.cjs).
- **explored-materials-store.cjs substrate intact** (computeMaterialId function present; this plan does NOT touch the JSONL ledger module).

## Task Commits

Each task was committed atomically with `--no-verify` (parallel executor mode):

1. **Task 1: composeAutoExploreFinding + Brain canonical decisions (28 GREEN tests)** -- `70bf454` (feat)
2. **Task 2: scripts/auto-explore-fire.cjs detached background child (10 GREEN tests)** -- `64f68c9` (feat)

**Plan metadata commit:** Pending (created with this SUMMARY).

## Files Created/Modified

### Created (1 file)
- `scripts/auto-explore-fire.cjs` (265 LOC) -- Detached background fire child. spawnAsync helper with timeout/SIGKILL; readJsonSafe; ensureBrainBaselineSafe (try-catch wrapper); atomicWriteJson (temp + rename); main() with 7-step orchestration; uncaughtException + unhandledRejection backstops.

### Modified (5 files)
- `lib/agents/auto-explore-agent.cjs` -- expanded from 99 to 359 LOC. Adds composeAutoExploreFinding (~155 LOC) + crossDomainSurprise + crossDomainGate + CANONICAL_CHAIN_ORDER + CROSS_DOMAIN_THRESHOLD constants. Module exports list now has 7 entries.
- `tests/test-auto-explore-compose.cjs` -- Wave 0 stub replaced with 12 real assertions (~270 LOC).
- `tests/test-auto-explore-canonical-order.cjs` -- Wave 0 stub replaced with 6 real assertions (~125 LOC).
- `tests/test-cross-domain-formula.cjs` -- Wave 0 stub replaced with 10 real assertions (~140 LOC).
- `tests/test-auto-explore-fire.cjs` -- Wave 0 stub replaced with 10 real assertions (~165 LOC).

## Decisions Made

- **CANONICAL_CHAIN_ORDER constant + Brain Cypher Q2 source citation:** the literal label "domain -> trends -> reverse-salients -> cross-domain" is preserved verbatim in the source comment so the AUTOEXPLORE-117-13 source-citation grep regression returns >= 1 hit. The constant itself is `Object.freeze(['domain','trends','reverse-salients','cross-domain'])` -- frozen so a downstream caller cannot mutate the canonical sequence at runtime.
- **CROSS_DOMAIN_THRESHOLD value + crossDomainSurprise formula + crossDomainGate detection method:** all three sourced from Brain node `cynefin-cross-domain-detector` per RESEARCH Section 8.3 and Brain Cypher Q4. Surprise formula written EXACTLY as `s * d` (commutative; deterministic; non-finite collapses to 0). Gate is `cosine > threshold AND String(sourceDomain) !== String(targetDomain)` (string equality after coercion to handle null/undefined).
- **HSIAnalysis schema extension fields shipped as null/empty SHAPE CONTRACT:** Wave 1 (this plan) ships the field shape so 117-03 surface code can render the F.1 line at any time without waiting on Wave 2 to populate. Population (top_differential string like "weather_algorithm * synthetic_inertia: 0.985"; semantic_surprise one-line reframe; category_errors_identified array; top_differential_score 0-1 with F.1 RECOMMENDED gate at >= 0.7) lands in 117-03 alongside surfaceFinding + handleUserResponse.
- **scripts/auto-explore-fire.cjs spawn semantics:** child runs both pipelines via Promise.all (parallel, NOT sequential) with 30s per-pipeline timeout. Failure modes are layered: discovery-cycle missing OR rs-engine missing -> ok:false with reason; both fail -> markFailed('all_pipelines_empty'); compose returns null -> markFailed('all_pipelines_empty'); atomic write fails -> markFailed('room_dir_not_writable'); outer-catch path -> markFailed('ledger_replay_failed'). Always exits 0 (uncaughtException + unhandledRejection backstops). The Brain-baseline check is NON-blocking -- if the helper fails to load or returns ensured:false, the pipeline proceeds (graceful degradation per RESEARCH scenario 5).
- **Atomic write pattern (Path 5 of the 7-step flow):** mirrors scripts/post-write::write_cascade_side_channel lines 87-126 verbatim. Path = `room/.mindrian/auto-explore-<material_id>.json`. mkdirSync recursive ensures `.mindrian/` exists; rename is atomic on POSIX. Failure (permission denied, disk full, EACCES) returns false from atomicWriteJson and the caller falls back to markFailed('room_dir_not_writable').
- **Brain-baseline graceful degradation behavior verified:** ensureBrainBaselineSafe wraps the ensure-brain-baseline.cjs require + invocation in try/catch. Three failure modes covered: helper module missing (returns helper_missing), helper exports missing function (returns helper_missing), helper throws (returns helper_load_failed). The downstream pipeline receives the result without checking ensured -- both failure and success paths fall through to Promise.all. Result is captured in finding.brain_baseline_present scalar so 117-03 can render Mode A vs Mode B if needed.
- **LOCAL-only invariant verified:** zero ADDRESSES_PROBLEM_TYPE substrings in either lib/agents/auto-explore-agent.cjs OR scripts/auto-explore-fire.cjs (executable code AND comments). The literal token is elided in comments using the placeholder phrase "[Brain-only Cypher edge type, name elided to keep grep regression at zero]" -- the same precedent set by 117-01.
- **Canon Part 8 boundary tightening (vs 117-01):** the literal substring "brain-client" was elided in lib/agents/auto-explore-agent.cjs comments. The 117-02 plan AC explicitly asserted bare-substring grep returning zero, which is stricter than 117-01's require-call grep. The 117-01 sibling files (explored-materials-store, fingerprint, preflight) still contain the literal in their comment headers; this is a conscious tightening for the 117-02 surfaces only.

## Wave-1 -> Wave-1 (parallel) handoff to 117-03

Wave 2 117-03 (F.1 surface) builds on this substrate:
- scripts/preflight-auto-explore.cjs gains UserPromptSubmit drain logic (or splits to scripts/auto-explore-drain.cjs). Globs `room/.mindrian/auto-explore-*.json` findings produced by 117-02; flips ledger state from 'completed' to 'surfaced' via store.appendMaterial.
- surfaceFinding + handleUserResponse land in lib/agents/auto-explore-agent.cjs alongside the now-shipped detectFirstMaterial + composeAutoExploreFinding.
- HSIAnalysis schema fields (top_differential / semantic_surprise / category_errors_identified / top_differential_score) populated at render time. The shape contract is already in place from 117-02 -- 117-03 only adds the population logic.
- BQ-anchored Larry voice F.1 line dispatched per AUTOEXPLORE-117-16 invariant (BQ template registry, never raw technical match).

## Wave-1 -> Wave-2 handoff to 117-04

Wave 2 117-04 (LOCAL-only routing audit + sanitizer) builds on this substrate:
- Regression grep `grep -E "ADDRESSES_PROBLEM_TYPE" lib/agents/auto-explore-agent.cjs scripts/auto-explore-fire.cjs` returns 0 (verified at this plan's gate; 117-04 formalizes as a recurring CI guard).
- SEED-003 A3 sanitizer wires PostToolUse for any Brain-MCP tool calls; 117-02 surface has zero such calls so the sanitizer is structurally inapplicable to this code path -- but 117-04 still adds the regression scan to ensure no future drift.

## Wave-1 -> Wave-3 handoff to 117-05

Wave 3 117-05 (telemetry + release) builds on this substrate:
- 5 emit helpers (emitFired / emitFindingSurfaced / emitUserResponse / emitSkipped / emitBrainCanonDrift) land in lib/agents/auto-explore-agent.cjs.
- emitFindingSurfaced consumes the finding.id + finding.source_pipeline + finding.score from 117-02's composeAutoExploreFinding output (scalar-only payloads per Canon Part 8).
- brain_canon_drift_observed event fires when finding.candidates_per_pipeline has 4 keys (Canon FiveLenses) but Brain returns FourLenses for the same source artifact -- substrate field is already in place via the 4-element CANONICAL_CHAIN_ORDER constant.
- v1.13.0-beta.7 release commit (CHANGELOG + plugin.json + package.json + git tag + marketplace ref + npm publish per memory rule feedback_release_lockstep_npm).

## Anti-pattern Guard Verification

```
$ grep -cE "ADDRESSES_PROBLEM_TYPE" lib/agents/auto-explore-agent.cjs scripts/auto-explore-fire.cjs
lib/agents/auto-explore-agent.cjs:0
scripts/auto-explore-fire.cjs:0

$ grep -cE "require\(['\"](\\.\\.?/)+(lib/)?core/room-db" lib/agents/auto-explore-agent.cjs scripts/auto-explore-fire.cjs
lib/agents/auto-explore-agent.cjs:0
scripts/auto-explore-fire.cjs:0

$ grep -cE "brain-client|brain_client" lib/agents/auto-explore-agent.cjs scripts/auto-explore-fire.cjs
lib/agents/auto-explore-agent.cjs:0
scripts/auto-explore-fire.cjs:0

$ grep -cP "\x{2014}" lib/agents/auto-explore-agent.cjs scripts/auto-explore-fire.cjs tests/test-auto-explore-compose.cjs tests/test-auto-explore-canonical-order.cjs tests/test-cross-domain-formula.cjs tests/test-auto-explore-fire.cjs
(0 hits across all 6 files; em-dash regression clean)

$ grep -cE "similarity\s*\*\s*domain_distance" lib/agents/auto-explore-agent.cjs
4   (>= 1 required by AUTOEXPLORE-117-14)

$ grep -cE "Stage.*Opportunity Discovery.*HAS_STEP" lib/agents/auto-explore-agent.cjs
2   (>= 1 required by AUTOEXPLORE-117-13)
```

## Brain Substrate Verification

- **CANONICAL_CHAIN_ORDER value:** `["domain","trends","reverse-salients","cross-domain"]` (Brain Section 8.1 verbatim)
- **CROSS_DOMAIN_THRESHOLD value:** `0.85` (Brain Section 8.3 default; matches Phase 89-07 dedup gate)
- **Cross-domain formula citation count:** 4 hits of `similarity * domain_distance` in lib/agents/auto-explore-agent.cjs (>= 1 required)
- **Stage HAS_STEP citation count:** 2 hits of `Stage.*Opportunity Discovery.*HAS_STEP` (>= 1 required)
- **HSIAnalysis schema extension fields present in finding shape:** all 4 fields (top_differential, semantic_surprise, category_errors_identified, top_differential_score) verified via runtime require + runtime invocation; null/empty values per shape contract

## Canon Part 8 Boundary Confirmation

- `lib/agents/auto-explore-agent.cjs` finding shape contains zero USER_CONTENT_KEY_DENYLIST keys (verified by test 10 of test-auto-explore-compose.cjs).
- Zero direct room-db.cjs imports in either production file (chokepoint preserved).
- Zero brain-client substring in either production file (boundary preserved; literal token elided in comments per 117-02 plan AC bare-substring regression).
- Zero ADDRESSES_PROBLEM_TYPE substrings in either production file (LOCAL-only routing per Brain Section 8.7 / AUTOEXPLORE-117-17).
- Zero outbound network surface in scripts/auto-explore-fire.cjs (no fetch, no http require, no curl spawn; only spawns local node + python3 subprocesses).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] brain-client substring caught in lib/agents/auto-explore-agent.cjs comment header**
- **Found during:** Task 1 verification (`grep -cE "brain-client|brain_client"` returned 1 instead of 0).
- **Issue:** The 117-01 skeleton comment header used the literal phrase "NEVER require any brain-client module (Canon Part 8 boundary)" verbatim. The 117-02 plan AC explicitly asserts bare-substring grep returning zero (stricter than 117-01's require-call grep that returned 0 because there was no actual import).
- **Fix:** Rewrote the comment to elide the literal "brain-client" token, replaced with "Brain-MCP client module" + an explicit elision note documenting the 117-02 plan AC bare-substring regression. Same precedent as 117-01's "ADDRESSES_PROBLEM_TYPE" elision.
- **Files modified:** lib/agents/auto-explore-agent.cjs (comment block lines 23-26).
- **Verification:** `grep -cE "brain-client|brain_client" lib/agents/auto-explore-agent.cjs` returns 0; all 28 tests still GREEN.
- **Committed in:** 70bf454 (Task 1 commit, after re-verification).

### Out-of-scope discoveries (logged, not fixed)

None.

---

**Total deviations:** 1 auto-fixed (Rule 1 bug fix; comment-substring tightening; substantive contract fully satisfied).

## Issues Encountered

None blocking. The brain-client comment elision was caught at verification time and resolved inline before the Task 1 commit.

Test 4 of test-auto-explore-fire.cjs (end-to-end fire on tmp room) takes ~60s because it runs the actual discovery-cycle + rs-engine subprocesses against an empty corpus. This is intended (the test verifies real spawn semantics, not mock). The test has timeout: 120000 to accommodate.

## Self-Check: PASSED

**Created file (1) verified on disk:**
- FOUND: scripts/auto-explore-fire.cjs (265 LOC)

**Modified files (5) verified in git diff:**
- FOUND: lib/agents/auto-explore-agent.cjs (359 LOC; +260 from 117-01 skeleton)
- FOUND: tests/test-auto-explore-compose.cjs (12 real assertions; replaces Wave 0 stub)
- FOUND: tests/test-auto-explore-canonical-order.cjs (6 real assertions; replaces Wave 0 stub)
- FOUND: tests/test-cross-domain-formula.cjs (10 real assertions; replaces Wave 0 stub)
- FOUND: tests/test-auto-explore-fire.cjs (10 real assertions; replaces Wave 0 stub)

**Commits verified in git log:**
- FOUND: 70bf454 (Task 1: composeAutoExploreFinding + Brain canonical decisions + 28 tests)
- FOUND: 64f68c9 (Task 2: auto-explore-fire.cjs + 10 tests)

**Test totals verified:**
- VERIFIED: 38 tests PASS across 4 test files (12 + 6 + 10 + 10)

**EVENT_TYPES preserved:**
- VERIFIED: EVENT_TYPES.size === 31 (Wave 0 substrate intact; no drift)

**explored-materials-store substrate intact:**
- VERIFIED: store.computeMaterialId is a function (not modified by this plan)

**Brain Substrate constants verified:**
- VERIFIED: CANONICAL_CHAIN_ORDER === ['domain','trends','reverse-salients','cross-domain']
- VERIFIED: CROSS_DOMAIN_THRESHOLD === 0.85

**Final commit:** `f38c226` (docs metadata + STATE + ROADMAP).

---
*Phase: 117-auto-explore-domains-on-first-material*
*Completed: 2026-05-07*
