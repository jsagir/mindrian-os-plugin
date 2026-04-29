---
phase: 95-bash-hook-envelope-and-cascade-side-channel
plan: 02
subsystem: bash-hooks-envelope-hygiene
tags: [bash, post-write, hook, envelope, side-channel, atomic-write, cascade, canon-part-8]
requirements: [BASH-95-01, BASH-95-02]
canon_parts:
  - "Part 4 - Every Choice Is Graph Data (cascade payload now reaches the skill so decision edges can flow per Plan 95-03)"
  - "Part 6 - Product-as-Venture Dog-Fooding (the plugin's own room produces last-cascade.json on first write inside a section)"
  - "Part 8 - Graph Boundary (side-channel file stays LOCAL; never network)"
dependency_graph:
  requires: [95-01-AUDIT.md]
  provides: ["scripts/post-write schema-valid envelope", "<roomDir>/.mindrian/last-cascade.json side-channel JSON file"]
  affects: ["Plan 95-03 SKILL.md trigger reader (reads last-cascade.json)", "Plan 95-04 mirroring emit_post_tool_use_envelope across 6 other bash hooks"]
tech_stack:
  added: []
  patterns:
    - "jq -nc --arg / --argjson envelope construction (no bash string interpolation)"
    - "atomic side-channel write via mktemp inside SIDE_DIR + mv -f (POSIX rename(2) same-filesystem invariant)"
    - "soft-fail invariant: every helper returns 0 on any failure, hook exits 0 on every code path"
key_files:
  created:
    - tests/test-cascade-side-channel.cjs
    - .planning/phases/95-bash-hook-envelope-and-cascade-side-channel/95-02-post-write-side-channel-writer-SUMMARY.md
  modified:
    - scripts/post-write
    - lib/memory/run-feynman-tests.cjs
decisions:
  - "Side-channel file path is `<roomDir>/.mindrian/last-cascade.json` (single-file overwrite, NOT a log); cascade-edges in room.db remain the durable record"
  - "Atomic write via mktemp template form (no -p flag) for BSD/macOS portability; same-filesystem invariant guarantees POSIX rename(2)"
  - "Dog-food smoke artifact step (W4 fix) replaced by regression test fixtures because writing a bare .md into a section root would violate CLAUDE.md Decision #16 (Obsidian Vault Nested Structure v1.9.7) and the plugin's own room would dog-food-detect it as a CONTRADICTS edge per Canon Part 6"
  - "Test sandbox uses Strategy 0 (.rooms/registry.json + MINDRIAN_ROOMS_HOME) to coerce scripts/resolve-room into recognizing the synthetic room as active so the post-write active-room guard at lines 132-138 lets the cascade through; without this, the guard silently exits and the side-channel writer never runs"
metrics:
  duration: "6min26s"
  completed: "2026-04-29T18:55:05Z"
  tasks_completed: 2
  files_changed: 3
  files_created: 1
---

# Phase 95 Plan 02: post-write Side-Channel Writer Summary

JWT-style one-liner: replace the bash post-write hook's 6-key root cascade payload with a Claude Code 2.x compliant `hookSpecificOutput.additionalContext` envelope and relocate the full cascade payload to an atomically-written LOCAL side-channel JSON file at `<roomDir>/.mindrian/last-cascade.json`, restoring the silently-broken Phase 88.1-03 mid-session intelligence loop without touching the soft-fail or 88-04 triple-fire invariants.

## Outcome

The bash `scripts/post-write` hook stopped emitting an invalid-by-Claude-Code-2.x-schema 6-key cascade payload (`cascade_status` + `classification` + `git_commit` + `graph_index` + `proactive_intelligence` + `systemMessage` at JSON root) and now emits ONE `{ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: <one-line> } }` JSON object. The cascade payload moves to `<roomDir>/.mindrian/last-cascade.json` as a single-file-overwrite atomic write. The skills/room-proactive/SKILL.md trigger contract update (Plan 95-03) consumes the side-channel file via the Read tool when its `additionalContext` prefix matches.

This is the LOAD-BEARING fix of Phase 95: the bash hook has been emitting non-conforming envelopes since Phase 88.1-03 shipped, silently tolerated because the recognized `systemMessage` sibling masked the 5 unknown root keys. The fix is a direct mirror of the v1.10.19 / v1.11.2 .cjs hook patches, applied to the bash equivalent.

## Tasks Completed

### Task 1 - RED test fence (commit absorbed into 0d79863)

Created `tests/test-cascade-side-channel.cjs` (470 lines) with 5 scenarios:

1. **silent path (file outside room)** - synthetic envelope with no `.room-root` walk hit and no STATE.md; assert exit 0 + envelope-shape valid (tolerates empty stdout for the 88-04 silent path).
2. **message path inside room - envelope-shape valid** - synthetic Strategy-0 room (`.rooms/registry.json` + `.room-root` + STATE.md + section dir); MINDRIAN_ROOMS_HOME points at scratch so resolve-room locates it; `Decision #16` nested artifact at `section/test-artifact/test-artifact.md`; assert exit 0 + JSON parses + every top-level key in `{continue, stopReason, suppressOutput, systemMessage, decision, reason, hookSpecificOutput}` + `additionalContext` NOT at root + `hookSpecificOutput.hookEventName === "PostToolUse"` + `additionalContext` is a string.
3. **side-channel file written atomically** - same room layout; assert `<roomDir>/.mindrian/last-cascade.json` exists, parses as JSON, contains the 8 required keys (timestamp, file_path, section, cascade_status, classification, git_commit, graph_index, proactive_intelligence), `cascade_status === "complete"`, timestamp matches ISO 8601 `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$`.
4. **trigger string format invariant** - same room layout; assert envelope-shape valid AND `hookSpecificOutput.additionalContext` starts with one of the two recognized prefixes (`post-write: cascade complete ` or `queued MINTO regen for `) so the SKILL.md trigger contract in Plan 95-03 keys reliably.
5. **silent path with no STATE.md walk hit** - file path under `/tmp/nonexistent-<ts>.md`; assert exit 0 + envelope-shape passes.

Helpers cloned from `tests/test-hook-envelope-shape.cjs`: `makeScratchDir`, `rmrf`, `ALLOWED_TOP_LEVEL` set, `assertEnvelopeShape`. The `runBashHook` variant spawns `bash` instead of `node`. The `makeRoomRoot` helper creates the Strategy-0 layout (`.rooms/registry.json` + `.room-root` + STATE.md + section dir) and the test passes `env.MINDRIAN_ROOMS_HOME = scratch` so the post-write active-room guard at lines 132-138 lets the cascade through. Without this, `scripts/resolve-room` returns the user's real active room and the guard silently exits before the cascade block, breaking Tests 2-4.

Registered in `lib/memory/run-feynman-tests.cjs` immediately after the existing `test-hook-envelope-shape.cjs` entry (line 279) with a 6-line comment block citing Canon Part 8 LOCAL-only constraint.

**RED verification (before Task 2):** 3 of 5 scenarios FAILED:
- Test 2: `disallowed top-level key "cascade_status"` (the 6-key root payload from line 187 of pre-patch post-write).
- Test 3: side-channel file does not exist at `<roomDir>/.mindrian/last-cascade.json`.
- Test 4: same `cascade_status` disallowed-key error as Test 2.

Tests 1 and 5 (silent paths with no cascade fire) passed in RED state because they tolerate empty stdout. Exit code 1 confirmed RED.

### Task 2 - GREEN patch (commit fe53b97)

Modified `scripts/post-write`:

**Step A** - Added two helper functions immediately after `detect_room_section` (before the stdin-read block):

- `emit_post_tool_use_envelope(msg)` - empty input returns 0 silently; non-empty emits exactly one JSON line via `jq -nc --arg m` constructing `{ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: $m } }`.
- `write_cascade_side_channel(room_dir, file_path, section, cascade_output)` - soft-fails on empty room_dir or empty cascade_output (returns 0); creates `$room_dir/.mindrian` via `mkdir -p`; constructs the 8-key payload via `jq -nc --arg ts/--arg fp/--arg sec/--argjson cascade` with `// null` defaults so absent inner fields don't break jq; writes atomically via `mktemp "$side_dir/.last-cascade.json.XXXXXX"` (template-form, NO `-p` flag for BSD/macOS portability per RESEARCH.md Section 10 risk register) + `printf '%s\n' "$payload" > "$tmp"` + `mv -f "$tmp" "$side_dir/last-cascade.json"`. Every step soft-fails to `return 0` and cleans up the temp file on failure.

**Step B** - Replaced the broken envelope construction (the entire `if command -v jq ... CASCADE_STATUS=$(...) ... else ... fi` block plus the trailing `echo "$CASCADE_STATUS"`) with two helper calls:

```bash
write_cascade_side_channel "$room_dir" "$FILE_PATH" "${SECTION:-unknown}" "$CASCADE_OUTPUT"
emit_post_tool_use_envelope "$SM_TEXT"
```

**Step C** - Confirmed `grep -c "CASCADE_STATUS" scripts/post-write` returns 0 (variable removed entirely).

**Step D** - Confirmed `SM_TEXT` derivation block (lines 249-260) is byte-identical. The two trigger-format prefixes (`post-write: cascade complete for ` and `queued MINTO regen for `) live verbatim on lines 257 and 259 - the SKILL.md trigger contract in Plan 95-03 keys off these exact strings.

**Step E** - `node tests/test-cascade-side-channel.cjs` -> 5/5 passed (GREEN).

**Step F** - `node tests/test-hook-envelope-shape.cjs` -> 5/5 passed (zero regression on the v1.11.2 .cjs reference patches).

**Step G** - Dog-food smoke artifact deferred (see Deviations).

## Files Changed

### Created

- `tests/test-cascade-side-channel.cjs` (470 lines) - RED-fence-then-GREEN regression test for bash post-write envelope shape + cascade side-channel atomic write contract. 5 scenarios. Helpers self-contained.

### Modified

- `scripts/post-write` (+85 / -23 lines) - 2 helper functions added (after line 47); broken envelope construction replaced (lines 264-284 of pre-patch -> 2-line helper-call block). CASCADE_STATUS variable removed. SM_TEXT derivation + 88-04 triple-fire + STATE.md walk-up + active-room guard + final `exit 0` all preserved verbatim.
- `lib/memory/run-feynman-tests.cjs` (+7 lines) - Registered `tests/test-cascade-side-channel.cjs` immediately after `tests/test-hook-envelope-shape.cjs` (line 279) with a 6-line comment block.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Active-room guard prevented cascade in test fixtures**

- **Found during:** Task 1 RED verification.
- **Issue:** Initial test draft did not set `MINDRIAN_ROOMS_HOME` for the `runBashHook` env. As a result, `scripts/resolve-room` resolved the user's real active room (`~/MindrianRooms/mindrianOS`) instead of the synthetic room in scratch, the post-write active-room guard at lines 132-138 took the silent-exit branch, and Tests 2 / 3 / 4 ALL passed by silent-tolerance (Test 2 envelope-shape allows empty stdout; Test 3 caught nothing because the cascade never fired; Test 4 trigger-prefix allows empty). The fence was not red on the bug it was supposed to fence.
- **Fix:** Updated `makeRoomRoot` to also create a Strategy-0 `.rooms/registry.json` declaring the synthetic room as active. Updated the `runBashHook` calls in Tests 2 / 3 / 4 to pass `env: { MINDRIAN_ROOMS_HOME: scratch }`. After the fix, Tests 2-4 properly RED (3 failures) on pre-patch post-write. Documented the rationale in a comment block in the test file.
- **Files modified:** `tests/test-cascade-side-channel.cjs`.
- **Commit:** absorbed into 0d79863 (see Authentication Gates / Co-Commit note below).

### Co-Commit Note (parallel-execution side effect)

Task 1 was authored as `git add tests/test-cascade-side-channel.cjs lib/memory/run-feynman-tests.cjs` followed by a `git commit --no-verify` with a `test(95-02): ...` message. Before the commit could land under that message, an unrelated parallel git operation (the post-write hook from a sibling agent's work, or an earlier in-flight ROADMAP commit attempt) absorbed the staged files into commit `0d79863 docs(95-01): add Phase 95 entry to ROADMAP.md`. Verified via `git show 0d79863 --stat`: the commit contains the 470-line `tests/test-cascade-side-channel.cjs` plus the 7-line `lib/memory/run-feynman-tests.cjs` registration. The work landed; only the commit-message attribution drifted. Task 2 committed cleanly under `feat(95-02): ...` at `fe53b97`.

This is the documented hazard of the parallel-executor protocol (the orchestrator's `<parallel_execution>` directive uses `--no-verify` precisely to avoid pre-commit-hook contention, but cannot prevent concurrent index races). No code or content was lost. The phase progress signal is intact.

### Smoke step deferred (per plan W4 fix)

Dog-food smoke artifact deferred per CLAUDE.md Decision #16 nested-structure rule (writing `_smoke-test-95-02.md` directly into `room/problem-definition/` without a folder wrapper would violate the Obsidian Vault Nested Structure v1.9.7 invariant, which the plugin's own room would dog-food-detect as a CONTRADICTS edge per Canon Part 6). Regression test fixtures (Tests 2-5) provide equivalent evidence by exercising `scripts/post-write` inside scratch directories with the cascade actually fired through the MINDRIAN_ROOMS_HOME-resolved synthetic room. The atomic write, the side-channel file shape, and the envelope shape are all asserted end-to-end via spawnSync.

## Verification Evidence

```text
$ node tests/test-cascade-side-channel.cjs
  ok post-write: silent path (file outside room)
  ok post-write: message path inside room - envelope-shape valid
  ok post-write: side-channel file written atomically
  ok post-write: trigger string format invariant
  ok post-write: silent path emits zero or valid bytes

bash post-write envelope + side-channel: 5 passed, 0 failed
EXIT_CODE=0

$ node tests/test-hook-envelope-shape.cjs
  ok frontmatter-schema-validator: silent path (outside room)
  ok frontmatter-schema-validator: message path (inside room, schema violation)
  ok async-artifact-auto-commit: silent path (outside room)
  ok async-artifact-auto-commit: message path (inside git-initialized room)
  ok query-efficiency-telemetry: silent path (Write tool name -> non-matcher)

PostToolUse hook envelope shape: 5 passed, 0 failed
EXIT_CODE=0

$ grep -c "CASCADE_STATUS" scripts/post-write
0

$ grep -nE "emit_post_tool_use_envelope|write_cascade_side_channel" scripts/post-write
76:emit_post_tool_use_envelope() {
90:write_cascade_side_channel() {
266:  write_cascade_side_channel "$room_dir" "$FILE_PATH" "${SECTION:-unknown}" "$CASCADE_OUTPUT"
267:  emit_post_tool_use_envelope "$SM_TEXT"

$ grep -E "fetch|http|brain\." scripts/post-write
(zero hits - Canon Part 8 LOCAL-only invariant preserved)
```

## Hand-off

- **Plan 95-03** reads `<roomDir>/.mindrian/last-cascade.json` via the Read tool when `skills/room-proactive/SKILL.md` sees PostToolUse `additionalContext` matching `^post-write: cascade complete ` or `^queued MINTO regen for `. The trigger string format is fenced by Test 4; the file shape is fenced by Test 3.
- **Plan 95-04** mirrors the `emit_post_tool_use_envelope` helper across the 6 other broken bash hooks (`pre-compact`, `post-compact`, `on-file-changed`, `on-cwd-changed`, `on-agent-complete`, `on-task-complete`). Per-event variants apply: SubagentStop also accepts `hookSpecificOutput.additionalContext`; PostCompact / TaskCompleted / FileChanged / CwdChanged do NOT accept `hookSpecificOutput` per the Claude Code 2.x schema, so they emit only `{ systemMessage: <msg> }`. The bash helper pattern is reusable but the inner JSON shape differs per event.
- **Plan 95-05** runs the full `node lib/memory/run-feynman-tests.cjs` suite. Both `tests/test-hook-envelope-shape.cjs` and `tests/test-cascade-side-channel.cjs` must pass on the same run.

## Stub tracking

No stubs introduced. The two helper functions have full happy-path implementations and explicit soft-fail return-0 fallbacks at every failure step.

## Self-Check: PASSED

Verification of claims:

- `tests/test-cascade-side-channel.cjs` exists at `/home/jsagi/MindrianOS-Plugin/tests/test-cascade-side-channel.cjs`: FOUND.
- `lib/memory/run-feynman-tests.cjs` registers the new test: FOUND (line 286 in HEAD).
- `scripts/post-write` contains both helpers + zero CASCADE_STATUS hits: FOUND (helpers at lines 76 + 90; calls at lines 266-267; CASCADE_STATUS grep -c -> 0).
- Commit `fe53b97` exists in `git log`: FOUND.
- Commit `0d79863` (Task 1 absorbed) exists in `git log` and contains the 470-line test file via `git show --stat`: FOUND.
