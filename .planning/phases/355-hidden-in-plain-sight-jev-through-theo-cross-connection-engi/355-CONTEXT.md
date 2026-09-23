# Phase 355: Hidden in Plain Sight - Jev-through-Theo Cross-Connection Engines - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Every cross-domain finding MindrianOS shows a user (eureka, find-connections, find-bottlenecks, HSI, whitespace) carries a direction name defined once from the April 2025 origin deck and a verification stamp computed in code from Theo's `find_connections` hop count (strong / indirect / unverified, `backend` named, `judge: none` this phase); no score is ever shown; an accepted finding files as a proposed opportunity through the existing writer and surfaces once in Larry's next turn through the existing eureka sensor; the HSI thinking-mode regexes are measured against a dev-time Jev Choice with a fixed adoption bar; the first human-judged hit rate is recorded on three new fixture rooms. Rule: code finds, Jev judges the type, Theo proxies typed calls and interprets nothing, Larry composes, a human ratifies. Navigator ruling (recorded in the AI-SPEC): Jev is the preferred algorithmic choice for every intelligence layer, inside Canon Part 8 and the 2026-09-17 keyholder ruling.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**7 requirements are locked.** See `355-SPEC.md` for full requirements, boundaries, and acceptance criteria. `355-AI-SPEC.md` locks the AI design contract (framework: none, direct TypeSafe API via the in-repo client, dev-time only; 18 evaluation dimensions; guardrails; monitoring overrides).

Downstream agents MUST read `355-SPEC.md` and `355-AI-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- One direction-convention module consumed by `rs-math.cjs`, `hsi-lsa.cjs`, and the Python detector (or its retirement from the live path)
- Floor calibration ledger or `unverified` disclosure for every listed floor
- Naming fixes for `scout-hsi` and MCP `whitespace_scan`
- The verification adapter: Theo `find_connections` via `brain-client.cjs`, hop tier in code, optional Jev citation-check Choice via the Theo seam with disclosed degradation
- Stamp rendering on all five producers' outputs (whitespace and HSI at the output layer only)
- Filing through the existing harvest path and SENS-13; stamp fields on the opportunity node
- Dev-time HSI thinking-mode Jev Choice measurement and its recorded decision
- Fixture-room hit-rate measurement and record
- Tests: direction agreement, floor sweep, stamp coverage, unreachable-Theo behavior, egress ceiling, chokepoint sweep, sensor fire count; `tests/run-all-355.sh`

**Out of scope (from SPEC.md):**
- CJS port of the whitespace Python scripts and the Burt structural-hole producer
- Discovery-pattern taxonomy, Bit-Flip-Spark, supervisor reconciliation, update-velocity tracking
- Terminology Translation, Weak Signal Scoring, Temporal Convergence, any corpus service
- Theo-side code (a Jev credential, a judgment enum family on `computeGraphMetric`, `recommend_chain` changes)
- Per-user or runtime Jev calls of any kind
- A new MCP tool or command for verification
- The stage-driven trigger ("strategy rather than keywords" front end)
- UI redesign beyond the stamp line and the removal of raw scores
- Fixing the pre-existing Phase 267 / 354 interleave in ROADMAP.md

</spec_lock>

<decisions>
## Implementation Decisions

### Direction convention (Req 1)
- **D-01:** Keep the wire ids `structural_transfer` / `semantic_implementation`. Do NOT rename (65 files, the `eureka_critic` zod enum and the SEED-014 Brain-lift contract would break; stored room labels would become unknown values).
- **D-02:** New module `lib/core/direction-convention.cjs` owns the rule: exports `classify(lsa, semantic)`, `DIRECTIONS` (the two wire ids), and `DIRECTION_MEANING` (`structural_transfer` = "same meaning, different words"; `semantic_implementation` = "same words, different meaning"), citing `355-ORIGIN-CONCEPT.md` section 3. Convention A (`rs-math.cjs:29-31, 401`: `signed_diff = semantic - lsa`, `> 0` -> `structural_transfer`) already matches the deck; it is the sourced definition. Ties at exactly 0.0 stay `semantic_implementation` (keeps `tests/272-direction-convention.test.cjs:44-48` green).
- **D-03:** Producers that flip to the module: `lib/core/hsi-lsa.cjs:130` and `lib/core/hsi-engine.cjs:272` (their output inverts); `lib/core/rs-innovation-classifier.cjs:9-15, 146-152` (its lsa-high branch flips). `rs-math.cjs:401` delegates with no behavior change. The "MUST NOT unify" warning in `hsi-lsa.cjs:7-20` protects the two similarity algorithms from each other, not the label rule; the algorithms stay separate and both call `classify`.
- **D-04:** `rs-innovation-classifier` no longer defaults to `structural_transfer`: when neither similarity clears its floor it emits `none` as a third classifier output value (NOT added to the `eureka_critic` enum, which stays two values because the critic only sees pairs that passed the floors). Downstream classifier consumers get a phase-cited amendment.
- **D-05:** The Python detector is removed from the live path: delete or gate the unconditional spawn at `lib/core/intelligence-cascade.cjs:471-483`. `scripts/detect-reverse-salients.py` and `scripts/compute-hsi.py` stay as offline reference only. No Python is ported.
- **D-06:** Tests amended with a Phase 355 citation, never silently: `tests/272-hsi-lsa-algorithm.test.cjs` (pins Convention B), `lib/memory/test-rs-innovation-classifier.cjs`, direction labels in `tests/fixtures/272/baseline-python.fixture.json` and `candidate-cjs.fixture.json`, and any of the 24 pinned test files that assert Convention B output. New `tests/355-direction-agreement.test.cjs` feeds one `(lsa, semantic)` fixture set (>= 30 pairs incl. ties, near-zero, missing values) through every live producer and asserts identical labels, and greps that no second direction rule exists outside the module.
- **D-07:** Stored HSI labels already written in user rooms under Convention B are inverted; readers re-derive the label from the stored `(lsa, semantic)` pair through the module rather than trusting the stored string. `data/*.json` carries no direction enum. The duplicate `SURPRISE_TYPES` in `lib/core/eureka/eureka-reach-runner.cjs:88` and `lib/core/eureka-critic.cjs:524` import the module's ids; the `eureka_critic` zod enum (`lib/mcp/tool-router.cjs:~2146`) is pinned to `DIRECTIONS`, `schema_version` stays 1.

### Verification stamp (Req 4)
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

### Floors (Req 2)
- **D-19:** Disclose every floor as `unverified` this phase; calibrate none. Calibrating on the fixture rooms would tune floors on the same rooms the hit rate is measured on (circular first calibration point), and most floors have no env seam anyway (`SEMANTIC_FLOOR` resolves at module load in an IIFE, `rs-differential-scorer.cjs:117-124`; DIFF/LSA/BERT, `rs-engine.cjs:68`, `hsi-engine.cjs:102`, `rs-innovation-classifier.cjs:60-61` have no env hook). Env overrides are an operator seam, not provenance.
- **D-20:** Ship `data/floor-ledger.json` (house `data/*-ledger.json` pattern, `--check` offline mode), one row per literal: `{ id, file, line_anchor (const name or regex, never a bare line number), value, gates, kind: floor|band|weight|rubric|policy|definitional, env_override: name|null, env_read: load|call|null, status: disclosed|calibrated, provenance: null | {fixture, encoder, date, method, gold, n}, dependent_outputs: [producer ids] }`. `calibrated` requires non-null provenance with `gold` and `n`, so a 224-style single-pair noise ceiling cannot pass as calibration. `docs/ENV-TUNING.md` stays operator env docs and gains the undocumented env entries (`EUREKA_DIFF_FLOOR`, Stage A gates, analogy) as prose.
- **D-21:** Floor inventory (all `disclosed` this phase; the analogy live reads are at `analogy-fitness.cjs:90-99`, the SPEC's `:42-44` pointed at header comments): `rs-engine.cjs:68` DEFAULT_THRESHOLD 0.3; `rs-differential-scorer.cjs:107` DIFF_FLOOR 0.3, `:108-109` LSA_FLOOR / BERT_FLOOR 0.2, `:117-124` SEMANTIC_FLOOR 0.15 (env, load-time), `:463-469` EUREKA_DIFF_FLOOR (env, call-time); `rs-innovation-classifier.cjs:60-61` LSA_HIGH / BERT_HIGH 0.3; `rs-breakthrough-scorer.cjs:75-129` five hand rubrics; `hsi-engine.cjs:102` 0.30, `:267, :272` weights 0.6/0.4 and 0.7/0.3; `compute-whitespace-gaps.py:250` 10th percentile (Python untouched, ledger row only); `whitespace-command.cjs:515-516` bands 0.8/0.4; `interpret-whitespace.cjs:45` 0.6, `:273` 1.0; `eureka-critic.cjs:62-65` Stage A gates, `:581-587` confidence bands (policy, already renders strings); `tail-quadrant.cjs:56-59` quadrant constants (definitional); `analogy-fitness.cjs:90-99` LAYER_THRESHOLD / TEXT_WEIGHT / RESTATEMENT_FLOOR, `:59-64` bands.
- **D-22:** Sweep test `tests/test-355-floor-sweep.cjs` (leg in `tests/run-all-355.sh`): strip comments first (run-all-224/158 idiom); scan the SPEC-listed files plus a pattern pass (`const [A-Z_]+ = 0?\.\d+`, `envFloat('`, `resolveFloat('`, numeric comparisons in band functions); fail on zero files scanned; every hit resolves to a ledger row by file + anchor, and a stale anchor fails; for each disclosed row run its dependent producers on a fixture and assert the output carries `unverified` (devpkg shape: observation / suggests / unverified / evidence used); render guard greps rendered output for a bare `\b[01]?\.\d{1,2}\b` and for each ledger value, zero hits; negative control plants `const FAKE_FLOOR = 0.42` under lib/core/ and asserts it is caught (test-353-tripwires idiom `:79-98`); zero-dependency and no-network legs unchanged.

### Naming honesty (Req 3)
- **D-23:** `scout-hsi` keeps its name (it is in `UNIMPLEMENTED_MUTATING_ORCHESTRATION`, `tool-router.cjs:448`, and already gets the NOT EXECUTED banner); its per-command description (`tool-router.cjs ~:1789`) and banner say "reference only, no compute; run `/mos:scout hsi` in Claude Code". Wiring it to `hsiEngine.runTier1` is out: it would cover only step 1 of the 3-step CLI pipeline (`commands/scout.md:77, :269-279`), add a write path and a model download on Desktop/Cowork.
- **D-24:** MCP `whitespace_scan` keeps its name; `lib/mcp/tools/sensors.cjs:298` leads with "Returns open questions and unsupported claims. This is NOT the `/mos:whitespace` HSI engine; run it in Claude Code". If `data/mcp-tool-connectors.json:518` `hitl_why` is touched, regenerate `data/connector-registry.json` with `node scripts/build-connector-registry.cjs` (never hand-edit), then `build-connector-registry --check`, `build-orchestration-projection --check`, `check-shape-declaration --check`.
- **D-25:** The real gate is a new fixture test, not the scanner: `scripts/check-tool-honesty.cjs` only checks persistence (write) claims (`:1099-1110`) and `doctor.cjs:1146-1157` runs it as advisory, so AC9's "honesty point passes" is vacuous alone. The test asserts `scout-hsi` returns the banner and writes no `.hsi-results.json`, and that `whitespace_scan`'s description names open questions and unsupported claims and does not claim to be the HSI or whitespace engine.
- **D-26:** The registry-drift gate (`scripts/check-registry-drift.cjs`) compares only the `command` key in `data/command-registry.json` (`/mos:scout` at `:1854`, `/mos:whitespace` at `:2267`); neither MCP name is in it, so a rename would pass the gate green and break Desktop/Cowork silently. No rename this phase; if ever renamed, keep the old name as a deprecated alias. No shipped command, skill, agent or hook calls `whitespace_scan`.

### Rendering (Req 4, AC4)
- **D-27:** A fixed one-line stamp plus a short evidence block on every shown finding, on all three surfaces, through one shared `formatStampLines(stamp, surface)`. The path replaces the number ("show your work" resolved: path + tier + direction + judge outcome shown, scalar withheld; a conscious deviation from the briefing's "scores shown", recorded in the AI-SPEC).
- **D-28:** Glyphs from the existing 12 only, no 13th: `✓` = strong, `•` = indirect, bare `⚠` (U+26A0, never followed by U+FE0F; `ui-compliance-module.cjs:42-50`) = unverified; `·` as separator (F.1 row-2 precedent, `ui-system/SKILL.md:149`). Path hops rendered as ASCII `Framework A --EDGE--> Framework B` from `pathLabels` / `edges`; never `→` (it means "inline suggestion") and never tree glyphs (`└` is flagged by `ui-compliance-module.cjs:32-38`). Hop counts spelled as words ("two steps"). The judge appears only on the last evidence line ("none, path check only") and later becomes "supports / contradicts / says nothing" with no layout change.
- **D-29:** Leaks the stamp replaces: `scripts/whitespace-command.cjs:516` `score.toFixed(2)` (a band word replaces the decimal; the novelty math stays), `commands/eureka.md:249, :258` Score column and `0.11`, `commands/find-connections.md:79` "confidence scores", `lib/core/eureka/qualify-opportunity.cjs:364-394` `componentValue` printing raw numbers, `sensor-eureka.cjs:187` `differential` in the reach evidence bag (stays off-render). Larry's Desktop phrasing rule goes into `skills/larry-personality/SKILL.md` (hedged, no numbers, De Stijl glyph opening).
- **D-30:** The no-decimal grep runs over captured stdout of all five producers, the rendered F.1 `zones.body`, and the Larry prose fixtures, with Theo up and Theo down: `grep -nE '(^|[^0-9A-Za-z.])(0?\.[0-9]+|1\.0+)([^0-9.]|$)'`, plus a `[0-9]+%` check on stamp and evidence lines. The F.1 brain-chip `<conf>%` (`ui-system/SKILL.md:149`) is out of scope but flagged.

### Labeling session and fixture rooms (Req 5, Req 7)
- **D-31:** `scripts/label-355-gold.cjs` (argv switch-case, no deps): subcommands `start` / `resume` / `status` / `emit`; keys `1`-`6` for the five modes plus `none` with a fixed on-screen legend; `y`/`n` x3 per pairing (useful, direction ok, already known); one key each for supports / says nothing / contradicts on citation pairs; `u` undoes, `q` saves and quits; seeded shuffle with the seed stored; session saved after every key (temp file then rename); resume refuses if the fixture hash changed; raw-mode keypress via `readline.emitKeypressEvents` + `setRawMode` with a line-mode fallback (new in this repo; WSL raw-mode quirks are the risk).
- **D-32:** Blinding guards: the script never requires `hsi-spectral.cjs`, any Jev module, or the stamp module (tripwire grep); `boundary_tag` is never printed; `measure-hsi-thinking-mode.cjs` refuses to run until the gold file has `labeled_at`; the unstamped baseline pass runs before any stamped output exists; stamp tier and Jev answers are joined afterwards by `pair_id`, never at labeling time.
- **D-33:** Gold files: item files hold no labels (`355-hsi-thinking-mode-sentences.items.json` `[{id, sentence, boundary_tag}]`, `355-citation-pairs.items.json`, room pairings exported unstamped as `[{pair_id, room, a_excerpt, b_excerpt, direction_phrase}]`); session file `.planning/phases/355-*/labeling-session.json` `{fixture_sha256, order_seed, phrase_module_hash, started_at, entries:{id:{label, at, ms}}}` keyed by id, never position; `--emit` writes `355-hsi-thinking-mode-sentences.json` `[{id, sentence, gold}]` with `_labeling_note`, `labeler: "navigator"`, `fixture_sha256`, `labeled_at`; `355-citation-pairs.json`; `355-rooms/judgments.json` `{pair_id, useful, direction_ok, already_known, at}`. Tests assert the gold's `fixture_sha256` equals the current item-file hash.
- **D-34:** Three new Claude-authored fixture rooms under `tests/fixtures/355-rooms/` (Phase 353 `icm-rooms/` pattern: `.room-root`, `ROOM.md`, `MINTO.md` per folder, required by the pre-commit hook), copied to a temp dir by tests and never run in place; each with 4 sections spanning distinct domains and 3-4 artifacts of 150-300 words (about 12-16 documents, 66-120 candidate pairs, so RS, HSI and whitespace all fire; `rs-math.cjs:329` returns nothing below 2 documents). Room 1 is an ill-defined problem; room 2 sits at the extend-the-opportunity step; room 3 is a control with planted meaning bridges and planted false friends (shared words with different meanings, e.g. "virus", "channel") so D17 has real cases. No real names. The measurement script refuses any `--room` outside `tests/fixtures/355-rooms/` (`test-353-tripwires.cjs:120-136` idiom). None of the existing fixture rooms qualify (236 single-section, 219 boilerplate text, 347/354 schema-only, claim-harness memory-only, sample-room 4 files).
- **D-35:** Fixed order: sentence labeling (D14) shows no direction and can run in wave 1; the direction module and its two phrases land first, the PWS author confirms the phrases (AI-SPEC D17), then rooms and citation pairs are authored, then the navigator judges. The phrase-module hash is recorded in the session file; a resume with a mismatched hash is refused; if the phrases change after judging, direction-ok labels are re-run.

### Filing and the Larry touchpoint (Req 6)
- **D-36:** The "existing harvest path" is `navigation.writeOpportunityNode` (`lib/core/navigation/typed-opportunity.cjs:211`, re-exported at `navigation.cjs:457`), the writer the eureka banking at `scripts/eureka-portfolio-report.cjs:1613` actually uses; `opportunity-harvest.cjs` is read-only by contract (`:26-29`) and `addWhitespaceZone` mints `WhitespaceZone`, not opportunities. Never `graph-ops.indexOpportunity` (bypasses the chokepoint). Call shape: `{ name, sessionId, lifecycle:'candidate', section, actor:'system', reason:'eureka stamped finding', evidence_ids:[aId, bId], formula_version:'stamp-v1', extraProps:{...} }`; do not pass `review_status` (born `proposed`, `:273-282`); stay off the STATE_KEYS (`:120-122`).
- **D-37:** Stamp fields ride `extraProps` (merges into the properties JSON, no DDL: `:227-231`, `node-insert.cjs:123-134`) as flat enums and arrays: `verification`, `backend`, `direction`, `judge:'none'`, `path` (hop names), `path_len`, `pws_stage` (ill_defined | extend_opportunity), `engine_mode`.
- **D-38:** Edges: `linkOpportunityEvidence` rejects SOURCED_FROM (subset `{DERIVED_FROM, SUPPORTS, INFORMS}`, `typed-opportunity.cjs:96-98`); write `navigation.writeEdge` directly with `{relation:'sourced_from', origin:'eureka-355'}` (the REJECTED_BECAUSE precedent, `:33-35`) to the two source artifact nodes (writeEdge checks the edge type, not the endpoints). Do NOT use `writeReasoningNode`. Mint the node before the edges.
- **D-39:** `gate_answer` promotion: widen `_promoteCardSubject` (`lib/mcp/tools/gate.cjs:94`, today `row.type === 'claim'` only) to include `'opportunity'`; it is already in TRUTH_CLAIM_TYPES (`transitions.cjs:42`) so the Phase 348 human-attribution guard (`transitions.cjs:233-246`, `agent_attribution_forbidden`) still applies. One regression test asserts the exact node id goes `proposed` -> `confirmed`. Coordinate the edit with Phase 354-02 (jsagi-25, in flight, same file, the subject-claim fix).
- **D-40:** Section: `props.section` is a real domain slug derived from the evidence nodes (216 field contract, `typed-opportunity.cjs:60-65`; `deriveBankSection` at `eureka-portfolio-report.cjs:1548`); the `opportunity-bank/` file is written only by `qualifyCandidate` (`qualify-opportunity.cjs:9, 186`) after the human confirms. The PWS author's ill-defined ruling sets the trigger stage, not the filing location; it is recorded as `pws_stage` on the node.
- **D-41:** SENS-13 copy: keep `reach_id: deep_research` and signal `eureka_bridge` unchanged (no seven-place lockstep, `test-213-reach-wired.cjs:139` stays green); add a signal-aware stamped-finding card variant in `lib/hmi/dial-label-composer.cjs:102-110` ("verified through <path>" / "unverified - novel or hallucinated, verify with an expert"); extend the evidence bag (`sensor-eureka.cjs:181-189`) with the enum stamp fields and `opportunity_handle`, no decimals, no banned words; mirror the same stamp line in `skills/larry-personality/SKILL.md` reach narration.
- **D-42:** Fire-once: SENS-13 re-fires on every dispatch while `last-eureka.json` is fresh (30 min, `sensor-eureka.cjs:87, :161-170`); add a dedup ledger keyed on `opportunity_handle` (the `sensor-url-ingest.cjs:157` precedent). SENS-14 (harvest lane, `scanEurekaProposals`, `opportunity-harvest.cjs:546-553`) is NOT suppressed: the fire-once test constrains SENS-13 only (exactly once across two dispatches).
- **D-43:** `test-355-filing.cjs`: run eureka once, close and reopen room.db, assert exactly 1 row `type='opportunity'` AND `review_status='proposed'`; stamp fields re-parse with the zod `Stamp` schema; >= 2 SOURCED_FROM edges from the node; SENS-13 fires once across two dispatches; an agent-attributed `promoteNodeStatus` returns `agent_attribution_forbidden`; after `gate_answer` approve a re-read returns `confirmed`; the Part 9 sweep finds no raw `INSERT INTO` in touched modules; only pre-existing node types appear.

### Jev seats (Req 5, AI-SPEC D14, D15, D18)
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 355 locked docs (this directory)
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-SPEC.md` - Locked requirements (7), boundaries, constraints, 13 acceptance checkboxes. MUST read before planning.
- `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/355-AI-SPEC.md` - AI design contract: navigator ruling, framework decision and 8 planner findings, CJS/zod quick reference and best practices from the live TypeSafe docs, domain context (rubric rows, failure modes), 18 eval dimensions, guardrails, monitoring overrides. MUST read before planning.
- `.planning/phases/355-.../355-BRIEF.md` - The three-homes design and the per-capability Jev primitive table.
- `.planning/phases/355-.../355-ORIGIN-CONCEPT.md` - The April 2025 deck; section 3 defines the two directions.
- `.planning/phases/355-.../355-INTENT.md` - Users, the ill-defined-section ruling, the uniqueness table, the eight Tetlock principles.

### Cross-repo and coordination
- `docs/2026-09-23-HANDOFF-theo-phase-355-seams.md` - The five Theo asks (T-1..T-5) with contracts; T-side dispositions as of 2026-09-23: T-1 confirmed live (see D-11), T-2 amended to seed-only pending the navigator's rule-1 amendment (Theo SEED-015), T-3 to SEED-009 / Phase 20.1 (the two node types are ABSENT from canon, not 0-edge), T-4 to a new OQ-4 seed, T-5 in Phase 20; T-6 closed as stale.
- `~/Theo/docs/M-T-COORDINATION-PROTOCOL.md` - No cross-edits; durable entry plus live ping.
- `.planning/phases/354-system-integrity-and-theo-integration-independent-research-a/354-CONTEXT.md` - D-354-EGR (typed identifiers at the egress boundary), THEO-04 (raw `theo` server never called from plugin code), the 354-17 Jev framework-command-ledger pattern, the test-first rule, and the "never patch Theo incidentally" rule; 354-02 touches `gate.cjs` (coordinate D-39).
- `.claude/skills/spike-findings-MindrianOS-Plugin/SKILL.md` and its `references/` - Measured Jev contract, latency, cost, the 64/64 vs 40/64 policy-parity result, the IP egress ruling.

### Canon and house rules
- `docs/MINDRIAN-CANON.md` Part 8 (graph boundary), Part 9 (memory locality; `proposed` until `gate_answer`), Part 11 (CIRS born-wired, HITL shape declaration).
- `docs/HITL-SHAPE-DECLARATION-CONTRACT.md` - Shape declaration for any touched surface.
- `docs/ENV-TUNING.md` §DERIVE_CONVERGES_FLOOR / DERIVE_INFORMS_FLOOR - The Phase 224 calibration-provenance idiom the floor ledger follows.
- `skills/ui-system/SKILL.md` - 4 zones, the 12-glyph vocabulary, color contract, Shape E and F.1; `lib/core/doctor/ui-compliance-module.cjs:32-50` for the forbidden glyph forms.
- `skills/larry-personality/SKILL.md` - Voice rules ("Hedged always", no numbers) for the Desktop stamp phrasing.
- `tests/fixtures/icm-rooms/README.md` and `tests/test-353-tripwires.cjs` - The fixture-room and tripwire idioms D-34 and D-32 reuse.
- `tests/run-all-224.sh` - The Part 8 egress sweep, Part 9 chokepoint sweep, and no-regression leg idiom `run-all-355.sh` mirrors.
- `lib/memory/run-feynman-tests.cjs` - The TEST_FILES registry (not under `tests/`) where `test-355-*` legs register.

### Room reasoning trail (evidence, not instructions)
- `~/MindrianRooms/rethinking-mindrianos/research/2026-09-23-hidden-in-plain-sight-jev-through-theo-design.md`, `2026-09-23-origin-concept-algorithmic-generation-of-rs-solutions.md`, `2026-09-23-engine-intent-opportunity-review-and-pws-author-ruling.md`, `2026-09-23-theo-handoff-phase-355-seams.md`, `2026-09-23-algorithm-rd-briefing-mirror/` (13 tabs; `06-brain.md` is the Brain Audit).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- In-repo Jev client: `scripts/build-section-command-ledger.cjs` (`jev`, `pool`, `loadKey`, `assertEgressCeiling`; `MODEL = 'jev-latest'` at `:62`, ceiling at `:83-128`, exports near `:708`), already reused by `scripts/eval-icm-writers.cjs`.
- `lib/core/brain-client.cjs` `callTool` (`:595`) with the Part 8 belt (`:657-669`) and the pinned outage signal (`:627-630`); `lib/core/part8-egress-guard.cjs:430-437` already admits `find_connections {from, to, maxHops?}`.
- `data/framework-names.json` (`framework_names` + `curated_extras`) for local exact-name endpoint resolution.
- `navigation.writeOpportunityNode` (`lib/core/navigation/typed-opportunity.cjs:211`) and `navigation.writeEdge`; `qualifyCandidate` (`lib/core/eureka/qualify-opportunity.cjs:189`).
- F.1 renderers with WHY lines above verb rows (`qualify-opportunity.cjs:496-499`), `renderShapeF1` + `appendAskUserQuestionTrailer`; `lib/hmi/dial-label-composer.cjs:102-110` templates.
- Fixture-room helpers (`tests/helpers/fixture-room-*.cjs`, `tests/fixtures/icm-rooms/`) and the tripwire idiom (`tests/test-353-tripwires.cjs`).
- `zod` ^3.25.76 (already vendored) for the Jev response and `Stamp` schemas (AI-SPEC Section 4b).

### Established Patterns
- Dev-time ledger shipped as data with `--offline-seed` / live / `--jev-fixture` modes and `--check` offline-only (Phase 353, 354-17).
- Refusal-inside-success with provenance passed through (Theo `computeGraphMetric`); the plugin never fabricates a path or a backend.
- Comment-stripped sweep tests with a negative control (run-all-224, test-353-tripwires).
- Closed schemas with exact key sets on the Eureka side-channel (`validateClosedSchema`); any new key needs a version bump in lockstep.
- Seven-place sensor registration lockstep for NEW sensors (Phase 345); untouched here because SENS-13 keeps its reach id and signal.

### Integration Points
- Output layers: `scripts/whitespace-command.cjs:189-197, :505-516`; `scripts/whitespace-to-graph.cjs:132, :184`; `scripts/hsi-to-graph.cjs:119`; `lib/core/rs-engine.cjs:393/:423` (`writeReverseSalientEdges`); `lib/core/eureka/eureka-reach-runner.cjs:242, :277/:292, :413`; `lib/core/sensors/sensor-eureka.cjs:71, :159, :181-189`; `lib/core/eureka/opportunity-harvest.cjs:719`; `scripts/eureka-command.cjs` + `commands/eureka.md:225-286`; `commands/find-connections.md:74-99`; `commands/find-bottlenecks.md`.
- Direction rule sites: `lib/core/rs-math.cjs:29-31, :401`; `lib/core/hsi-lsa.cjs:130`; `lib/core/hsi-engine.cjs:272`; `lib/core/rs-innovation-classifier.cjs:9-15, :146-152`; `lib/core/intelligence-cascade.cjs:471-483` (Python spawn to remove).
- Gate promotion: `lib/mcp/tools/gate.cjs:94` (`_promoteCardSubject`); `lib/core/navigation/transitions.cjs:42, :233-246`.
- Naming: `lib/mcp/tool-router.cjs ~:1789, :406, :448`; `lib/mcp/tools/sensors.cjs:298`; `data/mcp-tool-connectors.json:518`.

</code_context>

<specifics>
## Specific Ideas

- The stamp line, CLI (Shape E, Zone 2 row; Cowork identical): `✓ strong · same meaning in different words · theo`, then `path   Reverse Salient Analysis --LEADS_TO--> Theory of Constraints --ADDRESSES--> Bottleneck Analysis`, `tier   strong, two steps in the methodology graph`, `judge  none, path check only`. Unverified: `⚠ unverified · same words with different meaning · theo`, `reason endpoint not a known framework`, `may be novel or hallucinated - verify with a domain expert`. Framework names and relationship types in the mock are illustrative.
- Desktop (Larry prose): opens with the De Stijl glyph, hedged ("might be one argument"), states the direction phrase, "Checked: strong. The methodology graph links them in two steps: ...", "Nobody has judged the citation yet; this is the path alone", then the gate question ("Want the first one filed as a proposed opportunity?").
- The two direction phrases the PWS author confirms before judging: "same meaning in different words" and "same words with different meaning" (from the deck, `355-ORIGIN-CONCEPT.md` section 3).
- The navigator's own line for the phase framing: "strategy rather than keywords"; and the ruling recorded in the AI-SPEC: "Jev is the preferred algorithmic choice for any and all intelligence layers."

</specifics>

<deferred>
## Deferred Ideas

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

### Reviewed Todos (not folded)
- Mirror the gate_render description fix into Theo (2026-09-07): closed as stale (already byte-identical on the Theo side, quick 260907-fnr / 1d7e1cd).

</deferred>

---

*Phase: 355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi*
*Context gathered: 2026-09-23*
*Note: the STATE.md session record for this discussion was deliberately not written; a peer session (jsagi-25) is mid-execution on Phase 354 in the same working tree and the collision rule forbids state.* writes while a peer executes. STATE.md's Roadmap Evolution entry for Phase 355 (commit 8d1cd2a58) already records the route.*
