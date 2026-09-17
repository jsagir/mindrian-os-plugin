---
phase: 260917-dia
plan: 01
subsystem: mcp-runtime-instructions, intent-classifier-binding-gate, rooms-root-resolution
tags: [mcp, part8, session-binding, f8-gate, env-precedence]
requirements: [TASK-A, TASK-B, TASK-C]
dependency-graph:
  requires: []
  provides:
    - "mindrian-brain named as the brain_* host in RUNTIME_INSTRUCTIONS (2 mentions, 1984 bytes, budget 2000)"
    - "F.8 binding gate off-scope wording + per-(session, off-scope room) dedupe"
    - "lib/core/rooms-home-env.cjs roomsHomeEnv() -- the one shared HOME-then-ROOT resolver, wired into 11 sites"
  affects:
    - lib/mcp/runtime-instructions.cjs
    - scripts/intent-classifier.cjs
    - 11 rooms-root resolver call sites across lib/ and scripts/
tech-stack:
  added: []
  patterns:
    - "Dedicated never-rotated marker file, keyed per (session, off-scope room), mirroring the Phase 225 zero-score gate's marker trio"
    - "One shared env-precedence resolver (roomsHomeEnv) composed by every call site instead of an inline read"
key-files:
  created:
    - lib/core/rooms-home-env.cjs
    - tests/test-260917-binding-gate-offscope.cjs
    - tests/test-260917-rooms-home-precedence.cjs
  modified:
    - lib/mcp/runtime-instructions.cjs
    - lib/mcp/no-instructions.test.cjs
    - data/harness-policies/contract-parity-larry.json
    - data/harness-manifest.json
    - tests/test-298-contract-parity.cjs
    - scripts/intent-classifier.cjs
    - scripts/write-scope-check.cjs
    - scripts/gsd-graph-derive-sweep.cjs
    - scripts/brain-derivation-drain.cjs
    - scripts/memory-lifecycle.cjs
    - lib/core/cross-room-aggregator.cjs
    - lib/core/navigation/dashboard-helpers.cjs
    - scripts/brain-derive-command.cjs
    - scripts/feynman-timeline-refresh-command.cjs
    - scripts/memory-artifact-graph-hook.cjs
decisions:
  - "Raised the RUNTIME_INSTRUCTIONS byte budget from 1950 to 2000 in lockstep across all 4 places that pin it (the 3 named in the plan plus tests/test-298-contract-parity.cjs's own hardcoded assertion, discovered as a Rule 3 blocking issue)."
  - "F.8 off-scope dedupe is keyed on (sessionId, off-scope room name), a PARALLEL marker file to the Phase 225 zero-score gate's single-boolean marker, and is scoped to fire only when boundPrimary is non-null so a genuinely unbound session keeps its pre-existing fire-every-turn behavior."
  - "roomsHomeEnv() reads process.env on every call (no caching) so hermetic tests can flip env vars between calls in the same process."
metrics:
  duration: "~70 minutes"
  completed: "2026-09-17"
---

# Quick Task 260917-dia: Three Already-Root-Caused Fixes From Lawrence's Bug Report Summary

Landed three independently-verified tester-facing defects as three atomic commits: (A) named `mindrian-brain` as the brain_* host in the MCP `RUNTIME_INSTRUCTIONS` wire string so Desktop/Cowork stop guessing the wrong server, (B) fixed the F.8 binding gate mislabeling an off-scope lexical match as "session unbound" and added per-(session, off-scope room) dedupe, (C) unified `MINDRIAN_ROOMS_HOME`-then-`MINDRIAN_ROOMS_ROOT` env precedence across 11 resolver sites behind one shared `roomsHomeEnv()` module.

## Commits (in order)

| # | SHA | Message |
|---|-----|---------|
| 1 (Task A) | `e40370c7b` | fix(mcp): name mindrian-brain as the brain_* host in RUNTIME_INSTRUCTIONS |
| 2 (Task B) | `3eaabb931` | fix(intent-classifier): F.8 binding gate - correct off-scope wording, add per-room dedupe |
| 3 (Task C) | `f05a72c1f` | fix(rooms-root): unify MINDRIAN_ROOMS_HOME then MINDRIAN_ROOMS_ROOT precedence |

**Supplementary fix commit** (not one of the 3 task commits; see Deviations): `1226a0543` fix(tests): update test-298 stale byte-budget assertion to 2000. Landed between Task A and Task B because a concurrent peer session (260917-dgf) advanced `HEAD` past Task A's commit before this blocking issue was discovered, making `git commit --amend` unsafe (it would have rewritten the peer's already-built-upon commit). See Deviations below.

**Note on commit adjacency:** this repo had a second GSD session (quick task `260917-dgf`) committing concurrently to the same branch throughout this execution. `git log --oneline` between Task A and Task C is NOT three consecutive commits; four peer commits (`8b4a04241`, `68f7552de`, `bbfc4788e`, `1adccb106`) and my one supplementary commit (`1226a0543`) are interleaved. Each of my 3 task commits was verified individually via `git show --stat <sha>` to touch only its own plan-declared files (see Verification below) — none touch the hard-boundary paths.

## Task A: name mindrian-brain in RUNTIME_INSTRUCTIONS

- `mindrian-brain` now appears at both brain_* mention points (THEO clause, BOUNDARIES paragraph) in `lib/mcp/runtime-instructions.cjs`.
- **Measured RUNTIME_INSTRUCTIONS byte count: 1984 bytes** (budget 2000, host cap 2048 — 16 bytes headroom under budget, 64 under the host cap).
- Budget raised 1950 -> 2000 in lockstep across 4 places (3 named in the plan + 1 discovered blocking issue):
  1. `lib/mcp/runtime-instructions.cjs` header comment
  2. `lib/mcp/no-instructions.test.cjs` `SERVED_BUDGET_BYTES`
  3. `data/harness-policies/contract-parity-larry.json` `byte_budget.limit`
  4. `tests/test-298-contract-parity.cjs`'s own hardcoded `assertEqual(policy.byte_budget.limit, 1950, ...)` — a 4th lockstep site not named in the plan, discovered when this post-commit verify leg failed (Rule 3, blocking-issue auto-fix).
- `data/harness-manifest.json` regenerated (Rule 3: required for `node scripts/build-harness-manifest.cjs --check` to pass against the new wire content).

**Verification:**
```
$ node lib/mcp/no-instructions.test.cjs
  ok - server answered the initialize request (harness reached ground truth)
  ok - initialize returned a result object
  ok - initialize result HAS an own `instructions` property (hookless-surface parity)
  ok - initialize `instructions` is byte-identical to RUNTIME_INSTRUCTIONS
  ok - served instructions carry no moat vocabulary (FEEDS_INTO, ADDRESSES_PROBLEM_TYPE, pagerank)
  ok - served instructions at or under SERVED_BUDGET_BYTES (measured 1984 vs budget 2000)
  ok - served instructions at or under HOST_INSTRUCTIONS_CAP_BYTES (measured 1984 vs cap 2048)
  ok - served instructions carry PART8_BOUNDARIES_FROZEN byte-identically
  ok - served instructions END with PART8_BOUNDARIES_FROZEN (nothing appended after it)
  9 passed, 0 failed

$ node scripts/build-harness-manifest.cjs --check
harness-manifest: OK

$ node tests/test-298-contract-parity.cjs   (run post-commit, on a clean tree)
test-298-contract-parity.cjs: 20 passed, 0 failed
```

## Task B: F.8 binding gate off-scope wording + per-room dedupe

**RED (before the fix)** — `tests/test-260917-binding-gate-offscope.cjs` leg 1:
```
$ node tests/test-260917-binding-gate-offscope.cjs
test-260917-binding-gate-offscope.cjs (260917-dia Task B): F.8 off-scope wording + dedupe
FAIL test-260917-binding-gate-offscope.cjs: AssertionError [ERR_ASSERTION]: stdout must NOT claim session unbound when a real bound primary exists
    at /home/jsagi/dev/MindrianOS-Plugin/tests/test-260917-binding-gate-offscope.cjs:146:12
```

**RED (before the fix)** — leg 2 dedupe, verified independently via a manual double-spawn against the identical message/session before the assertions existed in final form:
```
RUN1 stdout: {...,"systemMessage":"session unbound: choose which room(s) this session writes to"}
RUN2 stdout: {...,"systemMessage":"session unbound: choose which room(s) this session writes to"}
RUN2 fired again (should be RED/true today): true
```
Both legs confirmed the exact root cause: an off-scope bound session was told "session unbound" (wrong), and the gate re-fired on the identical message with no dedupe (also wrong).

**GREEN (after the fix)** — all 4 legs:
```
$ node tests/test-260917-binding-gate-offscope.cjs
test-260917-binding-gate-offscope.cjs (260917-dia Task B): F.8 off-scope wording + dedupe
  ok - leg 1 wording: bound session off-scope match names the bound primary, not "session unbound"
  ok - leg 2 dedupe: the identical off-scope message does not re-fire the gate
  ok - leg 3 no-regression: a genuinely unbound session still sees "session unbound" byte-identically
  ok - leg 4 dedupe is per-room: a new off-scope room in the same session still fires

PASS test-260917-binding-gate-offscope.cjs (4 checks)
```

**Suites:** `bash tests/run-all-194.sh` and `bash tests/run-all-225.sh` both pass except one pre-existing, unrelated failure (see Known Pre-Existing Failures below). Phase 225 zero-score gate code (`emitNoMatchGate`, `zeroScoreGateAlreadyOffered`, `markZeroScoreGateOffered`, `zeroScoreGateMarkerPath`) verified untouched: `git show 3eaabb931 -- scripts/intent-classifier.cjs | grep -n "^-.*(emitNoMatchGate|zeroScoreGateAlreadyOffered|markZeroScoreGateOffered|zeroScoreGateMarkerPath)"` returns no matches.

## Task C: unify MINDRIAN_ROOMS_HOME then MINDRIAN_ROOMS_ROOT precedence

**RED (before the fix)** — `tests/test-260917-rooms-home-precedence.cjs`:
```
$ node tests/test-260917-rooms-home-precedence.cjs
  ok - leg 1a: only HOME set -> returns the HOME value
  ok - leg 1b: only ROOT set -> returns the ROOT value
  ok - leg 1c: BOTH set -> returns the HOME value (HOME wins)
  ok - leg 1d: neither set -> returns null
FAIL test-260917-rooms-home-precedence.cjs: AssertionError [ERR_ASSERTION]: ROOT-before-HOME (or ROOT-only) resolver site(s) found:
lib/core/cross-room-aggregator.cjs:65: const envRoot = process.env.MINDRIAN_ROOMS_ROOT;
lib/core/navigation/dashboard-helpers.cjs:51: const roomsRoot = process.env.MINDRIAN_ROOMS_ROOT
scripts/brain-derivation-drain.cjs:75: const envRoot = process.env.MINDRIAN_ROOMS_ROOT;
scripts/brain-derive-command.cjs:292: || process.env.MINDRIAN_ROOMS_ROOT
scripts/feynman-timeline-refresh-command.cjs:84: || process.env.MINDRIAN_ROOMS_ROOT
scripts/gsd-graph-derive-sweep.cjs:51: const envRoot = process.env.MINDRIAN_ROOMS_ROOT;
scripts/intent-classifier.cjs:71: const envRoot = process.env.MINDRIAN_ROOMS_ROOT;
scripts/memory-artifact-graph-hook.cjs:93: const roomsRoot = process.env.MINDRIAN_ROOMS_ROOT ||
scripts/memory-lifecycle.cjs:90: if (process.env.MINDRIAN_ROOMS_ROOT && process.env.MINDRIAN_ROOMS_ROOT.trim()) {
scripts/memory-lifecycle.cjs:91: return process.env.MINDRIAN_ROOMS_ROOT.trim();
scripts/write-scope-check.cjs:60: const envRoot = process.env.MINDRIAN_ROOMS_ROOT;
11 !== 0
```
This census leg matched the plan's own 11-site inventory exactly (path:line for path:line), confirming the census logic was calibrated correctly before any fix was applied. Leg 3 (behavioral) was independently confirmed RED via a standalone spawn (HOME-only env, ROOT deleted): the fixture room name was absent from stdout (`room name present: false`), because `scripts/intent-classifier.cjs`'s `resolveMindrianRoomsRoot` read `MINDRIAN_ROOMS_ROOT` only at that point.

**GREEN (after the fix)** — all 3 legs:
```
$ node tests/test-260917-rooms-home-precedence.cjs
test-260917-rooms-home-precedence.cjs (260917-dia Task C): HOME-then-ROOT env precedence
  ok - leg 1a: only HOME set -> returns the HOME value
  ok - leg 1b: only ROOT set -> returns the ROOT value
  ok - leg 1c: BOTH set -> returns the HOME value (HOME wins)
  ok - leg 1d: neither set -> returns null
  ok - leg 2 census: every process.env.MINDRIAN_ROOMS_ROOT read honors HOME first (or is exempt)
  ok - leg 3 behavioral: HOME-only env (ROOT deleted) still resolves the fixture room

PASS test-260917-rooms-home-precedence.cjs (6 checks)
```

**Suites:** `node lib/memory/cross-room-aggregator.test.cjs` (18/18 passed), `tests/test-260917-binding-gate-offscope.cjs` (4/4), `bash tests/run-all-194.sh`, `bash tests/run-all-225.sh` all pass except the same single pre-existing failure (below). `lib/core/session-binding.cjs`, `lib/core/resolve-active-room.cjs`, and the `scripts/intent-classifier.cjs` ROOT->HOME compatibility bridge (feeding the Phase 127.3 chokepoint) were left untouched, per plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Regenerated `data/harness-manifest.json` (Task A commit)**
- **Found during:** Task A's own verify step (`node scripts/build-harness-manifest.cjs --check`)
- **Issue:** the manifest digest for `lib/mcp/runtime-instructions.cjs` (and, independently and pre-existing, for `skills/larry-personality/SKILL.md`) drifted the moment the wire content changed; `--check` failed.
- **Fix:** ran `node scripts/build-harness-manifest.cjs` (the generator, not just `--check`) to regenerate the manifest against current disk state, then re-verified `--check` passed.
- **Files modified:** `data/harness-manifest.json`
- **Commit:** `e40370c7b`

**2. [Rule 3 - Blocking issue] Updated `tests/test-298-contract-parity.cjs`'s stale hardcoded byte-budget assertion**
- **Found during:** Task A's post-commit verify step (`node tests/test-298-contract-parity.cjs`)
- **Issue:** that test hardcodes its own `assertEqual(policy.byte_budget.limit, 1950, ...)` — a 4th lockstep location for the byte budget, not named in the plan's discovered_constraints (which named only 3). It went stale the moment Task A raised the budget to 2000.
- **Fix:** updated the assertion (and its label + surrounding comment) from 1950 to 2000.
- **Files modified:** `tests/test-298-contract-parity.cjs`
- **Commit:** `1226a0543` (a supplementary commit, not one of the 3 task commits — see "Note on commit adjacency" above for why an amend of Task A's commit was unsafe by the time this was discovered).

### Deferred / Out-of-Scope (NOT fixed, per scope-boundary rule)

**Known pre-existing failure, confirmed unrelated to this plan's changes** (reproduced identically on a clean checkout of each affected file, before any of this plan's edits, then restored):

| Test | Failure | Confirmed pre-existing by |
|------|---------|---------------------------|
| `tests/test-194-lastmod-discipline.test.cjs` (embedded in `run-all-194.sh` / `run-all-225.sh`) | `lib/core/navigation/grant-rubric.cjs:121` -- an `UPDATE nodes SET` that mutates content but omits `last_modified_at` | `git checkout -- scripts/intent-classifier.cjs` then re-ran; identical failure with zero diff present |
| `tests/test-connector-tier-d-hooks.cjs` CHECK 4 | `scripts/brain-derivation-drain.cjs` already requires `../lib/core/brain-client.cjs` at line 177 (pre-existing, unrelated to the Task C env-read change at a different line) | `git checkout --` on all 10 Task C files, re-ran; identical failure |
| `tests/test-memory-command.cjs` (2 of 26 legs) | Mode A Brain-reachability rows ("Brain Patterns block", "Brain hint verb") -- network/Brain-availability dependent, unrelated to rooms-root resolution | same isolation re-run |

None of these three are touched by this plan's scope; none were introduced by these changes. Logged here per the scope-boundary rule (fix only what the current task's changes directly caused).

## Known Stubs

None.

## Threat Flags

None. All three tasks stayed within their declared threat-model dispositions (T-dia-01 through T-dia-05, T-dia-SC): no new network path, no widened `ALLOWED_ROOT` semantics (precedence-only change with `path.resolve` + `startsWith` containment untouched, verified by `lib/memory/cross-room-aggregator.test.cjs` passing 18/18), no npm/pip/cargo install.

## Self-Check: PASSED

- `[ -f lib/core/rooms-home-env.cjs ]` -> FOUND
- `[ -f tests/test-260917-binding-gate-offscope.cjs ]` -> FOUND
- `[ -f tests/test-260917-rooms-home-precedence.cjs ]` -> FOUND
- `git log --oneline --all | grep -q e40370c7b` -> FOUND
- `git log --oneline --all | grep -q 3eaabb931` -> FOUND
- `git log --oneline --all | grep -q f05a72c1f` -> FOUND
- `git log --oneline --all | grep -q 1226a0543` -> FOUND
