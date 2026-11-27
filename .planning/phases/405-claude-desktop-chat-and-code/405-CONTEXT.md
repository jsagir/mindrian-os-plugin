---
phase: 405
title: "MindrianOS on the Claude Desktop platform: the merged chat (chat plus Cowork, cloud with the device bridge) and the Desktop Code tab, beside the CLI"
canon_parts: [3, 8, 9, 11, 12]
status: CONTEXT; EGM design step next (elephant, goldfish, resolve), then /gsd-plan-phase
date: 2026-11-27
method: GSD frame with EGM design step (project CLAUDE.md, owner ruling 2026-11-25); six-hats lens on the evidence
---

# Phase 405 CONTEXT

## Owner need (verbatim, 2026-11-27)

- "we need to add a GSD quick that explains to mindrianOS that claude desktop current latest version as chat+cowork as one. and the claude desktop code, mindrian need to work in those as well as in cli"
- "i want to optimize mindrian for usage in the claude desktop platform its chat\code !"
- "use /mos:hat-briefing based on rethinking-mindrian and use elephant-goldfish based on your findings here and the convo we had. and consolidate and plan"
- "we need book-site to make needed changes also, send it a quick gsd phase that understands we need to make changes there accordingly"

## Owner rulings (LOCKED: a reviewer may say a design fails one, never that it is wrong)

- OR-1 (card 2026-11-27, "Map now, fixes later"): quick 261127-hdl writes the surface doctrine (docs/CLAUDE-SURFACE-MODEL.md, CLAUDE.md, decisions.md). The product fixes are THIS phase.
- OR-2 (2026-11-27): MindrianOS must work in three places: the CLI, the Claude Desktop Code tab, and the Claude Desktop merged chat (formerly chat plus Cowork). "Optimize" means first-class there, not "degrades gracefully".
- OR-3 (2026-11-27): the website repo (~/dev/mindrian-website, branch book-site) changes its surface and install wording to match. Coordination item; that repo runs its own GSD quick.
- Standing: Part 8 (no room content to the Brain), Part 9 (room.db is the local mind; only a human confirms), Part 11 (born wired with a declared HITL shape), Part 7 (reuse before build), the 367 owner rulings (OR-1 of 367: an answered CLI card is a confirmed decision).

## Evidence (read these)

- Surface radar (17 primary Anthropic pages read 2026-11-27): .planning/quick/261127-hdl-surface-model-cowork-merged-into-chat/claude-surface-radar.md (room copy: ~/MindrianRooms/rethinking-mindrianos/research/2026-11-27-claude-surface-radar/claude-surface-radar.md).
- Field evidence 2026-11-27 (spike 012 legs A1, A2 on Windows Desktop): a local stdio server from claude_desktop_config.json is reached by the merged chat as mcp__remote-devices__<server>__<tool>; a detached child of that server survives the reply end and a Desktop quit. Detail: radar "Field evidence" section; .planning/spikes/012-detached-runner-survival/README.md on branch work/367-spike-kits.
- Prior Desktop work: Phase 369.1 (Desktop plugin install; mos-desktop copy without bin/; D-09 scope truth "tools in Cowork and the Code tab, skills and commands in Chat"; .mcpb extension for Chat was a follow-up seed). Room trail: ~/MindrianRooms/rethinking-mindrianos/research/2026-10-04-phase-369.1-desktop-plugin-install-close-out.md.
- Phase 367 (graph writes itself): CLI path merged (plans 01, 03, 05, 06); Desktop path (plan 11 MCP spawn wrapper) not built; owner jsagi-42. .planning/phases/367-newborn-room-graph-connected-no-repair/.
- Phase 402 (hot-18 alwaysLoad with deferral checked on Desktop and Cowork) overlaps the alwaysLoad finding (Claude Code 2.1.304).

## Known facts the design must face (from the radar; check each in code)

1. Merged chat loads skills and commands-as-skills; it ignores agents, hooks and plugin local MCP servers (platform-support table). The merged chat reaches a local stdio server from claude_desktop_config.json (or a desktop extension) through the open Desktop app only.
2. The merged chat's work runs in an Anthropic cloud sandbox; local access needs the open Desktop app on a linked computer; cloud writes to the local disk could report success without arriving (fixed in Claude Code 2.1.300; read-back still wise).
3. The Desktop Code tab, local session, is full Claude Code (plugins, hooks, .mcp.json, ~/.claude.json, claude_desktop_config.json). Cloud Code sessions and new-Projects threads see no local disk.
4. Hooks never run in the merged chat for a consumer account (3P-only exception).
5. Open UNVERIFIED items are listed in the radar; the design must not rely on them without a spike.

## Coordination

- jsagi-42 owns the rest of Phase 367 (incl. plan 11, the MCP spawn wrapper). 405 must not duplicate it; it may change its target.
- The website repo (branch book-site) gets a hand-off brief, not edits from this repo.

## Peer agreements (jsagi-42, owner of 367, 2026-11-27; coordination, not owner rulings)

- PA-1 (P1 ACCEPTED): one wrapper. 405 adds a postCall duty list inside lib/mcp/graph-catchup-spawn.cjs (367-11). Conditions: (1) build only after 367-11 and 367-12 reach origin/main (planned for the beta after the current cut); never branch from work/367-graph-writes-itself; (2) every duty runs after the tool result is returned, never delays the response; each duty is isolated (a throw or timeout is caught, logged once, and does not stop the spawn or other duties); (3) duties run only on calls the wrapper already selects (no new call class without a census row); (4) tests/test-367-governed-census.cjs and tests/test-367-catchup-mcp.cjs groups ac2 and ac8mcp stay green unchanged; 405 adds its own arms.
- PA-2 (P2 ACCEPTED): a desktop_bridge leg in the governed-tool census as a separate counted leg; the GOVERNED 69 / PURE_READ 7 pins move only by the count the 405 plan states, with the reason.
- 367-CONTEXT:35 correction ("Desktop and Cowork (MCP only, no hooks)" is wrong for the local Desktop Code tab, which runs the 367 CLI hook path): recorded in 405 files only; jsagi-42 does not edit 367-CONTEXT now.
- get-mindrian route B (marketplace) still says "Cowork, use an existing folder": jsagi-42 raises it to the owner as a pre-cut item.

## Owner rulings from the card of 2026-11-27 (LOCKED)

- OR-4 (O1, "Click-proof card"): in the Desktop chat a decision counts only when the person clicks an interactive card that proves a human click (MCP App gate card on the browser_nonce route, B3.2). Until that exists, a typed choice counts for ordinary choices (recorded mcp_relayed), never for room creation or claim confirmation.
- OR-5 (O2, "Yes, with a fix line"): a MINDRIAN_ROOM pin outside the room registry stops accepting writes; the refusal shows one line with the fix (/mos:rooms adopt).
- OR-6 (O3, "Yes, build it"): build the .mcpb desktop extension now, in Phase 405, as a third install artifact (one-click chat install, bundled node_modules, the Node that ships with Desktop).
- OR-7 (O4, owner's own words): "theo can be more open. maybe even using theo-context so the generative ui will kick in in desktop version". Reading: in the Desktop chat Larry may use the theo-context server (generic methodology, framework cards with Theo's generative UI) openly for method, not only the guarded mindrian-brain route. Canon Part 8 still binds (no room content to any Theo server; theo-context's own tool text says "Do not send private case text"). The signed-egress option B2.2 (O5) is not pursued.
- O6 (Phase 404 ordering) was not asked; the design's recommendation stands until the owner rules: start 404 right after 405 slice 5, with chat as a named 404 target.
- OR-8 (O7, 2026-11-27, owner's words "No key now, will add later"): ship theo-context (https://theo-context.onrender.com/mcp) inside the plugin with no key now; a key may be added later. The install-time entitlement stays as it is. Part 8 still binds (the egress matchers are extended to the plugin-prefixed tool names).
- OR-9 (O6, card "After 405 base"): order is 405 foundation, then the overlapping parts of 401 and 402, then 404 recipes with chat as a named target, then the 405 end slice ("commands work in chat").
- Owner approved pushing branch work/405-desktop (card 2026-11-27).
- OR-10 (O8, card 2026-11-27 "Refuse saves"): when room.db was written by a newer MindrianOS, an older copy (for example a stale extension) refuses writes with `room_schema_newer` and one update line; reads stay allowed.
- OR-11 (O9, card 2026-11-27 "Yes, everywhere"; the owner chose this against the recommended narrow scope): the "registered rooms only" write rule applies in every place and for every room source (CLI and local Code tab included), not only pins and the Desktop chat. Consequence to design for: existing CLI rooms that are not in the central registry stop accepting writes until adopted; the refusal must carry the working fix line, and a migration or doctor step must find and offer to register them.
- OR-12 (O10, card 2026-11-27 "Checked artifact"): the .mcpb is a release artifact checked by verify-release --mcpb, like the UI shell assets; it is not a new numbered place in RULE 5.

## Owner rulings from the program card of 2026-11-27 (LOCKED)

- OR-13 (program item 4, owner's own words): "use copilot kit's generative ui to create such that follow the rules of the Book of Innovation's Feynman chapter: simplicity tests whether you can explain the idea clearly; look up in theo". Reading: in the Desktop chat a recipe is delivered as generative UI cards in the theo-context CopilotKit style (repo ~/dev/theo-context-copilotkit: framework-cards.js, interaction-moves.js, chat-ui), one step per card, with no helper agents; each card must pass the Feynman chapter rule. Theo canon (canon_search 2026-11-27, chapter "feynman"): SYNTHESIS "simplicity isn't the coat of paint you put on an idea once the real work is done. Simplicity is a test"; CONCEPT names the failure mode, the Curse of Knowledge. Theo has no authored steps for "The Feynman Test" (framework_walkthrough authored returned unknown_framework), so the card rule comes from the chapter text, and authored steps are a Theo-side follow-up. The guarded Brain route stays for the CLI and the local Code tab. Part 8 unchanged (no room content to any Theo server).
- OR-14 (program item 2, "Yes, run it first"): the mechanical frontmatter fix F1 (Phase 401) runs right after the beta.95 cut, before the 405 build.
- OR-15 (program items 3 and 5, "Split and start small"): 400.5 owns prompt hooks and runs after 367-11 and 367-12; 402 owns the card-fire false-block fix (K4) and the session-start cap (F2), and those two start now as small plans; 400.3-09 folds into 402.
- OR-16 (program item 1, "Yes, one session"): drop the separate Cowork test L-CW1; add a tool-deferral leg (do tools load on demand in the merged chat) to the 405 Desktop spike session.
- OR-17 (owner's own words, 2026-11-27): "we need to build relevant components, such as an F-shape, and components that play and run the frameworks etc., suggest the next etc." Reading: the Desktop chat gets a small set of generative UI components (MCP Apps on the one MindrianOS server, house rules in .claude/skills/mindrian-mcp-app/SKILL.md), in the Theo CopilotKit card style and under the Feynman rule of OR-13: (1) a Shape F card (decision gate, F.0 to F.8; this is also the click-proof card of OR-4); (2) a framework player card that plays and runs a framework step by step (the recipe surface of OR-13); (3) a next-move card (suggest_next, F.1). Reuse before build: the existing decision view (lib/mcp/gate-app.cjs, ui://mindrian-os/decision/v1.html), the room app views (lib/mcp/app-views.cjs), and theo-context's framework-cards.js and interaction-moves.js as the style reference.
- OR-18 (owner's own words, 2026-11-27): "let Feynman chapter's rules in Theo guide any copilot kit generative ui components, react or any (or use the mcp apps alternative, as claude code and gpt know these better and can better suit; then to be investigated using tavily)". Reading: the Feynman rule ("Simplicity is a test"; avoid the Curse of Knowledge) is the design standard for EVERY generative UI component, whatever the technology. Technology finding (Tavily, 2026-11-27; secondary sources unless marked): MCP Apps (SEP-1865, extension io.modelcontextprotocol/ui, ui:// resources, _meta.ui.resourceUri, sandboxed iframe, JSON-RPC over postMessage) is the official MCP extension, co-developed by Anthropic and OpenAI and final since 2026-01-26; hosts listed: Claude web and desktop, ChatGPT, VS Code Copilot, Microsoft 365 Copilot, Cursor, Goose (alpic.ai, antlr-interactive.com client matrix of 2026-10-16, modelcontextprotocol csharp-sdk issue 1431). CopilotKit React components render only inside an app that embeds CopilotKit, not inside Claude Desktop; CopilotKit itself renders MCP Apps through MCPAppsMiddleware over AG-UI (copilotkit.ai blog, primary for CopilotKit). Decision for the design: build the components ONCE as MCP Apps on the one MindrianOS server (the repo's existing pattern); the same views then render in Claude Desktop chat, ChatGPT and any CopilotKit-based web surface (for example the Theo CopilotKit app); no CopilotKit dependency inside the plugin. Hosts without MCP Apps get the useful plain-text fallback the spec asks for.
