---
phase: 13-opportunity-bank-funding-room
verified: 2026-03-25T03:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 13: Opportunity Bank + Funding Room Verification Report

**Phase Goal:** The Data Room proactively discovers grant opportunities and tracks funding lifecycle — accessible from both CLI plugin and MCP server
**Verified:** 2026-03-25
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | opportunity-bank/ and funding/ are discovered by section-registry as extended sections | VERIFIED | `node -e` live check: `extended: [ 'funding', 'opportunity-bank' ]` — both present |
| 2 | opportunity-ops.cjs module loads without error and exports all required functions | VERIFIED | 13 exports confirmed via live `node -e` assertion loop: all functions present |
| 3 | Test fixtures provide a realistic room with opportunity-bank and funding content | VERIFIED | `tests/fixtures/sample-room-opp/opportunity-bank/2026-03-20-nsf-sbir.md` + `funding/nsf-sbir-phase1/STATUS.md` exist with full frontmatter |
| 4 | Reference templates define artifact frontmatter schema and lifecycle stages | VERIFIED | `opportunity-template.md` has `methodology: opportunity-scan`; `funding-lifecycle.md` has `Discovered --> Researched --> Applying --> Submitted` |
| 5 | User can run /mos:opportunities scan and receive context-driven grant results | VERIFIED | `commands/opportunities.md` documents full scan flow; `scanOpportunities` calls both APIs with room-derived queries via `buildGrantQuery` |
| 6 | User can confirm or reject discovered opportunities with reason capture | VERIFIED | `fileOpportunity` and `rejectOpportunity` both export from module; confirm-first pattern documented in `commands/opportunities.md` |
| 7 | Filed opportunities appear as room artifacts with relevance scores and source provenance | VERIFIED | CLI `opportunity list` returns `{ relevance_score: 0.85, status: 'discovered', funder: 'National Science Foundation' }` from fixture |
| 8 | analyze-room outputs opportunity-bank intelligence when section is present | VERIFIED | Live run: `## Opportunity Bank`, `OPP_STATUS:discovered:1`, `OPP_TOP_RELEVANCE:2026-03-20-nsf-sbir.md:0.85:...`, `FUND_STAGE:researched:1` |
| 9 | All opportunity operations work via both CLI and MCP | VERIFIED | `bin/mindrian-tools.cjs` has `opportunity` command group; `tool-router.cjs` registers `scan-opportunities`, `list-opportunities`, `file-opportunity` |
| 10 | User can create a funding entry and advance it through 4 stages | VERIFIED | `createFunding`, `updateFundingStage` exported and tested — sequential validation enforced (no skip, no backward) |
| 11 | Funding STATE.md aggregates pipeline status with deadlines and next actions | VERIFIED | `computeFundingState` writes STATE.md with count-by-stage, deadline tracking, 14-day staleness detection |
| 12 | All funding operations work via both CLI and MCP | VERIFIED | CLI `funding list/create/advance/status/outcome/compute-state` in `bin/mindrian-tools.cjs`; MCP `list-funding`, `create-funding`, `update-funding-stage` in `tool-router.cjs` |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/core/opportunity-ops.cjs` | Core module: 13 exported functions | VERIFIED | All exports confirmed: listOpportunities, listFunding, parseOpportunityFrontmatter, parseFundingStatus, getOpportunityBankState, getFundingState, buildGrantQuery, searchGrantsGov, searchSimplerGrants, scanOpportunities, fileOpportunity, rejectOpportunity, createFunding, updateFundingStage, setFundingOutcome, computeFundingState, computeOpportunityBankState |
| `references/opportunities/opportunity-template.md` | Frontmatter schema with `methodology: opportunity-scan` | VERIFIED | 73 lines, contains `methodology: opportunity-scan` |
| `references/opportunities/funding-lifecycle.md` | 4-stage lifecycle `Discovered > Researched > Applying > Submitted` | VERIFIED | 69 lines, contains full lifecycle definition |
| `references/opportunities/grant-api-patterns.md` | API query patterns, contains `grants.gov` | VERIFIED | 77 lines, documents both Grants.gov and Simpler Grants endpoints |
| `commands/opportunities.md` | `/mos:opportunities` command with scan/list/file | VERIFIED | 52 lines, full confirm-first UX documented |
| `commands/funding.md` | `/mos:funding` command with 5 subcommands | VERIFIED | 40 lines, all subcommands documented |
| `agents/opportunity-scanner.md` | Proactive discovery agent, contains `context-driven` | VERIFIED | 47 lines, "context-driven" confirmed in line 3 |
| `scripts/compute-opportunity-state` | Bash wrapper script, executable | VERIFIED | `-rwxr-xr-x`, wraps `mindrian-tools.cjs opportunity compute-state` |
| `tests/fixtures/sample-room-opp/` | Test room with both sections populated | VERIFIED | opportunity-bank + funding/nsf-sbir-phase1 present with full frontmatter |
| `tests/test-phase-13.sh` | Phase 13 test suite | VERIFIED | 32 assertions, 0 failures on live run |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/core/opportunity-ops.cjs` | `lib/core/section-registry.cjs` | `require('./section-registry.cjs')` | WIRED | Line 11: `const { discoverSections } = require('./section-registry.cjs')` |
| `lib/core/opportunity-ops.cjs` | `https://api.grants.gov/v1/api/search2` | `fetch` in `searchGrantsGov` | WIRED | Line 381: URL and fetch call confirmed, 10-second timeout implemented |
| `lib/core/opportunity-ops.cjs` | `https://api.simpler.grants.gov/v1/opportunities/search` | `fetch` in `searchSimplerGrants` | WIRED | Line 435: URL and fetch call confirmed |
| `commands/opportunities.md` | `lib/core/opportunity-ops.cjs` | instructs Claude to call `mindrian-tools.cjs opportunity` subcommands | WIRED | Command file documents `mindrian-tools opportunity scan/list/file` |
| `lib/mcp/tool-router.cjs` | `lib/core/opportunity-ops.cjs` | `require('../core/opportunity-ops.cjs')` in data_room handler | WIRED | Lines 197/202/207/219/224/239: inline require per handler case |
| `bin/mindrian-tools.cjs` | `lib/core/opportunity-ops.cjs` | top-level `require` | WIRED | Line 16: `const opportunityOps = require('../lib/core/opportunity-ops.cjs')` |
| `lib/core/opportunity-ops.cjs createFunding` | `room/funding/{slug}/STATUS.md` | `fs.writeFileSync` with wikilink | WIRED | Fixture confirms `source_opportunity: "[[opportunity-bank/2026-03-20-nsf-sbir]]"` |
| `scripts/analyze-room` | `room/opportunity-bank/*.md` | frontmatter parsing for status/relevance/deadlines | WIRED | Lines 315-417: Section 5 implemented with OPP_STATUS, OPP_TOP_RELEVANCE, FUND_STAGE tokens |
| `scripts/compute-opportunity-state` | `bin/mindrian-tools.cjs opportunity compute-state` | shell call | WIRED | Script body confirmed: calls node bin/mindrian-tools.cjs |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| OPP-01 | 13-01 | New room/opportunity-bank/ section with ICM-standard filing, frontmatter, and cross-references | SATISFIED | Section pre-assigned in section-registry.cjs; opportunity-template.md defines frontmatter schema; test fixture populated; opportunity-ops.cjs lists and parses |
| OPP-02 | 13-02 | Proactive grant scanning via Grants.gov REST API from room intelligence | SATISFIED | `searchGrantsGov` POSTs to `https://api.grants.gov/v1/api/search2`; `buildGrantQuery` reads room STATE.md + problem-definition for context; `scanOpportunities` orchestrates both APIs via `Promise.allSettled` |
| OPP-03 | 13-02 | Discovered opportunities filed as room artifacts with relevance scoring and source provenance | SATISFIED | `fileOpportunity` creates dated `.md` artifacts; multi-factor relevance scoring in `computeRelevance`; `source` and `source_url` fields in schema; `rejectOpportunity` captures rejection reason |
| OPP-04 | 13-02 | Opportunity Bank integrated into compute-state and analyze-room pipeline | SATISFIED | `scripts/analyze-room` Section 5 outputs `OPP_STATUS`, `OPP_TOP_RELEVANCE`, `FUND_STAGE` tokens; live run confirmed; `computeOpportunityBankState` writes STATE.md |
| FUND-01 | 13-01 | New room/funding/ section with per-opportunity tracking | SATISFIED | Section pre-assigned in section-registry.cjs; per-opportunity folder structure implemented with STATUS.md + metadata.yaml; `funding-lifecycle.md` defines schema |
| FUND-02 | 13-03 | Per-grant folders with lifecycle stages: Discovered > Researched > Applying > Submitted | SATISFIED | `updateFundingStage` enforces strict sequential transitions (no skipping, no backward); `FUNDING_STAGES` constant exported; invalid transition returns error — test 17 verifies |
| FUND-03 | 13-03 | Grant progress tracked in section STATE.md with deadlines, status, and next actions | SATISFIED | `computeFundingState` aggregates entries into `funding/STATE.md` with count-by-stage, deadlines sorted, 14-day staleness detection |
| FUND-04 | 13-03 | Cross-references between funding entries and opportunity-bank sources | SATISFIED | `createFunding` writes `source_opportunity: "[[opportunity-bank/{source}]]"` in STATUS.md; fixture `nsf-sbir-phase1/STATUS.md` confirms wikilink at line 4 and line 31 |

All 8 requirement IDs from PLANs 01/02/03 accounted for. No orphaned requirements.

---

### Anti-Patterns Found

No blockers or warnings found.

Scanned: `lib/core/opportunity-ops.cjs`, `bin/mindrian-tools.cjs`, `lib/mcp/tool-router.cjs`, `scripts/analyze-room`, `scripts/compute-opportunity-state`, `commands/opportunities.md`, `commands/funding.md`, `agents/opportunity-scanner.md`

- No `TODO`/`FIXME`/`PLACEHOLDER` comments in delivered artifacts
- No `return null`/`return {}` stub patterns in core functions
- No console.log-only implementations
- All API error handlers return empty results + error messages, never throw (graceful degradation confirmed)

---

### Human Verification Required

#### 1. Live Grant API Calls

**Test:** Run `/mos:opportunities scan` from a real room with a populated problem-definition and STATE.md. Let the full scan execute against both APIs.
**Expected:** Results table appears with funder, program, amount, deadline, and relevance score. Larry explains relevance reasoning for top matches.
**Why human:** Grants.gov and Simpler Grants are live external APIs. Response availability, rate limits, and actual result quality require a live internet call with a real room context.

#### 2. Confirm-First UX Flow

**Test:** After a scan returns results, respond with "review individually" and walk through each opportunity.
**Expected:** Larry presents each opportunity one at a time, waits for user to say "file" or "skip [reason]". Filing creates an artifact. Skipping captures the rejection reason in STATE.md.
**Why human:** The UX flow is conversational and depends on Larry's response quality — not verifiable by file inspection.

#### 3. Session-Start Opportunity Summary

**Test:** Open a room that has an opportunity-bank section and start a new session.
**Expected:** Larry's greeting includes a brief opportunity summary (upcoming deadlines, pipeline status) derived from the analyze-room output.
**Why human:** Session-start hook integration and Larry's natural language rendering of the intelligence tokens require a live session observation.

---

### Gaps Summary

None. All 12 must-have truths verified. All 8 requirements satisfied. All key links wired. Full test suite passes (32 assertions, 0 failures). No regressions in full suite (6/6 scripts, 105 assertions passing).

---

_Verified: 2026-03-25_
_Verifier: Claude (gsd-verifier)_
