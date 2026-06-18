---
phase: 163
plan: 05
subsystem: trending-to-absurd Stage 7 roadmap + full 4-persona x 3-path variance surface
status: complete
tags: [trending-to-absurd, visionary-innovation-companion, stage-7, mitigation-roadmap, innovation-roadmap, udp-idp-wdp, persona-variance, path-variance, shape-f-gate, hybrid-default, D-163-05, D-163-06, wave-5-surface-b, part-4, part-5, part-7, part-8, part-9]
requires:
  - lib/core/futures/orchestrator.cjs (slugify + FUTURES_DEPTH_CAP reused verbatim, Part 7)
  - lib/core/navigation.cjs (the writeEdge chokepoint -- SELECTED_REACH selection edge)
  - lib/core/trending-to-absurd/orchestrator.cjs (Wave 4 -- the 5-act pipeline Stage 7 extends; TTA_SEED_PREFIX idiom mirrored)
  - lib/core/problem-type-router.cjs (the UDP / IDP / WDP closed taxonomy reused as the Stage 7 classification enum)
  - commands/trending-to-absurd.md (Wave 4 command body the Act 0 gate + Stage 7 act wire into)
provides:
  - lib/core/trending-to-absurd/stage7-roadmap.cjs (generateStage7Roadmap -- UDP/IDP/WDP mapping + mitigation/innovation roadmap + nested-artifact filing)
  - lib/core/trending-to-absurd/variance.cjs (PERSONA_LENSES + PATH_VARIANTS + surfacePersonaPathGate + recordPersonaPathSelection)
  - commands/trending-to-absurd.md (Act 0 persona/path gate + Stage 7 roadmap act wired into the command body)
  - tests/run-all-163.sh (two new suites registered + em-dash sweep extended)
affects:
  - the v1.14.0 Visionary Innovation Companion surface -- now complete to the 7-stage spec with FULL variance
  - Phase 166 gated-chain-executor (a future runChain consumer of the complete /mos:trending-to-absurd surface)
tech-stack:
  added: []
  patterns:
    - "Part 7 reuse: slugify + FUTURES_DEPTH_CAP imported from the futures harness; UDP/IDP/WDP enum reused from the problem-type-router taxonomy; SELECTED_REACH reused from the frozen ALLOWED_EDGE_TYPES (never minted anew)"
    - "exclusive file ownership: Stage 7 files under opportunity-bank/trending-to-absurd-<seed>/stage7-roadmap/ ONLY (T-163-13); mirrors the Wave 4 TTA_SEED_PREFIX idiom"
    - "ICM Layer 0 everywhere: a ROOM.md per nested folder (the roadmap folder + the artifact folder), mirroring the futures writeRoomMd discipline (the private futures helper is re-implemented locally since it is not exported)"
    - "Part 9 proposed-not-confirmed: every roadmap step lands review_status proposed; truth-claim steps are flagged truth_claim and the generator never writes confirmed (only a human byUser promotes)"
    - "Shape F descriptor assembly mirrors the futures surfaceBridgesAtGate: LOCAL assembly only, returns a descriptor with surface/personas/paths/contexts, NEVER renders the gate itself"
    - "Part 8 enum-only edge props: recordPersonaPathSelection writes {persona, path} enums on a SELECTED_REACH edge through navigation.writeEdge; zero prose, zero Brain egress"
    - "hybrid default (D-163-05): the chosen path sets the ring depth + gate policy; Quick = auto, Full/Expert = hybrid; Expert multi_agent rides the existing Part 2 SUB-AGENT SPAWN affordance"
key-files:
  created:
    - lib/core/trending-to-absurd/stage7-roadmap.cjs
    - tests/test-trending-to-absurd-stage7.cjs
    - lib/core/trending-to-absurd/variance.cjs
    - tests/test-trending-to-absurd-variance.cjs
  modified:
    - commands/trending-to-absurd.md
    - tests/run-all-163.sh
decisions:
  - "REUSED the UDP/IDP/WDP closed taxonomy from the Phase 91-07 problem-type-router as the Stage 7 classification enum rather than minting a new one (Part 7); classifyProblemType is a LOCAL scalar heuristic over definition_clarity + confidence (Part 8, zero Brain call)"
  - "REUSED SELECTED_REACH (already in the frozen ALLOWED_EDGE_TYPES; system bookkeeping per Part 9) for the persona/path selection edge rather than minting a persona-specific edge type -- the persona/path pick IS a reach into the trending-to-absurd surface"
  - "PATH_VARIANTS.Full and .Expert use FUTURES_DEPTH_CAP for the all-rings depth (reused from the futures harness, never a new depth constant); Quick uses 1 ring"
  - "the futures writeRoomMd helper is private (not exported), so the Stage 7 generator carries the SAME ROOM.md idiom locally rather than reaching into a private symbol -- exclusive ownership + ICM Layer 0 preserved without coupling to a non-exported function"
metrics:
  duration: ~1 session (~5 min wall clock)
  completed: 2026-06-18
  tasks: 2
  files: 6
---

# Phase 163 Plan 05: Stage 7 Roadmap + Full 4-Persona x 3-Path Variance Summary

WAVE 5 SURFACE-B landed: the Visionary Innovation Companion is now complete to
the 7-stage spec with FULL variance. Stage 7 (the mitigation / innovation roadmap
absent from explore-trends's 6 stages) maps each banked opportunity to the
UDP / IDP / WDP problem-type taxonomy and emits a defend-against-the-risk
mitigation roadmap plus a seize-the-opportunity innovation roadmap, filed as a
nested artifact under opportunity-bank/ with ROOM.md per folder. The full variance
surface (D-163-06) ships all four persona lenses (Founder / Researcher / Investor
/ Analyst) and all three paths (Quick / Full / Expert), selectable at a Shape F
hybrid gate (D-163-05), with the selection recorded as graph data (a SELECTED_REACH
typed edge with enum-only props, Part 4 + Part 8).

## What shipped

### Task 1 (commit 2a5515a2) -- Stage 7 mitigation / innovation roadmap generator (TDD)

- `lib/core/trending-to-absurd/stage7-roadmap.cjs` (new):
  - `generateStage7Roadmap(roomDir, opportunities, opts)` classifies each
    opportunity into UDP / IDP / WDP (`classifyProblemType`, a LOCAL scalar
    heuristic over `definition_clarity` + `confidence`; the SAME closed taxonomy
    the Phase 91-07 problem-type-router uses, reused not minted), then builds a
    structured roadmap `{ opportunity_id, problem_type, mitigation_steps[],
    innovation_steps[] }`. Mitigation steps DEFEND against the absurd-trend risk;
    innovation steps SEIZE the disruptive opportunity, keyed to the problem type
    (UDP -> explore, IDP -> reformulate, WDP -> build + validate).
  - Each step carries an evidence tier (Part 5). The first mitigation step asserts
    a venture truth (the risk is real for THIS venture), so it is flagged
    `truth_claim: true` and lands `review_status: proposed` -- never auto-confirmed
    (Part 9 role 5; only a human byUser promotes a truth-claim to confirmed).
  - Files the roadmap as a nested Obsidian artifact under
    `opportunity-bank/trending-to-absurd-<seed>/stage7-roadmap/<artifact>/` WITH an
    ICM Layer 0 ROOM.md per folder (CLAUDE.md decisions 15 + 16; exclusive
    ownership, T-163-13). The on-disk artifact records `review_status: proposed`.
  - Defensive: empty / null / garbage opportunity input returns an empty roadmap
    and files nothing, never throws.
  - Part 8: zero Brain egress; pure LOCAL classification + file write.
- `tests/test-trending-to-absurd-stage7.cjs` (new, 4 behaviors): UDP/IDP/WDP
  mapping with non-empty mitigation + innovation steps each carrying an evidence
  tier; nested-artifact filing under opportunity-bank/ with ROOM.md and no write
  escaping the bank; truth-claim steps stay proposed (in-object AND on-disk);
  empty/null input -> empty roadmap.
- `tests/run-all-163.sh`: registered `test-trending-to-absurd-stage7.cjs` in
  `CJS_SUITES` and added the source + test to the em-dash sweep.

### Task 2 (commit d45d889c) -- the 4-persona x 3-path variance matrix + Shape F gate (TDD)

- `lib/core/trending-to-absurd/variance.cjs` (new):
  - `PERSONA_LENSES` -- frozen `['Founder', 'Researcher', 'Investor', 'Analyst']`
    (the four per D-163-06, aligned with the Canon Appendix E SME archetypes), with
    `PERSONA_FRAMING` carrying each lens's beautiful question (the framing handle
    the command body uses; a generic methodology handle, Part 8).
  - `PATH_VARIANTS` -- frozen `{ Quick:{rings:1, gate_policy:'auto'}, Full:{rings:
    FUTURES_DEPTH_CAP, gate_policy:'hybrid'}, Expert:{rings:FUTURES_DEPTH_CAP,
    gate_policy:'hybrid', multi_agent:true} }`. `FUTURES_DEPTH_CAP` is reused from
    the futures harness for the all-rings depth (never a new constant).
  - `surfacePersonaPathGate(roomDir, opts)` returns a Shape F gate descriptor
    (`surface: 'F.2'` path-control for the path choice + F.1 next-move for the
    persona) offering the four personas and three paths, with tri-context panels
    (LOCAL / BRAIN generic handle only / SIGNAL none). Mirrors the futures
    `surfaceBridgesAtGate` shape -- LOCAL assembly only, never renders the gate.
  - `recordPersonaPathSelection(db, {persona, path, focusNodeId})` writes a
    SELECTED_REACH typed edge via `navigation.writeEdge` (the chokepoint) FROM the
    focus node TO `reach:trending-to-absurd` with enum-only props `{persona, path}`
    (Part 4 the selection becomes graph data; Part 8 enum/scalar-only; Part 9
    SELECTED_REACH is system bookkeeping). Defensive: an invalid persona / path /
    focus node is rejected without writing.
  - The Expert `multi_agent` flag dispatches the economic / technological / social
    / environmental refinement sub-agents via the EXISTING Part 2 SUB-AGENT SPAWN
    affordance -- a descriptor flag, not a new mechanism.
- `commands/trending-to-absurd.md` (modified): added the full-variance surface
  doc + an Act 0 persona/path Decision Gate (fires before the trend-selection gate;
  records the selection as graph data; the chosen path sets ring depth + gate
  policy, the persona reshapes framing) + a Stage 7 act after Act 5 (calls
  `generateStage7Roadmap`, files the UDP/IDP/WDP roadmap, truth-claim steps stay
  proposed).
- `tests/test-trending-to-absurd-variance.cjs` (new, 4 behaviors): PERSONA_LENSES
  is the frozen four; PATH_VARIANTS is Quick/Full/Expert with depth + gate policy
  (Full/Expert = FUTURES_DEPTH_CAP, hybrid); surfacePersonaPathGate returns the
  Shape F descriptor; recordPersonaPathSelection writes a frozen-set typed edge
  with enum-only props (+ invalid-selection rejection).
- `tests/run-all-163.sh`: registered `test-trending-to-absurd-variance.cjs` and
  added the source + test to the em-dash sweep.

## Verification

- `node tests/test-trending-to-absurd-stage7.cjs` -> PASS (4/4).
- `node tests/test-trending-to-absurd-variance.cjs` -> PASS (4/4).
- Plan Task 2 gate: `node tests/test-...variance.cjs && node -e "...PERSONA_LENSES
  .length===4 && PATH_VARIANTS Quick/Full/Expert..."` -> VARIANCE_OK.
- `bash tests/run-all-163.sh` -> 9/9 PASS (the 5 prior suites + the 2 new suites +
  the connector-block validation + the em-dash sweep). Em-dash sweep green.
- `node scripts/build-command-registry.cjs --check` -> command-registry: OK.
- `node scripts/build-connector-registry.cjs --check` -> connector-registry: OK
  (the 8-command opt-in nudge is a pre-existing, unrelated warning, not a failure).
- Part 8 leak scan on both new files
  (`grep -rEn "fetch|brain.mindrian|onrender|tavily|INSERT INTO edges|mcp__brain"`)
  -> PART8_CLEAN_no_egress.

## Deviations from Plan

None - plan executed exactly as written. Both tasks followed the TDD RED -> GREEN
flow; no auto-fixes (Rules 1-3) were needed and no architectural decisions (Rule 4)
arose. The command frontmatter was unchanged (no new `frameworks:` or `connector:`
keys), so neither generated registry went stale -- the Wave 4 registry-staleness
deviation did not recur.

## Authentication Gates

None.

## Known Stubs

None. The Stage 7 roadmap steps are generated LOCAL content (real mitigation /
innovation templates keyed to the problem type), filed as real artifacts with real
ROOM.md identity. The persona/path gate is a real Shape F descriptor consumed by
the command body, and the selection writes a real typed edge through the
navigation chokepoint. The Expert multi-agent refinement is a documented descriptor
flag that the command body dispatches via the existing Part 2 SUB-AGENT SPAWN
affordance (not a stub -- it rides shipped machinery).

## Threat surface scan / compliance

- **T-163-13 (Stage 7 file write tampering):** `generateStage7Roadmap` pins every
  write under `opportunity-bank/trending-to-absurd-<seed>/stage7-roadmap/`. Test 2
  asserts the roadmapDir + every filed artifact start with `opportunity-bank/` and
  that nothing is written outside the bank.
- **T-163-14 (Stage 7 truth-claim elevation):** venture-truth roadmap steps land
  `review_status: proposed`; the generator never writes `confirmed` (Test 3 checks
  both the in-object steps and the on-disk artifact).
- **T-163-15 (persona/path edge + Expert sub-agents disclosure):** the
  SELECTED_REACH edge carries enum-only props `{persona, path}` (Test 4 asserts no
  `body` / `prose` field leaks); the Expert sub-agents inherit the Part 8 boundary
  of the existing SUB-AGENT SPAWN affordance.
- **T-163-SC (installs):** zero new packages (pure Node built-ins + reuse of the
  futures harness, the navigation chokepoint, and the problem-type taxonomy). No
  install task -- the RESEARCH Package Legitimacy gate is N/A.
- **Part 7 (Reuse Before Build):** slugify + FUTURES_DEPTH_CAP reused from futures;
  the UDP/IDP/WDP enum reused from the problem-type-router; SELECTED_REACH reused
  from the frozen edge vocabulary. Stage 7 + variance are the net-new ~15-20%.
- **Part 8 / Part 9:** zero Brain egress on both files; the only graph write is
  through `navigation.writeEdge` (enum-only props); truth-claims stay proposed.

## Self-Check: PASSED

- FOUND: lib/core/trending-to-absurd/stage7-roadmap.cjs
- FOUND: tests/test-trending-to-absurd-stage7.cjs
- FOUND: lib/core/trending-to-absurd/variance.cjs
- FOUND: tests/test-trending-to-absurd-variance.cjs
- FOUND (modified): commands/trending-to-absurd.md (contains Act 0 persona/path gate + Stage 7 act)
- FOUND (modified): tests/run-all-163.sh (both new suites registered)
- FOUND commit: 2a5515a2 (Task 1 -- Stage 7 roadmap)
- FOUND commit: d45d889c (Task 2 -- variance matrix + gate)
