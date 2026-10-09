# CHANGES-core: eureka/lib/core/eureka/*.cjs (19 files, slice a4)

Run the tests (Node 22.13+ for node:sqlite; no network, no installs):

    node --test package-2026/eureka/_tests/core/*.test.cjs

Result of the last run: 74 tests, 74 pass, 0 fail (4 test files, harness.cjs builds a throwaway plugin tree in the OS temp dir with hand-written stubs for the missing sibling modules; nothing is stubbed inside shipped files). Most "BUG(orig)" tests load the pristine file from _baseline/orig through the same harness and assert the original misbehaves, so each fix is demonstrated, not claimed.

Counts: improved 10 (ahp-weights, eureka-enable, eureka-reach-runner, explore-chain, explored-artifact, opportunity-harvest, portfolio-dimensions, reasoning-mode, report-html, tail-quadrant), minor fixes 7 (candidate-exclusion, grade-grant, grade-grant-examine, lateral-engine-adapter, opportunity-statement, qualify-opportunity, room-native-substrate), unchanged 2 (compression-meter, eureka-offer).

Compatibility: every export, signature and existing JSON key is kept. Additions are new keys or optional args only. Behaviour changes on formerly-malformed input are called out as "behaviour change".

---

## ahp-weights.cjs  | Status: improved | Risk: low
Wrong (orig):
- l.96-105 reciprocity tolerance 1e-9 rejects any hand-edited matrix with 1/3 typed as 0.333 (product 0.999). The module's own premise is that a navigator edits this JSON.
- composeScore (l.232) returns a convex sum that can be 1.0000000000000002 (> documented [0,1]); NaN or negative weights pass the length check and yield NaN.
- loadAhpConfig gives a raw SyntaxError with no file name on bad JSON.
- Judgments outside Saaty's 1/9..9 scale are silently accepted.
Changed: RECIP_TOL 5e-3 (3 and 3 still rejected); composeScore validates weights are finite and >= 0 and clamps to [0,1]; AHP_CONFIG_PARSE error names the file; result adds method, ri, cr_max, out_of_scale. Math checked: geometric-mean weights sum to 1, exact on consistent matrices (CR 0), lambdaMax >= n, textbook intransitive matrix gives CR > 0.1.
Verified: numerics.test.cjs (8 AHP tests).

## candidate-exclusion.cjs | Status: minor fixes | Risk: low
Wrong (orig): l.136-139 multi-word entity names were matched by raw substring (`text.includes`), so "Lab Automation" matched inside "collab automation" and counted toward the half-the-corpus low-IDF exclusion; punctuation also broke matches.
Changed: documents carry a normalised token stream; multi-token names match on word boundaries, case/punctuation-insensitive. The rest of the logic (reason order, traversal guards, Windows separators, content-wins failure posture) was sound and is untouched.
Verified: reason order, traversal (`..`, absolute, backslash) and boundary-match tests.

## compression-meter.cjs | Status: unchanged
Reviewed: delta = clamp01((human-observed)/human) guarded for non-finite and non-positive baseline; gates are exact label matches; Lured returns -1 x max(delta, 0.25), always strictly negative and not rescuable by gates; never NaN. Covered by tests; no defect found.

## eureka-enable.cjs | Status: improved | Risk: low
Wrong (orig): `_tailCapture` sliced `(0, 500)`, i.e. the HEAD of stderr although named tail; npm prints the failing line last, so the reported reason lost it. A spawn that never started (ENOENT, timeout) returned an empty stderrTail. With shell:true (Windows .cmd) a prefix such as `C:\Users\Jane Doe\...` splits into two arguments.
Changed: last 500 chars; spawn error prepended; whitespace/metachar args quoted at spawn time only (buildEurekaInstallArgv output unchanged).
Not verified: real npm install, real Windows cmd quoting (needs network and Windows). Also unverified: the unseen buildInstallArgs may already quote; the quoter skips args that are already wrapped in quotes.

## eureka-offer.cjs | Status: unchanged
Reviewed: abstention gate is strict (closed enum, transferable only), template filled with function replacements ($ safe), confidence passthrough, all failures degrade to FALLBACK_SEED / null. Tested; no defect.

## eureka-reach-runner.cjs | Status: improved | Risk: low
Wrong (orig): temp file name `<file>.tmp.<pid>` is shared by overlapping async scans in one process, and a failed write leaves the temp file behind; `resolveEurekaDiffFloor()` was called outside any try, contradicting "never throws"; a scorer exception was reported as plain `below_floor` with no way to tell it from a low score; probeGuard discarded the exception; `markEurekaReachSurfaced('__proto__')` returned ok:true but stored nothing (JSON.stringify drops the prototype key), and an array-valued `entries` was accepted.
Changed: unique temp name plus cleanup; floor resolution guarded; non-finite abs_diff rejected; additive `detail` on probeGuard and on scan failures (reason enum unchanged); ledger entries held in a null-prototype object; array entries treated as corrupt.
Not changed / flagged: markEurekaReachSurfaced is a read-modify-write with no lock, so two processes can lose an entry (needs the fs lock the plugin uses elsewhere).
Verified: closed-schema validator (extra keys, bad enum, unquantised number, newline in path node, lowercase edge, long handle), floor/band/guard reasons, atomic write, ledger.

## explore-chain.cjs | Status: improved | Risk: low (one item needs-check, see below)
Wrong (orig):
- l.367-375 `runFanConcurrently` did `fanSteps.slice(0, cap)`: if resolveFanoutCap returns less than the leg count the extra analysis legs were silently dropped while the run still reported success.
- l.637-646 the host onStep result was read synchronously (`out.chain_output`); an async host returns a Promise, so engine_mode stamping (the D-20 calibration-exclusion marker) and research_mode/providers capture were skipped.
- The parallel->sequential fallback re-ran every leg but kept the providers/research_mode accumulated by the failed pass (double counted).
- l.271-290 citations accepted any url string (javascript:, multi-line) and filed it.
- l.634 `corpus.results.length` crashes when a corpus degrade returns no results array.
Changed: legs run in batches of at most cap, order preserved; async-safe stamping; onSequentialFallback resets the envelope; citations limited to single-token http(s) URLs; results guarded.
Needs-check (not changed): the parallel pre-pass (runAnalysisLegsParallel) dispatches the four analysis legs WITHOUT consulting gateFn/posture, while the sequential path gates each step (Canon Part 3: material steps halt). Today all four legs are autonomous_safe frameworks so it is equivalent, but if a leg's registry posture ever becomes material the parallel path would run it ungated. Only the filing step passes the gate.
Verified: policy resolution, cold probe costs one leg, warm fan-out order, approve/skip filing, engine-absent offer, async stamping, cap batching, fallback reset, citation filtering.

## explored-artifact.cjs | Status: improved | Risk: low
Wrong (orig):
- l.99-101 `yamlQuote` leaves newlines in place and l.247 writes `url: <raw>`: a newline in a cite url, problem name or minto governing_thought injects extra frontmatter keys (demonstrated: a second `engine_mode:` / `status:` line; engine_mode is the calibration-exclusion marker).
- l.197 + l.337 non-Latin names slugify to '' so every Hebrew/Arabic/CJK problem used the folder `opportunity/opportunity.md`; the second problem silently overwrote the first (dedupe by problem_hash only helps for the same name).
- Em/en dash literals in the source regex (house rule).
Changed: line breaks flattened in every quoted scalar; urls emitted plain only if http(s) without whitespace/quote/#, else quoted; an existing file at the target slug with a different problem_hash sends the new artifact to `<slug>-<hash>`; dash literals written as \u escapes.
Verified: two injection tests, Hebrew collision (orig collides, new keeps both and still updates in place for the same problem), invariant failure files nothing.
Not verified: the real parseFrontmatter reading quoted urls (stubbed); only the shape of the frontmatter is asserted.

## grade-grant.cjs | Status: minor fixes | Risk: low
Changed: findings lookup uses a null-prototype map (ids like `__proto__` are ordinary); validateRubric rejects duplicate criterion ids (they were double counted; new reason `fixture_duplicate_criterion`, behaviour change for malformed fixtures); listPrograms reports skipped fixtures in an additive `skipped` array; scoreApplication adds score_raw and weights; writeGradingResult validates counts and returns invalid_verdict instead of write_threw. Scoring (1.0 / 0.5 / 0.0, rounded percent) is identical to orig (tested).

## grade-grant-examine.cjs | Status: minor fixes | Risk: needs-check (behaviour change)
Wrong (orig): l.299 an evidence item with a missing or unknown status was treated as 'evidenced' (full credit), which is fail-open and contradicts the module's own stricter-status-wins rule and scoreApplication (unknown -> absent).
Changed: missing/unknown status -> 'asserted' (half credit). Callers whose agents omit status on evidence items will see lower scores; that is the intended direction. Fan-out result accumulation tolerates missing cells/plan.
Verified: collision, challenge (downward only, every challenge recorded, input not mutated), batching 7 -> 5+2, default dispatch cell.

## lateral-engine-adapter.cjs | Status: minor fixes | Risk: none
Changed: signed_diff forwarded only if a finite number; NaN, Infinity and numeric strings become null (orig forwarded NaN). Adapter degrade-to-null path tested.

## opportunity-harvest.cjs | Status: improved | Risk: low
Wrong (orig): normalizeName used [^a-z0-9], so any Hebrew/Arabic/CJK name became '' and never deduped against the bank; a null or non-object row in the 215 report threw TypeError and aborted the whole harvest (harvest_failed); NaN dims were turned into a portfolio_score; the temp file is shared by pid and leaks on failure; candidate_id is a 32-bit hash so two candidates can share a handle; an unreadable bank silently disabled Q7 dedup.
Changed: Unicode-aware normalisation (NFKC, \p{L}\p{N}); row/finite guards; unique temp + cleanup; deterministic `-2` suffix on id collision; result gains `warnings` (the side-channel file schema is untouched).
Math checked: HarvestIndex = critic gate x weights renormalised over the known components (hand-computed value asserted); measured fail -> 0; unknown -> 'unknown'; cross-section pair outranks within-cluster; two runs byte-identical.
Flag (not changed): compression_score is not clamped, so a negative Lured score lowers the index and the value can go below 0. Probably acceptable for an advisory EXPERIMENTAL index but undocumented.

## opportunity-statement.cjs | Status: minor fixes | Risk: low
Wrong (orig): an injected sync critic that returns undefined produced `critic: undefined`; a synchronous stageA returning the degraded (encoder-unavailable) envelope was recorded as a verdict although the async path correctly treats it as a non-evaluation; room titles with newlines or em dashes were spliced into the one-sentence statement.
Changed: both become 'pending'/unbanked; slot values whitespace-collapsed and dashes mapped to '-'. For clean input the text is byte-identical to orig (tested). banked can still never be true without a passing verdict.

## portfolio-dimensions.cjs | Status: improved | Risk: low
Wrong (orig): scoreTechDimensions re-maps and re-sorts the whole cohort for every tech: O(n^2 log n) over the 2117-tech portfolio. percentileRank for a value not in the cohort used below+1, i.e. it scored exactly like the next larger member (value 3 in [1,2,2,2,5] ranked 1.0, the same as the maximum). weakDimensions(floor=NaN) returned nothing weak.
Changed: new exported prepareCohort(cohort) and optional third arg to scoreTechDimensions (identical output, tested against orig on 60 techs); absent values rank midway (0.875 in the example; behaviour change only for values not in the cohort, which the tech path never produces); NaN floor falls back to WEAK_FLOOR.
Flag (not changed): tierScore treats a numeric-string tier ("2") as missing (0.25). Changing it would move the pinned ranking, so left alone.

## qualify-opportunity.cjs | Status: minor fixes | Risk: low
Changed: non-finite rubric numbers are reported as 'unknown' rather than a measured fail; suggestNext breaks score ties by candidate_id (same rule as the harvest producer) so "next" no longer depends on input order.
Flag (not changed): qualifyCandidate runs mint, confirmNode, advanceOpportunityStage, bankOpportunity as separate calls with no transaction; a failure after confirmNode leaves a confirmed node that is not banked (the retry is idempotent, so it self-heals on a second Qualify).

## reasoning-mode.cjs | Status: improved | Risk: low
Wrong (orig): l.108 frontmatter regex is LF-only, so CRLF files (Windows) keep their YAML block in the text fed to the Jaccard anchor and to the judge prompts; proposeCandidatePairs materialised all n(n-1)/2 pairs and sorted them to keep `cap` (25) of them; a NaN overlap breaks the comparator; ids use backslashes on Windows and entry order depends on readdir order; validateMappings throws on a null candidate; a candidate id is used as a file name without validation; assertReasoningInvariants did not check the one surviving number.
Changed: CRLF/BOM-tolerant stripBody; bounded rolling selection with the same (overlap, enumeration order) key, proven identical to orig output for several caps; forward-slash, sorted ids; null-safe mappings with own-property lookup; id must match [A-Za-z0-9_-]{1,64} or emitReasoningPrompts throws; lsa_similarity must be finite in [0,1].
Note: the n^2 loop still computes every pair's overlap (cost is bounded in memory, not in CPU); a token-set cache needs lexical-overlap.cjs, which is outside this slice.

## report-html.cjs | Status: improved | Risk: low
Escaping review: every interpolated value in all five builders (banner, provenance, ranked rows, statement cards, upgrade, footer, title) already went through escapeHtml; no injection path was found, and an adversarial payload test (script/img/onerror in every field and even in provenance key names and run_mode) confirms it for both modes.
Wrong (orig): the header promises "never throws" but a stamp whose path lacks nodes/edges arrays threw out of the renderer (tested: orig throws); control characters were passed through; unbounded provenance cell; no defence in depth for the "zero egress" claim; Hebrew text in a ltr page.
Changed: Content-Security-Policy meta (default-src 'none', inline style only, no script, no forms); stamp path guarded; whole render wrapped so any fault returns the error page; control chars stripped; cells capped at 4000 chars; `unicode-bidi: plaintext` on cells and cards.

## room-native-substrate.cjs | Status: minor fixes | Risk: low
Wrong (orig): `catch (_e) { edgeRows = [] }` swallowed every error from the edges query, not just a missing table, so a locked or corrupt db produced an edge-less substrate that then reported honest-looking insufficient structure; array-valued properties were returned as props; whitespace-padded section names kept their padding.
Changed: only "no such table" is treated as an older room; other errors propagate; arrays rejected; trimmedString returns the trimmed value.
Flag (not changed): degree counts every edge row (multi-type edges between one pair, self edges) while convergesPairs dedupes, so the attention axis counts duplicates. Changing it would move the pinned ranking; the nodes/edges queries also have no ORDER BY (pair order and the collision "last write wins" depend on sqlite rowid order).

## tail-quadrant.cjs | Status: improved | Risk: low
Wrong (orig): classifyTail used any `typeof === 'number'` option, so `{attnQ: NaN}` (or q outside [0,1]) fed NaN into the cut-offs and silently returned an empty tail with insufficient_structure false (tested); equal-score gems ordered by input position; brokerage values outside [0,1] were added unclamped to the ordering key.
Changed: options must be finite and in range else the frozen default; tie-break by id; brokerage clamped to [0,1]; result adds cohort_size, tail_fraction, quantiles. Numerics checked: quantile is linear interpolation; with default options the tail, thresholds and ordering are deep-equal to orig on a 41-item cohort.

---
Bugs in the ORIGINALS the user must know (highest impact first)
1. explored-artifact: Hebrew/non-Latin problem names collide on one file and overwrite each other.
2. explored-artifact: newline in a cite url / name / governing_thought injects frontmatter keys (including engine_mode).
3. explore-chain: fan-out above the cap drops analysis legs; async host onStep loses engine_mode stamping and research_mode; fallback double counts providers; the parallel pre-pass bypasses gateFn (needs-check).
4. grade-grant-examine: evidence item with no status counts as fully evidenced.
5. reasoning-mode: CRLF frontmatter not stripped; room-native-substrate: DB errors swallowed into a zero-edge substrate; opportunity-harvest: non-Latin names never dedupe.
6. eureka-reach-runner: ledger silently ignores a `__proto__` handle while reporting ok.
