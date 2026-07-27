---
status: issues_found
phase: 233
files_reviewed: 21
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
---

# Phase 233 Code Review: graph-derive drain residual (SEED-037 heal already-damaged rooms)

Reviewed all 21 listed source files at standard depth, cross-referenced against the
phase's own RCA (`.planning/debug/graph-derive-silent-clear-dead-api-derivation.md`)
and the three plan SUMMARY.md files, with specific attention to the phase's stated
theme: closing "confident success reported over an empty/wrong result" defects. Two
of the findings below (CR-01, WR-01) are exactly that failure shape recurring inside
the code written to eliminate it. The others are adjacent robustness/consistency gaps
surfaced while tracing the same class of bug through the new pipeline.

Diff base note: the `diff_base` in the review config resolves to a squashed-history
commit where most listed files show as wholly new. The actual phase-233 diffs were
reconstructed from the real commit chain (`3b3d49e3` through `93bfcf62`, all tagged
`233-01`/`233-02`/`233-03` in `git log`), and each finding below is scoped to code
this phase actually wrote or modified, not pre-existing code the phase only touched
in passing.

### CR-01

**File:** `lib/core/doctor/graph-derive-health-module.cjs:360-379` (function `check`)

**Description:** The class-level `detail` string can directly contradict the
class-level `status` field it is returned alongside, for a specific and realistic
room state.

`detectRoomHealth`'s per-room status is `'warn'` in two disjoint cases: a stuck queue
entry (`queueStuckCount > 0`) OR a recorded failure log (`failureLogCount > 0`) with
`needsHeal` false (line 255-259 of the same file). But `check()`'s aggregate
`needing` count only looks at `needsHeal` and `queueStuckCount`:

```js
const needing = out.filter((r) => r.needsHeal || (r.queueStuckCount || 0) > 0).length;
...
} else if (needing === 0) {
    detail = out.length + ' room(s) checked; every one has run its semantic derive';
```

A room that failed its derive a few times, then eventually succeeded (cascade edges
now present, `needsHeal` false, queue entry cleared on success so `queueStuckCount`
is 0), but whose `graph-derive-failures.json` still carries the old failure
records (the log is never rotated or cleared once the room recovers), reports
per-room `status: 'warn'`. Since `worstStatus` ranks warn above ok, the CLASS status
returned by `check()` is also `'warn'`. Yet because this room is excluded from
`needing`, the `detail` string simultaneously claims "every one has run its semantic
derive" -- a plain-language success claim next to a `status: 'warn'` field. A caller
reading only `detail` (exactly what the Tri-Polar Desktop/Cowork nudge in
`preflight-doctor.cjs` does for the fail/warn branch, and what a human reading the
CLI row would read) sees a contradiction: the room this same report is warning about
is described in the summary line as fully healthy.

This is a real, deterministic recurrence of the exact bug class this phase exists to
close: a self-contradictory success claim printed by the diagnostic meant to prevent
exactly that. It is not a rare edge case -- a room recovering after a few retries is
the NORMAL, desired outcome of the keep-on-failure retry design Phase 224-02 shipped.

Note: the `--heal-room` fix() behavior of NOT re-enqueuing this room is actually
correct (it already has cascade edges; nothing to re-derive). The bug is confined to
the `detail` string / status pairing being self-contradictory, not to a missed repair
action.

**Fix suggestion:** Compute `needing` from the room status vocabulary directly rather
than re-deriving a narrower predicate:

```js
const needing = out.filter((r) => r.status === 'warn' || r.status === 'fail').length;
```

or, if the intent really is "only rooms that would benefit from a re-enqueue", keep
`needing` as-is for the re-enqueue action but stop reusing it to gate the "every one
has run its semantic derive" success sentence -- gate that sentence on
`perRoomWorst === 'ok'` instead, so the detail text can never claim universal health
while the status field says otherwise.

### WR-01

**File:** `lib/core/doctor/graph-derive-heal-retrofit-module.cjs:112-124` (function `check`)

**Description:** `check()` unconditionally returns `status: 'ok'`, even when every
room in the registry failed to heal (`healed === 0`, `errors === scanned`). Because
this module never throws (every per-room failure is caught internally and folded
into `errors`), `runAccumulativeEngine`'s `anyHardError` gate (`scripts/doctor.cjs`
around line 2166-2169) is never tripped by this module, so the watermark
unconditionally advances past `introduced_version` (`1.15.3-beta.49`) after this ONE
invocation, per `writeDoctorApplied` at line 2178 gated only on `!anyHardError`. Since
this is a `cadence: 'once'` module, once the watermark passes its `introduced_version`
it never runs again on this install (verified against the engine's window-selection
logic at lines 2113-2134: the window is `(applied_through, running]` and
`applied_through` only moves forward).

The header comment justifying this ("a room it could not reach is reported in the
detail rather than escalated ... the next run retries it") is therefore inaccurate:
"the next run" will NOT retry this room through this module, because this specific
one-shot retrofit pass is the only opportunity it ever gets. A systemic failure during
that one window (e.g. the sweep enqueue throwing for every room due to a filesystem
permission issue, a transient `MINDRIAN_ROOMS_HOME` misconfiguration, or a bug in
`gsd-graph-derive-sweep.cjs`) would silently strand some or all of the ~16 originally
damaged rooms with no further automatic repair attempt, while the module's own status
claims `'ok'`.

Impact is bounded (not silent forever): `graph-derive-health` (the sibling
`cadence: 'always'` class) keeps re-detecting these rooms as `fail`/`warn` on every
subsequent `doctor --graph-derive-health` run and every SessionStart nudge (since
`preflight-doctor.cjs` always passes `--graph-derive-health`), so a user is not left
completely unaware -- but the intended "user should not have to know their graph was
damaged in order to get it repaired" promise (the module's own header) silently fails
to hold if the one-shot pass hits a systemic error, and the CLI/JSON output would
report the retrofit as a clean 'ok' pass regardless.

**Fix suggestion:** Return `status: 'warn'` (not `'ok'`) when `errors > 0`, at least
when `healed === 0 && errors > 0` (total failure). Also correct the "retried next
run" claim in the comment and in the `detail` string to describe what actually
happens (the room stays flagged by `graph-derive-health`; the operator must run
`--heal-room` manually), rather than implying the retrofit itself will retry.

### WR-02

**File:** `scripts/graph-heal-pipeline.cjs:160-201` (stages 1 and 2)

**Description:** Stage 2 (scoped HSI) runs unconditionally regardless of whether
stage 1 (structural-index) actually succeeded. There is no `if (structuralOk) { ... }`
gate before the `compute-hsi.py --scope-to-nodes` spawn. If stage 1 throws (caught,
`ok: false`, `structuralOk = false`), stage 2 still runs against whatever `room.db`
state exists (which could legitimately have zero `Artifact` nodes, e.g. a
freshly-created empty db, or a db left in a pre-rebuild state).

In that situation, `compute-hsi.py`'s `--scope-to-nodes` (new in this phase,
`scripts/compute-hsi.py:203-253`) calls `load_graph_artifact_ids()`, which returns an
EMPTY SET (not `None`) when the `nodes` table exists but has zero `Artifact` rows --
this is a successful query, not an error, so it does not hit the permissive-degrade
path the function's own docstring describes ("degrades to scoring everything ... when
the db is missing, unreadable, or has no `nodes` table yet"). The caller in `main()`
(`compute-hsi.py:775-784`) then filters `artifacts` down to nothing, and the `< 2`
guard (`compute-hsi.py:786-803`) writes an EMPTY `.hsi-results.json` and exits 0.

Back in `graph-heal-pipeline.cjs`, `_spawnStage` treats a zero exit code as
`{ ok: true, ... }` (lines 116-121), and the stage-2 branch only sets `hsiSkipped` on
a NON-zero exit (lines 195-197). So this specific sequence -- stage 1 fails, stage 2
silently scores zero artifacts -- reports `{ name: 'hsi-score', ok: true }` with no
structured flag distinguishing "scored real pairs" from "scored nothing because the
node set was empty". The only signal is a prose tail line in `detail` (something like
"0 artifacts found (minimum 2 required), wrote empty results"), which a human reading
the log would likely catch, but which a machine consumer checking `.ok` /
`.hsiSkipped` would miss entirely. This is the same false-success shape the phase's
own "Defect The Live Run Found" section describes for stage 4, just one stage earlier
and currently untested (the test suite's stage-1-failure path is not covered; see
`tests/test-233-graph-heal-pipeline.cjs`, which only exercises the happy path,
idempotence, `skipHsi`, and a nonexistent-room case with `skipHsi: true`).

**Fix suggestion:** Either (a) skip stages 2 and 3 when `structuralOk` is false (mirroring
how stage 4's `skipRebuild` is already conditioned on `structuralOk`), or (b) have
`compute-hsi.py` emit a structured `"scoped_to_zero_nodes": true` field in
`.hsi-results.json`'s metadata (or a distinct stderr-parseable marker) when
`--scope-to-nodes` intersects to an empty set, and have `graph-heal-pipeline.cjs`
surface that as `stages[].skipped` rather than folding it into a plain `ok: true`.

### WR-03

**File:** `scripts/compute-hsi.py:235` (function `load_graph_artifact_ids`)

**Description:** The new `--scope-to-nodes` read-only sqlite open builds its URI by
plain `%` string formatting:

```python
conn = sqlite3.connect('file:%s?mode=ro' % db_path, uri=True)
```

`db_path` is not percent-encoded before insertion. If a room directory path contains
a `?`, `#`, or `%` character, SQLite's URI parser would misinterpret part of the path
as the query string (or fragment), and the `mode=ro` parameter that follows could be
swallowed into that misparsed query rather than recognized as the read-only mode
flag. This is the exact bug class `lib/core/graph-derivation.cjs`'s own
`_fileUriPath()` helper (lines 384-386) was written to close for the sub-room rollup
ATTACH, with an explicit comment: "SQLite's URI parser treats ? as the query
separator, # as the fragment start, and % as the escape byte ... a room path
containing any of them ... silently broke the open/ATTACH." The same codebase
awareness was not applied to this new Python call site.

Practical exploitability is limited here because this function only ever executes a
single hardcoded `SELECT`, so even a degraded/failed read-only enforcement would not
by itself cause a write. But the test suite's own threat register makes an explicit
claim this code does not fully back: "`--scope-to-nodes` opens `room.db` via
`sqlite3.connect('file:<path>?mode=ro', uri=True)`. Read-only is enforced at the
SQLite layer, so a write attempt fails mechanically, not by convention" (233-03
SUMMARY.md, Threat Model Compliance, T-233-09). For a room path containing `?`, `#`,
or `%`, that mechanical guarantee can break down, and the more likely practical
failure mode is `load_graph_artifact_ids` erroring out (caught, degrades to score-
everything, benign) or an unpredictable malformed-URI outcome rather than a clean
read-only open.

**Fix suggestion:** Percent-encode `db_path` before interpolating into the URI, e.g.:

```python
import urllib.parse
uri = 'file:%s?mode=ro' % urllib.parse.quote(str(db_path))
conn = sqlite3.connect(uri, uri=True)
```

(Python's `urllib.parse.quote` with default `safe='/'` handles this correctly for
POSIX paths; verify behavior on Windows drive letters/backslashes if that platform is
in scope.)

### WR-04

**File:** `tests/run-all-233.sh:120` (`PART8_RE`)

**Description:** The phase's permanent Part 8 egress sweep uses:

```bash
PART8_RE="fetch\(|https?://|require\(['\"]node:https?|\b(curl|wget)\b"
```

This is narrower than the ad-hoc verification commands the phase's own SUMMARY.md
files report having actually run: 233-01's SUMMARY cites
`grep -nE "https?://|fetch\(|axios|onrender|api\.anthropic|brain"`, and 233-02's cites
`grep -nE "https?://|fetch\(|axios|onrender|brain"`. Both of those manual checks
include `axios`, `onrender`, `api\.anthropic`, and `brain` as separate tokens; the
committed, permanent gate in `run-all-233.sh` includes none of them. A bare
`require('axios')` (no literal URL) in any of the nine `PART8_TARGETS` files would
pass the committed gate silently, as would a bare string reference to
`onrender`/`brain`/`anthropic` that doesn't happen to be preceded by `http://` or
`https://` in the exact same token run.

The script's own header describes this leg as "the PERMANENT Part 8 tripwire (the
run-all-158.sh / run-all-224.sh grep-gate idiom)" -- i.e. a gate meant to catch any
future regression on these exact surfaces without relying on someone remembering to
re-run the fuller ad-hoc grep by hand. As committed, it is weaker than the check that
was actually used to certify the phase, which undercuts that "permanent tripwire"
claim for the specific tokens it omits.

**Fix suggestion:** Align `PART8_RE` with the fuller pattern actually used to verify
the phase (`axios|onrender|api\.anthropic|brain`, in addition to the existing
`fetch\(|https?://|require\(['\"]node:https?|\b(curl|wget)\b`), so the committed gate
matches the claim made about it.

### IF-01

**Files:** `lib/memory/run-feynman-tests.cjs`, `tests/test-233-graph-heal-pipeline.cjs`

**Description:** `tests/test-233-graph-heal-pipeline.cjs` (created by 233-03) is not
registered in `lib/memory/run-feynman-tests.cjs`'s `TESTS` array, unlike its sibling
`.cjs` suites from 233-01 (`test-233-graph-derive-health.cjs`,
`test-233-graph-derive-heal-retrofit.cjs`) and 233-02
(`test-233-derivation-default-gate.cjs`, `test-233-drain-backfill-producer-parity.cjs`),
which ARE all registered with descriptive comments. 233-01's own SUMMARY.md logged
exactly this gap as a "Missing Critical" deviation for its own suites ("an
unregistered suite is orphaned from the repo's own gate discipline and stops running
the moment nobody types its filename"), and established the fix. 233-03 did not carry
that same fix forward for its own new `.cjs` suite.

Impact is bounded: `tests/run-all-233.sh` glob-discovers `tests/test-233-*.cjs` (and
`.sh`) directly, so the suite is not literally orphaned -- it runs as part of the
phase gate. It is only missing from the separate, repo-wide Feynman regression
runner that other phase suites are registered in.

**Fix suggestion:** Add `tests/test-233-graph-heal-pipeline.cjs` to
`lib/memory/run-feynman-tests.cjs`'s `TESTS` array alongside its 233-01/233-02
siblings, following the same comment convention already used for the other four
233 entries.

### IF-02

**Files:** `lib/core/graph-backfill.cjs:171-173` (`CASCADE_FAMILY`),
`lib/core/graph-derivation.cjs:69-71` (`CASCADE_SUBSET`)

**Description:** `graph-backfill.cjs` (modified by 233-03 to add `skipRebuild`) keeps
its own hand-typed `CASCADE_FAMILY` array (`['CONTRADICTS', 'CONVERGES', 'INFORMS',
'INVALIDATES', 'ENABLES', 'REFINES', 'ROOT_CAUSES']`) for counting typed edges,
duplicating `graph-derivation.cjs`'s exported `CASCADE_SUBSET` (the same seven values,
as a frozen `Set`) rather than importing it. Both lists currently agree, so there is
no live bug today. But this is exactly the "shorter hand-typed list drift" pattern
this same phase's `graph-derive-health-module.cjs` explicitly calls out and avoids in
its own header comment: "The frozen 7-item cascade edge_type set, read from the
COMPOSER itself so this file can never drift into a shorter hand-typed list." A future
edit to `CASCADE_SUBSET` (e.g. adding an eighth cascade type) would silently leave
`graph-backfill.cjs`'s before/after edge counts (`typedEdgesBefore`/`typedEdgesAfter`,
which the heal pipeline's stage-4 detail line reports) undercounting, without any test
catching the divergence, since no test asserts the two arrays stay equal. Pre-existing
from Phase 169-05, not introduced by 233, but adjacent to code this phase modified and
worth a note given the phase's own stated discipline elsewhere.

**Fix suggestion:** Have `graph-backfill.cjs` import `CASCADE_SUBSET` from
`graph-derivation.cjs` (already a direct dependency of this file) instead of
maintaining a separate `CASCADE_FAMILY` literal.
