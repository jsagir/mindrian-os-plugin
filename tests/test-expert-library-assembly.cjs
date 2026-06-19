'use strict';
// Phase 164-02 Task 2 -- library-first assembly test suite (E1 / D-164-S1; the
// 164-EXPERT-LIFECYCLE.md ranking + freshness gate + anti-ossification guards).
//
// WAVE 2. With the SyntheticExpert writer shipped (Task 1), this wave ships
// lib/core/expert-library.cjs -- the library-first team assembly. For each needed
// (hat, subdomain) slot, query CONFIRMED SyntheticExpert nodes, rank by the
// lifecycle score (evidence_tier_rank + survival_rate + recency_decay -
// staleness_penalty -- all LOCAL scalars, a pure navigation.cjs graph walk, no
// Brain, no raw room.db), slot a hit, return a generate-fresh marker on a miss.
//
// Canon Part 8: ZERO Brain calls; ZERO raw room.db open (the reader walks the
//   graph via the navigation chokepoint over a caller-owned db handle).
// Canon Part 2 team discipline: the anti-ossification guards (164-EXPERT-LIFECYCLE.md
//   section 3) -- at least one freshly-generated slot per run, the Black hat always
//   re-derived, and at most K of N slots filled from the library with a log() when
//   the cap bites.
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE). node:sqlite builds an in-memory
// migrated-nodes-schema db (the typed-domain test idiom) so there is no SKIP path.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const expertLibraryPath = path.join(REPO_ROOT, 'lib', 'core', 'expert-library.cjs');
const {
  rankExpertsForSlot, isExpertStale, assembleTeam, offerExpertsForFiling, DEFAULT_WEIGHTS,
} = require(expertLibraryPath);

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}

function freshDb() {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE nodes (' +
    '  id TEXT PRIMARY KEY, ' +
    '  type TEXT NOT NULL, ' +
    "  properties TEXT DEFAULT '{}', " +
    '  source_path TEXT NOT NULL, ' +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    '  confidence REAL, ' +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    '  created_at INTEGER NOT NULL, ' +
    '  last_seen_at INTEGER NOT NULL, ' +
    '  source_section TEXT, ' +
    '  confirmed_by TEXT, ' +
    '  confirmed_at INTEGER' +
    ')'
  );
  db.exec(
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type));"
  );
  return db;
}

// Seed a confirmed SyntheticExpert node with generic-lens props.
function seedExpert(db, id, propsObj, reviewStatus) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, 'SyntheticExpert', ?, ?, 'system', ?, ?, ?)"
  ).run(id, JSON.stringify(propsObj), 'expert:' + id, reviewStatus || 'confirmed', nowMs, nowMs);
}

function seedNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, ?, '{}', ?, 'system', 'confirmed', ?, ?)"
  ).run(id, type, 'node:' + id, nowMs, nowMs);
}

function seedEdge(db, source, target, type) {
  db.prepare(
    "INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, '{}')"
  ).run(source, target, type);
}

const NOW = Date.now();
function expertProps(over) {
  return {
    hat: 'White', name: 'Oncology', surname: 'Immunotherapy', archetype: 'Researcher',
    beautiful_question: 'Why do we believe this is true?',
    research_approach: 'Tavily + arxiv',
    evidence_tier: 'Operational', invocation_count: 1, last_used: NOW,
    governing_thought_hash: 'h-abc', subdomain: 'Immunotherapy', domain: 'Oncology',
    provenance: { runId: 'r1', domainNodeIds: [] },
    ...over,
  };
}

console.log('test-expert-library-assembly');

// Test 1: rankExpertsForSlot returns confirmed experts ordered by match tier then
//         score; a miss returns an empty list (caller generates fresh).
check('Test 1 -- rankExpertsForSlot ranks confirmed experts by tier+score; miss -> []', () => {
  const db = freshDb();
  // exact hat+subdomain (tier 1).
  seedExpert(db, 'e-exact', expertProps({ evidence_tier: 'Academic' }));
  // exact hat + same domain, different subdomain (tier 2).
  seedExpert(db, 'e-domain', expertProps({ surname: 'CellTherapy', subdomain: 'CellTherapy', evidence_tier: 'Academic' }));
  // exact hat + same archetype only (tier 3).
  seedExpert(db, 'e-arche', expertProps({ name: 'Finance', surname: 'BioPharma', subdomain: 'BioPharma', domain: 'Finance', evidence_tier: 'Academic' }));
  // a PROPOSED (not confirmed) exact match must NOT be returned.
  seedExpert(db, 'e-proposed', expertProps({ surname: 'Immunotherapy' }), 'proposed');

  const ranked = rankExpertsForSlot(db, { hat: 'White', subdomain: 'Immunotherapy', domain: 'Oncology', archetype: 'Researcher' });
  assert.ok(Array.isArray(ranked), 'returns an array');
  assert.ok(ranked.length >= 1, 'at least the exact match is returned');
  assert.equal(ranked[0].id, 'e-exact', 'the exact hat+subdomain match ranks first (tier 1)');
  // the proposed node is excluded.
  assert.equal(ranked.some((e) => e.id === 'e-proposed'), false, 'a proposed expert is never ranked');
  // ranking entries carry a numeric score and a match tier.
  assert.equal(typeof ranked[0].score, 'number', 'each entry carries a score');
  assert.equal(ranked[0].matchTier, 1, 'the exact match is tier 1');

  // a miss (no confirmed expert for this hat) returns [].
  const miss = rankExpertsForSlot(db, { hat: 'Green', subdomain: 'Nothing', domain: 'Nowhere', archetype: 'Student' });
  assert.deepEqual(miss, [], 'a miss returns an empty list');
  db.close();
});

// Test 2: survival_rate is a pure navigation graph walk over the expert's
//         STATES/SUPPORTS edges to past rulings; an overruled expert scores lower.
check('Test 2 -- survival_rate sinks an overruled expert below a ruling expert', () => {
  const db = freshDb();
  // two experts, identical generic lens, differ ONLY in past-ruling survival.
  seedExpert(db, 'e-survivor', expertProps({ surname: 'Immunotherapy' }));
  seedExpert(db, 'e-overruled', expertProps({ surname: 'Immunotherapy2', subdomain: 'Immunotherapy' }));
  // survivor STATES a reading that became a RULING (a decision node).
  seedNode(db, 'reading-1', 'claim');
  seedNode(db, 'ruling-1', 'decision');
  seedEdge(db, 'e-survivor', 'reading-1', 'STATES');
  seedEdge(db, 'reading-1', 'ruling-1', 'INFORMS');
  // overruled SUPPORTS a reading that was REJECTED_BECAUSE.
  seedNode(db, 'reading-2', 'claim');
  seedNode(db, 'rej-2', 'decision');
  seedEdge(db, 'e-overruled', 'reading-2', 'SUPPORTS');
  seedEdge(db, 'reading-2', 'rej-2', 'REJECTED_BECAUSE');

  const ranked = rankExpertsForSlot(db, { hat: 'White', subdomain: 'Immunotherapy', domain: 'Oncology', archetype: 'Researcher' });
  const survivor = ranked.find((e) => e.id === 'e-survivor');
  const overruled = ranked.find((e) => e.id === 'e-overruled');
  assert.ok(survivor && overruled, 'both experts are ranked');
  assert.ok(survivor.survivalRate > overruled.survivalRate, 'the survivor has a higher survival_rate');
  assert.ok(survivor.score > overruled.score, 'the survivor outranks the overruled expert');
  db.close();
});

// Test 3: freshness gate -- a stale expert (subdomain claim-set hash mismatch) is
//         flagged stale and NOT returned for silent reuse.
check('Test 3 -- isExpertStale flags a hash mismatch; assembleTeam does not reuse it', () => {
  const db = freshDb();
  const expert = { id: 'e-stale', props: expertProps({ governing_thought_hash: 'OLD-hash' }) };
  // direct predicate.
  assert.equal(isExpertStale(db, expert, 'NEW-hash'), true, 'a hash mismatch is stale');
  assert.equal(isExpertStale(db, expert, 'OLD-hash'), false, 'a matching hash is fresh');

  // assembleTeam skips the stale expert and marks the slot generate-fresh.
  seedExpert(db, 'e-stale', expertProps({ governing_thought_hash: 'OLD-hash' }));
  const res = assembleTeam(db, {
    neededSlots: [{ hat: 'White', subdomain: 'Immunotherapy', domain: 'Oncology', archetype: 'Researcher', currentSubdomainHash: 'NEW-hash' }],
    opts: { reuseCap: 5 },
  });
  const slot = res.slots[0];
  assert.equal(slot.action, 'generate-fresh', 'a stale-only slot falls back to generate-fresh');
  assert.equal(slot.reusedExpertId == null, true, 'no stale expert was slotted');
  db.close();
});

// Test 4: anti-ossification -- mandatory fresh slot, Black always re-derived, reuse
//         cap K of N with a log() when it bites.
check('Test 4 -- anti-ossification: fresh slot + Black re-derived + reuse cap with log', () => {
  const db = freshDb();
  // seed a confirmed library hit for every slot (fresh hashes so nothing is stale).
  seedExpert(db, 'e-white', expertProps({ hat: 'White', surname: 'Immunotherapy', subdomain: 'Immunotherapy', governing_thought_hash: 'h1' }));
  seedExpert(db, 'e-yellow', expertProps({ hat: 'Yellow', name: 'Finance', surname: 'BioPharma', subdomain: 'BioPharma', domain: 'Finance', governing_thought_hash: 'h2' }));
  seedExpert(db, 'e-green', expertProps({ hat: 'Green', name: 'Operations', surname: 'ClinicalTrials', subdomain: 'ClinicalTrials', domain: 'Operations', governing_thought_hash: 'h3' }));
  seedExpert(db, 'e-black', expertProps({ hat: 'Black', name: 'Regulatory', surname: 'IND', subdomain: 'IND', domain: 'Regulatory', governing_thought_hash: 'h4' }));

  const logged = [];
  const res = assembleTeam(db, {
    neededSlots: [
      { hat: 'White', subdomain: 'Immunotherapy', domain: 'Oncology', archetype: 'Researcher', currentSubdomainHash: 'h1' },
      { hat: 'Yellow', subdomain: 'BioPharma', domain: 'Finance', archetype: 'Investor', currentSubdomainHash: 'h2' },
      { hat: 'Green', subdomain: 'ClinicalTrials', domain: 'Operations', archetype: 'Operator', currentSubdomainHash: 'h3' },
      { hat: 'Black', subdomain: 'IND', domain: 'Regulatory', archetype: 'Domain Expert', currentSubdomainHash: 'h4' },
    ],
    opts: { reuseCap: 2, log: (m) => logged.push(m) },
  });
  assert.ok(Array.isArray(res.slots) && res.slots.length === 4, 'four slots returned');

  // Black is ALWAYS generate-fresh (adversarial freshness), never a library hit.
  const black = res.slots.find((s) => s.hat === 'Black');
  assert.equal(black.action, 'generate-fresh', 'Black hat is always re-derived');
  assert.equal(black.reusedExpertId == null, true, 'Black never slots a library expert');

  // at least one slot is freshly generated (the mandatory-fresh guard).
  const freshCount = res.slots.filter((s) => s.action === 'generate-fresh').length;
  assert.ok(freshCount >= 1, 'at least one slot per run is freshly generated');

  // reuse cap K<N: at most reuseCap slots are filled from the library.
  const reusedCount = res.slots.filter((s) => s.action === 'reuse').length;
  assert.ok(reusedCount <= 2, 'reuse is capped at K=2');

  // the cap bit (4 eligible non-Black hits, cap 2), so a log() was emitted.
  assert.ok(logged.length >= 1, 'a log() summary was emitted when the cap bit');
  assert.ok(res.summary && typeof res.summary.reused === 'number' && typeof res.summary.generated === 'number',
    'a reused-vs-generated summary is returned');
  db.close();
});

// Test 5: offerExpertsForFiling returns a ranked candidate list (no AskUserQuestion;
//         the command surface renders the gate, the caller promotes via confirmNode).
check('Test 5 -- offerExpertsForFiling returns a ranked candidate list', () => {
  const candidates = offerExpertsForFiling([
    { hat: 'White', name: 'Oncology', surname: 'Immunotherapy', evidenceTier: 'Academic', survivalRate: 0.9 },
    { hat: 'Red', name: 'Strategic', surname: 'Moat', evidenceTier: 'Practitioner', survivalRate: 0.2 },
  ]);
  assert.ok(Array.isArray(candidates), 'returns an array');
  assert.equal(candidates.length, 2, 'one candidate per run hat');
  assert.equal(candidates[0].hat, 'White', 'the higher-contribution hat ranks first');
});

// Test 6: expert-library.cjs carries no Brain call and no raw room.db open (Part 8).
check('Test 6 -- expert-library.cjs makes zero Brain calls and no raw room.db open', () => {
  const src = fs.readFileSync(expertLibraryPath, 'utf8');
  assert.equal(/require\(['"][^'"]*room-db\.cjs['"]\)/.test(src), false, 'no room-db.cjs require');
  assert.equal(/require\(['"]node:sqlite['"]\)/.test(src), false, 'no node:sqlite require');
  assert.equal(/require\(['"][^'"]*brain[^'"]*['"]\)/i.test(src), false, 'no brain-client require');
  assert.equal(/openRoomDb\b/.test(src), false, 'never opens room.db itself (caller-owned handle)');
  assert.equal(/fetch\(|https?:\/\//.test(src), false, 'no network surface');
});

// DEFAULT_WEIGHTS sanity (the lifecycle score weights).
check('DEFAULT_WEIGHTS exposes w1..w4', () => {
  assert.ok(DEFAULT_WEIGHTS && typeof DEFAULT_WEIGHTS === 'object', 'weights object present');
  for (const k of ['w1', 'w2', 'w3', 'w4']) {
    assert.equal(typeof DEFAULT_WEIGHTS[k], 'number', `${k} is a number`);
  }
});

console.log(`\nPASS (${pass}/${total})`);
