#!/usr/bin/env node
'use strict';

/**
 * Phase 254 Plan 05 (COMP-02) -- the ambiguous-verdict disclosure suite.
 * ==========================================================================
 * D-02 locked Option A: an `ambiguous` Part 8 verdict on the server-side
 * `callTool` path is DISCLOSED to the caller (a typed, additive
 * `egress_disclosure` field) and the call still PROCEEDS. Option B
 * (fail-closed on ambiguous) is explicitly rejected for this phase.
 *
 * Modelled on tests/test-239-query-egress-canary.cjs's leg structure and
 * canary-token discipline (254-05-PLAN.md Task 1 read_first): a hand-rolled
 * record()/failed-counter runner over the real loopback capture server, not
 * node:test (tests/run-all-254.sh's own header: "this phase's suites use a
 * small local assert-based harness, not node:test").
 *
 * Every arm runs against tests/helpers/brain-capture-server.cjs. No live
 * Brain, no network beyond 127.0.0.1.
 *
 * Wrapper choice (recorded per the plan's instruction): ask(question), the
 * brain_ask wrapper at lib/core/brain-client.cjs:917. It is the freest-form
 * of the 16 callTool callers -- a single raw string argument -- and
 * brain_ask is already one of the three _isFreeFormTool tool names the
 * classifier's free-form vocabulary path recognizes, so a plain string
 * payload can be driven straight to 'ambiguous', 'block', or 'allow'
 * without constructing a typed packet shape.
 *
 * Seven arms (each payload's verdict is asserted via a direct classify()
 * call BEFORE it is used on the wire, per the plan's explicit instruction --
 * a wire arm built on a mis-assumed verdict silently tests nothing):
 *   Arm 1 - proceed and disclose (freeform_unmatched -> ambiguous)
 *   Arm 2 - block unchanged (forbidden-pattern hit -> block)
 *   Arm 3 - allow byte-unchanged (methodology vocabulary hit -> allow)
 *   Arm 4 - null undecorated (retry budget exhausted on an ambiguous payload)
 *   Arm 5 - no laundering into the disclosure (canary egresses, disclosure does not)
 *   Arm 6 - sentinel siblings undecorated (403 tier_denied on an ambiguous payload)
 *   Arm 7 - belt still first (no-key null contract byte-unchanged; block-with-key unchanged)
 *   Arm 8 - CR-01 regression (254-REVIEW.md): query()'s own bare-array
 *     normalization branch (brain-client.cjs::query(), NOT callTool()/ask())
 *     must preserve egress_disclosure at the TOP level of its returned
 *     shape, not leave it orphaned nested at result.records.egress_disclosure.
 *     Every arm above exercises ask() only -- Arm 8 is query()'s own
 *     regression pin.
 *
 * No em-dashes (hyphens only).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

const {
  startCaptureServer,
  captured,
  resetCaptured,
  stopCaptureServer,
  setToolScript,
  resetToolScript,
} = require('./helpers/brain-capture-server.cjs');

const brainClientPath = path.resolve(REPO, 'lib', 'core', 'brain-client.cjs');
const guardPath = path.resolve(REPO, 'lib', 'core', 'part8-egress-guard.cjs');

// Fixture payload text, each derived shape confirmed against classify()
// directly inside its own arm before it is ever put on the wire.
const AMBIGUOUS_TEXT = 'banana pancake recipe probe';
const BLOCK_TEXT = 'contact me at jane@startup.com';
const ALLOW_TEXT = 'framework chain analysis sequence';
const CANARY = 'CANARY254D2A9';
const CANARY_TEXT = CANARY + ' unrelated content probe';

/**
 * ORDERING CONTRACT (load-bearing, from tests/helpers/brain-capture-server.cjs's
 * own header): set env vars BEFORE requiring lib/core/brain-client.cjs
 * (BRAIN_URL is captured at module load), and delete require.cache for the
 * resolved path before every fresh require, for isolation between arms.
 *
 * key: string -> sets MINDRIAN_BRAIN_KEY to that value. undefined (the
 * default) -> a real-looking test key. null -> deletes the env var entirely
 * (Arm 7's no-key belt-regression proof).
 */
function freshBrainClient(url, key) {
  process.env.MINDRIAN_BRAIN_URL = url;
  if (key === null) {
    delete process.env.MINDRIAN_BRAIN_KEY;
  } else {
    process.env.MINDRIAN_BRAIN_KEY = key === undefined ? 'test-key-not-real' : key;
  }
  delete require.cache[brainClientPath];
  return require(brainClientPath);
}

async function main() {
  const { server, url } = await startCaptureServer();

  // Keep Arm 4's exhausted-retry leg fast. Read fresh on every callTool()
  // invocation (brain-client.cjs's _retryBaseMs() is not module-load-cached),
  // so this is safe to set once, globally, before any arm runs.
  process.env.MINDRIAN_BRAIN_RETRY_BASE_MS = '1';

  const guard = require(guardPath);

  let failed = 0;
  const record = (name, fn) =>
    fn()
      .then(() => {
        process.stdout.write('  ok  ' + name + '\n');
      })
      .catch((err) => {
        failed += 1;
        process.stderr.write('  FAIL ' + name + '\n    ' + (err && err.stack ? err.stack : String(err)) + '\n');
      });

  process.stdout.write('Phase 254-05 (COMP-02) ambiguous-disclosure suite\n');

  // -------------------------------------------------------------------------
  // Arm 1: proceed and disclose.
  // -------------------------------------------------------------------------
  await record('Arm 1: an ambiguous verdict proceeds and discloses', async () => {
    const brain = freshBrainClient(url);
    resetCaptured();
    resetToolScript();

    const verdict = guard.classify({ question: AMBIGUOUS_TEXT }, { toolName: 'brain_ask' });
    assert.strictEqual(verdict.verdict, 'ambiguous', 'fixture payload must classify ambiguous before use on the wire');

    const before = captured.length;
    const result = await brain.ask(AMBIGUOUS_TEXT);

    assert.ok(captured.length > before, 'the call must have proceeded to the wire (captured.length grew)');
    assert.ok(result && typeof result === 'object', 'result must be a non-null object');
    assert.ok(
      Object.prototype.hasOwnProperty.call(result, 'egress_disclosure'),
      'result must carry an own egress_disclosure property'
    );
    assert.strictEqual(result.egress_disclosure.verdict, 'ambiguous');
    assert.ok(
      typeof result.egress_disclosure.egress_class === 'string' && result.egress_disclosure.egress_class.length > 0,
      'egress_class must be a non-empty string'
    );
    assert.strictEqual(result.egress_disclosure.tool, 'brain_ask');
    assert.strictEqual(result.egress_disclosure.disposition, 'proceeded');
    process.stdout.write('    Arm 1 disclosure: ' + JSON.stringify(result.egress_disclosure) + '\n');
  });

  // -------------------------------------------------------------------------
  // Arm 2: block unchanged (regression pin -- must pass before AND after Task 2).
  // -------------------------------------------------------------------------
  await record('Arm 2: a block verdict stays byte-unchanged, no disclosure', async () => {
    const brain = freshBrainClient(url);
    resetCaptured();
    resetToolScript();

    const verdict = guard.classify({ question: BLOCK_TEXT }, { toolName: 'brain_ask' });
    assert.strictEqual(verdict.verdict, 'block', 'fixture payload must classify block before use on the wire');

    const result = await brain.ask(BLOCK_TEXT);

    assert.strictEqual(captured.length, 0, 'a blocked payload must open no socket at all');
    assert.deepStrictEqual(result, { error: 'egress_blocked', tool: 'brain_ask', egress_class: 'content_set' });
    assert.ok(!Object.prototype.hasOwnProperty.call(result, 'egress_disclosure'), 'a sentinel must never carry a disclosure');
  });

  // -------------------------------------------------------------------------
  // Arm 3: allow byte-unchanged (regression pin).
  // -------------------------------------------------------------------------
  await record('Arm 3: an allow verdict returns no egress_disclosure at all', async () => {
    const brain = freshBrainClient(url);
    resetCaptured();
    resetToolScript();

    const verdict = guard.classify({ question: ALLOW_TEXT }, { toolName: 'brain_ask' });
    assert.strictEqual(verdict.verdict, 'allow', 'fixture payload must classify allow before use on the wire');

    const result = await brain.ask(ALLOW_TEXT);

    assert.ok(result && typeof result === 'object', 'result must be a non-null object');
    assert.ok(
      !Object.prototype.hasOwnProperty.call(result, 'egress_disclosure'),
      'the allow (hot) path must be untouched -- no own egress_disclosure key, even undefined-valued'
    );
  });

  // -------------------------------------------------------------------------
  // Arm 4: null undecorated (regression pin -- the transport-failure signal).
  // -------------------------------------------------------------------------
  await record('Arm 4: transport exhaustion returns bare null, never decorated', async () => {
    const brain = freshBrainClient(url);
    resetCaptured();
    setToolScript([{ status: 500 }]); // last entry repeats -- exhausts the retry budget

    const verdict = guard.classify({ question: AMBIGUOUS_TEXT }, { toolName: 'brain_ask' });
    assert.strictEqual(verdict.verdict, 'ambiguous', 'fixture payload must classify ambiguous before use on the wire');

    const result = await brain.ask(AMBIGUOUS_TEXT);

    assert.strictEqual(result, null, 'result must be EXACTLY null -- a decorated object would make a refusal invisible');
    resetToolScript();
  });

  // -------------------------------------------------------------------------
  // Arm 5: no laundering into the disclosure.
  // -------------------------------------------------------------------------
  await record('Arm 5: the disclosure names the verdict, never carries the canary', async () => {
    const brain = freshBrainClient(url);
    resetCaptured();
    resetToolScript();

    const verdict = guard.classify({ question: CANARY_TEXT }, { toolName: 'brain_ask' });
    assert.strictEqual(verdict.verdict, 'ambiguous', 'fixture payload must classify ambiguous before use on the wire');

    const result = await brain.ask(CANARY_TEXT);

    const wire = JSON.stringify(captured);
    assert.ok(wire.includes(CANARY), 'the call proceeded (Option A), so the canary really did egress on the wire');
    assert.ok(
      !JSON.stringify(result.egress_disclosure).includes(CANARY),
      'the disclosure must name the verdict class, never carry the content that triggered it'
    );
    process.stdout.write('    Arm 5 wire (must contain canary): ' + wire + '\n');
    process.stdout.write('    Arm 5 disclosure (must NOT contain canary): ' + JSON.stringify(result.egress_disclosure) + '\n');
  });

  // -------------------------------------------------------------------------
  // Arm 6: sentinel siblings undecorated (403 -> tier_denied).
  // -------------------------------------------------------------------------
  await record('Arm 6: a tier_denied sentinel is never decorated', async () => {
    const brain = freshBrainClient(url);
    resetCaptured();
    setToolScript([{ status: 403, body: JSON.stringify({ error: { message: 'Brain denied tier access (test)' } }) }]);

    const verdict = guard.classify({ question: AMBIGUOUS_TEXT }, { toolName: 'brain_ask' });
    assert.strictEqual(verdict.verdict, 'ambiguous', 'fixture payload must classify ambiguous before use on the wire');

    const result = await brain.ask(AMBIGUOUS_TEXT);

    assert.ok(result && typeof result === 'object', 'result must be a non-null object');
    assert.strictEqual(result.error, 'tier_denied');
    assert.ok(
      !Object.prototype.hasOwnProperty.call(result, 'egress_disclosure'),
      'a constitutional refusal object is not a success return and must not be decorated'
    );
    resetToolScript();
  });

  // -------------------------------------------------------------------------
  // Arm 7: belt still first (regression pin -- ordering unchanged).
  // -------------------------------------------------------------------------
  await record('Arm 7: the key gate still precedes the belt', async () => {
    resetCaptured();
    resetToolScript();

    const verdict = guard.classify({ question: BLOCK_TEXT }, { toolName: 'brain_ask' });
    assert.strictEqual(verdict.verdict, 'block', 'fixture payload must classify block before use on the wire');

    // Sub-case A: block payload, NO key set -- the key gate runs before the
    // belt, so this must still return bare null (byte-unchanged no-key
    // contract), never the egress_blocked sentinel.
    // Full ladder isolation (mirrors tests/test-c8j-brain-wire.cjs Leg 8): a
    // fresh tmp HOME with no .mindrian.env / .mindrian-install.json, and a
    // temporary chdir so <cwd>/.env (this repo carries a real one) cannot
    // resolve a real key out from under the test. Restored in `finally`.
    const prevDisable = process.env.MINDRIAN_DISABLE_AUTO_REGISTER;
    const prevHome = process.env.HOME;
    const prevCwd = process.cwd();
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'test-254-nokeyhome-'));
    process.env.MINDRIAN_DISABLE_AUTO_REGISTER = '1';
    process.env.HOME = tmpHome;
    process.chdir(tmpHome);
    try {
      const brainNoKey = freshBrainClient(url, null);
      const resultNoKey = await brainNoKey.ask(BLOCK_TEXT);
      assert.strictEqual(resultNoKey, null, 'no key -> null; the key gate precedes the belt, byte-unchanged');
      assert.strictEqual(captured.length, 0, 'no transport call should have been made');
    } finally {
      process.chdir(prevCwd);
      if (prevHome === undefined) delete process.env.HOME; else process.env.HOME = prevHome;
      if (prevDisable === undefined) delete process.env.MINDRIAN_DISABLE_AUTO_REGISTER;
      else process.env.MINDRIAN_DISABLE_AUTO_REGISTER = prevDisable;
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }

    // Sub-case B: same block payload, WITH a key -- returns egress_blocked.
    const brainWithKey = freshBrainClient(url, 'test-key-not-real');
    resetCaptured();
    const resultWithKey = await brainWithKey.ask(BLOCK_TEXT);
    assert.deepStrictEqual(resultWithKey, { error: 'egress_blocked', tool: 'brain_ask', egress_class: 'content_set' });
  });

  // -------------------------------------------------------------------------
  // Arm 8: CR-01 regression -- query()'s own top-level disclosure (254-REVIEW.md).
  // -------------------------------------------------------------------------
  await record(
    "Arm 8: query()'s bare-array normalization preserves egress_disclosure at the top level (CR-01)",
    async () => {
      const brain = freshBrainClient(url);
      resetCaptured();
      resetToolScript();

      const verdict = guard.classify({ cypher: AMBIGUOUS_TEXT }, { toolName: 'brain_query' });
      assert.strictEqual(verdict.verdict, 'ambiguous', 'fixture payload must classify ambiguous before use on the wire');

      // The Brain MCP brain_query tool's normal shape: JSON.stringify(records)
      // where records is a BARE ARRAY of row objects (query()'s own docblock,
      // lib/core/brain-client.cjs:797-830). This is the exact shape CR-01
      // found broken -- _attachEgressDisclosure attaches egress_disclosure to
      // this array, then query()'s `{ records: result }` wrapper constructs a
      // brand-new object that must explicitly carry the property forward.
      const bareArrayBody =
        'data: ' +
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { content: [{ type: 'text', text: JSON.stringify([{ name: 'Jobs to be Done' }]) }] },
        }) +
        '\n';
      setToolScript([{ body: bareArrayBody }]);

      const result = await brain.query(AMBIGUOUS_TEXT);

      assert.ok(result && typeof result === 'object', 'result must be a non-null object');
      assert.ok(Array.isArray(result.records), "query() must still normalize to { records: [...] }");
      assert.strictEqual(result.records.length, 1);
      assert.ok(
        Object.prototype.hasOwnProperty.call(result, 'egress_disclosure'),
        "CR-01: query()'s own returned shape must carry egress_disclosure at the TOP level, not nested at result.records.egress_disclosure"
      );
      assert.strictEqual(result.egress_disclosure.verdict, 'ambiguous');
      assert.strictEqual(result.egress_disclosure.tool, 'brain_query');
      assert.strictEqual(result.egress_disclosure.disposition, 'proceeded');
      assert.ok(
        !Object.prototype.hasOwnProperty.call(result.records, 'egress_disclosure'),
        'the disclosure must not remain stranded on the nested records array once query() normalizes'
      );

      resetToolScript();
    }
  );

  await stopCaptureServer(server);

  process.stdout.write(
    '\nPhase 254-05 ambiguous-disclosure suite: ' + (failed === 0 ? 'PASS' : 'FAIL') + ' (' + failed + ' failures)\n'
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('UNEXPECTED ERROR: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
