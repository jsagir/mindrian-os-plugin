#!/usr/bin/env node
'use strict';

/**
 * Phase 257 Plan 07 (D-06, LOCUS-03) -- the permanent answer to
 * "is this still guarded?"
 * ==========================================================================
 * WHY A GREP IS NOT ACCEPTABLE EVIDENCE HERE. The 2026-08-20 handoff
 * concluded the four Brain tools were unguarded from `git grep
 * part8-egress-guard -- bin/` returning zero. That grep was accurate and
 * the conclusion was false: `bin/mindrian-brain-mcp-client.cjs` delegates
 * to `lib/core/brain-client.cjs::callTool`, which HAS carried the belt
 * since commit `ca32b612` (2026-08-19, 2.5 hours before the handoff's own
 * base commit) -- but a filename grep cannot follow `brainClient.ask()`
 * into `callTool()`. Two and a half weeks and one phase were spent on a
 * premise a wire probe would have refuted in a minute (257-RESEARCH.md).
 *
 * METHOD. Ground truth, not a grep -- per `lib/mcp/no-instructions.test.cjs`'s
 * own doctrine ("the wire cannot lie about what a host would receive"). The
 * real shim (`node bin/mindrian-brain-mcp-client.cjs`) is spawned, driven
 * over stdio with genuine JSON-RPC (`initialize`, `tools/list`,
 * `tools/call`), and the actual parsed wire response is inspected.
 * `tests/helpers/brain-capture-server.cjs` stands in as the network so
 * "zero bytes left the machine" is an observation, not an inference.
 *
 * THE TOOL LIST IS DERIVED, NEVER FROZEN (257-RESEARCH.md Pitfall 4). Two
 * arms of the 239 suite were red for two weeks because they froze a
 * hook-matcher string as a constant; Plan 05 fixed exactly that. A frozen
 * tool array in this file would decay the identical way and would silently
 * stop covering a tool the moment one is added or renamed. The ONE place a
 * tool name may appear as a literal is the EXPECTATION_MAP key set below,
 * and even that is reconciled against the live `tools/list` response in
 * BOTH directions every run (Arm 1) -- a rename or a newly-added tool both
 * fail loudly instead of silently escaping coverage.
 *
 * Seven arms:
 *   Arm 1 - derive the tool list from a real tools/list; reconcile
 *           EXPECTATION_MAP against it in both directions.
 *   Arm 2 - zero egress on a canary, per canary-carrying tool.
 *   Arm 3 - honest typed refusal, per tool (egress_blocked, or the pinned
 *           G2 gap on brain_query).
 *   Arm 4 - ambiguous proceeds and discloses (brain_ask, the first real
 *           consumer of Phase 254's COMP-02 egress_disclosure field).
 *   Arm 5 - allow still works (the guard discriminates, it does not block
 *           unconditionally).
 *   Arm 6 - no laundering: the canary never rides any Arm 2 response body
 *           or the capture record.
 *   Arm 7 - mutation legs: in-process self-checks proving the oracle
 *           itself can fail, per tests/test-239-query-egress-canary.cjs's
 *           discipline.
 *
 * Absolute prohibitions: no frozen tool-name array outside
 * EXPECTATION_MAP, no assertion whose evidence is a grep of source, no
 * assertion that a guard exists based on a module being required.
 *
 * No em-dashes (hyphens only).
 */

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SHIM = path.join(REPO, 'bin', 'mindrian-brain-mcp-client.cjs');

const {
  startCaptureServer,
  captured,
  resetCaptured,
  stopCaptureServer,
  setToolScript,
  resetToolScript,
} = require('./helpers/brain-capture-server.cjs');

const guard = require(path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs'));

const CANARY_TOKEN = 'CANARY7F3A2B';
const CANARY = CANARY_TOKEN + ' dana@acme.io';
const AMBIGUOUS_TEXT = 'banana pancake recipe probe';
const ALLOW_TEXT = 'What framework should I use for an ill-defined problem?';

// ---------------------------------------------------------------------------
// EXPECTATION_MAP: the ONE place a Brain tool name is allowed to appear as a
// literal in this file. Reconciled against the live tools/list response in
// BOTH directions by Arm 1 (a rename or a newly-added, uncovered tool both
// fail that reconciliation loudly) -- this is not a frozen array, it is a
// map whose keys are asserted present in, and whose coverage is asserted
// complete against, the server's own live catalog every single run.
//
//   canaryCarrying: true for a tool that accepts a free-text field a
//     canary can ride (measured against lib/core/part8-egress-guard.cjs::
//     classify()); false for a zero-parameter tool with no user content to
//     carry (brain_schema, brain_stats -- both called with {} only).
//   freeTextField: the argument key the canary is placed into.
//   expectedKind: 'egress_blocked' for the four raw-passthrough-plus-ask
//     tools that CAN see the {error:'egress_blocked',...} sentinel (per
//     257-06-SUMMARY.md's per-tool finding table, derived by reading
//     lib/core/brain-client.cjs, not assumed); 'unreachable_known_gap' for
//     brain_query ONLY (see the Arm 3 comment below for the full G2
//     citation).
// ---------------------------------------------------------------------------
const EXPECTATION_MAP = {
  brain_ask: { canaryCarrying: true, freeTextField: 'question', expectedKind: 'egress_blocked' },
  brain_query: { canaryCarrying: true, freeTextField: 'cypher', expectedKind: 'unreachable_known_gap' },
  brain_schema: { canaryCarrying: false, freeTextField: null, expectedKind: null },
  brain_search: { canaryCarrying: true, freeTextField: 'query', expectedKind: 'egress_blocked' },
  brain_stats: { canaryCarrying: false, freeTextField: null, expectedKind: null },
  brain_write: { canaryCarrying: true, freeTextField: 'cypher', expectedKind: 'egress_blocked' },
};

// ---------------------------------------------------------------------------
// Spawn the real shim ONCE and drive many sequential JSON-RPC requests over
// its one stdio connection (initialize, tools/list, then N tools/call), so
// this suite pays for exactly one process spawn rather than one per arm,
// keeping it inside the 10-second budget (257-VALIDATION.md). Every spawned
// PID is tracked and force-killed in the top-level finally, per Task 3's
// hygiene requirement.
// ---------------------------------------------------------------------------
const spawnedPids = [];

function spawnShim(url) {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-257-07-'));
  const env = Object.assign({}, process.env, {
    HOME: tmpHome,
    MINDRIAN_BRAIN_URL: url,
    MINDRIAN_BRAIN_KEY: 'test-key-not-real',
    MINDRIAN_DISABLE_AUTO_REGISTER: '1',
  });

  const proc = cp.spawn('node', [SHIM], { stdio: ['pipe', 'pipe', 'pipe'], env });
  if (typeof proc.pid === 'number') spawnedPids.push(proc.pid);

  let stdoutBuf = '';
  let stderrBuf = '';
  const pending = new Map();
  let nextId = 1;

  proc.stdout.on('data', (chunk) => {
    stdoutBuf += chunk.toString('utf8');
    let nl;
    while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (!line) continue;
      let obj;
      try { obj = JSON.parse(line); } catch (_e) { continue; }
      if (obj && typeof obj.id !== 'undefined' && pending.has(obj.id)) {
        const p = pending.get(obj.id);
        pending.delete(obj.id);
        clearTimeout(p.timer);
        p.resolve(obj);
      }
    }
  });
  proc.stderr.on('data', (c) => { stderrBuf += c.toString('utf8'); });
  proc.on('exit', (code) => {
    pending.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(new Error('shim exited (code=' + code + ') before responding; stderr tail: ' + stderrBuf.slice(-500)));
    });
    pending.clear();
  });

  function request(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('timeout waiting for ' + method + ' (id=' + id + '); stderr tail: ' + stderrBuf.slice(-500)));
      }, 15000);
      pending.set(id, { resolve, reject, timer });
      proc.stdin.write(JSON.stringify(Object.assign({ jsonrpc: '2.0', id: id, method: method }, params !== undefined ? { params: params } : {})) + '\n');
    });
  }

  function notify(method, params) {
    proc.stdin.write(JSON.stringify(Object.assign({ jsonrpc: '2.0', method: method }, params !== undefined ? { params: params } : {})) + '\n');
  }

  function cleanup() {
    try { proc.kill('SIGKILL'); } catch (_e) { /* already gone */ }
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }

  return { proc, request, notify, cleanup };
}

function parseEnvelope(resp) {
  const content = resp && resp.result && resp.result.content && resp.result.content[0];
  assert.ok(content && content.type === 'text', 'expected text content in tools/call result: ' + JSON.stringify(resp));
  return JSON.parse(content.text);
}

function getKind(toolName, envelope) {
  if (toolName === 'brain_ask') return envelope.refusal && envelope.refusal.kind;
  return envelope.kind;
}
function getStatus(toolName, envelope) {
  if (toolName === 'brain_ask') return envelope.refusal && envelope.refusal.status;
  return envelope.status;
}

// ---------------------------------------------------------------------------
// Mutation-leg support functions (Arm 7). These are the SAME assertion
// shapes Arm 2 and Arm 3 use, extracted as standalone callable checks so
// this suite can prove, in-process, that the check itself is capable of
// failing -- not merely that it happened to pass on this run's fixtures.
// ---------------------------------------------------------------------------
function assertZeroEgress(capturedCountAtCallTime, canaryToken, wireSnapshot, label) {
  assert.strictEqual(capturedCountAtCallTime, 0, label + ': expected zero captured requests, got ' + capturedCountAtCallTime);
  assert.ok(wireSnapshot.indexOf(canaryToken) === -1, label + ': canary token leaked onto the wire');
}
function assertHonestKind(actualKind, expectedKind, label) {
  assert.strictEqual(actualKind, expectedKind, label + ': expected kind "' + expectedKind + '", got "' + actualKind + '"');
}

async function main() {
  const startedAt = Date.now();
  const { server, url } = await startCaptureServer();
  const shim = spawnShim(url);

  let failed = 0;
  const record = (name, fn) =>
    fn()
      .then(() => { process.stdout.write('  ok  ' + name + '\n'); })
      .catch((err) => {
        failed += 1;
        process.stderr.write('  FAIL ' + name + '\n    ' + (err && err.stack ? err.stack : String(err)) + '\n');
      });

  process.stdout.write('Phase 257-07 (LOCUS-03, D-06) brain-tool egress invariant\n');

  try {
    await shim.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-257-07-egress-invariant', version: '1.0.0' },
    });
    shim.notify('notifications/initialized');

    // -----------------------------------------------------------------
    // Arm 1: DERIVE THE TOOL LIST, reconcile EXPECTATION_MAP against it
    // in BOTH directions. These two loops are the load-bearing structural
    // assertions Task 1's acceptance criteria asks to be cited by line
    // number -- keep each as its own top-level assert.ok call so a future
    // reader can find them precisely.
    // -----------------------------------------------------------------
    const listResp = await shim.request('tools/list', {});
    const liveTools = (listResp.result && Array.isArray(listResp.result.tools)) ? listResp.result.tools : [];
    const liveNames = liveTools.map((t) => t.name);

    await record('Arm 1a: tools/list returns a non-empty array', async () => {
      assert.ok(Array.isArray(liveNames) && liveNames.length > 0, 'tools/list must return a non-empty tool array, got: ' + JSON.stringify(liveNames));
    });

    await record('Arm 1b: FORWARD -- every EXPECTATION_MAP entry exists in the live tools/list (a rename fails here)', async () => {
      Object.keys(EXPECTATION_MAP).forEach((name) => {
        assert.ok(
          liveNames.indexOf(name) !== -1,
          'EXPECTATION_MAP has an entry "' + name + '" not present in the live tools/list (' + JSON.stringify(liveNames) + ') -- the tool was renamed or removed'
        );
      });
    });

    await record('Arm 1c: INVERSE -- every live tools/list entry exists in EXPECTATION_MAP (a newly-added tool fails here)', async () => {
      liveNames.forEach((name) => {
        assert.ok(
          Object.prototype.hasOwnProperty.call(EXPECTATION_MAP, name),
          'tools/list advertises "' + name + '" with no EXPECTATION_MAP entry -- add coverage before this can pass. This inverse assertion is the whole point of deriving the tool list instead of freezing it.'
        );
      });
    });

    // -----------------------------------------------------------------
    // Arm 2 + Arm 3 data collection: one tools/call per canary-carrying
    // tool, the response cached and checked from both angles below
    // (mirrors 257-06's "one spawn, four angles" discipline).
    // -----------------------------------------------------------------
    const canaryTools = Object.keys(EXPECTATION_MAP).filter((n) => EXPECTATION_MAP[n].canaryCarrying);
    const canaryResults = {};

    for (const toolName of canaryTools) {
      const cfg = EXPECTATION_MAP[toolName];
      const args = {};
      args[cfg.freeTextField] = CANARY;
      resetCaptured();
      const resp = await shim.request('tools/call', { name: toolName, arguments: args });
      const envelope = parseEnvelope(resp);
      canaryResults[toolName] = {
        envelope: envelope,
        capturedCount: captured.length,
        capturedSnapshot: JSON.stringify(captured),
        wire: JSON.stringify(envelope),
      };
    }

    await record('Arm 2: zero egress on a canary, per canary-carrying tool (' + canaryTools.join(', ') + ')', async () => {
      canaryTools.forEach((toolName) => {
        const r = canaryResults[toolName];
        assert.strictEqual(r.capturedCount, 0, toolName + ': a blocked call must open no socket at all; captured: ' + r.capturedSnapshot);
        assert.ok(r.capturedSnapshot.indexOf(CANARY_TOKEN) === -1, toolName + ': canary leaked into the capture-server record: ' + r.capturedSnapshot);
      });
    });

    // Non-canary tools (brain_schema, brain_stats): zero-parameter, no
    // free-text field carries user content, so there is nothing for a
    // canary to ride. Assert only that the call completes without error --
    // asserting zero egress here would be meaningless (there is no canary
    // to check for), and per part8-egress-guard.cjs's own _isProvablyEmptyPayload
    // proof, an empty {} payload classifies allow/empty_payload and is
    // EXPECTED to proceed to the wire.
    const nonCanaryTools = Object.keys(EXPECTATION_MAP).filter((n) => !EXPECTATION_MAP[n].canaryCarrying);
    await record('Arm 2b: non-canary-carrying tools (' + nonCanaryTools.join(', ') + ') complete without error', async () => {
      for (const toolName of nonCanaryTools) {
        const resp = await shim.request('tools/call', { name: toolName, arguments: {} });
        const envelope = parseEnvelope(resp); // parse succeeding IS the "completes without error" proof
        assert.ok(envelope !== undefined, toolName + ': expected a parseable response envelope');
      }
    });

    // -----------------------------------------------------------------
    // Arm 3: HONEST TYPED REFUSAL, per tool, using EXPECTATION_MAP.
    // -----------------------------------------------------------------
    await record('Arm 3: honest typed refusal, per tool', async () => {
      canaryTools.forEach((toolName) => {
        const cfg = EXPECTATION_MAP[toolName];
        const envelope = canaryResults[toolName].envelope;
        if (cfg.expectedKind === 'egress_blocked') {
          assert.strictEqual(getKind(toolName, envelope), 'egress_blocked', toolName + ': expected kind egress_blocked, got envelope: ' + JSON.stringify(envelope));
          assert.strictEqual(getStatus(toolName, envelope), 'BRAIN_EGRESS_BLOCKED', toolName + ': expected status BRAIN_EGRESS_BLOCKED');
          if (toolName === 'brain_ask') {
            assert.strictEqual(
              envelope.directive && envelope.directive.guided && envelope.directive.guided.stage,
              'tier_0_egress_blocked',
              'brain_ask: expected directive.guided.stage === tier_0_egress_blocked'
            );
          }
        } else if (cfg.expectedKind === 'unreachable_known_gap') {
          // brain_query ONLY. This is G2, a DELIBERATE PIN, not an
          // oversight: query() returns null at lib/core/brain-client.cjs:884
          // on a Part 8 block, BEFORE callTool() ever runs, so this call
          // site can never see the richer {error:'egress_blocked',...}
          // sentinel. The null contract itself is pinned by roughly 82
          // degradation tests keyed on it (lib/core/brain-client.cjs:640-643
          // and :577). D-05 (257-CONTEXT.md) accepted this conflation as
          // out of scope for Phase 257, and
          // docs/257-NOTE-part8-enforcement-locus-rulings.md section 3
          // records the ruling. If this assertion ever needs to change to
          // 'egress_blocked', that is a contract change to query() and it
          // requires its own phase -- do not "fix" this arm to match a
          // drifted implementation; fix the implementation back, or open a
          // new phase.
          assert.strictEqual(getKind(toolName, envelope), 'unreachable', 'brain_query: expected the pinned G2 gap, kind === unreachable');
          assert.notStrictEqual(getKind(toolName, envelope), 'egress_blocked', 'brain_query: kind must NOT be egress_blocked (that would mean the G2 contract changed silently)');
        } else {
          assert.fail(toolName + ': EXPECTATION_MAP entry has no recognized expectedKind');
        }
      });
    });

    // -----------------------------------------------------------------
    // Arm 4: AMBIGUOUS PROCEEDS AND DISCLOSES (brain_ask).
    // -----------------------------------------------------------------
    const ambiguousVerdict = guard.classify({ question: AMBIGUOUS_TEXT }, { toolName: 'brain_ask' });
    let allowCapturedCount = 0;
    let allowWire = '';
    await record('Arm 4: ambiguous proceeds and discloses (verdict verified in-process first)', async () => {
      assert.strictEqual(ambiguousVerdict.verdict, 'ambiguous', 'fixture text no longer classifies ambiguous -- the arm would silently become an allow arm; verdict was: ' + JSON.stringify(ambiguousVerdict));

      resetCaptured();
      resetToolScript();
      const ambiguousBody =
        'data: ' +
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                directive: { guided: { questions: [], framework: null, stage: 'ambiguous_probe' } },
                next_gate: { sub_shape: 'F.1', options: ['proceed'] },
              }),
            }],
          },
        }) +
        '\n';
      setToolScript([{ body: ambiguousBody }]);
      const resp = await shim.request('tools/call', { name: 'brain_ask', arguments: { question: AMBIGUOUS_TEXT } });
      const envelope = parseEnvelope(resp);
      const capturedLen = captured.length;
      resetToolScript();

      assert.ok(capturedLen > 0, 'an ambiguous verdict must proceed to the wire (Phase 254 D-02 Option A); captured.length was 0');
      assert.ok(envelope.egress_disclosure, 'expected an own egress_disclosure key on the envelope: ' + JSON.stringify(envelope));
      assert.strictEqual(envelope.egress_disclosure.verdict, 'ambiguous');
      assert.strictEqual(envelope.egress_disclosure.disposition, 'proceeded');
    });

    // -----------------------------------------------------------------
    // Arm 5: ALLOW STILL WORKS. Without this arm the whole suite would
    // pass if the guard started blocking unconditionally.
    // -----------------------------------------------------------------
    const allowVerdict = guard.classify({ question: ALLOW_TEXT }, { toolName: 'brain_ask' });
    await record('Arm 5: allow still works -- the guard discriminates, it does not block unconditionally', async () => {
      assert.strictEqual(allowVerdict.verdict, 'allow', 'fixture text no longer classifies allow -- verdict was: ' + JSON.stringify(allowVerdict));

      resetCaptured();
      resetToolScript();
      const resp = await shim.request('tools/call', { name: 'brain_ask', arguments: { question: ALLOW_TEXT } });
      const envelope = parseEnvelope(resp);
      allowCapturedCount = captured.length;
      allowWire = JSON.stringify(envelope);

      assert.ok(allowCapturedCount > 0, 'an allow verdict must proceed to the wire; captured.length was 0');
      assert.ok(!Object.prototype.hasOwnProperty.call(envelope, 'refusal'), 'an allowed call must not carry a refusal key: ' + allowWire);
    });

    // -----------------------------------------------------------------
    // Arm 6: NO LAUNDERING -- the canary never rides an Arm 2 response
    // body or the capture record.
    // -----------------------------------------------------------------
    await record('Arm 6: no laundering -- the canary appears nowhere in any Arm 2 response or the capture record', async () => {
      canaryTools.forEach((toolName) => {
        const r = canaryResults[toolName];
        assert.ok(r.wire.indexOf(CANARY_TOKEN) === -1, toolName + ': canary token leaked into the response envelope: ' + r.wire);
        assert.ok(r.capturedSnapshot.indexOf(CANARY_TOKEN) === -1, toolName + ': canary token leaked into the capture-server record: ' + r.capturedSnapshot);
      });
    });

    // -----------------------------------------------------------------
    // Arm 7: MUTATION LEGS -- in-process self-checks proving the arms
    // above can actually fail (the oracle is live, not additional
    // coverage), per tests/test-239-query-egress-canary.cjs's discipline.
    // -----------------------------------------------------------------
    await record('Arm 7a: the belt self-check (Arm 2 shape) can fail -- run against a real call that DID reach the wire', async () => {
      let threw = false;
      try {
        assertZeroEgress(allowCapturedCount, CANARY_TOKEN, allowWire, 'mutation-leg self-check');
      } catch (_e) {
        threw = true;
      }
      assert.strictEqual(threw, true, 'assertZeroEgress must fail when run against Arm 5\'s allowed call (captured.length=' + allowCapturedCount + ' > 0); it did not throw, meaning the oracle cannot fail and is not live');
    });

    await record('Arm 7b: the honest-refusal self-check (Arm 3 shape) can fail -- run with a deliberately wrong expected kind', async () => {
      let threw = false;
      try {
        assertHonestKind(getKind('brain_ask', canaryResults.brain_ask.envelope), 'this_kind_does_not_exist', 'mutation-leg self-check');
      } catch (_e) {
        threw = true;
      }
      assert.strictEqual(threw, true, 'assertHonestKind must fail against a deliberately wrong expected kind; it did not throw, meaning the oracle cannot fail and is not live');
    });
  } finally {
    shim.cleanup();
    await stopCaptureServer(server);
  }

  // Hygiene check (Task 1 acceptance criteria): no orphaned shim process
  // spawned by this suite survives the run. PID-specific check (not a `ps
  // aux` substring scan) so this repo's own live mindrian-brain MCP
  // connection (Claude Code's own plugin session, if any, driving this
  // very test run) cannot false-positive the check.
  function isAlive(pid) {
    try { process.kill(pid, 0); return true; } catch (_e) { return false; }
  }
  async function waitForAllReaped(pids, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    let remaining = pids.filter(isAlive);
    while (remaining.length > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
      remaining = remaining.filter(isAlive);
    }
    return remaining;
  }
  const stillAlive = await waitForAllReaped(spawnedPids, 2000);
  process.stdout.write(
    '  hygiene: ' + spawnedPids.length + ' shim process(es) spawned this run, ' +
    (stillAlive.length === 0 ? 'none still alive after cleanup' : ('STILL ALIVE: ' + JSON.stringify(stillAlive))) + '\n'
  );
  if (stillAlive.length > 0) failed += 1;

  const wallTimeMs = Date.now() - startedAt;
  process.stdout.write('  wall time: ' + wallTimeMs + 'ms\n');

  process.stdout.write(
    '\nPhase 257-07 brain-tool egress invariant: ' + (failed === 0 ? 'PASS' : 'FAIL') + ' (' + failed + ' failures)\n'
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('UNEXPECTED ERROR: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  spawnedPids.forEach((pid) => { try { process.kill(pid, 'SIGKILL'); } catch (_e) { /* already gone */ } });
  process.exit(1);
});
