'use strict';
/*
 * tests/helpers/fixture-room-365.cjs -- Phase 365-02 shared fixture for the
 * acceptance tests (byte, byte-derived, one-week, floor).
 *
 * Wraps tests/helpers/fixture-room-354.cjs (makeScratchRoom, captureToolServer)
 * and adds the pieces the Phase 365 acceptance tests need:
 *
 *   makeRoom365(label)             a scratch room with a room.db
 *   seedClaim(db, {text, variant}) a proposed claim; `variant` changes only the
 *                                  non-text provenance input (the sessionId that
 *                                  seeds the node id), so two claims keep
 *                                  byte-identical text
 *   addSourceEdge(db, claimId, {url, retrieved_at, locator})
 *                                  an EvidenceClaim carrying url and
 *                                  retrieved_at, plus an outbound SOURCED_FROM
 *                                  edge from the claim to it (the provenance
 *                                  edge type the standing reader counts)
 *   recordAsk(db, claimId, {rung}) a verification record, method ask
 *   recordRead(db, claimId, {againstId, rung})
 *                                  a verification record, method read
 *   writeRoomFloor(roomDir, floorId) a room-root ROOM.md whose frontmatter
 *                                  carries `verification_floor: <id>`
 *   openFresh(roomDir)             a NEW room.db handle (never a handler's)
 *   readStatus(roomDir, nodeId)    review_status through a fresh handle
 *   cleanup(room)
 *
 * Canon Part 9: every write goes through lib/core/navigation.cjs exports; no
 * raw INSERT in this file. Canon Part 8: no network, no Brain.
 * Hyphens only; no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const base = require('./fixture-room-354.cjs');

const SKIP_EXIT_CODE = base.SKIP_EXIT_CODE;
const captureToolServer = base.captureToolServer;

function makeRoom365(label) {
  return base.makeScratchRoom('365-' + String(label || 'anon'));
}

function parseProps(row) {
  try { return JSON.parse((row && row.properties) || '{}'); } catch (_e) { return {}; }
}

// seedClaim(db, {text, variant}) -> claim id. `variant` feeds sessionId only,
// so the node id differs while the text stays byte-identical.
function seedClaim(db, opts) {
  const o = opts || {};
  const res = navigation.writeClaimNode(db, {
    knowledge_type: 'fact',
    text: o.text,
    sessionId: 'fixture-365-' + String(o.variant || 'v'),
  });
  if (!res || res.ok !== true) {
    throw new Error('seedClaim failed: ' + JSON.stringify(res));
  }
  return res.node_id;
}

// addSourceEdge(db, claimId, {url, retrieved_at, locator}) -> evidence node id.
// The locator rides on the SOURCED_FROM edge properties (writeEvidenceClaim has
// no locator column and 365 must not edit it to seed a fixture).
function addSourceEdge(db, claimId, src) {
  const s = src || {};
  const ev = navigation.writeEvidenceClaim(db, {
    topic: 'fixture source',
    source: 'fixture-365',
    url: s.url,
    retrieved_at: s.retrieved_at,
    evidence_tier: 'Academic',
    summary: 'fixture source for ' + claimId,
    sessionId: 'fixture-365-src-' + String(s.variant || claimId).replace(/[^A-Za-z0-9]/g, '').slice(-24),
  });
  if (!ev || ev.ok !== true) {
    throw new Error('addSourceEdge: evidence write failed: ' + JSON.stringify(ev));
  }
  const evidenceId = ev.node_id || ev.id;
  const edgeProps = { origin: 'fixture-365' };
  if (typeof s.locator === 'string' && s.locator.length > 0) edgeProps.locator = s.locator;
  const edge = navigation.writeEdge(db, {
    source_id: claimId,
    target_id: evidenceId,
    edge_type: 'SOURCED_FROM',
    properties: edgeProps,
  });
  if (!edge || edge.ok !== true) {
    throw new Error('addSourceEdge: edge write failed: ' + JSON.stringify(edge));
  }
  return evidenceId;
}

// recordAsk(db, claimId, {rung}) -- the claim was put to a model (method ask).
function recordAsk(db, claimId, opts) {
  const o = opts || {};
  const res = navigation.recordClaimVerification(db, {
    claim_id: claimId,
    against_id: 'model:fixture-365-ask',
    against_kind: 'artifact',
    method: 'ask',
    result: 'supports',
    rung: Number.isInteger(o.rung) ? o.rung : 2,
    checked_by: 'system',
    checked_at: '2026-09-30T00:00:00.000Z',
  });
  if (!res || res.ok !== true) throw new Error('recordAsk failed: ' + JSON.stringify(res));
  return res;
}

// recordRead(db, claimId, {againstId, rung}) -- the claim was read against a source.
function recordRead(db, claimId, opts) {
  const o = opts || {};
  const res = navigation.recordClaimVerification(db, {
    claim_id: claimId,
    against_id: o.againstId || 'source:fixture-365-read',
    against_kind: 'source',
    method: 'read',
    result: 'supports',
    rung: Number.isInteger(o.rung) ? o.rung : 3,
    checked_by: 'system',
    checked_at: '2026-09-30T00:00:00.000Z',
  });
  if (!res || res.ok !== true) throw new Error('recordRead failed: ' + JSON.stringify(res));
  return res;
}

// writeRoomFloor(roomDir, floorId) -- room-root ROOM.md with the floor declared
// in frontmatter. Written with fs because ROOM.md is a plain identity file the
// room owner edits by hand (ICM Layer 0), not a graph node.
function writeRoomFloor(roomDir, floorId) {
  const body = [
    '---',
    'verification_floor: ' + floorId,
    '---',
    '',
    '# Fixture room',
    '',
    'Identity file for the Phase 365 acceptance fixture.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), body, 'utf8');
}

function openFresh(roomDir) {
  return openRoomDb(roomDir);
}

// readStatus(roomDir, nodeId) -> review_status through a FRESH handle, or null.
function readStatus(roomDir, nodeId) {
  const db = openRoomDb(roomDir);
  try {
    const row = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(nodeId);
    return row ? row.review_status : null;
  } finally {
    closeRoomDb(db);
  }
}

// readClaimText(roomDir, nodeId) -> the claim's stored text through a fresh handle.
function readClaimText(roomDir, nodeId) {
  const db = openRoomDb(roomDir);
  try {
    const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(nodeId);
    const props = parseProps(row);
    return typeof props.text === 'string' ? props.text : null;
  } finally {
    closeRoomDb(db);
  }
}

function cleanup(room) {
  if (room && typeof room.cleanup === 'function') room.cleanup();
}

module.exports = {
  SKIP_EXIT_CODE,
  captureToolServer,
  makeRoom365,
  seedClaim,
  addSourceEdge,
  recordAsk,
  recordRead,
  writeRoomFloor,
  openFresh,
  closeFresh: closeRoomDb,
  readStatus,
  readClaimText,
  cleanup,
};
