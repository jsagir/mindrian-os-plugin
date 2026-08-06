---
name: grade-grant
description: Grade a grant application against a local IIA grant rubric (Tnufa first) -- from a pasted draft OR straight from your room -- and get a build roadmap per room section
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Grade your room or a pasted draft against a real grant rubric, see exactly which room section to build next, or decompose a finished application into a room."
body_shape: C
hitl_shape: "F.8"
hitl_why: "Each rubric criterion is scored independently against the pasted draft, an unordered basket of scoring jobs -- same shape as /mos:grade's six components."
serves_jtbd: ["prepare-pitch", "decide-pursue"]
interactive_first_reward: schema_preview
teaching: "Grant reviewers score against a fixed rubric whether you see it or not. /mos:grade-grant runs that rubric on your draft BEFORE you submit, so the gaps a human reviewer would flag show up here first. Starts with Tnufa (Israel Innovation Authority); the same engine scores any IIA program once its rubric is filled in."
kind: methodology
frameworks: []
produces: "room/**/grades/*"
inputs: ["a populated room (preferred), a pasted grant-application draft, or a finished application to decompose into a room"]
autonomous_safe: true
allowed-tools: Read Write Bash Glob AskUserQuestion
connector:
  connects_to_spine: true
  sensor_triggers: []
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

You are Larry. This command grades a grant application against a real, LOCAL grant rubric --
starting with Tnufa (Israel Innovation Authority, pre-seed) -- and hands back a scored verdict,
the specific gaps a human reviewer would flag, and a BUILD ROADMAP: which room section to build,
and what a strong entry there looks like, to evolve the room toward a fundable application.

## The room_section map (one map, both directions)

Every rubric criterion carries a `room_section` field: one of the 8 standard MindrianOS room
sections, or `null` for pure post-award process/reporting items (submission mechanics, reporting
duties) that have no room-content equivalent. That ONE map drives everything new here:

- **room -> application**: the room already holds what a Tnufa application needs, so grading can
  read the room directly (room-mode) and the roadmap can say "build this in `room/<section>/`".
- **application -> room**: a finished application can be DECOMPOSED into a room -- each piece
  filed into the section the same map says it belongs in -- and then that room gets graded.
- **graph, not prose**: the map is real typed graph structure (`grant_criterion` anchor nodes +
  `MAPS_TO_SECTION` edges to Section nodes, plus per-run verdict->Section `INFORMS` coverage
  edges), written only through `navigation.cjs`, so Brain can coach on the room's STRUCTURAL
  shape (which sections are covered / partial / missing) without ever seeing its prose.

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
- The quick-260806 extension reuses rather than reinvents at every joint: room-mode mirrors
  `/mos:grade`'s read-all-populated-sections Setup verbatim; decompose births its room through
  `navigation.birthRoom` (the ignite/rooms-new keystone), never a bespoke mkdir; graph writes go
  through `navigation.writeEdge`'s closed allow-list (ONE additive `MAPS_TO_SECTION` member,
  minted in `lib/core/navigation/edges.cjs` with its own decision record) and the standard
  Section anchor nodes; the strategy composer mirrors the coaching composer's
  recommend-never-trigger idiom.

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
2. Load the program list: `node -e "console.log(JSON.stringify(require('${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/lib/core/eureka/grade-grant.cjs').listPrograms()))"`.
3. If the navigator did not name a program, default to `tnufa` (the only `reviewed` fixture
   today) and say so plainly -- do not silently guess a different program.
4. Detect the input mode. Check whether an active room exists with populated sections (read
   `room/STATE.md` if present). Room-mode is PREFERRED when a populated room exists; paste-mode
   stays for a navigator without a room yet; decompose-mode is for a finished application the
   navigator wants broken INTO a room. If the navigator's message already names the mode,
   proceed -- otherwise this is the one genuine Decision Gate: offer
   [Grade the room] [Paste a draft] [Decompose an application] per the firing block above.

## Session Flow

1. **Reward before investment.** Before asking for anything (`interactive_first_reward:
   schema_preview`), show the rubric's structure: the program's real numbers (85% / NIS
   200K / 12 months for Tnufa), the criteria aspects with one flagged example (e.g. the
   matching-fund contradiction this rubric already resolved), AND the room_section map --
   which room sections this program's rubric reads from, and which criteria are pure
   process items. This is a structural preview of what would be extracted -- valuable and
   MindrianOS-specific on its own, before the navigator has supplied a single word.
2. **Get the source (by mode).**
   - **Room-mode (preferred when a room exists).** Mirror `/mos:grade`'s Setup: read ALL
     sections of `room/STATE.md`, then read every room sub-section that has content -- you
     grade the ENTIRE room, not one section. Each criterion's `room_section` tells you where
     its evidence SHOULD live, but read the whole room: evidence filed in an unexpected
     section still counts (note where it was found).
   - **Paste-mode.** Ask the navigator to paste the grant-application draft. If nothing is
     supplied, stop and ask -- do not grade a draft that was never supplied.
   - **Decompose-mode.** See "Decompose an application into a room" below, then re-enter
     this flow in room-mode against the new room.
3. **Load the rubric.** `node -e "console.log(JSON.stringify(require('${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/lib/core/eureka/grade-grant.cjs').loadRubric('tnufa')))"` (swap the id for the chosen program).
4. **Extract findings, quote-anchored.** For each criterion in `rubric.criteria`, read the
   source (room sections or pasted draft) and decide `evidenced` (clearly and specifically
   addressed -- quote the supporting line, and in room-mode name the file it came from),
   `asserted` (claimed without real support), or `absent` (not addressed at all). This mirrors
   `lib/core/pitch-feedback-schemas.cjs`'s EvidenceSchema anti-hallucination shape -- do not
   mark `evidenced` on a vibe; point to the actual sentence. A criterion with no finding
   defaults to `absent` in scoring, so leaving one out is the same as marking it a gap.
5. **Score.** Call `scoreApplication(rubric, findings)` from `grade-grant.cjs` with the findings
   array you just built (via a small inline `node -e` invocation, or write the findings to a
   temp JSON file and load it -- either is fine, the function is pure and source-agnostic:
   room findings and draft findings score identically).
6. **Show the scoring table.** Every criterion, its category, its status, and for any gap its
   `common_mistake` line from the rubric -- so the navigator learns the rule, not just the
   verdict (Part 12: pedagogy over grade).
7. **Show the build roadmap.** Call `buildRoadmap(rubric, verdict)`. Render its
   `section_plans` weakest-section-first: for each, "build this in `room/<section>/`" plus
   each gap's `build` text (what a strong entry looks like, drawn from the criterion's
   `details`) and its `common_mistake`. Then render `process_checklist` as a plain checklist
   ("handle at submission time / post-award") -- these criteria have NO room location and must
   never be forced into one. Name `covered_sections` in one line so progress is visible.
   This is the "not just a grade, an offer" step: where and what to build so the room can
   evolve into a fundable application.
8. **Optional Brain coaching -- content AND structure.** Call `askBrainForCoaching(verdict)`
   for per-gap-category coaching handles, and `askBrainForStrategy(verdict, rubric)` for the
   STRUCTURAL handle bag (`section_profile`: covered / partial / missing per mapped section).
   Both return `brain_available:false` by design (Part 8) -- if Brain is actually connected
   this session, fire the generic handles (categories + section-coverage enums only, NEVER
   room or draft prose) and ask for strategic advice on the SHAPE: which section to
   strengthen first and why. If Brain is not connected, the roadmap's weakest-first ordering
   plus each gap's `common_mistake` already carry the coaching.
9. **File the verdict -- node AND graph.** Ask: "File this grading run to room/**/grades/?"
   If approved, over one db handle (`navigation.openRoomDbForCaller(roomDir)`, closed in a
   `finally`):
   - `writeGradingResult(db, {verdict, sessionId, programName})` -- the typed `heuristic`
     claim node, `review_status: 'proposed'` (a human APPROVE, not this command, promotes it).
   - `navigation.writeGrantRubricGraph(db, rubric)` -- the rubric map as graph
     (`grant_criterion` anchors + `MAPS_TO_SECTION` edges; idempotent, safe to re-run).
   - `navigation.writeGradingSectionEdges(db, {verdict_node_id, verdict, rubric})` -- the
     per-run verdict->Section coverage-profile edges (scalar counts only).
   Also write the human-readable table + roadmap to a room artifact per `produces:` above.

## Decompose an application into a room

The INVERSE direction: the navigator hands over a finished/existing application (pasted text or
a file) and wants it examined AS a room.

**Room-targeting decision (made deliberately, recorded here):** decomposition targets a NEW
dedicated room -- slug `tnufa-app-<slug>` (swap the program id) -- NEVER the navigator's active
venture room. Filing application-sourced prose into a live venture room would pollute real
venture data the navigator may not want merged; a dedicated room is cheap, reversible
(archive it), and mirrors how `/mos:rooms new` + ignite already birth rooms. Merging any of it
into the venture room afterward is a manual, navigator-driven step, deliberately not automated.

Flow:

1. **Approve the birth.** Tell the navigator a new dedicated room `tnufa-app-<slug>` will be
   created and ask for approval (this is `birthRoom`'s own B2-style gate; a decline means no
   folder, and the decline is recorded as data by the birth machinery).
2. **Birth the room through the real keystone.** Call `navigation.birthRoom({slug, roomDir,
   sessionId, ventureText: <one-line application summary>, approvedBy: <navigator>, vname,
   vstage: 'Pre-Opportunity'})` with `roomDir` under `~/MindrianRooms/`. NEVER hand-roll the
   directory: birthRoom owns the full ICM Layer 0 scaffold (ROOM.md identity files per
   directory, STATE.md, sentinel, registry flip, Section nodes in room.db). If it returns
   `{ok:false}`, say so and stop -- never claim a room exists that was not born.
3. **File by the map.** Load the rubric and call `sectionMap(rubric)`. For each mapped section,
   read the application and file its relevant content into `room/<section>/` following the
   room's own entry conventions (one folder per artifact, `section/name/name.md`). Quote the
   application faithfully -- decomposition RELOCATES content, it does not rewrite it.
   Application content matching `process` (room_section null) criteria has no section home:
   summarize it into the grading artifact later, do not invent a section for it.
4. **Grade the result.** Re-enter the Session Flow above in room-mode against the new room.
   The gaps that surface are exactly what the application itself failed to cover -- that
   contrast (what the application asserts vs what a room demands as evidence) is the point.

## When Complete

Summarize the score, the top 2-3 gaps by common-mistake severity, the weakest room section by
roadmap order, and one clear next step ("build the matching-funds proof entry in
room/financial-model/ before resubmitting" beats a generic "revise and resubmit"). If the
application scores well, say so plainly and briefly -- Part 12: withhold compliments beyond
what's earned, the insight should land, not the praise.
