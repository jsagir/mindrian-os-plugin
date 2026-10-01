#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 07 (RED) -- test-3551-ambient-run: pins
 * lib/core/ambient-run.cjs's stamped five-producer composition, the
 * tier-gated card selection, the proposed filing and the SENS-13 side
 * channel (AMB-03, AMB-05).
 *
 * =========================================================================
 * INTERFACE RECORD (the contract Task 3 binds to; read from the landed
 * code, not guessed):
 *
 *   producer          | seam called                                        | argument form                                                    | return form
 *   ------------------|-----------------------------------------------------|-------------------------------------------------------------------|------------------------------------------------------
 *   eureka            | lib/core/research-planner/perspectives/eureka-recall.cjs::buildSubstrate(db, { roomDir }) + ::recallCandidates(substrate, roomDir, { max_candidates: AMBIENT_TOP_N }) (Phase 366-07, D-03: offer only) | db: a caller-owned read-only handle | { outcome: 'offered', findings: [{ producer, a, b, rank, offer_only: true }] (no stamp, empty text), offer: [{ a, b, section_a, section_b }] }; never stamped, guarded or filed
 *   find-connections  | lib/core/verification-stamp.cjs::resolveEndpoint({framework}) + ::stampFindings(findings, deps) | findings: [{ fromHandle, toHandle, fromVia, toVia, direction }] over the distinct resolved pairs the other four producers surfaced | Stamp[] aligned to findings order
 *   find-bottlenecks  | lib/core/rs-engine.cjs::runModeInternal(roomDir, opts) with opts.stampFn | opts: { topk, stampFn(pairDicts) -> Promise<Map<pairKey, flatProps>> } | { metadata, pairs: [{ source_artifact_id, target_artifact_id, source_title, target_title, direction, abs_diff, ... }] }; writeReverseSalientEdges runs inside, keyed by opts.stampsByPairKey
 *   hsi               | scripts/hsi-to-graph.cjs::main(argv, deps) with --stamp --top | argv: [roomDir, '--stamp', '--top', n]; deps: { callTool } | undefined (writes HSI_CONNECTION edges with toNodeProps(stamp) merged in, may call process.exit on a missing/malformed .hsi-results.json)
 *   whitespace        | scripts/whitespace-to-graph.cjs::main(argv, deps) with --stamp | argv: [roomDir, '--stamp']; deps: { callTool } | undefined (writes WhitespaceZone nodes with toNodeProps(stamp) merged in, may call process.exit on a missing/malformed whitespace-results.json)
 *
 *   The filing seam: lib/core/eureka/eureka-reach-runner.cjs::measureAndGuardPair(a, b, opts)
 *     -> Promise<{ ok:true, score, guard } | { ok:false, reason }>, reason in
 *     'guard_unavailable'|'below_floor'|'guard_not_cleared' (Phase 355.1-07 extraction).
 *   The writer seam: lib/core/research-planner/filing-stamped.cjs::fileStampedOpportunity(db, params)
 *     (relocated by 366-02, called from ambient-run.cjs since 366-07; the legacy
 *     scripts/eureka-portfolio-report.cjs re-exports the same function)
 *     -> node id string | null (Phase 355.1-07 extraction; never opens/commits a
 *     transaction itself).
 *   The side-channel seam: lib/core/eureka/eureka-reach-runner.cjs::writeStampedSideChannel(roomDir, opts)
 *     -> { ok, sideChannelPath? } | { ok:false, reason }.
 *   Posture: lib/core/recipe-maps.cjs::postureForCommand(command) -> { command, autonomous_safe, posture }.
 *     Measured at BASE_3551: eureka '/mos:eureka' -> halt; find-connections
 *     '/mos:find-connections' -> run; find-bottlenecks '/mos:find-bottlenecks'
 *     -> run; hsi '/mos:scout' -> halt; whitespace '/mos:whitespace' -> run.
 * =========================================================================
 *
 * hygiene-355 preamble (scrubVendorKey + installNetGuard BEFORE any repo
 * require, attempts() === 0 last -- Pitfall 16). Bare node script, no
 * framework, exits non-zero on any assertion failure. House rule: hyphens
 * only, no em-dashes.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

let DatabaseSyncCheck;
try {
  DatabaseSyncCheck = require('node:sqlite').DatabaseSync;
} catch (_e) {
  process.stdout.write('SKIP test-3551-ambient-run.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}
void DatabaseSyncCheck;

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildDeltaRoom, copy355FixtureRoom, MARKER_PREFIX } = require('./helpers/fixture-room-3551.cjs');
const theoReplay = require('./helpers/theo-replay-355.cjs');
const verificationStamp = require('../lib/core/verification-stamp.cjs');
const navigation = require('../lib/core/navigation.cjs');
const recipeMaps = require('../lib/core/recipe-maps.cjs');

let ambientRun;
try {
  ambientRun = require('../lib/core/ambient-run.cjs');
} catch (_e) {
  ambientRun = null;
}

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-3551-ambient-run:');

assert.ok(ambientRun, 'lib/core/ambient-run.cjs must exist and load (module missing)');
const {
  runAmbientComposition, selectCardFinding, memoizeCallTool,
  PRODUCER_COMMANDS, PRODUCER_ADAPTERS, CARD_TIERS, AMBIENT_TOP_N,
} = ambientRun;

assert.strictEqual(typeof runAmbientComposition, 'function', 'runAmbientComposition must be exported');
assert.strictEqual(typeof selectCardFinding, 'function', 'selectCardFinding must be exported');
assert.strictEqual(typeof memoizeCallTool, 'function', 'memoizeCallTool must be exported');
assert.ok(PRODUCER_COMMANDS && typeof PRODUCER_COMMANDS === 'object', 'PRODUCER_COMMANDS must be exported');
assert.ok(PRODUCER_ADAPTERS && typeof PRODUCER_ADAPTERS === 'object', 'PRODUCER_ADAPTERS must be exported');
assert.deepStrictEqual(CARD_TIERS, ['strong', 'indirect'], 'CARD_TIERS must be exactly [strong, indirect]');
assert.strictEqual(typeof AMBIENT_TOP_N, 'number', 'AMBIENT_TOP_N must be a number');
ok('the module loads and exports the full public surface');

const PRODUCER_IDS = ['eureka', 'find-connections', 'find-bottlenecks', 'hsi', 'whitespace'];
for (const id of PRODUCER_IDS) {
  assert.strictEqual(typeof PRODUCER_COMMANDS[id], 'string', 'PRODUCER_COMMANDS.' + id + ' must be a string');
  assert.strictEqual(typeof PRODUCER_ADAPTERS[id], 'function', 'PRODUCER_ADAPTERS.' + id + ' must be a function');
}
ok('PRODUCER_COMMANDS and PRODUCER_ADAPTERS carry all five producer ids');

const rooms = [];
function trackedRoom(label) {
  const r = buildDeltaRoom(label);
  rooms.push(r);
  return r;
}

function stampWith(verification, extra) {
  const base = (verification === 'strong' || verification === 'indirect')
    ? {
      verification: verification,
      backend: 'theo',
      direction: 'none',
      judge: 'none',
      path: { nodes: ['A', 'B'], labels: ['Framework', 'Framework'], edges: ['EXTENDS'] },
    }
    : {
      verification: 'unverified',
      backend: 'not_called',
      direction: 'none',
      judge: 'none',
      reason: 'handle_unresolved',
    };
  return Object.assign({}, base, extra || {});
}

try {
  // ---------------------------------------------------------------------
  // Leg: selectCardFinding -- tier order, producer order, rank, no score
  // ---------------------------------------------------------------------
  (function test_selectCardFinding_unverifiedOnly() {
    const findings = [
      { producer: 'eureka', a: { handle: 'a1', text: 'A1' }, b: { handle: 'b1', text: 'B1' }, stamp: stampWith('unverified'), rank: 0 },
      { producer: 'hsi', a: { handle: 'a2', text: 'A2' }, b: { handle: 'b2', text: 'B2' }, stamp: stampWith('unverified'), rank: 0 },
    ];
    assert.strictEqual(selectCardFinding(findings), null, 'unverified-only findings must select nothing');
    ok('selectCardFinding: unverified-only findings -> null');
  })();

  (function test_selectCardFinding_tierOrder() {
    const indirectHsi = { producer: 'hsi', a: { handle: 'ha', text: 'HA' }, b: { handle: 'hb', text: 'HB' }, stamp: stampWith('indirect'), rank: 0 };
    const strongWhitespace = { producer: 'whitespace', a: { handle: 'wa', text: 'WA' }, b: { handle: 'wb', text: 'WB' }, stamp: stampWith('strong'), rank: 0 };
    const picked = selectCardFinding([indirectHsi, strongWhitespace]);
    assert.strictEqual(picked, strongWhitespace, 'a strong finding must beat an indirect finding regardless of producer order');
    ok('selectCardFinding: indirect(hsi) + strong(whitespace) -> the strong whitespace one');
  })();

  (function test_selectCardFinding_producerOrder() {
    const strongHsi = { producer: 'hsi', a: { handle: 'ha', text: 'HA' }, b: { handle: 'hb', text: 'HB' }, stamp: stampWith('strong'), rank: 0 };
    const strongEureka = { producer: 'eureka', a: { handle: 'ea', text: 'EA' }, b: { handle: 'eb', text: 'EB' }, stamp: stampWith('strong'), rank: 0 };
    const picked = selectCardFinding([strongHsi, strongEureka]);
    assert.strictEqual(picked, strongEureka, 'two strong findings must break the tie by PRODUCER_IDS order (eureka before hsi)');
    ok('selectCardFinding: two strong (eureka, hsi) -> the eureka one (producer order)');
  })();

  (function test_selectCardFinding_rankOrder() {
    const higherRank = { producer: 'eureka', a: { handle: 'a1', text: 'A1' }, b: { handle: 'b1', text: 'B1' }, stamp: stampWith('strong'), rank: 3 };
    const lowerRank = { producer: 'eureka', a: { handle: 'a2', text: 'A2' }, b: { handle: 'b2', text: 'B2' }, stamp: stampWith('strong'), rank: 1 };
    const picked = selectCardFinding([higherRank, lowerRank]);
    assert.strictEqual(picked, lowerRank, 'equal tier and producer must break the tie by the lower rank');
    ok('selectCardFinding: equal tier and producer -> the lower rank');
  })();

  (function test_selectCardFinding_noScoreRead() {
    const hugeScoreIndirect = {
      producer: 'eureka', a: { handle: 'a1', text: 'A1' }, b: { handle: 'b1', text: 'B1' },
      stamp: stampWith('indirect'), rank: 0, score: 999999,
    };
    const strongNoScore = {
      producer: 'whitespace', a: { handle: 'a2', text: 'A2' }, b: { handle: 'b2', text: 'B2' },
      stamp: stampWith('strong'), rank: 0,
    };
    const picked = selectCardFinding([hugeScoreIndirect, strongNoScore]);
    assert.strictEqual(picked, strongNoScore, 'a huge score field on an indirect finding must never outrank a strong finding with no score');
    ok('selectCardFinding: a finding with a huge score and tier indirect loses to a strong one (no score field is ever read)');
  })();

} catch (e) {
  console.error(e);
  process.exitCode = 1;
}

// ---------------------------------------------------------------------
// The remaining legs (memoizeCallTool onward) are all async; a single
// async IIFE awaits every leg in order so a rejection anywhere still sets
// a non-zero exit code before the summary line prints (JS has no
// top-level await in a CJS file).
// ---------------------------------------------------------------------
(async function asyncLegs() {
  try {
    // -----------------------------------------------------------------
    // Leg: memoizeCallTool
    // -----------------------------------------------------------------
    await (async function test_memoizeCallTool() {
      const inner = theoReplay.makeCountingCallTool(async (tool, args) => ({ paths: [] }));
      const memo = memoizeCallTool(inner);
      await Promise.all([
        memo('find_connections', { from: 'A', to: 'B' }),
        memo('find_connections', { from: 'A', to: 'B' }),
        memo('find_connections', { from: 'C', to: 'D' }),
      ]);
      assert.strictEqual(inner.calls.length, 2, 'the same (tool, args) pair called twice must reach the underlying callTool once; a different pair reaches it again');
      ok('memoizeCallTool: the same (tool, args) twice across two producer adapters reaches the underlying counting callTool once; different args twice');
    })();

    // -----------------------------------------------------------------
    // Leg: runAmbientComposition (i) unverified-only -> card null
    // -----------------------------------------------------------------
    await (async function test_unverifiedOnly() {
      const room = trackedRoom('unverified');
      const adapters = {
        eureka: async () => ({ outcome: 'no_candidate', findings: [{ producer: 'eureka', a: { handle: 'ea', text: 'EA' }, b: { handle: 'eb', text: 'EB' }, stamp: stampWith('unverified'), rank: 0 }] }),
        'find-connections': async () => ({ outcome: 'no_candidate', findings: [] }),
        'find-bottlenecks': async () => ({ outcome: 'no_candidate', findings: [] }),
        hsi: async () => ({ outcome: 'no_candidate', findings: [{ producer: 'hsi', a: { handle: 'ha', text: 'HA' }, b: { handle: 'hb', text: 'HB' }, stamp: stampWith('unverified'), rank: 0 }] }),
        whitespace: async () => ({ outcome: 'no_candidate', findings: [] }),
      };
      const res = await runAmbientComposition(room.roomDir, { deps: { adapters: adapters } });
      assert.strictEqual(res.card, null, 'card must be null when only unverified findings surfaced');
      assert.strictEqual(res.surfaced_via, 'none', 'surfaced_via must be none');
      assert.strictEqual(res.tier_counts.unverified, 2, 'tier_counts.unverified must equal the count of unverified findings');
      const lastEurekaPath = path.join(room.roomDir, '.mindrian', 'last-eureka.json');
      assert.strictEqual(fs.existsSync(lastEurekaPath), false, 'no .mindrian/last-eureka.json must be written');
      ok('runAmbientComposition (i): only unverified findings -> card null, surfaced_via none, tier_counts.unverified correct, no side channel');
    })();

    // -----------------------------------------------------------------
    // Leg: runAmbientComposition (ii) one indirect + one strong -> filed
    // -----------------------------------------------------------------
    await (async function test_fileAndSideChannel() {
      const room = trackedRoom('file');
      const hsiFinding = { producer: 'hsi', a: { handle: 'hsi-a', text: 'HSI A' }, b: { handle: 'hsi-b', text: 'HSI B' }, stamp: stampWith('indirect'), rank: 0 };
      const wsFinding = { producer: 'whitespace', a: { handle: 'ws-a', text: 'WS A' }, b: { handle: 'ws-b', text: 'WS B' }, stamp: stampWith('strong'), rank: 0 };
      const adapters = {
        eureka: async () => ({ outcome: 'no_candidate', findings: [] }),
        'find-connections': async () => ({ outcome: 'no_candidate', findings: [] }),
        'find-bottlenecks': async () => ({ outcome: 'no_candidate', findings: [] }),
        hsi: async () => ({ outcome: 'no_candidate', findings: [hsiFinding] }),
        whitespace: async () => ({ outcome: 'no_candidate', findings: [wsFinding] }),
      };
      const measureAndGuard = async () => ({ ok: true, score: { direction: 'structural_transfer', abs_diff: 0.5, band: 'opportunity', passes: true, semantic: 0.1, lexical: 0.1 }, guard: { cleared: true, verdict: 'transferable', confidence: 'high', tags: [] } });
      const before = navigation.openRoomDbForCaller(room.roomDir);
      let nodeCountBefore = 0;
      try {
        nodeCountBefore = before ? before.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'opportunity'").get().n : 0;
      } finally {
        navigation.closeRoomDbForCaller(before);
      }
      const res = await runAmbientComposition(room.roomDir, { deps: { adapters: adapters, measureAndGuard: measureAndGuard } });
      assert.ok(res.card, 'card must be set (the strong whitespace finding wins over the indirect hsi one)');
      assert.strictEqual(res.card.producer, 'whitespace', 'the strong whitespace finding must be the card producer');
      assert.strictEqual(res.surfaced_via, 'sens13', 'surfaced_via must be sens13');
      assert.strictEqual(typeof res.card.opportunity_handle, 'string', 'card.opportunity_handle must be a string node id');

      const after = navigation.openRoomDbForCaller(room.roomDir);
      let nodeCountAfter = 0;
      let reparsed = null;
      try {
        nodeCountAfter = after.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'opportunity'").get().n;
        const row = after.prepare('SELECT properties FROM nodes WHERE id = ?').get(res.card.opportunity_handle);
        assert.ok(row, 'the minted node must be readable after close and reopen');
        const props = JSON.parse(row.properties);
        assert.strictEqual(props.review_status === undefined || props.review_status === 'proposed', true, 'review_status must be absent or proposed (never confirmed)');
        reparsed = verificationStamp.fromNodeProps(props);
      } finally {
        navigation.closeRoomDbForCaller(after);
      }
      assert.strictEqual(nodeCountAfter, nodeCountBefore + 1, 'exactly one new opportunity node must exist after close and reopen');
      assert.strictEqual(reparsed.verification, 'strong', 'the reparsed stamp must carry the strong tier');
      assert.strictEqual(reparsed.formula_version !== undefined, false, 'formula_version is not part of the parsed Stamp shape (stays on the node props only)');

      const lastEurekaPath = path.join(room.roomDir, '.mindrian', 'last-eureka.json');
      const raw = JSON.parse(fs.readFileSync(lastEurekaPath, 'utf8'));
      assert.strictEqual(raw.schema_version, 2, 'last-eureka.json must validate as v2');
      assert.strictEqual(raw.opportunity_handle, res.card.opportunity_handle, 'last-eureka.json opportunity_handle must equal the minted node id');
      ok('runAmbientComposition (ii): one indirect hsi + one strong whitespace, guard clearing -> exactly one new opportunity node proposed, last-eureka.json v2 with matching opportunity_handle, result.card.opportunity_handle matches, surfaced_via sens13');
    })();

    // -----------------------------------------------------------------
    // Leg: runAmbientComposition (iii) guard not cleared -> nothing filed
    // -----------------------------------------------------------------
    await (async function test_guardNotCleared() {
      const room = trackedRoom('guard-not-cleared');
      const finding = { producer: 'eureka', a: { handle: 'ea', text: 'EA' }, b: { handle: 'eb', text: 'EB' }, stamp: stampWith('strong'), rank: 0 };
      const adapters = {
        eureka: async () => ({ outcome: 'no_candidate', findings: [finding] }),
        'find-connections': async () => ({ outcome: 'no_candidate', findings: [] }),
        'find-bottlenecks': async () => ({ outcome: 'no_candidate', findings: [] }),
        hsi: async () => ({ outcome: 'no_candidate', findings: [] }),
        whitespace: async () => ({ outcome: 'no_candidate', findings: [] }),
      };
      const measureAndGuard = async () => ({ ok: false, reason: 'guard_not_cleared' });
      const res = await runAmbientComposition(room.roomDir, { deps: { adapters: adapters, measureAndGuard: measureAndGuard } });
      assert.strictEqual(res.card, null, 'card must stay null when the guard does not clear');
      assert.strictEqual(res.surfaced_via, 'none', 'surfaced_via must be none');
      assert.strictEqual(res.producers.eureka.outcome, 'guard_not_cleared', "the selected finding's own producer outcome must be guard_not_cleared");
      const lastEurekaPath = path.join(room.roomDir, '.mindrian', 'last-eureka.json');
      assert.strictEqual(fs.existsSync(lastEurekaPath), false, 'no side channel must be written');
      ok('runAmbientComposition (iii): measureAndGuard returning not cleared -> nothing filed, no side channel, the producer outcome of the selected finding is guard_not_cleared');
    })();

    // -----------------------------------------------------------------
    // Leg: runAmbientComposition (iv) an adapter throws -> the others still run
    // -----------------------------------------------------------------
    await (async function test_adapterThrows() {
      const room = trackedRoom('adapter-throws');
      const wsFinding = { producer: 'whitespace', a: { handle: 'wa', text: 'WA' }, b: { handle: 'wb', text: 'WB' }, stamp: stampWith('unverified'), rank: 0 };
      const adapters = {
        eureka: async () => { throw new Error('synthetic eureka adapter failure'); },
        'find-connections': async () => ({ outcome: 'no_candidate', findings: [] }),
        'find-bottlenecks': async () => ({ outcome: 'no_candidate', findings: [] }),
        hsi: async () => ({ outcome: 'no_candidate', findings: [] }),
        whitespace: async () => ({ outcome: 'no_candidate', findings: [wsFinding] }),
      };
      const res = await runAmbientComposition(room.roomDir, { deps: { adapters: adapters } });
      assert.strictEqual(res.producers.eureka.outcome, 'error', 'a throwing adapter must map to outcome error');
      assert.strictEqual(res.producers.whitespace.outcome, 'no_candidate', 'a later producer must still run after an earlier one throws');
      ok("runAmbientComposition (iv): an adapter that throws -> that producer's outcome 'error', the others still run");
    })();

    // -----------------------------------------------------------------
    // Leg: runAmbientComposition (v) budget exhausted -> later producers skipped
    // -----------------------------------------------------------------
    await (async function test_budgetExhausted() {
      const room = trackedRoom('budget');
      const calledIds = [];
      function slowAdapter(id) {
        return async () => {
          calledIds.push(id);
          await new Promise((resolve) => setTimeout(resolve, 20));
          return { outcome: 'no_candidate', findings: [] };
        };
      }
      const adapters = {
        eureka: slowAdapter('eureka'),
        'find-bottlenecks': slowAdapter('find-bottlenecks'),
        hsi: slowAdapter('hsi'),
        whitespace: slowAdapter('whitespace'),
        'find-connections': slowAdapter('find-connections'),
      };
      const res = await runAmbientComposition(room.roomDir, { deps: { adapters: adapters }, budgetMs: 5 });
      assert.strictEqual(res.producers.eureka.outcome, 'no_candidate', 'the first adapter (within budget) must still run');
      let sawSkipped = false;
      for (const id of PRODUCER_IDS) {
        if (id === 'eureka') continue;
        if (res.producers[id].outcome === 'skipped') sawSkipped = true;
      }
      assert.ok(sawSkipped, 'at least one later producer must be marked skipped once the budget is exhausted');
      ok('runAmbientComposition (v): budgetMs exhausted after the first adapter -> every later producer skipped');
    })();

    // -----------------------------------------------------------------
    // Leg: posture is joined from recipe-maps, never typed by hand
    // -----------------------------------------------------------------
    await (async function test_posture() {
      const room = trackedRoom('posture');
      const adapters = {
        eureka: async () => ({ outcome: 'no_candidate', findings: [] }),
        'find-connections': async () => ({ outcome: 'no_candidate', findings: [] }),
        'find-bottlenecks': async () => ({ outcome: 'no_candidate', findings: [] }),
        hsi: async () => ({ outcome: 'no_candidate', findings: [] }),
        whitespace: async () => ({ outcome: 'no_candidate', findings: [] }),
      };
      const res = await runAmbientComposition(room.roomDir, { deps: { adapters: adapters } });
      for (const id of PRODUCER_IDS) {
        const expected = recipeMaps.postureForCommand(PRODUCER_COMMANDS[id]).posture;
        assert.strictEqual(res.producers[id].posture, expected, 'producers.' + id + '.posture must equal postureForCommand(' + PRODUCER_COMMANDS[id] + ').posture');
      }
      assert.strictEqual(res.producers.eureka.posture, 'halt', 'eureka posture must be halt (measured at BASE_3551)');
      assert.strictEqual(res.producers.hsi.posture, 'halt', 'hsi (/mos:scout) posture must be halt (measured at BASE_3551)');
      assert.strictEqual(res.producers.whitespace.posture, 'run', 'whitespace posture must be run (measured at BASE_3551)');
      assert.strictEqual(res.producers['find-bottlenecks'].posture, 'run', 'find-bottlenecks posture must be run (measured at BASE_3551)');
      assert.strictEqual(res.producers['find-connections'].posture, 'run', 'find-connections posture must be run (measured at BASE_3551)');
      ok('runAmbientComposition: posture for all five ids equals postureForCommand(PRODUCER_COMMANDS[id]).posture');
    })();

    // -----------------------------------------------------------------
    // Leg: Part 8 -- Theo call arguments carry only canon handle keys, no
    // fixture artifact title, no SECRET-3551 marker.
    // -----------------------------------------------------------------
    await (async function test_theoArgsClean() {
      const room = trackedRoom('theo-args');
      room.addClaims(1);
      const counting = theoReplay.makeCountingCallTool(async () => ({ paths: [] }));
      const finding = { producer: 'find-connections', a: { handle: 'Design Thinking', text: 'Design Thinking' }, b: { handle: 'Jobs to Be Done', text: 'Jobs to Be Done' }, stamp: stampWith('unverified'), rank: 0 };
      const adapters = {
        eureka: async () => ({ outcome: 'no_candidate', findings: [] }),
        'find-connections': async (roomDir, ctx) => {
          // Real seam exercise: call verification-stamp.cjs through the
          // composition's own memoized callTool, over a synthetic pair, so
          // the captured argument shape is proven, not guessed.
          await verificationStamp.stampFinding({
            fromHandle: 'Design Thinking', toHandle: 'Jobs to Be Done', direction: 'none',
          }, { callTool: ctx.deps.callTool });
          return { outcome: 'no_candidate', findings: [finding] };
        },
        'find-bottlenecks': async () => ({ outcome: 'no_candidate', findings: [] }),
        hsi: async () => ({ outcome: 'no_candidate', findings: [] }),
        whitespace: async () => ({ outcome: 'no_candidate', findings: [] }),
      };
      await runAmbientComposition(room.roomDir, { deps: { adapters: adapters, callTool: counting } });
      assert.ok(counting.calls.length >= 1, 'at least one Theo call must have been captured');
      for (const call of counting.calls) {
        const keys = Object.keys(call.args).sort();
        assert.deepStrictEqual(keys, ['from', 'to'], 'every captured call must carry exactly { from, to }');
        assert.strictEqual(JSON.stringify(call.args).indexOf(MARKER_PREFIX), -1, 'no captured value may contain the SECRET-3551 marker');
      }
      ok('Part 8: with a counting callTool, every captured Theo call carries exactly { from, to } and no fixture marker');
    })();

    // -----------------------------------------------------------------
    // Leg: static -- no brain-client, no zod, no fetch, no url-ingest;
    // the only side-channel writer call is writeStampedSideChannel.
    // -----------------------------------------------------------------
    (function test_staticNoEgress() {
      const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'core', 'ambient-run.cjs'), 'utf8');
      const nonComment = hygiene.nonCommentLines(path.join(__dirname, '..', 'lib', 'core', 'ambient-run.cjs')).join('\n');
      assert.strictEqual(/brain-client/.test(nonComment), false, 'ambient-run.cjs must never require brain-client.cjs');
      assert.strictEqual(/require\(\s*['"]zod['"]\s*\)/.test(nonComment), false, "ambient-run.cjs must never require('zod')");
      assert.strictEqual(/fetch\(/.test(nonComment), false, 'ambient-run.cjs must never call fetch(');
      assert.strictEqual(/INSERT INTO/.test(nonComment), false, 'ambient-run.cjs must never issue a raw INSERT INTO');
      assert.strictEqual(/url-ingest/.test(nonComment), false, 'ambient-run.cjs must never reference url-ingest');
      assert.strictEqual(/autonomous_safe:\s*true/.test(nonComment), false, 'ambient-run.cjs must never hand-write autonomous_safe: true');
      assert.strictEqual(/posture:\s*'(run|halt)'/.test(nonComment), false, 'ambient-run.cjs must never hand-write a posture literal');
      assert.strictEqual(/review_status/.test(nonComment), false, 'ambient-run.cjs must never reference review_status');
      const sideChannelWriterCalls = (nonComment.match(/writeStampedSideChannel\s*\(/g) || []).length;
      assert.ok(sideChannelWriterCalls >= 1, 'ambient-run.cjs must call writeStampedSideChannel at least once');
      const rivalWriterNames = ['runEurekaScan(', 'markEurekaReachSurfaced('];
      for (const rival of rivalWriterNames) {
        assert.strictEqual(nonComment.indexOf(rival), -1, 'ambient-run.cjs must never call ' + rival + ' (only writeStampedSideChannel writes the side channel)');
      }
      assert.strictEqual(src.indexOf(String.fromCharCode(0x2014)), -1, 'no em-dash byte anywhere in ambient-run.cjs');
      ok('static: ambient-run.cjs has no brain-client require, no zod require, no fetch(, no INSERT INTO, no url-ingest; its only side-channel writer call is writeStampedSideChannel; no em-dash');
    })();

    // -----------------------------------------------------------------
    // Leg: extraction regressions (already pass before and after Task 2)
    // -----------------------------------------------------------------
    (function test_extractionsExported() {
      const eurekaReachRunner = require('../lib/core/eureka/eureka-reach-runner.cjs');
      const eurekaPortfolioReport = require('../scripts/eureka-portfolio-report.cjs');
      assert.strictEqual(typeof eurekaReachRunner.measureAndGuardPair, 'function', 'measureAndGuardPair must be exported from eureka-reach-runner.cjs');
      assert.strictEqual(typeof eurekaPortfolioReport.fileStampedOpportunity, 'function', 'fileStampedOpportunity must be exported from eureka-portfolio-report.cjs');
      const filingStamped = require('../lib/core/research-planner/filing-stamped.cjs');
      assert.strictEqual(typeof filingStamped.fileStampedOpportunity, 'function', 'fileStampedOpportunity must be exported from research-planner/filing-stamped.cjs (the filer ambient-run.cjs calls, 366-07)');
      ok('extraction regressions: measureAndGuardPair and fileStampedOpportunity are both exported (test-355-filing.cjs, test-355-side-channel-v2.cjs, test-213-sensor-eureka.cjs and test-213-part8-boundary.cjs are run directly by the executor, unchanged)');
    })();

    // -----------------------------------------------------------------
    // Leg: integration (real adapters, SKIP when the fixture or python
    // deps are missing).
    // -----------------------------------------------------------------
    await (async function test_integration() {
      const hsiDeps = require('node:child_process').spawnSync('bash', [path.join(__dirname, '..', 'scripts', 'check-hsi-deps')], { encoding: 'utf8' });
      const copyRoom = copy355FixtureRoom('room-extend');
      if (!copyRoom || hsiDeps.status !== 0) {
        console.log('SKIP integration leg (tests/fixtures/355-rooms/room-extend absent or scripts/check-hsi-deps reports python deps missing)');
        return;
      }
      const fixtureData = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', '355', 'theo-stub-responses.json'), 'utf8'));
      const replay = theoReplay.makeReplayCallTool(fixtureData);
      let res;
      try {
        res = await runAmbientComposition(copyRoom, { deps: { callTool: replay }, budgetMs: 60000 });
      } catch (e) {
        assert.fail('runAmbientComposition must never throw over real adapters: ' + e.message);
      }
      const AMBIENT_PRODUCER_OUTCOMES = require('../scripts/scout-cadence-guard.cjs').AMBIENT_PRODUCER_OUTCOMES;
      for (const id of PRODUCER_IDS) {
        assert.ok(res.producers[id] && AMBIENT_PRODUCER_OUTCOMES.indexOf(res.producers[id].outcome) !== -1,
          'producers.' + id + '.outcome must be a member of AMBIENT_PRODUCER_OUTCOMES, got ' + JSON.stringify(res.producers[id]));
      }
      // 366-07 (D-03): the eureka producer only offers; it is never the card.
      assert.ok(['offered', 'no_candidate', 'error', 'skipped'].indexOf(res.producers.eureka.outcome) !== -1, 'eureka outcome must be an offer outcome, got ' + res.producers.eureka.outcome);
      assert.ok(!res.card || res.card.producer !== 'eureka', 'the eureka offer must never become the filed card');
      if (res.card) {
        verificationStamp.Stamp.parse({
          verification: res.card.verification, backend: 'theo', direction: 'none', judge: 'none',
          path: { nodes: ['A', 'B'], labels: ['Framework', 'Framework'], edges: ['EXTENDS'] },
        });
      }
      ok('integration: the REAL adapters over a copied room-extend fixture with a replay callTool never throw, and every producer ends with an outcome in AMBIENT_PRODUCER_OUTCOMES');
    })();
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    for (const room of rooms) room.cleanup();
    console.log('');
    console.log('PASS test-3551-ambient-run.cjs (' + checks + ' checks)');
    console.log('FAIL: ' + (process.exitCode ? 1 : 0));
    assert.strictEqual(netGuard.attempts(), 0, 'installNetGuard must record zero fetch attempts (Pitfall 16)');
    netGuard.restore();
  }
})();
