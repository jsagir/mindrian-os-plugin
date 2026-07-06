# Phase 212: Eureka Grounding Guard (Critic) + Brain MCP Exposure - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Source:** Locked from SEED-050's already-validated research (real-user eval transcripts,
Plurai/IntellAgent research, 2026-07-02), Phase 211's D8 gold-set design (case cards this
phase consumes), and this session's `research/2026-07-05-rebuild-vs-surgery/02-moat-
embedding-audit.md` + `research/2026-07-05-mcp-first-and-graph-indexer-addendum/` findings
in the `rethinking-mindrianos` Data Room, navigator-directed.

**Correction on entry (load-bearing):** this phase was scoped by two prior audits assuming
Phase 211 (Eureka Generator MVP) had shipped. It has not. Phase 211 has a full locked
CONTEXT.md and 5 PLAN.md files but zero executed code -- no `sqlite-vec`, `FlashRank`, or
`@huggingface/transformers` in `package.json`, no `lib/`/`scripts/` eureka files, no
`211-*-SUMMARY.md`. This phase's plan must NOT assume a working differential engine exists
to call. Two paths forward are named in the Domain section below; planning must pick one
explicitly rather than silently assuming 211 is done.

<domain>
## Phase Boundary

Build the Eureka Critic ("Grounding Guard"): the verifier that decides whether a proposed
eureka (a high differential score from the generator) is a REAL transferable salient or
confident noise, and expose that verifier as a Brain-side MCP tool -- the correct moat
boundary per `02-moat-embedding-audit.md`'s verdict (generator stays local/open by Part 8
necessity; the critic is the legitimate MCP candidate because it receives only abstracted
feature vectors, never raw room content).

This phase does NOT build a second differential engine. It does NOT wire the eureka-reach
into the live conversation (Phase 213). It does NOT touch find-analogies pattern-transfer
(Phase 214) or portfolio-scale fusion (Phase 215).

**Path decision required before planning (pick one, do not default silently):**
- **Path A -- Unblock 211 first.** Execute Phase 211's existing locked plan (it is fully
  specified, D1-D8, ready to run) so a real differential engine exists for 212 to critique.
  Slower to a working critic, but the critic is tested against real signal from day one.
- **Path B -- Build 212 against the gold-set alone, decoupled from 211.** SEED-050's research
  already includes 6 hand-scored case cards (`archimedes-uq`, `archimedes-sterling`,
  `archimedes-darkmatter`, and 3 more per Phase 211's D8) with known-good and known-bad
  differential scores as static fixtures. Build and calibrate the critic against those
  fixtures now; wire it to a live generator later, whenever 211 actually ships. Faster to a
  working, testable critic; the critic's real-world accuracy against live (not fixture)
  differentials stays unverified until 211 exists.

**Recommendation (navigator to confirm, not pre-decided):** Path B. The critic's logic
(classify a differential + metadata into transferable/restatement/pseudoscience/general_shallow)
is testable against static fixtures independent of whether the generator producing those
differentials is the old `rs-differential-scorer.cjs` (already shipped) or the new tri-modal
211 stack (not shipped). Building the critic first, against fixtures, de-risks the MCP
exposure work (the actual point of this phase) without blocking on unrelated generator work.
211 can ship on its own timeline; 212 does not need to wait for it.

</domain>

<decisions>
## Implementation Decisions

### D1 - Critic input contract (Part 8 boundary, load-bearing)
The critic MCP tool receives ONLY: `differential_score` (float), `lsa_similarity` (float),
`semantic_similarity` (float), `surprise_type` (enum: structural_transfer |
semantic_implementation), `source_domain_tag` (generic enum, never a room artifact ID or
content string), `target_domain_tag` (same). It NEVER receives room artifact text, artifact
IDs, or user-content strings of any kind. This is the exact "generic handles only" pattern
Canon Part 8 already requires for the Brain boundary elsewhere in the codebase (see
`lib/core/rs-differential-scorer.cjs`'s `auditQueryString` precedent) -- reuse that audit
function at the call site that assembles this payload, do not write a second one.

### D2 - Critic output contract, and the internal judge design (UPDATED 2026-07-05 per web-researched diligence)
Returns: `verdict` (enum: transferable | restatement | pseudoscience | general_shallow),
`confidence` (float 0-1, see below), `reasoning_tag` (a short enum explaining the verdict
class, NOT free text -- e.g. `domain_swap_invariant` for the "swap the nouns, text unchanged"
failure mode SEED-050 documents). No free-text reasoning crosses the MCP boundary in either
direction; reasoning tags are a closed, versioned enum in `data/eureka-critic-tags.json`
(new file, follows the `data/dispatch-framework-map.json` precedent for a closed lookup
table Part 7 reuses rather than reinventing).

**Internal judge architecture is NOT a single free-form "rate this 1-10" LLM call.** Web
research (`research/2026-07-05-eureka-critic-brain-mcp-plan/agent-04-llm-judge-reliability.md`,
20+ cited sources including arXiv:2606.12071 "novelty mirage," arXiv:2605.29800 "Nine Judges,
Two Effective Votes," arXiv:2507.17746 "Rubrics as Rewards") found novelty judging is the
single weakest-documented LLM-judge task, and a naive single-call design fails in exactly the
direction already observed (tahini x blockchain 0.825). Required design, in priority order:

1. **Two-stage: programmatic gates before any LLM call.** Stage A (deterministic, no LLM):
   domain-swap invariance (re-embed k noun-swapped variants of the stated mechanism; near-zero
   embedding shift = generic filler, this is the D6 failure signature made computable), nearest-
   neighbor novelty delta against the user's own graph, entity-specificity count, and a
   fabricated-quantity flag (any unsourced dollar figure/statistic auto-routes to
   pseudoscience/general_shallow -- this alone catches the "$2-5B exit" class). Candidates
   failing Stage A never reach the LLM judge.
2. **Rubric, not Likert.** 5-8 binary/ternary items (shared relational schema statable without
   domain nouns; one-to-one element mapping with no orphans; mechanism yields a checkable
   consequence; swap-invariance below threshold; adds something over nearest graph edge; no
   unsourced quantities). The LLM answers items with one sentence of evidence each; the
   `verdict` enum is computed BY CODE from the item pattern, the LLM never picks the class
   directly (per Rubrics-as-Rewards' documented +28% alignment gain over Likert, and RubricEval's
   warning to keep items independently checkable).
3. **Exactly 2 judge calls, not a panel.** One neutral rubric pass, one adversarial pass
   ("argue this is generic filler; complete a counter-mapping"). Disagreement routes to
   `general_shallow`/uncertain, not a coin flip. Evidence (arXiv:2605.29800): a 9-judge panel
   delivered only ~2.2 effective independent votes; returns vanish fast past 2-3 diverse calls,
   and unanimous agreement still carried a 9.1% error rate in that study.
4. **Confidence is calibration-derived, never the model's self-reported number.** Map
   rubric-item patterns to empirically measured accuracy buckets on the D3 gold set. An
   unseen pattern returns `confidence: unknown`, which routes to human review. Self-reported
   LLM confidence is documented as uncalibrated on exactly this task class.
5. **Never expose the candidate's persuasive framing to the judge.** The D1 abstracted-
   feature-vector input already does this by construction -- do not regress it by later adding
   a free-text "proposal summary" field to make prompts read nicer; that reopens the sycophancy
   channel (arXiv:2310.13548) D1 was designed to close.

### D3 - Calibration data: the SEED-050 gold-set, not a new corpus
Do not collect new eval data for this phase. Use the 6 case cards SEED-050 + Phase 211's D8
already name (`archimedes-uq`, `archimedes-sterling`, `archimedes-darkmatter`, + 3 more) as
the initial fixture set. `archimedes-sterling` is explicitly `critic_available: lean_checkable`
per Phase 211's D8 -- use it as the one case where the critic's verdict can be checked against
a formally-checkable ground truth, not just human judgment, before trusting the critic on the
other 5 human-judged cases.

### D3b - Payload hardening (NEW, from web-researched privacy diligence)
`research/2026-07-05-eureka-critic-brain-mcp-plan/agent-05-stateless-critic-mcp-pattern.md`
(20+ cited sources: Google Federated Analytics, Apple/RAPPOR local-DP telemetry, Vec2Text
embedding-inversion literature) confirms the D1 scalars-and-enums-only design is architecturally
sound and NOT subject to the embedding-inversion attacks that apply to raw embeddings (a
20-60 bit payload cannot be inverted to content; this is categorically different from shipping
an embedding). But four cheap safeguards are required, each mapped to a real attack class, and
must be implemented in this phase, not deferred:
1. **Quantize every float to 2 decimal places (or 8-bit buckets) before it leaves the machine.**
   A full-precision float32 similarity score is close to a unique fingerprint of the specific
   document pair; quantizing destroys this content-linkage channel. Non-negotiable.
2. **No stable content identifiers ever in the payload** (already true per D1 -- keep it true).
   Server-side, aggregate into calibration buckets rather than retaining per-query rows tied to
   a user identity.
3. **Return coarse confidence, not a raw float** (low/medium/high or 0.1 steps) -- closes the
   judge-extraction / membership-inference surface on the return path at zero product cost.
4. **Rate-limit per API key and dedupe near-identical consecutive feature vectors.** Standard
   brake on both query-stream fingerprinting and shadow-model construction against the judge.

### D4 - Deployment target: plugin-local MCP tool first, architected for the SEED-014 lift
Build the critic as a new tool on the EXISTING `bin/mindrian-mcp-server.cjs` / `lib/mcp/
tool-router.cjs` surface first (fast, already-wired infrastructure, Part 7 reuse) rather than
standing up a new separate Brain-repo service immediately. But module-boundary the critic's
logic in its own file (`lib/core/eureka-critic.cjs`, pure function, no MCP-framework imports
inside the logic itself) so it can be LIFTED into the separate Brain repo later (SEED-014,
still correctly dormant per that seed's own gating) without an interface rewrite -- the MCP
tool wrapper stays thin, the critic logic stays portable. Do not couple the critic's decision
logic to `tool-router.cjs`'s request/response shape.

### D5 - Mandatory per-call room/session resolution (direct lesson from this week's finding)
This is a NEW MCP tool surface. `research/2026-07-05-mcp-first-and-graph-indexer-addendum/`
found the EXISTING `tool-router.cjs` tools bind `roomDir` once at server registration and
never re-resolve it, causing stale-room reads mid-session. This tool must not repeat that
bug on day one: if the critic tool ever needs room-scoped state (it should not, per D1 -- it
is a pure function of the feature-vector payload) confirm at implementation time that it
takes zero implicit dependency on a registration-time `roomDir` closure variable. This is a
design constraint to verify in the plan-checker pass, not an afterthought.

### D6 - Negative-test corpus: the confirmed-junk examples already on record
SEED-050 already documents specific live failures to test against: "tahini x blockchain
0.825", "wind turbines as living weather algorithms 0.985", "Molecular Casino... $2-5B exit".
These are not hypothetical adversarial examples -- they are real generator output already
observed. The critic MUST classify these as `pseudoscience` or `general_shallow`, not
`transferable`, as its minimum bar for shipping. Write this as an explicit acceptance test,
not a manual spot-check.

### D7 - Gate criteria
Gate: a new `run-all-212` aggregator (follow `run-all-211.sh` naming precedent once 211 has
one, or `run-all-210.sh` if 211 doesn't ship first) composing: (a) the 6-case-card fixture
suite scored against expected verdicts, (b) the D6 negative-test corpus scored as rejected,
(c) a Canon Part 8 boundary scan on the critic's MCP tool registration (reuse
`test-connector-part8-boundary.cjs`'s pattern, do not write a parallel scanner), (d) the D5
per-call-resolution check.

</decisions>

<specifics>
## Specific Ideas

The `data/eureka-critic-tags.json` closed enum (D2) should be versioned from day one
(`schema_version` field) since Canon Part 9 (memory locality, typed packets) expects enums
crossing a boundary to be stable and versioned, not free-form strings that drift.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/seeds/SEED-050-eureka-eval-salient-verifier-judge-synthetic-trust.md` (the seed this phase implements)
- `.planning/seeds/SEED-049-mindrian-insight-engine-tri-modal-tri-source-hybrid-retrieval.md` (the generator this critic sits downstream of, Path A/B decision above)
- `.planning/phases/211-eureka-generator-mvp-tri-modal-room-db-sqlite-vec-xenova-all/211-CONTEXT.md` (D8: the gold-set case cards this phase consumes)
- `.planning/research/2026-07-02-eureka-eval-real-user-corpus-and-synthesis.md` (full calibration corpus backing)
- `.planning/seeds/SEED-014-brain-mcp-separate-repo-deployment-unit-of-moat.md` (the eventual deployment lift this phase's D4 module boundary prepares for)
- Data Room `rethinking-mindrianos/research/2026-07-05-rebuild-vs-surgery/02-moat-embedding-audit.md` (the moat-separation verdict this phase implements: generator local/open, critic MCP)
- Data Room `rethinking-mindrianos/research/2026-07-05-mcp-first-and-graph-indexer-addendum/` (the per-call room-resolution lesson behind D5)
- Data Room `rethinking-mindrianos/research/2026-07-05-eureka-critic-brain-mcp-plan/` (2026-07-05 web-researched technical diligence, 6 files: the 7-item pass plus 5 single-topic agent passes on sqlite-vec, embedding/rerank models, RRF fusion + LSA retirement, LLM-judge reliability, and the MCP privacy pattern -- D2/D3b above are sourced from agent-04 and agent-05 respectively)

**Upstream note for whoever plans Phase 211 next:** the same diligence pass found Phase 211's
locked D4 (FlashRank reranker) is a Python-only library and CANNOT run in this Node-only plugin
-- replace with `jinaai/jina-reranker-v1-tiny-en` or `Xenova/ms-marco-MiniLM-L-6-v2` on the
same transformers.js runtime already chosen for embeddings. D3's model choice
(`Xenova/all-MiniLM-L6-v2`) still works but a same-dimension 2025 upgrade
(`onnx-community/granite-embedding-small-english-r2-ONNX`, 384-dim, no index-shape change)
scores 8-10 NDCG points higher. D5's k=20-30 RRF tuning was never empirically validated --
default to the published k=60 and validate 20-30 against a 30-50 query eval set before locking
it. See `agent-01-sqlite-vec.md`, `agent-02-embedding-rerank.md`, and
`agent-03-fusion-lsa-retirement.md` in the Data Room entry above for full citations. None of
this blocks 212 (Path B decouples it from 211's timeline) but 211's own CONTEXT.md should be
amended before that phase is planned.

</canonical_refs>
