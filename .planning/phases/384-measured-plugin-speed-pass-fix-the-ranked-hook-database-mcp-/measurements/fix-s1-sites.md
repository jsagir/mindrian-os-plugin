# Plan 384-14: node starts per call site of scripts/session-start (fixture room, source startup, artifact touched)

Produced by `bench/session-start-sites.cjs` (xtrace with the line number in PS4, written to a separate file descriptor, plus a PATH shim named node) on the tree at START_SHA 6d3d165f0f856dcb9906a5950fc5267572abb5c1. Line numbers are lines of that tree and differ from the pinned export db2ea3b05 of the measurement files. The table holds line numbers and counts only.

Repeats: 3. The three repeats agree on every row. Traced total: 35 starts. PATH shim total per repeat: 39, 39, 39. The 4 starts that xtrace does not show are made by child scripts that bash runs as separate processes (xtrace does not follow them).

BASELINE_NODE_STARTS for the PATH-shim count is 39. Starts that go through the census counter (all descendants, including starts from inside node programs) are higher: 44 to 45 (384-RANKING.md row S1).

| line | node starts | site (own words) | on the fixture path | pattern |
|-----:|------------:|------------------|---------------------|---------|
| 57 | 1 | node version read (preflight) | yes | out of scope |
| 63 | 1 | node version compare (preflight) | yes | out of scope |
| 130 | 1 | graph backfill block | yes | out of scope |
| 144 | 1 | plugin version read | yes | out of scope |
| 150 | 1 | banner script resolve | yes | out of scope |
| 177 | 1 | install-state record (early writer) | yes | out of scope |
| 217 | 1 | install-state resolve | yes | out of scope |
| 395 | 1 | rooms graph sync (background) | yes | out of scope |
| 402 | 1 | archetype detect (producer of the archetype JSON) | yes | producer, stays |
| 403 | 1 | archetype field parse: archetype | yes | P-A |
| 404 | 1 | archetype field parse: session count | yes | P-A |
| 405 | 1 | archetype field parse: domain | yes | P-A |
| 408 | 1 | mcp profile get (producer of the profile JSON) | yes | producer, stays |
| 409 | 1 | profile field parse: profile (one field only) | yes | P-A with k of 1, nothing to merge, stays |
| 486 | 1 | opportunity bank summary | yes | out of scope |
| 592 | 1 | integrations detect (producer) | yes | producer, stays |
| 593 | 1 | integrations count parse (one field only) | yes | P-A with k of 1, nothing to merge, stays |
| 851 | 1 | registry active read | yes | out of scope |
| 1042 | 1 | banner format | yes | out of scope |
| 1262 | 1 | session context format | yes | out of scope |
| 1291 | 1 | minto guardian session-start (background) | yes | out of scope |
| 1292 | 1 | minto guardian clean-tmp (background) | yes | out of scope |
| 1435 | 1 | memory lifecycle session-start | yes | out of scope |
| 1486 | 1 | statusline command read | yes | out of scope |
| 1518 | 1 | plugin topology resolve (version change) | yes | out of scope |
| 1537 | 1 | cache prune (version change) | yes | out of scope |
| 1562 | 1 | reconcile block 1: feynman timeline refresh | yes | P-B |
| 1611 | 1 | reconcile block 2: dial memory refresh | yes | P-B |
| 1661 | 1 | reconcile block 3: gsd planning-artifact reconcile | yes | P-B |
| 1727 | 1 | reconcile block 4: memory-cortex reconcile | yes | P-B |
| 1947 | 1 | health glyph | yes | out of scope |
| 1980 | 1 | brain prewarm (background) | yes | out of scope |
| 1993 | 1 | dogfood emit | yes | out of scope |
| 1994 | 1 | dogfood derive | yes | out of scope |
| 2031 | 1 | envelope emit | yes | out of scope |
| (child scripts) | 4 | starts made by scripts that bash runs (not traced) | yes | out of scope |

Total (35 traced + 4 child-script starts): 39.

## Patterns and the promise

- P-B (the four reconcile blocks, lines 1562, 1611, 1661, 1727): 4 starts become 1. Removed: 3.
- P-A (one node start per field of a JSON string that an earlier command printed): the archetype JSON of line 402 has 3 field parses (lines 403, 404, 405). They become 1. Removed: 2. The profile JSON (line 409) and the integrations JSON (line 593) have one field parse each, so there is nothing to merge; they stay.
- Sites with a count above 0 that fit neither pattern are listed as out of scope and are not changed by this plan.

REMOVED_NODE_STARTS = 3 + 2 = 5. The PATH-shim count after the change is promised at 39 - 5 = 34 or fewer.
