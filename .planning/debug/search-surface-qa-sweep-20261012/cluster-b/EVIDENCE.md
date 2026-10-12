# Cluster B, item 6 - SPEC-5 hooks/ adapter-only budget leg (run-all-198)

Sweep: search-surface-qa-sweep-20261012 (kind: qa-sweep). Investigator mode: diagnose only. No code, test, script, hook or data file was edited. No commit. No network.

Source of truth: branch `main` @ 63b25583d, local workspace /home/jsagi/dev/MindrianOS-Plugin. All claims below are CODE claims read against that sha. No WIRE claims.

Claim marks: PROVEN = command run and output seen in this session. UNVERIFIED = not run. ASSUMED = inferred.

Raw capture of the failing test: `cluster-b/test-output.txt` (same directory).

## Symptom

`bash tests/run-all-198.sh` ends with `Passed: 16   Failed: 1`. The failing leg is "SPEC-5 hooks/ adapter-only budget (import audit + line-count)", which runs `node tests/test-198-adapter-budget.test.cjs`. Two sessions on 2026-10-12 called the leg pre-existing and named no cause.

## Evidence

- timestamp: 2026-10-12T16:30Z
  checked: `cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-198-adapter-budget.test.cjs` (exit code captured with `echo EXIT=$?`)
  found: PROVEN. `EXIT=1`. TAP summary `# tests 15`, `# pass 14`, `# fail 1`. The one failure is subtest 2, `checkAdapterBudget() passes against the real committed tree today`, at tests/test-198-adapter-budget.test.cjs:98 (assertion at line 100). Failing assertion text, verbatim:
  `combined import-audit + line-budget gate is green: {"pass":false,"importAudit":{"pass":true,"files":[{"script":"scripts/statusline-mos-dispatch","pass":true,"violation":null},{"script":"scripts/sessionstart-coordinator.cjs","pass":true,"violation":null},{"script":"scripts/on-stop","pass":true,"violation":null}]},"lineBudget":{"pass":false,"files":[{"script":"scripts/statusline-mos-dispatch","lines":128,"budget":150,"pass":true},{"script":"scripts/sessionstart-coordinator.cjs","lines":250,"budget":280,"pass":true},{"script":"scripts/on-stop","lines":658,"budget":570,"pass":false}]}}` then `false !== true`, `code: 'ERR_ASSERTION'`, `expected: true`, `actual: false`, `operator: 'strictEqual'`.
  implication: The import audit is green for all three surfaces. Only the line-count budget of `scripts/on-stop` fails: 658 lines against a ceiling of 570. The other 14 subtests pass, including the flag-ON-branch bash audit and the "guard is live" fixtures. The test is not broken.

- timestamp: 2026-10-12T16:31Z
  checked: first line of the same output
  found: PROVEN. The first stdout line is `PASS: test-198-adapter-budget (17 assertions -- see TAP output above for the per-check trace)`, printed unconditionally at the end of the file (test file line 360), even though the run exits 1. The file comment (lines 349-359) says the exit code is the real signal and the line is "a human-readable summary only". The text also says 17 assertions while TAP reports 15 tests.
  implication: A human who reads only the first line of the output sees PASS. This is a misleading line, not the cause. Only the exit code and the TAP lines show the failure. It may help explain why the leg is easy to wave off. UNVERIFIED that it did so.

- timestamp: 2026-10-12T16:31Z
  checked: tests/test-198-adapter-budget.test.cjs (whole file), lib/mcp/hook-adapter-audit.cjs lines 28-63, 149-194, data/hooks-markers.json
  found: PROVEN. The budget rule, from the source:
  (1) Files: the surfaces named in `data/hooks-markers.json` key `_mcpFirst198Migrated.surfaces`, read by `migratedSurfaces()`. Today: `scripts/statusline-mos-dispatch`, `scripts/sessionstart-coordinator.cjs`, `scripts/on-stop`. The test asserts exactly these three (EXPECTED_MIGRATED_SURFACES, lines 63-70).
  (2) Import list: `FORBIDDEN_IMPORT_PATTERN` in hook-adapter-audit.cjs. Forbidden after comment stripping: a `require(...)` of `lib/core`, `lib/workflow` or `lib/memory`. `lib/mcp/*` is allowed (test lines 151-161). For `scripts/on-stop` (bash) the test adds a bespoke check of the text between the sentinels `# BEGIN-MCP-FIRST-STOP-THIN-ADAPTER` and `# END-MCP-FIRST-STOP-THIN-ADAPTER` (test lines 192-242).
  (3) Line limit: the constant `LINE_BUDGETS` in lib/mcp/hook-adapter-audit.cjs lines 59-63: `'scripts/statusline-mos-dispatch': 150`, `'scripts/sessionstart-coordinator.cjs': 280`, `'scripts/on-stop': 570`. Line count is `src.split('\n').length` (audit file line 166), which is one more than `wc -l` on a file with a trailing newline. A surface with no recorded budget fails closed.
  Where the limits come from: the header comment of hook-adapter-audit.cjs lines 33-58. 570 = 547 measured + 23 margin, set by Phase 198-09 on 2026-07-10. The same comment says the whole-file count for on-stop is "a secondary signal" and that the flag-OFF legacy body "stays inline BY DESIGN".
  implication: The limit is a hard-coded constant in a module, not a JSON. Nothing reads it from config. The rule is clear and the constant is the single place to change a number.

- timestamp: 2026-10-12T16:32Z
  checked: `wc -l lib/mcp/hook-adapter-audit.cjs scripts/on-stop`; `node -e` split-count of the two other surfaces; `grep -n "BEGIN-MCP-FIRST\|END-MCP-FIRST" scripts/on-stop`
  found: PROVEN. `scripts/on-stop` is 657 lines by `wc -l`, 658 by the test measure (`split('\n')`). Statusline 128 of 150 (22 spare). SessionStart coordinator 250 of 280 (30 spare). on-stop 658 of 570, an overage of 88 lines. The BEGIN sentinel is at line 47 and the END sentinel at line 136, so the flag-ON thin-adapter span is lines 47-136 (90 lines). Lines 137-657 are the legacy body (about 520 lines). Lines 120-135 show the flag-ON branch does `exit 0` on success and falls through to the legacy body on daemon trouble.
  implication: The violation is exactly one file and one number: scripts/on-stop, 658 lines, limit 570. The 90-line flag-ON adapter span, which is the part D-06 means by "thin", is far inside any sane limit. The overage sits in the legacy flag-OFF body.

- timestamp: 2026-10-12T16:34Z
  checked: `git log --full-history --format='%h %ad %s' --date=short 7226232a7^..HEAD -- scripts/on-stop`, then `git show <sha>:scripts/on-stop` split-count for each non-merge commit (no checkout)
  found: PROVEN. Line count of scripts/on-stop (test measure) at each commit:
  - 7226232a7 (2026-07-10, feat(198-09), the migration that set the budget): 547
  - f63d1ddce (2026-07-23, fix: remove invalid Stop-hook hookSpecificOutput): 553 (under 570)
  - 8462f41ad (2026-07-28, feat(241-01), capture guardian systemMessage and fold into final Stop-hook JSON): 580 (OVER 570, first breach, +27)
  - 0d02e112e (2026-07-28, fix(241-02), honest peek census): 605 (+25)
  - c7fb00dba (2026-07-28, feat(241-05), run the guardian on the shared Stop path): 612 (+7)
  - 01c3ca19d (2026-07-30, fix(240.1-03), persistState write sites): 618 (+6)
  - 26629ecff (2026-10-06, feat(369.25-19), BRIEF.md rendered per nest on the on-stop walk): 658 (+40)
  `git merge-base --is-ancestor 8462f41ad HEAD` returned true. The 241 work reached main through merge 77f0f66ab (2026-07-28, "merge(241): execute Feynman-MINTO phase").
  implication: First breaching commit is 8462f41ad, phase 241-01, 2026-07-28. Five commits in two phases (241 and 240.1) plus one in 369.25 added 111 lines to a file whose budget leaves 23. The budget was exhausted by the first 241 task alone (+27). The merge commits between 7226232a7 and f63d1ddce were not tested one by one; the line count at f63d1ddce (553) is known and under the limit. UNVERIFIED that no merge commit showed a transient value above 570.

- timestamp: 2026-10-12T16:35Z
  checked: replay of the audit module at old commits, in copies under the session scratchpad (no checkout). Command: for each sha, `git show <sha>:lib/mcp/hook-adapter-audit.cjs`, `hooks/hooks.json` and the three scripts into a temp tree, then `node -e "require('./lib/mcp/hook-adapter-audit.cjs').lineCountBudget()"`.
  found: PROVEN. At f63d1ddce the output was `{"pass":true,... "scripts/on-stop","lines":553,"budget":570,"pass":true}`. At 8462f41ad the output was `{"pass":false,... "scripts/on-stop","lines":580,"budget":570,"pass":false}`. `migratedSurfaces()` returned all three surfaces at both commits, so the check was not vacuous at the time.
  implication: The leg flipped from green to red at 8462f41ad and was never green after it. The budget number is unchanged since it was introduced (`git log -S"'scripts/on-stop': 570"` lists only 7226232a7). Nobody re-based it.

- timestamp: 2026-10-12T16:36Z
  checked: `git log -1 --format=%b 8462f41ad`
  found: PROVEN. The commit body ends: "Verified: bash -n clean, node lib/memory/on-stop-snapshot.test.cjs 8/8 green (Phase 88-06 snapshot behavior unchanged)." It does not name the adapter-budget test. A grep of `.planning/phases/241-*` and `.planning/phases/240.1-*` for "adapter-budget", "line-budget" and "570" found nothing.
  implication: The phase 241 and 240.1 plans never ran or never recorded the SPEC-5 leg. The breach was introduced without a signal at commit time.

- timestamp: 2026-10-12T16:37Z
  checked: grep for existing tracking: `grep -ril "adapter-budget|adapter budget|SPEC-5" .planning/debug/ .planning/phases/ .planning/quick/*/ docs/`, then targeted `grep -n` on the hits, plus `ls .planning/debug | grep -i "adapter|budget|on-stop"` and the same on `.planning/quick`
  found: PROVEN. The failure is written down in these places, always as "pre-existing, out of scope":
  - `.planning/quick/260911-juq-silence-the-claude-code-hooks-json-unkno/deferred-items.md` (2026-09-11). It names the cause: "`scripts/on-stop` grew past its Phase 198-09 measured budget through later, unrelated commits ... `01c3ca19` fix(240.1-03), `c7fb00db` feat(241-05), `0d02e112` fix(241-02)" (618 lines then). It gives a recommendation: "Open a follow-up quick task or `/gsd:debug` slug to re-measure `scripts/on-stop`'s current legitimate line count and set a new budget with margin". It states "Commit: none (deferred, not fixed)".
  - `.planning/phases/248-mcp-first-room-resolution/deferred-items.md` and `248-01-SUMMARY.md` line 155: "618 lines against a budget of 570 ... pre-existing, out of scope".
  - `.planning/phases/298-seed-032-.../298-03-SUMMARY.md` line 148: `exit=1  (PRE-EXISTING, see below)`.
  - `.planning/phases/369-ui-shell-.../369-CLOSE-GATE.md` lines 58 and 209: owner column reads "Pre-existing, unowned"; also 369-VERIFICATION.md line 98 and 369-47-SUMMARY.md line 76.
  - `.planning/phases/366-.../366-07-SUMMARY.md` and `366-27-SUMMARY.md`, `363-16-SUMMARY.md`: listed among the 6 known reds of run-all-3551.
  - `tests/run-all-3551.sh` lines 38 and 321: a "no-regression" leg with owner "Phase 198". The table cause reads "an unrelated budget-tracked file set fails against the real committed tree".
  - `.planning/debug/resolved/stop-hook-invalid-hookspecificoutput-schema.md` line 534 reports `test-198-adapter-budget.test.cjs` 15/15 green. ASSUMED to predate 8462f41ad (the fix commit f63d1ddce is dated 2026-07-23 and had 553 lines). It is consistent with the replay above.
  No file in `.planning/debug/` and no directory in `.planning/quick/` has a name about the adapter budget or on-stop.
  implication: The cause was named once, on 2026-09-11, with a clear recommended follow-up that was never opened. Every later session copied "pre-existing" and the stale number 618. There is no debug slug, no quick task and no named owner.

- timestamp: 2026-10-12T16:37Z
  checked: the 369 documents against git. 369-CLOSE-GATE.md (run date 2026-10-04) says "the last change to `scripts/on-stop` is 2026-07-30 (`01c3ca19d`), nothing in 369 touches it" and quotes 618. `git show --stat 26629ecff` shows `scripts/on-stop | 40 +++++++++++++++++++++` on 2026-10-06.
  found: PROVEN. Commit 26629ecff (feat(369.25-19), 2026-10-06) came two days after the close gate and added 40 lines inside the legacy `node -e` close-out block (starts at on-stop line 408, below the END sentinel at line 136). The overage grew from 48 (618) to 88 (658) after the owners-list was written.
  implication: The documents' number (618 against 570) is stale. A Phase 369.25 plan made the breach worse while the documents said nobody touches the file. The "pre-existing" label stays true for the breach itself. It is no longer true that the file is untouched since July. Any re-base figure must be re-measured, not copied from the documents.

- timestamp: 2026-10-12T16:38Z
  checked: release gate and doctor visibility. `grep -n "198\|adapter-budget\|run-all" scripts/doctor.cjs`; `grep -rn "run-all-198\|adapter-budget\|hook-adapter-audit" scripts/ bin/ package.json .github/`; `grep -n RELEASE_GATE_SUITES scripts/release-lib/suite-gate.sh`; `grep -n "run-all-[0-9.]*\.sh" tests/run-all-366.sh`; `node -e` print of package.json scripts
  found: PROVEN. (a) scripts/doctor.cjs has no line containing "198" or "adapter-budget"; the only "run-all" hits are the 146 aggregator note and the claim-harness runner (lines 219, 553, 556, 2519-2559). The acceptance points listed by `grep "id: '"` do not include a hooks budget or run-all-198. (b) The grep over scripts/, bin/, package.json and .github/ for the three names found no consumer outside doctor. (c) `RELEASE_GATE_SUITES=(tests/run-all-366.sh)` (suite-gate.sh line 35); run-all-366.sh has no call to run-all-198.sh, run-all-3551.sh or the test file (its only "run-all" lines are comments). (d) package.json scripts are `mcp`, `parity`, `migrate-minto-v88`; no `test`. The harness policy directory data/harness-policies has no policy that names on-stop or the line budget. The only aggregators that run the test are run-all-198.sh (hard `run_if` leg) and run-all-3551.sh (a "no-regression" leg whose header lists it as a documented red). I did not run `node scripts/doctor.cjs --acceptance`; grep was enough.
  implication: The release gate does not see this failure. `doctor --acceptance` does not see it. Nothing automatic stops a release on it. Only a human who runs run-all-198.sh sees the red, and that is why it persisted for 76 days (2026-07-28 to 2026-10-12) behind the label "pre-existing". UNVERIFIED: a path through a glob I did not read (for example a different CI outside .github/workflows) could run the test.

- timestamp: 2026-10-12T16:38Z
  checked: re-run of the whole aggregator, `bash tests/run-all-198.sh` (exit and `>>>` lines), then `git status --short -- lib tests scripts hooks data`
  found: PROVEN. Exit 1. `>>> SPEC-5 hooks/ adapter-only budget (import audit + line-count): FAILED`; final summary `Passed: 16   Failed: 1   Skipped: 0`. All other legs PASSED, including `SPEC-5 hooks.json top level is hooks-only` and `SPEC-5 Stop-gate bounded escape reaches BOTH ceilings`. `git status` on lib, tests, scripts, hooks and data printed nothing (no tracked change from the run).
  implication: One failing leg, deterministic, reproduces the symptom. The run did not alter tracked files.

## Technical Root Cause

Site: `lib/mcp/hook-adapter-audit.cjs` line 62, `LINE_BUDGETS['scripts/on-stop'] = 570`, checked against `scripts/on-stop` (658 lines by `split('\n').length`) by `lineCountBudget()` (audit file lines 157-177) and asserted by subtest 2 of `tests/test-198-adapter-budget.test.cjs` (lines 98-107).

Cause: PROVEN. The 570 ceiling was set on 2026-07-10 (phase 198-09) as 547 measured lines plus 23 margin. The ceiling counts the whole file, including the flag-OFF legacy close-out body, which the same module comment says stays inline "BY DESIGN". The legacy body kept growing under ordinary feature and fix work: +27 (241-01), +25 (241-02), +7 (241-05), +6 (240.1-03) and +40 (369.25-19). The budget constant was never re-based and the owner of D-06 never reviewed the growth. The 241-01 commit used up the 23-line margin on its own and is the first breach (580, 2026-07-28). No import violation exists: the flag-ON thin-adapter span (on-stop lines 47-136, 90 lines) passes its bespoke audit.

Why it surfaces now: PROVEN that it has been red on main since 2026-07-28 and was not new on 2026-10-12. It appears in this sweep because the sweep re-ran the Phase 198 aggregator (the room_search legs of 2026-10-12 live in the same file, run-all-198.sh). It stayed hidden for 76 days because (1) no release gate, no doctor acceptance point and no CI job runs run-all-198.sh or this test, (2) the only other aggregator that runs it (run-all-3551.sh) lists it as a documented red, and (3) the test prints `PASS:` as its first line even when it exits 1. ASSUMED: nobody owns D-06 after phase 198 closed, so no one re-based the number when the first deferred-items file asked for it on 2026-09-11.

Mismatch between rule and intent (PROVEN from source, judgment ASSUMED): the module comment calls the whole-file count for on-stop "a secondary signal" and names the flag-ON branch audit as "the REAL D-06 protection". The secondary signal is the only part that fails. It measures growth of the legacy body, which D-06 does not forbid.

## Required Code Changes (options, no choice made, none implemented)

- (a) Bring on-stop back under budget. Move the inline `node -e` close-out blocks (the block starting at on-stop line 408 holds the STATE.md write, the stale-marker write and the 40-line BRIEF render) into one or more `scripts/*.cjs` files and call them from the bash. Needs a cut of at least 88 lines (658 to 570) and more for margin. Trade-off: it honors the 198-09 number and shrinks the hook, but it edits a bash Stop hook with byte-identical flag-OFF duty (SPEC-7) and a 369.25 render that has its own tests, so the regression risk is real and the work is a phase-sized refactor, not a one-line fix.
- (b) Raise or re-base the budget with a reason. Two forms. (b1) Change `'scripts/on-stop': 570` to a re-measured figure plus margin (658 plus margin, measured fresh, not 618). Trade-off: a one-line change that turns the leg green, but it blesses 88 lines of growth and the next feature will breach again. (b2) Replace the whole-file count for on-stop with a count of the flag-ON span (sentinel lines 47-136, 90 lines) and keep the whole-file number as a report only. Trade-off: it makes the gate measure what D-06 is about (thin adapter) and stops legacy growth from tripping it, but it changes the gate's meaning and needs the D-06 owner to agree, and it loosens a guard against re-fattening the hook as a whole.
- (c) Mark the leg a known failure with an owner. Use the `run_known_if` pattern already used in tests/run-all-366.sh (for example "pin 355 direction agreement") so run-all-198.sh prints the known cause and the leg stops being a silent red. Trade-off: it is honest and cheap, and it stops the "who owns this" question, but the breach stays and a named owner plus a due phase must exist or it repeats the 76-day drift.

Whichever option is chosen, run it as a `/gsd-quick`, not inside the sweep.

## Tests to Add or Update

- If (a) or (b): rerun `node tests/test-198-adapter-budget.test.cjs` (expect exit 0) and `bash tests/run-all-198.sh` (expect `Passed: 17   Failed: 0`).
- Make the closing `console.log('PASS: ...')` line of the test conditional on `process.exitCode` being unset, or remove the literal "PASS:" word, so a failing run never prints PASS (test file line 360). UNVERIFIED whether another tool parses that line; grep shows only run-all-198.sh and run-all-3551.sh call the file, and both use the exit code.
- Add a guard so the next growth of a budgeted file is visible at commit time: either add the test to a pre-commit hook scoped to the three surface files, or add an acceptance point to `scripts/doctor.cjs`. Trade-off: new gates add run time. This is a separate decision.

## Non-Code Follow-ups

- Correct the stale figure in 369-CLOSE-GATE.md and the other 369 notes when the next phase closes: they say 618 against 570 and "nothing touches it". Current value is 658 against 570 and 369.25-19 touched it.
- If a budget or hook change ships in a release, the release lockstep applies (docs/RELEASE-CEREMONY-RULING-SYSTEM.md RULE 5). CHANGELOG Fixed entry only for (a) or (b); (c) is dev-only.
- Canon gates: Part 8 not touched (no Brain wire in any option); Tri-Polar: on-stop is a CLI hook, Desktop and Cowork have no hooks, so the change is CLI-only by construction; cross-platform: on-stop is bash run through the polyglot wrapper, so option (a) must be checked on Windows Git Bash (UNVERIFIED, not run). No em-dashes in any file written by this investigation.
- knowledge-base.md: add one block when the item resolves.

## Classification

ITEM 6: NEW FAILURE (by the template: a real, deterministic code-versus-budget breach with no debug slug) - `scripts/on-stop` is 658 lines (test measure) against `LINE_BUDGETS['scripts/on-stop'] = 570` in `lib/mcp/hook-adapter-audit.cjs` line 62; first breach commit 8462f41ad (phase 241-01, 2026-07-28), cause already named in quick 260911-juq deferred-items.md (2026-09-11) but never given an owner or a slug.

Not WORKING: the test is correct to its recorded rule and the replay shows it flipped red at 8462f41ad. Not ENV GAP: no missing dependency or key; it reproduces on a clean tree. Not a tracked bug: three deferred-items files and two close gates mention it, but none is a debug session.

## Resolution

root_cause: see Technical Root Cause (stale 570-line ceiling on scripts/on-stop, exhausted by 241-01 and widened by later commits; flag-ON adapter span is clean).
fix: none (diagnose only).
verification: none (no fix applied).
files_changed: none outside .planning/debug/search-surface-qa-sweep-20261012/cluster-b/.
