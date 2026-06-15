'use strict';
/*
 * Phase 157-05 (BOG-09 / BOG-10) -- the adversarial Part 8 boundary scan over
 * the orchestration projection.
 *
 * This scan makes the projection's LOCALITY constitutional rather than assumed.
 * It mirrors the Phase 90 5-tripwire forbidden-substring sweep
 * (tests/test-feynman-timeline-canon-part-9-invariant.cjs lineage), the Phase
 * 110-05 adversarial-seed pattern (plant a secret, prove the scan catches it),
 * and the Phase 143.3 connector Part-8 boundary scan
 * (tests/test-connector-part8-boundary.cjs) generalized to the orchestration
 * projection artifacts.
 *
 * It sweeps FOUR surfaces:
 *   - data/brain-orchestration-projection.json        (the artifact)
 *   - scripts/build-orchestration-projection.cjs       (the generator)
 *   - data/cross-domain-analogues.json                 (the analogue seed)
 *   - data/orchestration-unwired-allowlist.json        (the wired-XOR ledger)
 *
 * The scan asserts (each breach is HIGH severity, a user-content-to-Brain path,
 * and the test exits non-zero):
 *
 *   CHECK 1 -- FIELD ALLOWLIST: every node key is in NODE_FIELD_ALLOWLIST and
 *     every edge key is in EDGE_FIELD_ALLOWLIST (the generator's exported frozen
 *     arrays); the chain_provenance + ranking sub-blocks are descended into and
 *     their keys restricted to the same generic set. A key outside the allowlist
 *     is a Part 8 breach (BOG-10).
 *
 *   CHECK 2 -- TIER ON EVERY NODE: methodology_tier present on EVERY node and
 *     exactly "pws" or "mindrian-operation" (the boundary-keeper, BOG-10).
 *
 *   CHECK 3 -- FORBIDDEN-VALUE HEURISTIC (the planted-secret tripwire): no node
 *     or edge VALUE matches a user-content heuristic (a room/ path, an at-sign
 *     email, or free text longer than a documented short cap). The scan is the
 *     PROOF, not an assertion: it SEEDS a planted user-content value into an
 *     in-memory copy and proves the heuristic catches it (RED), then confirms
 *     the REAL artifact is clean (GREEN). The sweep is scoped to nodes[] +
 *     edges[] (the per-surface data); the three documented top-level legibility
 *     notes (ontology_ref / generated_note / chain_layer_note) are bounded
 *     machinery prose ABOUT the build, not per-surface values, and are scanned
 *     for room/ paths + emails but exempt from the over-cap heuristic.
 *
 *   CHECK 4 -- ZERO LIVE BRAIN: the generator source (comment lines filtered
 *     out) carries NO top-level brain-client require and NO
 *     fetch/http/curl/brain.query/brain.write call. Match on the actual
 *     call/require SYNTAX, never a bare substring, so header prose naming "Brain"
 *     does not self-invalidate the gate (BOG-09).
 *
 *   CHECK 5 -- GENERIC-MACHINERY SOURCES: the analogue seed carries only
 *     from/to generic framework-NAME pairs (+ a bounded rationale prose field);
 *     the allowlist carries only framework/reason machinery-metadata pairs. No
 *     user-content field, no room/ path, no email.
 *
 * House rule: hyphens only, no em-dashes (the U+2014 codepoint is referenced by
 * escape, never as a literal).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const GENERATOR_PATH = path.join(REPO_ROOT, 'scripts', 'build-orchestration-projection.cjs');
const PROJECTION_PATH = path.join(REPO_ROOT, 'data', 'brain-orchestration-projection.json');
const ANALOGUES_PATH = path.join(REPO_ROOT, 'data', 'cross-domain-analogues.json');
const UNWIRED_ALLOWLIST_PATH = path.join(REPO_ROOT, 'data', 'orchestration-unwired-allowlist.json');

const gen = require(GENERATOR_PATH);

// The two legal methodology_tier values (Canon Part 8, Phase 157 amendment).
const LEGAL_TIERS = new Set(['pws', 'mindrian-operation']);

// The documented short cap for a free-text value. A node/edge string value over
// this length is a candidate user-content body (a smuggling surface). Every
// LEGITIMATE projection value is a generic handle: a node id, a /mos slug, a
// framework name, a reach id, a sub_mode, a SENS id, an enum, or a small int.
// The longest legitimate values are framework names and node ids
// ("command:/mos:..." + a framework name like "Jobs to Be Done (JTBD)"); the cap
// is set generously above the longest legitimate handle but far below any
// artifact body / meeting transcript / assumption text.
const FREE_TEXT_CAP = 120;

// The forbidden-value heuristics (the planted-secret tripwire). A node/edge
// VALUE that matches ANY of these is a candidate user-content leak.
//   - a room/ path segment (a local artifact path -- e.g. room/problem/foo.md)
//   - an at-sign email pattern (a personal identifier)
//   - free text longer than the cap (an artifact body / transcript)
const ROOM_PATH_RX = /(^|[\/\s])room\/[A-Za-z0-9._-]/;
const EMAIL_RX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  PASS ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// ---------------------------------------------------------------------------
// forbiddenValueReason(value) -- the heuristic engine. Returns a non-empty
// reason string when `value` looks like user content, or '' when it is a clean
// generic handle. Pure: takes a value, returns a verdict. This is the PROOF
// engine the planted-secret test exercises directly (CHECK 3).
// ---------------------------------------------------------------------------
function forbiddenValueReason(value) {
  if (typeof value !== 'string') return '';
  if (ROOM_PATH_RX.test(value)) return 'room/ path segment (a local artifact path)';
  if (EMAIL_RX.test(value)) return 'at-sign email pattern (a personal identifier)';
  if (value.length > FREE_TEXT_CAP) {
    return 'free text longer than the ' + FREE_TEXT_CAP + '-char cap (a candidate artifact body)';
  }
  return '';
}

// Walk every scalar string value in an arbitrary JSON value, invoking visit(str,
// pathStr) for each. Arrays + objects descend; scalars are visited.
function walkStringValues(value, visit, pathStr) {
  const p = pathStr || '$';
  if (typeof value === 'string') {
    visit(value, p);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => walkStringValues(v, visit, p + '[' + i + ']'));
    return;
  }
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) {
      walkStringValues(value[k], visit, p + '.' + k);
    }
  }
}

// Recursively collect every object KEY in a node (descending into sub-objects
// like chain_provenance + ranking, but NOT into arrays of scalars). Returns a
// Set of key names. Used by the field-allowlist sweep so the sub-block keys are
// held to the same allowlist.
function collectObjectKeys(value, acc) {
  const set = acc || new Set();
  if (Array.isArray(value)) {
    for (const v of value) collectObjectKeys(v, set);
  } else if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) {
      set.add(k);
      collectObjectKeys(value[k], set);
    }
  }
  return set;
}

function loadProjection() {
  return JSON.parse(fs.readFileSync(PROJECTION_PATH, 'utf8'));
}

// ---------------------------------------------------------------------------
// CHECK 1 -- field allowlist sweep over nodes[] + edges[] (BOG-10).
// ---------------------------------------------------------------------------
(function check1_fieldAllowlist() {
  const label = 'CHECK 1 - node/edge field allowlist (zero user-content fields, BOG-10)';
  try {
    const nodeAllow = new Set(gen.NODE_FIELD_ALLOWLIST);
    const edgeAllow = new Set(gen.EDGE_FIELD_ALLOWLIST);
    assert.ok(nodeAllow.size > 0, label + ': NODE_FIELD_ALLOWLIST exported non-empty');
    assert.ok(edgeAllow.size > 0, label + ': EDGE_FIELD_ALLOWLIST exported non-empty');

    const proj = loadProjection();
    const nodes = Array.isArray(proj.nodes) ? proj.nodes : [];
    const edges = Array.isArray(proj.edges) ? proj.edges : [];
    assert.ok(nodes.length > 0, label + ': projection has nodes to scan');

    for (const n of nodes) {
      // Every key on the node AND inside its sub-objects (chain_provenance,
      // ranking) must be in the node allowlist. A key outside it is a candidate
      // user-content field.
      const keys = collectObjectKeys(n);
      for (const k of keys) {
        assert.ok(nodeAllow.has(k),
          label + ': node ' + JSON.stringify(n.id) + ' carries off-allowlist field "' +
            k + '" - a Part 8 user-content surface');
      }
    }

    for (const e of edges) {
      const keys = Object.keys(e);
      for (const k of keys) {
        assert.ok(edgeAllow.has(k),
          label + ': edge ' + JSON.stringify(e) + ' carries off-allowlist field "' +
            k + '" - a Part 8 user-content surface');
      }
    }

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 2 -- methodology_tier on every node (the boundary-keeper, BOG-10).
// ---------------------------------------------------------------------------
(function check2_tierOnEveryNode() {
  const label = 'CHECK 2 - methodology_tier on every node (boundary-keeper, BOG-10)';
  try {
    const proj = loadProjection();
    const nodes = Array.isArray(proj.nodes) ? proj.nodes : [];
    assert.ok(nodes.length > 0, label + ': projection has nodes to scan');
    for (const n of nodes) {
      assert.ok(typeof n.methodology_tier === 'string' && n.methodology_tier,
        label + ': node ' + JSON.stringify(n.id) + ' lacks methodology_tier (not a legal projection node)');
      assert.ok(LEGAL_TIERS.has(n.methodology_tier),
        label + ': node ' + JSON.stringify(n.id) + ' has illegal methodology_tier "' +
          n.methodology_tier + '" (must be pws | mindrian-operation)');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 3 -- forbidden-value heuristic + the PLANTED-SECRET adversarial proof.
//
// First prove the heuristic CATCHES a planted user-content value (RED): seed a
// room/ path, an email, and an over-cap body into an in-memory copy of the
// projection and assert the sweep flags each. THEN confirm the REAL on-disk
// artifact is clean (GREEN). The scan is the proof, not an assertion.
// ---------------------------------------------------------------------------
(function check3_forbiddenValueHeuristicAndPlantedSecret() {
  const label = 'CHECK 3 - forbidden-value heuristic catches a planted secret (RED) + real artifact clean (GREEN)';
  try {
    // ---- RED: the planted-secret proof. The heuristic MUST catch each plant. ----
    const PLANTED = [
      { v: 'room/problem-definition/financial-model.md', kind: 'room/ path' },
      { v: 'lawrence@example.com', kind: 'email' },
      { v: 'x'.repeat(FREE_TEXT_CAP + 1), kind: 'over-cap free text' },
    ];
    for (const plant of PLANTED) {
      assert.ok(forbiddenValueReason(plant.v) !== '',
        label + ': PLANTED ' + plant.kind + ' value was NOT caught by the heuristic - the scan would miss a real leak');
    }

    // sweepPerSurface(projection) -- run the forbidden-value heuristic over
    // nodes[] + edges[] ONLY (the per-surface data), returning the hit list. The
    // three top-level legibility notes are NOT per-surface values; they are
    // bounded machinery prose scanned separately (room/ + email only) below.
    function sweepPerSurface(projection) {
      const hits = [];
      walkStringValues(projection.nodes || [], (str, p) => {
        const reason = forbiddenValueReason(str);
        if (reason) hits.push('nodes' + p.slice(1) + ' -> ' + reason + ' :: ' + JSON.stringify(str.slice(0, 60)));
      });
      walkStringValues(projection.edges || [], (str, p) => {
        const reason = forbiddenValueReason(str);
        if (reason) hits.push('edges' + p.slice(1) + ' -> ' + reason + ' :: ' + JSON.stringify(str.slice(0, 60)));
      });
      return hits;
    }

    // Plant a secret INSIDE an in-memory projection copy and prove the
    // per-surface sweep surfaces it. This proves the SWEEP (not just the
    // heuristic) catches a leak wherever it hides in the node/edge tree.
    const proj = loadProjection();
    const poisoned = JSON.parse(JSON.stringify(proj));
    assert.ok(Array.isArray(poisoned.nodes) && poisoned.nodes.length > 0,
      label + ': poisoned copy has nodes');
    // Smuggle a room/ path into a name field deep in the tree.
    poisoned.nodes[0].name = 'room/secret/leak.md';
    const poisonedHits = sweepPerSurface(poisoned);
    assert.ok(poisonedHits.length >= 1,
      label + ': the sweep over the POISONED projection found zero hits - it would miss a planted leak');

    // ---- GREEN: the REAL on-disk artifact is clean. No node/edge value trips
    // the heuristic. ----
    const hits = sweepPerSurface(proj);
    assert.equal(hits.length, 0,
      label + ': the REAL projection carries ' + hits.length +
        ' forbidden node/edge value(s) (a user-content leak):\n    ' + hits.join('\n    '));

    // The three documented top-level legibility notes (ontology_ref /
    // generated_note / chain_layer_note) are bounded machinery prose ABOUT the
    // build, not per-surface values; they are exempt from the over-cap heuristic
    // but MUST still be clean of room/ paths + emails.
    for (const noteKey of ['ontology_ref', 'generated_note', 'chain_layer_note']) {
      const note = proj[noteKey];
      if (typeof note !== 'string') continue;
      assert.equal(ROOM_PATH_RX.test(note), false,
        label + ': top-level note "' + noteKey + '" carries a room/ path');
      assert.equal(EMAIL_RX.test(note), false,
        label + ': top-level note "' + noteKey + '" carries an email');
    }

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 4 -- zero live Brain in the generator (BOG-09). Match on the actual
// call/require SYNTAX, with comment lines stripped so the header prose naming
// "Brain" never self-invalidates the gate.
// ---------------------------------------------------------------------------
(function check4_zeroLiveBrain() {
  const label = 'CHECK 4 - generator makes zero live Brain read/write (BOG-09)';
  try {
    const raw = fs.readFileSync(GENERATOR_PATH, 'utf8');

    // Strip comment lines: a line whose first non-whitespace char is / or * (the
    // // line comments and the /* ... */ block-comment body lines). This removes
    // the header prose that legitimately discusses "Brain", "fetch", "http" so
    // the gate matches ONLY live code.
    const codeLines = raw.split('\n').filter((ln) => {
      const t = ln.trim();
      if (t.startsWith('//')) return false;
      if (t.startsWith('*')) return false;
      if (t.startsWith('/*')) return false;
      return true;
    });
    const code = codeLines.join('\n');

    // (a) No brain-client require anywhere (this generator has NO Brain touch at
    //     all, unlike the connector --refresh-names sibling).
    assert.equal(/require\s*\(\s*[^)]*brain-client[^)]*\)/.test(code), false,
      label + ': generator code requires brain-client - the projection must be a Brain-DERIVED LOCAL cache with zero live Brain');

    // (b) No network/Brain call syntax. Match on a call shape (identifier +
    //     paren) or a brain.query/brain.write member call, never a bare
    //     substring.
    const FORBIDDEN_CALLS = [
      { rx: /\bfetch\s*\(/, name: 'fetch(' },
      { rx: /\bhttps?\.(get|request)\s*\(/, name: 'http(s).get/request(' },
      { rx: /require\s*\(\s*['"]node:https?['"]\s*\)/, name: "require('node:http(s)')" },
      { rx: /require\s*\(\s*['"]https?['"]\s*\)/, name: "require('http(s)')" },
      { rx: /\bcurl\b/, name: 'curl' },
      { rx: /brain\s*\.\s*query\s*\(/, name: 'brain.query(' },
      { rx: /brain\s*\.\s*write\s*\(/, name: 'brain.write(' },
    ];
    for (const f of FORBIDDEN_CALLS) {
      assert.equal(f.rx.test(code), false,
        label + ': generator code contains a forbidden live-Brain/network call "' + f.name +
          '" - the projection must have zero runtime Brain dependency (Part 8 / Part 9)');
    }

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 5 -- the analogue seed + the allowlist carry only generic machinery
// metadata (BOG-10). The analogue seed is from/to framework-NAME pairs +
// rationale prose; the allowlist is framework/reason machinery metadata. No
// user-content field, no room/ path, no email. The rationale + reason prose
// fields are bounded prose ABOUT the machinery (not user content), exempt from
// the over-cap heuristic but scanned for room/ paths + emails.
// ---------------------------------------------------------------------------
(function check5_genericMachinerySources() {
  const label = 'CHECK 5 - analogue seed + allowlist carry only generic machinery metadata (BOG-10)';
  try {
    const analogues = JSON.parse(fs.readFileSync(ANALOGUES_PATH, 'utf8'));
    const list = Array.isArray(analogues.analogues) ? analogues.analogues : [];
    assert.ok(list.length >= 2, label + ': analogue seed has the >=2 hand-curated pairs');
    const ANALOGUE_KEYS = new Set(['from', 'to', 'rationale']);
    for (const a of list) {
      for (const k of Object.keys(a)) {
        assert.ok(ANALOGUE_KEYS.has(k),
          label + ': analogue pair carries off-schema field "' + k + '" (a smuggling surface)');
      }
      // from/to are generic framework names: short, no room/ path, no email.
      for (const f of ['from', 'to']) {
        const v = a[f];
        assert.ok(typeof v === 'string' && v.length > 0 && v.length <= FREE_TEXT_CAP,
          label + ': analogue ' + f + ' "' + String(v) + '" is not a short generic framework name');
        assert.equal(ROOM_PATH_RX.test(v), false, label + ': analogue ' + f + ' carries a room/ path');
        assert.equal(EMAIL_RX.test(v), false, label + ': analogue ' + f + ' carries an email');
      }
      // rationale is bounded prose ABOUT the machinery: no room/ path, no email.
      if (typeof a.rationale === 'string') {
        assert.equal(ROOM_PATH_RX.test(a.rationale), false, label + ': analogue rationale carries a room/ path');
        assert.equal(EMAIL_RX.test(a.rationale), false, label + ': analogue rationale carries an email');
      }
    }

    const allowlist = JSON.parse(fs.readFileSync(UNWIRED_ALLOWLIST_PATH, 'utf8'));
    assert.ok(Array.isArray(allowlist), label + ': allowlist is a bare JSON array');
    const ALLOWLIST_KEYS = new Set(['framework', 'reason']);
    for (const entry of allowlist) {
      for (const k of Object.keys(entry)) {
        assert.ok(ALLOWLIST_KEYS.has(k),
          label + ': allowlist entry carries off-schema field "' + k + '" (a smuggling surface)');
      }
      assert.equal(ROOM_PATH_RX.test(String(entry.framework)), false, label + ': allowlist framework carries a room/ path');
      assert.equal(EMAIL_RX.test(String(entry.reason || '')), false, label + ': allowlist reason carries an email');
      assert.equal(ROOM_PATH_RX.test(String(entry.reason || '')), false, label + ': allowlist reason carries a room/ path');
    }

    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 6 -- no em-dashes anywhere in this scan's own surfaces (HARD RULE).
// ---------------------------------------------------------------------------
(function check6_noEmDash() {
  const label = 'CHECK 6 - no em-dashes in the generator + the scan (HARD RULE)';
  try {
    const EM_DASH = String.fromCharCode(0x2014);
    for (const f of [GENERATOR_PATH, __filename]) {
      const src = fs.readFileSync(f, 'utf8');
      assert.equal(src.includes(EM_DASH), false,
        label + ': ' + path.basename(f) + ' contains an em-dash (use a hyphen)');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write(
  'orchestration-projection Part-8 boundary scan: ' + passed + ' passed, ' +
    failed + ' failed (6 checks)\n'
);
process.exit(failed === 0 ? 0 : 1);
