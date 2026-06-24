---
kind: research
phase: 177
slug: larry-behavioral-channel
created: 2026-06-24
method: "7-cluster parallel recon fan-out over the bundle + live v1.14.0-beta.7 repo; 114 claims, each verified by opening the cited file. Adversarial verify pass was rate-limited (429); verdicts pending, so single-source claims below are recon-only and flagged."
---

# Phase 177 RESEARCH: Verified Implementation Map

This is the bundle's design claims checked against the LIVE repo. Where the bundle and the
code disagree, the code wins and it is flagged. Two of the bundle's own "falsified gaps"
turned out to be STALE - the code already has what the bundle says is missing. That is the
headline; it rewrites PART 6 and BCH-18.

House rule: hyphens, no em-dashes, no emoji.

## 0. Headline corrections (read these first)

1. PATH BUG (pervasive): the frozen-set file is `lib/core/sensors/sensor-types.cjs`, NOT
   `lib/core/sensor-types.cjs`. Every bundle citation and the 177-CONTEXT/SPEC `cirs`
   block uses the wrong path. REACH_IDS (6) at :43-50, POSTURE_IDS (3) at :54-58 - both
   confirmed frozen, only the directory is off by one level.

2. GAP 1 IS STALE (BCH-18 must be re-scoped): the bundle says "no role_blend write at room
   birth exists." FALSE in beta.7. `lib/core/navigation/room-birth.cjs:319` defines
   `birthRoom(opts)`, and STEP 1 (:426-430) already calls `writeUserMdAtomic(userMdPath,
   { canonical_role, role_blend: roleBlend, journey_stage })`. Phase 155 shipped the
   producer. The real gap is UPSTREAM: nothing computes a weighted 7-axis blend -
   shallow-doc-parser emits only a `canonical_role` scalar (4 of 7 roles).

3. GAP 2 IS STALE (the SPEC non-goal is wrong): the bundle says
   `data/room-blueprints.json` does not exist. FALSE. The file exists (5829 bytes, 8
   families: exploration, solution-first, problem-first, business-first, portfolio,
   venture, program, case-study), shipped by Phase 155-05, validated by
   `scripts/check-room-blueprints.cjs`, consumed by `birthRoom` via `opts.blueprintFamily`
   (room-birth.cjs:343). The blueprint-family leg is NOT blocked and need not be deferred.

4. The bundle doc `07-IGNITE-PERSONA-VERIFICATION.md` was authored against a PRE-Phase-155
   checkout and never reconciled. Treat all of its PART-6 re-scope conclusions as suspect;
   re-derive against room-birth.cjs:426 and data/room-blueprints.json.

## 1. Verification ledger

Verdicts are recon-only (the adversarial second pass was rate-limited). "confirmed" = an
agent opened the file and saw it. Line drift noted where the bundle was off.

| Claim | Bundle cited | Actual (live) | Verdict |
|-------|--------------|---------------|---------|
| SEAM 3 insertion between sensor reach and Brain-verb path | nav-engine.cjs:466 / :468 | :458-466 (sensor branch) / :468-484 (mode_a Brain path); seam is real and clean | confirmed |
| Brain floor 0.70 | nav-engine.cjs:74 | :74 `RECOMMENDED_CONFIDENCE_FLOOR = 0.7`; evaluated :823 | confirmed |
| 0.85 channel ceiling | (bundle) | NOT in code - design proposal only | corrected (add as const) |
| Score formula + 0.30*inv problem_type_bind term | f-selector-ranker.cjs:47-52 | docstring 47-52, live impl 286-292 | confirmed |
| investment_level producer | projections.cjs:176-193 | computeInvestmentLevel at :213-230 (176-193 is resolveHopDepth); consumed f-selector-ranker.cjs:394 | confirmed, line corrected |
| Density branches <0.4 / 0.4-0.7 / >=0.7 | f-selector-ranker.cjs:118-141 | :130-141 | confirmed |
| Thresholds in code, not prompt | :137-138, 287-290 | confirmed JS literals | confirmed |
| Ask-Tell dial curve in prompt | larry-server-instructions.md:19-34 | :19-34 | confirmed |
| Dial == investment_level (SEAM 1) | (bundle) | DIFFERENT inputs today: turn-count vs framework_invocations/10 | unverifiable (design choice) |
| BCH-12 color seam (colored ■, TTY-gated) | render-v2.cjs:199-205 | :199-205 | confirmed |
| Color is JTBD-anchored, posture-ready but unwired | :199-205 | render() has no posture arg (:115-122) | confirmed |
| statusline operator badge slot | two-row-renderer.cjs renderRow1 | renderRow2 :149-150 | FALSIFIED |
| memory chokepoint logEvent | memory-events.cjs:502 | :502; re-export navigation.cjs:100 | confirmed |
| system-bookkeeping carve-out (review_status confirmed) | (logEvent INSERT) | :542-548 (created_by default system :543, review_status 'confirmed' :547) | confirmed |
| sibling precedent focus_changed | focus.cjs | :48-72 | confirmed |
| buildBrainPacket reads only nodes+identity | navigation.cjs:87 | :87 re-export; packet.cjs:293; reads nodes (:62,164,239,314)+identity (:232) | confirmed |
| calibration_observations table exists? | (new) | absent from lib/ scripts/ data/ | confirmed absent |
| nodes full-column schema home | lazygraph-ops.cjs:34-47 | lazygraph-ops is reduced legacy (id/type/properties only); authoritative 9-col schema elsewhere (node-insert.cjs/room-db.cjs) | FALSIFIED |
| trigger_tier recorded | nav-engine.cjs:283-294 | insight-sensors.cjs:294 (WRONG FILE; line coincidence) | FALSIFIED |
| TRIGGER_TIERS [signal,context,keyword] / SIGNAL>keyword | sensor-types.cjs:73-77 / :174-180 | lib/core/sensors/sensor-types.cjs:73-77 / :174-180 | confirmed, path corrected |
| FORCED-MATERIAL checked first | chain-executor.cjs:243-245 | :242-245 (before quality + posture checks) | confirmed |
| IRREVERSIBLE_HINTS 7 keywords | chain-executor.cjs:147-173 | :154-162 frozen array | confirmed |
| degrade-never-fabricate | command-resolver.cjs:117 | :117-118 {command:null, optional:true}; _defaultPostureFn :139-145 | confirmed |
| role_blend 7 frozen roles | persona-taxonomy.cjs:114-122 | :114-122 | confirmed |
| role_blend WRITE at birth (GAP 1) | NOT FOUND | EXISTS room-birth.cjs:319 + :426-430 | FALSIFIED (stale doc) |
| room-blueprints.json (GAP 2) | NOT FOUND | EXISTS data/room-blueprints.json (8 families) | FALSIFIED (stale doc) |
| writeUserMdAtomic accepts role_blend | user-md-ops.cjs:346-348,399-440 | sig :440; merge :382-384; emit :392-398; production caller room-birth.cjs:426 | confirmed |
| shallow-doc-parser writes canonical_role scalar only | shallow-doc-parser.cjs:124-136 | :124-136; parseRoleHints :42-50 (4 of 7 roles) | confirmed |
| 5 role_blend read sites | (5 cited) | all 5 exist, LOCAL, line numbers drift ~5-40 | confirmed |
| dial-TUI not shipped | CHANGELOG.md:20 | files absent (confirmed); CHANGELOG cite wrong (Phase 143 at 169/172-174) | confirmed (cite corrected) |

## 2. Confirmed ground truth, grouped by Wave-1 requirement

- BCH-S1 (unify dial = investment_level): `computeInvestmentLevel` projections.cjs:213-230
  (`min(1,max(0,framework_invocations/10))`); consumed f-selector-ranker.cjs:394; density
  gate :130-141. The prompt dial is turn-count driven (larry-server-instructions.md:19-34).
  These are TWO different numbers today - SEAM 1 must pick the canonical one (see Q5).
- BCH-S5 (turn-stage eligibility): the ranker MAX_K area + REACH_IDS at
  sensors/sensor-types.cjs:43-50; sensor branch is NOT tier-gated (nav-engine.cjs:458-466).
- BCH-S4a (saturation by node-delta): node_delta = a `created_at` window query on the nodes
  table; compute near insight-sensors.cjs (where trigger_tier is already set, :294).
- BCH-REG / BCH-16 (4-arrow HUD + control path): GREENFIELD. `lib/hmi/dial-selector.cjs`
  and a keyboard handler do NOT exist. Closest precedent to mirror: the F.7 branch in
  selector-dispatcher.cjs:732. The two axes already exist: investment_level + POSTURE_IDS.
- BCH-PERSONA / BCH-17 (ignite prior): read role_blend (5 LOCAL sites confirmed), degrade to
  canonical_role scalar, else cold-start neutral (larry-extended.md:103-108). Seed dial
  default + the `0.30*investment_level` problem_type_bind term (f-selector-ranker.cjs:289).
- BCH-18 (role_blend producer): RE-SCOPED - the producer already exists (room-birth.cjs:426).
  See section 3.
- BCH-LOG / calibration table: route through navigation.logMemoryEvent (navigation.cjs:100
  -> memory-events.cjs:502); add ONE event_type to the frozen EVENT_TYPES Set. PREFERRED:
  a dedicated LOCAL `calibration_observations` table via a new idempotent
  `initCalibrationSchema(db)` co-located in the memory-ops.cjs family (NOT lazygraph-ops.cjs).
- BCH-12 (badge): single seam at render-v2.cjs:199-205; drive color from composed posture
  instead of `jtbd`; render() needs a `posture` arg (signature change). CLI has only 5
  colors - map 3 postures into them (pull_back->red, hold->yellow, push_forward->green/cyan);
  BLUE/BLACK/WHITE are HTML/Mondrian-only (visual-ops.cjs DS_HEX).

## 3. Falsified / corrected claims and what they change

- GAP 1 (BCH-18) is stale. Re-scope BCH-18 from "add the missing writeUserMdAtomic producer"
  to "compute a weighted blend upstream and thread it to `opts.roleBlend`." Mechanically:
  set a single-axis blend `{ <canonical_role>: 1.0 }` from the dual-path/shallow-doc scalar,
  mirroring `persona-override.cjs:280-281` which already does `role_blend[key] = 1.0`. The
  degrade test (BCH-18) stays valid: with no blend, fall back to canonical_role scalar.
- GAP 2 is stale. Remove "not authoring room-blueprints.json" from the SPEC non-goals; the
  file exists and birthRoom consumes it. The blueprint-family "HOW" leg can be IN scope if
  desired (it is no longer blocked), though it remains optional for the deterministic Wave 1.
- nodes schema home (MG-12): do NOT co-locate the calibration table in lazygraph-ops.cjs
  (reduced legacy: id/type/properties only). Find the authoritative 9-column nodes CREATE
  (likely node-insert.cjs or room-db.cjs) before placing schema.
- statusline badge surface (UIC-10): the operator/posture statusline slot is renderRow2:149-150,
  not renderRow1. Put any statusline posture badge there.
- trigger_tier read site: read it off the field that insight-sensors.cjs:294 wrote, not
  navigation-engine.cjs.
- Part 8 caution: if calibration is stored AS memory_event nodes (not a separate table),
  `findRecentChanges` is called INSIDE buildBrainPacket (packet.cjs:330) and would sweep
  them into the packet. A dedicated table is structurally invisible to buildBrainPacket -
  strongly preferred for BCH-14 to hold by construction rather than by an added filter.

## 4. Per-requirement implementation approach (Wave 1)

- BCH-S1: introduce ONE canonical per-turn investment value. Decide (Q5) whether the ranker
  reads the prompt dial or the prompt reads investment_level; until resolved, LOG both and
  measure divergence (a memory_event at f-selector-ranker.cjs:394 capturing both). Touches:
  projections.cjs, f-selector-ranker.cjs. Turns green: test-bch-01-ownership (ownership
  invariant) once the single number is the source.
- BCH-16 control path: find the escape_hatch parse site (Q3) where typed "just tell me" is
  caught pre-compose; write the keypress `register_override` into the SAME scratch the
  compose step reads at turn top. Touches: new lib/hmi/dial-selector.cjs, the compose entry.
  Turns green: test-bch-16-keypress-latency.
- BCH-10 HUD: pure module lib/hmi/dial-selector.cjs (input = register + keystroke; output =
  {investment_level, posture}); wire as shape 'F.7-dial' in selector-dispatcher.cjs pickShape
  (mirror :732). Turns green: test-bch-10-register-hud.
- BCH-17 ignite prior: at session start read role_blend -> seed dial default + the 0.30*inv
  term. Student top -> ASK-leaning + teaching density (<0.4 branch); founder/investor top ->
  TELL-leaning + terse. Touches: f-selector-ranker.cjs (consume), the session-start read.
  Turns green: test-bch-17-ignite-persona (+ adversarial founder twin).
- BCH-18 producer: single-axis blend from canonical_role at the birth caller, threaded to
  opts.roleBlend (producer already at room-birth.cjs:426). Touches: the birth caller /
  shallow-doc path. Turns green: test-bch-18-persona-write (+ degrade on canonical_role only).
- BCH-12 badge: add posture arg to render-v2.render(); posture-first color lookup falling
  back to jtbd. Touches: render-v2.cjs:115-122 (sig) + :199-205 (gate). Turns green:
  test-bch-12-color-register (no praise key).
- BCH-04 / BCH-LOG: new initCalibrationSchema + one EVENT_TYPES string + a thin navigation
  re-export that also emits a scalar memory_event audit marker. Touches: memory-ops.cjs
  (schema), memory-events.cjs (EVENT_TYPES), navigation.cjs (re-export). Turns green:
  test-bch-04-shadow-log, test-bch-14-part8-egress.

## 5. Open machinery questions (Q1-Q13) for /gsd-plan-phase

HIGH (gate Wave 1):
- Q1: does every conversational turn pass through decide()/resolveFireSkill? Likely YES - the
  UserPromptSubmit hook emits a NAVIGATION DECISION every turn (observable in this session) -
  but confirm SEAM 3's :466-468 site is on that per-turn path, not only the chain path.
- Q2: where can two model calls be sequenced per turn (MCP server bin/mindrian-mcp-server.cjs,
  a hook, or the agent loop)? Drives the two-pass build.
- Q3: the escape_hatch parse site the Up arrow must share (BCH-16). Find where "just tell me"
  is parsed pre-compose.
- Q5: the canonical per-turn investment value + is turn_count tracked at runtime or only
  implied by the prompt? This IS BCH-S1.
- Q6: stable turn_id + cheap node_delta at the Phase 109 chokepoint (a created_at window query).
- Q8: role_blend producer output shape. RECOMMENDED: single-axis `{top_role: 1.0}` (mirror
  persona-override.cjs:280); richer weighting deferred.
- Q11: hook contract - ride the existing UserPromptSubmit/SessionStart hooks; avoid double-fire.

MEDIUM (Waves 2-3 / cross-surface):
- Q4 (raw-key input loop on CLI; Desktop/Cowork have no keyboard - HUD degrades read-only).
- Q7 (is posture available to render-v2 on every conversational turn or only /mos output).
- Q9 (canonical_role values align 1:1 with the 7 role_blend keys?).
- Q10 (CIRS born-wired registration: does the modifier + dial shape + calibration log need
  connector-registry entries; will it trip build-connector-registry.cjs --check).
- Q12 (AUC_MIN 0.65 / SLOPE_MIN 0.15 empirical check once Wave-2 shadow data exists).
- Q13 (degraded named badge [BUILD]/[CHALLENGE] injection point on non-TTY Desktop/Cowork).

## 5b. HIGH open questions RESOLVED against live code (2026-06-24, in-loop recon)

- Q1 (does every turn hit decide?): YES. `scripts/intent-classifier.cjs` is the
  UserPromptSubmit hook; it reads the quadruple + USER.md and calls
  navigation-engine.decide(), rendering the NAVIGATION DECISION block every turn. SEAM 3's
  466/468 site IS on the live per-turn path.
- Q11 (hook contract): ride the existing UserPromptSubmit hook (intent-classifier.cjs). Do
  NOT add a new hook; the observation emit + compose must thread through this one.
- Q3 (escape-hatch parse site): THERE IS NONE in code. "just tell me" / "bottom line" live
  only in PROMPT prose (larry-server-instructions.md:30) and the directive-envelope map
  (directive-envelope.cjs:74). The model reads them; the engine never parses them at a
  runtime gate. CONSEQUENCE: BCH-16's "the Up arrow shares the same pre-compose gate as the
  typed phrase" has no existing gate to share - that synchronous control path is greenfield,
  not a hook-in. This is a re-scope flag for BCH-REG/16.
- Q5 (canonical investment value + turn_count): investment_level is computed only INSIDE the
  ranker (f-selector-ranker.cjs:394, from framework_invocations/10). There is NO runtime
  turn counter feeding the engine (only venture-shape-nudge derives a turn_count from
  venture_classified nodes). The Ask-Tell dial is pure prompt prose. CONSEQUENCE: BCH-S1 is
  not wiring - it must BUILD a canonical runtime investment value (and likely a turn
  counter), and DECIDE which number is canonical. This is the navigator's Q5 design call,
  the true first move of Wave 1.

Net: three Wave-1 seams the bundle billed "deterministic, ship now, low risk" (BCH-S1, the
BCH-REG control path, BCH-S5 turn-gating) need runtime state that does not exist yet. Only
BCH-14 (Part 8 fence) and the BCH-12 badge seam (signature change on render-v2) are buildable
without new runtime substrate. BCH-14 landed test-first as the first real green (2026-06-24).

## 6. Biggest risk to Wave 1

The persona leg (BCH-17/18) rests on premises the bundle marked as gaps that are actually
SHIPPED. If the plan is executed against the stale PART 6, BCH-18 builds a duplicate producer
and the SPEC wrongly defers room-blueprints.json. Re-derive the persona scope against
room-birth.cjs:426 and data/room-blueprints.json BEFORE planning Wave 1. Second risk: SEAM 1
(BCH-S1) assumes the dial and investment_level are one number; they are two today, so the
"honest first commit" must first DECIDE which is canonical (Q5), not just wire what exists.
