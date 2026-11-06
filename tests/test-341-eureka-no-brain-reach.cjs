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
 *   2. No Brain or Theo reach in the Eureka surface: six named files plus
 *      every perspective module under lib/core/research-planner/
 *      perspectives/ (comment lines excluded from the match, so a future
 *      explanatory comment mentioning "brain-client" in prose cannot break
 *      this gate). Phase 366-26 (D-02) moved this arm off the retired
 *      standalone runner and onto the perspective modules that replaced it.
 *   3. The sanctioned egress points are named and bounded. This is a
 *      DELIBERATE, user-initiated exception each time; the test documents
 *      them rather than pretending no egress exists at all.
 *      (a) eureka-enable.cjs's npm registry spawn, reached only from
 *          enableEureka (the encoder install; the operator ran /mos:eureka
 *          enable or doctor --fix eureka).
 *      (b) Phase 387 plan 06: the engine uv sync, built only inside
 *          runEngineSync (through uvSyncArgs) and called only after the
 *          approval test (--approved-via) of /mos:eureka enable engine.
 *      The engine doctor child (runEngineDoctor) runs offline and is NOT an
 *      egress: it builds its array through uvRunArgs with the offline
 *      defaults (--no-sync --offline --locked --no-python-downloads).
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
  const brainClientPath = path.join(REPO, 'scripts', 'mindrian-brain-mcp-client.cjs');
  assert.ok(fs.existsSync(brainClientPath), brainClientPath + ' must exist');
  const brainClientSrc = fs.readFileSync(brainClientPath, 'utf8');
  assert.ok(
    !/eureka/i.test(brainClientSrc),
    brainClientPath + ' must not mention eureka anywhere -- eureka_critic is a LOCAL-server-only surface'
  );

  const serverEntryPath = path.join(REPO, 'scripts', 'mindrian-mcp-server.cjs');
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
  'lib/core/semantic-index/embedding-spine.cjs',
  'lib/core/semantic-index/vector-store.cjs',
  'lib/core/eureka/report-html.cjs',
  'lib/core/eureka-deps-resolver.cjs',
  'lib/core/eureka/eureka-enable.cjs',
].concat(
  // Phase 366-26 (D-02): the perspective modules replace the retired
  // standalone runner as the Eureka compute surface. Discovered from disk
  // (sorted) so a new perspective joins the guard without a list edit; the
  // floor below fails closed if the directory ever goes missing or empty.
  fs.readdirSync(path.join(REPO, 'lib', 'core', 'research-planner', 'perspectives'))
    .filter(function (f) { return /\.cjs$/.test(f); })
    .sort()
    .map(function (f) { return 'lib/core/research-planner/perspectives/' + f; })
);

ok('the perspective modules are in the guarded Eureka surface (eureka-recall and eureka-judge at least)', function () {
  assert.ok(EUREKA_SURFACE_FILES.indexOf('lib/core/research-planner/perspectives/eureka-recall.cjs') !== -1,
    'perspectives/eureka-recall.cjs must be guarded');
  assert.ok(EUREKA_SURFACE_FILES.indexOf('lib/core/research-planner/perspectives/eureka-judge.cjs') !== -1,
    'perspectives/eureka-judge.cjs must be guarded');
});
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
  // a naive '.exec(' match). The perspective modules run in-process and
  // spawn nothing, so the one bounded egress below stays the only hit.
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
  // Phase 341 plan 08 (D-07b d): enableEureka is now a thin public wrapper over
  // _enableEurekaInner, where the installer body (and its single npm spawn) lives.
  // The anchor moved with the body. The wrapper must still be the ONLY caller.
  const enableFnStart = enableLines.findIndex(function (l) { return /^async function\s+_enableEurekaInner\s*\(/.test(l); });
  const wrapperDecl = enableLines.findIndex(function (l) { return /^async function\s+enableEureka\s*\(/.test(l); });
  const innerRefs = enableLines.filter(function (l) { return !/^\s*[*/]/.test(l) && /_enableEurekaInner\s*\(/.test(l); });
  assert.ok(wrapperDecl !== -1 && innerRefs.length === 2, 'enableEureka must be the single wrapper that calls _enableEurekaInner (declaration plus one call), refs: ' + innerRefs.length);
  const spawnLineIdx = enableLines.findIndex(function (l, idx) { return idx > enableFnStart && NETWORK_PATTERN.test(l); });
  assert.ok(buildFnStart !== -1 && enableFnStart !== -1 && spawnLineIdx !== -1, 'could not locate the three anchor lines in eureka-enable.cjs');
  assert.ok(enableFnStart > buildFnStart, 'the installer body must be declared after buildEurekaInstallArgv in this file');
  assert.ok(spawnLineIdx > enableFnStart, 'the real network call must be inside the installer body (called only by enableEureka), not buildEurekaInstallArgv');
});

// Phase 387 plan 06 (T341): the second sanctioned egress, the engine uv sync, is named and bounded, and the
// engine doctor child is offline. Source-text checks only (comment lines excluded); no process is started.
ok('Phase 387: the engine uv sync is built only in runEngineSync (uvSyncArgs), called only after the approval test; the doctor child is offline', function () {
  const enablePath = path.join(REPO, 'lib', 'core', 'eureka', 'eureka-engine-enable.cjs');
  const reqPath = path.join(REPO, 'lib', 'core', 'eureka', 'eureka-engine-requirements.cjs');
  const enableCode = nonCommentLines(fs.readFileSync(enablePath, 'utf8')).join('\n');
  const reqCode = nonCommentLines(fs.readFileSync(reqPath, 'utf8')).join('\n');
  function bodyOf(code, name) {
    const start = code.search(new RegExp('^function\\s+' + name + '\\s*\\(', 'm'));
    assert.ok(start !== -1, name + ' not found');
    const end = code.indexOf('\n}\n', start);
    assert.ok(end !== -1, 'end of ' + name + ' not found');
    return code.slice(start, end);
  }
  // 1. the only argument array that holds the word sync as its first element is built by uvSyncArgs
  assert.ok(!/\[\s*['"]sync['"]/.test(enableCode), 'eureka-engine-enable.cjs must not build a sync argument array by hand');
  const syncArrays = reqCode.match(/\[\s*['"]sync['"]/g) || [];
  assert.strictEqual(syncArrays.length, 1, 'exactly one sync argument array is built in the requirements module');
  assert.ok(/\[\s*['"]sync['"]/.test(bodyOf(reqCode, 'uvSyncArgs')), 'the sync array must live inside uvSyncArgs');
  // 2. runEngineSync builds its array through uvSyncArgs and is the only spawn of that array
  const syncBody = bodyOf(enableCode, 'runEngineSync');
  assert.ok(/requirements\.uvSyncArgs\(/.test(syncBody), 'runEngineSync must build its array through uvSyncArgs');
  const syncCalls = enableCode.split('\n').filter(function (l) { return /\brunEngineSync\(/.test(l) && !/^function\s+runEngineSync/.test(l) && !/module\.exports/.test(l); });
  assert.strictEqual(syncCalls.length, 1, 'runEngineSync must be called from exactly one place, found: ' + JSON.stringify(syncCalls));
  // 3. that one call sits in modeSync, after the branch that tests the approved-via value and returns
  const modeBody = bodyOf(enableCode, 'modeSync');
  const approvalIdx = modeBody.search(/o\.approvedVia\s*===\s*null/);
  const callIdx = modeBody.search(/\brunEngineSync\(/);
  assert.ok(approvalIdx !== -1 && callIdx !== -1 && approvalIdx < callIdx, 'runEngineSync must be called after the approvedVia test inside modeSync');
  assert.ok(/return\s*\{\s*exitCode:\s*2/.test(modeBody.slice(approvalIdx, callIdx)), 'the approvedVia branch must return before the sync (exit code 2, the grant card)');
  // 4. the doctor child builds its array through uvRunArgs with the offline defaults and an offline environment
  const docBody = bodyOf(enableCode, 'runEngineDoctor');
  assert.ok(/requirements\.uvRunArgs\(/.test(docBody), 'runEngineDoctor must build its array through uvRunArgs');
  assert.ok(!/allowNetwork/.test(docBody), 'runEngineDoctor must not lift the offline defaults');
  assert.ok(/childEnvironment\(env,\s*true\)/.test(docBody), 'runEngineDoctor must run with the offline environment');
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
