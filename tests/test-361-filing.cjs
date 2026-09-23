'use strict';
// Phase 361-06 Task 2 -- file-pack: lane artifacts, EvidenceClaim filing with
// readback, 4-zone report.
//
// Test hygiene (identical to sibling test-361-* files, 361-01 context):
// plain node assert, no deps; this process's own fetch is replaced with a
// thrower; every spawned child gets NODE_OPTIONS pointing at the same
// fetch-thrower preload written into a mkdtemp dir; every fixture room and
// pack dir lives under a mkdtemp root, never a real ~/MindrianRooms room.
// Exit 0 PASS, 1 FAIL, 77 ENV GAP.
//
// Room.db seeding uses lib/core/room-db.cjs openRoomDb/closeRoomDb directly
// (the test-129.5-confirm-node.cjs precedent: tests, not the script itself,
// may open the substrate door). The script under test never requires
// room-db.cjs (Part 9: navigation.openRoomDbForCaller/closeRoomDbForCaller
// is the only door it uses).
//
// No em-dashes anywhere in this file (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

globalThis.fetch = function () {
  try { process.stderr.write('NETWORK_ATTEMPT_361\n'); } catch (_e) { /* ignore */ }
  throw new Error('network attempted in test-361-filing.cjs');
};

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'dominant-design-research.cjs');

const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { validateLaneResult } = require(path.join(REPO_ROOT, 'lib', 'core', 'dominant-design', 'evidence-pack.cjs'));

let failures = 0;
function check(cond, label) {
  if (cond) {
    console.log('PASS: ' + label);
  } else {
    failures += 1;
    console.log('FAIL: ' + label);
  }
}

const SUITE_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-361-filing-'));

const PRELOAD = path.join(SUITE_TMP, 'fetch-thrower-preload.cjs');
fs.writeFileSync(PRELOAD, [
  "'use strict';",
  'globalThis.fetch = function () {',
  "  try { process.stderr.write('NETWORK_ATTEMPT_361\\n'); } catch (_e) { /* ignore */ }",
  "  throw new Error('network attempted (361 fetch-thrower, child)');",
  '};',
  '',
].join('\n'), 'utf8');

function run(args) {
  const env = Object.assign({}, process.env, { NODE_OPTIONS: '--require ' + PRELOAD });
  return spawnSync(process.execPath, [SCRIPT].concat(args), {
    cwd: REPO_ROOT,
    env: env,
    encoding: 'utf8',
  });
}

function parseJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch (_e) {
    return null;
  }
}

function listAllFiles(root) {
  const out = [];
  (function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      return;
    }
    entries.forEach(function (ent) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(p);
      } else {
        out.push(p);
      }
    });
  }(root));
  return out.sort();
}

function makeRoomWithDb() {
  const tmp = fs.mkdtempSync(path.join(SUITE_TMP, 'room-'));
  const db = openRoomDb(tmp);
  closeRoomDb(db);
  return tmp;
}

function makeRoomWithoutDb() {
  return fs.mkdtempSync(path.join(SUITE_TMP, 'room-nodb-'));
}

function makePackDir() {
  return fs.mkdtempSync(path.join(SUITE_TMP, 'pack-'));
}

function writeValidJson(packDir, laneId, validEnvelope) {
  fs.writeFileSync(path.join(packDir, laneId + '.valid.json'), JSON.stringify(validEnvelope, null, 2), 'utf8');
}

// A standard variant_census pack: 3 rows over 2 URLs, one Academic and one
// Practitioner row sharing a URL (page-1), one more row (Operational) on a
// second unique URL (page-2).
function buildVariantCensusValid() {
  const approvedQueries = ['solar cells competing designs history first introduced'];
  const raw = {
    lane: 'variant_census',
    queries: approvedQueries,
    claims: [
      {
        claim: 'PERC dominates crystalline-silicon module shipments as of 2024.',
        source_url: 'https://example.org/page-1',
        source_title: 'Solar Cell Landscape Report',
        retrieved_at: '2026-01-01',
        quote_or_locator: 'p. 4',
        source_type: 'peer_reviewed',
      },
      {
        claim: 'A blog post also names PERC as the shipping majority.',
        source_url: 'https://example.org/page-1',
        source_title: 'Solar Cell Landscape Report',
        retrieved_at: '2026-01-02',
        quote_or_locator: 'p. 5',
        source_type: 'blog',
      },
      {
        claim: 'TOPCon is the fastest-growing alternative variant.',
        source_url: 'https://example.org/page-2',
        source_title: 'Company Primary Filing',
        retrieved_at: '2026-01-03',
        quote_or_locator: 'section 2',
        source_type: 'company_primary',
      },
    ],
  };
  return validateLaneResult(raw, { approvedQueries: approvedQueries });
}

// An empty s_curve_limits pack: search ran, nothing sourced came back.
function buildSCurveLimitsValid() {
  const approvedQueries = ['solar cell performance limits diminishing returns cost ceiling'];
  const raw = { lane: 's_curve_limits', queries: approvedQueries, claims: [] };
  return validateLaneResult(raw, { approvedQueries: approvedQueries });
}

// ---------------------------------------------------------------------------
// Leg 1: happy path -- artifacts written, EvidenceClaim nodes filed with
// readback, JSON result shape.
// ---------------------------------------------------------------------------

(function testHappyPathFilePack() {
  const roomDir = makeRoomWithDb();
  const packDir = makePackDir();
  writeValidJson(packDir, 'variant_census', buildVariantCensusValid());
  writeValidJson(packDir, 's_curve_limits', buildSCurveLimitsValid());

  const before = listAllFiles(roomDir);

  const res = run(['file-pack', '--pack', packDir, '--room', roomDir, '--domain-slug', 'solar-cells', '--date', '2026-09-23', '--json']);
  check(res.status === 0, 'file-pack happy path exits 0');
  const out = parseJson(res.stdout);
  check(!!out, 'file-pack happy path: stdout is valid JSON');
  check(!!out && out.ok === true && out.room_db === true, 'file-pack happy path: {ok:true, room_db:true}');

  const variantArtifact = path.join(roomDir, 'competitive-analysis', 'dominant-designs', 'solar-cells-2026-09-23-evidence-variant_census.md');
  const sCurveArtifact = path.join(roomDir, 'competitive-analysis', 'dominant-designs', 'solar-cells-2026-09-23-evidence-s_curve_limits.md');
  check(fs.existsSync(variantArtifact), 'file-pack happy path: variant_census artifact exists');
  check(fs.existsSync(sCurveArtifact), 'file-pack happy path: s_curve_limits (empty lane) artifact exists');

  const sCurveText = fs.readFileSync(sCurveArtifact, 'utf8');
  check(sCurveText.indexOf('## Searched, not found') !== -1, 'empty lane artifact: contains "## Searched, not found"');
  check(sCurveText.indexOf('No sourced evidence found for this lane.') !== -1, 'empty lane artifact: contains the honest empty-lane line');

  const variantLane = out.lanes.find(function (l) { return l.lane === 'variant_census'; });
  const sCurveLane = out.lanes.find(function (l) { return l.lane === 's_curve_limits'; });
  check(!!variantLane, 'file-pack happy path: variant_census lane present in result');
  check(!!sCurveLane, 'file-pack happy path: s_curve_limits lane present in result');
  check(!!variantLane && variantLane.rows === 3, 'variant_census lane result: rows 3');
  check(!!variantLane && variantLane.filed === 2, 'variant_census lane result: filed 2 (one per unique URL)');
  check(!!variantLane && variantLane.landed === 2, 'variant_census lane result: landed 2');
  check(!!variantLane && Array.isArray(variantLane.not_landed) && variantLane.not_landed.length === 0, 'variant_census lane result: not_landed empty');
  check(!!variantLane && typeof variantLane.artifact_path === 'string' && variantLane.artifact_path.indexOf('competitive-analysis/dominant-designs/') === 0, 'variant_census lane result: artifact_path is room-relative');
  check(!!sCurveLane && sCurveLane.rows === 0 && sCurveLane.filed === 0, 'empty lane result: rows 0, filed 0');
  const requiredKeys = ['lane', 'artifact_path', 'rows', 'filed', 'landed', 'not_landed', 'message'];
  const hasAllKeys = requiredKeys.every(function (k) { return Object.prototype.hasOwnProperty.call(variantLane, k); });
  check(hasAllKeys, 'per-lane result reports {lane, artifact_path, rows, filed, landed, not_landed, message}');

  // Room.db holds exactly 2 EvidenceClaim nodes for variant_census.
  const db = openRoomDb(roomDir);
  try {
    const rows = db.prepare("SELECT id, review_status, properties FROM nodes WHERE type = 'EvidenceClaim'").all();
    const variantRows = rows.filter(function (r) { return r.id.indexOf(':dd-variant_census:') !== -1; });
    check(variantRows.length === 2, 'room.db holds exactly 2 EvidenceClaim nodes for variant_census');
    check(variantRows.every(function (r) { return r.review_status === 'proposed'; }), 'every filed EvidenceClaim node lands review_status proposed');

    const props = variantRows.map(function (r) { return JSON.parse(r.properties); });
    const page1Node = props.find(function (p) { return p.url === 'https://example.org/page-1'; });
    check(!!page1Node, 'the grouped page-1 node (Academic + Practitioner rows) exists');
    check(!!page1Node && page1Node.evidence_tier === 'Academic', "the grouped node's tier is Academic (highest of the group)");
    check(!!page1Node && page1Node.artifact_path === variantLane.artifact_path, 'the filed node artifact_path matches the room-relative lane artifact path');

    const sCurveRows = rows.filter(function (r) { return r.id.indexOf(':dd-s_curve_limits:') !== -1; });
    check(sCurveRows.length === 0, 'the empty lane files 0 EvidenceClaim nodes');
  } finally {
    closeRoomDb(db);
  }

  const after = listAllFiles(roomDir);
  const newFiles = after.filter(function (f) { return before.indexOf(f) === -1; });
  const outsidePackDir = newFiles.filter(function (f) {
    return f.indexOf(path.join(roomDir, 'competitive-analysis', 'dominant-designs')) !== 0
      && f.indexOf(path.join(roomDir, '.mindrian')) !== 0;
  });
  check(outsidePackDir.length === 0, 'nothing is written outside competitive-analysis/dominant-designs or .mindrian');
})();

// ---------------------------------------------------------------------------
// Leg 2: UPSERT idempotency -- filing the same pack twice with the same
// session does not duplicate nodes and still reports landed.
// ---------------------------------------------------------------------------

(function testIdempotentRefiling() {
  const roomDir = makeRoomWithDb();
  const packDir = makePackDir();
  writeValidJson(packDir, 'variant_census', buildVariantCensusValid());

  const args = ['file-pack', '--pack', packDir, '--room', roomDir, '--domain-slug', 'solar-cells', '--date', '2026-09-23', '--json'];
  const res1 = run(args);
  const res2 = run(args);
  check(res1.status === 0 && res2.status === 0, 'idempotent refiling: both runs exit 0');
  const out2 = parseJson(res2.stdout);
  const lane2 = out2 && out2.lanes.find(function (l) { return l.lane === 'variant_census'; });
  check(!!lane2 && lane2.landed === 2 && lane2.not_landed.length === 0, 'idempotent refiling: second run still reports landed');

  const db = openRoomDb(roomDir);
  try {
    const rows = db.prepare("SELECT id FROM nodes WHERE type = 'EvidenceClaim'").all();
    const variantRows = rows.filter(function (r) { return r.id.indexOf(':dd-variant_census:') !== -1; });
    check(variantRows.length === 2, 'idempotent refiling: still exactly 2 EvidenceClaim nodes (UPSERT, no duplicates)');
  } finally {
    closeRoomDb(db);
  }
})();

// ---------------------------------------------------------------------------
// Leg 3: absent room.db -- artifacts still written, filing said plainly.
// ---------------------------------------------------------------------------

(function testNoRoomDb() {
  const roomDir = makeRoomWithoutDb();
  const packDir = makePackDir();
  writeValidJson(packDir, 'variant_census', buildVariantCensusValid());

  const res = run(['file-pack', '--pack', packDir, '--room', roomDir, '--domain-slug', 'solar-cells', '--date', '2026-09-23', '--json']);
  check(res.status === 0, 'no-room-db leg exits 0');
  const out = parseJson(res.stdout);
  check(!!out && out.ok === false && out.reason === 'no_room_db' && out.filed === 0, 'no-room-db leg: {ok:false, reason:no_room_db, filed:0}');

  const variantArtifact = path.join(roomDir, 'competitive-analysis', 'dominant-designs', 'solar-cells-2026-09-23-evidence-variant_census.md');
  check(fs.existsSync(variantArtifact), 'no-room-db leg: lane artifact is still written');
  check(!fs.existsSync(path.join(roomDir, '.mindrian', 'room.db')), 'no-room-db leg: room.db is never created by file-pack itself');

  // Non-JSON report says plainly that room.db was not found.
  const resText = run(['file-pack', '--pack', packDir, '--room', roomDir, '--domain-slug', 'solar-cells', '--date', '2026-09-23']);
  check(resText.status === 0, 'no-room-db text report exits 0');
  check(resText.stdout.indexOf('room.db was not found') !== -1, 'no-room-db text report: says plainly that room.db was not found');
})();

// ---------------------------------------------------------------------------
// Leg 4: a *.valid.json whose ok is false is reported as not run, no
// artifact for that lane.
// ---------------------------------------------------------------------------

(function testInvalidLaneNotRun() {
  const roomDir = makeRoomWithDb();
  const packDir = makePackDir();
  writeValidJson(packDir, 'variant_census', { ok: false, reason: 'query_mismatch', lane: 'variant_census' });

  const res = run(['file-pack', '--pack', packDir, '--room', roomDir, '--domain-slug', 'solar-cells', '--date', '2026-09-23', '--json']);
  check(res.status === 0, 'invalid-lane leg exits 0');
  const out = parseJson(res.stdout);
  const lane = out && out.lanes.find(function (l) { return l.lane === 'variant_census'; });
  check(!!lane && lane.ok === false && lane.reason === 'query_mismatch', 'invalid-lane leg: reported not run with its own reason');

  const variantArtifact = path.join(roomDir, 'competitive-analysis', 'dominant-designs', 'solar-cells-2026-09-23-evidence-variant_census.md');
  check(!fs.existsSync(variantArtifact), 'invalid-lane leg: no artifact written for the not-run lane');
})();

// ---------------------------------------------------------------------------
// Leg 5: usage errors -- bad slug, bad date, non-existent room, missing pack.
// Exit 2, nothing written.
// ---------------------------------------------------------------------------

(function testUsageErrors() {
  const roomDir = makeRoomWithDb();
  const packDir = makePackDir();
  writeValidJson(packDir, 'variant_census', buildVariantCensusValid());
  const before = listAllFiles(roomDir);

  const badSlug = run(['file-pack', '--pack', packDir, '--room', roomDir, '--domain-slug', '../evil', '--date', '2026-09-23']);
  check(badSlug.status === 2, 'file-pack rejects a path-traversal --domain-slug with exit 2');

  const badDate = run(['file-pack', '--pack', packDir, '--room', roomDir, '--domain-slug', 'solar-cells', '--date', '2026-9-1']);
  check(badDate.status === 2, 'file-pack rejects a malformed --date with exit 2');

  const missingRoom = run(['file-pack', '--pack', packDir, '--room', path.join(roomDir, 'does-not-exist'), '--domain-slug', 'solar-cells', '--date', '2026-09-23']);
  check(missingRoom.status === 2, 'file-pack rejects a non-existent --room with exit 2');

  const missingPack = run(['file-pack', '--room', roomDir, '--domain-slug', 'solar-cells', '--date', '2026-09-23']);
  check(missingPack.status === 2, 'file-pack rejects a missing --pack with exit 2');

  const after = listAllFiles(roomDir);
  check(JSON.stringify(before) === JSON.stringify(after), 'file-pack usage errors: nothing written to the room directory');
})();

// ---------------------------------------------------------------------------
// Leg 6: default session id.
// ---------------------------------------------------------------------------

(function testDefaultSessionId() {
  const roomDir = makeRoomWithDb();
  const packDir = makePackDir();
  writeValidJson(packDir, 'variant_census', buildVariantCensusValid());

  const res = run(['file-pack', '--pack', packDir, '--room', roomDir, '--domain-slug', 'solar-cells', '--date', '2026-09-23', '--json']);
  check(res.status === 0, 'default-session leg exits 0');

  const db = openRoomDb(roomDir);
  try {
    const rows = db.prepare("SELECT id FROM nodes WHERE type = 'EvidenceClaim'").all();
    const expectedFragment = 'EvidenceClaim:dominant-designs:solar-cells:2026-09-23:dd-variant_census:';
    const matches = rows.filter(function (r) { return r.id.indexOf(expectedFragment) === 0; });
    check(matches.length === 2, 'default session id is dominant-designs:<slug>:<date>, present in the node id');
  } finally {
    closeRoomDb(db);
  }
})();

// ---------------------------------------------------------------------------
// Leg 7: 4-zone text report shape (no --json).
// ---------------------------------------------------------------------------

(function testFourZoneReport() {
  const roomDir = makeRoomWithDb();
  const packDir = makePackDir();
  writeValidJson(packDir, 'variant_census', buildVariantCensusValid());
  writeValidJson(packDir, 's_curve_limits', buildSCurveLimitsValid());

  const res = run(['file-pack', '--pack', packDir, '--room', roomDir, '--domain-slug', 'solar-cells', '--date', '2026-09-23', '--room-label', 'Solar Ventures', '--stage', 'Validate']);
  check(res.status === 0, 'four-zone report leg exits 0');

  const lines = res.stdout.split('\n');
  check(/^-- .+ -- competitive-analysis -- .+ --$/.test(lines[0]), 'Zone 1 header matches the anatomy regex');
  check(lines[0].indexOf('Solar Ventures') !== -1, 'Zone 1 header carries the --room-label');
  check(lines[0].indexOf('Validate') !== -1, 'Zone 1 header carries the --stage');

  const bodyLineCount = ['variant_census', 's_curve_limits'].filter(function (laneId) {
    return res.stdout.indexOf(laneId) !== -1 || res.stdout.toLowerCase().indexOf(laneId.replace(/_/g, ' ')) !== -1;
  }).length;
  check(res.stdout.indexOf('Variant census') !== -1, 'Zone 2 body table names the Variant census lane');
  check(res.stdout.indexOf('S-curve limits') !== -1, 'Zone 2 body table names the S-curve limits lane');

  const footerLines = lines.filter(function (l) { return l.indexOf('>') === 0; });
  check(footerLines.length >= 2 && footerLines.length <= 3, 'Zone 4 footer has 2-3 lines starting with >');
  check(footerLines[0].indexOf('/mos:find-bottlenecks') !== -1, 'Zone 4 footer: primary command is /mos:find-bottlenecks');
  check(footerLines.some(function (l) { return l.indexOf('/mos:macro-trends') !== -1; }), 'Zone 4 footer names /mos:macro-trends as an alternative');
  check(footerLines.some(function (l) { return l.indexOf('/mos:explore-trends') !== -1; }), 'Zone 4 footer names /mos:explore-trends as an alternative');

  check(res.stdout.indexOf('\u2014') === -1, 'the 4-zone report text contains no em-dash');

  // Default room label falls back to the room dir basename when --room-label
  // is absent; default stage falls back to "unknown stage" when --stage is
  // absent.
  const resDefaults = run(['file-pack', '--pack', packDir, '--room', roomDir, '--domain-slug', 'solar-cells', '--date', '2026-09-23']);
  const firstLine = resDefaults.stdout.split('\n')[0];
  check(firstLine.indexOf(path.basename(roomDir)) !== -1, 'Zone 1 header falls back to the room dir basename');
  check(firstLine.indexOf('unknown stage') !== -1, 'Zone 1 header falls back to "unknown stage"');
})();

// ---------------------------------------------------------------------------

fs.rmSync(SUITE_TMP, { recursive: true, force: true });

if (failures > 0) {
  console.log(failures + ' failure(s)');
  process.exit(1);
}
console.log('All test-361-filing.cjs legs passed.');
process.exit(0);
