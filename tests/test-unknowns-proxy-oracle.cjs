'use strict';
/*
 * Phase 165-03 Wave-2 GREEN test -- test-unknowns-proxy-oracle (D-165-01).
 *
 * GREEN assertion (sourced from 165-VALIDATION.md + 165-RESEARCH section 2):
 *   proxyOracle(db, claimId, cfg, nowFn) blends the THREE LOCAL scalars with the
 *   default weights w_contra 0.5 / w_mismatch 0.3 / w_stale 0.2 and thresholds at
 *   proxyThreshold 0.5:
 *     contradictionDensity = incident CONTRADICTS|INVALIDATES / (1 + total incident),
 *     tierMismatch         = max(0, confidence - TIER_FLOOR[evidenceTier]),
 *     staleness            = clamp01((nowRef - last_modified_at)/STALE_WINDOW_MS).
 *   A claim that is BOTH heavily contradicted AND stale (the blind-spot signal)
 *   labels trueLabel 1; a clean (uncontested, fresh, well-tiered) claim labels 0.
 *   All three scalars are LOCAL room.db reads (NONE touch Brain, D-165-10);
 *   staleness uses the injected nowFn seam (no raw Date.now in the math path);
 *   the blend is deterministic. cost = proxyCost (0.0 for the proxy tier).
 *
 * The proxy LABELS only -- it returns { trueLabel, cost } and writes nothing; the
 * human-confirm promotion (Part 9 role 5) lives in a later plan via confirmNode.
 *
 * NO em-dashes (CLAUDE.md HARD RULE).
 */
const assert = require('assert');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const navigation = require('../lib/core/navigation.cjs');
const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const corpusAdapter = require('../lib/core/unknowns/corpus-adapter.cjs');
const { DEFAULT_CONFIG, TIER_FLOOR } = require('../lib/core/unknowns/iface.cjs');

const NOW = 1750000000000; // fixed epoch-ms anchor (NOT Date.now).
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CFG = DEFAULT_CONFIG.proxy;
const FIXTURE_NAVIGATOR = 'navigator-fixture'; // a non-agent human byUser for confirmNode.

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log('  ok - ' + name);
  } catch (e) {
    failures++;
    console.error('  FAIL - ' + name + ': ' + e.message);
  }
}

// Seed a confirmed Academic EvidenceClaim through the navigation chokepoint
// (never raw INSERT), confirm it via the human gate, stamp a deterministic
// last_modified_at, and optionally attach contradicting edges. Returns the node id.
function seedClaim(db, urlSlug, ageDays, contraCount, benignCount) {
  const r = navigation.writeEvidenceClaim(db, {
    topic: 'h-proxy', source: 'src-' + urlSlug, url: 'handle://proxy/' + urlSlug,
    retrieved_at: '', evidence_tier: 'Academic', summary: 'proxy/handle', sessionId: 'proxy-165',
  });
  if (!r || !r.ok) throw new Error('seed write failed: ' + (r && r.reason));
  const c = navigation.confirmNode(db, r.node_id, FIXTURE_NAVIGATOR, 'proxy-seed');
  if (!c || c.ok === false) throw new Error('seed confirm failed: ' + (c && c.reason));
  // Deterministic stale stamp on the already-minted node (the sanctioned single
  // UPDATE the fixture uses; last_modified_at is the field readStaleness keys on).
  db.prepare('UPDATE nodes SET last_modified_at = ? WHERE id = ?')
    .run(NOW - ageDays * MS_PER_DAY, r.node_id);
  // Attach contradicting edges incident on the claim (proxy contradiction signal).
  for (let i = 0; i < (contraCount || 0); i += 1) {
    const et = (i % 2 === 0) ? 'CONTRADICTS' : 'INVALIDATES';
    const e = navigation.writeEdge(db, {
      source_id: 'handle:contra-' + urlSlug + '-' + i,
      target_id: r.node_id,
      edge_type: et,
      properties: { relation: 'proxy_signal' },
    });
    if (!e || e.ok === false) throw new Error('contra edge failed: ' + (e && e.reason));
  }
  // Attach benign (non-contradicting) edges so the density denominator grows.
  for (let i = 0; i < (benignCount || 0); i += 1) {
    const e = navigation.writeEdge(db, {
      source_id: 'handle:support-' + urlSlug + '-' + i,
      target_id: r.node_id,
      edge_type: 'SUPPORTS',
      properties: { relation: 'proxy_signal' },
    });
    if (!e || e.ok === false) throw new Error('benign edge failed: ' + (e && e.reason));
  }
  return r.node_id;
}

const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uu-165-proxy-'));
const db = openRoomDb(roomDir);

// (A) The blind-spot claim: heavily contradicted (4 CONTRADICTS|INVALIDATES, no
//     other incident edges) AND stale (90 days, window 30). Expected:
//     contradictionDensity = 4/(1+4) = 0.8 -> *0.5 = 0.40
//     staleness = clamp01(90/30) = 1.0       -> *0.2 = 0.20
//     blend >= 0.5 -> trueLabel 1.
const blindSpotId = seedClaim(db, 'blindspot', 90, 4, 0);

// (B) The clean claim: uncontested, fresh, well-tiered. Expected all scalars 0,
//     trueLabel 0.
const cleanId = seedClaim(db, 'clean', 0, 0, 0);

// (C) A purely-stale-uncontested claim: stale but no contradiction. staleness 1.0
//     -> 0.2 alone is below threshold -> trueLabel 0 (staleness is the weakest
//     standalone signal per 165-RESEARCH 2.2).
const staleOnlyId = seedClaim(db, 'staleonly', 90, 0, 0);

check('the contradicted+stale claim labels trueLabel 1 (the blind spot)', () => {
  const res = corpusAdapter.proxyOracle(db, blindSpotId, CFG, () => NOW);
  assert.strictEqual(res.trueLabel, 1, 'blind-spot claim should label 1, got ' + res.trueLabel);
});

check('a clean fresh well-tiered claim labels trueLabel 0', () => {
  const res = corpusAdapter.proxyOracle(db, cleanId, CFG, () => NOW);
  assert.strictEqual(res.trueLabel, 0, 'clean claim should label 0, got ' + res.trueLabel);
});

check('a stale-but-uncontested claim alone does NOT cross threshold (staleness weakest)', () => {
  const res = corpusAdapter.proxyOracle(db, staleOnlyId, CFG, () => NOW);
  assert.strictEqual(res.trueLabel, 0, 'stale-only claim should label 0, got ' + res.trueLabel);
});

check('the three scalars are computed at the locked sources', () => {
  // contradictionDensity = 4/(1+4) = 0.8 on the blind-spot claim.
  const cd = corpusAdapter.readContradictionDensity(db, blindSpotId);
  assert(Math.abs(cd - 0.8) < 1e-9, 'contradictionDensity expected 0.8, got ' + cd);
  // staleness = clamp01(90/30) = 1.0 on a 90-day-old node, window 30.
  const st = corpusAdapter.readStaleness(db, blindSpotId, () => NOW, CFG);
  assert(Math.abs(st - 1.0) < 1e-9, 'staleness expected 1.0, got ' + st);
  // tierMismatch = max(0, confidence(0 NULL) - TIER_FLOOR.Academic(1.0)) = 0.
  const tm = corpusAdapter.readTierMismatch(db, blindSpotId);
  assert.strictEqual(tm, 0, 'tierMismatch on NULL-confidence Academic should be 0, got ' + tm);
});

check('the blend is the weighted 0.5/0.3/0.2 sum (the locked weights)', () => {
  const cd = corpusAdapter.readContradictionDensity(db, blindSpotId);
  const tm = corpusAdapter.readTierMismatch(db, blindSpotId);
  const st = corpusAdapter.readStaleness(db, blindSpotId, () => NOW, CFG);
  const expectedScore = CFG.w_contra * cd + CFG.w_mismatch * tm + CFG.w_stale * st;
  const expectedLabel = expectedScore >= CFG.proxyThreshold ? 1 : 0;
  const res = corpusAdapter.proxyOracle(db, blindSpotId, CFG, () => NOW);
  assert.strictEqual(res.trueLabel, expectedLabel, 'blend label does not match the weighted sum');
  assert.strictEqual(CFG.w_contra, 0.5, 'w_contra is not the locked 0.5');
  assert.strictEqual(CFG.w_mismatch, 0.3, 'w_mismatch is not the locked 0.3');
  assert.strictEqual(CFG.w_stale, 0.2, 'w_stale is not the locked 0.2');
  assert.strictEqual(CFG.proxyThreshold, 0.5, 'proxyThreshold is not the locked 0.5');
});

check('tierMismatch discriminates a high-confidence thin-tier claim', () => {
  // A claim minted by writeClaimNode hardcodes confidence 1.0; if it carried a
  // None tier, tierMismatch = max(0, 1.0 - 0.1) = 0.9. Verify the formula directly
  // against TIER_FLOOR (the live signal if the corpus filter is later relaxed).
  const confidence = 1.0;
  const mismatchNone = Math.max(0, confidence - TIER_FLOOR.None);
  const mismatchAcademic = Math.max(0, confidence - TIER_FLOOR.Academic);
  assert(mismatchNone > mismatchAcademic, 'tierMismatch must be larger on a thinner tier');
  assert(Math.abs(mismatchNone - 0.9) < 1e-9, 'None-tier mismatch at confidence 1.0 expected 0.9');
});

check('cost is the proxy-tier cost (0.0)', () => {
  const res = corpusAdapter.proxyOracle(db, blindSpotId, CFG, () => NOW);
  assert.strictEqual(res.cost, CFG.proxyCost, 'cost is not the proxy-tier proxyCost');
  assert.strictEqual(CFG.proxyCost, 0.0, 'proxyCost default is not 0.0');
});

check('staleness is deterministic under the injected nowFn seam', () => {
  const a = corpusAdapter.proxyOracle(db, blindSpotId, CFG, () => NOW);
  const b = corpusAdapter.proxyOracle(db, blindSpotId, CFG, () => NOW);
  assert.deepStrictEqual(a, b, 'proxyOracle is not deterministic under a fixed nowFn');
  // A different (much later) now makes the fresh clean claim stale too, proving the
  // seam drives the staleness math (no hidden Date.now).
  const later = NOW + 365 * MS_PER_DAY;
  const stLater = corpusAdapter.readStaleness(db, cleanId, () => later, CFG);
  assert(Math.abs(stLater - 1.0) < 1e-9, 'staleness must follow the injected nowFn (clean claim stale at +365d)');
  const stNow = corpusAdapter.readStaleness(db, cleanId, () => NOW, CFG);
  assert.strictEqual(stNow, 0, 'the clean claim is fresh at NOW');
});

check('zero Brain require in the corpus-adapter module source (D-165-10 / Part 8)', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'lib', 'core', 'unknowns', 'corpus-adapter.cjs'), 'utf8');
  // Forbidden Brain egress substrings (the Part-8 sweep mirror; doc-comment-safe
  // because the header never names a brain require path).
  assert(!/require\(['"][^'"]*brain[^'"]*['"]\)/i.test(src), 'corpus-adapter requires a brain module');
  assert(!/mcp__brain/.test(src), 'corpus-adapter references an mcp__brain tool');
});

closeRoomDb(db);
fs.rmSync(roomDir, { recursive: true, force: true });

if (failures > 0) {
  console.error('test-unknowns-proxy-oracle: ' + failures + ' assertion(s) FAILED');
  process.exit(1);
}
console.log('test-unknowns-proxy-oracle: GREEN (D-165-01 3-scalar blend 0.5/0.3/0.2 thresholded; LOCAL; deterministic)');
process.exit(0);
