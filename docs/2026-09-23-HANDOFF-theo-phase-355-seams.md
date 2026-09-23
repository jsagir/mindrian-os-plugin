# Handoff: the Theo-side work Phase 355 needs (M-side to T-side), 2026-09-23

Status: durable entry per the M-T coordination protocol (`~/Theo/docs/M-T-COORDINATION-PROTOCOL.md`, "M-side triggers T-side when a persona/room feature needs a Theo content tool that doesn't exist - spec the exact contract, don't make T-side guess intent"). Nothing here edits Theo; every ask lands through Theo's own GSD process, as a seed or a phase T-side mints.
Owner (M-side): Phase 355 in this repo, `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/`.
Requested by: the navigator, 2026-09-23 ("if Theo needs to build reflective and relevant phases we need to trigger such with relevant context and relationships with this session").
Live ping: no T-side session was identifiable at `ListAgents` time (sessions seen: jsagi-25, jsagi-a7, jsagi-e0, jsagi-ec, jsagi-c2); the ping follows when one appears, and this file is the record either way.

## 1. What Phase 355 is, in one paragraph

Every cross-domain finding MindrianOS shows a user (eureka, find-connections, find-bottlenecks, HSI, whitespace) will carry a direction name defined once from the April 2025 origin deck and a verification stamp computed in code from Theo's `find_connections` shortest-path hop count (strong 1-2 hops / indirect 3 / unverified none), with `backend` named on every stamp; no score is ever shown; an accepted finding files as a proposed opportunity through the existing harvest path; a dev-time Jev Choice is measured against the HSI thinking-mode regexes; the first human-judged hit rate is recorded on fixture rooms. Rule: code finds, Jev judges the type, Theo proxies typed calls and interprets nothing, Larry composes, a human ratifies. Navigator ruling recorded in the AI-SPEC: Jev is the preferred algorithmic choice for every intelligence layer, inside Canon Part 8 and the 2026-09-17 Jev ruling (Theo holds the one key; Jev never runs on a user machine).

## 2. The relationships this session produced (so T-side can read the context, not guess it)

| Artifact | Path | What it carries |
|---|---|---|
| Phase spec | `.planning/phases/355-.../355-SPEC.md` (commit 6be442ff4) | 7 locked requirements; R4 (verification stamp) and R5 (dev-time Jev) are the ones that touch Theo |
| AI design contract | `.planning/phases/355-.../355-AI-SPEC.md` (in progress this session) | Sections 1-4b filled: framework = none (in-repo native-fetch client), 8 planner findings, domain rubric from the PWS author's briefing; 5-7 being written |
| Brief | `.planning/phases/355-.../355-BRIEF.md` | Three homes (room-local engine / Theo seam / external computation), one wire shape (enums, buckets, ids) |
| Origin concept | `.planning/phases/355-.../355-ORIGIN-CONCEPT.md` | The April 2025 deck; the direction convention derives from it |
| Intent | `.planning/phases/355-.../355-INTENT.md` | Users, the ill-defined-section ruling, the uniqueness table, the eight Tetlock principles |
| Room entries (reasoning trail) | `~/MindrianRooms/rethinking-mindrianos/research/2026-09-23-*` (five entries) and `~/MindrianOS/research/` mirrors | Same content, cross-linked, per the Dev-Research Compositing rule |
| Briefing mirror | `~/MindrianRooms/rethinking-mindrianos/research/2026-09-23-algorithm-rd-briefing-mirror/` (13 tabs, commit 525fc7d54) | The PWS author's June 2026 algorithm R&D briefing, including its Brain Audit |
| Adjacent phases | 354-17 (Jev framework-command ledger, dev-time, the precedent 355 reuses), 354-18 (THEO-04: the raw `theo` MCP server bypasses `part8-egress-guard.cjs`; remediation is documentation plus an advisory doctor check), 356 (jsagi-a7: chain-executor Jev-seat policy), 357 (jsagi-e0: gate-triad ledger) | All Jev-at-dev-time; none adds Theo-side code |

## 3. Facts about Theo this session relied on, with where they were read (T-side: re-measure live before acting; do not trust these as current)

- `find_connections` computes `allShortestPaths((a:Framework)-[*..3]-(b:Framework))` over canon, endpoints resolved via `ALIAS_OF`, hop cap fixed at 3 (`~/Theo/src/mcp/content/find-connections.ts:245-253, 365-381`, read 2026-09-23). Plugin-side: the input the deployed tool accepts is exactly `{from, to}`; `maxHops` is rejected by Theo's strict input check and `limit` by the plugin's Part 8 guard (AI-SPEC Section 3-4, ai-researcher finding). `part8-egress-guard.cjs:430` already lists `find_connections {from, to, maxHops?}` as a known safe shape.
- Theo holds no Jev / TypeSafe credential and no judgment enum; `grep -ri "typesafe\|jev"` in `~/Theo` hits only `package-lock.json` and a quick-task pin ledger (read 2026-09-23). The "plugin -> Theo -> Jev with Theo as keyholder" arrangement is a ruling (2026-09-17 spike note), not code, on either side.
- The one external-computation seam is `computeGraphMetric` (`~/Theo/src/analytics/compute-graph-metric.ts`): closed enum `pagerank | betweenness_centrality | community_detection`, two optional integers, refusal codes `backend_unavailable | tier_denied | rate_limited` each with a `layer`, `backend` provenance passed through, no cache, no retry; its own comment says it "must not become a second general-purpose graph either Theo or Larry queries ad hoc" (`:88-92`).
- Theo is stateless by rule and refuses caching even for expensive analytics (`find-whitespace.ts:97-100`; `CLAUDE.md` rule 3).
- `find_whitespace` carries its own open question: "WHETHER COMMUNITY DETECTION IS THE RIGHT OPERATIONALISATION OF 'WHITESPACE' AT ALL IS OPEN QUESTION OQ-4 ... needs its own seed and a langtalks-graph-expert consult" (`find-whitespace.ts:61-66`).
- Framework content quality as Theo states it: 306 of 419 Frameworks on no semantic axis (`MISSION-FINALIZE-THEO.md:198-200`); 417 of 552 methodology rows name-only (`16-MOS-LEARNING.md:72-76`); `orchestration_status: active` on 1 of 452 (`23-MOS-LEARNING.md:59-61`).
- From the PWS author's briefing, Brain Audit tab (June 2026, NOT a live Theo measurement): `CrossDomainInnovation` (15 nodes) and `DomainBridge` (5 nodes) carry 0 edges; the only Framework node representing an actual algorithm is "Algorithmic Generation of Reverse Salient Solutions". Mirror: `research/2026-09-23-algorithm-rd-briefing-mirror/06-brain.md`.
- Theo's Phase 20 is the open phase that decides the external-analytics seam's future (bucket C: D-06 reopened, stored graph metrics as properties, `rank_influence` as a third remote proxy; `~/Theo/.planning/ROADMAP.md:3653`). Theo's own handoff note: `find_bottlenecks` / `find_connections` / `find_whitespace` / `taxonomy_ladder` "are NOT depended on by any shipped MindrianOS command; don't let them drive prioritization" (`SESSION-HANDOFF-theo-ingestion-2026-09-07.md:110-112`). Phase 355 would be the first shipped consumer of `find_connections`.

## 4. The asks, each with its exact contract

### T-1. Confirm `find_connections` is served and pin its response shape (verify now; no code expected)

- What 355 consumes: `{from, to}` in; a result carrying the hop count, the ordered path (node labels and names, relationship types per hop), and a `backend` field naming the graph the path was computed over. The plugin computes the tier from the hop count in code and never re-scores.
- Contract to confirm: (a) the deployed catalog at `theo-mcp.onrender.com` lists `find_connections`; (b) the exact field names for hop count, path, and backend in the success payload; (c) what an unresolvable endpoint returns (refusal-inside-success with a reason, never an empty list that reads as "no path"); (d) whether the hop cap stays fixed at 3 (355 assumes yes; an optional bounded `max_hops` 1-3 would be welcome but is not required).
- If absent: every stamp is `unverified` with `backend: unavailable`; the phase still ships and its hit rate measures nothing about verification. That outcome is disclosed, not hidden.
- Relationship: Theo Phase 12 (SEED-013, direct-MCP parity) built it; 355 requirement R4; AI-SPEC critical failure mode 1.

### T-2. A judgment enum family on the analytics seam, with Theo as the Jev keyholder (after Phase 20 decides the seam)

- What 355 would consume: one call shape, closed enum, no free text. Proposed contract, for T-side to accept, amend, or refuse:
  - request: `{ kind: 'judgment', policy_id: <registry id, e.g. 'citation_check_v1'>, primitive: 'choice', state: { claim: { from: <Framework handle>, to: <Framework handle>, direction: <enum> }, path: [ { node: <handle>, rel: <type> }, ... ] }, options: ['supports', 'contradicts', 'says_nothing'] }`
  - response: `{ choice: <option>, probabilities: { <option>: <bucketed 0.1 step> }, confidence_bucket: 'low' | 'medium' | 'high', model: <resolved Jev version>, backend: 'jev', policy_id }`
  - refusals, inside success, same shape as `computeGraphMetric`: `backend_unavailable | tier_denied | rate_limited | policy_unknown`, each with a `layer`.
  - the decision rule text for each `policy_id` lives Theo-side as data (the registry), never in the per-call request; the plugin sends handles, enums and buckets only (Canon Part 8); per-install rate bucket keyed on the opaque install-id header Phase 20 already names; no caching (rule 3); resolved model version returned every time.
- Why the shape: the TypeSafe docs measured that a Noul and a Choice on the same question are not comparable and that the model executes a stated closed-enum rule reliably (64/64 in the plugin's spike 004) but not an unstated one (40/64); so the policy lives with the keyholder, and the caller never composes a question ad hoc. Scalars cross as buckets, never floats (this repo's federated-analytics diligence, `research/2026-07-05-eureka-critic-brain-mcp-plan/agent-05-...`).
- If absent: every runtime stamp this phase says `judge: none`; the citation-check question is calibrated at dev time from `scripts/` on templated Part-8-clean pairs (navigator: yes, calibrate now), so the policy is proven before the seam exists.
- Relationship: Theo Phase 20 bucket C (D-06 reopened; "call out to an external computation service behind one contract"); the 2026-09-17 spike ruling (Theo holds the one key; users never carry a Jev dependency); SEED-011 (Theo as calibrator, not library); 355 requirement R4; AI-SPEC Section 2 alternative row "Theo-proxied Jev".
- Explicitly NOT asked: any Jev code in Theo before Phase 20 settles the seam; any judgment inside Theo (rule 1 stands; Theo passes the policy and the state through and interprets nothing).

### T-3. Canon coverage for cross-domain structure (content phase; 355's measurements are the input)

- The finding: per the June briefing's Brain Audit, `CrossDomainInnovation` and `DomainBridge` carry 0 edges. If that holds live, `find_connections` on cross-domain pairs verifies mostly through hub frameworks or not at all. 355 will record the unverified rate and the hub-inflation share (strong stamps whose path crosses a top-decile-degree framework) on fixture rooms and send them back as a dated entry; they are canon-coverage evidence, not a phase failure.
- The ask: T-side decides, through its own reviewed-payload door (`graph-rulebook.md:74-117`: a new meaning gets a NEW relationship type; MERGE key is endpoint pair + type; `ON CREATE SET`; one pair one edge), whether to (a) place the cross-domain node types with real edges, (b) mint an analogy / bridge relationship type that a later plugin phase's discovery-pattern label (analogical transfer, constraint relaxation, structural isomorphism, mechanism bridging, recombination, scale translation, temporal translation, negation insight) could attach to as a reviewed payload, and (c) fold this into Phase 20 bucket D or SEED-009 (semantic placement).
- Relationship: SEED-009; Phase 20 bucket D; plugin SEED-096 (Theo content backfill: 305/410 stub descriptions); 355 requirement R7 and the flywheel rows in AI-SPEC Section 6.

### T-4. Open OQ-4 (whitespace operationalization) as its own seed

- Theo already flagged it in code with a named procedure (a seed plus a langtalks-graph-expert consult). The plugin side will, in a later phase, implement Burt's structural-hole constraint over the room's own edge graph (self-limiting on sparse graphs, no external vocabulary) as the room-local whitespace signal; Theo's `find_whitespace` (Memgraph community detection over the Brain's graph) is a different question over a different graph. The seed should state which graph each answers so Larry never narrates one as the other (`find-connections.ts:8-27` already models this with `backend`).
- Relationship: `research/2026-07-06-whitespace-structural-holes-algorithm/`; 355 boundaries (out of scope); Phase 20 (whether Memgraph stays).

### T-5. `theo_health` and stamp provenance (already inside Phase 20's must-haves; one confirmation)

- 355 names the backend on every stamp. Confirm the field the plugin should read for "which graph answered" on `find_connections` (today `backend`), and that Phase 20's `theo_health` additions (`served_as`, `endpoint`, `plugin_only_tools`) will let the plugin's stamp adapter detect "served but `find_connections` not listed" as distinct from "unreachable".

## 5. What M-side sends back, and when

- After 355's verification: a dated entry with the measured unverified rate, hub-inflation share, per-tier hit rate and the fixture rooms used (no room content, counts and buckets only), addressed to T-3.
- After 355's dev-time citation-check calibration: the policy text and the measured stated-vs-withheld agreement, so a T-2 registry entry can be minted from a proven policy rather than drafted.
- Any change to `data/command-registry.json` or `recipe-maps.cjs` in a 355 release fires the existing `theo-resync` dispatch per `docs/THEO-NOTIFY-CONTRACT.md`; 355 does not expect to touch either.

## 6. Boundaries of this handoff

- No cross-edits: nothing here is applied to `~/Theo`; T-side mints its own seeds and phases.
- Ship / flip / suspend stay human-held on both sides.
- Numbers in Section 3 are dated reads, not live truth; re-measure before acting, cite the call and the timestamp.
- Attribution: the PWS author's algorithm R&D briefing (June 2026); first name at most; no email addresses in tracked files.
