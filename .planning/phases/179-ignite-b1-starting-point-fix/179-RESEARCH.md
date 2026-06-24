# Phase 179 Research - the captured fan-out (ignite B1 reuse map)

> Source: a 4-agent reuse-research workflow (2026-06-25) over the dev tree, grounding the B1
> redesign in what earlier phases already built. This IS the fan-out; the SPEC reads it.

## Verdicts (the headline)

- **Persona set: ALREADY EXISTS, canon-locked. Do NOT rebuild.** The 7 personas
  (researcher / student / founder-business / operator / investor / domain-expert; 7th = mentor)
  are a FROZEN vocabulary: `persona-taxonomy.cjs:114-122` ROLE_BLEND_AXES (display) +
  `persona-override.cjs:80-94` ROLE_BLEND_KEYS (lowercase snake_case store keys + normalizeRoleKey).
  They are 7 weighted FLOAT axes (0.0-1.0) in role_blend (Canon Part 2a: persona = role-blend x
  journey-stage), NOT an enum the user picks. Persist/read: `user-md-ops.cjs` (emptyUser:76-106,
  readUserMd:222-358 single chokepoint ~9 callers, writeUserMdAtomic:440-501, detectPersonaUpdate
  :528-554 gates re-detection at 0.75 conf + 3 consecutive signals). Override store
  (`persona-override.cjs`, ~/.mindrian/persona-override.json) survives auto-detect AND /mos:doctor.
  WARNING: the SAME 7 names also exist as a SEPARATE team-member archetype system (Canon Part 2 /
  Appendix E; synthetic-expert.cjs; persona-analyst De Bono hats) - do NOT conflate the navigator's
  role_blend (USER.md, 7 weighted axes) with the team-member archetype tag.

- **CV path: EXISTS and is the most-built leg.** Phase 115 dual-path is shipped:
  `dual-path-detector.cjs::classify` (detect_dual_path) -> `shallow-doc-parser.cjs::extractShallow
  :154-212` + parseRoleHints:35-50 + blendFromCanonicalRole:72-86 + extractDomains:303-344.
  ignite.md already offers "Paste my CV" (arrival_asset=cv-upload) and runs detect_dual_path ->
  extract_shallow. Gaps: parseRoleHints detects only 4 of 7 roles (Founder/Investor/Researcher/
  Operator); blendFromCanonicalRole yields only single-axis {key:1.0}; journey_stage never inferred;
  the CV-SECOND-SELECT (extractDomains -> "which 2-3 domains pull you?" multiSelect, BIRTH-FLOW-BRIEF
  line 130) has ZERO code; the CV path does not capture a hypothesis/motivation or auto-fire Engine 1.

- **Hypothesis start (Phase 174): SEEDED + RESEARCHED, NOT specced, NOT built.** Only artifacts:
  the ROADMAP stub (Phase 174, "SEEDED 2026-06-23 - spec later") + 174-RESEARCH.md (103 lines).
  Zero code: grep "hypothesis" across ignite.md / new-project.md / room-blueprints.json returns
  nothing. No `hypothesis` blueprint family and no `hypothesis`/`I-believe` arrival_asset
  (room-blueprints.json has exactly 8: exploration, solution-first, problem-first, business-first,
  portfolio, venture, program, case-study). Seed envisions a hypothesis door as a PEER (not a
  replacement): capture one falsifiable "I believe ___", file it as a truth-claim node
  (review_status:proposed, Part 5 tier None/Practitioner), derive a problem-definition draft, feed
  Engine 1. Research extends it (meta-hypothesis reframe; the instances-vs-structures abstraction
  control as the highest-leverage net-new; "end on a path forward, not a verdict"; person-anchored
  arrival). 6 spec questions explicitly UNRESOLVED in 174-RESEARCH.md section E.

## The reuse map (each B1 piece -> reuse / new)

| B1 piece | Reuse target | Verdict |
|---|---|---|
| Persona-first B1 (card-fired) | commands/ignite.md:70-98 (already persona-first + fires the card, prose stopgap e22b9ea4) | REUSE, but the prose fence is not a guarantee (see GA-4 below) |
| 7 personas | persona-taxonomy.cjs:114-122 + persona-override.cjs:80-94 | REUSE frozen vocab; import, never redefine |
| role_blend persist | user-md-ops.cjs emptyUser:76-106 / writeUserMdAtomic:440-501 / readUserMd:222-358 | REUSE single chokepoint |
| role_blend write at birth | navigation/room-birth.cjs:420-433 STEP 1 | REUSE; pass richer opts.roleBlend, do not touch the 7-step txn / approvedBy gate |
| navigator override | persona-override.cjs (survives /mos:doctor) | REUSE |
| CV intake | dual-path-detector.cjs::classify + shallow-doc-parser.cjs::extractShallow:154-212 + parseRoleHints + blendFromCanonicalRole + extractDomains | REUSE verbatim |
| CV -> weighted blend | shallow-doc-parser.cjs:72-86 (single-axis stub) | REUSE + EXTEND -> NEW weighted-blend computer |
| 3 missing detectors (Mentor/Domain Expert/Student) | parseRoleHints covers only 4 of 7 | NEW (small) IF B1 must infer them from CV |
| blueprintFamily + scaffold | data/room-blueprints.json (8 families) + room-skeleton-scaffold.cjs::resolveBlueprint/scaffoldRoomSkeleton:202-247, CI-checked by check-room-blueprints.cjs | REUSE, zero code change |
| hypothesis arrival door | no hypothesis family / arrival_asset (grep-confirmed absent) | NEW: add a `hypothesis` family + a hypothesis branch in B1 |
| hypothesis as seed assumption | writeClaimNode + confirmNode (Part 9) + evidence tiers (Part 5) | REUSE; file "I believe ___" as review_status:proposed |
| birth transaction | room-birth.cjs::birthRoom 7-step keystone, approvedBy-gated:319-326 | REUSE untouched |
| gate-answer journal/replay | scratchpad-ops.cjs:214-235 writeScratchpadBirthAnswer + room-birth.cjs:144-248 drainBirthGateAnswers | REUSE the bus, WIDEN the whitelist |
| role_blend/blueprint_family persist across sessions | scratchpad-ops.cjs:217-226 whitelists ONLY arrival_asset + free_text; ignite.md PASSES role_blend + blueprint_family but they are SILENTLY DROPPED | NEW (tiny): add role_blend + blueprint_family + hypothesis_text |
| per-persona first-win (B3) | each family carries default_methodologies[]; BIRTH-FLOW-BRIEF Section 3 persona matrix; B3 ranker ignite.md:116-155 | PARTIAL: B3 ranker REUSE; per-persona 30-min first chain NOT wired -> NEW resolver via Phase 122 command-resolver / Phase 166 runChain (no new selection brain, Part 11 R4) |
| CV-second-select (domain multiSelect) | BIRTH-FLOW-BRIEF line 130 specs it; extractDomains produces handles; NO multiSelect gate (grep ZERO) | NEW: a Shape F multiSelect consuming extractDomains() |
| Engine 1 first move | /mos:explore-domains (decomposition), shipped | REUSE; CV/hypothesis arrival auto-fires it |
| two divergent B1 specs | ignite.md:80-98 persona-first (role_blend) vs new-project.md:147-188 arriving-with (no role_blend) | NEW (reconcile): collapse to ONE persona-first B1; new-project keeps only the B2 scaffold backend |
| card-fire enforcement | NONE (R-1 residual; prose fence only) | NEW: the GA-4 PostToolUse interceptor (the true R-1 cure) |

## Recommended B1 design (4 doors, ~80% reuse / ~15-20% net-new)

ONE persona-first B1 (reconcile ignite.md over new-project.md). Each door resolves to
{role_blend, blueprintFamily, arrival_asset}, threaded into the EXISTING birthRoom opts. No new
store, taxonomy, reach/edge type, or Brain wire.

- **Door 1 - Persona pick (default).** AskUserQuestion "Who are you arriving as?" + the 6 personas
  + "Paste my CV". Sets role_blend from ROLE_BLEND_KEYS; derives blueprintFamily
  (researcher/student/domain_expert -> exploration; founder-business/operator/investor -> venture).
- **Door 2 - CV.** arrival_asset=cv-upload. detect_dual_path -> extract_shallow (reuse). NEW
  weighted role_blend; NEW CV-second-select (extractDomains() as Shape F multiSelect "which 2-3
  domains pull you?"), then auto-fire /mos:explore-domains.
- **Door 3 - Hypothesis (NEW peer door; the Phase 174 core).** Capture one falsifiable "I believe
  ___". Add a `hypothesis` family to room-blueprints.json (sections = problem-definition seeded +
  assumptions + opportunity-bank; default_methodologies = structure-argument / challenge-assumptions
  / validate / research), CI-green via check-room-blueprints.cjs. File the hypothesis as a
  truth-claim node. Gate the instances-vs-structures abstraction-level control as a Shape F.x step.
  Contract: end on a path forward, not a verdict. Hypothesis framing auto-selected per role
  (researcher=testable claim / founder=market bet / investor=thesis precondition) - resolve in SPEC.
- **Door 4 - Free-Text.** Larry interprets and routes.

## Load-bearing invariants

- role_blend written EXACTLY ONCE at birth (room-birth.cjs:420-433) before the confirmNode batch;
  pass the weighted blend as opts.roleBlend; do not touch the 7-step txn or approvedBy gate.
- blueprintFamily must resolve to a known family or fall back to frozen SECTION_NAMES.
- WIDEN scratchpad-ops.cjs:217-226: persist role_blend + blueprint_family + hypothesis_text (today
  silently dropped, so B1 signal does NOT survive across sessions to B2/birthRoom).
- B3 fires only after birthRoom ok:true; per-persona first-win routes through 122/166.
- Part-8 clean: CV/domain/hypothesis handles via auditQueryString; role_blend weights + user_id
  NEVER cross to Brain (only the Larry/Brain scalar via translateLarryToBrain).

## Open decisions to resolve in the SPEC (12) - do NOT build before these

1. Single hypothesis statement vs hypothesis + sub-hypotheses.
2. The instances-vs-structures abstraction-level control as a Shape F.x gate (highest leverage +
   risk, no existing surface; domain-neutral fixture required; AION specifics stay user-local, never
   the plugin repo).
3. Is hypothesis framing auto-selected from role_blend?
4. Does arrival auto-fire the Act 1 triple-filter (Engine 1) or gate it?
5. Weighted multi-axis blend now, or ship single-axis {key:1.0} stub and defer weighting?
6. Infer Mentor/Domain Expert/Student from a CV (3 new detectors), or only via pick/onboard/override?
7. Fund the per-persona first-win JTBD resolver now, or keep B3 as the static Tier-0/Mode-A ranker?
8. Confirm the `hypothesis` family section set + default_methodologies; Appendix-D note needed?
   (A data family is likely not a frozen-set move, so probably no canon amendment.)
9. Widen writeScratchpadBirthAnswer to persist role_blend + blueprint_family + hypothesis_text.
10. Reconcile the two B1 specs: ratify persona-first ignite.md as the one canonical B1; demote
    new-project.md to a pure B2 scaffold backend.
11. Does journey_stage inference enter scope (Phase 91 PLANNED), or stay inert at 'Ordinary World'?
12. Scope the GA-4 PostToolUse card-fire interceptor HERE (the true R-1 cure) or as a sibling phase?
    Plus: relationship to Phase 173 HEART deck H=Hypothesis pre-fill.

## Provenance

This phase is built on two fan-outs from the 2026-06-24/25 session: (a) the render-slip
investigation that produced Phase 178 / R15 (the R-1 debt this phase's GA-4 piece closes), and
(b) this persona/hypothesis reuse archaeology. Phase 174 (174-RESEARCH.md + 174-HANDOFF.md) is the
hypothesis-door seed, absorbed here as Door 3.
