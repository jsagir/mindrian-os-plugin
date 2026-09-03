#!/usr/bin/env node
'use strict';

/**
 * Phase 257 Plan 06 (D-03/D-04/D-05, LOCUS-01/LOCUS-02, G1/G2/G3) -- the
 * honest-refusal wire proof for `bin/mindrian-brain-mcp-client.cjs`.
 * ==========================================================================
 * Ground truth, not a grep (lib/mcp/no-instructions.test.cjs's own doctrine):
 * the shim is spawned FOR REAL (`node bin/mindrian-brain-mcp-client.cjs`),
 * driven over stdio with genuine JSON-RPC (`initialize`, `tools/list`,
 * `tools/call`), and the actual parsed wire response is inspected. The wire
 * cannot lie about what a host would receive.
 *
 * Every block-triggering arm uses the canary `CANARY7F3A2B dana@acme.io`
 * (content canary + PII pattern, verified live against part8-egress-guard.cjs
 * ::classify() to hit `block`/`content_set` on every tool's free-form field
 * before this suite was written). The ambiguous-disclosure arm (G3) uses the
 * Phase 254 precedent text `banana pancake recipe probe`
 * (freeform_unmatched -> ambiguous).
 *
 * Eight arms (per 257-06-PLAN.md Task 3):
 *   Arm 1 - G1 on the wire: brain_ask + the canary -> typed egress_blocked
 *           refusal, zero bytes reach the capture server.
 *   Arm 2 - anti-regression on the measured BEFORE shape (the empty,
 *           refusal-less DirectiveEnvelope G1 used to render).
 *   Arm 3 - block is not outage (mode_rationale, BRAIN_UNREACHABLE absence).
 *   Arm 4 - G3 on the wire: an ambiguous verdict proceeds AND its
 *           egress_disclosure reaches the model via wrapDirective.
 *   Arm 5 - no laundering: the canary never rides the response or the wire.
 *   Arm 6 - the other tools: brain_search and brain_write also convert the
 *           sentinel to a typed refusal.
 *   Arm 7 - the accepted G2 gap, PINNED: brain_query still reports
 *           'unreachable' on a block (D-05, out of scope this phase).
 *   Arm 8 - honestRefusal() unit arms, in process, extracted from the real
 *           shim source (never a hand-duplicated copy of its logic) so a
 *           future edit to the real function is what this arm actually pins.
 *
 * Tool names for Arms 6/7 are asserted present in the server's own live
 * `tools/list` response before being used, per 257-RESEARCH.md Pitfall 4
 * (a frozen tool-name array is the root cause of this whole phase's premise
 * going stale undetected) -- this suite derives, it never assumes.
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

const { refusalResponse } = require(path.join(REPO, 'lib', 'core', 'refusal-messaging.cjs'));

const CANARY_TOKEN = 'CANARY7F3A2B';
const CANARY = CANARY_TOKEN + ' dana@acme.io';
const AMBIGUOUS_TEXT = 'banana pancake recipe probe';

const spawnedProcs = [];
const spawnedPids = [];

// ---------------------------------------------------------------------------
// Spawn the real shim over stdio, drive a real initialize + optional
// tools/list + N tools/call requests, and resolve with the parsed
// JSON-RPC response for each in request order. Every spawned child is
// tracked in spawnedProcs and force-killed by the top-level finally, so a
// failing arm never leaves a process behind (Task 3 hygiene requirement).
// ---------------------------------------------------------------------------
function driveShim(url, toolCalls, opts) {
  const wantToolsList = !!(opts && opts.toolsList);
  return new Promise((resolve, reject) => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-257-06-'));
    const env = Object.assign({}, process.env, {
      HOME: tmpHome,
      MINDRIAN_BRAIN_URL: url,
      MINDRIAN_BRAIN_KEY: 'test-key-not-real',
      MINDRIAN_DISABLE_AUTO_REGISTER: '1',
    });

    const proc = cp.spawn('node', [SHIM], { stdio: ['pipe', 'pipe', 'pipe'], env });
    spawnedProcs.push(proc);
    if (typeof proc.pid === 'number') spawnedPids.push(proc.pid);

    let stdoutBuf = '';
    let stderrBuf = '';
    const responses = new Map();
    let settled = false;

    // id 1 = initialize. id 2 = tools/list (only if requested). Then N
    // sequential tools/call ids after that.
    const listId = wantToolsList ? 2 : null;
    const firstCallId = wantToolsList ? 3 : 2;
    const callIds = toolCalls.map((_, i) => firstCallId + i);
    const expectedIds = wantToolsList ? [listId].concat(callIds) : callIds;

    function cleanup() {
      try { proc.kill('SIGKILL'); } catch (_e) { /* already gone */ }
      try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(
        'timeout waiting for shim responses; seen ids: ' + Array.from(responses.keys()).join(',') +
        '; stderr tail: ' + stderrBuf.slice(-500)
      ));
    }, 15000);

    proc.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString('utf8');
      let nl;
      while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        let obj;
        try { obj = JSON.parse(line); } catch (_e) { continue; }
        if (obj && typeof obj.id !== 'undefined') {
          responses.set(obj.id, obj);
          if (expectedIds.every((id) => responses.has(id))) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            const out = {
              list: wantToolsList ? responses.get(listId) : null,
              calls: callIds.map((id) => responses.get(id)),
            };
            cleanup();
            resolve(out);
          }
        }
      }
    });

    proc.stderr.on('data', (c) => { stderrBuf += c.toString('utf8'); });

    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      reject(err);
    });

    proc.on('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('shim exited before responding, code=' + code + '; stderr tail: ' + stderrBuf.slice(-500)));
    });

    function send(obj) { proc.stdin.write(JSON.stringify(obj) + '\n'); }

    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-257-06-shim-honest-refusal', version: '1.0.0' },
      },
    });
    setTimeout(() => {
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      if (wantToolsList) {
        send({ jsonrpc: '2.0', id: listId, method: 'tools/list', params: {} });
      }
      toolCalls.forEach((call, i) => {
        send({ jsonrpc: '2.0', id: callIds[i], method: 'tools/call', params: { name: call.name, arguments: call.arguments } });
      });
    }, 50);
  });
}

function parseEnvelope(resp) {
  const content = resp && resp.result && resp.result.content && resp.result.content[0];
  assert.ok(content && content.type === 'text', 'expected text content in tools/call result: ' + JSON.stringify(resp));
  return JSON.parse(content.text);
}

// ---------------------------------------------------------------------------
// Arm 8 support: extract honestRefusal()'s real source (never a hand-copy of
// its logic) and evaluate it with refusalResponse injected, so this arm pins
// the ACTUAL shipped function, not a re-implementation of what it should do.
// Mirrors tests/test-239-query-egress-canary.cjs's extractFunctionBody idiom
// (pure text slicing over the real file, not a parser).
// ---------------------------------------------------------------------------
function extractHonestRefusalFn() {
  const src = fs.readFileSync(SHIM, 'utf8');
  const marker = 'function honestRefusal(result, toolName) {';
  const startIdx = src.indexOf(marker);
  assert.ok(startIdx !== -1, 'honestRefusal( definition not found in shim source -- Task 2 helper missing or renamed');
  let depth = 0;
  let bodyEnd = -1;
  for (let i = startIdx; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { bodyEnd = i + 1; break; }
    }
  }
  assert.ok(bodyEnd !== -1, 'could not find the closing brace of honestRefusal(');
  const fnSrc = src.slice(startIdx, bodyEnd);
  // eslint-disable-next-line no-new-func
  const factory = new Function('refusalResponse', fnSrc + '\nreturn honestRefusal;');
  return factory(refusalResponse);
}

async function main() {
  const { server, url } = await startCaptureServer();

  let failed = 0;
  const record = (name, fn) =>
    fn()
      .then(() => { process.stdout.write('  ok  ' + name + '\n'); })
      .catch((err) => {
        failed += 1;
        process.stderr.write('  FAIL ' + name + '\n    ' + (err && err.stack ? err.stack : String(err)) + '\n');
      });

  process.stdout.write('Phase 257-06 (LOCUS-01/LOCUS-02) shim honest-refusal wire suite\n');

  try {
    // -------------------------------------------------------------------
    // Group A (Arms 1, 2, 3, 5): a single spawn + a single blocked
    // brain_ask call, asserted from four angles. One spawn, not four, so
    // the four assertions are proven against the exact same wire response.
    // -------------------------------------------------------------------
    resetCaptured();
    const groupA = await driveShim(url, [{ name: 'brain_ask', arguments: { question: CANARY } }]);
    const envelopeA = parseEnvelope(groupA.calls[0]);
    const wireA = JSON.stringify(envelopeA);
    const capturedA = JSON.stringify(captured);

    await record('Arm 1: G1 on the wire -- a blocked brain_ask names itself, zero bytes reach the Brain', async () => {
      assert.strictEqual(envelopeA.refusal && envelopeA.refusal.kind, 'egress_blocked');
      assert.strictEqual(envelopeA.refusal && envelopeA.refusal.status, 'BRAIN_EGRESS_BLOCKED');
      assert.strictEqual(envelopeA.directive && envelopeA.directive.guided && envelopeA.directive.guided.stage, 'tier_0_egress_blocked');
      assert.strictEqual(captured.length, 0, 'a blocked call must open no socket at all; captured: ' + capturedA);
    });

    await record('Arm 2: anti-regression -- the measured BEFORE (empty, refusal-less) shape cannot return', async () => {
      const looksLikeOldEmptyShape =
        envelopeA.directive && envelopeA.directive.guided && envelopeA.directive.guided.stage === null &&
        envelopeA.next_gate && Array.isArray(envelopeA.next_gate.options) && envelopeA.next_gate.options.length === 0 &&
        !Object.prototype.hasOwnProperty.call(envelopeA, 'refusal');
      assert.strictEqual(looksLikeOldEmptyShape, false, 'the response still matches the measured G1 BEFORE shape: ' + wireA);
      assert.ok(Object.prototype.hasOwnProperty.call(envelopeA, 'refusal'), 'the AFTER envelope must carry an own refusal key');
    });

    await record('Arm 3: block is not outage -- mode_rationale and BRAIN_UNREACHABLE stay absent', async () => {
      assert.notStrictEqual(envelopeA.mode_rationale, 'brain_unreachable');
      assert.ok(wireA.indexOf('BRAIN_UNREACHABLE') === -1, 'the envelope must not contain the string BRAIN_UNREACHABLE: ' + wireA);
    });

    await record('Arm 5: no laundering -- the canary appears nowhere in the response or on the wire', async () => {
      assert.ok(wireA.indexOf(CANARY_TOKEN) === -1, 'canary token leaked into the response envelope: ' + wireA);
      assert.ok(capturedA.indexOf(CANARY_TOKEN) === -1, 'canary token leaked into the capture-server record: ' + capturedA);
    });

    // -------------------------------------------------------------------
    // Group B (Arm 4): G3 on the wire -- an ambiguous verdict proceeds and
    // its egress_disclosure survives wrapDirective for brain_ask.
    // -------------------------------------------------------------------
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
    const groupB = await driveShim(url, [{ name: 'brain_ask', arguments: { question: AMBIGUOUS_TEXT } }]);
    const envelopeB = parseEnvelope(groupB.calls[0]);
    const capturedBLen = captured.length;
    resetToolScript();

    await record('Arm 4: G3 on the wire -- ambiguous proceeds and egress_disclosure reaches the model', async () => {
      assert.ok(envelopeB.egress_disclosure, 'expected an own egress_disclosure key on the envelope: ' + JSON.stringify(envelopeB));
      assert.strictEqual(envelopeB.egress_disclosure.verdict, 'ambiguous');
      assert.strictEqual(envelopeB.egress_disclosure.disposition, 'proceeded');
      assert.ok(capturedBLen > 0, 'an ambiguous verdict must proceed to the wire (Phase 254 D-02 Option A); captured.length was 0');
    });

    // -------------------------------------------------------------------
    // Group C (Arms 6, 7): tools/list derivation, then brain_search /
    // brain_write (Arm 6) and brain_query (Arm 7, the pinned G2 gap), all
    // driven with the same canary in one spawn.
    // -------------------------------------------------------------------
    resetCaptured();
    resetToolScript();
    const groupC = await driveShim(
      url,
      [
        { name: 'brain_search', arguments: { query: CANARY } },
        { name: 'brain_write', arguments: { cypher: CANARY } },
        { name: 'brain_query', arguments: { cypher: CANARY } },
      ],
      { toolsList: true }
    );
    const listedNames = (groupC.list && groupC.list.result && Array.isArray(groupC.list.result.tools))
      ? groupC.list.result.tools.map((t) => t.name)
      : [];
    const searchResult = groupC.calls[0] && groupC.calls[0].result;
    const writeResult = groupC.calls[1] && groupC.calls[1].result;
    const queryResult = groupC.calls[2] && groupC.calls[2].result;
    const capturedCLen = captured.length;

    function contentJson(result) {
      const content = result && result.content && result.content[0];
      assert.ok(content && content.type === 'text', 'expected text content: ' + JSON.stringify(result));
      return JSON.parse(content.text);
    }

    await record('Arm 6: the other tools -- brain_search and brain_write convert the sentinel to a typed refusal', async () => {
      assert.ok(listedNames.indexOf('brain_search') !== -1, 'brain_search must appear in the live tools/list result; got: ' + JSON.stringify(listedNames));
      assert.ok(listedNames.indexOf('brain_write') !== -1, 'brain_write must appear in the live tools/list result; got: ' + JSON.stringify(listedNames));

      const searchRefusal = contentJson(searchResult);
      assert.strictEqual(searchRefusal.kind, 'egress_blocked');
      assert.strictEqual(searchRefusal.status, 'BRAIN_EGRESS_BLOCKED');

      const writeRefusal = contentJson(writeResult);
      assert.strictEqual(writeRefusal.kind, 'egress_blocked');
      assert.strictEqual(writeRefusal.status, 'BRAIN_EGRESS_BLOCKED');

      assert.strictEqual(capturedCLen, 0, 'a blocked brain_search/brain_write/brain_query call must open no socket at all');
    });

    await record('Arm 7: the accepted G2 gap, PINNED -- brain_query still reports unreachable on a block (D-05)', async () => {
      assert.ok(listedNames.indexOf('brain_query') !== -1, 'brain_query must appear in the live tools/list result; got: ' + JSON.stringify(listedNames));
      const queryRefusal = contentJson(queryResult);
      // This is the KNOWN, ACCEPTED conflation (D-05): query() returns null
      // on a Part 8 block BEFORE callTool() ever runs
      // (lib/core/brain-client.cjs:884), so this call site can never see the
      // egress_blocked sentinel. If this arm ever starts failing because the
      // kind became 'egress_blocked', that is a contract change to query()
      // and it needs its own phase -- do not "fix" this arm to match.
      assert.strictEqual(queryRefusal.kind, 'unreachable');
      assert.notStrictEqual(queryRefusal.kind, 'egress_blocked');
    });

    // -------------------------------------------------------------------
    // Arm 8: honestRefusal() unit arms, in process, against the real
    // extracted source.
    // -------------------------------------------------------------------
    await record('Arm 8: honestRefusal() unit arms (extracted from the real shim source)', async () => {
      const honestRefusal = extractHonestRefusalFn();

      const r1 = honestRefusal(null, 'brain_search');
      assert.strictEqual(r1.kind, 'unreachable');

      const r2 = honestRefusal({ error: 'egress_blocked', tool: 'brain_search', egress_class: 'content_set' }, 'brain_search');
      assert.strictEqual(r2.kind, 'egress_blocked');
      assert.strictEqual(r2.status, 'BRAIN_EGRESS_BLOCKED');

      const passthroughInput = { records: [{ a: 1 }] };
      const r3 = honestRefusal(passthroughInput, 'brain_query');
      assert.strictEqual(r3, passthroughInput, 'a success payload must pass through unchanged, by identity');

      const otherErrorInput = { error: 'something_else' };
      const r4 = honestRefusal(otherErrorInput, 'brain_write');
      assert.strictEqual(r4, otherErrorInput, 'only the exact egress_blocked string is special; other .error values pass through unchanged');
    });
  } finally {
    await stopCaptureServer(server);
    spawnedProcs.forEach((p) => { try { p.kill('SIGKILL'); } catch (_e) { /* already gone */ } });
  }

  // Hygiene check (Task 3 acceptance criteria): no orphaned shim process
  // spawned BY THIS SUITE survives the run. Checked by PID existence
  // (process.kill(pid, 0) throws ESRCH once the process is reaped), not by
  // a `ps aux` substring scan -- this repo's own live mindrian-brain MCP
  // connections (Claude Code's own plugin session driving this very test)
  // share the same executable path and would false-positive a substring
  // scan; a specific-PID check cannot confuse this suite's own children
  // with an unrelated long-running server. SIGKILL delivery is async (the
  // kernel needs a moment to actually reap the process), so poll briefly
  // rather than checking once immediately after kill().
  function isAlive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (_e) {
      return false; // ESRCH -- process is gone, as expected.
    }
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

  process.stdout.write(
    '\nPhase 257-06 shim honest-refusal suite: ' + (failed === 0 ? 'PASS' : 'FAIL') + ' (' + failed + ' failures)\n'
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('UNEXPECTED ERROR: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  spawnedProcs.forEach((p) => { try { p.kill('SIGKILL'); } catch (_e) { /* already gone */ } });
  process.exit(1);
});
