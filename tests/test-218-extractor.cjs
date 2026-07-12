'use strict';
// Phase 218-02 Task 2 -- tier-1 entity-extractor test suite.
//
// entity-extractor.cjs is a PURE regex/heading parser: it reads artifact markdown
// prose and returns bounded, typed {entities, relations} candidates. It touches NO
// database and makes ZERO network calls (Canon Part 8). The dispatcher (Plan 03)
// resolves entity names to node ids and routes writes through navigation.
//
// This suite asserts the four behavioral contracts the plan names:
//   (a) maxPerArtifact bounded-output cap actually caps a greedy Title-Case flood
//   (b) every returned entity has the exact {entityType, name, sourceArtifactId}
//       shape with entityType in {company, technology, market}
//   (c) the null/empty-input never-throw contract
//   (d) the Part-8 zero-egress grep gate (no fetch/http/https import in the file)
// plus the motivating COMPETES_WITH relation on the Prodrive/Xtrac case.
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE). Plain-node assert/strict + check()
// counter per house convention. No network, no SKIP path.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const extractorPath = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'entity-extractor.cjs');
const { extractEntities } = require(extractorPath);

const VALID_TYPES = new Set(['company', 'technology', 'market']);

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}

// (c) null / empty / non-string input never throws, returns the empty shape.
check('null/empty/undefined input returns empty shape without throwing', () => {
  assert.deepEqual(extractEntities(null, {}), { entities: [], relations: [] });
  assert.deepEqual(extractEntities('', {}), { entities: [], relations: [] });
  assert.deepEqual(extractEntities(undefined, {}), { entities: [], relations: [] });
  assert.deepEqual(extractEntities(42, {}), { entities: [], relations: [] });
  // opts itself may be absent entirely.
  assert.deepEqual(extractEntities(null), { entities: [], relations: [] });
});

// Basic parse: capitalized proper nouns in body prose become entities; both
// arrays are always present.
check('parses proper nouns from body prose into typed entities', () => {
  const r = extractEntities('## Competitors\nProdrive is a rival of Xtrac.', { sourceArtifactId: 'a1' });
  assert.ok(Array.isArray(r.entities) && Array.isArray(r.relations), 'both arrays present');
  assert.ok(r.entities.length >= 2, 'Prodrive + Xtrac should both surface, got ' + r.entities.length);
  const names = r.entities.map((e) => e.name);
  assert.ok(names.includes('Prodrive'), 'Prodrive missing: ' + JSON.stringify(names));
  assert.ok(names.includes('Xtrac'), 'Xtrac missing: ' + JSON.stringify(names));
});

// (b) entity shape + type-set contract.
check('every entity has exact {entityType, name, sourceArtifactId} shape', () => {
  const r = extractEntities('## Market\nAcme Robotics targets the Defense sector.', { sourceArtifactId: 'art-77' });
  assert.ok(r.entities.length >= 1, 'expected at least one entity');
  for (const e of r.entities) {
    assert.deepEqual(Object.keys(e).sort(), ['entityType', 'name', 'sourceArtifactId'].sort(),
      'entity keys must be exactly entityType/name/sourceArtifactId, got ' + JSON.stringify(Object.keys(e)));
    assert.ok(VALID_TYPES.has(e.entityType), 'entityType out of set: ' + e.entityType);
    assert.equal(typeof e.name, 'string');
    assert.ok(e.name.length > 0, 'name must be non-empty');
    assert.equal(e.sourceArtifactId, 'art-77', 'sourceArtifactId must thread through from opts');
  }
});

// Heading context types the section: tokens under "## Competitors" lean company.
check('heading context types tokens (Competitors section -> company)', () => {
  const r = extractEntities('## Competitors\nProdrive is a rival of Xtrac.', { sourceArtifactId: 'a1' });
  const prodrive = r.entities.find((e) => e.name === 'Prodrive');
  assert.ok(prodrive, 'Prodrive entity present');
  assert.equal(prodrive.entityType, 'company', 'Competitors section should lean company');
});

// (a) bounded-output cap: a greedy Title-Case flood must not return an unbounded
// list. With maxPerArtifact = 5, no more than 5 entities come back.
check('maxPerArtifact caps a greedy Title-Case flood', () => {
  const flood = Array.from({ length: 200 }, (_, i) => 'Alpha' + i + ' Beta' + i + ' rivals Gamma' + i + '.').join('\n');
  const md = '## Competitors\n' + flood;
  const capped = extractEntities(md, { sourceArtifactId: 'flood', maxPerArtifact: 5 });
  assert.ok(capped.entities.length <= 5, 'cap=5 must hold, got ' + capped.entities.length);
  // And the default cap is finite too (not the full 200x flood).
  const dflt = extractEntities(md, { sourceArtifactId: 'flood' });
  assert.ok(dflt.entities.length <= 25, 'default cap should be <= 25, got ' + dflt.entities.length);
});

// Relation cue: a rivalry cue between two entity names on one line emits a
// COMPETES_WITH relation (the motivating Prodrive cross-classification case).
check('rivalry cue emits COMPETES_WITH relation between co-occurring names', () => {
  const r = extractEntities('## Competitors\nProdrive is a rival of Xtrac.', { sourceArtifactId: 'a1' });
  assert.ok(r.relations.length >= 1, 'expected at least one relation');
  const rel = r.relations.find((x) => x.edge_type === 'COMPETES_WITH');
  assert.ok(rel, 'COMPETES_WITH relation missing: ' + JSON.stringify(r.relations));
  assert.ok(typeof rel.source === 'string' && rel.source.length > 0, 'source must be a name');
  assert.ok(typeof rel.target === 'string' && rel.target.length > 0, 'target must be a name');
  assert.ok(rel.source !== rel.target, 'source and target must differ');
});

// Code spans are stripped before scanning (a backtick token is not an entity).
check('backtick code spans are stripped before scanning', () => {
  const r = extractEntities('## Notes\nThe `Widget` module ships. Prodrive is a rival of Xtrac.', { sourceArtifactId: 'a1' });
  const names = r.entities.map((e) => e.name);
  assert.ok(!names.includes('Widget'), 'code-span token Widget must not be extracted: ' + JSON.stringify(names));
});

// (d) Part-8 zero-egress grep gate on the source file itself.
check('zero-egress: no fetch/http/https/Brain surface in the extractor source', () => {
  const src = fs.readFileSync(extractorPath, 'utf8');
  assert.ok(!/\bfetch\s*\(/.test(src), 'no fetch(');
  assert.ok(!/require\(['"]node:https?['"]\)/.test(src), 'no node:http / node:https require');
  assert.ok(!/https?:\/\//.test(src.replace(/\/\/[^\n]*/g, '')), 'no http(s):// URL literal');
  assert.ok(!/\brequire\(['"][^'"]*navigation[^'"]*['"]\)/.test(src), 'pure extractor must not require navigation');
});

console.log('\n' + pass + '/' + total + ' extractor checks passed');
if (pass !== total) process.exit(1);
