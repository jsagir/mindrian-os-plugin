VERDICT: STILL_FALSE_BLOCKS
REPLAY_SHA: 0892259bad9661337565ca1ac194794c86b8af07

# Phase 362 - post-359 replay of dogfood-0f86dd63-092046 (D-01 AMENDED gate, D-02 first step)

Recorded: 2026-09-29. Plan 362-01. Zero network (the 357 harness fetch thrower and per-entry hermetic env; `TYPESAFE_API_KEY` unset on every run).

## Execution gate (D-01)

- Checked paths (the D-01 AMENDED list, exactly these three): `lib/core/gate-relevance.cjs`, `scripts/check-card-fire.cjs`, `tests/test-359-inertness.cjs`.
- `git status --short -- lib/core/gate-relevance.cjs scripts/check-card-fire.cjs tests/test-359-inertness.cjs` printed nothing (the whole tree was clean at gate time).
- `GATE ok clean: lib/core/gate-relevance.cjs scripts/check-card-fire.cjs tests/test-359-inertness.cjs`
- `GATE_HEAD 0892259bad9661337565ca1ac194794c86b8af07`
- The wait on Phase 359 plans 07-10 was dropped by the navigator on planning evidence (362-CONTEXT.md D-01 AMENDED): those plans touch neither gate runtime file, and the 359-03 declared-fork rewiring is already on main.

## Entry replay (D-02)

Command: `env -u TYPESAFE_API_KEY node scripts/replay-card-fire.cjs --surface both --only dogfood-0f86dd63-092046 --json` - exit 0.

| Field | At REPLAY_SHA | pre-359.json row (pre_359_sha 2797903a005b7e0500b74c0af70ea86f6f7958fc) |
|-------|---------------|---------------------------------------------------------------------------|
| cli class | block | block |
| cli reason | reached-registry-gate-no-card | reached-registry-gate-no-card |
| mcp class | block | block |
| outcome | KNOWN_FALSE_BLOCK | - |
| baseline class | block | - |
| preceding_user_text_source | typed | - |
| preceding_user_is_meta | false | - |

The verdict is unchanged from the pre-359 snapshot on both surfaces.

## Full corpus at REPLAY_SHA

Command: `env -u TYPESAFE_API_KEY node scripts/replay-card-fire.cjs --surface both --baseline compare --json` - exit 0.

Counts: `{"entries":60,"evaluated":60,"false_blocks":0,"missed_forks":0,"known_misses":1,"known_false_blocks":1,"new_misses":0,"excluded_partial":0,"parity_mismatches":0,"errors":0,"unmarked_misses":0}`.

Entries whose cli class is block (13):

- `238:genuine-multiline-bracket-box:s2`
- `238:genuine-multiline-bracket-box:s3`
- `238:genuine-bulleted-bracket-box:s2`
- `238:genuine-bulleted-bracket-box:s3`
- `238:type-1-2-or-3-literal:s2`
- `238:type-1-2-or-3-literal:s3`
- `238:reconstructed-two-honest-paths-fork:s2`
- `238:reconstructed-two-honest-paths-fork:s3`
- `debug-intern-w1-labeled-fork`
- `debug-reach-gate-stale-turn-input`
- `debug-carveout-skill-meta-after-human`
- `debug-carveout-image-meta-after-human`
- `dogfood-0f86dd63-092046` (the target)

## Structural facts of the entry

Measured with `lib/core/gate-relevance.cjs` over the committed, sanitized fixture only (the R-D raw snapshot was not opened).

- Final human-typed record: origin `human`, the only string-content user record. `subjectTokens`: `prior`, `governance`, `thread`, `open` (4 tokens, above MIN_USER_SUBJECT_TOKENS = 2, so the low-signal branch does not apply).
- Reach subject raw subject tokens: `investigate`, `prior`, `reach`, `governance`, `thread`, `flagged`, `pass`, `blend`, `insight`, `options`, `follow`.
- `gateSubjectTokens` after the D-08a strip: `governance`, `thread`, `flagged`, `pass`, `options`, `follow` (`investigate`, `prior`, `reach`, `blend`, `insight` are F.1 chrome).
- Overlap under the prefix-stem rule of `gateTopicallyRelevant`: `governance`, `thread` (2 tokens).
- Reach records: 1; entry `scripts/intent-classifier.cjs`, shape `F.1`, age_ms 14907 (fresh: TURN_FRESH_MS is 120000). The subject is one prose line with no dial layout (no header, context, prompt or row lines).
- Assistant records in the transcript: 0 (Part 8 sanitization), so there is no `Your call:` declaration and the 359 declared arm cannot own this entry.
- Records carrying a timestamp: 0 (turn distance is not measurable on the fixture).
- `preceding_user_text_source` reported by the replay: `typed`.
- Note: the measured overlap is two content tokens (`governance` and `thread`), not the single content token (`governance`) the 357 R-C reason names; `prior` is chrome and is stripped by D-08a.

## Standing tests

- `node tests/test-357-replay.cjs` - exit 0, `PASS 12/12` (last leg: `L7: the standing bar (HEAD, both surfaces, --baseline compare) is green`).
- `node tests/test-359-inertness.cjs` - exit 0, `Passed: 4 / 4`.
- `node tests/test-359-replay.cjs` - SKIPPED: not on main at GATE_HEAD (arrives with 359-07; D-01 AMENDED).

## Reading

On post-359 code the target still blocks on both the CLI Stop hook and the MCP stop_gate_check, with the same reason it had before 359, so Phase 359 did not resolve it. This agrees with 359's own inertness gate, which passes and pins this entry's verdict unchanged. The phase therefore continues to 362-02: measure the D-03 structured-signal candidates against the replay corpus and either land the smallest one that clears the target with zero new misses, or keep the entry as a residual known_false_block with that measurement as its evidence. The full corpus is green at the 357 bar (false_blocks 0, new_misses 0, parity_mismatches 0), and the only blocking entries besides the target are the 12 anti-vacuity fires that 362-02 must keep blocking. 362-03 reads line 1 of this file to derive the phase outcome.
