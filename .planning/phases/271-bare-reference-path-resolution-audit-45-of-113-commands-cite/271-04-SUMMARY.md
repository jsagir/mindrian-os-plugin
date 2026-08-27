---
phase: 271-bare-reference-path-resolution-audit
plan: 04
subsystem: plugin-portability
tags: [path-resolution, plugin-portability, sweep, agents, skills, pipelines, grounded-verification]
status: COMPLETE
requires:
  - "271-01 (the anchoring gate, its fixture test, the phase aggregator, the RED-baseline register)"
  - "271-02 (the /mos:radar option-d allowlist ruling)"
  - "271-03 (the command sweep, PARTIAL at 28/45)"
provides:
  - "40 anchored citations across 17 files: 14 skills + 17 agents + 9 pipelines"
  - "271-AUDIT.md section 6: the anchor form per surface, decided on cited vendor evidence"
  - "CONFIRMED expands: ${CLAUDE_PLUGIN_ROOT} works in agents/*.md, with the source named"
  - "A ruled anchor form for pipelines/, a surface no prior plan in this phase scoped"
  - "DEFERRED-271-D2: the pre-existing larry-extended hitl_shape / connector.excluded contradiction"
blocked_by: []
affects:
  - "plan 271-05 (the repo-wide gate still reads 1 in the working tree and 31 at HEAD; the residue is entirely 271-03's, not this plan's)"
  - "Phase 267.3 (a second declaration-contract gap logged against the same jurisdiction question)"
tech_stack_added: []
tech_stack_patterns:
  - "Gate-JSON-driven substitution: the applicator reads the gate's own --json violation list, so the edited sites are provably the reported sites, never a grep's guess"
  - "Byte-identity assertion at apply time: the long wrapper is extracted from skills/file-meeting/SKILL.md:49 at run time and the script throws if it drifts by one character"
  - "Pairwise diff purity proof: every added line must equal its removed line once the inserted prefix is stripped"
key_files_created:
  - .planning/phases/271-bare-reference-path-resolution-audit-45-of-113-commands-cite/271-04-SUMMARY.md
key_files_modified:
  - .planning/phases/271-bare-reference-path-resolution-audit-45-of-113-commands-cite/271-AUDIT.md
  - 5 hand-authored skills/*/SKILL.md
  - 7 agents/*.md
  - 5 pipelines/**/*.md
  - .planning/phases/271-bare-reference-path-resolution-audit-45-of-113-commands-cite/deferred-items.md
decisions:
  - "Agents get the short ${CLAUDE_PLUGIN_ROOT}/ form, on Anthropic's own plugin-structure doc naming agents explicitly plus two shipped Anthropic agents using it"
  - "Pipelines get the short form too, because pipelines/ is not a Claude Code component type and the long form's fail-closed shell clause buys nothing where no shell evaluates it"
  - "The plan's 26-citation target was superseded by the ROADMAP's own post-ruling correction of 40, re-measured live with the gate before trusting either number"
  - "The 17 command files 271-03 left uncommitted were not touched"
metrics:
  tasks_completed: 3
  duration_minutes: 21
  completed_date: 2026-08-27
  files_created: 1
  sites_anchored: 40
  files_anchored: 17
---

# Phase 271 Plan 04: Anchor the Generator-Unreachable Surfaces Summary

Anchored all 40 remaining in-scope citations across `skills/`, `agents/` and `pipelines/`,
after first proving with a named vendor source that the anchor form actually expands in
agent markdown rather than assuming it from the command surface.

**All three of this plan's surfaces now read `violations=0`.** The gate is not fully green,
and that is exactly as the ROADMAP predicted: the entire residue is plan 271-03's blocked
command work, untouched here.

## What Landed

| Commit | Contents |
|---|---|
| `cca1791b` | `271-AUDIT.md` section 6: the anchor form per surface, with sources and the residual blind spot |
| `5f4a6845` | 5 hand-authored skills, 11 lines, **14** citations, long fail-closed wrapper |
| `9d2b5e43` | 7 agents, 16 lines, **17** citations, short `${CLAUDE_PLUGIN_ROOT}/` form |
| `054cff88` | 5 pipeline stage files, 9 lines, **9** citations, short form |

40 citations, 17 files, 36 changed line-pairs.

## Task 1: Does `${CLAUDE_PLUGIN_ROOT}` Expand in Agent Markdown?

### Outcome: CONFIRMED expands

This was the plan's own named risk (T-271-10): `grep -rc 'CLAUDE_PLUGIN_ROOT' agents/*.md`
returned zero across all 14 agents, so this repo had no working precedent, and anchoring
with a variable that does not expand would ship a literal `${CLAUDE_PLUGIN_ROOT}` string
into every agent path, which is strictly worse than the bare path it replaces.

### The decisive source

Anthropic's own `plugin-dev` plugin, installed from the `claude-plugins-official`
marketplace, skill `plugin-structure`, `SKILL.md` lines 291-294, under the heading "Path
Resolution Rules":

> **In component files** (commands, agents, skills):
> ```markdown
> Reference scripts at: ${CLAUDE_PLUGIN_ROOT}/scripts/helper.py
> ```

Agents are named explicitly, in the same breath as commands, in a markdown-body example.
This is a primary vendor artifact on disk, not a training-data recollection.

### Corroboration, from shipped code rather than docs

| Artifact | Lines | What it does |
|---|---|---|
| `claude-security/agents/claude-security.md` | 13, 21 | Anthropic-shipped agent using `${CLAUDE_PLUGIN_ROOT}` twice in agent prose, under a heading titled "Environment and Paths (use verbatim)" |
| `plugin-dev/agents/plugin-validator.md` | 114, 122 | Anthropic-shipped agent, authored by the team that owns the variable, whose own job includes checking `${CLAUDE_PLUGIN_ROOT}` usage for portability |

### The counter-signal, recorded so the finding is not one-sided

`plugin-dev/skills/command-development/references/plugin-features-reference.md:79` says
`${CLAUDE_PLUGIN_ROOT}` is "available in plugin **commands**". Narrower than the
plugin-structure statement. It does not overturn it: that file lives inside the
`command-development` skill and its whole scope is commands, so the phrasing describes what
the document covers, not a boundary on where the variable works. Three positives against one
scoping artifact.

### NAMED BLIND SPOT: the plan's first-choice sources were not reachable

The plan named the `claude-code-guide` agent and the `claude-api` skill as first choice.
**Neither was consulted, and that is recorded rather than glossed.** This executor runs with
Read / Write / Edit / Bash only: no `Task` tool to dispatch a sub-agent, and no `claude-api`
skill installed under `~/.claude/skills/`. The consult went instead to the source those two
would themselves cite.

Second, and more substantive: **no source found states a negative.** None says the variable
fails in agents. The finding rests on one affirmative vendor doc plus two working vendor
examples. That is grounding, not proof by absence. A future session with `Task` access should
re-ask `claude-code-guide` and append the answer to `271-AUDIT.md` section 6.

## Task 2: The Five Generator-Unreachable Skills

Four of these five have no command source at all, so `build-skill-mirrors.cjs` never writes
them; the fifth sits on the generator's `SKIP_LIST` as divergent by design. Running the
generator a thousand times fixes none of them.

| File | Lines | Sites |
|---|---|---|
| `skills/larry-personality/SKILL.md` | 211, 418, 458, 459 | 4 |
| `skills/pws-methodology/SKILL.md` | 24, 62, 92 | 5 (line 62 carries three) |
| `skills/ui-system/SKILL.md` | 394, 401 | 3 (line 394 carries two) |
| `skills/room-passive/SKILL.md` | 83 | 1 |
| `skills/trending-to-absurd/SKILL.md` | 89 | 1 |
| **Total** | **11 lines** | **14 sites** |

The wrapper was extracted programmatically from `skills/file-meeting/SKILL.md:49` at apply
time, with a byte-identity assertion in the applicator that throws on any drift. It was never
retyped.

| Check | Result |
|---|---|
| `git diff --numstat` over the 5 files | 5 files, **11 added == 11 removed** |
| Added lines lacking `MINDRIAN_OS_ROOT` | **0** |
| Pairwise purity (added line == removed line once the wrapper is stripped) | 11 pairs, **0 impure** |
| `grep -oh 'MINDRIAN_OS_ROOT:-\${CLAUDE_PLUGIN_ROOT:?[^}]*}' skills/*/SKILL.md \| sort -u \| wc -l` | **1** (byte-identical across all 112+5 skills) |
| Unique cited targets resolving on disk | **11 of 11**, 0 missing |
| `build-skill-mirrors.cjs --check` | **OK, 112 mirrors match, skip-list verified: trending-to-absurd** |

`skills/trending-to-absurd/SKILL.md` remains divergent from its command, so
`checkSkipList()` still passes. That was the plan's named threat T-271-11.

## Task 3: The Seven Agents and the Five Pipeline Files

### Agents, 17 sites across 7 files

| File | Lines | Sites |
|---|---|---|
| `agents/meeting-perspective-extractor.md` | 31, 45, 46, 47, 54, 76 | 7 (line 46 carries two) |
| `agents/framework-runner.md` | 40, 65, 66, 69 | 4 |
| `agents/brain-query.md` | 43, 44 | 2 |
| `agents/larry-extended.md` | 121 | 1 |
| `agents/grading.md` | 97 | 1 |
| `agents/investor.md` | 59 | 1 |
| `agents/research.md` | 48 | 1 |
| **Total** | **16 lines** | **17 sites** |

Two sites the plan flagged for care, both handled:

- **`framework-runner.md:65`** uses a `{framework}` runtime placeholder. The prefix was
  anchored and the placeholder left intact. The gate tags it
  `[TEMPLATE-TARGET ANCHORED]`, which is correct and expected. It is **not** a dangling
  citation.
- **`framework-runner.md:69`** cites a bare DIRECTORY, `references/methodology/`, as a probe
  fallback. Anchored, because a directory probe from the wrong cwd fails identically to a
  file read.

| Check | Result |
|---|---|
| `git diff --numstat -- agents/` | 7 files, **16 added == 16 removed** |
| Added lines lacking `CLAUDE_PLUGIN_ROOT` | **0** |
| Pairwise purity | 16 pairs, **0 impure** |

### Pipelines, 9 sites across 5 files

| File | Lines | Sites |
|---|---|---|
| `pipelines/analogy/02-abstract.md` | 28, 42, 49 | 3 |
| `pipelines/PWS_grading/03-build-thesis.md` | 34, 35 | 2 |
| `pipelines/PWS_grading/CHAIN.md` | 61, 64 | 2 |
| `pipelines/analogy/01-decompose.md` | 24 | 1 |
| `pipelines/analogy/03-search.md` | 55 | 1 |
| **Total** | **9 lines** | **9 sites** |

9 added == 9 removed, 0 impure pairs, 0 added lines lacking the anchor.

## Gate and Test Status

| Check | Before 271-04 (working tree) | After 271-04 (working tree) |
|---|---|---|
| anchoring gate, `skills` group | 14 violations | **0** |
| anchoring gate, `agents` group | 17 violations | **0** |
| anchoring gate, `pipelines` group | 9 violations | **0** |
| anchoring gate, `commands` group | 1 violation (`doctor.md:262`) | **1** (unchanged, 271-03's) |
| anchoring gate, TOTAL | 41 | **1** |
| anchoring gate, MISSING-TARGET | 0 | **0** |
| `check-plugin-path-anchoring.cjs --check` | rc=1 | rc=1 (see below) |
| `tests/test-271-plugin-path-anchoring.cjs` | 19/19 | **19 passed, 0 failed** |
| `build-skill-mirrors.cjs --check` | OK 112/112 | **OK 112/112, skip-list verified** |
| `build-connector-registry.cjs --check` | rc=0 | **rc=0** |
| `build-orchestration-projection.cjs --check` | rc=0 | **rc=0** |
| `check-render-coverage.cjs` | rc=0 | **rc=0** |
| `check-shape-declaration.cjs --check` | rc=0 (53 advisory WARNs) | **rc=0** (53 advisory WARNs, unchanged) |
| `tests/test-265-file-meeting-gates.cjs` | 4/4 | **4 passed, 0 failed** |
| `bash tests/run-all-271.sh` | PASS=3 FAIL=1 | **PASS=3 FAIL=1** |

### Why the gate is NOT green, and why that is correct

The plan's objective and its `must_haves.truths` both assert
`check-plugin-path-anchoring.cjs --check` exits 0 "for the first time". **It does not, and
it could not.** The ROADMAP's own Wave 4 note (`.planning/ROADMAP.md:630`) already recorded
this before execution started:

> the "repo-wide gate turns green" goal is NOT reachable at the end of 271-04 while
> 271-03's 17 files remain blocked. The gate will read 31 (30 blocked command sites +
> `doctor.md`) after 271-04 completes its own 40.

That is precisely where it landed. The residue, itemized:

| Where | Sites | Owner |
|---|---|---|
| `commands/doctor.md:262`, still unedited | 1 | 271-03 (DEVIATION-271-03-A) |
| 16 command files, anchored but held uncommitted in the shared tree | 30 | 271-03 (DEFERRED-271-D1, blocks on Phase 267.3) |
| **Working tree total** | **1** | the 30 are applied on disk, so the tree reads 1 |
| **At-HEAD total** | **31** | arithmetic, 1 + 30 |

**Zero of the residue belongs to plan 271-04.** Verified: `git diff --numstat -- commands/`
still reads 16 files / 30 lines, byte-for-byte what 271-03 left. This plan did not stage,
edit, revert, or otherwise touch a single command file.

**The gate was not relaxed to make this look better.** No `ALLOWLIST` entry was added, no
predicate loosened, no exemption invented. Threat T-271-12 held.

## Deviations from Plan

### 1. [Rule 1 - stale count corrected against the live instrument] The target is 40 sites across 17 files, not 26 across 11

- **Found during:** the pre-edit gate run, before any file was touched.
- **Issue:** the plan's `objective` says "26 anchored citations", its `files_modified` lists
  11 files, and its `assumptions` block enumerates 11 skill sites and 15 agent sites. The
  gate measures **40 sites across 17 files**: 14 skills, 17 agents, 9 pipelines.
- **Not new information.** `271-AUDIT.md` section 1 already traced every one of these
  deltas, and the ROADMAP's Wave 4 block already carried the post-ruling correction at
  `.planning/ROADMAP.md:631`: "the live target is **40 sites** (14 hand-authored skills + 17
  agents + 9 pipelines across 17 files). The plan-time 26 predates the gate and missed the
  `pipelines/` surface entirely."
- **Three independent causes, all the same shape (the estimate was right about the defect and
  wrong about its size):**

  | Surface | Plan | Live | Cause |
  |---|---|---|---|
  | skills | 11 | 14 | plan-time grep counted one hit per LINE; three lines carry 2 or 3 tokens (`pws-methodology:62` carries three, `ui-system:394` carries two) |
  | agents | 15 | 17 | same per-line effect on `meeting-perspective-extractor.md:46`, plus `agents/larry-extended.md:121`, a bare post-"see" citation with no backticks that a backtick-only grep cannot see |
  | pipelines | 0 | 9 | the plan-time glob was flat `pipelines/*.md`, which matches ZERO files; every stage file lives one level down under `pipelines/<chain>/` |
- **Fix:** anchored all 40, re-measured with the gate rather than trusting either number.
  Same standing instruction all three prior waves followed.
- **Commits:** `5f4a6845`, `9d2b5e43`, `054cff88`

### 2. [Rule 2 - missing decision supplied] The plan never ruled an anchor form for `pipelines/`

- **Found during:** Task 1, when the pipelines surface turned out to be in scope.
- **Issue:** the plan scopes two forms (long for skills, short for agents). The gate's own
  recovery line names the same two surfaces. Neither names `pipelines/`, so a form had to be
  decided before 9 sites could be edited.
- **Ruling: SHORT form,** recorded in `271-AUDIT.md` section 6 with its reasoning:
  1. `pipelines/` is not a Claude Code component type. It is a MindrianOS-invented
     directory whose stage files are read at RUNTIME with the Read tool by
     `commands/pipeline.md:120` and referenced by `agents/framework-runner.md:220`. Neither
     anchor form is expanded by Claude Code in these files.
  2. The long form's `:?` clause is shell parameter expansion. In a file no shell ever
     sources, it is ~130 characters of noise per site with no failure mode to close.
  3. Pipelines are never loaded by a foreign Agent-Skills host, which is the entire reason
     skills carry the long wrapper (Exception Class 3).
- **Why anchoring still helps on an unexpanded surface:** the model reaches a stage file by
  having already resolved an absolute plugin path to read it, so a literal
  `${CLAUDE_PLUGIN_ROOT}/` prefix is an unambiguous instruction to resolve against that same
  root. A bare path is silently resolved against the user's cwd instead, which is the defect
  this phase exists to fix.
- **Commit:** `054cff88`

### 3. [Rule 1 - applicator bug caught before any file was written] The first prefix substitution ate the `references/` segment

- **Found during:** the Task 2 DRY RUN, before `--write`.
- **Issue:** the applicator replaced `` `references/ `` with `` ` `` + prefix, where the
  prefix already ends in `/`. Result:
  `${MINDRIAN_OS_ROOT:-...}}/visual/palette.json` with the whole `references` path segment
  deleted. Every one of the 40 sites would have silently pointed at a nonexistent path.
- **Root cause:** the prefix is a directory anchor, not a replacement for the first path
  segment. The token the gate reports (`references/visual/palette.json`) INCLUDES the
  `references/` segment, so re-emitting it is required.
- **Fix:** `'\`' + PREFIX + 'references/'`. Caught because the applicator has an explicit
  dry-run mode that prints every before/after pair, which is why the plan-mandated pattern of
  measure-then-apply exists.
- **Verified fixed:** all 40 anchored targets resolve on disk, `MISSING-TARGET: 0`.

### 4. [Rule 3 - acceptance criterion is imprecise about the gate's own vocabulary]

- **Issue:** the plan's Task 3 acceptance criterion says
  `--report | grep -c 'MISSING-TARGET'` must return exactly 1, and that the one hit is
  `framework-runner.md:65`'s `{framework}` placeholder.
- **Live behavior:** that grep returns **0**. The gate distinguishes the two tags: an
  existence-uncheckable templated path is tagged `TEMPLATE-TARGET`, and `MISSING-TARGET` is
  reserved for a genuinely dangling citation. `271-AUDIT.md` section 1's own target-resolution
  table already draws that distinction (`TEMPLATE-TARGET: 1`, `MISSING-TARGET: 0`).
- **Disposition:** the criterion's INTENT is fully met and the live result is strictly better
  than the literal text asked for. `framework-runner.md:65` reports
  `[TEMPLATE-TARGET ANCHORED]` and is the only templated site in the repo; zero citations
  dangle anywhere. No fix needed, recorded so a future reader does not read the 0 as a
  missed check.

## Threat Model Outcomes

| Threat ID | Outcome |
|---|---|
| T-271-10 (agents anchored with a non-expanding variable) | **MITIGATED.** Task 1 ran as a dedicated verification task before any agent file was opened. Outcome CONFIRMED expands, on Anthropic's own `plugin-structure` doc naming agents explicitly plus two shipped Anthropic agents in production. The one counter-signal and the unreachability of the plan's first-choice sources are both recorded rather than glossed. |
| T-271-11 (a skip-listed skill reverts to a plain copy of its command and fails the release gate) | **MITIGATED.** `build-skill-mirrors.cjs --check` reports `OK (112 mirrors match expected content; skip-list verified: trending-to-absurd)` after the edit. The skill stays divergent. |
| T-271-12 (relaxing the gate to make it green) | **MITIGATED.** No `ALLOWLIST` entry added, no predicate loosened, no exemption invented. The gate still reports its 1 working-tree violation honestly, and the summary names the owner of every remaining site. |

## Threat Flags

None. Every changed line is a documentation-path prefix inside markdown prose. No network
endpoint, auth path, file access pattern, or schema at a trust boundary was introduced or
altered.

## Known Stubs

None. All 40 sites are complete, and all 40 anchored targets resolve on disk.

## Deferred, Logged Not Fixed

- **DEFERRED-271-D2** (new, logged this plan): `agents/larry-extended.md` declares
  `hitl_shape: F.1` AND `connector.excluded: true` simultaneously, which the advisory
  shape-declaration gate flags as a Canon Part 11 contradiction. Pre-existing: this plan's
  diff on that file is exactly one body prose line and touches zero frontmatter. It is 1 of
  53 advisory violations repo-wide, the other 52 in `skills/*/SKILL.md` files this plan never
  opened. Advisory only, WARN, exits 0. Full entry in `deferred-items.md`.
- **DEFERRED-271-D1** and **DEVIATION-271-03-A** (both 271-03's): re-confirmed still open and
  unchanged at the close of this plan.

## Self-Check: PASSED

- All four commits verified present in `git log`: `cca1791b`, `5f4a6845`, `9d2b5e43`,
  `054cff88`.
- All 17 modified source files verified present on disk with anchored content.
- `271-04-SUMMARY.md` and the updated `deferred-items.md` verified present on disk.
- Every gate and test figure in the status table above was re-run for this summary, not
  quoted from earlier in the session.
- The three surfaces this plan owns verified at `violations=0` each by
  `check-plugin-path-anchoring.cjs --report`.
- 271-03's held work verified untouched: `git diff --numstat -- commands/` still reads 16
  files / 30 lines.
