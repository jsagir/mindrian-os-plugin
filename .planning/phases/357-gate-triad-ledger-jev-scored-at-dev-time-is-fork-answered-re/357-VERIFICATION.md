---
phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
verified: 2026-09-23T19:54:51Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
---

# Phase 357: Gate-triad replay harness (Jev as dev-time teacher, deterministic runtime) - Verification Report

**Phase Goal:** Replaying a labeled corpus of Stop events through the real CLI path
(`deriveTurnSignals` -> `classifyCardFire`) gives 0 false blocks and 0 new missed forks against
today's baseline. Runtime stays pure local deterministic code. Jev is used only at dev time, to
label the synthetic and sanitized cases. Larry's gate prose shrinks only after that bar is met.

**Verified:** 2026-09-23T19:54:51Z
**Status:** passed
**Re-verification:** No - initial verification

**Note:** per the repo's release rule, this fix is not live for users until it ships in a release
(`scripts/release.sh`). Verification here covers the dev-workspace `main` branch state only.

## Goal Achievement

### Observable Truths

All 10 items are the `357-SPEC.md` Acceptance Criteria (the roadmap contract), independently
re-run in this session, not taken from SUMMARY.md claims.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Replay corpus has >=45 entries across 4 sources, loader test passes | VERIFIED | `node scripts/replay-card-fire.cjs --surface both --baseline compare --json` -> `entries=60` (238:18, debug:16, live:2, dogfood:24). `node tests/test-357-corpus-loader.cjs --dogfood-strict` -> PASS 14/14 legs, exit 0. |
| 2 | Replay on pre-phase code flags the 2026-09-23 no-fork turn as FALSE_BLOCK | VERIFIED | `node tests/test-357-replay.cjs --mutation` -> M1/M2/M3 each revert the fix and reproduce FALSE_BLOCK on `live-2026-09-23-01`/`live-2026-09-23-02`, PASS 3/3, exit 0. `run-all-238.sh` L6 independently confirms `--code-root pre-phase` reproduces both live anchors as FALSE_BLOCK. |
| 3 | Replay on post-phase code reports false_blocks = 0 | VERIFIED | Independent run: `false_blocks:0` in the 60-entry JSON output (one entry is `known_false_block`, excluded from the bar per R-C, and is correctly reason-tagged, not silently dropped). |
| 4 | Replay on post-phase code reports new_misses = 0 against baseline | VERIFIED | Independent run: `new_misses:0`, `parity_mismatches:0`, `errors:0` in the same JSON output. |
| 5 | Known misses listed by id, each with a text-dependence reason | VERIFIED | `known_miss` id `debug-intern-w1-prose-fork` (0 extractable labels, text-dependent per SPEC out-of-scope). `known_false_block` id `dogfood-0f86dd63-092046` carries reason: "single content-token overlap ('governance') ... text-dependent, not deterministically separable (R-C)". |
| 6 | Labeler refuses dogfood entries (test), runs keyless with exit 0 | VERIFIED | `node tests/test-357-labeler-refusal.cjs` -> PASS=83 FAIL=0, exit 0 (L1: refuses dogfood before building a request; L3: keyless run exits 0, reports "unlabeled", zero NETWORK_ATTEMPT_357). |
| 7 | `grep -r api.typesafe.ai lib/ hooks/` empty, `test-353-tripwires.cjs` passes | VERIFIED | `grep -rn api.typesafe.ai lib/ hooks/` -> empty (exit 1/no match). `node tests/test-353-tripwires.cjs` -> PASS=5 FAIL=0, exit 0, including the leg-2 check that `label-card-fire-replay` is in `HOOKS_BANNED_LEDGER_SCRIPTS`. |
| 8 | CLI and MCP replay verdict classes identical on every entry (dedup excluded) | VERIFIED | `--surface both --baseline compare --json` -> `parity_mismatches:0` across all 60 entries; every entry's `cli.class` equals `mcp.class`. `mcp.room_dir:null` on every entry (R-H hermeticity). |
| 9 | Reverting the R4 fix makes the standing suite fail | VERIFIED | `node tests/test-357-replay.cjs --mutation` PASS 3/3 (each mutation leg reverts the fix in-process, confirms FALSE_BLOCK, then restores). `bash tests/run-all-357.sh` -> PASS=16 FAIL=0, includes the mutation legs; `bash tests/run-all-238.sh` also carries the "357 card-fire replay standing gate" leg (PASS 12/12) as an additive standing check. |
| 10 | The 2 prose spans shrink by >=50% (<=1115 B) with voice/card/handoff tests green, OR the skip reason is recorded | VERIFIED | Byte-measured directly: `agents/larry-extended.md` "## Decision Gates" span = 624 B; `skills/larry-personality/SKILL.md` :244 span = 232 B. Combined 856 B vs the 2230 B baseline = 61.6% cut, under the 1115 B ceiling. `node tests/test-gate-native-fire-w1.cjs` PASS(12), `node tests/test-larry-voice-mark-182.cjs` PASS(106), `node tests/test-larry-handoff-seam.cjs` PASS(6/6), `node scripts/build-harness-manifest.cjs --check` -> `harness-manifest: OK`. Since R4 passed, no skip was needed and none was recorded. |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/replay-card-fire.cjs` | Replay harness, CLI+MCP surfaces, `--baseline`, `--code-root`, `--json` | VERIFIED | Runs against real `deriveTurnSignals`/`classifyCardFire`/`handleStopEvent`, zero network calls, exit non-zero on `false_blocks>0 \|\| new_misses>0` (confirmed via mutation test). |
| `scripts/label-card-fire-replay.cjs` | Dev-only Jev labeler, sources a/b/c only | VERIFIED | Refuses dogfood/missing-statement entries before building a request; degrades to `unlabeled` keyless with exit 0; wired into `HOOKS_BANNED_LEDGER_SCRIPTS` tripwire. |
| `scripts/extract-dogfood-stop-events.cjs` | Local-only dogfood extractor | VERIFIED | Referenced by `357-06-SUMMARY.md`; produces `dogfood.json` with 24 sanitized, navigator-ratified entries, all `label_origin: human`. |
| `scripts/jev-devtime-client.cjs` | Shared dev-time Jev client (import, not rebuild) | VERIFIED | Header comment confirms Phase 356 extraction; 357's labeler imports it (per D-10/R-G), no duplicate client found. |
| `data/jev-policies/card-fire-replay.json` | Noul-native policy file, `criteria` as object, 3 Nouls | VERIFIED | 3 policy entries (`is-fork`, `already-answered`, `relevant`) under `policies`, each `criteria` is an object (not array), matches D-12 amendment. `test-357-labeler-refusal.cjs` L5 deep-equals the labeler's built request against this exact file. |
| `tests/fixtures/card-fire-replay/{debug-cases,live-2026-09-23,dogfood}.json` | 3 of the 4 corpus source files, each with `meta.sanitization_statement` | VERIFIED | debug-cases: 16 entries, live: 2 entries, dogfood: 24 entries; all 3 carry `meta.sanitization_statement`. Source (a) intentionally not copied (238 corpus read in place via adapter, per D-01). |
| `lib/hmi/turn-text.cjs` | `HARNESS_LEADS`, `classifyPrecedingUserContentSource` R-A carve-out | VERIFIED | `HARNESS_LEADS` frozen array; function signature takes `(content, rec)` and implements the `isMeta`/`prevHumanUpstream`/`origin.kind` rules exactly as described in R-A. Stale comment at the old :1333-1334 location replaced with an accurate one. |
| `lib/core/gate-relevance.cjs` | `F1_DIAL_CHROME_TOKENS`, drift test | VERIFIED | Frozen `Set`, derived from `dial-presenter.cjs` static template strings (not frequency), used inside the relevance-token filter at line 218; drift test (`test-357-f1-chrome.cjs` F.2) passes. |
| `agents/larry-extended.md` "## Decision Gates" span | Shrink to <=1115B combined, SEED-021 rules preserved | VERIFIED | 624 B, contains "no card, no picture (SEED-021)", "AskUserQuestion", "never render the gate as an ASCII box". |
| `skills/larry-personality/SKILL.md` :244 span | Shrink, SKILL :216 (Voice Signature) untouched per R-B | VERIFIED | 232 B, contains "no card, no picture (SEED-021)". The Voice Signature span (:182 test target) is a separate, untouched span; `test-larry-voice-mark-182.cjs` confirms it is intact. |
| `tests/run-all-357.sh` + `tests/run-all-238.sh` additive leg | Standing gate | VERIFIED | `run-all-357.sh` PASS=16 FAIL=0; `run-all-238.sh` carries "357 card-fire replay standing gate (GATE-04, R-J)" leg, PASS 12/12 independently within that run. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `replay-card-fire.cjs` (CLI surface) | `scripts/check-card-fire.cjs` | `deriveTurnSignals` -> `classifyCardFire`, no mocks | WIRED | Confirmed by identical `cli.reason` strings matching real classifier verdict names (`preceding-turn-synthetic-no-user-engagement`, `ascii-box-backstop-no-card`, etc.) across all 60 entries. |
| `replay-card-fire.cjs` (MCP surface) | `lib/mcp/stop-gate-handler.cjs` | `handleStopEvent`, hermetic temp `MINDRIAN_HOME` | WIRED | `mcp.room_dir:null` on every entry (R-H); `parity_mismatches:0` against the CLI surface. |
| `label-card-fire-replay.cjs` | `jev-devtime-client.cjs` | shared client, `card_fire_replay` egress profile | WIRED | `test-357-labeler-refusal.cjs` L4 proves the profile guard throws on any of 6 distinct violation shapes and never calls fetch; L5 proves the built request body matches the policy file byte-for-byte. |
| `turn-text.cjs` `'harness'` class | `check-card-fire.cjs:691` synthetic-source guard | string equality check alongside `'tool_result'` | WIRED | Confirmed by grep at line 691 (`t.preceding_user_text_source === 'tool_result' \|\| t.preceding_user_text_source === 'harness'`) and by mutation test M1 failing when this fix is reverted. |
| `gate-relevance.cjs` `F1_DIAL_CHROME_TOKENS` | relevance token filter | `continue` on chrome-token match, line 218 | WIRED | Mutation test M2 fails (reproduces `live-2026-09-23-02` FALSE_BLOCK) when this fix is reverted, proving the filter is load-bearing, not dead code. |
| `test-353-tripwires.cjs` leg 2 | `HOOKS_BANNED_LEDGER_SCRIPTS` | named-list membership check | WIRED | `label-card-fire-replay` present in the constant (grep confirmed); leg 2 passes with 2 files scanned. |

### Behavioral Spot-Checks / Probe Execution

All commands below were run directly in this session (not sourced from SUMMARY.md), per the task's explicit command list.

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Full replay, both surfaces, JSON | `node scripts/replay-card-fire.cjs --surface both --baseline compare --json` | `entries:60, false_blocks:0, new_misses:0, parity_mismatches:0, known_misses:1, known_false_blocks:1, errors:0`; exit 0 | PASS |
| Mutation legs | `node tests/test-357-replay.cjs --mutation` | M1/M2/M3 PASS 3/3, exit 0 | PASS |
| Standing suite | `bash tests/run-all-357.sh` | PASS=16 FAIL=0 SKIP=0, exit 0 | PASS |
| Part 8 tripwires | `node tests/test-353-tripwires.cjs` | PASS=5 FAIL=0, exit 0 | PASS |
| Vendor literal scan | `grep -rn api.typesafe.ai lib/ hooks/` | no matches | PASS (empty as expected) |
| Handoff seam regression | `node tests/test-larry-handoff-seam.cjs` | PASS 6/6, exit 0 | PASS |
| Gate-native fire regression | `node tests/test-gate-native-fire-w1.cjs` | PASS 12 assertions, exit 0 | PASS |
| Voice mark regression | `node tests/test-larry-voice-mark-182.cjs` | Passed: 106, Failed: 0, exit 0 | PASS |
| Harness manifest | `node scripts/build-harness-manifest.cjs --check` | `harness-manifest: OK`, exit 0 | PASS |
| Corpus loader (dogfood-strict) | `node tests/test-357-corpus-loader.cjs --dogfood-strict` | PASS 14 legs, exit 0 | PASS |
| Labeler refusal | `node tests/test-357-labeler-refusal.cjs` | PASS=83 FAIL=0, exit 0 | PASS |
| Harness-source unit | `node tests/test-357-harness-source.cjs` | PASS 10/10, exit 0 | PASS |
| F.1 chrome unit | `node tests/test-357-f1-chrome.cjs` | PASS 12/12, exit 0 | PASS |
| Full 238 suite (context check) | `bash tests/run-all-238.sh` | PASS=9 FAIL=1 (238-03, pre-existing red per task instructions); the 357 replay leg within this run: PASS 12/12 | PASS (357 scope), pre-existing red unaffected |

### Requirements Coverage

Source: `.planning/REQUIREMENTS.md` GATE357-01..09 (all declared in the Phase 357 plan set).

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GATE357-01 | 357-01, 357-05, 357-06 | Versioned 4-source replay corpus, >=45 entries | SATISFIED | 60 entries confirmed in independent replay run; loader test 14/14. |
| GATE357-02 | 357-02, 357-05, 357-09 | Replay harness, no mocks, no network, exits non-zero on failure | SATISFIED | `--code-root pre-phase` reproduces FALSE_BLOCK; `test-357-replay.cjs` PASS 12/12 within run-all-238; exit codes confirmed. |
| GATE357-03 | 357-03, 357-04, 357-08 | Dev-time Jev labeler, refuses dogfood, keyless exit 0, hooks tripwire | SATISFIED | `test-357-labeler-refusal.cjs` PASS=83; tripwire PASS=5; grep empty. |
| GATE357-04 | 357-07, 357-09 | Harness-record classification fix (D-07/R-A) | SATISFIED | `HARNESS_LEADS`, `classifyPrecedingUserContentSource` R-A rules confirmed in code; mutation M1 proves it's load-bearing; `test-357-harness-source.cjs` PASS 10/10. |
| GATE357-05 | 357-07, 357-09 | F.1 dial chrome strip (D-08a/R-F) | SATISFIED | `F1_DIAL_CHROME_TOKENS` confirmed; mutation M2 proves load-bearing; `test-357-f1-chrome.cjs` PASS 12/12. |
| GATE357-06 | 357-02, 357-09 | CLI/MCP verdict parity, hermetic | SATISFIED | `parity_mismatches:0` across 60 entries; `mcp.room_dir:null` on every entry. |
| GATE357-07 | 357-10 | Larry prose shrink, metric-gated | SATISFIED | 856 B combined (61.6% cut), regression tests green, manifest OK. |
| GATE357-08 | 357-01, 357-09 | Standing regression gate, mutation-provable | SATISFIED | Mutation legs PASS 3/3; run-all-357 and run-all-238 both carry the leg. |
| GATE357-09 | 357-06, 357-08 | Dogfood extraction, sanitization, human ratification | SATISFIED | `dogfood.json`: 24/24 entries `label_origin: human`, `meta.ratified_at: 2026-09-23`; R-C case (`dogfood-0f86dd63-092046`) correctly ruled `known_false_block` with a text-dependence reason. |

No orphaned requirements found (all GATE357-01..09 declared across plans 357-01..357-10 and checked off in REQUIREMENTS.md with matching evidence).

### Anti-Patterns Found

None blocking. Scanned the phase's touched source files (`scripts/replay-card-fire.cjs`,
`scripts/label-card-fire-replay.cjs`, `scripts/extract-dogfood-stop-events.cjs`,
`lib/hmi/turn-text.cjs`, `lib/core/gate-relevance.cjs`, `scripts/check-card-fire.cjs`) for
em-dashes, `TBD`/`FIXME`/`XXX` debt markers: zero matches in all files. No stub patterns
(`return null`/empty-array short-circuits feeding rendered output) found in the fix code; both
fixes (`'harness'` classification, `F1_DIAL_CHROME_TOKENS`) are proven load-bearing by the
mutation tests, which is the strongest available evidence against a shim/stub implementation.

The 13 Jev/hand-label disagreements listed in `357-JEV-LABEL-REPORT.md` (mostly Jev
under-reading the deterministic ASCII-box-backstop rule as `pass` when hand labels say `block`)
are correctly surfaced and never auto-applied - `git diff` on `debug-cases.json` and
`live-2026-09-23.json` is empty, confirming the hand labels were not silently overwritten. This
is the SPEC-intended behavior (Jev is a dev-time teacher, not a runtime or corpus-editing
authority), not a defect.

### Human Verification Required

None. The phase's single human checkpoint (D-06: navigator ratification of dogfood labels,
including the R-C 09:20 case) was already completed during execution - confirmed by
`dogfood.json` showing 24/24 entries at `label_origin: human` with `meta.ratified_at:
2026-09-23`, and the R-C case correctly recorded as `known_false_block`. No further human
action is required to declare the phase goal achieved.

### Gaps Summary

None. All 10 SPEC acceptance criteria and all 9 GATE357 requirements were independently
re-verified in this session by re-running the exact commands specified in the verification task
(not by trusting SUMMARY.md's reported output). Every command's actual output matched or
exceeded the claimed proof in REQUIREMENTS.md and the SUMMARY files. The two runtime fixes
(D-07/R-A harness classification, D-08a/R-F F.1 chrome strip) are proven load-bearing via
passing mutation tests, not merely present in the diff. The only test failure observed
(`run-all-238.sh` leg 238-03) is the documented pre-existing red named in the verification task
itself and is unrelated to Phase 357's changes. Phase 354 file boundaries (D-15) were respected:
`git diff` from the pre-phase sha touches none of `brain-router.cjs`, `write-lock.cjs`,
`part8-egress-guard.cjs`, `doctor.cjs`, or `graph-ops.cjs`.

Per the repo's release rule, this work is complete on `main` but not yet live for end users
until the next `scripts/release.sh` cut - this is expected and not a phase gap.

---

*Verified: 2026-09-23T19:54:51Z*
*Verifier: Claude (gsd-verifier)*
