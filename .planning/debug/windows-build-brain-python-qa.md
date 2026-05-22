---
status: gathering
kind: qa-sweep
trigger: "windows-build-brain-python-qa"
created: 2026-05-22T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

## Purpose
<!-- OVERWRITE on each update - reflects NOW -->

A full QA sweep of every Brain-related and Python-related component on the
Windows build of MindrianOS. This file IS the test plan and IS the results
record - the Windows build session runs the "QA Protocol" section below and
fills in the "Results" section, then it is reviewed here with `/gsd:debug`.

This is a `kind: qa-sweep` file, not a single-bug debug session. It exists in
`.planning/debug/` so `/gsd:debug` lists it as an active item and so it sits
beside the two bugs it confirms the blast radius of.

Two bugs are ALREADY tracked - the sweep classifies against them, it does not
rediscover them:
- BUG 1 (Python interpreter resolution on Windows): execSync Python calls need
  a working python3; a python3.cmd shim was the workaround.
- BUG 2 (raw-Cypher admin gate): `.planning/debug/brain-raw-cypher-admin-gate-
  starves-baseline.md` - the Brain gates raw Cypher to admin keys since
  beta.21/22, so fetch-brain-baseline.cjs and the rs-* commands return empty on
  a normal key. Root cause already found; this sweep confirms its blast radius.

next_action: Run the QA Protocol on the Windows build, paste results into the
Results section, then review here. Every `NEW FAILURE` row gets its own
`/gsd:debug` session; Bug 1 and Bug 2 rows need no new session (already tracked).

## QA Protocol (paste into the Windows build session)
<!-- IMMUTABLE once the sweep starts -->

```
ROLE: You are a QA engineer testing the MindrianOS Windows build. Test every
Brain-related and Python-related component, one by one, and produce a component
health matrix. Mindset: a component is BROKEN until a command proves it works.
Capture raw output for every result. Do not stop at the first failure.

STATE AT THE TOP: OS = Windows; plugin version (claude plugin list); Python
version(s) on PATH; whether MINDRIAN_BRAIN_KEY is set.

TWO KNOWN BUGS - classify against these, do not re-report them as new:
- BUG 1 (Python interpreter): on Windows the plugin's execSync calls need a
  working python3 - a python3.cmd shim was the workaround. If a Python step
  fails with "interpreter not found" / ENOENT, that is BUG 1, not a new defect.
- BUG 2 (raw-Cypher admin gate): the Brain gates raw Cypher (brain_query) to
  admin keys since beta.21/22. fetch-brain-baseline.cjs and the rs-* commands
  issue raw Cypher, so on a normal key they return EMPTY / 0. That is EXPECTED
  and already root-caused (.planning/debug/brain-raw-cypher-admin-gate-starves-
  baseline.md). Your job is to CONFIRM its blast radius, not rediscover it.

=== TRACK A: PYTHON RUNTIME AND SCRIPTS ===

A0 INTERPRETER  Resolve the interpreter the plugin actually uses. Run, in order,
   `python --version`, `python3 --version`, `py --version`. Report which work.
   PASS = at least one usable python3.x. If only the python3.cmd shim works,
   record PASS(shim) and note BUG 1.
A1 DEPENDENCIES Two manifests ship: requirements-hsi.txt and
   requirements-whitespace.txt (in the plugin root). For each, check the listed
   packages import cleanly: `python -c "import sentence_transformers, numpy"`
   etc. PASS = all import. FAIL = missing -> these are env-gap, note which.
A2 SCRIPT SMOKE Discover every Python script: list scripts/*.py (expect ~17:
   compute-hsi, compute-whitespace-gaps, compute-whitespace-embeddings,
   compute-external-whitespace, compute_topic_forest, compute-disruption-index,
   compute-blindspot-mass, compute-element-novelty, compute-bayesian-surprise,
   detect-reverse-salients, discover-hsi-whitespace, discover-rs-whitespace,
   discover-analogy-whitespace, fetch-brain-baseline, rs-engine,
   consolidate-pinecone, sealed-walker). For each: run `python <script> --help`
   if it supports it, else `python -c "import ast; ast.parse(open('<script>').read())"`
   to confirm it at least parses + the interpreter launches.
   PASS = launches + parses, no interpreter/import crash. A script that errors
   on MISSING INPUT (no --args / no stdin JSON) is PASS for this test - you are
   testing the interpreter path, not the algorithm.
A3 CJS->PYTHON BRIDGE The Python scripts are normally driven by .cjs via
   execSync. Test the bridge end to end with discovery-cycle.cjs (the BUG 1
   site) and whitespace-command.cjs. PASS = the bridge spawns Python and the
   sub-pipelines (HSI, RS, Analogy) run to completion with no interpreter error.

=== TRACK B: BRAIN ===

B0 KEY RESOLUTION  Confirm resolve-brain-key.cjs resolves a key. PASS = key
   resolved (note the source). If no key: mark all key-dependent checks SKIP(env).
B1 MCP CONNECTIVITY  claude mcp list. PASS = mindrian-brain AND mindrian-os both
   "connected". FAIL = either "Failed to connect".
B2 BRAIN SMOKE  /mos:doctor --brain-smoke. PASS = all 5 layers green, ok=true
   (L1 plugin-root, L2 key, L3 HTTPS probe, L4 MCP stdio handshake, L5 e2e
   brain_schema). Report each layer.
B3 BRAIN TOOLS  Exercise each Brain tool:
   - brain_stats  -> PASS = returns namespace/record counts
   - brain_schema -> PASS = returns labels + relationship types
   - brain_search "SWOT analysis" -> PASS = returns ranked records
   - brain_ask "what frameworks chain from SWOT?" -> PASS = returns an answer
   - brain_query (raw Cypher) -> EXPECTED = admin-gate refusal
     ("Raw Cypher query access requires admin key"). PASS = the refusal is
     returned cleanly (this proves the moat guard works). It is NOT a failure.
B4 RAW-CYPHER CONSUMERS (BUG 2 blast radius)  These all issue raw Cypher:
   fetch-brain-baseline.cjs, and the commands /mos:rs-explain, /mos:rs-experts,
   /mos:rs-thesis, plus /mos:brain-derive. Run each and record whether it
   returns real data or comes back empty/0. EXPECTED on a non-admin key: empty.
   Build the blast-radius list: which consumers are starved by BUG 2.

=== TRACK C: END-TO-END (Brain x Python together) ===

C1 /mos:whitespace map, then tree, then discover. Record: does each execute
   cleanly, and how many zones. EXPECTED given BUG 2: executes clean, 0 zones
   (empty baseline). PASS(execution) + note BUG 2 for the 0.
C2 /mos:diagnostics - runs the 4 Wave-1 Python algorithms (disruption index,
   blindspot mass, element novelty, bayesian surprise). PASS = 4 numeric
   results, no interpreter error.
C3 /mos:brain-derive on one section. PASS = BRAIN.md is produced; note if its
   Brain-sourced fields are empty (BUG 2 cascade).

=== OUTPUT: COMPONENT HEALTH MATRIX ===

One row per component. Columns: Component | Track | Result | Class.
Class is exactly one of:
  WORKING        - proven by command output
  BUG 1          - Python interpreter resolution
  BUG 2          - raw-Cypher admin gate
  ENV GAP        - missing dep / missing key (not a code defect)
  NEW FAILURE    - something broken that is neither known bug nor env gap
  SKIP           - could not test, say why

Then: a short verdict - is the Windows build's Brain stack usable, is the
Python stack usable, and a list of every NEW FAILURE (those are the only ones
that need a fresh debug session - Bug 1 and Bug 2 are already tracked).

DISCIPLINE
- Every PASS backed by actual output, never inference.
- "Errors on missing input" is not "broken" - it means the interpreter ran.
- A freshly-published package failing on first npx is propagation, retry once.
- Do not conflate BUG 2 (expected empty) with a NEW FAILURE. The whole point of
  this pass is to separate the three known states from genuinely new breakage.
```

## Results (the Windows build session fills this in)
<!-- APPEND raw evidence; OVERWRITE the matrix as the sweep completes -->

Environment: OS = ___ | plugin version = ___ | python = ___ | Brain key set = ___

| Test | Component | Track | Result | Class |
|------|-----------|-------|--------|-------|
| A0 | Python interpreter resolution        | Python | _ | _ |
| A1 | Python deps (requirements-hsi/whitespace) | Python | _ | _ |
| A2 | scripts/*.py smoke (17 scripts)       | Python | _ | _ |
| A3 | cjs->Python bridge (discovery-cycle, whitespace-command) | Python | _ | _ |
| B0 | Brain key resolution                 | Brain  | _ | _ |
| B1 | MCP connectivity (both servers)      | Brain  | _ | _ |
| B2 | /mos:doctor --brain-smoke (5 layers) | Brain  | _ | _ |
| B3 | Brain tools (ask/search/schema/stats/query) | Brain | _ | _ |
| B4 | raw-Cypher consumers (BUG 2 radius)  | Brain  | _ | _ |
| C1 | /mos:whitespace map/tree/discover    | E2E    | _ | _ |
| C2 | /mos:diagnostics (4 Wave-1 algos)    | E2E    | _ | _ |
| C3 | /mos:brain-derive                    | E2E    | _ | _ |

Verdict: ___ (Brain stack usable? Python stack usable?)

NEW FAILURES (only rows classed NEW FAILURE - each needs its own debug session):
- ___

Raw evidence (paste per-test command output below):

## Triage with GSD (review step - do this after the Results are filled)
<!-- How to review this sweep later -->

1. Resume the sweep: `/gsd:debug windows-build-brain-python-qa` - the debug
   orchestrator lists this file as an active item by its trigger.
2. Read the filled-in Component Health Matrix.
3. For every row classed `NEW FAILURE`: open a dedicated `/gsd:debug` session
   for that one component. A NEW FAILURE is the only class that warrants a new
   session.
4. Rows classed `BUG 1` or `BUG 2`: no new session - cross-reference the
   already-tracked files. BUG 2 = `.planning/debug/brain-raw-cypher-admin-gate-
   starves-baseline.md`. BUG 1 = open a debug session if one does not yet exist
   on this dev workspace (the Windows test note tracked it; the dev workspace
   may not have its own file yet - check before creating).
5. Rows classed `ENV GAP`: not a code defect - record the missing dep/key as a
   setup note, not a bug.
6. When every NEW FAILURE has a session and the known bugs are cross-referenced,
   flip this file's frontmatter `status:` to `resolved` and move it to
   `.planning/debug/resolved/`.
