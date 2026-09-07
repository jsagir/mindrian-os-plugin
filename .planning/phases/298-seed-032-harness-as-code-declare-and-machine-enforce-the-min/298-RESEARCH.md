# Phase 298: SEED-032: Harness-as-Code - Declare and Machine-Enforce the MindrianOS Agent Harness - Research

**Researched:** 2026-09-07
**Domain:** repo-internal governance machinery (generated JSON descriptors, CJS check-script gates, doctor acceptance/module registry, Stop-hook contract, node:sqlite read-only reads, persona surface parity)
**Confidence:** HIGH (everything load-bearing was read from the repo or probed live; two claims are marked ASSUMED and listed in the Assumptions Log)

**Grounding note:** per the orchestrator's instruction no web searches were run and no Brain/Theo tool was called. Context7 was NOT reachable in this session (no `mcp__context7__*` tools in the agent's tool set, and `ctx7` is not installed - `command -v ctx7` returned nothing). The one runtime-semantics claim that would normally need Context7 (node:sqlite read-only open behavior) was instead settled by a LIVE RUNTIME PROBE on this machine's Node v22.23.1; the probe, its exact output, and its limits are recorded in "The read-only opener, settled by probe" below. No repo file was edited.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Carried forward (locked before the 298 discussion, do not re-ask)**

- **D1-D9** in `.planning/research/2026-09-07-larry-rework-decisions.md`: Theo recognition plus honest gap-naming (shipped beta.27); thin-signal trigger on any low-confidence `brain_*` shape; Larry OPERATES components by context and intent; write policy = `memory_event` silently every substantive turn, claims only as `proposed` after a governance basket, `context_assemble` at turn start; SEED-085 Belief/Progress/Experience channels; full SEED-032 (manifest v2 plus one idempotent runner); 298 absorbs 297 and is planned now; the enforcement ladder `declared | logged | blocking` promoted one rung only on logged evidence; the six approved design sections with the basket firing at two or more candidates, the migration order (worktree-hygiene, shape-declaration, tool-honesty, card-fire first), and the 4d gate built inside 298.

**The governance basket (what the navigator sees when Larry asks to remember)**

- **D-01:** Readable rows on the existing superset F.8 card: the row label is the claim text (truncated); the description carries `knowledge_type -> target_section`, confidence, and `source_path`. No turn number (not a column). Pre-check at confidence >= 0.70 is display-only and already shipped (`lib/hmi/shape-f8-renderer.cjs:42-44, 95-103`); no new scalar, shape or edge. Larry stays silent after confirmation; the post-confirm path re-enters `decide()` so the next line is a next-move offer. Two files change (`lib/core/navigation/governance.cjs` SELECT adds `n.properties`; `lib/core/memory/governance-candidate-raiser.cjs` maps text, kind and section into label plus description) plus tests. `MAX_TOGGLE_N = 4` pages past four candidates; the elicitation rung is label-only, so the label must carry the claim text.
- **D-01a:** Fix the stale comment at `governance-candidate-raiser.cjs:18` ("Part 8: no body renders"): Part 8 fences Brain egress; the card renders locally with zero Brain tokens (`lib/mcp/gate-render.cjs:39, 346-377`). The correction is part of the same change.

**The promotion review surface (how the navigator decides to tighten a rule)**

- **D-02:** `node scripts/run-harness.cjs --policy <id>` prints counts, the last N findings, `promotion rule MET / NOT MET` against the policy's `promotion_rule`, and the exact one-line `rung` edit that promotes. The `harness-policies` acceptance point echoes the same verdict as the PASS/FAIL finding suffix (the `scripts/doctor.cjs:3008-3010` idiom). Both printers call ONE exported `evaluatePromotion(policy, lines)` in `lib/hmi/voice-style-log.cjs`, so the printer can never disagree with the counter (the 2026-07-11 lesson recorded in `lib/core/doctor/card-fire-health-module.cjs:8-9`). The JSONL `result` field carries a human-labelable value (`fire | false_positive | true_positive`) so `max_false_positive_rate` is computable. The raw log stays as the fallback; the report header prints its path. No statusline chip (the cockpit's own rule: static fields earn no space, `lib/statusline/cockpit-renderer.cjs:74-78`).

**The converged-room fixture (what "converged" looks like)**

- **D-03:** Scaffold-born and text-only: build `data/harness-fixtures/converged-room/` once with `scaffoldRoomSkeleton()` (`lib/core/room-skeleton-scaffold.cjs:59-71`, 11 sections, ROOM.md each), regenerate STATE.md once with `scripts/compute-state` (the only writer of `computed:`, lines 257-259), commit the ~33 text files. No `room.db`, no `.mindrian/`: an absent derive queue is empty by contract (`scripts/gsd-graph-derive-sweep.cjs:97-104`), an absent `decision-traces/` is the validator's declared healthy state (`lib/memory/validators/navigation-invariants.cjs:228-232`), and an absent database reads as zero proposed claims through `openRoomDbReadOnlyForCaller` (`lib/core/navigation/spine-events.cjs:523-533`). The runner ignores `venture_stage` on the fixture. The proposed-node SQL path (`governance.cjs:57`) gets its own throwaway-db unit test.
- **D-03a (binding rule for the planner):** the runner never opens the room database through `openGraph` (`lib/core/lazygraph-ops.cjs:426-434` creates `.mindrian/` and `room.db` and runs `initSchema` on first touch, which would dirty the fixture on run one). Read-only opener only.

**The voice-style log (where the navigator sees it)**

- **D-04:** JSONL under `MINDRIAN_HOME` plus ONE `status: 'ok'` doctor MODULE line reporting the count since the last release, mirroring `lib/core/doctor/card-fire-health-module.cjs` one-for-one (registry-only wiring in `data/doctor-modules.json`, cadence `always`, `flag` null). The module never returns `warn`. "Since last release" uses a version stamp per JSONL row or the `doctor-applied.json` watermark. It cannot ride the `harness-policies` acceptance point (every `buildAcceptanceChecklist` entry is `severity: 'blocker'`, `scripts/doctor.cjs:1605-1612`). The Stop-hook entry in `hooks/hooks.json` follows the `check-card-fire.cjs` shape (lines 209-211) within the 3000ms budget.
- **D-04a:** A cockpit statusline chip is filed as a co-design proposal only (the orphan `~/.mindrian/voice-mark.json` side-channel that `lib/statusline/cockpit-signals.cjs:28-33,129` reads with no writer makes it cheap), never built in this phase (navigator HARD RULE: the statusline is co-designed, never a solo pick).

### Claude's Discretion

- Runner internals the navigator did not need to see: sequential vs parallel policy spawn, per-policy timeouts, report layout beyond the decided fields, JSONL rotation, the exact `_schema.json` wording, and which existing test file each new test mirrors. The planner decides; the spec's section 8 and 13 bound the choices.

### Folded Todos (locked constraints for every 298 plan and executor)

- **Never git stash mid-merge**: never `git stash`; take baselines with `git show HEAD:<path>`. A popped foreign stash cost a recovery on 2026-09-07.
- **Mirror the gate_render description fix into Theo**: a T-side task; folded only as a cross-repo note already carried in `.planning/coordination/2026-09-07-M-TO-T-harness-v2-compatibility-brief.md`. No 298 work.
- **F7 rescope 212/213 against registerCapability**: folded as a reminder only. When policies for eureka-phase gates are declared in a later slice, check the `registerCapability` interplay. No slice-1 work.
- **Ingest skill-description insight into Brain**: T-side note only. No 298 work.

### Deferred Ideas (OUT OF SCOPE)

- **INV-1 validator defect** (`lib/memory/validators/navigation-invariants.cjs` applies the 8 `brain_md_*` trace fields to every trace entry; four of five `persistDecisionTrace()` writers in `scripts/intent-classifier.cjs` at 2802, 2999, 3186 never carry them, so a room that exercised the binding-gate flow shows 8 x N guardian violations). Plugin defect; open a `/gsd-debug` slug to scope INV-1 by entry kind. This phase avoids the noise by keeping the fixture free of `.mindrian/decision-traces/`; it does not fix the validator.
- **Cockpit voice chip**: co-design proposal per the statusline HARD RULE. Not built here.
- **SEED-037 4c** (heal the ~16 rooms whose derive queues were cleared before the fix): human-gated repair, separate from the 4d monitor built here.
- **Phase 297's roadmap entry**: mark absorbed by 298 (a `/gsd-phase` edit at plan time).
- **CHANGELOG hygiene**: 107 pre-existing em-dashes in older entries; a separate sweep.
- **Slice 3 mechanism**: `scripts/doctor.cjs --point <id>` (a read of the existing acceptance list) if absent; belongs to the slice that migrates the 21 doctor modules.
</user_constraints>

<phase_requirements>
## Phase Requirements

The ROADMAP maps no requirement IDs to this phase. The binding list is the 11 numbered requirements in `298-SPEC.md`. Each is restated in one line with the research finding that makes it plannable.

| ID | Requirement (abridged from 298-SPEC.md) | Research support (where the planner copies identifiers from) |
|----|------------------------------------------|--------------------------------------------------------------|
| R-01 | Manifest v2 adds exactly three top-level keys (`policies`, `larry_surfaces`, `fixture_ref`); `maps` stays exactly three; byte-stable CJS generator, no new deps | "The v1 manifest as it exists" - names the 6 functions to extend, the 2 allowlists to widen, and the 3 assertions that pin `maps.length === 3` |
| R-02 | `data/harness-policies/` with a closed `_schema.json`; every `check-*.cjs` gate and every doctor module reachable from one policy entry | "Gate and module inventory" (full table, 35 gates + 21 modules) plus "The `_schema.json` precedent" (`data/hitl-shape-declaration-schema.json`) |
| R-03 | Every policy carries `declared | logged | blocking`; promotion is a human one-line edit against a `promotion_rule`; the runner never promotes | "The promotion evaluator" - where `evaluatePromotion` lives, the JSONL row shape, the MINDRIAN_HOME precedents |
| R-04 | `scripts/run-harness.cjs` tiered `--check`; `--room` convergence from Layer 0 alone; fixture is a second-run no-op | "Layer-0 convergence reads" - **contains the three highest-impact corrections in this document** (`computed:` is a timestamp; `total_entries` is 13 not 0; `venture_stage` is derived Investment) |
| R-05 | `gate-graph-derive-health` built here at rung `logged`; runner refuses `converged: true` while it is a ghost or the queue is non-empty | "SEED-037 4d" - **the detection engine already ships** (`detectRoomHealth`); the new script must be a thin CLI wrapper, not a reimplementation |
| R-06 | Larry's three surfaces declared; `contract-parity-larry` fails `--check` on a dropped phrase or a busted 1,950-byte budget; nine frozen-phrase tests intact | "Larry's three surfaces" - the exact per-surface phrase set with the test that already pins each one, plus the measured 1,944-byte reading and the 6-byte headroom |
| R-07 | The persona states, and `memory-write-policy.json` declares, D3/D4/D5 (routing, channels, silent `memory_event`, basket at >= 2, `NOT_REMEMBERED_BECAUSE`, never narrated) | "Larry's three surfaces" (where prose lands, byte cost) plus "The F.8 governance basket" (the basket mechanics D4 depends on) |
| R-08 | `lib/hmi/turn-text.cjs` lifts the transcript reader; card-fire repointed; `scripts/check-voice-style.cjs` log-only Stop hook via `lib/hmi/voice-style-log.cjs`, always `continue: true` | "The Stop-hook contract and the card-fire precedent" - the exact 6-function dependency closure of the reader, the envelope contract, the schema gate that will scan the new script |
| R-09 | `doctor.cjs --acceptance` gains one `harness-policies` point in the shape of `worktree-hygiene`, wired only after slice 1 is green | "Gate and module inventory" -> the `worktree-hygiene` acceptance point verbatim at `scripts/doctor.cjs:1313-1364` |
| R-10 | `recipe-maps.cjs` tolerates the new keys and exposes `policies`; `command-registry.json` and the T-side sync payload unchanged | "The v1 manifest as it exists" -> `_loadManifest()` is an explicit-allowlist rebuild, so unknown keys are silently DROPPED, not fatal; `policies` needs an explicit line |
| R-11 | Five new tests; existing 167/201/235, nine frozen-phrase tests, `no-instructions.test.cjs`, `test-doctor-acceptance-self-coverage`, `check-hook-schema-compatibility` stay green | "Tests: conventions and the live baseline" - **two of the five manifest-cluster tests are RED at HEAD for pre-existing reasons**; the planner must decide repair vs. record |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Treat these with the same authority as locked decisions. Every one was checked against the phase scope.

| Directive | Where it bites in 298 |
|-----------|------------------------|
| Working directory is `/home/jsagi/dev/MindrianOS-Plugin/` only, never `~/.claude/plugins/*` | Every command in every plan; the fixture is committed from here |
| CJS only, no TypeScript; `process.argv` switch-case CLI, no Commander/yargs | `run-harness.cjs`, `check-voice-style.cjs`, `check-graph-derive-health.cjs`, `turn-text.cjs`, `voice-style-log.cjs` |
| No new dependencies; node built-ins only; no YAML | `_schema.json` is hand-rolled validation, not ajv; the policy files are JSON |
| No em-dashes anywhere; use hyphens | **Live hazard**: a compute-state-regenerated STATE.md contains 2 literal U+2014. See Pitfall 3 |
| Every directory gets a `ROOM.md` (ICM Layer 0) | Precedent check: `data/` has `ROOM.md`; its three existing `*-fixtures/` subdirectories do NOT. The rule governs user Data Rooms, not repo `data/` subdirs. The design's own tree calls for `data/harness-policies/CONTEXT.md` (the L2 contract idiom), which is the right analogue |
| `lib/core/navigation.cjs` is the single SQL navigation chokepoint | The runner reads proposed-claim counts through `navigation.openRoomDbReadOnlyForCaller` (re-exported at `lib/core/navigation.cjs:486`), which satisfies both "via navigation.cjs" (R-04) and D-03a in one move |
| Canon Part 8: no user content to Brain; the manifest is `methodology_tier=mindrian-operation` machinery metadata | Widen `NODE_FIELD_ALLOWLIST` by exactly three names; the part8-boundary test's CHECK 1 enforces it |
| Canon Part 9: only a human confirms a truth claim | The basket is the confirm surface; the runner only COUNTS proposed nodes, never promotes one |
| Canon Part 11: one governed path, born wired or excluded | `run-harness.cjs` is a script, not an invocable surface, so it does not enter the connector registry; confirm at plan time against `scripts/build-new-surface.cjs`'s own rule |
| Canon Part 12: pedagogy/invisibility | No policy may make Larry narrate a memory operation |
| Explicit `git add <paths>`; never `git stash` | Every plan's commit step |
| All dev work runs through a GSD workflow | This phase; no direct edits |
| Grounding: consult the authoritative source, not a habitual one | Context7 was unreachable this session; the node:sqlite claim is a live probe with its provenance stated |

---

## Summary

Phase 298 is not a greenfield build. Nearly every piece the spec calls for has a shipped ancestor in this repo, and the single largest planning risk is re-implementing something that already exists. Three concrete instances: the SEED-037 4d detection signal already ships as `detectRoomHealth()` in `lib/core/doctor/graph-derive-health-module.cjs` (Phase 233, v1.15.3-beta.49); the transcript reader the spec asks to "lift" is a six-function closure inside `check-card-fire.cjs`, not a single function; and the read-only room.db door D-03a demands already exists and is already re-exported through the `navigation.cjs` chokepoint. The work in 298 is therefore mostly DECLARATION plus THIN WRAPPING plus ONE genuinely new artifact (the runner), which is exactly what SEED-032 says ("declare what runs, add no framework").

The second finding reshapes requirement 4. The spec says the runner decides convergence from "STATE.md `computed:` vs on-disk counts". That is not what `computed:` is. `scripts/compute-state:257` emits `computed:` as an ISO **timestamp**; the count key is `total_entries` at line 259. Worse, a scaffold-born room is not empty: running `compute-state` against a freshly scaffolded 11-section room yields `total_entries: 13` (the 11 per-section `CONTEXT.md` files plus `references/SECTION-SCHEMA.md` and `SUB-SCHEMAS.md`, because the counter is `find -maxdepth 1 -name '*.md' ! -name ROOM.md`). It also derives `venture_stage: Investment`, not the scaffold's `Pre-Opportunity`, because the derivation is purely directory-presence-based and a full scaffold satisfies every branch. D-03's "the runner ignores `venture_stage` on the fixture" is therefore not a stylistic call; it is load-bearing. And the regenerated STATE.md carries two literal em-dashes and two raw ANSI escape sequences, both traceable to `lib/core/visual-ops.cjs:529`, which would be committed into the repo under a house rule that forbids em-dashes.

The third finding is a baseline honesty problem. Requirement 11 says tests 167/201/235 "stay green". Two of the five manifest-cluster tests are RED at HEAD right now, and neither failure has anything to do with 298: Phase 235-01 collapsed three divergent pre-commit sources into one canonical file and emptied `scripts/install-pre-commit.sh` of hook content, but `tests/test-harness-manifest-precommit-wiring.cjs` (5 of 6 checks) and `tests/test-harness-167-verdict.cjs` (the D-167-03 check) still assert against that now-empty file. The guard itself is live and correct in `scripts/hooks/pre-commit-room-minto-guard.sh:438-442`. A plan that says "existing tests stay green" without naming this will either look like it broke them or will quietly widen scope to fix them.

**Primary recommendation:** Plan slice 1 as five thin, separately-verifiable deliverables in this order - (1) the policy directory plus `_schema.json` and the generator's v2 keys and validation, (2) `check-graph-derive-health.cjs` as a CLI wrapper over the shipped `detectRoomHealth`, (3) the fixture built once and hand-scrubbed of em-dashes and ANSI, (4) `run-harness.cjs` reading only through `navigation.openRoomDbReadOnlyForCaller` and comparing `total_entries` rather than `computed:`, (5) the voice rung-2 trio and the F.8 basket rows. Wire the `harness-policies` acceptance point last, only after 1 through 4 are green, per the D-4 precedent from quick 260906-t3s. Record the two pre-existing red tests as a named baseline before touching anything.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Declaring which policies exist and at what rung | Layer 2 Contracts (`data/harness-policies/*.json`) | Layer 3 Reference | A rung is a contract about enforcement, not a runtime decision. It must be diffable in one line (D8) |
| Fingerprinting the declared harness | Layer 2 Contracts (`data/harness-manifest.json`, generated) | - | The manifest digests directories and files; it never enumerates rows (D-167-01, HIGH-1) |
| Executing a policy and reporting a verdict | Build/CI tier (`scripts/run-harness.cjs`) | Layer 2 (reads the contract) | The runner executes POLICY, never cognition (SEED-062). It is a script, not an invocable surface |
| Deciding whether a room is converged | Layer 0 Identity (ROOM.md, STATE.md frontmatter) | Layer 4 Artifacts (on-disk counts) | Convergence is a scan of identity and artifacts, not a memory. Zero writes |
| Counting proposed truth claims | Layer 4 Artifacts (room.db nodes) via the navigation chokepoint | - | Canon Part 9: SQL is the local mind and `navigation.cjs` is the only door. Read-only door only (D-03a) |
| Detecting derive health | Build/CI tier (new check script) | `lib/core/doctor/` (existing `detectRoomHealth`) | The signal already exists and has two consumers; a third consumer is a wrapper, never a copy |
| Observing Larry's voice at turn close | Hook tier (Stop hook) | `~/.mindrian` local log | The transcript is only visible at the Stop event; the log is local-only under Canon Part 8 |
| Reporting evidence counts to a human | `lib/core/doctor/` module (informational) | `scripts/run-harness.cjs --policy <id>` (the same evaluator) | Every acceptance point is a blocker; informational reporting belongs in a doctor MODULE (D-04) |
| Confirming a truth claim | HMI tier (F.8 card) | `lib/core/navigation.cjs` (the write) | Canon Part 9: only a human confirms. The card is the navigator's surface |
| Carrying Larry's contract phrases | Persona tier (3 prose surfaces) | Layer 2 (the manifest holds the invariant, never the sentence) | "Prose stays prose; the manifest holds invariants, not sentences" (design section 2) |

## Standard Stack

There is no third-party stack in this phase. This is a deliberate, locked constraint (D-167-01, CLAUDE.md), not an omission.

### Core

| Library | Version | Purpose | Why standard |
|---------|---------|---------|--------------|
| `node:fs`, `node:path` | Node >= 22.16.0 (running v22.23.1, verified `node --version`) | Every file read and the byte-stable JSON write | The three shipped generators use nothing else [VERIFIED: `scripts/build-harness-manifest.cjs:56-58`] |
| `node:crypto` | same | sha256 digests for the manifest entries | `digestBytes()` at `build-harness-manifest.cjs:206-208` is the single digest helper [VERIFIED: source] |
| `node:child_process` (`spawnSync`) | same | The runner spawning a policy's runner script; the doctor acceptance point spawning the runner | `worktree-hygiene` at `scripts/doctor.cjs:1338-1345` is the exact template [VERIFIED: source] |
| `node:sqlite` (`DatabaseSync`) | same | Read-only room.db counts, reached only through `navigation.cjs` | The floor is v22.16.0 because that is where the `timeout` constructor option starts working [CITED: CLAUDE.md Technology Stack] |
| `node:os` | same | `os.homedir()` in the `MINDRIAN_HOME` resolver idiom | 4 shipped files use exactly this line [VERIFIED: grep, listed below] |

**Installation:** none. `npm install` adds nothing for this phase.

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `_schema.json` validation | `ajv` or `zod` | Forbidden. `zod ^3.25.76` IS already a dependency (for the MCP SDK), so the temptation is real, but the generator is a build-time script with no MCP context and `data/hitl-shape-declaration-schema.json` establishes the hand-rolled closed-vocabulary precedent [VERIFIED: `package.json` + `data/hitl-shape-declaration-schema.json`] |
| A new shared `mindrianHome()` module | Keep inlining the two-line resolver | The repo inlines it in 4 places today. A 5th and 6th inline is consistent; extracting it is a Part 7 refactor that would touch `check-card-fire.cjs`, which R-08 is already modifying. **Recommendation: inline it, matching `card-fire-health-module.cjs:41-43`** which already exports its own `interceptLogPath` for hermetic tests |
| `openGraph` from `lib/core/lazygraph-ops.cjs` | - | Explicitly forbidden by D-03a; it runs `initSchema` on first touch and would dirty the fixture on run one |

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages. The Standard Stack is entirely Node.js built-in modules shipped with the runtime, plus repo-internal CJS modules. No `npm install`, no `pip install`, no registry lookup, and therefore no slopsquatting surface. `slopcheck` was not run because there is nothing to check.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

If any plan introduces a dependency, that alone breaks D-167-01 and CLAUDE.md and should be treated as a scope breach, not a package-vetting problem.

---

## The v1 manifest as it exists (research item 1)

### `scripts/build-harness-manifest.cjs` (539 lines) [VERIFIED: full read]

The 3-branch `main()` at line 507: `--check` -> `runCheck()`; everything else -> `writeManifest()`. `--refresh` is named for parity with the connector generator but takes the same write branch (comment at 515-517).

**Exports the v2 generator must extend** (module.exports at line 524-538):

| Export | Line | What v2 does to it |
|--------|------|--------------------|
| `buildManifest()` | 272 | Add three keys to the returned object. Do NOT reorder the existing five |
| `buildMapEntry(binding)` | 235 | Untouched. `maps` stays three |
| `buildSurfaceEntry(binding)` | 255 | The `{role, path, digest}` triple. `larry_surfaces` entries have the same shape and can reuse this function verbatim |
| `serializeManifest(manifest)` | 293 | Add the three keys to the `clean` object in a stable order, after `runtime_surfaces` |
| `validateManifest(manifest)` | 335 | Add policy-file validation and the `contract-*` inline checks; keep the `{stale, unresolved, malformed}` three-array return shape |
| `digestBytes(buf)` | 206 | Reuse for the policy-directory digest and the fixture digest |
| `primaryArrayCount(buf, key)` | 216 | Reuse if `policies.count` is derived from a JSON array; otherwise the count is a directory-entry count |
| `MAP_BINDINGS` | 91 | Frozen, three entries. Never grows |
| `RUNTIME_SURFACE_BINDINGS` | 133 | Frozen, four entries. `larry_surfaces` is a SEPARATE frozen array; do not append Larry into this one, or `test-201-harness-manifest.cjs`'s `EXPECTED_SURFACE_ROLES` (length-4 assertion) goes red |
| `NODE_FIELD_ALLOWLIST` | 166 | Add exactly `policies`, `larry_surfaces`, `fixture_ref` |
| `ENTRY_FIELD_ALLOWLIST` | 180 | `['role','path','digest','source_count']`. `larry_surfaces` entries fit without change. `policies` and `fixture_ref` are OBJECTS not array entries, so they are governed by `NODE_FIELD_ALLOWLIST` only. **The part8-boundary test only applies `ENTRY_FIELD_ALLOWLIST` to `maps` entries** (`tests/test-harness-manifest-part8-boundary.cjs:143-150`), so no change is needed there |
| `MANIFEST_PATH` | 66 | Unchanged |

**What must stay byte-identical:** `maps` (exactly three entries, pinned three separate ways - `test-harness-manifest-check.cjs:63`, `test-harness-167-verdict.cjs:105` and `:153` and `:368`); `data/command-registry.json` and `lib/core/recipe-maps.cjs`'s three read-joins (the T-side sync payload, per the 0bc3304b brief).

**The digest computation:** `digestBytes` is sha256 over raw on-disk bytes. A missing source yields the sha256 of the empty buffer as a stable sentinel (line 237), so the manifest stays byte-stable when a source is absent and `--check` flags it as UNRESOLVED. The v2 `policies` digest over a DIRECTORY has no shipped precedent in this file; the planner must pick a deterministic composition rule (recommended: sort file names, concatenate `name + "\0" + sha256(bytes) + "\n"`, digest the result - deterministic across filesystems, and a file rename changes the digest, which is correct).

**`runtime_surfaces` drift check:** `validateManifest` lines 424-457 re-digests each of the four surface files against the COMMITTED manifest and pushes a role-named STALE finding on divergence. `larry_surfaces` should copy this loop exactly.

### `data/harness-manifest.json` v1 shape [VERIFIED: full read]

`{ontology_ref, generated_note, methodology_tier: "mindrian-operation", version: 1, maps: [3], runtime_surfaces: [4]}`. Live counts: posture 113, wiring 209, ranked_next_reach 384.

### `lib/core/recipe-maps.cjs` consumers [VERIFIED: read at 138-162, 400-438]

**Critical for R-10.** `_loadManifest()` at line 138 does NOT spread the parsed JSON. It rebuilds an object from an explicit four-key allowlist (`methodology_tier`, `version`, `maps`, `runtime_surfaces`). Consequences:

- **Unknown top-level keys do NOT break it.** They are silently dropped. So manifest v2 lands without touching this file at all, and the "tolerates the new keys" half of R-10 is already true today.
- **`policies` will NOT be exposed** unless a line is added. The "exposes `policies`" half of R-10 is a two-line change: add `policies: (parsed && typeof parsed.policies === 'object') ? parsed.policies : null,` in the try block and the matching `policies: null` in the catch degrade at line 159.
- `postureForCommand` (line 177) reads NOTHING from the manifest - it delegates to `validateChainAutonomy` against `command-registry.json` via the command-resolver. So the manifest change cannot affect it. `test-201-harness-manifest.cjs` Task 3 is the regression guard that proves this.
- `__reset()` at 417 clears `_manifestCache`; new tests need it.

### The pre-commit drift guard [VERIFIED: source + `cmp`]

`scripts/hooks/pre-commit:428-443`. Path-scoped trigger fires when any of five staged paths matches, then runs `node "$REPO_ROOT/scripts/build-harness-manifest.cjs" --check` and exits 2 on drift. `scripts/hooks/pre-commit` and `scripts/hooks/pre-commit-room-minto-guard.sh` are BYTE-IDENTICAL (31044 bytes, `cmp -s` returns identical). `scripts/install-pre-commit.sh` byte-copies the `-room-minto-guard.sh` file and authors no hook content of its own (Phase 235-01, CIRS-01).

**v2 impact:** the trigger regex at line 440 lists five paths. It does NOT include `data/harness-policies/` or `data/harness-fixtures/`. Staging a policy file therefore will NOT fire the drift guard, so a policy edit could land with a stale manifest. **The planner must widen that regex** (a single anchored alternation add), or the manifest's `policies` digest silently rots. This is the same class of gap the phase exists to close.

### `scripts/build-new-surface.cjs` [VERIFIED: grep at 430-440, 584-597]

Two touchpoints. Line 438 spawns the generator (write path) after registering a surface. Lines 584-597 spawn `--check` and raise `MANIFEST_STALE` on non-zero. Neither reads the manifest's keys, so v2 is transparent to it. The only risk: if `--check` starts failing for a POLICY reason, `build-new-surface` will report it as `MANIFEST_STALE`, which is a misleading label. Low severity, worth a note in the policy `notes` field.

---

## Gate and module inventory (research item 2)

### The `scripts/check-*.cjs` set

`ls scripts/check-*.cjs | wc -l` returns **37**, but two of those are `.test.cjs` companions (`check-pending-breakthrough.test.cjs`, `check-shape-declaration.test.cjs`), so the real gate count is **35**. The design doc's "37" is the glob count. The planner should use 35 as the migration denominator and say so.

Flags and exit codes were extracted mechanically (`grep -oE '--(json|root|strict|advisory|...)'` and `grep -oE 'process\.exit\([0-9]+\)'` over each file), so "flags" means "the literal appears in the file", which is a strong but not perfect proxy for "the flag is parsed". Treat a single-flag row as needing a 30-second confirm at plan time.

| Script | Flags present | Exit codes | Natural rung | Has an evidence log today |
|---|---|---|---|---|
| check-abstraction-fixture-neutral.cjs | `--check` | 0,1 | blocking | no |
| check-admin-identity.cjs | `--json` | (none literal) | declared | no |
| check-brain-tool-liveness.cjs | none | 2 | blocking (in verify-release) | no |
| check-card-fire.cjs | none (stdin envelope) | 0 | logged | **YES** - `~/.mindrian/card-fire-intercepts.log`, TTL-pruned. The D8 precedent |
| check-cirs-declaration.cjs | `--check` | 1,2 | blocking | no |
| check-deck-design.cjs | `--check --strict` | 0,2 | declared | no |
| check-dual-graph-health.cjs | `--check` | 1 | logged | no |
| check-first-touch-drift.cjs | none | 0,1,2 | logged | no |
| check-flagship-floor.cjs | none | 1,2 | declared | no |
| check-framework-vocabulary-drift.cjs | `--check` | (none literal) | logged (in release.sh) | no |
| check-gate-seam.cjs | none | 1,2 | blocking (verify-release) | no |
| check-graph-export-typemap.cjs | none | 0,1,2 | blocking | no |
| check-help-coverage.cjs | `--json` | (none literal) | declared | no |
| check-hitl-stages.cjs | `--check` | 1 | blocking | no |
| check-hook-schema-compatibility.cjs | none | 0,1,2 | blocking (verify-release) | no |
| check-kuzu-reintroduction.cjs | `--root` | 0,1,2 | blocking (verify-release) | no |
| check-onboard-statusline.cjs | `--fix --json` | 0 | declared | no |
| check-palette-consistency.cjs | `--json` | (none literal) | declared | no |
| check-pending-ambiguous.cjs | none | 0 | logged | no |
| check-pending-breakthrough.cjs | none | 0 | logged | no |
| check-pending-naming-decision.cjs | none | 0 | logged | no |
| check-plugin-path-anchoring.cjs | `--check --json` | (none literal) | blocking (verify-release) | no |
| check-publish-needs.cjs | `--check` | 0,1 | declared | no |
| check-render-coverage.cjs | `--check` | 1 | blocking (release.sh) | no |
| check-research-isomorphism.cjs | `--room` | 0,1 | declared | no |
| check-reward-before-investment.cjs | none | 0,1,2 | blocking (verify-release) | no |
| check-room-blueprints.cjs | `--check` | 0,1 | declared | no |
| check-schema-aliases.cjs | `--check` | 0,1 | blocking (pre-commit) | no |
| check-shape-declaration.cjs | `--check --strict` | 1,2 | **logged** (advisory WARN since Phase 210; `--strict` restores hard fail) | no - slice-1 target |
| check-skill-spec.cjs | `--check --strict` | 1,2 | declared | no |
| check-skill-vs-code-drift.cjs | `--json` | 1 | declared | no |
| check-substrate.cjs | `--check` | 0,1 | declared | no |
| check-tool-honesty.cjs | `--check --strict` | 1,2 | **logged** (advisory, release.sh) | no - slice-1 target |
| check-version-and-sha.cjs | none | 0,1,2 | blocking | no |
| check-worktree-hygiene.cjs | `--advisory --check --json --root --strict-planning --strict-ephemeral --prune --confirm --exclude --help` | 0,2 | **blocking** (already an acceptance point) | no - slice-1 target |

**Which already fit "declared / logged / blocking" naturally:** the six in `scripts/verify-release` (brain-tool-liveness, gate-seam, hook-schema-compatibility, kuzu-reintroduction, plugin-path-anchoring, reward-before-investment) and the four in `scripts/release.sh` (framework-vocabulary-drift, render-coverage, shape-declaration, tool-honesty) are already de-facto `blocking` or `logged`; declaring them is a transcription. **Which have no evidence log at all: 34 of 35.** Only `check-card-fire.cjs` writes a JSONL evidence log. That is why the phase must build `voice-style-log.cjs` rather than reuse a general one, and why D8's "promoted only on logged evidence" means most policies enter at `declared` and stay there for a long time. State that plainly in `notes`.

**`--json` support is rare** (7 of 35). `check-worktree-hygiene.cjs` is the only script with the full `--root --json --advisory --check` quartet, which is exactly why the design names it as the shape to copy. Its `main()` argv loop (`scripts/check-worktree-hygiene.cjs`, `function main()`) accepts `--check` as an explicit no-op default and exits 2 on an unknown flag. **Copy that loop into `run-harness.cjs`, `check-voice-style.cjs` and `check-graph-derive-health.cjs`.**

### The 21 doctor acceptance MODULES [VERIFIED: `node -e` over `data/doctor-modules.json`]

Registry-only wiring: one entry, no engine change. Per-entry contract is `{id, introduced_version, cadence, flag, fix_supported, runner, description}`.

| id | introduced_version | cadence | flag | fix_supported | runner |
|---|---|---|---|---|---|
| capability-ledger | 2.0.0-beta.12 | always | null | false | lib/core/doctor/capability-ledger-module.cjs |
| mcp-surface | 2.0.0-beta.12 | always | null | false | lib/core/doctor/mcp-surface-module.cjs |
| umbilical | 1.13.1-beta.4 | once | null | true | lib/core/doctor/umbilical-module.cjs |
| card-fire-health | 1.15.3-beta.12 | always | cardFireHealth | false | lib/core/doctor/card-fire-health-module.cjs |
| mode-select-checkpoint | 1.15.3-beta.19 | always | null | false | lib/core/doctor/mode-select-checkpoint-module.cjs |
| ui-compliance | 1.12.1-beta.1 | always | uiCompliance | false | lib/core/doctor/ui-compliance-module.cjs |
| stale-first-touch-copy | 1.13.1-beta.4 | always | staleFirstTouch | false | lib/core/doctor/stale-first-touch-copy-module.cjs |
| deprecated-usage | 1.13.0-beta.19 | always | deprecatedUsage | false | lib/core/doctor/deprecated-usage-module.cjs |
| plugin-enabled-state | 1.13.1-beta.4 | always | null | false | lib/core/doctor/plugin-enabled-state-module.cjs |
| cascade-rooms | 1.12.1-beta.1 | always | cascadeRooms | true | lib/core/doctor/cascade-rooms-module.cjs |
| cascade-rooms-active | 1.12.1-beta.1 | always | cascadeRooms | false | lib/core/doctor/cascade-rooms-active-module.cjs |
| room-md | 1.12.1-beta.1 | always | roomMd | true | lib/core/doctor/room-md-module.cjs |
| statusline-visibility | 1.12.5 | always | statuslineVisibility | true | lib/core/doctor/statusline-visibility-module.cjs |
| install-incomplete | 1.13.0-beta.9 | always | statuslineVisibility | true | lib/core/doctor/install-incomplete-module.cjs |
| verify-surface | 1.12.1-beta.1 | always | verifySurface | false | lib/core/doctor/verify-surface-module.cjs |
| install-state | 1.13.0-beta.13 | always | installState | true | lib/core/doctor/install-state-module.cjs |
| deployment-surfaces | 1.13.0-beta.13 | always | installState | true | lib/core/doctor/deployment-surfaces-module.cjs |
| room-graph-density | 1.15.3-beta.47 | always | null | false | lib/core/doctor/room-graph-density-module.cjs |
| graph-derive-health | 1.15.3-beta.49 | always | graphDeriveHealth | true | lib/core/doctor/graph-derive-health-module.cjs |
| graph-derive-heal-retrofit | 1.15.3-beta.49 | once | null | false | lib/core/doctor/graph-derive-heal-retrofit-module.cjs |
| eureka-fts-health | 1.15.3-beta.51 | always | null | false | lib/core/doctor/eureka-fts-health-module.cjs |

**Slice 3 blocker confirmed:** `grep -n "'--point'\|--point\b" scripts/doctor.cjs` returns **nothing**. `--point <id>` does not exist. The design's slice-3 runner shape (`scripts/doctor.cjs --point <id>`) requires adding that flag first. Deferred per CONTEXT; do not attempt it in slice 1.

### The 20 acceptance POINTS

`buildAcceptanceChecklist` in `scripts/doctor.cjs` carries 20 points. Their ids in file order: `install-state`, `deployment-surfaces`, `version-of-record-repo`, `verify-release`, `version-of-record-published`, `npx-roundtrip`, `doctor-all`, `coverage-gate`, `session-start-active-version`, `verify-release-clean-tree`, `frontmatter-yaml-validity`, `release-dry-run-output`, `working-tree-housekeeping`, `worktree-hygiene`, `activation-reached-the-wire`, `agentshield-all-surfaces-clean`, `eureka-smoke-stack-ready`, `eureka-fts-index-visible`, `capability-ledger-fresh`, `mcp-surface-tool-count`.

**Every single one is `severity: 'blocker'`.** Verified by sorting the unique third field of `grep -n "severity:" scripts/doctor.cjs`: the only value inside `buildAcceptanceChecklist` is `'blocker'` (the `'high'`, `'info'`, `'warn'` hits at lines 3658-3693 are in a different, unrelated function). The `eureka-fts-index-visible` point's own comment at `scripts/doctor.cjs:1605-1612` states this explicitly and explains why logic, not severity, is the lever. **This is the mechanical proof behind D-04**: the voice-style count cannot ride an acceptance point.

### `harness-policies` acceptance point: the exact template

`scripts/doctor.cjs:1313-1364`, the `worktree-hygiene` entry. Copy structure verbatim:

```javascript
{
  id: 'harness-policies',
  label: '...',
  severity: 'blocker',
  applies_to: ['pre-tag', 'full'],
  run: async function () {
    if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'harness-policies') {
      return { ok: false, finding: 'harness-policies synthesized failure (test mode)', detail: {} };
    }
    const cp = require('child_process');
    const scriptPath = path.join(pluginRoot, 'scripts', 'run-harness.cjs');
    if (!fs.existsSync(scriptPath)) {
      return { ok: false, finding: 'harness-policies: script missing at ' + scriptPath, detail: { note: 'script missing' } };
    }
    try {
      const r = cp.spawnSync('node', [scriptPath, '--check', '--json'], { encoding: 'utf8', timeout: 30000, cwd: pluginRoot });
      let parsed;
      try { parsed = JSON.parse(r.stdout || '{}'); }
      catch (e) { return { ok: false, finding: 'harness-policies: could not parse script output: ' + e.message, detail: { stdout: (r.stdout || '').slice(-500), stderr: (r.stderr || '').slice(-500) } }; }
      const ok = r.status === 0;
      return { ok: ok, finding: ok ? null : '...', detail: { ... } };
    } catch (e) {
      return { ok: false, finding: 'harness-policies threw: ' + e.message, detail: {} };
    }
  },
}
```

Four features to preserve: the `DOCTOR_TEST_FAIL_POINT` test seam, the script-missing guard BEFORE the spawn, the parse-failure branch that truncates stdout/stderr to the last 500 chars, and `applies_to: ['pre-tag','full']`. The PASS/FAIL finding-suffix idiom the D-02 verdict must echo is at `scripts/doctor.cjs:3008-3010`:
`const tag = p.ok ? 'PASS' : 'FAIL'; const findingSuffix = p.finding ? '  -- ' + p.finding : ''; console.log(tag + '  ' + p.id + ': ' + p.label + findingSuffix);`

---

## The Stop-hook contract and the card-fire precedent (research item 3)

### The transcript reader is a six-function closure, not one function [VERIFIED: full read of the region]

`readTranscriptTurn(transcriptPath)` at `scripts/check-card-fire.cjs:1411-1502` returns `{output_text, askuserquestion_fired, gate_signature, preceding_user_text, preceding_user_text_source}`. Lifting it into `lib/hmi/turn-text.cjs` pulls in:

| Dependency | Line | Nature |
|---|---|---|
| `readTranscriptTail(transcriptPath)` | 1507 | Pure. WR-08 tail cap. Lifts cleanly |
| `TRANSCRIPT_TAIL_BYTES` | 250 (`2 * 1024 * 1024`) | Constant. Lifts cleanly |
| `extractAssistantText(content)` | ~1533 | Pure string flattening. Lifts cleanly |
| `classifyPrecedingUserContentSource(content)` | 1567 | Pure. Returns `'typed' \| 'tool_result' \| 'none'`. Lifts cleanly |
| `scanContentForAskUserQuestion(content)` | 1595 | Pure. Lifts cleanly |
| `gateSignature(outputText)` | 386 | **Does NOT lift cleanly.** It requires `lib/core/gate-relevance.cjs` (option-label extraction) and `ASCII_BOX_GLYPH_RE` / `matchedGlyphSpan` (486). It is card-fire domain logic, not turn-text |

**Recommended lift boundary (Claude's discretion, spec section 8 bounds it):** `lib/hmi/turn-text.cjs` exports the five clean pieces plus a `readTurnText(transcriptPath) -> {output_text, preceding_user_text, preceding_user_text_source, assistant_contents}` that STOPS SHORT of `gateSignature`. `check-card-fire.cjs` then calls `turnText.readTurnText(...)` and computes `askuserquestion_fired` and `gate_signature` locally from `assistant_contents` and `output_text`. This keeps card-fire's behavior byte-equivalent (its 21 exports at 1917-1964 are consumed by `lib/mcp/stop-gate-handler.cjs` and by `card-fire-health-module.cjs:105`, so signature changes are expensive), and gives `check-voice-style.cjs` exactly what it needs (the last assistant turn's text) with zero card-fire coupling.

**Card-fire's exports have two live consumers** that pin the seams: `lib/core/doctor/card-fire-health-module.cjs:105` asserts `classifyCardFire`, `gateReachingEntries`, `computeBackstopHit`, `loadRegistry` remain functions; `lib/mcp/stop-gate-handler.cjs` drives the six retry-store accessors. **Neither of those six/four names may change.** `readTranscriptTurn` and `readTranscriptTail` ARE exported (lines 1933-1934) and are not in either pinned set, so re-pointing them at the lifted module is safe.

### `MINDRIAN_HOME` resolution [VERIFIED: grep across `lib/` and `scripts/`]

There is no shared resolver function. Exactly four files inline the same two lines:
- `scripts/check-card-fire.cjs:176` (retry store) and `:185` (intercept log)
- `lib/core/card-fire-sidechannel.cjs:124`
- `lib/core/mode-select-sidechannel.cjs:78`
- `lib/core/doctor/card-fire-health-module.cjs:41-43` - **the one to copy**, because it wraps it in a named exported `mindrianHome()` plus a path helper `interceptLogPath()` exported "for hermetic tests" (line 158).

The idiom: `process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian')`. `voice-style-log.cjs` should export `mindrianHome()` and `voiceStyleLogPath()` the same way, so `test-298-voice-log.cjs` can point `MINDRIAN_HOME` at a scratch dir and assert isolation.

### The card-fire evidence log (the D8 precedent) [VERIFIED: read at 1236-1300]

`appendInterceptLog(turn, verdict)` at 1273. Record shape: `{ts (epoch ms), timestamp (ISO), session_id, reason, gate_signature, ran_entries, matched_glyph_span, output_text (capped at INTERCEPT_LOG_TEXT_CAP)}`. Write path: read-prune-append-rewrite (`readInterceptLogLines` at 1254 drops any record older than `RETRY_TTL_MS = 24h`, line 236), `fs.mkdirSync(recursive)`, then `writeFileSync(kept.join('\n') + '\n')`. Every error is swallowed: "a diagnostic log write must NEVER block or throw the Stop hook."

**Two direct lessons for `voice-style-log.cjs`:**
1. **The TTL will silently shrink a promotion window.** Card-fire's is 24 hours. A `promotion_rule` with `window_runs: 200` against a 24-hour-TTL log is unsatisfiable in practice. CONTEXT already flags this ("TTL pruning exists in card-fire and must not shrink a promotion window unnoticed"). **Recommendation: the voice log gets NO TTL, or a TTL measured in releases rather than hours, with the retention window stated in the same `notes` paragraph as the rung.** JSONL rotation is Claude's discretion per CONTEXT; make the retention decision explicit rather than inheriting 24h by copy-paste.
2. Every row must carry both `ts` (epoch ms, what `card-fire-health-module.cjs:79` reads for freshness) and a version stamp, since D-04's "since last release" needs one. `lib/core/repo-version.cjs::readRepoVersion()` returns `{version, root, pluginJson, packageJson, mismatch}` and reads `2.0.0-beta.28` on this tree - that is the version-stamp source. The `doctor-applied.json` watermark (`lib/core/migration-snapshot.cjs:211`) is the alternative.

### The Stop-hook envelope contract

`hooks/hooks.json` `hooks.Stop` is an array of 6 entries. Order as committed: `run-hook.cmd on-stop`, `operator-update.cjs`, `jtbd-update.cjs stop`, `hmi-compliance-poll.cjs --hook`, `gsd-graph-derive-sweep.cjs`, `check-card-fire.cjs`. The card-fire entry is at **`hooks/hooks.json:208-215`** (the CONTEXT's "lines 209-211" points at the inner `hooks`/`command`/`timeout` triple). Every entry carries `"timeout": 3000`.

The envelope: `silentSuccess()` at `scripts/check-card-fire.cjs:1383-1385` emits `{continue: true, suppressOutput: true}` at TOP LEVEL. **This is load-bearing.** `scripts/check-hook-schema-compatibility.cjs` is a release gate that reads the Stop array off `hooks.json` (never hand-guessed), follows one level of subprocess invocation, and greps the resulting file set for the literal `hookEventName: 'Stop'`, exiting 1 if found. Its header records four live occurrences of this defect class, including one that broke every turn for a real user on 2026-07-23. **`scripts/check-voice-style.cjs` must never emit a `hookSpecificOutput` block.** The gate passes at HEAD (verified: exit 0) and will scan the new script the moment it is registered.

`hmi-compliance-poll.cjs` is confirmed NOT the rung-2 home (D9): its header states it scans command surfaces for UI Ruling System drift via `doctor --ui-compliance --json` and writes a side-channel at `<roomDir>/.mindrian/last-hmi-poll.json`. It never reads a transcript.

### `detectVoiceMark` signature [VERIFIED: read at `lib/hmi/voice-color-mark.cjs:239`]

`detectVoiceMark(turnText) -> {hasMark, count, color, isNativeHost, valid}`. Primary path: the leading De Stijl emoji glyph against the frozen `MARK_GLYPHS` map (line 112); more than one De Stijl glyph in the text returns `valid: false` (the exactly-one contract). A leading non-De-Stijl colored block returns `{hasMark: false, valid: false}` (spoof rejection). Secondary path: bracketed color-name tags. Exports at 299-306 include `MARK_GLYPHS`, `COLOR_GLYPHS`, `NON_DESTIJL_GLYPHS`.

`check-voice-style.cjs`'s scan is therefore two lines of real work: `/[\u2014\u2013]/.test(text)` for the dash rule (written as escapes so this document and the source both stay hyphens-only), and `detectVoiceMark(text).valid` for the glyph rule. Everything else is plumbing.

---

## Layer-0 convergence reads (research item 4)

**This section contains the three highest-impact corrections in this document.** All three were established by running the real code against a real scaffolded fixture in a scratch directory (no repo file touched).

### Correction 1: `computed:` is a TIMESTAMP, not a count [VERIFIED: source + live run]

`scripts/compute-state:257-261` emits:

```
---
computed: ${timestamp}          # line 257 - an ISO-8601 timestamp
venture_stage: ${venture_stage} # line 258
total_entries: ${total_entries} # line 259
current_room: ${slug}           # line 260, CONDITIONAL
---
```

Live output against a fresh scaffold: `computed: 2026-09-07T18:24:07Z`.

**R-04 says the runner compares "STATE.md `computed:` vs on-disk counts". There is no count in `computed:`.** The comparable key is `total_entries` at line 259. The planner must write the requirement as "`total_entries` vs the on-disk entry count", and should note that `computed:` is a freshness stamp that will differ on every regeneration - which is precisely why the runner must never regenerate STATE.md (any byte-compare would fail on the timestamp alone).

`current_room` is conditional (line 260): it is emitted only when the room being computed IS the room registry's active room, resolved via a Python heredoc at lines 38-72 against `$MINDRIAN_ROOMS_HOME/.rooms/registry.json`. **The fixture must be generated with `MINDRIAN_ROOMS_HOME` pointed at a scratch dir (or on a machine with no matching active room), or a machine-specific `current_room:` line lands in the committed fixture.**

### Correction 2: a scaffold-born room has `total_entries: 13`, not 0 [VERIFIED: live run]

The counter at `compute-state:96` is `find "$section_dir" -maxdepth 1 -name "*.md" ! -name "ROOM.md" | wc -l`. A `scaffoldRoomSkeleton()` room writes a `CONTEXT.md` into all 11 ICM sections plus `SECTION-SCHEMA.md` and `SUB-SCHEMAS.md` into `references/`. That is 13 non-ROOM.md markdown files at maxdepth 1. Live: `total_entries: 13`.

The loop also skips hidden directories (`[[ "$section_name" == .* ]] && continue`, line 91), so `.context`, `.intelligence`, `.snapshots` never count, and `assets/` and `team/` count 0.

**Consequence for the runner:** the convergence check must reproduce that exact counting rule (top-level directories only, non-hidden, `*.md` at maxdepth 1, excluding `ROOM.md`), or `total_entries` will never match and the fixture will never report `converged: true`. Write it as a named function and unit-test it against the fixture.

### Correction 3: `venture_stage` derives to `Investment`, not `Pre-Opportunity` [VERIFIED: source at 129-149 + live run]

`scaffoldRoomSkeleton` writes `venture_stage: Pre-Opportunity` into its STATE.md frontmatter. `compute-state` re-derives it purely from directory presence (lines 129-149): `has_problem && has_solution && has_business && has_financial` -> `Investment`. A full 11-section scaffold satisfies every branch, so a scaffold-born room ALWAYS derives `Investment`. Live: `venture_stage: Investment`.

D-03's "the runner ignores `venture_stage` on the fixture" is therefore not stylistic - it is required, because the scaffold and the recomputation structurally disagree. Say so in the policy `notes`.

### The fixture is exactly 33 files [VERIFIED: live run]

Running `scaffoldRoomSkeleton(dir, {placeholder_slug: 'converged-room'})` produced `{ok: true, sections_created: [11], identity_files_created: [6], state_written: true, minto_written: true, user_written: true, contracts_created: [11], reference_docs_created: [2], errors: [], warnings: []}`, yielding **33 files across 17 directories plus the root**. D-03's "~33 text files" is exact.

The tree: `STATE.md`, `MINTO.md`, `USER.md`; 11 section dirs each with `ROOM.md` + `CONTEXT.md`; `references/` with `ROOM.md` + `SECTION-SCHEMA.md` + `SUB-SCHEMAS.md`; `team/`, `assets/`, `.intelligence/`, `.snapshots/`, `.context/` each with `ROOM.md`. Note `identity_files_created` is **6**, not the header comment's 5 (the comment at `room-skeleton-scaffold.cjs:184-186` says "8 ICM section folders" and "5 identity directories"; both are stale against `SECTION_NAMES` (11, line 63) and `IDENTITY_DIRECTORIES` (6, line 90) - a harmless doc drift, worth noting so the planner does not trust the comment over the constant).

**Committability check** (`git check-ignore` against each path): nothing is ignored. `.context/ROOM.md`, `.snapshots/ROOM.md`, `.intelligence/ROOM.md`, `MINTO.md`, `USER.md` all commit cleanly. `data/` already hosts three sibling fixture directories (`hitl-stages-fixtures`, `grant-rubric-fixtures`, `hitl-shape-declaration-fixtures`), so `data/harness-fixtures/` matches an established naming precedent. None of those three carries a `ROOM.md`.

### The derive queue reads empty when absent [VERIFIED: source]

`scripts/gsd-graph-derive-sweep.cjs:98-105` (`readQueue`): reads `<roomDir>/.mindrian/graph-derive-queue.json`, and on ANY failure (missing or corrupt) returns `{entries: []}`. `QUEUE_RELATIVE` is defined at line 43. Exports at 191 include `readQueue` and `queuePath`. **The runner should call `readQueue` rather than reading the file itself** - reuse before build, and it inherits the missing-is-empty contract for free.

### The ROOM.md-per-section convention

`SECTION_NAMES` (11, frozen, `room-skeleton-scaffold.cjs:63-75`) plus `IDENTITY_DIRECTORIES` (6, frozen, line 90-97) are the single source of truth. The runner's "ROOM.md present in every section" check should enumerate directories from disk (the repo-wide canon-cascade rule from CONTEXT: "discover sets by scanning"), not import the frozen list - a room that grew a section outside the frozen 11 should still be checked.

### The read-only opener, settled by probe

**It exists and it is already re-exported through the chokepoint.** `openRoomDbReadOnlyForCaller(roomDir)` is defined at `lib/core/navigation/spine-events.cjs:523-535`, exported at 547, and **re-exported at `lib/core/navigation.cjs:486`**. That single fact resolves the apparent tension between R-04 ("via `navigation.cjs`, never raw SQL") and D-03a ("read-only opener only"): calling `navigation.openRoomDbReadOnlyForCaller(roomDir)` satisfies both at once. Five shipped consumers already do exactly this: `lib/core/doctor/room-graph-density-module.cjs:152`, `graph-derive-health-module.cjs:219`, `eureka-fts-health-module.cjs:164`, `lib/mcp/tool-router.cjs:649`, `lib/mcp/tools/sensors.cjs:123`.

Its contract, from the source: returns `null` when `roomDir` is falsy, when `<roomDir>/.mindrian/room.db` is absent (an explicit `fs.existsSync` probe), or on any thrown open error. Never throws. The open uses the `file:<path>?mode=ro` URI form.

**Live probe on Node v22.23.1** (run in a scratch dir; repo untouched):

| Probe | Result |
|---|---|
| Open an existing db via `file:<path>?mode=ro`, then `SELECT` | succeeded |
| `INSERT` through that handle | **rejected, `ERR_SQLITE_ERROR`** |
| Open a MISSING file via `file:<path>?mode=ro` | **threw `ERR_SQLITE_ERROR`** |
| Was the missing file created on disk? | **no** (`fs.existsSync` false afterward) |
| `new DatabaseSync(path, {readOnly: true})` | accepted on this runtime; `INSERT` also rejected |

So the `?mode=ro` form gives the mechanical no-write guarantee D-03a needs, AND cannot create a database file. The `existsSync` guard in `spine-events.cjs` is still required, but for a different reason than the source comment implies: it converts the throw-on-missing into the documented `null` return. [VERIFIED: live probe, Node v22.23.1, this machine, 2026-09-07. Context7 was NOT reachable this session, so this is a runtime observation rather than a documentation citation; a doc-level confirmation of the `readOnly` constructor option's version history is the one open verification item.]

**On the fixture (no room.db) the proposed-claim count is zero by construction**, because the opener returns `null` before any SQL runs. `findGovernanceCandidates(db, ...)` at `lib/core/navigation/governance.cjs:44` starts `if (!db || typeof db.prepare !== 'function') return [];` so passing the `null` handle straight through is safe and returns `[]`.

### The `openGraph` trap D-03a names [ASSUMED - see Assumptions Log]

CONTEXT cites `lib/core/lazygraph-ops.cjs:426-434` as creating `.mindrian/` and `room.db` and running `initSchema` on first touch. That file was not read in this session (time was spent on the higher-risk items). Treat the line numbers as CONTEXT's, not this document's. The binding rule stands regardless: **use `navigation.openRoomDbReadOnlyForCaller`, never `openGraph`.** A one-line confirm at plan time is cheap.

---

## SEED-037 4d: the derive-health gate (research item 5)

### The detection engine already ships. Do not rebuild it. [VERIFIED: full read of the module]

`lib/core/doctor/graph-derive-health-module.cjs` (486 lines, Phase 233 Plan 01, `introduced_version: 1.15.3-beta.49`) exports `detectRoomHealth`, `check`, `fix`, `resolveRoomPath`, `QUEUE_STUCK_DAYS`. Its own header states: "THE ONE SHARED DETECTION SIGNAL... It has TWO consumers and never a second copy... 4d's detection signal IS 4c's detection signal. One function, two consumers."

`detectRoomHealth(roomDir)` at line 203 returns:
`{hasDb, hasBelongsTo, belongsToCount, cascadeEdgeCount, queueCount, queueStuckCount, failureLogCount, needsHeal, status: 'ok'|'warn'|'fail'|'skip', reasons: string[]}`

Status derivation (lines 244-262, mechanically from counts, never asserted - the T-233-04 false-success guard):
- `needsHeal` (BELONGS_TO present, cascade count 0) -> `'fail'`
- else `queueStuckCount > 0` -> `'warn'` (stuck = older than `QUEUE_STUCK_DAYS = 3`)
- else `failureLogCount > 0` -> `'warn'`
- else -> `'ok'`
- no room.db at all -> `'skip'` with reason "no room.db yet (Tier 0 room, nothing to derive)" (line 224)

**Live probe against the scaffolded fixture:** `{hasDb: false, ..., needsHeal: false, status: 'skip', reasons: ['no room.db yet (Tier 0 room, nothing to derive)']}`. So requirement 5's "green on the fixture" resolves to `status: 'skip'`, and the new script must map `skip -> exit 0`.

`check(ctx)` at line 307 is registry-scoped: it reads `~/MindrianRooms/.rooms/registry.json` via `readRegistry()` from `./shared.cjs`, defaults to the ACTIVE room, and widens to all rooms under `ctx.flags.cascadeRooms`. It returns `'skip'` when there is no registry or no active room. It maps the per-room `'fail'` up to a class-level `'warn'` deliberately (the engine's vocabulary is `ok|warn|error|skip`).

### What 298 actually adds

Given the above, `scripts/check-graph-derive-health.cjs` is a **CLI wrapper**, not a new detector. Recommended shape, following the `check-worktree-hygiene.cjs` argv loop:

- `--room <dir>` -> `detectRoomHealth(dir)` on one path
- no `--room` -> `check({flags: {}})` for the registry-active room; `--all` -> `check({flags: {cascadeRooms: true}})`
- `--json` -> print the returned object verbatim
- exit map: `fail -> 1`, `warn -> 1` under `--strict` else 0, `ok -> 0`, `skip -> 0`
- exit 2 on an unknown flag or a scanner failure (the repo convention: 0 clean, 1 finding, 2 scanner fault)

Say in the policy's `notes` that the runner is a wrapper and name the module it wraps. That is the Part 7 justification the born-wired discipline expects.

### "Ghost" in this codebase

Per the design's section 6 and 13: a ghost is a policy entry whose `runner` is `null` (or whose named runner file does not exist on disk). The runner reports it as `ghost`, never counts it as passing, and never lets it block. Requirement 5 ties this to convergence: `converged: true` is refused while `gate-graph-derive-health` is a ghost. That is a two-condition guard - `policy.runner === null || !fs.existsSync(resolve(policy.runner))`.

**Note the ordering trap:** on a tree where slice 1 lands the policy file BEFORE the check script, `gate-graph-derive-health` is a ghost, so `run-harness --room <fixture>` returns `converged: false`, so `test-298-runner-idempotent.cjs` fails on its converged assertion while still passing its zero-writes assertion. Land the script and the policy in the same task, or make the idempotence test assert zero-writes independently of the converged verdict.

---

## Larry's three surfaces (research item 6)

### The byte budget, measured now [VERIFIED: live `Buffer.byteLength`]

```
node -e "console.log(Buffer.byteLength(require('./lib/mcp/runtime-instructions.cjs').RUNTIME_INSTRUCTIONS,'utf8'))"
-> 1944
```

`SERVED_BUDGET_BYTES = 1950` at `lib/mcp/no-instructions.test.cjs:91`. **Headroom is 6 bytes.** The audit (section D) recorded 1,888 and 62 bytes of headroom; the Theo clause has since landed (commit 70c15d04 plus quick 260907-m2j), and the file's own comment at `runtime-instructions.cjs:14` now says 1944. `lib/mcp/no-instructions.test.cjs` passes 9/9 at HEAD (verified).

**Design risk 3 is understated.** Any restatement of D3/D4/D5 on the Desktop wire (R-07) must be funded by tightening RUNTIME LOOP prose FIRST, and BOUNDARIES is untrimmable (byte-frozen). The design's own estimate for a comparable clause was 120-180 bytes; six bytes will not do it. Treat "tighten the RUNTIME LOOP" as its own task with a before/after byte measurement, not a side effect.

`PART8_BOUNDARIES_FROZEN` is a byte-identical copy of the whole paragraph at `no-instructions.test.cjs:100`. Two assertions pin it: `served.indexOf(PART8_BOUNDARIES_FROZEN) !== -1` (line 261) and `served.endsWith(PART8_BOUNDARIES_FROZEN)` (line 265). **Nothing may be appended after BOUNDARIES.** Any new clause goes BEFORE it.

### The core-contract phrase set, per surface, with the test that already pins each one

This table is the `contract-parity-larry.json` `phrases` payload. Every row cites the test that pins it, so the policy adds no second source of truth - it re-declares what a test already enforces, and `--check` becomes a faster feedback path than the test suite. [VERIFIED: `.planning/research/2026-09-07-larry-extended-audit.md` section B table, cross-checked against the live pass/fail baseline]

**Surface 1: `agents/larry-extended.md`** (19,271 bytes)

| Phrase / pattern | Pinned by |
|---|---|
| `Operating the machinery` | test-143.2-doctrine-presence.cjs (OPS-05a) |
| `ZERO user-content egress` | test-143.2-doctrine-presence.cjs |
| MUST NOT contain `What are you working on` | test-143.2-doctrine-presence.cjs |
| `chain-executor`, `runChain` | test-larry-handoff-seam.cjs Test 6 |
| `/sourced or absent/`, `/A hedge word is not a source\./` | test-canon-entry-38-sourced-claims-floor.cjs |
| `/##\s*Decision Gates/i`, `AskUserQuestion`, `/no card, no picture \(SEED-021\)/i` | test-gate-native-fire-w1.cjs |
| `## Elevation (Part 12`, `vertical`/`horizontal`/`lateral`, `larry-personality skill` | test-205-elevation-doctrine-floor.cjs |
| MUST NOT match `/mcp__brain_[a-z]+\(|fetch\s*\(|writeBrain|sendToBrain|ingestToBrain/` | test-chain-executor-part8-leak.cjs |
| frontmatter `initialPrompt`, the 10 `persona_variants` keys, `skills: [larry-personality, context-engine, room-passive, room-proactive]` | test-115-persona-variants.sh, test-114-substrate-preload.sh (HEAD-readers) |
| `## If asked about Theo by name` | new in beta.27 (commit 70c15d04); **no test pins it yet** - this is a genuine parity gap the policy closes |

**Surface 2: `lib/mcp/runtime-instructions.cjs`** (`RUNTIME_INSTRUCTIONS`, 1944 bytes served)

| Phrase / invariant | Pinned by |
|---|---|
| The full `PART8_BOUNDARIES_FROZEN` paragraph, byte-identical, and it must END the string | no-instructions.test.cjs:260-266 |
| `Buffer.byteLength(served,'utf8') <= 1950` | no-instructions.test.cjs:241-245 |
| `THEO: Theo is MindrianOS's own teaching-graph backend behind every brain_* call. Asked by name, say so briefly and honestly; never volunteer it.` | **not pinned by any test** - the beta.27 Theo clause. Second genuine parity gap |
| `Open every reply with exactly one De Stijl glyph` | not independently pinned on this surface |

**Surface 3: `skills/larry-personality/SKILL.md`** (58,235 bytes)

| Phrase / invariant | Pinned by |
|---|---|
| Its Elevation section must be LONGER than the agent's | test-205-elevation-doctrine-floor.cjs |
| `read SENSOR_REGISTRY itself for the live count and roster, never hardcode a number here` (L177, L183) | audit section C; **the agent body currently violates this rule** by hardcoding "8 insight sensors" while `SENSOR_REGISTRY` carries SENS-01..18 |

**Recommended `contract-parity-larry.json` content:** a per-surface phrase array plus a `byte_budget` object for surface 2. Keep it to phrases that a test ALREADY pins, plus the two unpinned beta.27 additions (the Theo clause on both surfaces, the thin-grounding rule). Do NOT add phrases the tests do not pin - that manufactures the second source of truth the design forbids.

### The live test baseline for the persona cluster

Re-run at HEAD, and reconciled against audit section B (which recorded these same pre-existing failures):

| Test | HEAD result | Note |
|---|---|---|
| `lib/mcp/no-instructions.test.cjs` | **PASS** (9/9) | budget + frozen paragraph |
| `scripts/check-hook-schema-compatibility.cjs` | **PASS** | will scan the new Stop hook |
| test-205-elevation-doctrine-floor.cjs | FAIL (pre-existing) | canon header version 1.27 vs pinned `/Version:\s*1\.24/`. Not larry-extended |
| test-209-declared-implies-wired.cjs | FAIL (pre-existing) | KNOWN_CONTRADICTION_SURFACES drift elsewhere; advisory per Phase 210 |
| test-connector-exhaustive-coverage.cjs | FAIL 3/6 (pre-existing) | registry-wide; CHECK 4 (larry-extended) passes |
| test-115-surfaces-grep.sh | FAIL (pre-existing) | README.md assertion 3 |

Four pre-existing failures in the persona cluster on top of the two in the manifest cluster. **A plan that promises "all green" will not be able to deliver it.** Promise instead: "no NEW failures, and the six named pre-existing failures unchanged."

### Where the D3/D4/D5 prose lands (byte economics)

Per the design's section 10: the agent body carries short statements and defers to the skill for contracts; the skill carries the operating contract; the Desktop wire carries the shortest possible restatement within budget. Given 6 bytes of headroom, the honest plan is: **full D3/D4/D5 prose in the SKILL (58 KB, no budget pressure); short statements in the agent body (19 KB, no budget pressure); on the Desktop wire, either nothing new, or one clause funded by an explicit measured tightening of the RUNTIME LOOP block.** Make that a stated decision in the plan rather than discovering it at execution time.

---

## The F.8 governance basket (research item 7)

### The two-file change, confirmed - with one complication

**File 1: `lib/core/navigation/governance.cjs`.** The SELECT is at lines 56-66; the projection at 68-74. Current columns: `n.id, n.type, n.confidence, n.source_path`. D-01 needs `n.properties` added to both the SELECT list and the row mapping. The `properties` column is a JSON blob on both schemas (`lib/core/node-insert.cjs:62-64`), and `writeClaimNode` stores `knowledge_type` and `text` inside it as PROTECTED_CLAIM_KEYS (`lib/core/navigation/typed-claim.cjs:83-90`). So `JSON.parse(row.properties).text` and `.knowledge_type` are the claim text and the DIKW kind. The parse must be try/catch-wrapped; the function's contract is "NEVER throws; returns [] on any query failure".

`KNOWLEDGE_TYPES` is the closed 6-member set `{fact, causal, heuristic, anomaly_cue, mental_model, assumption}` (`typed-claim.cjs:53-55`), mapped to `epistemic_type` at write time by `KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE` (line 73-80). The description's `knowledge_type -> target_section` reads the former.

**File 2: `lib/core/memory/governance-candidate-raiser.cjs`.** `renderGovernanceBasket` at line 69 maps each valid candidate to `{label: cand.candidate_id, confidence}` (lines 77-81). D-01 changes `label` to the truncated claim text and adds a `description`.

**The complication the advisor card's "2 files" phrasing hides:** `shapeF8.renderShapeF8` has NO description channel. Its `_normalizeOption` (`lib/hmi/shape-f8-renderer.cjs:56-67`) accepts only a string or `{label, confidence}` and returns exactly `{label, confidence}`. The `description` field lives on the SUPERSET card in `lib/mcp/gate-render.cjs` (`_normalizeOption` at 111-121) and reaches the envelope only through `renderViaAskUserQuestion`, which folds `base.contract.superset_options` on top of the F.8 base at `gate-render.cjs:355-361`.

`renderGovernanceBasket` calls `renderShapeF8` DIRECTLY (line 84) and never goes through `gate-render.cjs`. So the raiser must ALSO set `rendered.contract.superset_options` itself, mirroring lines 355-361, or the description is silently dropped. **This is still two files, but the raiser change is a structural fold, not a field mapping.** Say so in the plan so the executor does not ship a description that never renders. The text fallback at `gate-render.cjs:401` (`if (o.description) line += ' - ' + o.description;`) shows what a correct `superset_options` payload buys.

Also confirmed from D-01: `MAX_TOGGLE_N = 4` (line 40, with an explicit "MUST NOT equal 3" comment distinguishing it from the frozen Part 3 MAX_K), overflow PAGES rather than truncates (lines 90-95), and `PRE_CHECK_THRESHOLD = 0.70` is defined at line 44 and re-exported (never re-minted) by the raiser at line 29.

### D-01a: the stale comment [VERIFIED]

`lib/core/memory/governance-candidate-raiser.cjs:18` reads:
`// Canon Part 8: the label is a structural id only; no candidate body ever renders.`
Line 8-9 carries the same premise ("whose LABEL is its candidate_id (a structural handle, Part-8-safe, NEVER prose / a node body)"). **Both lines must be corrected**, not just line 18, or the file contradicts its own new behavior two ways. Part 8 fences Brain EGRESS; the card renders locally with zero Brain tokens (`lib/mcp/gate-render.cjs:39` states "Canon Part 8: zero Brain/network tokens; pure composition + normalization").

### `superset_options` [VERIFIED: `gate-render.cjs:353-363`]

```javascript
base.contract.superset_options = card.options.map((o) => ({
  id: o.id, label: o.label, description: o.description, rank: o.rank, preview: o.preview,
}));
```
`SUPERSET_SCHEMA` at line 64-91 declares the option fields `{id, label, description, rank, preview}`. `_slug()` at 108 derives an id from a label when absent - relevant because a truncated claim-text label will produce a long slug; consider passing an explicit `id: cand.candidate_id` so the structural handle survives as the id while the label carries prose.

---

## The promotion evaluator (research item 8)

### Where `evaluatePromotion()` lives

D-02 fixes this: `lib/hmi/voice-style-log.cjs`, exported, called by BOTH `scripts/run-harness.cjs --policy <id>` and the doctor module. The name is slightly odd (a general promotion evaluator in a voice-specific file), but the decision is locked and the rationale is sound - the voice log is the only log with enough rows to evaluate against, and co-locating the reader with the evaluator prevents a second parser.

The lesson it enforces is recorded verbatim at `lib/core/doctor/card-fire-health-module.cjs:8-10`: "it applies the 2026-07-11 printer-must-match-counter lesson to the sibling self-diagnostic surface: a diagnostic is only trustworthy if its own log, its classifier/counter seams, its render-coverage substrate, and its session store are all intact."

**Signature (recommended):** `evaluatePromotion(policy, lines) -> {window_runs, fires, true_positives, false_positives, false_positive_rate, met: boolean, reasons: string[], next_rung: string|null, edit_line: string}` where `edit_line` is the literal one-line diff the human applies (e.g. `"rung": "blocking",`). Both printers then format the same object; neither computes anything.

### The JSONL row shape

D-02 requires a `result` field carrying `fire | false_positive | true_positive` so a human can relabel later. Building on card-fire's record shape and adding what D-04 needs:

```json
{"ts": 1757270000000, "timestamp": "2026-09-07T18:33:20.000Z", "policy_id": "voice-hyphens-only",
 "version": "2.0.0-beta.28", "result": "fire", "detail": "U+2014 at offset 412", "session_id": ""}
```

- `ts` epoch ms is what `card-fire-health-module.cjs:79` reads for freshness; keep it.
- `version` is D-04's "since last release" key. Source: `lib/core/repo-version.cjs::readRepoVersion()` -> `{version, root, pluginJson, packageJson, mismatch}`; reads `2.0.0-beta.28` on this tree (verified live). Simpler and more robust than the `doctor-applied.json` watermark, and it survives a doctor that never ran.
- `result` defaults to `"fire"` on write. A human edits the line to `"true_positive"` or `"false_positive"`. `max_false_positive_rate` is then `false_positives / (true_positives + false_positives)` over labeled rows only - **unlabeled `fire` rows must not count as either**, or an unreviewed log reads as a 0% false-positive rate and auto-satisfies the promotion rule. That is the single most important detail in this section; state it in `_schema.json`'s `promotion_rule` documentation.

### JSONL-under-`MINDRIAN_HOME` precedents

Two write patterns exist. Pick deliberately:

| Pattern | Where | Behavior |
|---|---|---|
| Read-prune-rewrite | `check-card-fire.cjs:1273-1300` | Reads all lines, drops TTL-expired, appends, rewrites whole file. Bounded, but O(n) per write and loses history |
| Sidechannel writes | `lib/core/card-fire-sidechannel.cjs:124`, `lib/core/mode-select-sidechannel.cjs:78` | Same home resolver, different payload shapes |

**Recommendation:** plain `fs.appendFileSync(path, JSON.stringify(row) + '\n')` with `mkdirSync(recursive)` and a swallow-all try/catch. Appending preserves the human's `result` labels, which the read-prune-rewrite pattern would clobber on the next Stop hook. Rotation (Claude's discretion) can be a size check that renames to `<id>.jsonl.1`. **Do not inherit card-fire's 24h TTL** - see Pitfall 4.

### The doctor module (D-04)

Mirror `lib/core/doctor/card-fire-health-module.cjs` one-for-one. Registry entry in `data/doctor-modules.json`:
```json
{"id": "voice-style-log", "introduced_version": "<the beta this ships in>", "cadence": "always",
 "flag": null, "fix_supported": false, "runner": "lib/core/doctor/voice-style-log-module.cjs",
 "description": "..."}
```
Module contract: `check(ctx) -> {status, detail, action_lines?}`. **It must return `status: 'ok'` on every path** (D-04: "never returns `warn`"), including missing log, malformed lines, and a met promotion rule. Provide the `ctx.log_path` test seam exactly as card-fire-health does at line 51, and export the path helper for hermetic tests (line 158). Every return path needs a non-empty `detail` (the D-03 module rule stated at card-fire-health line 140).

---

## Tests: conventions and the live baseline (research item 9)

### The live manifest-cluster baseline at HEAD (clean tree, `git status --porcelain` empty)

| Command | Result |
|---|---|
| `node scripts/build-harness-manifest.cjs --check` | **PASS** |
| `node tests/test-harness-manifest-check.cjs` | **PASS** |
| `node tests/test-harness-manifest-part8-boundary.cjs` | **PASS** |
| `node tests/test-201-harness-manifest.cjs` | **PASS** |
| `node tests/test-harness-167-verdict.cjs` | **FAIL** (7 of 9 checks pass; 2 fail) |
| `node tests/test-harness-manifest-precommit-wiring.cjs` | **FAIL** (1 of 6 checks pass; 5 fail) |
| `node lib/mcp/no-instructions.test.cjs` | **PASS** (9/9) |
| `node scripts/check-hook-schema-compatibility.cjs` | **PASS** |

**Root cause of both failures, diagnosed:** `tests/test-harness-manifest-precommit-wiring.cjs:53` sets `TEMPLATE_PATH = scripts/install-pre-commit.sh` and asserts the manifest guard is written INSIDE it. `tests/test-harness-167-verdict.cjs:58` (`INSTALL_PRECOMMIT`) does the same for its D-167-03 check. But Phase 235-01 (commits 7409a69f, 43565da3) rewrote `install-pre-commit.sh` to byte-copy `scripts/hooks/pre-commit-room-minto-guard.sh` and to author no hook content of its own - its header says so explicitly. `grep -c "build-harness-manifest" scripts/install-pre-commit.sh` returns 0; the same grep against `scripts/hooks/pre-commit-room-minto-guard.sh` returns 4, and `cmp -s` proves that file is byte-identical to `scripts/hooks/pre-commit`. **The guard is live and correct; the tests point at the wrong file.**

`test-harness-167-verdict.cjs`'s second failure is separate and older: the D-167-06 Part 9 check reports "build-new-surface.cjs writes review_status: confirmed (it DOES promote a truth-claim)".

**Planner decision required:** either (a) repoint the two tests at `scripts/hooks/pre-commit-room-minto-guard.sh` as a scoped in-phase repair (small, honest, and it makes requirement 11 literally true), or (b) record both as a named pre-existing baseline and assert "unchanged". Option (a) is recommended - the tests exist to prove a fresh clone inherits the guard, and today they prove nothing. Either way, capture the baseline BEFORE any 298 edit, or the phase will be blamed for them.

### Test file conventions

Two idioms coexist. Match the one closest to what each new test does.

| Idiom | Example | Shape |
|---|---|---|
| `record(name, fn)` counter | `tests/test-260906-t3s-worktree-hygiene.cjs:39-49` | `passCount`/`failCount` module-level counters; `record` try/catches and prints `  ok  ` / `  FAIL  `; exit 1 if `failCount`. Plus local `assertEqual` |
| `assert` + `guard(label, fn)` verdict | `tests/test-harness-167-verdict.cjs` | `node:assert/strict`; each guard returns a summary string; prints a VERDICT JSON `{passed, checks, failed}` and a FINDINGS block |

`tests/test-201-harness-manifest.cjs` uses `node:assert/strict` plus `execFileSync` to spawn the generator, and requires both the generator and `recipe-maps.cjs` in-process. Twelve+ files use the `record()` idiom.

### Hermetic fixture patterns

`tests/test-260906-t3s-worktree-hygiene.cjs` is the model, and its header states the principle: "Every fixture is a disposable git repo built with `fs.mkdtempSync`; the real MindrianOS-Plugin repo and its real `.claude/worktrees/` are NEVER touched - the script's own `--root` flag exists for exactly this." It uses `execSync` to `git init` a throwaway repo and exercises even the destructive `--prune --confirm` path against it.

### Which existing test each new test should mirror

Claude's discretion per CONTEXT; these are the recommendations with reasons.

| New test | Mirror | Why |
|---|---|---|
| `test-298-policies-schema.cjs` | `tests/test-harness-manifest-check.cjs` | Same job: validate a generated/declared artifact against an exported allowlist, in-process, no spawn. Reuse its `byRole` lookup and `/^[0-9a-f]{64}$/` digest assertion style |
| `test-298-runner-idempotent.cjs` | `tests/test-260906-t3s-worktree-hygiene.cjs` | Needs `git status --porcelain` and a real filesystem; that file already owns the disposable-git-repo helper. **But run against the COMMITTED fixture, not a temp copy** - the requirement is `git status --porcelain` empty in the real repo after two runs, which a temp copy cannot prove |
| `test-298-derive-health.cjs` | `tests/test-260906-t3s-worktree-hygiene.cjs` | Red case needs a throwaway room.db with BELONGS_TO edges and zero cascade edges; green case is the committed fixture (no db -> `skip`). D-03 also asks for a throwaway-db unit test of the `governance.cjs:57` proposed-node SQL path - **put both throwaway-db cases in this one file** so `node:sqlite` is required in exactly one new test |
| `test-298-voice-log.cjs` | `lib/core/doctor/card-fire-health-module.cjs`'s own test conventions plus `record()` | Needs `MINDRIAN_HOME` isolation (set `process.env.MINDRIAN_HOME` to `mkdtempSync`), an em-dash case, a glyph case, and an assertion that the hook always emits `{continue: true}` and exits 0 |
| `test-298-contract-parity.cjs` | `tests/test-201-harness-manifest.cjs` Task 2 | Task 2 already does exactly this dance: tamper a value, spawn `--check`, assert non-zero and a named finding, restore, assert green. Copy the tamper/restore try-finally |

### `tests/run-all-298.sh`

Does not exist. Copy `tests/run-all-201.sh` verbatim - it is the harness cluster's own aggregator and its `run_if <label> <guard-file> <cmd>` pattern makes a partially-landed phase exit with SKIPs rather than failures, which is exactly right for a four-slice migration. Its legs should be the five new tests plus `node scripts/build-harness-manifest.cjs --check` plus `node scripts/run-harness.cjs --room data/harness-fixtures/converged-room`.

---

## Architecture Patterns

### System architecture: how a policy becomes a verdict

```
                       AUTHORING (human, diffable)
   data/harness-policies/<id>.json  ──validated against──>  _schema.json
              │  (id, kind, runner, args, rung, evidence_log,
              │   promotion_rule, owner, pinned_by, applies_to, notes)
              │
              ├──────────────────────────────┐
              │                              │
        DECLARATION                     EXECUTION
              │                              │
              v                              v
  scripts/build-harness-manifest.cjs   scripts/run-harness.cjs
   (digest the DIRECTORY, never             │
    enumerate the rows)                     ├── --check --tier <t>
              │                             │      │
              v                             │      ├─ rung=declared -> report only
   data/harness-manifest.json v2            │      ├─ rung=logged   -> spawn, append JSONL, never fail
   { maps[3], runtime_surfaces[4],          │      └─ rung=blocking -> spawn, fail tier on non-zero
     policies{path,digest,count},           │      │
     larry_surfaces[3],                     │      └─ runner=null OR missing file -> report "ghost"
     fixture_ref{path,digest} }             │
              │                             ├── --room <dir>   (LAYER 0 SCAN, zero writes)
              ├─ pre-commit drift guard     │      ├─ ROOM.md present in every section?
              ├─ recipe-maps.loadManifest() │      ├─ STATE.md total_entries == on-disk count?
              └─ build-new-surface --check  │      ├─ derive queue empty? (readQueue -> {entries:[]})
                                            │      └─ zero review_status='proposed' truth claims
              --check ALSO runs the         │           via navigation.openRoomDbReadOnlyForCaller
              contract-* policies inline    │              (null handle on absent db -> 0)
              (pure file reads):            │      │
               - every phrase present       │      v
                 in each larry_surface      │   <room>/.mindrian/harness-run.json   [the ONLY write]
               - served bytes <= 1950       │   (the fixture has no .mindrian/, so a converged
               - declared counts == their   │    fixture run writes NOTHING at all)
                 registries                 │
                                            └── --policy <id>  (the promotion review)
                                                   │
   TURN CLOSE (Stop hook, <= 3000ms)               v
   scripts/check-voice-style.cjs  ────────>  evaluatePromotion(policy, lines)
     │  lib/hmi/turn-text.cjs (lifted reader)       │  ONE evaluator
     │  detectVoiceMark + the dash scan             │  TWO printers
     │  ALWAYS {continue:true, suppressOutput:true} │
     v                                             ├──> run-harness --policy report
   lib/hmi/voice-style-log.cjs                      └──> doctor MODULE line (status always 'ok')
     -> $MINDRIAN_HOME/voice-style.jsonl
        {ts, policy_id, version, result, detail}
        result: fire | false_positive | true_positive  (human-relabelable)

   RELEASE TRAIN
   doctor --acceptance --pre-tag  ──spawns──>  run-harness --check --json
     (point id: harness-policies, severity blocker, wired LAST)
```

### Recommended tree (from the design's section 5, with the additions this research found necessary)

```
data/
  harness-manifest.json              v2: + policies, + larry_surfaces[3], + fixture_ref
  harness-policies/
    _schema.json                     closed vocabulary; mirrors data/hitl-shape-declaration-schema.json
    CONTEXT.md                       reads / does / writes / human check (the L2 contract idiom)
    gate-worktree-hygiene.json       slice 1
    gate-shape-declaration.json      slice 1
    gate-tool-honesty.json           slice 1
    gate-card-fire.json              slice 1; its rung history IS the D8 precedent
    gate-graph-derive-health.json    slice 1 (wraps the shipped detectRoomHealth)
    voice-hyphens-only.json          rung: declared
    voice-glyph-present.json         rung: declared
    voice-backend-noun-free.json     rung: declared
    voice-fork-as-card.json          rung: logged (card-fire already logs it)
    memory-write-policy.json         D4 + F7
    contract-parity-larry.json       the phrase set + the 1950-byte budget
  harness-fixtures/
    converged-room/                  33 committed text files, hand-scrubbed (see Pitfall 3)
scripts/
  run-harness.cjs                    --check --tier | --room | --json | --policy <id>
  check-voice-style.cjs              rung-2 Stop hook, log-only
  check-graph-derive-health.cjs      CLI WRAPPER over lib/core/doctor/graph-derive-health-module.cjs
  hooks/pre-commit-room-minto-guard.sh   WIDEN the line-440 path regex (new finding)
lib/
  hmi/turn-text.cjs                  the lifted reader (5 clean functions, NOT gateSignature)
  hmi/voice-style-log.cjs            log writer + evaluatePromotion()
  core/doctor/voice-style-log-module.cjs   the never-warn informational module
tests/
  test-298-policies-schema.cjs  test-298-runner-idempotent.cjs  test-298-derive-health.cjs
  test-298-voice-log.cjs        test-298-contract-parity.cjs    run-all-298.sh
```

### Pattern 1: the three-branch generator main

```javascript
// Source: scripts/build-harness-manifest.cjs:507-519 (verbatim structure)
function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--check')) { runCheck(); return; }
  writeManifest();   // default and --refresh take the same write path
}
if (require.main === module) { main(); }
else { module.exports = { /* every pure function, for in-process tests */ }; }
```
**When to use:** any generated artifact. `--check` regenerates IN MEMORY and byte-compares against the committed file; it never writes. Keep `validateManifest` pure and exported so tests exercise it without spawning.

### Pattern 2: the argv switch loop with an unknown-flag exit 2

```javascript
// Source: scripts/check-worktree-hygiene.cjs main()
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--root') { const v = argv[i+1]; if (!v) { console.error('...--root was given with no directory argument'); process.exit(2); } root = path.resolve(v); i++; }
  else if (a === '--json') { asJson = true; }
  else if (a === '--check') { /* default action, accepted explicitly as a no-op */ }
  else { console.error('<script>: unknown flag ' + a + ' (see --help)'); process.exit(2); }
}
```
**When to use:** every new CLI in this phase. Exit convention: 0 clean, 1 finding, 2 scanner/usage fault.

### Pattern 3: the never-throwing Stop-hook envelope

```javascript
// Source: scripts/check-card-fire.cjs:1383-1385 and 1966-1973
function silentSuccess() { emitEnvelope({ continue: true, suppressOutput: true }); }
if (require.main === module) {
  try { main(); }
  catch (e) { process.stderr.write('[check-voice-style] uncaught: ' + e.message + '\n'); silentSuccess(); }
}
```
**When to use:** `check-voice-style.cjs`. TOP-LEVEL keys only. Never a `hookSpecificOutput` block - `check-hook-schema-compatibility.cjs` is the gate that will catch it, and this defect class has shipped four times.

### Pattern 4: the read-only room.db door through the chokepoint

```javascript
// Source: lib/core/doctor/graph-derive-health-module.cjs:219 and lib/core/navigation.cjs:486
const navigation = require('../lib/core/navigation.cjs');
let db = null;
try { db = navigation.openRoomDbReadOnlyForCaller(roomDir); } catch (_e) { db = null; }
// db === null on an absent room.db. findGovernanceCandidates(null, ...) returns [].
try { /* counts */ } finally { if (db) navigation.closeRoomDbForCaller(db); }
```

### Anti-patterns to avoid

- **Enumerating policies in the manifest.** The manifest digests the DIRECTORY (`{path, digest, count}`), exactly as it digests the three maps. A per-policy row breaks the HIGH-1 invariant the same way a per-surface row would.
- **Rebuilding `detectRoomHealth`.** Its header says it has two consumers and never a second copy. Add a third consumer, not a third copy.
- **Copying `gateSignature` into `turn-text.cjs`.** It drags `gate-relevance.cjs` and the glyph regexes into a module whose job is reading text.
- **Wiring the `harness-policies` acceptance point before slice 1 is green.** Every acceptance point is a blocker and `--acceptance` hard-aborts with no `--allow` override (`doctor.cjs:2990-2996`). D-4 from quick 260906-t3s: a blocker's first run must be a true green.
- **Regenerating dist mirrors as a side effect.** `test-234-dist-bundle.cjs` is already red on stale mirrors (design risk 5). Out of scope, explicitly.
- **Letting the runner call `openGraph`, or write anywhere but `<room>/.mindrian/harness-run.json`.**

## Don't Hand-Roll

| Problem | Do not build | Use instead | Why |
|---|---|---|---|
| Detecting whether a room's semantic derivation ran | A new derive-health detector | `require('lib/core/doctor/graph-derive-health-module.cjs').detectRoomHealth(roomDir)` | Shipped Phase 233; its header declares itself the ONE shared signal with two consumers; already handles Tier-0, stuck-queue and failure-log cases |
| Reading a Stop-hook transcript | A fresh JSONL walker | The lifted `readTranscriptTurn` closure from `check-card-fire.cjs:1411` | Encodes WR-06 (turn-scoped OR), WR-08 (2 MB tail cap), CR-03 (user records bound the window only), and the tool_result/task-notification distinction. Every one of those is a fix for a real live defect |
| Opening room.db safely | `new DatabaseSync(...)` anywhere | `navigation.openRoomDbReadOnlyForCaller(roomDir)` | Satisfies Part 9 (chokepoint), D-03a (read-only), and the null-on-absent contract in one call. Probe-confirmed: writes throw, missing files are not created |
| Reading the derive queue | `JSON.parse(fs.readFileSync(...))` | `require('scripts/gsd-graph-derive-sweep.cjs').readQueue(roomDir)` | Missing or corrupt reads as `{entries: []}` by contract; the runner inherits "absent is empty" for free |
| Resolving the local log home | A new config lookup | `process.env.MINDRIAN_HOME \|\| path.join(os.homedir(), '.mindrian')`, wrapped and exported like `card-fire-health-module.cjs:41-46` | Four shipped files use exactly this; tests re-point `MINDRIAN_HOME` for isolation |
| Rendering a multi-select basket | A new card shape | `shapeF8.renderShapeF8` + the `superset_options` fold from `gate-render.cjs:355-361` | MAX_TOGGLE_N, the 0.70 pre-check, the paging rule and the approved-12 glyphs are all frozen and tested |
| Scaffolding an 11-section room | Hand-authoring 33 files | `room-skeleton-scaffold.scaffoldRoomSkeleton(dir, opts)` | Produces exactly 33 files, idempotent, atomic writes, never overwrites human content. Verified live |
| Validating a closed JSON vocabulary | ajv / zod | The hand-rolled pattern of `data/hitl-shape-declaration-schema.json` read by `scripts/check-shape-declaration.cjs` | No new deps is a locked constraint; the precedent is a registry-is-the-table JSON with inline enums |
| Computing a promotion verdict twice | A printer that recounts | ONE exported `evaluatePromotion(policy, lines)` | The 2026-07-11 printer-must-match-counter lesson, recorded at `card-fire-health-module.cjs:8-10` |

**Key insight:** this phase's failure mode is not "we could not build it", it is "we built a second copy of something that already had one, and the two drifted". That is the exact defect class SEED-032 exists to end. Every plan task that creates a new file should carry a one-line Part 7 justification naming what it reuses.

---

## Runtime State Inventory

This phase lifts a shared reader, adds new local logs and adds a committed fixture, so runtime state matters even though it is not a rename.

| Category | Items found | Action required |
|---|---|---|
| Stored data | **`~/.mindrian/card-fire-intercepts.log`** on any dev machine - the existing evidence log. Repointing card-fire at the lifted reader must not change its record shape, or `card-fire-health-module.cjs`'s JSONL parse (line 76) starts counting malformed lines. **`~/.mindrian/card-fire-retries.json`** - the TTL-pruned retry store; untouched by this phase. **New: `$MINDRIAN_HOME/voice-style.jsonl`** - created on first Stop-hook fire, must tolerate absence | Code change only for card-fire (no data migration - the record shape is preserved). New log: create-on-write with `mkdirSync(recursive)` |
| Live service config | **`hooks/hooks.json` Stop array** grows a 7th entry. This file IS in git, so it travels. But the INSTALLED copy under `~/.claude/plugins/cache/.../hooks/hooks.json` is a release artifact - the new hook does not fire for any user until a release lands and is picked up (the standing "a main commit is not live until released AND picked up" rule) | Release-gated. State it in the plan's verification so nobody tests the hook against a stale install |
| OS-registered state | **None.** No cron, no Task Scheduler, no pm2, no launchd entry is created or renamed by this phase. Verified by scope: the only registrations are the `hooks.json` Stop entry (release artifact, above) and the `data/doctor-modules.json` row (a committed registry file, not an OS registration) | none |
| Secrets / env vars | **`MINDRIAN_HOME`** (read, never written; the isolation seam for tests). **`MINDRIAN_ROOMS_HOME`** (read by `compute-state`'s current_room resolver at line 37 and by `readRegistry()`; must be scratch-pointed when generating the fixture, or a machine-specific `current_room:` line is baked in). **`DOCTOR_TEST_FAIL_POINT`** (the acceptance-point test seam; the new point must honor it). No secret is created, read or renamed | Generation-time env discipline only; no key changes |
| Build artifacts | **`dist/` mirrors are ALREADY STALE** (design risk 5: `test-234-dist-bundle.cjs` red, source 58,100 bytes vs mirrors 53,768). This phase must NOT regenerate them as a side effect. **`data/harness-manifest.json` is a build artifact** and must be regenerated whenever a policy file or a Larry surface changes - the pre-commit path regex currently does not fire on `data/harness-policies/` changes | Widen the pre-commit regex (see below). Leave dist/ alone and say so in every plan |

**The canonical question, answered:** after every file in the repo is updated, the runtime systems still holding old state are (1) any developer's `~/.mindrian/` logs, which are additive and need no migration, and (2) every user's INSTALLED plugin cache, which will not see the new Stop hook or doctor module until a release is cut and picked up. Nothing else persists.

---

## Common Pitfalls

### Pitfall 1: planning against `computed:` as if it were a count

**What goes wrong:** requirement 4 as written ("STATE.md `computed:` vs on-disk counts") describes a comparison that cannot be implemented. `computed:` is an ISO timestamp emitted at `scripts/compute-state:257`.
**Why it happens:** the key name reads like "the computed values" rather than "when this was computed".
**How to avoid:** compare `total_entries` (line 259). Write the requirement that way in the plan. Treat `computed:` as a freshness stamp the runner reads but never compares.
**Warning signs:** a task whose acceptance is "`computed:` matches"; a runner that regenerates STATE.md to compare (which would fail on the timestamp alone, every time).

### Pitfall 2: expecting a scaffold-born fixture to read as empty

**What goes wrong:** the convergence check is written against `total_entries: 0` and the fixture never converges.
**Why it happens:** "a fresh room is empty" is intuitive; the scaffold writes 11 section `CONTEXT.md` files plus 2 reference docs, and the counter (`find -maxdepth 1 -name '*.md' ! -name ROOM.md`) counts all 13.
**How to avoid:** the fixture's committed STATE.md says `total_entries: 13`. The runner reproduces the counting rule exactly (top-level non-hidden dirs, maxdepth 1, `*.md`, minus `ROOM.md`) and compares. Unit-test the counter against the committed fixture.
**Warning signs:** a hardcoded 0; a counter that recurses; a counter that includes `ROOM.md` or hidden directories.

### Pitfall 3: committing em-dashes and ANSI escapes into the fixture

**What goes wrong:** `bash scripts/compute-state <room> > STATE.md` produces a file containing **2 literal U+2014 em-dashes and 2 raw ANSI escape sequences** (verified: `grep -c` on the live output). Source: `lib/core/visual-ops.cjs:529` renders `'EMPTY \u2014 GAP'` for every zero-entry section, wrapped in `c.red`/`c.reset` when color is on. A scaffold-born room has two zero-entry sections (`assets/`, `team/`), hence exactly two of each.
**Why it happens:** the Room Map diagram is a terminal rendering that was never meant to be committed to a repo governed by a no-em-dash rule.
**How to avoid:** three options, pick one deliberately in the plan. (a) Generate with color disabled and hand-strip the two `EMPTY - GAP` lines to hyphens before committing, documenting the edit in the fixture's own note. (b) Commit a STATE.md without the Room Map block. (c) Fix `visual-ops.cjs:529` to a hyphen - correct, cheap, and it fixes the rule violation at source, but it is a behavior change to a shipped renderer outside this phase's declared scope. **Recommendation: (a), with (c) filed as a `/gsd-quick`.** Note that no automated gate would catch this - `lib/core/stale-copy-scanner.cjs` scans only the declared first-touch surface list, and `data/harness-fixtures/` is not on it. The rule is enforced by review, so the plan must name it.
**Warning signs:** a plan step that says "regenerate STATE.md and commit" with no scrub step; `grep -c $'\u2014' data/harness-fixtures/converged-room/STATE.md` returning non-zero.

### Pitfall 4: inheriting card-fire's 24-hour TTL into the promotion log

**What goes wrong:** `RETRY_TTL_MS = 24 * 60 * 60 * 1000` (`check-card-fire.cjs:236`) prunes the intercept log on every write. Copying that idiom into `voice-style-log.cjs` makes any `promotion_rule` with a multi-day or multi-release window structurally unsatisfiable, and silently: the log looks healthy, the count is just always small.
**Why it happens:** `appendInterceptLog` is the obvious template and the TTL is baked into its write path.
**How to avoid:** plain append, no TTL, size-based rotation if needed. State the retention window in the same `notes` paragraph as the rung, so a human reading the policy knows how far back the evidence goes.
**Warning signs:** `readInterceptLogLines`-style read-prune-rewrite in the new writer; a promotion rule that is never MET despite obvious daily fires.

### Pitfall 5: unlabeled rows reading as a zero false-positive rate

**What goes wrong:** `max_false_positive_rate` computed as `false_positives / total_rows` over a log where every row is still the default `"fire"` yields 0.0, which satisfies any threshold, so an unreviewed policy auto-qualifies for promotion. That is exactly the false-success shape the codebase keeps closing (T-233-04, T-217-01).
**How to avoid:** compute the rate over LABELED rows only, and have `evaluatePromotion` return `met: false` with a reason when the labeled count is below `min_true_positives + 1`. Document it in `_schema.json`.
**Warning signs:** a promotion verdict of MET on a log nobody has read.

### Pitfall 6: the pre-commit drift guard does not fire on policy edits

**What goes wrong:** the path regex at `scripts/hooks/pre-commit-room-minto-guard.sh:440` lists five paths and none of them is `data/harness-policies/` or `data/harness-fixtures/`. A policy file lands, the manifest's `policies` digest goes stale, and nothing notices until the next unrelated manifest-touching commit.
**How to avoid:** widen the alternation. Remember both `scripts/hooks/pre-commit` and `scripts/hooks/pre-commit-room-minto-guard.sh` are byte-identical and BOTH must change (or the `cmp -s` reinstall check in `setup-hooks.sh` will overwrite whichever one you edited).
**Warning signs:** a green `--check` on a tree where a policy file was just edited.

### Pitfall 7: promising "all existing tests green"

**What goes wrong:** six named tests are already red at HEAD (two manifest-cluster, four persona-cluster), and requirement 11 reads as if they are green.
**How to avoid:** capture the baseline in the plan's first task, verbatim. Promise "no NEW failures". Decide explicitly whether to repair the two manifest-cluster tests (recommended) or record them.
**Warning signs:** a verification step that runs `bash tests/run-all-167.sh` and expects exit 0.

### Pitfall 8: breaking `check-card-fire.cjs`'s pinned export surface

**What goes wrong:** the lift renames or removes one of the ten names two live consumers depend on. `card-fire-health-module.cjs:105` asserts `classifyCardFire`, `gateReachingEntries`, `computeBackstopHit`, `loadRegistry` are functions and returns a `warn` naming the missing seam; `lib/mcp/stop-gate-handler.cjs` drives the six retry-store accessors.
**How to avoid:** re-export everything from `check-card-fire.cjs` at the same names after the lift. `readTranscriptTurn` and `readTranscriptTail` are exported but are in neither pinned set, so re-pointing them is safe.
**Warning signs:** `node -e "const m=require('./scripts/check-card-fire.cjs'); ['classifyCardFire','gateReachingEntries','computeBackstopHit','loadRegistry'].forEach(n=>console.log(n, typeof m[n]))"` printing anything but four `function`s.

### Pitfall 9: a description that renders nowhere

**What goes wrong:** the raiser maps a `description` onto the option object, `renderShapeF8._normalizeOption` drops it (it returns only `{label, confidence}`), and the basket ships looking identical to before while the tests pass because they assert on the label.
**How to avoid:** the raiser must fold `contract.superset_options` itself, mirroring `gate-render.cjs:355-361`. The test must assert on `rendered.contract.superset_options[0].description`, not just on the label.
**Warning signs:** a test that only checks labels; a basket whose rows are readable in a unit test but not in a live card.

### Pitfall 10: the ghost-ordering deadlock in slice 1

**What goes wrong:** the `gate-graph-derive-health` policy file lands before `check-graph-derive-health.cjs`, so the policy is a ghost, so the runner refuses `converged: true`, so the idempotence test fails on a green tree.
**How to avoid:** land the script and its policy in the same task, or split the idempotence test's two assertions (zero writes; converged verdict) so the first can pass independently.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | everything | yes | v22.23.1 (floor is v22.16.0) | none needed |
| `node:sqlite` `DatabaseSync` | read-only proposed-claim counts | yes | built in; `?mode=ro` and `{readOnly:true}` both enforced (probed) | none needed |
| `git` | fixture commit, `git status --porcelain` idempotence proof, `check-worktree-hygiene` | yes | repo operational, clean tree at research time | none needed |
| `bash` | `scripts/compute-state`, `tests/run-all-*.sh` | yes | in use | none needed |
| `python3` | `compute-state`'s `current_room` resolver (lines 38-72) | assumed yes (the resolver soft-fails to no `current_room` line if absent) | - | Degrades correctly: `2>/dev/null || true`, and a missing resolver just omits the line. **This is actually the desired state for fixture generation** |
| Context7 / `ctx7` | node:sqlite doc citation | **NO** - no `mcp__context7__*` tools in the agent tool set; `command -v ctx7` empty | - | Live runtime probe (used; recorded above with its provenance) |
| Brain / Theo MCP | - | not called (instructed) | - | not needed; this is a plugin-internal phase with zero Brain wire |
| Network | - | not used | - | Canon Part 8: the manifest, the policies, the runner and the logs are all local |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Context7 (fallback used: live runtime probe, provenance stated). One residual verification item is listed in Open Questions.

---

## Validation Architecture

### Test framework

| Property | Value |
|---|---|
| Framework | None (no jest/vitest/mocha). Plain `node` scripts under `tests/`, using `node:assert/strict` or a local `record(name, fn)` counter; exit 0 pass / 1 fail |
| Config file | none - by design |
| Quick run command | `node tests/test-298-<name>.cjs` |
| Full suite command | `bash tests/run-all-298.sh` (to be created from `tests/run-all-201.sh`) |
| Aggregator idiom | `run_if <label> <guard-file> <cmd>` so a partially-landed phase exits with SKIPs, not FAILs |

### Phase requirements to observable proof

Every row names something a machine can check: a command plus an exit code, a byte comparison, or a `git status --porcelain` read.

| Req | Behavior | Type | Automated command / observable proof | Exists? |
|---|---|---|---|---|
| R-01 | v2 adds exactly three top-level keys; `maps` still three; output byte-stable | unit | `node tests/test-201-harness-manifest.cjs` (extend: assert `Object.keys(manifest)` equals the 8 expected names in order, `manifest.maps.length === 3`) then `node scripts/build-harness-manifest.cjs && git status --porcelain data/harness-manifest.json` -> **empty** (idempotent regeneration) | extend existing |
| R-01 | Part 8 allowlist widened by exactly three names | unit | `node tests/test-harness-manifest-part8-boundary.cjs` -> exit 0; assert `NODE_FIELD_ALLOWLIST.length === 8` | extend existing |
| R-02 | Every policy file validates; unknown keys rejected; `rung` enum closed | unit | `node tests/test-298-policies-schema.cjs` -> exit 0. Negative: write a temp policy with key `xyz`, run `build-harness-manifest.cjs --check` -> **exit 1** with the file name and failing key on stderr | ❌ Wave 0 |
| R-02 | Every slice-1 gate is reachable from a policy entry | unit | For each policy: `fs.existsSync(path.join(REPO_ROOT, policy.runner))` -> true, or `policy.runner === null` (declared ghost). Assert zero unintentional ghosts in slice 1 | ❌ Wave 0 |
| R-03 | Rung enum is closed and the runner never promotes | unit | Assert `['declared','logged','blocking'].includes(p.rung)` for every policy. Grep proof: `grep -c "rung.*=" scripts/run-harness.cjs` -> **0 assignments to rung**. `evaluatePromotion` returns a verdict object with no side effect (call twice, assert the log file mtime is unchanged) | ❌ Wave 0 |
| R-04 | Tiered `--check` runs only the policies whose `applies_to` includes the tier | unit | `node scripts/run-harness.cjs --check --tier pre-tag --json` -> parse, assert every reported id's `applies_to` contains `pre-tag` | ❌ Wave 0 |
| R-04 | `blocking` failure fails the tier; `logged` failure does not | unit | Temp policy with `runner: node -e "process.exit(1)"`: at `rung: logged` -> runner **exit 0** and one new JSONL line; at `rung: blocking` -> runner **exit 1** | ❌ Wave 0 |
| R-04 | Convergence from Layer 0 only; fixture is a no-op | integration | `node scripts/run-harness.cjs --room data/harness-fixtures/converged-room` -> **exit 0**, report `converged: true`; run twice; `git status --porcelain` -> **empty**; the two `--json` reports are **byte-identical** modulo a timestamp field (or carry no timestamp at all - recommended) | ❌ Wave 0 |
| R-04 | The runner never opens the write path | unit | After a fixture run: `fs.existsSync('data/harness-fixtures/converged-room/.mindrian')` -> **false**. Grep proof: `grep -c "openGraph\|openRoomDbForCaller\|room-db.cjs" scripts/run-harness.cjs` -> **0** | ❌ Wave 0 |
| R-05 | Derive-health red on a stale non-empty queue, green on the fixture | unit | `node tests/test-298-derive-health.cjs`: throwaway room.db with BELONGS_TO and zero cascade edges -> `detectRoomHealth().status === 'fail'`, script **exit 1**; committed fixture -> `status === 'skip'`, script **exit 0** | ❌ Wave 0 |
| R-05 | Runner refuses `converged: true` while the gate is a ghost | unit | Temporarily set `gate-graph-derive-health.json` `runner` to `null` in a temp policy dir -> runner reports `ghost` and `converged: false`; restore | ❌ Wave 0 |
| R-06 | `--check` red on a dropped phrase, green on restore | integration | `node tests/test-298-contract-parity.cjs`: delete one pinned phrase from `agents/larry-extended.md` in a try-finally, `build-harness-manifest.cjs --check` -> **exit 1** naming the surface and the phrase; restore -> **exit 0** | ❌ Wave 0 |
| R-06 | Byte budget enforced on the evaluated constant | unit | `node -e "const b=Buffer.byteLength(require('./lib/mcp/runtime-instructions.cjs').RUNTIME_INSTRUCTIONS,'utf8'); process.exit(b<=1950?0:1)"` -> **exit 0** (reads 1944 today). Plus `node lib/mcp/no-instructions.test.cjs` -> **9/9** | partial (test exists) |
| R-06 | Nine frozen-phrase tests intact | integration | `node tests/test-143.2-doctrine-presence.cjs`, `test-larry-handoff-seam.cjs`, `test-canon-entry-38-sourced-claims-floor.cjs`, `test-gate-native-fire-w1.cjs`, `test-chain-executor-part8-leak.cjs`, `bash tests/test-115-persona-variants.sh`, `bash tests/test-114-substrate-preload.sh` -> each **exit 0**; `test-205` and `test-115-surfaces-grep.sh` unchanged-red (baseline) | exists |
| R-07 | `memory-write-policy.json` declares D4/D5 and the basket threshold | unit | Assert the policy carries the four channel mappings and `basket_fires_at >= 2`; assert the SKILL contains the operating-contract phrases the policy names | ❌ Wave 0 |
| R-07 | Basket rows are readable | unit | Extend the F.8 test: `rendered.contract.superset_options[0].description` matches `/^\w+ -> .+, conf 0\.\d+, from /` and `options[0].label` is the truncated claim text, not a candidate id | ❌ Wave 0 |
| R-08 | Card-fire behavior unchanged after the lift | unit | `node -e` export-surface probe: all ten pinned names are functions. Plus card-fire's existing tests exit 0 | partial (probe is new) |
| R-08 | Stop hook is log-only and always continues | unit | `node tests/test-298-voice-log.cjs`: pipe a Stop envelope with an em-dash turn -> stdout parses to `{continue: true}`, **exit 0**, and exactly one new line in `$MINDRIAN_HOME/voice-style.jsonl`; a clean turn -> `{continue: true}`, exit 0, zero new lines | ❌ Wave 0 |
| R-08 | The new hook does not break the schema gate | integration | `node scripts/check-hook-schema-compatibility.cjs` -> **exit 0** after registering the Stop entry | exists |
| R-09 | `harness-policies` acceptance point spawns the runner and blocks on failure | integration | `node scripts/doctor.cjs --acceptance --pre-tag` -> the `harness-policies` line reads `PASS`. Negative: `DOCTOR_TEST_FAIL_POINT=harness-policies node scripts/doctor.cjs --acceptance --pre-tag` -> **exit 1**. Plus `node tests/test-doctor-acceptance-self-coverage.cjs` -> exit 0 | ❌ Wave 0 |
| R-10 | `recipe-maps` exposes `policies`, read-joins byte-unchanged | unit | `node -e "console.log(require('./lib/core/recipe-maps.cjs').loadManifest().policies)"` -> the object, not undefined. Plus `test-201-harness-manifest.cjs` Task 3 -> exit 0 | extend existing |
| R-10 | T-side payload byte-unchanged | integration | `git diff --stat HEAD -- data/command-registry.json lib/core/recipe-maps.cjs` at phase close: `command-registry.json` **0 changes**; `recipe-maps.cjs` changed only in `_loadManifest` and its module.exports | ❌ Wave 0 |
| R-11 | Five new tests exist and pass; no new failures elsewhere | integration | `bash tests/run-all-298.sh` -> `FAIL=0`. Plus a before/after comparison of the six named baseline failures: identical set | ❌ Wave 0 |

### Sampling rate

- **Per task commit:** the single owning test for that task, plus `node scripts/build-harness-manifest.cjs --check`, plus `git status --porcelain` empty.
- **Per wave merge:** `bash tests/run-all-298.sh` plus `bash tests/run-all-167.sh` plus `bash tests/run-all-201.sh` plus `node lib/mcp/no-instructions.test.cjs`.
- **Phase gate:** `node scripts/doctor.cjs --acceptance --pre-tag` green, `scripts/verify-release` green, the six baseline failures unchanged, before `/gsd-verify-work`.

### Wave 0 gaps

- [ ] `tests/run-all-298.sh` - copy `tests/run-all-201.sh`; no test framework to install
- [ ] `tests/test-298-policies-schema.cjs` - covers R-02, R-03
- [ ] `tests/test-298-runner-idempotent.cjs` - covers R-04
- [ ] `tests/test-298-derive-health.cjs` - covers R-05 (and hosts the D-03 throwaway-db `governance.cjs:57` unit test)
- [ ] `tests/test-298-voice-log.cjs` - covers R-08
- [ ] `tests/test-298-contract-parity.cjs` - covers R-06
- [ ] **A baseline capture step before any edit** - record the six pre-existing red tests verbatim, so "no new failures" is provable

---

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, so it is treated as enabled. This is a repo-internal governance phase with no network, no auth and no user-facing input surface, so most ASVS categories genuinely do not apply. The ones that do are stated with the specific control this repo already uses.

### Applicable ASVS categories

| ASVS category | Applies | Standard control in this repo |
|---|---|---|
| V2 Authentication | no | No identity, no login, no session. The runner is a local build script |
| V3 Session management | no | No sessions. `session_id` appears in log rows as an opaque local correlation string, never authenticated |
| V4 Access control | partial | The only privilege boundary is the room database. Enforced mechanically by `?mode=ro` (probe-confirmed: writes throw `ERR_SQLITE_ERROR`), not by convention |
| V5 Input validation | **yes** | Hand-rolled closed-vocabulary validation against `_schema.json`, mirroring `data/hitl-shape-declaration-schema.json` + `scripts/check-shape-declaration.cjs`. Fail closed: an unknown key, an unknown `rung`, or a missing `promotion_rule` is a hard `--check` failure naming file and key (design section 13). No ajv, no zod, no new deps |
| V6 Cryptography | **yes (integrity only)** | sha256 via `node:crypto` for digests. This is tamper-EVIDENCE, not tamper-PROOF: the manifest is committed alongside what it digests, so an attacker with write access rewrites both. That is the correct threat posture for a repo artifact and should be stated, not overclaimed |
| V7 Error handling and logging | **yes** | Every log write is best-effort and swallows its own errors (`check-card-fire.cjs:1298`: "a diagnostic log write must NEVER block or throw the Stop hook"). Every scanner soft-fails one item rather than aborting the sweep (T-233-01, T-217-01) |
| V12 File and resource | **yes** | `policy.runner` is a repo-relative path that gets spawned. See the threat table |
| V13 API / web service | no | Zero network. Canon Part 8 |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| A policy file's `runner` field names an arbitrary path that the runner spawns | Elevation of privilege | **This is the one real new attack surface in the phase.** `_schema.json` must constrain `runner` to a repo-relative path under `scripts/` (or `null`), the runner must `path.resolve` it against `REPO_ROOT` and reject anything that escapes the root, and it must spawn with `spawnSync('node', [resolved, ...args])` - an argv array, never a shell string. `args` is `string[]` passed verbatim, so no interpolation either |
| A malformed policy file crashes the whole check | Denial of service | Per-file try/catch, one bad file reported by name and skipped from digesting while `--check` still fails. The T-233-01 / T-217-01 self-DoS pattern is the shipped precedent |
| A pathological transcript stalls the 3000 ms Stop hook | Denial of service | `TRANSCRIPT_TAIL_BYTES = 2 MB` cap (WR-08) carried into the lifted reader; per-line JSON try/catch drops the partial head line |
| An unbounded log fills the disk | Denial of service | Size-based rotation in `voice-style-log.cjs`. Do NOT use card-fire's time TTL (Pitfall 4) |
| Room content leaking into the manifest or a log | Information disclosure | Canon Part 8 + the `NODE_FIELD_ALLOWLIST` boundary test. **`check-voice-style.cjs` logs a `detail` derived from an untrusted model turn** - cap it (card-fire's `INTERCEPT_LOG_TEXT_CAP` precedent) and prefer an offset plus a short excerpt over the full turn. The log is local-only under `~/.mindrian`, never egressed |
| A diagnostic asserting success it did not measure | False success (T-233-04) | Derive every status mechanically from counts, never assert it. `detectRoomHealth` lines 244-262 is the shipped model. `evaluatePromotion` must refuse MET on unlabeled evidence (Pitfall 5) |
| The runner silently mutating what it measures | Tampering | `?mode=ro` + the `.mindrian`-absent assertion + `git status --porcelain` empty. Three independent proofs, per requirement 4 |

---

## State of the Art

| Old approach | Current approach | When changed | Impact on 298 |
|---|---|---|---|
| Three divergent pre-commit hook sources | One canonical `scripts/hooks/pre-commit-room-minto-guard.sh`, byte-copied by both installers | Phase 235-01 (commits 7409a69f, 43565da3) | Two manifest tests still assert against the retired `install-pre-commit.sh` and are red. Widening the drift regex means editing BOTH byte-identical files |
| `hitl_shape` declaration as a hard build failure | Advisory WARN with every violation enumerated; `--strict` restores hard-fail | Phase 210 | `gate-shape-declaration` enters at rung `logged`, not `blocking` - the codebase already made that call |
| Manifest v1: 3 maps only | v1 + 4 `runtime_surfaces` digests | Phase 201-01 (D-201-1) | The additive-block pattern v2 copies for `larry_surfaces` |
| SEED-037 4d as an open residual | Shipped as `detectRoomHealth` + two doctor modules | Phase 233 Plan 01, v1.15.3-beta.49 | **The gate 298 must build is a wrapper, not a detector** |
| Memgraph Brain | Theo | Phase 339, 2026-09-03 | No impact - zero Brain wire in this phase |
| Larry Desktop wire at 1,888 bytes / 62 bytes headroom | 1,944 bytes / **6 bytes headroom** | beta.27 (70c15d04 + quick 260907-m2j) | Design risk 3 is materially worse than the design states |

**Deprecated / outdated:**
- `lib/mcp/larry-server-instructions.md` - loaded by nothing at runtime; only `tests/test-bch-01-ownership.cjs:67-69` references it. Names nine tools that exist nowhere else and carries the exact first-contact string `test-143.2` forbids. **It is a fourth Larry surface in fact if not in contract.** Out of scope here, but `contract-parity-larry` should NOT declare it (declaring an orphan legitimizes it); worth a residual note.
- `room-skeleton-scaffold.cjs:184-186` comments say "8 ICM section folders" and "5 identity directories"; the frozen constants say 11 and 6. Trust the constants.
- `agents/larry-extended.md:60` hardcodes "8 insight sensors" while `SENSOR_REGISTRY` carries SENS-01..18, violating the skill's own never-hardcode-a-count rule (audit section C).

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `lib/core/lazygraph-ops.cjs:426-434` creates `.mindrian/` and `room.db` and runs `initSchema` on first touch. Carried from CONTEXT D-03a; the file was not read this session | Layer-0 convergence reads | LOW. The binding rule (use the read-only opener) holds regardless of the exact line numbers. Confirm with one `sed -n '420,440p'` at plan time |
| A2 | The per-script flag table's "flags present" column is derived from a literal grep for flag strings in each file, which proves the string appears but not that it is parsed | Gate and module inventory | LOW-MEDIUM. A slice-2 policy could declare `args: ["--json"]` against a script that ignores it. Confirm per-script when that gate is actually migrated, not now |
| A3 | `python3` is present on this machine (`compute-state`'s `current_room` resolver). Not probed directly | Environment Availability | NONE. The resolver is wrapped in `2>/dev/null \|\| true` and its absence just omits the `current_room:` line, which is the desired fixture state anyway |
| A4 | The `readOnly: true` DatabaseSync constructor option's version-history is not doc-cited (Context7 unreachable); only its live behavior on v22.23.1 was observed | Layer-0 convergence reads | NONE for this phase - the repo uses the `?mode=ro` URI form, which was also probed. Only matters if someone proposes switching to the option |

Everything else in this document is `[VERIFIED]` from a repo read, a live command, or a live probe, and the citation is inline.

---

## Open Questions

1. **How should the `policies` directory digest be composed?**
   - What we know: `digestBytes` is sha256 over raw bytes; there is no shipped directory-digest precedent in this generator.
   - What is unclear: whether a file RENAME with identical content should change the digest.
   - Recommendation: it should. Sort file names, build `name + "\0" + sha256(bytes) + "\n"` per file, digest the concatenation. Deterministic across filesystems, rename-sensitive, and a one-function addition. Claude's discretion per CONTEXT; state the rule in the generator's header comment the way every other invariant in that file is stated.

2. **Repair or record the two red manifest-cluster tests?**
   - What we know: both point at `scripts/install-pre-commit.sh`, which Phase 235-01 emptied of hook content; the guard is live in the canonical hook.
   - What is unclear: whether repointing them counts as scope creep.
   - Recommendation: repair. It is a two-constant edit in each test, it makes requirement 11 literally true, and leaving them red means the phase ships with a governance gate that proves nothing - which is the opposite of this phase's thesis.

3. **Does anything new belong on the Desktop wire at all?**
   - What we know: 6 bytes of headroom; BOUNDARIES is untrimmable and must remain the last thing in the string.
   - What is unclear: whether R-07's "the persona states D3/D4/D5" is satisfied by the agent plus skill alone.
   - Recommendation: read R-07 as satisfied by the agent body and the skill, and treat any Desktop-wire addition as an OPTIONAL task with a measured tightening as its precondition. Surface this to the navigator at plan time rather than discovering the budget wall mid-execution.

4. **Should `visual-ops.cjs:529`'s em-dash be fixed at source?**
   - What we know: it emits a literal U+2014 into every zero-entry section of every generated STATE.md, everywhere, not just in this fixture.
   - What is unclear: how many committed STATE.md files across user rooms already carry it (out of scope to survey).
   - Recommendation: scrub the fixture in-phase (Pitfall 3 option a) and file the source fix as a `/gsd-quick`. Do not widen 298 to touch a shipped renderer.

5. **Does `run-harness.cjs` need a CIRS / born-wired declaration?**
   - What we know: Canon Part 11 covers commands, agents, pipelines and qualifying skills. `run-harness.cjs` is a script, and no existing `scripts/check-*.cjs` carries a shape declaration.
   - Recommendation: no declaration; the precedent is unambiguous across all 35 sibling scripts. Confirm with one `node scripts/check-cirs-declaration.cjs --check` after the file lands.

---

## Sources

### Primary (HIGH confidence) - repo files read in full or in the cited region

- `scripts/build-harness-manifest.cjs` (539 lines, full read) - generator idiom, allowlists, validation taxonomy, exports
- `data/harness-manifest.json` (full read) - v1 shape and live counts
- `lib/core/recipe-maps.cjs:125-185, 400-438` - `_loadManifest` explicit-allowlist rebuild, `postureForCommand`, `__reset`, exports
- `scripts/hooks/pre-commit:428-443` and `scripts/install-pre-commit.sh:1-60` - the drift guard and the Phase 235-01 collapse
- `scripts/build-new-surface.cjs` (grep, lines 430-440, 584-597) - the two generator touchpoints
- `scripts/check-card-fire.cjs:150-215, 1236-1310, 1383-1560, 1917-1975` - transcript reader closure, log/TTL, envelope, exports
- `lib/hmi/voice-color-mark.cjs:100-140, 239-306` - `detectVoiceMark`, `MARK_GLYPHS`, exports
- `hooks/hooks.json` Stop array (6 entries, card-fire at 208-215) and `scripts/check-hook-schema-compatibility.cjs:1-60`
- `scripts/doctor.cjs:1285-1380, 1595-1630, 2990-3020` - `working-tree-housekeeping`, `worktree-hygiene`, the blocker-severity comment, the PASS/FAIL printer
- `data/doctor-modules.json` (21 modules enumerated via `node -e`)
- `lib/core/doctor/card-fire-health-module.cjs` (160 lines, full read) - the never-failing module template
- `lib/core/doctor/graph-derive-health-module.cjs` (486 lines; header, `detectRoomHealth` 190-278, `check` 294-405, exports) - the shipped 4d engine
- `lib/core/navigation/spine-events.cjs:476-548` and `lib/core/navigation.cjs:486` - the read-only door and its chokepoint re-export
- `lib/core/navigation/governance.cjs` (full read, 79 lines) - the SELECT at 56-66
- `lib/core/memory/governance-candidate-raiser.cjs` (full read, 121 lines) - lines 8-9 and 18 stale comments; `renderGovernanceBasket` at 69
- `lib/hmi/shape-f8-renderer.cjs:30-115` - `MAX_TOGGLE_N`, `PRE_CHECK_THRESHOLD`, `_normalizeOption` (no description channel)
- `lib/mcp/gate-render.cjs:30-130, 340-410` - `SUPERSET_SCHEMA`, `_normalizeOption`, `superset_options` fold, the text-rung description render
- `lib/core/navigation/typed-claim.cjs:40-90` - `KNOWLEDGE_TYPES`, the epistemic mapping, `PROTECTED_CLAIM_KEYS`
- `lib/core/node-insert.cjs` (grep) - `properties` is a JSON blob column on both schemas
- `lib/core/room-skeleton-scaffold.cjs:1-200, 658-669` - `SECTION_NAMES` (11), `IDENTITY_DIRECTORIES` (6), exports
- `scripts/compute-state:20-110, 129-160, 240-300` - the `computed:`/`total_entries` frontmatter, the counter, the stage derivation, the persistState caveat
- `lib/core/visual-ops.cjs:515-535` - the `'EMPTY \u2014 GAP'` em-dash source
- `scripts/gsd-graph-derive-sweep.cjs:43, 93-118, 191` - `readQueue` missing-is-empty
- `lib/memory/validators/navigation-invariants.cjs:78-85, 226-240` - the 8 `brain_md_*` fields, the absent-traces healthy state
- `scripts/intent-classifier.cjs:470, 2802, 2999, 3186` - the five `persistDecisionTrace` writers (INV-1)
- `lib/statusline/cockpit-signals.cjs:19-36, 125-133` and `lib/statusline/cockpit-renderer.cjs:70-80` - the orphan `voice-mark.json`, the static-fields rule
- `lib/mcp/runtime-instructions.cjs` (full) and `lib/mcp/no-instructions.test.cjs:29-100, 241-266` - the served string, `SERVED_BUDGET_BYTES`, `PART8_BOUNDARIES_FROZEN`
- `tests/test-harness-167-verdict.cjs`, `test-harness-manifest-check.cjs`, `test-harness-manifest-part8-boundary.cjs`, `test-201-harness-manifest.cjs`, `test-harness-manifest-precommit-wiring.cjs`, `test-260906-t3s-worktree-hygiene.cjs:1-60`, `tests/run-all-201.sh`
- `scripts/check-worktree-hygiene.cjs:1-60` and its `main()` argv loop
- `data/hitl-shape-declaration-schema.json` - the closed-vocabulary `_schema.json` precedent
- Phase inputs: `298-SPEC.md`, `298-CONTEXT.md`, `298-ADVISOR-basket-card.md`, `docs/superpowers/specs/2026-09-07-harness-manifest-v2-design.md`, `.planning/research/2026-09-07-larry-rework-decisions.md`, `.planning/research/2026-09-07-larry-extended-audit.md` (sections B, C, D), `.planning/seeds/SEED-032`, `SEED-037`
- `CLAUDE.md` and `.claude/includes/{architecture,moat,decisions,release-process}.md`

### Primary (HIGH confidence) - live commands run this session

- `node --version` -> v22.23.1
- `node -e "Buffer.byteLength(RUNTIME_INSTRUCTIONS)"` -> 1944
- `scaffoldRoomSkeleton()` into a scratch dir -> 33 files, 17 dirs, the full result object
- `bash scripts/compute-state <scratch fixture>` -> `computed:` timestamp, `total_entries: 13`, `venture_stage: Investment`, 2x U+2014, 2x ANSI ESC
- `detectRoomHealth(<scratch fixture>)` -> `status: 'skip'`, `needsHeal: false`
- node:sqlite read-only probe (5 cases, table above)
- The 8-command test baseline (results table above)
- `cmp -s scripts/hooks/pre-commit scripts/hooks/pre-commit-room-minto-guard.sh` -> identical
- `git check-ignore` against 5 fixture paths -> none ignored
- `ls scripts/check-*.cjs | wc -l` -> 37 (35 gates + 2 `.test.cjs`)
- `grep -n "'--point'" scripts/doctor.cjs` -> no match
- `readRepoVersion()` -> `2.0.0-beta.28`

### Secondary (MEDIUM confidence)

- The per-script flag/exit-code table: mechanically extracted by grep, so "the string appears" is proven and "the flag is parsed" is inferred (see Assumption A2).

### Tertiary (LOW confidence)

- None. No web search was run, no Brain/Theo call was made, and no claim in this document rests on training knowledge alone.

**Unreachable this session:** Context7 (no MCP tools in the agent tool set; `ctx7` not installed). One node:sqlite documentation citation is substituted by a live runtime probe with its provenance stated (Assumption A4).

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - there is no external stack; every module is a Node built-in or a repo file read this session
- v1 manifest and its consumers: HIGH - the generator was read in full and every consumer was located by grep and read at the call site
- Gate and module inventory: HIGH for the module registry and acceptance points (enumerated mechanically); MEDIUM for the per-gate flag column (grep-derived, see A2)
- Layer-0 convergence: HIGH - all three corrections were established by running the real code against a real scaffold, not by reading
- SEED-037 4d: HIGH - the module was read in full and probed live against the fixture
- Larry surfaces: HIGH - the budget was measured, the phrase set comes from the audit's own test-by-test table, and the baseline was re-run
- F.8 basket: HIGH - all four files read; the `superset_options` gap was found by reading `_normalizeOption` in both renderers
- Pitfalls: HIGH - eight of ten were observed live; the other two are mechanically derived from source
- Test baseline: HIGH - every result is a command that was run, and both failures were root-caused to a specific commit

**Research date:** 2026-09-07
**Valid until:** 2026-10-07 for the repo-structural findings (stable, internal). **7 days** for the test baseline and the 1,944-byte reading - both move with any commit to this tree, and the tree had 5 local commits on the research date.
