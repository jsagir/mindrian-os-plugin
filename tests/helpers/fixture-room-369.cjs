'use strict';
/*
 * tests/helpers/fixture-room-369.cjs -- Phase 369-04 shared fixture for the
 * Phase 369 tests (change log, daemon, shell, e2e).
 *
 * Exports:
 *   SCHEMA_VARIANTS                 ['wide', 'mid', 'legacy'] (from fixture-room-347)
 *   buildRoom369({ tmpDir, slug, variant, migrate, seed })
 *                                   -> { roomDir, dbPath, slug, variant }
 *   writeRegistry(roomsHome, rooms, active)
 *                                   writes <roomsHome>/.rooms/registry.json
 *
 * buildRoom369 builds the RAW variant through buildChainFixtureRoom (the only
 * raw DDL allowed, reused from fixture-room-347), closes that handle, and when
 * `migrate: true` opens and closes the room once through openRoomDb (the write
 * door, so every migration runs; on `legacy` that rebuilds `nodes` through
 * phase-109). `seed` is an optional list applied through navigation.cjs
 * exports only, and needs `migrate: true` (the typed writers expect the
 * tightened schema):
 *   { kind: 'claim',  text, variant? }
 *   { kind: 'source', url, retrieved_at, topic?, variant? }
 *   { kind: 'edge',   source_id, target_id, edge_type, properties? }
 *
 * Canon Part 9: this file holds no raw INSERT, UPDATE or DELETE; the room.db
 * write door and the navigation writers are the only way in. Canon Part 8: no
 * network, no Brain. The room is built under the caller's tmpDir, normally a
 * hermetic rooms home in the OS temp dir, never ~/MindrianRooms.
 * Hyphens only; no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const {
  buildChainFixtureRoom,
  SCHEMA_VARIANTS,
} = require('./fixture-room-347.cjs');

function applySeed(db, seed, slug) {
  const ids = [];
  seed.forEach((item, i) => {
    if (!item || typeof item !== 'object') throw new Error('fixture-room-369: bad seed item at ' + i);
    if (item.kind === 'claim') {
      const res = navigation.writeClaimNode(db, {
        knowledge_type: 'fact',
        text: item.text,
        sessionId: 'fixture-369-' + slug + '-' + String(item.variant || i),
      });
      if (!res || res.ok !== true) throw new Error('fixture-room-369: claim seed failed: ' + JSON.stringify(res));
      ids.push(res.node_id);
    } else if (item.kind === 'source') {
      const res = navigation.writeEvidenceClaim(db, {
        topic: item.topic || 'fixture source',
        source: 'fixture-369',
        url: item.url,
        retrieved_at: item.retrieved_at,
        evidence_tier: 'Academic',
        summary: 'fixture source ' + i,
        sessionId: 'fixture-369-' + slug + '-src-' + String(item.variant || i),
      });
      if (!res || res.ok !== true) throw new Error('fixture-room-369: source seed failed: ' + JSON.stringify(res));
      ids.push(res.node_id || res.id);
    } else if (item.kind === 'edge') {
      const res = navigation.writeEdge(db, {
        source_id: item.source_id,
        target_id: item.target_id,
        edge_type: item.edge_type,
        properties: item.properties || { origin: 'fixture-369' },
      });
      if (!res || res.ok !== true) throw new Error('fixture-room-369: edge seed failed: ' + JSON.stringify(res));
      ids.push(null);
    } else {
      throw new Error('fixture-room-369: unknown seed kind ' + JSON.stringify(item.kind));
    }
  });
  return ids;
}

function buildRoom369(opts) {
  const o = opts || {};
  const tmpDir = o.tmpDir;
  const slug = o.slug || 'room-369';
  const variant = o.variant || 'wide';
  if (typeof tmpDir !== 'string' || tmpDir.length === 0) {
    throw new Error('fixture-room-369: tmpDir is required');
  }
  fs.mkdirSync(tmpDir, { recursive: true });

  const raw = buildChainFixtureRoom(tmpDir, variant);
  try { raw.db.close(); } catch (_e) { /* best effort */ }

  // A plain identity file so the room resolves like a real room (ICM Layer 0).
  fs.writeFileSync(
    path.join(raw.roomDir, 'STATE.md'),
    '# ' + slug + '\n\nFixture room for tests/helpers/fixture-room-369.cjs. Synthetic, no real content.\n'
  );

  const wantSeed = Array.isArray(o.seed) && o.seed.length > 0;
  if (o.migrate === true || wantSeed) {
    const db = openRoomDb(raw.roomDir);
    try {
      if (wantSeed) applySeed(db, o.seed, slug);
    } finally {
      closeRoomDb(db);
    }
  }

  return { roomDir: raw.roomDir, dbPath: raw.dbPath, slug: slug, variant: variant };
}

// writeRegistry(roomsHome, rooms, active) -- rooms is a list of
// { slug, abs_path } (or { slug, roomDir }); active defaults to the first slug.
function writeRegistry(roomsHome, rooms, active) {
  const map = {};
  for (const r of rooms || []) {
    const abs = r.abs_path || r.roomDir;
    map[r.slug] = { slug: r.slug, abs_path: abs };
  }
  const dir = path.join(roomsHome, '.rooms');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'registry.json');
  fs.writeFileSync(
    file,
    JSON.stringify({ active: active || (rooms && rooms[0] && rooms[0].slug) || null, rooms: map }, null, 2)
  );
  return file;
}

module.exports = {
  buildRoom369,
  writeRegistry,
  SCHEMA_VARIANTS,
};
