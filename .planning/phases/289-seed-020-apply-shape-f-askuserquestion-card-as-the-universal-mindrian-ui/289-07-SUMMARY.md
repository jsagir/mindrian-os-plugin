---
phase: 289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui
plan: 07
subsystem: mcp-gate
tags: [capability-ladder, normal-card-on-cli, delegation, ruling-artifact, research-passthrough, d-02, d-03, d-05]
requires: [289-01, 289-04, 289-05]
provides:
  - "five one-line detectClientCapabilities delegates to gateRender.detectGateCapabilities (gate, research, chain, sensors, stop-gate)"
  - "research.cjs recommended passthrough on grant, deep_plan and filing cards; _internal.grantOptions"
  - "289-CLI-CARD-RULING.md, the artifact Phase 369 probe part 3 reads"
affects: [289-08, 289-09, 369-26, 369-27]
tech-stack:
  added: []
  patterns: ["one shared ruling function, tool-module copies reduced to named one-line delegates"]
key-files:
  created:
    - .planning/phases/289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui/289-CLI-CARD-RULING.md
  modified:
    - lib/mcp/tools/gate.cjs
    - lib/mcp/tools/research.cjs
    - lib/mcp/tools/chain.cjs
    - lib/mcp/tools/sensors.cjs
    - lib/mcp/tools/stop-gate.cjs
    - tests/test-267-mcpv2-gate-premise.cjs
    - tests/test-267-mcpv2-dual-era.cjs
    - tests/test-365-acceptance-floor.cjs
    - tests/test-365-never-do-gate.cjs
key-decisions:
  - "GATE_BASE in test-365-never-do-gate is a git commit sha (not a byte hash); re-pinned once to the commit carrying the final gate.cjs, 40116b9a1b, after the last gate.cjs edit; registration-parity arms stayed green"
  - "The non-Claude fake servers in test-267 gate-premise (r4) and test-365 acceptance-floor (rung a) carry getClientVersion on the INNER server.server object, because detectGateCapabilities reads server.server.getClientVersion()"
requirements-completed: [CARD289-01, CARD289-02, CARD289-03, CARD289-04, CARD289-06, CONTRACT289-04, ELICIT289-02]
duration: 45 min
completed: 2026-10-04
---

# Phase 289 Plan 07: the card ruling goes live on all five gate surfaces Summary

The five tool-module copies of the capability read are now one-line delegates to plan 04's shared `detectGateCapabilities`, so every Claude host surface renders the AskUserQuestion card on both protocol eras even when the client declares elicitation; the research planner's `recommended` flag reaches its gate cards; and the ruling is written down naming the passing dual-era test.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | flip the three old-ladder tests (tests first) | 24e9f9640 | tests/test-267-mcpv2-gate-premise.cjs, tests/test-267-mcpv2-dual-era.cjs, tests/test-365-acceptance-floor.cjs |
| 2 | five delegates, ruling comments, research passthrough | 40116b9a1 | lib/mcp/tools/{gate,research,chain,sensors,stop-gate}.cjs |
| 2b | GATE_BASE re-pinned once (task instruction c) | 3b6a02c82 | tests/test-365-never-do-gate.cjs |
| 3 | 289-CLI-CARD-RULING.md | 9b222f551 | .planning/phases/289-*/289-CLI-CARD-RULING.md |

## What was built

- Delegates: each of the five files keeps the name `detectClientCapabilities` with body `return gateRender.detectGateCapabilities(server, ctx);` and no local `CLAUDE_HOST_SURFACES` literal or `getClientCapabilities` call. stop-gate.cjs gained `require('../gate-render.cjs')`. No caller changed: the existing `elicitation && elicitInput` guards now stay false on a Claude host by themselves. `_internal.detectClientCapabilities` is exported from every module.
- gate.cjs: header comment and the doc block above the delegate are rewritten to the 2026-10-02 ruling (literals `2.1.280` and `elicitation` kept; "do not declare" phrases absent); the 2026-09-23 "let elicitation take over on CLI" ruling is named as superseded.
- research.cjs: `recommended: o.recommended === true` on `grantOptions` and the deep_plan options map, `recommended: it.default_on === true` on the filing basket options, `grantOptions` exported on `_internal`.
- Flipped tests: gate-premise r1 now pins `elicitation:false, elicitation_declared:true, claudeCode:true`, plus a new r4 (Visual Studio Code keeps `elicitation:true`); dual-era era-2025 arm now expects zero requests, renderer askuserquestion and the card's gate_id (header bullets and label updated; the phrase "Normal card on CLI" is not in that file); acceptance-floor rung a reports clientInfo Visual Studio Code so it keeps rung (a) before and after.

## Dual-era leg table (tests/test-289-cli-card-dual-era.cjs, 2026-10-04, PASS=6 FAIL=0)

| Leg | Negotiated | Elicitation requests | Renderer |
|-----|-----------|----------------------|----------|
| stdio 2025, CLAUDE_SURFACE=cli | 2025-11-25 | 0 | askuserquestion |
| stdio 2025, default hermetic (desktop) | 2025-11-25 | 0 | askuserquestion |
| stdio 2026 | 2026-07-28 | 0 | askuserquestion |
| HTTP daemon, 2026 client | 2026-07-28 | 0 | askuserquestion |
| HTTP daemon, legacy-mode client | 2025-11-25 | 0 | askuserquestion |
| hygiene | n/a | n/a | no leaked server process |

Before: PASS=2 FAIL=4 (289-01). The HTTP 2026 leg that returned `render_failed` now renders the card.

## Verification results

- Flipped to green: test-289-capability-ruling (all arms), test-289-cli-card-dual-era (6/6), test-289-elicit-default (13/13, live some-new-client case now the card), test-289-contract-recommended unit + research (20/20), test-365-never-do-gate (75/0 after the single re-pin; it was 74/1 on N12 at baseline).
- Green, same as baseline: test-267-mcpv2-gate-premise (5/1 after Task 1 as designed, then 0), test-267-mcpv2-dual-era (wire snapshot comparison passes; 5/0), test-365-acceptance-floor, test-198-gate-renderers, test-198-local-only, test-363-mcp-tool.
- Tool honesty regression: baseline before the edit test-276 exit 0 and `check-tool-honesty.cjs --check` exit 0; after the edit both exit 0. No registerTool, no tool `description:` or inputSchema moved, so the fixture was not re-frozen (D-09 not triggered). Note: the plan's literal diff grep `^[-+].*(description:|inputSchema|registerTool)` is not empty, because it matches the three research.cjs card-option lines the plan told me to extend; those `description:` are per-option card fields (`'Recommended'`, `'On by default'`), not tool descriptions.
- `bash tests/run-all-289.sh`: PASSED=40 FAILED=1 SKIPPED=1 KNOWN=1. The CARD289-02 dual-era leg PASSED. SKIPPED is the 369 precondition probe (lands with 369 plan 26). KNOWN is test-237 (pre-existing MUTATION could not build the mutated copy).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] GATE_BASE re-pin in a file the plan does not name**
- **Found during:** Task 2 (N12 red since 289-05, flagged in 289-05 SUMMARY; the invoking instruction directed a single re-pin after the last gate.cjs edit)
- **Fix:** one-line re-pin of `GATE_BASE` in tests/test-365-never-do-gate.cjs to the full sha of 40116b9a1 with a dated comment; registration-parity arms stay green (75 PASS, 0 FAIL).
- **Commit:** 3b6a02c82

Otherwise none: plan executed as written.

## Deferred Issues (out of scope, not mine)

**`289 menu fence (MENU289-03)` leg of run-all-289 is red (PASS=16 FAIL=1).** `hits=11 passed=4 allow_listed=2 failures=5`: unlisted bare-text choosers in commands/deck.md:67, commands/new-project.md:98, commands/radar.md:104, commands/scientific-roadmap.md:143, commands/skill.md:75. None of these files is in plan 07's scope; scientific-roadmap.md is a Phase 364 command that landed after Phase 289 was planned (3a1c9b660, 1d2526a99). Needs an allow-list entry or a selector conversion in plan 06's follow-up or the orchestrator's call. Not fixed here (scope boundary).

## Open navigator item (recorded, not ruled)

Research Assumption A5 (289-RESEARCH.md line 422): is a rank-derived recommendation outside the Canon 0.70 Brain-confidence rule for F.1 Mode A (docs/MINDRIAN-CANON.md line 189)? Copied from the 289-04 SUMMARY into 289-CLI-CARD-RULING.md under "Open navigator items"; not ruled here.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or file access. T-289-07-01 (five delegates, source arm proves no leftover copy), -03 (`recommended` is card data only; resumeFn still requires an approving `chosen`), -04 (ruling file written after the named test exited 0, dual-era test is the only test path on the Ruling line and first in the file), -05 (no tool surface moved) and -06 (test-198-local-only green) hold.

## Notes for downstream plans

- gate.cjs was edited in 289-05 and here; the GATE_BASE pin is `40116b9a1b...`. Any later gate.cjs edit (including a peer's Phase 369 edit) must re-pin it again.
- Pids: only test-spawned servers were used; the three foreign `mindrian-mcp-server` PIDs were not touched.
- STATE.md, ROADMAP.md and REQUIREMENTS.md untouched, per D-09 and the orchestrator's instruction.

## Self-Check: PASSED

- 289-CLI-CARD-RULING.md exists and is tracked; its Ruling line names tests/test-289-cli-card-dual-era.cjs (first test path in the file).
- Commits 24e9f9640, 40116b9a1, 3b6a02c82, 9b222f551 are on main (verified with git log).
- No em-dash or en-dash in any changed file.
