'use strict';
/*
 * Phase 167-01 Task 3 (D-167-06) - the adversarial Part 8 boundary scan over the
 * declared harness MANIFEST.
 *
 * This scan makes the manifest's LOCALITY constitutional rather than assumed. It
 * is a VERBATIM-IN-SHAPE mirror of
 * tests/test-orchestration-projection-part8-boundary.cjs (the 6-check
 * planted-secret tripwire), scoped to the manifest surfaces:
 *   - data/harness-manifest.json        (the artifact)
 *   - scripts/build-harness-manifest.cjs (the generator)
 *
 * The scan asserts (each breach is HIGH severity, a user-content-to-Brain path,
 * and the test exits non-zero):
 *
 *   CHECK 1 -- FIELD ALLOWLIST: every top-level manifest key is in the
 *     generator's exported NODE_FIELD_ALLOWLIST and every maps-entry key is in
 *     ENTRY_FIELD_ALLOWLIST. A key outside the allowlist is a Part 8 breach.
 *
 *   CHECK 2 -- TIER: the manifest carries methodology_tier === "mindrian-operation"
 *     (the boundary-keeper).
 *
 *   CHECK 3 -- FORBIDDEN-VALUE + PLANTED-SECRET: seed a room/ path + an email +
 *     an over-cap body into an in-memory manifest copy and prove the sweep
 *     catches each (RED), then prove the REAL artifact is clean (GREEN). The
 *     digests are sha256 hex (machinery metadata) so they never trip the
 *     heuristic.
 *
 *   CHECK 4 -- ZERO LIVE BRAIN: the generator source (comment lines filtered)
 *     carries NO brain-client require and NO fetch/http/curl/brain.query/
 *     brain.write call syntax.
 *
 *   CHECK 5 -- GENERIC-MACHINERY + EXACTLY-THREE-MAPS: the maps section has
 *     EXACTLY three entries (no per-surface row) and every maps entry carries
 *     only { role, path, digest, source_count } generic machinery values (role is
 *     an enum, path is a data/ relative path, digest is sha256 hex, source_count
 *     is an int).
 *
 *   CHECK 6 -- NO EM-DASH: neither the generator nor this scan contains the
 *     U+2014 codepoint (referenced by escape, never as a literal).
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const GENERATOR_PATH = path.join(REPO_ROOT, 'scripts', 'build-harness-manifest.cjs');
const MANIFEST_PATH = path.join(REPO_ROOT, 'data', 'harness-manifest.json');

const gen = require(GENERATOR_PATH);

const LEGAL_TIER = 'mindrian-operation';
const EXPECTED_ROLES = new Set(['posture', 'wiring', 'ranked_next_reach']);

// The documented short cap for a free-text value. A manifest string value over
// this length is a candidate user-content body. Every LEGITIMATE manifest value
// is a generic handle: a role enum, a data/ relative path, a sha256 hex digest,
// an ontology reference, or a generated note. The cap is set above the longest
// legitimate handle but far below any artifact body / transcript. The ontology_ref
// + generated_note legibility prose are exempt (bounded machinery prose ABOUT the
// build) but still scanned for room/ + email.
const FREE_TEXT_CAP = 120;

const ROOM_PATH_RX = /(^|[\/\s-])rooms?\/[A-Za-z0-9._-]/i;
const ROOMS_STORE_RX = /MindrianRooms\//;
const EMAIL_RX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  PASS ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

function forbiddenValueReason(value) {
  if (typeof value !== 'string') return '';
  if (ROOM_PATH_RX.test(value)) return 'room/ path segment (a local artifact path)';
  if (ROOMS_STORE_RX.test(value)) return 'MindrianRooms/ store path (an absolute room artifact path)';
  if (EMAIL_RX.test(value)) return 'at-sign email pattern (a personal identifier)';
  if (value.length > FREE_TEXT_CAP) {
    return 'free text longer than the ' + FREE_TEXT_CAP + '-char cap (a candidate artifact body)';
  }
  return '';
}

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

function loadManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

// ---------------------------------------------------------------------------
// CHECK 1 -- field allowlist over the top-level keys + the maps entries.
// ---------------------------------------------------------------------------
(function check1_fieldAllowlist() {
  const label = 'CHECK 1 - top-level + maps-entry field allowlist (zero user-content fields)';
  try {
    const nodeAllow = new Set(gen.NODE_FIELD_ALLOWLIST);
    const entryAllow = new Set(gen.ENTRY_FIELD_ALLOWLIST);
    assert.ok(nodeAllow.size > 0, label + ': NODE_FIELD_ALLOWLIST exported non-empty');
    assert.ok(entryAllow.size > 0, label + ': ENTRY_FIELD_ALLOWLIST exported non-empty');

    const m = loadManifest();
    // Top-level keys must be in NODE_FIELD_ALLOWLIST.
    for (const k of Object.keys(m)) {
      assert.ok(nodeAllow.has(k),
        label + ': top-level key "' + k + '" is off-allowlist - a Part 8 user-content surface');
    }
    // Every maps-entry key must be in ENTRY_FIELD_ALLOWLIST.
    const maps = Array.isArray(m.maps) ? m.maps : [];
    assert.ok(maps.length > 0, label + ': manifest has maps entries to scan');
    for (const e of maps) {
      const keys = collectObjectKeys(e);
      for (const k of keys) {
        assert.ok(entryAllow.has(k),
          label + ': maps entry ' + JSON.stringify(e.role) + ' carries off-allowlist field "' +
            k + '" - a Part 8 user-content surface');
      }
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 2 -- methodology_tier the boundary-keeper.
// ---------------------------------------------------------------------------
(function check2_tier() {
  const label = 'CHECK 2 - methodology_tier === mindrian-operation (boundary-keeper)';
  try {
    const m = loadManifest();
    assert.equal(m.methodology_tier, LEGAL_TIER,
      label + ': the manifest carries methodology_tier=' + LEGAL_TIER);
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 3 -- forbidden-value heuristic + the PLANTED-SECRET adversarial proof.
// ---------------------------------------------------------------------------
(function check3_forbiddenValueAndPlantedSecret() {
  const label = 'CHECK 3 - forbidden-value heuristic catches a planted secret (RED) + real artifact clean (GREEN)';
  try {
    // ---- RED: the heuristic MUST catch each plant. ----
    const PLANTED = [
      { v: 'room/problem-definition/financial-model.md', kind: 'room/ path' },
      { v: 'lawrence@example.com', kind: 'email' },
      { v: 'x'.repeat(FREE_TEXT_CAP + 1), kind: 'over-cap free text' },
    ];
    for (const plant of PLANTED) {
      assert.ok(forbiddenValueReason(plant.v) !== '',
        label + ': PLANTED ' + plant.kind + ' value was NOT caught by the heuristic - the scan would miss a real leak');
    }

    // sweepEntries(manifest) -- run the heuristic over the maps[] entries ONLY
    // (the per-surface data). The two top-level legibility notes (ontology_ref /
    // generated_note) are bounded machinery prose ABOUT the build; scanned
    // separately (room/ + email only) below.
    function sweepEntries(manifest) {
      const hits = [];
      walkStringValues(manifest.maps || [], (str, p) => {
        const reason = forbiddenValueReason(str);
        if (reason) hits.push('maps' + p.slice(1) + ' -> ' + reason + ' :: ' + JSON.stringify(str.slice(0, 60)));
      });
      return hits;
    }

    // Plant a secret INSIDE an in-memory manifest copy and prove the sweep
    // surfaces it.
    const m = loadManifest();
    const poisoned = JSON.parse(JSON.stringify(m));
    assert.ok(Array.isArray(poisoned.maps) && poisoned.maps.length > 0,
      label + ': poisoned copy has maps entries');
    poisoned.maps[0].path = 'room/secret/leak.md';
    const poisonedHits = sweepEntries(poisoned);
    assert.ok(poisonedHits.length >= 1,
      label + ': the sweep over the POISONED manifest found zero hits - it would miss a planted leak');

    // ---- GREEN: the REAL artifact is clean. ----
    const hits = sweepEntries(m);
    assert.equal(hits.length, 0,
      label + ': the REAL manifest carries ' + hits.length +
        ' forbidden maps-entry value(s) (a user-content leak):\n    ' + hits.join('\n    '));

    // The two top-level legibility notes are bounded machinery prose: exempt from
    // the over-cap heuristic but MUST be clean of room/ paths + emails.
    for (const noteKey of ['ontology_ref', 'generated_note']) {
      const note = m[noteKey];
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
// CHECK 4 -- zero live Brain in the generator. Match on call/require SYNTAX with
// comment lines stripped so header prose naming "Brain" does not self-invalidate.
// ---------------------------------------------------------------------------
(function check4_zeroLiveBrain() {
  const label = 'CHECK 4 - generator makes zero live Brain read/write';
  try {
    const raw = fs.readFileSync(GENERATOR_PATH, 'utf8');
    const codeLines = raw.split('\n').filter((ln) => {
      const t = ln.trim();
      if (t.startsWith('//')) return false;
      if (t.startsWith('*')) return false;
      if (t.startsWith('/*')) return false;
      return true;
    });
    const code = codeLines.join('\n');

    assert.equal(/require\s*\(\s*[^)]*brain-client[^)]*\)/.test(code), false,
      label + ': generator code requires brain-client - the manifest must be a LOCAL artifact with zero live Brain');

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
          '" - the manifest must have zero runtime Brain dependency (Part 8 / Part 9)');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 5 -- generic-machinery + EXACTLY-THREE-MAPS.
// ---------------------------------------------------------------------------
(function check5_genericMachineryExactlyThree() {
  const label = 'CHECK 5 - exactly three maps + machinery-only entries (no per-surface row)';
  try {
    const m = loadManifest();
    const maps = Array.isArray(m.maps) ? m.maps : [];
    assert.equal(maps.length, 3, label + ': EXACTLY three map entries (no per-surface row)');

    const seenRoles = new Set();
    for (const e of maps) {
      // Every entry carries ONLY { role, path, digest, source_count }.
      assert.equal(Object.keys(e).sort().join(','), 'digest,path,role,source_count',
        label + ': entry carries exactly role/path/digest/source_count');
      // role is one of the three enums (never a surface slug).
      assert.ok(EXPECTED_ROLES.has(e.role),
        label + ': entry role "' + e.role + '" is one of the three declared map roles (not a surface slug)');
      assert.equal(seenRoles.has(e.role), false, label + ': no duplicate role');
      seenRoles.add(e.role);
      // path is a data/ relative path, no room/ no email.
      assert.ok(/^data\//.test(e.path), label + ': path is a data/ relative path');
      assert.equal(ROOM_PATH_RX.test(e.path), false, label + ': path carries no room/ path');
      assert.equal(EMAIL_RX.test(e.path), false, label + ': path carries no email');
      // digest is sha256 hex.
      assert.ok(/^[0-9a-f]{64}$/.test(e.digest), label + ': digest is sha256 hex (machinery metadata)');
      // source_count is a non-negative int.
      assert.ok(Number.isInteger(e.source_count) && e.source_count >= 0,
        label + ': source_count is a non-negative int');
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// CHECK 6 -- no em-dashes in the generator + this scan (HARD RULE).
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
  'harness-manifest Part-8 boundary scan: ' + passed + ' passed, ' +
    failed + ' failed (6 checks)\n'
);
process.exit(failed === 0 ? 0 : 1);
