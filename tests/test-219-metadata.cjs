'use strict';
/*
 * Phase 219-02 Task 2 -- REQ-5 metadata thin slice (D-11) + the opts.paths
 * scoped-extraction seam (the D-16 post-filing hook Plan 05 consumes).
 *
 * THE CLAIM: after extraction, memory_artifact nodes whose .md file carries
 * YAML frontmatter (methodology, created/date, status, section, confidence)
 * carry those fields as ADDITIVE JSON props -- deterministic, zero-LLM, parsed
 * by the SHIPPED opportunity-ops parseFrontmatter (Part 7 reuse), written
 * inside the SAME D-05 batch transaction through the insertNode UPSERT path.
 *
 *   Test 1: an artifact with frontmatter gets methodology/created/status/
 *           confidence props on its memory_artifact node.
 *   Test 2: an artifact WITHOUT frontmatter is untouched (no prop churn).
 *   Test 3: malformed / non-scalar frontmatter never throws; the batch
 *           survives and the other artifacts still get their metadata.
 *   Test 4: existing props + review_status are NOT clobbered (merge UPSERT);
 *           the structural `section` prop wins over a conflicting frontmatter
 *           section value.
 *   Test 5: runExtraction with opts.paths = [one path] touches ONLY that
 *           artifact's node (scoped incremental, the D-16 seam); the other
 *           node stays byte-identical.
 *   Test 6: zero-egress source gate: the modified dispatcher still carries no
 *           network primitive.
 *
 * All offline and hermetic (stub-free: the re-embed degrades to lexical-only
 * under the offline preload). NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

require('./eureka-offline-preload.cjs');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const { insertNode } = require('../lib/core/node-insert.cjs');
const entityExtract = require('../scripts/entity-extract.cjs');

// ---------------------------------------------------------------------------
// Fixture room: three sections, three memory_artifact-backed .md files.
//   analysis/brief.md      -> full scalar frontmatter (the REQ-5 happy path)
//   notes/plain.md         -> NO frontmatter (must stay untouched)
//   weird/list.md          -> frontmatter whose keys are non-scalar (lists) --
//                             the skip-never-throw path
// ---------------------------------------------------------------------------

const FM_ARTIFACT = [
  '---',
  'methodology: SWOT',
  'created: 2026-07-01',
  'status: draft',
  'section: somewhere-else',
  'confidence: 0.8',
  '---',
  '',
  '# Brief',
  '',
  'Prodrive competes with Xtrac in the motorsport drivetrain market.',
].join('\n');

const PLAIN_ARTIFACT = [
  '# Plain Note',
  '',
  'Hexcel supplies to Prodrive. No frontmatter lives here.',
].join('\n');

const LIST_ARTIFACT = [
  '---',
  'methodology:',
  '  - SWOT',
  '  - Porter',
  'status: review',
  '---',
  '',
  '# List Frontmatter',
  '',
  'Toray Industries supplies to Xtrac.',
].join('\n');

function mkRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-219-meta-'));
  const files = {
    'analysis/brief.md': FM_ARTIFACT,
    'notes/plain.md': PLAIN_ARTIFACT,
    'weird/list.md': LIST_ARTIFACT,
  };
  for (const rel of Object.keys(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, files[rel] + '\n', 'utf8');
  }
  return dir;
}

const NODE_IDS = {
  fm: 'memory_artifact:analysis:ROOM',
  plain: 'memory_artifact:notes:ROOM',
  list: 'memory_artifact:weird:ROOM',
};

function seedRoom(roomDir) {
  const db = openRoomDb(roomDir, { allowExtension: true });
  const seeds = [
    { id: NODE_IDS.fm, section: 'analysis', rel: 'analysis/brief.md', title: 'analysis brief' },
    { id: NODE_IDS.plain, section: 'notes', rel: 'notes/plain.md', title: 'plain note' },
    { id: NODE_IDS.list, section: 'weird', rel: 'weird/list.md', title: 'list frontmatter' },
  ];
  for (const s of seeds) {
    const props = JSON.stringify({
      title: s.title,
      path: s.rel,
      section: s.section,
      kind: 'ROOM',
    });
    insertNode(db, s.id, 'memory_artifact', props, {
      source_path: 'memory:' + s.section + ':ROOM',
      created_by: 'system',
    });
  }
  closeRoomDb(db);
}

function readNode(roomDir, id) {
  const db = openRoomDb(roomDir, { allowExtension: true });
  const row = db.prepare('SELECT id, type, properties, review_status FROM nodes WHERE id = ?').get(id);
  closeRoomDb(db);
  if (!row) return null;
  let props = {};
  try { props = JSON.parse(row.properties || '{}'); } catch (_e) { props = {}; }
  return { row: row, props: props };
}

async function main() {
  let passed = 0;
  const roomDir = mkRoom();
  try {
    seedRoom(roomDir);

    // Snapshot the untouched nodes' props BEFORE extraction (churn checks).
    const plainBefore = readNode(roomDir, NODE_IDS.plain);
    const statusBefore = plainBefore.row.review_status;

    // ----- run the full pipeline (default path: NO opts.paths) -----
    const rc = await entityExtract.main([roomDir, 'run']);
    assert.equal(rc, 0, 'entity-extract run should exit 0 (malformed frontmatter never kills the batch)');
    passed += 1;

    // ----- Test 1: frontmatter fields land as JSON props -----
    const fmNode = readNode(roomDir, NODE_IDS.fm);
    assert.ok(fmNode, 'frontmatter artifact node exists');
    assert.equal(fmNode.props.methodology, 'SWOT', 'methodology prop written');
    assert.equal(fmNode.props.created, '2026-07-01', 'created prop written');
    assert.equal(fmNode.props.status, 'draft', 'status prop written');
    assert.equal(fmNode.props.confidence, 0.8, 'confidence prop written (number scalar)');
    console.log('  Test 1 PASS: frontmatter props queryable on the memory_artifact node');
    passed += 1;

    // ----- Test 2: no-frontmatter artifact: additive-only + disclosure pin -----
    // The correct contract (quick 260715-cu8): a no-frontmatter node gains NO
    // frontmatter props, and the two-tier classifier (quick 260714-k44) may
    // legitimately classify a candidate (e.g. "Hexcel") as WHY and, under the live
    // no-working-LLM state, land it in framework_terms as a low-confidence embedding
    // best-guess. Additive classification is legitimate; an UNDISCLOSED
    // low-confidence guess is the bug this quick task fixes. So: pre-existing props
    // stay byte-identical, review_status is untouched, any ADDED keys are limited to
    // the additive framework trio, and when Hexcel lands it MUST be disclosed
    // low-confidence (the pin that REDs again if the disclosure signal disappears).
    const plainAfter = readNode(roomDir, NODE_IDS.plain);
    const ALLOWED_ADDED = new Set(['framework_terms', 'framework_term_count', 'framework_terms_low_confidence']);
    for (const k of Object.keys(plainBefore.props)) {
      assert.deepEqual(plainAfter.props[k], plainBefore.props[k],
        'pre-existing prop ' + k + ' unchanged on the no-frontmatter node');
    }
    for (const k of Object.keys(plainAfter.props)) {
      if (Object.prototype.hasOwnProperty.call(plainBefore.props, k)) continue;
      assert.ok(ALLOWED_ADDED.has(k),
        'only the additive framework trio may be added to a no-frontmatter node (saw: ' + k + ')');
    }
    assert.equal(plainAfter.row.review_status, statusBefore,
      'review_status never touched on the no-frontmatter node');

    // Live-state branch, k44-deviation-1 style so the leg is deterministic on every
    // machine (cached encoder + no working LLM here, encoder-absent hzx degrade
    // elsewhere, or a future funded key resolving Hexcel confidently as WHAT).
    const statusRaw = fs.readFileSync(
      path.join(roomDir, '.mindrian', 'entity-extract', 'status.json'), 'utf8');
    const status = JSON.parse(statusRaw);
    const ftPlain = typeof plainAfter.props.framework_terms === 'string' ? plainAfter.props.framework_terms : '';
    const lowPlain = typeof plainAfter.props.framework_terms_low_confidence === 'string'
      ? plainAfter.props.framework_terms_low_confidence : '';
    if (ftPlain.indexOf('Hexcel') !== -1) {
      // The cached-encoder, no-working-LLM state that caught this regression.
      assert.ok((status.tier2_low_confidence || 0) >= 1,
        'the aggregate low-confidence counter records the no-LLM degrade');
      assert.ok(lowPlain.indexOf('Hexcel') !== -1,
        'DISCLOSURE PIN: Hexcel in framework_terms MUST be disclosed low-confidence per-term');
      console.log('  Test 2 PASS: [live: Hexcel present] additive + disclosed low-confidence per-term');
    } else {
      // Encoder-absent hzx degrade, or a future funded key resolving Hexcel as WHAT.
      assert.ok(lowPlain.indexOf('Hexcel') === -1,
        'if Hexcel is not a WHY term, it is not disclosed as a low-confidence one either');
      console.log('  Test 2 PASS: [live: Hexcel absent] no undisclosed framework term on the plain node');
    }
    passed += 1;

    // ----- Test 3: non-scalar frontmatter skipped, batch survived -----
    const listNode = readNode(roomDir, NODE_IDS.list);
    assert.equal(listNode.props.methodology, undefined, 'non-scalar (list) value never lands as a prop');
    assert.equal(listNode.props.status, 'review', 'the scalar key from the same block still lands');
    console.log('  Test 3 PASS: malformed/non-scalar frontmatter never throws; batch survives');
    passed += 1;

    // ----- Test 4: merge UPSERT clobbers nothing -----
    assert.equal(fmNode.props.title, 'analysis brief', 'pre-existing title prop preserved');
    assert.equal(fmNode.props.path, 'analysis/brief.md', 'pre-existing path prop preserved');
    assert.equal(fmNode.props.kind, 'ROOM', 'pre-existing kind prop preserved');
    assert.equal(fmNode.props.section, 'analysis',
      'structural section prop wins over the conflicting frontmatter section value');
    assert.equal(fmNode.row.review_status, statusBefore, 'review_status never touched by the metadata pass');
    console.log('  Test 4 PASS: metadata write is a merge UPSERT (no clobber, review_status intact)');
    passed += 1;

    // ----- Test 5: opts.paths scoped extraction (the D-16 seam) -----
    // Fresh room so the scoped run's effect is isolated and observable.
    const roomB = mkRoom();
    try {
      seedRoom(roomB);
      const listBeforeB = readNode(roomB, NODE_IDS.list);
      const plainBeforeB = readNode(roomB, NODE_IDS.plain);

      const db = openRoomDb(roomB, { allowExtension: true });
      try {
        const res = await entityExtract.runExtraction(db, roomB, 'entity-extract', 25, {
          paths: ['analysis/brief.md'],
        });
        assert.equal(res.artifacts, 1, 'allowlist collects exactly ONE artifact');
      } finally {
        closeRoomDb(db);
      }

      const fmB = readNode(roomB, NODE_IDS.fm);
      assert.equal(fmB.props.methodology, 'SWOT', 'scoped run wrote the allowlisted artifact metadata');
      const listAfterB = readNode(roomB, NODE_IDS.list);
      const plainAfterB = readNode(roomB, NODE_IDS.plain);
      assert.deepEqual(listAfterB.props, listBeforeB.props, 'non-allowlisted node untouched (list)');
      assert.deepEqual(plainAfterB.props, plainBeforeB.props, 'non-allowlisted node untouched (plain)');
      console.log('  Test 5 PASS: opts.paths allowlist touches only the scoped artifact');
      passed += 1;
    } finally {
      try { fs.rmSync(roomB, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }

    // ----- Test 6: zero-egress source gate over the modified dispatcher -----
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'entity-extract.cjs'), 'utf8');
    assert.ok(!/\bfetch\b|require\(['"]node:https?['"]\)|\bhttps?:\/\//.test(src),
      'entity-extract.cjs carries zero network primitives (Part 8)');
    console.log('  Test 6 PASS: extractor stays zero-egress');
    passed += 1;

    console.log('test-219-metadata: ' + passed + '/7 legs PASSED (REQ-5 thin slice + D-16 seam)');
  } finally {
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

main().then(function () {
  process.exit(0);
}).catch(function (err) {
  console.error('test-219-metadata FAILED:', err && err.message ? err.message : err);
  process.exit(1);
});
