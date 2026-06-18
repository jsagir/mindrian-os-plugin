'use strict';
// Phase 163-03 -- lens domain family activation + domain-hierarchy synthesizer.
//
// WAVE 3 FOUNDATION-C. This suite proves the lens-engine domain family is ACTIVE
// (D-163-01 / D-163-04): the five Engine-1 decomposition lenses (disciplinary /
// stakeholder / system / temporal / scale) plus the domain-hierarchy synthesizer
// that emits the domain -> subdomain -> focus_area tree + the cross_links each
// lens surfaced. It also asserts the OTHER reserved families (framework / trend)
// stay client_count 0 (no over-activation; the broader v1.14.0 lens migrations
// are out of scope per 163-CONTEXT).
//
// Canon Part 2 Engine 1: the five lenses ARE the decomposition lenses.
// Canon Part 8: rotate() runs over an in-memory db handle the test owns; the
//   synthesizer is pure (no egress); the cross_links carry only node ids + a
//   relation enum.
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE). node:sqlite builds an in-memory
// migrated-nodes-schema db so there is no SKIP path.

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const lensEnginePath = path.join(REPO_ROOT, 'lib', 'core', 'lens-engine.cjs');
const synthPath = path.join(REPO_ROOT, 'lib', 'core', 'synthesizers', 'domain-hierarchy.cjs');
const { rotate, LENS_REGISTRY } = require(lensEnginePath);
const { synthesizeDomainHierarchy } = require(synthPath);

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}
async function checkAsync(label, fn) {
  total += 1;
  await fn();
  pass += 1;
  console.log('  ok -', label);
}

// In-memory db with the Phase-109-migrated nodes schema + edges table so the
// engine's writeLensFinding / writeEdge round-trip. No SKIP path.
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
  // The memory_event log table the engine's logMemoryEvent writes to. Defensive
  // emission must not crash the rotation; create it so the journaling path is real.
  db.exec(
    "CREATE TABLE memory_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, " +
    "payload TEXT DEFAULT '{}', created_at INTEGER NOT NULL);"
  );
  return db;
}

async function main() {
  console.log('test-lens-domain-family');

  // -------------------------------------------------------------------------
  // Test 1: the domain family is ACTIVE with the five decomposition lenses.
  // -------------------------------------------------------------------------
  check('Test 1 -- LENS_REGISTRY.domain is active with the five Engine-1 lenses', () => {
    assert.ok(LENS_REGISTRY.domain, 'domain family present in the registry');
    assert.ok(LENS_REGISTRY.domain.client_count > 0, `domain client_count > 0 (got ${LENS_REGISTRY.domain.client_count})`);
    const sets = LENS_REGISTRY.domain.lens_sets;
    assert.ok(Array.isArray(sets), 'domain lens_sets is an array');
    for (const lens of ['disciplinary', 'stakeholder', 'system', 'temporal', 'scale']) {
      assert.ok(sets.includes(lens), `domain lens_sets includes '${lens}'`);
    }
    assert.ok(
      Array.isArray(LENS_REGISTRY.domain.synthesizers) && LENS_REGISTRY.domain.synthesizers.includes('domain-hierarchy'),
      "domain synthesizers includes 'domain-hierarchy'"
    );
  });

  // -------------------------------------------------------------------------
  // Test 2: rotate({lensType:'domain', ...}) runs (no longer lens_family_reserved).
  // -------------------------------------------------------------------------
  await checkAsync("Test 2 -- rotate(lensType:'domain') returns ok:true", async () => {
    const db = freshDb();
    // A stub perLensFn: each lens decomposes the topic to one subdomain + one
    // focus_area + one cross-link to an existing node.
    const perLensFn = (lens, ctx) => ({
      summary: `${lens} lens on ${ctx.topic}`,
      topic: ctx.topic,
      domain: ctx.topic,
      subdomains: [{ name: `${lens}-subdomain`, focus_areas: [`${lens}-focus`] }],
      cross_links: [{ target_id: `claim:${lens}`, relation: 'tagged_with' }],
    });
    const out = await rotate({
      lensType: 'domain',
      lensSet: 'domain-five',
      input: { roomDir: '/tmp/nonexistent-room-163', topic: 'Quantum Imaging', db, sessionId: 's-test' },
      perLensFn,
      synthesize: 'domain-hierarchy',
      surfaceSelector: 'F.1',
    });
    assert.equal(out.ok, true, `expected ok:true, got ${JSON.stringify(out)}`);
    assert.ok(Array.isArray(out.findingIds), 'findingIds present');
    assert.equal(out.findingIds.length, 5, 'five lenses produced five findings');
    assert.ok(out.synthesis && Array.isArray(out.synthesis.subdomains), 'synthesis carries subdomains');
    assert.equal(out.synthesis.subdomains.length, 5, 'one subdomain per lens');
    db.close();
  });

  // -------------------------------------------------------------------------
  // Test 2b: rotate() formerly returned {ok:false, reason:'lens_family_reserved'}
  //          for domain; assert it no longer does.
  // -------------------------------------------------------------------------
  await checkAsync('Test 2b -- domain rotate no longer returns lens_family_reserved', async () => {
    const out = await rotate({
      lensType: 'domain',
      lensSet: 'domain-five',
      input: { topic: 'X' },
      perLensFn: () => ({ summary: 's', topic: 'X' }),
      synthesize: 'domain-hierarchy',
    });
    assert.notEqual(out.reason, 'lens_family_reserved', 'domain is no longer a reserved family');
    assert.equal(out.ok, true, 'domain rotate runs');
  });

  // -------------------------------------------------------------------------
  // Test 3: synthesizeDomainHierarchy emits the {domain, subdomains, cross_links} tree.
  // -------------------------------------------------------------------------
  check('Test 3 -- synthesizeDomainHierarchy emits the tree + cross_links', () => {
    const findingNodes = [
      {
        id: 'lens_finding:domain:s1:disciplinary',
        lens: 'disciplinary',
        lensType: 'domain',
        topic: 'Quantum Imaging',
        summary: 'disciplinary view',
        raw: {
          domain: 'Quantum Imaging',
          subdomains: [{ name: 'Quantum Sensing', focus_areas: ['NV centers', 'spin readout'] }],
          cross_links: [{ target_id: 'opportunity:opp-01', relation: 'tagged_with' }],
        },
      },
      {
        id: 'lens_finding:domain:s1:stakeholder',
        lens: 'stakeholder',
        lensType: 'domain',
        topic: 'Quantum Imaging',
        summary: 'stakeholder view',
        raw: {
          subdomains: ['Clinical Adoption'],
          related: ['claim:c-42'],
        },
      },
    ];
    const tree = synthesizeDomainHierarchy(findingNodes);
    assert.equal(tree.domain, 'Quantum Imaging', 'domain label resolved');
    assert.equal(tree.subdomains.length, 2, 'two subdomains (one per lens)');
    const sensing = tree.subdomains.find((s) => s.name === 'Quantum Sensing');
    assert.ok(sensing, 'the disciplinary subdomain is present');
    assert.deepEqual(sensing.focus_areas, ['NV centers', 'spin readout'], 'focus_areas preserved');
    const clinical = tree.subdomains.find((s) => s.name === 'Clinical Adoption');
    assert.ok(clinical, 'the bare-string subdomain normalized');
    assert.deepEqual(clinical.focus_areas, [], 'a bare subdomain has empty focus_areas');
    assert.equal(tree.cross_links.length, 2, 'two cross_links across the two lenses');
    const tagged = tree.cross_links.find((l) => l.target_id === 'opportunity:opp-01');
    assert.ok(tagged, 'the object-form cross link present');
    assert.equal(tagged.relation, 'tagged_with', 'explicit relation enum preserved');
    const bare = tree.cross_links.find((l) => l.target_id === 'claim:c-42');
    assert.ok(bare, 'the bare-string cross link normalized');
    assert.equal(bare.relation, 'related_to', 'a bare cross link defaults relation related_to');
  });

  // Test 3b: empty / malformed input is defensive (never throws).
  check('Test 3b -- synthesizeDomainHierarchy is defensive on empty/malformed input', () => {
    const a = synthesizeDomainHierarchy([]);
    assert.deepEqual(a, { domain: '', subdomains: [], cross_links: [] });
    const b = synthesizeDomainHierarchy(null);
    assert.deepEqual(b, { domain: '', subdomains: [], cross_links: [] });
    const c = synthesizeDomainHierarchy([null, 42, 'x', {}]);
    assert.equal(c.subdomains.length, 0, 'malformed nodes contribute nothing');
  });

  // -------------------------------------------------------------------------
  // Test 4: framework + trend stay reserved (client_count 0) -- no over-activation.
  // -------------------------------------------------------------------------
  check('Test 4 -- framework + trend families stay reserved (client_count 0)', () => {
    assert.equal(LENS_REGISTRY.framework.client_count, 0, 'framework stays reserved');
    assert.equal(LENS_REGISTRY.framework.reserved_for, 'v1.14.0', 'framework still reserved_for v1.14.0');
    assert.equal(LENS_REGISTRY.trend.client_count, 0, 'trend stays reserved');
    assert.equal(LENS_REGISTRY.trend.reserved_for, 'v1.14.0', 'trend still reserved_for v1.14.0');
  });

  console.log(`\nPASS (${pass}/${total})`);
  if (pass !== total) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
