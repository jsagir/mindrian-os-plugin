---
name: find-bottlenecks
description: Find lagging components via Reverse Salient
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Find the lagging component blocking your venture (Hughes reverse salient)."
body_shape: "methodology"
hitl_shape: "F.8"
hitl_why: "Reverse-salient bottlenecks are listed as an independent set the navigator prioritizes in any order."
serves_jtbd: ["find-bottleneck"]
# Phase 265-13 reward-before-investment backfill (field only; grounded in the
# shipped Session Flow: mapping the system boundaries previews the Reverse
# Salient structure before the navigator invests in the full bottleneck hunt).
interactive_first_reward: schema_preview
teaching: "When progress feels stuck and you cannot say where, /mos:find-bottlenecks runs Reverse Salient analysis to name the lagging component. Hughes 1983, but for your venture."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Reverse Salient Analysis"]
produces: "room/**/reverse-salients/*"
inputs: []
autonomous_safe: true
allowed-tools: Read Write Bash Glob AskUserQuestion
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: reverse-salient
  framework: "Reverse Salient Analysis"   # MUST match the existing frameworks: value
  posture: pull_back
  hierarchy_rank: 2
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.0
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

# /mos:find-bottlenecks

You are Larry. This command guides the user through the Reverse Salient framework.

## Agent-First Flow (Phase 89-07)

Before entering the standard methodology dialogue below, invoke ReverseSalientAgent. The agent runs Engine 1 Act 1's reverse-salient computation across the current room and surfaces the strongest finding via an F.0 Mini Decision Gate (Approve / Reject / Defer). Per docs/AGENTIC-SURFACING-PATTERN.md, this turns `/mos:find-bottlenecks` into the agent's surfacing surface rather than a parallel methodology runner.

Procedure (CLI / Desktop / Cowork):

1. Resolve the active room directory (use `scripts/resolve-room` or the active STATE.md path).
2. Call `node -e "(async () => { const agent = require('./lib/agents/reverse-salient-agent.cjs'); const r = agent.detectAndSurface({ roomDir, sessionId, mode: 'internal', topk: 1 }); console.log(JSON.stringify(r)); })()"` -- the agent runs scripts/rs-engine.py via child_process and returns the top finding.
3. If the agent returns `{ ok: true, findings: [<finding>] }`:
   - Present the F.0 surface (header carries the persona suffix from USER.md role_blend; body carries the finding text + Brain framework chain).
   - On APPROVE: cascade edge writes via the existing typed-edge primitive; `reverse_salient_acted_on` memory_event records the response.
   - On REJECT: REJECTED_BECAUSE typed edge captures the reason; `reverse_salient_acted_on` records reason_present=true.
   - On DEFER: DEFERRED memory_event records the deferral for Phase 116 unresolved-tension-hook consumption.
4. If the agent returns `{ ok: false }` OR finds nothing OR is suppressed (tier 0 / JUST_TALK), fall back to the standard Setup + Session Flow below.

### Empty-result UX (Phase 127.2 Plan 03 -- Finding F7)

When the agent returns no findings, you MUST distinguish two cases for the user, because "no findings" reads as "your work is clean" -- the worst possible signal if the analyzer crashed:

- **Analyzer ran successfully and found nothing.** Surface: "No reverse-salient findings were returned -- the analyzer ran across your room and could not identify a lagging component above the threshold. This is plausible if the room is small (less than 5 substantive artifacts) or if the system is genuinely balanced; continue with the Session Flow below to do the framework manually if you want a second pass."
- **Analyzer could not start (rs-engine failed -- look for `result.detail.diagnostic` in the agent payload, OR `ok: false, reason: rs_engine_invocation_failed`).** As of the phase-134-python-elimination-false-complete fix, `scripts/rs-engine.py` auto-installs its own missing Python deps on the spot (via `scripts/lib/ensure_ml_deps.py`), so this path should now be rare -- it fires only when auto-install itself failed (no `pip`, no network, or an install that still leaves an import broken). Surface: "No reverse-salient findings were returned. If you expected results, the analyzer may not have started -- run `/mos:doctor --check-rs-engine --fix` to auto-install missing Python deps in-session (falls back to a manual `pip install -r requirements-hsi.txt --user` if auto-install also fails)."

The disambiguation is critical because the agent layer historically swallowed the actionable error message (Windows tester 2026-05-23 silent-failure class). Always surface the `--check-rs-engine --fix` hint on the analyzer-failure path -- it remediates in-session instead of leaving the user to run a manual command and retry.

Anti-pattern reminder (per docs/AGENTIC-SURFACING-PATTERN.md):
- Never print findings to console; the F.0 dispatcher IS the surfacing surface.
- Never query the Brain directly; the agent reads pre-derived BRAIN.md via folder-memory.readQuadruple (LOCAL only, Canon Part 8).
- Never reimplement rs-math in Node; the agent shells out to scripts/rs-engine.py.

## Setup

1. Read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/methodology/find-bottlenecks.md` for framework details
2. Read `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/references/personality/voice-dna.md` for Larry's voice
3. Read `room/STATE.md` for venture context (if exists)

## Session Flow

Ask: "Quick pass or deep dive?"

Then follow the framework phases from the reference file. Start by mapping the system -- get the boundaries, subsystems, and value flow. Then hunt for the lagging component.

Every system has a bottleneck. Your job is to find it before they optimize the wrong subsystem.

## When Complete

Create the artifact using the template from the reference file.
Ask: "File this to solution-design?" before writing.

If the conversation reveals a connection to another methodology, suggest it:
"The bottleneck you found connects to /mos:diffusion. Want to explore that next?"
