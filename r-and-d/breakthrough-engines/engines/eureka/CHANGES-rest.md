# CHANGES-rest: eureka commands, skill, critic, judge, recall, sensor, doctor modules, scripts (13 files, slice a5)

Run the tests (Node 22; no network, no installs; nothing is written inside the package or `_baseline`):

    bash package-2026/eureka/_tests/rest/run-all.sh

Result of the last run: 12 test files, 348 checks, 348 pass, 0 fail (critic 75, critic-diff 35, critic-run 26, deps-resolver 20, fts-health 15, jev-judge 23, judge 16, md-and-json 30, recall 25, room-report 26, sensor 30, smoke 27). `_stubs.cjs` replaces the modules missing from this slice through a `Module._load` hook placed in the test folder; no stub lives in a shipped file. Most "orig" checks load the pristine file from `_baseline/orig` through the same harness and assert the original misbehaves, so each fix is demonstrated, not claimed. `test-critic-diff.cjs` also checks that, with default options, the 2026 critic produces byte-identical prompts, identical `runRubric` results and the identical `verdictFromRubric` table (all 64 item combinations) as the original.

Counts: improved 8 (eureka-critic, eureka-recall, eureka-judge, eureka-critic-run, eureka-jev-judge, eureka-room-report, class-s-eureka-smoke, eureka-fts-health-module), minor fixes 5 (eureka-critic-tags.json, eureka-deps-resolver, sensor-eureka, commands/eureka.md, skills/eureka/SKILL.md), unchanged 0.

Compatibility: every export name, signature, CLI flag, JSON key and path is kept. Additions are optional args, new keys and new exports. Behaviour changes are listed as "behaviour change". The judge components follow the CONVENTIONS rule that LLM judges are triage only: nothing here lets a judge answer reorder, drop or promote a candidate, and verdicts stay computed by code.

---

## lib/core/eureka-critic.cjs | Status: improved | Risk: low (3 behaviour changes below)
Wrong (orig):
- l.660: a Stage A result that came from a degraded encoder (`degraded: true`, tag `calibration_unknown`) was returned with `confidence: 'high'`, labelled "code-certain". A missing encoder is the opposite of certain. BUG(orig), demonstrated in test-critic-diff.
- l.244: Gate 1 (fabricated quantity) scanned only `candidate.text`, not `mechanismText`, the text the rubric actually grades and embeds. A mechanism with "revenue of 3B" passed Gate 1 when `text` was clean.
- l.219: any Capitalized word that was not the first token counted as an entity, including the first word of every later sentence ("Valves open. Pressure rises. Flow stops." counted 2). Inflated entity counts let vague text clear the entity gate.
- l.408: the answer regex had no word boundary, so "(e) yesterday" parsed as yes and "(f) 10 mappings" as 1. Unparseable items silently became false with no record that parsing failed.
- Prompts: fixed rubric order a-f and fixed neutral-then-adversarial call order (position bias), no cap on mechanism length (length bias between passes), single run with no stability measure.
- Empty `mechanismText` was embedded as '' and only failed (maybe) at the entity gate.
- The kNN catch and the calibration catch discarded the reason (CONVENTIONS: no silent catch). `confidenceFromBucket` banded impossible buckets (correct > n). `quantize(-0.001)` emitted `-0`.
- Tag registry never cross-checked against the codes the module emits.
Changed:
- `classifyCandidate`: degraded Stage A now `confidence: 'unknown'` plus `degraded: true` (behaviour change; real gate trips stay `high`). Result gains `novelty_check` ('checked' | 'not_run'), `agreement`, `provenance` (computed_at, embedder, Stage A tunables, rubric_version, seed, repeats, judge calls, judge_role "triage_only") and `calibration_error` when the calibration path failed. `opts.now` overrides the timestamp for tests.
- Gate 1 also scans `mechanismText` (behaviour change; `EUREKA_GATE1_MECHANISM=0` restores the old scan). Empty mechanism fails fast with `features.empty_mechanism`. Sentence-start capitals no longer count as entities (behaviour change). `features.nn_error` records a kNN failure.
- `buildNeutralPrompt(candidate, opts)` / `buildAdversarialPrompt(candidate, opts)`: optional `{ seed, maxChars }`. With no opts the text is byte-identical to the original (verified). A seed shuffles the display order of the six rubric items (letters stay attached) and `EUREKA_PROMPT_MAX_CHARS` (default 8000, 0 disables) caps mechanism and mapping identically for both passes.
- `runRubric(candidate, opts)`: new `opts.seed` (seeded rubric order and seeded coin for which pass runs first) and `opts.repeats` 1..9. An item is 1 or 0 only if every judgment agrees; any instability across passes or replicates records `x` and routes `rubric_disagreement`. `judgeFn(prompt, meta)` receives `{ pass, replicate, seed }` (one-argument judges unaffected). Result gains `agreement` (judgments, mean_item_agreement, per-item agreement, neutral_adversarial_agree, replicate_stable, unparsed_items), `judgments`, `seed`, `repeats`. Defaults reproduce the original (35 differential checks).
- Parser: `\b` after the answer; new `parseRubricResponseDetailed` reports which items were unparsed.
- Registry: `loadCriticTags` now fails at load if an emitted tag is missing, `unknown` is not a domain tag, domain tags repeat, `rubric_pattern_len` is not 6, or `tag_verdicts` names unknown tags or verdicts. `confidenceFromBucket` returns 'unknown' for impossible buckets; new `bucketInterval` (Wilson 95%) because an n=1 bucket reads 'high' on a point estimate. `quantize` never returns -0.
Verified: test-critic.cjs (75), test-critic-diff.cjs (35). All 64 rubric outcomes were run through `runRubric` and checked against `tag_verdicts`.

## data/eureka-critic-tags.json | Status: minor fixes | Risk: none
Wrong (orig): the file said any change must bump `schema_version`, but `eureka-critic.cjs` hard-requires 1, so the bump instruction cannot be followed without a code change; `low_novelty_delta` is emitted with two different verdicts (Stage A gate 3 gives `restatement`, rubric item d gives `general_shallow`) and `calibration_unknown` accompanies any verdict, none of which the file recorded.
Changed: added `tag_verdicts` (which verdicts each tag may accompany), `rubric_keys`, `_note_2026`. Every original key and value is untouched; `schema_version` stays 1. Checked in test-critic (all 64 rubric outcomes) and test-md-and-json.

## lib/core/research-planner/perspectives/eureka-judge.cjs | Status: improved | Risk: low
Wrong (orig):
- l.94: `catch (_e) { v = null; }` discarded every judge failure, so an outage looked like "judge said nothing".
- Single judge call per pair with fixed A/B excerpt order: a position-biased judge (prefers whichever side comes first) gave a confident, unrepeatable answer with no stability signal.
- l.61: `Math.min(entityMin, 1)` makes `EUREKA_ENTITY_MIN` irrelevant above 1 (kept as shipped, now documented in the code; flagged below).
Changed: `judgeCandidates` accepts `opts.seed` and `opts.repeats` (1..9). `judgeFn(candidate, meta)` gets `{ replicate, swap, seed }`; `swap` follows a seeded, per-pair schedule that alternates orientation across replicates (the callee honours it). Row choice is the strict-majority choice; any disagreement sets `unstable: true` and `human_routed: true` and a three-way split gives `choice: null`. Rows gain `agreement` ({ runs, valid, modal_share }) and `judge_error`; summary gains `unstable`, `judge_errors`, `repeats`, `seed`, `mean_modal_share`, `bucket_interval`. Output order is input order; the judge never drops or reorders. No seed and repeats 1 gives rows identical to the original (checked, modulo the `agreement` key).
Verified: test-judge.cjs (16).

## scripts/eureka-jev-judge.cjs | Status: improved | Risk: low (one needs-check)
Wrong (orig):
- l.147: `main()` ran at import time, so `require`-ing the file (a test, or a tool wanting `canonicalKey`) started a judge run and could exit the process.
- l.95: `--max` with no value (parsed as `true`) or a negative gave NaN or a negative slice end.
- `excerptsFor` dereferenced a null db; error redaction covered only `sk-` tokens.
- No record of model, seed or settings next to the verdicts.
Changed: `--seed` and `--repeats` (position-bias control and repeat agreement, via judgeCandidates; the swapped orientation is shown to the judge with excerpts exchanged); `intFlag` bounds `--max` (1..1000, default 25); null-db error; `redact` also strips Bearer tokens and api-key/token values; writes `03_judge/jev-provenance.json` (model, profile, seed, repeats, max, pairs, node, usage, band, judge_role); runs `main()` only under `require.main === module` and exports helpers. `jev-responses.json` keeps its exact hash-to-response shape; `--check` replay works without a key (tested).
Risk: with `--seed`/`--repeats`, swapped bodies are registered in the ceiling guard's pair map under `b|a`. The real `jev-question-ceilings.cjs` is not in this slice, so whether its guard accepts that is UNVERIFIED. Default runs (no seed, repeats 1) take the original path. Anything that relied on the file auto-running when `require`d would break (the CLI is unchanged).
Verified: test-jev-judge.cjs (23) as a child process with a preloaded stub client; a deliberately position-biased stub judge is flagged unstable on every pair.

## lib/core/research-planner/perspectives/eureka-recall.cjs | Status: improved | Risk: low
Wrong (orig):
- l.310: `(?=^##\s|\Z)`. JavaScript has no `\Z` (it matches a literal "Z"), so an `## Inputs` block that is the last heading in a CONTEXT.md never matched, and any Inputs block containing a capital Z ("Zoning") was cut there. The `icm_declared` lane silently lost couplings. BUG(orig), demonstrated.
- Same function: the section slug was regex-escaped only for `-`, so `delta.v2` also matched `deltaXv2/`.
- l.404: comparator ended `(x.a < y.a ? -1 : 1) || (x.b < y.b ? -1 : 1)`; the first term is never 0, so rows sharing `a` never reached the `b` tie-break and the comparator answered 1 for both orders (inconsistent, engine-dependent order). BUG(orig), demonstrated.
- l.549: `runRecall` called `db.prepare` on a null handle (room without room.db) and died with a TypeError.
- Lexical lane was an all-pairs O(n^2) sweep (3.2 s at 2500 things) with a fixed 0.08 Jaccard floor.
Changed: regex fixed and fully escaped; proper three-way comparator (behaviour change only for rows that tied before: order is now defined); `runRecall` returns `{ ok: false, reason: 'room_db_missing' }` for a missing db; default lexical lane uses an inverted index with the same Jaccard and floor (candidate sets, counts and rows verified identical to the original on 6 random substrates; 325 ms vs 3205 ms at 2500 things; falls back to the exhaustive path if the floor is <= 0). New option `lexicalMode: 'tfidf'` (idf-weighted cosine, floor set from the corpus percentile `budgets.lexical_percentile`, default 0.95, bounded at 5,000,000 scored pairs, each candidate carries `lexical_pct`); default stays `jaccard` because the 366-08 golden output must not move. `runRecall` returns `provenance` (computed_at, mode, floor, pairs scored, budgets, extra lane count, `embeds: false`). Recall never embeds; a dense signal enters only through the existing `extraLanes` hook. Diagnostics are a non-enumerable property so run-file shape is unchanged.
Verified: test-recall.cjs (25).
Not verified: the real `shared.makeCandidateStore`, `tokenize`, `jaccard` and `pairKey` were stubbed (the stub store is a plausible reimplementation); `pairKey` joining on `\u0000` is assumed by the existing code at `k.split('\u0000')`.

## scripts/eureka-critic-run.cjs | Status: improved | Risk: low
Wrong (orig):
- l.618 `updateBaseline` forced `status = 'baseline_deferred'` and replaced `buckets` on every `--score`. Re-running after the navigator flipped the baseline to `calibrated` silently erased the human approval while `approved_at` and `gold_accuracy` stayed behind, pointing at buckets that no longer existed. BUG(orig), demonstrated.
- l.598 `draftNarrative` printed a fixed paragraph asserting that pair-1 passes disagree and pair-2 passes agree, whatever the run produced. It is now computed from the run's own rows.
- l.168 private copies of both rubric prompts (comment says the builders are internal; they have been exported since Phase 226) with an extra trailing blank line, so emitted files could drift from what `runRubric` sends. l.292 `patternOf` treated "true" as 0 while the critic parser treats it as 1.
- No record of seed or repeat count, bucket table showed point estimates only (n=1 buckets read as band 'high' with no interval), unknown flags silently ignored, relative `--workdir` resolves against the plugin root without saying so.
Changed: prompts come from `critic.buildNeutralPrompt/buildAdversarialPrompt`; `patternOf` and `confidenceBand` delegate to the critic; `--seed`, `--repeats` (answers may be `{ runs: [{ neutral, adversarial }, ...] }`; legacy `{ neutral, adversarial }` still scores) and `--force-recalibrate`; a calibrated baseline is left untouched unless forced; baseline write is atomic; `EUREKA_EVALS_DIR` relocates the evals tree (default unchanged) so tests never write into the shipped folder; manifest and report record seed, repeats, prompt cap and Node version; bucket table gains Wilson 95% columns; unknown flags warn.
Verified: test-critic-run.cjs (26) end to end on fixture cards and drafts; the original run in a private temp copy reproduces the baseline-reset bug.

## scripts/eureka-room-report.cjs | Status: improved | Risk: low
Wrong (orig):
- l.369: one object per scored pair (each holding both full texts) pushed into `scored`, then sorted: memory grows with n^2 (about 12.5M objects for 5000 nodes).
- Any exception from `scoreMeasured` was counted as "Part 8 figure-guard" skips, hiding real scoring bugs inside that number. `loadIndexVectors` swallowed read errors, so a missing table looked like an empty room with no reason given.
- Rows showed no node ids (no source trail), fixed floors only (0.1..0.5, called UNCALIBRATED in the report itself), flag without a value crashed `path.isAbsolute(undefined)`, `main().then` had no rejection handler, report written non-atomically.
Changed: bounded top-N insertion (ranking, including ties, identical to the original stable sort: verified on a corpus with duplicate texts), one Float64 per scored pair for percentiles, seeded deterministic pair sampling above `--max-pairs` (default 5,000,000; stated in the report); egress-named errors count as Part 8 skips, everything else as "failed to score" with the first message; `loadIndexVectors(db, backend, errOut)` reports the reason; report gains corpus percentile cut-offs (p50/p90/p95/p99), mean and std, per-candidate `pct` and `z`, a Source trail table (node ids, extracted text, retrieval date), explicit "novelty check NOT RUN" status, run timestamp and Node version; value-less flags ignored safely; atomic write.
Verified: test-room-report.cjs (26): identical top-15 rows, fire counts and pair counts vs the original.
Not verified: the live path (`indexNodes`, `scoreMeasured`, sqlite-vec, the real encoder) was stubbed; the egress classification assumes the real error name or message contains "egress" (the original comment says `ExternalEgressViolation`). A differently named refusal would show under "failed to score", still counted.

## lib/core/doctor/class-s-eureka-smoke.cjs | Status: improved | Risk: low
Wrong (orig):
- l.251: L3 resolved the cache dir through a bare `require('@huggingface/transformers')`, while the header and L5 say `eureka-deps-resolver` is the one authority. On a machine where `/mos:eureka enable` installed the package into `~/.mindrian/eureka-deps`, L3 could not see it and used the "unknown cache dir" path. BUG(orig), demonstrated with a fake side-dir install.
- l.93: `Number(env) || 20000` accepted negative values (-5 is truthy) and made every probe time out at once.
- l.461: `require.resolve` of the installer was unguarded, so a missing installer threw out of `fix()` (the doctor invokes it with no try); a timeout produced "exited -1" with no cause. A layer returning nothing surfaced as an opaque TypeError string. Header said "4-layer" for a five-layer probe.
Changed: L3 uses `requireEurekaDep`; timeout env must be finite and > 0; `fixEurekaSmoke` returns a structured result for a missing installer and includes `r.error.code` (ETIMEDOUT etc.); `_runLayer` reports "layer returned no result object"; header corrected. Wire-locked layer ids and order, exports and overall-verdict logic unchanged (checked against the original).
Verified: test-smoke.cjs (27). `spawnSync` is patched in the test; the real installer is never run. Not verified: the real embedding spine and a real model probe.

## lib/core/doctor/eureka-fts-health-module.cjs | Status: improved | Risk: needs-check
Wrong (orig):
- l.229: status was `'warn'` only for a stale index. A room that threw while being read (`state: 'unavailable'`) and a room with a permanent build-failure log both reported `'ok'`, the false success the header (T-244-25) says this check exists to prevent. The failure log was read into `rooms[].failure_count` but never affected status or `detail`.
- The catch recorded no reason; `closeRoomDbForCaller(db)` was called with null for rooms with no db.
Changed (behaviour change): `status: 'warn'` also for unreadable rooms and for rooms with build failures; `totals` gains `unavailable` and `build_failures` (original five keys unchanged); unreadable rooms carry an `error` (first message line, 120 chars); `detail` names them; close is guarded. Absence alone still never warns.
Risk: tests such as tests/test-244-doctor-fts-health.cjs and the contract-parity suite are not in this slice; one that pins `status: 'ok'` for a room with a failure log would need updating.
Verified: test-fts-health.cjs (15).

## lib/core/eureka-deps-resolver.cjs | Status: minor fixes | Risk: none
Wrong (orig): a package that fails to load (broken native binding, missing transitive module) collapsed into the same `null` as "not installed"; `MINDRIAN_EUREKA_DEPS_ROOT` was returned as given although the contract says absolute; no package-name length bound.
Changed: new export `eurekaDepError(name)` returns the last non-trivial load failure; override is `path.resolve`d; 214-character name bound. Three original exports unchanged.
Verified: test-deps-resolver.cjs (20).

## lib/core/sensors/sensor-eureka.cjs | Status: minor fixes | Risk: none
Wrong (orig): l.294 a malformed stamp path made `formatPathText` throw into the outer catch, suppressing the whole guard-cleared reach (BUG(orig), demonstrated). Non-finite `differential_quantized` passed the `typeof number` test.
Changed: only `stamp_path` is blanked on a formatter failure; differential must be finite (defensive: JSON cannot carry NaN, so this guards non-JSON callers). Otherwise the sensor is sound: stat-before-parse freshness, future-mtime guard, fail-closed ledger, enum and handle-only evidence all kept. Evidence is identical to the original on every normal input (checked).
Verified: test-sensor.cjs (30).

## commands/eureka.md and skills/eureka/SKILL.md | Status: minor fixes | Risk: none
Wrong (orig): no statement of inputs, outputs, failure behaviour or stop conditions; Step 2 told the host to "judge what comes back" with no limit on what that judgement may do; Step 5 allowed unbounded `reask` loops; SKILL.md said "when CLAUDE_PLUGIN_ROOT is unset, fall back to ./scripts/resolve-room" directly under a command whose `:?` guard errors in exactly that case (the two cannot both be true); a frontmatter comment pointed at `commands/eureka.md:216`, a line that no longer holds that content.
Changed: new section "Inputs, outputs, failure and stop"; judging is triage only (annotate, never reorder, drop or verify; report instability); two reask rounds maximum; failure rows for a failed planner call and for `ok: false` recall (quote `reason`); bash-on-Windows note; SKILL.md pre-flight text now matches its guard; stale line reference replaced. All frontmatter keys and values, subcommands, planner commands (in order), glyph vocabulary and headings are preserved (checked in test-md-and-json).
Left alone and reported: the `description` / `help_jtbd` promise a "ranked ... table" and "weak-signal tail" while Step 6 forbids rendering scores; `connector.sensor_triggers` is `[SENS-13]` in the command and `[]` in the skill; `connector.reach_id` is `context_block` while sensor-eureka rides the `deep_research` reach. Which side is right needs the owner's call.

---

Bugs in the ORIGINALS the user should know about (all demonstrated by a test that runs the pristine file):
1. eureka-critic classifyCandidate: encoder-down Stage A result reports confidence 'high'.
2. eureka-recall declaredCouplings: `\Z` is not an end-of-input anchor in JavaScript, so a last-heading Inputs section is never read and a capital Z truncates earlier ones; plus an inconsistent sort comparator and a TypeError on a room with no room.db.
3. eureka-critic-run updateBaseline: re-running --score wipes a human-approved `calibrated` baseline; draftNarrative prints fixed conclusions regardless of results.
4. class-s-eureka-smoke L3 bypasses the deps resolver (cannot see the side-directory install); negative timeout env; fixEurekaSmoke can throw.
5. eureka-fts-health-module reports ok for unreadable rooms and for rooms with permanent build failures.
6. sensor-eureka: a stamp-path formatter error suppresses the whole reach.
7. eureka-jev-judge runs main() when merely required.
8. eureka-judge: `Math.min(EUREKA_ENTITY_MIN, 1)` makes the env var inert above 1 (kept; confirm intent).

Not verifiable here (no network, modules missing from the slice): the Jev client and its ceiling guard, the real embedding spine, sqlite-vec, `scoreMeasured` and the tri-modal index, the real `shared.cjs` candidate store, `direction-convention.cjs`, `rs-egress-prompts.cjs`, gray-matter; the hybrid dense signal for recall (left on the `extraLanes` hook, not built); any test outside `_tests/rest`.
