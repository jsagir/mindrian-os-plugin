---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
plan: 13
subsystem: mcp-never-do-approval
tags: [b3, never-do, growth, approval-trail, gate-ledger, theo-parity]
requires: [365-07, 365-09, 365-10]
provides:
  - lib/mcp/never-do-gate.cjs (buildProposalCard, mintProposalGate, mintHaltedConstraintGate)
  - chain_result.never_do_gate on a material-step Reject
  - never_do_gate on ambient plan-only pending cards, gate on halted_constraint pending cards
affects: [365-14, 365-15, 365-16]
tech-stack:
  added: []
  patterns: [single-use material_step gate whose resumeFn reads the decision node gate_answer wrote, elicitation forced off for approval-trail cards, response-data-only additions]
key-files:
  created:
    - lib/mcp/never-do-gate.cjs
    - tests/test-365-never-do-gate.cjs
  modified:
    - lib/mcp/tools/chain.cjs
    - lib/mcp/tools/research.cjs
key-decisions:
  - "The follow-up is a separate gate, not a fourth option on the halt card, because chain.cjs maps the chosen option id straight to the verdict"
  - "The resumeFn requires BOTH verdict approve and chosen containing approve (the research grant pattern); an approve verdict that names the reject option lands nothing (chosen_not_approving)"
  - "The proposal card header carries the entry (Reject and never do this? <kind>: <value>) because gate_answer records the header as the decision node text, so the approval trail names what was approved"
requirements-completed: [V365-10, V365-13]
duration: ~70 min
completed: 2026-10-01
---

# Phase 365 Plan 13: Reject and never do this Summary

An unattended halt or a Reject on a material-step card now offers one more gate, "Reject and never do this", pre-filled from what tripped; an entry lands in `.mindrian/never-do.json` only after the navigator approves that gate and gate_answer has written its decision node.

PLAN_BASE: ab5e1d16b1a6e6622a8e98db92263649f5487749

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 3949ea19a | lib/mcp/never-do-gate.cjs (buildProposalCard, mintProposalGate) + test N1..N8 |
| 2 | e11990af0 | chain.cjs reject offer, research.cjs pending-card attachments, mintHaltedConstraintGate, test N9..N13 |

Both verified as ancestors of HEAD (HEAD at the full run: e11990af08f3124e8c3dd4ade7e69d51fd15cf60).

## How it works

- `mintProposalGate(proposal, {roomDir, sessionId, capabilities, surface})` validates the proposal (kind in KINDS, value and why non-empty), renders the Shape F card with elicitation forced off (rung b for a Claude host, else rung c), and mints a single-use `material_step` ledger entry whose resumeFn closes over roomDir and the proposal.
- The resumeFn runs only after gate_answer consumed the gate and wrote `decision:gate:<gate_id>`. On approve it reads that node (refusing `decision_node_missing` when absent) and calls `writeNeverDoEntry(roomDir, {kind, value, why}, {approved_via: {surface: 'mcp', decision_node_id}})`. Reject and defer write nothing. A replay is refused by the ledger (`unknown_or_expired_gate`).
- chain.cjs: the resume entry now carries `haltReason` and `targetSection`. On a `reject` verdict where the halt was not `constraint_named` / `constraints_malformed`, `_offerNeverDo` builds the proposal from the halted step's declared fields and attaches `never_do_gate {gate_id, renderer, rendered, proposal, next_step}` to the returned chain result (both gate_answer and the direct chainRun gateAnswer path). The chain_run handler's renderCtx now also carries `surface` (render context only, not the tool schema).
- research.cjs: `attachNeverDoGates` runs in `op pending` and in the ride-along block (the pending cards ride along exactly once because they are marked surfaced). A `plan_card_no_grant` card with `payload.never_do_proposal` gets `never_do_gate`; a `halted_constraint` card gets `gate` (the card.json rendered as a Shape F gate in the ledger).
- halted_constraint gate: approve -> `{ok:true, executed:false, next_step}` naming `research_run` op `run_quick` with that run_id (attended; the grant check still applies); reject -> the follow-up from the card's own `never_do_proposal`, omitted when the payload has no proposal, when the list is unreadable, or when the list already covers the proposal (checked at reject time); defer -> `{ok:true, executed:false}`.

## Proposal card copy

- Header: `Reject and never do this? <kind>: <value>` (value trimmed to 80 characters)
- Options: approve `Reject and never do this` ("Adds one entry to this room's never-do list. Unattended steps that match it will stop and ask."), reject `Just reject this time` ("Nothing is added to the list."), defer `Decide later`
- Notice: `<kind>: <value>. Why: <why> This list catches only what has been named. It is a floor, not a guarantee.` (why trimmed first, then value, so the floor sentence is always whole inside 400 characters)
- chain next_step: "The navigator rejected this step. never_do_gate offers to add it to this room's never-do list: show its card and answer it with gate_answer. This list catches only what has been named. It is a floor, not a guarantee."

## Theo schema parity evidence

- No input schema, title or description changed on gate_render, gate_answer, chain_run or research_run; graph_write and room_bind untouched (no file of theirs in the diff). lib/mcp/tools/gate.cjs is not in the diff (`git diff ab5e1d16b -- lib/mcp/tools/gate.cjs` is empty).
- N12 loads the PLAN_BASE source of gate.cjs, chain.cjs and research.cjs via `git show`, captures their registrations, and asserts title, description and a structural dump of the input schema (field names, requiredness, descriptions, checks) are identical for gate_render, gate_answer, chain_run and research_run, plus the byte-identity of gate.cjs.
- `node scripts/build-connector-registry.cjs --check`: OK (registry unchanged; the helper has no register or connectors export, Part 11).
- Additions are response data only: `chain_result.never_do_gate`, a pending entry's `never_do_gate` and `gate`.

## Hand-offs

- **365-16 (Theo sync), candidate description refreshes:** gate_answer's description does not mention the never-do landing (it already resumes material_step gates generically, as it does for research grants). chain_run's description (365-09 note) still says only "halts at the first material step". research_run's description does not name the `never_do_gate` / `gate` fields on pending cards. All left unchanged on purpose.
- **365-14 (Claude Code script path / research.md text):** the pending halted_constraint and plan-only cards now carry `gate` / `never_do_gate` on the MCP surface. The script path (scripts/research-planner.cjs, research.md touchpoint text) still has to render them for the CLI; the writer door for that path is `writeNeverDoEntry` with surface `cli` after a decision node is minted by the caller.
- **365-15 (status):** nothing new; `listSummary` unchanged.
- Resume tail (365-09 hand-off still open): `_executeResumedEntry` does not forward `targetSection` into the continuation chainRun, so a Reject on a SECOND halt inside a resumed tail pre-fills from command and path only. Not changed here (outside the plan's scope).

## Verification at HEAD e11990af08f3124e8c3dd4ade7e69d51fd15cf60

- `RUN_365_REGRESSIONS=1 bash tests/run-all-365.sh`: `PASSED=63 FAILED=0 SKIPPED=0 KNOWN=7` (was 62/0/0/7 at PLAN_BASE; the +1 is the new leg). Regression block: run-all-354, 355, 356, 358, 363 all PASSED (no leg above base). Part 8 sweep: `clean: lib/mcp/never-do-gate.cjs`.
- `node scripts/build-harness-manifest.cjs --check`: OK (chain-executor.cjs untouched, both `forced_material` literals intact; manifest not regenerated because no digested surface changed).
- `node tests/test-365-never-do-gate.cjs`: PASS 75 FAIL 0 (N1..N13 and guards).
- Neighbors green: test-363-mcp-tool, test-198-chain-run-halt, test-365-never-do-chain, test-365-never-do-ambient, test-347-resume-nonlinear, test-276-theo-description-parity, test-c55-one-resume-owner, test-238-one-ledger. Known pre-existing reds unchanged (test-238-chosen-validation memory_event count, test-237 mutation needle), both listed KNOWN.
- No em-dashes or en-dashes in any touched file (`grep -nP` clean).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Proposal card header names the proposed entry**
- **Found during:** Task 1 design
- **Issue:** the plan's header "Reject and never do this?" alone would become the decision node text (gate_answer records the card header), so the approval trail would not say what was approved.
- **Fix:** header is `Reject and never do this? <kind>: <value>`; the plan's labels, options and notice are unchanged.
- **Commit:** 3949ea19a

**2. [Rule 2 - Missing critical functionality] resumeFn also requires the approve option**
- **Found during:** Task 1 (T-365-05)
- **Issue:** gate_answer's `verdict` and `chosen` are independent inputs; an approve verdict naming the reject option would otherwise land an entry.
- **Fix:** refuse `chosen_not_approving` unless chosen includes `approve` (N7 covers it directly and end to end).
- **Commit:** 3949ea19a

**3. [Scope note] `surface` carried on chain_run's render context**
- To keep rung b on an elicitation-capable Claude host, the chain_run handler adds `surface` to the render context it already builds; the helper treats an elicitation-capable host with an unknown surface as rung c. Not a schema change (N12).
- **Commit:** e11990af0

No other deviations.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint; T-365-05 (N3, N7), T-365-24 (N8), T-365-09 (N6), T-365-15 (N12), T-365-11 (commit --only, ancestors checked) are implemented and tested as planned.

## Self-Check: PASSED

Files exist (lib/mcp/never-do-gate.cjs, tests/test-365-never-do-gate.cjs); commits 3949ea19a and e11990af0 are ancestors of HEAD; STATE.md and ROADMAP.md untouched; the peer's uncommitted files left alone.
