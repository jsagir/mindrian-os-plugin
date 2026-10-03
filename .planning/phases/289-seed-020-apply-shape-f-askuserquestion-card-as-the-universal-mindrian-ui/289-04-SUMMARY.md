---
phase: 289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui
plan: 04
subsystem: mcp-gate
tags: [gate-render, capability-ladder, contract, recommended-id, elicitation, d-02, d-03, d-05, d-07]
requires: [289-01, 289-02, 289-03]
provides:
  - "detectGateCapabilities(server, ctx) and CLAUDE_HOST_SURFACES exported from lib/mcp/gate-render.cjs: the one shared capability ruling (D-03, D-02)"
  - "card.recommended derived in normalizeCard; rendered.contract.recommended on rungs (b) and (c) (single-select only); superset_options[].recommended; contract.verbs on rung (b)"
  - "elicitation requestedSchema default and instruction title (ELICIT289-01)"
affects: [289-05, 289-07, 289-08, 289-09, 369-26, 369-27]
tech-stack:
  added: []
  patterns: ["gate-layer overrides on the F.8 contract (as multiSelect already is), renderer file untouched"]
key-files:
  created: []
  modified:
    - lib/mcp/gate-render.cjs
    - tests/test-365-floor-notice.cjs
    - tests/test-265-gate-render-elicit-schema.cjs
key-decisions:
  - "Ruling is keyed on a Claude host surface, never on surface === 'cli'; a recognized non-Claude host (detectHostTier host not unknown, claude-code or claude-desktop) that declares elicitation keeps rung (a)"
  - "The card header does NOT move into the elicitation field description (test-198 line 70 pins description undefined and the message already begins with the header); deviation from 289-RESEARCH.md Q4, recorded in the code comment"
  - "A multi-select basket never preselects by rank: default and the superset row flag come only from explicit recommended:true"
requirements-completed: [CARD289-01, CARD289-05, CARD289-06, CONTRACT289-01, CONTRACT289-02, CONTRACT289-03, ELICIT289-01]
duration: 40 min
completed: 2026-10-04
---

# Phase 289 Plan 04: gate-render capability ruling, recommended id, elicitation default Summary

Every Phase 289 change that lives in `lib/mcp/gate-render.cjs` is in: one shared `detectGateCapabilities` that gives a Claude host surface the Normal card even when elicitation is declared, a recommended option id at `rendered.contract.recommended` with the real option count in the card imperative, and an elicitation field that opens on the recommended option under an instruction title.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | detectGateCapabilities, the one shared capability ruling | c2ff3a552 | lib/mcp/gate-render.cjs |
| 2 | recommended option id on the contract and the real option count | 501406256 | lib/mcp/gate-render.cjs, tests/test-365-floor-notice.cjs |
| 3 | elicitation default and instruction title | ace9575ec | lib/mcp/gate-render.cjs, tests/test-265-gate-render-elicit-schema.cjs, tests/test-365-floor-notice.cjs |

## What was built

- `detectGateCapabilities` returns exactly `{ elicitation, elicitation_declared, claudeCode }`. `elicitation = declared AND (NOT claudeSurface OR nonClaudeHost)`; `claudeCode = claudeSurface AND NOT elicitation`. Guarded for a null server, a missing function and a throw on either read. `pickRenderer` is byte-unchanged (the diff is insertions only). The ruling comment records the 2026-10-02 navigator ruling, the SDK HTTP backfill, and why the rule is not `surface === 'cli'`.
- `normalizeCard` derives `recommended`: first option flagged `recommended: true`, else the lowest finite rank (rank 1 top, ties keep input order), else null; a normalized option carries `recommended: true` only when its input did.
- Rung (b): `contract.recommended` is the card id for single-select and null for multi-select; every `superset_options` row carries a boolean (single: `id === card.recommended`; multi: explicit flag only); `contract.verbs` is set from the option labels before the trailer counts them, so the imperative reads `with the N options above` and the marker `verbs=N`. `lib/hmi/shape-f8-renderer.cjs`, its test and `selector-dispatcher.cjs` are untouched (`git diff --stat -- lib/hmi` empty).
- Rung (c): `contract.recommended` the same way; the recommended option's body line ends ` (recommended)` for single-select only.
- Rung (a): `MAX_ELICIT_TITLE_CHARS = 120` and `_capTitle` (117 chars plus `...`); single-select title `Choose: A / B` with `default` = recommended id when non-null; multi-select title `Choose one or more: A / B` with `default` = explicitly flagged ids in option order when any. No field description.
- test-265 gained a `defaulted-schema` arm (ranked single-select, flagged multi-select, both safeParsed against the SDK titled enum schemas).

## Printed JSON path

`recommended id JSON path: rendered.contract.recommended` (printed by `node tests/test-289-contract-recommended.cjs --arm unit`, and again by `--arm live`).

## test-365 D4 re-pin: keys that moved per digest

The six payloads were captured to the scratchpad before the edit and diffed after each task.

| Digest | Keys that moved | New sha256 |
|--------|-----------------|------------|
| plain-a | `rendered.requestedSchema.properties.choice.title` and `cap[0].requestedSchema.properties.choice.title` ("Approve this claim?" to "Choose: Approve / Reject / Defer"); no `default` (plain has no rank) | 7d97aacce459a9483a9f01c520ff1290fec484f645884ef110aaf6b3fd31e0e1 |
| plain-b | `rendered.contract.superset_options[0..2].recommended` (false), `rendered.contract.verbs` (the three labels), `askuserquestion_marker` (verbs=0 to verbs=3), `askuserquestion_binding` and `zones.footer` (0 options above to 3) | c7cb85885f2cc7f9ceeecf3a1c3c3f5f6fdbbd171df59d3f2ed921ad51194e9f |
| rich-a | `rendered.requestedSchema.properties.choices.title` and `cap[0]...choices.title` ("Pick two" to "Choose one or more: Alpha / Beta / Approve"); no `default` (multi, no explicit flag) | 9fe6ceba6eaf8e91b9193e79ee476e3b688fc120046b1374b87d94ca7427736f |
| rich-b | the same five keys as plain-b | 45986151b0075e6e09e06addbf4049294d303f342adfe69be2204d4d78e0949c |
| plain-c | none, byte-identical | unchanged |
| rich-c | none, byte-identical | unchanged |

No other key moved on any payload. A dated comment above `PINNED` records the re-pin.

## Verification results

- `test-289-capability-ruling.cjs --arm ruling-matrix`: PASS=35 FAIL=0. (`delegates` and `source` arms stay red until plan 07, as planned.)
- `test-289-contract-recommended.cjs --arm unit`: PASS=17 FAIL=0. `--arm live`: PASS=3 FAIL=0 (exit 0, no ENV GAP), by-value finder found exactly `rendered.contract.recommended` with value `opt-top` on the hermetic flag-ON daemon. `--arm research` remains red: it needs `_internal.grantOptions` exported from `lib/mcp/tools/research.cjs`, which this plan may not edit (plan 05 or 07).
- `test-289-elicit-default.cjs --arm unit`: PASS=11 FAIL=0. `--arm live`: PASS=1 FAIL=1. The recognized non-Claude host case (Visual Studio Code) now passes, one dialog opening on the default. The unknown-client case ("some-new-client") still sees one elicitation request because `lib/mcp/tools/gate.cjs` still carries its own copy of the old ruling; plan 07 delegates it to `detectGateCapabilities`.
- `test-289-cli-card-dual-era.cjs`: PASS=2 FAIL=4, same four legs as the wave-1 measurement, all closed only when plan 07 wires the five tool delegations.
- Green and unchanged: test-198-gate-renderers, shape-f8-renderer.test, test-265, test-365-floor-notice, test-189, test-210, test-h27, test-365-never-do-gate, test-198-local-only, test-241 parity, test-276 tool-honesty-findings-closed, `check-tool-honesty.cjs --check` (both honesty gates were green before the first edit and after the last; no tool surface moved, no registerTool, no description change, so no re-freeze).
- No Part 8 forbidden token in gate-render.cjs; no em-dash or en-dash in any changed file.

## Deviations from Plan

None - plan executed as written. One recorded departure from research, not from the plan: the card header stays in the elicitation message, not in a field `description` (see key-decisions).

## Open navigator item (recorded, not ruled)

**Research Assumption A5 (289-RESEARCH.md line 422):** is a rank-derived recommendation outside the Canon 0.70 Brain-confidence rule for F.1 Mode A (docs/MINDRIAN-CANON.md line 189)? D-05 does not settle it. This plan derives `recommended` from an explicit flag or a rank and writes nothing in code or comments that claims a rank is exempt from that rule. Plan 07 should copy this item into the ruling file's open items.

## Known Stubs

None.

## Threat Flags

None. No new network code, endpoint or file access. T-289-04-01..06 mitigations hold: `recommended` and `default` are display data only; the id is derived from normalized options; a basket keeps `contract.recommended` null and flags only explicit rows; titles are capped at 120.

## Notes for downstream plans

- Plan 07: replace each tool copy of `detectClientCapabilities` with `detectGateCapabilities` from this module (the `lib/mcp/tools/gate.cjs` copy exports its own `CLAUDE_HOST_SURFACES` array; `gate-render.cjs` now exports a frozen one). The dual-era and elicit-default live arms and the capability `delegates`/`source` arms flip then.
- `_internal.grantOptions` on research.cjs (contract-recommended `research` arm) is still unexported.
- `lib/mcp/tools/*.cjs`, STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.

## Self-Check: PASSED

- lib/mcp/gate-render.cjs, tests/test-365-floor-notice.cjs, tests/test-265-gate-render-elicit-schema.cjs: modified and committed.
- Commits c2ff3a552, 501406256, ace9575ec: on main.
