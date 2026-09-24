357 GATE: PASSED

---
phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros
plan: 04
subsystem: infra
tags: [jev, dev-time, moonshot, egress-guard, part8]

# Dependency graph
requires:
  - phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros (plan 01)
    provides: "the 357 gate pass, lib/core/fork-declaration.cjs (MOONSHOT_PREFIX = 'What if', parseForkDeclaration/formatDeclaration), and the pre-359 inertness anchor this plan's Task 2 verify step re-checks"
provides:
  - "data/jev-policies/fork359-moonshot.json: two independent Score policies (relevant_to_context, radical_departure), 5 situation levels each, 4+ boundary cases each"
  - "scripts/jev-devtime-client.cjs EGRESS_PROFILES.fork359_moonshot: one additive frozen exact_state_v1 profile, question_type score, omitting criteria_keys/question_strings_from_file_key (Score criteria is an array, not a Noul true/false object)"
  - "scripts/score-moonshots-359.cjs: dev-only, refusal-first moonshot scorer (selectRows, buildScoreBody, mapScore, renderReport, writeReport, main), keyless-safe"
  - "tests/test-359-moonshot-scorer.cjs: 75 legs (keyless spawn, guard enforcement with fetchImpl spy, policy-string deep equality, pre-request refusals, report hygiene, additive-profile-only diff, vendor scan)"
  - "tests/test-353-tripwires.cjs HOOKS_BANNED_LEDGER_SCRIPTS: one additive entry, score-moonshots-359"
  - "data/ROOM.md: one row for jev-policies/fork359-moonshot.json"
affects: [359-06, 359-10, 359-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Score-question egress profile without question_strings_from_file_key: 356's exact_state_v1 kind assumes Noul-shaped criteria ({true, false}) for that optional check; a Score question's criteria is an ARRAY of level strings, which the check cannot express. Recorded as a real guard gap (not papered over): the scorer's own buildScoreBody copies every rule, level and boundary string verbatim from the parsed policy file, and the test's own S3 leg asserts deep equality against the file on every built body. 356 still owns the schema; this plan adds no new schema piece, only a new frozen profile entry."
    - "Injectable root for pure-function fixture-path testing: selectRows({fixtures, root}) resolves the canonical synthetic-359 fixture path under an optional `root` (default REPO_ROOT), never exposed as a production CLI flag. This let the per-entry 'source is not synthetic-359' refusal be exercised in a test-owned mkdtemp tree without ever touching or mutating the real, peer-shared prose-forks-359.json fixture committed in plan 02's wave."
    - "Mirrors the 357 label-card-fire-replay.cjs shape almost line for line (module-scope POLICY_RAW/POLICY_JSON/POLICIES_BY_ID/POLICY_SHA256 read once at require time, QUESTION_TEXT with a 400-char build-time assertion, refuse-never-truncate on guard caps, a markdown report with ids/labels/counts only, never entry text, keyless exit 0), the established dev-time Jev ledger-script pattern in this repo."

key-files:
  created:
    - data/jev-policies/fork359-moonshot.json
    - scripts/score-moonshots-359.cjs
    - tests/test-359-moonshot-scorer.cjs
  modified:
    - scripts/jev-devtime-client.cjs
    - data/ROOM.md
    - tests/test-353-tripwires.cjs

key-decisions:
  - "PLAN_BASE = a44615a06085ea9f478523339a1cfa1320e45333 (HEAD at plan start; confirmed clean git status --short on every file this plan touches, including the two shared files, before any edit)"
  - "Task 1 commit: f996acd68 (feat, fork359-moonshot.json policy + fork359_moonshot profile + ROOM.md row). Task 2 commit: 86088e3b4 (feat, score-moonshots-359.cjs + its test + the tripwire entry)"
  - "The additive fork359_moonshot profile deliberately omits criteria_keys and question_strings_from_file_key -- both assume Noul-shaped criteria objects; a Score question's criteria is an array (up to 10 level descriptions per the Jev contract). This is stated in-file as a comment and proven not to be a silent gap: buildScoreBody's own S3 test leg asserts every rule, level and boundary_cases string in a built body deep-equals the policy file"
  - "selectRows accepts an optional, test-only `root` field (default REPO_ROOT) so the per-entry synthetic-359 source-mismatch refusal can be exercised against an injected mkdtemp fixture tree, never against the real, peer-shared prose-forks-359.json (owned by plan 02, in the same wave)"
  - "fromResults scenario lookup defaults to tests/fixtures/forward-fork-scenarios-359.json (plan 05, not yet built as of this plan); when that file or the results JSONL is absent, selectRows returns zero rows for a missing file and refuses 'unknown scenario <id>' for any row whose scenario_id cannot be resolved -- both paths were exercised directly against explicit temp fixtures in tests/test-359-moonshot-scorer.cjs S4b, independent of plan 05's landing order"

requirements-completed: [FORK359-09, FORK359-01]

# Metrics
duration: ~50min active
completed: 2026-09-24
---

# Phase 359 Plan 04: N-3 moonshot dev-time instrument (Score policy, egress profile, scorer) Summary

**Gave N-3's moonshot a dev-time quality instrument: two independent Score policies (relevant to context, radical departure), one additive `fork359_moonshot` egress profile declared in 356's schema, and a refusal-first, keyless-safe scorer that reads only the synthetic-359 fixture or authored forward-scenario text, never a hook, never dogfood, never Larry's full reply.**

## Performance

- **Duration:** ~50 min active
- **PLAN_BASE:** `a44615a06085ea9f478523339a1cfa1320e45333`
- **Tasks:** 2/2 complete
- **Files modified:** 6 (3 created: `fork359-moonshot.json`, `score-moonshots-359.cjs`, `test-359-moonshot-scorer.cjs`; 3 modified: `jev-devtime-client.cjs`, `data/ROOM.md`, `test-353-tripwires.cjs`)

## Precondition

`head -1 PD/359-01-SUMMARY.md` printed `357 GATE: PASSED` (checked before any file was touched). `node tests/test-359-inertness.cjs` ran clean (4/4) both before and after this plan's edits, confirming this plan touched no classifier file.

## Task 1: the two Score policies and the fork359_moonshot egress profile

**Policy file (`data/jev-policies/fork359-moonshot.json`):** two policies, `relevant_to_context` and `radical_departure`, each with a one-paragraph instructions field naming the state keys it reads (`context`, `practical_labels`, `moonshot`), 5 situation-describing levels (least to most, per Jev's Score contract: "levels describe situations, not degrees"), and 4 boundary cases each in the `<case> -> level <n>: <why>` shape. `relevant_to_context` asks whether the moonshot still addresses the decision in `context`; `radical_departure` asks how far the moonshot departs from every `practical_labels` entry in *kind*, naming trending-to-the-absurd as a legitimate, valued source of radicalness (N-3), not a penalty.

**Profile (`scripts/jev-devtime-client.cjs`):** one new frozen `EGRESS_PROFILES.fork359_moonshot` entry, added after the last existing entry, touching no other profile (`git diff $PLAN_BASE -- scripts/jev-devtime-client.cjs | grep '^-' | grep -vc '^---'` = 0). `kind: 'exact_state_v1'`, `model: 'jev-latest'`, `state_keys`/`string_keys`: `['context', 'practical_labels', 'moonshot', 'policy']`, `max_len_by_key: {context: 2000, practical_labels: 300, moonshot: 100}`, `must_equal_file: {policy: 'data/jev-policies/fork359-moonshot.json'}`, `question_ids: ['relevant_to_context', 'radical_departure']`, `question_type: 'score'`, `instructions_keys: ['question', 'rule', 'boundary_cases']`, `question_max_len: 400`. `criteria_keys` and `question_strings_from_file_key` are deliberately omitted with an in-file comment recording why (Score criteria is an array, the Noul-shaped file-string check cannot express it) and where the enforcement actually lives (the scorer's builder + its own test's deep-equality assertion, Task 2 S3).

**data/ROOM.md:** `git status --short -- data/ROOM.md` was clean before editing, so one row was added for `jev-policies/fork359-moonshot.json` in the "Files in this section" table, mirroring the existing `card-fire-replay.json` row's shape and stating the `question_strings_from_file_key` gap and its replacement enforcement.

**Guard smoke check (4 outcomes, run via `node -e` in the session scratchpad before commit):**
1. `makeEgressGuard(EGRESS_PROFILES.fork359_moonshot, {root})` accepts a body built from the policy file (question text `'Q?'`, `rule` = `instructions`, `boundary_cases`, `criteria` = `levels`) -> **accept: true**.
2. A one-byte change to `state.policy` -> **throws `EGRESS_REFUSED`**.
3. An extra state key `room` -> **throws `EGRESS_REFUSED`**.
4. A 2001-char `context` -> **throws `EGRESS_REFUSED`**.
5. A question of type `noul` (instead of `score`) -> **throws `EGRESS_REFUSED`**.

All 5 recorded outcomes matched the plan's acceptance criteria exactly (the plan's step 4 named 4 refusal cases; all 4 plus the accept case were run and recorded here).

**Commit:** `f996acd68` (feat, `data/jev-policies/fork359-moonshot.json` + `scripts/jev-devtime-client.cjs` + `data/ROOM.md`).

## Task 2: the dev-only moonshot scorer, its test, and the tripwire entry

**`scripts/score-moonshots-359.cjs`** exports `selectRows`, `buildScoreBody`, `mapScore`, `renderReport`, `writeReport`, `main`, `QUESTION_TEXT`, `POLICIES_BY_ID`.

- `selectRows({fixtures, fromResults, scenariosPath, root})`: the only place any candidate row is ever read, and the refusal point runs before any request body is built.
  - `fixtures`: reads ONLY `tests/fixtures/card-fire-replay/prose-forks-359.json` (resolved under `root`, default `REPO_ROOT`; `root` is a test-only injection point, never a production flag). Any other path throws `refused: <path> is not the synthetic-359 fixture`. Any entry whose `source` is not `synthetic-359` throws `refused: entry <id> source is not synthetic-359` (defense in depth -- the committed fixture never has one, so this exercises a hypothetical corruption path). Each `prose_fork: true` entry whose last `fork_labels` element starts with `MOONSHOT_PREFIX` ('What if') gives a row `{id, context: envelope.output_text, labels: fork_labels}`; entries without a moonshot-shaped last label are silently skipped ("no-moonshot"). A missing fixture file yields zero rows, never a crash.
  - `fromResults <jsonl>`: reads rows where `declared === true` and `declared_labels` is an array. Each row's `scenario_id` must resolve in the authored scenario fixture (`scenariosPath`, default `tests/fixtures/forward-fork-scenarios-359.json`, not yet built as of this plan -- plan 05 lands it later in the same wave); an unresolvable id throws `refused: unknown scenario <id>`. `context` = that scenario's authored `turns` joined by a blank line (never Larry's reply). `id = <scenario_id>:<arm>:<run>`.
- `buildScoreBody(row, policyText)`: `{model: 'jev-latest', state: {context, practical_labels: labels.slice(0,-1).join(' | '), moonshot: labels.at(-1), policy: policyText}, questions: {relevant_to_context, radical_departure}}`, each question `{type: 'score', instructions: {question: <fixed <=400-char sentence>, rule: policy.instructions, boundary_cases: policy.boundary_cases}, criteria: policy.levels}`, copied verbatim from the parsed policy file (never reworded). Values over the profile caps are never truncated -- the guard refuses them.
- `mapScore(answer)`: `{type: 'score', score: finite number, confidence}` -> `{score, confidence}`, else the string `'error'`.
- `renderReport(rows, meta, {append, section})`: markdown header (timestamp, model, policy sha256, counts by status, the "Scores are dev-time evidence only and are never auto-applied to any fixture (N-3)" statement), a per-row table (id, moonshot label, relevant score/confidence, radical score/confidence, status), and a distribution block (mean + 5-bucket histogram per question). Never any context text. `append: true` renders just the new `## <section>` block for the caller to append.
- `main(argv)`: flags `--fixtures`, `--from-results <path>`, `--scenarios <path>`, `--report <path>` (default `PD/359-MOONSHOT-SCORES.md`), `--section`, `--append`, `--dry-run` (builds and guards every body, sends nothing). Keyless (`loadKey` returns null): every row `unlabeled`, report written, prints `unlabeled: no TYPESAFE key (keyless run)`, exit 0. Otherwise builds the guard once, `pool(rows, 4, ...)`, one `jev(body, {key, guard})` call per row; an `EGRESS_REFUSED` throw or non-200/malformed response marks the row `refused: <key>` or `error: ...`. Never prints the key or raw response text.

**`tests/test-359-moonshot-scorer.cjs`** -- 75 legs, all passing:
- **S1** (keyless spawn, `HOME` set to a fresh mkdtemp dir): exit 0, stdout contains `unlabeled`, report written, zero `NETWORK_ATTEMPT_359` on stderr.
- **S2** (guard enforcement through the real profile, on an in-test synthetic row independent of the committed fixture): the valid body passes; 6 single-field mutations (policy one byte, extra `room` state key, 2001-char context, question type `noul`, a third question id, a 401-char question sentence) each throw `EGRESS_REFUSED`, and routing every mutated body through `client.jev()` with a `fetchImpl` spy leaves the spy at 0 calls.
- **S3**: every `instructions.rule`, `instructions.boundary_cases` and `criteria` (the levels array) in a body built from the real committed fixture deep-equals the policy file; `instructions.question` stays <= 400 chars; `criteria` has exactly 5 levels.
- **S4**: three refusal legs, spy count 0 throughout -- (a) `--fixtures` pointed at `dogfood.json`, (b) a results row naming an unknown `scenario_id`, (c) a fixture entry whose `source` is not `synthetic-359` (via the injectable `root`, never touching the real committed fixture).
- **S5**: `renderReport` over a row carrying a sentinel string in a field the function never reads (`__leak_check_only_context`) never leaks it; the report contains `never auto-applied` and both moonshot labels; the `append` mode's output starts with `## <section>`.
- **S6**: `git show $PLAN_BASE:scripts/jev-devtime-client.cjs` loaded from a mkdtemp copy; every one of the 7 pre-existing `EGRESS_PROFILES` entries (`section_command_ledger`, `material_step_ledger`, `framework_command_ledger`, `card_fire_replay`, `hsi_thinking_mode`, `citation_check`, `usefulness_judge`) is JSON-identical to PLAN_BASE; HEAD carries exactly one more profile (`fork359_moonshot`) than PLAN_BASE.
- **S7**: no non-comment `lib/` or `hooks/` line references `api.typesafe.ai`, `TYPESAFE_API_KEY`, `score-moonshots-359` or `jev-devtime-client`; a negative-control scratch file carrying `api.typesafe.ai` outside `lib`/`hooks` is caught by the same scan (proof the scan is not vacuous).

**`tests/test-353-tripwires.cjs`**: ran clean before editing (`PASS=5 FAIL=0`, no peer diff on the file or on `lib/core`). Appended exactly one line, `'score-moonshots-359',`, after the last `HOOKS_BANNED_LEDGER_SCRIPTS` entry (`measure-hsi-thinking-mode`). Ran again after the edit: still `PASS=5 FAIL=0` (leg 1's `lib/core/` scratch-write leg ran, since `lib/core` was confirmed clean).

**Commit:** `86088e3b4` (feat, `scripts/score-moonshots-359.cjs` + `tests/test-359-moonshot-scorer.cjs` + `tests/test-353-tripwires.cjs`).

## Verification Results

- `node tests/test-359-moonshot-scorer.cjs` -- PASS=75 FAIL=0, exit 0
- `node tests/test-353-tripwires.cjs` -- PASS=5 FAIL=0, exit 0 (before AND after the edit)
- `node tests/test-357-labeler-refusal.cjs` -- PASS=83 FAIL=0, exit 0 (357's own labeler test, untouched, still green)
- `node tests/test-359-inertness.cjs` -- 4/4, exit 0 (before AND after this plan's edits)
- `bash tests/run-all-357.sh` -- PASS=16 FAIL=0 SKIP=0, exit 0 (357 fully green after this plan)
- `grep -c "'score-moonshots-359',"` tests/test-353-tripwires.cjs -- 1
- `git diff $PLAN_BASE -- tests/test-353-tripwires.cjs \| grep '^-' \| grep -vc '^---'` -- 0 (additive only)
- `git diff $PLAN_BASE -- scripts/jev-devtime-client.cjs \| grep '^-' \| grep -vc '^---'` -- 0 (additive only)
- `env -u TYPESAFE_API_KEY HOME=$(mktemp -d) node scripts/score-moonshots-359.cjs --fixtures --report "$(mktemp -d)/m.md"; echo $?` -- prints `unlabeled: no TYPESAFE key (keyless run)` and `0`
- `node -e "..."` (policy shape: 2 policies, each 5 levels, each >= 4 boundary cases) -- exit 0
- `node -e "..."` (guard accept + 4 refusal outcomes over a body built from the real policy file) -- `ok` + profile list including `fork359_moonshot`
- `grep -v '^\s*//' scripts/score-moonshots-359.cjs \| grep -c "fetch("` -- 0 (all network goes through the shared client's `jev`)
- `grep -v '^\s*//' scripts/score-moonshots-359.cjs \| grep -c "dogfood"` -- 0
- `! grep -rn "api.typesafe.ai" lib/ hooks/` -- no match (exit 1 on the raw grep, i.e. the ban holds)
- `git diff --name-only $PLAN_BASE..HEAD \| grep -E '(lib/mcp/brain-router\|lib/core/write-lock\|lib/core/part8-egress-guard\|scripts/doctor\|lib/core/graph-ops\|scripts/eval-icm-writers\|tests/test-353-grader-agreement\|tests/test-353-ledger-shape\|lib/core/navigation)\.cjs$\|docs/OPEN-HANDOFFS\.md$'` -- empty
- `git diff --name-only $PLAN_BASE..HEAD -- lib hooks` -- empty
- Em-dash/en-dash guard on every new/modified file (`fork359-moonshot.json`, `jev-devtime-client.cjs`, `data/ROOM.md`, `score-moonshots-359.cjs`, `test-359-moonshot-scorer.cjs`, `test-353-tripwires.cjs`) -- 0 for each
- Post-commit deletion check (`git diff --diff-filter=D --name-only HEAD~1 HEAD`) -- empty for both task commits
- `git status --short` after both commits -- only the 4 pre-existing deliberately-uncommitted files (`scripts/eval-icm-writers.cjs`, `tests/test-353-grader-agreement.cjs`, `tests/test-353-ledger-shape.cjs`, `docs/reviews/mindrian-system-explainer.html`) plus 2 pre-existing untracked docs files, none touched by this plan

## Peer messages (to relay)

No live agent-messaging tool (ListAgents or equivalent) was available in this execution context, same as 359-01's own finding. Both shared files this plan touched had a clean `git status --short` immediately before editing and immediately before each commit, so no peer diff was ever encountered and no message needs relaying for THIS plan's edits. For the orchestrator's awareness: this plan is the second 359 plan (after 359-01/02/03) to add to `EGRESS_PROFILES` and `HOOKS_BANNED_LEDGER_SCRIPTS` in the same two shared files 356 (jsagi-a7) originally built and 357 (jsagi-e0) already extended; both additions here (`fork359_moonshot`, `score-moonshots-359`) are purely additive, zero-removed-line, and proven so by `S6`/the `git diff ... grep -vc '^---'` checks above.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

None (Rule 1-4 sense). Both tasks executed as written. One implementation choice made within the plan's stated discretion, documented above and in `key-decisions`: `selectRows` accepts an additional, optional, test-only `root` field (not itself named in the plan's `selectRows({fixtures, fromResults, scenariosPath})` signature, but backward-compatible and never exposed as a CLI flag) so the "fixture entry whose source is not synthetic-359" refusal leg (explicitly required by the plan's S4) could be exercised without mutating the real, peer-shared `prose-forks-359.json` fixture that plan 02 owns in the same wave.

## Issues Encountered

None.

## Stub Tracking

No stubs. `fork359-moonshot.json` carries two fully authored Score policies (5 levels, 4 boundary cases each), not placeholders. `score-moonshots-359.cjs` is complete, load-bearing logic (refusal, body-building, mapping, reporting, keyless degrade, guarded egress), exercised by 75 real test legs plus a live keyless CLI run against the real committed fixture (17 rows scored `unlabeled`, report file inspected by hand). No hardcoded empty return paths flow to any rendering surface; the only intentional "skip" path (a row whose last label is not moonshot-shaped) is a real, tested filtering rule from the plan, not a stub.

## Threat Flags

None new. This plan's own `<threat_model>` targets are directly addressed and verified:
- **T-359-16** (user or dogfood text reaching Jev): `selectRows` refuses any path but the synthetic fixture and any results row not tied to an authored scenario, before any body is built; context always comes from authored turns or the fixture's own `output_text`, never Larry's full reply; S4 legs prove the spy stays at 0.
- **T-359-17** (score question strings smuggling text past the guard): the guard pins keys/types/caps/ids/policy bytes; `buildScoreBody` copies every rule, level and boundary string from the policy file; S3 asserts deep equality; the Noul-shaped file-string check gap is recorded in-file and in `data/ROOM.md`, not papered over.
- **T-359-18** (`EGRESS_PROFILES` union or 356 schema redefinition): one additive frozen profile; S6 proves every other profile JSON-identical to PLAN_BASE; no checker function (`_checkExactStateV1`, `_applyOptionalFields`, `makeEgressGuard`) was edited.
- **T-359-19** (key printed or committed): `loadKey` from `~/.secrets` only; no key or response text printed anywhere; the keyless path exits 0.
- **T-359-20** (scorer loaded from a hook): `HOOKS_BANNED_LEDGER_SCRIPTS` entry added; header states never a hook; S7 vendor scan (with negative control) confirms zero references under `lib/` and `hooks/`.

## User Setup Required

None -- no external service configuration, no secrets, no network egress (the keyless CLI path and the fetch-thrower counter in the test both exercised the zero-network contract directly).

## Next Phase Readiness

- Plan 06 (`359-JEV-LABEL-REPORT.md`, `359-MOONSHOT-SCORES.md`, ratified dogfood fork labels) is unblocked: `scripts/score-moonshots-359.cjs --fixtures` is ready to run against a live key and write `359-MOONSHOT-SCORES.md` for the 17 synthetic-359 prose-fork entries that carry a moonshot-shaped label today.
- Plan 05 (the forward harness) can land in either order relative to this plan within the same wave 2: `selectRows`'s `fromResults` path already handles a missing `tests/fixtures/forward-fork-scenarios-359.json` or missing results JSONL gracefully (zero rows, never a crash), and refuses any row whose `scenario_id` cannot be resolved once that fixture exists.
- Plans 10/11 (the R9 forward run, moonshot scores of forward declarations) can invoke `scripts/score-moonshots-359.cjs --from-results <results.jsonl>` once plan 05's harness produces rows in the documented `{scenario_id, arm, run, declared, declared_labels, ...}` shape.
- Per this plan's own scope contract (peers share this tree), no `STATE.md`/`ROADMAP.md`/`REQUIREMENTS.md` write was made; `requirements-completed: [FORK359-09, FORK359-01]` is recorded in this file's frontmatter for the orchestrator to apply.
- No blockers.

---
*Phase: 359-missed-fork-detection-larry-poses-a-genuine-decision-in-pros*
*Plan: 04*
*Completed: 2026-09-24*

## Self-Check: PASSED

- FOUND: data/jev-policies/fork359-moonshot.json
- FOUND: scripts/score-moonshots-359.cjs
- FOUND: tests/test-359-moonshot-scorer.cjs
- FOUND: commit f996acd68 (Task 1)
- FOUND: commit 86088e3b4 (Task 2)
- No missing items.
