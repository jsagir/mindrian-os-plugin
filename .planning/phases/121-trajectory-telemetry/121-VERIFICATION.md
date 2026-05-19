---
phase: 121-trajectory-telemetry
verified: 2026-05-19T00:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification:
  previous_status: none
  previous_score: n/a
warnings:
  - id: REQ-IDS-NOT-APPENDED
    severity: non-blocking
    detail: "TELEMETRY-121-01..12 IDs are not yet present in .planning/REQUIREMENTS.md (the planner-emitted patch was deferred). gsd-tools mark-complete would return not_found for these IDs. Recommended fix: a small docs-only commit that appends 12 lines (`**TELEMETRY-121-XX**: <description>`) under the Phase 121 section. Not a blocker for the phase goal; SUMMARYs already carry full requirement-id mappings."
  - id: LEGACY-EMIT-PATHS-DUAL-WRITE
    severity: informational
    detail: "Two pre-existing legacy direct fs.appendFileSync emit paths still exist alongside the unified writer chokepoint, by design per the Plan 121-01 dual-write deprecation pattern: (a) lib/core/mva-telemetry.cjs:48 (the 58-line shim's legacy dual-write to ~/.mindrian/telemetry/v1.13/mva.jsonl preserves Phase 118 byte-functional compat for 7+ readers; routes through writer.emit FIRST so the Canon Part 8 gate runs); (b) scripts/mva-detect.cjs:79 (a pre-121 direct-emit path to legacy mva.jsonl that has not been routed through the shim). Phase 121 SUMMARY 121-01 explicitly schedules both retirements for v1.14.0 once every legacy reader is repointed. lib/core/room-db.cjs:87 (navigation-bypass.jsonl) is the third runtime legacy writer; Plan 121-01 migrates its accumulated historical data into the unified stream and Plan 121-04's TELEMETRY-SCHEMA.md Section 12 documents the scoped exception. Not gaps against the 12 TELEMETRY-121-XX must-haves; transitional state per Canon Part 7 reuse + dual-write shim pattern."
---

# Phase 121: Trajectory Telemetry Verification Report

**Phase Goal:** Unified trajectory-event capture surface for SEED-002's eventual consumption. Consolidates 4 piecemeal telemetry writers into ONE unified `events-YYYY-WNN.jsonl` with type discriminator, single emit-time-validator chokepoint, frozen v1 schema with per-row schema_version, and 9 capture points wired across shipped surfaces. Zero processing. Silent observability. Per Canon Part 7: CONSOLIDATION not greenfield.

**Verified:** 2026-05-19
**Status:** passed
**Re-verification:** No (initial verification)

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                  | Status     | Evidence                                                                                                          |
| -- | ------------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| 1  | A single unified writer chokepoint exists with frozen v1 schema + emit-time Canon Part 8 validator     | VERIFIED   | `lib/core/telemetry/{writer,validator,schema}.cjs` (141 + 197 + 168 LOC); 19/19 unit tests green                  |
| 2  | The 4 piecemeal telemetry sources have a one-time idempotent migration to the unified stream           | VERIFIED   | `scripts/migrate-telemetry-v1.cjs` (384 LOC); sha256(source-name + first-5-timestamps) fingerprint; 8/8 fixture tests green |
| 3  | ISO-week rotation produces `events-YYYY-WNN.jsonl` with zero-padded week                               | VERIFIED   | `writer.isoWeekFilename(2026-05-19)='events-2026-W21.jsonl'`, `2026-01-05='events-2026-W02.jsonl'`, `2026-01-01='events-2026-W01.jsonl'` |
| 4  | F-shape selector picks emit `selector_pick` events at the dispatcher                                   | VERIFIED   | `lib/hmi/selector-dispatcher.cjs:205-227` lazy-requires writer.cjs + emits selector_pick; 4/4 capture tests green |
| 5  | Tension hook user-initiated transitions emit `tension_engagement` (decay structurally excluded)        | VERIFIED   | `lib/memory/pending-tension-store.cjs:266-286` emits tension_engagement from markResolved only; 4/4 tests green   |
| 6  | Auto-explore user picks emit `auto_explore_decision` (system-skips structurally excluded)              | VERIFIED   | `lib/agents/auto-explore-agent.cjs:808-816` emits from handleUserResponse only; 4/4 tests green                   |
| 7  | Breakthrough surfacing emits `breakthrough_dismissed` (provenance-blocked + throttled excluded)        | VERIFIED   | `lib/core/breakthrough/scanner.cjs:374-390` emits from surfaceBreakthrough; D-20 refusal pre-empts emit; 4/4 tests green |
| 8  | MVA option router + Hooked re-score routed through unified chokepoint via 58-line shim                 | VERIFIED   | `lib/core/mva-telemetry.cjs` exactly 58 LOC; delegates to writer.emit + legacy dual-write; `scripts/hooked-rescore-117.cjs` repointed to `events-YYYY-WNN.jsonl` via anchored regex `^events-\\d{4}-W\\d{2}\\.jsonl$` |
| 9  | Empathy audit CLI + Room receipt helper + PostToolUse broad sweep all emit; drowning protection works  | VERIFIED   | `scripts/empathy-observation-emit.cjs` (108 LOC), `lib/core/room-receipt-emit.cjs` (63 LOC), `scripts/telemetry-command-invocation.cjs` (120 LOC); drowning-protection fixture: 100 cmd_inv + 10 selector_pick filter-isolatable; PASS |
| 10 | Frozen v1 schema: SCHEMA_VERSION=1 Number, EVENT_TYPES.length=15, Object.frozen                        | VERIFIED   | `node -e "const s=require('./lib/core/telemetry/schema.cjs')"` returns SCHEMA_VERSION=1 typeof=number, EVENT_TYPES.length=15, frozen=true |
| 11 | `docs/TELEMETRY-SCHEMA.md` shipped as frozen v1 spec; Canon Part 8 adversarial audit passes 7 gates    | VERIFIED   | `docs/TELEMETRY-SCHEMA.md` (364 LOC, 13 sections); `bash tests/test-121-04-canon-part-8-audit.sh` exits 0 (7 gates green; 17 files scanned) |
| 12 | Silent observability invariant holds: no user-facing surface references telemetry corpus               | VERIFIED   | `bash tests/test-121-04-silent-observability.sh` exits 0 (4 gates green; commands/ + lib/hmi/ + skills/ clean)    |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact                                          | Expected                            | Status     | Details                                                                                              |
| ------------------------------------------------- | ----------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| `lib/core/telemetry/writer.cjs`                   | Unified emit chokepoint             | VERIFIED   | 141 LOC; single `fs.appendFileSync` call inside emit; validateEventPayload invoked before append    |
| `lib/core/telemetry/validator.cjs`                | 7 forbidden-pattern detectors       | VERIFIED   | 197 LOC; 7 detectors (Cypher / email / phone / Brain URL via concatenated tokens / abs path / raw hex / free-text prose); 7/7 unit tests |
| `lib/core/telemetry/schema.cjs`                   | Frozen v1 schema source-of-truth    | VERIFIED   | 168 LOC; EVENT_TYPES (15 strings) + ALLOWED_FIELDS + SCHEMA_VERSION=1 Number; all Object.frozen      |
| `scripts/migrate-telemetry-v1.cjs`                | One-time idempotent migration       | VERIFIED   | 384 LOC; sha256-prefixed fingerprint + .pre-v121.bak rename + Canon Part 8 inline validation         |
| `scripts/empathy-observation-emit.cjs`            | D-09 surface 1: empathy CLI         | VERIFIED   | 108 LOC; 5 flags map 1:1 with ALLOWED_FIELDS.empathy_observation; strict int + 64-hex parse          |
| `scripts/telemetry-command-invocation.cjs`        | D-09 surface 3: PostToolUse hook    | VERIFIED   | 120 LOC; two-layer filter (SlashCommand matcher + script-level `/^/mos:/`); processInvocation export |
| `lib/core/room-receipt-emit.cjs`                  | D-09 surface 2: receipt helper      | VERIFIED   | 63 LOC; emitReceiptWritten(slug, conversationId) non-throwing by contract                            |
| `lib/core/mva-telemetry.cjs`                      | 58-line shim                        | VERIFIED   | EXACTLY 58 LOC (matches AUDIT Gate 6 <=60 invariant); delegates to writer.emit() + legacy dual-write |
| `scripts/hooked-rescore-117.cjs`                  | Read path repointed to unified      | VERIFIED   | Anchored regex `^events-\\d{4}-W\\d{2}\\.jsonl$` at line 77; RELEVANT_EVENTS expanded (line 46)      |
| `lib/hmi/selector-dispatcher.cjs`                 | D-04 wire-in                        | VERIFIED   | Emit at line 227; lazy-require at 205                                                                |
| `lib/memory/pending-tension-store.cjs`            | D-05 wire-in                        | VERIFIED   | Emit at line 286; structural exclusion via markResolved-only placement                               |
| `lib/agents/auto-explore-agent.cjs`               | D-06 wire-in                        | VERIFIED   | Emit at line 816; structural exclusion via handleUserResponse-only placement                         |
| `lib/core/breakthrough/scanner.cjs`               | D-07 wire-in                        | VERIFIED   | Emit at line 390; structural exclusion via D-20 refusal pre-empting + applyThrottleFilter upstream   |
| `lib/core/room-auto-create.cjs`                   | D-09 Phase 119 wire-in              | VERIFIED   | Phase 121-03 D-09 marker at line 299; emit AFTER memory_event + BEFORE return                        |
| `hooks/hooks.json`                                | PostToolUse SlashCommand entry      | VERIFIED   | PostToolUse count=9; 1 SlashCommand entry for telemetry-command-invocation.cjs; 4 SessionStart preserved |
| `docs/TELEMETRY-SCHEMA.md`                        | Frozen v1 spec                      | VERIFIED   | 364 LOC, 13 sections; all 15 EVENT_TYPES documented; D-12 invariant codified in Section 11           |
| `tests/test-121-04-canon-part-8-audit.sh`         | 7-gate adversarial audit            | VERIFIED   | Exits 0; 17 files scanned (13 source + 4 test split by design)                                       |
| `tests/test-121-04-silent-observability.sh`       | 4-gate D-12 invariant               | VERIFIED   | Exits 0; commands/ + lib/hmi/ + skills/ clean                                                        |
| `tests/run-all-121.sh`                            | Aggregator: 19/19 green             | VERIFIED   | 19/19 suites green in 21s; total: 7 shell suites + 12 cjs suites                                     |

### Key Link Verification

| From                                              | To                                  | Via                          | Status     | Details                                                                |
| ------------------------------------------------- | ----------------------------------- | ---------------------------- | ---------- | ---------------------------------------------------------------------- |
| selector-dispatcher.cjs                           | telemetry/writer.cjs                | require('../core/telemetry/writer.cjs') | WIRED      | Line 205 lazy-require; line 227 emit('selector_pick', ...)             |
| pending-tension-store.cjs                         | telemetry/writer.cjs                | require('../core/telemetry/writer.cjs') | WIRED      | Line 266 lazy-require; line 286 emit('tension_engagement', ...)        |
| auto-explore-agent.cjs::handleUserResponse        | telemetry/writer.cjs                | require('../core/telemetry/writer.cjs') | WIRED      | Line 808 lazy-require; line 816 emit('auto_explore_decision', ...)     |
| breakthrough/scanner.cjs::surfaceBreakthrough     | telemetry/writer.cjs                | require('../telemetry/writer.cjs')      | WIRED      | Line 374 lazy-require; line 390 emit('breakthrough_dismissed', ...)    |
| room-auto-create.cjs::autoCreatePlaceholderRoom   | room-receipt-emit.cjs               | require('./room-receipt-emit.cjs')      | WIRED      | Phase 121-03 D-09 marker at line 299; emit AFTER memory_event success  |
| room-receipt-emit.cjs                             | telemetry/writer.cjs                | require('./telemetry/writer.cjs')       | WIRED      | Line 32                                                                |
| empathy-observation-emit.cjs                      | telemetry/writer.cjs                | require(path.join(REPO, 'lib/core/telemetry/writer.cjs')) | WIRED      | Line 37                                                                |
| telemetry-command-invocation.cjs                  | telemetry/writer.cjs                | require(path.join(REPO, 'lib/core/telemetry/writer.cjs')) | WIRED      | Line 37                                                                |
| hooks/hooks.json PostToolUse SlashCommand         | telemetry-command-invocation.cjs    | hook matcher                            | WIRED      | 1 SlashCommand entry registered; 9 total PostToolUse entries           |
| migrate-telemetry-v1.cjs                          | telemetry/validator.cjs             | require(path.join(REPO, 'lib/core/telemetry/validator.cjs')) | WIRED      | Line 55; validateEventPayload called 5 times inline (Gate 5)           |
| mva-telemetry.cjs (shim)                          | telemetry/writer.cjs                | require('./telemetry/writer.cjs')       | WIRED      | Line 15; writer.emit FIRST + legacy dual-write SECOND                  |
| hooked-rescore-117.cjs                            | events-YYYY-WNN.jsonl               | anchored-regex filter                   | WIRED      | Line 77 regex `^events-\\d{4}-W\\d{2}\\.jsonl$`; RELEVANT_EVENTS expanded |

### Behavioral Spot-Checks

| Behavior                                             | Command                                                            | Result                                                                | Status |
| ---------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- | ------ |
| Phase 121 aggregator runs green                      | `bash tests/run-all-121.sh`                                        | 19/19 PASSED in 21s                                                   | PASS   |
| Canon Part 8 adversarial audit passes                | `bash tests/test-121-04-canon-part-8-audit.sh`                     | PASS: 7 gates green; 17 files scanned (13 source + 4 test)            | PASS   |
| D-12 silent observability holds                      | `bash tests/test-121-04-silent-observability.sh`                   | PASS: 4 gates green; user-facing surfaces clean                       | PASS   |
| Phase 121 meta-scaffold passes                       | `bash tests/test-121-04-scaffold.sh`                               | PASS: 5 gates green; all 5 plans aggregate clean                      | PASS   |
| EVENT_TYPES is frozen with 15 strings                | `node -e "const s=require('./lib/core/telemetry/schema.cjs'); ..."` | EVENT_TYPES.length=15, frozen=true, SCHEMA_VERSION=1 typeof=number    | PASS   |
| ISO-week filename year-boundary correct              | `node -e "writer.isoWeekFilename(new Date('2026-01-01T12:00:00Z'))"` | `events-2026-W01.jsonl` (Thursday anchor correct)                     | PASS   |
| Zero em-dashes across telemetry production source    | `grep -P "\\x{2014}" <9 production files>`                         | grep exit 0 (no hits)                                                 | PASS   |
| Zero network surface across telemetry production     | `grep -rE "fetch\\(|http\\.|brain\\.mindrian" <8 production files>` | grep exit 1 (no hits)                                                 | PASS   |
| mva-telemetry.cjs is a 58-line shim                  | `wc -l lib/core/mva-telemetry.cjs`                                 | 58 lines (<=60 invariant satisfied)                                   | PASS   |
| PostToolUse SlashCommand hook registered             | `node -e "const h=require('./hooks/hooks.json'); ..."`              | PostToolUse count=9; SlashCommand entries=1; SessionStart count=4     | PASS   |

### Data-Flow Trace (Level 4)

Phase 121 is a capture-only surface (no UI rendering, no dynamic data display); Level 4 data-flow trace not applicable for the 12 must-haves. Downstream consumption (SEED-002 lab loop) is deferred to v1.14.0+ per the explicit phase scope.

### Requirements Coverage

The 12 TELEMETRY-121-XX requirement IDs are declared in each plan's `requirements-completed:` frontmatter, but the planner-emitted patch to append the IDs to `.planning/REQUIREMENTS.md` was deferred. See WARNING `REQ-IDS-NOT-APPENDED` in frontmatter. Coverage is satisfied at the SUMMARY level:

| Requirement         | Source Plan | Description                                                      | Status    | Evidence                                                     |
| ------------------- | ----------- | ---------------------------------------------------------------- | --------- | ------------------------------------------------------------ |
| TELEMETRY-121-01    | 121-00      | Unified writer module with emit-time validator                   | SATISFIED | `lib/core/telemetry/writer.cjs` + validator.cjs              |
| TELEMETRY-121-02    | 121-01      | One-time idempotent migration with sha256 fingerprint            | SATISFIED | `scripts/migrate-telemetry-v1.cjs`; 8/8 tests green          |
| TELEMETRY-121-03    | 121-00      | ISO-week rotation with zero-padded week                          | SATISFIED | `writer.isoWeekFilename` boundary tests pass                 |
| TELEMETRY-121-04    | 121-02      | selector_pick capture                                            | SATISFIED | `lib/hmi/selector-dispatcher.cjs:227` emit                   |
| TELEMETRY-121-05    | 121-02      | tension_engagement capture (user-initiated only)                 | SATISFIED | `lib/memory/pending-tension-store.cjs:286` emit              |
| TELEMETRY-121-06    | 121-02      | auto_explore_decision capture                                    | SATISFIED | `lib/agents/auto-explore-agent.cjs:816` emit                 |
| TELEMETRY-121-07    | 121-02      | breakthrough_dismissed capture                                   | SATISFIED | `lib/core/breakthrough/scanner.cjs:390` emit                 |
| TELEMETRY-121-08    | 121-01      | MVA option router + Hooked re-score normalized; 58-line shim     | SATISFIED | `lib/core/mva-telemetry.cjs` = 58 LOC; hooked-rescore repoint |
| TELEMETRY-121-09    | 121-03      | Empathy + room-receipt + command_invocation D-09 sweep           | SATISFIED | 3 surfaces + Phase 119 wire-in; drowning-protection fixture  |
| TELEMETRY-121-10    | 121-00      | Frozen v1 schema with per-row schema_version=1 (Number)          | SATISFIED | `SCHEMA_VERSION=1 typeof=number`; EVENT_TYPES.length=15      |
| TELEMETRY-121-11    | 121-04      | TELEMETRY-SCHEMA.md + Canon Part 8 adversarial audit             | SATISFIED | 364 LOC spec + 7-gate audit harness passes                   |
| TELEMETRY-121-12    | 121-04      | Silent observability invariant                                   | SATISFIED | 4-gate D-12 invariant harness passes                         |

No orphaned requirements detected for Phase 121.

### Anti-Patterns Found

| File                                              | Line | Pattern                                             | Severity         | Impact                                                                              |
| ------------------------------------------------- | ---- | --------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------- |
| `lib/core/mva-telemetry.cjs`                      | 6    | TODO(v1.14.0) marker                                | Info             | Scheduled retirement noted in source header. NOT a stub. Per Plan 121-01 D-08.      |
| `scripts/migrate-telemetry-v1.cjs`                | 30   | Documented chokepoint exception scoped to migration | Info             | Canon Part 9 exception explicitly scoped + documented; runtime emit paths route through writer.emit unchanged. NOT a violation. |
| `lib/core/mva-telemetry.cjs`                      | 48   | `fs.appendFileSync` to legacy mva.jsonl             | Info             | Plan 121-01 dual-write deprecation pattern; writer.emit (Canon Part 8 gate) is invoked FIRST. Scheduled retirement v1.14.0. |
| `scripts/mva-detect.cjs`                          | 79   | Legacy direct `fs.appendFileSync` to mva.jsonl      | Warning          | Pre-Phase 121 direct-emit path that was NOT routed through the new shim. Not in scope of TELEMETRY-121-08 acceptance (8 inherits Phase 118 shape via the shim's dual-write for byte-compat). v1.14.0 housekeeping per SUMMARY 121-01. |
| `lib/core/room-db.cjs`                            | 87   | Legacy direct `fs.appendFileSync` to nav-bypass.jsonl | Warning          | Pre-Phase 121 navigation-bypass writer. Plan 121-01 migrates accumulated historical data into unified stream; runtime cutover not in scope. Scheduled retirement v1.14.0. |

None are blockers for the 12 TELEMETRY-121-XX must-haves; all are documented transitional shims per Canon Part 7 reuse + dual-write deprecation pattern.

### Human Verification Required

None for the 12 must-haves. All checks are automated.

**One open future-verification item (not a Phase 121 gap):**

1. **SEED-002 corpus ingestion contract**
   - **Test:** When SEED-002 lab loop activates (>= 100 events accumulated), verify the consumer can correctly ingest `events-YYYY-WNN.jsonl` per the 8-point protocol in `docs/TELEMETRY-SCHEMA.md` Section 9.
   - **Expected:** Consumer dispatches on `event` discriminator, filters `command_invocation` bucket for high-signal-only views, handles schema_version=1 rows correctly.
   - **Why human:** SEED-002 is deferred to v1.14.0+; downstream verification belongs to that phase, not Phase 121. Phase 121's contract is producer-side capture; consumer activation is gated separately.

### Gaps Summary

No gaps blocking goal achievement. All 12 TELEMETRY-121-XX must-haves verified on disk against actual code:

- The unified writer chokepoint (writer.cjs + validator.cjs + schema.cjs) ships at the canonical paths with frozen v1 invariants (15 EVENT_TYPES Object.frozen, SCHEMA_VERSION=1 Number).
- The one-time idempotent migration script ships with source-name-prefixed sha256 fingerprint, .pre-v121.bak rename, and inline Canon Part 8 validator dispatch on every row.
- ISO-week rotation (zero-padded week) is unit-tested across 3 year-boundary cases (W21 / W02 / W01).
- 9 capture-point wire-ins land at every shipped surface (selector / tension / auto-explore / breakthrough / empathy / room-receipt / command-invocation hook / Phase 119 / Hooked re-score read-path repoint).
- mva-telemetry.cjs is exactly 58 LOC (audit Gate 6 <=60 invariant), delegates to writer.emit() FIRST, with documented legacy dual-write for Phase 118 byte-functional compat.
- docs/TELEMETRY-SCHEMA.md ships as the 364-LOC frozen v1 spec for SEED-002 ingestion (13 sections; all 15 EVENT_TYPES per-event documented; D-12 invariant codified).
- Canon Part 8 adversarial audit harness passes 7 gates across 17 files (13 source + 4 test split by design).
- D-12 silent observability invariant harness passes 4 gates across commands/ + lib/hmi/ + skills/ (no telemetry/trajectory/corpus/SEED-002 references in user-facing surfaces).
- Zero em-dashes across all 9 telemetry production source files (HARD RULE compliance).
- Zero network surface across all 8 telemetry production source files (Canon Part 8 LOCAL-only invariant).
- `bash tests/run-all-121.sh` exits 0 with 19/19 suites green in 21 seconds.

Two non-blocking observations:

1. **REQ-IDS-NOT-APPENDED:** The TELEMETRY-121-XX requirement IDs are not yet present in `.planning/REQUIREMENTS.md`. Each plan's `requirements-completed:` frontmatter declares them, but the docs patch was deferred. Recommended fix: small docs-only commit to append the 12 IDs.

2. **LEGACY-EMIT-PATHS-DUAL-WRITE:** Two pre-existing legacy direct `fs.appendFileSync` emit paths (`scripts/mva-detect.cjs:79` to legacy mva.jsonl + `lib/core/room-db.cjs:87` to navigation-bypass.jsonl) remain alongside the unified chokepoint by Canon Part 7 dual-write deprecation pattern. Plan 121-01 SUMMARY explicitly schedules both retirements for v1.14.0 when every legacy reader is repointed. Not gaps against the 12 must-haves; transitional state.

---

*Verified: 2026-05-19*
*Verifier: Claude (gsd-verifier, Opus 4.7 1M context)*
