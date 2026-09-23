# Phase 355: Hidden in Plain Sight - Jev-through-Theo Cross-Connection Engines - Research

**Researched:** 2026-09-23
**Domain:** Room-local cross-domain engines (RS, HSI, whitespace, Eureka, find-connections) + a Theo `find_connections` verification stamp + dev-time Jev measurement, inside Canon Parts 8/9/11
**Confidence:** HIGH on the code seams (every claim re-read at HEAD `98b6f7bb9` this session, file:line current); HIGH on the Theo contract (live probe this session); MEDIUM on the fixture-room and hit-rate design (depends on open questions 1-4 below)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Direction convention (Req 1)
- **D-01:** Keep the wire ids `structural_transfer` / `semantic_implementation`. Do NOT rename (65 files, the `eureka_critic` zod enum and the SEED-014 Brain-lift contract would break; stored room labels would become unknown values).
- **D-02:** New module `lib/core/direction-convention.cjs` owns the rule: exports `classify(lsa, semantic)`, `DIRECTIONS` (the two wire ids), and `DIRECTION_MEANING` (`structural_transfer` = "same meaning, different words"; `semantic_implementation` = "same words, different meaning"), citing `355-ORIGIN-CONCEPT.md` section 3. Convention A (`rs-math.cjs:29-31, 401`: `signed_diff = semantic - lsa`, `> 0` -> `structural_transfer`) already matches the deck; it is the sourced definition. Ties at exactly 0.0 stay `semantic_implementation` (keeps `tests/272-direction-convention.test.cjs:44-48` green).
- **D-03:** Producers that flip to the module: `lib/core/hsi-lsa.cjs:130` and `lib/core/hsi-engine.cjs:272` (their output inverts); `lib/core/rs-innovation-classifier.cjs:9-15, 146-152` (its lsa-high branch flips). `rs-math.cjs:401` delegates with no behavior change. The "MUST NOT unify" warning in `hsi-lsa.cjs:7-20` protects the two similarity algorithms from each other, not the label rule; the algorithms stay separate and both call `classify`.
- **D-04:** `rs-innovation-classifier` no longer defaults to `structural_transfer`: when neither similarity clears its floor it emits `none` as a third classifier output value (NOT added to the `eureka_critic` enum, which stays two values because the critic only sees pairs that passed the floors). Downstream classifier consumers get a phase-cited amendment.
- **D-05:** The Python detector is removed from the live path: delete or gate the unconditional spawn at `lib/core/intelligence-cascade.cjs:471-483`. `scripts/detect-reverse-salients.py` and `scripts/compute-hsi.py` stay as offline reference only. No Python is ported.
- **D-06:** Tests amended with a Phase 355 citation, never silently: `tests/272-hsi-lsa-algorithm.test.cjs` (pins Convention B), `lib/memory/test-rs-innovation-classifier.cjs`, direction labels in `tests/fixtures/272/baseline-python.fixture.json` and `candidate-cjs.fixture.json`, and any of the 24 pinned test files that assert Convention B output. New `tests/355-direction-agreement.test.cjs` feeds one `(lsa, semantic)` fixture set (>= 30 pairs incl. ties, near-zero, missing values) through every live producer and asserts identical labels, and greps that no second direction rule exists outside the module.
- **D-07:** Stored HSI labels already written in user rooms under Convention B are inverted; readers re-derive the label from the stored `(lsa, semantic)` pair through the module rather than trusting the stored string. `data/*.json` carries no direction enum. The duplicate `SURPRISE_TYPES` in `lib/core/eureka/eureka-reach-runner.cjs:88` and `lib/core/eureka-critic.cjs:524` import the module's ids; the `eureka_critic` zod enum (`lib/mcp/tool-router.cjs:~2146`) is pinned to `DIRECTIONS`, `schema_version` stays 1.

#### Verification stamp (Req 4)
- **D-08:** One shared module `lib/core/verification-stamp.cjs`, called at each producer's output or filing layer (never inside the engines; whitespace and HSI compute untouched). It builds the stamp object; nothing builds a stamp by hand.
- **D-09:** The Theo call is `brain-client.cjs` `callTool('find_connections', { from, to })` (`brain-client.cjs:595`, through the Part 8 belt at `:657-669`). Send exactly `{from, to}`: the guard's known-shape recognizer (`part8-egress-guard.cjs:430-437`) admits `{from, to}` plus an optional integer `maxHops` and nothing else; `limit` is accepted by Theo but rejected by our guard. The raw `theo` MCP server is never called (THEO-04).
- **D-10:** Endpoint resolution is LOCAL and exact: the Eureka `a_handle` / `b_handle` values are opaque room.db node ids and never leave the machine; the resolver reads a Framework name the finding already carries and exact-matches it against `data/framework-names.json` (`framework_names` + `curated_extras`). A miss stamps `unverified` with reason `handle_unresolved` and `backend: not_called`. No fuzzy matching, no Theo lookup to guess a name, no snapping. The snapshot may be stale; a canon name missing from it shows as unverified, never guessed (disclosed limitation).
- **D-11:** Measured Theo contract (live 2026-09-23T10:39:15Z per the T-side session; 34 tools deployed, `find_connections` listed, deploy `4ae9843`): success = `{ from, to, maxHops: 3, limit, coverage, paths: [{ path, pathLabels, edges, hops }], diagnostics }`; there is NO `backend` field today (Theo Phase 20 adds the literal `'theo-canon'` on both arms), so the plugin sets `backend: 'theo'` itself from the origin `brain-client` called; an unresolvable endpoint is a SUCCESS with a `refusals` key and no `paths` key. Tier = min `hops` across `paths[]`, cross-checked against `edges.length` and `path.length - 1`; 1-2 = strong, 3 = indirect. Evidence block = `path` + `pathLabels` + `edges`.
- **D-12:** Per-run memo only: a `Map` keyed on `from + '\u0000' + to`, deduped pairs run through a pool of 4 and awaited before rendering; no cache across runs (Theo rule 3; AI-SPEC).
- **D-13:** Degradation matrix, none of which drops a finding or invents a path: (1) transport failure (`brain-client` returns `null`, its pinned outage signal at `:627-630`) -> `unverified` / `unavailable` / `backend_unavailable`; (2) Theo up but `find_connections` not listed -> `unverified` / `unavailable` / `tool_not_listed` (detection belongs to Theo Phase 20's `theo_health`; until then the call's error shape stands in); (3) `egress_blocked` sentinel -> `unverified` / `unavailable` / `egress_refused`, surfaced as an adapter defect; (4) success with `refusals` and no `paths` -> `unverified` / `theo` / `endpoint_unresolved`; (5) `paths: []` -> `unverified` / `theo` / `no_path_within_3_hops`; (6) hop counts disagree -> `malformed_response`; (7) local resolution miss -> `not_called` / `handle_unresolved`.
- **D-14:** `judge` is the zod literal `'none'` at runtime this phase. Theo's rule 1 forbids model judgment inside Theo; the navigator chose to amend rule 1 ("proxied typed judgment under a stated policy is a third class, permitted, Theo as keyholder never as judge"), and the T-side session is drafting that amendment (Theo SEED-015) for the navigator's direct approval in the Theo session. Until it lands, the Jev branch of the adapter is a documented seam comment, not code.
- **D-15:** Lockstep: the Eureka side-channel closed schema (`eureka-reach-runner.cjs:277/:292`, `validateClosedSchema` with exact `sortedKeysEqual`) fails on a new `stamp` key, so `SCHEMA_VERSION` at `lib/core/sensors/sensor-eureka.cjs:71` and the runner bump 1 -> 2 together, or SENS-13 silently stops firing. Test asserts the exact `stamp` object read back by each of the five consumers.
- **D-16:** Part 9 scope: whitespace-to-graph, hsi-to-graph and rs-engine write through `lazygraph-ops` / `node-insert` (both on navigation's allow-list), not `navigation.cjs` directly; stamp fields ride those existing writes. The Part 9 cleanup of those writers is NOT widened into this phase.
- **D-17:** Posture: the module makes one read-only Theo call, writes nothing itself, sends only canon handles -> declare `autonomous_safe: true`, reversibility n/a (read), consequence low; log this against the reversibility x consequence grid (folded todo). Coordinate with Phase 356 (jsagi-a7, chain-executor Jev-seat policy; `chain-executor.cjs:526` defaults `autonomous_safe: false`) so a stamp is never treated as a material step. The module rides the callers' existing reach ids (`deep_research` for SENS-13, `brain_consult` for find-connections) and adds no reach id. Register it in the Part 8 egress sweep and add a CIRS wiring test.
- **D-18:** find-connections is prompt-driven today (`commands/find-connections.md:76`, `brain_concept_connect`) with no CJS producer; the stamp needs a thin CJS entry for that path (a stamp script the SKILL calls), not a new MCP tool (Phase 268 ruling stands).

#### Floors (Req 2)
- **D-19:** Disclose every floor as `unverified` this phase; calibrate none. Calibrating on the fixture rooms would tune floors on the same rooms the hit rate is measured on (circular first calibration point), and most floors have no env seam anyway (`SEMANTIC_FLOOR` resolves at module load in an IIFE, `rs-differential-scorer.cjs:117-124`; DIFF/LSA/BERT, `rs-engine.cjs:68`, `hsi-engine.cjs:102`, `rs-innovation-classifier.cjs:60-61` have no env hook). Env overrides are an operator seam, not provenance.
- **D-20:** Ship `data/floor-ledger.json` (house `data/*-ledger.json` pattern, `--check` offline mode), one row per literal: `{ id, file, line_anchor (const name or regex, never a bare line number), value, gates, kind: floor|band|weight|rubric|policy|definitional, env_override: name|null, env_read: load|call|null, status: disclosed|calibrated, provenance: null | {fixture, encoder, date, method, gold, n}, dependent_outputs: [producer ids] }`. `calibrated` requires non-null provenance with `gold` and `n`, so a 224-style single-pair noise ceiling cannot pass as calibration. `docs/ENV-TUNING.md` stays operator env docs and gains the undocumented env entries (`EUREKA_DIFF_FLOOR`, Stage A gates, analogy) as prose.
- **D-21:** Floor inventory (all `disclosed` this phase; the analogy live reads are at `analogy-fitness.cjs:90-99`, the SPEC's `:42-44` pointed at header comments): `rs-engine.cjs:68` DEFAULT_THRESHOLD 0.3; `rs-differential-scorer.cjs:107` DIFF_FLOOR 0.3, `:108-109` LSA_FLOOR / BERT_FLOOR 0.2, `:117-124` SEMANTIC_FLOOR 0.15 (env, load-time), `:463-469` EUREKA_DIFF_FLOOR (env, call-time); `rs-innovation-classifier.cjs:60-61` LSA_HIGH / BERT_HIGH 0.3; `rs-breakthrough-scorer.cjs:75-129` five hand rubrics; `hsi-engine.cjs:102` 0.30, `:267, :272` weights 0.6/0.4 and 0.7/0.3; `compute-whitespace-gaps.py:250` 10th percentile (Python untouched, ledger row only); `whitespace-command.cjs:515-516` bands 0.8/0.4; `interpret-whitespace.cjs:45` 0.6, `:273` 1.0; `eureka-critic.cjs:62-65` Stage A gates, `:581-587` confidence bands (policy, already renders strings); `tail-quadrant.cjs:56-59` quadrant constants (definitional); `analogy-fitness.cjs:90-99` LAYER_THRESHOLD / TEXT_WEIGHT / RESTATEMENT_FLOOR, `:59-64` bands.
- **D-22:** Sweep test `tests/test-355-floor-sweep.cjs` (leg in `tests/run-all-355.sh`): strip comments first (run-all-224/158 idiom); scan the SPEC-listed files plus a pattern pass (`const [A-Z_]+ = 0?\.\d+`, `envFloat('`, `resolveFloat('`, numeric comparisons in band functions); fail on zero files scanned; every hit resolves to a ledger row by file + anchor, and a stale anchor fails; for each disclosed row run its dependent producers on a fixture and assert the output carries `unverified` (devpkg shape: observation / suggests / unverified / evidence used); render guard greps rendered output for a bare `\b[01]?\.\d{1,2}\b` and for each ledger value, zero hits; negative control plants `const FAKE_FLOOR = 0.42` under lib/core/ and asserts it is caught (test-353-tripwires idiom `:79-98`); zero-dependency and no-network legs unchanged.

#### Naming honesty (Req 3)
- **D-23:** `scout-hsi` keeps its name (it is in `UNIMPLEMENTED_MUTATING_ORCHESTRATION`, `tool-router.cjs:448`, and already gets the NOT EXECUTED banner); its per-command description (`tool-router.cjs ~:1789`) and banner say "reference only, no compute; run `/mos:scout hsi` in Claude Code". Wiring it to `hsiEngine.runTier1` is out: it would cover only step 1 of the 3-step CLI pipeline (`commands/scout.md:77, :269-279`), add a write path and a model download on Desktop/Cowork.
- **D-24:** MCP `whitespace_scan` keeps its name; `lib/mcp/tools/sensors.cjs:298` leads with "Returns open questions and unsupported claims. This is NOT the `/mos:whitespace` HSI engine; run it in Claude Code". If `data/mcp-tool-connectors.json:518` `hitl_why` is touched, regenerate `data/connector-registry.json` with `node scripts/build-connector-registry.cjs` (never hand-edit), then `build-connector-registry --check`, `build-orchestration-projection --check`, `check-shape-declaration --check`.
- **D-25:** The real gate is a new fixture test, not the scanner: `scripts/check-tool-honesty.cjs` only checks persistence (write) claims (`:1099-1110`) and `doctor.cjs:1146-1157` runs it as advisory, so AC9's "honesty point passes" is vacuous alone. The test asserts `scout-hsi` returns the banner and writes no `.hsi-results.json`, and that `whitespace_scan`'s description names open questions and unsupported claims and does not claim to be the HSI or whitespace engine.
- **D-26:** The registry-drift gate (`scripts/check-registry-drift.cjs`) compares only the `command` key in `data/command-registry.json` (`/mos:scout` at `:1854`, `/mos:whitespace` at `:2267`); neither MCP name is in it, so a rename would pass the gate green and break Desktop/Cowork silently. No rename this phase; if ever renamed, keep the old name as a deprecated alias. No shipped command, skill, agent or hook calls `whitespace_scan`.

#### Rendering (Req 4, AC4)
- **D-27:** A fixed one-line stamp plus a short evidence block on every shown finding, on all three surfaces, through one shared `formatStampLines(stamp, surface)`. The path replaces the number ("show your work" resolved: path + tier + direction + judge outcome shown, scalar withheld; a conscious deviation from the briefing's "scores shown", recorded in the AI-SPEC).
- **D-28:** Glyphs from the existing 12 only, no 13th: `✓` = strong, `•` = indirect, bare `⚠` (U+26A0, never followed by U+FE0F; `ui-compliance-module.cjs:42-50`) = unverified; `·` as separator (F.1 row-2 precedent, `ui-system/SKILL.md:149`). Path hops rendered as ASCII `Framework A --EDGE--> Framework B` from `pathLabels` / `edges`; never `→` (it means "inline suggestion") and never tree glyphs (`└` is flagged by `ui-compliance-module.cjs:32-38`). Hop counts spelled as words ("two steps"). The judge appears only on the last evidence line ("none, path check only") and later becomes "supports / contradicts / says nothing" with no layout change.
- **D-29:** Leaks the stamp replaces: `scripts/whitespace-command.cjs:516` `score.toFixed(2)` (a band word replaces the decimal; the novelty math stays), `commands/eureka.md:249, :258` Score column and `0.11`, `commands/find-connections.md:79` "confidence scores", `lib/core/eureka/qualify-opportunity.cjs:364-394` `componentValue` printing raw numbers, `sensor-eureka.cjs:187` `differential` in the reach evidence bag (stays off-render). Larry's Desktop phrasing rule goes into `skills/larry-personality/SKILL.md` (hedged, no numbers, De Stijl glyph opening).
- **D-30:** The no-decimal grep runs over captured stdout of all five producers, the rendered F.1 `zones.body`, and the Larry prose fixtures, with Theo up and Theo down: `grep -nE '(^|[^0-9A-Za-z.])(0?\.[0-9]+|1\.0+)([^0-9.]|$)'`, plus a `[0-9]+%` check on stamp and evidence lines. The F.1 brain-chip `<conf>%` (`ui-system/SKILL.md:149`) is out of scope but flagged.

#### Labeling session and fixture rooms (Req 5, Req 7)
- **D-31:** `scripts/label-355-gold.cjs` (argv switch-case, no deps): subcommands `start` / `resume` / `status` / `emit`; keys `1`-`6` for the five modes plus `none` with a fixed on-screen legend; `y`/`n` x3 per pairing (useful, direction ok, already known); one key each for supports / says nothing / contradicts on citation pairs; `u` undoes, `q` saves and quits; seeded shuffle with the seed stored; session saved after every key (temp file then rename); resume refuses if the fixture hash changed; raw-mode keypress via `readline.emitKeypressEvents` + `setRawMode` with a line-mode fallback (new in this repo; WSL raw-mode quirks are the risk).
- **D-32:** Blinding guards: the script never requires `hsi-spectral.cjs`, any Jev module, or the stamp module (tripwire grep); `boundary_tag` is never printed; `measure-hsi-thinking-mode.cjs` refuses to run until the gold file has `labeled_at`; the unstamped baseline pass runs before any stamped output exists; stamp tier and Jev answers are joined afterwards by `pair_id`, never at labeling time.
- **D-33:** Gold files: item files hold no labels (`355-hsi-thinking-mode-sentences.items.json` `[{id, sentence, boundary_tag}]`, `355-citation-pairs.items.json`, room pairings exported unstamped as `[{pair_id, room, a_excerpt, b_excerpt, direction_phrase}]`); session file `.planning/phases/355-*/labeling-session.json` `{fixture_sha256, order_seed, phrase_module_hash, started_at, entries:{id:{label, at, ms}}}` keyed by id, never position; `--emit` writes `355-hsi-thinking-mode-sentences.json` `[{id, sentence, gold}]` with `_labeling_note`, `labeler: "navigator"`, `fixture_sha256`, `labeled_at`; `355-citation-pairs.json`; `355-rooms/judgments.json` `{pair_id, useful, direction_ok, already_known, at}`. Tests assert the gold's `fixture_sha256` equals the current item-file hash.
- **D-34:** Three new Claude-authored fixture rooms under `tests/fixtures/355-rooms/` (Phase 353 `icm-rooms/` pattern: `.room-root`, `ROOM.md`, `MINTO.md` per folder, required by the pre-commit hook), copied to a temp dir by tests and never run in place; each with 4 sections spanning distinct domains and 3-4 artifacts of 150-300 words (about 12-16 documents, 66-120 candidate pairs, so RS, HSI and whitespace all fire; `rs-math.cjs:329` returns nothing below 2 documents). Room 1 is an ill-defined problem; room 2 sits at the extend-the-opportunity step; room 3 is a control with planted meaning bridges and planted false friends (shared words with different meanings, e.g. "virus", "channel") so D17 has real cases. No real names. The measurement script refuses any `--room` outside `tests/fixtures/355-rooms/` (`test-353-tripwires.cjs:120-136` idiom). None of the existing fixture rooms qualify (236 single-section, 219 boilerplate text, 347/354 schema-only, claim-harness memory-only, sample-room 4 files).
- **D-35:** Fixed order: sentence labeling (D14) shows no direction and can run in wave 1; the direction module and its two phrases land first, the PWS author confirms the phrases (AI-SPEC D17), then rooms and citation pairs are authored, then the navigator judges. The phrase-module hash is recorded in the session file; a resume with a mismatched hash is refused; if the phrases change after judging, direction-ok labels are re-run.

#### Filing and the Larry touchpoint (Req 6)
- **D-36:** The "existing harvest path" is `navigation.writeOpportunityNode` (`lib/core/navigation/typed-opportunity.cjs:211`, re-exported at `navigation.cjs:457`), the writer the eureka banking at `scripts/eureka-portfolio-report.cjs:1613` actually uses; `opportunity-harvest.cjs` is read-only by contract (`:26-29`) and `addWhitespaceZone` mints `WhitespaceZone`, not opportunities. Never `graph-ops.indexOpportunity` (bypasses the chokepoint). Call shape: `{ name, sessionId, lifecycle:'candidate', section, actor:'system', reason:'eureka stamped finding', evidence_ids:[aId, bId], formula_version:'stamp-v1', extraProps:{...} }`; do not pass `review_status` (born `proposed`, `:273-282`); stay off the STATE_KEYS (`:120-122`).
- **D-37:** Stamp fields ride `extraProps` (merges into the properties JSON, no DDL: `:227-231`, `node-insert.cjs:123-134`) as flat enums and arrays: `verification`, `backend`, `direction`, `judge:'none'`, `path` (hop names), `path_len`, `pws_stage` (ill_defined | extend_opportunity), `engine_mode`.
- **D-38:** Edges: `linkOpportunityEvidence` rejects SOURCED_FROM (subset `{DERIVED_FROM, SUPPORTS, INFORMS}`, `typed-opportunity.cjs:96-98`); write `navigation.writeEdge` directly with `{relation:'sourced_from', origin:'eureka-355'}` (the REJECTED_BECAUSE precedent, `:33-35`) to the two source artifact nodes (writeEdge checks the edge type, not the endpoints). Do NOT use `writeReasoningNode`. Mint the node before the edges.
- **D-39:** `gate_answer` promotion: widen `_promoteCardSubject` (`lib/mcp/tools/gate.cjs:94`, today `row.type === 'claim'` only) to include `'opportunity'`; it is already in TRUTH_CLAIM_TYPES (`transitions.cjs:42`) so the Phase 348 human-attribution guard (`transitions.cjs:233-246`, `agent_attribution_forbidden`) still applies. One regression test asserts the exact node id goes `proposed` -> `confirmed`. Coordinate the edit with Phase 354-02 (jsagi-25, in flight, same file, the subject-claim fix).
- **D-40:** Section: `props.section` is a real domain slug derived from the evidence nodes (216 field contract, `typed-opportunity.cjs:60-65`; `deriveBankSection` at `eureka-portfolio-report.cjs:1548`); the `opportunity-bank/` file is written only by `qualifyCandidate` (`qualify-opportunity.cjs:9, 186`) after the human confirms. The PWS author's ill-defined ruling sets the trigger stage, not the filing location; it is recorded as `pws_stage` on the node.
- **D-41:** SENS-13 copy: keep `reach_id: deep_research` and signal `eureka_bridge` unchanged (no seven-place lockstep, `test-213-reach-wired.cjs:139` stays green); add a signal-aware stamped-finding card variant in `lib/hmi/dial-label-composer.cjs:102-110` ("verified through <path>" / "unverified - novel or hallucinated, verify with an expert"); extend the evidence bag (`sensor-eureka.cjs:181-189`) with the enum stamp fields and `opportunity_handle`, no decimals, no banned words; mirror the same stamp line in `skills/larry-personality/SKILL.md` reach narration.
- **D-42:** Fire-once: SENS-13 re-fires on every dispatch while `last-eureka.json` is fresh (30 min, `sensor-eureka.cjs:87, :161-170`); add a dedup ledger keyed on `opportunity_handle` (the `sensor-url-ingest.cjs:157` precedent). SENS-14 (harvest lane, `scanEurekaProposals`, `opportunity-harvest.cjs:546-553`) is NOT suppressed: the fire-once test constrains SENS-13 only (exactly once across two dispatches).
- **D-43:** `test-355-filing.cjs`: run eureka once, close and reopen room.db, assert exactly 1 row `type='opportunity'` AND `review_status='proposed'`; stamp fields re-parse with the zod `Stamp` schema; >= 2 SOURCED_FROM edges from the node; SENS-13 fires once across two dispatches; an agent-attributed `promoteNodeStatus` returns `agent_attribution_forbidden`; after `gate_answer` approve a re-read returns `confirmed`; the Part 9 sweep finds no raw `INSERT INTO` in touched modules; only pre-existing node types appear.

#### Jev seats (Req 5, AI-SPEC D14, D15, D18)
- **D-44:** All Jev use is dev-time from `scripts/` via the in-repo client (`scripts/build-section-command-ledger.cjs`: `jev`, `pool`, `loadKey`, `assertEgressCeiling`), with a per-question egress ceiling passed into the client (ledger ceiling as default; never widen the shared allow-list), the resolved model version recorded per run, and the 354-17 build modes (`--offline-seed` / live / `--jev-fixture`; `--check` offline-only). Nothing under `lib/` or `hooks/` references `api.typesafe.ai`, a Jev client, or `TYPESAFE_API_KEY`.
- **D-45:** HSI adoption bar (fixed before results): Jev beats the regexes by >= 10 accuracy points on the full set with `none` counted AND no single mode drops by more than 5, holding on 3 repeat runs; "adopt" means distilling Jev's labels into a rule table under `data/` from a separate set (never the gold sentences) that must itself clear the bar. Report full-set, 5-mode subset, per-mode confusion, and accuracy at confidence >= 0.9 vs below; report the regex `descriptive` fallback bias explicitly.
- **D-46:** Citation-check calibration now: >= 40 templated Part-8-clean `{claim, path}` pairs (claim = framework names + direction label) scored with the rule stated vs withheld; auto-verdict only at confidence >= 0.8. D18: one Jev Choice (useful / not_useful / already_known / none) per judged pairing, measured against the navigator's blind judgments; D16's rate is computed from human judgments alone.

### Claude's Discretion
- Exact file names for the stamp formatter, the labeling script's terminal fallback, the ledger row ids, and the fixture rooms' domains and artifact texts (within D-34's constraints).
- Whether the direction-agreement fixture lives under `tests/fixtures/355/` or beside `tests/fixtures/272/`.
- The wave ordering, provided D-35's fixed order and the 354-02 coordination in D-39 are honored.

### Folded Todos
- **Registry-drift gate (2026-07-03, `.planning/todos/pending/2026-07-03-registry-drift-gate-...md`):** folded as D-26: the gate covers slash commands only, not MCP tool names, so naming honesty ships description fixes plus a fixture test and no rename; any future rename must ship a deprecated alias because nothing structural catches the break.
- **Audit autonomous_safe posture vs the reversibility x consequence grid (2026-09-08):** folded as D-17: the stamp module is declared `autonomous_safe: true`, read-only, consequence low, and logged against the grid; coordinated with Phase 356 (chain-executor Jev-seat policy) so a stamp is never a material step.
- **Mirror the gate_render description fix into Theo (2026-09-07):** reviewed and CLOSED as stale, not folded: the T-side session verified `gate-render.ts:103-108` is already byte-identical to `gate.cjs:181` (Theo quick 260907-fnr, commit 1d7e1cd, pinned by `ops-schema-parity.test.ts:855`). Side observation from T-side, recorded for a separate M-side item: `gate_answer`'s description still drifts (1152 vs 1462 bytes).

### Deferred Ideas (OUT OF SCOPE)
- Per-user Jev through Theo (T-2): blocked on the navigator approving the rule-1 amendment text directly in the Theo session (Theo SEED-015); then Theo Phase 20's seam. Phase 355 ships `judge: none` regardless.
- Canon coverage for cross-domain structure (T-3): Theo SEED-009 / Phase 20.1; Phase 355 sends back the measured unverified rate and hub-inflation share as the input.
- OQ-4 whitespace operationalization (T-4): Theo seed with a langtalks consult; the plugin-side Burt structural-hole producer is its own later phase.
- Discovery-pattern taxonomy (8-pattern Jev Choice), Bit-Flip-Spark verification Nouls, supervisor reconciliation, update-velocity tracking, Terminology Translation, Weak Signal Scoring, Temporal Convergence: later phases, each one Jev question on top of this phase's stamp (brief section 3).
- The stage-driven trigger ("strategy rather than keywords" front end: problem-type and opportunity-review entry points): after the stamp exists.
- Part 9 cleanup of `lazygraph-ops` / `node-insert` writers in whitespace-to-graph, hsi-to-graph and rs-engine: needs its own scope ruling (D-16).
- `whitespace_scan` still opens through the migrate-on-open door (`.planning/debug/resolved/hedge-fold-has-no-production-trigger.md:152`): not folded.
- A compute-claim rule for `scripts/check-tool-honesty.cjs` (today it checks write claims only): scope growth, not this phase.
- The F.1 brain-chip `<conf>%` render (`ui-system/SKILL.md:149`): flagged, out of scope for the no-decimal rule.
- `gate_answer` MCP description drift between Theo and the plugin (1152 vs 1462 bytes, T-side observation): a separate M-side quick task.
- Pre-existing ROADMAP.md interleave of Phase 267's tail under Phase 354: a quick task.
- Reviewed, not folded: Mirror the gate_render description fix into Theo (2026-09-07): closed as stale (already byte-identical on the Theo side, quick 260907-fnr / 1d7e1cd).
</user_constraints>

<phase_requirements>
## Phase Requirements

No IDs existed before this research. Recommended family: **HIPS-** ("Hidden In Plain Sight"; verified unused: `grep -c "HIPS-" .planning/REQUIREMENTS.md .planning/ROADMAP.md` = 0 and 0). HIPS-01..07 map one-to-one onto SPEC Requirements 1-7; HIPS-08..09 are the AI-SPEC's two dev-time measurements that are not SPEC requirements of their own (D15, D18); HIPS-10 is the phase gate.

| ID | Description | Research Support |
|----|-------------|------------------|
| HIPS-01 | One direction convention: `lib/core/direction-convention.cjs` owns `classify`, `DIRECTIONS`, `DIRECTION_MEANING`; every live producer emits the same label for the same `(lsa, semantic)`; no second rule anywhere (SPEC Req 1; AC1, AC2) | Corrections C1 (a FIFTH rule site, `rs-differential-scorer.cjs:574`, on the live eureka path) and C2 (portfolio ranking depends on the label); pinned-test table; direction-agreement test design |
| HIPS-02 | Floors disclosed: `data/floor-ledger.json` + `tests/test-355-floor-sweep.cjs` with a negative control; every disclosed floor's dependent output carries `unverified` (SPEC Req 2; AC3) | Floor inventory re-verified plus two literals D-21 missed (`hsi-to-graph.cjs:100` `0.3`, whitespace label text `>0.8` / `<0.4` at `whitespace-command.cjs:523`) |
| HIPS-03 | Naming honesty: `scout-hsi` and `whitespace_scan` descriptions match behavior; fixture test is the gate (SPEC Req 3; AC9) | `tool-router.cjs:1833` is the actual scout description sentence (no per-command map exists); banner at `:950-952`; `sensors.cjs:297-298` |
| HIPS-04 | Verification stamp: `lib/core/verification-stamp.cjs`, `callTool('find_connections', {from, to})` only, tier in code, seven-plus degradation cases, `judge: 'none'`, per-run memo, pool 4 (SPEC Req 4; AC5, AC6, AC7, AC8) | Live Theo probe (Section "Live Theo Contract"); C5 (sentinels AI-SPEC's draft misclassifies); C6 (provenance-hub paths); C7 (resolution coverage) |
| HIPS-05 | Stamp rendered on all five producers and three surfaces through one formatter; no bare 0.00-1.00 decimal in any covered render (SPEC Req 4; AC4; AI-SPEC D8, D13) | Render-leak inventory (more sites than D-29); C9 (Desktop has no find_connections tool, so Desktop narrates stored stamps only) |
| HIPS-06 | Filing: a stamped finding files through `writeOpportunityNode` as `proposed` with stamp props and SOURCED_FROM edges; SENS-13 fires exactly once; only `gate_answer` confirms (SPEC Req 6; AC10) | C3 (probeGuard schema coupling), C4 (SENS-13 has no working production producer), C10 (banking already mints opportunity nodes); gate.cjs:95 widen |
| HIPS-07 | Hit rate recorded: 3 fixture rooms, >= 20 judged pairings each, unstamped baseline first, labeling CLI, `355-VERIFICATION.md` (SPEC Req 7; AC12; AI-SPEC D16, D17) | Fixture-room hook requirements; keypress CLI verified behavior; path-guard vs temp-copy pitfall |
| HIPS-08 | HSI thinking-mode Jev Choice measured against the regex on >= 100 blind-labeled sentences, fixed adoption bar, 3 repeats, decision recorded (SPEC Req 5; AC11; AI-SPEC D14) | C8 (use Phase 356's `scripts/jev-devtime-client.cjs`, not an edit to the 353 builder); `anolog` regex typo |
| HIPS-09 | Citation-check calibration (rule stated vs withheld, >= 40 pairs) and the D18 usefulness-judge agreement measured dev-time; no verdict reaches a runtime stamp (AI-SPEC D15, D18) | Same client; per-question guard composition |
| HIPS-10 | Phase gate: `tests/run-all-355.sh` green, `cross-connection-honesty` doctor blocker, offline tests registered in `lib/memory/run-feynman-tests.cjs` TEST_FILES, `doctor --acceptance` no new regression vs a baseline captured at the phase base commit (SPEC AC13) | run-all-224 idiom; doctor point precedent `scripts/doctor.cjs:1963-2039`; registry tail at `run-feynman-tests.cjs:2061` |

**How Phase 354 (and 353, 357) registered their rows, so the planner copies the mechanism exactly** [VERIFIED: `.planning/REQUIREMENTS.md:2618-2632, 2923-2937, 2998-3006, 3047-3144`; commit `f5a22467f` for 357]:

1. **At plan time, inside the plan-set commit** (357's `docs(357): create phase plan - ... GATE357-01..09 registered` touched `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` in the same commit as the PLAN files), add a new section `### Phase 355 - Hidden in Plain Sight (HIPS family)` immediately after the last phase section (currently `### Phase 357 - Gate-triad replay harness (GATE357 family)`, before `## Traceability`).
2. The section opens with a provenance paragraph in the house wording: "HIPS-01..10 were minted in the Phase 355 plan set (2026-09-2x), ratifying `355-RESEARCH.md`'s proposed IDs for SPEC Requirements 1-7 plus the AI-SPEC's D15/D18 dev-time measurements and the phase gate, scoped to Phase 355 only, and are registered here at plan time as `- [ ]` rows to be closed with measured proof, or left open with a stated reason, at phase close by `355-NN-PLAN.md` Task N, per the Phase 254/257/.../353/354/357 precedent. `355-CONTEXT.md` is the scope contract."
3. One `- [ ] **HIPS-0N**: <one-sentence behavior>` row per ID, wrapped at about 100 columns with a 6-space continuation indent (the SYS/THEO row format).
4. In `## Traceability`: bump the "N active requirements" count and add "plus HIPS-01..10 (Phase 355)" to the family list; append a one-sentence mint note in the same style as the SYS/THEO note; add `HIPS` to the "Caveat, carried on the ... families alike" list.
5. In `.planning/ROADMAP.md` the Phase 355 card's `**Requirements**: TBD (minted at spec time)` line becomes `**Requirements**: HIPS-01..HIPS-10 (phase-local, minted in the 355 plan set; registered in REQUIREMENTS.md)`.
6. **Close-out plan** (the last plan of the phase) flips each row to `- [x]` and appends an indented `**Measured:** (date) ...` line with the command and number that proves it (the RULE-28 / 353-03 Task 7 idiom, `REQUIREMENTS.md:2899-2910`), or leaves `- [ ]` with a stated reason.
7. Collision rule: `.planning/REQUIREMENTS.md` and `ROADMAP.md` are force-tracked and a peer session (354-16) will edit REQUIREMENTS.md at its own close. Make the 355 registration edit only when `git status --short .planning/REQUIREMENTS.md .planning/ROADMAP.md` is empty, and commit it immediately.
</phase_requirements>

## Summary

Phase 355 is mostly an honesty pass over code that already exists, plus one new read-only verification call. The planner's biggest risk is not the new code; it is that several locked decisions were made against a slightly incomplete map of the live tree. This research re-read every seam at HEAD and found ten material corrections (table below). The most important: there is a **fifth** direction-rule site that CONTEXT does not list, `rs-differential-scorer.cjs:574` (`scoreMeasured`), which is the **live eureka path** and uses the inverted convention; flipping it silently changes eureka's portfolio ranking because `portfolio-dimensions.cjs:176-189` assigns feasibility by label. Second: bumping the side-channel `SIDE_CHANNEL_SCHEMA_VERSION` to 2 (D-15) breaks eureka's guard probe, because `eureka-reach-runner.cjs:127` compares the critic tags file's `schema_version` against that same constant. Third: SENS-13 has **no working production producer today** (`auto-explore-fire.cjs:336-340` calls `runEurekaScan` with no pair and exits before it resolves), so "fires exactly once" needs a real producer at the filing layer, not just a schema bump.

The Theo contract is confirmed live this session (three generic probes through `brain-client.cjs`): the success and refusal shapes match D-11 exactly, but the very first probe returned a "strong" 2-hop path that routes through a provenance record (`Framework --SOURCED_FROM-- BrainRecord --SOURCED_FROM-- Framework`), not through methodology. The tier rule is locked, so this is disclosed and measured (hub share), but the planner should add a named sub-metric for provenance-routed paths and decide how a non-Framework interior node is rendered. Local endpoint resolution (D-10) will leave most HSI, RS and whitespace findings `handle_unresolved`, because those producers' findings are artifact pairs that carry no Framework name at all; only find-connections (and eureka pairs whose entity names happen to equal canon names) carry one natively. The snapshot `data/framework-names.json` holds 112 names (dated 2026-05-12); 109 are live Theo Frameworks, 3 are stale, and Theo holds about 420, so coverage is roughly a quarter of canon.

For the Jev half, Phase 356 already shipped the shared dev-time client `scripts/jev-devtime-client.cjs` (per-profile egress guards, `jev(body, {guard, key, fetchImpl})`), and pending 354-17 edits it too. Phase 355 should add its own profiles/guards there instead of editing `build-section-command-ledger.cjs`'s `jev()` as the AI-SPEC drafted. Execution should start after Phase 354 closes: pending 354 plans (11, 12, 13, 14, 16, 17, 18) touch `gate.cjs`, `tool-router.cjs`, `brain-client.cjs`, `part8-egress-guard.cjs`, `doctor.cjs` and `jev-devtime-client.cjs`, all of which 355 also edits.

**Primary recommendation:** Gate wave 1 on Phase 354's close; land the direction module with all five producer sites (not four) plus a portfolio-feasibility decision; decouple the critic-tags probe from the side-channel version before bumping it; build the SENS-13 producer at the eureka filing layer; route all Jev work through `scripts/jev-devtime-client.cjs` with new per-question guards.

## Critical Corrections to CONTEXT / AI-SPEC (verified this session)

Each row is a fact read at HEAD `98b6f7bb9` this session. None contradicts a locked decision's intent; each changes what the planner must actually do to honor it.

| # | CONTEXT / AI-SPEC says | Verified reality | What the planner must do |
|---|------------------------|------------------|--------------------------|
| C1 | Four direction sites: rs-math, hsi-lsa, hsi-engine, rs-innovation-classifier (+ Python) (D-03) | A **fifth**: `lib/core/rs-differential-scorer.cjs:574` `scoreMeasured`: `signed_diff = semantic - lexical; direction = signed_diff > 0 ? 'semantic_implementation' : 'structural_transfer'` (its own header `:441-443` documents the inverted meaning). It feeds `eureka-reach-runner.cjs:356-383`, `eureka-portfolio-report.cjs:101`, `lateral-engine-adapter.cjs:94-98`, `intel-pipeline.cjs:163`. The discussion log noticed the classifier as "a fourth inverted producer" but not this one. [VERIFIED: grep + read] | Add scoreMeasured to D-03's flip list (it becomes `classify(lexical, semantic)`), amend `tests/test-211-measured-differential.cjs` Tests 5-6 (`:100-125`) with a Phase 355 citation, and include it in the agreement test (drivable offline via `opts.lexicalFn` + `opts.encodeFn`, see Code Examples) |
| C2 | Labels only change meaning, not behavior | `lib/core/eureka/portfolio-dimensions.cjs:176-189` `feasibilityFromRs` maps `structural_transfer` -> 1.0 (in band) or 0.7, `semantic_implementation` -> 0.4 "paraphrase risk". Today that rewards shared-words-divergent-meaning pairs. Flipping C1 without touching this swaps which pairs rank high in `/mos:eureka` [VERIFIED: read] | Navigator decision (Open Question 1). Recommended: preserve today's ranking byte-for-byte by keying feasibility on meaning (swap the two branches, cite 355) and amend `tests/test-215-score.cjs`; a ranking change is out of this honesty pass's scope |
| C3 | Bump side-channel `SCHEMA_VERSION` 1 -> 2 in sensor + runner (D-15) | `eureka-reach-runner.cjs:127`: `if (!tags || tags.schema_version !== SIDE_CHANNEL_SCHEMA_VERSION) return {available:false, reason:'guard_unavailable'}`. The critic tags file is `data/eureka-critic-tags.json` `schema_version: 1` and `eureka-critic.cjs:78` throws on anything but 1. Bumping the runner constant to 2 makes every eureka scan `guard_unavailable` [VERIFIED: read] | Introduce a separate `CRITIC_TAGS_SCHEMA_VERSION = 1` in the runner for the probe (a 355-cited edit), then bump the side-channel constant. Lockstep list (all verified): `eureka-reach-runner.cjs:72, :127, :247, :278`; `sensor-eureka.cjs:72, :159`; fixture `tests/fixtures/213/last-eureka.json`; `tests/test-213-sensor-eureka.cjs:139` (uses `p.schema_version = 2` as its mismatch case, must move to 3); `tests/test-213-part8-boundary.cjs:132` (builds a v1 payload through `validateClosedSchema`); `eureka-offer.cjs:86-98` (does not check the version, stays green) |
| C4 | "SENS-13 surfaces it once" via the existing producer | The only writer of `last-eureka.json` is `runEurekaScan`, called in production only at `scripts/auto-explore-fire.cjs:336-337` with `{roomDir}` (no `pair`, no `deriveFn` -> `substrate_unavailable`) followed synchronously by `process.exit(0)` at `:340`, so it never completes. SENS-13 is dark in production today [VERIFIED: read] | The filing layer must write the v2 side channel itself (reuse the exported `buildSideChannelPayload` / `validateClosedSchema`, `eureka-reach-runner.cjs:419-430`) after `writeOpportunityNode` succeeds, carrying `opportunity_handle` + stamp enums. Name this in the plan as a new producer seam, not a schema bump |
| C5 | AI-SPEC `stampFinding`: anything without `paths` -> `endpoint_unresolved` | `callTool` also returns `{error:'tier_denied'}` (`brain-client.cjs:744-760`), `{error:'rate_limited'}` (`:788-800`), `{error:'invalid_key'}` (session), `{text: ...}` for a non-JSON tool body (`:824-826`), and `null` for a JSON-RPC error with no `result` (`:833`). The draft would stamp a rate limit as "Theo says the endpoint is unknown" with `backend: theo` [VERIFIED: read] | Check `res.error` first: any `error` other than `egress_blocked` -> `unavailable / backend_unavailable`; `{text}` or any non-object -> `theo / malformed_response`; only a parsed object with `refusals` and no `paths` -> `endpoint_unresolved`. Add these to the degradation test |
| C6 | "strong" = 1-2 hops (locked) | Live probe 1: `Reverse Salient Analysis` -> `Theory of Constraints` returned one 2-hop path `[Framework, BrainRecord, Framework]` via `SOURCED_FROM, SOURCED_FROM` (interior `brainrecord-export-13`). Probe 2 returned 5 equal 2-hop paths, the first through `DomainConcept` "Ill-Defined Problem" via `ADDRESSES_PROBLEM_TYPE`. Theo's Cypher is undirected over all relationship types (`~/Theo/src/mcp/content/find-connections.ts:245-253`) [VERIFIED: live probe + Theo read] | Keep the tier rule. Add a deterministic path choice among equal-length paths (prefer an all-`Framework` interior, then lexical order) and record `pathLabels`; add a "provenance-routed strong" count (interior label `BrainRecord` or edge `SOURCED_FROM`) beside the hub share; decide the render of non-Framework interior nodes (Open Question 3). Report to T-side under T-3 |
| C7 | Resolver reads "a Framework name the finding already carries" | HSI, RS and whitespace findings are artifact pairs: `discoverArtifacts` keeps only `{id, section, title, path, text}` (`rs-engine.cjs:131-184`); no framework field exists. Eureka pairs are entity nodes (`pair.techA.title`). Whitespace findings are zones or per-artifact rows. Only find-connections returns Framework names natively [VERIFIED: read] | Define the "carried name" per producer explicitly (Open Question 2). Without an extension, per-tier hit rates will be nearly empty outside find-connections |
| C8 | Dev-time Jev via the 353 builder's `jev()`, edited to accept a ceiling (D-44, AI-SPEC Section 4) | Phase 356 shipped `scripts/jev-devtime-client.cjs` (commit `7336e5215`): `loadKey`, `makeEgressGuard(profile)`, `jev(body, {guard, key, endpoint, fetchImpl, sleepImpl})` that refuses without a guard, `pool`, frozen `EGRESS_PROFILES`; its header says "354-17 and 357 add their own profiles". Pending 354-17 lists it in `files_modified`. It has no request timeout and does not honor `retry-after` [VERIFIED: read] | Build on `jev-devtime-client.cjs`: add a `hsi_thinking_mode` and a `citation_check` profile (kind `exact_state_v1` gives model pin, exact state keys, question id/type/keys) and compose each with a closure check (fixture-membership, Theo-path equality) passed as `guard`. Do not edit the 353 builder's `jev()`. Timeout/retry-after additions, if wanted, are an additive edit to the shared client after 354-17 lands |
| C9 | Stamp renders in Larry's Desktop / Cowork prose | The Desktop Brain shim registers only `brain_ask`, `brain_query`, `brain_schema`, `brain_search`, `brain_stats`, `brain_write` (`bin/mindrian-brain-mcp-client.cjs:163-306`). No governed `find_connections` exists on Desktop, and no new MCP tool is allowed | On Desktop / Cowork, Larry narrates a stamp that was computed and stored by a CLI run (opportunity node props, report JSON, reach evidence bag); he never computes one. find-connections on Desktop cannot be stamped this phase; its findings must say so (Open Question 4) |
| C10 | "One eureka run files one proposed opportunity node" (D-43) | `bankStatements` (`eureka-portfolio-report.cjs:1589-1654`) already mints an `opportunity` node for every statement passing the bank predicate (default `critic`, env `MINDRIAN_OPPORTUNITY_BANK_PREDICATE`), with `score` in props and DERIVED_FROM edges, inside one `BEGIN/COMMIT` | Add the stamp to the existing banking call (extraProps merge, same `name`/`sessionId` -> UPSERT) and add SOURCED_FROM beside DERIVED_FROM, rather than a second writer; compute all stamps (await Theo) BEFORE `db.exec('BEGIN')`; the D-43 fixture must control how many statements bank (assert "equals accepted findings", or fix the fixture so exactly one banks) |

Smaller verified drifts: part8 guard recognizer is now `part8-egress-guard.cjs:455-465` (not 430-437); `BRAIN_URL` is `brain-client.cjs:40` (not 24); hsi-lsa rule is `:131`; `_promoteCardSubject` is `gate.cjs:69` with the claim check at `:95`; **354-02 has landed** (`b46aff3ab`), so D-39's coordination is now with pending 354-12 and 354-16, which also list `gate.cjs`; `limit` does not "fail" our guard, it classifies `ambiguous` and proceeds with an `egress_disclosure` (only a content hit blocks); the eureka_critic zod enum is at `tool-router.cjs:2211`; the scout description is one sentence inside the `orchestration` tool at `tool-router.cjs:1833` (there is no per-command description map); `tests/fixtures/272/baseline-python.fixture.json` and `candidate-cjs.fixture.json` are rs_math (Convention A) outputs and need **no** amendment (D-06 lists them).

## Project Constraints (from CLAUDE.md)

- All MindrianOS-Plugin dev work runs through GSD workflows; no direct repo edits outside a GSD command.
- Canon Part 8: user data never egresses to the Brain; only generic framework handles and enums cross the wire.
- Canon Part 9: `lib/core/navigation.cjs` is the single SQL navigation chokepoint; only a human confirms a truth-claim node.
- Canon Part 11 (CIRS): every invocable surface born WIRED or EXCLUDED with a declared HITL shape; gates `build-connector-registry --check`, `build-orchestration-projection --check`, `check-render-coverage`, `check-shape-declaration --check` (advisory WARN).
- Canon Part 12: no grades or scores in front of the user; every Larry turn wears a De Stijl mark.
- Canon Part 7: reuse before build; search commands/agents/pipelines/skills first.
- Tri-Polar: evaluate every feature on CLI, Desktop and Cowork; a skip is a stated call.
- CJS only, no TypeScript, Node >= 22.16.0; CLI entry points use an argv switch-case router (no Commander/yargs); no new dependencies.
- No em-dashes anywhere; Feynman-simplified, JTBD-oriented prose.
- Every directory in a Data Room gets `ROOM.md` (and `MINTO.md` per the pre-commit guard).
- Verification: run `bash tests/run-all-<phase>.sh`, the born-wired gates, and `node scripts/doctor.cjs --acceptance` before declaring done; never bump versions by hand.
- Dev-Research Compositing: file findings both in the phase dir and in `~/MindrianRooms/rethinking-mindrianos/research/` (cross-linked).
- Grounding sources: Context7 for runtime APIs, Theo repo read-only at `/home/jsagi/Theo`, langtalks for agent/RAG concepts, icm-architect for room structure.
- Real names never in tracked files; pseudonyms / roles only (fixture rooms and gold labels).
- Workspace guard: work only in `/home/jsagi/dev/MindrianOS-Plugin/`; read repo version via `node lib/core/repo-version.cjs`.
- Collision rule (this session's instruction and memory): a peer is executing Phase 354 in the same tree; never touch its uncommitted files (`scripts/eval-icm-writers.cjs`, `tests/test-353-*`, `354-*` plans); `.planning/` phase files need `git add -f`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Direction label (`classify`) | Local core lib (`lib/core/direction-convention.cjs`) | - | Pure function over two local floats; no egress; every producer imports it |
| Similarity compute (LSA, embeddings, whitespace Python) | Local engines (`lib/core/*`, `scripts/*.py`) | - | Untouched by this phase except the label call |
| Endpoint resolution (finding -> canon name) | Local core lib (inside `verification-stamp.cjs`) | Local data (`data/framework-names.json`, `data/command-registry.json`) | Part 8: opaque ids never leave; exact match only |
| Path check (`find_connections`) | Remote Brain (Theo, via `brain-client.cjs`) | Local Part 8 guard | Theo computes `allShortestPaths`; plugin computes the tier |
| Tier + stamp object | Local core lib (`verification-stamp.cjs`) | - | "Tier in code" (Req 4); zod `Stamp` makes a lying stamp unrepresentable |
| Stamp rendering | Local render layer (formatter in `lib/core` or `lib/hmi`) | Larry prose (Desktop/Cowork) reads stored stamps | One formatter; Larry composes, never computes |
| Filing (opportunity node + edges) | Local SQL (`navigation.writeOpportunityNode`, `navigation.writeEdge`) | - | Part 9 chokepoint; born `proposed` |
| Surfacing (SENS-13 reach) | Local hook-path sensor (`sensor-eureka.cjs`) | Local side channel file | No network in the hook path; dedup ledger local |
| Promotion to confirmed | MCP handler (`lib/mcp/tools/gate.cjs` `gate_answer`) | `navigation.confirmNode` / `transitions.cjs` human guard | Only a human gate confirms |
| Thinking-mode / citation / usefulness judgments | Dev-time scripts (`scripts/`) calling Jev | Recorded fixtures replayed offline | 2026-09-17 ruling: Jev never on a user machine or hook |
| Gold labeling | Dev-time CLI (`scripts/label-355-gold.cjs`) | Files under `.planning/phases/355-*` and `tests/fixtures/355-*` | Human is the judge; CLI only records |
| Honesty gate | Doctor acceptance (`scripts/doctor.cjs`) + `tests/run-all-355.sh` | - | Offline, zero network |

## Standard Stack

### Core (all already present; nothing is installed)
| Library / module | Version | Purpose | Why standard |
|---------|---------|---------|--------------|
| Node.js built-ins (`node:fs`, `node:path`, `node:crypto`, `node:readline`, `node:util`, `node:child_process`) | Node v22.23.1 on this machine; floor >= 22.16.0 [VERIFIED: `node --version`] | Everything | CLAUDE.md: CJS only, no new deps |
| `zod` | ^3.25.76 (`package.json:54`) [VERIFIED] | `Stamp` schema (runtime), Jev response schema (dev-time) | Already used in `lib/core/behavioral/observation-schema.cjs` and `lib/mcp/tools/*.cjs` |
| `lib/core/brain-client.cjs` `callTool` | in-repo (`:595`, exported) | The only Theo path (THEO-04) | Part 8 belt at `:657-669`; 20 s request timeout (`:47`), transport retry |
| `lib/core/part8-egress-guard.cjs` | in-repo | Classifies `{from, to}` as `known_tool_shape` | All 112 snapshot names classify `allow:known_tool_shape` (measured, see Security) |
| `scripts/jev-devtime-client.cjs` | in-repo (Phase 356, `7336e5215`) | Dev-time Jev client with per-profile guard | Shared by 356, 354-17 (pending), 357; replaces the AI-SPEC's plan to edit the 353 builder |
| `lib/core/navigation.cjs` (`writeOpportunityNode`, `writeEdge`, `confirmNode`, `promoteNodeStatus`) | in-repo | Filing and promotion | Part 9 chokepoint |
| `@huggingface/transformers` via `lib/core/eureka/embedding-spine.cjs` | resolvable; model `MongoDB/mdbr-leaf-ir` cached at `~/.mindrian/model-cache/` [VERIFIED] | Real encoder for dev-time fixture-room runs | Existing dependency; tests avoid it |

### Supporting
| Module | Purpose | When to use |
|---------|---------|-------------|
| `lib/core/eureka/eureka-reach-runner.cjs` exports `buildSideChannelPayload`, `validateClosedSchema` | Write the v2 side channel from the filing layer | C4 |
| `lib/hmi/dial-label-composer.cjs` `TEMPLATE_FAMILIES.deep_research` (`:102-110`) | Stamped-finding reach card variant | D-41; guarded by `tests/test-dial-label-bank-drift.cjs` (amend with a 355 citation) |
| `tests/helpers/fixture-room-219.cjs` | Precedent for building a room.db through navigation writers in a tmpdir | Test harness for filing / SENS-13 |
| `tests/test-353-tripwires.cjs` / `tests/test-356-tripwires.cjs` helpers (`isPureLineComment`, `nonCommentContains`, `listFilesRecursive`) | Comment-stripped sweeps with a negative control | Copy (do not require) into 355 tests, as 356 did |

### Alternatives Considered
| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| New profiles in `jev-devtime-client.cjs` | Edit `build-section-command-ledger.cjs` `jev()` (AI-SPEC draft) | The 353 builder is no longer the shared client; editing it forks the client 356 extracted to prevent exactly that |
| zod in the hook-path sensor | Plain enum checks in `sensor-eureka.cjs` | Hook path must not risk a load-time throw if deps are not installed yet (Phase 341 per-machine install); keep zod in `verification-stamp.cjs` and the CLI/test path |

**Installation:** none. A `git diff --quiet package.json package-lock.json` leg enforces zero new dependencies.

## Package Legitimacy Audit

This phase installs no external packages (every module above is already in the tree or is a Node built-in). slopcheck was not run because there is nothing to check.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | - | - | - | - | - | No install in this phase |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                       (dev time only)                              (runtime, user machine)
 fixture items ---> label-355-gold.cjs ---> gold files        /mos:eureka | find-bottlenecks | scout hsi | whitespace | find-connections
      |                                          |                 |
      v                                          v                 v
 measure-hsi / calibrate-citation / d18 --> jev-devtime-client --> api.typesafe.ai      ENGINES (unchanged compute)
      |   (per-question guard, pinned model)                          rs-math | hsi-lsa/hsi-engine | scoreMeasured | classifier | whitespace.py
      v                                                                    |  each label call -> direction-convention.classify()
 recorded responses (sha256-keyed) --> --check replay (offline)            v
                                                             OUTPUT / FILING LAYER (per producer)
                                                                   |
                                          +------------------------+-------------------------+
                                          |                                                  |
                               resolve endpoints LOCALLY                           no carried canon name
                          (carried name -> exact match in                                    |
                           framework-names.json)                                  stamp: unverified / not_called /
                                          |                                           handle_unresolved
                                          v
                       verification-stamp.cjs: dedupe (from,to), memo, pool 4
                                          |
                                          v
                   brain-client.callTool('find_connections', {from, to})
                     -> Part 8 belt (block -> egress_blocked sentinel)
                     -> HTTPS theo-mcp.onrender.com  (Theo: allShortestPaths, undirected, <= 3 hops)
                                          |
             +-----------+----------------+-----------------+-------------------+
             |           |                |                 |                   |
          null /      error sentinel   {refusals}        paths: []         paths[1..n]
          throw       (tier/rate/key)  no paths                              |
             |           |                |                 |        choose min-hop path, cross-check hops,
   unavailable/backend_unavailable   theo/endpoint_unresolved  theo/no_path   tier = 1-2 strong, 3 indirect
             |                                                                |
             +-------------------------------+--------------------------------+
                                             v
                          Stamp.parse (zod .strict + superRefine), judge:'none'
                                             |
                  +--------------------------+-----------------------------+
                  |                          |                             |
       formatStampLines(stamp,'cli')   filing (eureka): await stamps,  report JSON / side channel
       -> CLI output (no decimals)     then BEGIN; writeOpportunityNode  (enums only)
                                       (extraProps stamp) + SOURCED_FROM      |
                                       via navigation.writeEdge; COMMIT       v
                                             |                     last-eureka.json v2 (+opportunity_handle)
                                             v                                |
                                       room.db (proposed)          SENS-13 (hook path) -> dedup ledger -> fire once
                                             |                                |
                               gate_answer approve (human)         deep_research reach card (stamp variant)
                                             v                                |
                                       confirmed                   Larry prose narrates the STORED stamp (all surfaces)
```

### Component Responsibilities

| Component | File (new or existing) | Responsibility |
|-----------|------------------------|----------------|
| Direction module | NEW `lib/core/direction-convention.cjs` | `classify(lsa, semantic)`, `DIRECTIONS`, `DIRECTION_MEANING`, a `NONE` sentinel for missing values; cites `355-ORIGIN-CONCEPT.md` section 3 |
| Stamp module | NEW `lib/core/verification-stamp.cjs` | Resolver, `stampFinding`, `stampFindings` (memo + pool 4), `tierFromHops`, zod `Stamp`, degradation mapping; zero Jev, zero key, zero fs writes |
| Stamp formatter | NEW (discretion) e.g. `lib/core/verification-stamp-format.cjs` or inside the stamp module | `formatStampLines(stamp, surface)`; enum -> words; ASCII path; hop count as words |
| find-connections stamp entry | NEW `scripts/stamp-connections.cjs` (D-18; name at discretion) | Reads framework-name pairs from argv/stdin, prints stamp lines; called from the find-connections flow on CLI |
| Floor ledger | NEW `data/floor-ledger.json` (+ optional `scripts/check-floor-ledger.cjs --check`) | One row per literal, anchor by const name / regex |
| Labeling CLI | NEW `scripts/label-355-gold.cjs` | start/resume/status/emit; raw keypress with line fallback; atomic saves |
| Dev-time Jev | NEW `scripts/jev-question-ceilings.cjs` (questions + guard builders), `scripts/jev-response-schema.cjs`, `scripts/measure-hsi-thinking-mode.cjs`, `scripts/calibrate-citation-check.cjs`, `scripts/judge-355-usefulness.cjs` (D18); EDIT `scripts/jev-devtime-client.cjs` `EGRESS_PROFILES` (additive) | Dev-time measurement with `--check` offline replay |
| Hit-rate measurement | NEW `scripts/measure-355-hit-rate.cjs` (discretion) | Refuses `--room` outside `tests/fixtures/355-rooms/`; copies to tmp; runs producers; exports unstamped pairings; joins judgments; Wilson intervals |
| Producer output layers | EDIT `scripts/whitespace-command.cjs`, `scripts/whitespace-to-graph.cjs`, `scripts/hsi-to-graph.cjs`, `lib/core/rs-engine.cjs` (write), `lib/agents/reverse-salient-agent.cjs` (find-bottlenecks payload), `scripts/eureka-portfolio-report.cjs` (report + banking), `commands/*.md` render rules | Attach stamps; replace decimals with band words |
| Filing + sensor | EDIT `scripts/eureka-portfolio-report.cjs` `bankStatements`, `lib/core/eureka/eureka-reach-runner.cjs`, `lib/core/sensors/sensor-eureka.cjs`, `lib/hmi/dial-label-composer.cjs`, `lib/mcp/tools/gate.cjs:95` | v2 side channel, dedup ledger, card variant, promotion widen |
| Gate | NEW `tests/run-all-355.sh`, `tests/test-355-*.cjs`; EDIT `scripts/doctor.cjs` (new blocker), `lib/memory/run-feynman-tests.cjs` (TEST_FILES tail) | Phase gate |

### Recommended Project Structure (new files only)
```
lib/core/
  direction-convention.cjs            # HIPS-01
  verification-stamp.cjs              # HIPS-04 (+ formatter, or a sibling file)
scripts/
  stamp-connections.cjs               # HIPS-04/05 find-connections CJS entry (D-18)
  label-355-gold.cjs                  # HIPS-07/08 labeling CLI (D-31)
  jev-question-ceilings.cjs           # HIPS-08/09 frozen questions + guard builders
  jev-response-schema.cjs             # HIPS-08/09 zod response parse
  measure-hsi-thinking-mode.cjs       # HIPS-08 (--check offline)
  calibrate-citation-check.cjs        # HIPS-09 (--check offline)
  judge-355-usefulness.cjs            # HIPS-09 D18 (--check offline)
  measure-355-hit-rate.cjs            # HIPS-07 (fixture-only)
data/
  floor-ledger.json                   # HIPS-02
  hsi-thinking-mode-rules.json        # HIPS-08, ONLY if adopted
tests/
  run-all-355.sh
  test-355-*.cjs                      # see Validation Architecture
  fixtures/355/direction-pairs.json   # (discretion: or beside fixtures/272/)
  fixtures/355-hsi-thinking-mode-sentences.items.json / .json
  fixtures/355-citation-pairs.items.json / .json
  fixtures/355-theo-find-connections-responses.json   # recorded Theo answers (canon names only)
  fixtures/355-jev-*-responses.json
  fixtures/355-rooms/{README.md, room-ill-defined/, room-extend/, room-control/, judgments.json}
```

### Pattern 1: One rule, many callers (direction module)
**What:** every producer computes its own two similarities (algorithms stay separate, as `hsi-lsa.cjs:7-20` demands) and then calls one `classify`.
**When:** all five sites (C1): `rs-math.cjs:401` (delegate), `hsi-lsa.cjs:131` (`classifyDirectionB` becomes a thin wrapper or is deleted and callers switch), `hsi-engine.cjs:272`, `rs-differential-scorer.cjs:574`, `rs-innovation-classifier.cjs:143-153` (floors decide `hybrid` / `none`; direction for the single-axis branches comes from `classify(lsa, bert)`, which gives the same answer by construction when exactly one axis clears its floor).
**Readers:** `hsi-to-graph.cjs` re-derives `surprise_type` from `lsa_sim` / `semantic_sim` (both stored on the pair) instead of copying the string, which also neutralizes the Python HSI backend (`MINDRIAN_RS_BACKEND=python` -> `compute-hsi.py` Convention B, still live by flag, `rs-backend-dispatch.cjs:56-59`).

### Pattern 2: Stamp at the output layer, awaited before writes
**What:** collect findings -> resolve names -> dedupe `(from,to)` -> `pool(4)` -> `Stamp.parse` -> render / write.
**Rule:** never `await` Theo inside an open `BEGIN` (bankStatements, hsi-to-graph's MOAT-01 transaction). A 20 s request timeout with retries inside a room.db write transaction holds the lock for every other writer.

### Pattern 3: Refusal inside success, provenance named
**What:** every degraded stamp is still a valid `Stamp` with `verification: 'unverified'`, a `backend` and a `reason`; nothing is dropped.
**Where:** `verification-stamp.cjs` only; producers never branch on Theo state.

### Pattern 4: Dev-time Jev behind a composed guard
**What:** `jev(body, { guard: (p) => { profileGuard(p); closureCheck(p); }, key })` using `makeEgressGuard(EGRESS_PROFILES.hsi_thinking_mode)` plus the AI-SPEC's `makeSentenceCeiling(fixtureSet)` / `makeCitationCeiling({from,to,direction,theoPath})` as the closure part.
**Why:** 356's profile kinds cover key-shape, model pin and question shape; only a closure can prove "this sentence is a fixture sentence" and "this path is the one Theo returned".

### Anti-Patterns to Avoid
- **Stamping inside the engines:** duplicates the Theo call and touches Python (D-08 forbids).
- **Trusting stored direction strings:** stored HSI labels in user rooms are Convention B; re-derive from the stored pair (D-07).
- **Rendering `-->` as if Theo returned a direction:** Theo's path is undirected (`(a)-[*..3]-(b)`); an arrowhead implies an orientation nobody computed (Open Question 3).
- **A second opportunity writer:** reuse `bankStatements`' existing `writeOpportunityNode` call (C10).
- **Theo in a hook:** the sensor reads the stored stamp; it never calls Theo.
- **zod at the top of a hook-loaded module:** `sensor-eureka.cjs` is loaded in the UserPromptSubmit sensor chain via `insight-sensors.cjs:137`; a load-time throw there takes the whole sensor bank down.

## Integration Point Inventory (verified at HEAD `98b6f7bb9`)

| Seam | Current location | Notes |
|------|------------------|-------|
| Convention A rule | `lib/core/rs-math.cjs:26-31` (doc), `:401-403` `classifyDirection` | Delegate, no behavior change |
| Convention B rule | `lib/core/hsi-lsa.cjs:131` `classifyDirectionB`; doc `:7-20, :120-130` | Flips |
| HSI engine call | `lib/core/hsi-engine.cjs:272` (`classifyDirectionB(lsaSim, semSim)`), weights `:267, :273`, threshold `:102` | Flips |
| scoreMeasured (C1) | `lib/core/rs-differential-scorer.cjs:574`; header `:441-443`; `EUREKA_DIFF_FLOOR` `:463-469`; bands `:476-482`; `passes` high-leg `:577-578` | Flips; `highLeg` logic keyed on sign, not label, so unchanged |
| Classifier | `lib/core/rs-innovation-classifier.cjs:9-15` (doc), `:60-61` floors, `:64-68` enum, `:143-153` rule; consumer `scripts/rs-discovery-engine.cjs:117` | `none` added (D-04) |
| Python spawn | `lib/core/intelligence-cascade.cjs:464-479` (spawn at `:471`); also `scripts/scout-cadence-runner.cjs:391`, `commands/scout.md:273`, `skills/scout/SKILL.md:264`; pinned by `tests/test-scout-cadence-fires.cjs:173` | D-05 names only the cascade; see Pitfall 4 |
| Side-channel schema | `eureka-reach-runner.cjs:70-88` constants, `:127` probe coupling (C3), `:242-266` builder, `:276-307` validator, `:419-430` exports | |
| Sensor | `sensor-eureka.cjs:62-87` constants, `:147-192` body, evidence bag `:180-188`, freshness `:87, :113-121` | Dedup ledger new |
| Opportunity writer | `navigation/typed-opportunity.cjs:209-285` `writeOpportunityNode(db, params)`; `STATE_KEYS` `:120-122`; `OPPORTUNITY_EVIDENCE_EDGE_SUBSET` `:96-98`; re-export `navigation.cjs` (grep `writeOpportunityNode`) | Signature is `(db, params)` |
| writeEdge | `navigation/edges.cjs:1048-1140`; params `{source_id, target_id, edge_type, properties, review_status?}`; `SOURCED_FROM` in ALLOWED_EDGE_TYPES `:854` | D-38's `{relation, origin}` go in `properties` |
| Banking | `scripts/eureka-portfolio-report.cjs:1429` `BANK_SESSION_ID='eureka-portfolio'`, `:1435-1455` predicate, `:1548-1573` `deriveBankSection`, `:1589-1654` `bankStatements`, call `:1258` | C10 |
| Gate promotion | `lib/mcp/tools/gate.cjs:69-111` `_promoteCardSubject` (card must carry `subjectNodeId`, `kind === 'general'`), claim check `:95`; call site `:390` | Widen `:95` to `claim` or `opportunity` |
| Truth-claim guard | `navigation/transitions.cjs:42` TRUTH_CLAIM_TYPES includes `opportunity`; guard `:237-246` | Unchanged |
| scout-hsi | `tool-router.cjs:406, :446-455` (UNIMPLEMENTED set), banner `:950-952`, description sentence `:1833` (inside `orchestration`) | Pending 354-11/12/14/16 touch this file |
| whitespace_scan | `lib/mcp/tools/sensors.cjs:295-324`, connector row `data/mcp-tool-connectors.json:518` | Theo does not mirror this description (grep of `~/Theo/src` = 0) |
| eureka_critic enum | `tool-router.cjs:2211` `z.enum(['structural_transfer','semantic_implementation'])` | Pin to `DIRECTIONS` |
| Duplicate enums | `eureka-reach-runner.cjs:88`, `eureka-critic.cjs:524`, `eureka-offer.cjs:61`, `sensor-eureka.cjs:82`, `grill-engine.cjs:69` | D-07 names two; import all five from the module |
| brain-client | `callTool` `:595-835`; belt `:655-677`; `BRAIN_URL` `:40`; timeout `:47` (20 s default, `MINDRIAN_BRAIN_TIMEOUT_MS`) | No `find_connections` wrapper exists |
| Part 8 recognizer | `part8-egress-guard.cjs:455-465` | `{from,to}` exact keys, 1-120 char labels |
| Framework snapshot | `data/framework-names.json`: `framework_names` (105) + `curated_extras` (7), `snapshot_date 2026-05-12`; refresh via `node scripts/build-command-registry.cjs --refresh-names` | Staging this file triggers command-registry + connector-registry pre-commit checks |
| Jev client | `scripts/jev-devtime-client.cjs` (435 lines): `loadKey(opts)`, `makeEgressGuard(profile, opts)`, `jev(body, opts)`, `pool`, `EGRESS_PROFILES` | C8 |
| Feynman registry | `lib/memory/run-feynman-tests.cjs:33` `TEST_FILES`, last entry `:2061`; missing file = FAIL, exit 77 = SKIP (`:2074-2090`) | 353/354/356 did not register; 355 is mandated to |
| Doctor blocker pattern | `scripts/doctor.cjs:1948-2039` `icm-ruling-eval-fresh` (`applies_to: ['pre-tag','full']`, `DOCTOR_TEST_FAIL_POINT` arm, `DOCTOR_SKIP_*` escape, `not_run` degrade) | Pending 354-13/17/18 edit doctor.cjs |
| Dial composer | `lib/hmi/dial-label-composer.cjs:102-110` (`deep_research` family), `composeLabel(reachId, slotContext)` `:347` (no signal param today) | Drift test `tests/test-dial-label-bank-drift.cjs` |
| Pre-commit | `.git/hooks/pre-commit` == `scripts/hooks/pre-commit` (diff empty) | See Pitfall 9 |

## The "24 pinned test files", measured

`grep -rl structural_transfer tests lib/memory` finds **34 test files** (19 under `tests/`, 15 under `lib/memory/`), plus 6 fixture files and the `run-feynman-tests.cjs` registry. Classified by whether they assert the OUTPUT of a producer this phase flips:

**Must be amended (assert an output that changes), with a Phase 355 citation in the header:**
| File | Why |
|------|-----|
| `tests/272-hsi-lsa-algorithm.test.cjs` (`:79-99`) | Pins `classifyDirectionB(0.8, 0.3) === 'structural_transfer'` (Convention B) |
| `lib/memory/test-rs-innovation-classifier.cjs` | Pins the lsa-high branch and the default fallback (D-04 adds `none`) |
| `tests/test-211-measured-differential.cjs` (`:100-125`) | Pins scoreMeasured Tests 5-6 directions (C1) |
| `tests/test-215-score.cjs` (`:81-110`) | Pins feasibility by label; changes only if the portfolio mapping is swapped to preserve ranking (C2) |
| `tests/test-213-sensor-eureka.cjs` (`:134-140`) | Uses `schema_version = 2` as the mismatch case (C3) |
| `tests/test-213-part8-boundary.cjs` (`:132-136`) | Builds a v1 side-channel payload through the validator (C3) |
| `tests/fixtures/213/last-eureka.json` | v1 fixture (C3) |
| `tests/test-scout-cadence-fires.cjs` (`:173`) | Asserts a `detect-reverse-salients` step name, only if the cadence runner is changed (Pitfall 4) |
| `tests/test-dial-label-bank-drift.cjs` | Guards the template bank (D-41 variant) |

**Stay green (carry the literal as input, or pin Convention A which does not change):** `tests/272-direction-convention.test.cjs`, `tests/272-rs-engine-contract.test.cjs`, `tests/272-rank-agreement.test.cjs` (compares rs_math.py vs rs-math.cjs, both A), `tests/fixtures/272/baseline-python.fixture.json` and `candidate-cjs.fixture.json` (rs_math outputs: 2000 `structural_transfer`, 0 `semantic_implementation`; no amendment, contrary to D-06), `test-130.5-corpus-migration`, `test-211-judge-gate`, `test-212-critic-rubric`, `test-212-part8-boundary`, `test-213-eureka-offer`, `test-213-touchpoints`, `test-264-salient-critic`, `test-auto-explore-compose`, `test-reverse-salient-agent`, `test-reverse-salient-cascade-emit`, `test-reverse-salient-f0-integration`, `test-reverse-salient-telemetry`, and all 14 other `lib/memory/*rs*` tests (chain feeder, thesis, commercial, mind-map, neo4j/sqlite mirror, query-to-text, explain, breakthrough, bridge writer, discovery engine x2, lazygraph view), which inject `classification` literals.

**Semantics flag:** after the flip, a literal `structural_transfer` in a green test now MEANS "same meaning, different words". Tests that pair the literal with a signed diff (e.g. `test-reverse-salient-cascade-emit.cjs:76-115`, `structural_transfer + 0.5`) remain consistent with Convention A. `tests/fixtures/272/room/.hsi-results.json` carries Convention-B labels (e.g. `lsa 0.2456, semantic 0.4828 -> semantic_implementation`), a good real-data row for the agreement fixture.

## Live Theo Contract (probe record)

Origin: `https://theo-mcp.onrender.com` (default, `brain-client.cjs:40`), through `lib/core/brain-client.cjs` `callTool` / `query` only (THEO-04). Only canon Framework names crossed. [VERIFIED: live probe, this session]

| At (UTC) | Request shape | Latency | Sanitized response |
|----------|---------------|---------|--------------------|
| 2026-09-23T12:44:27Z | `callTool('find_connections', {from:'Reverse Salient Analysis', to:'Theory of Constraints'})` | 5338 ms (cold, includes session init) | keys `from,to,maxHops,limit,coverage,paths,diagnostics`; `coverage {matched:2,total:2,status:'complete'}`; `paths` = 1: `path [Reverse Salient Analysis, brainrecord-export-13, Theory of Constraints]`, `pathLabels [Framework, BrainRecord, Framework]`, `edges [SOURCED_FROM, SOURCED_FROM]`, `hops 2` |
| 2026-09-23T12:44:29Z | `{from:'Reverse Salient Analysis', to:'Six Thinking Hats'}` | 2085 ms | same keys; 5 paths, all `hops 2`; first: via `Ill-Defined Problem` (`DomainConcept`, `ADDRESSES_PROBLEM_TYPE` x2); others via `Trending to the Absurd` (`RELATES_TO`), `PWS Value Proposition` (`FEEDS_INTO`) |
| 2026-09-23T12:44:31Z | `{from:'Reverse Salient Analysis', to:'Zzqx Nonexistent Method'}` | 1126 ms | keys `coverage,refusals` (no `paths`); `coverage {matched:1,total:2,status:'partial'}`; `refusals [{endpoint:'to', name:'Zzqx Nonexistent Method', code:'FRAMEWORK_NOT_FOUND', detail:'no live :Framework carries the name ...'}]` |
| 2026-09-23T12:52:52Z | `query('MATCH (f:Framework) WHERE f.name IN $names RETURN f.name AS name', {names: <56 snapshot names>})` x2 | - | 109 of 112 snapshot names are live Frameworks; stale: `Falsifiability`, `Safe fail culture`, `Seven Da Vincian Principles`. (A single 112-name query returned a text-only `ROW_CAP` notice with zero rows, the spike-noted trap.) |

Conclusions: D-11's shapes hold exactly; `callTool` returns the parsed object (not a text wrapper), answering the AI-SPEC's open verification item; `backend` is still absent (plugin sets `'theo'`); refusal-inside-success confirmed with a `code` enum; the tool is served (T-1 satisfied). Theo latency is 1-2 s warm and about 5 s cold, the first plugin-side measurement. A counter-example to "strong means methodology" exists in the first probe (C6).

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Jev HTTP client, retries, pooling, egress guard | A third `jev()` | `scripts/jev-devtime-client.cjs` + a new profile | 356 extracted it so there is one client; a fork drifts |
| Theo transport, retries, key, Part 8 | A `fetch` in `verification-stamp.cjs` | `brain-client.callTool` | THEO-04; the belt and the null contract (82 degradation tests key on it) |
| Opportunity node minting | Raw SQL or `graph-ops.indexOpportunity` | `navigation.writeOpportunityNode` (existing banking call) | Part 9; stage_history; born `proposed` |
| Promotion | A new confirm path | `gate_answer` -> `_promoteCardSubject` -> `navigation.confirmNode` | Human attribution guard |
| Side-channel write | A new file writer | Runner's `buildSideChannelPayload` + `validateClosedSchema` + temp-then-rename | Closed schema is the Part 8 fence |
| Keypress parsing | Byte-level escape parsing | `readline.emitKeypressEvents` | Verified key objects include `name`, `ctrl`, `meta`, `shift`, `sequence` |
| Comment-stripped sweeps | New regex scaffolding | Copy `isPureLineComment` / `nonCommentContains` (URL-safe `//` strip) from `test-356-tripwires.cjs` | Proven negative-control idiom |
| Fixture path guard | `startsWith` on the raw arg | `fs.realpathSync` + prefix-with-separator (the `eval-icm-writers.cjs:81-102` idiom) | Symlink and sibling-prefix escapes |
| Wilson interval | A stats package | 6 lines of arithmetic in the measurement script | No deps; AI-SPEC D16 requires it in code |

**Key insight:** every piece of machinery this phase needs already exists and has been hardened by an incident. The new code is two small pure modules, a formatter, a CLI, and dev-time scripts; everything else is wiring.

## Runtime State Inventory

(The direction flip changes what an existing stored string means, so this is a migration-shaped phase.)

| Category | Items found | Action required |
|----------|-------------|-----------------|
| Stored data | (a) `HSI_CONNECTION` edges in every user room.db carry `surprise_type` written under Convention B plus `lsa_sim` / `semantic_sim` (`hsi-to-graph.cjs:110-117`): re-derivable. (b) `REVERSE_SALIENT` edges from the Python detector carry `innovation_type` (Convention B) with no stored pair; they are deleted and rewritten on every hsi-to-graph run (`DELETE FROM edges WHERE type='REVERSE_SALIENT'`, `:81-82`), and after D-05 the rewrite has no source (hsi-engine writes `reverse_salients: []`, `hsi-engine.cjs:347, :428`), so they disappear at the next HSI run. (c) `.hsi-results.json` files in rooms (Convention B strings). (d) `last-eureka.json` (transient, 30 min window). (e) Opportunity nodes from banking carry no direction. (f) `.rs-engine-results.json` and `REVERSE_SALIENT` edges from rs-engine.cjs (`source='rs-engine'`) are Convention A: unchanged | Code edit: readers re-derive (D-07). No data migration is needed for (a); (b) needs a stated decision that the Python-sourced REVERSE_SALIENT section edges go away (consumers: `futures/orchestrator.cjs`, `leverage-scan.cjs`, `reverse-salient-agent.cjs` read `source='rs-engine'` edges, verify they do not read the Python ones) |
| Live service config | Theo: nothing stored about the plugin's labels; the phase adds no Theo config. Render/Theo Phase 20 `backend` literal is future | None |
| OS-registered state | Hooks: `hooks/hooks.json` spawns `auto-explore-fingerprint.cjs` / `auto-explore-drain.cjs` (the eureka runner path); no hook registration changes | None (verify no hook references a new 355 script: HOOKS_BANNED tripwire) |
| Secrets / env vars | `TYPESAFE_API_KEY` is exported in the navigator's shell env AND stored in `~/.secrets/typesafe.env` (mode 600) [VERIFIED: presence only, value not read]. Env seams `EUREKA_DIFF_FLOOR`, `SEMANTIC_FLOOR`-family, `MINDRIAN_RS_BACKEND`, `MINDRIAN_OPPORTUNITY_BANK_PREDICATE`, `MINDRIAN_BRAIN_TIMEOUT_MS` | Every 355 test scrubs `TYPESAFE_API_KEY` and installs a counting fetch thrower first (356 hygiene idiom); ledger rows record env seams |
| Build artifacts / installed packages | The installed plugin cache (`~/.claude/plugins/.../mos/<version>/`) keeps the old convention until a release is cut and picked up; npm tarball likewise | Release through `scripts/release.sh` (not in this phase's scope); CHANGELOG must state that stored HSI labels are re-derived |

## Common Pitfalls

### Pitfall 1: The fifth direction site
**What goes wrong:** direction module lands, agreement test passes on four producers, eureka keeps emitting inverted labels.
**Why:** `rs-differential-scorer.cjs:574` is not in D-03.
**Avoid:** include scoreMeasured in the agreement test and in the "no second rule" grep (pattern should catch `signed_diff > 0 ?` ternaries and `lsa... > sem...` comparisons adjacent to a label literal).
**Warning sign:** `grep -rn "'semantic_implementation' :" lib scripts` finds a hit outside the module.

### Pitfall 2: Portfolio ranking silently changes
**What goes wrong:** eureka's composite `score` and rank order change after the flip.
**Avoid:** Open Question 1; record a before/after rank on a fixture and assert equality if the ruling is "preserve".

### Pitfall 3: Schema bump kills the guard
**What goes wrong:** every eureka scan returns `guard_unavailable` after `SIDE_CHANNEL_SCHEMA_VERSION = 2`.
**Avoid:** C3 decoupling first, RED test asserting `probeGuard().available === true` after the bump.

### Pitfall 4: Removing the Python spawn leaves three other live callers
**What goes wrong:** the cascade stops spawning `detect-reverse-salients.py`, but `scripts/scout-cadence-runner.cjs:391`, `commands/scout.md:273` and `skills/scout/SKILL.md:264` (the `/mos:scout hsi` CLI pipeline) still run it, so Convention B `innovation_type` keeps landing via the scout path.
**Avoid:** decide explicitly: either remove the step from the scout pipeline and cadence runner (amend `tests/test-scout-cadence-fires.cjs:173`, update `commands/scout.md` / `skills/scout/SKILL.md`, which triggers the registry/shape pre-commit checks), or keep it and have `hsi-to-graph.cjs` re-derive `innovation_type` from `differential`... which is impossible without the stored pair. Recommended: remove from all four sites; the "HSI pipeline" becomes compute + to-graph.

### Pitfall 5: `none` has no home in the Stamp and in producers without a differential
**What goes wrong:** whitespace (zones, per-artifact novelty) and find-connections (Brain concepts) have no `(lsa, semantic)` pair, so `direction` cannot be computed, yet AI-SPEC's `Stamp.direction` is `z.enum(DIRECTIONS)`.
**Avoid:** Stamp direction enum `[...DIRECTIONS, 'none']` with the render phrase for `none` decided up front (Open Question 5); D-04's rule that `none` never enters the `eureka_critic` enum still holds.

### Pitfall 6: Ties and missing values
D-02 locks exact ties -> `semantic_implementation`; the AI-SPEC D1 text says ties get the sentinel. D-02 wins (locked). Missing / NaN / out-of-range -> `none` (recommended). Note `rs-math.classifyDirection` takes one signed diff while `classify` takes two values; `Number(null) - 0 = 0` would silently become a tie, so `classify` must check `Number.isFinite` on both inputs before subtracting.

### Pitfall 7: Theo inside a write transaction or a hook
Never await `callTool` between `BEGIN` and `COMMIT` (bankStatements `:1599`, hsi-to-graph `:78`); never call Theo from `sensor-eureka.cjs` or `auto-explore-fire.cjs`. Cold call measured at 5.3 s; timeout 20 s plus retries.

### Pitfall 8: Part 9 sweep scope versus legacy writers
`scripts/hsi-to-graph.cjs:85-87` prepares a raw `INSERT INTO edges` and uses `openGraph`; `whitespace-to-graph.cjs:26` uses lazygraph-ops. D-43's "no raw INSERT INTO in touched modules" fails the moment hsi-to-graph is touched. Scope the Part 9 sweep to `verification-stamp.cjs`, `direction-convention.cjs`, the formatter and the eureka banking/side-channel touch points (as AI-SPEC run-all leg 3 does), and assert "no NEW raw write line" on hsi-to-graph via `check-substrate.cjs --diff` (which scans only added lines; `openGraph(` or `INSERT INTO edges` on an added line fails the commit).

### Pitfall 9: Pre-commit hooks that fire on this phase's files
| Staged path | Hook legs that run (`scripts/hooks/pre-commit`) |
|-------------|-----------------------------------------------|
| anything under `tests/fixtures/355-rooms/<room>/` (has `.room-root` ancestor) | ROOM.md + MINTO.md required in EVERY staged dir (`:122-150`), then `scripts/feynman-minto-guardian.cjs pre-commit <room>` blocks on critical/error validators (`:338-384`). Run the guardian locally before committing room text |
| `commands/*.md` (find-connections, eureka, find-bottlenecks, scout, whitespace) | `build-command-registry --check` (`:165`), `build-connector-registry --check` (`:188`), orchestration projection, `check-shape-declaration --check` (`:477`), `check-help-coverage` (`:492`), `command-registration-check` (`:506`), `check-reward-before-investment --staged` (`:324`) |
| `skills/*/SKILL.md` (larry-personality, find-connections, scout) | connector registry, orchestration projection, shape declaration |
| `data/framework-names.json` (if refreshed) | command registry + connector registry checks |
| any `lib/core/*.cjs`, `lib/hmi/*.cjs` | `check-render-coverage --check` (`:456`); after adding a render entry point run `node scripts/build-render-coverage.cjs` |
| `lib/mcp/tool-router.cjs`, `lib/mcp/tools/*.cjs` | `check-tool-honesty --check` (advisory, never blocks) |
| every commit | `check-schema-aliases`, `check-substrate --diff` (added lines only; `tests/` is allow-listed, `scripts/*.cjs` is not) |
All five structural gates are green at HEAD (measured this session: connector-registry OK, orchestration-projection OK, shape-declaration exit 0 with WARNs, command-registry OK, render-coverage OK).

### Pitfall 10: Fixture path guard versus "never run in place"
The measurement script must refuse any `--room` outside `tests/fixtures/355-rooms/` AND must never run engines in place (they write `.hsi-results.json`, `.mindrian/`, room.db, `.lazygraph/`). Resolve: guard the argument with realpath, then `fs.cpSync` to `fs.mkdtempSync(os.tmpdir())` and run there. Engines writing into the committed tree would also dirty the peer's working tree.

### Pitfall 11: Encoders in tests
`hsi-engine.runTier1` passes `{}` to `embedTexts` (`:361`), so there is no `encodeFn` seam; without the model it falls back to an identity semantic matrix (all off-diagonal semantic = 0, so every HSI pair classifies `semantic_implementation`). Stamp/no-decimal tests should feed recorded producer outputs (a committed `.hsi-results.json`, recorded whitespace JSON, recorded eureka report JSON), not run encoders. The real encoder (`MongoDB/mdbr-leaf-ir`, cached locally) runs only in the dev-time hit-rate measurement, and its id goes in the record. scoreMeasured has both `lexicalFn` and `encodeFn` seams.

### Pitfall 12: WSL raw mode
`process.stdin.isTTY` is `undefined` and `setRawMode` is `undefined` when stdin is not a TTY [VERIFIED locally]; raw mode disables Ctrl+C's SIGINT [CITED: nodejs.org tty docs], so the handler must treat `key.ctrl && key.name === 'c'` as save-and-quit and always `setRawMode(false)` in a `finally` / `process.on('exit')`. Under WSL, terminals attached through Windows Terminal generally support raw mode; `script`/pipe/CI does not. Line-mode fallback: `readline.createInterface` reading one token per line.

### Pitfall 13: The overloaded glyphs
`skills/ui-system/SKILL.md:315-330` says "12 glyphs. One meaning each. No overloading." with `checkmark = Complete` and `bullet = Draft/partial`. D-28 maps them to strong / indirect. It is locked; flag it for the UI checker so the evidence line (not the glyph) carries the meaning.

### Pitfall 14: The regex baseline has a typo
`hsi-spectral.cjs:114` integrative pattern contains `anolog` (not `analog`), so "analogy" never counts as integrative. Measure the regex exactly as shipped (the baseline is what users get) and record the typo in `355-JEV-MEASUREMENT.md`; fixing it would move the baseline and belongs in the adoption decision.

### Pitfall 15: Tripwire lists are append-only and peer-owned
`tests/test-353-tripwires.cjs:111-117` `HOOKS_BANNED_LEDGER_SCRIPTS` is append-only across phases; `tests/test-356-tripwires.cjs` `BANNED_356` bans `jev-devtime-client`, `api.typesafe.ai`, `TYPESAFE_API_KEY` under `lib/` and `hooks/`. Do not edit `tests/test-353-*` while the peer owns them; put 355's own banned-script list (label, measure, calibrate, judge, ceilings, schema) in `tests/test-355-part8-egress.cjs`.

### Pitfall 16: The key is in the shell
Because `TYPESAFE_API_KEY` is exported in the navigator's environment, a test asserting "no runtime path reads the key" must delete it first and assert via a static scan plus a fetch counter, not via "the env var is absent".

## Code Examples

### Direction module (shape)
```js
// lib/core/direction-convention.cjs -- Phase 355 (HIPS-01). Source: 355-ORIGIN-CONCEPT.md section 3.
'use strict';
const DIRECTIONS = Object.freeze(['structural_transfer', 'semantic_implementation']);
const NONE = 'none';
const DIRECTION_MEANING = Object.freeze({
  structural_transfer: 'same meaning, different words',
  semantic_implementation: 'same words, different meaning',
});
function classify(lsa, semantic) {
  const l = Number(lsa); const s = Number(semantic);
  if (lsa === null || semantic === null || !Number.isFinite(l) || !Number.isFinite(s)) return NONE;
  return (s - l) > 0 ? 'structural_transfer' : 'semantic_implementation'; // D-02: exact tie -> semantic_implementation
}
module.exports = { classify, DIRECTIONS, DIRECTION_MEANING, NONE };
```

### Driving scoreMeasured to an exact (lexical, semantic) pair offline
```js
// cosine([1,0],[c, sqrt(1-c^2)]) === c, so the semantic leg equals `c` exactly.
const vecsFor = (c) => [[1, 0], [c, Math.sqrt(Math.max(0, 1 - c * c))]];
const r = await scorer.scoreMeasured('probe a', 'probe b', {
  lexicalFn: () => lsa,                 // the lexical leg
  encodeFn: () => vecsFor(semantic),    // the semantic leg
});
// r.direction must equal directionConvention.classify(lsa, semantic)
```

### Degradation mapping (correcting the AI-SPEC draft for C5)
```js
if (res === null || res === undefined) return unverified('unavailable', 'backend_unavailable');
if (typeof res !== 'object' || Array.isArray(res)) return unverified('theo', 'malformed_response');
if (res.error === 'egress_blocked') return unverified('unavailable', 'egress_refused');
if (typeof res.error === 'string') return unverified('unavailable', 'backend_unavailable'); // tier_denied, rate_limited, invalid_key
if (!Object.prototype.hasOwnProperty.call(res, 'paths')) {
  return Array.isArray(res.refusals) ? unverified('theo', 'endpoint_unresolved')
                                     : unverified('theo', 'malformed_response');           // e.g. { text: 'Error ...' }
}
// then paths: [] -> no_path_within_3_hops; else min-hop path, deterministic tie-break, hops cross-check
```

### Keypress with fallback (verified key object shape)
```js
// Source: nodejs.org/docs/latest-v22.x/api/readline.html (emitKeypressEvents) + tty.html (setRawMode)
const readline = require('node:readline');
function openKeys(input, onKey) {
  if (input.isTTY && typeof input.setRawMode === 'function') {
    readline.emitKeypressEvents(input);
    input.setRawMode(true);
    const restore = () => { try { input.setRawMode(false); } catch (_e) {} };
    process.on('exit', restore);
    input.on('keypress', (str, key) => onKey(key && key.name, key || {}, restore));
    return 'raw';
  }
  const rl = readline.createInterface({ input });
  rl.on('line', (line) => onKey(line.trim().toLowerCase(), {}, () => rl.close()));
  return 'line';
}
// Test seam: pass a stream.PassThrough as `input` and write '1', 'y', 'u', 'q'.
```

### Composed dev-time guard (Pattern 4)
```js
const client = require('./jev-devtime-client.cjs');
const Q = require('./jev-question-ceilings.cjs');
const profileGuard = client.makeEgressGuard(client.EGRESS_PROFILES.hsi_thinking_mode); // new additive profile
const sentenceCeiling = Q.makeSentenceCeiling(new Set(items.map((i) => i.sentence)));
const guard = (p) => { profileGuard(p); sentenceCeiling(p); return true; };
const res = await client.jev(body, { guard, key: client.loadKey() });
```

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| Each dev-time Jev builder carried its own `jev()` | One shared `scripts/jev-devtime-client.cjs` with per-profile guards | Phase 356 (commit `7336e5215`) | 355 adds profiles, not a client edit |
| Memgraph Brain | Theo (`theo-mcp.onrender.com`) | 2026-09-03 (Phase 339) | `find_connections` served; plugin is its first shipped consumer |
| Python on the RS/HSI live path | CJS default, Python by `MINDRIAN_RS_BACKEND=python` | Phase 272 | Only `detect-reverse-salients.py` (and whitespace Python) remain unconditional |

**Deprecated/outdated for this phase:** AI-SPEC's placeholder direction names `meaning_bridge` / `term_collision` in its code blocks (`jev-question-ceilings.cjs` draft, `Stamp` draft) are superseded by D-01 (wire ids kept); the claim template must use `DIRECTION_MEANING` phrases. AI-SPEC's edit to `build-section-command-ledger.cjs` `jev()` is superseded by C8.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Under WSL with Windows Terminal, `setRawMode(true)` works for the labeling session | Pitfall 12 | Navigator uses the line fallback (slower, still correct) |
| A2 | `futures/orchestrator.cjs`, `leverage-scan.cjs` and `reverse-salient-agent.cjs` read only `source='rs-engine'` REVERSE_SALIENT edges, not the Python-detector section edges | Runtime State Inventory | Removing the Python spawn would starve a consumer; verify with a grep on `innovation_type` / section-to-section REVERSE_SALIENT reads |
| A3 | Theo's `hops` is always `edges.length` and `path.length - 1` (the live probe agreed on 6 of 6 paths) | Live Theo Contract | The malformed branch fires; it is disclosed, not hidden |
| A4 | Loading zod inside `sensor-eureka.cjs` could throw at hook load on a machine whose per-machine deps are not yet installed | Anti-Patterns | If deps are always present, the plain-enum check is merely redundant |
| A5 | About 420 Framework nodes exist in Theo (Theo's own comment, `find-connections.ts` "420 nodes"; spike notes 419); a direct count was `PLAN_REJECTED` by Theo's read allow-list | Summary | Coverage estimate (~26%) shifts slightly |

## Open Questions (need a navigator ruling before or during planning)

1. **Portfolio feasibility after the scoreMeasured flip (C1, C2).**
   - Known: today `semantic_implementation` (= semantic high, lexical low) gets 0.4 "paraphrase risk", and `structural_transfer` (lexical high, semantic low) gets 1.0/0.7. The deck calls same-meaning-different-words the interesting bridge.
   - Unclear: whether the eureka ranking should keep rewarding shared-words pairs.
   - Recommendation: preserve today's ranking byte-for-byte this phase (swap the two label branches in `feasibilityFromRs` so the meaning-to-score map is unchanged, cite 355, amend `test-215-score`), record the tension in `355-VERIFICATION.md`, and leave any ranking change to the next engine phase with the measured per-direction hit rate as evidence.

2. **What name does a finding "already carry" (C7)?**
   - Known: only find-connections carries canon names natively; eureka entity titles sometimes equal canon names; artifacts carry none.
   - Recommendation (all exact, local, no fuzzy, D-10-compatible): per producer, in order: (a) an explicit `framework:` (or first of `frameworks:`) key in the artifact's frontmatter; (b) the artifact's `methodology:` command slug joined through `data/command-registry.json` `frameworks[0]` (all 51 registry framework values resolve against the snapshot, measured); (c) the finding's title / entity name; then exact match against `framework-names.json`; miss = `handle_unresolved`. Fixture-room artifacts carry (a) or (b) deliberately so the per-tier rate is not empty. Needs confirmation because (a)/(b) extend D-10's wording.

3. **Rendering a path Theo returned (C6).**
   - Known: Theo paths are undirected and can pass through `BrainRecord` (internal ids like `brainrecord-export-13`) and `DomainConcept` nodes.
   - Recommendation: render hops without arrowheads (`A --SOURCED_FROM-- B`) or confirm D-28's `-->` is purely a reading order; render a non-Framework interior by its label class ("a source record", "the Ill-Defined Problem rung") rather than a raw internal id; prefer all-Framework paths among equal lengths; add a "provenance-routed strong" count to the record and the T-3 report.

4. **find-connections on Desktop / Cowork (C9).**
   - Recommendation: CLI computes via `scripts/stamp-connections.cjs` (add `Bash` to `commands/find-connections.md` allowed-tools, which triggers the registry and shape pre-commit legs); Desktop/Cowork say plainly "not checked against the methodology graph on this surface" with `backend: not_called`. A governed Desktop path would need a new MCP tool, which the SPEC excludes.

5. **Direction for producers without a differential.** Recommendation: `direction: 'none'` in the Stamp enum with the phrase "no wording signal (found through the methodology graph)" for find-connections and "no pairing" for whitespace zones.

6. **`framework-names.json` staleness.** Refresh via `--refresh-names` before measuring (touches command/connector registry checks and a peer-visible data file), or measure against the 2026-05-12 snapshot and disclose. Recommendation: do not refresh inside 355 (D-10 already discloses staleness); record snapshot coverage (109 live of 112; about a quarter of canon) as a T-3 input.

7. **Removing the scout pipeline's Python step (Pitfall 4).** Recommendation: remove from all four call sites in the same plan as D-05.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | Yes | v22.23.1 | - |
| Theo `find_connections` (via brain-client) | stamp capture, hit-rate run | Yes (live probe 12:44Z) | deploy per T-side `4ae9843`; Theo repo HEAD `c068ce6` | Honest `unverified / backend_unavailable` |
| Brain key (brain-client auto-register) | Theo calls | Yes (probe succeeded) | - | Tier 0 -> null -> unavailable |
| TypeSafe key | dev-time Jev runs | Yes: env var exported + `~/.secrets/typesafe.env` mode 600 | - | `--check` replay; SKIP loudly |
| Local encoder `MongoDB/mdbr-leaf-ir` | dev-time fixture-room runs | Yes (`~/.mindrian/model-cache/MongoDB/mdbr-leaf-ir`) | - | identity fallback (useless for measurement) |
| python3 | whitespace Python pipeline on fixture rooms | Yes | 3.12.3 | whitespace stamps untestable on real output; `sklearn` / `sentence_transformers` import check printed nothing (assumed present; verify before the hit-rate run) |
| TTY with raw mode | labeling CLI | Navigator's terminal (WSL) | - | line mode |
| git pre-commit hook | commits | Installed (`.git/hooks/pre-commit` identical to `scripts/hooks/pre-commit`) | - | - |

**Missing dependencies with no fallback:** none.
**Blocking coordination (not a dependency):** Phase 354 plans 11-18 are pending and touch shared files; start 355 execution after 354 closes.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain Node scripts with PASS/FAIL counters (house style, e.g. `tests/test-353-tripwires.cjs`) and `node:test` where already used; bash aggregator |
| Config file | none (each test is self-contained; exit 0 PASS, 77 SKIP, other FAIL) |
| Quick run command | `node tests/test-355-<name>.cjs` |
| Full suite command | `bash tests/run-all-355.sh` |
| Registry | offline `tests/test-355-*.cjs` appended to `TEST_FILES` in `lib/memory/run-feynman-tests.cjs` (after `:2061`) |
| Hygiene preamble (every 355 test) | `delete process.env.TYPESAFE_API_KEY;` and a counting `globalThis.fetch` thrower installed before any repo `require`; last check `NET_ATTEMPTS === 0` (the `test-356-tripwires.cjs:17-22` idiom); Theo is stubbed through the stamp module's `deps.callTool` seam |

### Phase Requirements -> Test Map (one row per SPEC acceptance checkbox)
| AC | Req | Behavior | Test file (RED first?) | Key assertion | Fixture needed |
|----|-----|----------|------------------------|---------------|----------------|
| AC1 | HIPS-01 | Same `(lsa, semantic)` -> same label from every live producer | `tests/test-355-direction-agreement.cjs` (RED first) | For >= 30 pairs: `classify`, `rs-math.classifyDirection(s-l)`, hsi-lsa wrapper, `hsi-engine.computeHsiMatrix` (2-artifact crafted matrices), `scoreMeasured` (lexicalFn/encodeFn seams), classifier single-axis cases all equal; missing -> `none`; tie -> `semantic_implementation`; Python detector proven off every live path (static scan of `intelligence-cascade.cjs`, `scout-cadence-runner.cjs`, `commands/scout.md`, `skills/scout/SKILL.md`) | `tests/fixtures/355/direction-pairs.json` (expected labels written from the module definition before wiring, after PWS-author phrase confirmation) |
| AC2 | HIPS-01 | Exactly one module defines the rule and cites the origin | same file, grep leg | Comment-stripped scan of `lib/`, `scripts/*.cjs` finds label-producing comparisons only in `direction-convention.cjs`; that file contains `355-ORIGIN-CONCEPT.md`; negative control plants a scratch rule file under `lib/core/` and removes it | none |
| AC3 | HIPS-02 | Every floor literal is ledgered and disclosed | `tests/test-355-floor-sweep.cjs` (RED first) | Files scanned > 0; every hit maps to a ledger row by file + anchor; stale anchor fails; `FAKE_FLOOR = 0.42` negative control caught; each disclosed row's dependent output carries `unverified`; includes `hsi-to-graph.cjs:100` and whitespace label text | `data/floor-ledger.json`; recorded producer outputs |
| AC4 | HIPS-05 | No bare 0.00-1.00 decimal in rendered output | `tests/test-355-no-decimal.cjs` (RED first; today whitespace `:193, :201, :255, :519, :523, :645` and eureka.md fail it) | D-30 regex + `[0-9]+%` on stamp/evidence lines over captured stdout of five producers (Theo up via recorded replay, Theo down via null stub), F.1 `zones.body`, Larry prose fixtures; planted `0.87` caught per surface | Recorded producer outputs; Larry prose fixtures under `tests/fixtures/355/prose/` |
| AC5 | HIPS-04 | 100% of shown findings carry the stamp; verified ones carry the byte-equal Theo path | `tests/test-355-stamp-coverage.cjs` + `tests/test-355-stamp-truth.cjs` (RED first) | Per producer: produced == rendered == `Stamp.parse` ok; tier recomputed from recorded edges equals rendered; path byte-equal to recorded shortest path; unresolved finding shown under original names | `tests/fixtures/355-theo-find-connections-responses.json` (canon names only, captured once live through brain-client) |
| AC6 | HIPS-04 | Theo unreachable -> all `unverified / unavailable`, zero paths | `tests/test-355-theo-unreachable.cjs` (RED first) | `callTool` stubbed to null, throw, `egress_blocked`, `tier_denied`, `rate_limited`, `{text}`, `{refusals}`, `paths: []`, hop mismatch: each maps to the named backend/reason; finding count unchanged; every line carries the "may be novel or hallucinated" text | stub table in test |
| AC7 | HIPS-04 | `judge: none` disclosed | inside `test-355-stamp-coverage.cjs` | `Stamp` literal `'none'`; rendered last evidence line says "none, path check only"; no `lib/`/`hooks/` reference to citation question or `jev-question-ceilings` | none |
| AC8 | HIPS-04/08/09 | Part 8 egress sweep + no runtime key | `tests/test-355-part8-egress.cjs` + run-all Part 8 leg | No `fetch(`/URL/`node:http`/curl/wget in stamp module, direction module, formatter; every captured `callTool` is `('find_connections', {from,to})` with canon values; a planted room sentence is blocked -> `egress_refused`; no non-comment `TYPESAFE_API_KEY` / `api.typesafe.ai` / `jev-devtime-client` / 355 dev script names under `lib/` or `hooks/` (scratch negative control); each 355 guard throws on non-fixture sentence, free-text claim, foreign path, extra key, edited question, `jev-latest` | none |
| AC9 | HIPS-03 | Descriptions match behavior | `tests/test-355-naming-honesty.cjs` (RED first) | `orchestration` `scout-hsi` returns the NOT EXECUTED banner + "reference only" text and writes no `.hsi-results.json` in a tmp room; `whitespace_scan` description names open questions + unsupported claims and does not claim to be the whitespace/HSI engine; `check-tool-honesty --report` lists no finding for either; connector/projection/shape gates exit 0 | tmp room |
| AC10 | HIPS-06 | One eureka run files one proposed node with stamp + SOURCED_FROM; SENS-13 once; confirm only via gate | `tests/test-355-filing.cjs` + `tests/test-355-gate-opportunity-promotion.cjs` (both RED first) | Exactly the D-43 list, plus: `probeGuard().available === true` after the schema bump (C3); dedup ledger keyed on `opportunity_handle`; agent-attributed promote -> `agent_attribution_forbidden`; `gate_answer` approve with `card.subjectNodeId = <opportunity id>`, `kind:'general'` -> `confirmed` | tmpdir room built through navigation writers (fixture-room-219 idiom) with a recorded eureka statement set and stubbed `callTool` |
| AC11 | HIPS-08 | HSI measurement record exists and replays | `tests/test-355-hsi-measurement-record.cjs` | `node scripts/measure-hsi-thinking-mode.cjs --check` exits 0 offline and reproduces the recorded accuracies; gold `fixture_sha256` equals current items hash; gold committed before the first Jev response file (git order); >= 100 sentences; model `jev-1.13.0` on every response; decision recorded; exit 77 if the record is absent | gold + recorded responses |
| AC12 | HIPS-07 | Hit-rate record + no live room | `tests/test-355-hit-rate-record.cjs` | `355-VERIFICATION.md` has >= 20 judged pairings per room, per-room/pooled/per-tier rates each with n and Wilson interval, baseline rate; `measure-355-hit-rate.cjs --room <tmp outside tree>` refuses with non-zero exit; no `MindrianRooms` / `os.homedir()` room resolution in the script | judgments.json |
| AC13 | HIPS-10 | Phase gate green | `bash tests/run-all-355.sh` | All legs; doctor no-new-regression vs a baseline captured at the 355 base commit (post-354) and written into the script header with date + commit | - |

Additional tests the decisions require:
- `tests/test-355-label-cli.cjs` (D-31..D-33): drive `label-355-gold.cjs` with a PassThrough input (keys `1`, `y`, `n`, `u`, `q`); session saved after each key (temp + rename); resume refuses a changed fixture hash and a changed phrase-module hash; tripwire that the script does not require `hsi-spectral.cjs`, `verification-stamp.cjs`, `jev-devtime-client.cjs` or any 355 Jev script; `boundary_tag` never printed.
- `tests/test-355-cirs-wiring.cjs` (D-17): stamp module declared `autonomous_safe: true`, read-only; no new reach id; `chain-executor` never treats the stamp as a material step; SENS-13 still rides `deep_research` (`test-213-reach-wired.cjs:139` unchanged).
- `tests/test-355-telemetry.cjs` (AI-SPEC Section 7, optional this phase): `cross_connection_stamped` memory_event exact key set, no content strings, `MINDRIAN_DISABLE_MEMORY_EVENT` resilience.

### `tests/run-all-355.sh` legs (mirror `tests/run-all-224.sh` exactly)
Header prose with the doctor baseline (date, commit, failing-point set); `set -uo pipefail`; `run` / `run_if` counters; `strip_comments` (`grep -vE '^[[:space:]]*(//|\*|/\*)'`); (1) `run_if` per `tests/test-355-*.cjs`; (2) Part 8 sweep `PART8_RE="fetch\(|https?://|require\(['\"]node:https?|\b(curl|wget)\b"` over `lib/core/verification-stamp.cjs`, `lib/core/direction-convention.cjs`, the formatter, `scripts/stamp-connections.cjs`, a MISSING target fails; (3) Part 9 sweep: no `node:sqlite` / `DatabaseSync` / raw `INSERT INTO` in the stamp and direction modules and in the 355-added banking/side-channel code; `opportunity-harvest.cjs` and `eureka-portfolio-report.cjs` still require navigation; (4) `git diff --quiet package.json package-lock.json`; (5) `--check` replays of the three dev-time scripts; (6) `build-connector-registry --check`, `build-orchestration-projection --check`, `check-shape-declaration --check` (no `--strict`), `check-render-coverage --check`, the scoped tool-honesty assertion; (7) `doctor_acceptance_no_new_regression` with this phase's own measured baseline set; (8) no-regression legs: `bash tests/run-all-353.sh`, `bash tests/run-all-356.sh`, `bash tests/run-all-272.sh`, `tests/test-213-sensor-eureka.cjs`, `tests/test-219-harvest-sensor.cjs`, `tests/test-354-gate-subject-promotion.cjs`, `lib/core/part8-egress-guard.test.cjs`, `tests/test-354-egress-typed-question.cjs`, `tests/test-reverse-salient-telemetry.cjs`, every amended test from the pinned-test table; (9) an em-dash leg over 355-touched files.

### Sampling Rate
- **Per task commit:** the task's own `node tests/test-355-<x>.cjs` plus the amended no-regression file it touched.
- **Per wave merge:** `bash tests/run-all-355.sh`.
- **Phase gate:** full suite green and `node scripts/doctor.cjs --acceptance` no new regression, before `/gsd-verify-work`.

### Wave 0 Gaps (and the order that honors D-35 and the peer)
- [ ] Precondition: Phase 354 closed (354-11..18 touch shared files); capture the doctor acceptance baseline at the 355 base commit.
- [ ] REQUIREMENTS.md / ROADMAP.md HIPS registration (plan-set commit, clean-file check first).
- [ ] RED tests: direction-agreement, floor-sweep, no-decimal, stamp-coverage/truth, theo-unreachable, naming-honesty, filing, gate-opportunity-promotion, part8-egress (the 354 test-first rule: each asserts the value the next layer consumes).
- [ ] `tests/fixtures/355/direction-pairs.json` (after the PWS author confirms the two phrases).
- [ ] `tests/fixtures/355-hsi-thinking-mode-sentences.items.json` (>= 120 Claude-written, >= 30% boundary cases, no sentence names its own mode) and a separate ~20-item tuning set; `scripts/label-355-gold.cjs` so sentence labeling (shows no direction) can start in wave 1.
- [ ] One live capture of Theo answers for the fixture/citation framework pairs through brain-client, stored with `pathLabels`, so later tests replay offline.
- [ ] Fixture rooms authored after the direction module and phrases land (D-35), run through `feynman-minto-guardian` locally before commit.

## Security Domain

### Applicable ASVS Categories (Level 1)
| ASVS Category | Applies | Standard control |
|---------------|---------|-----------------|
| V2 Authentication | No (no new auth; Brain key and Jev key handled by existing loaders) | - |
| V3 Session Management | No | - |
| V4 Access Control | Yes (truth-claim promotion) | `gate_answer` -> `confirmNode` human attribution guard (`transitions.cjs:237-246`) |
| V5 Input Validation | Yes | zod `Stamp` `.strict()` + `superRefine`; runner `validateClosedSchema`; part8 recognizer exact keys; realpath prefix guard on `--room`; resume refuses mismatched hashes |
| V6 Cryptography | Minimal (sha256 for fixture and payload keys) | `node:crypto` `createHash('sha256')`; never hand-rolled |
| V7 Error handling and logging | Yes | Never log keys; `memory_event` local only; degraded stamps carry a reason enum, never payload bytes |
| V8 Data protection | Yes (Canon Part 8) | Only canon Framework names cross; opaque ids and room text never leave; guard blocks content |
| V12 Files and resources | Yes | Atomic temp-then-rename writes; label/session files only under the phase dir and `tests/fixtures/355-*`; measurement runs on a tmp copy |
| V14 Configuration | Yes | Key only in `scripts/` via `loadKey`; tripwires forbid `lib/`/`hooks/` references |

### Threat Patterns for this phase
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Room text sent as `from`/`to` | Information disclosure | Local exact resolution before the call; guard step 1 blocks content (measured: a planted sentence classifies `block/content_set`); all 112 snapshot names classify `allow/known_tool_shape` (measured) |
| Fabricated or snapped path | Tampering / spoofing | Tier recomputed from returned edges; `unverified` forbids `path` by schema; replay test byte-compares |
| Rate limit or tier denial mislabeled as "Theo says unknown" | Repudiation | C5 mapping |
| Provenance-hub "strong" | Spoofing (false assurance) | Disclosed tier rule, provenance-routed count, hub share, T-3 report |
| Internal Theo record ids rendered to users | Information disclosure (Brain IP) | Render non-Framework interior nodes by class (Open Question 3) |
| Vendor key leak via tests or logs | Information disclosure | Scrub env in tests; never print; tripwires |
| Fixture guard escape to a real room (symlink / sibling prefix) | Elevation / tampering | realpath + separator-terminated prefix; negative test with a tmpdir |
| Doctor blocker false green | Repudiation | Degrade only with a named `not_run`; never reports a number it does not have; `DOCTOR_TEST_FAIL_POINT` arm tested |
| Theo latency stalls a write transaction or a hook | Denial of service | Await stamps before `BEGIN`; no Theo in hooks; pool 4; 20 s timeout |
| Side-channel tampering to force a fire | Tampering | Closed schema, enum-only fields, freshness window, dedup ledger |
| Labeling session edited between sittings | Tampering | `fixture_sha256` + `phrase_module_hash` checks on resume; gold committed before any Jev response file (git-order test) |

## Sources

### Primary (HIGH confidence)
- Repository at HEAD `98b6f7bb9`, read this session: every file:line in the Integration Point Inventory, Corrections table and Pitfalls.
- Live Theo probes through `lib/core/brain-client.cjs`, 2026-09-23T12:44:27Z to 12:52:52Z (table above).
- Theo repo read-only at `/home/jsagi/Theo` HEAD `c068ce6`: `src/mcp/content/find-connections.ts:200-275` (Cypher, coalesce, alignment).
- Node.js v22 docs: https://nodejs.org/docs/latest-v22.x/api/readline.html (emitKeypressEvents), https://nodejs.org/docs/latest-v22.x/api/tty.html (setRawMode, isRaw, isatty); keypress object shape verified empirically with a PassThrough stream on v22.23.1. (Context7 MCP tools and the `ctx7` CLI were not available in this session; the official docs were fetched directly.)
- Phase docs: 355-CONTEXT/SPEC/AI-SPEC/BRIEF/ORIGIN-CONCEPT/DISCUSSION-LOG; `docs/2026-09-23-HANDOFF-theo-phase-355-seams.md`; 354-CONTEXT and 354-02/12/16/17/18 plans; `.claude/skills/spike-findings-MindrianOS-Plugin/` (SKILL + three references).

### Secondary (MEDIUM confidence)
- Structural gate runs this session (connector registry, orchestration projection, shape declaration, command registry, render coverage: all green).

### Tertiary (LOW confidence)
- WSL raw-mode behavior in the navigator's specific terminal (A1).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (nothing new; every module read).
- Architecture / integration points: HIGH (re-verified at HEAD; ten corrections documented with file:line).
- Theo contract: HIGH (live probe).
- Pitfalls: HIGH for code-derived ones; MEDIUM for fixture-room and labeling ergonomics.
- Hit-rate design: MEDIUM (depends on Open Questions 1-5).

**Research date:** 2026-09-23
**Valid until:** until Phase 354 closes or 7 days, whichever is first (pending 354 plans edit six of the files mapped here; re-grep line numbers after 354 lands). The knowledge graph (`.planning/graphs/graph.json`, built 2026-07-23) is two months stale and was not used; every relationship above came from direct reads.

## RESEARCH COMPLETE
