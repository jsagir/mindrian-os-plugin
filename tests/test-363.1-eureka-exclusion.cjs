'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363.1 Plan 05 (D-03, B51-01) -- Eureka must never rank the room's own
 * scaffold.
 *
 * WHY: in both beta.51 test rooms, 0 of 25 ranked rows paired two real
 * artifacts. The sub-room ranked `market-analysis/CONTEXT` x `Lab`; the parent
 * ranked classifier-fallback domain nodes (unknown, freeform_unmatched,
 * empty_payload, move_set) and `memory_artifact:*:ROOM`. Step 4b only drops a
 * pair when BOTH sides are memory_artifact/Artifact, so one-sided scaffold,
 * egress-label domains and generic entities all passed.
 *
 * The fix was lib/core/eureka/candidate-exclusion.cjs, applied in the index
 * loop of the standalone runner before any pair or cohort was built. The
 * runner is retired (Phase 366 D-02); the Eureka perspective's recall drops
 * the same structural rows when it builds its substrate. This file pins it at
 * two levels:
 *   UNIT       structuralReason over every real row shape (memory_artifact,
 *              section contract, seeded vs authored FEYNMAN, egress-label
 *              domain, generic and high-document-share entity, plain content,
 *              malformed props), the egress-vocabulary text parity, the Part 8
 *              source fence, and reasoning-mode's scaffold skip.
 *   END TO END an offline eureka-recall run over a fixture room: none of the
 *              nine structural nodes is recalled or admitted as a thing, and a
 *              pair the room already connects is excluded and counted
 *              (migrated off the runner by plan 366-26).
 *
 * Seeded FEYNMAN bodies are built from room-birth's FEYNMAN_BIRTH_SEED_TEMPLATE
 * plus the timeline-runner and dial-memory-renderer exports, never hard-coded
 * sentinels. Zero network, zero deps, mkdtemp only. NO em-dashes (hyphens only;
 * dash characters are spelled with \u escapes where a test needs one).
 */

require('./eureka-offline-preload.cjs');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MODULE_ABS = path.join(ROOT, 'lib/core/eureka/candidate-exclusion.cjs');
const timelineRunner = require(path.join(ROOT, 'lib/core/feynman/timeline-runner.cjs'));
const dialMemory = require(path.join(ROOT, 'lib/core/feynman/dial-memory-renderer.cjs'));
const roomBirth = require(path.join(ROOT, 'lib/core/navigation/room-birth.cjs'));
const reasoningMode = require(path.join(ROOT, 'lib/core/eureka/reasoning-mode.cjs'));

let failures = 0;
const pending = [];
function leg(name, fn) {
  pending.push({ name, fn });
}

const tmpRoots = [];
function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'test-363.1-excl-' + label + '-'));
  tmpRoots.push(d);
  return d;
}
function w(dir, name, body) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), body);
}

// The real seeded FEYNMAN.md shape (birth seed + both auto blocks).
function seededFeynman(slug) {
  const seed = String(roomBirth.FEYNMAN_BIRTH_SEED_TEMPLATE).replace(/\{\{SECTION_SLUG\}\}/g, slug);
  return [
    '---',
    'timeline_last_rendered: 2026-09-29T16:10:46Z',
    'dial_memory_last_rendered: 2026-09-29T16:10:47Z',
    '---',
    '# ' + slug,
    '',
    seed.replace(/^# .*\n\n?/, ''),
    '',
    timelineRunner.HEADER,
    '',
    timelineRunner.SENTINEL_START,
    '*No timeline events yet.*',
    timelineRunner.SENTINEL_END,
    '',
    dialMemory.HEADER,
    '',
    dialMemory.SENTINEL_START,
    '*Last refreshed: 2026-09-29T16:10:47Z. No dial activity yet.*',
    dialMemory.SENTINEL_END,
    '',
  ].join('\n');
}

const AUTHORED_LINE = 'We win on price against the incumbents because our fibre housing is lighter.';
function authoredFeynman(slug) {
  return seededFeynman(slug) + '\n' + AUTHORED_LINE + '\n';
}

function row(id, type, props, sourcePath) {
  return {
    id: id,
    type: type,
    properties: typeof props === 'string' ? props : JSON.stringify(props || {}),
    source_path: sourcePath === undefined ? null : sourcePath,
  };
}

let CE = null;
function ce() {
  if (CE) return CE;
  CE = require(MODULE_ABS);
  return CE;
}

// ---------------------------------------------------------------------------
// UNIT LEGS
// ---------------------------------------------------------------------------

leg('U1 memory_artifact by id prefix and by row type', () => {
  const c = ce();
  assert.equal(c.structuralReason(row('memory_artifact:_root:BRAIN', 'memory_artifact', { section: '_root', kind: 'BRAIN', path: 'BRAIN.md' }, 'memory:_root:BRAIN'), {}), 'memory_artifact');
  assert.equal(c.structuralReason(row('memory_artifact:x:ROOM', 'Artifact', {}, null), {}), 'memory_artifact');
  assert.equal(c.structuralReason(row('some-id', 'memory_artifact', { title: 'T' }, null), {}), 'memory_artifact');
});

leg('U2 section contract and scaffold rows -> scaffold_basename (id, sub-room id, Windows source_path, props.path)', () => {
  const c = ce();
  assert.equal(c.structuralReason(row('market-analysis/CONTEXT', 'Artifact', { title: 'CONTEXT', section: 'market-analysis' }, 'system:rs-engine'), {}), 'scaffold_basename');
  assert.equal(c.structuralReason(row('sub/market-analysis/MINTO', 'Artifact', { title: 'MINTO' }, 'system:rs-engine'), {}), 'scaffold_basename');
  assert.equal(c.structuralReason(row('a1', 'Artifact', { title: 'room' }, 'problem-definition\\ROOM.md'), {}), 'scaffold_basename');
  assert.equal(c.structuralReason(row('a2', 'Artifact', { title: 'brain', path: 'strategy/BRAIN.md' }, null), {}), 'scaffold_basename');
  assert.equal(c.structuralReason(row('x/STATE', 'Artifact', {}, 'system:rs-engine'), {}), 'scaffold_basename');
  assert.equal(c.structuralReason(row('x/USER', 'Artifact', {}, 'system:rs-engine'), {}), 'scaffold_basename');
});

leg('U2b gap: shipped reference docs (SECTION-SCHEMA, SUB-SCHEMAS) are scaffold_basename, real sub-room row shapes', () => {
  const c = ce();
  const roomSkeletonScaffold = require(path.join(ROOT, 'lib/core/room-skeleton-scaffold.cjs'));
  // Row shape read from the beta.51 sub-room room.db: id references/SECTION-SCHEMA,
  // source_path system:rs-engine, props {title, section: references}.
  for (const doc of roomSkeletonScaffold.REFERENCE_DOCS) {
    const stem = doc.replace(/\.md$/, '');
    const title = stem === 'SECTION-SCHEMA' ? 'Section Schema' : 'Sub Schemas';
    assert.equal(c.structuralReason(row('references/' + stem, 'Artifact', { title: title, section: 'references', epistemic_type: 'observation' }, 'system:rs-engine'), {}), 'scaffold_basename', 'id references/' + stem);
    assert.equal(c.structuralReason(row('sub/references/' + stem, 'Artifact', { title: title }, 'system:rs-engine'), {}), 'scaffold_basename', 'sub-room id ' + stem);
    assert.equal(c.structuralReason(row('a-' + stem, 'Artifact', { title: title }, 'references\\' + doc), {}), 'scaffold_basename', 'Windows source_path ' + doc);
    assert.equal(c.structuralReason(row('b-' + stem, 'Artifact', { title: title, path: 'references/' + doc }, null), {}), 'scaffold_basename', 'props.path ' + doc);
  }
  // A user's own file in references/ is still content.
  assert.equal(c.structuralReason(row('references/paper-final', 'Artifact', { title: 'Paper', section: 'references' }, 'system:rs-engine'), {}), null);
  assert.equal(c.structuralReason(row('references/SECTION-SCHEMA-notes', 'Artifact', { title: 'Mine' }, 'system:rs-engine'), {}), null);
});

leg('U2c gap: reasoning-mode readRoomMarkdown skips the shipped reference docs and keeps other references', () => {
  const roomDir = mkTmp('refs-rm');
  const body = 'A body long enough to clear the forty character noise floor for sure.\n';
  w(path.join(roomDir, 'references'), 'SECTION-SCHEMA.md', '# Section Schema\n\n' + body);
  w(path.join(roomDir, 'references'), 'SUB-SCHEMAS.md', '# Sub Schemas\n\n' + body);
  w(path.join(roomDir, 'references'), 'my-reference.md', '# Mine\n\n' + body);
  const got = reasoningMode.readRoomMarkdown(roomDir).map((e) => e.id.split(path.sep).join('/')).sort();
  assert.deepEqual(got, ['references/my-reference.md']);
});

leg('U3 FEYNMAN is body-dependent: seeded -> scaffold, authored -> content, missing file -> content', () => {
  const c = ce();
  const roomDir = mkTmp('feyn');
  w(path.join(roomDir, 'business-model'), 'FEYNMAN.md', seededFeynman('business-model'));
  w(path.join(roomDir, 'problem-definition'), 'FEYNMAN.md', authoredFeynman('problem-definition'));
  const ctx = c.buildExclusionContext({ roomDir: roomDir, corpus: [] });
  assert.equal(c.structuralReason(row('business-model/FEYNMAN', 'Artifact', { title: 'F' }, 'system:rs-engine'), ctx), 'scaffold_basename');
  assert.equal(c.structuralReason(row('problem-definition/FEYNMAN', 'Artifact', { title: 'F' }, 'system:rs-engine'), ctx), null);
  assert.equal(c.structuralReason(row('ghost-section/FEYNMAN', 'Artifact', { title: 'F' }, 'system:rs-engine'), ctx), null);
  // No roomDir at all: a FEYNMAN can never be proven seeded, so content wins.
  assert.equal(c.structuralReason(row('business-model/FEYNMAN', 'Artifact', { title: 'F' }, 'system:rs-engine'), {}), null);
});

leg('U4 egress-label domain nodes -> egress_label_domain; a real domain name -> null', () => {
  const c = ce();
  for (const label of ['unknown', 'freeform_unmatched', 'empty_payload', 'move_set']) {
    assert.equal(
      c.structuralReason(row('domain:s:' + label, 'focus_area', { name: label, domainType: 'focus_area' }, 'domain:s:' + label), {}),
      'egress_label_domain', label);
  }
  // Label carried only by source_path's last segment still counts.
  assert.equal(c.structuralReason(row('domain:s:9', 'focus_area', { domainType: 'focus_area' }, 'domain:s:unknown'), {}), 'egress_label_domain');
  assert.equal(c.structuralReason(row('domain:s:2', 'domain', { name: 'Oncology diagnostics' }, 'domain:s:Oncology diagnostics'), {}), null);
  // A non-domain row that merely carries the word is not touched.
  assert.equal(c.structuralReason(row('claim:1', 'Claim', { text: 'unknown', name: 'unknown' }, 'claims/one'), {}), null);
});

leg('U5 generic single-token entity -> low_idf_entity (any case); multi-token name survives', () => {
  const c = ce();
  const lab = { name: 'Lab', entityType: 'company', evidenceTier: 'low_confidence' };
  assert.equal(c.structuralReason(row('e1', 'company', lab, 'problem-definition\\brief.md'), {}), 'low_idf_entity');
  assert.equal(c.structuralReason(row('e2', 'company', { name: 'LAB', entityType: 'company' }, null), {}), 'low_idf_entity');
  assert.equal(c.structuralReason(row('e3', 'company', { name: 'Lab Automation Systems', entityType: 'company' }, null), {}), null);
  // Independent of evidenceTier: a trusted-stamped generic is still generic.
  assert.equal(c.structuralReason(row('e4', 'technology', { name: 'team', entityType: 'technology', evidenceTier: 'None' }, null), {}), 'low_idf_entity');
});

leg('U6 ratio IDF: >= half of an 8+ entry corpus is low-IDF; a small corpus never triggers', () => {
  const c = ce();
  const mk = (n, mentions) => Array.from({ length: n }, (_v, i) => ({
    id: 'd' + i + '.md', section: 's', title: 't' + i,
    text: i < mentions ? 'Globex signed the deal number ' + i : 'Unrelated body text number ' + i + ' about pricing',
  }));
  const big = mk(10, 6);
  big[8].text = 'Initech pilot notes and more prose';
  big[9].text = 'Initech pilot notes and more prose again';
  const ctx = c.buildExclusionContext({ roomDir: null, corpus: big });
  assert.equal(c.structuralReason(row('g', 'company', { name: 'Globex', entityType: 'company' }, null), ctx), 'low_idf_entity');
  assert.equal(c.structuralReason(row('i', 'company', { name: 'Initech', entityType: 'company' }, null), ctx), null);
  const small = mk(3, 3);
  const ctxSmall = c.buildExclusionContext({ roomDir: null, corpus: small });
  assert.equal(c.structuralReason(row('g2', 'company', { name: 'Globex', entityType: 'company' }, null), ctxSmall), null);
  assert.equal(c.MIN_IDF_CORPUS, 8);
});

leg('U7 plain content rows and malformed props are null and never throw', () => {
  const c = ce();
  assert.equal(c.structuralReason(row('claim:1', 'Claim', { text: 'Fibre housings cut weight.', section: 'claims' }, 'claims/one'), {}), null);
  assert.equal(c.structuralReason(row('problem-definition/brief', 'Artifact', { title: 'Brief', path: 'problem-definition/brief.md' }, 'problem-definition\\brief.md'), {}), null);
  assert.equal(c.structuralReason(row('bad', 'Artifact', '{not json', null), {}), null);
  assert.equal(c.structuralReason(row('bad2', 'company', '[1,2,3]', null), {}), null);
  assert.equal(c.structuralReason(null, {}), null);
  assert.equal(c.structuralReason(undefined, undefined), null);
  assert.equal(c.isStructuralNode(row('m', 'memory_artifact', {}, null), {}), true);
  assert.equal(c.isStructuralNode(row('claim:1', 'Claim', { text: 'x' }, null), {}), false);
});

leg('U8 EGRESS_CLASS_DOMAIN_LABELS equals refusal-messaging EGRESS_CLASS_SET read as TEXT', () => {
  const c = ce();
  const src = fs.readFileSync(path.join(ROOT, 'lib/core/refusal-messaging.cjs'), 'utf8');
  const m = src.match(/EGRESS_CLASS_SET\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert.ok(m, 'EGRESS_CLASS_SET block must be found');
  const noComments = m[1].split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  const fromText = new Set((noComments.match(/'([a-z_]+)'/g) || []).map((s) => s.slice(1, -1)));
  assert.ok(fromText.size >= 10, 'parsed vocabulary looks too small: ' + [...fromText].join(','));
  assert.deepEqual([...c.EGRESS_CLASS_DOMAIN_LABELS].sort(), [...fromText].sort());
  for (const k of ['unknown', 'freeform_unmatched', 'empty_payload', 'move_set']) {
    assert.ok(c.EGRESS_CLASS_DOMAIN_LABELS.has(k), k);
  }
});

leg('U9 Part 8 fence: no Brain, refusal-messaging or network token in the module code', () => {
  const src = fs.readFileSync(MODULE_ABS, 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  for (const tok of ['refusal-messaging', 'brain-client', 'fetch(', 'http://', 'https://']) {
    assert.ok(!code.includes(tok), 'forbidden token in code: ' + tok);
  }
});

leg('U10 reasoning-mode readRoomMarkdown skips scaffold files, keeps authored FEYNMAN and notes', () => {
  const roomDir = mkTmp('rm');
  const body = 'A body long enough to clear the forty character noise floor for sure.\n';
  w(path.join(roomDir, 'market-analysis'), 'CONTEXT.md', '# CONTEXT\n\n' + body);
  w(roomDir, 'BRAIN.md', '# BRAIN\n\n' + body);
  w(path.join(roomDir, 'business-model'), 'FEYNMAN.md', seededFeynman('business-model'));
  w(path.join(roomDir, 'problem-definition'), 'FEYNMAN.md', authoredFeynman('problem-definition'));
  w(path.join(roomDir, 'research'), 'notes.md', '# Notes\n\n' + body);
  const got = reasoningMode.readRoomMarkdown(roomDir).map((e) => e.id.split(path.sep).join('/')).sort();
  assert.deepEqual(got, ['problem-definition/FEYNMAN.md', 'research/notes.md']);
});

// ---------------------------------------------------------------------------
// END TO END LEGS: offline recall over a fixture room
// ---------------------------------------------------------------------------
// Phase 366-26 (D-02): these legs ran the standalone runner (room mode) and read
// its report. The runner is retired; the Eureka perspective's recall
// (lib/core/research-planner/perspectives/eureka-recall.cjs) is the live path,
// so the legs now run runRecall over the same nine structural rows. Each
// structural row carries the SAME drivetrain text as the real content, so only
// the exclusion keeps it out of the candidate list (a vacuous fixture would pass
// without any exclusion at all). The known-pair leg pins the exclusion-set
// upsert (shared.makeCandidateStore). The runner's report-only legs (per-reason
// provenance counts, step 4b counters, the md provenance row, renderReport) and
// the authored-FEYNMAN leg retired with the runner (366-26-SUMMARY.md) and came
// back as E4 once plan 366-22 restored B51-01 in eureka-recall.

const RECALL = require(path.join(ROOT, 'lib/core/research-planner/perspectives/eureka-recall.cjs'));
const SHARED_TEXT = 'A carbon fibre drivetrain housing cuts weight for warehouse delivery robots and extends battery life.';

function buildE2ERoom() {
  const { openRoomDb, closeRoomDb } = require(path.join(ROOT, 'lib/core/room-db.cjs'));
  const { insertNode } = require(path.join(ROOT, 'lib/core/node-insert.cjs'));

  const roomDir = mkTmp('e2e');
  // Files on disk: seeded FEYNMAN (scaffold), authored FEYNMAN, a real brief.
  w(path.join(roomDir, 'market-analysis'), 'FEYNMAN.md', seededFeynman('market-analysis'));
  w(path.join(roomDir, 'problem-definition'), 'FEYNMAN.md', authoredFeynman('problem-definition'));
  w(path.join(roomDir, 'problem-definition'), 'brief.md', '# Brief\n\n' + SHARED_TEXT + '\n');

  const db = openRoomDb(roomDir, { allowExtension: true });
  const ins = (id, type, props, sp, et) => insertNode(db, id, type, JSON.stringify(props), {
    source_path: sp, created_by: 'system', epistemic_type: et || 'observation',
  });

  // Structural (nine), each carrying the shared content text:
  ins('memory_artifact:_root:ROOM', 'memory_artifact', { title: 'Room identity scaffold', text: SHARED_TEXT, section: '_root', kind: 'ROOM', path: 'ROOM.md' }, 'memory:_root:ROOM');
  ins('memory_artifact:market-analysis:MINTO', 'memory_artifact', { title: 'Market analysis MINTO scaffold', text: SHARED_TEXT, section: 'market-analysis', kind: 'MINTO', path: 'market-analysis/MINTO.md' }, 'memory:market-analysis:MINTO');
  ins('market-analysis/CONTEXT', 'Artifact', { title: 'Market analysis section contract', text: SHARED_TEXT, section: 'market-analysis' }, 'system:rs-engine');
  ins('market-analysis/FEYNMAN', 'Artifact', { title: 'Market analysis seeded explainer', text: SHARED_TEXT, section: 'market-analysis' }, 'system:rs-engine');
  for (const label of ['unknown', 'freeform_unmatched', 'empty_payload', 'move_set']) {
    ins('domain:sess:' + label, 'focus_area', { name: label, text: SHARED_TEXT, domainType: 'focus_area' }, 'domain:sess:' + label);
  }
  ins('entity:entity-extract:1296d', 'company', { name: 'Lab', entityType: 'company' }, 'problem-definition\\agreed-structure-working-brief.md', 'extracted_fact');

  // Real content, three sections, all sharing the drivetrain vocabulary:
  ins('claim:one', 'Claim', { title: 'Weight claim', text: SHARED_TEXT, section: 'claims' }, 'claims/one');
  ins('claim:two', 'Claim', { title: 'Cost claim', text: 'Warehouse operators pay for longer battery life on every delivery robot route. ' + SHARED_TEXT, section: 'demand' }, 'demand/two');
  ins('entity:acme', 'company', { name: 'Acme Robotics', entityType: 'company' }, 'firms/acme', 'extracted_fact');
  ins('entity:cf', 'technology', { name: 'Carbon Fibre Housing', entityType: 'technology' }, 'materials/cf', 'extracted_fact');
  ins('problem-definition/brief', 'Artifact', { title: 'Working brief', text: SHARED_TEXT, path: 'problem-definition/brief.md', section: 'problem-definition' }, 'problem-definition\\brief.md');
  ins('problem-definition/FEYNMAN', 'Artifact', { title: 'Problem definition explainer', text: AUTHORED_LINE + ' ' + SHARED_TEXT, section: 'problem-definition' }, 'system:rs-engine');
  closeRoomDb(db);
  return roomDir;
}

let e2e = null;
function e2eOnce() {
  if (!e2e) {
    const roomDir = buildE2ERoom();
    e2e = { roomDir: roomDir, rec: RECALL.runRecall(roomDir, { tag: '20261002T000001Z' }) };
  }
  return e2e;
}

const STRUCTURAL_IDS = [
  'memory_artifact:_root:ROOM', 'memory_artifact:market-analysis:MINTO',
  'market-analysis/CONTEXT', 'market-analysis/FEYNMAN',
  'domain:sess:unknown', 'domain:sess:freeform_unmatched', 'domain:sess:empty_payload', 'domain:sess:move_set',
  'entity:entity-extract:1296d',
];
const CONTENT_IDS = ['claim:one', 'claim:two', 'problem-definition/brief'];

function hasPair(cands, x, y) {
  return cands.some((c) => (c.a === x && c.b === y) || (c.a === y && c.b === x));
}

leg('E1 offline recall proposes pairs, none with a structural endpoint', () => {
  const { rec } = e2eOnce();
  assert.equal(rec.ok, true);
  assert.ok(Array.isArray(rec.candidates) && rec.candidates.length > 0, 'must recall at least one pair');
  for (const p of rec.candidates) {
    assert.ok(!STRUCTURAL_IDS.includes(p.a), 'structural endpoint recalled: ' + p.a);
    assert.ok(!STRUCTURAL_IDS.includes(p.b), 'structural endpoint recalled: ' + p.b);
  }
});

leg('E2 the substrate holds the real content and none of the nine structural rows', () => {
  const { roomDir } = e2eOnce();
  const navigation = require(path.join(ROOT, 'lib/core/navigation.cjs'));
  const db = navigation.openRoomDbReadOnlyForCaller(roomDir);
  let sub;
  try { sub = RECALL.buildSubstrate(db, { roomDir: roomDir }); } finally { try { db.close(); } catch (_e) { /* read-only */ } }
  const ids = sub.things.map((t) => t.id);
  for (const id of STRUCTURAL_IDS) assert.ok(!ids.includes(id), 'structural row admitted as a thing: ' + id);
  for (const id of CONTENT_IDS) assert.ok(ids.includes(id), 'content row missing from the things: ' + id);
});

leg('E3 a pair the room already connects is excluded and counted (the exclusion-set upsert)', () => {
  const { roomDir, rec } = e2eOnce();
  assert.ok(hasPair(rec.candidates, 'claim:one', 'claim:two'), 'claim:one x claim:two must be recalled before the edge exists');
  const { openRoomDb, closeRoomDb } = require(path.join(ROOT, 'lib/core/room-db.cjs'));
  const db = openRoomDb(roomDir, { allowExtension: true });
  try {
    db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)').run('claim:one', 'claim:two', 'INFORMS', JSON.stringify({ reason: 'known' }));
  } finally { closeRoomDb(db); }
  const again = RECALL.runRecall(roomDir, { tag: '20261002T000002Z' });
  assert.ok(!hasPair(again.candidates, 'claim:one', 'claim:two'), 'a connected pair must not be recalled');
  assert.ok(again.counts.known_pairs >= 1, 'known_pairs must count the edge: ' + JSON.stringify(again.counts));
  assert.ok(again.counts.excluded_known >= 1, 'excluded_known must count the caught proposal: ' + JSON.stringify(again.counts));
});

// E4 (regression, plan 366-22): eureka-recall once dropped every FEYNMAN by
// basename, authored or seeded. It now asks scaffold-predicate.isScaffoldFile,
// as candidate-exclusion does (363.1 B51-01): the authored FEYNMAN on disk is a
// thing and can be recalled, the seeded template stays out.
leg('E4 an authored FEYNMAN is a candidate, a seeded FEYNMAN is not (B51-01 restored)', () => {
  const { roomDir, rec } = e2eOnce();
  const navigation = require(path.join(ROOT, 'lib/core/navigation.cjs'));
  const db = navigation.openRoomDbReadOnlyForCaller(roomDir);
  let sub;
  try { sub = RECALL.buildSubstrate(db, { roomDir: roomDir }); } finally { try { db.close(); } catch (_e) { /* read-only */ } }
  const ids = sub.things.map((t) => t.id);
  assert.ok(ids.includes('problem-definition/FEYNMAN'), 'authored FEYNMAN must be a thing');
  assert.ok(!ids.includes('market-analysis/FEYNMAN'), 'seeded FEYNMAN must stay out');
  const endpoints = new Set();
  rec.candidates.forEach((c) => { endpoints.add(c.a); endpoints.add(c.b); });
  assert.ok(endpoints.has('problem-definition/FEYNMAN'), 'authored FEYNMAN must be recalled as a candidate endpoint');
  assert.ok(!endpoints.has('market-analysis/FEYNMAN'), 'seeded FEYNMAN must never be a candidate endpoint');
});

// ---------------------------------------------------------------------------
// runner
// ---------------------------------------------------------------------------

(async function main() {
  for (const { name, fn } of pending) {
    try {
      await fn();
      console.log('ok - ' + name);
    } catch (err) {
      failures += 1;
      console.log('not ok - ' + name);
      console.log('    ' + String(err && err.message ? err.message : err).split('\n').join('\n    '));
    }
  }
  for (const d of tmpRoots) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  if (failures > 0) {
    console.log('test-363.1-eureka-exclusion: ' + failures + ' leg(s) FAILED');
    process.exit(1);
  }
  console.log('test-363.1-eureka-exclusion: ' + pending.length + '/' + pending.length + ' legs PASSED');
  process.exit(0);
})();
