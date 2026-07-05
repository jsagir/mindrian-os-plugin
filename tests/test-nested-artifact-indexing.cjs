/**
 * MindrianOS Plugin -- Nested-Artifact Indexing Tests
 * =========================================================================
 * Quick fix 260705-qi8: the local per-room SQLite graph indexer must see
 * artifacts filed under the Obsidian-nested convention (CLAUDE.md decision
 * #16, v1.9.7): every .mos artifact sits in its own folder, section/name/name.md
 * -- the folder IS the artifact.
 *
 * Four scenarios:
 *   Test 1  nested-only discovery  -- discoverSections qualifies a section
 *           whose only children are per-artifact subfolders (RED before fix).
 *   Test 2  nested indexing        -- rebuildGraph indexes one level deep into
 *           per-artifact subfolders (RED before fix).
 *   Test 3  flat regression lock   -- a flat section still indexes exactly as
 *           before, alongside a nested section (GREEN today).
 *   Test 4  sub-room exclusion     -- a child folder carrying a .room-root
 *           sentinel is never walked by the parent room's artifact pass
 *           (GREEN today).
 *
 * Run: node tests/test-nested-artifact-indexing.cjs
 * Plan: .planning/quick/260705-qi8-fix-graph-indexer-to-support-nested-arti/260705-qi8-PLAN.md
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// node:sqlite SKIP-on-unavailable guard (exit 77), mirroring test-195-drift-kind.cjs.
// Tests 2-4 need node:sqlite; Test 1 (discoverSections) does not, but we gate the
// whole file so a sqlite-less runtime does not report spurious failures.
try {
  require('node:sqlite');
} catch (_) {
  process.stdout.write('SKIP test-nested-artifact-indexing.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const lazygraph = require('../lib/core/lazygraph-ops.cjs');
const { discoverSections } = require('../lib/core/section-registry.cjs');

// --- Helpers ---

function makeRoom() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-nested-test-'));
}

function writeFile(roomDir, relPath, content) {
  const full = path.join(roomDir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
  return full;
}

function cleanup(roomDir) {
  try {
    fs.rmSync(roomDir, { recursive: true, force: true });
  } catch (_e) {
    // ignore cleanup errors
  }
}

async function openRoom(roomDir) {
  const { db, conn } = await lazygraph.openGraph(roomDir);
  return { db, conn };
}

// ============================================================
// Test 1: nested-only section discovery
// ============================================================

describe('QI8-01: nested-only section discovery', () => {
  let roomDir;

  before(() => {
    roomDir = makeRoom();
    // A section whose ONLY children are per-artifact subfolders, no direct .md.
    writeFile(roomDir, 'research/2026-07-05-topic/01-note.md', '# Note 1\nBody.\n');
    writeFile(roomDir, 'research/2026-07-05-topic/02-note.md', '# Note 2\nBody.\n');
    // A section whose nested folder contains ONLY a ROOM.md -- must NOT qualify
    // (ROOM.md is an identity file, not an indexable artifact).
    writeFile(roomDir, 'empty-nested/some-folder/ROOM.md', '# Room identity\n');
  });

  after(() => cleanup(roomDir));

  it('discoverSections().all includes a nested-only section', () => {
    const { all } = discoverSections(roomDir);
    assert.ok(all.includes('research'), `Expected 'research' in ${JSON.stringify(all)}`);
  });

  it('a nested folder with only ROOM.md does NOT qualify the section', () => {
    const { all } = discoverSections(roomDir);
    assert.ok(!all.includes('empty-nested'), `'empty-nested' should not qualify; got ${JSON.stringify(all)}`);
  });
});

// ============================================================
// Test 2: nested artifact indexing via rebuildGraph
// ============================================================

describe('QI8-02: nested artifact indexing', () => {
  let roomDir, db, conn;

  before(async () => {
    roomDir = makeRoom();
    writeFile(roomDir, 'research/2026-07-05-topic/01-note.md', '# Note 1\nBody.\n');
    writeFile(roomDir, 'research/2026-07-05-topic/02-note.md', '# Note 2\nBody.\n');
    ({ db, conn } = await openRoom(roomDir));
  });

  after(async () => {
    await lazygraph.closeGraph(db);
    cleanup(roomDir);
  });

  it('rebuildGraph indexes both nested artifacts', async () => {
    const result = await lazygraph.rebuildGraph(conn, roomDir);
    assert.strictEqual(result.artifacts, 2, `Expected 2 artifacts, got ${result.artifacts}`);
  });

  it('nodes table carries an Artifact rooted under research/2026-07-05-topic/', () => {
    const ids = conn.prepare("SELECT id FROM nodes WHERE type = 'Artifact'").all().map(r => r.id);
    assert.ok(
      ids.some(id => id.startsWith('research/2026-07-05-topic/')),
      `Expected a nested artifact id, got ${JSON.stringify(ids)}`
    );
  });

  it('the nested artifact has a BELONGS_TO edge to Section research', () => {
    const rows = conn.prepare(
      "SELECT * FROM edges WHERE target = 'research' AND type = 'BELONGS_TO'"
    ).all();
    assert.ok(rows.length >= 1, 'Expected at least one BELONGS_TO edge to research');
    const sectionRows = conn.prepare(
      "SELECT * FROM nodes WHERE id = 'research' AND type = 'Section'"
    ).all();
    assert.strictEqual(sectionRows.length, 1, 'Expected a Section node for research');
  });
});

// ============================================================
// Test 3: flat section regression lock (flat + nested together)
// ============================================================

describe('QI8-03: flat regression lock', () => {
  let roomDir, db, conn;

  before(async () => {
    roomDir = makeRoom();
    // Flat section: direct .md file.
    writeFile(roomDir, 'problem-definition/insight.md', '# Insight\nFlat body.\n');
    // Nested section alongside it.
    writeFile(roomDir, 'research/2026-07-05-topic/01-note.md', '# Note 1\nBody.\n');
    writeFile(roomDir, 'research/2026-07-05-topic/02-note.md', '# Note 2\nBody.\n');
    ({ db, conn } = await openRoom(roomDir));
  });

  after(async () => {
    await lazygraph.closeGraph(db);
    cleanup(roomDir);
  });

  it('rebuildGraph indexes both flat and nested artifacts (3 total)', async () => {
    const result = await lazygraph.rebuildGraph(conn, roomDir);
    assert.strictEqual(result.artifacts, 3, `Expected 3 artifacts, got ${result.artifacts}`);
  });

  it('flat artifact id and section attribution are unchanged', () => {
    const rows = conn.prepare(
      "SELECT * FROM nodes WHERE id = 'problem-definition/insight' AND type = 'Artifact'"
    ).all();
    assert.strictEqual(rows.length, 1, 'Flat artifact id should be problem-definition/insight');
    const props = JSON.parse(rows[0].properties);
    assert.strictEqual(props.section, 'problem-definition');
  });
});

// ============================================================
// Test 4: sub-room exclusion (parent conn stays clean)
// ============================================================

describe('QI8-04: sub-room exclusion', () => {
  let roomDir, db, conn;

  before(async () => {
    roomDir = makeRoom();
    // Flat artifact directly under the section.
    writeFile(roomDir, 'market-analysis/flat.md', '# Flat\nBody.\n');
    // A child folder carrying a .room-root sentinel (a sub-room) with its own .md.
    writeFile(roomDir, 'market-analysis/sub-venture/inner.md', '# Inner\nSub-room body.\n');
    writeFile(roomDir, 'market-analysis/sub-venture/.room-root', '');
    ({ db, conn } = await openRoom(roomDir));
  });

  after(async () => {
    await lazygraph.closeGraph(db);
    cleanup(roomDir);
  });

  it('parent rebuildGraph does not index the sub-room artifact', async () => {
    const result = await lazygraph.rebuildGraph(conn, roomDir);
    assert.strictEqual(result.artifacts, 1, `Expected 1 artifact (flat only), got ${result.artifacts}`);
    const ids = conn.prepare("SELECT id FROM nodes WHERE type = 'Artifact'").all().map(r => r.id);
    assert.ok(
      !ids.some(id => id.includes('sub-venture/inner')),
      `Sub-room artifact must not be in the parent conn; got ${JSON.stringify(ids)}`
    );
  });
});
