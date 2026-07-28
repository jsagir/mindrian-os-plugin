#!/usr/bin/env node
// Phase 237-06 (REACH-03, writer half) -- end-to-end proof that the two
// marker writers (scripts/post-write and scripts/auto-explore-fire.cjs,
// threaded via scripts/auto-explore-fingerprint.cjs) stamp the session_id
// that reached them, so the Plan 04 reader fence
// (lib/core/insight-sensors.cjs::isMarkerOwnedByCaller / deriveTurnSignals)
// has something real to compare against.
//
// This drives the REAL bash hook and the REAL detached node script -- it
// does not reimplement scripts/post-write's jq payload builder or
// scripts/auto-explore-fire.cjs's compose-and-write path.
//
// Seven legs:
//   Leg 1 CASCADE STAMPED    -- the real bash scripts/post-write, driven
//                                with a hook stdin payload carrying
//                                session_id, writes a last-cascade.json
//                                whose top-level session_id matches.
//   Leg 2 CASCADE DEGRADE    -- the same drive with session_id absent from
//                                stdin still writes a valid marker with no
//                                session_id (or null), and
//                                isMarkerOwnedByCaller fires open for it.
//   Leg 3 ATOMICITY PRESERVED -- no .last-cascade.json.XXXXXX temp residue
//                                survives the drive; the mktemp-then-rename
//                                path still completes.
//   Leg 4 FINGERPRINT THREADS -- the real scripts/auto-explore-fingerprint.cjs,
//                                driven as a real PostToolUse hook, threads
//                                session_id to its real detached spawn of
//                                scripts/auto-explore-fire.cjs. Interception
//                                method: BOUNDED POLL-AND-TIMEOUT on the
//                                written auto-explore-*.json (no exported
//                                seam exists in the fingerprint script to
//                                intercept the spawn argv without a source
//                                change).
//   Leg 5 FIRE STAMPED        -- invoking scripts/auto-explore-fire.cjs
//                                directly with a session id as the 4th argv
//                                writes a finding JSON whose session_id
//                                equals it.
//   Leg 6 FIRE DEGRADE        -- the same invocation with the 4th argv
//                                omitted writes a valid finding JSON with no
//                                session_id, and does not crash.
//   Leg 7 CLOSED LOOP         -- a marker stamped by the real post-write
//                                drive as session A is NOT surfaced by
//                                deriveTurnSignals(ctx, '237-writer-B'), and
//                                IS surfaced by deriveTurnSignals(ctx,
//                                '237-writer-A'). Proves writer and reader
//                                agree on the key name end to end.
//
// Deviation (recorded here and in the SUMMARY): the real discovery/RS
// substrate (scripts/discovery-cycle.cjs + scripts/rs-engine.py) that
// scripts/auto-explore-fire.cjs shells out to needs a fully populated Data
// Room (HSI scores, embeddings, ANALOGOUS_TO graph edges) to produce a
// non-empty candidate on its own -- entirely orthogonal to REACH-03's
// session-stamping surface, and (confirmed live during authoring)
// rs-engine.py's current --mode hybrid CLI contract requires --topic, which
// the caller does not pass, so it fails fast every time regardless of this
// plan. Legs 4/5/6 therefore pre-seed the exact upstream files
// scripts/auto-explore-fire.cjs itself reads
// (.mindrian/whitespace-results.json, .mindrian/whitespace-embeddings.json,
// .mindrian/brain-baseline.json) with realistic, schema-valid data so the
// REAL compose-and-write path (composeAutoExploreFinding -> atomicWriteJson)
// runs for real without a live Brain network call. This is upstream fixture
// seeding, the same technique Legs 1-3 use for the hook stdin payload; the
// writer code under test (the session_id read + stamp) is never
// reimplemented.
//
// Separately (confirmed live during authoring): lib/core/intelligence-
// cascade.cjs's own proactiveIntelligence step calls persistIntelligence()
// BEFORE getNewFindings() against the same parsed insights, so on a single
// real cascade drive against a fresh room, newFindings is always empty (the
// insights were already persisted by the time the diff runs). This is a
// pre-existing, out-of-scope ordering defect in a different module, logged
// to deferred-items.md. Leg 7 needs a marker whose
// proactive_intelligence.newFindings is genuinely non-empty to exercise the
// artifact_filed derivation at all (a precondition independent of REACH-03's
// session-ownership check), so it patches ONLY that one field on the REAL
// marker Leg 1 produced, byte-preserving session_id and every other
// real-writer field. The thing Leg 7 actually proves (the writer and the
// reader agreeing on the session_id key) is never patched.
//
// Harness sources (precedent this file follows):
//   - tests/test-241-guardian-tripolar-parity.cjs:94-132 -- the seedRoom
//     fixture builder + the spawnSync('bash', [SCRIPT], {cwd, env, stdio,
//     timeout}) driver shape.
//   - tests/test-auto-explore-fire.cjs -- real invocation of
//     scripts/auto-explore-fire.cjs with a bounded timeout, accepting
//     either a written finding or a documented ledger failure as a valid
//     real-pipeline outcome.
//   - tests/test-237-session-scope.cjs -- the LEG PASS/LEG FAIL runner shape
//     and the hermetic env save/delete/restore block.
//
// Plain node:assert. No test framework. No em-dashes.
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const POST_WRITE_PATH = path.join(REPO_ROOT, 'scripts', 'post-write');
const FINGERPRINT_PATH = path.join(REPO_ROOT, 'scripts', 'auto-explore-fingerprint.cjs');
const FIRE_PATH = path.join(REPO_ROOT, 'scripts', 'auto-explore-fire.cjs');
const INSIGHT_SENSORS_PATH = path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs');
const EXPLORED_STORE_PATH = path.join(REPO_ROOT, 'lib', 'memory', 'explored-materials-store.cjs');

const insightSensors = require(INSIGHT_SENSORS_PATH);
const exploredStore = require(EXPLORED_STORE_PATH);

// ---------------------------------------------------------------------------
// jq guard (post-write already soft-fails without jq; SKIP rather than
// report a false red per the plan's aggregator SKIP semantics).
// ---------------------------------------------------------------------------
function jqAvailable() {
  const r = spawnSync('jq', ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] });
  return r.status === 0;
}

// ---------------------------------------------------------------------------
// Hermetic env block, matching tests/test-237-session-scope.cjs.
// ---------------------------------------------------------------------------
const savedRoomsHome = process.env.MINDRIAN_ROOMS_HOME;
const savedMcpFirst = process.env.MINDRIAN_MCP_FIRST;
const savedActiveRoom = process.env.CLAUDE_ACTIVE_ROOM;
const savedSessionId = process.env.CLAUDE_CODE_SESSION_ID;

function restoreEnv() {
  if (savedRoomsHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME; else process.env.MINDRIAN_ROOMS_HOME = savedRoomsHome;
  if (savedMcpFirst === undefined) delete process.env.MINDRIAN_MCP_FIRST; else process.env.MINDRIAN_MCP_FIRST = savedMcpFirst;
  if (savedActiveRoom === undefined) delete process.env.CLAUDE_ACTIVE_ROOM; else process.env.CLAUDE_ACTIVE_ROOM = savedActiveRoom;
  if (savedSessionId === undefined) delete process.env.CLAUDE_CODE_SESSION_ID; else process.env.CLAUDE_CODE_SESSION_ID = savedSessionId;
}

// ---------------------------------------------------------------------------
// Fixture builder -- mirrors tests/test-241-guardian-tripolar-parity.cjs's
// own seedRoom, with two additions this plan's writer needs: a literal
// "rooms" path segment (lib/core/intelligence-cascade.cjs::isRoomFile
// requires the file path to contain "/room/" or "/rooms/" before it will
// run the cascade at all) and a STATE.md at the room root (scripts/post-write
// only sets room_dir, and therefore only calls write_cascade_side_channel,
// when a STATE.md is found walking up from the written file).
// ---------------------------------------------------------------------------
function seedRoom(tmpRoot, slug, ventureStage) {
  const roomsHome = path.join(tmpRoot, 'rooms');
  const roomDir = path.join(roomsHome, slug);
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '', 'utf8');
  fs.writeFileSync(
    path.join(roomDir, 'STATE.md'),
    '# Venture\n\nventure_stage: ' + (ventureStage || 'Pre-Opportunity') + '\n',
    'utf8'
  );
  const sectionDir = path.join(roomDir, 'market-analysis');
  fs.mkdirSync(sectionDir, { recursive: true });
  fs.writeFileSync(path.join(sectionDir, 'ROOM.md'), '# market-analysis\n\nIdentity text.\n', 'utf8');

  const workDir = path.join(tmpRoot, 'work', slug);
  fs.mkdirSync(workDir, { recursive: true });

  // scripts/auto-explore-fingerprint.cjs's Phase 119-00 sibling hook treats
  // a missing central registry `active` field as "no active room" and
  // auto-creates a throwaway placeholder room instead of using this
  // fixture's own roomDir (lib/agents/auto-explore-agent.cjs::
  // detectNoActiveRoom, gated on MINDRIAN_ROOMS_HOME/.rooms/registry.json).
  // A minimal `{active: slug}` satisfies that gate. scripts/resolve-room's
  // own Strategy 0 (used by scripts/post-write) tolerates this same file:
  // it requires `active` to key into a `rooms` map this fixture does not
  // provide, so it falls through cleanly to Strategy 0b (directory scan on
  // basename(workDir) === slug, which this fixture's workDir/roomDir
  // naming already satisfies) -- confirmed live during authoring.
  const roomsMetaDir = path.join(roomsHome, '.rooms');
  fs.mkdirSync(roomsMetaDir, { recursive: true });
  fs.writeFileSync(path.join(roomsMetaDir, 'registry.json'), JSON.stringify({ active: slug }), 'utf8');

  return { roomsHome: roomsHome, roomDir: roomDir, workDir: workDir, slug: slug };
}

// scripts/auto-explore-fingerprint.cjs suppresses at Tier 0 (detectFirstMaterial)
// whenever .mindrian/room.db does not yet exist -- confirmed live during
// authoring. Real rooms accumulate room.db via the post-write cascade's own
// graph-index step (scripts/post-write -> intelligence-cascade.cjs -> Step 2);
// this fixture creates it the same real way (lib/core/graph-ops.cjs, the
// module scripts/post-write itself requires for that step) rather than
// faking a schema.
async function seedRoomDb(fixture, targetFilePath) {
  const graphOps = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-ops.cjs'));
  await graphOps.indexArtifact(fixture.roomDir, targetFilePath);
}

function writeSectionFile(fixture, name, content) {
  const p = path.join(fixture.roomDir, 'market-analysis', name);
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

function readJsonSafe(p) {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_e) {
    return null;
  }
}

function baseEnv(fixture, homeOverride) {
  const env = Object.assign({}, process.env, {
    PWD: fixture.workDir,
    MINDRIAN_ROOMS_HOME: fixture.roomsHome,
    CLAUDE_PLUGIN_ROOT: REPO_ROOT,
    MOS_NO_DETACHED_DERIVE: '1',
  });
  delete env.MINDRIAN_MCP_FIRST;
  delete env.CLAUDE_ACTIVE_ROOM;
  delete env.CLAUDE_CODE_SESSION_ID;
  if (homeOverride) {
    env.HOME = homeOverride;
    delete env.MINDRIAN_BRAIN_KEY;
  }
  return env;
}

// Drives the REAL bash scripts/post-write as a PostToolUse hook.
function drivePostWrite(fixture, hookPayload) {
  const env = baseEnv(fixture, null);
  return spawnSync('bash', [POST_WRITE_PATH], {
    cwd: fixture.workDir,
    env: env,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30000,
    input: JSON.stringify(hookPayload),
  });
}

// Drives the REAL node scripts/auto-explore-fingerprint.cjs as a PostToolUse
// hook. homeOverride isolates the global ~/.mindrian/explored-materials
// ledger and any ~/.mindrian.env Brain key from this test run.
function driveFingerprint(fixture, hookPayload, homeOverride) {
  const env = baseEnv(fixture, homeOverride);
  return spawnSync('node', [FINGERPRINT_PATH], {
    cwd: fixture.workDir,
    env: env,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 15000,
    input: JSON.stringify(hookPayload),
  });
}

// Invokes the REAL scripts/auto-explore-fire.cjs directly (not detached),
// matching tests/test-auto-explore-fire.cjs's own precedent for exercising
// this script.
function driveFireDirect(fixture, argvRest, homeOverride) {
  const env = baseEnv(fixture, homeOverride);
  return spawnSync('node', [FIRE_PATH].concat(argvRest), {
    cwd: fixture.workDir,
    env: env,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000,
  });
}

// Pre-seeds the three files scripts/auto-explore-fire.cjs's Step 3 reads,
// plus the two files that let scripts/discovery-cycle.cjs's own real
// analogy step complete WITHOUT a live Brain network call (brain-
// baseline.json already-present short-circuits ensureBrainBaseline before
// it ever fetches). Confirmed live during authoring: with only these two
// seeded, scripts/discovery-cycle.cjs --steps all completes in under two
// seconds, zero network, and leaves whitespace-results.json (a filename
// scripts/discovery-cycle.cjs itself never writes) untouched.
function seedDiscoverySubstrate(fixture) {
  const mindrianDir = path.join(fixture.roomDir, '.mindrian');
  fs.writeFileSync(
    path.join(mindrianDir, 'whitespace-results.json'),
    JSON.stringify({
      gaps: [
        {
          nearest_room_artifacts: [{ id: 'seed-artifact-1', section: 'market-analysis' }],
          density_score: 0.2,
          framework_chain: [],
        },
      ],
    }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(mindrianDir, 'whitespace-embeddings.json'),
    JSON.stringify({ embeddings: [] }),
    'utf8'
  );
  fs.writeFileSync(path.join(mindrianDir, 'brain-baseline.json'), JSON.stringify({}), 'utf8');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollForNewFile(dir, before, pattern, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    let entries = [];
    try { entries = fs.readdirSync(dir); } catch (_e) { entries = []; }
    const hit = entries.find((name) => pattern.test(name) && !before.has(name));
    if (hit) return path.join(dir, hit);
    if (Date.now() > deadline) return null;
    await sleep(300);
  }
}

// ---------------------------------------------------------------------------
// Legs 1-3: real bash scripts/post-write.
// ---------------------------------------------------------------------------

// Drives the session-A post-write hook and returns the fixture + marker
// path unconditionally (throws only on a genuine drive failure -- non-zero
// exit or a missing marker file). Kept separate from the session_id
// assertion so Leg 3 (atomicity) and Leg 7 (closed loop) can still run
// against this same real marker even while Leg 1's own assertion is RED
// pre-fix.
function produceDriveOneFixture(tmpRoot) {
  const fixture = seedRoom(tmpRoot, 'room-a', 'Pre-Opportunity');
  const target = writeSectionFile(fixture, 'note.md', '# Note\n\nMarket analysis content for Leg 1.\n');
  const result = drivePostWrite(fixture, {
    tool_name: 'Write',
    tool_input: { file_path: target },
    session_id: '237-writer-A',
  });
  assert.strictEqual(result.status, 0, 'LEG 1: scripts/post-write must exit 0; stderr: ' + (result.stderr || '').toString());

  const markerPath = path.join(fixture.roomDir, '.mindrian', 'last-cascade.json');
  assert.ok(fs.existsSync(markerPath), 'LEG 1: last-cascade.json must exist after the drive');
  return { fixture: fixture, markerPath: markerPath };
}

async function legCascadeStamped(driveOneResult) {
  const marker = readJsonSafe(driveOneResult.markerPath);
  assert.ok(marker && typeof marker === 'object', 'LEG 1: last-cascade.json must parse as JSON');
  assert.strictEqual(marker.session_id, '237-writer-A', 'LEG 1 (CASCADE STAMPED): last-cascade.json top-level session_id must equal the hook-supplied session_id');
}

async function legCascadeDegrade(tmpRoot) {
  const fixture = seedRoom(tmpRoot, 'room-b', 'Pre-Opportunity');
  const target = writeSectionFile(fixture, 'note.md', '# Note\n\nMarket analysis content for Leg 2.\n');
  const result = drivePostWrite(fixture, {
    tool_name: 'Write',
    tool_input: { file_path: target },
    // session_id deliberately absent -- Leg 2 proves the degrade path.
  });
  assert.strictEqual(result.status, 0, 'LEG 2: scripts/post-write must exit 0; stderr: ' + (result.stderr || '').toString());

  const markerPath = path.join(fixture.roomDir, '.mindrian', 'last-cascade.json');
  assert.ok(fs.existsSync(markerPath), 'LEG 2: last-cascade.json must exist after the drive');
  const marker = readJsonSafe(markerPath);
  assert.ok(marker && typeof marker === 'object', 'LEG 2: last-cascade.json must parse as JSON');
  assert.ok(
    marker.session_id === undefined || marker.session_id === null,
    'LEG 2 (CASCADE DEGRADE): a marker written with no session_id on hook stdin must carry no session_id (or an explicit null), got: ' + JSON.stringify(marker.session_id)
  );
  assert.strictEqual(
    insightSensors.isMarkerOwnedByCaller(marker.session_id, 'any-caller'),
    true,
    'LEG 2 (CASCADE DEGRADE): isMarkerOwnedByCaller must fire open for a legacy/unstamped marker'
  );

  return { fixture: fixture, markerPath: markerPath };
}

async function legAtomicityPreserved(driveOneResult) {
  const mindrianDir = path.join(driveOneResult.fixture.roomDir, '.mindrian');
  const entries = fs.readdirSync(mindrianDir);
  const residue = entries.filter((name) => name.indexOf('.last-cascade.json.') === 0);
  assert.strictEqual(
    residue.length,
    0,
    'LEG 3 (ATOMICITY PRESERVED): no mktemp residue may remain in .mindrian/; found: ' + JSON.stringify(residue)
  );
}

// ---------------------------------------------------------------------------
// Legs 4-6: the fingerprint hook + the detached/direct fire script.
// ---------------------------------------------------------------------------

// Drives the fingerprint hook and returns {fixture, finding} unconditionally
// once a real finding has been produced (throws only on a genuine drive
// failure or a timed-out poll). Kept separate from the session_id assertion
// so Legs 5/6 can still run against room-c even while Leg 4's own assertion
// is RED pre-fix.
async function produceFingerprintFixture(tmpRoot, fakeHome) {
  const fixture = seedRoom(tmpRoot, 'room-c', 'Pre-Opportunity');
  const target = writeSectionFile(fixture, 'finding-4.md', '# Finding 4\n\nContent for Leg 4 (fingerprint threading).\n');
  await seedRoomDb(fixture, target);
  seedDiscoverySubstrate(fixture);
  const mindrianDir = path.join(fixture.roomDir, '.mindrian');
  const before = new Set(fs.readdirSync(mindrianDir));

  const result = driveFingerprint(fixture, {
    tool_name: 'Write',
    tool_input: { file_path: target },
    session_id: '237-writer-A',
  }, fakeHome);
  assert.strictEqual(result.status, 0, 'LEG 4: scripts/auto-explore-fingerprint.cjs must exit 0; stderr: ' + (result.stderr || '').toString());

  // Interception method: BOUNDED POLL-AND-TIMEOUT on the real detached
  // child's output file. scripts/auto-explore-fingerprint.cjs exposes no
  // function to intercept the spawn argv without a source change (the spawn
  // call is inline inside main()), and stubbing firePath would mean driving
  // a stand-in, not the real detached script -- so this leg lets the real
  // detached scripts/auto-explore-fire.cjs run to completion and reads its
  // real output.
  const findingPath = await pollForNewFile(mindrianDir, before, /^auto-explore-.*\.json$/, 20000);
  assert.ok(findingPath, 'LEG 4 (FINGERPRINT THREADS): the detached scripts/auto-explore-fire.cjs must produce an auto-explore-*.json finding within the poll window');

  const finding = readJsonSafe(findingPath);
  assert.ok(finding && typeof finding === 'object', 'LEG 4: finding JSON must parse');

  return { fixture: fixture, finding: finding };
}

async function legFingerprintThreads(fingerprintResult) {
  assert.strictEqual(
    fingerprintResult.finding.session_id,
    '237-writer-A',
    'LEG 4 (FINGERPRINT THREADS): the session_id that reached the fingerprint hook via stdin must reach the detached fire child and land in the finding'
  );
}

async function legFireStamped(fixture, fakeHome) {
  const target = writeSectionFile(fixture, 'finding-5.md', '# Finding 5\n\nContent for Leg 5 (direct fire, stamped).\n');
  const mtimeMs = fs.statSync(target).mtime.getTime();
  const relPath = path.relative(fixture.roomDir, target);
  const materialId = exploredStore.computeMaterialId(fixture.roomDir, relPath, mtimeMs);

  const result = driveFireDirect(fixture, [fixture.roomDir, relPath, materialId, '237-writer-A'], fakeHome);
  assert.strictEqual(result.status, 0, 'LEG 5: scripts/auto-explore-fire.cjs must exit 0; stderr: ' + (result.stderr || '').toString());

  const findingPath = path.join(fixture.roomDir, '.mindrian', 'auto-explore-' + materialId + '.json');
  assert.ok(fs.existsSync(findingPath), 'LEG 5 (FIRE STAMPED): a direct invocation with a session id must write a finding JSON');
  const finding = readJsonSafe(findingPath);
  assert.strictEqual(
    finding.session_id,
    '237-writer-A',
    'LEG 5 (FIRE STAMPED): the finding JSON top-level session_id must equal the supplied 4th argv'
  );
}

async function legFireDegrade(fixture, fakeHome) {
  const target = writeSectionFile(fixture, 'finding-6.md', '# Finding 6\n\nContent for Leg 6 (direct fire, degrade).\n');
  const mtimeMs = fs.statSync(target).mtime.getTime();
  const relPath = path.relative(fixture.roomDir, target);
  const materialId = exploredStore.computeMaterialId(fixture.roomDir, relPath, mtimeMs);

  // 4th argv (session id) deliberately omitted.
  const result = driveFireDirect(fixture, [fixture.roomDir, relPath, materialId], fakeHome);
  assert.strictEqual(result.status, 0, 'LEG 6: scripts/auto-explore-fire.cjs must exit 0 even with no session id argv; stderr: ' + (result.stderr || '').toString());

  const findingPath = path.join(fixture.roomDir, '.mindrian', 'auto-explore-' + materialId + '.json');
  assert.ok(fs.existsSync(findingPath), 'LEG 6 (FIRE DEGRADE): a direct invocation with no session id must still write a valid finding JSON');
  const finding = readJsonSafe(findingPath);
  assert.ok(finding && typeof finding === 'object', 'LEG 6: finding JSON must parse');
  assert.ok(
    finding.session_id === undefined || finding.session_id === null,
    'LEG 6 (FIRE DEGRADE): finding JSON must carry no session_id (or an explicit null) when the 4th argv is absent, got: ' + JSON.stringify(finding.session_id)
  );
}

// ---------------------------------------------------------------------------
// Leg 7: closed loop against the real reader.
// ---------------------------------------------------------------------------

async function legClosedLoop(driveOneResult) {
  const marker = readJsonSafe(driveOneResult.markerPath);
  assert.ok(marker && marker.session_id === '237-writer-A', 'LEG 7 precondition: Leg 1 marker must still carry session_id 237-writer-A');

  // Patch ONLY proactive_intelligence.newFindings (see the file-header
  // deviation note: intelligence-cascade.cjs persists before it diffs, so
  // newFindings is always empty on a single real drive against a fresh
  // room -- a pre-existing, out-of-scope ordering defect). session_id and
  // every other real-writer field are left byte-identical.
  marker.proactive_intelligence = marker.proactive_intelligence || {};
  marker.proactive_intelligence.newFindings = [
    { type: 'GAP', section: 'problem-definition', confidence: 'HIGH', message: 'Section is empty', isNew: true },
  ];
  fs.writeFileSync(driveOneResult.markerPath, JSON.stringify(marker), 'utf8');

  const ctx = { roomDir: driveOneResult.fixture.roomDir };

  const signalsForB = insightSensors.deriveTurnSignals(ctx, '237-writer-B');
  assert.ok(
    signalsForB.indexOf('artifact_filed') === -1,
    'LEG 7 (CLOSED LOOP): a marker stamped by session A must NOT surface artifact_filed for session B'
  );

  const signalsForA = insightSensors.deriveTurnSignals(ctx, '237-writer-A');
  assert.ok(
    signalsForA.indexOf('artifact_filed') !== -1,
    'LEG 7 (CLOSED LOOP): the SAME marker must surface artifact_filed for the session that actually produced it (237-writer-A)'
  );
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
  if (!jqAvailable()) {
    console.log('SKIP: jq not available on this host -- scripts/post-write soft-fails without it, matching the aggregator SKIP semantics.');
    process.exit(0);
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reach03-writer-'));
  const fakeHome = fs.mkdtempSync(path.join(tmpRoot, 'fakehome-'));

  const results = [];
  async function leg(name, fn) {
    try {
      const out = await fn();
      results.push({ name: name, passed: true });
      console.log('LEG PASS: ' + name);
      return out;
    } catch (e) {
      results.push({ name: name, passed: false, error: (e && e.message) || String(e) });
      console.log('LEG FAIL: ' + name + ' -- ' + ((e && e.message) || e));
      return null;
    }
  }

  try {
    // Produced once, unconditionally (throws only on a genuine drive
    // failure), so Leg 3 and Leg 7 can still exercise the same real marker
    // even while Leg 1's own session_id assertion is RED pre-fix.
    let driveOne = null;
    try {
      driveOne = produceDriveOneFixture(tmpRoot);
    } catch (e) {
      const msg = (e && e.message) || String(e);
      for (const n of ['Leg 1 (CASCADE STAMPED)', 'Leg 3 (ATOMICITY PRESERVED)', 'Leg 7 (CLOSED LOOP)']) {
        results.push({ name: n, passed: false, error: 'drive failed: ' + msg });
        console.log('LEG FAIL: ' + n + ' -- drive failed: ' + msg);
      }
    }

    if (driveOne) {
      await leg('Leg 1 (CASCADE STAMPED)', () => legCascadeStamped(driveOne));
    }

    await leg('Leg 2 (CASCADE DEGRADE)', () => legCascadeDegrade(tmpRoot));

    if (driveOne) {
      await leg('Leg 3 (ATOMICITY PRESERVED)', () => legAtomicityPreserved(driveOne));
    }

    let fingerprintResult = null;
    try {
      fingerprintResult = await produceFingerprintFixture(tmpRoot, fakeHome);
    } catch (e) {
      const msg = (e && e.message) || String(e);
      for (const n of ['Leg 4 (FINGERPRINT THREADS)', 'Leg 5 (FIRE STAMPED)', 'Leg 6 (FIRE DEGRADE)']) {
        results.push({ name: n, passed: false, error: 'drive failed: ' + msg });
        console.log('LEG FAIL: ' + n + ' -- drive failed: ' + msg);
      }
    }

    if (fingerprintResult) {
      await leg('Leg 4 (FINGERPRINT THREADS)', () => legFingerprintThreads(fingerprintResult));
      await leg('Leg 5 (FIRE STAMPED)', () => legFireStamped(fingerprintResult.fixture, fakeHome));
      await leg('Leg 6 (FIRE DEGRADE)', () => legFireDegrade(fingerprintResult.fixture, fakeHome));
    }

    if (driveOne) {
      await leg('Leg 7 (CLOSED LOOP)', () => legClosedLoop(driveOne));
    }
  } finally {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_e) { /* best-effort teardown */ }
    restoreEnv();
  }

  const failed = results.filter((r) => !r.passed);
  console.log('');
  console.log('========================================');
  console.log('  test-237-post-write-session-stamp: ' + (results.length - failed.length) + '/' + results.length + ' legs passed');
  console.log('========================================');
  if (failed.length > 0) {
    console.log('FAILED LEGS:');
    for (const f of failed) {
      console.log('  - ' + f.name + ': ' + f.error);
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  restoreEnv();
  process.stderr.write('test-237-post-write-session-stamp FATAL: ' + ((err && err.message) || err) + '\n');
  if (err && err.stack) process.stderr.write(err.stack + '\n');
  process.exit(1);
});
