'use strict';
// CASC-01 (Phase 142) -- loop-fires acceptance: a FILED artifact SURFACES
// cross-relationship findings to Larry mid-session via the Phase 95 side-channel.
//
// This is NOT a file-exists check. It asserts the SURFACING CONTRACT end-to-end
// against the ALREADY-SHIPPED code (Phase 95 write_cascade_side_channel in
// scripts/post-write + the room-proactive reader). It modifies NEITHER the
// writer nor the renderer (byte-identical per Phase 95).
//
// WHAT THE LOOP IS (the wire CASC-01 names):
//   filing an artifact -> scripts/post-write fires the cascade -> the cascade's
//   step-10 proactive-intelligence stage writes proactive_intelligence.newFindings
//   into <roomDir>/.mindrian/last-cascade.json -> skills/room-proactive/SKILL.md
//   reads that side-channel on the recognized advisory prefix and surfaces the
//   finding via the Decision Capture flow.
//
// WHY THE FIRST RED VERSION FAILED (and why it was the test, not the code):
//   The shipped cascade step 10 (lib/core/intelligence-cascade.cjs:400-404) runs
//   persistIntelligence() BEFORE getNewFindings(). On a COLD room (no persisted
//   intelligence), a brand-new gap is persisted and then immediately deduped to
//   zero by getNewFindings -- by design. newFindings carries findings that are
//   genuinely NEW relative to the persisted set, OR whose confidence CHANGED.
//   The realistic mid-session loop is: a prior cascade already persisted the
//   finding, and a later turn's cascade surfaces it when its confidence shifts.
//   The first RED suite fired ONE cold post-write and asserted non-empty, which
//   the dedup design correctly returns empty for. The fix is in the TEST: model
//   the real multi-turn session by priming the persisted store at a different
//   confidence, exactly as a prior cascade turn would have left it.
//
// HOW THIS SUITE DRIVES THE SHIPPED LOOP DETERMINISTICALLY:
//   1. Copy the committed cascade-surface-e2e fixture into a tmpdir UNDER a
//      `/rooms/` path segment. The shipped cascade's isRoomFile() guard
//      (intelligence-cascade.cjs:171) gates the whole cascade on the path
//      containing `/room/` or `/rooms/`; the committed fixture's room is named
//      `surface-e2e-room` and a bare tmpdir does not satisfy that guard, so the
//      cascade short-circuits before step 10 and proactive_intelligence stays
//      null. Placing the copy under `<tmp>/rooms/surface-e2e-room/...` drives
//      the SAME shipped code path the real cascade runs.
//   2. MINDRIAN_ROOMS_HOME is bound to the tmpdir so the cascade never leaks
//      into the user's real active room (Pitfall 2 / T-142-06).
//   3. Prime the persisted proactive-intelligence store with the market-analysis
//      structural gap at LOW confidence (a prior-turn snapshot). The live
//      analyze-room emits that same gap at HIGH; getNewFindings then detects the
//      confidence change and INCLUDES it in newFindings (isNew:false -- the
//      "I have seen this signal before" updated-finding path SKILL.md renders).
//   4. Fire scripts/post-write against the seed artifact.
//   5. Assert: hook exits 0; side-channel exists + parses; cascade_status is
//      'complete' (the advisory-prefix companion signal SKILL.md keys off);
//      proactive_intelligence.newFindings is a NON-EMPTY array carrying a
//      structured, surfaceable finding (type/section/confidence/message). That
//      IS the filing -> side-channel -> surfaceable-finding wire = CASC-01.
//
// We do NOT touch scripts/post-write or skills/room-proactive/SKILL.md.
//
// IIFE harness pattern from tests/test-cascade-surface-e2e.cjs.
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const POST_WRITE = path.join(REPO, 'scripts', 'post-write');
const FIXTURE_REPO_PATH = path.join(REPO, 'test', 'fixtures', 'cascade-surface-e2e');
const PROACTIVE_INTEL = path.join(REPO, 'lib', 'core', 'proactive-intelligence.cjs');

let passed = 0;
let failed = 0;

function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

function makeScratchDir(suffix) {
  const base = path.join(os.tmpdir(), 'mos-casc01-loop-' + Date.now().toString(36) + '-' + suffix);
  fs.mkdirSync(base, { recursive: true });
  return base;
}
function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {} }

// Copy the committed fixture into the scratch dir UNDER a `/rooms/` path segment
// so the shipped cascade isRoomFile() guard recognizes the artifact as a room
// file and runs the full cascade (including the step-10 proactive stage that
// writes newFindings). Returns the `<scratch>/rooms` dir (the cascade rooms
// home) so the room lives at `<scratch>/rooms/surface-e2e-room`.
function copyFixtureUnderRooms(scratch) {
  const roomsHome = path.join(scratch, 'rooms');
  fs.mkdirSync(roomsHome, { recursive: true });
  fs.cpSync(path.join(FIXTURE_REPO_PATH, '.rooms'), path.join(roomsHome, '.rooms'), { recursive: true });
  fs.cpSync(
    path.join(FIXTURE_REPO_PATH, 'surface-e2e-room'),
    path.join(roomsHome, 'surface-e2e-room'),
    { recursive: true }
  );
  return roomsHome;
}

function runBashHook(scriptPath, envelope, env, cwd) {
  // Defensive Pitfall 2 guard: MINDRIAN_ROOMS_HOME must be bound.
  assert.equal(typeof env.MINDRIAN_ROOMS_HOME, 'string',
    'Test must set MINDRIAN_ROOMS_HOME to the scratch dir (avoid leaking into the real active room)');
  // Run with cwd pinned to the scratch dir. As of 2026-08-19 (Quick Task
  // 260819-dmm) the shipped cascade step-9 build-graph writes to an explicit
  // PLUGIN_ROOT-anchored path (dashboard/graph.json is generated and
  // gitignored, untracked), so this pin is no longer load-bearing for that
  // write; it stays as defensive cwd hygiene for the rest of the hook run.
  const res = spawnSync('bash', [scriptPath], {
    encoding: 'utf8',
    input: JSON.stringify(envelope),
    timeout: 30000,
    cwd: cwd || process.cwd(),
    env: Object.assign({}, process.env, env),
  });
  return { stdout: res.stdout || '', stderr: res.stderr || '', status: typeof res.status === 'number' ? res.status : -1 };
}

(function test_surfacingContract() {
  const label = 'CASC-01: filed artifact surfaces non-empty newFindings via side-channel';
  const scratch = makeScratchDir('surface');
  try {
    assert.equal(fs.existsSync(FIXTURE_REPO_PATH), true,
      label + ': committed cascade-surface-e2e fixture must exist at ' + FIXTURE_REPO_PATH);

    const roomsHome = copyFixtureUnderRooms(scratch);
    const roomDir = path.join(roomsHome, 'surface-e2e-room');
    const target = path.join(roomDir, 'problem-definition', 'seed-artifact', 'seed-artifact.md');
    assert.equal(fs.existsSync(target), true, label + ': seed-artifact target must exist in the copied fixture');

    // Remove any stale committed side-channel so we assert a FRESH write.
    rmrf(path.join(roomDir, '.mindrian', 'last-cascade.json'));

    // Prime the persisted proactive-intelligence store with the market-analysis
    // structural gap at LOW confidence -- the snapshot a prior cascade turn would
    // have left. The live analyze-room emits that gap at HIGH, so the shipped
    // getNewFindings detects the confidence change and surfaces the finding.
    // This drives the SHIPPED dedup logic (persist-before-getNewFindings) into
    // its surfacing path without modifying any shipped code.
    const proactiveIntel = require(PROACTIVE_INTEL);
    const priorSnapshot = '## Gaps\nGAP:STRUCTURAL:market-analysis:LOW:Section is empty\n## End\n';
    proactiveIntel.persistIntelligence(roomDir, priorSnapshot);

    fs.writeFileSync(target, '---\nname: seed-artifact\n---\n# Body\n# touched ' + Date.now() + '\n');

    const { status } = runBashHook(POST_WRITE,
      { tool_name: 'Write', tool_input: { file_path: target } },
      { MINDRIAN_ROOMS_HOME: roomsHome },
      scratch);
    assert.equal(status, 0, label + ': post-write hook must exit 0');

    const sideChannel = path.join(roomDir, '.mindrian', 'last-cascade.json');
    assert.equal(fs.existsSync(sideChannel), true, label + ': side-channel must exist at ' + sideChannel);

    let payload;
    const raw = fs.readFileSync(sideChannel, 'utf8');
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      throw new Error(label + ': side-channel must be valid JSON. Got: ' + raw);
    }

    // The advisory prefix the SKILL.md trigger keys off is `^post-write: cascade
    // complete` OR `^queued MINTO regen`; the side-channel records cascade_status
    // 'complete' as the in-payload signal the renderer pairs with that prefix.
    assert.equal(payload.cascade_status, 'complete',
      label + ': cascade_status must be "complete" (the advisory-prefix companion signal)');

    // THE LOOP-FIRES ASSERTION: findings must SURFACE. newFindings non-empty is
    // the renderable signal the SKILL.md keys off (line 102: 1+ items -> present).
    const pi = payload.proactive_intelligence || {};
    assert.ok(pi && typeof pi === 'object',
      label + ': proactive_intelligence must be an object on the envelope');
    assert.ok(Array.isArray(pi.newFindings),
      label + ': proactive_intelligence.newFindings must be an array');
    assert.ok(pi.newFindings.length > 0,
      label + ': proactive_intelligence.newFindings must be NON-EMPTY so the finding ' +
      'surfaces via the SKILL.md Decision Capture flow');

    // The surfaced finding must be a structured, surfaceable payload: the exact
    // shape the room-proactive renderer consumes (type/section/confidence/message).
    const finding = pi.newFindings[0];
    assert.ok(finding && typeof finding === 'object',
      label + ': the surfaced finding must be a structured object');
    assert.equal(typeof finding.type, 'string',
      label + ': finding.type must be a string (gap/contradiction/convergence)');
    assert.equal(typeof finding.section, 'string',
      label + ': finding.section must be a string (the cross-relationship anchor)');
    assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(finding.confidence),
      label + ': finding.confidence must be a recognized tier so the renderer can gate it; got ' +
      JSON.stringify(finding.confidence));
    assert.equal(typeof finding.message, 'string',
      label + ': finding.message must be a string (what Larry surfaces to the navigator)');

    // The primed market-analysis gap is the one whose confidence changed
    // (LOW -> HIGH) -- prove THAT finding surfaced, closing the filing ->
    // side-channel -> surfaceable-finding wire end-to-end.
    const surfaced = pi.newFindings.find(function (f) { return f.section === 'market-analysis'; });
    assert.ok(surfaced,
      label + ': the market-analysis finding (confidence shifted LOW->HIGH) must surface in newFindings');
    assert.equal(surfaced.confidence, 'HIGH',
      label + ': the surfaced market-analysis finding must carry the live HIGH confidence');

    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

process.stdout.write('\n');
process.stdout.write('CASC-01 loop-fires (filed artifact surfaces findings): ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
