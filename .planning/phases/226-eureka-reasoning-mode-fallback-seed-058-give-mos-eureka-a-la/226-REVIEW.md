---
phase: 226-eureka-reasoning-mode-fallback-seed-058-give-mos-eureka-a-la
reviewed: 2026-07-15T18:07:38Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - commands/eureka.md
  - lib/core/eureka-critic.cjs
  - lib/core/eureka/reasoning-mode.cjs
  - lib/core/eureka/report-html.cjs
  - lib/core/eureka/tri-modal-index.cjs
  - scripts/eureka-command.cjs
  - scripts/eureka-portfolio-report.cjs
  - tests/fixtures/226-reasoning-pairs.cjs
  - tests/test-226-degrade-cause.cjs
  - tests/test-226-field-contract.cjs
  - tests/test-226-mode-disclosure.cjs
  - tests/test-226-null-legs.cjs
  - tests/test-226-pair-cap.cjs
  - tests/test-226-posture.cjs
  - tests/test-226-rejection-replay.cjs
  - tests/test-226-rubric-parity.cjs
  - tests/run-all-226.sh
  - lib/memory/run-feynman-tests.cjs
  - docs/ENV-TUNING.md
  - docs/CANON-PHASE-MAP.md
findings:
  critical: 3
  warning: 3
  info: 2
  total: 8
status: issues_found
---

# Phase 226: Code Review Report

**Reviewed:** 2026-07-15T18:07:38Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

The four highest-risk properties named in the review brief were traced end to end against the real code (not just the tests):

1. **Fabricated-number prohibition (Gate 1 / D1).** Genuinely blocks. `gate1Trips` short-circuits `emitReasoningPrompts`/`scoreReasoningPairs` before any judge call, `assertReasoningInvariants` is a hard `assert.strictEqual`/`throw` called immediately before every `fs.writeFileSync`, and only `verdict === 'transferable'` rows ever reach `ranked`. This holds.
2. **`banked` structurally false / zero opportunity nodes.** Holds. `bankStatements` (the only room.db writer for opportunity nodes) is called exclusively from the embedded branch of `main()`; `reasoningStageEmit`/`reasoningStageScore` `return` before that line is ever reached, and `buildReasoningStatement` hardcodes `banked:false` regardless of the assembler's own computed value. `assertReasoningInvariants` is a second, independent backstop.
3. **Pair-cap bounds the rubric fan-out.** Holds. `pairs.json` is written once by `proposeCandidatePairs` (capped at `reasoningMaxPairs()`, read at call time), and `validateMappings`/`scoreReasoningPairs` can only ever *shrink* that set, never grow it.
4. **Reasoning-to-embedded upgrade delta never silently replaces prior reasoning results.** **This is where the implementation breaks down.** The in-memory `ranked` array is never contaminated with old reasoning rows (the literal "never merge into the ranked table" requirement holds), but at the **file level** the on-disk report at `outPath`/`jsonPath` is unconditionally overwritten on every run, with no check that the thing being overwritten is a completed reasoning-mode result (or, worse, a healthy already-*banked* embedded result). Three concrete data-loss paths are detailed below (CR-01/CR-02/CR-03).

## Critical Issues

### CR-01: A second degraded `run` silently destroys a completed reasoning-mode report, with no upgrade delta at all on the `encoder_unavailable` path

**File:** `scripts/eureka-portfolio-report.cjs:1241` (guard), `:1257-1258` and `:1303-1304` (unconditional writes)
**Issue:**
`buildUpgradeDelta(jsonPath, provenance, ranked)` is only invoked when `idx.embedded === true` (line 1241). But immediately afterward, `main()` unconditionally writes `report`/`jsonOut` to the SAME canonical `outPath`/`jsonPath` that a completed `mode:reasoning` run already wrote to (`eureka-command.cjs`'s `outMd`/`outJson` are the same paths passed to both the normal `run` subcommand and `reasoning-prompts`/`reasoning-score`).

Walk the sequence:
1. Room degrades (`encoder_unavailable`). `pairs.json` is seeded. Navigator runs the full reasoning loop (`reasoning-prompts` → answer prompts → `reasoning-score`), producing a real `mode:reasoning` report with genuine statements at `portfolio-report.json`.
2. Navigator (or an automated retry, or simple habit) runs `/mos:eureka run` again. The machine is *still* cold (`idx.embedded !== true`), so `degrade_cause` is `encoder_unavailable` again.
3. Because `idx.embedded !== true`, `buildUpgradeDelta` is **never called** — no `provenance.upgrade` is attached.
4. `main()` still writes an EMPTY embedded-labeled report (`ranked: []`, `statements: []`, `run_mode: 'live (local embedding spine)'`) to the exact same `outPath`/`jsonPath`, overwriting the real reasoning-mode content with no trace of it and no acknowledgment that anything was replaced.

This is the precise failure the phase brief calls out ("must never silently merge/replace prior reasoning-mode results"), and it is untested: `tests/test-226-posture.cjs`'s upgrade leg only drives the *successful* upgrade path (`--offline`, which makes `idx.embedded === true` and actually scores > 0 pairs) — it never exercises "the embedded attempt degrades again."

Note the `below_floor` case (`idx.embedded === true`, `scored.length === 0`) is *partially* better: `buildUpgradeDelta` does run there and attaches `provenance.upgrade` with `survived:0`, but the actual prior statement text/mappings are still gone from the canonical path forever — only up to 5 bare pair-id references survive in `previous_top`.

**Fix:**
- Call `buildUpgradeDelta` unconditionally (drop the `idx.embedded === true` guard, or add a parallel "still degraded, prior reasoning result preserved" branch) so a repeated `encoder_unavailable` run at minimum discloses that a prior reasoning result is being overwritten.
- Stronger: before overwriting `jsonPath`, check whether the existing file's `provenance.run_mode === 'reasoning'` and the new attempt produced `ranked.length === 0`; if so, refuse to overwrite the canonical path (write to a scratch path instead, e.g. `portfolio-report.degraded-attempt.json`) and surface a status message rather than destroying the only copy of the navigator's completed self-judging work.

### CR-02: A stale `pairs.json` lets the reasoning stages overwrite a later, healthy — possibly already-**banked** — embedded report

**File:** `scripts/eureka-portfolio-report.cjs:1579-1587` (`reasoningStageEmit` guard), `:1604-1613` (`reasoningStageScore` guard)
**Issue:**
`reasoningStageEmit` and `reasoningStageScore` gate solely on `fs.existsSync(pairsPath)` — a **static artifact** written once by an earlier degrade. Neither stage checks whether the CURRENT report at `jsonPath` is still degraded, or whether a later, healthy `run` has since produced (and `bankStatements` has already committed to room.db as `opportunity` nodes) a real embedded ranked list.

Concretely: room degrades once (`pairs.json` seeded). Later, the encoder becomes available and a plain `/mos:eureka run` produces a healthy embedded report with real banked opportunity nodes in room.db. The stale `pairs.json` from the earlier degrade is never cleaned up. If the navigator (confused about state, or replaying an old set of answers) then runs `reasoning-prompts`/`reasoning-score`, both stages proceed happily (the guard only checks file existence) and `reasoningStageScore` unconditionally overwrites the SAME `jsonPath`/`outPath` with a `mode:reasoning` report — destroying the report-level view of the healthy, already-banked embedded run. The banked `opportunity` nodes remain in room.db (banking is graph-level, independent of the report file), but the navigator has no way to tell from `/mos:eureka report`/`html` that real banked opportunities exist; the UI now shows a "REASONING MODE — LOWER-CONFIDENCE RESULT" banner over what used to be a confirmed result.

**Fix:** Before proceeding, `reasoningStageEmit`/`reasoningStageScore` should verify the CURRENT `jsonPath` provenance is still `encoder_unavailable`/`below_floor` (or is itself already `reasoning`), and refuse (3-line error) if a healthy embedded report has since superseded it. Simplest concrete fix: have a healthy embedded `run` **delete** (or timestamp-invalidate) the reasoning `workdir`'s `pairs.json` once it succeeds, so the reasoning stages' existing "no pairs.json" guard naturally fires afterward.

### CR-03: `reasoningStageSeed` unconditionally regenerates `pairs.json` on every degraded `run`, silently invalidating an in-progress self-judging session

**File:** `lib/core/eureka/reasoning-mode.cjs:167-211` (`proposeCandidatePairs`), `scripts/eureka-portfolio-report.cjs:1543-1574` (`reasoningStageSeed`)
**Issue:**
Every time `main()` hits the degrade branch, `reasoningStageSeed` calls `reasoningMode.proposeCandidatePairs(entries, {})` and unconditionally `fs.writeFileSync`s a fresh `pairs.json` (fresh `P0001`, `P0002`, ... ids assigned in the pre-filter's current sort order) — with no check for whether `mappings.json`/`answers.json`/`prompts/` already exist in the SAME workdir from an in-progress session.

`eureka-command.cjs`'s `run` subcommand invokes the entity-extraction pre-step (`maybeExtractFirst`) on every call, and the command doc's own `run` flow can plausibly be re-invoked by the navigator while still degraded (e.g. re-running `/mos:eureka run` out of habit before finishing the reasoning loop). If room content changed between the two `run` invocations (a very likely outcome given the entity-extraction pre-step runs every time), the new `proposeCandidatePairs` call can select a **different** candidate set and/or reassign `P000N` ids to different pairs than before. A `mappings.json`/`answers.json` the navigator already wrote against the OLD ids is now silently keyed to the wrong (or nonexistent) pairs — `validateMappings` will exclude most/all of them as "missing" with no explicit signal that the mismatch is because the seed was regenerated out from under the session, not because the navigator forgot to fill them in.

**Fix:** Before overwriting `pairs.json`, check whether the workdir already holds an in-progress session (`mappings.json`/`answers.json`/`prompts/manifest.json` present) and either (a) skip re-seeding when one exists (idempotent no-op — a healthy re-seed with identical room content is byte-identical anyway, so this only changes behavior when it matters), or (b) move the stale workdir aside (e.g. `reasoning.bak-<timestamp>/`) before writing the new one, and say so in the `run` output.

## Warnings

### WR-01: `reasoning-score` before `reasoning-emit` can crash with an uncaught ENOENT instead of the standard 3-line error

**File:** `scripts/eureka-portfolio-report.cjs:1617` (`manifest` default), `:1622-1629` (retry-latch write)
**Issue:** `reasoningStageScore` defaults `manifest` to `{ candidates: [] }` when `manifestPath` (`<workdir>/prompts/manifest.json`) does not exist, but then, if any candidate has a missing/garbled answer, unconditionally does `fs.writeFileSync(manifestPath, ...)` to persist `retry_used:true`. If `reasoning-emit` was never run first (so `<workdir>/prompts/` does not exist), this throw is a synchronous `ENOENT` that is never caught. `scripts/eureka-command.cjs`'s `cmdReasoningScore` `await`s `RUNNER.main(argv)` inside an `async function` with no surrounding `try/catch`, and the top-level invocation (`main(process.argv.slice(2)).then(function (code) { process.exit(code); })`) has no `.catch()` either — so this manifests as an unhandled promise rejection / hard crash rather than a clean `x ... / Why: ... / Fix: ...` message.
**Fix:** `fs.mkdirSync(path.dirname(manifestPath), { recursive: true })` before the write, or guard the whole retry-latch block with the standard degrade-never-throw pattern used everywhere else in this file (`try { ... } catch (_e) { /* best-effort persistence */ }`), and add a `.catch()` at the `main()` top-level invocation so any future uncaught path degrades to a clean exit code instead of a stack trace.

### WR-02: The max-1-retry latch is trivially reset by re-running `reasoning-prompts`

**File:** `lib/core/eureka/reasoning-mode.cjs:262-289` (`emitReasoningPrompts`)
**Issue:** `emitReasoningPrompts` always builds a brand-new `manifest` object (`{ generated_at, formula_version, candidates: [] }`) and overwrites `manifest.json` unconditionally — it never reads/merges the prior manifest's `retry_used` flag. `reasoningStageScore`'s "one retry allowed" gate (`scripts/eureka-portfolio-report.cjs:1623`) relies entirely on `manifest.retry_used` surviving on disk. If the navigator (or a retry script) re-runs `reasoning-prompts` between a failed `reasoning-score` attempt and the next one, `retry_used` silently reverts to unset, and the "never guess to make it pass" bound the command doc promises (`commands/eureka.md:194`: "one retry allowed") is no longer enforced — the loop can be repeated indefinitely.
**Fix:** In `emitReasoningPrompts`, read the existing manifest at `path.join(workdir, 'manifest.json')` first (if present) and carry `retry_used` forward into the freshly-built manifest, the same way `reasoningStageScore` reads-then-writes it.

### WR-03: `report-html.cjs` embedded ranked rows carry no explicit `mode` field, unlike `statements[]`

**File:** `scripts/eureka-portfolio-report.cjs:1262-1277` (embedded `ranked` map, no `mode` key), `lib/core/eureka/report-html.cjs:214` (`r.mode || 'embedded'` fallback)
**Issue:** The embedded writer's `statements[]` rows explicitly carry `mode: 'embedded'` (line 1299), but the embedded `ranked[]` rows carry no `mode` field at all — `report-html.cjs`'s `rankedTable` only survives this by falling back to the literal string `'embedded'`. This is inconsistent field-parity between the two arrays (reasoning-mode rows carry `mode` on both `statements[]` and `ranked[]`) and is exactly the kind of asymmetry `test-226-posture.cjs`'s field-parity leg is designed to catch for `statements[]` but does not check for `ranked[]`. Low risk today because of the fallback, but any future consumer that reads `ranked[].mode` directly (rather than through this renderer's fallback) will silently mis-render an embedded row as unlabeled.
**Fix:** Add `mode: 'embedded'` to the embedded `ranked[]` row shape for symmetry with `statements[]` and with the reasoning `ranked[]` rows (which already carry `mode: 'reasoning'`).

## Info

### IN-01: Silent 2000-char truncation of `mechanismText`/`mappingStatement`

**File:** `lib/core/eureka/reasoning-mode.cjs:220-240` (`validateMappings`)
**Issue:** `validateMappings` truncates `mechanismText`/`mappingStatement` to 2000 characters (`.slice(0, 2000)`) with no signal anywhere in the output (`pairs.json`, prompts, report) that truncation occurred. A long, carefully-written mapping statement could be silently cut mid-sentence before it ever reaches the rubric prompt.
**Fix:** Record a `truncated: true` flag alongside the candidate when either field is clipped, and surface it in the emitted manifest/report so a reader knows the judge saw a truncated version.

### IN-02: `commands/eureka.md`'s reasoning-mode walkthrough does not warn against re-running `run` mid-session

**File:** `commands/eureka.md:167-196`
**Issue:** Given CR-03 above, the reasoning-mode section should explicitly warn Larry/the navigator not to re-invoke `/mos:eureka run` while a reasoning session is in progress (between seeding and `reasoning-score`), since doing so currently reseeds `pairs.json` out from under an in-flight session.
**Fix:** Once CR-03 is fixed at the code level, update this doc section accordingly (or, if the code fix makes re-running `run` safe/idempotent, no doc change is needed).

---

_Reviewed: 2026-07-15T18:07:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
