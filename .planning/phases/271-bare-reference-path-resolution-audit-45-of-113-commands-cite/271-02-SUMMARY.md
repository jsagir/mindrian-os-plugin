---
phase: 271-bare-reference-path-resolution-audit
plan: 02
subsystem: repo-gates
tags: [gate, lint, path-resolution, plugin-portability, decision, allowlist, followup]
requires:
  - "271-01 (the gate, its fixture suite, and the RED-baseline audit register)"
provides:
  - "scripts/check-plugin-path-anchoring.cjs ALLOWLIST populated with the /mos:radar option-d exception and its written reason"
  - "scripts/check-plugin-path-anchoring.cjs REGISTERED_FOLLOWUPS with FOLLOWUP-271-R1 and a named owner"
  - "271-AUDIT.md section 4 resolved to option-d with the verbatim reason and the two rejected options"
  - "the post-ruling sites-to-anchor number: 134"
affects:
  - "plan 271-03 (its command sweep must now skip commands/radar.md; its target is 94 command sites, not 99)"
  - "plan 271-04 (unchanged: 40 sites across skills, agents, pipelines)"
  - "plan 271-05 (must register FOLLOWUP-271-R1 into the ROADMAP as a scoped phase)"
tech_stack_added: []
tech_stack_patterns:
  - "Reason-enforced ALLOWLIST: an exception cannot be silenced anonymously (validator throws at module load)"
  - "Followup-id referential integrity: an ALLOWLIST entry naming a followup id that does not resolve in REGISTERED_FOLLOWUPS throws at module load, so deferred work cannot be deleted while the exception depending on it still ships"
  - "Verbatim reason string duplicated code-to-record on purpose, machine-verified for parity"
key_files_created: []
key_files_modified:
  - scripts/check-plugin-path-anchoring.cjs
  - .planning/phases/271-bare-reference-path-resolution-audit-45-of-113-commands-cite/271-AUDIT.md
decisions:
  - "option-d: exclude all 5 commands/radar.md sites via a reasoned allowlist entry AND register the residual read-side defect as FOLLOWUP-271-R1 with a named owner"
  - "option-b explicitly rejected and NOT implemented: splitting read/write anchoring across two resolution bases is a worse failure than either uniform choice"
  - "Post-ruling sites-to-anchor is 134, not the plan's 119; the plan's number came from the stale plan-time estimate of 124 rather than the live 139"
  - "FOLLOWUP-271-R1 registered in TWO homes (code + audit) and made load-bearing via referential integrity, because .planning/ is gitignored and a planning-only registration is not durable"
metrics:
  tasks_completed: 2
  duration_minutes: 26
  completed_date: 2026-08-27
  files_created: 0
  files_modified: 2
  shipped_markdown_modified: 0
---

# Phase 271 Plan 02: The /mos:radar Disposition Summary

Ruled the one behavior-changing site in a 139-site mechanical sweep by hand, encoded
the ruling as a reasoned allowlist entry whose justification string is machine-verified
to match the audit record character-for-character, and made the residual defect the
ruling knowingly defers structurally undeletable by wiring a load-time referential
check between the exception and the follow-up that owns it.

## The Ruling

**Selected: `option-d`.** Recorded by the navigator before this plan ran (pre-recorded
in `271-AUDIT.md` section 4 by plan 271-01) and confirmed at the checkpoint against the
live file rather than the plan's quotation of it.

**The human's verbatim reason**, reused character-for-character as the `reason` field of
the `ALLOWLIST` entry:

> /mos:radar is a dev-repo-cwd operator command: line 77 WRITES this file and lines
> 64/73/74 read and write the git-tracked data/capability-ledger.json it renders, so
> anchoring would redirect writes into references/capability-radar/changelog-cache.md
> and data/capability-ledger.json through ${CLAUDE_PLUGIN_ROOT}, which points at the
> plugin install cache that gets wiped on every update - these are genuine writes to a
> git-tracked source of record, not read-only citations, so this is a real exception,
> not a defect.

The em-dash in the navigator's original phrasing was normalized to a hyphen. That is the
one character-level change, and it is required: this repo forbids em-dashes anywhere, and
the string ships inside a tracked source file.

### Evidence confirmed live, not quoted

The checkpoint's `read_first` was honored: `commands/radar.md` lines 44-103 were read in
full before the ruling was recorded. Every line the plan cited was confirmed:

| Line | Step | What it actually does |
|---|---|---|
| 51, 52 | Step 2 (no flags) | READ `capabilities-index.md`, `changelog-cache.md` |
| 64 | Step 3 (`--fetch`) | READ `data/capability-ledger.json`, uses `ledger_covers.to` as a low-water mark |
| 65 | Step 3 | cites `.planning/phases/265-.../265-RESEARCH.md`, a gitignored path present in no install |
| 69-71 | Step 3b | declares the ledger "the machine-readable source of record"; the cache is "a rendered view of it, never the other way around" |
| 73, 74 | Step 3b | READ, parse, then APPEND rows to `data/capability-ledger.json` |
| 77 | Step 3b | **WRITES** the summary into `references/capability-radar/changelog-cache.md` |
| 95 | Step 3b | READ `capabilities-index.md` to diff against fetched capabilities |
| 99 | Step 4 (`--domain`) | READ `capabilities-index.md` |

### What was rejected, and why it is written down

- **`option-c` (anchor all 5 uniformly): rejected.** It ships a regression to fix a
  portability bug. The line 77 write lands in the update-wiped install cache while
  `data/capability-ledger.json` stays repo-bound, so the source of record and its
  rendered view diverge onto two different bases.
- **`option-b` (anchor the 4 reads, allowlist only the line 77 write): rejected and NOT
  implemented,** per the navigator's explicit instruction. It splits one file's citations
  of the SAME file across two resolution bases: Step 3b writes the cache to the repo path
  while Steps 2 and 4 read it from the install cache, so after a `--fetch` the summary a
  user sees would never be the summary just written. The rejection is written into the
  allowlist entry's code comment as a "do NOT fix it this way" note, because `option-b`
  is the intuitive fix the next reader will reach for first.

## The Follow-Up: FOLLOWUP-271-R1

`option-d` is `option-a` plus honesty, and this registration is the honesty half. Without
it the ruling would be `option-a`.

| Field | Value |
|---|---|
| ID | `FOLLOWUP-271-R1` |
| Title | Split `/mos:radar` into a dev-only `--fetch` write path and a user-safe anchored read path |
| Owner | repo navigator (the human who ruled `option-d`); ROADMAP registration carried by plan 271-05 |
| Residual risk | Lines 51, 52, 95, 99 are pure reads reached by plain `/mos:radar` and `/mos:radar --domain`. A user invoking either from their Data Room resolves them against their cwd and hits exactly the file-meeting failure this phase exists to fix. |
| Why deferred | The naive fix is `option-b`, which is worse than doing nothing. A correct fix is a read/write path split in the command, a behavior change that does not belong inside a mechanical anchoring sweep. |
| Status | OPEN, owned by no Phase 271 plan; 271-05 registers it for scheduling. |

**Filed in two homes, cross-linked:**

1. `scripts/check-plugin-path-anchoring.cjs` -> the new `REGISTERED_FOLLOWUPS` const
   (tracked, ships in git).
2. `271-AUDIT.md` section 4 -> the full reasoning table (force-added to git).

**And made load-bearing, not decorative.** The `ALLOWLIST` entry carries
`followup: 'FOLLOWUP-271-R1'`, and `validateAllowlist()` now THROWS at module load if a
named followup id does not resolve in `REGISTERED_FOLLOWUPS`. So the follow-up cannot be
deleted while the exception that depends on it still ships. This is the same principle as
plan 271-01's reason-validator (T-271-05), extended one step: an exception cannot be
silenced anonymously, and now it also cannot defer a real defect onto nobody.

## Deviations from Plan

**1. [Rule 1 - stale expectation corrected, not silently adopted] The post-ruling total is 134, not 119.**
- **Found during:** Task 2.
- **Issue:** The plan's acceptance criterion says `--report` must show a non-allowlisted
  violation total of **119**. That figure is `124 - 5`, derived from the plan-time
  ESTIMATE of 124 sites, because `271-02-PLAN.md` was written before the gate existed to
  measure the live tree. Plan 271-01 measured 139 live and flagged this exact number for
  correction in its own summary.
- **Fix:** The gate was NOT adjusted to hit 119. The live post-ruling number is
  **134** (139 minus the 5 radar sites), it is asserted in `271-AUDIT.md` section 1 under
  a new "Sites to anchor, post-ruling" subsection with the arithmetic shown, and the
  reason the plan's 119 is wrong is written next to it so the next reader does not
  re-derive it.
- **Precedent:** identical in kind to plan 271-01's recorded count deviation, and follows
  the same standing instruction: record the actual number rather than adjusting the
  instrument to match a stale expectation.
- **Commit:** `4061483e`

**2. [Rule 2 - missing critical functionality] Followup referential integrity added to the validator.**
- **Found during:** Task 2.
- **Issue:** The ruling requires the residual risk to have "an explicit owner rather than
  an unowned loose end". A `followup:` field that is only a comment satisfies that on the
  day it is written and decays the moment someone edits the file. Worse, a dangling
  followup id reads as owned while owning nothing, which is a repudiation risk of exactly
  the kind T-271-05 exists to close.
- **Fix:** `REGISTERED_FOLLOWUPS` const plus a load-time check in `validateAllowlist()`
  that throws on an unresolvable followup id. Verified both arms by hand: a dangling id
  throws, a resolvable one is accepted.
- **Commit:** `4061483e`

**3. [Scope] ROADMAP.md plan-checklist rows for 271-01 AND 271-02 both checked here.**
- `271-01-SUMMARY.md` deferred its own ROADMAP row explicitly ("Action for the next pass:
  after the 270-12 agent lands its commit, record the Phase 271 plan-01 row"), because the
  concurrent Phase 270 agent was mid-mutation of that file. That agent has since landed
  (`f4e9d50a`), the file is clean, so this pass discharges the handed-over 271-01 row along
  with its own.
- `.planning/REQUIREMENTS.md`, `docs/MINDRIANOS-PRD.md`, `docs/2026-08-20-gate0-queries.cypher`
  and `prototypes/` were left untouched as instructed; none appear in any commit from this plan.

## Verification Run

| Check | Expected | Result |
|---|---|---|
| `node tests/test-271-plugin-path-anchoring.cjs` | exit 0, 6 arms | exit 0, 19 assertions, 19 passed 0 failed |
| ALLOWLIST reason non-empty (module export probe) | exit 0 | exit 0 |
| `--report` violation total | 134 post-ruling | **134** (`allowlisted: 5`) |
| `grep -c 'radar' scripts/check-plugin-path-anchoring.cjs` | >= 1 | 12 |
| `grep -c 'PENDING' 271-AUDIT.md` | 0 | 0 |
| `271-AUDIT.md` contains literal `option-d` | >= 1 | 10 |
| `node scripts/check-plugin-path-anchoring.cjs --check` | exit 1 (RED by design) | exit 1 |
| all 5 radar sites tagged | ALLOWLISTED | all 5: `[OK ALLOWLISTED]` |
| dangling followup id | throws | throws with a recovery message |
| resolvable followup id | accepted | accepted |
| code-to-record reason parity (machine-compared) | identical | **true** |
| `bash tests/run-all-271.sh` | PASS=3 FAIL=1 | PASS=3 FAIL=1 (arm 2 RED by design until 271-04) |
| `git diff --stat` | exactly 2 files | 2 files, 182 insertions, 9 deletions |
| shipped markdown modified | 0 | 0 (no commands/, skills/, agents/, pipelines/ file touched) |
| em-dashes in either changed file | 0 | 0 |
| commit deletions | none | none |

## Threat Model Outcomes

| Threat ID | Outcome |
|---|---|
| T-271-04 (anchoring a write site redirects it into the install cache) | MITIGATED. The site never reached a sed; it was gated behind a human ruling and is now permanently allowlisted with the redirect risk written into the entry. |
| T-271-05 (an allowlist entry with no traceable rationale) | MITIGATED, and strengthened. The reason is validator-enforced non-empty, quoted verbatim into the audit, and the parity between the two was machine-verified rather than asserted. The new followup referential check closes the adjacent hole: an entry can no longer defer a real defect onto no one. |

## Threat Flags

None. No file changed in this plan introduces a network endpoint, auth path, file access
pattern, or schema at a trust boundary. The only executable change is to a dev-time check
script that reads markdown and writes nothing.

## Known Stubs

None.

## Handoff to Plan 271-03

- The command sweep target is **94** sites across 45 files, not 99 across 46.
  `commands/radar.md` is excluded and the gate now enforces that exclusion.
- Do not anchor `commands/radar.md`. If a sweep script globs `commands/*.md`, it must skip
  that file explicitly; the allowlist suppresses the gate's verdict but will not undo a
  bad edit.
- `skills/radar/SKILL.md` is a generated mirror. Regeneration will keep it bare, which is
  correct and consistent with the ruling. Mirrors are excluded from the gate's skills
  surface, so this produces no violation.
- Plan 271-04's target is unchanged at 40 sites (14 skills + 17 agents + 9 pipelines).
- Plan 271-05 must register `FOLLOWUP-271-R1` into the ROADMAP alongside the
  bare-`scripts/` follow-up it already owns.

## Commits

| Commit | Type | Scope |
|---|---|---|
| `4061483e` | feat | the option-d ruling encoded in the gate plus audit section 4 resolved |

## Self-Check: PASSED

Both modified files verified present on disk with the claimed content. Commit `4061483e`
verified present in `git log`. The verbatim reason string was machine-compared between
`ALLOWLIST[0].reason` and the `271-AUDIT.md` blockquote and found identical after
whitespace normalization.
