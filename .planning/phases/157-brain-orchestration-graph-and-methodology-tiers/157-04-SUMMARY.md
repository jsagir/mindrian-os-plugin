---
phase: 157-brain-orchestration-graph-and-methodology-tiers
plan: 04
subsystem: brain-orchestration-projection
tags: [drift-tripwire, un-wired-gate, pre-commit, feynman-runner, BOG-06, BOG-08, BOG-11, D-04]
requires:
  - "157-03 (the closed typed-edge set + ranking-input exposure on the projection)"
  - "data/connector-registry.json (the reach-wiring source)"
  - "lib/core/sensors/sensor-types.cjs REACH_IDS (the frozen 6)"
provides:
  - "scripts/build-orchestration-projection.cjs --check (the 3-mode STALE/UN-WIRED/UN-RANKED drift tripwire)"
  - "validateProjection(projection) -> { stale, unwired, unranked } categorized error arrays"
  - "data/orchestration-unwired-allowlist.json (the wired-XOR-allowlisted ledger)"
  - "tests/fixtures/orchestration-unwired/UNWIRED-FIXTURE.md (the deliberately un-wired RED fixture)"
  - "pre-commit + Feynman-runner registration of the projection --check (BOG-11)"
affects:
  - "scripts/hooks/pre-commit (new staged-path guard)"
  - "lib/memory/run-feynman-tests.cjs (TEST_FILES registration)"
  - "commands/diagnose.md (connector block added)"
  - "data/connector-registry.json (56 -> 57 connectors)"
  - "data/brain-orchestration-projection.json (206 -> 207 nodes)"
tech-stack:
  added: []
  patterns:
    - "Categorized-error-array validation (validateProjection mirrors validateConnectors)"
    - "byte-compare + categorized-validation + exit-1 + recovery-line --check idiom (mirrors build-connector-registry.cjs)"
    - "wired-XOR-allowlisted ledger (Phase 144.1 out-of-spine allow-list idiom)"
    - "fixture-out-of-source-walk (the RED fixture lives under tests/fixtures/, never walked by listSourceFiles)"
key-files:
  created:
    - "data/orchestration-unwired-allowlist.json"
    - "tests/fixtures/orchestration-unwired/UNWIRED-FIXTURE.md"
  modified:
    - "scripts/build-orchestration-projection.cjs"
    - "lib/memory/orchestration-projection.test.cjs"
    - "scripts/hooks/pre-commit"
    - "lib/memory/run-feynman-tests.cjs"
    - "docs/ORCHESTRATION-PROJECTION-CONTRACT.md"
    - "commands/diagnose.md"
    - "data/connector-registry.json"
    - "data/brain-orchestration-projection.json"
decisions:
  - "WIRE the /mos:diagnose orphan (preferred path) rather than allowlist it -- it had a clean resolver-resolvable framework"
  - "ALLOWLIST MECE (component under The Pyramid Principle, reaches a reach via that node, not standalone)"
  - "UN-RANKED gate keys on a node DECLARING a reach_id (connector-derived), so name-only skills are exempt by construction (D-01)"
  - "loadUnwiredAllowlist degrades to an empty Set on a missing/malformed allowlist -- strict-by-default (a real orphan fires UN-WIRED rather than being waved through)"
metrics:
  duration: "~45 min"
  completed: "2026-06-15"
  tasks: 4
  commits: 5
  files_created: 2
  files_modified: 8
---

# Phase 157 Plan 04: --check Drift Tripwire (STALE / UN-WIRED / UN-RANKED) Summary

The wiring-pipeline gate that makes the futures-class un-wired gap dead-by-construction: `scripts/build-orchestration-projection.cjs --check` now distinguishes three named failure modes (STALE / UN-WIRED / UN-RANKED, D-04), each with its own message + recovery line + non-zero exit, mirroring `build-connector-registry.cjs --check`; the clean live repo passes exit 0 because the 2 live framework-grained orphans were resolved first; a deliberately un-wired fixture proves the gate fails RED; and the check is registered in BOTH the pre-commit hook and the Feynman runner (BOG-11).

## What shipped (per task)

**Task 0 (pre-flight) -- resolve the 2 live orphans so clean-repo --check exits 0 by construction.**
The live framework-grained un-wired audit confirmed exactly 2 true-orphan frameworks (as the plan quantified):
- **`Problem Definition Transformation Framework`** (only `/mos:diagnose`, which had no connector) -- **WIRED** (preferred path). Added a `connector:` frontmatter block to `commands/diagnose.md` mirroring a sibling diagnostic command: `reach_id context_block`, `sub_mode problem-diagnosis`, `framework "Problem Definition Transformation Framework"`, `posture push_forward`, `hierarchy_rank 5`, `sensor_triggers [SENS-06]`, `surface F.1`. Regenerated `data/connector-registry.json` (56 -> 57 connectors). The framework resolves via `commandsForFramework()` to `/mos:diagnose` and is in `data/framework-names.json`, so the connector WFL-01 check stays green.
- **`MECE (Mutually Exclusive, Collectively Exhaustive)`** (only `/mos:structure-argument`, whose connector framework is `The Pyramid Principle`) -- **ALLOWLISTED** in the new `data/orchestration-unwired-allowlist.json` with the reason: MECE is operated as a COMPONENT under The Pyramid Principle and reaches a reach via that node, not as a standalone reach target.

After Task 0 the live framework-grained orphan set is empty (wired XOR allowlisted), so the Task 1 `--check` reaches exit 0 with no mid-flight retrofit.

**Task 1 (TDD) -- the --check branch + the 3-mode taxonomy.**
`validateProjection(projection)` returns categorized `{ stale, unwired, unranked }` arrays (mirrors `validateConnectors`), exercised directly by the test without spawning a subprocess:
- **STALE** -- byte-compare the serialized regeneration vs the committed `data/brain-orchestration-projection.json`.
- **UN-WIRED** -- FRAMEWORK-GRAINED (BOG-06): a framework missing from `nodes[]` OR not reachable to one of the 6 frozen `REACH_IDS` via any `OPERATES -> reach` chain, UNLESS in the allowlist (wired-XOR-allowlisted). A framework reachable via a SIBLING command's connector counts as wired. Skills EXEMPT (D-01).
- **UN-RANKED** -- a connector-derived `mindrian-operation` node (declares a `reach_id`) missing `reach_id`/`hierarchy_rank`/`posture`. Skills EXEMPT (name-only, no reach_id).

`runCheck()` + the `--check` branch in `main()` print each named token + recovery command and exit non-zero on any failure. Reuses the frozen `REACH_IDS` require. Zero Brain/network (Part 8).

**Task 2 (TDD) -- the deliberately un-wired fixture.**
`tests/fixtures/orchestration-unwired/UNWIRED-FIXTURE.md` declares a `frameworks:` block but NO `connector:` block (the exact `/mos:futures` un-wired shape). The framework name is not allowlisted. Tests prove `validateProjection` flags it UN-WIRED + names it; a complementary positive test proves a fully-wired synthesized projection yields zero UN-WIRED errors (the gate is not a false-positive generator). The fixture lives under `tests/fixtures/` and is NEVER walked by `listSourceFiles()`, so the live repo `--check` stays exit 0.

**Task 3 -- pre-commit + Feynman runner registration + docs (BOG-11).**
- `scripts/hooks/pre-commit`: a staged-path guard runs `--check` when any of `commands/*.md`, `skills/*/SKILL.md`, `agents/*.md`, the registries, the allowlist, or the projection is staged; exit 2 + recovery line on failure.
- `lib/memory/run-feynman-tests.cjs`: `orchestration-projection.test.cjs` registered in `TEST_FILES`.
- `docs/ORCHESTRATION-PROJECTION-CONTRACT.md`: section 4a documents the landed 3-mode taxonomy + the ledger + both registrations; section 4b resolves the hats-orphan and records the sensor-firability caveat.

## The hats-orphan resolution (plan-check correction honored)

The contract does NOT write "hats has no sensor" -- that is FALSE. `/mos:think-hats` carries `sensor_triggers: [SENS-05]` and `reach_id: hats` in the connector registry (Phase 148 D-09 minted `hats` as the real 6th reach). `hats` is documented as a first-class PRE-SCORED reach node, EXEMPT from the sensor-FIRING leg of UN-WIRED, NEVER silently dropped. The genuinely open item (RESEARCH Q6) -- whether SENS-05 firing actually mints the hats reach at runtime vs dispatching a different reach -- is recorded as a NAVIGATOR-gated decision, not an engineer call.

## The sensor-firability caveat

The contract records explicitly that `--check` validates STRUCTURAL reach-wiring (a command/framework reaches one of the 6 reaches in the projection) and does NOT assert that a firing sensor actually mints a reach at runtime. The firability of SENS-02..05/07 on a fresh-room turn is an EMPIRICAL validation (a live trace), OUT of this build-time gate's scope.

## 3-mode --check behavior (confirmed)

| Check | Result |
|-------|--------|
| Clean live repo `--check` | exit **0**, "orchestration-projection: OK" |
| STALE (corrupted on-disk projection, subprocess) | exit **1**, "STALE: ... diverges ..." + recovery line |
| UN-WIRED (orphan framework / the fixture) | non-zero, "UN-WIRED: framework ... not reachable ..." + names the surface |
| UN-RANKED (connector node stripped of hierarchy_rank) | non-zero, "UN-RANKED: connector-derived node ... missing ..." |

## Test results

- `node lib/memory/orchestration-projection.test.cjs` -- **33/33 passed** (was 21 pre-plan; +12 new: 8 validateProjection + 4 fixture).
- `node scripts/build-orchestration-projection.cjs --check` -- exit **0**.
- `node scripts/build-connector-registry.cjs --check` -- exit **0** (Task 0 did not regress it).
- `node scripts/build-command-registry.cjs --check` -- exit **0**.
- Each of STALE / UN-WIRED / UN-RANKED fires non-zero when its precondition is synthesized; the fixture fails RED on UN-WIRED.

## Deviations from Plan

**1. [Rule 3 - Adjustment] Allowlist file shape: bare JSON array (honors the plan's automated verify literally).**
- **Found during:** Task 0.
- **Issue:** The plan body said "a JSON array of { framework, reason }" while the plan's automated verify asserts `Array.isArray(a)` directly. An initial draft wrapped the array in an object with `ontology_ref`/`note` metadata (the richer 144.1 idiom), which would have failed the plan's own verify.
- **Fix:** Shipped a bare JSON array of `{ framework, reason }`; moved the ledger documentation into the single entry's `reason` string + the generator's `loadUnwiredAllowlist` header comment. Honors the plan's verify exactly.
- **Files:** `data/orchestration-unwired-allowlist.json`.
- **Commit:** `ba4a9437`.

No other deviations -- the plan-check fixes (framework-grained UN-WIRED, the wired-XOR-allowlisted ledger, the hats first-class-pre-scored framing, the sensor-firability caveat) were honored exactly as written.

## Known Stubs

None. The chain layer (CHAINS/FEEDS_INTO/PREREQUISITE) remains SOURCE-EMPTY pending a populated `curated_chains` -- that is the documented, legible empty state from Plan 03 (not a stub introduced here), and the `--check` does not require those edges (they are a ceiling, not a floor).

## What Wave 5 must know (the boundary scan + cache-contract doc)

- **The allowlist is a new boundary-scan surface.** `data/orchestration-unwired-allowlist.json` is a bare array of `{ framework, reason }` -- only generic framework names + prose reasons (machinery metadata, never user content). Wave 5's boundary scan should treat it as in-scope and assert it carries no user-specific bytes.
- **The projection is now 207 nodes (was 206)** after wiring `/mos:diagnose`; the connector registry is 57 connectors (was 56). The new `problem-diagnosis` sub_mode minted a `sub_mode` node and the `Problem Definition Transformation Framework` framework node now has an OPERATES edge.
- **`validateProjection` + `loadUnwiredAllowlist` are exported** from the generator -- Wave 5's boundary scan can reuse them if it needs to assert the projection round-trips cleanly.
- **The `--check` makes ZERO Brain/network calls (Part 8)** -- confirmed by grep (the only `brain-client`/`fetch`/`http` match in the generator is inside a comment describing the absence). Wave 5's cache-contract doc can state this as an established invariant.
- **The pre-commit guard's installed copy lags the source.** `scripts/hooks/pre-commit` is the canonical source; the installed `.git/hooks/pre-commit` is a copy installed via `setup-hooks.sh`. The new projection guard ships in the source and takes effect on the next hook re-install (standard install lifecycle). The Feynman-runner registration is immediately live.
- **hats remains an open RESEARCH Q6 item** (navigator-gated: does SENS-05 firing mint the hats reach at runtime?). Wave 5 should NOT close it as an engineer decision.

## Self-Check: PASSED

- Created files present: `data/orchestration-unwired-allowlist.json`, `tests/fixtures/orchestration-unwired/UNWIRED-FIXTURE.md`, `157-04-SUMMARY.md`.
- All 5 plan commits present: `ba4a9437` (Task 0), `942fc923` (RED), `207b3b90` (GREEN), `8fcdb78f` (fixture), `f6db65c7` (registration + docs).
