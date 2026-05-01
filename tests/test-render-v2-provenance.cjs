#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 102-04 -- _provenance envelope regression fence (RENDER-102-04).
 *
 * Promotes the Phase 102-00 Wave-0 stub to the canonical regression fence
 * for the LOCAL-only _provenance envelope shipped in commit b0329a0
 * (Phase 102-04 Task 1).
 *
 * Functional assertions (per stub header contract):
 *   1. shape:           every Phase 102 render result carries
 *                       _provenance: { renderer, version, operator, tier,
 *                                      mode, jtbd }.
 *   2. renderer:        _provenance.renderer === 'render-v2'.
 *   3. version:         _provenance.version === '102'.
 *   4. operator_pass:   _provenance.operator passthrough across all 5
 *                       canonical operators (JUST_TALK, EXPLORE_CAPTURE,
 *                       BUILD_ROOM, METHODOLOGY, DECISION_GATE) AND
 *                       passthrough on null/undefined operator.
 *   5. mode_pass:       _provenance.mode passthrough across 'cli',
 *                       'desktop', 'cowork' + arbitrary string.
 *   6. tier_pass:       _provenance.tier passthrough across 'tier-0',
 *                       'mode-a', 'mode-b' + arbitrary scalar.
 *   7. jtbd_default:    _provenance.jtbd defaults to null when arg
 *                       omitted; passthrough when supplied.
 *
 * Byte-stability fence (RENDER-102-06):
 *   8. non_enumerable:  Object.keys(env).sort() still equals
 *                       ['contract','rendered'] -- the Phase 99-03 ->
 *                       102 import-surface invariant from
 *                       lib/render/render-v2.test.cjs scenario 5.
 *                       JSON.stringify(env) likewise does NOT leak
 *                       _provenance into serialized output.
 *
 * Canon Part 8 (Graph Boundary) regression fences:
 *   9. fs_scope:        Runtime trip-wire on fs.readFileSync /
 *                       fs.readFile / fs.openSync. Any FS read during
 *                       render() must target lib/render/JTBD-PALETTES.md
 *                       (the single allow-listed plugin asset). Any
 *                       other path -> FAIL.
 *  10. net_silence:     Runtime trip-wires on http.request,
 *                       https.request, net.connect, dns.lookup, and
 *                       global fetch. ANY invocation during render() ->
 *                       FAIL. Renderer is a pure formatting layer
 *                       (Canon Part 8: no Brain queries, no network IO,
 *                       no SIGNAL fetches).
 *  11. source_audit:    Static scan of lib/render/render-v2.cjs source
 *                       for forbidden tokens (Brain MCP markers, http
 *                       client requires, fetch calls). Defense-in-depth
 *                       against runtime tripwire bypass.
 *  12. provenance_no_user_content: _provenance carries ONLY scalars
 *                       (operator/mode/tier/jtbd are framework-handle
 *                       enums or null). The caller-supplied
 *                       `provenance` arg (which CAN carry Brain context)
 *                       is intentionally NOT folded into _provenance --
 *                       fence asserts a Brain-shaped `provenance` arg
 *                       does not leak into the audit envelope.
 *
 * Exit 0 on full pass; exit 1 on any failure.
 *
 * Pure CJS, node built-ins only, zero new runtime deps (Phase 87 invariant).
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const V2_PATH = path.join(REPO_ROOT, 'lib', 'render', 'render-v2.cjs');
const V2_SOURCE_PATH = V2_PATH; // alias for clarity in source-audit test
const JTBD_PALETTES_PATH = path.join(REPO_ROOT, 'lib', 'render', 'JTBD-PALETTES.md');

const v2 = require(V2_PATH);

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

const CANONICAL_OPERATORS = [
  'JUST_TALK',
  'EXPLORE_CAPTURE',
  'BUILD_ROOM',
  'METHODOLOGY',
  'DECISION_GATE',
];

// ---------------------------------------------------------------------------
// 1. shape: every Phase 102 render result carries _provenance with all 6
//    canonical fields.
// ---------------------------------------------------------------------------
(function test1_shape() {
  const label = 'shape: every render result carries _provenance with 6 fields';
  try {
    const env = v2.render({
      zones: { header: 'h', body: 'b' },
      mode: 'cli',
      operator: 'BUILD_ROOM',
      tier: 'mode-a',
      jtbd: 'find-bottleneck',
    });
    assert.ok(env._provenance, 'env._provenance is present');
    assert.equal(typeof env._provenance, 'object', '_provenance is an object');
    const keys = Object.keys(env._provenance).sort();
    assert.deepEqual(
      keys,
      ['jtbd', 'mode', 'operator', 'renderer', 'tier', 'version'],
      '_provenance has exactly 6 canonical fields'
    );
    // JUST_TALK suppressed path also carries _provenance.
    const just = v2.render({
      zones: { header: 'h' },
      operator: 'JUST_TALK',
      mode: 'cli',
      tier: 1,
    });
    assert.ok(just._provenance, 'JUST_TALK suppressed path also carries _provenance');
    assert.equal(just._provenance.operator, 'JUST_TALK', 'JUST_TALK passthrough preserved on suppressed path');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 2. renderer: _provenance.renderer === 'render-v2'.
// ---------------------------------------------------------------------------
(function test2_renderer() {
  const label = "renderer: _provenance.renderer === 'render-v2'";
  try {
    const env = v2.render({ zones: { header: 'h' }, operator: 'BUILD_ROOM', tier: 1 });
    assert.equal(env._provenance.renderer, 'render-v2', "renderer === 'render-v2'");
    // Same for JUST_TALK.
    const just = v2.render({ zones: { header: 'h' }, operator: 'JUST_TALK', tier: 1 });
    assert.equal(just._provenance.renderer, 'render-v2', "JUST_TALK renderer === 'render-v2'");
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 3. version: _provenance.version === '102'.
// ---------------------------------------------------------------------------
(function test3_version() {
  const label = "version: _provenance.version === '102'";
  try {
    const env = v2.render({ zones: { header: 'h' }, operator: 'BUILD_ROOM', tier: 1 });
    assert.equal(env._provenance.version, '102', "version === '102'");
    // Same for JUST_TALK.
    const just = v2.render({ zones: { header: 'h' }, operator: 'JUST_TALK', tier: 1 });
    assert.equal(just._provenance.version, '102', "JUST_TALK version === '102'");
    // Empty render (defaults).
    const empty = v2.render();
    assert.equal(empty._provenance.version, '102', "empty render version === '102'");
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 4. operator_pass: _provenance.operator passthrough across all 5 canonical
//    operators AND null/undefined.
// ---------------------------------------------------------------------------
(function test4_operatorPass() {
  for (const op of CANONICAL_OPERATORS) {
    const label = 'operator_pass: ' + op;
    try {
      const env = v2.render({
        zones: { header: 'h', body: 'b' },
        operator: op,
        mode: 'cli',
        tier: 1,
      });
      assert.equal(env._provenance.operator, op, op + ' round-trips into _provenance.operator');
      ok(label);
    } catch (e) { fail(label, e); }
  }
  // null operator -> _provenance.operator === null.
  (function () {
    const label = 'operator_pass: null operator -> _provenance.operator === null';
    try {
      const env = v2.render({ zones: { header: 'h' }, operator: null, tier: 1 });
      assert.equal(env._provenance.operator, null, 'null operator becomes null in _provenance');
      ok(label);
    } catch (e) { fail(label, e); }
  })();
  // undefined operator -> _provenance.operator === null (default normalization).
  (function () {
    const label = 'operator_pass: undefined operator -> _provenance.operator === null';
    try {
      const env = v2.render({ zones: { header: 'h' }, tier: 1 });
      assert.equal(env._provenance.operator, null, 'undefined operator normalizes to null');
      ok(label);
    } catch (e) { fail(label, e); }
  })();
})();

// ---------------------------------------------------------------------------
// 5. mode_pass: _provenance.mode passthrough across 'cli', 'desktop',
//    'cowork' + arbitrary string.
// ---------------------------------------------------------------------------
(function test5_modePass() {
  const label = 'mode_pass: cli / desktop / cowork / arbitrary all round-trip';
  try {
    for (const mode of ['cli', 'desktop', 'cowork', 'A', 'B', 'tier-0', 'arbitrary-mode']) {
      const env = v2.render({
        zones: { header: 'h' },
        mode: mode,
        operator: 'BUILD_ROOM',
        tier: 1,
      });
      assert.equal(env._provenance.mode, mode, "mode '" + mode + "' round-trips");
    }
    // mode default when arg omitted -> 'A' (per render-v2 default).
    const def = v2.render({ zones: { header: 'h' }, operator: 'BUILD_ROOM', tier: 1 });
    assert.equal(def._provenance.mode, 'A', "default mode === 'A'");
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 6. tier_pass: _provenance.tier passthrough across canonical tier values
//    and arbitrary scalars.
// ---------------------------------------------------------------------------
(function test6_tierPass() {
  const label = 'tier_pass: numeric / string / arbitrary all round-trip';
  try {
    for (const tier of [0, 1, 2, 3, 'tier-0', 'mode-a', 'mode-b', 'arbitrary-tier']) {
      const env = v2.render({
        zones: { header: 'h' },
        operator: 'BUILD_ROOM',
        tier: tier,
      });
      assert.equal(env._provenance.tier, tier, 'tier ' + JSON.stringify(tier) + ' round-trips');
    }
    // tier default when arg omitted -> 1 (per render-v2 default).
    const def = v2.render({ zones: { header: 'h' }, operator: 'BUILD_ROOM' });
    assert.equal(def._provenance.tier, 1, 'default tier === 1');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 7. jtbd_default: _provenance.jtbd defaults to null when arg omitted;
//    passthrough when supplied.
// ---------------------------------------------------------------------------
(function test7_jtbdDefault() {
  const label = 'jtbd_default: null when omitted, passthrough when supplied';
  try {
    // Omitted -> null.
    const omitted = v2.render({ zones: { header: 'h' }, operator: 'BUILD_ROOM', tier: 1 });
    assert.equal(omitted._provenance.jtbd, null, 'omitted jtbd defaults to null');
    // Explicit null -> null.
    const explicitNull = v2.render({
      zones: { header: 'h' }, operator: 'BUILD_ROOM', tier: 1, jtbd: null,
    });
    assert.equal(explicitNull._provenance.jtbd, null, 'explicit null jtbd stays null');
    // Explicit string -> passthrough.
    for (const jtbd of ['find-bottleneck', 'find-connection', 'find-analogy', 'score-innovation']) {
      const env = v2.render({
        zones: { header: 'h' }, operator: 'BUILD_ROOM', tier: 1, jtbd: jtbd,
      });
      assert.equal(env._provenance.jtbd, jtbd, "jtbd '" + jtbd + "' round-trips");
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 8. non_enumerable: Object.keys(env) still ['contract','rendered']
//    (RENDER-102-06 byte-stability invariant). JSON.stringify likewise
//    does not leak _provenance.
// ---------------------------------------------------------------------------
(function test8_nonEnumerable() {
  const label = 'non_enumerable: _provenance hidden from Object.keys + JSON.stringify';
  try {
    const env = v2.render({
      zones: { header: 'h' }, mode: 'cli', operator: 'BUILD_ROOM', tier: 1, jtbd: 'find-bottleneck',
    });
    const keys = Object.keys(env).sort();
    assert.deepEqual(
      keys,
      ['contract', 'rendered'],
      'Object.keys === [contract, rendered] (RENDER-102-06 byte-stability)'
    );
    const json = JSON.stringify(env);
    assert.ok(
      json.indexOf('_provenance') === -1,
      'JSON.stringify does NOT leak _provenance (zero serialization egress)'
    );
    assert.ok(
      json.indexOf('render-v2') === -1,
      "JSON.stringify does NOT leak the 'render-v2' provenance scalar"
    );
    // for..in must also skip _provenance.
    const forInKeys = [];
    for (const k in env) forInKeys.push(k);
    assert.ok(
      forInKeys.indexOf('_provenance') === -1,
      'for..in does NOT visit _provenance'
    );
    // But explicit access still works.
    assert.ok(env._provenance, 'explicit env._provenance access still works');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 9. fs_scope: runtime trip-wire on fs.readFileSync / fs.readFile /
//    fs.openSync. Any FS read during render() must target ONLY
//    lib/render/JTBD-PALETTES.md.
// ---------------------------------------------------------------------------
(function test9_fsScope() {
  const label = 'fs_scope: render() does not read FS outside JTBD-PALETTES.md';
  try {
    // Patch fs surface methods. Record every path the renderer touches,
    // then assert the set is either empty (current implementation) or a
    // subset of { JTBD-PALETTES.md }.
    const reads = [];
    const origReadFileSync = fs.readFileSync;
    const origReadFile = fs.readFile;
    const origOpenSync = fs.openSync;
    const origOpen = fs.open;
    const origCreateReadStream = fs.createReadStream;

    function record(method, p) {
      // Coerce Buffer/URL paths to string for comparison.
      const pStr = (typeof p === 'string') ? p : (p && p.toString ? p.toString() : String(p));
      reads.push({ method: method, path: pStr });
    }

    fs.readFileSync = function patched_readFileSync(p, opts) {
      record('readFileSync', p);
      return origReadFileSync.call(fs, p, opts);
    };
    fs.readFile = function patched_readFile() {
      record('readFile', arguments[0]);
      return origReadFile.apply(fs, arguments);
    };
    fs.openSync = function patched_openSync(p, flags, mode) {
      record('openSync', p);
      return origOpenSync.call(fs, p, flags, mode);
    };
    fs.open = function patched_open() {
      record('open', arguments[0]);
      return origOpen.apply(fs, arguments);
    };
    fs.createReadStream = function patched_createReadStream() {
      record('createReadStream', arguments[0]);
      return origCreateReadStream.apply(fs, arguments);
    };

    try {
      // Run a representative slice of render() invocations.
      v2.render({ zones: { header: 'h' }, operator: 'BUILD_ROOM', tier: 1 });
      v2.render({ zones: { header: 'h' }, operator: 'JUST_TALK', tier: 1 });
      v2.render({ zones: { header: 'h' }, operator: 'METHODOLOGY', tier: 1 });
      v2.render({
        zones: { header: 'h' }, operator: 'BUILD_ROOM', tier: 1, jtbd: 'find-bottleneck',
      });
    } finally {
      // Always restore patches even if render() throws.
      fs.readFileSync = origReadFileSync;
      fs.readFile = origReadFile;
      fs.openSync = origOpenSync;
      fs.open = origOpen;
      fs.createReadStream = origCreateReadStream;
    }

    // Phase 102-04 (this plan): the implementation does not read any FS
    // at render time. Sibling 102-03 will introduce a JTBD-PALETTES.md
    // read at module load (NOT per-render). Either way, the per-render
    // FS surface must be a subset of { JTBD-PALETTES.md }.
    for (const r of reads) {
      const isAllowed = (r.path === JTBD_PALETTES_PATH || r.path.endsWith('JTBD-PALETTES.md'));
      assert.ok(
        isAllowed,
        'FS read during render() targeted forbidden path ' + r.method + '(' + r.path + ')'
      );
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 10. net_silence: runtime trip-wires on http / https / net / dns / fetch.
//     Any invocation during render() -> FAIL.
// ---------------------------------------------------------------------------
(function test10_netSilence() {
  const label = 'net_silence: render() makes zero network calls';
  try {
    const trips = [];
    function trip(name) {
      return function () {
        trips.push(name);
        throw new Error('net trip-wire fired: ' + name);
      };
    }

    // Snapshot + replace.
    const http = require('node:http');
    const https = require('node:https');
    const net = require('node:net');
    const dns = require('node:dns');

    const origHttpReq = http.request;
    const origHttpsReq = https.request;
    const origNetConnect = net.connect;
    const origDnsLookup = dns.lookup;
    const origFetch = global.fetch;

    http.request = trip('http.request');
    https.request = trip('https.request');
    net.connect = trip('net.connect');
    dns.lookup = trip('dns.lookup');
    global.fetch = trip('global.fetch');

    try {
      // Same representative slice as fs_scope.
      v2.render({ zones: { header: 'h' }, operator: 'BUILD_ROOM', tier: 1 });
      v2.render({ zones: { header: 'h' }, operator: 'JUST_TALK', tier: 1 });
      v2.render({ zones: { header: 'h' }, operator: 'METHODOLOGY', tier: 1 });
      v2.render({
        zones: { header: 'h' }, operator: 'BUILD_ROOM', tier: 1, jtbd: 'find-bottleneck',
      });
    } finally {
      // Restore.
      http.request = origHttpReq;
      https.request = origHttpsReq;
      net.connect = origNetConnect;
      dns.lookup = origDnsLookup;
      global.fetch = origFetch;
    }

    assert.deepEqual(
      trips,
      [],
      'no network trip-wire fired during render() (Canon Part 8)'
    );
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 11. source_audit: static scan of lib/render/render-v2.cjs source for
//     forbidden tokens. Defense-in-depth against runtime tripwire bypass
//     (e.g., a future plan that lazy-requires an http client inside an
//     unreached branch).
// ---------------------------------------------------------------------------
(function test11_sourceAudit() {
  const label = 'source_audit: render-v2.cjs source contains zero Brain/network tokens';
  try {
    const src = fs.readFileSync(V2_SOURCE_PATH, 'utf8');

    // Forbidden tokens. Each entry is { token, allowedInComment } -- when
    // allowedInComment is true, occurrences inside a // line comment are
    // tolerated (the JSDoc explicitly mentions Brain by name to document
    // the boundary; that is documentation, not a code path).
    const FORBIDDEN = [
      { token: "require('node:http')",  allowedInComment: false },
      { token: "require('node:https')", allowedInComment: false },
      { token: "require('node:net')",   allowedInComment: false },
      { token: "require('node:dns')",   allowedInComment: false },
      { token: "require('http')",       allowedInComment: false },
      { token: "require('https')",      allowedInComment: false },
      { token: 'fetch(',                allowedInComment: false },
      { token: 'XMLHttpRequest',        allowedInComment: false },
      { token: 'mcp-server-brain',      allowedInComment: true  },
      { token: 'brain.mindrian.ai',     allowedInComment: true  },
      // Forbid tokens that imply user-content egress.
      { token: 'JSON.stringify(provenance)', allowedInComment: false },
    ];

    const lines = src.split('\n');
    const violations = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const isLineComment = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
      for (const f of FORBIDDEN) {
        if (line.indexOf(f.token) === -1) continue;
        if (f.allowedInComment && isLineComment) continue;
        violations.push({ line: i + 1, token: f.token, content: trimmed });
      }
    }
    assert.deepEqual(
      violations,
      [],
      'source_audit found forbidden tokens: ' + JSON.stringify(violations)
    );
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// 12. provenance_no_user_content: a Brain-shaped `provenance` arg
//     supplied by the caller does NOT leak into the LOCAL audit
//     envelope. _provenance carries only the framework-handle scalars
//     {renderer, version, operator, tier, mode, jtbd}.
// ---------------------------------------------------------------------------
(function test12_provenanceNoUserContent() {
  const label = 'provenance_no_user_content: caller-supplied provenance does NOT leak into _provenance';
  try {
    const callerProvenance = {
      // Realistic Brain context shape per CONTEXT D-09 + Phase 90 brain-derive.
      // None of these strings should reach _provenance.
      graphQuery: 'CONFIDENTIAL_USER_QUERY',
      confidence: 0.93,
      frameworks: ['rs-fetch', 'rs-thesis'],
      userArtifactId: 'opp-01-quantum-brain-imaging',
      meetingTranscriptHash: 'sha256:DO_NOT_LEAK',
    };
    const env = v2.render({
      zones: { header: 'h', body: 'b' },
      mode: 'cli',
      operator: 'BUILD_ROOM',
      tier: 1,
      jtbd: 'find-bottleneck',
      provenance: callerProvenance,
    });
    // _provenance keys must be the 6 canonical fields ONLY.
    const keys = Object.keys(env._provenance).sort();
    assert.deepEqual(
      keys,
      ['jtbd', 'mode', 'operator', 'renderer', 'tier', 'version'],
      '_provenance has exactly the 6 canonical fields, nothing else'
    );
    // Spot-check that none of the caller-provenance string values appear
    // in any field of _provenance.
    const provJson = JSON.stringify(env._provenance);
    assert.ok(
      provJson.indexOf('CONFIDENTIAL_USER_QUERY') === -1,
      'caller graphQuery does NOT appear in _provenance'
    );
    assert.ok(
      provJson.indexOf('opp-01-quantum-brain-imaging') === -1,
      'caller userArtifactId does NOT appear in _provenance'
    );
    assert.ok(
      provJson.indexOf('DO_NOT_LEAK') === -1,
      'caller meetingTranscriptHash does NOT appear in _provenance'
    );
    assert.ok(
      provJson.indexOf('rs-fetch') === -1,
      'caller frameworks list does NOT appear in _provenance'
    );
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Summary + exit code.
// ---------------------------------------------------------------------------
process.stdout.write('\n');
process.stdout.write(
  'Phase 102-04 _provenance envelope: ' +
    passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
