#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Tests for lib/core/feynman-minto-invariants.cjs (Phase 88-00-B).
 *
 * 21 discrete test cases across 5 violation categories:
 *   existence, schema, freshness, coherence, atomicity.
 *
 * Pure node built-ins: fs, os, path, assert. No npm deps.
 * Fixtures are built under fs.mkdtempSync(...) and cleaned up on exit.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const INVARIANTS_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'lib',
  'core',
  'feynman-minto-invariants.cjs'
);

const { validate, SEVERITY, CATEGORIES } = require(INVARIANTS_PATH);

// ---------- Tmp workspace helpers ----------

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-inv-'));

function tmpFile(name, body) {
  const p = path.join(TMP_ROOT, name);
  fs.writeFileSync(p, body, 'utf8');
  return p;
}

function cleanup() {
  try {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  } catch (_) {
    /* best effort */
  }
}
process.on('exit', cleanup);

// ---------- Valid Feynman-MINTO fixture (~70 line realistic sample) ----------
// This fixture is the "golden" per Phase 81 R-3 schema + Phase 88 extensions.
// Every negative test below mutates a copy of this to trigger one violation.

const NOW_ISO = new Date().toISOString();
const HOUR_AGO_ISO = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const TWO_HOURS_AGO_ISO = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

const VALID_MINTO = [
  '---',
  'schema_version: "1.0"',
  'generated_at: "' + NOW_ISO + '"',
  'section: "problem-definition"',
  'section_path: "room/problem-definition"',
  'governing_thought: "The venture reduces time between insight and validated decision across every dimension simultaneously."',
  'key_claims:',
  '  - "Every artifact becomes a checkable claim."',
  '  - "Cross-section scans find contradictions before humans notice."',
  '  - "Decisions with reasons become training data."',
  'mece_arguments:',
  '  - "Primary evidence shows compression works"',
  '  - "Supporting evidence shows cascade is observable"',
  'cross_refs:',
  '  - "[[market-analysis/tam]]"',
  '  - "[[competitive-analysis/first-mover]]"',
  'sources:',
  '  - "artifact-01.md"',
  '  - "artifact-02.md"',
  'navigation: "ROOM.md"',
  'tier: 1',
  'last_generated_at: "' + NOW_ISO + '"',
  'last_artifact_write_seen_at: "' + HOUR_AGO_ISO + '"',
  'reasoning_health_score: 0.82',
  'flagged_weaknesses:',
  '  - "TAM benchmark is 18 months old"',
  'decision_log:',
  '  - session_id: "sess-2026-04-17"',
  '    timestamp: "' + HOUR_AGO_ISO + '"',
  '    action: "flag-tam-staleness"',
  '    user_response: "defer"',
  '    reason: "reviewing with advisor"',
  '    outcome: "deferred"',
  '---',
  '',
  '## Essence',
  'Folders are reasoning, artifacts are claims, graphs are intelligence.',
  '',
  '## Plain Language',
  'Founders waste weeks turning insight into confirmed decisions. This tool collapses the loop to hours by filing, scanning, and surfacing contradictions automatically.',
  '',
  '## Mental Model',
  'It is like an air traffic control tower for the venture. Each artifact is an incoming aircraft. Each section is a runway. The cross-relationship scan is radar that spots collisions.',
  '',
  '## Sweet Spot',
  'The folder structure IS the reasoning. Filing an artifact is a claim. Claims connect across sections as a graph. When the graph finds a contradiction you did not see, the venture is better for it.',
  '',
].join('\n');

// Convenience: produce a mutated copy of VALID_MINTO with a frontmatter key
// line replaced, removed, or inserted.

function withFrontmatterReplace(line, replacement) {
  return VALID_MINTO.replace(line, replacement);
}

function withFrontmatterDelete(line) {
  return VALID_MINTO.replace(line + '\n', '');
}

// ---------- Tests ----------

let passed = 0;
let failed = 0;
function run(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL  ' + name + '\n');
    process.stderr.write('        ' + (err && err.message ? err.message : err) + '\n');
  }
}

// 1. Valid fixture: no violations.
run('Test 1: valid fixture returns {valid:true, violations:[], severity:null}', function () {
  const p = tmpFile('valid-minto.md', VALID_MINTO);
  const r = validate(p);
  assert.equal(r.valid, true);
  assert.deepEqual(r.violations, []);
  assert.equal(r.severity, null);
});

// 2. Missing file: existence / critical.
run('Test 2: missing file -> existence/critical', function () {
  const r = validate(path.join(TMP_ROOT, 'does-not-exist.md'));
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.EXISTENCE &&
        v.severity === SEVERITY.CRITICAL &&
        /not found|does not exist|missing/i.test(v.message)
      );
    })
  );
  assert.equal(r.severity, SEVERITY.CRITICAL);
});

// 3. Empty file (zero bytes): existence / critical.
run('Test 3: empty file -> existence/critical', function () {
  const p = tmpFile('empty.md', '');
  const r = validate(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return v.category === CATEGORIES.EXISTENCE && v.severity === SEVERITY.CRITICAL;
    })
  );
});

// 4. No frontmatter delimiters: schema / error.
run('Test 4: no frontmatter delimiters -> schema/error', function () {
  const p = tmpFile('no-fm.md', '# Just a markdown body\n\nNo frontmatter here.\n');
  const r = validate(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return v.category === CATEGORIES.SCHEMA && v.severity === SEVERITY.ERROR;
    })
  );
});

// 5. Malformed YAML frontmatter: schema / error.
run('Test 5: malformed YAML frontmatter -> schema/error', function () {
  // Truly broken: unclosed quote on the governing_thought line, which our
  // hand-parser cannot recover into a scalar.
  const body = [
    '---',
    'schema_version: "1.0"',
    'governing_thought: "unterminated string',
    'section: "problem-definition"',
    '---',
    '',
    '## Essence',
    'Body.',
  ].join('\n');
  const p = tmpFile('bad-yaml.md', body);
  const r = validate(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return v.category === CATEGORIES.SCHEMA && v.severity === SEVERITY.ERROR;
    })
  );
});

// 6. Missing governing_thought: schema / critical.
// Phase 241 F-2: raised from SEVERITY.ERROR to SEVERITY.CRITICAL so this
// breach reaches the guardian's enqueue gate. See 241-RESEARCH.md.
run('Test 6: missing governing_thought -> schema/critical', function () {
  const mutated = withFrontmatterDelete(
    'governing_thought: "The venture reduces time between insight and validated decision across every dimension simultaneously."'
  );
  const p = tmpFile('no-gt.md', mutated);
  const r = validate(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.SCHEMA &&
        v.severity === SEVERITY.CRITICAL &&
        /governing_thought/.test(v.message)
      );
    })
  );
});

// 7. Missing schema_version: schema / error.
run('Test 7: missing schema_version -> schema/error', function () {
  const mutated = withFrontmatterDelete('schema_version: "1.0"');
  const p = tmpFile('no-sv.md', mutated);
  const r = validate(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.SCHEMA &&
        v.severity === SEVERITY.ERROR &&
        /schema_version/.test(v.message)
      );
    })
  );
});

// 8. Narrative body > 1500 token estimate (FEYNMINTO-01): schema / error.
run('Test 8: body token budget > 1500 -> schema/error', function () {
  // 1500 tokens * 4 bytes/token = 6000 bytes budget. Blow past that.
  const bigBody = 'x '.repeat(4000); // 8000 chars -> ~2000 token estimate
  const body = VALID_MINTO + '\n\n## Bloat\n' + bigBody + '\n';
  const p = tmpFile('bloated.md', body);
  const r = validate(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.SCHEMA &&
        v.severity === SEVERITY.ERROR &&
        /token budget/i.test(v.message)
      );
    })
  );
});

// 9. Missing last_generated_at: freshness / warning (backfill case, not critical).
run('Test 9: missing last_generated_at -> freshness/warning', function () {
  const mutated = withFrontmatterDelete('last_generated_at: "' + NOW_ISO + '"');
  const p = tmpFile('no-lga.md', mutated);
  const r = validate(p);
  // Must have a freshness/warning violation. (May also flag other things;
  // we only assert presence of the freshness one.)
  assert.ok(
    r.violations.some(function (v) {
      return v.category === CATEGORIES.FRESHNESS && v.severity === SEVERITY.WARNING;
    })
  );
});

// 10. last_generated_at older than last_artifact_write_seen_at by > 1 hour:
//     freshness / warning with "stale" in message.
run('Test 10: stale (generated before write + >1h) -> freshness/warning', function () {
  const mutated = VALID_MINTO
    .replace('last_generated_at: "' + NOW_ISO + '"', 'last_generated_at: "' + TWO_HOURS_AGO_ISO + '"')
    .replace('last_artifact_write_seen_at: "' + HOUR_AGO_ISO + '"', 'last_artifact_write_seen_at: "' + NOW_ISO + '"');
  const p = tmpFile('stale.md', mutated);
  const r = validate(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.FRESHNESS &&
        v.severity === SEVERITY.WARNING &&
        /stale/i.test(v.message)
      );
    })
  );
});

// 11. last_artifact_write_seen_at in the future (> now + 60s): freshness / warning.
run('Test 11: future write timestamp -> freshness/warning', function () {
  const future = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // +5 min
  const mutated = VALID_MINTO.replace(
    'last_artifact_write_seen_at: "' + HOUR_AGO_ISO + '"',
    'last_artifact_write_seen_at: "' + future + '"'
  );
  const p = tmpFile('future.md', mutated);
  const r = validate(p);
  assert.ok(
    r.violations.some(function (v) {
      return v.category === CATEGORIES.FRESHNESS && v.severity === SEVERITY.WARNING;
    })
  );
});

// 12. decision_log entry missing session_id: schema / error.
run('Test 12: decision_log entry missing session_id -> schema/error', function () {
  const mutated = VALID_MINTO.replace(
    '  - session_id: "sess-2026-04-17"\n',
    '  - '
  );
  const p = tmpFile('dl-no-sid.md', mutated);
  const r = validate(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.SCHEMA &&
        v.severity === SEVERITY.ERROR &&
        /session_id/.test(v.message)
      );
    })
  );
});

// 13. decision_log length > 20: schema / warning.
run('Test 13: decision_log > 20 entries -> schema/warning', function () {
  // Build a big decision_log block (21 entries).
  const entries = [];
  for (let i = 0; i < 21; i++) {
    entries.push('  - session_id: "sess-' + i + '"');
    entries.push('    timestamp: "' + HOUR_AGO_ISO + '"');
    entries.push('    action: "probe-' + i + '"');
    entries.push('    user_response: "approve"');
    entries.push('    reason: "ok"');
    entries.push('    outcome: "applied"');
  }
  // Replace the original single-entry decision_log block.
  const beforeDL = VALID_MINTO.indexOf('decision_log:');
  const afterDL = VALID_MINTO.indexOf('---', beforeDL);
  const mutated =
    VALID_MINTO.slice(0, beforeDL) +
    'decision_log:\n' +
    entries.join('\n') +
    '\n' +
    VALID_MINTO.slice(afterDL);
  const p = tmpFile('dl-over-cap.md', mutated);
  const r = validate(p);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.SCHEMA &&
        v.severity === SEVERITY.WARNING &&
        /decision_log/.test(v.message)
      );
    })
  );
});

// 14. decision_log entry user_response not in [approve, reject, defer]: schema / error.
run('Test 14: decision_log user_response invalid -> schema/error', function () {
  const mutated = VALID_MINTO.replace(
    '    user_response: "defer"',
    '    user_response: "maybe"'
  );
  const p = tmpFile('dl-bad-resp.md', mutated);
  const r = validate(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.SCHEMA &&
        v.severity === SEVERITY.ERROR &&
        /user_response/.test(v.message)
      );
    })
  );
});

// 15. em-dash in narrative body: coherence / warning (project hard rule).
run('Test 15: em-dash in narrative -> coherence/warning', function () {
  // Inject a U+2014 em-dash into the Essence paragraph.
  const mutated = VALID_MINTO.replace(
    'Folders are reasoning, artifacts are claims, graphs are intelligence.',
    'Folders are reasoning \u2014 artifacts are claims, graphs are intelligence.'
  );
  const p = tmpFile('emdash.md', mutated);
  const r = validate(p);
  assert.ok(
    r.violations.some(function (v) {
      return v.category === CATEGORIES.COHERENCE && v.severity === SEVERITY.WARNING;
    })
  );
});

// 16. reasoning_health_score out of [0,1]: schema / error.
run('Test 16: reasoning_health_score out of range -> schema/error', function () {
  const mutated = VALID_MINTO.replace(
    'reasoning_health_score: 0.82',
    'reasoning_health_score: 1.7'
  );
  const p = tmpFile('rhs-bad.md', mutated);
  const r = validate(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return (
        v.category === CATEGORIES.SCHEMA &&
        v.severity === SEVERITY.ERROR &&
        /reasoning_health_score/.test(v.message)
      );
    })
  );
});

// 17. File size > 50 KB: atomicity / warning (bloat guard).
run('Test 17: file > 50KB -> atomicity/warning', function () {
  const filler = '\n## Filler\n' + 'z '.repeat(30000) + '\n'; // ~60 KB body pad
  const body = VALID_MINTO + filler;
  const p = tmpFile('fat.md', body);
  const r = validate(p);
  assert.ok(
    r.violations.some(function (v) {
      return v.category === CATEGORIES.ATOMICITY && v.severity === SEVERITY.WARNING;
    })
  );
});

// 18. Orphan .tmp marker (# FEYNMINTO_TMP): atomicity / critical (mid-write crash).
run('Test 18: FEYNMINTO_TMP marker -> atomicity/critical', function () {
  const body = '# FEYNMINTO_TMP\n' + VALID_MINTO;
  const p = tmpFile('orphan-tmp.md', body);
  const r = validate(p);
  assert.equal(r.valid, false);
  assert.ok(
    r.violations.some(function (v) {
      return v.category === CATEGORIES.ATOMICITY && v.severity === SEVERITY.CRITICAL;
    })
  );
  assert.equal(r.severity, SEVERITY.CRITICAL);
});

// 19. cross_refs entry with non-wikilink syntax: coherence / warning.
run('Test 19: cross_refs non-wikilink -> coherence/warning', function () {
  const mutated = VALID_MINTO.replace(
    '  - "[[market-analysis/tam]]"',
    '  - "http://example.com/market"'
  );
  const p = tmpFile('xref-bad.md', mutated);
  const r = validate(p);
  assert.ok(
    r.violations.some(function (v) {
      return v.category === CATEGORIES.COHERENCE && v.severity === SEVERITY.WARNING;
    })
  );
});

// 20. Severity aggregation: MAX across violations (critical > error > warning > info).
run('Test 20: severity aggregation returns MAX across violations', function () {
  // Produce a file with BOTH a warning (em-dash) AND a critical (tmp marker).
  const mutated =
    '# FEYNMINTO_TMP\n' +
    VALID_MINTO.replace(
      'Folders are reasoning, artifacts are claims, graphs are intelligence.',
      'Folders are reasoning \u2014 artifacts are claims, graphs are intelligence.'
    );
  const p = tmpFile('agg.md', mutated);
  const r = validate(p);
  assert.equal(r.severity, SEVERITY.CRITICAL);

  // Warning-only should NOT bubble up to critical.
  const onlyWarning = VALID_MINTO.replace(
    'Folders are reasoning, artifacts are claims, graphs are intelligence.',
    'Folders are reasoning \u2014 artifacts are claims, graphs are intelligence.'
  );
  const p2 = tmpFile('warn-only.md', onlyWarning);
  const r2 = validate(p2);
  assert.equal(r2.severity, SEVERITY.WARNING);
});

// 21. Exports SEVERITY and CATEGORIES as frozen objects.
run('Test 21: exports SEVERITY and CATEGORIES constants', function () {
  assert.equal(typeof SEVERITY, 'object');
  assert.equal(typeof CATEGORIES, 'object');
  assert.equal(SEVERITY.CRITICAL, 'critical');
  assert.equal(SEVERITY.ERROR, 'error');
  assert.equal(SEVERITY.WARNING, 'warning');
  assert.equal(SEVERITY.INFO, 'info');
  assert.equal(CATEGORIES.EXISTENCE, 'existence');
  assert.equal(CATEGORIES.SCHEMA, 'schema');
  assert.equal(CATEGORIES.FRESHNESS, 'freshness');
  assert.equal(CATEGORIES.COHERENCE, 'coherence');
  assert.equal(CATEGORIES.ATOMICITY, 'atomicity');
  // Frozen: cannot mutate.
  assert.equal(Object.isFrozen(SEVERITY), true);
  assert.equal(Object.isFrozen(CATEGORIES), true);
});

// ---------- Summary ----------

process.stdout.write(
  '\nfeynman-minto-invariants: ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
