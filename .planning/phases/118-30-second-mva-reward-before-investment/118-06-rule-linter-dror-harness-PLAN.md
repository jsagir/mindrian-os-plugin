---
phase: 118-30-second-mva-reward-before-investment
plan: "06"
slug: rule-linter-dror-harness
type: execute
wave: 4
depends_on: ["00", "01", "02", "03", "04", "05"]
files_modified:
  - lib/core/mva-rule-linter.cjs
  - lib/core/mva-rule-linter.test.cjs
  - scripts/check-reward-before-investment.cjs
  - tests/test-mva-dror-harness.cjs
  - tests/run-all-118.sh
  - lib/memory/run-feynman-tests.cjs
  - docs/reward-before-investment-rule.md
  - commands/new-project.md
  - commands/file-meeting.md
  - commands/grade.md
  - commands/onboard.md
  - hooks/pre-commit
autonomous: true
requirements: [MVA-118-24, MVA-118-25, MVA-118-26, MVA-118-27, MVA-118-28]
canon_parts: [Part 6, Part 7, Part 10]
beta_target: v1.13.0-beta.17
estimated_hours: 6-8
gap_closure: false

must_haves:
  truths:
    - "Every interactive command in commands/*.md MUST declare an interactive_first_reward field in YAML frontmatter; the linter scans the commands/ directory and emits a non-zero exit code if any command lacks the field"
    - "The linter accepts these values: a named reward type (e.g. instant_brief, schema_preview, calibration_distribution_preview, paragraph_preview) OR the literal --none (scripting only)"
    - "The 4 commands named in reward-before-investment-rule.md lines 56-70 (new-project, file-meeting, grade, onboard) carry an interactive_first_reward value matching the rule doc's remediation column (or --none if the command is currently scripting-only -- documented + tracked as a follow-up for the next phase that implements the remediation)"
    - "The Dror 2.0 acceptance test harness runs the full MVA pipeline against 3 fixture sentences (1 English venture, 1 obvious non-venture, 1 Hebrew sentence) and measures elapsed time end-to-end from hook fire -> Vercel URL render; the harness asserts the English venture path completes within 60 seconds and produces a non-empty Vercel URL"
    - "The Dror 2.0 harness is registered in tests/run-all-118.sh (the Phase 118 aggregator, mirroring tests/run-all-117.sh from Phase 117) AND in lib/memory/run-feynman-tests.cjs so it runs in CI and locally"
    - "A pre-commit hook entry runs the linter on staged commands/*.md changes so a contributor cannot land a new interactive command without declaring the field"
    - "docs/reward-before-investment-rule.md exists in-repo (currently only in the source room) so future contributors see the rule in the canonical repo context, not only in ~/MindrianRooms/"
  artifacts:
    - path: lib/core/mva-rule-linter.cjs
      provides: "The linter library: scanCommands(commandsDir) -> {ok, missing[], invalid[], compliant[]}; reads YAML frontmatter from each *.md, checks for interactive_first_reward field, classifies into the three buckets. Pure library, no I/O beyond fs.readdirSync + fs.readFileSync."
      exports: ["scanCommands", "validateFrontmatter", "REWARD_TYPES"]
      contains: "interactive_first_reward"
      min_lines: 80
    - path: scripts/check-reward-before-investment.cjs
      provides: "CLI wrapper: spawns the linter against commands/ directory, prints a table of missing/invalid/compliant counts, exits 1 if missing or invalid > 0. Used by pre-commit hook + CI. Larry-voice summary line on success ('All N interactive commands declare their first reward -- the rule holds.')."
      contains: "require('../lib/core/mva-rule-linter.cjs')"
      min_lines: 40
    - path: lib/core/mva-rule-linter.test.cjs
      provides: "Unit tests covering: (a) compliant command passes; (b) missing field fails; (c) invalid reward type (typo) fails; (d) --none (scripting only) value is accepted; (e) commands directory with mixed compliance reports correct buckets; (f) gracefully handles commands without frontmatter at all (legacy compatibility -- those get flagged as missing, not crash)."
      contains: "describe('mva-rule-linter'"
      min_lines: 60
    - path: tests/test-mva-dror-harness.cjs
      provides: "The Dror 2.0 acceptance harness: 3 fixture sentences -> spawn mva-detect.cjs as a child process with synthetic env, wait for ~/.mindrian/mva/<session>.json to reach status=complete OR timeout 60s, assert venture sentence produced a vercel_url AND assert the brief sha8 is reachable via fetch(url) returning 200. Non-venture sentence asserts no MVA state file is created. Hebrew sentence asserts the LD1-LOCKED Hebrew refusal envelope (English-only for v1.13.0; the harness reads LD1 from 118-CONTEXT.md, NEVER fails loudly on 'OQ1 unresolved' since OQ1 is LOCKED). Wall-clock < 60s per source spec line 129."
      contains: "MAX_TIME_MS = 60000"
      min_lines: 100
    - path: tests/run-all-118.sh
      provides: "Phase 118 test aggregator -- mirrors tests/run-all-117.sh canonical shape (Phase 117 SUMMARY references this as the proven pattern). Registers every test file from Plans 00-06 (mva-classifier.test, mva-state.test, mva-dispatch.test, mva-budget.test, mva-agents-*.test, mva-progressive.test, mva-deck.test, mva-vercel.test, mva-footer.test, mva-routing.test, mva-rule-linter.test, mva-dror-harness)."
      contains: "CJS_SUITES"
      min_lines: 50
    - path: lib/memory/run-feynman-tests.cjs
      provides: "Phase 118 block appended at EOF, mirrors Phase 117 block pattern (per Phase 125-08 + Phase 117 SUMMARY precedent). 12-15 test file registrations under '// ---------- Phase 118 -----------' header."
      contains: "Phase 118"
    - path: docs/reward-before-investment-rule.md
      provides: "Copy of ~/MindrianRooms/mindrian/mindrianOS/sub-rooms/communications/conversion-fix/solution-design/reward-before-investment-rule.md verbatim into the plugin repo so future contributors see the rule in the canonical repo context. Adds a header note pointing back at the source-of-truth location."
      contains: "No flow in MindrianOS may require user input beyond one sentence"
    - path: commands/new-project.md
      provides: "Frontmatter gains interactive_first_reward: instant_brief (per reward-before-investment-rule.md line 56-58 remediation column: 'first user sentence triggers Instant Brief pipeline. Room creation offered as option 2'). Backward-compatible: existing description, argument-hint, serves_jtbd, teaching fields preserved byte-identical."
      contains: "interactive_first_reward:"
    - path: commands/file-meeting.md
      provides: "Frontmatter gains interactive_first_reward: paragraph_preview (per rule doc line 60-62)."
      contains: "interactive_first_reward:"
    - path: commands/grade.md
      provides: "Frontmatter gains interactive_first_reward: calibration_distribution_preview (per rule doc line 64-66)."
      contains: "interactive_first_reward:"
    - path: commands/onboard.md
      provides: "Frontmatter gains interactive_first_reward: reframe_question (per rule doc line 68-70 -- first screen is a question, not a tutorial)."
      contains: "interactive_first_reward:"
    - path: hooks/pre-commit
      provides: "Adds a step that runs node scripts/check-reward-before-investment.cjs if any staged file matches commands/*.md. Exits non-zero on lint failure. Skipped when COMMIT_NO_VERIFY=1 (wave-protocol invariant per Phase 125-08 SUMMARY note)."
      contains: "check-reward-before-investment.cjs"
  key_links:
    - from: scripts/check-reward-before-investment.cjs
      to: lib/core/mva-rule-linter.cjs
      via: require + scanCommands(commandsDir)
      pattern: 'scanCommands\('
    - from: hooks/pre-commit
      to: scripts/check-reward-before-investment.cjs
      via: bash spawn on staged commands/*.md change
      pattern: 'check-reward-before-investment.cjs'
    - from: tests/test-mva-dror-harness.cjs
      to: scripts/mva-detect.cjs
      via: child_process.spawn with synthetic UserPromptSubmit payload
      pattern: 'mva-detect.cjs'
    - from: tests/test-mva-dror-harness.cjs
      to: lib/core/mva-state.cjs (Plan 00)
      via: readPending / markComplete polling
      pattern: 'mva-state'
    - from: tests/test-mva-dror-harness.cjs
      to: telemetry mva.jsonl
      via: reads ~/.mindrian/telemetry/v1.13/mva.jsonl to assert mva_brief_rendered event fired
      pattern: 'mva_brief_rendered'
    - from: tests/run-all-118.sh
      to: lib/memory/run-feynman-tests.cjs
      via: same test files registered in both surfaces (per Phase 117 / Phase 125-08 precedent)
      pattern: 'test-mva-'
---

<objective>
Ship the reward-before-investment rule's enforcement mechanism (the linter) and the source-spec's acceptance test #9 (the Dror 2.0 harness). This plan closes the loop between the rule that the phase implements (universal architectural constraint per binding decision B5) and the canonical implementation (Phase 118's MVA pipeline).

Per binding decision B5: this phase ships the rule AND its first canonical implementation. Plans 00-05 ship the implementation. Plan 06 ships:
1. The rule artifact in the canonical repo (not only in ~/MindrianRooms/)
2. The linter that enforces frontmatter declaration on every interactive command
3. The pre-commit gate that prevents future regressions
4. The Dror 2.0 acceptance harness (source spec line 129)
5. The frontmatter audit pass on the 4 commands the rule doc names (new-project, file-meeting, grade, onboard)

Per binding decision B5 second clause: the 4 commands' actual remediations (the per-command implementation work to satisfy reward-before-investment) are OUT OF SCOPE for Phase 118 -- they are separate follow-up phases. Plan 06 only declares the FIELD with the rule-doc-prescribed value so the linter has a baseline. Future phases (e.g. a "/mos:new-project reward-before-investment remediation" phase) wire the actual reward delivery and update the field value if the chosen reward type differs from the doc.

Per binding decision B6 OPTION A: Phase 119 wires option-2 of the 3-option footer later. Plan 06 does NOT touch /mos:new-project's body -- only its frontmatter. The "Build a room around this" stub message from Plan 05 stays in place.

Per LD1 LOCKED (118-CONTEXT.md, resolves OQ1): the Dror 2.0 harness Test 3 asserts the English-only Hebrew refusal envelope per LD1. The harness DOES NOT fail loudly on "OQ1 unresolved" -- it reads LD1 from 118-CONTEXT.md ## Locked Decisions and asserts the LOCKED Hebrew refusal behavior. (CRITICAL-1+5 invariant: future-grep for the literal substrings `LD1` and `LOCKED` MUST hit this plan and the harness source so the reader knows OQ1 is no longer open.)

Purpose: without this plan, the rule lives in a tester room markdown file with no enforcement, and the source-spec's hardest acceptance criterion (line 129: "subject types one sentence and clicks an option within 60 seconds of the brief rendering") has no programmatic test. Both gaps would let future contributors silently violate the constitution and would let the v1.13.0 Hooked re-score gate fire without proof that the Action axis actually hit 8/10.

Output:
- lib/core/mva-rule-linter.cjs (the library)
- scripts/check-reward-before-investment.cjs (the CLI)
- tests/test-mva-dror-harness.cjs (the acceptance harness)
- docs/reward-before-investment-rule.md (the rule in the repo)
- 4 commands/*.md with frontmatter declarations
- hooks/pre-commit augmented to enforce
- tests/run-all-118.sh aggregator + Feynman runner registration
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@CLAUDE.md
@docs/MINDRIAN-CANON.md
@docs/CANON-PHASE-MAP.md
@~/MindrianRooms/mindrian/mindrianOS/sub-rooms/communications/conversion-fix/solution-design/reward-before-investment-rule.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-CONTEXT.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-00-userprompt-detection-PLAN.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-04-feynman-deck-vercel-PLAN.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-05-footer-routing-PLAN.md
@tests/run-all-117.sh
@.planning/phases/117-auto-explore-domains-on-first-material/117-05-SUMMARY.md
@commands/new-project.md
@commands/file-meeting.md
@commands/grade.md
@commands/onboard.md
@hooks/pre-commit

<interfaces>
<!-- Key types/contracts the executor uses. Mostly upstream from Plans 00-05. -->

From lib/core/mva-state.cjs (Plan 00):
```javascript
exports.readPending(sessionId) -> {status, sentence, sha8, ...} | null
exports.markComplete(sessionId, {vercel_url, brief_sha8, duration_ms}) -> void
// State file: ~/.mindrian/mva/<session-id>.json
// Status transitions: pending -> running -> complete | failed | aborted
```

From scripts/mva-detect.cjs (Plan 00):
```
Spawned as UserPromptSubmit hook. Reads CLAUDE_USER_PROMPT env. Exits 0 in <1500ms.
Test-time invocation: CLAUDE_USER_PROMPT="..." CLAUDE_SESSION_ID="test-<sha>" node scripts/mva-detect.cjs
```

From Plan 03 + Plan 04 telemetry:
```
~/.mindrian/telemetry/v1.13/mva.jsonl events (per OQ8 lean):
  mva_pipeline_started, mva_agent_returned, mva_brief_rendered,
  mva_option_selected, mva_brief_deployed
Each line: {ts, session_id, event_type, payload: {...}}
```

From tests/run-all-117.sh (Phase 117 precedent, canonical shape):
```bash
#!/usr/bin/env bash
set -euo pipefail
CJS_SUITES=(
  "lib/memory/explored-materials-store.test.cjs"
  "lib/memory/auto-explore-agent.test.cjs"
  ...
)
SH_SUITES=(
  "tests/test-117-00-scaffold.sh"
)
# Loop runs each, reports GREEN/RED counts, exits non-zero on any RED.
```

From commands/new-project.md (current frontmatter shape -- preserve byte-identical except for the new field):
```yaml
---
name: new-project
description: Start a new venture project and create its room
argument-hint: [name]
serves_jtbd: ["explore"]
teaching: "When you are starting a new venture, /mos:new-project creates the room scaffolding..."
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---
```
Insert interactive_first_reward field above allowed-tools (alphabetical order maintained where convention exists).
</interfaces>
</context>

<task type="auto" tdd="true">
  <name>Task 1: Linter library + CLI + unit tests</name>
  <files>lib/core/mva-rule-linter.cjs, lib/core/mva-rule-linter.test.cjs, scripts/check-reward-before-investment.cjs</files>
  <behavior>
    Tests (RED first):
    - Test 1: scanCommands on a fixture dir with 1 compliant command (has interactive_first_reward: reframe_question) reports compliant.length == 1, missing.length == 0, invalid.length == 0
    - Test 2: scanCommands on a fixture dir with 1 missing-field command reports missing.length == 1
    - Test 3: scanCommands on a fixture dir with 1 invalid-value command (e.g. interactive_first_reward: gibberish) reports invalid.length == 1
    - Test 4: validateFrontmatter accepts "--none (scripting only)" verbatim as a valid value (per rule doc line 81)
    - Test 5: validateFrontmatter accepts each REWARD_TYPES enum value (reframe_question, instant_brief, schema_preview, calibration_distribution_preview, paragraph_preview)
    - Test 6: scanCommands on a fixture command without ANY YAML frontmatter reports it in missing.length (does NOT crash). Important: many legacy /mos:* commands may have no frontmatter -- this must degrade gracefully.
    - Test 7: CLI scripts/check-reward-before-investment.cjs spawn-test: when invoked against the fixture dir with all compliant, exits 0; when invoked against fixture with 1 missing, exits 1 with a Larry-voice summary string on stderr that names the offending file.
  </behavior>
  <action>
    Per binding decision B5 (the rule applies universally and Phase 118 ships the linter; the actual per-command remediations are out of scope here -- Task 2 just declares the FIELD).

    1. Write lib/core/mva-rule-linter.cjs:
       - Pure CJS, node built-ins only, no new runtime deps.
       - Exports: scanCommands(commandsDir), validateFrontmatter(yamlObj), REWARD_TYPES (frozen Set).
       - REWARD_TYPES enum (initial set, expandable later via canon amendment per the rule's closed-vocabulary principle):
         * reframe_question -- Larry reframes the user's sentence into a beautiful question
         * instant_brief -- the 30-second MVA pipeline output (this phase's deliverable)
         * schema_preview -- a structural preview of what would be extracted (file-meeting case)
         * calibration_distribution_preview -- anonymized score distribution from the calibration set (grade case)
         * paragraph_preview -- partial extraction from the first paragraph alone (file-meeting first-touch)
         * --none (scripting only) -- explicit opt-out, per rule doc line 81 (scripting override)
       - scanCommands reads every *.md in commandsDir, parses YAML frontmatter with the existing project pattern (use lib/core/frontmatter-schemas.cjs if it has a parser; otherwise inline a minimal `---\n...\n---` parser using js-yaml... NO: the project avoids new runtime deps; use the existing pattern, e.g. the same parser used by frontmatter-schema-validator.cjs).
       - Returns {ok: boolean, compliant: [...], missing: [...], invalid: [...]} where each array contains {path, reason} entries.

    2. Write scripts/check-reward-before-investment.cjs:
       - require('../lib/core/mva-rule-linter.cjs')
       - Resolve commands dir: process.argv[2] || path.join(__dirname, '..', 'commands')
       - Call scanCommands, print a table (compliant N / missing N / invalid N) + Larry-voice line.
       - Exit 1 on missing or invalid > 0; print the offending file paths to stderr with one-line reason each.
       - Larry-voice success line: "All ${N} interactive commands declare their first reward -- the rule holds."

    3. Write lib/core/mva-rule-linter.test.cjs:
       - Tests 1-7 from the behavior block above. Use fs.mkdtempSync for fixtures.
       - Mirror the test pattern from lib/core/dual-path-detector.test.cjs (Phase 115 substrate).
       - Test 7 uses child_process.spawnSync to invoke the CLI; captures stdout + stderr + exit code.

    GREEN: implement library + CLI to pass all 7 tests.

    Tests must run via `node lib/core/mva-rule-linter.test.cjs` and exit 0 on green.
  </action>
  <verify>
    <automated>node lib/core/mva-rule-linter.test.cjs 2>&1 | tail -5</automated>
  </verify>
  <done>
    - lib/core/mva-rule-linter.cjs exports scanCommands + validateFrontmatter + REWARD_TYPES
    - scripts/check-reward-before-investment.cjs runs end-to-end on a synthetic fixture dir and on the real commands/ directory
    - 7/7 unit tests GREEN
    - When invoked against the real commands/ dir BEFORE Task 2 runs, the linter reports the 4 commands (new-project, file-meeting, grade, onboard) as missing (RED-by-design baseline; Task 2 flips them to GREEN)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Frontmatter declarations + repo copy of rule + pre-commit gate (with WARN-5 audit + CRITICAL-4 hook verify)</name>
  <files>commands/new-project.md, commands/file-meeting.md, commands/grade.md, commands/onboard.md, docs/reward-before-investment-rule.md, hooks/pre-commit, lib/core/mva-rule-linter.test.cjs</files>
  <behavior>
    Tests added to lib/core/mva-rule-linter.test.cjs for Task 2:
    - Test 8 (CRITICAL-4 automated hook verify): grep hooks/pre-commit for the string "check-reward-before-investment.cjs". The grep MUST return at least one match. Failing equivalent in bash: `grep -q "check-reward-before-investment.cjs" hooks/pre-commit && echo "hook wired" || exit 1`.
    - Test 9 (CRITICAL-4 scaffold test -- end-to-end pre-commit block): set up a temp git repo (fs.mkdtempSync), copy hooks/pre-commit + scripts/check-reward-before-investment.cjs + lib/core/mva-rule-linter.cjs into it; create a fixture `commands/foo.md` with frontmatter that has `name: foo` + `description: test` + NO `interactive_first_reward` field; stage it (`git add commands/foo.md`); invoke the pre-commit hook (`bash hooks/pre-commit`); assert exit code is non-zero AND assert the stderr contains the linter's error message identifying foo.md as missing the field. This proves the hook chain is wired end-to-end, not just present.
    - Test 10 (WARN-5 -- new-project.md value verification): after Task 2's frontmatter edits, read commands/new-project.md and assert its frontmatter contains `interactive_first_reward: instant_brief` (NOT `reframe_question`). The rule doc lines 56-58 explicitly say "first user sentence triggers Instant Brief pipeline" -- this is the prescribed remediation, not a reframe-the-question reward.
    - Test 11 (WARN-5 audit -- 4-command rule-doc parity): for each of the 4 commands (new-project, file-meeting, grade, onboard), read the rule doc remediation column and assert the command's frontmatter value matches the prescribed reward type:
      * new-project -> instant_brief (per rule doc line 56-58)
      * file-meeting -> paragraph_preview (per rule doc line 60-62)
      * grade -> calibration_distribution_preview (per rule doc line 64-66)
      * onboard -> reframe_question (per rule doc line 68-70: "first screen is a question, not a tutorial")
      Any mismatch fails the test with a clear "command X declares Y but rule doc prescribes Z" message.
  </behavior>
  <action>
    Per binding decision B5: declare the field per the rule doc's prescribed values; do NOT change the command bodies (the actual remediation work is out-of-scope follow-up phases).

    1. Copy ~/MindrianRooms/mindrian/mindrianOS/sub-rooms/communications/conversion-fix/solution-design/reward-before-investment-rule.md verbatim to docs/reward-before-investment-rule.md.
       - Prepend a 3-line note: "This rule is sourced from {original path}. The canonical version lives there. This in-repo copy exists so future contributors can read the rule in the plugin context. Treat the source room as authoritative if the two ever diverge."
       - Per CLAUDE.md no-emdash rule: replace any em-dashes in the source with hyphens before saving (the source spec uses em-dashes; this in-repo copy honors the no-em-dash hard rule).

    2. Edit commands/new-project.md (WARN-5 fix):
       - Read the current frontmatter (preserve everything byte-identical).
       - Insert `interactive_first_reward: instant_brief` immediately after the `teaching:` field and before `allowed-tools:`. NOTE: this value is `instant_brief`, NOT `reframe_question`. The rule doc at lines 56-58 explicitly prescribes Instant Brief as the remediation: "first user sentence triggers Instant Brief pipeline. Room creation offered as option 2 of the 3-option footer."
       - Add a 1-line comment above the field: `# Per docs/reward-before-investment-rule.md line 56-58 remediation: first sentence -> Instant Brief pipeline (this phase's deliverable). Room creation is option 2 of the 3-option footer (Phase 119 wires fully in beta.18).`
       - Do NOT modify the command body. The user-facing wiring (option-2 routing into /mos:new-project) ships in Phase 119 per binding decision B6 option A.

    3. Edit commands/file-meeting.md (per rule doc line 60-62, WARN-5 audited):
       - Insert `interactive_first_reward: paragraph_preview`.
       - Comment: `# Per rule doc line 60-62: surface first-paragraph extraction preview before full transcript ask. Remediation tracked as follow-up phase.`

    4. Edit commands/grade.md (per rule doc line 64-66, WARN-5 audited):
       - Insert `interactive_first_reward: calibration_distribution_preview`.
       - Comment: `# Per rule doc line 64-66: show anonymized calibration distribution before requiring content. Remediation tracked as follow-up phase.`

    5. Edit commands/onboard.md (per rule doc line 68-70, WARN-5 audited):
       - Insert `interactive_first_reward: reframe_question`.
       - Comment: `# Per rule doc line 68-70: first screen is a question, not a tutorial. Remediation tracked as follow-up phase.`

    6. Edit hooks/pre-commit (CRITICAL-4 wire):
       - Locate the existing pre-commit hook (it exists per the install-pre-commit.sh pattern from Phase 123).
       - Add a step that runs `node scripts/check-reward-before-investment.cjs` IF any staged file matches `commands/*.md`. Use `git diff --cached --name-only --diff-filter=ACM | grep -E '^commands/.+\.md$'` to detect.
       - Skip when `COMMIT_NO_VERIFY=1` is set (wave-protocol invariant per Phase 125-08 SUMMARY note).
       - Echo a one-line Larry-voice message on success.

    7. Run scripts/check-reward-before-investment.cjs against the real commands/ directory.
       - Expected: previously-missing 4 commands now report compliant.
       - Other commands may still report missing -- that's fine; this plan only commits the rule + the linter + the 4 named commands' declarations. Other commands' declarations are out of scope and tracked as a follow-up audit phase.

    8. Write Tests 8-11 (CRITICAL-4 + WARN-5 invariants) inside lib/core/mva-rule-linter.test.cjs:
       - Test 8: bash-equivalent grep assertion via fs.readFileSync('hooks/pre-commit', 'utf8').includes('check-reward-before-investment.cjs').
       - Test 9: scaffold a temp git repo, copy hook + scripts + lib, stage a missing-field commands/foo.md, invoke `bash hooks/pre-commit` via child_process.spawnSync with proper env (set GIT_DIR / GIT_WORK_TREE to the temp dir or use cwd), assert exit code !== 0 AND stderr contains "foo.md".
       - Test 10: read commands/new-project.md after Task 2's edits, parse frontmatter, assert interactive_first_reward === 'instant_brief'.
       - Test 11: read all 4 commands + the rule doc, assert each command's value matches the rule doc's remediation column.

    Note: When determining whether a command is "interactive" (and therefore needs the field), the simplest rule is: every command whose execute path runs in a Claude Code session is interactive. For commands invoked only via scripting / CI / cron, the value `--none (scripting only)` is the correct declaration. Task 2 ONLY touches the 4 commands the rule doc names; a separate follow-up phase will audit and declare values for the remaining ~80 commands.

    Telemetry: emit one structured commit-message line that references all 4 rule-doc cited line numbers so cross-file audit grep can confirm the rule-doc -> command-frontmatter mapping.
  </action>
  <verify>
    <automated>node lib/core/mva-rule-linter.test.cjs 2>&1 | tail -10 && grep -q "check-reward-before-investment.cjs" hooks/pre-commit && echo "hook wired" && node scripts/check-reward-before-investment.cjs commands/ 2>&1 | grep -E "new-project|file-meeting|grade|onboard" || echo "(none of the 4 named commands are reported missing -- expected pass)"</automated>
  </verify>
  <done>
    - docs/reward-before-investment-rule.md exists in repo (em-dashes -> hyphens).
    - 4 commands/*.md files have interactive_first_reward declared with comment + rule-doc line reference. new-project.md has `instant_brief` (NOT reframe_question) per WARN-5 audit + rule doc line 56-58.
    - hooks/pre-commit references scripts/check-reward-before-investment.cjs (verified by grep + Test 8).
    - hooks/pre-commit BLOCKS a staged missing-field commands/*.md change (verified end-to-end by Test 9 scaffold).
    - Tests 8-11 GREEN (CRITICAL-4 hook wire + scaffold + WARN-5 rule-doc parity audit).
    - The CLI linter run against commands/ no longer reports the 4 named commands as missing.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Dror 2.0 acceptance harness + Phase 118 aggregator + Feynman runner registration</name>
  <files>tests/test-mva-dror-harness.cjs, tests/run-all-118.sh, lib/memory/run-feynman-tests.cjs</files>
  <behavior>
    Tests (the harness IS the test; meta-test is "the harness runs successfully"):
    - Test 1: 1 English venture sentence ("I have an idea for a couples finance app") spawns mva-detect.cjs with CLAUDE_USER_PROMPT env set, then polls ~/.mindrian/mva/<test-session>.json until status=complete OR 60 seconds elapse. Asserts: (a) status=complete within 60s, (b) state file carries a vercel_url field, (c) ~/.mindrian/telemetry/v1.13/mva.jsonl contains an mva_brief_rendered event for this session, (d) total_duration_ms recorded in the rendered event is <= 45000.
    - Test 2: 1 obvious non-venture sentence ("fix the failing test in src/foo.test.ts") spawns the hook; asserts no MVA state file is created (or state file exists with status=skipped).
    - Test 3 (CRITICAL-1+5 -- LD1 LOCKED Hebrew refusal): 1 Hebrew sentence (e.g. "יש לי רעיון לאפליקציה לזוגות") spawns the hook. The harness reads LD1 from .planning/phases/118-30-second-mva-reward-before-investment/118-CONTEXT.md (the `## Locked Decisions` section, `### LD1 -- English-only for v1.13.0` block). LD1 LOCKS English-only for v1.13.0. The harness asserts: state file status === 'hebrew_refusal' (or equivalent per the LD1 spec); rendered output contains the bilingual refusal block (English + Hebrew); NO agents were invoked; NO Vercel deploy was attempted. The harness DOES NOT fail loudly on "OQ1 unresolved" -- OQ1 is LOCKED per LD1, the harness simply asserts LD1's prescribed behavior. (Future grep for `LD1` AND `LOCKED` will hit this test block; the literal keywords appear inline so the wire is visible to reviewers.)
    - Test 4: Concurrent invocation: 2 venture sentences submitted within 5 seconds in the same session. Asserts: only one pipeline runs (per Plan 00 binding "no double-fire"); the second sentence's hook exits with reason=already_running.
    - Aggregator (run-all-118.sh): spawn each test in CJS_SUITES sequentially; print GREEN/RED counts; exit non-zero on any RED.
  </behavior>
  <action>
    The Dror 2.0 harness is the source-spec's hardest acceptance criterion (line 129). It is also the v1.13.0 Hooked re-score gate's evidence basis.

    Per OQ6 lean (settled): synthetic harness + real-user test. This task ships ONLY the synthetic harness (CI-enforceable). The real-user "felt the product" signal is collected outside CI by one of the Wave-2 testers and recorded in the phase SUMMARY at /gsd:verify-work time.

    1. Write tests/test-mva-dror-harness.cjs:
       - Pure CJS, node built-ins only.
       - 3 fixture sentences (constants at top of file):
         * VENTURE_EN = "I have an idea for a couples finance app"
         * NON_VENTURE = "fix the failing test in src/foo.test.ts"
         * HEBREW = "יש לי רעיון לאפליקציה לזוגות"
       - For each fixture, generate a unique synthetic session id (e.g. `dror-${sha8(sentence)}-${ts}`).
       - Spawn scripts/mva-detect.cjs as child_process.spawn (not spawnSync -- the hook returns immediately but the dispatch agent runs detached).
       - Pass env: CLAUDE_USER_PROMPT=<sentence>, CLAUDE_SESSION_ID=<synthetic id>, MINDRIAN_MVA_TEST_MODE=1 (so the harness can branch to dry-run Vercel if needed -- see note below on Vercel in CI).
       - Poll readPending(sessionId) every 500ms; on status=complete, capture vercel_url + duration_ms.
       - MAX_TIME_MS = 60000 (hard timeout per source spec line 129).
       - Test 3 reads LD1 from 118-CONTEXT.md (CRITICAL-1+5). Implementation:
         ```javascript
         // CRITICAL-1+5: read LD1 LOCKED decision from 118-CONTEXT.md
         // Future-grep keywords: LD1, LOCKED -- these literal substrings MUST appear
         // here so reviewers / future planners can confirm OQ1 is closed.
         function readLD1FromContext() {
           const ctx = fs.readFileSync(
             path.join(__dirname, '..', '.planning', 'phases',
                       '118-30-second-mva-reward-before-investment', '118-CONTEXT.md'),
             'utf8'
           );
           // LD1 LOCKED: English-only for v1.13.0 (resolves OQ1)
           // The harness asserts the LD1 behavior, not a runtime-resolved OQ1.
           const ld1Match = ctx.match(/### LD1[^\n]*\n([\s\S]*?)(?=\n### |\n---|\Z)/);
           if (!ld1Match) {
             throw new Error('LD1 LOCKED block not found in 118-CONTEXT.md -- the canon expected English-only for v1.13.0 is missing. Restore LD1 before running the harness.');
           }
           return { locked: true, english_only_v1_13_0: true, source: 'LD1', context_path: '118-CONTEXT.md' };
         }
         const LD1 = readLD1FromContext();
         // LD1 is LOCKED. The harness no longer needs to read a runtime OQ1 resolution -- LD1 supersedes it.
         ```
       - Print a Larry-voice summary table at end: each fixture, pass/fail, elapsed ms.

    Vercel-in-CI note: production Vercel deploy requires VERCEL_TOKEN. The harness must:
       - If VERCEL_TOKEN is set in env -> run the FULL pipeline including real Vercel deploy.
       - If VERCEL_TOKEN is NOT set -> Plan 04 must support a MINDRIAN_MVA_TEST_MODE=1 env that produces a fake-URL ("file://" or "https://test.example.invalid/") so the harness asserts the URL field is populated without requiring real Vercel access. Mark the test as "stub_mode" in the summary table when this fallback fires.

    Hebrew assertion fork (Test 3) per LD1 LOCKED:
       - LD1 LOCKED = English-only for v1.13.0. Harness asserts state file carries status === 'hebrew_refusal' (per LD1's prescribed behavior in 118-CONTEXT.md).
       - The harness DOES NOT branch on a runtime-resolved OQ1 value; OQ1 is LOCKED per LD1. The harness reads LD1 once at startup (readLD1FromContext) and uses it as a frozen invariant.
       - If readLD1FromContext throws (LD1 block missing from CONTEXT.md), the harness exits with a clear "LD1 LOCKED block not found" error -- this is the only failure mode; it indicates someone deleted the LOCKED decision from the canon, not that OQ1 is "unresolved."

    2. Write tests/run-all-118.sh:
       - Mirror tests/run-all-117.sh byte-for-byte except for the file list.
       - CJS_SUITES array: every test file from Plans 00-06 (12-15 entries -- exact list depends on what each plan's must_haves declare; this aggregator is owned by Plan 06 because it can see the full set).
       - SH_SUITES array: any .sh harness from earlier plans (likely empty for Phase 118).
       - Exit 1 if any RED.

    3. Append a "// ---------- Phase 118 ----------" block to lib/memory/run-feynman-tests.cjs at EOF, before the closing array bracket of TEST_FILES.
       - Register the same set as CJS_SUITES above.
       - Each line: `path.join(__dirname, '..', '<test-path>'),`
       - Header comment maps each test back to its plan number (e.g. `// Plan 06 Task 3 -- Dror 2.0 acceptance harness`).

    Important: this task lands LAST in Wave 4 because it depends on every other plan having committed its test files. If a test file isn't yet committed (e.g. Plan 02 is in progress), the harness execution will show RED for those entries; that's expected during incremental development but must be GREEN before /gsd:verify-work fires.
  </action>
  <verify>
    <automated>bash tests/run-all-118.sh 2>&1 | tail -10</automated>
  </verify>
  <done>
    - tests/test-mva-dror-harness.cjs exists and runs end-to-end against the fixture sentences.
    - The harness reads LD1 from 118-CONTEXT.md and asserts the LOCKED Hebrew refusal envelope (CRITICAL-1+5; literal keywords `LD1` and `LOCKED` are inline in the source).
    - tests/run-all-118.sh aggregates every Phase 118 test, exits 0 on full green.
    - lib/memory/run-feynman-tests.cjs has a Phase 118 block registering every Phase 118 test path.
    - When VERCEL_TOKEN is unset and MINDRIAN_MVA_TEST_MODE=1, the harness runs in stub mode and still asserts every assertion except real-Vercel reachability.
    - The harness exits with a clear error ONLY if LD1 is missing from 118-CONTEXT.md (canon-deletion guard) -- it does NOT fail loudly on "OQ1 unresolved" because OQ1 is LOCKED per LD1.
  </done>
</task>

<verification>
After all 3 tasks complete:

1. `node lib/core/mva-rule-linter.test.cjs` exits 0 (11/11 GREEN -- 7 unit + 4 hook/audit tests)
2. `node scripts/check-reward-before-investment.cjs commands/` reports the 4 named commands as compliant (other commands MAY still be missing -- expected; tracked as follow-up audit). commands/new-project.md MUST carry `instant_brief` (not `reframe_question`) per WARN-5.
3. `bash tests/run-all-118.sh` exits 0 with every CJS_SUITES entry GREEN
4. `git diff` shows ONLY: 4 commands' frontmatter changes (no body changes), 1 new docs/ markdown, 1 new lib/core file, 1 new lib/core test file, 1 new scripts/ file, 1 new tests/ harness, 1 new tests/ aggregator, 1 lib/memory/run-feynman-tests.cjs append, 1 hooks/pre-commit edit
5. Staging a fake broken commands/*.md change and running `git commit` triggers the pre-commit linter and blocks the commit; setting COMMIT_NO_VERIFY=1 bypasses (wave-protocol invariant)
6. Manual: a Wave-2 tester runs the Dror 2.0 path live (real Vercel deploy, real Brain call) and reports time-to-URL + emotional reaction. Recorded in the phase SUMMARY at /gsd:verify-work time per OQ6 lean.
7. CRITICAL-1+5 future-grep: `grep -rn "LD1\|LOCKED" tests/test-mva-dror-harness.cjs .planning/phases/118-30-second-mva-reward-before-investment/118-06-rule-linter-dror-harness-PLAN.md` MUST hit both files -- the literal keywords prove OQ1 is no longer open.
8. CRITICAL-4 hook scaffold: `node lib/core/mva-rule-linter.test.cjs` runs Test 9 which scaffolds a temp repo, stages a broken commands/foo.md, invokes the hook, asserts blocked.

Canon Part 8 audit (per Phase 90/117 precedent):
- `grep -rn "user-content\|raw_sentence\|sentence_text" lib/core/mva-rule-linter.cjs lib/core/mva-rule-linter.test.cjs scripts/check-reward-before-investment.cjs tests/test-mva-dror-harness.cjs` returns 0 hits in any field that egresses (the venture sentence stays local in the state file; only sha8 + scalar counts are written to telemetry per Plans 00 + Phase 121 schema).
- The Dror harness's child-process spawn passes CLAUDE_USER_PROMPT to the hook via env (which is sub-process-only, NOT a network surface); the hook + classifier handle local content; the only network surfaces are Vercel REST API (Plan 04) + Anthropic detection model (Plan 00) + Tavily (Plan 02) + Brain (Plan 02), all already audited in their respective plans.

Locked Decisions consumed (verify each is present in 118-CONTEXT.md before execution):
- LD1 (English-only for v1.13.0, resolves OQ1): Harness Test 3 asserts the LD1 Hebrew refusal envelope. The harness reads LD1 from 118-CONTEXT.md at startup; LD1 is LOCKED, not runtime-resolved.
- LD2 (Vercel REST API direct, resolves OQ2): Plan 118-04 implements LD2; this plan's harness consumes it via deployDeck.
- OQ6 (Dror 2.0 runner): synthetic + real-user (both per the lean). This plan ships synthetic; real-user runs at verify-work.
- OQ8 (Phase 121 telemetry binding): yes, harness reads ~/.mindrian/telemetry/v1.13/mva.jsonl to assert mva_brief_rendered event fired with duration_ms <= 45000.

Open Questions for Jonathan (escalate before execution if not already settled by Plan 00):
- OQ19 (NEW, this plan): Should the linter also check the existing ~80 commands and flag a list of "needs follow-up" entries, or stay scoped to the 4 the rule doc names? Lean: stay scoped here; emit a "follow-up phase needed" comment in docs/reward-before-investment-rule.md naming the un-audited commands as a separate phase candidate.
- OQ20 (NEW, this plan): Should the Dror harness be wired to v1.13.0 Hooked re-score automatically? Lean: yes -- the harness emits a structured "dror_pass" event to telemetry that Phase 121.5 or a follow-up Hooked-rescore phase can consume. Out of scope for this plan; the structured event is forward-compatible.
</verification>

<success_criteria>
Plan 06 ships when:
- [ ] lib/core/mva-rule-linter.cjs library + .test.cjs unit tests + scripts/check-reward-before-investment.cjs CLI committed; all 11 unit tests GREEN (7 base + 4 CRITICAL-4/WARN-5 audit).
- [ ] docs/reward-before-investment-rule.md exists in repo (em-dashes -> hyphens, source-of-truth note prepended).
- [ ] commands/{new-project, file-meeting, grade, onboard}.md carry interactive_first_reward declarations matching rule-doc remediation column. commands/new-project.md MUST carry `instant_brief` (NOT `reframe_question`) per WARN-5 + rule doc line 56-58.
- [ ] hooks/pre-commit blocks a commands/*.md commit that lacks/invalidates the field; respects COMMIT_NO_VERIFY=1. CRITICAL-4 scaffold test proves end-to-end blocking.
- [ ] tests/test-mva-dror-harness.cjs covers Test 1-4. Test 3 reads LD1 from 118-CONTEXT.md and asserts LOCKED Hebrew refusal envelope (CRITICAL-1+5; literal keywords `LD1` and `LOCKED` are inline).
- [ ] tests/run-all-118.sh aggregates every Phase 118 test; exits 0 on full green at the end of Wave 4.
- [ ] lib/memory/run-feynman-tests.cjs has a Phase 118 block registering every Phase 118 test.
- [ ] Canon Part 8 audit: zero user-content egress in any of Plan 06's net-new files (the venture sentence stays local in state files; only sha8 + scalar counts ever cross a process boundary).
</success_criteria>

<output>
After completion, create `.planning/phases/118-30-second-mva-reward-before-investment/118-06-SUMMARY.md` per the standard template.

SUMMARY should record:
- Linter REWARD_TYPES enum (the canonical list at v1.13.0 -- future expansions are canon amendments per the closed-vocabulary principle)
- The 4 commands' interactive_first_reward values (for the cross-room audit trail). Explicit note: new-project.md carries `instant_brief` per rule doc line 56-58, NOT `reframe_question` -- this was the WARN-5 audit fix in plan-checker iteration 2.
- The CRITICAL-4 hook wire evidence: hooks/pre-commit grep result + the scaffold-test outcome (temp-repo block on missing field).
- The CRITICAL-1+5 LD1-LOCKED wire evidence: the harness reads LD1 from 118-CONTEXT.md ## Locked Decisions block; OQ1 is closed per LD1; future-grep keywords `LD1` and `LOCKED` are inline in the harness source.
- The Dror 2.0 harness's measured wall-clock time across the 3 fixtures (raw numbers, for the Hooked Action axis re-score evidence base)
- Follow-up phases registered: (a) audit + declare interactive_first_reward on remaining ~80 commands; (b) implement the actual reward-before-investment remediations on the 3 commands the rule doc names other than new-project (which is Phase 118's canonical implementation already); (c) Phase 121.5 capstone consumes the dror_pass telemetry event for the Hooked re-score gate
</output>
</output>
