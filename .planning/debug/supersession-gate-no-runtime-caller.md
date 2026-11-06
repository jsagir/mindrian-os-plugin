---
status: investigating
kind: rca
trigger: "supersession-gate-no-runtime-caller"
issue_id: "B12"
severity: low
surfaces: [cli]
brain_mode: full-loop
canon_parts: [9, 11]
created: 2026-11-06T07:55:00Z
updated: 2026-11-06T07:55:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` working tree of /home/jsagi/dev/MindrianOS-Plugin-release (plugin 2.0.0-beta.80), 2026-11-06
- **WIRE claims probe against:** none (no network, no Brain call)
- **Date of audit:** 2026-11-06
- **Re-verification rule:** each claim carries PROVEN (run or read in this session), UNVERIFIED or ASSUMED.

## Current Focus

hypothesis: `supersedeOnGateAnswer` has no runtime caller because Phase 348 left the trigger to Phase 350 on purpose, and Phase 350 was registered but never planned.
test: search every runtime and test tree for the symbol and the module name, classify each hit, read the Phase 348 close-out and the ROADMAP card for Phase 350.
expecting: 0 runtime callers; a Phase 350 card with 0 plans.
next_action: owner decision (keep as documented planned contract, wire as own work item, or remove).

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release
- Plugin version: 2.0.0-beta.80
- Reported by: auditor finding B12 (C3-10), an auditor hypothesis
- Date first observed: 2026-11-05
- Related debug sessions: none

## Problem Statement

lib/core/temporal/supersession-gate.cjs exports `supersedeOnGateAnswer`, and no runtime code calls it. A human gate answer on a surfaced contradiction can never close a claim as superseded through this path.

## Symptoms

<!-- IMMUTABLE once the investigation starts -->

expected (auditor view): a human gate answer on a contradiction card closes the older claim as superseded.
actual: the function is called only by tests. No MCP tool, command, agent, pipeline or hook reaches it.
errors: none.
reproduction:
  1. Search lib, scripts, hooks, bin, commands, skills, agents, pipelines and data for `supersedeOnGateAnswer` and `supersession-gate`.
  2. Classify each hit.
started: Phase 348-07 (2026-09-16) shipped the module with no caller by design (see Technical Root Cause).

## Scope and Impact

- Affected surfaces: cli, desktop, cowork equally (there is no surface that can trigger it).
- Affected commands: none.
- Affected users: all installs. The effect is a missing capability, not a failure.
- Version range: Phase 348 close (2026-09-16) to beta.80.
- Severity: low.
- Blast radius: the Phase 348 mechanism (supersede(), the human-attribution guard, the bitemporal close) is reachable only through scripts/close-loop.cjs, and that path has its own limits (see Evidence). The fleet census named in the Phase 348 close-out stayed at 0 SUPERSEDES edges.

## Eliminated

- hypothesis: a runtime caller exists under a different import form (require of the folder, dynamic require, string path).
  evidence: the search also covered the bare module name and the path fragment `temporal/supersession-gate`; every hit is a test, a doc or a planning record (PROVEN, list below).
  timestamp: 2026-11-06T07:50:00Z
- hypothesis: gate_answer already has a contradiction branch that calls it under another name.
  evidence: lib/mcp/tools/gate.cjs has no `supersed` or `contradict` token in code; the only matches are the words "superseded" in two header comments about other rulings. The approve branch calls `navigation.confirmNode` through `_promoteCardSubject` and nothing else (PROVEN by read).
  timestamp: 2026-11-06T07:52:00Z

## Evidence

- timestamp: 2026-11-06T07:50:00Z
  checked: grep for `supersedeOnGateAnswer` and `supersession-gate` in lib, scripts, hooks, bin, commands, skills, agents, pipelines, data, tests, docs, .planning/phases, .planning/quick, package.json
  found: hits by class (PROVEN):
    - Definition: lib/core/temporal/supersession-gate.cjs (export at the last line; `module.exports = { supersedeOnGateAnswer, GATE_REFUSAL_REASONS }`).
    - Runtime callers: 0.
    - Tests (call the function): tests/test-348-supersession-e2e.cjs, tests/test-348-traceability.cjs.
    - Tests (name or guard the module without calling it): tests/run-all-348.sh (leg guard and expected-red tripwire), tests/helpers/fixture-room-348.cjs (comment), tests/test-365-falsify-contradiction.cjs and tests/fixtures/365-falsification-record.json (a label string), tests/fixtures/369/writer-inventory.json (comment-only hit note).
    - Documentation and planning: docs/SUPERSESSION-CONTRACT.md (WD-348-3, section "What later plans in this phase land"), docs/2026-09-16-PHASE-348-SUPERSESSION-CLOSE-OUT.md (table row, section "Ten: What the next phase inherits"), docs/OPEN-HANDOFFS.md, .planning/ROADMAP.md (Phase 350 card), .planning/phases/369-ui-shell-.../369-INPUT.md (lines 151 and 362), .planning/phases/365-.../365-RESEARCH.md, .planning/phases/385-.../385-12-PLAN.md (item R9), this phase's plan 386-20.
  implication: the function is exercised only by 2 test files. It has no live trigger.
- timestamp: 2026-11-06T07:51:00Z
  checked: module header of lib/core/temporal/supersession-gate.cjs, section "NOT A REGISTERED INVOCABLE SURFACE (WD-348-3)"
  found: "no MCP tool, no command, no agent, no pipeline, no hook registers this function in this phase. D-01/D-02 leave the trigger to Phase 350, which registers this module together with the writer that feeds it. A registered surface with no live trigger would be a Part 11 declaration for a fork nothing can reach." (PROVEN)
  implication: the missing caller is a recorded decision, not a slip.
- timestamp: 2026-11-06T07:51:30Z
  checked: docs/2026-09-16-PHASE-348-SUPERSESSION-CLOSE-OUT.md, section "Ten: What the next phase inherits"
  found: Phase 350 "gets a gated, tested mechanism with a fixed gate-module contract ... so wiring a live CONTRADICTS writer is a wiring job rather than a design job." It names the open items: the reified-shape question, registering the gate consequence as a surface born WIRED with its own `hitl_shape` and `layer` (Part 11 R16), the human-attribution thread at close-loop-writer.cjs, and the open Phase 347 edge-chokepoint bypass as a live risk. (PROVEN)
  implication: the close-out states the open trigger and who inherits it.
- timestamp: 2026-11-06T07:52:00Z
  checked: .planning/ROADMAP.md card `### Phase 350` and `ls .planning/phases | grep ^350`
  found: the card exists. Deliverable (3) is "Register the supersession gate consequence ... as a real invocable surface, born WIRED ... reusing the shipped gate module unmodified". The card shows `Goal: [To be planned]`, `Requirements: TBD`, `Plans: 0 plans`, and there is no phases/350-* directory. (PROVEN)
  implication: the later phase meant to wire it was registered on 2026-09-16 and has not been planned in the 51 days since.
- timestamp: 2026-11-06T07:52:30Z
  checked: lib/core/intel-pipeline.cjs near line 144 (`void wirer;`) and a search for runtime writers of the `CONTRADICTS` edge type
  found: the one CONTRADICTS writer reachable from a live pipeline (findings-wirer) is no-oped by `void wirer;`. Other writers sit in lib/workflow/memory-cascade-f9-adapter.cjs and lib/workflow/reconcile-f9-adapter.cjs (not traced for liveness here, UNVERIFIED). (PROVEN for the no-op, UNVERIFIED for the adapters)
  implication: the gate has no input edge on the main research path. A wire alone would wait on a contradiction that nothing writes. This is the same gap that Phase 350 deliverable (1) names.
- timestamp: 2026-11-06T07:53:00Z
  checked: lib/mcp/tools/gate.cjs `gate_answer` and `_promoteCardSubject`
  found: approve calls `navigation.confirmNode` on the card subject (kind general, claim, proposed). No branch reads a CONTRADICTS edge or calls supersede. A wire would need a new card kind (the pair: old node and new node) and a branch that calls `supersedeOnGateAnswer(db, {oldNodeId, newNodeId, roomDir, verdict})`. `params.byUser` is ignored by design; identity comes from `resolveByUser(roomDir)` (USER.md). (PROVEN by read)
  implication: the wire is a new gate path with its own card shape and hitl declaration. It is design work under Part 9 and Part 11, not a one-line call.
- timestamp: 2026-11-06T07:53:30Z
  checked: `node scripts/build-connector-registry.cjs --check` and a grep of data/*.json for the module name
  found: `connector-registry: OK`; the module name appears in no data/*.json file. (PROVEN)
  implication: the born-wired registry does not list the module. It is not one of the four invocable classes (command, agent, pipeline, skill), so it is neither WIRED nor EXCLUDED by declaration; it is absent. Part 11 does not require a declaration for it today. A wire that adds a surface must declare one (R16).
- timestamp: 2026-11-06T07:54:00Z
  checked: `node --no-warnings tests/test-348-supersession-e2e.cjs`
  found: 12 assertions passed, `PASSED`. The test drives the approve path, the non-approved refusal, the direct system-attribution refusal and the proposed-not-supersedable refusal. (PROVEN)
  implication: the contract is intact and tested; it is dead only in the sense of having no live trigger.
- timestamp: 2026-11-06T07:54:20Z
  checked: other runtime path to supersede(): scripts/close-loop.cjs (quick 261006-0hl) and lib/core/close-loop-writer.cjs
  found: scripts/close-loop.cjs passes `supersedeFn` bound to `navigation.resolveByUser(real)` so the BONO close-loop can supersede a confirmed prior conclusion with a human identity. It calls `supersession.supersede` directly, not the gate module. (PROVEN by read)
  implication: a separate live door to supersede() exists for BONO conclusions. The gate module is the planned door for contradiction-card answers and is not that door.
- timestamp: 2026-11-06T07:54:40Z
  checked: Phase 385 plan 12 item R9 and .planning/phases/369-ui-shell-.../369-INPUT.md
  found: plan 385-12 lists `temporal/supersession-gate` among 15 test-only modules, recommends "keep all" and asks the owner to classify each as planned-but-unwired or abandoned. 369-INPUT lines 151 and 362 record that no MCP tool reaches `supersede()` and that a UI would need a governed path to it. (PROVEN by read)
  implication: Phase 385 will ask the same question; this ruling can be reused there. The UI work names a possible future consumer.

## Technical Root Cause

- Site: lib/core/temporal/supersession-gate.cjs, function `supersedeOnGateAnswer` (and the absence of a call site in lib/mcp/tools/gate.cjs `gate_answer`).
- Cause: a deliberately deferred trigger (WD-348-3, D-01, D-02). The module ships as a pure function with no registered surface so that Part 11 does not see a surface with no live trigger. The trigger was assigned to Phase 350. Phase 350 exists only as a roadmap card with 0 plans, so the deferral has no owner and no date.
- Why it surfaces now: the second audit (B12) searched for callers. The finding is correct as a fact. It is a planned contract that stayed unwired, not a coding slip.

## Required Code Changes

None in this plan.

Description of the wiring work item, if the owner chooses it (prose only):

- Add a contradiction-pair gate card kind (old node id, new node id) and a `gate_answer` branch that calls `supersedeOnGateAnswer` only on an approve verdict. Ride the existing gate-render, gate.cjs and gate-ledger ladder; no second gate.
- Part 9 rule: only a human closes a claim as superseded. Identity comes from `resolveByUser(roomDir)`; `params.byUser` stays ignored.
- Part 11 R16: the new surface is born WIRED with its own `hitl_shape` and `layer`, and the born-wired generators (`scripts/build-connector-registry.cjs --check`) must stay green.
- Input edge: a live CONTRADICTS writer must exist first, or the card never appears (the `void wirer;` no-op in intel-pipeline.cjs and the other writers; Phase 350 deliverable 1).
- Open risk named by Phase 348: the Phase 347 edge-chokepoint bypass lets an unvalidated edge appear; `supersedeOnGateAnswer` already checks endpoints before it writes.
- Test: tests/test-348-supersession-e2e.cjs already drives the function; add an MCP-level test of the new gate branch.

## Tests to Add or Update

None in this plan.

## Non-Code Follow-ups

- CHANGELOG.md: none from this RCA.
- Release lockstep: applies only if a wire ships.
- Canon: Part 9 (human-only supersede) and Part 11 (born wired) bind any wire. Part 8: the module reads and writes local room.db only (PROVEN by header and by the absence of a brain-client require).
- Tri-Polar: a wire would work on all three surfaces through gate_answer (MCP). UNVERIFIED, nothing is built.
- Cross-platform: not applicable to a pure function.
- Phase 385 item R9 carries the same module; record the ruling there.

## Resolution

root_cause: deliberately deferred trigger (WD-348-3); the assigned later phase (Phase 350) is a card with 0 plans.
fix: none applied. Awaiting the owner decision.
verification: caller search and test run recorded in Evidence (PROVEN).
files_changed: none
commits: see git log of this file
