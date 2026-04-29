# Phase 95-01 Audit Report - Bash Hook Envelope Triage

**Audited:** 2026-04-29
**Source schema:** https://code.claude.com/docs/en/hooks (master rule: `additionalProperties: false`)
**Reference patches:** scripts/query-efficiency-telemetry.cjs (v1.10.19), scripts/frontmatter-schema-validator.cjs (v1.11.2), scripts/async-artifact-auto-commit.cjs (v1.11.2)

## Summary

| Total Hooks Audited | Schema-Valid | Schema-Violating | Cursor-Branch Only | .cjs-Wrapper |
|---------------------|--------------|------------------|--------------------|--------------|
| 11 | 2 | 7 | (4 hooks have a Cursor-gated branch) | 2 |

Schema-valid hooks (NO FIX needed): on-stop, session-start (Claude path).
Schema-violating hooks (FIX in 95-02 or 95-04): post-write, pre-compact, post-compact, on-file-changed, on-cwd-changed, on-agent-complete, on-task-complete.
.cjs wrappers (spot-audit only): write-scope-check, intent-classifier.

## Per-Hook Audit Table

| # | Script | Lifecycle Event | Emission Lines | Stdout Shape Today | Schema-Valid? | Recommended Action | Plan |
|---|--------|-----------------|----------------|--------------------|---------------|--------------------|----|
| 1 | scripts/post-write | PostToolUse | 186-205 | `{cascade_status, classification, git_commit, graph_index, proactive_intelligence, systemMessage}` (6 root keys; 5 unknown per PostToolUse schema) | NO | Replace with `{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $msg}}`; relocate cascade payload to `<roomDir>/.mindrian/last-cascade.json` (atomic write per Pattern C in 95-RESEARCH.md Section 5). | 95-02 |
| 2 | scripts/session-start | SessionStart | 1296-1300 | Cursor branch (lines 1296, 1300): `{additional_context, systemMessage}` (snake_case at root). Claude branch (1298): `{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext}, systemMessage}` | YES (Claude path); Cursor path is gated by `[ -n "${CURSOR_PLUGIN_ROOT:-}" ]` and never fires inside Claude Code | NO FIX. Add audit-comment line referencing 95-01 above the if-branch so future maintainers know the divergence is intentional. | n/a (annotation only; can ride 95-04 if convenient) |
| 3 | scripts/pre-compact | PreCompact | 31, 244 | Line 31: `{"status": "no_room", "systemMessage": "..."}`. Line 244: `{"status": "saved", "file": "...", "systemMessage": "..."}`. Both have `status` AND `file` AT ROOT. | NO (`status`, `file` not in PreCompact allowed key set) | Replace with `jq -nc --arg msg "$systemMsg" '{systemMessage: $msg, suppressOutput: false}'`. | 95-04 |
| 4 | scripts/post-compact | PostCompact | 281-285 | Cursor (281): `{additional_context, systemMessage}`. Claude (283): `{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext}, systemMessage}`. Cursor (285): `{additional_context, systemMessage}`. | NO (PostCompact does NOT accept hookSpecificOutput per authoritative docs; ALSO hookEventName "SessionStart" is wrong even if hSO were allowed) | TWO-PART FIX: (a) replace structured emission with `jq -nc '{systemMessage: <truncated context>}'`; (b) write the full restored context to side-channel `<roomDir>/.mindrian/last-post-compact.md` for next session-start to read (mirrors 95-02 cascade side-channel pattern). | 95-04 |
| 5 | scripts/on-stop | Stop | 446 | `{continue: true, systemMessage: "..."}` via node -e printer | YES (per v1.10.10 fix per script's own comment block lines 417-424) | NO FIX. | n/a |
| 6 | scripts/write-scope-check | PreToolUse | n/a (12 LOC bash wrapper -> .cjs) | Bash itself emits nothing; delegates to `write-scope-check.cjs` | n/a (bash) | SPOT-AUDIT the .cjs in 95-04 task list; document outcome in this AUDIT under §Spot-Audit Notes. | 95-04 (spot-audit only) |
| 7 | scripts/intent-classifier | UserPromptSubmit | n/a (106 LOC wrapper + drain block; .cjs does emission) | Bash drain block emits nothing on stdout; delegates to `intent-classifier.cjs` | n/a (bash) | SPOT-AUDIT the .cjs in 95-04 task list; document outcome under §Spot-Audit Notes. | 95-04 (spot-audit only) |
| 8 | scripts/on-file-changed | FileChanged | 16, 25, 32, 38, 44 | Five variants of `{"status": "<value>"}` (no_file, no_room, outside_room, skipped_infra, skipped_hidden). At line 49 `exec`s post-write (cascade emits its own envelope; fixed in 95-02). | NO (FileChanged allows ONLY `{continue, stopReason, suppressOutput, systemMessage}`; `status` is unknown) | Replace each `printf '{"status": "..."}\n'` with silent exit (`return 0` or `exit 0` with no stdout). These are diagnostic-only paths; no message needed. | 95-04 |
| 9 | scripts/on-cwd-changed | CwdChanged | 38, 47, 114-118 | Lines 38, 47: `{"status": "..."}` (invalid). Cursor branches (114, 118): `{additional_context}`. Claude branch (116): `{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext}}`. | NO ((a) `status` invalid; (b) CwdChanged does not accept hookSpecificOutput; (c) hookEventName "SessionStart" wrong) | Replace status emissions with silent exit. Replace structured emission with `jq -nc --arg msg "Switched to room: $slug" '{systemMessage: $msg}'` since CwdChanged only accepts the universal four keys. | 95-04 |
| 10 | scripts/on-agent-complete | SubagentStop | 31, 56, 88 | All `{"status": "..."}` shapes (no_room, no_modified_files, cascaded). | NO (SubagentStop accepts hookSpecificOutput.additionalContext but NOT `status` at root) | Replace lines 31, 56 with silent exits (diagnostic paths). Replace line 88 with `jq -nc --arg msg "$cascade_summary" '{hookSpecificOutput: {hookEventName: "SubagentStop", additionalContext: $msg}}'`. | 95-04 |
| 11 | scripts/on-task-complete | TaskCompleted | 27, 154-159 | Line 27: `{"status": "no_room"}`. Lines 154-156: `{hookSpecificOutput: {hookEventName: "TaskCompleted", additionalContext}}` (Claude path) + `{additional_context}` (Cursor). Line 159: `{"status": "ok", "venture_stage": "..."}`. | NO (TaskCompleted does NOT accept hookSpecificOutput per authoritative docs; `status` and `venture_stage` invalid at root) | Replace line 27 with silent exit. Replace line 154 emission with `jq -nc --arg msg "$context" '{systemMessage: $msg}'`. Replace line 159 with silent exit (diagnostic). Cursor branch (156) gated by CURSOR_PLUGIN_ROOT - leave with audit-comment per row #2. | 95-04 |

## Spot-Audit Notes (.cjs wrappers)

Spot-audit performed 2026-04-29 as part of Plan 95-04. Both .cjs wrappers checked end-to-end:

| Script | Emission Sites | Schema-Valid? | Notes |
|--------|----------------|---------------|-------|
| scripts/write-scope-check.cjs | Line 150 (`emitSystemMessage` -> `JSON.stringify({hookSpecificOutput: {hookEventName: "PreToolUse", additionalContext}})`). Single emission site. | YES | PreToolUse allowed top-level keys per 95-RESEARCH.md §2: `{continue, stopReason, suppressOutput, systemMessage, hookSpecificOutput}`. Inner `hookEventName: "PreToolUse"` is correct. Block path uses exit 2 + stderr; allow path is silent (no stdout). The v1.10.19 hotfix comment block at lines 134-139 cites the schema explicitly. |
| scripts/intent-classifier.cjs | Line 338 (`emitStrictModeOverride`): `{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext}, systemMessage}`. Line 482 (intent-mismatch): same envelope. Line 485 (fallback): plain text. Line 594 (`injectGraphFindings`): plain text "## GRAPH FINDINGS (top 3) ...". Line 1318 (`formatEngineDecisionBlock`): plain text "## NAVIGATION DECISION (engine v1) ...". | YES | UserPromptSubmit allowed top-level keys per 95-RESEARCH.md §2: `{continue, stopReason, suppressOutput, systemMessage, decision, reason, hookSpecificOutput}`. UserPromptSubmit additionally accepts plain stdout (non-JSON) as additionalContext per the same §2 note. All five emission sites conform. The 88.1-03 systemMessage retrofit comment block at lines 467-473 cites the schema. |

No envelope violations found in spot-audit. CONTEXT.md split-to-95.2 threshold ("if 2+ extra envelope bugs surface") is NOT met for the .cjs wrappers. All bug fixes ship in Phase 95.

## .cjs Reference Patches (v1.10.19 + v1.11.2) - Confirmed Clean

| Script | Status | Reference Pattern |
|--------|--------|-------------------|
| scripts/query-efficiency-telemetry.cjs | CLEAN (v1.10.19) | emitEnvelope() at lines 86-97 - canonical PostToolUse advisory shape |
| scripts/frontmatter-schema-validator.cjs | CLEAN (v1.11.2) | Same pattern, fenced by tests/test-hook-envelope-shape.cjs |
| scripts/async-artifact-auto-commit.cjs | CLEAN (v1.11.2) | Same pattern, fenced by tests/test-hook-envelope-shape.cjs |

Plan 95-05 release gate runs `node lib/memory/run-feynman-tests.cjs` to confirm zero regression on these.

## Cursor Branch Divergence (4 hooks)

Hooks #2 (session-start), #4 (post-compact), #9 (on-cwd-changed), #11 (on-task-complete) carry a `[ -n "${CURSOR_PLUGIN_ROOT:-}" ]`-gated Cursor branch emitting `{additional_context}` snake_case at root. This is invalid for Claude Code 2.x but valid for Cursor's hook system. Per CLAUDE.md tri-polar rule the supported surfaces are CLI / Desktop / Cowork - Cursor is NOT a target. NO FIX in Phase 95. Recommendation: add a single-line comment above each Cursor branch referencing this audit so future maintainers do not "fix" the intentional divergence.

## Recommended Plan Mapping

Per 95-RESEARCH.md Section 9, the audit findings map to Phase 95 plans as:

| Plan | Scope from this audit |
|------|----------------------|
| 95-02 | Hook #1 (post-write) - PostToolUse envelope fix + side-channel writer |
| 95-04 | Hooks #3, #4, #8, #9, #10, #11 - bash batch fix; spot-audit #6 and #7; Cursor-comment annotations on #2, #4, #9, #11 |
| 95-05 | Release gate - confirms #1, #3, #4, #8, #9, #10, #11 all envelope-clean via extended tests/test-hook-envelope-shape.cjs |

## Split-To-95.2 Decision

CONTEXT.md threshold: split if audit finds "2+ extra envelope bugs that need their own plans." Audit finds 6 extra bugs, technically over threshold. BUT the fixes are mechanically identical (`printf '{"status":...}'` -> silent exit OR `jq -nc systemMessage`). Mechanical uniformity means a single Plan 95-04 absorbs them without quality loss; splitting to 95.2 would add release-gate overhead with zero scope reduction.

**Recommendation: ship all 6 in Plan 95-04. Do NOT split.**

## Three-Surface Compatibility (per CLAUDE.md tri-polar rule)

| Surface | Audit Outcome |
|---------|---------------|
| CLI | All hooks fire via run-hook.cmd dispatch; bash semantics preserved across fixes. |
| Desktop MCP | Same hooks bundle ships; no surface-specific code in the audit findings. |
| Cowork | Shared hooks bundle; Cowork concurrency on shared room dir handled at side-channel layer (Plan 95-02), not at envelope layer. |

## Provenance

- Audit performed: 2026-04-29 against repo HEAD with v1.11.2 shipped.
- Authoritative schema source: https://code.claude.com/docs/en/hooks (verified 2026-04-29; canonical URL via redirect from docs.claude.com/en/docs/claude-code/hooks).
- All 11 emission lines verified by `grep -nE "^echo|printf|jq -nc|jq -c"` across audit-target scripts (results captured in 95-RESEARCH.md Section 4).
