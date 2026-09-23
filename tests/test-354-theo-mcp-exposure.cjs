'use strict';
// Phase 354 Plan 18 (THEO-04): regression test for
// scripts/check-theo-mcp-exposure.cjs -- the offline, advisory, WARN-only,
// never-blocking scan for the raw-theo-bypasses-egress-guard exposure.
//
// T1: both a theo-shaped and a mindrian-brain-shaped entry registered ->
//     exit 0, stdout names THEO-04 and both config paths.
// T2: only a mindrian-brain-shaped entry -> exit 0, "no exposure found".
// T3: malformed/missing ~/.claude.json -> exit 0, no throw.
// T4: zero network -- a preloaded stub makes fetch/http.request/https.request
//     throw if called; the script must still exit 0 (it never calls them).
//
// House rule: hyphens only, no em-dashes. CJS, node built-ins only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const SCRIPT = path.join(REPO, 'scripts', 'check-theo-mcp-exposure.cjs');
const mod = require(SCRIPT);

console.log('test-354-theo-mcp-exposure (Phase 354 Plan 18, THEO-04)');

let pass = 0;
let fail = 0;
function leg(desc, fn) {
  try {
    fn();
    pass += 1;
    console.log('  ok   (' + desc + ')');
  } catch (e) {
    fail += 1;
    if (e && (e.code === 'ERR_ASSERTION' || e.name === 'AssertionError')) {
      console.error('  RED  (' + desc + '): ' + e.message);
    } else {
      console.error('  ERROR(' + desc + '): harness error, NOT an assertion failure: ' + (e && e.stack ? e.stack : e));
    }
  }
}

function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'theo-mcp-exposure-test-'));
}

function runScript(homeDir) {
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: REPO,
    encoding: 'utf8',
    env: Object.assign({}, process.env, { HOME: homeDir }),
  });
}

// ---------------------------------------------------------------------------
// T1 -- both shapes registered in the same synthetic ~/.claude.json.
// ---------------------------------------------------------------------------
leg('T1: theo-shaped + mindrian-brain-shaped both present -> exit 0, stdout names THEO-04 and both paths', function () {
  const home = makeTempHome();
  const claudeJsonPath = path.join(home, '.claude.json');
  fs.writeFileSync(
    claudeJsonPath,
    JSON.stringify(
      {
        mcpServers: {
          theo: {
            type: 'stdio',
            command: 'node',
            args: [path.join(home, 'Theo', 'dist', 'index.js')],
            env: {},
          },
          'mindrian-brain': {
            type: 'stdio',
            command: 'node',
            args: [path.join(home, 'fake-plugin', 'bin', 'mindrian-brain-mcp-client.cjs')],
          },
        },
      },
      null,
      2
    )
  );

  const r = runScript(home);
  assert.equal(r.status, 0, 'advisory: must always exit 0');
  const out = String(r.stdout || '');
  assert.equal(out.indexOf('THEO-04') !== -1, true, 'stdout names THEO-04');
  assert.equal(out.indexOf(claudeJsonPath) !== -1, true, 'stdout names the synthetic config path (theo-shaped)');
  // The synthetic file carries BOTH shapes, so it is named as both the
  // theo-shaped location and the guarded-shim-shaped location; the repo's
  // own real .mcp.json (always present) also contributes a second
  // guarded-shim-shaped location. Assert the synthetic path appears at
  // least twice (once per role line).
  const occurrences = out.split(claudeJsonPath).length - 1;
  assert.equal(occurrences >= 2, true, 'synthetic config path named for both the theo-shaped and shim-shaped role lines');
});

// ---------------------------------------------------------------------------
// T2 -- only a mindrian-brain-shaped entry -> no exposure.
// ---------------------------------------------------------------------------
leg('T2: only mindrian-brain-shaped entry -> exit 0, "no exposure found"', function () {
  const home = makeTempHome();
  fs.writeFileSync(
    path.join(home, '.claude.json'),
    JSON.stringify(
      {
        mcpServers: {
          'mindrian-brain': {
            type: 'stdio',
            command: 'node',
            args: [path.join(home, 'fake-plugin', 'bin', 'mindrian-brain-mcp-client.cjs')],
          },
        },
      },
      null,
      2
    )
  );

  const r = runScript(home);
  assert.equal(r.status, 0, 'advisory: must always exit 0');
  const out = String(r.stdout || '');
  assert.equal(/no exposure found/i.test(out), true, 'stdout reports no exposure found');
});

// ---------------------------------------------------------------------------
// T3 -- malformed / missing ~/.claude.json -> no throw, exit 0.
// ---------------------------------------------------------------------------
leg('T3a: missing ~/.claude.json -> exit 0, no throw', function () {
  const home = makeTempHome(); // no .claude.json written at all
  const r = runScript(home);
  assert.equal(r.status, 0, 'advisory: must always exit 0 even with no config file');
  assert.equal(r.error, undefined, 'spawn itself must not error');
  assert.equal(/Error|EACCES|ENOENT/.test(String(r.stderr || '')), false, 'no unhandled error surfaces on stderr');
});

leg('T3b: malformed ~/.claude.json (invalid JSON) -> exit 0, no throw', function () {
  const home = makeTempHome();
  fs.writeFileSync(path.join(home, '.claude.json'), '{ this is not valid json ,,, ');
  const r = runScript(home);
  assert.equal(r.status, 0, 'advisory: must always exit 0 even on malformed JSON');
  assert.equal(r.error, undefined, 'spawn itself must not error');
});

// ---------------------------------------------------------------------------
// T4 -- zero network. A preloaded stub makes fetch/http.request/https.request
// throw if invoked; the script must still complete and exit 0, proving it
// never calls any of them.
// ---------------------------------------------------------------------------
leg('T4: zero network -- fetch/http.request/https.request stubbed to throw, script still exits 0', function () {
  const home = makeTempHome();
  fs.writeFileSync(
    path.join(home, '.claude.json'),
    JSON.stringify({ mcpServers: { theo: { command: 'node', args: ['/x/Theo/dist/index.js'] } } }, null, 2)
  );

  const preloadPath = path.join(home, 'no-network-preload.cjs');
  fs.writeFileSync(
    preloadPath,
    [
      "'use strict';",
      "global.fetch = function () { throw new Error('network blocked in test (fetch)'); };",
      "const http = require('node:http');",
      "http.request = function () { throw new Error('network blocked in test (http.request)'); };",
      "http.get = function () { throw new Error('network blocked in test (http.get)'); };",
      "const https = require('node:https');",
      "https.request = function () { throw new Error('network blocked in test (https.request)'); };",
      "https.get = function () { throw new Error('network blocked in test (https.get)'); };",
    ].join('\n')
  );

  const r = spawnSync(process.execPath, ['--require', preloadPath, SCRIPT], {
    cwd: REPO,
    encoding: 'utf8',
    env: Object.assign({}, process.env, { HOME: home }),
  });

  assert.equal(r.error, undefined, 'spawn itself must not error');
  assert.equal(r.status, 0, 'zero-network proof: script must still exit 0 with fetch/http/https stubbed to throw');
  const combined = String(r.stdout || '') + String(r.stderr || '');
  assert.equal(/network blocked in test/.test(combined), false, 'the network stub must never actually fire');
});

// ---------------------------------------------------------------------------
// Sanity: the exported pure functions classify entries correctly (no
// subprocess needed -- direct unit coverage of the classification core).
// ---------------------------------------------------------------------------
leg('unit: classifyEntry identifies theo-shaped and guarded-shim-shaped entries', function () {
  assert.equal(mod.classifyEntry({ command: 'node', args: ['/home/jsagi/Theo/dist/index.js'] }), 'theo-shaped');
  assert.equal(
    mod.classifyEntry({ command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/bin/mindrian-brain-mcp-client.cjs'] }),
    'guarded-shim-shaped'
  );
  assert.equal(mod.classifyEntry({ command: 'node', args: ['/some/other/server.js'] }), null);
  assert.equal(mod.classifyEntry(null), null);
});

console.log('\ntest-354-theo-mcp-exposure: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail > 0 ? 1 : 0);
