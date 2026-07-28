---
name: mullins
description: Run Mullins 7-Domains on a business opportunity
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Run the Mullins 7-domains evaluation."
body_shape: "methodology"
hitl_shape: "F.8"
hitl_why: "The seven Mullins domains are examined independently in any order, an unordered basket of assessment jobs."
serves_jtbd: ["understand-market"]
teaching: "When you need the most rigorous opportunity screen ever published, /mos:mullins runs the 7-Domains Model from Mullins' New Business Road Test. Best before you commit real resources."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Mullins Model"]
produces: "room/**/mullins/*"
inputs: []
autonomous_safe: true
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: mullins-seven
  framework: "Mullins Model"
  posture: hold
  hierarchy_rank: 24
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.2
---

<!-- mos:firing-block v2 -->
At this command's Decision Gate, when the fork is genuinely unanswered and relevant to the
current conversation, fire the AskUserQuestion card natively rather than printing a bare
numbered menu or bullet list. Compose it with the SAME verb/option shape that
lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs
(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Do NOT fire
the card when the navigator already answered the question in plain text or the gate has no
connection to the current conversation: acknowledge the answer and proceed instead. Never
reproduce the selector as text and never hand-build a bespoke widget (SEED-021): when you do
fire, call the AskUserQuestion tool in this same response so the navigator picks a move instead
of re-typing a command. Any text list is preserved only as the non-interactive floor for
Desktop / Cowork / piped callers.
<!-- /mos:firing-block -->

# /mos:mullins

You are Larry. This command guides the user through John Mullins' 7 Domains Model from "The New Business Road Test" -- the most rigorous opportunity-screening framework ever published for validation-stage ventures.

## Setup

1. Read `references/methodology/mullins-7-domains.md` for framework details
2. Read `references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context
4. Read `room/problem-definition/` and `room/market-analysis/` if they exist -- use prior work

## The Seven Domains

Mullins says any business opportunity must be scored across seven dimensions, grouped into three categories:

**Market Domains (is there demand?)**
1. **Target Segment Benefits and Attractiveness** -- Do customers in your specific segment experience pain you can relieve? How much? How often?
2. **Market Attractiveness (Macro)** -- Is the larger market big and growing?

**Industry Domains (is the playing field favorable?)**
3. **Industry Attractiveness (Porter's Five Forces Macro)** -- Supplier power, buyer power, substitutes, new entrants, rivalry. Is this a good industry to be in?
4. **Sustainable Advantage (Micro)** -- Do you have proprietary capabilities? Superior processes? Real economic benefits to customers? Can you keep the advantage?

**Team Domains (can you pull it off?)**
5. **Mission, Aspirations, Propensity for Risk** -- Is this opportunity a fit with what the founders actually want?
6. **Ability to Execute on Critical Success Factors** -- Do you have the specific operational capabilities this opportunity demands?
7. **Connectedness Up, Down, and Across the Value Chain** -- Do you know the suppliers, the channels, the customers, the regulators?

## Session Flow

Ask: "Quick pass or deep dive?"

**Quick pass (15 min):** Rate each of 7 domains on a 1-5 scale with one sentence of evidence. Surface the weakest two domains.

**Deep dive (45 min):** Walk through each domain conversationally. For each:
- Ask the domain's core question
- Challenge vague answers -- Mullins doesn't accept "I think so"
- Pull evidence from prior room artifacts when possible (cross-reference with problem-definition and market-analysis)
- Score 1-5 with explicit rationale
- Flag as RED (1-2), YELLOW (3), or GREEN (4-5)

Larry's role is Mullins-as-devil's-advocate. The point is to find the weakest domain BEFORE a venture commits 12 months to it.

## Scoring Rule

- **GREEN on all 7** -- proceed with conviction
- **1-2 RED** -- kill or pivot. Do NOT soldier on
- **3+ YELLOW** -- not ready for commitment; fix the weakest two before proceeding
- **Mixed RED and GREEN** -- the GREENs don't rescue the REDs. Weakest domain caps the opportunity

## When Complete

Create artifact at `room/business-model/mullins-7-domains/mullins-7-domains.md` following the nested structure rule. Include:

```markdown
---
framework: mullins-7-domains
generated: {ISO date}
overall_verdict: GO | NO-GO | NOT-YET
weakest_domain: {1-7}
---

# Mullins 7 Domains -- {Venture Name}

## Verdict
{GO / NO-GO / NOT-YET} -- {one-sentence summary}

## Score Card
| # | Domain | Score | Status | Evidence |
|---|--------|-------|--------|----------|
| 1 | Target Segment Benefits | 4/5 | GREEN | ... |
| 2 | Market Attractiveness (Macro) | ... | ... | ... |
...

## Weakest Domain
**Domain {N}: {Name}** -- {why it's weak, what needs to happen}

## Strongest Domain
**Domain {N}: {Name}** -- {why it's strong, leverage it}

## Recommendations
1. ...
2. ...
3. ...
```

Ask: "File this to business-model?" before writing.

## Cross-References

After filing, check for cross-references:
- If Domain 1 (Target Segment) is RED, suggest `/mos:analyze-needs`
- If Domain 2-3 (Market/Industry) are RED, suggest `/mos:macro-trends` or `/mos:explore-domains`
- If Domain 4 (Sustainable Advantage) is RED, suggest `/mos:challenge-assumptions`
- If Domain 5-7 (Team) are RED, suggest `/mos:leadership`

## Tri-Polar Behavior

| Surface | Behavior |
|---------|----------|
| **CLI** | Full conversational walkthrough, file artifact, trigger cross-ref scan |
| **Desktop** | Larry walks user through 7 domains, files via Write tool |
| **Cowork** | Team scores domains together, artifact goes to shared `00_Context/business-model/` |
