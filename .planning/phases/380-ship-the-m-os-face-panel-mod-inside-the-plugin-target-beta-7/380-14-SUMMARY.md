---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 14
subsystem: ui-mod-job-line
tags: [mos-face, jtbd, job-line, local-only, guess, D-09, MOD380-08]
requires: [380-13]
provides:
  - ui/mos-face/hooks/jobs.ts (generated: 13 jobs from lib/hmi/jtbd-taxonomy.json plus 13 outcome clauses)
  - ui/mos-face/hooks/job.ts (readJob, compactJob, guessJob, jobShown, jobStatement, jobRows, jobLine: pure functions)
  - ui/mos-face/scripts/face-jobs.cjs (--write, --check with drift gate)
  - the Job block in the side panel between NEXT and ASK, buttons Not this and Fix, command /mos-job (the 14th)
  - ui/mos-face/tests/job.test.ts (J1 to J10, 23 tests), tests/test-380-jobs.cjs (T1 to T3, N1 to N3, 32 checks)
affects: [380-10, 380-11, 380-15]
requirements-completed: [MOD380-08]
completed: 2026-10-23
---

# Phase 380 Plan 14: Job line - Summary

The panel now shows one Job line: a jobs-to-be-done sentence ("When I am in the Design stage, I want to ..., so that ...") built from the room's recorded job or, when there is none, from a cue match over the person's last prompts, always labelled a guess (or "set by you" for a job the person set). It reads one small local file for each refresh tick, makes no call of any kind, never shows a word of the prompts and never reads the goal field. Not this hides it, Fix puts /mos:jtbd set in the prompt box, and /mos-job toggles it.

Code tree: `/home/jsagi/dev/MindrianOS-Plugin-release`, branch `main`. Nothing pushed. No branch created or switched. `git rev-list --count origin/main..main` is 35 (30 before, plus the 5 below). The 30 earlier commits are untouched. `/home/jsagi/mos-brand` unchanged (status 2 lines before and after; HEAD 9f4ee34; canon cited as e947a5d).

## Commits (release tree)

| Step | Commit | Subject |
|------|--------|---------|
| ruling (a) | c36b6a278 | fix(380-14): the contradiction face suggests a public command, and a test bars internal commands from every state |
| Task 1 | 2bb547898 | test(380-14): RED tests for the Job line, local only, one action, generator parity (D-09) |
| Task 2 | 9b91e8e27 | feat(380-14): the Job line, a local guess in jobs-to-be-done form with one-action dismiss and fix, and /mos-job (D-09) |
| fix | 8a162e10c | fix(380-14): a want ends with no question mark, so the Job sentence never reads "field?." |
| Task 3 | ba78adfa4 | docs(380-14): README Job line section and the 13 outcome clauses (D-09); copy scan C8 draws every shown job |

## Ruling (a) from the main session: the contradiction face (first commit)

- Root cause (PROVEN): plan 380-13 chose /mos:memory-cortex-reach for the Contradiction face because its teaching line names a contradiction. It did not read the registry field `surface`, which is `internal` for that command (data/command-registry.json). A person cannot use an internal command.
- Fix: STATE_COMMANDS contradiction is now /mos:challenge-assumptions (registry surface navigator). Test S8 in tests/test-380-copy.cjs: STATE_COMMANDS holds 11 states, every state has at least one command, every command is in the registry, none has surface internal; two self-tests prove the rule has teeth. `scripts/face-commands.cjs --check` now fails on an internal command in TERM_COMMANDS, STATE_COMMANDS or DOCTOR. RED seen first: S8 failed with "contradiction /mos:memory-cortex-reach" before the fix.
- Rulings (b) and (c) were respected: the face size is unchanged (12 cells, 6 text rows); FaceState and FaceId stay split; hooks/glossary.ts is untouched.

## RED and GREEN runs (PROVEN)

- Baseline before any edit: 129 pass, 0 fail.
- RED (Task 1): 129 pass, 1 fail. The one fail: `tests/job.test.ts` "the file did not load: cannot import ../hooks/job". The plan's verify (awk over panel.test.tsx) exited 0 with 34 passes. `node tests/test-380-jobs.cjs` RED: 1 passed, 3 failed (jobs.ts, face-jobs.cjs and job.ts missing). The generator script was held out of the tree during the RED run.
- GREEN: `claude plugin test .` 153 pass, 0 fail (34 originals, 129 before the plan, +23 in job.test.ts, +1 copy test C8). `node tests/test-380-jobs.cjs`: 32 passed, 0 failed. `node tests/test-380-budget.cjs`: 11 passed (G2: 24 of 24 hooks, the 14th is command.run mos-job). `node tests/test-380-copy.cjs`: 37 passed (S5 now 14, S8 added). `node ui/mos-face/scripts/face-jobs.cjs --check`: 13 jobs, 0 problems. `face-commands.cjs --check`: 0 problems. `typecheck.cjs`: exit 0. `panel.test.tsx` still declares 34 tests. `bash tests/run-all-380.sh`: PASSED=14 FAILED=0 SKIPPED=3 KNOWN=0 (the same 3 skips as plan 13: build, installed layout, gate wiring legs, which land in plans 08 and 09). Dash scan over the plan files: no hit.
- Mutations in a scratch copy (`.../scratchpad/mutcopy`), each caught by the named test: Not this does nothing (J6 x2); the guess word dropped from the heading (J4, J7, J10); a file read at prompt time (J9); the compact text keeps the goal (J2 compact); one cue is enough (J3); dismiss makes a tool call (J5); a stale auto job accepted (J2 x2); the narrow row carries the outcome (J4 size); a set job shown as a guess (J2, J4); a second file read for each refresh (J9); explore shown (J2, J3); Fix submits (J5, J6); prompt text printed in the line (J5); hidden stays after the job changes (J6 x2); the guess runs ahead of the record (J2, J5). The generator and its gate: 8 mutations in N1 (new taxonomy job with no outcome, changed one-line, changed cue, blank outcome, banned word, em-dash, missing job, stale header), each exits 1 and names the job.
- Flakiness (PROVEN, not caused by this plan): on this shared machine, other sessions run browsers and test runs, and the 11 test files of `claude plugin test` run in parallel children. In about half of the full runs (about 9 of 16) between 20:47 and 21:30, 1 to 34 tests failed with "timed out after 5000 ms" (a different set each time; the same tests pass alone in 0.2 to 0.6 seconds). Each of the 11 files passed alone (152 of 152 before C8), and full runs passed 152, 153 and 153 of 153, including the final `run-all-380.sh`. The same cause was seen in plan 13.

## What the line is built from (the sources in a real run)

Printed from the panel (a scratch test mounting the real pane; tests/zz-demo was deleted afterward). Room demo-room, stage Design.

Recorded auto job find-bottleneck, panel 48 columns:
```
| JOB  a guess, is this it?
When I am in the Design stage, I want to find the lagging component (Hughes 1983 reverse salient) blocking progress, so that I know which part to fix first.
[Not this] [Fix: /mos:jtbd set]
```
The same job at 35 columns:
```
JOB, a guess: I want to find the lagging component (Hughes 1983 reverse salient) blocking progress.
[Not this] [Fix: /mos:jtbd set]
```
A job set with /mos:jtbd set (prepare-pitch, not expired):
```
| JOB  set by you
When I am in the Design stage, I want to prepare for an investor / partner / customer meeting, so that I walk in with the story ready and the hard questions covered.
[Fix: /mos:jtbd set]
```
No record and the talk "Should we pursue this?" then "Maybe we pivot." (2 distinct cues of decide-pursue):
```
| JOB  a guess, is this it?
When I am in the Design stage, I want to decide if a venture / opportunity / approach is worth pursuing, so that I can say go or no-go and write down my reason.
[Not this] [Fix: /mos:jtbd set]
```
No record and no talk: `Job: no guess yet. Say a little more about what you are doing and one may come.` Hidden: `Job: hidden. /mos-job shows it again.`

Sources in order: (1) the room's job file `<room>/.mindrian/jtbd-state.json`, read once for each refresh tick with a 4 second cut-off, reduced to the current job by `compactJob`; (2) the cue match of `guessJob` over `recentUser` (6 prompts in memory), computed when the pane draws (0.34 ms for 6 prompts of 2000 characters, measured with node on a type-stripped copy); (3) the stage and the open section. Visual verification in a real terminal is pending (plan 380-10); this is a text print of the engine's elements, not a screenshot.

## Budget numbers

- File reads of the Job line: exactly 1 for each refresh tick (J9: 1 after start, 2 after one tick, 3 after two), none in prompt.submit, turn.start or /mos-job.
- Tool reads on a tick (B3): unchanged, at most 4. Subprocesses 0 (B1, G1). Fetches: unchanged. Timers: none added (B8 passes). New hooks: one, command.run mos-job.
- Budget tests B1 to B8: all pass with the 14th command in the pinned lists.

## The 13 outcome clauses (for the navigator, plan 11 section B)

The want text is the plugin taxonomy's one-line (first letter lowered, final stop mark removed), copied by the generator. The outcome clause finishes "so that ..." and is reviewed here. Taken from each job's completion shape and next-move verbs.

| Job id | Want (from the taxonomy) | Outcome (written in this plan) |
|--------|------|---------|
| decide-pursue | decide if a venture / opportunity / approach is worth pursuing | I can say go or no-go and write down my reason |
| find-problem | find the problem worth solving (not the symptom, the root) | I know the real problem in a sentence I can test |
| understand-market | understand the market for this idea - size, structure, dynamics | I can say how big the market is and who else is in it |
| find-bottleneck | find the lagging component (Hughes 1983 reverse salient) blocking progress | I know which part to fix first |
| prepare-pitch | prepare for an investor / partner / customer meeting | I walk in with the story ready and the hard questions covered |
| validate-idea | test if an idea / hypothesis / claim holds up under scrutiny | I know what holds up, what does not and what I still need to find out |
| compare-options | compare alternatives across criteria - choose between A/B/C | I can choose between the options and say why |
| connect-domains | find cross-domain analogues - what does this look like in another field | I see what this looks like in another field and what that could teach me |
| surface-contradiction | notice and resolve internal contradictions in the room | I know which claims pull apart and which one I keep |
| plan-execution | plan the next 90 days - milestones, owners, dates | I know the next 90 days, with owners and dates |
| file-meeting | capture and route meeting intelligence into the room | I can see what the meeting changes in my data room |
| audit-room | audit Data Room health - gaps, drift, evidence tier, decision quality | I know where my data room is thin or out of step |
| explore | no specific job - general thinking, talking, ranging | I notice what is worth following |

Explore is flagged never shown: it is the plugin's steady state, not a job.

## Pinned lists changed (the 14th command)

- `tests/test-380-budget.cjs` G2: PINNED_HOOKS gets `command.run{command=mos-job}` (24 entries); header comment 13 to 14.
- `ui/mos-face/tests/copy.test.tsx` C2: title "14 commands" and the name list gets `mos-job`.
- `tests/test-380-copy.cjs` S5: the count 13 becomes 14; S8 added (new leg).
- `ui/mos-face/tests/budget.test.ts`: NO edit (it holds no count of 13). `panel.test.tsx`: NO edit (34 declarations).
- README: hook list (14 commands) and the copy-scan line (14 descriptions).

## Edits to existing tests and gates (all listed)

- `ui/mos-face/tests/face-events.test.ts` (plan 13): two expectations, the command of the Contradiction face (`/mos:memory-cortex-reach` to `/mos:challenge-assumptions`), in the W3 suggestion table and in W10.
- `ui/mos-face/tests/copy.test.tsx` (plan 06): C2 as above; import of JOBS; one test added, C8 (the sentence of each shown job at 2 widths, color and plain, scanned and kept for the book review dump). No scan rule changed.
- `tests/test-380-copy.cjs` (plan 06): S5 count; S8 added.
- `tests/test-380-budget.cjs` (plan 05): G2 list and comment.
- `tests/run-all-380.sh`: two run_if legs appended before the dash fence (the plan's controlled exception).
- `ui/mos-face/scripts/face-commands.cjs` (plan 06): one check added (internal command is a hard problem).
- `ui/mos-face/hooks/lines.ts`: `TextInput` gets an optional `job` string, and `stateText` prints it after NEXT. Behavior without `job` is unchanged.

## Book review (D-04, plan 07 script)

`node ui/mos-face/scripts/book-review.cjs` could not finish on this machine in the shared full-suite form (the whole suite timed out under load, 17 to 34 fails, twice). It ran to the end from a scratch folder that held only tests/copy.test.tsx (script unchanged; `.../scratchpad/bk`), with `--out` in the scratch folder, not in the phase folder: the book HEAD 9f4ee34 -> 9f4ee34, book status unchanged (2 lines before and after), `review` exit 2 (REVIEW-REQUIRED, expected), `checklist` exit 0, `doctor` exit 0, 803 dump lines. The review printed `"findings": []`. The dump holds the 12 narrow rows, the 12 sentences, the no-guess and hidden rows. My own reading of the dump found one copy defect (below), fixed, and a second run still printed `findings: []` and no "?." in the copy. The book scan is a heuristic and does not judge these sentences; the items under RISKS are for human review.

## Deviations from Plan

**1. [Rule 1 - bug] The want of connect-domains ended in a question mark**
- Found during: Task 3 (reading the book review dump).
- Root cause (PROVEN): the generator removed only a final full stop. The taxonomy one-line "Find cross-domain analogues - what does this look like in another field?" gave "another field?, so that" in the sentence and "another field?." in the narrow row. My test J1 checked only that the sentence holds one full stop at the end, so it did not see it.
- Fix: the generator removes a final full stop, question mark or exclamation mark; T1, T3 and J1 check that the want has no final stop mark and the sentence has no question or exclamation mark. RED was shown first (T1, T3, N1 failed against the old table). Commit 8a162e10c.

**2. [Plan wording, impossible as written] "two rows at most at 46 columns"**
- The form sentence is 178 to 226 characters (with stage and section). Two terminal rows at 46 columns hold about 90 characters. I read "rows" as the rows `jobRows` returns (a heading row and one sentence row), and tests J4 pin that count, plus one short row at 35 columns. The terminal then wraps the sentence to 5 or 6 rows at 44 text columns (computed, not seen on a screen). See RISKS.

**3. [Rule 2 - correctness] The panel keeps the compact job text, not the file text**
- The plan says to keep the text of the state file in the atom jobRecord. That text includes the ratified goal prose. `compactJob` keeps only jtbd, confidence, entered_at, expires_at and manual_set, so the goal never sits in panel state. The whole file is parsed once and only `current` is read (the parser must read the whole text; no field named goal is accessed). N2 fails if job.ts names that field outside a comment.

**4. [Method] A cue is found as a whole phrase**
- The plugin classifier uses substring matching. With it "plan" matches inside "explanation", and two such accidents give a false guess. `guessJob` finds a cue only when it is not inside a longer word (test J3). Same method otherwise (distinct cue matches).

**5. [Design] Details the plan left open**
- A job the person set has the button Fix only (Not this makes no sense for it); a guess has both. The dim rows (no guess yet, hidden) carry the prefix "Job:" so they are not unlabelled lines. /mos-job hides until run again; Not this hides until the job changes. An automatic job with no time stamp is ignored (freshness cannot be shown). A recorded job of explore or an unknown id is ignored.
- J5 "a canary phrase in the prompts never appears in any outbound call across a full session with the auto ask running": with /mos-words on, the existing owner-approved excerpt (D-03) legitimately carries the person's cleaned words to the shim brain_ask, so a prompt-word canary can only be checked with /mos-words off. The test does that, and a second pair of tests proves the whole session sends byte-for-byte the same calls with the line shown and hidden (the line adds nothing).

## Known Stubs

None.

## Threat Flags

None new. T-380-55: tests J5 (three canary tests) and N2. T-380-56: J4, J2. T-380-57: J6. T-380-58: J9. The one new read is a fixed relative path under the room folder, through `$.fs.read`, with a 4 second cut-off.

## Self-Check

Commits c36b6a278, 2bb547898, 9b91e8e27, 8a162e10c and ba78adfa4 are on `main` of the release tree and are ancestors of HEAD (ba78adfa4). Files exist: hooks/job.ts, hooks/jobs.ts, scripts/face-jobs.cjs, tests/job.test.ts, tests/test-380-jobs.cjs. No file was deleted in the 5 commits. PASSED.
