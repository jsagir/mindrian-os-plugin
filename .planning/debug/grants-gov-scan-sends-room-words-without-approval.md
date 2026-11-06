---
status: fixing
kind: rca
trigger: "grants-gov-scan-sends-room-words-without-approval"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-11-06T13:00:00Z
updated: 2026-11-06T13:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` working tree of /home/jsagi/dev/MindrianOS-Plugin-release, after commit 8d793693b (Phase 386 plan 23)
- **WIRE claims probe against:** none. `globalThis.fetch` was replaced with a counter. 0 requests left the process. The fixture room is synthetic and lives in os.tmpdir (Canon Part 8).
- **Date of audit:** 2026-11-06
- **Re-verification rule:** code is cited by symbol name. Phases 384 and 385 edit nearby files.

## Current Focus

hypothesis: `scanOpportunities` in lib/core/opportunity-ops.cjs builds a keyword from room words and sends it to 2 funding APIs with no approval, no credential check and no audit record, because the 2026-10-05 gate was never applied to this older path.
test: Call `scanOpportunities` on a synthetic fixture room with a fetch counter. Count requests, list body key names, test for a synthetic marker word.
expecting: 2 requests, the marker word in both bodies, no audit file.
next_action: Pin the test (RED), then add the gate from lib/core/web-path-gate.cjs to `scanOpportunities`.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Reported by: EGRESS-CLAIMS-CHECK.md claim (h) and the owner decision of 2026-11-06 (card answer "Extend the ruling")
- Date first observed: 2026-11-06
- Related debug sessions: web-paths-no-approval-or-audit-record (plan 386-22, the shared gate), whitespace-external-semantic-scholar-ungated-egress (plan 386-05)

## Problem Statement

The funding search path sends words taken from the room to 2 third-party APIs. The 2026-10-05 ruling names the research lines only. This path was never traced, so no one knew which words leave.

## Symptoms

- `scanOpportunities` sends 2 requests on every call.
- The keyword holds words from the room (domain keywords and 3 words from the first sentence of the problem text).
- No approval step exists in any caller. No audit record is written.
- The unattended scheduled scan calls it with no human present.

## Scope and Impact

- Surfaces: CLI (`scripts/mindrian-tools.cjs opportunity scan`), MCP (`data_room` command `scan-opportunities`), the scheduled scan, the agent text.
- Impact: room words leave the machine with no list shown first and no record.
- Not a Brain line. The owner decision of 2026-11-06 applies: approval first, then a credential check, plus the audit record. No content scan.

## Eliminated

- A Brain call: the path calls only the two funding hosts. PROVEN by reading the 2 search functions.
- Room text in the request beyond the keyword: the grants.gov body holds `keyword`, `oppStatuses`, `rows`, `sortBy` and optional `fundingCategories`. The categories are codes from a fixed map (DOMAIN_CATEGORY_MAP), not room words. The simpler-API body holds `query`, `filters`, `pagination`. PROVEN.

## Evidence

Traced words (PROVEN, read from `buildGrantQuery`, `searchGrantsGov`, `searchSimplerGrants`, `scanOpportunities`):

- Fields that feed the keyword: `domain_keywords` from STATE.md frontmatter (all of them), plus up to 3 words (5 or more letters, stop words removed) from the first sentence of the files under `problem-definition/`.
- Keyword cap: 100 characters (97 plus an ellipsis when longer). The simpler-API request slices it to 100 again.
- Geography and venture stage are read but go only into local scoring. They are not in a request body.
- Endpoint 1, https://api.grants.gov/v1/api/search2: body key `keyword` (the keyword) and `fundingCategories` (codes).
- Endpoint 2, https://api.simpler.grants.gov/v1/opportunities/search: body key `query` (the keyword).

Reproduction on a synthetic fixture room, fetch replaced by a counter (PROVEN, 2026-11-06):

- Requests made by one `scanOpportunities` call: 2.
- Body key names: `keyword, oppStatuses, rows, sortBy` and `query, filters, pagination`.
- A synthetic marker word placed in the fixture problem text was in both bodies: true, true.
- Audit file written: none (no `.mindrian` directory).

Callers of `scanOpportunities` (PROVEN by grep):

| Caller | Mode | How a user sees an approval step |
|--------|------|-----------------------------------|
| lib/mcp/tool-router.cjs, `data_room` command `scan-opportunities` | interactive (Desktop, Cowork, CLI through MCP) | The result returns the exact strings and the token. The model shows them and calls again with the token in the `section` argument. |
| scripts/mindrian-tools.cjs, `opportunity scan ROOM` | interactive (CLI) | The printed JSON holds the strings and the token. A second call adds `--approve TOKEN`. |
| lib/core/scheduled-scanner.cjs, `scanAndFileGrants` (also `runAllScans`) | unattended | None. It must stop and record a typed skip. |
| agents/opportunity-scanner.md, Step 3 | agent text | Needs one approval step before the call. |

## Technical Root Cause

The 2026-10-05 gate (an approval card, a credential check, the audit record) was built for the research planner web lines. `scanOpportunities` and its 3 callers were never given it. The path has no list step, no token check, no credential check and no `appendAudit` call. Plan 386-22 now provides lib/core/web-path-gate.cjs for exactly this case.

## Required Code Changes

1. `scanOpportunities(roomDir, opts)` in lib/core/opportunity-ops.cjs: list the strings for the 2 requests, compute the token with `approvalToken`, return `approval_required` and send nothing unless `opts.approval` passes `checkApproval`. Run `credentialCheck` on every string before any request. Call `recordSent` once per request with that request's string and outcome. No content scan.
2. lib/core/scheduled-scanner.cjs `scanAndFileGrants`: when the result holds `approval_required`, write no search, record a typed skip with reason `approval_required` and do not throw.
3. lib/mcp/tool-router.cjs and scripts/mindrian-tools.cjs: pass an optional approval value through. Return `approval_required` unchanged.
4. agents/opportunity-scanner.md: one approval step before the call, between the marker comments, without the word grant in it.

## Tests to Add or Update

- tests/test-386-grants-gov-approval.cjs, arms GG1 to GG8 (GG1 to GG4 and GG6 to GG8 fail before the fix).
- Existing suites that read opportunity-ops or the scheduled scanner: run and record.

## Non-Code Follow-ups

- On resolve (plan 386-21): move this file to `.planning/debug/resolved/` and add the knowledge-base block.
- The scheduled scan stops until an approval exists. A standing approval for unattended runs is a later owner decision and is not planned here.

## Resolution

root_cause: the 2026-10-05 gate (approval card, credential check, audit record) was never applied to scanOpportunities and its callers. The path listed nothing, checked no token, checked no credential and wrote no audit record. The 2 requests carried the room keyword (domain keywords plus 3 problem words, 100 characters at most). Confirmed by static read and fixture reproduction (2 requests, marker word in both bodies, no audit file).
fix: scanOpportunities(roomDir, opts) lists the exact strings and a token (approval_required) and sends nothing unless opts.approval matches (web-path-gate approvalToken and checkApproval). credentialCheck runs first and a hit returns refused with no bytes echoed. Each request gets one recordSent record (provider grants_gov; outcome ok, empty_valid or failed). The scheduled scan writes a skip file with reason approval_required and sends nothing. The MCP route takes the token in the section argument; the CLI takes --approve TOKEN. agents/opportunity-scanner.md has the approval step between marker comments, without the word grant. No content scan was added.
verification: node tests/test-386-grants-gov-approval.cjs arms GG1 to GG8 pass (RED commit failed all 8); bash tests/run-all-386.sh 21 of 21 pass; test-363-audit-ledger 5 of 5; test-363.1-agent-isolation, test-250-doctrine-fence, test-276-room-content-honesty, test-265-scout-competitor-fanout, test-scout-cadence-fires, test-phase-13.sh (32 of 32) pass; build-connector-registry --check and check-render-coverage pass. test-connector-part8-boundary CHECK 2 fails on the registry field "layer" of mcp:artifact_file, a file this plan did not touch (logged, not fixed).
files_changed: lib/core/opportunity-ops.cjs, lib/core/scheduled-scanner.cjs, lib/mcp/tool-router.cjs, scripts/mindrian-tools.cjs, agents/opportunity-scanner.md, tests/test-386-grants-gov-approval.cjs
commits: 0149225cd (RCA), ce05bffaf (RED), 0e5fc4523 (fix)
