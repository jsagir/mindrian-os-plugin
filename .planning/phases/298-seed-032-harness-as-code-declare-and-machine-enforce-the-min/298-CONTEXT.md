# Phase 298: SEED-032: Harness-as-Code - Declare and Machine-Enforce the MindrianOS Agent Harness - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the locked Phase 167 harness manifest (v1: a 3-map digest plus 4 runtime surfaces) to
v2, add one idempotent policy runner, build the SEED-037 derive-health gate, and make the Larry
persona the manifest's first declared consumer, so that the harness MindrianOS already runs is
declared, machine-enforced and re-runnable. Phase 297 (SEED-031/042, the regulation policy for
when Larry touches the harness) is absorbed here as the manifest's declared routing policy
(navigator decision D7). No engine, no RL, no map merge, no Brain-wire change.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**11 requirements are locked.** See `298-SPEC.md` for full requirements, boundaries, and
acceptance criteria. The full design is the source of truth at
`docs/superpowers/specs/2026-09-07-harness-manifest-v2-design.md`.

Downstream agents MUST read `298-SPEC.md` before planning or implementing. Requirements are
not duplicated here.

**In scope (from SPEC.md):** manifest v2 (three additive keys, `maps` stays three);
`data/harness-policies/` with a closed `_schema.json`; the enforcement rung on every policy;
`scripts/run-harness.cjs` (tiered `--check`, `--room` convergence from Layer 0 only, the
committed converged-room fixture as a no-op); `gate-graph-derive-health` built here; Larry's
three surfaces declared with a `contract-parity-larry` policy and the 1,950-byte budget; the
persona's operating policy D3/D4/D5 stated and declared; rung 2 for voice rules via a lifted
transcript reader and a log-only Stop hook; one `harness-policies` doctor acceptance point;
`recipe-maps.cjs` tolerating the new keys; five new tests and the existing gates green.
**Out of scope (from SPEC.md):** any orchestration framework or engine; RL; merging or retiring
the three recipe maps; changes to the Brain wire or to `command-registry.json`; rewriting
Larry's voice; room repair (SEED-037 4c); regenerating dist mirrors as a side effect.

</spec_lock>

<decisions>
## Implementation Decisions

### Carried forward (locked before this discussion, do not re-ask)
- **D1-D9** in `.planning/research/2026-09-07-larry-rework-decisions.md`: Theo recognition plus
  honest gap-naming (shipped beta.27); thin-signal trigger on any low-confidence brain_* shape;
  Larry OPERATES components by context and intent; write policy = `memory_event` silently every
  substantive turn, claims only as `proposed` after a governance basket, `context_assemble` at
  turn start; SEED-085 Belief/Progress/Experience channels; full SEED-032 (manifest v2 plus one
  idempotent runner); 298 absorbs 297 and is planned now; the enforcement ladder
  `declared | logged | blocking` promoted one rung only on logged evidence; the six approved
  design sections with the basket firing at two or more candidates, the migration order
  (worktree-hygiene, shape-declaration, tool-honesty, card-fire first), and the 4d gate built
  inside 298.

### The governance basket (what the navigator sees when Larry asks to remember)
- **D-01:** Readable rows on the existing superset F.8 card: the row label is the claim text
  (truncated); the description carries `knowledge_type -> target_section`, confidence, and
  `source_path`. No turn number (not a column). Pre-check at confidence >= 0.70 is display-only
  and already shipped (`lib/hmi/shape-f8-renderer.cjs:42-44, 95-103`); no new scalar, shape or
  edge. Larry stays silent after confirmation; the post-confirm path re-enters `decide()` so the
  next line is a next-move offer. Two files change (`lib/core/navigation/governance.cjs` SELECT
  adds `n.properties`; `lib/core/memory/governance-candidate-raiser.cjs` maps text, kind and
  section into label plus description) plus tests. `MAX_TOGGLE_N = 4` pages past four
  candidates; the elicitation rung is label-only, so the label must carry the claim text.
- **D-01a:** Fix the stale comment at `governance-candidate-raiser.cjs:18` ("Part 8: no body
  renders"): Part 8 fences Brain egress; the card renders locally with zero Brain tokens
  (`lib/mcp/gate-render.cjs:39, 346-377`). The correction is part of the same change.

### The promotion review surface (how the navigator decides to tighten a rule)
- **D-02:** `node scripts/run-harness.cjs --policy <id>` prints counts, the last N findings,
  `promotion rule MET / NOT MET` against the policy's `promotion_rule`, and the exact one-line
  `rung` edit that promotes. The `harness-policies` acceptance point echoes the same verdict as
  the PASS/FAIL finding suffix (the `scripts/doctor.cjs:3008-3010` idiom). Both printers call
  ONE exported `evaluatePromotion(policy, lines)` in `lib/hmi/voice-style-log.cjs`, so the
  printer can never disagree with the counter (the 2026-07-11 lesson recorded in
  `lib/core/doctor/card-fire-health-module.cjs:8-9`). The JSONL `result` field carries a
  human-labelable value (`fire | false_positive | true_positive`) so
  `max_false_positive_rate` is computable. The raw log stays as the fallback; the report header
  prints its path. No statusline chip (the cockpit's own rule: static fields earn no space,
  `lib/statusline/cockpit-renderer.cjs:74-78`).

### The converged-room fixture (what "converged" looks like)
- **D-03:** Scaffold-born and text-only: build `data/harness-fixtures/converged-room/` once with
  `scaffoldRoomSkeleton()` (`lib/core/room-skeleton-scaffold.cjs:59-71`, 11 sections, ROOM.md
  each), regenerate STATE.md once with `scripts/compute-state` (the only writer of `computed:`,
  lines 257-259), commit the ~33 text files. No `room.db`, no `.mindrian/`: an absent derive
  queue is empty by contract (`scripts/gsd-graph-derive-sweep.cjs:97-104`), an absent
  `decision-traces/` is the validator's declared healthy state
  (`lib/memory/validators/navigation-invariants.cjs:228-232`), and an absent database reads as
  zero proposed claims through `openRoomDbReadOnlyForCaller`
  (`lib/core/navigation/spine-events.cjs:523-533`). The runner ignores `venture_stage` on the
  fixture. The proposed-node SQL path (`governance.cjs:57`) gets its own throwaway-db unit test.
- **D-03a (binding rule for the planner):** the runner never opens the room database through
  `openGraph` (`lib/core/lazygraph-ops.cjs:426-434` creates `.mindrian/` and `room.db` and runs
  `initSchema` on first touch, which would dirty the fixture on run one). Read-only opener only.

### The voice-style log (where the navigator sees it)
- **D-04:** JSONL under `MINDRIAN_HOME` plus ONE `status: 'ok'` doctor MODULE line reporting the
  count since the last release, mirroring `lib/core/doctor/card-fire-health-module.cjs`
  one-for-one (registry-only wiring in `data/doctor-modules.json`, cadence `always`, `flag`
  null). The module never returns `warn`. "Since last release" uses a version stamp per JSONL
  row or the `doctor-applied.json` watermark. It cannot ride the `harness-policies` acceptance
  point (every `buildAcceptanceChecklist` entry is `severity: 'blocker'`,
  `scripts/doctor.cjs:1605-1612`). The Stop-hook entry in `hooks/hooks.json` follows the
  `check-card-fire.cjs` shape (lines 209-211) within the 3000ms budget.
- **D-04a:** A cockpit statusline chip is filed as a co-design proposal only (the orphan
  `~/.mindrian/voice-mark.json` side-channel that `lib/statusline/cockpit-signals.cjs:28-33,129`
  reads with no writer makes it cheap), never built in this phase (navigator HARD RULE: the
  statusline is co-designed, never a solo pick).

### Claude's Discretion
- Runner internals the navigator did not need to see: sequential vs parallel policy spawn,
  per-policy timeouts, report layout beyond the decided fields, JSONL rotation, the exact
  `_schema.json` wording, and which existing test file each new test mirrors. The planner
  decides; the spec's section 8 and 13 bound the choices.

### Folded Todos
- **Never git stash mid-merge** (`.planning/todos/2026-07-12-never-git-stash-...`): locked
  constraint for every 298 plan and executor - never `git stash`; take baselines with
  `git show HEAD:<path>`. A popped foreign stash cost a recovery on 2026-09-07.
- **Mirror the gate_render description fix into Theo** (`2026-09-07-theo-gate-render-...`):
  a T-side task; folded only as a cross-repo note already carried in
  `.planning/coordination/2026-09-07-M-TO-T-harness-v2-compatibility-brief.md`. No 298 work.
- **F7 rescope 212/213 against registerCapability** (`2026-07-08-f7-rescope-...`): folded as a
  reminder only, weak keyword match: when policies for eureka-phase gates are declared in a
  later slice, check the `registerCapability` interplay. No slice-1 work.
- **Ingest skill-description insight into Brain** (`2026-07-17-ingest-skill-description-...`):
  folded as a T-side note only, weak keyword match. No 298 work.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The design and its lock
- `.planning/phases/298-seed-032-harness-as-code-declare-and-machine-enforce-the-min/298-SPEC.md` - Locked requirements - MUST read before planning
- `docs/superpowers/specs/2026-09-07-harness-manifest-v2-design.md` - the full navigator-approved design: tree, policy schema, generator v2, runner semantics, Larry as first consumer, ownership table, migration slices, tests, risks
- `.planning/research/2026-09-07-larry-rework-decisions.md` - decisions D1-D9 with provenance; the RESUME block at its head
- https://claude.ai/code/artifact/5398b3c4-b1d7-4c95-8fb0-05da01271992 - the design review page with the reasoning graph

### Advisor research for the four decisions above
- `.planning/phases/298-.../298-ADVISOR-basket-card.md` - D-01 comparison and the files it read
- `.planning/phases/298-.../298-ADVISOR-research.json` - D-02, D-03, D-04 comparison tables (`advisor_results*` keys) and the researcher agent ids (was the discuss checkpoint)

### Audits and grounding that shaped the scope
- `.planning/research/2026-09-07-larry-extended-audit.md` - sections B (frozen phrases, nine tests), D (three surfaces), E (local-mind gap), F (size)
- `.planning/quick/260907-r55-residual-sweep-after-the-beta-27-release/260907-r55-SUMMARY.md` - the INV-1 validator investigation (guardian violations = 8 fields x N bare trace entries; plugin defect)
- `.planning/coordination/2026-09-06-M-SIDE-T-SIDE-COORDINATION-PROTOCOL.md` and `.planning/coordination/2026-09-07-M-TO-T-harness-v2-compatibility-brief.md` - what Theo's Phases 13/14/15/06.3 were told; the three tool shapes frozen until announced

### Seeds this phase draws on
- `.planning/seeds/SEED-032-harness-as-code.md` - the four required capabilities; "declare what runs, add no framework"
- `.planning/seeds/SEED-085-evoharness-rl-cost-aware-learned-harness-access.md` - Belief/Progress/Experience channels and the four meta-actions; RL out
- `.planning/seeds/SEED-040-hitl-memory-governance.md` - the F.8 basket, WHAT/HOW/WHO, NOT_REMEMBERED_BECAUSE
- `.planning/seeds/SEED-062-the-engine-gap-no-agentic-runtime-in-this-codebase.md` - the runner executes policy, never cognition
- `.planning/seeds/SEED-037-graph-derive-drain-heal-and-doctor-retrofit.md` - the 4d gate precondition; 4c stays separate
- `.planning/seeds/SEED-033-ralph-loop-lessons.md` - bounded retry in safe steps only; propose then fact-check

### The locked v1 harness this phase extends
- `scripts/build-harness-manifest.cjs` - the generator idiom (write / `--check` / `--refresh`, byte-stable JSON, D-167-01..06, "NEVER a per-surface row")
- `data/harness-manifest.json` - v1 shape (three maps, four runtime surfaces)
- `tests/test-harness-167-verdict.cjs`, `tests/test-harness-manifest-check.cjs`, `tests/test-harness-manifest-part8-boundary.cjs`, `tests/test-201-harness-manifest.cjs` - what pins v1 (maps must stay three; field allowlists; drift guard)

### Canon and house rules
- `docs/MINDRIAN-CANON.md` Parts 8 (Graph Boundary), 9 (Memory Locality), 11 (Invocation Constitution), 12 (Pedagogy and invisibility)
- `.claude/includes/architecture.md` - ICM Layers 0-4
- `CLAUDE.md` - Tri-Polar rule, release process (Steps 2.5, 6.6, 9.8 run doctor acceptance tiers), no em-dashes, GSD-only edits

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/mcp/gate-render.cjs` (superset card, `superset_options`, elicitation rung label-only) and `lib/hmi/shape-f8-renderer.cjs` (0.70 pre-check, `MAX_TOGGLE_N = 4`): the basket needs no new shape.
- `lib/core/memory/governance-candidate-raiser.cjs`, `lib/core/memory/governance-candidate.cjs`, `lib/core/navigation/governance.cjs` (`findGovernanceCandidates`): the raise path exists; D-01 changes what the rows carry.
- `lib/core/navigation/typed-claim.cjs` (`KNOWLEDGE_TYPES` to `epistemic_type` mapping) and `lib/core/node-insert.cjs` (requires `epistemic_type`; `review_status` proposed vs confirmed): the write side of D4 exists.
- `lib/core/doctor/card-fire-health-module.cjs` and `data/doctor-modules.json`: the exact idiom for a never-failing doctor module that reads a `MINDRIAN_HOME` log (D-04).
- `scripts/check-card-fire.cjs` (lines 170-190: the transcript reader; 1236-1300: its log and TTL): the reader to lift into `lib/hmi/turn-text.cjs`; its 86 percent false-positive history is the D8 precedent.
- `lib/core/room-skeleton-scaffold.cjs` and `scripts/compute-state`: the fixture's two builders (D-03).
- `lib/core/navigation/spine-events.cjs` (`openRoomDbReadOnlyForCaller`, null on absent db): the runner's only database opener (D-03a).
- `scripts/check-worktree-hygiene.cjs` (quick 260906-t3s): the newest gate, with `--root`, `--json`, `--advisory` and a doctor acceptance point of the shape `harness-policies` will copy.
- `lib/statusline/cockpit-signals.cjs` orphan `voice-mark.json` reader: the co-design proposal's hook (not built here).

### Established Patterns
- One write chokepoint (`lib/core/navigation.cjs`); typed edges and `memory_event` only through it; Canon Part 9.
- Generated, byte-stable JSON with a 3-branch generator `main`; the manifest digests directories and never enumerates rows (D-167-01..06, D-166-03).
- Every `buildAcceptanceChecklist` entry is a blocker; informational reporting lives in doctor MODULES (`data/doctor-modules.json`), not acceptance points.
- Logs resolve through `MINDRIAN_HOME` so tests can isolate them; TTL pruning exists in card-fire and must not shrink a promotion window unnoticed.
- CJS only, switch-case CLI, node built-ins, no YAML, no TypeScript, no em-dashes, explicit `git add <paths>`, never `git stash`.
- Every quick task and phase this week found a hand-maintained list drifting from a scannable truth; discover sets by scanning (the canon cascade rule, the hygiene classifier, the frozen-phrase grep).

### Integration Points
- `scripts/hooks/pre-commit` drift guard on `data/harness-manifest.json` (must accept v2's keys).
- `lib/core/recipe-maps.cjs` `loadManifest()` (additive-tolerant today; exposes `policies`).
- `scripts/doctor.cjs` acceptance list (one new blocker point, wired after slice 1 is green) and `data/doctor-modules.json` (one new informational module).
- `hooks/hooks.json` Stop chain (one log-only entry) and `check-hook-schema-compatibility.cjs`.
- `release.sh` Steps 2.5 / 6.6 / 9.8 run the acceptance tiers; the T-side sync payload (`command-registry.json`, `recipe-maps.cjs`) must stay byte-unchanged by this phase.
- Larry's three surfaces and the nine frozen-phrase tests; `lib/mcp/no-instructions.test.cjs` byte-freezes the BOUNDARIES paragraph and measures the 1,950-byte budget on the evaluated constant.

</code_context>

<specifics>
## Specific Ideas

- "Presence and salience, not prose versus code": a rule earns a gate by being stated where the
  model speaks and then logged failing; the glyph rule held on prose alone, the hyphens rule
  failed because it was absent. Every policy file's `notes` field should say which rung it is on
  and why in one paragraph.
- "One evaluator, two printers": the promotion verdict is computed in one function and merely
  printed by the runner and by doctor.
- "The fixture is built once and never touched by the runner": convergence is a scan, not a
  memory; the runner's only write is the report in `.mindrian/` and the fixture has no
  `.mindrian/` on purpose.
- The basket row must be readable: a human confirming a truth claim must see the claim, its
  DIKW kind, and where it files.
- The T-side brief freezes three Theo response shapes (`brain_ask` empty `signals`,
  `normalize_framework_name` exactly-one, `orchestration_readiness` floor 3); the
  thin-grounding trigger keys off them and nothing in this phase may change that dependency
  silently.

</specifics>

<deferred>
## Deferred Ideas

- **INV-1 validator defect** (`lib/memory/validators/navigation-invariants.cjs` applies the 8
  `brain_md_*` trace fields to every trace entry; four of five `persistDecisionTrace()` writers
  in `scripts/intent-classifier.cjs` at 2802, 2999, 3186 never carry them, so a room that
  exercised the binding-gate flow shows 8 x N guardian violations). Plugin defect; open a
  `/gsd-debug` slug to scope INV-1 by entry kind. This phase avoids the noise by keeping the
  fixture free of `.mindrian/decision-traces/`; it does not fix the validator.
- **Cockpit voice chip**: co-design proposal per the statusline HARD RULE; the orphan
  `voice-mark.json` side-channel is the cheap hook. Not built here.
- **SEED-037 4c** (heal the ~16 rooms whose derive queues were cleared before the fix):
  human-gated repair, separate from the 4d monitor built here.
- **Phase 297's roadmap entry**: mark absorbed by 298 (a `/gsd-phase` edit at plan time).
- **CHANGELOG hygiene**: 107 pre-existing em-dashes in older entries; a separate sweep.
- **Slice 3 mechanism**: `scripts/doctor.cjs --point <id>` (a read of the existing acceptance
  list) if absent; belongs to the slice that migrates the 21 doctor modules.

### Reviewed Todos (not folded)
None - all four keyword matches were folded above, three of them as notes only.

</deferred>

---

*Phase: 298-SEED-032: Harness-as-Code - Declare and Machine-Enforce the MindrianOS Agent Harness*
*Context gathered: 2026-09-07*
