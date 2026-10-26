#!/usr/bin/env node
'use strict';

/*
 * tests/test-doctor-mcp-write-path.cjs -- quick 261026-s8c item 4 (S8C-04).
 *
 * Proves lib/core/doctor/mcp-write-path-module.cjs, the doctor check that
 * measures whether the MCP write path is on for an unidentified client, and
 * WARNS with the fix text when it is off (owner decision D-02: warn, not error).
 *
 * Arms:
 *   1. STUB OFF       -- a stub server reports write_path_enabled false: warn + fix text.
 *   2. STUB ON        -- a stub server reports write_path_enabled true: ok.
 *   3. GARBAGE        -- a stub prints non-JSON: warn "could not measure".
 *   4. EXIT           -- a stub exits at once: warn "could not measure".
 *   5. NO FLOOR       -- a stub answers without capability_floor: warn "could not measure".
 *   6. WEDGED         -- a stub never answers: warn "could not measure" (timeout).
 *   7. TEMP DIRS      -- the check leaves no mindrian-write-path-* directory behind.
 *   8. REAL SERVER    -- the real server, three env combinations.
 *   9. CONTRACT       -- check(ctx) is synchronous, never throws, returns { status, detail }.
 *
 * Run: node tests/test-doctor-mcp-write-path.cjs
 * Exit: 0 when every arm passes, non-zero otherwise. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const mod = require(path.join(REPO_ROOT, 'lib', 'core', 'doctor', 'mcp-write-path-module.cjs'));
const REAL_SERVER = path.join(REPO_ROOT, 'scripts', 'mindrian-mcp-server.cjs');

let passed = 0;
let failed = 0;

function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    passed += 1;
    process.stdout.write('  ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    process.stdout.write('  FAIL - ' + label + '\n');
    if (detail) process.stdout.write('    ' + detail + '\n');
  }
}

function stubSource(floorJson) {
  return `
'use strict';
process.stdin.setEncoding('utf8');
let buf = '';
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\\n')) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let obj;
    try { obj = JSON.parse(line); } catch (e) { continue; }
    if (!obj) continue;
    if (obj.id === 1) {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'stub', version: '0' } } }) + '\\n');
    } else if (obj.id === 2) {
      const payload = ${floorJson};
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: JSON.stringify(payload) }] } }) + '\\n');
      process.exit(0);
    }
  }
});
process.stdin.on('end', () => process.exit(0));
`;
}

const STUB_OFF = stubSource(`{ ok: true, segments: { capability_floor: { surface: 'cli', host_tier: { host: 'unknown', hostTier: 'tier0' }, write_path_enabled: false } } }`);
const STUB_ON = stubSource(`{ ok: true, segments: { capability_floor: { surface: 'cli', host_tier: { host: 'unknown', hostTier: 'tier0' }, write_path_enabled: true } } }`);
const STUB_NO_FLOOR = stubSource(`{ ok: true, segments: {} }`);
const STUB_GARBAGE = `
'use strict';
process.stdin.resume();
process.stdout.write('this is not json\\n');
setTimeout(() => process.exit(0), 200);
`;
const STUB_EXIT = `'use strict'; process.exit(3);`;
const STUB_WEDGED = `
'use strict';
process.stdin.resume();
setInterval(() => {}, 60000);
`;

function countProbeDirs() {
  try {
    return fs.readdirSync(os.tmpdir()).filter((n) => n.indexOf('mindrian-write-path-') === 0).length;
  } catch (_e) {
    return -1;
  }
}

const UNSET_ENV = {
  MINDRIAN_TRANSPORT: null,
  CLAUDE_SURFACE: null,
  MINDRIAN_MCP_FIRST: null,
  COWORK_SESSION_ID: null,
  CLAUDE_CODE_ENTRYPOINT: 'cli',
};

(function run() {
  process.stdout.write('quick 261026-s8c item 4: doctor check mcp-write-path\n');
  const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-s8c-doctor-stub-'));
  try {
    const write = (name, src) => {
      const p = path.join(stubDir, name);
      fs.writeFileSync(p, src, 'utf8');
      return p;
    };
    const off = write('off.cjs', STUB_OFF);
    const on = write('on.cjs', STUB_ON);
    const noFloor = write('nofloor.cjs', STUB_NO_FLOOR);
    const garbage = write('garbage.cjs', STUB_GARBAGE);
    const exits = write('exit.cjs', STUB_EXIT);
    const wedged = write('wedged.cjs', STUB_WEDGED);

    check('module exports check, checkAgainstServer and PROBE_CLIENT_NAME',
      typeof mod.check === 'function' && typeof mod.checkAgainstServer === 'function' &&
      typeof mod.PROBE_CLIENT_NAME === 'string' && mod.PROBE_CLIENT_NAME.length > 0);
    if (typeof mod.checkAgainstServer !== 'function') {
      process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
      process.exit(1);
    }

    const before = countProbeDirs();

    // ARM 1: stub off
    const rOff = mod.checkAgainstServer(off, { timeoutMs: 8000 });
    process.stdout.write('  [stub off] ' + rOff.status + ': ' + rOff.detail + '\n');
    check('stub off -> status warn (D-02, never error)', rOff.status === 'warn');
    check('stub off -> detail starts with "mcp-write-path: write path OFF"',
      typeof rOff.detail === 'string' && rOff.detail.indexOf('mcp-write-path: write path OFF') === 0);
    check('stub off -> detail names surface=cli and host=unknown',
      rOff.detail.indexOf('surface=cli') !== -1 && rOff.detail.indexOf('host=unknown') !== -1);
    check('stub off -> detail carries the fix text MINDRIAN_MCP_FIRST=cli (or all)',
      rOff.detail.indexOf('MINDRIAN_MCP_FIRST=cli (or all)') !== -1);
    check('stub off -> detail says the probe client is unrecognized by design',
      /unrecognized by design/.test(rOff.detail) && /recognized client gets writes without the flag/.test(rOff.detail));

    // ARM 2: stub on
    const rOn = mod.checkAgainstServer(on, { timeoutMs: 8000 });
    process.stdout.write('  [stub on] ' + rOn.status + ': ' + rOn.detail + '\n');
    check('stub on -> status ok', rOn.status === 'ok');
    check('stub on -> detail names surface=cli', rOn.detail.indexOf('surface=cli') !== -1);

    // ARMS 3 to 6: cannot measure
    [['garbage output', garbage, 8000], ['immediate exit', exits, 8000],
      ['no capability_floor', noFloor, 8000], ['wedged server', wedged, 1500]].forEach(([label, p, t]) => {
      const r = mod.checkAgainstServer(p, { timeoutMs: t });
      process.stdout.write('  [' + label + '] ' + r.status + ': ' + r.detail + '\n');
      check(label + ' -> status warn', r.status === 'warn');
      check(label + ' -> detail starts with "mcp-write-path: could not measure"',
        typeof r.detail === 'string' && r.detail.indexOf('mcp-write-path: could not measure') === 0);
    });

    // ARM 8: real server
    if (fs.existsSync('/sessions')) {
      process.stdout.write('  SKIP - real-server arms need a machine without /sessions\n');
    } else {
      const rUnset = mod.checkAgainstServer(REAL_SERVER, { timeoutMs: 20000, envOverrides: UNSET_ENV });
      process.stdout.write('  [real, flag unset] ' + rUnset.status + ': ' + rUnset.detail + '\n');
      check('real server, ENTRYPOINT=cli, flag unset -> warn', rUnset.status === 'warn');
      check('real server, flag unset -> detail contains surface=cli', rUnset.detail.indexOf('surface=cli') !== -1);
      check('real server, flag unset -> detail contains MINDRIAN_MCP_FIRST=cli', rUnset.detail.indexOf('MINDRIAN_MCP_FIRST=cli') !== -1);

      const rFlag = mod.checkAgainstServer(REAL_SERVER, {
        timeoutMs: 20000, envOverrides: Object.assign({}, UNSET_ENV, { MINDRIAN_MCP_FIRST: 'cli' }),
      });
      process.stdout.write('  [real, flag cli] ' + rFlag.status + ': ' + rFlag.detail + '\n');
      check('real server, ENTRYPOINT=cli, flag cli -> ok', rFlag.status === 'ok');

      const rDesk = mod.checkAgainstServer(REAL_SERVER, {
        timeoutMs: 20000, envOverrides: Object.assign({}, UNSET_ENV, { MINDRIAN_MCP_FIRST: 'cli', CLAUDE_SURFACE: 'desktop' }),
      });
      process.stdout.write('  [real, desktop + flag cli] ' + rDesk.status + ': ' + rDesk.detail + '\n');
      check('real server, CLAUDE_SURFACE=desktop + flag cli -> warn', rDesk.status === 'warn');
      check('real server, desktop + flag cli -> detail contains surface=desktop', rDesk.detail.indexOf('surface=desktop') !== -1);
    }

    // ARM 7: temp dirs
    const after = countProbeDirs();
    check('no mindrian-write-path-* directory is left under os.tmpdir() (before ' + before + ', after ' + after + ')',
      before !== -1 && before === after);

    // ARM 9: contract
    let threw = false;
    let res;
    try { res = mod.check({ timeoutMs: 20000 }); } catch (_e) { threw = true; }
    check('check(ctx) never throws', threw === false);
    check('check(ctx) is synchronous and returns { status, detail } with status ok or warn',
      !!res && typeof res.then !== 'function' && (res.status === 'ok' || res.status === 'warn') && typeof res.detail === 'string');
    check('check(ctx) detail starts with "mcp-write-path:"', !!res && res.detail.indexOf('mcp-write-path:') === 0);
    check('no mindrian-write-path-* directory is left after check(ctx)', countProbeDirs() === before);
  } finally {
    try { fs.rmSync(stubDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }

  process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
})();
