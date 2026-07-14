'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 218 (T-218-VD-4, post-live-verify follow-on) -- extend-to-artifacts.
 *
 * THE GAP (traced live against the real corepower-isolation room): the
 * original collectArtifacts() in scripts/entity-extract.cjs only walked files
 * with a memory_artifact node (kind in ROOM/STATE/MINTO/BRAIN/FEYNMAN/USER/
 * DRIFT -- memory-artifacts.cjs's closed MEMORY_KIND_SET). A room's actual
 * named analysis documents ("mv-mft-competitive-landscape.md",
 * "reverse-salient-analysis.md") are NOT memory_artifact-kinded, so they were
 * silently never read. On corepower-isolation this meant the real "Prodrive"
 * competitive finding -- living in lean-canvas-v2-2026-04-14.md and
 * hydrogen-electrolyzer-deep-dive.md -- was invisible to the pipeline (17 of
 * 28 real analysis files scanned, 0.0% structural noise but real content
 * missed, not caught).
 *
 * THE FIX: collectArtifacts() now ALSO walks every .md file in a section
 * directory not already covered by a memory_artifact path, linking its
 * entities' DESCRIBES edge to the section's existing memory_artifact:ROOM
 * node (never a synthetic id nothing points at -- a section with NO
 * memory_artifact anchor at all is skipped, not given an invented one).
 *
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

function mkTempRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-218-extend-'));
  fs.mkdirSync(path.join(dir, 'competitive-analysis'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'no-anchor-section'), { recursive: true });
  // The memory-kinded file (the ONLY file the pre-fix pipeline would read).
  fs.writeFileSync(
    path.join(dir, 'competitive-analysis', 'ROOM.md'),
    '# Competitive Analysis\n\nThis section tracks the landscape.\n',
    'utf8'
  );
  // A real named analysis document, NOT memory-kinded -- the exact shape of
  // the live gap (mv-mft-competitive-landscape.md on corepower-isolation).
  fs.writeFileSync(
    path.join(dir, 'competitive-analysis', 'mv-mft-competitive-landscape.md'),
    '# MV/MFT Competitive Landscape\n\nProdrive supplies to CorePower in the transformer market.\n',
    'utf8'
  );
  // A section with NO memory_artifact node at all -- must be skipped safely,
  // never given an invented DESCRIBES target.
  fs.writeFileSync(
    path.join(dir, 'no-anchor-section', 'orphan-notes.md'),
    'Should Never Extract rivals Unreachable Corp.\n',
    'utf8'
  );
  return dir;
}

function seedRoom(dir) {
  const db = openRoomDb(dir, { allowExtension: true });
  const roomId = 'memory_artifact:competitive-analysis:ROOM';
  insertNode(db, roomId, 'memory_artifact', JSON.stringify({
    section: 'competitive-analysis', kind: 'ROOM', path: 'competitive-analysis/ROOM.md', hash: '',
  }), { source_path: 'memory:competitive-analysis:ROOM', created_by: 'system' });
  closeRoomDb(db);
  return roomId;
}

async function main() {
  let passed = 0;
  const roomDir = mkTempRoom();
  try {
    const anchorId = seedRoom(roomDir);

    const rc = await entityExtract.main([roomDir, 'run']);
    assert.equal(rc, 0, 'entity-extract run should exit 0');
    passed += 1;

    const db = openRoomDb(roomDir, { allowExtension: true });
    const entRows = db.prepare(
      "SELECT properties FROM nodes WHERE type IN ('company','technology','market')"
    ).all();
    const names = entRows.map((r) => JSON.parse(r.properties).name);
    console.log('  extracted:', JSON.stringify(names));

    // The real finding, living in the NON-memory-kinded file, must now surface --
    // i.e. the tier-1 walk MUST reach the file. Two-tier semantic routing
    // (quick-task 260714-k44) means a surfaced term lands EITHER as an entity node
    // (tier-2a resolved it WHAT, or the encoder was unavailable and the pass
    // degraded to pass-through) OR in the artifact's framework_terms (tier-2a
    // resolved it WHY). This test proves the WALK reached the file, not tier-2a's
    // semantic verdict, so it accepts either home -- and stays deterministic
    // whether or not the local encoder is cached on the running machine.
    const anchorProps = (function () {
      const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(anchorId);
      try { return JSON.parse(row.properties || '{}'); } catch (_e) { return {}; }
    })();
    const frameworkTerms = typeof anchorProps.framework_terms === 'string' ? anchorProps.framework_terms : '';
    const surfaced = function (term) {
      return names.includes(term) || frameworkTerms.indexOf(term) !== -1;
    };
    assert.ok(surfaced('Prodrive'), 'Prodrive (in the non-memory-kinded file) must surface as entity or framework term: ' + JSON.stringify(names) + ' | fw=' + frameworkTerms);
    assert.ok(surfaced('CorePower'), 'CorePower (in the non-memory-kinded file) must surface as entity or framework term: ' + JSON.stringify(names) + ' | fw=' + frameworkTerms);
    passed += 1;

    // Its DESCRIBES edge must target the section's REAL memory_artifact
    // anchor -- never a synthetic/invented id.
    const edgeRows = db.prepare(
      "SELECT source, target FROM edges WHERE type = 'DESCRIBES' AND target = ?"
    ).all(anchorId);
    assert.ok(edgeRows.length > 0, 'at least one DESCRIBES edge must target the real section anchor ' + anchorId);
    passed += 1;

    // The orphan section (no memory_artifact anchor at all) must be safely
    // skipped -- neither of its names present, no dangling edge to nowhere.
    assert.ok(!names.includes('Should Never Extract'), 'a section with no anchor must be skipped, not read: ' + JSON.stringify(names));
    assert.ok(!names.includes('Unreachable Corp'), 'a section with no anchor must be skipped, not read: ' + JSON.stringify(names));
    passed += 1;

    closeRoomDb(db);

    console.log('test-218-extend-to-artifacts: ' + passed + '/4 legs PASSED');
  } finally {
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

main().then(function () {
  process.exit(0);
}).catch(function (err) {
  console.error('test-218-extend-to-artifacts FAILED:', err && err.message ? err.message : err);
  process.exit(1);
});
