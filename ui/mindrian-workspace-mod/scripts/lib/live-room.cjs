// 369.26-17: a hermetic live room for the final render check, and a read-only way to look inside it.
//
// buildLiveRoom({ tmp?, folderName? })  resolves { roomsHome, home, slug, roomDir, folderName,
//   folderDir, gateId, sessionId, close() }
//   - a fresh rooms home under the OS temp folder (never the person's real rooms home, never a real
//     Brain: the repo's own helper gives the spawned server a dead Brain address)
//   - ONE room whose directory is exactly <rooms home>/<slug> (the place the mod computes), holding
//     one folder with a ROOM.md whose purpose is a short sentence marked (sample)
//   - ONE single-select decision card raised by ANOTHER process (the repo's Claude Code shaped
//     stdio client), three ranked options, the first recommended with a description, `approving`
//     naming the first so the verdicts are classifiable. The room records it, so any session bound
//     to the room lists it.
//   - a binding file for `sessionId` (a fresh UUID the harness gives the nested Claude Code as its
//     session id), so a nested session reads the room as bound without a model turn
//   - close() kills only the one child this spawned and deletes the whole hermetic folder
//
// inspectLiveRoom({ roomsHome, slug, gateId })  reads the room READ ONLY, on a COPY of its database
//   files (never in place), and returns { decisionNodes, gateAnswer: { found, verdict, chosen,
//   answeredVia }, recordsHash }. recordsHash is a stable hash of the gate and decision rows, so
//   "decide later wrote nothing" is hash equality.
//
// A missing MCP client package is an ENV GAP: buildLiveRoom throws an Error with envGap = true and a
// plain sentence; the harness turns that into exit 77. Nothing is faked.
//
// Build tooling (CJS, built-ins plus the repo's own helpers by relative path). No em-dashes.
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { hashRecords } = require('./live-pure.cjs');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const SLUG = 'live-check-room';
const DEFAULT_FOLDER = 'Funding';

// The card the live round trip uses. Ids are short and stable so a script and a judge can name them.
const OPTIONS = [
  { id: 'yes', label: 'Yes, go with it', rank: 1, recommended: true, description: 'The evidence shows commitment, not only interest (sample).' },
  { id: 'later', label: 'Not yet, show me more', rank: 2 },
  { id: 'no', label: 'No', rank: 3 },
];

function envGap(detail) {
  const e = new Error('ENV GAP: the repo MCP client package cannot be loaded (' + detail + '), so a local server cannot be driven and no live room can be raised. Run `npm ci` in the repo root, then run this same command again. Nothing was faked.');
  e.envGap = true;
  return e;
}

async function buildLiveRoom(opts) {
  const o = opts || {};
  try {
    require('@modelcontextprotocol/client');
  } catch (e) {
    throw envGap(e && e.message ? e.message : String(e));
  }
  const { buildRoom369, writeRegistry } = require(path.join(REPO, 'tests', 'helpers', 'fixture-room-369.cjs'));
  const { cliClient } = require(path.join(REPO, 'tests', 'helpers', 'cli-gate-369.cjs'));
  const { writeSessionBinding } = require(path.join(REPO, 'lib', 'core', 'session-binding.cjs'));

  const root = fs.mkdtempSync(path.join(o.tmp ? path.resolve(o.tmp) : os.tmpdir(), 'mos-ws-live-'));
  const roomsHome = path.join(root, 'rooms');
  const home = path.join(root, 'home');
  fs.mkdirSync(roomsHome, { recursive: true });
  fs.mkdirSync(home, { recursive: true });

  let raiser = null;
  const close = async () => {
    if (raiser) {
      try { await raiser.close(); } catch (e) { /* best effort */ }
      raiser = null;
    }
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) { /* best effort */ }
  };

  try {
    // Build the room in a staging folder, then move it so its directory is <rooms home>/<slug>.
    const built = buildRoom369({ tmpDir: path.join(root, 'stage'), slug: SLUG, variant: 'wide', migrate: true });
    const roomDir = path.join(roomsHome, SLUG);
    fs.renameSync(built.roomDir, roomDir);
    writeRegistry(roomsHome, [{ slug: SLUG, abs_path: roomDir }], SLUG);

    const folderName = o.folderName || DEFAULT_FOLDER;
    const folderDir = path.join(roomDir, folderName);
    fs.mkdirSync(folderDir, { recursive: true });
    fs.writeFileSync(
      path.join(folderDir, 'ROOM.md'),
      '---\npurpose: Build the funding case for the first pilot (sample)\n---\n\n# ' + folderName + '\n\nSynthetic folder for the render check. No real content.\n',
    );

    // The card is raised by another process: its own session id, its own server, bound to the room.
    raiser = await cliClient({ roomsHome, home, sessionId: 'live-check-raiser' });
    await raiser.bind(SLUG);
    const rendered = await raiser.call('gate_render', {
      header: 'Should we go with the grant route? (sample)',
      kind: 'general',
      select_mode: 'single',
      options: OPTIONS,
      approving: ['yes'],
    });
    if (!rendered || rendered.ok !== true || typeof rendered.gate_id !== 'string') {
      throw new Error('the live card could not be raised: ' + JSON.stringify(rendered).slice(0, 300));
    }

    // The nested Claude Code's own session: a binding file for a fresh id, so the room reads as bound.
    const sessionId = crypto.randomUUID();
    const wrote = writeSessionBinding(sessionId, { bound: [SLUG], primary: SLUG }, { home: roomsHome });
    if (!wrote || wrote.ok !== true) throw new Error('the session binding could not be written: ' + JSON.stringify(wrote));

    return { roomsHome, home, slug: SLUG, roomDir, folderName, folderDir, gateId: rendered.gate_id, sessionId, close };
  } catch (e) {
    await close();
    throw e;
  }
}

// Copy the room database files (main, write-ahead log, shared memory) so the read never touches the
// live ones, then read the copy through the repo's own read-only door.
function copyDb(roomDir, into) {
  const src = path.join(roomDir, '.mindrian');
  const dst = path.join(into, '.mindrian');
  fs.mkdirSync(dst, { recursive: true });
  for (const name of ['room.db', 'room.db-wal', 'room.db-shm']) {
    const from = path.join(src, name);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dst, name));
  }
}

function inspectLiveRoom(input) {
  const { roomsHome, slug, gateId } = input || {};
  const roomDir = path.join(roomsHome, slug);
  const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
  const projection = require(path.join(REPO, 'lib', 'core', 'navigation', 'room-projection.cjs'));
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-ws-inspect-'));
  let db = null;
  try {
    copyDb(roomDir, copy);
    db = navigation.openRoomDbReadOnlyForCaller(copy);
    if (!db) return { decisionNodes: [], gateAnswer: { found: false }, recordsHash: hashRecords([]), readable: false };

    const decisions = db.prepare("SELECT id, type, properties FROM nodes WHERE id LIKE 'decision:%' ORDER BY id").all();
    const gateEvents = db
      .prepare(
        "SELECT id, type, properties FROM nodes WHERE type = 'memory_event' AND json_valid(properties) " +
        "AND json_extract(properties, '$.dedupe_key') LIKE 'gate_%' ORDER BY id",
      )
      .all();
    const edges = db.prepare("SELECT source, target, type FROM edges WHERE source LIKE 'decision:%' ORDER BY source, target, type").all();
    const rows = []
      .concat(decisions.map((r) => ({ table: 'nodes', id: r.id, type: r.type, properties: r.properties })))
      .concat(gateEvents.map((r) => ({ table: 'nodes', id: r.id, type: r.type, properties: r.properties })))
      .concat(edges.map((r) => ({ table: 'edges', source: r.source, target: r.target, type: r.type })));

    const anchor = typeof gateId === 'string' ? projection.readGateAnswerAnchor(db, gateId) : { found: false };
    return {
      decisionNodes: decisions.map((r) => r.id),
      gateAnswer: {
        found: anchor.found === true,
        verdict: anchor.verdict || null,
        chosen: anchor.chosen || null,
        answeredVia: anchor.answered_via || null,
        decisionNodeId: anchor.decision_node_id || null,
        viaGateId: anchor.via_gate_id || null,
      },
      recordsHash: hashRecords(rows),
      readable: true,
    };
  } finally {
    if (db) { try { db.close(); } catch (e) { /* best effort */ } }
    try { fs.rmSync(copy, { recursive: true, force: true }); } catch (e) { /* best effort */ }
  }
}

module.exports = { buildLiveRoom, inspectLiveRoom };
