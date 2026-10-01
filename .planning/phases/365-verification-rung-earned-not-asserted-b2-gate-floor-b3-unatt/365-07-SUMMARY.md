---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
plan: 07
subsystem: room-constraints
tags: [b3, never-do, fail-shut, approval-trail]
requires: [365-01, 365-02, 365-03]
provides:
  - lib/core/room-constraints.cjs (never-do reader, matcher, trips, proposals, approval-trail writer)
affects: [365-09, 365-10, 365-13, 365-14, 365-15]
tech-stack:
  added: []
  patterns: [fail-shut reader with no cache, literal matching over declared fields, approval-trail writer mirroring grants.writeGrant]
key-files:
  created:
    - lib/core/room-constraints.cjs
    - tests/test-365-never-do-core.cjs
    - tests/test-365-never-do-writer.cjs
  modified: []
key-decisions:
  - "A missing never-do.json is an empty list; any other defect makes the whole file malformed and checkStep halts (D-13)"
  - "Path entries are stored normalized (POSIX, no leading ./, no trailing slash); declared fields are normalized the same way before the whole-segment prefix test"
  - "Terms dedupe after trim and lowercase, the same rule the matcher uses"
requirements-completed: [V365-09, V365-10, V365-13]
duration: ~25 min
completed: 2026-10-01
---

# Phase 365 Plan 07: Room never-do list core Summary

One small fail-shut module decides, from literals a step already declares, whether an unattended step must stop; a broken list stops steps instead of waving them through.

PLAN_BASE: 4117922e5d2f5d7121112df3f81a40a63887aaab

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | fbb190ffd | reader, matcher, declared-field extractors, trips, proposals + test-365-never-do-core.cjs |
| 2 | 774c32540 | approval-trail writer + test-365-never-do-writer.cjs |

Both verified as ancestors of HEAD.

## Exported API (lib/core/room-constraints.cjs)

Constants: `SCHEMA = 'mos.room-constraints/1'`, `KINDS` (frozen Set: command, section, path, provider, term), `FILE_REL = '.mindrian/never-do.json'`, `TRIPS_REL = '.mindrian/constraint-trips.jsonl'`, `FLOOR_SENTENCE = 'This list catches only what has been named. It is a floor, not a guarantee.'`

Functions (all pure over roomDir, fs and path only):

- `readNeverDo(roomDir) -> {ok:true, entries:[{kind,value,why,approved_via,approved_at}]} | {ok:false, reason:'malformed'|'wrong_schema'|'invalid_entry', index?}`. Fresh read every call; missing file is `{ok:true, entries:[]}`.
- `normalizePath(p) -> string` ('' when unusable).
- `matchFields(entries, fields) -> entry | null`. `fields = {command, section, path, provider, term}`; provider and term may be a string or an array; unset fields are null.
- `checkStep(roomDir, fields) -> {halt:false} | {halt:true, reason:'constraint_named', entry:{kind,value,why}} | {halt:true, reason:'constraints_malformed', detail:string}`. Never halt:false on a malformed file.
- `declaredFieldsOfChainStep(step, ctx) -> fields`. `step.command`, `ctx.targetSection`, path from `resolveExecutable(...).produces` (null on none or throw). Example: `/mos:snapshot` yields path `exports/hub.html`.
- `declaredFieldsOfAmbientPlan(qs, plan, zoneTerm, grant) -> fields`. command from `qs.command`, section from `plan.return_target.section`, provider = distinct `corpus` of researchable leaves (array, may be empty), term = array of the trimmed zone term plus the grant's approved synonyms for it.
- `recordTrip(roomDir, {surface, reason, kind, value, step_command, run_id}) -> {ok}`. Never throws; appends one `mos.constraint-trip/1` line with `at`; never writes a `why`.
- `proposalFromFields(fields, {surface}) -> {kind, value, why, alternatives:[{kind,value}] (max 2)} | null`. Specificity path, term, section, provider, command; default why "Never let an unattended <surface> step <verb> <value>." Callers pass `surface` such as `'chain'` or `'ambient research'`.
- `writeNeverDoEntry(roomDir, {kind, value, why}, {approved_via:{surface:'cli'|'mcp', decision_node_id}}) -> {ok:true, entry} | {ok:true, duplicate:true} | {ok:false, reason}`. Reasons: `approval_required`, `invalid_kind`, `invalid_value`, `invalid_path`, `invalid_why`, `existing_file_malformed`, `write_failed`. Approval is checked first, then the entry, then the existing file; atomic tmp plus rename.
- `listSummary(roomDir) -> {ok, count, malformed}` for status surfaces (365-15).

## Hand-offs

- 365-09 (chain_run) and 365-10 (ambient runner): build fields with the two extractors, call `checkStep`, on halt call `recordTrip` then surface `proposalFromFields` plus `FLOOR_SENTENCE`. The module does not mint the decision node; the caller does.
- 365-13 and 365-14 (approval doors): mint the decision node first, then call `writeNeverDoEntry` with its id as `approved_via`. `proposalFromFields` output is the pre-filled card.
- 365-15 (`/mos:status --checks`): use `listSummary`; a `malformed` reason is the report line, and its fix is to repair or remove `.mindrian/never-do.json`.
- Part 8 sweep already lists `lib/core/room-constraints.cjs` (clean) and `lib/mcp/never-do-gate.cjs` (not yet created, skipped).

## Verification

- `node tests/test-365-never-do-core.cjs` PASS (M1..M11), `node tests/test-365-never-do-writer.cjs` PASS (W1..W6).
- `bash tests/run-all-365.sh` at HEAD 774c325408c977ded9cd6904274612eb691ea9e3: PASSED=50 FAILED=0 SKIPPED=1 KNOWN=8 (was 48/0/1/8 before; the two new legs are the +2). Part 8 sweep reports `clean: lib/core/room-constraints.cjs`. The Theo parity EXTRACTION_FAILED lines in that output are pre-existing and listed KNOWN; this plan changes no field on gate_render, gate_answer, chain_run, graph_write or room_bind.
- Acceptance greps: no `let _cache` or `_fresh` in the module; no dash characters in any new file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Literal dashes injected into the module by the Write tool**
- **Found during:** Task 1 verification (the M11 dash check)
- **Issue:** `noDash` regex carried literal U+2014 and U+2013 characters.
- **Fix:** built the pattern from `String.fromCharCode(0x2014)` and `String.fromCharCode(0x2013)`; re-checked with `grep -nP`.
- **Commit:** fbb190ffd

**2. [Scope note] Writer path values stored normalized**
- Plan said only "dedupe an identical kind and value". Path values are normalized on write (and on dedupe) so `./research//raw/` and `research/raw` are one entry. Covered by W4.

No other deviations. The Task 1 commit deliberately excludes the writer so each task commit matches the plan's task split.

## Known Stubs

None.

## Threat Flags

None. No new network surface, no room.db access; T-365-04, T-365-05, T-365-06, T-365-10, T-365-11 mitigations are implemented and tested as planned.

## Self-Check: PASSED

Files exist (lib/core/room-constraints.cjs, both tests); commits fbb190ffd and 774c32540 are ancestors of HEAD; STATE.md and ROADMAP.md untouched; peer's uncommitted 353-FLEET-REPORT.json and Phase 366 hunks left alone.
