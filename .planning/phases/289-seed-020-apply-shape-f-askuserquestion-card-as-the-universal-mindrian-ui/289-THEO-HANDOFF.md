# Phase 289 - Theo handoff: mirror the gate ladder description

Date: 2026-10-04
From: /home/jsagi/dev/MindrianOS-Plugin (Phase 289, plan 09)
Ruling commit: 9b222f551 (`289-CLI-CARD-RULING.md`)
To: Theo owner (the navigator delivers this note; no Theo file was edited from the plugin)

## The request

Mirror the plugin's gate ladder description into `/home/jsagi/Theo/src/mcp/operational/gate-render.ts`, lines 38 and 106 (the 2026-09-07 description-mirror todo). Today both places describe the ladder as "MCP elicitation first, the Claude Code AskUserQuestion thin adapter second, headless structured text last". After Phase 289 that order is no longer what the plugin does on a Claude host.

## What changed in the plugin's gate contract

1. The capability ladder is card-first on every Claude host (cli, desktop, cowork) on both protocol eras, even when the client declares elicitation. One shared function decides it: `detectGateCapabilities` in `lib/mcp/gate-render.cjs`; the five tool-module copies (gate, research, chain, sensors, stop-gate) are one-line delegates. Pinned live by `tests/test-289-cli-card-dual-era.cjs` (stdio 2025 and 2026, HTTP daemon 2026 and legacy; zero elicitation requests, renderer askuserquestion).
2. Elicitation is kept only for recognized non-Claude hosts (for example Visual Studio Code, Cursor) that declare it. There the dialog opens on the recommended option (`requestedSchema.default`) under an instruction title ("Choose: ..."). An unknown client gets the card.
3. `rendered.contract.recommended` carries the recommended option id for single-select gates; it is null for multi-select baskets, which flag only rows that carry an explicit `recommended: true`.
4. A refused `gate_answer` no longer consumes the gate. The ledger checks the session before its one delete, and `gate_answer` and the chain resume peek, refuse, then consume. A stranger's refused answer leaves the owner's gate answerable.

Suggested wording for the two Theo spots: "the capability-detected renderer ladder: on a Claude host the AskUserQuestion card first; MCP elicitation only for a recognized non-Claude host that declares it; headless structured text last". Keep the rest of each line as it is.

## Not covered here

Phase 369 plan 26 will send a separate note for the gate_answer recovery states (a write that throws after the consume still loses the gate; that residual belongs to 369-26). This note covers only what Phase 289 changed.

## Reference

Full ruling, both-era measurements and open items: `289-CLI-CARD-RULING.md` in this directory.
