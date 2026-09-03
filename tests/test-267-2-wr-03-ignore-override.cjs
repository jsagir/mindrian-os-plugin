'use strict';
// Phase 267.2 code review fix WR-03 -- readUserMd's persona-override seam
// (lib/core/user-md-ops.cjs:222-253) is consulted BEFORE the real on-disk
// file: while an override is active, readUserMd(anyPath) returns a synthetic
// struct built from the override, not the real file. A read-modify-write
// caller (lib/mcp/tools/identity.cjs's identity_write handler, CR-01;
// scripts/first-install-router.cjs's _seedIdentityFile, decision D-E) that
// reads via readUserMd and then persists the merge back to userMdPath would
// silently write the override's synthetic shape over the real file,
// resetting every field the override does not carry.
//
// Fix: readUserMd(userMdPath, { ignoreOverride: true }) skips the override
// seam and always reads the real on-disk file. Default behavior (no opts,
// or ignoreOverride: false/absent) is UNCHANGED -- this is the regression
// pin for that non-regression, plus the new-behavior pin for the flag, plus
// an end-to-end pin that scripts/first-install-router.cjs's own seed write
// (which this same fix pass wired to pass ignoreOverride: true) survives an
// active override without corrupting ~/.mindrian-user.md.
//
// Hermetic: MINDRIAN_PERSONA_OVERRIDE_PATH always points at a temp file, so
// this test never touches the real ~/.mindrian/persona-override.json.
//
// No em-dashes. Plain node:assert/strict, node built-ins only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { withIsolatedHome, keylessEnv } = require('./test-267-2-helpers.cjs');

const REPO = path.join(__dirname, '..');
const ROUTER_PATH = path.join(REPO, 'scripts', 'first-install-router.cjs');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-267-2-wr-03-ignore-override');

// ============================================================
// Part 1: unit-level -- readUserMd's ignoreOverride option, in-process.
// ============================================================

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), '267-2-wr03-'));
const STORE_PATH = path.join(tmpDir, 'persona-override.json');
process.env.MINDRIAN_PERSONA_OVERRIDE_PATH = STORE_PATH;

const personaOverride = require(path.join(REPO, 'lib', 'core', 'persona-override.cjs'));
const userMdOps = require(path.join(REPO, 'lib', 'core', 'user-md-ops.cjs'));

const USER_MD_PATH = path.join(tmpDir, 'USER.md');
const FIXTURE = [
  '---',
  'canonical_role: researcher',
  'journey_stage: ordinary_world',
  'role_blend:',
  '  researcher: 0.9',
  '  founder: 0.1',
  '---',
  '',
  '# USER.md body (preserved)',
  '',
].join('\n');
fs.writeFileSync(USER_MD_PATH, FIXTURE);

try {
  personaOverride.clearOverride();

  ok('no override active: ignoreOverride:true reads the same real record as the default call', function () {
    const withFlag = userMdOps.readUserMd(USER_MD_PATH, { ignoreOverride: true });
    const withoutFlag = userMdOps.readUserMd(USER_MD_PATH);
    assert.equal(withFlag.canonical_role, 'researcher');
    assert.equal(withoutFlag.canonical_role, 'researcher');
  });

  personaOverride.setOverride({ canonical_role: 'investor', role_blend: { investor: 1.0 } });

  ok('REGRESSION (default behavior unchanged): with an override active, a bare readUserMd() '
    + 'call still returns the synthetic override, ignoring the real file', function () {
    const r = userMdOps.readUserMd(USER_MD_PATH);
    assert.equal(r.canonical_role, 'investor', 'default call must still honor the override');
    assert.equal(r.override_active, true);
  });

  ok('NEW BEHAVIOR (WR-03): with the SAME override active, readUserMd(path, {ignoreOverride:true}) '
    + 'returns the REAL on-disk record instead', function () {
    const r = userMdOps.readUserMd(USER_MD_PATH, { ignoreOverride: true });
    assert.equal(r.canonical_role, 'researcher', 'ignoreOverride:true must read the real file, not the override');
    assert.equal(r.role_blend.researcher, 0.9);
    assert.equal(r.override_active, false, 'ignoreOverride:true must not carry the override_active marker');
  });
} finally {
  personaOverride.clearOverride();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  delete process.env.MINDRIAN_PERSONA_OVERRIDE_PATH;
}

// ============================================================
// Part 2: end-to-end -- the router's own seed write (_seedIdentityFile,
// wired to ignoreOverride:true by this fix pass) survives an active
// persona override without corrupting ~/.mindrian-user.md.
// ============================================================

function callRouter(env, prompt) {
  const res = spawnSync(process.execPath, [ROUTER_PATH], {
    input: JSON.stringify({ prompt: prompt }),
    env: env,
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(res.status, 0, 'router exited non-zero: ' + res.status + ' stderr=' + res.stderr);
}

function readState(home) {
  const p = path.join(home, '.mindrian', 'first-install', 'state.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_e) { return null; }
}

ok('END TO END: the router\'s seed write reaches ~/.mindrian-user.md with the REAL '
  + 'journey_stage/last_detected_at delta while a persona override is active for this session, '
  + 'never the override\'s synthetic shape', function () {
  withIsolatedHome(function (ctx) {
    const overridePath = path.join(ctx.home, 'persona-override.json');
    const env = Object.assign({}, keylessEnv(ctx.env), { MINDRIAN_PERSONA_OVERRIDE_PATH: overridePath });

    // An active override, mirroring setOverride's own written shape
    // (lib/core/persona-override.cjs:129-159), scoped entirely to this
    // isolated HOME's override path.
    fs.writeFileSync(overridePath, JSON.stringify({
      canonical_role: 'investor',
      role_blend: { investor: 1.0 },
      set_at: new Date().toISOString(),
    }));

    const userMdPath = path.join(ctx.home, '.mindrian-user.md');
    let state = null;
    for (let i = 1; i <= 10; i++) {
      callRouter(env, i === 1 ? 'I want to start a new venture' : 'irrelevant follow-up turn');
      state = readState(ctx.home);
      if (state && state.phase === 'investment_asked') break;
    }
    assert.ok(state && state.phase === 'investment_asked',
      'router never reached investment_asked within 10 turns: ' + JSON.stringify(state));

    assert.ok(fs.existsSync(userMdPath), 'router did not seed ~/.mindrian-user.md');
    // Read the real file with the flag so THIS assertion also is not shadowed
    // by the still-active override.
    const written = userMdOps.readUserMd(userMdPath, { ignoreOverride: true });
    assert.ok(written && written.parse_failed === false,
      'seeded ~/.mindrian-user.md did not parse: ' + JSON.stringify(written));
    assert.equal(written.journey_stage, 'ordinary_world',
      'WR-03 REGRESSED: the router seed did not carry journey_stage: ordinary_world into the '
      + 'real file -- either the seed silently wrote the override\'s synthetic shape instead, '
      + 'or it failed outright');
    // The override's canonical_role (investor) must NOT have been persisted into the real
    // file by this seed write -- the seed's delta never carries canonical_role at all, and
    // (before this fix) a bare readUserMd() would have returned the override's canonical_role
    // as "existing", spread it into the merge, and re-persisted it onto the real file.
    assert.notEqual(written.canonical_role, 'investor',
      'WR-03 REGRESSED: the override\'s canonical_role (investor) leaked into the real seeded '
      + 'file -- the seed read the override instead of the real on-disk record');
  });
});

console.log('\nPASS test-267-2-wr-03-ignore-override (' + n + ' assertions)');
