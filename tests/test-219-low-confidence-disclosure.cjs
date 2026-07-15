'use strict';
/*
 * Quick 260715-cu8 -- per-term low-confidence disclosure proof.
 *
 * THE CLAIM: a WHY term that lands via the no-LLM embedding best-guess degrade
 * is disclosed per-term on its artifact node via the additive scalar prop
 * framework_terms_low_confidence, not just in the aggregate status.json
 * tier2_low_confidence counter. A confidently-classified WHY term is NOT
 * marked; a later confident run REMOVES the marker (upgrade wins); and the
 * marked set is always a subset of framework_terms.
 *
 *   Leg 1: a low-margin no-LLM candidate is marked low-confidence.
 *   Leg 2: a high-margin confident candidate lands in framework_terms and is
 *          NOT in framework_terms_low_confidence.
 *   Leg 3: a second run where the same term returns confident REMOVES the
 *          marker; framework_terms unions without duplication.
 *   Leg 4: subset invariant -- every name in framework_terms_low_confidence
 *          appears in framework_terms.
 *
 * Hermetic + offline: drives runExtraction directly through the EXISTING
 * injection seams (opts.embedClassifyImpl deterministic verdicts + opts.
 * _forceNoLlm), no network, no real encoder, no new seams. Mirrors
 * test-219-metadata.cjs's mkRoom/seedRoom/readNode fixture pattern.
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
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
// Fixture room: one section, one memory_artifact-backed .md file whose prose
// yields three clean candidate names (Prodrive, Hexcel, Xtrac). The injected
// embedding verdicts, not the real encoder, decide each candidate's label.
// ---------------------------------------------------------------------------

const ARTIFACT_TEXT = [
  '# Brief',
  '',
  'Prodrive builds drivetrains. Hexcel supplies carbon fiber. Xtrac machines gearboxes.',
].join('\n');

const NODE_ID = 'memory_artifact:analysis:ROOM';
const REL = 'analysis/brief.md';

function mkRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-219-lowconf-'));
  const abs = path.join(dir, REL);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, ARTIFACT_TEXT + '\n', 'utf8');
  return dir;
}

function seedRoom(roomDir) {
  const db = openRoomDb(roomDir, { allowExtension: true });
  const props = JSON.stringify({
    title: 'analysis brief',
    path: REL,
    section: 'analysis',
    kind: 'ROOM',
  });
  insertNode(db, NODE_ID, 'memory_artifact', props, {
    source_path: 'memory:analysis:ROOM',
    created_by: 'system',
  });
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

// embedStub(verdicts) -- a deterministic tier-2a surrogate. Names listed in
// `verdicts` return that exact verdict; any other survivor resolves as a
// confident WHAT so it becomes a plain entity node and never pollutes the WHY
// signal under test. Shape matches classifyByEmbedding: { ok, results }.
function embedStub(verdicts) {
  return async function (arg) {
    const names = (arg && Array.isArray(arg.names)) ? arg.names : [];
    const results = {};
    for (const n of names) {
      results[n] = Object.prototype.hasOwnProperty.call(verdicts, n)
        ? verdicts[n]
        : { label: 'what', margin: 0.9, confident: true };
    }
    return { ok: true, results: results };
  };
}

// runOnce(roomDir, verdicts, forceNoLlm) -- one scoped extraction over the
// single fixture artifact, returning that node's props after the run.
async function runOnce(roomDir, verdicts, forceNoLlm) {
  const db = openRoomDb(roomDir, { allowExtension: true });
  try {
    await entityExtract.runExtraction(db, roomDir, 'entity-extract', 25, {
      paths: [REL],
      embedClassifyImpl: embedStub(verdicts),
      _forceNoLlm: forceNoLlm === true,
    });
  } finally {
    closeRoomDb(db);
  }
  return readNode(roomDir, NODE_ID).props;
}

function termList(scalar) {
  return (typeof scalar === 'string' && scalar.length > 0)
    ? scalar.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
    : [];
}

async function main() {
  let passed = 0;

  // ----- Leg 1: low-margin, no LLM -> marked low-confidence -----
  {
    const roomDir = mkRoom();
    try {
      seedRoom(roomDir);
      const props = await runOnce(roomDir, {
        Hexcel: { label: 'why', margin: 0.02, confident: false },
      }, true);
      const ft = termList(props.framework_terms);
      const low = termList(props.framework_terms_low_confidence);
      assert.ok(ft.indexOf('Hexcel') !== -1, 'Hexcel lands in framework_terms (WHY best-guess)');
      assert.ok(low.indexOf('Hexcel') !== -1,
        'Hexcel is disclosed low-confidence per-term (not just the aggregate counter)');
      console.log('  Leg 1 PASS: low-margin no-LLM WHY term marked in framework_terms_low_confidence');
      passed += 1;
    } finally {
      try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  }

  // ----- Leg 2: high-margin confident -> present, NOT marked -----
  {
    const roomDir = mkRoom();
    try {
      seedRoom(roomDir);
      const props = await runOnce(roomDir, {
        Hexcel: { label: 'why', margin: 0.55, confident: true },
      }, true);
      const ft = termList(props.framework_terms);
      const low = termList(props.framework_terms_low_confidence);
      assert.ok(ft.indexOf('Hexcel') !== -1, 'confident WHY term still lands in framework_terms');
      assert.ok(low.indexOf('Hexcel') === -1,
        'a confident WHY term is NOT marked low-confidence');
      console.log('  Leg 2 PASS: high-margin confident WHY term present and unmarked');
      passed += 1;
    } finally {
      try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  }

  // ----- Leg 3: confident re-run REMOVES the marker (upgrade wins) -----
  {
    const roomDir = mkRoom();
    try {
      seedRoom(roomDir);
      // First run: low-confidence best-guess marks Hexcel.
      const first = await runOnce(roomDir, {
        Hexcel: { label: 'why', margin: 0.02, confident: false },
      }, true);
      assert.ok(termList(first.framework_terms_low_confidence).indexOf('Hexcel') !== -1,
        'first run marks Hexcel low-confidence');
      // Second run: Hexcel now resolves CONFIDENT WHY -> the marker must clear.
      const second = await runOnce(roomDir, {
        Hexcel: { label: 'why', margin: 0.55, confident: true },
      }, true);
      const ft = termList(second.framework_terms);
      const low = termList(second.framework_terms_low_confidence);
      assert.equal(ft.filter(function (t) { return t === 'Hexcel'; }).length, 1,
        'framework_terms unions without duplicating Hexcel across runs');
      assert.ok(low.indexOf('Hexcel') === -1,
        'a confident later run removes the low-confidence marker (upgrade wins)');
      console.log('  Leg 3 PASS: confident re-run clears the marker; framework_terms unions cleanly');
      passed += 1;
    } finally {
      try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  }

  // ----- Leg 4: subset invariant over two marked terms -----
  {
    const roomDir = mkRoom();
    try {
      seedRoom(roomDir);
      // Two of the three candidates land as low-confidence WHY; Prodrive stays WHAT.
      const props = await runOnce(roomDir, {
        Hexcel: { label: 'why', margin: 0.03, confident: false },
        Xtrac: { label: 'why', margin: 0.04, confident: false },
      }, true);
      const ft = termList(props.framework_terms);
      const low = termList(props.framework_terms_low_confidence);
      assert.ok(low.length >= 2, 'both no-LLM WHY best-guesses are disclosed');
      for (const name of low) {
        assert.ok(ft.indexOf(name) !== -1,
          'subset invariant: every low-confidence name appears in framework_terms (' + name + ')');
      }
      console.log('  Leg 4 PASS: framework_terms_low_confidence is always a subset of framework_terms');
      passed += 1;
    } finally {
      try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  }

  console.log('test-219-low-confidence-disclosure: ' + passed + '/4 legs PASSED (per-term disclosure, quick 260715-cu8)');
}

main().then(function () {
  process.exit(0);
}).catch(function (err) {
  console.error('test-219-low-confidence-disclosure FAILED:', err && err.message ? err.message : err);
  process.exit(1);
});
