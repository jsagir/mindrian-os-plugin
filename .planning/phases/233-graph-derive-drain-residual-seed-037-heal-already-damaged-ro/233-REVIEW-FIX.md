---
status: all_fixed
phase: 233
findings_in_scope: 5
fixed: 5
skipped: 0
---

# Phase 233 Code Review Fixes (iteration 1)

Scope for this pass was `critical_warning`: CR-01 plus WR-01 through WR-04. The two
INFO findings (IF-01 test registration, IF-02 CASCADE_FAMILY duplication) were left
alone as instructed and remain open in 233-REVIEW.md.

Every fix follows the same discipline the phase itself is about: the failure mode is
reproduced as a test FIRST-CLASS FIXTURE, the test is verified to FAIL against the
pre-fix code, and only then is the fix credited. Four of the five findings describe
reproducible behavior and all four got a regression test with a recorded negative
self-test. WR-04 is a test-harness finding and got a self-test of the harness itself.

One finding turned out to be worse than the review scored it: WR-03 was reported as
"practical exploitability is limited", but the negative self-test shows the pre-fix
code does not merely risk a degraded open, it FAILS the open outright and silently
falls back to scoring everything. Noted per-finding below.

## Full phase gate

`bash tests/run-all-233.sh`

```
>>> test-233-derivation-default-gate.cjs: PASSED
>>> test-233-drain-backfill-producer-parity.cjs: PASSED
>>> test-233-graph-derive-heal-retrofit.cjs: PASSED
>>> test-233-graph-derive-health.cjs: PASSED
>>> test-233-graph-heal-pipeline.cjs: PASSED
>>> test-233-hsi-scope-to-nodes.sh: PASSED
>>> test-233-hsi-skip-dirs-shared-source.sh: PASSED
>>> test-233-hsi-uri-path-encoding.sh: PASSED
>>> test-doctor-module-contract-parity.cjs: PASSED
>>> test-doctor-doc-parity.cjs: PASSED
>>> Part 8 self-test: PASSED
>>> Part 8 sweep: PASSED
======================================
Phase 233: PASS=12 FAIL=0 SKIP=0
======================================
```

Baseline before this pass was `PASS=10 FAIL=0 SKIP=0`. The two added legs are the new
`test-233-hsi-uri-path-encoding.sh` suite (WR-03) and the new Part 8 self-test (WR-04).
Zero skips, so nothing was certified by an environment-degraded path.

Adjacent gates re-run green: `node scripts/build-connector-registry.cjs --check`
(connector-registry: OK), `python3 -m py_compile scripts/compute-hsi.py`, and the two
generic doctor gates (contract-parity, doc-parity) which cover the changed doctor
module return shapes.

No em-dashes introduced (all ten changed files scanned).

---

## CR-01 (critical) -- FIXED

**File:** `lib/core/doctor/graph-derive-health-module.cjs` (function `check`)
**Commit:** `f016f923`

### What was wrong

`check()` reused `needing` (rooms that are `needsHeal` or queue-stuck) to gate the
sentence "every one has run its semantic derive". But `detectRoomHealth`'s per-room
status vocabulary is WIDER than that predicate: it also returns `'warn'` for a room
whose `graph-derive-failures.json` still carries old records while its cascade edges
are now present and its queue is clear. That room is excluded from `needing`, so the
class shipped a plain-language universal-health claim directly beside `status: 'warn'`.

The realistic room state is a room that failed a derive a few times and then
RECOVERED, which is the normal desired outcome of the keep-on-failure retry design
224-02 shipped. The `detail` string is exactly what the Tri-Polar Desktop/Cowork nudge
in `preflight-doctor.cjs` reads for the fail/warn branch, and what a human reads off
the CLI row.

### How it was fixed

Minimal, and deliberately NOT the "recompute `needing` from the status vocabulary"
option. `needing` is correct as-is: it counts what `--heal-room` will actually act on,
and `fix()` uses the same predicate. A recovered room genuinely has nothing left to
re-enqueue, so widening `needing` would have made the "N need a derive re-enqueue"
sentence wrong instead.

Instead the success sentence is gated on nothing being flagged at all. A new
`flaggedNotNeeding` count captures rooms the status vocabulary flags but `--heal-room`
will not touch, and a third `detail` branch names the failure-log reason the class is
warning about. The branch order was inverted to `needing > 0` first so the fall-through
case is the genuinely clean one.

### Verification

`node tests/test-233-graph-derive-health.cjs` -> `ALL PASS (14 scenarios)`

- **Scenario 13** builds the exact recovered-room shape (BELONGS_TO + INFORMS edges,
  clear queue, two old failure records on disk), asserts the preconditions hold
  (`needsHeal:false`, `queueStuckCount:0`, `failureLogCount:2`, per-room and class
  status both `warn`), then asserts the detail does NOT carry the universal-health
  sentence and DOES name the reason. It also pins the general invariant: the success
  sentence appears only when the class status is `ok`.
- **Scenario 14** is the control: a genuinely clean room still earns the success
  sentence, so scenario 13 is not passing by deleting the message.

**Negative self-test:** with the module reverted via `git stash`, scenario 13 reports
`FAIL` (`FAIL: 1 scenario(s) failed, 13 passed`) and scenario 14 still passes. The test
discriminates on exactly the changed behavior.

---

## WR-01 (warning) -- FIXED

**File:** `lib/core/doctor/graph-derive-heal-retrofit-module.cjs` (function `check`)
**Commit:** `bbad17ab`

### What was wrong

`check()` returned a flat `status: 'ok'` even when every room in the registry failed to
heal. The inline comment justified this with "the next run retries it", which is wrong
about this module's own cadence. Confirmed by reading the engine directly
(`scripts/doctor.cjs` `runAccumulativeEngine` step 5-6): `anyHardError` is set ONLY in
the `catch` around the runner invocation, so it trips only when a runner THROWS. This
module never throws, because every per-room failure is caught internally and folded
into `errors`. So `writeDoctorApplied` advances the watermark past
`introduced_version` after the single invocation regardless, the
`(applied_through, running]` window is empty forever after, and there is no "next run"
for this `cadence: 'once'` module.

A systemic failure inside that one window (unwritable queue path, bad
`MINDRIAN_ROOMS_HOME`, a throwing sweep) would strand the already-damaged rooms with no
further automatic repair attempt, while the module's own status claimed a clean pass.

### How it was fixed

`status` is `'warn'` whenever `errors > 0` (the stronger of the review's two options:
any unreachable room deserves surfacing, because none of them get a second automatic
attempt, not just the total-failure case). `errors` is now also returned in the result
object so a machine consumer can read it rather than parsing prose.

The false claim was corrected in both places it appeared. The detail now states what
actually happens to a stranded room: it stays flagged by the sibling `cadence: 'always'`
`graph-derive-health` class, and the operator repairs it with `/mos:doctor --heal-room`.
The inline comment was rewritten to explain the cadence reasoning rather than assert
the wrong conclusion.

Watermark behavior is deliberately unchanged. Returning `'warn'` does not block the
advance (only a throw does), and blocking it would be a behavior change well beyond
this finding.

### Verification

`node tests/test-233-graph-derive-heal-retrofit.cjs` -> `ALL PASS (10 scenarios)`

- **Scenario 5b** forces a REAL enqueue failure rather than stubbing one: it places a
  DIRECTORY where the queue file belongs, so `readQueue`'s `readFileSync` throws EISDIR
  and degrades to an empty queue, then `writeQueue`'s `renameSync` onto a directory
  throws, and `enqueueDerive` returns `{ ok: false, reason: 'write_failed' }`. Asserts
  ground truth first (`healed: 0`, `rooms_scanned: 2`, `errors: 1`), then `status`
  `warn`, then that the detail no longer promises a retry and does name `--heal-room`.
- **Scenario 5c** pins the clean path: a fully successful pass still reports `ok` with
  `errors: 0`.

**Negative self-test:** with the module reverted, `FAIL: 2 scenario(s) failed, 8 passed`
(5b on the status assertion, 5c on the absent `errors` field).

Both generic doctor gates re-run green against the changed return shape:
`test-doctor-module-contract-parity.cjs` (18 registry modules, 9-rule D-03 contract) and
`test-doctor-doc-parity.cjs`.

---

## WR-02 (warning) -- FIXED

**File:** `scripts/graph-heal-pipeline.cjs` (stages 2 and 3)
**Commit:** `2cf4808d`

### What was wrong

Stage 2 (scoped HSI) ran unconditionally regardless of whether stage 1
(structural-index) succeeded. With stage 1 failed, `--scope-to-nodes` intersects
against whatever is in `room.db`, and when that set is EMPTY,
`load_graph_artifact_ids` returns an empty SET rather than `None`. An empty set is a
SUCCESSFUL query, so it never reaches `compute-hsi.py`'s permissive score-everything
degrade path. `main()` filters the artifact list to nothing, the `< 2` guard writes an
empty `.hsi-results.json` and exits 0, and `_spawnStage` reads exit 0 as `ok: true`.
The run reported `{ name: 'hsi-score', ok: true }` over a pass that scored nothing,
with the only signal a prose tail in `detail` that no machine consumer reads.

### How it was fixed

Option (a) from the review: stages 2 and 3 are gated on `structuralOk`, mirroring how
stage 4's `skipRebuild` already is. Both report `skipped: true, ok: false` with a
detail naming the dependency, so `.ok` and `.skipped` now carry the truth.

Stage 3 is gated for a second, distinct reason worth recording: it reads
`.hsi-results.json` off disk, and with stage 2 skipped that file can be a STALE
artifact of an earlier run whose node set no longer describes the room. Running it
would write edges from a stale scoring pass.

Stage 4 is deliberately NOT gated, and the header now says why: its own internal
rebuild is the last line of defense when stage 1 could not index the room. The
"SOFT-FAIL BY DESIGN" header section gained a paragraph distinguishing soft-fail from
run-anyway.

### Verification

`node tests/test-233-graph-heal-pipeline.cjs` ->
`PASS (28 assertions, 1 skipped)` (was 21 assertions before this pass)

New section H proves the gate by NON-INVOCATION rather than by reading the stage's own
detail string about itself:

- **H0** precondition: stage 1 really failed, forced by a REAL fixture (a FILE where
  the `.mindrian` directory belongs, so `openGraph`'s recursive mkdir throws EEXIST).
  Nothing stubbed.
- **H1** the stage-2 spawn never happened, proven by an absent marker file written by a
  sentinel executable swapped in for `pythonBin`.
- **H2** same for stage 3 via `nodeBin`.
- **H3** both stages report `skipped: true, ok: false` and `hsiSkipped` is set.
- **H4** no `.hsi-results.json` was produced for the failed room.
- **H5** the gate does not over-reach: stage 4 still ran.
- **H6** the CONTROL that makes H1/H2 meaningful: the same sentinel binaries against a
  room where stage 1 SUCCEEDS DO fire both markers. The absence in H1/H2 is the gate
  biting, not a sentinel that never fires.

**Negative self-test:** with the pipeline reverted, H1 fails with
`AssertionError [ERR_ASSERTION]: H1. REGRESSION: with stage 1 failed, stage 2 was NEVER
SPAWNED` -- the pre-fix code really does spawn compute-hsi.py against a failed index.

---

## WR-03 (warning) -- FIXED

**Files:** `scripts/compute-hsi.py` (`load_graph_artifact_ids`),
`lib/core/graph-derivation.cjs` (export only)
**Commit:** `66fe2f3d`

### What was wrong

The read-only sqlite URI was built by raw splice:

```python
conn = sqlite3.connect('file:%s?mode=ro' % db_path, uri=True)
```

SQLite's URI parser treats `?` as the query separator, `#` as the fragment start and
`%` as the escape byte. A room directory containing any of them makes the parser stop
reading the path early and swallow the rest as a query string, taking the `mode=ro`
flag down with it. That breaks the T-233-09 threat-register claim that read-only is
enforced mechanically at the SQLite layer rather than by convention.

This is the exact bug class `lib/core/graph-derivation.cjs::_fileUriPath` was written
to close for the sub-room ATTACH on the SAME `room.db` path. The codebase awareness had
simply not crossed to the python side.

**Severity note:** the review judged practical impact limited. The negative self-test
shows it is worse than that. Against the pre-fix script the open does not degrade
ambiguously, it FAILS, and `load_graph_artifact_ids` returns `None`. The caller then
silently falls back to scoring everything, which is precisely the permissive path the
function's docstring reserves for a missing db. So for any room whose path contains
`?`, `#` or `%`, the whole `--scope-to-nodes` feature (RCA Defect #4, one of the two
defects Plan 03 exists to close) was silently inert, and it looked healthy while doing
it. Same false-success class as the rest of the phase.

### How it was fixed

A new `_file_uri_path` helper mirrors the JS `_fileUriPath` byte for byte: the same
three bytes, in the same order (`%` first, so it cannot double-encode the escapes it
just introduced). Deliberately NOT `urllib.parse.quote` as the review suggested. Both
are correct in isolation, but the two implementations encode the SAME `room.db` path
for the same room, and two encoders that disagree about what a room path means is a
worse bug than either alone. `quote` would additionally encode spaces and unicode,
diverging from the JS side.

`_fileUriPath` is now exported from `graph-derivation.cjs` purely so that parity is
CHECKED rather than assumed (the same "exported for hermetic unit tests" idiom the
doctor modules already use). The docstring for `load_graph_artifact_ids` was updated so
the T-233-09 claim it makes is now accurate.

### Verification

New suite `bash tests/test-233-hsi-uri-path-encoding.sh` ->
`PASS [test-233-hsi-uri-path-encoding]: --scope-to-nodes opens read-only under a room
path carrying ? # and %`

Three legs, all against a room directory literally named `room ?q=1 #frag 100%`:

- **Leg A** the function returns the REAL Artifact id set, not the `None` degrade path,
  so the open genuinely succeeded rather than failing safe and looking fine.
- **Leg B** the `mode=ro` flag really was honored: an INSERT through the same opened URI
  raises `sqlite3.OperationalError` with a readonly refusal. T-233-09 is now EXECUTED
  rather than asserted.
- **Leg C** the python and JS encoders produce identical output over seven adversarial
  paths (plain, `?`, `#`, `%`, all three combined, a pre-escaped `%25`, and one with a
  space and an apostrophe).

Skips cleanly when numpy/scikit-learn are absent, since `compute-hsi.py` guards those at
module scope. Auto-discovers through `run-all-233.sh`'s existing `tests/test-233-*.sh`
glob, so no harness edit was needed. Zero network reach (module import plus one sqlite
open, no model load).

**Negative self-test:** with `compute-hsi.py` reverted, leg A reports
`LEG_A_FAIL degraded to None: the URI open did not succeed`.

Sibling suites re-run green: `test-233-hsi-scope-to-nodes.sh`,
`test-233-derivation-default-gate.cjs` (11/11),
`test-233-drain-backfill-producer-parity.cjs` (15/15).

---

## WR-04 (warning) -- FIXED

**File:** `tests/run-all-233.sh` (`PART8_RE` and a new self-test leg)
**Commit:** `ef0bd1a5`

### What was wrong

The committed permanent tripwire carried only
`fetch\(|https?://|require\(['\"]node:https?|\b(curl|wget)\b`, while 233-01's and
233-02's SUMMARY.md both report certifying the phase by hand with `axios`, `onrender`,
`api\.anthropic` and `brain` as additional tokens. A bare `require('axios')` with no
literal URL, or a bare `onrender`/`anthropic`/`brain` reference not preceded by a
scheme, would have passed the committed gate silently. The script's own header calls
this leg a PERMANENT tripwire; for those four tokens it was not one.

### How it was fixed

`PART8_RE` now carries the same tokens the phase was actually certified with.

One deliberate judgment call, documented in the script rather than silently applied:
`brain` stays CASE-SENSITIVE and lowercase, exactly as the SUMMARY greps ran it (`grep
-nE "...|brain"` is case-sensitive, so the manual check was lowercase-only too). This
catches the code shapes (require, identifiers, hostnames, env keys) while letting prose
like "no Brain" in `lib/core/rs_corpus_exclude.py`'s module docstring through. Docstring
bodies are not comment lines, so `strip_comments` cannot remove them, and a gate that
hard-fails on correct committed code is a gate the next person disables. Verified: the
strengthened pattern produces zero hits across all nine `PART8_TARGETS`.

Beyond the literal finding, the leg now proves itself before it is trusted. A grep gate
that quietly stopped matching is indistinguishable from a clean codebase, which is the
same false-success shape the whole phase exists to close. A NEGATIVE SELF-TEST runs
ahead of the sweep over a synthetic file.

### Verification

`bash tests/run-all-233.sh` -> new leg `>>> Part 8 self-test: PASSED`, all 12 probes
behaving as specified:

```
    caught: fetch(
    caught: https:// literal
    caught: node:https require
    caught: curl
    caught: wget
    caught: axios (no URL literal)
    caught: onrender host (no scheme)
    caught: api.anthropic (no scheme)
    caught: brain identifier
    correctly ignored: the written-reason allow-list line
    correctly ignored: a comment line naming egress
    correctly ignored: ordinary local code
```

The three `must_not_catch` probes are what keep the strengthened pattern honest: the
`index.fetch(ids=artifact_ids)` written-reason allow-list still works, comment prose
still cannot trip the gate, and ordinary local code is untouched.
`>>> Part 8 sweep: PASSED` over the real nine targets.

---

## Notes for the orchestrator

- **Not committed by me, as instructed:** this REVIEW-FIX.md.
- **Pre-existing repo hygiene, untouched:** `scripts/__pycache__/compute-hsi.cpython-312.pyc`
  is a TRACKED python bytecode artifact that shows as modified after any run that
  imports `compute-hsi.py`. It was already dirty from the baseline gate run before any
  fix was applied. Not committed, not fixed here, but it will keep re-dirtying the tree
  and probably wants a `.gitignore` entry plus a `git rm --cached` in a separate task.
- **Still open from 233-REVIEW.md:** IF-01 (register
  `tests/test-233-graph-heal-pipeline.cjs` in `lib/memory/run-feynman-tests.cjs`) and
  IF-02 (`graph-backfill.cjs` `CASCADE_FAMILY` duplicating `graph-derivation.cjs`
  `CASCADE_SUBSET`). Both deliberately out of scope for a `critical_warning` pass.
  Worth noting that IF-01 now applies to the new
  `tests/test-233-hsi-uri-path-encoding.sh` too only in spirit: `.sh` suites are not
  members of that `.cjs` TESTS array, and it auto-discovers through the phase harness
  glob, so no registration gap was created by this pass.
