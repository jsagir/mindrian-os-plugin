---
phase: 233-graph-derive-drain-residual-seed-037
plan: 03
subsystem: infra
tags: [hsi, compute-hsi, corpus-exclude, graph-heal, pipeline-order, room.db, sqlite, python, cjs, rca-defect-4, rca-defect-5]

# Dependency graph
requires:
  - phase: 200-01
    provides: lib/core/rs_corpus_exclude.py, the ONE canonical SKIP_DIRS/SKIP_FILES/MIN_BODY_CHARS source and the no-local-literal contract
  - phase: 169-graph-derivation-harness
    provides: rebuildGraph's transitive sub-room recursion, the enqueue-then-drain split, NESTED_WITHIN per-sub-room room.db isolation
  - phase: 224-02
    provides: runDeriveBackfill's local score-based producer default, _rebuildRoom, BACKFILL_PAIR_CHUNK, the navigator-triggered-only precedent
  - phase: 140-01
    provides: insertNode, the NOT-NULL-safe node upsert the fixture builder routes through
  - phase: 233-02
    provides: the gated hosted-derive default that keeps stage 4's producer LOCAL by construction
provides:
  - compute-hsi.py importing the shared corpus exclude source (the 4th and last walker migrated)
  - .snapshots + sub-rooms + .context excluded for ALL four Python room-artifact walkers
  - compute-hsi.py --scope-to-nodes, a read-only intersection with the room's real Artifact node set
  - scripts/graph-heal-pipeline.cjs runHealPipeline, the RCA-mandated 4-stage heal order as one entry point
  - runDeriveBackfill's opt-in skipRebuild (default off), so a caller that already indexed the room does not have its semantic edges deleted
  - tests/run-all-233.sh extended into the whole-phase gate (both .cjs and .sh legs, SKIP tally, Part 8 egress sweep)
affects: [SEED-074 salience work, any future HSI consumer, any future runDeriveBackfill caller, the doctor --heal-room path once someone wires it to this pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migrate the last drifted copy rather than patching it: compute-hsi.py's stale SKIP_DIRS was fixed by deleting it and importing the shared source, so the same drift cannot recur a third time"
    - "Intersect before you compute: --scope-to-nodes filters the corpus down to the graph's own node set BEFORE the O(n^2) scoring pass, which is simultaneously cheaper and the only set that can produce an edge"
    - "Degrade to the permissive default, never to zero: a missing or immature room.db makes --scope-to-nodes score everything, because silently producing nothing is the exact false-success class this phase closes"
    - "Order is the product: a pipeline whose stages each consume the previous stage's output gets ONE entry point that owns the order, not four call sites that each hope"
    - "A discriminating fixture beats a label assertion: the heal test seeds a room.db that exists with ZERO Artifact nodes, so a wrong-order run writes an empty HSI result and the order claim fails on data rather than on a string"
    - "Prove a guard with its own control: every survival assertion is paired with an unguarded control run that must still wipe, so the assertion is proven to discriminate and the unchanged default is proven at the same time"

key-files:
  created:
    - scripts/graph-heal-pipeline.cjs
    - tests/test-233-graph-heal-pipeline.cjs
    - tests/test-233-hsi-skip-dirs-shared-source.sh
    - tests/test-233-hsi-scope-to-nodes.sh
  modified:
    - lib/core/rs_corpus_exclude.py
    - scripts/compute-hsi.py
    - lib/core/graph-backfill.cjs
    - tests/run-all-233.sh
    - CHANGELOG.md

key-decisions:
  - "Added .context to the shared SKIP_DIRS alongside the plan's mandated .snapshots and sub-rooms. 233-CONTEXT.md's Section 9 decision names the dot-dir set explicitly (.mindrian, .context, .intelligence, .heal-backup) and three of the four were already present. A live check confirmed .context holds last-session.md and learning-progress.md, which are session scaffold and not venture content, and which every walker was indexing as if they were a section"
  - "Bare `from rs_corpus_exclude import` with lib/core on sys.path, NOT rs-engine.py's `from lib.core.rs_corpus_exclude import`. The plan's action says mirror rs-engine and its acceptance criterion says grep for the bare form; they conflict. The bare form is what rs_corpus_exclude.py's own docstring declares as the contract and what rs_hybrid.py and rs_rooms.py use, so the majority convention and the module's own stated contract win"
  - "--scope-to-nodes degrades to scoring EVERYTHING when room.db is missing or unreadable, never to scoring nothing. A Tier 0 room that silently produced zero results would be a new instance of the false-success bug this phase exists to close"
  - "The pipeline is a script, not a registered surface. Canon Part 11's born-wired gate covers commands, skills, agents and MCP tools; scripts/ is not in the connector registry's scan set (verified against build-connector-registry.cjs), so this needs no registration, exactly like its siblings gsd-graph-derive-sweep.cjs and hsi-to-graph.cjs"
  - "Deliberately NOT wired into SessionStart or Stop. Stage 2 loads an embedding model. The repo already ruled on this exact trade-off for this exact work class (BACKFILL_PAIR_CHUNK, navigator-triggered only), so a heal stays something a navigator asks for, never something a keystroke pays for"
  - "skipRebuild was added to runDeriveBackfill as an opt-in defaulting to FALSE, rather than removing stage 4's internal rebuild. Every pre-233 caller keeps byte-identical behavior, and a caller that heals folders (approvedBy) is explicitly carved OUT of the guard, because a freshly-minted child room still needs its first index pass"
  - "tests/run-all-233.sh was EXTENDED, not recreated. Plan 01 already created it with .cjs glob discovery; recreating it would have thrown away working coverage to satisfy the literal word 'create'"

patterns-established:
  - "A phase gate that glob-discovers its own legs lets later plans add coverage without editing the aggregator, but it must discover every extension the phase actually uses (.sh as well as .cjs) or half the phase silently never runs"
  - "An egress allow-list is written by EXACT LINE with the reason in the file header, never by loosening the regex. Loosening the pattern would blind the gate to everything that shape"
  - "Run the fix against the original evidence before believing it. Reading the code said the pipeline was correct; running it on the RCA's own room found a defect that reading could not have"

requirements-completed: ["9-defect-4", "9-defect-5"]

# Metrics
duration: 71min
completed: 2026-07-28
---

# Phase 233 Plan 03: HSI corpus scoping and the ordered 4-stage heal pipeline Summary

**The room's discovery engine stopped ranking its own backup files as its top insights, started scoring only artifacts that can actually become edges, and the four heal stages now run in the one order that produces anything: proven by a live run on the RCA's own evidence room, which went from 0 semantic edges to 20 HSI plus 47 typed cascade edges.**

## Performance

- **Duration:** 71 min
- **Tasks:** 2
- **Files:** 9 (4 created, 5 modified)
- **Commits:** 2 task commits plus this docs commit

## What Actually Broke, In Plain Terms

The HSI pass is the part of MindrianOS that reads your artifacts and says "these two distant pieces are secretly related". To do that it walks your room looking for content.

Phase 200-01 had already learned this lesson once. Three Python walkers each kept a private list of folders to ignore, the lists drifted, and one walker wandered into `.heal-backup` and inflated a room count to 706. The fix was to make one shared list at `lib/core/rs_corpus_exclude.py` and have every walker import it. Its docstring even states the contract: keep no local literal.

`scripts/compute-hsi.py` was never migrated. It kept a private copy, and that copy went stale in exactly the way the shared list exists to prevent. It never learned to skip `.snapshots` (historical dumps of your own room's state) or `sub-rooms` (nested rooms that carry their own separate graph).

The consequence on a real room, from the RCA's own evidence: 207 files scored, and all twenty of its "top discoveries" were near-identical backup copies of each other, because two snapshots of the same file are of course almost perfectly similar. The edge writer then correctly refused every single one, since a backup file is not an artifact node in your graph, and wrote zero edges. A full expensive pass, a confident summary line, nothing to show for it.

That is Defect #4. Defect #5 is its twin from the other direction: even a correctly-scoped run wastes work scoring artifacts that were never indexed as nodes, and those pairs get silently discarded downstream too.

## Accomplishments

- **Defect #4 closed at the source, not at the symptom.** `compute-hsi.py`'s local `SKIP_DIRS` literal is gone. It now imports `SKIP_DIRS`, `SKIP_FILES` and `MIN_BODY_CHARS` from the shared module, which makes it the fourth and last walker on one source. The hardcoded `< 50` body-length check became `< MIN_BODY_CHARS` so the contract is closed completely rather than partially. `.snapshots`, `sub-rooms` and `.context` were added to the shared set, which fixes all four walkers at one point instead of four.
- **The retired literal also carried a dead entry.** It listed `.hsi-cache.json`, a FILE, in a set that filters `os.walk`'s `dirs` list, which only ever holds directory names. It had been inert since the day it was written. Noted in the replacement comment so nobody re-adds it.
- **Defect #5 closed with `--scope-to-nodes`.** Before scoring, `compute-hsi.py` can now open `<room>/.mindrian/room.db` read-only, read the real `Artifact` node ids, and filter the corpus to that intersection. This is both cheaper and more correct: it never spends an LSA or embedding pass on an artifact that `hsi-to-graph.cjs`'s existing `findArtifact` guard would discard anyway.
- **The fallback degrades permissively, never to silence.** A missing or unreadable `room.db`, or a db with no `nodes` table (the Tier 0, pre-structural-index case) logs one stderr line and scores everything, exactly like before. Degrading to "zero artifacts" would have been a fresh instance of the silent-no-op bug this whole phase exists to close.
- **The 4-stage order is now one entry point.** `scripts/graph-heal-pipeline.cjs` exports `runHealPipeline(roomDir, opts)`, which runs structural-index, then scoped HSI, then hsi-to-graph, then the cascade tier. Every stage is an existing implementation invoked unchanged; this file contributes ORDER and nothing else (Canon Part 7). It returns `{ roomDir, stages: [{name, ok, detail}], hsiSkipped }` and never throws.
- **A live run on the RCA's evidence room, which is the real proof.** See Verification Evidence. The room went from 33 Artifact nodes and zero semantic edges to 61 nodes, 20 `HSI_CONNECTION`, 17 `CONVERGES` and 30 `INFORMS`. The top HSI pair scored 0.519, which matches the 0.51 the RCA's own manual workaround reached in June, so the automated path now reproduces the hand-scoped result.
- **That live run found a real defect that reading the code could not have.** Stage 4 was deleting the edges stage 3 had just written. Details below; it is the most important thing in this plan.
- **Canon Part 8 held.** Zero Brain egress in every touched path. `compute-hsi.py` stays local, the new sqlite open is read-only by URI, both new child-process spawns are local repo scripts with fixed argv arrays, and no new network call was introduced anywhere. The phase gate now enforces this permanently with a comment-stripped egress sweep over all three plans' surfaces.

## The Defect The Live Run Found

The pipeline printed this, and it was a lie:

```
{ "name": "hsi-to-graph",   "ok": true, "detail": "HSI: wrote 20 connection edges, 0 reverse salient edges" },
{ "name": "cascade-derive", "ok": true, "detail": "typed edges 0 -> 47" }
```

An independent read of the room's `room.db` immediately afterward found `BELONGS_TO`, `CONVERGES` and `INFORMS`, and **zero** `HSI_CONNECTION`.

Root cause, traced rather than guessed: `runDeriveBackfill` opens by calling `_rebuildRoom` on each target, and `rebuildGraph`'s first act inside its transaction is `DELETE FROM edges; DELETE FROM nodes;`. That is correct as stage 1, where stage 3 runs afterward and rewrites the semantic edges. It is fatal as the opening move of stage 4, because nothing runs after stage 4 to rewrite them. The heal pipeline reported success at every stage while erasing its own most valuable output.

This is the same failure shape as the bug the whole phase is about, reproduced inside the fix for it: a confident success report over an empty result.

The fix is an opt-in `skipRebuild` on `runDeriveBackfill`, defaulting to `false` so every pre-233 caller is byte-unchanged. The pipeline passes it only when stage 1 actually succeeded (otherwise stage 4's rebuild is the last line of defense) and only when the caller did not request folder healing via `approvedBy` (a freshly-minted child room still needs its first index pass). After the fix, the same room finished with all 20 `HSI_CONNECTION` edges intact.

## Verification Evidence

### Live end-to-end run, RCA evidence room (`motj-ecosystem`)

Run against a markdown-only copy in scratch so no user data was mutated. The copy deliberately retained the pollution: 773 `.md` files under `sub-rooms/` and 12 under `.snapshots/`.

Before, read from the real room's `room.db`:

```
Artifact nodes: 33
edges: BELONGS_TO 33, DESCRIBES 1, STATES 82        (zero semantic, zero cascade)
```

The pipeline, `node scripts/graph-heal-pipeline.cjs <room>`:

```
structural-index  ok  63 artifacts, 14 sections, 0 sub-rooms
hsi-score         ok  HSI: 20 pairs found (top score: 0.519), tier 1, 49 artifacts
hsi-to-graph      ok  HSI: wrote 20 connection edges, 0 reverse salient edges
cascade-derive    ok  typed edges 0 -> 47
```

After, independent `node:sqlite` read of the resulting `room.db`:

```
Artifact nodes: 61
edges: BELONGS_TO 63, CONVERGES 17, HSI_CONNECTION 20, INFORMS 30
```

And the scoping held on real data: 49 artifacts scored out of 785 markdown files present, with `any .snapshots: False` and `any sub-rooms: False` in the written `.hsi-results.json`. Top pair: `team-execution/synthetic-experts/sharon-jacobson-synthetic-expert` to `business-model/01-section-seed` at 0.5187.

### Mutation testing (every new assertion proven to discriminate)

Each new test was mutated and confirmed to fail, then restored and confirmed to pass:

| Mutation | Expected to catch | Result |
|---|---|---|
| Disable `discover_artifacts`'s skip-dir filter | test-233-hsi-skip-dirs-shared-source leg 3 | FAILED as required, naming both polluted paths |
| Make `--scope-to-nodes` a no-op | test-233-hsi-scope-to-nodes leg A | FAILED as required, orphan present in output |
| Make stage 1's `rebuildGraph` a no-op | the heal pipeline's order proof | FAILED as required |

The stage-1 mutant was also driven manually to show the order discriminator directly: with stage 1 disabled, the scoped HSI stage wrote `artifact_count = 0, pair_count = 0`. That is why the test's fixture seeds a `room.db` that exists with zero `Artifact` nodes; it makes the wrong order produce an empty file rather than an identical one.

The stage-4 survival gate carries its own built-in control (G3): the unguarded call must still wipe the planted edge. It does, which proves G2 is measuring the guard and that the default is genuinely unchanged for existing callers. G3 required the ASYNC runner: `runDeriveBackfill`'s legacy sync path fires its rebuild without awaiting it (a documented, accepted race), so on that path the control would have been a coin flip rather than a gate.

### Suites

| Suite | Result |
|---|---|
| `bash tests/test-233-hsi-skip-dirs-shared-source.sh` | PASS |
| `bash tests/test-233-hsi-scope-to-nodes.sh` | PASS (2 legs, both exercised, model cache present) |
| `node tests/test-233-graph-heal-pipeline.cjs` | PASS, 21 assertions, 1 skip |
| `bash tests/run-all-233.sh` (PHASE GATE, all three plans) | **PASS=10 FAIL=0 SKIP=0** |
| `bash tests/run-all-224.sh` (no-regression, derivation harness) | PASS=17 FAIL=0 SKIP=0 |
| `bash tests/run-all-200.sh` (no-regression, corpus exclude) | PASS=6 FAIL=0 SKIP=0 |
| `bash tests/test-200-corpus-exclude.sh` | PASS |
| `bash tests/test-hsi-skip-heal-backup.sh` | PASS |

The one skip is `C4`, a bonus assertion that only fires when the two-artifact fixture's own pair clears the 0.3 edge threshold, which it does not. The defect it covers is pinned deterministically by the `G` group instead, so nothing is left ungated.

`run-all-224.sh` matters here specifically because this plan modified `lib/core/graph-backfill.cjs`, which that gate owns. 17/17 unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stage 4 deleted the semantic edges stage 3 wrote**

- **Found during:** Task 2, on the first live end-to-end run
- **Issue:** `runDeriveBackfill`'s internal `_rebuildRoom` opens with `DELETE FROM edges; DELETE FROM nodes;`. Placed at stage 4, it erased the 20 `HSI_CONNECTION` edges stage 3 had written seconds earlier, while every stage still reported `ok: true`.
- **Fix:** opt-in `skipRebuild` on `runDeriveBackfill` (default `false`, so no existing caller changes), passed by the pipeline only when stage 1 succeeded and `approvedBy` was not requested.
- **Files modified:** `lib/core/graph-backfill.cjs` (not in the plan's `files_modified`), `scripts/graph-heal-pipeline.cjs`
- **Regression added:** `tests/test-233-graph-heal-pipeline.cjs` group G (G1-G5), with a control leg proving the unguarded path still wipes
- **Commit:** `b4e7ef3d`

**2. [Rule 2 - Missing critical functionality] `.context` added to the shared SKIP_DIRS**

- **Found during:** Task 1
- **Issue:** The plan's action names only `.snapshots` and `sub-rooms`, but `233-CONTEXT.md`'s Section 9 decision names the full dot-dir set including `.context`. Three of the four were already present; `.context` was not, and a live check confirmed it holds `last-session.md` and `learning-progress.md`, which every walker was indexing as if `.context` were a venture section.
- **Fix:** added `.context` to `lib/core/rs_corpus_exclude.py`
- **Files modified:** `lib/core/rs_corpus_exclude.py`
- **Commit:** `16c11257`

**3. [Rule 3 - Blocking] The plan's import form contradicted its own acceptance criterion**

- **Found during:** Task 1
- **Issue:** The action says "mirror `scripts/rs-engine.py`'s own import block exactly", which is `from lib.core.rs_corpus_exclude import`. The acceptance criterion says `grep -c "from rs_corpus_exclude import" scripts/compute-hsi.py` must return 1, which that form does not satisfy.
- **Fix:** used the bare form with `lib/core` on `sys.path`. That is what `rs_corpus_exclude.py`'s own docstring declares as the contract and what `rs_hybrid.py` and `rs_rooms.py` both use, so it is the majority convention as well as the criterion-satisfying one. A doc comment that quoted the import string verbatim also had to be reworded, since it made the grep count 2.
- **Commit:** `16c11257`

**4. [Rule 3 - Blocking] `tests/run-all-233.sh` already existed**

- **Found during:** Task 2
- **Issue:** The plan says create it; Plan 01 already created it with `.cjs` glob discovery and the two generic doctor gates.
- **Fix:** extended it instead (Canon Part 7). Added `.sh` glob discovery, a `run_may_skip` helper with a real SKIP tally, and the Part 8 egress sweep. Recreating it would have discarded working coverage to satisfy a literal word.
- **Commit:** `b4e7ef3d`

### Authentication Gates

None.

## Threat Model Compliance

| Threat ID | Disposition | How it landed |
|---|---|---|
| T-233-09 | mitigate | `--scope-to-nodes` opens `room.db` via `sqlite3.connect('file:<path>?mode=ro', uri=True)`. Read-only is enforced at the SQLite layer, so a write attempt fails mechanically, not by convention. |
| T-233-10 | mitigate | Each pipeline stage has its own try/catch. The HSI spawn carries a 15-minute default budget (`MINDRIAN_HSI_TIMEOUT_MS` overridable), and a non-zero exit or timeout sets `hsiSkipped` and continues, so a missing python3 degrades one stage instead of the whole heal. Proven by test leg E3. |
| T-233-11 | accept (n/a) | Zero new npm or pip packages. Python side uses stdlib `sqlite3` only. `git diff` on `package.json` / `package-lock.json` is clean. |
| T-233-12 | mitigate | Both spawns pass `roomDir` as an argv ARRAY element to `spawnSync`, never as an interpolated shell string, so a room path containing shell metacharacters cannot inject a command. |

## Known Stubs

None. Every surface this plan created is wired and exercised by a passing test, and the pipeline was additionally run end to end against real data.

## Phase 233 Close-Out Status

This was the LAST plan in the phase. Against `233-CONTEXT.md`'s five-item residual list:

| Item | Plan | Status |
|---|---|---|
| 4c heal/retrofit already-damaged rooms | 233-01 | CLOSED |
| 4d doctor graph-derive-health check + heal class | 233-01 | CLOSED |
| 4b retire/gate the dead hosted-API default | 233-02 | CLOSED (gated) |
| 4e reconcile the drain doctrine comments | 233-02 | CLOSED |
| Section 9 Defects #4/#5 + the 4-tier pipeline order | 233-03 | CLOSED |

**Open beyond this plan's declared scope, flagged per the success criteria:**

1. **The ~16 damaged rooms still need an in-session derive to actually gain edges.** Plan 01 restored the retry SIGNAL; it deliberately does not force a derivation. That was the right call and it is stated in 233-01's own summary, but it means the phase does not by itself put edges into those rooms. This plan now gives a navigator the one-command way to do it: `node scripts/graph-heal-pipeline.cjs <room>`, proven on the evidence room. Nobody has run it across the affected set.

2. **The heal pipeline is not wired to `--heal-room`.** The doctor's `--heal-room` re-enqueues; this pipeline derives. Connecting them is a natural next step and is deliberately NOT in this phase's scope, because it would put an embedding-model load behind a doctor flag and that trade-off deserves its own decision.

3. **Three items in `deferred-items.md`** (all logged, none fixed, per the executor scope boundary): the pre-existing opt-in Pinecone Tier 2 egress in `compute-hsi.py` and its Part 8 ruling; the JS-side `discoverSections` still nodeifying sub-room scaffold files while the Python walkers now skip them (same defect class, one layer over); and `scripts/__pycache__/*.pyc` being tracked in git.

Nothing above blocks closing the phase. The phase gate is green at 10/10 with zero failures and zero skips.

## Self-Check: PASSED

Files verified present on disk:

- `scripts/graph-heal-pipeline.cjs` FOUND
- `tests/test-233-graph-heal-pipeline.cjs` FOUND
- `tests/test-233-hsi-skip-dirs-shared-source.sh` FOUND
- `tests/test-233-hsi-scope-to-nodes.sh` FOUND
- `lib/core/rs_corpus_exclude.py` FOUND (modified)
- `scripts/compute-hsi.py` FOUND (modified)
- `lib/core/graph-backfill.cjs` FOUND (modified)
- `tests/run-all-233.sh` FOUND (modified)
- `CHANGELOG.md` FOUND (modified)

Commits verified in `git log`:

- `16c11257` FOUND, feat(233-03): single-source compute-hsi.py SKIP_DIRS + add --scope-to-nodes
- `b4e7ef3d` FOUND, feat(233-03): ordered 4-stage graph heal pipeline + phase-233 test aggregator
