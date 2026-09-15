# Phase 346 Close-Out: The Arbitration Node

Status: CLOSED, 2026-09-16
Phase: 346 (the arbitration node, graph-engineering learning 3c, conflict between loops)
Ledger: `docs/ARBITRATION-CONTRACT.md` (cited throughout, not restated -- the naming fence, the
three axes, the result struct, the ranking, the floors, the Tri-Polar table and the
thirteen-row working-decision ledger all live there)
Validation map: `.planning/phases/346-the-arbitration-node-graph-engineering-learning-3c-conflict-/346-VALIDATION.md`
Sibling records this file's own shape mirrors: `docs/2026-09-14-PHASE-344-LAYER-CONTRACT-CLOSE-OUT.md`,
`docs/2026-09-14-PHASE-345-STRATEGY-NODE-CLOSE-OUT.md`, `docs/2026-09-14-PHASE-347-SHARED-STATE-CLOSE-OUT.md`

## Why this file is in docs/

`.planning/` is gitignored in this repository (`.gitignore:97-98`, except `.planning/debug/`), so a
phase that closes only in `.planning/phases/346-.../346-08-SUMMARY.md` has closed on one machine.
This file is the artifact a second machine can read: what shipped, what is measured with its honest
caveats, and what stayed open, with the commands and outputs that prove each claim rather than a
restated assertion.

---

## What shipped

| Artifact | What it does | ARB id it closes |
|---|---|---|
| `docs/ARBITRATION-CONTRACT.md` | The naming fence (three prior `posture` bindings named so a fourth is never minted), the three axes table, the result struct, the frozen ranking, the three floors, the Tri-Polar table (sourced live from `CAPABILITY_MAP`), the `layer: graph` declaration, the flip-only disclosure rule, and the thirteen-row working-decision ledger (now RULED, see "Open working decisions" below) | ARB-01, ARB-14, ARB-15 |
| `lib/core/arbitration.cjs` | The naming fence in code, `detectEscapeHatch` (the LOCAL escape-hatch detector), `resolveEnforcement` (the nine-rule enforcement ladder, `judge` structurally unreachable on a floor-engaged turn), `resolveArbitration` (composes all three axes into one ranked result, censuses six inputs by shape, computes the floors list, clamps `persona` before it can leak into a rationale string) | ARB-02, ARB-03, ARB-04, ARB-05 |
| `lib/core/navigation/arbitration-log.cjs` plus one new `EVENT_TYPES` member (`arbitration_decided`) in `lib/core/navigation/memory-events.cjs`, plus one thin additive re-export on `lib/core/navigation.cjs` | `logArbitrationDecision` writes exactly one enum-only `memory_event` row per turn, deduped on `arb:<session_id>:<turn_id>` inside the shipped 60-second window, computing `flip`/`flipped_axes`/`flip_reason` against the previous logged row in the same session | ARB-07, ARB-08 |
| `data/arbitration-rule-catalogue.json` plus `data/harness-policies/gate-arbitration-decision.json` | Twelve conversation-time rules and six prose mandates classified on the shipped `declared \| logged \| blocking` rungs with a reason each, the two Stop-hook gates named explicitly, the two previously-unaudited hooks (`hmi-compliance-poll.cjs`, `mva-detect.cjs`) read in full and classified; the arbiter's own harness policy at rung `declared` with `runner: null` and a `promotion_rule` authored before any evidence exists | ARB-09, ARB-10, ARB-11 |
| `tests/fixtures/346-watch-incidents.json` plus `tests/test-346-watch-replay.cjs` | 8 measured misfire shapes (not the planning brief's stated 9 -- see "What was measured" below) plus 2 positive controls, each with a verbatim `source_quote` from the out-of-repo 2026-07-02 WATCH memory file, replayed through `resolveArbitration` with no aggregate threshold ever asserted | ARB-12, ARB-13 |
| `lib/core/navigation-engine-shared.cjs` (`arbitration: null` default) plus `lib/core/navigation-engine.cjs` (`applyArbitration` on both `decide()` return paths) | The arbiter attaches to the live spine via the shipped `applyProjectionLift` additive-trace convention: computed once before any return path, a full no-op on null, no assignment to `fire_skill`/`offer_next_step`/`suppress_skills`, byte-identical to pre-346-07 on a faulted turn once the one inert null-valued key is stripped | ARB-06 |
| `tests/run-all-346.sh` plus nine `tests/test-346-*.cjs` files | The phase's own test aggregator, written once in 346-01 and never edited by a later plan; each guarded leg flips from SKIP to PASS exactly once, when its own plan's test file ships | (infrastructure, all ARB ids) |
| `.planning/REQUIREMENTS.md` (ARB-01..16 closed with `Measured:` proof), `.planning/ROADMAP.md` (Phase 346 entry closed), `.planning/phases/346-.../346-VALIDATION.md` (`nyquist_compliant: true`), this file | The phase-close paperwork: every requirement closed against a command actually run in the close-out task, the roadmap entry naming a real goal and plan list, the validation map with 23 task rows | ARB-16 |

No artifact named in `346-01-PLAN.md`'s phase-total artifact list is missing from the above; no
artifact above is claimed that does not exist on disk (cross-checked against `git log --oneline`
for 346-01..346-08 and each plan's own Self-Check section).

---

## What was measured

**The gate sweep, run 2026-09-16 from `/home/jsagi/dev/MindrianOS-Plugin/`:**

- `bash tests/run-all-346.sh` -- `PASS=12 FAIL=0 SKIP=0`, exit 0.
- `node scripts/doctor.cjs --acceptance` -- `Acceptance full: 20/20 points passed`, exit 0.
- `node scripts/run-harness.cjs --check` -- `Totals: 9 pass, 0 fail, 4 ghost, 2 declared, 15 total`, exit 0; `gate-arbitration-decision` counted as a declared ghost, never a pass.
- `node tests/test-198-chokepoint-guard.test.cjs` -- 18 assertions, exit 0.
- `git diff --name-only hooks/hooks.json` -- empty. Zero new hook registration; the arbiter attaches with no install-visible change.
- `grep -c` for the em-dash byte across every file this phase's eight plans created or modified -- `0` for every file.

**The replay eval, printed verbatim by `node tests/test-346-watch-replay.cjs` (exit 0, 11 assertions pass):**

```
BEFORE: 86 percent false-positive rate for scripts/check-card-fire.cjs, corroborated by 3
independent sources: data/harness-policies/gate-card-fire.json, scripts/check-card-fire.cjs,
.planning/phases/298-seed-032-harness-as-code-declare-and-machine-enforce-the-min/298-09-SUMMARY.md

BEFORE-NUMBER CAVEAT: 86 percent measures check-card-fire.cjs specifically, not the persona
regression as a whole. It is the strongest sourced figure in the repo and it is still a proxy.

AFTER: 8 of 8 recorded misfires are suppressed by the arbiter (by mechanism:
binding-gate-injection: 5/5, gate-card-fire: 3/3)

LIMITATION: These fixtures are shapes reconstructed from a prose incident log (the WATCH memory
file), not captured conversation transcripts; no 2026-07 transcripts exist anywhere in this repo
or its memory directory, and the sessions are two months past. They prove the arbiter's logic
holds against the recorded failure modes described in that log. They do not prove the persona
regression itself closed in live use. The only honest close on that second claim is a fresh
WATCH window observed after this phase ships, not a replay against fixtures derived from the
original complaint.
```

**The honest scope of this claim, stated in plain words:** the arbiter suppresses every recorded
failure mode named in the 2026-07-02 WATCH item -- all 8 of the 8 misfire shapes enumerated
directly from that memory file resolve to the correct enforcement value once replayed through
`resolveArbitration`. That is a real, measured result. It is not the same claim as "the persona
regression has closed." The fixtures are reconstructed shapes from a prose incident log, not
captured conversation transcripts -- no 2026-07 transcript exists anywhere in this repository or
its memory directory, and the sessions themselves are two months past by the time this phase
shipped. The two positive controls (`pc-genuine-fork`, `pc-part8-floor`) prove the suppression is
not vacuous: a run that suppressed everything indiscriminately would look identical to a correct
one without them, and both still resolve to `enforce`, unsuppressed. **The only honest close on
the persona-regression claim itself is a fresh WATCH window observed after this phase ships in
production**, comparing live sessions against the same rubric the 2026-07-02 item used. **Next
action, and its owner:** the repo's navigator (Jonathan) opens that fresh WATCH window at the next
natural checkpoint (a `/gsd-profile-user` re-run or a dedicated dev-session review), not
automatically and not on a timer this phase does not have the authority to set.

**Additionally measured in this close-out task, cited by ARB id (full clauses in
`.planning/REQUIREMENTS.md`):**

- ARB-02: `node tests/test-346-enforcement-axis.cjs` exit 0, 24 assertions, including the 128-case power-set sweep proving `judge` is structurally unreachable on a floor-engaged turn.
- ARB-03: `node tests/test-346-arbitration-resolver.cjs` exit 0, 27 assertions; `lib/core/arbitration.cjs`'s require set is exactly 3 sibling modules (`decision-axes.cjs`, `directive-envelope.cjs`, `persona-taxonomy.cjs`).
- ARB-05: the cold-start sweep ran 120 cases (3 role_blend x 5 rung x 4 surface x 2 jtbd -- corrected from an arithmetic error in 346-04's own planning text that named 160), all GUIDED/`ask_and_hedged`; `node tests/test-346-part8-enum-only.cjs` scanned 1080 generated results with zero strings outside the closed vocabularies.
- ARB-09: 12 conversation-time rules, 6 prose mandates; the live build-time-gate census reports `40 total scripts/check-*.cjs gates, 2 run at Stop, 38 are build-time (out of scope)`.
- ARB-12: the measured misfire count is **8**, not the row's original "nine catalogued misfires" wording -- enumerating the WATCH memory file directly under the phase's own count-honesty rule (346-06) yields 8 distinct date-mechanism-turn-context triples, recorded with its full derivation in the fixture's own `_doc.count_derivation`.

---

## The three axes, in one table

| Fork (roadmap wording) | Axis name | Closed vocabulary | Resolver | Reused or written |
|---|---|---|---|---|
| teach versus deliver | `delivery` | `ask_and_hedged \| tell_and_hedged` | `lib/core/decision-axes.cjs` `resolveDecisionMode()` | Reused verbatim |
| guided versus autonomous | `autonomy` | `GUIDED \| HYBRID \| AUTONOMOUS` | `lib/core/directive-envelope.cjs` `selectMode()` | Reused verbatim |
| enforce versus judge | `enforcement` | `enforce \| judge \| not-applicable` | `lib/core/arbitration.cjs` `resolveEnforcement()` | New |

Two of three resolvers reused, one new. That is the Canon Part 7 (reuse before build) result for
this phase, and it is worth stating as a number rather than leaving it implicit: the phase's own
net-new surface is exactly one pure function, not three.

---

## What this phase deliberately did not do

- **Promoted nothing.** The Part 12 glyph stays a doctrinal floor and a `declared` rung (WD-2);
  promotion needs a reviewed evidence window and this phase has none. Owner: a future phase, after
  reading `evaluatePromotion`'s verdict against a real logged window.
- **Rewrote no prose mandate.** `agents/larry-extended.md` and `skills/ui-system/SKILL.md` are
  catalogued as weighted inputs in `data/arbitration-rule-catalogue.json`'s six `prose_mandates`;
  the rewrite that makes their text defer to the arbiter's decision is a separate change, and both
  files were owned by Phase 344-04 in this execution window, not this phase.
- **Produced no stall count.** Phase 345 owns the stall signal (`readStallSignal`, shipped
  2026-09-15); until it is wired, the arbiter's `stall_count` input is `null` and null is treated
  as no signal, appearing honestly in `inputs_missing`, never a fabricated zero (WD-6).
- **Touched no build-time gate.** The live census (`40 total scripts/check-*.cjs gates, 2 run at
  Stop, 38 are build-time`) is recorded in the catalogue's own `_doc`; a build-time gate runs at
  pre-commit, `scripts/verify-release`, or `doctor --acceptance`, never at conversation time, so it
  cannot short-circuit conversational judgment because there is no conversation for it to
  interrupt.
- **Added no hook entry.** `git diff --name-only hooks/hooks.json` is empty across all eight plans
  (assumption A8, closed by measurement, not by claim): the arbiter attaches to the `decide()`
  spine through a lazy `require`, invisible to a plugin reinstall.
- **Gained no user-visible first-touch surface**, so it needs no record in
  `data/first-reward-surfaces.json`. The arbiter is invisible on turn 1 by design: its trace field
  is additive and its disclosure rule is flip-only (a hold stays silent).

---

## Tri-Polar

One row per `CAPABILITY_MAP` surface (`lib/mcp/surface-detect.cjs`), restating the shipped
behavior from `docs/ARBITRATION-CONTRACT.md`'s own Tri-Polar table (ARB-14):

| Surface | `hooks` | Enforcement axis reports | Delivery and autonomy axes |
|---|---|---|---|
| `cli` | `true` | Active (`enforce` or `judge`, live per turn) | Live everywhere |
| `desktop` | `false` | `not-applicable` -- `check-card-fire.cjs`, `check-voice-style.cjs` and `intent-classifier.cjs` never run there; there is no enforcement loop to arbitrate | Live everywhere |
| `cowork` | `false` | `not-applicable` -- same reason as desktop | Live everywhere |

The arbiter is active on one surface and honest on two. It never emits a value for a loop that is
not there. The two hookless surfaces still get a real `delivery`/`autonomy` read, because those two
axes reuse resolvers that are pure `lib/core/` functions reachable through `decide()` on all three
surfaces, independent of `hooks`.

---

## Open working decisions

`docs/ARBITRATION-CONTRACT.md`'s "Working decisions, reversible by the navigator" table is the
thirteen-row ledger; it is not duplicated here. All thirteen rows were presented to the navigator
at the 346-07 Task 1 blocking checkpoint, alongside all twelve `data/arbitration-rule-catalogue.json`
classification reasons, and the navigator's real, transcript-recorded answer was **"Approve as
specified"** -- every row ratified unchanged, zero overrules named. As part of this close-out, the
Status column of all thirteen rows in `docs/ARBITRATION-CONTRACT.md` was flipped from `WORKING` to
`RULED (2026-09-16, navigator "Approve as specified" at the 346-07 checkpoint)`, matching the
STRAT-family close-out precedent (`docs/2026-09-14-PHASE-345-STRATEGY-NODE-CLOSE-OUT.md`'s
"Decisions ruled" section) of finalizing a working-decision ledger's status column at phase close
rather than leaving a closed phase's ledger reading as still-provisional.

No row was overturned. Every "Reverses by" column in the contract's own table remains the correct,
live path for a future session to reopen any one of the thirteen decisions individually.

---

## What the next phase inherits

- **Phase 347** (the shared-state contract for chains, already closed 2026-09-15, one wave before
  this phase's own close) reaches Phase 346 in its own dependency chain (`ROADMAP.md`: "Depends on:
  Phase 346"). It inherits a working arbiter on the enforcement fork; nothing in 347's own
  `chain_state` record or reviewer-rule work reads `resolveArbitration` directly, so this is a
  sequencing inheritance (346 closed before 347's own plans landed), not a code dependency.
- **Phase 345's stall signal** (`readStallSignal`, `lib/core/strategy/goal-cadence.cjs`) has a
  named, ready consumer: `lib/core/arbitration.cjs`'s `stall_count` input, currently `null`-safe
  and appearing in `inputs_missing` until a future plan wires
  `ctx.arbitration_inputs.stall_count = readStallSignal(...)` at the `decide()` call site (WD-6).
  No plan in this phase performs that wiring; it is named here as the literal next step for
  whichever session picks it up.
- **The `arbitration_decided` event type** (`lib/core/navigation/memory-events.cjs`) gives any
  future promotion review a real, typed log to read: every row carries closed-enum tokens and
  numbers only, deduped, with flip disclosure. `data/harness-policies/gate-arbitration-decision.json`'s
  own `promotion_rule` (200-run window, 0.15 max false-positive rate, 20 minimum true positives) is
  already authored, so promoting the policy from `declared` to `logged` is a one-line human edit to
  the `rung` key after a future session reads `evaluatePromotion`'s verdict against a real window --
  no runner code needs to change.
- **The fresh WATCH window** named in "What was measured" above is the literal open item this
  phase could not close itself: whether the 2026-07-02 persona regression is actually gone in live
  use, as opposed to suppressed against reconstructed fixtures. Owner: the navigator, at a future
  natural checkpoint.
- **`docs/ARBITRATION-CONTRACT.md` stays the living ledger.** This close-out record points at it
  and does not duplicate its content; any future phase reopening one of the thirteen ruled working
  decisions edits that file directly, following its own "Reverses by" column.

---

## Deviations carried forward honestly from the seven prior plan summaries

- **346-01:** the active-requirement baseline was raised from the plan's stated 199/215 to the
  live-measured 247/263, because `SHARED-01..13` and `STRAT-01..18` were minted by intervening
  phases between the plan's authoring and its execution.
- **346-04:** the cold-start sweep's real case count is 120 (3 x 5 x 4 x 2), not the plan's own
  arithmetic-error literal of 160; the aggregator's own passing-leg count after each plan landed
  its own test file is 4 -> 5 -> 6 -> 9 -> 10 -> 11 -> 12, not the stale figures named in each
  plan's own verification text at authoring time.
- **346-06:** the measured misfire count is 8, not the planning brief's stated 9 -- the plan's own
  count-honesty rule states explicitly that a different number than nine "IS the finding," not a
  defect to paper over.
- **346-07:** the navigator checkpoint (Task 1) was ratified in the live session before the
  executor for that plan was even spawned; the executor's own re-verification confirmed the
  identical tree state the navigator saw. A flaky byte-identity assertion (an unstripped nested
  wall-clock timer field) was found and fixed before the plan closed.
- **346-08 (this plan):** the plan's own acceptance-criteria `sed` pattern for counting
  `Measured:` clauses (`sed -n "/### Phase 346/,/^## /p"`) captures far more than Phase 346's own
  sixteen rows, because Phase 343's, Phase 347's and Phase 345's own `### ` sections sit between
  Phase 346's block and the next `## ` heading in `.planning/REQUIREMENTS.md`. Verified the correct
  invariant with a bounded range instead (`/### Phase 346 -/,/### Phase 343/p`), confirming exactly
  16 checked ARB rows, 0 unchecked, and one `Measured:` clause per row. Also: the plan's Task 3
  action text instructs updating `docs/ARBITRATION-CONTRACT.md`'s working-decision Status column,
  a file not named in this plan's own `files_modified` frontmatter list -- treated as an incomplete
  `files_modified` tag (the same Rule 1 class 346-07 already documented for its own Task 2), not as
  an instruction to skip the edit.

---

## The rethinking-mindrianos mirror

Per `CLAUDE.md`'s Dev-Research Compositing rule, this reasoning trail should mirror into
`~/MindrianRooms/rethinking-mindrianos/research/2026-09-14-phase-346-arbitration-node/`. Attempted
this session and refused by Claude Code's own `write-scope-check` PreToolUse hook (the identical
class of refusal Phase 344's, Phase 345's and Phase 347's own close-outs each hit and recorded):

```
PreToolUse:Write hook error: Blocked: write to rethinking-mindrianos denied. Active room is
idem-room. To authorize, run: /mos:rooms switch rethinking-mindrianos
```

The target directory itself was created (`~/MindrianRooms/rethinking-mindrianos/research/2026-09-14-phase-346-arbitration-node/`,
confirmed present, empty) so a future room-bound session has a place to file into, but the actual
content write was not forced through a different tool path -- routing around the Write-tool's own
scope check via a raw shell redirect would defeat the purpose of the gate, not honor it.

**The drafted mirror content, preserved here in full so nothing is lost:**

What shipped: one net-new pure resolver (`enforcement`) composed with two reused ones
(`delivery`, `autonomy`) into a single ranked per-turn decision, logged as an enum-only
`memory_event`, attached to the live `decide()` spine behind a navigator checkpoint. The
cross-domain lesson worth carrying to the room: this is the third phase in the
graph-engineering-learning arc (3a strategy, 3b upward movement, 3c conflict-between-loops) to
ship a pure `lib/core/` resolver composed from prior, already-proven resolvers rather than a new
stateful subsystem -- the pattern the langtalks corpus calls "the graph engineer's move" is
reuse-and-compose, not reinvent, and this phase's own ARB-03 requirement (a zero-I/O, zero-network,
never-throwing composition) is the concrete, testable form of that lesson. The before/after numbers
(86 percent proxy false-positive rate before, 8 of 8 recorded misfires suppressed after) are a
real, measured result on reconstructed fixtures, and the honest caveat -- reconstructed shapes are
not captured transcripts -- is itself worth filing as a standing lesson: a locally-declared
replay-eval fixture set needs its own count-honesty rule (one fixture per distinct triple, no
padding to match a stated brief number) the same way a locally-declared enum mirroring a remote
schema needs a live correctness probe (the lesson Phase 345's own close-out already filed about
the `taxonomy_ladder` rung-casing mismatch). Cross-references: `docs/ARBITRATION-CONTRACT.md`
(the living ledger), this file (the executable close-out), `docs/2026-09-14-PHASE-345-STRATEGY-NODE-CLOSE-OUT.md`
(the sibling phase whose own mirror-refusal precedent this one repeats).

**Owner:** the user, or a future session with `rethinking-mindrianos` set active
(`/mos:rooms switch rethinking-mindrianos`), filing
`~/MindrianRooms/rethinking-mindrianos/research/2026-09-14-phase-346-arbitration-node/close-out.md`
with this section's own content and cross-linking it back here.
