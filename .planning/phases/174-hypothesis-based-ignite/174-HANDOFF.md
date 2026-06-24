# Phase 174 Handoff - Ignite B1: persona + CV + hypothesis starting point

> Written 2026-06-25 as a fresh-session handoff. The prior session shipped Phase 178 (R15
> render-coverage gate) + cut v1.15.0-beta.3, then a live beta.3 repro showed ignite B1
> rendering as flat ASCII ("type 1, 2, or 3") instead of the interactive selector. The
> navigator wants B1 redesigned as a persona-first + CV + hypothesis starting point, fired as a
> real card, and is moving it to a clean GSD session. This doc consolidates the research so the
> new session does not re-derive it.
>
> ENTRY POINT for the new session: `/gsd-spec-phase 174` (Phase 174 is seeded + researched;
> 174-RESEARCH.md + this handoff are the inputs). Resolve the open decisions below in the SPEC
> before any build.

## The trigger (two distinct problems)

1. **The flat-gate bug (R-1 residual).** On beta.3 (with R15 shipped), ignite B1 still rendered
   as an ASCII box + "type 1, 2, or 3" instead of firing AskUserQuestion. R15 makes a gate
   surface BUILD-FAIL if it is not wired to emit a card, but it cannot force the model to fire
   the card at runtime - that is the named R-1 debt. The true cure is the **GA-4 PostToolUse
   interceptor** (detect a gate turn with no fired card, force it). A prose stopgap was committed
   (`commands/ignite.md` B1, commit e22b9ea4: an explicit "FIRE the card, never draw ASCII +
   type-a-number" instruction) but a prose fence is not a guarantee - the agent already ignored
   the existing "no card, no picture" fence. The GA-4 interceptor is the load-bearing fix and
   belongs in this phase (or a sibling).

2. **The B1 feature (persona + CV + hypothesis).** Navigator wants B1 to ask "who are you
   arriving as?" (researcher / student / founder-business / operator / investor / domain-expert)
   + a "paste your CV" path + a hypothesis-driven start - the deferred "CV-second-select +
   per-persona JTBD" plus the Phase 174 hypothesis door.

## What ALREADY EXISTS - REUSE, do not rebuild (research-verified)

| B1 piece | Reuse target | Verdict |
|---|---|---|
| 7 personas (role_blend) | `persona-taxonomy.cjs:114-122` ROLE_BLEND_AXES + `persona-override.cjs:80-94` ROLE_BLEND_KEYS | REUSE frozen vocab. Import, never redefine. They are 7 weighted FLOAT axes, not an enum. |
| role_blend persist | `user-md-ops.cjs` emptyUser:76-106 / writeUserMdAtomic:440-501 / readUserMd:222-358 (single chokepoint) | REUSE. No parallel store. |
| role_blend write at birth | `navigation/room-birth.cjs:420-433` STEP 1 writeUserMdAtomic | REUSE. Pass richer opts.roleBlend; do not touch the 7-step txn or approvedBy gate. |
| navigator persona override | `persona-override.cjs` (~/.mindrian/persona-override.json, survives /mos:doctor) | REUSE. Masks USER.md for every reader. |
| CV path | Phase 115: `dual-path-detector.cjs::classify` (detect_dual_path) -> `shallow-doc-parser.cjs::extractShallow:154-212` + parseRoleHints:35-50 + blendFromCanonicalRole:72-86 + extractDomains:303-344 | REUSE verbatim. ignite.md already wires "Paste my CV". |
| blueprintFamily + scaffold | `data/room-blueprints.json` (8 families) + `room-skeleton-scaffold.cjs::resolveBlueprint/scaffoldRoomSkeleton:202-247`, CI-checked by `check-room-blueprints.cjs` | REUSE, zero code change. |
| hypothesis as seed assumption | `writeClaimNode` + `confirmNode` (Part 9 proposed->confirmed) + evidence tiers (Part 5) | REUSE. File "I believe ___" as a truth-claim node, review_status:proposed. |
| birth transaction | `room-birth.cjs::birthRoom` 7-step keystone, approvedBy-gated:319-326 | REUSE untouched. |
| gate-answer journal/replay | `scratchpad-ops.cjs:214-235 writeScratchpadBirthAnswer` + `room-birth.cjs:144-248 drainBirthGateAnswers` | REUSE the bus, WIDEN the whitelist (below). |
| Engine 1 first move | `/mos:explore-domains` (decomposition), shipped | REUSE. CV/hypothesis arrival auto-fires it. |

## The recommended B1 design (4 doors, ~80% reuse)

ONE persona-first B1 (reconcile `ignite.md:80-98` over `new-project.md:147-188`). Each door
resolves to {role_blend, blueprintFamily, arrival_asset}, threaded into the EXISTING birthRoom
opts. No new store, taxonomy, reach/edge type, or Brain wire.

- **Door 1 - Persona pick (default).** AskUserQuestion "Who are you arriving as?" + the 6
  personas + "Paste my CV". Sets role_blend from ROLE_BLEND_KEYS; derives blueprintFamily
  (researcher/student/domain_expert -> exploration; founder-business/operator/investor -> venture).
- **Door 2 - CV.** arrival_asset=cv-upload. detect_dual_path -> extract_shallow (reuse). NEW:
  weighted role_blend (extend blendFromCanonicalRole beyond single-axis); NEW: CV-second-select
  (extractDomains() handles as a Shape F multiSelect "which 2-3 domains pull you?"), then auto-fire
  /mos:explore-domains.
- **Door 3 - Hypothesis (NEW peer door, the Phase 174 core).** Capture one falsifiable "I believe
  ___". Add a `hypothesis` family to room-blueprints.json (sections = problem-definition seeded +
  assumptions + opportunity-bank; default_methodologies = structure-argument / challenge-assumptions
  / validate / research), CI-green via check-room-blueprints.cjs. File the hypothesis as a
  truth-claim node. Gate the **instances-vs-structures abstraction-level control** as a Shape F.x
  step (highest-leverage AND highest-risk net-new). Contract: end on a path forward, not a verdict.
- **Door 4 - Free-Text.** Larry interprets and routes.

**Net-new (~15-20%):** (a) weighted multi-axis blend computer; (b) optional 3 missing role
detectors (Mentor/Domain Expert/Student from CV); (c) code-level persona_variants selector + filled
stub copy; (d) CV-second-select multiSelect gate; (e) per-persona first-win resolver (route via
Phase 122 command-resolver / Phase 166 runChain, NOT a new selection brain, Part 11 R4); (f) the
hypothesis family + arrival branch + abstraction-level gate + path-forward contract; (g) widen the
scratchpad whitelist; (h) reconcile the two B1 specs into one; PLUS the GA-4 card-fire interceptor.

## Load-bearing invariants

- role_blend written EXACTLY ONCE at birth (room-birth.cjs:420-433) before the confirmNode batch;
  pass the weighted blend as opts.roleBlend, do not touch the 7-step txn or approvedBy gate.
- blueprintFamily must resolve to a known family or fall back to frozen SECTION_NAMES.
- **WIDEN scratchpad-ops.cjs:217-226**: today the whitelist persists only arrival_asset + free_text;
  ignite.md already PASSES role_blend + blueprint_family but they are SILENTLY DROPPED, so the B1
  persona/hypothesis signal does NOT survive across sessions. Add role_blend + blueprint_family
  (+ hypothesis_text).
- B3 fires only after birthRoom ok:true; per-persona first-win routes through 122/166.
- Part-8 clean: CV/domain/hypothesis handles via auditQueryString; role_blend weights + user_id
  NEVER cross to Brain (only the Larry/Brain scalar via translateLarryToBrain).

## Open decisions to resolve in the SPEC (do NOT build before these)

1. Single hypothesis statement vs hypothesis + sub-hypotheses (174-RESEARCH.md section E).
2. How the instances-vs-structures abstraction-level control surfaces as a Shape F.x gate (the
   highest-leverage, highest-risk piece, no existing surface; build a non-pharma fixture - domain
   neutrality is a hard requirement; AION specifics stay in the user-local room, never the plugin).
3. Is hypothesis framing auto-selected from role_blend (researcher=testable claim / founder=market
   bet / investor=thesis precondition)?
4. Does arrival auto-fire the Act 1 triple-filter (Engine 1) or gate it?
5. Weighted multi-axis blend in scope now, or ship single-axis {key:1.0} stub and defer weighting?
6. Infer Mentor/Domain Expert/Student from a CV (3 new parseRoleHints detectors), or only via the
   persona pick / conversational onboard / override? (Researcher.IND / Founder.grant are regulatory
   subtypes, excluded by design.)
7. Fund the per-persona first-win JTBD resolver now, or keep B3 as the static Tier-0/Mode-A ranker?
8. Confirm the `hypothesis` family section set + default_methodologies; decide if it needs an
   Appendix-D note (a data family is likely not a frozen-set move, so probably no canon amendment).
9. Reconcile the two divergent B1 specs: ratify persona-first ignite.md:80-98 as the one canonical
   B1, demote new-project.md:147-188 to a pure B2 scaffold backend.
10. Does journey_stage inference enter scope (Phase 91 PLANNED), or stay inert at 'Ordinary World'?
11. Scope the GA-4 PostToolUse card-fire interceptor here (the true R-1 cure) or as a sibling phase?
12. Relationship to Phase 173 HEART deck H=Hypothesis pre-fill.

## Already done this session (do not redo)

- `commands/ignite.md` B1 prose stopgap (persona-first options + CV path + mandatory-fire-the-card
  instruction): commit **e22b9ea4**. It is a stopgap, NOT the engineered feature; the SPEC supersedes it.
- The research fanout that produced this map (4-agent workflow, 2026-06-25).
- Reference: BIRTH-FLOW-BRIEF.md at .planning/research/new-room-onboarding-20260612/; 174-RESEARCH.md
  in this dir; Canon Part 2 / 2a (persona = role-blend x journey-stage), Appendix E.
