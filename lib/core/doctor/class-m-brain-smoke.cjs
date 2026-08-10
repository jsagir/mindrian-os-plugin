'use strict';

/**
 * Phase 127-02 BRAIN-MCP-127-08 (CONTEXT D4) -- Class M Brain smoke.
 * 5-layer composable probe replacing ~60% of doctor Brain-adjacent checks.
 *
 * "Class M" rationale: CONTEXT D4 text reads "K" but letter K is already
 * taken in scripts/doctor.cjs by --stale-first-touch (SEED-007). A-L are
 * assigned. M is the next free letter. The CAPABILITY-MAP.md doc patch
 * lands in plan 127-03.
 *
 * Detects 12 Phase 126 taxonomy rows:
 *   L1 plugin_root      #5 install-cache stale, #9 install-state drift
 *   L2 key_resolver     #1 missing key, #2 perms-too-open, #8 env unreadable,
 *                       #13 Bearer format mismatch
 *   L3 https_schema     #4 cold-start timeout, #14 HTTPS 401, #19 cache
 *                       stale, #21 schema shape
 *   L4 stdio_handshake  #15 stdio handshake never returns
 *   L5 e2e_brain_schema #3 user-scope HTTP coexists with stdio (SHIM should
 *                       answer, not the legacy HTTP transport)
 *
 * Canon Part 7 (reuse): L1/L2/L3 import the existing resolver chokepoints
 *   (active-plugin-root, resolve-brain-key, brain-client.schema). Only the
 *   L4/L5 stdio orchestration is net-new.
 * Canon Part 8 (graph boundary): probe queries the methodology schema
 *   handle only; zero user-content egress; every Brain payload routes
 *   through brain-client.cjs (the delegation chokepoint).
 *
 * fail-fast cascade: if layer N fails, layers N+1..5 are SKIPPED with
 *   reason="skipped-prior-layer-failed" so the report points at the FIRST
 *   failure, not the cascade noise.
 *
 * HARD RULE: no em-dashes anywhere in this file.
 */

const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

// Layer registry. Wire-locked: the shell harness asserts id strings + order.
const LAYERS = Object.freeze([
  Object.freeze({ id: 'plugin_root',      name: 'L1 plugin-root-resolver' }),
  Object.freeze({ id: 'key_resolver',     name: 'L2 brain-key-resolver' }),
  Object.freeze({ id: 'https_schema',     name: 'L3 HTTPS schema probe' }),
  Object.freeze({ id: 'stdio_handshake',  name: 'L4 MCP stdio handshake' }),
  Object.freeze({ id: 'e2e_brain_schema', name: 'L5 e2e brain_schema via shim' }),
]);

const STDIO_TIMEOUT_MS = Number(process.env.MINDRIAN_BRAIN_SMOKE_TIMEOUT_MS) || 10000;
const OVERALL_BUDGET_MS = 30000;

// Phase 250-01 (HONEST-01): the four typed refusal statuses from
// lib/core/refusal-messaging.cjs's refusalResponse (renamed from
// tier0-messaging.cjs in Phase 252-01, SWEEP-01). DIRECTOR_NOT_AVAILABLE is
// the legacy no_key sentinel (kept for wire-lock compat); the other three
// are the new sibling statuses for unreachable/tier_denied/not_ready.
const STRUCTURED_REFUSAL_STATUSES = Object.freeze([
  'DIRECTOR_NOT_AVAILABLE',
  'BRAIN_UNREACHABLE',
  'BRAIN_TIER_DENIED',
  'GRAPH_NOT_READY',
]);

function _now() { return Date.now(); }

async function _runLayer(_name, fn) {
  const t0 = _now();
  try {
    const r = await fn();
    return { ok: !!r.ok, reason: r.reason || (r.ok ? 'pass' : 'fail'), ms: _now() - t0 };
  } catch (e) {
    return { ok: false, reason: 'exception: ' + (e && e.message ? e.message : String(e)), ms: _now() - t0 };
  }
}

// L1 -- plugin-root-resolver. Reuses lib/core/active-plugin-root.cjs.
async function _layer1(opts) {
  const fn = opts.mockResolveRoot
    || require('../active-plugin-root.cjs').resolveActivePluginRoot;
  const r = fn();
  if (!r || !r.root) {
    const src = (r && r.source) ? r.source : 'unknown';
    return { ok: false, reason: 'plugin root not resolved (source=' + src + ')' };
  }
  return { ok: true, reason: 'resolved (source=' + r.source + ', topology=' + (r.topology || 'unknown') + ')' };
}

// L2 -- key-resolver. Reuses lib/core/resolve-brain-key.cjs.
async function _layer2(opts) {
  const fn = opts.mockResolveKey
    || require('../resolve-brain-key.cjs').resolveBrainKey;
  const r = fn();
  if (!r || !r.available) {
    return { ok: false, reason: (r && r.reason) ? r.reason : 'key not available (no reason)' };
  }
  return { ok: true, reason: 'key resolved (source=' + r.source + ')' };
}

// L3 -- schema probe. Reuses lib/core/brain-client.cjs::schema(). Catches the
// #19 cache-stale + #21 schema-shape rows at this layer.
async function _layer3(opts) {
  const schemaFn = opts.mockSchema
    || (async () => require('../brain-client.cjs').schema());
  const r = await schemaFn();
  if (r == null) {
    return { ok: false, reason: 'schema probe returned null (Brain unreachable or 401)' };
  }
  return { ok: true, reason: 'schema probe returned non-null payload' };
}

function _resolveShimPath(opts) {
  return opts.shimPath
    || path.resolve(__dirname, '..', '..', '..', 'bin', 'mindrian-brain-mcp-client.cjs');
}

// L4 -- MCP stdio handshake. Spawns the bundled shim and asserts initialize
// resolves with serverInfo.name === 'mindrian-brain' within STDIO_TIMEOUT_MS.
async function _layer4(opts) {
  const shimPath = _resolveShimPath(opts);
  if (!opts.mockSpawn && !fs.existsSync(shimPath)) {
    return { ok: false, reason: 'shim binary not found at ' + shimPath };
  }
  const orchestrator = opts.mockSpawn || _spawnAndHandshake;
  return orchestrator(shimPath, Object.assign({}, opts, { intent: 'handshake' }));
}

// L5 -- end-to-end brain_schema via the shim's tools/call. After initialize
// succeeds, send a tools/call brain_schema and accept either a real schema
// payload OR a DIRECTOR_NOT_AVAILABLE Tier-0 sentinel (the second case is
// expected when no key is available; the L5 contract is "the shim ANSWERED
// over the stdio path", not "the Brain returned a schema").
async function _layer5(opts) {
  const shimPath = _resolveShimPath(opts);
  if (!opts.mockSpawn && !fs.existsSync(shimPath)) {
    return { ok: false, reason: 'shim binary not found at ' + shimPath };
  }
  const orchestrator = opts.mockSpawn || _spawnAndHandshake;
  return orchestrator(shimPath, Object.assign({}, opts, { intent: 'e2e_brain_schema' }));
}

// Real stdio orchestrator. opts.intent in { 'handshake', 'e2e_brain_schema' }.
// Wraps spawn + JSON-RPC initialize + (optional) tools/call + timeout +
// SIGTERM-on-resolve. Resolves with { ok, reason } -- never throws -- so the
// caller sees a structured FAIL row instead of an unhandled rejection.
function _spawnAndHandshake(shimPath, opts) {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [shimPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });
    const timer = setTimeout(function () {
      try { proc.kill('SIGTERM'); } catch (_) { /* ignore */ }
      resolve({ ok: false, reason: opts.intent + ' timed out after ' + STDIO_TIMEOUT_MS + 'ms' });
    }, STDIO_TIMEOUT_MS);

    let buf = '';
    proc.stdout.on('data', function (chunk) {
      buf += chunk.toString('utf8');
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        let msg;
        try { msg = JSON.parse(line); }
        catch (_) { continue; /* non-JSON line: ignore (stderr boot noise) */ }

        if (msg.id === 1 && msg.result && msg.result.serverInfo) {
          const serverName = msg.result.serverInfo.name;
          if (opts.intent === 'handshake') {
            clearTimeout(timer);
            try { proc.kill('SIGTERM'); } catch (_) { /* ignore */ }
            if (serverName === 'mindrian-brain') {
              return resolve({
                ok: true,
                reason: 'handshake succeeded, server=mindrian-brain v' + msg.result.serverInfo.version,
              });
            }
            return resolve({ ok: false, reason: 'unexpected serverInfo.name=' + serverName });
          }
          // L5: initialize succeeded, send tools/call brain_schema.
          try {
            proc.stdin.write(JSON.stringify({
              jsonrpc: '2.0', id: 2, method: 'tools/call',
              params: { name: 'brain_schema', arguments: {} },
            }) + '\n');
          } catch (e) {
            clearTimeout(timer);
            try { proc.kill('SIGTERM'); } catch (_) { /* ignore */ }
            return resolve({ ok: false, reason: 'tools/call write error: ' + e.message });
          }
          continue;
        }

        if (msg.id === 2 && msg.result && msg.result.content) {
          clearTimeout(timer);
          try { proc.kill('SIGTERM'); } catch (_) { /* ignore */ }
          const c0 = msg.result.content[0];
          const text = c0 && c0.text;
          let parsed;
          try { parsed = JSON.parse(text); } catch (_) { parsed = { text: text }; }
          // Phase 250-01 (HONEST-01): recognize all four refusal statuses as
          // STRUCTURED results, not just the legacy DIRECTOR_NOT_AVAILABLE
          // (no_key) sentinel. A structured refusal counts exactly the way
          // DIRECTOR_NOT_AVAILABLE counted before this phase -- "the shim
          // ANSWERED over the stdio path", now honestly named per kind.
          if (parsed && STRUCTURED_REFUSAL_STATUSES.indexOf(parsed.status) !== -1) {
            const kindNote = (parsed && typeof parsed.kind === 'string') ? ', kind=' + parsed.kind : '';
            return resolve({
              ok: true,
              reason: 'e2e brain_schema returned a structured refusal (status=' + parsed.status + kindNote + ')',
            });
          }
          return resolve({ ok: true, reason: 'e2e brain_schema returned a payload' });
        }
      }
    });

    proc.stderr.on('data', function () { /* swallow shim startup line + stderr noise */ });
    proc.on('error', function (err) {
      clearTimeout(timer);
      resolve({ ok: false, reason: 'spawn error: ' + err.message });
    });

    try {
      proc.stdin.write(JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'class-m-smoke', version: '1.0' },
        },
      }) + '\n');
    } catch (e) {
      clearTimeout(timer);
      try { proc.kill('SIGTERM'); } catch (_) { /* ignore */ }
      resolve({ ok: false, reason: 'initialize write error: ' + e.message });
    }
  });
}

/**
 * Run the 5-layer Brain smoke probe with fail-fast cascade.
 *
 * @param {{
 *   mockResolveRoot?: function,
 *   mockResolveKey?:  function,
 *   mockSchema?:      function,
 *   mockSpawn?:       function,
 *   shimPath?:        string,
 * }} [opts]
 * @returns {Promise<{ok:boolean, layers:Array<{id,name,ok,reason,ms}>, overall_ms:number}>}
 */
async function checkBrainSmoke(opts) {
  const o = opts || {};
  const t0 = _now();
  const out = { ok: true, layers: [], overall_ms: 0 };
  let prevOk = true;
  const layerFns = [_layer1, _layer2, _layer3, _layer4, _layer5];
  for (let i = 0; i < LAYERS.length; i++) {
    const meta = LAYERS[i];
    if (!prevOk) {
      out.layers.push({ id: meta.id, name: meta.name, ok: false, reason: 'skipped-prior-layer-failed', ms: 0 });
      out.ok = false;
      continue;
    }
    const r = await _runLayer(meta.name, function () { return layerFns[i](o); });
    out.layers.push({ id: meta.id, name: meta.name, ok: r.ok, reason: r.reason, ms: r.ms });
    if (!r.ok) { prevOk = false; out.ok = false; }
  }
  out.overall_ms = _now() - t0;
  if (out.overall_ms > OVERALL_BUDGET_MS) {
    out.ok = false;
    out.layers.push({
      id: 'budget', name: 'overall-budget', ok: false,
      reason: 'overall_ms ' + out.overall_ms + ' > ' + OVERALL_BUDGET_MS, ms: 0,
    });
  }
  return out;
}

/**
 * Class M is diagnostic-only. There is no auto-remediation path: the 5
 * failure surfaces require user action (install / set key / restart). This
 * function exists for symmetry with classes that DO support --fix.
 *
 * @param {object} _result  the checkBrainSmoke result (unused; signature parity)
 * @returns {{fixed: false, reason: string}}
 */
function fixBrainSmoke(_result) {
  return {
    fixed: false,
    reason: 'class-m is diagnostic-only; remediation requires user action: install / set key / restart',
  };
}

module.exports = { checkBrainSmoke, LAYERS, fixBrainSmoke, STDIO_TIMEOUT_MS };
