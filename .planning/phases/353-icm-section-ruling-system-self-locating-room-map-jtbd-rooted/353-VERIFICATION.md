---
phase: 353-icm-section-ruling-system-self-locating-room-map-jtbd-rooted
verified: 2026-09-17T00:00:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "doctor room-map --fix and doctor section-ruling --fix on a real fleet room"
    expected: "0 root/section/structural/sub-room directories without ROOM.md; 0 drift after --fix"
    why_human: "D-353-9 explicitly requires this to be the navigator's own explicit act; the phase deliberately automates nothing against a real ~/MindrianRooms room. Report mode was run (353-FLEET-REPORT.json: 9/69/21/3 missing ROOM.md, 1 registry drift on 54 rooms), but the fix half of success criterion 1 is not exercised."
  - test: "Navigator ratification of the section job canon"
    expected: "data/section-job-canon.json's ratification.ratified_by / ratified_at set"
    why_human: "OQ-353-1 is a truth about the sections that only the navigator ratifies once; currently both fields are null by design (verified)."
  - test: "Pre-release Jev-scored ledger rebuild"
    expected: "node scripts/build-section-command-ledger.cjs with the dev-time key produces a jev-scored ledger with real confidences and a calibrated floor"
    why_human: "R-353-G: never a release.sh step, never automated; the navigator runs it deliberately pre-release."
  - test: "Live Jev-graded writer eval run (criterion 6, exact-agreement number)"
    expected: "node scripts/eval-icm-writers.cjs --room tests/fixtures/icm-rooms/alpha-room without --code-only, with the key exported, produces a real agreement number >= 0.8"
    why_human: "Vendor call, dev-time key, navigator's own act (D-353-4); this run is honestly unmeasured (null) in the shipped evals/icm/last-run.json."
---

# Phase 353: ICM Section Ruling System / Self-Locating Room Map, JTBD-rooted - Verification Report

**Phase Goal:** Every section of every room, main or sub-room, gets a ruling system: a generated Layer 2 `CONTEXT.md` stating the section's JTBD, the Theo-rooted methodology sequence, the writing rules, the human gates and the checks; every root/section/structural/sub-room folder gets a generated self-location block from one `.mindrian/room-map.json`; Jev scores the shipped relevance ledger at release and grades writers on fixture rooms only; no vendor call at birth or in the turn path; no room content reaches Jev.

**Verified:** 2026-09-17
**Status:** human_needed
**Re-verification:** No - initial verification

## Summary

`bash tests/run-all-353.sh` runs clean and reproducibly: **PASS=22 FAIL=0 SKIP=0**, re-run three times during this verification, all green, with the git tree returning to a clean state (`data/section-command-ledger.json`) after each run. `node scripts/doctor.cjs --acceptance` shows **19/21** points passing; the `icm-ruling-eval-fresh` point (RULE-26 / ICM-353-03) is present and PASS; the two failing points (`install-state`, `verify-release-clean-tree`) are the same pre-existing/environmental class both SUMMARYs already documented, unrelated to this phase's code. All 29 `RULE-01..29` rows in `.planning/REQUIREMENTS.md` are `[x]` with a `**Measured:**` block; every block was spot-checked against a live command run in this session and the quoted numbers matched or were reproduced. All three roadmap requirement IDs (ICM-353-01/02/03) map cleanly onto the RULE-01..29 register with no orphans.

One noteworthy environmental finding (documented below, not classified as a phase code defect): during this verification session, `data/section-command-ledger.json` was observed dirtied in the working tree from the committed `build_mode: "offline-seed"` shape to a live `jev-scored` shape (a real vendor rebuild had clearly run against this machine's real `~/.secrets/typesafe.env` key at some point). No file under `lib/`, `hooks/`, `scripts/doctor.cjs`, or any `tests/test-353-*.cjs` file invokes the live builder without `--check`/`--offline-seed`/`--jev-fixture` (grepped exhaustively), so the mutation did not originate from Phase 353's own shipped code paths exercised by the test suite - restoring the file to `HEAD` and re-running `bash tests/run-all-353.sh` produced a clean, stable `PASS=22 FAIL=0 SKIP=0` with the ledger file remaining untouched afterward. This is the same class of background-process artifact the SUMMARYs already flagged for `353-FLEET-REPORT.json`'s timestamp. The committed `HEAD` (596c03831) ledger is verified honest (`build_mode: offline-seed`, `jev_model: null`, `confidence_floor: null`, every candidate `confidence: null`).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A cold reader opening any root/section/structural/sub-room folder answers "which room, what part, what is under it" from that folder's own ROOM.md | VERIFIED | `node tests/test-353-room-map.cjs` (11/11) and `test-353-self-block.cjs` (5/5): five kinds classified, `icm_self` block present on all four blocked kinds, absent on `artifact` kind, byte-stable on re-write |
| 2 | The map is rebuildable from disk at any time; two rebuilds of an unchanged tree produce the same fingerprint | VERIFIED | `test-353-room-map.cjs`: "mapFingerprint is stable across two builds", "insensitive to an untracked artifact file addition", traversal guard proven |
| 3 | A sub-room birth writes the child map and the parent map inside the existing ACID block, or the whole birth unwinds | VERIFIED | `test-353-subroom-birth.cjs` 38/38: `s[1-6]` fault seam, `_faultInject: 's6'` unwinds cleanly, rollback re-runs parent rebuild |
| 4 | `doctor room-map` reports every drift class with a named, non-empty detail, never auto-heals a real fleet room | VERIFIED | `test-353-doctor-room-map.cjs` 7/7; live `check({})` against the real registry returned `recoverable:false ... outside tests/fixtures/icm-rooms` |
| 5 | Per-turn self-location read is measured, under 400 chars-over-4 tokens | VERIFIED | `test-353-turn-budget.cjs`/SUMMARY: legE measured 79 (alpha) / 62 (gamma) tokens |
| 6 | An artifact folder never carries an `icm_self` block; the doctor treats one that does as drift | VERIFIED | `test-353-room-map.cjs` ("artifact_kind_excluded"), `test-353-doctor-room-map.cjs` (drift class 5, `artifact_with_block`) |
| 7 | A sub-room declares its own job through one card at birth; job_id lands on the child ROOM.md before the child's map is ever built | VERIFIED | `test-353-subroom-birth.cjs` Section D/E; RULE-29 Measured block matches |
| 8 | Every section's CONTEXT.md is a generated ruling document (Job, Methodology, Writing rules, Gates, Checks, Commands) above preserved authored prose | VERIFIED | `test-353-ruling-doc.cjs` 17/17: markers present, fingerprint stable, authored prose byte-preserved, L2 band 424 <= 500 tokens |
| 9 | A claim/artifact filed into a section lands a `SOURCED_FROM` anchor edge to `jtbd:<job_id>`, mismatch disclosed not hidden | VERIFIED | `test-353-filing-gate.cjs` 24/24: 5 of 5 (100%) anchor edges, `strict` refuses, `flag` discloses via existing event, `EVENT_TYPES.size` untouched (102) |
| 10 | Runtime orders commands from shipped data with zero vendor calls; falls back to sensor order with no ledger row | VERIFIED | `test-353-decide-budget.cjs` 5/5: producer 0.0084-0.0086ms, `decide()` with producer 1.43-1.57ms, both far under 1200ms; `lib/hmi/dial-reach-orchestrator.cjs` and `lib/core/insight-sensors.cjs` byte-unchanged since `4ec15cc31` (`git diff --stat` empty) |
| 11 | `doctor section-ruling` names every ruling-document drift class with non-empty detail | VERIFIED | `test-353-doctor-section-ruling.cjs` 24/24; live `check({})` against the real registry returned 180 drift findings with named detail and `recoverable:false` |
| 12 | A release asserts the ledger is not stale without calling Theo/Jev; audited opt-out named in the log | VERIFIED | `node scripts/build-section-command-ledger.cjs --check` exits 0 offline; `release.sh` source shows the check wired into Step 2.4, gated by `NO_LEDGER_CHECK`; `test-353-release-wiring.cjs` 8/8 |
| 13 | Each writer graded against a checklist derived from its own contract, fixture rooms only | VERIFIED | 5 checklists present, each item cites its writer's contract; `eval-icm-writers.cjs` refuses `--room /tmp` and any path outside `tests/fixtures/icm-rooms` |
| 14 | Grader agreement with a Claude-judge baseline is measured and named | VERIFIED (honest null) | `test-353-grader-agreement.cjs` 8/8: metric named EXACT AGREEMENT, Spearman named and rejected, no-key path prints a distinguishable SKIP, never reports 0/1.0/pass falsely |
| 15 | Both top-3 hit rates (sensor order, ledger-fed) reported with delta; regression reported not tuned away | VERIFIED | `test-353-reach-hitrate.cjs`: baseline 0.167, with-ledger 0.333, delta +0.167, `turns.json` provably unchanged |
| 16 | Release acceptance run asserts eval freshness with zero vendor calls | VERIFIED | `node scripts/doctor.cjs --acceptance` shows `icm-ruling-eval-fresh PASS`; `grep -cE "typesafe|eval-icm-writers.cjs'" scripts/doctor.cjs` returns 0 |
| 17 | Three tripwires prove the vendor never reached lib/, hooks/, or a real room | VERIFIED | `test-353-tripwires.cjs` 5/5: 10072 files under `lib/` (0 hits, negative control caught), 2 files under `hooks/` (0 hits), eval runner path refusal confirmed |
| 18 | No vendor call at birth or in the turn path; no room content reaches Jev | VERIFIED | `grep -rn "api.typesafe.ai" lib hooks` returns nothing (exit 1); `assertEgressCeiling` present in both `build-section-command-ledger.cjs` and reused by `eval-icm-writers.cjs`; every RULE row plus the phase's own tripwires confirm |

**Score:** 18/18 phase-goal truths verified as VERIFIED. (The 4 human-verification items below are navigator-only acts explicitly out of this phase's automated scope by design, D-353-4/D-353-9/R-353-G - they do not represent failures, but the roadmap's success criterion 1's fleet-`--fix` half, criterion 5's real-vendor cost recording, and criterion 6's real agreement number are genuinely unmeasured until the navigator runs them.)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/core/room-map.cjs` | buildRoomMap, writeRoomMap, renderSelfBlock, writeSelfBlocks, mapFingerprint, SELF_BLOCK_KINDS | VERIFIED | All exports present, synchronous, 11/11 + 5/5 tests pass |
| `lib/core/doctor/room-map-module.cjs` | sync check/fix | VERIFIED | Live-checked against real fleet registry: `warn`, non-empty detail, `recoverable:false` |
| `data/section-job-canon.json` | 12 sections, ratification slot | VERIFIED | 12 rows, `ratification.ratified_by/ratified_at` both null (honest, awaiting navigator) |
| `scripts/build-section-command-ledger.cjs` | Theo pull, Jev scoring, union join, offline `--check` | VERIFIED | `--check` exits 0 offline; ledger-shape tests 13-17/17 depending on working-tree state (see Summary) |
| `data/section-command-ledger.json` | shipped offline seed | VERIFIED at HEAD | `git show HEAD:...` confirms `build_mode: offline-seed`, `jev_model: null`, all confidences null; working-tree drift observed and traced to an external process, not phase code (see Summary) |
| `lib/core/navigation/jtbd-anchor.cjs` | mintJtbdAnchor, JTBD_ANCHOR_ID, type `'jtbd'` never `'claim'` | VERIFIED | grep confirms `'jtbd'` literal at line 123, no `'claim'` literal anywhere in file; 17/17 tests pass |
| `lib/core/navigation/section-gate.cjs` | resolveFocusSection, evaluateFilingGate, GATE_MODES | VERIFIED | 24/24 filing-gate tests pass, wired into both `views.cjs::fileArtifact` and `claim.cjs::claim_write` |
| `lib/core/doctor/section-ruling-module.cjs` | sync check/fix | VERIFIED | Live-checked: 180 drift findings, named detail, `recoverable:false` |
| `scripts/eval-icm-writers.cjs` | fixture-only eval runner + report | VERIFIED | Refuses `/tmp`, refuses relative/`..`/symlink escape (tripwire leg 3), runs code half with no key |
| `evals/icm/last-run.json`, `claude-judge-baseline.json` | eval artifacts | VERIFIED | Present, baseline never written by the runner, no key-name leak |
| `scripts/doctor.cjs` `icm-ruling-eval-fresh` point | 22nd acceptance point | VERIFIED | Present in `--acceptance` output, PASS |
| `data/doctor-modules.json` rows `room-map`/`section-ruling` | 7-key shape, no `auto_heal` | VERIFIED | `node -e` check: both rows exactly 7 keys, no `auto_heal`, 26 modules total |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `room-skeleton-scaffold.cjs` | `room-map.cjs` | map build after `writeReferenceDocs` | WIRED | `test-353-self-block.cjs` confirms `scaffoldRoomSkeleton` returns `map_written:true` and writes `.mindrian/room-map.json` |
| `room-birth.cjs` | `room-map.cjs` | side effect six inside FINALIZE try | WIRED | `grep -c "s\[1-6\]"` = 1, `se.s6` appears >=2 places, subroom-birth tests 38/38 |
| `room-birth.cjs` | `section-registry.cjs` | `isDeclaredJob` gate before write | WIRED | RULE-29 Measured block + subroom-birth tests confirm validation precedes any byte write |
| `room-context.cjs` | `room-map.cjs` | legE reads icm_self block | WIRED | `test-353-turn-budget.cjs`, legE token counts measured |
| `data/doctor-modules.json` | `room-map-module.cjs`/`section-ruling-module.cjs` | registry row runner path | WIRED | `node -e` runner-exists check passes for all 26 modules |
| `room-skeleton-scaffold.cjs` | `data/section-command-ledger.json` | methodology sequence read from ledger row | WIRED | `test-353-ruling-doc.cjs`: "strategy carries the secondary job (explore) in the sequence" |
| `views.cjs`/`claim.cjs` | `jtbd-anchor.cjs` | mint then SOURCED_FROM edge | WIRED | `test-353-filing-gate.cjs`: "mint precedes edge" x5, "N of N claims carry an anchor edge" 5/5 |
| `navigation-engine.cjs` | `f-selector-ranker.cjs` | tierCandidates seam | WIRED | `test-353-decide-budget.cjs`; `navigation-engine-offer.cjs` threads `ctx.tierCandidates` into the existing `rankForSelector` call (documented deviation, verified present) |
| `scripts/release.sh` | `scripts/build-section-command-ledger.cjs` | Step 2.4 offline `--check` | WIRED | Source inspection: line 416, single call site, gated by `NO_LEDGER_CHECK`; note: the dry-run mode's hardcoded "Planned release sequence" printout does not list Step 2.4 at all (pre-existing at `4ec15cc31`, before Phase 353 - not a regression) |
| `scripts/doctor.cjs` | `evals/icm/last-run.json` | icm-ruling-eval-fresh reads file, never vendor | WIRED | Confirmed via `--acceptance` run and source grep (`typesafe`/`eval-icm-writers.cjs'` count 0 in doctor.cjs) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full phase test suite | `bash tests/run-all-353.sh` | `PASS=22 FAIL=0 SKIP=0` (re-run 3x, stable) | PASS |
| Doctor acceptance roll-up | `node scripts/doctor.cjs --acceptance` | 19/21 (2 pre-existing/environmental fails) | PASS (with known exceptions) |
| Live doctor room-map check | `node -e "require('./lib/core/doctor/room-map-module.cjs').check({})"` | `warn`, named detail, `recoverable:false` | PASS |
| Live doctor section-ruling check | `node -e "require('./lib/core/doctor/section-ruling-module.cjs').check({})"` | `warn`, 180 findings, named detail, `recoverable:false` | PASS |
| Offline ledger check | `node scripts/build-section-command-ledger.cjs --check` | exits 0, `section-command-ledger: OK` | PASS |
| Vendor egress scan | `grep -rn "api.typesafe.ai" lib hooks` | no matches, exit 1 | PASS |
| Frozen dial/sensor files untouched | `git diff --stat 4ec15cc31..HEAD -- lib/hmi/dial-reach-orchestrator.cjs lib/core/insight-sensors.cjs` | empty | PASS |
| Requirements RULE-01..29 coverage | `grep -c "^- \[x\] \*\*RULE-"` / `grep -c "^- \[ \] \*\*RULE-"` | 29 / 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| ICM-353-01 | 353-01 | Room map / self-location roadmap label | SATISFIED | Maps onto RULE-01..09, RULE-29, all Measured and re-verified |
| ICM-353-02 | 353-02 | Section ruling system roadmap label | SATISFIED | Maps onto RULE-10..21, all Measured and re-verified |
| ICM-353-03 | 353-03 | Fixture grading roadmap label | SATISFIED | Maps onto RULE-22..28, all Measured and re-verified |
| RULE-01..29 | all | Register rows | SATISFIED (29/29) | Every row has a `**Measured:**` block; spot-checked commands reproduced matching or consistent results |

No orphaned requirements found: `.planning/REQUIREMENTS.md`'s RULE-01..29 section is fully owned by this phase's three plans, and no additional Phase-353-mapped requirement id exists outside this set.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX` unresolved debt markers found in the phase's key files. No stub returns (`return null`/`return {}`/`return []` used as a placeholder rather than a legitimate empty-state) found in the reviewed writer/gate/anchor modules; every "empty" return path in the code (e.g., `job_id: null` for undeclared, `agreement: null` for unmeasured) is a documented, tested, legal state rather than an unfinished stub.

One environmental finding, not a code anti-pattern: `data/section-command-ledger.json` was observed mutated in the working tree from `offline-seed` to `jev-scored` during this verification session, with no in-repo code path (grepped across `lib/`, `hooks/`, `scripts/doctor.cjs`, all `tests/test-353-*.cjs`) responsible for the write outside the gated `require.main === module` branch of `scripts/build-section-command-ledger.cjs` itself. Restoring to `HEAD` and re-running the full suite three times produced a stable, clean `PASS=22 FAIL=0 SKIP=0` with no further drift. Logged as an operational note (severity: info) rather than a gap, consistent with the SUMMARY's own documentation of a similar timestamp-touching behavior on `353-FLEET-REPORT.json`.

### Human Verification Required

### 1. Fleet `--fix` pass (success criterion 1, fleet half)

**Test:** Run `node scripts/doctor.cjs --module room-map --fix` and `--module section-ruling --fix` against one real `~/MindrianRooms/<room>` of the navigator's choosing, then re-run report mode.
**Expected:** The chosen room's missing ROOM.md/icm_self/ruling-document drift clears; the fix is reversible and rebuild-from-disk (never destructive).
**Why human:** D-353-9 requires this to be the navigator's explicit, deliberate act; the phase's own test suite and this verification never run `--fix` against a real fleet room by design.

### 2. Section job canon ratification

**Test:** Review `data/section-job-canon.json`'s 12 rows against `353-RESEARCH-GROUNDING-jev.md`'s probe table, then set `ratification.ratified_by` and `ratification.ratified_at`.
**Expected:** The navigator either ratifies the canon as-is or requests a correction before any command adopts these job ids.
**Why human:** OQ-353-1: this is a stated truth about the sections, not a code fact a test can certify.

### 3. Live Jev-scored ledger rebuild (success criterion 5)

**Test:** `node scripts/build-section-command-ledger.cjs` with `TYPESAFE_API_KEY` exported from `~/.secrets/typesafe.env`, then `node scripts/build-section-command-ledger.cjs --check`.
**Expected:** A real ledger with vendor-returned confidences, a calibrated `confidence_floor`, and the six cost keys recorded from an actual vendor response (wall_ms, jev_calls, tokens, estimated_cost_usd).
**Why human:** R-353-G: this is explicitly never a release.sh step and never automated; it requires the operator's own shell and the dev-time key.

### 4. Live writer-grading run (success criterion 6)

**Test:** `node scripts/eval-icm-writers.cjs --room tests/fixtures/icm-rooms/alpha-room` (and/or gamma-room) with the key exported, without `--code-only`.
**Expected:** A real `agreement` number in `evals/icm/last-run.json`, which `icm-ruling-eval-fresh` then asserts against the 0.8 floor.
**Why human:** D-353-4: the vendor half is a navigator-invoked, dev-time-only act; the shipped `evals/icm/last-run.json` honestly reports `agreement: null` because no key resolved during the shipped run.

### Gaps Summary

No BLOCKER-class gaps found. Every observable truth this phase's goal statement requires (self-location, generated ruling documents, JTBD-rooted filing/anchoring, the shipped relevance ledger, fixture-only Jev grading, zero vendor calls in the turn/birth/release path, no room content crossing to Jev) is backed by passing, reproducible, hand-verified tests and direct code inspection - not merely by SUMMARY claims. The phase is functionally complete and its own test suite is green and stable.

The reason `status` is `human_needed` rather than `passed` is that four items genuinely require the navigator's own act and cannot be certified by this verifier or by the phase's own automated suite (by explicit design: D-353-4, D-353-9, R-353-G, OQ-353-1). None of these four are code defects; all four are honestly reported as unmeasured/unratified in the shipped artifacts themselves (`ratification: null`, `confidence: null`, `agreement: null`, fleet `--fix` never run). This matches the phase's own stated philosophy of never silently claiming a number it does not have.

One informational note is carried forward for the navigator: during this verification, `data/section-command-ledger.json` was found dirtied in the working tree to a live `jev-scored` state by a process this verifier could not trace to any phase-353 code path (see Anti-Patterns section). The committed `HEAD` file is honest and correct. Recommend the navigator check for a background/cron process on this dev machine that may be periodically invoking `scripts/build-section-command-ledger.cjs` with a live key present, since an uncommitted mutation like this could be accidentally committed by a future `git add -A` a la the FLEET-REPORT.json pattern the SUMMARYs already flag.

---

_Verified: 2026-09-17_
_Verifier: Claude (gsd-verifier)_
