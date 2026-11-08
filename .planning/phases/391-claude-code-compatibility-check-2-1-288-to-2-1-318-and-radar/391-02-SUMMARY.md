---
phase: 391-claude-code-compatibility-check-2-1-288-to-2-1-318-and-radar
plan: 02
subsystem: testing
tags: [claude-code-compat, hooks, agents, tools-naming, characterization-test, mutation-arms]
requires: []
provides:
  - tests/test-391-hooks-contract.cjs (hook census, updatedInput, UserPromptSubmit timeout, admin gate raw line, no-onFailure pin, frontmatter hooks scan)
  - tests/test-391-agent-tools-naming.cjs (tools and allowed-tools form rules, PENDING_OWNER list, Tier B report, name checks)
affects: [391-04, 391-07, 391-08]
tech-stack:
  added: []
  patterns: [pure rule functions plus mutation arms, owner-gated PENDING list with STALE check]
key-files:
  created:
    - tests/test-391-hooks-contract.cjs
    - tests/test-391-agent-tools-naming.cjs
  modified: []
key-decisions:
  - "H5 pins the set of hooks that carry onFailure to exactly the Part 8 egress guard with value block; only plan 391-08 may change it, after an owner answer on card C2"
  - "The one real offender mcp__brain_* is held in PENDING_OWNER (card C5); no product file was edited"
requirements-completed: [CC391-A, CC391-B, CC391-C, CC391-E, CC391-J]
duration: 25 min
completed: 2026-11-08
---

# Phase 391 Plan 02: Hook contract and agent tools naming tests Summary

Two plain-Node tests pin what Claude Code 2.1.288 to 2.1.318 changed for hooks, agent tool lists and names. The agent-tools test went RED on the single real offender (`mcp__brain_*`), then GREEN through a named, owner-gated pending entry. No product file changed.

## Commits (5, all on main, none pushed)

| Sha | Message |
|-----|---------|
| 4bb59b6b1 | test(391-02): pin hook facts and the no-onFailure set for Claude Code 2.1.288 to 2.1.318 |
| 3eafc4fa6 | test(391-02): write the BOM as an escape in the hooks contract test |
| 55307763d | test(391-02): failing agent tools naming test, RED on mcp__brain_* (check a) |
| 76ebdcc71 | test(391-02): name the owner-gated mcp__brain_* entry as pending (card C5) |
| (this commit) | docs(391-02): complete plan summary |

The plan listed 4 commits. There are 5 test-side commits because the Write tool turned backslash-u escape sequences (BOM, zero-width and similar) into raw characters in both test files; 3eafc4fa6 fixes that in the hooks test. The naming test was fixed before its RED commit, so its RED commit is clean.

## Task 1: hooks contract test (characterization, green at birth)

Run output (first run, exit 0):

```
test-391-hooks-contract
  ok   H1 every hook in hooks/hooks.json is type command
       census: 41 hooks; SessionStart 9, PreCompact 1, PostCompact 1, Stop 5, SessionEnd 1, PreToolUse 4, PostToolUse 9, UserPromptSubmit 7, FileChanged 1, CwdChanged 1, SubagentStop 1, TaskCompleted 1
  ok   H1 mutation: prompt / agent / http / mcp_tool hook flagged (4 arms)
       H2 scanned 1338 code files
  ok   H2 no hook, script, lib or bin code returns updatedInput
  ok   H2 comment-only mention in scripts/fork359-permission-probe.cjs is not flagged
       H3 UserPromptSubmit hooks: 7
  ok   H3 mutation: no timeout flagged; timeout 30 flagged
       H4 exit codes: {"plain":2,"space":2,"tab":2,"newline":2,"bom":2,"mention":0,"ordinary":0}
  ok   H4 admin gate treats a command after leading white space like the plain form (exit 2)
  ok   H4 mutation: escaping variant, vacuous setup, over-reach on a mention flagged (3 arms)
  ok   H5 exactly one hook has onFailure: the Part 8 egress guard, value block
  ok   H5 mutation: onFailure on an observer, egress guard without onFailure, onFailure warn flagged (3 arms)
       H6 scanned 256 command, skill and agent files
  ok   H6 no command, skill or agent declares a frontmatter hooks key (+ mutation arm)
  ok   H7 the test can fail
PASSED: 24 passed, 0 failed
```

Facts proven at the current tree: 41 hooks all type command; no `updatedInput` in code (only a comment in `scripts/fork359-permission-probe.cjs`); all 7 UserPromptSubmit hooks have timeout 3 or 5; the admin gate returns exit 2 for `/mos:admin` plain and after a space, tab, newline and BOM in a scratch HOME as a non-admin, exit 0 for a mention and for `/mos:help`; only the egress guard has `onFailure: block`; no frontmatter `hooks` key in 256 surface files. The H4 arm fails (does not pass) if the plain case is not exit 2, so it cannot pass vacuously.

## Task 2: agent tools naming test

RED output (before the pending entry, exit 1). The only failure is the planned offender:

```
test-391-agent-tools-naming
       surfaces: 17 agents, 126 skills, 113 commands; MCP servers: mindrian-os, mindrian-brain
  ok   A1 parser handles list, flow list, string, comma and parenthesis forms
       mcp__ tokens read from tools and allowed-tools lines: 75
  ok   A1 the scan read a plausible number of mcp__ tokens
  FAIL A2 A3 A4 A4 skills/intelligence-orchestrator/SKILL.md (allowed-tools) -- glob is not mcp__SERVER__*: mcp__brain_*
  ok   A5 every PENDING_OWNER entry matches a real line (0 entries)
  ... (A6 report, A7, A8 and A9 all ok)
FAILED: 21 passed, 1 failed
```

GREEN output (after the pending entry, exit 0, 22 passed, 0 failed):

```
  ok   A2 A3 A4 no unowned tools-form problem in agents, skills, commands
  PENDING A4 skills/intelligence-orchestrator/SKILL.md token mcp__brain_* -- gate: owner card C5 in 391-DECISION.md (plan 391-04); plan 391-07 deletes this entry
  ok   A5 every PENDING_OWNER entry matches a real line (1 entries)
```

Tier B report as printed (never fails):

```
agents with allowed-tools and no tools (host ignores allowed-tools): 13 (13 expected)
  analogy-query-fetcher, brain-query, chain-step-reviewer, competitor-watch-fetcher, framework-runner, grading, grant-reviewer, investor, meeting-perspective-extractor, opportunity-scanner, persona-analyst, research, vault-section-reviewer
plugin agents with mcpServers or initialPrompt (host ignores both): 2 -> larry-extended[mcpServers+initialPrompt], reverse-salient-agent[mcpServers]
ignored unknown key instances across agents: 92; by key: activation_gate 1, allowed-tools 15, connector 17, extends 1, hitl_shape 9, hitl_stages 1, hitl_why 10, initialPrompt 1, layer 17, layer_why 16, mcpServers 2, persona_variants 2
```

Name checks (A7) pass over 256 files and 126 folders. No agent skills list exceeds 32 entries. No file holds the `391-NOTE-allowed-tools-not-enforced` marker, so no agent prints ACKNOWLEDGED.

The aggregator `TEST_391_PREFIX=tests/test-391-agent bash tests/run-all-391.sh` exits 0 (PASS=2: the test plus the dash fence). `git diff --quiet HEAD -- agents skills hooks commands` exits 0.

## Deviations from Plan

**1. [Rule 3 - Blocking] Escape sequences written as raw characters.** The Write tool converted backslash-u escape sequences (BOM, line separator, zero-width space and similar) into raw characters, which gave a SyntaxError in the naming test and a raw BOM in the hooks test. Fixed with a scripted replace back to escapes in both files. The naming test was fixed before its RED commit, so the RED run is the real one (commit 55307763d). The hooks test fix is commit 3eafc4fa6. No behavior change.

**2. Token count.** The plan says 79 `mcp__` tokens; the parser reads 75 from `tools` and `allowed-tools` lines. The test floor is 40, so this is not a failure. The 4 token difference is UNVERIFIED (likely a counting difference in the plan, for example tokens in prose lines). No second offender exists, which is the fact that matters.

**3. Branch guard.** The tree is a linked worktree on branch `main` (the caller ordered this). The generic worktree-agent branch guard was therefore not applied; commits used `git commit --only` with exact paths.

## Pending registration

`tests/run-all-391.sh` now exists (created by plan 391-01, commit f79cd2545) and discovers both tests by its default prefix `tests/test-391-`. No pending registration is left.

## Known Stubs

None.

## Threat Flags

None. No product file changed. No network call. H4 runs in a scratch HOME with a scratch env; the folder is removed in a finally block.

## No product file changed

Both commits touch only new files under `tests/`. `agents/`, `skills/`, `hooks/`, `commands/` and `scripts/` are untouched. `mcp__brain_*` in `skills/intelligence-orchestrator/SKILL.md` is still in place; plan 391-07 edits it after the owner answers card C5.

## Self-Check: PASSED

Both test files exist; commits 4bb59b6b1, 3eafc4fa6, 55307763d, 76ebdcc71 exist in git log.
