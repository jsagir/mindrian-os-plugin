#!/usr/bin/env node
'use strict';
// Regression: a stdio mindrian-mcp-server must exit when its host goes away
// WITHOUT sending SIGTERM (orphan leak, 2026-10-06: 104 orphaned servers,
// about 5.8 GB, reparented to pid 1 after child Claude sessions were killed).
//
// Leg A: the host closes stdin -> the server exits 0 within the deadline.
// Leg B: the host is SIGKILLed while a grandchild server keeps its stdin pipe
//        held by nobody else -> the server notices parent loss and exits.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'scripts', 'mindrian-mcp-server.cjs');
const DEADLINE_MS = 6000;

let failed = 0;
function ok(cond, msg) {
  if (cond) { console.log('  PASS ' + msg); } else { failed++; console.log('  FAIL ' + msg); }
}

function freshEnv() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-eof-'));
  return { ...process.env, MINDRIAN_ROOMS_HOME: home, CLAUDE_PROJECT_DIR: home, MINDRIAN_PARENT_WATCH_MS: '300' };
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (_e) { return false; }
}

function waitFor(pred, ms) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      if (pred()) return resolve(true);
      if (Date.now() - t0 > ms) return resolve(false);
      setTimeout(tick, 100);
    };
    tick();
  });
}

const INIT = JSON.stringify({
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'eof-test', version: '1' } },
}) + '\n';

async function legStdinEof() {
  console.log('Leg A: stdin close exits the server');
  const child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'], env: freshEnv() });
  let exitCode = null;
  child.on('exit', (c) => { exitCode = c; });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  const started = await waitFor(() => false, 1500); // let it boot
  void started;
  child.stdin.write(INIT);
  await waitFor(() => false, 500);
  child.stdin.end();
  const exited = await waitFor(() => exitCode !== null, DEADLINE_MS);
  ok(exited, `server exited within ${DEADLINE_MS} ms of stdin close`);
  ok(exitCode === 0, `exit code 0 (got ${exitCode})`);
  if (!exited) child.kill('SIGKILL');
}

async function legParentKill() {
  if (process.platform === 'win32') { console.log('Leg B: skipped on win32'); return; }
  console.log('Leg B: SIGKILLed host -> server exits (no SIGTERM ever sent)');
  // An intermediate "host" spawns the server and holds its stdin pipe, then is
  // SIGKILLed: exactly what happens to a killed child Claude session.
  const hostSrc = `
    const { spawn } = require('child_process');
    const s = spawn(process.execPath, [${JSON.stringify(SERVER)}], { stdio: ['pipe', 'ignore', 'ignore'] });
    process.stdout.write(String(s.pid) + '\\n');
    setInterval(() => {}, 1000);
  `;
  const host = spawn(process.execPath, ['-e', hostSrc], { stdio: ['ignore', 'pipe', 'ignore'], env: freshEnv() });
  const serverPid = await new Promise((resolve) => {
    host.stdout.once('data', (d) => resolve(parseInt(String(d).trim(), 10)));
  });
  ok(Number.isInteger(serverPid) && alive(serverPid), 'server started under host');
  await waitFor(() => false, 1500);
  host.kill('SIGKILL');
  const gone = await waitFor(() => !alive(serverPid), DEADLINE_MS);
  ok(gone, `server exited within ${DEADLINE_MS} ms of host SIGKILL`);
  if (!gone) { try { process.kill(serverPid, 'SIGKILL'); } catch (_e) { /* gone */ } }
}

(async () => {
  await legStdinEof();
  await legParentKill();
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
  process.exit(failed ? 1 : 0);
})();
