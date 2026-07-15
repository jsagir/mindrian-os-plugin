---
phase: 225-per-session-room-binding-and-multi-session-reconciliation-se
reviewed: 2026-07-15T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - docs/ENV-TUNING.md
  - lib/memory/run-feynman-tests.cjs
  - scripts/doctor.cjs
  - scripts/intent-classifier.cjs
  - tests/run-all-225.sh
  - tests/test-225-gate-degrade.cjs
  - tests/test-225-wal-advisory.cjs
  - tests/test-225-zero-score-gate.cjs
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 225: Code Review Report

**Reviewed:** 2026-07-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 225 ships two disjoint changes: (1) a zero-score no-match F.8 gate in
`scripts/intent-classifier.cjs` that closes the line-509 silent-misfile gap, and
(2) a never-block WAL-reset corruption advisory in `scripts/doctor.cjs`.

The three specific adversarial pitfalls named in the review brief were checked
directly against the code and against a live run of all three `tests/test-225-*.cjs`
files plus `tests/run-all-225.sh` (all green, 4/4 passed, 0 failed, 0 skipped,
including the unconditional Phase-194 regression leg):

- **The zero-score gate never reuses the arbitrary `corpus[0]` `best.name`.**
  Confirmed correct. `emitNoMatchGate` (scripts/intent-classifier.cjs:2334-2463)
  only ever offers `continue in <primary>` / `start a new project` / `dev repo / no
  room`, all derived from `binding.primary` or the reserved `__no_room__` sentinel,
  never from `best`. `test-225-zero-score-gate.cjs` leg 1 explicitly asserts stdout
  excludes `copper-ledger` (the corpus[0] room), which would fail on a leak.
- **The anti-overfire floor is present and does bound the gate**, but it is a
  weaker guarantee than documented in two independent ways (WR-02, WR-01 below).
- **The gate fails open on corrupt/missing state.** Confirmed correct via code
  reading (`readSessionBinding` -> `safeDefault()`, `zeroScoreGateAlreadyOffered`
  -> `false` on any read/parse fault, the whole zero-score block wrapped in a
  single try/catch that always terminates in the byte-identical legacy `return
  0`) and via a live run of `tests/test-225-gate-degrade.cjs` (poisoned binding
  JSON + corrupt trace JSON, both exit 0, no thrown stack).
- **`_sqliteVersionLt` does a real numeric-segment comparison, not a
  lexicographic one.** Confirmed correct by code reading and by executing
  `tests/test-225-wal-advisory.cjs`, whose leg 2 specifically drives
  `'3.51.10'` (which sorts before `'3.51.3'` as a string but must NOT fire) and
  passes.
- **The WAL advisory is genuinely never-block.** Confirmed: `_walResetAdvisory`
  only ever pushes onto `report.findings`; `report.healthy` and the unconditional
  `process.exit(0)` in the `--bind-check` block are untouched regardless of what
  the advisory finds (scripts/doctor.cjs:2673-2686, 2700).

However, one genuine, reproduced BLOCKER was found in the F.8 answer-consumption
path the new zero-score gate reuses (session binding can be silently narrowed and
un-stickied, causing a subsequent legitimate write to get hard-blocked), plus
three WARNING-level robustness/coverage gaps and two INFO items. These are not
speculative: the BLOCKER and the trace-rotation WARNING were both reproduced with
standalone scripts against the actual shipped code (see each finding for the
exact repro).

## Critical Issues

### CR-01: The zero-score gate's "continue in primary" answer silently drops other bound rooms from write scope and clears `sticky`

**File:** `scripts/intent-classifier.cjs:2334-2463` (emitNoMatchGate) and
`scripts/intent-classifier.cjs:2465-2577` (consumePriorBindingAnswer), consuming
`lib/workflow/session-binding-consumer.cjs:113-148` (consumeSessionBinding)

**Issue:** `emitNoMatchGate` offers exactly three options: `continue in
<primary>`, `start a new project`, `dev repo / no room` (lines 2360-2364). This
is correct in isolation (REQ-2: never a scored room). The bug is in what happens
when the user answers it: `consumePriorBindingAnswer` (line 2465) routes the
confirmed picks to `consumeSessionBinding`, which **replaces** the entire session
`bound` array with just the confirmed picks (`session-binding-consumer.cjs:144-148`,
`sb.writeSessionBinding(sessionId, { bound: picks, primary: primaryPick, sticky:
sticky }, ...)` — a full overwrite, not a union with the prior bound set).

Because `emitNoMatchGate`'s option set never includes any room in the session's
existing `bound` array other than `primary`, answering the pre-checked default
(`continue in <primary>`) collapses a multi-room session binding down to
`[primary]` and resets `sticky` to `false` (the zero-score gate's answer payload
never sets `sticky`, so `consumePriorBindingAnswer`'s `answer.sticky === true`
default is always false for this gate).

This is exploitable through completely ordinary use: a session multi-bound via
`emitBindingGate` (e.g., `bound: ['room-a', 'room-b']`, `sticky: true`) that later
receives one substantive off-topic message (the zero-score gate fires because the
message doesn't fingerprint-match either room) will have its binding silently
narrowed to `['room-a']` the moment the user answers "continue in room-a" — the
single most natural, pre-checked response. `room-b` then becomes unwritable:
`scripts/write-scope-check.cjs:378-392` performs a HARD BLOCK (not an advisory)
on any write to a room outside the session's bound set once the session is
bound. The user gets a "Blocked: write to room-b denied... this session is bound
to [room-a]" error on a room they never intended to unbind from, with no warning
that answering the gate would do this.

**Reproduced** with a standalone script driving the real `session-binding.cjs` +
`intent-classifier.cjs` (`consumePriorBindingAnswer`) against a fixture
replicating the on-disk shape `emitNoMatchGate` persists:

```
BEFORE: { bound: [ 'room-a', 'room-b' ], primary: 'room-a', sticky: true }
consumePriorBindingAnswer result: { ok: true, degraded: false,
  bound: [ 'room-a' ], primary: 'room-a', sticky: false, newlyBound: [] }
AFTER:  { bound: [ 'room-a' ], primary: 'room-a', sticky: false }
```

**Fix:** `emitNoMatchGate`'s answer path must preserve the rest of the prior
bound set. Either (a) have `consumePriorBindingAnswer` (or a dedicated
zero-score-gate consumer) union `picks` with the prior `binding.bound` array
before calling `consumeSessionBinding` when the trace entry's `kind` is
`zero_score_gate` (so "continue in primary" only ever *adds/confirms* primary,
never *drops* siblings), or (b) have `consumeSessionBinding` accept an
`additive: true` flag for this call site instead of a full-replace write:

```js
// consumePriorBindingAnswer, before calling consumeSessionBinding:
if (gateKind === 'zero_score_gate') {
  const prior = sb.readSessionBinding(sessionId, { home }).bound || [];
  for (const s of prior) { if (slugs.indexOf(s) === -1) slugs.push(s); }
}
```
Also preserve `sticky` from the prior binding when the zero-score gate's answer
doesn't explicitly set it, rather than defaulting to `false`.

## Warnings

### WR-01: PD-1 "once-per-session-per-room" suppression can be silently evicted by pre-existing decision-trace rotation

**File:** `scripts/intent-classifier.cjs:2303-2323` (zeroScoreGateAlreadyOffered)
and `scripts/intent-classifier.cjs:875-929` (persistDecisionTrace rotation),
consumed on essentially every turn via `scripts/intent-classifier.cjs:2904`
(the always-on Phase-91 navigation-engine block)

**Issue:** `zeroScoreGateAlreadyOffered` suppresses a second gate fire by scanning
the session's decision-trace file for a prior `kind === 'zero_score_gate'` entry.
That file is shared with the Phase-91 navigation-engine block, which appends a
new trace entry on essentially every substantive turn (line 2904), and rotates
at `TRACE_ROTATE_AT = 50` by dropping the **oldest 10** entries per rotation
(`data.traces = data.traces.slice(10);`, line 896-898). A `zero_score_gate`
marker therefore has a bounded lifetime, not a session lifetime: once enough
subsequent turns have been recorded, the marker rotates out of the file and
`zeroScoreGateAlreadyOffered` returns `false` again, so the gate can re-fire in
the same session/room.

Reproduced directly against the real rotation logic: a marker added first is
evicted after **exactly 50** further trace-writing turns:
```
immediately after add, present = true
evicted after 50 further trace-writing turns; still present = false
```
50 turns is well within a normal working session, so this contradicts the
guarantee stated in `docs/ENV-TUNING.md` ("Paired with PD-1's
once-per-session-per-room trace suppression so the gate fires at most once per
room per session even under sticky") and in the code comment at line 2303
("once-per-session-per-room suppression").

**Fix:** Give the zero-score-gate suppression marker its own small, un-rotated
side-channel file (mirroring the pattern `card-fire-sidechannel.cjs` already
uses elsewhere), or exempt `kind === 'zero_score_gate'` entries from the
generic 50-entry rotation so a long session cannot silently re-arm the gate.

### WR-02: The anti-overfire token floor counts raw (duplicate-inclusive) tokens, not distinct tokens

**File:** `scripts/intent-classifier.cjs:501` (`messageTokens = tokenize(message)`)
and `scripts/intent-classifier.cjs:536` (`if (messageTokens.length >=
ZERO_SCORE_GATE_MIN_TOKENS)`)

**Issue:** `MINDRIAN_ZERO_SCORE_GATE_MIN_TOKENS` (default 8) is measured against
`messageTokens.length`, the raw tokenized array with duplicates preserved — not
`messageTokenSet.size` (the deduped Set already built one line later, at line
503, and used for all the actual scoring). A trivial, repetitive message such as
`"ok ok ok ok ok ok ok ok"` (8 raw tokens, 1 distinct token) clears the floor and
can fire the interruptive F.8 gate, directly contradicting the stated design
intent in `docs/ENV-TUNING.md` / the PD-3 code comment: "A trivial
acknowledgement... must NOT fire the gate."

**Fix:** Measure the floor against the deduped set size:
```js
const messageTokenSet = new Set(messageTokens); // already built at line 503
// ... in the zero-score branch:
if (messageTokenSet.size >= ZERO_SCORE_GATE_MIN_TOKENS) { ... }
```
(Move the `messageTokenSet` construction above the zero-score branch, or thread
its size through.)

### WR-03: No test exercises the answer/consumer side of the zero-score gate

**File:** `tests/test-225-zero-score-gate.cjs`

**Issue:** All five legs of `test-225-zero-score-gate.cjs` exercise the
*producer* side only (does the gate render, does it stay silent, does the
persisted trace's `labelToSlug` map correctly). None of them simulate a second
turn where the user actually *answers* the gate and asserts the resulting
session-binding file. This is precisely the gap that let CR-01 ship: the "trace
proof" check (leg after leg 1) only asserts the *offered* payload shape, never
what happens when it is *consumed*. The `PD-5` claim in the code comments
("Composition clones emitBindingGate step-for-step... The consumer is reused
with ZERO changes") is asserted but not verified by any test in this phase.

**Fix:** Add a leg to `tests/test-225-zero-score-gate.cjs` (or a new
`tests/test-225-answer-narrowing.cjs`) that: binds a session to two rooms via
`writeSessionBinding`, spawns the classifier to fire the zero-score gate, then
spawns it again with the "continue in `<primary>`" answer, and asserts the
resulting `readSessionBinding(...).bound` still contains the previously-bound
sibling room. This would have caught CR-01 before merge.

## Info

### IN-01: Dead defensive branch `!best` in the zero-score gate

**File:** `scripts/intent-classifier.cjs:532`

**Issue:** `if (!best || best.score === 0) {` — by this point in `main()`,
`corpus.length === 0` (line 499) and `messageTokens.length === 0` (line 502)
have already returned early, so the scoring loop at lines 508-519 is guaranteed
to execute at least once, meaning `best` can never be `null`/`undefined` when
this line runs. The `!best` half of the condition is unreachable and slightly
misleading (it implies a code path that cannot occur).

**Fix:** Either simplify to `if (best.score === 0) {` or add a one-line comment
noting the `!best` half is defense-in-depth only, not a reachable path.

### IN-02: `doctor.cjs --help` does not document the new WAL-reset advisory now riding `--bind-check`

**File:** `scripts/doctor.cjs:381-390` (usageText, `--bind-check` block)

**Issue:** The `--bind-check` usage block describes the room-dir/`.room-root`/
`room.db` structural check and the never-block presence-registration contract,
but says nothing about the new `_walResetAdvisory` WARN row that can now appear
in `--bind-check` output when the bundled SQLite is `< 3.51.3` and a co-session
is present (scripts/doctor.cjs:2673-2686). A user running `doctor --help` has no
way to learn what that WARN line means or where it comes from.

**Fix:** Add a line to the `--bind-check` usage block, e.g.:
```
                           Also appends a WATCH-only WARN row when the bundled
                           SQLite is inside the upstream WAL-reset corruption
                           window (< 3.51.3) AND a live co-session is present
                           (Phase 218 finding, commit 298a1c84); never affects
                           report.healthy or the exit code.
```

---

_Reviewed: 2026-07-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
