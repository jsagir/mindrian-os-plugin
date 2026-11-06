---
status: fixing
kind: rca
trigger: "web-paths-no-approval-or-audit-record"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-11-06T11:00:00Z
updated: 2026-11-06T11:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ 1a3375db0 and later, dev workspace /home/jsagi/dev/MindrianOS-Plugin-release (Phase 386 plan 22)
- **WIRE claims probe against:** none; fetch replaced with a thrower; 0 network calls; a temporary HOME and a temporary room
- **Date of audit:** 2026-11-06
- **Re-verification rule:** a source claim is re-verified against `main` HEAD before it lands as a finding.

## Current Focus

hypothesis: The 2026-10-05 gate (approval card, credential check, audit record) was built for the research planner web lines only. The 3 older web paths (Semantic Scholar, grants.gov, research-speaker) have no shared way to show their strings, check an approval, check a credential or write a record, and the audit ledger refuses a provider that has no egress line.
test: Call appendAudit for each older provider, run the web credential check on 10 fake credential shapes and 3 ordinary strings, and search the 3 paths for any audit, approval or ledger call.
expecting: egress_line_off for each older provider; a low credential count; 0 hits in the 3 paths.
next_action: Pin the 7-arm test (RED), then build lib/core/web-path-gate.cjs and register the 3 providers.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.x on main (read with node lib/core/repo-version.cjs)
- Reported by: owner decision of 2026-11-06 (card answer "Extend the ruling") and EGRESS-CLAIMS-CHECK.md claim (h)
- Date first observed: 2026-11-06
- Related debug sessions: part8-no-shape-test-for-sprouts-and-bodies, part8-egress-guard-under-blocks-key-shape-and-spelled-money

## Problem Statement

Three older web paths send room-derived words to third-party services with no approval card, no shared credential check and no audit record. A shared gate does not exist, so plans 386-05, 386-23 and 386-24 would each need a private copy.

## Symptoms

expected: Each older web path shows its exact strings on an approval card first, runs a credential check (no content scan), and leaves one audit record per string.
actual: The 3 paths call none of these. The ledger answers egress_line_off for their provider names.
errors: appendAudit returns { ok: false, reason: 'egress_line_off' } for semantic_scholar, grants_gov and google_search.
reproduction:
  1. Build a temporary room directory and a temporary HOME. Replace globalThis.fetch with a thrower.
  2. Call appendAudit from lib/core/research-planner/audit-ledger.cjs with a valid record for each provider.
  3. Observe the reason for each. Then search the 3 paths for audit, approval and ledger calls.
started: since the older paths were built, before the 2026-10-05 ruling

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (the paths run from scripts and from the opportunity operations)
- Affected commands: scripts/query-semantic-scholar.cjs, searchGrantsGov and searchSimplerGrants in lib/core/opportunity-ops.cjs, scripts/research-speaker
- Affected users: all installs that run these paths
- Version range: all versions with these paths
- Severity: high (room words leave with no approval and no record)
- Blast radius: plans 386-05, 386-23 and 386-24 use the shared gate

## Eliminated

- hypothesis: the planner run grant already covers the 3 older paths
  evidence: see the Part 7 reuse decision; the run grant is bound to plan families and q_hash sets
  timestamp: 2026-11-06T11:10:00Z

## Evidence

- timestamp: 2026-11-06T11:05:00Z
  checked: scratch script (session scratchpad, synthetic strings, fake credentials built at run time, fetch replaced by a thrower)
  found: appendAudit result for semantic_scholar, grants_gov, google_search and unknown_provider is { ok: false, reason: 'egress_line_off' } (4 of 4). For openalex it is { ok: true }.
  implication: the ledger accepts only the planner web providers; the 3 older provider names need registering as web providers
- timestamp: 2026-11-06T11:06:00Z
  checked: auditWebCredential in lib/core/rs-egress-prompts.cjs on 10 fake credential shapes (a lower-case sk- key, a ghp_ token, an xoxb- token, an AKIA key id, an AIza key, a Bearer header, an api_key= parameter, an npm_ token, a glpat- token, a 3-part JWT)
  found: refuses 2 of 10 (the Bearer header and the api_key= parameter). The other 8 pass. The 3 ordinary strings (a person name, a city, a company name) pass 3 of 3.
  implication: the auditor claim "2 of 22 key shapes" is the same order of finding (2 of 10 here); plan 386-31 widens the shared shapes; this plan reuses the one check and adds no private shapes
- timestamp: 2026-11-06T11:07:00Z
  checked: grep for appendAudit, auditWebCredential, approval, research-audit, audit-ledger and web-path-gate in scripts/query-semantic-scholar.cjs, lib/core/opportunity-ops.cjs and scripts/research-speaker
  found: 0 hits in all 3 files
  implication: the 3 paths have no approval, credential check or record today

## Part 7 reuse decision

Decision: option (c). Build one token over the exact strings with no store. Do not reuse the planner run grant and card (a). Do not bind the token to the gate_answer receipt (b).

Reasons, each checked by reading:

1. PROVEN: a run grant covers the exact q_hash set of one plan. In lib/core/research-planner/grants.cjs, buildRunGrant reads plan.leaves queries and plan.baseline queries, and validateExecutedQuery checks grant.families and the template of each query (outside_family) and approved_hashes (hash_not_approved). The older paths build their strings from room titles, problem words or a speaker name outside any plan, so they have no plan family, no template id in FAMILIES and no plan.
2. PROVEN: the standing scope is OpenAlex only (STANDING_SCOPE.providers is ['openalex']) and writeGrant refuses a standing grant outside it (standing_scope_exceeded). A run grant takes its providers from the same list plus theo. The 3 older providers are not in either.
3. PROVEN: the gate receipt store is an in-memory Map (`const _ledger = new Map()` in lib/mcp/gate-ledger.cjs), minted and consumed inside the MCP process. research-speaker is a bash script (file reports a Bourne-again shell script) and the script and CLI paths run outside that process, so they have no gate ledger. Tri-Polar needs the same behavior on CLI, Desktop and Cowork.
4. PROVEN by construction: a token that is a hash of the exact sorted strings makes a changed string need a new approval, with no store to write, expire or clean up.

No reason was false. Option (c) stands.

## Technical Root Cause

- Site: lib/core/research-planner/egress-policy.cjs, constant WEB_PROVIDERS (openalex, tavily, patents), read by `appendAudit` in lib/core/research-planner/audit-ledger.cjs; and the 3 older paths, which call no gate function
- Cause: the 2026-10-05 gate was built for the research planner web lines only. The 3 older paths have no shared way to show their strings, check an approval, check a credential or write a record, and the ledger refuses a provider that has no egress line (egress_line_off).
- Why it surfaces now: the owner decision of 2026-11-06 extends the ruling to Semantic Scholar, grants.gov and research-speaker.

## Required Code Changes

- Change 1:
  - Location: lib/core/web-path-gate.cjs (new file)
  - Current behavior: no shared gate for the older paths
  - Required behavior: export approvalToken, checkApproval, credentialCheck, recordSent and a CLI (token, credential, record); credentialCheck reuses auditWebCredential and runs no content scan; recordSent writes one record per string through appendAudit
  - Short-term patch: none
  - Long-term fix: plans 386-05, 386-23 and 386-24 call the module
- Change 2:
  - Location: lib/core/research-planner/egress-policy.cjs, constant WEB_PROVIDERS and its comment; data/egress-policy.json, field note
  - Current behavior: WEB_PROVIDERS lists openalex, tavily, patents
  - Required behavior: add semantic_scholar, grants_gov, google_search; the ledger still refuses an unknown provider and a key-shaped line
  - Short-term patch: none
  - Long-term fix: none

## Tests to Add or Update

- Test 1:
  - Type: unit and CLI
  - Location: tests/test-386-web-path-gate.cjs
  - Given: a temporary room, a temporary HOME, a fetch counter, fake credentials built at run time
  - When: the module functions and the CLI run
  - Then: arms GW1 to GW7 pass
  - Runner registration: picked up by tests/run-all-386.sh by glob

## Non-Code Follow-ups

- CHANGELOG.md, STATE.md, ROADMAP.md and knowledge-base.md: owned by plan 386-21.
- Canon Part 8: no Brain wire is touched. The older web paths are under the owner decision of 2026-11-06 (credential check only, approval card, audit record). No user bytes reach the Brain.
- Tri-Polar: the module is plain CJS with a CLI for bash; CLI and Desktop and Cowork share it; verified on Linux, correct by construction elsewhere.
- Cross-platform: path handling uses node:path; sha256 and stdin only; Linux verified only.
- Part 7: the module extends audit-ledger.cjs, auditWebCredential and qHash; it adds no new gate store.

## Resolution

root_cause: The 2026-10-05 gate was built for the research planner web lines only. The 3 older paths have no shared approval, credential check or record, and the ledger refuses a provider that has no egress line.
fix: added lib/core/web-path-gate.cjs (approvalToken, checkApproval, credentialCheck, recordSent, CLI token, credential and record) and added semantic_scholar, grants_gov and google_search to WEB_PROVIDERS in lib/core/research-planner/egress-policy.cjs (note text of data/egress-policy.json updated). The 3 older paths are not wired in this plan; plans 386-05, 386-23 and 386-24 call the module.
verification: node tests/test-386-web-path-gate.cjs passes GW1 to GW7 (RED before, GREEN after). node tests/test-363-audit-ledger.cjs 5 of 5, test-366-egress-policy.cjs 24 of 24, test-3692-grant-card.cjs 9 of 9, test-366-gated-term-release.cjs 28 of 28, test-366-mcp-release-route.cjs 13 of 13, test-3692-judge-line.cjs 8 of 8, test-3692-web-lines.cjs 17 of 17, bash tests/run-all-386.sh all PASSED. Fetch counter 0. The ledger still refuses an unknown provider (egress_line_off) and a key-shaped line (key_shaped_value). Credential shapes refused by the shared check today: 2 of 10 (plan 386-31 widens them).
files_changed:
  - lib/core/web-path-gate.cjs (new)
  - lib/core/research-planner/egress-policy.cjs (WEB_PROVIDERS and its comment)
  - data/egress-policy.json (note text only)
  - tests/test-386-web-path-gate.cjs (new)
  - .planning/debug/web-paths-no-approval-or-audit-record.md (new)
commits: 8c3a13c24 (RCA), 265bc2475 (RED), d6dbe9abe (GREEN)
