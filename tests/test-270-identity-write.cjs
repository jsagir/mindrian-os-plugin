#!/usr/bin/env node
'use strict';

/*
 * Phase 270-04 Task 2 -- pre-room reachability pin for the cross-room
 * identity write.
 *
 * RESEARCH.md 4.3 - the MECHANISM already exists. writeUserMdAtomic
 * (lib/core/user-md-ops.cjs:442) takes an ABSOLUTE path and has zero room
 * coupling; the read side is already wired at lib/core/user-archetype.cjs:64;
 * home-directory atomic writes are precedented at ~20 sites including
 * lib/core/scratchpad-ops.cjs:302-303. What was missing is a CALLER, not a
 * writer. This test pins the caller's reachability contract. RED until plan
 * 270-11.
 *
 * OQ-2 (270-DECISIONS.md, oq2-ship-caller): an MCP tool the model must
 * CHOOSE to call is model-compliance dependent, which is the same fragility
 * Phase 267.2 names about `check-onboard --write`. Making it a tool does not
 * by itself make it deterministic. This test pins the MECHANISM half only;
 * the TRIGGER is Phase 267.2 W2's decision, not this phase's.
 *
 * BRANCH TAKEN: 270-DECISIONS.md's `## OQ-2 ANSWER` is `oq2-ship-caller`, so
 * this file carries all FIVE legs (the ship-caller shape), not the 3-leg
 * defer-whole variant.
 *
 * DEVIATION FROM THE PLAN'S LITERAL EXAMPLE PAYLOAD (recorded here, not
 * silently corrected): the plan's action text illustrates leg 1 with
 * `{ archetype: 'builder', updated: '2026-08-27' }`. lib/core/user-md-ops.cjs
 * ::buildFrontmatter only ever emits the fixed emptyUser() field set
 * (schema_version, user_id, canonical_role, larry_persona, brain_persona,
 * journey_stage, role_blend, problem_type, venture_stage, ...) -- an
 * `archetype` key on the data object would be silently dropped, never
 * appearing in the written file. This test writes the REAL schema field
 * `canonical_role` instead (the closest existing analog to "archetype"), so
 * the assertion tests something the writer actually does.
 *
 * No em-dashes. CJS only. No new deps.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const IDENTITY_TOOL_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'identity.cjs');

const { writeUserMdAtomic } = require(path.join(REPO_ROOT, 'lib', 'core', 'user-md-ops.cjs'));

function stripComments(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock.split('\n').map((line) => line.replace(/\/\/.*$/, '')).join('\n');
}

function makeTmpHome() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '270-home-'));
  return tmp;
}

function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

let passed = 0;
let failed = 0;
function ok(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok - ' + label);
  } catch (e) {
    failed += 1;
    console.log('  FAIL - ' + label);
    console.log('    ' + (e && e.message ? e.message : String(e)));
  }
}

console.log('test-270-identity-write (branch: oq2-ship-caller, 5 legs)');

// Capture the REAL home's marker state BEFORE anything is overridden, so
// leg 5 (the guard on the guard) can prove isolation actually held.
const realHomeDir = os.homedir();
const realMarkerPath = path.join(realHomeDir, '.mindrian-user.md');
const realOnboardedPath = path.join(realHomeDir, '.mindrian-onboarded');
const markerExistedBefore = fs.existsSync(realMarkerPath);
const markerMtimeBefore = markerExistedBefore ? fs.statSync(realMarkerPath).mtimeMs : null;
const onboardedExistedBefore = fs.existsSync(realOnboardedPath);
const onboardedMtimeBefore = onboardedExistedBefore ? fs.statSync(realOnboardedPath).mtimeMs : null;

const tmpHome = makeTmpHome();
const savedHome = process.env.HOME;
const savedUserProfile = process.env.USERPROFILE;
process.env.HOME = tmpHome;
process.env.USERPROFILE = tmpHome;

try {
  const userMdPath = path.join(tmpHome, '.mindrian-user.md');

  // -------------------------------------------------------------------
  // Leg 1 (GREEN today): the mechanism itself, no room anywhere.
  // -------------------------------------------------------------------
  ok('mechanism: writeUserMdAtomic writes an absolute home path with no room anywhere', function () {
    assert.ok(!fs.existsSync(path.join(tmpHome, 'ROOM.md')), 'sanity: no room fixture should exist under tmpHome');
    writeUserMdAtomic(userMdPath, { canonical_role: 'builder' });
    assert.ok(fs.existsSync(userMdPath), 'writeUserMdAtomic did not create the file');
    const content = fs.readFileSync(userMdPath, 'utf8');
    assert.ok(/^---\r?\n[\s\S]*?\r?\n---/.test(content), 'file does not parse as frontmatter markdown');
    assert.ok(content.indexOf('canonical_role') !== -1, 'frontmatter is missing canonical_role');
    assert.ok(content.indexOf('builder') !== -1, 'frontmatter does not carry the written value');
  });

  // -------------------------------------------------------------------
  // Leg 2 (GREEN today): body preservation across a second write. This is
  // why the phase must not hand-roll a writer (Don't Hand-Roll table row 4).
  // -------------------------------------------------------------------
  ok('mechanism: a user-authored body below the frontmatter survives a second write', function () {
    const before = fs.readFileSync(userMdPath, 'utf8');
    const withUserBody = before + '\nUSER-AUTHORED-KEEPME: a paragraph the user wrote by hand.\n';
    fs.writeFileSync(userMdPath, withUserBody);

    writeUserMdAtomic(userMdPath, { canonical_role: 'researcher' });

    const after = fs.readFileSync(userMdPath, 'utf8');
    assert.ok(after.indexOf('USER-AUTHORED-KEEPME') !== -1, 'user-authored body was lost across the second write');
    assert.ok(after.indexOf('researcher') !== -1, 'the new write data did not land');
  });

  // -------------------------------------------------------------------
  // Leg 3 (RED until plan 270-11): the caller must be reachable with no
  // room bound at all.
  // -------------------------------------------------------------------
  ok('caller: the identity tool handler is reachable with NO room bound', function () {
    let identityMod;
    try {
      identityMod = require(IDENTITY_TOOL_PATH);
    } catch (e) {
      throw new Error('lib/mcp/tools/identity.cjs does not exist yet (plan 270-11) - RED by design. (' + (e && e.code ? e.code : 'module unavailable') + ')');
    }
    const stub = {
      tools: new Map(),
      tool(name, description, schema, cb) { this.tools.set(name, { description, schema, cb }); },
    };
    const ctx = { fallbackRoomDir: path.join(tmpHome, 'nonexistent-room'), pluginRoot: REPO_ROOT, surface: 'cli' };
    identityMod.register(stub, ctx);

    const reg = stub.tools.get('identity_write');
    assert.ok(reg, 'identity_write tool was not registered');

    const result = reg.cb({ canonical_role: 'venturist' }, { sessionId: 'sess-270-id' });
    const text = (result && result.content && result.content[0] && result.content[0].text) || JSON.stringify(result);
    assert.ok(text.indexOf('no_room_db') === -1, 'identity_write refused with no_room_db -- it must be reachable with no room');
    assert.ok(text.indexOf('ok":false') === -1, 'identity_write returned ok:false with no room bound');
    assert.ok(fs.existsSync(userMdPath), 'identity_write did not actually write ~/.mindrian-user.md');
    const written = fs.readFileSync(userMdPath, 'utf8');
    assert.ok(written.indexOf('venturist') !== -1, 'the payload data did not reach the file');
  });

  // -------------------------------------------------------------------
  // Leg 4 (RED until plan 270-11): the handler must be deliberately
  // non-room-scoped in its SOURCE, not merely by accident of test setup.
  // -------------------------------------------------------------------
  ok('caller: the identity handler never resolves a session room', function () {
    if (!fs.existsSync(IDENTITY_TOOL_PATH)) {
      throw new Error('lib/mcp/tools/identity.cjs does not exist yet (plan 270-11) - RED by design.');
    }
    const src = stripComments(fs.readFileSync(IDENTITY_TOOL_PATH, 'utf8'));
    assert.equal(src.indexOf('resolveSessionRoomDir('), -1,
      'identity.cjs must never resolve a session room -- RESEARCH.md 4.3: this is the one memory ' +
      'capability that must be reachable when no room exists');
    assert.equal(src.indexOf('openRoomDbForCaller('), -1,
      'identity.cjs must never open a room db -- it is deliberately non-room-scoped');

    const identityMod = require(IDENTITY_TOOL_PATH);
    assert.ok(Array.isArray(identityMod.connectors), 'identity.cjs must export a connectors array');
    const entry = identityMod.connectors.find((c) => c.tool === 'identity_write');
    assert.ok(entry, 'connectors export must declare identity_write');
    assert.equal(entry.hitl_shape, 'F.1', 'identity_write must declare hitl_shape F.1 (OQ-3 disposition: declare regardless of R16 mandate)');
    assert.ok(typeof entry.hitl_why === 'string' && entry.hitl_why.length > 0, 'identity_write must carry a non-empty hitl_why');
  });
} finally {
  process.env.HOME = savedHome;
  process.env.USERPROFILE = savedUserProfile;
}

// -------------------------------------------------------------------
// Leg 5 (GREEN, the guard on the guard): runs AFTER HOME is restored, so
// it reads the REAL filesystem, not the isolated fixture.
// -------------------------------------------------------------------
ok('isolation: the live ~/.mindrian-user.md and ~/.mindrian-onboarded were never touched', function () {
  const markerExistsNow = fs.existsSync(realMarkerPath);
  assert.equal(markerExistsNow, markerExistedBefore, 'real ~/.mindrian-user.md existence flag changed');
  if (markerExistedBefore) {
    const mtimeNow = fs.statSync(realMarkerPath).mtimeMs;
    assert.equal(mtimeNow, markerMtimeBefore, 'real ~/.mindrian-user.md mtime changed -- the isolation leaked');
  }
  const onboardedExistsNow = fs.existsSync(realOnboardedPath);
  assert.equal(onboardedExistsNow, onboardedExistedBefore, 'real ~/.mindrian-onboarded existence flag changed');
  if (onboardedExistedBefore) {
    const mtimeNow = fs.statSync(realOnboardedPath).mtimeMs;
    assert.equal(mtimeNow, onboardedMtimeBefore, 'real ~/.mindrian-onboarded mtime changed -- the isolation leaked');
  }
});

cleanupDir(tmpHome);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
