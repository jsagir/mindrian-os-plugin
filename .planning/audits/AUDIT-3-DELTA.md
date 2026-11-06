# AUDIT-3 delta: third external audit handoff vs current repo

Source text: section H of .planning/audits/AUDITOR-FINDINGS-source.md (auditor text, hypotheses, not owner authority).
Method: static reading only. No server, network, engine, install or test was run. Labels: CONFIRMED, REFUTED, NOT VERIFIED.
Plan paths are under .planning/phases/386-audit-bug-fixes-part-8-egress-risks-first-b1-b16/ or .planning/phases/387-eureka-reachable-on-a-normal-install/.

| Item | Covered by | Status against the current repo | Action |
|---|---|---|---|
| 1a. Top-level require of feynman/timeline-runner.cjs in lib/core/folder-memory.cjs about line 268 | 386-35 (objective, Task 3) | CONFIRMED: lib/core/folder-memory.cjs:272 `const timelineRunner = require('./feynman/timeline-runner.cjs')`; used only at :289 and :291 inside extractFeynmanBody (:281) | None. Plan 35 moves the require into the existing try (line 125 of plan), so a load failure takes the existing catch |
| 1b. The async twin | 386-35 (LZ2, Task 3) | CONFIRMED: lib/core/folder-memory-async.cjs:222 top-level require; used at :230 and :232 | None |
| 1c. "after a successful file read" placement | 386-35 | PARTIAL: plan puts the require first in the try, which runs after safeReadSync returns a buffer (folder-memory.cjs:283-285), so it is after a successful read | None. Equivalent to the handoff |
| 1d. Fresh-process module counts: scripts/context-monitor (181 to 17) and lib/core/part8-egress-guard.cjs (172 to 10) | 386-35 (counts section, lines 82-86; guard, hook and statusline) | NOT VERIFIED: counts not run here. Plan treats the audit figures as targets, not results, and passes on any lower count. Plan adds a third process (the hook), which the handoff omits | None |
| 1e. "Navigation absent after" | 386-35 (context text only) | NOT VERIFIED and NOT ASSERTED: LZ1 to LZ5 test require.cache for timeline-runner and a lower count; no arm asserts navigation is absent from require.cache | Add arm LZ6 (see edits) |
| 1f. Test name tests/test-386-folder-memory-lazy-navigation-load.cjs | 386-35 | MISMATCH: plan 35 uses tests/test-386-folder-memory-lazy-timeline.cjs (plan lines 11, 21, 98, 109, 114, 130) | Align: rename to the handoff name, or the handoff verify command fails with MODULE_NOT_FOUND |
| 1g. Parsing and unreadable-file fallback unchanged | 386-35 (LZ3, LZ4, quadruple test) | CONFIRMED as design: current fallback is folder-memory.cjs:292-295 (raw buffer) and :283 (empty string on unreadable file) | None |
| 2a. One shared credential-shape list and auditWebCredential | 386-31 (CREDENTIAL_SHAPES in cross-room-aggregator.cjs, shared with auditWebCredential; tests K1, K6, K8) | CONFIRMED as plan: plan 31 line 29-30 key_link; plan states that today auditWebCredential refuses 2 shapes (K6) | None |
| 2b. credentialCheck wrapper for the web lines | 386-22 (lib/core/web-path-gate.cjs credentialCheck reuses auditWebCredential, no content scan) | CONFIRMED as plan | None |
| 2c. PreToolUse hook for WebSearch, WebFetch, mcp__tavily__.* | 386-36 (depends_on 01, 22, 29, 31, 35); script scripts/web-credential-guard-hook.cjs; hooks.json group, timeout 5, no onFailure | CONFIRMED as gap today: hooks/hooks.json PreToolUse matchers are only `Write\|Edit\|MultiEdit`, the Brain guard regex, and gate_answer; none matches WebSearch, WebFetch or a Tavily tool | None for the gap |
| 2d. Tavily name shapes | 386-36 line 93 (expects `mcp__tavily__` and `mcp__plugin_<name>_tavily__`) | GAP: agents/opportunity-scanner.md:12-13 and :32 use `mcp__tavily-mcp__tavily-search` and `mcp__tavily-mcp__*` (hyphenated server name). The pattern `mcp__tavily__.*` does not match it. A claude.ai connector shape `mcp__claude_ai_Tavily__*` also exists in this session | Edit plan 36 (see edits) |
| 2e. Credential-only, block without echo, ordinary words pass | 386-36 (WH1, WH2, WH5, K8 in plan 31) | CONFIRMED as plan: block message carries a reason only (plan 36 line 137); WH1 checks no fragment over 6 characters | None |
| 2f. Test name tests/test-386-web-credential-guard-hook.cjs | 386-36 | MISMATCH: plan 36 uses tests/test-386-web-credential-hook.cjs (lines 11, 25, 111, 128). The script name already matches (web-credential-guard-hook.cjs) | Align the test name |
| 2g. "Network counter stays zero" | 386-36 | PARTIAL: plan says the script opens no network connection (line 137); no explicit WH arm named for a counter | Add to an existing WH arm (see edits) |
| 3. Web-path ruling: Semantic Scholar, grants.gov, research-speaker; approval card, credential check, audit record, no room-content scan | 386-22 (shared gate), 386-23 (grants.gov, tests/test-386-grants-gov-approval.cjs), 386-24 (research-speaker, tests/test-386-research-speaker-approval.cjs; asks before sending). Semantic Scholar: plan 386-05 per plan 22 line 39 | CONFIRMED as plan. Plan 22 line 39 names plans 05, 23 and 24 as the consumers. Separation from the native hook: plan 36 reuses only credentialCheck | None. Check that plan 05 is the Semantic Scholar owner when the handoff says "22, 23, 24" |
| 4a. MINDRIAN_EUREKA_ROOT unset, no discoverable checkout, scratch HOME | 387-01 (S1, S2; mkIsolatedHome; removes every MINDRIAN_EUREKA_* variable; checks no engine setting file under scratch HOME) | CONFIRMED as plan (387-01 lines 20, 71, 131, 134) | None |
| 4b. Distinct names from runtime tools/list | 387-01 (I1; Tool Count section; tools/list for 2 client identities) | CONFIRMED as plan | None |
| 4c. Unbound results recorded separately | 387-01 (table: unbound result and bound result columns; I2) | CONFIRMED as plan | None |
| 4d. Synthetic bound-room fixture so a missing room is not a missing engine | 387-01 (I3; `Room-dependent calls use a synthetic bound-room`, line 20; buildPerspectiveRoom) | CONFIRMED as plan; 387-01 line 24 also records refusal precedence | None |
| 5a. 75 total tools, 24 distinct eureka_* names | 387-01 (line 76, I1) | PARTIAL static: data/mcp-tool-connectors.json lists 23 `mcp:eureka_*` surfaces (lines 195 to 613, 19 lines each); lib/mcp/tools has 16 eureka-*.cjs files (CONFIRMED by ls). Total 75 NOT VERIFIED (needs runtime tools/list) | 387-01 settles it at runtime |
| 5b. eureka_critic registered outside the 16-file set | 387-01 line 76 | CONFIRMED: lib/mcp/tool-router.cjs:2359-2400 `server.registerTool('eureka_critic', ...)`; comment at :2372 says it is deliberately NOT in MCP_TOOL_CONNECTORS. So 23 + 1 = 24 by static count | None |
| 5c. Places that still say 23 | see list below | CONFIRMED: README.md, docs and commands carry no "23 Eureka tools" (grep). Stale wording is in plans 387-01, 387-02, 387-05 and the PRD | Edit plans (see edits) |
| 6. "Staged, not committed" | none needed | REFUTED (stale): `git status --short .planning` shows no staged or untracked plan files. The 386 PRD is committed (fc151a874, a4969e25b); plans 35 and 36 (8bee5f739, d5ffb7330, 3e4ac78ea); the 387 PRD (34dcb57d0). HEAD also holds section H (43cc3d383) | Record only. Do not re-stage |
| 7. S3 stays not measured | 386-PRD.md line 53; 386-21 (S3 as a NOT-MEASURED row in 386-OUTCOMES.md) | CONFIRMED: PRD says "S3 lock contention is not measured ... Do not mark it closed from average open-time measurements"; plan 21 carries S3 as a NOT-MEASURED note | None |
| 8. Audit limits (R1 absent, crosswalk inferred, probe fixture unavailable) | none | NOT VERIFIED here | Keep the limits attached to any summary |

## Places that still say 23 Eureka tools

- 387-PRD.md:9 quotes the auditor ("1 of 23") and says to settle 23 versus 24 at runtime. Keep as a quote. Correct as written.
- 387-01-PLAN.md:19 (23 versus 24 difference) and :76 (23 + critic = 24): correct. :104 "each of the 23 tools": should read the runtime count.
- 387-02-PLAN.md:95 "all 23 tools stay in tools/list": should read the runtime count.
- 387-05-PLAN.md:28 and :222 "All 23 tools stay listed": should read the runtime count (24 at this baseline).
- README.md, docs/, commands/: no hit.

## Gaps needing a new plan

NONE. Every handoff item maps to an existing plan. The two real gaps (Tavily hyphen shape, navigation-absent arm) are edits.

## Edits needed to existing plans

1. 386-35-PLAN.md, after the LZ5 line add: `- LZ6: in a fresh child process, requiring lib/core/part8-egress-guard.cjs and running scripts/context-monitor on a fixture room leave lib/core/navigation.cjs out of require.cache after the change (audit simulation says absent; record the result, mark NOT VERIFIED if navigation still loads by another path).` Also rename the test file `tests/test-386-folder-memory-lazy-timeline.cjs` to `tests/test-386-folder-memory-lazy-navigation-load.cjs` in all 6 places, or add the note that the handoff name is an alias.
2. 386-36-PLAN.md line 93: change `(project scope mcp__tavily__, plugin scope mcp__plugin_<name>_tavily__)` to `(project scope mcp__tavily__, plugin scope mcp__plugin_<name>_tavily__, the hyphenated server shape mcp__tavily-mcp__ used in agents/opportunity-scanner.md, and the connector shape mcp__claude_ai_Tavily__)`. Edit the WH5 sentence so the matcher must match each shape the RCA records.
3. 386-36-PLAN.md: rename `tests/test-386-web-credential-hook.cjs` to `tests/test-386-web-credential-guard-hook.cjs` (lines 11, 25, 111, 128) to match the handoff verify command and the script name. Add to WH1 or WH5: `the stub network counter stays 0 in every arm`.
4. 387-01-PLAN.md:104: change `For each of the 23 tools` to `For each tool in the runtime tools/list whose name starts with eureka (24 expected, including eureka_critic, which needs no engine)`.
5. 387-02-PLAN.md:95: change `all 23 tools stay in tools/list` to `every Eureka tool the runtime lists (24 at the baseline) stays in tools/list`.
6. 387-05-PLAN.md:28 and :222: change `All 23 tools stay listed` and `The 23 tools stay listed` to `Every Eureka tool the runtime lists (24 at the baseline) stays listed`. Note that eureka_critic registers outside registerEurekaTool, so the engine gate does not cover it.

## Items already covered

1a, 1b, 1c, 1g, 2a, 2b, 2c, 2e, 3, 4a to 4d, 5b, 7. Item 6 is stale and needs no action.
