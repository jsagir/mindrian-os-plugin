---
name: mva-option
description: Route the user's 3-option footer selection after a 30-second MVA brief
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Compose option packages for your MVA."
body_shape: E
hitl_shape: "F.8"
hitl_why: "Candidate options are surfaced as an independent set to weigh in any order before a pick."
argument-hint: <1|2|3> [<sha8>]
serves_jtbd: ["explore"]
teaching: "When the 3-option footer shows after an MVA brief, /mos:mva-option routes your pick (refine / build a room / iterate) into the right next move. The hand-off after the first reward."
allowed-tools: Bash, AskUserQuestion
interactive_first_reward: --none (scripting only)
# --- Phase 144.1 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: mva-option
  framework: null
  posture: push_forward
  hierarchy_rank: 11
  filing: none
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

# /mos:mva-option <N> [<sha8>]

Route the user's selection from the 3-option footer that appears after a 30-second MVA brief.

## Why this exists

The 3-option footer renders after every MVA brief (per binding decision B4):

```
What now?
  [1] Just tell me what's new         (stay in "tell me" mode)
  [2] Build a room around this        (invest)
  [3] Challenge me -- Devil's Advocate (go deeper cognitively)
```

The user types `1`, `2`, or `3` (or `/mos:mva-option N` directly). This command dispatches the routing.

## Arguments

- `<N>` (required): `1`, `2`, or `3` -- the user's selection
- `[<sha8>]` (optional): the 8-char prefix identifying the target brief. When OMITTED, the command auto-discovers the most recent brief by calling `resolveCurrentSha8()` which reads `~/.mindrian/mva/state.json` (the manifest atomically written by Plan 118-03's orchestrator after `mva_brief_rendered` fires).

## How to invoke

The model invokes this command via Bash + Node. Two patterns:

**With explicit sha8:**

```bash
node -e "const r=require('./lib/core/mva-option-router.cjs'); r.routeOption(N, '<sha8>').then(out => console.log(JSON.stringify(out, null, 2)))"
```

**Without sha8 (auto-resolve via state.json):**

```bash
node -e "const r=require('./lib/core/mva-option-router.cjs'); const sha=r.resolveCurrentSha8(); if(!sha){console.log(JSON.stringify({ok:false,error:'no_current_brief',message:'No recent brief found. Type your venture sentence to fire the pipeline.'}));process.exit(0);} r.routeOption(N, sha).then(out => console.log(JSON.stringify(out, null, 2)))"
```

The auto-resolve form is what the `mva-pipeline` skill instructs the model to run when the user types `1`, `2`, or `3` as a plain message immediately after a brief renders. See the "## Routing the 3-option footer" section in `skills/mva-pipeline/SKILL.md` for the full recognition rule.

## What happens per option

- **Option 1** -- operator transitions to `JUST_TALK`; the brief stays in scrollback; the user can ask any follow-up about the 6 cells. The router returns `{ action: 'stay_in_just_talk', next_state: 'JUST_TALK', message: ... }`.

- **Option 2** -- operator unchanged; the router returns `{ action: 'phase_119_stub', next_state: null, message: STUB_MESSAGE_119 }`. The stub message reads:

  > Building a room around this is the next layer; shipping in beta.18 (Phase 119). For now, press option 1 to keep this brief visible, or option 3 to go deeper.

  Per binding decision B6 OPTION A, option 2 is deferred to Phase 119 / v1.13.0-beta.18. The router does NOT invoke `/mos:new-project` in v1.13.0.

- **Option 3** -- operator transitions to `METHODOLOGY`; the router returns `{ action: 'invoke_challenge_assumptions', next_state: 'METHODOLOGY', invoke_command: '/mos:challenge-assumptions --from-brief <sha8>' }`. The model then runs the named slash command against the brief.

## Edge cases

| Situation | Router return | Model surfaces |
| --------- | ------------- | -------------- |
| No `state.json` (fresh install / Hebrew refusal) | wrapper short-circuits | "No recent brief found. Type your venture sentence to fire the pipeline." |
| Side-file `<sha8>.json` missing (brief expired) | `{ ok:false, error:'brief_not_found' }` | "The brief data has expired or was not deployed. Type your sentence again to re-fire the pipeline." |
| `mva_brief_rendered` event not yet logged (pipeline still streaming) | `{ ok:false, error:'brief_still_rendering' }` | "Brief is still rendering -- options will activate when it completes." |
| Invalid `N` (0, 4, 99, "1", null) | `{ ok:false, error:'invalid_option' }` | Treat as free-text; route through normal Larry conversation. |

## Telemetry

Each successful invocation emits `mva_option_selected` to `~/.mindrian/telemetry/v1.13/mva.jsonl` with the frozen `ALLOWED_FIELDS` schema:

```
{ sentence_sha256, option_id, time_to_click_ms }
```

`time_to_click_ms` is computed from the most recent `mva_brief_rendered` event timestamp for the brief's `sentence_sha256`. Plan 118-06's Dror 2.0 harness reads these events to validate "subject types one sentence and clicks an option within 60 seconds of brief rendering."

Per Canon Part 8: the telemetry payload carries ONLY the sha256 hash + option_id + time delta. Zero user content. Zero URLs.

## Canon parts implemented

- Part 3 (Tri-Context Decision Gate) -- the 3-option footer IS a Decision Gate offering a closed-vocabulary choice (verbs 7 Synthesize / 8 Bank Opportunity / 5 Devil's Advocate)
- Part 4 (Every Choice Is Graph Data) -- `mva_option_selected` telemetry captures every click; operator transitions write `OPERATOR_TRANSITION` edges to the local room graph (Phase 99 substrate)
- Part 8 (Graph Boundary) -- zero user content in telemetry; zero raw_sentence reads from the side-file; the router source passes the forbidden-token sweep
- Part 10 sub-claim 3 (room as receipt) -- the 3-option footer is the user's self-selected commitment level immediately after the reward (the brief itself)
