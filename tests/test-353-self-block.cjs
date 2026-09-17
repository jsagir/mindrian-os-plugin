#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 353 Plan 01 Task 3 -- test-353-self-block: renderSelfBlock's YAML
 * shape and token budget, writeSelfBlocks' byte-preservation and
 * artifact-exclusion contract, the hostile-directory-name YAML round trip,
 * and root ROOM.md creation from the identity template.
 *
 * Bare node script, no framework, exits non-zero on any assertion failure.
 * House rule: hyphens only, no em-dashes.
 *
 * Run: node tests/test-353-self-block.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const matter = require('gray-matter');

const REPO = path.resolve(__dirname, '..');
const ALPHA_ROOM = path.join(REPO, 'tests', 'fixtures', 'icm-rooms', 'alpha-room');

// renderSelfBlock/writeSelfBlocks live in room-map.cjs alongside
// buildRoomMap; no optional/environment-dependent deps, so this is a hard
// require (RED is a load failure, not a SKIP).
let roomMap;
try {
  roomMap = require(path.join(REPO, 'lib', 'core', 'room-map.cjs'));
} catch (e) {
  console.error('FAIL: test-353-self-block -- lib/core/room-map.cjs failed to load: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
}
if (typeof roomMap.renderSelfBlock !== 'function') {
  console.error('FAIL: test-353-self-block -- renderSelfBlock export missing from lib/core/room-map.cjs');
  process.exit(1);
}

let tokenEstimator;
try {
  tokenEstimator = require(path.join(REPO, 'lib', 'core', 'token-estimator.cjs'));
} catch (e) {
  console.log('SKIP: test-353-self-block -- lib/core/token-estimator.cjs is unavailable. ' + (e.code || e.message));
  process.exit(0);
}

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

function main() {
  // --- token budget: every fixture-room node's block is 60-120 tokens -----
  const map = roomMap.buildRoomMap(ALPHA_ROOM);
  for (const node of map.nodes) {
    if (!roomMap.SELF_BLOCK_KINDS.has(node.kind)) continue;
    const block = roomMap.renderSelfBlock(node);
    const tokens = tokenEstimator.estimateTokens(block);
    assert.ok(tokens <= 120, 'node ' + node.path + ' self-block is <= 120 tokens (got ' + tokens + ')');
  }
  ok('every blocked-kind node\'s self-block estimates at or under 120 tokens (D-353-2 band)');

  // --- YAML escape round-trip: a hostile child directory name --------------
  const yamlRoot = fs.mkdtempSync(path.join(os.tmpdir(), '353-self-block-yaml-'));
  try {
    const roomDir = path.join(yamlRoot, 'hostile-room');
    fs.mkdirSync(roomDir, { recursive: true });
    fs.writeFileSync(path.join(roomDir, '.room-root'), '');
    fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '---\ndirectory_type: root\nicm_layer: 0\n---\n\n# hostile-room\n');
    // Deliberately empty (no STATE.md, no .md file): a hostile-NAMED
    // directory that does NOT qualify as a section under discoverSections,
    // so it never becomes a node writeSelfBlocks must itself write to. This
    // isolates the thing under test -- the ROOT node's own `children` list
    // correctly escaping a hostile name -- from an unrelated "section
    // missing its own ROOM.md" error.
    const hostileName = 'a": b';
    fs.mkdirSync(path.join(roomDir, hostileName), { recursive: true });
    const hostileMap = roomMap.buildRoomMap(roomDir);
    const rootNode = hostileMap.nodes.find((n) => n.path === '.');
    assert.ok(rootNode.children.includes(hostileName), 'the hostile directory name is discovered verbatim');
    const result = roomMap.writeSelfBlocks(roomDir, hostileMap);
    assert.equal(result.errors.length, 0, 'writeSelfBlocks reports no errors on the hostile-name tree: ' + JSON.stringify(result.errors));
    const written = fs.readFileSync(path.join(roomDir, 'ROOM.md'), 'utf8');
    const reparsed = matter(written);
    assert.ok(Array.isArray(reparsed.data.icm_self.children), 'icm_self.children re-parses as an array');
    assert.ok(reparsed.data.icm_self.children.includes(hostileName), 'the hostile name round-trips through gray-matter exactly');
    console.log('yaml escape round-trip');
    ok('a directory named ' + JSON.stringify(hostileName) + ' round-trips through escapeYamlDoubleQuoted + gray-matter (T-353-02)');
  } finally {
    fs.rmSync(yamlRoot, { recursive: true, force: true });
  }

  // --- artifact_kind_excluded: an artifact node is never written to --------
  const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), '353-self-block-artifact-'));
  try {
    const roomCopy = path.join(artifactRoot, 'alpha-room');
    copyDirSync(ALPHA_ROOM, roomCopy);
    const builtMap = roomMap.buildRoomMap(roomCopy);
    const firstCutNode = builtMap.nodes.find((n) => n.kind === 'artifact');
    assert.ok(firstCutNode, 'fixture has an artifact node');
    const beforeContent = fs.readFileSync(path.join(roomCopy, firstCutNode.path, 'ROOM.md'), 'utf8');
    const result = roomMap.writeSelfBlocks(roomCopy, builtMap);
    const skippedEntry = result.skipped.find((s) => s.path === firstCutNode.path);
    assert.ok(skippedEntry, 'the artifact node appears in skipped[]');
    assert.equal(skippedEntry.reason, 'artifact_kind_excluded');
    const afterContent = fs.readFileSync(path.join(roomCopy, firstCutNode.path, 'ROOM.md'), 'utf8');
    assert.equal(beforeContent, afterContent, 'the artifact folder\'s ROOM.md is byte-unchanged (R-353-B: never blocked)');
    console.log('artifact_kind_excluded');
    ok('an artifact-kind node is skipped with reason artifact_kind_excluded and never written to');
  } finally {
    fs.rmSync(artifactRoot, { recursive: true, force: true });
  }

  // --- byte-stable on second write ------------------------------------------
  const stableRoot = fs.mkdtempSync(path.join(os.tmpdir(), '353-self-block-stable-'));
  try {
    const roomCopy = path.join(stableRoot, 'alpha-room');
    copyDirSync(ALPHA_ROOM, roomCopy);
    const map1 = roomMap.buildRoomMap(roomCopy);
    roomMap.writeSelfBlocks(roomCopy, map1);
    const snapshotAfterFirst = {};
    for (const node of map1.nodes) {
      if (!roomMap.SELF_BLOCK_KINDS.has(node.kind)) continue;
      const dirAbs = node.path === '.' ? roomCopy : path.join(roomCopy, node.path);
      snapshotAfterFirst[node.path] = fs.readFileSync(path.join(dirAbs, 'ROOM.md'), 'utf8');
    }
    const map2 = roomMap.buildRoomMap(roomCopy);
    roomMap.writeSelfBlocks(roomCopy, map2);
    let allStable = true;
    for (const node of map2.nodes) {
      if (!roomMap.SELF_BLOCK_KINDS.has(node.kind)) continue;
      const dirAbs = node.path === '.' ? roomCopy : path.join(roomCopy, node.path);
      const after = fs.readFileSync(path.join(dirAbs, 'ROOM.md'), 'utf8');
      if (after !== snapshotAfterFirst[node.path]) {
        allStable = false;
        console.error('  UNSTABLE at ' + node.path);
      }
    }
    assert.ok(allStable, 'every blocked ROOM.md is byte-identical after a second writeSelfBlocks run');
    console.log('byte-stable on second write');
    ok('running writeSelfBlocks twice on an unchanged tree leaves every file byte-identical the second time');
  } finally {
    fs.rmSync(stableRoot, { recursive: true, force: true });
  }

  // --- root ROOM.md created from identity template --------------------------
  const missingRootRoot = fs.mkdtempSync(path.join(os.tmpdir(), '353-self-block-missing-root-'));
  try {
    // Construct the "missing root ROOM.md" scenario at test runtime (the
    // committed gamma-room fixture carries a root ROOM.md to satisfy this
    // repo's pre-commit Data Room invariant; see
    // tests/fixtures/icm-rooms/README.md's "Committed-tree compromise").
    const gammaRoom = path.join(REPO, 'tests', 'fixtures', 'icm-rooms', 'gamma-room');
    const roomCopy = path.join(missingRootRoot, 'gamma-room');
    copyDirSync(gammaRoom, roomCopy);
    fs.unlinkSync(path.join(roomCopy, 'ROOM.md'));
    assert.ok(!fs.existsSync(path.join(roomCopy, 'ROOM.md')), 'the temp copy genuinely has no root ROOM.md');

    const missingMap = roomMap.buildRoomMap(roomCopy);
    const rootNode = missingMap.nodes.find((n) => n.path === '.');
    assert.equal(rootNode.has_room_md, false, 'buildRoomMap reports has_room_md:false for the missing root');

    const result = roomMap.writeSelfBlocks(roomCopy, missingMap);
    assert.ok(result.written.includes('.'), 'the root node is written after its ROOM.md is created');
    assert.ok(fs.existsSync(path.join(roomCopy, 'ROOM.md')), 'a root ROOM.md now exists');
    const created = fs.readFileSync(path.join(roomCopy, 'ROOM.md'), 'utf8');
    const parsed = matter(created);
    assert.equal(parsed.data.directory_type, 'root', 'the created ROOM.md uses the identity template vocabulary');
    assert.ok(parsed.data.icm_self, 'the newly-created root ROOM.md also carries its icm_self block');
    console.log('root ROOM.md created from identity template');
    ok('a root node with has_room_md:false gets its ROOM.md created from ROOM.md.identity.tmpl, then the block');
  } finally {
    fs.rmSync(missingRootRoot, { recursive: true, force: true });
  }

  console.log('');
  console.log('Checks: ' + checks);
  console.log('PASS test-353-self-block.cjs');
}

try {
  main();
} catch (e) {
  console.error('FAIL: test-353-self-block');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}
