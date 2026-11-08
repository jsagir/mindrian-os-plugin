---
phase: 391-claude-code-compatibility-check-2-1-288-to-2-1-318-and-radar
plan: 04
subsystem: compatibility
tags: [claude-code-compat, owner-cards, probes, token-gate, agents, hooks]
status: awaiting owner answers
requires: [391-02]
provides:
  - 391-CHECKS.md (checks a to i and the cheap checks, every line marked)
  - 391-probe-plugin-names.json and 391-probe-guard-timing.json
  - 391-agent-table.tsv (17 agents)
  - 391-card-check.cjs (selftest, check, gate, edit-list, sha)
  - 391-DECISION.md (six owner cards C1 to C6, all OWNER-ANSWER PENDING)
  - SEED-145 (agents ignore allowed-tools, mcpServers, initialPrompt)
affects: [391-07, 391-08]
key-files:
  created:
    - .planning/phases/391-claude-code-compatibility-check-2-1-288-to-2-1-318-and-radar/391-CHECKS.md
    - .planning/phases/391-claude-code-compatibility-check-2-1-288-to-2-1-318-and-radar/391-probe-plugin-names.json
    - .planning/phases/391-claude-code-compatibility-check-2-1-288-to-2-1-318-and-radar/391-probe-guard-timing.json
    - .planning/phases/391-claude-code-compatibility-check-2-1-288-to-2-1-318-and-radar/391-agent-table.tsv
    - .planning/phases/391-claude-code-compatibility-check-2-1-288-to-2-1-318-and-radar/391-card-check.cjs
    - .planning/phases/391-claude-code-compatibility-check-2-1-288-to-2-1-318-and-radar/391-DECISION.md
    - .planning/seeds/SEED-145-plugin-agents-ignore-allowed-tools-mcpservers-and-initialprompt.md
  modified: []
requirements-completed: [CC391-A, CC391-B, CC391-D, CC391-F, CC391-G, CC391-H, CC391-J]
completed: 2026-11-08
---

# Phase 391 Plan 04: Compatibility checks, probes and six owner cards Summary

The plan recorded every compatibility check with marks, proved the plugin-scoped MCP tool name on a live host, timed both guard hooks, built a token gate for owner answers and wrote six cards. No agent, skill, hook or command file changed. Every OWNER-ANSWER line says PENDING.

## Status

AWAITING OWNER ANSWERS. The plan ends at a human checkpoint (Task 3).

NEEDS_HUMAN: Answer the 6 cards in 391-DECISION.md with one token each. C1 (agent tools lists) one of APPLY-ALL, APPLY-NO-WRITE-GROUP, FIX-COMMENTS-ONLY, DEFER, NO. C2 (onFailure on the web credential hook) one of APPLY, DEFER, NO. C3 (Bash grant for the radar command) one of APPLY-NARROW-BASH, APPLY-BARE-BASH, DEFER, NO. C4 (/ultrareview facts) one of NO-ACTION, FILE-SEED, DEFER. C5 (mcp__brain_* token) one of LEAVE, REMOVE, DEFER. C6 (doctor ledger default lag) one of LAG-10, LAG-20, KEEP-40. Recommended: C1 (APPLY-ALL), C2 (APPLY), C3 (APPLY-NARROW-BASH), C4 (FILE-SEED), C5 (REMOVE), C6 (LAG-20).

## Recommended tokens and the rule that chose each

| Card | Token | Rule applied | Inputs |
|------|-------|--------------|--------|
| C1 agent tools lists | APPLY-ALL | APPLY-ALL when the probe PROVED the naming and the body-outside-list column is empty for every row | naming PROVEN; column empty for all 13 rows. Caveat on the card: the Desktop copy name (mos-desktop) is UNVERIFIED |
| C2 onFailure on web credential hook | APPLY | APPLY when warm p95 is at most 1000 ms, first run at most 2500 ms, and Phase 384 is closed on disk | p95 26.8 ms, first run 25.5 ms, 384 has 20 plans and 20 summaries |
| C3 Bash grant for radar | APPLY-NARROW-BASH | narrow form when the docs verified the pattern form | skills docs show a Bash pattern with the plugin root variable (CITED for plugin skills) |
| C4 /ultrareview | FILE-SEED | a suggestion only; the phase decides nothing | no ultrareview seed exists |
| C5 mcp__brain_* | REMOVE | REMOVE when no server named brain or brain_* exists in either list | none exists on this machine; docs say such a glob is skipped |
| C6 doctor default lag | LAG-20 | smallest lower value that gives 21 days before a cut is blocked and flags the 32-version gap | LAG-10 gives about 12 days; LAG-20 about 23 days |

## Probe verdicts

- Plugin-scoped name pattern: PROVEN. A scratch plugin (name mos391probe) with the real Brain shim, dead loopback URL http://127.0.0.1:9, no key and a scratch HOME listed `mcp__plugin_mos391probe_mindrian-brain__brain_ask`, `brain_query`, `brain_schema`, `brain_search`, `brain_stats`, `brain_write`. Tools were listed and never called.
- Restriction semantics: PROVEN. An agent with tools `Read, mcp__plugin_mos391probe_mindrian-brain__*` kept 7 tools. An agent with `Read, mcp__mindrian-brain__*` kept only Read.
- claude -p calls used: 4 of 6 (attempt 1 used --strict-mcp-config, which removed the plugin server, so it gave no names; attempts 2 to 4 gave the proof).
- Guard timing (synthetic payload, scratch HOME, 1 first run plus 20 warm runs, node spawn): web guard first run 25.5 ms, p50 24.8, p95 26.8, max 27.3; egress guard first run 78.1 ms, p50 78.1, p95 82.7, max 87.0. All exit codes 0. hooks.json limit is 5000 ms for both. Reboot-cold time and host spawn cost are UNVERIFIED.
- Eureka handshake (once, local, scratch HOME, no keys): legacy-default 2025-11-25 with 27 tools; auto 2026-07-28 with 27 tools. PROVEN. Eureka is not registered in .mcp.json, so the host default does not reach it.
- MCP tests: Brain shim PASS=6 FAIL=0; dual-era PASS=3 FAIL=2 (the 2 stale surface-snapshot arms since Phase 387, not caused by Phase 391); hooks contract 24 passed; agent tools naming 22 passed.
- Docs facts (all 4 pages returned 200): allowed-tools in a skill or command is a pre-approval, not a restriction; a Bash pattern with the plugin root variable is documented for plugin skills; the trailing `:*` equals the space-star form; an allow glob must follow a literal `mcp__<server>__` prefix; no /ultrareview disable switch found (UNVERIFIED).
- Phase 384 closure on disk: 20 PLAN and 20 SUMMARY files; 384-20 is PARTIAL-REVERTED (NO-GAIN); no VERIFICATION file; no statement about the guard hooks.
- mcp_tool hook lead: CONFIRMED (the hook type exists since 2.1.118). It must not be dropped from 384-LEADS.md. Adoption is out of scope.

## Task commits

| Task | Commit | Files |
|------|--------|-------|
| 1 Facts, probes and the CHECKS record | 3f9632819 | 391-CHECKS.md, two probe JSON files, 391-agent-table.tsv |
| 2 Card checker, six cards, seed | ae111cec4 | 391-card-check.cjs, 391-DECISION.md, SEED-145, this SUMMARY, one wording fix in 391-CHECKS.md |

## Checker

`node 391-card-check.cjs selftest` passes 22 cases: valid cards, PENDING, unknown token, changed edit list (BLOCKED-HASH), head not an ancestor (BLOCKED-HEAD, tested in a temporary git repository), NOEDIT versus READY, duplicate answer lines, long dashes, missing lines, and a case that proves the self-test can fail (a deliberately wrong expectation must be reported as a failure). With the gate stubbed to always return PENDING, 8 cases failed (RED), so the tests do not pass by accident. `check` passes on 391-DECISION.md. `gate` on all six cards prints PENDING and exits 1.

## Deviations from Plan

**1. [Rule 3 - Blocking] First probe call used --strict-mcp-config.** The plan command had no such flag; I added it to avoid user-level servers and it removed the plugin server too (empty mcp_servers). The next call dropped it. Cost: 1 of 6 allowed calls.

**2. [Rule 1 - Accuracy] C3 entry written in the space-star form.** The plan says "colon-star suffix, written exactly as the docs show". The skills docs show the space-star form and the permissions docs say `:*` is equivalent. The card uses `Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/radar-changelog-slice.cjs" *)`. Whether quoting the path matches the command text is UNVERIFIED; the card says plan 391-08 must check it.

**3. [Rule 1 - Accuracy] REPLACE-NARROW is not offered on C5.** The plan offers it only if the skill body names specific Brain tools. It does not (line 108 names only the pattern in prose).

**4. Agent table noise filter.** body_tools_outside_list ignores negation lines, the verb "Write a ..." in grading.md line 145 and the words Agent or Task outside backticks. This was reviewed by hand; the raw scan listed prose matches only.

**5. 391-CHECKS.md edited after its commit.** One wording fix (5 files carry the false claim comments, not 6) went into the Task 2 commit with the same exact-path rule.

## Authentication gates

None.

## Known Stubs

None. Every C{N}-OWNER-ANSWER is PENDING by design.

## Threat Flags

None. The probes made no Brain call (the shim pre-warm hit only the dead loopback address). No secret was read or written: ~/.claude.json was read for server names and counts only.

## Issues Encountered

- Peers 391-03 and 391-05 committed during this plan (HEAD moved from ae836b43a). No peer file was touched. Commits used `git add -f` and `git commit --only` with exact paths.
- Escape sequences: no Unicode escape was written through the Write tool in this plan (the checker builds dash characters from code points). A grep for non-ASCII bytes in the three phase files returns 0.

## Self-Check: PASSED

All 7 created files exist; commits 3f9632819 and ae111cec4 exist in git log. Task 3 (owner answers) is open by design.
