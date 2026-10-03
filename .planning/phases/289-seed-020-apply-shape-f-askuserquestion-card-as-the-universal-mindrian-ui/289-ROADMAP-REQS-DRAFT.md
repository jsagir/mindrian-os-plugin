# Phase 289 - ROADMAP and REQUIREMENTS draft (for the orchestrator to apply)

> Written by the planner, 2026-10-03. A peer session is executing Phase 369 on this working tree, so the planner did not edit `.planning/ROADMAP.md` or `.planning/REQUIREMENTS.md`. The orchestrator applies Part A and Part B below to those shared files in coordination with the peer. No plan in this phase writes either file (D-09); plan 289-09 hands back a close-out block (the same rows flipped to `[x]` with Measured lines) at phase close.

---

## Part A - `.planning/ROADMAP.md`, the `### Phase 289:` card

Keep the card's `**Goal:**`, `**Folded in 2026-10-02 ...**` and `**Deliverables Phase 369 probes for ...**` paragraphs exactly as they are. Replace everything from the `**Requirements**: TBD` line through the `- [ ] TBD (run /gsd-plan-phase 289 to break down)` line, inclusive (today that span is the Requirements, Depends on and Plans lines, a blank line, `Plans:`, a blank line and the TBD row), with the block below. The `### Phase 290:` heading and everything after it stay untouched.

```
**Requirements**: CARD289-01..06, LEDGER289-01..05, CONTRACT289-01..04, ELICIT289-01..02, MENU289-01..03, VAL289-01, CLOSE289-01 (22 IDs, minted at plan time in `.planning/REQUIREMENTS.md`, 2026-10-03; D-01..D-09 in `289-CONTEXT.md`)
**Depends on:** none in code. Phase 288 was waived as a dependency by navigator ruling 2026-10-03 (D-01: 288 has 0 plans and no directory, SEED-018 touches only the Python RS pipeline, and every Phase 289 deliverable lands first; the 287 -> 288 -> 289 order is backlog order, not a technical dependency). Phase 369 waves 10-14 depend on this phase (369 plans 26 and 27 run `tests/test-369-289-precondition.cjs`).
**Plans:** 9 plans

Plans:
**Wave 1**

- [ ] 289-01-PLAN.md -- Wave 0: tests/run-all-289.sh written once (every leg run_if, exit 77 never a pass, dual-era leg last, 369 probe closing, long-dash guard), the capability-ruling matrix test and the live "Normal card on CLI" dual-era test (RED first)
- [ ] 289-02-PLAN.md -- Wave 0: the ledger consume-after-checks test (owner-after-stranger, refusal then ratify, concurrency, the 369-07 text rule) and the recommended-id contract test (found by value, printed JSON path, live daemon rehearsal) (RED first)
- [ ] 289-03-PLAN.md -- Wave 0: the elicitation default test (instruction title, SDK safeParse, live non-Claude host arm) and the bare-text chooser fence with its two-entry allow-list (RED first)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 289-04-PLAN.md -- gate-render.cjs: one shared detectGateCapabilities (card on every Claude host, rung (a) kept for recognized non-Claude hosts), the recommended id on rungs (b) and (c), the real option count, the elicitation default and instruction title; test-365 D4 re-pinned
- [ ] 289-05-PLAN.md -- ledger: peekGate, consumeGate checks the session before its one delete, gate_answer and the chain resume consume only after every check; the four burn-pinning tests flipped with replay-after-success arms
- [ ] 289-06-PLAN.md -- /mos:pipeline chain selection and resume as F.1 cards with the --list floor, find-analogies Step 6 card, test-192 Assertion B healed; mirrors regenerated

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 289-07-PLAN.md -- the five capability copies delegate to the shared ruling, gate.cjs ruling comments rewritten, the 267 arms flipped, the research recommended passthrough, 289-CLI-CARD-RULING.md naming the passing dual-era test
- [ ] 289-08-PLAN.md -- radar, deck, new-project and skill choosers as cards with text floors; the full bare-text fence green; mirrors regenerated

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 289-09-PLAN.md -- close-out: run-all-289 and the regression set, VALIDATION flipped to measured status, SEED-020 resolved to the shipped scope, the Theo handoff note in the phase dir, the requirements close-out block for the orchestrator
```

---

## Part B - `.planning/REQUIREMENTS.md`

### B1. New section

Insert this section immediately before the `## Traceability` heading (that is, after the last row of whichever phase section currently sits last; the file appends phase blocks in plan-time order, following the Phase 365 / 366 / 369 / 364 precedent). Anchor on the heading text, not on any requirement ID, because other sessions keep appending rows.

```
### Phase 289 - SEED-020 Shape F card as the universal chooser, plus the SEED-104 gate defects (CARD289, LEDGER289, CONTRACT289, ELICIT289, MENU289, VAL289, CLOSE289 families) (minted at plan time 2026-10-03)

These 22 IDs were minted in the Phase 289 plan set (2026-10-03) from `289-RESEARCH.md`'s suggested families (CARD289-01..05, LEDGER289-01..05, CONTRACT289-01..04, ELICIT289-01..02, MENU289-01..03), plus CARD289-06 (the non-Claude host clause the navigator chose on 2026-10-03, D-02), VAL289-01 (the Wave 0 verification floor, which has no research ID; the TS369-07 and EPV366-01 precedent) and CLOSE289-01 (the D-08 seed and Theo-handoff close-out, which has no research ID), as amended by the locked decisions D-01..D-09 in `289-CONTEXT.md`. All are registered here at plan time as `- [ ]` rows, to be closed with measured proof, or left open with a stated reason, at phase close by `289-09-PLAN.md` (it hands the orchestrator the close-out block). Phase 369 plans 26 and 27 probe CARD289-02/03, LEDGER289-03/05 and CONTRACT289-02 through `tests/test-369-289-precondition.cjs`.

- [ ] **CARD289-01**: One shared capability function, `detectGateCapabilities(server, ctx)` in `lib/mcp/gate-render.cjs`, returns `{ elicitation, elicitation_declared, claudeCode }`; on a Claude host surface (cli, desktop, cowork; the server cannot tell CLI from Desktop) the gate renders the AskUserQuestion rung (b) on both protocol eras even when elicitation is declared or envelope-seeded; the five copies (gate.cjs, research.cjs, chain.cjs, sensors.cjs, stop-gate.cjs) are one-line delegates; `pickRenderer` and test-198:35 are unchanged (D-03). Plans 289-01, 289-04, 289-07.
- [ ] **CARD289-02**: The live dual-era test `tests/test-289-cli-card-dual-era.cjs`, the only Phase 289 test containing the literal "Normal card on CLI", passes with three legs: stdio era 2025 (cli and desktop surfaces), stdio era 2026, and the flag-ON HTTP daemon with a 2026 client declaring elicitation (plus a legacy client on the same daemon), each with zero elicitation requests and the askuserquestion renderer (D-03). Plans 289-01, 289-07.
- [ ] **CARD289-03**: `.planning/phases/289-*/289-CLI-CARD-RULING.md` (`git add -f`) carries one `Ruling:` line naming `tests/test-289-cli-card-dual-era.cjs`, which exits 0, states the canon tension (the F.8 envelope on single-select ranked slates) and what did not change (ROADMAP item e). Plan 289-07.
- [ ] **CARD289-04**: The 2026-09-23 ruling comments in `lib/mcp/tools/gate.cjs` (lines 2-15 and 304-318) are rewritten to the 2026-10-02 ruling while keeping the literal "2.1.280"; test-267-mcpv2-dual-era's era-2025 elicitation arm and test-267-mcpv2-gate-premise's behaviour arm are flipped; test-365-acceptance-floor's rung (a) reports a non-Claude client (D-03). Plan 289-07.
- [ ] **CARD289-05**: The rung (b) AskUserQuestion imperative names the real option count (`with the N options above`, marker `verbs=N`), fixed in the gate layer with the shared selector-dispatcher untouched (D-07). Plans 289-02, 289-04.
- [ ] **CARD289-06**: A recognized non-Claude host (a `detectHostTier` host other than unknown, claude-code and claude-desktop) that declares elicitation keeps rung (a); a Claude host never does; elicitation stays reachable in production and tested (D-02). Plans 289-01, 289-04, 289-07.
- [ ] **LEDGER289-01**: `consumeGate` checks the session before its one `_ledger.delete(` (kept literal, inside consumeGate, after the `session_mismatch` comparison, exactly two parameters), so a refused stranger never deletes the owner's entry (D-04; ROADMAP item c). Plans 289-02, 289-05.
- [ ] **LEDGER289-02**: `peekGate(gateId, sessionId)` is a non-consuming read with the same TTL and session contract, under the exact name Phase 369 plan 26 expects (D-04). Plans 289-02, 289-05.
- [ ] **LEDGER289-03**: `gate_answer` peeks, runs every refusal (session, chosen option, resume owner, bound room, room db), then consumes immediately before its first write, with no await between the peek and the consume; two concurrent answers ratify exactly once (D-04). Plans 289-02, 289-05.
- [ ] **LEDGER289-04**: `chain_run`'s resume (`_resumeFromGateAnswer`) gets the same discipline in the same plan: a session mismatch or an out-of-card chosen value is refused without consuming (D-04). Plan 289-05.
- [ ] **LEDGER289-05**: The owner-after-stranger arm lands in `tests/test-238-session-scoped-ledger.cjs` (ROADMAP item f); the four tests that pinned the burn are flipped (test-238-session-scoped-ledger Case 3, test-238-chosen-validation case 5, test-238-chain-chosen-validation Case 5, test-354-concurrency-surfaces K3), each with a replay-after-success arm; the residual (a write that throws after the consume still loses the gate) is assigned to Phase 369 plan 26 (D-04). Plan 289-05.
- [ ] **CONTRACT289-01**: `normalizeCard` derives `recommended`: the first option flagged `recommended: true`, else the lowest finite rank (rank 1 is the top, pinned by test; ties in input order), else null (D-05). Plans 289-02, 289-04.
- [ ] **CONTRACT289-02**: Rung (b) single-select sets `rendered.contract.recommended` to the option id and every `superset_options` row carries a `recommended` boolean; multi-select keeps `contract.recommended` null (Canon Appendix D entry 32); the F.8 renderer and its test are untouched; the `gate_render` input schema is unchanged (267 wire snapshot); the JSON path is found by value and printed by `tests/test-289-contract-recommended.cjs` (D-05). Plans 289-02, 289-04.
- [ ] **CONTRACT289-03**: Rung (c) sets the same `contract.recommended` and marks the recommended option's body line with ` (recommended)`, single-select only (D-05). Plans 289-02, 289-04.
- [ ] **CONTRACT289-04**: `lib/mcp/tools/research.cjs` passes the planner's `recommended` flag through to the grant, deep_plan and filing-basket gate cards, so a research grant card's `rendered.contract.recommended` is the planner's recommended option (D-05). Plans 289-02, 289-07.
- [ ] **ELICIT289-01**: Wherever elicitation survives, the requestedSchema `default` is the recommended id (single-select) or the explicitly flagged ids (multi-select), the field title is an instruction (`Choose: ...`, `Choose one or more: ...`, capped at 120 characters), and both shapes pass SDK 2.1.0 `safeParse` (ROADMAP item b). Plans 289-03, 289-04.
- [ ] **ELICIT289-02**: Elicitation fires only where the ruling allows, proven live: a recognized non-Claude host declaring elicitation gets exactly one defaulted dialog; an unknown client on the same Claude surface gets the card (D-02). Plans 289-03, 289-07.
- [ ] **MENU289-01**: `/mos:pipeline` chain selection (and its resume offer) is a live F.1 AskUserQuestion card with AskUserQuestion in allowed-tools, the `--list` text floor, `Do not auto-select.` kept and a chain-select F.1 gate stage in hitl_stages; the soft gaps radar.md:104 and deck.md:67 and the further choosers in find-analogies, new-project and skill are converted with text floors; every touched surface keeps its CIRS declaration (D-06). Plans 289-06, 289-08.
- [ ] **MENU289-02**: `tests/test-192-menu-sweep-live-selectors.cjs` Assertion B is healed to the shipped 3-card, 11-family help contract (RED since 28f95106b, not a Phase 289 regression) (D-06). Plan 289-06.
- [ ] **MENU289-03**: A bare-text chooser fence, `tests/test-289-menu-fence.cjs`, scans every `commands/*.md` with a substring-matched, reasoned allow-list (`tests/fixtures/289/menu-fence-allowlist.json`) and fails on an unlisted chooser or a stale entry; green over the whole command surface at close (D-06). Plans 289-03, 289-08.
- [ ] **VAL289-01**: The phase verification floor: `tests/run-all-289.sh` written once with every leg pre-declared `run_if`, exit 77 = ENV GAP never a pass, `run_known_if` for the one pre-existing red it does not own (test-237), the live dual-era leg last, a closing `run_if` leg for `tests/test-369-289-precondition.cjs`, a long-dash guard; green at close with the dual-era leg run. Plans 289-01, 289-09.
- [ ] **CLOSE289-01**: Close-out per D-08: SEED-020 (shape-f file) status resolved with the shipped scope (help 9a18fe81d and 28f95106b, Phase 192, Phase 289) and the canon note recorded as an open navigator item (Part 6); a Theo handoff note in the phase dir naming gate-render.ts:38 and 106 (no Theo edit); `289-VALIDATION.md` flipped to measured status; the requirements close-out block handed to the orchestrator. Plan 289-09.
```

### B2. `## Traceability`

Inside `## Traceability`, after the last line that begins with `Also ` (the block of per-phase registration notes; anchor on that pattern, not on a specific phase's line), add:

```
Also CARD289-01..06, LEDGER289-01..05, CONTRACT289-01..04, ELICIT289-01..02, MENU289-01..03, VAL289-01, CLOSE289-01 (Phase 289, 22 IDs, registered at plan time 2026-10-03, all [ ] until 289-09).
```

If the orchestrator maintains the active-requirements total at the top of `## Traceability`, it grows by 22.

---

## Part C - What the orchestrator should know when applying

- D-01 is honored here, not in code: the `**Depends on:**` line above is the whole of D-01's implementation. Plan 289-09 only reads the applied line and reports a mismatch.
- Requirement IDs in the plans' `requirements:` frontmatter match this list exactly (22 IDs; every ID appears in at least one plan).
- `.planning/` is gitignored with force-tracked files: every new phase-dir file is committed with `git add -f`, and the orchestrator commits these shared-file edits with `git commit --only` naming only ROADMAP.md and REQUIREMENTS.md.
