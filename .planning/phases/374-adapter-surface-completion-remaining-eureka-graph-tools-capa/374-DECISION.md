# Phase 374 decision cards: adapter surface completion

Written: 2026-11-08 by plan 374-07, HEAD e18631a6e (the sealed HEAD is on the machine line below). Repo version: 2.0.0-beta.82.

This card decides nothing. The owner answers one line per card.

Nothing is built, edited or added by plans 374-08 to 374-14 until an answer is recorded and still matches the options. No push, tag or release follows from an answer. A change reaches users only after a release is cut and picked up.

## How to answer

There are seven cards, G1 to G7. Each card has one answer line. You can answer in one word per card, or pick items one by one.

- KEEP-ALL: build nothing for the card. KEEP means "the status quo: do not build this".
- RECOMMENDED: take the recommendation printed on the card.
- CUSTOM: name one option for every item of the card, as OD-x=OPTION pairs.

```
G1 RECOMMENDED
G2 KEEP-ALL
G5 CUSTOM OD-5A=F6 OD-5B=KEEP
```

The main session writes the token into the answer line of the card. The executor of this plan wrote no answer. Every answer line below reads PENDING.

## Words in this card

- PROVEN: I ran the command or read the line in this session (2026-11-08). CITED: the fact comes from 374-RESEARCH.md or the engine run contract and I did not re-run it. UNVERIFIED: I did not run it. ASSUMED: a guess that the source itself marks as a guess.
- KEEP: the status quo. In Phase 374 it means "do not build this". Every option list starts with KEEP.
- F.6 and F.0: card shapes of the project. F.6 is the plan review card (a person reads a plan and says yes or no). F.0 is the grant card (a person grants one permission). commands/eureka.md already uses both.
- Part 8 (Canon): user data never goes to the Brain. This card holds names, counts and line numbers only.
- Pair screen: the one-command run over both pair engines of the Eureka engine (capability id opportunity.run_pair_screen). It runs on the person's machine.
- Cowork: not observable from this machine, so Cowork is UNVERIFIED on every card.
- Owner lock: a lock in the Eureka job store so that a second engine process does not fail a job that another process still runs. Source: the Eureka session's answer of 2026-11-08, which says it does not exist yet. I also found no lock in the engine tree I read (PROVEN, grep for owner lock in src and docs: no hit).

## Summary at a glance

| Card | Subject | Items | Token for the recommendations | What RECOMMENDED would cause later |
|------|---------|-------|-------------------------------|------------------------------------|
| G1 | Tool router for the Eureka tools | 1 (OD-1) | RECOMMENDED | OD-1 resolves to KEEP, so no router. Plan 374-14 records the final tool budget figure and closes the router question for this phase. |
| G2 | A tool to forget a finished run | 1 (OD-2) | RECOMMENDED | OD-2 resolves to ADD-FORGET-TOOL. Plan 374-13 adds eureka_capability_job_forget: 75 to 76 tools. |
| G3 | Result count and node caps | 1 (OD-3) | RECOMMENDED | OD-3 resolves to TOPK-200. Plan 374-12 raises the top_k cap from 100 to 200. The node cap stays 2,500. |
| G4 | Where the job pointer record lives | 1 (OD-4) | RECOMMENDED | OD-4 resolves to USER-DIR. Plan 374-10 writes ids and hashes under ~/.mindrian/eureka-jobs/. |
| G5 | Pair screen card shape and subcommand | 2 (OD-5A, OD-5B) | RECOMMENDED | OD-5A resolves to F6 and OD-5B to SCREEN. Plan 374-08 adds the pair-screen route with an F.6 approval card. Plan 374-09 adds the /mos:eureka screen subcommand. |
| G6 | Guard against a second Eureka call during a job | 1 (OD-6) | RECOMMENDED | OD-6 resolves to ENGINE-BUSY-GUARD. Plan 374-11 adds the engine_busy refusal for one host process. |
| G7 | Large job results | 1 (OD-7) | RECOMMENDED | OD-7 resolves to PAGE-ARG. Plan 374-12 adds an optional page argument to eureka_capability_job_result. 0 new tools. |

## Not on any card

- More dedicated graph tools. Done: 14 of 14 graph.* catalog entries have a plugin tool (9 tool files plus the 5 services of eureka-graph-discovery-signals.cjs, CITED from 374-RESEARCH.md). No plan adds one (D-07).
- A tool router build. G1 asks only for a record, not a build.
- A node cap of 3,000, except as option NODES-3000 on G3, which has no plan. It needs Eureka-side changes first.
- Any change in the Eureka repo (D-01). The asks to the Eureka session are listed in the section "Eureka asks".
- Live engine runs (D-02). No local model path exists on this machine. The live tests skip with exit 77 and are left for the owner.
- The Phase 375 to 379 work, and the provenance gap marks (HOST-02).
- The 276 tool-honesty sweep failures that exist before this phase.

HEAD-AT-DECISION: 0000000000000000000000000000000000000000

## G1 Tool router for the Eureka tools

### OD-1 router or a recorded budget only

Question: do you want a tool router for the Eureka tools, or only a recorded re-baseline of the tool budget?

Facts:
- Budget run: `node tests/test-270-tool-schema-budget.cjs` prints `budget: 75 tools, 36269 desc bytes, 47531 schema bytes, 83800 total, ~20950 approx tokens (router 9 / atomic 66)` and 5 passed, 0 failed. Same figures as the planner saw. (PROVEN)
- The Eureka family is 26 tools, 25,977 bytes, about 6,494 tokens, 31.0 percent of the surface. The 17 eureka_graph tools are 16,953 bytes. Measured by a scratch probe on 2026-11-08; I did not re-run the probe, and plan 374-13 re-measures. (CITED, 374-RESEARCH.md)
- Headroom to the test-270 tolerance: 83,522 recorded bytes times 1.10 is 91,874, so 8,074 bytes. (CITED, arithmetic on the recorded AFTER constant)
- No rule in the repo caps the tool count: grep for `toolCount` in lib and docs finds only a counter in lib/core/review-contract.cjs lines 253 to 295, which counts and does not cap. The only gate is test-270, which needs an exact count and a 10 percent byte band. (PROVEN)
- No client limit on tool count was found for the Claude hosts. (UNVERIFIED)
- A router would rename 23 shipped tools, pinned in 3 fixtures, 2 command docs and one skill. (CITED)
- The 25 Eureka tools were already re-baselined on 2026-10-24 in commit 6bc8cfc55 (beta.74 squash). (PROVEN, git log)

Surfaces: CLI the tool list is what Larry loads. Desktop the same list. Cowork UNVERIFIED.

Cost of each non-KEEP option: neither option builds a router in this phase. KEEP: plan 374-14 records the final token figure and closes the router question for Phase 374. ROUTER-NEXT: the same record plus a handoff section with the measured figures, so a later phase can design and measure a router. No code in either case.

Recommendation: KEEP. Reason: the surface has room (8,074 bytes), no rule or client limit blocks it, and a router breaks 23 pinned names for a gain nobody has measured.

OPTIONS OD-1: KEEP | ROUTER-NEXT ; RECOMMENDED: KEEP

Recommended token: RECOMMENDED resolves OD-1 to KEEP. Plan 374-14 acts on OD-1 and records the figure either way.
Undo: edit the record. No code.
Consuming plan: 374-14.

GROUP G1: OD-1
GROUP-SHA256 G1: 0000000000000000000000000000000000000000000000000000000000000000
OWNER-ANSWER G1: PENDING

## G2 A tool to forget a finished run

### OD-2 forget tool

Question: do you want a tool that lets a person delete a finished pair-screen run from the engine's 30 day store?

Facts:
- The engine has `scout_delete_job` at src/mindrian_eureka/opportunity_pairs/mcp_server.py line 432 (def found by grep, read only). (PROVEN)
- The run contract step 10 says: when the person asks to forget the run, the host calls `scout_delete_job`. The job record stays 30 days (`RETENTION_SECONDS` = 30 days, jobs.py line 21). (PROVEN, read)
- The engine tree has no command-line way to delete one job. I grepped scout_cli.py, opportunity_pairs/cli.py and cli.py for delete: the only hits are the two embedding cache clear commands (opportunity_pairs/cli.py lines 61 and 72, `eureka-rs-cache-clear`), which clear vectors and not jobs. The pyproject scripts list has no job delete script. Same result as the planner, now re-run. (PROVEN)
- The job store file exists on this machine at ~/.local/share/mindrian-eureka/jobs.sqlite3 (ls). Contents not read. (PROVEN)
- commands/eureka.md line 78 says `/mos:eureka enable engine --data` lists the engine data files. (PROVEN)

Surfaces: CLI Larry can call the tool. Desktop the same. Cowork UNVERIFIED.

Cost of ADD-FORGET-TOOL: one new tool `eureka_capability_job_forget` inside lib/mcp/tools/eureka-capability-jobs.cjs (about 450 bytes of schema and description; the mean of the three job tools is 447), 75 to 76 tools, an edit of the AFTER constant in tests/test-270-tool-schema-budget.cjs, a regenerated 384 golden, moved 267 pins and 1 membership entry, one connector row. health.registered does not change because the file already exists. The tool needs `confirm: true`.
Cost of KEEP: the approval card says the record stays 30 days, names the engine data folder that `/mos:eureka enable engine --data` lists, and gives no in-product way to forget a run.

Recommendation: ADD-FORGET-TOOL. Reason: it is the only way to honor "forget this run" inside the product, and the content of the run (titles, source refs) rests under the user's home folder for 30 days.

OPTIONS OD-2: KEEP | ADD-FORGET-TOOL ; RECOMMENDED: ADD-FORGET-TOOL

Recommended token: RECOMMENDED resolves OD-2 to ADD-FORGET-TOOL.
Undo: remove the registration, the connector row and the pins (a small plan).
Consuming plan: 374-13. Plan 374-08 reads this answer for the wording of the approval card.

GROUP G2: OD-2
GROUP-SHA256 G2: 0000000000000000000000000000000000000000000000000000000000000000
OWNER-ANSWER G2: PENDING

## G3 Result count and node caps

### OD-3 caps

Question: do you want the pair-screen and scout `top_k` cap raised from 100 to 200, and do you want the node cap raised from 2,500 to 3,000?

Facts:
- The plugin `top_k` max is 100 at lib/mcp/tools/eureka-graph-opportunity-scout.cjs line 71 (`max(100)`). It is the only `top_k` cap in the Eureka tool files. (PROVEN, grep)
- The engine accepts 200: `MAX_TOP_K` is 200 in src/mindrian_eureka/limits.py line 11, and the input models in opportunity_pairs/mcp_server.py use `le=MAX_TOP_K` (lines 64, 76, 108). (PROVEN, read only)
- The node cap of 2,500 is not at five sites as the planner wrote. I found the 2,500 pattern in 14 files: 13 Eureka tool files in lib/mcp/tools (scout lines 68 and 70, prepare-artifacts lines 51 and 53, projection line 103, genesis-plan, map, rank-paths, analyze, compare-topics, backtest, score-surprise, package-relationships, discovery-signals) plus `MAX_NODE_IDS` at lib/core/navigation/engine-projection.cjs line 10. A re-plan for NODES-3000 must cover all of them. (PROVEN, grep; the planner's number differs)
- The engine caps `graph.prepare_artifact_bundle` at 2,500: `max_artifacts` must be 2 to 2500 (graph_relations/runner.py lines 26 and 27). Raising only the plugin does nothing. (PROVEN, read only)
- The plugin projection output ceiling is 12 MiB (`MAX_OUTPUT_BYTES`, engine-projection.cjs line 13) and 3,000 nodes of 4,096 characters (`MAX_TEXT_CHARS`, line 11) is 12,288,000 bytes of text alone, against 12,582,912 bytes. (PROVEN, arithmetic on constants)
- Engine memory: about 1.7 GB at 2,117 records and ASSUMED about 3.4 GB at 3,000 (limits.py comment, lines 16 and 17). Engine requirement LIM-01 (a memory guard) is open. (CITED)

Surfaces: CLI the schema limit changes what Larry may send. Desktop the same. Cowork UNVERIFIED.

Cost of each non-KEEP option: TOPK-200 edits one schema constant (a tool schema change: the 384 golden and the 267 pins move, once, in plan 374-13). NODES-3000 has NO plan in this set: it needs Eureka ask EXT-04 and a memory guard first. Answering NODES-3000 stops plan 374-12 with PLAN-REPLAN and the planner writes a new plan.

Recommendation: TOPK-200. Reason: the engine already takes 200 and one constant is a small, safe change. 3,000 nodes is blocked by the engine, the 12 MiB ceiling and memory.

OPTIONS OD-3: KEEP | TOPK-200 | NODES-3000 ; RECOMMENDED: TOPK-200

Recommended token: RECOMMENDED resolves OD-3 to TOPK-200. The node cap stays 2,500.
Undo: revert one constant and move the pins back.
Consuming plan: 374-12.

GROUP G3: OD-3
GROUP-SHA256 G3: 0000000000000000000000000000000000000000000000000000000000000000
OWNER-ANSWER G3: PENDING

<!-- gsd:write-continue -->
