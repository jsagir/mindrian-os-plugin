#!/usr/bin/env node
'use strict';
/*
 * tests/test-rooms-open-actually-switches.cjs
 *
 * Regression test for RCA rooms-open-false-success (2026-07-27).
 *
 * THE POINT OF THIS TEST: it asserts GROUND TRUTH, not response shape.
 *
 * The bug it guards against was not "the response looked wrong". The response
 * looked perfect -- a full Room State payload with the correct target room in
 * its footer. The bug was that `bash scripts/room-registry get-active` still
 * returned the PREVIOUS room afterwards. A test that inspected the response
 * would have passed while the product was broken. So every assertion here
 * re-reads the registry off disk through the same script a human would run.
 *
 * Hermetic: every case runs against a mkdtemp MINDRIAN_ROOMS_HOME. Nothing
 * touches the developer's real ~/MindrianRooms.
 *
 * Run: node tests/test-rooms-open-actually-switches.cjs
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const child_process = require('node:child_process');

const REPO = path.join(__dirname, '..');
const REGISTRY_SCRIPT = path.join(REPO, 'scripts', 'room-registry');
const { openRoom } = require(path.join(REPO, 'lib', 'core', 'room-open.cjs'));

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS  ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL  ' + name);
    console.log('        ' + (e && e.message ? e.message : String(e)));
  }
}

/**
 * GROUND TRUTH READER. Deliberately shells out to the same script a human runs,
 * rather than reading registry.json in-process -- an in-process read would share
 * whatever assumption the code under test makes.
 */
function groundTruthActive(home) {
  const out = child_process.execFileSync('bash', [REGISTRY_SCRIPT, 'get-active'], {
    env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: home }),
    stdio: 'pipe',
    encoding: 'utf8',
  });
  return out.trim();
}

/** Build a hermetic rooms home with the given rooms and active slug. */
function makeHome(rooms, active) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-rooms-open-'));
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  const reg = { active: active || '', rooms: {} };
  for (const [slug, over] of Object.entries(rooms)) {
    fs.mkdirSync(path.join(home, slug), { recursive: true });
    reg.rooms[slug] = Object.assign({
      path: slug,
      venture_name: slug,
      venture_stage: 'Design',
      status: slug === active ? 'active' : 'parked',
      created: '2026-01-01T00:00:00Z',
      last_opened: '2026-01-01T00:00:00Z',
    }, over || {});
  }
  fs.writeFileSync(path.join(home, '.rooms', 'registry.json'), JSON.stringify(reg, null, 2));
  return home;
}

function cleanup(home) {
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) {}
}

console.log('\nRCA rooms-open-false-success -- rooms-open must actually switch the active room\n');

// -------------------------------------------------------------------------
// T1: THE REGRESSION. The exact live 2026-07-22 shape: active room is A, ask
// for B, and the registry must really say B afterwards.
// -------------------------------------------------------------------------
check('T1 openRoom actually changes get-active ground truth (the regression)', () => {
  const home = makeHome({ 'iia-deeptech-centers': {}, 'rethinking-mindrianos': {} }, 'iia-deeptech-centers');
  try {
    assert.strictEqual(groundTruthActive(home), 'iia-deeptech-centers', 'precondition: A is active');

    const res = openRoom({ room: 'rethinking-mindrianos', home: home });

    // The whole bug in one assertion: the registry, re-read off disk.
    assert.strictEqual(
      groundTruthActive(home),
      'rethinking-mindrianos',
      'GROUND TRUTH: get-active must return the switched room, not the previous one'
    );
    assert.strictEqual(res.ok, true, 'result reports ok');
    assert.strictEqual(res.active, 'rethinking-mindrianos', 'result.active is the verified read-back');
    assert.strictEqual(res.previous, 'iia-deeptech-centers', 'result records the previous room');
  } finally {
    cleanup(home);
  }
});

// -------------------------------------------------------------------------
// T2: ok:true is GATED on the read-back, not merely on having called set-active.
// Simulated by pointing at a home whose registry lists the room but whose
// script write cannot land (registry dir made read-only). The contract under
// test: never report success when ground truth disagrees.
// -------------------------------------------------------------------------
check('T2 a failed write never yields ok:true', () => {
  const home = makeHome({ alpha: {}, beta: {} }, 'alpha');
  try {
    const regDir = path.join(home, '.rooms');
    fs.chmodSync(regDir, 0o500); // block the tmp+rename inside set-active
    let res;
    try {
      res = openRoom({ room: 'beta', home: home });
    } finally {
      fs.chmodSync(regDir, 0o700);
    }
    assert.strictEqual(res.ok, false, 'must not claim success when the write could not land');
    assert.ok(
      res.reason === 'set_active_failed' || res.reason === 'verify_failed',
      'reason names the write/verify failure, got: ' + res.reason
    );
    assert.strictEqual(groundTruthActive(home), 'alpha', 'ground truth is unchanged');
  } finally {
    cleanup(home);
  }
});

// -------------------------------------------------------------------------
// T3: unknown room is refused, and refused BEFORE touching the registry.
// -------------------------------------------------------------------------
check('T3 unknown room returns room_not_found and leaves active untouched', () => {
  const home = makeHome({ alpha: {} }, 'alpha');
  try {
    const res = openRoom({ room: 'does-not-exist', home: home });
    assert.strictEqual(res.ok, false, 'unknown room is not a success');
    assert.strictEqual(res.reason, 'room_not_found');
    assert.strictEqual(groundTruthActive(home), 'alpha', 'active room untouched');
  } finally {
    cleanup(home);
  }
});

// -------------------------------------------------------------------------
// T4: the archived-room HUMAN GATE (commands/rooms.md open, Step 2) survives.
// Fixing a false-success bug must not introduce a gate-skip bug.
// -------------------------------------------------------------------------
check('T4 archived room refuses without confirmation, proceeds with it', () => {
  const home = makeHome({ alpha: {}, oldroom: { status: 'archived' } }, 'alpha');
  try {
    const refused = openRoom({ room: 'oldroom', home: home });
    assert.strictEqual(refused.ok, false, 'archived room is refused by default');
    assert.strictEqual(refused.reason, 'archived_needs_confirmation');
    assert.strictEqual(groundTruthActive(home), 'alpha', 'nothing switched while the gate held');

    const confirmed = openRoom({ room: 'oldroom', home: home, confirmArchived: true });
    assert.strictEqual(confirmed.ok, true, 'explicit human confirmation permits the switch');
    assert.strictEqual(groundTruthActive(home), 'oldroom', 'GROUND TRUTH: confirmed switch landed');
  } finally {
    cleanup(home);
  }
});

// -------------------------------------------------------------------------
// T5: empty / invalid input is refused rather than silently no-op'd.
// -------------------------------------------------------------------------
check('T5 missing and traversal-shaped room args are refused', () => {
  const home = makeHome({ alpha: {} }, 'alpha');
  try {
    assert.strictEqual(openRoom({ home: home }).reason, 'no_room_specified');
    assert.strictEqual(openRoom({ room: '   ', home: home }).reason, 'no_room_specified');
    const traversal = openRoom({ room: '../escape', home: home });
    assert.strictEqual(traversal.ok, false, 'traversal slug refused');
    assert.strictEqual(groundTruthActive(home), 'alpha', 'active room untouched');
  } finally {
    cleanup(home);
  }
});

// -------------------------------------------------------------------------
// T6: the session binding is written too, so write-scope-check.cjs Leg A
// (session bound-set membership) authorizes this session without depending on
// the raceable global reg.active field.
// -------------------------------------------------------------------------
check('T6 a switch also binds the session (write-scope-check Leg A)', () => {
  const home = makeHome({ alpha: {}, beta: {} }, 'alpha');
  const prevSid = process.env.CLAUDE_CODE_SESSION_ID;
  try {
    const sid = 'test-session-rooms-open';
    const res = openRoom({ room: 'beta', home: home, sessionId: sid });
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.session_bound, true, 'binding reported written');

    const sb = require(path.join(REPO, 'lib', 'core', 'session-binding.cjs'));
    const binding = sb.readSessionBinding(sid, { home: home });
    assert.ok(binding, 'a binding file exists for this session');
    assert.strictEqual(binding.primary, 'beta', 'session primary is the switched room');
    assert.ok(sb.isRoomInWriteScope('beta', binding), 'switched room is in the session write scope');
  } finally {
    if (prevSid === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
    else process.env.CLAUDE_CODE_SESSION_ID = prevSid;
    cleanup(home);
  }
});

// -------------------------------------------------------------------------
// T7: STRUCTURAL TRIPWIRE. rooms-open must never again be a declared command
// with no executing handler, and no state-mutating orchestration command may
// carry a completion assertion it cannot back up.
// -------------------------------------------------------------------------
check('T7 structural: rooms-open executes and mutating siblings cannot claim completion', () => {
  const src = fs.readFileSync(path.join(REPO, 'lib', 'mcp', 'tool-router.cjs'), 'utf8');

  assert.ok(
    /command === 'rooms-open'/.test(src),
    'rooms-open must have an executing branch, not fall through to the reference-echo fallback'
  );
  assert.ok(
    /require\('\.\.\/core\/room-open\.cjs'\)/.test(src),
    'rooms-open must route through the lib/core/room-open.cjs chokepoint (Canon Part 7), not a second inline guesser'
  );
  assert.ok(
    /UNIMPLEMENTED_MUTATING_ORCHESTRATION/.test(src),
    'the unimplemented-mutating containment set must exist'
  );
  for (const cmd of ['rooms-new', 'rooms-close', 'rooms-archive']) {
    assert.ok(
      new RegExp("'" + cmd + "'").test(src.slice(src.indexOf('UNIMPLEMENTED_MUTATING_ORCHESTRATION'), src.indexOf('UNIMPLEMENTED_MUTATING_ORCHESTRATION') + 1200)),
      cmd + ' must be declared as unimplemented-mutating until it has an executing handler'
    );
  }
  assert.ok(
    /NOT EXECUTED/.test(src),
    'unimplemented mutating commands must carry an explicit NOT EXECUTED banner'
  );

  // No product .cjs may set the active room outside the chokepoint (the
  // "four guessers" lesson: one writer, or the drift comes back).
  const roomOpen = fs.readFileSync(path.join(REPO, 'lib', 'core', 'room-open.cjs'), 'utf8');
  assert.ok(
    /'set-active'/.test(roomOpen),
    'the chokepoint wraps the authoritative room-registry set-active writer'
  );
  assert.ok(
    /getActive\(roomsHome\)[\s\S]{0,400}active !== room/.test(roomOpen),
    'ok:true must be gated behind a post-write read-back comparison'
  );
});

// -------------------------------------------------------------------------
// END-TO-END through the actual MCP tool handler.
//
// T1-T6 prove the chokepoint is correct. These prove the `orchestration` tool
// is actually WIRED to it -- the gap that produced this bug in the first place
// was never a broken function, it was a command with no handler at all. Uses
// the same fake-McpServer harness as tests/test-tool-router-active-room-misroute.cjs.
// -------------------------------------------------------------------------
function makeFakeServer() {
  const tools = {};
  return { tools, tool(name, _desc, _schema, handler) { tools[name] = handler; } };
}

function orchestrationHandler(bootRoomDir) {
  const router = require(path.join(REPO, 'lib', 'mcp', 'tool-router.cjs'));
  const server = makeFakeServer();
  router.registerRouterTools(server, bootRoomDir, REPO, {}, 'cli');
  assert.ok(server.tools.orchestration, 'orchestration tool registered');
  return server.tools.orchestration;
}

function textOf(res) {
  return (res && res.content && res.content[0] && res.content[0].text) || '';
}

async function runAsyncChecks() {
  const cases = [];

  cases.push(['T8 orchestration rooms-open moves ground truth end to end', async () => {
    const home = makeHome({ alpha: {}, beta: {} }, 'alpha');
    const prevHome = process.env.MINDRIAN_ROOMS_HOME;
    try {
      process.env.MINDRIAN_ROOMS_HOME = home;
      // Boot roomDir deliberately points at alpha, mimicking the frozen-closure
      // condition that made the old payload show the WRONG room's STATE.md.
      const handler = orchestrationHandler(path.join(home, 'alpha'));
      const res = await handler({ command: 'rooms-open', room: 'beta' }, {});

      assert.strictEqual(
        groundTruthActive(home), 'beta',
        'GROUND TRUTH: the MCP tool call must actually switch the active room'
      );
      assert.ok(!res.isError, 'a verified switch is not an error response');
      assert.ok(/Switched to: beta/.test(textOf(res)), 'response reports the verified switch');
    } finally {
      if (prevHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
      else process.env.MINDRIAN_ROOMS_HOME = prevHome;
      cleanup(home);
    }
  }]);

  cases.push(['T9 orchestration rooms-open on an unknown room returns an ERROR, not a plausible payload', async () => {
    const home = makeHome({ alpha: {} }, 'alpha');
    const prevHome = process.env.MINDRIAN_ROOMS_HOME;
    try {
      process.env.MINDRIAN_ROOMS_HOME = home;
      const handler = orchestrationHandler(path.join(home, 'alpha'));
      const res = await handler({ command: 'rooms-open', room: 'ghost-room' }, {});
      const text = textOf(res);

      assert.strictEqual(res.isError, true, 'failure must be flagged as an error response');
      assert.ok(/FAILED/.test(text), 'response says FAILED out loud');
      assert.ok(/room_not_found/.test(text), 'response names the machine-readable reason');
      // The precise false-success shape this RCA exists to kill: a bare echo of
      // the requested room under a heading that reads like a confirmation.
      assert.ok(
        !/### Target Room/.test(text),
        'a failed switch must never echo the requested room as a confirmation-shaped footer'
      );
      assert.strictEqual(groundTruthActive(home), 'alpha', 'ground truth unchanged');
    } finally {
      if (prevHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
      else process.env.MINDRIAN_ROOMS_HOME = prevHome;
      cleanup(home);
    }
  }]);

  cases.push(['T10 unimplemented mutating siblings say NOT EXECUTED instead of claiming completion', async () => {
    const home = makeHome({ alpha: {} }, 'alpha');
    const prevHome = process.env.MINDRIAN_ROOMS_HOME;
    try {
      process.env.MINDRIAN_ROOMS_HOME = home;
      const handler = orchestrationHandler(path.join(home, 'alpha'));
      for (const cmd of ['rooms-new', 'rooms-close', 'rooms-archive']) {
        const text = textOf(await handler({ command: cmd, room: 'whatever' }, {}));
        assert.ok(/NOT EXECUTED/.test(text), cmd + ' must carry the NOT EXECUTED banner');
        assert.ok(
          !/Room operation complete/.test(text),
          cmd + ' must not assert a completed operation it never performed'
        );
      }
    } finally {
      if (prevHome === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
      else process.env.MINDRIAN_ROOMS_HOME = prevHome;
      cleanup(home);
    }
  }]);

  for (const [name, fn] of cases) {
    try {
      await fn();
      passed++;
      console.log('  PASS  ' + name);
    } catch (e) {
      failed++;
      console.log('  FAIL  ' + name);
      console.log('        ' + (e && e.message ? e.message : String(e)));
    }
  }
}

runAsyncChecks().then(() => {
  console.log('\n' + (failed === 0 ? 'ALL PASS' : 'FAILURES') + ': ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
});
