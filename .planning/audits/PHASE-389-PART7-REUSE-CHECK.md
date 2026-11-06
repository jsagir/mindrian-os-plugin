Source: relayed from the owner's parallel session, hypotheses, verify in code; scratch export sha c30bf6ff4

# Phase 389 Part 7 reuse check - can a Pyramid "seed" mode live inside structure-argument?

Author: jsagi-cc (Larry). Date: 2026-11-06. STATUS: HYPOTHESES until jsagi-33 verifies in code.
Source: `git archive HEAD` of /home/jsagi/dev/MindrianOS-Plugin-release, sha `c30bf6ff4604b41b8bc3aaf1d45d741f7cfa745c`, scratch export. Read and grep only, niced to cores 4-7. No room data.

## Answer in one line

Yes in principle: structure-argument already owns SCQA, MECE and a "Quick pass or deep dive?" fork, and has no agents, so a seed depth is a third branch of that fork, not a new command. Three real blockers decide the shape: (1) it is declared `autonomous_safe: true` and produces `room/**/argument/*`, a seed that calls the web and has no room contradicts both; (2) the six "cells" are not an agent today, they live in the mva orchestrator; (3) the MVA pre-room hook and state file feed other things (session-start, first-install router).

## What structure-argument already does (files: commands/structure-argument.md 83 lines, skills/structure-argument/SKILL.md 79 lines, references/methodology/structure-argument.md 158 lines; no agent)

| Item | Where | Reusable for seed? |
|---|---|---|
| SCQA (Situation, Complication, Question, Answer) with the rule "if you cannot state the Complication in one sentence you have not understood the problem" | reference Phase 1 | YES, this is the seed's output frame |
| MECE issue tree, challenge for overlap and gaps | reference Phase 2 | partly: seed needs one level only |
| 80/20 vital few, root causes, workplan | reference Phases 3 to 5 | NO for seed (full depth only) |
| "Quick pass or deep dive?" fork, with Quick = SCQA + one-level tree + top 3 priorities (10 to 15 min) | command Session Flow; reference "Quick Pass vs Deep Dive" | YES: a "Seed (45 s, no room)" option fits as a third value |
| Artifact template (SCQA block, MECE tree, root causes, workplan, homework, cross-refs) | reference "Artifact Template" | YES, seed fills the SCQA block only |
| Filing gate: asks "File this to problem-definition?" before write | command "When Complete" | needs a no-room branch (nothing to file into) |
| Connector: `sub_mode: pyramid-argument`, `reach_id: context_block`, `hitl_shape: F.9`, `autonomous_safe: true`, `produces: room/**/argument/*`, `sensor_triggers: [SENS-06]`, `rank 31` | command + skill frontmatter | see blockers |
| Setup reads `room/STATE.md` "if exists" | command Setup 3 | YES: the command already tolerates no room |

What it does NOT do: no outside evidence (no Brain similar cases, no classic traps, no Tavily funding, no analogies), no red/black hat, no parallel work, no deck, no session receipt, no state file, no budget clock. These are the new parts.

## What would be NEW in a seed mode

1. Capture of one sentence with no room (the command's Setup assumes a venture context; seed must not require one).
2. A Frame step: silent problem type, draft Situation/Complication/Question.
3. A Test step with parallel cells: similar cases (Situation), classic traps + black hat (Complication), funding + analogies (key-line support), red hat (Challenge). These are today `lib/core/mva-dispatcher.cjs` + `lib/agents/mva/index.cjs` + `mva-agent-contract.cjs` + `mva-budget.cjs` (45 s budget). Note: Phase 118 six agents vs shipped cells differ (as the PRD says).
4. Outside-evidence rules: only generic handles to Brain and Tavily (Part 8; the Phase 386 sprout route).
5. A Decide gate: build a room (/mos:new-project), keep going, or challenge. Today this is `mva-option-router.cjs` (see correction below).
6. Optional share step (Vercel deploy via `mva-vercel-deploy.cjs`, deck via `mva-deck-builder.cjs`).

## Blockers to settle at plan time

- B1. `autonomous_safe: true` is declared on structure-argument. Chain runners (`chain_run`, `lib/core/chain-executor.cjs`) run an autonomous_safe prefix without a gate. A seed that fetches outside evidence is not safe to run unattended (Part 8, third-party calls). Fix options: seed is a separate sub_mode with its own posture, or the card before any external fetch (PRD move C) stays inside the command and the chain halts there. Needs the owner's rule on what "autonomous_safe" allows for web reads. UNVERIFIED how the resolver treats a sub-mode.
- B2. `produces: room/**/argument/*` and the "File this to problem-definition?" gate assume a room. With no room, the output is a conversation artifact only (session receipt) until the Decide step builds a room. Needs a no-room branch in the command.
- B3. Registries are born-wired (Part 11). Adding a seed value to structure-argument changes no command count, but any new `sub_mode` (for example `pyramid-seed`) is a connector change in `data/connector-registry.json` and the render-coverage registries and needs the generators to run. Staying inside `pyramid-argument` avoids that; state this choice in the plan.
- B4. The hook `scripts/mva-detect.cjs` (UserPromptSubmit, timeout 3, hooks/hooks.json line ~354) writes the state file `~/.mindrian/mva/<session-id>.json`. `skills/mva-pipeline` auto-activates from that state file. If the hook goes, mva-pipeline loses its trigger (consistent with the PRD). But `scripts/first-install-router.cjs` is "cloned in SHAPE" from mva-detect and its header cites mva-dispatcher's budget decision (comment-level only, UNVERIFIED for runtime coupling).

## Correction to the PRD problem statement

The PRD says "Option 2 is still a stub (Phase 119 never wired it)". Code says otherwise: `lib/core/mva-option-router.cjs` lines 12 to 20 and `resolveOption2()` return `ignite_from_brief` (Phase 155-04) and `tests/test-mva-from-brief.cjs` asserts it (reads `~/.mindrian/mva/briefs/<sha8>.json`, invokes `/mos:ignite --from-brief <sha8>`). `STUB_MESSAGE_119` is now `null`. But `commands/mva-option.md` line 87 still documents `phase_119_stub`. So the doc is stale, the code is wired: the router is a live path to /mos:ignite, not a stub. Correct the PRD wording before planning; the Decide step can reuse `ignite_from_brief` or point to /mos:new-project (owner choice).

## mva-* modules: what becomes dead after the change (caller proof each)

Modules in lib/core (12 plus tests): agent-contract, budget, classifier, deck-builder, dispatcher, option-router, orchestrator, progressive-renderer, rule-linter, state, telemetry, vercel-deploy. Scripts: `scripts/mva-detect.cjs` (hook), `scripts/mva-run.cjs`. Also `lib/agents/mva/index.cjs`, `lib/agents/mva/test-all-six-agents.cjs`.

Real `require` sites outside the family (grep, non-test):

| Module | Non-MVA importers | Dead after the change? |
|---|---|---|
| mva-classifier | `lib/workflow/selector-decisions.cjs:55` (`classify`); `lib/core/claude-routing.cjs` line 52 names it in a comment only; `scripts/mva-detect.cjs` | NOT dead: selector-decisions requires it. Keep, or move `classify` and rename. |
| mva-rule-linter | `scripts/check-reward-before-investment.cjs:71`; pre-commit hook `scripts/hooks/pre-commit` line 314; `scripts/verify-release`; many reward-rule tests | NOT dead and NOT MVA-specific (a reward-before-investment lint). Rename only; its guard is a release gate. |
| mva-telemetry | `lib/core/telemetry/schema.cjs` mirrors its ALLOWED_FIELDS ("6 inherited mva.* events ... becomes a thin shim"); orchestrator, option-router | mostly NOT dead: schema.cjs depends on the mva.* event names. Event rename = telemetry change. |
| mva-state | only `mva-orchestrator.cjs:38` requires it; other files cite its `_atomicWrite` in comments (recovery/case-file, embedding-spine, research-cache, eureka-deps-resolver) | dead if orchestrator goes. Comments would need updating. |
| mva-orchestrator | `scripts/mva-run.cjs:25`; `scripts/session-start:733` (comment names it); `scripts/room-naming-selector.cjs` header comment; tests test-mva-dror-harness, test-267-2-pre-room-reward; `data/first-reward-surfaces.json` | depends on the new design: if the seed reuses the cells it stays (rename); if replaced, the pre-room reward test and first-reward-surfaces.json need a decision. |
| mva-dispatcher, mva-budget, mva-agent-contract, lib/agents/mva/* | only orchestrator, option-router tests, `scripts/first-install-router.cjs` (comment), llm-name-suggester (comments) | reusable core of the seed's parallel Test step. Keep and rename, not dead. |
| mva-progressive-renderer | only orchestrator | dead if the Argue step renders differently; otherwise reuse. |
| mva-deck-builder | orchestrator, mva-vercel-deploy, test-mva-dror-harness; `wiki` hit in lib/core is unrelated | dead only if the share step is dropped (owner card 2). |
| mva-vercel-deploy | orchestrator; `lib/core/resolve-vercel-key.cjs` | dead only if share is dropped; resolve-vercel-key may serve other callers (not checked). |
| mva-option-router | `lib/conversation/operator.cjs` (comment), commands/mva-option.md, skills/mva-option, commands/new-project.md, skills/ignite, tests (test-mva-from-brief) | dead if the Decide gate moves into structure-argument; ignite and new-project docs name it so check them. |
| mva-detect.cjs (hook) | hooks/hooks.json only | dead if the owner picks "command only" (PRD card 1). Also remove the hook row and re-run the hook-census tests. |
| mva-run.cjs | commands/mva-brief.md, orchestrator tests | follows the orchestrator decision. |

So after a seed-in-structure-argument design, the clearly dead set is small: the detection hook, mva-option-router (if Decide moves), mva-progressive-renderer, and mva-state (if orchestrator goes). The classifier, rule-linter, telemetry names, and the dispatcher/budget/contract trio are LIVE or reusable and must not be deleted in step 1.

## Recommendation for the plan (design input)

1. Add Seed as a depth in the existing "Quick pass or deep dive?" fork; keep `sub_mode: pyramid-argument`. No new command, no new connector row.
2. Put the parallel Test step in a helper that reuses mva-dispatcher + mva-agent-contract + mva-budget (renamed `pyramid-seed-*`), called by the command only when depth = Seed.
3. Settle B1 (autonomous_safe) before coding: a separate posture for the seed branch, or a card before external fetch.
4. Retire in this order, each with the owner card: hook mva-detect, mva-pipeline skill, mva-option command + router, then the rest. Keep mva-rule-linter (rename), mva-classifier (move), telemetry event names (rename with the schema).
5. Correct the "Option 2 is a stub" sentence in the PRD and the stale doc line in commands/mva-option.md.
