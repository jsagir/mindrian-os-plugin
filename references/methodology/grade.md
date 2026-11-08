# PWS Grading -- Framework Reference

*Loaded on demand by `/mos:grade`*

## Framework Overview

The PWS Grading framework evaluates problem discovery quality -- not business plans, not pitch decks, not ideas. You grade how well someone found and validated REAL problems worth solving. Based on weighted scoring across 6 components. The scoring result goes to the internal record and the file header; the review a student reads states findings (see the Review contract section).

The operating principle: Finding ONE deeply validated real problem is worth more than twenty assumed problems. Grade accordingly. Grade on thinking, not polish. If the student has not made Larry feel uneasy or surprised, they have not gone far enough.

Cross-reference: `references/personality/assessment-philosophy.md` for the broader grading philosophy (Vision Quality, Framework Mastery, Evidence Depth, Market Sophistication, Presentation Thinking).

## The Voice (This Methodology)

Larry in evaluator mode. Direct. Evidence-focused. No sugar-coating. 80% of evaluation weight falls on evidence quality. Assumptions get zero credit. Well-structured fantasies get zero credit.

Signature phrases:
- "Grade on thinking, not polish. Did you push the trend to absurdity, or stop where it was still comfortable?"
- "You listed twelve problems. How many did you validate? That's your real number."
- "This reads like a hypothesis, not a discovery. Where's the evidence?"
- "Nice framework usage. Did it change what you thought, or just confirm it?"
- "No credit for well-structured fantasies."
- "Finding the problem is harder than solving it. Show me you did the hard part."

Anti-patterns to catch:
- Grading without computing the scoring table in the internal record -- the numbers still have to be worked out and kept
- Giving credit for assumptions, no matter how well-structured
- Weighting business viability over problem reality -- this is discovery, not pitch
- Accepting framework name-dropping as framework integration
- Delivering a grade without specific next actions
- Sugar-coating a weak submission -- Larry is direct

## The Scoring Formula

**Non-negotiable formula:**

```
Discovery_Score = 0.35*Problem_Reality + 0.25*Problem_Discovery + 0.20*Framework_Integration + 0.10*Mindrian_Thinking + 0.05*Can_We_Win + 0.05*Is_It_Worth_It
```

Each component is scored 1-10, then multiplied by its weight to produce weighted points out of 100.

## The Six Scoring Components

### 1. Problem Reality (PR) -- 35%

"Is it real?" This is the only question that matters at 35% weight.

| Criteria | What to Look For | Score Guide |
|----------|-----------------|-------------|
| User Pain Evidence | Direct quotes, observed behavior, documented complaints | 8-10: primary research. 4-7: secondary. 0-3: assumed |
| Problem Frequency | Occurrence data, pattern evidence | 8-10: quantified. 4-7: estimated. 0-3: guessed |
| Current Solutions Gap | What exists, why it fails | 8-10: competitive analysis done. 4-7: surface review. 0-3: "nothing exists" |
| Root Cause Analysis | 5 Whys depth, structural causes | 8-10: hits structural root. 4-7: stops at symptoms. 0-3: not attempted |

### 2. Problem Discovery (PD) -- 25%

Quantity AND quality of problems uncovered:
- How many problems identified?
- What percentage validated as real?
- Problem diversity: acute, chronic, latent, future?
- Did they find the non-obvious ones?

### 3. Framework Integration (FI) -- 20%

Did they use PWS tools systematically -- or just name-drop?

| Framework Type | Expected Tools | What to Grade |
|---------------|---------------|---------------|
| Problem Finding | JTBD, Four Lenses, User Journey, TTA | Were they APPLIED or just MENTIONED? |
| Problem Validation | 5 Whys, Root Cause, Mom Test | Did validation change their view? |
| Problem Framing | PWS, Issue Trees, MECE | Is the problem structured or fuzzy? |

"Listing a framework is not using a framework."

### 4. Mindrian Thinking (MT) -- 10%

Did they leverage cross-domain connections?
- Related frameworks discovered beyond the obvious?
- Hidden problem space connections identified?
- Cross-domain insights that reframed the problem?

### 5. Can We Win? (CW) -- 5%

Basic capability check -- not a business plan:
- Does the team have relevant skills or access?
- Not dominated by entrenched incumbents?

### 6. Is It Worth It? (IW) -- 5%

Basic market sizing -- not an investment thesis:
- Problem affects enough people?
- Big enough to matter?

## Letter Grade Scale

| Grade | Score | Meaning |
|-------|-------|---------|
| A+ | 95-100 | Multiple validated real problems with deep evidence |
| A | 90-94 | Well-validated problems with strong methodology |
| A- | 87-89 | Solid validation with minor gaps |
| B+ | 83-86 | Good discovery, validation incomplete |
| B | 80-82 | Reasonable work, several unvalidated assumptions |
| B- | 77-79 | Discovery present, evidence thin |
| C+ | 73-76 | Problems identified but mostly assumed |
| C | 70-72 | Weak validation, many assumptions |
| C- | 67-69 | Minimal discovery, poor methodology |
| D | 60-66 | Little real problem discovery |
| F | <60 | No validated problems. Speculation only. |

## Phases

### Phase 1: Room State Analysis (silent)

Read ALL room sections before scoring. Do not score based on one section alone. The grade reflects the entire venture state.

Gather:
- All problem statements and evidence claims
- All framework applications
- All market and competitive data
- All cross-domain connections
- Overall depth and completeness

### Phase 2: Component Scoring (turns 1-2)

Score each of the 6 components 1-10 based on evidence found in the room. Be specific about what drove each score.

### Phase 3: Reality Check (turn 2)

Classify every claim in the room:
- **Validated**: Backed by primary research, data, or direct evidence
- **Assumed**: Stated without evidence -- zero credit
- **Fantasy**: Unfounded assumptions -- called out explicitly

### Phase 4: Grade Computation (turn 3)

Apply the weighted formula. Compute the total. Assign the letter grade.

### Phase 5: Revision Points (turn 3)

3 to 5 specific, actionable next steps to improve the work. Each one should target the weakest components. They become the revision points of the review.

## Review contract

The review contract is the fixed shape of the text a student reads. It is enforced by code (`lib/core/review-contract.cjs`) and held as data (`data/review-contract.json`). A drift test pins this section to that data.

### What the review is

The reader-facing review is the part a student reads. It is written from the student's room, in the student's own words and the course's own words. It is not a copy of tool output, and it is not the internal record.

### The shape

Headings, in order:

1. Executive Summary
2. Reality Check
3. Faculty Questions
4. Expert Conversations
5. Research Validation + Reframe
6. Strategic Challenge
7. For advanced students (optional last note)

Each heading is a level 2 heading. The last note is optional. A review has no other level 2 heading.

- Revision points: 3 to 5. They are the top-level list items under Executive Summary. Each one starts with a bold takeaway.
- Cross-domain ideas in the body: at most 2. Each one is a list item that starts with the bold label "Cross-domain:". More ideas go in the optional last note.
- Length: no number is set. The owner chose not to set a word limit or a question limit, so none is stated here and none is invented.

### Plain words

- Name a method only as the course teaches it. Leverage points, causal loops, and stocks and flows are taught. Explain any other term in plain words, or cut it.
- The review names no tool, agent, command, database or system. It does not mention a file of the room by its file name.
- The review holds no run id, no tool id and no path.
- Use hyphens. Do not use an em dash or an en dash.

### Forbidden sections

The review has none of these sections: a tool analysis, a score by tool, a list of recommendations mapped to agents, a Sci-Fi section, an image prompt, a health block for a note file. It has no score heading and no persona heading.

### Two layers

- The internal record may keep working vocabulary and the numbers. The grading agent returns it to the command. It is never filed as the review.
- The file header keeps the provenance handles and the score fields (see the template below).
- The review body keeps neither. A calibration table, a tool answer and the name of another cohort's project never enter the body.

### Scores, the persona quote and project comparisons

These are plain statements of what is true now.

- Scores: the review body shows no letter grade, no percentile and no component table. The score fields sit in the file header. Larry shows the numbers in chat when the student asks.
- Persona quote: the review holds no quote from a persona and no personal name.
- Project comparisons: a comparison names no project. It says "a higher-scoring submission in the same course".

The scoring result goes to the internal record and the file header. The review states findings.

## Artifact Template

The reader-facing review follows this template. Placeholders are in braces. The score fields in the file header are filled from the internal record.

```markdown
---
methodology: grade
review_contract: 1
created: {date}
depth: full
venture_stage: {stage}
room_section: problem-definition
provenance: {calibration source and date}
score_total: {score}
grade_letter: {letter}
percentile: {percentile}
---

# Review: {Venture Name}

## Executive Summary

{Two or three plain sentences. Say what the venture is. Say whether the work found validated problems, assumed problems only, or no validated problems. Say what needs work first.}

- **{Revision point 1 takeaway}:** {one plain sentence}
- **{Revision point 2 takeaway}:** {one plain sentence}
- **{Revision point 3 takeaway}:** {one plain sentence}
- **{Revision point 4 takeaway}:** {one plain sentence}

## Reality Check

- **Validated:** {problems with evidence, and the evidence}
- **Assumed:** {problems stated without evidence}
- **Fantasy:** {claims with no basis, called out}
- **Missing evidence:** {what the student should gather}

## Faculty Questions

- {A question a faculty member would ask about the weakest claim}
- {A question about the evidence}

## Expert Conversations

{Who the student should talk to, what each person would say, and what the student should ask.}

## Research Validation + Reframe

{Plain-language check of the main claim against public research, then one reframe of the problem. Use only methods the course teaches.}

- **Cross-domain:** {an idea from another field that mirrors the pattern}
- **Cross-domain:** {a second idea from another field}

## Strategic Challenge

**Big question:** {the one question the student should answer next}

- {A reflection question}
- {A reflection question}
- {A reflection question}

## For advanced students

- **Cross-domain:** {an optional extra idea from another field}
```

## Default Room

(all rooms -- grades the entire venture)

## Cross-References

- **challenge-assumptions**: If the grade reveals untested assumptions
- **validate**: If evidence is thin and needs strengthening
- **build-thesis**: If the grade is strong enough to warrant investment analysis
- **root-cause**: If Problem Reality score is low -- dig deeper

## Brain-Ready Interface

When Brain MCP connects (Phase 4), grading gains:
- Calibrated component weights from 100+ real student projects
- Grade distribution benchmarking against historical submissions
- Framework mastery tracking across revisions
- Vision-to-Execution Gap detection patterns
