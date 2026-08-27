---
phase: 271-bare-reference-path-resolution-audit
plan: 05
subsystem: plugin-portability
tags: [release-gate, changelog, knowledge-base, compositing, followup-registration, phase-close-out]
status: COMPLETE (with one deliverable half-landed, see DEVIATION-271-05-B)
requires:
  - "271-01 (the anchoring gate and its fixture test)"
  - "271-02 (the /mos:radar option-d allowlist ruling and FOLLOWUP-271-R1)"
  - "271-03 (the command sweep, PARTIAL at 28/45, blocked on Phase 267.3)"
  - "271-04 (skills, agents, pipelines, 40/40)"
provides:
  - "scripts/verify-release gate 10c: the anchoring gate wired fail-closed into the release lockstep"
  - "CHANGELOG.md unreleased Fixed entry, naming both what shipped and the 31 sites that did not"
  - ".planning/debug/knowledge-base.md summary block closing the file-meeting RCA's named follow-up audit item"
  - "ROADMAP Phase 274: the adjacent bare-scripts/ class registered with count, evidence, and instrument"
  - "FOLLOWUP-271-R1 given a scheduled home in Phase 274, no longer code-only"
  - "The Dev-Research Compositing reasoning trail (mirror home written; room home BLOCKED, see below)"
blocked_by: []
affects:
  - "Every future release: scripts/verify-release is now RED until 271-03's remainder lands (Phase 267.3)"
  - "Phase 274 (new): owns the 34 bare-scripts/ invocation sites and FOLLOWUP-271-R1"
  - "Phase 267.3: is now the sole blocker standing between this phase and a green release gate"
tech_stack_added: []
tech_stack_patterns:
  - "Fixture A/B gate proof: copy the checker into a tmpdir tree, prove exit 1 on a bare citation and exit 0 on the identical line anchored, with the prefix as the only variable. Never leave a deliberately broken file in the real tree."
  - "Direct ROADMAP Edit instead of phase.add, then VERIFY placement (heading count, heading position, file tail) rather than trusting the tool"
key_files_created:
  - .planning/phases/271-bare-reference-path-resolution-audit-45-of-113-commands-cite/271-05-SUMMARY.md
  - ~/MindrianOS/research/2026-08-27-bare-plugin-path-resolution/2026-08-27-bare-plugin-path-resolution.md
key_files_modified:
  - scripts/verify-release
  - CHANGELOG.md
  - .planning/ROADMAP.md
  - .planning/debug/knowledge-base.md
  - .planning/phases/271-bare-reference-path-resolution-audit-45-of-113-commands-cite/271-AUDIT.md
decisions:
  - "Wire the gate FAIL-CLOSED even though it makes verify-release red, because an advisory WARN would let 30+ unanchored citations ship green. The gate was not relaxed to improve the number."
  - "Do NOT force-commit 271-03's 16 held command files to turn the gate green. The blocker is a real declaration gap, not a formality."
  - "Omit doctor.cjs --acceptance wiring, per plan: higher-traffic shared file, no added proof value over the release gate."
  - "Register Phase 274 by direct Edit at the true end of ROADMAP.md, not via phase.add, and verify placement afterwards."
  - "Do NOT route around the write-scope hook via Bash to land the room research entry. A blocked gate is surfaced, never bypassed."
metrics:
  tasks_completed: 3
  commits: 3
  duration: ~35 min
  completed: 2026-08-27
---

# Phase 271 Plan 05: Release-Gate Wiring and Phase Close-Out Summary

Made the anchoring guard structural by wiring it fail-closed into the release lockstep, closed
the paper trail across CHANGELOG / ROADMAP / knowledge-base, and handed off the two classes
this phase deliberately did not fix as a numbered phase with a measuring instrument attached.

## What shipped, by area

### 1. Release-gate wiring (commit `1e104f0c`)

`scripts/verify-release` gained gate **10c, Plugin Path Anchoring**, placed immediately after
the `build-skill-mirrors.cjs --check` block so the two markdown-surface gates are read
together. Pure addition: `git diff --numstat` reads **41 added, 0 removed**. `bash -n` clean.

The comment states the one sentence a reader in six months needs (bare plugin-relative paths
resolve against the session cwd, not the plugin install dir, so they work by coincidence in
this dev repo and fail in every real Data Room), cites the originating RCA by path
(`.planning/debug/resolved/file-meeting-missing-reference-files.md`), and records that the
gate exists because that RCA fixed one file and named the structural guard as missing work.
It also names the second prior pass (`intern-w1-rooms-skill-script-path.md`) to make the
scope-by-mechanism lesson visible at the point of enforcement.

**The gate was proven to fire, not assumed.** A throwaway fixture tree was built under the
scratchpad with a copy of the checker and a single command file:

| Fixture | Citation | Exit |
|---|---|---|
| RED | `` Read `references/methodology/grade.md` `` | **1**, `VIOLATIONS: 1` |
| GREEN | `` Read `${CLAUDE_PLUGIN_ROOT}/references/methodology/grade.md` `` | **0**, `OK: every ... anchored` |

Same file, same line, prefix as the only variable. The fixture tree was deleted immediately
after; nothing deliberately broken was left anywhere in the repo.

**`doctor.cjs --acceptance` wiring was deliberately omitted**, per the plan: it is a
higher-traffic shared file and the release gate alone satisfies the RCA's named requirement,
so the collision risk in a shared working tree buys no additional proof.

### 2. CHANGELOG (commit `72972d2f`)

A `Fixed` block under the existing `## [Unreleased] -- v2.0.0-beta.12 (in progress)` heading.
No version number was invented and `release.sh` was NOT run, per the standing do-not list.
Three bullets, in the house Feynman register with no em-dashes: what was anchored and why it
matters to a user, the gate that stops the class returning, and an explicit
**"Known incomplete, stated plainly"** bullet naming all 16 still-broken commands by name plus
`commands/doctor.md`. A user reading this entry can tell exactly which commands are fixed and
which are not, which is the point of writing it before the release rather than after.

### 3. Knowledge-base (commit `72972d2f`)

One summary block appended to `.planning/debug/knowledge-base.md` in the house shape (Date /
Error patterns / Root cause / Fix / Verification / Files changed / Pattern lesson). It closes
the file-meeting RCA's named "Follow-up audit (separate, out of scope for this RCA)" item,
carries the final counts and the guard's script path, and carries the residual blind spot the
RCA itself named and this phase also could not close: **no live end-user session with cwd set
to an actual separate Data Room was available on any surface, so verification is by path
resolution, target-existence checks and static gates, not by live invocation.**

### 4. Dev-Research Compositing trail (PARTIAL, see DEVIATION-271-05-B)

The reasoning trail was authored in full (212 lines): why bare plugin-relative paths are a
resolution-mechanism defect rather than a typo class (all 57 cited targets exist, so nobody
mistyped anything; only the implicit BASE was wrong), why the dev repo's own `references/`
folder made the defect structurally invisible for the project's entire life, why a one-file
fix predictably left 55 files broken, and why the durable answer is a gate rather than a
sweep. It carries the cross-domain observation the plan asked for: this is the **third** pass
at one disease class, each scoped by grep pattern rather than by defect class, which is
exactly why each left the other pattern standing, with `commands/file-meeting.md`'s three
surviving `node scripts/wikilink-file.cjs` invocations as the sharpest evidence.

The generalizable lesson is stated explicitly: **scope a portability fix by the RESOLUTION
MECHANISM it repairs, not by the string that happened to surface it.**

| Home | Path | Status |
|---|---|---|
| Source-of-record mirror | `~/MindrianOS/research/2026-08-27-bare-plugin-path-resolution/` | **WRITTEN**, `test -e` RESOLVES |
| Room (rethinking-mindrianos) | `~/MindrianRooms/rethinking-mindrianos/research/2026-08-27-bare-plugin-path-resolution/` | **BLOCKED**, `test -e` MISSING |
| Phase-side cross-link | `271-AUDIT.md`, new "Dev-Research Compositing cross-link" section | **WRITTEN** |

### 5. Follow-up registrations (commit `72972d2f`)

**Phase 274: Bare `scripts/` Invocation Anchoring** registered at the true end of
`.planning/ROADMAP.md`. It carries the measured **34 sites** (30 commands / 3 hand-authored
skills / 1 agent / 0 pipelines), the **1 reasoned exclusion** (`commands/status.md:13`, an
`allowed-tools` permission matcher that declares a pattern and never resolves a path), the
named file:line evidence (`commands/file-meeting.md` lines 771, 978, 983), the reason the
split was deliberate (a `Read` citation and a `Bash` invocation fail differently and need
different verification), the scope-by-mechanism lesson so pass four does not repeat pass
three, and the ready-made instrument
`node scripts/check-plugin-path-anchoring.cjs --report --include-scripts` with an instruction
to re-measure at plan time rather than trust the 34.

**`FOLLOWUP-271-R1`** was given its scheduled home inside Phase 274 (it previously existed
only in `REGISTERED_FOLLOWUPS` in the gate script and in `271-AUDIT.md` section 4). It is
housed there rather than in a phase of its own because splitting `/mos:radar` into a dev-only
`--fetch` write path and a user-safe anchored read path is the same read/write-path-split
question Phase 274 must answer for dev-only `scripts/` invocations. The `option-b` rejection
is restated in the registration, because it is the fix a future reader reaches for first and
it is worse than doing nothing.

**Placement verified, not assumed** (the known `phase.add` wedging bug):

```
grep -c '^### Phase 274:'  -> 1          (no duplicate, number was free)
grep -n  '^### Phase '     -> 274 is the LAST heading, line 827
wc -l                      -> 843
tail -5                    -> Phase 274's own "- [ ] TBD (run /gsd-plan-phase 274 to break down)"
```

Phase 273's content is fully intact before it and nothing is wedged mid-document. The bug was
avoided by construction: the registration was made with a direct `Edit` anchored on the last
line of the file, per the plan's `<assumptions>`, not with `phase.add`.

## Deviations from Plan

### DEVIATION-271-05-A: acceptance criterion "a PASS line naming the anchoring gate" is unmeetable, and was not met

**Found during:** Task 1, immediately after wiring.

**Issue.** The plan's Task 1 acceptance criterion 3 required `bash scripts/verify-release` to
emit a PASS line for the new gate. That criterion was written on the assumption that waves 3
and 4 would both drive the tree to zero violations. Wave 3 closed PARTIAL, so the working tree
still carries `commands/doctor.md:262` (and HEAD carries 31 sites). The gate therefore
correctly FAILS.

**Resolution: the gate was left failing.** Two alternatives were available and both were
rejected. Making the gate advisory (WARN, exit 0) would have produced a green board while 30+
unanchored citations shipped, which is the precise failure mode this phase exists to prevent
and the same T-271-12 gate-relaxation threat wave 4 already held against. Force-committing
271-03's 16 held files would have bypassed a real pre-commit declaration gate. Neither was
acceptable, so the honest outcome is a red gate.

**Measured consequence:**

| Run | Before this plan | After this plan |
|---|---|---|
| `bash scripts/verify-release` | 31 passed, 0 failed, 3 warnings (34 checks). **CLEAR TO RELEASE** | 31 passed, **1 failed**, 3 warnings (35 checks). **DO NOT RELEASE** |

**A release cut is now blocked until Phase 267.3 unblocks 271-03's remainder.** This is
recorded prominently in the ROADMAP Phase 271 entry and in the gate's own failure output,
which names the blocker, the file count, and `deferred-items.md` (DEFERRED-271-D1) directly,
so a future session hitting the red gate learns why in the failure message instead of
assuming the gate is misconfigured.

### DEVIATION-271-05-B: the room half of the compositing mandate is BLOCKED by a write-scope hook, and was not forced

**Found during:** Task 3, on the first write to the room.

**Issue.** The `Write` to
`~/MindrianRooms/rethinking-mindrianos/research/2026-08-27-bare-plugin-path-resolution/` was
refused by the `write-scope-check` PreToolUse hook, verbatim:

> Blocked: write to rethinking-mindrianos denied. Active room is launchpad-02.
> To authorize, run: /mos:rooms switch rethinking-mindrianos

`launchpad-02` is a stale binding this GSD session never established. This matches the open
WATCH item on room-context bleed into unrelated sessions.

**Resolution: the hook was NOT bypassed.** Writing the same bytes via a Bash heredoc would
have satisfied the letter of the plan while silently defeating a gate, which is the exact
"silently skipped gate" class this repo already tracks as a recurring defect. Instead:

1. The full entry was authored and preserved so no reasoning was lost.
2. The `~/MindrianOS/research/` source-of-record mirror was written and verified. That
   location was probe-tested first and is genuinely permitted by the hook, so writing it is
   not an evasion of any denial.
3. `271-AUDIT.md` records BOTH paths with honest per-path status, including the one that does
   not yet resolve.

**Outstanding human action, one command:** `/mos:rooms switch rethinking-mindrianos`, after
which the room copy is a single `cp` from the mirror. **The compositing mandate is
half-satisfied and is recorded as such, not claimed as complete.**

### DEVIATION-271-05-C: ROADMAP status line does not use the literal "5/5 plans complete"

The plan's Task 2 acceptance criterion asked for the literal string `5/5 plans complete`.
Writing that would assert full closure while 17 command files remain blocked. The line reads
`**Plans:** 5/5 plans executed. **Phase status: CLOSED-PARTIAL, 2026-08-27.**` followed by the
precise split (four plans complete, 271-03 partial at 28/45 files and 63/94 sites) and the
repo-wide 103-of-134 figure. Precision was chosen over the literal.

### Self-corrected error: a fabricated commit hash

While writing the Wave 5 ROADMAP row, a placeholder commit hash `bd7cd93e` was written for the
not-yet-made docs commit. It was caught by `git cat-file -t` ("Not a valid object name"),
which was run precisely to check it, and corrected to the real hash `72972d2f` before the
close-out commit. Recorded because an unverified hash in a paper trail is worse than no hash.

## Verification

| # | Check | Result |
|---|---|---|
| 1 | `grep -c 'check-plugin-path-anchoring.cjs' scripts/verify-release` | **1** |
| 2 | `grep -c 'file-meeting-missing-reference-files' scripts/verify-release` | **1** (RCA cited by path) |
| 3 | `git diff --numstat -- scripts/verify-release` | **41 added, 0 removed** (pure addition) |
| 4 | `bash -n scripts/verify-release` | clean |
| 5 | Gate fixture A/B | RED exit **1**, GREEN exit **0** |
| 6 | `bash scripts/verify-release` | 31 passed, **1 failed**, 3 warnings. Expected, see DEVIATION-271-05-A |
| 7 | `node tests/test-271-plugin-path-anchoring.cjs` | **19 passed, 0 failed** |
| 8 | `bash tests/run-all-271.sh` | **PASS=3 FAIL=1**, identical to the pre-plan baseline. The one failure is the anchoring arm on `doctor.md:262`; this plan changed nothing about it |
| 9 | `build-skill-mirrors.cjs --check` | OK, 112/112, skip-list verified |
| 10 | `grep -c 'CLAUDE_PLUGIN_ROOT' CHANGELOG.md` | **5** |
| 11 | Em-dashes in all new CHANGELOG / ROADMAP / knowledge-base text | **0** |
| 12 | All five `271-0N-PLAN.md` filenames in ROADMAP | present, 1 each |
| 13 | `commands/file-meeting.md` and `commands/status.md:13` in the outcome paragraph | present |
| 14 | `### Phase 274:` heading count / position / file tail | **1** / last heading / 274's own content |
| 15 | Cross-link `test -e` sweep | 6 of 7 RESOLVE; the room entry MISSING by design, see DEVIATION-271-05-B |

**Nothing regressed.** The pre-plan baseline was captured before the first edit precisely so
the new failure could be attributed: `run-all-271.sh` was PASS=3 FAIL=1 before and after, and
`verify-release`'s single new failure is the newly added gate reporting a pre-existing,
already-documented condition.

## The 17 blocked files were not touched

Confirmed by inspection, not assumed. The 16 held command files and their 16 regenerated
mirrors remain modified and uncommitted in the shared tree, exactly as 271-03 left them, and
`commands/doctor.md` remains unedited. This plan staged only `scripts/verify-release`,
`CHANGELOG.md`, `.planning/ROADMAP.md`, `.planning/debug/knowledge-base.md`, `271-AUDIT.md`
and this summary. `docs/MINDRIANOS-PRD.md`, `docs/2026-08-20-gate0-queries.cypher`,
`prototypes/` and `specs/` were left untracked and untouched.

## Honest status of Phase 271 as a whole

**CLOSED-PARTIAL.** Four of five plans complete (271-01, 271-02, 271-04, 271-05); 271-03
PARTIAL at 28 of 45 command files and 63 of 94 citation sites. Repo-wide **103 of 134 sites
anchored, 31 remaining** (30 across 16 commands whose fix is written and verified but
uncommittable, plus `commands/doctor.md:262`).

What the phase genuinely achieved: it converted an unmeasured, twice-misscoped defect class
into a measured one with a pinned instrument, corrected three circulating denominators to a
single canonical live number, ruled one real exception with the residual risk registered
rather than dropped, anchored three full surfaces to zero violations, and put a fail-closed
release gate behind all of it so the class cannot silently return.

What it did not achieve, stated without softening: the tree is not green, the release gate is
red, a release is blocked, the file that started the whole investigation is still not fully
portable, and the room half of the compositing mandate is unwritten pending one human command.
None of that is hidden in a footnote; all of it is in the ROADMAP row, the CHANGELOG entry,
the knowledge-base block, and the gate's own failure output.

## Self-Check: PASSED

All claimed artifacts exist on disk (`271-05-SUMMARY.md`, `271-AUDIT.md`, `scripts/verify-release`,
`CHANGELOG.md`, `.planning/ROADMAP.md`, `.planning/debug/knowledge-base.md`, and the
`~/MindrianOS/research/` mirror). Both claimed commits resolve in `git log` (`1e104f0c`,
`72972d2f`). Zero em-dashes. The 17 blocked command files are verifiably untouched:
`git diff --numstat -- commands/` still reads 16 files / 30 added lines, identical to the
figures 271-03 and 271-04 both recorded. The one deliberately-unresolved path
(the rethinking-mindrianos room entry) is documented as MISSING rather than claimed as written.
