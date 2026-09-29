---
phase: 362-card-gate-text-dependent-relevance-false-block-r-c-follow-on
verified: 2026-09-29T07:20:00Z
status: passed
score: 14/14 must-haves verified
overrides_applied: 0
---

# Phase 362: Card gate text-dependent relevance false block (R-C follow-on) - Verification Report

**Phase Goal:** Close the one known_false_block Phase 357 left open (replay entry dogfood-0f86dd63-092046). Replay it on post-359 code first; if still false-blocking, fix with structured signals only (turn metadata, token provenance, 359 declared options; no text understanding, no Jev in hooks), else record residual known_false_block with evidence. The 357 false_blocks = 0 bar holds.
**Verified:** 2026-09-29T07:20:00Z
**Status:** passed
**Re-verification:** No - initial verification (no prior 362-VERIFICATION.md)
**Verified at HEAD:** a9c1b4a94 (MindrianOS-Plugin), home repo research commit bfa0365ab

## Outcome under verification

`residual-known-false-block`. This is one of the three outcomes the goal and D-05 allow. D-04 pre-authorizes it when no structured signal can clear the entry. The verifier re-derived it independently: the replay still blocks at HEAD, the measurement independently reproduces `SIGNAL: NONE` over 24 variants, and the fixture reason cites the 362 measurement.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | D-01 AMENDED gate: the three shared files were clean before any 362 write, GATE_HEAD recorded, no wait on 359-07..10 | VERIFIED | 362-REPLAY.md records the empty `git status --short` on the three paths and GATE_HEAD 0892259ba. 9fb44fc40 is the first 362 commit, it touches only 362-REPLAY.md. None of the three files changed anywhere in the 362 range (truth 8). |
| 2 | D-02: the first step replays dogfood-0f86dd63-092046 on post-359 code, both surfaces, zero network | VERIFIED | 362-REPLAY.md line 1 is `VERDICT: STILL_FALSE_BLOCKS`, line 2 is `REPLAY_SHA: 0892259bad9661337565ca1ac194794c86b8af07` (40-hex). The verifier reran `env -u TYPESAFE_API_KEY node scripts/replay-card-fire.cjs --surface both --only dogfood-0f86dd63-092046 --json` at HEAD: cli block / reached-registry-gate-no-card, mcp block, outcome KNOWN_FALSE_BLOCK. This matches the pre-359.json and pre-362.json rows. The 359-03 declared-arm anchor (`ANCHOR fork359-declared-arm`, `if (!primaryHit && !backstopHit && !forkDeclared)`) is present once each in scripts/check-card-fire.cjs, so the replayed code is post-359. |
| 3 | pre-362.json pins PRE362 (sha, six runtime digests, every verdict) before any change | VERIFIED | `pre_362_sha` 00fb9599f. The verifier recomputed sha256 for all six runtime files at HEAD (check-card-fire.cjs, gate-relevance.cjs, hmi/turn-text.cjs, mcp/stop-gate-handler.cjs, card-fire-sidechannel.cjs, fork-declaration.cjs) and all six MATCH. |
| 4 | Every D-03 candidate family (C1 to C4) is measured against the corpus and its 12 anti-vacuity fires, with clears-target, new misses, monotone and runtime files reported | VERIFIED | The verifier reran `node scripts/measure-relevance-signals-362.cjs --json` (exit 0): verdict `SIGNAL: NONE`, 24 candidates. Per variant, clears_target, new_misses count and monotone match the 362-SIGNALS.md table row for row (C1b:min=5/6 clears with 11 misses, C2b:T=10000 clears with 2, C4b clears with 3, C1a:min=6 non-monotone, C2c not measurable). Each variant is scored by patching `gateTopicallyRelevant` and calling the real `classifyCardFire`. It is not a toy predicate: the C1b/C2b variants change verdicts, which proves the patch takes effect. |
| 5 | The measurement is reproducible, and SIGNALS line 1 equals the measured verdict | VERIFIED | The run-all-362 leg "362: measurement reproducible (CARD362-03)" PASSED (it compares head -1 of 362-SIGNALS.md with the JSON verdict). The verifier's independent run agrees. |
| 6 | D-03: no text understanding, no Jev, no egress | VERIFIED | Variant inputs are token counts, gate token sets after the frozen chrome strip, dial layout line kinds, reach age_ms, and the 359 `parseForkDeclaration` result only. Nothing reads meaning. The script installs a fetch thrower for the whole run and `never_evaluated` lists continuity cues, punctuation or question shape, semantic similarity, and Jev or network. Its only requires are node:fs, node:path and repo modules. No gate runtime file changed, so the hook gained nothing. The run-all legs "no api.typesafe.ai under lib/ or hooks/" and "measurement script never referenced from lib/ or hooks/" PASSED, and disposition D7a (no spawn attempted a network call) and D7b PASSED. |
| 7 | NONE branch: only the target's known_false_block reason and why change, citing the 362 measurement, RED first | VERIFIED | `git diff 9fb44fc40~1..a9c1b4a94 -- dogfood.json` changes exactly 2 lines (the target's `why` and `known_false_block.reason`). The new reason cites "Phase 362 (362-SIGNALS.md): no structured signal (...) clears it without a new miss; residual per D-04". It also corrects the overlap to the measured two tokens (`governance`, `thread`). RED commit 8212e255c (test only) is an ancestor of GREEN 4b0f9cf44. Disposition D3 confirms that no other verdict moved against pre-362.json. |
| 8 | No gate runtime file changed in the 362 commits | VERIFIED | `git log 9fb44fc40~1..a9c1b4a94 -- lib/core/gate-relevance.cjs scripts/check-card-fire.cjs lib/hmi/turn-text.cjs lib/core/turn-text.cjs` is empty. `git diff --quiet 9fb44fc40~1 HEAD` over those files plus tests/test-359-inertness.cjs and tests/test-357-f1-chrome.cjs exits 0. `git diff --stat 00fb9599f HEAD -- lib/ scripts/check-card-fire.cjs hooks/` is empty. The range diffstat holds only 362 docs and tests, plus peer 363-CONTEXT.md commits (f58fa11c7, 48f23a68c). |
| 9 | The 357 bar holds: false_blocks 0, new_misses 0, parity 0 on both surfaces | VERIFIED | The run-all-362 leg "standing replay bar, both surfaces" PASSED (`--baseline compare` exit 0). Disposition D2 PASSED. |
| 10 | No previously correct fire becomes a miss: the 12 anti-vacuity fixtures still block on cli and mcp | VERIFIED | Disposition D4 PASSED. The 359 inertness gate (verdicts pinned) passes 4/4. |
| 11 | The 357 mutation leg and the 359 inertness, declared-arm and A13 tripwire legs pass | VERIFIED | The verifier ran `bash tests/run-all-357.sh`: `Phase 357: PASS=16 FAIL=0 SKIP=0`, exit 0. In run-all-362, "357: mutation, reverted fix fails", "359: inertness", "359: declared arm", "359: A13 tripwires" and "359: MCP declared" all PASSED. |
| 12 | tests/run-all-362.sh is the standing gate, green, and a missing file reports SKIPPED, never PASSED | VERIFIED | The verifier ran `bash tests/run-all-362.sh`: `Phase 362: PASS=20 FAIL=0 SKIP=3`, exit 0. There are 3 skips. The first is the residual mutation leg (exit 77, "no gate runtime change since PRE362", by design). The other two are 359 replay and 359 replay mutation (`tests/test-359-replay.cjs` is not on main; it lands with 359-07). The `run_if` guard makes a missing file report SKIPPED. |
| 13 | The outcome is recorded mechanically as exactly one allowed value | VERIFIED | 362-REPLAY.md L1 `VERDICT: STILL_FALSE_BLOCKS`, 362-02-SUMMARY.md L1 `DISPOSITION: residual-known-false-block` and 362-03-SUMMARY.md L1 `OUTCOME: residual-known-false-block` all agree. |
| 14 | The research trail is filed in both homes, byte-identical, cross-linked to 362-CONTEXT.md, with no names or cwd paths | VERIFIED | Home repo commit bfa0365ab is an ancestor of home HEAD and adds exactly the two files. `cmp` shows them BYTE-IDENTICAL (7094 bytes each), both tracked and clean against HEAD. The trail states "Outcome: residual-known-false-block" and names 362-CONTEXT.md twice. A grep for `/home/`, `jsagi` or `sagir` finds nothing, and there are no em or en dashes. |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `362-REPLAY.md` | D-01 gate evidence, D-02 verdict, entry facts | VERIFIED | Lines 1 and 2 are in the contract form. It contains `only dogfood-0f86dd63-092046` and `test-359-inertness` (key links). |
| `tests/fixtures/card-fire-replay/pre-362.json` | PRE362 sha, six digests, verdicts | VERIFIED | Digests match HEAD. D3 uses it as the no-other-change anchor. |
| `scripts/measure-relevance-signals-362.cjs` | dev-only measurement, --json, SIGNAL verdict | VERIFIED | 451 lines. It reuses `gateSubjectTokens` and `subjectTokens` from gate-relevance.cjs. It is dev-only: nothing under lib/ or hooks/ references it. |
| `362-SIGNALS.md` | SIGNAL verdict, variant table, baseline, fixture limits | VERIFIED | L1 `SIGNAL: NONE`, reproduced. |
| `tests/test-362-disposition.cjs` | D1 to D7 legs plus --mutation | VERIFIED | 348 lines. The verifier ran it: `PASS test-362-disposition 8/8`. |
| `tests/run-all-362.sh` | standing gate | VERIFIED | 138 lines. It uses `run_if`, references test-362-disposition and check-cirs-declaration. CIRS reports `OK (3 plan(s))`. |
| `tests/fixtures/card-fire-replay/dogfood.json` | residual reason citing 362 | VERIFIED | Two-line diff, target entry only. |
| Research trail (both homes) | durable reasoning, cross-linked | VERIFIED | bfa0365ab, byte-identical. |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| 362-REPLAY.md | scripts/replay-card-fire.cjs | recorded `--only dogfood-0f86dd63-092046` run | WIRED (re-run agrees) |
| 362-REPLAY.md | tests/test-359-inertness.cjs | clean-tree gate plus standing result | WIRED |
| test-362-disposition.cjs | pre-362.json | D3 compare, D6 digest anchor | WIRED (D3 and D6 pass) |
| test-362-disposition.cjs | replay-card-fire.cjs | child-process replays with network preload | WIRED (D2, D7a pass) |
| measure-relevance-signals-362.cjs | lib/core/gate-relevance.cjs | gateSubjectTokens, subjectTokens, patched gateTopicallyRelevant | WIRED (variant verdicts move) |
| run-all-362.sh | test-362-disposition.cjs, check-cirs-declaration.cjs | run_if, --check | WIRED |
| Research trail | 362-CONTEXT.md | link line | WIRED |

### Data-Flow Trace (Level 4)

This is not applicable in the usual sense: the phase ships no UI or rendering surface. The equivalent check is that the measurement's variant verdicts come from the real `classifyCardFire` over turns captured from the real harness (BASE reproduces all 60 HEAD verdicts, else exit 2), not from static data. Status: FLOWING.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 362 standing gate | `bash tests/run-all-362.sh` | `PASS=20 FAIL=0 SKIP=3`, exit 0 | PASS |
| 357 standing gate | `bash tests/run-all-357.sh` | `PASS=16 FAIL=0 SKIP=0`, exit 0 | PASS |
| Target replay at HEAD | `replay-card-fire.cjs --surface both --only dogfood-0f86dd63-092046 --json` | cli block, mcp block, KNOWN_FALSE_BLOCK, false_blocks 0 | PASS |
| Measurement reproducible | `measure-relevance-signals-362.cjs --json` | `SIGNAL: NONE`, 24 variants, table matches SIGNALS.md | PASS |
| Disposition | `node tests/test-362-disposition.cjs` | `PASS 8/8` | PASS |
| 238 regression | `bash tests/run-all-238.sh` | `PASS=9 FAIL=1`, the only red is 238-03 (the recorded 357 R-J red) | PASS (no new red) |
| R-J reds unchanged | test-card-fire-relevance-gate, test-ga4-card-fire-e2e-179 | 6 passed / 5 failed; 2 ok then the same E2E-1 abort, identical to the PRE362 baseline | PASS (no new red) |
| Runtime digests | sha256 of six files vs pre-362.json | 6/6 MATCH | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` is declared by the 362 plans, and this is not a migration phase. The phase's runnable checks were executed directly (above). Status: SKIPPED (no probes declared).

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| CARD362-01 | 362-01 | SATISFIED | Truth 1 |
| CARD362-02 | 362-01 | SATISFIED | Truth 2 |
| CARD362-03 | 362-02 | SATISFIED | Truths 4, 5, 6 |
| CARD362-04 | 362-02 | SATISFIED | Truth 7 (NONE branch; mutation SKIP 77 by design) |
| CARD362-05 | 362-02, 362-03 | SATISFIED | Truths 9 to 12. The 359 replay and mutation legs are SKIPPED because the file is not on main. 362-02 Task 1 pre-declares this case as "SKIPPED, never a failure (D-01 AMENDED)". It cannot be affected by 362, because zero runtime bytes changed and the 359 anchor lines are intact. |
| CARD362-06 | 362-03 | SATISFIED (row not yet ticked) | Truths 13, 14. The outcome is recorded and the trail is filed at bfa0365ab. The REQUIREMENTS.md row still reads "Open: ... not yet filed", which is stale. |

There are no orphaned requirements: REQUIREMENTS.md maps only CARD362-01..06 to Phase 362, and all six are claimed by a plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (all 362 files) | - | TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER | none found | - |
| (all 362 files) | - | em or en dash | none found (guard leg PASSED) | - |
| 362-03-SUMMARY.md | Research trail, CARD362 closure | stale narrative: says the trail is "not filed" and CARD362-06 is "Open" | Info | Superseded by home commit bfa0365ab. A documentation lag, not a goal gap. |

### Documentation follow-ups (orchestrator-owned, not goal gaps)

1. **CARD362 rows are uncommitted.** CARD362-01..05 are ticked with proof only in the working tree. HEAD still shows all six as `- [ ]`. The commit was withheld because a Phase 363 planner holds concurrent uncommitted hunks in `.planning/REQUIREMENTS.md`. This verifier did not touch that file.
2. **CARD362-06 needs ticking.** Tick it with the proof "research trail filed in both homes, byte-identical, home commit bfa0365ab", replacing the stale "Open:" annotation.
3. **359 replay legs.** `359: replay` and `359: replay mutation` in run-all-362 go from SKIPPED to live once 359-07 lands `tests/test-359-replay.cjs`. The next run-all-362 after that must still show FAIL=0.

### Human Verification Required

None. The residual disposition was pre-authorized by the navigator in D-04. Every acceptance criterion in D-05 is machine-checked and was re-run by the verifier.

### Gaps Summary

There are no goal gaps. Post-359 code still false-blocks the target, and this was independently reproduced. Every D-03 structured-signal family was measured with the real classifier, and the verifier independently reproduced the no-viable-signal result. Every variant that clears the target silences at least one genuine fork (11, 2 or 3 of the anti-vacuity fires), or is not measurable on the sanitized fixture. So the entry correctly stays a residual known_false_block whose reason now cites 362-SIGNALS.md. No gate runtime byte changed. The 357 bar (false_blocks 0, new_misses 0, parity 0), the 12 anti-vacuity fires, the 357 mutation leg and the 359 inertness, declared-arm and tripwire legs all hold. D-03 holds: no text understanding, no Jev, no egress. The only open items are the REQUIREMENTS.md ticks listed above.

---

_Verified: 2026-09-29T07:20:00Z_
_Verifier: Claude (gsd-verifier)_
