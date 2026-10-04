# Phase 289 - the CLI card ruling, as landed

Ruling: "Normal card on CLI" (navigator, 2026-10-02) landed in code as one shared capability function, lib/mcp/gate-render.cjs detectGateCapabilities, which all five gate surfaces (gate, research, chain, sensors, stop-gate) delegate to: every Claude host surface (cli, desktop, cowork) renders the AskUserQuestion card (rung b) on both protocol eras even when the client declares elicitation; pinned by tests/test-289-cli-card-dual-era.cjs.

In plain words: a gate is a card the human clicks, on every Claude host, whichever protocol era the connection negotiated. It is never also a pop-up dialog for the same decision. Before this ruling a client that declared elicitation got the dialog (CLI included), and on the HTTP daemon a 2026 client that declared it got no gate at all, because the server tried a dialog the 2026 protocol cannot carry.

## Both eras, measured

Run of `node tests/test-289-cli-card-dual-era.cjs` on 2026-10-04 at commit 3b6a02c82 (PASS=6 FAIL=0, exit 0). Every client declares `elicitation: {}`.

| Leg | Negotiated version | Elicitation requests seen | Renderer |
|-----|--------------------|---------------------------|----------|
| stdio, era 2025, CLAUDE_SURFACE=cli | 2025-11-25 | 0 | askuserquestion |
| stdio, era 2025, default hermetic env (desktop) | 2025-11-25 | 0 | askuserquestion |
| stdio, era 2026 (auto-negotiating client) | 2026-07-28 | 0 | askuserquestion |
| HTTP daemon (cowork), 2026 client | 2026-07-28 | 0 | askuserquestion |
| HTTP daemon (cowork), legacy-mode client | 2025-11-25 | 0 | askuserquestion |
| process hygiene | n/a | n/a | no leaked server process |

Measured before the change (289-01 RED run): the same legs saw 1 elicitation request on every era-2025 leg, and the HTTP 2026 leg returned `render_failed`.

## Where elicitation survives (D-02)

A recognized non-Claude host (clientInfo such as Visual Studio Code or Cursor) that declares elicitation keeps rung (a): exactly one dialog, with `requestedSchema.default` set to the recommended option id and an instruction title. An unknown client on the same surface gets the card. Proof: tests/test-289-elicit-default.cjs, live arm (PASS=13 FAIL=0, including "some-new-client declaring elicitation gets the card and no dialog"). clientInfo is unauthenticated (T-234-08, accepted): it picks the presentation only, the human still answers and gate_answer validates the answer against the minted card.

## The contract path Phase 369 reads

`rendered.contract.recommended` in the gate_render body `{ ok, gate_id, renderer, rendered }`. It is set for single-select cards only; a multi-select basket keeps it null and flags only rows that carry an explicit `recommended: true`. The research planner's own flag now reaches its grant, deep_plan and filing cards (research.cjs `grantOptions`, exported on `_internal`), so a research grant card's recommended id is the planner's recommended option.

Canon tension, stated plainly: rung (b) uses the F.8 envelope (`contract.shape: 'F.8'`) even for single-select ranked slates. Canon Appendix D entry 32 forbids a single marker on an F.8 basket, so the id applies only when `multiSelect` is false, and the F.8 renderer itself still returns `recommended: null`.

## What did not change

- pickRenderer, and tests/test-198-gate-renderers.test.cjs line 35.
- lib/hmi/shape-f8-renderer.cjs and its test.
- The gate_render input schema (the 267 wire snapshot comparison still passes) and every tool description (no registerTool added; the tool-honesty fixture was not re-frozen; test-276 and check-tool-honesty --check green before and after).
- Observed Claude Code 2.1.287 stdio behaviour, which was already rung (b).

## Supersedes

The 2026-09-23 "let elicitation take over on CLI" ruling, formerly written at lib/mcp/tools/gate.cjs lines 9-14 and 304-318 (both comment blocks are rewritten to this ruling).

## Open navigator items (not done here, D-08)

- Command menus rendering as live selectors is a canon note that needs Part 6 approval; it is not decided by this phase.
- Theo's gate description still says "elicitation first" (/home/jsagi/Theo/src/mcp/operational/gate-render.ts lines 38 and 106). Handoff note is in plan 09.
- Research Assumption A5 (289-RESEARCH.md line 422) is unresolved and unruled: does a rank-derived recommendation sit outside the Canon 0.70 Brain-confidence rule for F.1 Mode A (docs/MINDRIAN-CANON.md line 189)? Copied from the 289-04 SUMMARY's open item. The code derives `recommended` from an explicit flag or a rank and claims no exemption.
