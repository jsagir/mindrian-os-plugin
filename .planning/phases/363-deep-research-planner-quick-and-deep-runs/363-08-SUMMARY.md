---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 08
subsystem: research-planner
tags: [query-families, composer, part-8, audit, q-hash, research-planner]

requires:
  - phase: 363-01
    provides: research-planner folder and test hygiene
  - phase: 363-06
    provides: lens ids and falsifier template ids the LENS_FAMILY map covers
provides:
  - lib/core/research-planner/families.cjs - the only source of outbound research query strings; five frozen families, typed slots, per-slot and per-string audit, sha256 q_hash, no-echo refusals
  - tests/test-363-families.cjs - 11 legs (F1-F11)
affects: [363-09, 363-10, 363-12, 363-13, 363-15, 363-17]

tech-stack:
  added: []
  patterns:
    - "Templates render quotes and uppercase operators; slots are typed terms, never free text"
    - "Refusal carries reason, family and template_id only (null for slot-level failures); never the slot or string"
    - "Slot values audited first in canonical order, then each composed string, through the one auditQueryString fence"

key-files:
  created:
    - lib/core/research-planner/families.cjs
    - tests/test-363-families.cjs
  modified: []

key-decisions:
  - "Default template selection skips templates whose optional slot is absent (ws.synonym_cover without synonyms, ce.pair without term2); requesting one by id without its slot is bad_slot."
  - "A composed string over 200 chars or containing a newline is bad_slot (slot-rule failure), not egress_violation."
  - "Slot-level failures (bad_slot shape, egress on a slot) return template_id null; string-level failures name the template id."
  - "composeForLeaf round 1 uses the lens template set, round 2 only that lens's falsifier follow-ups (possibly zero queries, still ok:true)."
  - "isRawQueryEdit treats keys q, query, query_string, raw_query as a raw string edit; any other shape is not."

requirements-completed: [DRP363-03]

duration: ~25min
completed: 2026-09-29
---

# Phase 363 Plan 08: Query-Family Composer Summary

One audited composer makes every outbound research string from five frozen template families and typed slots, hashes it with sha256, and refuses without echo.

PLAN_BASE: f0c76c25554b6f0c4ad4eda6f17336fd005e283c

## What was built

`families.cjs` exports `FAMILIES, SLOT_RULES, LENS_FAMILY, composeFamily, composeForLeaf, qHash, slotTerms, isRawQueryEdit`. It requires the shipped `auditQueryString` (called per slot value, then per composed string, surface `research-planner`) and `MAX_QUERY_CHARS` from `lane-queries.cjs` (reused, not copied). It has no fs, network, clock or brain-client.

Slot rules: a term is 2 to 80 chars trimmed, with no double quote, tab, newline, parenthesis, backslash, or standalone AND/OR/NOT token (any case). Synonyms are 1 to 3 distinct terms. Unknown slot keys and missing required slots are `bad_slot`.

## Template ids and roles (stable API for grants and audit records)

| Family | Template id | Role | Slots |
|--------|-------------|------|-------|
| whitespace-gap/v1 | ws.exact | primary | term |
| whitespace-gap/v1 | ws.synonym_cover | falsifier_covered_elsewhere | term, synonyms (1-3) |
| whitespace-gap/v1 | ws.prior_attempts | falsifier_tried_before | term |
| whitespace-gap/v1 | ws.absence_reason | context | term |
| concept-evidence/v1 | ce.exact | primary | term |
| concept-evidence/v1 | ce.counter | falsifier | term |
| concept-evidence/v1 | ce.prior_success | prior | term |
| concept-evidence/v1 | ce.alternative | alternative | term |
| concept-evidence/v1 | ce.pair | pair | term, term2 |
| causal-link/v1 | cl.link | primary | cause, effect |
| causal-link/v1 | cl.break | falsifier | cause, effect |
| constraint-interrogation/v1 | ci.derivation | derivation | limiter |
| constraint-interrogation/v1 | ci.retest | retest | limiter |
| constraint-interrogation/v1 | ci.scurve | scurve | limiter |
| constraint-interrogation/v1 | ci.prior_attack | prior | limiter |
| diffusion/v1 | df.adoption | first_adopters | technology |
| diffusion/v1 | df.capacity | absorptive_capacity | technology |
| diffusion/v1 | df.dualuse | civil_defense_crossing | technology |
| diffusion/v1 | df.timing | timing | technology |

Wording is a disclosed default, tuned against replay fixtures in 363-20.

## Commits

- 40a635594 test(363-08): failing query-family composer legs (RED, 0/11)
- 195934fba feat(363-08): audited query-family composer, five families (D-04, D-18, D-19, Part 8) (GREEN, 11/11)

Both are ancestors of HEAD.

## Verification

`node tests/test-363-families.cjs` exits 0, F1-F11 PASS. `grep -c auditQueryString` is 3; no fs/http require in the module; no em or en dash in either file.

## Deviations from Plan

None - plan executed exactly as written. (Additive: `LENS_FAMILY` is exported so callers and tests can read the lens map; the plan named the map but not the export.)

## Downstream contract notes

- `composeFamily(familyId, slots, {templateIds, auditFn, round})` -> `{ok:true, family, queries:[{template_id, family, role, q, q_hash, audit:'pass', round, slot_terms}]}` or `{ok:false, degrade:'local-only', reason, family, template_id}`. Reasons: `unknown_family`, `unknown_template`, `bad_slot`, `egress_violation`, plus `unknown_lens` from composeForLeaf. The shape matches what 363-05 `applyEdit`'s `recompose` expects (`recompose({leaf})` can wrap `composeForLeaf(leaf, {round})`; lowercase reasons map to recompose_refused / local-only).
- `composeForLeaf({lens, slots}, {round})` returns `lens` on success; round 2 may return `queries: []` with ok true (no falsifier follow-up for that lens). Slots use the family's names: ws.* and mu.* and hat.* take `term` (ws.* also optional `synonyms`); rc.* take `cause` and `effect`; ci.* take `limiter`; df.* take `technology`.
- 363-09 grant: cover by `template_id` and `family` (whitespace-gap/v1 only for a standing grant); use `slotTerms(queries)` for the first-new-term ask (D-10); use `isRawQueryEdit(edit)` to refuse hand-typed strings.
- `qHash(q)` is the single hash routine; recompute it from the exact `q` bytes for audit records.
- `MAX_QUERY_CHARS` is 200; a longer composed string is `bad_slot`.

## Known Stubs

None.

## Threat Flags

None. The module has no network, file or auth surface; T-363-01, T-363-04 and T-363-31 are mitigated as planned (typed slots and per-string audit, raw-string refusal with deterministic hash, no-echo refusals).

## Self-Check: PASSED

Files present: lib/core/research-planner/families.cjs, tests/test-363-families.cjs. Commits 40a635594 and 195934fba found in history.
