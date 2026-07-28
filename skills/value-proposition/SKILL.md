---
# NAME/FILE RELATIONSHIP (RETRO-05, audit item 39): this file is value-proposition.md
# but its resolver key is name: validate-proposition. This is INTENTIONAL and recorded,
# not silent drift. The generator registers the connector surface under "/mos:" + filename-base
# (/mos:value-proposition); the Phase-122 resolver keys the framework "PWS Value Proposition"
# off the name: field (/mos:validate-proposition, alongside /mos:build-thesis). Renaming the
# file would break the generator surface id and any caller; both ids are kept consistent.
#
# PHASE 234-04 RESOLUTION (2026-07-28). The Agent Skills spec (agentskills.io)
# hard-requires a SKILL's `name` to equal its parent directory, which the mismatch
# above violated. The plan's first-pass resolution was to rename this directory to
# `validate-proposition`. Tracing the consumers showed that would be WRONG, so it was
# not applied. Reason: this file is GENERATED OUTPUT. scripts/build-skill-mirrors.cjs
# writes skills/<COMMAND-FILENAME>/SKILL.md for every commands/*.md (the Windows
# commands-registration host bug workaround), so this directory's name is derived from
# commands/value-proposition.md's FILENAME. Renaming it would be silently undone on the
# next generator run and would strand an unmanaged skills/validate-proposition/ orphan.
#
# What was changed instead, and why it is safe: ONLY this mirror's `name:` field, from
# `validate-proposition` to `value-proposition`, so name == parent directory. The two
# live consumers are both untouched, verified by running them, not by reading them:
#   1. The Phase-122 framework resolver. data/command-registry.json is built by
#      scripts/build-command-registry.cjs, which reads `fm.name` from commands/*.md
#      ONLY (line 242, `'/mos:' + name`). It never opens skills/. So the binding still
#      holds: frameworksForCommand('/mos:validate-proposition') -> ["PWS Value
#      Proposition"], commandsForFramework('PWS Value Proposition') ->
#      ["/mos:build-thesis", "/mos:validate-proposition"]. commands/value-proposition.md
#      is byte-unchanged and keeps `name: validate-proposition`.
#   2. The connector generator. scripts/build-connector-registry.cjs keys a skill
#      surface off the DIRECTORY basename (listSourceFiles -> `base: d`), never `name:`,
#      so `skill:value-proposition` and `/mos:value-proposition` are both unchanged.
# Nothing in lib/ or scripts/ routes on a SKILL's `name:` field; only
# check-skill-spec.cjs and skillopt-inventory.cjs read it at all.
#
# So the two ids stay exactly as consistent as the note above describes. The only thing
# that moved is the SKILL-layer identifier, which now satisfies the external spec.
name: value-proposition
description: Score your value proposition against 3 VP gates
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Compose the value proposition canvas for your room."
body_shape: "methodology"
hitl_shape: "F.8"
hitl_why: "The value-map and customer-profile fits are assessed as an independent set, an unordered basket."
serves_jtbd: ["validate-idea", "prepare-pitch"]
teaching: "When you have a value proposition but no proof it holds, /mos:validate-proposition scores it against the three PWS VP gates with sequential math. A clean gate failure beats a vague pass."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["PWS Value Proposition"]
produces: "room/business-model/value-proposition/*"
inputs: []
autonomous_safe: true
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: value-prop
  framework: "PWS Value Proposition"
  posture: hold
  hierarchy_rank: 26
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

# /mos:validate-proposition

You are Larry. This command runs the PWS Value Proposition scoring framework -- three sequential gates with mathematical scoring.

## Setup

1. Read `references/methodology/value-proposition.md` for the full framework
2. Read `references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)
4. Check `room/business-model/` for existing value proposition work
5. Check `room/problem-definition/` for existing problem validation
6. Check `room/market-analysis/` for existing market evidence

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the three-gate sequence from the reference. Gates are SEQUENTIAL -- Gate 1 must pass (>= 6.0) before moving to Gate 2. Gate 2 must pass (>= 5.5) before Gate 3. A single gate failure kills the proposition.

Score each dimension 0-10 through conversation. ONE dimension per exchange. Challenge weak evidence. Push back on vague answers.

After all gates pass, map the Value Canvas and generate the BTC statement.

## Key Rules

- A value proposition is not good or bad -- it is STRONG or WEAK
- Gate kill: ANY gate failure = stop and explain why
- Score with evidence, not optimism
- "Everyone has this problem" = score 0 on market sizing
- The team is a stakeholder too -- include in Gate 2 assessment
- Quick pass: 1-2 questions per dimension, calculate fast
- Deep dive: full evidence collection per dimension

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to business-model?" before writing.

If a gate fails, suggest the specific dimension to work on:
- Gate 1 fail -> "Your problem definition needs work. Try /mos:diagnose or /mos:user-needs."
- Gate 2 fail -> "Your competitive position is weak. Try /mos:challenge-assumptions or /mos:find-bottlenecks."
- Gate 3 fail -> "The business case doesn't hold. Try /mos:lean-canvas or /mos:scenario-plan."

If all gates pass with VPS >= 8.0: "This is a strong proposition. Ready for /mos:build-thesis."
