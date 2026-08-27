---
status: resolved-partial
kind: rca
trigger: "phase-134-python-elimination-false-complete"
issue_id: ""
severity: blocker
surfaces: [cli, desktop, cowork]
brain_mode: not_applicable
canon_parts: [6, 7]
created: 2026-08-27T00:00:00Z
updated: 2026-08-27T21:45:00Z
---

## Resolved-Partial (goal-directed phase-sweep session, 2026-08-27T21:45Z)

**Change 1 only.** Committed after independent re-verification (self, not a live
navigator sitting): re-ran `node tests/test-hsi-preflight-remediation.cjs` (3/3 PASS),
`bash tests/test-127.2-03-rs-engine-silent-failure-fixes.sh` (8/8), `node
tests/test-reverse-salient-agent.cjs` (25/25), manual `python3 scripts/compute-hsi.py`
and `python3 scripts/rs-engine.py --mode internal` smoke (both clear imports; the
pre-existing unrelated `KeyError: 'embedding_model'` still present as documented,
untouched). `scripts/doctor.cjs`'s `--fix` arm (files_changed below) was ALREADY
present in the working tree at commit `62b18c41` (`feat(265-23): build MCP surface
doctor organ...`) -- bundled into an unrelated-sounding commit message, a symptom of
this session's shared-working-tree chaos, not a defect in the fix itself. No separate
action needed for it.

**Change 2 (the actual Phase 134 objective -- full CJS port, eliminating Python
entirely) and Change 3 (I001 auto-stub visibility) are explicitly NOT closed by this
resolution.** This RCA's severity is `blocker` because Phase 134 (8 plans) reads as
COMPLETE in tracking while the real work was never done -- that false-complete status
is still live in `.planning/phases/134-.../STATE.md`/`ROADMAP.md` as of this commit.
Flagging this to the navigator rather than silently re-opening or re-scoping an entire
phase from inside an unrelated goal-directed sweep (265-271) -- Change 2 is real,
undone, roadmap-scale work (an actual `@huggingface/transformers` CJS port of
`scripts/rs_*.py`), not a follow-up commit. Do not mark this `status: resolved`
(closed) until Change 2 or an explicit navigator decision to defer it further lands.

**UPDATE (2026-08-27, same session, later):** navigator asked directly whether this
finding had been registered as a tracked phase. It had not been -- registered now as
**Phase 272: Phase 134 Real Remediation -- CJS Python Elimination Port**
(`.planning/ROADMAP.md`, end of file; directory
`.planning/phases/272-phase-134-real-remediation-cjs-python-elimination-port/`,
not yet planned). Change 2 and Change 3 above are Phase 272's actual scope. This RCA
stays open at `status: resolved-partial` -- Phase 272 is the tracking home for the
real fix, this file remains the root-cause record.

## Current Focus

status: Change 1 IMPLEMENTED and self-verified (unit test + regression suite + manual
smoke). Awaiting human verification before commit/archive per debug protocol. Change 2
(full CJS port) explicitly OUT OF SCOPE this session, per navigator. Change 3 (I001
auto-stub visibility) NOT attempted this session -- navigator SECOND PRIORITY, deferred
to a follow-up session rather than diluting Change 1's verification (see Resolution).

reasoning_checkpoint:
  hypothesis: "The 8 commands fail for users without Python because scripts/compute-hsi.py
    and scripts/rs-engine.py (the actual entry points for /mos:act, /mos:mos-reason, and
    /mos:find-bottlenecks) only printed a manual 'pip install' instruction and exited 1 on
    missing numpy/sklearn/sentence-transformers/requests, instead of calling the
    already-shipped scripts/lib/ensure_ml_deps.py auto-installer that 6 sibling whitespace
    scripts already used successfully (since v1.10.9, LAWRENCE-001)."
  confirming_evidence:
    - "grep -rln ensure_ml_deps scripts/ showed compute-bayesian-surprise.py,
      compute-external-whitespace.py, compute-whitespace-gaps.py, fetch-brain-baseline.py,
      compute-element-novelty.py, compute-whitespace-embeddings.py already wired;
      compute-hsi.py and rs-engine.py were absent despite the identical
      guarded-import-then-print-then-exit(1) pattern."
    - "Direct read of scripts/compute-hsi.py (pre-fix, lines 36-50) and scripts/rs-engine.py
      (pre-fix, lines 53-62): both hard-exit on ImportError with only a printed pip
      instruction, no install attempt."
    - "commands/find-bottlenecks.md named only /mos:doctor --check-rs-engine (probe-only,
      scripts/doctor.cjs runCheckRsEngine) as the remediation path pre-fix; doctor.cjs never
      had a --fix arm for --check-rs-engine despite the --fix convention already existing
      for --drift and --graph-derive-health elsewhere in the same file."
    - "REFINEMENT of original evidence: diagnostics.md's 4-script Python cascade
      (compute-disruption-index.py, compute-blindspot-mass.py, compute-bayesian-surprise.py,
      compute-element-novelty.py) -- 2 need no ML deps (stdlib only) and 2 were already
      ensure_ml_deps-wired, so diagnostics.md was NOT actually broken by this root cause."
    - "REFINEMENT: root-cause.md, systems-thinking.md, value-proposition.md, new-project.md
      carry zero direct Python invocation. Their only hit on the original grep was the
      substring 'find-bottlenecks' inside a suggested-next-command string, not an actual
      dependency. The real direct-Python surface among the 8 named commands is narrower:
      find-bottlenecks (rs-engine.py), act + mos-reason (compute-hsi.py), and diagnostics
      (partially, already self-healing)."
  falsification_test: "If compute-hsi.py and rs-engine.py already called ensure_ml_deps (or
    an equivalent auto-installer) before their guarded imports, this hypothesis would be
    false. Direct file reads (pre-fix) confirmed they did not."
  fix_rationale: "Wires the two unguarded entry points into the SAME already-proven
    auto-install mechanism the other 6 scripts use -- no new remediation logic invented, so
    no new failure surface introduced. Root cause was inconsistent application of an
    existing fix, not a missing capability; the fix completes that application. Also adds
    --fix to the CJS-side doctor.cjs --check-rs-engine probe (matching the --drift /
    --graph-derive-health --fix convention already in the file) as a second, complementary
    remediation surface, since the navigator explicitly named that file as the check to
    fix."
  blind_spots: "Real network pip installs were not end-to-end tested (sandboxed dev
    environment has all deps pre-installed; PyPI reachability uncertain) -- verification
    relies on (a) a fake-python fixture proving the doctor.cjs --fix control flow is
    correct, and (b) ensure_ml_deps.py's own prior production track record (shipped
    v1.10.9) rather than a fresh end-to-end network proof for compute-hsi.py/rs-engine.py
    specifically. Also found, and deliberately did NOT fix, a pre-existing unrelated
    KeyError('embedding_model') crash in rs-engine.py's main() -- confirmed present on
    unmodified code via git stash A/B test; out of scope for Change 1, not investigated
    further, flagged here for a future session."

next_action: Change 1 complete. Present CHECKPOINT REACHED for human verification (run
/mos:find-bottlenecks or /mos:act on a room with a real machine missing Python ML deps, or
trust the fake-python integration test as sufficient proxy). On confirmation: commit code
changes, then run archive_session (move debug file to resolved/, append knowledge-base.md
summary block, commit planning docs).

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ working tree, repo
  `/home/jsagi/dev/MindrianOS-Plugin` (11 commits ahead of `origin/main`, plus unrelated
  in-flight uncommitted work already flagged in the sibling file-meeting RCA -- not
  touched here either)
- **WIRE claims probe against:** none. Pure local filesystem/code inspection; no Brain
  wire, no live API calls made to reach this finding.
- **Date of audit:** 2026-08-27
- **Re-verification rule:** re-run the `find` + `grep` commands above against
  `origin/main` HEAD before treating this as still-true after any commit lands claiming
  to fix it -- this exact class of false-positive (tracking says done, code says
  otherwise) is the subject of the finding itself.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: installed cache 2.0.0-beta.11 / dev working tree ahead of that
- Reported by: live navigator session, surfaced while researching an unrelated
  meeting-filing capability upgrade and checking Canon Part 7 reuse-before-build against
  `SEED-023`, which led to `SEED-013` / Phase 134 as adjacent architecture
- Date first observed: 2026-08-27
- Related debug sessions:
  - `.planning/debug/python-requirements-orphan-deps-audit.md` (status: gathering,
    opened 2026-05-23, never advanced -- narrower scope, audits Python-import-vs-
    requirements-file hygiene; SEED-013 names it a PREREQUISITE to the port, not
    evidence the port itself happened. This RCA is broader and more severe: the port
    was never attempted, not just under-audited.)
  - `.planning/debug/resolved/windows-tester-find-bottlenecks-silent-failure-qa-sweep.md`
    (the original 2026-05-23 tester incident that scaffolded Phase 134; its hotfix
    -- the loud pre-flight message -- did ship in beta.30 and is confirmed still
    present; only the STRUCTURAL fix that hotfix was meant to precede never happened)

## Problem Statement

Phase 134 (source: `SEED-013`) was scoped to eliminate Python from the user-machine
surface entirely, replacing `scripts/*.py` HSI/reverse-salient analyzers with in-process
`@huggingface/transformers`-based CJS modules. Planning tracking shows all 8 of its plans
as executed. The actual replacement code does not exist anywhere in the repo, and the
Python scripts it was meant to delete are all still the live implementation.

## Symptoms

expected: 8 commands (`/mos:find-bottlenecks`, `/mos:diagnostics`, `/mos:root-cause`,
`/mos:systems-thinking`, `/mos:value-proposition`, `/mos:new-project`, `/mos:act`,
`/mos:mos-reason`) run their analyzer logic in-process via Node, no Python required on
the user's machine, per Phase 134's stated objective.

actual: all 8 commands' source markdown (or, for the reverse-salient family, the agent
module `lib/agents/reverse-salient-agent.cjs`) still directly reference or import the
original Python modules (`scripts/compute-hsi.py`, `compute-bayesian-surprise.py`,
`compute-whitespace-gaps.py`, `compute_topic_forest.py`, `compute-external-whitespace.py`,
`compute-blindspot-mass.py`, `discover-analogy-whitespace.py`, `consolidate-pinecone.py`,
`sealed-walker.py`; `lib/core/rs_math.py`, `rs_corpus.py`, `rs_hybrid.py`, `rs_cache.py`).
`requirements-hsi.txt` (sentence-transformers/PyTorch ~2GB, numpy, sklearn, requests)
still exists at repo root and is still required.

errors: not a thrown error at the code level -- a false-positive completion record.
`.planning/phases/134-.../134-01-SUMMARY.md` and `134-08-SUMMARY.md` (both checked
directly) read verbatim: "kind: summary-stub ... status: stub ... This is a placeholder
SUMMARY generated to close an I001 missing-SUMMARY drift finding. The plan executed but
no SUMMARY was recorded." An auto-generated drift-closure stub is not execution evidence.

reproduction:
1. `find lib/core -iname 'rs-engine.cjs' -o -iname 'rs-math.cjs' -o -iname 'hsi-*.cjs'`
   in the dev repo -- only `lib/core/hsi-to-graph.test.cjs` appears, no implementation
   file it could be testing.
2. `grep -rl "compute-hsi.py\|rs_engine\|find-bottlenecks" commands/ lib/` -- hits land
   in `commands/find-bottlenecks.md` and seven sibling command files, plus
   `lib/core/problem-type-router.cjs`, all still pointing at the `.py` scripts.
3. On a machine without Python + `pip install -r requirements-hsi.txt` already done,
   running any of the 8 commands fails the pre-flight Python-availability check
   (beta.30 hotfix, confirmed still present and still the ONLY mitigation) and refuses
   to run the analyzer.
started: Phase 134 was scaffolded 2026-05-23, its 8 plans show execution timestamps in
tracking, but no commit in `git log -- lib/core/rs-engine.cjs` (file never existed) can
mark a real completion date -- the false-complete status has been standing since
whenever the plans were marked done, unnoticed until this session.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (the underlying command markdown and agent
  module are surface-agnostic; wherever these 8 commands are invoked, the Python
  dependency applies)
- Affected commands: `/mos:find-bottlenecks`, `/mos:diagnostics`, `/mos:root-cause`,
  `/mos:systems-thinking`, `/mos:value-proposition`, `/mos:new-project`, `/mos:act`,
  `/mos:mos-reason` -- 8 of the plugin's documented commands
- Affected users: any install without Python + the HSI pip requirements already present.
  Per SEED-013's own tester evidence, this skews heavily Windows, and the actual "did the
  pre-flight message get testers unstuck" signal was never collected (SEED-013 explicitly
  says it stayed dormant waiting on that signal, which never surfaced because the
  eliminate-Python work it was gating was itself never done)
- Version range: from Phase 134's (false) completion in tracking through the current
  installed 2.0.0-beta.11 and the ahead-of-origin dev working tree -- i.e., every shipped
  version to date
- Severity: blocker, per navigator -- 8 documented commands are non-functional out of
  the box for a meaningful share of users, with the plugin's own planning record
  incorrectly showing this as already fixed, which has suppressed any further work on it
- Blast radius: any other phase or seed that read Phase 134's tracked status and assumed
  the Python surface was gone (SEED-023's own remainder-scoping tonight is one example of
  a near-miss on a *different*, unrelated assumption -- not affected here, but the same
  class of risk: trusting a status field instead of the working tree)

## Eliminated

- hypothesis: "The CJS files exist somewhere in the repo under different names than the
  design doc specified, and the finding is a naming mismatch, not a missing-code issue."
  evidence: grepped `lib/` broadly for `@huggingface/transformers` usage (confirmed real
  usage exists, but only inside `lib/core/eureka/*` and `lib/core/correlation.cjs` --
  none of those modules are invoked by, or referenced from, any of the 8 affected
  commands or the reverse-salient agent. The real usage is unrelated to this gap, not a
  renamed version of it.
  timestamp: 2026-08-27T00:00:00Z

## Evidence

- timestamp: 2026-08-27T00:00:00Z
  checked: `find /home/jsagi/dev/MindrianOS-Plugin/lib/core -iname 'rs-engine.cjs' -o
  -iname 'rs-math.cjs' -o -iname 'hsi-*.cjs'`
  found: only `lib/core/hsi-to-graph.test.cjs`; no implementation file matching any name
  in Phase 134's own "Replace surface" design table exists.
  implication: the phase's stated Objective was never implemented.

- timestamp: 2026-08-27T00:00:00Z
  checked: `.planning/phases/134-.../134-01-SUMMARY.md` and `134-08-SUMMARY.md`, full
  file contents
  found: both are `kind: summary-stub`, `status: stub`, generated by
  "`doctor --drift --fix` (I001 auto-stub)", explicitly stating "The plan executed but no
  SUMMARY was recorded. Replace this stub with the real execution record."
  implication: the "executed" claim these stubs paper over was never independently
  verified by anything the repo's own tooling produced -- the drift-fixer closed a
  missing-file finding, not a missing-work finding, and the two got conflated.

- timestamp: 2026-08-27T00:00:00Z
  checked: `grep -rl "compute-hsi.py|rs_engine|find-bottlenecks" commands/ lib/`
  found: live hits in `commands/find-bottlenecks.md`, `commands/diagnostics.md`,
  `commands/root-cause.md`, `commands/systems-thinking.md`,
  `commands/value-proposition.md`, `commands/new-project.md`, `commands/act.md`,
  `commands/mos-reason.md`, and `lib/core/problem-type-router.cjs`.
  implication: every one of the 8 commands Phase 134 was scoped to fix still has a live,
  current-day dependency on the Python scripts it was supposed to delete.

- timestamp: 2026-08-27T00:00:00Z
  checked: `grep -rln "requirements-hsi|python.*not.*install|pip install" lib/ scripts/`
  found: `lib/core/rs_corpus.py`, `rs_hybrid.py`, `rs_cache.py`,
  `lib/agents/reverse-salient-agent.cjs`, and all 9 named `scripts/*.py` files still
  present and referenced.
  implication: `requirements-hsi.txt` (PyTorch ~2GB + numpy + sklearn + requests) is
  still a real, live, required dependency for these commands today, contrary to what
  Phase 134's tracked completion implies.

- timestamp: 2026-08-27T00:00:00Z
  checked: `grep -rln "ensure_ml_deps" scripts/*.py`, then read `scripts/lib/ensure_ml_deps.py`
  in full.
  found: an auto-install helper (`ensure(pip_names)`) already exists, already ships (v1.10.9,
  plan 85-10, LAWRENCE-001), and is already wired into 6 scripts
  (compute-bayesian-surprise.py, compute-external-whitespace.py, compute-whitespace-gaps.py,
  fetch-brain-baseline.py, compute-element-novelty.py, compute-whitespace-embeddings.py).
  `scripts/compute-hsi.py` and `scripts/rs-engine.py` -- the two scripts that directly gate
  `/mos:act`, `/mos:mos-reason`, and `/mos:find-bottlenecks` -- were NOT on that list despite
  having the identical guarded-import pattern.
  implication: the "existing Python pre-flight check" the navigator asked to make
  self-remediating already exists and already works; it was just inconsistently applied.
  Minimal, non-scope-creepy fix: wire the two missing entry points into it.

- timestamp: 2026-08-27T00:00:00Z
  checked: which of the 8 named commands actually invoke Python directly (grep + direct read
  of commands/root-cause.md, systems-thinking.md, value-proposition.md, new-project.md,
  diagnostics.md, act.md, mos-reason.md, find-bottlenecks.md).
  found: only find-bottlenecks.md (rs-engine.py), act.md + mos-reason.md (compute-hsi.py),
  and diagnostics.md (4 scripts via diagnostics-command.cjs, 2 of which need no ML deps and
  2 of which were already ensure_ml_deps-wired) have a real Python dependency. root-cause.md,
  systems-thinking.md, value-proposition.md, new-project.md have none -- their hit on the
  original evidence grep was the substring "find-bottlenecks" inside a next-command
  suggestion string, not an invocation.
  implication: refines (does not overturn) the original Problem Statement -- the real
  direct-Python blast radius among the 8 commands is narrower than "all 8 currently broken".
  diagnostics.md was already partially self-healing before this session's fix.

- timestamp: 2026-08-27T00:00:00Z
  checked: `scripts/doctor.cjs` for the exact site of "the beta.30 hotfix" pre-flight check
  the navigator referenced (searched for `requirements-hsi`, `pip install`, `--check-rs-engine`).
  found: `runCheckRsEngine()` (Phase 127.2-03 Task 2, Findings F1+F7), dispatched via
  `doctor --check-rs-engine`. Probe-only pre-fix: detects missing `requests`/`numpy`
  (critical) and `sentence_transformers`/`sklearn` (umbrella), prints a manual pip-install
  line, never attempts remediation. `doctor.cjs` already has an established `--fix`
  composition convention elsewhere (`--drift --fix`, `--graph-derive-health --fix` /
  `--heal-room` sugar).
  implication: confirmed this IS the file the navigator meant (not
  problem-type-router.cjs, which has no Python-availability logic at all). Fix: add a
  `--fix` arm to `runCheckRsEngine` following the file's own existing convention.

- timestamp: 2026-08-27T00:00:00Z
  checked: ran `python3 scripts/rs-engine.py --mode internal --room <smoke room>` before and
  after the fix (git stash A/B), and `python3 scripts/compute-hsi.py <smoke room>` after the
  fix.
  found: compute-hsi.py runs clean end-to-end post-fix (no import errors; reaches real
  business logic). rs-engine.py hits `KeyError: 'embedding_model'` in `main()` on BOTH the
  pre-fix and post-fix code (git stash confirmed byte-identical failure, different line
  numbers only because of the lines this fix added above it) -- a pre-existing, unrelated
  bug, not caused by or fixed by this change.
  implication: the ensure_ml_deps wiring itself is correct and does not regress either
  script's import-time behavior. The KeyError is a separate, real, still-open bug --
  flagged, not fixed (out of Change 1 scope; navigator did not ask for it; no evidence it's
  related to the Python-elimination false-complete finding).

- timestamp: 2026-08-27T00:00:00Z
  checked: `node tests/test-hsi-preflight-remediation.cjs` run against pre-fix
  `scripts/doctor.cjs` (via `git stash push -- scripts/doctor.cjs`) and post-fix.
  found: all 3 subtests FAIL pre-fix (`remediation.attempted` is `undefined`, meaning the
  field doesn't exist yet) and all 3 PASS post-fix. Existing regression suites
  (`tests/test-127.2-03-rs-engine-silent-failure-fixes.sh`, `tests/test-reverse-salient-agent.cjs`)
  both still fully pass post-fix (8/8 and 25/25 respectively).
  implication: Test 1 (per this file's own Tests-to-Add spec) correctly guards Change 1 --
  proven RED before the fix, GREEN after -- and no regression was introduced in the adjacent
  rs-engine agent surface.

## Technical Root Cause

- Site: `.planning/phases/134-cjs-port-of-python-analyzers-via-xenova-transformers-elimina/`
  (tracking artifact) vs. `commands/*.md` + `lib/agents/reverse-salient-agent.cjs` +
  `lib/core/rs_*.py` + `scripts/*.py` (actual runtime code, unchanged)
- Cause: a process gap, not a code defect in the traditional sense -- `doctor --drift --fix`
  auto-generated SUMMARY stubs to close a documentation-completeness drift finding
  (I001: every PLAN.md should have a matching SUMMARY.md). That auto-fix satisfied the
  drift checker's structural rule ("a SUMMARY file exists") without verifying the
  underlying claim the SUMMARY is supposed to attest to ("the plan's code was actually
  written"). The phase's status field and plan count subsequently read as "done" to any
  human or agent trusting tracking metadata over the working tree.
- Why it surfaces now: SEED-013 itself was already stale by its own admission (its
  frontmatter carries a 2026-07-14 self-correction: "this file previously claimed
  'graduated (Phase 134)' -- verified FALSE... Real status is still open, not
  graduated"). That correction fixed the SEED's own status field but the underlying
  Phase 134 plan/summary tracking was never re-audited at the same time, so the same
  false-complete signal persisted one layer down, in the phase artifacts the seed
  itself points to.

## Required Code Changes

- Change 1 (NEAR-TERM, navigator-prioritized -- make Python work reliably, ship first):
  - Location: the pre-flight Python-availability check that currently gates all 8
    commands (the beta.30 hotfix path; exact file needs pinpointing in the fix session --
    likely near `lib/core/problem-type-router.cjs` or a shared pre-flight helper it calls)
  - Current behavior: detects missing Python/pip deps, refuses to run, prints an
    actionable but manual fix instruction (`pip install -r requirements-hsi.txt`)
  - Required behavior: attempt actual remediation before refusing -- e.g., detect a
    working `python3`/`pip` on PATH and offer (or auto-run, with consent) the install
    command directly from the command's own flow, rather than requiring the user to
    leave the session, run a manual command, and retry. A one-command, in-session fix
    beats a correct error message the user still has to act on by hand.
  - Short-term patch: this IS the short-term patch -- no deeper fix is required to
    satisfy "must work immediately" if remediation is made automatic/one-step.
  - Long-term fix: Change 2 below.
- Change 2 (LONG-TERM, per SEED-013 / Phase 134's original design, not blocking Change 1):
  - Location: `scripts/*.py`, `lib/core/rs_*.py` -> new `lib/core/rs-engine.cjs`,
    `rs-math.cjs`, `hsi-*.cjs` per Phase 134's own design table
  - Current behavior: Python, per the design doc's "Replace surface" table
  - Required behavior: `@huggingface/transformers` (already a project dependency,
    already proven safe for cross-platform vendoring per the phase's own 2026-06-01
    re-baseline note) running `Xenova/multilingual-e5-large` in-process; pure-JS math
    port for cosine similarity, LSA approximation, HSI scoring
  - Short-term patch: n/a, this is inherently the full fix
  - Long-term fix: this. Re-open Phase 134 as real (non-stub) plan work; do not mark
    plans executed again without a real SUMMARY documenting what was actually built and
    tested.
- Change 3 (process fix, prevents recurrence of the false-complete pattern itself):
  - Location: `doctor --drift --fix`'s I001 auto-stub behavior
  - Current behavior: silently satisfies "a SUMMARY file exists" by writing a stub that
    says "no verification happened," which reads identically to a real completion in
    any status rollup that only checks file presence
  - Required behavior: an auto-stubbed SUMMARY should propagate a visible
    "UNVERIFIED"/"NEEDS REVIEW" flag into the phase's own rollup status (ROADMAP.md,
    MILESTONES.md, any `--acceptance` check), not silently read as equivalent to a real
    SUMMARY once the drift finding closes

## Tests to Add or Update

- Test 1 (guards Change 1):
  - Type: integration
  - Location: new, e.g. `tests/test-hsi-preflight-remediation.cjs`
  - Given: a simulated environment with no Python / missing pip deps
  - When: one of the 8 affected commands' pre-flight check runs
  - Then: it offers or performs remediation in-session, not just a printed manual
    instruction; command succeeds after remediation without leaving the session
- Test 2 (guards Change 3, prevents this exact recurrence):
  - Type: unit
  - Location: extend `doctor.cjs`'s own test suite (wherever I001 auto-stub logic lives)
  - Given: a plan with an auto-stubbed SUMMARY
  - When: `doctor --acceptance` or the ROADMAP/MILESTONES rollup runs
  - Then: the phase's status surfaces as unverified/needs-review, not as clean "executed"

## Non-Code Follow-ups

- CHANGELOG.md: none yet -- nothing has shipped for this finding.
- Release lockstep: applies once Change 1 and/or Change 2 land; same standing rule as
  every other finding tonight -- not live until committed, released, and picked up.
- Canon: Part 6 (dog-fooding -- the plugin's own tracking told a false story about its
  own state) and Part 7 (reuse-before-build -- other seeds/phases reading Phase 134's
  status as ground truth is exactly the failure mode Part 7 exists to prevent) both
  apply; no canon_parts amendment needed, just honoring the existing ones.
- knowledge-base.md: add a summary block on resolve, explicitly naming the
  auto-stub-reads-as-complete pattern so `gsd-debugger` can recognize it as a known
  hypothesis class in future sessions, not just this one instance.
- Cross-link: append a note to `.planning/debug/python-requirements-orphan-deps-audit.md`
  (still status: gathering, stale since 2026-05-23) pointing here, since this finding
  supersedes part of its premise (it was auditing hygiene on the assumption the port was
  in progress; the port never started).
- SEED-013's own frontmatter should get a second correction pass (its 2026-07-14
  self-correction fixed the seed's status field but not Phase 134's own plan/summary
  tracking one layer down) -- same root pattern, needs the same fix applied one level
  deeper.

## Resolution

root_cause: TWO-PART, CONFIRMED.
(1) Process gap (unchanged from prior session): `doctor --drift --fix`'s I001 auto-stub
satisfies a structural "a SUMMARY file exists" drift check without verifying the
underlying work claim, so Phase 134's 8 plans read as "executed" in tracking despite the
CJS port never happening. This is the mechanism confirmed, not a plan being hand-marked
executed by a human/agent -- both 134-01-SUMMARY.md and 134-08-SUMMARY.md carry
`generated_by: doctor --drift --fix (I001 auto-stub)` verbatim.
(2) Functional gap this session's fix addresses: the Python entry points that actually
gate the affected commands (`scripts/compute-hsi.py` for /mos:act + /mos:mos-reason,
`scripts/rs-engine.py` for /mos:find-bottlenecks) never called the plugin's own
already-shipped auto-remediation helper (`scripts/lib/ensure_ml_deps.py`, live since
v1.10.9), even though 6 sibling whitespace scripts already did. They only printed a
manual `pip install -r requirements-hsi.txt` instruction and exited 1. Refinement: the
functional gap does NOT actually span all 8 commands as originally evidenced --
root-cause.md, systems-thinking.md, value-proposition.md, and new-project.md have zero
direct Python dependency (their grep hit was a next-command suggestion string, not an
invocation), and diagnostics.md's Python cascade was already partially self-healing.

fix: Change 1 (SHIPPED this session; Change 2 explicitly out of scope; Change 3 deferred
-- see below):
  - `scripts/compute-hsi.py`: added `ensure(["numpy", "scikit-learn",
    "sentence-transformers"])` (via `scripts/lib/ensure_ml_deps.py`) before its guarded
    imports, matching the exact pattern already used by 6 sibling scripts.
  - `scripts/rs-engine.py`: added `ensure(["numpy", "requests"])` before its guarded
    numpy import and before `lib/core/rs_corpus.py` is imported later in the file
    (`requests` is rs_corpus.py's transitive dep and was the actual root cause of the
    original Windows tester 2026-05-23 silent-failure class).
  - `scripts/doctor.cjs`'s `runCheckRsEngine()` (the `--check-rs-engine` probe, the
    "beta.30 hotfix" the navigator referenced): added a `--fix` arm (composes as
    `doctor --check-rs-engine --fix`, matching the file's existing `--drift --fix` /
    `--graph-derive-health --fix` convention) that runs `python -m pip install --user`
    for whatever is missing, re-probes, and reports `remediation: {attempted, installed,
    resolved, still_missing, stderr_tail}` in the JSON payload. Without `--fix`, behavior
    is unchanged (probe-only).
  - `commands/find-bottlenecks.md`: updated the analyzer-failure guidance to point at
    `/mos:doctor --check-rs-engine --fix` (auto-remediates in-session) instead of a bare
    manual pip-install instruction, and noted that rs-engine.py now self-installs so this
    path should fire rarely.
  - Change 2 (full CJS port via @huggingface/transformers, SEED-013/Phase 134 proper):
    NOT attempted, per explicit navigator instruction. Still open.
  - Change 3 (I001 auto-stub visibility into rollup status): NOT attempted this session.
    Investigated the mechanism (`lib/core/drift-baseline.cjs`'s `stubMissingSummary()`,
    wired from `scripts/doctor.cjs`'s `--drift --fix` heal arm) enough to confirm where a
    fix would land, but did not implement it -- navigator marked this SECOND PRIORITY,
    "only if time allows... do not let it block or dilute Change 1," and a correct fix
    needs its own scoped session (find the ROADMAP/MILESTONES/--acceptance rollup
    consumer(s), decide the UNVERIFIED/NEEDS-REVIEW propagation shape, write Test 2).
    Deferred, not blocked.

verification: `node tests/test-hsi-preflight-remediation.cjs` -- 3/3 PASS post-fix, all 3
FAIL pre-fix (proven via `git stash` A/B on `scripts/doctor.cjs`), confirming the test
actually guards the change. Existing regression suites unaffected:
`bash tests/test-127.2-03-rs-engine-silent-failure-fixes.sh` (8/8 PASS) and
`node tests/test-reverse-salient-agent.cjs` (25/25 PASS). Manual smoke:
`python3 scripts/compute-hsi.py <room>` and `python3 scripts/rs-engine.py --mode internal
--room <room>` both run past all imports cleanly post-fix (pre-existing, unrelated
`KeyError: 'embedding_model'` in rs-engine.py's `main()` confirmed present on unmodified
code too, out of scope, not fixed). Real network pip-install path not end-to-end tested
(sandboxed dev environment; see reasoning_checkpoint.blind_spots above) -- this is the
open item for human verification below.

files_changed:
  - `scripts/compute-hsi.py` (added ensure_ml_deps wiring)
  - `scripts/rs-engine.py` (added ensure_ml_deps wiring)
  - `scripts/doctor.cjs` (added `--fix` arm to `runCheckRsEngine`)
  - `commands/find-bottlenecks.md` (updated remediation guidance)
  - `tests/test-hsi-preflight-remediation.cjs` (new, Test 1)
  - `tests/fixtures/check-rs-engine-fake-python/fake-python.cjs` (new, test fixture)
  - `.planning/debug/python-requirements-orphan-deps-audit.md` (cross-link addendum,
    non-code)

commits: PENDING -- awaiting human verification per debug protocol (checkpoint below);
will commit code + this file's move to resolved/ + knowledge-base.md entry together once
confirmed.
