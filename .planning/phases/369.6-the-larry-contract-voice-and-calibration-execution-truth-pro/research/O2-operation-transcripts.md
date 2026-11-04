# O2: Does Larry operate the runtime invisibly in real transcripts?

Date: 2026-10-29. Lens O2. Claims marked PROVEN (script output), UNVERIFIED or PENDING-HUMAN.

## Question

The owner's critical element: Larry operates the Mindrian runtime (room, graph, Eureka, research, MCPs) so the user feels he talks to his own knowledge, without seeing the machinery. In real plugin-active transcripts, (1) how often are operation tools called, (2) how often does the text narrate machinery, (3) how often does it ground in room knowledge, (4) how often does Larry hand over a /mos: command, (5) does an operation call lead to a plain insight or to pasted output?

Short answer (PROVEN for the population below): the data cannot show invisible operation, because operation tools are called in only 2.8 percent of turns, and the population is the owner's dev and orchestration work. Where Larry does operate (72 turns), he rarely pastes output (2 of 248 follow-up texts), but he narrates machinery in 43.7 percent of those turns. Handing over a /mos: command as an instruction is rare (1.8 percent).

## Method

Scripts (read-only on transcripts, all under /tmp/o2):
- `/tmp/o2/o2_scan.py` builds `/tmp/o2/rows.json` (one row per turn, ordered text and tool_use items).
- `/tmp/o2/o2_agg.py` computes the version tables and kind splits.
- `/tmp/o2/o2_ex.py`, `/tmp/o2/o2_ex2.py`, `/tmp/o2/o2_ex3.py` give strict-narration splits, session spikes and example phrases.
- Run: `cd /tmp/o2 && python3 -I o2_scan.py && PYTHONPATH=/tmp/o2 python3 o2_agg.py`. It imports the L5 parser `l5_scan.py` (same session filter and version stamp, same turn definition).

Population (PROVEN): 102 plugin-active sessions, 2586 turns (2565 with text). A "turn" is one real user prompt plus all main-thread assistant items until the next prompt (the L5 definition, but turns with tool calls and no text are kept, so N is slightly above L5's 2550). Project directory split: 2527 turns in the home directory (orchestration), 33 in the MindrianOS-Plugin dev repo, 9 mos-platform, 8 mindrian-website, 9 in temp dirs. No turn comes from a navigator room directory. The "room dir" row below is only dev repos.

Definitions:
- Operation tool (OP): any `mcp__plugin_mos_mindrian-os__*` or `mcp__plugin_mos_mindrian-brain__*` call. Counts of OP names (PROVEN): brain_ask 53, artifact_file 37, brain_query 26, room_bind 25, brain_search 13, room_search 13, room_list 10, research_run 9, room_state 5, gate_answer 5, claim_write 5, context_assemble 3, graph_query 1, suggest_next 1, reach_candidates 0, memory_event 0, gate_render 0, eureka_* 2.
- Silent-op turn: a turn with at least one of memory_event, context_assemble, room_state, graph_query, suggest_next, reach_candidates, research_run, eureka_*, claim_write, gate_render, gate_answer, brain_ask.
- "Theo-side" calls: `mcp__theo__*` (direct Theo server), reported apart.
- Narration (any): regex over turn text for MCP, the word "tool", Neo4j or graph database or Cypher, embedding, Brain, DirectiveEnvelope, node id, JSON, "I will call / let me query / running /mos:", file paths, gate ids, tool names. The words "tool" and file paths are loose in dev talk, so a STRICT set is also given: MCP, Neo4j/graph database, embedding, DirectiveEnvelope, node id, JSON, "I will call" patterns, gate id, tool names.
- Grounding: regex for "your room", "the room", "data room", "your problem/market/claims/assumptions", ICM section slugs, "contradict", "STATE.md". Heuristic; it also matches dev talk about rooms.
- Command handoff (imperative): "run / try / use / type / invoke / then" directly before `/mos:<name>`. "Any" = any /mos: mention.
- Pasted output: the first text after an OP call contains a JSON code block or a table/key-value block of 8 or more lines. Narrow heuristic.

## Results tables

### (1) Operation calls by plugin version (rates over all turns)

| Version | S | N | any OP call % | silent-op turn % | OP calls per 100 turns | Theo-side calls per 100 turns |
|---|---|---|---|---|---|---|
| beta.49 | 1 | 30 | 0.0 | 0.0 | 0.0 | 0.0 |
| beta.51 | 22 | 333 | 1.5 | 0.6 | 7.2 | 11.4 |
| beta.53 | 15 | 231 | 3.0 | 1.3 | 16.0 | 9.1 |
| beta.57 | 6 | 159 | 0.0 | 0.0 | 0.0 | 11.9 |
| beta.59 | 23 | 989 | 1.5 | 0.6 | 5.6 | 17.4 |
| beta.69 | 18 | 425 | 2.4 | 1.2 | 11.3 | 13.6 |
| beta.73 | 4 | 120 | 2.5 | 2.5 | 6.7 | 0.0 |
| beta.75 | 13 | 299 | 10.7 | 4.7 | 27.4 | 22.7 |
| All | 102 | 2586 | 2.8 | 1.3 | 9.8 | 14.5 |

Counts behind it: 72 turns with an OP call, 34 with a silent-op call (PROVEN). beta.49 (1 session, 30 turns), beta.57 (6 sessions) and beta.73 (4 sessions, 3 silent-op turns) are too small to read. The beta.75 rise comes from few sessions (13) and is mostly room_bind, room_search and filing in the owner's own rooms (UNVERIFIED which sessions dominate). An "OP call per assistant turn" is therefore about 0.1 per prompt cycle overall, and zero for suggest_next, reach_candidates, memory_event and gate_render.

### (2) Narration of machinery (share of turns with text)

| Version | N text | any narration % | STRICT % | MCP % | Neo4j % | Brain % | JSON % | file path % | tool name % | "I will call / let me query" % |
|---|---|---|---|---|---|---|---|---|---|---|
| beta.49 | 30 | 23.3 | 0.0 | 0.0 | 0.0 | 3.3 | 0.0 | 20.0 | 0.0 | 0.0 |
| beta.51 | 331 | 48.6 | 14.5 | 7.6 | 6.0 | 12.1 | 1.5 | 20.5 | 3.0 | 1.2 |
| beta.53 | 229 | 58.1 | 32.8 | 26.2 | 2.6 | 13.5 | 4.8 | 34.9 | 10.5 | 1.3 |
| beta.57 | 150 | 51.3 | 17.3 | 14.7 | 0.7 | 4.7 | 1.3 | 38.0 | 3.3 | 0.0 |
| beta.59 | 985 | 56.2 | 13.2 | 5.6 | 11.0 | 6.8 | 2.8 | 29.1 | 2.0 | 0.4 |
| beta.69 | 423 | 55.8 | 20.8 | 7.8 | 3.1 | 5.7 | 6.1 | 33.6 | 6.4 | 0.5 |
| beta.73 | 119 | 58.8 | 11.8 | 6.7 | 1.7 | 1.7 | 3.4 | 47.1 | 1.7 | 0.0 |
| beta.75 | 298 | 50.0 | 15.4 | 9.4 | 1.3 | 4.0 | 2.0 | 34.9 | 5.0 | 0.3 |
| All | 2565 | 54.1 | about 16 | 9.0 | 6.0 | 7.2 | 3.2 | 31.2 | 4.0 | 0.5 |

DirectiveEnvelope: 0 turns in all versions (PROVEN). "Tool" as a word appears in 28.0 percent of turns and file paths in 31.2 percent; both are mostly dev talk, so the STRICT column is the fairer read. The "All" STRICT value is computed from the per-version counts (48+75+26+130+88+14+46 = 427 of 2565, 16.6 percent). Version differences are not stable enough to call a trend: beta.53 stands out at 32.8 percent, the other versions sit at 12 to 21 percent. beta.73 has 4 sessions.

### Narration by kind of turn

| Kind of turn | N turns | STRICT % | any narration % | grounded in room % | /mos: command as instruction % |
|---|---|---|---|---|---|
| Turn with an OP call | 72 (71 with text) | 43.7 | 77.5 | 70.4 | 16.9 |
| Turn with other tools, no OP call | 1999 (1979 with text) | 17.4 | 57.6 | 30.1 | 1.6 |
| Pure chat, no tool call | 515 | 10.1 | 37.3 | 21.2 | 0.6 |
| Dev-repo directories only | 59 | not computed | 50.0 | 44.8 | 1.7 |
| Home-directory orchestration | 2527 | not computed | 54.2 | 29.0 | 1.8 |

By number of tool calls in the turn (STRICT %): 0 tools 10.1 (515 turns), 1 to 3 tools 14.0 (859), 4 to 10 tools 16.8 (685), 11 or more tools 27.7 (506) (PROVEN). Narration grows with tool use.

### (3) Grounding in the user's own room knowledge

By version (share of text turns, heuristic): beta.49 46.7 (30 turns), beta.51 26.9, beta.53 45.0, beta.57 33.3, beta.59 25.3, beta.69 22.2, beta.73 19.3 (119 turns, 4 sessions), beta.75 44.3. All 29.4. Turns with an OP call are grounded 70.4 percent of the time against 21.2 percent in pure chat. Generic methodology versus room grounding cannot be separated cleanly by regex (UNVERIFIED); the figures say only that room words appear.

### (4) Handing the user a /mos: command

Imperative handoff ("run /mos:...", "then /mos:..."): beta.49 3.3, beta.51 2.7, beta.53 1.7, beta.57 1.3, beta.59 0.9, beta.69 0.7, beta.73 2.5, beta.75 5.0 percent of text turns; all 1.8. Any mention of a /mos: command (including naming a command in a report): 10.6 percent overall, 23.8 in beta.75 and 23.3 in beta.49. Most mentions are in dev reports, not instructions. In the sampled imperative cases (PROVEN, 4 read) the command was needed because the write path or switch could not be done from the session (for example "run /mos:rooms switch ..." first), which fits the plugin's own gaps. Only beta.75 is above 3 percent, on 298 turns.

### (5) After an OP call: insight or pasted output

248 OP calls were followed by a later text block in the same turn (beta.51 24, beta.53 37, beta.59 55, beta.69 47, beta.73 8, beta.75 77; beta.49 and beta.57 have none). Only 2 of 248 (0.8 percent, both beta.75) follow with a JSON or table dump by my heuristic. A manual read of 40 follow-ups drawn from non-STRICT, non-pasted cases (so a biased sample, UNVERIFIED as a rate) showed plain-language text, but several of them state the machinery outcome instead of an insight, for example the egress guard refusing questions. Raw pasted tool output is not the failure mode; machinery commentary is.

## Examples

All quotes are one short phrase from real replies. No room content.

Good invisible operation (a room or Brain call happens, the text speaks of knowledge):
1. "Neither appears there, so the room has nothing on this foundation" (beta.53, after room_bind and room_search).
2. "The room has no record of the client conversation." (beta.75, after room_bind, context_assemble, room_startup).
3. "Nothing gets written until you choose." (beta.51, after room_bind, at a filing gate).
4. "I read the 15 September ... scoping call with Roni in full" (beta.53, contradiction frame after room_search).
5. "Room is born and bound. Now I'm checking its sections" (beta.59, short, no tool names).

Visible machinery:
1. "Governed filing is still blocked (`write_path_disabled`)" (beta.75).
2. "The plugin's egress guard refused all 12 questions" (beta.59).
3. "Argument names are wrong. I'll read the tool schemas." (beta.59, after brain_ask).
4. "writes now land in `/home/jsagi/MindrianRooms/...`" (beta.75, file path of the room).
5. "`brain_ask` returned a real directive in GUIDED mode" (beta.75, tool name in a status line).

## Where machinery shows

- In tool-heavy turns: STRICT narration rises from 10.1 percent (no tools) to 27.7 percent (11 or more tools). In turns with an OP call it is 43.7 percent (31 of 71).
- In failure and repair turns: guard refusals, "write_path_disabled", wrong argument names, mirror and cache problems. These are the plugin's own faults surfaced as talk about tools.
- beta.53 (10-01 to 10-04): 32.8 percent STRICT and 26.2 percent MCP, driven by sessions about the MCP server. The top sessions by STRICT rate (45 to 60 percent of turns, at least 15 turns each) are beta.53 and beta.69 home-directory sessions (PROVEN); that their topic is plugin work is UNVERIFIED (not read).
- File paths appear in about a third of turns (47 percent in beta.73) because the sessions are about files.
- Where it does not show: "I will call" and "let me query" are near zero (0.5 percent), DirectiveEnvelope is zero, narration before a tool call opens with an action verb in only 2.7 percent of 4323 pre-tool text blocks (115). Larry rarely announces calls. He instead names the result of a call ("Running one quick check ...").
- A user prompt with a dev keyword gives STRICT narration 19.7 percent (172 of 871); without such keywords 14.1 percent (212 of 1508). The keyword filter is crude.

## Limits

- Not navigator sessions: 97.7 percent of turns are the owner's home-directory orchestration, the rest dev repos. No turn is a navigator in a room. Narration is expected in a dev session, so these rates are an upper bound for machinery talk, not a measure of the navigator experience.
- Tool use may be hidden by design: Claude Code shows tool calls in the UI; this analysis counts transcript items, so it measures what the model did, not what a navigator would see. Hooks and the MCP server may run operations that never appear as assistant tool_use items (for example hook-injected context). Silent operation by hooks is not counted (UNVERIFIED).
- Operation calls are rare (72 turns), so version rates for the operation share rest on few events. beta.49 (30 turns), beta.57 and beta.73 are too small to read.
- Regex limits: "tool" and file paths over-count in dev talk; grounding regex also matches dev talk about rooms; the pasted-output test is narrow; STRICT "All" is derived from counts, not a separate pass. The follow-up read of 40 cases is a convenience sample, not random.
- Turn definition keeps tool-only turns; counts differ slightly from L5 (2586 versus 2550).
- Version is the hook stamp, not necessarily the installed cache version (as in L5).
- Examples were picked by hand from filtered candidates; they show that both kinds exist, not how common each is.
