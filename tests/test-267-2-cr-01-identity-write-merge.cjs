'use strict';
// Phase 267.2 code review fix CR-01 (BLOCKER) -- lib/mcp/tools/identity.cjs's
// identity_write handler used to pass its args straight to writeUserMdAtomic
// with no read-first. writeUserMdAtomic's buildFrontmatter does
// Object.assign(emptyUser(), data) -- it does NOT merge with the existing
// on-disk file, so that bare write silently reset every field the CURRENT
// call did not re-supply back to null/empty. Reproduced empirically in
// 267.2-REVIEW.md:
//
//   AFTER SEED:                           journey_stage: "ordinary_world", last_detected_at: "..."
//   AFTER identity_write-style bare write: journey_stage: null,            last_detected_at: null
//
// This clobbered scripts/first-install-router.cjs's own _seedIdentityFile
// seed the moment the model followed the router's own investment-ask prose
// ("call the identity_write MCP tool with it").
//
// Fix: the handler now does the same read-modify-write _seedIdentityFile
// already does -- readUserMd(path, {ignoreOverride:true}) then
// Object.assign({}, existing, data) then writeUserMdAtomic -- plus its OWN
// nested role_blend merge (a partial role_blend in one call must not zero
// out axes an earlier call set).
//
// Isolated HOME throughout (mirrors tests/test-267-2-helpers.cjs's
// withIsolatedHome pattern) so this never touches the real home directory.
//
// No em-dashes. Plain node:assert/strict, node built-ins only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { withIsolatedHome } = require('./test-267-2-helpers.cjs');

const REPO = path.join(__dirname, '..');
const IDENTITY_TOOL_PATH = path.join(REPO, 'lib', 'mcp', 'tools', 'identity.cjs');
const { readUserMd, writeUserMdAtomic } = require(path.join(REPO, 'lib', 'core', 'user-md-ops.cjs'));

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-267-2-cr-01-identity-write-merge');

function stubServer() {
  return {
    tools: new Map(),
    tool(nameArg, description, schema, cb) { this.tools.set(nameArg, { description, schema, cb }); },
  };
}

function registerIdentityWrite(ctx) {
  delete require.cache[require.resolve(IDENTITY_TOOL_PATH)];
  const identityMod = require(IDENTITY_TOOL_PATH);
  const stub = stubServer();
  identityMod.register(stub, ctx || {});
  return stub.tools.get('identity_write').cb;
}

function callHandler(cb, args) {
  const result = cb(args, { sessionId: 'sess-cr01-test' });
  const text = result && result.content && result.content[0] && result.content[0].text;
  return JSON.parse(text);
}

// ============================================================
// Assertion 1: the seed's fields survive a subsequent identity_write call
// that does not re-supply them (the exact router -> identity_write sequence
// this bug broke).
// ============================================================

ok('CR-01 FIXED: a seed write (journey_stage/last_detected_at, the router\'s own delta) '
  + 'survives a subsequent identity_write call that supplies only canonical_role', function () {
  withIsolatedHome(function (ctx) {
    process.env.HOME = ctx.home;
    process.env.USERPROFILE = ctx.home;
    try {
      const userMdPath = path.join(ctx.home, '.mindrian-user.md');

      // Mirror scripts/first-install-router.cjs's _seedIdentityFile seed exactly.
      writeUserMdAtomic(userMdPath, {
        journey_stage: 'ordinary_world',
        last_detected_at: '2026-09-03T12:00:00.000Z',
      });
      const afterSeed = readUserMd(userMdPath);
      assert.equal(afterSeed.journey_stage, 'ordinary_world', 'sanity: seed did not write journey_stage');
      assert.equal(afterSeed.last_detected_at, '2026-09-03T12:00:00.000Z', 'sanity: seed did not write last_detected_at');

      // The router's own investment-ask prose instructs the model to call
      // identity_write with ONLY the fields the user just answered -- here,
      // only canonical_role and a role_blend, exactly as CR-01's repro used.
      const cb = registerIdentityWrite({ fallbackRoomDir: path.join(ctx.home, 'nonexistent-room') });
      const result = callHandler(cb, { canonical_role: 'founder', role_blend: { founder: 0.9 } });
      assert.equal(result.ok, true, 'identity_write returned ok:false: ' + JSON.stringify(result));

      const afterWrite = readUserMd(userMdPath);
      assert.equal(afterWrite.canonical_role, 'founder', 'identity_write did not write canonical_role');
      assert.equal(
        afterWrite.journey_stage,
        'ordinary_world',
        'CR-01 REGRESSED: journey_stage was reset to ' + JSON.stringify(afterWrite.journey_stage)
          + ' by an identity_write call that did not re-supply it -- the handler is doing a bare '
          + 'write again, not a read-modify-write',
      );
      assert.equal(
        afterWrite.last_detected_at,
        '2026-09-03T12:00:00.000Z',
        'CR-01 REGRESSED: last_detected_at was reset by an identity_write call that did not '
          + 're-supply it',
      );
    } finally {
      delete process.env.HOME;
      delete process.env.USERPROFILE;
    }
  });
});

// ============================================================
// Assertion 2: role_blend partial-merge -- a second call's partial
// role_blend must not zero out an axis an earlier call set.
// ============================================================

ok('CR-01 FIXED: role_blend partial merge -- a second identity_write call carrying only '
  + 'role_blend.mentor does not erase role_blend.founder set by an earlier call', function () {
  withIsolatedHome(function (ctx) {
    process.env.HOME = ctx.home;
    process.env.USERPROFILE = ctx.home;
    try {
      const userMdPath = path.join(ctx.home, '.mindrian-user.md');
      const cb = registerIdentityWrite({ fallbackRoomDir: path.join(ctx.home, 'nonexistent-room') });

      const r1 = callHandler(cb, { role_blend: { founder: 0.9 } });
      assert.equal(r1.ok, true, 'first identity_write call returned ok:false: ' + JSON.stringify(r1));
      const afterFirst = readUserMd(userMdPath);
      assert.equal(afterFirst.role_blend.founder, 0.9, 'sanity: first call did not write role_blend.founder');

      const r2 = callHandler(cb, { role_blend: { mentor: 0.5 } });
      assert.equal(r2.ok, true, 'second identity_write call returned ok:false: ' + JSON.stringify(r2));
      const afterSecond = readUserMd(userMdPath);
      assert.equal(
        afterSecond.role_blend.founder,
        0.9,
        'CR-01 REGRESSED: role_blend.founder (set by the first call) was zeroed to '
          + JSON.stringify(afterSecond.role_blend.founder) + ' by a second call that only '
          + 'carried role_blend.mentor -- the nested role_blend merge is missing or broken',
      );
      assert.equal(afterSecond.role_blend.mentor, 0.5, 'the second call\'s own role_blend.mentor did not land');
    } finally {
      delete process.env.HOME;
      delete process.env.USERPROFILE;
    }
  });
});

// ============================================================
// Assertion 3: no room bound, still reachable (does not regress test-270's
// own reachability contract).
// ============================================================

ok('CR-01 fix does not regress the no-room reachability contract (Phase 270 test-270-identity-write.cjs)', function () {
  withIsolatedHome(function (ctx) {
    process.env.HOME = ctx.home;
    process.env.USERPROFILE = ctx.home;
    try {
      const userMdPath = path.join(ctx.home, '.mindrian-user.md');
      assert.ok(!fs.existsSync(path.join(ctx.home, 'ROOM.md')), 'sanity: no room fixture should exist');
      const cb = registerIdentityWrite({ fallbackRoomDir: path.join(ctx.home, 'nonexistent-room') });
      const result = callHandler(cb, { canonical_role: 'venturist' });
      assert.equal(result.ok, true, 'identity_write must remain reachable with no room bound');
      assert.ok(fs.existsSync(userMdPath), 'identity_write did not write the file');
    } finally {
      delete process.env.HOME;
      delete process.env.USERPROFILE;
    }
  });
});

console.log('\nPASS test-267-2-cr-01-identity-write-merge (' + n + ' assertions)');
