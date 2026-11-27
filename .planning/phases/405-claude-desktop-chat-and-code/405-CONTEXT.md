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
