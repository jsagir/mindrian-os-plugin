---
phase: quick-261019-gct
plan: 261019-gct
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/test-gct-process-step-id-parity.cjs
  - tests/run-all-366.sh
  - lib/core/part8-egress-guard.cjs
autonomous: true
requirements: [QUICK-261019-GCT]
canon_parts: [8]

must_haves:
  truths:
    - "node tests/test-361-theo-parity.cjs exits 0 with all legs PASS, including Leg 3b (PROCESS_STEP_ID_RE equals Theo PROCESS_STEP_ID_PATTERN byte-for-byte at Theo a338354a)."
    - "guard.classify on the framework_step tool allows (class known_tool_shape) a classic id, a phase42::framework id, a phase42::command id, an export13-<16 hex> id and a 160-char classic id."
    - "guard.classify on the framework_step tool does not allow a person-name step_id, a free-text step_id, export13- with 15 hex, and a 161-char id. The 161-char id was allowed before the fix (no total cap)."
    - "tests/run-all-366.sh runs the new test as a hard run leg (section 2g). After the fix, the gct leg is PASSED and no leg is FAILED that was not FAILED in the baseline. The 366 semantic index integrity I3 timeout is out of scope."
    - "Only the 3 owned files change. Each commit uses git commit --only with explicit paths. No file of another writer is staged, reverted or edited."
  artifacts:
    - path: "lib/core/part8-egress-guard.cjs"
      provides: "PROCESS_STEP_ID_RE re-synced to Theo's widened pattern, plus one dated comment line"
      contains: "phase42::(?:framework|command)::"
    - path: "tests/test-gct-process-step-id-parity.cjs"
      provides: "behavior legs for the widened framework_step step_id shapes through guard.classify, no network"
      contains: "export13-"
    - path: "tests/run-all-366.sh"
      provides: "section (2g), a hard run of the new test in the release suite"
      contains: "test-gct-process-step-id-parity.cjs"
  key_links:
    - from: "lib/core/part8-egress-guard.cjs framework_step arm (line 527)"
      to: "PROCESS_STEP_ID_RE (line 625)"
      via: "payload.step_id must match"
      pattern: "PROCESS_STEP_ID_RE\\.test\\(payload\\.step_id\\)"
    - from: "tests/test-361-theo-parity.cjs Leg 3b"
      to: "/home/jsagi/Theo/src/mcp/content/vocabulary.ts PROCESS_STEP_ID_PATTERN"
      via: "extractPatternLiteral on both files, string equality"
      pattern: "const PROCESS_STEP_ID_RE"
    - from: "scripts/release-lib/suite-gate.sh RELEASE_GATE_SUITES"
      to: "tests/run-all-366.sh section (2g)"
      via: "release.sh Step 0.6c shells the aggregator"
      pattern: "test-gct-process-step-id-parity"
---

<objective>
Re-sync the plugin's PROCESS_STEP_ID_RE (lib/core/part8-egress-guard.cjs line 625) to Theo's widened PROCESS_STEP_ID_PATTERN, byte-for-byte. Add a behavior test that proves the widened shapes through the real classify path, and wire it into the release suite.

Purpose: tests/test-361-theo-parity.cjs Leg 3b fails today. It is a release blocker for v2.0.0-beta.71. Theo Phase 42/45 widened the pattern with phase42:: ids, export13- ids and a 160-char cap. The plugin copy drifted. Today the framework_step arm refuses real Theo step ids (phase42, export13) and allows a 161-char id that Theo refuses.

Output: 1 regex literal replaced, 1 dated comment line, 1 new test file, 1 new hard leg in tests/run-all-366.sh, 2 commits.

Measured baseline (PROVEN by the planner on 2026-10-19, HEAD ec3d56380, Theo a338354a):
- node tests/test-361-theo-parity.cjs: PASSED=7 FAILED=1, Leg 3b only, exit 1.
- node tests/test-361-egress-shapes.cjs: exit 0. node tests/test-369.26-part8.cjs: exit 0.
- Current guard on framework_step with framework "Dominant Design": the phase42 framework id, the phase42 command id and the export13 id return ambiguous. A 161-char classic id returns allow. scanForContent reports no hit on any planned test id.

The protocol at /home/jsagi/.claude/protocols/agent-interaction-protocol.md applies to the executor. Write the final report in its fixed fields (STATUS, CHANGED, VERIFIED, UNVERIFIED, RISKS, NEXT). Use `NEEDS_HUMAN: <one question>` instead of a question. Do not push.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@/home/jsagi/.claude/protocols/agent-interaction-protocol.md
@lib/core/part8-egress-guard.cjs
@tests/test-361-theo-parity.cjs
@tests/test-361-egress-shapes.cjs
@tests/run-all-366.sh
@/home/jsagi/Theo/src/mcp/content/vocabulary.ts

Read limits (do not read the whole guard file):
- lib/core/part8-egress-guard.cjs: read lines 517-530 (the framework_step arm), 602-636 (the comment block, FRAMEWORK_NAME_RE, PROCESS_STEP_ID_RE, _isKnownFrameworkHandle) and 1183-1247 (classify). The exports are at line 1248: classify, _proveKnownToolShape, scanForContent.
- tests/test-361-egress-shapes.cjs: read lines 55-120 only. It holds the fetch block, the tool-name constant FRAMEWORK_STEP = 'mcp__plugin_mos_mindrian-brain__framework_step', and the expectVerdict and expectNotAllow helpers. Copy that pattern.
- tests/run-all-366.sh: read lines 1-60 (run, run_if helpers) and 125-140 (sections 2c to 2f, the pattern for the new section).
- /home/jsagi/Theo/src/mcp/content/vocabulary.ts: read lines 285-307 only. Do not change any file in /home/jsagi/Theo.

Interfaces the executor needs (from the guard, PROVEN by the planner):
- classify(payload, { toolName }) returns { verdict: 'allow' | 'block' | 'ambiguous', class, reason }.
- A proven framework_step payload returns verdict 'allow', class 'known_tool_shape', reason 'framework_step canonical framework handle'.
- _proveKnownToolShape(payload, toolName) returns null when the arm refuses the shape.
- The framework_step arm admits the keys framework (required, a CANONICAL_PHRASES member, for example 'Dominant Design') and step_id (optional, must match PROCESS_STEP_ID_RE).
- A refused step_id falls to the terminal ambiguous (class unknown), not block. "Refused" in this plan means: verdict is not 'allow', class is not 'known_tool_shape', and _proveKnownToolShape returns null.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Preflight, baseline, and the RED behavior test wired into run-all-366</name>
  <files>tests/test-gct-process-step-id-parity.cjs, tests/run-all-366.sh</files>
  <behavior>
    - A0: framework 'Dominant Design' with no step_id is allowed (known_tool_shape).
    - A1: classic id 'dominantdesign::phase::s01' is allowed.
    - A2: 'phase42::framework::12-leverage-points::rank-intervention-sites' is allowed (RED before the fix).
    - A3: 'phase42::command::mos-act::calibrate-what-you-want' is allowed (RED before the fix).
    - A4: 'export13-1203ff397699a1c5' (16 lowercase hex) is allowed (RED before the fix).
    - A5: a 160-char classic id is allowed. Build it as 64 'x', '::', 64 'y', '-', 24 'z', '::s01'. Assert its length is 160.
    - R1: person name 'Marrowby Pell' is refused (synthetic name, already used in repo tests; never use a real name).
    - R2: free text 'how should we price the pilot for our first customer' is refused.
    - R3: 'export13-1203ff397699a1c' (15 hex) is refused.
    - R4: a 161-char classic id is refused (RED before the fix: the old pattern allows it). Build it as A5 with 25 'z'. Assert its length is 161.
    - R5 (extra edges): 'export13-1203ff397699a1c5f' (17 hex), 'export13-1203FF397699A1C5' (upper case hex), 'phase42::venture::foo::bar' (unknown kind) and 'phase42::framework::adaptive--leadership::decide' (empty hyphen part) are refused.
    - N: no network call happens (globalThis.fetch replaced by a thrower before the guard loads; a flag stays false).
    - P (optional, read-only): when the Theo vocabulary.ts is readable, each case's Theo-regex match result equals the case table's want (true for allow, false for refuse). This compares Theo to the table, not to the guard, so Leg P passes in RED and in GREEN. When the file is not readable, print a SKIP note for Leg P only, and still exit on the other legs.
  </behavior>
  <action>
Preflight (do this first, before any edit):
1. Run `pwd` and confirm /home/jsagi/dev/MindrianOS-Plugin. Record `git rev-parse HEAD` in the scratchpad.
2. Run `git status --porcelain -- lib/core/part8-egress-guard.cjs tests/run-all-366.sh tests/test-gct-process-step-id-parity.cjs`. The output must be empty. If not, another writer (Codex) owns a change there: stop and report `STATUS: BLOCKED` with the porcelain lines. Do not stash, reset, checkout or revert anything.
3. Capture the suite baseline: `LC_ALL=C bash tests/run-all-366.sh` with a 600000 ms timeout (or run it in the background). Save the full output to .planning/quick/261019-gct-sync-process-step-id-re-to-theo-widened-/gct-366-before.txt. Save the list of `>>> <label>: FAILED` lines to gct-366-fails-before.txt in the same folder. The I3 leg ("366 semantic index integrity") can fail on a 120s load timeout; that is a known out-of-scope red.

Create tests/test-gct-process-step-id-parity.cjs (Node CJS, 'use strict', the house header comment block like test-361-theo-parity.cjs: copyright line "Copyright (c) 2026 Mindrian. BSL 1.1.", what the file pins and why, the legs, exit 0 PASSED / 1 FAILED, "House rule: hyphens only, no em-dashes, no emoji"). The header must say: quick 261019-gct; Theo Phase 42/45 widened PROCESS_STEP_ID_PATTERN (phase42:: ids, export13- ids, a 160-char cap); test-361-theo-parity Leg 3b pins the bytes, this file pins the behavior through classify.
- Before requiring the guard, replace globalThis.fetch with a function that sets networkAttempted = true and throws (the test-361-egress-shapes.cjs lines 60-65 pattern). Do not spawn a child process. Do not require http or https.
- Require ../lib/core/part8-egress-guard.cjs by an absolute path built from __dirname. Use the tool name 'mcp__plugin_mos_mindrian-brain__framework_step' and the framework 'Dominant Design' for every case.
- Use a case table: { label, step_id or absent, want: 'allow' | 'refuse' }. For 'allow' assert verdict 'allow', class 'known_tool_shape' and reason 'framework_step canonical framework handle'. For 'refuse' assert verdict is not 'allow', class is not 'known_tool_shape', and guard._proveKnownToolShape(payload, toolName) is null. Also assert scanForContent(payload).hit is false for every case, so a pass proves the arm decided, not the content scan.
- Count checks and failures with an ok(label, cond, detail) helper that prints PASS/FAIL lines (the test-361-theo-parity.cjs style), and does not throw on the first failure, so the RED run lists every failing case.
- Leg P: resolve the Theo checkout as process.env.MINDRIAN_THEO_CHECKOUT or /home/jsagi/Theo. Read src/mcp/content/vocabulary.ts with fs.readFileSync in a try block. Extract the literal with the same rule as test-361's extractPatternLiteral (text after the first '=' that follows 'export const PROCESS_STEP_ID_PATTERN', up to the next ';', trimmed). Build a RegExp from the text between the first '/' and the last '/', flags after the last '/'. For each case with a step_id, assert theoRe.test(step_id) equals (want === 'allow'). On a read or parse failure print "Leg P: SKIPPED (Theo checkout not readable)" and continue.
- End with an N check: networkAttempted is false. Print "PASSED=<n> FAILED=<n> (checks=<n>)". Exit 1 when any check failed, else exit 0.

Wire the test into tests/run-all-366.sh: insert a new section after the (2f) btm block and before the "(3) Pins carried by this phase" comment. Follow the (2f) form exactly: a comment line "# --- (2g) quick 261019-gct: the framework_step step_id arm follows Theo's widened PROCESS_STEP_ID_PATTERN ---", a comment line that says Theo Phase 42/45 added phase42:: and export13- ids and a 160-char cap and the plugin copy drifted until 2026-10-19, the line "# The leg is a hard run (not run_if), so a missing or red test fails the cut.", and then `run "gct framework_step step_id parity (quick 261019-gct)" node tests/test-gct-process-step-id-parity.cjs`. Change no other line of run-all-366.sh.

Prove RED: run `node tests/test-gct-process-step-id-parity.cjs`. It must exit 1. The FAIL lines must name exactly A2, A3, A4 and R4 (the guard legs). Leg P and the no-network check must pass. If any other check fails, the test is wrong: fix the test, not the guard.

Commit the RED state with plain git (not gsd-tools commit, which sweeps the whole index):
`git add -N tests/test-gct-process-step-id-parity.cjs` then `git commit --only tests/test-gct-process-step-id-parity.cjs tests/run-all-366.sh` with the subject "test(quick-261019-gct): pin the widened framework_step step_id shapes (RED)", a 1-2 line body (the 4 red cases and why), and the last line "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Do not use --no-verify. If the pre-commit hook fails on a file this plan does not own, stop and report BLOCKED with the hook output.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && { node tests/test-gct-process-step-id-parity.cjs; [ $? -eq 1 ]; } && bash -n tests/run-all-366.sh && [ "$(grep -c 'node tests/test-gct-process-step-id-parity.cjs' tests/run-all-366.sh)" = 1 ] && ! LC_ALL=C grep -qP '\xE2\x80\x94|\xE2\x80\x93' tests/test-gct-process-step-id-parity.cjs tests/run-all-366.sh</automated>
  </verify>
  <done>The new test exits 1 and its FAIL lines name only A2, A3, A4 and R4. Leg P and the no-network check pass. run-all-366.sh parses (bash -n), carries exactly 1 run line for the new test in section (2g), and has no em-dash or en-dash. The baseline files gct-366-before.txt and gct-366-fails-before.txt exist. 1 commit exists that touches only the 2 owned test files.</done>
</task>

<task type="auto">
  <name>Task 2: Copy Theo's pattern into PROCESS_STEP_ID_RE byte-for-byte, add the dated comment line, prove GREEN</name>
  <files>lib/core/part8-egress-guard.cjs</files>
  <action>
Replace the regex literal by a program, not by hand (the pattern must come from Theo's file, not from the prompt or this plan):
1. Write a one-off Node script in the session scratchpad (never in the repo). It reads /home/jsagi/Theo/src/mcp/content/vocabulary.ts and extracts the PROCESS_STEP_ID_PATTERN literal with the test-361 extractPatternLiteral rule (after the first '=' that follows 'export const PROCESS_STEP_ID_PATTERN', up to the next ';', trimmed). It reads lib/core/part8-egress-guard.cjs, finds the single line that starts with 'const PROCESS_STEP_ID_RE = ', and rebuilds that line as 'const PROCESS_STEP_ID_RE = ' + theoLiteral + ';'. Build the new text by string slicing and concatenation. Do not use String.prototype.replace with a string replacement: the literal contains '$' characters, and replacement patterns would corrupt it.
2. The script asserts that exactly 1 line starts with 'const PROCESS_STEP_ID_RE = ' and that the Theo literal starts with '/^(?=.{1,160}$)' and ends with '$/'. On a mismatch it exits non-zero and writes nothing.
3. After the write, the script re-reads both files, extracts both literals with the same rule (markers 'export const PROCESS_STEP_ID_PATTERN' and 'const PROCESS_STEP_ID_RE'), and prints EQUAL only on strict string equality. Keep the line ending of the guard file unchanged.

Add one dated comment line to the comment block above FRAMEWORK_NAME_RE (lines 602-623). Insert it directly before the closing '// ----' rule line at line 623. Text: "// 2026-10-19 (quick 261019-gct): Theo Phase 42/45 widened the pattern with phase42:: and export13- ids and a 160-char cap; PROCESS_STEP_ID_RE re-synced." Warning: the comment line must not contain the text 'const PROCESS_STEP_ID_RE' or 'const FRAMEWORK_NAME_RE'. test-361's extractPatternLiteral takes the FIRST occurrence of that marker, and a comment hit would break Legs 3a and 3b. Use hyphens only.

Do not change FRAMEWORK_NAME_RE, the framework_step arm (line 523-530), or any other line of the guard. The diff must be exactly 2 lines: 1 changed regex line and 1 added comment line.

Prove GREEN and no regression:
- `node tests/test-gct-process-step-id-parity.cjs` exits 0.
- `node tests/test-361-theo-parity.cjs` exits 0 with Leg 3b PASS.
- `node tests/test-361-egress-shapes.cjs` and `node tests/test-369.26-part8.cjs` exit 0 (both were green at the baseline; 'not-a-valid-id' and 'a::b::s01' under framework_techniques must stay refused).
- `LC_ALL=C bash tests/run-all-366.sh` (600000 ms timeout or background). Save the output to gct-366-after.txt in the quick folder. Compare its FAILED labels with gct-366-fails-before.txt. The new gct leg must be PASSED. A FAILED leg that is also in the baseline, or the I3 "366 semantic index integrity" timeout, is not a regression. Any other new FAILED leg: rerun that leg alone; if it still fails and it touches the guard or step_id, stop and report PARTIAL with the leg output; if it does not touch the guard (for example a file another writer is changing), report it under RISKS and continue.

Commit with plain git: `git commit --only lib/core/part8-egress-guard.cjs` with the subject "fix(quick-261019-gct): sync PROCESS_STEP_ID_RE to Theo's widened PROCESS_STEP_ID_PATTERN", a short body (Theo a338354a, Leg 3b green, phase42/export13 ids now pass the framework_step arm, the 160-char cap now refuses 161+ chars that the old copy allowed), and the last line "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Do not use --no-verify. Do not push.

After the commit, run `git show --stat HEAD` and `git show --stat HEAD~1`. Each commit must list only its owned files. Confirm both shas are ancestors of HEAD with `git merge-base --is-ancestor`.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-gct-process-step-id-parity.cjs && node tests/test-361-theo-parity.cjs && node tests/test-361-egress-shapes.cjs && node tests/test-369.26-part8.cjs && S=$(git log -1 --format=%H -- lib/core/part8-egress-guard.cjs) && [ "$(git show --numstat --format= "$S" -- lib/core/part8-egress-guard.cjs | cut -f1,2)" = "$(printf '2\t1')" ] && ! LC_ALL=C grep -qP '\xE2\x80\x94|\xE2\x80\x93' lib/core/part8-egress-guard.cjs</automated>
  </verify>
  <done>The guard literal equals Theo's literal byte-for-byte (the scratchpad script printed EQUAL; test-361-theo-parity exits 0 with all legs PASS). The new test exits 0 (all A cases allowed, all R cases refused, Leg P PASS, no network). test-361-egress-shapes and test-369.26-part8 exit 0. run-all-366 shows the gct leg PASSED and no new FAILED leg against the baseline, except the out-of-scope I3 timeout. The guard commit changes exactly 2 lines (numstat 2 added, 1 removed) and touches only lib/core/part8-egress-guard.cjs. No em-dash or en-dash in the 3 owned files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| plugin -> Theo (Brain) framework_step call | A step_id string crosses to the remote Brain. Canon Part 8: no user data may cross; only generic methodology handles. |
| Theo checkout -> plugin source | The regex text is copied from a local Theo file into a shipped guard. |
| this executor -> shared working tree | Another writer (Codex) edits other files in the same tree at the same time. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-gct-01 | Information disclosure | framework_step arm, PROCESS_STEP_ID_RE | accept | The widened phase42 form admits lowercase hyphen slugs (up to 16 parts per segment, 2 segments). A lowercase name written as a slug can pass the arm. The old classic form had the same class (9 parts, no total cap). Rationale: Theo's contract is the pinned source of truth (361 D-14); scanForContent default-deny runs first on every payload; framework must be an exact CANONICAL_PHRASES member; the new 160-char lookahead narrows the id (161+ chars were allowed before). R1, R2 and the R5 edges pin the refusals. |
| T-gct-02 | Tampering | regex copy | mitigate | Copy the literal by a program from Theo's vocabulary.ts, assert strict string equality (EQUAL), and keep test-361 Leg 3b plus the new Leg P as standing pins. No hand edit of the literal; no String.prototype.replace with '$' patterns. |
| T-gct-03 | Tampering | shared working tree | mitigate | Preflight `git status --porcelain` on the 3 owned paths must be empty; commits use `git commit --only <owned paths>`; no stash, reset, checkout or revert; no gsd-tools commit (it sweeps the index); `git show --stat` proves each commit carries only owned files. |
| T-gct-04 | Denial of service | release suite run-all-366 | mitigate | The new leg is a hard run, so a drift fails the cut. The baseline and after files separate a new failure from the known I3 timeout. |
</threat_model>

<verification>
- node tests/test-361-theo-parity.cjs exits 0 (Leg 3b PASS).
- node tests/test-gct-process-step-id-parity.cjs exits 0 after Task 2 and exited 1 after Task 1 with only A2, A3, A4, R4 failing.
- node tests/test-361-egress-shapes.cjs and node tests/test-369.26-part8.cjs exit 0.
- LC_ALL=C bash tests/run-all-366.sh: the gct leg is PASSED; no FAILED leg that is not in gct-366-fails-before.txt, except the I3 timeout.
- git show --stat for both commits lists only the owned files; no em-dash or en-dash in the 3 files.
</verification>

<success_criteria>
- PROCESS_STEP_ID_RE in lib/core/part8-egress-guard.cjs equals Theo's PROCESS_STEP_ID_PATTERN (Theo a338354a) byte-for-byte.
- The release suite (run-all-366, the only suite in RELEASE_GATE_SUITES) runs the new behavior test as a hard leg.
- 2 commits (test RED, fix GREEN), each with only owned files, each ending with the Co-Authored-By line. No push.
</success_criteria>

<output>
Create `.planning/quick/261019-gct-sync-process-step-id-re-to-theo-widened-/261019-gct-SUMMARY.md` when done. Include the 2 commit shas, the RED and GREEN test output lines, the run-all-366 before/after FAILED lists, and a note that tests/test-361-theo-parity.cjs itself runs only in run-all-361.sh and run-all-363.sh, not in run-all-366.sh (the release gate suite).
</output>
