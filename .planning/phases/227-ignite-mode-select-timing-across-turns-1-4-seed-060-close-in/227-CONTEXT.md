# Phase 227: Ignite / mode-select timing across turns 1-4 - Context

**Gathered:** 2026-07-15 (--auto mode, single pass)
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the two remaining open items from `intern-w1-mode-gate-skip.md` (resolved) and
`ignite-frontdoor-bypassed-methodology-overfire.md` (partially-fixed), plus SEED-056's
handed-off ignite-naming gap. Five locked requirements per `227-SPEC.md`: a session-start
firing checkpoint (advisory-only), a systemic sweep with trivial fixes, a scripted Test-4
regression fixture, ignite naming + Hooked-Model reasoning in `larry-personality.md`, and
`conversation-mode` Mode 3 routing through ignite. All "what/why" is locked in SPEC.md;
this file resolves "how".

</domain>

<decisions>
## Implementation Decisions

### Req 1: Firing checkpoint mechanism
- **D-01:** Do NOT reuse `lib/core/card-fire-sidechannel.cjs`'s existing store as-is - it is
  deliberately turn-scoped (~10 minute TTL, "generous for slow turns") for a DIFFERENT purpose
  (catching a skip within the same Stop-hook cycle). A session-start lane-pick record needs to
  survive far longer than 10 minutes into a session. Mirror the PATTERN (session-scoped,
  atomic tmp-file+rename writes, never-throw, size-capped, bare-path-keyed), not the same file.
- **D-02:** New module `lib/core/mode-select-sidechannel.cjs` exporting `recordLanePick(opts)`
  / `readLanePick(sessionId)`, same never-throw / atomic-write / size-cap discipline as
  `card-fire-sidechannel.cjs`, but its own store file under `~/.mindrian/` with a
  session-lifetime TTL (not 10 minutes - use a generous ceiling, e.g. 24h, matching how other
  session-scoped local state in this repo is bounded).
- **D-03:** `recordLanePick` is called from wherever `skills/conversation-mode/SKILL.md`'s F.1
  gate actually resolves at runtime - since that gate reuses `renderShapeF1` / `pickShape`
  (per the skill's own body text), the call site is the SAME shared trailer door
  `lib/hmi/selector-dispatcher.cjs`'s `pickShape` already uses for the existing sidechannel;
  add the new recorder call there (additive, not a replacement) plus at whatever code path
  handles the "explicitly stated a default, no card fired" branch (so BOTH resolutions count
  as "recorded", only the silent third case does not).
- **D-04:** New `doctor.cjs` module: registry row `{ id: "mode-select-checkpoint",
  introduced_version: <next release version>, cadence: "always", flag: null,
  fix_supported: false, runner: "lib/core/doctor/mode-select-checkpoint-module.cjs" }`.
  `cadence: "always"` (not "once") because a silent skip is possible in ANY session, not a
  one-time migration heal. `fix_supported: false` - there is nothing to auto-remediate (you
  cannot retroactively fire a card for a turn that already passed); the check is diagnostic
  only, matching several existing check-only classes (D, F, K, L, M, S).
- **D-05:** `check(ctx)` calls `readLanePick(ctx.sessionId)`; if no record exists AND the
  session has had at least one user turn (avoid false-positive on a doctor run that is itself
  turn 1, before conversation-mode's gate would even have had a chance to fire), return
  `{status: 'warn', detail: 'mode-select lane pick not recorded this session - possible
  silent skip'}`; otherwise `{status: 'ok', detail: '...'}`.

### Req 2: Sweep heuristic + report location
- **D-06:** "Methodology skill" for sweep purposes = every `skills/*/SKILL.md` whose
  frontmatter declares a non-empty `sensor_triggers` array (auto-fire capable by construction)
  OR whose `description` field uses broad/casual language likely to match a conversational
  aside rather than explicit intent (the exact `trending-to-absurd` pre-fix failure mode).
  Skills with `sensor_triggers: []` and an explicit-intent description (already matching the
  post-fix `trending-to-absurd` shape) are `clean` by inspection, still listed in the report.
- **D-07:** Findings report: `.planning/phases/227-.../227-SWEEP-FINDINGS.md`, one row per
  skill scanned: `skill | sensor_triggers | description-tightness | verdict (clean /
  fixed-trivial / deferred-real-work) | fix-commit (if applicable)`.

### Req 3: Test-4 fixture approach
- **D-08:** Structural/static assertions, NOT a live model conversation replay - matches this
  repo's existing test convention (`tests/test-209-declared-implies-wired.cjs` and siblings
  drive the actual checker functions and read real files, never simulate an LLM turn).
  `tests/test-227-frontdoor-restraint.cjs` asserts: (a) `skills/trending-to-absurd/SKILL.md`
  frontmatter `sensor_triggers` is still `[]` (regression floor on the 2026-06-24 fix); (b) its
  `description` field does not loosely match casual-opportunity phrasing (a small denylist
  regex, e.g. no bare "opportunities"/"trends" without an explicit "absurd"/"extreme" qualifier
  nearby); (c) `lib/core/trending-to-absurd/orchestrator.cjs`'s horizon logic still honors a
  single requested horizon rather than unconditionally forcing all three (read the function,
  assert on its branching, not its runtime output); (d) `skills/conversation-mode/SKILL.md`
  Mode 2 still contains the "scaffold follows the learner" restraint text (a substring check).
  No opening-compliment assertion is scriptable (that is model behavior, not a static
  artifact) - note this honestly in the test file's header comment as a known coverage gap,
  matching this session's established discipline of naming gaps rather than silently dropping
  them.
- **D-09:** Register in `lib/memory/run-feynman-tests.cjs` TEST_FILES (permanent regression
  floor, same convention Phase 224/226 used).

### Req 4: larry-personality.md section placement
- **D-10:** New `## Ignite and the mode-select gate (Hooked-Model timing)` section, placed
  near the existing Voice/Elevation sections (a peer-level doctrine section, not buried in a
  sub-bullet). Content is the exact framing locked in SPEC.md's Background section and
  Requirement 4: Prompt-not-Investment, ambiguous-vs-signaled routing rule (cites
  `detect_dual_path` as the existing precedent), and the silent-skip failure mode named
  explicitly as what Requirement 1's checkpoint catches.

### Req 5: Mode 3 routing + 223 seam
- **CORRECTION (post pattern-mapper spot-check, verified directly against live
  `commands/ignite.md`):** the original D-11/D-12 below described Gate B1 as "three clean
  options + free-text" (solution-looking-for-problem / domain-or-interest-to-explore /
  defined-venture). That phrasing does not exist anywhere in the file. The REAL Gate B1 is a
  **four-door, persona-first single card** ("Who are you arriving as?"): Door 1 Persona pick
  (6 sub-options: researcher/student/founder/operator/investor/domain_expert), Door 2 CV
  upload, Door 3 Hypothesis, Door 4 Free-Text. Revised decisions below replace the originals.
- **D-11 (revised):** `skills/conversation-mode/SKILL.md` Mode 3's body text changes from
  directly instructing "invoke `/mos:new-project`" to routing through ignite's **Directive /
  Imperative path** (`## Entry Routing`, path B: "Imperative ('make me a room for X'): treat
  as `--express` with the stated context as blueprint seed"). This is the correct
  destination, not the B1 four-door card: Gate B1's own text states "Directive paths with a
  determinable role/venture (--express with strong context...) bypass B1" - since Mode 3 is
  reached only after conversation-mode's own Mode 2-to-Mode-3 transition already establishes
  the navigator's intent, re-asking the full four-door persona pick would be redundant
  friction (the same Hooked-Model Prompt-not-Investment principle Req 4 documents). Mode 3
  routes into ignite's `--express` Directive path with the already-established conversational
  context as the blueprint seed, which proceeds straight to Gate B2 (Blueprint) - the actual
  room-creation step `/mos:new-project` was reaching for directly.
- **D-12 (revised):** The "light seam for a future 223 entry point" (SPEC boundary: no
  223-specific code) now means: Gate B1's four-door structure is completely UNTOUCHED (no
  fifth door, no persona added, no reference to Phase 223 anywhere in the changed text) -
  Mode 3 does not touch B1 at all, it enters via the Directive path. The "seam" is that the
  Directive/`--express` path already treats "the stated context" generically (not
  Mode-3-specific), so a future 223 surface could supply its own directive input through the
  SAME path without 227 needing rework. Any future 223-specific ENTRY (e.g. a new Door on B1)
  is 223's own phase to add, not 227's.

### Claude's Discretion
- Exact wording/length of the `larry-personality.md` Hooked-Model section (content locked,
  prose style is discretion).
- Exact regex/denylist terms for the sweep's description-tightness heuristic (D-06) - the
  planner/executor may refine the specific pattern list as long as it demonstrably catches the
  `trending-to-absurd` pre-fix case and does not false-positive on already-clean skills.
- Whether the new `mode-select-sidechannel.cjs` module shares helper code with
  `card-fire-sidechannel.cjs` via a small shared utility, or is fully standalone - either is
  acceptable as long as the TTL/store-file separation (D-01/D-02) holds.

</decisions>

<specifics>
## Specific Ideas

No product/UI references - this phase is entirely backend/doc infrastructure (a doctor check,
a sweep report, a test fixture, two doc edits). No visual design surface.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked requirements
- `.planning/phases/227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in/227-SPEC.md`
  - all 5 requirements, boundaries, constraints, and acceptance criteria. This file's decisions
  are "how"; SPEC.md's are "what/why" and are NOT open for renegotiation during planning.

### Root-cause sources (read before touching any related code)
- `.planning/debug/resolved/intern-w1-mode-gate-skip.md` - the confirmed 3-gap root cause for
  the silent-skip defect; gaps 1-2 already fixed, gap 3 (this phase's Req 1) is candidate fix
  direction 3 verbatim in its "Required Code Changes" section.
- `.planning/debug/ignite-frontdoor-bypassed-methodology-overfire.md` - the confirmed root
  cause for the trending-to-absurd over-fire; FIX 1/FIX 2 already landed (commit `7868dfbb`);
  `fix_remaining` items 2 and 4 verbatim are this phase's Req 2 and Req 3.

### Existing patterns to mirror, not literally reuse
- `lib/core/card-fire-sidechannel.cjs` - the sidechannel pattern (atomic writes, never-throw,
  size cap, session-scoped read) Req 1's new module mirrors; do NOT reuse its actual store file
  or 10-minute TTL (see D-01).
- `data/doctor-modules.json` + any existing `cadence: "always"`, `fix_supported: false` module
  row (e.g. class D/F/K/L/M/S entries) as the shape template for Req 1's new registry row.
- `tests/test-209-declared-implies-wired.cjs` - the structural/static test convention Req 3's
  fixture follows (read real files, drive real checker functions, never simulate an LLM turn).
- `skills/trending-to-absurd/SKILL.md` (post-fix, `sensor_triggers: []`) and
  `lib/core/trending-to-absurd/orchestrator.cjs` - the confirmed-clean reference shape Req 2's
  sweep heuristic (D-06) is calibrated against.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/hmi/selector-dispatcher.cjs`'s `pickShape` trailer door - the existing call site for
  `recordReachedGate`; Req 1's `recordLanePick` call is added here additively (D-03).
- `scripts/doctor.cjs`'s module-registry architecture (one `data/doctor-modules.json` row + one
  `lib/core/doctor/<id>-module.cjs` runner, no script-body edits) - Req 1 is a pure extension,
  zero changes to `scripts/doctor.cjs` itself.

### Established Patterns
- Advisory-only enforcement (Phase 210's reverted pattern) - every new signal this phase adds
  must default to WARN/exit-0, never a new hard-fail (SPEC Constraint, binding).
- doctor.cjs's `check(ctx)` / `fix(ctx)` module contract, enforced by
  `tests/test-doctor-module-contract-parity.cjs` (D-03 gate) - Req 1's new module must satisfy
  this contract exactly (explicit `fix_supported: false`, valid status vocabulary, non-empty
  `detail`).

### Integration Points
- `lib/hmi/selector-dispatcher.cjs` (Req 1 write site)
- `scripts/doctor.cjs`'s module loader (Req 1 read site, via `data/doctor-modules.json`)
- `skills/conversation-mode/SKILL.md` (Req 5 routing text; Req 3 restraint-text regression
  target)
- `skills/larry-personality/SKILL.md` (Req 4 new section)
- `commands/ignite.md` `## Entry Routing` Directive/Imperative path (Req 5's actual
  destination, per the D-11 correction above - NOT Gate B1, which stays fully untouched)

</code_context>

<deferred>
## Deferred Ideas

- Fixing every skill the sweep (Req 2) finds beyond the trivial bar - explicitly out of scope
  per SPEC boundary; deferred to its own follow-up phase or seed.
- `orchestrator.cjs`'s code-level "honor the chosen horizon" fix - named in the source debug
  file's `fix_remaining` item 1 but NOT carried into this phase's ROADMAP scope (only items 2
  and 4 were). Stays open for its own pickup.
- The parked Brain pedagogy write (`14-BRAIN-PEDAGOGY-WRITE.md`) - needs an admin/write key,
  explicitly out of this phase's scope per SPEC.
- Any Phase-223-specific ignite entry point - 223 has zero confirmed ignite surface today;
  only a generic, non-223-referencing seam is in scope (D-12).

</deferred>

---

*Phase: 227-ignite-mode-select-timing-across-turns-1-4-seed-060-close-in*
*Context gathered: 2026-07-15*
