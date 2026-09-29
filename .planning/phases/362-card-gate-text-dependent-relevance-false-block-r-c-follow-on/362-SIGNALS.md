SIGNAL: NONE
PRE362: 00fb9599f81ebf34a253e206e322410c2985437b

# Phase 362 - structured-signal measurement for dogfood-0f86dd63-092046 (D-03, D-04, CARD362-03)

Recorded: 2026-09-29, plan 362-02 Task 1. Produced by `node scripts/measure-relevance-signals-362.cjs --json` (exit 0) and its table form. Zero network (fetch thrower for the whole run), committed sanitized fixtures only. The script replays every corpus entry once on the CLI surface through the real harness, captures the exact turn object `classifyCardFire` classified, then re-classifies every captured turn under each variant with the real `classifyCardFire`. A BASE variant (a restatement of today's `gateTopicallyRelevant`) reproduced all 60 HEAD verdicts exactly before any candidate was scored. The CLI Stop hook and the MCP stop_gate_check share the predicate, so a variant's verdict holds on both surfaces.

HEAD counts at PRE362 (`--surface both`): entries 60, false_blocks 0, new_misses 0, parity_mismatches 0, known_false_blocks 1, known_misses 1, unmarked_misses 0, errors 0.

## Population and features

Population: the target plus every entry whose HEAD cli class is block (the 12 anti-vacuity ids). Gate tokens are `gateSubjectTokens` output (after the F.8 boilerplate and D-08a F.1 chrome strip); overlap uses the same prefix-stem rule as `gateTopicallyRelevant`. Provenance `unstructured` means the subject has none of the dial layout lines (header, context, prompt, reach row), so a token cannot be attributed to a layout part.

| id | expected | HEAD cli reason | mode | source | human | user tokens | gate tokens | overlap (provenance) | reach (shape, age ms, fresh) | ts records | assistant | fork_declared |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 238:genuine-multiline-bracket-box:s2 | block | ascii-box-backstop-no-card | direct | none | false | 0 | path, forward, rebuild, sample, library, index, scratch, patch, changed, project, entries | none | none | 0 | 0 | false |
| 238:genuine-multiline-bracket-box:s3 | block | ascii-box-backstop-no-card | direct | none | false | 0 | path, forward, rebuild, sample, library, index, scratch, patch, changed, project, entries | none | none | 0 | 0 | false |
| 238:genuine-bulleted-bracket-box:s2 | block | ascii-box-backstop-no-card | direct | none | false | 0 | ship, sample, library, patch, today, wait, project, review, first | none | none | 0 | 0 | false |
| 238:genuine-bulleted-bracket-box:s3 | block | ascii-box-backstop-no-card | direct | none | false | 0 | ship, sample, library, patch, today, wait, project, review, first | none | none | 0 | 0 | false |
| 238:type-1-2-or-3-literal:s2 | block | ascii-box-backstop-no-card | direct | none | false | 0 | type, proceed, sample, project, migration | none | none | 0 | 0 | false |
| 238:type-1-2-or-3-literal:s3 | block | ascii-box-backstop-no-card | direct | none | false | 0 | type, proceed, sample, project, migration | none | none | 0 | 0 | false |
| 238:reconstructed-two-honest-paths-fork:s2 | block | ascii-box-backstop-no-card | direct | none | false | 0 | honest, paths, build, sample, library, indexing, file, finding, revisit, once, project, data, available | none | none | 0 | 0 | false |
| 238:reconstructed-two-honest-paths-fork:s3 | block | ascii-box-backstop-no-card | direct | none | false | 0 | honest, paths, build, sample, library, indexing, file, finding, revisit, once, project, data, available | none | none | 0 | 0 | false |
| debug-intern-w1-labeled-fork | block | ascii-box-backstop-no-card | direct | none | false | 0 | honest, paths, research, first, build, plan | none | none | 0 | 0 | false |
| debug-reach-gate-stale-turn-input | block | reached-registry-gate-no-card | transcript+sidechannel | typed | true | 1 (ignite) | engine, review, sample, project, status, choosing | none | F.1, 10000, true | 0 | 1 | false |
| debug-carveout-skill-meta-after-human | block | reached-registry-gate-no-card | transcript+sidechannel | typed | false | 10 (base, directory, skill, workspace, tools, migration, helper, scripts, live, reference) | engine, review, sample, project, migration, checklist | migration:unstructured | F.1, 30000, true | 0 | 1 | false |
| debug-carveout-image-meta-after-human | block | reached-registry-gate-no-card | transcript+sidechannel | typed | false | 1 (image) | engine, review, sample, project, migration, checklist | none | F.1, 30000, true | 0 | 1 | false |
| dogfood-0f86dd63-092046 | pass | reached-registry-gate-no-card | transcript+sidechannel | typed | true | 4 (prior, governance, thread, open) | governance, thread, flagged, pass, options, follow | governance:unstructured, thread:unstructured | F.1, 14907, true | 0 | 0 | false |

The 9 BACKSTOP entries reach relevance with empty preceding text (source `none`, 0 user tokens), so the low-signal branch decides them before any gate token is read. Their gate tokens are listed for completeness only.

## Candidates

Viable = clears the target, zero new misses among the 12 anti-vacuity ids, monotone (no HEAD pass entry anywhere in the 60-entry corpus turns into a block), and no other verdict change. "BACKSTOP 9" below means all nine `238:*:s2`/`238:*:s3` and `debug-intern-w1-labeled-fork` ids.

| Variant | Rule | Clears target | New misses | Monotone | Runtime files | Reason |
|---|---|---|---|---|---|---|
| C1a:min=2 | low-signal threshold MIN_USER_SUBJECT_TOKENS=2, fresh-gate floor kept (today) | false | 0 | true | lib/core/gate-relevance.cjs | target still blocks |
| C1a:min=3 | threshold 3, fresh-gate floor kept | false | 0 | true | lib/core/gate-relevance.cjs | target still blocks |
| C1a:min=4 | threshold 4, fresh-gate floor kept | false | 0 | true | lib/core/gate-relevance.cjs | target still blocks |
| C1a:min=5 | threshold 5, fresh-gate floor kept | false | 0 | true | lib/core/gate-relevance.cjs | target still blocks: its 4 tokens become low-signal, and a low-signal turn against a FRESH gate (14907 ms) stays relevant |
| C1a:min=6 | threshold 6, fresh-gate floor kept | false | 0 | false | lib/core/gate-relevance.cjs | target still blocks; not monotone: live-2026-09-23-02 turns from pass to block |
| C1b:min=2 | threshold 2 and a low-signal turn passes even against a FRESH gate (WR-06 floor removed) | false | 11: BACKSTOP 9, debug-reach-gate-stale-turn-input, debug-carveout-image-meta-after-human | true | lib/core/gate-relevance.cjs | target still blocks (4 tokens is not low-signal at 2); every 0- and 1-token fork loses its card |
| C1b:min=3 | threshold 3, WR-06 floor removed | false | 11: BACKSTOP 9, debug-reach-gate-stale-turn-input, debug-carveout-image-meta-after-human | true | lib/core/gate-relevance.cjs | target still blocks; same 11 new misses |
| C1b:min=4 | threshold 4, WR-06 floor removed | false | 11: BACKSTOP 9, debug-reach-gate-stale-turn-input, debug-carveout-image-meta-after-human | true | lib/core/gate-relevance.cjs | target still blocks; same 11 new misses |
| C1b:min=5 | threshold 5, WR-06 floor removed | true | 11: BACKSTOP 9, debug-reach-gate-stale-turn-input, debug-carveout-image-meta-after-human | true | lib/core/gate-relevance.cjs | clears the target only by removing the WR-06 floor, which silences 11 genuine forks |
| C1b:min=6 | threshold 6, WR-06 floor removed | true | 11: BACKSTOP 9, debug-reach-gate-stale-turn-input, debug-carveout-image-meta-after-human | true | lib/core/gate-relevance.cjs | same as min=5 |
| C2a:T=10000 | reach older than 10000 ms is stale, today stale semantics (only a low-signal turn passes) | false | debug-carveout-image-meta-after-human | true | lib/core/gate-relevance.cjs, scripts/check-card-fire.cjs | target still blocks (4 tokens, not low-signal); the 1-token image turn at 30000 ms loses its card |
| C2a:T=14907 | same, T=14907 | false | debug-carveout-image-meta-after-human | true | lib/core/gate-relevance.cjs, scripts/check-card-fire.cjs | target still blocks; same new miss |
| C2a:T=30000 | same, T=30000 | false | 0 | true | lib/core/gate-relevance.cjs, scripts/check-card-fire.cjs | target still blocks |
| C2a:T=120000 | same, T=TURN_FRESH_MS (today) | false | 0 | true | lib/core/gate-relevance.cjs, scripts/check-card-fire.cjs | target still blocks |
| C2b:T=10000 | reach older than 10000 ms is stale and a stale reach passes whatever the overlap | true | debug-carveout-skill-meta-after-human, debug-carveout-image-meta-after-human | true | lib/core/gate-relevance.cjs, scripts/check-card-fire.cjs | clears the target (14907 > 10000) but both 30000 ms forks lose their card |
| C2b:T=14907 | same, T=14907 | false | debug-carveout-skill-meta-after-human, debug-carveout-image-meta-after-human | true | lib/core/gate-relevance.cjs, scripts/check-card-fire.cjs | target not older than T; the two 30000 ms forks still lose their card |
| C2b:T=30000 | same, T=30000 | false | 0 | true | lib/core/gate-relevance.cjs, scripts/check-card-fire.cjs | target still blocks |
| C2b:T=120000 | same, T=120000 | false | 0 | true | lib/core/gate-relevance.cjs, scripts/check-card-fire.cjs | target still blocks |
| C2c | consumption state and turn distance since the reach was minted | n/a | 0 | n/a | lib/core/gate-relevance.cjs, scripts/check-card-fire.cjs, lib/hmi/turn-text.cjs | not measurable on the ratified fixture: 0 transcript records carry a timestamp (turn distance unknown) and every replayed reach is seeded fresh and unconsumed, so no entry carries a consumption state to test |
| C3a | when the subject carries reach rows, only reach-row tokens count; otherwise today tokens | false | 0 | true | lib/core/gate-relevance.cjs | target still blocks: its reach subject has no rows, so the rule falls back to today's tokens |
| C3b | strip dial-presenter static template tokens not yet in F1_DIAL_CHROME_TOKENS | false | 0 | true | lib/core/gate-relevance.cjs, tests/test-357-f1-chrome.cjs | target still blocks: no new token is derivable (see C3b literals below), and the overlap tokens `governance`, `thread` are not dial literals |
| C3c | strip header, context and prompt line tokens when the subject carries the dial layout | false | 0 | true | lib/core/gate-relevance.cjs | target still blocks: its subject carries no dial layout |
| C4a | when fork_declared is true, relevance is measured against the declared labels | false | 0 | true | lib/core/gate-relevance.cjs, scripts/check-card-fire.cjs | target still blocks: 0 assistant records, so fork_declared is false |
| C4b | a PRIMARY hit with no declared or extracted labels passes | true | debug-reach-gate-stale-turn-input, debug-carveout-skill-meta-after-human, debug-carveout-image-meta-after-human | true | lib/core/gate-relevance.cjs, scripts/check-card-fire.cjs | rejected by construction: the 357 D-08 forbidden rule; it passes a PRIMARY hit on the absence of labels alone and silences all three PRIMARY anti-vacuity forks |

C3b literals checked: the dial-presenter literals that reach the rendered F.1 text and are not in the 357 DIAL_STATIC_LITERALS list are `Investigate | Blend | >Insight<`, `Investigate | >Blend< | Insight`, `top-` and ` of `. They derive no new subject token (the gauge words are already chrome; `top` and `of` are under the 4-character floor). The MODIFIER_ITEMS labels ride the AskUserQuestion contract only, never the rendered text, so they are excluded.

Never evaluated, because they read meaning (D-03, 362-CONTEXT Deferred Ideas): user-side word or phrase lists (continuity cues), punctuation or question-shape tests, semantic similarity, any Jev or network call.

## Selection

No variant is viable, so the verdict is `SIGNAL: NONE`. The target's human turn carries 4 subject tokens and overlaps a fresh (14907 ms) label-free F.1 reach on two content tokens, `governance` and `thread`, that come from the reach's unstructured prose, not from any dial chrome, so no provenance rule (C3a, C3b, C3c) can strip them. Every variant that does clear the target does it by removing a floor that real forks depend on: C1b removes the WR-06 fresh-gate floor and silences 11 of the 12 anti-vacuity forks, C2b:T=10000 silences the two 30000 ms PRIMARY forks (`debug-carveout-skill-meta-after-human` overlaps its reach on one content token, `migration`, which is the same structural shape as the target), and C4b is the forbidden label-absence rule. C2c (consumption and turn distance) cannot be measured on the fixture, and C4a cannot apply because the sanitized transcript has no assistant record to declare a fork. What separates the target from `debug-carveout-skill-meta-after-human` is whether the overlapping words mean engagement with the pending reach, which is text-dependent: this is a residual known_false_block under D-04.

## Regression baseline at PRE362

Each suite run at PRE362 (00fb9599f), final summary line and exit code:

- `node tests/test-209-primary-sidechannel.cjs` - exit 0, `PASS test-209-primary-sidechannel (36 assertions)`
- `node tests/test-238-card-fire-corpus.cjs` - exit 0, `PASS test-238-card-fire-corpus (32 assertions)`
- `node tests/test-198-stop-gate-retry-ceiling.test.cjs` - exit 0, `PASS test-198-stop-gate-retry-ceiling (15 assertions)`
- `node tests/test-357-f1-chrome.cjs` - exit 0, `PASS test-357-f1-chrome (12 assertions, 0 failed)`
- `node tests/test-357-harness-source.cjs` - exit 0, `PASS test-357-harness-source (11 assertions, 0 failed)`
- `node tests/test-357-corpus-loader.cjs --dogfood-strict` - exit 0, `PASS test-357-corpus-loader (14 legs)`
- `node tests/test-357-replay.cjs` - exit 0, `PASS 12/12`
- `node tests/test-357-replay.cjs --mutation` - exit 0, `PASS 3/3`
- `node tests/test-359-inertness.cjs` - exit 0, `Passed: 4 / 4`
- `node tests/test-359-declared-arm.cjs` - exit 0, `Passed: 20 / 20`
- `node tests/test-359-declared-arm.cjs --tripwires` - exit 0, `Passed: 4 / 4`
- `node tests/test-359-replay.cjs` - SKIPPED: not on main at PRE362
- `node tests/test-359-replay.cjs --mutation` - SKIPPED: not on main at PRE362

R-J pre-existing reds (the no-new-red reference; never fixed here):

- `node tests/test-card-fire-relevance-gate.cjs` - exit 1, `6 passed, 5 failed` (its own line: softened-direction RED legs are EXPECTED until plan 210-05 lands)
- `node tests/test-ga4-card-fire-e2e-179.cjs` - exit 1, 2 ok then aborts on the 3rd assertion, `(E2E-1) the envelope BLOCKS (decision:block) -- the LIVE cure, no longer a no-op` (AssertionError, actual false)

No red outside the R-J pair.

## What the fixture cannot show

- No transcript record carries a timestamp, so turn distance since the reach was minted is not measurable (C2c).
- Every replayed reach is seeded fresh and unconsumed per entry, so consumption state is not measurable either (C2c).
- The sanitized reach subject is one prose line without the dial layout (no header, context, prompt or row lines), so the provenance family cannot see the rendered dial a live F.1 reach would carry.
- The transcript has no assistant record (Part 8 sanitization), so there is no `Your call:` declaration for the 359 declared arm or C4a to read.
- The measured overlap is two content tokens (`governance`, `thread`), not the single token (`governance`) the 357 R-C reason names; `prior` is F.1 chrome and is stripped by D-08a.
