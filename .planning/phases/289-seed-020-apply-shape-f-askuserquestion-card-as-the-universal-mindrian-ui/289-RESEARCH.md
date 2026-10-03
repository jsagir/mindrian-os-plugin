# Phase 289: SEED-020 Shape F card as the universal Mindrian chooser, plus the folded SEED-104 gate defects - Research

**Researched:** 2026-10-02
**Domain:** MCP gate renderer ladder, the in-memory gate ledger, the Shape F gate contract, command-menu selectors (plugin code only)
**Confidence:** HIGH for the gate defects (every claim read from code at HEAD d90ffbfa3 or measured); MEDIUM for the menu sweep scope (most of it already shipped, see Q5)

## Summary

Phase 289 has two halves, and they are very unequal in remaining work. The SEED-020 menu half is mostly already done: `/mos:help` has been a live AskUserQuestion selector since commit 9a18fe81d (2026-06-06) and is now the 3-card, 11-family selector from quick 260705-jeq (commit 28f95106b), with `--list` delegating to `scripts/help-renderer.cjs` as the text floor (commands/help.md:31-110). Phase 192 then swept `/mos:mos`, `/mos:suggest-next`, `/mos:rooms` and `/mos:onboard` (tests/test-192-menu-sweep-live-selectors.cjs:22-58). What is left is small: one real gap (`/mos:pipeline` chain selection is a bare prose choice with no AskUserQuestion in its allowed-tools, commands/pipeline.md:108), two soft gaps (radar.md:104, deck.md:67), a stale regression fence that is RED today (test-192 Assertion B still expects the retired "two-axis" wording; measured exit 1), and a fence so this does not drift again.

The gate half is where the risk and the downstream dependency live. Four defects, all confirmed in code: (a) the capability ladder still prefers elicitation whenever the client declares it, in FIVE independent copies of `detectClientCapabilities` (gate.cjs:321, research.cjs:102, sensors.cjs:189, chain.cjs:140, stop-gate.cjs:34); (b) `buildElicitRequestedSchema` emits no `default` and titles the field with the gate header (gate-render.cjs:270-297); (c) `consumeGate` deletes before the session check (gate-ledger.cjs:100), and `gate_answer` runs four more refusal checks after consumption (gate.cjs:452-521), so ANY refused answer burns the owner's gate, not only a cross-session one; (d) both the AskUserQuestion rung and the text rung return `recommended: null` (F.8 envelope at shape-f8-renderer.cjs:129, text rung at gate-render.cjs:467; measured). A fifth defect surfaced while measuring: the rung (b) AskUserQuestion imperative tells the model to fire the card "with the 0 options above" because the dispatcher trailer counts `contract.verbs` and the F.8 envelope carries `options` (measured; selector-dispatcher.cjs:556, 576).

One finding makes ruling (a) more than paperwork: SDK 2.1.0's HTTP handler backfills client capabilities from the 2026-07-28 per-request envelope (`@modelcontextprotocol/server` dist/index.cjs:1405-1408, `seedClientIdentityFromEnvelope`), so on the flag-ON HTTP daemon a 2026-era client that declares elicitation WILL report `elicitation: true` to today's ladder. Only stdio 2026 connections see no capabilities. The "it does not change observed CLI behaviour" statement in the ROADMAP card holds for Claude Code 2.1.287 over stdio, but the latent HTTP path is real.

**Primary recommendation:** Put the ruling in ONE shared capability function in `lib/mcp/gate-render.cjs` (a non-tools module every ladder caller already requires or can require), make the five copies delegate to it, keep `pickRenderer` and its test untouched, and land the ledger fix as `peekGate` plus consume-after-every-check in BOTH `gate_answer` and `chain_run`'s resume, in the same plan, because Phase 369's detectors treat them as one fix.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rung selection (card vs elicitation vs text) | API / Backend (MCP server, `lib/mcp/gate-render.cjs`) | - | The server is the only party that knows surface + declared capabilities + client identity; the host only renders what it is handed |
| Gate single-use and session ownership | API / Backend (`lib/mcp/gate-ledger.cjs`) | - | In-memory, process-scoped ledger by contract (gate.cjs:22-25); never the browser or the model |
| Ratification writes | Database / Storage via `lib/core/navigation.cjs` | API / Backend | Part 9 chokepoint; gate.cjs never opens the graph directly (gate.cjs:17-20) |
| Recommended option id on the contract | API / Backend (gate-render normalizer) | Browser / Client (369 web button reads it) | One contract, many renders (369-27 truth list); the F.8 renderer stays recommendation-free |
| Elicitation dialog default and title | API / Backend (requestedSchema builder) | Host (renders the dialog) | The schema is server-authored; the host only displays it |
| `/mos:help` and command menus | Host (Claude Code AskUserQuestion, model-composed from command prose) | CLI scripts (`scripts/help-renderer.cjs` text floor) | Shape F is the host-native primitive (Canon Part 3); the plugin owns data and prose, never the keymap |

## User Constraints

No `289-CONTEXT.md` exists (the phase directory was empty at research time; discuss is skipped, `.planning/config.json` `workflow.skip_discuss: true`). The binding constraints are the ROADMAP card (.planning/ROADMAP.md:2206-2214) and the orchestrator brief. Copied verbatim where they are rulings:

### Locked Decisions (from the ROADMAP card and navigator rulings)
- Goal: "Shape F (the AskUserQuestion card) is the universal Mindrian chooser ... `/mos:help` and every user-facing menu render as a live card selector (lane, command, run), never bare text; the `--list` text fallback is the floor on non-interactive surfaces; Phase 143.1's reach-list renderer and `shape-f1-renderer.cjs` are the reused core, not a new widget."
- (a) "the navigator RULED 2026-10-02 'Normal card on CLI': a gate is the AskUserQuestion rung and never also an MCP elicitation for the same decision; this reverses the 2026-09-23 'let elicitation take over on CLI' ruling ... the fix puts the ruling in code and tests both protocol eras, it does not change observed CLI behaviour today"
- (b) "wherever elicitation survives, `default` is the recommended option and the field is titled as an instruction"
- (c) "check the session first, delete only on a valid consume, add the owner-after-stranger test"
- (d) "carry the recommended option id into the contract"
- (e) `.planning/phases/289-*/289-CLI-CARD-RULING.md` with a `Ruling:` line naming the test that pins both protocol eras (or a passing `tests/test-289-*.cjs` containing "Normal card on CLI")
- (f) the owner-after-stranger arm in `tests/test-238-session-scoped-ledger.cjs`
- Phase 369 boundary (369-26 objective, line 59-61): 289 owns consume-after-checks; 369 owns durable consumption after commit, replay, room_switched, stale_subject, persistence_failed.

### Claude's Discretion
- Where the ruling lives in code, the contract field name and path, the elicitation title wording, the menu-sweep scope beyond the named gaps.

### Deferred Ideas (OUT OF SCOPE)
- Durable consumption, replay by gate id, the expired-id set, `withRoomTx` wrapping (369-26).
- The web gate button (369-27). Any Theo-side code (handoff note only).

<phase_requirements>
## Phase Requirements

No requirement IDs exist yet (ROADMAP: "Requirements: TBD"). Mint from these families; the suggested IDs below map one-to-one to findings in this file.

| ID (suggested) | Description | Research Support |
|----|-------------|------------------|
| CARD289-01 | One shared capability function: on a Claude host surface the gate renders rung (b) on both protocol eras, even when elicitation is declared or envelope-seeded | Q1, Pattern 1 |
| CARD289-02 | Live dual-era test `tests/test-289-cli-card-dual-era.cjs` containing "Normal card on CLI" (stdio 2025 + stdio 2026 + HTTP daemon leg) | Q1, Validation |
| CARD289-03 | `289-CLI-CARD-RULING.md` with a `Ruling:` line naming CARD289-02's test | deliverable (e) |
| CARD289-04 | Rewrite the 2026-09-23 ruling comments (gate.cjs:2-15, 304-318) and flip the two 267 arms that pin rung (a) | Q1 |
| CARD289-05 | Rung (b) imperative names the real option count (fix the "0 options above" trailer) | Q3, Pitfall 6 |
| LEDGER289-01 | `consumeGate` checks the session before its one `_ledger.delete(` | Q2 |
| LEDGER289-02 | `peekGate(gateId, sessionId)` non-consuming read, same TTL and session contract | Q2 |
| LEDGER289-03 | `gate_answer`: peek, run every refusal check, consume only immediately before the first write | Q2 |
| LEDGER289-04 | `chain_run` resume (`_resumeFromGateAnswer`): same discipline for the chosen check | Q2 |
| LEDGER289-05 | Owner-after-stranger arm in test-238-session-scoped-ledger; flip the four tests that pin the burn | Q2 |
| CONTRACT289-01 | `normalizeCard` derives `recommended`: explicit option flag, else lowest finite rank, else null | Q3 |
| CONTRACT289-02 | Rung (b) single-select: `rendered.contract.recommended` = option id; `superset_options[].recommended` boolean | Q3 |
| CONTRACT289-03 | Rung (c): same `contract.recommended` id; the body marks the recommended line | Q3 |
| CONTRACT289-04 | research.cjs passes `recommended` through to the gate card (grant and deep_plan cards) | Q3 |
| ELICIT289-01 | requestedSchema `default` = recommended id (single) or `[ids]` (multi); field title is an instruction; validated against SDK 2.1.0 Titled schemas | Q4 |
| ELICIT289-02 | Elicitation survives only where the ruling allows; a test proves where | Q4 |
| MENU289-01 | Convert `/mos:pipeline` chain selection to the F.1 card; soft gaps radar.md:104 and deck.md:67 | Q5 |
| MENU289-02 | Heal the RED test-192 Assertion B (3-card 11-family wording) | Q5 |
| MENU289-03 | Bare-text chooser fence over commands/*.md (allow-listed text floors) | Q5 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- All dev work runs through GSD (CLAUDE.md "GSD Workflow Enforcement"); this file is research only.
- Hyphens only, never an em-dash or en-dash (CLAUDE.md "Writing and Structure"); `research.cjs` already strips them with `noDash` (research.cjs:86).
- Hooks and the MCP server stay `.cjs` (CLAUDE.md "Code"); every file this phase touches under `lib/mcp/` stays CJS. No TypeScript in this phase is needed.
- No packages enter the root `package.json` (CLAUDE.md "Code"; peer 369 is editing package.json, npm-shrinkwrap.json and package-lock.json right now). This phase needs zero new packages.
- `lib/core/navigation.cjs` is the single write chokepoint; gate.cjs keeps routing every ratification write through it (gate.cjs:17-20).
- Canon Part 8: no room content leaves the machine; nothing in this phase opens a network path (gate-render.cjs:39, gate-ledger.cjs:21-22).
- Canon Part 11 CIRS: every surface born WIRED or EXCLUDED with a declared HITL shape; `scripts/check-shape-declaration.cjs` is ADVISORY (measured: 53 WARN lines, exit 0). `gate_render` and `gate_answer` already declare `hitl_shape: 'F.1'` (gate.cjs:736-755).
- Canon Part 3 frozen scalars (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15) must not move; F.8 carries no single RECOMMENDED marker (docs/MINDRIAN-CANON.md:852, Appendix D entry 32).
- `.planning/` is gitignored; new phase files need `git add -f` (`git check-ignore -v` on this file: `.gitignore:97:.planning/*`). Commit with `--only` (two-session collision rule).
- Do not edit `lib/mcp/runtime-instructions.cjs` (its BOUNDARIES paragraph and byte budgets are frozen by `lib/mcp/no-instructions.test.cjs`; 369-22-PLAN.md:83 cites line 102). The gate line "gate_render them; honor gate_answer" (runtime-instructions.cjs:33) needs no change.
- Do not edit `skills/ui-system/SKILL.md`, `CLAUDE.md`, `CHANGELOG.md`, `scripts/release.sh` while Phase 369 wave 0 holds them (orchestrator brief).

## Research Questions

### Q1. The capability ladder on each protocol era, and how "Normal card on CLI" lands - RESOLVED

**Today's code.** `detectClientCapabilities` (gate.cjs:321-334) reads `server.server.getClientCapabilities()`; `elicitation = !!caps.elicitation`; `claudeCode = !elicitation && surface in ['cli','desktop','cowork']`. `pickRenderer` (gate-render.cjs:106-111) orders elicitation > askuserquestion > text. So a declared elicitation always wins. The ruling comment encoding the reversed decision sits at gate.cjs:9-15 and 304-318. [VERIFIED: code read]

**Five copies, not one.** The same function is duplicated by the "tools never require each other" seam in gate.cjs:321, research.cjs:102, sensors.cjs:189, chain.cjs:140 and stop-gate.cjs:34 (all byte-identical bodies; grep). A fix in gate.cjs alone would leave `suggest_next`, `chain_run` halts, `research_run` grant cards and the stop gate eliciting. The SEED-104 grant dialog came from research.cjs, not gate.cjs (research.cjs:203-207). [VERIFIED: grep]

**What each era sees.**

| Connection | What the server sees | Today's rung | Source |
|---|---|---|---|
| Claude Code 2.1.281 stdio, 2025-11-25 `initialize` | `elicitation: {}` declared | (a) elicitation | 267-TRIPOLAR-PROBES.md:21-37 |
| Claude Code 2.1.287 stdio, `server/discover`, no `initialize` | no capabilities | (b) card | 267-TRIPOLAR-PROBES.md:47-87 |
| Claude Desktop (Windows via wsl.exe), `initialize` | no `elicitation` key | (b) card | 267-TRIPOLAR-PROBES.md:133-155 |
| Flag-ON HTTP daemon (surface `cowork`), 2026-07-28 client declaring elicitation | capabilities seeded from the per-request envelope | (a) elicitation, NOT measured live | SDK `@modelcontextprotocol/server` 2.1.0 dist/index.cjs:1311 (`createMcpHandler`), 1405-1408 |
| Stdio 2026-07-28 client declaring elicitation | no capabilities (serveStdio does not seed) | (b) | tests/test-267-mcpv2-dual-era.cjs:252-275 |

The SDK's own docs say the deprecated accessors are "backfilled per request from the validated envelope" on 2026-07-28 instances (dist/createMcpHandler-Bt6U_Fqb.d.mts:3058-3077). [VERIFIED: SDK source in node_modules] The HTTP row is therefore a code-read inference, not a measurement; the CARD289-02 HTTP leg measures it.

**Surface cannot tell CLI from Desktop.** `.mcp.json` launches `node bin/mindrian-mcp-server.cjs` with no `CLAUDE_SURFACE`; a host-spawned stdio child has a non-TTY stdin and argv length 2, so `detectSurface` returns `desktop` (surface-detect.cjs:61-64) even under Claude Code. The test helper sets `MINDRIAN_TRANSPORT=stdio`, which also yields `desktop` (surface-detect.cjs:40-42; tests/helpers/mcp-wire-267.cjs:78). And `detectSurface` always returns one of the three Claude surfaces (surface-detect.cjs:35-72), so in production `ctx.surface` is never null and rung (c) is reachable only in unit tests. [VERIFIED: code read] Consequence: a CLI-only rule keyed on `ctx.surface === 'cli'` would not fire under Claude Code at all. The ruling has to be "Claude host surface means card".

**Recommended change (CARD289-01).** Add one exported function to `lib/mcp/gate-render.cjs`, for example `detectGateCapabilities(server, ctx)`, and make each of the five copies a one-line delegate (keep each module's `_internal.detectClientCapabilities` export so existing tests resolve). gate.cjs, research.cjs, chain.cjs and sensors.cjs already require `../gate-render.cjs`; stop-gate.cjs can require it too (gate-render.cjs is not a `tools/*.cjs` module, so the disjoint-file seam holds, the same argument gate.cjs:280-283 makes for gate-ledger.cjs). Return shape:

```js
// lib/mcp/gate-render.cjs - "Normal card on CLI" (navigator ruling 2026-10-02).
// Claude Code declared elicitation from 2.1.280 (live tee 2026-09-23); the ruling
// keeps the AskUserQuestion card on every Claude host surface anyway.
const CLAUDE_HOST_SURFACES = ['cli', 'desktop', 'cowork'];
function detectGateCapabilities(server, ctx) {
  let declared = false;
  try {
    const caps = (server && server.server && typeof server.server.getClientCapabilities === 'function')
      ? server.server.getClientCapabilities() : null;
    declared = !!(caps && caps.elicitation);
  } catch (_e) { declared = false; }
  const surface = (ctx && typeof ctx.surface === 'string') ? ctx.surface : null;
  const claudeHost = surface !== null && CLAUDE_HOST_SURFACES.indexOf(surface) !== -1;
  return {
    elicitation: declared && !claudeHost,   // usable rung (a)
    elicitation_declared: declared,         // the honest capability read
    claudeCode: claudeHost,                 // rung (b)
  };
}
```

Because `elicitation` is now false on a Claude host, `pickRenderer` needs no change and every caller's existing `if (capabilities.elicitation && ...elicitInput)` guard (gate.cjs:370, research.cjs:205, chain.cjs:934, sensors.cjs:428, stop-gate.cjs:71) stops attaching `elicitInput` on its own. tests/test-198-gate-renderers.test.cjs:35 ("elicitation outranks claudeCode") stays green because `pickRenderer` is untouched.

**Optional refinement, recommended (CARD289-06 if the planner takes it).** With the code above, elicitation never fires in production (every process has a Claude surface). If the navigator wants third-party hosts that genuinely support elicitation (VS Code, Cursor) to keep rung (a), add one clause: `claudeHost = claudeSurface && !knownNonClaudeHost(getClientVersion())`, using the existing `detectHostTier` (surface-detect.cjs) where a recognized non-Claude tier0 host (vscode, cursor, goose, zed, ...) keeps elicitation and `unknown`, `claude-code`, `claude-desktop` get the card. On 2026 stdio there is no clientInfo, which correctly floors to the card. clientInfo is unauthenticated (surface-detect.cjs trust note T-234-08); the worst a spoofed name can do is get a dialog instead of a card, no privilege changes. This is an [ASSUMED] scope call: the ruling text names the CLI only. See Assumptions A1.

**Observed CLI behaviour today does not change.** Claude Code 2.1.287 stdio already lands on rung (b) (267-TRIPOLAR-PROBES.md:77-85). What changes: a 2.1.281-style legacy CLI, and any HTTP 2026 client that declares elicitation on a Claude surface, move from (a) to (b).

**Tests that pin today's behaviour and must flip:**

| Test | Lines | Today asserts | After 289 |
|---|---|---|---|
| tests/test-267-mcpv2-dual-era.cjs | 227-250 | era 2025 + declared elicitation -> exactly 1 elicitation request, renderer `elicitation` | 0 requests, renderer `askuserquestion`, gate_id usable (server surface is `desktop` under hermeticEnv) |
| tests/test-267-mcpv2-gate-premise.cjs | 82-84 | `detectClientCapabilities` on surface `cli` + declared -> `elicitation: true` | `elicitation: false`, `elicitation_declared: true`; the source arm (61-68) still needs the literal "elicitation" and "2.1.280" in gate.cjs, so keep that citation in the rewritten comment |
| tests/test-198-gate-renderers.test.cjs | 35 | `pickRenderer` order | unchanged (pure function untouched) |
| tests/test-209-card-fire-gate.cjs | all | offline card-fired-vs-prose judge over evals/plurai CSV | unaffected (does not require gate-render; read 1-40) |

### Q2. Ledger consume order - RESOLVED

**Where deletion precedes the checks.**
- `consumeGate` (gate-ledger.cjs:97-106): `get` -> `_ledger.delete(gateId)` at line 100 -> TTL check (101) -> session check (102-104). The comment at 83-86 states the burn is deliberate. [VERIFIED: code read]
- `gate_answer` (gate.cjs:450-521): consumes at 452, then refuses AFTER consumption on: `live.ok === false` session mismatch (456-458), `chosen_not_in_card_options` (465-476), `resume_owner_missing` (483-485), the unbound-room refusal (501-516, except kind `binding`), and `no_room_db` (518-521). The first write is `logMemoryEvent` at 526. Every one of those five refusals burns the gate today.
- `chain_run` resume (`_resumeFromGateAnswer`, chain.cjs:857-870) consumes at 862, then `_executeResumedEntry` (chain.cjs:724-740) refuses `chosen_not_in_card_options` after consumption.
- Spike 007 measured the cross-session case end to end: owner alone ratifies; after a stranger's `session_mismatch`, the owner gets `unknown_or_expired_gate` (.planning/spikes/007-agent-native-wraps-mcp/stages/02_actions/burn-probe.out.json).

**Minimal reorder (LEDGER289-01..04).**
1. `consumeGate(gateId, sessionId)`, still exactly two parameters (the "do not add a third parameter" rule, gate-ledger.cjs:78-81): `get` -> session mismatch returns the refusal WITHOUT deleting -> TTL expired: delete, return null -> the one `_ledger.delete(gateId)` -> return the entry. Put every delete after the session comparison. Phase 369-07 arm 4 plans to detect Phase 289 by reading this file "and checking whether `_ledger.delete(` occurs after the session check inside consumeGate" (369-07-PLAN.md:93); keep the literal `_ledger.delete(` inside `consumeGate`, never behind a helper.
2. Add `peekGate(gateId, sessionId)`: same return contract (null / `{ok:false, reason:'session_mismatch'}` / entry), never deletes a live entry. 369-26 already plans this exact name "if Phase 289 left no non-consuming read" (369-26-PLAN.md:107), so using it avoids a rename later. Leave `releaseGate` and the expired-id set to 369-26.
3. `gate_answer`: `peekGate` -> session refusal -> chosen check -> resume-owner check -> write-room check (the `binding` kind with no room consumes and returns ok, since that IS a valid answer) -> `openRoomDbForCaller` failure refusal -> `consumeGate` -> writes. Every step from 452 to 526 is synchronous (`resolveMcpWriteRoom` session-room.cjs:197 and `openRoomDbForCaller` spine-events.cjs:454 are plain functions; the first `await` is `live.resumeFn` at gate.cjs:711), so peek-then-consume cannot interleave with a second answer in the event loop. Assert this in a comment: adding any `await` between peek and consume reopens a double-ratify race.
4. `_resumeFromGateAnswer`: `peekGate` -> session refusal -> `validateChosenAgainstCard` refusal -> `_consumeResumeLedger` -> `_executeResumedEntry` (its own chosen check stays as a harmless second check).
5. The inline-elicitation consumes (gate.cjs:431-433, research.cjs:221-227) and `answerRelease` (canon-release.cjs:461-469) mint and consume in the same call and session; they keep `consumeGate`, which now simply cannot burn on a mismatch.

**What "durable" means, and what 289 does not own.** After 289, consumption happens after every check but BEFORE the writes. A thrown `logMemoryEvent` (gate.cjs:526, not inside an inner try) still loses the gate. That is the persistence-failure case 369-26 owns ("durable consumption only after the ratification commits ... a persistence failure must leave the decision open", 369-26-PLAN.md:59-61, 108). State this residual in the 289 SUMMARY so nobody reads 289 as "refusals and failures never burn".

**Tests that assert the current (wrong) order and must flip:**

| Test | Lines | Today | After 289 |
|---|---|---|---|
| tests/test-238-session-scoped-ledger.cjs | 50-64 (Case 3 + the "no longer carries case1" check) | owner's follow-up after a mismatch is null | owner-after-stranger: owner's follow-up returns the entry; THEN the ledger no longer carries it; name the arm "owner-after-stranger" (369-26's probe greps that string, 369-26-PLAN.md:84) |
| tests/test-238-chosen-validation.cjs | 211-220 (case 5) | correct answer after a chosen refusal -> `unknown_or_expired_gate` | it ratifies; add a replay-after-success arm proving single-use still holds |
| tests/test-238-chain-chosen-validation.cjs | 170-184 (Case 5) | correct resume after a refusal -> `unknown_or_expired_gate` | it executes; add replay-after-success -> `unknown_or_expired_gate` |
| tests/test-354-concurrency-surfaces.cjs | 352-370 (K3) | S1's approve after S2's refusal is refused as consumed | S1's approve ratifies and the claim promotes (K3's fresh-card arm shows the floor is met in this fixture); a third approve is refused as consumed |

Suites that run them: run-all-238.sh (all three 238 files), run-all-354.sh, run-all-365.sh and run-all-267.sh (354 and chosen-validation). [VERIFIED: grep of tests/run-all-*.sh]

### Q3. The contract and the recommended id - RESOLVED

**Where the nulls come from.**
- Rung (b) builds its contract from `renderShapeF8` (gate-render.cjs:389-392), which sets `recommended: null` (shape-f8-renderer.cjs:129) and `preChecked: []` because the gate passes `confidence: null` for every option (gate-render.cjs:390; shape-f8-renderer.cjs:96-102). The gate already overrides one F.8 field afterwards (`multiSelect`, gate-render.cjs:396).
- Rung (c) hard-codes `recommended: null` (gate-render.cjs:467).
- Neither the superset schema (gate-render.cjs:66-100), `_normalizeOption` (120-132) nor the `gate_render` zod option schema (gate.cjs:336-342) has a recommendation field. Only `rank` exists.
- The `card.options[].recommended` the spike saw is the research planner's own card (`cardView`, research.cjs:149-158); `mintApprovalGate` callers flatten it to `description: 'Recommended'` before the gate sees it (research.cjs:235, 476). [VERIFIED: code read]

Measured (node, read-only, HEAD d90ffbfa3) with two options ranked 2 and 1: rung (b) `contract.recommended: null`, `contract.preChecked: []`, `superset_options` in input order; rung (c) `{"recommended":null,...}`; elicitation schema has no `default`.

**Smallest change (CONTRACT289-01..04).**
1. `normalizeCard` derives a card-level `recommended` (an option id or null): an option with `recommended === true` wins (first one if several); else the option with the lowest finite `rank` (ties: input order); else null. `_normalizeOption` carries `recommended: true` when set. Rank direction (1 = top) is [ASSUMED] (A2); test-198's fixture ranks opt-a 1 and opt-b 2 (test-198:47-48) and 369-27 orders options "by rank" (369-27-PLAN.md:101); pin it in a test because 369-26's probe asserts "it is the top-ranked option" (369-26-PLAN.md:83).
2. Rung (b): after `renderShapeF8`, for a single-select card set `base.contract.recommended = card.recommended` (an option ID, not a label) and add `recommended: true|false` to each `superset_options` row. For a multi-select card leave `contract.recommended: null` (Canon Appendix D entry 32: an F.8 basket carries no single marker) and express defaults only through `superset_options[].recommended` and the elicitation `default` array.
3. Rung (c): same `contract.recommended` rule; append " (recommended)" to that option's body line.
4. research.cjs: pass `recommended: o.recommended === true` alongside the existing description in `grantOptions` (research.cjs:231-238) and the deep_plan options (476). These go straight into `renderGate` without zod, so no schema change is needed.

**JSON path a client reads:** `rendered.contract.recommended` (a string equal to one `rendered.contract.superset_options[].id`, or null), in the `gate_render` tool response body `{ ok, gate_id, renderer, rendered }` (gate.cjs:420-425). Use the existing key rather than a new `recommended_id`: it already sits on both rung contracts, F.1 uses the same key for its single recommendation (shape-f1-renderer.cjs:199), and a second key would leave a misleading `recommended: null` beside it. 369's research suggested `contract.recommended_id` (369-RESEARCH.md Pattern 8); 369-27 deliberately reads the path from 369-26's probe output, never a name (369-27-PLAN.md:27, 83), so either name works downstream. Recommending `recommended`.

**The F.8 test is not stale; reconcile by layering.** shape-f8-renderer.test.cjs:46-47 tests `renderShapeF8` directly and encodes Canon Appendix D entry 32 (docs/MINDRIAN-CANON.md:852: "F.8 carries NO single RECOMMENDED marker"). Leave the F.8 renderer and its test byte-unchanged and add the id in the gate layer, exactly as the gate already overrides `multiSelect`. 369-27 says the same: the field "lands at the gate-render layer, not in the F.8 renderer" (369-27-PLAN.md:83).

**Do not change the `gate_render` input schema.** Adding `recommended` to `gateOptionSchema` changes the published inputSchema, which tests/fixtures/267/wire-snapshot-zod4.json pins (the dual-era test compares against it, test-267-mcpv2-dual-era.cjs:153-186; the accepted-deltas file reads only four named keys, 55-59). Rank already reaches the server through the existing schema.

**Canon tension to state in the ruling file.** Rung (b) uses the F.8 envelope (`contract.shape: 'F.8'`, pinned by test-198:82) even for single-select gates, which are really ranked 1-of-N slates. Putting a recommended id on an F.8-shaped single-select contract is consistent with entry 32 only if the ruling file says so plainly: the id applies when `multiSelect` is false. See A3.

### Q4. Elicitation `requestedSchema` default - RESOLVED

The schema is built in `buildElicitRequestedSchema` (gate-render.cjs:270-297): single-select `properties.choice = { type:'string', title: card.header || 'Choose an option', oneOf:[{const,title}] }`; multi-select `properties.choices = { type:'array', title, items:{ anyOf:[...] } }`. No `default`. [VERIFIED: code read; measured]

SDK 2.1.0 accepts the fix: `TitledSingleSelectEnumSchemaSchema` has `title?`, `description?`, `oneOf`, `default?: string`; `TitledMultiSelectEnumSchemaSchema` has `default?: string[]` (node_modules/@modelcontextprotocol/core/dist/auth-4-zilcqg.cjs, the schema block beginning at `UntitledSingleSelectEnumSchemaSchema`). [VERIFIED: SDK source]

Change (ELICIT289-01): set `default: card.recommended` when non-null (single), `default: [ids flagged recommended]` when any (multi); set `title` to an instruction built from the labels, for example `'Choose: ' + labels.join(' / ')` capped (SEED-104's own wording: "Choose: approve standing / this run / not now"); move the header into the field `description` (the message already carries it, gate-render.cjs:314-318). tests/test-265-gate-render-elicit-schema.cjs only deep-equals `oneOf`, `anyOf` and `required` (lines 58, 65, 90, 96) and SDK-validates the property, so it stays green; extend its SDK arm to a defaulted schema.

**Where elicitation survives after ruling (a):** with the plain ruling, nowhere in production (every process has a Claude surface, Q1); it survives for callers with no surface (unit tests, embedded callers) and, if the CARD289-06 refinement is taken, for recognized non-Claude hosts on a 2025-era connection. Desktop never declared elicitation (267-TRIPOLAR-PROBES.md:139-144); Cowork is unprobed (248-261). The default and title fix is cheap, pure and testable either way, and protects any future rung (a) path.

### Q5. `/mos:help` and every user-facing menu - RESOLVED (most of it already shipped)

**Shipped already.**
- `/mos:help`: live AskUserQuestion selector, 11 families as 3 cards from `data/help-groups.json`, `--list`/`--all`/non-TTY/Desktop delegate to `node scripts/help-renderer.cjs` (commands/help.md:31-110; history: 9a18fe81d SEED-020 two-axis selector, 28f95106b 3-card rewrite, 415f8b704 JTBD regroup). Measured green: tests/test-help-selector-lanes.cjs (5 of 5 blocks), tests/test-help-cards-render.cjs (4 of 4, 106 non-admin commands), `scripts/check-help-coverage.cjs` ("valid: true").
- Phase 192 sweep: `/mos:mos` N/A (router), `/mos:suggest-next`, `/mos:rooms` list/where and `/mos:onboard` Step 1 converted to F.1 cards composed with `renderShapeF1` + `appendAskUserQuestionTrailer` (tests/test-192-menu-sweep-live-selectors.cjs:22-58; commands/rooms.md:29-31, onboard.md:92-105, suggest-next.md:124).
- The reuse core named by the goal exists: `buildReachList` (lib/hmi/dial-reach-orchestrator.cjs, surface-agnostic, ANSI-free, 143.1-02-SUMMARY "provides"), `renderShapeF1` (lib/hmi/shape-f1-renderer.cjs:134), `appendAskUserQuestionTrailer` (selector-dispatcher.cjs:553).

**Still open.**
- RED regression fence: test-192 Assertion B requires `/two-axis/i` in help.md (test-192:116-127) but help.md now describes the 3-card selector. Measured: exit 1, "help.md still names the two-axis lanes-as-tabs model". MENU289-02 rewrites the assertion to the 3-card contract (test-help-selector-lanes Assertion 5 already pins that contract).
- `/mos:pipeline` chain selection: "Present both options ... Let the user choose. Do not auto-select." (commands/pipeline.md:108) with no `AskUserQuestion` in allowed-tools (measured). Real gap: convert to an F.1 card (two options, recommended by venture stage per 104-106), add `AskUserQuestion` to allowed-tools, keep the text floor.
- Soft gaps: radar.md:104 ("list the 5 valid domains and ask the user to pick one", AskUserQuestion already allowed, `hitl_shape: "F.8"`); deck.md:67 ("ask the navigator which room", `hitl_shape: "F.1"`). Both are card candidates.
- Not gaps (allow-list them in the fence): onboard.md:128 (the documented text floor for non-card surfaces), ignite.md:105 (a prohibition of the text form), update.md:136 (an error message naming two recovery paths).
- No canon note "command menus render as live selectors, never bare text" exists (grep of docs/MINDRIAN-CANON.md). SEED-020 asked for one; a canon amendment needs the Part 6 navigator approval, so record it as an open item, do not write canon in this phase.
- SEED-020 (`.planning/seeds/SEED-020-shape-f-is-the-universal-mindrian-ui.md`) still says `status: dormant` and "/mos:help today renders a TEXT list"; both are stale. The other SEED-020 file is `status: merged-into-SEED-031` (SEED-020-regulation-layer-larry-as-connector.md:3-5) and is NOT what this phase means.

**CIRS for touched surfaces.** gate.cjs connectors unchanged (`hitl_shape: 'F.1'`, gate.cjs:736-755). pipeline.md already declares `hitl_stages` (pipeline.md:7); radar F.8; deck F.1. Editing a command's frontmatter `allowed-tools` means regenerating and checking the derived artifacts: `node scripts/build-command-registry.cjs --check`, `node scripts/build-skill-mirrors.cjs --check`, `node scripts/build-connector-registry.cjs --check` (the same set 369-22 runs, 369-22-PLAN.md:180). help.md already carries an advisory WARN ("declares hitl_shape F.1 AND connector.excluded:true", measured); leave it unless the navigator rules, since the lint is advisory (CLAUDE.md Part 11).

### Q6. Phase 288 dependency - RESOLVED

Phase 288 (SEED-018, RS-engine degenerate output) is "[To be planned]", 0 plans, no phase directory, and itself depends on 287 (ROADMAP.md:2195-2204; `ls .planning/phases | grep ^288` finds nothing). SEED-018's fix lives in the Python RS pipeline (corpus exclude lists, a semantic-similarity gate, an embedding swap; SEED-018 lines 125, 146, 192) and touches no gate, ledger, renderer or command menu. The 287 -> 288 -> 289 -> 290 chain is backlog ordering, not a technical dependency. Every 289 deliverable can land before 288. Phase 369 plans 26-31 are blocked on 289, not on 288 (369-26-PLAN.md:26). Recommend the orchestrator record that 289's dependency on 288 is ordinal only and proceed; this needs the navigator's word (A4).

### Q7. Pitfalls specific to this repo - RESOLVED (see Common Pitfalls)

### Q8. Validation architecture - RESOLVED (see Validation Architecture)

## Standard Stack

No new packages. Everything is in the tree.

| Component | Version | Purpose | Evidence |
|---------|---------|---------|--------------|
| Node.js | v22.23.1 at `$HOME/.nvm/versions/node/v22.23.1/bin` | runtime and test runner | `node --version` |
| `@modelcontextprotocol/server` | 2.1.0 | `McpServer`, `serveStdio`, `createMcpHandler` | node_modules/@modelcontextprotocol/server/package.json |
| `@modelcontextprotocol/client` | installed (same family) | real v2 `Client` for dual-era tests | tests/test-267-mcpv2-dual-era.cjs:46-47 |
| `@modelcontextprotocol/core` | 2.1.0 | Titled enum schemas for the elicitation SDK validation arm | node_modules/@modelcontextprotocol/core/package.json |
| zod | 4.6.5 (per accepted-deltas `zod_version`) | tool input schemas | tests/fixtures/267/zod4-accepted-deltas.json |

## Package Legitimacy Audit

Not applicable: this phase installs no external packages. slopcheck was not run. If a plan proposes any new package, stop and run the gate.

## Architecture Patterns

### System Architecture Diagram

```
 host (Claude Code / Desktop / Cowork / web shell)
        |  tools/call gate_render {options[rank], select_mode, ...}
        v
 gate.cjs gate_render ------> detectGateCapabilities(server, ctx)   [one shared function, 5 delegates]
        |                         |  surface in Claude hosts?  -> claudeCode:true, elicitation:false
        |                         |  (optional) known non-Claude host + declared -> elicitation:true
        v                         v
 gate-render.renderGate --> normalizeCard (derives card.recommended: flag > lowest rank > null)
        |                         |
        |        pickRenderer (unchanged order: elicitation > askuserquestion > text)
        |            |                    |                         |
        |   rung (a) elicitInput     rung (b) F.8 envelope      rung (c) text
        |   schema.default=rec       + contract.recommended=id  contract.recommended=id
        |   title "Choose: A / B"    (single-select only)       body "(recommended)"
        |                            + superset_options[].recommended
        v
 gate-ledger.mintGate(gate_id, {card, sessionId, kind})
        |
 host shows the card; navigator picks
        |  tools/call gate_answer {gate_id, chosen, verdict}
        v
 gate.cjs gate_answer: peekGate -> session? -> chosen in card? -> resume owner? -> bound room? -> db opens?
        |      any refusal: return isError, ledger entry KEPT (owner can still answer)
        v
 consumeGate (session check, then the one _ledger.delete) -> navigation.cjs writes -> resumeFn (material_step)
```

### Recommended file touch list

```
lib/mcp/gate-render.cjs        # detectGateCapabilities + CLAUDE_HOST_SURFACES; normalizeCard.recommended;
                               # rung (b)/(c) contract.recommended; requestedSchema default + title; rung (b) option count
lib/mcp/gate-ledger.cjs        # consumeGate reorder; peekGate
lib/mcp/tools/gate.cjs         # delegate; ruling comments; gate_answer peek -> checks -> consume
lib/mcp/tools/chain.cjs        # delegate; _resumeFromGateAnswer peek -> chosen -> consume
lib/mcp/tools/research.cjs     # delegate; pass recommended through
lib/mcp/tools/sensors.cjs      # delegate
lib/mcp/tools/stop-gate.cjs    # delegate (require ../gate-render.cjs)
commands/pipeline.md           # F.1 card for chain selection (+ radar.md, deck.md soft gaps)
tests/test-289-*.cjs           # new (see Validation)
tests/test-238-*.cjs, tests/test-354-concurrency-surfaces.cjs, tests/test-267-mcpv2-{dual-era,gate-premise}.cjs,
tests/test-192-menu-sweep-live-selectors.cjs   # flips
.planning/phases/289-*/289-CLI-CARD-RULING.md  # Ruling: line (git add -f)
```

### Pattern 1: one shared function behind the disjoint-file seam
**What:** the tools modules keep their own named `detectClientCapabilities` (tests reach through `_internal`), but the body becomes `return gateRender.detectGateCapabilities(server, ctx);`.
**When:** any rule all five gate surfaces must obey identically. Five identical copies is how ruling (a) would silently miss research.cjs, the very surface SEED-104 reported.

### Pattern 2: peek, check, then take (single synchronous block)
**What:** a non-consuming read, every refusal, then the consume, with no `await` in between.
**Example:**
```js
// lib/mcp/tools/gate.cjs gate_answer (sketch)
const peek = gateLedger.peekGate(gate_id, sessionId);
if (!peek) return textResponse({ ok: false, reason: 'unknown_or_expired_gate', gate_id }, true);
if (peek.ok === false) return textResponse({ ok: false, reason: peek.reason, gate_id }, true); // not consumed
const validChosen = gateRender.validateChosenAgainstCard(peek.card, chosen);
if (!validChosen) return textResponse({ ok: false, reason: 'chosen_not_in_card_options', ... }, true); // not consumed
// ... resume_owner_missing, write-room, no_room_db refusals: none consume ...
const live = _consumeLiveGate(gate_id, sessionId); // the only consume; still synchronous with the peek
```

### Pattern 3: layer the gate's fidelity on top of a shipped envelope
**What:** keep `renderShapeF8` canon-true (no single marker) and fold gate-only fields on top, as gate-render.cjs:396-410 already does for `multiSelect`, `superset_options` and `notice`.

### Anti-Patterns to Avoid
- **Keying the ruling on `surface === 'cli'`:** Claude Code's stdio child reports `desktop` (surface-detect.cjs:61-64), so the rule would never fire.
- **Changing `pickRenderer` order:** flips test-198:35 and changes a pure function the SPEC-4 acceptance rests on, for no gain over fixing the capability read.
- **Moving the delete into a helper:** breaks 369-07's planned textual detector (369-07-PLAN.md:93).
- **Fixing only `consumeGate`:** 369-21 arm 3b(ii) and 369-26 arm 9 detect "post-289" from the ledger file, then expect a chosen refusal not to burn (369-21-PLAN.md:112; 369-26-PLAN.md:145). Ledger-only would read as post-289 and fail them.
- **Adding `recommended` to the F.8 renderer:** breaks shape-f8-renderer.test.cjs:46-47 and Canon entry 32.
- **Editing `gate_render`/`gate_answer` descriptions or input schemas:** moves the 267 wire snapshot and possibly the tool-honesty verdicts; not needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Client identity / host detection | a new name parser | `detectHostTier` (lib/mcp/surface-detect.cjs) | one detector; the "four guessers" failure mode is named in its own header |
| Elicitation schema validity | hand-written expectations | SDK `TitledSingleSelectEnumSchemaSchema` / `TitledMultiSelectEnumSchemaSchema` `safeParse` | test-265's SDK arm already does this |
| Chosen-value allow-list | a second validator | `gateRender.validateChosenAgainstCard` (gate-render.cjs:362-375) | the one implementation gate.cjs and chain.cjs share |
| Card menus | bespoke AskUserQuestion JSON in prose | `renderShapeF1` + `appendAskUserQuestionTrailer` | Phase 192 contract; Canon Part 3 "no bespoke dialogs" |
| Live MCP daemon in tests | ad hoc spawn | `tests/helpers/mcp-wire-267.cjs` `hermeticEnv` + the flag-on spawn (tests/test-267-mcpv2-flag-on.cjs:106-150), or `tests/helpers/mcp-daemon-369.cjs` (committed e4c4875c4) | hermetic HOME, rooms home, unreachable Brain URL (Part 8) |

## Runtime State Inventory

Not a rename or migration phase. One runtime fact matters: the gate ledger is an in-memory Map per server process (gate-ledger.cjs:29); nothing about it persists, so no data migration exists. Installed plugin copies under `~/.claude/plugins/` keep today's behaviour until a release is cut and picked up (the "not live until released" rule).

## Common Pitfalls

### Pitfall 1: the ruling lands in one of five copies
**What goes wrong:** gate.cjs is fixed, research.cjs keeps eliciting, the grant dialog of SEED-104 comes back.
**How to avoid:** the shared function; a unit test that calls all five `_internal.detectClientCapabilities` with the same fake server matrix and asserts identical results.

### Pitfall 2: tool-honesty frozen sweep
**Measured:** live `scanAll()` = 42 tools / 136 branches, equal to `tests/fixtures/tool-honesty/276-dispositions.json` `frozen_sweep`. `gate_render`, `gate_answer`, `chain_run`, `research_run`, `suggest_next`, `stop_gate_check` each scan as one `(default)` branch (their schemas have no `command` enum). Internal `if` edits do NOT move the count; a new `registerTool` or a new command enum value does, and a description edit can move a verdict. Re-run `node tests/test-276-tool-honesty-findings-closed.cjs` and `node scripts/check-tool-honesty.cjs --check` after the gate edits.

### Pitfall 3: the 267 wire snapshot
Any change to a tool's description or inputSchema diffs against tests/fixtures/267/wire-snapshot-zod4.json in the dual-era test (153-186). Keep both gate tools' descriptions and schemas byte-stable.

### Pitfall 4: 369's detectors read the ledger file
Keep `_ledger.delete(` literal inside `consumeGate`, after the session comparison, and fix `gate_answer` and the chain resume in the same plan (Anti-Patterns).

### Pitfall 5: an `await` between peek and consume
Today the stretch is synchronous (Q2). A later async room lookup would let two answers both pass the peek. Pin with a comment and a test that fires two concurrent `gate_answer` calls and expects exactly one ratification.

### Pitfall 6: the rung (b) imperative says "0 options"
**Measured:** `askuserquestion_binding` reads "call the AskUserQuestion tool in THIS response with the 0 options above" and the marker reads `shape=F.8 verbs=0`, because `appendAskUserQuestionTrailer` counts `contract.verbs` (selector-dispatcher.cjs:556, 576) and F.8 carries `options`. No test pins `shape=F.8` (grep). Smallest gate-local fix: set the count from `card.options` on the gate rung before calling the trailer (for example `base.contract.verbs = card.options.map((o) => o.label)`), leaving the shared dispatcher and its F.4 pin (test-210-trailer-relevance.cjs:94) alone.

### Pitfall 7: long dashes and Part 8
New strings stay hyphen-only. Gate payloads carry ids, enums and labels only; no new egress path. The rethinking-room compositing rule (CLAUDE.md "Dev-Research Compositing") applies to architecture findings; this phase's gate findings are plugin code facts.

### Pitfall 8: two sessions on one tree
Phase 369 wave 0 is editing CLAUDE.md, package files, CHANGELOG.md, scripts/release.sh, skills/ui-system/SKILL.md, .claude/includes/decisions.md, tools/ts-check/** and tests/test-369-*. 369-26 will later edit gate.cjs and gate-ledger.cjs and checks `git status --short` for peer diffs (369-26-PLAN.md:78). Commit with `git commit --only -- <files>`; `git add -f` for `.planning/` files; never revert an unowned diff.

### Pitfall 9: the stale fence and the stale seed
test-192 is RED today (Q5). SEED-020's body is stale. Do not treat a red test-192 as a regression caused by 289.

## Code Examples

### Elicitation schema with a default (single-select)
```js
// lib/mcp/gate-render.cjs buildElicitRequestedSchema (sketch)
const labels = card.options.map((o) => o.label);
const choice = {
  type: 'string',
  title: _capTitle('Choose: ' + labels.join(' / ')),
  oneOf: card.options.map((o) => ({ const: o.id, title: o.label })),
};
if (card.header) choice.description = card.header;
if (card.recommended) choice.default = card.recommended; // must be one of the oneOf consts
```

### Contract recommended id on rung (b)
```js
// after renderShapeF8(...) and the existing multiSelect override
const single = card.selectMode !== 'multi';
base.contract.recommended = single ? card.recommended : null; // Canon entry 32: no single marker on a basket
base.contract.superset_options = card.options.map((o) => ({
  id: o.id, label: o.label, description: o.description, rank: o.rank, preview: o.preview,
  recommended: o.id === card.recommended || o.recommended === true,
}));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Claude Code opens stdio with `initialize` 2025-11-25, declares elicitation | Opens with `server/discover`, no initialize-time capabilities | between 2.1.281 (2026-09-24) and 2.1.287 (2026-10-02) | CLI already renders rung (b) |
| Client capabilities only from `initialize` | SDK 2.1.0 backfills them per request from the 2026-07-28 envelope on the HTTP handler | SDK 2.x | The HTTP daemon can see declared elicitation on a 2026 connection |
| Legacy `enum`/`enumNames` elicitation schema | Titled `oneOf`/`anyOf` with optional `default` | Phase 265-02 (RADAR-06) | `default` is a supported field |

**Deprecated/outdated:** the 2026-09-23 "let elicitation take over on CLI" ruling (gate.cjs:9-15, 304-318); SEED-020's "/mos:help renders a TEXT list".

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The ruling covers every Claude host surface (cli, desktop, cowork), since the server cannot tell CLI from Desktop; the optional clientInfo refinement keeps elicitation for recognized non-Claude hosts | Q1 | If the navigator meant "CLI only", Desktop/Cowork behaviour is unaffected in practice (Desktop declares none), but a future Cowork elicitation path would also be suppressed |
| A2 | Lower `rank` number means higher priority (rank 1 = top) | Q3 | The recommended id would be the bottom option; 369's probe would fail its "top-ranked" assertion |
| A3 | A recommended id on a single-select gate that borrows the F.8 envelope does not breach Canon Appendix D entry 32, because the gate is a ranked slate, not a basket | Q3 | A canon checker may flag it; mitigation is the multi-select null rule plus the ruling-file sentence |
| A4 | Phase 288 is an ordinal, not technical, dependency and 289 may proceed first | Q6 | Needs the navigator's word; otherwise 369 plans 26-31 stay blocked behind 287 and 288 |
| A5 | A rank-derived recommendation is the caller's explicit ordering, outside the 0.70 Brain-confidence rule for F.1 Mode A (docs/MINDRIAN-CANON.md:189) | Q3 | If the canon reading requires a 0.70 confidence for any marker, rank-only recommendations need a separate ruling |
| A6 | Claude Code's AskUserQuestion convention puts a recommended option first with "(Recommended)" in its label | Q3 (adapter use) | Only affects how the model composes the native call from `contract.recommended`; no code depends on it |
| A7 | 2026-07-28 elicitation over the HTTP daemon would go through `server.server.elicitInput` in a per-request instance and its behaviour is unknown (MRTR `input_required` exists in the SDK) | Q1 | Moot after the ruling for Claude surfaces; matters only for the optional non-Claude refinement on HTTP |

## Open Questions

1. **Does the navigator want elicitation kept for non-Claude hosts (CARD289-06)?**
   - What we know: the plain ruling makes rung (a) unreachable in production (Q1).
   - Recommendation: take the refinement; it is one clause on the existing `detectHostTier`, and it gives ELICIT289's default a real surface.
2. **Canon note for "menus render as live selectors"?**
   - What we know: SEED-020 asked for it; none exists.
   - Recommendation: record as a navigator decision item; do not amend canon in this phase.
3. **Mark SEED-020 status?**
   - Recommendation: the closing plan updates the seed to reflect shipped scope (help 9a18fe81d/28f95106b, Phase 192, Phase 289).
4. **Theo mirror.** Theo's description text mirrors the ladder as "elicitation first" (/home/jsagi/Theo/src/mcp/operational/gate-render.ts:38, 106). Recommendation: a handoff note only, no Theo edits (369-26 already plans a Theo handoff for the gate contract).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | all tests | yes | v22.23.1 | - |
| `@modelcontextprotocol/client` + `/stdio` | dual-era live test | yes | 2.x (installed) | exit 77 ENV GAP |
| `@modelcontextprotocol/server` | server under test | yes | 2.1.0 | - |
| Free loopback port | HTTP daemon leg | assumed | - | exit 77 ENV GAP if the daemon cannot start |
| Playwright | not needed | - | - | - |

Live daemon tests were NOT run during this research (a peer is executing on the tree); measurements here are read-only node evaluations and read-only test runs (test-192, test-help-selector-lanes, test-help-cards-render, check-help-coverage, check-shape-declaration --check, check-tool-honesty scanAll).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | plain Node CJS, `node:assert`, PASS/FAIL counters, exit 1 on any FAIL, exit 77 = ENV GAP (house pattern, tests/run-all-366.sh:6-30) |
| Config file | none |
| Quick run command | `export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH" && node tests/test-289-capability-ruling.cjs && node tests/test-238-session-scoped-ledger.cjs` |
| Full suite command | `bash tests/run-all-289.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CARD289-01 | five delegates agree; Claude surface -> `elicitation:false, elicitation_declared:true, claudeCode:true`; null surface + declared -> elicitation | unit | `node tests/test-289-capability-ruling.cjs` | no (Wave 0) |
| CARD289-02 | "Normal card on CLI": stdio era 2025 (CLAUDE_SURFACE=cli with MINDRIAN_TRANSPORT unset, and the default desktop env) + declared elicitation -> 0 elicitation requests, renderer askuserquestion; stdio era 2026 -> same; HTTP daemon (surface cowork) 2026 client declaring elicitation -> 0 requests | live, hermetic | `node tests/test-289-cli-card-dual-era.cjs` | no (Wave 0) |
| CARD289-03 | ruling file carries `Ruling:` and names CARD289-02's test, which exits 0 | artifact check | `grep -q '^Ruling:' .planning/phases/289-*/289-CLI-CARD-RULING.md` | no |
| CARD289-04 | 267 arms flipped; source arm keeps "2.1.280" | live + unit | `node tests/test-267-mcpv2-dual-era.cjs && node tests/test-267-mcpv2-gate-premise.cjs` | yes (edit) |
| CARD289-05 | rung (b) binding names the real option count | unit | `node tests/test-289-contract-recommended.cjs` | no |
| LEDGER289-01..03 | owner-after-stranger; chosen refusal then correct answer ratifies; unbound-room refusal then bind then answer ratifies; replay after success refused; two concurrent answers ratify once | unit + in-process MCP | `node tests/test-238-session-scoped-ledger.cjs && node tests/test-238-chosen-validation.cjs && node tests/test-289-ledger-consume-after-checks.cjs` | partly (edit + new) |
| LEDGER289-04 | chain resume refusal does not burn | in-process | `node tests/test-238-chain-chosen-validation.cjs` | yes (edit) |
| LEDGER289-05 | K3 flipped | live | `node tests/test-354-concurrency-surfaces.cjs` | yes (edit) |
| CONTRACT289-01..04 | recommended id by VALUE equals the top-ranked option on rungs (b) and (c); null with no rank or flag; multi-select contract.recommended null; research grant card carries the planner's recommended id | unit + live daemon leg (legacy client, bound room, gate_render with ranks, find the id by value outside superset_options, print its JSON path) | `node tests/test-289-contract-recommended.cjs` | no |
| ELICIT289-01..02 | default equals recommended and passes SDK safeParse; title starts "Choose:"; surviving-rung arm | unit (+ live arm if CARD289-06) | `node tests/test-289-elicit-default.cjs && node tests/test-265-gate-render-elicit-schema.cjs` | partly |
| MENU289-01..03 | pipeline chain selection is an F.1 card with a text floor; fence finds no unlisted bare-text chooser; test-192 green | static | `node tests/test-289-menu-fence.cjs && node tests/test-192-menu-sweep-live-selectors.cjs` | partly |
| regression | renderer ladder, F.8 canon, one ledger, wire snapshot, tool honesty | unit/static | `node tests/test-198-gate-renderers.test.cjs && node lib/hmi/shape-f8-renderer.test.cjs && node tests/test-238-one-ledger.cjs && node tests/test-276-tool-honesty-findings-closed.cjs && node scripts/check-tool-honesty.cjs --check` | yes |

### `tests/run-all-289.sh` shape
Modeled on tests/run-all-366.sh: `run` for existing files, `run_if <label> <file> <cmd>` for not-yet-landed legs (reports SKIPPED (missing ...)), counters PASSED / FAILED / SKIPPED, exit 77 counted as SKIPPED (ENV GAP) never as PASS, final exit 1 on any FAILED. Legs in wave order: capability ruling, ledger, contract, elicit default, menu fence, the flipped 238/267/354/192 files, then the live dual-era leg last (slowest, daemon spawn). Add a closing leg that runs the 369 precondition probe when it exists (`run_if ... tests/test-369-289-precondition.cjs`), so 289's own suite proves the downstream contract.

### Sampling Rate
- Per task commit: the quick run command plus the test file the task edits.
- Per wave merge: `bash tests/run-all-289.sh`, `bash tests/run-all-238.sh`, `bash tests/run-all-198.sh`.
- Phase gate: the above plus `bash tests/run-all-267.sh` and `bash tests/run-all-354.sh` (both carry flipped files) green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/test-289-capability-ruling.cjs` (CARD289-01)
- [ ] `tests/test-289-cli-card-dual-era.cjs` with the literal "Normal card on CLI" (CARD289-02); process hygiene copied from test-267-mcpv2-dual-era.cjs:85-146 and 277-301
- [ ] `tests/test-289-ledger-consume-after-checks.cjs` (LEDGER289-01..03)
- [ ] `tests/test-289-contract-recommended.cjs` (CONTRACT289, CARD289-05)
- [ ] `tests/test-289-elicit-default.cjs` (ELICIT289)
- [ ] `tests/test-289-menu-fence.cjs` (MENU289-03)
- [ ] `tests/run-all-289.sh`
- [ ] `.planning/phases/289-*/289-CLI-CARD-RULING.md` (`git add -f`)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | - |
| V3 Session Management | yes | gate ownership by ledger session key (gate-ledger.cjs:47-50, 64-72); the fix stops a non-owner from cancelling |
| V4 Access Control | yes | only the minting session ratifies; refusals no longer have side effects |
| V5 Input Validation | yes | `validateChosenAgainstCard` allow-list before any write (gate-render.cjs:362-375); zod shape checks (gate.cjs:444-448) |
| V6 Cryptography | no | gate ids from `crypto.randomBytes(8)` (gate-render.cjs:176), unchanged |
| V11 Business Logic | yes | single-use under concurrency (peek-check-consume with no await) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A second session cancels someone else's pending decision by answering it (spike 007) | Denial of Service | session check before delete; refusals never consume |
| Replay of a ratified gate id | Spoofing / Tampering | consume on success; replay arm in tests |
| Double submit racing two ratifications | Tampering | synchronous peek-to-consume; concurrency arm |
| Spoofed clientInfo to change rungs (only if CARD289-06) | Spoofing | accepted (T-234-08): changes presentation only, never authority |
| Prose leaking into outbound terms | Information Disclosure (Part 8) | unchanged; gates carry ids and labels only, no network path |

## Sources

### Primary (HIGH confidence, read or measured this session)
- lib/mcp/tools/gate.cjs (1-767), lib/mcp/gate-ledger.cjs (1-145), lib/mcp/gate-render.cjs (1-536), lib/hmi/shape-f8-renderer.cjs, lib/hmi/shape-f8-renderer.test.cjs, lib/hmi/shape-f1-renderer.cjs, lib/hmi/selector-dispatcher.cjs (440-592)
- lib/mcp/tools/research.cjs (85-238, 440-520), chain.cjs (130-205, 724-870), sensors.cjs (178-205), stop-gate.cjs (20-50), graph.cjs (60-100), lib/core/research-planner/canon-release.cjs (455-470)
- lib/mcp/surface-detect.cjs (1-200), bin/mindrian-mcp-server.cjs (surface wiring), .mcp.json
- node_modules/@modelcontextprotocol/server 2.1.0: dist/index.cjs:1311, 1405-1408; dist/mcp-DUcCQSTW.cjs:930-995; dist/createMcpHandler-Bt6U_Fqb.d.mts:3058-3077
- node_modules/@modelcontextprotocol/core 2.1.0: dist/auth-4-zilcqg.cjs (Titled enum schemas with `default`)
- tests: test-238-session-scoped-ledger.cjs, test-238-chosen-validation.cjs (150-232), test-238-chain-chosen-validation.cjs (160-190), test-238-one-ledger.cjs (grep), test-354-concurrency-surfaces.cjs (15-45, 352-370), test-198-gate-renderers.test.cjs, test-209-card-fire-gate.cjs (1-40), test-265-gate-render-elicit-schema.cjs (30-160), test-267-mcpv2-dual-era.cjs, test-267-mcpv2-gate-premise.cjs, test-267-mcpv2-flag-on.cjs (100-155), helpers/mcp-wire-267.cjs (1-120), helpers/mcp-daemon-369.cjs (API grep), test-192-menu-sweep-live-selectors.cjs
- .planning/phases/267-*/267-TRIPOLAR-PROBES.md (1-100, 100-260 grep), .planning/spikes/007-agent-native-wraps-mcp/README.md, CONTEXT.md, stages/02_actions/burn-probe.cjs and burn-probe.out.json
- .planning/seeds/SEED-020-shape-f-is-the-universal-mindrian-ui.md, SEED-020-regulation-layer-larry-as-connector.md (1-40), SEED-104-research-grant-family-loop-eureka-plan-unfetchable.md, SEED-018 (grep)
- .planning/phases/369-*/369-26-PLAN.md, 369-27-PLAN.md, 369-07-PLAN.md, 369-21-PLAN.md, 369-22-PLAN.md (grep), 369-RESEARCH.md Pattern 8
- .planning/ROADMAP.md:1620-1624, 2195-2224; commands/help.md, pipeline.md, radar.md, deck.md, onboard.md, ignite.md, update.md; docs/HITL-SHAPE-DECLARATION-CONTRACT.md (1-60); docs/MINDRIAN-CANON.md:177, 189, 852; CLAUDE.md
- Measurements: node render of a two-option ranked card on rungs (b) and (c); `scanAll()` 42/136; test-192 exit 1; help tests green; check-shape-declaration --check 53 WARN exit 0; `git check-ignore -v` on this file

### Secondary
- /home/jsagi/Theo/src/mcp/operational/gate-render.ts:38, 106 (description mirror, read-only)

### Tertiary
- `.planning/graphs/graph.json` last built 2026-07-23 (stale); the query "gate ledger elicitation" returned 0 nodes, so no graph context was used.

## Metadata

**Confidence breakdown:**
- Gate defects and fixes: HIGH - every line cited from code at HEAD d90ffbfa3, two measured renders, SDK source read.
- HTTP 2026 envelope-seeded elicitation: MEDIUM - SDK code read, not exercised live (CARD289-02's HTTP leg measures it).
- Menu sweep scope: MEDIUM - grep heuristics over 113 command files; the fence test makes it exhaustive.
- Pitfalls: HIGH - each tied to a measured gate or a 369 plan line.

**Research date:** 2026-10-02
**Valid until:** 2026-10-16 (fast-moving: Phase 369 is executing on the same files' neighbours, and Claude Code's MCP handshake changed twice in nine days)
