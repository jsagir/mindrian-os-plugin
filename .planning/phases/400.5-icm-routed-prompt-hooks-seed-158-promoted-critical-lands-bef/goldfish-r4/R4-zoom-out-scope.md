# Goldfish R4 scope review (zoom-out) of DESIGN r4: recommends Path H; owner decision = relax G5 for this cut

Problem (one sentence): on a starved host the UserPromptSubmit help must reach the model inside the 3 s hook budget every prompt, no silent loss, no raised budget. RCA causes: 5 s room.db lock wait in a 3 s budget (RCA:25); six node cold starts per prompt (RCA:26, :41). G9, G11, G13, G8 come from the problem; G5, G6, G7 from the chosen transport.

Paths:
- C0 keep six command hooks, bound work (400.4 plans 10, 12, 14 already base): fails G3, G5, G6, G7; keeps 6 cold starts; ~0 code + load test (GUESS); likely fails G11 (two no-db hooks still missed 3 s, RCA:39-41).
- B plan 13 dispatcher + one-file turn marker ("started k" at start, "done k" in stdout callback only if <= 2,500 ms; next prompt notes a turn with no done): fails G5 as written (G6, G7 moot); G8 becomes "timeout of the one process gives a typed note next prompt"; G3, G9, G10, G12, G13, G14 hold; "admin gate runs first" true again. Plan 13 = 3 tasks, 14 files (INPUT:7-21), ready; ~2 plans (GUESS). Risk: one cold start loading the classifier graph; fit in 3 s at load 20 UNVERIFIED.
- A r4 server tier: meets rulings; 7 plans / 5 waves (DESIGN:528-536), 9 spike legs (:530), 6 new modules (:75-80), deep edits to intent-classifier (:263-285) and navigation writers (:233-238); ~7 stop-for-owner host-behaviour cells (L0 gap, L1, L1-P, L4, L5, L6, L7; :459-467) on the G1 critical path; each round found a new "trace of an unseen turn".
- H hybrid: ship B now with a G11 load leg as first gate; server tier as a later phase only if that leg fails (Stage 8 S4 rule: no machinery until a test shows the loss matters).

Why r4 is complex: only G5. Clock rule/L0, abort/journal/forgetUnservedTurn, dispatch lock, ALS busy-cap store, process guards, OR-6, Part 11/budget, two-file ledger all exist because checks run in a long-lived process that does not see the host cancel. In a command process the host kill is the cancel.

Section 12 findings: (1) Major: r4 also keeps one cold node start per prompt (DESIGN:65 "1 node process (was 6)"); the difference is only what that process loads; comparison biased to r4. (2) Major: ROADMAP:4307 promises "without a cold start or a cross-process lock wait"; r4 meets neither (DESIGN:65; T5/T7 :422, :425). (3) Nit: plan 13 keeps the env snapshot (INPUT:34, P6 :135), DESIGN:544 wrong. (4) Major, gap in B: a cut classifier keeps running while later checks await and can write the NAV hash/trace before exit (parity class); small fix = synchronous deadlineAt check before writeNavBlockHash and persistDecisionTrace.

Goal to relax: G5 (ROADMAP:4315 criterion 1, ONE mcp_tool hook into the MCP server) + server wording of ROADMAP:4307. Then G6, G7 drop; G8 -> process-timeout note; G9 -> inside the dispatcher; G2 reopens; G3 holds; OR-3, 5, 6, 7, 9 moot; OR-8 holds; OR-1 improves.

Recommendation: Path H: plan 13 as written + one-file turn marker + deadlineAt write check; G11 load leg (T7 shape: large-room fixture, CPU load, room.db writer, 20 prompts) is its first acceptance gate; server tier later only if that leg fails.
Measured: bare node 32 ms; hooks 27-136 ms empty room (RCA:19); admin gate 25-28 ms at load 2.5 (RCA:39); failure host IO pressure 12.8-14.7 %, load 20 on 12 cores (RCA:40); run() loaded, node start excluded: classifier 93-154 ms, routable sum ~160-240 ms (RESEARCH F-11 :35); cold connect ~3.2 s (F-07 :28); baseline p95 admin 19.6 ms, intent-classifier 39.3 ms (tests/fixtures/369/hook-cold-start-baseline.json:658-679). All size estimates GUESS.
Risk of H: if the load leg fails, the cut slips one phase or needs the server tier; a host kill of the one process loses all six outputs together (as 2026-11-26), made loud by the marker, not absent.
