#!/usr/bin/env node
'use strict';
/*
 * tests/test-354-dashboard-host-read.cjs -- Phase 354-08 (SYS-06 recheck of the
 * 2026-09-20 localhost review's "Foreign Host accepted on read endpoint"
 * finding).
 *
 * The two layers that disagree: scripts/serve-dashboard-live already applies
 * checkHost() (the DNS-rebinding guard, R-87-09-CSRF gap 2) to its POST routes
 * (handleAuthSession, handleRoomChat) but requestHandler's GET dispatch never
 * calls it, so a forged Host header still reaches readStatus()/readGraphFromDb()/
 * readSection() and returns 200.
 *
 * Routes are ENUMERATED from requestHandler's own GET dispatch block (not
 * hard-coded), so this test tracks the real route list rather than a guess.
 *
 * RED-PROOF (against the pre-fix dashboard): every enumerated GET route returns
 * 200 with a foreign Host header, because requestHandler never checks Host
 * before dispatching a GET route. Fixed dashboards (or already-fixed dashboards)
 * return 403.
 *
 * Plain-Node harness matching tests/test-354-chat-inert-render.cjs's shape.
 * Hyphens only, no em-dashes (CLAUDE.md).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { makeScratchRoom } = require(path.join(__dirname, 'helpers', 'fixture-room-354.cjs'));

const REPO = path.resolve(__dirname, '..');
const SERVER_PATH = path.join(REPO, 'scripts', 'serve-dashboard-live');

console.log('test-354-dashboard-host-read');

let checks = 0;
let failed = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}
function fail(label, error) {
  failed += 1;
  console.log('  NOT OK - ' + label);
  console.log('    ' + (error && error.message ? error.message : String(error)));
}
function checkThat(label, fn) {
  try { fn(); ok(label); } catch (e) { fail(label, e); }
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

async function reservePort() {
  const s = http.createServer();
  const port = await listen(s);
  await new Promise((resolve) => s.close(resolve));
  return port;
}

// Enumerates the GET routes requestHandler actually dispatches. Reads from
// the source's own GET-dispatch block (after the `req.method !== 'GET'`
// gate, before the port-fallback section) rather than a hard-coded list, so
// this test tracks the real route surface, not a snapshot of it.
function extractGetRoutes(source) {
  const startMarker = "if (p === '/' || p === '/index.html')";
  const startIdx = source.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error('extractGetRoutes: GET dispatch marker not found in scripts/serve-dashboard-live (source shape changed)');
  }
  const endMarker = '// ---- port fallback';
  const endIdx = source.indexOf(endMarker, startIdx);
  const body = endIdx === -1 ? source.slice(startIdx) : source.slice(startIdx, endIdx);
  const routes = new Set();
  const staticRe = /p === '([^']+)'/g;
  let m;
  while ((m = staticRe.exec(body))) routes.add(m[1]);
  // The one dynamic route (/api/room/section/:name) needs a concrete example;
  // makeSeedRoom-style fixtures always have a 'problem-definition' directory
  // by convention -- pass it even if the room this test seeds doesn't have
  // that exact dir, since readSection() returns an empty-but-200 payload for
  // a directory that doesn't exist (never throws). The source spells this as
  // a JS regex literal (backslash-escaped slashes), so strip the escaping
  // before testing for the plain path substring.
  const unescaped = body.replace(/\\\//g, '/');
  if (unescaped.includes('/api/room/section/')) routes.add('/api/room/section/problem-definition');
  if (routes.size === 0) {
    throw new Error('extractGetRoutes: matched zero GET routes -- source shape changed, update the extraction');
  }
  return Array.from(routes);
}

// Resolves as soon as response headers land, then tears the request down.
// Works uniformly for ordinary JSON routes and the long-lived /events SSE
// stream (which would otherwise hang the test waiting for 'end').
function httpGetStatus(target, headers) {
  return new Promise((resolve, reject) => {
    const req = http.get(target, { headers }, (res) => {
      const statusCode = res.statusCode;
      res.resume();
      req.destroy();
      resolve(statusCode);
    });
    req.on('error', reject);
    req.setTimeout(4000, () => req.destroy(new Error('timeout: ' + target)));
  });
}

async function waitForBind(base, maxMs) {
  const deadline = Date.now() + (maxMs || 5000);
  while (Date.now() < deadline) {
    try {
      const status = await httpGetStatus(base + '/api/room/status');
      if (status === 200 || status === 403 || status === 404) return true;
    } catch (_e) { /* not yet up */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

(async () => {
  const source = fs.readFileSync(SERVER_PATH, 'utf8');
  let routes;
  try {
    routes = extractGetRoutes(source);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
    return;
  }
  console.log('  enumerated GET routes: ' + routes.join(', '));

  const { room, cleanup } = makeScratchRoom('dashboard-host-read');
  // A minimal problem-definition dir so the one dynamic route has a real,
  // non-empty artifact list to read (not required for the 200/403 check
  // itself, but keeps the fixture honest).
  fs.mkdirSync(path.join(room, 'problem-definition'), { recursive: true });
  fs.writeFileSync(path.join(room, 'ROOM.md'), '# 354-08 dashboard-host-read fixture\n');
  fs.writeFileSync(path.join(room, 'MINTO.md'), '# minto fixture\n');

  const port = await reservePort();
  const base = 'http://127.0.0.1:' + port;
  const child = spawn(
    process.execPath,
    [SERVER_PATH, '--port', String(port), '--no-open', '--room', room],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d.toString(); });

  try {
    const bound = await waitForBind(base, 8000);
    if (!bound) throw new Error('server did not bind within 8s; stderr=' + stderr);

    let anyForeignHost200 = false;
    for (const route of routes) {
      const foreignStatus = await httpGetStatus(base + route, { Host: 'review.invalid' });
      if (foreignStatus === 200) anyForeignHost200 = true;
      checkThat('foreign Host refused on GET ' + route + ' (403)', () => {
        assert.strictEqual(foreignStatus, 403, 'got ' + foreignStatus);
      });
    }

    for (const route of routes) {
      const validStatus = await httpGetStatus(base + route, { Host: '127.0.0.1:' + port });
      checkThat('valid Host still serves GET ' + route + ' (200)', () => {
        assert.strictEqual(validStatus, 200, 'got ' + validStatus);
      });
    }

    if (!anyForeignHost200 && failed === 0) {
      console.log('');
      console.log('DISPOSITION: ALREADY FIXED -- every enumerated GET route already refuses a foreign Host.');
    } else if (anyForeignHost200) {
      console.log('');
      console.log('DISPOSITION: CONFIRMED -- at least one GET route accepts a foreign Host (2026-09-20 review finding reproduced).');
    }
  } finally {
    try { child.kill('SIGINT'); } catch (_e) { /* ignore */ }
    await new Promise((r) => setTimeout(r, 250));
    try { child.kill('SIGKILL'); } catch (_e) { /* ignore */ }
    cleanup();
  }

  console.log('');
  if (failed > 0) {
    console.log('FAIL - ' + failed + ' of ' + (checks + failed) + ' checks failed (checks that ran: ' + checks + ')');
    process.exitCode = 1;
  } else {
    console.log('PASS - ' + checks + ' checks');
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
