---
phase: 405
kind: bridge ideas for the three honest limits (owner ask 2026-11-27 "how can we bridge those? think creatively and use tavily")
date: 2026-11-27
sources: Tavily searches 2026-11-27 (primary where marked P; S = secondary)
---

# Bridges for the three limits

## Limit 1: 120 of 125 skills assume a terminal

- B1.1 MCP prompts as the chat front door. Claude Desktop surfaces MCP prompts as user-triggered slash commands (S: dev.to aws-heroes MCP prompts article; S: blckalpaca client table lists prompts for Claude Desktop). The server already registers prompts (lib/mcp/prompts.cjs:95-222). A skill becomes a prompt whose text tells the model to call room tools, not bash. Caveat: the Desktop Code app does not surface MCP prompts as slash commands (S: anthropics/claude-code#75234, Jul 2026), but the Code tab has plugin skills anyway.
- B1.2 Recipes, not shell. Phase 404 (methodology commands as thin Theo recipes, shim step tool) is the structural bridge: a recipe step runs inside the local server through the device bridge, so the same command works in the terminal and in chat. 405 should depend on, or pull forward, the 404 recipe runner for the top commands.
- B1.3 Allowlisted local runner (fallback): one governed tool that runs a named plugin script (never free shell) on the user's computer through the bridge. Highest reach, highest risk; needs the 405 bridge threat model and an attested human gate for spawn-class scripts.

## Limit 2: Part 8 is text-only in chat

- B2.1 One door. In chat, Theo is reached only through a local server (the guarded mindrian-brain shim as a config server or inside the .mcpb), never a claude.ai Theo connector. The guard code then runs in-process (lib/core/part8-egress-guard.cjs).
- B2.2 Signed egress (Theo-side check). The local guard signs each approved payload (HMAC over the shape packet, key held on the user's machine and registered with Theo at install). Theo accepts room-adjacent calls only with a valid signature; an unsigned connector call gets generic methodology only. Needs a Theo change and an owner ruling (Part 8 shape-packet ruling 2026-11-08).
- B2.3 Shape packets only. Theo's room-adjacent tools accept closed-vocabulary enums (problem type, stage, role, domain tag), not free text, so there is nothing to leak by design. brain_ask already takes a closed `shape` that the server rebuilds from the bound room; extend that rule to every Theo tool reachable from chat.

## Limit 3: the phone line rests on one Windows test

- B3.1 Ship the probe inside the product. A read-only "surface fingerprint" (status_read or a doctor leg) records place, clientInfo name and version, protocol version, declared capabilities (elicitation, apps), parent process, platform, instructions forwarding; no room content. Every tester's install answers the spike questions. Known value to check against: Claude Desktop local stdio sends clientInfo "claude-ai" 0.1.0 and declares no elicitation (S: withcoral/coral#2734 survey).
- B3.2 Human-attested approvals without elicitation. Desktop chat renders MCP Apps (P: 369 UI work; S: blckalpaca, mcpjam). The repo already has a human-only route: answer-route.cjs mints browser_nonce (HMAC of a render nonce the model never sees). A gate card rendered as an MCP App with that nonce is a real human click; this answers DC-B1 without elicitation, which Desktop stdio does not declare (S: coral survey; S: anthropics/claude-ai-mcp#153).
- B3.3 One-click install that also widens the test fleet: a .mcpb desktop extension bundles node_modules, uses the Node that ships with Claude Desktop on macOS and Windows, gives a settings UI through user_config (S: modelcontextprotocol/mcpb README; S: braindetox mcpb article). Removes the hand config edit and the 11-26 s self-install, and lets testers install in one click.
- B3.4 CI harness: run the stdio server under an emulated host (MCPJam inspector, S: mcpjam.com) on Windows and macOS runners in CI. Proves the server side, not Desktop itself.
