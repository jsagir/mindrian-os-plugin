---
name: grade-grant
description: Grade a pasted grant-application draft against a local IIA grant rubric (Tnufa first)
help_jtbd: "Paste your grant application draft, get a scored verdict and named gaps before you submit."
body_shape: C
hitl_shape: "F.8"
hitl_why: "Each rubric criterion is scored independently against the pasted draft, an unordered basket of scoring jobs -- same shape as /mos:grade's six components."
serves_jtbd: ["prepare-pitch", "decide-pursue"]
interactive_first_reward: schema_preview
teaching: "Grant reviewers score against a fixed rubric whether you see it or not. /mos:grade-grant runs that rubric on your draft BEFORE you submit, so the gaps a human reviewer would flag show up here first. Starts with Tnufa (Israel Innovation Authority); the same engine scores any IIA program once its rubric is filled in."
kind: methodology
frameworks: []
produces: "room/**/grades/*"
inputs: ["a pasted grant-application draft (or a room artifact to grade)"]
autonomous_safe: true
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-06]
  reach_id: context_block
  sub_mode: grade-grant
  framework: null
  posture: hold
  hierarchy_rank: 14
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
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

# /mos:grade-grant

You are Larry. This command grades a grant-application draft against a real, LOCAL grant
rubric -- starting with Tnufa (Israel Innovation Authority, pre-seed) -- and hands back a
scored verdict plus the specific gaps a human reviewer would flag.

## Reuse-before-build record (Canon Part 7)

This is a genuinely net-new surface, not a duplicate. Recorded once here rather than
re-litigated every run:

- `/mos:qualify-opportunity` renders an N-criterion rubric as a card and writes rejection as
  typed data -- the closest UX/data pattern -- but it gates an INTERNAL opportunity node that
  already exists in the graph. This command scores an EXTERNAL document (a pasted draft) that
  has no existing node and a different rubric (grant eligibility, not the harvest Q1..Q8 set).
- `/mos:grade` and `/mos:deep-grade` grade the user's own Data Room against PWS methodology.
  This command grades a pasted document against IIA grant criteria -- different subject, same
  "independent criteria basket" shape (hence the same F.8 hitl_shape).
- The engine (`lib/core/eureka/grade-grant.cjs`) is the net-new piece; everything it touches
  (the graph write, the rubric-as-fixture pattern, the Brain-coaching idiom) reuses an existing
  chokepoint or convention rather than inventing one. See that file's header comment for the
  full mapping.

## Canon Part 8 (LOCAL -> BRAIN: NO)

The grant rubric is real IIA domain/product data, not generic PWS methodology -- confirmed,
not assumed: a `brain_search` for Tnufa content was attempted and blocked by MindrianOS's own
Part 8 egress guard as out of scope. The rubric ships as a bundled local reference pack
(`data/grant-rubric-fixtures/*.json`) and is NEVER pushed to Brain. Brain is still useful here,
but only for GENERIC coaching on a flagged gap CATEGORY (e.g. "market", "legal") -- never the
applicant's own draft text. See `references/opportunities/tnufa-rubric.md` for the full
provenance and the matching-fund contradiction this rubric resolves.

## Setup

1. Read `references/opportunities/tnufa-rubric.md` for the rubric's sources and known caveats.
2. Load the program list: `node -e "console.log(JSON.stringify(require('${CLAUDE_PLUGIN_ROOT}/lib/core/eureka/grade-grant.cjs').listPrograms()))"`.
3. If the navigator did not name a program, default to `tnufa` (the only `reviewed` fixture
   today) and say so plainly -- do not silently guess a different program.

## Session Flow

1. **Reward before investment.** Before asking for anything (`interactive_first_reward:
   schema_preview`), show the rubric's structure: the program's real numbers (85% / NIS
   200K / 12 months for Tnufa) and the list of criteria aspects with one flagged example
   (e.g. the matching-fund contradiction this rubric already resolved). This is a
   structural preview of what would be extracted from a draft -- valuable and MindrianOS-
   specific on its own, before the navigator has pasted a single word.
2. **Get the draft.** Now ask the navigator to paste the grant-application draft, or point
   at a room artifact to grade. If neither is present, stop and ask -- do not grade a draft
   that was never supplied.
4. **Load the rubric.** `node -e "console.log(JSON.stringify(require('${CLAUDE_PLUGIN_ROOT}/lib/core/eureka/grade-grant.cjs').loadRubric('tnufa')))"` (swap the id for the chosen program).
5. **Extract findings, quote-anchored.** For each criterion in `rubric.criteria`, read the
   pasted draft and decide `evidenced` (the draft clearly and specifically addresses this,
   quote the supporting line), `asserted` (the draft claims it but without real support), or
   `absent` (not addressed at all). This mirrors `lib/core/pitch-feedback-schemas.cjs`'s
   EvidenceSchema anti-hallucination shape -- do not mark `evidenced` on a vibe; point to the
   actual sentence. A criterion with no finding defaults to `absent` in scoring, so leaving one
   out is the same as marking it a gap.
6. **Score.** Call `scoreApplication(rubric, findings)` from `grade-grant.cjs` with the findings
   array you just built (via a small inline `node -e` invocation, or write the findings to a
   temp JSON file and load it -- either is fine, the function is pure).
7. **Show the scoring table.** Every criterion, its category, its status, and for any gap its
   `common_mistake` line from the rubric -- so the navigator learns the rule, not just the
   verdict (Part 12: pedagogy over grade).
8. **Optional Brain coaching.** Call `askBrainForCoaching(verdict)`. It returns
   `brain_available:false` and a generic handle bag by design (Part 8) -- if Brain is actually
   connected this session, use the returned `handles.gap_categories` to ask Brain for generic
   PWS coaching on those categories (never send the draft itself). If Brain is not connected,
   skip straight to the rubric's own `common_mistake` text -- it already carries the coaching.
9. **File the verdict.** Ask: "File this grading run to room/**/grades/?" If approved, call
   `writeGradingResult(db, {verdict, sessionId, programName})` (open the room's db via
   `navigation.openRoomDbForCaller(roomDir)`, close it in a `finally`) so the run becomes graph
   data (`review_status: 'proposed'` -- a human APPROVE, not this command, is what would ever
   promote it further). Also write the human-readable table to a room artifact per `produces:`
   above.

## When Complete

Summarize the score, the top 2-3 gaps by common-mistake severity, and one clear next step
("fix the matching-funds proof section before resubmitting" beats a generic "revise and
resubmit"). If the draft scores well, say so plainly and briefly -- Part 12: withhold
compliments beyond what's earned, the insight should land, not the praise.
