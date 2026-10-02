---
phase: quick-261002-cud
plan: 01
type: execute
wave: 1
depends_on: []
id: 261002-cud
slug: 366-gap-fixes-research-cjs-plan-only-ses
date: 2026-10-02
source: "Phase 366 gap fixes: 366-17 known follow-up (MCP run_quick has no plan_only branch, no offline), 366-11 deferred item (MCP basket mints no release gate), SEED-104 residual (room-only ws:extraction_failure false negative)"
canon_parts: [8, 3, 7, 11]
files_modified:
  - lib/core/research-planner/canon-release.cjs
  - scripts/research-planner.cjs
  - lib/mcp/tools/research.cjs
  - tests/test-366-mcp-release-route.cjs
  - tests/test-366-mcp-plan-only.cjs
  - tests/fixtures/267/wire-snapshot-zod4.json
  - tests/test-365-never-do-gate.cjs
  - lib/core/research-planner/quick.cjs
  - tests/test-seed104-room-check-tokens.cjs
  - tests/run-all-366.sh
  - .planning/seeds/SEED-104-research-grant-family-loop-eureka-plan-unfetchable.md
autonomous: true
requirements: [EPV366-18, EPV366-22, EPV366-03, SEED-104]

must_haves:
  truths:
    - "Over MCP, research_run op run_quick on a ready quick plan in a room whose override turns the research line off returns ok true, status plan_only, reason egress_line_off, line research, sent false, outcome plan_only_not_sent, the plan review card and a next_step. It never returns run_refused for this case. Nothing is fetched, no run.json is written and no audit row is appended."
    - "Over MCP, run_quick with offline true returns plan_only with offline true and sends nothing, in a room with no override. Without offline, the existing done / reask / refused paths are unchanged."
    - "Over MCP, op basket on a run whose pair carries an unresolved room framework word lists that word under release_offers with its own minted gate id and its F.8 release card, when the theo egress line is on and the release transport is enabled (MOS_366_THEO_REPLAY or MOS_366_LIVE=1). This holds for a session-less stdio caller too. Canon item ids never appear among the filing gate's options."
    - "gate_answer on a release gate with chosen release and verdict approve sends exactly {raw: term} once through the environment-chosen transport. The guard allows navigator_released, one 23-key audit row is written, and a snapshot hit writes one PROPOSED translation row. not_now / reject sends nothing. A second answer on the same gate is refused, and an answer from another session sends nothing."
    - "With neither MOS_366_THEO_REPLAY nor MOS_366_LIVE=1, the MCP basket mints no release gate and answers live_not_enabled, exactly like the CLI canon-release door. With the theo line off it answers egress_line_off and the off note. The MCP door is never a wider egress door than the CLI."
    - "localRoomCheck counts an artifact that names a long zone term in other words: a strict majority of the term's content tokens is enough. On the hermetic fixture, the seven-word term 'gallium oxide choline chloride deep eutectic solvent' now finds the opportunity-bank artifact (it returned 0 before). An artifact holding only a minority of the tokens is not counted. Exact-phrase hits, single-word terms, dot-directory exclusion and the return shape are unchanged."
    - "research_run's entry in tests/fixtures/267/wire-snapshot-zod4.json equals the live wire. check-tool-honesty --check, build-connector-registry --check and test-270 stay green. test-366-mcp-perspective-ops, test-366-gated-term-release, test-366-egress-policy, test-363-mcp-tool, test-seed104-grant-family-loop and test-365-never-do-gate stay green."
  artifacts:
    - path: "lib/core/research-planner/canon-release.cjs"
      provides: "transportFromEnv(env): the one environment-chosen release transport (replay file, MOS_366_LIVE=1, else live_not_enabled), shared by the CLI and MCP doors"
      contains: "transportFromEnv"
    - path: "scripts/research-planner.cjs"
      provides: "canonTransport delegates to canonRelease.transportFromEnv (one copy, Canon Part 7)"
      contains: "transportFromEnv"
    - path: "lib/mcp/tools/research.cjs"
      provides: "opRunQuick plan_only branch and offline pass-through; opBasket session-keyed release gates, release_offers, confirm_items, canon ids kept off the filing gate; offline field and two description sentences"
      contains: "plan_only"
    - path: "lib/core/research-planner/quick.cjs"
      provides: "localRoomCheck strict-majority content-token coverage beside the exact-phrase hit"
      contains: "contentTokens"
    - path: "tests/test-366-mcp-release-route.cjs"
      provides: "MCP release-route legs C1-C12 (basket gate ids, gate_answer release, audit row, proposed row, single use, cross session, live_not_enabled, egress_line_off, transportFromEnv unit legs)"
    - path: "tests/test-366-mcp-plan-only.cjs"
      provides: "MCP plan_only and offline legs P1-P6"
    - path: "tests/test-seed104-room-check-tokens.cjs"
      provides: "SEED-104 room-check regression K1-K7 on a hermetic fixture"
    - path: "tests/fixtures/267/wire-snapshot-zod4.json"
      provides: "research_run description and inputSchema refreshed from the live wire"
      contains: "offline"
  key_links:
    - from: "lib/mcp/tools/research.cjs opBasket"
      to: "lib/core/research-planner/planner.cjs basketFor -> filing.basketWithCanon -> canonRelease.basketItemsFor -> mintReleaseGate"
      via: "opts { sessionId: gateLedger.ledgerSessionKey(env.sessionId), deps: transport.deps }"
      pattern: "basketFor\\(env\\.dir, runId, "
    - from: "lib/mcp/tools/gate.cjs gate_answer (unchanged, read-only)"
      to: "canon-release releaseTerm"
      via: "the material_step ledger entry's resumeFn minted by mintReleaseGate; result nested under chain_result"
      pattern: "resumeFn"
    - from: "lib/mcp/tools/research.cjs and scripts/research-planner.cjs"
      to: "canonRelease.transportFromEnv"
      via: "both doors pick the release transport in one place"
      pattern: "transportFromEnv\\("
    - from: "lib/mcp/tools/research.cjs opRunQuick"
      to: "quick.runQuick"
      via: "{ offline: env.input.offline === true }"
      pattern: "runQuick\\(env\\.dir, loaded\\.plan, \\{ offline"
    - from: "quick.cjs runQuick step 4 and deep.cjs (line 1259)"
      to: "quick.cjs localRoomCheck"
      via: "same function, so both quick and deep runs inherit the token coverage"
      pattern: "localRoomCheck\\("
---

<objective>
Close three Phase 366 gaps in one change set:

1. **Item 2 (Task 1): release over MCP.** The MCP research_run basket now gets a minted, session-keyed release gate for each canon_release item, the same way the CLI door does (366-11 deferred item). The navigator's release answer goes through the existing gate_answer tool to canon-release's releaseTerm.
2. **Item 1 (Task 2): typed plan-only answer.** run_quick over MCP answers typed `plan_only` (366-17 status) instead of `run_refused/egress_line_off`, and it takes an `offline` flag through to runQuick.
3. **Item 3 (Task 3): SEED-104 residual.** The room-only coverage check behind leaf `ws:extraction_failure` stops exact-phrase-matching long zone terms. It switches to strict-majority content-token coverage, with a hermetic regression that reproduces the evidence-room false negative.

Purpose: Desktop and Cowork users get the same honest answers and the same navigator-gated release path the CLI already has (Tri-Polar rule). The room stops paying for research it already holds.

Task order is item 2, item 1, item 3 on purpose (DR-3). That way research_run's registration (inputSchema plus description), its wire-snapshot entry and the test-365 N12 pin each change exactly once.

Output: three code fixes, three new test files registered in the release-gated tests/run-all-366.sh, the refreshed research_run wire entry, the re-pinned N12 base, and one SEED-104 note.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/phases/366-eureka-perspective-in-research-planner-mcp-canvas-tooling/366-11-SUMMARY.md
@.planning/phases/366-eureka-perspective-in-research-planner-mcp-canvas-tooling/366-17-SUMMARY.md
@.planning/phases/366-eureka-perspective-in-research-planner-mcp-canvas-tooling/366-14-SUMMARY.md
@.planning/seeds/SEED-104-research-grant-family-loop-eureka-plan-unfetchable.md
@lib/mcp/tools/research.cjs
@lib/core/research-planner/canon-release.cjs

<interfaces>
Verified at planning time (HEAD f7910ac1f; peers commit often, so re-grep the anchors before editing):

lib/mcp/tools/research.cjs (812 lines, v2 `server.registerTool`)
- 34-36: the header "Egress (Canon Part 8)" paragraph. 48-51 require planner, quick, grants, structure. canon-release is not required yet.
- 89 `refuse(reason, extra)`. 128-138 `cardView(card)`.
- 148-208 `mintApprovalGate(server, ctx, sessionId, spec)` renders through gateRender.renderGate and mints a material_step gate. It is NOT used for the release: canon-release mints its own release gate, and that gate's resumeFn IS the release.
- 353-384 `opRunQuick`. Line 358 is `quick.runQuick(env.dir, loaded.plan, {})`. Branches: done 359, reask 373, typed refusals 381-382. The fall-through at 383 `refuse('run_refused', {status:'refused', detail: res.reason, ...})` is where plan_only lands today.
- 446-480 `opBasket`. Line 449 is `planner.basketFor(env.dir, runId)` with no opts. The options are every b.item plus FILE_NOTHING, the approving list is every item id, and the response `items` is every item.
- 490-501 `opFile` never calls basketFor. The deferred-items wording "pass-through in opFile" really means opBasket.
- 694-713 `termSchema` and `inputSchema` (zod). 715 `DESCRIPTION` is 1009 bytes; its last sentence is "Nothing leaves the room except grant-approved search strings." 717-783 `register`. 790-800 `connectors` (leave unchanged). 802-812 exports.

lib/core/research-planner/canon-release.cjs (560 lines)
- 72-80 helpers; `isCanonItemId(id)` at 79 is exported. 146 `theoOn`. 159 `offerItemsFor` gives items `{id, kind:'canon_release', term, section, perspective, intent, run_id, theo_on, default_on:false, gate_id:null, note (OFF_NOTE when off), label}`.
- 210 `releaseCard(item)`: an F.8 card with options `release` and `not_now` (recommended), and `payload.gate_id` from item.gate_id.
- 253 `mintReleaseGate(roomDir, item, {sessionId, deps, policy, offline})` mints a gate-ledger material_step gate. Its resumeFn calls `releaseTerm(..., deps)` with the deps captured at mint time.
- 372 `releaseTerm`: when deps has no callTool it uses brain-client callTool (LIVE), and deps.transport defaults to 'live'.
- 463 `answerRelease` (CLI door). 489 `confirmItemsFor` (kind canon_confirm, `{id, term, canon_name}`).
- 534 `basketItemsFor`: mints only when `it.theo_on && nonEmpty(o.sessionId)`. 545-560 exports.

lib/mcp/gate-ledger.cjs
- 47 `ledgerSessionKey(sessionId)`: a non-empty string returns itself; otherwise it returns NO_SESSION_PREFIX + pid. mintGate stores `sessionKey: ledgerSessionKey(sessionId)`.
- 97-106 `consumeGate` compares `entry.sessionKey !== ledgerSessionKey(sessionId)` and deletes the entry before that check. That delete-first behavior is a known Phase 289 defect; do not fix it here.
- Consequence: passing `sessionId: gateLedger.ledgerSessionKey(env.sessionId)` into basketFor mints a release gate even for a session-less stdio caller (`resolveEffectiveSessionId` = explicit || extra.sessionId || CLAUDE_CODE_SESSION_ID || null), and gate_answer from that same caller consumes it.

lib/mcp/tools/gate.cjs (READ-ONLY: test-365 N12 asserts it is byte-identical to PLAN_BASE)
- gate_answer handler 450-500: it consumes the gate, validates chosen against the minted card options (returns chosen_not_in_card_options otherwise), and refuses a material_step entry that has no resumeFn.
- 680-700: for material_step it calls `live.resumeFn({gate_id, chosen, verdict})` and nests the result under `chain_result`. If `chain_result.ok === false`, it sets response.ok to false.
- So the release route through gate_answer already exists once a gate is minted. Nothing changes here.

lib/core/research-planner/planner.cjs 803-811 `basketFor(roomDir, runId, opts)` passes opts to `filing.basketWithCanon` (filing.cjs 280), which calls `canonRelease.basketItemsFor`. Do not edit planner.cjs or filing.cjs.

scripts/research-planner.cjs 328-352 `canonTransport()`:
- If MOS_366_THEO_REPLAY is set, it reads that file. `doc.responses` must be an object, otherwise the answer is `{ok:false, reason:'replay_unreadable'}`. On success it returns `deps {transport:'replay', callTool}`, and that callTool answers only `normalize_framework_name` with a string `raw`, using hasOwnProperty, and returns null otherwise.
- Else if `MOS_366_LIVE === '1'` it returns `{ok:true, deps:{transport:'live'}}`.
- Else it returns `{ok:false, reason:'live_not_enabled', hint:'Set MOS_366_LIVE=1 to allow the real Theo call for this one term, or MOS_366_THEO_REPLAY to a recorded-answer file.'}`.
- 354-369 `canonDoor` uses it.

lib/core/research-planner/quick.cjs (1026 lines)
- 70-72: the caps ROOM_FILE_CAP 400, ROOM_FILE_BYTES 262144, ROOM_DEPTH_CAP 5. 96-155 `localRoomCheck(roomDir, terms)`. Needles come from `evidenceRows.normalizeText` (NFKC, quote and dash folding, whitespace collapse, lowercase). An artifact counts when `needles.some(n => text.indexOf(n) !== -1)`, which is the exact-phrase SEED-104 false negative. The walk covers the canonical section folders only, skips dot entries and symlinks, and keeps only indexable md/html files. It returns `{flagged, artifact_count, artifacts[{section, path}], terms_checked}`.
- 425-444 `planOnly(plan, line, policy)` returns `{status:'plan_only', reason:'egress_line_off', line, offline, sent:false, outcome:'plan_only_not_sent', run_id, answer_line, card: planReviewCard(plan), ignored}`.
- 503 `runQuick(roomDir, plan, opts)`; 531 reads `o.offline === true`. 700-712: step 4 calls `localRoomCheck(roomDir, planTerms(plan))` once per researchable corpus-room leaf. 922 is the card line "N room artifacts already mention the zone". deep.cjs 1259 calls `quickMod.localRoomCheck` too, so it inherits the fix with no edit.
- Out of scope (366-14 owns it): outbound exact-phrase query composition (whitespace max_term_words 4). Do not touch families.cjs, whitespace-recall.cjs, question-templates.cjs or any composer.

tests/test-365-never-do-gate.cjs 507-572 N12
- 514 `RESEARCH_BASE = 'ee034f0a8...'`, with the comment at 511-513 "Any later edit to research_run's registration must re-pin this".
- The description and title leg is a real byte compare. The input-schema leg's `shape()` reads zod-3 `_def.typeName`, and the installed zod is 4.6.5, so it effectively compares top level only.

Test harness analogs (copy, do not import across tests):
- tests/test-363-mcp-tool.cjs 60-110: `boot()` through `registerCoreTools(stub, {fallbackRoomDir, pluginRoot, surface})`, and `client(room, sessionId)` with `call()` and `answer()` through the real gate_answer handler.
- tests/test-366-gated-term-release.cjs 29-66: the hermetic preamble. 92-139: a room with things carrying 'Bottleneck Hunt' / 'Zorp Method', then recall, `planWithPairA`, `writeRun`. 140-146: the HIT / MISS answer shapes (HIT canonical 'Reverse Salient Analysis' is in the snapshot). 231-243: the R4 audit-key check against `auditLedger.AUDIT_KEYS`.
- tests/fixtures/366-theo-replay/bottleneck-hunt.json: the replay doc shape (schema mos.theo-replay/1, a responses map).
- tests/test-366-egress-policy.cjs 77 `writeOverride(roomDir, body)` writes `<room>/.mindrian/egress-policy.json`; body form `{lines:{research:{default:false}}}`.
- tests/helpers/fixture-room-363.cjs `buildRoom363({role})`; tests/fixtures/363-question-sets/whitespace-quick.json (op plan, mode quick).
- tests/helpers/hygiene-355.cjs `installNetGuard`, `makeChecker`, `scrubVendorKey`; tests/helpers/fixture-366.cjs `buildPerspectiveRoom`.
- tests/helpers/mcp-wire-267.cjs `hermeticEnv`, `wireSnapshot`, `LOCAL_SERVER`.
- tests/fixtures/267/wire-snapshot-zod4.json: 2-space indent, trailing newline. `local.tools[]` entries are `{name, description, inputSchema}`. The last key, `refreshed_by`, is a string.

Evidence room (READ-ONLY, never modify): ~/MindrianRooms/egain-des-liquid-conductor
- Run rp-2026-10-01-c14921e5, leaf L3 ws:extraction_failure. The term was "gallium oxide choline chloride deep eutectic solvent" (7 words), and run.json local_checks says artifact_count 0.
- opportunity-bank/gap-oxide-stability-in-chcl-des.md is titled "Gap - gallium oxide stability in choline chloride DES". It holds 4 of the 7 tokens (gallium, oxide, choline, chloride).
- Planner measurement: the current check returns 0; strict-majority token coverage counts that file. Files holding 1-3 of the 7 tokens stay out.
- The 363 fixture room has zero partial token overlap with 'acoustic biofilm disruption' / 'ultrasonic biofilm removal'. So test-363-run-quick line 451 (artifact_count === 1) and test-363-acceptance-whitespace W1 (flagged false) are predicted to stay green.

Baseline at planning time (hermetic, node 22.23.1):
- 366 / seed tests: test-366-mcp-perspective-ops 9/0, test-366-gated-term-release 28/0, test-366-egress-policy 24/0, test-seed104-grant-family-loop 19/0.
- 363 tests: test-363-mcp-tool 15/0, test-363-run-quick 19/0, test-363-acceptance-whitespace 15/0.
- Tool and wire tests: test-365-never-do-gate 75/0, test-270-tool-schema-budget 5/0, test-267-mcpv2-dual-era PASS=5, test-234-tool-description-floor 192/0.
- Gates: `check-tool-honesty --check` exit 0, `build-connector-registry --check` exit 0.
</interfaces>

Planner decision record (Claude's discretion; restate each in the SUMMARY):
- DR-1, MCP release transport parity. The MCP door uses the SAME environment-chosen transport as the CLI, moved into `canonRelease.transportFromEnv`. Without MOS_366_THEO_REPLAY or MOS_366_LIVE=1, the MCP basket mints no release gate and answers live_not_enabled. Reason: the MCP door must never be a wider egress door than the CLI (Canon Part 8, one governed path), and the navigator approved live release under MOS_366_LIVE in 366-11. Making MCP release live by default would be a separate navigator ruling, and a one-line change to transportFromEnv's default.
- DR-2, canon items leave the filing gate. The F.8 filing gate carries only fileable items. Release offers ride their own gates; filing.basketCard already tells the navigator canon lines are "answered on its own card". canon_confirm items are listed with the CLI canon-confirm next step. An MCP confirm route is not in scope; record it as owed.
- DR-3, task order. Item 2 comes first, then item 1 with the one registration change, so the wire snapshot and the N12 pin move once.
- DR-4, token coverage rule. Content tokens are the NFKC-lowercased runs of letters and numbers with length >= 3 (or containing a digit), minus a closed English function-word list, deduped. An artifact counts for a term when the exact phrase is present (unchanged), or when the term has 2 or more content tokens and the artifact holds at least floor(n/2)+1 of them (strict majority). A single-token term keeps substring semantics.

Execution rules (shared tree with peer sessions; from CLAUDE.md, memory and sibling quick plans):
- Work only in /home/jsagi/dev/MindrianOS-Plugin. Put Node 22 on PATH: `export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH`.
- Every test run is hermetic. HOME and MINDRIAN_ROOMS_HOME point at temp dirs, and CLAUDE_ACTIVE_ROOM and CLAUDE_CODE_SESSION_ID are unset before any repo module loads. Add `env -u CLAUDE_ACTIVE_ROOM -u CLAUDE_CODE_SESSION_ID HOME=$T MINDRIAN_ROOMS_HOME=$T/rooms` to suite runs. New tests also delete MOS_366_LIVE and MOS_366_THEO_REPLAY at the top, and set them only inside the legs that need them.
- Commit with `git commit --only -- <owned paths>`. Stage a NEW file with `git add -- <that path>` first (`git add -f` for .planning paths). Never use git stash, git reset, git add -A or `gsd-tools query commit --files` (it sweeps the whole index). Never revert a diff you do not own. Do not touch STATE.md or ROADMAP.md, and run no gsd-tools state.* writers.
- Hyphens only: no em-dash or en-dash in any touched file. Canon Part 8 holds: no room text in any outbound string. The only egress added is the navigator-gated {raw: term}, which already exists on the CLI.
- If any MCP tool description or inputSchema changes, refresh that tool's entry in tests/fixtures/267/wire-snapshot-zod4.json in the SAME commit, using the live wire as the source.
- Registrations stay `server.registerTool` (v2 McpServer).
- End each commit message with the session's attribution trailer.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: MCP basket mints session-keyed release gates and routes the release through gate_answer (item 2)</name>
  <files>lib/core/research-planner/canon-release.cjs, scripts/research-planner.cjs, lib/mcp/tools/research.cjs, tests/test-366-mcp-release-route.cjs</files>
  <behavior>
    - C1: replay transport enabled, theo line on, session 'sess-cud-a'. op basket on RUN1 ('Bottleneck Hunt') returns ok, with exactly one release_offers entry for that term:
      - item_id matches canon_term:[0-9a-f]{12} and gate_id matches gate-[0-9a-f]{16};
      - card.shape is 'F.8' and the card option ids are exactly ['release','not_now'];
      - unavailable_reason is null;
      - neither the filing gate's rendered options nor `items` contain any canon_ id.
    - C1b: a session-less client (extra {} and no CLAUDE_CODE_SESSION_ID) also gets a release gate id from op basket.
    - C2: no gate answer yet, so zero theo/canon-translation audit rows exist.
    - C3: gate_answer(gate_id, ['release'], 'approve') from the same client returns resumed true. chain_result has ok true, executed true, sent {raw:'Bottleneck Hunt'}, guard.class 'navigator_released', outcome 'hit', proposed true and canon_name 'Reverse Salient Analysis'.
    - C4: exactly one theo/canon-translation audit row. Its keys equal auditLedger.AUDIT_KEYS; q is the term, grant_id is the gate id, part8_verdict is 'pass' and filters.transport is 'replay'.
    - C5: canon-translations.md has one PROPOSED row (ratified_at null) for the term. The next basket on RUN1 offers no release for that term and lists it under confirm_items with canon_name 'Reverse Salient Analysis' and a next_step naming canon-confirm.
    - C6: a second gate_answer on the C3 gate id returns ok false, reason unknown_or_expired_gate, and still only one audit row exists.
    - C7: a fresh basket on RUN2 ('Zorp Method'), then gate_answer(gate, ['not_now'], 'reject'), gives chain_result.executed false and zero new audit rows.
    - C8: a fresh basket on RUN2 from 'sess-cud-a', answered from client 'sess-cud-b' with release/approve, gives ok false and zero new audit rows.
    - C9: with MOS_366_THEO_REPLAY and MOS_366_LIVE both unset, the offer has gate_id null, unavailable_reason 'live_not_enabled' and a note carrying the hint; no audit row is written.
    - C10: replay set but the room override {lines:{theo:false}} is in place. The offer has gate_id null, unavailable_reason 'egress_line_off' and a note containing canonRelease.OFF_NOTE. The override is removed afterwards.
    - C11: transportFromEnv unit legs:
      - ({}) gives live_not_enabled;
      - ({MOS_366_LIVE:'1'}) gives ok, with deps.transport 'live' and no callTool;
      - a missing replay path gives replay_unreadable;
      - a valid replay doc's callTool resolves null for any tool other than normalize_framework_name, and null for a term absent from responses.
    - C12: the net guard counts 0 attempts, and research.cjs, canon-release.cjs and the test file contain no em-dash or en-dash.
  </behavior>
  <action>
Step 0, before any edit: record baselines into scratch notes for the SUMMARY.
- Run `bash tests/run-all-366.sh` and `bash tests/run-all-363.sh` hermetically and keep their PASSED/FAILED/SKIPPED/KNOWN lines. Known reds outside this plan: run-all-3551 drift and "no new dependency".
- Record the evidence-room mtime with `stat -c %Y ~/MindrianRooms/egain-des-liquid-conductor/opportunity-bank/gap-oxide-stability-in-chcl-des.md`.

RED: write tests/test-366-mcp-release-route.cjs with legs C1-C12 as in behavior.
- Hermetic preamble: copy test-366-gated-term-release 29-66 and also delete MOS_366_LIVE and MOS_366_THEO_REPLAY. Exit 77 with an ENV GAP line when node:sqlite is missing. Use the hygiene net guard and makeChecker('test-366-mcp-release-route').
- Room and runs: copy the gated test's 92-139 (buildPerspectiveRoom, insertNode BH1 and ZM1, recall, planWithPairA, writeRun for RUN1 and RUN2).
- MCP: copy test-363-mcp-tool's boot/client pattern with fallbackRoomDir set to the room, giving clients for 'sess-cud-a', 'sess-cud-b' and a session-less one.
- Replay file: write a temp file with schema mos.theo-replay/1 and responses {'Bottleneck Hunt': the HIT shape, 'Zorp Method': {}}. Set process.env.MOS_366_THEO_REPLAY to it only around the legs that need it.
- Run it, confirm it fails (no release_offers key today, and C11 fails because transportFromEnv does not exist), then commit only the test: `test(quick-261002-cud): failing MCP release-route legs C1-C12`.

GREEN, in this order:
- (a) canon-release.cjs: add and export `transportFromEnv(env)`.
  - env defaults to process.env and is read at call time.
  - Its behavior is the CLI's `canonTransport` exactly: the same three outcomes, the same reasons, the same hint text, and the same replay callTool semantics.
  - Add one docblock line saying both doors (CLI canon-release and MCP research_run basket) choose the release transport here, and nowhere else (Canon Part 7).
  - Do not change releaseTerm, mintReleaseGate, basketItemsFor, offerItemsFor or any existing export.
- (b) scripts/research-planner.cjs: `canonTransport()` becomes a one-line delegation, `require(path.join(RP, 'canon-release.cjs')).transportFromEnv(process.env)`. Keep its name and a shortened comment so canonDoor, argv parsing and output stay byte-identical in behavior (test-366-gated-term-release R8 and test-363-cli prove it).
- (c) research.cjs: require canon-release once at the top beside planner. In opBasket (per the 366-11 deferred item; the note says opFile, but the call is in opBasket):
  - Compute `transport = canonRelease.transportFromEnv(process.env)`.
  - Call `planner.basketFor(env.dir, runId, transport.ok ? { sessionId: gateLedger.ledgerSessionKey(env.sessionId), deps: transport.deps } : {})`. The ledger key makes a session-less stdio caller work: gate_answer consumes through the same ledgerSessionKey.
  - Split b.items with `canonRelease.isCanonItemId(it.id)` into fileItems (non-canon), releaseItems (kind canon_release) and confirmItems (kind canon_confirm), per DR-2.
  - The filing gate's options, its approving list and the `known` map use fileItems only, plus FILE_NOTHING. The response `items` maps fileItems exactly as today.
  - Add `release_offers`, always present (empty array when none). Each releaseItem becomes `{ item_id, term, gate_id (string or null), theo_on, card: cardView(canonRelease.releaseCard(it)), unavailable_reason, note }`.
    - unavailable_reason is null when gate_id is set. Otherwise it is 'egress_line_off' when !it.theo_on, else transport.reason when !transport.ok, else 'gate_not_minted'.
    - note is it.note, else transport.hint, else null.
  - Add `confirm_items`, always present. Each confirmItem becomes `{ item_id, term, canon_name, next_step }`. next_step is a plain sentence: confirming a proposed translation runs from Claude Code with the canon-confirm command of scripts/research-planner.cjs, and this surface does not confirm it yet.
  - When any offer carries a gate id, append this sentence to next_step: "Each release offer is its own decision: show its card, and when the navigator answers call gate_answer with that offer's gate_id, choosing release or not_now. A release sends the term only and files nothing."
  - Extend the header comment's Egress paragraph (34-36). A navigator-released canon term ({raw: term}) leaves only through canon-release, on its own single-use gate answered via gate_answer, and only with the theo egress line on and the release transport enabled. This tool still opens no wire itself.
- Do NOT change DESCRIPTION, inputSchema, OPS, title, annotations or connectors in this task (Task 2 owns the one registration change). Do NOT edit gate.cjs (N12 byte-identity), planner.cjs or filing.cjs.

Commit GREEN with `git commit --only` over the three source files: `fix(quick-261002-cud): MCP basket mints session-keyed release gates; release answered through gate_answer`.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH && T=$(mktemp -d) && mkdir -p $T/rooms && for t in test-366-mcp-release-route test-366-gated-term-release test-366-guard-navigator-release test-366-mcp-perspective-ops test-363-mcp-tool test-363-cli test-365-never-do-gate test-363-part8-sweep; do env -u CLAUDE_ACTIVE_ROOM -u CLAUDE_CODE_SESSION_ID -u MOS_366_LIVE -u MOS_366_THEO_REPLAY HOME=$T MINDRIAN_ROOMS_HOME=$T/rooms node tests/$t.cjs >/dev/null 2>&1 || echo "FAIL $t"; done; echo done</automated>
  </verify>
  <done>
- test-366-mcp-release-route passes C1-C12 with zero network attempts.
- test-366-gated-term-release stays 28/0 (the CLI R8 replay path works through the delegated transport).
- test-366-mcp-perspective-ops 9/0, test-363-mcp-tool 15/0 and test-365-never-do-gate 75/0 (no registration change yet).
- `grep -c "transportFromEnv" scripts/research-planner.cjs` is at least 1, and `grep -c "MOS_366_LIVE" scripts/research-planner.cjs` counts only comment or usage-text lines, never a second transport implementation.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: run_quick answers typed plan_only and takes offline over MCP; the one research_run registration change (item 1)</name>
  <files>lib/mcp/tools/research.cjs, tests/test-366-mcp-plan-only.cjs, tests/fixtures/267/wire-snapshot-zod4.json, tests/test-365-never-do-gate.cjs</files>
  <behavior>
    - P1: buildRoom363 room, op plan with question set whitespace-quick and mode quick, then the override {lines:{research:{default:false}}}. run_quick returns:
      - ok true, op 'run_quick', status 'plan_only', reason 'egress_line_off', line 'research', offline false, sent false;
      - outcome 'plan_only_not_sent', answer_line matching /not sent/i, card with a non-empty body_md;
      - a next_step naming .mindrian/egress-policy.json and the research line;
      - the raw MCP result has no isError, and the reason is never 'run_refused'.
    - P2: for the P1 run there are zero network attempts, no run.json under .mindrian/research-runs/<run_id>/, and no new rows in .mindrian/research-audit.jsonl.
    - P3: the override is removed and a fresh plan is built. run_quick with offline true returns status plan_only, offline true, line 'research', and a next_step saying offline was on.
    - P4: no override, offline absent, and no grant. run_quick returns the existing status 'reask' with a gate, so offline only narrows and the default path is unchanged.
    - P5: the captured cfg.inputSchema accepts {op:'run_quick', run_id, offline:true} and rejects offline:'yes'. cfg.description contains 'offline' and "canon-name lookup", is at most 2048 bytes, and contains neither 'Theo' nor any em-dash or en-dash.
    - P6: the research_run entry in tests/fixtures/267/wire-snapshot-zod4.json has inputSchema.properties.offline.type 'boolean', and its description equals cfg.description.
  </behavior>
  <action>
RED: write tests/test-366-mcp-plan-only.cjs with legs P1-P6.
- Hermetic preamble as in Task 1. Use the test-363-mcp-tool boot/client pattern over buildRoom363 rooms, and writeOverride as in test-366-egress-policy line 77.
- Run it and confirm it fails (P1 answers run_refused today), then commit only the test: `test(quick-261002-cud): failing MCP plan_only and offline legs P1-P6`.

GREEN in research.cjs (per 366-17's "Known follow-ups, MCP door"):
- (a) opRunQuick: call `quick.runQuick(env.dir, loaded.plan, { offline: env.input.offline === true })`. Only a strict boolean true turns offline on, and false never widens a room override, because loadEgressPolicy AND-merges.
- (b) Add a branch after the done branch and before reask. When `res.status === 'plan_only'`, return `{ ok: true, op: 'run_quick', status: 'plan_only', run_id: runId, reason: res.reason, line: res.line, offline: res.offline === true, sent: false, outcome: res.outcome, answer_line: res.answer_line, card: cardView(res.card), ignored: list(res.ignored), next_step }`.
  - When offline is true, next_step reads: "Nothing was sent: offline was on. The plan is intact; call op run_quick without offline to search."
  - Otherwise next_step reads: "Nothing was sent: the room egress policy (.mindrian/egress-policy.json) turns the <line> line off. The plan is intact. To search, turn that line back on in the room policy, then call op run_quick again." Here <line> is res.line, from the closed policy vocabulary, so no room text is echoed.
- (c) inputSchema: add `offline: z.boolean().optional().describe('run_quick only: true plans the run and sends nothing (every egress line off).')`.
- (d) DESCRIPTION: replace only its final sentence, "Nothing leaves the room except grant-approved search strings.", with exactly: "op run_quick takes offline true to answer with the plan only and send nothing. op basket can also list release offers: a room word that names no canon framework is sent, as the term only, to the Brain's canon-name lookup after its own gate_answer yes. Nothing else leaves the room except grant-approved search strings." Keep every other byte. This keeps the description honest about the Task 1 egress (Phase 276 tool honesty) without naming Theo.
- (e) Wire refresh, in the same commit. With a throwaway script in the session scratchpad (never committed):
  - require tests/helpers/mcp-wire-267.cjs and call `hermeticEnv({})`, then `wireSnapshot(LOCAL_SERVER, { env, capabilities: { elicitation: {} } })`, then cleanup;
  - take the live research_run entry, and in tests/fixtures/267/wire-snapshot-zod4.json replace ONLY that object's `description` and `inputSchema` inside local.tools;
  - append to the top-level `refreshed_by` string: "; quick 261002-cud 2026-10-02: research_run gains the offline field and two description sentences (offline, canon release), captured from the live wire";
  - write back with 2-space indent and a trailing newline;
  - `git diff --stat` on the fixture must show only that file, and `git diff` must touch only research_run's lines and refreshed_by.
- Commit GREEN with `git commit --only -- lib/mcp/tools/research.cjs tests/fixtures/267/wire-snapshot-zod4.json`: `fix(quick-261002-cud): research_run run_quick answers plan_only and takes offline; wire entry refreshed`. test-365 N12's description leg is red at this commit by design; the next commit re-pins it.

Re-pin, following the 366-12 precedent (commit 70123e935):
- Set RESEARCH_BASE in tests/test-365-never-do-gate.cjs (line 514) to the full 40-character SHA from `git log -1 --format=%H -- lib/mcp/tools/research.cjs`. It must equal the GREEN commit.
- Extend the comment at 511-513 with "quick 261002-cud re-pinned it for the offline field and the offline and canon-release description sentences".
- Commit only that file: `test(quick-261002-cud): re-pin research_run parity base in test-365 N12`.

Then run test-270-tool-schema-budget. It stays inside its 10 percent drift without moving the baseline. If it does not, stop and report the measured bytes rather than re-baselining.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH && T=$(mktemp -d) && mkdir -p $T/rooms && for t in test-366-mcp-plan-only test-366-mcp-release-route test-365-never-do-gate test-270-tool-schema-budget test-234-tool-description-floor test-366-mcp-perspective-ops test-363-mcp-tool test-366-egress-policy test-seed104-grant-family-loop test-seed103-eureka-perspective test-267-mcpv2-dual-era; do env -u CLAUDE_ACTIVE_ROOM -u CLAUDE_CODE_SESSION_ID -u MOS_366_LIVE -u MOS_366_THEO_REPLAY HOME=$T MINDRIAN_ROOMS_HOME=$T/rooms timeout 300 node tests/$t.cjs >/dev/null 2>&1 || echo "FAIL $t"; done; node scripts/check-tool-honesty.cjs --check >/dev/null 2>&1 || echo "FAIL honesty"; node scripts/build-connector-registry.cjs --check >/dev/null 2>&1 || echo "FAIL registry"; echo done</automated>
  </verify>
  <done>
- test-366-mcp-plan-only passes P1-P6.
- test-365-never-do-gate is back to 75/0 after the re-pin.
- test-267-mcpv2-dual-era PASS=5 (the live wire equals the refreshed snapshot).
- test-270, test-234, check-tool-honesty --check and build-connector-registry --check are green.
- The DESCRIPTION is at most 2048 bytes with no 'Theo' and no dash characters.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: room-only coverage check uses strict-majority content-token coverage (item 3, SEED-104 residual); register the three new tests</name>
  <files>lib/core/research-planner/quick.cjs, tests/test-seed104-room-check-tokens.cjs, tests/run-all-366.sh, .planning/seeds/SEED-104-research-grant-family-loop-eureka-plan-unfetchable.md</files>
  <behavior>
    - K1 (the regression, RED before the fix): a hermetic room has opportunity-bank/gap-oxide-stability.md with synthetic text. Its title line is "Gap - gallium oxide stability in choline chloride DES", and its body sentence uses none of deep, eutectic or solvent. `localRoomCheck(room, ['gallium oxide choline chloride deep eutectic solvent'])` returns flagged true, and the artifacts include {section:'opportunity-bank', path:'opportunity-bank/gap-oxide-stability.md'}. Before the fix it returns artifact_count 0, which reproduces the evidence-room false negative.
    - K2 (minority stays out): problem-definition/notes.md holds only oxide, choline and chloride (3 of 7) and is not in K1's artifacts.
    - K3 (exact phrase unchanged): market-analysis/field.md contains "acoustic biofilm disruption" and is counted for that term. The term 'zzz nothing matches this phrase' counts 0.
    - K4 (single-token term keeps substring semantics): the term 'biofilm' counts an artifact whose only mention is 'biofilms'.
    - K5 (function words never count): for the term 'stability of the oxide in the solvent' (content tokens stability, oxide, solvent; 2 needed), an artifact holding 'of the in the' and 'stability' only is not counted, and an artifact holding 'oxide' and 'solvent' is counted.
    - K6 (walk invariants unchanged): .mindrian/hidden.md holding the exact seven-word phrase is never counted, and a symlinked .md inside a section is skipped.
    - K7 (hygiene): zero network attempts. The return keys are exactly flagged, artifact_count, artifacts and terms_checked, and terms_checked equals the number of non-empty terms passed. quick.cjs and the test contain no em-dash or en-dash.
  </behavior>
  <action>
RED: write tests/test-seed104-room-check-tokens.cjs with legs K1-K7.
- The room is a mkdtemp directory built by hand: section folders opportunity-bank, problem-definition and market-analysis, plus .mindrian. localRoomCheck needs no room.db.
- Use synthetic wording only: never copy evidence-room text into the repo, which stays read-only.
- Use the hermetic preamble and net guard as in Task 1, with makeChecker('test-seed104-room-check-tokens').
- Confirm K1 fails today, then commit only the test: `test(quick-261002-cud): failing SEED-104 room-check token legs K1-K7`.

GREEN in quick.cjs only, per DR-4 and SEED-104 "room-only extraction check gives a false negative":
- Next to localRoomCheck, add a frozen `ROOM_CHECK_STOP` set holding a closed English function-word list: a, an, and, are, as, at, be, by, for, from, in, into, is, it, its, of, on, onto, or, over, per, than, that, the, their, these, this, those, to, under, via, was, were, with, within, without.
- Add `contentTokens(normalized)`. It splits on /[^\p{L}\p{N}]+/u, keeps tokens of length >= 3 or containing a digit, drops ROOM_CHECK_STOP, and dedupes in order.
- Inside localRoomCheck, turn each needle into { phrase (the normalized term as today), tokens: contentTokens(phrase), need }. need is floor(tokens.length / 2) + 1 when tokens.length >= 2, else null.
- An artifact counts when any needle's phrase is a substring of the normalized text (today's rule, kept first), or when need is not null and the artifact's token set holds at least need of that needle's tokens.
- Build each file's token set once, lazily, only when no phrase hit.
- Keep the return shape, caps, walk, dot-directory and symlink skips, terms_checked meaning, and the card line at about 922 unchanged.
- Update the comment above localRoomCheck: a long zone term rarely appears verbatim in the room, so keyword coverage (strict majority of content tokens) backs up the exact phrase. This is SEED-104's residual, and it is the D-03 extraction-failure falsifier.
- deep.cjs inherits the fix through quickMod.localRoomCheck; do not edit it. Do NOT touch outbound query composition: 366-14 already caps exact-phrase outbound terms at 4 words, and families.cjs, whitespace-recall.cjs and question-templates.cjs stay untouched.

Register the new tests in tests/run-all-366.sh:
- In block (2), right after the "366 gated term release" line, add `run_if "366 mcp release route"` for tests/test-366-mcp-release-route.cjs and `run_if "366 mcp plan only"` for tests/test-366-mcp-plan-only.cjs, using the same three-column form as the neighbours.
- In block (2b), after "seed104 grant family loop", add `run_if "seed104 room check tokens"` for tests/test-seed104-room-check-tokens.cjs.
- The dash pin already globs tests/test-366-*.cjs and tests/test-seed104-*.cjs, so no pin edit is needed.

Append a short section "## Quick 261002-cud (2026-10-02)" to the end of the SEED-104 seed file. Leave the frontmatter status as is. The section says:
- the room-only ws:extraction_failure false negative is fixed: localRoomCheck backs the exact phrase with strict-majority content-token coverage, and the regression is tests/test-seed104-room-check-tokens.cjs;
- the long exact-phrase OpenAlex zero was already handled by 366-14 (max_term_words 4) and is untouched here;
- the MCP release route and the MCP plan_only answer shipped in the same quick.

Commit GREEN with `git commit --only -- lib/core/research-planner/quick.cjs tests/run-all-366.sh .planning/seeds/SEED-104-research-grant-family-loop-eureka-plan-unfetchable.md`: `fix(quick-261002-cud): room-only coverage check counts strict-majority keyword coverage (SEED-104 residual)`.

Finally run the full gates:
- `bash tests/run-all-366.sh` hermetically must end FAILED=0.
- `bash tests/run-all-363.sh` must show no new FAILED against the Step 0 baseline.
- The evidence-room mtime must equal the Step 0 value.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH && T=$(mktemp -d) && mkdir -p $T/rooms && for t in test-seed104-room-check-tokens test-363-run-quick test-363-acceptance-whitespace test-366-recall-whitespace test-363-pyramid test-363-command-contract test-seed104-grant-family-loop test-366-egress-policy; do env -u CLAUDE_ACTIVE_ROOM -u CLAUDE_CODE_SESSION_ID -u MOS_366_LIVE -u MOS_366_THEO_REPLAY HOME=$T MINDRIAN_ROOMS_HOME=$T/rooms node tests/$t.cjs >/dev/null 2>&1 || echo "FAIL $t"; done; env -u CLAUDE_ACTIVE_ROOM -u CLAUDE_CODE_SESSION_ID HOME=$T MINDRIAN_ROOMS_HOME=$T/rooms bash tests/run-all-366.sh 2>&1 | tail -1</automated>
  </verify>
  <done>
- test-seed104-room-check-tokens passes K1-K7; K1 was red before the quick.cjs edit.
- test-363-run-quick 19/0 (line 451's artifact_count === 1 holds) and test-363-acceptance-whitespace 15/0 (W1 flagged false holds).
- run-all-366 ends FAILED=0 with the three new legs listed, and run-all-363 shows no new failure against the Step 0 baseline.
- The evidence room is untouched.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| room -> Brain (Theo normalize_framework_name) | A navigator-released room word crosses as {raw: term} only. It is new on the MCP door; it already exists on the CLI door. |
| MCP client session -> gate ledger | A gate_answer from any connected client reaches the in-process ledger; the session key decides who may consume a gate. |
| MCP input -> egress policy | The new offline flag is caller-supplied input that feeds loadEgressPolicy. |
| room files -> local coverage check | Room artifact text is read on this machine only, to decide whether a leaf is already covered. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-cud-01 | Information disclosure | research.cjs opBasket -> canon-release releaseTerm | mitigate | A gate is minted only when the theo line is on AND transportFromEnv is ok (replay, or MOS_366_LIVE=1), the same rule as the CLI (DR-1). Each gate is single-use and session-keyed. releaseTerm still runs the Part 8 guard with the receipt before the call and sends {raw: term} only (C3, C9, C10). |
| T-cud-02 | Elevation of privilege | MCP door vs CLI door | mitigate | One transport chooser, canonRelease.transportFromEnv, serves both doors. The CLI's canonTransport delegates to it, so the MCP door cannot send live while the CLI refuses (C11, test-366-gated-term-release R8). |
| T-cud-03 | Spoofing | gate_answer on a release gate from another session | mitigate | gate-ledger consumeGate compares ledgerSessionKey. A cross-session answer is refused and sends nothing (C8). The delete-before-session-check defect (a refused attempt destroys the owner's gate) is transferred to Phase 289 and named in the SUMMARY. |
| T-cud-04 | Tampering | run_quick offline flag | mitigate | Only a strict boolean true turns lines off. loadEgressPolicy AND-merges, so offline:false can never widen a room override (P3, P4). |
| T-cud-05 | Repudiation | a release over MCP | mitigate | releaseTerm writes one closed 23-key audit row with grant_id = the gate id and filters.transport, and gate_answer writes its ratification memory_event before the resume (C4). |
| T-cud-06 | Information disclosure | quick.cjs localRoomCheck token coverage | mitigate | It is fs-only and sends nothing. It never opens dot-directories or follows symlinks (K6). Terms and file text never leave the process, and the return carries section and relative path only. |
| T-cud-07 | Denial of service | token coverage per artifact | accept | The work is bounded by the existing ROOM_FILE_CAP 400, ROOM_FILE_BYTES 256 KB and ROOM_DEPTH_CAP 5. Each file's token set is built once and only when the phrase misses. |
| T-cud-08 | Information disclosure | research_run DESCRIPTION | mitigate | The description names the release honestly ("the term only", "after its own gate_answer yes") and names no backend internals or room data (P5). |
</threat_model>

<verification>
- The Step 0 baseline lines for run-all-366 and run-all-363 are recorded in the SUMMARY next to the post-fix lines.
- These all pass hermetically with zero network attempts:
  - the three new suites: `node tests/test-366-mcp-release-route.cjs`, `node tests/test-366-mcp-plan-only.cjs`, `node tests/test-seed104-room-check-tokens.cjs`;
  - test-366-mcp-perspective-ops, test-366-gated-term-release, test-366-egress-policy;
  - test-363-mcp-tool, test-seed104-grant-family-loop, test-365-never-do-gate.
- `node scripts/check-tool-honesty.cjs --check` exits 0, `node scripts/build-connector-registry.cjs --check` exits 0, and `node tests/test-270-tool-schema-budget.cjs` passes.
- `node tests/test-267-mcpv2-dual-era.cjs` reports PASS=5: the live research_run wire equals the refreshed snapshot entry.
- `bash tests/run-all-366.sh` ends FAILED=0. `bash tests/run-all-363.sh` has no new FAILED against Step 0.
- `git diff f7910ac1f -- lib/mcp/tools/gate.cjs lib/core/research-planner/planner.cjs lib/core/research-planner/filing.cjs lib/core/research-planner/families.cjs lib/core/research-planner/perspectives/whitespace-recall.cjs` is empty.
- No em-dash or en-dash appears in any file in files_modified. Check with `LC_ALL=C grep -lP "\xE2\x80\x94|\xE2\x80\x93"` over them; it prints nothing.
- The evidence room ~/MindrianRooms/egain-des-liquid-conductor is untouched (mtime equal to Step 0).
</verification>

<success_criteria>
- A Desktop or Cowork navigator gets a typed plan_only answer, never run_refused, when the room or the offline flag turns egress off.
- The same navigator can release one unresolved room word to the canon lookup through gate_answer, with the same consent, audit and transport rules as the CLI.
- A long zone term the room already names in other words no longer reads as "0 room artifacts mention the zone", and a minority overlap does not over-count.
- research_run's registration, wire snapshot and N12 pin each moved exactly once, and the release gate (run-all-366) is green.
</success_criteria>

<output>
Create `.planning/quick/261002-cud-366-gap-fixes-research-cjs-plan-only-ses/261002-cud-SUMMARY.md` when done, staged with `git add -f` and committed with `git commit --only`. It must include:
- DR-1 to DR-4 as decided, and the Step 0 vs final suite lines.
- The commit SHAs, including the GREEN SHA that RESEARCH_BASE now pins.
- The items now closed, for the executing Phase 366 session to strike in deferred-items.md and the 366-17 summary. This quick does NOT edit deferred-items.md: it is a phase file and peer-owned. The closed items are:
  - 366-11 "The MCP door does not mint release gates yet";
  - 366-17 "MCP door ... opRunQuick has no branch for plan_only ... cannot pass offline";
  - the SEED-104 room-only false negative.
- Owed follow-ups:
  - an MCP confirm route for canon_confirm items (today it is CLI canon-confirm only);
  - op grant_request on an egress-off plan still answers plan_not_ready with reason_detail egress_line_off;
  - the plan review card "overturn a line" affordance (366-17);
  - gate-ledger consume-before-session-check (Phase 289);
  - any navigator ruling to make the MCP release live by default (DR-1).
</output>
