# 03 - MindrianOS runtime cost: context and time per session and per turn

Date: 2026-11-24. Repo: /home/jsagi/dev/MindrianOS-Plugin-399 (2.0.0-beta.88). Installed copy compared: ~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.87.
Written by the runtime-cost research subagent; saved here by the main session (the subagent's write outside the worktree was refused by the worktree path guard). Raw data: /tmp/claude-1000/-home-jsagi/2573fa9c-012c-4f0a-8072-478e6d3aa1be/scratchpad/m/.
Marks: PROVEN (measured or read), UNVERIFIED (not run or not observable), ASSUMED (reasoned bound). Tokens = bytes / 4 (rule of lib/core/doctor/mcp-surface-module.cjs), an estimate.

## 0. Method
- Hooks ran against a scratch HOME and a copy of motj-ecosystem/sub-rooms/sanhedrin (room.db and files under 1 MB), plugin as a scratch copy, every hook inside `unshare -rn` (no network), dead loopback Brain URL, no key. PROVEN.
- The real room, the repo and the installed copy did not change. PROVEN.
- Tool-use counts from 1,640 owner transcripts (60 days). PROVEN for the owner, UNVERIFIED for users.
- The host system prompt is not in transcripts; system-prompt items are measured from files.

## 1. Session start

### 1.1 SessionStart hooks (9, room bound)
| Hook | Injected B | Wall | Modules / SQLite opens |
|---|---|---|---|
| sessionstart-npm-reconcile.cjs | 0 | 41-47 ms | 4 / 0 |
| sessionstart-post-update-preflight.cjs | 0 | 34-46 ms | 1 / 0 |
| run-hook.cmd session-start (bash 109 KB) | 9,179 + sysMsg 59 | 2,385-2,406 ms | about 12 child node starts; auto-explore-fire 263 modules, 3 room.db opens; feynman-minto-guardian 1; sync-rooms-graph opens rooms.db |
| sessionstart-coordinator.cjs | 984-1,190 | 153-187 ms | 252 / 1 |
| sessionstart-reference-now-seed.cjs | 0 | 71-75 ms | 123 / 0 |
| check-pending-breakthrough.cjs | 0 | 32-40 ms | 0 / 0 |
| check-pending-ambiguous.cjs | 0 | 32-38 ms | 0 / 0 |
| gsd-graph-derive-drain.cjs | 0 | 47-68 ms | 135 / 1 |
| agentshield-sessionstart-scan.cjs | 0 | 121-128 ms | 130 / 1 |

Total about 10.4 KB (2,600 tokens), about 2.4 s (parallel ASSUMED). With no room: 5,110 B in 630 ms.
The 9,179 B: identity and label rule 1.3 KB (1 of 4 copies); room state, FeyMinto and nest brief 1.6 KB; nudges and command menu 1.0 KB; Proactive Room Intelligence 1.2 KB (its Convergence lines are stray words: tokens, sectio, ratio, proposed); Data Room State table 1.4 KB; doctrine and card-fire contract 1.6 KB (repeats the agent body and output style); pointers 0.5 KB.
The coordinator also adds a PENDING TENSION block (about 1.0 KB) with internal paths, repeated every session until resolved.

### 1.2 Always-loaded instructions
| Item | Bytes | Tokens | Mark |
|---|---|---|---|
| agents/larry-extended.md (settings.json agent) | 15,595 | 3,899 | file PROVEN, main-thread load ASSUMED |
| Its preloaded skills: larry-personality 24,800, room-proactive 23,956, room-passive 9,927, context-engine 9,697 | 68,380 | 17,095 | UNVERIFIED for main thread |
| output-styles/destijl.md | 4,740 | 1,185 | PROVEN |
| mindrian-os MCP instructions | 2,000 | 500 | PROVEN |
| Plugin CLAUDE.md (22,641) | 0 for users | 0 | dev repo only, ASSUMED |
| ~/MindrianRooms/CLAUDE.md | 1,492 | 373 | under the rooms cwd, ASSUMED |
| References per turn | 0 (pointers only) | 0 | PROVEN |

Phase 392 has plans only, no MEASURE or DECISION file; the alwaysLoad decision is open.

## 2. MCP surface (alwaysLoad true on both servers)
| Server | Tools | Names | Desc | Schemas | Total | Tokens | Cold start |
|---|---|---|---|---|---|---|---|
| mindrian-os beta.88 (= beta.87) | 76 | 1,329 | 37,764 | 47,835 | 86,928 | 21,732 | 405-456 ms, 698 modules, 9.9 MB |
| mindrian-brain beta.88 | 6 | 66 | 1,319 | 2,468 | 3,853 | 963 | 186 ms |
| mindrian-brain beta.87 | 6 | 66 | 1,055 | 1,446 | 2,567 | 642 | 202 ms |

tools/list also carries 816 B of _meta and 2,658 B of annotations. The surface is 2.8 times the doctor budget of 8,000 tokens. Full schemas load because of alwaysLoad (PROVEN in this host).
Schema bytes include 4,332 B of `$schema` repeats, 924 B of additionalProperties and 15,562 B of parameter descriptions (many repeat the Part 8 and binding rules).
Largest tools: gate_render 4,031 B, chain_run 3,110, research_run 2,774, eureka_hsi_interpret_whitespace 2,494, gate_answer 2,355. The Eureka and RS family: 27 tools, 28,518 B (7,130 tokens), 33 percent of the surface.
Owner use in 60 days: top calls brain_query 181, artifact_file 102, room_bind 25, brain_ask 20, context_assemble 13, room_state 11, room_graph 10. 48 of 76 os tools had 0 calls (54,128 B, 13,532 tokens). Eureka tools had 2 calls. gate_render and chain_run had 0.
Hot set of 18 (artifact_file, room_bind, context_assemble, room_state, room_graph, room_list, orchestration, room_search, room_startup, status_read, gate_answer, gate_render, claim_write, claim_read, suggest_next, stop_gate_check, chain_resolve, room_create): 24,733 B. Owner hot set of 7: 10,770 B.

## 3. Listings
- Skills: 125 SKILL.md, 11,911 B descriptions plus 1,373 B names (3,321 tokens).
- Commands: 113, 7,122 B descriptions; every command is mirrored as a skill; the host shows each name once (120 mos lines).
- Agents: 17, 3,195 B descriptions.
- In the owner host the mos skills show as names only (2,081 B), because the listing is full (PROVEN). A clean host shows up to 13.3 KB (ASSUMED).
- Descriptions over 500 B: trending-to-absurd 903, mullins-scaffold 741, mos-deck-engine 621, client-discovery-interview 548, intelligence-orchestrator 519.

## 4. Per turn

### 4.1 UserPromptSubmit (6 hooks)
admin-command-gate 0 B, 26-29 ms; intent-classifier see 4.2, 185-233 ms, 179 modules (3.3 MB), 2 room.db opens; first-install-router 1,376 B once per install or update, 78-85 ms; brain-derivation-drain 0 B, 30 ms; jtbd-update 0 B, 40 ms; auto-explore-drain 0 B, 36 ms. Total 6 node starts, about 0.23 s per prompt.

### 4.2 intent-classifier output
| Block | Bytes | When |
|---|---|---|
| Voice reminder (REMINDER_LINE) | 284 | every non-slash prompt, never suppressed |
| NAVIGATION DECISION full | 1,357 (budget 1,100) | about 28 percent of turns |
| [NAV DECISION unchanged] marker | 46 | the other turns |
| Binding card F.8 | 1,139 | every turn while unbound |

30-day ratio: 4,429 full blocks, 11,384 markers, 7,111 reminders, 228 binding cards. Average bound turn carries about 697 B (175 tokens), kept in history: 50 turns add about 35 KB. The full block quotes one 290-character claim twice (about 580 B) and carries null fields.
Binding case: stdout is a JSON line then a plain line; if the host reads it all as text, the model gets raw JSON and the systemMessage is lost (UNVERIFIED; comment at intent-classifier.cjs:3696).

### 4.3 Stop (5 hooks)
- on-stop 1,137-1,259 ms synchronous, about 11 node starts (recompile-room-references 6 times, memory-lifecycle 2, feynman-minto-guardian with 1 room.db open).
- check-card-fire 45 ms; returns decision:block when a gate was reached and no card fired; each block forces one more model turn. 699 blocks in 30 days. The run reproduced a block from a stale F.8 gate on a turn with no fork.
- check-voice-style 50 ms; gsd-graph-derive-sweep 27 ms; ambient-stop async 74 ms, 125 modules.

### 4.4 Tool hooks
PreToolUse Write: 2 hooks, 45 ms. PreToolUse Brain tools: part8-egress-guard 88 ms. PostToolUse Write: 7 hooks, 202 ms, 10 node starts, injects 45 B ("post-write: cascade skipped for <file>") with no value. PostToolUse Grep 33 ms. PostToolUse Brain: brain-response-sanitize 41 ms.

### 4.5 Hot path
SQLite opens: 4 per bound turn, about 8 per session start. Node starts: 22 per session start, 6 per prompt, 15 per turn end, 10 per Write.

## 5. Phases 399 and 400
- 399 shortlist.cjs reads data/decision-advisor-table.json (15,612 B, 13 job-only rows): require 0.46 ms, first lookup 0.35 ms, cached 0.02 ms (per process). Call sites: composeNextMove (only when ctx.section is set), composeWorkflow (chain_resolve, framework_run). Advisor off by default; injects 0 B. The selection log writes only on a decision (gate_answer or closeOffer); MINDRIAN_SELECTION_LOG=off disables it; write time not measured. Net per turn under 1 ms and 0 B.
- Can the shortlist replace injected text? Nav-block reach rows (about 900 B): yes, 3 commands with band words fit in about 150 B. Session nudges and menu (about 1 KB): yes, one "next moves" line. Both need the advisor on by default (today opt-in). Not replaceable: room intelligence (evidence), voice, doctrine and binding text (rules).
- 400: S1 job sentences in every DESCRIPTION would add about 50 KB (12.5k tokens) of always-loaded context (ASSUMED); keep the slots out of the description field. S2 Cynefin domain is a room label set by one gate answer; per-turn cost stays a lookup. S4 relay has no per-turn call.

## 6. Cost table (S session, T prompt, E turn end, W write)
| # | Item | Bytes | Tokens | Freq | Cut | Saving | Risk |
|---|---|---|---|---|---|---|---|
| 1 | os MCP surface, alwaysLoad | 86,928 | 21,732 | S | per-tool alwaysLoad on the hot 18; defer the rest | about 62 KB / 15.5k tok | Medium: Desktop/Cowork deferral UNVERIFIED, ToolSearch round trip, tests and ledger pin, owner card (392) |
| 1a | Eureka and RS 27 tools | 28,518 | 7,130 | S | defer, or register only when Eureka is enabled | 7.1k tok | Low |
| 1b | `$schema` repeats | 4,332 | 1,083 | S | strip at registration | 1.1k tok | Low |
| 1c | repeated rules in param descriptions | part of 15,562 | up to 3,890 | S | one statement in the instructions | 1.5-2k tok | Low-medium |
| 2 | preloaded agent skills | 68,380 | 17,095 | S | verify the load; drop room-passive and room-proactive | up to 8.5k tok | Medium: voice drift, Jev eval |
| 3 | agent body | 15,595 | 3,899 | S | trim frontmatter and comments, move procedures out | 0.5-1k tok | Low |
| 4 | identity rule in 4 copies | 1,300 each | 325 each | S | keep agent and MCP copies | 600 tok | Low (parity tests) |
| 5 | session doctrine and card contract | 1,600 | 400 | S | move to the agent body | 300 tok | Low |
| 6 | stray Convergence words | about 600 | 150 | S | stop-word filter or HIGH only | 150 tok | Low, fixes a defect |
| 7 | room table, state, nudges, menu | about 4,000 | 1,000 | S | keep one view | 400-500 tok | Low |
| 8 | PENDING TENSION instruction | about 1,000 | 250 | S | question and id only | 150 tok | Low |
| 9 | session-start 2.4 s | - | - | S | one process, async extras | about 1.5 s | Medium |
| 10 | voice reminder | 284 | 71 | T | every Nth turn or after a violation | about 50 tok per turn | Low-medium |
| 11 | full nav block | 1,357 | 339 | T (28%) | dedupe the quote, cap labels, drop nulls; later the 399 shortlist | 150-225 tok per block | Low; shortlist medium |
| 12 | binding card while unbound | 1,139 | 285 | T | once per session | 285 tok per turn | Low |
| 13 | JSON plus plain stdout | - | - | T | reminder inside additionalContext | correctness | UNVERIFIED |
| 14 | 6 UPS processes | - | - | T | merge the 4 small hooks | about 0.1 s | Low |
| 15 | on-stop 1.2 s, 11 node starts | - | - | E | batch the 6 recompiles; async | about 1 s per turn | Medium |
| 16 | card-fire false block | 1 model turn | - | E | clear a stale gate on a text answer or expiry | 1 response per block | Medium |
| 17 | post-write chain | 45 | 11 | W | drop the line; 1 process | about 0.15 s | Low |
| 18 | long skill descriptions | 11,911 | 2,978 | S | cap at 200 B | 3-4 KB in a clean host | Low |
| 19 | command and skill mirrors | 7,122 | - | S | one source | 0 context | Low |
| 20 | 399 advisor lookup | 0 | 0 | T | none | - | None |
| 21 | 399 selection log | rows | 0 | decision | measure once | - | Low |
| 22 | 400 S1 sentences in descriptions | about 50,000 | about 12,500 | S | keep out of descriptions | avoided | High if put in descriptions |

Session total before the first prompt: about 197 KB (about 49k tokens; about 32k without the preloaded skills). Per bound turn about 700 B (175 tokens). Wall: 2.4 s per session start, 0.23 s per prompt, 1.3 s per turn end, 0.2 s per Write.
Top levers: (1) MCP alwaysLoad, (2) preloaded skills, (3) on-stop and card-fire at the turn end.

## 7. Open checks
- Whether the main thread preloads the agent skills: run /context in a fresh session.
- How the host handles JSON plus plain-text stdout.
- Deferral on Desktop and Cowork: items L-DC1, L-DT1, L-CW1 of the 392-02 plan.
- Card-fire false-block rate from ~/.mindrian/card-fire-intercepts.log.
- Run the hooks against the live room once with the owner present.
