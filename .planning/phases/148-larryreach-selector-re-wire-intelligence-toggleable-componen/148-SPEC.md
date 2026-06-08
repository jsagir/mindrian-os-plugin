# Phase 148: LarryReach Selector Re-wire (Intelligence + Toggleable Components) — Specification

**Created:** 2026-06-08
**Ambiguity score:** 0.11 (gate: <= 0.20)
**Requirements:** 8 locked

## Goal

Every reach in the LarryReach selector AND the suggest/next-move surface gets two things: real content (the PWS intelligence engines where applicable) and its OWN toggleable component matched to what it does, instead of a flat uniform list where only intelligence rows are special. The five intelligence engines join the ranked reach set, Hats becomes the 6th ranked reach (DIAL_REACH_K 5 -> 6), File and Brain review become always-open standing options outside the chooser cap, and selecting any reach invokes the REAL command.

## Background

LARRYREACH (Phases 140-146, shipped 2026-06-08) made the capability dial FIRE, but the tester onboarding session (`~/MindrianRooms/mindrianOS/meetings/2026-06-08-tester-onboarding-session/`) proved it fires with plumbing behind it. `lib/hmi/dial-reach-orchestrator.cjs` defines 5 frozen reaches (`context_block`, `contradiction`, `cross_room`, `brain_consult`, `deep_research`); the PWS intelligence engines (`find-bottlenecks`/`rs-fetch`, `whitespace`, `find-analogies`, `find-connections`, `dominant-designs`, `think-hats`) exist as commands but are NOT in the reach set. Larry reached them only when the navigator typed the magic words.

Shipped and reusable (surface audit, research doc Section 10): `lib/hmi/shape-f1-renderer.cjs` (F.1 renderer, Free-Text-always-last, RECOMMENDED marker), `lib/hmi/dial-reach-orchestrator.cjs` (DIAL_REACH_K=5, frozen 0.70/0.15 gate, OFFERED_CAP=MAX_K=3), `lib/hmi/dial-label-composer.cjs`, `lib/workflow/dial-close-reach.cjs` (4-outcome write through `navigation.cjs`), `lib/workflow/f-selector-ranker.cjs` (MAX_K=3, D4/D9 ranking), `lib/workflow/command-resolver.cjs` (Phase 122), `lib/core/navigation.cjs` (Phase 109 chokepoint), `resolveOfferNextStep` (Phase 135 offer-resolver), `skills/intelligence-orchestrator` (Phase 143.3). There is NO keyboard/TTY/inquirer/clack/ink dependency in the repo; interactivity is the `AskUserQuestion` primitive (the TTY wall, research doc Section 0). The component routing does not exist yet: today every row shares one uniform shape.

Full grounding: `.planning/research/2026-06-08-keyboard-tui-capability-cockpit-research.md` (Sections 1, 10, 14, 15).

## Requirements

1. **Intelligence engines join the reach set**: The five PWS engines become members of the ranked reach set.
   - Current: 5 frozen plumbing reaches; engines exist only as standalone commands, never offered by the selector
   - Target: `reverse-salient` (find-bottlenecks/rs-fetch), `whitespace`, `find-analogies`, `find-connections`, `dominant-designs` are resolvable, rankable reach-ids in the orchestrator
   - Acceptance: a test asserts all five engine reach-ids resolve to a real command via `command-resolver.cjs` and are eligible for ranking by `f-selector-ranker.cjs`

2. **Hats as the 6th ranked reach**: Hats joins the ranking, raising the candidate pool.
   - Current: `DIAL_REACH_K=5`; no Hats reach; `think-hats` is a standalone command
   - Target: Hats is the 6th ranked reach; `DIAL_REACH_K===6`; research personas cached per room and rebuilt on demand
   - Acceptance: `DIAL_REACH_K===6` asserted in test; Hats reach-id ranks alongside the engines; a test covers the persona cache read-then-rebuild path

3. **File + Brain review are always-open standing options**: Two standing options outside the chooser cap; Free-Text always last.
   - Current: Free-Text is always-last (shipped); there is no standing File option; `brain_consult` is a ranked reach that can rank out
   - Target: "File these findings" AND "Brain review" render as always-open standing options OUTSIDE the `MAX_K=3` cap at every selector render; Free-Text stays always-last
   - Acceptance: across mode_a / mode_b / tier_0 / cold-room renders, File + Brain review + Free-Text are present every time; a test asserts their presence is independent of ranking

4. **Per-option toggleable component routing across the whole surface**: Each reach/suggestion gets the component matched to what it does, not only the intelligence rows.
   - Current: the selector renders a flat verb/reach list via `shape-f1-renderer.cjs`; all rows share one uniform shape
   - Target: a component map resolves each reach/suggestion to its toggleable component (Select / multi-select / ordered checkbox / group multi-select / confirm / raw) per its interaction archetype; applies to ALL reaches, not only intelligence
   - Acceptance: a test asserts at least three distinct components are emitted across a representative render set, and that a non-intelligence reach also carries a non-default component where its archetype calls for it

5. **Unify the suggest surfaces onto one host**: One ranking, one component-routed render path.
   - Current: F.1 Next Move (`shape-f1-renderer.cjs`), offer-resolver (`resolveOfferNextStep`, Phase 135), and suggest-next are separate surfaces
   - Target: the three are unified onto the one component-routed reach host
   - Acceptance: a test asserts offer-resolver and suggest-next route through the same reach-host renderer (single code path), not three bespoke renderers

6. **Real invocation (command runs + edge + artifact)**: Selecting a reach runs the engine, not a label.
   - Current: `dial-close-reach.cjs` writes a `SELECTED_REACH` edge, but the 5 reaches are plumbing labels; selecting does not run an intelligence command
   - Target: selecting an intelligence reach routes through `command-resolver.cjs` to the real command, the command executes, a `SELECTED_REACH` typed edge is written via `navigation.cjs`, and the engine artifact lands
   - Acceptance: integration test - select `reverse-salient` -> resolver maps to find-bottlenecks/rs-fetch -> command executes (not stubbed) -> `SELECTED_REACH` edge present in room.db -> engine artifact file/row present

7. **Frozen contracts + ranker preserved**: The expansion does not loosen the locked rails.
   - Current: `f-selector-ranker.cjs` `MAX_K=3`; `RECOMMEND_FLOOR=0.70` / `MARGIN_THRESHOLD=0.15` frozen; SEED-020 no-bespoke-widget
   - Target: reaches JTBD-ranked via `f-selector-ranker.cjs`; `MAX_K=3` chooser cap unchanged; 0.70/0.15 recommend gate unchanged; every component resolves from the F-family via the dispatcher
   - Acceptance: tests assert `MAX_K===3`, `RECOMMEND_FLOOR===0.70`, `MARGIN_THRESHOLD===0.15` unchanged; an audit asserts no bespoke selector renders outside the dispatcher

8. **Brain review is boundary-safe (zero egress)**: The outside-review option never leaks user data.
   - Current: `brain_consult` exists; Brain queries are typed packets (Phase 110 contract)
   - Target: the Brain review standing option uses a typed methodology packet only; zero user-content egress; all writes local through `navigation.cjs`
   - Acceptance: `check-brain-boundary` scan passes for the new code; an adversarial test asserts no user-content string reaches the Brain packet from the Brain-review path

## Boundaries

**In scope:**
- The LarryReach selector + suggest/next-move surface (F.1 Next Move, offer-resolver, suggest-next, the reach set, posture)
- The five intelligence engines as ranked reaches; Hats as the 6th ranked reach
- File these findings + Brain review as always-open standing options; Free-Text always-last
- Per-option toggleable component routing across the WHOLE surface (not only intelligence rows)
- Real invocation through `command-resolver.cjs` with typed edge + landed artifact
- JTBD ranking via `f-selector-ranker.cjs`; frozen cap/gate preserved

**Out of scope:**
- Path A standalone keyboard cockpit / Ink binary (arrow-key TTY) — Phase 154; the TTY wall forbids it in-conversation (research Section 0)
- De Stijl color-block painting beyond the existing UI-ruling glyph/color — Phase 151/152
- Hebrew / RTL bundle — Phase 153
- The `interaction_archetype` rollout across the ~80 /mos: commands — Phase 152 (148 covers the selector + suggest surface only)
- A live Ask-Tell left/right keyboard slider — Path A / Phase 154 (in-conversation posture framing stays as shipped)
- Live arrow-key navigation in-conversation — the TTY wall; AskUserQuestion is the only interactive primitive

## Constraints

- In-conversation only via the `AskUserQuestion` primitive; no TTY / raw-mode (research Section 0)
- Zero Brain egress (Canon Part 8); Brain review is typed-packet only (Phase 110 contract)
- `MAX_K=3` chooser cap preserved; `DIAL_REACH_K` 5 -> 6 (Hats); 0.70/0.15 recommend gate frozen; Free-Text always last; no bespoke widgets (SEED-020 — resolve from the F-family via the dispatcher)
- Reuse before build (Canon Part 7): `shape-f1-renderer.cjs`, `dial-reach-orchestrator.cjs`, `dial-label-composer.cjs`, `dial-close-reach.cjs`, `f-selector-ranker.cjs`, `command-resolver.cjs`, `navigation.cjs`, `resolveOfferNextStep`, `skills/intelligence-orchestrator`
- No em-dashes in any output (hard rule); tri-polar (CLI / Desktop / Cowork) considered

## Acceptance Criteria

- [ ] Selector reach set includes the 5 intelligence engines + Hats as the 6th reach; `DIAL_REACH_K===6`
- [ ] File these findings + Brain review present at every render OUTSIDE the `MAX_K=3` cap; Free-Text always last
- [ ] At least 3 distinct toggleable components emitted across a representative render set; a non-intelligence reach also carries its archetype component
- [ ] offer-resolver + suggest-next + F.1 Next Move route through one shared reach-host renderer (single code path)
- [ ] Selecting `reverse-salient` invokes find-bottlenecks/rs-fetch (executes, not stubbed) + writes a `SELECTED_REACH` edge + lands the artifact
- [ ] `MAX_K===3`, `RECOMMEND_FLOOR===0.70`, `MARGIN_THRESHOLD===0.15` unchanged; no bespoke widget outside the dispatcher
- [ ] `check-brain-boundary` scan passes for the Brain-review path; zero user-content egress
- [ ] No em-dashes anywhere in shipped output

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                            |
|--------------------|-------|------|--------|--------------------------------------------------|
| Goal Clarity       | 0.87  | 0.75 | ✓      | Scope broadened to whole selector + suggest surface |
| Boundary Clarity   | 0.92  | 0.70 | ✓      | Scope width locked; standing options locked; out-of-scope explicit |
| Constraint Clarity | 0.88  | 0.65 | ✓      | DIAL_REACH_K 5->6 decided; MAX_K=3 + gate frozen |
| Acceptance Criteria| 0.88  | 0.70 | ✓      | command-runs + edge + artifact (full proof)      |
| **Ambiguity**      | 0.11  | <=0.20| ✓     |                                                  |

Status: ✓ = met minimum

## Interview Log

| Round | Perspective     | Question summary                                   | Decision locked                                            |
|-------|-----------------|----------------------------------------------------|------------------------------------------------------------|
| 1     | Boundary Keeper | Where does the Hats track live?                    | Hats = 6th ranked reach (DIAL_REACH_K 5->6)               |
| 1     | Boundary Keeper | Is File a standing option or a ranked reach?       | Standing option, outside the MAX_K=3 cap                  |
| 1     | Failure Analyst | Falsifiable proof a reach INVOKED the engine?      | Full: command runs + SELECTED_REACH edge + artifact       |
| 2     | Simplifier      | How wide does the component-toggle go?             | The selector + suggest surface (80-command rollout = P152)|
| 2     | Boundary Keeper | Scope is intelligence-only or all reaches?         | ALL LarryReach reaches + suggest surface get components   |
| 2     | Researcher      | Brain's role in the suggestion set?                | Brain review = always-open standing option (outside review)|

---

*Phase: 148-larryreach-selector-re-wire-intelligence-toggleable-components*
*Spec created: 2026-06-08*
*Next step: /gsd-discuss-phase 148 — implementation decisions (how to build what's specified above)*
