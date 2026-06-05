'use strict';
// CASC-01 (Phase 142) -- loop-fires acceptance: a FILED artifact SURFACES
// cross-relationship findings to Larry mid-session via the Phase 95 side-channel.
//
// This is NOT a file-exists check. It asserts the SURFACING CONTRACT end-to-end:
//   1. Fire scripts/post-write against a tmp-room copy of the committed
//      cascade-surface-e2e fixture (MINDRIAN_ROOMS_HOME bound to the tmpdir so
//      the cascade never leaks into the user's real active room -- Pitfall 2).
//   2. The hook exits 0.
//   3. <roomDir>/.mindrian/last-cascade.json exists and parses.
//   4. The advisory prefix the SKILL.md trigger keys off is present on the
//      side-channel envelope's section/cascade_status (the renderer keys off
//      `^post-write: cascade complete` OR `^queued MINTO regen`).
//   5. proactive_intelligence.newFindings is a NON-EMPTY path -- the findings
//      would surface (newFindings non-empty -> renderable per SKILL.md line 102).
//
// We do NOT touch the renderer (byte-identical per Phase 95).
//
// RED now: the committed fixture's cascade short-circuits (no graph edges to
// surface), so proactive_intelligence.newFindings comes back empty/missing. Once
// Wave-2 closes the surfacing wiring (the cascade walks the seeded neighborhood
// and emits a finding), newFindings is non-empty and this goes GREEN.
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

function copyFixture(scratch) {
  const dest = path.join(scratch, 'cascade-surface-e2e');
  fs.cpSync(FIXTURE_REPO_PATH, dest, { recursive: true });
  return dest;
}

function runBashHook(scriptPath, envelope, env) {
  // Defensive Pitfall 2 guard: MINDRIAN_ROOMS_HOME must be bound.
  assert.equal(typeof env.MINDRIAN_ROOMS_HOME, 'string',
    'Test must set MINDRIAN_ROOMS_HOME to the scratch dir (avoid leaking into the real active room)');
  const res = spawnSync('bash', [scriptPath], {
    encoding: 'utf8',
    input: JSON.stringify(envelope),
    timeout: 8000,
    cwd: process.cwd(),
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

    const fixtureCopy = copyFixture(scratch);
    const roomDir = path.join(fixtureCopy, 'surface-e2e-room');
    const target = path.join(roomDir, 'problem-definition', 'seed-artifact', 'seed-artifact.md');
    assert.equal(fs.existsSync(target), true, label + ': seed-artifact target must exist in the copied fixture');

    fs.writeFileSync(target, '---\nname: seed-artifact\n---\n# Body\n# touched ' + Date.now() + '\n');

    const { status } = runBashHook(POST_WRITE,
      { tool_name: 'Write', tool_input: { file_path: target } },
      { MINDRIAN_ROOMS_HOME: fixtureCopy });
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
      label + ': proactive_intelligence.newFindings must be NON-EMPTY so findings would surface ' +
      '(RED until Wave-2 wires the cascade to emit a finding from the seeded neighborhood)');

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
