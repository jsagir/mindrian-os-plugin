---
quick_id: 261002-byh
type: quick
mode: validate
description: retire release.sh Step 5.6 theo-resync dispatch per PROPOSED-STEP-5.6-RETIREMENT.md
navigator_ruling: 2026-10-02 (AskUserQuestion) APPROVED retiring Step 5.6
spec: .planning/quick/261002-5v9-release-cut-listener-release-sh-calls-th/PROPOSED-STEP-5.6-RETIREMENT.md
must_haves:
  truths:
    - scripts/release.sh has no Step 5.6 block, no theo-notify-gate.sh source/guard, no NO_THEO_NOTIFY var, no --no-theo-notify case arm or USAGE_BLOCK entry, no Step 5.6 dry-run listing lines
    - --no-theo-notify is now rejected as an unknown arg (exit 1)
    - scripts/release-lib/theo-notify-gate.sh is deleted
    - RULE 5 place 8 names Step 0.55 (release-cut listener, release_sync.py bridge) as the Theo leading leg; the place count stays nine
    - docs/THEO-NOTIFY-CONTRACT.md is marked superseded (frontmatter + banner) pointing at Step 0.55 / the listener; all historical sections kept
    - .claude/includes/release-process.md "Telling Theo" describes Step 0.55, not Step 5.6
    - doctor.cjs expectedSteps drops 'Step 5.6' (and gains 'Step 0.55')
    - run-all-349, run-all-310 (including leg 7, whose DRY_RUN unbound trio is caused by the Step 5.6 block being sliced into the Step 5.5 driver) and release.sh --dry-run are green
  artifacts:
    - scripts/release.sh
    - scripts/doctor.cjs
    - docs/RELEASE-CEREMONY-RULING-SYSTEM.md
    - docs/THEO-NOTIFY-CONTRACT.md
    - .claude/includes/release-process.md
    - tests/run-all-349.sh, tests/test-349-*.cjs, tests/test-release-cut-listener-wiring.cjs
    - tests/run-all-310.sh, tests/fixtures/310-release-step-block-hashes.txt
---

# Quick 261002-byh: retire release.sh Step 5.6 (theo-resync dispatch)

Root cause being retired: Step 5.6 fires `repository_dispatch` (event `theo-resync`) at
jsagir/theo, and no Theo workflow receives it (Theo's own RELEASE-SYNC-CONTRACT.md section 2).
Step 0.55 (quick 261002-5v9) is the leg that actually re-syncs Theo.

## Task 1: release.sh + library + doctor

- release.sh: delete the preamble guard+source for theo-notify-gate.sh (and fix the comment
  above it that names it), the NO_THEO_NOTIFY var, the `--no-theo-notify` case arm and
  USAGE_BLOCK entry, the Step 5.6 dry-run listing (3 lines + opt-out branch), and the whole
  `# --- Step 5.6` block (Step 5.5's own block hash is unchanged because blocks end at the next
  header). Fix the Step 0.6b comment "same reason as the two Theo gates above".
- `git rm scripts/release-lib/theo-notify-gate.sh`.
- doctor.cjs expectedSteps: drop 'Step 5.6', add 'Step 0.55'; comment notes the retirement.
- verify: `bash -n scripts/release.sh`; grep finds zero live references.

## Task 2: docs

- RULE 5 place 8: LEADING half rewritten to Step 0.55 / scripts/release-cut-listener.cjs /
  release_sync.py / --no-cut-listener; note that Step 5.6 and --no-theo-notify were retired by
  this quick. Place 9's "(place 8's leading half, Step 5.6)" and the listener paragraph's last
  sentence updated. Nine places stay.
- THEO-NOTIFY-CONTRACT.md: frontmatter `status: superseded`, `superseded_by`, plus a banner
  section at the top; body kept verbatim as history.
- release-process.md: "Telling Theo" describes Step 0.55; Release-cut listener bullet drops the
  "Step 5.6 has no receiver" sentence.

## Task 3: tests

- Delete tests/test-349-theo-notify-gate.cjs and tests/test-349-payload-boundary.cjs (they
  unit-test the deleted library); drop their run_red_until legs and the NOTIFY_GATE guard and
  the gate from PHASE_349_SURFACES in run-all-349.sh.
- test-349-release-wiring.cjs -> retirement tripwire (all removed constructs absent,
  Step 0.55 present before Step 0.6, --no-theo-check unchanged, step headers survive).
- test-349-dry-run-never-sends.cjs: expectedSteps lacks 'Step 5.6' and has 'Step 0.55'; dry-run
  stdout has no 'Step 5.6'/'theo-resync'; `--no-theo-notify` is an unknown arg; read-only proof
  scoped to release-owned files (WR-06 pattern, shared tree).
- test-349-docs-lockstep.cjs: item 8 tokens become Step 0.6, Step 0.55, theo-stamp-gate.sh,
  release-cut-listener.cjs, release_sync.py, --no-theo-check, --no-cut-listener and must NOT
  contain theo-notify-gate.sh / --no-theo-notify as live mechanisms; include names Step 0.55 and
  no longer Step 5.6.
- test-349-contract-doc.cjs: add assertions that the doc is marked superseded and points at
  Step 0.55 / release-cut-listener.cjs.
- test-release-cut-listener-wiring.cjs: "Step 5.6 untouched" assertion becomes "no Step 5.6
  block"; drop notify sentinel env.
- run-all-310.sh + fixture: remove the Step 5.6 data line, header count 34 -> 33, exit-1 floor
  re-pinned to the post-edit count, rebaseline note added.

## Task 4 (coordinator add-on, own commit): website SURFACES

- release-cut-listener.cjs: drop six deleted website files from `counts`; add
  src/lib/truth-claims.ts as a version surface (`const RELEASE = "v<version>"` must equal
  v<version>), mirroring website commit ac84cee. Update tests/test-release-cut-listener.cjs.
- Run the website leg read-only against /home/jsagi/dev/mindrian-website/website at
  2.0.0-beta.55: expect no GONE, no UNMIRRORED, 0 drift.

## Verification

HOME=$(mktemp -d) for: run-all-349, run-all-310, `bash scripts/release.sh patch --dry-run`,
test-release-cut-listener.cjs. Theo repo untouched (its section 2 note is a paragraph, not one
line): follow-up.
