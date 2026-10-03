'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 AMB-03 / AMB-05: the stamped five-producer composition the
 * ONE background child runs. Not a spawner, not a sensor. Ruling 3:
 * producers are called through their library seams (eureka and scout
 * resolve halt; every write here is proposed-only); posture is joined from
 * recipe-maps and recorded, never typed. Only strong and indirect stamps
 * can reach the card; the reward is the tier, never a score. Theo is
 * reached only through verification-stamp.cjs (Part 8). Research C11:
 * find-connections stamps only pairs the other producers surfaced. D-06: no
 * url-ingest crawl; Theo work capped at AMBIENT_TOP_N per producer. Hyphens
 * only.
 *
 * Nothing calls this module live yet (355.1-09, after the checkpoint).
 *
 * EXECUTION ORDER (Claude's discretion, documented): the composition scores
 * the four pair-producing producers first (eureka, find-bottlenecks, hsi,
 * whitespace), THEN find-connections, because find-connections' own
 * default adapter stamps the distinct endpoint pairs the other four
 * surfaced (CONTEXT.md "Research C11"). AMBIENT_PRODUCER_IDS (imported from
 * scout-cadence-guard.cjs) stays the canonical producer SET and the
 * card-selection tie-break order; it is not read as an execution sequence.
 */

const path = require('node:path');

const recipeMaps = require('./recipe-maps.cjs');
const scoutCadenceGuard = require('../../scripts/scout-cadence-guard.cjs');
const eurekaReachRunner = require('./eureka/eureka-reach-runner.cjs');
const verificationStamp = require('./verification-stamp.cjs');
const directionConvention = require('./direction-convention.cjs');

const { AMBIENT_PRODUCER_IDS, AMBIENT_PRODUCER_OUTCOMES } = scoutCadenceGuard;
const { measureAndGuardPair, writeStampedSideChannel } = eurekaReachRunner;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRODUCER_COMMANDS = Object.freeze({
  eureka: '/mos:eureka',
  'find-connections': '/mos:find-connections',
  'find-bottlenecks': '/mos:find-bottlenecks',
  hsi: '/mos:scout',
  whitespace: '/mos:whitespace',
});

const CARD_TIERS = Object.freeze(['strong', 'indirect']);

// 355-16's own default --top value (scripts/hsi-to-graph.cjs's `let topN =
// 10;`, the sole 355-16 producer that exports a --top flag at all); no
// decimal, an integer, disclosed against data/floor-ledger.json's existing
// rs-engine.DEFAULT_THRESHOLD-style precedent is not needed here since this
// is an integer count, not a score floor.
const AMBIENT_TOP_N = 10;

// A generous per-run default; opts.budgetMs overrides it. Bounded well
// under the ambient child's own multi-minute budget (355.1-BASELINE.md).
const DEFAULT_BUDGET_MS = 60000;

// Phase 355.1-09 (AMB-03): the ambient CHILD's own total wall-clock budget
// (distinct from DEFAULT_BUDGET_MS above, runAmbientComposition's own
// internal per-run default). Derived from 355.1-BASELINE.md's "Measured
// Phase 117 child runtime" (research's conservative recorded max of 166s,
// not the narrower fresh-sample max that baseline documents as known to
// undercount the tail) plus headroom for Theo stamping.
// scripts/scout-cadence-guard.cjs's AMBIENT_LOCK_STALE_MS (8 minutes) is
// exactly twice this value by design (355.1-05's own derivation comment).
const AMBIENT_TOTAL_BUDGET_MS = 4 * 60 * 1000;

// Execution order (see header note above): the four pair producers, then
// find-connections last (it consumes their resolved endpoint pairs).
const EXEC_ORDER = Object.freeze(['eureka', 'find-bottlenecks', 'hsi', 'whitespace', 'find-connections']);

// ---------------------------------------------------------------------------
// memoizeCallTool: a run-scoped memo (THEO RULE 3, D-12: no cross-run
// cache). Keyed on JSON.stringify([tool, args]) so two producer adapters
// asking the SAME pair share one underlying call.
// ---------------------------------------------------------------------------
function memoizeCallTool(callTool) {
  const memo = new Map();
  return function memoizedCallTool(tool, args) {
    const key = JSON.stringify([tool, args]);
    if (memo.has(key)) return memo.get(key);
    const p = Promise.resolve().then(function () { return callTool(tool, args); });
    memo.set(key, p);
    return p;
  };
}

// ---------------------------------------------------------------------------
// selectCardFinding: tier order (strong before indirect), then producer
// order (AMBIENT_PRODUCER_IDS), then the producer's own rank. Never reads a
// score field.
// ---------------------------------------------------------------------------
function selectCardFinding(findings) {
  const list = Array.isArray(findings) ? findings : [];
  let best = null;
  let bestTierIdx = Infinity;
  let bestProducerIdx = Infinity;
  let bestRank = Infinity;
  for (const f of list) {
    // 366-07 (D-03): an offer_only finding (the ambient eureka offer) is never
    // the card, so it is never guarded, filed or written to the side channel.
    if (!f || f.offer_only === true || !f.stamp) continue;
    const tierIdx = CARD_TIERS.indexOf(f.stamp.verification);
    if (tierIdx === -1) continue;
    const producerIdx = AMBIENT_PRODUCER_IDS.indexOf(f.producer);
    const pIdx = producerIdx === -1 ? Infinity : producerIdx;
    const rank = (typeof f.rank === 'number' && Number.isFinite(f.rank)) ? f.rank : Infinity;
    const better = (tierIdx < bestTierIdx)
      || (tierIdx === bestTierIdx && pIdx < bestProducerIdx)
      || (tierIdx === bestTierIdx && pIdx === bestProducerIdx && rank < bestRank);
    if (better) {
      best = f;
      bestTierIdx = tierIdx;
      bestProducerIdx = pIdx;
      bestRank = rank;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// _callWithoutProcessExit: 355-16 CLI entries (hsi-to-graph.cjs,
// whitespace-to-graph.cjs) call process.exit() on a missing/malformed
// results file or a hard error. This composition is a long-lived in-process
// child, not a CLI invocation, so process.exit() must never actually tear
// the process down here. The seam is monkey-patched for the duration of one
// call only, always restored in a finally.
// ---------------------------------------------------------------------------
function _ExitSignal(code) {
  this.code = code;
}

async function _callWithoutProcessExit(fn) {
  const originalExit = process.exit;
  process.exit = function guardedExit(code) {
    throw new _ExitSignal(typeof code === 'number' ? code : 0);
  };
  try {
    const value = await fn();
    return { exited: null, value: value };
  } catch (e) {
    if (e instanceof _ExitSignal) return { exited: e.code, value: undefined };
    throw e;
  } finally {
    process.exit = originalExit;
  }
}

// ---------------------------------------------------------------------------
// _resolveArtifactEndpoint: the same "read the artifact's own file, extract
// carried frontmatter, resolve locally" idiom repeated verbatim across
// scripts/hsi-to-graph.cjs::hsiEndpoints, the legacy eureka runner's
// eurekaEndpoints and lib/agents/reverse-salient-agent.cjs::rsEndpoints --
// replicated locally (never a cross-require of lib/agents/*) for the
// find-bottlenecks adapter's own endpoint resolution.
// ---------------------------------------------------------------------------
function _resolveArtifactEndpoint(roomDir, artifactId, fallbackTitle) {
  const fs = require('node:fs');
  let raw = '';
  if (roomDir && artifactId) {
    try {
      raw = fs.readFileSync(path.join(roomDir, String(artifactId) + '.md'), 'utf8');
    } catch (_e) {
      raw = '';
    }
  }
  const title = (typeof fallbackTitle === 'string' && fallbackTitle) ? fallbackTitle : String(artifactId);
  const carried = verificationStamp.extractCarried(raw, title);
  return Object.assign({ title: title }, verificationStamp.resolveEndpoint(carried));
}

// ---------------------------------------------------------------------------
// Default producer adapters. Each is `async (roomDir, ctx) => { outcome,
// findings }`. ctx = { deps: { callTool (memoized) }, roomDir, priorFindings,
// now }. Every adapter degrades honestly to { outcome: 'deps_missing' |
// 'no_candidate' | 'error', findings: [] } rather than throwing; the
// composition's own try/catch around each adapter call is a backstop, not
// the primary error path.
// ---------------------------------------------------------------------------

// Phase 366-07 (D-03, ADR-E5): the eureka producer is the perspective's own
// recall, read-only on room.db, and it only OFFERS. No stamp, no judge, no
// fetch, no filing: every finding is offer_only (selectCardFinding skips it)
// and its text stays empty, so nothing room-shaped rides the finding. The offer
// carries node ids and section slugs only; the planner's ambient step
// rehydrates titles locally (research-planner/ambient.cjs). The injected
// callTool is never reached from here.
function _offerRow(c) {
  return { a: String(c.a), b: String(c.b), section_a: String(c.section_a || ''), section_b: String(c.section_b || '') };
}

async function _eurekaAdapter(roomDir, _ctx) {
  try {
    const navigation = require('./navigation.cjs');
    const eurekaRecall = require('./research-planner/perspectives/eureka-recall.cjs');
    const db = navigation.openRoomDbReadOnlyForCaller(roomDir);
    if (!db) return { outcome: 'no_candidate', findings: [] };
    let recall;
    try {
      // { roomDir } always: plan 366-08 builds the canon resolver context from
      // it; before 366-08 the extra option is ignored.
      const substrate = eurekaRecall.buildSubstrate(db, { roomDir: roomDir });
      recall = eurekaRecall.recallCandidates(substrate, roomDir, { max_candidates: AMBIENT_TOP_N });
    } finally {
      navigation.closeRoomDbForCaller(db);
    }
    const candidates = (recall && Array.isArray(recall.candidates) ? recall.candidates : []).slice(0, AMBIENT_TOP_N);
    if (candidates.length === 0) return { outcome: 'no_candidate', findings: [] };
    const findings = candidates.map(function (c, i) {
      return {
        producer: 'eureka',
        a: { handle: String(c.a), text: '' },
        b: { handle: String(c.b), text: '' },
        rank: i,
        offer_only: true,
      };
    });
    return { outcome: 'offered', findings: findings, offer: candidates.map(_offerRow) };
  } catch (_e) {
    return { outcome: 'error', findings: [] };
  }
}

async function _findBottlenecksAdapter(roomDir, ctx) {
  try {
    const rsEngine = require('./rs-engine.cjs');
    const rsStamps = new Map();
    async function stampFn(pairDicts) {
      const list = Array.isArray(pairDicts) ? pairDicts : [];
      if (list.length === 0) return new Map();
      const eps = list.map(function (p) {
        return {
          from: _resolveArtifactEndpoint(roomDir, p.source_artifact_id, p.source_title),
          to: _resolveArtifactEndpoint(roomDir, p.target_artifact_id, p.target_title),
        };
      });
      const findingsIn = list.map(function (p, i) {
        return {
          fromHandle: eps[i].from.name,
          toHandle: eps[i].to.name,
          fromVia: eps[i].from.via,
          toVia: eps[i].to.via,
          direction: directionConvention.DIRECTIONS.indexOf(p.direction) !== -1 ? p.direction : directionConvention.NONE,
        };
      });
      const stamps = await verificationStamp.stampFindings(findingsIn, { callTool: ctx.deps.callTool });
      const propsMap = new Map();
      list.forEach(function (p, i) {
        const key = String(p.source_artifact_id) + '\u0000' + String(p.target_artifact_id);
        propsMap.set(key, verificationStamp.toNodeProps(stamps[i]));
        rsStamps.set(key, { stamp: stamps[i], from: eps[i].from.name, to: eps[i].to.name });
      });
      return propsMap;
    }

    let result;
    try {
      result = await rsEngine.runModeInternal(roomDir, { topk: AMBIENT_TOP_N, stampFn: stampFn });
    } catch (_e) {
      return { outcome: 'error', findings: [] };
    }
    const pairs = Array.isArray(result && result.pairs) ? result.pairs : [];
    if (pairs.length === 0) return { outcome: 'no_candidate', findings: [] };

    const findings = [];
    pairs.forEach(function (p, i) {
      const key = String(p.source_artifact_id) + '\u0000' + String(p.target_artifact_id);
      const entry = rsStamps.get(key);
      if (!entry) return;
      findings.push({
        producer: 'find-bottlenecks',
        a: { handle: String(p.source_artifact_id), text: p.source_title || String(p.source_artifact_id) },
        b: { handle: String(p.target_artifact_id), text: p.target_title || String(p.target_artifact_id) },
        stamp: entry.stamp,
        rank: i,
        _resolvedFrom: entry.from,
        _resolvedTo: entry.to,
      });
    });
    return { outcome: findings.length > 0 ? 'no_candidate' : 'no_candidate', findings: findings };
  } catch (_e) {
    return { outcome: 'error', findings: [] };
  }
}

// _hsiAdapter / _whitespaceAdapter: Canon Part 9 (this file is NOT
// lib/core/navigation/*, so it never opens a second SQL door -- the
// 355.1 one-SQL-door chokepoint sweep, tests/test-3551-chokepoint.cjs,
// polices exactly this). The findings these two adapters return are
// computed the SAME way scripts/hsi-to-graph.cjs's and
// scripts/whitespace-to-graph.cjs's own --stamp branches already compute
// them (their exported hsiEndpoints / whitespaceEndpoints + a
// verificationStamp.stampFindings call), read from the plain JSON results
// file each 355-16 producer already writes -- never a room.db read of any
// kind. The 355-16 main(argv, deps) call still runs afterward (best
// effort, guarded against process.exit) purely for its own graph-write
// side effect; a failure there never erases the findings already computed
// (memoizeCallTool means main()'s own internal stampFindings call for the
// SAME pairs costs zero extra Theo calls).

async function _hsiAdapter(roomDir, ctx) {
  try {
    const fs = require('node:fs');
    const resultsPath = path.join(roomDir, '.hsi-results.json');
    if (!fs.existsSync(resultsPath)) return { outcome: 'deps_missing', findings: [] };

    let data;
    try {
      data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    } catch (_e) {
      return { outcome: 'deps_missing', findings: [] };
    }
    const hsiPairs = Array.isArray(data && data.hsi_pairs) ? data.hsi_pairs : [];
    if (hsiPairs.length === 0) return { outcome: 'no_candidate', findings: [] };

    const hsiToGraph = require('../../scripts/hsi-to-graph.cjs');
    const shownPairs = hsiPairs.slice().sort(function (a, b) { return (b.hsi_score || 0) - (a.hsi_score || 0); }).slice(0, AMBIENT_TOP_N);
    const endpointsByIndex = shownPairs.map(function (pair) { return hsiToGraph.hsiEndpoints(pair, roomDir); });
    const findingsIn = shownPairs.map(function (pair, i) {
      return Object.assign(
        { direction: directionConvention.classify(pair.lsa_sim != null ? pair.lsa_sim : pair.lsa, pair.semantic_sim != null ? pair.semantic_sim : pair.semantic) },
        endpointsByIndex[i]
      );
    });
    const stamps = await verificationStamp.stampFindings(findingsIn, { callTool: ctx.deps.callTool });
    const findings = shownPairs.map(function (pair, i) {
      return {
        producer: 'hsi',
        a: { handle: String(pair.left_id), text: endpointsByIndex[i].fromTitle || String(pair.left_id) },
        b: { handle: String(pair.right_id), text: endpointsByIndex[i].toTitle || String(pair.right_id) },
        stamp: stamps[i],
        rank: i,
        _resolvedFrom: endpointsByIndex[i].fromHandle,
        _resolvedTo: endpointsByIndex[i].toHandle,
      };
    });

    // Best-effort graph write (never lets a write failure erase findings
    // already computed above).
    await _callWithoutProcessExit(function () {
      return hsiToGraph.main([roomDir, '--stamp', '--top', String(AMBIENT_TOP_N)], { callTool: ctx.deps.callTool });
    }).catch(function () { /* best effort */ });

    return { outcome: 'no_candidate', findings: findings };
  } catch (_e) {
    return { outcome: 'error', findings: [] };
  }
}

async function _whitespaceAdapter(roomDir, ctx) {
  try {
    const fs = require('node:fs');
    const resultsPath = path.join(roomDir, '.mindrian', 'whitespace-results.json');
    if (!fs.existsSync(resultsPath)) return { outcome: 'deps_missing', findings: [] };

    let data;
    try {
      data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    } catch (_e) {
      return { outcome: 'deps_missing', findings: [] };
    }
    const gaps = Array.isArray(data && data.gaps) ? data.gaps : [];
    if (gaps.length === 0) return { outcome: 'no_candidate', findings: [] };

    const interpPath = path.join(roomDir, '.mindrian', 'interpretation-results.json');
    let interpGapMap = {};
    if (fs.existsSync(interpPath)) {
      try {
        const interpData = JSON.parse(fs.readFileSync(interpPath, 'utf8'));
        if (interpData && Array.isArray(interpData.gaps)) {
          for (const ig of interpData.gaps) {
            if (ig && ig.brain_framework) interpGapMap[ig.brain_framework] = ig;
          }
        }
      } catch (_e) { /* fall through to raw gaps */ }
    }

    const whitespaceCommand = require('../../scripts/whitespace-command.cjs');
    const shownGaps = gaps.slice(0, AMBIENT_TOP_N);
    const frameworks = [];
    const zoneFindingsIn = [];
    for (const gap of shownGaps) {
      const framework = gap.brain_framework || 'unknown';
      const interp = interpGapMap[framework] || {};
      const chain = Array.isArray(interp.framework_chain) ? interp.framework_chain : [];
      const nearest = chain.length > 0 ? chain : [framework];
      const endpoints = whitespaceCommand.whitespaceEndpoints({ nearest_frameworks: nearest }, 'zone');
      frameworks.push(framework);
      zoneFindingsIn.push(Object.assign({ direction: directionConvention.NONE }, endpoints));
    }
    const stamps = await verificationStamp.stampFindings(zoneFindingsIn, { callTool: ctx.deps.callTool });
    const findings = [];
    frameworks.forEach(function (framework, i) {
      const stamp = stamps[i];
      if (!stamp || stamp.verification === undefined) return;
      findings.push({
        producer: 'whitespace',
        a: { handle: 'whitespace-zone:' + framework, text: framework },
        b: { handle: zoneFindingsIn[i].toHandle || ('whitespace-nearest:' + framework), text: framework },
        stamp: stamp,
        rank: i,
        _resolvedFrom: zoneFindingsIn[i].fromHandle,
        _resolvedTo: zoneFindingsIn[i].toHandle,
      });
    });

    // Best-effort graph write (never lets a write failure erase findings
    // already computed above).
    const whitespaceToGraph = require('../../scripts/whitespace-to-graph.cjs');
    await _callWithoutProcessExit(function () {
      return whitespaceToGraph.main([roomDir, '--stamp'], { callTool: ctx.deps.callTool });
    }).catch(function () { /* best effort */ });

    return { outcome: 'no_candidate', findings: findings };
  } catch (_e) {
    return { outcome: 'error', findings: [] };
  }
}

async function _findConnectionsAdapter(roomDir, ctx) {
  try {
    const prior = Array.isArray(ctx.priorFindings) ? ctx.priorFindings : [];
    const seen = new Set();
    const pairs = [];
    for (const f of prior) {
      const from = f && f._resolvedFrom;
      const to = f && f._resolvedTo;
      if (typeof from !== 'string' || !from || typeof to !== 'string' || !to) continue;
      const key = from + '\u0000' + to;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ from: from, to: to });
      if (pairs.length >= AMBIENT_TOP_N) break;
    }
    if (pairs.length === 0) return { outcome: 'no_candidate', findings: [] };

    const findingsIn = pairs.map(function (p) {
      const from = verificationStamp.resolveEndpoint({ framework: p.from });
      const to = verificationStamp.resolveEndpoint({ framework: p.to });
      return {
        fromHandle: from.name,
        toHandle: to.name,
        fromVia: from.via,
        toVia: to.via,
        direction: directionConvention.NONE,
      };
    });
    const stamps = await verificationStamp.stampFindings(findingsIn, { callTool: ctx.deps.callTool });
    const findings = pairs.map(function (p, i) {
      return {
        producer: 'find-connections',
        a: { handle: p.from, text: p.from },
        b: { handle: p.to, text: p.to },
        stamp: stamps[i],
        rank: i,
        _resolvedFrom: p.from,
        _resolvedTo: p.to,
      };
    });
    return { outcome: 'no_candidate', findings: findings };
  } catch (_e) {
    return { outcome: 'error', findings: [] };
  }
}

const PRODUCER_ADAPTERS = Object.freeze({
  eureka: _eurekaAdapter,
  'find-connections': _findConnectionsAdapter,
  'find-bottlenecks': _findBottlenecksAdapter,
  hsi: _hsiAdapter,
  whitespace: _whitespaceAdapter,
});

// ---------------------------------------------------------------------------
// runAmbientComposition(roomDir, opts) -> Promise<{ producers, tier_counts,
// card, surfaced_via }>. Never throws; every failure maps to an outcome
// enum member.
// ---------------------------------------------------------------------------
async function runAmbientComposition(roomDir, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const deps = (o.deps && typeof o.deps === 'object') ? o.deps : {};
  const adapters = (deps.adapters && typeof deps.adapters === 'object') ? deps.adapters : PRODUCER_ADAPTERS;
  const rawCallTool = (typeof deps.callTool === 'function') ? deps.callTool : null;
  const memoCallTool = rawCallTool ? memoizeCallTool(rawCallTool) : null;
  const measureAndGuard = (typeof deps.measureAndGuard === 'function') ? deps.measureAndGuard : measureAndGuardPair;
  const nowFn = (typeof deps.now === 'function') ? deps.now : Date.now;
  const budgetMs = Number.isFinite(o.budgetMs) ? o.budgetMs : DEFAULT_BUDGET_MS;

  const producers = {};
  const tierCounts = { strong: 0, indirect: 0, unverified: 0 };
  const allFindings = [];

  try {
    const wallStart = Date.now();
    let budgetExceeded = false;

    for (const id of EXEC_ORDER) {
      const posture = recipeMaps.postureForCommand(PRODUCER_COMMANDS[id]).posture;
      if (budgetExceeded || (Date.now() - wallStart) >= budgetMs) {
        budgetExceeded = true;
        producers[id] = { outcome: 'skipped', posture: posture };
        continue;
      }

      const adapterFn = adapters[id];
      let outcome = 'error';
      let findings = [];
      let offer = null;
      try {
        if (typeof adapterFn === 'function') {
          const res = await adapterFn(roomDir, {
            deps: { callTool: memoCallTool, adapters: adapters, measureAndGuard: measureAndGuard, now: nowFn },
            roomDir: roomDir,
            priorFindings: allFindings.slice(),
            now: nowFn,
          });
          outcome = (res && typeof res.outcome === 'string' && AMBIENT_PRODUCER_OUTCOMES.indexOf(res.outcome) !== -1) ? res.outcome : 'error';
          findings = Array.isArray(res && res.findings) ? res.findings : [];
          if (outcome === 'offered' && Array.isArray(res.offer)) {
            offer = res.offer.slice(0, AMBIENT_TOP_N).filter(function (r) { return r && typeof r.a === 'string' && typeof r.b === 'string'; }).map(_offerRow);
          }
        }
      } catch (_e) {
        outcome = 'error';
        findings = [];
        offer = null;
      }

      producers[id] = { outcome: outcome, posture: posture };
      // 366-07: the offer rides compResult to the planner's ambient step only;
      // the ambient ledger record keeps { outcome, posture } (_ledgerProducers).
      if (offer) producers[id].offer = offer;
      for (const f of findings) {
        allFindings.push(f);
        const tier = f && f.stamp && f.stamp.verification;
        if (tier === 'strong' || tier === 'indirect' || tier === 'unverified') {
          tierCounts[tier] += 1;
        }
      }
    }

    const card = selectCardFinding(allFindings);
    let resultCard = null;
    let surfacedVia = 'none';

    if (card) {
      let guardResult = null;
      try {
        guardResult = await measureAndGuard(card.a, card.b, { deps: { callTool: memoCallTool, criticProbeFn: deps.criticProbeFn } });
      } catch (_e) {
        guardResult = { ok: false, reason: 'guard_not_cleared' };
      }

      if (!guardResult || guardResult.ok !== true) {
        const reason = (guardResult && guardResult.reason) || 'guard_not_cleared';
        if (producers[card.producer] && AMBIENT_PRODUCER_OUTCOMES.indexOf(reason) !== -1) {
          producers[card.producer] = { outcome: reason, posture: producers[card.producer].posture };
        }
      } else {
        let nodeId = null;
        try {
          const navigation = require('./navigation.cjs');
          // 366-07 (D-04): the planner's relocated stamped filer (plan 366-02).
          const fileStampedOpportunity = require('./research-planner/filing-stamped.cjs').fileStampedOpportunity;
          const db = navigation.openRoomDbForCaller(roomDir);
          if (db) {
            // Phase 369 (D-18): owns idiom so this writer composes inside withRoomTx (Pitfall 7).
            // This site opens its own handle (openRoomDbForCaller), so owns is always true here.
            const owns = db.isTransaction !== true;
            try {
              if (owns) db.exec('BEGIN');
              nodeId = fileStampedOpportunity(db, {
                a: card.a,
                b: card.b,
                stamp: card.stamp,
                producer: card.producer,
                roomDir: roomDir,
                runMode: 'ambient',
                reason: 'ambient stamped finding',
              });
              if (nodeId) {
                if (owns) db.exec('COMMIT');
              } else if (owns) {
                db.exec('ROLLBACK');
              }
            } catch (_e) {
              if (owns) {
                try { db.exec('ROLLBACK'); } catch (_e2) { /* already rolled back */ }
              }
              nodeId = null;
            } finally {
              navigation.closeRoomDbForCaller(db);
            }
          }
        } catch (_e) {
          nodeId = null;
        }

        if (nodeId) {
          const sideChannel = writeStampedSideChannel(roomDir, {
            score: guardResult.score,
            guard: guardResult.guard,
            a: card.a,
            b: card.b,
            stamp: card.stamp,
            opportunityHandle: nodeId,
          });
          if (sideChannel && sideChannel.ok) {
            resultCard = { opportunity_handle: nodeId, producer: card.producer, verification: card.stamp.verification };
            surfacedVia = 'sens13';
            if (producers[card.producer]) {
              producers[card.producer] = { outcome: 'filed', posture: producers[card.producer].posture };
            }
          } else if (producers[card.producer]) {
            producers[card.producer] = { outcome: 'error', posture: producers[card.producer].posture };
          }
        } else if (producers[card.producer]) {
          producers[card.producer] = { outcome: 'error', posture: producers[card.producer].posture };
        }
      }
    }

    return { producers: producers, tier_counts: tierCounts, card: resultCard, surfaced_via: surfacedVia };
  } catch (_e) {
    return { producers: producers, tier_counts: tierCounts, card: null, surfaced_via: 'none' };
  }
}

// ---------------------------------------------------------------------------
// checkProducerDeps(opts) -> { python, hsi }. Runs scripts/check-hsi-deps
// once through child_process.spawnSync with a short timeout, stdio
// captured (NEVER inherited -- the child's own tier line must never reach
// this long-lived process's own stdout/stderr). Soft-fails to { python:
// false, hsi: false } on any spawn error, timeout, or unexpected exit code.
// Exit codes (scripts/check-hsi-deps): 0 = tier 1+ (python3 + sklearn
// present), 1 = no python3 at all, 2 = python3 present, sklearn missing.
// ---------------------------------------------------------------------------
function checkProducerDeps(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  try {
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'check-hsi-deps');
    const timeoutMs = Number.isFinite(o.timeoutMs) ? o.timeoutMs : 5000;
    const childProcess = require('node:child_process');
    const res = childProcess.spawnSync('bash', [scriptPath], {
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const code = (res && typeof res.status === 'number') ? res.status : null;
    if (code === 0) return { python: true, hsi: true };
    if (code === 2) return { python: true, hsi: false };
    return { python: false, hsi: false };
  } catch (_e) {
    return { python: false, hsi: false };
  }
}

// ---------------------------------------------------------------------------
// runAmbientInChild(roomDir, opts) -> Promise<{ state, surfaced_via? }>. The
// lifecycle AROUND runAmbientComposition (plan 355.1-09): claim/verify,
// acquire the lock, run the composition, record the ledger, rewrite the
// delta-state side channel, always release the lock in finally. Never
// throws. Stderr diagnostics only as a closed enum, only when
// MINDRIAN_AMBIENT_DEBUG === '1'. No emitFired, no store.markCompleted, no
// appendMaterial anywhere in this module.
//
// opts: { seam ('material' for the Phase 117 path; omitted in ambient
// mode), ambientId, materialId, sessionId, deps, now }.
//
// AMBIENT MODE (opts.ambientId given, no opts.seam): re-reads the delta
// state plan 355.1-06's evaluateAndMaybeSpawn already claimed (run_state
// 'started', written BEFORE spawning) and verifies the argv id matches the
// delta_hash it carries (T-3551-39, an argv-tamper check); a mismatch or a
// state that is not 'started' returns 'tamper_or_stale' WITHOUT touching
// anything. The seam the run proceeds under is the delta state's own seam
// field (stop_hook or closeout), never re-derived here.
//
// MATERIAL MODE (opts.seam === 'material'): calls
// lib/core/ambient-trigger.cjs's evaluateAndClaim in-process (the material
// seam never spawns a second child -- this function IS the already-running
// Phase 117 child); only a 'claimed' decision proceeds past this step.
// ---------------------------------------------------------------------------
// _ledgerProducers(producers): the strict ambient ledger admits exactly
// { outcome, posture } per producer (scout-cadence-guard.cjs
// AMBIENT_PRODUCER_RECORD_KEYS). The 366-07 eureka offer never enters it.
function _ledgerProducers(producers) {
  const out = {};
  Object.keys(producers || {}).forEach(function (k) {
    const p = producers[k];
    if (p && typeof p === 'object') out[k] = { outcome: p.outcome, posture: p.posture };
  });
  return out;
}

async function runAmbientInChild(roomDir, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  // CR-02 fix (355.1 review): evaluateAndMaybeSpawn/evaluateAndClaim write
  // ledger.in_flight BEFORE this child is ever spawned. If this function
  // then bails out on a tamper/stale check, releaseAmbientClaim is the only
  // thing that ever clears in_flight -- without it, a soft-failed
  // delta-state write or a lost race leaks the claim for up to
  // AMBIENT_LOCK_STALE_MS (8 minutes) with no child actually running.
  // knownDeltaHash tracks the hash this call already knows was claimed (the
  // material seam's own claim.delta_hash, or the ambient seam's
  // preState.delta_hash) so every early return below can release it.
  // Decision (stated, not silently assumed): this releases in_flight ONLY.
  // ledger.runs_window.count is left untouched -- refunding/not-counting a
  // phantom claim toward the hourly cap is WR-03, a separate warning-tier
  // finding out of scope for this critical-only fix.
  let knownDeltaHash = null;
  try {
    if (o.seam === 'material') {
      const ambientTrigger = require('./ambient-trigger.cjs');
      const claim = ambientTrigger.evaluateAndClaim(roomDir, {
        seam: 'material',
        materialId: o.materialId,
        sessionId: o.sessionId,
        now: o.now,
      });
      if (claim.decision !== 'claimed') {
        return { state: claim.decision };
      }
      knownDeltaHash = claim.delta_hash;
    } else if (typeof o.ambientId === 'string' && o.ambientId.length > 0) {
      const ambientTrigger = require('./ambient-trigger.cjs');
      const preState = scoutCadenceGuard.readRoomDeltaState(roomDir);
      if (!preState || preState.run_state !== 'started' || ambientTrigger.ambientIdFor(preState.delta_hash) !== o.ambientId) {
        if (preState && typeof preState.delta_hash === 'string') {
          try { scoutCadenceGuard.releaseAmbientClaim(roomDir, preState.delta_hash); } catch (_e) { /* best effort */ }
        }
        return { state: 'tamper_or_stale' };
      }
      knownDeltaHash = preState.delta_hash;
    } else {
      return { state: 'tamper_or_stale' };
    }

    // The single source of truth for this run's seam/classes/material_id
    // from here on is the delta-state file itself (written either by
    // evaluateAndClaim above, in material mode, or by the evaluator that
    // spawned this child, in ambient mode) -- never reconstructed from opts.
    const claimedState = scoutCadenceGuard.readRoomDeltaState(roomDir);
    if (!claimedState || claimedState.run_state !== 'started') {
      if (typeof knownDeltaHash === 'string' && knownDeltaHash.length > 0) {
        try { scoutCadenceGuard.releaseAmbientClaim(roomDir, knownDeltaHash); } catch (_e) { /* best effort */ }
      }
      return { state: 'tamper_or_stale' };
    }
    const deltaHash = claimedState.delta_hash;
    const classes = Array.isArray(claimedState.classes) ? claimedState.classes : [];
    const seam = claimedState.seam;
    const materialId = claimedState.material_id;

    const nowMs = Number.isFinite(o.now) ? o.now : Date.now();
    const lockResult = scoutCadenceGuard.acquireAmbientLock(roomDir, { now: nowMs });
    if (!lockResult.ok) {
      try { scoutCadenceGuard.releaseAmbientClaim(roomDir, deltaHash); } catch (_e) { /* best effort */ }
      return { state: 'locked' };
    }

    try {
      const evaluatedIso = new Date(nowMs).toISOString();
      scoutCadenceGuard.writeRoomDeltaState(roomDir, {
        schema_version: 1,
        evaluated_at: evaluatedIso,
        seam: seam,
        classes: classes,
        delta_hash: deltaHash,
        run_state: 'running',
        material_id: materialId,
        opportunity_handle: null,
        surfaced_via: null,
        framing: null,
      });

      const depsAvailable = checkProducerDeps();
      const compositionFn = (o.deps && typeof o.deps.composition === 'function') ? o.deps.composition : runAmbientComposition;
      const runWallStart = Date.now();
      let compResult;
      try {
        compResult = await compositionFn(roomDir, {
          deps: Object.assign({}, o.deps, { depsAvailable: depsAvailable }),
          deltaState: { delta_hash: deltaHash, classes: classes, seam: seam, material_id: materialId },
          budgetMs: AMBIENT_TOTAL_BUDGET_MS,
        });
      } catch (_e) {
        compResult = { producers: {}, tier_counts: { strong: 0, indirect: 0, unverified: 0 }, card: null, surfaced_via: 'none' };
      }

      // Phase 363-16 (D-03): the room-started quick research run rides this
      // child, under the same lock and inside the remaining total budget. Its
      // outcome lives only in the research run ledger; nothing it returns
      // touches this run's state, ledger or delta-state keys, and a throw
      // never blocks ambient completion.
      try {
        const rpDeps = (o.deps && o.deps.researchPlanner && typeof o.deps.researchPlanner === 'object') ? o.deps.researchPlanner : {};
        const maybeQuick = (typeof rpDeps.maybeQuick === 'function') ? rpDeps.maybeQuick : require('./research-planner/ambient.cjs').maybeQuick;
        await maybeQuick(roomDir, compResult, {
          budgetMs: AMBIENT_TOTAL_BUDGET_MS - (Date.now() - runWallStart),
          deps: rpDeps,
          now: nowMs,
          deltaHash: deltaHash,
        });
      } catch (_e) { /* the research branch never blocks ambient completion */ }

      const producers = (compResult && compResult.producers && typeof compResult.producers === 'object') ? compResult.producers : {};
      const producerKeys = Object.keys(producers);
      const allDepsMissing = producerKeys.length > 0 && producerKeys.every(function (k) {
        return producers[k] && producers[k].outcome === 'deps_missing';
      });
      const runState = allDepsMissing ? 'deps_missing' : 'completed';
      const surfacedVia = (compResult && (compResult.surfaced_via === 'sens13' || compResult.surfaced_via === 'none'))
        ? compResult.surfaced_via
        : 'none';
      const opportunityHandle = (compResult && compResult.card && typeof compResult.card.opportunity_handle === 'string')
        ? compResult.card.opportunity_handle
        : null;

      let framing = null;
      try {
        const ambientFraming = require('./ambient-framing.cjs');
        const framed = ambientFraming.framingFor(roomDir, { allowStructural: true });
        framing = (framed && typeof framed.framing === 'string') ? framed.framing : null;
      } catch (_e) {
        framing = null;
      }

      try {
        scoutCadenceGuard.recordAmbientRun(roomDir, {
          deltaHash: deltaHash,
          producers: _ledgerProducers(producers),
          tierCounts: (compResult && compResult.tier_counts) || { strong: 0, indirect: 0, unverified: 0 },
          surfacedVia: surfacedVia,
          materialId: materialId,
          now: nowMs,
        });
      } catch (_e) { /* the delta-state rewrite below still runs; best effort */ }

      scoutCadenceGuard.writeRoomDeltaState(roomDir, {
        schema_version: 1,
        evaluated_at: evaluatedIso,
        seam: seam,
        classes: classes,
        delta_hash: deltaHash,
        run_state: runState,
        material_id: materialId,
        opportunity_handle: opportunityHandle,
        surfaced_via: surfacedVia,
        framing: framing,
      });

      if (process.env.MINDRIAN_AMBIENT_DEBUG === '1') {
        try { process.stderr.write('[ambient-run] ' + runState + '\n'); } catch (_e) { /* never block on a diagnostic */ }
      }

      return { state: runState, surfaced_via: surfacedVia };
    } finally {
      // CR-03 fix (355.1 review): pass this run's own lock token so the
      // release is a compare-and-delete, never an unconditional rmSync of
      // whatever file currently sits at the lock path. A slow run whose
      // lock was already stale-reclaimed by a later run must not evict that
      // later run's live lock.
      try { scoutCadenceGuard.releaseAmbientLock(roomDir, lockResult.token); } catch (_e) { /* best effort */ }
    }
  } catch (_e) {
    return { state: 'error' };
  }
}

module.exports = {
  runAmbientComposition: runAmbientComposition,
  selectCardFinding: selectCardFinding,
  memoizeCallTool: memoizeCallTool,
  PRODUCER_COMMANDS: PRODUCER_COMMANDS,
  PRODUCER_ADAPTERS: PRODUCER_ADAPTERS,
  CARD_TIERS: CARD_TIERS,
  AMBIENT_TOP_N: AMBIENT_TOP_N,
  runAmbientInChild: runAmbientInChild,
  checkProducerDeps: checkProducerDeps,
  AMBIENT_TOTAL_BUDGET_MS: AMBIENT_TOTAL_BUDGET_MS,
};
