---
status: fixing
kind: rca
trigger: "session-start-env-assignment-after-node-e-dev-clone-branch-dead"
issue_id: "B4"
severity: low
surfaces: [cli]
brain_mode: full-loop
canon_parts: [8]
created: 2026-11-06T08:05:00Z
updated: 2026-11-06T08:05:00Z
---

## Current Focus

hypothesis: In scripts/session-start the probe `node -e '<program>' PLUGIN_ROOT_FOR_RESOLVE="..."` places the assignment after the program text. Bash does not treat it as an environment prefix there. Node receives it as an argv entry, process.env.PLUGIN_ROOT_FOR_RESOLVE is undefined, the require throws, and the catch prints not-found.
test: Run the same program text with the assignment after and before the node command against a fixture dev clone.
expecting: after returns not-found, before returns dev-clone.
next_action: Write the failing test, then move the assignment before node.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release (main)
- Source-of-Truth Preamble: CODE claims read against branch main @ 3e4ac78ea. WIRE claims: none (local shell and node only). Date 2026-11-06.
- Reported by: auditor finding B4 (.planning/audits/AUDITOR-FINDINGS-source.md), confirmed here by running it.
- Related debug sessions: none.

## Skip Rule Check

target: PRESENT

The line that assigns _MOS_TOPOLOGY still exists in the install-state manifest reconcile block (marker comment BEGIN install-state manifest reconcile) of scripts/session-start, with the assignment after the program text.

## Problem Statement

The dev-clone topology probe in scripts/session-start never sees PLUGIN_ROOT_FOR_RESOLVE. It always yields not-found, so the dev-clone pre-commit hook install branch can never run.

## Symptoms

expected: On a dev clone, on a version change, the probe returns dev-clone and scripts/install-pre-commit.sh runs.
actual: The probe returns not-found on every box.
errors: none (the program has a catch that prints not-found; stderr is sent to /dev/null).
reproduction:
  1. Build a fixture HOME with .claude/plugins/installed_plugins.json whose mos entry installPath points to a fixture dir that holds .git, .claude-plugin/plugin.json and an origin remote URL that names mindrian-os-plugin.
  2. Run the probe program with the assignment after the program text, as in the file.
  3. Run it again with the assignment before the node command.
  4. Compare.
started: Phase 123 Plan-02 (manifest reconcile block).

## Scope and Impact

- Affected surfaces: cli (hook script). Desktop and Cowork run the same script; the branch is dev-clone only.
- Affected commands: none directly. Hook: SessionStart (scripts/session-start).
- Affected users: developers on a dev clone. A marketplace install never enters the branch by design.
- Version range: Phase 123 through current main.
- Severity: low.
- Blast radius: only the dev-clone-pre-commit-hook surface of data/deployment-surfaces.json (owner session-start, topology_scope dev-clone, reconcile on-version-change).

## Reproduction Result (scratch script in the session scratchpad, not in the repo)

Fixture: temporary HOME, fixture dev clone (git init, origin remote URL names mindrian-os-plugin, plugin.json present), MINDRIAN_OS_ROOT unset. The real repo lib is only required, never written.

| Variant | process.env.PLUGIN_ROOT_FOR_RESOLVE | process.argv after the script | Topology returned |
|---------|--------------------------------------|-------------------------------|-------------------|
| assignment after the program (as in the file) | undefined | ["PLUGIN_ROOT_FOR_RESOLVE=<root>"] | not-found |
| assignment before node (prefix assignment) | <root> | [] | dev-clone |

A first run with a fixture origin URL spelled MindrianOS-Plugin returned marketplace-cache, because the probe regex in lib/core/active-plugin-root.cjs is /mindrian-os-plugin/i (hyphens). That was a fixture error, not a product finding. The real origin URL names mindrian-os-plugin.

## Eliminated

- hypothesis: The topology classifier cannot detect a dev clone.
  evidence: With the variable passed as an environment variable, the same program returns dev-clone for the fixture.
  timestamp: 2026-11-06T08:05:00Z

## Evidence

- timestamp: 2026-11-06T08:05:00Z
  checked: scripts/session-start, the _MOS_TOPOLOGY assignment in the manifest reconcile block
  found: `_MOS_TOPOLOGY=$(node -e '<program>' PLUGIN_ROOT_FOR_RESOLVE="$PLUGIN_ROOT_FOR_NODE" 2>/dev/null)`. The program reads process.env.PLUGIN_ROOT_FOR_RESOLVE.
  implication: Bash passes the assignment as an argument to node, not as an environment variable.
- timestamp: 2026-11-06T08:05:00Z
  checked: the scratch script (table above)
  found: after-variant prints not-found, before-variant prints dev-clone.
  implication: Root cause confirmed.
- timestamp: 2026-11-06T08:06:00Z
  checked: data/deployment-surfaces.json
  found: surface dev-clone-pre-commit-hook, owner session-start, topology_scope dev-clone, reconcile on-version-change, marker check-schema-aliases.cjs.
  implication: The branch is manifest-owned by session-start. A dead probe leaves a declared surface unreconciled.
- timestamp: 2026-11-06T08:06:00Z
  checked: scripts/install-pre-commit.sh (read only, never run)
  found: It byte-copies scripts/hooks/pre-commit-room-minto-guard.sh into the effective hooks/pre-commit path (git rev-parse --git-path), with a cmp check and an atomic rename. It is idempotent.
  implication: Turning the branch on is safe and idempotent. scripts/setup-hooks.sh already installs the same canonical hook unconditionally, so the incremental effect is small.

## Technical Root Cause

- Site: scripts/session-start, the _MOS_TOPOLOGY assignment in the install-state manifest reconcile block.
- Cause: Shell syntax. A `VAR=value` word that follows the command word is an argument, not a prefix assignment. The program reads process.env.PLUGIN_ROOT_FOR_RESOLVE and gets undefined, so `require(undefined + "/lib/core/active-plugin-root.cjs")` throws and the catch prints not-found.
- Why it surfaces now: It has been wrong since Phase 123. The not-found fallback hid it. The other node -e blocks in the same file use a prefix form (env VAR=... node -e), so only this one line is wrong.
- What turns on after the fix: on a dev clone, on a version change, scripts/install-pre-commit.sh runs. It idempotently installs the canonical pre-commit guard hook. Nothing changes on a marketplace install.

## Same-pattern search

Searched scripts/ and hooks/ for a VAR=value word after a node -e program (single line and multi-line forms). One hit:

| Hit | Consequence | Action |
|-----|-------------|--------|
| scripts/session-start _MOS_TOPOLOGY line | probe always not-found (this finding) | fix in this plan |

All other node -e blocks (scripts/session-start, scripts/on-stop, scripts/pre-compact) use a prefix assignment or `env VAR=... node -e`. No follow-up needed.

## Required Code Changes

- Change 1:
  - Location: scripts/session-start, the _MOS_TOPOLOGY line in the manifest reconcile block
  - Current behavior: assignment after the program text.
  - Required behavior: assign PLUGIN_ROOT_FOR_RESOLVE as a prefix before node. Keep 2>/dev/null and the not-found fallback. Change no other line.

## Tests to Add or Update

- Test 1:
  - Type: integration (child bash on an extracted line)
  - Location: tests/test-386-session-start-topology-env.cjs
  - Given: the line extracted from the real scripts/session-start, a fixture dev clone and a fixture non-dev root
  - When: the line runs in bash -c with PLUGIN_ROOT_FOR_NODE set (the script itself is never run, install-pre-commit.sh is never run)
  - Then: T1 dev-clone fixture returns dev-clone. T2 non-dev fixture does not return dev-clone. T3 the line is found by its marker comment and token.
  - Runner registration: tests/run-all-386.sh discovers it by glob.

## Non-Code Follow-ups

- CHANGELOG.md, STATE.md, ROADMAP.md and knowledge-base.md are owned by plan 386-21. Do not edit them here.

## Resolution

root_cause: The `PLUGIN_ROOT_FOR_RESOLVE="..."` word followed the node -e program text, so bash passed it to node as an argument and not as an environment variable. The probe read undefined and always printed not-found.
fix: Moved the assignment before the node command (prefix assignment) in the _MOS_TOPOLOGY line of the manifest reconcile block. One line changed. 2>/dev/null and the not-found fallback are kept. The extraction regex in the test was widened in the same commit to match the assignment with the prefix before node.
verification: tests/test-386-session-start-topology-env.cjs T1 T2 T3 ok (RED showed T1 FAIL). The 5 session-start tests pass. bash -n scripts/session-start passes. bash tests/run-all-386.sh PASS=8 FAIL=0 at run time. The real scripts/session-start and scripts/install-pre-commit.sh were never run.
files_changed:
  - scripts/session-start (one line)
  - tests/test-386-session-start-topology-env.cjs (extraction regex)
commits: see the plan summary
