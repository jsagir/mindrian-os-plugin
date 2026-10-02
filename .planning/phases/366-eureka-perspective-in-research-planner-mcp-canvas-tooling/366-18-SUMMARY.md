---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 18
subsystem: spike-harness
tags: [spike, wilson, bar, pre-registration, blind-label, jev, claude-arm, vector-lane, record-check]
requires:
  - 366-01 (spike-366-prepare, guardSpikePath, fixture-366 helper, run-all-366 record leg)
  - 366-08 (perspective interface, shared exclusion upsert, eureka golden)
  - 366-13 (rs and hsi graph recall modules)
provides:
  - tests/fixtures/366-spike/bar.json (the pre-registered bar, committed before any harness code)
  - tests/fixtures/366-spike/claude-judge-prompt.md (the fixed Claude arm instruction)
  - scripts/spike-366.cjs (recall, items, judge, record, --check)
  - eureka-recall opts.extraLanes seam (the vector arm lane)
  - scripts/eureka-jev-judge.cjs fix (answers parse again, replay keys are per pair)
affects: [366-19 (runs the arms and the navigator sitting), 366-20 (the ruling), 366-24 style re-measurements]
tech-stack:
  added: []
  patterns:
    - bar committed first, harness second (git order is the proof)
    - record freezes its inputs, then recomputes byte for byte from the frozen files only
    - judge arms always run over a derived run folder inside a contained room copy
key-files:
  created:
    - tests/fixtures/366-spike/bar.json
    - tests/fixtures/366-spike/claude-judge-prompt.md
    - scripts/spike-366.cjs
    - tests/test-366-spike-harness.cjs
  modified:
    - lib/core/research-planner/perspectives/eureka-recall.cjs
    - scripts/eureka-jev-judge.cjs
decisions:
  - "Labels attach to pair_id (the 355 pairId over room and the two room-relative .md paths), so the four judge arms share one sitting per recall arm's items file; each judge arm's useful rate is the gold-useful share among the pairs it passes"
  - "A judge arm 'passes' a pair as follows: stage-a = Stage A gate passes; jev = Jev choice useful (Stage A runs first inside the judge); claude = verdict useful over every pair; claude-then-jev = Jev choice useful over Claude's useful subset only"
  - "record is two steps in one command: it freezes the arm files into tests/fixtures/366-spike/arms/ and writes record.json from the frozen files plus tests/fixtures/366-spike/gold/<arm>.json; --check never needs the temp root"
  - "Gold is bound to its items file by fixture_sha256 (label-355-gold emit hashes the items bytes), and record refuses a gold file whose hash does not match the frozen items"
  - "The vector arm never downloads: it checks the local model cache first and exits 77 (ENV GAP) when none is cached"
  - "The record never carries an adoption: adoption.decision is null and the statement names the 44.8% as the RS/HSI engine-output baseline"
metrics:
  tasks: 2
  files: 6
  completed: 2026-10-02
---

# Phase 366 Plan 18: Spike harness and pre-registered bar Summary

The bar is fixed in git (adopt an arm only if its Wilson 95% lower bound exceeds 0.448 on each of three repeats) before any harness code or arm output exists, and `scripts/spike-366.cjs` can run every recall arm and judge arm, convert candidates to the 355 blind-label shape, and recompute its record byte for byte. Nothing was run against gold and no arm was adopted.

## Commits

| Order | Commit | Message |
|-------|--------|---------|
| 1 | fb8563bf6 | test(366-18): pre-register the spike bar and the Claude judge prompt |
| 2 | 5c9d633c7 | test(366-18): add failing test for the spike harness (S1-S7) |
| 3 | 8334c9e9b | fix(366-18): eureka-jev-judge parses answers and keys replays per pair |
| 4 | 3f9a1145e | feat(366-18): spike harness (recall, items, judge, record, --check) and the eureka extraLanes seam |

`git log --format=%H -- tests/fixtures/366-spike/bar.json` shows fb8563bf6, older than 3f9a1145e, the first commit touching `scripts/spike-366.cjs`.

## What was built

- **bar.json** (`mos.spike-366-bar/1`): baseline 43 of 96 (rate 0.448, Wilson 0.352 to 0.547, slices 47 HSI and 49 RS, source 355-VERIFICATION.md, the engine-output note), the rule, 3 repeats, per-room cap 32, `min_useful_at_n` {30: 19, 50: 30, 96: 53, 150: 80, 200: 104}, the four recall and four judge arms, `out_of_scope` (Q2 and Q4). Beyond the plan's fields it also pre-registers the definitions (what "passes" means per judge arm, that recall repeats are identical runs, the slice rule) and the vector lane parameters (local embeddings, cross-section cosine, top-k 5, no floor). The minimums were verified with the repo's `wilson95`; the command is under Verification.
- **claude-judge-prompt.md**: the whole instruction for the Claude Code subagent arm. It reads one items file inside the spike temp root, may not read gold or another arm's output, applies the same rule as the Jev usefulness profile (already_known, useful, not_useful, none) and writes one JSONL verdict per pair.
- **scripts/spike-366.cjs**: `recall --arm <4 arms>`, `items`, `judge --arm <4 judge arms> --recall-arm --repeat 1..3 [--verdicts p] [--replay]`, `record [--root]`, `--check [--root]`. Requires `wilson95`, `buildExcerpt`, `pairId`, `directionPhraseFor` from `measure-355-hit-rate.cjs` (no `1.959963985` anywhere). Every path argument goes through `guardSpikePath` bound to the manifest's temp root (the manifest itself under `os.tmpdir()`, rooms inside the root and never inside `tests/fixtures/355-rooms`). Exit codes: 0 ok, 1 failed, 2 refused, 3 invalid verdicts, 77 ENV GAP.
  - Items: `{pair_id, room, producer, a_excerpt, b_excerpt, direction_phrase, a_path, b_path}`; paths and excerpts come from the same markdown the 355 engines read (`rs-engine.discoverArtifacts`), falling back to room.db node text for non-file rooms; the direction phrase is the graph phrase table or `directionPhraseFor(null)`. A sidecar `pairs.json` joins pair_id back to the candidate ids and is never shown.
  - Judge: Stage A goes through `judgeCandidates` with the perspective module; Claude imports a verdicts file only from inside the root and rejects missing, extra, repeated or out-of-vocabulary rows (exit 3); Jev and claude-then-jev run `scripts/eureka-jev-judge.cjs` as a child over a derived run folder (`spike-jev-*` or `spike-cj-*`) written inside the contained copy, with Claude's useful subset only for claude-then-jev. The harness never reads or prints a key.
  - Cost per arm: wall ms, CPU ms (user and system), peak RSS KB, vendor call count, Jev input tokens, dollars null (Jev reports none). Counts only.
  - Record: per recall arm shown, useful, rate, Wilson 95%, clears_bar, `n_below_baseline_n`, `needs_useful_to_clear_at_this_n`, three identical repeats, per-room split, recall counts, cost; `vs_slice` for rs-graph (RS slice 16 of 49) and hsi-graph (HSI slice 27 of 47); per judge arm the repeats recorded against 3 required and `clears_bar_all_repeats`. Slice figures are recomputed from the committed 355 `pairings.items.json` and `judgments.json` (pool 43 of 96). The record carries the bar's baseline note verbatim and a fixed statement that the 44.8% is the RS/HSI engine-output baseline.
- **eureka-recall `opts.extraLanes`**: synchronous lane functions `(substrate) -> [{a, b, lane, score?}]` go through the same exclusion-set upsert and the same cap; each lane is counted in `counts[lane]`; junk proposals are ignored; a lane that throws throws. With no extraLanes the output equals the 366-08 golden. The vector arm builds its proposals ahead of time (`buildVectorLane`: local embeddings through `embedTexts`, cross-section cosine, top-k per thing) because `recallCandidates` is synchronous.
- **scripts/eureka-jev-judge.cjs**: two latent bugs fixed (see Deviations).

## Verification

- `node tests/test-366-spike-harness.cjs`: PASS 55, FAIL 0 (legs S1 to S7 plus static and hygiene checks)
- `node tests/test-366-perspective-interface.cjs`: PASS 17, FAIL 0 (eureka golden unchanged)
- `node tests/test-seed103-eureka-perspective.cjs`: PASS 39, FAIL 0; `bash tests/run-all-seed103.sh`: PASSED=20 FAILED=0
- `node tests/test-353-tripwires.cjs`: PASS=5 FAIL=0 (no Jev client under lib/ or hooks/)
- `bash tests/run-all-366.sh`: PASSED=60 FAILED=0 SKIPPED=8 KNOWN=1 (the spike record leg is SKIPPED until a record.json exists)
- Bar minimums, from the plan: `node -e "const b=require('./tests/fixtures/366-spike/bar.json'); const w=require('./scripts/measure-355-hit-rate.cjs').wilson95; for (const [n,k] of Object.entries(b.min_useful_at_n)) { if (!(w(k,+n)[0] > 0.448 && w(k-1,+n)[0] <= 0.448)) { console.error('bad', n, k); process.exit(1); } } console.log('ok')"` prints ok. Lower bounds: n=30 k=19 0.4551, n=50 k=30 0.4618, n=96 k=53 0.4525, n=150 k=80 0.4537, n=200 k=104 0.4510.
- Acceptance greps: `grep -c "Eureka improved" bar.json` 0; harness requires measure-355-hit-rate and has no `1.959963985`; no em-dash or en-dash in any touched file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] eureka-jev-judge parsed every answer as unusable**
- **Found during:** Task 2, S3 replay leg (claude-then-jev passed 0 of 1 on a recorded useful answer)
- **Issue:** `parseJevResponse(res, { questionIds: ['usefulness'] })` passes the wrong shape; the schema expects `{ questionId: [options] }`, so it read the question id as `questionIds` and returned "missing choice answer questionIds" for every response. Every live and replayed Jev verdict would have been null: the Jev arm and claude-then-jev would have measured zero useful, silently.
- **Fix:** `parseJevResponse(res, { usefulness: Object.keys(Q.USEFULNESS_QUESTIONS.usefulness.criteria) })`.
- **Files modified:** scripts/eureka-jev-judge.cjs
- **Commit:** 8334c9e9b

**2. [Rule 1 - Bug] eureka-jev-judge replay key collapsed every pair onto one key**
- **Found during:** Task 2, same leg
- **Issue:** `canonicalKey` used `JSON.stringify(body, Object.keys(body).sort())`; an array replacer whitelists keys at every depth, so `state` and `questions` serialized as `{}` and all pairs shared one key. Replay returned one answer for every pair, and a recorded `jev-responses.json` would hold only the last response.
- **Fix:** a stable stringify (keys sorted at every depth). No recorded response file was committed anywhere, so nothing is invalidated. S3 now seeds one response per pair and proves an unrecorded pair stays unjudged.
- **Files modified:** scripts/eureka-jev-judge.cjs
- **Commit:** 8334c9e9b

**3. [Rule 2 - Missing detail] vector score breaks ties in the eureka sort**
- **Issue:** the plan said cap and sort stay unchanged. With the sort untouched, vector-only rows (lexical 0) would be ordered by id and truncated arbitrarily at the cap, which would make the vector arm unfair.
- **Fix:** one comparator term after `lexical`: `(y.vector || 0) - (x.vector || 0)`. A row with no vector field contributes 0, so the default output is byte-identical (golden green).
- **Commit:** 3f9a1145e

**4. [Plan addition] bar.json carries extra pre-registered fields**
- `definitions` (what "passes" means per judge arm, repeats, comparability, slice rule) and `vector_lane` were added to the committed bar so they are fixed before any run, not chosen after.
- **Commit:** fb8563bf6

**5. [Process] An exploratory recall probe ran before the harness existed**
- To learn node ids, paths and candidate shapes I ran `prepare` into the session scratch directory and ran eureka, rs and hsi recall over those temp copies (cap 32) once. No gold exists, nothing from it is committed or recorded, and no vendor token was spent. It is not a spike run. It did surface the fixture sizes recorded under Findings.

**6. [Process] TDD detail for Task 2**
- The harness was drafted before the test was committed; RED was demonstrated by moving `scripts/spike-366.cjs` aside and running the test (MODULE_NOT_FOUND), then committing the test alone (5c9d633c7) ahead of the feat commit. The bar commit (Task 1) preceded both. Test fixes after the first green-bar run (S1 and S7 pair ordering, S3 replay keys) were test bugs plus the real Jev bugs above.

## Findings for 366-19 and 366-20

- **The fixtures are small, so n is far below 96.** The exploratory probe at cap 32 gave eureka 7 candidates (5, 1, 1), hsi 7 (5, 1, 1) and rs 0 (the fixtures carry no INFORMS-style flow edges and no CONTEXT.md `## Inputs`, so there are no flow edges and no declared feeds). The vector arm can add up to top-5 cross-section pairs per thing. At n = 7, 7 of 7 useful has Wilson lower bound 0.646, which "clears" 0.448; the bar rule is unchanged, so the record flags every arm with n below 96 (`n_below_baseline_n`) and prints `needs_useful_to_clear_at_this_n`. The navigator rules on comparability at 366-20; the harness does not weaken or reinterpret the bar.
- **rs-graph will likely show 0 pairs** on the 355 copies. That is a measured result, not a harness failure; the record then has `shown 0`, `rate null`, `clears_bar false`.
- **Eureka shared-entity lane** is near empty on this substrate (copies yield zero DESCRIBES edges offline, see 366-01); the state of the substrate is frozen into `substrate.json`.
- **`--replay` is a test seam**, not a measurement mode. With the fixes above it is per pair, but it only replays what was recorded.

## Commands 366-19 will run

All under `export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH`, from `/home/jsagi/dev/MindrianOS-Plugin`, with temp `HOME`, `USERPROFILE` and `MINDRIAN_ROOMS_HOME`, `CLAUDE_ACTIVE_ROOM` and `CLAUDE_CODE_SESSION_ID` unset. Resolve the model dirs and the Jev key BEFORE overriding HOME: `MINDRIAN_MODEL_CACHE=$REAL_HOME/.mindrian/model-cache`, `MINDRIAN_EUREKA_DEPS_ROOT=$REAL_HOME/.mindrian/eureka-deps`, and for the Jev arm only `TYPESAFE_API_KEY` exported from `~/.secrets/typesafe.env` into the child environment without echoing it (the child resolves `~/.secrets` through `os.homedir()`, which follows HOME).

```
node scripts/spike-366-prepare.cjs prepare --out <dir under os.tmpdir()>            # prints the manifest path M
for A in eureka-graph-lexical eureka-graph-lexical-vector rs-graph hsi-graph; do
  node scripts/spike-366.cjs recall --manifest M --arm $A                            # vector arm exits 77 with no cached model
  node scripts/spike-366.cjs items  --manifest M --arm $A                            # writes <W>/arms/$A/items.json (355 shape) and pairs.json
done
# navigator sitting, one per recall arm's items file (blind, seeded shuffle, the pairings-unstamped set):
node scripts/label-355-gold.cjs start --set pairings-unstamped --items <W>/arms/$A/items.json --session-dir <tmp> --seed <n>
node scripts/label-355-gold.cjs emit  --set pairings-unstamped --items <W>/arms/$A/items.json --session-dir <tmp> --out tests/fixtures/366-spike/gold/$A.json
# judge arms, over EVERY recall arm's same candidates file, repeats 1 to 3:
for N in 1 2 3; do
  node scripts/spike-366.cjs judge --manifest M --arm stage-a --recall-arm $A --repeat $N
  node scripts/spike-366.cjs judge --manifest M --arm jev     --recall-arm $A --repeat $N
  # Claude: a Claude Code subagent follows tests/fixtures/366-spike/claude-judge-prompt.md over <W>/arms/$A/items.json
  # and writes <W>/arms/$A/claude-r$N.jsonl (inside the spike root); then:
  node scripts/spike-366.cjs judge --manifest M --arm claude          --recall-arm $A --repeat $N --verdicts <W>/arms/$A/claude-r$N.jsonl
  node scripts/spike-366.cjs judge --manifest M --arm claude-then-jev --recall-arm $A --repeat $N --verdicts <W>/arms/$A/claude-r$N.jsonl
done
node scripts/spike-366.cjs record --manifest M      # freezes arms/ and writes record.json (refuses a gold whose fixture_sha256 differs from the items)
node scripts/spike-366.cjs --check                  # exit 0 only on a byte-for-byte match
```

What the navigator labels: one sitting per recall arm's `items.json` (labels useful, direction ok, already known per pair; only `room`, the two excerpts and the direction phrase are shown, never the arm). The count per arm is the arm's shown total, at most 96 (32 per room across 3 rooms); the exploratory probe suggests about 7 for eureka-graph-lexical, about 7 for hsi-graph, 0 for rs-graph (nothing to label) and up to 96 for the vector arm. The judge arms add no labeling: their rates are computed from the same gold by pair_id.

## Known Stubs

None. The record leg in `tests/run-all-366.sh` skips until `tests/fixtures/366-spike/record.json` exists, by design.

## Threat Flags

None new. T-366-75 and T-366-76 (contained fixture copies only, realpath containment), T-366-77 (bar committed before the harness), T-366-78 (`--check` byte for byte, tamper legs S6) and T-366-79 (no API key read; the Claude arm is a host subagent) are covered by S3, S4 and S6. The harness spawns `scripts/eureka-jev-judge.cjs` only over a derived run folder inside a spike-root room copy and drops `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` from the child environment.

## Self-Check: PASSED

Files exist: tests/fixtures/366-spike/bar.json, tests/fixtures/366-spike/claude-judge-prompt.md, scripts/spike-366.cjs, tests/test-366-spike-harness.cjs. Commits fb8563bf6, 5c9d633c7, 8334c9e9b and 3f9a1145e are in `git log`; bar.json predates the harness commit. STATE.md and ROADMAP.md untouched.
