# Harness Manifest v2 - Phase 298 design (SEED-032, absorbing Phase 297)

- Date: 2026-09-07
- Status: navigator-approved design, pre-plan (D9)
- Reviewed as: https://claude.ai/code/artifact/5398b3c4-b1d7-4c95-8fb0-05da01271992
- Grounding: `.planning/research/2026-09-07-larry-extended-audit.md`,
  `.planning/research/2026-09-07-larry-rework-decisions.md` (D1-D9), the icm-architect
  standing consult (2026-09-07), SEED-032/033/037/040/062/085, Canon Parts 8/9/11/12.
- Handoff: `/gsd-discuss-phase 298` then `/gsd-plan-phase 298` consume this spec. This repo's
  HARD RULE routes every plan through GSD; this document is the design the planner reads,
  not a plan.

## 1. Goal

Declare and machine-enforce the agent harness MindrianOS already runs, so that (a) the three
surfaces Larry speaks through cannot drift apart silently, (b) every governance rule carries a
stated enforcement rung and is promoted only on logged evidence, (c) Larry operates the
architecture's components by context and intent under a declared write policy, and (d) one
idempotent runner can say, from files alone, whether a room is converged.

Success is measured by four truths:

1. `node scripts/build-harness-manifest.cjs --check` fails when any of Larry's three speaking
   surfaces stops carrying a core-contract phrase, when a declared count disagrees with its
   registry, or when the Desktop wire exceeds its byte budget.
2. Every `scripts/check-*.cjs` gate and every doctor acceptance module is reachable from one
   declared policy entry that names its runner, its rung, its evidence log, and its pinning test.
3. `node scripts/run-harness.cjs --room data/harness-fixtures/converged-room` exits 0, writes
   nothing, and leaves `git status --porcelain` empty on a second run.
4. A fresh Larry session on the CLI and on Desktop/Cowork behaves identically on the four
   beta.27 tests (Theo by name, never volunteered, thin-grounding clause, glyph present), and
   its memory writes follow D4 with a visible basket.

## 2. Non-goals

- No orchestration framework, no new engine. SEED-062 holds: there is no agentic runtime in
  `lib/`; Claude is the runtime. The runner executes policy and convergence checks and never
  calls a model.
- No RL, no GRPO, no training loop (SEED-085's mechanism, explicitly out).
- No merge or retirement of the three recipe maps (D-166-03). `maps` stays exactly three.
- No YAML, no TypeScript, no new dependencies (D-167-01; node built-ins only).
- No change to the Brain wire. The manifest and policies are `methodology_tier=mindrian-operation`
  machinery metadata; they carry no user content (Canon Part 8).
- No rewrite of Larry's voice. Prose stays prose; the manifest holds invariants, not sentences.

## 3. What exists (do not rebuild)

| Piece | Path | Status |
|---|---|---|
| Manifest v1 | `data/harness-manifest.json` | Phase 167, locked. 3-map sha256 digest + 4 `runtime_surfaces`. |
| Generator | `scripts/build-harness-manifest.cjs` | write / `--check` / `--refresh`, byte-stable JSON. |
| Consumers | `scripts/hooks/pre-commit`, `lib/core/recipe-maps.cjs`, `scripts/build-new-surface.cjs` | pre-commit drift guard; `loadManifest()` is additive-tolerant. |
| Tests | 167 (`test-harness-167-verdict`, `test-harness-manifest-check`, `test-harness-manifest-part8-boundary`), 201, 235 | pin `maps.length === 3`, the field allowlists, the drift guard. |
| Governance gates | 37 `scripts/check-*.cjs`, 21 modules in `data/doctor-modules.json` | each wired separately today. |
| Runtime surfaces | `lib/core/chain-executor.cjs`, `lib/core/navigation-engine.cjs`, `lib/statusline/cockpit-renderer.cjs`, `lib/core/directive-envelope.cjs` | already digested by v1. |
| Write chokepoint | `lib/core/navigation.cjs`; `lib/core/node-insert.cjs` (requires `epistemic_type`) | Canon Part 9. |
| Transcript reader | inside `scripts/check-card-fire.cjs` (reads `transcript_path`, extracts the last assistant message) | to be lifted, not copied. |
| Larry surfaces | `agents/larry-extended.md` (CLI), `lib/mcp/runtime-instructions.cjs` (Desktop/Cowork, 1,950-byte budget, BOUNDARIES paragraph byte-frozen by `lib/mcp/no-instructions.test.cjs`), `skills/larry-personality/SKILL.md` | nine tests pin phrases (audit section B). |

## 4. Layer placement (ICM)

The manifest is a Layer 2 contract that declares Layer 1 routing without holding it. v2 keeps
that discipline:

- IN the manifest (Layer 2): which surfaces exist and their digests; which policies are in
  force and at which rung; which converged-room fixture the runner is measured against.
- DIGESTED, never inlined (Layer 3 factory material): the core-contract phrase set; the memory
  write policy (when to note, commit, recall, track); the governance-basket rules.
- The manifest names WHERE each memory channel lives - Belief = the room graph via
  `navigation.cjs`, Progress = `STATE.md`, Experience = `.planning/seeds/` plus `memory_event` -
  and points at one policy file for WHEN. This closes the L0/L1 porosity SEED-085 flagged:
  the manifest cannot drift from the surfaces that speak without `--check` going red.

## 5. The tree

```
data/
  harness-manifest.json            v2: + policies {path, digest, count}, + larry_surfaces[3], + fixture_ref
  harness-policies/                one file per policy, hand-authored, digested as ONE manifest entry
    _schema.json                   closed vocabulary the generator validates against
    CONTEXT.md                     reads / does / writes / human check; carries the change-impact table
    gate-worktree-hygiene.json     (migration slice 1)
    gate-shape-declaration.json    (slice 1)
    gate-tool-honesty.json         (slice 1)
    gate-card-fire.json            (slice 1; its own rung history is the D8 precedent)
    gate-graph-derive-health.json  SEED-037 4d, BUILT in this phase (section 9)
    voice-hyphens-only.json        rung: declared (rung 1 shipped by quick 260907-qta)
    voice-glyph-present.json       rung: declared
    voice-backend-noun-free.json   rung: declared (honesty clauses name no backend noun)
    voice-fork-as-card.json        rung: logged (card-fire already logs this)
    memory-write-policy.json       D4 + F7: note silent; commit proposed-only after a basket; basket at >= 2 candidates
    contract-parity-larry.json     the phrase set every Larry surface must carry; the byte budget
    ... remaining 33 gates + 21 doctor modules in later slices
  harness-fixtures/
    converged-room/                committed no-op fixture (section 8)
scripts/build-harness-manifest.cjs  v2 generator (same 3-branch main)
scripts/run-harness.cjs             the runner: --check | --room <dir> | --json | --policy <id>
scripts/check-voice-style.cjs       rung-2 Stop hook, log-only, always continue:true
lib/hmi/turn-text.cjs               the ONE transcript reader (lifted from check-card-fire.cjs)
lib/hmi/voice-style-log.cjs         evidence-log writer, MINDRIAN_HOME-resolved
```

Rules: `maps` stays exactly three. `runtime_surfaces` grows only by declared roles. The
manifest never enumerates policies; it digests the directory (`path`, `digest`, `count`),
exactly as it digests the three maps. `_schema.json` mirrors the closed-vocabulary pattern of
`data/hitl-shape-declaration-schema.json`.

## 6. Policy schema

Every file in `data/harness-policies/` validates against `_schema.json`:

| Key | Type | Meaning |
|---|---|---|
| `id` | string, unique, kebab | `gate-*`, `voice-*`, `memory-*`, `contract-*` |
| `kind` | enum `gate | voice | memory | contract` | gate = a check script or doctor module; voice = a rule over Larry's output; memory = a write policy; contract = a parity set |
| `runner` | string path or `null` | the script the runner spawns; `null` declares a ghost honestly |
| `args` | string[] | passed verbatim; `--root` and `--json` where the runner supports them |
| `rung` | enum `declared | logged | blocking` | D8 |
| `evidence_log` | string | path under `MINDRIAN_HOME` (default `~/.mindrian/harness-evidence/<id>.jsonl`) |
| `promotion_rule` | object `{ window_runs, max_false_positive_rate, min_true_positives }` | decided BEFORE the log is read; the runner reports whether it is met, never promotes by itself |
| `owner` | string | the exclusive owner surface (section 11) |
| `pinned_by` | string[] | test files that pin this policy's behavior |
| `applies_to` | string[] | `pre-flight | pre-tag | full | stop-hook | room` tiers |
| `notes` | string | why this rung, one paragraph, no em-dashes |

Rung semantics in the runner: declared = listed in the report only; logged = run, append one
JSONL line `{ts, id, result, detail}` to `evidence_log`, never fail; blocking = run, fail the
tier on non-zero exit. Promotion is a one-line edit to `rung` in one file, reviewable in a diff,
made by a human after reading the log against `promotion_rule`. Demotion follows the same path.

## 7. Generator v2 (`scripts/build-harness-manifest.cjs`)

- `MANIFEST_VERSION` 1 to 2. Adds `policies: {path: "data/harness-policies", digest, count}`,
  `larry_surfaces: [{role, path, digest}]` for the three speaking surfaces, and
  `fixture_ref: {path: "data/harness-fixtures/converged-room", digest}`.
- Validates every policy file against `_schema.json` before digesting; an invalid file fails
  `--check` with the file name and the failing key.
- `--check` additionally runs the `contract-*` policies inline (they are pure file reads): every
  phrase in `contract-parity-larry.json` present in each listed surface; the Desktop wire's
  evaluated constant within budget; declared counts (sensors, reaches, tools) equal to their
  registries.
- Byte-stable output, deterministic ordering, single trailing newline, as v1.
- Widens the Part 8 field allowlist test (`test-harness-manifest-part8-boundary.cjs`) for the
  three new top-level keys and nothing else.

## 8. The runner (`scripts/run-harness.cjs`)

Reads the manifest, loads the policy directory, and executes by tier:

- `--check`: run every policy whose `applies_to` includes the requested tier
  (`--tier pre-tag` etc.); print a report; exit 1 only if a `blocking` policy failed.
- `--room <dir>`: convergence mode. Reads only Layer 0 to decide there is nothing to do:
  `ROOM.md` present in every section, `STATE.md` `computed:` matching the on-disk section
  counts, `.mindrian/graph-derive-queue.json` empty, and zero `review_status: proposed`
  truth-claim nodes read through `navigation.cjs` (never raw SQL). If all hold: zero writes,
  exit 0, report `converged: true`. If not: report what is unconverged; it never fixes a room
  by itself (fixing is a human-gated action elsewhere).
- Output: one `harness-run.json` under `<room>/.mindrian/` (the side-channel location doctor
  already uses) plus stdout; `--json` prints the report only.
- Idempotence proof: `tests/test-298-runner-idempotent.cjs` runs the fixture twice and asserts
  empty `git status --porcelain` and identical reports.
- Honesty rules: a `runner: null` policy is reported as `ghost`; the runner refuses
  `converged: true` while `gate-graph-derive-health` is a ghost or the derive queue is non-empty.

The converged-room fixture is built once by `lib/core/room-skeleton-scaffold.cjs` (11
sections), seeded from an existing test fixture (`test/fixtures/memory-continuity` or
`cascade-e2e`), committed under `data/harness-fixtures/converged-room/`, and pinned by digest
in the manifest.

## 9. `gate-graph-derive-health` (SEED-037 4d, built here)

A `check-graph-derive-health.cjs` gate: for a room, reports derive-queue length, last drain
result, and whether `runDerivation` succeeded within the configured window; exits 1 on a
non-empty queue older than the threshold or a recorded silent-clear. Declared at rung
`logged` for one release, promoted to `blocking` by the D8 rule. It is the runner's first
declared policy because SEED-037 shows Larry must not write into graphs nothing downstream
derives. Healing the ~16 already-damaged rooms (4c) stays a separate, human-gated action; this
phase ships the monitor, not the repair.

## 10. Larry as first consumer

- Surfaces: the three speaking surfaces enter `larry_surfaces` with digests.
  `contract-parity-larry.json` holds the phrase set the nine tests pin plus the two new Theo
  and thin-grounding rules; `--check` fails when any surface drops one.
- Operating by intent (D3): the persona states ICM Layer 1 Routing explicitly - read context and
  intent, then engage the right component: the remote graph for methodology, the local graph
  for memory and context, the room layers for filing, the sensors and the dial for navigation.
  Silent for reads and context; a gate for any write that becomes a truth claim.
- Memory channels (D5): Belief = room graph, Progress = `STATE.md`, Experience = seeds +
  `memory_event`; track = `context_assemble`, commit = `graph_write` / `claim_write`, recall =
  `graph_query` / `graph_reason`, note = `memory_event`. Stated in the skill, declared in
  `memory-write-policy.json`.
- Write policy (D4 + F7): `memory_event` fires silently on every substantive turn;
  `claim_write` / `graph_write` land only as `proposed`, only after an F.8 governance basket
  (SEED-040) that fires when two or more candidate writes exist; toggled-off candidates write
  `NOT_REMEMBERED_BECAUSE`; `context_assemble` runs at turn start. Never narrated (Part 12).
- Voice policies: hyphens-only (rung 1 stated three times by quick 260907-qta; declared here),
  glyph present (declared; already holds), backend-noun-free honesty clauses (declared),
  fork-as-card (logged via card-fire).
- Where prose lands: the agent body carries the short statements and defers to the skill for
  contracts (its established pattern); the skill carries the operating contract; the Desktop
  wire carries the shortest possible restatement within budget. The manifest holds the
  invariants.

## 11. Ownership (9-property architecture)

| File | Change | Exclusive owner | Pinned by |
|---|---|---|---|
| `scripts/build-harness-manifest.cjs` | v2 keys, validation, contract checks | generator | test-harness-manifest-check, test-harness-167-verdict, part8-boundary |
| `data/harness-manifest.json` | regenerated only | generator | pre-commit drift guard, test-201-harness-manifest |
| `data/harness-policies/*` | new, sliced | policy | new test-298-policies-schema |
| `data/harness-fixtures/converged-room/` | new | fixture | new test-298-runner-idempotent |
| `scripts/run-harness.cjs` | new | runner | test-298-runner-idempotent |
| `scripts/check-graph-derive-health.cjs` | new | derive-gate | new test-298-derive-health |
| `lib/hmi/turn-text.cjs`, `scripts/check-voice-style.cjs`, `lib/hmi/voice-style-log.cjs` | new; card-fire repointed to the shared reader | voice | check-card-fire's existing tests + new test-298-voice-log |
| `lib/core/recipe-maps.cjs` | expose `policies`, tolerate new keys | runtime | test-201 Task 3 |
| `scripts/doctor.cjs` | one acceptance point `harness-policies` (shape of `worktree-hygiene`) | doctor | test-doctor-acceptance-self-coverage |
| `hooks/hooks.json` | one Stop entry for `check-voice-style.cjs` | hooks | check-hook-schema-compatibility |
| `agents/larry-extended.md`, `skills/larry-personality/SKILL.md`, `lib/mcp/runtime-instructions.cjs` | prose per D3/D4/D5 | persona | the nine frozen-phrase tests; `no-instructions.test.cjs` |

Outside-in consumers to confirm at discuss-phase: the release train (`release.sh` Step 6.6
runs `doctor --acceptance --pre-tag`; Step 9.8 the full tier), the T-side repo (reads
`command-registry.json` and `recipe-maps.cjs` for its sync payload; the manifest's new keys
must not change either), the marketplace cache, and `scripts/build-new-surface.cjs`.

## 12. Migration slices

Token band 2k-8k per step forbids migrating 58 gates in one session. Order:

1. Slice 1 (with the generator and runner): worktree-hygiene, shape-declaration, tool-honesty,
   card-fire, plus the Larry contract and voice policies and `memory-write-policy`.
2. Slice 2: the remaining `check-*.cjs` gates that `verify-release` already runs.
3. Slice 3: the 21 doctor modules, each as a `gate-*` policy whose runner is
   `scripts/doctor.cjs --point <id>` (add that flag if absent; it is a read of the existing list).
4. Slice 4: the remaining gates, then the 4d promotion review.

Each slice ends with `build-harness-manifest.cjs --check` green and the runner idempotent.

## 13. Error handling and honesty

- An invalid policy file fails `--check` naming file and key; the manifest is not regenerated.
- A `runner: null` policy is a ghost: reported, never counted as passing, never blocking.
- The runner never repairs a room, never calls a model, never writes outside
  `<room>/.mindrian/harness-run.json`.
- Rung changes happen only by a human edit to one policy file; the runner reports whether the
  `promotion_rule` is met and stops there.
- Canon Part 8: digests and policy metadata only; no room content, no user bytes, no network.
- Canon Part 9: every proposed-node count and every edge goes through `navigation.cjs`.
- Canon Part 12: no policy makes Larry narrate a memory operation; the basket is the only
  visible surface, and it is the navigator's.

## 14. Testing

New: `test-298-policies-schema.cjs` (every policy validates; unknown keys rejected; rung enum
closed), `test-298-runner-idempotent.cjs` (fixture twice, empty diff, identical report),
`test-298-derive-health.cjs` (red on a non-empty stale queue, green on the fixture),
`test-298-voice-log.cjs` (log-only hook appends and always continues; em-dash and glyph cases;
`MINDRIAN_HOME` isolation), `test-298-contract-parity.cjs` (drop one phrase from one surface,
`--check` goes red; restore, green).

Existing gates that must stay green: the nine frozen-phrase tests (audit B), tests 167/201/235
for the manifest, `no-instructions.test.cjs` 9/9, `test-doctor-acceptance-self-coverage`,
`check-hook-schema-compatibility`, `run-all-167.sh`, `run-all-201.sh`.

Release: `doctor --acceptance --pre-tag` gains the `harness-policies` point; the D-4 precedent
from quick 260906-t3s applies (a blocker's first run must be a true green: wire the point after
slice 1 is green, not before).

## 15. Risks

- Scope creep into a runtime: mitigated by the runner's hard non-goal and SEED-062.
- Over-blocking: mitigated by D8 (everything enters at `declared` or `logged`).
- Byte budget on the Desktop wire: 1,944 of 1,950 today; any new restatement there must be
  funded by tightening, measured with `Buffer.byteLength` on the evaluated constant.
- Dist mirrors: `test-234-dist-bundle.cjs` is already red on stale mirrors (source 58,100 bytes
  vs mirrors 53,768); regenerating them is a separate, deliberate step, not a side effect.
- Concurrency on the shared working tree: one committer at a time; no `git stash` (a popped
  foreign stash cost a recovery on 2026-09-07).

## 16. Residuals recorded, not in scope

- `references/personality/voice-dna.md` lines 63 and 75 label the pause "Em-dash" while
  demonstrating the hyphen form; naming contradiction on a pointer-loaded reference.
- SEED-037 4c (heal the ~16 damaged rooms): human-gated repair, separate.
- The guardian's `trace_missing_field / glyph low` report (120-128 violations in one section of
  the test room): room content, separate.
- Phase 297's own roadmap entry: mark absorbed by 298 at discuss-phase.
