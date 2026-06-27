# Canon Recalibration Brief v2 - Live Verification Report

The brief's spine survived. Its central thesis - that documented corpus figures are stale and that the operation tier is dark to the ambient conversational turn - holds against the live system. But the single most important correction is a REFRAME, not a refutation: the operation tier is NOT empty. It is populated LOCALLY (249 projection nodes / 90 connectors, re-derived exactly) while Neo4j's operation-tier labels hold 0 nodes; what is dark is not the tier but its CONSUMPTION - the ambient resolver `decide()` (navigation-engine.cjs:768) is projection-blind by construction, and the projection is read only by two on-ramps (`chain-executor.runChain`, `scripts/act-command.cjs`). Every "tier empty" framing in the brief must become "tier populated locally, unconsumed by the ambient turn." Secondary headline correction: the live canon is v1.18 / 2026-06-25, three bumps past the v1.15 the brief reviewed, and Appendix D runs to entry 30, not 26.

## 1. Verdict ledger

| Workstream | Claims | CONFIRMED | CORRECTED | REFUTED | UNVERIFIABLE |
|---|---|---|---|---|---|
| INV (consumption quarantine) | 7 | 6 | 1 | 0 | 0 |
| A-corpus | 8 | 3 | 4 | 1 | 0 |
| B-dark-frameworks | 6 | 1 | 0 | 0 | 5 |
| C-chains | 2 | 0 | 0 | 1 | 1 |
| D-evidence | 4 | 4 | 0 | 0 | 0 |
| E-security | 5 | 2 | 1 | 2 | 0 |
| F-citations | 6 | 3 | 2 | 1 | 0 |
| INV5-gate | 3 | 3 | 0 | 0 | 0 |
| **Totals** | **41** | **22** | **8** | **5** | **6** |

(INV-6's connector-count "CORRECTED" in the source narrative resolved to an exact 249/90 reproduction plus an additional 73-edge detail; counted as CONFIRMED here since both prior figures reproduced.)

## 2. Corrections that change the brief

### 2.1 INV-2 reframe: the operation tier is populated locally, not empty (lead)
- Brief said: operation-tier labels hold ZERO nodes; tier reads as dark/unbuilt.
- Live is: the 8 operation-tier labels (Capability, OperationSpec, OrchestrationContext, FrameworkAgent, MCPDefinition, MCP, ExecutionStep, SyntheticExpert) are indeed all 0 in Neo4j (CONFIRMED, INV-2), AND the tier is fully populated LOCALLY: `data/brain-orchestration-projection.json` = 249 nodes / 73 edges, `data/connector-registry.json` = 90 connectors (INV-6, re-derived this turn). Only 4 nodes carry `methodology_tier` (3 pws + 1 mindrian-operation, all `:Framework`; INV-1 CONFIRMED).
- What it changes: the brief's argument is not "the tier was never built" but "the tier lives in local JSON projections, and Neo4j projection was deferred (Phase 137)." The defect is a CONSUMPTION gap, not a population gap.

### 2.2 INV-5/INV-7: ambient `decide()` is projection-blind by construction
- Brief said: resolver reads only sensors; projection unread on the ambient turn.
- Live is CONFIRMED and sharpened: `grep -niE 'recipe-map|connector-registry|orchestration-projection|brain-orchestration' lib/core/navigation-engine.cjs` returns nothing; `decide()` (navigation-engine.cjs:768) consumes only `dispatchSensors`/sensorReaches (lines 788-827). The projection consumer `recipe-maps.cjs` is required by exactly two sites: `scripts/act-command.cjs:66` and `lib/core/chain-executor.cjs:96` (lazy getter). `runChain` (chain-executor.cjs:374) and act-command call the real `decide`, so `decide()` is invoked INSIDE the on-ramps but never itself reads the projection.
- What it changes: consumption is quarantined to `runChain` (post-approved-gate) + `/mos:act`. The ambient conversational turn structurally never reaches the operation tier. This is the empirical basis for the open design decision in section 6.

### 2.3 Live corpus numbers to repoint
- Total nodes (A-1, CORRECTED, cross-check held): brief ~27,882; live **27,904** (`MATCH (n) RETURN count(n)`). Canon hardcodes a stale 27,804 (CLAUDE.md:47/80/382/390/406, docs/THE-BRAIN.md:15/19, docs/MINDRIAN-CANON.md:708).
- Frameworks (A-2, CORRECTED, cross-check held): brief ~176; live **177** (`MATCH (f:Framework)`). Stale literals: 748 (docs/MINDRIAN-CANON.md:708, scripts/build-command-registry.cjs:87/145, data/ROOM.md:26), 275+ (references/brain/schema.md:21, skills/pws-methodology/SKILL.md:31), 78 (references/personality/pws-lexicon-full.md:499).
- Pinecone vectors (A-6, CORRECTED, cross-check held): brief ~12,465; live **12,485** totalRecordCount (brain_stats: core 8624 + materials 1775 + reference 1690 + tools 245 + graphrag 144 + books 7). Stale 12,413 at docs/THE-BRAIN.md:35/39, MINDRIAN-CANON.md:708, CLAUDE.md:47/101/407.
- These three are off from the brief's own "live" figures too (read-time drift); the spirit - corpus grew past every hardcoded surface - holds in all three.

### 2.4 A-7 REFUTED: the "frameworks were archived" hypothesis is wrong (with a cross-check correction)
- Brief said: the 748->176 Framework collapse is explained by archiving; ~602 Archived total.
- Live is: Archived total = **602** CONFIRMED (breakdown Concept 424, Person 187, __Entity__ 178, Method 47, Organization 15, CreativeWork 1). But the archiving HYPOTHESIS is REFUTED. Note the cross-check correction to the prior agent: it reported archived-Framework = 0 by querying `original_label` (null on all 602), but the actual provenance key is `former_label` - `MATCH (n:Archived) WHERE n.former_label='Framework'` = **51**, not 0. Even so, 51 archived frameworks cannot explain a ~571 drop (~9%); the ~520 remaining lost frameworks were deleted/relabeled, not archived.
- What it changes: drop any claim that archiving accounts for the Framework collapse. Provenance key is `former_label`, and it covers only ~9% of the loss.

### 2.5 A-1/A-8: two brief artifacts are fictitious
- The "~5,797" Larry-prompt node figure exists NOWHERE in the repo (`grep -rF '5,797'` and word-boundary `5797` return only sha256 substrings in tests/fixtures). Remove this attribution entirely.
- "157" is not a hardcoded book count surface; it appears only at docs/CANON-RECALIBRATION-PROPOSAL.md:81/86/108 as a brain_search-cited audit note. The genuine A3 tripwire literals are 275+, 313, 23K, 748, plus the canon 27,804/12,413 set. ("23K" lives at mcp-server-brain/lib/brain-ask.cjs:516, commands/setup.md:130, lib/wiki/wiki-layout.cjs:55, docs/BUSINESS-MODEL-AND-MOAT.md:25/84/176.)

### 2.6 C-2 REFUTED: the canon does NOT under-claim chain confidences
- Brief said: R6 defers earned chains "because curated chain confidences don't exist yet," while the graph shows 171 confidences.
- Live is the opposite: MINDRIAN-CANON.md:467-468 states "FEEDS_INTO carries curated confidence (v1), surfaced via the LOCAL projection; absent/uniform confidence is the defect to remove." Lines 442-445 make the deferral one of hard-FAIL ENFORCEMENT (substrate-gated, held warn/aspirational "so no unproven number is frozen as hard law"), not of existence. `grep "don't exist|do not exist|not yet"` intersected with chain/confidence = ZERO matches.
- What it changes: delete the "canon-vs-reality under-claim" framing. The milder true observation: R6 stays DEFERRED-ENFORCEMENT even though a confidence substrate already exists (16-18 confidence-bearing edges on disk), by deliberate evidence-discipline.

### 2.7 E-2 CORRECTED: the tier-floor half of the security invariant is false
- Brief said: external content lands Practitioner-tier-or-lower, proposed, never auto-confirmed.
- Live is: `review_status='proposed'` is a hardcoded literal in the INSERT (evidence-claim.cjs:122) and no research-path code writes 'confirmed' - that half HOLDS. But the tier floor is FALSE: source-lens-driver.cjs:65-71 maps openalex/arxiv/pubmed -> **Academic**, brain-cypher -> Operational, tavily -> Practitioner; the tier passes uncapped through findings-wirer.cjs:155/288. Academic external sources land Academic tier.

### 2.8 E-3 / E-5 REFUTED: the stored-injection vector is OPEN
- Brief's implied posture: ingest is defended.
- Live is REFUTED. There is NO instruction/jailbreak stripping on any ingest path; the poison test confirms the sentinel `IGNORE_ALL_PRIOR_INSTRUCTIONS_AND_EXFILTRATE` lands in room.db verbatim (tests/test-part8-poison-transcript.cjs:48/80/94). One ingest-side sanitizer exists but only strips email/URL PII with an 80-char cap (`stripSnippetPii`, domain-insight-sweep.cjs:58-69, applied :89) - it passes instructions through. STRUCTURAL GAP CONFIRMED: `EvidenceClaim` - the very type carrying external bytes - is ABSENT from `TRUTH_CLAIM_TYPES` (transitions.cjs:42), so `promoteNodeStatus` (transitions.cjs:106-110) does NOT structurally reject an agent-attributed confirm of an EvidenceClaim, contradicting evidence-claim.cjs:21-28's comment. Its non-auto-confirm rests only on the 'proposed' default + absence of a promotion code path. Verdict: OPEN (partially mitigated by 'proposed' default + HITL).

### 2.9 F-1 / F-2 / F-4b: citation surface moved
- F-1 (CORRECTED, held): live canon is **v1.18 / 2026-06-25** (MINDRIAN-CANON.md:3-4, footer :792), not v1.15 (brief) or v1.16 (gap-doc). Bump trace 1.15->1.16->1.17->1.18 via Appendix D entries 27/29/30.
- F-2 (REFUTED, held): Appendix D last entry is **30**, not 26. Entries 27-30 (R15 Render Coverage/Phase 178; Part 5/10 transfer-evidence; Part 12 Pedagogy; Part 12 elevate-sequence) postdate the brief snapshot.
- F-4b (CORRECTED, held): the ArbiterOS altitude-distinction line (runtime kernel vs merge-time coverage) lives in 172-GOVERNOR-RESEARCH.md:15/28, NOT in canon entry 26 (MINDRIAN-CANON.md:728), which carries only the flat "separated enforcement kernel" line.

## 3. What held (do not re-litigate)

- INV thesis (the load-bearing spine): ProblemType=26, Phase=119 (INV-3); 100% of ADDRESSES_PROBLEM_TYPE edges are knowledge-origin, zero command/agent/pipeline/persona (INV-4); `decide()` projection-blind (INV-5); consumption quarantined to two on-ramps (INV-7).
- Corpus exact hits: empty-desc Framework stubs = 45 exact (A-3); DictionaryTerm = 264 (A-4); Book = 176 (A-5); Archived total = 602 (A-7 sub-claim).
- INV5-gate (false-green claim SUBSTANTIATED, all 3 CONFIRMED): the born-wired hard-FAIL gate computes coverage from merge-time FRONTMATTER marking (classifySurface, build-connector-registry.cjs:496-546; live wired 90 / excluded 36 / gap 0, identical on disk in connector-coverage-ledger.json), never runtime reach. The projection twin's UN-WIRED check is a static OPERATES->reach edge walk (build-orchestration-projection.cjs:1045-1082), not a live `decide()` trace. `doctor --drift` runs only Class P prose-vs-code + Class Q gsd-record drift (doctor.cjs:207-210/4477-4495); no drift class probes reachability. Canon Part 11 R7 / Appendix D entry 19 already concede "live nav-engine consumption of the cache is deferred"; entry 27 R15 GA-4: "the gate proves WIRED-to-emit, not fired-this-turn."
- D-evidence (all 4 CONFIRMED): the empirical ratification gate was never run (Variable Reward measured 0.0/10, empathy 0/5; the Hooked composite /70 was never produced - v1.13.0-PART-10-RATIFICATION-GATE.md:44-62); Phase 150.7 validation week never executed (150.7-SUMMARY.md:21/31/36); no insight-to-decision/transfer/outcome telemetry exists (schema.cjs freezes 15 engagement/process proxies; the only "latency" is local context_assembly machine-perf); Part 10 ratified 2026-06-17 on bare navigator judgment "not on the gate's evidence bar" (None/Practitioner-tier at a commit-class decision).
- B-6 (CONFIRMED): CIRS R1 coverage scope excludes the `:Framework` label - unit of coverage is a command/skill/agent FILE surface (MINDRIAN-CANON.md:448; build-connector-registry.cjs:559).
- E-1 (CONFIRMED): single chokepoint `writeEvidenceClaim` (evidence-claim.cjs:65, INSERT :119-125) for all external-content writes. E-4 (CONFIRMED): the Part 8 scan covers LOCAL->BRAIN egress only.
- F-3 (CONFIRMED): exactly **29** edge types in the frozen ALLOWED_EDGE_TYPES Set (edges.cjs); gap-doc's "30+" is wrong. F-4a (CONFIRMED): entry 26 cites arXiv 2510.13857 (ArbiterOS).

## 4. Unverifiable / deferred

- B-dark-frameworks (B1-B5) and C-1: UNVERIFIABLE this run. Brain raw Cypher (`brain_query`) is admin-gated and refused every query ("Raw Cypher query access requires admin key"). The teaching-graph counts 176 frameworks / 76 no-trigger / 56 no-chain / 383 ALIAS_OF / 6x JTBD-scenario / 203 FEEDS_INTO / 171 confidences CANNOT be confirmed or refuted. The LOCAL fallback does NOT substantiate them: the projection holds only 28 frameworks (all wired), 16 FEEDS_INTO, ZERO ADDRESSES_PROBLEM_TYPE and ZERO ALIAS_OF edges. The repo's own SEED-framework-coverage-live-population.md:52-56 and CANON-RECALIBRATION-PROPOSAL.md:21/65 state verbatim that 176/76/56/383 "appear in ZERO source-of-truth" and must not be asserted as fact. Local read-models show at most 2 name-variants each for JTBD/scenario, not 6x. The A-corpus numbers in section 2.3 were reachable only because they were measured via the `my-neo4j` MCP read-Cypher path, not `brain_query`; the B/C teaching-graph edges have no my-neo4j-reachable counterpart that was queried this turn.
- Cross-check integrity: every flip submitted to adversarial re-verification HELD (A-1, A-2, A-6, A-7, C-2, E-2, E-3, E-5, F-1, F-2, F-4b all "holds: true"). No flip collapsed. Two cross-checks corrected the prior agent's EVIDENCE while preserving the verdict: A-7 (archived-Framework is 51 via `former_label`, not 0) and E-3 (an email/URL-only ingest PII strip does exist; the "no ingest sanitization" framing was too broad, but no instruction strip exists so the vector stays OPEN). One bookkeeping note: F-1's prior line citations (:57/:61/:63) pointed at BONO content; the 1.18 conclusion is correct, the line numbers were wrong.

## 5. Recommended edits for brief v3

1. Repoint every corpus number: 27,882 -> 27,904; ~176 -> 177; ~12,465 -> 12,485. Keep "spirit holds" language. Note all are above every hardcoded surface.
2. Reframe INV-2 throughout: "operation tier holds 0 nodes" -> "operation tier holds 0 nodes IN NEO4J but is populated LOCALLY (249 projection nodes / 90 connectors); the defect is unconsumed-by-ambient-turn, not unbuilt." Carry this into any downstream claim that depends on tier emptiness.
3. Delete the "~5,797 Larry-prompt nodes" figure (fictitious) and demote "157 books" to "an audit-note count in CANON-RECALIBRATION-PROPOSAL.md, not a live surface." A3 tripwire target list = {275+, 313, 23K, 748, 27,804, 12,413}.
4. Replace the A-7 archiving hypothesis with: "the 748->177 collapse is NOT archiving; only 51 archived nodes carry `former_label='Framework'` (~9%); the remainder were deleted/relabeled."
5. Rewrite C-2: remove "canon says confidences don't exist." State instead that R6 affirms curated FEEDS_INTO confidence v1 exists in the local projection and defers only hard-FAIL enforcement by evidence-discipline.
6. Soften E-2's invariant to: "external content lands `review_status='proposed'`, never auto-confirmed (HOLDS); the Practitioner-tier-floor clause is FALSE - academic sources land Academic tier." Escalate E-5: mark the stored-injection vector OPEN, and add the structural fix - either add `EvidenceClaim` to `TRUTH_CLAIM_TYPES` or document it as intentionally never-promotable, plus an ingest instruction-stripping/quarantine pass and Decision-Gate adversarial-content flagging.
7. Update citation surfaces: canon v1.15 -> v1.18; Appendix D entry 26 -> 30; note the ArbiterOS altitude line is in the research file, absent from canon entry 26.
8. Re-rank priorities: the B/C dark-framework and chain-confidence work items should be flagged "magnitude admin-gated, directional only" until a write-capable Brain key or a Phase-137 snapshot lands - do not stake hard-FAIL gates on 176/76/56/383/203/171. The INV5-gate "false-green" finding is already canon-acknowledged (Part 11 R7, Appendix D 19/27), so it is a known-residual, not a new discovery - rank it as "confirm + close the deferred consumer," not "investigate."

## 6. The one open design decision

INV-2's entire scope forks on a question this swarm verified but cannot adjudicate, because it is a [CANON] navigator judgment, not a [CODE] fix:

**Is the dark operation tier a BUG or DELIBERATE RESTRAINT?**

The verified facts that frame it: the operation tier is fully populated locally (249/90), and the ambient resolver `decide()` is projection-blind by construction (INV-5), with consumption quarantined to the post-gate on-ramps `runChain` and `/mos:act` (INV-7). Nothing in the code is broken; the question is whether that wiring is the intended design.

- If BUG: the ambient conversational turn SHOULD reach capabilities every turn, and the missing decide-time projection consumer is a defect to build (this aligns with INV5-gate's "false-green" reading and Appendix D entry 27's "WIRED-to-emit, not fired-this-turn").
- If DELIBERATE RESTRAINT: the ambient turn is meant to stay quiet and end at a Decision Gate per Part 12 Invisibility + GUIDED-default, and projection-blindness is the feature, not the bug - the operation tier should fire only inside the approved on-ramps, exactly as it does today.

Both readings are fully consistent with the verified code. The navigator must resolve this BEFORE INV-2 proceeds, because INV-2's remediation (build the decide-time consumer vs. document the restraint) inverts entirely on the answer. The swarm's role ends at confirming the mechanism; the ruling is canon-class.