'use strict';
// Phase 110-04 test: D-08 layer-2 pre-commit guard for Brain Context Packets.
// Mirrors tests/test-navigation-chokepoint-hook.cjs structure.
//
// Requirement: PACKET-110-05.
// Deliverable: a real child_process suite around the new
// `node scripts/check-schema-aliases.cjs --check-sendpacket` subcommand.
//
// Canon Part 8 (D-08 layer 2): the hook + review are the real teeth of the
// three-layer origin guarantee. The origin string is in-process-forgeable
// but a packet built outside lib/core/navigation.cjs::buildBrainPacket is
// catchable lexically: a `sendPacket(` call site MUST be lexically preceded
// by a `buildBrainPacket(` call in the same file.
//
// Cases:
//   1. empty staged set                                                  -> exit 0
//   2. bare sendPacket( with no buildBrainPacket( above it (a new caller) -> exit non-zero + D-08 message
//   3. same file but with buildBrainPacket( above the sendPacket( call    -> exit 0
//   4. allow-listed file (lib/core/brain-client.cjs -- the definition)    -> exit 0
//   5. non-JS file with the literal text 'sendPacket('                    -> exit 0
//
// CJS, node:assert/strict, node:child_process; zero new npm dependencies.

const { ok, equal, notEqual } = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(REPO_ROOT, 'scripts', 'check-schema-aliases.cjs');

function runCheck(files /* [{ path, content }] */) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-110-sendpacket-hook-'));
  const stagedPaths = [];
  for (const f of files) {
    const full = path.join(tmp, f.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, f.content);
    stagedPaths.push(f.path);
  }
  const env = Object.assign({}, process.env, {
    MINDRIAN_HOOK_STAGED_FILES: stagedPaths.join('\n'),
    MINDRIAN_HOOK_STAGED_CONTENT_DIR: tmp,
  });
  const r = spawnSync('node', [HOOK, '--check-sendpacket'], { env, encoding: 'utf8' });
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function test1_emptyStagedSet() {
  const r = runCheck([]);
  equal(r.code, 0, 'empty staged set passes; stderr=' + r.stderr);
}

function test2_bareSendPacketWithoutBuildBrainPacket() {
  const r = runCheck([{
    path: 'lib/feature/new-brain-caller.cjs',
    content: [
      "'use strict';",
      "const bc = require('../core/brain-client.cjs');",
      "async function go(packet) {",
      "  const r = await bc.sendPacket(packet);",
      "  return r;",
      "}",
      "module.exports = { go };",
      ""
    ].join('\n'),
  }]);
  notEqual(r.code, 0, 'bare sendPacket without buildBrainPacket must fail');
  ok(r.stderr.indexOf('D-08') !== -1, 'stderr cites D-08; stderr=' + r.stderr);
  ok(r.stderr.indexOf('new-brain-caller.cjs') !== -1, 'stderr names the offending file; stderr=' + r.stderr);
}

function test3_sendPacketPrecededByBuildBrainPacket() {
  const r = runCheck([{
    path: 'lib/feature/new-brain-caller.cjs',
    content: [
      "'use strict';",
      "const nav = require('../core/navigation.cjs');",
      "const bc = require('../core/brain-client.cjs');",
      "async function go(db, focusId) {",
      "  const packet = nav.buildBrainPacket(db, 'suggest_next_move', focusId);",
      "  const r = await bc.sendPacket(packet, { db });",
      "  return r;",
      "}",
      "module.exports = { go };",
      ""
    ].join('\n'),
  }]);
  equal(r.code, 0, 'sendPacket preceded by buildBrainPacket passes; stderr=' + r.stderr);
}

function test4_allowListedFile() {
  const r = runCheck([{
    path: 'lib/core/brain-client.cjs',
    content: [
      "'use strict';",
      "function sendPacket(packet, opts) { return packet; }",
      "module.exports = { sendPacket };",
      ""
    ].join('\n'),
  }]);
  equal(r.code, 0, 'brain-client.cjs is allow-listed; stderr=' + r.stderr);
}

function test5_nonJsFileSkipped() {
  const r = runCheck([{
    path: 'commands/foo.md',
    content: 'Call sendPacket( with a packet.\n',
  }]);
  equal(r.code, 0, 'non-JS files are not scanned; stderr=' + r.stderr);
}

function run() {
  const tests = [
    test1_emptyStagedSet,
    test2_bareSendPacketWithoutBuildBrainPacket,
    test3_sendPacketPrecededByBuildBrainPacket,
    test4_allowListedFile,
    test5_nonJsFileSkipped,
  ];
  let pass = 0; let fail = 0;
  for (const t of tests) {
    try { t(); pass++; process.stdout.write('PASS ' + t.name + '\n'); }
    catch (err) { fail++; process.stderr.write('FAIL ' + t.name + ': ' + err.message + '\n' + (err.stack || '') + '\n'); }
  }
  process.stdout.write('test-brain-packet-precommit-hook: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' (' + pass + '/' + tests.length + ' assertions)\n');
  process.exit(fail === 0 ? 0 : 1);
}

run();
