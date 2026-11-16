# evals/selection: is the selector's answer right for the job

Phase 395-09. The unit tests of Phase 395 check that the selector follows its own rules. This folder measures a
different thing: for a user with one job, in one section, in one state, is the command that the selector puts first
a right first move by the PwS method as this repository documents it.

This folder measures. It repairs nothing, and it is not a release gate.

## Files

| File | What it is |
|---|---|
| `cases.json` | 38 labelled cases across the 20 job ids. Written by a model. Not reviewed by the owner. Synthetic states only. |
| `score.cjs` | The deterministic scorer. No model, no network. Runs the real selector on a fixture room for each case. |
| `judge.cjs` | The optional judge leg. Off by default. Sends synthetic cases and catalog text to the owner's decision model only with explicit flags. |
| `../../tests/test-395-measure.cjs` | A fast test: the case file is well formed, the scorer runs and is stable, the judge refuses to send. |

## What a case is

```
id, job_id, surface (mcp or cli), label_confidence (high, medium, low)
state:    section, section_kind (core or custom), section_job, goal_job (or null),
          definition (undefined, ill-defined, well-defined), complexity (simple, complicated, complex, wicked),
          holds: { summary, open_counterevidence, open_assumptions }
expected: none_of_these (true or false)
          right              commands that are a right first move, each with a reason
          acceptable         commands that are defensible, not the best first move, each with a reason
          wrong              plausible mistakes, each with a reason
          not_runnable_right commands that serve the job but do not run on the surface
          absent             methods that the job needs and that no shipped command gives
```

`job_id` is the job of the person: the goal job when the case has one, else the job of the section.
The two problem-type fields are the two axes of `references/methodology/problem-types.md`.

The scorer writes into the fixture only what the selector can read: the section, the job of the section, the goal
job, and the counts of open counterevidence and open assumptions (a synthetic `MINTO.md`). The `summary` line and the
two problem-type fields are for the label and for the judge. The local selector does not read the problem type; it
reaches the selector only through Theo, and Theo is not asked in a fixture room.

## The label rule

A label rests on three repository sources and on nothing else:

1. the `serves_jtbd` tag of the command in `data/command-registry.json`;
2. the header of the command (`description` and `teaching` in `commands/*.md`), which says when the command is the
   right one ("best after a customer segment is defined", "when the symptom keeps coming back");
3. the routing table by problem type in `references/methodology/problem-types.md`.

* **right**: the command runs on the surface of the case, it serves the job (or, where no command lists the job, the
  section contract names it), and its header fits what the section holds.
* **acceptable**: a defensible move that is not the best first move.
* **wrong**: a plausible mistake, named with its reason. Mostly: a command that serves the section and not the goal
  job, a command whose header asks for material that the section does not hold, or a command whose tag does not match
  its header (`models`, `update`, `doctor`).
* A command in none of the three lists is **not right**. The scorer counts it as `other`.
* **none_of_these**: no shipped command that runs on the surface is a right first move. 5 cases.

Honest limits of the labels:

* A model wrote every case and every label. The owner did not review them. A label is an opinion with a stated reason.
* The label author saw the selector output for the 11 core sections with no goal before the labels were written.
* One label was changed after the first scorer run, in favour of the selector (case `sel-35`).
* 38 cases are few. One case moves the main share by 3 points. Most jobs have 1 to 3 cases.
* 3 cases have low label confidence: the vocabulary holds the jobs `build` and `navigate` with no description, and
  a goal job `explore` is a job that names no intent.

## Options are built outside the selector

The selector returns 1 primary and at most 2 alternatives. A measure that only looks at those 3 cannot say that the
selector is wrong: the right command may never have been a candidate. So:

* The **option list** of a case is every command of the registry that `lib/core/feyminto/capability.cjs` marks
  runnable on the surface (59 on mcp and 102 on cli at the first run), plus the option **none of these**. The judge
  sees this list. The labels are chosen from this list.
* The **pool** of a case is the set of commands that the selector can order: section contract names, navigator table
  names, ledger candidates for the job, and Theo face commands when Theo was asked. The selector does not return its
  pool, so the scorer builds it from the same public functions. It checks that the primary and the alternatives are
  in the pool it built; if they are not, the case is marked and the test fails. A change of the selector that adds a
  pool source must add the same source to `rebuildPool` in `score.cjs`.

## What the scorer reports

For a case with a right command, the primary is one of: `right`, `acceptable`, `wrong`, `other`, `no_primary`.
When it is not `right`, the limit is `pool` (no right command is in the pool: the order cannot repair it) or `order`
(a right command is in the pool and is not first).

For a "none of these" case: `none_correct` (the selector names no primary), `none_named_acceptable`,
`none_named_wrong`, `none_named_other`.

```
node evals/selection/score.cjs                               # the table on stdout
node evals/selection/score.cjs --json                        # the JSON on stdout
node evals/selection/score.cjs --head "$(git rev-parse HEAD)" --out-dir <dir>
                                                             # also writes <dir>/selection-score.json and .md
```

The numbers depend on the commits in the tree. Always pass `--head` and keep the two output files with the run.
The output holds no time and no temporary path: two runs on one tree give the same bytes.
The exit code is 0 when the run finished, also when the pass bar is not reached.

## Pass bar

The bar was written before the first run of the scorer.

| Bar | Limit | Reason |
|---|---|---|
| B1 | The primary is in the right set in at least 70 percent of the cases that have a right command | A selector that picks any runnable command that carries the job tag is right in about 1 case of 3 (a job has 3 to 9 tagged runnable commands and 1 to 3 right ones). 70 percent is more than twice that. With labels by a model and 33 such cases, a higher bar would measure label noise |
| B2 | The primary is in the wrong set in 0 cases | A wrong first move sends the person into a method that does not serve the job. Each one is read, not averaged |
| B3 | The primary is in the right or the acceptable set in at least 85 percent of the cases that have a right command | The person should almost never get a move that has no defence |
| B4 | In the "none of these" cases the selector names a primary outside the acceptable set in 0 cases | Where no command fits, a confident command is a false answer. Today the selector has no way to say "none"; a fail here measures that missing answer |

The measure passes when all four hold. The bar is a statement of what "works" means for this measure. It is not
wired to a gate.

## First run (2026-11-16)

| Measure | Base `8c493ee13` (before Phase 395) | `81bd70572` (after plans 395-01 to 395-07) |
|---|---|---|
| B1 primary right | 7 of 33 (21.2 percent) | 13 of 33 (39.4 percent) |
| B2 primary wrong, all cases | 17 of 38 | 8 of 38 |
| B3 primary right or acceptable | 10 of 33 (30.3 percent) | 24 of 33 (72.7 percent) |
| B4 "none of these" with a named primary outside acceptable | 5 of 5 | 4 of 5 |
| Not right: pool limit | 12 | 12 |
| Not right: order limit | 14 | 8 |
| Bar | not reached | not reached |

How to read it:

* The code at `81bd70572` does not reach the bar. No part of the bar is reached.
* `d5e52033e` (after plan 395-06) gave the same result in every case. Plan 395-07 did not move this measure.
* The commits of plans 395-01 to 395-06 moved the measure. Almost all of the move is in the 17 cases with a goal job
  and a right command (right: 2 to 7; wrong: 8 to 2), because the base did not read the goal job. In the 16 cases
  with no goal the move is small (right: 5 to 6; wrong: 4 to 2).
* 2 cases are worse than at the base: `sel-19` and `sel-23` had a primary in no list and now have a wrong primary.
* One "none of these" case moved from wrong to acceptable only because its label was changed after the first run
  (`sel-35`). Without that change B4 is 5 of 5 on both trees.
* 12 of the 20 misses are pool misses: no right command is a candidate. The order of the candidates cannot repair
  them. That count did not move.
* The selector names a command in all 5 "none of these" cases. It has no "none" answer.

## The 12 turns in evals/icm/cases/turns.json are not reused

`evals/icm/cases/turns.json` labels a different thing. Each turn is one sentence of user text, a section, a problem
type and a stage, with a flat list of up to 3 commands. The note in the file says the commands were picked from the
`produces` glob and the `serves_jtbd` tag, to measure the top-3 hit rate of the ledger reach
(`tests/test-353-reach-hitrate.cjs`). The ledger builder also tunes the ledger confidence floor on the same 12 turns
(`scripts/build-section-command-ledger.cjs`), and the selector uses that floor. So the turns:

* label the routing of a sentence to commands, and the selector does not read the sentence;
* hold no job id, no goal job and no room state;
* hold no acceptable set, no wrong set and no "none of these";
* are not independent of the selector, because one of its inputs was tuned on them.

They are not labels of "the right methodology for the job" and this folder does not use them as such.
For the record only, the selector run on their sections with no goal: primary in the listed commands in 4 of 12 on
cli and 4 of 12 on mcp at `81bd70572` (the same at `d5e52033e`); 4 of 12 on cli and 6 of 12 on mcp at `8c493ee13`.
By that side number the commits of Phase 395 did not improve the no-goal answer, and on mcp it is lower.

## The judge leg (optional, off)

`judge.cjs` asks the owner's decision model (`gemini-decision-1`, Decisions API) to pick one option for each case,
among the option list above. Its pick is compared with the labels. Use it to find labels that a second reader does
not share, and cases where the judge and the selector agree against a label.

* With no flag it exits with code 2 and sends nothing.
* `node evals/selection/judge.cjs --dry-run` prints everything that would be sent. No key is read. No connection.
* A real send needs `--send --i-read-the-dry-run --out <file>` and the environment variable
  `MINDRIAN_DECISION_KEY_FILE` with the path of a key file. The key is never printed and never written.
* It sends: the synthetic state of each case, job ids with their descriptions, and command names with their
  `teaching` line. It does not send the labels. It reads no room and no user text.
* No test suite and no release step calls it with `--send`.
* Not verified: the shape of the answer of the Decisions API. The reader in `judge.cjs` tries several shapes and
  keeps the start of the raw answer when it finds no pick. The first real run must be read by a person or an agent.
* Not verified: that a `choice` question accepts 60 to 103 options. The one probe on record used 13.

## What this measure cannot show

* That a label is true. Only the owner, or people who know the PwS method, can say that.
* Anything about the per-turn hook, `suggest_next`, the act planner or a chain. It measures the one selector function.
* Anything about Theo. Theo is not asked in a fixture room, so the Theo face adds no candidate and the problem type
  has no effect.
* Whether the command, once run, does good work.
* Rare states: research runs in progress, verified attempts, sub-rooms.

## How to add a case

Add an object to `cases` in `cases.json`. Use a command only when it runs on the surface of the case. Give each
command a reason from the three sources of the label rule. Then run `node tests/test-395-measure.cjs`. Write the
labels before you look at the scorer output for the case.
