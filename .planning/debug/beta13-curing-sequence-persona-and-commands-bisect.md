---
status: gathering
kind: qa-sweep
trigger: "beta13-curing-sequence-persona-and-commands-bisect"
created: 2026-07-04T00:00:00Z
updated: 2026-07-04T00:00:00Z
---

## Purpose
<!-- OVERWRITE on each update - reflects NOW -->

A staged, publish-and-test "curing update sequence" from the known-good baseline
`v1.15.0-beta.13` up through the five phases most implicated in two DISTINCT
navigator-reported regressions across the 188-209 arc:

1. **"Larry feels less like Larry"** (persona-enforcement over-reach, already
   partially addressed by Phase 210's blanket soften of 190/192/202/205/209).
2. **"Commands disappeared from the / menu"** (a structural menu/frontmatter
   concern, investigated fresh in this session, NOT the same root cause as #1).

Rather than trust Phase 210's software-only soften-in-place fix, this sequence
re-applies phases 188-209 ONE LAYER AT A TIME on top of beta.13, publishing each
as its own testable beta, so both regressions can be independently isolated
by REAL conversational/mechanical evidence instead of narrative classification.
This file IS the plan and IS the results log - fill in "Results" as each step
runs.

This is a `kind: qa-sweep`, not a single-bug session - it stages 5 checkpoints,
each with a mechanical gate AND a Larry-behavior probe as joint arbiters.

next_action: Step 1 MECHANICAL gate executed 2026-07-04 (isolated worktree,
NOT the live Larry-behavior probe yet) - see "Step 1 results (2026-07-04)"
below. **MAJOR CORRECTION to section A**: the argument-hint bug is
PRE-EXISTING at beta.13, not introduced by 209-02. Root-cause theory for
regression #2 needs to be reopened - see the correction block. Next: decide
whether to run the Step-1 Larry-behavior probe as originally scoped, or
pivot straight to investigating the REAL commands-menu cause (install-cache
drift is now the leading candidate).

---

## Research already done (read before re-deriving anything)

### A. The two regressions are DIFFERENT root-cause classes - do not conflate

**Persona-judgment regression** (Phase 210's target): navigator-reported
2026-07-02, "i have a big big feeling that version 1.15.beta X ... BEHIVES LESS
LIKE LARRY." Phase 210's own forked-commit audit of the full 366-commit
`v1.15.0-beta.13..v1.15.2` range classified: ~32% (116 commits) persona/voice
HARD-FAIL machinery concentrated in Phases **190, 192, 202, 205, 209**; ~13%
(46 commits) a DIFFERENT enforcement flavor (194/196/200, data-boundary
integrity - must NOT be touched); ~30% (111 commits) persona-neutral new
capability (188/189/191/195/199/201/203/204 - must NOT be touched); 19 commits
narrow bug fixes. Full detail: `.planning/phases/210-revert-persona-enforcement-over-reach-selectively-undo-the-m/210-CONTEXT.md`.

**Commands-menu regression** (this session's fresh finding, NOT covered by
210): confirmed via git evidence, not narrative -
- Commit `b21eafa0` (Phase 209-02, "stamp firing block across 95 declaring
  commands", 2026-07-02 16:46) introduced an **unquoted `argument-hint: [x]`
  YAML flow-sequence bug** across 17 command files (help, update, room, rooms,
  new-project, setup, admin, dashboard, export, models, publish, causal,
  funding, opportunities, file-meeting, research, stance). `argument-hint`'s
  documented type is String; an unquoted bracket value parses as a YAML array
  instead, which is the confirmed mechanism (cited against upstream
  anthropics/claude-code issues #17199, #22161, #46626 in the fix commit
  message itself) by which a command can fail to register correctly.
- Self-fixed 6 minutes later in the SAME session by commit `4d647638`
  ("fix(commands): quote argument-hint bracket values across 17 commands").
  Verified via `git merge-base --is-ancestor`: the break-then-fix window sits
  entirely between `v1.15.2-beta.1` (15:12) and `v1.15.2` (17:49) - **no
  published release ever shipped the broken state**. This is proof-of-mechanism,
  not a confirmed live incident on any shipped tag.
- Swept the full current `commands/*.md` set for the same anti-pattern today:
  clean. The `frameworks: [...]` / `inputs: []` / `canon_parts: [1,3,7]`
  bracket fields found in ~15 files are legitimately array-typed - not the bug.
- Ruled out a false lead: several commands (`auto-explore.md`,
  `dial-memory-refresh.md`, `mva-report.md`, etc.) have no `name:` frontmatter
  field at all - this is NOT a defect, Claude Code derives command identity
  from the filename; `name:` is inconsistent-but-harmless authoring.
- Phase 190's equivalent mass-write (`ba03c7ed`, hitl_shape/hitl_stages
  backfill across 126 surfaces) checked for the same bug class: clean, no
  confirmed incident tied to it.
- **Conclusion (ORIGINAL, NOW CORRECTED BELOW): Phase 209 (specifically its 209-02 stamp step) is the prime
  suspect for the commands-menu class of regression. Phase 190 is an unproven
  equal-risk suspect (same mass-frontmatter-write shape, no confirmed
  incident). Phases 192/199/202/205 are lower risk for THIS specific
  regression class (192/199 mostly body/new-file edits, not mass frontmatter
  rewrite; 202/205 have no live-conversation code path per 210's own research).**

### A.1 CORRECTION (2026-07-04, discovered running Step 1's mechanical gate) - the 209-02 attribution is WRONG

Built an isolated worktree (`curing-step-1` branch, from `v1.15.0-beta.13`),
cherry-picked exactly the 148 commits belonging to Step 1's phase set
(188+188.1, 189, 191, 194, 195, 196, 200, 201, 203, 204 - confirmed by
programmatic phase-tag classification of all 341 commits in
`v1.15.0-beta.13..4d6476380f`, cross-checked file-by-file for docs-only vs
functional ambiguous commits), then ran the strict YAML frontmatter sweep.

**Finding: the exact same 16 files (`admin, causal, dashboard, export,
file-meeting, funding, help, models, new-project, opportunities, publish,
research, room, rooms, setup, update`) that `4d6476380f` "fixed" ALREADY
had the unquoted-bracket `argument-hint: [...]` array-type bug AT
`v1.15.0-beta.13` ITSELF** - verified via `git show v1.15.0-beta.13:commands/<f>.md`
for each file, before ANY of phases 188-209 touched them. Then confirmed
`b21eafa0` (209-02's stamp commit) **never touches an `argument-hint` line
in any of these files** (`git show b21eafa0 -- <files> | grep argument-hint`
returns empty) - the stamp commit and the pre-existing bug are unrelated
diffs that just happen to have landed in the same commit-turned session.
File-list overlap between the beta.13-broken set and `4d6476380f`'s fix set
is 16/16 (the 17th file `4d6476380f` fixed, `stance.md`, is a brand-new file
Phase 209 itself created with the bug fresh - the only genuinely
209-introduced instance).

**What this means:**
1. Phase 209-02 did NOT introduce this bug class into 16 of the 17 files -
   it was already broken since before beta.13 (how far back is unresearched).
   `4d6476380f` opportunistically FIXED a long-standing latent bug in the
   same session as unrelated stamp work, it did not "re-fix a break it caused."
2. These 16 files include core, constantly-used commands (`help`, `room`,
   `rooms`, `update`, `admin`) that have presumably worked in the `/` menu
   for as long as the plugin has shipped, WITH this exact "confirmed
   mechanism" bug present the whole time. That is strong evidence the
   unquoted-bracket-argument-hint-parses-as-array quirk does **NOT** actually
   make Claude Code drop a command from the `/` menu in practice - it may be
   a real type mismatch but a cosmetically-harmless one, i.e. the upstream
   issues cited (anthropics/claude-code #17199/#22161/#46626) may not apply
   to this exact case, or Claude Code tolerates it silently.
3. **CONFIRMED 2026-07-05, not just a candidate anymore.** Root cause of the
   "commands disappeared from the / menu" complaint (including the navigator's
   report that it persisted "post 210" too) is a LOCAL ENVIRONMENT drift, NOT
   a code defect in any phase 188-210: `~/.claude/plugins/marketplaces/mindrian-marketplace/.claude-plugin/marketplace.json`
   (Claude Code's LOCAL CACHED clone of the marketplace registry, the file it
   actually reads to resolve which `mos` version to install) has an
   **uncommitted local modification** (`git status` shows `M
   .claude-plugin/marketplace.json`) that reverts the `mos` entry's
   `version`/`source.ref` back down to `1.15.0-beta.13`, while `git log -1`
   on that same repo shows HEAD at `92c2a8b release: sync to v1.15.2` (i.e.
   the COMMITTED state is correctly 1.15.2) and the canonical upstream source
   (`~/mindrian-marketplace/`, what `release.sh` actually pushes to) is
   correctly at `1.15.3-beta.1` (commit `43fe6b7`, already fetched into the
   local clone but not yet merged/checked-out because of the stray local
   edit blocking a clean pull). Local plugin cache directories confirm the
   drift concretely: `~/.claude/plugins/cache/mindrian-marketplace/mos/1.15.0-beta.13`
   has 103 commands, `1.15.1` and `1.15.2` caches both have 107 (matching dev
   main) - the ACTIVE session this whole investigation ran in was resolving
   to the 103-command beta.13 cache the entire time (confirmed via this
   session's own SessionStart banner: "[MindrianOS v1.15.0-beta.13]"), which
   is exactly what reads as "commands disappeared" - not because any command
   was removed, but because the local install never advanced past its
   oldest cached snapshot. **Fix: discard the stray local edit to that file
   and let it re-sync (`/mos:doctor --fix`, the exact remedy the SessionStart
   hook already suggested at the top of this session) - this is a
   local-machine repair, not a code change in this repo, so it is NOT part of
   Track A's 5-step bisect and does not block Phase 213.** No code in
   phases 188-210 needs to change for this.
4. Step 1's mechanical gate as originally worded ("0 YAML frontmatter
   errors") is not quite the right bar - 0 PARSE errors held (104/104
   commands parsed clean), but 16 pre-existing array-type coercions do NOT
   clear a stricter "argument-hint must be a string" bar. Since this predates
   the whole investigation window it should not gate Step 1 pass/fail;
   note it as a pre-existing latent-bug backlog item instead (separate from
   this bisect).

### B. Baseline facts
- Currently installed cache: `1.15.0-beta.13` (installPath
  `~/.claude/plugins/cache/mindrian-marketplace/mos/1.15.0-beta.13`,
  `lastUpdated` 2026-07-02T20:21:19Z). Dev HEAD: `1.15.3-beta.2`.
- `v1.15.0-beta.13` tag commit: `55cb2752`, 2026-06-29. This predates ALL of
  phases 188-209 (2026-07-01 through 07-03) - it is the correct clean baseline.
- All 188-209 work landed on branch `feat/v1.15-shape-brain-phases`, already
  merged into `main` (main is 116 commits ahead of that branch tip; the branch
  is only 1 commit ahead of main - i.e. fully merged).
- Real published tags between beta.13 and HEAD (`v1.15.0`, `v1.15.1`,
  `v1.15.2`) do NOT give fine-grained phase isolation - `v1.15.0` already
  bundles 190+192+199 together (confirmed via `git merge-base
  --is-ancestor`). Fine-grained isolation requires custom
  checkout/cherry-pick from `beta.13`, not the existing tags.
- No command `.md` file has EVER been deleted in the last 200 commits
  (`git log --diff-filter=D --summary` on `commands/*.md` returns empty).
  "Disappearance" is therefore either (a) the YAML-parse mechanism above, (b)
  install-cache drift (stale cache missing newly-ADDED commands, the opposite
  direction), or (c) the deprecated_aliases soft-hide of 5 commands
  (heal/query/organize/hmi-status/visualize) from `/mos:help` specifically
  (NOT from Claude Code's native `/` menu) - a same-day, intentional, gated
  quick-task change, not part of 188-209.

### C. Hooked Model audit of `/mos:ignite` (the Step-1 probe surface)
Full audit run via the `hooked-model` skill against Phase 204's spec.
Score: 38/70 (fragile loop). Key findings:
- Action (B=MAP) 8/10 - genuinely low friction, one AskUserQuestion select.
- Investment 3/10 - **persona/room pick currently happens BEFORE any value is
  delivered** (profile-completion-before-reward anti-pattern).
- Variable Reward 4/10 - new-user path (Larry's Reframe) is naturally
  variable/good; returning-user room-chooser card is flat/predictable
  ("Room X, stage Y" reads as a lookup, not a hook).
- Loop Closure 4/10 - graph persists system-wide but the chooser card
  surfaces nothing that pulls the navigator back.
- Ethics 9/10 - clean Facilitator quadrant.
- Top 3 fixes (not yet built, recommendation only): (1) invert no-room path to
  respond-then-infer-persona instead of pick-then-talk; (2) make the
  room-chooser card surface a real open-loop fact (DRIFT.md /
  contradiction-edge count) instead of bare stage/last-focus, reusing
  Phase 195 data - Part 7; (3) end sessions naming one specific unresolved
  tension that becomes next session's chooser hook line. Phase 183's METER
  (two-gauge invocation-density + transfer instrument) is the already-built
  way to measure whether any of this actually improves the loop, rather than
  estimating it.
- This audit is folded into the Step-1 probe below as an explicit criterion,
  separate from the mechanical/behavioral checks.

---

## The Curing Sequence (up to Step 5)

Cap at 5 steps per navigator instruction. Each step layers cumulatively on
`v1.15.0-beta.13`. Each step runs BOTH gates before being called green:
**Mechanical gate** (cheap, disqualifying - stop here if it fails) then
**Larry-behavior probe** (the real arbiter - a live conversation, not a script).

| Step | Adds (commits/phases) | Mechanical gate | Larry-behavior / Hooked-Model probe |
|---|---|---|---|
| 1 | 188 + 188.1, 189, 191, 194, 195, 196, 200, 201, 203, 204 (everything that never mass-touches command frontmatter) | `/mos:ignite` appears in `/` menu, executes, 0 YAML frontmatter errors across all `commands/*.md` | Cold-start `/mos:ignite`: renders as a live Shape-F card (never bare prose); room-chooser fires if rooms exist else persona/"just talk" branch; persona pick, if it fires, comes AFTER at least one turn of real value (Hooked-Model fix #1); ask one open-ended question separately and confirm Larry gives a real reframe in <=8 sentences, no forced card |
| 2 | + 199 (new `agentshield.md` + new SessionStart hook `0a55f12c`) | command count +1, new SessionStart hook does not throw / does not blank session-start context, 0 YAML errors | Re-run the Step-1 probes unchanged - confirm the new hook changes nothing about ignite's behavior or the greeting |
| 3 | + 190 (`ba03c7ed`, hitl_shape/hitl_stages backfill across 126 surfaces) | grep every touched file for unquoted-bracket-in-string-field (the confirmed 209 bug class); 0 YAML errors | Ask a question whose honest answer is prose, not a decision. FAILS if a card is forced where none is warranted (the declaration-hard-gate symptom named in 210-CONTEXT item A) |
| 4 | + 192 (selector conversions to `suggest-next`/`rooms`/`onboard`, + new `stance.md`) | command count +1, 0 YAML errors | Short low-stakes exchange. FAILS if a glyph is bolted on that doesn't match the move, or a stance-footer appears on a turn that didn't need one (210-CONTEXT item B) |
| 5 | + 209's stamp `b21eafa0` ALONE first (withhold its fix `4d647638`), then apply `4d647638` on top | **CORRECTED EXPECTATION (2026-07-04, see A.1 above): step 5a will show the bug on only 1/17 files (`stance.md`, the new file 209 created) - the other 16 are ALREADY broken at beta.13 and stay broken through step 5a unchanged. This is NOT the causation control it was designed to be; the original "FAIL then PASS" framing is invalidated.** Step 5b (+ the fix) still clears all 17 either way. | Trigger a clarifying AskUserQuestion, answer it in plain prose (don't click an option), send a follow-up. FAILS if the SAME card force-fires again (210-CONTEXT item E, the documented incident) |
| **1.5 (NEW, flagged 2026-07-04)** | `quick(gate-native-fire-w1)` - 4 commits (`0c2dab0e`, `e1edcdc9`, `37820c61`, `f20db95c`) landing BEFORE 190/192/202/205/209 in the timeline, NOT tagged with any of those phase numbers so Phase 210's own forensic audit (which classified by phase number only) would not have caught them. Touch `agents/larry-extended.md` ("P1 Decision-Gate fire mandate") and `skills/ui-system/SKILL.md` ("P3 fire mandate in auto-loaded ui-system Shape-F") directly - thematically identical to the "forced card / behaves less like Larry" complaint class. | Diff review: does this standalone quick-task inject its own independent card-forcing mandate, separate from 190/192/202/205/209's mechanisms? | Not yet probed. Candidate 6th suspect for regression #1 that the current 5-step table does not test for. |

Out of scope at this cap: Phase 202 (voice-contract disqualifier - zero
live-conversation path per 210's own research, low priority) and Phase 205
(elevation/FUSION `sessionEndQuorum` force-pick, "the big one" alongside 209
per navigator framing) are NOT reached by Step 5. Flag as a known gap, not
silently dropped - a Step 6/7 extension exists if Steps 1-5 don't already
explain the regression.

Rule: if a mechanical gate fails, stop - that step is a menu bug, log it, do
not continue stacking risk. If the mechanical gate passes but the probe
fails, that step is the behavioral culprit - stop there rather than
continuing forward; the remaining phases don't need to be implicated once one
is confirmed.

---

## QA Protocol (paste into the working session that runs each step)

```
For step N:
1. git checkout -b curing-step-N v1.15.0-beta.13   (step 1) or branch forward from step N-1
2. cherry-pick / merge exactly the commits listed for step N above
3. Run: node scripts/check-shape-declaration.cjs --check
        node scripts/check-render-coverage.cjs
        node scripts/build-connector-registry.cjs --check
        node -e '<strict YAML frontmatter parse sweep over commands/*.md>'
4. Publish/install this checkout as a throwaway beta (or point CLAUDE_PLUGIN_ROOT at the worktree)
5. Run the Larry-behavior probe for step N as a REAL conversation (not simulated)
6. Record PASS/FAIL for both gates in the Results section below before moving to step N+1
```

## Results
<!-- fill in as each step actually runs -->

- Step 1: **MECHANICAL gate PARTIAL / re-scoped (2026-07-04).** Isolated worktree
  built at `/home/jsagi/gsd-workspaces/curing-step-1/MindrianOS-Plugin`
  (branch `curing-step-1`, from `v1.15.0-beta.13`), all 148 in-scope commits
  cherry-picked clean (conflicts were pure documentation-ledger noise -
  ROADMAP.md/data/*.json - auto-resolved by taking the incoming commit's
  version; `data/command-registry.json` regenerated via
  `scripts/build-command-registry.cjs` once mid-sequence per its own
  pre-commit hook). YAML parse sweep: 104/104 commands parse clean, 0 hard
  errors. BUT found 16 pre-existing argument-hint array-type coercions - see
  A.1 correction above, this is NOT a regression introduced by anything in
  Step 1's phase set, it predates beta.13 itself. `commands/ignite.md`
  present and well-formed. Shape-declaration/render-coverage/
  connector-registry `--check` gates and the Larry-behavior probe (needs a
  REAL conversation against this worktree, e.g. via `CLAUDE_PLUGIN_ROOT`
  pointed at it) NOT yet run - that is the actual remaining next_action.
- Step 2: not yet run.
- Step 3: not yet run.
- Step 4: not yet run.
- Step 5: not yet run.

## Eliminated
<!-- APPEND-only -->

- Missing `name:` frontmatter field on several commands (auto-explore,
  dial-memory-refresh, mva-report, dogfood-flush, brain-derive,
  explain-decision, feynman-timeline-refresh): NOT a bug. Claude Code derives
  command identity from filename; confirmed by direct file inspection.
- `frameworks: [...]` / `inputs: []` / `canon_parts: [...]` bracket fields
  across ~15 commands: legitimately array-typed, not the argument-hint bug
  class.
- Published tags `v1.15.0`/`v1.15.1`/`v1.15.2`: none of them shipped the
  209-02 argument-hint break live (fixed same-session, before `v1.15.2` was
  tagged). Confirmed via `git merge-base --is-ancestor` against release
  commit timestamps.
