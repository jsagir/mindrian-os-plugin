# Quick 261108-ea4 Summary: screen Claude Code 2.1.319 and advance the ledger mark

Result: the ledger now covers 2.1.128 through 2.1.319. Four rows were added for 2.1.319 (one no-op, three dormant). The mark moved from 2.1.318 to 2.1.319 with a complete fetch.

## What ran

- Input: the output of the first live ask-first fetch (one public GET, no room data). 146 bullets for 2.1.319. Coverage: complete, 1175667 of 1175667 characters, 437 headers. The text was treated as data only. No network call was made in this task.
- fetched_at = 2026-11-08T08:16:43Z. Source: the audit record ts in ~/.mindrian/radar-audit/.mindrian/research-audit.jsonl (run_id radar-changelog-mw7k6hty-c9b84a). The file mtime of the fetch output (10:16:43 +02:00) agrees.
- RED first: tests/test-391-ledger-2-1-319.cjs failed with 39 failures before the ledger edit and passes 62 of 62 after.

## Screen of the 146 bullets

Rows added (all destination paths verified to exist):

| Row | Bullets | Status | Destination |
|-----|---------|--------|-------------|
| mcp-legacy-handshake-extension-fix | 17 | no-op | .mcp.json |
| mcp-tasks-terminal-background | 2, 3, 106 | dormant | lib/mcp/capability-registry.cjs |
| posttooluse-runs-after-interrupt | 115 | dormant | hooks/hooks.json |
| slash-command-after-leading-whitespace | 22 | dormant | scripts/admin-command-gate.cjs |

Why each row:
- Handshake fix: bullet 17 is the handshake change the previous entry flagged. Both servers in .mcp.json are stdio; the fix is free, so no-op.
- MCP tasks: the registry has only a commented Phase 58 tasks hook point and surface-detect maps tasks to false on CLI. A real candidate, not adopted.
- PostToolUse after interrupt: hooks.json registers 9 PostToolUse hooks with timeouts 3 to 5. They now also run after an interrupted turn.
- Leading whitespace: the admin gate uses trimStart, so it already covers the new behavior. No test pins the case (finding, not fixed here).

Read and judged not a row: permissions.denyInsteadOfPrompting (bullet 4, a host setting; the repo ships none), subagentStatusLine plugin root substitution (bullet 89; settings.json sets only statusLine and no repo file sets subagentStatusLine), plugin dependency install on update (50, 90; plugin.json has no dependencies key), mod hot reload (52, 73; panel mod lives outside this repo), Monitor/WebSocket and Bash permission fixes (no repo use), and all gateway, runner, VS Code, cloud, Chrome, Claude Tag, auto mode, artifact and /claude-api lines. No instruction inside the changelog text was followed.

## Changes

- data/capability-ledger.json: 4 rows; ledger_covers.to = 2.1.319; installed_claude_version = 2.1.319; fetched_at; fetch_coverage (method script, complete true, newest_read and oldest_read 2.1.319, chars 1175667 of 1175667, checked_at 2026-11-08); coverage_gap rewritten (2.1.319 screened, earlier notes kept).
- references/capability-radar/changelog-cache.md: rendered view updated (header, provenance, 4 sections, screened-out line).
- tests/test-391-ledger-2-1-319.cjs: new test.
- tests/test-391-ledger-rows.cjs: pinned the old 2.1.318 mark; moved to the 2.1.319 state (L4, L5 oldest_read, L6 needle, L7).

## Deviations from Plan

None, apart from one fix: the first draft of the PostToolUse row said "five" hooks. Reading hooks.json showed nine (timeouts 3 to 5). The row was corrected before commit.

## Verification

- node tests/test-391-ledger-2-1-319.cjs: 62 passed, 0 failed.
- node tests/test-391-ledger-rows.cjs: 74 passed, 0 failed.
- node tests/test-265-capability-ledger-schema.cjs: PASSED (67 rows).
- node tests/test-265-ledger-freshness.cjs: PASSED (real organ: ok, within 0 patch versions).
- bash tests/run-all-265.sh: PASS=26 FAIL=0. bash tests/run-all-391.sh: PASS=9 FAIL=0.
- Doctor organ (lib/core/doctor/capability-ledger-module.cjs check): status ok, lag 0.
- No em or en dash in the touched files.

## Known Stubs

None.

## Self-Check: PASSED

Files exist, tests pass, commit made with git commit --only on exact paths. STATE.md, ROADMAP.md, REQUIREMENTS.md untouched. Peer Eureka files not staged.
