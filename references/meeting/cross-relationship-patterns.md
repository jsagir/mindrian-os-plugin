---
title: Cross-Relationship Detection Patterns
description: >
  Defines the 5 edge types (INFORMS, CONTRADICTS, CONVERGES, INVALIDATES, ENABLES)
  that the file-meeting command's Step 6 batch scan uses to discover cross-subsystem
  impacts in the Data Room. Tier 0 detection heuristics require no ML -- Larry's
  reasoning plus keyword matching.
tier: 0
used_by:
  - commands/file-meeting.md (Step 6: batch cross-relationship scan)
  - scripts/analyze-room (convergence + contradiction detection)
  - skills/room-passive/SKILL.md (cascade awareness)
---

# Cross-Relationship Detection Patterns

After all meeting segments are filed, Larry performs a **batch cross-relationship scan** to discover how new artifacts connect to existing room content. This reference defines the 5 edge types, their detection heuristics, and when to surface findings.

## Why Cross-Relationships Matter

Ventures are wicked problems (Rittel & Webber 1973). Changes in one subsystem cascade through others (Simon 1962). The Data Room is NOT a flat document store -- it is a nested system where insights in one section may inform, contradict, or invalidate claims in another. The cross-relationship scan finds what humans miss.

---

## Edge Types

### INFORMS (Impact: MEDIUM)

**Definition:** A new artifact provides evidence, context, or supporting data for content in another room section. The information flows one direction -- source informs target without conflicting.

**Wicked problem connection:** Addresses characteristic #3 ("Solutions are not true-or-false, but good-or-bad") -- new evidence shifts the quality of existing analysis.

**Tier 0 detection heuristics:**
- Shared keywords between new artifact content and existing section entries (noun phrases, proper nouns, technical terms)
- Explicit section references in text: "this affects our financials," "relevant to our market analysis," "connects to the IP question"
- Speaker mentions another domain by name: "from a legal perspective," "on the competitive side"
- New artifact contains data (numbers, percentages, dates) relevant to an existing section's claims

**Examples:**
1. A researcher's insight about material costs INFORMS the financial-model section's cost projections
2. A mentor's feedback about go-to-market strategy INFORMS the market-analysis section's channel assumptions
3. An advisor's note about regulatory changes INFORMS the legal-ip section's compliance analysis

**Surface when:** Direct relevance to a section the user has content in. Skip when the connection is trivially obvious (same section) or when the target section is empty (no existing content to inform).

**Output format:** `INFORMS: {source_artifact} -> {target_section}. {brief explanation}. Impact: MEDIUM.`

---

### CONTRADICTS (Impact: HIGH)

**Definition:** A new artifact conflicts with an existing claim, assumption, or conclusion in the Data Room. The two pieces of information cannot both be true simultaneously, or they present incompatible perspectives on the same topic.

**Wicked problem connection:** Addresses characteristic #9 ("The planner has no right to be wrong") -- contradictions signal that a previous decision may need revisiting. Also addresses #2 ("No stopping rule") -- contradictions re-open what seemed settled.

**Tier 0 detection heuristics:**
- Opposite sentiment about the same topic: one artifact says "market is growing" while another says "market is shrinking"
- Numerical disagreements: different TAM figures, conflicting timelines, mismatched cost estimates
- Contradiction signals in speech: "actually," "contrary to what we assumed," "I disagree," "that's not what we're seeing," "the data shows otherwise"
- Assumption with `status: validated` in frontmatter that new data challenges
- Speaker role conflict: investor says one thing, researcher data shows another

**Examples:**
1. Investor says "TAM is $50M" but market-analysis has an entry claiming "TAM is $190M"
2. New competitive intelligence shows a direct competitor, but competitive-analysis states "no direct competitors"
3. Mentor advises pivoting to B2C but business-model is built entirely around B2B enterprise sales

**Surface: ALWAYS.** Contradictions are the most valuable signal in wicked problem management. They reveal where the venture's understanding is inconsistent. Never suppress a contradiction.

**Output format:** `CONTRADICTS: {source_artifact} -> {target_section}/{target_artifact}. {what conflicts}. Impact: HIGH.`

---

### CONVERGES (Impact: HIGH)

**Definition:** A theme, concept, or concern from the current meeting appears in 3 or more room sections. This cross-cutting pattern signals a topic that is central to the venture and deserves focused attention.

**Wicked problem connection:** Addresses characteristic #7 ("Every wicked problem is essentially unique") -- convergence patterns reveal the unique structure of THIS venture's problem space. Also addresses #5 ("Every solution is a 'one-shot operation'") -- convergent themes are the highest-leverage points for intervention.

**Tier 0 detection heuristics:**
- Key noun phrases from new artifacts appear in 3+ existing section entries (proper nouns, technical terms, framework names)
- Proper nouns mentioned across sections: competitor names, technologies, market segments, regulations
- Themes surfaced by multiple speakers in the meeting that also appear in existing room content
- A single concept (e.g., "sustainability," "compliance," "scalability") referenced across problem-definition, solution-design, and business-model

**Examples:**
1. "Sustainability" mentioned by mentor in problem-definition, by researcher in solution-design, and now by investor in business-model -- convergent theme
2. A specific competitor's name appears in competitive-analysis, market-analysis, solution-design, and now in a meeting discussion -- this competitor is a cross-cutting concern
3. "Regulatory risk" surfaces in legal-ip, financial-model, market-analysis, and the current meeting -- systemic theme requiring a unified response

**Surface: ALWAYS.** Convergence signals that a theme deserves its own strategic attention. It may warrant a dedicated session or cross-section synthesis.

**Output format:** `CONVERGES: "{theme}" appears in {count} sections ({section_list}). Consider a focused analysis on this cross-cutting theme. Impact: HIGH.`

---

### INVALIDATES (Impact: HIGH)

**Definition:** A new artifact makes an existing assumption stale, outdated, or factually incorrect. The assumption's `status` should change from `validated` or `unvalidated` to `invalidated`.

**Wicked problem connection:** Addresses #1 underserved outcome: "Minimize time to detect invalid assumptions" (Opportunity Score: 18). Also addresses characteristic #8 ("Every wicked problem can be considered a symptom of another") -- an invalidated assumption may reveal a deeper problem.

**Tier 0 detection heuristics:**
- Scan existing artifacts' `assumptions:` frontmatter fields. Compare new information against `claim:` values
- Temporal conflicts: "That was true in Q1 but..." / "Since we last discussed..." / "The landscape has changed"
- Numerical/factual conflicts between new data and existing assumption claims
- Speaker explicitly references a previous assumption: "I know we assumed X, but..."
- Market or competitive changes that alter the basis of existing claims

**Examples:**
1. New competitive intelligence invalidates the assumption "No competitors in ionic liquids space" -- a funded startup just launched
2. Updated market research shows the regulatory environment changed, invalidating the assumption "FDA approval not required for our device class"
3. A team member reports that the key technical partner withdrew, invalidating the assumption "Partnership with X secures our supply chain"

**Surface: ALWAYS.** Stale assumptions are the #1 underserved outcome in venture intelligence. An invalidated assumption may cascade through multiple sections. Flag immediately and trace the cascade.

**Output format:** `INVALIDATES: {source_artifact} invalidates assumption "{claim}" in {target_section}/{target_artifact}. {why it's stale}. Impact: HIGH.`

---

### ENABLES (Impact: MEDIUM)

**Definition:** A new artifact unblocks progress in another section. A decision was made, information was provided, or an action was completed that resolves an open question or dependency in another part of the Data Room.

**Wicked problem connection:** Addresses characteristic #4 ("There is no immediate and no ultimate test of a solution") -- enablement signals that the venture can now test a hypothesis that was previously blocked. Also addresses #6 ("Wicked problems do not have an enumerable set of potential solutions") -- each enablement opens new solution paths.

**Tier 0 detection heuristics:**
- Action items completed that other sections referenced as blockers
- Decisions that resolve open questions: "We've decided to go B2B" enables financial-model projections that were waiting on market definition
- "Now we can..." / "This means we can..." / "This unblocks..." / "The missing piece was..." signals
- Resource acquisition (funding, hire, partnership) that other sections depend on
- Regulatory/legal clearance that other sections were waiting for

**Examples:**
1. Decision to go B2B enables financial-model projections that were blocked by undefined target market
2. Securing a Letter of Intent from a pilot customer enables the business-model section's revenue projections
3. Hiring a CTO enables the solution-design section's technical architecture work that was on hold

**Surface when:** The previously blocked section exists and has content waiting. Skip when the target section is empty (nothing to unblock) or when the enablement is trivially local (same section).

**Output format:** `ENABLES: {source_artifact} -> {target_section}. {what is now unblocked}. Impact: MEDIUM.`

---

## Batch Scan Protocol

After all meeting segments have been filed (Step 5 of file-meeting completes), Larry performs the batch cross-relationship scan:

1. **Collect filed artifacts:** Gather all artifacts just filed from this meeting session
2. **Load room context:** For each non-empty room section, read the existing entries (titles, headers, frontmatter including assumptions)
3. **Compare each new artifact:** Against existing room content using Tier 0 heuristics above
4. **Identify significant relationships:** Apply the impact and surfacing rules for each edge type
5. **Present findings:** Show only significant discoveries -- do not overwhelm with trivial INFORMS connections
6. **Prioritize:** CONTRADICTS and INVALIDATES first (highest user value), then CONVERGES, then ENABLES and INFORMS

**Presentation order:**
```
HIGH impact first:
  1. INVALIDATES (stale assumptions -- most urgent)
  2. CONTRADICTS (conflicting claims -- action required)
  3. CONVERGES (cross-cutting themes -- strategic awareness)

MEDIUM impact second:
  4. ENABLES (unblocked progress -- opportunity)
  5. INFORMS (supporting evidence -- enrichment)
```

**User interaction after scan:**
- For each HIGH finding, ask: "Want to explore this?" (opens the relevant section)
- For MEDIUM findings, present as a summary list
- If no significant relationships found: "No cross-subsystem impacts detected from this meeting."

---

## Tier Progression

| Tier | Phase | Method | Capability |
|------|-------|--------|------------|
| **Tier 0** | Phase 6 | Larry's reasoning + keyword matching | Detects obvious relationships via shared terms, explicit references, and speech signals. No dependencies required. |
| **Tier 1** | Phase 8 | LSA + MiniLM embeddings | Semantic similarity discovers non-obvious connections. "Cash burn rate" and "runway" recognized as related even without keyword overlap. |
| **Tier 2** | Phase 9 | Full HSI with Brain graph | Quantitative Hybrid Similarity Index. Pinecone embeddings + Neo4j relationship traversal. Reverse Salient discovery finds hidden cross-meeting connections. |

**Graceful degradation:** Tier 0 always works. Higher tiers enhance accuracy but are never required. A Data Room with only Tier 0 still catches the most impactful relationships.

---

## Output Format Reference

Each discovered relationship is presented as a single line:

```
{EDGE_TYPE}: {source} -> {target}. {explanation}. Impact: {HIGH|MEDIUM}.
```

**Batch summary example:**
```
INVALIDATES: meeting-segment-03.md invalidates assumption "No direct competitors" in competitive-analysis/landscape.md. New entrant Acme Corp launched Q4. Impact: HIGH.
CONTRADICTS: meeting-segment-01.md -> financial-model/projections.md. Investor estimates $50M TAM vs. existing $190M claim. Impact: HIGH.
CONVERGES: "regulatory compliance" appears in 4 sections (legal-ip, market-analysis, solution-design, financial-model). Consider a focused regulatory strategy session. Impact: HIGH.
ENABLES: meeting-segment-05.md -> business-model/revenue.md. B2B decision unblocks pricing model. Impact: MEDIUM.
INFORMS: meeting-segment-02.md -> solution-design/architecture.md. CTO feedback on tech stack choice. Impact: MEDIUM.
```
