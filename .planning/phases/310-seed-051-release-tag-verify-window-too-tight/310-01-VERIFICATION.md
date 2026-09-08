---
phase: 310-seed-051-release-tag-verify-window-too-tight
verified: 2026-09-08T20:27:53Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Phase 310: SEED-051 release.sh Step 5.5 tag-verify false-alarm fix Verification Report

**Phase Goal:** Fix `scripts/release.sh` Step 5.5's false-alarm bug (SEED-051): a still-not-visible
tag after retries currently hard-aborts the release ceremony even when the push demonstrably
succeeded. Extract the abort-vs-warn decision into an injectable library, add an independent
`git ls-remote` check on origin/main's SHA as the "push demonstrably succeeded" condition, and
downgrade to a warning (rc=10) ONLY when that check passes, preserving the hard abort (rc=1)
otherwise.

**Verified:** 2026-09-08T20:27:53Z
**Status:** passed
**Re-verification:** No — initial verification

This phase touches THE PRODUCTION RELEASE SCRIPT (npm publish + marketplace update). Extra
scrutiny applied per the request: independent worktree re-run of the pre-existing test suite,
independent sha256/diff computation, direct read of the shipped library and Step 5.5 block
control flow (not just grep), and an explicit search for any production-behavior ambiguity
beyond what the phase's own SUMMARY claims.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A release whose main push landed at origin but whose tag has not yet replicated finishes with a yellow warning instead of a red false alarm | VERIFIED | `scripts/release-lib/verify-tag-push.sh` lines 89-100 (rc=10 branch); `tests/test-310-release-step55-wiring.cjs` Case 1 runs the REAL spliced Step 5.5 block text, reaches `AFTER_STEP_5_5`, contains "already matches local HEAD", does NOT contain "NOT visible at origin" (re-ran: PASS) |
| 2 | A release whose push genuinely failed or partially failed still hard-aborts with the same red message and `git push origin v<tag>` recovery line | VERIFIED | `tests/test-310-release-step55-wiring.cjs` Case 2: main-sha mismatch -> exit nonzero, sentinel absent, contains "NOT visible at origin after" and "Recovery: git push origin v" (re-ran: PASS); `scripts/release.sh:1393-1397` preserves the exact red block byte-for-byte vs pre-phase commit `a8338df1` |
| 3 | Steps 9.8/10/11 provably still run after Step 5.5 warns, under `set -euo pipefail`, no other unguarded nonzero exit in the warning branch | VERIFIED | Wiring Case 1 executes the actual shipped block text (not a copy) under `set -euo pipefail` and reaches the `AFTER_STEP_5_5` sentinel on the warn path; `scripts/release.sh:1390-1392` warn branch is a bare `:` no-op comment, no other exit point |
| 4 | `SKIP_TAG_VERIFY=1` still bypasses the gate with neither probe called, no other behavior change | VERIFIED | Wiring Case 4 (re-ran: PASS) — sentinel present, neither `tag-probe-called` nor `main-sha-called` marker exists; `git diff a8338df1 HEAD -- scripts/release.sh` shows the `SKIP_TAG_VERIFY` branch (lines 1369-1370) is untouched, only the dry-run preview line (an authorized separate hunk) changed |
| 5 | Abort-vs-warn decision exercisable by a test with fake git results: no network, no real remote, no real push, no npm publish | VERIFIED | `grep -n "git push\|npm publish" scripts/release-lib/verify-tag-push.sh tests/test-310-*.cjs` returns zero real invocations (only string literals for the recovery message / C1 literal check); wiring suite's `git` PATH shim hard-fails `ls-remote` and the marker never fired across all 4 driver runs (Case 8, re-ran: PASS) |
| 6 | Every other `# --- Step` block in `scripts/release.sh` is byte-identical to its pre-phase state | VERIFIED | `git diff a8338df1 HEAD -- scripts/release.sh` shows exactly 3 hunks (preamble insert, dry-run preview line append, Step 5.5 block rewrite) and nothing else; `tests/run-all-310.sh` leg 3 (re-ran: PASS) confirms 26/28 step blocks byte-identical, Step 1's one authorized line-delta independently normalized and re-hashed to match the fixture |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/release-lib/verify-tag-push.sh` | Pure hook-injectable decision function, >=60 lines | VERIFIED | 108 lines, defines only `mos_verify_tag_at_origin`, no `set -e`, all `${VAR:-}` guarded, no top-level side effects (direct read, full file) |
| `scripts/release.sh` | Step 5.5 rewired to library; warn path continues, abort path preserved | VERIFIED | Direct read of lines 1338-1401 confirms exact match to the plan's interface_contract Hunk B |
| `tests/fixtures/310-release-step-block-hashes.txt` | Pre-change sha256 of every Step block | VERIFIED | 50 lines, contains `PREAMBLE(1-79)` entry matching the C8 pinned sha `d90e92d4c8e1783b53004d95767ffb005c7a19e217b8641e4b15124779cf125a` (independently recomputed, matches) |
| `tests/test-310-verify-tag-push-lib.cjs` | 9-case unit suite, zero real git | VERIFIED | Re-ran: 9/9 PASS, exit 0 |
| `tests/test-310-release-step55-wiring.cjs` | 8-case suite executing the REAL Step 5.5 block | VERIFIED | Re-ran: 8/8 PASS, exit 0; direct read confirms it splices `src` text via `sliceStep55Block`, does not copy logic |
| `tests/run-all-310.sh` | Phase aggregator, all legs | VERIFIED | Re-ran: PASS=9 FAIL=0 SKIP=2, exit 0 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `scripts/release.sh` preamble | `scripts/release-lib/verify-tag-push.sh` | dot-source, fail-closed if missing | WIRED | `scripts/release.sh:87` `. "$RELEASE_LIB_DIR/verify-tag-push.sh"`; precedes `# --- Step 0:` (constraint C5), confirmed by wiring Case 7 |
| `scripts/release.sh` Step 5.5 | `mos_verify_tag_at_origin` | `\|\| TAG_VERIFY_RC=$?` | WIRED | `scripts/release.sh:1388` uses the mandatory `\|\|` form, confirmed errexit does not swallow rc=10 (Case 1) or rc=1 (Case 2) |
| `scripts/release-lib/verify-tag-push.sh` | injected probes | `MOS_TAG_PROBE_HOOK` / `MOS_MAIN_SHA_HOOK` / `MOS_SLEEP_HOOK` | WIRED | Resolved via `command -v`, fail-closed if unusable (unit Case 6); real-git defaults set via `: "${VAR:=default}"` in release.sh (never `export`ed, confirmed no override risk in normal usage) |
| `tests/test-310-release-step55-wiring.cjs` | `scripts/release.sh` | splices real block text | WIRED | `sliceStep55Block()` reads `fs.readFileSync(RELEASE_SH)` and slices between literal header strings — not a hand-copied block |

### Data-Flow / Control-Flow Trace (Level 4 — bash-specific)

The main-SHA probe (the "push demonstrably succeeded" independent check) is positioned in
`scripts/release-lib/verify-tag-push.sh` at lines 89-92, structurally AFTER the retry `while`
loop (lines 76-87) exits, and is never reached if the loop returns 0 early (confirmed by unit
Case 1: no main-sha marker file on the happy path, and wiring Case 3: main-sha hook never
called when the tag is found on attempt 2). This matches the interface contract's "fires
exactly once, only after retry exhaustion" requirement and was verified by reading the control
flow directly, not by grepping for the string in isolation.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit suite (9 cases: rc 0/10/1 across all documented conditions) | `node tests/test-310-verify-tag-push-lib.cjs` | 9/9 PASS, exit 0 | PASS |
| Wiring suite (8 cases, real spliced block, network-blocking shim) | `node tests/test-310-release-step55-wiring.cjs` | 8/8 PASS, exit 0 | PASS |
| Phase aggregator (10 legs) | `bash tests/run-all-310.sh` | PASS=9 FAIL=0 SKIP=2, exit 0 | PASS |
| Pre-existing suite regression check | `node tests/test-release-bump-tag-and-publish-gates.cjs` | 11/13 PASS, Test 10 + Test 11 fail (documented pre-existing) | PASS (see below) |
| Preamble byte-identity | `sed -n '1,79p' scripts/release.sh \| sha256sum` | `d90e92d4c8e1783b53004d95767ffb005c7a19e217b8641e4b15124779cf125a` | MATCHES pinned baseline exactly |
| Scope diff (only 3 authorized regions changed) | `git diff a8338df1 HEAD -- scripts/release.sh` | 3 hunks: preamble insert, dry-run line append, Step 5.5 rewrite | PASS, no other content changed |
| SKIP_TAG_VERIFY byte-preservation | `grep -n SKIP_TAG_VERIFY` pre vs post | Identical text at shifted line numbers (1345/1349/1350 -> 1357/1369/1370) | PASS |
| Em-dash guard, all 6 touched files | `grep -cP '\x{2014}\|\x{2013}'` per file | 0 matches, all files | PASS |
| Real git push / npm publish in library or tests | `grep -rn "git push\|npm publish"` | Zero real invocations (string literals only) | PASS |
| `doctor.cjs` `release-dry-run-output` blocker (full-tier check, independently replayed) | Direct replay of the doctor.cjs check logic against `release.sh patch --dry-run` | `missing: []`, all 15 expected step names present incl. "Step 5.5" | PASS |
| `doctor.cjs --acceptance --pre-flight` | `node scripts/doctor.cjs --acceptance --pre-flight` | 1/1 points passed | PASS |

**Independent pre-existing-failure confirmation (extra scrutiny requested):** checked out a
throwaway `git worktree` at `a8338df1` (the commit immediately before this phase's first
commit `f2703fc4`), symlinked `node_modules` (absent by default in a fresh worktree — an
environment artifact, not a code issue), and re-ran
`node tests/test-release-bump-tag-and-publish-gates.cjs`. Result: **11/13 passing, Test 10 and
Test 11 failing with the identical signature** (`@mindrian_os/install` vs the now-current
`@mindrian_os/cli` package name in Step 9.7, unrelated to Step 5.5) — genuinely pre-existing,
zero relationship to this phase's edits. Worktree removed after the check.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEED-051-B | 310-01 | Treat a still-not-visible tag as a WARNING that does not abort when the push demonstrably succeeded; escalate only if the main push failed | SATISFIED | rc=10 path in library + Step 5.5 warn branch, proven by unit Case 3 and wiring Case 1 |
| SEED-051-C | 310-01 | Steps 9.8/10/11 still run even if 5.5 warns | SATISFIED | Wiring Case 1's `AFTER_STEP_5_5` sentinel proves control flow survives under real `set -euo pipefail`; Step 9.8 header confirmed to follow Step 5.5 (wiring Case 6) |
| SEED-051-A | n/a | Widen shipped retry defaults | DEFERRED (explicit, per 310-CONTEXT.md) | `RELEASE_TAG_PUSH_RETRIES:-3` / `RELEASE_TAG_PUSH_BACKOFF_S:-5` confirmed unchanged in diff |

No orphaned requirements found for this phase.

### Anti-Patterns Found

None. No TBD/FIXME/XXX markers in any of the 6 phase-touched files. No em-dashes. No stub
patterns (`return null`, empty handlers, hardcoded empty returns) in the library or the Step
5.5 rewrite — every branch was read directly and traced to real logic.

### Production-Behavior Ambiguity Review (extra scrutiny requested)

Explicitly searched for any way this fix could make a REAL release behave unexpectedly, beyond
what SUMMARY.md claims:

- **Residual risk, already documented and accepted (not a gap):** `git push origin main --tags`
  pushes multiple refs in one invocation; a scenario where `main` pushes successfully but the
  specific new tag ref is independently rejected (not just delayed) would be indistinguishable
  from ordinary replication lag by this fix's own main-sha check alone, and would warn-continue
  rather than abort. This exact edge case is named in `310-CONTEXT.md`'s "Decision" section and
  in the plan's own threat model (T-310-02), with an explicit accepted mitigation: Step 9.8's
  full `doctor --acceptance` runs immediately after and independently re-verifies the published
  artifact, so a genuinely bad release still has a hard gate downstream. This is a locked,
  pre-existing design decision, not an unaddressed ambiguity introduced by this verification.
- **Hook-override risk:** `MOS_TAG_PROBE_HOOK`/`MOS_MAIN_SHA_HOOK` use `: "${VAR:=default}"`,
  which does NOT override an already-exported value in the calling shell. In the normal release
  invocation (`bash scripts/release.sh <mode>`) these vars are never set, so real-git probes are
  always used. The only way this could misfire in production is if an operator manually exported
  `MOS_TAG_PROBE_HOOK`/`MOS_MAIN_SHA_HOOK` in the same interactive shell before running a real
  release — an unusual, self-inflicted action, and the same class of residual risk the plan's own
  threat model (T-310-01) already names and accepts ("the operator already runs `bash
  scripts/release.sh` with full shell control ... these seams grant no privilege the operator
  lacks"). Not treated as a gap.
- **Fail-closed checked explicitly:** if `git rev-parse HEAD` fails (empty `LOCAL_HEAD_SHA`), the
  library's `[ -n "$expected_main_sha" ]` guard means the match can never succeed — falls through
  to the abort path. If `git rev-parse HEAD` succeeds but a concurrent unrelated push has already
  moved `origin/main` past this ceremony's commit, the sha comparison correctly fails and the
  ceremony aborts (conservative, correct direction).

No unresolved ambiguity found that would require blocking this phase.

### Human Verification Required

None required to close this phase. One informational, non-blocking operator note already
captured in the plan/SUMMARY: the next real release is the first live exercise of the actual
warn path (rc=10) against real GitHub replication lag; the plan itself recommends the navigator
eyeball `git diff <base> -- scripts/release.sh` once before cutting it. This is inherent to any
change to the live release ceremony and does not indicate an unverified code path — the warn
path's control flow was proven with the actual shipped block text under `set -euo pipefail`
(wiring Case 1), only the "does GitHub actually lag like this" real-world timing was not (and
cannot be) exercised without a live release.

### Gaps Summary

None. All 6 truths verified, all 6 artifacts verified at all three levels (exist, substantive,
wired), all 4 key links wired, both new test suites pass in full (9/9 and 8/8), the phase
aggregator passes (FAIL=0), the pre-existing regression suite's only 2 failures were
independently re-confirmed as genuinely pre-existing (identical failure signature reproduced
against the pre-phase commit in a throwaway worktree), the byte-level scope tripwire confirms
zero unauthorized changes to `scripts/release.sh`, and no em-dash or debt-marker violations were
found in any of the 6 phase-touched files.

---

_Verified: 2026-09-08T20:27:53Z_
_Verifier: Claude (gsd-verifier)_
