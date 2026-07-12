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

// (T-218-VD-2) Noise filter: MindrianOS's own meta-vocabulary and generic
// business-jargon acronyms must never surface as entities, even when they
// appear as capitalized proper-noun-shaped runs in body prose. This is the
// EXACT live evidence from 218-VERIFICATION.md's "Second Finding" -- the
// unfiltered extractor's top-ranked "entities" on the real aion-eureka-synergy
// room were dominated by this vocabulary. Real company names in the same
// prose must still survive (precision, not just suppression).
check('MindrianOS meta-vocabulary and generic jargon are filtered as noise', () => {
  const md = [
    '## Notes',
    'See ROOM.md for the full identity file. Per Canon Part 8, the ICM Layer',
    'never egresses. The AAAK Record and Section Completeness score feed the',
    'Evidence Threshold gate. BEGIN REFERENCES and END REFERENCES bracket the',
    'FEYNMAN section. TAM and SAM sizing is GAP-driven per the MOA.',
    '## Competitors',
    'Sabra rivals Soom in the tahini market. Mighty Sesame supplies to NDC.',
  ].join('\n');
  const r = extractEntities(md, { sourceArtifactId: 'noise-test', maxPerArtifact: 50 });
  const names = r.entities.map((e) => e.name);
  const junk = [
    'ROOM.md', 'ROOM', 'Canon', 'ICM Layer', 'AAAK Record', 'Section Completeness',
    'Evidence Threshold', 'BEGIN REFERENCES', 'END REFERENCES', 'FEYNMAN',
    'TAM', 'SAM', 'GAP', 'MOA',
  ];
  for (const term of junk) {
    assert.ok(!names.includes(term), 'noise term "' + term + '" must be filtered, got names: ' + JSON.stringify(names));
  }
  // Real company names in the SAME prose must still come through (precision
  // over recall, not a blunt suppress-everything hammer).
  for (const real of ['Sabra', 'Soom', 'Mighty Sesame', 'NDC']) {
    assert.ok(names.includes(real), 'real entity "' + real + '" must survive the noise filter, got: ' + JSON.stringify(names));
  }
});

// A filename-shaped run is never an entity, independent of the specific name
// (the generic FILENAME_RX gate, not just the curated NOISE_TERMS list).
check('filename-shaped tokens (STATE.md, CLAUDE.md, arbitrary.json) are filtered', () => {
  const md = '## Notes\nSTATE.md and CLAUDE.md and arbitrary.json all describe Acme Robotics.';
  const r = extractEntities(md, { sourceArtifactId: 'fn-test' });
  const names = r.entities.map((e) => e.name);
  assert.ok(!names.includes('STATE.md'), 'STATE.md must be filtered: ' + JSON.stringify(names));
  assert.ok(!names.includes('CLAUDE.md'), 'CLAUDE.md must be filtered: ' + JSON.stringify(names));
  assert.ok(!names.includes('arbitrary.json'), 'arbitrary.json must be filtered: ' + JSON.stringify(names));
  assert.ok(names.includes('Acme Robotics'), 'real entity Acme Robotics must survive: ' + JSON.stringify(names));
});

// (T-218-VD-3) Domain-agnostic structural filters: metadata/status-field
// lines and markdown table rows are never narrative prose, in ANY venture
// domain -- these checks are shape-based (Label: Value / table syntax), not
// tied to MindrianOS's own vocabulary, so they must generalize to a room
// this extractor has never seen. Proven here with an INVENTED biotech
// venture, deliberately containing zero MindrianOS terms, so the fix can't
// be accidentally overfit to the one dogfooding room it was tuned against.
check('metadata/status-field lines are filtered (domain-agnostic, no MindrianOS vocabulary)', () => {
  const md = [
    '## Notes',
    'Deal Stage: Term Sheet',
    '**Priority:** High',
    '- Regulatory Status: Pending',
    'Funding Round: Series A',
    '## Competitors',
    'Helix Biosciences rivals Genomix in the gene-therapy market.',
  ].join('\n');
  const r = extractEntities(md, { sourceArtifactId: 'meta-test', maxPerArtifact: 50 });
  const names = r.entities.map((e) => e.name);
  for (const junk of ['Term Sheet', 'High', 'Pending', 'Series A', 'Deal Stage', 'Priority', 'Regulatory Status', 'Funding Round']) {
    assert.ok(!names.includes(junk), 'metadata-field value "' + junk + '" must be filtered, got: ' + JSON.stringify(names));
  }
  assert.ok(names.includes('Helix Biosciences'), 'real entity Helix Biosciences must survive: ' + JSON.stringify(names));
  assert.ok(names.includes('Genomix'), 'real entity Genomix must survive: ' + JSON.stringify(names));
});

// A narrative sentence with a mid-line colon (not an all-Title-Case label)
// must survive -- the metadata filter is shape-restrictive on purpose.
check('a narrative sentence containing a colon is NOT treated as metadata', () => {
  const md = '## Notes\nHelix Biosciences announced: they will expand into Europe next year.';
  const r = extractEntities(md, { sourceArtifactId: 'colon-test' });
  const names = r.entities.map((e) => e.name);
  assert.ok(names.includes('Helix Biosciences'), 'narrative sentence with a colon must still yield Helix Biosciences: ' + JSON.stringify(names));
});

// Markdown table rows are tabular data, never narrative prose, regardless
// of domain -- both a data row and a header-separator row.
check('markdown table rows are filtered (domain-agnostic)', () => {
  const md = [
    '## Notes',
    '| Section | Completeness | Owner |',
    '|---------|--------------|-------|',
    '| Business Model | Well-developed | Auto-generated |',
    '## Competitors',
    'Helix Biosciences rivals Genomix in the gene-therapy market.',
  ].join('\n');
  const r = extractEntities(md, { sourceArtifactId: 'table-test', maxPerArtifact: 50 });
  const names = r.entities.map((e) => e.name);
  for (const junk of ['Section', 'Completeness', 'Owner', 'Business Model', 'Well-developed', 'Auto-generated']) {
    assert.ok(!names.includes(junk), 'table-row value "' + junk + '" must be filtered, got: ' + JSON.stringify(names));
  }
  assert.ok(names.includes('Helix Biosciences'), 'real entity Helix Biosciences must survive the table filter: ' + JSON.stringify(names));
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
