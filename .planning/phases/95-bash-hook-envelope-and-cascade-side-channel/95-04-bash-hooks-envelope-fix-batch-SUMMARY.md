---
phase: 95-bash-hook-envelope-and-cascade-side-channel
plan: 04
subsystem: bash-hooks-envelope-hygiene
tags: [bash, pre-compact, post-compact, on-file-changed, on-cwd-changed, on-agent-complete, on-task-complete, hook, envelope, side-channel, atomic-write, per-event, canon-part-8]
requirements: [A4, A5]
canon_parts:
  - "Part 7 - Reuse Before Build (mirrored Plan 95-02 emit_post_tool_use_envelope helper across the 6 audit-target hooks with per-event inner shape)"
  - "Part 8 - Graph Boundary (per-event envelope only; PostCompact side-channel file stays LOCAL)"
dependency_graph:
  requires: [95-01-AUDIT.md, 95-02-post-write-side-channel-writer-SUMMARY.md]
  provides:
    - "scripts/pre-compact PreCompact-compliant envelope (status root key removed)"
    - "scripts/post-compact PostCompact-compliant envelope (no hookSpecificOutput; full restored context relocates to <roomDir>/.mindrian/last-post-compact.md side-channel)"
    - "scripts/on-file-changed FileChanged-silent-on-diagnostic-paths"
    - "scripts/on-cwd-changed CwdChanged-compliant envelope (no hookSpecificOutput)"
    - "scripts/on-agent-complete SubagentStop-compliant envelope (cascade summary in hookSpecificOutput.additionalContext)"
    - "scripts/on-task-complete TaskCompleted-compliant envelope (no hookSpecificOutput; summary in systemMessage)"
    - "tests/test-hook-envelope-shape.cjs extended with 6 per-event allowed-key Sets + 2 helpers (runBashHook, assertEnvelopeShapePerEvent) + makeStrategy0Room helper + 6 scenario runners"
  affects:
    - "Plan 95-05 release-gate full-suite smoke (test-hook-envelope-shape + test-cascade-side-channel both green on the same run)"
    - "Phase 95.5+ PostCompact side-channel CONSUMER (deferred; CHANGELOG transparency note in Plan 95-05)"
tech_stack:
  added: []
  patterns:
    - "Per-event envelope helper bash signature: jq -nc --arg m \"$msg\" '{<event-specific keys>: $m}' with empty-input -> return 0 silent path"
    - "Atomic side-channel write via mktemp inside SIDE_DIR + mv -f (POSIX rename(2) same-filesystem invariant; identical to Plan 95-02 cascade side-channel)"
    - "Soft-fail invariant: every helper returns 0 on any failure; every code path exits 0"
    - "Cursor-branch divergence annotation: comment line referencing 95-01-AUDIT.md row above each [ -n \"${CURSOR_PLUGIN_ROOT:-}\" ] gate"
    - "Background-child stdout redirect to /dev/null (Rule 3 fix in on-agent-complete: post-write child's PostToolUse envelope must not leak into SubagentStop parent's stdout)"
key_files:
  created:
    - .planning/phases/95-bash-hook-envelope-and-cascade-side-channel/95-04-bash-hooks-envelope-fix-batch-SUMMARY.md
  modified:
    - scripts/pre-compact
    - scripts/post-compact
    - scripts/on-file-changed
    - scripts/on-cwd-changed
    - scripts/on-agent-complete
    - scripts/on-task-complete
    - tests/test-hook-envelope-shape.cjs
    - .planning/phases/95-bash-hook-envelope-and-cascade-side-channel/95-01-AUDIT.md
decisions:
  - "Per-event helper inner shape differs by lifecycle event (PreCompact / CwdChanged / TaskCompleted: systemMessage only; PostCompact: systemMessage only AND side-channel for full context; SubagentStop: hookSpecificOutput.additionalContext; FileChanged: silent diagnostic exits) per 95-RESEARCH.md Section 2 authoritative allowed-key table"
  - "PostCompact side-channel file path is `<roomDir>/.mindrian/last-post-compact.md` (Markdown plain text, NOT JSON) -- WRITTEN by Phase 95 but NOT YET CONSUMED at next session-start; consumer deferred to Phase 95.5+; CHANGELOG transparency note in Plan 95-05 ### Audit Notes"
  - "scripts/session-start NOT modified (B2 plan-checker scope-leak fix). Cursor-branch divergence on session-start documented in 95-01-AUDIT.md TEXT only, NOT annotated in code; keeps session-start out of files_modified"
  - "Cursor-branch code annotations applied to 3 hooks (post-compact, on-cwd-changed, on-task-complete) -- the 3 hooks already in this plan's files_modified scope; advisory comment lines reference 95-01-AUDIT.md row #N to prevent future maintainers from 'fixing' the intentional divergence"
  - "RED gate uses named-failure counting (B3 plan-checker fix): `grep -cE \"^FAIL: (pre-compact|post-compact|on-cwd-changed|on-agent-complete|on-task-complete)\"` with >=6 floor across the enumerated set, replacing brittle rc=1 gate; Task 1 RED ran 10 named failures (well above floor)"
  - "scripts/on-agent-complete background post-write redirect to /dev/null (Rule 3 auto-fix discovered in GREEN test run): without this, the child's PostToolUse hookSpecificOutput envelope leaks into the parent's SubagentStop stdout, breaking single-JSON-object parse for the cascade-path scenario"
metrics:
  duration: "~25min"
  completed: "2026-04-29T19:11:05Z"
  tasks_completed: 3
  files_changed: 8
  files_created: 1
---

# Phase 95 Plan 04: Bash Hooks Envelope Fix Batch Summary

JWT-style one-liner: bring 6 schema-violating bash hooks into Claude Code 2.x compliance via per-event envelope helpers (mirroring Plan 95-02's `emit_post_tool_use_envelope` pattern with per-event inner shape from 95-RESEARCH.md Section 2 allowed-key table), install a forward-compatible PostCompact side-channel writer at `<roomDir>/.mindrian/last-post-compact.md`, and extend `tests/test-hook-envelope-shape.cjs` with 6 named-failure RED-gated scenarios that all turn GREEN under a single `node tests/test-hook-envelope-shape.cjs` run.

## Outcome

The 6 bash hooks identified by Plan 95-01's audit (`pre-compact`, `post-compact`, `on-file-changed`, `on-cwd-changed`, `on-agent-complete`, `on-task-complete`) stopped emitting `{"status": "..."}` shapes that violated the per-event allowed-key sets, and now emit ONLY allowed top-level keys for their respective lifecycle events. The PostCompact full restored context (~1-5KB Markdown blob that used to ride in `additionalContext` and `additional_context`) relocates to `<roomDir>/.mindrian/last-post-compact.md` for forward compatibility; the consumer is deferred to Phase 95.5+. The regression test fence covers 6 new scenarios with 10 named-failure RED gate (>=6 floor) and full GREEN under all hooks.

This plan closes the bulk of the Phase 95 schema-compliance work. Plan 95-02 fixed the load-bearing post-write hook (PostToolUse) and the cascade side-channel; Plan 95-04 fixes the remaining 6 schema-violating bash hooks. After this plan ships, only the spot-audited `.cjs` wrappers remain (both confirmed clean in §Spot-Audit Notes).

## Tasks Completed

### Task 1 - RED test fence (commit 1d2d6ce)

Extended `tests/test-hook-envelope-shape.cjs` (+485 lines):

**6 per-event allowed-key Sets** at the top of the file, after the existing `ALLOWED_TOP_LEVEL` Set:
- `ALLOWED_PRE_COMPACT` (7 keys including hookSpecificOutput, decision, reason)
- `ALLOWED_POST_COMPACT` (4 keys; NO hookSpecificOutput)
- `ALLOWED_FILE_CHANGED` (4 keys; NO hookSpecificOutput)
- `ALLOWED_CWD_CHANGED` (4 keys; NO hookSpecificOutput)
- `ALLOWED_SUBAGENT_STOP` (7 keys including hookSpecificOutput, decision, reason)
- `ALLOWED_TASK_COMPLETED` (6 keys including decision, reason; NO hookSpecificOutput)

Sources: 95-RESEARCH.md Section 2 "Per-Event Hook Schema Reference" verified against authoritative Claude Code 2.x docs 2026-04-29.

**3 new helpers**:
- `runBashHook(scriptPath, envelope, opts)` — spawnSync('bash', [scriptPath]) variant of `runHook`; mirrors `tests/test-cascade-side-channel.cjs`'s identical helper byte-for-byte.
- `assertEnvelopeShapePerEvent(stdout, label, allowedKeys, hookEventName)` — per-event allowed-key gate; when `hookEventName === null`, additionally asserts `hookSpecificOutput` is NOT a top-level key (events that do NOT accept hSO: PostCompact, FileChanged, CwdChanged, TaskCompleted).
- `makeStrategy0Room(scratch)` — Strategy-0 layout (.rooms/registry.json + .room-root + STATE.md + section dir + .mindrian dir); caller passes `env.MINDRIAN_ROOMS_HOME = scratch` so resolve-room locates the synthetic room as active. Without this, hooks resolve the user's real active room and active-room guards skip the cascade.

**6 scenario runners** with 11 total scenarios (multi-scenario coverage where the plan benefits):
- `runPreCompactScenarios()`: silent (no active room) + message (active room with STATE.md).
- `runPostCompactScenarios()`: envelope-shape valid (asserts hSO is NOT at root via null hookEventName).
- `runOnFileChangedScenarios()`: silent on diagnostic paths (NOT in RED floor per B3 fix).
- `runOnCwdChangedScenarios()`: silent on no-room + success path via cwd + success path via NEW_DIR positional arg.
- `runOnAgentCompleteScenarios()`: silent on no-room + cascade path with recently modified files.
- `runOnTaskCompleteScenarios()`: silent on no-room + summary path with venture_stage frontmatter.

**B3 named-failure RED gate**: each scenario emits `FAIL: <scenario-name>` line on stderr on assertion failure via `failNamed()` helper. Gate counts named failures via `grep -cE "^FAIL: (pre-compact|post-compact|on-cwd-changed|on-agent-complete|on-task-complete)"` with `>=6` floor. The enumerated binding set is the 6 names from `<interfaces>`; on-file-changed is NOT in the floor (its diagnostic paths may already exit silent).

**RED verification (before Task 2)**: 10 named FAIL lines emitted, well above the 6-floor:
- pre-compact silent-path: `disallowed top-level key "status"` (current emits `{"status": "no_room", ...}`)
- pre-compact message-path: `disallowed top-level key "status"` (current emits `{"status": "saved", "file": ..., ...}`)
- post-compact: `disallowed top-level key "hookSpecificOutput"` (PostCompact does NOT accept hSO)
- on-file-changed silent-diagnostic: `disallowed top-level key "status"` (NOT in RED floor)
- on-cwd-changed silent-no-room / success-path / success-path: `disallowed top-level key "status"` x3
- on-agent-complete silent-no-room / cascade-path: `disallowed top-level key "status"` + multi-line stdout parse failure
- on-task-complete silent-no-room / summary-path: `disallowed top-level key "status"` x2

Existing 5 .cjs scenarios still passed (zero regression on Plan 95-02 frozen tests).

### Task 2 - GREEN per-event envelope fixes (commit 70672dc)

Modified 6 bash hooks. Each script gets a per-event envelope helper at the top mirroring Plan 95-02's `emit_post_tool_use_envelope` pattern; emission lines that used `status` / `file` / `venture_stage` at root replaced with helper calls or silent diagnostic exits.

**`scripts/pre-compact` (+25 / -2 lines)**:
- Added `emit_pre_compact_envelope` helper (jq -nc with systemMessage + suppressOutput).
- Line 31 no_room emission: helper call replaces `{"status": "no_room", ...}`.
- Line 244 saved emission: helper call replaces `{"status": "saved", "file": ..., "systemMessage": ...}`. The `$SAVE_FILE` path is no longer surfaced in stdout because `file` is not in the PreCompact allowed key set; callers read the side-channel from STATE.md or grep `~/.mindrian/bridge/`.

**`scripts/post-compact` (+45 / -8 lines)**:
- Added `emit_post_compact_envelope` helper (systemMessage only; PostCompact does NOT accept hookSpecificOutput per 95-RESEARCH.md §2).
- Added `write_post_compact_side_channel(room_dir, restored_context)` helper: atomic mktemp + mv -f writer to `<roomDir>/.mindrian/last-post-compact.md` (Markdown plain text, NOT JSON). Mirrors Plan 95-02 cascade side-channel writer; same soft-fail-at-every-step pattern.
- 3-branch emission (lines 280-286 pre-fix) replaced: side-channel write fires first; Cursor branch (gated by `CURSOR_PLUGIN_ROOT`, kept for compatibility) emits the legacy `additional_context` shape; Claude path emits `emit_post_compact_envelope "$POSTC_SYSMSG"` (the brief one-line systemMessage, NOT the full restored context).
- Cursor-branch annotation comment references `95-01-AUDIT.md` row #4.

**Forward-compatibility note**: The PostCompact side-channel file is WRITTEN by Phase 95 but NOT YET CONSUMED at next session-start. The consumer is queued for Phase 95.5 or 96. Plan 95-05's CHANGELOG ### Audit Notes section will explicitly disclose this half-wired state per `release-process.md` transparency.

**`scripts/on-file-changed` (-5 lines)**:
- Lines 16, 25, 32, 38, 44 (5 diagnostic emissions of `{"status": ...}`) replaced with silent exits + comment markers (`# silent: no file path`, `# silent: no active room`, etc.). FileChanged does not accept hookSpecificOutput; silent on diagnostic paths is canonical.
- The final `exec bash post-write` line (line 49) is unchanged; it inherits post-write's own exit 0 and Plan 95-02 envelope shape.

**`scripts/on-cwd-changed` (+24 / -7 lines)**:
- Added `emit_cwd_changed_envelope` helper (systemMessage only; CwdChanged does NOT accept hookSpecificOutput).
- Lines 38, 47 (no_room, same_room) replaced with silent diagnostic exits.
- Lines 114-118 success path: Cursor branch retained (gated, kept for compatibility); Claude path emits `emit_cwd_changed_envelope "Switched to room: ${room_name}"`. The full room state is no longer surfaced through stdout, but the next SessionStart fires anyway and re-injects active-room context.
- Cursor-branch annotation comment references `95-01-AUDIT.md` row #9.

**`scripts/on-agent-complete` (+22 / -3 lines + Rule 3 fix)**:
- Added `emit_subagent_stop_envelope` helper (hookSpecificOutput.additionalContext with hookEventName: "SubagentStop"; SubagentStop accepts hSO per RESEARCH §2).
- Lines 31, 56 (no_room, no_modified_files) replaced with silent diagnostic exits.
- Line 88 cascade summary: helper call replaces `{"status": "cascaded", "files_processed": %d}`. Message format: `agent cascade: $cascade_count files processed`.
- **Rule 3 (Blocking) auto-fix discovered in GREEN test run**: `bash post-write "$file_path" 2>/dev/null &` redirected stdout to /dev/null too. Without this, the background child's PostToolUse `hookSpecificOutput` envelope leaks into `on-agent-complete`'s stdout (which carries the SubagentStop envelope), breaking single-JSON-object parse for the cascade-path scenario. Fix: `bash post-write "$file_path" >/dev/null 2>&1 &`. Documented in inline comment.

**`scripts/on-task-complete` (+30 / -7 lines)**:
- Added `emit_task_completed_envelope` helper (systemMessage only; TaskCompleted does NOT accept hookSpecificOutput per RESEARCH §2).
- Line 27 (no_room) replaced with silent diagnostic exit.
- Lines 154-159 emission block: Cursor branch retained (gated, kept for compatibility); Claude path emits `emit_task_completed_envelope "$context"`. Else branch (no readiness signal) replaced with silent `:` (no-op).
- Cursor-branch annotation comment references `95-01-AUDIT.md` row #11.

**`scripts/session-start` NOT modified** per B2 plan-checker scope-leak fix. The Cursor-branch divergence on session-start (audit row #2) is documented in `95-01-AUDIT.md` Cursor Branch Divergence section TEXT only, without a code-comment annotation. Keeping session-start out of `files_modified` avoids scope creep.

**Verification (after Task 2)**:
- `node tests/test-hook-envelope-shape.cjs` -> 16/16 GREEN (existing 5 .cjs + 11 new bash scenarios).
- `node tests/test-cascade-side-channel.cjs` -> 5/5 GREEN (zero regression on Plan 95-02 frozen tests).
- `grep -nE 'printf .\{"status"' scripts/pre-compact scripts/post-compact scripts/on-file-changed scripts/on-cwd-changed scripts/on-agent-complete scripts/on-task-complete | wc -l` -> **0**.
- Per-event helpers present in all 6 fixed hooks; `write_post_compact_side_channel` present in scripts/post-compact.
- Soft-fail invariant: every code path exits 0 (5 explicit `exit 0` lines in on-file-changed + final `exec bash post-write` which exit 0s; all other 5 hooks have explicit `exit 0` at end).
- Canon Part 8 invariant: `grep -E "fetch|http|brain\." scripts/{pre-compact,post-compact,on-file-changed,on-cwd-changed,on-agent-complete,on-task-complete}` -> zero hits in new helper code.

### Task 3 - Spot-audit + audit finalization (commit fbf02e9)

**Spot-audit of .cjs wrappers**: read `scripts/write-scope-check.cjs` and `scripts/intent-classifier.cjs` end-to-end. Both checked against per-event allowed-key Sets in 95-RESEARCH.md Section 2.

| Script | Emission Sites | Schema-Valid? | Notes |
|--------|----------------|---------------|-------|
| `scripts/write-scope-check.cjs` (PreToolUse) | Line 150 single emission via `emitSystemMessage` -> `JSON.stringify({hookSpecificOutput: {hookEventName: "PreToolUse", additionalContext}})`. | YES | PreToolUse allows hookSpecificOutput; hookEventName "PreToolUse" correct; block path uses exit 2 + stderr; allow path silent. v1.10.19 hotfix comment block at lines 134-139 cites the schema. |
| `scripts/intent-classifier.cjs` (UserPromptSubmit) | 5 emission sites: emitStrictModeOverride (line 338), intent-mismatch envelope (line 482), raw-text fallback (line 485), injectGraphFindings plain text (line 594), formatEngineDecisionBlock plain text (line 1318). | YES | UserPromptSubmit allows hookSpecificOutput AND plain stdout per RESEARCH §2 (`Plain stdout (non-JSON) is also accepted as additional context`). All five sites conform. The 88.1-03 systemMessage retrofit comment block at lines 467-473 cites the schema. |

**Outcome**: Both `.cjs` wrappers clean. CONTEXT.md split-to-95.2 threshold (2+ extra envelope bugs) NOT met. All bug fixes ship in Phase 95.

**95-01-AUDIT.md updates**:
- §Spot-Audit Notes section filled in (placeholder text replaced with the table above).
- Cursor Branch Divergence section text already says "4 hooks" enumerated (session-start, post-compact, on-cwd-changed, on-task-complete) at section heading and summary table — no further reconciliation needed.
- Cursor-branch annotation comments were added to scripts/post-compact, scripts/on-cwd-changed, scripts/on-task-complete in the GREEN commit (70672dc) — verified by grep `Phase 95-01 audit` -> 3 hits in those 3 files; 0 hits in scripts/session-start.

## Files Changed

### Modified

- **scripts/pre-compact** (+25 / -2): `emit_pre_compact_envelope` helper added near the top; lines 31, 244 emission lines replaced with helper calls. The `$SAVE_FILE` path no longer surfaced.
- **scripts/post-compact** (+45 / -8): `emit_post_compact_envelope` + `write_post_compact_side_channel` helpers added; 3-branch emission replaced with side-channel write + Cursor branch (gated) + Claude path helper call; Cursor-branch annotation cites 95-01-AUDIT.md row #4.
- **scripts/on-file-changed** (-5 net): 5 diagnostic emissions replaced with silent exits + comment markers.
- **scripts/on-cwd-changed** (+24 / -7): `emit_cwd_changed_envelope` helper added; lines 38, 47 silent; success path emits via helper; Cursor-branch annotation cites 95-01-AUDIT.md row #9.
- **scripts/on-agent-complete** (+22 / -3 + Rule 3 fix): `emit_subagent_stop_envelope` helper added; lines 31, 56 silent; line 88 cascade summary via helper; background post-write child redirected to /dev/null to prevent stdout collision.
- **scripts/on-task-complete** (+30 / -7): `emit_task_completed_envelope` helper added; line 27 silent; lines 154-159 emission block replaced with Cursor branch (gated) + Claude path helper call; line 159 silent; Cursor-branch annotation cites 95-01-AUDIT.md row #11.
- **tests/test-hook-envelope-shape.cjs** (+485): 6 per-event allowed-key Sets + 3 helpers (runBashHook, assertEnvelopeShapePerEvent, makeStrategy0Room) + failNamed helper + 6 scenario runners with 11 total scenarios.
- **.planning/phases/95-bash-hook-envelope-and-cascade-side-channel/95-01-AUDIT.md** (+8 / -1): §Spot-Audit Notes filled with 2-row table documenting both .cjs wrappers as schema-valid.

### Created

- **.planning/phases/95-bash-hook-envelope-and-cascade-side-channel/95-04-bash-hooks-envelope-fix-batch-SUMMARY.md** (this file).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] on-agent-complete background post-write stdout leak**

- **Found during:** Task 2 GREEN test run.
- **Issue:** `bash "${SCRIPT_DIR}/post-write" "$file_path" 2>/dev/null &` redirected stderr to /dev/null but left stdout open. The post-write child's PostToolUse `hookSpecificOutput` envelope was racing into the parent's stdout, alongside the parent's own SubagentStop envelope. Result: stdout carried two JSON objects on consecutive lines, which `JSON.parse` rejects ("stdout is not valid JSON"). The cascade-path scenario was the only test that surfaced this because it requires the active-room guard to permit the cascade.
- **Fix:** Changed redirect to `>/dev/null 2>&1 &` so the child's stdout is also dropped. The post-write hook's own envelope still emits to disk (via the side-channel writer in Plan 95-02), but its stdout is no longer a stream the parent collects.
- **Files modified:** `scripts/on-agent-complete`.
- **Commit:** absorbed into 70672dc.
- **Inline documentation:** comment block above the redirect cites Rule 3 origin and the consumer impact (multi-line stdout breaks single-JSON-object parse).

This is a sub-channel discipline issue invisible until the GREEN tests caught it. Documented for Phase 95.5+ contributors who might add other backgrounded hook children.

### Co-commit pattern (parallel-execution disclosure)

Per the orchestrator's `<parallel_execution>` directive, all 3 task commits used `--no-verify`. Plan 95-04 ran in parallel with Plan 95-03 (Wave 2); the two plans had ZERO file overlap (95-03 only touches `skills/room-proactive/SKILL.md`; 95-04 touches the 6 bash hooks + 1 test + 1 audit). No commit-message attribution drift like the Plan 95-02 / 0d79863 absorbed-commit incident.

## Verification Evidence

```text
$ node tests/test-hook-envelope-shape.cjs
  ok frontmatter-schema-validator: silent path (outside room)
  ok frontmatter-schema-validator: message path (inside room, schema violation)
  ok async-artifact-auto-commit: silent path (outside room)
  ok async-artifact-auto-commit: message path (inside git-initialized room)
  ok query-efficiency-telemetry: silent path (Write tool name -> non-matcher)
  ok pre-compact: silent path (no active room)
  ok pre-compact: message path (active room)
  ok post-compact: envelope-shape valid
  ok on-file-changed: silent on diagnostic paths
  ok on-cwd-changed: silent on no-room
  ok on-cwd-changed: success path (active room resolved)
  ok on-cwd-changed: success path with NEW_DIR arg
  ok on-agent-complete: silent on no-room
  ok on-agent-complete: cascade path (recently modified files)
  ok on-task-complete: silent on no-room
  ok on-task-complete: summary path (active room)

PostToolUse hook envelope shape: 16 passed, 0 failed
EXIT_CODE=0

$ node tests/test-cascade-side-channel.cjs
  ok post-write: silent path (file outside room)
  ok post-write: message path inside room - envelope-shape valid
  ok post-write: side-channel file written atomically
  ok post-write: trigger string format invariant
  ok post-write: silent path emits zero or valid bytes

bash post-write envelope + side-channel: 5 passed, 0 failed
EXIT_CODE=0

$ grep -nE 'printf .\{"status"' scripts/pre-compact scripts/post-compact scripts/on-file-changed scripts/on-cwd-changed scripts/on-agent-complete scripts/on-task-complete | wc -l
0

$ for h in pre-compact post-compact on-cwd-changed on-agent-complete on-task-complete; do helper=...; grep -q "$helper" "scripts/$h" && echo "OK"; done
OK: scripts/pre-compact has emit_pre_compact_envelope
OK: scripts/post-compact has emit_post_compact_envelope
OK: scripts/post-compact has write_post_compact_side_channel
OK: scripts/on-cwd-changed has emit_cwd_changed_envelope
OK: scripts/on-agent-complete has emit_subagent_stop_envelope
OK: scripts/on-task-complete has emit_task_completed_envelope

$ grep -q "Phase 95-01 audit" scripts/{post-compact,on-cwd-changed,on-task-complete}
all 3 hooks annotated

$ ! grep -q "Phase 95-01 audit" scripts/session-start
session-start NOT annotated (B2 scope-leak fix)

$ grep -E "fetch|http|brain\." scripts/{pre-compact,post-compact,on-file-changed,on-cwd-changed,on-agent-complete,on-task-complete} | grep -v ^[^:]*:#
(zero hits in new code; Canon Part 8 LOCAL-only invariant preserved)
```

## RED gate trace (B3 named-failure floor evidence)

Pre-Task-2 RED state captured 10 named FAIL lines on stderr — well above the 6-floor enumerated in `<interfaces>`:

```
FAIL: pre-compact silent-path - disallowed top-level key "status" ...
FAIL: pre-compact message-path - disallowed top-level key "status" ...
FAIL: post-compact - disallowed top-level key "hookSpecificOutput" ...
FAIL: on-file-changed silent-diagnostic - disallowed top-level key "status" ...   (NOT in floor)
FAIL: on-cwd-changed silent-no-room - disallowed top-level key "status" ...        (NOT in floor)
FAIL: on-cwd-changed success-path - disallowed top-level key "status" ...
FAIL: on-cwd-changed success-path - disallowed top-level key "status" ...
FAIL: on-agent-complete silent-no-room - disallowed top-level key "status" ...     (NOT in floor)
FAIL: on-agent-complete cascade-path - stdout is not valid JSON ...
FAIL: on-task-complete silent-no-room - disallowed top-level key "status" ...      (NOT in floor)
FAIL: on-task-complete summary-path - disallowed top-level key "status" ...
```

The 6 enumerated floor scenarios all appear: pre-compact silent-path, pre-compact message-path, post-compact, on-cwd-changed success-path, on-agent-complete cascade-path, on-task-complete summary-path. RED gate count via `grep -cE "^FAIL: (pre-compact|post-compact|on-cwd-changed|on-agent-complete|on-task-complete)"` returned 10. Pass.

After Task 2 GREEN: zero FAIL lines, 16/16 ok.

## Hand-off

- **Plan 95-05 release gate**: runs `node lib/memory/run-feynman-tests.cjs` to confirm zero regression across the full Feynman suite. Both `tests/test-hook-envelope-shape.cjs` and `tests/test-cascade-side-channel.cjs` must pass on the same run. The CHANGELOG entries for v1.12.0 should write under both **Fixed** (envelope hygiene across 7 hooks total — post-write from Plan 95-02 + 6 here) and **Changed** (room-proactive cascade restoration from Plan 95-03). The ### Audit Notes section MUST include the PostCompact-side-channel-not-yet-consumed disclosure per `release-process.md` transparency. Version bump 1.11.2 -> 1.12.0.
- **Phase 95.5 or 96 (PostCompact side-channel CONSUMER)**: read `<roomDir>/.mindrian/last-post-compact.md` at next session-start and inject the full restored context as `additionalContext` (which SessionStart accepts per RESEARCH §2). Until that consumer ships, the side-channel file is written each PostCompact but never read; users will see only the brief one-line `systemMessage` in PostCompact stdout. The full restored context is not LOST (it persists on disk) but is not surfaced.
- **Cursor-branch divergence reconciliation**: `95-01-AUDIT.md` Cursor Branch Divergence section now consistent with code annotations on 3 hooks (post-compact, on-cwd-changed, on-task-complete); session-start divergence stays text-only per B2.

## Stub tracking

No stubs introduced. All 6 helpers have complete happy-path implementations and explicit soft-fail return-0 fallbacks at every failure step. PostCompact side-channel WRITER is fully wired; only the CONSUMER is deferred (a documented forward-compatibility bridge, not a stub).

## Self-Check: PASSED

Verification of claims:

- `tests/test-hook-envelope-shape.cjs` extended in commit 1d2d6ce: FOUND.
- 6 bash hooks modified in commit 70672dc: FOUND (`scripts/pre-compact`, `scripts/post-compact`, `scripts/on-file-changed`, `scripts/on-cwd-changed`, `scripts/on-agent-complete`, `scripts/on-task-complete`).
- `.planning/phases/95-bash-hook-envelope-and-cascade-side-channel/95-01-AUDIT.md` updated in commit fbf02e9: FOUND.
- All 3 commits exist in `git log`: 1d2d6ce (test RED), 70672dc (feat GREEN), fbf02e9 (docs audit) — FOUND.
- `node tests/test-hook-envelope-shape.cjs` -> 16/16 passed: VERIFIED.
- `node tests/test-cascade-side-channel.cjs` -> 5/5 passed (zero regression): VERIFIED.
- `grep -nE 'printf .\{"status"' scripts/{6 hooks}` -> 0: VERIFIED.
- All 6 per-event helpers present in their respective hooks: VERIFIED.
- `write_post_compact_side_channel` present in scripts/post-compact: VERIFIED.
- 3 hooks annotated with `Phase 95-01 audit` (post-compact, on-cwd-changed, on-task-complete); session-start NOT annotated: VERIFIED.
- 95-01-AUDIT.md §Spot-Audit Notes placeholder removed; "Spot-audit performed 2026-04-29" present: VERIFIED.
