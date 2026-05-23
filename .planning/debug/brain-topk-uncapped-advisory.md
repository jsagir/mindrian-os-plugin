---
status: investigating
kind: rca
trigger: "brain-topk-uncapped-advisory"
issue_id: ""
severity: low
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-05-23T04:35:00Z
updated: 2026-05-23T04:35:00Z
---

## Current Focus

hypothesis: Brain forwards caller-supplied `topK` directly to Pinecone with no Brain-side cap. Pinecone enforces its own server-side cap, so the moat against runaway result sets is INHERITED, not owned. If Pinecone ever raises or removes that cap, Brain has no fallback. The D-MOAT-2 surface (timeout + row cap + byte cap) is enforced on the Neo4j curated-op path, on `brain_query`, and on `brain_schema`, but the Pinecone path on `brain_ask` and `brain_search` is uncapped at the Brain layer.
test: read the two call sites (brain-ask.cjs:545 Pinecone forward, pinecone-tools.cjs:42 brain_search forward) and confirm there is no `Math.min(topK, MAX)` guard. Optionally run brain_ask with `topK: 999999` and confirm the result-set size is bounded by Pinecone's response, not by Brain.
expecting: confirmed by deep-audit Windows pass 2026-05-23 -- the auditor ran `{question:"list frameworks", topK:999999}` and noted the topK was forwarded uncapped. Source read confirms the absence of a Brain-side guard.
next_action: ship a small additive guard (BRAIN_MAX_TOPK env var with a sensible default cap, e.g. 100) wired into both call sites. ~5 lines across two files.

## Meta

- Repo: /home/jsagi/MindrianOS-Plugin
- Plugin version: 1.13.0-beta.25
- Reported by: Windows beta-tester deep audit (2026-05-23, surfaced as NF-2026-05-23-01b)
- Date first observed: 2026-05-23
- Related debug sessions: brain-post-fix-qa.md (the sweep that surfaced this); brain-raw-cypher-admin-gate-starves-baseline.md (sibling D-MOAT-1 surface)

## Problem Statement

`brain_ask` (Pinecone path) and `brain_search` forward caller `topK` directly to the Pinecone query call with no Brain-side cap. The moat against runaway result-set sizes is inherited from Pinecone's server cap, not enforced at the Brain layer. This is the only D-MOAT-2 hole on the deployed surface as of HEAD `0280d8fb`.

## Symptoms

expected: Caller passes a `topK` value; Brain clamps it to a sensible internal maximum (e.g. `Math.min(topK, BRAIN_MAX_TOPK)`) before forwarding to Pinecone; the response is bounded by Brain's policy, not by an external vendor's policy.
actual: Brain forwards `topK` verbatim. A caller can pass `topK: 999999`; Pinecone returns whatever it allows; Brain has no policy of its own.
errors: None. No exit code. No log. The hole is structural, not behavioral - it only surfaces if Pinecone's cap is removed or raised, at which point a runaway query becomes the failure mode.
reproduction:
  1. Source-read: `grep -n "topK" mcp-server-brain/lib/brain-ask.cjs mcp-server-brain/lib/pinecone-tools.cjs`
  2. Confirm `brain-ask.cjs:545` is `const limit = topK || 5;` with no `Math.min`.
  3. Confirm `pinecone-tools.cjs:42` is `query: { topK: topK || 5, inputs: { text: query } }` with no clamp.
  4. Wire-test (optional): brain_ask with `topK: 999999`; observe the result-set size matches Pinecone's response, not a Brain-enforced ceiling.
started: Both call sites have shipped this way since brain_ask + brain_search were originally registered. Not introduced by the c40afc71..d957a515 fix chain (the chain hardened the Neo4j curated-op + brain_query paths; the Pinecone path was out of scope).

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (same MCP code path on all three)
- Affected commands: `brain_ask` (Pinecone path), `brain_search` (entire surface)
- Affected users: ALL callers - the gap is in the deployed Brain server, not in any one client
- Version range: all shipped Brain versions up to and including 1.13.0-beta.25
- Severity: low - the moat is INHERITED, not absent. Pinecone enforces its own cap. The gap surfaces only if Pinecone's cap changes.
- Blast radius: any future Pinecone API change that raises or removes the cap; would also affect Brain bandwidth budget if a malicious caller hammered the surface with `topK: 999999`.

## Eliminated

- hypothesis: "The cap exists elsewhere in lib/core/brain-client.cjs (the plugin client side)."
  evidence: `grep -nE "MAX_TOPK|Math\\.min.*topK|cap.*topK" lib/core/brain-client.cjs` returns zero matches. The client passes `topK` through; the server forwards it through. No Brain-layer guard exists.
  timestamp: 2026-05-23T04:35:00Z

## Evidence

- timestamp: 2026-05-23T04:35:00Z
  checked: `mcp-server-brain/lib/brain-ask.cjs:545` (the Pinecone fan-out site)
  found: `const limit = topK || 5;` then `query: { topK: limit, inputs: { text: question } }` at line 555. No `Math.min` clamp.
  implication: Pinecone receives whatever the caller sent. The cap is vendor-side, not Brain-side.

- timestamp: 2026-05-23T04:35:00Z
  checked: `mcp-server-brain/lib/pinecone-tools.cjs:42` (brain_search)
  found: `query: { topK: topK || 5, inputs: { text: query } }`. No clamp.
  implication: Same vendor-inheritance pattern on the brain_search surface.

- timestamp: 2026-05-23T04:35:00Z
  checked: D-MOAT-2 cap definitions in `mcp-server-brain/CLAUDE.md` (the Brain MCP project notes)
  found: D-MOAT-2 documents `BRAIN_CYPHER_MAX_ROWS` / `BRAIN_CYPHER_MAX_BYTES` / `BRAIN_CYPHER_TIMEOUT_MS` for the Cypher surfaces (brain_query, brain_schema, curated-op path). The Pinecone surface has no analogous knob.
  implication: The Brain-layer moat is asymmetric. Cypher paths have caps; Pinecone paths inherit caps.

## Technical Root Cause

- Site 1: `mcp-server-brain/lib/brain-ask.cjs:545` then `mcp-server-brain/lib/brain-ask.cjs:555`, function inside `registerBrainAsk` async handler
- Site 2: `mcp-server-brain/lib/pinecone-tools.cjs:42`, function inside `registerPineconeTools` async handler
- Cause: Caller `topK` is dereferenced once (`const limit = topK || 5`) without bounding to a Brain-side maximum, then forwarded verbatim to the Pinecone client.
- Why it surfaces now: The deep-audit Windows pass on 2026-05-23 stressed the surface with `topK: 999999` and noticed the absence of a Brain-side guard. The gap has been latent since the surface was first registered.

## Required Code Changes

- Change 1:
  - Location: `mcp-server-brain/lib/brain-ask.cjs:545`
  - Current behavior: `const limit = topK || 5;` then `query: { topK: limit, inputs: { text: question } }`
  - Required behavior:
    ```js
    const BRAIN_MAX_TOPK = parseInt(process.env.BRAIN_MAX_TOPK, 10) || 100;
    const limit = Math.min(topK || 5, BRAIN_MAX_TOPK);
    ```
    Wire `BRAIN_MAX_TOPK` into render.yaml + .env.example with the default `100`, mirroring the `BRAIN_CYPHER_MAX_*` pattern.
  - Short-term patch: the same as the long-term fix (this is a 3-5 line additive guard; no architectural rework needed).
  - Long-term fix: same.

- Change 2:
  - Location: `mcp-server-brain/lib/pinecone-tools.cjs:42`
  - Current behavior: `query: { topK: topK || 5, inputs: { text: query } }`
  - Required behavior: same clamp applied; share the `BRAIN_MAX_TOPK` constant (extract to a small module, or copy the env-var read inline, the latter is cheaper for two call sites).
  - Short-term patch: same as long-term.
  - Long-term fix: same.

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: `mcp-server-brain/lib/brain-ask.test.cjs` (new file if absent)
  - Given: caller passes `{question: "foo", topK: 999999}`
  - When: brain_ask runs the Pinecone path
  - Then: the actual `topK` passed to the Pinecone client is `BRAIN_MAX_TOPK` (default 100), not 999999
  - Runner registration: register in mcp-server-brain's local test runner (if any) or the Feynman runner per Phase 122 build-command-registry pattern

- Test 2:
  - Type: unit
  - Location: `mcp-server-brain/lib/pinecone-tools.test.cjs` (new file if absent)
  - Given: caller passes `{query: "foo", topK: 999999}`
  - When: brain_search runs
  - Then: the `topK` passed to the Pinecone client is `BRAIN_MAX_TOPK`, not 999999

## Non-Code Follow-ups

- CHANGELOG.md: add a Fixed entry under the target version: "brain_ask + brain_search now clamp caller topK to BRAIN_MAX_TOPK (default 100) before forwarding to Pinecone, closing the last D-MOAT-2 hole on the deployed surface."
- Release lockstep: standard 7-place lockstep applies on the next release.
- Render service env: add `BRAIN_MAX_TOPK=100` to `render.yaml` env vars and document in `.env.example`.
- `mcp-server-brain/CLAUDE.md`: extend the D-MOAT-2 table to include `BRAIN_MAX_TOPK` as a fourth knob.
- Canon: no canon text change.
- knowledge-base.md: on resolve, add the summary block under "brain-topk-uncapped-advisory" with keywords: topK, Pinecone, D-MOAT-2, runaway query, Brain layer cap, vendor inheritance.

## MindrianOS gates

1. **Canon Part 8 (Graph Boundary):** The clamp is server-side, no caller Cypher, no payload changes. Same READ-only access mode preserved. Part 8 intact.
2. **Tri-Polar (three surfaces):** CLI, Desktop, Cowork all share the server-side MCP code path; a server-side clamp propagates to all three by construction.
3. **Cross-platform:** Server-side change; no platform behavior touched.
4. **Release lockstep:** Applies on next release.
5. **No em-dashes:** Code comments and CHANGELOG entry use hyphens only.
6. **Reuse before build (Canon Part 7):** Extends the existing `BRAIN_*` env-var convention with one additional knob; no new command, skill, agent, or hook.

## Resolution

root_cause: <pending - code change not yet shipped>
fix: <pending>
verification: <pending>
files_changed: <pending>
commits: <pending>
