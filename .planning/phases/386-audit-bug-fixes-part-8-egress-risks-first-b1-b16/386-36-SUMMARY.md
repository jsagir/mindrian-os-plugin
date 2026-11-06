---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "36"
subsystem: egress-guard
tags: [part8, hook, web-lines, credential-only, tavily, e-webhook]
requires: ["386-22", "386-29", "386-30", "386-31"]
provides:
  - A credential-only PreToolUse hook for WebSearch, WebFetch and every recorded Tavily tool-name shape
affects: [hooks/hooks.json, tests/test-261029-qef-hook-timeouts.cjs, data/arbitration-rule-catalogue.json]
tech-stack:
  added: []
  patterns: [credential-only scan of every tool_input string, lazy outage line, relative hook counts]
key-files:
  created:
    - scripts/web-credential-guard-hook.cjs
    - tests/test-386-web-credential-hook.cjs
    - .planning/debug/web-lines-have-no-credential-check-before-send.md
  modified:
    - hooks/hooks.json
    - tests/test-261029-qef-hook-timeouts.cjs
    - data/arbitration-rule-catalogue.json
key-decisions:
  - "Fail posture follows the plan 386-29 decision: option-a, fail closed with web_credential_check_unavailable and one count-only outage line."
  - "The qef test pins EXPECTED as 46 - P385.removed.length + P386.added.length, so the count stays relative."
requirements-completed: [E-WEBHOOK]
completed: 2026-11-06
---

# Phase 386 Plan 36: Credential-only web hook Summary

A new PreToolUse hook blocks a credential-shaped value in a native WebSearch, WebFetch or Tavily call. It runs credentialCheck only. It runs no room-word, name, company or content scan.

## Result

- Hook: scripts/web-credential-guard-hook.cjs. It collects every string value of tool_input at any depth and calls credentialCheck (lib/core/web-path-gate.cjs). A hit exits 2 with reason credential_shaped and no key byte. No string, empty tool_input, unparsable or empty stdin exits 0.
- Outage: a failed module load (guard_load_failed), a throwing credentialCheck (classify_threw) or any other failure after the input was read (hook_uncaught) writes one count-only line (class web) through recordGuardOutage, then exits 2 with web_credential_check_unavailable (option-a). The log module is required lazily.
- Entry: one new PreToolUse group in hooks/hooks.json, timeout 5, no onFailure. Matcher: `^(?:WebSearch|WebFetch|mcp__(?:plugin_[a-z0-9_-]+_)?(?:tavily|tavily-mcp|claude_ai_Tavily)__.*)$`. The Brain egress group is unchanged.

## Tavily tool-name shapes recorded

- mcp__tavily__tavily-search (PROVEN in agents)
- mcp__tavily-mcp__tavily-search and mcp__tavily-mcp__tavily-extract (PROVEN in agents/opportunity-scanner.md and the live config)
- mcp__plugin_<name>_tavily__tavily-search (ASSUMED from plugin naming)
- mcp__claude_ai_Tavily__<tool> (ASSUMED, not seen in the live tool list)
- Not matched (tested): Brain tools in all scopes, gate_answer, mcp__other-server__tavily-notes, Write, Edit, Bash.

## Counts (re-taken immediately before the edit, right after it, and before the commit; no peer commit changed them)

| Item | Before | After |
|------|--------|-------|
| command hooks in hooks/hooks.json | 43 | 44 |
| qef pinned count (46 - 3 removed) | 43 | 44 |
| PreToolUse groups | 3 | 4 |

## Test evidence (PROVEN)

- RED commit 77e722ab9: WH1 to WH10 all FAIL. GREEN: 10 of 10 ok.
- Readers after the change equal their baseline: run-all-179 (only 179-08 ga4-card-fire-e2e, a baseline red), run-all-198 (none), test-346 (FAIL 12 for the same 2 older scripts; the new script is not listed), test-198-adapter-budget, minto-debounce-consumer-census, check-hook-schema-compatibility, test-261029-qef-hook-timeouts, test-369-hook-require-graph, test-quick-260911-juq-hooks-json-top-level: exit 0. The 3 generators --check: exit 0. run-all-386: PASS=27 FAIL=0.
- Network counter 0 in all 60 or more hook runs of the test.
- Cold start: a process that loads web-path-gate and calls credentialCheck holds 9 modules in require.cache (8 in the gate chain, plus the hook script). Counts only.

## Deviations from Plan

**1. [Rule 3 - Blocking] The qef pinned count has no literal `entries.length === N`.**
- Found during: Task 1.
- Issue: the test pins `const EXPECTED = 46 - P385.removed.length;`. The plan verify grep (`entries.length === <digits>`) cannot read it. The value is 43 at baseline.
- Fix: added a P386 record (`added`) and set `EXPECTED = 46 - P385.removed.length + P386.added.length` (44). Relative, as the plan requires. The plan verify line for the qef pin will not match; the value was checked by running the test and by the count table above.
- Commit: 5445710e6.

**2. [Rule 3 - Blocking] A1 shape comparison strips the added group from the current document** (the plan said "strip the new group from the document before comparing"). Done with P386 as the single source.

## Known Stubs

None.

## Threat Flags

None. The hook adds a PreToolUse entry that opens no network connection and writes only the count-only outage line.

## Not done / UNVERIFIED

- A live Claude Code host run of the new matcher is UNVERIFIED (no host run). The PreToolUse input field names of WebSearch and WebFetch are UNVERIFIED against the official documentation (ctx7 not installed); the hook does not depend on them.
- Desktop fires no PreToolUse hook, so the check does not run there (same as the Brain guard).
- The RCA stays in .planning/debug (status fixing); plan 386-21 owns knowledge-base.md and the move to resolved/.
- STATE.md, ROADMAP.md, REQUIREMENTS.md and CHANGELOG.md were not edited, as instructed.

## Commits

- 32d6592c6 docs(386-36): RCA and baseline
- 77e722ab9 test(386-36): RED
- 5445710e6 feat(386-36): the hook, the entry, the in-place test updates, the catalogue entry
