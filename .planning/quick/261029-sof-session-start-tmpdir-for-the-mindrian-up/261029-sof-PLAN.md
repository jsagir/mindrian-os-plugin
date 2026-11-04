---
phase: quick-261029-sof
plan: 01
type: execute
quick_id: 261029-sof
slug: session-start-tmpdir-for-the-mindrian-up
date: 2026-10-29
wave: 1
depends_on: []
files_modified:
  - tests/test-3696-isolation.cjs
  - scripts/session-start
  - scripts/isolate-larry-voice.cjs
  - skills/context-engine/SKILL.md
  - .planning/debug/sessionstart-npm-reconcile-no-isolation-switch.md
  - .planning/debug/knowledge-base.md
autonomous: true
requirements:
  - QUICK-261029-sof
canon_parts: [8]
tags: [hooks, sessionstart, tmpdir, isolation, 369.6-startup-chain]

must_haves:
  truths:
    - 'With TMPDIR unset, or set to the empty string, the three session-start paths resolve to the same strings as today: /tmp/mindrian-context-state, /tmp/mindrian-update-check and /tmp/mos-sealed-<pid>'
    - 'With TMPDIR set, the same three lines resolve under TMPDIR, so a caller that sets TMPDIR keeps every session-start temp read and write under its own root'
    - 'The reader and the writer of each file resolve one path: each file name appears on exactly one line of scripts/session-start (the BRIDGE_FILE and UPDATE_CACHE assignments) and every other use goes through that variable'
    - 'scanFile of scripts/session-start returns an empty list, STARTUP_CONTAINMENT evidence holds at the stated lines, the SessionStart verdict is containable with no blocker, and the session-start capture of the isolation test runs instead of being refused'
    - 'A run-time proof exists: values seeded under the scratch TMPDIR reach the session context (reader), and the daily update check creates mindrian-update-check under the scratch TMPDIR (writer)'
    - 'No literal /tmp/mindrian remains in scripts/session-start and the isolation test fails on any reintroduction; the known-escape tolerance in B8 is removed'
    - 'The change adds no process spawn and no line: scripts/session-start keeps 2092 lines, so the evidence line numbers 1867 and 1980 hold'
  artifacts:
    - path: scripts/session-start
      provides: "the three temp paths derived from TMPDIR with the /tmp default"
      contains: 'UPDATE_CACHE="${TMPDIR:-/tmp}/mindrian-update-check"'
    - path: scripts/isolate-larry-voice.cjs
      provides: "STARTUP_CONTAINMENT evidence for session-start that matches the new line texts"
      contains: 'BRIDGE_FILE="${TMPDIR:-/tmp}/mindrian-context-state"'
    - path: skills/context-engine/SKILL.md
      provides: "the bridge-file instruction that names the temp folder, not a literal /tmp path"
      contains: "TMPDIR"
    - path: tests/test-3696-isolation.cjs
      provides: "legs B8d to B8j and a B8a with an empty known set"
      contains: "B8j"
  key_links:
    - from: scripts/session-start
      to: "TMPDIR of the caller"
      via: 'the expansion ${TMPDIR:-/tmp} on BRIDGE_FILE, UPDATE_CACHE and the mktemp fallback'
      pattern: 'TMPDIR:-/tmp\}/(mindrian-context-state|mindrian-update-check|mos-sealed)'
    - from: scripts/isolate-larry-voice.cjs
      to: scripts/session-start
      via: "evidenceHolds: substring of the evidence text at the stated line"
      pattern: "ev\\('scripts/session-start'"
    - from: tests/test-3696-isolation.cjs
      to: scripts/session-start
      via: "static text legs, bash evaluation of the shipped lines, and a seeded session-start capture"
      pattern: "B8[d-j]"
---

<objective>
Make the three literal temp paths of `scripts/session-start` follow TMPDIR, so the Phase 369.6 isolation canary can run the session-start capture. This closes gap 2 of `.planning/debug/sessionstart-npm-reconcile-no-isolation-switch.md`.

Purpose: a caller that sets TMPDIR (the eval scratch root) keeps every temp read and write under its own root. A caller without TMPDIR gets the same paths as today, byte for byte. Cells 2, 3, 2s and 3s of the Larry eval need this before plan 369.6-05.

Output: three one-line substitutions in `scripts/session-start`, the matching evidence lines in `scripts/isolate-larry-voice.cjs`, one doc line in `skills/context-engine/SKILL.md`, seven new test legs in `tests/test-3696-isolation.cjs`, and the RCA closed.

Coverage of the request (every clause maps to a task):
- Line 413 BRIDGE_FILE, line 1332 mktemp fallback, line 1829 UPDATE_CACHE become `${TMPDIR:-/tmp}/...`: Task 2.
- Sweep of every writer and reader, with reader and writer resolving one file: the table in the context block (proven by grep), the SKILL.md line in Task 2, the census leg B8f in Task 1.
- A test that greps `scripts/session-start` for a literal `/tmp/mindrian` and fails on any hit: leg B8d, Task 1.
- Run `node tests/test-3696-isolation.cjs` and confirm the scan leg has no `hardcoded_path_write` blocker: Task 3.
- Decision on the evidence table of `scripts/isolate-larry-voice.cjs` (lines 430 to 433): update it. `evidenceHolds` is a substring match at the stated line. The three old texts disappear after the substitution, so B5b fails and the verdict gets an `evidence_stale` blocker. PROVEN in a throwaway worktree: with only the three substitutions, the test printed PASS 62 FAIL 1 (B5b) and the session-start hook was not executed; with the evidence update, PASS 63 FAIL 0 and no blocker. Task 2.
- `git commit --only`, no `git stash`, no em dash, no en dash: Task 3 and every task.

No ROADMAP phase, no REQUIREMENTS entry and no CONTEXT.md exist for a quick task. The RCA file is the source of truth for the goal. Deferred ideas: none.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/debug/sessionstart-npm-reconcile-no-isolation-switch.md
@scripts/isolate-larry-voice.cjs
@tests/test-3696-isolation.cjs

Project skills in .claude/skills (agentshield, claude-md-optimizer, mindrian-mcp-app, spike-findings-MindrianOS-Plugin) do not apply to a bash hook path change. No rule from them is needed.

Discovery level 0: the pattern `${TMPDIR:-/tmp}/...` already exists in the same file (`scripts/session-start` line 144) and in `scripts/render-viz:160` and `scripts/resolve-room:132`. No new dependency. No package install, so no Package Legitimacy Audit applies.

## Proven reader and writer table (planner ran the greps on 2026-10-29)

Commands run from the worktree root: `git grep -n -I` over tracked files, `grep -rIn` over all files (no `.git`, `node_modules`, `.planning`), `grep -rIl` over `~/.claude` (settings.json, settings.local.json, statusline-mos, hooks, plugins). Files with no extension (scripts/session-start, scripts/context-monitor, scripts/track-analytics, scripts/check-update) were included in every run.

File `mindrian-update-check` (variable UPDATE_CACHE):
- Assignment: `scripts/session-start:1829`.
- Readers, all through `"$UPDATE_CACHE"`: lines 1833 (`-f`), 1834 (`head -1`), 1838 (`sed -n 2p`), 1840 (`sed -n 3p`).
- Writers, all through `"$UPDATE_CACHE"`: lines 1848 and 1849 (auto-update success branch), and 1867, 1868 and 1871 (the detached background subshell, which also runs `scripts/check-update`).
- `scripts/check-update` and `scripts/self-update` do not name the file. `~/.mindrian/update-check.json` is a different file under HOME and is out of scope.
- Text-only mentions, no I/O: `scripts/isolate-larry-voice.cjs` lines 432 and 433, `tests/test-3696-isolation.cjs` line 285.
- No other hit anywhere, including the installed plugin copies beta.69, beta.73 and beta.75, the mos-desktop copy, and `~/.claude` user files.

File `mindrian-context-state` (variable BRIDGE_FILE):
- Assignment: `scripts/session-start:413`.
- Readers, all through `$BRIDGE_FILE`: lines 414, 415, 417 (ctx_pct) and 567, 568, 570 (model_name), 571 (ctx_pct), 572 (ctx_size).
- Writers: NONE. No file in the repo, no installed plugin copy (beta.69, beta.73, beta.75, mos-desktop, synced) and no `~/.claude` user file writes it. `git log -S` shows the last writer left in commit 256560658 (feat 54-02), which moved the bridge to `~/.mindrian/bridge/<room-hash>.json` (`scripts/context-monitor` lines 448 to 453 and 591 to 601, `scripts/track-analytics` lines 102 to 106, `scripts/statusline-fallback-echo.cjs` lines 91 to 93). The file `/tmp/mindrian-context-state` does not exist on this machine now. So the session-start tier selector always sees an absent file. This is a pre-existing defect, tracked in `.planning/debug/sessionstart-blocks-first-prompt-windows-arm64.md` (rich-tier rule). It is NOT fixed here: pointing the reader at the per-room bridge would change behavior for every user. The TMPDIR change cannot create a reader and writer mismatch because there is no writer.
- Instruction-only reader: `skills/context-engine/SKILL.md:124` tells the model to read the file. It must name the same location as session-start.
- Text-only mentions, left alone: `scripts/isolate-larry-voice.cjs:430`, `tests/test-3696-isolation.cjs:283`, `references/research/RESEARCH_15_V1.8_OPTIMIZATION_JTBD.md:78` (historic research prose), and the two generated copies `dist/generic-claude-dir/.claude/skills/context-engine/SKILL.md` and `dist/zed/.agents/skills/context-engine/SKILL.md`.

The mktemp fallback `/tmp/mos-sealed-$$` (line 1332) is a private temp file of one function. `walk_sealed_rooms` is called as `walk_sealed_rooms || true` (line 1413), so a bad TMPDIR cannot abort the hook under `set -euo pipefail`.

Do NOT edit `dist/`. `node scripts/build-dist-bundles.cjs --check-stale` reports the bundle STALE (generated from beta.52, live beta.76). The release regenerates it. Editing or regenerating it here would add a large unrelated diff.

Pre-measured on a throwaway worktree (removed): `bash -n` OK; `tests/test-k1u-session-start-envelope.cjs` (35 of 35), `test-session-start-banner.cjs`, `test-209-session-start-exemplar.cjs`, `test-267.3-session-start-declaration.cjs`, `test-session-start-node-preflight.cjs` and `test-room-context-latency.cjs` all exit 0 with the change; the isolation test takes about 50 to 75 seconds.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write the guard legs first (RED): tighten B8 and add B8d to B8j to the isolation test</name>
  <files>tests/test-3696-isolation.cjs</files>
  <behavior>
    - B8a: the known-escape set is empty, so any literal absolute path in the scanned scripts fails.
    - B8d: scripts/session-start holds no `/tmp/mindrian` and no `/tmp/mos-sealed` anywhere, comment lines included.
    - B8e: each file name sits on one line of scripts/session-start only, as the BRIDGE_FILE or UPDATE_CACHE assignment, and that line holds `${TMPDIR:-/tmp}/`.
    - B8f: the tracked code files that name either file are exactly the expected three, and none holds a bare `/tmp/mindrian-context-state` or `/tmp/mindrian-update-check`.
    - B8g: the shipped lines, run in bash with TMPDIR unset and with TMPDIR empty, give the three old strings.
    - B8h: the same lines, run in bash with TMPDIR set to `/scratch-x`, give paths under `/scratch-x`.
    - B8i: after the unseeded session-start capture of B4, the scratch TMPDIR holds `mindrian-update-check` with a date line and a status line (the writer).
    - B8j: values seeded under the scratch TMPDIR reach the full session context file (the reader).
  </behavior>
  <action>
Edit `tests/test-3696-isolation.cjs` only. Do not touch any file under `scripts/` or `skills/` in this task. This task implements the guard for gap 2 of the RCA. Use plain `function` style and `check(label, boolean, detail)` like the rest of the file. Add no em dash and no en dash (leg B11 fails on them).

1. Header comment: change the B8 line to say that no literal path remains and that the temp file names resolve through TMPDIR for the reader and the writer (static text, bash evaluation of the shipped lines, and a seeded capture). Leave the other lines.

2. In the B8 section, set `KNOWN_ESCAPES` to an empty array. Keep the `knownSeen` loop and the INFO line. Add a one-line comment: the tolerance was removed by quick 261029-sof; a literal path is now a failure.

3. After B8c, read `scripts/session-start` once into `ssText` and split it into `ssLines`. Then add the legs below. Each label below is exactly one `check()` call, so the suite total becomes 70 (the 63 existing legs plus 7). Wrap each leg that runs a child process, a git command or a capture in try/catch, so that a RED run prints FAIL for that leg and the script still reaches B9 to B11.
   - B8d: for each line of `ssLines`, flag any line that contains `/tmp/mindrian` or `/tmp/mos-sealed`. Pass when none is flagged. Put the line numbers in the detail text.
   - B8e: take the lines that contain `mindrian-context-state`. Pass only when there is exactly 1 line, its trimmed text starts with `BRIDGE_FILE=`, and it contains `${TMPDIR:-/tmp}/`. Do the same for `mindrian-update-check` with `UPDATE_CACHE=`. This proves that the reader and the writer share one variable per file.
   - B8f: run `git grep -l -I -e mindrian-context-state -e mindrian-update-check -- scripts lib hooks bin skills commands agents` with `execFileSync` in `ROOT`. Sort the result. It must equal `scripts/isolate-larry-voice.cjs`, `scripts/session-start`, `skills/context-engine/SKILL.md`. For each of these files, the regular expression for a `/tmp/mindrian-context-state` or `/tmp/mindrian-update-check` that is not preceded by a closing brace must not match. Add a comment: `mindrian-context-state` has no writer in the repo since commit 256560658 (the live bridge is `~/.mindrian/bridge/<room-hash>.json`); a new reader or writer must resolve through TMPDIR and must be added to this list in a reviewed diff.
   - B8g and B8h: find the three shipped lines in `ssLines` by their trimmed start or content: the one that starts with `BRIDGE_FILE=`, the one that starts with `UPDATE_CACHE=`, and the one that contains `mos-sealed-`. Evaluate each with `spawnSync('bash', ['-c', ...])`. For the first two, the script text is the line, then `; printf %s "$VAR"`. For the mktemp line, define `mktemp() { return 1; }` first so the fallback runs, then the line, then `; printf %s "$tmp"`. Pass an explicit `env` that holds only PATH from `process.env.PATH`, plus TMPDIR where the case needs it. B8g cases: TMPDIR absent from env, and TMPDIR equal to the empty string. Expected: `/tmp/mindrian-context-state`, `/tmp/mindrian-update-check`, and a match for `^/tmp/mos-sealed-[0-9]+$`. B8h case: TMPDIR equal to `/scratch-x`. Expected: `/scratch-x/mindrian-context-state`, `/scratch-x/mindrian-update-check`, and a match for `^/scratch-x/mos-sealed-[0-9]+$`.
   - B8i: this leg must run before B8j changes the file. It uses scratch `S3` and the first session-start capture of B4. Poll up to 10 times with `sleep(1000)` for the file `path.join(S3.tmp, 'mindrian-update-check')`. Pass when it exists, its first line matches a date of the form 4 digits, 2 digits, 2 digits, and its second line is one of `UP_TO_DATE`, `UPDATE_AVAILABLE`, `CHECK_FAILED`. This is the writer proof: the detached update check wrote under the scratch TMPDIR. Do not stat or read the real `/tmp` (a live session writes there at any time).
   - B8j: only when `escapes.length === 0` (the B4 variable). Write the file `S3.tmp/mindrian-update-check` with today's UTC date (`new Date().toISOString().slice(0, 10)`), a line `UPDATE_AVAILABLE`, and a line `9.9.9-sof-seed`. Write the file `S3.tmp/mindrian-context-state` with JSON that holds `ctx_pct` 83, `model_name` `sof-model`, `ctx_size` 123456 and a `timestamp` in epoch seconds. Run `iso.captureHookContext(S3, { roomDir: room.roomDir, hook: 'session-start' })`. Read `path.join(room.roomDir, '.mindrian', 'session-context.txt')`. Pass when the text holds `9.9.9-sof-seed`, `sof-model` and `Usage: 83%`. The captured stdout is not enough: at 83 percent the tier is minimal and the stdout shortens those blocks, so read the full file. If `escapes.length` is not 0, the leg fails with the detail `scan not clean`. Do not create `$HOME/.mindrian/auto-update` (it would run the self-update).

Expected RED state against the unchanged `scripts/session-start`: B8a, B8d, B8e, B8f, B8h, B8i and B8j fail. Every other leg passes. B8g passes because the old strings equal the no-TMPDIR strings.
  </action>
  <verify>
    <automated>out=$(node tests/test-3696-isolation.cjs 2>&1); st=$?; printf '%s\n' "$out" | grep '^FAIL'; test "$st" -ne 0 && test "$(printf '%s\n' "$out" | grep -c '^FAIL: B8')" -ge 5 && test "$(printf '%s\n' "$out" | grep '^FAIL' | grep -vc '^FAIL: B8')" -eq 0</automated>
  </verify>
  <done>The test file runs to the end and prints its summary. It exits non-zero. At least 5 B8 legs print FAIL and no leg outside B8 prints FAIL. The file has no em dash and no en dash (leg B11 passes).</done>
</task>

<task type="auto">
  <name>Task 2: Make the three paths follow TMPDIR (GREEN), update the evidence table and the skill line</name>
  <files>scripts/session-start, scripts/isolate-larry-voice.cjs, skills/context-engine/SKILL.md</files>
  <action>
Make exactly these edits. Each is a change inside one line. Do not add, remove or move a line, so `scripts/session-start` keeps 2092 lines and the evidence line numbers 1867 and 1980 keep holding. Do not add a process spawn. Do not touch `dist/`, `hooks/` or any other script.

1. `scripts/session-start` line 413: replace the path in the BRIDGE_FILE assignment so the line reads `BRIDGE_FILE="${TMPDIR:-/tmp}/mindrian-context-state"`. Keep the two leading spaces.
2. `scripts/session-start` line 1332: in the mktemp fallback, replace `/tmp/mos-sealed-$$` with `${TMPDIR:-/tmp}/mos-sealed-$$`. Keep the rest of the line (`tmp=$(mktemp 2>/dev/null || echo "...")`).
3. `scripts/session-start` line 1829: the line reads `UPDATE_CACHE="${TMPDIR:-/tmp}/mindrian-update-check"`. The writers at lines 1848, 1849, 1867, 1868 and 1871 and the readers at lines 1833 to 1840 already use `"$UPDATE_CACHE"`. Do not edit them.
4. `scripts/isolate-larry-voice.cjs`, entry `'hooks/run-hook.cmd session-start'` of `STARTUP_CONTAINMENT` (around lines 424 to 436): replace the evidence texts of the three entries for lines 413, 1332 and 1829 with the new line texts from steps 1 to 3 (the evidence check is a substring match at the stated line). Keep the entries for lines 1867 and 1980 unchanged. Replace the `reason` text with: `every write target derives from HOME, MINDRIAN_ROOMS_*, CLAUDE_CONFIG_DIR or TMPDIR; contained only while the scan finds no literal path`. Keep `kind: 'scan_gated'` and `fallback_reason: 'hardcoded_path_write'`. The scan stays: it is the guard that keeps the set from growing.
5. `skills/context-engine/SKILL.md` line 124: replace the literal `/tmp/mindrian-context-state` in the sentence "Read `...` if it exists." with wording that names the file in the temp folder without a literal /tmp path and without the brace syntax: Read the file `mindrian-context-state` in the temp folder (`$TMPDIR`, or `/tmp` when TMPDIR is unset) if it exists. Keep the rest of the line and the rest of the file. The change is about 50 bytes. Per the table above, no writer exists for this file today. Do not add a claim about a writer.

Why these choices: the default `/tmp` keeps the no-TMPDIR path byte-identical (an empty TMPDIR also falls back to `/tmp` with the `:-` form). Both sides of each file use one variable, so reader and writer cannot drift. The lines already follow the pattern of line 144 of the same file.
  </action>
  <verify>
    <automated>bash -n scripts/session-start && test "$(wc -l < scripts/session-start)" -eq 2092 && ! grep -n '/tmp/mindrian\|/tmp/mos-sealed' scripts/session-start && node -e "const i=require('./scripts/isolate-larry-voice.cjs');const f=i.scanFile('scripts/session-start');const bad=Object.keys(i.STARTUP_CONTAINMENT).flatMap(k=>i.STARTUP_CONTAINMENT[k].evidence).filter(e=>!i.evidenceHolds(e));if(f.length||bad.length){console.error(JSON.stringify({f:f,bad:bad}));process.exit(1)}console.log('scan clean, every evidence line holds')"</automated>
  </verify>
  <done>`bash -n` passes. `scripts/session-start` has 2092 lines and no `/tmp/mindrian` or `/tmp/mos-sealed` text. `scanFile('scripts/session-start')` returns an empty list. Every evidence entry of `STARTUP_CONTAINMENT` holds at its stated line. `skills/context-engine/SKILL.md` line 124 names `$TMPDIR`.</done>
</task>

<task type="auto">
  <name>Task 3: Prove it, commit with --only, close the RCA</name>
  <files>tests/test-3696-isolation.cjs, scripts/session-start, scripts/isolate-larry-voice.cjs, skills/context-engine/SKILL.md, .planning/debug/sessionstart-npm-reconcile-no-isolation-switch.md, .planning/debug/knowledge-base.md</files>
  <action>
Work from the worktree root. Never run `git stash`. Never push. Never use `--no-verify`: the repo has a pre-commit hook; if it fails, fix the cause.

1. Run `node tests/test-3696-isolation.cjs` (about 85 seconds; use a tool timeout of 300000 ms). Expect `PASS: 70 FAIL: 0` (63 existing legs plus the 7 new legs B8d to B8j), the line `INFO chain not executed: none`, the line `INFO chain blockers: []`, and `INFO reconcile proof on the repo file: PROVEN`. The B4e leg now takes its second branch (the session-start capture runs). If any leg fails, find the root cause before any edit. State it in the SUMMARY. If the cause is a write that session-start makes outside the scratch root and that is not one of the three paths, stop and return `STATUS: PARTIAL` with the evidence. Do not relax the canary and do not add a tolerance to `KNOWN_ESCAPES`.

2. Run the regression tests that read `scripts/session-start`: `tests/test-k1u-session-start-envelope.cjs`, `tests/test-session-start-banner.cjs`, `tests/test-209-session-start-exemplar.cjs`, `tests/test-267.3-session-start-declaration.cjs`, `tests/test-session-start-node-preflight.cjs`, `tests/test-room-context-latency.cjs`. Each must exit 0.

3. Dash check on the diff: no em dash (U+2014) and no en dash (U+2013) in any added line.

4. Commit the code with an explicit path list so no peer change enters the commit: `git commit --only` on the four code paths (`scripts/session-start`, `scripts/isolate-larry-voice.cjs`, `skills/context-engine/SKILL.md`, `tests/test-3696-isolation.cjs`). Subject: `fix(quick-261029-sof): session-start temp files follow TMPDIR (BRIDGE_FILE, UPDATE_CACHE, sealed-walker fallback); isolation canary runs the session-start capture`. Body, in short lines: the three substitutions; no-TMPDIR paths unchanged; the evidence table updated because `evidenceHolds` is a substring match; B8 known-escape set removed; B8d to B8j added; `mindrian-context-state` has no writer in the repo (pre-existing, not fixed here). End the message with the session attribution trailer. Then confirm the new commit is an ancestor of HEAD and that `git show --stat HEAD` lists exactly those four files.

5. Close the RCA. Edit `.planning/debug/sessionstart-npm-reconcile-no-isolation-switch.md`: set `status: resolved` and the `updated` date; set `next_action` in Current Focus to none; append one Evidence entry (timestamp, checked: the run of `scanFile('scripts/session-start')` and of the isolation test after the fix, found: empty list, PASS 70 FAIL 0, blockers empty, implication: gap 2 closed); append a second Evidence entry that `mindrian-context-state` has no writer (the table above); in Resolution set `fix:` to gap 1 by quick 261029-nhu and gap 2 by quick 261029-sof, `verification:` to the new run, `files_changed:` to the four code files, `commits:` to `58a997ca8 (gap 1)` and the new short sha (gap 2). In Non-Code Follow-ups, mark the gap 2 route done. Then move the file with `git mv` to `.planning/debug/resolved/`. Append one block to `.planning/debug/knowledge-base.md` in the same field layout as the blocks above it (heading with a double hyphen, Date, Error patterns, Root cause, Fix, Verification, Files changed, Pattern lesson). The pattern lesson: a static scan with an evidence table that pins line text breaks the build on purpose when a line changes, so update the table in the same commit; and a reader with no writer hides behind a path fix.
   Use `git add -f` for the moved file and the knowledge base (the `.planning` path is gitignored but these files are tracked). Commit with `git commit --only` on the old path, the new path and the knowledge base. Subject: `docs(quick-261029-sof): resolve the session-start isolation RCA (gap 2 closed); knowledge-base block`. If the pathspec of the removed old path is rejected by `--only`, run `git rm --cached` on the old path first, then repeat. Do not edit `.planning/STATE.md` (the orchestrator owns it).
  </action>
  <verify>
    <automated>out=$(node tests/test-3696-isolation.cjs 2>&1); st=$?; printf '%s\n' "$out" | tail -8; test "$st" -eq 0 && printf '%s\n' "$out" | grep -q '^PASS: 70 FAIL: 0$' && printf '%s\n' "$out" | grep -q '^INFO chain blockers: \[\]$' && printf '%s\n' "$out" | grep -q '^INFO chain not executed: none$' && for t in tests/test-k1u-session-start-envelope.cjs tests/test-session-start-banner.cjs tests/test-209-session-start-exemplar.cjs tests/test-267.3-session-start-declaration.cjs tests/test-session-start-node-preflight.cjs tests/test-room-context-latency.cjs; do node "$t" > /dev/null 2>&1 || { echo "FAILED $t"; exit 1; }; done && git diff HEAD~2 -U0 -- scripts tests skills | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{process.exit((s.includes(String.fromCharCode(8211))||s.includes(String.fromCharCode(8212)))?1:0)})"</automated>
  </verify>
  <done>The isolation test prints PASS 70 FAIL 0 with no chain blocker and the session-start hook executed. The six regression tests exit 0. Two commits exist: one code commit with exactly 4 files and one docs commit. The RCA sits in `.planning/debug/resolved/` with status resolved and the knowledge base holds its block. Nothing was pushed. `git stash` was not used.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| caller environment to hook | The value of TMPDIR chooses the folder where session-start reads and writes three small files. The caller already controls HOME and PATH, so it already controls the hook. |
| shared /tmp to the hook | With no TMPDIR, the files sit in the shared `/tmp` under fixed names, as today. |
| hook to network | The detached update check calls `curl` against a public GitHub URL. It carries no room or user data. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-sof-01 | Tampering | `UPDATE_CACHE` and `BRIDGE_FILE` in a shared `/tmp` (fixed names, another local user could pre-create or link them) | accept | Pre-existing, unchanged for callers without TMPDIR. Callers that set a private TMPDIR (the eval scratch root, macOS per-user temp) get a safer path. The values read are a date, a status word and a number, parsed with `head`, `sed` and `JSON.parse` in try/catch. |
| T-sof-02 | Information disclosure | The eval read the operator's live `/tmp/mindrian-context-state` | mitigate | The read now resolves under the scratch TMPDIR. Leg B8j seeds a value only the scratch file can supply and checks it reaches the context. |
| T-sof-03 | Tampering | Writes outside the scratch root (the isolation claim of Phase 369.6) | mitigate | Legs B8d, B8e and B8f fail on any literal path. B8i proves the writer lands under the scratch TMPDIR. `scanFile` keeps gating the session-start entry of `STARTUP_CONTAINMENT`. |
| T-sof-04 | Denial of service | TMPDIR set to a missing or read-only folder | accept | `walk_sealed_rooms` is called as `walk_sealed_rooms \|\| true` (line 1413), so `set -euo pipefail` cannot abort the hook. The reads are guarded by `-f`. The update-cache writes run in a detached subshell. A failed write only skips the daily cache. |
| T-sof-05 | Repudiation | none (no audit trail involved) | accept | Not applicable. |
| T-sof-06 | Elevation of privilege | none (no new spawn, no new privilege, no eval of TMPDIR content) | accept | `$TMPDIR` is only used as a quoted path prefix. The `node -e` reads at lines 417 and 570 to 572 already interpolate `$BRIDGE_FILE` into a JavaScript string. A TMPDIR that holds a single quote could break that string. The caller already controls the whole environment, so this adds no boundary. The `catch` branch prints 0 or the default. |
| T-sof-07 | Information disclosure | Part 8 (Brain boundary) | accept | The change moves local temp files only. No byte goes to the Brain. The update check network call is unchanged and carries no room data. |
</threat_model>

<verification>
Run from the worktree root after Task 3:

- `node tests/test-3696-isolation.cjs` prints `PASS: 70 FAIL: 0`, `INFO chain not executed: none`, `INFO chain blockers: []`.
- `node -e "console.log(JSON.stringify(require('./scripts/isolate-larry-voice.cjs').scanFile('scripts/session-start')))"` prints `[]`.
- `grep -c '/tmp/mindrian' scripts/session-start` prints 0.
- `bash -n scripts/session-start` exits 0 and `wc -l scripts/session-start` prints 2092.
- The six session-start regression tests exit 0.
- `git log -2 --stat` shows one code commit (4 files) and one docs commit; `git status --short` is clean for the owned paths.

Not run on purpose: `bash tests/run-all-3696.sh` (owned by plan 369.6-13, and it runs several hundred legs) and `node scripts/build-dist-bundles.cjs` (the dist bundle is stale since beta.52 and the release regenerates it).
</verification>

<success_criteria>
- The no-TMPDIR paths are byte-identical to today (leg B8g).
- A caller that sets TMPDIR keeps the session-start temp reads and writes under its own root (legs B8h, B8i, B8j).
- Reader and writer of each file resolve one path (legs B8e, B8f) and the table of readers and writers in the context block is recorded in the SUMMARY.
- The isolation canary no longer reports `hardcoded_path_write` for session-start, so cells 2, 3, 2s and 3s can capture the session-start context in plan 369.6-05.
- A reintroduced literal `/tmp/mindrian` fails the test (leg B8d).
</success_criteria>

<output>
Create `.planning/quick/261029-sof-session-start-tmpdir-for-the-mindrian-up/261029-sof-SUMMARY.md` when done. Record: the commit shas, the final test counts, the reader and writer table, the finding that `mindrian-context-state` has no writer, and the decision on the evidence table.
</output>
