# O1: operation wiring. Can Larry operate the runtime invisibly?

Date: 2026-10-29. Lens O1. Read only. Repo read: /home/jsagi/dev/MindrianOS-Plugin (branch release/beta.77-changelog-panel, HEAD fd3fcd2b5). Paths below are relative to that repo unless stated. The MCP tool list comes from this session's tool registry. Marks: PROVEN = read or ran (path and line). UNVERIFIED = not run. PENDING-HUMAN = needs the owner. No em or en dashes used. PwS = Problems worth Solving.

## Question

Do the persona and skill system instruct, permit and enable Larry to operate the Mindrian runtime (local graph and Data Room, Eureka, research, skills, MCPs, Theo) invisibly, so the user feels he is talking to his own knowledge with Larry as its representative?

Short answer: Larry is permitted and partly instructed to operate silently, but the instructions are thin, scattered, and out-voted by visible-machinery rules in the same prompt stack. Per-turn operation depends on model judgment; almost no hook calls the operations for him. Knowledge-first grounding is not written as a stance anywhere.

## Findings

1. PROVEN. The core silent-operation contract is one short section of the larry-personality skill, "Memory channels and the write policy" (skills/larry-personality/SKILL.md lines 495 to 526). It says: `context_assemble` runs at turn start every turn; `memory_event` fires silently on every substantive turn and is never narrated; `claim_write`/`graph_write` land only as proposed after an F.8 basket (two or more candidates); "None of this is ever narrated (Canon Part 12 invisibility)"; after a basket confirm the next line is a next-move offer, not a status report. The agent body repeats it in one sentence (agents/larry-extended.md, "Operating policy" section) and defers to the skill.

2. PROVEN. A second silence rule: "Operating the components (ICM Layer 1 Routing)" (SKILL.md lines 163 to 177): "Reads and context assembly stay silent ... nothing more" than "let me search" when genuinely searching. Writes that become truth claims pass a gate.

3. PROVEN. Silent classification: agents/larry-extended.md line 105 ("Classify internally, NEVER announce"), skills/larry-personality/mode-engine.md line 76, references/personality/lexicon.md line 13, and the MCP server instructions (lib/mcp/runtime-instructions.cjs, BOUNDARIES paragraph, "SILENTLY").

4. PROVEN. Nothing makes the per-turn operations run in code. The hook set (hooks/hooks.json, listed by script) has no hook that calls `context_assemble`, `memory_event`, `suggest_next`, `reach_candidates`, `graph_query`, `whitespace_scan`, Eureka or `research_run` on the model's behalf. grep for logMemoryEvent or memory_event in ambient-stop.cjs, operator-update.cjs, hmi-compliance-poll.cjs, check-card-fire.cjs, hooks/run-hook.cmd found no hit. So "context_assemble every turn" and "memory_event on every substantive turn" are instructions only. Whether the model does them is UNVERIFIED (no trace read).

5. PROVEN. What the hooks DO inject each turn is routing, not knowledge: UserPromptSubmit intent-classifier.cjs emits a "## NAVIGATION DECISION (engine v1)" block (scripts/intent-classifier.cjs lines 1217 to 1228: fire_skill, suppress_skills, offer_next_step, persona_updates, tier_mode, activated_skills, routing_source, Why). Plus "## GRAPH FINDINGS (top 3)" (lines 868 to 960): at most 3 insight strings of the form "type: message" from `.proactive-intelligence.json`, with a hard cap and a suppress-after-3-shows rule. The block text is a machine-readable key/value list. It tells Larry which skill to fire; it carries no room facts to speak from.

6. PROVEN. The Desktop/Cowork surface has no hooks. Its operating order comes from a 2000-byte MCP `instructions` string (lib/mcp/runtime-instructions.cjs, byte budget header lines 8 to 24). It names: room_list, room_create, gate_answer, room_bind, context_assemble, room_startup, room-dashboard, suggest_next, chain_resolve, chain_run, gate_render, stop_gate_check, status_read, brain_*. It does NOT mention memory_event, graph_query, graph_reason, room_search, claim_write, research_run, Eureka, whitespace_scan, contradiction_check. Budget is the stated reason (file header). So on Desktop and Cowork the silent-note-taking rule is absent unless the skill text also loads there (UNVERIFIED).

## Operation matrix

Columns: Routed = an instruction in agent/skill/hook/MCP instructions tells Larry when to use it. Silent/Narrated = what the text says about telling the user. Enforced/Judgment = code forces it, or model judgment.

| Operation (tool) | Routed? | Silent or narrated | Enforced or judgment | Evidence |
|---|---|---|---|---|
| context_assemble | Yes, turn start every turn (skill); once at bind (MCP LOOP) | Silent | Judgment | SKILL.md 513; runtime-instructions.cjs LOOP |
| memory_event | Yes, every substantive turn (CLI skill only) | Silent, never narrated | Judgment (no hook logs turn events) | SKILL.md 514; hook grep, none |
| room_bind, room_list, room_startup | Yes (MCP LOOP) | Narrated by design: "show saved understanding", briefing, then room-dashboard opens a UI | Judgment on Desktop; CLI binds via intent-classifier gate | runtime-instructions.cjs; intent-classifier.cjs binding gate |
| suggest_next | Yes (MCP LOOP "after work pull suggest_next, propose one move"); CLI via nav engine block | Output is one narrated next-move offer | Judgment (MCP); engine-computed block (CLI) | runtime-instructions.cjs; intent-classifier.cjs 1217 |
| reach_candidates | No routing instruction in agent, skills or MCP text | n/a | Dead for Larry's prompt (only reachable by tool-list choice) | grep: 0 hits in agents, skills, commands, references |
| graph_query, graph_reason | Named as the "recall" verbs (SKILL.md 508) and as evidence-id sources (room-proactive 233); no trigger saying when to recall | Silent by implication | Judgment | SKILL.md 506 to 509 |
| room_search | Named only as an evidence-id source (room-proactive 233); no trigger | Silent by implication | Judgment | room-proactive SKILL.md 233 |
| contradiction_check | One worked example (SKILL.md 437) | NARRATED: Larry says "I am running contradiction_check with include_superseded" | Judgment | SKILL.md 437 |
| whitespace_scan | No routing; the whitespace reach routes to the slash command `/mos:whitespace` (Provoked table, SKILL.md 554) | User is pointed at a slash command | Judgment | SKILL.md 554 |
| research_run | No routing in agent or skills. Deep-research reach is plan-gated and resolves to `/mos:research` on approve (SKILL.md 120 to 129) | Plan is presented as a gate; fetch only after approve | Judgment, with a plan gate | SKILL.md Reach rule 6 |
| eureka_graph_*, eureka_capability_*, eureka_hsi_*, eureka_critic | No routing instruction in agent, personality skill or room skills; only skills/eureka/SKILL.md and commands/eureka.md, and the SENS-13 eureka_bridge push narrates stored stamps (SKILL.md 627 to 655) | Narrated in a fixed 8-rule shape, with a canned "Not yet checked; run the CLI to verify." | Doctrine; sensor fires the reach | SKILL.md 627 to 655 |
| intelligence, methodology, analysis (grouped tools) | Not named as tools. Reached through `/mos:<framework>` commands resolved by command-resolver | User-facing slash command in the Provoked table and the output-style footer | Judgment | SKILL.md 530 to 562; output-styles/destijl.md Zone 4 |
| claim_write | Yes, after F.8 basket; also upload path (agent body, Dual-Path) | Silent after confirm | Judgment plus gate; code forces proposed status | SKILL.md 515 to 521; agent Dual-Path |
| claim_read, claim_verify | No routing | n/a | Dead | grep 0 hits |
| gate_render, gate_answer | Yes; CLI uses AskUserQuestion card; Desktop uses gate_render | Card is the visible product; gate_answer receipt honored | Enforced (Stop hook check-card-fire, PreToolUse card-before-answer) | hooks.json; agent "Decision Gates" |
| chain_resolve, chain_run | Yes, MCP LOOP and agent "Post-Gate Handoff" | Autonomous prefix runs underneath; halts at first material step | Code-enforced halt | agent Post-Gate Handoff |
| framework_run | No routing | n/a | Dead for the prompt | grep 0 hits |
| artifact_file | Yes (room-proactive 229 to 245) | "No ceremony" rule: never announce evidence ids | Judgment | room-proactive 239 |
| question_set, question_read | No routing | n/a | Dead (the governing question is never used) | grep 0 hits |
| identity_write | No routing | n/a | Dead | grep 0 hits |
| stop_gate_check, status_read | stop_gate_check in MCP LOOP; status_read "on request" | Silent close-out | Judgment (Desktop); Stop hooks (CLI) | runtime-instructions.cjs |
| meeting | Present in skills/file-meeting path only | n/a | Slash-command path | grep: 3 skill hits are generic |
| rs_experts_find, rs_thesis_read | No routing in the Larry stack; reached through rs-* skills | n/a | Dead for conversation | grep 0 hits |
| view_compile, room_changes, room_artifact, room_state, room_state_bound, room_content, room_graph | No routing in Larry stack | n/a | Dead for conversation | grep 0 hits |
| brain_ask / brain_query / brain_search / brain_schema | Yes (brain-connector skill; reach row "Brain consult"; MCP THEO line) | Mixed, see Theo link | Part 8 egress guard is code-enforced | hooks.json PreToolUse |
| larry_move, persona_card, recommend_chain | No consumer anywhere in plugin | n/a | Dead | grep over agents, skills, lib, scripts, hooks, commands: 0 hits (also L6) |

## Invisibility rule and its contradictions

Where the rule is written (PROVEN):
- Silent classification: agents/larry-extended.md 105; mode-engine.md 76.
- Silent reads, silent memory events, silent writes after a gate: SKILL.md 163 to 177 and 495 to 526.
- "Never mention databases or architecture unprompted": agents/larry-extended.md "Never Do" section; the thin-grounding clause forbids the nouns Theo, graph, database, Brain, vendor name (SKILL.md 452 to 490).
- "No ceremony" for evidence ids, citing a "standing never announce tool calls rule": skills/room-proactive/SKILL.md 239.
- Never volunteer Theo; answer honestly if asked by name: agents/larry-extended.md "If asked about Theo by name".
- Canon Part 12 "invisibility" as a state: the white square glyph (SKILL.md 270).

Gap in the rule itself:
- PROVEN. The "standing 'never announce tool calls' rule" that room-proactive cites does not exist as text. grep for never announce, do not announce, never narrate across agents, skills/larry-personality, skills/room-*, output-styles, references/personality, lib/mcp/runtime-instructions.cjs and lib/core/navigation-engine.cjs found only the classification rule, the evidence-id line and the memory_event line. There is no general rule against naming tools, showing IDs, pasting JSON, or running commands for the user.

Where it is contradicted (all PROVEN):
1. Output style forces visible structure. output-styles/destijl.md (force-for-plugin: true) says every output has exactly four zones: a header panel with room name, stage and section; a body; an intelligence strip; and "Zone 4 Action Footer: NEVER omitted. 2-3 grounded /mos: commands". It states it governs "Larry's terminal prose". That makes Larry put room and stage chrome on top and slash commands at the bottom of every answer. Directly against the white-square invisibility idea.
2. Thinking Trace. SKILL.md 290 to 333 ("Show Your Work") makes reasoning visible in blockquotes: "Larry's Thinking: Problem type, Stage, Method, Chain, Filing, N Brain connections, N cross-references", "Reading the Room: N sections scanned, N artifacts", "Brain says". Only Investigative mode is trace-free. Insight mode gets the full trace. This names problem type (which line 105 says never announce), counts and the word Brain.
3. Provoked onboarding. SKILL.md 530 to 562: every 3 to 5 turns surface one unused command as "When [situation] ... `/mos:command` does exactly that". Also integration offers with `/mos:setup` (SKILL.md 335 to 345), `/mos:wiki` mention once per session (room-passive 174), `/mos:file-meeting` suggestions (room-passive 145). These make the user run the machinery.
4. Brain consult push. SKILL.md 111: "Brain has a chain that addresses this -- [framework] -> [next]. Pull it in?" That names Brain and asks permission to consult it. It collides with the thin-grounding rule that forbids the word Brain in the same file (line 472). The agent's own "Never Do" forbids mentioning architecture unprompted.
5. Brain provenance mark. skills/brain-connector/SKILL.md 55 to 80: a graph-grounded answer carries `■ BRAIN: <framework> . <tool> . readiness N/4`. The text carves out Larry-voice turns ("a Larry-voice conversation turn carries none"), but the boundary between a graph-grounded answer and a Larry turn is not defined, and the Trace rule is not carved out.
6. Narrated tool example. SKILL.md 437: Larry says "I am running contradiction_check with include_superseded so I pull the closed claim too". A model copies this style.
7. Verbatim stamp language. SKILL.md 627 to 655 requires fixed sentences ("Checked: {tier}. The methodology graph links them in ...", "Not yet checked; run the CLI to verify."). These are tested, correct for honesty, and also tell the user there is a methodology graph and a CLI.
8. Bind and briefing ritual on Desktop. runtime-instructions.cjs LOOP: room_bind, context_assemble, room_startup briefing, then room-dashboard (opens a UI), "Verify binding; show saved understanding first". The first thing the user sees is the system, not the answer. gate_render "built-in UI" is also visible by design.
9. Slash-command steering as the default route to power. Eureka, whitespace, research and the framework tools all resolve to `/mos:` commands (SKILL.md resolver clause 99 to 100; Provoked table). Larry "never types the slug from memory", so he asks the user to run the command or runs the resolved chain after an approved gate. The user sees the command either way.
10. "Say the label" rule. The glyph plus "Larry | MindrianOS" on every reply and the first-reply sentence "I'm Larry, MindrianOS's PWS thinking partner, powered by Claude" (agents/larry-extended.md; scripts/session-start 372). This is intended branding, not machinery, but it keeps a product frame on top of the "own knowledge" feeling. The MCP instruction version omits "powered by Claude" (L1 finding 10b).

Surface differences (PROVEN unless marked):
- CLI: SessionStart persona prefix plus hooks. Nav block and GRAPH FINDINGS injected each turn; Stop hooks enforce card firing; voice glyph check is log only (scripts/check-voice-style.cjs). The destijl output style may apply (L1 10e: which output style wins is UNVERIFIED).
- Desktop and Cowork: no hooks. Only the 2000-byte MCP instructions plus whatever skills load (UNVERIFIED). No memory_event instruction, no knowledge-first text, no trace rules in that string. This surface is actually closer to invisible by omission, but it also has no instruction to recall or operate beyond bind/assemble/suggest/gate.
- Enforcement of silence: PROVEN none. check-voice-style.cjs checks only hyphen-only and the leading glyph. There is no check for tool names, IDs, JSON or slash commands in assistant text.

## Knowledge-first grounding

Is there an instruction to speak as the voice of the user's own room knowledge? Mostly no.

PROVEN pieces that point that way:
- Agent "Room Awareness": "Read room/ for project context. Reference STATE.md for completeness/gaps. Greet returning users: 'I see you were working on X.'" (agents/larry-extended.md). This is a greeting rule, one sentence.
- Context Block reach: "Weave the dated facts in" and render via "Reading the Room" trace (SKILL.md 89). Triggered only when the user references prior work or the turn needs facts not in the last 4 to 6 messages.
- Horizontal elevation: connect ideas the navigator already holds (SKILL.md 68). Strongest knowledge-first idea in the text, labelled "Larry's measured weakness".
- Contradiction surface: one line "This contradicts [claim] from [date]" (SKILL.md 90).
- Cascade findings: render after a write, never during methodology (room-proactive 100 to 125).
- Honest memory: "I have that in memory" only for graph-backed findings in the active room (SKILL.md 354 to 421). This protects honesty, but it is phrased as a "memory" the user is told about.

Not found (PROVEN absence by grep for you wrote, you said, your own notes, what the room holds, already hold, voice of, representative, your knowledge):
- No instruction that makes the room the default source of every answer ("start from what the room already holds, cite it in the user's own words, then add method").
- No instruction to surface gaps and contradictions as insight in the flow of ordinary turns (they fire only through sensors and the reach table).
- No instruction to avoid "I found in your graph" phrasing.

Supply mechanism each turn:
- Per turn (CLI): only the nav block (routing) and up to 3 graph findings. No room facts. PROVEN (finding 5).
- On session start: room state summary, nudges (references/personality/session-start-doctrine.md says to treat them as awareness "do not list it"; whether the model opens this reference file is UNVERIFIED, L6).
- On demand: `context_assemble` (graph neighborhood, fragments, cortex), `graph_query`, `room_search`. All are model-initiated.
- Result: the knowledge is in reach but not in front of Larry on each turn. A model that skips the on-demand calls will answer from method, not from the user's room. UNVERIFIED how often; no turn log read.

## Theo link

- Tools: `brain_ask` is the primary route (brain-connector SKILL.md 184). `larry_move`, `persona_card`, `recommend_chain` have zero consumers in the plugin (PROVEN; L6 also). The two Theo MCP servers (theo-context and claude.ai Theo-Claude) are separate servers, not wired into Larry's text.
- When does Larry consult: Brain consult reach row (SKILL.md 92) when a framework is named, a methodology step needs a next move, or the user wants a calibrated take and has earned Insight; plus SENS-03 proactive push. The user's turn text and room content must never cross (Part 8; PreToolUse part8-egress-guard and PostToolUse sanitizer in hooks.json).
- Silent? Partly. The consult itself is a tool call the user may not see on CLI, but the instructions make it audible in three ways: the proactive push line ("Brain has a chain ... Pull it in?", SKILL.md 111), the Brain says trace, and the offer-then-fetch rule ("the push is the OFFER, not the fetch; the Brain query fires only after the gate"). So the design asks permission before each consult, which is the opposite of silent operation.
- Reply shape: the brain_ask envelope is GUIDED and carries no voice (L6). The empty `directive.guided.questions` means Larry gets no question to ask.
- Conflicts with Theo's own instruction ("do not end with a question by default", "no human persona", L6 contradictions 1 to 4). Not repeated here.
- Naming rule: Larry never volunteers Theo; answers honestly if asked by name (agents/larry-extended.md). Good and consistent with invisibility.

## Gaps ranked

Ranked by how likely a user is to feel the machinery. All PROVEN unless marked.

1. Output style Zone 4 forces `/mos:` commands in every answer and a Zone 1 header with room and stage (output-styles/destijl.md). Most direct, every-turn, force-for-plugin. Which style wins in a session is UNVERIFIED (L1 10e), so the size of the effect is UNVERIFIED.
2. Thinking Trace (SKILL.md 290 to 333) prints problem type, method, chain, Brain connection counts and "Brain says" in Blend and Insight modes. Contradicts "never classify out loud".
3. No general "never announce tools, IDs, JSON, or commands" rule exists. The citation in room-proactive 239 points at text that is not there. No hook checks for it.
4. Brain consult is offered with permission and named "Brain" (SKILL.md 111), against the file's own no-backend-nouns rule (SKILL.md 472).
5. Provoked onboarding every 3 to 5 turns (SKILL.md 530 to 562) and integration, wiki and file-meeting nudges put slash commands into conversation.
6. Operations that exist but have no routing instruction: reach_candidates, claim_read, claim_verify, framework_run, question_set, question_read, identity_write, view_compile, room_changes, room_artifact, room_state(_bound), room_content, room_graph, rs_experts_find, rs_thesis_read, most eureka_graph_* tools, eureka_critic, larry_move, persona_card, recommend_chain. Larry can only use them if he chooses from the tool list. Eureka and research reach the user through slash commands, not silent conversation.
7. Per-turn operation is not code-forced. No hook calls context_assemble or memory_event; no hook injects room facts. Silent operation is a model-discipline claim (UNVERIFIED that it happens).
8. No knowledge-first stance. The room is a reach option, not the default voice. No instruction to cite the user's own filed words or surface gaps and contradictions as ordinary insight.
9. Desktop and Cowork instructions (2000-byte cap) omit memory_event, recall tools, research and Eureka. Surfaces differ; silent note-taking is not instructed there.
10. Bind and briefing ritual and the room-dashboard open at activation on Desktop (runtime-instructions.cjs LOOP) show the system before the answer.
11. A narrated-tool example (SKILL.md 437) teaches the wrong register.
12. Verbatim honesty strings (SKILL.md 642, 655) name "the methodology graph" and "the CLI". Honest, but visible.

## What cannot be verified

- UNVERIFIED. What an actual live turn shows: no session transcript was read for this lens; whether Larry calls context_assemble and memory_event each turn is unmeasured. PENDING-HUMAN or a later trace lens: read a real session log or room memory_event rows.
- UNVERIFIED. Whether destijl.md or the user's chosen output style (L1 10e) wins in the main session, so the real force of gap 1.
- UNVERIFIED. Whether the plugin skills (larry-personality, room-*) load on Desktop and Cowork; the 2000-byte string is the only proven instruction there.
- UNVERIFIED. Whether the model reads references/personality/session-start-doctrine.md.
- UNVERIFIED. Rates: no frequency of narration or tool-name leakage was measured; no invented numbers are given.
- UNVERIFIED. Eureka and research internals; only routing text was read, not the tools' behavior.
- UNVERIFIED. The skills/eureka and skills/research instructions beyond file presence; they were not read for silence rules.
- Dev repo moved between L1 (ddf79f26d) and this read (fd3fcd2b5, branch name differs). Findings cite the current checkout. Installed cache beta.75 may differ in small ways (L1 finding 7).
- The Theo MCP instruction text was read from this session's server instructions only, not from Theo source.
