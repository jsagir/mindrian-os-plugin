#!/usr/bin/env node
'use strict';

/*
 * Phase 267 Plan 04 (MCPV2-13) -- self-test for tests/helpers/mcp-stdio-tee.cjs.
 * =============================================================================
 * Spawns `node tests/helpers/mcp-stdio-tee.cjs node bin/mindrian-mcp-server.cjs`
 * in a hermetic env (tests/helpers/mcp-wire-267.cjs's hermeticEnv, Canon Part
 * 8: MINDRIAN_BRAIN_URL points at an unreachable loopback, no real network
 * reachable from this test), drives initialize (2025-11-25, capabilities
 * {elicitation:{}}), notifications/initialized, tools/list, and one
 * tools/call of `contract_version` with a sentinel value smuggled into an
 * unused arguments key, then asserts:
 *   - the tee is a faithful pass-through (tool count through the tee equals
 *     a direct, un-teed spawn of the same server)
 *   - the log has a c2s initialize record with protocolVersion 2025-11-25
 *     and capabilityKeys containing 'elicitation'
 *   - the log has the matching s2c record with hasInstructions true
 *   - the log has a tools/call record with method only (no params, no result)
 *   - the sentinel string never appears anywhere in the log file
 *
 * Every spawned PID is force-killed in `finally` (killGroup: negative pid,
 * the whole process group, so the tee's OWN child -- the real server it
 * wraps -- is reaped too, not just the tee wrapper).
 *
 * No em-dashes. CJS, Node built-ins only.
 */

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { hermeticEnv, wireSnapshot, killTree, LOCAL_SERVER } = require('./helpers/mcp-wire-267.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const TEE = path.join(REPO_ROOT, 'tests', 'helpers', 'mcp-stdio-tee.cjs');
const SENTINEL = 'TEE-SENTINEL-DO-NOT-LOG';
const TIMEOUT_MS = 20000;

let pass = 0;
let fail = 0;
function check(label, cond, detail) {
  if (cond) {
    pass += 1;
    console.log('  ok -', label);
  } else {
    fail += 1;
    console.log('  FAIL -', label, detail !== undefined ? '(' + JSON.stringify(detail) + ')' : '');
  }
}

// Kill the WHOLE process group the tee (spawned with detached:true) is the
// leader of. The tee's own child (the real server it wraps) shares that
// group unless it detaches itself, which it does not. Falls back to a
// single-pid SIGKILL (tests/helpers/mcp-wire-267.cjs's killTree) if the
// group kill fails for any reason.
function killGroup(pid) {
  if (typeof pid !== 'number') return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch (_e) {
    killTree(pid);
  }
}

function driveThroughTee(env, logPath) {
  return new Promise((resolve) => {
    let child;
    try {
      child = cp.spawn('node', [TEE, 'node', LOCAL_SERVER], {
        cwd: REPO_ROOT,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true,
      });
    } catch (_e) {
      resolve({ responses: new Map(), stderr: '', pid: null });
      return;
    }

    let settled = false;
    let stdoutBuf = '';
    let stderrBuf = '';
    const responses = new Map();
    let timer = null;

    function finish() {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        child.stdin.end();
      } catch (_e) {
        /* already closed */
      }
      killGroup(child.pid);
      resolve({ responses, stderr: stderrBuf, pid: child.pid });
    }

    timer = setTimeout(finish, TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString('utf8');
      let nl;
      while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        let obj;
        try {
          obj = JSON.parse(line);
        } catch (_e) {
          continue;
        }
        if (obj && typeof obj.id !== 'undefined' && obj.id !== null) {
          responses.set(obj.id, obj);
        }
        if (responses.has(1) && responses.has(2) && responses.has(3)) finish();
      }
    });

    child.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString('utf8');
    });

    child.on('error', finish);
    child.on('exit', finish);

    try {
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-11-25',
            capabilities: { elicitation: {} },
            clientInfo: { name: 'mcp-tee-267-selftest', version: '1' },
          },
        }) + '\n'
      );
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'contract_version', arguments: { _sentinel: SENTINEL } },
        }) + '\n'
      );
    } catch (_e) {
      finish();
    }
  });
}

async function main() {
  const { env, cleanup } = hermeticEnv({});
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-tee-267-log-'));
  const logPath = path.join(logDir, 'tee.jsonl');
  env.MOS_TEE_LOG = logPath;

  try {
    console.log('-- direct (un-teed) baseline spawn --');
    const directSnapshot = await wireSnapshot(LOCAL_SERVER, {
      env: Object.assign({}, env),
      capabilities: { elicitation: {} },
    });
    console.log('  direct tool count: ' + directSnapshot.tools.length);

    console.log('');
    console.log('-- through the tee --');
    const teeResult = await driveThroughTee(env, logPath);

    const teeToolsResult = teeResult.responses.get(2) && teeResult.responses.get(2).result;
    const teeToolCount = teeToolsResult && Array.isArray(teeToolsResult.tools) ? teeToolsResult.tools.length : -1;
    check('tool count through the tee equals the direct spawn', teeToolCount === directSnapshot.tools.length, {
      tee: teeToolCount,
      direct: directSnapshot.tools.length,
    });

    const callResult = teeResult.responses.get(3);
    check(
      'tools/call(contract_version) through the tee returned a result (no error)',
      !!(callResult && callResult.result && !callResult.error),
      callResult
    );

    assert.ok(fs.existsSync(logPath), 'tee log file must exist at MOS_TEE_LOG');
    const rawLog = fs.readFileSync(logPath, 'utf8');
    const records = rawLog
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    console.log('');
    console.log('-- log records (' + records.length + ') --');

    const initC2S = records.find((r) => r.dir === 'c2s' && r.method === 'initialize');
    check('log has a c2s initialize record', !!initC2S, records);
    check('c2s initialize record protocolVersion is 2025-11-25', !!(initC2S && initC2S.protocolVersion === '2025-11-25'), initC2S);
    check(
      'c2s initialize record capabilityKeys contains elicitation',
      !!(initC2S && Array.isArray(initC2S.capabilityKeys) && initC2S.capabilityKeys.includes('elicitation')),
      initC2S
    );

    const initS2C = records.find((r) => r.dir === 's2c' && r.id === 1);
    check('log has an s2c initialize-response record with hasInstructions true', !!(initS2C && initS2C.hasInstructions === true), initS2C);

    const callRecord = records.find((r) => r.method === 'tools/call');
    check(
      'log has a tools/call record with method only (no params, no result keys)',
      !!(
        callRecord &&
        Object.prototype.hasOwnProperty.call(callRecord, 'method') &&
        !Object.prototype.hasOwnProperty.call(callRecord, 'params') &&
        !Object.prototype.hasOwnProperty.call(callRecord, 'result')
      ),
      callRecord
    );

    const sentinelAbsent = !rawLog.includes(SENTINEL);
    check('sentinel string TEE-SENTINEL-DO-NOT-LOG is absent from the log file', sentinelAbsent);

    console.log('');
    console.log('sentinel absent from log: ' + sentinelAbsent);
    console.log('---');
    console.log(pass + '/' + (pass + fail) + ' checks green');
    process.exitCode = fail === 0 ? 0 : 1;
  } finally {
    cleanup();
    try {
      fs.rmSync(logDir, { recursive: true, force: true });
    } catch (_e) {
      /* best effort */
    }
  }
}

main().catch((err) => {
  process.stderr.write('FATAL: ' + ((err && err.stack) || err) + '\n');
  process.exit(1);
});
