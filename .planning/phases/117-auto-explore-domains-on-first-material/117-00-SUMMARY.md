---
phase: 117-auto-explore-domains-on-first-material
plan: "117-00"
subsystem: agentic-surfacing
tags: [auto-explore, agentic, graph-native, canon-part-2-engine-1, canon-part-3, canon-part-10-subclaim-5, event-types, wave-0-scaffold, brain-substrate]

# Dependency graph
requires:
  - phase: 88.2-uiux-selector-block
    provides: F.1 Next Move dispatcher via lib/hmi/selector-dispatcher.cjs::pickShape
  - phase: 89-reverse-salient-engine (Wave-0 89-07-00 scaffold + Wave-0 116-00 scaffold)
    provides: dual-surface telemetry mirror pattern + Wave-0 stub-then-fill template
  - phase: 109-sql-context-memory-navigation-spine
    provides: lib/core/navigation.cjs read chokepoint + EVENT_TYPES Set + logEvent/findRecentChanges
provides:
  - EVENT_TYPES Set extended with 5 auto-explore event strings (size 26 -> 31; 4 lifecycle + 1 brain_canon_drift_observed)
  - 12 Wave-0 placeholder tests registered in Feynman runner (6 Section 5 + 6 Section 8 net-new including brain-canon-drift)
  - Wave-0 scaffold harness (tests/test-117-00-scaffold.sh) asserting 5-gate contract + EVENT_TYPES.size===31 + 16 deliverables + 0 em-dashes
  - Idempotent Brain Cypher patch (cypher/phase117-auto-explore-completion.cypher) with 16 MERGE statements including IMPLEMENTS_SUBCLAIM + CONSUMES_PATTERN + READS_VIA + SURFACES_VIA + 3x COMPOSES Engine1Layer cluster (post-release apply)
  - Offline fallback shape (.mindrian/auto-explore-framework-snapshot.json) encoding canonical_chain_order (Brain Section 8.1) + cross_domain_formula (Section 8.3) + lens_count_drift_acknowledged (Section 8.6)
affects: [117-01, 117-02, 117-03, 117-04, 117-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-0 stub-then-fill pattern (CJS test stubs that PASS today verifying only the EVENT_TYPES substrate; real assertions land in Waves 1-3 as detection / compose / F.1 / sanitizer / telemetry modules ship)"
    - "EVENT_TYPES additive tail-append (Phase 88.2-00 + 89-07-00 + 116-00 precedent: Object.freeze invariant preserved, no reorder, provenance comment block above new entries)"
    - "Idempotent Cypher patch pattern (MERGE not CREATE; safe to re-apply post-release per 89-07 + 116-00 precedent)"
    - "Force-add gitignored .mindrian/ schema template (Wave-0 deliverable tracked in plan files_modified; runtime state remains gitignored)"
    - "Brain Substrate enrichment Section 8: canonical chain order + cross-domain formula property + lens-count drift acknowledgment surface in offline snapshot AND cypher (Engine1Layer cluster)"

key-files:
  created:
    - tests/test-auto-explore-event-types.cjs
    - tests/test-auto-explore-fingerprint.cjs
    - tests/test-explored-materials-store.cjs
    - tests/test-auto-explore-fire.cjs
    - tests/test-auto-explore-compose.cjs
    - tests/test-auto-explore-f1-integration.cjs
    - tests/test-auto-explore-canonical-order.cjs
    - tests/test-cross-domain-formula.cjs
    - tests/test-finding-hsi-schema.cjs
    - tests/test-f1-bq-template.cjs
    - tests/test-detection-routing-local-only.cjs
    - tests/test-brain-canon-drift-event.cjs
    - tests/test-117-00-scaffold.sh
    - cypher/phase117-auto-explore-completion.cypher
    - .mindrian/auto-explore-framework-snapshot.json
  modified:
    - lib/core/navigation/memory-events.cjs
    - lib/memory/run-feynman-tests.cjs

key-decisions:
  - "EVENT_TYPES additive tail-append after 116-00 block; 5 strings appended (4 auto_explore lifecycle + brain_canon_drift_observed); Object.freeze invariant preserved; size 26 -> 31"
  - "Wave-0 test stubs PASS today (not RED); they verify only the EVENT_TYPES substrate; real assertions referencing pending modules (lib/agents/auto-explore-agent.cjs, lib/memory/explored-materials-store.cjs, scripts/preflight-auto-explore.cjs, scripts/brain-response-sanitize.cjs) land in Waves 1-3 as those modules ship"
  - "Cypher patch lands as a FILE at Wave 0 but is NOT applied at this wave (post-release per 89-07 Q5 + 116-00 precedent); 16 MERGE shapes are idempotent so post-release apply is safe"
  - "Cypher patch encodes Engine1Layer cluster (3 nodes: WhitespaceMap + ReverseSalient + CrossDomainMatch) per Canon Part 2 Engine 1 with cross-domain formula property; Phase 116-00 cypher does not have this cluster"
  - "Offline snapshot encodes Brain Section 8.1 canonical_chain_order (4 steps) + Section 8.3 cross_domain_formula (threshold 0.85 matches Phase 89-07 dedup gate) + Section 8.6 lens_count_drift_acknowledged (brain=4 vs canon=5; use_canon=true)"
  - ".mindrian/auto-explore-framework-snapshot.json force-added (gitignored path) per 116-00 precedent (which used same precedent from 89-07 commit ec6026d)"
  - "Phase 117 ships in v1.13.0-beta.7 (the canonical pin); Wave 0 plan does NOT do a release commit — that is 117-05's job"

requirements-completed:
  - AUTOEXPLORE-117-01
  - AUTOEXPLORE-117-13 (stub; real assertions in 117-02)
  - AUTOEXPLORE-117-14 (stub; real assertions in 117-02)
  - AUTOEXPLORE-117-15 (stub; real assertions in 117-03)
  - AUTOEXPLORE-117-16 (stub; real assertions in 117-03)
  - AUTOEXPLORE-117-17 (stub; real assertions in 117-04)
  - AUTOEXPLORE-117-18 (stub; real assertions in 117-05)

# Metrics
duration: 9min
completed: 2026-05-06
---

# Phase 117 Plan 117-00: Wave-0 Preflight Scaffold Summary

**Lands EVENT_TYPES.size 26 -> 31 + 16-file Wave-0 contract for AutoExploreDomains so Waves 1-3 execute against real assertions instead of missing-test failure modes; mirrors 116-00 + 89-07-00 pattern with Section 8 Brain Substrate enrichment (Engine1Layer cluster + cross-domain formula + lens-count drift).**

## Performance

- **Duration:** ~9 minutes (executor)
- **Started:** 2026-05-06 (executor invocation post-beta.6 ship)
- **Completed:** 2026-05-06
- **Tasks:** 3 (all auto)
- **Files created:** 15; **modified:** 2
- **Parallel-executor mode:** all commits used `--no-verify` per orchestrator contract

## Accomplishments

- EVENT_TYPES Set extended with 5 new strings: `auto_explore_fired`, `auto_explore_finding_surfaced`, `auto_explore_user_response`, `auto_explore_skipped`, `brain_canon_drift_observed` (size 26 -> 31); all 26 prior strings byte-identical, Object.freeze invariant preserved
- 16-file Wave-0 contract on disk: 12 test stubs + 1 scaffold harness + 1 Cypher patch + 1 offline snapshot + EVENT_TYPES extension + Feynman runner registration
- 12 placeholder tests registered in `lib/memory/run-feynman-tests.cjs` TEST_FILES with Phase 117-00 Wave 0 provenance comment block (6 Section 5 + 6 Section 8 net-new), inserted immediately after the Phase 116-00 Wave 0 block
- Scaffold harness (`tests/test-117-00-scaffold.sh`) PASSES 5 gates: EVENT_TYPES strings + Feynman registration count == 12 + 16 deliverables + size 31 + zero em-dashes; exits 0 with `OK: 117-00 scaffold complete (5 EVENT_TYPES strings + 12 test stubs + Feynman registration + size 31 + zero em-dashes)`
- All 12 placeholder tests PASS via `node --test`: 20 tests, 0 failures, 0 skipped, ~419ms total
- Cypher patch is idempotent (16 MERGE statements, 0 bare CREATE, only `ON CREATE SET` phrasing inside MERGE)
- Cypher patch is Canon Part 8 clean (zero user-content matches: no body_text, no source_title, no proper nouns of customers)
- Cypher patch encodes Engine1Layer cluster (WhitespaceMap + ReverseSalient + CrossDomainMatch with `formula = 'similarity * domain_distance'` property) per Canon Part 2 Engine 1 — net-new vs Phase 116-00
- Offline snapshot is valid JSON encoding Brain Section 8.1 canonical_chain_order (4 steps) + Section 8.3 cross_domain_formula (threshold 0.85) + Section 8.6 lens_count_drift_acknowledged (brain=4 vs canon=5; axis=lens_count; use_canon=true)
- Phase 116 + 89-07 EVENT_TYPES regression preserved (`tension_detected`, `reverse_salient_detected`, `node_created`, `focus_changed`, `selector_presentation` all still present)

## Task Commits

Each task was committed atomically with `--no-verify` (parallel executor mode):

1. **Task 1: Extend EVENT_TYPES Set with 5 new auto-explore event strings (size 26 -> 31)** - `21d94d6` (feat)
2. **Task 2: Add 12 Wave 0 RED stubs + register in Feynman runner** - `003f24e` (test)
3. **Task 3: Add Wave 0 scaffold harness + cypher patch + offline snapshot** - `769ae8c` (feat)

**Plan metadata commit:** Pending (created with this SUMMARY).

## Files Created/Modified

### Created (15 files)
- `tests/test-auto-explore-event-types.cjs` (~28 lines) - Wave-0 placeholder for AUTOEXPLORE-117-01 (EVENT_TYPES extension). Verifies all 5 new strings + size 31 + Phase 116/89-07 regression. Wave 3 (117-05) fills with real `emitFired`/`emitFindingSurfaced`/`emitUserResponse`/`emitSkipped`/`emitBrainCanonDrift` assertions.
- `tests/test-auto-explore-fingerprint.cjs` (~18 lines) - Wave-0 placeholder for AUTOEXPLORE-117-02 (material_id determinism). Verifies `EVENT_TYPES.has('auto_explore_fired')` + `EVENT_TYPES.has('auto_explore_skipped')`. Wave 1 (117-01) fills with sha256-of-(path,mtime,size) determinism, mtime sensitivity, room-section walker, rate-limit-by-record/day, three-surface ledger path.
- `tests/test-explored-materials-store.cjs` (~22 lines) - Wave-0 placeholder for AUTOEXPLORE-117-03 (JSONL ledger). Verifies fired + skipped event registration. Wave 1 (117-01) fills with append/read/computeMaterialId/findLatest/validateEntryShape/USER_CONTENT denylist/JSONL LWW replay/idempotency/workspace-guard/atomic write.
- `tests/test-auto-explore-fire.cjs` (~16 lines) - Wave-0 placeholder for AUTOEXPLORE-117-04 (detached spawn). Verifies fired event registered. Wave 1 (117-02) fills with detached-spawn/parent-unref/child-writes-results/timeout/partial-pipeline-degradation/brain-baseline-gating.
- `tests/test-auto-explore-compose.cjs` (~28 lines) - Wave-0 placeholder for AUTOEXPLORE-117-05 (triple-filter compose). Verifies all 5 new strings + finding-surfaced placeholder for deterministic-id assertion. Wave 1 (117-02) fills with 3-source dedup/max-score selection/deterministic id/empty-input null/score normalization/candidate count/weight calibration/single-source fallback/source-pipeline tag/deterministic across runs.
- `tests/test-auto-explore-f1-integration.cjs` (~26 lines) - Wave-0 placeholder for AUTOEXPLORE-117-06 (F.1 dispatch). Verifies finding_surfaced + user_response + skipped strings. Wave 2 (117-03) fills with F.1 dispatch/tier-0 suppress/JUST_TALK suppress/dispatcher error suppress/verb labels/recommendedVerb null in Mode B/emitTelemetry/contract shape/three-surface render parity/persona suffix absent/parent_decision_id format.
- `tests/test-auto-explore-canonical-order.cjs` (~22 lines) - Wave-0 placeholder for AUTOEXPLORE-117-13 (Brain Section 8.1 canonical chain order). Verifies fired event registered. Wave 1 (117-02) fills with canonical order assertion: domain -> trends -> reverse-salients -> cross-domain.
- `tests/test-cross-domain-formula.cjs` (~22 lines) - Wave-0 placeholder for AUTOEXPLORE-117-14 (Brain Section 8.3 cross-domain formula). Verifies fired event registered. Wave 1 (117-02) fills with `surprise = similarity * domain_distance` formula + threshold 0.85 + commutative match.
- `tests/test-finding-hsi-schema.cjs` (~24 lines) - Wave-0 placeholder for AUTOEXPLORE-117-15 (Brain Section 8.4 HSIAnalysis schema extension). Verifies finding_surfaced event registered. Wave 2 (117-03) fills with top_differential/semantic_surprise/category_errors_identified/top_differential_score schema + F.1 RECOMMENDED >= 0.7 gate.
- `tests/test-f1-bq-template.cjs` (~24 lines) - Wave-0 placeholder for AUTOEXPLORE-117-16 (Brain Section 8.5 BQ-anchored Larry voice). Verifies finding_surfaced event registered. Wave 2 (117-03) fills with BQ template registry hits + GUIDED_BY/GENERATES_MATRIX patterns + persona-blend BQ selection.
- `tests/test-detection-routing-local-only.cjs` (~18 lines) - Wave-0 placeholder for AUTOEXPLORE-117-17 (Brain Section 8.7 LOCAL-only detection routing). Verifies fired event registered. Wave 2 (117-04) fills with grep assertion that zero `ADDRESSES_PROBLEM_TYPE` Brain calls exist in `lib/agents/auto-explore-agent.cjs`.
- `tests/test-brain-canon-drift-event.cjs` (~22 lines) - Wave-0 placeholder for AUTOEXPLORE-117-18 (Brain Section 8.6 brain_canon_drift_observed event). Verifies brain_canon_drift_observed registered alongside fired event. Wave 3 (117-05) fills with axis=lens_count + brain_count=4 + canon_count=5 + JSONL telemetry write + no Brain write-back.
- `tests/test-117-00-scaffold.sh` (~74 lines, 0755 executable) - 5-gate scaffold harness. Gate 1: 5 EVENT_TYPES strings present in memory-events.cjs. Gate 2: TEST_FILES registration count == 12 (locked). Gate 3: 16 deliverable files present. Gate 4: EVENT_TYPES.size === 31 (runtime check). Gate 5: 0 em-dashes in 117-00 deliverables (printf-encoded literal U+2014 to keep harness em-dash-free per memory rule).
- `cypher/phase117-auto-explore-completion.cypher` (~46 lines) - Idempotent Brain stub completion patch. 16 MERGE statements: AutoExploreDomains agent (version 1.13.0-beta.7) + Part-10-sub-claim-5 CanonPart + IMPLEMENTS_SUBCLAIM + AgenticSurfacingPattern + CONSUMES_PATTERN + PostingNavigationCjs Substrate + READS_VIA + F.1 Selector + SURFACES_VIA + 3x Engine1Layer (WhitespaceMap + ReverseSalient + CrossDomainMatch with `formula` property) + 3x COMPOSES edges. 0 bare CREATE (only `ON CREATE SET` allowed inside MERGE). Carries ONLY framework-name handles + plugin-path + version scalars (Canon Part 8: zero user content). Applied post-release per 89-07 Q5 + 116-00 precedent. NET-NEW vs 116-00: Engine1Layer cluster + cross-domain formula property.
- `.mindrian/auto-explore-framework-snapshot.json` (~25 lines, force-added) - Offline fallback shape encoding Brain Section 8 substrate decisions: `canonical_chain_order` (4-step canonical order from Section 8.1), `cross_domain_formula` (surprise formula + threshold 0.85 + gate from Section 8.3), `lens_count_drift_acknowledged` (brain_count=4 vs canon_count=5; axis=lens_count; use_canon=true; drift_event_emitted_at=117-05 from Section 8.6). `canon_part_8_compliant: true`. Forward-compat scaffold for v1.13.x tuning.

### Modified (2 files)
- `lib/core/navigation/memory-events.cjs` - EVENT_TYPES Set extended at tail with 5 new strings + Phase 117-00 Wave 0 provenance comment block (cites RESEARCH Section 4.7 + 8.6 and the 89-07 + 116-00 dual-surface telemetry mirror precedent); 26 prior strings byte-identical; Object.freeze invariant preserved.
- `lib/memory/run-feynman-tests.cjs` - 12 path.join entries appended at end of TEST_FILES with Phase 117-00 Wave 0 provenance comment, immediately after the Phase 116-00 Wave 0 block; existing entries byte-identical.

## Decisions Made

- **EVENT_TYPES additive tail-append (4 + 1 = 5 strings):** Same 88.2-00 + 89-07-00 + 116-00 precedent. The 5th string `brain_canon_drift_observed` is locked at 117-00 substrate (size 31 invariant) so Phase 117-05 emits via the existing event_type without a separate EVENT_TYPES extension. Plan-checker iteration 1 B5 fix locked this.
- **Test stubs PASS today (not RED):** The 89-07-00 + 116-00 precedent is "scaffold-only stubs verify substrate; real assertions land in subsequent waves." Writing tests against modules that do not yet exist would create immediate-RED failures that contaminate the Feynman runner before the modules are even meant to exist.
- **Cypher patch as FILE at Wave 0, NOT applied:** Brain integrity preserved until v1.13.0-beta.7 release per 117-CONTEXT.md. The 16 MERGE shape is idempotent so post-release apply is safe. Mirrors `cypher/phase116-tension-hook-completion.cypher` structure with Engine1Layer cluster added.
- **Engine1Layer cluster in cypher (NET-NEW vs 116-00):** Phase 117 implements Canon Part 2 Engine 1 (Act 1 Intelligence Surface). The cypher MERGEs 3 Engine1Layer nodes (WhitespaceMap, ReverseSalient, CrossDomainMatch) and 3 COMPOSES edges so Brain understands the AutoExploreDomains agent decomposes Engine 1 across these algorithmic layers. The CrossDomainMatch node carries the `formula = 'similarity * domain_distance'` property per Section 8.3.
- **Offline snapshot encodes 3 Brain Section 8 decisions:** canonical_chain_order (Section 8.1), cross_domain_formula with default_threshold 0.85 (Section 8.3 — matches Phase 89-07 dedup gate), lens_count_drift_acknowledged (Section 8.6 — brain=4 vs canon=5, use_canon=true). Forward-compat scaffold for v1.13.x tuning if Brain wire is added.
- **`.mindrian/auto-explore-framework-snapshot.json` force-added:** `.gitignore` lists `.mindrian/` to prevent runtime state from being tracked. Plan's `files_modified:` list explicitly names this file as a tracked Wave-0 deliverable. Used `git add -f` per 116-00 + 89-07-00 ec6026d precedent.
- **Plan acceptance regex bug auto-fixed (Rule 1):** The 117-00 plan's verification regex `"test-auto-explore-|test-cross-domain-|test-finding-hsi-|test-f1-bq-|test-detection-routing-|test-brain-canon-drift-"` was missing the `test-explored-materials-store-` prefix, returning count 11 instead of 12. The scaffold harness Gate 2 was extended to include `test-explored-materials-store` so the EXACT count of 12 is correctly verified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's verification regex omitted `test-explored-materials-store-` prefix**
- **Found during:** Task 2 verification (acceptance criterion `count = 12` failed; got 11)
- **Issue:** The plan's acceptance criteria regex `test-auto-explore-|test-cross-domain-|test-finding-hsi-|test-f1-bq-|test-detection-routing-|test-brain-canon-drift-` does not match `test-explored-materials-store.cjs` because that filename starts with `test-explored-materials-store` (no `test-explored-materials-store-` prefix; it lacks a hyphen after `store`). The 12th stub IS registered correctly; the regex is buggy.
- **Fix:** The scaffold harness Gate 2 (`tests/test-117-00-scaffold.sh`) now includes `test-explored-materials-store` in the egrep alternation. Substantive contract (12 stubs locked, all registered in TEST_FILES, all PASS) is satisfied; harness exits 0 with the correct count assertion.
- **Files modified:** tests/test-117-00-scaffold.sh
- **Verification:** `bash tests/test-117-00-scaffold.sh` exits 0 with `OK: 117-00 scaffold complete (5 EVENT_TYPES strings + 12 test stubs + Feynman registration + size 31 + zero em-dashes)`
- **Committed in:** 769ae8c (Task 3 commit)

**2. [Rule 3 - Blocking] .mindrian/ path gitignored, force-add required**
- **Found during:** Task 3 (offline snapshot commit)
- **Issue:** `.gitignore` includes `.mindrian/` to prevent runtime state from being tracked. Plan's `files_modified:` list explicitly names `.mindrian/auto-explore-framework-snapshot.json` as a tracked deliverable, AND the scaffold smoke gate 3 requires the file present on disk.
- **Fix:** Used `git add -f .mindrian/auto-explore-framework-snapshot.json` to force-add. The file is a stable schema template (not runtime state); future waves may populate fields once but the SHAPE is the deliverable. This matches the exact 116-00 + 89-07-00 precedent (commits 1c459fc + ec6026d).
- **Files modified:** .mindrian/auto-explore-framework-snapshot.json (force-added)
- **Verification:** `git ls-files | grep auto-explore-framework-snapshot.json` returns the path; commit `769ae8c` includes it.
- **Committed in:** 769ae8c (Task 3 commit)

### Out-of-scope discoveries (logged, not fixed)

**1. Pre-existing em-dashes in lib/memory/run-feynman-tests.cjs at lines 1122 and 1128**
- **Found during:** Final verification em-dash sweep (returned 2 hits)
- **Pre-existing source:** Phase 103 + Phase 105 comment lines (not introduced by 117-00; identical to the 116-00 SUMMARY out-of-scope discovery at the same lines)
- **Scope decision:** Out of 117-00 scope per executor scope-boundary rule (only auto-fix issues DIRECTLY caused by current task changes). The 117-00 scaffold harness Gate 5 correctly scans only the 117-00 deliverables (the 14 117-00 files), NOT lib/memory/run-feynman-tests.cjs in full. This matches 116-00 + 89-07-00 Gate 5 scope exactly.
- **Action:** Documented here. No change made to run-feynman-tests.cjs lines 1122/1128 since they predate Phase 117.

---

**Total deviations:** 2 auto-fixed (1x Rule 1 plan-regex bug, 1x Rule 3 gitignore force-add per 116-00 precedent)
**Impact on plan:** Substrate-level only; substantive contract (5 EVENT_TYPES + 12 stubs + 16 deliverables + idempotent cypher + valid JSON snapshot + 0 em-dashes) fully satisfied; functional intent of every gate preserved.

## Issues Encountered

None blocking. The 2 deviations above were caught by Task 2/3 verification and resolved inline using the documented 116-00 + 89-07-00 precedent.

## Anti-pattern Guard Verification

Wave 0 substrate is data-only (no agent module yet to scan for `require.*room-db` or `brain-client`). The 12 test stubs require ONLY `lib/core/navigation/memory-events.cjs` (the EVENT_TYPES export), which is the canonical Phase 109 chokepoint. Wave 1 (117-01 + 117-02) will introduce the detection module + composition module + add anti-pattern source-level grep guards via the scaffold harness (mirroring 89-07-00 + 116-00 Gate 4 pattern).

```
$ grep -lE "require\\(.*room-db|brain-client" tests/test-auto-explore-*.cjs tests/test-explored-materials-store.cjs tests/test-cross-domain-*.cjs tests/test-finding-hsi-*.cjs tests/test-f1-bq-*.cjs tests/test-detection-routing-*.cjs tests/test-brain-canon-drift-*.cjs
(0 hits) -- Wave 0 stubs only require navigation/memory-events.cjs
```

## Canon Part 8 Boundary Confirmation

- `cypher/phase117-auto-explore-completion.cypher` zero user-content matches: `grep -cE "(body_text|source_title|target_title|user_content|Lawrence|Adam|Aryeh|Justin|Jonathan|Shmuel|customer)" cypher/phase117-auto-explore-completion.cypher` returns 0
- `.mindrian/auto-explore-framework-snapshot.json` is LOCAL-only (gitignored path; deliverable force-added as stable schema template); zero Brain egress
- No `brain-client` imports introduced (verified)
- No `require('.*room-db')` imports introduced (Phase 109 D-06 chokepoint preserved)
- 5 new EVENT_TYPES strings only carry payload-level scalars at runtime (no body_text fields); Wave 3 (117-05) will add the Canon Part 8 substring scan to telemetry-fixture-*.jsonl per AUTOEXPLORE-117-11

## User Setup Required

None at Wave 0. Wave 5 (117-05) release plumbing will require:
- `git push origin main --tags` (release v1.13.0-beta.7)
- Apply `cypher/phase117-auto-explore-completion.cypher` to Brain via Brain MCP write tool (post-release)

## Wave-0 -> Wave-1 Handoff

Wave 1 (117-01 detection + 117-02 composition) builds on this substrate by writing:
- `scripts/preflight-auto-explore.cjs` (PostToolUse hook entry; calls `lib/core/navigation.cjs` queries; computes material_id; appends to ledger)
- `lib/memory/explored-materials-store.cjs` (JSONL writer at `~/.mindrian/explored-materials/<room-slug>.jsonl`)
- `lib/agents/auto-explore-agent.cjs` (detached spawn target; runs triple-filter compose; emits findings)
- Real assertions populate `tests/test-auto-explore-fingerprint.cjs`, `tests/test-explored-materials-store.cjs`, `tests/test-auto-explore-fire.cjs`, `tests/test-auto-explore-compose.cjs`, `tests/test-auto-explore-canonical-order.cjs`, `tests/test-cross-domain-formula.cjs` (currently scaffold-only)
- `auto_explore_fired` event emission via `logEvent` (now non-erroring because EVENT_TYPES.has('auto_explore_fired') is true)

## Wave-0 -> Wave-2 Handoff

Wave 2 (117-03 F.1 + 117-04 sanitizer) builds on the substrate by writing:
- F.1 surface dispatcher with HSI schema extension + BQ template registry
- `scripts/brain-response-sanitize.cjs` (SEED-003 A3 hook; PII redaction + allowlist preservation)
- Real assertions populate `tests/test-auto-explore-f1-integration.cjs`, `tests/test-finding-hsi-schema.cjs`, `tests/test-f1-bq-template.cjs`, `tests/test-detection-routing-local-only.cjs`
- `auto_explore_finding_surfaced` + `auto_explore_user_response` event emissions via `logEvent`

## Wave-0 -> Wave-3 Handoff

Wave 3 (117-05 telemetry + release) builds on the substrate by writing:
- 5 telemetry helpers (`emitFired`, `emitFindingSurfaced`, `emitUserResponse`, `emitSkipped`, `emitBrainCanonDrift`)
- Canon Part 8 telemetry audit (substring-scan on JSONL fixtures)
- v1.13.0-beta.7 release commit (CHANGELOG + plugin.json + package.json + git tag + marketplace ref + npm publish per memory rule feedback_release_lockstep_npm)
- Real assertions populate `tests/test-brain-canon-drift-event.cjs`, `tests/test-auto-explore-event-types.cjs` (currently scaffold-only)
- Apply `cypher/phase117-auto-explore-completion.cypher` to Brain post-release

## Self-Check: PASSED

**Created files (15) verified on disk:**
- FOUND: tests/test-auto-explore-event-types.cjs
- FOUND: tests/test-auto-explore-fingerprint.cjs
- FOUND: tests/test-explored-materials-store.cjs
- FOUND: tests/test-auto-explore-fire.cjs
- FOUND: tests/test-auto-explore-compose.cjs
- FOUND: tests/test-auto-explore-f1-integration.cjs
- FOUND: tests/test-auto-explore-canonical-order.cjs
- FOUND: tests/test-cross-domain-formula.cjs
- FOUND: tests/test-finding-hsi-schema.cjs
- FOUND: tests/test-f1-bq-template.cjs
- FOUND: tests/test-detection-routing-local-only.cjs
- FOUND: tests/test-brain-canon-drift-event.cjs
- FOUND: tests/test-117-00-scaffold.sh
- FOUND: cypher/phase117-auto-explore-completion.cypher
- FOUND: .mindrian/auto-explore-framework-snapshot.json

**Modified files (2) verified in git diff:**
- FOUND: lib/core/navigation/memory-events.cjs (EVENT_TYPES.size now 31)
- FOUND: lib/memory/run-feynman-tests.cjs (12 Phase 117-00 stub registrations)

**Commits verified in git log:**
- FOUND: 21d94d6 (Task 1: EVENT_TYPES extension; size 26 -> 31)
- FOUND: 003f24e (Task 2: 12 Wave-0 test stubs + Feynman registration)
- FOUND: 769ae8c (Task 3: scaffold harness + cypher patch + offline snapshot)

---
*Phase: 117-auto-explore-domains-on-first-material*
*Completed: 2026-05-06*
