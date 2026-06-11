---
phase: quick-260611-nob
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/mcp/tool-router.cjs
  - scripts/write-scope-check.cjs
  - test/83-write-scope-check.test.cjs
  - tests/test-tool-router-grouped-reference.cjs
autonomous: true
requirements: []
must_haves:
  truths:
    - "MCP orchestration grouped sub-commands (rooms-new, scout-health, act-chain, and the other 11) resolve their family base reference instead of silently no-oping"
    - "loadReference still returns null for unknown commands (no accidental fallback)"
    - "A blocked write to a MindrianRooms root-level file (e.g. INDEX.md) names it a root file and never suggests /mos:rooms switch <filename>"
    - "All pre-existing behavior of both files is unchanged: exact-name reference lookups, sealed-room blocks, cross-room blocks, fail-open paths"
  artifacts:
    - path: "lib/mcp/tool-router.cjs"
      provides: "Grouped-prefix fallback in loadReference + loadReference exported via module.exports._test"
      contains: "rooms-"
    - path: "scripts/write-scope-check.cjs"
      provides: "isRootLevelFile helper + root-level-file block branch with accurate message"
      contains: "isRootLevelFile"
    - path: "test/83-write-scope-check.test.cjs"
      provides: "Test case 8: rooms-root file write blocked with accurate message"
      contains: "root file"
  key_links:
    - from: "tests/test-tool-router-grouped-reference.cjs"
      to: "lib/mcp/tool-router.cjs"
      via: "module.exports._test.loadReference"
      pattern: "_test\\.loadReference"
    - from: "scripts/write-scope-check.cjs main()"
      to: "isRootLevelFile branch"
      via: "branch placed after activeRoom check, before isSealed check"
      pattern: "isRootLevelFile\\(realRoot"
---

<objective>
Fix two root-caused dogfood bugs from the 2026-06-11 session. Root-cause investigation is complete; this plan transcribes verified findings into two atomic fix tasks.

Bug A: lib/mcp/tool-router.cjs loadReference() misses grouped orchestration sub-commands (rooms-*, scout-*, act-*). The reference-prompt pattern executes nothing itself, so a missing reference is a silent no-op: live MCP rooms-new created no room and echoed stale state as if it were a result.

Bug B: scripts/write-scope-check.cjs classifies a MindrianRooms root-level file (e.g. INDEX.md) as a "room" and emits the nonsense remediation "/mos:rooms switch INDEX.md", a filename where a room name belongs.

Purpose: restore the MCP orchestration surface to working and make the write-scope hook's HITL message accurate. Both fixes are Part 8-neutral (no Brain egress changes), CJS only, zero new dependencies.

Output: both fixes committed with their RED-to-GREEN tests; full regression suites for both files passing.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@lib/mcp/tool-router.cjs (loadReference at lines ~237-247; module.exports._test block at lines ~1030-1036)
@scripts/write-scope-check.cjs (targetRoomUnderRoot at lines ~110-118; main() at lines ~161-227)
@tests/test-tool-router-grouped-reference.cjs (RED test for Bug A, ALREADY in working tree, uncommitted)
@test/83-write-scope-check.test.cjs (existing 7-case harness; runs the hook via bash wrapper scripts/write-scope-check)
</context>

<critical_constraints>
- No em-dashes in ANY output (code comments, test names, commit messages, block messages). Use hyphens.
- CJS only. Zero new dependencies. Node built-in assert only in tests.
- The working tree has UNRELATED uncommitted changes (.planning/config.json, .planning/seeds/INDEX.md, lib/hmi/dial-presenter.cjs, .umbilical). Stage ONLY the four files this plan touches, by explicit path. NEVER run git add -A or git add -u.
- Part 8-neutral: neither fix may add any network call, Brain query, or egress surface.
</critical_constraints>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Grouped-prefix fallback in loadReference + _test export (Bug A)</name>
  <files>lib/mcp/tool-router.cjs, tests/test-tool-router-grouped-reference.cjs</files>
  <behavior>
    RED test ALREADY EXISTS at tests/test-tool-router-grouped-reference.cjs (uncommitted, in working tree). Do NOT rewrite it. It asserts:
    - Test 1: router._test.loadReference is a function (currently undefined, so the suite is RED)
    - Test 2: exact command 'rooms' still resolves commands/rooms.md (no behavior change)
    - Tests 3-16: all 14 grouped sub-commands (rooms-list, rooms-new, rooms-open, rooms-close, rooms-archive, rooms-where, scout-health, scout-deadlines, scout-competitors, scout-hsi, scout-snapshot, act-chain, act-swarm, act-dry-run) resolve a non-empty reference
    - Test 17: 'totally-unknown-cmd' returns null (no accidental fallback)
  </behavior>
  <action>
    First confirm RED: run node tests/test-tool-router-grouped-reference.cjs and verify it fails on the _test.loadReference assertion.

    Then in lib/mcp/tool-router.cjs:

    1. Define a module-level constant near loadReference (around line 233):
       GROUPED_PREFIX_FALLBACK, a plain object mapping grouped command prefixes to their family base reference name: { 'rooms-': 'rooms', 'scout-': 'scout', 'act-': 'act' }.

    2. Extend loadReference(pluginRoot, command) (lines ~237-247). Keep the two existing exact-name lookups FIRST and unchanged (references/methodology/<command>.md, then commands/<command>.md). ONLY after both miss, iterate the entries of GROUPED_PREFIX_FALLBACK; if command starts with a prefix, resolve via safeReadFile(path.join(pluginRoot, 'commands', base + '.md')) and return it when non-null. If no prefix matches (or the family file is missing), return null exactly as today. Rationale comment in the code: router 9 registers grouped sub-commands but instruction files ship per command FAMILY; the reference IS the instruction set, so a miss is a silent no-op.

    3. Add loadReference to the existing module.exports._test object at the end of the file (lines ~1030-1036, the 87-05 pattern already exporting SECTION_RE, sectionOptional, sectionRequired, safeResolveSection, opportunitySchema). Do not change the primary module.exports line.

    Why exact-name-first: a future per-subcommand file (e.g. commands/rooms-new.md) must win over the family fallback automatically. Why a closed map instead of splitting on '-': dozens of unrelated commands contain hyphens (act-on-insight class names, find-bottlenecks, etc.); a generic split would make unknown commands accidentally resolve, violating the null contract.
  </action>
  <verify>
    <automated>node tests/test-tool-router-grouped-reference.cjs</automated>
  </verify>
  <done>
    Test suite exits 0 with all 17 checks ok: _test.loadReference exported, exact 'rooms' resolves, all 14 grouped sub-commands resolve non-empty, unknown command returns null. No other export or function in tool-router.cjs changed.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Accurate rooms-root file classification in write-scope-check (Bug B)</name>
  <files>scripts/write-scope-check.cjs, test/83-write-scope-check.test.cjs</files>
  <behavior>
    - Test 8 (new, RED first): root with room alpha active, write targets INDEX.md at the MindrianRooms root. runHook with an Edit payload. Assert status === 2; assert /root file/i.test(stderr); assert !stderr.includes('switch INDEX.md'). Currently RED: the hook misclassifies INDEX.md as a room and emits 'switch INDEX.md'.
    - Tests 1-7 (existing): must keep passing unchanged (active-room allow, cross-room block, sealed block, outside-root allow, three fail-open allows).
  </behavior>
  <action>
    Step 1, RED test: Read test/83-write-scope-check.test.cjs, then Edit it to append test case 8 immediately BEFORE the Runner section (line ~275), following the existing mkFixture/mkRoomsRoot/runHook pattern. Fixture: mkRoomsRoot with rooms [{ name: 'alpha' }] and registry { active: 'alpha', rooms: {} }; create the target file at path.join(root, 'INDEX.md') with fs.writeFileSync so it exists at depth 1; runHook({ tool_name: 'Edit', tool_input: { file_path: target } }, root). Assertions per the behavior block above. Also update the header comment from 'Seven test cases' to 'Eight test cases' and add the one-line case description (the comment is documentation of the harness contract). Run node test/83-write-scope-check.test.cjs and confirm exactly case 8 fails (7/8 passed).

    Step 2, fix scripts/write-scope-check.cjs:

    1. Add helper isRootLevelFile(root, target) next to targetRoomUnderRoot (after line ~118):
       - rel = path.relative(root, target); return false if rel is empty, starts with '..', or path.isAbsolute(rel)
       - segments = rel.split(path.sep).filter(Boolean); return false unless segments.length === 1
       - try fs.statSync(target).isDirectory(); return !isDir
       - on stat error (nonexistent depth-1 path), return true: an agent creating a new root-level FILE is the case this hook must catch; creating a new room directory goes through /mos:rooms new, not a raw Write
    2. In main(), insert the branch AFTER the activeRoom null check (line ~205, 'if (!activeRoom) return allow();') and BEFORE 'const sealed = isSealed(...)'. If isRootLevelFile(realRoot, resolvedTarget) is true, call block() with:
       - stderr message that (a) names the target a 'MindrianRooms root file' (include the filename, i.e. the targetRoom value, which at depth 1 IS the filename), (b) states the rooms root is a shared routing surface, not a room, (c) does NOT suggest '/mos:rooms switch <file>', (d) tells the agent that with explicit user approval the edit can be applied via a shell command or /mos:rooms maintenance
       - systemMessage: 'blocked write to rooms-root file ' + targetRoom + ' (active: ' + activeRoom + ')'
    3. Change NOTHING else: keep blocking via the existing block() helper (exit 2), keep fail-open behavior on parse/resolution errors, keep the sealed and cross-room branches byte-identical. Fail-closed HITL is correct here; only the classification and message change.

    Why before isSealed: isSealed(root, 'INDEX.md') probes root/INDEX.md/GUARDRAIL.md, a path under a file; classifying first avoids that nonsense probe and guarantees the root-file message wins over the cross-room message.
  </action>
  <verify>
    <automated>node test/83-write-scope-check.test.cjs</automated>
  </verify>
  <done>
    All 8 cases pass (8/8). Case 8 proves exit code 2, a /root file/i message, and no 'switch INDEX.md' remediation. Cases 1-7 unchanged and green.
  </done>
</task>

<task type="auto">
  <name>Task 3: Full regression run + scoped commit</name>
  <files>none (verification and commit only)</files>
  <action>
    Run BOTH full test files, not just the new cases:
    - node tests/test-tool-router-grouped-reference.cjs (exit 0, ALL PASS)
    - node test/83-write-scope-check.test.cjs (exit 0, 8/8 passed)

    Then commit ONLY the four files this plan touched, by explicit path (the working tree carries unrelated uncommitted changes that must NOT be staged):

    git add lib/mcp/tool-router.cjs tests/test-tool-router-grouped-reference.cjs scripts/write-scope-check.cjs test/83-write-scope-check.test.cjs
    git commit -m "fix: grouped orchestration reference fallback + accurate rooms-root write-scope message"

    Before committing, run git status and confirm the staged set is exactly those four files. Do NOT run git add -A, git add -u, or git commit -a. Do NOT push and do NOT bump the version; the release ceremony (CHANGELOG + plugin.json + tag) is a separate user-initiated step per the release process.
  </action>
  <verify>
    <automated>git diff --cached --name-only | sort | diff - <(printf 'lib/mcp/tool-router.cjs\nscripts/write-scope-check.cjs\ntest/83-write-scope-check.test.cjs\ntests/test-tool-router-grouped-reference.cjs\n') && node tests/test-tool-router-grouped-reference.cjs && node test/83-write-scope-check.test.cjs</automated>
  </verify>
  <done>
    Both suites green, one commit on main containing exactly the four plan files, unrelated working-tree changes (.planning/config.json, .planning/seeds/INDEX.md, lib/hmi/dial-presenter.cjs, .umbilical) left untouched and unstaged.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| PreToolUse hook stdin | Untrusted tool payload parsed by write-scope-check.cjs (already fail-open on bad input; unchanged) |
| MCP command name to filesystem path | loadReference builds a path from the command string |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-01 | Tampering | loadReference grouped fallback | mitigate | Closed prefix map ({'rooms-','scout-','act-'}) resolves only to three fixed family files; no user-controlled path segments introduced; unknown commands return null (test 17 enforces) |
| T-quick-02 | Elevation | write-scope-check root-file branch | mitigate | Branch only ADDS a block path (fail-closed); allow paths unchanged; existing fail-open on parse errors preserved |
| T-quick-SC | Tampering | package installs | accept | Zero new dependencies; no npm/pip/cargo installs in this plan |
</threat_model>

<verification>
- node tests/test-tool-router-grouped-reference.cjs exits 0 (was RED on _test.loadReference before the fix)
- node test/83-write-scope-check.test.cjs exits 0 with 8/8 passed (case 8 was RED before the fix)
- git show --stat HEAD lists exactly the four plan files
- grep confirms no em-dash characters were introduced in any of the four files
</verification>

<success_criteria>
- All 14 grouped orchestration sub-commands resolve their family reference; MCP rooms-new no longer silently no-ops on a missing reference
- Unknown commands still return null from loadReference
- A write to a MindrianRooms root-level file is blocked with an accurate root-file message and no 'switch <filename>' remediation; sealed and cross-room messages unchanged
- Both full regression suites green; one scoped commit; unrelated working-tree changes untouched
</success_criteria>

<output>
Create `.planning/quick/260611-nob-fix-grouped-orchestration-reference-fall/260611-nob-SUMMARY.md` when done.
</output>
