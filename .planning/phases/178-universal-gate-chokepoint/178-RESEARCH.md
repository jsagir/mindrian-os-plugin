# Phase 178 Research: The Born-Wired Render-Coverage Gate

> Source: a 5-agent investigation (code-history + on-disk prior research + Tavily external +
> adversarial verify) run 2026-06-24. Diagnosis CONFIRMED at HIGH confidence, survived every
> refutation attempt. This RESEARCH.md replaces a fresh gsd-phase-researcher spawn because the
> investigation already produced researcher-grade, adversarially-verified depth.

## 1. The problem, verified against the live tree

The F.7 gate-render has slipped across five phases (143.1, 144.1, 148, 150.5, 177). It is ONE
architectural gap appearing in five places, not five bugs: the terminal load-bearing step (the
model firing the AskUserQuestion card) is AGENT-HONORED, not machine-enforced.

- **The seam:** `scripts/intent-classifier.cjs:934-936` reads `rendered.askuserquestion_marker`
  and concatenates it as TEXT into the turn block (`return base + '\n\n' + rendered.text + '\n'
  + marker;`). From :936 the card-firing lives only in the model reading that string.
- **The marker is minted, never fired:** `lib/hmi/selector-dispatcher.cjs:528-548`
  `appendAskUserQuestionTrailer` is the SEED-020 single construction door; :537 sets
  `rendered.askuserquestion_marker = trailer`. `pickShape` (:930-944) attaches it to every
  successful Shape F.* return. Composing a marker string is not firing a card.
- **Grep proof:** `AskUserQuestion` is invoked as a tool call NOWHERE in `lib/` or `scripts/`
  (90 hits, all comments, marker/contract/trailer strings, and a downstream classifier at
  `lib/conversation/classifier.cjs:51,142` that reacts AFTER the agent already fired).
- **The only enforcement is prose:** `skills/larry-personality/SKILL.md:129` ("Larry MUST fire
  the AskUserQuestion card ... no card, no picture"), mirrored in conversation-mode, ui-system,
  room-proactive SKILLs.
- **No born-wired render gate exists.** `scripts/build-orchestration-projection.cjs:113-138`
  EXPLICITLY classifies render-only surfaces (/mos:dashboard, /mos:splash) as "not a
  reach-dispatched thinking surface" and EXCLUDES them, proving the CIRS gate governs the
  INVOCATION/trigger wire and treats render as out of scope.

## 2. Enforcement layers today (strongest to weakest)

1. Code composition (STRONG/machine): selector-dispatcher mints the marker unconditionally. But
   composing != firing.
2. Engine-arm threading (STRONG/machine, SCOPED to ONE caller): intent-classifier.cjs:933-936.
   Does nothing on legacy/mixed/silent paths.
3. Per-path tests (MEDIUM/narrow): tests/test-150-5-render-atomicity.cjs +
   tests/test-acpt-06-dial-atomic-emission.cjs assert the marker SUBSTRING rides the text on the
   engine arm. They cannot assert the agent fired the card, and cover only the one path each.
4. Prompt doctrine / SKILL fences (WEAKEST/agent-honored): SKILL.md:129. This is the ACTUAL
   final enforcement, and it is natural language the LLM must honor.

Tiers 3-4 are exactly the WARN tier CIRS R9 had to flip to hard-FAIL for invocation.

## 3. Slip history (what each phase fixed and did NOT generalize)

- 143.1 dial-presenter RESOLVE/FORMAT split: built renderDial returning a FORMAT-half contract;
  the sole caller originally DISCARDED it. Fixed the dial LOOK; left card-firing as agent work.
- 144.1 connector-retrofit-sweep (RETRO-07): fixed INVOCATION coverage (the 114-surface
  wired-or-excluded count gate). The trigger wire, not render.
- 148 larryreach-selector-re-wire: consolidated construction sites onto one pickShape host;
  added no coverage gate.
- 150.5 sensor-turn-contract-and-atomic-dial-render: fixed the engine-arm SPLIT render via
  appendAskUserQuestionTrailer + added ACPT-06 + the SKILL fence. ONE path; per-path test +
  fence. Its own 13-gate map marks gate 12 (card = model tool-call) UNGATED/DEFECT.
- 177 behavioral-channel: minted a GREENFIELD F.7-dial surface (lib/hmi/dial-selector.cjs
  renderDialShape :216-228) with NO askuserquestion_marker. A new gate surface with zero render
  coverage - the slip in real time.

## 4. Prior research crossref (the smoking guns)

- SEED-021 Finding 1 named the failure mode ("a renderer that draws an interactive-looking
  control as static text, and depends on a separate model tool-call to make it real, will ALWAYS
  have this failure mode") but scoped the cure ("no card, no picture") to the Phase 144 engine
  arm ONLY.
- 150.5-RESEARCH: "the card half is PURE PROMPT DOCTRINE"; gate 12 UNGATED/DEFECT; hole #1
  (agent-honored) and hole #4 (prose-mimicry, code cannot prevent) both conceded and accepted.
- `render_gate_ever_proposed` across ALL prior research/specs/SEEDs = **false**. The CIRS Part 11
  proposal + its 3 reviews never raise a rendering-layer twin. Phase 178 is the first artifact to
  name it.
- DEFERRED/dropped render-enforcement ideas: SEED-021 (engine-arm scope only), 150.5 DIAL-ATOM
  (engine arm only), 150.5 hole #4 (prose-mimicry accepted), Tri-Polar render proof V8
  (Desktop/Cowork card-fire never gated, BIRTH-FLOW-BRIEF.md constraint 9), SEED-020 (directive,
  no coverage gate).

## 5. Reuse targets (Part 7 - the cure is a proven pattern, not new)

- **The CIRS born-wired generator pattern** is the direct template: `scripts/build-connector-
  registry.cjs` + `scripts/build-orchestration-projection.cjs` + `scripts/check-cirs-
  declaration.cjs`. Each walks a registry, classifies each surface WIRED-or-EXCLUDED, and (post
  Phase 172-13) exits NONZERO/hard-FAIL on any surface neither wired nor excluded. Mirror this
  for render: a `scripts/check-render-coverage.cjs` (or build-render-coverage.cjs) sibling.
- **The SEED-020 single construction door**: selector-dispatcher.cjs:528-548/537. Promote from
  "mints a marker" to "the registry-verified chokepoint" that the gate asserts every reachable
  surface routes through.
- **Phase 177 dial-selector.cjs** (the 4-arrow F.7-dial HUD) is the newest render surface and the
  first registry entry to force a declaration.
- **Hard-FAIL wiring precedent (R9, Phase 172-13):** both CIRS generators' --check are wired into
  pre-commit + install-pre-commit + release.sh + doctor --acceptance. The render gate rides the
  same four enforcement surfaces.

## 6. Implementation approach (the three non-negotiables drive the design)

- **C-1 Registry-driven, not hand-written.** A render-surface registry (derived, not hand-listed)
  enumerating every render entry point that can reach a Decision Gate: the F_SUBSHAPES array, the
  F.7-dial branch (selector-dispatcher.cjs:755), and the ~14 pickShape/renderDial callers. The
  walk is AST/grep over the dispatcher branches so a NEW branch cannot escape (R-3). Each entry
  declares: "card-emission" or "render-only excluded" (the two-state CIRS ledger).
- **C-2 Deterministic, code-evaluated binary.** `check-render-coverage.cjs` evaluates a pure code
  predicate over the registry + the dispatcher wiring: "does this reachable surface route through
  the card-emission door?" No LLM-judge in the hard gate.
- **C-3 Hard-FAIL from day one.** Nonzero exit when any reachable gate surface lacks the
  declaration. Wire into pre-commit + install-pre-commit + release.sh + doctor --acceptance. A
  WARN gate rots (R-5).

The one-time tests (test-150-5, ACPT-06) stay as unit smoke checks, explicitly NOT the gate.

## 7. External patterns (Tavily - convergent, validate the cure)

- TypeScript `never`/`assertNever` total function (exhaustiveness): add a variant -> build FAILS
  CLOSED unless its handler is wired. The purest born-wired pattern; how CIRS cured invocation.
- ESLint switch-exhaustiveness: WARNs unless promoted to a never-typed default -> the negative
  proof that the WARN tier is where render still lives.
- OPA policy-as-code: prompt-embedded rules "too fragile"; enforce deterministically "where the
  LLM has no say".
- ArbiterOS: non-bypassable kernel makes VERIFY a post-condition of GENERATE before a high-stakes
  action -> the card as a kernel-enforced post-condition of reaching a gate.
- ARMO five-rung ladder: code "composes the gate" (claim) vs the card firing (reality); the gate
  is the missing independent observation plane; disagreement IS the failure.
- Pact (consumer-driven contract): serialize the implicit contract into an explicit artifact,
  verify in a job that blocks promotion -> a marker string the agent "should honor" is the
  implicit-contract anti-pattern Pact replaces.

## 8. Pitfalls / residual risks (name, do not let scope creep over them)

- R-1 Irreducible agent-honored terminal tool-call: the gate proves "every reachable surface is
  WIRED to emit a card", not "the model called the tool this turn" (GA-4 explores a PostToolUse
  interceptor; if infeasible it is named debt).
- R-2 Prose-mimicry (unreached gate, 150.5 hole #4): out of scope; keep the SKILL line as the
  named residual.
- R-3 Registry-completeness is the new SPOF: the walk must be exhaustive enumeration, not a hand
  list.
- R-4 Tri-Polar Desktop/Cowork card guarantee deferred (V8): gate as scoped is CLI-only unless a
  Desktop/Cowork render proof is added.
- R-5 WARN-tier regression: MUST land hard-FAIL.

## 9. Suggested plan shape (for the planner)

- Plan 178-01: the render-surface registry + the exhaustive AST/grep walk (C-1). Derive, do not
  hand-list. Include the F.7-dial surface and the ~14 callers.
- Plan 178-02: `check-render-coverage.cjs` deterministic predicate (C-2) + the FLOOR/contract
  test that asserts the gate fails closed on an undeclared surface (mirror
  tests/test-coverage-gate-hardfail.cjs).
- Plan 178-03: hard-FAIL wiring into pre-commit + install-pre-commit + release.sh + doctor
  --acceptance (C-3), mirroring the Phase 172-13 flip; promote the SEED-020 door to the verified
  chokepoint.
- (Optional) Plan 178-04: the candidate Part 11 render-twin canon amendment (docs-only,
  navigator-gated) + GA-4 PostToolUse-interceptor spike for R-1.

Frozen contracts UNTOUCHED throughout: MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach
bank, the glyphs; no reach/posture/edge/node minted; no Brain wire (Part 8 clean).
