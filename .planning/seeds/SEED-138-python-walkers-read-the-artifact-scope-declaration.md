---
id: SEED-138
title: "The Python walkers read .mindrian/artifact-scope.json and the two marker files"
status: open
priority: medium
filed: 2026-10-21
planted_during: "Phase 379.1 plan 06 (graph derive drain and scout runaway CPU)"
origin: "Phase 379.1, decision D-379.1-03"
trigger_when: "a room carries a generated engine-input folder and the Python scout or HSI path still walks it, or the Python walkers are touched for another reason"
scope: small
surfaces: [MindrianOS-Plugin]
promotes_to: "a quick that gives lib/core/rs_corpus_exclude.py a path predicate beside SKIP_DIRS"
---

# SEED-138: Python walkers and the artifact scope

## The problem

Phase 379.1 added a declared artifact scope: the marker files `.mos-generated` and `engine-input-manifest.json`, and the file `<room>/.mindrian/artifact-scope.json`. The two Node walkers (the drain classifier and `lib/core/rs-engine.cjs`) read it through `lib/core/artifact-scope.cjs`. The Python walkers do not. On a room with a generated folder, a Python path that walks the room still sees every generated file.

## Evidence

- `lib/core/rs_corpus_exclude.py` holds `SKIP_DIRS`, a set of directory names. Its importers are `lib/core/rs_cache.py`, `lib/core/rs_hybrid.py`, `lib/core/rs_rooms.py`, `scripts/compute-hsi.py` and `scripts/rs-engine.py`.
- The scope is a path predicate (a directory holds a marker, or a relative glob matches). `SKIP_DIRS` is a name set, so the change is not trivial. That is why decision D-379.1-03 deferred it ("only if trivial; otherwise defer and file a seed").
- This phase bounds the Python path by time: the scout runner step timeout (MINDRIAN_SCOUT_STEP_TIMEOUT_MS, 300 s, SIGKILL) ends a Python step that runs long. The timeout bounds the cost; it does not remove the generated files from the Python result.

## Proposed next step

Port the three rules of `artifact-scope.cjs` to `rs_corpus_exclude.py`: the marker check per directory, the declared patterns (`*` inside one segment, `**` for whole segments, no regular expression built from user input), and the two overbroad guards. Reuse one shared test fixture (the large fixture with the manifest) so the Node and Python walkers must agree on the count (5 artifacts, 2,100 excluded). Keep `SKIP_DIRS` as the first filter.

## Trigger

A Python walker result that disagrees with a Node walker result on a room with a scope declaration.
