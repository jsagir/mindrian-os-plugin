# L1 operational inventory: is Larry wired and loaded?

Repo path used for all reads: /home/jsagi/dev/MindrianOS-Plugin (branch release/beta.77-changelog-carry, HEAD ddf79f26d, package.json 2.0.0-beta.76). The path /home/jsagi/MindrianOS-Plugin is an empty stub (only .git/hooks, a .env); this file sits there only because the brief named it.
Installed: /home/jsagi/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.75 (installed_plugins.json line 121-122 pins beta.75; beta.69 and beta.73 also cached).
Marks: PROVEN = read or ran. UNVERIFIED = not checked. No em or en dashes used.

## Question
Is Larry operational: are the persona files present, parseable, registered and injected, does the cache match the repo, and does anything contradict or duplicate the persona?

## Findings
1. PROVEN. Files exist and parse. YAML frontmatter of agents/larry-extended.md (224 lines), skills/larry-personality/SKILL.md (667 lines), output-styles/destijl.md all load with js-yaml; hooks/hooks.json and .claude-plugin/plugin.json are valid JSON. Every script named in hooks.json that I checked exists (session-start, sessionstart-coordinator.cjs, intent-classifier(.cjs), first-install-router.cjs, check-voice-style.cjs, check-card-fire.cjs, card-before-answer-hook.cjs, mva-detect.cjs, admin-command-gate.cjs).
2. PROVEN. Larry is the plugin default agent: settings.json (plugin root) has "agent": "larry-extended". plugin.json lists hooks ./hooks/hooks.json and ./hooks/mos-face.json (mos-face.json loads lib/mos-face/dist/register.js).
3. PROVEN. SessionStart injection: scripts/session-start lines 367-373 build stable_prefix "[MindrianOS v...] You are Larry." plus the rule: every active Larry reply opens with one De Stijl glyph then "Larry | MindrianOS"; first reply says "I'm Larry, MindrianOS's PWS thinking partner, powered by Claude." Prefix is placed in the context at lines 664, 742, 763, 799 (room, first install, update, no-room mode menu). Hook runs on startup|clear|compact (hooks.json lines 4-15, 33-40). Other SessionStart hooks (npm reconcile, post-update preflight, coordinator, reference seed, breakthrough, ambiguous, graph drain, agentshield) do not inject persona text; coordinator emits a short additionalContext (scripts/sessionstart-coordinator.cjs lines 149, 215) with no Larry grep hits.
4. PROVEN. UserPromptSubmit: admin-command-gate, intent-classifier (run-hook.cmd -> scripts/intent-classifier -> intent-classifier.cjs), mva-detect, first-install-router. Only first-install-router.cjs injects persona wording (lines 303, 320-322: "open with a short Larry greeting carrying exactly one De Stijl glyph", "Continue as plain Larry conversation"). intent-classifier.cjs injects routing/room-binding gates, no persona text. So the persona is injected at SessionStart only; no per-turn voice reinforcement exists.
5. PROVEN. Voice enforcement is log-only. scripts/check-voice-style.cjs lines 1-40: Stop hook, "LOG ONLY... NEVER blocks", rung 2. lib/hmi/voice-color-mark.cjs lines 29-35: "There is NO hook that recolors every literal assistant token"; guarantee is declared convention only.
6. PROVEN. Local evidence of misses: /home/jsagi/.mindrian/voice-style.jsonl has 9042 rows; policy voice-glyph-present has 284 rows (2026-09: 130, 2026-10: 154), voice-hyphens-only 235. Latest glyph miss 2026-10-29T08:22:22Z on beta.75 (hasMark=false, count=0, isNativeHost=false). Per-version miss counts: beta.51 71, beta.53 86, beta.47 48, beta.69 9, beta.73 8, beta.75 1. Rows are written only on a violation, so no miss rate can be computed (turn total unknown).
7. PROVEN. Repo vs cache beta.75 drift is small, all in the repo being newer:
   - agents/larry-extended.md: repo adds line 93 and a sentence in line 244 ("Your call: A | B | What if C" moonshot fork rule, commit 656cd8a34, 2026-10-28, Phase 359-09). Not in beta.75.
   - skills/larry-personality/SKILL.md: same added sentence at line 244.
   - hooks/hooks.json: statusMessage text only (line 24).
   - Identical between repo and beta.75: output-styles, references/personality/*, lib/hmi/voice-color-mark.cjs, lib/mcp/larry-context.cjs.
   - Against beta.73: same diffs plus hooks/mos-face.json absent in beta.73. Against beta.69: also references/personality/voice-dna.md differs.
   - /home/jsagi/.claude/plugins/mindrian-os (legacy dir, version beta.75) has agent and skill files identical to the beta.75 cache (diff -rq empty).
   - Persona text last changed in 2026-10 (commits 05a0415ff 2026-10-11, 656cd8a34 2026-10-28), so the persona files were touched recently; the question is content, not absence.
8. PROVEN. Tool names in persona text still match registered tools. Agent/hook text names room_list, room_bind, context_assemble, room_startup, suggest_next, chain_resolve, chain_run, gate_render, gate_answer, stop_gate_check, status_read, memory_event, brain_ask/brain_query/brain_schema; all appear in this session's tool list (mcp__plugin_mos_mindrian-os__* and mcp__plugin_mos_mindrian-brain__brain_*). persona_card and larry_move are not referenced anywhere in agents/, skills/ or lib/mcp (grep: only two docs files in docs/ mention them). They exist as Theo tools (mcp__theo__persona_card, mcp__theo-context__larry_move) but nothing in the persona points to them.
9. PROVEN. No dead file references: every lib|scripts|references|skills|commands|agents|hooks|data|tests|templates path cited in agents/larry-extended.md and skills/larry-personality/*.md exists in the repo.
10. PROVEN. Contradictions:
   a. Glyph vs output style. output-styles/destijl.md (force-for-plugin: true, lines "Symbol Vocabulary") says "NO EMOJI in command output" and requires a 4-zone layout with a Zone 1 header first; agent and session-start require the first token to be a coloured emoji square. The agent (line 41) and session-start (line 373) say old no-emoji rules "yield only to the single leading voice glyph", but destijl.md itself carries no such carve-out. Two competing first-line rules in one prompt stack.
   b. "powered by Claude" vs MCP server instruction. Agent line 39 and session-start line 372 require "powered by Claude"; the plugin:mos:mindrian-os MCP instruction (seen in this session) says the first line is "I'm Larry, MindrianOS's PWS thinking partner." and "never claim Claude or GPT without host evidence".
   c. Persona source vs Theo MCP instruction. Agent line 37 says "modeled on Prof. Lawrence Aronhime"; the Theo (claude.ai Theo-Claude and theo-context) instruction says to adopt "not a human persona, credentials, repeated closers", and ties Ask-Tell dial to host judgment, "do not expose a numeric dial". The Larry skill is built on the dial and turn-stage gating. Two instruction sets pull opposite ways when Theo tools are used.
   d. Agent frontmatter fields mcpServers, persona_variants, initialPrompt: mcpServers in plugin agents may be ignored by Claude Code (UNVERIFIED, from my knowledge of the plugin agent format); persona_variants is not a standard field. The variants map is mostly identical strings (lines 15-25).
   e. User settings outputStyle is "lej-output-fixer:Scannable" (~/.claude/settings.json line 219) while the plugin forces mos:destijl. Which one wins in a given session is UNVERIFIED.
11. PROVEN. Style guide path missing: /home/jsagi/MindrianOS/.planning/research/pws-academy-input/ does not exist, so the Lawrence style guide named in the brief could not be read by me.

## Wiring map
- settings.json "agent": larry-extended -> agents/larry-extended.md (skills: larry-personality, context-engine, room-passive, room-proactive; mcpServers: mindrian-os).
- SessionStart (startup|clear|compact) -> hooks/run-hook.cmd session-start -> scripts/session-start -> stable_prefix "You are Larry" + room/first-install/update/no-room blocks.
- UserPromptSubmit -> intent-classifier.cjs (routing, binding gate), first-install-router.cjs (persona greeting on first install).
- Stop -> check-card-fire.cjs (gate card), check-voice-style.cjs (log only), others.
- PreToolUse -> card-before-answer-hook.cjs on gate_answer; part8-egress-guard on brain_* calls. PostToolUse -> brain-response-sanitize-hook.cjs.
- Output style: output-styles/destijl.md (force-for-plugin).
- MCP: .mcp.json mindrian-os (scripts/mindrian-mcp-server.cjs) and mindrian-brain (scripts/mindrian-brain-mcp-client.cjs), both alwaysLoad. Agents also listed: larry-extended and mos:larry-extended.
- Skills: larry-personality (plugin, shown as mos:larry-personality), plus user-level ~/.claude/skills/larry-personality/SKILL.md which is a symlink into the legacy ~/.claude/plugins/mindrian-os dir (same content as beta.75).

## Dead or conflicting references
- Dead: none found in persona files (finding 9).
- Duplicates that can conflict:
  - ~/.claude/agents/larry-extended.md symlink to ~/.claude/plugins/mindrian-os/agents/larry-extended.md (legacy dir, beta.75) in parallel with plugin agent mos:larry-extended from the cache. Same content now; will drift at the next update because the legacy dir is separate from the cache.
  - ~/.claude/skills/larry-personality symlink (legacy dir) plus plugin skill mos:larry-personality.
  - ~/.claude/skills/larry-theo/SKILL.md (copy dated Oct 9, Book of Innovation variant, "stripped of glyphs").
  - anthropic-skills:larry-extended and anthropic-skills:mindrian-larry, present as synced copies under ~/.claude/skills/synced/bce8247d-..._ac553c6e-.../ and /mnt/c/Users/jsagi/Documents/mindrian-skills/mindrian-larry. I did not diff them against the repo persona; content UNVERIFIED.
  - Two further Larry voices come from MCP instructions (plugin:mos:mindrian-os and Theo-Claude); see finding 10b, 10c.
- Agent frontmatter oddities: finding 10d.

## What cannot be verified
- What this subagent received: my own context had no SessionStart Larry block, no navigation blocks and no output style text (subagent context). I only saw the MCP server instructions. The main session's actual injected blocks, and which output style (mos:destijl or lej-output-fixer:Scannable) is active there, are UNVERIFIED.
- Whether the plugin settings.json "agent" key and the agent's skills list actually load in the running session: UNVERIFIED (no runtime trace).
- Whether Claude Code honors mcpServers in a plugin agent: UNVERIFIED.
- Glyph miss rate: UNVERIFIED (log records violations only).
- Content of anthropic-skills copies vs repo: UNVERIFIED.
- Lawrence style guide and CONTEXT.md: PENDING-HUMAN (path absent).
- Persona content quality, "vibe" fidelity to Lawrence: out of scope for L1.
