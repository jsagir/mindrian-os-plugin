'use strict';
// Phase 220-03 -- SENS-15 url-ingest sensor fixture suite (RED-first).
//
// REQ-2 pinned offline (220-03-PLAN.md Task 3): the contextual tripwire
// detects, dedups, offers -- and NEVER acts. Standalone node script, exit 0/1,
// temp room, zero network (the run-all-220 zero-network preload applies when
// run through the aggregator; nothing here fetches anyway).
//
// Assertion groups:
//   (1) FIRE: a turn whose text contains a bare https URL yields exactly one
//       reach from the url-ingest sensor with reach_id 'deep_research',
//       posture 'hold', dispatch 'url-ingest-offer', signal 'pasted_url'
//   (2) EVIDENCE HYGIENE: flat scalars only; first_url_host is a bare
//       hostname; first_url_handle matches ^[a-f0-9]{12}$; NO field carries
//       the full URL or any turn prose (Part 8, T-220-13)
//   (3) SUPPRESS - code block: the same URL inside a fenced block (or an
//       inline code span) yields null (D-05)
//   (4) SUPPRESS - quoted: a quoted URL (straight quotes or a markdown
//       blockquote line) yields null (D-05)
//   (5) SUPPRESS - dedup: the URL seeded in the Plan 02 ledger
//       (.mindrian/url-ingest-ledger.json, interfaces schema) yields null
//   (6) NO WRITE WITHOUT VERB: a full dispatchSensors pass over the URL turn
//       leaves the temp room byte-identical (file list + shas) and room.db
//       artifact/entity counts unchanged -- the sensor NEVER files, NEVER
//       touches the ledger, NEVER writes room.db (Part 3, Pitfall 3,
//       T-220-14); plus comment-filtered source greps: the sensor is a
//       read-only detector by construction (requires neither url-ingest.cjs
//       nor navigation nor insight-sensors; zero 'harvest' token)
//   (7) SOFT-FAIL: a corrupt ledger JSON yields null, not a throw
//   (8) DOC-PARITY GREPS (REQ-4 / D-07): commands/research.md carries every
//       research_mode enum value and typed outcome the pipeline actually
//       returns (read from lib/core/url-ingest.cjs source), the SENS id in
//       sensor_triggers, and zero retired unshipped-ordering claims
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const SENSOR_PATH = path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-url-ingest.cjs');
const { sensorUrlIngest, SENSOR_ID } = require(SENSOR_PATH);
const { dispatchSensors, SENSOR_REGISTRY_IDS } = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

const FIXTURE_URL = 'https://example.com/articles/quantum-report';
const FIXTURE_HOST = 'example.com';
// Neutral prose: no keyword-sensor trigger words, no apostrophes (the
// conservative quote-stripping discretion documented in the sensor header).
const FIXTURE_TURN_TEXT = 'take a look at ' + FIXTURE_URL + ' when you get a moment';

let pass = 0;
let total = 0;
const failures = [];
function check(label, fn) {
  total += 1;
  try {
    fn();
    pass += 1;
    console.log('  ok -', label);
  } catch (e) {
    failures.push(label + ': ' + (e && e.message));
    console.log('  FAIL -', label, '::', e && e.message);
  }
}

function freshRoom(tag) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-220-url-sensor-' + tag + '-'));
  const roomDir = path.join(tmp, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# Fixture Room 220-03\n\nURL sensor fixture.\n', 'utf8');
  // Create room.db (schema init) so the no-write group has real counts.
  const db = openRoomDb(roomDir);
  closeRoomDb(db);
  return roomDir;
}

function seedLedger(roomDir, url, entry) {
  const dir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'url-ingest-ledger.json'), JSON.stringify({
    schema_version: 1,
    entries: Object.assign({}, entry === undefined ? {
      [url]: {
        content_sha256: crypto.createHash('sha256').update('prior bytes').digest('hex'),
        artifact_node_id: 'artifact-prior-1',
        artifact_path: 'research/2026-07-12-example-com-prior/2026-07-12-example-com-prior.md',
        last_ingested_at: '2026-07-12T00:00:00.000Z',
        ingest_origin: 'on_demand',
      },
    } : entry),
  }, null, 2) + '\n', 'utf8');
}

function dbCounts(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    const artifacts = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_artifact'").get().n;
    const entities = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'entity'").get().n;
    const allNodes = db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n;
    const allEdges = db.prepare('SELECT COUNT(*) AS n FROM edges').get().n;
    return { artifacts, entities, allNodes, allEdges };
  } finally {
    closeRoomDb(db);
  }
}

// Recursive file snapshot: relative path -> sha256 of bytes.
function snapshotRoom(roomDir) {
  const out = {};
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      const st = fs.lstatSync(abs);
      if (st.isDirectory()) walk(abs);
      else if (st.isFile()) {
        out[path.relative(roomDir, abs)] = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
      }
    }
  };
  walk(roomDir);
  return out;
}

// Comment-filtered source read (the 218 grep-gate idiom): strip block and
// line comments so a comment mention never trips a structural gate.
function sourceSansComments(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// ---------- (1) FIRE ----------

check('G1a: sensor fires on a bare https URL with the exact reach contract', () => {
  const roomDir = freshRoom('fire');
  const reach = sensorUrlIngest({ text: FIXTURE_TURN_TEXT }, {}, { roomDir });
  assert.ok(reach && typeof reach === 'object', 'sensor fired');
  assert.equal(reach.reach_id, 'deep_research');
  assert.equal(reach.posture, 'hold');
  assert.equal(reach.dispatch, 'url-ingest-offer');
  assert.equal(reach.signal, 'pasted_url');
});

check('G1b: a full dispatchSensors pass yields exactly one url-ingest reach', () => {
  const roomDir = freshRoom('dispatch');
  const reaches = dispatchSensors({ text: FIXTURE_TURN_TEXT }, {}, { roomDir });
  const mine = reaches.filter((r) => r && r.signal === 'pasted_url');
  assert.equal(mine.length, 1, 'exactly one pasted_url reach (got ' + mine.length + ')');
  assert.equal(mine[0].dispatch, 'url-ingest-offer');
});

check('G1c: http (not just https) also fires; a URL-free turn does not', () => {
  const roomDir = freshRoom('http');
  const httpReach = sensorUrlIngest({ text: 'reference http://example.org/notes here' }, {}, { roomDir });
  assert.ok(httpReach, 'http URL fires');
  const noUrl = sensorUrlIngest({ text: 'no links in this turn at all' }, {}, { roomDir });
  assert.equal(noUrl, null, 'URL-free turn yields null');
});

// ---------- (2) EVIDENCE HYGIENE ----------

check('G2: evidence bag is flat scalars, host + 12-hex handle, never the URL or prose', () => {
  const roomDir = freshRoom('evidence');
  const reach = sensorUrlIngest({ text: FIXTURE_TURN_TEXT }, {}, { roomDir });
  assert.ok(reach, 'fired');
  const ev = reach.evidence;
  assert.ok(ev && typeof ev === 'object');
  const keys = Object.keys(ev).sort();
  assert.deepEqual(keys, ['first_url_handle', 'first_url_host', 'ledger_checked', 'url_count']);
  for (const k of keys) {
    const t = typeof ev[k];
    assert.ok(t === 'string' || t === 'number' || t === 'boolean', k + ' is a flat scalar');
  }
  assert.equal(ev.url_count, 1);
  assert.equal(ev.first_url_host, FIXTURE_HOST, 'bare hostname only');
  assert.match(ev.first_url_handle, /^[a-f0-9]{12}$/);
  assert.equal(ev.ledger_checked, true);
  for (const k of keys) {
    const v = String(ev[k]);
    assert.ok(v.indexOf(FIXTURE_URL) === -1, k + ' never carries the full URL');
    assert.ok(v.indexOf('/articles/') === -1, k + ' never carries the URL path');
    assert.ok(v.indexOf('take a look') === -1, k + ' never carries turn prose');
  }
});

// ---------- (3) SUPPRESS: code ----------

check('G3a: the same URL inside a fenced code block yields null', () => {
  const roomDir = freshRoom('fence');
  const text = 'config sample below\n```\ncurl ' + FIXTURE_URL + '\n```\nend of sample';
  assert.equal(sensorUrlIngest({ text }, {}, { roomDir }), null);
});

check('G3b: the same URL inside an inline code span yields null', () => {
  const roomDir = freshRoom('span');
  const text = 'the endpoint is `' + FIXTURE_URL + '` in the config';
  assert.equal(sensorUrlIngest({ text }, {}, { roomDir }), null);
});

// ---------- (4) SUPPRESS: quoted ----------

check('G4a: a straight-quoted URL yields null', () => {
  const roomDir = freshRoom('quote');
  const text = 'the doc says "' + FIXTURE_URL + '" verbatim';
  assert.equal(sensorUrlIngest({ text }, {}, { roomDir }), null);
});

check('G4b: a markdown-blockquote URL yields null', () => {
  const roomDir = freshRoom('mdquote');
  const text = 'quoting the source:\n> see ' + FIXTURE_URL + ' for details\nend quote';
  assert.equal(sensorUrlIngest({ text }, {}, { roomDir }), null);
});

// ---------- (5) SUPPRESS: ledger dedup ----------

check('G5: an already-ingested URL (ledger entry present) yields null', () => {
  const roomDir = freshRoom('dedup');
  seedLedger(roomDir, FIXTURE_URL);
  assert.equal(sensorUrlIngest({ text: FIXTURE_TURN_TEXT }, {}, { roomDir }), null);
  // A DIFFERENT url in the same room still fires (dedup is per-URL).
  const other = sensorUrlIngest({ text: 'also https://example.net/other-page here' }, {}, { roomDir });
  assert.ok(other, 'a non-ledgered URL still fires');
});

// ---------- (6) NO WRITE WITHOUT VERB ----------

check('G6a: a full dispatchSensors pass leaves the room byte-identical', () => {
  const roomDir = freshRoom('nowrite');
  const countsBefore = dbCounts(roomDir);
  const before = snapshotRoom(roomDir);
  const reaches = dispatchSensors({ text: FIXTURE_TURN_TEXT }, {}, { roomDir });
  assert.ok(reaches.some((r) => r && r.signal === 'pasted_url'), 'the sensor fired during the pass');
  const after = snapshotRoom(roomDir);
  assert.deepEqual(after, before, 'file list + bytes identical: the sensor never files, never touches the ledger');
  assert.equal(fs.existsSync(path.join(roomDir, '.mindrian', 'url-ingest-ledger.json')), false,
    'the sensor never CREATES the ledger');
  const countsAfter = dbCounts(roomDir);
  assert.deepEqual(countsAfter, countsBefore, 'room.db artifact/entity/node/edge counts unchanged');
});

check('G6b: read-only detector by construction (comment-filtered require greps)', () => {
  const src = sourceSansComments(SENSOR_PATH);
  assert.ok(!/require\([^)]*url-ingest\.cjs/.test(src), 'never requires url-ingest.cjs');
  assert.ok(!/require\([^)]*navigation/.test(src), 'never requires navigation');
  assert.ok(!/require\([^)]*insight-sensors/.test(src), 'never requires insight-sensors (circular)');
  assert.ok(!/require\([^)]*research-corpus/.test(src), 'never requires the fetch surface');
  const requires = src.match(/require\(['"][^'"]+['"]\)/g) || [];
  for (const r of requires) {
    assert.ok(
      r.indexOf('node:') !== -1 || r.indexOf('./sensor-types.cjs') !== -1,
      'only node built-ins + ./sensor-types.cjs allowed: ' + r
    );
  }
  assert.ok(!/harvest/i.test(src), 'zero harvest token (219 owns it)');
  assert.ok(!/writeFileSync|appendFileSync|mkdirSync|renameSync|unlinkSync/.test(src),
    'zero write primitives: read-only detector');
});

check('G6c: registration diff is the three touch points only (dispatch loop untouched)', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'), 'utf8');
  assert.ok(src.indexOf("require('./sensors/sensor-url-ingest.cjs')") !== -1, 'require touch point');
  assert.match(src, /SENSOR_REGISTRY = \[[\s\S]*sensorUrlIngest,[\s\S]*?\];/, 'registry touch point');
  assert.match(src, /module\.exports = \{[\s\S]*sensorUrlIngest[\s\S]*\};/, 'export touch point');
  // Registration is an APPEND into SENSOR_REGISTRY, and the identity array
  // agrees with it at the same index.
  //
  // Phase 245-06 repair. This used to assert `rows[rows.length - 1] ===
  // 'sensorUrlIngest,'` ("registered LAST"), which was true only while SENS-15
  // happened to be the newest sensor. Phase 244 appended SENS-16 and this
  // assertion went red; Phase 245-06 appended SENS-17 and it stayed red for a
  // second reason. "Last" was never the property worth pinning: the property
  // this check exists for is that SENS-15 was registered THROUGH the registry
  // array (rather than by editing the dispatch loop), and that the parallel
  // identity array names it at the same index. Both of those are permanent, so
  // the assertion below is strictly STRONGER than the positional one it
  // replaces, not weaker: it additionally pins the SENSOR_REGISTRY /
  // SENSOR_REGISTRY_IDS index-parallel invariant for this sensor.
  const registryBlock = src.match(/SENSOR_REGISTRY = \[([\s\S]*?)\];/)[1];
  const rows = registryBlock.split('\n').map((l) => l.trim()).filter((l) => /^sensor\w+,$/.test(l));
  const rowIdx = rows.indexOf('sensorUrlIngest,');
  assert.ok(rowIdx !== -1, 'registered as a SENSOR_REGISTRY row');
  assert.equal(rows.length, SENSOR_REGISTRY_IDS.length, 'registry rows and identity array stay index-parallel');
  assert.equal(SENSOR_REGISTRY_IDS[rowIdx], SENSOR_ID, 'identity array names SENS-15 at the same index');
});

// ---------- (7) SOFT-FAIL ----------

check('G7a: a corrupt ledger JSON yields null, not a throw (fail closed)', () => {
  const roomDir = freshRoom('corrupt');
  const dir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'url-ingest-ledger.json'), '{ this is not json', 'utf8');
  assert.equal(sensorUrlIngest({ text: FIXTURE_TURN_TEXT }, {}, { roomDir }), null);
});

check('G7b: malformed inputs soft-fail to null, never throw', () => {
  assert.equal(sensorUrlIngest(null, null, null), null);
  assert.equal(sensorUrlIngest({}, {}, {}), null, 'no roomDir -> null');
  assert.equal(sensorUrlIngest({ text: 42 }, {}, { roomDir: '/nonexistent' }), null);
  assert.equal(sensorUrlIngest({ text: 'ftp://example.com/file' }, {}, { roomDir: os.tmpdir() }), null,
    'non-http(s) scheme never fires');
});

check('G7c: SENSOR_ID is the build-time-verified free id', () => {
  assert.equal(SENSOR_ID, 'SENS-15');
});

// ---------- (8) DOC-PARITY GREPS (REQ-4 / D-07) ----------

const RESEARCH_DOC_PATH = path.join(REPO_ROOT, 'commands', 'research.md');
const URL_INGEST_SRC_PATH = path.join(REPO_ROOT, 'lib', 'core', 'url-ingest.cjs');

check('G8a: research.md documents every research_mode enum value the pipeline returns', () => {
  const src = fs.readFileSync(URL_INGEST_SRC_PATH, 'utf8');
  const doc = fs.readFileSync(RESEARCH_DOC_PATH, 'utf8');
  // The closed D-19 vocabulary: every member present in the pipeline source
  // must be present in the doc (read from source, never hardcoded-only).
  const MODE_VOCAB = ['normal', 'web_degraded_local_fallback', 'local_only', 'insufficient_evidence'];
  const inSource = MODE_VOCAB.filter((m) => src.indexOf(m) !== -1);
  assert.ok(inSource.indexOf('web_degraded_local_fallback') !== -1, 'source sanity: degrade mode present');
  assert.ok(inSource.indexOf('insufficient_evidence') !== -1, 'source sanity: cold mode present');
  for (const mode of inSource) {
    assert.ok(doc.indexOf(mode) !== -1, 'doc names research_mode value: ' + mode);
  }
});

check('G8b: research.md documents every typed outcome the pipeline returns', () => {
  const src = fs.readFileSync(URL_INGEST_SRC_PATH, 'utf8');
  const doc = fs.readFileSync(RESEARCH_DOC_PATH, 'utf8');
  const OUTCOME_VOCAB = ['filed', 'no_op', 'superseded', 'provider_unavailable', 'size_exceeded', 'blocked', 'error'];
  const inSource = OUTCOME_VOCAB.filter((o) => new RegExp("'" + o + "'").test(src));
  assert.ok(inSource.length >= 7, 'source sanity: all 7 typed outcomes present (got ' + inSource.length + ')');
  for (const outcome of inSource) {
    assert.ok(doc.indexOf(outcome) !== -1, 'doc names outcome: ' + outcome);
  }
});

check('G8c: the retired unshipped-ordering claim never regresses (219-05 fixed drift)', () => {
  const doc = fs.readFileSync(RESEARCH_DOC_PATH, 'utf8');
  assert.ok(doc.indexOf('paid -> native') === -1, 'zero "paid -> native" ordering claims');
  assert.ok(doc.indexOf('paid->native') === -1, 'zero "paid->native" ordering claims');
});

check('G8d: the URL mode + ladder + SENS wiring are documented (must_haves greps)', () => {
  const doc = fs.readFileSync(RESEARCH_DOC_PATH, 'utf8');
  assert.ok((doc.match(/url-ingest/g) || []).length >= 2, 'url-ingest named >= 2 times');
  assert.ok(doc.indexOf('llm_manual_baseline') !== -1, 'the D-10 manual rung label present');
  const manualRung = doc.slice(doc.indexOf('Rung 3'), doc.indexOf('Rung 3') + 1200);
  assert.match(manualRung, /never auto-selected/i, 'never-default language present');
  assert.match(manualRung, /never silent/i, 'never-silent language present');
  assert.ok(doc.indexOf('sensor_triggers: [SENS-04, SENS-15]') !== -1, 'SENS-15 in sensor_triggers');
  assert.ok(doc.indexOf('ingestUrl') !== -1, 'the command shells ingestUrl');
  assert.ok(doc.indexOf('[Ingest]') !== -1 && doc.indexOf('[Ingest+Explore]') !== -1 && doc.indexOf('[Skip]') !== -1,
    'the three F.1 verbs documented');
  assert.ok(doc.indexOf('—') === -1, 'zero em-dash characters in research.md');
  const sensorSrc = fs.readFileSync(SENSOR_PATH, 'utf8');
  assert.ok(sensorSrc.indexOf('—') === -1, 'zero em-dash characters in the sensor');
});

check('G8e: skills/research/SKILL.md is a regenerated mirror carrying the URL mode', () => {
  const mirror = fs.readFileSync(path.join(REPO_ROOT, 'skills', 'research', 'SKILL.md'), 'utf8');
  assert.ok(mirror.indexOf('URL mode') !== -1, 'mirror carries the URL mode section');
  assert.ok(mirror.indexOf('llm_manual_baseline') !== -1, 'mirror carries the manual rung');
});

// ---------- summary ----------

console.log('');
console.log('test-220-url-sensor: ' + pass + '/' + total + ' passed');
if (failures.length > 0) {
  console.log('FAILURES:');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
process.exit(0);
