---
status: resolved
kind: rca
trigger: "framework-run-halt-card-never-minted-unknown-gate"
issue_id: "B11"
severity: medium
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [3]
created: 2026-11-06T00:00:00Z
updated: 2026-11-06T00:00:00Z
---

## Current Focus

target: PRESENT

hypothesis: The framework_run halt path calls renderGate, which only draws a card and generates a gate id. Nothing mints that id in the gate ledger, so gate_answer answers unknown_gate.
test: Call framework_run through the registered handler on a chain with a material step, then call gate_answer with the returned gate_id.
expecting: gate_answer returns ok false, reason unknown_gate, and the ledger holds no entry for the id.
next_action: Mint the gate in the halt path right after renderGate, with the normalized card, the session id, the renderer and the approving ids. Use kind general so gate_answer only records the answer.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release (worktree of the dev workspace)
- Plugin version: 2.0.0 beta line, worktree HEAD at plan start 33af7ee46
- Reported by: auditor finding B11 (M1-09); CLAUDE.md names it as an open trap
- Date first observed: 2026-11-06
- Related debug sessions: none

## Source-of-Truth Preamble

- CODE claims read against: branch main of the release worktree @ 33af7ee46
- WIRE claims probe against: none (in-process handlers, fixture room, no network, no Brain call)
- Date of audit: 2026-11-06
- Re-verification rule: all code claims were read from the working tree at the sha above.

Target check: the framework_run handler in lib/mcp/tools/sensors.cjs still has the halt path after `autonomy.blockers` that calls `gateRender.renderGate`, and gate_answer still exists in lib/mcp/tools/gate.cjs. Phase 384 and Phase 385 did not remove or narrow either.

## Problem Statement

framework_run halts at a material step and returns a gate id and a rendered card. The id is never minted, so the user cannot answer the card: gate_answer says unknown_gate.

## Symptoms

expected: gate_answer on the returned gate_id records the answer (approve, skip or stop). No step runs.
actual: gate_answer returns ok false, reason unknown_gate ("No gate with this id is open in this server, and no saved answer for it was found in the room.").
errors: reason unknown_gate
reproduction:
  1. Register gate.cjs and sensors.cjs on a fake MCP server (handler capture), with a fixture room as the active room.
  2. Call framework_run with a chain of one framework whose command is not autonomous_safe (first such framework in data/command-registry.json: Six Thinking Hats, /mos:bono).
  3. Call gate_answer with the returned gate_id, chosen [approve], verdict approve.
started: Phase 198-06 (framework_run halt path written before the unified ledger of Phase 238)

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (any host that calls framework_run)
- Affected commands: framework_run
- Affected users: all
- Version range: Phase 238 onward (the ledger became the only answerable store)
- Severity: medium
- Blast radius: the card the user sees cannot be answered; the user cannot approve, skip or stop the halted chain through it.

## Eliminated

- hypothesis: renderGate mints the gate itself.
  evidence: lib/mcp/gate-render.cjs holds no call to mintGate and does not require lib/mcp/gate-ledger.cjs. The only matches for "mintGate" in that file are comments. PROVEN.
  timestamp: 2026-11-06T00:00:00Z
- hypothesis: The ledger entry expired or the session id differs.
  evidence: The ledger reports no live entry right after the halt (isGateLive false), so no mint happened. PROVEN.
  timestamp: 2026-11-06T00:00:00Z

## Evidence

- timestamp: 2026-11-06T00:00:00Z
  checked: lib/mcp/tools/sensors.cjs, framework_run handler after `autonomy.blockers`
  found: builds a card (kind general, options approve, skip, stop), calls gateRender.renderGate(card, renderCtx), then returns `gate: { gate_id: rendered.card.gate_id, ... }`. There is no mintGate call and no require of lib/mcp/gate-ledger.cjs in the file.
  implication: PROVEN. The id is returned but never stored.
- timestamp: 2026-11-06T00:00:00Z
  checked: lib/mcp/tools/chain.cjs `_mintResumeLedger` and its call after the halt render
  found: chain.cjs mints with `gateLedger.mintGate(gateId, Object.assign({ renderer: 'none' }, entry))`. The entry holds the normalized card, kind material_step, approving ['approve'], the renderer from `gateRender.ledgerRenderer(rendered, renderCtx)`, sessionId and a resumeFn.
  implication: PROVEN. chain_run mints. framework_run does not.
- timestamp: 2026-11-06T00:00:00Z
  checked: lib/mcp/tools/gate.cjs gate_answer
  found: a missing entry goes to `_answerWithoutLiveGate`, which answers gate_expired when the ledger remembers an expired id, else unknown_gate. A live entry of kind material_step without a resumeFn is refused resume_owner_missing. A live entry of another kind (general) is validated (chosen in card, verdict against approving) and recorded as a decision with no step run.
  implication: PROVEN by reading. Minting with kind general gives record-only behavior. Minting with kind material_step would be refused (no resumeFn) and must not be used.
- timestamp: 2026-11-06T00:00:00Z
  checked: Run through the registered handlers (fake server, fixture room, no network), chain of 1 framework
  found: framework_run returns ok true, runnable false, gate with keys gate_id, renderer (askuserquestion), rendered, answer. ledger.isGateLive(gate_id) is false. gate_answer approve returns ok false, reason unknown_gate, isError true.
  implication: PROVEN. Reproduced.

## Technical Root Cause

- Site: lib/mcp/tools/sensors.cjs, handler of tool `framework_run`, the halt path after `gateRender.renderGate`.
- Cause: the halt path was written to return the rendered card only. It never stores the gate id in lib/mcp/gate-ledger.cjs, which is the only store gate_answer reads.
- Why it surfaces now: Phase 238 made the unified ledger the only answerable store. framework_run was not updated.

Fix decision: mint right after renderGate succeeds, with `gateLedger.mintGate(rendered.card.gate_id, { card: rendered.card, sessionId, kind: rendered.card.kind or 'general', renderer: gateRender.ledgerRenderer(rendered, renderCtx), approving: ['approve'] })`. Require `../gate-ledger.cjs` (not a tools module, so the disjoint-file rule holds; gate-render.cjs is required the same way). Kind is general, not material_step, so gate_answer records the answer and runs no step. The halt note already says the chain was not executed. No change to gate.cjs is needed. approving ['approve'] keeps only the approve option as a yes, the same rule chain.cjs uses.

Limits recorded: the entry carries no mintedRoomDir, so the room_switched check does not apply to this gate. gate_render computes that field from write-authority rooms inside gate.cjs, and sensors.cjs may not require gate.cjs. A later change can move that helper to a shared module. Not in scope for B11.

## Required Code Changes

- Change 1:
  - Location: lib/mcp/tools/sensors.cjs, handler of `framework_run`, after `rendered = await gateRender.renderGate(...)`
  - Current behavior: returns the gate id without a ledger entry.
  - Required behavior: mint the id when the render succeeded and a gate_id exists; skip the mint when the render was an inline answered elicitation (rendered.answer present, the dialog already resolved, nothing left to answer). Keep the response body and the note unchanged.
  - Short-term patch: same.
  - Long-term fix: none needed.

## Tests to Add or Update

- Test 1:
  - Type: integration through the registered MCP handlers
  - Location: tests/test-386-framework-run-halt-gate-minted.cjs
  - Given: a fixture room, a chain whose first framework has a non-autonomous_safe command
  - When: framework_run halts, then gate_answer is called on the returned gate_id
  - Then: H1 not unknown_gate and ok true; H2 the answer is recorded (chosen, verdict echoed) and the result has no chain_result and no step output; H3 a never-minted id still answers unknown_gate; H4 a second answer of the same id is refused (the ledger releases the id after the first answer, so the replay path of gate_answer answers from the saved record: replayed true, no second write)
  - Runner registration: tests/run-all-386.sh globs tests/test-386-*, no edit needed

## Non-Code Follow-ups

- CLAUDE.md names this trap in the WORKSPACE GUARD handoff note. Doc edits are not part of this plan.
- CHANGELOG.md and knowledge-base.md are owned by plan 386-21.

## Resolution

root_cause: The framework_run halt path in lib/mcp/tools/sensors.cjs rendered a gate and returned its id but never minted the id in lib/mcp/gate-ledger.cjs, so gate_answer answered unknown_gate.
fix: After renderGate, the halt path mints the rendered card with gateLedger.mintGate (kind general, renderer from ledgerRenderer, approving ['approve'], session id). Skipped when the elicitation dialog was already answered inline. gate.cjs unchanged. The entry carries no mintedRoomDir (recorded limit above).
verification: tests/test-386-framework-run-halt-gate-minted.cjs RED (H1, H2 and the anti-vacuity row failed; H3, H4 passed) then GREEN (all arms). tests/test-sensors-routing-fence.cjs, test-sensors-part8-sweep.cjs, test-198-contract-schema, test-198-chain-run-halt, test-198-local-only, test-238-one-ledger, test-238-chosen-validation, test-289-ledger-consume-after-checks, test-h27-gate-card-node-fields, test-254-composition-census, test-248 all exit 0. bash tests/run-all-386.sh: 13 pass, 0 fail. node scripts/check-shape-declaration.cjs --check exit 0. Two failures not caused by this change: tests/test-237-autonomy-parity.cjs Leg 5 (anchor drift in chain.cjs, a file this plan did not touch) and tests/test-252-guard-census.cjs census.5b (skills/rs-experts/SKILL.md canary).
files_changed:
  - lib/mcp/tools/sensors.cjs (require gate-ledger, mint in the halt path)
  - tests/test-386-framework-run-halt-gate-minted.cjs (new)
commits: RED 72f73eb73; fix 46ba22f2c
