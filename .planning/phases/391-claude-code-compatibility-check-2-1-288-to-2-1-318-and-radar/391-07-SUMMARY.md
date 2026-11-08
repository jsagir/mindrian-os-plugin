---
phase: 391-claude-code-compatibility-check-2-1-288-to-2-1-318-and-radar
plan: 07
subsystem: compatibility
tags: [claude-code-compat, agents, tools-list, owner-cards, c1, c5]
status: complete
requires: [391-04]
provides:
  - host-read tools lists on 13 agents (owner card C1, APPLY-ALL)
  - mcp__brain_* token removed from the orchestrator skill (owner card C5, REMOVE)
  - tests/test-391-agent-tools-naming.cjs arms A10, A12, A13 and a resolved PENDING_OWNER list
affects: [391-08]
key-files:
  modified:
    - agents/analogy-query-fetcher.md
    - agents/brain-query.md
    - agents/chain-step-reviewer.md
    - agents/competitor-watch-fetcher.md
    - agents/framework-runner.md
    - agents/grading.md
    - agents/grant-reviewer.md
    - agents/investor.md
    - agents/meeting-perspective-extractor.md
    - agents/opportunity-scanner.md
    - agents/persona-analyst.md
    - agents/research.md
    - agents/vault-section-reviewer.md
    - skills/intelligence-orchestrator/SKILL.md
    - tests/test-391-agent-tools-naming.cjs
requirements-completed: [CC391-A]
completed: 2026-11-08
---

# Phase 391 Plan 07: Owner cards C1 and C5 applied Summary

Thirteen agents now carry a host-read `tools:` list (plugin-scoped Brain names), and the dead `mcp__brain_*` token is gone from the orchestrator skill, with a test that pins both.

## Gate (Task 1)

Command: `node 391-card-check.cjs gate 391-DECISION.md 1 5`

- `C1 READY:APPLY-ALL`
- `C5 READY:REMOVE`

Both answers were given by the owner on 2026-11-08. Drift check: every one of the 13 agent files held its card "allowed-tools now" set, none had a tools key or the marker, skill line 20 still held the token, and `git diff --quiet HEAD` was clean for every file to edit.

## Edit list as applied

C1 APPLY-ALL: all 13 rows of the card got a `tools:` list, in the order of the allowed-tools list, directly after the allowed-tools block, preceded by one comment line. `allowed-tools` is unchanged (the repo mirror stays; the host still warns that it is not recognized).

| Group | Agents |
|-------|--------|
| NW (9) | analogy-query-fetcher, brain-query, chain-step-reviewer, competitor-watch-fetcher, grading, grant-reviewer, investor, meeting-perspective-extractor, vault-section-reviewer |
| W (4) | framework-runner, opportunity-scanner, persona-analyst, research |

- Brain entries were rewritten from `mcp__mindrian-brain__X` to `mcp__plugin_mos_mindrian-brain__X` (brain-query, grading, investor, persona-analyst, research). Other entries (tavily, tavily-mcp, pinecone-brain, built-in tools) stay as written, as the card says.
- No agent loses a tool its body uses: the body-outside-list column of the card is empty for all 13 rows (hand reviewed in plan 391-04). A tool a body uses without naming it is UNVERIFIED.
- No Brain tool was added to an agent that had none (arm A13 checks this).

C5 REMOVE: line 20 of `skills/intelligence-orchestrator/SKILL.md` now reads `allowed-tools: Read Bash Agent WebSearch WebFetch mcp__pinecone__search-docs`. The PENDING_OWNER entry is deleted (list is now empty). Line 108 of the skill body still names `mcp__brain_*` in prose; the card and plan scope the edit to line 20 only.

## RED and GREEN

RED 1 (commit 52e1f868e): test with constants from the C1 rows and arms A10, A12, A13. Output: `FAILED: 26 passed, 26 failed`. The 13 agents each failed A10 ("no tools list") and A12 ("has allowed-tools but neither tools nor 391-NOTE-allowed-tools-not-enforced").

GREEN 1 (commit 7722ac58c): after the 13 edits, `PASSED: 53 passed, 0 failed` (the one PENDING A4 line still printed for the skill at that point).

RED 2 (commit 58d494d9d): PENDING_OWNER entry deleted. Output: `FAIL A2 A3 A4 A4 skills/intelligence-orchestrator/SKILL.md (allowed-tools) -- glob is not mcp__SERVER__*: mcp__brain_*` and `FAILED: 52 passed, 1 failed`.

GREEN 2 (commit ca10a1cd1): skill edited. `PASSED: 53 passed, 0 failed`; the test proves the token is gone (arm A4 scans the skill line, the pending list is empty, A5 reports 0 entries). Arm A11 (marker set) is not part of the test: under APPLY-ALL no agent is in NOTE_SET, as the plan says. Arm A12 stays as a rule that fails any agent with allowed-tools and neither a tools list nor the marker. The old Tier B print for this case became that failure.

## Part 11 generators and gates

- `node scripts/build-skill-mirrors.cjs` (run once, wrote nothing: created 0, overwritten 0) then `--check`: OK, 112 mirrors match.
- `node scripts/build-connector-registry.cjs --check`: OK (after agent edits and after skill edit).
- `node scripts/build-orchestration-projection.cjs --check`: OK.
- `node scripts/check-render-coverage.cjs`: 17 covered, 0 gap; md-keyspace 198 wired, 0 unwired.
- `claude plugin validate .`: "Validation passed with warnings" (the CLAUDE.md and tsc digest warnings are expected and unrelated).
- `bash tests/run-all-391.sh`: PASS=8 FAIL=0.
- `tests/test-361-agent-contract.cjs`, `tests/test-391-hooks-contract.cjs`, `tests/test-orchestrator-doctrine-presence.cjs`: pass.
- The pre-commit hook printed 51 advisory shape-declaration WARN lines. They exist at HEAD before this plan and none names a file changed here for a new reason.
- dist/ was not regenerated. The pre-commit hook run also left no dist change.

Tests that read the edited agents: 70 test files mention an edited agent. 56 pass. 14 fail (test-252-guard-census, test-348-caller-matrix, test-359-forward-harness, test-363-runner-contract, test-3696-isolation, test-383-sourced-number, test-auto-explore-canon-part-8, test-auto-explore-fingerprint, test-auto-explore-telemetry, test-connector-exhaustive-coverage, test-connector-filing-sweep, test-harness-167-verdict, test-l8g-theo-bare, test-new-surface-generator). All 14 fail the same way with the 13 agents restored to their HEAD content, so they are pre-existing and not caused by this plan. Also test-209-declared-implies-wired fails at HEAD (its fixed list of advisory contradictions has changed) and fails the same after the skill edit; test-209 was run against the HEAD skill to confirm. These are not fixed here (out of scope).

## Probe

Not run. The plan makes the live probe optional and the dispatching instruction forbids any network call. The restriction semantics were PROVEN in plan 391-04 (an agent with `tools: Read, mcp__plugin_mos391probe_mindrian-brain__*` kept 7 tools). UNVERIFIED: the real plugin name `mos` in the real install (proven by substitution of the plugin name only).

## Desktop copy note (risk recorded on card C1)

The Desktop copy is published as marketplace entry `mos-desktop`. UNVERIFIED: if the host builds the tool name prefix from the entry name, the Desktop copy would see `mcp__plugin_mos-desktop_mindrian-brain__*`, and the five Brain-using agents (brain-query, grading, investor, persona-analyst, research) would lose their Brain tools there. They would return an honest refusal to the caller, not a wrong answer. The owner chose APPLY-ALL with this caveat on the card. Before the next release that includes the Desktop copy, a person should check how the Desktop copy names its tools.

## Deviations from Plan

None. The plan was executed as written. The optional live probe was skipped by instruction (no network call).

## Commits

| Step | Commit |
|------|--------|
| C1 RED test | 52e1f868e |
| C1 GREEN agents | 7722ac58c |
| C5 RED test | 58d494d9d |
| C5 GREEN skill | ca10a1cd1 |

The SUMMARY commit follows this file.

## State

Nothing was pushed, tagged or released. Versions, CHANGELOG.md, STATE.md, ROADMAP.md, REQUIREMENTS.md and dist/ are unchanged. The change is on main only and is not live until a release is cut and picked up. Cards C2, C3, C4 and C6 were not touched (plan 391-08).

## Known Stubs

None.

## Threat Flags

None. No network call, no new endpoint or file access pattern. Arm A13 and the card rows prevent widening an agent.

## Self-Check: PASSED

All 15 modified files exist; commits 52e1f868e, 7722ac58c, 58d494d9d and ca10a1cd1 are in git log.
