---
status: analyzing
kind: qa-sweep
trigger: "aion-eureka-demo-build-qa-session"
created: 2026-06-17T00:00:00Z
updated: 2026-06-17T00:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** install cache `~/.claude/plugins/cache/mindrian-marketplace/mos/1.13.1-beta.30/` (the running plugin during the session); dev repo `origin/main` HEAD @ 54c3a10d (plugin.json 1.13.1-beta.31).
- **WIRE claims probe against:** Brain server `mindrian-brain.onrender.com` (brain_ask/brain_search, 2026-06-16); Pinecone MCP (pws-brain / fil-brain / rs-external, 2026-06-16); Vercel deploy `aion-eureka-synergy.vercel.app`.
- **Date of audit:** 2026-06-17
- **Re-verification rule:** every source-code claim below is tagged `needs-source-reverify` against origin/main HEAD before it becomes a committed finding. The session ran on install-cache beta.30; main is beta.31. Reconcile the delta before fixing.

## Meta

- **What the navigator was doing:** an end-to-end, real-world demo build. Took Arnon Fluksman's (AION Labs) C08 challenge ("Generative-AI for Novel Target Combinations"), built a room, ran validated research, generated worked drug-target hypotheses, red-teamed the moat, and published a multi-page wiki-hub + Feynman deck to Vercel for a Rehovot demo. This QA session audits that build for plugin defects.
- **Room:** `~/MindrianRooms/aion-eureka-synergy` (born via `lib/core/navigation/room-birth.cjs::birthRoom`).
- **Surfaces exercised:** /mos:new-project, /mos:jtbd, /mos:explore-domains, /mos:build-thesis, /mos:challenge-assumptions, /mos:help; Skills frontend-design + feynman-engine; Brain MCP; Pinecone MCP; Tavily MCP; Vercel CLI; Workflow() x4; navigation.cjs / birthRoom / bankOpportunity / logMemoryEvent; generate-presentation.cjs.
- **Why a qa-sweep, not one bug:** the session surfaced 8+ distinct plugin defects across the graph, export, workflow, filing, and hook layers. SEED-026 (graph-viz-from-roomdb-typed-edges) was already filed mid-session; this sweep captures the rest and recommends two more seeds.

## Purpose
<!-- OVERWRITE - reflects NOW -->

A blast-radius QA sweep of every MindrianOS surface exercised during the AION Eureka demo build (2026-06-16). It classifies each observed defect against the RCA standard (WORKING-AS-INTENDED / KNOWN-TRACKED-BUG / ENV-GAP / NEW-FAILURE), records the intent-vs-outcome gaps, the workflow-design weaknesses, and the tool-layer friction, and names the highest-priority NEW-FAILUREs that deserve their own GSD seeds.

## Component Health Matrix

| Component | Surface | Verdict | Note |
|-----------|---------|---------|------|
| birthRoom transaction | lib/core/navigation/room-birth.cjs | WORKING | room.db + registry + STATE in one ACID call; db_created:true |
| bankOpportunity | lib/core/opportunity-ops.cjs | WORKING | 25 opportunities banked + deduped cleanly |
| writeClaimNode / writeEdge | lib/core/navigation/*.cjs | WORKING | 70 claim nodes + 82 typed edges filed and verified |
| logMemoryEvent | lib/core/navigation/memory-events.cjs | DEGRADED | only 3 of 5 temporal events logged; 2 silent failures (F5) |
| Brain MCP | brain_ask / brain_search | WORKING | returned framework-chain + methodology; Part-8 safe (generic only) |
| Pinecone MCP | cascading-search / search-records | DEGRADED | works, but rerank token-limit errors (F-misc) + rs-external holds wrong corpus (F8) |
| generate-presentation.cjs | 6-view generator | DEGRADED | generates, but Graph view = orphans (F1) + analyze-room warning |
| MCP export tool | export(command:present) | NEW-FAILURE | resolved the WRONG room (F2) |
| Workflow() synthesis step | Workflow runtime | NEW-FAILURE | final synthesis/opportunity agents died 3x (F3) |
| ROOM.md / artifact frontmatter validator | recompile-references hook | NEW-FAILURE | schema-violation warning on every Write (F4) |
| intent-mismatch room hook | UserPromptSubmit hook | NEW-FAILURE | repeated false positives (F6) |
| rs-engine.py path | scripts/rs-engine.py | ENV-GAP | PINECONE_API_KEY unset; Python RS path dead (F7) |
| Vercel deploy | CLI | WORKING | public, 200, multi-deploy stable |

## Findings (classified)

### F1 - Canonical graph viz produces orphan nodes [NEW-FAILURE, HIGH] [SEEDED: SEED-026]
generate-presentation.cjs builds its Graph view from artifact `[[wikilink]]` cross-references, which are sparse, so most nodes float unconnected. The real typed graph (room.db, 84 nodes / 82 edges, two hubs deg 69 + 13, 1 true orphan) is ignored. User reported it verbatim: "a whole lot of orphan nodes no connections." Fix shipped only for this report (hand-built room.db-sourced viz). Already captured as `.planning/seeds/SEED-026-graph-viz-from-roomdb-typed-edges.md`.

### F2 - MCP export tool resolved the WRONG room [NEW-FAILURE, HIGH] [NOT SEEDED]
Calling the `export` MCP tool with `command:present` returned room state for a DIFFERENT room (35 entries, personas, meetings, `pdac-investor-red-team.md`, Milken/FIL team roles) instead of the active `aion-eureka-synergy`. It also returned command-doc guidance, not a real generation. Bypassed by running `generate-presentation.cjs` directly against the explicit room path (which produced correct output: 46 artifacts, our edge types). Root cause (hypothesis): the MCP server's active-room resolution diverges from the CLI registry active pointer, or returns a cached/example room. Silent wrong output is the danger.

### F3 - Workflow synthesis/opportunity agents failed 3x with no retry/fallback [NEW-FAILURE, HIGH] [NOT SEEDED]
The final synthesis/opportunity-extraction agent failed in THREE separate workflows:
- eureka-build-run: `opportunities:arnon-jtbd` failed (API 500)
- eureka-crossdomain-rs: `opportunities:crossdomain-arnon` failed (API 500)
- eureka-pattern-analogies: `consolidate-eureka` failed (API 529 overloaded)
Each was the load-bearing LAST step. Recovered only by manual extraction from the partial results on disk. The 500/529 are upstream API conditions, but the workflow design has no retry/backoff or graceful-fallback on its most important step, so "file findings as they rise" silently depended on hand-finishing. The earlier-stage parallel agents (research, validation) succeeded; only the single final synthesizer is a single point of failure.

### F4 - ROOM.md / artifact frontmatter schema-violation on every Write [NEW-FAILURE, MED] [NOT SEEDED]
Every Write of a ROOM.md emitted `schema violation: name, type, section in ROOM.md`, and every artifact Write emitted `schema violation: title, status, date in <file>.md`. The canonical scaffold (`scaffoldRoomSkeleton`) writes ROOM.md with `section/purpose/stage_relevance/...` (NO name/type), yet the recompile-references validator wants `name/type/section`. So the generator and the validator disagree on the schema. Non-fatal (file commits, references recompile), but it is constant noise that masks real schema problems and signals an internal contract drift.

### F5 - Temporal memory_events only 3 of 5 logged [NEW-FAILURE, MED] [NOT SEEDED]
A 5-beat temporal timeline write via `navigation.logMemoryEvent` landed only 3 events; 2 returned non-ok silently (no surfaced reason). Likely a payload-validation or dedupe path returning `{ok:false}` without a loud signal. Temporal awareness (Part 9 / Phase 124) is silently lossy.

### F6 - intent-mismatch room-suggestion hook false positives [NEW-FAILURE, MED] [NOT SEEDED]
The UserPromptSubmit room-suggestion hook fired false "intent mismatch" warnings repeatedly: suggested `untitled-2026-06-01`, `motj-ecosystem`, `mindrianOS`, and `formation` because user prose contained tokens (e.g. "MindrianOS process", "formation" appearing in findings text) that token-matched other room names. Every one was a false positive in a focused single-room session. The token-overlap scorer needs an active-room stickiness bias or a higher threshold; as-is it adds noise and erodes trust in the signal.

### F7 - PINECONE_API_KEY unset; rs-engine.py path dead [ENV-GAP, MED] [partial overlap SEED-013]
`scripts/rs-engine.py` external/cross-domain mode needs `PINECONE_API_KEY` (multilingual-e5-large via Pinecone) which is NOT set on this machine, so the documented Python RS path is non-functional. The Pinecone MCP IS available and was the working substitute (user had to correct me: "PINECONE_API_KEY mcp available!"). Two issues: (a) the env-keyed Python path and the MCP path are not unified, and (b) Larry assumed "not runnable" before checking the MCP. Overlaps the SEED-013 (eliminate-python) direction.

### F8 - rs-external Pinecone index holds a stale unrelated corpus [NEW-FAILURE, MED] [NOT SEEDED]
`rs-external` index has exactly one namespace: `external:nv-diamond-magnetometry` (400 records) from a PRIOR room's run. For an AION drug-discovery room it is a dead corpus; any reverse-salient external match would return quantum-sensing noise. The rs-external index is not room-scoped / not invalidated between projects, so cross-domain RS silently matches against whatever the last project left behind.

### F9 - bankOpportunity writes empty-problem stub files; count drift [NEW-FAILURE, MED] [NOT SEEDED]
`opportunity-bank/` ended with 28 `.md` files but only 25 had a valid `problem`; 2 were empty stubs (plus STATE.md). The deck initially rendered the wrong headline "28 opportunities," corrected to 25. Root cause: `bankOpportunity` (or an early write path) produced near-empty files, and counts were taken from the filesystem rather than valid-parse. Fix: refuse to write an empty-`problem` opportunity; add a bank-lint that flags/drops stubs; always count via valid-parse.

### F10 - deploy proceeds despite generator crash [NEW-FAILURE, MED] [NOT SEEDED]
After the gen-hub generator crashed on a syntax error, `vercel deploy` still ran in the same bash block and aliased to production, shipping a STALE hub (old opp/graph pages) while reporting success. Root cause: the deploy was chained without gating on the generator exit code. This is a process gap that can silently publish stale client-facing content. Fix: gate any deploy on generator `exit 0` + a content sanity grep; add a `node --check` pre-deploy gate.

### F11 - F.1 navigation reaches stuck at generic "no specific job" every turn [WORKING-as-designed, LOW (UX-degraded)] [NOT SEEDED]
Every turn's NAVIGATION DECISION rendered the Shape-F.1 selector with three identical "No specific job - general thinking, ranging" options (Mode A, "no pattern_matches candidate available"; Tier-0 when BRAIN.md absent). It never surfaced task-relevant reaches despite a rich, active room. Documented fallback, but UX-degraded across a long focused session. Fix: seed room-local reach candidates from recent commands/JTBD so Mode A surfaces relevant verbs.

### F12 - PostToolUse MINTO / auto-commit hook churn per write [WORKING-as-designed, LOW] [NOT SEEDED]
Every Write triggered "queued MINTO regen ... recompiled references" + "auto-committed to data-room-autocommit" with no debounce, so a burst of artifact writes produced redundant regen/commit work. Benign but wasteful. Fix: debounce/batch regen across a write burst.

### F13 - recurring self-inflicted authoring friction (process note) [ENV-GAP/authoring, LOW] [NOT SEEDED]
Two recurring authoring hazards cost re-runs (never reached deployed output): (a) `node -e` env-var passthrough written as a suffix (`VAR=x node -e ...` did not bind, produced `undefined/...` ENOENT) plus quote-nesting in inline SQL/JS; (b) a double-escaped apostrophe (`\\'`) in a generated string crashed the generator. Both are agent-authoring patterns, not plugin defects, but they recurred. Mitigation adopted mid-session: heredoc `.cjs` files + `process.env` proper prefix; prefer HTML entities in generated strings; add a `node --check` gate before run/deploy.

### F14 - banked opportunities never become graph nodes [NEW-FAILURE, MED] [NOT SEEDED]
The 25 banked opportunities live ONLY as `opportunity-bank/*.md` files; they were never written into room.db as `opportunity`-type nodes with edges, even though the canon (Part 2 OPPORTUNITY BANK ADD, Part 4 every-choice-is-graph-data) and the navigation schema treat `opportunity` as a first-class truth-claim node type. So the opportunity graph the whole "the room explains itself" thesis depends on is absent; findings were filed as claim nodes (70) but opportunities were not. Filing the findings to the graph required an explicit user ask ("file properly on graph"), and opportunities were still left out. Fix: `bankOpportunity` (or a cascade) should also write an `opportunity` node + provenance edge into room.db via the navigation chokepoint, so the bank and the graph never diverge.

### F-misc (low) [WORKING / KNOWN]
- Pinecone `cascading-search` rerank rejects >100 docs and >512-token query+doc pairs (had to drop topK + rerank). WORKING-as-documented but the limits are sharp and undocumented in the room flow.
- `generate-presentation.cjs` prints "command failed: analyze-room" yet still generates 6 views. DEGRADED-but-works.
- Vercel `cleanUrls:true` makes `/room/*.html` links 308-redirect to clean paths. WORKING (cosmetic hop).
- /mos:jtbd with no active AION room read the stale `motj-ecosystem` JTBD. WORKING (room-local by design) but UX-confusing pre-room.

## Intent-vs-Outcome Gaps (the 3 biggest)

1. **Poster vs machine (corrected):** the first live report hand-narrated the MindrianOS process instead of rendering its real data/graph/wiki. User rejected it: "i dont feel this report gives the mindrianOS process and the results and the data." Root cause was partly compensation for plugin defects (F1 orphan graph + F2 wrong-room export made the canonical surfaces untrustworthy, so a hand-build filled the gap). Resolved by the data-faithful wiki-hub rebuild.
2. **Workflow last-step fragility (F3):** "file findings as they rise" / "extract opportunities" depended on a single final agent that failed 3 times. Delivered only via manual recovery.
3. **Filing/graph opacity + tool-knowledge misses:** recurring user anxiety ("did you build room?", "did we file all?", "file properly on graph!") shows the auto-file + graph-filing model was opaque and partly manual (findings were markdown-only until the explicit "file on graph" ask). Compounded by two tool misses the user had to correct (Pinecone MCP availability F7; the orphan/wrong-room canonical surfaces F1/F2).

## Workflows & Pipelines (audit)

| Workflow | Agents | Shape | Result | Recovery |
|----------|--------|-------|--------|----------|
| two-lens teardown research | 7 research + 1 synth, then +~40 validation | parallel + pipeline | STOPPED + RESUMED to insert adversarial validation phase (resume-from-runId cached the 7 research agents) | clean; 51 validated / 1 flagged |
| eureka-build-run | 9 (Q2 x2, Q4 x3 + verify, opportunities) | parallel + pipeline | PARTIAL: final `opportunities:arnon-jtbd` 500 | manual extraction |
| eureka-crossdomain-rs | 9 (7 analogy + RS + opportunities) | parallel + barrier | PARTIAL: final `opportunities` 500 | manual extraction |
| eureka-pattern-analogies | 8 (1 patterns + 6 crossdomain + consolidate) | barrier + parallel | PARTIAL: `consolidate-eureka` 529 | manual consolidation |
| whitespace analysis | 1 agent | single | clean | 9 opportunities banked |

Weaknesses: (a) the final synthesis step is a single point of failure with no retry; (b) resume-from-runId worked well (good pattern to keep); (c) validation-phase insertion mid-run worked well (good pattern).

## Tools / Commands / MCP (audit)

- **/mos commands:** new-project (worked, but the B1/B2 birth gate was driven manually via birthRoom rather than the conversational gate), jtbd (worked; read stale room pre-AION), explore-domains (worked; user never answered quick/deep), build-thesis (worked; 5/10 CONDITIONAL), challenge-assumptions (worked; black-hat), help (superseded mid-render).
- **Skills:** frontend-design (worked), feynman-engine (worked; produced the deck).
- **Brain:** brain_ask returned a GUIDED DirectiveEnvelope with framework-chain suggestions; brain_search returned methodology chunks. Part-8 safe (generic handles only). Worked.
- **Pinecone:** list-indexes / describe-index-stats worked; cascading-search hit rerank limits (had to fall back to search-records); rs-external wrong corpus (F8).
- **Tavily:** extract (advanced, with images) + per-agent search worked.
- **Vercel:** stable multi-deploy.
- **Suggestion surfaces:** the navigation-decision hook fired "Run Methodology / context_block" every turn; the intent-mismatch hook false-positived (F6).

## 3. Required Code Changes (for the fix pass)

1. **F2 export wrong-room:** make the `export`/`present` MCP tool resolve the active room through the SAME chokepoint as the CLI (`.rooms/registry.json` active pointer / resolveActiveRoom), and have it actually invoke `generate-presentation.cjs` against that path rather than returning command-doc text. Add an assertion that the resolved room slug matches the registry active slug.
2. **F1 graph viz:** per SEED-026, repoint the generate-presentation.cjs graph builder + dashboard Cytoscape feed at a `getGraphExport(roomDir)` over room.db typed edges; color by knowledge_type; gloss edge types; no orphan fallthrough.
3. **F3 workflow synthesis retry:** add bounded retry-with-backoff to the final synthesis/opportunity step in the workflow runtime (or a documented `agent({retry:n})` option), and a graceful-fallback that returns partial results structured for downstream filing instead of `null`.
4. **F4 frontmatter schema:** reconcile the ROOM.md schema between `scaffoldRoomSkeleton` (writes section/purpose) and the recompile-references validator (wants name/type/section). One source of truth; silence the false warning.
5. **F5 logMemoryEvent:** make `logEvent` return a loud reason on `{ok:false}` and surface it; investigate the 2/5 silent drops (dedupe vs payload validation).
6. **F6 intent-mismatch hook:** add active-room stickiness bias (weight active-room tokens higher) or raise the mismatch threshold so single-room sessions stop false-positiving.
7. **F8 rs-external scoping:** scope/invalidate the rs-external Pinecone namespace per room (or per topic), so a new room does not match against a prior project's corpus.

## 4. Tests

- F2: a test that calls the export MCP tool in a 2-room workspace and asserts the rendered room == registry active room.
- F1: assert the generated graph.html node/edge counts equal `getGraphExport(roomDir)` counts (no orphan-producing wikilink path).
- F3: a workflow unit test that injects a 500 on the final agent and asserts retry + partial-result fallback (not null).
- F4: assert `scaffoldRoomSkeleton` output passes the recompile-references validator with zero schema warnings.
- F5: assert `logMemoryEvent` of N distinct events with distinct dedupe keys lands N nodes.

## 5. Non-Code Follow-ups (recommended GSD seeds)

- **SEED-026** (graph-viz-from-roomdb-typed-edges): ALREADY FILED. Covers F1.
- **NEW SEED (recommend):** `export-present-active-room-misresolution` - covers F2 (MCP export tool returns wrong/stale room). HIGH.
- **NEW SEED (recommend):** `workflow-synthesis-step-retry-and-fallback` - covers F3 (final synthesis agent single point of failure, no retry). HIGH.
- F4/F5/F6/F8 can ride a single hardening seed or be folded into existing tracks (F4 -> scaffold/validator contract; F6 -> the room-suggestion hook tuning; F8 -> rs-corpus hygiene, partial overlap SEED-018).

## 6. MindrianOS Gates (clearance)

- **Canon Part 8 (Brain boundary):** PASS. Brain queries carried only generic framework handles; Pinecone queries used generic methodology language; zero AION user-content egress. The published hub is LOCAL-derived bytes.
- **Tri-Polar (CLI/Desktop/Cowork):** session was CLI; the MCP-export wrong-room (F2) is a Desktop/Cowork-relevant defect (MCP is the Desktop surface).
- **No em-dashes:** this file uses hyphens only.
- **Reuse-before-build:** the hand-built report/hub/deck were net-new surfaces built BECAUSE the canonical surfaces (F1/F2) were untrustworthy; once F1/F2 are fixed, the reuse path (generate-presentation.cjs + dashboard) should be the default and this hand-build retired.

## Session artifact pointers (evidence)

- Room: `~/MindrianRooms/aion-eureka-synergy` (STATE.md, opportunity-bank x25, room.db graph 70 claims/82 edges).
- Published: `aion-eureka-synergy.vercel.app` (hub + 25 opp subpages + keep/killed/sources/graph + Feynman deck + /room canonical views).
- Provenance copies: `~/MindrianRooms/aion-eureka-synergy/present/hub/` + `present/feynman-deck.html`.
- Existing seed: `/home/jsagi/dev/MindrianOS-Plugin/.planning/seeds/SEED-026-graph-viz-from-roomdb-typed-edges.md`.

next_action: review with /gsd:debug aion-eureka-demo-build-qa-session; reconcile beta.30-vs-beta.31 delta; cut the two recommended NEW SEEDs (export-present-active-room-misresolution, workflow-synthesis-step-retry-and-fallback).
