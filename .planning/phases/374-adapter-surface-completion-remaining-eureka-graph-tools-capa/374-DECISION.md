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

HEAD-AT-DECISION: 6a99855b6acde8c25240e105c72a0d5fe160a049

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
GROUP-SHA256 G1: e24d516435043eb5cc26247b348c02f62fcb0381bacaa84d543465777ace6383
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
GROUP-SHA256 G2: e83089c1bad32ee6aa3cfc77f1b1a9596b0ed7d44d8203d994f75f1c3de03990
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
GROUP-SHA256 G3: dcb3f3d7dd4514d6e8f7dce55a038c4dfed25723b1374c93e9182d931a84f29d
OWNER-ANSWER G3: PENDING

## G4 Where the job pointer record lives

### OD-4 job record location

Question: where should the plugin keep the small pointer record that lets it ask the engine about a job after the host restarts, or should it keep none?

Facts:
- The engine job store is per user: `MINDRIAN_EUREKA_DATA_DIR` or ~/.local/share/mindrian-eureka/jobs.sqlite3 (jobs.py line 26 reads the override; line 38 names the file). Records live 30 days. (PROVEN for the override and file name; the default folder is CITED and the file exists on this machine)
- The plugin keeps open jobs only in memory: `sessions` is a Map at lib/mcp/tools/eureka-capability-jobs.cjs line 16, with a 30 minute lifetime (line 17) and a cap of 8 (line 18). A host restart loses it. (PROVEN)
- Plugin precedent for per-user state is ~/.mindrian/: lib/mcp/answer-route.cjs line 47 builds ~/.mindrian/ui-shell/control.token. (PROVEN)
- The record would hold ids, hashes, counts and times only. It never holds the request, a title, a source ref or result text (D-12). The job id is checked against a strict pattern before it becomes a file name.
- USER-DIR means ~/.mindrian/eureka-jobs/<room_id>/<job_id>.json with owner-only modes and a 30 day sweep. It needs no room write scope.
- ROOM-DIR means <room>/.mindrian/eureka-jobs/. It needs the write-scope check (`isRoomInWriteScope`, lib/core/session-binding.cjs line 126, PROVEN) and it travels with a copy of the room.
- A job that was still running when the host died is lost or doomed whatever you choose: the next engine start marks every running row failed (jobs.py lines 101 to 109, `_recover_interrupted`). (PROVEN, read only)

Surfaces: CLI and Desktop the same record. Cowork UNVERIFIED; a shared room would carry a ROOM-DIR record to other people, a USER-DIR record stays on one machine.

Cost of each non-KEEP option: USER-DIR is one new module (eureka-job-record.cjs) plus its tests and a Part 8 scan-list entry. ROOM-DIR is the same module plus the write-scope check. A completed job survives a restart and its result stays readable from a fresh engine process for 30 days. Cost of KEEP: after a host restart the product cannot ask the engine, and the answer stays the existing honest "job_session_not_found".

Recommendation: USER-DIR. Reason: the engine store is per user too, no room write scope is needed, and a copy of a room does not carry job pointers to another machine.

OPTIONS OD-4: KEEP | USER-DIR | ROOM-DIR ; RECOMMENDED: USER-DIR

Recommended token: RECOMMENDED resolves OD-4 to USER-DIR.
Undo: delete the folder and revert one module.
Consuming plan: 374-10.

GROUP G4: OD-4
GROUP-SHA256 G4: 76a2bd072fa457f8150ab50a330ea216a87e62ea828038366da6b31943cce1e5
OWNER-ANSWER G4: PENDING

## G5 Pair screen card shape and subcommand

Two items. OD-5A decides whether the pair screen is added at all and which approval card the person sees. OD-5B decides whether a new subcommand exists. Plan 374-09 needs OD-5A to be something other than KEEP.

### OD-5A pair screen approval card

Question: do you want the pair screen (the one-command run over both pair engines) added to the product, and if so, which approval card should the person see: F.6 plan review, or F.0 grant?

Facts:
- commands/eureka.md already uses F.6 for plan review and F.0 for grants: the frontmatter `hitl_stages` lists "plan review" with F.6 (line 11) and "quick policy grant" and "engine setup grant" with F.0 (lines 14 and 17). (PROVEN, read lines 9 to 18)
- The engine cannot verify the approval: `verified_by_engine` is always false (pair-screen-output.v1.json line 34, host_run/api.py line 124). The plugin gate is the only check. (PROVEN, read only)
- The card shows counts, dropped records, the two engines, the data statement, the expected files, the model state, the 30 day record and the delete path. It never shows a node title (D-08).
- The person's selected node text (title, source ref, text up to 4,096 characters per node) goes to the local engine over stdio. Nothing goes to Theo or Brain. (CITED, 374-RESEARCH.md Part 8 section)
- The result stays in the engine job store for 30 days under the user's home folder. (PROVEN, run contract line 33)
- The run contract suggests F.6 and says the plugin phase decides (assumption A3 of the research, ASSUMED).
- Plugin side today: the gate is built privately inside lib/mcp/tools/research.cjs; plan 374-03 already extracted it to lib/mcp/approval-gate.cjs (commit 2a8a15a93). (PROVEN, ls and git log)

Surfaces: CLI and Desktop both get the card through the gate renderer. Cowork UNVERIFIED.

Cost of each non-KEEP option: F6 and F0 both add the pair-screen branch to `eureka_capability_start` (0 new tools), one approval gate, a job record call and tests. F6 changes no declared shape (commands/eureka.md already declares F.6). F0 asks the person for a grant with no plan to read, and the Part 11 shape declaration must name it. Cost of KEEP: the pair screen is NOT added; plans 374-08 and 374-09 change nothing.

Recommendation: F6. Reason: the person has a real plan to read (counts, files, model state) before anything starts, which is what a plan review card is for.

OPTIONS OD-5A: KEEP | F6 | F0 ; RECOMMENDED: F6

### OD-5B screen subcommand

Question: do you want a `/mos:eureka screen` subcommand, with `run` left as it is?

Facts:
- `/mos:eureka run` is the research planner perspective and does not change in any option. (PROVEN, commands/eureka.md argument-hint is `[run|enable|enable engine]`, line 5)
- The run contract names `screen` as a suggestion and says the plugin phase decides. (CITED)
- Without the subcommand the pair screen is reachable only through the Eureka capability tools that Larry calls.

Surfaces: CLI the subcommand is a slash command. Desktop reaches the same route by talking to Larry. Cowork UNVERIFIED.

Cost of SCREEN: one documented subcommand in commands/eureka.md and its generated mirrors (a born-wired change: the three Part 11 --check gates must pass), plus tests. Cost of KEEP: no subcommand.

Recommendation: SCREEN. Reason: a person who wants only the pair screen gets a named, documented door, and `run` stays as it is.

OPTIONS OD-5B: KEEP | SCREEN ; RECOMMENDED: SCREEN

Recommended token: RECOMMENDED resolves OD-5A to F6 and OD-5B to SCREEN.
Undo: remove the route entries (a small plan) and the command section.
Consuming plans: 374-08 for OD-5A. 374-09 for OD-5B (and OD-5A must not be KEEP).

GROUP G5: OD-5A, OD-5B
GROUP-SHA256 G5: 24bde605d02e1d9a5e78b5f04c33466f354a8ac1a2ebb28d9f06b1360619ac2b
OWNER-ANSWER G5: PENDING

## G6 Guard against a second Eureka call during a job

### OD-6 interim engine_busy guard

Question: until the Eureka team lands an owner lock, do you want the plugin to refuse a second Eureka call while a job is running?

Facts:
- The owner lock does not exist yet. Source: the Eureka session's answer of 2026-11-08. My own check agrees: grep for owner lock in the engine src and docs finds nothing. Other branches are UNVERIFIED (research assumption A7).
- Every new engine process marks all running job rows failed when it starts: `_recover_interrupted` runs from the store open (jobs.py lines 95 and 101 to 109), with no owner check. (PROVEN, read only)
- A late worker can overwrite its row because `transition()` has no terminal-state guard. (CITED, jobs.py near line 166)
- The plugin starts one child engine process for every job and every graph workflow call. Spawn sites found by grep: eureka-capability-jobs.cjs line 40, eureka-graph-analyze.cjs lines 30 and 120, eureka-capability-run.cjs line 211. (PROVEN)
- So today a graph call during a running job can fail that job. The hazard exists now for scout_start jobs too.
- The guard covers ONE host process. CLI and Desktop running at once stay unprotected. (UNVERIFIED)
- A host kill may leave the engine child alive until its job ends (research assumption A1, UNVERIFIED; a live test decides and cannot run here).

Surfaces: CLI one host process, covered. Desktop the same, but a second host stays unprotected. Cowork UNVERIFIED.

Cost of ENGINE-BUSY-GUARD: while a job has not reached a terminal state in this process, any other Eureka call except status, result, cancel and the room projection answers a typed `engine_busy`. The person waits or cancels. Plus a guard module and tests. Cost of KEEP: the hazard stays as it is today for all async jobs.

Recommendation: ENGINE-BUSY-GUARD. Reason: it stops the common way a person loses a long run (asking a graph question mid-run) and it can be removed when the Eureka lock lands. It is a mitigation, not the fix.

OPTIONS OD-6: KEEP | ENGINE-BUSY-GUARD ; RECOMMENDED: ENGINE-BUSY-GUARD

Recommended token: RECOMMENDED resolves OD-6 to ENGINE-BUSY-GUARD. The multi-host case stays UNVERIFIED in the summary.
Undo: remove the guard (small).
Consuming plan: 374-11.

GROUP G6: OD-6
GROUP-SHA256 G6: d58fbe34bbefb1bf69d8a0bbabadf46f6f767012c62965293a52a4bc20ffced5
OWNER-ANSWER G6: PENDING

## G7 Large job results

### OD-7 paging above 256 KiB

Question: when a job result is larger than 256 KiB, how should the product keep it out of the model's context?

Facts:
- 256 KiB is a warning only today: `TEXT_WARNING_BYTES = 256 * 1024` at lib/mcp/eureka-tool-contract.cjs line 238. (PROVEN)
- The pair-screen result is about 0.5 MB for 200 pairs from each engine. This is an estimate in the run contract and was not measured. (ASSUMED, run contract line 299)
- The pair-screen route builds its bundle inside the plugin from node ids, so the bundle never passes through the model. (CITED, plan 374-08 design)
- The projection tools `eureka_graph_project` and `eureka_graph_prepare_artifacts` can return up to 12 MiB (`MAX_OUTPUT_BYTES`, engine-projection.cjs line 13). (PROVEN)
- PAGE-ARG: one optional `page` input on `eureka_capability_job_result`. Below 256 KiB nothing changes. Above it the answer carries counts, hashes, the label and one page of pairs with paging info, and the inline file text stays inside the plugin (hash-checked there). 0 new tools.
- PAGE-ARG-PROJECTION would do the same for the two projection tools. It has NO plan in this set.
- HANDLE-TOOL would return a handle and add a read tool: +1 tool, about 1,000 bytes. It has NO plan in this set.

Surfaces: CLI and Desktop the same answer shape. Cowork UNVERIFIED.

Cost of each non-KEEP option: PAGE-ARG edits one tool schema (the 384 golden and the 267 pins move once, in plan 374-13) and adds tests. Answering PAGE-ARG-PROJECTION or HANDLE-TOOL stops plan 374-12 with PLAN-REPLAN and the planner writes a new plan. Cost of KEEP: large results keep returning whole with the warning.

Recommendation: PAGE-ARG. Reason: it solves the job result case with 0 new tools and keeps today's behavior below 256 KiB.

OPTIONS OD-7: KEEP | PAGE-ARG | PAGE-ARG-PROJECTION | HANDLE-TOOL ; RECOMMENDED: PAGE-ARG

Recommended token: RECOMMENDED resolves OD-7 to PAGE-ARG.
Undo: remove the optional argument and move the pins back.
Consuming plan: 374-12.

GROUP G7: OD-7
GROUP-SHA256 G7: 48fc7bc049c39da92f7d7e17aeacd80391e05385f6efa7700dd8e87cf9ae0e8b
OWNER-ANSWER G7: PENDING

## Eureka asks

These are asks to the Eureka session. They are not choices. The Eureka repo is not edited by this phase (D-01).

- EXT-01: a job-store owner lock and a terminal-state guard. Why: a second engine process must not fail a running row, and a late worker must not overwrite a finished one. Until then: the engine_busy guard of G6.
- EXT-02: a status read path that does not run `_recover_interrupted`. Why: a status-only child after a host restart can otherwise fail a still-running row. Until then: the answer states the limit.
- EXT-03: workers that read `cancel_requested`. Why: today only `request_cancel` writes it, so a cancel from another process does nothing. Until then: a recovered job answers cancel_unavailable_after_restart.
- EXT-04: lift `graph.prepare_artifact_bundle` above 2,500 and add a memory guard (LIM-01). Why: needed only if the owner answers NODES-3000 on G3. Until then: the node cap stays 2,500.
- EXT-05: the commit id of the owner lock and of a distinct budget_exceeded status, if they exist on a branch the research could not see. Why: the ROADMAP gate "lock and budget status landed" stays open without it. Until then: recorded in the summaries.

## What happens after your answer

- A card answered KEEP-ALL gets no work from its plan. A plan whose act items all resolve to KEEP stops with PLAN-DECLINED and changes nothing.
- A card answered RECOMMENDED or CUSTOM lets its plan act, as far as the resolved options say.
- An answer that no plan covers (NODES-3000, PAGE-ARG-PROJECTION, HANDLE-TOOL) stops the consuming plan with PLAN-REPLAN. The planner then writes a new plan.
- Each gated plan starts with the 374-gate.cjs plan check and stops on any exit code other than 0.
- Nothing is pushed, tagged or released by these plans. A change reaches users only after a release is cut and picked up.

## How the answer is recorded

The main session writes your token into the answer line of each card and commits that one edit with git commit --only on this one path. The options and the hash on the card lines are sealed: if an option line changes after your answer, the gate refuses the answer and asks again.
