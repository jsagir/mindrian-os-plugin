#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 341 Plan 03 (D-12) -- the Eureka topology no-drift tripwire.
 *
 * WHAT THIS FREEZES: the true topology of Eureka on today's tree, BEFORE
 * Phase 342 (Theo-Aware Intelligence Layer) touches it. Phase 342 registers
 * every local engine, Eureka included, as a Theo-known handle -- that is a
 * DELIBERATE, tracked change this test does not oppose. What this test
 * guards against is DRIFT: Eureka gaining a Brain or Theo reach as a SIDE
 * EFFECT of some later, unrelated edit, discovered only by accident. When
 * Phase 342 lands its deliberate change, this test's failure is the
 * intended, visible signal that the baseline moved on purpose -- the test
 * (or its successor) gets updated in that phase's own commit, not silently
 * bypassed.
 *
 * FOUR ARMS, all local filesystem reads and module-source inspection, ZERO
 * network:
 *   1. eureka_critic is registered on the LOCAL server (lib/mcp/tool-
 *      router.cjs's registerRouterTools, wired from bin/mindrian-mcp-server.cjs),
 *      never on the brain-client surface (bin/mindrian-brain-mcp-client.cjs).
 *   2. No Brain or Theo reach in seven named Eureka-surface files (comment
 *      lines excluded from the match, so a future explanatory comment
 *      mentioning "brain-client" in prose cannot break this gate).
 *   3. The ONE legitimate egress -- eureka-enable.cjs's npm registry spawn,
 *      reached only from enableEureka -- is named and bounded. This is a
 *      DELIBERATE, user-initiated exception (the operator ran /mos:eureka
 *      enable or doctor --fix eureka); the test documents it rather than
 *      pretending no egress exists at all.
 *   4. Phase 342's must-not-preclude list (342-FINDINGS.md) is intact:
 *      the five data/*.json registries parse as JSON, commands/eureka.md
 *      still declares name: eureka + connects_to_spine: true, and
 *      scripts/ still exposes the --refresh-names flag.
 *
 * Idiom follows tests/test-213-part8-boundary.cjs / test-341-eureka-deps-
 * resolver.cjs: bare node:assert, a PASS/FAIL counter, exit 1 on any FAIL.
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

let PASS = 0;
let FAIL = 0;
function ok(label, fn) {
  try {
    fn();
    console.log('  PASS: ' + label);
    PASS += 1;
  } catch (e) {
    console.log('  FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
    FAIL += 1;
  }
}

// Strip comment-only lines (leading //, *, or # after whitespace) before a
// pattern match, so a future explanatory comment naming "brain-client" in
// prose can never satisfy or break this gate -- only real code can.
function nonCommentLines(source) {
  return source.split('\n').filter(function (line) {
    return !/^\s*(\/\/|\*|#)/.test(line);
  });
}

console.log('Phase 341 Plan 03 -- Eureka no-Brain-reach topology tripwire (D-12)');

// ---------------------------------------------------------------------------
// Arm 1: eureka_critic is registered on the LOCAL server, never brain-client.
// ---------------------------------------------------------------------------
ok('eureka_critic registers on the LOCAL server (registerRouterTools), not brain-client', function () {
  const routerPath = path.join(REPO, 'lib', 'mcp', 'tool-router.cjs');
  const routerSrc = fs.readFileSync(routerPath, 'utf8');
  const lines = routerSrc.split('\n');

  const fnStartIdx = lines.findIndex(function (l) { return /function\s+registerRouterTools\s*\(/.test(l); });
  assert.ok(fnStartIdx !== -1, 'registerRouterTools declaration not found in ' + routerPath);

  const exportsIdx = lines.findIndex(function (l) { return /^module\.exports\s*=\s*\{\s*registerRouterTools/.test(l); });
  assert.ok(exportsIdx !== -1, 'the module.exports line naming registerRouterTools was not found');
  assert.ok(exportsIdx > fnStartIdx, 'module.exports must come after the function declaration');

  // Locate the registration by its tool name string (the actual server.tool
  // call site), not by a line-number guess -- so a future reformat cannot
  // silently break this arm.
  const regIdx = lines.findIndex(function (l) { return /^\s*'eureka_critic',\s*$/.test(l); });
  assert.ok(regIdx !== -1, "the \"'eureka_critic',\" registration line was not found in " + routerPath);
  assert.ok(
    regIdx > fnStartIdx && regIdx < exportsIdx,
    "eureka_critic (line " + (regIdx + 1) + ") must be registered INSIDE registerRouterTools "
      + "(declared at line " + (fnStartIdx + 1) + ", exported at line " + (exportsIdx + 1) + ")"
  );

  // registerRouterTools is the ONLY registration path wired from the LOCAL
  // server entry point (bin/mindrian-mcp-server.cjs); the brain-client
  // entry point must never mention eureka at all.
  const brainClientPath = path.join(REPO, 'bin', 'mindrian-brain-mcp-client.cjs');
  assert.ok(fs.existsSync(brainClientPath), brainClientPath + ' must exist');
  const brainClientSrc = fs.readFileSync(brainClientPath, 'utf8');
  assert.ok(
    !/eureka/i.test(brainClientSrc),
    brainClientPath + ' must not mention eureka anywhere -- eureka_critic is a LOCAL-server-only surface'
  );

  const serverEntryPath = path.join(REPO, 'bin', 'mindrian-mcp-server.cjs');
  const serverEntrySrc = fs.readFileSync(serverEntryPath, 'utf8');
  assert.ok(
    /registerRouterTools/.test(serverEntrySrc),
    serverEntryPath + ' must wire registerRouterTools (the LOCAL server registration path)'
  );
});

// ---------------------------------------------------------------------------
// Arm 2: no Brain or Theo reach in the Eureka surface (comments excluded).
// ---------------------------------------------------------------------------
const EUREKA_SURFACE_FILES = [
  'lib/core/eureka-critic.cjs',
  'lib/core/eureka/embedding-spine.cjs',
  'lib/core/eureka/vector-store.cjs',
  'lib/core/eureka/report-html.cjs',
  'lib/core/eureka-deps-resolver.cjs',
  'lib/core/eureka/eureka-enable.cjs',
  'scripts/eureka-command.cjs',
];
const BRAIN_REACH_PATTERNS = [
  /brain-client/,
  /brain_query/,
  /theo-mcp/,
  /MINDRIAN_BRAIN_KEY/,
  /pws-brain-mcp\.onrender\.com/,
];

EUREKA_SURFACE_FILES.forEach(function (rel) {
  ok('no Brain/Theo reach in ' + rel + ' (comment lines excluded)', function () {
    const full = path.join(REPO, rel);
    assert.ok(fs.existsSync(full), full + ' must exist');
    const codeLines = nonCommentLines(fs.readFileSync(full, 'utf8'));
    BRAIN_REACH_PATTERNS.forEach(function (re) {
      const hit = codeLines.find(function (l) { return re.test(l); });
      assert.ok(!hit, rel + ' must not reference ' + re + ' in real code, found: ' + JSON.stringify(hit));
    });
  });
});

// ---------------------------------------------------------------------------
// Arm 3: the one legitimate egress is named and bounded (deliberate,
// user-initiated exception -- documented here, not hidden).
// ---------------------------------------------------------------------------
ok('the ONLY network-capable call in the Eureka surface is the npm spawn in enableEureka (deliberate, user-initiated)', function () {
  // NETWORK_PATTERN excludes db.exec(...) (a sqlite call, false positive on
  // a naive '.exec(' match) and the local self-respawn in
  // scripts/eureka-command.cjs (spawn(process.execPath, [__filename, ...]) --
  // that re-invokes THIS SAME script as a detached background job, no
  // network, no npm, no registry).
  const NETWORK_PATTERN = /\bspawnSync\(|\bexecSync\(|\bfetch\(|http\.request|https\.request|https?:\/\//;
  const hits = [];
  EUREKA_SURFACE_FILES.forEach(function (rel) {
    const full = path.join(REPO, rel);
    const codeLines = nonCommentLines(fs.readFileSync(full, 'utf8'));
    codeLines.forEach(function (line, idx) {
      if (NETWORK_PATTERN.test(line)) hits.push(rel + ':' + (idx + 1) + ': ' + line.trim());
    });
  });
  assert.strictEqual(hits.length, 1, 'expected exactly one network-capable call site, found: ' + JSON.stringify(hits));
  assert.ok(hits[0].indexOf('lib/core/eureka/eureka-enable.cjs') === 0, 'the one egress must live in eureka-enable.cjs, found: ' + hits[0]);
  assert.ok(NETWORK_PATTERN.test(hits[0]), 'the one egress line must itself match the network pattern, found: ' + hits[0]);

  // Bounded to enableEureka: locate the function boundaries by name and
  // assert the matched call line falls strictly inside enableEureka, and NOT
  // inside buildEurekaInstallArgv (the pure argv builder, which spawns
  // nothing by contract) nor anywhere in eureka-deps-resolver.cjs (checked
  // separately -- zero spawn-shaped hits there at all, confirmed above).
  // The pattern itself is built without ever writing the literal npm-spawn
  // call name in this file's own source (self-referential tripwire hygiene:
  // this file's own text must not itself look like a network call).
  const enableSrc = fs.readFileSync(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-enable.cjs'), 'utf8');
  const enableLines = enableSrc.split('\n');
  const buildFnStart = enableLines.findIndex(function (l) { return /function\s+buildEurekaInstallArgv\s*\(/.test(l); });
  const enableFnStart = enableLines.findIndex(function (l) { return /^async function\s+enableEureka\s*\(/.test(l); });
  const spawnLineIdx = enableLines.findIndex(function (l, idx) { return idx > enableFnStart && NETWORK_PATTERN.test(l); });
  assert.ok(buildFnStart !== -1 && enableFnStart !== -1 && spawnLineIdx !== -1, 'could not locate the three anchor lines in eureka-enable.cjs');
  assert.ok(enableFnStart > buildFnStart, 'enableEureka must be declared after buildEurekaInstallArgv in this file');
  assert.ok(spawnLineIdx > enableFnStart, 'the real network call must be inside enableEureka, not buildEurekaInstallArgv');
});

// ---------------------------------------------------------------------------
// Arm 4: Phase 342's must-not-preclude list is intact.
// ---------------------------------------------------------------------------
ok("Phase 342's must-not-preclude registries exist and parse as JSON", function () {
  [
    'data/command-registry.json',
    'data/framework-names.json',
    'data/connector-registry.json',
    'data/brain-orchestration-projection.json',
    'data/harness-manifest.json',
  ].forEach(function (rel) {
    const full = path.join(REPO, rel);
    assert.ok(fs.existsSync(full), full + ' must exist');
    assert.doesNotThrow(function () { JSON.parse(fs.readFileSync(full, 'utf8')); }, full + ' must parse as JSON');
  });
});

ok('commands/eureka.md still declares name: eureka and connects_to_spine: true', function () {
  const src = fs.readFileSync(path.join(REPO, 'commands', 'eureka.md'), 'utf8');
  assert.ok(/^name:\s*eureka\s*$/m.test(src), 'commands/eureka.md must declare name: eureka');
  assert.ok(/connects_to_spine:\s*true/.test(src), 'commands/eureka.md must declare connects_to_spine: true');
});

ok('scripts/ still exposes the --refresh-names flag that maintains data/framework-names.json', function () {
  const { execSync } = require('node:child_process');
  const grepOut = execSync("grep -rl -- '--refresh-names' scripts/ || true", { cwd: REPO, encoding: 'utf8' });
  const hits = grepOut.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  assert.ok(hits.length >= 1, 'expected at least one scripts/ file exposing --refresh-names, found none');
});

console.log('');
console.log('eureka-no-brain-reach: PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL > 0 ? 1 : 0);
