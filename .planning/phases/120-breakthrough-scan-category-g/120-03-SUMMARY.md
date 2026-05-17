---
phase: 120-breakthrough-scan-category-g
plan: "03"
subsystem: breakthrough-scan-conversational-layer
tags: [voice-scaffold, ethics-fence, review-queue, larry-skill, d-17, d-18, canon-part-10]

# Dependency graph
requires:
  - phase: 120-breakthrough-scan-category-g
    provides: "Plan 120-00 detectors + schema, Plan 120-01 F.7 renderer + scoring, Plan 120-02 scanner + resurfacing + canary + verb-dispatch"
  - phase: 119-room-as-receipt-invariant
    provides: "Phase 119-01 rooms-meta.db sibling-db pattern (mirrored verbatim for breakthrough-review-queue.db)"
  - phase: 109-sql-context-memory-navigation-spine
    provides: "navigation.cjs chokepoint (logMemoryEvent, writeEdge) + EVENT_TYPES Set + room-db.cjs DatabaseSync opener"
  - phase: 88.2-uiux-selector-block
    provides: "selector-dispatcher.cjs pickShape (F.7 dispatch surface for voice_line payload)"

provides:
  - "lib/core/breakthrough/voice-scaffold.cjs: composeBreakthroughVoiceLine + auditVoiceLine + 4 rule predicates + frozen constants (D-17)"
  - "lib/core/breakthrough/ethics-fence.cjs: classifyEthicsBand + queueForReview + 4 frozen threshold constants + ETHICS_BANDS array (D-18)"
  - "lib/core/breakthrough/review-queue.cjs: openReviewQueue + insertReviewCandidate + listPendingReviews (.rooms/breakthrough-review-queue.db; mirrors Phase 119-01 sibling pattern)"
  - "F.7 renderer additive voice_line slot (byte-stable when absent; prepended to zones.body when present)"
  - "Scanner integration: D-18 4-tier ethics-fence partitioning + D-17 voice-line composition + audit gate"
  - "Larry skill: documented Breakthrough Voice Scaffold (Phase 120 D-17) section with 4 rules + worked examples + auditor failure modes"
  - "EVENT_TYPES extension: breakthrough_in_review_queue (additive +1; size 48 -> 49 baseline)"

affects:
  - "v1.13.0 closed-loop milestone (Phase 120 ships sub-claim 5 of Canon Part 10 / Hooked Fix 3 Category G)"
  - "Phase 121 trajectory-telemetry (consumes breakthrough_surfaced + breakthrough_in_review_queue lifecycle events)"
  - "Future v1.14.0 /mos:doctor --review-queue-sweep command (consumes listPendingReviews surface)"

# Tech tracking
tech-stack:
  added:
    - "node:sqlite DatabaseSync for the SOFT_BAND review queue (mirrors lib/core/room-db.cjs convention; NOT better-sqlite3)"
  patterns:
    - "D-20 four structural enforcement points: schema.validateProvenance (Plan 120-00) + renderShapeF7Breakthrough artifact_ids check (Plan 120-01) + surfaceBreakthrough SQL COUNT check (Plan 120-02) + classifyEthicsBand HARD_FLOOR branch (Plan 120-03). Cypher-provable from graph state alone."
    - "Composer + auditor alignment: composeBreakthroughVoiceLine output is auditor-safe by construction. The auditor IS the structural enforcement (D-20 meta-principle)."
    - "Sibling rooms-meta.db pattern: .rooms/breakthrough-review-queue.db lives at rooms-home level, never pollutes per-room room.db. Mirrors Phase 119-01 room-discard-cascade._emitPartialFailure precedent."

key-files:
  created:
    - "lib/core/breakthrough/voice-scaffold.cjs (D-17 composer + auditor; ~225 LOC)"
    - "lib/core/breakthrough/voice-scaffold.test.cjs (18 unit tests)"
    - "lib/core/breakthrough/ethics-fence.cjs (D-18 4-tier classifier; ~115 LOC)"
    - "lib/core/breakthrough/ethics-fence.test.cjs (13 unit tests)"
    - "lib/core/breakthrough/review-queue.cjs (SOFT_BAND queue; ~140 LOC)"
    - "lib/core/breakthrough/review-queue.test.cjs (7 unit tests)"
    - "lib/core/breakthrough/scanner-d17-d18.test.cjs (7 integration tests)"
    - "tests/test-breakthrough-d17-voice-audit.cjs (7 D-17 end-to-end tests)"
    - "tests/test-breakthrough-d18-ethics-fence.cjs (7 D-18 end-to-end tests)"
    - "tests/test-120-03-scaffold.sh (9-gate scaffold harness)"
  modified:
    - "lib/core/breakthrough/scanner.cjs (scanForBreakthroughs ethics-fence partitioning + surfaceBreakthrough voice-line composition gate)"
    - "lib/hmi/shape-f7-breakthrough-renderer.cjs (additive payload.voice_line slot; byte-stable when absent)"
    - "lib/core/navigation/memory-events.cjs (EVENT_TYPES Set additively +1: 'breakthrough_in_review_queue')"
    - "skills/larry-personality/SKILL.md (new section 'Breakthrough Voice Scaffold (Phase 120 D-17)' with 4 rules + examples + failure modes)"
    - "lib/memory/run-feynman-tests.cjs (registered 6 Plan 120-03 test files)"

key-decisions:
  - "D-17 4-rule voice scaffold: LOCKED VERBATIM per CONTEXT.md (evidence_requirement / mechanism_clause / time_anchor / no_unbacked_superlatives). Auditor is structural enforcement."
  - "D-18 4-tier hybrid ethics fence: LOCKED VERBATIM per CONTEXT.md. HARD_CEILING_CONFIDENCE=0.50 (strict >), SOFT_BAND_MIN_CONFIDENCE=0.35 (inclusive >=), SOFT_BAND_MAX_CONFIDENCE=0.50 (inclusive ceiling for SOFT_BAND), BELOW_FLOOR_THRESHOLD=0.35."
  - "Rule 4 numeric backing requires REAL evidence (parenthesized number, decimal, multi-digit integer, or digit+unit). Naive /\\d/ check too lax -- artifact ids 'a1, a2' contain digits without backing the claim."
  - "Review queue lives at .rooms/breakthrough-review-queue.db (rooms-home sibling, NOT per-room room.db) -- mirrors Phase 119-01 rooms-meta.db precedent verbatim."
  - "Use node:sqlite DatabaseSync (NOT better-sqlite3) per lib/core/room-db.cjs convention. The plugin is bound to Node 22.5+ for the node:sqlite GA surface."
  - "Memory_event created_by constrained to ('user','larry','import','brain','system'); ethics-fence uses 'system' (NOT 'phase-120-ethics-fence' which would fail the CHECK constraint)."
  - "Scanner replaces D-17-violating voice lines with the structural default (composeBreakthroughVoiceLine with roomState=null) -- the default is auditor-safe by construction. No D-17-violating line EVER reaches F.7."
  - "F.7 renderer does NOT re-audit the voice_line -- single source of truth at scanner layer. Renderer is pure: just prepends when slot is non-empty."

patterns-established:
  - "Voice scaffold pattern: composer (pure function) + auditor (pure boolean gate) + 4 frozen rule predicates exported individually for unit-level testing"
  - "Ethics fence pattern: 4 frozen threshold constants + ETHICS_BANDS frozen array + classifyEthicsBand pure function returning band name"
  - "Sibling rooms-meta.db pattern: openReviewQueue mirrors openRoomsMetaDb idiom (fs.mkdirSync recursive + node:sqlite DatabaseSync + graceful in-memory fallback on EACCES)"
  - "10-column review_candidates DDL: id PK, room_slug, breakthrough_id, kind, confidence REAL, theme, artifact_ids_json TEXT, queued_at INTEGER, reviewed_at INTEGER NULL, review_status DEFAULT 'pending'"
  - "Scanner partition idiom: classifyEthicsBand per-candidate routing AFTER resurfacing filter, BEFORE scoring. HARD_CEILING -> ranker; SOFT_BAND -> queueForReview; HARD_FLOOR + BELOW_FLOOR -> silent drop."
  - "Surface composition gate: compose -> audit -> fallback to structural default on violation. Defense in depth at the conversational layer."

requirements-completed: [BREAKTHROUGH-120-05, BREAKTHROUGH-120-06]

# Metrics
duration: 43min
completed: 2026-05-17
---

# Phase 120 Plan 03: D-17 Voice Scaffold + D-18 Ethics Fence + Review Queue + Larry Skill Summary

**D-17 4-rule voice scaffold + auditor, D-18 4-tier hybrid ethics fence with .rooms/breakthrough-review-queue.db sibling pattern, scanner integration with composer-audit-fallback gate, and Larry skill update -- closing Phase 120 Category G as the conversational + ethical-enforcement layer that converts math-detected breakthroughs into honest, evidence-backed Larry voice.**

## Performance

- **Duration:** 43 min
- **Started:** 2026-05-17T12:04:14Z
- **Completed:** 2026-05-17T12:47:47Z
- **Tasks:** 3 (all TDD: RED -> GREEN)
- **Files created:** 10 (3 source + 7 test)
- **Files modified:** 5 (scanner.cjs + F.7 renderer + memory-events + Larry skill + Feynman runner)

## Accomplishments

- **D-17 4-rule voice scaffold (LOCKED VERBATIM):** `composeBreakthroughVoiceLine` + `auditVoiceLine` + 4 rule predicates as pure functions. Rule 1 (evidence requirement): `(artifacts ...)` / `[[wiki]]` / `(see edges ...)`. Rule 2 (mechanism clause): `by Y` user-action phrase. Rule 3 (time anchor): `in the last N hours/days` / `today` / `this week` / `since YYYY-MM-DD`. Rule 4 (no unbacked superlatives): 6 forbidden words + 3 frequency words, gated by real numeric backing (parenthesized number, decimal, multi-digit, or digit+unit -- NOT just any digit).
- **D-18 4-tier hybrid ethics fence (LOCKED VERBATIM):** 4 frozen threshold constants (0.50 / 0.35 / 0.50 / 0.35) + `ETHICS_BANDS` frozen array verbatim + `classifyEthicsBand` deterministic classifier with HARD_FLOOR primacy.
- **SOFT_BAND review queue:** `.rooms/breakthrough-review-queue.db` sibling-db pattern mirroring Phase 119-01 rooms-meta.db precedent. 10-column table, graceful in-memory fallback on EACCES, `breakthrough_in_review_queue` memory_event mirror in source room.db.
- **Scanner integration:** ethics-fence partitioning after the resurfacing filter routes HARD_CEILING -> ranker, SOFT_BAND -> queue + mirror, HARD_FLOOR + BELOW_FLOOR -> silent drop. Surface gate composes the voice line, audits it, falls back to structural default on violation.
- **F.7 renderer additive voice_line slot:** byte-stable when absent (Plan 120-01 17/17 tests preserved); prepended to zones.body when present. Closed-vocab invariants (5 verbs verbatim, freeTextOffered:false, recommended:null) preserved.
- **Larry skill update:** documented the 4 rules verbatim, GOOD + BAD worked examples, auditor failure modes, and the Canon Part 10 sub-claim 5 justification.
- **D-20 LOAD-BEARING SQL invariant: FOURTH structural enforcement point.** classifyEthicsBand HARD_FLOOR branch (this plan) joins schema.validateProvenance (Plan 120-00) + renderShapeF7Breakthrough.artifact_ids check (Plan 120-01) + surfaceBreakthrough SQL COUNT check (Plan 120-02). Every Breakthrough is Cypher-provable from graph state alone.

## Task Commits

Each task was committed atomically via TDD (RED -> GREEN cycles, `--no-verify` per parallel-executor protocol):

1. **Task 1 RED: D-17 voice scaffold + auditor tests** - `880b7922` (test)
2. **Task 1 GREEN: D-17 voice scaffold implementation** - `3f76f7ca` (feat)
3. **Task 2 RED: D-18 ethics fence + review queue tests** - `7e09260b` (test)
4. **Task 2 GREEN: D-18 ethics fence + review queue + EVENT_TYPES** - `f3bb944f` (feat)
5. **Task 3 RED: scanner integration + scaffold harness tests** - `951d1942` (test)
6. **Task 3 GREEN: scanner + F.7 renderer + Larry skill + Feynman runner** - `f28e73e9` (feat)

## Files Created/Modified

### Created (10 files)

- `lib/core/breakthrough/voice-scaffold.cjs` - D-17 composer + auditor + 4 rule predicates + frozen constants
- `lib/core/breakthrough/voice-scaffold.test.cjs` - 18 unit tests covering composer, auditor, rule predicates, em-dash invariant
- `lib/core/breakthrough/ethics-fence.cjs` - D-18 4-tier classifier + queueForReview + 4 frozen thresholds
- `lib/core/breakthrough/ethics-fence.test.cjs` - 13 unit tests covering classification matrix + memory_event mirror
- `lib/core/breakthrough/review-queue.cjs` - openReviewQueue + insertReviewCandidate + listPendingReviews
- `lib/core/breakthrough/review-queue.test.cjs` - 7 unit tests covering DDL + insert + pending filter + EACCES fallback
- `lib/core/breakthrough/scanner-d17-d18.test.cjs` - 7 integration tests covering 4-band routing + voice_line gate
- `tests/test-breakthrough-d17-voice-audit.cjs` - 7 end-to-end tests covering D-17 audit catalog
- `tests/test-breakthrough-d18-ethics-fence.cjs` - 7 end-to-end tests covering D-18 band routing
- `tests/test-120-03-scaffold.sh` - 9-gate shell harness (composer + classifier + queue + slot + wiring + skill + Canon Part 8 + em-dash + e2e tests)

### Modified (5 files)

- `lib/core/breakthrough/scanner.cjs` - Wired voice-scaffold + ethics-fence; D-18 partition in scanForBreakthroughs; D-17 audit gate in surfaceBreakthrough
- `lib/hmi/shape-f7-breakthrough-renderer.cjs` - Additive payload.voice_line slot; byte-stable when absent
- `lib/core/navigation/memory-events.cjs` - Additive EVENT_TYPES extension (+1: 'breakthrough_in_review_queue')
- `skills/larry-personality/SKILL.md` - New section "Breakthrough Voice Scaffold (Phase 120 D-17)"
- `lib/memory/run-feynman-tests.cjs` - Registered 6 Plan 120-03 test files

## Decisions Made

- **D-17 / D-18 / D-20 four-fold enforcement architecture:** classifyEthicsBand HARD_FLOOR branch is the FOURTH structural enforcement point for D-20 Cypher-provable provenance, alongside schema.validateProvenance, renderShapeF7Breakthrough.artifact_ids check, and surfaceBreakthrough SQL COUNT check. Defense in depth at the ethics layer.
- **Numeric backing strictness (Rule 4):** A naive `/\d/` window check is too lax (artifact ids like `a1, a2, a3` contain digits without backing the claim). Real numeric backing requires: parenthesized number, decimal (N.N), multi-digit integer, or digit+unit (score/count/sessions/times/days/hours/sigma/sd/%/x).
- **node:sqlite over better-sqlite3:** mirrors the lib/core/room-db.cjs convention. The plugin assumes Node 22.5+ for the node:sqlite GA surface. better-sqlite3 was a planning artifact -- the actual codebase has standardized on node:sqlite DatabaseSync.
- **`created_by` constraint compliance:** memory_event nodes carry a CHECK constraint `created_by IN ('user','larry','import','brain','system')`. Ethics-fence uses `'system'` (not `'phase-120-ethics-fence'` which would fail the constraint silently and drop the telemetry mirror).
- **F.7 renderer does NOT re-audit:** single source of truth at scanner layer. The renderer is pure: prepend when non-empty, byte-stable when empty.

## Frozen Constants (Verbatim)

### D-17 Voice Scaffold

```javascript
const VOICE_RULE_NAMES = Object.freeze([
  'evidence_requirement',
  'mechanism_clause',
  'time_anchor',
  'no_unbacked_superlatives',
]);

const FORBIDDEN_SUPERLATIVES = Object.freeze([
  'breakthrough', 'biggest', 'first', 'unprecedented', 'major', 'massive',
]);

const FREQUENCY_WORDS = Object.freeze([
  'consistent', 'repeated', 'always',
]);
```

### D-18 Ethics Fence

```javascript
const HARD_CEILING_CONFIDENCE = 0.50;     // confidence > this -> HARD_CEILING (auto-surface)
const SOFT_BAND_MIN_CONFIDENCE = 0.35;    // confidence >= this -> SOFT_BAND (queue)
const SOFT_BAND_MAX_CONFIDENCE = 0.50;    // confidence <= this -> SOFT_BAND
const BELOW_FLOOR_THRESHOLD = 0.35;       // confidence < this -> BELOW_FLOOR (soft-fire only)

const ETHICS_BANDS = Object.freeze(['HARD_FLOOR', 'BELOW_FLOOR', 'SOFT_BAND', 'HARD_CEILING']);
```

### Review Queue Table Schema

```sql
CREATE TABLE IF NOT EXISTS review_candidates (
  id TEXT PRIMARY KEY,
  room_slug TEXT,
  breakthrough_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  confidence REAL NOT NULL,
  theme TEXT,
  artifact_ids_json TEXT,
  queued_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  review_status TEXT NOT NULL DEFAULT 'pending'
);
```

## D-20 LOAD-BEARING SQL Invariant (verbatim, cross-referenced)

> Every Breakthrough node MUST have at least one DERIVED_FROM edge to an Artifact node. The Cypher invariant
> `MATCH (b:Breakthrough)-[:DERIVED_FROM]->(a:Artifact) WHERE b.id = $id RETURN count(a)` is guaranteed >= 1
> BY CONSTRUCTION (every gate refuses provenance-less inputs) AND BY TRANSACTION (the schema-layer writer
> wraps node + edge inserts in an atomic SQLite transaction).

**Four structural enforcement points (defense in depth):**

1. **Plan 120-00 `schema.cjs::validateProvenance`** -- writeBreakthrough entry guard; refuses any breakthrough with empty `artifact_ids[]` at the SQLite transaction layer.
2. **Plan 120-01 `shape-f7-breakthrough-renderer.cjs::renderShapeF7Breakthrough`** -- renderer-level artifact_ids check; returns `{error:'provenance_required'}` if the array is empty at render time.
3. **Plan 120-02 `scanner.cjs::surfaceBreakthrough`** -- SQL `COUNT(*) FROM edges WHERE source=? AND type='DERIVED_FROM'` check; emits `breakthrough_surface_blocked` event and refuses to surface if count < 1.
4. **Plan 120-03 `ethics-fence.cjs::classifyEthicsBand`** -- HARD_FLOOR branch; returns `'HARD_FLOOR'` if `artifact_ids` is empty, BEFORE any confidence-based banding. This is the classification-time enforcement point.

Together, the four points make D-20 Cypher-provable from graph state alone -- a constitutional property, not an audit procedure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Memory_event CHECK constraint violation**
- **Found during:** Task 2 GREEN (queueForReview integration test)
- **Issue:** Initial implementation used `created_by: 'phase-120-ethics-fence'` which violates the `created_by IN ('user','larry','import','brain','system')` CHECK constraint on the nodes table. The `logMemoryEvent` call silently failed (returned `{ok:false}`), causing the memory_event mirror to never land.
- **Fix:** Changed `created_by` to `'system'` per the schema CHECK constraint. Added explanatory comment.
- **Files modified:** lib/core/breakthrough/ethics-fence.cjs
- **Verification:** D-18 Test 17 (SOFT_BAND -> memory_event mirror) passes after fix.
- **Committed in:** f3bb944f (Task 2 GREEN)

**2. [Rule 3 - Blocking] better-sqlite3 vs node:sqlite mismatch**
- **Found during:** Task 2 GREEN (initial review-queue.test.cjs run)
- **Issue:** Plan specified `require('better-sqlite3')` but the codebase uses Node's built-in `node:sqlite` DatabaseSync (per lib/core/room-db.cjs convention). better-sqlite3 was present in node_modules but had a binary ABI mismatch.
- **Fix:** Replaced `require('better-sqlite3')` with `require('node:sqlite')` and used `DatabaseSync` constructor. Updated comments + error reason string from `'better_sqlite3_not_available'` to `'node_sqlite_not_available'`.
- **Files modified:** lib/core/breakthrough/review-queue.cjs
- **Verification:** Review-queue T11-T17 pass after fix.
- **Committed in:** f3bb944f (Task 2 GREEN)

**3. [Rule 1 - Bug] Naive numeric-backing regex too lax**
- **Found during:** Task 1 GREEN (initial voice-scaffold.test.cjs run; T8/T16d/T17 failed)
- **Issue:** Plan's specified `noUnbackedSuperlatives` used a naive `/\d/` check within a 60-char window. This passed on test strings like `"You're seeing a major breakthrough on X (artifacts a1, a2, a3) ..."` because the artifact ids contain digits -- but those digits do NOT back the superlative claim. The auditor missed real D-17 violations.
- **Fix:** Tightened `hasNumericBacking` to require: parenthesized number `(N)` or `(N.N)`, decimal number `N.NN`, multi-digit integer `\b\d{2,}\b`, OR digit + unit (score/count/sessions/times/days/hours/sigma/sd/%/x). Single-digit artifact-id markers no longer count as backing.
- **Files modified:** lib/core/breakthrough/voice-scaffold.cjs
- **Verification:** All 24 D-17 tests pass after fix (voice-scaffold.test.cjs 18 + test-breakthrough-d17-voice-audit.cjs 6 + frequency-word test).
- **Committed in:** 3f76f7ca (Task 1 GREEN)

**4. [Rule 1 - Bug] Bash count_matches double-output trap**
- **Found during:** Task 3 RED (initial scaffold harness run)
- **Issue:** The plan's grep idiom `grep -c PATTERN FILE || echo 0` produced TWO lines on stdout when grep returned 0 (count=0, exit 1) -- the literal `0\n0`. Integer comparison `[ "$N" -gt 0 ]` then broke with "integer expression expected".
- **Fix:** Captured grep output via a local variable inside helper functions `count_matches` + `count_matches_fixed`; default to `0` via `${n:-0}` parameter expansion.
- **Files modified:** tests/test-120-03-scaffold.sh
- **Verification:** Scaffold harness 9/9 gates pass cleanly.
- **Committed in:** 951d1942 (Task 3 RED) and refined in subsequent gates.

---

**Total deviations:** 4 auto-fixed (1 schema constraint bug, 1 dependency mismatch, 1 regex-strictness bug, 1 bash idiom bug)
**Impact on plan:** All four auto-fixes essential for correctness. No scope creep. Plan structure preserved end-to-end; only implementation details adjusted to align with the actual codebase contracts (node:sqlite, CHECK constraints, bash idioms).

## Issues Encountered

- **Parallel-agent coordination:** Plan 120-02 (the scanner orchestrator) executed in parallel and landed `lib/core/breakthrough/scanner.cjs` mid-session (commit 3406e76a). The integration step (Task 3 GREEN) waited until scanner.cjs existed on disk, then layered ethics-fence + voice-scaffold wiring on top of the freshly committed scanner. No merge conflicts -- the additive nature of the changes (new requires, new partition block, new audit gate inside surfaceBreakthrough) meant 120-02's work integrated cleanly.

## Test Counts

- **voice-scaffold.test.cjs:** 18 tests
- **ethics-fence.test.cjs:** 13 tests
- **review-queue.test.cjs:** 7 tests
- **scanner-d17-d18.test.cjs:** 7 tests
- **tests/test-breakthrough-d17-voice-audit.cjs:** 7 tests
- **tests/test-breakthrough-d18-ethics-fence.cjs:** 7 tests

**Plan 120-03 subtotal:** 59 tests, 0 failures.

**Phase 120 full-suite total (00 + 01 + 02 + 03):** 176 tests, 0 failures, 0 skipped.

**Scaffold harness:** 9/9 gates pass.

## Scaffold Harness Final Output

```
OK gate 1: voice-scaffold composer + auditor present (7 refs)
OK gate 2: ethics-fence classifier present (5 refs)
OK gate 3: review-queue openReviewQueue present (3 refs)
OK gate 4: F.7 renderer voice_line slot present (5 refs)
OK gate 5: scanner integration wires present (4 refs)
OK gate 6: Larry skill section present (1 refs)
OK gate 7: Canon Part 8 -- zero Brain coupling across Plan 120-03 sources
OK gate 8: HARD RULE -- zero em-dashes across Plan 120-03 source files
OK gate 9: D-17 + D-18 end-to-end tests pass

OK: 120-03 scaffold complete (voice scaffold + 4-tier ethics fence + review queue + Larry skill + zero Brain coupling + zero em-dashes)
```

## User Setup Required

None - no external service configuration required. Phase 120 is pure-local: detectors read room math output, schema writes via navigation chokepoint, F.7 renders via Phase 88.2 dispatcher, ethics-fence + voice-scaffold are pure functions, review queue is a local SQLite file in `.rooms/`.

## Next Phase Readiness

- Phase 120 is the FINAL Plan 120 ship; the closed loop is complete.
  - Plan 120-00: detectors + schema + memory_event extension (foundation)
  - Plan 120-01: F.7 renderer + scoring (display + ranking)
  - Plan 120-02: scanner + resurfacing + canary + verb-dispatch (orchestration + lifecycle)
  - Plan 120-03 (this): voice scaffold + ethics fence + review queue + Larry skill (conversational + ethical layer)
- Ready for v1.13.0 final release ceremony per the v1.13.1-EXECUTION-PLAN.md contract.
- Phase 121 trajectory-telemetry can now consume the full breakthrough lifecycle (`breakthrough_detected_soft` -> `breakthrough_surfaced` -> `breakthrough_confirmed`/`_dismissed`/`_filed_as_decision` -> `breakthrough_throttled`/`_in_review_queue`).
- Future v1.14.0 `/mos:doctor --review-queue-sweep` command can wrap `listPendingReviews` for the 20%-weekly manual sample audit (CONTEXT.md D-18 SOFT_BAND retraining-data invariant).

## Canon Compliance

- **Canon Part 3 (Tri-Context Decision Gate):** F.7 IS a Decision Gate primitive instance. The voice line is the LOCAL narrative at the gate.
- **Canon Part 4 (Every Choice Is Graph Data):** SOFT_BAND review-queue rows + `breakthrough_in_review_queue` memory_event are typed graph signals.
- **Canon Part 5 (Evidence Is Graded By Context):** D-17 evidence requirement (rule 1) + D-18 confidence bands map to the four evidence tiers (Academic / Operational / Practitioner / None).
- **Canon Part 8 (Graph Boundary):** Voice scaffold + ethics fence + review queue all LOCAL only; no Brain coupling. Verified by Gate 7 source-grep.
- **Canon Part 9 (Memory Locality):** ALL writes via navigation.cjs chokepoint (logMemoryEvent) or review-queue.cjs (rooms-meta-style sibling DB).
- **Canon Part 10 sub-claim 5 (Variable Reward / The Math IS the Surface):** The voice IS the math's translation. The auditor IS the structural enforcement of D-20.

---
*Phase: 120-breakthrough-scan-category-g*
*Plan: 03*
*Completed: 2026-05-17*

## Self-Check: PASSED

Verified:
- All 10 created files exist on disk
- All 5 modified files have the expected additions (scanner integration wires, F.7 voice_line slot, Larry skill section, EVENT_TYPES extension, Feynman runner registrations)
- All 6 task commits (880b7922, 3f76f7ca, 7e09260b, f3bb944f, 951d1942, f28e73e9) are present in git log
- 176/176 Phase 120 tests pass
- 9/9 scaffold harness gates pass
- Zero Brain coupling across Plan 120-03 sources
- Zero em-dashes across Plan 120-03 source files
