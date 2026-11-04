# L6: Theo side and routing

Date: 2026-10-29. Lens L6. Read only. Source tree read: installed cache `/home/jsagi/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.75/` (CACHE). The dev repo `/home/jsagi/MindrianOS-Plugin` shows no files at its top level from `ls` (output empty), so no claim below reads the dev repo.

## Question

Where does Larry's personality come from at runtime? Does the Brain (Theo) directive path reach the model in the beta.75 session, or does it fall to a Tier 0 fallback? What does "Tier 0" mean for the persona? Do Theo guidance and plugin text contradict each other?

## Runtime path diagram in words

1. Plugin text is the only source of the Larry voice. PROVEN.
   - SessionStart hook `scripts/session-start` builds `stable_prefix="[MindrianOS v${PLUGIN_VERSION}] You are Larry. ..."` (CACHE scripts/session-start line 367 to 373) and emits it as `hookSpecificOutput.additionalContext` (line 2089).
   - The long doctrine was moved out of this prefix into `references/personality/session-start-doctrine.md` (32 lines). The script only keeps "one compact rule per section inline" and a Pointers block that names the file (comment lines 358 to 365, 1889). Whether the model reads that file is UNVERIFIED.
   - The agent body `agents/larry-extended.md` (222 lines) and the skill `skills/larry-personality/SKILL.md` (667 lines) hold the voice, the dial, the glyph rule and the Decision Gate rule. They load only when the agent or skill is invoked or the skill is matched.
   - The MCP server instructions for `plugin:mos:mindrian-os` (shown in this session) say "You are Larry, MindrianOS's PWS thinking partner." That is a short second source.
2. Brain (Theo) path. PROVEN reachable in this session.
   - `.mcp.json` in CACHE registers `mindrian-brain` as `node scripts/mindrian-brain-mcp-client.cjs` (alwaysLoad true). This is the stdio shim.
   - The user-level shadow is absent: `~/.claude.json` top-level `mcpServers` keys are n8n-mcp, arxiv-mcp-server, my-neo4j, langflow, sequential-thinking, mindmap, sefaria-jewish-library, tavily-mcp, pinecone, upstash, git, octagon-deep-research-mcp, think-tool, lightrag-mcp, figma, nanobanana-pro-mcp, timeless, excalidraw, google-forms, miro, langtalks-graph-expert, theo, theo-context, gmail-local. No `mindrian-brain`. A project-level check found no `mindrian-brain` either.
   - In this session the tool `mcp__plugin_mos_mindrian-brain__brain_ask` is registered and returned a real envelope (see below). So the shim is not shadowed and not at the unreachable branch.
3. The envelope is pull, not push. PROVEN by hook list.
   - No hook calls `brain_ask` or injects an envelope each turn. `hooks/hooks.json` has only: a PreToolUse egress guard and a PostToolUse sanitizer on brain tools (matcher on `mindrian-brain|pws-brain-mcp`), and UserPromptSubmit hooks (intent-classifier, mva-detect, first-install-router, brain-derivation-drain, and others). The model sees an envelope only if Larry chooses to call `brain_ask`.
   - Consumers of `lib/core/directive-envelope.cjs` (non-test): `scripts/mindrian-brain-mcp-client.cjs` (wraps the answer), `lib/core/arbitration.cjs`, `lib/core/fusion-router.cjs`. `session-context-envelope.cjs` and `arbitration-log.cjs` only mention it.
4. The envelope carries no persona. PROVEN. It carries `mode` (GUIDED), `directive.guided {questions, framework, stage}`, `user_override` strings, `next_gate` F.1 options, and `grounding.rows`. The voice is not in it.
5. Navigation engine blocks. PROVEN source, UNVERIFIED injection point.
   - The line "Tier 0 fallback: BRAIN.md staleness unavailable." is produced at `lib/core/navigation-engine.cjs:1691`.
   - `resolveTierMode` in `lib/core/navigation-engine-shared.cjs` lines 159 to 170 returns `tier_0` when the local BRAIN.md record is null, parse-failed, or `staleness === 'unavailable'`, before it looks at whether the Brain is reachable. So Tier 0 here is about the local derived file BRAIN.md, not about the MCP wire. Checked: `~/.claude/BRAIN.md` and `~/MindrianRooms/*/BRAIN.md` do not exist (ls error).
   - Effect in code: `applyStalenessMultiplier` gives weight 0.0 for this state (navigation-engine-shared.cjs lines 103 to 130). Mode A paths (RECOMMENDED markers, line 724 `tierMode === 'mode_a' && weightApplied > 0`) are off. The engine still decides reaches and F.1 cards from local sensors.
   - Conclusion: Tier 0 in the navigation block does not remove the persona text and does not mean the Brain shim is down. It means the engine runs without Brain weighting of its picks. Whether the CLI-side "Tier 0" in the changelog (Brain key missing) is the same thing: no. The CHANGELOG line 117 says the Tier 0 branch of the Brain client is gone (SEED-119, no key on Theo path). Two different "Tier 0" meanings exist.
6. Stop-hook gate. PROVEN present: `scripts/check-card-fire.cjs` and `scripts/check-voice-style.cjs` run on Stop. The agent text says the gate's verdict wins over prose (larry-extended.md line 91). It enforces card firing and voice style (glyph), not the Ask-Tell content.
7. Theo MCP tools `larry_move` and `persona_card` are not wired into the plugin. PROVEN by grep: no hit for `larry_move` or `persona_card` in CACHE scripts, lib, agents, skills, commands, hooks or .mcp.json (only `theo-ask.cjs` and `brain-surface-contract.json` mention theo-mcp reads, for `recommend_chain` and `framework_route`). The CHANGELOG has no line for either. They are reachable only if the model picks them from the tool list.

## Tool call results (verbatim short excerpts)

- `mcp__plugin_mos_mindrian-os__contract_version`: `{"version":"1.15.0","trust_boundaries":["local","brain-proxy"]}`. The contract version reads 1.15.0 while the plugin is 2.0.0-beta.75. Meaning UNVERIFIED.
- `mcp__theo__persona_card` (hat blue, name Innovation, archetype Mentor): `"card_text":"AT YOUR TABLE: Dr. Innovation (blue hat, Mentor)\n(They argue, you decide.)"`. It returns a de Bono hat team member, not Larry and not Lawrence. The tool description says "Pure render: reads no graph". Larry persona content: none.
- `mcp__theo__theo_health`: `"mode":"ok"`, `"served_as":"stdio"`, `"build_stamp":{"sha":"d364418c...","builtAt":"2026-10-14T14:35:31.729Z","dirty":true}`, `"sync_drift":{"baseline_stamp":"command-registry@2.0.0-beta.68",... "finding":"beyond-threshold"}`, `"watcher_coverage":{"frameworks_with_watcher":5,"frameworks_total":469,"frameworks_with_problem_type":123}`. Theo is up. Its canon stamp is beta.68, the plugin is beta.75 (7 betas behind; the 10-14 build is dirty).
- `mcp__theo-context__larry_move`:
  - ask: label "Investigate", firstAction "State a provisional frame, then ask one question that could change it.", pattern "Name what is known. / Name the uncertainty that matters. / Ask one discriminating question."
  - tell: label "Explain", firstAction "Give the best supported answer now.", avoid "Do not withhold an answer until the person completes an interview."
  - challenge: label "Test the claim", firstAction "Name one load-bearing claim and the evidence that could change it.", avoid "Do not manufacture opposition or grade the person."
  - converge: label "Advance", firstAction "Synthesize the current evidence and propose one next action.", avoid "Do not treat synthesis as proof or approval to write."
  - All four: `"provenance":"MindrianOS Larry personality and PWS behavior contract, adapted for a stateless Theo Context tool."`, limits "No numeric dial, turn-count rule, stored profile or user text."
- `mcp__theo__recommend_chain` (IllDefined, 3): Four Lenses of Innovation, Cross-Disciplinary Thinking, Jobs to Be Done (JTBD); coverage `matched 1 of 4, partial`.
- `mcp__plugin_mos_mindrian-brain__brain_ask` (generic question on ask versus tell for an ill-defined problem): `"packet_type":"DirectiveEnvelope","mode":"GUIDED","mode_rationale":"default_guided_pedagogical_canon"`, `"directive":{"guided":{"questions":[],"framework":"Four Lenses of Innovation","stage":"IllDefined"}}`, `next_gate.sub_shape "F.1"` with 4 options, `grounding.rows` 8 rows (chapters ch10, redteam, ch02b, sciroad, growth, quadrant, ch02), `problem_type_source "heuristic"`, `chain_coverage partial`. The `questions` list is empty: the envelope gives no question for Larry to ask.
- The `claude.ai Theo-Claude` and `theo-context` server instructions (shown in this session) say: "Do not end with a question by default", "Adopt useful review practices, not a human persona", "Do not expose a numeric dial".

## Contradictions

1. End-of-reply question. Theo instructions: "Do not end with a question by default. Stop when the response has delivered a useful result." Plugin `agents/larry-extended.md` line 159: "End with a question or next step". Line 99: "First response: 1 acknowledgment + 1 reframe + 1 question." Skill line 36: Investigative mode, "One question per response." PROVEN, direct conflict on default. The plugin text allows "next step" as an alternative, so it is softer than "always ask".
2. Fixed ordering versus no ordering. Plugin line 99 has a turn schedule (turns 2 to 5, 5+, 8+). Theo says "enforce turn counts" is off and "run a fixed questioning-to-delivery sequence" is off. `larry_move` limits say "No ... turn-count rule". PROVEN conflict.
3. Persona. Theo says "Adopt ... not a human persona". The plugin's Larry is a named persona with a first-reply identity sentence and a glyph label on every reply. The plugin text and the MCP server instructions also differ: the agent line 39 says "powered by Claude"; the MCP server instructions say "I'm Larry, MindrianOS's PWS thinking partner." without it. Plugin-internal drift. PROVEN.
4. Numeric dial. Plugin skill uses an Ask-Tell dial with a dial TUI and engine-set dial (SKILL lines 36 to 61, 244). Theo says do not expose or send a dial. Not a data conflict (Theo never receives it), but the voice behavior differs. PROVEN.
5. Envelope versus Theo guidance. The envelope's `guided.questions` is empty and `mode` is GUIDED, while the GUIDED rule in the memory notes says Larry teaches and does not deliver. `larry_move tell` says "Give the best supported answer now." These point to different defaults for the same moment. Which one wins at runtime is not coded anywhere (no consumer of `larry_move`). PROVEN absence of arbitration.
6. `persona_card` is a hat renderer, so a reader who expects it to return Larry would get Dr. Innovation. It cannot carry Larry. PROVEN.

## Dead or unwired consumers

- `larry_move` (theo-context) and `persona_card` (theo): zero consumers in CACHE. Unwired. The plugin never calls them. PROVEN by grep.
- `brain_ask` envelope: no per-turn hook calls it. The `directive.guided.questions` field is empty in the sample. In `lib/core/directive-envelope.cjs` the only code consumers are the shim, `arbitration.cjs` and `fusion-router.cjs`. Whether those two run on a normal turn is UNVERIFIED.
- The Brain-key and Tier 0 client branch is removed (CHANGELOG line 117, SEED-119). Old comments and skills that say "Tier 0" for Brain (for example `skills/brain-connector`, `lib/hmi/tier-check.cjs`, `scripts/session-start` line about "Brain: not configured (Tier 0)") may still describe a state that no longer exists. Not opened in this lens; UNVERIFIED.
- SessionStart doctrine is now a pointer plus 32 lines in a reference file. Inline Larry text is the 6 to 9 line `stable_prefix`. If the model does not open the reference, the long doctrine does not load at session start. UNVERIFIED whether it is read.
- User-level shadow of `mindrian-brain`: not present now (PROVEN). The doctor check for the shadow exists (CHANGELOG line 664 to 668).
- Local BRAIN.md: not produced in this setup (PROVEN files absent). So the engine reports Tier 0 on every turn in the rooms checked. The drain scripts (`brain-derivation-drain.cjs`, `brain-derive`) exist but have not produced the file. Cause UNVERIFIED.

## What cannot be verified

- That the navigation blocks and F.1 card blocks are injected each turn by a hook. The source of the Tier 0 line is PROVEN; the injection path was not traced.
- Whether the model in this session read `session-start-doctrine.md`.
- Whether `arbitration.cjs` and `fusion-router.cjs` run on a normal turn.
- Why BRAIN.md is absent in every room checked (only two paths tried; `~/MindrianRooms/*` glob matched none, other room locations not searched).
- Whether Theo's canon (beta.68, dirty build 2026-10-14) differs in content from the plugin's persona; only generic calls were made.
- What `contract_version 1.15.0` is pinned to.
- The dev repo content: the top level listing was empty, so nothing here speaks for dev HEAD. Only the installed beta.75 cache was read.
- The Stop-hook gate behavior on a live turn (not run).
