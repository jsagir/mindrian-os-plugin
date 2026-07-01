#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 195-05 -- FCM-09 cross-room relevance-candidate emitter.
 * =============================================================================
 * The inverse of the 90-06 contradiction aggregator: instead of surfacing where
 * the navigator's OWN rooms DISAGREE, aggregateRelevanceCandidates surfaces where
 * they are RELATED, so an insight in room A can reach room B with ZERO Brain wire.
 *
 * Assertions:
 *   1. exports aggregateRelevanceCandidates + RELEVANCE_SIGNALS.
 *   2. candidates emit over the navigator's OWN registered rooms.
 *   3. a shared framework-chain signature -> shared_framework, relevance 0.80,
 *      >= 0.70 (renders pre-checked in the F.8 basket).
 *   4. a shared problem_type (different framework) -> shared_problem_type, 0.72.
 *   5. a bare section/entity overlap -> shared_entity, 0.68 (BELOW 0.70; NOT
 *      auto-pre-checked).
 *   6. every candidate WHY is a FROZEN ENUM member; every relevance is in [0,1].
 *   7. NO prose egress: JSON.stringify(candidates) passes FORBIDDEN_PATTERNS
 *      (the Part-8 four-tripwire fence + sanitizeDetailScalar hold).
 *   8. a GUARDRAIL.md sealed room contributes NO candidate (L2).
 *   9. a brain_cross_room:false room contributes NO candidate (L3).
 *  10. semantic DEGRADES GRACEFULLY: with no room-local vectors, no 'semantic'
 *      candidate; with a room-local embedding pair seeded, semantic fires.
 *  11. registry-less fallback: reason 'no_registry', empty candidates.
 *
 * Hermetic via MINDRIAN_ROOMS_ROOT override (ALLOWED_ROOT is read at load).
 * No em-dashes. No emoji.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const MOD_PATH = path.join(REPO, 'lib', 'core', 'cross-room-aggregator.cjs');

let passed = 0;
let failed = 0;
function ok(cond, label) {
  if (cond) { passed++; console.log('  PASS  ' + label); }
  else { failed++; console.error('  FAIL  ' + label); }
}

function writeBrain(sectionDir, opts) {
  fs.mkdirSync(sectionDir, { recursive: true });
  const lines = ['---', 'section: ' + opts.section];
  if (opts.gtHash) lines.push('governing_thought_hash: "' + opts.gtHash + '"');
  if (opts.problemType) lines.push('problem_type: ' + opts.problemType);
  lines.push('staleness: fresh');
  lines.push('---');
  lines.push('## Framework Chain Predictions');
  lines.push(opts.fwBody || 'no chain');
  fs.writeFileSync(path.join(sectionDir, 'BRAIN.md'), lines.join('\n') + '\n');
}

function seedEmbedding(roomDir, section, vector) {
  const dir = path.join(roomDir, '.mindrian', 'embeddings');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, section + '.json'), JSON.stringify(vector));
}

// Build a hermetic ~/MindrianRooms with a focus room + related peers.
function freshTmpRoot() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xroom-rel-'));

  const SECTION = 'strategy';
  const FW_SHARED = 'FC-X shared framework chain body';

  // Current focus room: WDP + framework FC-X.
  writeBrain(path.join(tmp, 'room-focus', SECTION), {
    section: SECTION, gtHash: 'sha256:h1focus', problemType: 'WDP', fwBody: FW_SHARED,
  });

  // Peer 1: SAME framework-chain body -> shared_framework (0.80).
  writeBrain(path.join(tmp, 'room-fw', SECTION), {
    section: SECTION, gtHash: 'sha256:h2peer', problemType: 'IDP', fwBody: FW_SHARED,
  });

  // Peer 2: WDP, DIFFERENT framework -> shared_problem_type (0.72).
  writeBrain(path.join(tmp, 'room-pt', SECTION), {
    section: SECTION, gtHash: 'sha256:h3peer', problemType: 'WDP', fwBody: 'FC-Y different',
  });

  // Peer 3: no problem_type, DIFFERENT framework -> shared_entity (0.68).
  writeBrain(path.join(tmp, 'room-ent', SECTION), {
    section: SECTION, gtHash: 'sha256:h4peer', fwBody: 'FC-Z different again',
  });

  // Peer 4: sealed via GUARDRAIL.md -> skipped (no candidate).
  writeBrain(path.join(tmp, 'room-sealed', SECTION), {
    section: SECTION, problemType: 'WDP', fwBody: FW_SHARED,
  });
  fs.writeFileSync(path.join(tmp, 'room-sealed', 'GUARDRAIL.md'), '# sealed test fixture\n');

  // Peer 5: opted out via ROOM.md brain_cross_room:false -> skipped.
  writeBrain(path.join(tmp, 'room-optout', SECTION), {
    section: SECTION, problemType: 'WDP', fwBody: FW_SHARED,
  });
  fs.writeFileSync(path.join(tmp, 'room-optout', 'ROOM.md'),
    '---\nbrain_cross_room: false\n---\n# room-optout\n');

  // Peer 6: no framework/problem_type match, but a room-local embedding pair
  // -> semantic. Seed the focus room + this peer with identical vectors.
  writeBrain(path.join(tmp, 'room-sem', SECTION), {
    section: SECTION, gtHash: 'sha256:h6peer', fwBody: 'FC-Q semantic only',
  });

  const registry = {
    version: 2,
    root: tmp,
    active: 'room-focus',
    rooms: {
      'room-focus': { path: 'room-focus', status: 'active' },
      'room-fw': { path: 'room-fw', status: 'active' },
      'room-pt': { path: 'room-pt', status: 'active' },
      'room-ent': { path: 'room-ent', status: 'active' },
      'room-sealed': { path: 'room-sealed', status: 'active' },
      'room-optout': { path: 'room-optout', status: 'active' },
      'room-sem': { path: 'room-sem', status: 'active' },
    },
  };
  fs.mkdirSync(path.join(tmp, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(tmp, '.rooms', 'registry.json'), JSON.stringify(registry, null, 2));

  return tmp;
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best effort */ }
}

function loadModuleFresh() {
  for (const k of Object.keys(require.cache)) {
    if (/cross-room-aggregator\.cjs$|folder-memory[^/]*\.cjs$/.test(k)) delete require.cache[k];
  }
  return require(MOD_PATH);
}

function findCand(cands, targetRoom) {
  return cands.find(function (c) { return c.target_room === targetRoom; });
}

(async function main() {
  console.log('[test-195-xroom-relevance] FCM-09 relevance emitter (Part-8 fence)');

  // ----- Test 1: exports surface -----
  {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    ok(typeof m.aggregateRelevanceCandidates === 'function', 'exports aggregateRelevanceCandidates');
    ok(Array.isArray(m.RELEVANCE_SIGNALS) && m.RELEVANCE_SIGNALS.length === 4,
      'exports RELEVANCE_SIGNALS frozen-enum vocabulary (4 members)');
    rmrf(tmp);
  }

  // ----- Tests 2-9: candidate emission + signals + fence -----
  {
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    const res = await m.aggregateRelevanceCandidates(path.join(tmp, 'room-focus'), { focus_section: 'strategy' });
    const cands = res.candidates;

    ok(Array.isArray(cands) && cands.length >= 3, 'candidates emit over OWN rooms (>=3, got ' + cands.length + ')');

    const fw = findCand(cands, 'room-fw');
    ok(fw && fw.signal === 'shared_framework', 'shared framework-chain -> signal shared_framework');
    ok(fw && Math.abs(fw.relevance - 0.80) < 1e-9, 'shared_framework relevance = 0.80');
    ok(fw && fw.relevance >= 0.70, 'shared_framework >= 0.70 (renders pre-checked)');

    const pt = findCand(cands, 'room-pt');
    ok(pt && pt.signal === 'shared_problem_type', 'shared problem_type (diff framework) -> shared_problem_type');
    ok(pt && Math.abs(pt.relevance - 0.72) < 1e-9, 'shared_problem_type relevance = 0.72');

    const ent = findCand(cands, 'room-ent');
    ok(ent && ent.signal === 'shared_entity', 'bare section/entity overlap -> shared_entity');
    ok(ent && ent.relevance < 0.70, 'shared_entity relevance < 0.70 (NOT auto-pre-checked)');

    // Frozen-enum WHY + scalar-range invariants for every candidate.
    let allEnum = true;
    let allRange = true;
    for (const c of cands) {
      if (m.RELEVANCE_SIGNALS.indexOf(c.signal) === -1) allEnum = false;
      if (c.why !== c.signal) allEnum = false;
      if (!(typeof c.relevance === 'number' && c.relevance >= 0 && c.relevance <= 1)) allRange = false;
    }
    ok(allEnum, 'every candidate WHY is a FROZEN ENUM member (why === signal)');
    ok(allRange, 'every candidate relevance is a scalar in [0,1]');

    // Part-8 no-prose-egress: the serialized candidate set passes every
    // FORBIDDEN_PATTERN (nothing but slugs, hash handles, enums, scalars).
    const ser = JSON.stringify(cands);
    let anyHit = false;
    for (const re of m.FORBIDDEN_PATTERNS) { if (re.test(ser)) { anyHit = true; break; } }
    ok(!anyHit, 'no prose egress: candidate serialization passes FORBIDDEN_PATTERNS');
    // The entity handle is a sha256 hash prefix, never the raw name.
    ok(cands.every(function (c) { return /^sha256:/.test(c.detail_scalar.entity); }),
      'shared-entity handle is a sha256 prefix (Part 8 hash handle, never the name)');

    // Sealed + opted-out rooms contribute NO candidate.
    ok(!findCand(cands, 'room-sealed'), 'GUARDRAIL.md sealed room contributes NO candidate (L2)');
    ok(res.skip_reasons.sealed_room >= 1, 'sealed room counted in skip_reasons.sealed_room');
    ok(!findCand(cands, 'room-optout'), 'brain_cross_room:false room contributes NO candidate (L3)');
    ok(res.skip_reasons.opt_out >= 1, 'opted-out room counted in skip_reasons.opt_out');

    rmrf(tmp);
  }

  // ----- Test 10: semantic graceful degradation -----
  {
    // (a) No embeddings anywhere -> no 'semantic' candidate.
    const tmp = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    let m = loadModuleFresh();
    let res = await m.aggregateRelevanceCandidates(path.join(tmp, 'room-focus'), { focus_section: 'strategy' });
    ok(res.candidates.every(function (c) { return c.signal !== 'semantic'; }),
      'semantic degrades gracefully: NO semantic candidate without room-local vectors');
    // room-sem falls back to shared_entity (no framework/problem_type match).
    const semFallback = findCand(res.candidates, 'room-sem');
    ok(semFallback && semFallback.signal === 'shared_entity',
      'no-vector peer degrades to shared_entity (not dropped, not Brain-filled)');
    rmrf(tmp);

    // (b) Seed a room-local embedding pair -> semantic fires for that pair.
    const tmp2 = freshTmpRoot();
    process.env.MINDRIAN_ROOMS_ROOT = tmp2;
    seedEmbedding(path.join(tmp2, 'room-focus'), 'strategy', [1, 0, 0, 0]);
    seedEmbedding(path.join(tmp2, 'room-sem'), 'strategy', [1, 0, 0, 0]);
    m = loadModuleFresh();
    res = await m.aggregateRelevanceCandidates(path.join(tmp2, 'room-focus'), { focus_section: 'strategy' });
    const sem = findCand(res.candidates, 'room-sem');
    ok(sem && sem.signal === 'semantic', 'room-local embedding pair -> semantic signal fires');
    ok(sem && sem.relevance >= 0.99, 'identical local vectors -> semantic relevance ~1.0');
    rmrf(tmp2);
  }

  // ----- Test 11: registry-less fallback -----
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xroom-rel-empty-'));
    process.env.MINDRIAN_ROOMS_ROOT = tmp;
    const m = loadModuleFresh();
    const res = await m.aggregateRelevanceCandidates(path.join(tmp, 'room-focus'), {});
    ok(res.reason === 'no_registry', 'registry-less: reason === no_registry');
    ok(Array.isArray(res.candidates) && res.candidates.length === 0, 'registry-less: empty candidates');
    rmrf(tmp);
  }

  console.log('\n[' + passed + '/' + (passed + failed) + ' passed]');
  process.exit(failed === 0 ? 0 : 1);
})().catch(function (err) {
  console.error('fatal: ' + (err && err.stack ? err.stack : err));
  process.exit(2);
});
