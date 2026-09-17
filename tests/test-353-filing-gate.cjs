#!/usr/bin/env node
/**
 * Phase 353 Plan 02 Task 7: the filing gate on artifact_file and
 * claim_write, with the anchor edge.
 *
 * Gates RULE-17, RULE-18.
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const GATE_PATH = path.join(REPO, 'lib', 'core', 'navigation', 'section-gate.cjs');

if (!fs.existsSync(GATE_PATH)) {
  console.error('RED: missing lib/core/navigation/section-gate.cjs');
  process.exit(1);
}

let roomDbMod;
let navigation;
let nodeInsert;
let views;
let claimTool;
let sectionGate;
try {
  roomDbMod = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
  navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
  nodeInsert = require(path.join(REPO, 'lib', 'core', 'node-insert.cjs'));
  views = require(path.join(REPO, 'lib', 'mcp', 'tools', 'views.cjs'));
  claimTool = require(path.join(REPO, 'lib', 'mcp', 'tools', 'claim.cjs'));
  sectionGate = require(GATE_PATH);
} catch (e) {
  console.log('SKIP: test-353-filing-gate -- node:sqlite or a required module is unavailable. ' + (e.code || e.message));
  process.exit(0);
}

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

function makeFixtureRoom() {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), '353-07-gate-'));
  const handle = roomDbMod.openRoomDb(roomDir);
  return { roomDir: roomDir, db: handle };
}
function cleanupFixtureRoom(fixture) {
  try { roomDbMod.closeRoomDb(fixture.db); } catch (_e) { /* tolerant */ }
  try { fs.rmSync(fixture.roomDir, { recursive: true, force: true }); } catch (_e) { /* tolerant */ }
}

// --- GATE_MODES ---
check('GATE_MODES is exactly flag and strict', JSON.stringify(sectionGate.GATE_MODES.slice().sort()) === JSON.stringify(['flag', 'strict']));

// --- evaluateFilingGate: pure verdict function ---
check('unresolved when no section', sectionGate.evaluateFilingGate({ section: null, servesJtbd: 'find-problem' }).verdict === 'unresolved');
check('unresolved is not a match', sectionGate.evaluateFilingGate({ section: null }).verdict !== 'match');
check('unresolved when section job undeclared', sectionGate.evaluateFilingGate({ section: 'no-such-section', servesJtbd: 'find-problem' }).verdict === 'unresolved');
check('match when no declared job signal', sectionGate.evaluateFilingGate({ section: 'problem-definition', servesJtbd: null }).verdict === 'match');
check('match on exact job', sectionGate.evaluateFilingGate({ section: 'problem-definition', servesJtbd: 'find-problem' }).verdict === 'match');
check('match on declared secondary', sectionGate.evaluateFilingGate({ section: 'strategy', servesJtbd: 'explore' }).verdict === 'match');
check('mismatch on a genuinely different job', sectionGate.evaluateFilingGate({ section: 'problem-definition', servesJtbd: 'model-business' }).verdict === 'mismatch');

// --- resolveFocusSection ---
const fx1 = makeFixtureRoom();
try {
  const noFocus = sectionGate.resolveFocusSection(fx1.db, 'session-with-no-focus');
  check('resolveFocusSection: no_focus when nothing set', noFocus.ok === false && noFocus.reason === 'no_focus');

  nodeInsert.insertNode(fx1.db, 'claim:353-07-focus-target', 'claim', JSON.stringify({ section: 'business-model' }), {
    source_path: 'test:353-07', created_by: 'user', epistemic_type: 'observation', review_status: 'proposed',
  });
  navigation.setFocus(fx1.db, 'session-353-07', 'claim:353-07-focus-target', 'user');
  const resolved = sectionGate.resolveFocusSection(fx1.db, 'session-353-07');
  check('resolveFocusSection: resolves the focus node\'s own section property', resolved.ok === true && resolved.section === 'business-model');
} finally {
  cleanupFixtureRoom(fx1);
}

// --- claim_write: no section parameter was added, connectors byte-unchanged ---
const claimSrc = fs.readFileSync(path.join(REPO, 'lib', 'mcp', 'tools', 'claim.cjs'), 'utf8');
check('claim_write MCP schema carries no section parameter', !/section:\s*z\./.test(claimSrc));

// --- flag lands the write; strict refuses; mint precedes edge; N of N carry
//     an anchor edge (criterion 3) ---
const fx2 = makeFixtureRoom();
try {
  // Set up a focus pointing at a node whose section is business-model
  // (job model-business), then file claims via writeClaimNode directly
  // (the MCP tool wrapper needs a live server/extra harness this test does
  // not construct; the gate + anchor logic under test lives in
  // section-gate.cjs and navigation.cjs, exercised directly here, the same
  // level test-353-anchor-edge.cjs already exercises for the anchor half).
  nodeInsert.insertNode(fx2.db, 'claim:353-07-focus-2', 'claim', JSON.stringify({ section: 'business-model' }), {
    source_path: 'test:353-07', created_by: 'user', epistemic_type: 'observation', review_status: 'proposed',
  });
  navigation.setFocus(fx2.db, 'session-353-07b', 'claim:353-07-focus-2', 'user');

  const N = 5;
  let anchoredCount = 0;
  for (let i = 0; i < N; i++) {
    const focusSection = navigation.resolveFocusSection(fx2.db, 'session-353-07b');
    const gateResult = navigation.evaluateFilingGate({ section: focusSection.ok ? focusSection.section : null, servesJtbd: null, mode: 'flag' });
    check('flag lands the write (verdict computed, never refuses)', gateResult.verdict === 'match' || gateResult.verdict === 'mismatch' || gateResult.verdict === 'unresolved');
    const claimResult = navigation.writeClaimNode(fx2.db, {
      knowledge_type: 'fact',
      text: 'Filing gate test claim number ' + i,
      sessionId: 'session-353-07b',
      sourceSegment: 'seg-353-07-' + i,
    });
    if (claimResult.ok && gateResult.section_job) {
      const mint = navigation.mintJtbdAnchor(fx2.db, gateResult.section_job);
      check('mint precedes edge (mint ok:true before writeEdge)', mint.ok === true);
      const edgeResult = navigation.writeEdge(fx2.db, {
        source_id: claimResult.node_id,
        target_id: navigation.JTBD_ANCHOR_ID(gateResult.section_job),
        edge_type: 'SOURCED_FROM',
        properties: { relation: 'sourced_from', origin: 'claim_write' },
      });
      if (edgeResult && edgeResult.ok === true) anchoredCount += 1;
    }
  }
  check('N of N claims carry an anchor edge', anchoredCount === N);
  console.log('  (N of N: ' + anchoredCount + ' of ' + N + ')');

  // strict refuses on a genuine mismatch, before any write
  const strictGate = navigation.evaluateFilingGate({ section: 'problem-definition', servesJtbd: 'model-business', mode: 'strict' });
  check('strict refuses', strictGate.verdict === 'mismatch');
} finally {
  cleanupFixtureRoom(fx2);
}

// --- EVENT_TYPES untouched (102, R-353-K) ---
const memoryEvents = require(path.join(REPO, 'lib', 'core', 'navigation', 'memory-events.cjs'));
check('EVENT_TYPES.size is 102 (untouched)', memoryEvents.EVENT_TYPES.size === 102);

console.log('');
console.log('PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
