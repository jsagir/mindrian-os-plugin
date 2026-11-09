---
phase: 392-part-8-problem-shape-packet-measure-close-the-six-bypasses-s
plan: 13
subsystem: part8 loop checks, acceptance (Jev leg)
tags: [part8, shape-packet, loop-l1, loop-l3, acceptance, jev, typesafe, capture-server, wave8, sc7, sc4]
requires: ["392-07 (L2)", "392-10 (envelope facts)", "392-11 (lexicon_scope)", "392-12 (the shape on the wire, the capture server seams)", "Theo Phase 48 live (sha 3e6946be)"]
provides:
  - "tests/test-392-loop-l1-wire-bytes.cjs: L1, the wire carries exactly {question, shape} (shaped) or {question} (bare, no session), no room lexicon entry and no CREDENTIAL_SHAPES match in any captured byte, in process and through the shim; the belt and the shim send nothing for a lexicon word"
  - "tests/test-392-loop-l3-recombine.cjs: L3, the assembled local text (part8-split-route assembleLocal through runSplitRoute) holds the room words and Theo's method names while the captured request holds neither, on the CLI path (hook plus belt) and on the shim-alone path; Theo's evidence block rides into the assembly"
  - "scripts/part8-shape-acceptance.cjs: the acceptance as a Jev leg, the same generic question bare and shaped through brain-client, a recording proxy around fetch, four comparisons, the room lexicon asserted absent, exit 77 gates, exit 2 for an --out inside the repo, the Jev relevance question over row ids and enums, the human verdict recorded"
  - "tests/test-392-acceptance-jev.cjs: J0 to J9, the script's comparison logic and exit paths offline against the capture server and a fake Jev endpoint; --live self-skips"
  - "tests/helpers/brain-capture-server.cjs: a reply keyed by tool name may be a function of the call arguments"
  - "tests/run-all-392.sh: the .cjs loop tallies SKIP through run_may_skip"
  - ".planning/.../392-ACCEPTANCE.md: the live four verdicts (ids and labels only)"
affects: [392-14, 392-15, 392-16, Theo Phase 48 (two observations)]
tech-stack:
  added: []
  patterns:
    - "A recording proxy around globalThis.fetch (request body, status, response text per run label) proves the outbound bytes of a live call without a second transport"
    - "A test that runs a child against a server in its own process spawns asynchronously; spawnSync starves the server and the child reads it as unreachable"
    - "A Jev leg keeps its egress profile local to the script (one profile per builder), with the guard refusing every key outside the row ids and the enum members"
key-files:
  created:
    - tests/test-392-loop-l1-wire-bytes.cjs
    - tests/test-392-loop-l3-recombine.cjs
    - scripts/part8-shape-acceptance.cjs
    - tests/test-392-acceptance-jev.cjs
    - .planning/phases/392-part-8-problem-shape-packet-measure-close-the-six-bypasses-s/392-ACCEPTANCE.md
  modified:
    - tests/helpers/brain-capture-server.cjs
    - tests/run-all-392.sh
    - tests/test-c8j-brain-wire.cjs
    - tests/test-339-theo-ask-compose.cjs
    - .planning/phases/392-part-8-problem-shape-packet-measure-close-the-six-bypasses-s/deferred-items.md
decisions:
  - "The acceptance script pins brain-client's lexicon check to --room through the documented operator pin CLAUDE_ACTIVE_ROOM (lexicon_scope machine_global) and runs without a session id, so no other room of the machine is read during a live run; the shaped run passes the room packet as a caller-built shape from the one builder."
  - "Exit 77 for a missing key comes AFTER the plain comparison is run and written (the orchestrator's reading), so a key-less machine still records the four verdicts; exit 77 for an unreachable or non-advertising Brain comes before any question is sent."
  - "The four criteria: problem_type_source win iff heuristic to signal; grounding_order win iff lexical to shape_boosted; coverage win iff the shaped run is full (rank1_leads_total 0 is no_lead, neither win nor loss; both full is same, not a loss); ordering pass iff both runs are non-decreasing along theo_rank with option_order theo_rank. Exit 0 iff no criterion is a loss and no lexicon hit."
  - "The Jev answer is recorded beside the human verdict and never counted toward the exit code (T-392-40): over row ids and section labels alone Jev answered same with confidence 0.04 on the live run."
  - "The L3 RED line is the evidence assertion (beta.81 dropped Theo's evidence), ordered before the shape-key assertion so the RED run shows the plan's named failure; the beta.81 grep count for assembleLocal under tests/ is 1 (test-386-sprout-split-route.cjs), not the plan's 0."
metrics:
  duration: "about 100 min (ASSUMED start 2026-11-09 21:45Z first read; PROVEN commits 22:06Z, 22:17Z, 23:02Z x2; live run 22:32Z; runner close 23:25Z)"
  tasks: 3
  files: 10
  completed: 2026-11-09
---

# Phase 392 Plan 13: L1, L3 and the acceptance script as a Jev leg Summary

The two remaining loop checks and the acceptance landed and ran: L1 proves with the capture server that Theo receives exactly `{question, shape}` (or `{question}` bare and without a session) with no room lexicon entry and no credential shape in any byte, in process and through the shim; L3 proves that Larry's local assembly holds the room words and Theo's method names while the request holds neither, on the hook-plus-belt path and on the shim-alone path; and the acceptance script ran LIVE against theo-mcp.onrender.com (shape advertised on both tools): the shaped call won all four criteria (heuristic to signal, lexical to shape_boosted, coverage unknown to full 4 of 4, both orders consistent with Theo's rank), exit 0, the Jev leg ran (jev-1.13.0, answer same), the human verdict is recorded as pending.

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | L1, the wire carries only the question plus the shape | 0b36ef94c | tests/test-392-loop-l1-wire-bytes.cjs |
| 2 | L3, Larry recombines locally | bb41a11d1 | tests/test-392-loop-l3-recombine.cjs |
| 3 | the acceptance script as a Jev leg | b268ac911 | scripts/part8-shape-acceptance.cjs, tests/test-392-acceptance-jev.cjs, tests/helpers/brain-capture-server.cjs, tests/run-all-392.sh |
| deviation (named) | re-pin c8j Leg 7 and test-339 Arm 3a (lexicon_scope, 392-11) | 6778a6b22 | tests/test-c8j-brain-wire.cjs, tests/test-339-theo-ask-compose.cjs |

STATE.md, ROADMAP.md, REQUIREMENTS.md and 392-WAVES.md were not edited (the orchestrator owns them on this branch; the foreign uncommitted ROADMAP.md and STATE.md edits, the untracked debug file and the untracked 393 directory were never staged or reverted). No `gsd-tools state.*` write was run for the same reason.

## RED proofs

Each test runs lib/ and scripts/ from `MOS392_GUARD_ROOT` when set (the --guard-root style of tests/helpers/audit-probe-loader.cjs); the RED runs used a `git archive v2.0.0-beta.81` export (lib, scripts, tests/helpers, data, hooks, package.json) with node_modules linked. Helpers and the validator always come from this repository.

L1 on the beta.81 export (`4 passed, 4 failed`, exit 1):

```
FAIL - L1-1 in process, session S1, schema B: brain_ask body keys exactly [question, shape]; ...
  body keys: {"question":"what is jobs to be done"}
  + actual - expected
    [ 'question', -   'shape' ]
FAIL - L1-5 shim ... Connection closed     (the export's shim cannot start: it requires ../.claude-plugin/plugin.json, not in the archive)
FAIL - L1-6 shim ... Connection closed
FAIL - L1-7 ... records from every arm: 3
```

L3 on the beta.81 export (`1 passed, 3 failed`, exit 1); the byte assertions passed there (L3 is independent of the shape), the plan's named assertion failed:

```
FAIL - L3-1 CLI path: ...
  CLI path: grounding.evidence.linked_frameworks_for_type expected (plan 392-10 keeps Theo evidence): undefined
FAIL - L3-2 shim-alone path ... Connection closed
FAIL - L3-3 ... records from both arms: 0
```

Grep count of tests referencing `assembleLocal` on beta.81: `git grep -l assembleLocal v2.0.0-beta.81 -- tests/` = 1 (tests/test-386-sprout-split-route.cjs). The plan expected 0; recorded in deferred-items.md.

Task 3 RED (the script moved aside): `node tests/test-392-acceptance-jev.cjs` printed `FATAL: Error: Cannot find module '.../scripts/part8-shape-acceptance.cjs'`, exit 1.

## GREEN counts (final tree 6778a6b22, PROVEN)

| Command | Result |
|---|---|
| `node tests/test-392-loop-l1-wire-bytes.cjs` | 8 passed, 0 failed (2.8 s) |
| `node tests/test-392-loop-l3-recombine.cjs && node tests/test-386-sprout-split-route.cjs` | 4 passed, 0 failed; SR1 to SR8 ALL PASS |
| `node tests/test-392-acceptance-jev.cjs` | 10 passed, 0 failed (1.6 s) |
| the plan's verify form, no key: `unset TYPESAFE_API_KEY; HOME=<empty home> node scripts/part8-shape-acceptance.cjs --question "..." --room tests/fixtures/392-shape-rooms/room-a --out /tmp/392-acc.json` | the four comparisons printed and written, then `SKIP part8-shape-acceptance: TYPESAFE_API_KEY absent; the Jev leg did not run`, exit 77 (on this machine the secrets file under the real HOME supplies the key, so the empty HOME is what proves the gate) |

## L1 results

- In process, session S1 bound to synthetic room A under schema B: brain_ask `[question, shape]`, the shape validates (`validateShapePacket` ok), recommend_chain `[max_steps, problem_type, shape]` with the same packet and `problem_type` equal to the shape's; the envelope says `problem_type_source signal`.
- Bare (`MINDRIAN_BRAIN_SHAPE=0`): `[question]` and `[max_steps, problem_type]`.
- Bytes: every captured record of every arm (in process shaped and bare, shim with and without a session; brain_ask, recommend_chain, brain_query, the shim's theo_health pre-warm) holds none of room A's 7 lexicon entries (read through `loadRoomLexicon`, case-insensitive) and matches none of the 12 `CREDENTIAL_SHAPES`.
- Belt: `ask(<lexicon word>)` leaves the capture unchanged and answers `{error: egress_blocked}` without the word.
- Shim with `CLAUDE_CODE_SESSION_ID` S1: `[question, shape]`; a lexicon word yields zero captured records of any tool and the honest DirectiveEnvelope refusal (`refusal.kind egress_blocked`, `status BRAIN_EGRESS_BLOCKED`, the word never echoed). Without a session id: bare `[question]` (plan 392-12 option a).

## L3 results

- CLI path: the hook (`scripts/part8-egress-guard-hook.cjs`, `tool_name mcp__plugin_mos_mindrian-brain__brain_ask`, `session_id` S1) exits 0 for the generic sprout and 2 for the 3-sentence body claim without echoing it. `runSplitRoute({db: room A room.db, claims: [2 room-word claims, 1 body], sprouts: [generic], classify, roomDir, callBrain: brainClient.ask})` under S1: ok, 3 claims filed locally, 1 Brain call, the wire `[question, shape]`, the assembled text holds both room words and the three Theo method names of the 364 fixture (Business Model Canvas, Scientific Roadmapping, Unit Economics Review) under "What the Brain said:" and "What stays in the room:", and no captured record holds either room word or any body sentence. The envelope that entered the assembly carries `grounding.evidence.linked_frameworks_for_type 46` and `chain_coverage.full true`.
- Shim-alone path: brain_ask through StdioClientTransport with S1, then `assembleLocal(claims, [envelope])`: the same assertions.
- Every brain_ask of both arms carried the sprout only.

## L2

Referenced to plan 392-07 (`tests/test-392-eureka-deadline.cjs`, the 65 s fake engine). Run once more in this plan, standalone: `leg A: ok=true elapsed=65.2 s`; `leg B: ok=false reason=engine_timeout elapsed=64.0 s` (the 62 s plugin deadline plus the 2 s close grace, never engine_start_failed); `leg C result: ok=true status=completed elapsed=65.0 s`; `leg C eviction: session_gone=true after 0.1 s`; `4 passed, 0 failed, total 194.7 s`, exit 0. The same test also PASSED inside `run-all-392.sh`.

## The acceptance script

`scripts/part8-shape-acceptance.cjs` (switch-case argv router; `--question`, `--room`, `--out`, `--human-verdict a|b|same`, `--help`). Flow: validate args; refuse `--out` inside the repo (exit 2, realpath-based); load the Jev key (`loadKey`: env or the secrets file under HOME; never printed); build the shape through `buildShapePacket({roomDir})` and validate it; read the room lexicon; pin `CLAUDE_ACTIVE_ROOM` to the room, drop any session id; install the recording proxy; require brain-client; probe `brainAcceptsShape` on both tools (unreachable or not advertised: write the probe, SKIP, exit 77); bare run (`MINDRIAN_BRAIN_SHAPE=0`); shaped run (`ask(question, {shape})`); summarize both envelopes (ids and enums only: problem_type, problem_type_source, rung_source, shape_source, lexicon_scope, grounding_order, rows as `chapterId:section` with the raw reply's `shape_match` when present, chain_coverage, coverage_label, evidence, options as framework, theo_rank, confidence); assert the lexicon absent from both bodies; compare; Jev leg when a key exists (local `exact_state_v1` profile `part8_shape_acceptance`, state `{problem_type, stage, a_rows, b_rows}`, one choice question with criteria a, b, same, `parseJevResponse`); record the human verdict; write; print the compact report; exit 77 if no key, else the verdict's code. Exported for the test: `compare`, `summarizeEnvelope`, `coverageIsFull`, `orderConsistent`, `isInsideRepo`, the profile.

Header states: runnable live only after Theo Phase 48 T6 deploys (the probe gates it); the 2026-11-08 baseline (heuristic, inferred, coverage 1 of 4 partial, 0.6 above 0.9).

## The LIVE run (PROVEN, 2026-11-09 22:32Z, theo-mcp.onrender.com)

Command: `node scripts/part8-shape-acceptance.cjs --question "<the generic question used by every 392 test>" --room tests/fixtures/392-shape-rooms/room-a --out <scratchpad>/392-acceptance/live-20261109T223217Z.json`. Output outside the repo (8,726 bytes, no `snippet` key). Probe: brain_ask shape true, recommend_chain shape true, reachable, 2 requests. Shape sent: `WellDefined / Phase3 / investor / finance / [regulatory, capital]` (the invented fixture room).

Captured bodies (keys and enum values): bare brain_ask `[question]`, recommend_chain `[max_steps, problem_type]` with `IllDefined` (the inferred rung) and 4; shaped brain_ask `[question, shape]`, recommend_chain `[max_steps, problem_type, shape]` with `WellDefined` and 4, the shape byte-equal to the room packet on both tools; one `brain_query` `[cypher, params]` per run as before.

| Criterion | Bare | Shaped | Verdict |
|---|---|---|---|
| problem_type_source | heuristic (rung_source inferred, shape_source none, lexicon_scope machine_global) | signal (rung_source signal, shape_source room) | WIN |
| grounding_order | lexical | shape_boosted (rows carry no shape_match field: 0 of 8 marked on both runs) | WIN |
| coverage | chain_coverage absent, coverage_label unknown | `{steps_returned 4, steps_requested 4, rank1_leads_total 4, rank1_leads_returned 4, linked_frameworks_for_type 43, full true}`, label full | WIN (the shaped run is full, the bare run is not) |
| ordering | option_order theo_rank, theo_rank [1, 1, 2, 2], confidence [0.87, 0.86, 0.8, 0.77] | option_order theo_rank, theo_rank [1, 1, 1, 1], confidence [0.9, 0.89, 0.88, 0.86] | PASS |

Lexicon: room-a has no room.db, 0 entries, hits 0 and 0 (vacuous for this room; L1 carries the 7-entry proof). Verdict exit 0, lost none, no lexicon leak. Jev leg: ran, model jev-1.13.0, 528 ms, 578 input tokens, choice `same` (a 0.32, b 0.32, same 0.36, confidence 0.04; a = bare, b = shaped). Human verdict: pending (the owner's step, with the row ids in 392-ACCEPTANCE.md). Row ids: bare `ch08:EXERCISE, ch07:CONCEPT, ch07:SYNTHESIS, ch04:CONCEPT, ch03:EXERCISE, ch07:EXERCISE, ch03:SYNTHESIS, ch02b:SYNTHESIS`; shaped `ch08:EXERCISE, ch07:CONCEPT, ch07:SYNTHESIS, ch07:EXERCISE, ch08:FRAMEWORK, ch07:FRAMEWORK, ch08:HOOK, ch06:SYNTHESIS`. The four verdicts are also filed in `392-ACCEPTANCE.md` (ids and labels only).

Two Theo-side observations (deferred-items.md): rows carry no `shape_match` boolean though the order is declared boosted; the bare recommend_chain reply carries no `chain_coverage` block.

## The two re-pins (named deviation)

- `tests/test-c8j-brain-wire.cjs` Leg 7 (belt half): asserts `lexicon_scope` is one of session, machine_global, then deep-equals the rest `{error, tool, egress_class}`; dated comment names plan 392-11. `node tests/test-c8j-brain-wire.cjs`: 11 passed, 0 failed.
- `tests/test-339-theo-ask-compose.cjs` Arm 3a: the exact key set gains `lexicon_scope`; the value pinned as closed. `node tests/test-339-theo-ask-compose.cjs`: 12 passed, 0 failed.
- `bash tests/run-all-339.sh`: PASS=14 FAIL=2 before the origin fix below; after it the one remaining FAIL is the pre-existing "dist bundle staleness (build-dist-bundles.cjs --check-stale)" (bundle from beta.52 against beta.81, version-based, deferred-items.md 392-10). The live e2e arm ran against theo-mcp and PASSED. Closed-value pins because the test process inherits `CLAUDE_CODE_SESSION_ID` under Claude Code (session) and lacks it in a plain terminal (machine_global).

## Runner counts (PROVEN unless marked)

- `bash tests/run-all-386.sh`: PASS=37 FAIL=0 SKIP=0; LZ5 guard 172 to 11, hook 175 to 14, statusline 182 to 18 (unchanged).
- `bash tests/run-all-392.sh`: discovered 20, PASS=20 FAIL=0 SKIP=0, exit 0 (the three new tests tallied PASSED; the eureka-deadline test ran inside the runner and PASSED too).
- `node tests/test-369-hook-require-graph.cjs`: 5 passed, 0 failed.
- `node tests/test-387-eureka-egress.cjs`: 22 passed, 0 failed.
- `node tests/test-392-eureka-deadline.cjs` (standalone, about 200 s): see L2 above.
- `node tests/test-254-composition-census.cjs`: 10 passed, 0 failed (no new reach site: the acceptance script lives under scripts/, outside the scan, and reaches the Brain through brain-client.ask only).
- The capture-server consumers after the helper change: `test-392-wire-shape` 18/0, `test-239-query-egress-canary` PASS (0 failures), `test-247-contract-client` 4/0, `test-brain-client-params` PASS, `test-c8j-brain-wire` 11/0.
- `node tests/test-339-origin-single-source.cjs`: PASS (0 failures) after the fix below.
- tests/test-389-seed-egress.cjs: ABSENT on this branch (rebase onto the release session's commits pending, D-07); not run.
- `node scripts/doctor.cjs --acceptance`: NOT RUN (UNVERIFIED; its version point runs `npm view`; the foreign uncommitted ROADMAP.md and STATE.md edits still make its clean-tree point FAIL, as 392-06 recorded).
- Dash scan (em dash, en dash) on the eight committed code and test files: 0 each. Part 8 scan: no room slug of this machine, no onrender literal, no Brain identifier in any committed file; the live capture lives in the scratchpad.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, Part 7] tests/helpers/brain-capture-server.cjs accepts a function-valued reply (outside files_modified)**
- **Found during:** Task 3 design
- **Issue:** the offline acceptance test needs one scripted Theo that answers the bare `{question}` and the shaped `{question, shape}` call differently inside one process; the helper's replies were keyed by tool name only. A second server would violate Part 7.
- **Fix:** additive: a reply keyed by name may be `(args, parsed) => descriptor`; a descriptor object behaves exactly as before. The five consumers re-run green.
- **Commit:** b268ac911

**2. [Rule 1 - Bug, caught by the 339 gate] An origin literal in the new script**
- **Found during:** `bash tests/run-all-339.sh` after Task 3 (test-339-origin-single-source Arm 3: `scripts/part8-shape-acceptance.cjs:578`)
- **Issue:** `safeHost` defaulted to the Theo origin as a literal; lib/core/brain-client.cjs:24 is the single source.
- **Fix:** the report records the host of `MINDRIAN_BRAIN_URL` when set and `default_origin` otherwise; no literal. Fixed before the commit; the origin scan passes (0 failures).

**3. [Rule 1 - Bug in the test driver] spawnSync starved the in-process servers**
- **Found during:** Task 3 GREEN (every child reported the Brain unreachable after ~30 s timeouts)
- **Issue:** the capture server and the fake Jev live in the test process; `spawnSync` blocks its event loop.
- **Fix:** asynchronous `spawn` awaited per arm; the run dropped from minutes to 1.6 s. Documented in the driver.

**4. [Plan-directed] tests/run-all-392.sh: the .cjs loop runs through run_may_skip**
- The plan says to extend the runner if its cjs loop used `run`; it did. A `.cjs` test that exits 0 and prints a line starting with SKIP is tallied SKIP; a non-zero exit is still FAILED. The two 392 tests that can print such a line (vocabulary-drift when the Theo tree is unreadable; eureka-deadline on win32) are intended skips.

**5. [Reading] The L1 shim refusal shape**
- The shim renders a block as a DirectiveEnvelope (`refusal.kind egress_blocked`), brain-client's own sentinel is `{error: egress_blocked}`; L1-5 accepts either as the honest refusal.

**6. [Reading] The exit-77 order for a missing key**
- Per the orchestrator's prompt the plain comparison runs and is written before the SKIP line; the plan's verify form still exits 77. The gates for an unreachable or non-advertising Brain stay before any question is sent.

**7. [Reading] The live leg ran**
- The plan's `<done>` expected "pending Theo Phase 48 T6"; 392-12 had already read the shape as advertised live, and the orchestrator asked for the live run. It ran once with the fixture room's invented shape and the generic question; results above and in 392-ACCEPTANCE.md.

### Not changed, by rule

- 392-WAVES.md, STATE.md, ROADMAP.md, the untracked debug file and the 393 directory: untouched.
- The beta.81 export cannot start the shim (`../.claude-plugin/plugin.json` not archived); the RED proofs rest on the in-process arms, which is where the plan placed them. Logged in deferred-items.md.

## Known Stubs

None. The script's human verdict is an input (`--human-verdict`), recorded as `pending` until the owner passes it; that is the plan's design (T-392-40), not a stub.

## Threat Flags

None new. T-392-38 mitigated (exit 2 for an --out inside the repo, realpath-based; row ids only, no snippet; the lexicon assertion on both bodies; J2, J5). T-392-39 mitigated (local profile with the four state keys and enum values; the guard refuses every other key; the Jev body on the live run and in J5 carries ids and enums only; never plurai). T-392-40 mitigated (the Jev answer and the human verdict are recorded side by side with the ids; the no-lead case is named and never counted as a win; J1, J8). One dev-time seam, not a new surface: `MINDRIAN_JEV_ENDPOINT` redirects the Jev leg for the offline test; the default is `jev-devtime-client.cjs` DEFAULT_ENDPOINT.

## TDD Gate Compliance

Task 1 and Task 2 are test-only plans of existing behaviour; their RED is the recorded run against the beta.81 export (L1-1 shape key, L3-1 evidence) and their GREEN the same test on HEAD, each committed once (0b36ef94c, bb41a11d1). Task 3: RED is the recorded run with the script absent (`Cannot find module`), GREEN the script plus test in one commit (b268ac911). No refactor commit.

## Next Phase Readiness

- 392-14 (Canon Custodian checkpoint) and 392-15, 392-16 can cite 392-ACCEPTANCE.md for SC7 and this SUMMARY's L1 for SC4.
- Owner step: read the two row-id lists in 392-ACCEPTANCE.md and re-run the script with `--human-verdict a|b|same` (output outside the repo); never claimed here.
- For the Theo phase: the per-row `shape_match` mark and the `chain_coverage` block on the bare recommend_chain reply (deferred-items.md).

## Self-Check: PASSED

Files exist: tests/test-392-loop-l1-wire-bytes.cjs, tests/test-392-loop-l3-recombine.cjs, scripts/part8-shape-acceptance.cjs, tests/test-392-acceptance-jev.cjs, tests/helpers/brain-capture-server.cjs, tests/run-all-392.sh, tests/test-c8j-brain-wire.cjs, tests/test-339-theo-ask-compose.cjs, 392-ACCEPTANCE.md, this SUMMARY. Commits 0b36ef94c, bb41a11d1, b268ac911, 6778a6b22 exist on work/part8-shape-packet. Post-commit deletion check on each: no deletions. This SUMMARY, 392-ACCEPTANCE.md and deferred-items.md are under `.planning/*` (force-tracked), added with `git add -f`.
