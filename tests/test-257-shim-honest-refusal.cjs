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
 * Nine arms (per 257-06-PLAN.md Task 3; Arms 4, 7, 8 moved and Arm 9 added by
 * 369.2-08, CODE-07, 2026-10-05):
 *   Arm 1 - G1 on the wire: brain_ask + the canary -> typed egress_blocked
 *           refusal, zero bytes reach the capture server.
 *   Arm 2 - anti-regression on the measured BEFORE shape (the empty,
 *           refusal-less DirectiveEnvelope G1 used to render).
 *   Arm 3 - block is not outage (mode_rationale, BRAIN_UNREACHABLE absence).
 *   Arm 4 - (369.2-08) the formerly ambiguous text is a plain question: it
 *           proceeds with no egress_disclosure (no shim verb carries a packet,
 *           so ambiguity is unreachable here; see test-254 Arm 9).
 *   Arm 5 - no laundering: the canary never rides the response or the wire.
 *   Arm 6 - the other tools: brain_search and brain_write also convert the
 *           sentinel to a typed refusal.
 *   Arm 7 - (369.2-08) G2 closed: brain_query on a block reports
 *           egress_blocked, never 'unreachable'.
 *   Arm 8 - honestRefusal() unit arms, in process, extracted from the real
 *           shim source (never a hand-duplicated copy of its logic) so a
 *           future edit to the real function is what this arm actually pins.
 *   Arm 9 - (369.2-08) brain_query on a block answers egress_blocked with a
 *           token_class.
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
// 369.2-08 (CODE-07, 2026-10-05): the real shim moved to scripts/ in 369.1 (D-10);
// bin/ holds a 396-byte forwarding launcher. Arm 8 extracts honestRefusal() from
// the real source, so it must read this path (it read the launcher before, a
// pre-existing red: the marker was never found in a one-line require).
const SHIM_SRC = path.join(REPO, 'scripts', 'mindrian-brain-mcp-client.cjs');

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

// 369.2-08 (CODE-07, 2026-10-05): the shim fires ONE content-free theo_health
// pre-warm at startup (quick 260911-ddd, scripts/mindrian-brain-mcp-client.cjs
// main(), lib/core/brain-prewarm.cjs: callTool('theo_health', {}), an empty
// payload). It lands on the capture server a few ms after the handshake, which
// races any zero-wire assertion. The blocked CALL under test opens no socket;
// the pre-warm is the shim's own startup probe. wireCalls() drops exactly that
// shape (name theo_health, empty arguments) and nothing else, so a blocked call
// that opened a socket still shows.
function wireCalls() {
  return captured.filter((c) => !(c && c.name === 'theo_health' && c.arguments && Object.keys(c.arguments).length === 0));
}

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
  const src = fs.readFileSync(SHIM_SRC, 'utf8');
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
      assert.strictEqual(wireCalls().length, 0, 'a blocked call must open no socket at all; captured: ' + capturedA);
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
    // Group B (Arm 4), RETIRED AS WRITTEN by 369.2-08 (CODE-07, 2026-10-05).
    // The Phase 257 arm drove an ambiguous brain_ask through the shim and
    // asserted its egress_disclosure reached the model. A free-form Theo string
    // is now allow or block, never ambiguous (theoVerdict), and NO shim verb
    // carries a typed packet (the six shim tools are brain_ask, brain_query,
    // brain_schema, brain_search, brain_stats, brain_write, all free-form or
    // empty), so an ambiguous verdict is unreachable from this shim. The old
    // text 'banana pancake recipe probe' is a plain question and now proceeds.
    // The disclosure contract itself is pinned where ambiguity still exists:
    // tests/test-254-ambiguous-disclosure.cjs Arm 9 (an unproven packet
    // through callTool) and tests/test-257-envelope-passthrough.cjs (the
    // wrapDirective carry). Arm 4 now pins the new truth on the wire: the
    // formerly ambiguous text proceeds and carries NO egress_disclosure.
    // -------------------------------------------------------------------
    resetCaptured();
    resetToolScript();
    const groupB = await driveShim(url, [{ name: 'brain_ask', arguments: { question: AMBIGUOUS_TEXT } }]);
    const envelopeB = parseEnvelope(groupB.calls[0]);
    const capturedBAsk = captured.filter((c) => c.name !== 'theo_health').length;

    await record('Arm 4 (369.2 CODE-07): the formerly ambiguous text is a plain question - it proceeds with no egress_disclosure', async () => {
      assert.ok(capturedBAsk > 0, 'a plain question must reach the wire; captured.length (without the pre-warm) was 0');
      assert.ok(!Object.prototype.hasOwnProperty.call(envelopeB, 'egress_disclosure'), 'an allow verdict must carry no egress_disclosure: ' + JSON.stringify(envelopeB));
      assert.ok(!Object.prototype.hasOwnProperty.call(envelopeB, 'refusal'), 'a plain question must not be refused: ' + JSON.stringify(envelopeB));
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
        // 369.2-08: a token-only canary (no email pattern) reaches room_content
        // with a token_class, which the email canary above (content_set) does not.
        { name: 'brain_query', arguments: { cypher: CANARY_TOKEN } },
      ],
      { toolsList: true }
    );
    const listedNames = (groupC.list && groupC.list.result && Array.isArray(groupC.list.result.tools))
      ? groupC.list.result.tools.map((t) => t.name)
      : [];
    const searchResult = groupC.calls[0] && groupC.calls[0].result;
    const writeResult = groupC.calls[1] && groupC.calls[1].result;
    const queryResult = groupC.calls[2] && groupC.calls[2].result;
    const queryTokenResult = groupC.calls[3] && groupC.calls[3].result;
    const capturedCLen = wireCalls().length;

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

    // 369.2-08 (CODE-07, 2026-10-05): Arm 7 MOVED. It pinned the accepted G2 gap
    // (D-05): brain_query returned null on a Part 8 block BEFORE callTool ran, so
    // the shim reported 'unreachable', a block read as an outage. Plan 01 closed
    // it: query() now returns the egress_blocked sentinel and honestRefusal()
    // maps it. The arm now pins the closed gap, and keeps the old kind out.
    await record('Arm 7 (369.2 CODE-07): G2 closed -- brain_query on a block reports egress_blocked, never unreachable', async () => {
      assert.ok(listedNames.indexOf('brain_query') !== -1, 'brain_query must appear in the live tools/list result; got: ' + JSON.stringify(listedNames));
      const queryRefusal = contentJson(queryResult);
      assert.strictEqual(queryRefusal.kind, 'egress_blocked', 'a block must read egress_blocked, got: ' + JSON.stringify(queryRefusal));
      assert.notStrictEqual(queryRefusal.kind, 'unreachable', 'a block must never read as an outage (G2)');
      assert.strictEqual(queryRefusal.status, 'BRAIN_EGRESS_BLOCKED');
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

      // 369.2-08 (CODE-07): a room_content block names its class and token_class.
      const r2b = honestRefusal({ error: 'egress_blocked', tool: 'brain_query', egress_class: 'room_content', token_class: 'identifier' }, 'brain_query');
      assert.strictEqual(r2b.kind, 'egress_blocked');
      assert.strictEqual(r2b.token_class, 'identifier');
      assert.match(r2b.reason, /class: room_content/);

      const passthroughInput = { records: [{ a: 1 }] };
      const r3 = honestRefusal(passthroughInput, 'brain_query');
      assert.strictEqual(r3, passthroughInput, 'a success payload must pass through unchanged, by identity');

      const otherErrorInput = { error: 'something_else' };
      const r4 = honestRefusal(otherErrorInput, 'brain_write');
      assert.strictEqual(r4, otherErrorInput, 'only the exact egress_blocked string is special; other .error values pass through unchanged');
    });

    // -------------------------------------------------------------------
    // Arm 9 (369.2 CODE-07, 2026-10-05): the G2 gap, closed on the wire.
    // brain_query on a block answers kind egress_blocked and names the
    // token_class, from the same Part 8 sentinel every other Theo verb uses.
    // -------------------------------------------------------------------
    await record('Arm 9 (369.2 CODE-07): brain_query on a block answers kind egress_blocked with a token_class', async () => {
      const queryRefusal = contentJson(queryTokenResult);
      assert.strictEqual(queryRefusal.kind, 'egress_blocked', 'brain_query block must read egress_blocked, got: ' + JSON.stringify(queryRefusal));
      assert.strictEqual(queryRefusal.status, 'BRAIN_EGRESS_BLOCKED');
      assert.ok(typeof queryRefusal.token_class === 'string' && queryRefusal.token_class.length > 0, 'the refusal must name a token_class, got: ' + JSON.stringify(queryRefusal));
      assert.ok(JSON.stringify(queryRefusal).indexOf(CANARY_TOKEN) === -1, 'the refusal must not echo the canary');
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
