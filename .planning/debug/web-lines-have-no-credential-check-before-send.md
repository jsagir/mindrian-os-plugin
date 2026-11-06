---
status: fixing
kind: rca
trigger: "web-lines-have-no-credential-check-before-send"
issue_id: ""
severity: medium
surfaces: [cli, cowork]
brain_mode: full-loop
canon_parts: [8, 11]
created: 2026-11-06T10:25:00Z
updated: 2026-11-06T10:31:00Z
---

## Current Focus

hypothesis: No PreToolUse hook inspects native WebSearch, WebFetch or Tavily tool calls, so a credential typed or pasted into a web query leaves unchecked.
test: Read every PreToolUse group of hooks/hooks.json, grep the repo for the web tool names, run the readers of hooks.json for a baseline.
expecting: No group matches the web tools. The fix is one new credential-only group.
next_action: Task 2 writes the failing test, Task 3 adds the hook.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin-release (branch main, worktree of the dev repo)
- Source-of-truth: CODE claims read against branch main @ 2b83948cc. WIRE claims: none (the hook opens no wire).
- Date of audit: 2026-11-06
- Reported by: Part 8 egress audit (EGRESS-CLAIMS-CHECK.md), owner confirmed 2026-11-06
- Related debug sessions: part8-guard-fails-open-on-load-or-throw (plan 386-29, 386-30)

## Problem Statement

A credential in the query of a native WebSearch, a WebFetch url or a Tavily call is sent to the open web with no check. The Brain egress hook matches only Brain tool names.

## Symptoms

expected: A credential-shaped value in a web request is blocked before it leaves. An ordinary room term (a name, a city, a company, money) is not blocked.
actual: Nothing inspects the web tool calls.
errors: none (a silent gap)
reproduction:
  1. List the PreToolUse groups of hooks/hooks.json and read each matcher.
  2. Test each matcher against WebSearch, WebFetch, mcp__tavily-mcp__tavily-search.
  3. Observe that no matcher matches.
started: since the web tools were used in agents (Phase 95.6 and later)

## Scope and Impact

- Affected surfaces: cli and cowork (hooks fire there). Desktop fires no PreToolUse hook (same as the Brain guard).
- Affected commands: agents that declare WebSearch or Tavily tools (opportunity-scanner, dominant-design-researcher, analogy-query-fetcher) and any session where the user asks for a web search.
- Affected users: all installs.
- Severity: medium
- Blast radius: only the new hook entry; the Brain egress guard entry is not changed.

## Eliminated

- hypothesis: The Brain egress hook already covers the web tools.
  evidence: Its matcher names only mindrian-brain, pws-brain-mcp and brain_ tools (see Evidence).
  timestamp: 2026-11-06T10:27:00Z

## Evidence

- timestamp: 2026-11-06T10:27:00Z
  checked: every PreToolUse group of hooks/hooks.json, read at run time
  found: 3 groups. (1) matcher Write|Edit|MultiEdit, write-scope-check. (2) the Brain matcher mcp__(?:(?:plugin_[a-z0-9_-]+_)?(?:mindrian-brain|pws-brain-mcp)__.*|[a-z0-9_-]+__brain_[a-z0-9_]+), part8-egress-guard-hook.cjs, PreToolUse event, timeout 5, onFailure block. (3) matcher mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-os__gate_answer, card-before-answer-hook.cjs. The Brain response sanitizer entry sits under PostToolUse (same Brain matcher, brain-response-sanitize-hook.cjs), not PreToolUse. No PreToolUse group can match WebSearch, WebFetch or a Tavily tool.
  implication: The gap is real.
- timestamp: 2026-11-06T10:28:00Z
  checked: grep of scripts/ and hooks/ for WebSearch, WebFetch, tavily
  found: scripts/oplog-larry-voice.cjs, scripts/analogy-fitness-report.cjs, scripts/doctor.cjs, scripts/eval-larry-voice.cjs mention the web tool names (reports and evals). No script is a guard for them.
  implication: No existing hook or guard script inspects the web lines.
- timestamp: 2026-11-06T10:29:00Z
  checked: grep of .mcp.json, agents/, commands/, skills/, docs/, hooks/, scripts/, lib/ for Tavily tool names
  found: .mcp.json registers no Tavily server (only mindrian-os and mindrian-brain). Tool-name shapes in the repo, with counts: mcp__tavily-mcp__tavily-search 110, mcp__tavily-mcp__tavily-extract 23, mcp__tavily__tavily-search 19, mcp__tavily-mcp__ (prefix form) 2. The live user config (~/.claude.json) registers the server key tavily-mcp, so the live shape here is mcp__tavily-mcp__tavily-search and mcp__tavily-mcp__tavily-extract.
  implication: Tavily is a user-level or project-level server, not shipped by this plugin. The matcher must cover every shape below.
- timestamp: 2026-11-06T10:30:00Z
  checked: PreToolUse input fields for WebSearch and WebFetch
  found: UNVERIFIED against the official documentation in this run (ctx7 is not installed and no web lookup was made). Expected from the Claude Code tool schema: WebSearch tool_input has query, allowed_domains, blocked_domains; WebFetch tool_input has url and prompt. The hook does not depend on field names: it walks every string value of tool_input at any depth.
  implication: A wrong field name cannot create a gap.

Tavily tool-name shapes recorded (the matcher must match each, and must not match anything else):

- project or user scope, server key tavily: mcp__tavily__tavily-search (PROVEN in agents/analogy-query-fetcher.md and agents/dominant-design-researcher.md)
- server key tavily-mcp: mcp__tavily-mcp__tavily-search, mcp__tavily-mcp__tavily-extract (PROVEN in agents/opportunity-scanner.md lines 12, 13 and in the live config)
- plugin scope: mcp__plugin_<name>_tavily__tavily-search (ASSUMED from the documented plugin naming that the Brain matcher also uses, mcp__plugin_mos_mindrian-brain__*)
- connector scope: mcp__claude_ai_Tavily__<tool> (ASSUMED; the live tool list in this session shows no such tool, claude.ai connectors in this session are named like claude_ai_Context7)

Must not match: mcp__plugin_mos_mindrian-brain__*, mcp__plugin_mos_mindrian-os__gate_answer, mcp__other-server__tavily-notes (tavily only in the tool part).

Baseline of the readers of hooks/hooks.json (taken before any edit, HEAD 2b83948cc; a red here is not a failure of this plan):

- bash tests/run-all-179.sh: exit 1. Failing leg: 179-08 ga4-card-fire-e2e (W8). Passed 11, failed 1. Not on the list of known reds in the plan hand-off; it is a baseline red.
- bash tests/run-all-198.sh: exit 0. No failing leg.
- node tests/test-198-adapter-budget.test.cjs: exit 0.
- node lib/memory/minto-debounce-consumer-census.test.cjs: exit 0.
- node scripts/check-hook-schema-compatibility.cjs: exit 0.
- node tests/test-261029-qef-hook-timeouts.cjs: exit 0.
- node tests/test-369-hook-require-graph.cjs: exit 0.
- node tests/test-346-catalogue-schema.cjs: exit 1. Failing leg: FAIL 12 (uncatalogued mechanisms scripts/ambient-stop.cjs and scripts/card-before-answer-hook.cjs; 2 scripts, as the plan says).
- node tests/test-quick-260911-juq-hooks-json-top-level.cjs: exit 0.
- node scripts/build-connector-registry.cjs --check, node scripts/build-orchestration-projection.cjs --check, node scripts/build-harness-manifest.cjs --check: exit 0 each. grep of the three generators finds no read of hooks/hooks.json.

baseline_fail_179: >>> 179-08 ga4-card-fire-e2e (W8, BL-01 + WR-01 + WR-02): FAILED;
baseline_fail_198: none
baseline_fail_346: >>> test-346-catalogue-schema.cjs: FAILED (1 failure(s));FAIL 12: every distinct conversation-time hook mechanism is either catalogued or excluded with a reason (enumerate-from-disk partition);
pretooluse_groups_before: 3
hook_count_before: 43
qef_pinned_count_before: 43

Note on qef_pinned_count_before: tests/test-261029-qef-hook-timeouts.cjs does not hold a literal `entries.length === N`. It pins `const EXPECTED = 46 - P385.removed.length;`, which evaluates to 46 - 3 = 43 at this baseline. The plan check that greps for `entries.length === <digits>` cannot read it. Task 3 adds a P386 record (added entries) and sets EXPECTED to 46 - P385.removed.length + P386.added.length, so the pinned value is relative and equals the value found at run time plus 1.

Part 11 position: hooks are not one of the 4 invocable surface classes (command, agent, pipeline, skill). The 3 generators do not read hooks/hooks.json (grep above) and print OK at baseline; they are re-run after the change.

Budget and ordering: the hook runs only on WebSearch, WebFetch and Tavily calls, never on every prompt. Timeout 5 seconds, the same as the Brain guard. No other PreToolUse group matches these tool names (Evidence above), so no ordering depends on another hook.

Fail posture (read from the plan 386-29 RCA, .planning/debug/part8-guard-fails-open-on-load-or-throw.md, anchored line): decision: option-a. An internal failure after the tool input was read exits 2 with the typed reason web_credential_check_unavailable and no bytes. Unparsable or empty stdin exits 0. Every outage branch calls recordGuardOutage(toolName, mode) of lib/core/part8-outage-log.cjs first (plan 386-30 exists; the class web comes from the tool name).

Cold start: a fresh process that loads lib/core/web-path-gate.cjs and runs credentialCheck loads 8 modules (counts only): web-path-gate, rs-egress-prompts, cross-room-aggregator, folder-memory, folder-memory-shared, feynman-minto-invariants, rooms-home-env, rs-egress-violations.

## Technical Root Cause

- Site: hooks/hooks.json PreToolUse groups (the Brain matcher names only mindrian-brain, pws-brain-mcp and brain_ tools).
- Cause: the Part 8 hook matcher names only Brain tools, and no other hook inspects the web lines, so a credential typed or pasted into a web search, fetch or Tavily call leaves unchecked.
- Why it surfaces now: the 2026-11-06 egress audit (EGRESS-CLAIMS-CHECK.md) found it; the owner confirmed credential-only coverage for the web lines the same day.

## Required Code Changes

- Change 1:
  - Location: scripts/web-credential-guard-hook.cjs (new)
  - Current behavior: does not exist.
  - Required behavior: read the PreToolUse JSON, collect every string in tool_input at any depth, run credentialCheck of lib/core/web-path-gate.cjs, exit 2 on a hit with reason credential_shaped and no string byte; no other scan; every outage branch writes one count-only line and follows option-a.
- Change 2:
  - Location: hooks/hooks.json, PreToolUse
  - Required behavior: one new group, anchored matcher for WebSearch, WebFetch and every recorded Tavily shape, one command hook, timeout 5, no onFailure field.
- Change 3:
  - Location: tests/test-261029-qef-hook-timeouts.cjs
  - Required behavior: P386 record of the added entry; EXPECTED relative; add the entry to the timeout table; strip the added group in A1.
- Change 4:
  - Location: data/arbitration-rule-catalogue.json _doc.not_a_judgment_rule
  - Required behavior: key web-credential-guard-hook.cjs with a reason. The 2 older uncatalogued scripts stay out.

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: tests/test-386-web-credential-hook.cjs
  - Given: fake credentials built at run time, a network counter preload, fixture HOME
  - When: the hook runs for WebSearch, WebFetch and each Tavily shape
  - Then: arms WH1 to WH10 of the plan
  - Runner registration: tests/run-all-386.sh if it lists tests by name
- Test 2:
  - Type: unit
  - Location: tests/test-261029-qef-hook-timeouts.cjs
  - Then: A1, A2, A4 pass with the new entry

## Non-Code Follow-ups

- CHANGELOG.md, STATE.md, ROADMAP.md: owned by plan 386-21, not edited here.
- Desktop fires no PreToolUse hook: the credential-only check does not run there (same as the Brain guard). UNVERIFIED end to end on a host.

## Resolution

root_cause: The Part 8 hook matcher names only Brain tools; nothing inspects the web lines.
fix: pending (Task 3).
verification: pending (Task 3).
files_changed: pending
commits: pending
