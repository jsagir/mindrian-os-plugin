---
phase: 233-graph-derive-drain-residual-seed-037
verified: 2026-07-28T00:00:00Z
status: passed
score: 6/6 must-haves verified (all RCA Section 10 register items) + 5/5 code-review critical/warning findings confirmed fixed on disk
overrides_applied: 0
---

# Phase 233: Graph-derive drain residual (SEED-037) Verification Report

**Phase Goal:** Repair the ~16 rooms whose derive queues were silently cleared before Phase
224-02's fix (heal-on-update retrofit) and make sure a room that never derives semantic
cascade edges can never again go unnoticed (a new `graph-derive-health` doctor check +
`--heal-room` action, Tri-Polar aware), then close the remaining smaller register items: gate
`runDerivation`'s dead hosted-API default, reconcile the drain's doctrine comments, and fix the
HSI corpus/graph node-set mismatch (Section 9 Defects #4/#5).

**Verified:** 2026-07-28
**Status:** passed
**Re-verification:** No, initial verification (code-review-fix pass, 233-REVIEW.md /
233-REVIEW-FIX.md, is examined as part of this same pass since the phase closed with a review
cycle before being submitted)

## Requirement ID Register Cross-Reference (RCA Section 10 "Still OPEN")

The RCA has no REQUIREMENTS.md-style ID table; the register lives in
`.planning/debug/graph-derive-silent-clear-dead-api-derivation.md` Section 10. Every open item
is claimed by a plan's frontmatter `requirements` field:

| RCA ID | Description | Claimed by | Status |
|--------|-------------|-----------|--------|
| 4c | Heal/retrofit already-damaged rooms | 233-01-PLAN.md `requirements: ["4c","4d"]` | CLOSED, verified below |
| 4d | Doctor graph-derive-health check + heal class | 233-01-PLAN.md | CLOSED, verified below |
| 4b | Retire/gate the dead hosted-API default of runDerivation | 233-02-PLAN.md `requirements: ["4b","4e"]` | CLOSED, verified below |
| 4e | Reconcile drain doctrine comments | 233-02-PLAN.md | CLOSED, verified below |
| 9-defect-4 | HSI corpus/graph node-set mismatch (.snapshots/sub-rooms pollution) | 233-03-PLAN.md `requirements: ["9-defect-4","9-defect-5"]` | CLOSED, verified below |
| 9-defect-5 | Incomplete structural node coverage + pipeline order | 233-03-PLAN.md | CLOSED, verified below |

All six IDs are accounted for by name. No orphaned register item.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A room with BELONGS_TO edges and zero cascade edges is detected as `status:'fail'`, `needsHeal:true` by `detectRoomHealth`/`doctor --graph-derive-health --json` | VERIFIED | Independent ground-truth script (not the phase's own test suite): built a scratch registry + real room.db via `roomDb.openRoomDb` + a raw BELONGS_TO edge insert, ran `node scripts/doctor.cjs --graph-derive-health --json`, got `rooms[0].status === 'fail'`, `needsHeal: true` |
| 2 | `doctor --heal-room` writes a real queue entry; re-running is idempotent | VERIFIED | Same script: 1st `--heal-room` run wrote `graph-derive-queue.json` with 1 entry (read via `fs.readFileSync`); 2nd run still 1 entry |
| 3 | A pre-existing damaged room gets a derive queue entry automatically on the FIRST bare `doctor.cjs` run post-update, no explicit flag needed (the cadence:'once' retrofit) | VERIFIED | Ran a completely bare `node scripts/doctor.cjs --json` (no `--heal-room`, no `--graph-derive-health`) against the same fixture; `checks['accumulative-engine'].findings` contained `{id:'graph-derive-heal-retrofit', status:'ok', healed:1, rooms_scanned:1, errors:0}`, and the queue file existed with 1 entry after this single bare invocation |
| 4 | Re-running the retrofit a second time enqueues nothing new (watermark-gated, once-only) | VERIFIED | 2nd bare `doctor.cjs --json` run against the same fixture: queue entry count stayed at 1 |
| 5 | SessionStart Coordinator surfaces a plain-language re-derive sentence on the install-drift fragment, never raw JSON | VERIFIED | `scripts/preflight-doctor.cjs` `graphDeriveNudge(report)` reads `report.checks['graph-derive-health']`, returns a fixed sentence ("Your Data Room graph needs a re-derive...") appended to the existing `pieces` array; `contribute()` now passes `['--graph-derive-health']` into its one spawn (confirmed by direct code read, lines 59-62, 139-204 of `scripts/preflight-doctor.cjs`) |
| 6 | `runDerivation({roomDir})` with no deriveFn and no hosted opt-in throws synchronously (`deriveFn_required_no_hosted_default`) before any network attempt | VERIFIED | Direct invocation: `require('./lib/core/graph-derivation.cjs').runDerivation({roomDir: os.tmpdir()})` with `MINDRIAN_ALLOW_HOSTED_DERIVE` unset threw synchronously with that exact message before returning a promise |
| 7 | Gate opens correctly with `MINDRIAN_ALLOW_HOSTED_DERIVE=1` + a funded key, byte-identical to prior behavior | VERIFIED (via code read + REVIEW-FIX re-run) | `_resolveDefaultDeriveFn()` code at `lib/core/graph-derivation.cjs:161-183`; `test-233-derivation-default-gate.cjs` scenario 6 (re-ran in `run-all-233.sh`, PASS) |
| 8 | Drain/backfill share one producer (`classifier.scoreBasedDeriveFn`), proven by regression not assertion | VERIFIED | `test-233-drain-backfill-producer-parity.cjs` re-ran green as part of `run-all-233.sh` (source + live legs, both independently mutation-proven per 233-02-SUMMARY.md) |
| 9 | Drain header no longer implies blanket clear-on-failure | VERIFIED | `grep -n "and CLEARS the drained entry" scripts/gsd-graph-derive-drain.cjs` returns zero matches; header now reads "DIVISION OF LABOR (RCA graph-derive-silent-clear item 4e...)" stating keep-on-failure + division of labor |
| 10 | `compute-hsi.py` never scores `.snapshots`/sub-rooms pollution, imports the shared `SKIP_DIRS`/`SKIP_FILES`/`MIN_BODY_CHARS` source, no local literal | VERIFIED | `grep -n "SKIP_DIRS" scripts/compute-hsi.py` shows only `from rs_corpus_exclude import SKIP_DIRS...` and the filter usage, no local set literal; `lib/core/rs_corpus_exclude.py`'s `SKIP_DIRS` set contains `.snapshots`, `sub-rooms`, `.context` |
| 11 | `--scope-to-nodes` intersects scoring with the room's real Artifact node set, degrading permissively (never to silence) on a missing/immature db | VERIFIED | Code read of `load_graph_artifact_ids`/`_file_uri_path` in `scripts/compute-hsi.py`; `test-233-hsi-scope-to-nodes.sh` re-ran green in `run-all-233.sh` |
| 12 | `graph-heal-pipeline.cjs` runs the 4 stages in RCA-mandated order, never writing a cascade edge before structural nodes exist | VERIFIED | Code read confirms `structuralOk` gating on stages 2/3 (WR-02 fix) and `skipRebuild` gating on stage 4 (the live-run defect fix documented in 233-03-SUMMARY.md); `test-233-graph-heal-pipeline.cjs` re-ran green (28 assertions, 1 skip) |

**Score:** 12/12 observable truths verified (all directly re-derived from codebase state, not from SUMMARY.md prose).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/core/doctor/graph-derive-health-module.cjs` | `detectRoomHealth`/`check`/`fix` exports | VERIFIED | File exists, exports confirmed via grep, CR-01 fix present (lines 360-408: `flaggedNotNeeding` logic replacing the contradictory `needing`-only gate) |
| `lib/core/doctor/graph-derive-heal-retrofit-module.cjs` | `check` only, cadence:once | VERIFIED | File exists, WR-01 fix present (`status: errors > 0 ? 'warn' : 'ok'`, line 130) |
| `data/doctor-modules.json` | 2 new registry entries | VERIFIED | `graph-derive-health` (cadence always, flag graphDeriveHealth, fix_supported true) and `graph-derive-heal-retrofit` (cadence once, flag null, fix_supported false) both present with correct shape (read directly via `python3 -c "json.load(...)"`) |
| `lib/core/graph-derivation.cjs` | Gated `_resolveDefaultDeriveFn` | VERIFIED | Function present at line 171, called at line 219, throws `deriveFn_required_no_hosted_default` |
| `scripts/graph-heal-pipeline.cjs` | `runHealPipeline` 4-stage ordered pipeline | VERIFIED | File exists (15010 bytes), WR-02 fix present (`structuralOk` gating, lines 185-247) |
| `lib/core/rs_corpus_exclude.py` | `.snapshots`/`sub-rooms`/`.context` in shared SKIP_DIRS | VERIFIED | Confirmed present in the set (lines 39-55) |
| `scripts/compute-hsi.py` | Imports shared source, no local literal, `--scope-to-nodes`, WR-03 URI fix | VERIFIED | `from rs_corpus_exclude import` present; no local `SKIP_DIRS = {...}` literal; `_file_uri_path` present (WR-03 fix) |
| `tests/run-all-233.sh` | Phase gate aggregating all legs, Part 8 sweep | VERIFIED | Re-ran directly: `PASS=12 FAIL=0 SKIP=0`, matching 233-REVIEW-FIX.md's claimed count exactly; WR-04 fix present (`PART8_RE` includes axios/onrender/api.anthropic/brain) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `graph-derive-heal-retrofit-module.cjs` | `graph-derive-health-module.cjs` | `require('./graph-derive-health-module.cjs')` | WIRED | Confirmed by grep + successful ground-truth invocation (retrofit correctly identified the damaged fixture room) |
| `graph-derive-health-module.cjs fix()` | `gsd-graph-derive-sweep.cjs enqueueDerive` | require + call | WIRED | Ground-truth: `--heal-room` wrote a real queue entry |
| `scripts/preflight-doctor.cjs contribute()` | `doctor.cjs --json report.checks['graph-derive-health']` | `runDoctor(['--graph-derive-health'])` | WIRED | Code read confirms the flag is passed into the existing single spawn (233-01's own key-decision: without this the class would never populate and the nudge would ship inert) |
| `scripts/gsd-graph-derive-drain.cjs` | `lib/core/graph-derive-classifier.cjs scoreBasedDeriveFn` | default producer | WIRED | Confirmed by `test-233-drain-backfill-producer-parity.cjs` (source + live legs), re-ran green |
| `scripts/graph-heal-pipeline.cjs` | `lib/core/graph-backfill.cjs runDeriveBackfill` | stage 4, `skipRebuild` opt-in | WIRED | Code read + the documented live-run-found defect (stage 4 wiping stage 3's edges) which was fixed with `skipRebuild`, confirmed present |
| `scripts/doctor.cjs` | `--graph-derive-health` / `--heal-room` flags | parseArgs branches | WIRED | Ground-truth CLI invocation confirmed both flags functional end-to-end |

### Data-Flow Trace (Level 4)

Not applicable in the UI-rendering sense (this phase is backend doctor/CLI infra, no dynamic frontend component). The equivalent check here is "does the detection signal reflect the REAL room.db state, not a mocked value" — confirmed via my own from-scratch fixture (independent of the phase's own test fixtures), which produced `status:'fail'` from a genuinely built SQLite room.db, and the retrofit's `healed:1` genuinely corresponded to a real queue-file write read back off disk.

### Code Review + Review-Fix Verification (Explicit Requirement)

`233-REVIEW.md` found 1 critical (CR-01) + 4 warning (WR-01 through WR-04) + 2 info (IF-01, IF-02) findings. `233-REVIEW-FIX.md` claims all 5 critical/warning findings fixed with negative self-tests, leaving the 2 info findings open by design.

| Finding | Claimed Fix | Verified on disk | Independently re-run |
|---------|-------------|-------------------|----------------------|
| CR-01 (critical) | `check()`'s success-sentence gating stopped contradicting `status` | CONFIRMED — `graph-derive-health-module.cjs:360-408` contains the `flaggedNotNeeding` logic exactly as REVIEW-FIX describes, with the CR-01 comment block in place | `test-233-graph-derive-health.cjs` PASS as part of `run-all-233.sh` |
| WR-01 (warning) | Retrofit returns `warn` (not `ok`) when `errors > 0`; stops claiming a retry it can't make | CONFIRMED — `graph-derive-heal-retrofit-module.cjs:130` (`status: errors > 0 ? 'warn' : 'ok'`), `errors` field present in return object | `test-233-graph-derive-heal-retrofit.cjs` PASS |
| WR-02 (warning) | Stages 2/3 gated on `structuralOk` | CONFIRMED — `graph-heal-pipeline.cjs` lines 185-247 show `structuralOk` checks before both stage 2 and stage 3, `skipped:true` reporting | `test-233-graph-heal-pipeline.cjs` PASS (28 assertions, 1 skip) |
| WR-03 (warning) | `_file_uri_path` percent-encoding helper, mirroring JS `_fileUriPath` | CONFIRMED — `scripts/compute-hsi.py:203` defines `_file_uri_path`, used at line 259 in the `mode=ro` connect call | `test-233-hsi-uri-path-encoding.sh` PASS (new suite, ran as part of `run-all-233.sh`) |
| WR-04 (warning) | `PART8_RE` strengthened to match the ad-hoc grep actually used to certify the phase | CONFIRMED — `tests/run-all-233.sh:140` shows `PART8_RE` now includes `axios|onrender|api\.anthropic|brain` | New "Part 8 self-test" leg PASS, re-ran directly |
| IF-01 (info, deliberately deferred) | Register `test-233-graph-heal-pipeline.cjs` in `run-feynman-tests.cjs` | STILL OPEN, confirmed by grep (no match) | Not a blocker — REVIEW-FIX.md explicitly scoped this out of the critical_warning pass; the suite still runs via `run-all-233.sh`'s glob discovery, so it is not orphaned from the phase gate, only from the separate repo-wide Feynman runner |
| IF-02 (info, deliberately deferred) | `graph-backfill.cjs` import `CASCADE_SUBSET` instead of duplicating `CASCADE_FAMILY` | STILL OPEN, confirmed (`CASCADE_FAMILY` literal still present at `graph-backfill.cjs:171`) | Not a blocker — pre-existing from Phase 169-05, explicitly deferred, both arrays currently agree |

**Full phase gate, re-run independently by this verifier (not trusting the reported count):**

```
$ bash tests/run-all-233.sh
...
Phase 233: PASS=12 FAIL=0 SKIP=0
```

This matches `233-REVIEW-FIX.md`'s claimed `PASS=12 FAIL=0 SKIP=0` exactly, confirming the fix pass genuinely holds in the current tree (not merely reported).

### Requirements Coverage

No project-wide REQUIREMENTS.md exists for this repo (dev-tooling, not a formal product), consistent with this phase's own ROADMAP.md entry noting this explicitly. The RCA's Section 10 register substitutes for that role and is fully cross-referenced above (all 6 IDs accounted for).

### Anti-Patterns Found

None blocking. Scanned all phase-touched files (`lib/core/doctor/graph-derive-health-module.cjs`, `lib/core/doctor/graph-derive-heal-retrofit-module.cjs`, `scripts/graph-heal-pipeline.cjs`, `lib/core/rs_corpus_exclude.py`, `scripts/compute-hsi.py`, `lib/core/graph-derivation.cjs`, `scripts/gsd-graph-derive-drain.cjs`, `scripts/preflight-doctor.cjs`, `scripts/doctor.cjs`) for `TBD|FIXME|XXX` — zero matches. No em-dashes introduced by any phase-233 commit (checked via `git show <commit> -- CHANGELOG.md | grep -P '\x{2014}'` on each of the three CHANGELOG-touching commits — all clean; the 107 em-dashes present in the full CHANGELOG.md file are pre-existing, unrelated history).

Two INFO-level items remain open by deliberate, documented scope decision (IF-01, IF-02 above) — noted but not blocking per the review's own scoping.

Two pre-existing, independently-verified-as-not-caused-by-this-phase issues are logged in `deferred-items.md`: `test-session-start-preflight.sh` S2/S3 failures, and `test-graph-derivation-verdict.cjs` 2/14 (FEYNMAN `## Timeline (auto)` section, unrelated code path). Both proven pre-existing via `git checkout --` bisection in the SUMMARYs; not re-verified independently here since they are explicitly out of this phase's scope and do not touch any must-have.

### Human Verification Required

None. This phase is backend doctor/CLI/pipeline infrastructure with no rendered UI surface. The Tri-Polar Desktop/Cowork nudge is a scalar plain-language string threaded through the existing, already-shipped `install-drift` SessionStart fragment mechanism (unchanged rendering path, only new content); its content and no-table-character constraint are covered by an automated test (`preflight-doctor.cjs contribute()` scenarios), and this verifier independently confirmed the wiring by direct code read. No new interactive surface, model behavior, or visual element was introduced that requires a human judgment call.

### Gaps Summary

None. All 6 RCA register items are closed and independently re-derived from the current codebase state (not from SUMMARY.md claims alone): the health/heal doctor class and cadence-once retrofit genuinely fire against a hand-built fixture with no reliance on the phase's own test harness; the `runDerivation` gate genuinely throws synchronously; the drain header genuinely no longer claims blanket clear-on-drain; the HSI corpus scanner genuinely imports the shared exclude source with the pollution directories added; the heal pipeline genuinely gates later stages on earlier-stage success. The code-review-fix pass (CR-01, WR-01 through WR-04) is genuinely present in the shipped files, and the full phase gate re-run by this verifier independently reproduces the claimed `PASS=12 FAIL=0 SKIP=0`.

One nuance worth stating plainly (not a gap, a scope clarification the phase's own SUMMARYs already make explicit): the ~16 previously-damaged rooms get their retry SIGNAL restored automatically by this phase (proven above), but this phase deliberately does not force an in-session derive to run against them — actual semantic cascade edges land only when a subsequent `/mos:graph --derive` or `graph-heal-pipeline.cjs` invocation runs against each room. This matches the ROADMAP goal's own parenthetical, "(heal-on-update retrofit)", and is a documented, deliberate design decision from `233-CONTEXT.md` ("the real edges land the next time an in-session derive runs — not this phase's job to force one"), not an incomplete implementation.

---

_Verified: 2026-07-28_
_Verifier: Claude (gsd-verifier)_
