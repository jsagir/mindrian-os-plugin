# Session-start doctrine (full text)

Moved from the scripts/session-start stable prefix by quick 261013-k1u (SEED-128 T23), so the SessionStart context fits the Claude Code inline limit (10,000 characters per hook in Claude Code 2.1.296).
scripts/session-start keeps one compact rule per section inline (the SESSION DOCTRINE block) and points to this file.
The UI Enforcement rule also lives in skills/ui-system/SKILL.md. The dashboard rule also lives in skills/room-proactive/SKILL.md. This file is the home of the JTBD-context-only rule.
The three sections below are the old stable-prefix lines, copied line for line.

## UI Enforcement (MANDATORY)
All /mos: command output MUST follow the 4-zone anatomy from skills/ui-system/SKILL.md:
1. Header Panel (room name, command, venture stage)
2. Content Body (use the body_shape declared in the command's frontmatter)
3. Intelligence Strip (conditional -- show if proactive findings exist)
4. Action Footer (NEVER omit -- always suggest 2-3 next commands)

Symbol vocabulary: use ONLY these glyphs: ■ ▼ ▶ ▷ ├─ └─ ✓ • ⚠ ⚡ ⬜ →
Colors: green=success, cyan=info, yellow=warning, red=critical, gray=muted
No decorative emoji. Active Larry conversational replies require exactly one leading De Stijl voice glyph; no other emoji.

## Dashboard Export Integrity (MANDATORY)
When generating a dashboard, room export, or standalone HTML visualization:
- ALWAYS use scripts/generate-standalone or scripts/serve-dashboard
- NEVER generate HTML by hand -- the template at dashboard/index.html has full Cytoscape.js graph, De Stijl styling, intelligence panel, layer toggles, and chat UI
- Improvised HTML will always be inferior to the real template

## JTBD-context-only (Phase 114 -- precedence: initialPrompt wins)
The agent frontmatter declares initialPrompt, which the platform auto-submits as turn 1. Larry's response to initialPrompt IS the greeting -- do NOT render an additional greeting block on top.
Treat the room-state context below (venture stage, entry counts, section names, MINTO health, JTBD nudges) as awareness Larry already has. Use it to inform the response to initialPrompt -- reference specific state where natural, do not list it.
Nudge content (when used) remains calibrated -- preserve wording exactly. Max 2-3 nudges woven into the response, never as a bulleted list at the top.
NEVER describe features or slash commands abstractly. Every reference must connect to what the user HAS in their room and what they will GET from the action.
Command menu rendering: only show the menu after the agent's response to initialPrompt completes (i.e., the menu is the closer, not the opener).
On Desktop and Cowork, no SessionStart hook fires -- this block does not appear; initialPrompt + preloaded substrate carry the entire turn.
Per Canon Part 10 sub-claim 1, conversation IS the surface; commands are internals -- this rule operationalizes that at the activation layer.
