# FINDINGS: The Complete-System Loop (consolidated, 2026-08-20)

The single entry document for the GSD milestone work. Everything below is grounded in this session's research; nothing is assumed. Companion documents, same directory:

- `2026-08-20-BRIEF-complete-system-loop.md` (Fable deep-think: architecture positions, phase decomposition)
- `2026-08-20-ARCHAEOLOGY-complete-system-loop.md` (past phases, seeds, locked decisions, Part 3 verdict)
- `2026-08-20-LANGTALKS-COUNSEL-complete-system-loop.md` (external corpus counsel, 5 queries)
- Command-Framework Map (92 commands audited): https://claude.ai/code/artifact/ae659925-4441-4f04-982c-22b6d0843e28

## 1. What Jonathan wants to achieve (his own words, this session)

- "Make local and remote graph and the context window work as a team. Always."
- "The Brain is always on when using Mindrian, to make directives more accurate."
- Frameworks ranked by Data Room section affinity: "all eureka can be relevant to the bank of opportunities, jtbd and bono persona in meetings, leadership in team, ip/legal with the relevant parts, funding with dilutive/non-dilutive subfolders holding grant grading."
- "Maybe calling plugin:mos:mindrian-os needs to include brainwork also" (server-side composition).
- "A big MindrianOS and MCP Brain change that makes Mindrian a complete system."

## 2. The one-sentence verdict

This is not a new invention. It is finishing Canon Part 3 (the Tri-Context Decision Gate IS the three-way loop), completing SEED-045/SEED-043 (the consumption wiring that was planned and never built, substrate ~85 percent shipped), extending the open v2.1.0 "Green the Floor" milestone (graph integrity), plus ONE genuinely net-new dimension (section-affinity ranking) and ONE narrow ruling (server-side composition at explicit tool-call time).

## 3. Root cause found this session (code-read, not inferred)

Two disconnected taxonomy-to-framework mappings that never reference each other:
- Brain-side: the "PWS Dictionary" problem-type-to-framework mapping, prose in a chunk, never read by the plugin.
- Plugin-side: `recipe-maps.cjs`, hand-authored framework-to-command chains, zero connection to the Brain's real USES_FRAMEWORK edges.

`/mos:suggest-next` and `/mos:act` route through the plugin-side table alone. The `decide()`/`dispatchSensors` pipeline is a deliberate PURE LOCAL READER (its own header, verified by grep: zero live Brain calls).

## 4. What already exists (REUSE, do not rebuild)

- **Canonical sections are shipped code**: `lib/core/section-registry.cjs` CORE_SECTIONS is exactly 8 (problem-definition, market-analysis, solution-design, business-model, competitive-analysis, team-execution, legal-ip, financial-model) + extended (opportunity-bank, funding, personas) + structural (meetings, team). Jonathan's affinity examples map 1:1 onto existing slugs. The Brain's empty DataRoomSection label gets THIS taxonomy projected into it. Define nothing from scratch.
- **The Brain Command graph is shipped**: 103 Command nodes + USES_FRAMEWORK + ADDRESSES_PROBLEM_TYPE (86 edges) + RELATED_TO (633 chains), wired 2026-07-01, mirrored into room.db same day (SEED-043). The session's 25-edge gap list is a correction pass on this layer.
- **The R7-compliant routing vehicle is shipped**: `data/brain-orchestration-projection.json` + generator + `--check` (Phase 157). It is also the natural carrier for section affinity.
- chain-recommender.cjs, composeWorkflow, runChain, the 222 unified ranker + combiner, the 245 dial fusion, the 249 enrichment queue, the 251 cache hygiene rail.

## 5. Locked decisions (honor, cite, move on; full list in ARCHAEOLOGY section d)

- R7: no live Brain call at decide()/rank time. The sanctioned shape is local projection consumption. A live call at COMMAND-time or SERVER-TOOL-time is a different seam and needs an explicit navigator ruling, possibly a narrow amendment. Never an assumption.
- Recommend-never-trigger; one governed reach path; enums/slugs cross the wire, prose never (Part 8).
- Degrade-never-block + honest refusal: Brain cold means honest low-confidence local ranking over the room.db mirror, refusal surfaced in-turn, enrichment auto-queued.
- Graph mutations go through the Brain repo's ingest pipeline or admin sittings with human-reviewed triage lists (the 2026-02-05 relabel disaster is the standing warning). Never plugin-side ad-hoc writes.
- Do not fork a competing milestone. Extend v2.1.0 or sequence behind it.

## 6. External counsel (langtalks corpus, honest coverage)

- **Actively endorses section-affinity ranking**: textbook two-stage retrieve-then-rerank; graph signals complement vector signals (ep 21, ep 25, ep 57, Atomic GraphRAG on Memgraph). Richest harvest: 186 typed edges.
- **Supports projection-fed per-turn**: "RAG critiques Latency" (ep 61), "Working Memory compares_to Context Window" (SDS 985), "Retrieval builds_on Cue" (ep 60): fast local working set every turn, long-term store consulted on cue. Nothing argues for a blocking remote call per turn.
- **Silent on** server-side MCP composition and cold-start degradation (zero edges, honest gaps). Those positions rest on Mindrian's own canon and code analysis alone.
- **One warning to design for**: "RAG critiques Conflict." When local and Brain signals disagree, the merge rule must be explicit, not emergent.
- No corpus evidence contradicts any Fable brief position.

## 7. Verified infrastructure (live-checked this session)

- Render: pws-brain-mcp (pro, auto-deploys from ProblemsWorthSolving-Brain main) + pws-brain-db (Memgraph, Bolt 7687, SSH seam EXISTS: srv-d9geq2urnols73cimkfg@ssh.oregon.render.com). The "needs Bolt/SSH" index-DROP blocker from the 2026-08-11 handoff has its seam. Old mindrian-brain service suspended (dead spend confirmed).
- Supabase manages Brain API keys and is reachable via the Supabase MCP plugin; key ops do not depend on the missing local .env.
- Brain-side workstreams are commit-and-push deployable today. The gating items are human triage/review lists, not access.

## 8. The genuinely net-new build

1. Section-affinity dimension: project section-registry taxonomy into Brain DataRoomSection nodes; a Framework/Command-to-section affinity edge (edge-vocabulary amendment, additive); a section-affinity term in the 222 combiner; local-only mapping of user-custom sections onto canonical slugs (only canonical slugs ever cross the wire, Part 8).
2. The consumption wiring: decide()/suggest-next/act consuming the orchestration projection (SEED-045 open item 1).
3. Funding section children (dilutive/non-dilutive) + grant-grading routing (grounded in the 2026-08-05/06 grant-grader research trails).
4. recipe-maps.cjs reconciliation: generate or drift-check it against the projection.
5. The server-side composition ruling + (if approved) narrow implementation with the 239-05 fail-closed belt in brain-client.cjs as same-phase prerequisite.
6. Larry persona-contract wiring (SEED-056 class): whatever ships must be named in Larry's behavior contract or it stays dark capability.
7. Graph correction pass (into v2.1.0's families): the 25 missing USES_FRAMEWORK edges, entity dedups (MECE x2, Eureka Moment x5, Scenario Planning x3, Mullins alias), SAPPhIRE creation + TRIZ promotion, the ~750-node mislabeling check post-Memgraph-cutover (Gate 0: verify current state first).

## 9. Open navigator rulings (Jonathan decides before execution)

1. Server-side composition: may mindrian-os tool handlers (suggest_next, reach_candidates) compose a live Brain call internally at explicit invocation time? (SEED-053 precedents Part-8-clean local-server composition; the per-turn path stays projection-fed either way.)
2. The relabel triage list (when Gate 0 confirms the mislabeling state): human-reviewed, never bulk.
3. Milestone shape: extend v2.1.0 phase families vs sequence a successor milestone behind it.
4. The explicit local-vs-Brain merge rule when signals disagree (the langtalks "RAG critiques Conflict" warning).

## 10. Next step

GSD spec/discuss consuming this file + the three companions, scoped as an extension of v2.1.0 "Green the Floor" per the archaeology's sequencing implication. Cross-repo: Brain-side work lands in ProblemsWorthSolving-Brain (commit-and-push deploys), plugin-side in MindrianOS-Plugin, and per the Dev-Research Compositing rule the research trail mirrors into the rethinking-mindrianos room when the phase is cut.
