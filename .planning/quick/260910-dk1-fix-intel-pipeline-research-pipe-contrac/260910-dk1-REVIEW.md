---
task: 260910-dk1
reviewed: 2026-09-10T00:00:00Z
depth: quick
files_reviewed: 4
files_reviewed_list:
  - lib/core/intel-pipeline.cjs
  - lib/mcp/tool-router.cjs
  - tests/run-all-223.sh
  - tests/test-quick-260910-dk1-intel-pipeline-lens-contract.cjs
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Quick Task 260910-dk1: Code Review Report

**Reviewed:** 2026-09-10
**Depth:** quick (with targeted semantic verification against the reference contract and live test runs)
**Files Reviewed:** 4
**Status:** issues_found (no blockers; one warning, two info items)

## Summary

Reviewed commits d976879a (RED test), ec00497e (fix), eef4f021 (wiring + cross-link). Ran all three regression suites directly rather than trusting the commit messages: `test-quick-260910-dk1-intel-pipeline-lens-contract.cjs` (34/34), `test-223-intel-pipeline.cjs` (39/39), `test-265-intel-roster-fan.cjs` (24/24) all pass against the working tree as-is.

Verified each of the five specific concerns:

1. **Canon Part 8 (topic provenance):** `topic` in `defaultResearchFn` is `context.handle` (the roster cell's caller-supplied generic entity handle, produced by `rosterToCells`) or `String(dimension)` (a value drawn only from `JTBD_DIMENSION_MAP`/`DEFAULT_DIMENSIONS`, a roster `cell_id` slug, or a `genericDims` entry gated through `classifyFn`'s `allow` verdict). No path lets raw room text reach `topic`. Confirmed clean.
2. **Seam reachability:** `_extractor`/`_lensDriver` are read via `isPlainObject(...)` plus a `typeof x.extractContext === 'function'` check before use. Actual JS function references cannot cross an MCP JSON-RPC boundary, and `runIntelPipeline` has no production call site in this repo today (`/mos:intel-pipeline` is a markdown meta-command, not a script that calls `runIntelPipeline(opts)` with parsed argv) — grepped across `lib/`, `scripts/`, `commands/` and found only test callers and the function's own file. The seam is currently unreachable from any attacker-controlled input. See Warning below for a related hardening note.
3. **Degrade envelope:** Traced both failure modes. `extracted === null` (or `extracted.lens_set` undefined) drives the real `runSourceLens` to its own `{ ok:false, reason:'empty_lens_set' }` return (not a throw), which `defaultResearchFn` turns into `quality:'low'`, and the pipeline's fan loop halts with a SEED-059 disclosure — the intended path. A thrown driver/extractor also lands correctly: the entire body of `defaultResearchFn` is one `try` block, so any throw is caught and returns `{ findings:[], quality:'low', disclosure:'research pipe unavailable: ...' }`, and the fan loop treats `quality:'low'` as a halt regardless of which branch produced it. Confirmed the envelope holds in both cases.
4. **No `fetch(` on an executable line of `intel-pipeline.cjs`:** grep confirms zero matches.
5. **No em-dashes:** byte-level scan (U+2014) of all four files came back clean; the file's own Behavior 4 structural assertion also checks this and passes.

## Warnings

### WR-01: New regression test leaks 4 temp directories per run, breaking the established cleanup convention in the same suite family

**File:** `tests/test-quick-260910-dk1-intel-pipeline-lens-contract.cjs:55, 100, 145, 157, 177`
**Issue:** `mkTmp()` (`fs.mkdtempSync`) is called four times (`b1`, `b2a`, `b2b`, `b3`) and none of the resulting directories are ever removed. The sibling file in the same phase, `tests/test-223-intel-pipeline.cjs`, creates one tmp dir and explicitly cleans it up with `fs.rmSync(tmp, { recursive: true, force: true })` (line 187) — the established convention this new file should have followed. Running the new test once during this review left 35 stray `q-dk1-*` directories under the OS tmpdir; every CI run or local re-run adds more, and nothing in the repo currently reaps them.
**Fix:** Track the created dirs and remove them in a `finally`/end-of-`main()` cleanup, mirroring `test-223-intel-pipeline.cjs`:
```js
const tmpDirs = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}
// ... in main(), after all behaviors run (or in a try/finally):
tmpDirs.forEach((d) => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* ignore */ } });
```

## Info

### IN-01: `dimension` is stamped into the `runSourceLens` opts object but the driver never reads it

**File:** `lib/core/intel-pipeline.cjs:135`
**Issue:** `defaultResearchFn` passes `dimension: dimension` inside the object handed to `lensDriver.runSourceLens(...)`. Checked `lib/lens-engine/source-lens-driver.cjs` (the reference contract, lines 405-460 and beyond): `runSourceLens`'s documented and actual opts surface is `roomDir, topic, lensSet, preflight, stage, db, sessionId, _fetchCorpus`/`_fetchCorpusEnvelope` — there is no `opts.dimension` read anywhere in that file (confirmed via grep, zero hits for `dimension` in `source-lens-driver.cjs`). The field is silently ignored by the production driver today; it's dead weight on that call, not a bug, but worth a comment or removal so a future reader doesn't assume the driver is dimension-aware.
**Fix:** Either drop the field from the driver call (it already reaches the return value via the outer `dimension` closure variable, so nothing downstream needs it there), or add a one-line comment noting it's forwarded for future driver use / debugging only.

### IN-02: Test-seam threading relies entirely on convention comments, not an enforced test/production mode flag

**File:** `lib/core/intel-pipeline.cjs:449-450`
**Issue:** `if (isPlainObject(o._extractor)) researchCtx._extractor = o._extractor;` (and the `_lensDriver` sibling) is guarded only by shape-checking, with the safety argument resting on "a real function value can't cross MCP's JSON-RPC boundary" plus "there is currently no production caller." Both are true today, but neither is enforced by the code itself — if a future integrator ever builds a same-process bridge that forwards a loosely-typed `opts` bag into `runIntelPipeline` (e.g. a plugin-to-plugin call, or a test helper reused in a non-test context), the seam would activate silently with no environment check. This is not exploitable via any external input today, so it's Info rather than Warning, but it's the kind of gap that becomes a Critical the day a new call site is added carelessly.
**Fix:** Consider a defense-in-depth guard such as gating the seam behind `process.env.NODE_ENV === 'test'` or an explicit `opts.__test === true` co-flag, so a same-process misuse fails loudly instead of silently swapping the research pipe.

---

_Reviewed: 2026-09-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
