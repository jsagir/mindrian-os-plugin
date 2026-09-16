'use strict';
/*
 * tests/test-348-mcp-flag.cjs -- Phase 348-06 (SUPER-06 / SUPER-07).
 *
 * Proves `contradiction_check`'s new `include_superseded` optional boolean:
 * the round trip on a real fixture holding one superseded pair, the
 * omission floor (byte-identical to the pre-plan two-argument call), the
 * zod wire rejection of a non-boolean, the explicit snake-to-camel mapping
 * (so the flag cannot be a no-op that looks like it works), the scoped
 * no-write source scan, and the SUPER-05 OPT-IN declaration comment.
 *
 * House test idiom: node:assert/strict, an `ok(desc, fn)` counter, fixtures
 * from tests/helpers/fixture-room-348.cjs, a stub MCP server object that
 * captures registered tools (the same fakeMcpServer/registerAndGet idiom
 * tests/test-c8j-suggest-next-offer.cjs already established for this exact
 * module), final line '>>> test-348-mcp-flag.cjs: PASSED'.
 *
 * ok(desc, fn) awaits fn -- several assertions here drive the REAL async
 * contradiction_check handler, so the counter must not race ahead of a
 * still-pending promise the way a synchronous-only ok() would.
 *
 * No em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { z } = require('zod');

const {
  buildSupersessionFixtureRoom,
  closeSupersessionFixtureRoom,
} = require('./helpers/fixture-room-348.cjs');
const navigation = require('../lib/core/navigation.cjs');

const REPO = path.join(__dirname, '..');
const SENSORS_REL = 'lib/mcp/tools/sensors.cjs';
const SENSORS_ABS = path.join(REPO, SENSORS_REL);

let n = 0;
async function ok(desc, fn) {
  await fn();
  n += 1;
  console.log('  ok ' + n + ' - ' + desc);
}

// ---------------------------------------------------------------------------
// Stub MCP server: same idiom tests/test-c8j-suggest-next-offer.cjs already
// established for THIS module (register() -> server.tool(name, desc, schema,
// handler)). Captures the schema object too, so the zod-wire assertion can
// drive the REAL registered schema rather than re-typing it.
// ---------------------------------------------------------------------------
function fakeMcpServer() {
  const registered = [];
  return {
    registered,
    server: {
      tool(name, _desc, schemaOrHandler, maybeHandler) {
        const handler = typeof maybeHandler === 'function' ? maybeHandler : schemaOrHandler;
        const schema = typeof maybeHandler === 'function' ? schemaOrHandler : {};
        registered.push({ name: name, schema: schema, handler: handler });
      },
      server: { getClientCapabilities() { return {}; } },
    },
  };
}

function registerAndGet(toolName, roomDir) {
  delete require.cache[SENSORS_ABS];
  const sensorsTool = require(SENSORS_ABS);
  const fake = fakeMcpServer();
  sensorsTool.register(fake.server, { fallbackRoomDir: roomDir });
  const entry = fake.registered.find((r) => r.name === toolName);
  assert.ok(entry, toolName + ' must register through the REAL register()');
  return entry;
}

// Scoped extraction of the contradiction_check handler body, comment-
// stripped: the SAME boundary this plan's own acceptance criteria use
// (indexOf the tool name literal through the NEXT tool's literal).
function contradictionCheckBody(src) {
  const i = src.indexOf("'contradiction_check'");
  assert.ok(i !== -1, "'contradiction_check' must exist in " + SENSORS_REL);
  const j = src.indexOf('whitespace_scan', i);
  assert.ok(j !== -1, "'whitespace_scan' must exist after contradiction_check in " + SENSORS_REL);
  return src.slice(i, j)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

// Precise, word-bounded patterns rather than the plan's own illustrative
// bare-substring list (['INSERT','UPDATE ','DELETE','logEvent','writeEdge',
// 'promoteNodeStatus','supersede']). A bare substring scan for 'supersede'
// false-positives on this SAME task's own required schema key
// (include_superseded, which contains lowercase 'supersede' as a substring:
// include_[supersede]d) and its describe() string -- both landed by this
// very task inside the exact body window the scan reads. This mirrors the
// 348-05 precedent (docs comment in tests/test-348-validity-window.cjs):
// when a plan's own illustrative scan produces a false positive against the
// plan's own required addition, replace it with a precise pattern and name
// the substitution here rather than gaming the test or weakening the claim.
// A real write call is still caught: \bsupersede\s*\( matches the imported
// function's CALL syntax (supersede(db, ...)), which 'include_superseded'
// (an identifier, never followed by '(') cannot produce.
const NO_WRITE_PATTERNS = [
  { label: 'INSERT', re: /\bINSERT\b/ },
  { label: 'UPDATE ', re: /\bUPDATE\s/ },
  { label: 'DELETE', re: /\bDELETE\b/ },
  { label: 'logEvent', re: /\blogEvent\s*\(/ },
  { label: 'writeEdge', re: /\bwriteEdge\s*\(/ },
  { label: 'promoteNodeStatus', re: /\bpromoteNodeStatus\s*\(/ },
  { label: 'supersede(', re: /\bsupersede\s*\(/ },
];

function assertNoWrite(body, label) {
  for (const bad of NO_WRITE_PATTERNS) {
    assert.ok(!bad.re.test(body), label + ': must not contain ' + bad.label);
  }
  assert.ok(
    body.indexOf("require('../../core/temporal/") === -1 && body.indexOf('require("../../core/temporal/') === -1,
    label + ': must not require lib/core/temporal/'
  );
}

async function main() {
  console.log('test-348-mcp-flag (SUPER-06 / SUPER-07)');

  // =========================================================================
  // Group 1 (Task 1, SUPER-06): the flag itself.
  // =========================================================================

  await ok('the schema gains exactly one new key, include_superseded, typed boolean-optional; node_id is unchanged', async function () {
    const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
    try {
      const entry = registerAndGet('contradiction_check', fx.roomDir);
      const keys = Object.keys(entry.schema).sort();
      assert.deepEqual(keys, ['include_superseded', 'node_id'], 'schema must carry exactly node_id and include_superseded');
      const shape = z.object(entry.schema);
      assert.equal(shape.safeParse({ node_id: fx.claimAId, include_superseded: true }).success, true);
    } finally {
      closeSupersessionFixtureRoom(fx);
    }
  });

  await ok('a non-boolean include_superseded is rejected at the wire by zod, before the handler runs', async function () {
    const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
    try {
      const entry = registerAndGet('contradiction_check', fx.roomDir);
      const shape = z.object(entry.schema);
      const bad = shape.safeParse({ node_id: fx.claimAId, include_superseded: 'yes' });
      assert.equal(bad.success, false, 'a string include_superseded must fail zod validation');
      const good = shape.safeParse({ node_id: fx.claimAId });
      assert.equal(good.success, true, 'an omitted include_superseded must still validate');
    } finally {
      closeSupersessionFixtureRoom(fx);
    }
  });

  await ok('an omitted include_superseded reproduces the pre-plan two-argument findContradictions call, byte for byte', async function () {
    const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
    try {
      navigation.promoteNodeStatus(
        fx.db, fx.claimBId, 'confirmed', 'superseded', 'navigator', 'mcp-flag-omission-floor',
        { invalidatedAt: 1, validTo: 2 }
      );
      // The snapshot: what the PRE-PLAN handler called (findContradictions
      // with only two arguments), captured independently of the MCP call
      // below.
      const preplanEquivalent = navigation.findContradictions(fx.db, fx.claimAId);

      const entry = registerAndGet('contradiction_check', fx.roomDir);
      const res = await entry.handler({ node_id: fx.claimAId }, {});
      const payload = JSON.parse(res.content[0].text);

      assert.equal(payload.ok, true);
      assert.equal(
        JSON.stringify(payload.contradictions),
        JSON.stringify(preplanEquivalent),
        'an omitted flag must reproduce the pre-plan two-argument response byte for byte'
      );
    } finally {
      closeSupersessionFixtureRoom(fx);
    }
  });

  await ok('include_superseded:true returns the superseded pair; false and omitted both return zero pairs', async function () {
    const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
    try {
      navigation.promoteNodeStatus(
        fx.db, fx.claimBId, 'confirmed', 'superseded', 'navigator', 'mcp-flag-round-trip',
        { invalidatedAt: 1, validTo: 2 }
      );
      const entry = registerAndGet('contradiction_check', fx.roomDir);

      const withTrue = JSON.parse((await entry.handler({ node_id: fx.claimAId, include_superseded: true }, {})).content[0].text);
      const withFalse = JSON.parse((await entry.handler({ node_id: fx.claimAId, include_superseded: false }, {})).content[0].text);
      const withOmitted = JSON.parse((await entry.handler({ node_id: fx.claimAId }, {})).content[0].text);

      assert.equal(withTrue.contradictions.length, 1, 'include_superseded:true must return the one superseded pair');
      assert.equal(withFalse.contradictions.length, 0, 'include_superseded:false must exclude it');
      assert.equal(withOmitted.contradictions.length, 0, 'an omitted flag must exclude it (same as false)');
    } finally {
      closeSupersessionFixtureRoom(fx);
    }
  });

  await ok('the response shape is unchanged apart from the contradictions array contents', async function () {
    const fx = buildSupersessionFixtureRoom({ variant: 'wide' });
    try {
      const entry = registerAndGet('contradiction_check', fx.roomDir);
      const withFocus = JSON.parse((await entry.handler({ node_id: fx.claimAId }, {})).content[0].text);
      assert.deepEqual(Object.keys(withFocus).sort(), ['contradictions', 'focus_node_id', 'ok', 'room_dir'].sort());
    } finally {
      closeSupersessionFixtureRoom(fx);
    }

    const noFocusFx = buildSupersessionFixtureRoom({ variant: 'wide' });
    try {
      const emptyRoomEntry = registerAndGet('contradiction_check', noFocusFx.roomDir);
      // No node_id and no session focus set -> the no-focus path.
      const noFocus = JSON.parse((await emptyRoomEntry.handler({}, {})).content[0].text);
      assert.deepEqual(Object.keys(noFocus).sort(), ['contradictions', 'note', 'ok', 'room_dir'].sort());
      assert.equal(noFocus.note, 'No focus node. Pass node_id, or set a session focus first.');
    } finally {
      closeSupersessionFixtureRoom(noFocusFx);
    }
  });

  await ok('the handler maps include_superseded to includeSuperseded explicitly, not a snake_case forward', async function () {
    const src = fs.readFileSync(SENSORS_ABS, 'utf8');
    const body = contradictionCheckBody(src);
    assert.ok(
      /includeSuperseded\s*:\s*include_superseded\s*===\s*true/.test(body),
      'the handler body must map include_superseded to includeSuperseded via a strict === true comparison'
    );
    const countSnake = (src.match(/include_superseded/g) || []).length;
    const countCamel = (src.match(/includeSuperseded/g) || []).length;
    assert.ok(countSnake >= 3, 'include_superseded must appear at least 3 times (schema key, destructure, mapping). Measured: ' + countSnake);
    assert.equal(countCamel, 1, 'includeSuperseded must appear exactly once. Measured: ' + countCamel);
  });

  await ok('the tool performs no write of any kind (scoped, comment-stripped source scan)', async function () {
    const src = fs.readFileSync(SENSORS_ABS, 'utf8');
    const body = contradictionCheckBody(src);
    assertNoWrite(body, 'contradiction_check handler body');
  });

  await ok('the SUPER-05 OPT-IN declaration comment names this caller as the one that opts in', async function () {
    const src = fs.readFileSync(SENSORS_ABS, 'utf8');
    const superFiveCount = (src.match(/SUPER-05/g) || []).length;
    assert.equal(superFiveCount, 1, 'SUPER-05 must appear exactly once in ' + SENSORS_REL + '. Measured: ' + superFiveCount);
    const i = src.indexOf('SUPER-05');
    const line = src.slice(src.lastIndexOf('\n', i) + 1, src.indexOf('\n', i));
    assert.ok(line.indexOf('OPT-IN') !== -1, 'the SUPER-05 line must also carry the literal token OPT-IN. Measured line: ' + line);
  });

  await ok("the tool's declared hitl_why is byte-unchanged: still a pure read with no fork", async function () {
    const src = fs.readFileSync(SENSORS_ABS, 'utf8');
    assert.ok(
      src.indexOf("hitl_why: 'Pure read: navigation.cjs findContradictions through the chokepoint, no fork.'") !== -1,
      'contradiction_check hitl_why must be byte-identical to its pre-plan value'
    );
  });

  await ok('the caller matrix now reports sensors.cjs as OPT-IN, not PENDING', async function () {
    const out = execFileSync('node', [path.join(REPO, 'tests', 'test-348-caller-matrix.cjs')], { cwd: REPO, encoding: 'utf8' });
    assert.ok(
      out.indexOf('lib/mcp/tools/sensors.cjs | OPT-IN') !== -1,
      'test-348-caller-matrix.cjs must print the sensors.cjs row as OPT-IN. Measured output tail: ' + out.slice(-600)
    );
  });

  await ok('zero em-dashes in this test file and in sensors.cjs', async function () {
    const emdash = Buffer.from([0xe2, 0x80, 0x94]).toString('utf8');
    const testSrc = fs.readFileSync(__filename, 'utf8');
    const sensorsSrc = fs.readFileSync(SENSORS_ABS, 'utf8');
    assert.ok(testSrc.indexOf(emdash) === -1, 'this test file must contain zero em-dashes');
    assert.ok(sensorsSrc.indexOf(emdash) === -1, 'sensors.cjs must contain zero em-dashes');
  });

  console.log('');
  console.log(n + ' assertions passed.');
  console.log('>>> test-348-mcp-flag.cjs: PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
