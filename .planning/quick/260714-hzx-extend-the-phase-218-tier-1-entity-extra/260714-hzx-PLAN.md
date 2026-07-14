---
phase: quick-260714-hzx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/core/eureka/entity-classifier.cjs
  - lib/core/eureka/entity-extractor.cjs
  - scripts/entity-extract.cjs
  - tests/test-218-what-why-classifier.cjs
  - tests/run-all-218.sh
  - .planning/phases/218-entity-extraction-pipeline-eureka-entity-extraction-extract-/218-VERIFICATION.md
autonomous: true
requirements: [T2-REQ-1, T2-REQ-2, T2-REQ-3, T2-REQ-4, T2-REQ-5]

must_haves:
  truths:
    - "Tier-1 entity-extractor.cjs remains zero-egress and zero-model; the existing run-all-218.sh 'zero network' grep gate stays green byte-for-byte on that file"
    - "On the live aion-eureka-synergy room, the residual noise terms logged in 218-VERIFICATION.md (Larry, Governing Thought, Pyramid Logic) classify as WHY and are NOT written as company/technology/market entity nodes"
    - "WHY-classified terms are captured as a framework_terms property (plus framework_term_count) on their source memory_artifact node, never silently discarded and never minted as graph entity nodes"
    - "WHAT-classified candidates flow through the existing typed-entity write path byte-identically to today (writeEntityNode, DESCRIBES edges, relation edges)"
    - "With no resolvable ANTHROPIC_API_KEY, or on any model failure/timeout/garbage response, tier-2 degrades to pass-through (every survivor stays WHAT) and the batch still commits - never throws"
    - "The live 100 percent to 0 percent scaffold-share fix (T-218-VD) still holds after tier-2: top-25 structural share stays 0.0 percent on aion-eureka-synergy"
    - "Domain-agnosticism proven by construction: the tier-2 module contains zero hardcoded MindrianOS vocabulary (grep-gated) and a synthetic non-MindrianOS biotech fixture classifies its own framework vocabulary (IND Filing, Phase II Readout) as WHY while its companies classify WHAT"
    - "ALLOWED_EDGE_TYPES and the Part 9 truth-claim node type set are untouched (git diff clean on their defining modules)"
  artifacts:
    - path: "lib/core/eureka/entity-classifier.cjs"
      provides: "Tier-2 WHAT/WHY/NOISE LLM classifier with documented model boundary, fallback discipline, and _test.setFetch seam"
      min_lines: 120
    - path: "lib/core/eureka/entity-extractor.cjs"
      provides: "Tier-1 additive frameworkTerms output bucket (stoplist split into FRAMEWORK_TERMS vs true NOISE_TERMS), still zero-egress"
      contains: "frameworkTerms"
    - path: "scripts/entity-extract.cjs"
      provides: "Tier-2 second pass wired between tier-1 aggregation and the D-05 transaction; framework_terms prop merge inside the transaction; status.json what/why/noise counts"
      contains: "framework_term"
    - path: "tests/test-218-what-why-classifier.cjs"
      provides: "Offline test legs: WHY reroute, WHAT passthrough, degrade-never-throw, synthetic biotech fixture, domain-agnostic grep gate, zero-Brain gate"
    - path: "tests/run-all-218.sh"
      provides: "New tier-2 leg wired in; boundary comments updated honestly; all existing gates still green"
  key_links:
    - from: "scripts/entity-extract.cjs"
      to: "lib/core/eureka/entity-classifier.cjs"
      via: "require + await classify pass BEFORE db.exec('BEGIN') - model calls never hold the write lock"
      pattern: "entity-classifier"
    - from: "lib/core/eureka/entity-classifier.cjs"
      to: "lib/core/mva-classifier.cjs"
      via: "reuse of exported resolveAnthropicKey (Canon Part 7 reuse-before-build)"
      pattern: "resolveAnthropicKey"
    - from: "scripts/entity-extract.cjs"
      to: "lib/core/node-insert.cjs"
      via: "insertNode UPSERT for framework_terms merge, mirroring applyArtifactMetadata's merge discipline"
      pattern: "insertNode"
---

<objective>
Extend the Phase 218 tier-1 entity extraction pipeline with a tier-2 WHAT-vs-WHY semantic classification pass. Tier-1 today has only two outcomes for a capitalized candidate: accepted as an entity, or dropped by the hardcoded NOISE_TERMS stoplist. This task reclassifies the room's own methodology vocabulary as a real category (WHY - how the room reasons about itself) distinct from WHAT (concrete entities in the venture's world), using an LLM classification call because the distinction is semantic, not structural. It directly closes the content-domain-mismatch residual noise logged in 218-VERIFICATION.md (Larry, Governing Thought, Pyramid Logic surviving as false company entities on aion-eureka-synergy).

Requirement trace (from the task directive, cited per-task below):
- T2-REQ-1: a tier-2 LLM classification step over tier-1 survivors -> WHAT | WHY | confirmed NOISE.
- T2-REQ-2: WHAT candidates flow through today's typed-entity write path unchanged.
- T2-REQ-3: WHY candidates are never written as entity nodes but are captured as a lightweight framework_terms signal on the source artifact (additive props only; no new node type; ALLOWED_EDGE_TYPES and the Part 9 truth-claim type set untouched).
- T2-REQ-4: domain-agnostic by construction, proven with a synthetic non-MindrianOS fixture (the T-218-VD-3 proof pattern) plus live aion-eureka-synergy re-verification.
- T2-REQ-5: wired as a second pass in the Plan 218-03 dispatcher (scripts/entity-extract.cjs), keeping the zero-model tier-1 path intact and fast.

Canon boundary (document verbatim in the new module header): tier-1 keeps its Part 8 ZERO-egress guarantee. Tier-2 is the first legitimately model-using step in this pipeline. It is a LOCAL classification call over the Anthropic LLM transport - the established plugin pattern (precedent: lib/core/mva-classifier.cjs and lib/core/llm-name-suggester.cjs, whose headers spell out that Part 8 governs the LOCAL -> BRAIN boundary, not LOCAL -> api.anthropic.com). This is explicitly NOT the Plurai remote classifier that 218-VERIFICATION.md rejected: that was an unverified third-party judge; this is the repo's standard local LLM transport with a degrade-to-passthrough contract. User room content never reaches the Brain MCP surface.

Output: new lib/core/eureka/entity-classifier.cjs, additive tier-1 frameworkTerms bucket, dispatcher second pass, new test file wired into run-all-218.sh, live re-verification appendix in 218-VERIFICATION.md, and a dev-research compositing entry in the rethinking-mindrianos room.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@lib/core/eureka/entity-extractor.cjs
@scripts/entity-extract.cjs
@lib/core/mva-classifier.cjs
@tests/run-all-218.sh
@tests/test-218-extractor.cjs
@.planning/phases/218-entity-extraction-pipeline-eureka-entity-extraction-extract-/218-VERIFICATION.md

Interface contracts the executor needs (extracted, do not rediscover):
- entity-extractor.cjs exports { extractEntities, ENTITY_TYPES, DEFAULT_MAX_PER_ARTIFACT }. extractEntities(markdown, { sourceArtifactId, maxPerArtifact }) returns { entities: [{ entityType, name, sourceArtifactId }], relations: [{ source, target, edge_type }] }. NOISE_TERMS (line ~69) currently mixes two populations: MindrianOS constitutional vocabulary + business acronyms (canon, icm layer, minto, tam, sam, som, jtbd, pws, mos, feynman, aaak record, ...) AND true common-word garbage (see, note, data, map, max, not, plan, task, step, ...). cleanName() returns null on a stoplist hit, which silently drops the term.
- entity-extract.cjs::runExtraction(db, roomDir, sessionId, maxPerArtifact, opts) is async. Flow: collectArtifacts -> per-artifact extractEntities aggregation (pure) -> db.exec('BEGIN') -> writeEntityNode per entity -> DESCRIBES edge per entity via navigation.ENTITY_NODE_ID(sessionId, name) -> relation edges -> applyArtifactMetadata per exact artifact -> COMMIT/ROLLBACK -> post-commit triModal.indexNodes re-embed (degrade-never-throw). applyArtifactMetadata (line ~287) is the exact template for merging additive scalar props onto a memory_artifact node: SELECT the node, merge into parsed props, JSON.stringify, insertNode(db, row.id, row.type, propsJson) - the UPSERT ON CONFLICT branch refreshes properties only, never review_status or provenance.
- mva-classifier.cjs exports resolveAnthropicKey (env -> ~/.mindrian.env -> CWD .env, quote-stripping). Its Haiku call shape: global fetch to https://api.anthropic.com/v1/messages, model 'claude-haiku-4-5', temperature 0, AbortController timeout, returns null on ANY failure so the caller falls back. Test seam: module-scope _fetchImpl injected via _test.setFetch(fn).
- run-all-218.sh gate that MUST stay green unchanged in mechanism: leg (d) "zero network" runs: ! grep -rnE "fetch|https?\.|require\('node:http" lib/core/eureka/entity-extractor.cjs scripts/entity-extract.cjs. CONSEQUENCE: the tier-2 wiring inside entity-extract.cjs must not contain the literal substrings "fetch" or "http" ANYWHERE, including comments (write "the tier-2 model transport" in comments, never the transport verb). Also leg (b)/(c) git-diff gates: do not touch vector-store.cjs, insights.cjs, graph-ops.cjs.
- 218-VERIFICATION.md residual-noise terms to close: Larry, Governing Thought, Pyramid Logic, Seeded (flowing-prose survivors, neither metadata-shaped nor table-shaped). Live room: ~/MindrianRooms/aion-eureka-synergy, currently holding ~123 proposed entity nodes from the last verified pass.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Tier-1 frameworkTerms bucket + tier-2 entity-classifier module with tests</name>
  <files>lib/core/eureka/entity-extractor.cjs, lib/core/eureka/entity-classifier.cjs, tests/test-218-what-why-classifier.cjs</files>
  <action>
Two additive changes plus a new module.

(1) entity-extractor.cjs (T2-REQ-3 seed, keep zero-egress): split NOISE_TERMS into two frozen sets with updated doc comments. FRAMEWORK_TERMS takes the methodology/constitutional vocabulary and business-framework acronyms (canon, icm layer, feynman, aaak record, section completeness, evidence threshold, minto, destijl, de stijl, pws, mos, mindrianos, jtbd, tam, sam, som, gap, moa, eir, pair, kpi, roi, mvp, poc, room, foundry-level, begin references, end references). NOISE_TERMS keeps only the true common-word garbage (see, note, data, map, max, last, evidence, threshold, record, layer, phase, part, reference, references, section, not, plan, task, step, summary, context). Behavior change: a FRAMEWORK_TERMS hit is still excluded from entities and relation endpoints (cleanName still returns null for it) BUT extractEntities now also emits it into a new third output key frameworkTerms: [{ name, sourceArtifactId }], deduped case-insensitively, independently capped by maxPerArtifact. Implement by having cleanName accept an optional collector callback (or a small wrapper inside extractEntities) so the stoplist hit is recorded at the exact point it is rejected. NOISE_TERMS hits stay silently dropped exactly as today. The return shape gains the key additively: existing callers destructuring { entities, relations } are byte-compatible. Update the header comment: MISC-label disambiguation is no longer "out of scope tier-2" - state that tier-2 now exists in entity-classifier.cjs and that THIS module remains the zero-model, zero-egress tier-1 (Part 8 guarantee unchanged, grep-gated).

(2) NEW lib/core/eureka/entity-classifier.cjs (T2-REQ-1, T2-REQ-4): the tier-2 semantic classifier. Contract: async classifyArtifactCandidates({ names, excerpt }, opts) -> { labels: { [name]: 'what'|'why'|'noise' }, source: 'model'|'fallback' }. Reuse resolveAnthropicKey via require('../mva-classifier.cjs') (Canon Part 7 - it is exported; do NOT copy it). Model id 'claude-haiku-4-5' inlined with a provenance comment pointing at lib/core/mva-classifier.cjs:53 (the llm-name-suggester precedent - HAIKU_MODEL is not exported). Call shape mirrors mva-classifier _callHaiku: global fetch, temperature 0, AbortController timeout of 10000ms (batch pipeline budget, not the 1500ms hook budget), max_tokens ~500. System prompt defines the three labels GENERICALLY with zero MindrianOS vocabulary: WHAT = a concrete proper-noun entity that exists in the venture's external world (a company, a technology/product, a market/segment); WHY = the room's own methodology, framework, process-stage, or analytical-dimension vocabulary - terms describing HOW the venture is analyzed or documented, in any domain (a biotech room's "IND filing" or "Phase II" the same as any other room's framework labels); NOISE = not a meaningful term (sentence-position capitalization, fragments). Input: a JSON array of candidate names plus an optional excerpt (first ~10 non-empty prose lines of the artifact, capped 600 chars) for domain context. Required output: strict JSON {"labels":{"Name":"what"}}. Parse strictly in try/catch; on ANY failure (no key, no fetch, non-2xx, timeout, unparseable, missing names) return the fallback: every name labeled 'what', source 'fallback' - fail-open to today's behavior, NEVER throw. Names absent from a successful response also default 'what'. Test seam: module-scope _fetchImpl + _test.setFetch(fn)/_test.reset() mirroring mva-classifier exactly. MODULE HEADER (mandatory, per the directive): document the model boundary the same way entity-extractor.cjs documents its zero-egress guarantee - tier-2 is the FIRST model-using step in this pipeline; it is a LOCAL classification call over the Anthropic LLM transport (precedent: mva-classifier.cjs, llm-name-suggester.cjs - Part 8 governs LOCAL -> BRAIN, not LOCAL -> api.anthropic.com); it is NOT the Plurai remote classifier rejected in 218-VERIFICATION.md; user room content never reaches the Brain MCP surface; no Brain host string, no brain-client require anywhere in this file. No em-dashes anywhere.

(3) NEW tests/test-218-what-why-classifier.cjs, module-level legs (integration legs come in Task 2): (a) WHY reroute - inject mock fetch returning labels {Larry: why, Governing Thought: why, Pyramid Logic: why, AION Labs: what}; assert labels round-trip and source 'model'. (b) Fallback legs - no injected fetch + no key path, mock fetch throwing, mock returning non-JSON, mock returning 500: all yield every-name-what/source-fallback, no throw. (c) Synthetic non-MindrianOS fixture (T2-REQ-4, the T-218-VD-3 proof pattern): an invented biotech venture (e.g. Meridian Therapeutics vs BioNova Labs) whose framework vocabulary (IND Filing, Phase II Readout, Target Product Profile) mock-labels 'why' while companies label 'what'; assert the module's PROMPT sent to the mock fetch contains none of the fixture's terms hardcoded (capture the request body in the mock and assert the system prompt is generic). (d) Domain-agnostic-by-construction grep gate: read entity-classifier.cjs source and assert it contains NO MindrianOS vocabulary as whole words (canon, minto, icm, feynman, larry, governing thought, pyramid) - a hardcoded stoplist structurally cannot generalize and this gate proves there is none. (e) Zero-Brain gate: assert the module source contains no brain-host substring and no resolve-brain-key require (the llm-name-suggester tripwire pattern). (f) Tier-1 additive shape: extractEntities on prose containing "the Canon and TAM sizing for Prodrive" returns Prodrive in entities AND canon/tam in frameworkTerms, and existing { entities, relations } consumers see identical values to before the change.
  </action>
  <verify>
    <automated>node tests/test-218-what-why-classifier.cjs && node tests/test-218-extractor.cjs && bash -c "! grep -rnE \"fetch|https?\\.|require\\('node:http\" lib/core/eureka/entity-extractor.cjs"</automated>
  </verify>
  <done>entity-classifier.cjs exists with the documented model boundary and fallback contract; extractEntities emits the additive frameworkTerms bucket while all 8 existing test-218-extractor.cjs legs still pass; tier-1 zero-egress grep is still clean; new test file passes all module-level legs offline with zero live model calls.</done>
</task>

<task type="auto">
  <name>Task 2: Wire tier-2 as the dispatcher second pass + suite integration</name>
  <files>scripts/entity-extract.cjs, tests/run-all-218.sh, tests/test-218-what-why-classifier.cjs</files>
  <action>
Wire tier-2 into runExtraction (T2-REQ-5) following the existing wiring pattern, keeping tier-1 zero-model and fast:

(1) Aggregation stays pure and unchanged, but now also collects res.frameworkTerms per artifact into a whyTerms list [{ name, sourceArtifactId }] (tier-1's structural WHY seed, zero model cost - these never go to the model).

(2) Tier-2 pass runs AFTER aggregation and strictly BEFORE db.exec('BEGIN') - a model call must never execute while the D-05 write lock is held. One upfront resolveAnthropicKey check: if null, skip all model calls and mark every candidate 'what' with classifier_source 'fallback' (byte-identical write behavior to today - the backwards-compatible degrade, T2-REQ-2). Otherwise group tier-1 survivor entities by sourceArtifactId and call classifyArtifactCandidates once per artifact (design point: the classifier takes the tier-1 candidate list FOR AN ARTIFACT), passing that artifact's excerpt; each per-artifact failure falls back for that artifact only. Partition results: 'what' entities keep flowing exactly as today (same entityType, same writeEntityNode/DESCRIBES/relation path, T2-REQ-2); 'why' names move into whyTerms with their sourceArtifactId; 'noise' names drop. Relations filter: build the global surviving-WHAT name set; drop any relation whose source or target is not in it (its endpoint node will not exist).

(3) Inside the existing D-05 transaction, after the relation-edge loop and alongside the metadata pass: the framework-term merge (T2-REQ-3). Aggregate whyTerms per artifactId (dedup case-insensitively, cap 25). For each artifactId, mirror applyArtifactMetadata exactly: SELECT the node, parse props, union with any existing props.framework_terms (comma-split), write back TWO SCALAR PROPS ONLY - framework_terms (comma-joined string, bounded) and framework_term_count (number) - via insertNode UPSERT. Scalars only (the T-219-05 discipline), never a new node type, never an edge, ALLOWED_EDGE_TYPES and the Part 9 truth-claim type set untouched. A per-artifact failure is counted and skipped, never thrown.

(4) status.json gains additive keys: entities_what, terms_why, dropped_noise, classifier_source ('model'|'fallback'|'mixed'). cmdReport's done line appends them. runExtraction opts gains optional opts.classifyImpl (test injection seam) defaulting to the real module - the same additive-opts idiom D-16 used for opts.paths.

(5) LITERAL-SUBSTRING HYGIENE (hard requirement): the run-all-218.sh leg (d) grep gate scans entity-extract.cjs for fetch|https?\.|node:http as literal text. The require line require('../lib/core/eureka/entity-classifier.cjs') is clean; every comment you write in entity-extract.cjs must say "the tier-2 model transport" or "the classifier module", never the transport verb or protocol name. Update entity-extract.cjs's CANON POSTURE header honestly: Part 8 zero-network now applies to THIS FILE'S OWN CODE and to tier-1; the only model reach is inside entity-classifier.cjs, which documents its own boundary.

(6) tests/run-all-218.sh: update the header EGRESS RULE comment and leg (d) comment to state the refined boundary honestly (tier-1 + dispatcher body: zero network, grep-enforced; tier-2: local Anthropic LLM transport in entity-classifier.cjs only, never Brain, degrade-to-passthrough). Add a new leg running node tests/test-218-what-why-classifier.cjs after the tier-1 extractor leg. Keep leg (d)'s grep file list EXACTLY as-is (it must keep passing - that is the proof tier-1 and the dispatcher body stayed clean); add a sibling assertion in the new test file instead: entity-classifier.cjs is the ONLY file under lib/core/eureka/ whose source contains the transport call (guards against a future module quietly adding egress).

(7) Extend tests/test-218-what-why-classifier.cjs with integration legs using a hermetic temp room (copy the fixture-building idiom from tests/test-218-noise-reduction.cjs or test-218-eureka-auto-extract.cjs): (a) end-to-end WHY reroute - seed artifacts whose prose contains Larry/Governing Thought/Pyramid Logic alongside AION Labs; inject a mock classifier via opts.classifyImpl labeling accordingly; run runExtraction; assert zero entity nodes named the WHY terms, AION Labs written as a proposed company node, framework_terms + framework_term_count present on the source memory_artifact node, and no relation edge references a WHY endpoint. (b) Degrade leg - classifyImpl that throws: run commits, every survivor written as entity (today's behavior), status classifier_source 'fallback'. (c) Synthetic non-MindrianOS room (T2-REQ-4): the invented biotech venture room end-to-end - IND Filing / Phase II Readout land in framework_terms, Meridian Therapeutics / BioNova Labs land as entity nodes. (d) Merge discipline: re-running extraction unions framework_terms without duplication and never touches review_status (assert unchanged).
  </action>
  <verify>
    <automated>bash tests/run-all-218.sh</automated>
  </verify>
  <done>Full Phase 218 aggregator green including the new tier-2 leg: all pre-existing legs pass unchanged (zero-network grep on tier-1 + dispatcher body, REQ-3/REQ-4 git-diff zero-touch gates, connector-registry check proving no CIRS surface leaked), and the new integration legs prove WHY reroute, framework_terms capture, relation filtering, degrade-to-passthrough, and the synthetic-fixture domain-agnostic path - all offline with zero live model calls.</done>
</task>

<task type="auto">
  <name>Task 3: Live aion-eureka-synergy re-verification + dual-home documentation</name>
  <files>.planning/phases/218-entity-extraction-pipeline-eureka-entity-extraction-extract-/218-VERIFICATION.md</files>
  <action>
Live verification against the real room, then the documentation contract.

(1) Preflight: node -e "console.log(require('/home/jsagi/dev/MindrianOS-Plugin/lib/core/mva-classifier.cjs').resolveAnthropicKey() ? 'key-ok' : 'NO-KEY')". If NO-KEY, STOP and ask the navigator - the live acceptance below is impossible in fallback mode and must not be faked.

(2) Backup, then reset the prior pass (the established wipe-and-re-extract discipline from 218-VERIFICATION.md): cp ~/MindrianRooms/aion-eureka-synergy/.mindrian/room.db (or wherever room-db.cjs places it - locate it first) to room.db.bak-260714. Then delete the ~123 prior proposed entity nodes and every edge referencing them via direct sqlite (verification maintenance on a backed-up db, matching how the three prior wipe-re-extract passes were run; the raw-SQL chokepoint rule governs pipeline code, not verification resets).

(3) Run live: node scripts/entity-extract.cjs ~/MindrianRooms/aion-eureka-synergy run. Then assert, via sqlite queries against room.db: (a) zero nodes of type company/technology/market whose props.name is Larry, Governing Thought, or Pyramid Logic (the 218-VERIFICATION.md residual-noise acceptance); (b) at least one memory_artifact node carries framework_terms containing those terms (not silently discarded); (c) status.json shows classifier_source 'model' (the real model actually ran) and terms_why > 0; (d) AION Labs (the room's actual subject) still present as an entity node. Then run node scripts/eureka-command.cjs ~/MindrianRooms/aion-eureka-synergy run and assert the top-25 structural share in portfolio-report.json is still 0.0 percent (the T-218-VD fix holds; REQ-5's < 50 percent criterion by a wide margin). If any assertion fails, diagnose root cause before patching (no surface fixes) and restore room.db from the backup if the room is left in a bad state.

(4) Append a dated tier-2 section to 218-VERIFICATION.md: the before/after table row for this pass (entity node count, WHY term count, structural share), the three named residual terms' new classification, the explicit statement that this is the tier-2 escape hatch the SPEC pre-decided (218-03-SUMMARY key-decisions) now exercised, and the boundary rationale distinguishing this local Anthropic-transport classifier from the rejected Plurai network judge. No em-dashes.

(5) Dev-research compositing (CLAUDE.md mandate - this touches the room's own reasoning about its own architecture): create ~/MindrianRooms/rethinking-mindrianos/research/2026-07-14-what-why-tier2-classifier/ following the structure of the existing 2026-07-12-eureka-entity-extraction-phase218-scoping entry (read it first and mirror its conventions, including any mindrianOS/research source-of-record mirroring it performs). Contents: the WHAT-vs-WHY design rationale (why a stoplist structurally cannot do this, why the vocabulary is WHY-signal not noise), the Part 8 boundary reasoning (Anthropic transport vs Brain vs the rejected Plurai judge), the live before/after numbers, and a cross-reference BOTH ways: the room entry cites this quick task's plan path, and the 218-VERIFICATION.md appendix cites the room entry path. Same finding, two homes, cross-linked.

(6) Commits: atomic per concern (tier-1+classifier module, dispatcher wiring+suite, verification docs), conventional messages, no em-dashes anywhere. .planning/ is gitignored - use git add -f for the plan/summary artifacts per repo convention.
  </action>
  <verify>
    <automated>bash tests/run-all-218.sh && node -e "const fs=require('fs');const v=fs.readFileSync('/home/jsagi/dev/MindrianOS-Plugin/.planning/phases/218-entity-extraction-pipeline-eureka-entity-extraction-extract-/218-VERIFICATION.md','utf8');if(!/tier-2/i.test(v)||!/rethinking-mindrianos/.test(v))process.exit(1);console.log('verification appendix ok')"</automated>
    <human-check>Spot-check the aion-eureka-synergy portfolio-report.json top-25 pairs read as real domain content (AION Labs et al), with Larry / Governing Thought / Pyramid Logic absent</human-check>
  </verify>
  <done>Live room re-verified: the three logged residual noise terms classify WHY (absent from entity nodes, present in framework_terms), scaffold share holds at 0.0 percent, full suite green, 218-VERIFICATION.md appendix written, rethinking-mindrianos research entry filed and cross-linked both ways, atomic commits landed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| room prose -> tier-2 prompt | user room content (candidate names + 600-char excerpt) crosses to the Anthropic LLM transport |
| model response -> write path | model output influences which nodes get written to room.db |
| LOCAL -> Brain MCP | must remain uncrossed - Part 8 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-T2-01 | Tampering | entity-classifier.cjs response parse | mitigate | strict JSON parse in try/catch; unknown labels and unknown names default 'what' (fail-open to today's behavior); labels constrained to the closed what/why/noise set before use |
| T-T2-02 | Information Disclosure | LOCAL -> Brain boundary | mitigate | zero-Brain grep gate in the new test (no brain-host substring, no brain-client require); Anthropic transport only, per the mva-classifier/llm-name-suggester precedent |
| T-T2-03 | Denial of Service | model timeout mid-batch | mitigate | 10s AbortController per call, per-artifact fallback, all model calls complete BEFORE the D-05 transaction opens - the write lock is never held across a model call |
| T-T2-04 | Elevation of Privilege | framework_terms prop merge | mitigate | scalar props only via the insertNode UPSERT (T-219-05 discipline); review_status and provenance columns never touched; capped and deduped |
| T-T2-05 | Spoofing | offline test suite reaching the live model | mitigate | all test legs use _test.setFetch / opts.classifyImpl injection; suite asserts zero live calls |
| T-T2-SC | Tampering | npm installs | accept | zero new dependencies - node builtins + global fetch only, matching the mva-classifier pattern |
</threat_model>

<verification>
- bash tests/run-all-218.sh fully green: every pre-existing leg unchanged (including the zero-network grep on tier-1 + dispatcher body and the REQ-3/REQ-4 git-diff zero-touch gates) plus the new tier-2 leg.
- git diff --exit-code lib/core/eureka/vector-store.cjs lib/core/navigation/insights.cjs lib/core/graph-ops.cjs stays clean (this change touches none of them).
- node scripts/build-connector-registry.cjs --check green - no CIRS surface leaked (still a plain script + lib modules, D-03 posture preserved).
- Live aion-eureka-synergy: Larry / Governing Thought / Pyramid Logic absent from entity nodes, present in framework_terms; scaffold share 0.0 percent; classifier_source 'model'.
- Synthetic non-MindrianOS biotech fixture proves domain-agnosticism the T-218-VD-3 way; grep gate proves the tier-2 module carries zero hardcoded vocabulary.
</verification>

<success_criteria>
- The tier-2 WHAT/WHY/NOISE pass exists as a new module with a documented model boundary, wired as the dispatcher's second pass; tier-1 remains zero-model, zero-egress, grep-gated.
- WHY vocabulary is captured (framework_terms props), never minted as entity nodes and never silently discarded; WHAT flows byte-identically through the existing typed-entity path; every failure mode degrades to today's behavior.
- The 218-VERIFICATION.md residual-noise finding is closed on the live room with the scaffold-share fix intact, and the reasoning trail is filed in both homes (phase appendix + rethinking-mindrianos research entry, cross-linked).
</success_criteria>

<output>
Create .planning/quick/260714-hzx-extend-the-phase-218-tier-1-entity-extra/260714-hzx-SUMMARY.md when done.
</output>
