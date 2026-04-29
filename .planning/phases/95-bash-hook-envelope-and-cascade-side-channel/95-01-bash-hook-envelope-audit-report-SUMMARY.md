---
phase: 95
plan: 01
subsystem: bash-hook-envelope-and-cascade-side-channel
tags: [audit, hooks, envelope-schema, requirements-anchor, roadmap]
canon_parts:
  - "Part 7 Reuse Before Build (audited existing hook surface before changing)"
  - "Part 8 Graph Boundary (verified no audit-target hook leaks LOCAL bytes)"
requirements:
  - BASH-95-01
  - BASH-95-02
  - BASH-95-03
  - BASH-95-04
  - BASH-95-05
  - BASH-95-06
  - BASH-95-07
provides:
  - "Per-script bash hook envelope audit; load-bearing input to Plans 95-02 and 95-04"
  - "BASH-95-01..07 requirement IDs anchored for all 5 Phase 95 plans"
  - "Phase 95 ROADMAP entry for orchestrator linkage"
requires:
  - "95-CONTEXT.md acceptance A1-A7"
  - "95-RESEARCH.md Section 1 per-event schema reference"
  - "95-RESEARCH.md Section 4 9-hook pre-audit"
affects:
  - "Plan 95-02 (post-write fix consumes audit row #1)"
  - "Plan 95-04 (batch fix consumes audit rows #3, #4, #8, #9, #10, #11)"
  - "Plan 95-05 (release gate confirms all envelope-clean)"
tech-stack:
  added: []
  patterns:
    - "Authoritative-source schema audit (https://code.claude.com/docs/en/hooks)"
    - "Mechanical-fix-uniformity heuristic for split-decision (single vs split plan)"
key-files:
  created:
    - ".planning/phases/95-bash-hook-envelope-and-cascade-side-channel/95-01-AUDIT.md"
    - ".planning/phases/95-bash-hook-envelope-and-cascade-side-channel/95-01-bash-hook-envelope-audit-report-SUMMARY.md"
  modified:
    - ".planning/REQUIREMENTS.md (added BASH-95 section + 7 traceability rows)"
    - ".planning/ROADMAP.md (added ### Phase 95 entry after Phase 94.1)"
decisions:
  - "Do NOT split to 95.2: 6 extra envelope bugs found but mechanically uniform fixes (printf -> silent OR jq -nc systemMessage). Single Plan 95-04 absorbs without quality loss."
  - "Cursor-branch divergence in 4 hooks (session-start, post-compact, on-cwd-changed, on-task-complete) documented as intentional; CURSOR_PLUGIN_ROOT-gated, never fires inside Claude Code. NO FIX in Phase 95; annotation-only recommended."
  - "session-start Claude path is schema-valid (already correct via Phase 88.1 fix); on-stop is schema-valid (per script's v1.10.10 fix block). Both flagged NO FIX in audit."
  - "Two .cjs wrappers (write-scope-check, intent-classifier) marked SPOT-AUDIT in Plan 95-04; outcome documented post-spot-check in §Spot-Audit Notes."
metrics:
  duration_minutes: 4
  tasks_completed: 3
  files_created: 2
  files_modified: 2
  commits: 3
  completed_date: "2026-04-29T18:52:31Z"
---

# Phase 95 Plan 01: Bash Hook Envelope Audit Report Summary

**One-liner:** Per-script triage of 11 bash hooks (`hooks/run-hook.cmd` dispatch surface) against authoritative Claude Code 2.x per-event schemas, anchoring BASH-95-01..07 requirements and a Phase 95 ROADMAP entry to drive Plans 95-02/95-04/95-05 mechanically.

## What Shipped

### 1. 95-01-AUDIT.md (load-bearing artifact)

11-row per-script audit table with per-row: lifecycle event, emission line numbers, current stdout shape, schema-validity verdict, recommended action, downstream-plan assignment.

**Headline counts:**

| Total | Schema-Valid | Schema-Violating | Cursor-Branch Only | .cjs-Wrapper |
|-------|--------------|------------------|--------------------|--------------|
| 11    | 2            | 7                | 4 (gated, no fix)  | 2 (spot-audit) |

- Schema-valid (NO FIX): on-stop, session-start (Claude path).
- Schema-violating (FIX in 95-02 or 95-04): post-write, pre-compact, post-compact, on-file-changed, on-cwd-changed, on-agent-complete, on-task-complete.
- Cursor-only branches (gated by `CURSOR_PLUGIN_ROOT`): session-start, post-compact, on-cwd-changed, on-task-complete - documented, no fix.
- .cjs wrappers (spot-audit only): write-scope-check, intent-classifier.

### 2. REQUIREMENTS.md anchored BASH-95-01..07

New `## Bash Hook Envelope Hygiene + Cascade Side-Channel (BASH-95)` section maps to acceptance criteria A1-A7:

- BASH-95-01: schema-valid PostToolUse envelope (post-write).
- BASH-95-02: atomic side-channel write at `<roomDir>/.mindrian/last-cascade.json`, 7 documented keys, LOCAL-only per Canon Part 8.
- BASH-95-03: room-proactive SKILL.md side-channel reader contract; prose APPROVE/REJECT/DEFER renderer preserved byte-identical.
- BASH-95-04: 9 other bash hooks audited per lifecycle event; envelope violations fixed.
- BASH-95-05: regression test fences ALL bash hook stdout shapes per-event.
- BASH-95-06: CHANGELOG `[1.12.0]` Fixed + Changed sections.
- BASH-95-07: 5-gate version bump 1.11.2 -> 1.12.0.

7 new traceability rows added (`BASH-95-01..07 | Phase 95 | Pending`).

### 3. ROADMAP.md Phase 95 entry

Inserted after Phase 94.1 (v1.11.1 GA closing artifact). Block contains: Goal, Requirements [BASH-95-01..07], Depends on, Source signals, 5-plan list (95-01..95-05), Acceptance criteria A1-A7.

## Hand-Off List - Audit Row -> Downstream Plan

| Audit Row | Script | Drives Plan | What Plan Does |
|-----------|--------|-------------|----------------|
| #1 | scripts/post-write | **95-02** | PostToolUse envelope fix + atomic side-channel writer at `<roomDir>/.mindrian/last-cascade.json` |
| #2 | scripts/session-start | n/a (annotation) | Optional Cursor-branch comment in 95-04; Claude path is already clean |
| #3 | scripts/pre-compact | **95-04** | Replace 2 `printf '{"status":...}'` emissions with `jq -nc '{systemMessage}'` |
| #4 | scripts/post-compact | **95-04** | Two-part fix: truncate to systemMessage + write full restored context to `<roomDir>/.mindrian/last-post-compact.md` side-channel |
| #5 | scripts/on-stop | n/a | Already schema-valid per v1.10.10 fix block |
| #6 | scripts/write-scope-check | **95-04** | SPOT-AUDIT .cjs only (bash wrapper emits nothing); document outcome |
| #7 | scripts/intent-classifier | **95-04** | SPOT-AUDIT .cjs only (bash drain emits nothing); document outcome |
| #8 | scripts/on-file-changed | **95-04** | Replace 5 `printf '{"status":...}'` emissions with silent exits (diagnostic-only paths) |
| #9 | scripts/on-cwd-changed | **95-04** | Status emissions -> silent; structured emission -> `jq -nc '{systemMessage}'` (CwdChanged only accepts the universal four keys) |
| #10 | scripts/on-agent-complete | **95-04** | Lines 31, 56 -> silent; line 88 -> `jq -nc '{hookSpecificOutput: {hookEventName: "SubagentStop", additionalContext}}'` |
| #11 | scripts/on-task-complete | **95-04** | Line 27 -> silent; line 154 -> `jq -nc '{systemMessage}'` (TaskCompleted does NOT accept hookSpecificOutput); line 159 -> silent |

Plan 95-05 release gate validates rows #1, #3, #4, #8, #9, #10, #11 are all envelope-clean via extended `tests/test-hook-envelope-shape.cjs`.

## Two Authoritative-Schema Surprises Captured in Audit

These are NOT cosmetic - they are real validation failures users could be hitting today and not noticing because the events fire less frequently than PostToolUse:

1. **PostCompact does NOT accept `hookSpecificOutput`** per https://code.claude.com/docs/en/hooks. Current `scripts/post-compact` emits `{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext, ...}, systemMessage}` - two violations: (a) the event has no hSO; (b) inner `hookEventName` is wrong even if hSO were allowed. Plan 95-04 row #4.

2. **TaskCompleted does NOT accept `hookSpecificOutput`** per same source. Current `scripts/on-task-complete` emits `{hookSpecificOutput: {hookEventName: "TaskCompleted", additionalContext}}` - direct violation. Plan 95-04 row #11.

Captured at the audit layer so 95-04 is mechanical, not exploratory.

## Decisions Made

1. **Do NOT split to 95.2** despite finding 6 extra envelope bugs (over the CONTEXT.md threshold of "2+ extra envelope bugs that need their own plans"). Rationale: fixes are mechanically identical (`printf '{"status":...}'` -> silent OR `jq -nc systemMessage`). Splitting adds release-gate overhead with zero scope reduction.

2. **Cursor-branch divergence** in 4 hooks left as-is. Cursor is NOT a target surface (CLAUDE.md tri-polar rule = CLI / Desktop / Cowork). The branches are gated by `CURSOR_PLUGIN_ROOT` and never fire inside Claude Code. Recommendation: 95-04 adds single-line audit-comment annotations referencing this report so future maintainers do not "fix" the intentional divergence.

3. **.cjs wrappers** for write-scope-check and intent-classifier deferred to spot-audit in Plan 95-04. Bash itself emits nothing for these two; .cjs ownership of stdout means a quick read covers them. If 2+ violations surface in spot-audit, planner reconvenes.

## Deviations from Plan

None - plan executed exactly as written. All 3 tasks completed, all `<verify>` blocks PASSED, all `<done>` criteria met.

## Plan-Level Smoke Check (per `<verification>` block)

```
test -f .planning/phases/95-bash-hook-envelope-and-cascade-side-channel/95-01-AUDIT.md
  -> PASS (file exists, 80 lines, 11-row table verified)
grep -q BASH-95-01 .planning/REQUIREMENTS.md
  -> PASS (BASH-95-01 found; 7 traceability rows confirmed)
grep -q "^### Phase 95:" .planning/ROADMAP.md
  -> PASS (Phase 95 entry exists with all required block elements)
```

All three pass. Plan-level acceptance complete.

## Self-Check: PASSED

- [x] `.planning/phases/95-bash-hook-envelope-and-cascade-side-channel/95-01-AUDIT.md` exists (FOUND)
- [x] `.planning/REQUIREMENTS.md` has BASH-95-01..07 (FOUND, 7 trace rows)
- [x] `.planning/ROADMAP.md` has `### Phase 95:` entry (FOUND)
- [x] Commit a66c286 (Task 1 AUDIT.md) FOUND
- [x] Commit b62e986 (Task 2 REQUIREMENTS.md) FOUND
- [x] Commit 0d79863 (Task 3 ROADMAP.md) FOUND

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 (AUDIT.md) | a66c286 | docs(95-01): add bash hook envelope audit report - 11-hook triage |
| 2 (REQUIREMENTS) | b62e986 | docs(95-01): anchor BASH-95-01..07 in REQUIREMENTS.md |
| 3 (ROADMAP) | 0d79863 | docs(95-01): add Phase 95 entry to ROADMAP.md |

## Metrics

- Duration: ~4 minutes (start 18:48:23Z, end 18:52:31Z)
- Tasks: 3/3 complete
- Files created: 2 (95-01-AUDIT.md, this SUMMARY)
- Files modified: 2 (REQUIREMENTS.md, ROADMAP.md)
- Commits: 3 (atomic per task, --no-verify per parallel-execution contract)
- Read-only against `scripts/`: confirmed (no bash hook touched in this plan)

## Known Stubs

None. This plan is documentation-only and unblocks the 4 downstream Phase 95 plans without introducing any code stubs or empty-data placeholders.
