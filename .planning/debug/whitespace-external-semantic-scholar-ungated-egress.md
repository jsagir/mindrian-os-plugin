---
status: gathering
kind: rca
trigger: "whitespace-external-semantic-scholar-ungated-egress"
issue_id: ""
severity: high
surfaces: [cli, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-09-29T00:00:00Z
updated: 2026-09-29T00:00:00Z
---

## Current Focus

hypothesis: `/mos:whitespace external` sends queries built from room artifact titles to a third-party API with no query audit and no approval step, because the Phase 130.5 chokepoint and the Phase 361 approval pattern were never applied to this older path.
test: read `scripts/query-semantic-scholar.cjs` end to end and grep it for `auditQueryString` and any approval step (done in Phase 363-01, see Evidence).
expecting: zero audit calls and zero approval steps (confirmed).
next_action: a follow-on phase routes the subcommand through `fetchCorpusEnvelope` with a `whitespace-gap/v1` family and the Phase 363 grant check, or retires it. Not in Phase 363 (D-16).

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ 4ee6e5296 (plugin 2.0.0-beta.52), working tree at Phase 363-01 execution
- **WIRE claims probe against:** none. No live request was made; this RCA is a static read.
- **Date of audit:** 2026-09-29
- **Re-verification rule:** the code claims below were read from the working tree of the dev workspace, not an install cache; re-verify against `origin/main` HEAD before a fix phase acts on them.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.52
- Reported by: Phase 363 research (363-RESEARCH.md Pitfall 9), recorded by plan 363-01
- Date first observed: 2026-09-29
- Related debug sessions: none
- Classification: NEW FAILURE (found during Phase 363 research). Not a regression: the path predates the gate.
- Scope ruling: OUT of Phase 363 (363-CONTEXT.md D-16). Phase 363 never routes through this path and does not edit it.

## Problem Statement

`/mos:whitespace external` builds outbound search queries from the user's own room artifact titles and sends them to `api.semanticscholar.org` with no query audit and no human approval. Every other research egress in the plugin passes a chokepoint; this one does not.

## Symptoms

expected: a room-derived query string is audited (`auditQueryString`) and approved by the navigator before it leaves the machine, like the Phase 130.5 corpus path and the Phase 361 approval pattern.
actual: `extractRoomKeywords` turns artifact titles, section names, problem types, framework names and topic-forest labels into up to 5 query strings, and `searchPapers` sends them through `fetch` at once. The script contains 0 references to `auditQueryString`, `approval`, `approve`.
errors: none. The failure is silent by construction, which is why it went unnoticed.
reproduction:
  1. Open a room whose `.mindrian/whitespace-embeddings.json` holds artifact titles.
  2. Run `/mos:whitespace external` (dispatches `scripts/whitespace-command.cjs` line 710, which spawns `scripts/query-semantic-scholar.cjs`).
  3. Observe: the queries reach `https://api.semanticscholar.org/graph/v1/paper/search` with no approval prompt.
started: Phase 66 Plan 02 (external corpus), extended in Phase 88.6-03. Never gated.

## Scope and Impact

- Affected surfaces: cli (script runs locally); cowork if the command is reached there
- Affected commands: `/mos:whitespace external`
- Affected users: any install that runs the subcommand
- Version range: introduced with Phase 66, present in 2.0.0-beta.52
- Severity: high (Canon Part 8 adjacent: room-derived text leaves the machine unaudited). The recipient is Semantic Scholar, not the Brain, so this is a user-data egress concern, not a Brain-boundary breach.
- Blast radius: `scripts/whitespace-command.cjs` (dispatcher), `.mindrian/external-corpus-cache.json` (its own cache with a 7-day TTL, separate from the Phase 130.5 cache)

## Eliminated

- hypothesis: the dispatcher `scripts/whitespace-command.cjs` audits the queries before spawning the script.
  evidence: the dispatcher only spawns `query-semantic-scholar.cjs` (line 710) and counts outcomes afterward (line 732); it builds no query and calls no audit.
  timestamp: 2026-09-29T00:00:00Z

## Evidence

- timestamp: 2026-09-29T00:00:00Z
  checked: `scripts/query-semantic-scholar.cjs` (grep for `auditQueryString`, `approval`, `approve`)
  found: 0 matches
  implication: no query audit and no approval step exist on this path.
- timestamp: 2026-09-29T00:00:00Z
  checked: `scripts/query-semantic-scholar.cjs:86-229` function `extractRoomKeywords`
  found: reads `.mindrian/whitespace-embeddings.json` titles and sections, `interpretation-results.json` problem types and framework names, `topic-forest.json` labels, and falls back to the room directory name.
  implication: the outbound text is room-derived, not generic methodology.
- timestamp: 2026-09-29T00:00:00Z
  checked: `scripts/query-semantic-scholar.cjs:304-355` function `searchPapers`, and `:421-` function `main`
  found: `fetch` to `https://api.semanticscholar.org/graph/v1/paper/search` (API_BASE, line 278); cache at `{ROOM_DIR}/.mindrian/external-corpus-cache.json` (line 432).
  implication: a second corpus cache and a second egress path exist outside the Phase 130.5 single chokepoint.
- timestamp: 2026-09-29T00:00:00Z
  checked: `commands/whitespace.md` "## Subcommand: external"
  found: Step 1 runs the pipeline directly; no approval step is described.
  implication: the command contract also has no gate to preserve.

## Technical Root Cause

- Site: `scripts/query-semantic-scholar.cjs:86-229` function `extractRoomKeywords`, and `:304-355` function `searchPapers`
- Cause: the Phase 130.5 single chokepoint (`auditQueryString` on the way to the corpus adapter) and the Phase 361 approval pattern were built after this Phase 66 path and never applied to it. The path keeps its own keyword extraction, its own fetch and its own cache.
- Why it surfaces now: Phase 363 research (Pitfall 9) enumerated every research egress while designing the audited research runner and found this one outside the gate.

## Required Code Changes

- Change 1:
  - Location: `scripts/query-semantic-scholar.cjs:86-355`, `scripts/whitespace-command.cjs:~710`
  - Current behavior: builds room-derived queries and fetches them directly, no audit, no approval.
  - Required behavior: no room-derived query leaves without an audit and an approval.
  - Short-term patch: refuse to run unless an explicit approval flag is passed, and call `auditQueryString` on every query before `fetch`.
  - Long-term fix: route the subcommand through `fetchCorpusEnvelope` with a `whitespace-gap/v1` query family and the Phase 363 research grant check, then delete the private cache and fetch. Or retire the `external` subcommand.

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: a follow-on phase test file (not written in Phase 363)
  - Given: a fixture room with artifact titles
  - When: the external subcommand runs with a network guard installed
  - Then: no request is made before approval, and every query passes `auditQueryString`
  - Runner registration: the follow-on phase's `tests/run-all-<phase>.sh`

## Non-Code Follow-ups

- Cross-links: `.planning/phases/363-deep-research-planner-quick-and-deep-runs/363-CONTEXT.md` D-16 (out of scope, filed as follow-on) and `363-RESEARCH.md` Pitfall 9 (do not route through it) plus Open Question 6.
- Phase 363 constraint: the 363 whitespace query family must never reuse this script.
- CHANGELOG.md: add a Fixed entry under the target version when the follow-on ships.
- Canon: touches Part 8; update docs/CANON-PHASE-MAP.md in the follow-on phase commit.
- knowledge-base.md: on resolve, add the summary block and move this file to `.planning/debug/resolved/`.

## Resolution

root_cause: confirmed by static read (see Technical Root Cause).
fix: not started. Out of Phase 363 scope per D-16.
verification: none yet.
files_changed: none
commits: none
