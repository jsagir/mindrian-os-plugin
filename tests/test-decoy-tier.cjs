/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-06 Task 1 -- decoy-tier dispatcher test harness.
 *
 * Covers selectDecoys() per RESEARCH.md DISCRETION-AMEND-02 verbatim:
 *   - Tier 0/1/2 dispatch with topic-coverage backstop
 *   - 5 perturbation axes round-robin (wrong_owner / wrong_dependency /
 *     wrong_metric / wrong_scope / wrong_invariant)
 *   - tierOverride forces tier
 *   - decoy_opt_out preference returns empty decoy set
 *   - distribution_seed is deterministic 16-hex
 *   - Canon Part 8: zero network egress
 *
 * Implementing plan: .planning/phases/88.2-uiux-selector-block/88.2-06-PLAN.md (Task 1)
 */
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { selectDecoys, _internal } = require('../lib/hmi/decoy-tier.cjs');
const { detectTier, PERTURBATION_AXES } = _internal;

function tmpArtifact(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmp-decoy-'));
  const p = path.join(dir, 'PLAN.md');
  fs.writeFileSync(p, content);
  return p;
}

test('detectTier returns tier-0 on cold start (no profile, no Brain)', () => {
  const r = detectTier({ profile: null, roleBlend: null, brainAvailable: false });
  assert.equal(r.tier, 'tier-0');
});

test('detectTier returns tier-1 when Brain reachable + profile immature', () => {
  const r = detectTier({ profile: { rounds_total: 5 }, roleBlend: null, brainAvailable: true });
  assert.equal(r.tier, 'tier-1');
});

test('detectTier returns tier-2 when profile mature + persona signal + topic coverage', () => {
  const r = detectTier({
    profile: {
      rounds_total: 137,
      weak_spots: [{ topic: 'a' }, { topic: 'b' }],
      strong_spots: [{ topic: 'c' }, { topic: 'd' }],
    },
    roleBlend: { founder: 0.6 },
    brainAvailable: true,
  });
  assert.equal(r.tier, 'tier-2');
  assert.equal(r.reason, 'profile_mature_persona_signal');
});

test('topic-coverage backstop: profile mature but coverage < 3 falls back to tier-1', () => {
  const r = detectTier({
    profile: { rounds_total: 200, weak_spots: [{ topic: 'a' }], strong_spots: [] },
    roleBlend: { founder: 0.5 },
    brainAvailable: true,
  });
  assert.equal(r.tier, 'tier-1');
});

test('persona-signal backstop: profile mature + topic coverage but no roleBlend axis >= 0.3 -> tier-1', () => {
  const r = detectTier({
    profile: {
      rounds_total: 200,
      weak_spots: [{ topic: 'a' }, { topic: 'b' }],
      strong_spots: [{ topic: 'c' }],
    },
    roleBlend: { founder: 0.1, researcher: 0.2 },
    brainAvailable: true,
  });
  assert.equal(r.tier, 'tier-1');
});

test('tierOverride forces tier', () => {
  assert.equal(detectTier({ tierOverride: 'tier-2' }).tier, 'tier-2');
  assert.equal(detectTier({ tierOverride: 'tier-0' }).tier, 'tier-0');
  assert.equal(detectTier({ tierOverride: 'tier-1' }).tier, 'tier-1');
});

test('selectDecoys with cold-start returns 4 decoys at default roundSize=20', () => {
  const p = tmpArtifact(
    '# Phase 89 reverse-salient-engine\n' +
    '- Phase 89 ships rs-external Pinecone with public OpenAlex metadata\n' +
    '- Phase 90 ships brain-derivation-layer with Neo4j integration\n' +
    '- Tier 2 reads STATE.md role_blend at threshold 0.7\n' +
    '- always emit edges via lib/core/navigation\n'
  );
  // Cold-start: no profile, no Brain. Explicit brainAvailable:false so the
  // env-var fallback (MINDRIAN_BRAIN_KEY) cannot promote this run to tier-1.
  const out = selectDecoys({ artifactPath: p, brainAvailable: false });
  assert.equal(out.decoys.length, 4);
  assert.equal(out.tier, 'tier-0');
});

test('selectDecoys distribution_seed is 16 hex chars', () => {
  const p = tmpArtifact('# claim\n- one thing happens at threshold 5 with public metadata\n');
  const out = selectDecoys({ artifactPath: p });
  assert.match(out.distribution_seed, /^[0-9a-f]{16}$/);
});

test('selectDecoys 5 perturbation axes used round-robin in order on first cycle', () => {
  const p = tmpArtifact(
    '- Phase 89 ships rs-external Pinecone with public metadata\n' +
    '- Phase 90 ships brain-derivation with Neo4j threshold 0.7\n' +
    '- Tier 2 reads STATE.md in private scope\n' +
    '- public metadata always available\n' +
    '- Phase 91 emits edges with always invariant\n' +
    '- never bypass auth at threshold 0.5\n' +
    '- Pinecone always public scope\n'
  );
  const out = selectDecoys({ artifactPath: p, roundSize: 20, realCount: 15 }); // 5 decoys
  const axes = out.decoys.map(d => d.perturbation_axis);
  assert.deepEqual(axes, PERTURBATION_AXES);
});

test('selectDecoys decoy_opt_out preference returns empty decoy set', () => {
  const p = tmpArtifact('- a claim about something at threshold 5 in public scope\n');
  const out = selectDecoys({
    artifactPath: p,
    profile: {
      rounds_total: 200,
      weak_spots: [],
      strong_spots: [],
      preferences: { decoy_opt_out: true },
    },
  });
  assert.equal(out.decoys.length, 0);
  assert.equal(out.tier_reason, 'decoy_opt_out_user_preference');
});

test('selectDecoys preserves was_decoy: true on every decoy', () => {
  const p = tmpArtifact('- claim one at threshold 5 in public scope\n- claim two with always invariant\n');
  const out = selectDecoys({ artifactPath: p });
  for (const d of out.decoys) assert.equal(d.was_decoy, true);
});

test('selectDecoys all decoys carry perturbation_axis from PERTURBATION_AXES', () => {
  const p = tmpArtifact('- claim at threshold 5 in public scope with always invariant\n');
  const out = selectDecoys({ artifactPath: p });
  for (const d of out.decoys) assert.ok(PERTURBATION_AXES.indexOf(d.perturbation_axis) !== -1);
});

test('selectDecoys with roundSize=15 returns 3 decoys (default 4:1)', () => {
  const p = tmpArtifact('- claim a threshold 5 public scope\n- claim b always invariant\n');
  const out = selectDecoys({ artifactPath: p, roundSize: 15 });
  assert.equal(out.decoys.length, 3);
});

test('selectDecoys with explicit realCount=10 of 20 returns 10 decoys', () => {
  const p = tmpArtifact('- claim threshold 5 public scope always invariant\n');
  const out = selectDecoys({ artifactPath: p, roundSize: 20, realCount: 10 });
  assert.equal(out.decoys.length, 10);
});

test('PERTURBATION_AXES has exactly 5 entries in canonical order', () => {
  assert.equal(PERTURBATION_AXES.length, 5);
  assert.deepEqual(PERTURBATION_AXES, [
    'wrong_owner',
    'wrong_dependency',
    'wrong_metric',
    'wrong_scope',
    'wrong_invariant',
  ]);
});

test('Canon Part 8 zero-network: decoy-tier.cjs has no http/https/fetch/axios', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'lib', 'hmi', 'decoy-tier.cjs'), 'utf8');
  let code = src;
  code = code.replace(/\/\*[\s\S]*?\*\//g, '');
  code = code.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const forbidden = [
    /fetch\s*\(/,
    /\bhttps:\/\//,
    /\bhttp:\/\//,
    /\baxios\b/,
    /brain[-_]client/i,
    /brain\.mindrian\.ai/i,
  ];
  for (const re of forbidden) {
    assert.equal(re.test(code), false, 'forbidden pattern matched: ' + re);
  }
});

test('selectDecoys tier-2 reduces decoy frequency on strong_spots topics (persona-aware bias)', () => {
  const p = tmpArtifact(
    '- Phase 89 ships rs-external Pinecone with public metadata\n' +
    '- Phase 90 brain-derivation with Neo4j threshold 0.7\n' +
    '- always emit edges in private scope\n'
  );
  const out = selectDecoys({
    artifactPath: p,
    profile: {
      rounds_total: 200,
      weak_spots: [{ topic: 'cascade' }, { topic: 'edges' }],
      strong_spots: [{ topic: 'pinecone' }, { topic: 'metadata' }],
    },
    roleBlend: { founder: 0.6 },
    brainAvailable: true,
  });
  assert.equal(out.tier, 'tier-2');
  assert.ok(out.decoys.length > 0, 'tier-2 still produces decoys');
});
