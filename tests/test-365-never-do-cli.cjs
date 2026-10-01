'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 365 Plan 14 -- the Claude Code door for never-do entries (D-10, D-15).
 * scripts/research-planner.cjs gains `never-do add` (approval-gated, mints its own
 * decision node the way the grant approval does) and `never-do list` (the entries
 * plus the floor sentence). Legs L1..L6 spawn the script on scratch rooms; the
 * decision node is read back through a fresh room.db handle.
 *
 * No em-dash or en-dash literals: those characters are spelled with
 * String.fromCharCode. Exit 0 pass, 1 fail, 77 skip (fixtures absent).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos365-14-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos365-14-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(__dirname, 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;
const { check, summary } = hygiene.makeChecker('365-14 never-do CLI door');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let buildRoom363 = null;
try {
  buildRoom363 = require(path.join(__dirname, 'helpers', 'fixture-room-363.cjs')).buildRoom363;
} catch (_e) {
  console.log('SKIP: 363-02 helpers absent');
  process.exit(77);
}

const rc = require(path.join(ROOT, 'lib', 'core', 'room-constraints.cjs'));
const CLI_PATH = path.join(ROOT, 'scripts', 'research-planner.cjs');
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'mos365-14-scratch-'));
let scratchN = 0;

function writeScratch(obj) {
  scratchN += 1;
  const p = path.join(SCRATCH, 'entry-' + scratchN + '.json');
  fs.writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return p;
}

function cli(args) {
  const env = Object.assign({}, process.env);
  delete env.OPENALEX_API_KEY;
  delete env.OPENALEX_EMAIL;
  delete env.TYPESAFE_API_KEY;
  const res = spawnSync(process.execPath, [CLI_PATH].concat(args), { encoding: 'utf8', env: env, timeout: 90000 });
  let json = null;
  try { json = JSON.parse(String(res.stdout || '').trim()); } catch (_e) { json = null; }
  return { code: res.status, stdout: String(res.stdout || ''), stderr: String(res.stderr || ''), json: json };
}

function withDb(room, fn) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(room.roomDir, '.mindrian', 'room.db'));
  try { return fn(db); } finally { db.close(); }
}
function decisionCount(room) {
  return withDb(room, function (db) {
    return db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE id LIKE '%never-do-%'").get().n;
  });
}
function nodeRow(room, id) {
  return withDb(room, function (db) {
    const r = db.prepare('SELECT id, type, properties FROM nodes WHERE id = ?').get(id);
    if (!r) return null;
    let props = {};
    try { props = JSON.parse(r.properties || '{}'); } catch (_e) { props = {}; }
    return { id: r.id, node_type: r.type, text: props.text || '' };
  });
}
function neverDoFile(room) { return path.join(room.roomDir, '.mindrian', 'never-do.json'); }
function neverDoBytes(room) { try { return fs.readFileSync(neverDoFile(room), 'utf8'); } catch (_e) { return null; } }
function hasDash(text) { return text.indexOf(EM) !== -1 || text.indexOf(EN) !== -1; }

const GOOD = { kind: 'term', value: 'solid state battery', why: 'Never let an unattended step search for solid state battery.' };

function main() {
  const rooms = [];
  function newRoom() { const r = buildRoom363({ role: 'researcher' }); rooms.push(r); return r; }

  // ---- L1 add with --approved-via cli lands the entry and the decision node ----
  {
    const room = newRoom();
    const before = decisionCount(room);
    const res = cli(['never-do', 'add', writeScratch(GOOD), '--room', room.roomDir, '--approved-via', 'cli']);
    check('L1a exit 0 and ok:true', res.code === 0 && res.json && res.json.ok === true, res.stdout.slice(0, 200) + res.stderr.slice(0, 200));
    const nodeId = res.json && res.json.decision_node_id;
    check('L1b a decision node id came back', typeof nodeId === 'string' && nodeId.indexOf('never-do-') !== -1, String(nodeId));
    const file = JSON.parse(neverDoBytes(room) || '{}');
    const e = (file.entries || [])[0] || {};
    check('L1c never-do.json holds one entry with approved_via {surface:cli, decision_node_id}',
      (file.entries || []).length === 1 && e.kind === 'term' && e.value === GOOD.value &&
      e.approved_via && e.approved_via.surface === 'cli' && e.approved_via.decision_node_id === nodeId, JSON.stringify(e));
    check('L1d the entry is echoed in the output', res.json && res.json.entry && res.json.entry.value === GOOD.value);
    const row = nodeRow(room, nodeId);
    check('L1e the decision node is in room.db on a fresh handle', !!row && row.node_type === 'decision', JSON.stringify(row));
    check('L1f the node text names the entry and the surface', !!row && /never-do entry term solid state battery via cli/.test(row.text || ''), row && row.text);
    check('L1g exactly one new decision node', decisionCount(room) === before + 1, String(decisionCount(room) - before));
    // the entry extras (alternatives) are ignored, not stored
    const room2 = newRoom();
    const withExtras = Object.assign({ alternatives: [{ kind: 'section', value: 'market-analysis' }], approved_via: { surface: 'mcp', decision_node_id: 'x' } }, GOOD);
    const r2 = cli(['never-do', 'add', writeScratch(withExtras), '--room', room2.roomDir, '--approved-via', 'cli']);
    const e2 = ((JSON.parse(neverDoBytes(room2) || '{}')).entries || [])[0] || {};
    check('L1h a caller-supplied approved_via in the input is not trusted', r2.code === 0 && e2.approved_via && e2.approved_via.surface === 'cli' && e2.approved_via.decision_node_id === r2.json.decision_node_id, JSON.stringify(e2.approved_via));
    check('L1i no alternatives field stored', e2.alternatives === undefined);
  }

  // ---- L2 without the flag, or with another value: refused, nothing written ----
  {
    const room = newRoom();
    const before = decisionCount(room);
    const none = cli(['never-do', 'add', writeScratch(GOOD), '--room', room.roomDir]);
    check('L2a no --approved-via -> exit 2 approval_required', none.code === 2 && none.json && none.json.ok === false && none.json.reason === 'approval_required', none.stdout.slice(0, 200));
    const other = cli(['never-do', 'add', writeScratch(GOOD), '--room', room.roomDir, '--approved-via', 'mcp']);
    check('L2b another --approved-via value -> exit 2 refused', other.code === 2 && other.json && other.json.ok === false, other.stdout.slice(0, 200));
    check('L2c nothing written: no file, no node', neverDoBytes(room) === null && decisionCount(room) === before);
    check('L2d the refusal never echoes the refused token', other.stdout.indexOf('mcp') === -1);
  }

  // ---- L3 invalid entries and a malformed existing file -------------------------
  {
    const room = newRoom();
    const bad = [
      ['invalid_kind', { kind: 'other', value: 'x', why: 'because' }],
      ['invalid_path', { kind: 'path', value: '../escape', why: 'because' }],
      ['invalid_why', { kind: 'term', value: 'x', why: '   ' }],
    ];
    bad.forEach(function (b) {
      const res = cli(['never-do', 'add', writeScratch(b[1]), '--room', room.roomDir, '--approved-via', 'cli']);
      check('L3 ' + b[0] + ' -> exit 2 with the writer reason', res.code === 2 && res.json && res.json.ok === false && res.json.reason === b[0], res.stdout.slice(0, 200));
    });
    check('L3 nothing was written for invalid entries', neverDoBytes(room) === null);

    const room2 = newRoom();
    fs.mkdirSync(path.dirname(neverDoFile(room2)), { recursive: true });
    const junk = '{ this is not json';
    fs.writeFileSync(neverDoFile(room2), junk);
    const res = cli(['never-do', 'add', writeScratch(GOOD), '--room', room2.roomDir, '--approved-via', 'cli']);
    check('L3 malformed existing file -> exit 2 existing_file_malformed', res.code === 2 && res.json && res.json.reason === 'existing_file_malformed', res.stdout.slice(0, 200));
    check('L3 the malformed file bytes are unchanged', neverDoBytes(room2) === junk);
    check('L3 the decision is reported as recorded but not written', res.json && res.json.decision_recorded_but_not_written === true && typeof res.json.decision_node_id === 'string');
    check('L3 the recorded decision node exists', !!(res.json && nodeRow(room2, res.json.decision_node_id)));

    const badInput = cli(['never-do', 'add', writeScratch('not json at all'), '--room', room.roomDir, '--approved-via', 'cli']);
    check('L3 unreadable input json -> exit 2 bad_json', badInput.code === 2 && badInput.json && badInput.json.reason === 'bad_json');
    const arr = cli(['never-do', 'add', writeScratch('[1,2]'), '--room', room.roomDir, '--approved-via', 'cli']);
    check('L3 an array input -> exit 2 bad_json', arr.code === 2 && arr.json && arr.json.reason === 'bad_json');
  }

  // ---- L4 the same entry twice -------------------------------------------------
  {
    const room = newRoom();
    const a = cli(['never-do', 'add', writeScratch(GOOD), '--room', room.roomDir, '--approved-via', 'cli']);
    const b = cli(['never-do', 'add', writeScratch(GOOD), '--room', room.roomDir, '--approved-via', 'cli']);
    const file = JSON.parse(neverDoBytes(room) || '{}');
    check('L4a first add lands', a.code === 0 && a.json.ok === true && a.json.duplicate !== true);
    check('L4b second add reports duplicate:true', b.code === 0 && b.json && b.json.ok === true && b.json.duplicate === true, b.stdout.slice(0, 200));
    check('L4c still one entry', (file.entries || []).length === 1);
  }

  // ---- L5 list ------------------------------------------------------------------
  {
    const room = newRoom();
    const empty = cli(['never-do', 'list', '--room', room.roomDir]);
    check('L5a empty list: exit 0, count 0, the floor sentence', empty.code === 0 && empty.json && empty.json.ok === true && empty.json.count === 0 && empty.json.note === rc.FLOOR_SENTENCE, empty.stdout.slice(0, 200));
    cli(['never-do', 'add', writeScratch(GOOD), '--room', room.roomDir, '--approved-via', 'cli']);
    const full = cli(['never-do', 'list', '--room', room.roomDir]);
    check('L5b one entry listed as {kind, value, why} only', full.code === 0 && full.json.count === 1 &&
      JSON.stringify(Object.keys(full.json.entries[0]).sort()) === JSON.stringify(['kind', 'value', 'why']) && full.json.entries[0].value === GOOD.value, full.stdout.slice(0, 300));
    check('L5c the note says it catches only what has been named', /catches only what has been named/.test(full.json.note));

    const room2 = newRoom();
    fs.mkdirSync(path.dirname(neverDoFile(room2)), { recursive: true });
    fs.writeFileSync(neverDoFile(room2), '{ nope');
    const mal = cli(['never-do', 'list', '--room', room2.roomDir]);
    check('L5d malformed list -> exit 2 reason malformed with the fix', mal.code === 2 && mal.json && mal.json.ok === false && mal.json.reason === 'malformed' &&
      mal.json.fix === '.mindrian/never-do.json could not be read; fix or remove it. Until then every unattended step in this room stops.', mal.stdout.slice(0, 300));
    const wrong = newRoom();
    fs.mkdirSync(path.dirname(neverDoFile(wrong)), { recursive: true });
    fs.writeFileSync(neverDoFile(wrong), JSON.stringify({ schema: 'other/1', entries: [] }));
    const wr = cli(['never-do', 'list', '--room', wrong.roomDir]);
    check('L5e a wrong-schema file is reported unreadable too', wr.code === 2 && wr.json && wr.json.reason === 'malformed');
  }

  // ---- L6 dashes and argv hygiene -------------------------------------------------
  {
    const room = newRoom();
    const outs = [
      cli(['never-do', 'add', writeScratch(GOOD), '--room', room.roomDir, '--approved-via', 'cli']),
      cli(['never-do', 'add', writeScratch(GOOD), '--room', room.roomDir]),
      cli(['never-do', 'list', '--room', room.roomDir]),
      cli(['never-do', 'bogus', '--room', room.roomDir]),
    ];
    check('L6a no em-dash or en-dash in any output', outs.every(function (o) { return !hasDash(o.stdout) && !hasDash(o.stderr); }));
    check('L6b an unknown never-do subcommand is refused', outs[3].code === 2 && outs[3].json && outs[3].json.ok === false);
    const src = fs.readFileSync(CLI_PATH, 'utf8') + fs.readFileSync(__filename, 'utf8');
    check('L6c the script and this test carry no em-dash or en-dash', !hasDash(src));
    const free = cli(['never-do', 'add', 'solid state battery', '--room', room.roomDir, '--approved-via', 'cli']);
    check('L6d free text on argv is refused (the entry rides a json file)', free.code === 2 && free.json && free.json.reason === 'free_text_argv_refused');
  }

  rooms.forEach(function (r) { try { if (r.cleanup) r.cleanup(); } catch (_e) { /* ignore */ } });
  try { fs.rmSync(SCRATCH, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
}

main();
process.exit(summary());
