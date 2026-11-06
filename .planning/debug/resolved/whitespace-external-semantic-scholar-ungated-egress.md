---
status: resolved
kind: rca
trigger: "whitespace-external-semantic-scholar-ungated-egress"
issue_id: ""
severity: high
surfaces: [cli, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-09-29T00:00:00Z
updated: 2026-11-06T00:00:00Z
---

## Current Focus

hypothesis: `/mos:whitespace external` sends queries built from room artifact titles to a third-party API with no query audit and no approval step, because the Phase 130.5 chokepoint and the Phase 361 approval pattern were never applied to this older path.
test: static read (Phase 363-01), re-verified against HEAD 8bee5f739 and reproduced on a fixture room with the network replaced by a counter (plan 386-03, 2026-11-06).
expecting: zero audit calls, zero approval steps, and fetch calls to api.semanticscholar.org on a cold cache (confirmed, see Reproduction).
next_action: plan 386-05 implements the owner decision recorded below (option A: approval card first, then a credential check, plus an audit record, no content scan).

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ 8bee5f739 (plugin 2.0.0-beta.80, from `node lib/core/repo-version.cjs`), working tree of /home/jsagi/dev/MindrianOS-Plugin-release, re-verified 2026-11-06 by plan 386-03. The first read was `main` @ 4ee6e5296 (plugin 2.0.0-beta.52), 2026-09-29.
- **WIRE claims probe against:** none. No live request was made. The reproduction replaced `globalThis.fetch` with a counter through a `node --require` preload, so the request never left the process. The fixture room held 3 synthetic titles and a stub `brain-baseline.json` (so the Brain baseline fetch did not run). No real room was used (Canon Part 8).
- **Date of audit:** 2026-09-29 (static), 2026-11-06 (re-verified and reproduced)
- **Re-verification rule:** code is cited by symbol name below because Phases 384 and 385 edit nearby files and line numbers drift. Re-check by symbol before a fix acts on a claim.

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

### Re-verification against HEAD 8bee5f739 (2026-11-06)

Each claim from the Evidence list above, re-checked by symbol name:

| Claim | Status | Check |
|-------|--------|-------|
| No `auditQueryString`, `approval` or `approve` in `scripts/query-semantic-scholar.cjs` | PROVEN | grep on the file returns 0 matches. The same grep on `scripts/whitespace-command.cjs` also returns 0 matches. |
| `extractRoomKeywords` builds up to 5 queries from room words | PROVEN | Function read. Sources: `whitespace-embeddings.json` titles and sections, `interpretation-results.json` problem types and framework names, `topic-forest.json` labels, room directory name as fallback. The 5-query cap is in the final `slice(0, 5)`. |
| `searchPapers` calls `fetch` on `API_BASE` (`https://api.semanticscholar.org/graph/v1/paper/search`) | PROVEN | Function read. Reproduction below also saw the host. |
| Private cache `external-corpus-cache.json` with a 7-day TTL | PROVEN | `CACHE_TTL_MS`, `checkCache`, `writeCache` read. The file appeared in the fixture after the cold run. |
| The dispatcher `cmdExternal` only spawns the script | PROVEN | `cmdExternal` runs `ensureBrainBaseline`, then `runScript('node ... query-semantic-scholar.cjs ROOM')`. It builds no query and calls no audit. |
| `commands/whitespace.md` declares `hitl_shape: "F.8"` and the `external` subcommand has no approval step | PROVEN | Frontmatter line read. The section "Subcommand: external" has Step 1 (run the pipeline) and the result view only. |
| Semantic Scholar is not a registered source of `fetchCorpusEnvelope` | PROVEN | `lib/core/research-corpus.cjs` has no `semantic` string. The header lists openalex, arxiv, pubmed, tavily, tavily-extract as web sources that run `auditWebCredential` only. |
| `auditWebCredential` exists in `lib/core/rs-egress-prompts.cjs` and is a credential check only | PROVEN | Function read. It refuses a Bearer token, an `api_key=` parameter, or the live value of OPENALEX_API_KEY, TAVILY_API_KEY, PATENTSVIEW_API_KEY. The violation sample is empty on purpose. |
| `qHash` exists in `lib/core/research-planner/families.cjs` and `buildRunGrant` in `grants.cjs` covers an exact set of `q_hash` values | PROVEN | `qHash(q)` returns `sha256:` plus the hex digest of the UTF-8 string. `buildRunGrant` collects `q_hash` and `family` from the plan. |
| `lib/core/web-path-gate.cjs` exists | NOT FOUND | The file does not exist at HEAD. Plan 386-22 creates it. Plan 386-05 depends on it for the audit record. |

### Reproduction on a fixture (2026-11-06)

Setup: a temporary directory under os.tmpdir() with `.mindrian/whitespace-embeddings.json` (3 synthetic titles with sections) and a stub `.mindrian/brain-baseline.json`. A `node --require` preload replaced `globalThis.fetch` with a counter that returned a failed response (HTTP 503) and logged only the host and a boolean. The preload and the logs sit in the session scratchpad, not in the repo. No title text, no query text and no room content went into this file.

| Run | Command | Queries built | Fetch count | Host seen | Query holds a synthetic title word | Approval or prompt step | Exit |
|-----|---------|---------------|-------------|-----------|-------------------------------------|-------------------------|------|
| 1 cold cache | `node query-semantic-scholar.cjs ROOM` | 4 | 4 | api.semanticscholar.org (4 of 4) | true (4 of 4) | none (0 matches for approve, confirm, y/n, proceed in stdout and stderr) | 0 |
| 2 warm cache | same command, cache file present | 0 built (cache replay) | 0 | none | not applicable | none | 0 |
| 3 warm cache plus `--force-refresh` | same command with the flag | 4 | 4 | api.semanticscholar.org | true | none | 0 |
| 4 dispatcher, cold cache, fresh fixture | `node whitespace-command.cjs ROOM external` with the preload set in NODE_OPTIONS | 4 | 4 | api.semanticscholar.org (4 of 4) | true | none | 0 |

Result: PROVEN. The fetch count is 4 per cold run, both through the script and through the dispatcher entry point that the command markdown calls. Nothing audited or asked the navigator first. A cache hit sends nothing (fetch count 0). A `--force-refresh` flag defeats the cache and sends again, so the future approval must cover the refresh path too.

Side finding (not part of this defect, not fixed here): the 4 failed requests of run 1 were written to `external-corpus-cache.json` with 0 papers and 4 `api_error` outcomes, and run 2 then replayed that empty result for 7 days with no fetch. A failed run poisons the cache. File this as a separate defect for plan 386-05 to decide: it touches the same file and the same cache rule (a cache hit needs no approval, so what a cache holds matters).

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

## Options Weighed

Phase 363 research left this path out (decision D-16). Pieces that exist at HEAD 8bee5f739: `auditWebCredential` (credential check only), `qHash` and `buildRunGrant` (a run grant covers an exact set of query hashes), `fetchCorpusEnvelope` (web sources openalex, arxiv, pubmed, tavily, tavily-extract; Semantic Scholar is not one). `lib/core/web-path-gate.cjs` (the audit record) does not exist yet; plan 386-22 creates it.

- **Option A: keep Semantic Scholar, add a gate.**
  - The script gets a mode that lists its queries and makes no network call.
  - It refuses any fetch unless called with an approval token that equals the hash of its own query list. `qHash` from `families.cjs` fits: it takes a string, so hash the joined, ordered query list.
  - Every query passes `auditWebCredential` (surface tag `semantic-scholar`).
  - `commands/whitespace.md` shows the list and asks the navigator on a gate card (hitl_shape F.8 is already declared), then reruns the script with the token.
  - A cache hit needs no approval. A `--force-refresh` run needs the token.
  - Each string sent gets one audit-ledger record through `lib/core/web-path-gate.cjs` (plan 386-22). No content scan runs.
  - Effect for the owner: the same provider and the same room words, but the navigator sees the exact strings first, and a ledger line records what left. Cost: one extra card per uncached run.
- **Option B: route through `fetchCorpusEnvelope`.** Use the OpenAlex source and the `whitespace-gap/v1` family under the standing grant, and delete the private fetch and cache.
  - Effect for the owner: the provider changes from Semantic Scholar to OpenAlex. Room titles can no longer go out as free queries, because the family only composes terms. Result quality and the paper fields change, so `compute-external-whitespace.py` input needs a check.
- **Option C: retire the `external` subcommand.**
  - Effect for the owner: the cross-domain literature view disappears. No room words reach a third party from this path.

## Owner decision

decision: option-a
date: 2026-11-06

The owner answered on a card and extended the 2026-10-05 ruling (web research lines send room words as written) to Semantic Scholar, grants.gov and research-speaker: an approval card first, then a credential check, plus the audit record, with no content scan.
Plan 386-05 implements this for Semantic Scholar, plan 386-22 builds the audit record (`lib/core/web-path-gate.cjs`), plan 386-23 covers grants.gov and plan 386-24 covers research-speaker.
This is not a Brain-line change: Canon Part 8 keeps `auditQueryString` on the Brain line, and this decision touches only the third-party web lines.

## Tests to Add or Update

- Test 1 (option A):
  - Type: unit plus child-process
  - Location: the test file of plan 386-05, registered in its `tests/run-all-<phase>.sh`
  - Given: a fixture room in os.tmpdir() with 3 synthetic artifact titles and a stub `brain-baseline.json`, and a `node --require` preload that replaces `globalThis.fetch` with a counter (no network, no real room)
  - When: the script runs (a) in list mode, (b) without a token, (c) with a wrong token, (d) with the token that equals the hash of its own list, (e) with `--force-refresh` and no token, (f) with a warm cache and no token
  - Then: (a) prints the queries and the fetch count is 0; (b), (c) and (e) refuse with a typed reason and the fetch count is 0; (d) sends exactly the listed queries and the fetch count equals the list length; (f) sends nothing and the fetch count is 0
  - Also: a query that holds a credential shape (a synthetic `api_key=` string) is refused before any fetch, and the refusal output does not echo the credential
  - Also: one audit-ledger record per string sent (after plan 386-22 lands), and none for a refused or cached run
  - Also: the dispatcher `cmdExternal` path makes 0 fetch calls until the token is passed
  - Also: ordinary synthetic room words still pass (no content scan)

## Non-Code Follow-ups

- Cross-links: `.planning/phases/363-deep-research-planner-quick-and-deep-runs/363-CONTEXT.md` D-16 (out of scope, filed as follow-on) and `363-RESEARCH.md` Pitfall 9 (do not route through it) plus Open Question 6.
- Phase 363 constraint: the 363 whitespace query family must never reuse this script.
- CHANGELOG.md: add a Fixed entry under the target version when the follow-on ships.
- Canon: touches Part 8; update docs/CANON-PHASE-MAP.md in the follow-on phase commit.
- knowledge-base.md: on resolve, add the summary block and move this file to `.planning/debug/resolved/`.

## Resolution

root_cause: the 2026-10-05 gate (approval card, credential check, audit record) was never applied to scripts/query-semantic-scholar.cjs. The script sent room-derived queries with no list step, no token, no credential check and no audit call. Confirmed by static read and by a fixture-room reproduction on 2026-11-06.
fix: option A. The script has --list-queries and --approve <token>. The token is the hash of the exact query list (lib/core/web-path-gate.cjs). Every query passes credentialCheck before any fetch (exit 3, no bytes echoed). Each request gets one audit record (provider semantic_scholar; outcome ok, empty_valid or failed). A cache hit sends nothing and needs no token. whitespace-command.cjs external prints the numbered list and the approval line, then sends only with the token. commands/whitespace.md has the approval step between marker comments, with no use of the word grant. No content scan was added.
verification: node tests/test-386-semantic-scholar-approval.cjs arms S1 to S10 plus S7b pass (RED commit 66d2d3a14 failed S1 to S5, S7 to S10); bash tests/run-all-386.sh all pass; tests test-355-no-decimal, test-355-part8-egress, test-355-floor-sweep, test-355-producer-whitespace-hsi, test-355-stamp-coverage unchanged green; test-363-command-contract green after one in-place update of its P1 byte-preservation leg (the external section may gain the approval step and the token); build-connector-registry --check and check-render-coverage pass; check-shape-declaration advisory count unchanged at 51.
files_changed: scripts/query-semantic-scholar.cjs, scripts/whitespace-command.cjs, commands/whitespace.md, skills/whitespace/SKILL.md (generated mirror), tests/test-386-semantic-scholar-approval.cjs, tests/test-363-command-contract.cjs
commits: 66d2d3a14 (RED), 8d793693b (fix)
