#!/usr/bin/env node
/**
 * Phase 353 Plan 02 Task 6: the jtbd anchor node, minted before any edge
 * ever names it.
 *
 * Gates RULE-16. Follows tests/test-345-gate-anchor.cjs's module-load SKIP
 * guard and fixture-room idiom.
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');

// Checked BEFORE requiring navigation.cjs, which itself requires
// jtbd-anchor.cjs at module load: a plain module-load SKIP guard around
// navigation.cjs would swallow the missing-module RED into an exit-0 SKIP
// instead of the required non-zero RED.
const JTBD_ANCHOR_PATH = path.join(REPO, 'lib', 'core', 'navigation', 'jtbd-anchor.cjs');
if (!fs.existsSync(JTBD_ANCHOR_PATH)) {
  console.error('RED: missing lib/core/navigation/jtbd-anchor.cjs');
  process.exit(1);
}

let roomDbMod;
let jtbdAnchor;
let navigation;
let edges;
try {
  roomDbMod = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
  navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
  edges = require(path.join(REPO, 'lib', 'core', 'navigation', 'edges.cjs'));
  jtbdAnchor = require(JTBD_ANCHOR_PATH);
} catch (e) {
  console.log('SKIP: test-353-anchor-edge -- node:sqlite or a required module is unavailable. ' + (e.code || e.message));
  process.exit(0);
}

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

function makeFixtureRoom() {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), '353-06-anchor-'));
  const handle = roomDbMod.openRoomDb(roomDir);
  return { roomDir: roomDir, db: handle };
}
function cleanupFixtureRoom(fixture) {
  try { roomDbMod.closeRoomDb(fixture.db); } catch (_e) { /* tolerant */ }
  try { fs.rmSync(fixture.roomDir, { recursive: true, force: true }); } catch (_e) { /* tolerant */ }
}

// --- JTBD_ANCHOR_ID shape ---
check('JTBD_ANCHOR_ID prefixes correctly', jtbdAnchor.JTBD_ANCHOR_ID('find-problem') === 'jtbd:find-problem');
check('JTBD_ANCHOR_ID returns null on empty string', jtbdAnchor.JTBD_ANCHOR_ID('') === null);
check('JTBD_ANCHOR_ID returns null on non-string', jtbdAnchor.JTBD_ANCHOR_ID(42) === null);

// --- navigation chokepoint re-export ---
check('navigation.mintJtbdAnchor is a function', typeof navigation.mintJtbdAnchor === 'function');
check('navigation.JTBD_ANCHOR_ID is a function', typeof navigation.JTBD_ANCHOR_ID === 'function');
check('navigation.JTBD_ANCHOR_ID matches the module', navigation.JTBD_ANCHOR_ID('find-problem') === 'jtbd:find-problem');

// --- type is jtbd not claim ---
const fixture = makeFixtureRoom();
try {
  const result = jtbdAnchor.mintJtbdAnchor(fixture.db, 'find-problem');
  check('mint succeeds', result.ok === true);
  check('mint reports created:true on first mint', result.created === true);
  const row = fixture.db.prepare('SELECT type, properties, review_status, created_by FROM nodes WHERE id = ?').get('jtbd:find-problem');
  check('type is jtbd not claim', !!row && row.type === 'jtbd');
  const rowProps = row ? JSON.parse(row.properties || '{}') : {};
  check('epistemic_type is observation', rowProps.epistemic_type === 'observation');
  check('review_status is proposed', !!row && row.review_status === 'proposed');
  check('created_by is system', !!row && row.created_by === 'system');

  // --- re-mint is idempotent ---
  const secondMint = jtbdAnchor.mintJtbdAnchor(fixture.db, 'find-problem');
  check('re-mint is idempotent', secondMint.ok === true && secondMint.created === false);

  // --- mint precedes edge: mint, confirm ok, then writeEdge succeeds ---
  const claimId = 'claim:test-353-06-anchor';
  const nodeInsert = require(path.join(REPO, 'lib', 'core', 'node-insert.cjs'));
  nodeInsert.insertNode(fixture.db, claimId, 'claim', '{}', {
    source_path: 'test:353-06',
    created_by: 'user',
    epistemic_type: 'observation',
    review_status: 'proposed',
  });
  const anchorMint = jtbdAnchor.mintJtbdAnchor(fixture.db, 'find-problem');
  check('mint precedes edge (anchor already ok:true)', anchorMint.ok === true);
  const edgeResult = navigation.writeEdge(fixture.db, {
    source_id: claimId,
    target_id: jtbdAnchor.JTBD_ANCHOR_ID('find-problem'),
    edge_type: 'SOURCED_FROM',
    properties: { relation: 'sourced_from', origin: 'test' },
  });
  check('edge write to a minted anchor succeeds', edgeResult && edgeResult.ok === true);

  // --- unminted target yields a dangling edge (why the order is blocking) ---
  const unmintedTarget = 'jtbd:never-minted-in-this-test';
  const danglingEdge = navigation.writeEdge(fixture.db, {
    source_id: claimId,
    target_id: unmintedTarget,
    edge_type: 'SOURCED_FROM',
    properties: { relation: 'sourced_from', origin: 'test' },
  });
  check('unminted target yields a dangling edge (why the order is blocking)', danglingEdge && danglingEdge.ok === true);
  const targetRow = fixture.db.prepare('SELECT id FROM nodes WHERE id = ?').get(unmintedTarget);
  check('the dangling edge target has no node row (proving it is dangling)', !targetRow);
} finally {
  cleanupFixtureRoom(fixture);
}

console.log('');
console.log('PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
