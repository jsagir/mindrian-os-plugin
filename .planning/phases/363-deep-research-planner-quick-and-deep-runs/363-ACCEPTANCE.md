# Phase 363 Acceptance (Plan 363-20)

Date: 2026-09-30. Author: the 363-20 executor. Tests: `tests/test-363-acceptance-whitespace.cjs`,
`tests/test-363-acceptance-diffusion.cjs`, `tests/test-363-part8-sweep.cjs`,
`tests/test-363-live-smoke.cjs`.

## Verdict

- Offline acceptance: **ACCEPTED**. The Whitespace plus OpenAlex slice works in both modes through the
  real doors, the diffusion lens is chosen by the local rule, and the Part 8 sweep found no leak across
  any door.
- Live acceptance: **PENDING (ENV GAP, not run)**. The live smoke is built and proven to exit 77
  without `MOS_363_LIVE=1`. It was NOT run against real OpenAlex in this plan: the flag was unset and
  the caller instruction was not to turn live calls on. No live number below is invented. The exact
  command to run it is in "ENV GAPs".
- One known limitation stands and is stated plainly: a real `whitespace-results.json` carries no
  `zone_term`, so room-started (ambient) runs on real rooms still answer `context_insufficient`
  (`no_zone_term`). See "Known limitation".

## What was accepted

The navigator locked D-06: SEED-097's first slice is the first acceptance case, and it runs in both
modes. In plain words the slice asks one question of a gap the room seems to have: is this zone empty
in the literature, or only empty in this room? Then the machine answers with a computed verdict and one
sentence, never a model opinion.

1. **D-06, both modes.** A quick research run and a deep research run each answer that question on the
   two-section fixture room, through the spawned CLI with the OpenAlex replay preloaded (W1-W6), the MCP
   register seam (W8) and the ambient branch (W7, W9). Every falsifier is exercised: covered under
   another term (W2), irrelevant as not researchable (W4), extraction failure as a local room check
   (W3). A one-section zone returns `context_insufficient` (W7).
2. **D-19, the diffusion lens.** A Scientific Roadmapping question about a dual-use technology's
   adoption selects the diffusion lens with named sources, carries `df:` leaves with falsifiers, and the
   deep run reads an S-curve from `df:timing` rows and counts adoption steps in the unlock chains (F1-F4).
3. **Part 8 sweep.** One planted room marker, one fake key (`fake-key-363`), every door: CLI quick, CLI
   deep, filing, the MCP tool, the ambient branch and the structure live refresh (S1-S9).

## Scenario verdicts

| Leg | What it proves | Result |
|-----|----------------|--------|
| W1 | Quick, gap confirmed: verdict `gap-confirmed`, plurality ran, 3 audit records, one `literature_gap` candidate, answer line says no published work turned up, a clean room check | PASS |
| W2 | Covered under another term: 240 synonym hits and a supporting row give `settled`; answer line says the problem is already studied under another wording, i.e. the gap is only absent from the room | PASS |
| W3 | Extraction failure: a room artifact already names the term; flagged as `extraction_failure` in `local_checks`, no request made for that leaf, the card says nothing was sent | PASS |
| W4 | Irrelevant: `ws:irrelevant` is not researchable, listed under "Not researchable in this run" on the plan review card, never searched | PASS |
| W5 | A thin card offers "run deep on this?" exactly once; `escalate`, `review approve` (writes a run grant with a decision node), then the deep loop runs to done with deterministic lane rows, a counterevidence pass, a stop reason and an unresolved-branch list | PASS |
| W5b | A deep run answers the two-halved question directly: gap confirmed gives governing thought `strengthened` and a `literature_gap` candidate; covered under another term gives `weakened` and none | PASS |
| W6 | `basket` then `file-run`: approved selection files the run home and the opt-in opportunity; `approved:false` files nothing | PASS |
| W7 | A one-section zone returns `context_insufficient` (`fewer_than_2_sections`); nothing planned, sent or written | PASS |
| W8 | The MCP door: `run_quick` returns the same verdict and the same answer line as the CLI on the same replay; `deep_plan` says the deep run executes in Claude Code and starts nothing on Desktop | PASS |
| W9 | The ambient branch under a standing grant queues an evidence card that the CLI `pending` door returns exactly once; nothing filed | PASS |
| W9b | KNOWN LIMITATION pinned: with no `zone_term` (the production shape) the ambient branch answers `context_insufficient` (`no_zone_term`) and sends nothing | PASS (pins the gap, see below) |
| F1 | Researcher room with a timing artifact: diffusion selected, named sources `larry` and `room_signal`, four `df:` leaves each with a falsifier, engine `scientific-roadmapping` | PASS |
| F2 | Without the request the room signal alone selects it; no request, no artifact and no adoption step selects nothing; a request with no reason is refused | PASS |
| F3 | Deep run: physics only with the derivation row (LM1), S-curve read from the `df:timing` row for LM3 only when the lens is selected (a control run without it stays `unknown`), adoption steps counted and self steps excluded (LM2 length 2, LM4 length 0), next binding constraint LM2 named | PASS |
| F4 | Lens selection never reaches Theo: a stub client and the shared brain client both record zero calls | PASS |
| S1 | Marker and key in no child argv, stdout or stderr (20 children); no approved room-derived term on argv; stderr silent | PASS |
| S2 | Marker and key in no MCP response and no in-process door result | PASS |
| S3 | The shared egress telemetry sink (`~/.mindrian/telemetry/external-papers.json`, written by a failing search so it is not empty; 15 entries) holds hashes only: no marker, key or query text | PASS |
| S4 | No cache file name or content carries the marker or the key | PASS |
| S5 | No Theo call argument carries the marker or a room-derived term; the live-refresh door made plain `MATCH` reads with generic framework and problem-type handles only | PASS |
| S6 | Every audit record holds an approved `q` (round one equals a plan-file query, later rounds are built only from approved phrases); no marker, no key | PASS |
| S7 | No door copied room text: across 6 rooms no file and no `room.db` node gained the marker | PASS |
| S8 | The key is in no file under any room or the test home | PASS |
| S9 | Every replayed request (child and in-process) carried the key only as a `Bearer` header, never in a URL or another header | PASS |

The sweep can fail: a scratch mutation that put the marker into a search term made S1, S2, S6, S7 and S9
fail, and the live-refresh and telemetry checks refuse to pass vacuously (they fail if the door made no
call or the sink was never written).

Test counts: whitespace 14 checks (W1-W9b + guards), diffusion 7, sweep 20, `test-363-run-deep` 17
(E14 added). All exit 0. Live smoke without the flag: exit 77.

## Measured

Everything below is OFFLINE, on the recorded OpenAlex replay. Latency here is process start plus engine
work; it contains no network time. It shows the engine is not the slow part. It does NOT stand in for
live OpenAlex latency, which is still unmeasured (see ENV GAPs). Four consecutive runs, n=6 quick calls
and n=3 deep loops per run; ranges are the lowest and highest run.

| Measure | p50 | p90 |
|---------|-----|-----|
| `run-quick` CLI call (one quick research run, 3 searches) | 108 to 165 ms | 113 to 243 ms |
| `plan` CLI call | 102 to 173 ms | 116 to 209 ms |
| `grant approve` CLI call | 118 to 178 ms | 130 to 213 ms |
| one deep-loop CLI call (12 calls per whitespace deep run) | 99 to 125 ms | 103 to 147 ms |
| whole whitespace deep loop, plan approved to synthesis | 1.19 to 1.50 s | 1.20 to 1.61 s |
| MCP `run_quick` in process | 8.6 to 19.5 ms | (one sample per run) |

Yield, from the replay bodies (fixture counts, not real OpenAlex):

- rows per query: 0 results on the gap route, 5 on the hit routes (the cap `QUICK_TOP_ROWS` is 5, so the
  fixture cannot show whether 5 is too low); synonym cover count 240.
- searches per deep run: the whitespace deep run used **3** of the 16 cap and stopped on `saturation`
  after round one; the Scientific Roadmapping deep run (E3 and F3) used **15** of 16 and stopped on
  `cap`. So 16 binds for Scientific Roadmapping and does not bind for whitespace.
- deep stop reasons seen: `saturation` (whitespace), `cap` (scientific).
- remaining budget: the replay recorder carries a synthetic $0.10 limit at $0.001 a search, so any
  remaining-budget figure would be the fixture's, not OpenAlex's. Not reported as a measurement.
- live per-query latency, live counts, live remaining budget: **not measured** (smoke not run).

## Floor decisions

Every 363 row in `data/floor-ledger.json` was reviewed. The ledger checker allows only `disclosed` or
`calibrated`, and `calibrated` needs gold labels and a sample size (`provenance.gold`, `provenance.n`).
Nothing measured here is a gold-labelled sample, so every row stays `disclosed`; each row's `provenance`
now points here. No value changed: a measurement without live numbers cannot justify moving a
default, and the offline numbers show no default is the binding limit.

| Row | Value | Decision | Why |
|-----|-------|----------|-----|
| `grants.GRANT_EXPIRY_DAYS` (D-11) | 30 | keep | It mirrors the 30-day research cache TTL on purpose, so a grant does not outlive the cache it fed. Nothing offline can measure staleness of consent; live use across a month is the only evidence, and there is none yet. |
| `grants.RESEARCH_RUNS_PER_HOUR` (D-11) | 1 | keep | The throttle is about cost and noise, not speed. A quick run costs 3 searches (about $0.003 at the measured keyless price) and finishes in well under a second of engine time offline, so one per hour is a policy choice, not a throughput limit. It also reuses the 355.1 ambient throttle value. |
| `plan.QUICK_MAX_QUERIES` | 3 | keep | The whitespace slice needs exactly three searches (exact, synonym cover, prior attempts) for plurality; fewer would break the `gap-confirmed` rule. |
| `plan.QUICK_TOP_ROWS` | 5 | keep | Fixture cannot show a shortfall (its bodies have 5 results); no evidence to change. |
| `plan.QUICK_TIME_BUDGET_MS` | 60000 | keep | Engine time is a small fraction of a second offline; the budget is there for network time, which is unmeasured. Live smoke decides. |
| `plan.DEEP_LANES_REQUESTED` | 4 | keep | SR deep run used four lanes in round one (LM2, LM3, LM1, LM4) as designed; whitespace uses two lens lanes. |
| `plan.DEEP_ROUNDS` | 2 | keep | Round two is the only place limiter interrogation (S-curve, prior attack) happens; F3 needs it. |
| `plan.DEEP_R1_QUERIES_PER_LANE` | 2 | keep | Whitespace lanes fill it exactly; SR lanes fill it exactly. |
| `plan.DEEP_RESULTS_PER_QUERY` | 5 | keep | Same fixture limit as `QUICK_TOP_ROWS`. |
| `plan.DEEP_MAX_SEARCHES` | 16 | keep | Binding for Scientific Roadmapping (15 used, stop `cap`), not for whitespace (3 used). It also keeps a whole deep run to about $0.016 keyless, matching the live smoke's stated cost ceiling. |
| `plan.DEEP_TIME_BUDGET_MS` | 1200000 | keep | Deep engine work is about 1.2 to 1.6 s offline; the 20 minutes is for network and the lane analyst model, neither measured here. |
| `plan.MAX_PLAN_REVISIONS` | 3 | keep | Not affected by any measured value. |
| `plan.PYRAMID_DEPTH_CAP` | 3 | keep | Not affected by any measured value. |
| `verdict.GAP_COUNT_FLOOR` | 3 | keep, still unmeasured | The fixture sits well on both sides of it (gap counts 0 to 2, hit counts 9 to 240), so the rule is exercised. Whether 3 is the right floor on real OpenAlex phrase counts needs the live smoke and a labelled sample; until then it stays a disclosed default. The verdict rule already refuses to call a gap when a synonym cover finds papers, which is the protection that matters. |

## Not acceptance

- Benchmark scores from other projects (D-06). None were used and none appear here.
- Model quality of the lane analyst. Deep runs here use deterministic lane rows quoting fetched
  records; the analyst agent's judgment is what the human D-06 check (363-21) is for, on the plan, not
  on the run.
- Live OpenAlex behavior (latency, counts, budget). Pending the smoke.

## ENV GAPs

1. **Live smoke not run.** `MOS_363_LIVE` was unset and the instruction was not to turn on live calls.
   Recorded as pending human/env, not faked. To run it once (at most 3 quick and 16 deep searches of
   generic fixture phrases, about $0.02 keyless, under test grants in a scratch room and scratch home):

   ```
   MOS_363_LIVE=1 node tests/test-363-live-smoke.cjs
   ```

   Outcomes: exit 0 with `LIVE_METRICS {...}` means it ran and passed; exit 77 with `ENV GAP: <typed
   reason>` means no network, a 429, an exhausted budget, a timeout or an HTTP error (never a pass);
   exit 1 means a live body broke the contract (a parse error) and is a real defect. Paste the
   `LIVE_METRICS` line here and re-decide GAP_COUNT_FLOOR and the two time budgets from it.
2. **Deep execution on Desktop and Cowork** is the stated honest degrade: the MCP `deep_plan` op
   returns the plan and says the deep run executes in Claude Code (W8).
3. **Pre-existing reds** in the phase aggregator (`run_known` legs) are counted KNOWN, not touched.

## Known limitation: zone_term is not populated in production

Production `.mindrian/whitespace-results.json` is written by `scripts/compute-whitespace-gaps.py` and
carries no `zone_term`. The fixture room adds one, which is why W9 passes. On a real room, the ambient
branch reads no term and answers `context_insufficient` / `no_zone_term` (pinned by W9b so it cannot go
quiet). This plan's scope is acceptance and floors; it does not touch `ambient.cjs`, the planner or the
CLI, so the gap is NOT closed here.

Follow-on design (from 363-19's summary, unchanged): a room-local sidecar
`.mindrian/whitespace-zone-terms.json` written only after the navigator approves the F.0 grant card that
lists the term; `ambient.zoneTermOf` reads `gap.zone_term`, then the sidecar entry for the zone, then falls
back to `no_zone_term`. One facade function, one CLI subcommand, one leg each in `test-363-ambient` and
`test-363-cli`. Recommended as a 363.x quick task before anyone relies on room-started runs in real rooms.
When it lands, W9b must be updated to the new behavior.

## Defects found and fixed while accepting

1. **Whitespace deep run in a researcher room produced no lanes.** A researcher room gives every plan the
   `scientific-roadmapping` engine (`structure.detectScientific`), including a lite whitespace plan with no
   limiters. `deep.laneSpecs` then took the limiter-lane path with nothing to lane on, so a quick run's
   "run deep on this?" escalated to a plan with `no_search_terms`. Fixed in `deep.cjs` (`isSR` now needs at
   least one limiter); `E14` added to `test-363-run-deep.cjs` first (red), now green. Commit 8f0dbba00.
2. **Render coverage registry was stale** from 363-18 (`/mos:research` and its skill moved to Form B
   `hitl_stages`), which blocked any `lib/core` commit at the pre-commit gate. Regenerated in the same
   commit.

## Interpretation notes

- "The answer line names both halves of the question": each verdict's line names its own half (W1: no
  published work turned up; W2: already studied under another wording, so the gap is only absent from the
  room), (the question set's SCQA states both halves). No product text was changed for this.
- W5 asserts the deep run reports an `unresolved_branches` list (present, may be short) rather than a
  specific count, because the fixture's deterministic rows make the count a property of the fixture.
