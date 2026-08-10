---
status: investigating
trigger: "brain-raw-cypher-admin-gate-starves-baseline"
created: 2026-05-22T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: ROOT CAUSE FOUND. The Brain-query moat guard shipped in v1.13.0-beta.21/beta.22 (Phase 127.1 Plan 05, D-MOAT-1) gates raw Cypher (the brain_query tool) to the admin plan. fetch-brain-baseline.cjs fetches the whitespace framework baseline with a raw Cypher query via brain.query(); a normal user Brain key now receives an admin-refusal payload instead of rows. The script does not recognize that payload shape, silently falls through to "0 frameworks", and writes an empty-but-successful baseline. Every /mos:whitespace subcommand then honestly reports 0 zones because its reference corpus is empty. This is a REGRESSION introduced by the moat guard; the blast radius is every non-admin raw-Cypher caller, not just whitespace.
test: Confirm the refusal payload, the parse fall-through, the empty baseline, and enumerate all raw-Cypher call sites. Then decide the fix direction.
expecting: fetch-brain-baseline.cjs (and the other raw-Cypher consumers) must stop depending on admin-gated raw Cypher, OR the script must at minimum detect the refusal and stop reporting it as success.
next_action: Decide the fix direction (non-admin Brain surface vs static bundled baseline vs new non-admin Brain tool), then fix fetch-brain-baseline.cjs + audit the other raw-Cypher callers. This is the live blocker for /mos:whitespace producing real signal ("Bug 2" in the Windows test note).

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: /mos:whitespace (map / tree / discover) measures room artifacts against the Brain framework baseline and reports real whitespace zones. The Brain is healthy (Neo4j 15,298 nodes, Framework label present).
actual: Every /mos:whitespace subcommand reports 0 zones. Not "the venture has no whitespace" - the reference baseline itself is empty. fetch-brain-baseline.cjs returns 0 frameworks despite a healthy, reachable, authenticated Brain.
errors: No crash, no error. fetch-brain-baseline.cjs prints "Brain: Fetched 0 frameworks" - the silent-success path. brain-data.json is written with framework_count: 0 and NO empty_reason field.
reproduction: Run /mos:whitespace discover (or map / tree) in any room with a valid non-admin Brain key. The discovery cycle runs to completion, all Python sub-pipelines execute, and the result is 0 zones by construction.
started: After the Brain-query moat guard shipped in v1.13.0-beta.21 / beta.22 (Phase 127.1 Plan 05). Surfaced during the Windows beta-test pass on 2026-05-22 ("Bug 2" in the test note). Bug 1 in that note (a python3.cmd interpreter shim) is a separate, already-worked-around issue.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: The Brain has no Framework nodes / the Neo4j graph is empty.
  evidence: brain_schema confirms a "Framework" label exists in the live Brain; the graph has 15,298 nodes. The query target exists.
  timestamp: 2026-05-22T00:00:00Z

- hypothesis: The Brain is unreachable or the API key is missing/wrong.
  evidence: The Windows confirmation run the same day showed /mos:doctor --brain-smoke 5/5 green - L2 brain-key-resolver resolved the key cleanly, L3/L4/L5 all green. The Brain is reachable and authenticated. The failure is an authorization-tier refusal, not a connectivity or auth failure.
  timestamp: 2026-05-22T00:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-05-22T00:00:00Z
  checked: The live Brain brain_query tool with a normal (non-admin) key
  found: |
    A raw Cypher call (MATCH (f:Framework) RETURN count(f)) to the Brain
    brain_query tool returns, verbatim:
    {"text":"Raw Cypher query access requires admin key. Use brain_search or
    brain_ask for methodology lookups. Contact Jonathan for elevated access."}
    This is the Brain-query moat guard from v1.13.0-beta.21/beta.22 (CHANGELOG
    beta.22: "brain_query is now gated to the admin plan (D-MOAT-1)"). Raw
    Cypher is admin-only. brain_search and brain_ask remain open.
  implication: Any plugin code path that issues raw Cypher via brain.query()
    with a non-admin key now receives this {text:...} refusal instead of rows.

- timestamp: 2026-05-22T00:00:00Z
  checked: scripts/fetch-brain-baseline.cjs
  found: |
    Lines 98-104: the script fetches the framework baseline with a RAW CYPHER
    query - MATCH (f:Framework) WHERE f.description IS NOT NULL RETURN f.name,
    f.description, f.category - passed to brain.query(cypher) at line 108.
    Lines 115-143 parse the response with exactly three recognized shapes:
      line 115  if (!result)            -> null guard (unreachable)
      line 124  if (result.error)       -> Cypher-error guard
      line 131  records = result.records || result || []
      line 133  if (Array.isArray(records)) { ...push frameworks... }
    The moat-guard refusal is a FOURTH shape - { text: "Raw Cypher..." }. It is
    not null; it has no .error key (it has .text); it is not an array and has
    no .records. So: line 115 skipped, line 124 skipped, line 131 sets records
    to the {text:...} object, line 133 is false, the push loop never runs.
    frameworks stays []. The script then takes the SUCCESS path (lines 146-156),
    writes brain-data.json with framework_count: 0 and NO empty_reason, and
    prints "Brain: Fetched 0 frameworks". The refusal is silently swallowed.
  implication: Two distinct defects. (1) PRIMARY: the script depends on raw
    Cypher, which is now admin-gated - a normal user key can never populate the
    baseline. (2) SECONDARY: the script reports an admin refusal as a
    successful 0-framework fetch, so the failure is invisible - it looks like
    "no whitespace" rather than "Brain query refused".

- timestamp: 2026-05-22T00:00:00Z
  checked: lib/core/brain-client.cjs query() function (lines 360-371)
  found: |
    query(cypher) calls callTool('brain_query', {cypher}). The return
    normalization: null -> null; array -> {records:array}; {records} ->
    passthrough; line 369 "if (result && (result.error || result.text)) return
    result" -> the moat-guard {text:...} payload passes straight through
    UNCHANGED. So brain.query() hands fetch-brain-baseline.cjs the raw
    {text:"Raw Cypher query access requires admin key..."} object. brain-client
    is behaving as designed (error/message passthrough); the consumer is the
    one that fails to recognize it.
    IRONY / PRIOR ART: brain-client.cjs lines 320-328 document "Finding I,
    v1.10.9 hotfix 2026-04-15" - a near-identical incident where a parameter-
    name mismatch made "fetch-brain-baseline.cjs and compute-whitespace-gaps.py
    silently fall through to empty-baseline mode even though Brain was fully
    reachable". Same script, same silent-empty-baseline failure mode, second
    occurrence. The script has a chronic weakness: it treats every non-row
    payload as an empty-but-successful result.

- timestamp: 2026-05-22T00:00:00Z
  checked: The /mos:whitespace -> baseline call chain
  found: |
    scripts/ensure-brain-baseline.cjs (lines 63-64) is the wrapper - it
    execSync-invokes fetch-brain-baseline.cjs then fetch-brain-baseline.py.
    discovery-cycle.cjs / whitespace-command.cjs drive ensure-brain-baseline.
    So: /mos:whitespace -> discovery-cycle -> ensure-brain-baseline.cjs ->
    fetch-brain-baseline.cjs (raw Cypher -> moat-guard refusal -> empty
    baseline) -> fetch-brain-baseline.py (embeds an empty corpus) -> the gap
    math has 0 reference frameworks -> 0 zones, honestly, by construction.
  implication: The whitespace pipeline itself is healthy. It is starved at the
    baseline-fetch step. Confirmed: map, tree, discover all execute cleanly and
    all return 0 because they share the same starved baseline.

- timestamp: 2026-05-22T00:00:00Z
  checked: Blast radius - other raw-Cypher callers
  found: |
    brain-client.cjs's own query() docblock (lines 348-351) names the raw-Cypher
    consumers that read result.records: brain-router.cjs, brain-derivation.cjs
    (renderRecords), rs-chain-feeder.cjs, rs-experts-command.cjs,
    rs-explain-command.cjs, rs-thesis-command.cjs - plus fetch-brain-baseline.cjs.
    Every one of these issues raw Cypher through brain.query(). With a non-admin
    key, every one now receives the moat-guard refusal instead of rows.
  implication: This is NOT a whitespace-only bug. The moat guard (beta.21/22)
    silently changed the brain.query() contract for every non-admin caller. The
    whitespace baseline is the symptom the Windows pass happened to hit first.
    The fix must audit ALL raw-Cypher call sites, not just fetch-brain-baseline.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: CONFIRMED. The Brain-query moat guard (v1.13.0-beta.21/beta.22, Phase 127.1 Plan 05, D-MOAT-1) gates the brain_query raw-Cypher tool to the admin plan. A normal user Brain key issuing raw Cypher now receives an authorization refusal payload `{text:"Raw Cypher query access requires admin key. Use brain_search or brain_ask..."}` instead of result rows. scripts/fetch-brain-baseline.cjs builds the /mos:whitespace framework baseline with exactly such a raw Cypher query (brain.query(MATCH (f:Framework)...)). Its response parser recognizes only three shapes (null, {error}, array); the refusal is a fourth shape ({text:...}) it does not handle, so it silently produces an empty baseline AND reports it as a successful "0 frameworks" fetch. Whitespace then measures room artifacts against an empty reference corpus and reports 0 zones for every subcommand. The moat guard changed the brain.query() contract; the raw-Cypher consumers were never updated. Blast radius: every non-admin raw-Cypher caller (brain-router, brain-derivation renderRecords, rs-chain-feeder, rs-experts, rs-explain, rs-thesis, fetch-brain-baseline) - whitespace is the first symptom observed, not the only one.

fix: NOT YET APPLIED. The fix has a design decision the navigator should make. Options:
  OPTION A (recommended - non-admin Brain surface): rewrite fetch-brain-baseline.cjs to retrieve the framework baseline via brain_search / brain_ask (the open, non-admin tools the refusal message itself points to) instead of raw Cypher. Pro: works on a normal key, no Brain-server change. Con: brain_search is semantic top-K, not an exhaustive MATCH - getting "all frameworks" needs either a high topK in the right namespace or a brain_ask shaped to enumerate.
  OPTION B (static bundled baseline): ship a precomputed framework baseline JSON inside the plugin. The framework set is stable; whitespace does not need it live. Pro: zero Brain dependency, zero race, offline-safe. Con: goes stale when the Brain's framework set changes; needs a refresh step in release.sh.
  OPTION C (new non-admin Brain tool): add a dedicated, server-side, admin-pre-approved "framework baseline" tool to mcp-server-brain that returns the curated framework list without exposing raw Cypher. Pro: keeps it live and keeps the moat. Con: a Brain-server change, larger scope.
  REGARDLESS of A/B/C - also fix the SECONDARY defect: fetch-brain-baseline.cjs must detect a {text:...} / admin-refusal payload and call writeEmptyResult(outputPath, 'brain-query-admin-gated') (or fail loudly), never report a refusal as "Fetched 0 frameworks". And audit the other six raw-Cypher callers for the same admin-gate breakage.

verification: pending - after the fix, /mos:whitespace discover in a room with a non-admin key must produce a non-zero baseline (framework_count > 0 in brain-data.json) and real zones, and the other raw-Cypher consumers must be confirmed working or migrated.

files_changed: none yet (investigation only). Likely fix surface: scripts/fetch-brain-baseline.cjs (primary), scripts/ensure-brain-baseline.cjs (wrapper), and an audit of brain-router.cjs / brain-derivation.cjs / rs-chain-feeder.cjs / rs-experts-command.cjs / rs-explain-command.cjs / rs-thesis-command.cjs.
