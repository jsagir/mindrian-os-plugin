# Phase 209: Shape-F Native Fire - Research

**Canonical source:** .planning/research/2026-07-02-gate-native-fire-fix.md (SYNTHESIS, phase-ready; 5-lens fan-out, 25 critic verdicts adversarially verified 2026-07-02). This file is a verbatim copy staged into the phase slot for planner/checker consumption. If the two ever diverge, the .planning/research/ copy wins.

---

# Gate Native Fire - Fix Plan (Shape-F Native Fire phase)

Date: 2026-07-02
Status: SYNTHESIS (phase-ready)
Input: 5-lens fan-out + 25 critic verdicts (24 CONFIRMED, 1 PLAUSIBLE, 0 REFUTED)
Incident shape: Larry produced prose + an ASCII frame at the room-chooser Decision Gate instead of firing AskUserQuestion; the Stop-hook backstop paid the cost as a blocked turn + forced re-emit.

---

## 1. WHY - the confirmed root-cause chain, ranked

The failure is a chain, not a single bug: the instruction never reached the model (RC-1), the trigger that DID reach it carried no imperative and arrived next to an anti-pattern exemplar (RC-2), the engine threw away the machine-readable card spec at the emission seam (RC-3), the command plane declared shapes it never wired (RC-4), and the only enforcement is a post-hoc Stop hook that is both narrow and over-triggering (RC-5). A voice-level prose pull (RC-6) is a plausible amplifier.

### RC-1 (rank 1): The fire mandate is absent from everything Larry actually loads
Verdicts 1, 3, 21 (all CONFIRMED).
- The hosting agent has ZERO operative card instruction: agents/larry-extended.md is 173 lines with 0 AskUserQuestion mentions; `hitl_shape: "F.1"` at agents/larry-extended.md:30 is inert frontmatter whose only consumer is the build-gate validator scripts/check-shape-declaration.cjs:144-166.
- The emphatic doctrine exists but only in files Larry does not load: commands/ignite.md:73 and :98-106 ("FIRE THE CARD -- mandatory, this is the whole gate", "no card, no picture (SEED-021)") load only on /mos:ignite; skills/conversation-mode/SKILL.md:28-36 has the lane-picker card mandate but declares `activation: no_room` (line 7) and is absent from larry-extended's skill list (agents/larry-extended.md:6-10).
- Card-fire imperatives travel on exactly two transports (command body, engine trailer), and a conversationally-reached room-pick carries neither: appendAskUserQuestionTrailer has exactly two live call sites (lib/hmi/selector-dispatcher.cjs:1024 inside pickShape; scripts/intent-classifier.cjs:1007 on the engine arm), and renderRoomChooserCard is referenced only by commands/ignite.md, lib/core/room-chooser.cjs, lib/core/ignite-branch-gate.cjs, and tests (verdict 23).

### RC-2 (rank 2): The trigger that IS in context is non-imperative telemetry delivered next to an anti-pattern exemplar
Verdicts 2, 5, 24 (all CONFIRMED).
- The trailer is a "structural-marker ... scalar string for introspection" with zero imperative language: `[AskUserQuestion contract: shape=F.X verbs=N]` (lib/hmi/selector-dispatcher.cjs:523-556, format comment + appendAskUserQuestionTrailer body).
- The ONLY sentence in Larry's loaded context that decodes it is skills/larry-personality/SKILL.md:184 - item 5 of a sub-list under "Operating the Dial", line 184 of 448, self-scoped to "the engine arm's rendered block" / F.7 dial glyphs. A room-chooser F.1 gate plausibly reads as out of scope.
- The hook hands Larry the anti-pattern: scripts/intent-classifier.cjs:1010 injects `base + rendered.text + marker` - a fully pre-rendered ASCII selector block plus a bare bracket trailer. skills/ui-system/SKILL.md (the Shape-F owner, auto-loaded) teaches how to DRAW a selector ("Every output has exactly 4 zones", line 19; "box chars on CLI", line 22) and contains zero hits for "trailer", "SEED-021", or any fire mandate.
- Worse, scripts/session-start:675-677 injects a literal MODE_MENU ending "Type 1, 2, or 3 -- or just start talking" - the exact anti-pattern ignite.md:102 forbids - as the session's opening exemplar (verdict 24).

### RC-3 (rank 3): The engine drops the structured card contract at the emission seam
Verdicts 7, 8, 9, 10 (all CONFIRMED).
- renderDial returns `{ ..., text, contract }` (lib/hmi/dial-presenter.cjs:58) but renderEngineDecisionWithDial concatenates only `rendered.text + marker` (scripts/intent-classifier.cjs:1008-1011); the verbs array / recommended flag / mode never reach the turn.
- renderDial is called with empty opts (scripts/intent-classifier.cjs:993 `renderDial(reachList, {})`), so slotContext defaults to {} (dial-presenter.cjs:353-356) and every row degrades to the elevation fallback (dial-label-composer.cjs:208-213) even though getRoomContext already carries the needed nodes (lib/core/navigation/room-context.cjs:280-300).
- The trailer is an unconditional dial-render artifact, not a gate signal: it rides EVERY engine arm including tier_0 (DIAL-ATOM-01 comment, intent-classifier.cjs:995-1007), while the real gate-likelihood signals (lib/core/sensors/sensor-gate-approach.cjs:78; frozen 0.70/0.15 gate at lib/hmi/dial-reach-orchestrator.cjs:34-38,116) never parameterize it.
- Ready-to-fire payloads exist but are unwired: f1_closer_payload goes only to the decision trace and "NOTHING reads it back" (intent-classifier.cjs:1753-1760); the imperative "INSTRUCTION FOR LARRY: ... dispatch ... via AskUserQuestion" pattern ships only in scripts/room-naming-selector.cjs:156-160.
- The F.8 binding gate strips BOTH bridge signals: emitBindingGate calls renderShapeF8 directly (bypassing the pickShape trailer at selector-dispatcher.cjs:1024), excludes zones.footer, and never names AskUserQuestion (scripts/intent-classifier.cjs:1925-1990; verdict 22).

### RC-4 (rank 4): The command-body plane declared shapes it never wired
Verdicts 16-20 (all CONFIRMED).
- Phase 190 backfill was frontmatter-only by explicit non-destructive contract (scripts/backfill-hitl-shape.cjs:21-27); 107/107 commands declare a shape, ~21 bodies mention AskUserQuestion (~86 of 105 backfilled are unwired).
- The render-coverage gate keyspace is .cjs only: data/render-coverage-registry.json has exactly 16 entries, all .cjs; scripts/build-render-coverage.cjs:19-23,111 filters `.cjs`; check-render-coverage.cjs keys off pickShape / appendAskUserQuestionTrailer call sites (lines 29, 189). An unwired .md body can NEVER fail closed.
- No include mechanism: commands/rooms.md hand-rolls the same firing paragraph three times (lines 26-27, 119-126, 466-468).
- No declared-vs-body cross-check: commands/futures.md declares `hitl_shape: "F.2"` (line 6) while its body specifies F.1 twice (lines 69, 77).
- Missing tool grants: commands/think-hats.md:21, scenario-plan.md:16, persona.md:41, deep-grade.md:16 declare shapes but omit AskUserQuestion from allowed-tools.

### RC-5 (rank 5): The backstop is post-hoc by architecture, narrow, and over/under-triggering
Verdicts 6, 11, 12, 13, 14, 15, 25 (all CONFIRMED).
- Enforcement is a Stop-event block + full re-emission (scripts/check-card-fire.cjs:440, :477-482); the file header (lines 9-16) admits the prose fence (commit e22b9ea4) shipped and was ignored.
- PRIMARY (registry-keyed) detection is documented INERT: zero producers of ran_entries / reached_gate_entries outside the file and its tests (check-card-fire.cjs:48-58, grep-confirmed).
- The live detector is a 3-alternative literal regex (check-card-fire.cjs:203): prose gates and "1." lists slip through (false negatives, incl. the incident's free-conversation shape - verdict 25); bare U+25A0 matches, yet ■ is sanctioned plugin vocabulary (selector-dispatcher.cjs:256, ui-system SKILL.md:131, dial-presenter.cjs:134) - false-positive full blocks.
- WR-06 evaluates card-fire on the LAST assistant message only (check-card-fire.cjs:681-716) - a fired-earlier turn with a later ■ classifies as no-card.
- Worst case: MAX_FORCE_RETRIES=3 (line 159) with a model-flappable per-gate key (CR-04 comment lines 161-174) bounded only by MAX_SESSION_INTERCEPTS=12 (line 180), degrading navigator-silent ({ continue:true, suppressOutput:true }, lines 464-469).

### RC-6 (rank 6, PLAUSIBLE): Voice rules pull toward prose at the gate moment
Verdict 4 (PLAUSIBLE - directives verbatim real, "prose wins by weight" is model-behavior inference).
- agents/larry-extended.md:38 ("3-8 sentences default"), :82 ("1 acknowledgment + 1 reframe + 1 question"), :110 ("End with a question or next step"). "End with a question" at a fork is satisfiable by a prose question; treat as amplifier, fix cheaply alongside RC-1.

---

## 2. HOW - fixes by plane

All reuse targets honor Canon Part 7 (Reuse Before Build): every fix extends a shipped module or copies a shipped pattern; no new renderers, no new dispatcher branches.

### Prompt plane

| ID | What changes | Reuse target (Part 7) | Size | Kills |
|----|-------------|----------------------|------|-------|
| P1 | Add a high-salience "Decision Gates" section to the agents/larry-extended.md BODY (adjacent to Voice / Always Do): any Decision Gate fires the AskUserQuestion tool in the same turn; the `[AskUserQuestion contract: ...]` trailer is BINDING wherever it appears; ASCII frame alone is forbidden (SEED-021). Qualify line 110: "at a Decision Gate, the question IS the AskUserQuestion card, never a prose question." | Mirror the shipped wording at commands/ignite.md:98-106 verbatim | S | RC-1, RC-6 |
| P2 | Promote skills/larry-personality/SKILL.md:184 out of the "Operating the Dial" sub-list into a top-level "Decision Gate contract" section scoped to ALL Shape-F surfaces and ALL trailer carriers, not just the F.7 engine-arm block. | Existing sentence at SKILL.md:184 - rescope, do not rewrite | S | RC-2 (scope half) |
| P3 | Add the fire mandate + SEED-021 to skills/ui-system/SKILL.md's Shape F section (~line 70-92) and document the trailer there. ui-system is auto-loaded on every session, so this is the one global always-in-context home. | ignite.md:98-106 doctrine text; SEED-021 canon | S | RC-1, RC-2 |
| P4 | Add a mid-dialogue room-pick clause to an always-on skill (room-passive or larry-personality): "resuming/switching rooms in conversation = renderRoomChooserCard + fire; never a prose room list." Closes the fork ambient skills currently miss. | lib/core/room-chooser.cjs:198-216 renderRoomChooserCard (shipped) | S | verdict 23, RC-1 |

### Engine plane

| ID | What changes | Reuse target (Part 7) | Size | Kills |
|----|-------------|----------------------|------|-------|
| E1 | Make the trailer self-decoding: extend appendAskUserQuestionTrailer (lib/hmi/selector-dispatcher.cjs:535-556) to emit a second BINDING line, e.g. `[BINDING: call the AskUserQuestion tool in this response with the N options above; do not reproduce this block as text (SEED-021)]`. Instruction travels with the trigger on ALL trailer carriers (both call sites) at once. | scripts/room-naming-selector.cjs:156-160 "INSTRUCTION FOR LARRY" pattern (shipped, proven) | S | RC-2, verdicts 2/5/21 |
| E2 | Serialize rendered.contract into the engine block: at scripts/intent-classifier.cjs:1008-1011 append a compact JSON contract (verbs array, recommended, mode) after rendered.text, so Larry receives a machine-readable card spec, not prose + a count. | lib/hmi/shape-f1-renderer.cjs:193-204 contract already built; emission seam only | S | verdict 8 |
| E3 | Thread slotContext: pass ctx.roomContext relevantNodes/cortexNodes into `renderDial(reachList, opts)` at scripts/intent-classifier.cjs:993 so composeLabel resolves {topic}/{room_name}/{framework} instead of the elevation fallback. | lib/core/navigation/room-context.cjs:280-300 (data exists one call above); dial-label-composer.cjs slot machinery | M | verdict 9 |
| E4 | Fix the F.8 binding gate: route emitBindingGate through pickShape (or call appendAskUserQuestionTrailer + include zones.footer) and name AskUserQuestion in its guidance text (scripts/intent-classifier.cjs:1925-1990). | selector-dispatcher.cjs:1024 pickShape trailer door (SEED-020 single construction door) | S | verdict 22 |
| E5 | Conversational-gate bridge: detect the mid-dialogue room resume/switch fork pre-emission (intent-classifier arm or a room-pick sensor in the SENS spine) and inject the renderRoomChooserCard envelope + E1 imperative trailer, exactly as ignite Gate B0 does by script. This puts a transport on the fork that today carries neither script nor trailer. | lib/core/room-chooser.cjs renderRoomChooserCard; lib/core/insight-sensors.cjs dispatchSensors chokepoint (:572-654); sensor-gate-approach.cjs:78 as the signal pattern | L | verdicts 21/23/25 (the incident's actual fork) |
| E6 | Optional hardening: parameterize the trailer with gate-likelihood (tier_mode, recommend-gate pass) so tier_0 free-pick arms carry a softer contract line than commit-near arms. Do NOT gate the trailer off (DIAL-ATOM-01 is locked); only enrich it. | dial-reach-orchestrator.cjs:116 frozen gate; sensor-gate-approach reach | M | verdict 7 (residual) |

### Hook plane

| ID | What changes | Reuse target (Part 7) | Size | Kills |
|----|-------------|----------------------|------|-------|
| H1 | Tighten ASCII_BOX_GLYPH_RE (scripts/check-card-fire.cjs:203): drop the bare `■` alternative (sanctioned UI glyph = false-positive full block); add the multiline labeled-box form (`\[\s*1\s*\][^\n]*\n[\s\S]*?\[\s*2\s*\]`) and the numbered-prose-gate form to cut false negatives. | Existing regex + shipped fixture suite in check-card-fire tests | S | verdict 12 |
| H2 | Fix WR-06: evaluate askFired as an OR across the assistant messages of the CURRENT turn (since the last user message), not the last assistant message alone (check-card-fire.cjs:681-716). | Same transcript-walk code path, widened window | S | verdict 13 |
| H3 | Wire PRIMARY: emit ran_entries / reached_gate_entries side-channel records from the three places that mint gate envelopes (selector-dispatcher pickShape :1024, intent-classifier engine arm :1007, emitBindingGate post-E4). Registry-keyed detection goes live; regex becomes secondary. | check-card-fire.cjs's already-shipped PRIMARY consumer (lines 48-58 doctrine); data/render-coverage-registry.json keyspace | M | verdicts 11, 25 |
| H4 | Fix the session-start exemplar: replace the MODE_MENU "Type 1, 2, or 3" injection (scripts/session-start:675-677) with a card-fire instruction (render via pickShape('F.1') + E1 trailer, or instruct the fire explicitly); same for the prose "Other rooms:" list (:585). | pickShape F.1 door; renderRoomChooserCard | M | verdict 24 |

### Body plane

| ID | What changes | Reuse target (Part 7) | Size | Kills |
|----|-------------|----------------------|------|-------|
| B1 | Canonical firing-contract block: extract the thrice-repeated commands/rooms.md paragraph (lines 26-27, 119-126, 466-468) into one canonical text; write a stamp script (pattern: scripts/backfill-hitl-shape.cjs's patchSurface, non-destructive) that inserts it into every declared-but-unwired command body keyed by hitl_shape, and adds AskUserQuestion to allowed-tools in the same pass (two-part delta per verdict 20). | rooms.md paragraph as canon; backfill-hitl-shape.cjs insertion machinery | M | verdicts 16, 18, 20 |
| B2 | Declared-implies-wired build gate: extend scripts/check-shape-declaration.cjs (or a sibling check) so a command declaring hitl_shape must (a) carry the firing block or an AskUserQuestion mention, (b) grant the tool, (c) not contradict its own body shape. Fix commands/futures.md F.2/F.1 drift as the first caught case (declares F.2 at line 6, body says F.1 at 69/77). | check-shape-declaration.cjs:144-166 validator skeleton | M | verdicts 19, 20 |
| B3 | Extend render coverage to .md: see section 3 (Wave 2) for the "declared implies rendered" mechanism. | build-render-coverage.cjs + check-render-coverage.cjs | M | verdict 17 |

---

## 3. Recommended wave order - "Shape-F Native Fire" phase

### Wave 1 - self-decoding trigger + doctrine (all S, highest leverage per line)
E1 (imperative trailer), E2 (serialize contract), P1, P2, P3, P4.
Rationale: E1 alone upgrades BOTH existing trailer transports simultaneously; P1-P4 put the mandate in every file Larry actually loads. After Wave 1, every gate that already renders carries its own binding instruction, and the agent prompt no longer contradicts it. Barrier: check-card-fire intercept rate on engine-arm gates should drop before Wave 2 starts (observable in the side-file counters).

### Wave 2 - render rollout (the declared-implies-rendered closure)
E3, E4, B1, B2, B3.
The check-render-coverage extension (B3) works like this:
1. build-render-coverage.cjs gains a second keyspace: commands/*.md with hitl_shape frontmatter (drop the `.cjs`-only filter at build-render-coverage.cjs:111 for a parallel md walk). Each declared command becomes a registry entry `{ surface, declared_shape, wired: bool }` in data/render-coverage-registry.json.
2. "Wired" predicate for .md = body contains the canonical firing block (B1 stamp marker) OR an explicit AskUserQuestion dispatch instruction, AND allowed-tools grants AskUserQuestion. This is the md analogue of the existing pickShape/appendAskUserQuestionTrailer call-site predicate (check-render-coverage.cjs:29,189).
3. check-render-coverage.cjs fails closed on any entry where declared_shape is set and wired is false, with the same exclusion-with-reason escape hatch larry-extended.md already models (its frontmatter `excluded: true` + reason).
4. futures.md-style drift (declared shape != body shape) fails via B2 in the same gate run.
Sequencing inside the wave: B1 stamp first (it flips ~86 entries to wired), then B3 gate turns on, so the gate lands green instead of red-flooding CI.

### Wave 3 - conversational-gate bridge
E5 (room-pick fork detector + renderRoomChooserCard injection), H3 (PRIMARY side-channel producers), H4 (session-start exemplar).
Rationale: this is the incident's actual fork - free conversation, no command, no trailer. E5 gives it a transport; H3 makes the backstop registry-aware so the same fork is detectable post-hoc; H4 removes the anti-pattern exemplar taught at session open. E6 (trailer gate-likelihood enrichment) rides here if capacity allows.

### Wave 4 - backstop tuning (after native fire lands, so telemetry validates)
H1 (regex FP/FN), H2 (WR-06 window).
Rationale: tune the floor only after the primary path is live, using Wave 1-3 intercept telemetry to confirm which regex branches still fire. Deliberately last: tightening the detector before the native path exists would only reduce coverage.

Verification for the phase (adversarial): replay the incident transcript shape (mid-dialogue room resume) and assert (a) card fires natively turn-1, (b) zero check-card-fire intercepts, (c) render-coverage gate green with 0 unwired declared commands, (d) a legit ■-bearing non-gate turn passes without block.

---

## 4. What stays with the backstop - the constitutional floor

check-card-fire.cjs remains the last line, unchanged in role:
- The Stop-event intercept + `decision:'block'` re-prompt stays (check-card-fire.cjs:477-482). Native fire is instruction-plane; only the hook is deterministic. R15's own doctrine stands: prose cannot force a tool call (header lines 9-16).
- MAX_FORCE_RETRIES=3 and MAX_SESSION_INTERCEPTS=12 stay as-is (:159, :180). The CR-04 session-wide un-flappable ceiling is the load-bearing livelock guarantee and is untouched by this phase.
- The degrade envelope stays `{ continue:true, suppressOutput:true }` (:464-469) - fail-open toward the navigator, never a hard stop. Optional QoL (not in scope): surface a one-line navigator-visible note on degrade instead of stderr-only (:874-877).
- SECONDARY (regex) detection stays even after H3 wires PRIMARY - it is the only detector that works when the side-channel writer itself fails. H1 only tunes it; it is never removed.
- The backstop's success metric flips: after this phase its intercept counters become the TELEMETRY that native fire is working (target: intercepts trend to zero), not the mechanism users experience. Any sustained nonzero intercept rate on a wired surface is a regression signal for Waves 1-3, caught by the side-file counters the hook already maintains.

Low-confidence notes (marked per RULES): the "~20s per intercept" and "~4 min worst case" figures from the lens inputs are incident telemetry, not repo-verifiable; RC-6 ("prose wins by instruction weight") is model-behavior inference - the cited lines are real but the causal weight is unproven, which is why its fix (P1's one-line qualification) is deliberately S-sized.
