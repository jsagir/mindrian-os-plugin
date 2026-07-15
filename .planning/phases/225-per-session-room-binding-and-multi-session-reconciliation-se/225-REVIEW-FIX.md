---
phase: 225-per-session-room-binding-and-multi-session-reconciliation-se
fixed_at: 2026-07-15T11:43:25Z
fix_scope: all
findings_in_scope: 6
fixed: 6
skipped: 0
iteration: 1
status: all_fixed
---

# Phase 225: Code Review Fix Report

**Fixed at:** 2026-07-15T11:43:25Z
**Source review:** .planning/phases/225-per-session-room-binding-and-multi-session-reconciliation-se/225-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 critical, 3 warning, 2 info)
- Fixed: 6
- Skipped: 0

All fixes were applied in an isolated git worktree (branch `gsd-reviewfix/225-44956`,
based off `7c522587`), one commit per finding, then merged into `main`. A plain
`--ff-only` merge was not possible: `main` had advanced by 2 unrelated docs-only
commits (Phase 224 completion, landed by a concurrently running session) from the
same base while this run was in progress. Verified conflict-free beforehand via
`git merge-tree` (zero file overlap: Phase 224 touched only `.planning/STATE.md`
and its own `224-VERIFICATION.md`; this run touched only `scripts/`, `docs/`,
`tests/`), then merged with a plain non-destructive `git merge --no-ff` (merge
commit `f561222e`). Final `bash tests/run-all-225.sh` was re-run against `main`
post-merge and confirmed green.

## Fixed Issues

### CR-01: The zero-score gate's "continue in primary" answer silently drops other bound rooms from write scope and clears `sticky`

**Root cause:** `emitNoMatchGate`'s answer path (`consumePriorBindingAnswer`)
routes the confirmed pick through `consumeSessionBinding`, whose sink write is a
full REPLACE of the session's `bound` array (`session-binding-consumer.cjs:144-148`),
not a union. That is safe for the pre-existing (Phase 194) `binding_gate`: its
option set is the FULL scored corpus, so every already-bound room is a visible,
re-toggleable option and the navigator controls what survives. The new
`zero_score_gate` (Phase 225) never offers that visibility — it renders exactly
three fixed labels (continue-in-primary / new-project / no-room) and never lists
sibling bound rooms at all. So the single most natural answer, "continue in
&lt;primary&gt;", was silently replacing a multi-room `bound` set (e.g.
`['room-a','room-b']`) with just `[primary]` and resetting `sticky` to `false`
(the gate's own answer payload never carries a sticky field to preserve).
`room-b` then became unwritable — `write-scope-check.cjs` hard-blocks any write
outside the session's bound set once bound, with no warning the gate answer
would do this. Confirmed the bug reproduces exactly as the review described
before applying the fix.

**Applied fix:** `consumePriorBindingAnswer` (scripts/intent-classifier.cjs) now
also captures the trace entry's `kind` while scanning for the gate payload. When
`kind === 'zero_score_gate'`, it reads the prior session binding and unions the
confirmed picks with the prior `bound` array before the sink's replace-write (so
answering this gate can only add/confirm rooms, never drop one), and preserves
the prior `sticky` value when the answer carries no explicit `sticky` field
(structurally always the case for this gate, whose card has no sticky toggle).
The pre-existing `binding_gate` path is untouched (out of scope — the reviewer
confirmed it does not share this bug, since its option set already gives the
user visibility/control over every bound room).

Also satisfies **WR-03** (no test exercised the answer-consumption side of the
gate): added `tests/test-225-answer-narrowing.cjs`, which constructs a session
bound to two rooms with `sticky: true`, fires the zero-score gate, answers the
pre-checked default on a second classifier turn, and asserts both rooms plus
`sticky` survive. Confirmed this test fails without the fix (`bound` collapses
to `[primary]`, `sticky` becomes `false`) and passes with it.

**Files modified:** `scripts/intent-classifier.cjs`, `tests/test-225-answer-narrowing.cjs` (new), `tests/run-all-225.sh`
**Commit:** `aef4256e`
**Test verification:** `node tests/test-225-answer-narrowing.cjs` (4/4 checks); full `bash tests/run-all-225.sh` (5/5 legs, includes the unconditional Phase-194 regression guard) — green.

### WR-01: PD-1 "once-per-session-per-room" suppression can be silently evicted by decision-trace rotation

**Root cause:** `zeroScoreGateAlreadyOffered` suppressed a second gate fire by
scanning the SHARED decision-trace file for a prior `zero_score_gate` entry.
That file also receives a new entry from the always-on Phase-91 navigation-engine
block on essentially every substantive turn (`persistDecisionTrace`,
`TRACE_ROTATE_AT = 50`, drop-oldest-10 per rotation). Reproduced directly: a
marker added first is evicted after exactly 50 further trace-writing turns —
well within a normal working session — silently re-arming the gate mid-session,
contradicting the "fires at most once per room per session" claim in both
`docs/ENV-TUNING.md` and the code comment.

**Scope decision:** the shared 50-entry decision-trace rotation itself is used
by many other consumers across the codebase; retrofitting its rotation policy
was judged out of scope for this warning-severity item. Instead, moved the PD-1
signal to a mechanism immune to that rotation by construction — a right-sized,
fully-effective fix rather than a documented-limitation shrug.

**Applied fix:** added a dedicated, never-rotated marker file
(`zeroScoreGateMarkerPath`: `sessionId + '.zero-score-gate-offered.json'`) that
this suppression check owns exclusively. `zeroScoreGateAlreadyOffered` now reads
this marker instead of scanning the trace; `emitNoMatchGate` stamps it via the
new `markZeroScoreGateOffered` alongside its existing (unchanged) decision-trace
write. Uses the same atomic tmp+rename write idiom already used by
`persistDecisionTrace` / `writeSessionBinding` elsewhere in this file.

Added a regression leg to `tests/test-225-zero-score-gate.cjs` (leg 4b) that
simulates post-rotation state directly (strips the `zero_score_gate` entry out
of the trace file — exactly what real rotation eventually does) and asserts the
gate stays silent. Confirmed this leg fails without the fix (re-arms after
simulated rotation) and passes with it.

**Files modified:** `scripts/intent-classifier.cjs`, `tests/test-225-zero-score-gate.cjs`
**Commit:** `076deeb9`
**Test verification:** `node tests/test-225-zero-score-gate.cjs` (7/7 checks including the new leg 4b); full suite green.

### WR-02: The anti-overfire token floor counts raw (duplicate-inclusive) tokens, not distinct tokens

**Root cause:** `MINDRIAN_ZERO_SCORE_GATE_MIN_TOKENS` (default 8) was checked
against `messageTokens.length` (the raw tokenize() output with duplicates
preserved), not `messageTokenSet.size` (the deduped Set already built one line
above for the scoring loop). The floor's documented intent is a substantiality
check, but counting raw tokens let a trivial, repetitive message
("ok ok ok ok ok ok ok ok" — 8 raw tokens, 1 distinct) clear the floor and fire
the interruptive gate, directly contradicting the stated PD-3 design intent.

**Applied fix:** measure the floor against `messageTokenSet.size` instead of
`messageTokens.length`; no new computation needed since the Set already exists.
Also corrected `docs/ENV-TUNING.md`'s `MINDRIAN_ZERO_SCORE_GATE_MIN_TOKENS`
description to say "distinct" tokens explicitly, with the repetitive-message
example as the concrete case.

Added a regression leg to `tests/test-225-zero-score-gate.cjs` (leg 3b) using a
FRESH session id (so the WR-01 marker cannot mask the result) that sends the
repetitive trivial message against a bound primary and asserts the gate stays
silent. Confirmed this leg fails without the fix (gate fires on the raw-count
floor) and passes with it.

**Files modified:** `scripts/intent-classifier.cjs`, `tests/test-225-zero-score-gate.cjs`, `docs/ENV-TUNING.md`
**Commit:** `88c76782`
**Test verification:** `node tests/test-225-zero-score-gate.cjs` (8/8 checks including the new leg 3b); full suite green.

### WR-03: No test exercises the answer/consumer side of the zero-score gate

Covered by CR-01's fix above (`tests/test-225-answer-narrowing.cjs`) — no
separate action taken, per the review's own note that this finding shares its
fix with CR-01.

**Commit:** `aef4256e` (same as CR-01)

### IN-01: Dead defensive branch `!best` in the zero-score gate

**Root cause:** `if (!best || best.score === 0)` — by the point this line runs,
`corpus.length === 0` and `messageTokens.length === 0` have both already
returned early above it, so the scoring loop is guaranteed to execute at least
one iteration and always assigns `best` on its first pass. The `!best` disjunct
could never be true.

**Applied fix:** simplified to `if (best.score === 0)` and added a one-line
comment explaining why the guard is provably unreachable, so a future reader
does not need to re-derive the early-return chain.

**Files modified:** `scripts/intent-classifier.cjs`
**Commit:** `76ea9946`
**Test verification:** `node -c` syntax check; full `bash tests/run-all-225.sh` green (no behavior change possible — the removed disjunct was unreachable).

### IN-02: `doctor --help` does not document the new WAL-reset advisory under `--bind-check`

**Root cause:** Phase 225-02 added a WATCH-only WARN finding row to
`--bind-check`'s output (`_walResetAdvisory`), but `scripts/doctor.cjs --help`'s
`--bind-check` usage block never mentioned it — a user running `--help` had no
way to learn what the WARN line means, where it comes from, or that it never
affects `report.healthy` / the exit code.

**Applied fix:** appended a short paragraph to the existing `--bind-check` usage
block (`usageText()`, matching the surrounding indentation convention)
documenting the advisory's trigger condition, the upstream fix commit, and the
never-block guarantee.

**Files modified:** `scripts/doctor.cjs`
**Commit:** `053a0a90`
**Test verification:** `node -c` syntax check; `node scripts/doctor.cjs --help` confirmed correct rendering/alignment; `node tests/test-225-wal-advisory.cjs` (5/5 legs) and full suite green.

## Skipped Issues

None — all 6 in-scope findings were fixed.

## Final Verification

```
$ bash tests/run-all-225.sh
...
========================================
  Summary (194 verification)
  Passed: 14   Failed: 0   Skipped: 0
========================================
>>> Phase-194 substrate regression guard (PSB suite): PASSED

========================================
  Summary (225 verification)
  Passed: 5   Failed: 0   Skipped: 0
========================================
```

Run against `main` post-merge (merge commit `f561222e`). Check count grew from
4 to 5 legs (the new `tests/test-225-answer-narrowing.cjs` leg registered in
`tests/run-all-225.sh`); FAIL and SKIP both stayed at 0 throughout, as required.

## Commits

| Finding | Commit | Files |
|---|---|---|
| CR-01 / WR-03 | `aef4256e` | scripts/intent-classifier.cjs, tests/test-225-answer-narrowing.cjs, tests/run-all-225.sh |
| WR-01 | `076deeb9` | scripts/intent-classifier.cjs, tests/test-225-zero-score-gate.cjs |
| WR-02 | `88c76782` | scripts/intent-classifier.cjs, tests/test-225-zero-score-gate.cjs, docs/ENV-TUNING.md |
| IN-01 | `76ea9946` | scripts/intent-classifier.cjs |
| IN-02 | `053a0a90` | scripts/doctor.cjs |
| merge | `f561222e` | (merge commit landing all 5 fix commits into main) |

---

_Fixed: 2026-07-15T11:43:25Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
