'use strict';
// Quick task 260903-gct -- SOURCED_FROM additive-floor + RELATED_TO
// non-breaking soft-deprecation proof (R16 of the ratified MOS Reasoning
// Constitution v3.1.0 section 2.2, navigator sign-off 2026-09-03).
//
// This is a FLOOR test (per the edges.cjs "Tests assert a FLOOR ... not an
// exact size" contract, edges.cjs lines 30-31): it asserts SOURCED_FROM is
// present AND that every prior member is STILL present, mirroring
// test-edges-domain-taxonomy-floor.cjs. It NEVER asserts `.size`. NO
// em-dashes.
//
// The bare 4-column table (source, target, type, properties) deliberately
// exercises writeEdge's NARROW-schema branch (the Phase 273 C2 / D-01b path,
// edges.cjs lines 944-953) -- the same branch test-edges-domain-taxonomy-
// floor.cjs uses. The wide review_status branch is out of scope here.

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { ALLOWED_EDGE_TYPES, DEPRECATED_EDGE_TYPES, writeEdge } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs')
);

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

function freshEdgesDb() {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type));"
  );
  return db;
}

async function main() {
  console.log('test-edges-sourced-from-floor');

  // Register the warning collector BEFORE any write -- process.emitWarning
  // delivers on a later tick, not synchronously, so we collect across the
  // whole run and assert at the end (after the setImmediate tick below).
  const collectedWarnings = [];
  process.on('warning', (w) => {
    collectedWarnings.push({ name: w.name, code: w.code });
  });

  // (1) SOURCED_FROM is in ALLOWED_EDGE_TYPES.
  check('SOURCED_FROM is in ALLOWED_EDGE_TYPES', () => {
    assert.equal(ALLOWED_EDGE_TYPES.has('SOURCED_FROM'), true, 'missing SOURCED_FROM');
  });

  // (2) THE FLOOR: every prior member is STILL present (additive,
  //     never-delete). The full pre-change vocabulary, 42 names, asserted by
  //     named membership -- never a count.
  const FLOOR = [
    'DEFERRED', 'REJECTED', 'DERIVED_FROM', 'FILED_AS_DECISION', 'FOLLOWS_FROM',
    'OPERATOR_TRANSITION', 'INFORMS', 'REJECTED_BECAUSE', 'CONTRADICTS', 'SUPERSEDES',
    'AFFILIATED_WITH', 'PIVOTED', 'SELECTED_REACH', 'FEEDS_INTO', 'VALIDATES',
    'STATES', 'SUPPORTS', 'DESCRIBES', 'REFINES', 'ROOT_CAUSES', 'INSTANTIATES',
    'DECOMPOSED_INTO', 'PART_OF', 'TAGGED_WITH', 'RELATED_TO', 'CONVERGES',
    'INVALIDATES', 'ENABLES', 'NESTED_WITHIN', 'SHARES_JOB', 'ELEVATES_TO',
    'UMBILICAL_TO', 'DISCOVERED', 'AUTHORED_BY', 'REMEMBERED_AS', 'ATTRIBUTED_TO',
    'NOT_REMEMBERED_BECAUSE', 'COMPETES_WITH', 'USES_COMPONENT', 'SUPPLIES_TO',
    'CONCERNS', 'MAPS_TO_SECTION',
  ];
  assert.equal(FLOOR.length, 42, 'FLOOR vocabulary must name exactly 42 prior members');
  check('all 42 prior FLOOR members preserved', () => {
    for (const t of FLOOR) {
      assert.equal(ALLOWED_EDGE_TYPES.has(t), true, `missing prior member ${t}`);
    }
  });

  // (3) Still a frozen Set instance.
  check('ALLOWED_EDGE_TYPES is a frozen Set instance', () => {
    assert.equal(ALLOWED_EDGE_TYPES instanceof Set, true);
    assert.equal(Object.isFrozen(ALLOWED_EDGE_TYPES), true);
  });

  // (4) DEPRECATED_EDGE_TYPES is a frozen Map, contains RELATED_TO, and does
  //     NOT contain SOURCED_FROM or any other currently-live type.
  check('DEPRECATED_EDGE_TYPES is a frozen Map containing only RELATED_TO', () => {
    assert.equal(DEPRECATED_EDGE_TYPES instanceof Map, true);
    assert.equal(Object.isFrozen(DEPRECATED_EDGE_TYPES), true);
    assert.equal(DEPRECATED_EDGE_TYPES.has('RELATED_TO'), true, 'RELATED_TO must be deprecated');
    assert.equal(DEPRECATED_EDGE_TYPES.has('SOURCED_FROM'), false, 'SOURCED_FROM must not be deprecated');
    for (const t of FLOOR) {
      if (t === 'RELATED_TO') continue;
      assert.equal(DEPRECATED_EDGE_TYPES.has(t), false, `${t} must not be deprecated`);
    }
  });

  const db = freshEdgesDb();

  // (5) Live round-trip: a SOURCED_FROM write returns ok:true, written:true,
  //     and deprecated === undefined.
  check('writeEdge accepts SOURCED_FROM, no deprecated field', () => {
    const r = writeEdge(db, {
      source_id: 'claim:c-01', target_id: 'artifact:a-01',
      edge_type: 'SOURCED_FROM', properties: { relation: 'sourced' },
    });
    assert.equal(r.ok, true, `expected ok:true, got ${JSON.stringify(r)}`);
    assert.equal(r.written, true);
    assert.equal(r.deprecated, undefined, 'SOURCED_FROM must not be flagged deprecated');
  });

  // (6) THE NON-BREAKING GUARANTEE (the point of the whole deprecation
  //     design): a RELATED_TO write still returns ok:true and written:true.
  //     Cite F-04: 77 call sites across 43 files read `.ok` and
  //     room-birth.cjs:948 rolls back a room birth on `!ok`, so a
  //     deprecation that flipped `ok` would be a 43-file regression, not a
  //     fix. Two distinct source/target pairs so the second write below is a
  //     real second insert, not an ON CONFLICT no-op (needed for the
  //     once-per-process warning-count proof in step 10).
  let relatedToFirst;
  let relatedToSecond;
  check('writeEdge: RELATED_TO write #1 still returns ok:true, written:true', () => {
    relatedToFirst = writeEdge(db, {
      source_id: 'domain:biotech', target_id: 'domain:materials-science',
      edge_type: 'RELATED_TO', properties: { relation: 'cross_domain' },
    });
    assert.equal(relatedToFirst.ok, true, `expected ok:true, got ${JSON.stringify(relatedToFirst)}`);
    assert.equal(relatedToFirst.written, true);
  });
  check('writeEdge: RELATED_TO write #2 (different pair) still returns ok:true, written:true', () => {
    relatedToSecond = writeEdge(db, {
      source_id: 'domain:biotech', target_id: 'domain:ai-ml',
      edge_type: 'RELATED_TO', properties: { relation: 'cross_domain' },
    });
    assert.equal(relatedToSecond.ok, true, `expected ok:true, got ${JSON.stringify(relatedToSecond)}`);
    assert.equal(relatedToSecond.written, true);
  });

  // (7) The RELATED_TO write additionally carries deprecated === true.
  check('RELATED_TO writes carry deprecated === true', () => {
    assert.equal(relatedToFirst.deprecated, true);
    assert.equal(relatedToSecond.deprecated, true);
  });

  // (8) HONEST NEGATIVE: RELATES_TO (the misspelling the constitution
  //     explicitly corrected) still returns ok:false, reason invalid_edge_type.
  check('writeEdge rejects RELATES_TO (the misspelling), invalid_edge_type', () => {
    const r = writeEdge(db, {
      source_id: 'n:x', target_id: 'n:y', edge_type: 'RELATES_TO', properties: {},
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_edge_type');
  });

  // (9) A made-up type still returns ok:false, reason invalid_edge_type.
  check('writeEdge rejects a made-up edge type, invalid_edge_type', () => {
    const r = writeEdge(db, {
      source_id: 'n:x', target_id: 'n:y', edge_type: 'TOTALLY_NOT_A_REAL_EDGE', properties: {},
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'invalid_edge_type');
  });

  db.close();

  // Let the queued process.emitWarning calls land. process.emitWarning
  // delivers asynchronously on a later tick, never synchronously -- do not
  // "simplify" this into a bare synchronous assertion, it will flake.
  await new Promise((resolve) => setImmediate(resolve));

  // (10) Once-per-process guard proof: exactly ONE MOS_DEP_EDGE_RELATED_TO
  //      warning landed, even though TWO distinct RELATED_TO writes happened
  //      above.
  check('exactly one MOS_DEP_EDGE_RELATED_TO warning fired (once-per-process guard)', () => {
    const relatedToWarnings = collectedWarnings.filter((w) => w.code === 'MOS_DEP_EDGE_RELATED_TO');
    assert.equal(relatedToWarnings.length, 1, `expected exactly 1, got ${JSON.stringify(relatedToWarnings)}`);
    assert.equal(relatedToWarnings[0].name, 'DeprecationWarning');
  });

  // (11) A rejected type and a healthy type both stay silent: zero warnings
  //      carry MOS_DEP_EDGE_RELATES_TO or MOS_DEP_EDGE_SOURCED_FROM.
  check('RELATES_TO and SOURCED_FROM never warn', () => {
    const badCodes = collectedWarnings.filter(
      (w) => w.code === 'MOS_DEP_EDGE_RELATES_TO' || w.code === 'MOS_DEP_EDGE_SOURCED_FROM'
    );
    assert.equal(badCodes.length, 0, `expected 0, got ${JSON.stringify(badCodes)}`);
  });

  console.log(`\nPASS (${pass}/12)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
