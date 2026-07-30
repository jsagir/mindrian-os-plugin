---
status: gathering
kind: qa-sweep
trigger: "untracked-planning-verification-files-gitignore-blindspot"
issue_id: ""
severity: low
surfaces: [cli]
brain_mode: local-only
canon_parts: []
created: 2026-07-31T00:50:00Z
updated: 2026-07-31T00:50:00Z
---

## Current Focus

hypothesis: this is an orchestrator-discipline gap, not a tool bug -- `.planning/*` is
gitignored except `.planning/debug/`, so any `VERIFICATION.md` (or `SUMMARY.md`, or any
other phase artifact) that a session writes to disk but never explicitly `git add -f`s
stays invisible to plain `git status`/`git diff --stat` forever, surviving only as bytes
on this one machine.
test: `git ls-files <path>` against every `*VERIFICATION.md` under `.planning/phases/`.
expecting: a handful of hits scattered across the project's history, not a single
code-level root cause -- confirmed, see Evidence.
next_action: none queued. Filed as a QA-sweep finding for future reference, not opened
as an active `/gsd:debug` investigation -- see Non-Code Follow-ups for the deliberate
scope decision.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: v1.16.0-in-progress (pre-cut, Gate 0 still open)
- Reported by: orchestrator, mid-session while closing Phase 244 and Phase 240.1
- Date first observed: 2026-07-30
- Related debug sessions: none

## Problem Statement

Two DIFFERENT write paths both leave `.planning/phases/<N>/*.md` artifacts sitting on
disk as gitignored-and-untracked files unless a human explicitly `git add -f`s them
afterward. A phase or plan can be narrated as "CLOSED" / "verified" in STATE.md while its
own evidence file (the SUMMARY, or the VERIFICATION report) never actually entered git
history.

## Symptoms

expected: every artifact a closed, verified phase cites as its evidence
(`<N>-SUMMARY.md`, `VERIFICATION.md`) is committed and would survive a fresh clone.
actual: two concrete instances found and fixed live this session, plus a wide pre-existing
population found by a repo-wide sweep:
  1. `.planning/phases/240.1-context-layer-drift-detection/240.1-03-SUMMARY.md` existed on
     disk (16014 bytes, real content, matching its own production commits) but
     `git ls-files` returned nothing for it. Root cause: it survived only as the byte-copy
     `gsd-tools.cjs worktree cleanup-wave`'s `rescueSummaryArtifacts()` helper makes to
     unblock a dirty-worktree check during a worktree merge -- that helper calls
     `copyFileSync`, never `git add`. Fixed live: `git add -f` + commit `e2cc3896`.
  2. `.planning/phases/240.1-context-layer-drift-detection/VERIFICATION.md` and
     `.planning/phases/244-semantic-trigger-tier/VERIFICATION.md`, both written directly
     to the main tree by a `gsd-verifier` agent dispatched WITHOUT worktree isolation
     (verifiers only read + write one report file, so no worktree was used). Root cause
     here is different: no rescue mechanism is involved at all -- the orchestrator (this
     session) simply forgot to include the VERIFICATION.md path in the `--files` list of
     either phase's closure commit. Fixed live: `git add -f` + commit `5e2d2b0d`.
errors: none (silent -- `git status --short` shows nothing for a gitignored-and-untracked
  path, which is exactly what makes this class of gap invisible without an explicit sweep).
reproduction:
  1. Confirm `.planning/*` is gitignored except `.planning/debug/` (`.gitignore:79-80`).
  2. Write any file under `.planning/phases/<N>/` without `git add -f`.
  3. `git status --short <path>` returns nothing (not even `??`) because it is ignored,
     not merely untracked.
started: not a new defect -- the repo-wide sweep below shows the pattern goes back to at
  least Phase 104.1, long before this session.

## Scope and Impact

- Affected surfaces: cli only (this is a git-hygiene issue in the planning substrate, not
  a runtime behavior any of the three Tri-Polar surfaces exercises).
- Affected commands: none directly -- no shipped code path reads `.planning/phases/*` at
  runtime; this only affects the project's own historical record, doctor/verify tooling
  that might glob `.planning/phases/**/*.md`, and `/gsd:debug`/`gsd-verifier` resumption
  that expects a SUMMARY/VERIFICATION file to be real repo history.
- Affected users: none end-user-facing. Internal-only (this repo's own dev-process
  record-keeping).
- Version range: not version-scoped -- a process gap present across many historical
  milestones, not introduced by any single release.
- Severity: low. No shipped behavior is wrong; the risk is purely "a fresh clone of this
  repo is missing some historical closure evidence," which affects future audits/resumes
  more than it affects anything currently running.
- Blast radius: a repo-wide `git ls-files` sweep of every `*VERIFICATION.md` under
  `.planning/phases/` (run 2026-07-30) found roughly two dozen additional untracked hits
  spanning Phases 104.1, 106, 108, 114, 115, 116, 120, 123, 125, 127, 128.1, 131, 135,
  140, 142, 143, 150, 173, 175, 179, 188, 194, 195, 196, plus one stray PLAN.md under
  Phase 94's `.archive-pre-qa-rescope/`. The large majority of historical VERIFICATION.md
  files (roughly 75 of ~100 checked) ARE correctly tracked, so this is intermittent
  orchestrator forgetfulness across many sessions, not a systemic tool failure that always
  fires.

## Eliminated

- hypothesis: a single code-level bug always drops these files.
  evidence: the two instances found and root-caused this session have TWO DIFFERENT
    mechanisms (worktree-rescue copy vs. a plain forgotten `--files` entry on a
    non-worktree write), and the repo-wide sweep shows most historical VERIFICATION.md
    files ARE tracked -- so this is not "the tool always drops it," it is "a human
    orchestrator sometimes forgets the `git add -f` step for a gitignored path."
  timestamp: 2026-07-31T00:50:00Z

## Evidence

- timestamp: 2026-07-31T00:35:00Z
  checked: `git ls-files .planning/phases/240.1-context-layer-drift-detection/240.1-03-SUMMARY.md`
  found: empty result despite the file existing on disk with real, matching content.
  implication: the `240.1-03` production commits (`82ff5f87`, `01c3ca19`, `33af19d9`) are
    real and correctly tracked; only the SUMMARY narrative document was missing.
- timestamp: 2026-07-31T00:40:00Z
  checked: `git ls-files` against `.planning/phases/{240.1-context-layer-drift-detection,
    244-semantic-trigger-tier}/VERIFICATION.md`
  found: both untracked, both real (18KB and 25KB respectively, written by the
    `gsd-verifier` agents dispatched earlier the same session).
  implication: same class of gap, different mechanism -- confirmed by the fact these two
    files were never inside any worktree at all.
- timestamp: 2026-07-31T00:44:00Z
  checked: `find .planning/phases -iname "*VERIFICATION*.md"` (~100 hits) cross-referenced
    against `git ls-files` for each.
  found: roughly two dozen additional untracked hits across historical phases (listed
    above under Scope and Impact), interleaved with roughly 75 correctly-tracked ones.
  implication: pre-existing, low-severity, project-wide pattern; not something this
    session introduced, not something worth mass-remediating under the current task
    (closing Phase 244).

## Technical Root Cause

Two independent sites, both downstream of the same structural fact
(`.planning/*` gitignored except `.planning/debug/`, per `.gitignore:79-80`):

- Site 1: `~/.claude/gsd-core/bin/lib/worktree-safety.cjs`, function
  `rescueSummaryArtifacts()` (around line 420-465 in the installed `gsd-core` copy).
  Cause: rescues `*SUMMARY.md` bytes with `copyFileSync` to unblock the dirty-worktree
  check in `executeWorktreeWaveCleanupPlan()`, but never calls `git add`. The file
  physically exists in the main tree post-merge but stays gitignored-and-untracked until
  a human notices and stages it.
  Why it surfaces now: this rescue path only fires when an executor leaves its own
  `<plan>-SUMMARY.md` uncommitted at merge time (by contract -- "the executor leaves it
  uncommitted, the orchestrator commits it") AND the orchestrator's subsequent tracking
  commit forgets to include that specific path in its `--files` list.
- Site 2: this session's own orchestration process, not a code site. Every phase-closure
  commit this session assembled its own `--files` list by hand; `VERIFICATION.md` was
  omitted from both the 240.1 and the 244 closure commits until a follow-up sweep caught
  it.

## Required Code Changes

None proposed. This RCA is filed as a QA-sweep finding, not an open `/gsd:debug`
investigation -- see Non-Code Follow-ups for why a code fix is deliberately deferred
rather than attempted here.

- Change (deferred, not made): `rescueSummaryArtifacts()` in `gsd-core`'s
  `worktree-safety.cjs` could call `git add -f` (or track and return the rescued paths
  for the caller to stage) after `copyFileSync` succeeds, closing Site 1 at the source.
  Deferred because `gsd-core` is an external tool (`~/.claude/gsd-core/`), the same
  ownership boundary Phase 240.1's CTXL-01 already drew around `.planning/STATE.md` --
  a fix belongs in that tool's own repo, not this one, and is out of scope for a
  MindrianOS-Plugin phase.

## Tests to Add or Update

None added. A future `/gsd:debug` session against this slug, if opened, should consider:
  - Type: integration
  - Location: a new `tests/test-gsd-tracking-integrity.sh` (does not exist yet)
  - Given: a phase directory declared CLOSED in `.planning/STATE.md`
  - When: `git ls-files` is run against every `*-SUMMARY.md` and `VERIFICATION.md` under
    that phase's directory
  - Then: every one returns a tracked path
  - Runner registration: would need its own aggregator, not an existing `run-all-*.sh`
    (this checks tracking-integrity across ALL phases, not one phase's own gate)

## Non-Code Follow-ups

- No CHANGELOG entry: this is dev-process record-keeping, not shipped behavior.
- No release lockstep: not a versioned artifact.
- No canon_parts declaration: does not touch a Canon concept.
- knowledge-base.md: not added yet -- this file stays `status: gathering` rather than
  `resolved` because the underlying `gsd-core` mechanism (Site 1) is still live and will
  keep producing the same class of gap on some future phase closure until it is fixed
  upstream, or until orchestrators adopt a standing habit of `git ls-files` sweeping every
  `.planning/phases/<N>/*.md` path before the final closure commit of a phase (the
  practice this session adopted only after finding instance 1).
- Docs / process note: recommend adding "sweep `git ls-files` over every artifact path
  named in the closing SUMMARY/VERIFICATION before the final tracking commit" as a
  standing step in `~/.claude/gsd-core/workflows/execute-plan.md`'s close-out guidance,
  or as a new doctor `--acceptance` point mirroring `eureka-fts-index-visible`'s shape
  (a read-only, check-only census of `.planning/phases/**/*.md` presence vs. git-tracking,
  scoped to phases STATE.md has already marked complete). Not built here -- flagged for a
  future phase to pick up if the pattern recurs enough to warrant automation.
- Historical remediation (the ~25 pre-existing hits): deliberately NOT bulk-fixed in this
  session. Each would need its own spot-check (confirm the file's content still matches
  what its phase actually shipped, since some of these phases are many months old and the
  file may have drifted from what a fresh read would produce) before a blind `git add -f`
  is safe. Scoped out as disproportionate to the task that surfaced this finding (closing
  Phase 244). Left in this RCA as a locatable list for whoever picks it up next.

## Resolution

root_cause: two independent orchestrator/tooling gaps around `.planning/*`'s gitignore
  boundary -- `gsd-core`'s worktree-rescue helper physically copies SUMMARY.md bytes
  without ever staging them, and this session's own hand-assembled closure commits
  omitted VERIFICATION.md from their `--files` lists. Neither is a functional bug in
  shipped MindrianOS behavior; both are dev-process record-keeping gaps.
fix: the two instances discovered live this session (240.1-03-SUMMARY.md,
  240.1/VERIFICATION.md, 244/VERIFICATION.md) were force-added and committed. The
  wider historical population (~25 files) and the upstream `gsd-core` mechanism were
  deliberately left unfixed -- see Non-Code Follow-ups.
verification: `git ls-files` re-run against all 3 fixed paths post-commit, all 3 now
  return their path (confirmed tracked).
files_changed:
  - .planning/phases/240.1-context-layer-drift-detection/240.1-03-SUMMARY.md (force-added)
  - .planning/phases/240.1-context-layer-drift-detection/VERIFICATION.md (force-added)
  - .planning/phases/244-semantic-trigger-tier/VERIFICATION.md (force-added)
commits: e2cc3896 (240.1-03-SUMMARY.md), 5e2d2b0d (both VERIFICATION.md files, bundled
  with Phase 244's own closure commit)
