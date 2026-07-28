# Phase 242 - Deferred Items

Out-of-scope discoveries logged during execution. Per the executor scope boundary,
only issues DIRECTLY caused by this plan's changes are auto-fixed. Everything below
is pre-existing on `main` at this plan's base commit and is NOT fixed here.

---

## D-242-01: `tests/test-sqlite-concurrent.cjs` - 1 pre-existing failure

**Found during:** Task 1 verification (the plan's own `<verify>` command runs this suite).

**Symptom:** `WAL mode is active on database` fails:

```
+ actual - expected
  [
+   [Object: null prototype] {
-   {
      journal_mode: 'wal'
    }
  ]
```

**Root cause (traced, not guessed):** `node:sqlite` returns result rows as
**null-prototype** objects. `assert.deepStrictEqual` compares prototypes as well as
values, so a null-prototype row is unequal to an object literal even when every
field matches. Confirmed directly:

```
node -e "... Object.getPrototypeOf(rows[0]) === null"  ->  true
```

The value `journal_mode: 'wal'` is correct. WAL mode IS active. Only the assertion
style is stale, against a Node/`node:sqlite` version that now hands back
null-prototype rows.

**Why it is not this plan's to fix:** the suite requires only
`lib/core/lazygraph-ops.cjs`, never `scripts/hsi-to-graph.cjs`, and `lib/` is
byte-identical to this plan's base commit (`git diff --stat lib/` empty). The 3
passing / 1 failing split is identical before and after Task 1.

**Suggested fix (for whoever owns it):** compare with `assert.deepEqual`, or
normalize rows via `rows.map(r => ({ ...r }))` before `deepStrictEqual`. This plan's
own `snapshotScoringEdges` helper already applies that normalization defensively.

---

## D-242-02: `tests/test-sqlite-ops.cjs` - 4 pre-existing failures

**Found during:** the plan's overall verification step 3.

**Symptoms:**

| Failing assertion | Nature |
|---|---|
| `WAL mode is active` | same null-prototype cause as D-242-01 |
| `indexArtifact with wikilink creates INFORMS edge when target exists` | lazygraph behavior drift |
| `EDGE_TYPES is an array of 19 strings` | count drift, the vocabulary grew past 19 |
| `module exports exactly 21 keys` / `All 21 exports present` | export-count drift |

**Root cause:** frozen-literal expectations (19 edge types, 21 exports) in the test
against a `lib/core/lazygraph-ops.cjs` that has since grown. This is the same
frozen-count anti-pattern CLAUDE.md calls out for the Part 11 surface count
("enumerated from disk at run time, never a frozen literal").

**Why it is not this plan's to fix:** the suite requires only
`lib/core/lazygraph-ops.cjs` (verified by reading its require list), never
`scripts/hsi-to-graph.cjs`. `lib/` is untouched by Phase 242 by construction, and
`lib/core/lazygraph-ops.cjs` is explicitly OFF LIMITS to this phase (Phase 236 owns
it, and Open Question 1 was declined precisely to keep the two file sets disjoint).
Touching it here would manufacture the merge collision that declination avoided.

**Owner:** whoever lands Phase 236, or a follow-up hygiene pass. Not Phase 242.
