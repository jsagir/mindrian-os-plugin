'use strict';
/*
 * Phase 386 plan 13 (B10): /mos:rs-fetch with NEO4J_URI set must fall back to
 * the SQLite tier, not die with a TypeError. Fixture room only (Canon Part 8).
 * NEO4J_URI points at a closed loopback port with fake credentials. fetch is
 * replaced by a counter in the child process, so no network call can leave.
 *
 *   N1 NEO4J_URI at a closed loopback port: exit 0, JSON result, tier tier0
 *      with a fallback_reason.
 *   N2 NEO4J_URI unset: tier tier0 with no fallback_reason (pin).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

try { require('node:sqlite'); } catch (_) {
  process.stdout.write('SKIP test-386-rs-fetch-neo4j-fallback.cjs (node:sqlite unavailable)\n');
  process.exit(0);
}

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'scripts', 'rs-fetch-command.cjs');

let failures = 0;
function check(label, cond, detail) {
  if (cond) process.stdout.write('ok - ' + label + '\n');
  else { failures++; process.stdout.write('FAIL - ' + label + (detail ? ' :: ' + detail : '') + '\n'); }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'b10-386-13-'));
process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} });

const preload = path.join(tmp, 'nofetch.cjs');
fs.writeFileSync(preload,
  "let n=0;globalThis.fetch=async()=>{n++;throw new Error('network blocked');};\n" +
  "process.on('exit',()=>{process.stderr.write('FETCH_COUNT='+n+'\\n');});\n", 'utf8');

function run(withAura) {
  const room = fs.mkdtempSync(path.join(tmp, 'room-'));
  fs.mkdirSync(path.join(room, 'problem-definition'), { recursive: true });
  const env = Object.assign({}, process.env, { MINDRIAN_ROOM: room });
  delete env.MINDRIAN_BRAIN_KEY;
  delete env.NEO4J_URI; delete env.NEO4J_USER; delete env.NEO4J_PASSWORD;
  if (withAura) {
    env.NEO4J_URI = 'bolt://127.0.0.1:1';
    env.NEO4J_USER = 'fake';
    env.NEO4J_PASSWORD = 'fake';
  }
  const r = spawnSync(process.execPath, ['--no-warnings', '-r', preload, CLI, 'synthetic topic alpha', '--json'],
    { cwd: room, env, encoding: 'utf8', timeout: 120000 });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch (_) { /* leave null */ }
  const written = (json && json.output && json.output.written) || {};
  return { status: r.status, json, written, stderr: r.stderr || '' };
}

const n1 = run(true);
check('N1 exit 0 with NEO4J_URI at a closed loopback port', n1.status === 0,
  'exit=' + n1.status + ' stderr_first_line=' + (n1.stderr.split('\n').find((l) => /error/i.test(l)) || ''));
check('N1 stdout parses as JSON', n1.json !== null);
check('N1 result comes from the SQLite tier', n1.written.tier === 'tier0', 'tier=' + n1.written.tier);
check('N1 the fallback reason is recorded', typeof n1.written.fallback_reason === 'string' && n1.written.fallback_reason.length > 0);

const n2 = run(false);
check('N2 NEO4J_URI unset: exit 0', n2.status === 0, 'exit=' + n2.status);
check('N2 NEO4J_URI unset: tier0 with no fallback reason', n2.written.tier === 'tier0' && !n2.written.fallback_reason,
  'tier=' + n2.written.tier + ' fallback=' + n2.written.fallback_reason);

process.exit(failures === 0 ? 0 : 1);
