---
title: "Phase 229 HUJI Pitch Feedback - Calibration Fixture Index"
corpus: Notion "AI larry Reviews" database (CS - LarrAI reviews) + one Events/Problem-solvers page
fetched: 2026-07-15
note: LOCAL ONLY - never crosses to Brain (Canon Part 8). All student names redacted to initials; instructor (Prof. Lawrence "Larry" Aronhime) retained where it appears as T.A.
---

# Calibration Fixtures - Phase 229 (HUJI Pitch Feedback Module)

12 real Larry/LarrAI review artifacts captured as eval anchors. These are the ground-truth
examples of what a graded pitch/opportunity review looks like across the full grade band and
across the format's ~4-month evolution (April -> August 2025).

## Fixture table

| # | File | Title | Grade / Score | Assessment kind | Input modality | Why it anchors an eval |
|---|------|-------|---------------|-----------------|----------------|------------------------|
| 01 | 01-ldes-innovation-assessment.md | LDES Innovation Assessment | **B (6.98/10)** + metrics: Readiness 6.5, Originality 7.8, Market 9.2, Breakthrough 8.1 (/10) | Structured innovation assessment w/ bias detection | Document (9-slide deck PDF) | Mid-band grade with explicit multi-metric sub-scoring AND named cognitive-bias flags (confirmation / wishful / authority). The clearest "how a B is justified" anchor. |
| 02 | 02-ai-education-scenarios.md | AI in Education: Future Scenarios | **D+, CANONICAL 42.5/100** (headline "48.5" is a stale carry-over - see note below) | Scenario / opportunity-space review | Document (focus-group PDF) | Low grade driven by "Evidence Quality 0/10 - never asked teachers/students/parents." Anchors what an evidence-free submission scores. |
| 03 | 03-dental-healthcare.md | Reimagining Dental Healthcare | **A- (87.2%) -> revised A (~91/100, doc says "90.3%")** | Graded assessment + documented revision pass | Document (pptx) | Only fixture showing a full **revision loop** (A- to A over two weeks). Anchors what "moved the grade up" looks like. Minor (~0.8pt) arithmetic drift on the revised total - does not change letter grade, not treated as a hygiene failure. |
| 04 | 04-circular-manufacturing.md | Toward Circular Manufacturing | **CANONICAL 24/100** (page header "43/100" is stale - see note below) | Graded assessment | Document (PDF) | Bottom-of-band anchor. Shows a failing/weak submission scored on the raw 100-pt scale. |
| 05 | 05-feedback-log-type-2.md | Feedback log type 2 | n/a (meta) | **Process-execution audit trail** for the LDES review | n/a (log about #01) | Reveals the grading *pipeline*, not a grade. See "human grading process" below. |
| 06 | 06-feedback-log-type-3.md | Feedback log type 3 | n/a (meta) | **Review-design / rubric-rationale log** for the LDES review | n/a (log about #01) | Reveals the rubric *design intent* and revision reasoning. See below. |
| 07 | 07-week10-mullins-report.md | Week 10 // Mullins // Report Part 1 | no grade (teaching recap) | Class-session recap + Mullins 7-Domains framework walkthrough | Document (deck PDF submission) | Anchors what a **Mullins 7-Domains** application output looks like (market/industry/team domains, MECE validation, GO/patient-capital recommendation). Not a scored review. |
| 08 | 08-dna-data-storage-transcript.md | DNA Data Storage - TRANSCRIPT ONLY (DnATA) | **PWS 95/85/90 -> Overall 90/100** (labelled "if it was A+" projection, NOT an awarded grade) | Dual-audience: "For Student" (10 diagnostic sections) + "For Teacher" PWS 100-pt scorecard | **Transcript** (raw session transcript + slide PDF) | **HIGHEST-VALUE anchor: the exact HUJI modality** - a full review generated from a bare transcript. Richest structure in the corpus. |
| 09 | 09-lucid-tracker.md | Lucid Tracker | **Scorecard 1-5: Real 4 / Win 4 / Worth 5** (no letter grade) | Multi-part pitch review (7 parts) | Deck + session recording (hybrid) | Anchors the high end of the 1-5 scorecard format + the full 7-part review template (Devil's Advocate, HEART, TECH). |
| 10 | 10-dnata-larrai-review.md | DnATA - LarrAI review | **Scorecard 1-5: Real 3 / Win 2 / Worth 3** (no letter grade) | Multi-part pitch review (7 parts) | Deck + session recording (hybrid) | Same venture/team as #08 but the deck-driven review. Pairs with #08 to compare transcript-fed vs deck-fed output on identical work. |
| 11 | 11-surveillance-undefined-problems.md | Undefined Problems - Surveillance | no numeric grade | RICEE opportunity review, green-flag/red-flag, "trending to absurd" | Document (opportunity write-up) | T.A. field = **human professor** (Aronhime). Anchors the Socratic/essayistic template and the green/red-flag device without a number. |
| 12 | 12-cs-bot-review-april7.md | CS Bot Review, April 7 2025 | n/a (hub page) | Intro / review-hub landing page | n/a | **Earliest artifact** - format archaeology. No rubric, no score; just a voiced Larry intro + linked per-team reviews. |

## Observed grade distribution

Graded anchors span nearly the full band (useful - not clustered):

- **Fail / weak:** 24/100 canonical (Circular), 42.5/100 canonical (AI-Ed)
- **Mid:** B 6.98/10 = ~70% (LDES)
- **High:** A- 87.2% -> A ~91/100 (Dental)
- **Scorecard (1-5, no letter):** DnATA 3/2/3 (weak), Lucid 4/4/5 (strong)
- **Projection (not awarded):** DNA-storage PWS 90/100 "if it was A+"
- **Ungraded:** Surveillance (RICEE narrative), Week-10 Mullins (teaching), Bot-review hub, + the two feedback logs (meta)

Three **incompatible grading scales** coexist in the corpus: (a) letter+percentage, (b) raw N/100 or N/10, and (c) per-dimension 1-5 scorecards on Is-it-Real / Can-we-Win / Is-it-Worth-it. An eval designer MUST normalize these and must NOT read the DNA-storage 90/100 as an achieved grade - it is an "A+ target projection."

## Anchor Hygiene Corrections (found 2026-07-15, full-text re-read of 01/02/03/04)

**A second, independent hygiene bug beyond the three-scale problem above: within a single fixture, the headline/banner grade sometimes does not match the detailed component-table's own arithmetic**, because a later, more detailed assessment pass inherits an earlier pass's headline number as decoration instead of recomputing it. This is silent - both numbers "look" canonical (bold, bannered, repeated) and nothing in the fixture flags the mismatch. Two confirmed instances, found by summing every component table in the document by hand:

- **04 Circular Manufacturing: THREE different totals for the same submission.** Page header/executive-summary banner says **43/100**. The "TYPE #1 ASSESSMENT" section's own opening line claims **38/100** (a summary paragraph, not a table). The actual component table (Jobs-to-be-Done 3 + Process Mapping 5 + User Segment 2 + Evidence 8 + Pain-Point 5 + Big/Little Hire 1 = **24/100**) is the only one of the three that is a real sum of scored rows, and it appears TWICE, identically, in both "TYPE #1" and "TYPE #2" assessment passes. **Canonical: 24/100.** The 43 and 38 are unreconciled carry-over headlines from an earlier draft pass. This is a ~79% relative gap from the number this fixture was originally filed under (43) - the largest hygiene gap found in the corpus.
- **02 AI-in-Education: two internally-consistent tables answer different questions, one header cites the wrong one.** Section A (a 7-component generic rubric: Technical Feasibility/Logical Argument/Innovation/Market Reality/Tool Usage/Research Foundation/Team Capability, weights 20/20/15/15/10/10/10) sums to exactly **48.5**, matching its own header - internally clean. Section B (a separate, later pass using the PWS 6-component discovery rubric: Problem Reality 35%/Problem Discovery 25%/Framework Integration 20%/Mindrian Thinking 10%/Can-We-Win 5%/Is-It-Worth-It 5%) sums to exactly **42.5** AND is confirmed by its own machine-readable JSON handoff (`"numeric_score": 42.5`) - but Section B's own prose header still says "FINAL GRADE: D+ (48.5/100)", inherited from Section A instead of recomputed. **Canonical for this module's calibration: 42.5** - it's the PWS-discovery-rubric pass (the rubric our own `PWS_grading` recipe implements), it's the more granular/later pass, and it is independently confirmed by the JSON handoff, not just a table sum. Both numbers land in the same D+ band, so letter-grade fidelity survives either way - but a numeric Spearman correlation must pick one, not silently inherit whichever appears first in the file.
- **03 Dental Healthcare: minor, non-blocking.** Initial grade (89x0.70 + 83x0.30 = 87.2) is exact. The revised grade's own stated components (92x0.70 + 89x0.30 = 91.1) do not match the fixture's stated "90.3%" - an ~0.8-point drift, likely simple rounding in the recap narrative. Does not change the letter grade (A either way) and is not treated as a structural hygiene failure like the two above.
- **01 LDES: clean.** 30%x6.3 + 60%x7.2 + 10%x7.7 = 6.98/10 = B, exact match between header and table.

**Implication for Plan 06 (judge calibration protocol):** use the CANONICAL numbers above (24, 42.5, ~91, 6.98), not the frontmatter `grade:` field's headline number, when computing the 6-anchor Spearman correlation. The frontmatter `grade:` lines in 02-ai-education-scenarios.md and 04-circular-manufacturing.md are left as originally fetched (historical record of what was filed) but are NOT the numbers the judge calibration harness should target.

## Input modality: transcript-fed vs document-fed

- **Transcript-input reviews (the HUJI modality):** 08 DNA Data Storage is the pure case - explicitly "TRANSCRIPT ONLY," generated from a raw session transcript (+ slide PDF). 09 Lucid and 10 DnATA are hybrids (deck + session recording; both link a "RAW TRSCPT" child page). 12 references session recordings.
- **Document-input assessments:** 01 LDES (deck), 02 AI-Ed (focus-group PDF), 03 Dental (pptx), 04 Circular (PDF), 07 Week-10 Mullins (submitted deck).
- **Meta / not-a-review-of-student-work:** 05 and 06 (process logs about #01), 12 (hub page). Do NOT use these as grade anchors.

Pairing 08 (transcript-fed) with 10 (deck-fed) on the *same* team/venture (DnATA) is the single most useful comparison for calibrating the transcript path against the deck path.

## Review FORMAT evolution (April -> August 2025)

The review style matured dramatically over ~4 months - an eval must not assume one fixed schema:

1. **2025-04-07 (12):** Warm ElevenLabs-voiced Larry intro + a linked hub of per-team reviews. **No rubric, no score.** Framed as experimental ("I need your feedback on the feedback").
2. **2025-04-16 (09, 10):** The mature **7-part toggle template** appears: Opening Reflection -> TL;DR -> Problem Statement (original + AI-reframed) -> 1-5 scorecard (Real/Win/Worth) -> Devil's Advocate Q&A **with cited source tables** -> Ben's H.E.A.R.T. investor analysis -> AI deck-idea generator -> TECH engineering checklist -> per-member final notes. Tone: brutal, witty, mentor-realist.
3. **2025-05-06 (11):** A different **RICEE / numbered-section** template (Summary, Review of Opportunity, For Further Consideration, Conclusion, Final Thought) with a green-flag/red-flag device and "trending-to-absurd" reframing. Human professor as T.A. Socratic, essayistic, **no number**.
4. **2025-06 to 08 (04, 03, 08, 01, 02):** The **numeric-grade era**: explicit letter + %/point score, component/innovation-metric sub-scores, **bias detection**, MECE, revision passes (Dental A- -> A), dual student/teacher audiences (08), and process-execution audit logs (05/06). Most rigorous and most structured.

Takeaway for the module: the corpus is not one rubric - it is a maturing family. The stable spine across all eras is **Is-it-Real / Can-we-Win / Is-it-Worth-it** (RICEE / PWS). Everything else (numbers, sections, tone) drifted.

## What the two Feedback-log pages reveal about the (human) grading process

The logs are a rare window into HOW a grade is manufactured, not just the grade:

- **Type 2 (05) = execution audit trail.** The B / 6.98-10 grade is the output of a *pipeline*: 6 "Extended Thinking Stations," Neo4j Systems-Thinking agents, Sequential-Thinking steps, and **Tavily web-validation across 28 sources** (claims are fact-checked before scoring). Crucially, **bias detection is a first-class scoring input** - confirmation bias, wishful thinking, and authority bias are named and counted against the team.
- **Type 3 (06) = review-design rationale.** The reviewer *engineers* the feedback: 11 reordered sections, red/orange/green coding, and **3 reflection questions per section** on a fixed ladder (diagnostic -> methodological -> transformational), justified with constructivist / adult-learning theory and a "complicated vs complex / wicked-problem" reframe. It also documents a **revision pass** (reformatting a prior assessment into a new structure).

Combined signal for the eval designer: a good review here is one that (a) **grounds every claim in checked evidence**, (b) **explicitly flags cognitive bias**, (c) applies a **consistent question/color rubric**, and (d) **reframes the problem** (original -> sharper, falsifiable statement) rather than just scoring it. The Dental A- -> A revision is proof the loop actually moves grades. Calibration should reward evidence-grounding + bias-flagging + reframing, not the number alone.
