---
name: qualify-opportunity
description: Qualify or skip harvested opportunity candidates at the F.1 Decision Gate
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Decide which harvested opportunity candidates deserve to file into the bank."
argument-hint: "[review]"
body_shape: E (Action Report)
hitl_shape: "F.1"
hitl_why: "Opportunity qualification is a material navigator decision; nothing files without approval."
serves_jtbd: ["explore"]
teaching: "When the harvest sensor surfaces a candidate, /mos:qualify-opportunity puts the decision where it belongs: with you. The card shows WHY the candidate qualified (the Q1..Q8 rubric verdicts plus machine-readiness components), so you learn the qualification tests while you decide. Rejection teaches as much as approval - a Skip becomes graph data the ranker learns from."
allowed-tools: Read Bash AskUserQuestion
# --- Phase 219-04 connector frontmatter (born-wired, Canon Part 11 CIRS R1 / D-10) ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: qualify-opportunity
  framework: null
  posture: hold
  hierarchy_rank: 4
  filing: none
  plan_gated: false
  web_scope: null
  surface: F.1
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

# /mos:qualify-opportunity -- The Qualification Decision Gate

> The human gate between a harvested candidate and the Opportunity Bank. The harvest sensor
> (SENS-14) reaches this surface when fresh candidates exist; nothing files without your
> explicit Qualify (Canon Part 3: qualification is a MATERIAL navigator decision).

## How It Works

The harvest producer writes candidates (enum/handle-only) to
`<room>/.mindrian/last-opportunity-harvest.json`. This surface dereferences the node handles
against room.db LOCALLY, renders each candidate as a real F.1 AskUserQuestion card via
`lib/core/eureka/qualify-opportunity.cjs::renderQualificationCard`, and dispatches your verb
choice to the governed handlers. Every card shows WHY the candidate surfaced:

- **Rubric verdict lines** - the compressed Q1..Q8 human checks (friction, connection,
  surprise, timing, actor fit, definability, newness, desirability). Pedagogy over verdict
  (Canon Part 12): you see the reasoning, not just a score.
- **Component readiness lines (D-18)** - machine readiness from EXISTING measured signals
  (critic gate, compression, portfolio, tail flag, evidence readiness, follow-through
  readiness) plus the advisory HarvestIndex_v1 (EXPERIMENTAL). A missing input renders the
  typed `unknown` verbatim - NEVER a fabricated zero.

## The Verbs

| Verb | What it does | Writes |
|------|--------------|--------|
| **Qualify+file** | Confirms the node (the human promote), advances lifecycle to `qualified`, files a bank entry | node confirm + D-17 stage_history + opportunity-bank/ entry |
| **Ask Brain** | Consults the teaching graph with GENERIC framework handles only (Part 8: no candidate prose crosses the wire); recommend-never-trigger when Brain is absent | none |
| **Rephrase** | Hands the candidate back for re-title before deciding | none |
| **Suggest next** | Moves to the next-ranked candidate | none |
| **Skip** | Writes a `REJECTED_BECAUSE` edge with the failed-check reason enum; the node stays proposed | rejection edge + D-17 outcome `rejected` |

**Skip reason enum** (the single scalar written into the rejection edge):
`q1_no_friction | q3_within_cluster | q4_stale_window | q5_no_actor | q7_already_filed |
q8_disqualified | off_topic`. Rejection is data (Decision 13, SEED-009): the ranker learns
from why-not as much as from yes, and rejected candidates never resurface.

## What Qualify Does NOT Do

**[Explore] is a SEPARATE explicit action** - Qualify NEVER auto-fires the explored-stage
analysis chain (REQ-4, navigator cost control). A qualified opportunity waits in the bank
until you explicitly trigger its exploration from that separate surface (Plan 219-05).

## D-20: The Engine-Unavailable Offer

When the harvest engine legs cannot run (capability probes failed beyond the graceful rungs,
crash, missing substrate - the FTS5 class), the card OFFERS one extra verb at the gate:
**[LLM manual scan (high effort)]**. On acceptance, the model reads the room artifacts
directly and scores candidates by the SAME Q1..Q8 rubric + D-18 component definitions.

- NEVER the default, NEVER a silent substitution (the corepower lesson).
- Every manual result carries `engine_mode: llm_manual_baseline` in node props, report
  provenance, and the bank entry frontmatter.
- Manual results NEVER flip calibration/baseline status and are EXCLUDED from calibration
  sets (downstream consumers key on the marker).
- Files through the SAME navigation.cjs chokepoints as engine results; Part 8 unchanged.

Test seam: `MINDRIAN_FORCE_ENGINE_ABSENT=1`.

## Canon Compliance

- **Part 3**: Qualify and Skip are material decisions behind a real Decision Gate card.
- **Part 8**: LOCAL room.db only; Ask Brain sends generic framework handles, never prose.
- **Part 9**: only the human Qualify confirms a truth-claim node (navigation.confirmNode);
  the writer mints proposed, always.
- **Part 11 (CIRS)**: this surface is born WIRED - SENS-14 dispatches here via sub_mode
  `qualify-opportunity`; hitl_shape F.1 declared above.
- **Part 12**: the card teaches the qualification tests while you decide.
