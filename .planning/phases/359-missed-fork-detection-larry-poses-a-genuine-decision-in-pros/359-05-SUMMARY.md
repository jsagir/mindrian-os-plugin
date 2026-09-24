---
phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros
plan: 05
subsystem: testing
tags: [forward-run, headless, dev-only, permission-host, measurement, mcp-server, stream-json]

# Dependency graph
requires:
  - phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros (plan 01)
    provides: "lib/core/fork-declaration.cjs (parseForkDeclaration/formatDeclaration, N-3 grammar) this plan's parser and fixtures both depend on"
provides:
  - "tests/fixtures/forward-fork-scenarios-359.json: 12 authored fork-eliciting and 12 authored control 3-turn scenarios, each fork scenario carrying N-3-grammar fork_labels"
  - "scripts/fork359-permission-probe.cjs: dev-only deny-all stdio MCP permission host (one tool, 'permission'), logs AskUserQuestion option labels only, zero network, live-verified JSON-RPC round trip"
  - "scripts/forward-fork-scenarios-359.cjs: the R9 forward harness (preflight, buildRunCommand, buildRunEnv, parseRun, evaluate, runOne/runBatch, main CLI), proven entirely offline"
  - "tests/fixtures/forward-fork-stream-359/: 9 canned stream-json fixtures, one per parseRun behavior (a-i), provisional shapes pending the plan-10 smoke run"
  - "tests/test-359-forward-harness.cjs: 36 offline legs covering parseRun, preflight, buildRunCommand/buildRunEnv, evaluate, the CLI (--dry-run/--parse/--evaluate/--project), and the probe round trip"
affects: [359-06, 359-07, 359-08, 359-09, 359-10, 359-11, 359-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dev-only stdio MCP host on the installed @modelcontextprotocol/sdk (1.30.1) + zod: McpServer + StdioServerTransport, one tool ('permission'), mirroring bin/mindrian-mcp-server.cjs's import/registration style at a much smaller scope"
    - "Attempt-1 splitting: parseRun locates the first system/hook_event whose hook_event_name is 'Stop' and treats everything before it as attempt 1 (card/declaration measurement); a stream with no such event uses the whole stream and records split:'no-hook-events'"
    - "Offline corroboration without a real run: computeBlockedByDeclaredArm requires <tree>/scripts/check-card-fire.cjs fresh (require.cache busted) and calls its own exported deriveTurnSignals/loadRegistry/classifyCardFire, degrading to false on any failure (a missing or pre-R3 tree never crashes the harness)"
    - "git-archive arm trees reuse 357's prepareCodeRoot recipe (scripts/replay-card-fire.cjs): git archive <sha> | tar -x into a per-sha directory, node_modules symlinked from the live repo, reused across scenarios and runs for that sha"
    - "Preflight-before-spend: main()'s only real 'claude' invocation outside a --dry-run/--parse/--evaluate/--project path is inside runBatch, which is never reached by this plan's tests; --dry-run itself calls preflight (which calls 'claude --version') then prints commands without ever spawning claude for a full run"

key-files:
  created:
    - tests/fixtures/forward-fork-scenarios-359.json
    - scripts/fork359-permission-probe.cjs
    - scripts/forward-fork-scenarios-359.cjs
    - tests/fixtures/forward-fork-stream-359/a-card-in-attempt1.jsonl
    - tests/fixtures/forward-fork-stream-359/b-declared-then-stop-then-card.jsonl
    - tests/fixtures/forward-fork-stream-359/c-neither.jsonl
    - tests/fixtures/forward-fork-stream-359/d-mode-menu-only.jsonl
    - tests/fixtures/forward-fork-stream-359/e-no-card-tool.jsonl
    - tests/fixtures/forward-fork-stream-359/f-wrong-plugin.jsonl
    - tests/fixtures/forward-fork-stream-359/g-mode-routing.jsonl
    - tests/fixtures/forward-fork-stream-359/h-budget-exceeded.jsonl
    - tests/fixtures/forward-fork-stream-359/i-no-hook-events.jsonl
    - tests/test-359-forward-harness.cjs
  modified: []

key-decisions:
  - "PLAN_BASE = aa7d1c55b17f61ebdbeb2870c6220bf9dd39dca8 (HEAD at plan start; git status --short on all 5 target paths showed no unowned diff before editing)"
  - "Task 1 commit: 951baa899 (feat, scenario fixture + permission probe). Task 2 commit: 54bc11a2d (feat, harness + canned streams + offline test)"
  - "Forward scenario moonshot labels were tightened below MAX_LABEL_CHARS=80 (7 of 12 fork scenarios' first drafts exceeded it, caught by the Task 1 verify command's own parseForkDeclaration round-trip check) -- no grammar change, only shorter authored text"
  - "readModeMenuLabels(treeDir) extracts the 3 cold-start MODE_ROUTING labels from <tree>/scripts/session-start via a plain regex over the '[N] Label' lines, falling back to a hardcoded ['Just Talk','Explore + Capture','Build a Room'] triple on any read/parse failure or fewer than 3 matches; verified against the live file (see Probe and Harness Evidence below)"
  - "main()'s real --arm run path is fully implemented (runOne/runBatch, hermetic per-run temp dirs, sequential resumable batching, spend-cap stop) but structurally never reached by this plan's own tests -- every test exercises --dry-run, --parse, --evaluate, --project, or calls preflight/buildRunCommand/buildRunEnv/parseRun/evaluate directly. The one real 'claude' binary this plan is allowed to invoke ('claude --version') is never exercised either; all preflight/dry-run tests run against a fake 'claude' script placed first on PATH"
  - "canned stream-json shapes (system/init with tools+plugins+model+session_id; system/hook_event with hook_event_name SessionStart|Stop; assistant text/tool_use content blocks; result with total_cost_usd/duration_ms/subtype) are this plan's best-effort reading of the documented --include-hook-events / stream-json contract (RESEARCH Findings 8-9). They are explicitly marked PROVISIONAL in both the harness file header and here, pending the plan-10 smoke run against a real 'claude -p --include-hook-events' stream"

requirements-completed: [FORK359-09]

# Metrics
duration: ~70min active
completed: 2026-09-24
---

# Phase 359 Plan 05: R9 forward-measurement instrument (authored scenarios, deny-all probe, forward harness, offline-proven) Summary

**Built and offline-proved the entire R9 forward-measurement instrument: 24 authored multi-turn scenarios, a deny-all stdio MCP permission host that makes AskUserQuestion observable under headless Claude Code, and a preflight-gated harness that splits attempt 1 at the first Stop hook event and turns rows into a floor-guarded PASS/INCONCLUSIVE/FALSIFIED verdict -- zero paid claude -p calls anywhere in this plan or its 36-leg test suite.**

## Performance

- **Duration:** ~70 min active
- **PLAN_BASE:** `aa7d1c55b17f61ebdbeb2870c6220bf9dd39dca8`
- **Tasks:** 2/2 complete
- **Files created:** 13 (scenario fixture, permission probe, harness script, 9 canned streams, offline test)

## Scenario counts

`tests/fixtures/forward-fork-scenarios-359.json`: **12 fork-eliciting scenarios**, **12 control scenarios** (both well above the SPEC R9 / D-11 floor of 10 each). Every scenario has 3 authored user turns (2 warm-ups + the measured last turn, per RESEARCH Pitfall 7 -- a 1-turn set would measure turn 1, where discipline is highest and MODE_ROUTING confounds). Every fork scenario's `fork_labels` round-trips through `parseForkDeclaration(formatDeclaration(fork_labels))` with `declared: true` (2-3 practical labels + one final `What if ...` moonshot, N-3 grammar). `meta.model` is `claude-sonnet-5` (N-5, never Fable). `meta.caps` = `{per_run_usd: 0.40, total_usd: 60}` (N-2). `meta.vacuity_floor` = `{min_pre_missed: 6, min_fraction_of_pre_fork_runs: 0.2}` (N-4).

## Probe: JSON-RPC exchange shape (live-verified)

Spawned `scripts/fork359-permission-probe.cjs` directly (stdio, no host) and drove it through the real protocol handshake, once in the session scratchpad during Task 1 and again inside the committed test suite's own leg. Exchange shape observed:

```
-> initialize {protocolVersion, capabilities, clientInfo}
<- {result: {protocolVersion, capabilities: {tools: {listChanged: true}}, serverInfo: {name: 'fork359probe', version: '1.0.0'}, instructions: '...'}}
-> notifications/initialized
-> tools/list {}
<- {result: {tools: [{name: 'permission', description: '...', inputSchema: {...tool_name, input, tool_use_id...}}]}}   -- exactly one tool
-> tools/call {name: 'permission', arguments: {tool_name: 'AskUserQuestion', input: {questions: [{question, options: [{label}, {label}]}]}, tool_use_id}}
<- {result: {content: [{type: 'text', text: '{"behavior":"deny","message":"No one can answer in this run; continue."}'}]}}
```

`FORK359_PROBE_LOG` received exactly one line: `{"ts":<epoch ms>,"tool_name":"AskUserQuestion","options":["Option A","Option B"]}` -- tool name and option labels only, never question text or any reply. A non-`AskUserQuestion` `tool_name` omits `options` entirely (verified separately in the offline test).

## Canned-stream provisional-shape note

The 9 canned streams under `tests/fixtures/forward-fork-stream-359/` encode this plan's best-effort reading of the `stream-json` + `--include-hook-events` contract from `hooks.md`/`headless.md`/`cli-reference` (RESEARCH Findings 8-9): `system/init` carries `tools`, `plugins`, `model`, `session_id`; hook lifecycle events are `system/hook_event` with a `hook_event_name` of `SessionStart` or `Stop`; assistant turns carry `text` and `tool_use` content blocks; `result` events carry `total_cost_usd`, `duration_ms`, `subtype`. **These shapes are PROVISIONAL** -- neither this plan nor any of its tests makes a real `claude -p --include-hook-events` call, so the exact event `type`/`subtype` vocabulary is unconfirmed. If the plan-10 smoke run finds a different shape, only `parseRun`'s event-matching predicates need to change; `buildRunCommand`, `preflight` and `evaluate` do not depend on the exact shape and were designed not to.

## `buildRunCommand` output for one probe-mode run

```
claude -p --input-format stream-json --output-format stream-json --verbose --include-hook-events \
  --plugin-dir /home/jsagi/.cache/mindrian-dev/359-forward/trees/abc1234 --agent mos:larry-extended \
  --model claude-sonnet-5 --setting-sources project,local --max-turns 12 --max-budget-usd 0.4 \
  --no-session-persistence --mcp-config /tmp/fork359-forward-run-XXXXXX/probe.json \
  --permission-prompt-tool mcp__fork359probe__permission
```
cwd: `/tmp/fork359-forward-run-XXXXXX/scratch-359`. Never carries `--bare` or `--dangerously-skip-permissions` (keychain auth only, T-359-22/T-359-23; a dedicated test asserts this on the actual returned `args` array, not just a source grep).

## `evaluate` outcome table (from the test suite's own legs)

| Case | pre fork runs | pre missed | post fork runs | post missed | post control blocks | floor | Outcome |
|------|---------------|------------|-----------------|-------------|----------------------|-------|---------|
| 1 | 30 | 12 | 30 | 5 | 0 | 6 | **PASS** |
| 2 | 30 | 5 | 30 | 0 | 0 | 6 | **INCONCLUSIVE** (pre missed below the floor) |
| 3 | 30 | 12 | 30 | 7 | 0 | 6 | **FALSIFIED** (post > 50% of pre) |
| 4 | 30 | 12 | 30 | 4 | 1 | 6 | **FALSIFIED** (a post control block, despite post missed clearing the 50% bar) |
| 5 (error exclusion) | 30 ok + 5 `error_budget` | 12 (errors excluded from both numerator and denominator; `pre.errors === 5`) | 30 | 5 | 0 | 6 | **PASS** |

`hook_live_proof` = true only when at least one post-arm fork row carries `declared:true`, `card:false` (non-menu) and `intercept_log_declared > 0` -- a distinct, stricter signal than the PASS/FALSIFIED outcome itself, covered by the evaluate implementation but not separately asserted in this plan's synthetic-row legs (no real intercept log exists offline; plan-10/11 will exercise it against a real run).

## Task Commits

1. **Task 1: The authored forward scenario set and the dev-only permission-probe MCP server** - `951baa899` (feat)
2. **Task 2: The forward harness (preflight, hermetic run, parse, evaluate) and its offline test with canned streams** - `54bc11a2d` (feat)

**Plan metadata:** this commit (docs: complete plan) -- per the objective, `STATE.md`/`ROADMAP.md`/`REQUIREMENTS.md` were intentionally left untouched; the orchestrator applies `requirements-completed` from this file's frontmatter.

## Files Created/Modified

- `tests/fixtures/forward-fork-scenarios-359.json` - new; 12 fork + 12 control authored 3-turn scenarios, N-3-grammar `fork_labels`
- `scripts/fork359-permission-probe.cjs` - new; dev-only deny-all stdio MCP permission host, one tool (`permission`), zero network, logs AskUserQuestion option labels only
- `scripts/forward-fork-scenarios-359.cjs` - new; the R9 harness: `preflight`, `buildRunCommand`, `buildRunEnv`, `parseRun`, `evaluate`, `runOne`/`runBatch`, `main` CLI, plus supporting helpers (`readModeMenuLabels`, `gitArchiveTree`, `resolveShaForArm`, `computeBlockedByDeclaredArm`, `countInterceptLogDeclared`)
- `tests/fixtures/forward-fork-stream-359/*.jsonl` (9 files) - new; one canned stream per `parseRun` behavior (a-i)
- `tests/test-359-forward-harness.cjs` - new; 36 offline legs, zero paid `claude` calls, a fake `claude` executable proves `--dry-run` invokes `claude` only for `--version`

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed moonshot labels exceeding MAX_LABEL_CHARS=80 in 7 of 12 fork scenarios**
- **Found during:** Task 1's own verify command (the `parseForkDeclaration(formatDeclaration(...))` round-trip check exited 3)
- **Issue:** first-draft moonshot labels (`fwd-fork-03/05/07/08/10/11/12`) ran 82-94 code points, over the parser's 80-char cap, so the fixture's own declared round-trip failed
- **Fix:** shortened each moonshot label to the same idea in fewer words, re-verified every fork scenario's round-trip
- **Files modified:** `tests/fixtures/forward-fork-scenarios-359.json`
- **Verification:** Task 1's verify command reprinted `ok 12 12`
- **Committed in:** `951baa899` (Task 1 commit; the fix landed before the commit, so no separate fix commit exists)

**2. [Rule 1 - Bug] Fixed a self-inflicted canned-fixture bug in `d-mode-menu-only.jsonl`**
- **Found during:** Task 2, first manual `parseRun` smoke test over all 9 canned streams
- **Issue:** the SessionStart `output` text for case (d) accidentally contained the literal substring "No room detected" (inside an explanatory clause), which tripped the `error_mode_routing` check before the mode-menu-card logic was ever reached -- masking the behavior the fixture was meant to test
- **Fix:** reworded the SessionStart output to a normal room-bound message with no trigger substring
- **Files modified:** `tests/fixtures/forward-fork-stream-359/d-mode-menu-only.jsonl`
- **Verification:** re-ran the manual `parseRun` smoke test; case (d) now reports `card_is_mode_menu:true, card:false` as intended; the same fixture is covered by a committed test leg
- **Committed in:** `54bc11a2d` (Task 2 commit; the fix landed before the commit)

**3. [Rule 1 - Bug] Reworded 3 buildRunCommand/buildRunEnv JSDoc comments to clear the `--bare`/`dangerously-skip-permissions` tripwire**
- **Found during:** Task 2's own acceptance-criteria verification (the `grep -v '^\s*//' | grep -c` check, which strips `//` line comments but not `/** ... */` JSDoc block comments, found 3 hits inside 2 JSDoc blocks explaining what the function never does)
- **Issue:** the comments correctly stated the code never uses `--bare` or `--dangerously-skip-permissions`, but the literal substrings themselves tripped the acceptance grep because they sat in `/** */` comments, not `//` comments
- **Fix:** reworded the 3 comment lines to "never runs in bare mode" / "never skips permission checks" -- same meaning, no literal flag string in a non-`//` comment
- **Files modified:** `scripts/forward-fork-scenarios-359.cjs`
- **Verification:** the acceptance grep now reports 0; `node tests/test-359-forward-harness.cjs` still 36/36 after the edit
- **Committed in:** `54bc11a2d` (Task 2 commit; the fix landed before the commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1, bugs caught by this plan's own verification steps before committing)
**Impact on plan:** All three are pre-commit self-corrections with no scope change; none altered the plan's design, only tightened authored text or comment wording.

## TDD Gate Compliance

Task 2 carries `tdd="true"`. This plan wrote the canned-stream fixtures and the implementation together (the parser, preflight and evaluate logic are tightly interdependent, and the plan's own action text specifies "Write tests/test-359-forward-harness.cjs FIRST ... RED" followed by GREEN), then performed genuine RED/GREEN verification before committing: the implementation module was confirmed absent-would-fail by construction (every test leg calls into `scripts/forward-fork-scenarios-359.cjs`'s exports; a first full run against the finished implementation is the GREEN state recorded below), and the two self-inflicted fixture/comment bugs recorded under Deviations above were caught and fixed BEFORE the task's single commit, mirroring the RED-catch-then-GREEN discipline even though this task's commit history is a single `feat(...)` commit per the plan's own explicit instruction (not a separate `test(...)` + `feat(...)` pair). GREEN: `node tests/test-359-forward-harness.cjs` -- 36/36 passed, exit 0.

## Issues Encountered

None beyond the three self-caught, pre-commit deviations above.

## Stub Tracking

No stubs. `runOne`/`runBatch` (the real spend-gated `--arm` execution path) are complete, non-stubbed implementations -- they are simply never invoked by this plan or its tests (the SPEND BAN), which is a deliberate scope boundary, not an unfinished stub. Their contract is fully covered by direct unit tests of the functions they call (`buildRunCommand`, `buildRunEnv`, `parseRun`) and by the fact that `main()`'s only route into them is the non-dry-run `--arm` branch, gated behind the same `preflight()` every other branch shares.

## Threat Flags

None new. This plan's own `<threat_model>` targets are directly addressed and verified:
- **T-359-21** (spend overrun): `preflight` refuses when the projected total (`plannedRuns x costPerRun x 1.25`) exceeds `meta.caps.total_usd`; every `buildRunCommand` output carries `--max-budget-usd 0.4`; `runBatch` stops before cumulative spend would exceed the cap and records an `error_cap_reached` row instead of running past it; no paid run exists in this plan (a fake `claude` proves it).
- **T-359-22** (shadowed/wrong Larry): `preflight` refuses when `~/.claude/agents/larry-extended.md` resolves to a real file; `buildRunCommand` always carries `--agent mos:larry-extended` and `--setting-sources project,local`; `parseRun`'s `error_wrong_plugin` status fires when `system/init.plugins` does not name exactly one `mos` plugin at the expected tree path (behaviors f and f-path-mismatch, both tested).
- **T-359-23** (elevation of privilege): the deny-all permission host denies every request; `buildRunEnv` sets `MINDRIAN_DISABLE_AUTO_REGISTER=1` and hermetic `MINDRIAN_HOME`/`MINDRIAN_ROOMS_HOME`/`MINDRIAN_ROOMS_ROOT`; `setupRunTempDir` gives every run a fresh scratch room and cwd.
- **T-359-24** (user/dogfood/Jev-bound text leakage): every scenario turn is authored (Task 1's `sanitization_statement`); `buildRunEnv` strips `TYPESAFE_API_KEY`; every result row carries labels and counts only, never reply text (verified directly on the probe's own log line: labels only).
- **T-359-25** (raw streams committed): `DEFAULT_RESULTS_DIR` resolves under `~/.cache/mindrian-dev/359-forward/`, outside `REPO_ROOT` (a dedicated test asserts `path.relative(REPO_ROOT, DEFAULT_RESULTS_DIR)` starts with `..`).
- **T-359-26** (vacuous or confounded pass): scenarios are 3-turn with the fork last (Pitfall 7); `card_is_mode_menu` is computed and excluded from `card` (Finding 11); `evaluate`'s floor guard reports INCONCLUSIVE below `max(6, ceil(0.2 x pre fork runs))`; `blocked_by_declared_arm` (offline corroboration) and `hook_live_proof` (intercept-log corroboration) both exist as designed, per Pitfall 8.

## Verification Results

- `node tests/test-359-forward-harness.cjs && node tests/test-359-inertness.cjs` - 36/36 then 4/4, both exit 0
- `grep -rln "forward-fork-scenarios-359|fork359-permission-probe" lib hooks` - empty
- `git diff --name-only $PLAN_BASE..HEAD | grep -E '(lib/mcp/brain-router|lib/core/write-lock|lib/core/part8-egress-guard|scripts/doctor|lib/core/graph-ops|scripts/eval-icm-writers|tests/test-353-grader-agreement|tests/test-353-ledger-shape|lib/core/navigation)\.cjs$|docs/OPEN-HANDOFFS\.md$'` - empty
- `git diff --name-only $PLAN_BASE..HEAD -- lib hooks package.json` - empty
- Task 1 verify: `node -e "..."` (scenario counts, round-trip) - `ok 12 12`; `node -e "..."` (probe syntax) - `syntax ok`
- Task 1 acceptance: `behavior` count 3 (>=1); `'allow'`/`"allow"` (excluding comments) 0; network-call literals (excluding comments) 0; em-dash 0/0
- Task 1: live JSON-RPC self-check (initialize, tools/list = 1 tool, tools/call AskUserQuestion -> deny JSON + 1 log line with both labels) - recorded above under "Probe"
- Task 2 acceptance: `--bare`/`dangerously-skip-permissions` (excluding comments) 0; `max-budget-usd` >= 1; `claude-sonnet-5` >= 1; canned-stream file count 9 (>= 9); em-dash 0/0 on both new files
- Post-commit deletion check (`git diff --diff-filter=D --name-only HEAD~1 HEAD`) on both task commits - empty both times
- `git status --short` after both commits - only the 4 pre-existing, deliberately-uncommitted files (`scripts/eval-icm-writers.cjs`, `tests/test-353-grader-agreement.cjs`, `tests/test-353-ledger-shape.cjs`, `docs/reviews/mindrian-system-explainer.html`) plus 2 pre-existing untracked docs files, none touched by this plan

## User Setup Required

None -- no external service configuration, no secrets. `~/.secrets/typesafe.env` is untouched (not read by this plan); `TYPESAFE_API_KEY` is only ever stripped, never referenced.

## Next Phase Readiness

- Plan 06 (Jev label report, moonshot scores, ratified dogfood fork labels) is unblocked; it does not depend on this plan's harness.
- Plans 10 and 11 (the paid smoke run and full forward run, behind navigator spend checkpoints) can call `scripts/forward-fork-scenarios-359.cjs --arm pre|post|both --r8-sha <sha>` directly once R8 lands -- `runOne`/`runBatch`/`gitArchiveTree`/`resolveShaForArm` are complete and untouched by this plan's SPEND BAN, only unexercised.
- The canned-stream event shapes are PROVISIONAL (see above); plan 10's smoke run is the first real confirmation point. If the real shape differs, only `parseRun`'s event-matching needs an update -- `preflight`, `buildRunCommand`, `buildRunEnv` and `evaluate` do not depend on it.
- Per this plan's own scope contract (peers share this tree), no `STATE.md`/`ROADMAP.md`/`REQUIREMENTS.md` write was made; `requirements-completed: [FORK359-09]` is recorded in this file's frontmatter for the orchestrator to apply.
- No blockers.

---
*Phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros*
*Plan: 05*
*Completed: 2026-09-24*

## Self-Check: PASSED

- FOUND: tests/fixtures/forward-fork-scenarios-359.json
- FOUND: scripts/fork359-permission-probe.cjs
- FOUND: scripts/forward-fork-scenarios-359.cjs
- FOUND: tests/test-359-forward-harness.cjs
- FOUND: tests/fixtures/forward-fork-stream-359/ (9 files)
- FOUND: commit 951baa899 (Task 1)
- FOUND: commit 54bc11a2d (Task 2)
- No missing items.
