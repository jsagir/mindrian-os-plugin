---
status: resolved
kind: rca
trigger: "sessionstart-npm-reconcile-no-isolation-switch"
issue_id: ""
severity: high
surfaces: [cli]
brain_mode: full-loop
canon_parts: [8]
created: 2026-10-29T17:26:00Z
updated: 2026-10-29T18:59:53Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `workspace/phase-369-6` @ 4cc70c8ce (phase base d6a2fdbaa), plugin version 2.0.0-beta.76 (`node lib/core/repo-version.cjs`)
- **WIRE claims probe against:** none (no wire probe in this report)
- **Date of audit:** 2026-10-29
- **Re-verification rule:** the claims below are read from this branch; re-verify against `origin/main` HEAD before any fix outside plan 369.6-02 lands.

## Current Focus

hypothesis: Two gaps stop the eval from proving that a live session which loads the plugin writes only under its scratch root. Gap 1 (the npm reconcile has no off switch at the phase base) is closed on this branch by quick 261029-nhu and PROVEN by the run-time proof. Gap 2 (scripts/session-start held literal /tmp paths, found at execution) is closed by quick 261029-sof.
test: `proveReconcileSwitch` of scripts/isolate-larry-voice.cjs for gap 1; `scanFile('scripts/session-start')` for gap 2; both run in `node tests/test-3696-isolation.cjs`.
expecting: gap 1 PROVEN; gap 2 lists no line after the fix.
next_action: none

## Meta

- Repo: /home/jsagi/gsd-workspaces/phase-369-6/MindrianOS-Plugin (worktree of /home/jsagi/dev/MindrianOS-Plugin)
- Plugin version: 2.0.0-beta.76
- Reported by: plan 369.6-02 Task 2 (isolation contract)
- Date first observed: 2026-10-29
- Related debug sessions: none

## Problem Statement

A live eval session that loads the plugin runs the nine SessionStart hooks of hooks/hooks.json. Two of them can write outside the scratch root of the eval: the npm reconcile (gap 1, closed) and scripts/session-start (gap 2, open). The eval cannot claim isolation for a plugin-loading leg until both are contained.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: every hook of the SessionStart chain writes only under the scratch root when the child env comes from ISOLATION_TABLE.
actual: gap 1 at the phase base d6a2fdbaa: scripts/sessionstart-npm-reconcile.cjs installs dependencies under the directory it lives in, and no environment name or flag turned that write off. Gap 2 at 4cc70c8ce: scripts/session-start writes the file /tmp/mindrian-update-check and reads /tmp/mindrian-context-state; neither path derives from HOME, TMPDIR or any name of the isolation table.
errors: none (silent writes)
reproduction:
  1. `node -e "const i=require('./scripts/isolate-larry-voice.cjs');console.log(JSON.stringify(i.scanFile('scripts/session-start')))"` lists lines 413, 1332 and 1829.
  2. `git show d6a2fdbaa:scripts/sessionstart-npm-reconcile.cjs` has no switch before line 56 (`const OWN_ROOT`).
started: gap 1 from Phase 95.6 D-05d (the reconcile hook); gap 2 from the update-check block of scripts/session-start (date unknown).

## Scope and Impact

- Affected surfaces: cli (SessionStart hooks fire on the CLI; Desktop and Cowork do not run this chain)
- Affected commands: every live leg of the Larry eval that loads the plugin (the operate leg of plan 369.6-05, the captures of cells 2, 3, 2s and 3s that run scripts/session-start)
- Affected users: the eval only. For an installed user the same lines are normal behavior.
- Version range: d6a2fdbaa to 4cc70c8ce for gap 2; gap 1 closed at 58a997ca8
- Severity: high for the eval (the isolation claim), low for users
- Blast radius: tests/test-3696-isolation.cjs, scripts/isolate-larry-voice.cjs liveLegGate, the cells 2, 3, 2s and 3s of scripts/eval-larry-voice.cjs

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: the other eight SessionStart hooks write outside the scratch root
  evidence: each hook ran under the isolated env against a stand-in home; the stand-in stayed byte-identical and no repo file was newer than the marker (tests/test-3696-isolation.cjs B5f)
  timestamp: 2026-10-29T17:25:00Z
- hypothesis: scripts/intent-classifier.cjs holds a literal home or temp path
  evidence: `scanFile('scripts/intent-classifier.cjs')` returns an empty list (B8a)
  timestamp: 2026-10-29T17:25:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-10-29T17:20:00Z
  checked: `git show d6a2fdbaa:scripts/sessionstart-npm-reconcile.cjs`
  found: the install target is `OWN_ROOT = path.resolve(__dirname, '..')` (line 56 on this branch; lines 36 to 45 comment at the base); the install runs through runGuardedInstall of lib/core/mcp-dep-heal.cjs or a direct npm spawn with cwd at that directory; no switch
  implication: a plugin-loading live leg could install under the repo
- timestamp: 2026-10-29T17:21:00Z
  checked: `git log --oneline d6a2fdbaa..HEAD -- scripts/sessionstart-npm-reconcile.cjs`
  found: 58a997ca8 feat(quick-261029-nhu) adds `if (process.env.MINDRIAN_NPM_RECONCILE_SKIP === '1') return emit();` at line 47; it is an ancestor of HEAD (`git merge-base --is-ancestor`)
  implication: the switch exists on this branch; the question is whether it holds
- timestamp: 2026-10-29T17:24:00Z
  checked: proveReconcileSwitch on the repo file, on the base bytes and on a synthetic variant
  found: repo file PROVEN (sha256 7a1746f76782af6ceaa741a8444a35493f214f2645eb4686a4e80a18705277ce); base bytes fail with install_called; the synthetic variant passes (B6a to B6d)
  implication: gap 1 is closed on this branch
- timestamp: 2026-10-29T17:22:00Z
  checked: scripts/session-start lines 413, 1332, 1829, 1867
  found: `BRIDGE_FILE="/tmp/mindrian-context-state"` (read), `tmp=$(mktemp 2>/dev/null || echo "/tmp/mos-sealed-$$")` (fallback write), `UPDATE_CACHE="/tmp/mindrian-update-check"` (read, and written at lines 1848 and 1867 inside a detached subshell)
  implication: under any isolated env the hook writes /tmp/mindrian-update-check outside the scratch root, and reads the operator's live context state from /tmp/mindrian-context-state (a second leak: the capture depends on the operator's session)
- timestamp: 2026-10-29T17:24:30Z
  checked: the two compare-only lines 24 and 25 of scripts/session-start
  found: they test PWD against the plugin cache path and write nothing
  implication: listed in COMPARE_ONLY_LINES, not a finding
- timestamp: 2026-10-29T18:59:53Z
  checked: `scanFile('scripts/session-start')` and `node tests/test-3696-isolation.cjs` after quick 261029-sof (commit dfbadf150)
  found: the scan returns an empty list; PASS 70, FAIL 0; INFO chain not executed: none; INFO chain blockers: []; B8h, B8i and B8j prove the TMPDIR read and write
  implication: gap 2 is closed
- timestamp: 2026-10-29T18:59:53Z
  checked: every reader and writer of /tmp/mindrian-context-state (git grep, grep -rIn, installed plugin copies, ~/.claude user files, `git log -S`)
  found: the file has readers only (session-start lines 414 to 417 and 567 to 572, and skills/context-engine/SKILL.md:124) and no writer; the last writer left in commit 256560658 (feat 54-02), which moved the bridge to ~/.mindrian/bridge/<room-hash>.json
  implication: pre-existing defect tracked in sessionstart-blocks-first-prompt-windows-arm64.md; not fixed by the TMPDIR change, which cannot create a reader and writer mismatch

## Technical Root Cause

- Site (gap 1, closed): scripts/sessionstart-npm-reconcile.cjs:56 and the install block below it; function body of the hook.
- Cause (gap 1): the hook installs under its own directory and the base had no off switch.
- Site (gap 2, closed): scripts/session-start:413, :1332, :1829 (writes at :1848 and :1867).
- Cause (gap 2): three literal /tmp paths instead of `${TMPDIR:-/tmp}`; the scratch TMPDIR of the isolation table never reaches them.
- Why it surfaces now: plan 369.6-02 is the first caller that needs these hooks to run against a scratch root and to prove it.

## Required Code Changes

- Change 1 (gap 1, done outside this phase):
  - Location: scripts/sessionstart-npm-reconcile.cjs:47
  - Current behavior: ends at the switch when MINDRIAN_NPM_RECONCILE_SKIP=1
  - Required behavior: unchanged
- Change 2 (gap 2, done by quick 261029-sof):
  - Location: scripts/session-start:413, :1332, :1829
  - Current behavior: literal /tmp paths
  - Required behavior: derive each path from `${TMPDIR:-/tmp}` (the 1332 fallback too)
  - Short-term patch: the same three substitutions
  - Long-term fix: none needed; the hard-coded path scan of tests/test-3696-isolation.cjs (B8) keeps the set from growing

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: tests/test-3696-isolation.cjs
  - Given: scripts/session-start after the Change 2 substitutions
  - When: the scan and the canary run
  - Then: B4e takes its second branch (the session-start capture runs), the chain verdict has no blocker, B8 prints 0 of 0 known escapes
  - Runner registration: tests/run-all-3696.sh already lists it

## Non-Code Follow-ups

- Route for gap 1: closed by quick 261029-nhu (commit 58a997ca8, an ancestor of this branch). Verified on this branch by the run-time proof above.
- Route for gap 2: DONE. Quick 261029-sof (commit dfbadf150) made the three paths follow TMPDIR. The session-start capture now runs, so cells 2, 3, 2s and 3s can capture it in plan 369.6-05.
- This phase never edits the reconcile or scripts/session-start and never relaxes the canary.
- knowledge-base.md: summary block added when both gaps closed.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: gap 1 confirmed and closed; gap 2 confirmed and closed.
fix: gap 1 by quick 261029-nhu; gap 2 by quick 261029-sof (BRIDGE_FILE, UPDATE_CACHE and the mktemp fallback of scripts/session-start use ${TMPDIR:-/tmp}; evidence table and SKILL.md line updated; B8 known-escape set removed; B8d to B8j added).
verification: `node tests/test-3696-isolation.cjs` prints PASS 70, FAIL 0, chain blockers [] and chain not executed none on 2026-10-29; the six session-start regression tests exit 0.
files_changed:
  - scripts/session-start
  - scripts/isolate-larry-voice.cjs
  - skills/context-engine/SKILL.md
  - tests/test-3696-isolation.cjs
commits: 58a997ca8 (gap 1), dfbadf150 (gap 2)
