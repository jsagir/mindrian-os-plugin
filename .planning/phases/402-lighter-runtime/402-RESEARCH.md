---
phase: 402
kind: research (EGM elephant)
date: 2026-11-27
measured_tree: worktree /home/jsagi/dev/MindrianOS-Plugin-405, branch work/405-desktop, commit 142dec60ada862a4289d994d70a289b933785b18
method: "git archive HEAD into the session scratch folder; node_modules linked from /home/jsagi/dev/MindrianOS-Plugin-release (npm-shrinkwrap.json byte-identical, cmp); hermetic mkdtemp HOME; no network; no file in the repo written by a measure"
marks: "PROVEN = read in a file or run here. CITED = a doc or a planning file says it; not re-run here. GUESS = inference. UNVERIFIED = not run."
tokens: bytes / 4 (the rule of lib/core/doctor/mcp-surface-module.cjs:93-98)
---

# Phase 402 RESEARCH

## 1. Summary

1. PROVEN: the mindrian-os server lists 76 tools on a desktop surface and 73 on the CLI surface. The 3 extra tools are the MCP App views. The tool count already depends on the surface.
2. PROVEN: description plus input schema is 86,250 B for 76 tools (about 21.6k tokens). The R3 hot 18 are 24,833 B. The 5 tools that program C3 names are 6,550 B. A hot list of 23 is 31,383 B. The deferred rest is 54,867 B (about 13.7k tokens).
3. PROVEN: no test compares the `_meta` of a tool on the wire as a whole object. A per-tool load mark in `_meta` moves no byte pin and no golden file.
4. PROVEN: tests/test-114-mcp-alwaysload.sh is the only test that requires `alwaysLoad === true` on mindrian-os. tests/test-127-00-shim-handshake.sh requires it on mindrian-brain (R3 keeps the Brain entry).
5. CITED (host doc re-read 2026-11-27): with tool search on, every MCP tool is deferred by default. `_meta["anthropic/alwaysLoad"]: true` loads one tool up front. A server-level `alwaysLoad: true` loads all tools and overrides the marks. A server-level `false` defers all tools, marked ones too.
6. PROVEN: 400.5 took Path H (one command dispatcher for UserPromptSubmit). It adds no MCP tool in this cut. The K3 defect site is in the 400.5 scope.
7. PROVEN: scripts/check-card-fire.cjs still sends `continue: false` with `decision: 'block'` (:869-876) and does not read `stop_hook_active`. Its lock wait can run 6 s under a 5 s hook budget.
8. PROVEN: branch work/402-cardfire-startcap exists and has 0 commits past main (acb4de477). The K4 and F2 plans are not written.

## 2. The tool list with bytes per tool

Method (PROVEN, run here): `initialize`, `notifications/initialized`, `tools/list` over stdio through tests/helpers/mcp-wire-267.cjs `rpcOverStdio` (:108), with `MINDRIAN_TRANSPORT=stdio` (the env of tests/test-270-tool-schema-budget.cjs:59-63). Cold answer: 362 ms. "Desc B" and "Schema B" use the arithmetic of test-270 `measure()` (:143-152). "Full JSON B" is `JSON.stringify(tool)` and includes title, annotations, outputSchema and `_meta`.

Totals:

| Set | Tools | Desc + schema B | Tokens | Full JSON B | Name B |
|---|---|---|---|---|---|
| All (desktop surface) | 76 | 86,250 | 21,563 | 130,788 | 1,329 |
| R3 hot 18 | 18 | 24,833 | 6,208 | 26,971 | 208 |
| Added by program C3 (chain_run, memory_event, graph_write, room_changes, room-dashboard) | 5 | 6,550 | 1,638 | 7,235 | 58 |
| Hot 23 | 23 | 31,383 | 7,846 | 34,206 | 266 |
| Deferred 53 | 53 | 54,867 | 13,717 | 96,582 | 1,063 |
| Eureka and RS family (25 `eureka_*`, 2 `rs_*`) | 27 | 27,890 | 6,973 | 67,216 | 742 |
| Deferred, not in the family | 26 | 26,977 | 6,744 | 29,366 | 321 |

Notes:
- test-270 AFTER (:532-541) records 37,764 + 47,835 = 85,599 B. Measured here: 38,236 + 48,014 = 86,250 B. Drift 0.76 percent, inside the 10 percent tolerance (:621-624). PROVEN.
- The 400.1 host record for 76 tools is 89,128 characters (400.1-RESEARCH.md:110). Desc + schema + names here is 87,579 B. So the host sends name, description and input schema. GUESS: the host does not send `outputSchema` (27 tools carry one; 1,255 B each on 25 of them).
- All 76 input schemas carry a `$schema` key (PROVEN). Stripping it is a Phase 401 item.
- Largest hot description: gate_answer, 2,028 characters. The host limit for an up-front tool is 4,096 characters (CITED). No hot tool is cut.
- CLI surface (`CLAUDE_SURFACE=cli`): 73 tools, 0 app tools (PROVEN, run here). Cause: `CAPABILITY_MAP.cli.apps` is false (lib/mcp/surface-detect.cjs:26-30) and `registerAppViews` runs only when `capabilities.apps` is true (lib/mcp/capability-registry.cjs:50-53). tests/test-384-s7-mcp-start.cjs:175 pins 73 for that surface.

Rule columns: H1 = named in the served instructions. H2 = a 405 receipt writer or the read-back route. H3 = carries a 405 chat component. H4 = in the R3 list of 18.

| # | Tool | Desc B | Schema B | Desc + schema B | Full JSON B | Rule hits | Hot | Bare name in commands / skills / agents |
|---|---|---|---|---|---|---|---|---|
| 1 | gate_render | 1681 | 2339 | 4020 | 4192 | H1, H3, H4 | yes | 2 / 2 / 0 |
| 2 | chain_run | 1113 | 1988 | 3101 | 3269 | H1, H3 | yes | 8 / 9 / 0 |
| 3 | research_run | 1308 | 1454 | 2762 | 2945 | none | no | 8 / 8 / 0 |
| 4 | eureka_hsi_interpret_whitespace | 346 | 2117 | 2463 | 3985 | family (never hot) | no | 1 / 1 / 0 |
| 5 | gate_answer | 2028 | 316 | 2344 | 2516 | H1, H2, H3, H4 | yes | 4 / 4 / 1 |
| 6 | context_assemble | 984 | 1343 | 2327 | 2413 | H1, H4 | yes | 1 / 1 / 1 |
| 7 | claim_write | 668 | 1597 | 2265 | 2341 | H2, H4 | yes | 0 / 1 / 2 |
| 8 | meeting | 1207 | 981 | 2188 | 2256 | none | no | n/a (plain word) |
| 9 | identity_write | 394 | 1637 | 2031 | 2113 | none | no | 0 / 0 / 0 |
| 10 | claim_verify | 267 | 1715 | 1982 | 2060 | none | no | 0 / 0 / 0 |
| 11 | artifact_file | 737 | 1131 | 1868 | 1948 | H2, H4 | yes | 2 / 4 / 0 |
| 12 | question_set | 646 | 1209 | 1855 | 1937 | none | no | 1 / 1 / 0 |
| 13 | orchestration | 897 | 869 | 1766 | 1848 | H4 | yes | n/a (plain word) |
| 14 | eureka_critic | 163 | 1518 | 1681 | 1761 | family (never hot) | no | 0 / 0 / 0 |
| 15 | room_content | 960 | 642 | 1602 | 1680 | none | no | 1 / 1 / 0 |
| 16 | eureka_graph_opportunity_scout | 789 | 660 | 1449 | 2953 | family (never hot) | no | 1 / 1 / 0 |
| 17 | eureka_capability_start | 1039 | 407 | 1446 | 2929 | family (never hot) | no | 1 / 1 / 0 |
| 18 | eureka_capability_run | 1077 | 341 | 1418 | 2904 | family (never hot) | no | 1 / 1 / 0 |
| 19 | graph_reason | 533 | 860 | 1393 | 1475 | none | no | 0 / 1 / 0 |
| 20 | room_changes | 368 | 946 | 1314 | 1392 | H2 | yes | 0 / 0 / 0 |
| 21 | framework_run | 424 | 878 | 1302 | 1382 | none | no | 0 / 0 / 0 |
| 22 | room_search | 801 | 426 | 1227 | 1303 | H4 | yes | 0 / 1 / 0 |
| 23 | eureka_graph_find_network_holes | 531 | 642 | 1173 | 2683 | family (never hot) | no | 0 / 0 / 0 |
| 24 | room_graph | 539 | 625 | 1164 | 1238 | H4 | yes | 0 / 0 / 0 |
| 25 | status_read | 483 | 657 | 1140 | 1216 | H1, H4 | yes | 0 / 0 / 0 |
| 26 | eureka_graph_package_relationships | 277 | 862 | 1139 | 2650 | family (never hot) | no | 1 / 1 / 0 |
| 27 | analysis | 567 | 570 | 1137 | 1207 | none | no | n/a (plain word) |
| 28 | export | 725 | 398 | 1123 | 1189 | none | no | n/a (plain word) |
| 29 | gate_list | 885 | 229 | 1114 | 1186 | none | no | 0 / 0 / 0 |
| 30 | eureka_graph_analyze | 360 | 739 | 1099 | 2585 | family (never hot) | no | 1 / 1 / 0 |
| 31 | eureka_graph_propose_relationships | 310 | 739 | 1049 | 2565 | family (never hot) | no | 1 / 1 / 0 |
| 32 | eureka_graph_find_community_bridge_pairs | 499 | 535 | 1034 | 2560 | family (never hot) | no | 0 / 0 / 0 |
| 33 | eureka_graph_assess_category_edge_patterns | 498 | 534 | 1032 | 2556 | family (never hot) | no | 0 / 0 / 0 |
| 34 | graph_write | 157 | 870 | 1027 | 1103 | H2 | yes | 0 / 0 / 0 |
| 35 | room_list | 936 | 90 | 1026 | 1273 | H1, H4 | yes | 0 / 0 / 0 |
| 36 | eureka_graph_project | 580 | 437 | 1017 | 2513 | family (never hot) | no | 1 / 1 / 0 |
| 37 | eureka_graph_compare_topics | 308 | 704 | 1012 | 2515 | family (never hot) | no | 1 / 1 / 0 |
| 38 | eureka_graph_find_similar_unlinked_items | 507 | 498 | 1005 | 2525 | family (never hot) | no | 0 / 0 / 0 |
| 39 | eureka_graph_score_surprise | 270 | 733 | 1003 | 2505 | family (never hot) | no | 1 / 1 / 0 |
| 40 | eureka_graph_map_neighbourhoods | 291 | 685 | 976 | 2498 | family (never hot) | no | 1 / 1 / 0 |
| 41 | eureka_graph_rank_paths | 280 | 678 | 958 | 2447 | family (never hot) | no | 1 / 1 / 0 |
| 42 | eureka_graph_find_shared_neighbor_gaps | 485 | 465 | 950 | 2473 | family (never hot) | no | 0 / 0 / 0 |
| 43 | claim_read | 309 | 576 | 885 | 959 | H4 | yes | 0 / 0 / 0 |
| 44 | suggest_next | 436 | 397 | 833 | 911 | H1, H3, H4 | yes | 0 / 1 / 1 |
| 45 | room_state | 456 | 373 | 829 | 903 | H4 | yes | 0 / 0 / 0 |
| 46 | eureka_capability_job_result | 560 | 252 | 812 | 2297 | family (never hot) | no | 1 / 1 / 0 |
| 47 | extract_shallow | 439 | 367 | 806 | 890 | none | no | 1 / 1 / 0 |
| 48 | eureka_graph_genesis_plan | 333 | 436 | 769 | 2274 | family (never hot) | no | 1 / 1 / 0 |
| 49 | eureka_graph_prepare_artifacts | 317 | 433 | 750 | 2270 | family (never hot) | no | 1 / 1 / 0 |
| 50 | stop_gate_check | 460 | 285 | 745 | 829 | H1, H4 | yes | 1 / 1 / 0 |
| 51 | whitespace_scan | 650 | 90 | 740 | 824 | none | no | 0 / 0 / 0 |
| 52 | eureka_graph_backtest | 298 | 435 | 733 | 2241 | family (never hot) | no | 1 / 1 / 0 |
| 53 | methodology | 128 | 604 | 732 | 808 | none | no | n/a (plain word) |
| 54 | contradiction_check | 253 | 478 | 731 | 823 | none | no | 0 / 0 / 0 |
| 55 | room_create | 426 | 296 | 722 | 987 | H1, H2, H4 | yes | 0 / 0 / 0 |
| 56 | rs_experts_find | 303 | 400 | 703 | 2836 | family (never hot) | no | 2 / 2 / 0 |
| 57 | eureka_capability_job_forget | 435 | 249 | 684 | 2169 | family (never hot) | no | 1 / 1 / 0 |
| 58 | view_compile | 288 | 396 | 684 | 762 | none | no | 0 / 0 / 0 |
| 59 | memory_event | 168 | 513 | 681 | 759 | H2 | yes | 13 / 16 / 2 |
| 60 | question_read | 449 | 222 | 671 | 757 | none | no | 0 / 0 / 0 |
| 61 | reach_candidates | 248 | 366 | 614 | 700 | none | no | 0 / 0 / 0 |
| 62 | graph_query | 171 | 438 | 609 | 685 | none | no | 0 / 1 / 0 |
| 63 | room_bind | 254 | 330 | 584 | 656 | H1, H4 | yes | 0 / 0 / 0 |
| 64 | intelligence | 130 | 452 | 582 | 660 | none | no | n/a (plain word) |
| 65 | room_artifact | 190 | 387 | 577 | 657 | none | no | 0 / 0 / 0 |
| 66 | room_startup | 485 | 90 | 575 | 845 | H1, H4 | yes | 0 / 0 / 0 |
| 67 | rs_thesis_read | 280 | 287 | 567 | 1597 | family (never hot) | no | 2 / 2 / 0 |
| 68 | chain_resolve | 206 | 307 | 513 | 593 | H1, H4 | yes | 0 / 0 / 0 |
| 69 | detect_dual_path | 284 | 226 | 510 | 596 | none | no | 1 / 1 / 0 |
| 70 | eureka_capability_job_status | 310 | 197 | 507 | 1988 | family (never hot) | no | 1 / 1 / 0 |
| 71 | eureka_capability_job_cancel | 264 | 197 | 461 | 1937 | family (never hot) | no | 1 / 1 / 0 |
| 72 | room-dashboard | 236 | 191 | 427 | 712 | H1 | yes | 1 / 1 / 0 |
| 73 | room-graph | 139 | 271 | 410 | 597 | none | no | 1 / 2 / 0 |
| 74 | room-wiki | 134 | 229 | 363 | 546 | none | no | 1 / 1 / 0 |
| 75 | contract_version | 141 | 90 | 231 | 317 | none | no | 0 / 0 / 0 |
| 76 | room_state_bound | 138 | 90 | 228 | 314 | none | no | 0 / 0 / 0 |

The last column counts files that hold the bare tool name. It is weak evidence: 6 router tools have plain English names (analysis, export, intelligence, meeting, methodology, orchestration), and `memory_event` is also the name of a node type. No command, skill or agent file holds a prefixed name `mindrian-os__<tool>` (0 hits for all 76 tools, PROVEN). So no `allowed-tools` line and no agent `tools:` line pre-approves or needs a mindrian-os tool.

## 3. Which tools the instructions, the skills, the hooks and Phase 405 name

| Source | Tools | Evidence |
|---|---|---|
| Served instructions (2,000 B, PROVEN by run) | suggest_next, chain_resolve, chain_run, gate_answer (line 35); room_list, room_create, gate_answer, room_bind, context_assemble, room_startup, room-dashboard, suggest_next, gate_render, stop_gate_check, status_read (line 37). 13 distinct tools. | lib/mcp/runtime-instructions.cjs:35-39 |
| Hook matcher on a mindrian-os tool | gate_answer (PreToolUse, scripts/card-before-answer-hook.cjs) | hooks/hooks.json:219-223 |
| 405 receipt writers | artifact_file, claim_write, memory_event, graph_write, gate_answer (approve), room_create (approve) | 405-DESIGN-r4.1.md:100 |
| 405 read-back route | room_changes | 405-RESEARCH.md section 6 (CITED by program C3) |
| 405 chat components | gate_render, gate_answer, chain_run (C1); `framework_play` (C2, not built; 405 slice 13); suggest_next (C3) | 405-DESIGN.md:203-216 |
| Tools with an MCP App view today | gate_render, gate_answer, chain_run (`ui://mindrian-os/decision/v1.html`); room_list, room_create, room_startup (`ui://mindrian-os/rooms/v4.html`); room-dashboard, room-wiki, room-graph | tools/list `_meta.ui` (PROVEN by run); lib/mcp/gate-app.cjs, lib/mcp/room-app.cjs, lib/mcp/app-views.cjs:333-392 |
| R3 hot 18 | artifact_file, room_bind, context_assemble, room_state, room_graph, room_list, orchestration, room_search, room_startup, status_read, gate_answer, gate_render, claim_write, claim_read, suggest_next, stop_gate_check, chain_resolve, room_create | .planning/research/2026-11-24-plugin-efficiency/03-mos-runtime-cost.md:56 |
| Owner use, 60 days (CITED) | artifact_file 102, room_bind 25, context_assemble 13, room_state 11, room_graph 10; 48 of 76 tools had 0 calls; Eureka tools 2 calls; gate_render and chain_run 0 | same file, section 2 |

Gap (program C3, PROVEN): chain_run, memory_event, graph_write, room_changes and room-dashboard are named by the instructions or by 405 and are not in the R3 list. room-dashboard exists only on a surface with `apps: true`.

Not named by any rule: the 6 router tools other than orchestration (methodology, analysis, intelligence, meeting, export, room_content). In the Desktop chat these are the route to a framework run. GUESS: a deferred router tool is found by tool search from its name and description. UNVERIFIED until spike SP9.

## 4. Every test or gate that pins tool count, tool bytes, alwaysLoad or a tool list

| Pin | File and line | What it requires | Effect of 402 |
|---|---|---|---|
| Tool count 76 | tests/test-270-tool-schema-budget.cjs:535, :616 | measured count equals AFTER.toolCount, with `MINDRIAN_TRANSPORT=stdio` | none if no tool is added or removed |
| Tool bytes | same file :538, :621-624 | total desc + schema within 10 percent of 85,599 | none; `_meta` is not measured (:151-152) |
| Tool count 73 and full list | tests/test-384-s7-mcp-start.cjs:175-181; tests/fixtures/384-s7-tools-list-golden.json | CLI-surface count 73; name, title, description, inputSchema, outputSchema, annotations equal the golden (label at :179); 37 registered files | none; `_meta` is not in the compared fields |
| Wire snapshot | tests/helpers/mcp-wire-267.cjs:217-262, :304-372; tests/fixtures/267/wire-snapshot-zod4.json | name, title, description, inputSchema per tool; instructions | none |
| Census | /home/jsagi/dev/MindrianOS-Plugin-367 tests/test-367-governed-census.cjs:384-415; lib/mcp/graph-catchup-spawn.cjs:40-122 | every live tool name is in GOVERNED or PURE_READ, in one only, and no listed name is missing from the live union. Counted here: GOVERNED 69, PURE_READ 7 (PROVEN by `require` on that worktree) | a conditional tool set breaks the third check on a machine with no Eureka engine |
| alwaysLoad true on mindrian-os | tests/test-114-mcp-alwaysload.sh:14-27; sub-test "AC-114-03" of tests/test-114-larry-default-activation.sh:14 | `alwaysLoad === true` | must be rewritten |
| alwaysLoad true on mindrian-brain | tests/test-127-00-shim-handshake.sh:102-106 | `alwaysLoad === true` | none (R3 keeps the Brain entry) |
| alwaysLoad absent in foreign bundles | tests/test-234-dist-bundle.cjs:78, :136-140; scripts/build-dist-bundles.cjs:150-163 | the generated `.mcp.json` for a foreign host holds no `alwaysLoad` key | none |
| App tool `_meta.ui.resourceUri` | tests/test-gpt-plugin-ui.cjs:33; tests/test-larry-theo-face-apps.cjs:85 | one field read, not a whole-object compare | none if the mark is merged into `_meta` and does not replace it |
| Instructions bytes | lib/mcp/no-instructions.test.cjs; tests/test-359-prose-budget.cjs:88; data/harness-policies/contract-parity-larry.json:46 | 2,000 B budget, 2,048 B cap, frozen BOUNDARIES | none; 402 does not edit the instructions |
| Doctor surface row | lib/core/doctor/mcp-surface-module.cjs:89, :331-345 | WARN when the whole tools/list is over 8,000 tokens | stays WARN; the row cannot see deferral (400.1 Pitfall 6) |
| Capability ledger row | data/capability-ledger.json:225-232 (`mcp-alwaysload-per-server-eager-token-trade`, status dormant) | a recorded trade | must be updated with the new state |

Known red at base (PROVEN, run here, not caused by 402): tests/test-127-00-shim-handshake.sh tests 4 and 6 fail. They expect `${CLAUDE_PLUGIN_ROOT}/bin/...`; `.mcp.json:5` and `:10` use `${CLAUDE_PLUGIN_ROOT}/scripts/...`. Classification: known tracked class (a pin moved by later work), not a 402 item.

Search limit: the `_meta` claim in summary item 3 rests on a grep of `tests/*.cjs` and `lib/**/*.test.cjs` for `_meta` beside an equality assert. 54 files send `tools/list`. They were not all read line by line. UNVERIFIED for the tail.

## 5. Host facts (CITED; https://code.claude.com/docs/en/mcp and /hooks, read 2026-11-27 through a fetch agent; the middle of both pages came as a summary)

1. "Tool search is enabled by default: MCP tools are deferred and discovered on demand." "Only tool names and server instructions load at session start."
2. Server-level `alwaysLoad: true`: the server's tools "load into context regardless of the ENABLE_TOOL_SEARCH setting", and startup waits for the server "capped at the standard 5-second connect timeout".
3. Per-tool: set `"anthropic/alwaysLoad"` in the tool's `_meta`. `true`: "The tool loads upfront. Startup doesn't wait for your server because of this value." The person who configures the server can override it.
4. Server-level `alwaysLoad: false` keeps all tools deferred, and "That includes tools that the server's author has marked to load upfront." "If you leave `alwaysLoad` out, those marked tools load upfront." Needs v2.1.287 or later.
5. Per-tool `false` needs v2.1.285 or later and applies to a server from `--mcp-config`, an Agent SDK application or a plugin.
6. The page gives no minimum version for per-tool `true`. The floor 2.1.285 in the ROADMAP is the version of the per-tool `false` value. GUESS: per-tool `true` arrived in the same release. UNVERIFIED.
7. `ENABLE_TOOL_SEARCH=false` loads all MCP tools up front. On models before Claude Opus 4, Sonnet 4 and Haiku 4.5 all tools load up front. A denied `ToolSearch` tool gives the same result. In these 3 cases 402 changes nothing.
8. Description limits: 4,096 characters for server instructions and for a tool that loads up front; 16,384 for a tool loaded through tool search.
9. Hooks: stdout counts as JSON only when it is one JSON object with only whitespace around it. Context from a hook is capped at 10,000 characters; over the cap the host keeps a preview of the first 2,000 characters.
10. A hook matcher on an MCP tool name fires on the tool call. The pages do not say that a deferred tool behaves differently. GUESS: the gate_answer matcher (hooks/hooks.json:219) still fires for a deferred tool.
11. Not stated on any page: whether the Desktop chat honours the per-tool mark of an extension server (400.1-RESEARCH.md:106). The chat has its own "Tool access" mode per conversation (Auto, Always available, On demand). UNVERIFIED; spike SP9.

Host records (CITED, 400.1-RESEARCH.md:108-111): the CLI and the Desktop Code tab load all mindrian-os tools up front today and defer 397 to 4,053 other tool names. The per-tool mark is not tested on any surface.

## 6. Where a load mark can be set (PROVEN)

- Every tool is registered with `server.registerTool(name, config, handler)`: 11 calls in lib/mcp/tool-router.cjs (:1030 to :2443), the modules of lib/mcp/tools/ through lib/mcp/register-core-tools.cjs:62-110, and the app views (lib/mcp/app-views.cjs:333-392).
- The SDK sends `config._meta` on the wire unchanged (node_modules/@modelcontextprotocol/server 2.1.0, dist/mcp-DUcCQSTW.cjs:1730 `_meta: tool._meta`). Run proof: gate_render answers with `_meta.ui`.
- One server object is built in `createServer` (scripts/mindrian-mcp-server.cjs:232-290). `registerRouterTools` is the first registration (:256).
- Precedent for a `registerTool` wrapper: `installCatchupWrapper` on the 367 branch replaces `s.registerTool`, wraps only the handler and forwards the config (lib/mcp/graph-catchup-spawn.cjs:208-231, installed at scripts/mindrian-mcp-server.cjs:247 on that branch). A second wrapper that changes only `config._meta` composes with it in either order.
- `.mcp.json:6` holds the server-level key for mindrian-os; `:11` for mindrian-brain. The mos-desktop copy and the `.mcpb` are built from the npm pack payload (scripts/release.sh:1020; scripts/release-lib/desktop-copy-gate.sh:10-27), so they carry the same server code and the same marks.
- The `.mcpb` manifest has no `.mcp.json` and no alwaysLoad key (405-DESIGN.md 3.7; field names UNVERIFIED until slice 0 of 405). In the chat only the wire mark can carry the rule.

## 7. Eureka tools (PROVEN unless marked)

- 25 `eureka_*` tools and 2 `rs_*` tools: 27,890 B of desc + schema, 32 percent of the surface. 25 of the 27 carry an `outputSchema`.
- All 27 register on every machine. No registration reads the engine state. The engine state is a cheap synchronous read: `resolveEngine(env)` returns `absent`, `present` or `broken` (lib/core/eureka/eureka-engine-resolver.cjs:181-203).
- A tool that needs the engine refuses with a fix line when the engine is absent (`ENGINE_REQUIREMENT`, lib/mcp/eureka-tool-contract.cjs:58; fix lines at eureka-engine-resolver.cjs:212-243).
- 26 of the 27 are in GOVERNED (the 2 `rs_*` tools among them) and eureka_capability_run is in PURE_READ (367 branch, graph-catchup-spawn.cjs:48-71, :117; counted by `require`).
- 405 rule (405-DESIGN.md 3.8): on a marked extension process an Eureka engine start and `/mos:eureka enable` refuse `local_session_required`. The string is not in lib/ today (grep: 0 hits); it is 405 work.
- A deferred tool costs its name only. The 27 names are 742 B (about 186 tokens).

## 8. Hook inventory (hooks/hooks.json, 447 lines; PROVEN by parse)

12 events, 41 hooks, all of type `command`, 0 of type `mcp_tool`.

| Event | Hooks | Scripts (timeout in seconds) |
|---|---|---|
| SessionStart | 9 | sessionstart-npm-reconcile (150), sessionstart-post-update-preflight (12), run-hook.cmd session-start (180), sessionstart-coordinator (40), sessionstart-reference-now-seed (5), check-pending-breakthrough (3), check-pending-ambiguous (3), gsd-graph-derive-drain (5), agentshield-sessionstart-scan (8) |
| UserPromptSubmit | 6 | admin-command-gate (3), intent-classifier (5), first-install-router (3), brain-derivation-drain (3), jtbd-update (3), auto-explore-drain (3). Owner: Phase 400.5 |
| Stop | 5 | run-hook.cmd on-stop (20), gsd-graph-derive-sweep (5), check-card-fire (5), check-voice-style (5), ambient-stop --stop (5, async) |
| PreToolUse | 5 | write-scope-check (3, Write, Edit, MultiEdit); part8-egress-guard-hook (5, onFailure block; matcher line 208); card-before-answer-hook (3, gate_answer); web-credential-guard-hook (5, onFailure block); review-contract-hook (3, Write) |
| PostToolUse | 9 | Write, Edit, MultiEdit: run-hook.cmd post-write (5), frontmatter-schema-validator (5), async-artifact-auto-commit (5), memory-completion-detector (5), auto-explore-fingerprint (5), gsd-artifact-graph-hook (5), memory-artifact-graph-hook (5). Grep, Glob: query-efficiency-telemetry (3). Brain tools: brain-response-sanitize-hook (5; matcher line 332) |
| PreCompact, PostCompact, SessionEnd, FileChanged, CwdChanged, SubagentStop, TaskCompleted | 1 each | pre-compact (6), post-compact (120), session-end-presence (3), on-file-changed (3), on-cwd-changed (45), on-agent-complete (45), on-task-complete (45) |

Process counts:

| Measure | Value | Mark |
|---|---|---|
| Host-started processes per session start | 9 | PROVEN (hook count) |
| Host-started processes per prompt | 6 | PROVEN |
| Host-started processes per turn end | 5 | PROVEN |
| Host-started processes per Write | 9 (2 PreToolUse, 7 PostToolUse) | PROVEN |
| Node starts per session start, with children | 22 | CITED (03-mos-runtime-cost.md section 4.5, tree of 2026-11-24) |
| Node starts per prompt | 6 | CITED |
| Node starts per turn end | 15 | CITED |
| Node starts per Write | 10 | CITED |
| SQLite opens per bound turn | 4 | CITED |
| Static `node` call sites in the bash hook bodies | session-start 60 (1,933 lines), on-stop 21 (686), post-write 13 (491), post-compact 4, pre-compact 3, on-agent-complete 3 | PROVEN by grep; an upper bound, not a run count |
| on-stop wall time | 1,137 to 1,259 ms synchronous | CITED |
| Session-start bash hook | 1.86 s; 8,825 characters of context | CITED (400.1-RESEARCH.md:231) |

The CITED run counts are older than Phases 400.3 and 400.4. Phase 400.3-05a made each Part 8 guard hook a parent plus an `--inner` child (CITED, program island 400.3). The first step of the consolidation slice must measure a base census on the tree it changes.

Fixed points that a consolidation must keep (PROVEN):
- The 367 runner spawns: scripts/session-start:135 and scripts/on-stop:56.
- The Part 8 rows: hooks/hooks.json matcher lines 208 and 332, with `onFailure: block` on the PreToolUse row.
- The two `onFailure: block` guards (part8-egress-guard-hook, web-credential-guard-hook).
- on-stop already starts some work in the background (:56, :420) and runs memory-lifecycle twice (:344, :353) and the guardian with a timeout (:574).

Tests that pin the hook census or a hook row (PROVEN by grep; 94 files name hooks.json, about 40 name an event or a hook script):

| Test | Pin |
|---|---|
| tests/test-389-hook-unwire.cjs:16-22 | a per-event census (total 41 before its plan; SessionStart 9, Stop 5, PostToolUse 9, `PostToolUse:Write` 7) |
| tests/test-385-hook-unwire.cjs | the same census function (`--census`) and the Stop entry rule |
| tests/test-261029-qef-hook-timeouts.cjs | one timeout budget row per command hook |
| tests/test-198-adapter-budget.test.cjs | import audit and line budget of the migrated hook scripts |
| lib/memory/minto-debounce-consumer-census.test.cjs | the consumer of the debounce queue is reachable from a UserPromptSubmit hook |
| tests/test-derivation-drain-fires.cjs, tests/test-jtbd-hook-integration.cjs | the UserPromptSubmit wiring of two scripts (400.5 scope) |
| tests/test-400-3-guard-deadline.cjs:246 | hooks.json timeouts equal HOST_BUDGET_MS of the 2 guard hooks; both keep `onFailure: block` |
| tests/test-386-web-credential-hook.cjs:216 | the shape of the Brain and web guard rows |
| tests/test-384-perf-harness.cjs | the perf harness and its history rules for hooks/ changes |
| tests/test-3551-tri-polar.cjs | ambient-stop wiring on the Stop event |
| tests/test-369-hook-require-graph.cjs | no hook reaches a `.ts` module |

## 9. K3, K4, F2 on this tree (PROVEN)

- K3: `emitVoiceReminder` writes `REMINDER_LINE + '\n'` after `main()` (scripts/intent-classifier.cjs:3812-3833). When `main()` wrote a JSON envelope, stdout is a JSON object plus a plain line. The line numbers moved from :3696-3720 (400.1) after 400.4 plan 12. Owner of this file's output: 400.5 (Path H dispatcher, "one JSON envelope", 400.5-02-PLAN.md:84 on the 400.5 branch).
- K4: the intercept envelope is `{decision: 'block', reason, systemMessage, continue: false}` (scripts/check-card-fire.cjs:867-877). `stop_hook_active` appears once in the file, in a comment (:27); no code reads it. `continue` is in the allowed-field list (:328).
- 400.3-09: the retry-store lock waits up to 300 attempts of 20 ms, about 6 s (:976-977). The comment says the Stop budget is 600 s (:958-975). The hook row gives check-card-fire 5 s (hooks/hooks.json:160-162).
- K4 signals: the side-file field `reached_gate_entries` (:47-61) and the text backstop.
- F2: scripts/session-start has a token budget variable (`SESSION_START_BUDGET_TOKENS`, :10, :1033, :1077) and no hard character cap (grep for 10000: 0 hits).
- Branch work/402-cardfire-startcap: worktree /home/jsagi/dev/MindrianOS-Plugin-402small at acb4de477, 0 commits past origin/main.

## 10. Skills and the opt-in item (PROVEN unless marked)

- 125 skills. `disable-model-invocation: true` on 6 (explain-decision, export, ingest-methodology, publish, snapshot, vault). 8 set it `false` on purpose (among them dial-memory-refresh, dogfood-flush, feynman-timeline-refresh, brain-derive, memory, operator, session-report).
- `kind:` is set on 60 skills: methodology 50, meta 4 (act, intel-pipeline, pipeline, suggest-next), utility 4, mechanical 2 (deck, show). 65 have no `kind`.
- CITED (400.1-RESEARCH.md:235): in the owner's host the skill listing shows 120 mos names with 0 descriptions (2,201 characters), because the listing is full. So the saving of an opt-in flag is about 0 in that host. The study's 13.4 KB is for a clean host (ASSUMED).
- CITED (docs/CLAUDE-SURFACE-MODEL.md, table "Which plugin parts load where"): in the chat a command loads as a skill. GUESS: `disable-model-invocation: true` hides it from natural-language discovery there. UNVERIFIED (program C22; no spike reads the chat skill listing).
- F1 (Phase 401) must land first: a key placed after a `# ---` comment line is not parsed (400.1-RESEARCH.md F1).

## 11. Open or UNVERIFIED items

1. Whether the Desktop Code tab and the merged chat honour `_meta["anthropic/alwaysLoad"]` (SP9).
2. The Claude Code version that first honours per-tool `true` (section 5 item 6).
3. Whether the first prompt can arrive before the server connects once startup does not wait for it (the Phase 114 window). Cold `tools/list` here: 362 ms; the session-start bash hook: 1.86 s (CITED). GUESS: the server is up before the first prompt in a normal start.
4. Whether a deferred tool with an MCP App view renders its view after tool search loads it. GUESS: yes; the view is bound at call time.
5. Whether tool search finds the router tools (methodology and the others) from a natural request.
6. The node start counts of section 8 on today's tree.
7. The `.mcpb` manifest field names and whether the chat applies its Tool access mode to an extension.
8. The tail of the 54 `tools/list` test files (section 4, search limit).

## 12. Sources

- Code and tests: paths and lines in each section, all on commit 142dec60a unless a worktree is named.
- Scratch measures (session scratch folder, not kept): `os.json` (tools/list rows), `refs.json` (name references), `hot.cjs` (set totals).
- Planning: 400.1-RESEARCH.md, 401-405-PROGRAM.md, 405-DESIGN.md r5, 405-CONTEXT.md, 400.5-CONTEXT.md (400.5 worktree), 400.3-PROPOSAL.md, the 2026-11-24 study.
- Host docs: https://code.claude.com/docs/en/mcp, https://code.claude.com/docs/en/hooks (2026-11-27).
- No test suite was run for this research, except tests/test-114-mcp-alwaysload.sh (PASS) and tests/test-127-00-shim-handshake.sh (7 pass, 2 fail at base).
