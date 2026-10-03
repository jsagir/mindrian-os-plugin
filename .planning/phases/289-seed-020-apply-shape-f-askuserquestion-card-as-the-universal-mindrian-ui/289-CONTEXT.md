# Phase 289: SEED-020 Shape F card as the universal chooser, plus the SEED-104 gate defects - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning
**Mode:** discuss skipped by config (`workflow.skip_discuss: true`); the two navigator rulings below were taken on an AskUserQuestion card after research (2026-10-03), the rest are research-settled defaults the planner must honor.

<domain>
## Phase Boundary

Four gate defects measured live (SEED-104, spike 007 `burn-probe.cjs`) and one remaining bare-text menu, inside the ruling "Normal card on CLI". The menu half of SEED-020 has largely shipped already: `/mos:help` is a live AskUserQuestion selector since 9a18fe81d (now the 3-card, 11-family selector, 28f95106b) and Phase 192 converted suggest-next, rooms and onboard (`289-RESEARCH.md` Q5). Phase 369 waves 10-14 wait on this phase and probe it with `tests/test-369-289-precondition.cjs` (369 plans 26 and 27).

In scope: the capability ladder ruling in code on both protocol eras; the ledger consume order; the recommended option id on the gate contract; the elicitation `default`; the `/mos:pipeline` chooser and the bare-text fence; the ruling artifact `289-CLI-CARD-RULING.md`; the owner-after-stranger ledger arm.

Out of scope: a canon amendment (Part 6 approval, recorded as a navigator item); any Theo edit (handoff note only); durable consumption across persistence failures (Phase 369 plan 26, deliverable 11); the web gate button (369 plan 27); Phase 288.
</domain>

<decisions>
## Locked Decisions

D-01 (navigator ruling 2026-10-03, dependency): Phase 288 is waived as a dependency. 288 has 0 plans, no directory, and SEED-018 touches only the Python RS pipeline; every 289 deliverable lands first. The ROADMAP 289 card's `Depends on` line is re-pointed at planning close (shared-file edit coordinated with the executing peer), not by any plan.

D-02 (navigator ruling 2026-10-03, elicitation): "Normal card on CLI" means every Claude host surface (CLI, Desktop, Cowork; the server cannot tell CLI from Desktop, `surface-detect.cjs:61-64`) renders the AskUserQuestion rung (b) on BOTH protocol eras, even when the client declares elicitation. A recognized non-Claude host (VS Code, Cursor, via the existing `detectHostTier`) that declares elicitation keeps rung (a), with `requestedSchema.default` set to the recommended option and the field titled as an instruction (CARD289-06 and ELICIT289). Elicitation stays reachable in production and tested; it never fires for the same decision as a card.

D-03 (research Q1): one shared `detectGateCapabilities` in `lib/mcp/gate-render.cjs`; the five identical copies (`gate.cjs:321`, `research.cjs:102`, `lib/mcp/tools/sensors.cjs:189`, `lib/mcp/tools/chain.cjs:140`, `lib/mcp/tools/stop-gate.cjs:34`) delegate to it. It returns `elicitation: declared && !claudeHost` plus `elicitation_declared`. `pickRenderer` and `test-198-gate-renderers.test.cjs:35` stay unchanged. The two 267 arms that pin rung (a) flip (`test-267-mcpv2-dual-era.cjs:227-250`, `test-267-mcpv2-gate-premise.cjs:82-84`); the premise test keeps the literal "2.1.280" in gate.cjs. The 2026-09-23 ruling comments (gate.cjs 2-15, 304-318) are rewritten. The dual-era test carries the literal string "Normal card on CLI" and has an HTTP daemon leg, because SDK 2.1.0's HTTP handler fills client capabilities from each 2026 request (`@modelcontextprotocol/server` dist/index.cjs:1405-1408, read, not yet measured live).

D-04 (research Q2, ledger): consumption happens only after EVERY check passes. `peekGate(gateId, sessionId)` is a non-consuming read with the same TTL and session contract (the exact name 369 plan 26 expects); `gate_answer` peeks, runs every refusal (session, chosen option, resume owner, bound room, DB), then consumes immediately before the first write; `chain_run`'s resume (`chain.cjs:862`) gets the same discipline in the same plan. The literal `_ledger.delete(` stays inside `consumeGate`, after the session check (369 plan 07 detects Phase 289 by reading that text; 369 plan 21 arm 3b(ii) expects a chosen-option refusal not to burn the gate). Four tests that assert the burn flip: `test-238-session-scoped-ledger:50-64` (becomes the owner-after-stranger arm), `test-238-chosen-validation:211-220`, `test-238-chain-chosen-validation:170-184`, `test-354-concurrency-surfaces:352-370` (K3). A write that throws after the consume still loses the gate; that residual belongs to 369 plan 26.

D-05 (research Q3, contract): `normalizeCard` derives `recommended` (explicit option flag first, else the lowest finite rank, else null; rank 1 is the top, pinned by test). Rungs (b) and (c) set `rendered.contract.recommended` to the option id for single-select gates and each `superset_options` row gets a `recommended` boolean; rung (c)'s body marks the recommended line; `research.cjs` passes `recommended` through to the grant and deep_plan cards. Multi-select gates keep `recommended: null` (Canon Appendix D entry 32: an F.8 basket has no single marker); the F.8 renderer and `shape-f8-renderer.test.cjs:46-47` stay untouched; the field is added in the gate layer. The `gate_render` input schema does not change (the 267 wire snapshot pins it). 369's probe finds the id BY VALUE on a live minted gate, so the JSON path must be stable and is printed by 289's own contract test.

D-06 (research Q5, menus): `/mos:pipeline` chain selection (`commands/pipeline.md:108`) becomes an F.1 card with AskUserQuestion in its allowed-tools and the `--list` text floor; the soft gaps `radar.md:104` and `deck.md:67` are converted or allow-listed with a reason; `test-192-menu-sweep-live-selectors.cjs` Assertion B is healed to the 3-card 11-family wording (RED today, exit 1 measured, not a 289 regression); a bare-text chooser fence over `commands/*.md` with an allow-list of text floors. The reach-list renderer and `shape-f1-renderer.cjs` are the reused core; no new widget. Every touched surface keeps its CIRS born-wired status and HITL shape declaration (`scripts/check-shape-declaration.cjs`).

D-07 (research Q3 and Pitfall 6): the rung (b) imperative names the real option count (today it reads "with the 0 options above" because the trailer counts `contract.verbs` while the F.8 envelope stores them under `options`); fix local to the gate code, pinned by a test.

D-08 (scope fences): no canon amendment in this phase (SEED-020's "menus are live selectors, never bare text" note is recorded as a navigator item for Part 6); Theo's gate description (`/home/jsagi/Theo/src/mcp/operational/gate-render.ts:38, 106`, "elicitation first") gets a handoff note only, no Theo edit; the closing plan updates `SEED-020-shape-f-is-the-universal-mindrian-ui.md` status to the shipped scope (help 9a18fe81d and 28f95106b, Phase 192, Phase 289); the other SEED-020 file is merged into SEED-031 and is not this phase's.

D-09 (shared tree): a peer session executes Phase 369 on this working tree. Plans write only inside `lib/mcp/`, `lib/hmi/`, `commands/`, `tests/`, `scripts/` files they name, and `.planning/phases/289-*/`; `git commit --only` with named paths; `git add -f` for new `.planning/` files; no `git stash`, `reset`, `add -A`; no STATE.md or ROADMAP.md write from any plan (the orchestrator owns both, coordinated with the peer). Gate edits that add a `registerTool` or change a tool description move the tool-honesty frozen sweep (`tests/fixtures/tool-honesty/276-dispositions.json`, 42 tools and 136 branches today, measured); the plan that does so re-freezes it the 358-05 way and runs `tests/test-276-tool-honesty-findings-closed.cjs` plus `scripts/check-tool-honesty.cjs --check`.
</decisions>

<claude_discretion>
## Claude's Discretion

Plan order and wave shape; the exact JSON path for `contract.recommended` as long as the contract test prints it; the fence's allow-list format; the wording of `289-CLI-CARD-RULING.md` beyond its required `Ruling:` line and test name; whether the five delegations land in one plan or two.
</claude_discretion>

<canonical_refs>
## Canonical References

- `.planning/phases/289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui/289-RESEARCH.md` (2026-10-03, 547 lines; research questions Q1-Q5, Patterns, Pitfalls, Validation Architecture, requirement families CARD289, LEDGER289, CONTRACT289, ELICIT289, MENU289)
- `.planning/seeds/SEED-020-shape-f-is-the-universal-mindrian-ui.md`; `.planning/seeds/SEED-104-research-grant-family-loop-eureka-plan-unfetchable.md`
- `.planning/spikes/007-agent-native-wraps-mcp/` (README, results.json, `burn-probe.cjs`)
- `.planning/phases/267-*/267-TRIPOLAR-PROBES.md` lines 69-87 (CLI rung diagnosis: Claude Code 2.1.287 opens with `server/discover`, no initialize-time capabilities)
- Downstream contract: `.planning/phases/369-*/369-26-PLAN.md` and `369-27-PLAN.md` (three-part probe: recommended id by value, owner-after-stranger, the ruling artifact or a passing `tests/test-289-*.cjs` containing "Normal card on CLI"), `369-07-PLAN.md` arm 4, `369-21-PLAN.md` arm 3b
- Code: `lib/mcp/tools/gate.cjs`, `lib/mcp/gate-ledger.cjs`, `lib/mcp/gate-render.cjs`, `lib/mcp/tools/research.cjs`, `lib/mcp/tools/chain.cjs`, `lib/mcp/tools/sensors.cjs`, `lib/mcp/tools/stop-gate.cjs`, `lib/mcp/surface-detect.cjs`, `lib/hmi/shape-f1-renderer.cjs`, `lib/hmi/shape-f8-renderer.cjs`
- Canon: docs/MINDRIAN-CANON.md Part 3 (Shape F gate), Part 11 (CIRS born-wired, HITL shape), Appendix D entry 32 (F.8 basket has no single marker); docs/HITL-SHAPE-DECLARATION-CONTRACT.md
</canonical_refs>

<deferred>
## Deferred Ideas

Canon note that menus render as live selectors (Part 6 approval); Theo-side ladder description update (handoff); durable consumption across persistence failures (369 plan 26); the web gate button (369 plan 27); Phase 288 (RS-Engine, unrelated); retiring elicitation entirely (navigator chose to keep it for non-Claude hosts).
</deferred>
