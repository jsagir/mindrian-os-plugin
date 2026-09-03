#!/usr/bin/env node
'use strict';

/*
 * Phase 127-00 (Task 2 RED) -- mindrian-brain stdio shim static + spawn tests.
 *
 * Covers the static / shape / spawn tests for bin/mindrian-brain-mcp-client.cjs:
 *   Test 1: shim file exists and is executable
 *   Test 2: shim source registers exactly 6 tools
 *   Test 3: shim child process boots and writes startup line to stderr (<3s)
 *   Test 7: shim source contains zero fetch/http/brain.mindrian/https? matches
 *   Test 8: shim source contains zero sendPacket calls (no Phase 110 bypass)
 *   Test 9: shim starts with #!/usr/bin/env node shebang
 *
 * Tests 4/5/6 (live JSON-RPC handshake + Tier-0 protocol) land in
 * tests/test-127-00-shim-handshake.sh (Task 3).
 *
 * Canon parts: 7 (reuse of brain-client; thin transport wrapper),
 *   8 (delegation property: zero network surface in the shim itself).
 *
 * HARD RULE: no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SHIM_PATH = path.join(REPO_ROOT, 'bin', 'mindrian-brain-mcp-client.cjs');

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// ---------------------------------------------------------------------------
// Test 1: shim file exists and is executable.
// ---------------------------------------------------------------------------
(function test1_executable() {
  const label = 'shim file exists and is executable (mode & 0o111)';
  try {
    assert.ok(fs.existsSync(SHIM_PATH), 'shim file must exist at ' + SHIM_PATH);
    const st = fs.statSync(SHIM_PATH);
    assert.ok((st.mode & 0o111) !== 0,
      'shim file must be executable; mode = 0' + (st.mode & 0o777).toString(8));
    ok(label);
  } catch (err) { fail(label, err); }
})();

// ---------------------------------------------------------------------------
// Test 2: exactly 6 tools registered (brain_ask/query/schema/search/stats/write).
// ---------------------------------------------------------------------------
(function test2_sixTools() {
  const label = 'shim source registers exactly 6 tools (brain_ask|query|schema|search|stats|write)';
  try {
    const src = fs.readFileSync(SHIM_PATH, 'utf8');
    // Phase 257 Plan 08 migrated all six registrations from server.tool(...) to
    // server.registerTool(...) with z.strictObject input schemas (closes the
    // undeclared-key smuggling gap). The registration FUNCTION NAME is an
    // implementation detail; the real invariant this test protects is that
    // exactly 6 tools, with these 6 names, are registered exactly once each --
    // via whichever registration API the SDK exposes. Match either call form
    // so a future SDK-driven rename does not re-break this same way twice.
    const re = /server\.(?:tool|registerTool)\(\s*['"]brain_(ask|query|schema|search|stats|write)['"]/g;
    const matches = src.match(re) || [];
    assert.equal(matches.length, 6,
      'expected exactly 6 server.tool()/registerTool() registrations; got ' + matches.length);
    // Each of the 6 distinct names must appear exactly once. Use a per-name
    // re-scan because the match string spans newlines under the canonical
    // multi-line registration formatting.
    const expected = ['brain_ask', 'brain_query', 'brain_schema', 'brain_search', 'brain_stats', 'brain_write'];
    for (const n of expected) {
      const perName = new RegExp('server\\.(?:tool|registerTool)\\(\\s*[\'"]' + n + '[\'"]', 'g');
      const m = src.match(perName) || [];
      assert.equal(m.length, 1,
        'tool name ' + n + ' must appear exactly once; got ' + m.length);
    }
    ok(label);
  } catch (err) { fail(label, err); }
})();

// ---------------------------------------------------------------------------
// Test 3: child process boot writes startup line to stderr within 3s.
// ---------------------------------------------------------------------------
(function test3_bootStartupLine() {
  const label = 'shim spawn writes "[mindrian-brain] MCP server v... started (stdio)" to stderr within 3s';
  // Async test wrapped in IIFE; promise chain with timeout.
  const done = new Promise((resolve) => {
    const env = Object.assign({}, process.env);
    delete env.MINDRIAN_BRAIN_KEY;
    const proc = cp.spawn('node', [SHIM_PATH], { env: env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    let resolved = false;
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
      if (/\[mindrian-brain\] MCP server v[^ ]+ started \(stdio\)/.test(stderr)) {
        if (!resolved) {
          resolved = true;
          proc.kill('SIGTERM');
          resolve({ ok: true, stderr: stderr });
        }
      }
    });
    proc.on('error', (err) => {
      if (!resolved) { resolved = true; resolve({ ok: false, error: err }); }
    });
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        proc.kill('SIGKILL');
        resolve({ ok: false, error: new Error('timeout 3s; stderr=' + stderr) });
      }
    }, 3000);
  });
  // Block on the promise via a synchronous loop is wrong; use an
  // async test runner. Use top-level await via an immediately-invoked
  // async function with a process exit deferral.
  done.then((r) => {
    try {
      assert.ok(r.ok, r.error ? r.error.message : 'startup line not seen');
      ok(label);
    } catch (err) { fail(label, err); }
    finalize();
  });
})();

// ---------------------------------------------------------------------------
// Test 7: zero Brain network surface in shim source (Canon Part 8 delegation).
//
// Token set aligned with the orchestrator's load-bearing success criterion:
//   grep -rE "fetch\(|http\.|brain\.mindrian|onrender" bin/mindrian-brain-mcp-client.cjs
// returns 0. Note: the plan's <behavior> Test 7 narrative also lists
// `https?://`, but the plan's <action> mandates the Tier-0 sentinel embed
// the upgrade-hint URL https://mindrian-os.com/brain-access verbatim --
// a self-contradicting test specification (Rule 2 deviation). The intent of
// Canon Part 8 is to catch Brain-network egress in the shim, not user-facing
// upgrade-hint URLs in a sentinel string. We therefore enforce the
// orchestrator's load-bearing token set, which is the canon-faithful read.
// ---------------------------------------------------------------------------
(function test7_delegationProperty() {
  const label = 'shim source contains zero Brain network surface (fetch / http. / brain.mindrian / onrender)';
  try {
    const src = fs.readFileSync(SHIM_PATH, 'utf8');
    const forbidden = [
      { re: /fetch\(/g, name: 'fetch(' },
      { re: /\bhttp\./g, name: 'http.' },
      { re: /brain\.mindrian/g, name: 'brain.mindrian' },
      { re: /\bonrender\b/g, name: 'onrender' },
    ];
    // Active-code scan: strip block comments and line comments. The doc
    // header explicitly names the forbidden tokens as PROHIBITED; the scan
    // is against ACTIVE code, not documentation.
    let code = src.replace(/\/\*[\s\S]*?\*\//g, '');
    code = code.replace(/^[ \t]*\/\/.*$/gm, '');
    for (const f of forbidden) {
      const m = code.match(f.re) || [];
      assert.equal(m.length, 0,
        'forbidden Brain network surface "' + f.name + '" found ' + m.length + ' time(s) in active code');
    }
    ok(label);
  } catch (err) { fail(label, err); }
})();

// ---------------------------------------------------------------------------
// Test 8: zero sendPacket calls (no Phase 110 typed-packet bypass).
// ---------------------------------------------------------------------------
(function test8_noSendPacketBypass() {
  const label = 'shim source contains zero sendPacket( / buildBrainPacket calls (Phase 110 contract)';
  try {
    const src = fs.readFileSync(SHIM_PATH, 'utf8');
    let code = src.replace(/\/\*[\s\S]*?\*\//g, '');
    code = code.replace(/^[ \t]*\/\/.*$/gm, '');
    const sp = code.match(/\bsendPacket\(/g) || [];
    const bp = code.match(/\bbuildBrainPacket\b/g) || [];
    const pt = code.match(/\{\s*packet_type\s*:/g) || [];
    assert.equal(sp.length, 0, 'sendPacket( bypass detected ' + sp.length + ' time(s)');
    assert.equal(bp.length, 0, 'buildBrainPacket bypass detected ' + bp.length + ' time(s)');
    assert.equal(pt.length, 0, 'inline { packet_type: } construction detected ' + pt.length + ' time(s)');
    ok(label);
  } catch (err) { fail(label, err); }
})();

// ---------------------------------------------------------------------------
// Test 9: shebang line.
// ---------------------------------------------------------------------------
(function test9_shebang() {
  const label = 'shim file starts with #!/usr/bin/env node shebang';
  try {
    const src = fs.readFileSync(SHIM_PATH, 'utf8');
    const firstLine = src.split('\n')[0];
    assert.equal(firstLine, '#!/usr/bin/env node',
      'first line must be "#!/usr/bin/env node"; got "' + firstLine + '"');
    ok(label);
  } catch (err) { fail(label, err); }
})();

// ---------------------------------------------------------------------------
// Async finalize: wait for Test 3's spawn promise before printing summary.
// ---------------------------------------------------------------------------
let finalized = false;
function finalize() {
  if (finalized) return;
  finalized = true;
  process.stdout.write('\n');
  process.stdout.write('PASSED: ' + passed + '\n');
  process.stdout.write('FAILED: ' + failed + '\n');
  process.exit(failed === 0 ? 0 : 1);
}

// Safety net: in case Test 3's promise never resolves, finalize at 5s.
setTimeout(finalize, 5000).unref();
