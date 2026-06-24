---
kind: context
phase: 179
slug: ignite-b1-starting-point-fix
milestone: v1.15.0
created: 2026-06-25
canon_parts: [1, 2, 3, 5, 7, 9, 10, 11]
absorbs: [174]
depends_on: [178, 115, 122, 166]
cirs_relationship:
  surfaces_added:
    - check-card-fire (GA-4 PostToolUse interceptor)
    - cv-second-select (Shape F multiSelect)
    - hypothesis-arrival-door
  surfaces_modified:
    - ignite
    - new-project
    - scratchpad-ops
    - shallow-doc-parser
    - room-blueprints
    - persona-variants
  surfaces_removed: []
  spine_consumed:
    - commands/ignite.md
    - lib/core/navigation/room-birth.cjs
    - lib/core/scratchpad-ops.cjs
    - lib/core/persona-taxonomy.cjs
    - lib/core/persona-override.cjs
    - lib/core/user-md-ops.cjs
    - lib/core/dual-path-detector.cjs
    - lib/core/shallow-doc-parser.cjs
    - data/room-blueprints.json
    - lib/core/room-skeleton-scaffold.cjs
  gate_impact: "Two coupled fixes to the ignite B1 starting gate. (1) The R-1 card-fire residual: on beta.3 (with R15 shipped) B1 still rendered as flat ASCII instead of firing AskUserQuestion, proving a prose fence does not force the card. The true cure is a GA-4 PostToolUse interceptor that detects a reached-gate turn with no fired card and forces it (the named R-1 debt from Phase 178). (2) The B1 redesign as a persona-first + CV + hypothesis starting point (4 doors), ~80% reuse of the existing role_blend / Phase 115 dual-path / blueprint-family systems, ~15-20% net-new. Absorbs Phase 174 (hypothesis door becomes Door 3). No new reach/edge/node; frozen Part 3 contracts untouched; Part 8 clean."
  explanation: "WHEN / WHICH / SEQUENCE at the front door. The starting gate is where persona (role-blend x journey-stage, Part 2a), arrival (blueprintFamily), and the first hypothesis all get captured. Today B1 renders flat (R-1) and offers only solution/domain/venture. This phase makes B1 fire the card AND captures who-you-are + your-CV + your-hypothesis, threaded into the existing birthRoom contract, so the whole downstream (Engine 1, the team, the first win) is shaped from the real navigator."
status: context-captured
severity: NORMAL
sequence: "Follows Phase 178 (R15 render gate). Absorbs the seeded Phase 174 (hypothesis ignite). Entry: /gsd-spec-phase 179 (or 174) - the SPEC resolves the 12 open decisions BEFORE any build, because this is the exact class (front-door gate behavior) that has slipped repeatedly."
---

# Phase 179 Context: Ignite B1 Starting-Point Fix

> Registered 2026-06-25 from a live beta.3 repro + a 4-agent reuse-research fan-out. The full
> research is in 179-RESEARCH.md (the captured fan-out). This CONTEXT is the frame; the SPEC
> (/gsd-spec-phase 179) resolves the open decisions before any build.

## The two coupled problems

1. **R-1 card-fire residual (the flat gate).** On v1.15.0-beta.3, with the Phase 178 R15
   render-coverage gate shipped, `/mos:ignite` B1 STILL rendered as an ASCII box ("type 1, 2, or
   3") instead of firing the interactive AskUserQuestion selector. R15 makes a gate surface
   build-fail if it is not wired to emit a card, but it cannot force the model to fire the card at
   runtime - the named R-1 debt. A prose stopgap shipped (commit e22b9ea4) but a prose fence is
   not a guarantee (the agent already ignored the prior "no card, no picture" fence). The true
   cure is the **GA-4 PostToolUse interceptor**: detect a reached-gate turn with no fired card and
   force it. This is the load-bearing fix.

2. **B1 persona + CV + hypothesis redesign.** B1 should be persona-first (researcher / student /
   founder-business / operator / investor / domain-expert) + a "Paste my CV" path + a
   hypothesis-driven start (the seeded Phase 174 door), fired as a real card. ~80% reuse.

## Scope (from the research; details in 179-RESEARCH.md)

- The 4-door B1: Persona pick, CV (with the deferred CV-second-select multiSelect), Hypothesis
  (NEW peer door + the instances-vs-structures abstraction-level gate), Free-Text.
- The GA-4 card-fire interceptor (the R-1 cure).
- ~15-20% net-new: weighted multi-axis blend, optional 3 missing role detectors, code-level
  persona_variants selector, CV-second-select gate, per-persona first-win resolver, the hypothesis
  blueprint family + arrival branch + abstraction-level gate + path-forward contract, widen the
  scratchpad whitelist, reconcile the two B1 specs, the GA-4 interceptor.

## REUSE, do not rebuild (research-verified)

The 7-key role_blend taxonomy (persona-taxonomy.cjs / persona-override.cjs), the USER.md
persist/read chokepoint (user-md-ops.cjs), the birth transaction (room-birth.cjs), the Phase 115
CV dual-path (dual-path-detector + shallow-doc-parser), the blueprint-family + scaffold system
(room-blueprints.json + room-skeleton-scaffold.cjs), and the whole downstream pipeline ALL exist.
See 179-RESEARCH.md for the full file:line reuse map.

## Open decisions (resolve in the SPEC first - 12)

See 179-RESEARCH.md "Open decisions". Headlines: weighted blend now vs single-axis stub; infer
the 3 missing roles from CV or not; the abstraction-level control as a Shape F.x gate (highest
leverage + risk, domain-neutral fixture required); reconcile the two B1 specs; widen the scratchpad
whitelist; scope the GA-4 interceptor here vs sibling; the hypothesis blueprint family section set.

## Already done this session (do not redo)

- commands/ignite.md B1 prose stopgap (persona-first + CV + fire-the-card): commit e22b9ea4
  (a stopgap; the SPEC supersedes it).
- The 4-agent reuse-research fan-out (2026-06-25): captured in 179-RESEARCH.md.
- Phase 174 seed (174-RESEARCH.md + 174-HANDOFF.md): the hypothesis door, now Door 3 here.

---

## Implementation Decisions (discuss-phase, 2026-06-25)

> The registration frame above is preserved. SPEC.md (`179-SPEC.md`) locked the WHAT
> (12 requirements, ambiguity 0.125). This section captures the HOW decisions from the
> discuss-phase interview, for the researcher + planner.

### Spec lock
`179-SPEC.md` locks 12 requirements (Goal / Boundaries / Constraints / Acceptance). Downstream
agents MUST read it before planning and treat its requirements + boundaries as fixed. Do NOT
re-derive WHAT or WHY; this phase is HOW-only from here.

### Decisions captured (HOW)

1. **GA-4 detection signal: registry-keyed PRIMARY + output-text BACKSTOP.** The Stop-hook
   interceptor's primary signal is the Phase 178 render-coverage registry
   (`data/render-coverage-registry.json` gate-reaching `entries[]`): a registered gate-reaching
   surface ran this turn with no AskUserQuestion fired -> intercept. Backstop: scan the turn
   output for the ASCII-box gate glyphs, catching the literal anti-pattern even for an off-registry
   surface. Home = the existing `hooks/hooks.json` Stop block. Force = exit-2 block +
   additionalContext re-prompt; bounded retries then degrade (log + allow) so a card-incapable
   surface cannot trap the navigator.

2. **Abstraction gate fires ALWAYS (every Door 3 hypothesis), not conditional.** Brain-grounded
   (brain_ask 2026-06-25): the instances-vs-structures distinction is a Systems Thinking move (the
   iceberg: events -> patterns -> structure). The lift to structure must be DELIBERATELY surfaced
   because navigators default to instances and are blind to structure; an ambiguity-detector would
   trust a heuristic to catch the exact blindspot the navigator already has. Always-fire also kills
   the net-new classifier risk on the phase's riskiest surface. The 3rd option ("unsure") absorbs
   the genuinely-undecided navigator.

3. **Hypothesis blueprint family section set: LOCKED as specced.** sections = problem-definition
   (seeded with the hypothesis) + assumptions + opportunity-bank; default_methodologies =
   structure-argument / challenge-assumptions / validate / research. Matches the falsify-a-belief
   job; CI-green via `check-room-blueprints.cjs`. No dedicated `hypotheses` section this phase.

### Wave order (from SPEC; planner refines)
Wave 1 = the GA-4 interceptor (the R-1 cure precedes everything that depends on a card firing).
Then: widen the scratchpad whitelist -> 4-door persona-first B1 -> hypothesis family + truth-claim
filing -> abstraction gate -> CV multiSelect + auto-fire Engine 1 (gate results) -> reconcile the
two B1 specs. One surface per wave to keep CI green.

### Canonical refs (MANDATORY — full relative paths)
- `.planning/phases/179-ignite-b1-starting-point-fix/179-SPEC.md` — Locked requirements; MUST read before planning
- `.planning/phases/179-ignite-b1-starting-point-fix/179-RESEARCH.md` — file:line reuse map (4-agent fan-out)
- `.planning/phases/179-ignite-b1-starting-point-fix/fanout/persona-hypothesis-archaeology.json` — reuse + persona/CV/hypothesis verdicts + 12 decisions
- `.planning/phases/179-ignite-b1-starting-point-fix/fanout/render-slip-investigation.json` — the R-1 diagnosis (5-agent)
- `.planning/phases/174-hypothesis-based-ignite/174-RESEARCH.md` + `174-HANDOFF.md` — Door 3 (absorbed) seed
- `docs/MINDRIAN-CANON.md` — Parts 1, 2, 2a, 3, 5, 7, 8, 9, 10, 11
- `scripts/check-render-coverage.cjs` + `scripts/build-render-coverage.cjs` + `data/render-coverage-registry.json` — Phase 178 R15 substrate the GA-4 interceptor keys off

### Code context (reuse map highlights — verified live 2026-06-25)
- `lib/core/persona-override.cjs` ROLE_BLEND_KEYS — frozen 7-key vocab; import, never redefine
- `lib/core/scratchpad-ops.cjs` `writeScratchpadBirthAnswer:225-226` — widen whitelist (+role_blend, +blueprint_family, +hypothesis_text)
- `lib/core/navigation/room-birth.cjs:420-433` — role_blend write at birth; 7-step txn + approvedBy gate UNTOUCHED
- `lib/core/shallow-doc-parser.cjs` — extractShallow / parseRoleHints (4-of-7) / blendFromCanonicalRole (single-axis) / extractDomains
- `data/room-blueprints.json` (+`hypothesis` family) + `scripts/check-room-blueprints.cjs` (CI gate)
- `commands/ignite.md` B1 (canonical, persona-first) / `commands/new-project.md` (demote to B2 scaffold backend)
- `hooks/hooks.json` Stop block — GA-4 interceptor registration point

### Deferred ideas (preserved, not in scope)
- Weighted multi-axis role_blend computer + the 3 missing CV detectors (Mentor/Domain Expert/Student) — fast-follow
- Journey-stage inference — Phase 91
- Cross-room expert/persona reuse — Part-8-gated deferred amendment
- Hypothesis sub-hypotheses / meta-hypothesis reframe — Door 3 captures a single falsifiable statement this phase
