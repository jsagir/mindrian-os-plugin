# Quick 261109-rdr Summary: screen Claude Code 2.1.321 and advance the ledger mark

Result: the ledger now covers 2.1.128 through 2.1.321. Four rows were added for 2.1.321 (three dormant, one no-op). The mark moved from 2.1.319 to 2.1.321 with a complete fetch. The file has no 2.1.320 entry.

## What ran

- Input: output of the second live ask-first fetch (one public GET, no room data). 118 bullets for 2.1.321. Coverage: complete, 1192343 of 1192343 characters, 438 headers. The text was treated as data only. No network call in this task.
- fetched_at = 2026-11-09T19:51:53Z, from the audit record ts in ~/.mindrian/radar-audit/.mindrian/research-audit.jsonl (run_id radar-changelog-mw9ogbbs-5727f0).
- RED first: tests/test-391-ledger-2-1-321.cjs failed with 47 failures before the ledger edit and passes 71 of 71 after.

## Rows added

| Row | Bullets | Status | Destination |
|-----|---------|--------|-------------|
| mods-tool-calls-no-prompt-and-auto-enable | 94, 95 | dormant | hooks/mos-face.json |
| mcp-connected-no-tools-reconnect-fix | 49, 15 | dormant | .mcp.json |
| desktop-same-name-mcp-disconnect-fix | 33 | dormant | .mcp.json |
| plugins-update-redownload-and-name-guards | 17, 98, 67 | no-op | .claude-plugin/plugin.json |

Each claim was checked against the bullet text before writing. Open items kept honest in the row text: the dontAsk load check of the face panel is owed to Phase 392 or a later mod phase; the real mos-desktop install test is still owed and the Desktop row does not claim a fix for us; the mindrian-os tool count was not re-counted, the row says "large tool list" and Phase 392 owns the number.

## No-action items (in coverage_gap, not rowed)

- Fable 5.2 model (bullet 1): no file pins or uses a Fable model. The only repo hits are the fable-mode naming concept and a guard in scripts/forward-fork-scenarios-359.cjs that refuses the Fable family.
- Cowork PostToolUse cannot replace the AskUserQuestion answer (bullet 110): hooks/hooks.json has no AskUserQuestion matcher anywhere. Its PostToolUse matchers are Write|Edit|MultiEdit, Grep|Glob and one Brain tool pattern.

## ASCII check of command and skill names

Plugin-name guard (bullet 67): 113 command files, 125 skill folders and 231 frontmatter name fields were checked. No non-ASCII character in any of them.

## Changes

- data/capability-ledger.json: 4 rows; ledger_covers.to and installed_claude_version 2.1.321; fetched_at; fetch_coverage; coverage_gap with the new sentence first.
- references/capability-radar/changelog-cache.md: rendered view (header, provenance, 4 sections, screened-out line).
- tests/test-391-ledger-2-1-321.cjs: new test.
- tests/test-391-ledger-2-1-319.cjs and tests/test-391-ledger-rows.cjs: the arms that pinned the 2.1.319 mark now check "at or above 2.1.319"; the exact 2.1.321 values live in the new test.

## Deviations from Plan

The caller wording for the PostToolUse no-action said "only Write|Edit|MultiEdit matchers". The file also has Grep|Glob and a Brain pattern. The ledger text states the real matchers. None of them matches AskUserQuestion, so the conclusion holds.

## Verification

- node tests/test-391-ledger-2-1-321.cjs: 71 passed, 0 failed.
- node tests/test-391-ledger-2-1-319.cjs: 61 passed. node tests/test-391-ledger-rows.cjs: 74 passed. node tests/test-391-doctor-ledger-gap.cjs: 10 checks, 0 failures.
- node tests/test-265-capability-ledger-schema.cjs: PASSED (71 rows). node tests/test-265-ledger-freshness.cjs: PASSED (real organ ok, within 0 patch versions).
- bash tests/run-all-391.sh: PASS=10 FAIL=0. bash tests/run-all-265.sh: PASS=26 FAIL=0. All with env -u MINDRIAN_EUREKA_ROOT and a scratch HOME.
- Doctor organ: installed 2.1.321, ledger_covers.to 2.1.321, lag 0, limit 20.
- No non-ASCII character in the touched files.

## Known Stubs

None.

## Self-Check: PASSED

Files exist and tests pass. STATE.md, ROADMAP.md, REQUIREMENTS.md and CHANGELOG.md untouched. No STATE.md Quick Tasks row was added.
